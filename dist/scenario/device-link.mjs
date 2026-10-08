import {TableLink} from './table-link.mjs?v=20261007-ws-status1';

export const deviceProtectionIds=Object.freeze(['water','habitat','dust','monitor','fund']);
const xy=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1;
const flags=states=>Array.isArray(states)&&states.length>=5&&states.length<=128&&states.every(value=>typeof value==='boolean');
const samePosition=(a,b)=>a.x===b.x&&a.y===b.y;
const wireState=state=>({x:state.position.u,y:state.position.v,states:deviceProtectionIds.map(id=>state.protections.includes(id))});
export function validateDeviceMessage(message){
  if(!message||typeof message!=='object')return null;
  if(message.type==='snapshot'&&xy(message)&&flags(message.states))return {type:'snapshot',x:message.x,y:message.y,states:[...message.states]};
  if(message.type==='xy'&&xy(message))return {type:'xy',x:message.x,y:message.y};
  if(message.type==='state'&&Number.isInteger(message.index)&&message.index>=0&&message.index<128&&typeof message.on==='boolean'&&flags(message.states)&&message.index<message.states.length&&message.states[message.index]===message.on)return {type:'state',index:message.index,on:message.on,states:[...message.states]};
  if(message.type==='error'&&typeof message.error==='string')return {type:'error'};
  return null;
}

export class DeviceLink extends TableLink {
  constructor({endpoint='wss://linode.mistermatti.com/minescope/ws',apiKey='',...options}={}){
    super({...options,endpoint:''});
    this.baseline=wireState(this.getState());this.changes=new Map();this.setEndpoint(endpoint,{apiKey});
  }
  setEndpoint(endpoint,{apiKey=this.apiKey||''}={}){
    this.stop();this.apiKey=apiKey;this.confirmed=false;this.serverState=null;
    if(!endpoint){this.endpoint='';this.onStatus('unconfigured');return;}
    const url=new URL(endpoint);
    if(!['ws:','wss:'].includes(url.protocol)||url.username||url.password)throw new Error('Invalid WebSocket endpoint');
    this.apiKey=apiKey||url.searchParams.get('key')||'';url.searchParams.delete('key');this.baseEndpoint=url.href;
    if(!this.apiKey){this.endpoint='';this.onStatus('key-required');return;}
    if(typeof this.apiKey!=='string'||this.apiKey.length>512||/[\s\u0000-\u001f\u007f]/.test(this.apiKey))throw new Error('Invalid WebSocket credential');
    url.searchParams.set('key',this.apiKey);url.searchParams.set('echo','false');
    this.endpoint=url.href;this.stopped=false;this.attempt=0;this.connect();
  }
  connect(){
    if(this.stopped)return;
    this.confirmed=false;this.onStatus(this.attempt?'reconnecting':'connecting');
    let socket;try{socket=new this.WebSocketClass(this.endpoint);}catch{this.retry();return;}
    this.socket=socket;
    socket.onopen=()=>{if(this.socket!==socket)return;this.snapshotTimer=this.schedule(()=>{if(this.socket===socket&&!this.confirmed)socket.close();},10000);};
    socket.onmessage=event=>{if(this.socket===socket)this.receive(event.data);};
    socket.onerror=()=>{if(this.socket===socket)this.onStatus('reconnecting');};
    socket.onclose=()=>{if(this.socket===socket){this.unschedule(this.snapshotTimer);this.socket=null;this.retry();}};
  }
  publish({immediate=false}={}){
    const next=wireState(this.getState());
    if(!samePosition(next,this.baseline))this.pending={x:next.x,y:next.y};
    next.states.forEach((on,index)=>{if(on!==this.baseline.states[index])this.changes.set(index,on);});
    this.baseline=next;
    if(immediate){this.unschedule(this.sendTimer);this.sendTimer=null;this.flush();}
    else if(!this.sendTimer&&(this.pending||this.changes.size))this.sendTimer=this.schedule(()=>{this.sendTimer=null;this.flush();},this.interval);
  }
  flush(){
    if(!this.confirmed||this.socket?.readyState!==1)return;
    if(this.socket.bufferedAmount>65536){if(!this.sendTimer)this.sendTimer=this.schedule(()=>{this.sendTimer=null;this.flush();},this.interval);return;}
    if(this.pending){const position=this.pending;this.pending=null;this.socket.send(JSON.stringify({type:'xy',...position}));Object.assign(this.serverState,position);}
    for(const [index,on] of this.changes){this.socket.send(JSON.stringify({type:'state',index,on}));this.serverState.states[index]=on;}
    this.changes.clear();
  }
  receive(raw){
    if(typeof raw!=='string'||raw.length>65536)return false;
    let parsed;try{parsed=JSON.parse(raw);}catch{return false;}
    const message=validateDeviceMessage(parsed);if(!message)return false;
    if(message.type==='error'){this.onStatus('error');return false;}
    if(!this.confirmed&&message.type!=='snapshot')return false;
    if(message.type==='snapshot'){
      this.unschedule(this.snapshotTimer);this.snapshotTimer=null;this.serverState=message;this.confirmed=true;this.attempt=0;this.onStatus('connected');
    }else if(message.type==='xy'){
      if(samePosition(message,this.serverState))return true;
      this.pending=null;Object.assign(this.serverState,{x:message.x,y:message.y});
    }else{this.changes.delete(message.index);this.serverState.states=message.states;}
    const position=this.pending||this.serverState,states=[...this.serverState.states];
    for(const [index,on] of this.changes)states[index]=on;
    const selected=new Set(deviceProtectionIds.filter((_,index)=>states[index]));
    const current=this.getState().protections,protections=[...current.filter(id=>selected.delete(id)),...selected];
    this.applyState({...(message.type!=='state'?{position:{u:position.x,v:position.y},phase:'placed'}:{}),protections},message);
    this.baseline=wireState(this.getState());
    if(message.type==='snapshot')this.flush();
    return true;
  }
  stop(){super.stop();this.unschedule(this.snapshotTimer);this.snapshotTimer=null;this.confirmed=false;}
}
