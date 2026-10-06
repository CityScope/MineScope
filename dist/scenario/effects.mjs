import * as THREE from 'three';
import { surfaceHeight, riverZ, clamp, habitat, livelihood, interventions } from './model.mjs';
import {createOcean} from './water.mjs';
import {createAttachedProtections,protectionAnchor} from './protections.mjs?v=20261005-perf1';
import {createHatchedArea} from './area-hatching.mjs?v=20261005-perf1';
import {siteMoved} from './render-policy.mjs';

const vertex=`varying vec2 vUv;
void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;
function projectedMaterial(fragment,color) {
  return new THREE.ShaderMaterial({
    uniforms:{time:{value:0},intensity:{value:1},color:{value:new THREE.Color(color)},radius:{value:1},funded:{value:1}},
    vertexShader:vertex,
    fragmentShader:`varying vec2 vUv;uniform float time;uniform float intensity;uniform vec3 color;uniform float radius;uniform float funded;
float fieldHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float fieldNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(fieldHash(i),fieldHash(i+vec2(1,0)),f.x),mix(fieldHash(i+vec2(0,1)),fieldHash(i+vec2(1)),f.x),f.y);}
void main(){${fragment}
gl_FragColor=vec4(color*1.7,clamp(alpha,0.0,0.5));
#include <colorspace_fragment>
}`,
    transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false,blending:THREE.AdditiveBlending
  });
}
function patch(size,segments,mat,scene) {
  const geometry=new THREE.PlaneGeometry(size,size,segments,segments);geometry.rotateX(-Math.PI/2);
  const mesh=new THREE.Mesh(geometry,mat);mesh.userData.extent=size;mesh.renderOrder=4;scene.add(mesh);return mesh;
}
function placePatch(mesh,location) {
  const positions=mesh.geometry.attributes.position,uv=mesh.geometry.attributes.uv,size=mesh.userData.extent;
  for(let i=0;i<positions.count;i++) {
    const x=clamp(location.x+(uv.getX(i)-.5)*size,-10.98,10.98),z=clamp(location.z+(.5-uv.getY(i))*size,-6.48,6.48);
    positions.setXYZ(i,x,surfaceHeight(x,z)+.14,z);
  }
  positions.needsUpdate=true;mesh.geometry.computeBoundingSphere();
}
export function createEffects(scene) {
  const oceanMaterial=createOcean(scene);
  const dustMaterial=projectedMaterial(`
vec2 p=vec2((vUv.x-.5)*10.0,(.5-vUv.y)*10.0);
vec2 wind=normalize(vec2(.8,.6));float along=dot(p,wind);float across=dot(p,vec2(-wind.y,wind.x));
float width=.34+max(along,0.0)*.42;
float plume=exp(-pow(across/width,2.0))*smoothstep(-.3,.6,along)*(1.0-smoothstep(2.8,5.4,along));
vec2 drift=p-wind*time*.25;
float particles=.48+.32*fieldNoise(drift*2.8)+.2*fieldNoise(drift*6.0+7.3);
float alpha=plume*particles*(.32+intensity*.65);`,'#E9BB63');
  const noiseMaterial=projectedMaterial(`
vec2 p=(vUv-.5)*10.0;float r=length(p);
float fade=exp(-dot(p,p)/7.0)*(1.0-smoothstep(3.4,4.65,r));
float dots=1.0-smoothstep(.07,.16,length(fract(p*3.4)-.5));
float alpha=fade*(.025+dots*.3)*(.35+intensity*.65);`,'#a9bafa');
  const dust=patch(10,128,dustMaterial,scene),noise=patch(10,128,noiseMaterial,scene);
  const count=160,geometry=new THREE.BufferGeometry(),positions=new Float32Array(count*6),uv=new Float32Array(count*4),indices=[];
  for(let i=0;i<count;i++){uv[i*4]=0;uv[i*4+1]=i/(count-1);uv[i*4+2]=1;uv[i*4+3]=i/(count-1);if(i<count-1){const a=i*2;indices.push(a,a+2,a+1,a+1,a+2,a+3);}}
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));geometry.setIndex(indices);
  const pollutionMaterial=projectedMaterial(`
float edge=pow(max(0.0,1.0-abs(vUv.x*2.0-1.0)),.65);
float downstream=1.0-smoothstep(.72,1.0,vUv.y);
float flow=.65+.35*sin(vUv.y*95.0-time*2.8);
float alpha=edge*downstream*flow*(.16+intensity*.65);`,'#E08063');
  const pollution=new THREE.Mesh(geometry,pollutionMaterial);pollution.renderOrder=5;scene.add(pollution);
  const riverMaterials=[];
  const projection={pollution,dust,noise,habitat:createHatchedArea(scene,habitat,'#3d977b',[1,1],.28),land:createHatchedArea(scene,livelihood,'#b88e49',[1,-1],.23)};
  const cylinders=createAttachedProtections(scene);
  const protections=interventions.map((i,index)=>{
    const material=projectedMaterial(`
vec2 p=(vUv-.5)*2.6;float r=length(p);
float phase=fract((r-.43)*1.65-time*.42+radius);
float wave=1.0-smoothstep(.025,.13,min(phase,1.0-phase));
float fade=smoothstep(.4,.48,r)*(1.0-smoothstep(.7,1.25,r));
float rim=(1.0-smoothstep(.018,.055,abs(r-.47)))*.4;
float alpha=(wave*fade*.6+rim)*(.25+.75*funded);`,i.color);
    material.uniforms.radius.value=index*.17;
    const mesh=patch(2.6,56,material,scene);mesh.renderOrder=9;
    return {id:i.id,mesh,material,funded:0};
  });
  let protectionVisible=true,previousLocation,previousWater;
  return {
    protectionAnchor,
    createRiverMaterial(){
      const material=new THREE.ShaderMaterial({uniforms:{time:{value:0}},vertexShader:vertex,
        fragmentShader:`varying vec2 vUv;uniform float time;
void main(){float flow=pow(.5+.5*sin(vUv.x*145.0+time*2.2),4.0);vec3 color=mix(vec3(.08,.28,.46),vec3(.28,.75,1.0),flow);gl_FragColor=vec4(color*1.35,1.0);
#include <colorspace_fragment>
}`,toneMapped:false});riverMaterials.push(material);return material;
    },
    update(result){
      const p=result.location,moved=siteMoved(previousLocation,p);
      if(moved){placePatch(dust,p);placePatch(noise,p);}
      dustMaterial.uniforms.intensity.value=clamp((result.current.community-12)/70);
      noiseMaterial.uniforms.intensity.value=clamp((result.current.community-12)/70);
      pollutionMaterial.uniforms.intensity.value=result.current.water/100;
      cylinders.update(result);
      for(const protection of protections) {
        protection.funded=result.strength[protection.id];protection.material.uniforms.funded.value=protection.funded;
        protection.mesh.visible=protectionVisible&&protection.funded>0;
        if(moved)placePatch(protection.mesh,protectionAnchor(protection.id,p));
      }
      if(moved||previousWater!==result.current.water) {
      const end=clamp(Math.min(-8.8,p.x-.95),-10.85,10.8),pos=geometry.attributes.position;
      for(let i=0;i<count;i++){
        const t=i/(count-1),x=p.x+(end-p.x)*t,blend=1-Math.exp(-t*15),z=clamp(p.z*(1-blend)+riverZ(x)*blend,-6.3,6.3),width=.12+t*.3+result.current.water/100*.09;
        for(let side=0;side<2;side++){const px=clamp(x,-10.98,10.98),pz=clamp(z+(side===0?-width:width),-6.48,6.48);pos.setXYZ(i*2+side,px,surfaceHeight(px,pz)+.145,pz);}
      }
      pos.needsUpdate=true;geometry.computeBoundingSphere();
      }
      previousLocation={...p};previousWater=result.current.water;
    },
    setLayers(layers){for(const [id,mesh] of Object.entries(projection))mesh.visible=layers[id]!==false;protectionVisible=layers.protection!==false;cylinders.setVisible(protectionVisible);for(const p of protections)p.mesh.visible=protectionVisible&&p.funded>0;},
    tick(seconds){for(const mat of [oceanMaterial,dustMaterial,noiseMaterial,pollutionMaterial,...riverMaterials,...protections.map(p=>p.material)])mat.uniforms.time.value=seconds;}
  };
}
