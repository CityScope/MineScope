import * as ml from './vendor/maplibre-gl.mjs';

// Terrain renderer using the existing panels, records and replay model.
const A=window.MineScopeActivity,S=window.MineScopeSim,areas=window.MineScopeSimulation.areas;
const colors=A.colors,order=['concerned','hopeful','mixed','neutral'];
const modelMap=map, shell=document.querySelector('.map-shell');
const style=await (await fetch('https://tiles.openfreemap.org/styles/dark')).json();
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
const el=document.createElement('div');el.id='terrain-view';shell.prepend(el);
const view=new ml.Map({container:el,style,center:[-71.25,-29.38],zoom:10.1,pitch:58,bearing:-14,maxPitch:78,minZoom:8,maxZoom:16,attributionControl:false,antialias:true,renderWorldCopies:false});
view.addControl(new ml.AttributionControl({compact:true}),'bottom-right');
view.touchZoomRotate.enableRotation();
const ready=document.createElement('span');ready.className='terrain-status';ready.textContent='Loading terrain…';document.querySelector('.app-status').prepend(ready);
const oldMap=document.querySelector('#map');oldMap.setAttribute('aria-hidden','true');oldMap.inert=true;
const bg=document.querySelector('#background-map');bg.innerHTML='<option value="night">Night terrain</option><option value="satellite">Satellite</option>';
let loaded=false,background='night',lastTime=A.time(),markers3d=new Map(),arrivals=[],flightToken=0;
const heat=window.MineScopeHeatField.create(A.records);
const fc=features=>({type:'FeatureCollection',features});
const pointFeature=(coords,properties)=>({type:'Feature',geometry:{type:'Point',coordinates:[coords[1],coords[0]]},properties});
const setData=(id,features)=>view.getSource(id)?.setData(fc(features));
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
  entry.pin.setLngLat([coords[1],coords[0]]);return entry;
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
function refresh(){
  if(!loaded)return;
  const state=S.read(),items=S.items(),visibleIDs=new Set(),individual=state.mode==='notes'||view.getZoom()>=13.4,regional=view.getZoom()<11.35,heatOn=A.state.heat!=='none';
  const onScreen=note=>{const p=view.project([note.coords[1],note.coords[0]]);return Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=-40&&p.y>=-40&&p.x<=el.clientWidth+40&&p.y<=el.clientHeight+40;};
  if(!heatOn){
    if(individual){for(const n of items.filter(onScreen)){const id='note:'+n.id;visibleIDs.add(id);const p=marker(id,n.coords,noteHTML(n),'terrain-note',()=>showFeature(n.id));p.node.setAttribute('aria-label',`${A.labels[n.platform]}: ${n.text[0]}`);}}
    else if(regional) for(const area of areas){const subset=items.filter(n=>n.area===area.id);if(!subset.length)continue;const id='area:'+area.id;visibleIDs.add(id);const p=marker(id,area.coords,ring(subset)+`<span class="terrain-place-label">${escapeText(area.name)}</span>`,'terrain-cluster',()=>{S.visitArea(area.id);window.MineScopeUnity?.select(area.id);});p.node.setAttribute('aria-label',`${area.name}, ${subset.length} notes`);p.node.classList.toggle('current',state.filters.area===area.id);p.noteIDs=new Set(subset.map(n=>n.id));p.radius=28;p.items=subset;}
    else {
      const cells=new Map();
      for(const note of items.filter(onScreen)){const p=view.project([note.coords[1],note.coords[0]]),key=`${Math.floor(p.x/90)}:${Math.floor(p.y/90)}:${note.sentiment}`;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(note);}
      for(const [key,subset] of cells){const sentiment=subset[0].sentiment,slot=order.indexOf(sentiment),grid=key.split(':').map(Number),anchor=view.unproject([grid[0]*90+45,grid[1]*90+45]),coords=[anchor.lat,anchor.lng],id='cell:'+key;
        visibleIDs.add(id);const entry=marker(id,coords,`<span class="terrain-cell-ring" style="--sentiment:${colors[sentiment]}"><small>${['−','+','≈','?'][slot]}</small><strong>${subset.length}</strong></span>`,'terrain-cell',()=>{showFeature(subset[0].id);flyBounds(L.latLngBounds(subset.map(n=>n.coords)),{maxZoom:15});});
        entry.pin.setOffset([(slot%2)*38-19,Math.floor(slot/2)*38-19]);entry.noteIDs=new Set(subset.map(n=>n.id));entry.radius=16;entry.items=subset;entry.node.setAttribute('aria-label',`${subset.length} ${sentiment==='neutral'?'question':sentiment} notes`);
      }
    }
  }
  for(const feature of [...features,...notes.map(noteFeature)]){
    if(!layers.find(l=>l.id===feature.layer)?.on)continue;
    const id='feature:'+feature.id;visibleIDs.add(id);const color=layers.find(l=>l.id===feature.layer).color;
    const p=marker(id,feature.coords,`<span class="terrain-feature" style="--feature-color:${color}">${feature.mark}</span>`,'terrain-feature-marker',()=>showFeature(feature.id));p.node.setAttribute('aria-label',feature.title[0]);p.node.title=feature.title[0];p.pin.setOffset(feature.layer==='community'&&regional?[-38,32]:[0,0]);
  }
  const chosen=A.records.find(n=>n.id===selected);
  if(chosen&&!document.querySelector('#inspector').hidden){visibleIDs.add('selected');marker('selected',chosen.coords,noteHTML(chosen,true),'terrain-selected-marker',()=>{}).node.setAttribute('aria-label','Selected note');document.querySelector('#terrain-connector').style.setProperty('--comment-color',colors[chosen.sentiment]);}
  for(const [id,entry] of markers3d)if(!visibleIDs.has(id)){entry.pin.remove();markers3d.delete(id);}
  setData('note-dots',!heatOn&&!individual?items.map(n=>pointFeature(n.coords,{color:colors[n.sentiment]})):[]);
  if(heatOn){clearArrivals();const cells=heat.evaluate(items,A.state.heat);setData('heat-cells',cells.map(cell=>({type:'Feature',properties:{color:`rgb(${cell.color.join(',')})`,opacity:cell.opacity},geometry:{type:'Polygon',coordinates:[[...cell.corners,cell.corners[0]].map(p=>[p[1],p[0]])]}})));}else setData('heat-cells',[]);
  const now=A.time();
  if(A.state.playing&&now>lastTime&&!heatOn){const incoming=items.filter(n=>Date.parse(n.collectedAt)>lastTime&&Date.parse(n.collectedAt)<=now).slice(-4);incoming.forEach(n=>addArrival(n));}
  if(now<lastTime)clearArrivals();lastTime=now;
  drawConnector();syncGeography();
}
function clearArrivals(){arrivals.forEach(a=>a.pin.remove());arrivals=[];}
function addArrival(note){
  const counter=[...markers3d.values()].find(p=>p.noteIDs?.has(note.id)),radius=counter?.radius||9,arc=counter?window.MineScopeArrivalLayout.segment(counts(counter.items),note.sentiment):null;
  const angle=counter?.radius===16?order.indexOf(note.sentiment)*Math.PI/2:(arc?(arc.start+arc.end)/2:0),r=radius+23,dx=Math.sin(angle)*r,dy=-Math.cos(angle)*r;
  const node=document.createElement('div');node.className='terrain-arrival';node.style.setProperty('--sentiment',colors[note.sentiment]);
  node.innerHTML=`<svg aria-hidden="true"><path d="M ${Math.sin(angle)*radius} ${-Math.cos(angle)*radius} L ${dx} ${dy}"/></svg><button class="arrival-badge" aria-label="New ${note.sentiment} note" style="left:${dx-9}px;top:${dy-9}px">${A.icon(note.platform)}</button>`;
  node.querySelector('button').onclick=()=>showFeature(note.id);
  const coords=counter?counter.pin.getLngLat():[note.coords[1],note.coords[0]],offset=counter?counter.pin.getOffset():[0,0];
  const pin=new ml.Marker({element:node,anchor:'center',occludedOpacity:0,offset}).setLngLat(coords).addTo(view);
  const entry={pin};arrivals.push(entry);setTimeout(()=>{pin.remove();arrivals=arrivals.filter(a=>a!==entry);},2400);
}
function syncGeography(){
  for(const id of ['protected','watercourses','catchments','infrastructure']){
    const visible=layers.find(l=>l.id===id).on;
    view.setLayoutProperty('context-'+id,'visibility',visible?'visible':'none');
    if(!visible)continue;
    const list=[];
    function collect(layer){if(layer instanceof L.Polyline){const data=layer.toGeoJSON();data.properties={...data.properties,leafletId:L.stamp(layer)};list.push(data);}else if(layer.eachLayer)layer.eachLayer(collect);}
    groups[id].eachLayer(collect);
    const signature=list.length+':'+list.map(f=>f.properties.leafletId).join(',');
    if(view.getSource('context-'+id)._mineScopeSignature!==signature){setData('context-'+id,list);view.getSource('context-'+id)._mineScopeSignature=signature;}
  }
}
function syncModel(){
  const center=view.getCenter();originalSetView.call(modelMap,[center.lat,center.lng],view.getZoom()+1,{animate:false});
}
const originalSetView=modelMap.setView;
function flyBounds(bounds,options={}){
  const b=L.latLngBounds(bounds),center=b.getCenter(),point=b.getSouthWest().equals(b.getNorthEast()),overview=!point&&S.read().filters.area==='all'&&b.getNorth()-b.getSouth()>.2;
  clearArrivals();const token=++flightToken;
  const area=areas.find(a=>a.id===S.read().filters.area),bearings={choros:38,'los-choros':56,totoralillo:20,higuera:35,trapiche:55,negrillo:15};
  let camera;
  if(overview)camera={center:[-71.27,-29.40],zoom:9.95,pitch:54,bearing:-12,padding:padding()};
  else if(point)camera={center:[center.lng,center.lat],zoom:Math.min(14,(options.maxZoom||12)+1.15),pitch:58,bearing:bearings[area?.id]??28,padding:padding()};
  else camera={...view.cameraForBounds([[b.getWest(),b.getSouth()],[b.getEast(),b.getNorth()]],{padding:padding(),maxZoom:(options.maxZoom||13)-1}),pitch:58};
  if(!loaded||options.animate===false)view.jumpTo(camera);else view.flyTo({...camera,duration:document.querySelector('#demo-status').hidden?2200:4200,curve:1.05,minZoom:Math.min(12.4,view.getZoom()),essential:false});
  view.once('moveend',()=>{if(token===flightToken){syncModel();refresh();}});
  return modelMap;
}
modelMap.flyToBounds=flyBounds;modelMap.fitBounds=flyBounds;
modelMap.flyTo=(coords,zoom,options={})=>flyBounds(L.latLngBounds([coords,coords]),{...options,maxZoom:zoom});
modelMap.zoomIn=()=>{view.zoomIn({duration:350});return modelMap;};modelMap.zoomOut=()=>{view.zoomOut({duration:350});return modelMap;};
modelMap.eachLayer(layer=>{if(layer instanceof L.TileLayer)modelMap.removeLayer(layer);});
function changeBackground(){
  background=bg.value;shell.dataset.basemap=background;document.body.dataset.terrainBackground=background;
  view.setLayoutProperty('satellite-image','visibility',background==='satellite'?'visible':'none');
  view.setPaintProperty('terrain-shading','hillshade-exaggeration',background==='satellite'?.18:.65);
  view.setPaintProperty('terrain-shading','hillshade-shadow-color',background==='satellite'?'#181c22':'#020712');
  view.setPaintProperty('terrain-shading','hillshade-highlight-color',background==='satellite'?'#ece0c5':'#71899f');
  view.setSky({'sky-color':background==='satellite'?'#3c6f96':'#111e31','horizon-color':background==='satellite'?'#cfdfdf':'#667e94','fog-color':background==='satellite'?'#8199a8':'#172b42','sky-horizon-blend':.6,'horizon-fog-blend':.6,'fog-ground-blend':.5});
}
bg.onchange=changeBackground;
document.querySelector('#background-info').onclick=()=>openModal(`<div class="eyebrow">3D MAP</div><h2>${background==='night'?'Night terrain':'Satellite'}</h2><p>Terrain comes from Mapterhorn and Copernicus elevation data. Elevation tiles load from the original provider. Terrain is shown at 1.35× vertical scale.</p><p>${background==='night'?'Map labels and roads load from OpenFreeMap and OpenStreetMap.':'Satellite imagery streams from Esri and its imagery providers.'}</p><p>Drag to move. Right-drag or Control-drag to tilt and rotate.</p><a class="source-link" href="https://mapterhorn.com/attribution/" target="_blank">Terrain sources ↗</a>`);
const angle=document.createElement('button');angle.className='terrain-angle';angle.title='Switch between an overhead and angled view';angle.setAttribute('aria-label','Switch to overhead view');angle.textContent='3D';document.querySelector('.leaflet-control-zoom').after(angle);
angle.onclick=()=>{const tilted=view.getPitch()>15;view.easeTo({pitch:tilted?0:62,duration:900});};
view.on('pitch',()=>{const tilted=view.getPitch()>15;angle.textContent=tilted?'3D':'2D';angle.setAttribute('aria-label',tilted?'Switch to overhead view':'Switch to angled view');});
shell.insertAdjacentHTML('beforeend','<svg id="terrain-connector" class="terrain-connector" hidden aria-hidden="true"><path/></svg>');
view.on('move',drawConnector);
view.on('moveend',()=>{syncModel();refresh();});
view.on('click',e=>{if(placing)openNote(L.latLng(e.lngLat.lat,e.lngLat.lng));else if(mobileQuery.matches)setSidebar(false);});
view.on('error',e=>{console.warn('3D map:',e.error?.message||e);if(!loaded)ready.textContent='Loading terrain…';});
view.on('load',()=>{
  for(const id of ['note-dots','heat-cells'])view.addSource(id,{type:'geojson',data:fc([])});
  view.addLayer({id:'heat-field',type:'fill',source:'heat-cells',paint:{'fill-color':['get','color'],'fill-opacity':['get','opacity']}});
  view.addLayer({id:'note-dots',type:'circle',source:'note-dots',paint:{'circle-color':['get','color'],'circle-radius':2,'circle-opacity':.5}});
  for(const id of ['protected','watercourses','catchments','infrastructure']){
    view.addSource('context-'+id,{type:'geojson',data:fc([])});
    const paint={'line-color':layers.find(l=>l.id===id).color,'line-width':id==='protected'?1:1.3,'line-opacity':id==='protected'?.55:.6};if(id==='protected')paint['line-dasharray']=[1,5];if(id==='catchments'||id==='infrastructure')paint['line-dasharray']=[4,5];
    view.addLayer({id:'context-'+id,type:'line',source:'context-'+id,paint});
    view.on('click','context-'+id,e=>{if(placing)return;const leafId=e.features?.[0]?.properties.leafletId;const layer=modelMap._layers[leafId];if(layer)layer.fire('click',{latlng:L.latLng(e.lngLat.lat,e.lngLat.lng)});});
  }
  loaded=true;ready.textContent='3D terrain';ready.title='3D elevation · tilt and rotate with right-drag';
  window.MineScope3D={refresh,view,read:()=>({loaded,background,pitch:view.getPitch(),zoom:view.getZoom(),bearing:view.getBearing(),center:view.getCenter(),terrain:view.getTerrain(),markers:markers3d.size,area:S.read().filters.area})};
  document.body.classList.add('terrain-ready');
  const current=areas.find(a=>a.id===S.read().filters.area);
  flyBounds(current?L.latLngBounds([current.coords,current.coords]):L.latLngBounds(areas.map(a=>a.coords)),{animate:false,maxZoom:12});refresh();
  setInterval(()=>{if(!document.hidden)refresh();},1000);
});
window.addEventListener('minescope:filters',()=>{if(loaded)refresh();});
new MutationObserver(()=>{if(loaded){requestAnimationFrame(refresh);}}).observe(document.querySelector('#inspector'),{childList:true,attributes:true,attributeFilter:['hidden']});
new ResizeObserver(()=>{view.resize();drawConnector();}).observe(shell);
