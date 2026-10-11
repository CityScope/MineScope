(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports){module.exports=api;return;}
  let hostTable;
  try{if(root.parent!==root&&root.frameElement?.getAttribute('data-table-display')==='true')hostTable=root.parent.MineScopeSession?.table;}catch{}
  const base=new URL('./',document.currentScript.src);
  const displayOnly=!!hostTable;
  const stored=displayOnly?{}:api.loadSession(()=>root.localStorage,base.href);
  const parsed=api.readSession(root.location.href,{unityKey:root.MineScopeUnityConfig?.key??stored.unityKey,table:{...stored.table,...(root.MineScopeScenarioConfig||hostTable)}});
  if(!displayOnly)api.saveSession(()=>root.localStorage,base.href,parsed.session);
  root.MineScopeSession=Object.freeze({...parsed.session,displayOnly,urlFor:(view,options)=>api.viewUrl(base.href,view,parsed.session,options)});
  if(displayOnly)document.documentElement.dataset.tableDisplay='true';
  root.MineScopeScenarioConfig=parsed.session.table;
  root.MineScopeUnityConfig=Object.freeze({key:parsed.session.unityKey});
  if(parsed.cleanUrl!==root.location.href)root.history.replaceState(root.history.state,'',parsed.cleanUrl);
  root.addEventListener?.('hashchange',()=>{
    const fragment=new URLSearchParams(root.location.hash.slice(1));
    if(['tableKey','unityKey','tableSocket','tableTransport'].some(name=>fragment.has(name)))root.location.reload();
  });
})(typeof window==='object'?window:null,function(){
  const defaultEndpoint='wss://linode.mistermatti.com/minescope/ws';
  const paths=Object.freeze({community:'./',table:'scenario/',dashboard:'dashboard/'});
  const credential=value=>typeof value==='string'&&value.length<=512&&!/[\s\u0000-\u001f\u007f]/.test(value.trim())?value.trim():'';
  const storageKey=base=>'minescope-connection-v1:'+new URL(base).pathname;
  function loadSession(getStorage,base){
    try{
      const raw=getStorage()?.getItem(storageKey(base));
      if(!raw||raw.length>4096)return {};
      const stored=JSON.parse(raw);
      if(stored?.version!==1)return {};
      const table={apiKey:credential(stored.table?.apiKey)};
      if(typeof stored.table?.endpoint==='string'){
        try{
          const endpoint=new URL(stored.table.endpoint);
          if(['ws:','wss:'].includes(endpoint.protocol)&&!endpoint.username&&!endpoint.password)table.endpoint=endpoint.href;
        }catch{}
      }
      if(['minescope','table-v1'].includes(stored.table?.transport))table.transport=stored.table.transport;
      return {unityKey:credential(stored.unityKey),table};
    }catch{return {};}
  }
  function saveSession(getStorage,base,session){
    try{
      const storage=getStorage(),key=storageKey(base);
      if(!storage)return;
      const current=storage.getItem(key);
      if(!session.unityKey&&!session.table.apiKey){if(current!==null)storage.removeItem(key);return;}
      const value=JSON.stringify({version:1,unityKey:session.unityKey,table:{apiKey:session.table.apiKey,endpoint:session.table.endpoint,transport:session.table.transport}});
      if(value!==current)storage.setItem(key,value);
    }catch{}
  }
  function readSession(href,provided={}){
    const url=new URL(href),fragment=new URLSearchParams(url.hash.slice(1));
    const take=name=>fragment.get(name)??url.searchParams.get(name);
    const table={...provided.table,transport:take('tableTransport')??provided.table?.transport??'minescope',endpoint:take('tableSocket')??provided.table?.endpoint??defaultEndpoint};
    let raw=take('tableKey')??provided.table?.apiKey??'';
    try{const socket=new URL(table.endpoint);raw=raw||socket.searchParams.get('key')||'';socket.searchParams.delete('key');table.endpoint=socket.href;}catch{}
    table.apiKey=credential(raw);
    const unityKey=credential(take('unityKey')??provided.unityKey??'');
    for(const name of ['unityKey','tableKey','tableSocket','tableTransport']){
      url.searchParams.delete(name);
      if(fragment.has(name)){fragment.delete(name);url.hash=fragment.toString();}
    }
    return {session:Object.freeze({unityKey,table:Object.freeze(table)}),cleanUrl:url.href};
  }
  function viewUrl(base,view,session,{participant=false}={}){
    if(!Object.hasOwn(paths,view))throw new Error('Unknown MineScope view');
    const url=new URL(paths[view],base),fragment=new URLSearchParams();
    if(!participant&&session.unityKey)fragment.set('unityKey',session.unityKey);
    if(session.table.apiKey)fragment.set('tableKey',session.table.apiKey);
    if(session.table.endpoint!==defaultEndpoint)fragment.set('tableSocket',session.table.endpoint);
    if(session.table.transport!=='minescope')fragment.set('tableTransport',session.table.transport);
    url.hash=fragment.toString();return url.href;
  }
  return {readSession,viewUrl,loadSession,saveSession,defaultEndpoint};
});
