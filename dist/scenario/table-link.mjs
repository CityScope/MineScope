import {extentId,corners,dimensions,normalizedToGeo,geoToNormalized} from './extent.mjs?v=20261007-ws-status1';
import {interventions} from './funding.mjs?v=20261007-ws-status1';

export const protocolVersion=1;
const ids=new Set(interventions.map(p=>p.id)),phases=new Set(['lifted','placed','cancelled']);
export function validateMessage(message,tableId='la-higuera') {
  if(!message||message.version!==1||message.tableId!==tableId||message.extentId!==extentId)return null;
  if(!['table.state','table.snapshot','table.patch'].includes(message.type))return null;
  if(typeof message.origin!=='string'||!message.origin||message.origin.length>128||!Number.isSafeInteger(message.sequence)||message.sequence<1)return null;
  const out={};
  if(message.position!==undefined) {
    const p=message.position;if(!p||typeof p!=='object')return null;
    let uv;
    if(Number.isFinite(p.u)&&Number.isFinite(p.v))uv={u:p.u,v:p.v};
    else if(Number.isFinite(p.lat)&&Number.isFinite(p.lon)&&p.lat>=-90&&p.lat<=90&&p.lon>=-180&&p.lon<=180)uv=geoToNormalized(p);
    else return null;
    if(uv.u< -1e-7||uv.u>1+1e-7||uv.v< -1e-7||uv.v>1+1e-7)return null;
    uv={u:Math.max(0,Math.min(1,uv.u)),v:Math.max(0,Math.min(1,uv.v))};
    if(p.lat!==undefined||p.lon!==undefined){if(!Number.isFinite(p.lat)||!Number.isFinite(p.lon))return null;const geo=normalizedToGeo(uv);if(Math.abs(geo.lat-p.lat)>1e-5||Math.abs(geo.lon-p.lon)>1e-5)return null;}
    out.position=uv;
  }
  if(message.protections!==undefined) {
    if(!Array.isArray(message.protections)||message.protections.length>5||new Set(message.protections).size!==message.protections.length||message.protections.some(id=>!ids.has(id)))return null;
    out.protections=[...message.protections];
  }
  if(message.phase!==undefined){if(!phases.has(message.phase))return null;out.phase=message.phase;}
  if(message.type!=='table.patch'&&(!out.position||!out.protections))return null;
  if(!out.position&&!out.protections&&!out.phase)return null;
  return out;
}

export class TableLink {
  constructor({endpoint='',tableId='la-higuera',protocols=[],origin=globalThis.crypto?.randomUUID?.()||`browser-${Date.now()}-${Math.random()}`,getState,applyState,onStatus=()=>{},WebSocketClass=globalThis.WebSocket,schedule=(fn,delay)=>setTimeout(fn,delay),unschedule=id=>clearTimeout(id),now=Date.now,random=Math.random,interval=50}={}) {
    Object.assign(this,{tableId,protocols,origin,getState,applyState,onStatus,WebSocketClass,schedule,unschedule,now,random,interval});
    this.sequence=0;this.seen=new Map();this.pending=null;this.attempt=0;this.stopped=true;
    this.setEndpoint(endpoint);
  }
  setEndpoint(endpoint,protocols=this.protocols) {
    this.stop();this.protocols=protocols;
    if(!endpoint){this.endpoint='';this.onStatus('unconfigured');return;}
    const url=new URL(endpoint);if(!['ws:','wss:'].includes(url.protocol)||url.username||url.password)throw new Error('Table endpoint must be ws:// or wss:// without embedded credentials');
    this.endpoint=url.href;this.stopped=false;this.attempt=0;this.connect();
  }
  envelope(type,fields={}) {return {version:protocolVersion,type,tableId:this.tableId,extentId,origin:this.origin,sequence:++this.sequence,timestamp:new Date(this.now()).toISOString(),...fields};}
  connect() {
    if(this.stopped)return;
    this.onStatus(this.attempt?'reconnecting':'connecting');
    let socket;try{socket=new this.WebSocketClass(this.endpoint,this.protocols);}catch{this.retry();return;}
    this.socket=socket;
    socket.onopen=()=>{
      if(this.socket!==socket)return;this.attempt=0;this.onStatus('connected');
      socket.send(JSON.stringify(this.envelope('table.hello',{role:'browser',initialState:this.getState(),frame:{crs:'EPSG:4326',projectedCrs:'EPSG:32719',corners,dimensions,axes:{u:'west to east',v:'north to south'},range:[0,1]}})));
      socket.send(JSON.stringify(this.envelope('table.snapshot.request')));
      if(this.pending)this.flush();
    };
    socket.onmessage=event=>{if(this.socket===socket)this.receive(event.data);};
    socket.onerror=()=>{if(this.socket===socket)this.onStatus('reconnecting');};
    socket.onclose=()=>{if(this.socket===socket){this.socket=null;this.retry();}};
  }
  retry() {
    if(this.stopped)return;
    this.onStatus('reconnecting');const delay=Math.min(15000,500*2**Math.min(this.attempt++,5))*(.8+this.random()*.4);
    this.reconnectTimer=this.schedule(()=>{this.reconnectTimer=null;this.connect();},delay);
  }
  publish({immediate=false}={}) {
    this.pending=this.getState();
    if(immediate){this.unschedule(this.sendTimer);this.sendTimer=null;this.flush();}
    else if(!this.sendTimer)this.sendTimer=this.schedule(()=>{this.sendTimer=null;this.flush();},this.interval);
  }
  flush() {
    if(!this.pending||this.socket?.readyState!==1)return;
    if(this.socket.bufferedAmount>65536){if(!this.sendTimer)this.sendTimer=this.schedule(()=>{this.sendTimer=null;this.flush();},this.interval);return;}
    const data=this.pending;this.pending=null;
    this.socket.send(JSON.stringify(this.envelope('table.state',data)));
  }
  receive(raw) {
    if(typeof raw!=='string'||raw.length>65536)return false;
    let message;try{message=JSON.parse(raw);}catch{return false;}
    const state=validateMessage(message,this.tableId);
    if(!state||message.origin===this.origin||message.sequence<=(this.seen.get(message.origin)||0))return false;
    this.seen.set(message.origin,message.sequence);if(this.seen.size>256)this.seen.delete(this.seen.keys().next().value);
    // Accepted server state is authoritative. It cancels queued local movement.
    this.pending=null;this.unschedule(this.sendTimer);this.sendTimer=null;
    this.applyState(state,message);return true;
  }
  stop() {
    this.stopped=true;this.unschedule(this.reconnectTimer);this.unschedule(this.sendTimer);this.reconnectTimer=this.sendTimer=null;
    if(this.socket){const socket=this.socket;this.socket=null;socket.onclose=null;socket.close();}
  }
}
