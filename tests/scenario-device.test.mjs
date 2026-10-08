import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {DeviceLink,deviceProtectionIds,validateDeviceMessage} from '../dist/scenario/device-link.mjs';
const {readConfig}=createRequire(import.meta.url)('../dist/scenario/table-config.js');
class FakeSocket{
  static sockets=[];
  constructor(url){this.url=url;this.sent=[];this.readyState=0;FakeSocket.sockets.push(this);}
  open(){this.readyState=1;this.onopen?.();}
  send(raw){this.sent.push(JSON.parse(raw));}
  close(){this.readyState=3;this.onclose?.();}
}
const snapshot=(extra={})=>({type:'snapshot',x:.5,y:.5,states:[false,false,false,false,false],...extra});
function setup(options={}){
  let state={position:{u:.6,v:.7},protections:['water','habitat'],phase:'placed'},next=1;
  const jobs=new Map(),statuses=[],applied=[];
  const link=new DeviceLink({apiKey:'test-credential',WebSocketClass:FakeSocket,getState:()=>structuredClone(state),applyState:p=>{state={...state,...p};applied.push(p);},onStatus:s=>statuses.push(s),schedule:fn=>{const id=next++;jobs.set(id,fn);return id;},unschedule:id=>jobs.delete(id),random:()=>.5,...options});
  return {link,jobs,statuses,applied,get state(){return state;},set state(value){state=value;},get socket(){return link.socket;},receive:message=>link.receive(JSON.stringify(message)),ready(message=snapshot()){link.socket.open();link.receive(JSON.stringify(message));},advance(){const pending=[...jobs.values()];jobs.clear();pending.forEach(fn=>fn());}};
}
test('runtime credentials are consumed before assets load and never persisted',()=>{
  const {config,cleanUrl}=readConfig('https://example.org/MineScope/scenario/?view=night#tableKey=test-credential');
  assert.equal(config.apiKey,'test-credential');assert.equal(config.endpoint,'wss://linode.mistermatti.com/minescope/ws');assert.equal(config.transport,'minescope');assert.equal(cleanUrl,'https://example.org/MineScope/scenario/?view=night');
  const query=readConfig('https://example.org/scenario/?tableKey=test-credential&foo=1#tableTransport=table-v1&tableSocket=ws%3A%2F%2F127.0.0.1%3A4180%2Ftable');
  assert.equal(query.cleanUrl,'https://example.org/scenario/?foo=1');assert.equal(query.config.transport,'table-v1');assert.equal(query.config.endpoint,'ws://127.0.0.1:4180/table');
  assert.equal(readConfig('https://example.org/#tableKey=bad%0Akey').config.apiKey,'');assert.equal(readConfig('https://example.org/#help').cleanUrl,'https://example.org/#help');
  const nested=readConfig('https://example.org/',{endpoint:'wss://example.org/ws?key=test-credential'});assert.equal(nested.config.endpoint,'wss://example.org/ws');assert.equal(nested.config.apiKey,'test-credential');
});
test('the service stays disconnected without a key and suppresses origin echoes',()=>{
  const count=FakeSocket.sockets.length,s=setup({apiKey:''});assert.equal(FakeSocket.sockets.length,count);assert.equal(s.statuses.at(-1),'key-required');
  s.link.setEndpoint('wss://example.org/ws',{apiKey:'test-credential'});assert.equal(new URL(s.socket.url).searchParams.get('echo'),'false');assert.equal(new URL(s.socket.url).searchParams.get('key'),'test-credential');
  assert.throws(()=>s.link.setEndpoint('https://example.org/ws'));assert.throws(()=>s.link.setEndpoint('wss://user:pass@example.org/ws'));
});
test('a valid server snapshot is authoritative without replacing it with app defaults',()=>{
  const s=setup();s.socket.open();assert.equal(s.statuses.at(-1),'connecting');assert.equal(s.socket.sent.length,0);
  s.receive(snapshot({x:.25,y:.75,states:[true,false,true,false,true]}));assert.equal(s.statuses.at(-1),'connected');assert.deepEqual(s.state.position,{u:.25,v:.75});assert.deepEqual(s.state.protections,['water','dust','fund']);assert.equal(s.socket.sent.length,0);
});
test('only changed fields are sent and all five protection indices round trip',()=>{
  const s=setup();s.ready();
  for(let index=0;index<5;index++){
    const id=deviceProtectionIds[index];s.state={...s.state,protections:[id]};s.link.publish({immediate:true});
    assert.ok(s.socket.sent.some(m=>m.type==='state'&&m.index===index&&m.on===true));assert.ok(s.socket.sent.every(m=>m.type==='state'));
    const states=deviceProtectionIds.map((_,i)=>i===index);s.receive({type:'state',index,on:true,states});assert.deepEqual(s.state.protections,[id]);
  }
  s.state={...s.state,position:{u:.2,v:.8}};s.link.publish({immediate:true});assert.deepEqual(s.socket.sent.at(-1),{type:'xy',x:.2,y:.8});
  const length=s.socket.sent.length;s.link.publish({immediate:true});assert.equal(s.socket.sent.length,length);
});
test('movement coalesces, final drops flush and backpressure retains the latest update',()=>{
  const s=setup();s.ready();
  for(let i=0;i<100;i++){s.state={...s.state,position:{u:i/100,v:.4}};s.link.publish();}
  assert.equal(s.socket.sent.length,0);s.advance();assert.deepEqual(s.socket.sent,[{type:'xy',x:.99,y:.4}]);
  s.socket.bufferedAmount=100000;s.state={...s.state,position:{u:.25,v:.75}};s.link.publish({immediate:true});assert.equal(s.socket.sent.length,1);
  s.socket.bufferedAmount=0;s.advance();assert.deepEqual(s.socket.sent.at(-1),{type:'xy',x:.25,y:.75});assert.equal(s.jobs.size,0);
});
test('remote coordinates never echo and a switch change preserves ongoing local movement',()=>{
  const s=setup();s.ready();s.state={...s.state,position:{u:.7,v:.8},phase:'lifted'};s.link.publish();
  s.receive({type:'state',index:2,on:true,states:[false,false,true,false,false]});assert.deepEqual(s.state.position,{u:.7,v:.8});assert.equal(s.state.phase,'lifted');
  s.receive({type:'xy',x:.2,y:.9});assert.deepEqual(s.state.position,{u:.2,v:.9});assert.equal(s.state.phase,'placed');s.advance();assert.equal(s.socket.sent.length,0);
});
test('reconnect merges offline edits into the new snapshot without overwriting unrelated switches',()=>{
  const s=setup();s.ready();s.socket.close();s.state={...s.state,protections:['water'],position:{u:.2,v:.3}};s.link.publish({immediate:true});
  s.advance();s.socket.open();s.receive(snapshot({states:[false,true,false,true,false]}));
  assert.deepEqual(s.state.protections,['water','habitat','monitor']);assert.deepEqual(s.state.position,{u:.2,v:.3});
  assert.deepEqual(s.socket.sent,[{type:'xy',x:.2,y:.3},{type:'state',index:0,on:true}]);s.link.stop();assert.equal(s.jobs.size,0);
});
test('unsupported extra states survive and malformed messages cannot alter the app',()=>{
  const s=setup();s.ready(snapshot({states:[false,false,false,false,false,true]}));s.state={...s.state,protections:['habitat']};s.link.publish({immediate:true});assert.equal(s.link.serverState.states[5],true);
  const before=structuredClone(s.state);
  for(const bad of [snapshot({x:1.1}),snapshot({y:'0.2'}),snapshot({states:[false]}),snapshot({states:[1,0,0,0,0]}),{type:'state',index:2,on:true,states:[false,false,false,false,false]},{type:'state',index:-1,on:false,states:[false,false,false,false,false]},{type:'table.state'}])assert.equal(s.receive(bad),false);
  assert.deepEqual(s.state,before);assert.equal(validateDeviceMessage({type:'xy',x:0,y:1}).y,1);s.receive({type:'error',error:'invalid update'});assert.equal(s.statuses.at(-1),'error');
});
