import test from 'node:test';
import assert from 'node:assert/strict';
import {sampleInspectionSignals,summarizeInspection} from '../dist/scenario/inspection-policy.mjs';

test('nearby context samples only its local radius and retains distinct mask channels',()=>{
  const field={width:5,height:5,bounds:{width:4,depth:4},masks:new Float32Array(5*5*4)};
  field.masks[(2*5+2)*4+1]=1;field.masks[(2*5+4)*4]=1;
  const local=sampleInspectionSignals(field,{x:0,z:0},1.2);
  assert.equal(local.habitat,1);assert.equal(local.water,0);assert.equal(local.settlement,0);
  const coast=sampleInspectionSignals(field,{x:2,z:0},1.2);
  assert.equal(coast.water,1);assert.equal(coast.habitat,0);
  assert.deepEqual(sampleInspectionSignals(field,{x:20,z:20},1),{water:0,habitat:0,settlement:0,terrain:0});
});

test('inspection labels distinguish a footprint exclusion from nearby context',()=>{
  const result={location:{x:0,z:0},suitability:{reasons:[{id:'habitat'}],complete:false},exposed:[{name:'Far settlement',x:3,z:4},{name:'Near settlement',x:0,z:1}]};
  const summary=summarizeInspection(result,{water:.8,habitat:0,terrain:.1},2);
  assert.deepEqual(summary.items.map(item=>[item.id,item.overlap,item.label]),[['water',false,'Water nearby'],['habitat',true,'Protected area overlap']]);
  assert.deepEqual(summary.nearestSettlement,{name:'Near settlement',km:2});
  assert.equal(summary.incomplete,true);assert.equal(summary.illustrative,true);
});

test('unavailable geographic context is not inferred from a high demonstration score',()=>{
  const result={location:{x:0,z:0},current:{water:95,habitat:99,community:98},suitability:{reasons:[],complete:false},exposed:[]};
  const summary=summarizeInspection(result,{water:0,habitat:0,settlement:0,terrain:0});
  assert.deepEqual(summary.items,[]);assert.equal(summary.nearestSettlement,null);assert.equal(summary.incomplete,true);
});
