/* Local collection replay and sentiment density. All example records retain provenance. */
(() => {
  'use strict';
  const A=window.MineScopeActivity,S=window.MineScopeSim;
  const heatLabels={balance:'Sentiment balance',density:'All note concentration',concerned:'Concerned concentration',hopeful:'Hopeful concentration',mixed:'Mixed concentration',neutral:'Question concentration'};
  const heatTopics={all:'All topics',water:'Water & access',nature:'Nature & coast',livelihoods:'Jobs & livelihoods',health:'Health & daily life',other:'Trust & participation'};
  let heatField;
  const labels={concerned:'Concerned',hopeful:'Hopeful',mixed:'Mixed',neutral:'Questions'};
  const shell=document.querySelector('.map-shell');
  let moving=false,lastTick=performance.now(),lastPaint=0,previousTime=A.time(),arrivalMarkers=[],arrivalTimers=new Set();
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;

  // The canvas follows Leaflet's pane while panning and scales during wheel zoom.
  // Density is recomputed only when the map settles or the collection changes.
  const Heat=L.Layer.extend({
    onAdd(m){this._map=m;this.canvas=L.DomUtil.create('canvas','sentiment-heat leaflet-zoom-animated');m.getPane('heatPane').appendChild(this.canvas);this.redraw();},
    onRemove(){this.canvas.remove();},
    getEvents(){return {moveend:this.redraw,resize:this.redraw,zoom:this.transform,zoomanim:this.animate};},
    transform(){if(!this.origin)return;const scale=this._map.getZoomScale(this._map.getZoom(),this.zoom),p=this._map.latLngToLayerPoint(this.origin);L.DomUtil.setTransform(this.canvas,p,scale);},
    animate(e){if(!this.origin)return;const p=this._map._latLngToNewLayerPoint(this.origin,e.zoom,e.center);L.DomUtil.setTransform(this.canvas,p,this._map.getZoomScale(e.zoom,this.zoom));},
    redraw(){
      if(!this._map||moving)return;
      const m=this._map,size=m.getSize(),padding=180,w=Math.ceil((size.x+padding*2)/2),h=Math.ceil((size.y+padding*2)/2);
      this.zoom=m.getZoom();this.origin=m.containerPointToLatLng([-padding,-padding]);
      this.canvas.width=w;this.canvas.height=h;this.canvas.style.width=`${w*2}px`;this.canvas.style.height=`${h*2}px`;this.transform();
      const ctx=this.canvas.getContext('2d');
      heatField ||= window.MineScopeHeatField.create(A.records);
      const cells=heatField.evaluate(S.items(),A.state.heat);
      for(const cell of cells){
        const center=m.latLngToContainerPoint(cell.coords);if(center.x<-padding||center.y<-padding||center.x>size.x+padding||center.y>size.y+padding)continue;
        ctx.beginPath();cell.corners.forEach((coords,i)=>{const p=m.latLngToContainerPoint(coords),x=(p.x+padding)/2,y=(p.y+padding)/2;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.closePath();
        ctx.fillStyle=`rgba(${cell.color.join(',')},${cell.opacity})`;ctx.fill();ctx.strokeStyle='rgba(220,230,232,.11)';ctx.lineWidth=.3;ctx.stroke();
      }
      this.canvas.dataset.cells=cells.length;this.canvas.dataset.points=S.items().length;

    }
  });
  map.createPane('heatPane');map.getPane('heatPane').style.zIndex=350;map.getPane('heatPane').style.pointerEvents='none';
  const heat=new Heat();
  shell.insertAdjacentHTML('beforeend',`<div class="heat-key" hidden><span id="heat-title"></span><i class="heat-scale"></i><div class="heat-scale-labels"><span id="heat-low"></span><span id="heat-middle"></span><span id="heat-high"></span></div><small id="heat-detail"></small></div>
    <section class="collection-timeline" aria-label="Collection timeline">
      <div class="timeline-topline"><div class="timeline-caption"><span class="replay-dot"></span><strong>Collection timeline</strong><span class="timeline-loop">↻ Loop</span></div><div class="timeline-timestamp"><time id="collection-clock"></time><span>Chile time</span></div></div>
      <div class="timeline-main"><button id="timeline-play" class="timeline-play" aria-label="Pause timeline">Ⅱ</button><button id="timeline-restart" title="Restart timeline" aria-label="Restart timeline">↺</button><div class="timeline-track"><div class="timeline-histogram" aria-hidden="true"></div><input type="range" min="0" max="1000" step="1" id="collection-progress" aria-label="Collection date"><div class="timeline-dates"><span>01 Sep</span><span>06 Sep</span><span>12 Sep</span><span>18 Sep 2026</span></div></div><label class="timeline-speed"><span class="sr-only">Playback speed</span><select id="timeline-speed" aria-label="Playback speed"><option value=".5">0.5×</option><option value="1" selected>1×</option><option value="2">2×</option><option value="4">4×</option></select></label><button id="timeline-all" class="timeline-all">Show all</button></div>
      <div class="timeline-bottomline"><div class="timeline-sources">${Object.keys(A.labels).map(source=>`<span>${A.icon(source)}<span>${A.labels[source]}</span><b data-source-total="${source}">0</b></span>`).join('')}</div></div>
    </section>`);
  const bins=Array.from({length:72},()=>({community:0,social:0}));
  A.records.forEach(n=>{bins[Math.min(71,Math.floor((Date.parse(n.collectedAt)-A.start)/(A.end-A.start)*72))][n.platform==='community'?'community':'social']++;});
  const max=Math.max(...bins.map(b=>b.community+b.social));
  $('.timeline-histogram').innerHTML=bins.map((b,i)=>`<span style="height:${(b.community+b.social)/max*100}%" data-bin="${i}"><i style="height:${b.social/(b.community+b.social)*100}%"></i></span>`).join('');
  const oldRenderLegend=renderLegend;
  renderLegend=function(){if(A.state.heat==='none')oldRenderLegend();else $('#legend').innerHTML=geographyLegend()+`<span class="heat-legend"><i></i>${heatLabels[A.state.heat]}</span>`;};
  const oldRenderLayers=renderLayers;
  renderLayers=function(){oldRenderLayers();
    $('#sidebar-content').insertAdjacentHTML('afterbegin',`<section class="map-analysis" aria-label="Note display"><div class="analysis-heading"><h2>Notes on the map</h2></div><div class="analysis-modes"><button data-display="notes" class="${A.state.heat==='none'?'active':''}" aria-pressed="${A.state.heat==='none'}">● Notes</button><button data-display="heat" class="${A.state.heat!=='none'?'active':''}" aria-pressed="${A.state.heat!=='none'}">◉ Heat map</button></div><div class="heat-options"><button data-heat="balance" class="heat-balance ${A.state.heat==='balance'?'active':''}" aria-pressed="${A.state.heat==='balance'}"><i class="balance-swatch"></i>Sentiment balance</button>${Object.entries(labels).map(([id,label])=>`<button data-heat="${id}" style="--sentiment:${A.colors[id]}" class="${A.state.heat===id?'active':''}" aria-pressed="${A.state.heat===id}"><i></i>${label}</button>`).join('')}</div><label class="heat-topic" ${A.state.heat==='none'?'hidden':''}><span>Topic</span><select id="heat-topic" aria-label="Heat map topic">${Object.entries(heatTopics).map(([id,label])=>`<option value="${id}" ${S.read().filters.topic===id?'selected':''}>${label}</option>`).join('')}</select></label><div class="analysis-sources" aria-label="Note sources">${Object.entries(A.labels).map(([id,label])=>`<button data-source-filter="${id}" class="${A.state.sources.has(id)?'active':''}" aria-label="${label} notes" aria-pressed="${A.state.sources.has(id)}" title="${label}">${A.icon(id)}<span>${id==='community'?'App':id==='x'?'X':label}</span></button>`).join('')}</div></section>`);
    $('[data-display="notes"]').onclick=()=>A.setHeat('none');$('[data-display="heat"]').onclick=()=>A.setHeat(A.state.heat==='none'?'balance':A.state.heat);
    $('#heat-topic').onchange=e=>{S.setFilters({topic:e.target.value});refresh();};
    document.querySelectorAll('[data-heat]').forEach(b=>b.onclick=()=>A.setHeat(b.dataset.heat));
    document.querySelectorAll('[data-source-filter]').forEach(b=>b.onclick=()=>{clearArrivals();const source=b.dataset.sourceFilter;A.state.sources.has(source)?A.state.sources.delete(source):A.state.sources.add(source);refresh();renderLayers();});
  };
  function updateClock(){
    $('#collection-clock').textContent=A.date(A.time());$('#collection-progress').value=Math.round(A.state.progress*1000);$('#collection-progress').setAttribute('aria-valuetext',A.date(A.time()));
    const playing=A.state.playing;$('#timeline-play').textContent=playing?'Ⅱ':'▶';$('#timeline-play').setAttribute('aria-label',playing?'Pause timeline':'Play timeline');$('.collection-timeline').classList.toggle('paused',!playing);
    $('.timeline-histogram').style.setProperty('--progress',`${A.state.progress*100}%`);
    document.querySelectorAll('[data-bin]').forEach(b=>b.classList.toggle('past',+b.dataset.bin/72<=A.state.progress));
  }
  function updateCounts(){const items=S.items();Object.keys(A.labels).forEach(p=>{$(`[data-source-total="${p}"]`).textContent=items.filter(n=>n.platform===p).length;});}
  function clearArrivals(){arrivalTimers.forEach(clearTimeout);arrivalTimers.clear();arrivalMarkers.forEach(entry=>entry.marker.remove());arrivalMarkers=[];}
  A.syncArrivals=()=>{
    if(!arrivalMarkers.length)return;
    const clusters=S.clusters(),size=map.getSize(),mapRect=$('#map').getBoundingClientRect();
    const relativeRect=el=>{const b=el.getBoundingClientRect();return {left:b.left-mapRect.left-3,right:b.right-mapRect.left+3,top:b.top-mapRect.top-3,bottom:b.bottom-mapRect.top+3};};
    const circles=clusters.map(marker=>({...map.latLngToContainerPoint(marker.getLatLng()),radius:marker.arrivalCluster.size/2}));
    const rects=[...document.querySelectorAll('.cluster-place,.topbar,.map-top,#sidebar,#inspector:not([hidden]),.map-tray,.selected-comment-marker,.leaflet-control-zoom')].filter(el=>el.getClientRects().length).map(relativeRect);
    for(const entry of arrivalMarkers){
      const {note,marker}=entry,cluster=clusters.find(c=>c.arrivalCluster.ids.has(note.id)),element=marker.getElement();
      let location=null;
      if(cluster){
        const info=cluster.arrivalCluster,center=map.latLngToContainerPoint(cluster.getLatLng());
        const arc=window.MineScopeArrivalLayout.segment(info.counts,note.sentiment);
        location=window.MineScopeArrivalLayout.place({center,radius:info.size/2,arc,width:size.x,height:size.y,rects,circles});
        if(location){marker.setLatLng(cluster.getLatLng());rects.push(location.box);}
      }else if(!clusters.length){marker.setLatLng(note.coords);location={badge:{x:0,y:0}};}
      element.hidden=!location;if(!location)continue;
      const badge=element.querySelector('.arrival-badge'),leader=element.querySelector('.arrival-leader');
      badge.style.left=`${location.badge.x-9}px`;badge.style.top=`${location.badge.y-9}px`;
      leader.toggleAttribute('hidden',!location.anchor);
      if(location.anchor){const {anchor,knee,end}=location;const path=`M ${anchor.x} ${anchor.y} L ${knee.x} ${knee.y} L ${end.x} ${end.y}`;leader.querySelectorAll('path').forEach(p=>p.setAttribute('d',path));}
      element.dataset.sentiment=note.sentiment;element.dataset.cluster=cluster?.getElement()?.getAttribute('aria-label')||'';
    }
  };
  function animateArrivals(before){if(reduced||A.state.heat!=='none'||!A.state.playing)return;
    const arrivals=S.items().filter(n=>Date.parse(n.collectedAt)>before&&map.getBounds().contains(n.coords)).slice(-5);
    arrivals.forEach(note=>{
      const title=`New ${labels[note.sentiment].toLowerCase()} note · ${A.labels[note.platform]}`;
      const marker=L.marker(note.coords,{icon:L.divIcon({className:'arrival-marker',html:`<div class="arrival-content" style="--sentiment:${A.colors[note.sentiment]}"><svg class="arrival-leader" aria-hidden="true"><path class="arrival-line-outline"/><path class="arrival-line"/></svg><button class="arrival-badge" aria-label="${title}" title="${title}">${A.icon(note.platform)}</button></div>`,iconSize:[0,0],iconAnchor:[0,0]}),keyboard:false,zIndexOffset:600}).on('click',()=>showFeature(note.id)).addTo(map);
      const badge=marker.getElement().querySelector('.arrival-badge');
      L.DomEvent.on(badge,'click',event=>{L.DomEvent.stopPropagation(event);showFeature(note.id);});
      const entry={note,marker};arrivalMarkers.push(entry);
      const timer=setTimeout(()=>{marker.remove();arrivalMarkers=arrivalMarkers.filter(item=>item!==entry);arrivalTimers.delete(timer);},2200);arrivalTimers.add(timer);
    });
    A.syncArrivals();
  }
  function reconcileSelection(){const record=A.records.find(n=>n.id===selected);if(record&&!A.includes(record)){$('#inspector').hidden=true;selected=null;}}
  A.refreshHeat=()=>{
    reconcileSelection();const mode=A.state.heat;
    if(mode!=='none'){
      if(!map.hasLayer(heat))heat.addTo(map);else heat.redraw();
      const count=S.items().filter(n=>mode==='balance'||mode==='density'||n.sentiment===mode).length;
      $('#heat-title').textContent=heatLabels[mode];
      $('#heat-low').textContent=mode==='balance'?'Concerned':'Low';$('#heat-middle').textContent=mode==='balance'?'Balanced':'';$('#heat-high').textContent=mode==='balance'?'Hopeful':'High';
      $('.heat-key').classList.toggle('concentration',mode!=='balance');
      $('#heat-detail').textContent=`${count} notes · ${heatTopics[S.read().filters.topic]}`;
    }else if(map.hasLayer(heat))heat.remove();
    $('.heat-key').hidden=mode==='none';
  };

  function refresh(){reconcileSelection();S.refresh();A.refreshHeat();updateClock();updateCounts();}
  A.setHeat=value=>{if(!['none',...Object.keys(heatLabels)].includes(value))return;A.state.heat=value;clearArrivals();if(value!=='none')S.setFilters({sentiment:'all'});refresh();if(activeTab==='layers')renderLayers();};
  A.pause=()=>{A.state.playing=false;updateClock();};
  A.play=(speed=A.state.speed)=>{
    if(![.5,1,2,4].includes(speed))return;
    if(A.state.progress>=1){A.state.progress=0;previousTime=A.start;clearArrivals();reconcileSelection();}
    A.state.speed=speed;A.state.playing=true;$('#timeline-speed').value=String(speed);lastTick=performance.now();updateClock();
  };
  A.seek=progress=>{A.state.progress=Math.max(0,Math.min(1,progress));A.pause();clearArrivals();previousTime=A.time();if(A.records.some(n=>n.id===selected)&&Date.parse(A.records.find(n=>n.id===selected).collectedAt)>A.time()){$('#inspector').hidden=true;selected=null;}refresh();};
  $('#timeline-play').onclick=()=>A.state.playing?A.pause():A.play();
  $('#timeline-restart').onclick=()=>{A.seek(0);A.play();};
  $('#collection-progress').oninput=e=>A.seek(Number(e.target.value)/1000);
  $('#timeline-speed').onchange=e=>A.state.speed=Number(e.target.value);
  $('#timeline-all').onclick=()=>A.seek(1);
  const oldSetFilters=S.setFilters;S.setFilters=function(...args){oldSetFilters(...args);A.refreshHeat();updateCounts();};
  // Filters inside the community module also use its private setter.
  document.addEventListener('click',e=>{if(e.target.closest('.sentiment-filter[data-sentiment],[data-pulse-sentiment],[data-place],#sim-clear,#all-places'))requestAnimationFrame(()=>{A.refreshHeat();updateCounts();});});
  document.addEventListener('change',e=>{if(e.target.matches('#sim-area,#sim-topic')){A.refreshHeat();updateCounts();}});
  document.addEventListener('input',e=>{if(e.target.matches('#sim-search'))setTimeout(()=>{A.refreshHeat();updateCounts();},220);});
  map.on('movestart',()=>{moving=true;});map.on('moveend',()=>{moving=false;A.refreshHeat();});
  const oldSetLayer=setLayer;setLayer=function(...args){if(['social','simulated'].includes(args[0]))clearArrivals();oldSetLayer(...args);A.refreshHeat();updateCounts();};
  const oldStartPlacement=startPlacement;startPlacement=function(){A.pause();oldStartPlacement();};$('#add-note').onclick=startPlacement;
  // Clock updates are cheap; marker and density updates are limited to once a second.
  const timer=setInterval(()=>{const now=performance.now(),elapsed=Math.min(1500,now-lastTick);lastTick=now;if(document.hidden||!A.state.playing||moving||placing||$('#modal').open)return;A.state.progress+=elapsed/180000*A.state.speed;
    if(A.state.progress>1){A.state.progress=0;previousTime=A.start;clearArrivals();reconcileSelection();}
    updateClock();if(now-lastPaint>=1000){lastPaint=now;refresh();animateArrivals(previousTime);previousTime=A.time();}
  },150);
  window.addEventListener('pagehide',()=>{clearInterval(timer);clearArrivals();},{once:true});
  window.addEventListener('minescope:filters',()=>{clearArrivals();A.refreshHeat();updateCounts();});
  renderLayers();refresh();
  A.read=()=>({exampleData:true,playing:A.state.playing,progress:A.state.progress,time:new Date(A.time()).toISOString(),heat:A.state.heat,sources:[...A.state.sources],visible:S.items().length,total:A.records.length,sourceCounts:Object.fromEntries(Object.keys(A.labels).map(p=>[p,S.items().filter(n=>n.platform===p).length])),heatPoints:S.items().filter(n=>['balance','density'].includes(A.state.heat)||n.sentiment===A.state.heat).length});
  if(document.modelContext?.registerTool){try{document.modelContext.registerTool({name:'read_collection_replay',title:'Read collection replay',description:'Read the local prototype replay time, source counts, playing state and sentiment density settings.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:async()=>A.read()});}catch{}}
})();
