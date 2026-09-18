'use strict';
(() => {
  const link=(label,url)=>`<a href="${url}" target="_blank" rel="noopener">${label}</a>`;
  const topography=L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',{
    subdomains:'abc',maxNativeZoom:17,maxZoom:19,
    attribution:`Map data: © ${link('OpenStreetMap','https://www.openstreetmap.org/copyright')} contributors, SRTM | Map style: © ${link('OpenTopoMap','https://opentopomap.org')} (CC-BY-SA)`
  });
  const relief=L.tileLayer('https://services.arcgisonline.com/arcgis/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}',{
    maxNativeZoom:13,maxZoom:19,
    attribution:`${link('World Hillshade','https://www.arcgis.com/home/item.html?id=1b243539f4514b6ba35e7d995890db1d')}: Esri, Vantor, Airbus DS, USGS, NGA, NASA, CGIAR, N Robinson, NCEAS, NLS, OS, NMA, Geodatastyrelsen, Rijkswaterstaat, GSA, Geoland, FEMA, Intermap, GIS user community`
  });
  const seafloor=L.tileLayer.wms('https://wms.gebco.net/mapserv',{
    layers:'GEBCO_LATEST',format:'image/png',transparent:false,version:'1.3.0',
    maxNativeZoom:11,maxZoom:19,keepBuffer:1,
    attribution:`Imagery: ${link('GEBCO_2026 Grid','https://doi.org/10.5285/4f68d5c7-45eb-f999-e063-7086abc036fa')} · GEBCO Bathymetric Compilation Group (2026) · Not for navigation`
  });
  const backgrounds={
    satellite:{title:'Satellite',layer:satellite,source:'Esri World Imagery',url:'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer',description:'Satellite and aerial imagery of the land and coast.',detail:'Imagery dates and resolution vary by location.'},
    streets:{title:'Map',layer:streets,source:'OpenStreetMap',url:'https://www.openstreetmap.org/copyright',description:'Roads, settlements, place names and mapped land features.',detail:'A map maintained by OpenStreetMap contributors.'},
    topography:{title:'Topography',layer:topography,source:'OpenTopoMap · OpenStreetMap · SRTM',url:'https://wiki.opentopomap.org/about',description:'Contour lines, shaded terrain, roads and settlements in one map.',detail:'OpenStreetMap features and SRTM elevation data. Map style: CC-BY-SA.'},
    relief:{title:'Relief',layer:relief,source:'Esri World Hillshade',url:'https://www.arcgis.com/home/item.html?id=1b243539f4514b6ba35e7d995890db1d',description:'A shaded view of ridges, valleys and slopes, with a quiet background for the other layers.',detail:'Global terrain shading from Esri World Hillshade. Available under Esri terms.'},
    seafloor:{title:'Seafloor',layer:seafloor,source:'GEBCO global grid',url:'https://www.gebco.net/data-products/gebco-web-services/web-map-service',description:'Land elevation and ocean depth, showing the coastal shelf and the deeper Pacific seafloor.',detail:'GEBCO 2026 elevation and ocean depth. The grid combines measured and estimated depths at roughly 400–460 metre spacing here. Not for navigation.'}
  };
  let current='satellite';
  function setBasemap(id){
    if(!backgrounds[id])throw Error('Unknown background map');
    Object.values(backgrounds).forEach(b=>{if(map.hasLayer(b.layer))map.removeLayer(b.layer)});
    current=id;backgrounds[id].layer.addTo(map).bringToBack();
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
  sources.push(...['topography','relief','seafloor'].map(id=>{
    const b=backgrounds[id];return {id:'background-'+id,title:[b.source],type:['MAP BACKGROUND'],description:[b.description+' '+b.detail],date:['Online map service · checked 18 Sep 2026'],url:b.url};
  }));

  if(activeTab==='evidence')renderEvidence();
  setBasemap('satellite');
  renderLegend();
})();
