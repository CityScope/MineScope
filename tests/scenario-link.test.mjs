import test from 'node:test';
import assert from 'node:assert/strict';
import {TableLink,validateMessage} from '../dist/scenario/table-link.mjs';
import {extentId,normalizedToGeo} from '../dist/scenario/extent.mjs';

const message=(extra={})=>({version:1,type:'table.state',tableId:'la-higuera',extentId,origin:'physical-1',sequence:1,position:{u:.4,v:.6},protections:['water'],phase:'placed',...extra});
class FakeSocket {
  static sockets=[];
  constructor(url){this.url=url;this.readyState=0;this.sent=[];FakeSocket.sockets.push(this);}
  open(){this.readyState=1;this.onopen?.();}
  send(raw){this.sent.push(JSON.parse(raw));}
  close(){this.readyState=3;this.onclose?.();}
}
function setup(endpoint='ws://127.0.0.1:4180/table') {
  const jobs=new Map(),applied=[],statuses=[];let next=1,state={position:{u:.5,v:.5},protections:['water'],phase:'lifted'};
  const link=new TableLink({endpoint,origin:'browser-test',WebSocketClass:FakeSocket,getState:()=>structuredClone(state),applyState:p=>applied.push(p),onStatus:s=>statuses.push(s),schedule:fn=>{const id=next++;jobs.set(id,fn);return id;},unschedule:id=>jobs.delete(id),random:()=>.5});
  return {link,applied,statuses,jobs,get socket(){return link.socket;},set state(value){state=value;},advance(){const pending=[...jobs.values()];jobs.clear();for(const fn of pending)fn();}};
}
test('unconfigured endpoint makes no connection; invalid endpoints are rejected',()=>{
  const count=FakeSocket.sockets.length,s=setup('');assert.equal(FakeSocket.sockets.length,count);assert.deepEqual(s.statuses,['unconfigured']);
  assert.throws(()=>s.link.setEndpoint('https://example.com'));assert.throws(()=>s.link.setEndpoint('ws://user:password@example.com'));
});
test('continuous moves are coalesced and final drops flush immediately',()=>{
  const s=setup();s.socket.open();assert.deepEqual(s.socket.sent.map(m=>m.type),['table.hello','table.snapshot.request']);
  for(let i=0;i<100;i++){s.state={position:{u:i/100,v:.5},protections:['water'],phase:'lifted'};s.link.publish();}
  assert.equal(s.socket.sent.length,2);s.advance();assert.equal(s.socket.sent.length,3);assert.equal(s.socket.sent.at(-1).position.u,.99);
  s.state={position:{u:.7,v:.2},protections:['water','monitor'],phase:'placed'};s.link.publish({immediate:true});assert.equal(s.socket.sent.at(-1).phase,'placed');assert.equal(s.socket.sent.at(-1).protections.length,2);
});
test('incoming physical positions and protections apply without echo or stale updates',()=>{
  const s=setup();s.socket.open();s.link.publish();const before=s.socket.sent.length;
  assert.equal(s.link.receive(JSON.stringify(message())),true);assert.equal(s.applied.length,1);s.advance();assert.equal(s.socket.sent.length,before);
  assert.equal(s.link.receive(JSON.stringify(message())),false);assert.equal(s.link.receive(JSON.stringify(message({origin:'browser-test',sequence:9}))),false);
  assert.equal(s.link.receive(JSON.stringify(message({sequence:2,protections:[],phase:'lifted'}))),true);assert.deepEqual(s.applied.at(-1).protections,[]);
});
test('disconnect retains only the latest offline edit and requests a new snapshot',()=>{
  const s=setup();s.socket.open();s.socket.close();
  for(let i=0;i<100;i++){s.state={position:{u:i/100,v:.4},protections:['habitat'],phase:'placed'};s.link.publish({immediate:true});}
  s.advance();s.socket.open();assert.deepEqual(s.socket.sent.map(m=>m.type),['table.hello','table.snapshot.request','table.state']);assert.equal(s.socket.sent.at(-1).position.u,.99);
  s.link.stop();assert.equal(s.jobs.size,0);
});
test('partial physical updates preserve omitted state and accept geographic positions',()=>{
  const geo=normalizedToGeo({u:.3,v:.8}),p=validateMessage(message({type:'table.patch',position:geo,protections:undefined}));
  assert.ok(Math.abs(p.position.u-.3)<1e-7);assert.equal(p.protections,undefined);
  assert.deepEqual(validateMessage(message({type:'table.patch',position:undefined,protections:['dust']})),{protections:['dust'],phase:'placed'});
  assert.deepEqual(validateMessage(message({type:'table.patch',position:undefined,protections:undefined,phase:'lifted'})),{phase:'lifted'});
});
test('socket backpressure holds only the latest state until the buffer drains',()=>{
  const s=setup();s.socket.open();s.socket.bufferedAmount=100000;
  for(let i=0;i<100;i++){s.state={position:{u:i/100,v:.6},protections:[],phase:'placed'};s.link.publish();}
  s.advance();assert.equal(s.socket.sent.length,2);assert.equal(s.jobs.size,1);
  s.socket.bufferedAmount=0;s.advance();assert.equal(s.socket.sent.length,3);assert.equal(s.socket.sent.at(-1).position.u,.99);
});
test('bad versions, extents, coordinates, sequences and protection IDs cannot change the table',()=>{
  for(const bad of [{version:2},{extentId:'other'},{tableId:'other'},{sequence:0},{sequence:Infinity},{position:{u:1.1,v:.2}},{position:{u:'0.5',v:.5}},{position:{u:NaN,v:.5}},{protections:['water','water']},{protections:['unknown']},{phase:'unknown'},{position:{u:.5,v:.5,lat:0,lon:0}}])assert.equal(validateMessage(message(bad)),null);
  const s=setup();assert.equal(s.link.receive('{'),false);assert.equal(s.link.receive('x'.repeat(65537)),false);assert.equal(s.applied.length,0);
});
