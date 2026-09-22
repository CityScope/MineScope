/* Preserve original workshop collections before replacing browser storage. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.MineScopeNoteStorage=api;
})(typeof window==='object'?window:null,function(){
  'use strict';
  const key='minescope-notes-v1',backupKey=key+'-backup',recoveryKey=key+'-recovery';
  function create({storage,validate,limit=500}){
    let original=null,damaged=false,unavailable=false,loaded=false;
    function load(){
      let notes=[];damaged=false;unavailable=false;
      try{original=storage().getItem(key);}catch{unavailable=true;loaded=true;return {notes,damaged,unavailable};}
      if(original!==null){
        try{
          const data=JSON.parse(original);
          if(!Array.isArray(data))damaged=true;
          else{
            const ids=new Set();
            for(const item of data){
              let valid=false;try{valid=!!item&&typeof item==='object'&&!Array.isArray(item)&&validate(item)&&!ids.has(item.id);}catch{}
              if(valid&&notes.length<limit){notes.push(item);ids.add(item.id);}else damaged=true;
            }
          }
        }catch{damaged=true;}
      }
      loaded=true;return {notes,damaged,unavailable};
    }
    function recovery(){
      if(damaged&&original!==null)return original;
      try{return storage().getItem(recoveryKey);}catch{return null;}
    }
    function save(notes){
      if(!loaded||unavailable)throw Error('Saved notes could not be read. Reload before saving.');
      if(!Array.isArray(notes)||notes.length>limit||notes.some(n=>!n||!validate(n))||new Set(notes.map(n=>n.id)).size!==notes.length)throw Error('Invalid note collection.');
      const target=storage();
      if(target.getItem(key)!==original)throw Error('Saved notes changed in another tab. Export your notes, then reload before saving.');
      const next=JSON.stringify(notes);
      // A failed backup must never be followed by an overwrite of the original.
      if(original!==null){
        if(damaged){
          const existing=target.getItem(recoveryKey);
          if(existing!==null&&existing!==original)throw Error('An earlier recovery copy exists. Export your notes and recovery copy before continuing.');
          target.setItem(recoveryKey,original);
        }else target.setItem(backupKey,original);
      }
      target.setItem(key,next);original=next;damaged=false;
    }
    return {load,save,recovery};
  }
  return {create,key,backupKey,recoveryKey};
});
