import * as THREE from 'three';
import {surfaceHeight,bounds,clamp} from './model.mjs?v=20261010-footprint1';
import {defaultWindBearing,normalizeBearing,windDirection,fillDustProfile,dustDensity,plumeLength,plumeHalfWidth,profileHeightRange} from './wind.mjs?v=20261010-wind1';

export function createDustPlume(scene){
  const width=48,height=24,data=new Uint8Array(width*height*4);
  const profile=new THREE.DataTexture(data,width,height,THREE.RGBAFormat);profile.minFilter=profile.magFilter=THREE.LinearFilter;profile.generateMipmaps=false;
  const quad=new THREE.PlaneGeometry(1,1),geometry=new THREE.InstancedBufferGeometry();
  geometry.setIndex(quad.index);geometry.setAttribute('position',quad.attributes.position);geometry.setAttribute('uv',quad.attributes.uv);
  const count=64,seeds=new Float32Array(count*4),random=n=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);};
  for(let i=0;i<count;i++)for(let j=0;j<4;j++)seeds[i*4+j]=random(i*4+j);
  geometry.setAttribute('puffSeed',new THREE.InstancedBufferAttribute(seeds,4));geometry.instanceCount=count;
  const material=new THREE.ShaderMaterial({
    uniforms:{...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),time:{value:0},density:{value:.4},origin:{value:new THREE.Vector2()},wind:{value:new THREE.Vector2()},terrainProfile:{value:profile},tableSize:{value:new THREE.Vector2(bounds.width,bounds.depth)}},
    vertexShader:`attribute vec4 puffSeed;uniform float time;uniform vec2 origin;uniform vec2 wind;uniform vec2 tableSize;uniform sampler2D terrainProfile;
varying vec2 vUv;varying float vFade;varying float vSeed;varying float vInside;
#include <fog_pars_vertex>
void main(){
  float age=fract(time*(.085+.035*puffSeed.y)+puffSeed.x);
  float along=.04+age*${plumeLength-.04};
  float across=(puffSeed.z*2.0-1.0)*(.06+age*1.65)+sin(time*.55+puffSeed.w*6.28)*.12*age;
  vec2 ground=origin+wind*along+vec2(-wind.y,wind.x)*across;
  vec2 profileUV=vec2(along/${plumeLength},(across+${plumeHalfWidth})/${plumeHalfWidth*2});
  vec2 encoded=texture2D(terrainProfile,profileUV).rg;
  float floorHeight=dot(encoded,vec2(65280.0,255.0))/65535.0*${profileHeightRange.toFixed(1)};
  float lift=.19+sin(age*3.14159)*(.18+puffSeed.w*.24)+age*.18;
  vec4 mvPosition=modelViewMatrix*vec4(ground.x,floorHeight+lift,ground.y,1.0);
  float size=.2+age*(.65+puffSeed.y*.38);mvPosition.xy+=position.xy*size;
  gl_Position=projectionMatrix*mvPosition;
  vUv=uv;vSeed=puffSeed.w;vFade=smoothstep(0.0,.1,age)*(1.0-smoothstep(.62,1.0,age));
  vInside=step(abs(ground.x),tableSize.x*.5)*step(abs(ground.y),tableSize.y*.5);
  #include <fog_vertex>
}`,
    fragmentShader:`uniform float density;varying vec2 vUv;varying float vFade;varying float vSeed;varying float vInside;
#include <fog_pars_fragment>
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float cloudNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1)),f.x),f.y);}
void main(){
  vec2 p=(vUv-.5)*2.0;float radius=dot(p,p);
  float noise=cloudNoise(p*3.0+vSeed*19.0)*.7+cloudNoise(p*6.0+vSeed*7.0)*.3;
  float softness=exp(-radius*3.8)*(1.0-smoothstep(.5,1.0,radius));
  float alpha=softness*(.55+noise*.7)*vFade*vInside*density*.27;
  if(alpha<.002)discard;
  vec3 color=mix(vec3(.42,.33,.22),vec3(.71,.64,.51),noise*.7+.2);
  gl_FragColor=vec4(color,alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`,
    transparent:true,depthWrite:false,fog:true,side:THREE.DoubleSide
  });
  const mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;mesh.renderOrder=7;scene.add(mesh);
  let location,bearing=defaultWindBearing;
  const refresh=()=>{if(!location)return;fillDustProfile(data,width,height,location,bearing,(x,z)=>surfaceHeight(clamp(x,-bounds.width/2,bounds.width/2),clamp(z,-bounds.depth/2,bounds.depth/2)));profile.needsUpdate=true;};
  const setDirection=value=>{const next=normalizeBearing(value);if(next===bearing&&location)return;bearing=next;const d=windDirection(bearing);material.uniforms.wind.value.set(d.x,d.z);refresh();};
  setDirection(bearing);
  return {mesh,setDirection,
    update(result){material.uniforms.density.value=dustDensity(result);const p=result.location;if(!location||p.x!==location.x||p.z!==location.z){location={...p};material.uniforms.origin.value.set(p.x,p.z);refresh();}},
    tick(seconds){material.uniforms.time.value=seconds;}
  };
}
