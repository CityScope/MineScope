/* Each supported selection sends one scene event; startup checks API access only. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports){module.exports=api;return;}
  const client=api.createClient({fetch:root.fetch.bind(root),getKey:()=>root.MineScopeUnityConfig?.key||''});
  const indicator=document.getElementById('unity-status');
  let requestVersion=0;
  function showStatus(result){
    const states={
      'no-key':['idle','API key missing','Not connected. Open MineScope with ?unityKey=YOUR_KEY to connect to Unity.'],
      ready:['ready','API ready','Server reachable and send key accepted. Unity is checked when you select a location.'],
      sent:['ready','Unity connected','The server delivered the location message to Unity.'],
      offline:['idle','Unity offline','Server reachable and send key accepted. No Unity app was listening.'],
      unauthorized:['error','API key rejected','The server is reachable but rejected the send key.'],
      error:['error','API unavailable','The app could not verify the API connection.'],
      checking:['checking','API checking…','Checking the server and send key.'],
      sending:['checking','Sending…','Sending the selected location to Unity.']
    };
    const [state,label,detail]=states[result.status]||states.error;
    indicator.dataset.state=state;
    indicator.querySelector('span').textContent=label;
    indicator.title=detail+(state==='checking'?'':` Checked at ${new Date().toLocaleTimeString()}.`);
  }
  root.MineScopeUnity={async select(id){
    if(!Object.hasOwn(api.sites,id))return;
    const version=++requestVersion;
    showStatus({status:'sending'});
    const result=await client.sendLocation(id);
    if(version!==requestVersion)return;
    showStatus(result);
    if(result.status==='unauthorized')toast('The Unity server rejected the connection.');
    else if(result.status==='offline')toast('Message sent. No Unity app is listening.');
    else if(result.status==='error')toast('Could not send the location to Unity.');
  }};
  showStatus({status:'checking'});
  const version=++requestVersion;
  void client.checkConnection().then(result=>{if(version===requestVersion)showStatus(result);});
})(typeof window==='object'?window:null,function(){
  'use strict';
  const sites=Object.freeze({'los-choros':'LosChoros_Diorama',trapiche:'ElTrapiche_Diorama'});
  const validationError='expected {"name": "<event name>", "payload": <any JSON, optional>}';
  function createClient({fetch,getKey=()=>'',timeout=5000}){
    async function request(body){
      const key=getKey();
      if(!key)return {status:'no-key'};
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
      try{
        const response=await fetch('https://mining.mistermatti.com/events',{
          method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},
          body:JSON.stringify(body),credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',signal:controller.signal
        });
        if(response.status===401||response.status===403)return {status:'unauthorized'};
        return {httpStatus:response.status,ok:response.ok,data:await response.json()};
      }catch{return {status:'error'};}
      finally{clearTimeout(timer);}
    }
    async function checkConnection(){
      // The relay authenticates before validating an event. An empty envelope is
      // rejected without broadcasting to Unity. /health currently lacks CORS.
      const response=await request({});
      if(response.status)return response;
      if(response.httpStatus===400&&response.data?.error===validationError)return {status:'ready'};
      return {status:'error'};
    }
    async function sendLocation(id){
      if(!Object.hasOwn(sites,id))return {status:'unsupported'};
      const response=await request({name:'site.load',payload:{site:sites[id]}});
      if(response.status)return response;
      const delivered=response.data?.delivered;
      if(!response.ok||!Number.isInteger(delivered)||delivered<0)return {status:'error'};
      return {status:delivered?'sent':'offline',delivered};
    }
    return {sendLocation,checkConnection};
  }
  return {sites,createClient};
});
