(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports){module.exports=api;return;}
  const {config,cleanUrl}=api.readConfig(root.location.href,root.MineScopeScenarioConfig);
  root.MineScopeScenarioConfig=Object.freeze(config);
  if(cleanUrl!==root.location.href)root.history.replaceState(root.history.state,'',cleanUrl);
})(typeof window==='object'?window:null,function(){
  const endpoint='wss://linode.mistermatti.com/minescope/ws';
  function readConfig(href,provided={}){
    const url=new URL(href),fragment=new URLSearchParams(url.hash.slice(1));
    const take=name=>url.searchParams.get(name)??fragment.get(name);
    const config={...provided,transport:take('tableTransport')??provided.transport??'minescope',endpoint:take('tableSocket')??provided.endpoint??endpoint};
    let raw=take('tableKey')??provided.apiKey??'';
    try{const socket=new URL(config.endpoint);raw=raw||socket.searchParams.get('key')||'';socket.searchParams.delete('key');config.endpoint=socket.href;}catch{}
    const key=String(raw).trim();config.apiKey=key.length<=512&&!/[\s\u0000-\u001f\u007f]/.test(key)?key:'';
    for(const name of ['tableKey','tableSocket','tableTransport']){url.searchParams.delete(name);if(fragment.has(name)){fragment.delete(name);url.hash=fragment.toString();}}
    return {config,cleanUrl:url.href};
  }
  return {readConfig};
});
