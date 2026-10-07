import {bounds,localToNormalized,geoToLocal} from './extent.mjs?v=20261007-ws-status1';
export function sampleGrid(grid,x,z) {
  const {u,v}=localToNormalized({x,z}),fx=Math.max(0,Math.min(1,u))*(grid.width-1),fy=Math.max(0,Math.min(1,v))*(grid.height-1);
  const i=Math.min(grid.width-2,Math.floor(fx)),j=Math.min(grid.height-2,Math.floor(fy)),a=fx-i,b=fy-j,k=j*grid.width+i,d=grid.data;
  return (d[k]*(1-a)+d[k+1]*a)*(1-b)+(d[k+grid.width]*(1-a)+d[k+grid.width+1]*a)*b;
}
export function projectFeatures(collection) {
  return (collection.features||[]).filter(f=>f.geometry).map(f=>{
    const depth={LineString:1,MultiLineString:2,Polygon:2,MultiPolygon:3,Point:0}[f.geometry.type];
    const map=(coordinates,n)=>n?coordinates.map(c=>map(c,n-1)):geoToLocal({lon:coordinates[0],lat:coordinates[1]});
    return {type:f.geometry.type,coordinates:map(f.geometry.coordinates,depth),properties:f.properties||{}};
  });
}
// Liang–Barsky clipping preserves every crossing and excludes out-of-table geometry.
export function clipSegment(a,b) {
  const dx=b.x-a.x,dz=b.z-a.z,p=[-dx,dx,-dz,dz],q=[a.x+bounds.width/2,bounds.width/2-a.x,a.z+bounds.depth/2,bounds.depth/2-a.z];let low=0,high=1;
  for(let i=0;i<4;i++){if(Math.abs(p[i])<1e-12){if(q[i]<0)return null;}else {const t=q[i]/p[i];if(p[i]<0)low=Math.max(low,t);else high=Math.min(high,t);}}
  if(low>high)return null;
  return [{x:a.x+low*dx,z:a.z+low*dz},{x:a.x+high*dx,z:a.z+high*dz}];
}
export function lineSegments(features) {
  const segments=[];
  for(const f of features)for(const line of f.type==='MultiLineString'?f.coordinates:f.type==='LineString'?[f.coordinates]:[])for(let i=1;i<line.length;i++) {
    const clipped=clipSegment(line[i-1],line[i]);if(clipped)segments.push(...clipped);
  }
  return segments;
}
export function flowPath(location,elevation,steps=100) {
  const points=[{...location}];let p={...location};
  // Illustrative downhill projection from the DEM; not a routed hydrology model.
  for(let n=0;n<steps;n++) {
    const candidates=Array.from({length:16},(_,i)=>({x:p.x+.12*Math.cos(i*Math.PI/8),z:p.z+.12*Math.sin(i*Math.PI/8)})).filter(c=>Math.abs(c.x)<=bounds.width/2&&Math.abs(c.z)<=bounds.depth/2);
    const h=elevation(p.x,p.z);candidates.sort((a,b)=>elevation(a.x,a.z)-elevation(b.x,b.z));
    const next=candidates[0];if(!next||elevation(next.x,next.z)>=h-.05)break;
    p=next;points.push(p);if(elevation(p.x,p.z)<=0)break;
  }
  return points;
}
