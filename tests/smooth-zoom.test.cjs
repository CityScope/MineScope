const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../dist/smooth-zoom.js'),'utf8');

function harness({zoom=10,frameTime=1000/60}={}){
  let now=0,nextFrame=0;
  const pending=new Map(),listeners=new Map(),events=[],frames=[];
  const point=(x,y)=>({x,y,subtract:p=>point(x-p.x,y-p.y),divideBy:n=>point(x/n,y/n),equals:p=>x===p.x&&y===p.y});
  const surface=()=>({addEventListener(){},removeEventListener(){}});
  const map={
    _loaded:true,options:{smoothWheelPxPerZoomLevel:360},center:point(1,2),zoom,
    getContainer:()=>surface(),getSize:()=>point(1000,720),
    getZoom(){return this.zoom;},getMinZoom:()=>7,getMaxZoom:()=>17,
    mouseEventToContainerPoint:e=>point(e.clientX,e.clientY),
    project:(p,z)=>point(p.x*2**z,p.y*2**z),unproject:(p,z)=>point(p.x/2**z,p.y/2**z),
    containerPointToLatLng(p){return this.unproject(point(this.center.x*2**this.zoom+p.x-500,this.center.y*2**this.zoom+p.y-360),this.zoom);},
    on(names,fn,context){for(const name of names.split(' ')){if(!listeners.has(name))listeners.set(name,[]);listeners.get(name).push({fn,context});}},
    off(names,fn){for(const name of names.split(' '))listeners.set(name,(listeners.get(name)||[]).filter(l=>l.fn!==fn));},
    fire(name){events.push(name);for(const {fn,context} of listeners.get(name)||[])fn.call(context);return this;},
    _stop(){},_onZoomTransitionEnd(){this._animatingZoom=false;this._moveEnd(true);},
    _moveStart(){this.fire('zoomstart').fire('movestart');},
    _move(center,z,data){this.center=center;this.zoom=z;frames.push({now,zoom:z,center,data});this.fire('zoom').fire('move');},
    _moveEnd(){this.fire('zoomend').fire('moveend');}
  };
  const L={Map:{mergeOptions(){},addInitHook(){}},Handler:{extend:definition=>definition}};
  vm.runInNewContext(source,{L,window:surface(),performance:{now:()=>now},
    requestAnimationFrame:fn=>{pending.set(++nextFrame,fn);return nextFrame;},cancelAnimationFrame:id=>pending.delete(id)});
  const handler=Object.assign(Object.create(L.Map.SmoothWheelZoom),{_map:map,disable(){this.removeHooks();}});
  handler.addHooks();
  function advance(ms){const until=now+ms;while(now<until-.00001){now=Math.min(until,now+frameTime);const callbacks=[...pending.values()];pending.clear();callbacks.forEach(fn=>fn(now));}}
  function wheel(deltaY,extra={}){
    const event={deltaY,deltaX:0,deltaMode:0,clientX:300,clientY:240,target:{closest:()=>false},preventDefault(){this.prevented=true;},stopPropagation(){},...extra};
    handler._onWheel(event);return event;
  }
  return {map,handler,events,frames,pending,advance,wheel,point};
}
const near=(actual,expected,tolerance=1e-8)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} differs from ${expected}`);

test('pixel, line, page and trackpad-pinch units give the same zoom distance',()=>{
  for(const [deltaY,options] of [[-360,{}],[-22.5,{deltaMode:1}],[-.5,{deltaMode:2}],[-100,{ctrlKey:true}]]){
    const h=harness();assert.ok(h.wheel(deltaY,options).prevented);h.advance(1500);near(h.map.zoom,11);assert.equal(h.pending.size,0);
  }
});
test('tiny trackpad movements remain fractional and equal input totals are independent of event frequency',()=>{
  const tiny=harness();tiny.wheel(-1);tiny.advance(700);near(tiny.map.zoom,10+1/360);
  for(const count of [1,12,60,120]){
    const h=harness();for(let i=0;i<count;i++){h.wheel(-360/count);h.advance(1000/count);}h.advance(700);
    near(h.map.zoom,11);assert.equal(h.events.filter(e=>e==='movestart').length,1);
    assert.equal(h.events.filter(e=>e==='moveend').length,1);
  }
});
test('fast flings have bounded speed and no long queued zoom after release',()=>{
  for(const frameTime of [1000/120,1000/60,1000/30]){
    const h=harness({frameTime});h.wheel(-20000);h.advance(1000);
    near(h.map.zoom,11.25);let previous={now:0,zoom:10};
    for(const frame of h.frames){assert.ok(frame.zoom-previous.zoom<=(frame.now-previous.now)*.004+.001);previous=frame;}
    assert.equal(h.pending.size,0);
  }
});
test('reversing direction immediately cancels travel in the previous direction',()=>{
  const h=harness();h.wheel(-360);h.advance(64);const before=h.map.zoom,count=h.frames.length;
  h.wheel(72);h.advance(800);near(h.map.zoom,before-.2);
  assert.ok(h.frames.slice(count).every(frame=>frame.zoom<before));
});
test('the location under the pointer stays fixed on every animation frame',()=>{
  const h=harness(),cursor=h.point(300,240),anchor=h.map.containerPointToLatLng(cursor);
  h.wheel(-360);h.advance(1000);
  for(const frame of h.frames){
    near((anchor.x-frame.center.x)*2**frame.zoom+500,cursor.x);
    near((anchor.y-frame.center.y)*2**frame.zoom+360,cursor.y);
    assert.equal(frame.data.pinch,true);
  }
});
test('a sustained gesture redraws clusters once, then releases all scheduled frames',()=>{
  const h=harness();for(let i=0;i<120;i++){h.wheel(-2);h.advance(1000/120);}
  assert.equal(h.events.filter(e=>e==='moveend').length,0);h.advance(700);
  assert.equal(h.events.filter(e=>e==='zoomstart').length,1);assert.equal(h.events.filter(e=>e==='moveend').length,1);
  assert.equal(h.events.filter(e=>e==='zoomend').length,1);assert.equal(h.pending.size,0);
});
test('dragging, controls and other map movements interrupt without a jump or delayed resume',()=>{
  for(const interrupt of [h=>h.handler._interrupt(),h=>h.map.fire('movestart'),h=>h.map.fire('zoomstart'),h=>h.handler.disable()]){
    const h=harness();h.wheel(-360);h.advance(60);const before=h.map.zoom;interrupt(h);h.advance(1000);
    near(h.map.zoom,before);assert.equal(h.events.filter(e=>e==='moveend').length,1);assert.equal(h.pending.size,0);
  }
});
test('zoom limits do not accumulate overscroll and invalid or horizontal input is ignored',()=>{
  const h=harness({zoom:17});h.wheel(-5000);h.advance(500);near(h.map.zoom,17);assert.equal(h.events.length,0);
  h.wheel(360);h.advance(1000);near(h.map.zoom,16);
  const low=harness({zoom:7});low.wheel(5000);low.advance(500);near(low.map.zoom,7);assert.equal(low.events.length,0);
  for(const options of [{deltaX:500},{shiftKey:true},{defaultPrevented:true},{target:{closest:()=>true}}]){
    const ignored=harness();assert.equal(ignored.wheel(-10,options).prevented,undefined);ignored.advance(700);near(ignored.map.zoom,10);
  }
});
