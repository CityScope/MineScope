/* Fictional workshop scenario. All counts are from synthetic records. */
(() => {
  'use strict';
  const data=window.MineScopeSimulation;
  const A=window.MineScopeActivity;
  const areas=data.areas, records=A.records;
  const sentiments={
    concerned:{label:['Concerned','Preocupación'],color:'#E08063',icon:'−'},
    hopeful:{label:['Hopeful','Esperanza'],color:'#5FD3A4',icon:'+'},
    mixed:{label:['Mixed','Mixta'],color:'#E9BB63',icon:'≈'},
    neutral:{label:['Questions','Neutral / curiosidad'],color:'#74C2EE',icon:'?'}
  };
  const topicLabels={all:['All topics','Todos los temas'],water:['Water & access','Agua y acceso'],nature:['Nature & coast','Naturaleza y costa'],livelihoods:['Jobs & livelihoods','Empleo y medios de vida'],health:['Health & daily life','Salud y vida cotidiana'],other:['Trust & participation','Confianza y participación']};
  const state={sentiment:'all',area:'all',topic:'all',query:'',mode:'clusters',limit:16,view:'simulation'};
  let currentItems=[],drawnMarkers=[],selectedSample=null,renderTimer,simReady=false,filtersOpen=false,dockArea=null;
  const areaName=a=>lang==='es'?(a.nameEs||a.name):a.name;
  const simLayer=layers.find(l=>l.id==='simulated');
  const active=()=>simLayer.on||layers.find(l=>l.id==='social').on;
  const areaFor=id=>areas.find(a=>a.id===id);
  const recordFor=id=>records.find(n=>n.id===id);
  function filterItems(ignoreArea=false,ignoreSentiment=false){const q=state.query.trim().toLocaleLowerCase();return records.filter(n=>A.includes(n)&&(ignoreSentiment||state.sentiment==='all'||n.sentiment===state.sentiment)&&(ignoreArea||state.area==='all'||n.area===state.area)&&(state.topic==='all'||n.topic===state.topic)&&(!q||(n.text.join(' ')+' '+n.role.join(' ')+' '+areaFor(n.area).name+' '+(areaFor(n.area).nameEs||'')).toLocaleLowerCase().includes(q)));}
  function counts(items){return Object.fromEntries(Object.keys(sentiments).map(id=>[id,items.filter(n=>n.sentiment===id).length]));}
  function ring(items,size=64,cls=''){const c=counts(items),total=items.length;let angle=0;const segments=Object.entries(sentiments).map(([id,s])=>{const start=angle;angle+=total?c[id]/total*100:0;return `${s.color} ${start}% ${angle}%`}).join(',');return `<div class="sentiment-ring ${cls}" style="--ring-size:${size}px;--ring:conic-gradient(${total?segments:'#627380 0% 100%'})"><div><strong>${total}</strong><span>${t('notes','notas')}</span></div></div>`;}
  function miniBar(items){const c=counts(items);return `<span class="sentiment-track" aria-hidden="true">${Object.entries(sentiments).map(([id,s])=>`<i style="background:${s.color};width:${items.length?100*c[id]/items.length:0}%"></i>`).join('')}</span>`;}
  function tag(id){const s=sentiments[id];return `<span class="sentiment-tag" style="--sentiment:${s.color}"><i>${s.icon}</i>${t(...s.label)}</span>`;}
  function noteCard(n,compact=false){return `<button class="sim-note-card ${selected===n.id?'selected':''} ${compact?'compact':''}" data-sim-note="${n.id}" style="--sentiment:${sentiments[n.sentiment].color}"><div class="note-card-top">${tag(n.sentiment)}${A.sourceTag(n)}</div><p>${esc(t(...n.text))}</p><div class="note-card-bottom"><span>⌖ ${esc(areaName(areaFor(n.area)))}</span><time>${A.date(n.collectedAt).split(',')[0]}</time></div></button>`;}
  function bindCards(root=document){root.querySelectorAll('[data-sim-note]').forEach(b=>b.onclick=()=>focusNote(b.dataset.simNote));}
  function collectionTabs(){return `<div class="collection-tabs" aria-label="${t('Community collections','Colecciones comunitarias')}"><button data-collection="simulation" class="${state.view==='simulation'?'active':''}">${t('Notes','Simuladas')} <span>960</span></button><button data-collection="themes" class="${state.view==='themes'?'active':''}">${t('Case study','Documentadas')} <span>5</span></button><button data-collection="notes" class="${state.view==='notes'?'active':''}">${t('Workshop','Taller')} <span>${notes.length}</span></button></div>`;}
  function streamTabs(){const app=A.state.sources.has('community'),social=['x','facebook','reddit'].some(p=>A.state.sources.has(p));return `<div class="stream-tabs" aria-label="Collection sources"><button data-stream="all" class="${app&&social?'active':''}">All</button><button data-stream="app" class="${app&&!social?'active':''}">${A.icon('community')} App notes</button><button data-stream="social" class="${!app&&social?'active':''}">${A.icon('x')} Social feeds</button></div>`;}
  function bindStreams(){document.querySelectorAll('[data-stream]').forEach(b=>b.onclick=()=>{A.state.sources=new Set(b.dataset.stream==='app'?['community']:b.dataset.stream==='social'?['x','facebook','reddit']:Object.keys(A.labels));update();window.dispatchEvent(new Event('minescope:filters'));});}
  function bindCollections(){document.querySelectorAll('[data-collection]').forEach(b=>b.onclick=()=>{state.view=b.dataset.collection;if(state.view==='simulation'){communityView='simulation';setLayer('simulated',true);renderCommunity();showPulse();}else{communityView=state.view;renderCommunity();}});}
  const oldRenderCommunity=renderCommunity;
  renderCommunity=function(){
    if(communityView!=='simulation'){
      state.view=communityView;oldRenderCommunity();const old=document.querySelector('#sidebar-content .segmented');if(old)old.outerHTML=collectionTabs();bindCollections();return;
    }
    state.view='simulation';const perspectivePool=filterItems(false,true),countsAll=counts(perspectivePool);const hasFilters=state.sentiment!=='all'||state.topic!=='all'||state.area!=='all'||state.query;
    $('#sidebar-content').innerHTML=`${collectionTabs()}${streamTabs()}<div class="pulse-heading"><div class="eyebrow">${t('','')}</div><h2>${t('Community notes','Pulso comunitario')}</h2></div><div class="sentiment-filters"><button class="sentiment-filter all ${state.sentiment==='all'?'active':''}" data-sentiment="all" aria-pressed="${state.sentiment==='all'}"><span>${t('All sentiments','Todas las perspectivas')}</span><strong>${perspectivePool.length}</strong></button>${Object.entries(sentiments).map(([id,s])=>`<button class="sentiment-filter ${state.sentiment===id?'active':''}" style="--sentiment:${s.color}" data-sentiment="${id}" aria-pressed="${state.sentiment===id}"><span><i>${s.icon}</i>${t(...s.label)}</span><strong>${countsAll[id]}</strong></button>`).join('')}</div><details class="advanced-filters" id="advanced-filters" ${filtersOpen?'open':''}><summary>${t('Filter notes','Filtrar por lugar, tema o texto')}<span>＋</span></summary><div class="sim-filter-grid"><label><span>${t('PLACE','LUGAR')}</span><select id="sim-area" aria-label="${t('Filter notes by location','Filtrar notas simuladas por lugar')}"><option value="all">${t('All locations','Todo el territorio')}</option>${areas.map(a=>`<option value="${a.id}" ${state.area===a.id?'selected':''}>${esc(areaName(a))}</option>`).join('')}</select></label><label><span>${t('TOPIC','TEMA')}</span><select id="sim-topic" aria-label="${t('Filter notes by topic','Filtrar notas simuladas por tema')}">${Object.entries(topicLabels).map(([id,v])=>`<option value="${id}" ${state.topic===id?'selected':''}>${t(...v)}</option>`).join('')}</select></label></div><div class="sim-search"><span>⌕</span><input id="sim-search" type="search" value="${esc(state.query)}" placeholder="${t('Search notes','Buscar una perspectiva…')}" aria-label="${t('Search notes','Buscar perspectivas simuladas')}"></div></details><div class="feed-heading"><span><strong>${filterItems().length}</strong> ${t('notes','notas simuladas')}</span><button id="sim-clear" ${hasFilters?'':'hidden'}>${t('Clear filters','Limpiar filtros')}</button></div><div id="sim-feed"></div>`;
    $('#advanced-filters').ontoggle=e=>{if(e.target.isConnected)filtersOpen=e.target.open;};$('#sim-area').onchange=e=>{setFilters({area:e.target.value});if(state.area!=='all')flyToArea(state.area);else resetMap();};$('#sim-topic').onchange=e=>setFilters({topic:e.target.value});$('#sim-search').oninput=e=>{state.query=e.target.value;state.limit=16;clearTimeout(renderTimer);renderTimer=setTimeout(()=>update(false),180);};$('#sim-clear').onclick=clearFilters;document.querySelectorAll('#sidebar-content .sentiment-filter[data-sentiment]').forEach(b=>b.onclick=()=>setFilters({sentiment:state.sentiment===b.dataset.sentiment?'all':b.dataset.sentiment}));bindCollections();bindStreams();renderFeed();
  };
  function renderFeed(){const perspectivePool=filterItems(false,true),contextCounts=counts(perspectivePool);document.querySelectorAll('#sidebar-content .sentiment-filter[data-sentiment]').forEach(b=>{b.querySelector('strong').textContent=b.dataset.sentiment==='all'?perspectivePool.length:contextCounts[b.dataset.sentiment];});const el=$('#sim-feed');if(!el)return;const items=filterItems();el.innerHTML=items.length?items.slice().reverse().slice(0,state.limit).map(n=>noteCard(n)).join('')+(state.limit<items.length?`<button class="load-more" id="sim-more">${t('Show more notes','Cargar 16 perspectivas más')} <span>↓</span></button>`:''):`<div class="sim-empty"><span>⌕</span><h3>${t('No notes found','Sin perspectivas coincidentes')}</h3><p>${t('Try a different topic, place or search.','Prueba otro tema, lugar o búsqueda.')}</p><button class="button" id="sim-empty-reset">${t('Reset filters','Restablecer filtros')}</button></div>`;bindCards(el);if($('#sim-more'))$('#sim-more').onclick=()=>{state.limit+=16;renderFeed();};if($('#sim-empty-reset'))$('#sim-empty-reset').onclick=clearFilters;const head=$('.feed-heading strong');if(head)head.textContent=items.length;const clear=$('#sim-clear');if(clear)clear.hidden=!(state.sentiment!=='all'||state.topic!=='all'||state.area!=='all'||state.query);}
  function showPulse(){
    const items=filterItems(),c=counts(items),area=state.area==='all'?null:areaFor(state.area),latest=items.at(-1);
    const inspector=$('#inspector');
    const reuse=selected==='sim-pulse'&&inspector.dataset.summaryArea===state.area&&inspector.querySelector('#pulse-latest');
    selectedSample=null;
    if(!reuse){
      setInspector(`<div class="inspector-head pulse-inspector-head">${closeButton()}<div class="eyebrow">COMMUNITY NOTES</div><h2>${area?esc(areaName(area)):'All locations'}</h2></div><div class="inspector-body"><div class="pulse-total"><strong class="pulse-summary-count"></strong><div>notes<span class="pulse-location-count"></span></div></div><div class="pulse-summary-bar"></div><section id="pulse-latest" class="pulse-latest" aria-label="Latest community note"></section><div class="distribution-label">SENTIMENT</div><div class="distribution-rows">${Object.entries(sentiments).map(([id,s])=>`<button class="distribution-row" data-pulse-sentiment="${id}" style="--sentiment:${s.color}"><span class="distribution-name"><i>${s.icon}</i>${t(...s.label)}</span><span><span data-pulse-count="${id}"></span> <small data-pulse-percent="${id}"></small></span></button>`).join('')}</div>${area?'<button class="pulse-reset" id="pulse-reset">← All locations</button>':''}</div>`,'sim-pulse');
      inspector.classList.add('pulse-inspector');inspector.dataset.summaryArea=state.area;
      inspector.querySelectorAll('[data-pulse-sentiment]').forEach(b=>b.onclick=()=>setFilters({sentiment:state.sentiment===b.dataset.pulseSentiment?'all':b.dataset.pulseSentiment}));
      if($('#pulse-reset'))$('#pulse-reset').onclick=()=>setFilters({area:'all'},true);
    }
    inspector.querySelector('.pulse-summary-count').textContent=items.length;
    const locations=new Set(items.map(n=>n.area)).size;
    inspector.querySelector('.pulse-location-count').textContent=`${locations} ${locations===1?'location':'locations'}`;
    inspector.querySelector('.pulse-summary-bar').innerHTML=miniBar(items);
    for(const id of Object.keys(sentiments)){
      inspector.querySelector(`[data-pulse-count="${id}"]`).textContent=c[id];
      inspector.querySelector(`[data-pulse-percent="${id}"]`).textContent=`${items.length?Math.round(c[id]*100/items.length):0}%`;
    }
    const latestPanel=inspector.querySelector('#pulse-latest');
    latestPanel.hidden=!latest;
    if(latest&&latestPanel.dataset.noteId!==latest.id){
      latestPanel.dataset.noteId=latest.id;
      // Keep the button in place while its content changes, including keyboard focus.
      if(!latestPanel.querySelector('[data-latest-note]')){
        latestPanel.innerHTML='<div class="pulse-latest-heading"><span>Latest note</span><time></time></div><button class="pulse-latest-note" data-latest-note=""><span class="pulse-latest-meta"><span class="pulse-latest-sentiment"><i></i><span></span></span><span class="pulse-latest-source"></span></span><p></p><span class="pulse-latest-place"><span></span><b aria-hidden="true">↗</b></span></button>';
        const button=latestPanel.querySelector('[data-latest-note]');button.onclick=()=>focusNote(button.dataset.latestNote);
      }
      const card=latestPanel.querySelector('[data-latest-note]'),time=latestPanel.querySelector('time');
      card.dataset.latestNote=latest.id;card.style.setProperty('--sentiment',sentiments[latest.sentiment].color);
      time.dateTime=latest.collectedAt;time.textContent=A.date(latest.collectedAt);
      card.querySelector('.pulse-latest-sentiment span').textContent=t(...sentiments[latest.sentiment].label);
      card.querySelector('.pulse-latest-source').textContent=A.labels[latest.platform];
      card.querySelector('p').textContent=t(...latest.text);
      card.querySelector('.pulse-latest-place span').textContent=areaName(areaFor(latest.area));
      card.getAnimations().forEach(animation=>animation.cancel());
      if(A.state.playing&&!matchMedia('(prefers-reduced-motion: reduce)').matches)card.animate([{opacity:.3,transform:'translateY(6px)'},{opacity:1,transform:'translateY(0)'}],{duration:450,easing:'ease-out'});
    }
    if(!latest)latestPanel.dataset.noteId='';
    if(innerWidth<=1150&&state.area==='all'){inspector.hidden=true;selected=null;}
  }
  const oldSetInspector=setInspector;
  setInspector=function(html,id){$('#inspector').classList.remove('pulse-inspector','sample-inspector');oldSetInspector(html,id);const close=$('.inspector-close');const originalClose=close.onclick;close.onclick=()=>{originalClose();if(simReady)renderMap();};if(simReady)requestAnimationFrame(()=>renderMap());};
  const oldShowOverview=showOverview;
  showOverview=function(){if(simReady&&active())showPulse();else oldShowOverview();};
  function showSample(id){const n=recordFor(id);if(!n)return;A.pause?.();selectedSample=id;const area=areaFor(n.area),s=sentiments[n.sentiment];setInspector(`<div class="inspector-head sample-head">${closeButton()}<div class="eyebrow">${A.sourceTag(n)} · ${String(n.sample).padStart(3,'0')}</div><h2>${esc(areaName(area))}</h2><p class="inspector-sub">${t(...topicLabels[n.topic])}</p><time class="collected-time">Collected ${A.date(n.collectedAt)} · Chile</time></div><div class="inspector-body">${tag(n.sentiment)}<div class="quote-mark" style="color:${s.color}">“</div><p class="sample-quote">${esc(t(...n.text))}</p><div class="sample-context"><span>⌖</span><p>${esc(areaName(area))}</p></div><button class="button full" id="sample-area">${t('Notes in this location','Explorar esta zona')} ↗</button><button class="sample-back" id="sample-back">← ${t('Back to summary','Resumen de sentimientos')}</button></div>`,id);$('#inspector').classList.add('sample-inspector');$('#sample-area').onclick=()=>{setFilters({area:n.area});flyToArea(n.area);};$('#sample-back').onclick=showPulse;}
  const oldShowFeature=showFeature;
  showFeature=function(id){if(recordFor(id)){showSample(id);return;}oldShowFeature(id);};
  function focusNote(id){const n=recordFor(id);if(!n)return;A.state.sources.add(n.platform);setLayer(n.platform==='community'?'simulated':'social',true);if(Date.parse(n.collectedAt)>A.time())A.seek?.((Date.parse(n.collectedAt)-A.start)/(A.end-A.start));showSample(id);focusLocation(n.coords,14);if(mobileQuery.matches)$('#sidebar').classList.remove('open');renderFeed();}
  function flyToArea(id,notifyUnity=true){const a=areaFor(id);if(!a)return;showPulse();focusLocation(a.coords,12);if(notifyUnity)window.MineScopeUnity?.select(id);if(mobileQuery.matches)$('#sidebar').classList.remove('open');}
  const mapPadding=mapFocusPadding,focusLocation=focusMapLocation;
  function resetMap(animate=true){
    const bounds=L.latLngBounds(areas.map(a=>a.coords));
    const padding=mapPadding();
    padding.paddingTopLeft=padding.paddingTopLeft.add([44,44]);
    padding.paddingBottomRight=padding.paddingBottomRight.add([44,54]);
    const options={...padding,maxZoom:initialMapView.zoom,duration:.65};
    animate?map.flyToBounds(bounds,options):map.fitBounds(bounds,{...options,animate:false});
  }
  function setFilters(next,reset=false){if($('#advanced-filters'))filtersOpen=$('#advanced-filters').open;const validSentiment=next.sentiment===undefined||next.sentiment==='all'||sentiments[next.sentiment];const validArea=next.area===undefined||next.area==='all'||areaFor(next.area);const validTopic=next.topic===undefined||Object.hasOwn(topicLabels,next.topic);if(!validSentiment||!validArea||!validTopic||Object.keys(next).some(k=>!['sentiment','area','topic','query'].includes(k))||(next.query!==undefined&&typeof next.query!=='string'))throw Error('Invalid simulation filter');Object.assign(state,next);state.limit=16;if(!active())setLayer('simulated',true);selectedSample=null;update(true);if(reset)resetMap();}
  function clearFilters(){filtersOpen=false,dockArea=null;setFilters({sentiment:'all',area:'all',topic:'all',query:''},true);}
  function update(full=true){currentItems=filterItems();renderMap();renderDock();renderMapStatus();if(activeTab==='community'&&communityView==='simulation'){if(full)renderCommunity();else renderFeed();}if(selected==='sim-pulse')showPulse();window.dispatchEvent(new Event('minescope:filters'));}
  const renderer=contextRenderer;
  const noteDots=L.layerGroup().addTo(map),clusterShapes=L.layerGroup().addTo(map);
  const dotCache=new Map();let layoutCache=null;

  function makeCluster(items,coords,kind,area){const size=kind==='area'?Math.min(62,48+Math.sqrt(items.length)):Math.min(43,32+Math.sqrt(items.length));const sentiment=sentiments[items[0].sentiment];const title=kind==='area'?`${areaName(area)} · ${items.length} ${t('notes','notas simuladas')}`:`${t(...sentiment.label)} · ${items.length} ${t('notes','notas simuladas')}`;const html=kind==='area'?`<div class="geo-cluster">${ring(items,size)}<div class="cluster-place">${esc(areaName(area))}</div></div>`:`<div class="sentiment-cluster" style="--sentiment:${sentiment.color};--size:${size}px"><span>${sentiment.icon}</span><strong>${items.length}</strong></div>`;const marker=L.marker(coords,{icon:L.divIcon({className:'cluster-marker',html,iconSize:[size,size],iconAnchor:[size/2,size/2]}),title,zIndexOffset:kind==='area'?400:300}).on('click',()=>{if(placing){openNote(L.latLng(...(area?.coords||coords)));return;}if(kind==='area'){setFilters({area:area.id});flyToArea(area.id);}else{const pts=items.map(n=>n.coords);showSample(items[0].id);map.fitBounds(L.latLngBounds(pts).pad(.35),{...mapPadding(),maxZoom:16,animate:true});}}).on('add',function(){this.getElement()?.setAttribute('aria-label',title);});marker.arrivalCluster={size,kind,counts:counts(items),ids:new Set(items.map(n=>n.id))};marker.addTo(clusterShapes);drawnMarkers.push(marker);}
  function layoutAreaClusters(items){
    const size=map.getSize(),rect=$('#map').getBoundingClientRect(),short=innerHeight<650;
    const reserved=['.topbar','.map-top','#sidebar','#inspector','.map-tray','.leaflet-control-zoom','.selected-comment-marker'].map(sel=>$(sel)).filter(el=>el&&!el.hidden).map(el=>{const b=el.getBoundingClientRect();return {left:b.left-rect.left-7,right:b.right-rect.left+7,top:b.top-rect.top-7,bottom:b.bottom-rect.top+7};});
    const intersects=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
    const groupsToPlace=areas.map(area=>({area,items:items.filter(n=>n.area===area.id),point:map.latLngToContainerPoint(area.coords)})).filter(g=>g.items.length&&g.point.x>-70&&g.point.x<size.x+70&&g.point.y>-70&&g.point.y<size.y+70).sort((a,b)=>b.point.y-a.point.y);
    const choices=groupsToPlace.map(group=>{
      const half=short?35:Math.max(39,areaName(group.area).length*3+8),above=33,below=short?33:58;
      const box=p=>({left:p.x-half,right:p.x+half,top:p.y-above,bottom:p.y+below});
      const candidates=[];
      for(let y=above+8;y<=size.y-below-16;y+=16)for(let x=half+10;x<=size.x-half-10;x+=16){const point=L.point(x,y),bounds=box(point);if(!reserved.some(b=>intersects(bounds,b)))candidates.push({point,box:bounds,distance:point.distanceTo(group.point)});}
      const natural=box(group.point);if(natural.left>=10&&natural.right<=size.x-10&&natural.top>=8&&natural.bottom<=size.y-16&&!reserved.some(b=>intersects(natural,b)))candidates.push({point:group.point,box:natural,distance:0});
      return candidates.sort((a,b)=>a.distance-b.distance);
    });
    let attempts=0;const picked=[];
    function arrange(index){if(index===groupsToPlace.length)return true;for(const candidate of choices[index]){if(++attempts>80000)return false;if(picked.some(p=>intersects(candidate.box,p.box)))continue;picked.push(candidate);if(arrange(index+1))return true;picked.pop();}return false;}
    const complete=arrange(0);
    return groupsToPlace.map((group,i)=>{const point=complete?picked[i].point:group.point,loc=map.containerPointToLatLng(point);return {...group,coords:[loc.lat,loc.lng]};});
  }
  function renderMap(){
    clusterShapes.clearLayers();drawnMarkers=[];
    const items=active()?filterItems():[],zoom=map.getZoom(),individual=state.mode==='notes'||zoom>=14;
    const heat=A.state.heat!=='none',visible=map.getBounds().pad(.15);
    const desired=new Set();
    if(!heat)items.forEach(n=>{
      if(!visible.contains(n.coords))return;
      const key=n.id+':'+individual;desired.add(key);if(dotCache.has(key))return;
      const sentiment=sentiments[n.sentiment];let dot;
      if(individual){
        dot=L.marker(n.coords,{icon:L.divIcon({className:'note-map-marker',html:`<span class="note-map-pin" data-platform="${n.platform}" style="--sentiment:${sentiment.color}">${A.icon(n.platform)}</span>`,iconSize:[18,18],iconAnchor:[9,9]}),title:A.labels[n.platform],zIndexOffset:200});
      }else dot=L.circleMarker(n.coords,{renderer,radius:2,color:sentiment.color,weight:0,fillColor:sentiment.color,fillOpacity:.38,interactive:false,bubblingMouseEvents:false});
      if(individual)dot.bindTooltip(`${A.labels[n.platform]} · ${t(...sentiment.label)} · #${n.sample}`,{className:'sim-tooltip',direction:'top'}).on('click',e=>placing?openNote(e.latlng):showSample(n.id));
      dot.addTo(noteDots);dotCache.set(key,dot);
    });
    dotCache.forEach((dot,key)=>{if(!desired.has(key)){noteDots.removeLayer(dot);dotCache.delete(key);}});
    if(!individual&&!heat){
      if(zoom<11.75){
        const key=map.getCenter().toString()+zoom+map.getSize().toString()+$('#inspector').hidden+selected;
        if(!layoutCache||layoutCache.key!==key)layoutCache={key,positions:layoutAreaClusters(records).map(({area,coords})=>({area,coords}))};
        layoutCache.positions.forEach(({area,coords})=>{const subset=items.filter(n=>n.area===area.id);if(subset.length){if(map.latLngToContainerPoint(area.coords).distanceTo(map.latLngToContainerPoint(coords))>14)L.polyline([area.coords,coords],{renderer,color:'#8DA2A9',weight:1,opacity:.65,dashArray:'3 4',interactive:false}).addTo(clusterShapes);makeCluster(subset,coords,'area',area);}});
      }else{
        const cells=new Map();items.filter(n=>visible.contains(n.coords)).forEach(n=>{const p=map.project(n.coords,zoom),key=`${n.sentiment}:${Math.floor(p.x/96)}:${Math.floor(p.y/96)}`;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(n);});
        cells.forEach((subset,key)=>{const [,gx,gy]=key.split(':'),slot=Object.keys(sentiments).indexOf(subset[0].sentiment);const point=map.unproject(L.point(Number(gx)*96+24+(slot%2)*48,Number(gy)*96+24+Math.floor(slot/2)*48),zoom);makeCluster(subset,[point.lat,point.lng],'sentiment');});
      }
    }
    document.querySelectorAll('[data-map-mode]').forEach(b=>{b.classList.toggle('active',!heat&&state.mode===b.dataset.mapMode);b.setAttribute('aria-pressed',String(!heat&&state.mode===b.dataset.mapMode));});
    A.syncArrivals?.();
  }
  const oldRenderLegend=renderLegend;
  renderLegend=function(){if(simReady&&active()){$('#legend').innerHTML=`${geographyLegend()}<span class="legend-title">${t('SENTIMENT','SENTIMIENTO SIMULADO')}</span>${Object.entries(sentiments).map(([id,s])=>`<span style="--color:${s.color}"><i>${s.icon}</i>${t(...s.label)}</span>`).join('')}`;}else oldRenderLegend();};
  function syncProjectLabels(){points.forEach(p=>{const marker=markers[p.id];marker.unbindTooltip().bindTooltip(esc(t(...p.title)),{permanent:!active(),direction:'bottom',offset:[0,14],className:'map-label'});});}
  const oldSetLayer=setLayer;
  setLayer=function(id,on){oldSetLayer(id,on);if(simReady&&['simulated','social'].includes(id)){syncProjectLabels();document.body.classList.toggle('simulation-hidden',!active());renderMapStatus();renderDock();if(!on&&recordFor(selected)&&((recordFor(selected).platform==='community')===(id==='simulated'))){$('#inspector').hidden=true;selected=null;}renderMap();A.refreshHeat?.();if(on&&selected===null)showPulse();}};
  const oldShowLayer=showLayer;
  showLayer=function(id){if(['simulated','social'].includes(id)){communityView='simulation';switchTab('community');setLayer('simulated',true);showPulse();return;}oldShowLayer(id);};
  const shell=$('.map-shell');
  shell.insertAdjacentHTML('beforeend',`<div class="map-display-controls" id="map-display-controls"></div><section class="place-dock" aria-label="${t('Locations','Explorar lugares')}"><button id="all-places" class="all-places" aria-label="Show all locations">Show all</button><div class="place-cards" id="place-cards"></div></section>`);
  function renderMapStatus(){$('#map-display-controls').innerHTML=`<button data-map-mode="clusters" class="${A.state.heat==='none'&&state.mode==='clusters'?'active':''}" aria-pressed="${A.state.heat==='none'&&state.mode==='clusters'}"><span>◉</span>${t('Clusters','Grupos')}</button><button data-map-mode="notes" class="${A.state.heat==='none'&&state.mode==='notes'?'active':''}" aria-pressed="${A.state.heat==='none'&&state.mode==='notes'}"><span>⠿</span>${t('All notes','Todas las notas')}</button>`;document.querySelectorAll('[data-map-mode]').forEach(b=>b.onclick=()=>{A.setHeat?.('none');state.mode=b.dataset.mapMode;if(!active())setLayer('simulated',true);renderMap();});}
  function renderDock(){
    const pool=filterItems(true),cards=$('#place-cards'),changed=dockArea!==state.area;
    const overview=$('#all-places');
    overview.classList.toggle('active',state.area==='all');
    overview.setAttribute('aria-pressed',String(state.area==='all'));
    overview.onclick=()=>{setFilters({area:'all'});showPulse();resetMap();};
    // Keep cards mounted so playback preserves focus, scrolling and selection animation.
    if(!cards.children.length){
      cards.innerHTML=areas.map(a=>`<button class="place-card" data-place="${a.id}" aria-pressed="false"><span class="place-current" aria-hidden="true"></span><strong></strong><span class="place-name"></span>${miniBar([])}</button>`).join('');
      cards.querySelectorAll('[data-place]').forEach(button=>button.onclick=()=>{setFilters({area:button.dataset.place});flyToArea(button.dataset.place);});
    }
    areas.forEach(a=>{
      const button=cards.querySelector(`[data-place="${a.id}"]`),subset=pool.filter(n=>n.area===a.id),selectedArea=state.area===a.id,c=counts(subset);
      button.classList.toggle('active',selectedArea);
      button.setAttribute('aria-pressed',String(selectedArea));
      button.setAttribute('aria-label',`${areaName(a)}, ${subset.length} notes${selectedArea?', selected':''}`);
      button.title=areaName(a);
      button.querySelector('strong').textContent=subset.length;
      button.querySelector('.place-name').textContent=areaName(a);
      button.querySelectorAll('.sentiment-track i').forEach((bar,i)=>{bar.style.width=`${subset.length?100*c[Object.keys(sentiments)[i]]/subset.length:0}%`;});
      if(changed&&selectedArea)requestAnimationFrame(()=>{
        const card=button.getBoundingClientRect(),viewport=cards.getBoundingClientRect();
        if(card.left<viewport.left||card.right>viewport.right)cards.scrollTo({left:cards.scrollLeft+card.left-viewport.left-(viewport.width-card.width)/2,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
      });
    });
    dockArea=state.area;
  }

  sources.push({id:'social-examples',title:['Social-feed examples'],type:['PROJECT DATA'],description:['320 project-authored posts representing X / Twitter, Facebook and Reddit conversations. No real posts, accounts or platform connections are used. Locations, dates and sentiment categories are assigned for the prototype.'],date:['320 posts · 1–18 September 2026']});
  sources.push({id:'simulation',title:['Community notes · example dataset','Aportes comunitarios simulados · 640 notas'],type:['EXAMPLE DATASET','DATOS FICTICIOS DE DEMOSTRACIÓN'],description:['Assigned sentiments and synthetic locations; not collected community evidence.','Sentimientos asignados y ubicaciones sintéticas; no son evidencia comunitaria recopilada.'],date:['640 notes · 6 locations','6 zonas · 4 sentimientos · inglés / español'],url:'simulated-community.geojson'});
  const oldTranslate=translate;translate=function(){oldTranslate();renderMap();renderDock();renderMapStatus();renderLegend();if(selected==='sim-pulse')showPulse();else if(recordFor(selected))showSample(selected);};
  const oldRenderLayers=renderLayers;renderLayers=function(){oldRenderLayers();const simButton=document.querySelector('[data-layer="simulated"]');if(simButton)simButton.closest('.layer-item').classList.add('simulation-layer-item');};
  let renderFrame;map.on('moveend resize',()=>{cancelAnimationFrame(renderFrame);renderFrame=requestAnimationFrame(renderMap)});
  $('#reset-view').onclick=()=>{setFilters({area:'all'});showPulse();resetMap();};
  simReady=true;syncProjectLabels();document.body.classList.add('community-atlas');communityView='simulation';activeTab='layers';switchTab('layers');map.invalidateSize({pan:false});currentItems=filterItems();renderMap();renderMapStatus();renderDock();renderLegend();showPulse();if(innerWidth<=1150){$('#inspector').hidden=true;selected=null;}resetMap(false);
  const mapResizeObserver=new ResizeObserver(()=>{map.invalidateSize({pan:false});if(simReady){if(innerWidth<=1150&&state.area==='all'&&selected==='sim-pulse'){$('#inspector').hidden=true;selected=null;}if(state.area==='all')resetMap(false);else renderMap();}});mapResizeObserver.observe($('#map'));
  window.MineScopeSim={setFilters,visitArea:id=>{if(!areaFor(id))return;setFilters({area:id});showPulse();flyToArea(id,false);},showAll:()=>{setFilters({area:'all'});showPulse();resetMap();},items:filterItems,clusters:()=>drawnMarkers,refresh:()=>{renderMap();renderDock();renderMapStatus();renderLegend();if(activeTab==='community'&&communityView==='simulation')renderFeed();if(selected==='sim-pulse')showPulse();},read:()=>({synthetic:true,total:records.length,filtered:filterItems().length,filters:{...state},sentiments:counts(filterItems()),areaCounts:Object.fromEntries(areas.map(a=>[a.id,filterItems().filter(n=>n.area===a.id).length])),mode:state.mode}),setMode:mode=>{if(!['clusters','notes'].includes(mode))throw Error('Invalid display mode');A.setHeat?.('none');state.mode=mode;renderMap();renderMapStatus();return {mode};}};
  if(document.modelContext?.registerTool){const lifecycle=new AbortController();const defs=[
    {name:'read_simulated_community',title:'Read simulated community data',description:'Read synthetic note counts, assigned sentiment distribution and active filters. Not real community opinion.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:false},execute:async input=>{if(!input||Object.keys(input).length)throw Error('Expected empty input');return window.MineScopeSim.read();}},
    {name:'filter_simulated_community',title:'Filter simulated community perspectives',description:'Filter the 960 fictional notes by assigned sentiment, topic, discussion area or search text. Changes the visible map, feed and counts.',inputSchema:{type:'object',properties:{sentiment:{type:'string',enum:['all',...Object.keys(sentiments)]},area:{type:'string',enum:['all',...areas.map(a=>a.id)]},topic:{type:'string',enum:Object.keys(topicLabels)},query:{type:'string'}},additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:async input=>{setFilters(input);communityView='simulation';switchTab('community');showPulse();return window.MineScopeSim.read();}},
    {name:'focus_simulated_note',title:'Focus a fictional note',description:'Open a synthetic note by its ID and show its approximate map location.',inputSchema:{type:'object',properties:{id:{type:'string'}},required:['id'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:async input=>{if(!input||Object.keys(input).some(k=>k!=='id')||!recordFor(input.id))throw Error('Unknown simulated note');focusNote(input.id);return {synthetic:true,selected:input.id};}}
  ];defs.forEach(d=>{try{Promise.resolve(document.modelContext.registerTool(d,{signal:lifecycle.signal})).catch(()=>{});}catch{}});window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});}
})();
