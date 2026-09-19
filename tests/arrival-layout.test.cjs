const {test}=require('node:test');
const assert=require('node:assert/strict');
const {segment,place}=require('../dist/arrival-layout.js');
test('incoming notes connect to their own sentiment arc and clear the count',()=>{
 const counts={concerned:40,hopeful:20,mixed:30,neutral:10};
 for(const sentiment of Object.keys(counts)){
  const arc=segment(counts,sentiment),layout=place({center:{x:200,y:200},radius:31,arc,width:800,height:600,circles:[{x:200,y:200,radius:31}]});
  assert.ok(layout);assert.ok(Math.hypot(layout.badge.x,layout.badge.y)>31+9);
  const angle=(Math.atan2(layout.anchor.x,-layout.anchor.y)+Math.PI*2)%(Math.PI*2);
  assert.ok(angle>=arc.start&&angle<=arc.end);assert.ok(Math.abs(Math.hypot(layout.anchor.x,layout.anchor.y)-30)<.001);
 }
});
test('new icons avoid place labels, neighboring counters and other new icons',()=>{
 const center={x:200,y:200},rects=[{left:155,right:245,top:237,bottom:262}],circles=[{x:200,y:200,radius:31},{x:270,y:240,radius:31}];
 for(let i=0;i<2;i++){
  const location=place({center,radius:31,arc:segment({concerned:1,hopeful:1,mixed:1,neutral:1},'hopeful'),width:800,height:600,rects,circles});assert.ok(location);
  assert.ok(rects.every(r=>location.box.right<=r.left||location.box.left>=r.right||location.box.bottom<=r.top||location.box.top>=r.bottom));rects.push(location.box);
 }
 assert.equal(place({center,radius:31,arc:segment({concerned:1,hopeful:1,mixed:1,neutral:1},'hopeful'),width:800,height:600,rects,circles}),null);
});
test('empty categories and crowded or offscreen layouts do not create detached icons',()=>{
 assert.equal(segment({concerned:5},'hopeful'),null);
 assert.equal(place({center:{x:20,y:20},radius:31,arc:segment({hopeful:1},'hopeful'),width:40,height:40}),null);
});
