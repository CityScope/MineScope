const {test}=require('node:test');
const assert=require('node:assert/strict');
const {create,color}=require('../dist/heat-field.js');
const records=Array.from({length:20},(_,i)=>({id:'n'+i,coords:[-29.4,-71.25],sentiment:i<10?'concerned':'hopeful'}));
const field=create(records);
test('balance includes opposing sentiments and puts equal concern and hope in the middle',()=>{
 const all=field.evaluate(records,'balance');assert.ok(all.length);
 assert.ok(all.every(c=>Math.abs(c.balance)<1e-12));assert.ok(all.every(c=>c.color.every((v,i)=>Math.abs(v-color(.5)[i])<=1)));
 assert.deepEqual(field.evaluate(records.slice(0,10),'balance')[0].color,color(0));assert.deepEqual(field.evaluate(records.slice(10),'balance')[0].color,color(1));
});
test('concentration uses a fixed shared scale across categories and filtered dates',()=>{
 const concern=field.evaluate(records,'concerned'),hope=field.evaluate(records,'hopeful');assert.deepEqual(concern.map(c=>c.color),hope.map(c=>c.color));
 const reduced=field.evaluate(records.slice(0,5),'concerned');const same=concern.find(c=>c.coords[0]===reduced[0].coords[0]&&c.coords[1]===reduced[0].coords[1]);
 assert.ok(reduced[0].matching<same.matching);assert.ok(reduced[0].color[1]>=same.color[1]);
 assert.equal(field.evaluate([],'balance').length,0);assert.equal(field.evaluate(records.slice(0,10),'hopeful').length,0);
});
test('the geographic grid is stable and does not invent coverage beyond nearby notes',()=>{
 assert.ok(field.cells.every(c=>c.samples.length>0&&c.corners.length===6));
 assert.deepEqual(field.evaluate(records,'balance').map(c=>c.coords),field.evaluate(records,'concerned').map(c=>c.coords));
 assert.ok(field.cells.every(c=>Math.abs(c.coords[0]+29.4)<.1&&Math.abs(c.coords[1]+71.25)<.12));
});
