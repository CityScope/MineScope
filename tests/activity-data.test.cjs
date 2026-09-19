const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const vm=require('node:vm');
function load(){const scope={window:{},Intl,Date,Set,Math,layers:[{id:'simulated',on:true},{id:'social',on:true}]};vm.createContext(scope);for(const path of ['simulation-data.js','activity-data.js'])vm.runInContext(readFileSync(`dist/${path}`,'utf8'),scope);return scope;}
test('example streams have unique IDs, dated records, provenance, and all platforms at each place',()=>{
 const {window:{MineScopeActivity:a,MineScopeSimulation:s}}=load();
 assert.equal(a.records.length,960);assert.equal(a.social.length,320);assert.equal(s.records.length,640);assert.equal(new Set(a.records.map(n=>n.id)).size,960);
 for(const n of a.records){assert.ok(n.synthetic);assert.ok(n.coords.every(Number.isFinite));assert.ok(Date.parse(n.collectedAt)>=a.start&&Date.parse(n.collectedAt)<=a.end);}
 for(const area of s.areas){assert.equal(new Set(a.social.filter(n=>n.area===area.id).map(n=>n.platform)).size,3);}
 assert.ok(a.social.every(n=>n.provenance.includes('not an actual')));
 assert.ok(a.records.every((n,i)=>!i||n.collectedAt>=a.records[i-1].collectedAt));
});
test('replay boundaries and source and layer switches filter independently',()=>{
 const scope=load(),a=scope.window.MineScopeActivity;
 a.state.progress=0;assert.equal(a.records.filter(a.includes).length,0);
 a.state.progress=1;assert.equal(a.records.filter(a.includes).length,960);
 a.state.sources.delete('community');assert.equal(a.records.filter(a.includes).length,320);
 scope.layers.find(l=>l.id==='social').on=false;assert.equal(a.records.filter(a.includes).length,0);
 a.state.sources.add('community');assert.equal(a.records.filter(a.includes).length,640);
 a.state.progress=.5;const midpoint=a.records.filter(a.includes);assert.ok(midpoint.length>300&&midpoint.length<340);assert.ok(midpoint.every(n=>Date.parse(n.collectedAt)<=a.time()));
});
test('assigned locations and collection dates are deterministic across reloads',()=>{const a=load().window.MineScopeActivity.records,b=load().window.MineScopeActivity.records;assert.equal(JSON.stringify(a),JSON.stringify(b));});
