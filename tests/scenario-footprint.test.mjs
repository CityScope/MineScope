import test from 'node:test';
import assert from 'node:assert/strict';
import {configureGeography,siteSuitability,siteSupportHeight,siteFootprint,surfaceHeight} from '../dist/scenario/model.mjs';
import {kmPerUnit} from '../dist/scenario/extent.mjs';

const zero={width:2,height:2,data:new Float32Array(4)};
let heights=()=>100,reads=[];
configureGeography({heights:(x,z)=>{reads.push({x,z});return heights(x,z);},masks:{water:zero,protected:zero,land:zero,urban:zero},settlements:[],warnings:[]});
const location={x:0,z:0},halfWidth=siteFootprint.width/2,halfDepth=siteFootprint.depth/2;

test('a mountain under the oversized handle but outside the ground footprint does not exclude the site',()=>{
  heights=(x,z)=>x>halfWidth+.015?1300:100;reads=[];
  assert.ok(halfWidth+.015<1.35/2,'The mountain lies under the visible handle');
  const result=siteSuitability(location);
  assert.equal(result.viable,true);assert.equal(result.relief,0);assert.equal(result.maxSlope,0);
  for(const p of reads){assert.ok(Math.abs(p.x)<=halfWidth+1e-12);assert.ok(Math.abs(p.z)<=halfDepth+1e-12);}
});
test('the same mountain becomes an exclusion when the smaller footprint actually reaches it',()=>{
  heights=(x,z)=>x>halfWidth+.015?1300:100;
  const result=siteSuitability({x:.08,z:0});
  assert.ok(result.reasons.some(r=>r.id==='terrain'));assert.ok(result.relief>150);
});
test('terrain support samples the smaller footprint instead of the presentation box',()=>{
  heights=(x,z)=>Math.abs(x)>halfWidth+.015||Math.abs(z)>halfDepth+.015?1300:100;
  reads=[];const y=siteSupportHeight(location);
  assert.ok(Math.abs(y-(surfaceHeight(0,0)+.055))<1e-12);
  for(const p of reads){assert.ok(Math.abs(p.x)<=halfWidth+1e-12);assert.ok(Math.abs(p.z)<=halfDepth+1e-12);}
});
test('one-sided footprint slopes still detect a genuinely steep site without changing its area',()=>{
  heights=x=>1000+kmPerUnit*1000*.5*x;
  const result=siteSuitability(location);assert.ok(Math.abs(result.maxSlope-.5)<1e-10);
  assert.ok(result.reasons.some(r=>r.id==='terrain'));
  assert.ok(Math.abs(siteFootprint.width*siteFootprint.depth*kmPerUnit**2*100-185)<1e-9);
});
