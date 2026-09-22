
// Terrain renderer using the existing panels, records and replay model.
const A=window.MineScopeActivity,S=window.MineScopeSim,areas=window.MineScopeSimulation.areas;
const colors=A.colors,order=['concerned','hopeful','mixed','neutral'];
const modelMap=map, shell=document.querySelector('.map-shell');
let dispose=()=>{},generation=0,recoveries=0;
const ready=document.createElement('span');ready.className='terrain-status';ready.setAttribute('role','status');
const retry=document.createElement('button');retry.className='button terrain-retry';retry.textContent='Retry 3D';retry.hidden=true;
document.querySelector('.app-status').prepend(ready,retry);
retry.onclick=()=>{recoveries=0;void startTerrain();};
function showFallback(error){
  dispose();dispose=()=>{};
  ready.textContent='2D map';ready.title='3D is unavailable. The 2D map and your notes remain available.';retry.hidden=false;
  console.warn('3D map unavailable:',error?.message||error);
  S.refresh();A.refreshHeat();
}
async function startTerrain(camera){
  const version=++generation;dispose();dispose=()=>{};retry.hidden=true;ready.textContent=camera?'Restoring map…':'Loading terrain…';
  try{
    const ml=await import('./vendor/maplibre-gl.mjs');
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),10000);
    let style;
    try{const response=await fetch('https://tiles.openfreemap.org/styles/dark',{signal:controller.signal});if(!response.ok)throw Error('Map style unavailable');style=await response.json();}finally{clearTimeout(timeout);}
    if(version!==generation)return;
    if(!style.sources||!Array.isArray(style.layers))throw Error('Invalid map style');
    mountTerrain(ml,style,camera,version);
  }catch(error){if(version===generation)showFallback(error);}
}
function mountTerrain(ml,style,camera,version){
const dem={type:'raster-dem',tiles:['https://tiles.mapterhorn.com/{z}/{x}/{y}.webp'],tileSize:512,encoding:'terrarium',maxzoom:12,attribution:'Elevation: <a href="https://mapterhorn.com/attribution/">Mapterhorn · Copernicus DEM</a>'};
style.sources.terrain={...dem};style.sources.shading={...dem};
style.sources.satellite={type:'raster',tiles:['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],tileSize:256,maxzoom:18,attribution:'Imagery © Esri, Maxar, Earthstar Geographics, GIS User Community'};
style.layers=style.layers.filter(l=>!l.id.startsWith('railway')&&!l.id.startsWith('aeroway')&&!l.id.startsWith('road_oneway'));
for(const layer of style.layers){
  if(layer.type==='background')layer.paint={'background-color':'#27384b'};
  if(layer.type==='fill'){
    layer.paint['fill-color']=layer.id==='water'?'#071423':layer.id==='building'?'#33475b':'#293b4c';
    delete layer.paint['fill-pattern'];
  }
  if(layer.type==='line'){
    layer.paint['line-color']=layer['source-layer']==='waterway'?'#496d89':'#60778d';
    layer.paint['line-opacity']=layer.id.includes('boundary')?.22:.52;
  }
  if(layer.type==='symbol'){
    layer.paint['text-color']='#a1b8c7';layer.paint['text-halo-color']='#102031';layer.paint['text-halo-width']=1.4;
    if(layer['source-layer']==='place')layer.minzoom=Math.max(layer.minzoom||0,11);
  }
}
const symbolIndex=style.layers.findIndex(l=>l.type==='line');
style.layers.splice(symbolIndex,0,{id:'satellite-image',type:'raster',source:'satellite',layout:{visibility:'none'},paint:{'raster-saturation':-.1,'raster-contrast':.1}},
 {id:'terrain-shading',type:'hillshade',source:'shading',paint:{'hillshade-exaggeration':.65,'hillshade-shadow-color':'#020712','hillshade-highlight-color':'#71899f','hillshade-accent-color':'#334d69','hillshade-illumination-direction':315,'hillshade-illumination-anchor':'map'}});
style.terrain={source:'terrain',exaggeration:1.35};
style.sky={'sky-color':'#111e31','horizon-color':'#667e94','fog-color':'#172b42','sky-horizon-blend':.6,'horizon-fog-blend':.6,'fog-ground-blend':.5};
const el=document.createElement('div');el.id='terrain-view';el.style.visibility='hidden';shell.prepend(el);
const oldMap=document.querySelector('#map'),bg=document.querySelector('#background-map'),info=document.querySelector('#background-info');
const originalMethods=Object.fromEntries(['setView','flyToBounds','fitBounds','flyTo','zoomIn','zoomOut'].map(key=>[key,modelMap[key]]));
const originalUI={options:bg.innerHTML,value:bg.value,change:bg.onchange,info:info.onclick};
let view,angle,connector,observer,resizeObserver,loadTimer,refreshFrame=0,disposed=false;
let loaded=false,background=(camera?.background||bg.value)==='satellite'?'satellite':'night',lastTime=A.time(),markers3d=new Map(),arrivals=[];
const tiles=[];modelMap.eachLayer(layer=>{if(layer instanceof L.TileLayer)tiles.push(layer);});
function cleanup(){
  if(disposed)return;disposed=true;loaded=false;clearTimeout(loadTimer);cancelAnimationFrame(refreshFrame);
  observer?.disconnect();resizeObserver?.disconnect();window.removeEventListener('minescope:filters',scheduleRefresh);document.removeEventListener('visibilitychange',scheduleRefresh);
  modelMap.off('layeradd layerremove',scheduleRefresh);
  clearArrivals();for(const entry of markers3d.values())entry.pin.remove();markers3d.clear();
  delete window.MineScope3D;Object.assign(modelMap,originalMethods);
  document.body.classList.remove('terrain-ready');delete document.body.dataset.terrainBackground;oldMap.removeAttribute('aria-hidden');oldMap.inert=false;
  bg.innerHTML=originalUI.options;bg.value=background;bg.onchange=originalUI.change;info.onclick=originalUI.info;
  angle?.remove();connector?.remove();
  try{view?.remove();}catch(error){console.warn('Map cleanup:',error.message);}el.remove();
  // Restoring the original basemap also restores its internal selection state.
  if(bg.onchange)bg.onchange({target:bg});else tiles.forEach(layer=>layer.addTo(modelMap));
}
dispose=cleanup;
view=new ml.Map({container:el,style,center:camera?.center||[-71.25,-29.38],zoom:camera?.zoom??10.1,pitch:camera?.pitch??58,bearing:camera?.bearing??-14,padding:camera?.padding,maxPitch:78,minZoom:8,maxZoom:16,attributionControl:false,antialias:true,renderWorldCopies:false});
view.addControl(new ml.AttributionControl({compact:true}),'bottom-right');view.touchZoomRotate.enableRotation();
loadTimer=setTimeout(()=>{if(version===generation&&!loaded)showFallback(Error('Terrain loading timed out'));},20000);
view.on('webglcontextlost',()=>{
  if(disposed)return;loaded=false;cancelAnimationFrame(refreshFrame);refreshFrame=0;
  const next={center:view.getCenter().toArray(),zoom:view.getZoom(),pitch:view.getPitch(),bearing:view.getBearing(),padding:view.getPadding(),background};
  ready.textContent='Restoring map…';
  // Tear down the lost context instead of reusing invalid terrain textures.
  setTimeout(()=>{if(disposed||version!==generation)return;if(recoveries++<1)void startTerrain(next);else showFallback(Error('Graphics reset again. Use 2D or retry 3D.'));},0);
});
function scheduleRefresh(){if(!loaded||disposed||document.hidden||refreshFrame)return;refreshFrame=requestAnimationFrame(()=>{refreshFrame=0;refresh();});}
const heat=window.MineScopeHeatField.create(A.records);
const fc=features=>({type:'FeatureCollection',features});
const pointFeature=(coords,properties)=>({type:'Feature',geometry:{type:'Point',coordinates:[coords[1],coords[0]]},properties});
const sourceKeys=new Map();
function setData(id,key,features){if(sourceKeys.get(id)===key)return;const source=view.getSource(id);if(!source)return;source.setData(fc(features()));sourceKeys.set(id,key);}
const escapeText=text=>String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function padding(){
  const p=mapFocusPadding();return {top:p.paddingTopLeft.y+8,right:p.paddingBottomRight.x+14,bottom:p.paddingBottomRight.y+8,left:p.paddingTopLeft.x+14};
}
function counts(items){return Object.fromEntries(order.map(id=>[id,items.filter(n=>n.sentiment===id).length]));}
function ring(items){let angle=0;const c=counts(items),segments=order.map(id=>{const before=angle;angle+=items.length?c[id]/items.length*100:0;return `${colors[id]} ${before}% ${angle}%`;}).join(',');return `<span class="terrain-ring" style="--ring:conic-gradient(${items.length?segments:'#52738d 0% 100%'})"><strong>${items.length}</strong></span>`;}
function marker(id,coords,html,cls,click){
  let entry=markers3d.get(id);
  if(!entry){const node=document.createElement('button');node.type='button';node.className='terrain-marker '+cls;node.addEventListener('click',event=>{event.stopPropagation();entry.action?.();});const pin=new ml.Marker({element:node,anchor:'center',pitchAlignment:'viewport',rotationAlignment:'viewport',occludedOpacity:.18}).setLngLat([coords[1],coords[0]]).addTo(view);entry={node,pin,html:null};markers3d.set(id,entry);}
  entry.action=click;
  if(entry.html!==html){entry.node.innerHTML=html;entry.html=html;}
  const current=entry.pin.getLngLat();if(current.lng!==coords[1]||current.lat!==coords[0])entry.pin.setLngLat([coords[1],coords[0]]);return entry;
}
function drawConnector(){
  const svg=document.querySelector('#terrain-connector'),pin=markers3d.get('selected')?.node,panel=document.querySelector('#inspector');
  if(!pin||panel.hidden){svg.setAttribute('hidden','');return;}
  const p=pin.getBoundingClientRect(),b=panel.getBoundingClientRect(),root=shell.getBoundingClientRect();
  const x=p.x+p.width/2-root.x,y=p.y+p.height/2-root.y;
  const targetX=innerWidth<=700?Math.max(b.left+15,Math.min(b.right-15,x)):b.left,targetY=innerWidth<=700?b.top:b.top+Math.min(190,b.height/2);
  svg.toggleAttribute('hidden',x<0||y<0||x>innerWidth||y>innerHeight||(x>b.left&&x<b.right&&y>b.top&&y<b.bottom));
  const dx=targetX-x,dy=targetY-y,d=Math.hypot(dx,dy)||1;
  svg.querySelector('path').setAttribute('d',`M ${x+dx/d*28} ${y+dy/d*28} L ${targetX} ${targetY}`);
}
function noteHTML(n,large=false){return `<span class="${large?'terrain-selected':'note-map-pin'}" style="--sentiment:${colors[n.sentiment]}">${A.icon(n.platform)}</span>`;}
// Refresh during a zoom only when the representation changes.
let renderedZoomBand;
function zoomBand(){const zoom=view.getZoom();return zoom<11.35?'regions':zoom<12?'dots':'icons';}
function refresh(){
  if(!loaded||disposed)return;
  const band=zoomBand(),state=S.read(),items=S.items(),visibleIDs=new Set(),individual=state.mode==='notes'||band==='icons',regional=band==='regions',heatOn=A.state.heat!=='none';
  if(renderedZoomBand!==band)clearArrivals();renderedZoomBand=band;
  const onScreen=note=>{const p=view.project([note.coords[1],note.coords[0]]);return Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=-40&&p.y>=-40&&p.x<=el.clientWidth+40&&p.y<=el.clientHeight+40;};
  if(!heatOn){
    if(individual){for(const n of items.filter(onScreen)){const id='note:'+n.id;visibleIDs.add(id);const p=marker(id,n.coords,noteHTML(n),'terrain-note',()=>showFeature(n.id));p.node.setAttribute('aria-label',`${A.labels[n.platform]}: ${n.text[0]}`);}}
    else if(regional) for(const area of areas){const subset=items.filter(n=>n.area===area.id);if(!subset.length)continue;const id='area:'+area.id;visibleIDs.add(id);const p=marker(id,area.coords,ring(subset)+`<span class="terrain-place-label">${escapeText(area.name)}</span>`,'terrain-cluster',()=>{S.visitArea(area.id);window.MineScopeUnity?.select(area.id);});p.node.setAttribute('aria-label',`${area.name}, ${subset.length} notes`);p.node.classList.toggle('current',state.filters.area===area.id);p.noteIDs=new Set(subset.map(n=>n.id));p.radius=28;p.items=subset;}
  }
  for(const feature of [...features,...notes.map(noteFeature)]){
    if(!layers.find(l=>l.id===feature.layer)?.on)continue;
    const id='feature:'+feature.id;visibleIDs.add(id);const color=layers.find(l=>l.id===feature.layer).color;
    const p=marker(id,feature.coords,`<span class="terrain-feature" style="--feature-color:${color}">${feature.mark}</span>`,'terrain-feature-marker',()=>showFeature(feature.id));p.node.setAttribute('aria-label',feature.title[0]);p.node.title=feature.title[0];p.pin.setOffset(feature.layer==='community'&&regional?[-38,32]:[0,0]);
  }
  const chosen=A.records.find(n=>n.id===selected);
  if(chosen&&!document.querySelector('#inspector').hidden){visibleIDs.add('selected');marker('selected',chosen.coords,noteHTML(chosen,true),'terrain-selected-marker',()=>{}).node.setAttribute('aria-label','Selected note');document.querySelector('#terrain-connector').style.setProperty('--comment-color',colors[chosen.sentiment]);}
  for(const [id,entry] of markers3d)if(!visibleIDs.has(id)){entry.pin.remove();markers3d.delete(id);}
  const itemKey=items.map(n=>n.id).join(','),showDots=!heatOn&&!individual&&!regional;
  setData('note-dots',showDots?itemKey:'',()=>showDots?items.map(n=>pointFeature(n.coords,{color:colors[n.sentiment]})):[]);
  if(heatOn||showDots)clearArrivals();
  setData('heat-cells',heatOn?A.state.heat+':'+itemKey:'',()=>heatOn?heat.evaluate(items,A.state.heat).map(cell=>({type:'Feature',properties:{color:`rgb(${cell.color.join(',')})`,opacity:cell.opacity},geometry:{type:'Polygon',coordinates:[[...cell.corners,cell.corners[0]].map(p=>[p[1],p[0]])]}})):[]);
  const now=A.time();
  if(A.state.playing&&now>lastTime&&!heatOn&&!showDots){const incoming=items.filter(n=>Date.parse(n.collectedAt)>lastTime&&Date.parse(n.collectedAt)<=now).slice(-4);incoming.forEach(n=>addArrival(n));}
  if(now<lastTime)clearArrivals();lastTime=now;
  drawConnector();syncGeography();
}
function clearArrivals(){arrivals.forEach(a=>{clearTimeout(a.timer);a.pin.remove();});arrivals=[];}
function addArrival(note){
  const counter=[...markers3d.values()].find(p=>p.noteIDs?.has(note.id)),radius=counter?.radius||9,arc=counter?window.MineScopeArrivalLayout.segment(counts(counter.items),note.sentiment):null;
  const angle=arc?(arc.start+arc.end)/2:0,r=radius+23,dx=Math.sin(angle)*r,dy=-Math.cos(angle)*r;
  const node=document.createElement('div');node.className='terrain-arrival';node.style.setProperty('--sentiment',colors[note.sentiment]);
  node.innerHTML=`<svg aria-hidden="true"><path d="M ${Math.sin(angle)*radius} ${-Math.cos(angle)*radius} L ${dx} ${dy}"/></svg><button class="arrival-badge" aria-label="New ${note.sentiment} note" style="left:${dx-9}px;top:${dy-9}px">${A.icon(note.platform)}</button>`;
  node.querySelector('button').onclick=()=>showFeature(note.id);
  const coords=counter?counter.pin.getLngLat():[note.coords[1],note.coords[0]],offset=counter?counter.pin.getOffset():[0,0];
  const pin=new ml.Marker({element:node,anchor:'center',occludedOpacity:0,offset}).setLngLat(coords).addTo(view);
  const entry={pin,timer:null};arrivals.push(entry);entry.timer=setTimeout(()=>{pin.remove();arrivals=arrivals.filter(a=>a!==entry);},2400);
}
function syncGeography(){
  for(const id of ['protected','watercourses','catchments','infrastructure']){
    const visible=layers.find(l=>l.id===id).on,layerId='context-'+id;
    const visibility=visible?'visible':'none';
    if(view.getLayoutProperty(layerId,'visibility')!==visibility)view.setLayoutProperty(layerId,'visibility',visibility);
    if(!visible)continue;
    const list=[];
    function collect(layer){if(layer instanceof L.Polyline)list.push(layer);else if(layer.eachLayer)layer.eachLayer(collect);}
    groups[id].eachLayer(collect);
    const signature=list.map(layer=>L.stamp(layer)).join(',');
    setData(layerId,signature,()=>list.map(layer=>{const data=layer.toGeoJSON();data.properties={...data.properties,leafletId:L.stamp(layer)};return data;}));
  }
}
function syncModel(){
  const center=view.getCenter();originalSetView.call(modelMap,[center.lat,center.lng],view.getZoom()+1,{animate:false});
}
const originalSetView=modelMap.setView;
function flyBounds(bounds,options={}){
  const b=L.latLngBounds(bounds),center=b.getCenter(),point=b.getSouthWest().equals(b.getNorthEast()),overview=!point&&S.read().filters.area==='all'&&b.getNorth()-b.getSouth()>.2;
  clearArrivals();
  const area=areas.find(a=>a.id===S.read().filters.area),bearings={choros:38,'los-choros':56,totoralillo:20,higuera:35,trapiche:55,negrillo:15};
  let camera;
  if(overview)camera={center:[-71.27,-29.40],zoom:9.95,pitch:54,bearing:-12,padding:padding()};
  else if(point)camera={center:[center.lng,center.lat],zoom:Math.min(14,(options.maxZoom||12)+1.15),pitch:58,bearing:bearings[area?.id]??28,padding:padding()};
  else camera={...view.cameraForBounds([[b.getWest(),b.getSouth()],[b.getEast(),b.getNorth()]],{padding:padding(),maxZoom:(options.maxZoom||13)-1}),pitch:58};
  if(!loaded||options.animate===false)view.jumpTo(camera);else view.flyTo({...camera,duration:document.querySelector('#demo-status').hidden?2200:4200,curve:1.05,minZoom:Math.min(12.4,view.getZoom()),essential:false});
  return modelMap;
}
function changeBackground(){
  background=bg.value;shell.dataset.basemap=background;document.body.dataset.terrainBackground=background;
  view.setLayoutProperty('satellite-image','visibility',background==='satellite'?'visible':'none');
  view.setPaintProperty('terrain-shading','hillshade-exaggeration',background==='satellite'?.18:.65);
  view.setPaintProperty('terrain-shading','hillshade-shadow-color',background==='satellite'?'#181c22':'#020712');
  view.setPaintProperty('terrain-shading','hillshade-highlight-color',background==='satellite'?'#ece0c5':'#71899f');
  view.setSky({'sky-color':background==='satellite'?'#3c6f96':'#111e31','horizon-color':background==='satellite'?'#cfdfdf':'#667e94','fog-color':background==='satellite'?'#8199a8':'#172b42','sky-horizon-blend':.6,'horizon-fog-blend':.6,'fog-ground-blend':.5});
}
function installControls(){
bg.innerHTML='<option value="night">Night terrain</option><option value="satellite">Satellite</option>';bg.value=background;
bg.onchange=changeBackground;
document.querySelector('#background-info').onclick=()=>openModal(`<div class="eyebrow">3D MAP</div><h2>${background==='night'?'Night terrain':'Satellite'}</h2><p>Terrain comes from Mapterhorn and Copernicus elevation data. Elevation tiles load from the original provider. Terrain is shown at 1.35× vertical scale.</p><p>${background==='night'?'Map labels and roads load from OpenFreeMap and OpenStreetMap.':'Satellite imagery streams from Esri and its imagery providers.'}</p><p>Drag to move. Right-drag or Control-drag to tilt and rotate.</p><a class="source-link" href="https://mapterhorn.com/attribution/" target="_blank">Terrain sources ↗</a>`);
angle=document.createElement('button');angle.className='terrain-angle';angle.title='Switch between an overhead and angled view';angle.setAttribute('aria-label','Switch to overhead view');angle.textContent=view.getPitch()>15?'3D':'2D';angle.setAttribute('aria-label',view.getPitch()>15?'Switch to overhead view':'Switch to angled view');document.querySelector('.leaflet-control-zoom').after(angle);
angle.onclick=()=>{const tilted=view.getPitch()>15;view.easeTo({pitch:tilted?0:62,duration:900});};
}
view.on('pitch',()=>{if(!angle)return;const tilted=view.getPitch()>15;angle.textContent=tilted?'3D':'2D';angle.setAttribute('aria-label',tilted?'Switch to overhead view':'Switch to angled view');});
shell.insertAdjacentHTML('beforeend','<svg id="terrain-connector" class="terrain-connector" hidden aria-hidden="true"><path/></svg>');connector=document.querySelector('#terrain-connector');
view.on('move',()=>{if(loaded)drawConnector();});
view.on('zoom',()=>{if(loaded&&zoomBand()!==renderedZoomBand)scheduleRefresh();});
view.on('moveend',()=>{if(loaded){syncModel();scheduleRefresh();}});
view.on('click',e=>{if(placing)openNote(L.latLng(e.lngLat.lat,e.lngLat.lng));else if(mobileQuery.matches)setSidebar(false);});
view.on('error',e=>{console.warn('3D map:',e.error?.message||e);if(!loaded)ready.textContent='Loading terrain…';});
view.on('load',()=>{
  if(disposed)return;
  try{
  for(const id of ['note-dots','heat-cells'])view.addSource(id,{type:'geojson',data:fc([])});
  view.addLayer({id:'heat-field',type:'fill',source:'heat-cells',paint:{'fill-color':['get','color'],'fill-opacity':['get','opacity']}});
  view.addLayer({id:'note-dots',type:'circle',source:'note-dots',paint:{'circle-color':['get','color'],'circle-radius':3,'circle-opacity':.85}});
  for(const id of ['protected','watercourses','catchments','infrastructure']){
    view.addSource('context-'+id,{type:'geojson',data:fc([])});
    const paint={'line-color':layers.find(l=>l.id===id).color,'line-width':id==='protected'?1:1.3,'line-opacity':id==='protected'?.55:.6};if(id==='protected')paint['line-dasharray']=[1,5];if(id==='catchments'||id==='infrastructure')paint['line-dasharray']=[4,5];
    view.addLayer({id:'context-'+id,type:'line',source:'context-'+id,paint});
    view.on('click','context-'+id,e=>{if(placing)return;const leafId=e.features?.[0]?.properties.leafletId;const layer=modelMap._layers[leafId];if(layer)layer.fire('click',{latlng:L.latLng(e.lngLat.lat,e.lngLat.lng)});});
  }
  clearTimeout(loadTimer);loaded=true;installControls();changeBackground();
  modelMap.flyToBounds=flyBounds;modelMap.fitBounds=flyBounds;
modelMap.flyTo=(coords,zoom,options={})=>flyBounds(L.latLngBounds([coords,coords]),{...options,maxZoom:zoom});
modelMap.zoomIn=()=>{view.zoomIn({duration:350});return modelMap;};modelMap.zoomOut=()=>{view.zoomOut({duration:350});return modelMap;};
tiles.forEach(layer=>modelMap.removeLayer(layer));

  oldMap.setAttribute('aria-hidden','true');oldMap.inert=true;el.style.visibility='';
  ready.textContent='3D terrain';ready.title='3D elevation · tilt and rotate with right-drag';
  window.MineScope3D={refresh:scheduleRefresh,view,read:()=>({loaded,background,pitch:view.getPitch(),zoom:view.getZoom(),bearing:view.getBearing(),center:view.getCenter(),terrain:view.getTerrain(),markers:markers3d.size,area:S.read().filters.area})};
  document.body.classList.add('terrain-ready');
  const current=areas.find(a=>a.id===S.read().filters.area);
  if(!camera)flyBounds(current?L.latLngBounds([current.coords,current.coords]):L.latLngBounds(areas.map(a=>a.coords)),{animate:false,maxZoom:12});refresh();
  }catch(error){showFallback(error);}
});
window.addEventListener('minescope:filters',scheduleRefresh);
document.addEventListener('visibilitychange',scheduleRefresh);
modelMap.on('layeradd layerremove',scheduleRefresh);
observer=new MutationObserver(scheduleRefresh);observer.observe(document.querySelector('#inspector'),{childList:true,attributes:true,attributeFilter:['hidden']});
resizeObserver=new ResizeObserver(()=>{if(!disposed){view.resize();if(loaded){drawConnector();scheduleRefresh();}}});resizeObserver.observe(shell);
}
void startTerrain();
