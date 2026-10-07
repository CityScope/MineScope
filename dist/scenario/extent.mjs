// User-supplied GeoJSON boundary. North is the rear edge.
export const extentId='la-higuera-20261007-bounds2';
export const corners={
  NW:{lat:-29.160639,lon:-71.480437},
  NE:{lat:-29.160639,lon:-70.993245},
  SE:{lat:-29.585199,lon:-70.993245},
  SW:{lat:-29.585199,lon:-71.480437}
};
const rad=Math.PI/180,a=6378137,e2=.0066943799901413165,ep=e2/(1-e2),k=.9996;
export function toUTM({lat,lon}) {
  const p=lat*rad,l=(lon+69)*rad,s=Math.sin(p),c=Math.cos(p),t=Math.tan(p)**2,C=ep*c*c,A=c*l,N=a/Math.sqrt(1-e2*s*s);
  const M=a*((1-e2/4-3*e2**2/64-5*e2**3/256)*p-(3*e2/8+3*e2**2/32+45*e2**3/1024)*Math.sin(2*p)+(15*e2**2/256+45*e2**3/1024)*Math.sin(4*p)-35*e2**3/3072*Math.sin(6*p));
  return {x:500000+k*N*(A+(1-t+C)*A**3/6+(5-18*t+t*t+72*C-58*ep)*A**5/120),y:10000000+k*(M+N*Math.tan(p)*(A*A/2+(5-t+9*C+4*C*C)*A**4/24+(61-58*t+t*t+600*C-330*ep)*A**6/720))};
}
export function fromUTM({x,y}) {
  const M=(y-10000000)/k,mu=M/(a*(1-e2/4-3*e2**2/64-5*e2**3/256)),e1=(1-Math.sqrt(1-e2))/(1+Math.sqrt(1-e2));
  const p=mu+(3*e1/2-27*e1**3/32)*Math.sin(2*mu)+(21*e1**2/16-55*e1**4/32)*Math.sin(4*mu)+151*e1**3/96*Math.sin(6*mu)+1097*e1**4/512*Math.sin(8*mu);
  const s=Math.sin(p),c=Math.cos(p),T=Math.tan(p)**2,C=ep*c*c,N=a/Math.sqrt(1-e2*s*s),R=a*(1-e2)/(1-e2*s*s)**1.5,D=(x-500000)/(N*k);
  return {lat:(p-N*Math.tan(p)/R*(D*D/2-(5+3*T+10*C-4*C*C-9*ep)*D**4/24+(61+90*T+298*C+45*T*T-252*ep-3*C*C)*D**6/720))/rad,
    lon:-69+(D-(1+2*T+C)*D**3/6+(5-2*C+28*T-3*C*C+8*ep+24*T*T)*D**5/120)/c/rad};
}
export const projectedCorners=Object.fromEntries(Object.entries(corners).map(([id,p])=>[id,toUTM(p)]));
const length=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),P=projectedCorners;
export const dimensions={widthKm:(length(P.NW,P.NE)+length(P.SW,P.SE))/2000,depthKm:(length(P.NW,P.SW)+length(P.NE,P.SE))/2000};
export const bounds={width:22,depth:22*dimensions.depthKm/dimensions.widthKm};
export const kmPerUnit=dimensions.widthKm/bounds.width;
export const verticalExaggeration=2.8;
export const normalizedToGeo=({u,v})=>({lon:corners.NW.lon+u*(corners.NE.lon-corners.NW.lon),lat:corners.NW.lat+v*(corners.SW.lat-corners.NW.lat)});
export const normalizedToUTM=p=>toUTM(normalizedToGeo(p));
export const geoToNormalized=({lat,lon})=>({u:(lon-corners.NW.lon)/(corners.NE.lon-corners.NW.lon),v:(lat-corners.NW.lat)/(corners.SW.lat-corners.NW.lat)});
export const normalizedToLocal=({u,v})=>({x:(u-.5)*bounds.width,z:(v-.5)*bounds.depth});
export const localToNormalized=({x,z})=>({u:x/bounds.width+.5,v:z/bounds.depth+.5});
export const geoToLocal=p=>normalizedToLocal(geoToNormalized(p));
export const localToGeo=p=>normalizedToGeo(localToNormalized(p));
export const inside=({u,v})=>u>=0&&u<=1&&v>=0&&v<=1;
export const envelope=[Math.min(...Object.values(corners).map(p=>p.lon)),Math.min(...Object.values(corners).map(p=>p.lat)),Math.max(...Object.values(corners).map(p=>p.lon)),Math.max(...Object.values(corners).map(p=>p.lat))];
