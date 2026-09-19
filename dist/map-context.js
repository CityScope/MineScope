'use strict';
(() => {
  const link=(label,url)=>`<a href="${url}" target="_blank" rel="noopener">${label}</a>`;
  // Convert the terrain luminance to slate blue and keep blue water dark.
  document.body.insertAdjacentHTML('beforeend', `<svg width="0" height="0" aria-hidden="true" focusable="false" style="position:absolute;pointer-events:none"><defs><filter id="night-terrain" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values=".425 -.386 -.579 0 .606 .491 -.447 -.669 0 .701 .558 -.507 -.760 0 .814 0 0 0 1 0"/></filter></defs></svg>`);
  const outdoors=L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',{
    maxNativeZoom:17,maxZoom:19,
    attribution:`${link('World Topographic Map','https://services.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer')}: Esri, HERE, Garmin, Intermap, increment P, GEBCO, USGS, FAO, NPS, NRCAN, GeoBase, IGN, Kadaster NL, Ordnance Survey, Esri Japan, METI, Esri China, © ${link('OpenStreetMap','https://www.openstreetmap.org/copyright')} contributors, GIS user community`
  });
  const topography=L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',{
    subdomains:'abc',maxNativeZoom:17,maxZoom:19,
    attribution:`Map data: © ${link('OpenStreetMap','https://www.openstreetmap.org/copyright')} contributors, SRTM | Map style: © ${link('OpenTopoMap','https://opentopomap.org')} (CC-BY-SA)`
  });
  const backgrounds={
    night:{title:'Night terrain',layer:outdoors,source:'Esri World Topographic Map',url:'https://services.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer',description:'Shaded hills, roads, settlements and waterways in a dark blue-gray palette.',detail:'Esri topographic tiles, with a color treatment for MineScope.'},
    satellite:{title:'Satellite',layer:satellite,source:'Esri World Imagery',url:'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer',description:'Satellite and aerial imagery of the land and coast.',detail:'Imagery dates and resolution vary by location.'},
    streets:{title:'Map',layer:streets,source:'OpenStreetMap',url:'https://www.openstreetmap.org/copyright',description:'Roads, settlements, place names and mapped land features.',detail:'A map maintained by OpenStreetMap contributors.'},
    topography:{title:'Topography',layer:topography,source:'OpenTopoMap · OpenStreetMap · SRTM',url:'https://wiki.opentopomap.org/about',description:'Contour lines, shaded terrain, roads and settlements in one map.',detail:'OpenStreetMap features and SRTM elevation data. Map style: CC-BY-SA.'},
  };
  let current='night';
  function setBasemap(id){
    if(!backgrounds[id])throw Error('Unknown background map');
    Object.values(backgrounds).forEach(b=>{if(map.hasLayer(b.layer))map.removeLayer(b.layer)});
    current=id;backgrounds[id].layer.addTo(map).bringToBack();
    document.querySelector('.map-shell').dataset.basemap=id;
    $('#background-map').value=id;
    $('#background-info').setAttribute('aria-label',`About the ${backgrounds[id].title.toLowerCase()} background`);
    $('#tile-error').hidden=true;
  }
  Object.values(backgrounds).forEach(b=>{
    let failed=false;
    b.layer.on('loading',()=>{failed=false});
    b.layer.on('tileerror',()=>{failed=true;if(map.hasLayer(b.layer)){$('#tile-error').textContent=`Some ${b.title.toLowerCase()} tiles could not load. Choose another background or try again. Your map layers remain available.`;$('#tile-error').hidden=false}});
    b.layer.on('load',()=>{if(map.hasLayer(b.layer)&&!failed)$('#tile-error').hidden=true});
  });
  $('#background-map').onchange=e=>setBasemap(e.target.value);
  $('#background-info').onclick=()=>{
    const b=backgrounds[current];
    openModal(`<div class="eyebrow">MAP BACKGROUND</div><h2>${b.title}</h2><p>${b.description}</p><div class="source-entry"><strong>${b.source}</strong><span>${b.detail}</span></div><a class="button dark full source-open" href="${b.url}" target="_blank" rel="noopener">Open source ↗</a>`);
  };
  sources.push(...['night','topography'].map(id=>{
    const b=backgrounds[id];return {id:'background-'+id,title:[b.source],type:['MAP BACKGROUND'],description:[b.description+' '+b.detail],date:['Online map service · checked 18 Sep 2026'],url:b.url};
  }));

  if(activeTab==='evidence')renderEvidence();
  setBasemap('night');
  renderLegend();
})();
