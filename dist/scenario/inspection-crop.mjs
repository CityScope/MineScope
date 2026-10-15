import * as THREE from 'three';
import {inspectionCropState,inspectionCropPerimeter,inspectionCropContains,addInspectionCropShader} from './inspection-crop-policy.mjs?v=20261015-crop1';

// A geographic cylinder cut through the scene, with a sampled terrain section.
// Tag the original rectangular board, relief edge walls, and shadow floor with
// userData.inspectionBoard=true before refresh(). They return in the overview.
export function createInspectionCrop(scene,{surfaceHeight,bounds,radius=3.5,segments=192,baseHeight,sectionDepth=.48,waterHeight=.13}={}) {
  if(!surfaceHeight||!bounds)throw new Error('Inspection crop requires surfaceHeight and bounds');
  const group=new THREE.Group();group.name='Inspection terrain section';group.userData.inspectionCropIgnore=true;group.visible=false;scene.add(group);
  const uniforms={
    inspectionCropCenter:{value:new THREE.Vector2()},inspectionCropHalfExtent:{value:new THREE.Vector2(bounds.width/2,bounds.depth/2)},
    inspectionCropRadius:{value:100},inspectionCropEnabled:{value:0},
    inspectionCropInverseProjection:{value:new THREE.Matrix4()},inspectionCropInverseView:{value:new THREE.Matrix4()}
  };
  const sectionMaterial=new THREE.MeshStandardMaterial({color:'#b2b0a3',emissive:'#545b58',emissiveIntensity:.2,roughness:.94,metalness:0,transparent:true,opacity:0,side:THREE.DoubleSide});
  sectionMaterial.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 inspectionSectionPosition;').replace('#include <begin_vertex>','#include <begin_vertex>\ninspectionSectionPosition=position;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 inspectionSectionPosition;').replace('#include <color_fragment>',`#include <color_fragment>
float sectionFrequency=inspectionSectionPosition.y*84.0;
float sectionResolution=1.0-smoothstep(.6,3.5,fwidth(sectionFrequency));
float sectionStrata=sin(sectionFrequency)*sectionResolution;
float sectionGrain=fract(sin(dot(inspectionSectionPosition.xz,vec2(127.1,311.7)))*43758.5453);
diffuseColor.rgb*=.95+sectionStrata*.085+sin(inspectionSectionPosition.y*17.0)*.025+(sectionGrain-.5)*.018;`);
  };
  sectionMaterial.customProgramCacheKey=()=> 'inspection-cut-section-v1';
  const capMaterial=new THREE.MeshStandardMaterial({color:'#777a70',roughness:.96,transparent:true,opacity:0,side:THREE.DoubleSide});
  const rimMaterial=new THREE.LineBasicMaterial({color:'#bdc6b5',transparent:true,opacity:0});
  const side=new THREE.Mesh(new THREE.BufferGeometry(),sectionMaterial),cap=new THREE.Mesh(new THREE.BufferGeometry(),capMaterial),rim=new THREE.LineLoop(new THREE.BufferGeometry(),rimMaterial);
  side.name='Sampled relief section';side.receiveShadow=true;cap.name='Terrain section underside';rim.name='Terrain cut edge';rim.renderOrder=3;group.add(side,cap,rim);
  const wrapped=new Map(),boards=new Map();let center={x:0,z:0},state=inspectionCropState(0,bounds,radius),locationKey=null;
  const data={radius,detail:0,currentRadius:state.radius,sectionOpacity:0,perimeterVertices:0,heightSamples:0,geometryUpdates:0,materials:0,boardObjects:0,minY:-sectionDepth,maxY:waterHeight+.7};
  function wrap(material) {
    if(!material||wrapped.has(material))return;
    const compile=material.onBeforeCompile,key=material.customProgramCacheKey;
    const originalKey=key===THREE.Material.prototype.customProgramCacheKey?compile.toString():null;
    const wrapper=function(shader,renderer) {
      compile.call(this,shader,renderer);
      const patched=addInspectionCropShader(shader.vertexShader,shader.fragmentShader);if(!patched)return;
      Object.assign(shader.uniforms,uniforms);shader.vertexShader=patched.vertexShader;shader.fragmentShader=patched.fragmentShader;
    };
    material.onBeforeCompile=wrapper;
    material.customProgramCacheKey=function(){return `${originalKey??key.call(this)}|inspection-radial-crop-v1`;};
    wrapped.set(material,{compile,key,wrapper});material.needsUpdate=true;data.materials=wrapped.size;
  }
  function refresh() {
    function visit(object) {
      if(object.userData.inspectionCropIgnore)return;
      if(object.userData.inspectionBoard&&!boards.has(object))boards.set(object,object.visible);
      if(object.material)for(const material of Array.isArray(object.material)?object.material:[object.material])wrap(material);
      for(const child of object.children)visit(child);
    }
    visit(scene);data.boardObjects=boards.size;
    for(const [object,visible] of boards)object.visible=visible&&state.section<.98;
  }
  function setLocation(location) {
    const next={x:Number(location.x),z:Number(location.z)};if(!Number.isFinite(next.x)||!Number.isFinite(next.z))return;
    center=next;uniforms.inspectionCropCenter.value.set(center.x,center.z);
    const key=`${center.x},${center.z}`;if(locationKey===key)return;locationKey=key;
    const perimeter=inspectionCropPerimeter(center,radius,bounds,segments),vertices=[],indices=[],rimVertices=[],capVertices=[],capIndices=[];
    let minimum=Infinity,maximum=-Infinity,samples=0;
    const sample=(x,z)=>{const height=Math.max(waterHeight,surfaceHeight(x,z)+.04);minimum=Math.min(minimum,height);maximum=Math.max(maximum,height);samples++;return height;};
    const tops=perimeter.map(point=>sample(point.x,point.z));
    // Interior relief can exceed the perimeter; fitting includes ridges as well
    // as the cut edge, while a local underside avoids a tall mountain pedestal.
    for(let row=-5;row<=5;row++)for(let col=-5;col<=5;col++) {
      const x=center.x+col*radius/5,z=center.z+row*radius/5;
      if(col*col+row*row<=25&&Math.abs(x)<=bounds.width/2&&Math.abs(z)<=bounds.depth/2)sample(x,z);
    }
    if(!Number.isFinite(minimum)){minimum=waterHeight;maximum=waterHeight;}
    const bottom=baseHeight??minimum-sectionDepth;
    if(perimeter.length) {
      const centroid=perimeter.reduce((sum,p)=>({x:sum.x+p.x/perimeter.length,z:sum.z+p.z/perimeter.length}),{x:0,z:0});
      capVertices.push(centroid.x,bottom,centroid.z);
      for(let index=0;index<perimeter.length;index++) {
        const point=perimeter[index],top=tops[index],next=(index+1)%perimeter.length;
        vertices.push(point.x,top,point.z,point.x,bottom,point.z);rimVertices.push(point.x,top+.004,point.z);capVertices.push(point.x,bottom,point.z);
        indices.push(index*2,next*2,index*2+1,next*2,next*2+1,index*2+1);capIndices.push(0,index+1,next+1);
      }
    }
    function replace(object,positions,index) {
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));if(index)geometry.setIndex(index);if(object.isMesh)geometry.computeVertexNormals();geometry.computeBoundingSphere();object.geometry.dispose();object.geometry=geometry;
    }
    replace(side,vertices,indices);replace(cap,capVertices,capIndices);replace(rim,rimVertices);
    data.perimeterVertices=perimeter.length;data.heightSamples+=samples;data.geometryUpdates++;data.minY=bottom;data.maxY=maximum+.7;
  }
  function setDetail(detail) {
    state=inspectionCropState(detail,bounds,radius);uniforms.inspectionCropRadius.value=state.radius;uniforms.inspectionCropEnabled.value=state.active?1:0;
    group.visible=state.section>.001;sectionMaterial.opacity=capMaterial.opacity=state.section;rimMaterial.opacity=state.section*.5;
    sectionMaterial.depthWrite=capMaterial.depthWrite=state.section>.95;
    for(const [object,visible] of boards)object.visible=visible&&state.section<.98;
    Object.assign(data,{detail:state.detail,currentRadius:state.radius,sectionOpacity:state.section});
  }
  function updateCamera(camera) {
    uniforms.inspectionCropInverseProjection.value.copy(camera.projectionMatrixInverse);uniforms.inspectionCropInverseView.value.copy(camera.matrixWorld);
  }
  refresh();setLocation(center);setDetail(0);
  return {setLocation,setDetail,updateCamera,tick:updateCamera,refresh,contains:(point,margin=0)=>inspectionCropContains(point,center,state,bounds,margin),data,
    get framing(){return {center:{x:center.x,y:(data.minY+data.maxY)/2,z:center.z},radius,minY:data.minY,maxY:data.maxY};},
    dispose(){for(const [material,original] of wrapped){if(material.onBeforeCompile===original.wrapper){material.onBeforeCompile=original.compile;material.customProgramCacheKey=original.key;material.needsUpdate=true;}}for(const [object,visible] of boards)object.visible=visible;scene.remove(group);for(const object of [side,cap,rim]){object.geometry.dispose();object.material.dispose();}}
  };
}
