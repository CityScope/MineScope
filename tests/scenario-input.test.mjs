import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from '../dist/scenario/vendor/three.module.js';
import {TablePointerInput,nearHandle} from '../dist/scenario/table-input.mjs';

const threeURL=new URL('../dist/scenario/vendor/three.module.js',import.meta.url).href;
const source=readFileSync(new URL('../dist/scenario/vendor/OrbitControls.js',import.meta.url),'utf8').replace("from 'three';",`from '${threeURL}';`);
const {OrbitControls}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

class Surface {
  style={};clientWidth=390;clientHeight=540;listeners=new Map();captures=new Set();
  addEventListener(type,fn){const list=this.listeners.get(type)||[];list.push(fn);this.listeners.set(type,list);}
  removeEventListener(type,fn){this.listeners.set(type,(this.listeners.get(type)||[]).filter(f=>f!==fn));}
  getRootNode(){return this;}
  getBoundingClientRect(){return {left:0,top:0,width:this.clientWidth,height:this.clientHeight};}
  setPointerCapture(id){this.captures.add(id);}
  releasePointerCapture(id){this.captures.delete(id);}
  hasPointerCapture(id){return this.captures.has(id);}
  emit(type,{id=1,x=150,y=250,touch=false,button=0,piece=false,ui=false}={}){
    const event={pointerId:id,clientX:x,clientY:y,pageX:x,pageY:y,pointerType:touch?'touch':'mouse',button,piece,ui,ctrlKey:false,metaKey:false,shiftKey:false,preventDefault(){},stopImmediatePropagation(){this.stopped=true;}};
    for(const fn of [...(this.listeners.get(type)||[])]){fn(event);if(event.stopped)break;}
    return event;
  }
}
function setup(){
  const surface=new Surface(),camera=new THREE.PerspectiveCamera(35,390/540,.1,160);
  camera.position.set(1,18.5,26);camera.lookAt(0,3,0);camera.updateMatrixWorld();
  let controls,drag=false,starts=0,commits=0;
  const input=new TablePointerInput({getControls:()=>controls,pick:e=>e.piece?'tailings':null,blocked:e=>e.ui,isDragging:()=>drag,
    beginDrag:(_,e)=>{drag=true;starts++;surface.setPointerCapture(e.pointerId);},
    finishDrag:()=>{drag=false;commits++;input.restore();}});
  surface.addEventListener('pointerdown',e=>input.down(e));
  controls=new OrbitControls(camera,surface);controls.target.set(0,3,0);controls.update();
  controls.enablePan=true;controls.panSpeed=.85;controls.rotateSpeed=.6;controls.zoomSpeed=.65;
  controls.touches={ONE:THREE.TOUCH.ROTATE,TWO:THREE.TOUCH.DOLLY_PAN};
  controls.mouseButtons={LEFT:THREE.MOUSE.ROTATE,MIDDLE:THREE.MOUSE.DOLLY,RIGHT:THREE.MOUSE.PAN};
  return {surface,camera,controls,input,get drag(){return drag;},get starts(){return starts;},get commits(){return commits;}};
}
function close(a,b,epsilon=1e-8){assert.ok(Math.abs(a-b)<epsilon,`${a} differs from ${b}`);}

test('right mouse drag pans while preserving zoom and orbit angle',()=>{
  const {surface,camera,controls}=setup(),target=controls.target.clone(),angle=controls.getAzimuthalAngle(),distance=camera.position.distanceTo(target);
  surface.emit('pointerdown',{button:2});surface.emit('pointermove',{button:2,x:210,y:290});surface.emit('pointerup',{button:2});
  assert.ok(controls.target.distanceTo(target)>.5);close(controls.getAzimuthalAngle(),angle);close(camera.position.distanceTo(controls.target),distance);
});
test('one finger rotates, two fingers pan and pinch to zoom',()=>{
  const {surface,camera,controls}=setup(),angle=controls.getAzimuthalAngle();
  surface.emit('pointerdown',{touch:true});surface.emit('pointermove',{touch:true,x:190});surface.emit('pointerup',{touch:true});
  assert.ok(Math.abs(controls.getAzimuthalAngle()-angle)>.1);
  const distance=camera.position.distanceTo(controls.target),target=controls.target.clone(),twoAngle=controls.getAzimuthalAngle();
  surface.emit('pointerdown',{id:2,touch:true,x:100});surface.emit('pointerdown',{id:3,touch:true,x:200});
  surface.emit('pointermove',{id:2,touch:true,x:130,y:280});surface.emit('pointermove',{id:3,touch:true,x:230,y:280});
  assert.ok(controls.target.distanceTo(target)>.3);close(camera.position.distanceTo(controls.target),distance);close(controls.getAzimuthalAngle(),twoAngle);
  surface.emit('pointermove',{id:3,touch:true,x:330,y:280});
  assert.ok(camera.position.distanceTo(controls.target)<distance*.85);
});
test('a second finger commits a lifted site and hands both fingers to the camera',()=>{
  const s=setup(),angle=s.controls.getAzimuthalAngle(),target=s.controls.target.clone();
  s.surface.emit('pointerdown',{id:1,touch:true,piece:true,x:100});
  assert.equal(s.drag,true);assert.equal(s.controls.enabled,true);assert.equal(s.controls.enableRotate,false);
  s.surface.emit('pointermove',{id:1,touch:true,x:120});close(s.controls.getAzimuthalAngle(),angle);
  s.surface.emit('pointerdown',{id:2,touch:true,piece:true,x:220});
  assert.equal(s.drag,false);assert.equal(s.commits,1);assert.equal(s.starts,1);assert.equal(s.controls.enableRotate,true);
  s.surface.emit('pointermove',{id:1,touch:true,x:150,y:280});s.surface.emit('pointermove',{id:2,touch:true,x:250,y:280});
  assert.ok(s.controls.target.distanceTo(target)>.3);close(s.controls.getAzimuthalAngle(),angle);
  const end=s.surface.emit('pointerup',{id:2,touch:true});s.input.end(end);
  const remaining=s.controls.getAzimuthalAngle();s.surface.emit('pointermove',{id:1,touch:true,x:190,y:280});
  assert.ok(Math.abs(s.controls.getAzimuthalAngle()-remaining)>.1);
  s.input.end(s.surface.emit('pointerup',{id:1,touch:true}));assert.equal(s.input.touches.size,0);
});
test('mouse site dragging excludes camera input and controls do not start camera gestures',()=>{
  const s=setup(),angle=s.controls.getAzimuthalAngle();
  s.surface.emit('pointerdown',{piece:true});assert.equal(s.drag,true);assert.equal(s.controls.enabled,false);
  s.surface.emit('pointermove',{x:220});close(s.controls.getAzimuthalAngle(),angle);
  s.input.restore();assert.equal(s.controls.enabled,true);assert.equal(s.controls.enableRotate,true);
  const other=setup();other.surface.emit('pointerdown',{ui:true});other.surface.emit('pointermove',{x:220});
  close(other.controls.getAzimuthalAngle(),angle);assert.equal(other.surface.captures.size,0);
});
test('touch pickup halo accepts near misses without stealing distant gestures',()=>{
  assert.equal(nearHandle({clientX:25,clientY:5},{x:0,y:0}),true);
  assert.equal(nearHandle({clientX:31,clientY:0},{x:0,y:0}),false);
  assert.equal(nearHandle({clientX:0,clientY:0},null),false);
});
