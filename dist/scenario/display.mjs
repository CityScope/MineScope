import * as THREE from 'three';

export function screenMatrix(points,width,height) {
  const [p0,p1,p2,p3]=points;
  const dx1=p1.x-p2.x,dx2=p3.x-p2.x,dx3=p0.x-p1.x+p2.x-p3.x;
  const dy1=p1.y-p2.y,dy2=p3.y-p2.y,dy3=p0.y-p1.y+p2.y-p3.y;
  const denominator=dx1*dy2-dx2*dy1;
  const g=Math.abs(denominator)>1e-8?(dx3*dy2-dx2*dy3)/denominator:0;
  const h=Math.abs(denominator)>1e-8?(dx1*dy3-dx3*dy1)/denominator:0;
  return [(p1.x-p0.x+g*p1.x)/width,(p1.y-p0.y+g*p1.y)/width,0,g/width,
    (p3.x-p0.x+h*p3.x)/height,(p3.y-p0.y+h*p3.y)/height,0,h/height,
    0,0,1,0,p0.x,p0.y,0,1];
}

export function createDisplay(scene,element,stage,depth=13) {
  const group=new THREE.Group();scene.add(group);
  const casing=new THREE.MeshPhysicalMaterial({color:'#122332',roughness:.45,metalness:.25,clearcoat:.2});
  const back=new THREE.Mesh(new THREE.BoxGeometry(1,1,.28),casing);back.castShadow=true;group.add(back);
  const screen=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({color:new THREE.Color('#62b4e6').multiplyScalar(2.1),toneMapped:false}));group.add(screen);
  const screenLight=new THREE.RectAreaLight('#83c6f6',.95,18,5.5);group.add(screenLight);
  const glowGeometry=new THREE.PlaneGeometry(1,1);
  const glow=new THREE.Mesh(glowGeometry,new THREE.ShaderMaterial({
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:'varying vec2 vUv;void main(){vec2 p=abs(vUv-.5)*2.0;float a=exp(-dot(p,p)*3.5)*.14;gl_FragColor=vec4(vec3(.12,.28,.46),a);}',
    transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false
  }));group.add(glow);
  const posts=[];
  for(const x of [-3.2,3.2]) {
    const post=new THREE.Mesh(new THREE.CylinderGeometry(.09,.11,1,24),casing);post.position.x=x;post.position.z=-.14;group.add(post);posts.push(post);
  }
  const base=new THREE.Mesh(new THREE.BoxGeometry(9,.18,1.1),casing);base.position.set(0,-.3,-.12);group.add(base);
  const screenZ=-depth/2-1.4;
  let width=20,height=6.2,bottom=3.2,domWidth=1000,domHeight=310,projectedBounds;
  function resize() {
    const portrait=stage.clientWidth/stage.clientHeight<1;
    width=portrait?20.4:20;height=portrait?11.56:6.2;domWidth=portrait?600:1000;domHeight=portrait?340:310;
    element.classList.toggle('portrait-display',portrait);
    element.style.width=`${domWidth}px`;element.style.height=`${domHeight}px`;
    group.position.set(0,0,screenZ);
    back.scale.set(width+.45,height+.45,1);back.position.y=bottom+height/2;
    screen.scale.set(width,height,1);screen.position.set(0,bottom+height/2,.151);
    screenLight.width=width*.92;screenLight.height=height*.85;screenLight.position.set(0,bottom+height/2,.3);screenLight.lookAt(0,.6,6);
    glow.scale.set(width*1.4,height*1.9,1);glow.position.set(0,bottom+height/2,-.17);
    for(const post of posts){post.scale.y=bottom+.2;post.position.y=(bottom-.2)/2;}
  }
  function update(camera) {
    const points=[[-width/2,bottom+height],[width/2,bottom+height],[width/2,bottom],[-width/2,bottom]].map(([x,y])=>{
      const p=new THREE.Vector3(x,y,screenZ+.156).project(camera);
      return {x:(p.x*.5+.5)*stage.clientWidth,y:(-.5*p.y+.5)*stage.clientHeight,z:p.z};
    });
    const visible=camera.position.z>screenZ+.156&&points.every(p=>p.z<1&&p.z>-1);
    projectedBounds=visible?{left:Math.min(...points.map(p=>p.x)),right:Math.max(...points.map(p=>p.x)),top:Math.min(...points.map(p=>p.y)),bottom:Math.max(...points.map(p=>p.y))}:null;
    element.style.visibility=visible?'visible':'hidden';
    if(visible)element.style.transform=`matrix3d(${screenMatrix(points,domWidth,domHeight).join(',')})`;
  }
  resize();return {resize,update,get top(){return bottom+height+.3;},get framingPoints(){return [-width/2-.3,width/2+.3].flatMap(x=>[bottom-.3,bottom+height+.3].map(y=>[x,y,screenZ]));},get projectedBounds(){return projectedBounds;}};
}
