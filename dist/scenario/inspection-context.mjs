import * as THREE from 'three';
import {bounds,surfaceHeight,elevation,habitat,drainage,slope,settlements,geographyData,kmPerUnit,clamp} from './model.mjs?v=20261010-footprint1';
import {sampleGrid} from './geography-core.mjs?v=20261007-ws-status1';
import {sampleInspectionSignals,summarizeInspection} from './inspection-policy.mjs?v=20261015-inspection1';

function detailMaterial(color,uniforms,{emissive=false}={}) {
  const material=new THREE.MeshStandardMaterial({color,roughness:.9,metalness:0,transparent:true,depthWrite:true,
    emissive:emissive?color:'#000000',emissiveIntensity:emissive?.28:0});
  material.onBeforeCompile=shader=>{
    shader.uniforms.inspectionDetail=uniforms.detail;shader.uniforms.inspectionCenter=uniforms.center;
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 inspectionGround;')
      .replace('#include <begin_vertex>',`#include <begin_vertex>
vec4 inspectionWorld=vec4(transformed,1.0);
#ifdef USE_INSTANCING
inspectionWorld=instanceMatrix*inspectionWorld;
#endif
inspectionGround=(modelMatrix*inspectionWorld).xz;`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform float inspectionDetail;uniform vec2 inspectionCenter;varying vec2 inspectionGround;')
      .replace('#include <opaque_fragment>',`float inspectionFade=inspectionDetail*(1.0-smoothstep(1.1,3.15,length(inspectionGround-inspectionCenter)));
if(inspectionFade<.015)discard;
diffuseColor.a*=inspectionFade;
#include <opaque_fragment>`);
  };
  material.customProgramCacheKey=()=> 'inspection-urban-v1';return material;
}

function createSettlementDetail(scene,uniforms) {
  const group=new THREE.Group();group.name='Illustrative settlement detail';group.visible=false;scene.add(group);
  const homes=[],roofs=[],trunks=[],crowns=[],windows=[],lanes=[];let enhancedBuildings=0;
  const add=(list,x,y,z,w,h,d,angle=0)=>list.push({x,y,z,w,h,d,angle});
  const land=(x,z)=>Math.abs(x)<bounds.width/2-.08&&Math.abs(z)<bounds.depth/2-.08&&elevation(x,z)>0;
  const support=(x,z,w,d)=>Math.max(surfaceHeight(x,z),surfaceHeight(x-w/2,z-d/2),surfaceHeight(x+w/2,z+d/2))+.055;
  for(const settlement of settlements) {
    // Designed village blocks around the gazetteer point, not surveyed buildings or roads.
    // Dress the existing overview blocks too, so the largest shapes become homes
    // in the close view while the original printed table remains unchanged.
    const overviewBlocks=[];
    for(let index=0;index<12;index++) {
      const x=settlement.x+Math.sin(index*2.4)*(.24+.035*index),z=settlement.z+Math.cos(index*2.4)*(.22+.024*index);
      overviewBlocks.push({x,z});if(!land(x,z))continue;
      const width=.14+(index%3)*.035,height=.14+(index%4)*.027,depth=.16,y=surfaceHeight(x,z)+.16,roofHeight=.075+(index%2)*.012;
      add(roofs,x,y+height/2+roofHeight/2+.002,z,width*1.13,roofHeight,depth*1.13);enhancedBuildings++;
      for(const side of [-1,1])for(const offset of [-.25,.25])add(windows,x+width*offset,y,z+side*depth*.505,.027,.035,.003);
    }
    for(const side of [-1,1])for(let index=0;index<9;index++) {
      const x=settlement.x+(index-4)*.16,z=settlement.z+side*(.64+(index%2)*.18);
      if(!land(x,z))continue;
      const width=.085+(index%3)*.012,depth=.1,height=.07+(index%3)*.015,y=support(x,z,width,depth);
      add(homes,x,y+height/2,z,width,height,depth);
      add(roofs,x,y+height+.032,z,width*1.14,.065,depth*1.14);
      add(windows,x-width*.23,y+height*.55,z+depth*.505,.018,.025,.003);
      add(windows,x+width*.23,y+height*.55,z+depth*.505,.018,.025,.003);
    }
    for(let index=0;index<18;index++) {
      const angle=index*Math.PI*2/18,x=settlement.x+Math.cos(angle)*(.85+(index%3)*.08),z=settlement.z+Math.sin(angle)*.92;
      if(!land(x,z))continue;
      const y=surfaceHeight(x,z)+.045,height=.09+(index%4)*.012;
      add(trunks,x,y+height*.4,z,.016,height*.8,.016);
      add(crowns,x,y+height,z,.08+(index%3)*.012,.11,.08+(index%3)*.012);
    }
    for(let index=0;index<8;index++) {
      const x=settlement.x+(index%4-1.5)*.22,z=settlement.z+(index<4?-.11:.11);
      if(!land(x,z)||overviewBlocks.some(block=>Math.hypot(x-block.x,z-block.z)<.17))continue;
      const y=surfaceHeight(x,z)+.045;
      add(trunks,x,y+.05,z,.019,.1,.019);add(crowns,x,y+.12,z,.105,.135,.105);
    }
    for(const offset of [-.52,.52])for(let index=0;index<32;index++) {
      const a={x:settlement.x-.82+index*.052,z:settlement.z+offset},b={x:a.x+.052,z:a.z};
      if(!land(a.x,a.z)||!land(b.x,b.z))continue;
      const width=.027;
      const vertices=[[a.x,a.z-width],[a.x,a.z+width],[b.x,b.z-width],[b.x,b.z+width]];
      for(const vertex of [0,1,2,1,3,2]){const [x,z]=vertices[vertex];lanes.push(x,surfaceHeight(x,z)+.052,z);}
    }
  }
  const body=new THREE.BoxGeometry(1,1,1),roof=new THREE.ConeGeometry(Math.SQRT1_2,1,4);roof.rotateY(Math.PI/4);
  const transform=new THREE.Object3D();
  const instances=(geometry,parts,color,options={})=>{
    const mesh=new THREE.InstancedMesh(geometry,detailMaterial(color,uniforms,options),parts.length);
    for(let index=0;index<parts.length;index++) {
      const p=parts[index];transform.position.set(p.x,p.y,p.z);transform.rotation.set(0,p.angle,0);transform.scale.set(p.w,p.h,p.d);transform.updateMatrix();mesh.setMatrixAt(index,transform.matrix);
    }
    mesh.computeBoundingSphere();mesh.renderOrder=2;group.add(mesh);return mesh;
  };
  instances(body,homes,'#d7cbb1');instances(roof,roofs,'#a27459');
  instances(new THREE.CylinderGeometry(.5,.65,1,5),trunks,'#80644b');
  instances(new THREE.IcosahedronGeometry(.6,0),crowns,'#78a67d');instances(body,windows,'#efcf8f',{emissive:true});
  const laneGeometry=new THREE.BufferGeometry();laneGeometry.setAttribute('position',new THREE.Float32BufferAttribute(lanes,3));laneGeometry.computeVertexNormals();
  const laneMesh=new THREE.Mesh(laneGeometry,detailMaterial('#a9997e',uniforms));laneMesh.renderOrder=2;group.add(laneMesh);
  return {group,buildings:roofs.length,enhancedBuildings,trees:trunks.length};
}

export function createInspectionContext(scene) {
  const geometry=new THREE.PlaneGeometry(bounds.width,bounds.depth,128,128);geometry.rotateX(-Math.PI/2);
  const positions=geometry.attributes.position,masks=new Float32Array(positions.count*4),levels=new Float32Array(positions.count),geo=geographyData();
  for(let index=0;index<positions.count;index++) {
    const x=positions.getX(index),z=positions.getZ(index),height=elevation(x,z);
    positions.setY(index,surfaceHeight(x,z)+.165);levels[index]=height;
    const occupied=settlements.reduce((value,settlement)=>Math.max(value,1-clamp((Math.hypot(x-settlement.x,z-settlement.z)-.32)/.4)),0);
    masks[index*4]=Math.max(height<=0?1:0,drainage(x,z)*.8);
    masks[index*4+1]=habitat(x,z);
    masks[index*4+2]=Math.max(sampleGrid(geo.masks.urban,x,z),occupied);
    masks[index*4+3]=height>0?clamp((slope(x,z)-.14)/.25):0;
  }
  geometry.setAttribute('contextMask',new THREE.BufferAttribute(masks,4));geometry.setAttribute('elevationLevel',new THREE.BufferAttribute(levels,1));geometry.computeBoundingSphere();
  const uniforms={center:{value:new THREE.Vector2()},detail:{value:0},overlaps:{value:new THREE.Vector4()},time:{value:0}};
  const material=new THREE.ShaderMaterial({uniforms,
    vertexShader:`attribute vec4 contextMask;attribute float elevationLevel;varying vec4 vContext;varying vec2 vGround;varying float vElevation;
void main(){vContext=contextMask;vGround=position.xz;vElevation=elevationLevel;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:`uniform vec2 center;uniform float detail;uniform vec4 overlaps;uniform float time;varying vec4 vContext;varying vec2 vGround;varying float vElevation;
void main(){
  float focus=1.0-smoothstep(1.15,3.1,length(vGround-center));
  if(detail*focus<.003)discard;
  vec4 area=smoothstep(vec4(.24),vec4(.58),vContext);
  vec4 aa=max(fwidth(vContext),vec4(.007));
  vec4 edge=1.0-smoothstep(aa*.6,aa*2.0,abs(vContext-vec4(.38)));
  vec4 strength=(area*.11+edge*.32)*(vec4(.56)+overlaps*.75);
  float stripeCoordinate=(vGround.x+vGround.y)/.17;
  float stripe=1.0-smoothstep(.055,.055+max(fwidth(stripeCoordinate),.015),abs(fract(stripeCoordinate+.5)-.5));
  strength+=(area*overlaps)*stripe*.18;
  float contourCoordinate=vElevation/75.0;
  float contour=1.0-smoothstep(.018,.018+max(fwidth(contourCoordinate),.018),abs(fract(contourCoordinate+.5)-.5));
  strength.w+=contour*area.w*(.2+overlaps.w*.2);
  float waterWave=.65+.35*sin(length(vGround-center)*12.0-time*1.1);
  strength.x+=area.x*waterWave*.035;
  float total=dot(strength,vec4(1.0));
  vec3 color=(strength.x*vec3(.28,.77,.97)+strength.y*vec3(.22,.86,.55)+strength.z*vec3(.96,.65,.22)+strength.w*vec3(.98,.4,.29))/max(.001,total);
  float alpha=min(.65,total)*detail*focus;
  if(alpha<.004)discard;
  gl_FragColor=vec4(color*.95,alpha);
  #include <colorspace_fragment>
}`,
    transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false,blending:THREE.NormalBlending});
  const surface=new THREE.Mesh(geometry,material);surface.name='Nearby environmental context';surface.renderOrder=9;surface.visible=false;scene.add(surface);
  const urban=createSettlementDetail(scene,uniforms);
  const field={width:129,height:129,masks,bounds};
  let summary={items:[],nearestSettlement:null,incomplete:false,illustrative:true},previousLocation;
  return {
    update(result) {
      const location=result.location;uniforms.center.value.set(location.x,location.z);
      const overlaps=new Set(result.suitability.reasons.map(reason=>reason.id));uniforms.overlaps.value.set(...['water','habitat','settlement','terrain'].map(id=>overlaps.has(id)?1:0));
      if(!previousLocation||previousLocation.x!==location.x||previousLocation.z!==location.z) {
        summary=summarizeInspection(result,sampleInspectionSignals(field,location),kmPerUnit);previousLocation={...location};
      }
    },
    setDetail(value) {uniforms.detail.value=clamp(value);surface.visible=urban.group.visible=uniforms.detail.value>.003;},
    tick(seconds) {uniforms.time.value=seconds;},
    get summary(){return summary;},
    get data(){return {sampleGrid:128,buildings:urban.buildings,enhancedBuildings:urban.enhancedBuildings,trees:urban.trees,detail:uniforms.detail.value,contexts:summary.items.map(item=>item.id),illustrativeSettlements:true};}
  };
}
