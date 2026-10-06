import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluate,route,initialLocation,referenceLocation,riverZ,interventions,height,siteSuitability,coastline,habitat,habitatBoundary,settlements} from '../dist/scenario/model.mjs';

test('reference calibration and continuously located endpoints',()=>{
  assert.ok(Math.abs(route(referenceLocation).km-12.2)<1e-9);
  const a={x:2.1234,z:1.4567},b={x:2.1264,z:1.4557};
  assert.deepEqual(route(a).points.at(-1),a);
  assert.deepEqual(route(b).points.at(-1),b);
  assert.notEqual(route(a).km,route(b).km);
});
test('drainage connection increases water consequence',()=>{
  const x=0,z=riverZ(x);
  assert.ok(evaluate({x,z}).base.water>evaluate({x,z:z+2}).base.water+20);
});
test('funded protection follows the site, reduces water risk, and keeps the footprint',()=>{
  const p={...initialLocation},base=evaluate(p),protectedSite=evaluate(p,['water']);
  assert.ok(protectedSite.current.water<base.current.water);
  assert.ok(protectedSite.current.cost>base.current.cost);
  assert.equal(protectedSite.footprintHa,base.footprintHa);
  assert.equal(protectedSite.current.habitat,base.current.habitat);
  assert.equal(protectedSite.strength.water,1);
});
test('monitoring changes oversight and cost without reducing physical impacts',()=>{
  const p={x:-3,z:1},base=evaluate(p),monitored=evaluate(p,['monitor']);
  for(const id of ['water','habitat','community','land'])assert.equal(monitored.current[id],base.current[id]);
  assert.equal(monitored.oversight,'Independent oversight funded');
  assert.ok(monitored.current.cost>base.current.cost);
});
test('every intervention and location keeps scores within the defined scale',()=>{
  for(const p of [{x:-10,z:3},{x:10,z:-5},{x:0,z:0},{x:6,z:4}]) {
    const protections=interventions.map(i=>i.id);
    const result=evaluate(p,protections);
    for(const scores of [result.base,result.current])for(const v of Object.values(scores))assert.ok(Number.isFinite(v)&&v>=0&&v<=100);
    assert.ok(result.pipeline.km>=0);
    assert.equal(result.pipeline.points[0].x,8.5);
  }
});
test('higher site cost leaves less protection funding and applies only the funded benefit',()=>{
  const protections=interventions.map(i=>i.id),low=evaluate({x:8,z:-4},protections),high=evaluate({x:-10,z:5},protections);
  assert.ok(high.funding.site>low.funding.site);
  assert.ok(high.funding.protection<low.funding.protection);
  assert.ok(interventions.some(i=>high.strength[i.id]<low.strength[i.id]));
  assert.equal(high.current.water,Math.max(8,high.base.water-high.strength.water*24));
  const moved=evaluate({x:8.001,z:-4},protections);
  assert.ok(Math.abs(low.funding.site-moved.funding.site)<.1);
});
test('detailed relief stays finite at the edges and continuous during fine placement',()=>{
  assert.ok(Math.abs(height(-10,0)-.055)<1e-6);
  for(let z=-6.5;z<=6.5;z+=.5)for(let x=-11;x<=11;x+=.5) {
    const h=height(x,z);assert.ok(Number.isFinite(h)&&h>0&&h<4);
    assert.ok(Math.abs(height(x+.001,z)-h)<.02);
  }
});
test('opening site passes the demonstration placement checks',()=>{
  assert.deepEqual(siteSuitability(initialLocation).reasons,[]);
  assert.equal(evaluate(initialLocation).suitability.viable,true);
});
test('water exclusion catches a partly submerged footprint with a dry center',()=>{
  const location={x:coastline(0)+.5,z:0};
  assert.ok(location.x>coastline(location.z));
  assert.ok(siteSuitability(location).reasons.some(r=>r.id==='water'));
  assert.ok(siteSuitability({x:-10,z:0}).reasons.some(r=>r.id==='water'));
});
test('settlement exclusions include the buildings around each center',()=>{
  for(const settlement of settlements) {
    const site=siteSuitability({x:settlement.x+1.3,z:settlement.z});
    assert.equal(site.viable,false);
    assert.ok(site.reasons.some(r=>r.id==='settlement'&&r.detail.includes(settlement.name)));
  }
});
test('habitat exclusion uses the whole footprint rather than only its center',()=>{
  const location={x:-.1,z:1.3};
  assert.ok(habitat(location.x,location.z)<habitatBoundary);
  assert.ok(siteSuitability(location).reasons.some(r=>r.id==='habitat'));
});
test('extreme footprint relief is unsuitable and ordinary terrain can pass',()=>{
  const steep=siteSuitability({x:-4,z:-4.5});
  assert.ok(steep.relief>.8);
  assert.ok(steep.reasons.some(r=>r.id==='terrain'));
  assert.equal(siteSuitability({x:8.5,z:-4.65}).viable,true);
});
test('protection funding never removes physical site exclusions',()=>{
  const all=interventions.map(i=>i.id);
  for(const location of [{x:-10,z:0},{x:-3,z:1.3},{x:-4,z:-4.5},settlements[0]]) {
    const alone=evaluate(location),protectedSite=evaluate(location,all);
    assert.equal(protectedSite.suitability.viable,false);
    assert.deepEqual(protectedSite.suitability,alone.suitability);
  }
});
