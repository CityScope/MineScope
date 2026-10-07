import test from 'node:test';
import assert from 'node:assert/strict';
import {createTableRelay} from '../tools/table-relay.mjs';
import {TableLink} from '../dist/scenario/table-link.mjs';
import {extentId} from '../dist/scenario/extent.mjs';

const waitFor=async condition=>{const deadline=Date.now()+3000;while(!condition()){if(Date.now()>deadline)throw new Error('Synchronization timed out');await new Promise(r=>setTimeout(r,10));}};
test('real WebSocket relay exchanges physical moves, browser protections and reconnect snapshots',async t=>{
  const relay=createTableRelay({port:0}),port=await relay.start(),endpoint=`ws://127.0.0.1:${port}/table`;
  let state={position:{u:.6,v:.7},protections:['water'],phase:'placed'},remote=0,status;
  const link=new TableLink({endpoint,origin:'browser-integration',getState:()=>state,applyState:p=>{state={...state,...p};remote++;},onStatus:s=>status=s});
  const physical=new WebSocket(endpoint),received=[];physical.onmessage=e=>received.push(JSON.parse(e.data));
  t.after(async()=>{physical.close();link.stop();await relay.stop();});
  await waitFor(()=>status==='connected'&&physical.readyState===1&&relay.state);
  physical.send(JSON.stringify({version:1,type:'table.patch',tableId:'la-higuera',extentId,origin:'physical-integration',sequence:1,position:{u:.25,v:.35},phase:'lifted'}));
  await waitFor(()=>state.position.u===.25);assert.equal(state.position.v,.35);assert.equal(state.phase,'lifted');assert.deepEqual(state.protections,['water']);
  state={...state,protections:['habitat','monitor'],phase:'placed'};link.publish({immediate:true});
  await waitFor(()=>received.some(m=>m.origin==='browser-integration'&&m.protections.includes('monitor')));
  const before=remote;await new Promise(r=>setTimeout(r,50));assert.equal(remote,before,'origin echoes must not reapply');
  link.setEndpoint(endpoint);await waitFor(()=>remote>before&&status==='connected');assert.deepEqual(state.protections,['habitat','monitor']);assert.equal(state.position.u,.25);
});
