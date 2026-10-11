import * as THREE from 'three';
import {bounds,surfaceHeight,elevation,habitat,slope,settlements,siteFootprint,geographyData} from './model.mjs?v=20261010-footprint1';
import {sampleGrid} from './geography-core.mjs?v=20261007-ws-status1';

export function createRestrictionHighlights(scene) {
  const geometry=new THREE.PlaneGeometry(bounds.width,bounds.depth,128,128);geometry.rotateX(-Math.PI/2);
  const positions=geometry.attributes.position,mask=new Float32Array(positions.count*4);
  for(let i=0;i<positions.count;i++){
    const x=positions.getX(i),z=positions.getZ(i),h=elevation(x,z);
    positions.setY(i,surfaceHeight(x,z)+.17);
    mask[i*4]=h<=0?1:0;mask[i*4+1]=habitat(x,z);
    const occupied=settlements.some(s=>Math.abs(s.x-x)<.32&&Math.abs(s.z-z)<.32);
    mask[i*4+2]=Math.max(sampleGrid(geographyData().masks.urban,x,z),occupied?1:0);
    const heights=[[-1,-1],[-1,1],[1,-1],[1,1]].map(([a,b])=>elevation(x+a*siteFootprint.width/2,z+b*siteFootprint.depth/2));
    mask[i*4+3]=slope(x,z)>.35||Math.max(...heights)-Math.min(...heights)>150?1:0;
  }
  geometry.setAttribute('restriction',new THREE.BufferAttribute(mask,4));geometry.computeBoundingSphere();
  const material=new THREE.ShaderMaterial({
    uniforms:{center:{value:new THREE.Vector2()},reasons:{value:new THREE.Vector4()},highlightStrength:{value:0}},
    vertexShader:`attribute vec4 restriction;varying vec4 vRestriction;varying vec2 vGround;
void main(){vRestriction=restriction;vGround=position.xz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:`uniform vec2 center;uniform vec4 reasons;uniform float highlightStrength;varying vec4 vRestriction;varying vec2 vGround;
void main(){
  vec4 selected=vRestriction*reasons;
  float field=max(max(selected.x,selected.y),max(selected.z,selected.w));
  float aa=max(fwidth(field),.002);
  float area=smoothstep(.38-aa,.38+aa,field);
  float edge=1.0-smoothstep(aa*.4,aa*1.7,abs(field-.38));
  float focus=1.0-smoothstep(1.15,3.0,length(vGround-center));
  float coordinate=(vGround.x+vGround.y)/.22;
  float stripe=1.0-smoothstep(.08,.08+max(fwidth(coordinate),.025),abs(fract(coordinate+.5)-.5));
  float alpha=highlightStrength*focus*(area*(.12+stripe*.29)+edge*.65);
  if(alpha<.003)discard;
  gl_FragColor=vec4(vec3(1.0,.37,.25)*1.35,min(alpha,.7));
  #include <colorspace_fragment>
}`,
    transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false,blending:THREE.AdditiveBlending
  });
  const surface=new THREE.Mesh(geometry,material);surface.renderOrder=10;surface.visible=false;scene.add(surface);
  const edgePoints=[];
  for(let edge=0;edge<4;edge++)for(let i=0;i<128;i++){
    const t=i/128,x=(edge===0?-.5+t:edge===1?.5:edge===2?.5-t:-.5)*bounds.width,z=(edge===0?-.5:edge===1?-.5+t:edge===2?.5:.5-t)*bounds.depth;
    edgePoints.push(new THREE.Vector3(x,surfaceHeight(x,z)+.18,z));
  }
  const edge=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(edgePoints),new THREE.LineBasicMaterial({color:'#ff947e',transparent:true,opacity:0,toneMapped:false}));edge.renderOrder=10;edge.visible=false;scene.add(edge);
  let target=0,edgeActive=false;
  return {
    update(result,placing){
      target=placing&&!result.suitability.viable?1:0;
      const ids=new Set(result.suitability.reasons.map(r=>r.id));
      material.uniforms.center.value.set(result.location.x,result.location.z);
      material.uniforms.reasons.value.set(...['water','habitat','settlement','terrain'].map(id=>ids.has(id)?1:0));
      edgeActive=placing&&ids.has('extent');
    },
    tick(){
      const u=material.uniforms.highlightStrength;u.value+=(target-u.value)*.28;
      surface.visible=u.value>.005;edge.material.opacity=edgeActive?.75:edge.material.opacity*.72;edge.visible=edge.material.opacity>.005;
    }
  };
}
