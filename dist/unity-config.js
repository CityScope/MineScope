/* Read a session key before loading other assets; never persist it. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports){module.exports=api;return;}
  const config=api.readConfig(root.location.href);
  root.MineScopeUnityConfig=Object.freeze({key:config.key});
  if(config.cleanUrl!==root.location.href)root.history.replaceState(root.history.state,'',config.cleanUrl);
})(typeof window==='object'?window:null,function(){
  function readConfig(href){
    const url=new URL(href),fragment=new URLSearchParams(url.hash.slice(1));
    const raw=url.searchParams.get('unityKey')??fragment.get('unityKey')??'';
    const key=raw.trim();
    url.searchParams.delete('unityKey');
    if(fragment.has('unityKey')){fragment.delete('unityKey');url.hash=fragment.toString();}
    return {key:key.length<=512&&!/[\s\u0000-\u001f\u007f]/.test(key)?key:'',cleanUrl:url.href};
  }
  return {readConfig};
});
