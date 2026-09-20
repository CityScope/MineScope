/* Idle settlement tour, separate from user-triggered Unity location messages. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports){module.exports=api;return;}
  const activity=root.MineScopeActivity,simulation=root.MineScopeSim;
  const badge=document.getElementById('demo-status');
  const demoButton=document.getElementById('demo-toggle');
  const fullScreenButton=document.getElementById('fullscreen-toggle');
  const heldPointers=new Set();
  let previousLayers=null;
  function setDemoLayers(active){
    if(active){
      previousLayers=new Map(layers.map(layer=>[layer.id,layer.on]));
      layers.filter(layer=>!layer.on).forEach(layer=>setLayer(layer.id,true));
    }else if(previousLayers){
      const saved=previousLayers;previousLayers=null;
      layers.filter(layer=>saved.has(layer.id)&&layer.on!==saved.get(layer.id)).forEach(layer=>setLayer(layer.id,saved.get(layer.id)));
    }
    if(activeTab==='layers'){
      // Update in place so the interaction ending a tour can still click its control.
      document.querySelectorAll('[data-layer]').forEach(button=>{
        const on=layers.find(layer=>layer.id===button.dataset.layer).on;
        button.setAttribute('aria-checked',String(on));button.closest('.layer-item').classList.toggle('active',on);
      });
      document.querySelectorAll('[data-layer-group]').forEach(button=>{
        const section=button.dataset.layerGroup,all=layers.filter(layer=>layer.section===section).every(layer=>layer.on);
        button.textContent=all?'Hide all':'Show all';button.setAttribute('aria-label',`${all?'Hide':'Show'} all ${section.toLowerCase()} layers`);
      });
      document.getElementById('all-layers').textContent=layers.every(layer=>layer.on)?'Hide all':'Show all';
    }
  }

  function showDemo(active,manual=false){
    badge.hidden=!active;
    badge.title=manual?'Running in demo mode. Stop demo or interact with the map to explore.':'Running in demo mode. Move the pointer to explore.';
    demoButton.textContent=active?'Stop demo':'Demo';
    demoButton.setAttribute('aria-pressed',String(active));
    demoButton.title=active?'Stop demo and return to all locations':'Start the settlement tour';
  }
  const controller=api.createController({
    areas:root.MineScopeSimulation.areas.map(area=>area.id),
    canRun:()=>!document.hidden&&!document.querySelector('dialog[open]')&&!placing&&!heldPointers.size,
    onStart:({manual})=>{showDemo(true,manual);setDemoLayers(true);activity.play(2);},
    onVisit:id=>simulation.visitArea(id),
    onStop:()=>{showDemo(false);simulation.showAll();setDemoLayers(false);activity.play(1);}
  });
  const interact=event=>{
    if(document.hidden||event?.target?.closest?.('[data-kiosk-control]'))return;
    controller.activity({movementOnly:event?.type==='pointermove'});
  };
  document.addEventListener('pointermove',interact,{passive:true,capture:true});
  document.addEventListener('pointerdown',event=>{heldPointers.add(event.pointerId);interact(event);},{passive:true,capture:true});
  for(const event of ['pointerup','pointercancel'])document.addEventListener(event,e=>{heldPointers.delete(e.pointerId);interact(e);},{passive:true,capture:true});
  for(const event of ['wheel','keydown','input'])document.addEventListener(event,interact,{passive:true,capture:true});
  document.addEventListener('visibilitychange',()=>{heldPointers.clear();document.hidden?controller.suspend():controller.resume();});
  document.getElementById('modal').addEventListener('close',interact);
  demoButton.onclick=()=>controller.isActive()?controller.activity():controller.start();
  function updateFullScreen(){
    const active=!!(document.fullscreenElement||document.webkitFullscreenElement);
    fullScreenButton.setAttribute('aria-pressed',String(active));
    fullScreenButton.setAttribute('aria-label',active?'Exit full screen':'Enter full screen');
    fullScreenButton.title=active?'Exit full screen':'Enter full screen';
    fullScreenButton.querySelector('.fullscreen-label').textContent=active?'Exit full screen':'Full screen';
  }
  fullScreenButton.onclick=async()=>{
    try{
      if(document.fullscreenElement||document.webkitFullscreenElement){
        const exit=document.exitFullscreen||document.webkitExitFullscreen;
        await exit.call(document);
      }else{
        const enter=document.documentElement.requestFullscreen||document.documentElement.webkitRequestFullscreen;
        if(!enter)throw Error('Fullscreen unavailable');
        await enter.call(document.documentElement);
      }
      updateFullScreen();
    }catch{toast('Full screen is not available in this browser.');}
  };
  document.addEventListener('fullscreenchange',updateFullScreen);
  document.addEventListener('webkitfullscreenchange',updateFullScreen);
  root.addEventListener('pagehide',()=>controller.suspend());
  root.addEventListener('pageshow',()=>controller.resume());
  if(document.hidden)controller.suspend();
})(typeof window==='object'?window:null,function(){
  'use strict';
  function createController({areas,onStart,onVisit,onStop,canRun=()=>true,idleMs=30000,stepMs=10000,now=()=>performance.now(),setTimer=setTimeout,clearTimer=clearTimeout}){
    let timer=null,active=false,manual=false,index=0,enabled=true,lastActivity=now();
    function schedule(delay){if(timer!==null)clearTimer(timer);timer=setTimer(tick,delay);}
    function stopTour(){if(!active)return;active=false;manual=false;onStop();}
    function tick(){
      timer=null;
      if(!enabled||!areas.length)return;
      if(!canRun()){stopTour();lastActivity=now();schedule(idleMs);return;}
      if(!active){
        const remaining=idleMs-(now()-lastActivity);
        if(remaining>0){schedule(remaining);return;}
        active=true;index=0;onStart({manual:false});
      }else index=(index+1)%areas.length;
      onVisit(areas[index]);schedule(stepMs);
    }
    function activity({movementOnly=false}={}){
      if(!enabled)return;
      if(active&&manual&&movementOnly)return;
      lastActivity=now();
      if(active){stopTour();schedule(idleMs);}
      else if(timer===null)schedule(idleMs);
    }
    function start(){
      if(!enabled||!areas.length||!canRun())return;
      manual=true;index=0;
      if(!active){active=true;onStart({manual:true});}
      onVisit(areas[index]);schedule(stepMs);
    }
    function suspend(){enabled=false;if(timer!==null)clearTimer(timer);timer=null;stopTour();}
    function resume(){enabled=true;lastActivity=now();schedule(idleMs);}
    schedule(idleMs);
    return {activity,start,suspend,resume,isActive:()=>active};
  }
  return {createController};
});
