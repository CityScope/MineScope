import {randomUUID} from 'node:crypto';
import {extentId} from '../dist/scenario/extent.mjs';
const u=Number(process.argv[2]),v=Number(process.argv[3]),protections=process.argv[4]?.split(',').filter(Boolean);
if(!Number.isFinite(u)||!Number.isFinite(v)||u<0||u>1||v<0||v>1)throw new Error('Usage: node tools/table-simulator.mjs U V [water,habitat,dust,monitor,fund]');
const socket=new WebSocket('ws://127.0.0.1:4180/table');
socket.onopen=()=>{socket.send(JSON.stringify({version:1,type:'table.patch',tableId:'la-higuera',extentId,origin:`physical-simulator-${randomUUID()}`,sequence:1,position:{u,v},...(protections?{protections}:{}),phase:'placed'}));};
socket.onmessage=event=>{console.log(event.data);socket.close();};
socket.onerror=()=>{console.error('Start the local table relay first.');process.exitCode=1;};
setTimeout(()=>{socket.close();},2000).unref();
