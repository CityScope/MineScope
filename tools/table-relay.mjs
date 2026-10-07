// Local integration harness, not a production WebSocket server.
import {createServer} from 'node:http';
import {createHash,randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {validateMessage} from '../dist/scenario/table-link.mjs';
import {extentId} from '../dist/scenario/extent.mjs';

function frame(text,opcode=1) {
  const data=Buffer.from(text),header=Buffer.alloc(data.length<126?2:4);header[0]=128|opcode;
  if(data.length<126)header[1]=data.length;else{header[1]=126;header.writeUInt16BE(data.length,2);}
  return Buffer.concat([header,data]);
}
export function createTableRelay({port=4180,onUpdate=()=>{}}={}) {
  const clients=new Set(),seen=new Map(),origin=`relay-${randomUUID()}`;let state=null,sequence=0;
  const server=createServer((req,res)=>{res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({service:'MineScope local table relay',clients:clients.size,state}));});
  const send=(socket,message)=>{if(!socket.destroyed)socket.write(frame(JSON.stringify(message)));};
  const snapshot=()=>({version:1,type:'table.snapshot',tableId:'la-higuera',extentId,origin,sequence:++sequence,timestamp:new Date().toISOString(),...state});
  function receive(socket,raw) {
    let m;try{m=JSON.parse(raw);}catch{return;}
    if(m.version!==1||m.tableId!=='la-higuera'||m.extentId!==extentId)return;
    if(m.type==='table.hello') {
      if(!state){const candidate=validateMessage({...m,...m.initialState,type:'table.state'});if(candidate?.position&&candidate.protections)state=candidate;}
      return;
    }
    if(m.type==='table.snapshot.request'){if(state)send(socket,snapshot());return;}
    const change=validateMessage(m);if(!change||m.sequence<=(seen.get(m.origin)||0))return;
    seen.set(m.origin,m.sequence);if(seen.size>256)seen.delete(seen.keys().next().value);
    state={...state,...change};if(!state.position||!state.protections)return;
    const broadcast={version:1,type:'table.state',tableId:'la-higuera',extentId,origin:m.origin,sequence:m.sequence,timestamp:new Date().toISOString(),...state};
    for(const client of clients)send(client,broadcast);onUpdate(broadcast);
  }
  server.on('upgrade',(req,socket,head)=>{
    let safeOrigin=!req.headers.origin;try{const url=new URL(req.headers.origin);safeOrigin=['127.0.0.1','localhost','[::1]'].includes(url.hostname);}catch{}
    if(req.url!=='/table'||!safeOrigin||req.headers['sec-websocket-version']!=='13'||!req.headers['sec-websocket-key']){socket.end('HTTP/1.1 403 Forbidden\r\n\r\n');return;}
    const accept=createHash('sha1').update(req.headers['sec-websocket-key']+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);clients.add(socket);
    let buffer=head;
    socket.on('data',chunk=>{
      buffer=Buffer.concat([buffer,chunk]);if(buffer.length>131072){socket.destroy();return;}
      while(buffer.length>=2) {
        const opcode=buffer[0]&15,fin=buffer[0]&128,masked=buffer[1]&128;let size=buffer[1]&127,offset=2;
        if(size===126){if(buffer.length<4)return;size=buffer.readUInt16BE(2);offset=4;}
        if(size===127||!masked||!fin||size>65535){socket.destroy();return;}
        if(buffer.length<offset+4+size)return;
        const mask=buffer.subarray(offset,offset+4),payload=Buffer.from(buffer.subarray(offset+4,offset+4+size));
        for(let i=0;i<size;i++)payload[i]^=mask[i%4];buffer=buffer.subarray(offset+4+size);
        if(opcode===8){socket.end(frame(payload,8));return;}
        if(opcode===9){socket.write(frame(payload,10));continue;}
        if(opcode===1)receive(socket,payload.toString('utf8'));
      }
    });
    socket.on('error',()=>socket.destroy());socket.on('close',()=>clients.delete(socket));
  });
  return {server,get state(){return state;},async start(){await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));return server.address().port;},async stop(){for(const socket of clients)socket.destroy();await new Promise(resolve=>server.close(resolve));}};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  const relay=createTableRelay({port:Number(process.argv[2]||4180),onUpdate:m=>console.log(JSON.stringify(m))});
  const port=await relay.start();console.log(`Local relay: ws://127.0.0.1:${port}/table`);
  for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await relay.stop();process.exit(0);});
}
