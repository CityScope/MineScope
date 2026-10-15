import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from '../dist/scenario/vendor/three.module.js';
import {inspectionCropState,inspectionCropPerimeter,inspectionCropContains,addInspectionCropShader} from '../dist/scenario/inspection-crop-policy.mjs';

const threeURL=new URL('../dist/scenario/vendor/three.module.js',import.meta.url).href;
const policyURL=new URL('../dist/scenario/inspection-crop-policy.mjs',import.meta.url).href;
const source=readFileSync(new URL('../dist/scenario/inspection-crop.mjs',import.meta.url),'utf8').replace("from 'three';",`from '${threeURL}';`).replace("'./inspection-crop-policy.mjs?v=20261015-crop1'",`'${policyURL}'`);
const {createInspectionCrop}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

const bounds={width:22,depth:21.8};
test('resting crop closes to a circular local section while movement opens the full study extent',()=>{
  const moving=inspectionCropState(0,bounds),resting=inspectionCropState(1,bounds);
  assert.equal(moving.active,false);assert.equal(moving.section,0);assert.equal(resting.radius,3.5);assert.equal(resting.section,1);
  assert.equal(inspectionCropState(.9,bounds).radius,3.5);assert.equal(inspectionCropState(.9,bounds).section,0);
  assert.equal(inspectionCropContains({x:100,z:100},{x:0,z:0},moving,bounds),true);
  assert.equal(inspectionCropContains({x:3.49,z:0},{x:0,z:0},resting,bounds),true);
  assert.equal(inspectionCropContains({x:3.51,z:0},{x:0,z:0},resting,bounds),false);
});

test('terrain perimeter remains circular inland and clips cleanly at study edges and corners',()=>{
  for(const center of [{x:0,z:0},{x:10.8,z:0},{x:11,z:10.9},{x:-11,z:-10.9}]) {
    const perimeter=inspectionCropPerimeter(center,3.5,bounds);
    assert.ok(perimeter.length>=48&&perimeter.length<=196);
    for(const point of perimeter){assert.ok(Math.abs(point.x)<=11+1e-9);assert.ok(Math.abs(point.z)<=10.9+1e-9);assert.ok(Math.hypot(point.x-center.x,point.z-center.z)<=3.5+1e-9);}
    const signedArea=perimeter.reduce((sum,p,index)=>{const q=perimeter[(index+1)%perimeter.length];return sum+p.x*q.z-q.x*p.z;},0)/2;
    assert.ok(signedArea>0);if(center.x===0)assert.ok(Math.abs(signedArea-Math.PI*3.5**2)<.01);
    else assert.ok(perimeter.some(p=>Math.abs(Math.abs(p.x)-11)<1e-9));
  }
  assert.deepEqual(inspectionCropPerimeter({x:100,z:100},3.5,bounds),[]);
});

test('shader clipping follows final projected billboard vertices and preserves shader functions and comments',()=>{
  const vertex='float before(){return 1.;}\nvoid main(){ vec4 mvPosition=modelViewMatrix*vec4(position,1.0); /* } ignored */\n mvPosition.xy+=position.xy; gl_Position=projectionMatrix*mvPosition; // } ignored\n}\nfloat after(){return 2.;}';
  const fragment='void main(void) {gl_FragColor=vec4(1.0);}\nfloat after(){return 2.;}';
  const patched=addInspectionCropShader(vertex,fragment);
  assert.ok(patched.vertexShader.indexOf('inspectionCropInverseView * inspectionCropInverseProjection * gl_Position')>patched.vertexShader.indexOf('gl_Position=projectionMatrix*mvPosition;'));
  assert.ok(patched.vertexShader.indexOf('inspectionCropGround =')<patched.vertexShader.indexOf('float after()'));
  assert.ok(patched.fragmentShader.indexOf('discard')<patched.fragmentShader.indexOf('gl_FragColor='));
  assert.match(patched.fragmentShader,/inspectionCropHalfExtent/);assert.equal(addInspectionCropShader('no main',fragment),null);
});

test('section follows high local relief, keeps edge geometry finite, and samples only on placement changes',()=>{
  const scene=new THREE.Scene();let samples=0;
  const surfaceHeight=(x,z)=>{samples++;return 4+.2*Math.cos(x)+.1*Math.sin(z);};
  const crop=createInspectionCrop(scene,{surfaceHeight,bounds});crop.setLocation({x:10.8,z:10.8});crop.setDetail(1);
  const before=samples,updates=crop.data.geometryUpdates,camera=new THREE.OrthographicCamera(-5,5,5,-5,.1,100);
  camera.position.set(14,12,14);camera.lookAt(10.8,4,10.8);camera.updateMatrixWorld();
  for(let frame=0;frame<180;frame++){crop.setDetail(frame/179);crop.tick(camera);}
  crop.setLocation({x:10.8,z:10.8});assert.equal(samples,before);assert.equal(crop.data.geometryUpdates,updates);
  assert.ok(crop.data.minY>3);assert.ok(crop.data.maxY>4);assert.ok(crop.framing.center.y>3.5);
  const section=scene.children.find(object=>object.name==='Inspection terrain section');
  assert.equal(section.visible,true);
  for(const object of section.children)for(const coordinate of object.geometry.attributes.position.array)assert.ok(Number.isFinite(coordinate));
  const side=section.children[0].geometry.attributes.position;
  for(let index=0;index<side.count;index++){assert.ok(Math.abs(side.getX(index))<=11+1e-6);assert.ok(Math.abs(side.getZ(index))<=10.9+1e-6);}
  crop.dispose();assert.equal(scene.children.length,0);
});

test('scene crop preserves existing material hooks, discovers later materials, and restores the overview board',()=>{
  const scene=new THREE.Scene(),material=new THREE.MeshStandardMaterial();let compiled=0;
  const previousCompile=material.onBeforeCompile=function(shader){assert.equal(this,material);compiled++;shader.fragmentShader=shader.fragmentShader.replace('void main','float existingHook=1.;\nvoid main');};
  const previousKey=material.customProgramCacheKey=()=> 'existing-print-resin';
  const board=new THREE.Mesh(new THREE.BoxGeometry(22,.3,22),material);board.userData.inspectionBoard=true;scene.add(board);
  const crop=createInspectionCrop(scene,{surfaceHeight:()=>.06,bounds});
  assert.equal(material.customProgramCacheKey(),'existing-print-resin|inspection-radial-crop-v1');
  const shader={uniforms:{},vertexShader:'void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'void main(){gl_FragColor=vec4(1.);}'};
  material.onBeforeCompile(shader,{});assert.equal(compiled,1);assert.match(shader.fragmentShader,/existingHook/);assert.match(shader.fragmentShader,/inspectionCropGround/);
  const later=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineBasicMaterial());scene.add(later);crop.refresh();assert.equal(crop.data.materials,2);
  crop.setDetail(1);assert.equal(board.visible,false);assert.equal(shader.uniforms.inspectionCropRadius.value,3.5);
  crop.setDetail(0);assert.equal(board.visible,true);assert.equal(shader.uniforms.inspectionCropEnabled.value,0);
  crop.dispose();assert.equal(material.onBeforeCompile,previousCompile);assert.equal(material.customProgramCacheKey,previousKey);assert.equal(board.visible,true);
});
