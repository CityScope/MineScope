const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createController}=require('../dist/kiosk.js');

function setup(){
  let time=0,nextId=0,allowed=true;
  const jobs=new Map(),events=[];
  const areas=['choros','los-choros','totoralillo','higuera','trapiche','negrillo'];
  const controller=createController({areas,now:()=>time,
    setTimer:(fn,delay)=>{const id=++nextId;jobs.set(id,{fn,at:time+delay});return id;},
    clearTimer:id=>jobs.delete(id),canRun:()=>allowed,
    onStart:()=>events.push('start'),onVisit:id=>events.push(id),onStop:()=>events.push('stop')
  });
  function advance(ms){
    const end=time+ms;
    while(true){
      const next=[...jobs].sort((a,b)=>a[1].at-b[1].at)[0];
      if(!next||next[1].at>end)break;
      const [id,job]=next;jobs.delete(id);time=job.at;job.fn();
    }
    time=end;
  }
  return {controller,events,areas,jobs,advance,allow:value=>{allowed=value;}};
}
test('idle demo starts only after 30 seconds and visits every settlement in a repeating 10-second cycle',()=>{
  const t=setup();t.advance(29999);assert.deepEqual(t.events,[]);
  t.advance(1);assert.deepEqual(t.events,['start','choros']);
  t.advance(9999);assert.equal(t.events.length,2);
  t.advance(1);assert.equal(t.events.at(-1),'los-choros');
  t.advance(50000);assert.deepEqual(t.events,['start',...t.areas,'choros']);
  assert.equal(t.jobs.size,1);
});
test('continued interaction postpones the demo without accumulating timers',()=>{
  const t=setup();
  for(let i=0;i<500;i++){t.advance(100);t.controller.activity();assert.equal(t.jobs.size,1);}
  t.advance(29999);assert.deepEqual(t.events,[]);
  t.advance(1);assert.deepEqual(t.events,['start','choros']);
});
test('interaction immediately stops the tour and cancels the next settlement transition',()=>{
  const t=setup();t.advance(35000);t.controller.activity();
  assert.deepEqual(t.events,['start','choros','stop']);
  t.controller.activity();t.advance(29999);assert.equal(t.events.length,3);
  t.advance(1);assert.deepEqual(t.events,['start','choros','stop','start','choros']);
});
test('a dialog or note placement prevents the tour from starting',()=>{
  const t=setup();t.allow(false);t.advance(120000);assert.deepEqual(t.events,[]);
  t.allow(true);t.controller.activity();t.advance(29999);assert.deepEqual(t.events,[]);
  t.advance(1);assert.deepEqual(t.events,['start','choros']);
});
test('backgrounding suspends all tour timers and returning starts a fresh idle period',()=>{
  const t=setup();t.advance(40000);t.controller.suspend();
  assert.equal(t.events.at(-1),'stop');assert.equal(t.jobs.size,0);
  const count=t.events.length;t.controller.activity();t.advance(300000);assert.equal(t.events.length,count);
  t.controller.resume();t.advance(29999);assert.equal(t.events.length,count);
  t.advance(1);assert.deepEqual(t.events.slice(-2),['start','choros']);
});
test('an interrupted tour cannot run behind a dialog',()=>{
  const t=setup();t.advance(30000);t.allow(false);t.advance(10000);
  assert.deepEqual(t.events,['start','choros','stop']);t.advance(90000);assert.equal(t.events.length,3);
});
test('manual demo starts immediately and keeps running while the pointer moves to the fullscreen control',()=>{
  const t=setup();t.controller.start();assert.deepEqual(t.events,['start','choros']);
  t.controller.activity({movementOnly:true});t.advance(10000);
  assert.deepEqual(t.events,['start','choros','los-choros']);
  t.controller.activity();assert.equal(t.events.at(-1),'stop');assert.equal(t.controller.isActive(),false);
});
test('pointer movement exits the automatic idle demo',()=>{
  const t=setup();t.advance(30000);t.controller.activity({movementOnly:true});
  assert.deepEqual(t.events,['start','choros','stop']);
});
