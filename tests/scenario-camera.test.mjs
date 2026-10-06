import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/scenario/vendor/three.module.js';
import {createViewportResizer} from '../dist/scenario/viewport.mjs';
import {CameraSway,frontLimit} from '../dist/scenario/camera-sway.mjs';

test('automatic camera sweep reverses while staying in front for repeated cycles',()=>{
  for(const start of [-frontLimit,-.2,0,.2,frontLimit]) {
    const sway=new CameraSway();sway.start(start);assert.ok(Math.abs(sway.advance(0)-start)<1e-9);
    let previous=start,min=start,max=start;
    for(let i=0;i<7200;i++) {
      const angle=sway.advance(1/60);assert.ok(Math.abs(angle)<=frontLimit+1e-9);
      assert.ok(Math.abs(angle-previous)<.02);min=Math.min(min,angle);max=Math.max(max,angle);previous=angle;
    }
    assert.ok(min<-.4&&max>.4);
    sway.stop();assert.equal(sway.active,false);
  }
});

test('layout and fullscreen resizes preserve a zoomed camera and its orientation',()=>{
  const camera=new THREE.PerspectiveCamera(35,1,.1,120),target=new THREE.Vector3(0,3,0);
  camera.position.set(8,13,18);camera.lookAt(target);
  const position=camera.position.clone(),orientation=camera.quaternion.clone(),distance=camera.position.distanceTo(target);
  let draws=0,layouts=0;
  const resize=createViewportResizer(camera,{setSize(w,h,style){assert.equal(style,false);assert.ok(w>0&&h>0);draws++;}},{resize(){layouts++;}});
  for(const [w,h] of [[1200,600],[1100,700],[400,540],[1600,900],[1200,600]]) {
    assert.equal(resize(w,h),true);assert.equal(camera.aspect,w/h);
    assert.ok(camera.position.equals(position));assert.ok(camera.quaternion.equals(orientation));
    assert.equal(camera.position.distanceTo(target),distance);
    assert.ok(Number.isFinite(camera.projectionMatrix.elements[0]));
  }
  assert.equal(resize(1200,600),false);assert.equal(resize(0,600),false);
  assert.equal(resize(1200,0),false);assert.equal(draws,5);assert.equal(layouts,5);
});
