import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/scenario/vendor/three.module.js';
import {createViewportResizer} from '../dist/scenario/viewport.mjs';
import {CameraSway,frontLimit} from '../dist/scenario/camera-sway.mjs';
import {fitIsometricCamera,DisplayCameraRig} from '../dist/scenario/display-camera.mjs';

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
function makeDisplayRig(options){
  const points=[];for(const x of [-10,10])for(const y of [0,5])for(const z of [-10,10])points.push([x,y,z]);
  const camera=new THREE.OrthographicCamera(-1,1,1,-1,.1,160),target=new THREE.Vector3();
  fitIsometricCamera(camera,target,points,1.3);
  const orientation=camera.quaternion.clone(),rig=new DisplayCameraRig(camera,target,options);
  return {camera,target,orientation,rig};
}
function runRig(rig,seconds){for(let remaining=seconds;remaining>1e-9;remaining-=1/60)rig.tick(Math.min(remaining,1/60));}

test('the TV waits 650 ms, then smoothly brings the resting site into close focus',()=>{
  const {camera,target,rig}=makeDisplayRig(),site=new THREE.Vector3(5,3,-4);
  assert.equal(rig.track(site),true);assert.equal(rig.phase,'moving');assert.equal(rig.detail,0);
  rig.tick(.649);assert.equal(rig.phase,'moving');assert.equal(camera.zoom,1.45);assert.equal(rig.moving,true);
  rig.tick(.001);assert.equal(rig.phase,'resting');assert.equal(camera.zoom,1.45);
  rig.tick(.15);assert.ok(camera.zoom>1.45&&camera.zoom<3.45);assert.ok(rig.detail>0&&rig.detail<1);
  runRig(rig,4);assert.equal(camera.zoom,3.45);assert.equal(rig.detail,1);assert.equal(rig.moving,true);assert.equal(rig.orbiting,true);
  assert.ok(target.distanceTo(site)<1e-9);const angle=rig.orbitAngle;
  assert.equal(rig.tick(1/60),true);assert.ok(rig.orbitAngle>angle);
});

test('repeated snapshots and small sensor jitter do not postpone the resting view',()=>{
  const {rig}=makeDisplayRig(),site=new THREE.Vector3(3,2,-2);
  rig.track(site);
  for(let frame=0;frame<120;frame++){
    const jitter=site.clone().add(new THREE.Vector3(Math.sin(frame)*.025,0,Math.cos(frame)*.025));
    assert.equal(rig.track(jitter),false);rig.tick(1/60);
  }
  assert.equal(rig.phase,'resting');assert.ok(rig.detail>.97);
  const angle=rig.orbitAngle;
  assert.equal(rig.track(site),false);assert.equal(rig.phase,'resting');assert.equal(rig.orbitAngle,angle);
  runRig(rig,1);assert.ok(rig.orbitAngle>angle);assert.equal(rig.orbiting,true);
});

test('small deliberate movements accumulate until they reset the resting view',()=>{
  const {rig}=makeDisplayRig(),site=new THREE.Vector3(0,1,0);
  rig.track(site);runRig(rig,4);assert.equal(rig.phase,'resting');
  for(const x of [.02,.04,.06])assert.equal(rig.track(new THREE.Vector3(x,1,0)),false);
  assert.equal(rig.track(new THREE.Vector3(.081,1,0)),true);assert.equal(rig.phase,'moving');
  runRig(rig,.6);assert.equal(rig.phase,'moving');
  assert.equal(rig.track(new THREE.Vector3(.162,1,0)),true);
  runRig(rig,.6);assert.equal(rig.phase,'moving');
  runRig(rig,.06);assert.equal(rig.phase,'resting');
});

test('new movement smoothly interrupts close focus and returns to the broad view',()=>{
  const {camera,rig}=makeDisplayRig();rig.track(new THREE.Vector3(0,1,0));runRig(rig,4);
  assert.equal(camera.zoom,3.45);assert.equal(rig.detail,1);
  const angle=rig.orbitAngle,orientation=camera.quaternion.clone();
  rig.track(new THREE.Vector3(.5,1,0));assert.equal(rig.orbiting,false);assert.equal(rig.orbitAngle,angle);
  rig.tick(.05);assert.ok(rig.orbitAngle>0&&rig.orbitAngle<angle);
  assert.ok(camera.quaternion.angleTo(orientation)<.1);
  assert.equal(rig.phase,'moving');assert.ok(camera.zoom>1.45&&camera.zoom<3.45);assert.ok(rig.detail>0&&rig.detail<1);
  for(let frame=1;frame<=60;frame++){rig.track(new THREE.Vector3(.5+frame*.1,1,0));rig.tick(1/60);}
  assert.equal(rig.phase,'moving');assert.ok(Math.abs(camera.zoom-1.45)<.002);assert.ok(rig.detail<.001);assert.ok(Math.abs(rig.orbitAngle)<.00002);
  runRig(rig,4);assert.equal(rig.phase,'resting');assert.equal(camera.zoom,3.45);
});

test('fresh movement on every frame opens the crop and returns to overview before resting again',()=>{
  const {camera,rig}=makeDisplayRig();rig.track(new THREE.Vector3(0,1,0));runRig(rig,4);
  assert.equal(rig.detail,1);const angle=rig.orbitAngle;
  for(let frame=1;frame<=90;frame++){
    const freshMovement=rig.track(new THREE.Vector3(frame*.1,1,0));assert.equal(freshMovement,true);
    rig.tick(1/60,{freshMovement});assert.equal(rig.phase,'moving');assert.equal(rig.restElapsed,0);assert.equal(rig.orbiting,false);
  }
  assert.ok(rig.detail<.001);assert.ok(Math.abs(camera.zoom-rig.overviewZoom)<.00001);assert.equal(rig.orbitAngle,0);
  assert.ok(angle>0);runRig(rig,.64);assert.equal(rig.phase,'moving');assert.ok(rig.detail<.001);
  runRig(rig,.02);assert.equal(rig.phase,'resting');assert.ok(rig.detail>0);
  runRig(rig,4);assert.equal(rig.detail,1);assert.equal(camera.zoom,rig.detailZoom);assert.equal(rig.orbiting,true);
});

test('a fresh movement after a long idle advances one bounded animation step and starts a full rest delay',()=>{
  const {camera,rig}=makeDisplayRig();rig.track(new THREE.Vector3(0,1,0));runRig(rig,4);
  const beforeZoom=camera.zoom,beforeAngle=rig.orbitAngle;
  assert.equal(rig.track(new THREE.Vector3(2,1,0)),true);rig.tick(40,{freshMovement:true});
  assert.equal(rig.phase,'moving');assert.equal(rig.restElapsed,0);assert.equal(rig.orbiting,false);
  assert.ok(camera.zoom>rig.overviewZoom&&camera.zoom<beforeZoom);
  assert.ok(Math.abs(camera.zoom-(rig.overviewZoom+(beforeZoom-rig.overviewZoom)*Math.exp(-.9)))<1e-10);
  assert.ok(Math.abs(rig.detail-Math.exp(-1.2))<1e-10);assert.ok(rig.orbitAngle>0&&rig.orbitAngle<beforeAngle);
  runRig(rig,.64);assert.equal(rig.phase,'moving');runRig(rig,.02);assert.equal(rig.phase,'resting');
});

test('edge relocations remain visible with a stable inclination while the camera orbits',()=>{
  const {camera,target,rig}=makeDisplayRig();
  for(const point of [new THREE.Vector3(10,1,-10),new THREE.Vector3(-10,1,-10),new THREE.Vector3(-10,4,10),new THREE.Vector3(10,6,10)]){
    rig.track(point);
    for(let frame=0;frame<240;frame++){
      rig.tick(1/60);const projected=point.clone().project(camera);
      assert.ok(Math.abs(projected.x)<=.761);assert.ok(Math.abs(projected.y)<=.701);
      const direction=camera.position.clone().sub(target).normalize();
      assert.ok(Math.abs(direction.y-rig.overviewDirection.y)<1e-10,'Orbit preserves the original inclination');
    }
    const projected=point.clone().project(camera);assert.ok(Math.abs(projected.x)<1e-9&&Math.abs(projected.y)<1e-9);
  }
});

test('display resizes preserve close focus, orbital continuity and movement visibility',()=>{
  const {camera,target,rig}=makeDisplayRig(),site=new THREE.Vector3(10,4,-10);
  rig.track(site);runRig(rig,4);
  const resize=createViewportResizer(camera,{setSize(){}},{resize(){}});
  for(const [width,height] of [[420,900],[1600,900],[900,1200]]){
    const orientation=camera.quaternion.clone(),angle=rig.orbitAngle;
    assert.equal(resize(width,height),true);rig.tick(0);
    assert.equal(camera.zoom,3.45);assert.ok(target.distanceTo(site)<1e-9);
    assert.ok(camera.quaternion.angleTo(orientation)<1e-7);
    rig.tick(1/60);assert.ok(rig.orbitAngle>angle&&rig.orbitAngle-angle<.001);
  }
  const moved=new THREE.Vector3(-10,1,10);rig.track(moved);resize(350,1000);rig.tick(1/60);
  const projected=moved.clone().project(camera);assert.ok(Math.abs(projected.x)<=.761&&Math.abs(projected.y)<=.701);
});

test('resting orbit keeps its center, scale and inclination through a full revolution',()=>{
  const {camera,target,rig}=makeDisplayRig(),site=new THREE.Vector3(9,5,-9);
  rig.track(site);runRig(rig,5);const startAngle=rig.orbitAngle;
  for(let frame=0;frame<9000;frame++){
    assert.equal(rig.tick(1/60),true);assert.equal(rig.orbiting,true);
    assert.ok(Number.isFinite(rig.orbitAngle));assert.ok(target.distanceTo(site)<1e-9);assert.equal(camera.zoom,3.45);
    assert.ok(Math.abs(camera.position.distanceTo(target)-rig.distance)<1e-10);
    assert.ok(Math.abs(rig.direction.y-rig.overviewDirection.y)<1e-10);
    const projected=site.clone().project(camera);assert.ok(Math.abs(projected.x)<1e-9&&Math.abs(projected.y)<1e-9);
  }
  const expected=startAngle+150*rig.orbitSpeed;
  assert.ok(Math.abs(Math.atan2(Math.sin(expected-rig.orbitAngle),Math.cos(expected-rig.orbitAngle)))<1e-8);
});

test('portrait edge relocations stay visible from every side of the orbit',()=>{
  const {camera,rig}=makeDisplayRig(),resize=createViewportResizer(camera,{setSize(){}},{resize(){}});
  resize(350,1000);rig.track(new THREE.Vector3(10,5,-10));runRig(rig,5);
  for(const angle of [0,Math.PI/2,Math.PI,-Math.PI/2]){
    rig.orbitAngle=angle;rig.tick(0);
    const point=new THREE.Vector3(rig.site.x>0?-10:10,4,rig.site.z>0?-10:10);
    rig.track(point);rig.tick(1/60);
    const projected=point.clone().project(camera);assert.ok(Math.abs(projected.x)<=.761&&Math.abs(projected.y)<=.701);
    runRig(rig,4);assert.ok(Math.abs(point.clone().project(camera).x)<1e-9);
  }
});

test('hidden intervals use real rest timing but cap camera and orbital animation',()=>{
  const {camera,rig}=makeDisplayRig();rig.track(new THREE.Vector3(4,2,-4));rig.tick(60);
  assert.equal(rig.phase,'resting');assert.ok(camera.zoom<2);assert.ok(rig.detail<.3);
  runRig(rig,5);const angle=rig.orbitAngle;
  rig.tick(3600);assert.ok(rig.orbitAngle>angle&&rig.orbitAngle-angle<=rig.orbitSpeed*.1+1e-10);
  for(const delta of [NaN,Infinity,-10]){const before=rig.orbitAngle;rig.tick(delta);assert.equal(rig.orbitAngle,before);}
});

test('the resting section fits high relief and its cutaway wall through narrow resizes and a full orbit',()=>{
  const {camera,target,rig}=makeDisplayRig(),site=new THREE.Vector3(10,7,-10),radius=3.5,minY=-3,maxY=8;
  rig.track(site);assert.equal(rig.setInspectionFrame({center:site,radius,minY,maxY}),true);
  const resize=createViewportResizer(camera,{setSize(){}},{resize(){}});
  for(const [width,height] of [[1600,900],[350,1000],[900,1200]]){
    resize(width,height);runRig(rig,5);
    assert.ok(camera.zoom<=rig.detailZoom);assert.ok(Math.abs(target.y-(minY+maxY)/2)<1e-9);
    for(const angle of [0,Math.PI/2,Math.PI,-Math.PI/2]){
      rig.orbitAngle=angle;rig.tick(0);
      for(let step=0;step<32;step++)for(const y of [minY,maxY]){
        const theta=step/32*Math.PI*2,point=new THREE.Vector3(site.x+Math.cos(theta)*radius,y,site.z+Math.sin(theta)*radius).project(camera);
        assert.ok(Math.abs(point.x)<=.881&&Math.abs(point.y)<=.841,'The entire terrain section fits inside its margins');
      }
      const projected=site.clone().project(camera);assert.ok(Math.abs(projected.x)<=.761&&Math.abs(projected.y)<=.701);
    }
  }
  assert.equal(rig.setInspectionFrame({center:site,radius:NaN,minY,maxY}),false);
  assert.equal(rig.setInspectionFrame(null),true);runRig(rig,5);assert.equal(camera.zoom,3.45);assert.ok(target.distanceTo(site)<1e-9);
});

test('reduced motion respects the rest delay and changes focus without animation',()=>{
  const {camera,target,orientation,rig}=makeDisplayRig({reducedMotion:true}),site=new THREE.Vector3(8,2,-6);
  rig.track(site);rig.tick(.64);assert.equal(camera.zoom,1.45);assert.equal(rig.phase,'moving');assert.equal(rig.detail,0);
  rig.tick(.011);assert.equal(camera.zoom,3.45);assert.equal(rig.phase,'resting');assert.equal(rig.detail,1);assert.equal(rig.moving,false);
  assert.ok(target.distanceTo(site)<1e-9);
  assert.equal(rig.orbiting,false);assert.equal(rig.orbitAngle,0);assert.equal(rig.tick(100),false);
  assert.ok(camera.quaternion.angleTo(orientation)<1e-7);
  rig.track(new THREE.Vector3(5,2,-6));rig.tick(.01);assert.equal(camera.zoom,1.45);assert.equal(rig.detail,0);
});
test('the portrait TV fits the whole table with a fixed parallel isometric projection',()=>{
  const points=[];for(const x of [-10,10])for(const y of [0,5])for(const z of [-10,10])points.push([x,y,z]);
  const camera=new THREE.OrthographicCamera(-1,1,1,-1,.1,160),target=new THREE.Vector3();
  fitIsometricCamera(camera,target,points,1.25);camera.updateMatrixWorld();
  const direction=camera.position.clone().sub(target).normalize();
  assert.ok(Math.abs(direction.x-direction.y)<1e-10);assert.ok(Math.abs(direction.x-direction.z)<1e-10);
  for(const point of points){const p=new THREE.Vector3(...point).project(camera);assert.ok(Math.abs(p.x)<1);assert.ok(Math.abs(p.y)<1);}
  const right=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,0);
  const a=target.clone().add(right),b=a.clone().addScaledVector(direction,10);
  assert.ok(Math.abs(a.project(camera).x-b.project(camera).x)<1e-10,'Depth does not change apparent size');
  const position=camera.position.clone(),orientation=camera.quaternion.clone();camera.zoom=1.7;
  const resize=createViewportResizer(camera,{setSize(){}},{resize(){}});resize(800,600);
  assert.equal(camera.zoom,1.7);assert.ok(camera.position.equals(position));assert.ok(camera.quaternion.equals(orientation));
  assert.ok(Math.abs((camera.right-camera.left)/(camera.top-camera.bottom)-800/600)<1e-10);
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
