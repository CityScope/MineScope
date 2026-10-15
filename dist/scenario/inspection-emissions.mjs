import * as THREE from 'three';
import {bounds,clamp,siteFootprint,siteSupportHeight,surfaceHeight} from './model.mjs?v=20261010-footprint1';
import {defaultWindBearing,normalizeBearing,windDirection,fillDustProfile,dustDensity,plumeLength,plumeHalfWidth,profileHeightRange} from './wind.mjs?v=20261010-wind1';

// Close-view illustrative motion, without a concentration or gas chemistry model.
// Every particle is seeded once. The GPU animates the fixed batch; the small
// terrain profile changes only after a placement or wind-direction update.
export function createInspectionEmissions(scene) {
  const width=48,height=24,data=new Uint8Array(width*height*4);
  const terrainProfile=new THREE.DataTexture(data,width,height,THREE.RGBAFormat);
  terrainProfile.minFilter=terrainProfile.magFilter=THREE.LinearFilter;
  terrainProfile.generateMipmaps=false;
  const quad=new THREE.PlaneGeometry(1,1),geometry=new THREE.InstancedBufferGeometry();
  geometry.setIndex(quad.index);geometry.setAttribute('position',quad.attributes.position);geometry.setAttribute('uv',quad.attributes.uv);
  const dustCount=64,grainCount=72,gasCount=40,count=dustCount+grainCount+gasCount;
  const seeds=new Float32Array(count*4),kinds=new Float32Array(count);
  const random=n=>{const value=Math.sin(n*127.1+311.7)*43758.5453;return value-Math.floor(value);};
  for(let i=0;i<count;i++) {
    for(let j=0;j<4;j++)seeds[i*4+j]=random(i*4+j+419);
    kinds[i]=i<dustCount?0:i<dustCount+grainCount?1:2;
  }
  geometry.setAttribute('particleSeed',new THREE.InstancedBufferAttribute(seeds,4));
  geometry.setAttribute('particleKind',new THREE.InstancedBufferAttribute(kinds,1));geometry.instanceCount=count;
  const profilePad=Math.hypot(siteFootprint.width,siteFootprint.depth)*.5+.08;
  const material=new THREE.ShaderMaterial({
    uniforms:{
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),time:{value:0},detail:{value:0},density:{value:0},
      origin:{value:new THREE.Vector2()},wind:{value:new THREE.Vector2()},sourceHeight:{value:0},
      terrainProfile:{value:terrainProfile},tableSize:{value:new THREE.Vector2(bounds.width,bounds.depth)}
    },
    vertexShader:`attribute vec4 particleSeed;attribute float particleKind;
uniform float time;uniform vec2 origin;uniform vec2 wind;uniform float sourceHeight;
uniform sampler2D terrainProfile;uniform vec2 tableSize;
varying vec2 vUv;varying float vFade;varying float vSeed;varying float vKind;varying float vInside;
#include <fog_pars_vertex>
void main(){
  bool grain=particleKind>.5&&particleKind<1.5;
  bool gas=particleKind>1.5;
  float speed=gas?.065:(grain?.13:.09);
  float age=fract(time*speed*(.82+particleSeed.y*.36)+particleSeed.x);
  float along,across,lift,size;
  if(gas){
    along=(particleSeed.z-.5)*.35+age*.86;
    across=(particleSeed.w-.5)*.48+sin(age*5.4+particleSeed.z*6.283)*(.03+age*.12);
    lift=.19+age*(.85+particleSeed.y*.55);
    size=.2+age*(.46+particleSeed.z*.2);
  }else{
    along=-.16+age*(grain?3.35:2.85);
    across=(particleSeed.z*2.0-1.0)*(.14+age*(grain?.88:1.04));
    across+=sin(time*.36+particleSeed.w*6.283+age*4.0)*.09*age;
    lift=grain?.1+sin(age*3.14159)*(.15+particleSeed.w*.16):.15+sin(age*3.14159)*(.2+particleSeed.w*.2);
    size=grain?.012+particleSeed.y*.014:.16+age*(.42+particleSeed.y*.26);
  }
  vec2 ground=origin+wind*along+vec2(-wind.y,wind.x)*across;
  vec2 profileUV=vec2((along+${profilePad.toFixed(6)})/${plumeLength.toFixed(1)},(across+${plumeHalfWidth.toFixed(1)})/${(plumeHalfWidth*2).toFixed(1)});
  vec2 encoded=texture2D(terrainProfile,clamp(profileUV,0.0,1.0)).rg;
  float floorHeight=dot(encoded,vec2(65280.0,255.0))/65535.0*${profileHeightRange.toFixed(1)};
  float sourceBlend=1.0-smoothstep(.12,.9,max(0.0,along));
  float floor=max(floorHeight,mix(floorHeight,sourceHeight,sourceBlend));
  vec4 mvPosition=modelViewMatrix*vec4(ground.x,floor+lift,ground.y,1.0);
  vec2 billboard=position.xy*size;
  if(gas)billboard.y*=1.42;
  if(grain)billboard.x*=1.6;
  mvPosition.xy+=billboard;
  gl_Position=projectionMatrix*mvPosition;
  vUv=uv;vSeed=particleSeed.w;vKind=particleKind;
  vFade=smoothstep(0.0,.12,age)*(1.0-smoothstep(gas?.65:.7,1.0,age));
  vec2 edge=tableSize*.5-abs(ground);
  vInside=smoothstep(.02,.18,min(edge.x,edge.y));
  #include <fog_vertex>
}`,
    fragmentShader:`uniform float detail;uniform float density;
varying vec2 vUv;varying float vFade;varying float vSeed;varying float vKind;varying float vInside;
#include <fog_pars_fragment>
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float fieldNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1)),f.x),f.y);}
void main(){
  vec2 p=(vUv-.5)*2.0;float radius=dot(p,p);
  float fine=fieldNoise(p*5.0+vSeed*17.0);
  float billow=fieldNoise(p*2.3+vSeed*9.0)*.7+fine*.3;
  float soft=exp(-radius*3.1)*(1.0-smoothstep(.45,1.0,radius));
  float alpha;vec3 color;
  if(vKind>1.5){
    float ribbon=.6+.4*sin(p.y*4.5+p.x*3.0+vSeed*6.283);
    alpha=soft*(.45+billow*.55)*ribbon*.16;
    color=mix(vec3(.49,.58,.63),vec3(.76,.82,.84),billow);
  }else if(vKind>.5){
    alpha=soft*.4;color=vec3(.87,.68,.38);
  }else{
    alpha=soft*(.45+billow*.65)*.19;
    color=mix(vec3(.48,.34,.17),vec3(.8,.65,.4),billow*.8+.2);
  }
  alpha*=vFade*vInside*density*detail;
  if(alpha<.0015)discard;
  gl_FragColor=vec4(color,alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`,
    transparent:true,depthWrite:false,fog:true,side:THREE.DoubleSide
  });
  const mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;mesh.renderOrder=8;mesh.visible=false;scene.add(mesh);
  let location,bearing=defaultWindBearing,profileDirty=false,detail=0;
  const refreshProfile=()=>{
    if(!profileDirty||!location||detail<=.001)return;
    const direction=windDirection(bearing),start={x:location.x-direction.x*profilePad,z:location.z-direction.z*profilePad};
    fillDustProfile(data,width,height,start,bearing,(x,z)=>surfaceHeight(clamp(x,-bounds.width/2,bounds.width/2),clamp(z,-bounds.depth/2,bounds.depth/2)));
    terrainProfile.needsUpdate=true;profileDirty=false;
  };
  const setDirection=value=>{
    const next=normalizeBearing(value);if(next===bearing&&material.uniforms.wind.value.lengthSq()>0)return;
    bearing=next;const direction=windDirection(bearing);material.uniforms.wind.value.set(direction.x,direction.z);profileDirty=true;refreshProfile();
  };
  setDirection(bearing);
  return {
    mesh,setDirection,
    update(result){
      material.uniforms.density.value=dustDensity(result);
      const p=result.location;
      if(!location||p.x!==location.x||p.z!==location.z){
        location={x:p.x,z:p.z};material.uniforms.origin.value.set(p.x,p.z);
        material.uniforms.sourceHeight.value=siteSupportHeight(p)+.24;
        profileDirty=true;refreshProfile();
      }
      mesh.visible=detail>.001;
    },
    setDetail(value){
      detail=Number.isFinite(value)?clamp(value):0;material.uniforms.detail.value=detail;
      mesh.visible=!!location&&detail>.001;refreshProfile();
    },
    tick(seconds){material.uniforms.time.value=Number.isFinite(seconds)?seconds:0;refreshProfile();}
  };
}
