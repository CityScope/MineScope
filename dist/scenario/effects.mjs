import * as THREE from 'three';
import { surfaceHeight, runoffPath, clamp, habitat, livelihood, interventions, bounds } from './model.mjs?v=20261010-footprint1';
import {createOcean} from './water.mjs?v=20261010-footprint1';
import {createAttachedProtections,protectionAnchor} from './protections.mjs?v=20261010-footprint1';
import {createHatchedArea} from './area-hatching.mjs?v=20261010-footprint1';
import {siteMoved} from './render-policy.mjs?v=20261007-ws-status1';
import {createRestrictionHighlights} from './restriction-highlights.mjs?v=20261010-footprint1';
import {createDustPlume} from './dust-plume.mjs?v=20261010-wind1';

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
    const x=clamp(location.x+(uv.getX(i)-.5)*size,-bounds.width/2+.02,bounds.width/2-.02),z=clamp(location.z+(.5-uv.getY(i))*size,-bounds.depth/2+.02,bounds.depth/2-.02);
    positions.setXYZ(i,x,surfaceHeight(x,z)+.14,z);
  }
  positions.needsUpdate=true;mesh.geometry.computeBoundingSphere();
}
export function createEffects(scene,{interactive=true}={}) {
  const restrictions=interactive?createRestrictionHighlights(scene):null;
  const oceanMaterial=createOcean(scene);
  const dustCloud=createDustPlume(scene),dust=dustCloud.mesh;
  const noiseMaterial=projectedMaterial(`
vec2 p=(vUv-.5)*10.0;float r=length(p);
float fade=exp(-dot(p,p)/7.0)*(1.0-smoothstep(3.4,4.65,r));
float dots=1.0-smoothstep(.07,.16,length(fract(p*3.4)-.5));
float alpha=fade*(.025+dots*.3)*(.35+intensity*.65);`,'#a9bafa');
  const noise=patch(10,80,noiseMaterial,scene);
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
  const projection={pollution,dust,noise,habitat:createHatchedArea(scene,habitat,'#3d977b',[1,1],.16),land:createHatchedArea(scene,livelihood,'#b88e49',[1,-1],.23)};
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
    const mesh=patch(2.6,32,material,scene);mesh.renderOrder=9;
    return {id:i.id,mesh,material,funded:0};
  });
  let protectionVisible=true,previousLocation,previousWater;
  return {
    protectionAnchor,
    setWind:dustCloud.setDirection,
    createRiverMaterial(){
      const material=new THREE.ShaderMaterial({uniforms:{time:{value:0}},vertexShader:vertex,
        fragmentShader:`varying vec2 vUv;uniform float time;
void main(){float flow=pow(.5+.5*sin(vUv.x*145.0+time*2.2),4.0);vec3 color=mix(vec3(.08,.28,.46),vec3(.28,.75,1.0),flow);gl_FragColor=vec4(color*1.35,1.0);
#include <colorspace_fragment>
}`,toneMapped:false});riverMaterials.push(material);return material;
    },
    update(result,{placing=false}={}){
      restrictions?.update(result,placing);
      const p=result.location,moved=siteMoved(previousLocation,p);
      if(moved)placePatch(noise,p);
      dustCloud.update(result);
      noiseMaterial.uniforms.intensity.value=clamp((result.current.community-12)/70);
      pollutionMaterial.uniforms.intensity.value=result.current.water/100;
      cylinders.update(result);
      for(const protection of protections) {
        protection.funded=result.strength[protection.id];protection.material.uniforms.funded.value=protection.funded;
        protection.mesh.visible=protectionVisible&&protection.funded>0;
        if(moved)placePatch(protection.mesh,protectionAnchor(protection.id,p));
      }
      if(moved) {
        const path=runoffPath(p),pos=geometry.attributes.position;
        pollution.userData.hasPath=path.length>1;
        for(let i=0;i<count;i++) {
          const t=i/(count-1),index=t*(path.length-1),k=Math.floor(index),a=path[k],b=path[Math.min(k+1,path.length-1)],f=index-k;
          const x=a.x+(b.x-a.x)*f,z=a.z+(b.z-a.z)*f,next=path[Math.min(k+1,path.length-1)],previous=path[Math.max(k-1,0)],length=Math.max(.001,Math.hypot(next.x-previous.x,next.z-previous.z));
          const nx=-(next.z-previous.z)/length,nz=(next.x-previous.x)/length,width=.06+t*.12;
          for(let side=0;side<2;side++){const sign=side?1:-1,px=clamp(x+nx*width*sign,-bounds.width/2,bounds.width/2),pz=clamp(z+nz*width*sign,-bounds.depth/2,bounds.depth/2);pos.setXYZ(i*2+side,px,surfaceHeight(px,pz)+.145,pz);}
        }
        pos.needsUpdate=true;geometry.computeBoundingSphere();
      }
      previousLocation={...p};previousWater=result.current.water;
    },
    setLayers(layers){for(const [id,mesh] of Object.entries(projection))mesh.visible=layers[id]!==false;protectionVisible=layers.protection!==false;cylinders.setVisible(protectionVisible);for(const p of protections)p.mesh.visible=protectionVisible&&p.funded>0;},
    tick(seconds){restrictions?.tick();dustCloud.tick(seconds);for(const mat of [oceanMaterial,noiseMaterial,pollutionMaterial,...riverMaterials,...protections.map(p=>p.material)])mat.uniforms.time.value=seconds;}
  };
}
