import test from 'node:test';
import assert from 'node:assert/strict';
import {configureGeography,evaluate,route,initialLocation,referenceLocation,interventions,height,siteSuitability,habitat,habitatBoundary,settlements,plant,siteFootprint} from '../dist/scenario/model.mjs';
import {bounds,kmPerUnit,verticalExaggeration} from '../dist/scenario/extent.mjs';
import {sampleGrid} from '../dist/scenario/geography-core.mjs';

// Analytic fixtures, authored for tests. No downloaded spatial data is stored here.
const grid=fn=>({width:129,height:129,data:Float32Array.from({length:129*129},(_,i)=>fn((i%129/128-.5)*bounds.width,(Math.floor(i/129)/128-.5)*bounds.depth))});
const elevation=grid((x,z)=>x<-8?-20:50+8*(x+8)+1200*Math.exp(-((x-3)**2+(z+4)**2)/1.5));
const masks={water:grid((x,z)=>Math.exp(-(((z+1)/.4)**2))),protected:grid((x,z)=>Math.hypot(x+3,z-2)<1?1:0),land:grid((x,z)=>Math.hypot(x,z-4)<1?1:0),urban:grid((x,z)=>Math.hypot(x,z-3)<.3?1:0)};
let heightReads=0;
configureGeography({elevation,heights:(x,z)=>{heightReads++;return sampleGrid(elevation,x,z);},masks,settlements:[{id:'fixture',name:'Test town',x:0,z:3,weight:1}],warnings:[]});

test('route uses geographic distances and continuously located endpoints',()=>{
  assert.ok(route(plant).km<1e-9);
  const a={x:2.1234,z:1.4567},b={x:2.1264,z:1.4557},r=route(a);
  assert.deepEqual(r.points.at(-1),a);assert.deepEqual(route(b).points.at(-1),b);assert.notEqual(r.km,route(b).km);
  assert.ok(Math.abs(r.km-r.length*kmPerUnit)<1e-9);
});
test('mapped drainage proximity increases the illustrative water score',()=>{
  assert.ok(evaluate({x:0,z:-1}).base.water>evaluate({x:0,z:1}).base.water+20);
});
test('185 ha footprint is scaled independently of the oversized handle',()=>{
  assert.ok(Math.abs(siteFootprint.width*siteFootprint.depth*kmPerUnit**2*100-185)<1e-9);
});
test('elevation is preserved with a declared vertical exaggeration',()=>{
  assert.ok(Math.abs(height(0,0)-(.06+sampleGrid(elevation,0,0)*verticalExaggeration/(kmPerUnit*1000)))<1e-9);
  assert.equal(height(-10,0),.06);
});
test('protection reduces risk in proportion to its funded share',()=>{
  const result=evaluate(initialLocation,['water']);
  assert.equal(result.current.water,Math.max(8,result.base.water-result.strength.water*24));assert.equal(result.footprintHa,185);
});
test('changing funding at a fixed site reuses geography checks; moving the site checks again',()=>{
  const p={x:1.23,z:2.34};evaluate(p);const reads=heightReads;
  const protectedResult=evaluate(p,['water','habitat']);
  assert.equal(heightReads,reads);assert.ok(protectedResult.funding.protection>0);
  evaluate({...p,x:p.x+.001},['water']);assert.ok(heightReads>reads);
});
test('monitoring changes oversight and cost without reducing physical impacts',()=>{
  const p={x:0,z:0},base=evaluate(p),monitored=evaluate(p,['monitor']);
  for(const id of ['water','habitat','community','land'])assert.equal(monitored.current[id],base.current[id]);
  assert.equal(monitored.oversight,'Independent oversight funded');assert.ok(monitored.current.cost>base.current.cost);
});
test('water, protected, occupied, terrain and boundary checks remain active with funding',()=>{
  const locations=[['water',{x:-9,z:0}],['habitat',{x:-3,z:2}],['settlement',{x:0,z:3}],['terrain',{x:3,z:-4}],['extent',{x:11,z:0}]];
  for(const [id,p] of locations){const s=siteSuitability(p);assert.ok(s.reasons.some(r=>r.id===id),id);assert.deepEqual(evaluate(p,interventions.map(i=>i.id)).suitability,s);}
  assert.equal(siteSuitability({x:7,z:7}).viable,true);
});
test('partial footprint overlap is detected even with a dry center',()=>{
  const p={x:-7.9,z:0};assert.ok(sampleGrid(elevation,p.x,p.z)>0);assert.ok(siteSuitability(p).reasons.some(r=>r.id==='water'));
});
test('scores and fund remain finite across the entire new extent',()=>{
  for(const p of [{x:-11,z:0},{x:0,z:0},{x:10,z:10},{x:4,z:-9}]) {
    const r=evaluate(p,interventions.map(i=>i.id));
    for(const scores of [r.base,r.current])for(const v of Object.values(scores))assert.ok(Number.isFinite(v)&&v>=0&&v<=100);
    assert.ok(Math.abs(r.funding.site+r.funding.protection+r.funding.remaining-r.funding.total)<1e-9);
  }
});
