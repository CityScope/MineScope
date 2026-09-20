/* Geographic context is read from SIMBIO, never bundled with the site. */
(() => {
  'use strict';
  const root='https://arcgis.mma.gob.cl/server/rest/services/SIMBIO/';
  const territory='-71.65,-29.75,-70.75,-29.05';
  const protectedNames={
    'WDPA-239':['Humboldt Archipelago','Multiple-use conservation area'],
    'WDPA-115':['Humboldt Penguin','National reserve'],
    'WDPA-064':['Choros–Damas Islands','Marine reserve'],
    'WDPA-063':['Chañaral Island','Marine reserve'],
    'WDPA-208':['La Boca wetland','Nature sanctuary'],
    'WDPA-243':['Cruz Grande','Nature sanctuary']
  };
  const catchmentNames={'0411':'El Pelícano','0400':'Carrizalillo–Los Choros coast','0396':'Carrizalillo','0402':'Gaviota Island','0410':'Upper Los Choros','0401':'Damas Island','0394':'Chañaral','0420':'Los Choros–Elqui coast','0433':'Lower Elqui','0432':'Middle Elqui','0403':'Choros Island','0412':'Lower Los Choros'};
  const definitions={
    protected:{title:'Protected areas',service:'SIMBIO_AP/MapServer/0',
      fields:'OBJECTID,Codrnap,NombreOriginal,designacion,SuperficieDecreto,AnoInicioProteccion,URL_SIMBIO',
      where:`Codrnap IN (${Object.keys(protectedNames).map(code=>`'${code}'`).join(',')})`,
      description:'Humboldt Archipelago, island reserves and protected coastal sites.',
      sourceURL:'https://simbio.mma.gob.cl/CbaAP/Details/2082',offset:.00005},
    watercourses:{title:'Watercourses',service:'SIMBIO_HIDROGRAFIA/MapServer/0',
      fields:'OBJECTID,NOMBRE,TIPO_DREN',description:'Drainage channels around Dominga, Los Choros and La Higuera.',offset:.00015},
    catchments:{title:'Catchments',service:'SIMBIO_DIVISION_CUENCA/MapServer/1',
      fields:'OBJECTID,COD_SUBC,NOM_SUBC,Area_km2,URL_SIMBIO',description:'Drainage divides from the inland hills to the coast.',offset:.00015}
  };
  const states={};
  const safeRecordURL=(value,fallback)=>typeof value==='string'&&/^https:\/\/simbio\.mma\.gob\.cl\/(CbaAP|SubCuencas)\/Details\/[\w-]+$/.test(value)?value:fallback;
  const number=value=>Number(value).toLocaleString('en',{maximumFractionDigits:1});
  function style(id,feature){
    const color=layers.find(layer=>layer.id===id).color;
    if(id==='protected')return {color,weight:1.1,opacity:.65,dashArray:'1 5',lineCap:'round',fill:false};
    if(id==='watercourses')return {color,weight:1.35,opacity:.68};
    return {color,weight:1.3,opacity:.68,dashArray:'5 6',fill:false};
  }
  function describe(id,properties){
    if(id==='protected'){
      const names=protectedNames[properties.Codrnap]||[properties.NombreOriginal,'Protected area'];
      return {name:names[0],kind:names[1],sourceName:properties.NombreOriginal,area:properties.SuperficieDecreto,unit:'ha',year:properties.AnoInicioProteccion};
    }
    if(id==='catchments')return {name:catchmentNames[properties.COD_SUBC]||properties.NOM_SUBC,kind:'Catchment',sourceName:properties.NOM_SUBC,area:properties.Area_km2,unit:'km²'};
    const name=String(properties.NOMBRE||'').trim();
    return {name:name||'Drainage channel',kind:'Watercourse',sourceName:name,named:!!name};
  }
  function statusMarkup(id){
    const state=states[id];
    if(state.status==='loading')return '<p class="geography-status" role="status">Loading map data…</p>';
    if(state.status==='error')return '<div class="geography-status" role="status"><p>Map data could not load.</p><button class="button full" id="retry-geography">Try again</button></div>';
    return '';
  }
  function show(id){
    const def=definitions[id],state=states[id];
    const entries=state.records.filter(record=>id!=='watercourses'||record.named);
    const unique=[...new Map(entries.map(record=>[record.name,record])).values()];
    if(id!=='protected')unique.sort((a,b)=>a.name.localeCompare(b.name));
    else unique.sort((a,b)=>Object.keys(protectedNames).indexOf(a.properties.Codrnap)-Object.keys(protectedNames).indexOf(b.properties.Codrnap));
    setInspector(`<div class="inspector-head">${closeButton()}<div class="eyebrow">GEOGRAPHY</div><h2>${def.title}</h2></div><div class="inspector-body"><p>${def.description}</p>${statusMarkup(id)}<div class="geography-list">${unique.map(record=>`<button class="geography-place" data-geography-record="${esc(record.key)}"><strong>${esc(record.name)}</strong><span>${esc(record.kind)} <b>↗</b></span></button>`).join('')}</div><div class="geography-source">${sourceLink('geography-'+id)}</div></div>`,'geo-layer:'+id);
    document.querySelectorAll('[data-geography-record]').forEach(button=>button.onclick=()=>focusRecord(id,button.dataset.geographyRecord));
    if($('#retry-geography'))$('#retry-geography').onclick=()=>load(id);
  }
  function showRecord(id,record){
    const url=safeRecordURL(record.properties.URL_SIMBIO,root+definitions[id].service);
    setInspector(`<div class="inspector-head">${closeButton()}<div class="eyebrow">${esc(record.kind.toUpperCase())}</div><h2>${esc(record.name)}</h2></div><div class="inspector-body">${Number.isFinite(record.area)?`<div class="stat-grid"><div><strong>${number(record.area)} <small>${record.unit}</small></strong><span>${id==='protected'?'Recorded area':'Catchment area'}</span></div></div>`:''}${record.year?`<p>Protected since ${esc(record.year)}.</p>`:''}${record.sourceName?`<p class="source-note">${esc(record.sourceName)}</p>`:''}<a class="source-link" href="${esc(url)}" target="_blank" rel="noopener">Government map record ↗</a><button class="button full" id="geography-back">← ${definitions[id].title}</button></div>`,'geo-record:'+id+':'+record.key);
    $('#geography-back').onclick=()=>show(id);
  }
  function focusRecord(id,key){
    const record=states[id].records.find(item=>item.key===key);
    if(!record)return;
    setLayer(id,true);
    if(activeTab==='layers')renderLayers();
    showRecord(id,record);
    const bounds=L.latLngBounds([]);
    states[id].records.filter(item=>id==='watercourses'?item.name===record.name:item===record).forEach(item=>bounds.extend(item.layer.getBounds()));
    map.flyToBounds(bounds,{...mapFocusPadding(),maxZoom:id==='protected'?13:12,duration:.7});
    if(mobileQuery.matches)setSidebar(false);
  }
  async function request(def){
    const params=new URLSearchParams({where:def.where||'1=1',outFields:def.fields,outSR:'4326',returnGeometry:'true',geometryPrecision:'5',maxAllowableOffset:String(def.offset),orderByFields:'OBJECTID',f:'geojson'});
    if(!def.where)Object.entries({geometry:territory,geometryType:'esriGeometryEnvelope',inSR:'4326',spatialRel:'esriSpatialRelIntersects'}).forEach(([key,value])=>params.set(key,value));
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),25000);
    try{
      const response=await fetch(root+def.service+'/query?'+params,{signal:controller.signal,credentials:'omit'});
      if(!response.ok)throw Error('Map service unavailable');
      const data=await response.json();
      if(data.type!=='FeatureCollection'||!Array.isArray(data.features)||!data.features.length||data.exceededTransferLimit||data.properties?.exceededTransferLimit)throw Error('Incomplete map data');
      const coordinatesValid=value=>Array.isArray(value)&&(typeof value[0]==='number'?value.length>=2&&Number.isFinite(value[0])&&Number.isFinite(value[1])&&Math.abs(value[0])<=180&&Math.abs(value[1])<=90:value.length>0&&value.every(coordinatesValid));
      if(data.features.some(feature=>!['Polygon','MultiPolygon','LineString','MultiLineString'].includes(feature.geometry?.type)||!coordinatesValid(feature.geometry.coordinates)||!feature.properties))throw Error('Invalid map geometry');
      return data;
    }finally{clearTimeout(timeout);}
  }
  async function load(id){
    const state=states[id],def=definitions[id];
    if(state.status==='loading')return;
    state.status='loading';
    updateStatus();
    if(selected==='geo-layer:'+id)show(id);
    try{
      const data=await request(def);
      if(id==='protected'&&!data.features.some(feature=>feature.properties.Codrnap==='WDPA-239'))throw Error('Humboldt boundary unavailable');
      const records=[];
      const geometry=L.geoJSON(data,{
        renderer:contextRenderer,smoothFactor:1,
        style:feature=>style(id,feature),
        onEachFeature(feature,layer){
          const record={...describe(id,feature.properties),key:String(feature.properties.OBJECTID),properties:feature.properties,layer};
          records.push(record);
          layer.bindTooltip(esc(record.name),{sticky:true,className:'map-label'});
          layer.on('click',event=>{if(placing)openNote(event.latlng);else showRecord(id,record);});
        }
      });
      groups[id].clearLayers();geometry.addTo(groups[id]);orderGeography();
      state.records=records;state.status='ready';state.loadedAt=new Date().toISOString();
      if(id==='protected')officialBoundary=true;
    }catch{
      state.status='error';
      if(id==='protected')officialBoundary=false;
    }
    updateStatus();
    if(selected==='geo-layer:'+id)show(id);
  }
  function updateStatus(){
    for(const [id,state] of Object.entries(states)){
      const row=document.querySelector(`[data-info="${id}"]`);
      if(!row)continue;
      row.dataset.loadState=state.status;
      row.title=state.status==='error'?'Map data could not load. Open to retry.':state.status==='loading'?'Loading map data':definitions[id].title;
    }
  }
  function orderGeography(){
    // One canvas keeps transparent map areas clickable. Geographic context sits
    // below project links and note markers, with waterways above the boundary outlines.
    ['watercourses','protected','catchments'].forEach(id=>groups[id].eachLayer(layer=>layer.bringToBack()));
  }
  for(const [id,def] of Object.entries(definitions)){
    states[id]={status:'idle',records:[]};
    sources.push({id:'geography-'+id,title:[def.title+' · SIMBIO'],type:['GOVERNMENT MAP SERVICE'],description:[def.description+' Loaded directly from the Ministry of the Environment’s SIMBIO service.'],date:['Live map service'],url:def.sourceURL||root+def.service});
    groups[id].on('add',orderGeography);
    groups[id].on('add',()=>map.attributionControl.addAttribution('<a href="https://simbio.mma.gob.cl/" target="_blank" rel="noopener">MMA · SIMBIO</a>'));
    groups[id].on('remove',()=>map.attributionControl.removeAttribution('<a href="https://simbio.mma.gob.cl/" target="_blank" rel="noopener">MMA · SIMBIO</a>'));
    if(map.hasLayer(groups[id]))map.attributionControl.addAttribution('<a href="https://simbio.mma.gob.cl/" target="_blank" rel="noopener">MMA · SIMBIO</a>');
  }
  const previousRenderLayers=renderLayers;
  renderLayers=function(){previousRenderLayers();updateStatus();};
  window.MineScopeGeography={hasLayer:id=>Object.hasOwn(definitions,id),show,
    read:()=>Object.fromEntries(Object.entries(states).map(([id,state])=>[id,{status:state.status,features:state.records.length,source:root+definitions[id].service,loadedAt:state.loadedAt||null}]))};
  if(activeTab==='layers')renderLayers();
  if(activeTab==='evidence')renderEvidence();
  Object.keys(definitions).forEach(load);
})();
