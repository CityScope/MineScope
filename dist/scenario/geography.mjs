import {corners,envelope,bounds,normalizedToGeo,geoToLocal,geoToNormalized,inside} from './extent.mjs?v=20261007-ws-status1';
import {sampleGrid,projectFeatures,lineSegments} from './geography-core.mjs?v=20261007-ws-status1';

const services='https://arcgis.mma.gob.cl/server/rest/services/SIMBIO/';
export const sources={
  elevation:'https://registry.opendata.aws/terrain-tiles/',
  water:services+'SIMBIO_HIDROGRAFIA/MapServer/0',
  protected:services+'SIMBIO_AP/MapServer/0',
  land:services+'SIMBIO_COT/MapServer/1',
  catchments:services+'SIMBIO_DIVISION_CUENCA/MapServer/1',
  settlements:'https://www.openstreetmap.org/copyright'
};
async function fetchData(url,timeout=20000) {
  const response=await fetch(url,{signal:AbortSignal.timeout(timeout)});
  if(!response.ok)throw new Error(`Source returned ${response.status}`);
  return response;
}
export async function queryFeatures(service,where='1=1') {
  const features=[];
  for(let offset=0;offset<20000;offset+=2000) {
    const params=new URLSearchParams({f:'geojson',where,geometry:envelope.join(','),geometryType:'esriGeometryEnvelope',inSR:'4326',outSR:'4326',spatialRel:'esriSpatialRelIntersects',outFields:'*',returnGeometry:'true',maxAllowableOffset:'.0002',orderByFields:'OBJECTID',resultOffset:String(offset),resultRecordCount:'2000'});
    let data;
    for(let attempt=0;attempt<2;attempt++) {
      try{data=await (await fetchData(service+'/query?'+params,30000)).json();break;}catch(error){if(attempt)throw error;}
    }
    if(data.error||!Array.isArray(data.features))throw new Error(data.error?.message||'Invalid geographic response');
    features.push(...data.features);
    if(!data.exceededTransferLimit&&data.features.length<2000)return projectFeatures({features});
  }
  throw new Error('Geographic source exceeded the supported record limit');
}
export const mercatorPixel=({lat,lon},zoom)=>{
  const scale=256*2**zoom,p=lat*Math.PI/180;
  return {x:(lon+180)/360*scale-.5,y:(1-Math.log(Math.tan(p)+1/Math.cos(p))/Math.PI)/2*scale-.5};
};
export const decodeTerrarium=(r,g,b)=>r*256+g+b/256-32768;
async function loadElevation(progress) {
  const zoom=12,points=Object.values(corners).map(p=>mercatorPixel(p,zoom));
  const x0=Math.floor(Math.min(...points.map(p=>p.x))/256),x1=Math.floor((Math.max(...points.map(p=>p.x))+1)/256);
  const y0=Math.floor(Math.min(...points.map(p=>p.y))/256),y1=Math.floor((Math.max(...points.map(p=>p.y))+1)/256);
  const tiles=new Map(),jobs=[];for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)jobs.push({x,y});
  let done=0;
  const load=async({x,y})=>{
    const url=`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${zoom}/${x}/${y}.png`;
    let response;for(let attempt=0;attempt<2;attempt++){try{response=await fetchData(url);break;}catch(error){if(attempt)throw error;}}
    const bitmap=await createImageBitmap(await response.blob(),{colorSpaceConversion:'none',premultiplyAlpha:'none'});
    const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(bitmap,0,0);bitmap.close();
    const pixels=ctx.getImageData(0,0,256,256).data,values=new Float32Array(256*256);
    for(let i=0;i<values.length;i++)values[i]=decodeTerrarium(pixels[i*4],pixels[i*4+1],pixels[i*4+2]);
    tiles.set(`${x}/${y}`,values);progress(`Loading elevation · ${++done} / ${jobs.length}`);
  };
  let cursor=0;await Promise.all(Array.from({length:5},async()=>{while(cursor<jobs.length)await load(jobs[cursor++]);}));
  const value=(x,y)=>{
    const tx=Math.floor(x/256),ty=Math.floor(y/256),tile=tiles.get(`${tx}/${ty}`);
    if(!tile)throw new Error('Missing elevation tile at the table edge');
    return tile[(y-ty*256)*256+x-tx*256];
  };
  const grid={width:513,height:513,data:new Float32Array(513*513)};
  for(let j=0;j<513;j++)for(let i=0;i<513;i++) {
    const pixel=mercatorPixel(normalizedToGeo({u:i/512,v:j/512}),zoom),x=Math.floor(pixel.x),y=Math.floor(pixel.y),a=pixel.x-x,b=pixel.y-y;
    grid.data[j*513+i]=(value(x,y)*(1-a)+value(x+1,y)*a)*(1-b)+(value(x,y+1)*(1-a)+value(x+1,y+1)*a)*b;
  }
  tiles.clear();progress('Aligning terrain and environmental layers…');return grid;
}
function raster(features,size=513,lines=false) {
  const canvas=document.createElement('canvas');canvas.width=canvas.height=size;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.fillStyle=ctx.strokeStyle='#fff';
  ctx.lineWidth=lines?4:1;ctx.lineCap='round';
  const path=points=>{points.forEach((p,i)=>{const x=(p.x/bounds.width+.5)*(size-1),y=(p.z/bounds.depth+.5)*(size-1);if(!i)ctx.moveTo(x,y);else ctx.lineTo(x,y);});};
  for(const f of features) {
    if(lines){for(const line of f.type==='MultiLineString'?f.coordinates:f.type==='LineString'?[f.coordinates]:[]){ctx.beginPath();path(line);ctx.stroke();}}
    else for(const polygon of f.type==='MultiPolygon'?f.coordinates:f.type==='Polygon'?[f.coordinates]:[]){ctx.beginPath();for(const ring of polygon){path(ring);ctx.closePath();}ctx.fill('evenodd');}
  }
  if(lines){ctx.filter='blur(4px)';ctx.drawImage(canvas,0,0);ctx.filter='none';}
  const rgba=ctx.getImageData(0,0,size,size).data,data=new Float32Array(size*size);
  for(let i=0;i<data.length;i++)data[i]=rgba[i*4+3]/255;
  return {width:size,height:size,data};
}
async function loadSettlements() {
  // Live OSM identifiers for the principal settlements, not mirrored coordinate data.
  const nodes=[214184029,214185237,214187243,214191790,214212322,214233114,248071196,5900988775];
  const data=await (await fetchData('https://api.openstreetmap.org/api/0.6/nodes.json?nodes='+nodes.join(','))).json();
  if(!Array.isArray(data.elements))throw new Error('Settlement source unavailable');
  const ids={'Los Choros':'los-choros','El Trapiche':'trapiche','La Higuera':'higuera','Punta de Choros':'choros','Totoralillo Norte':'totoralillo'};
  return data.elements.filter(p=>p.type==='node'&&p.tags?.name&&inside(geoToNormalized({lat:p.lat,lon:p.lon}))).map(p=>({id:ids[p.tags.name]||`osm-${p.id}`,name:p.tags.name,...geoToLocal({lat:p.lat,lon:p.lon}),lat:p.lat,lon:p.lon,weight:p.tags.place==='town'?1:.6,source:'OpenStreetMap',sourceId:p.id}));
}
export async function loadGeography(progress=()=>{}) {
  const warnings=[],status={};
  const optional=async(id,fn)=>{try{const data=await fn();status[id]='loaded';return data;}catch(error){status[id]='unavailable';warnings.push(id);console.warn(`Geography ${id}:`,error);return [];}};
  const [elevation,water,protectedAreas,land,catchments,settlements]=await Promise.all([
    loadElevation(progress),optional('water',()=>queryFeatures(sources.water)),optional('protected',()=>queryFeatures(sources.protected)),
    optional('land',()=>queryFeatures(sources.land,"USO LIKE '%agric%' OR USO LIKE '%urban%' OR USO = 'Humedales'")),optional('catchments',()=>queryFeatures(sources.catchments)),optional('settlements',loadSettlements)
  ]);
  const productive=land.filter(f=>/agric/i.test(f.properties.USO)),urban=land.filter(f=>/urban/i.test(f.properties.USO)&&!/mineria/i.test(f.properties.SUBUSO)),wetlands=land.filter(f=>/Humedales/i.test(f.properties.USO));
  const masks={water:raster(water,513,true),protected:raster([...protectedAreas,...wetlands]),land:raster(productive),urban:raster(urban)};
  const heights=(x,z)=>sampleGrid(elevation,x,z);
  return {elevation,water,waterSegments:lineSegments(water),protectedAreas,productive,urban,catchments,settlements,masks,heights,warnings,status,sources};
}
