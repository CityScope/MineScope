import test from 'node:test';
import assert from 'node:assert/strict';
import {renderPixelRatio,siteMoved} from '../dist/scenario/render-policy.mjs';
import {terrainHit} from '../dist/scenario/terrain-hit.mjs';

test('render budget avoids Retina-size buffers while retaining phone resolution',()=>{
  assert.equal(renderPixelRatio(420,600,3),1.5);
  assert.equal(renderPixelRatio(1000,600,1),1);
  for(const [w,h] of [[1209,554.5],[1920,1080],[2560,1440]]) {
    const ratio=renderPixelRatio(w,h,2);
    assert.ok(ratio<=1.5);assert.ok(w*h*ratio*ratio<=Math.max(1400001,w*h*.75**2));
  }
});

test('protection allocations reuse geometry; each continuous site movement refreshes it',()=>{
  const previous={x:2.8,z:1.05};
  assert.equal(siteMoved(undefined,previous),true);
  assert.equal(siteMoved(previous,{...previous,protections:['water']}),false);
  assert.equal(siteMoved(previous,{x:2.80001,z:1.05}),true);
  assert.equal(siteMoved(previous,{x:2.8,z:1.05001}),true);
});

test('height-field picking locates flat water and sloping terrain without triangle scans',()=>{
  const flat=terrainHit({x:-9,y:20,z:2},{x:0,y:-1,z:0},()=>.055);
  assert.ok(Math.abs(flat.y-.055)<.0001);assert.equal(flat.x,-9);assert.equal(flat.z,2);
  let samples=0;
  const slope=(x,z)=>{samples++;return .3+.15*x+.1*z;};
  const origin={x:0,y:10,z:0},direction={x:.2,y:-1,z:.1};
  const hit=terrainHit(origin,direction,slope);
  assert.ok(Math.abs(hit.y-slope(hit.x,hit.z))<.0001);
  assert.ok(samples<150,`${samples} samples`);
});

test('height-field picking returns the front surface and rejects rays off the table',()=>{
  const height=x=>1+3*Math.exp(-(((x+2)/.6)**2));
  const hit=terrainHit({x:-8,y:5,z:0},{x:1,y:-.2,z:0},height);
  assert.ok(hit.x< -1.9);assert.ok(Math.abs(hit.y-height(hit.x))<.001);
  assert.equal(terrainHit({x:14,y:10,z:0},{x:0,y:-1,z:0},height),null);
  assert.equal(terrainHit({x:0,y:10,z:0},{x:0,y:1,z:0},height),null);
});
