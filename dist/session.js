(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports){module.exports=api;return;}
  let hostTable;
  try{if(root.parent!==root&&root.frameElement?.getAttribute('data-table-display')==='true')hostTable=root.parent.MineScopeSession?.table;}catch{}
  const parsed=api.readSession(root.location.href,{unityKey:root.MineScopeUnityConfig?.key,table:root.MineScopeScenarioConfig||hostTable});
  const base=new URL('./',document.currentScript.src);
  const displayOnly=!!hostTable;
  root.MineScopeSession=Object.freeze({...parsed.session,displayOnly,urlFor:(view,options)=>api.viewUrl(base.href,view,parsed.session,options)});
  if(displayOnly)document.documentElement.dataset.tableDisplay='true';
  root.MineScopeScenarioConfig=parsed.session.table;
  root.MineScopeUnityConfig=Object.freeze({key:parsed.session.unityKey});
  if(parsed.cleanUrl!==root.location.href)root.history.replaceState(root.history.state,'',parsed.cleanUrl);
})(typeof window==='object'?window:null,function(){
  const defaultEndpoint='wss://linode.mistermatti.com/minescope/ws';
  const paths=Object.freeze({community:'./',table:'scenario/',dashboard:'dashboard/'});
  const credential=value=>typeof value==='string'&&value.length<=512&&!/[\s\u0000-\u001f\u007f]/.test(value.trim())?value.trim():'';
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
  return {readSession,viewUrl,defaultEndpoint};
});
