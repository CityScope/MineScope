// Project-authored demonstration geometry and causal model. These are not
// surveyed locations, measured exposure, hydrologic predictions or cost estimates.
import {createRelief,ridgeDetail} from './topography.mjs';
import {allocateFund,interventions} from './funding.mjs';
export {interventions} from './funding.mjs';
export const bounds = { width: 22, depth: 13 };
export const plant = { x: 8.5, z: -4.65 };
export const initialLocation = { x: 2.8, z: 1.05 };
export const referenceLocation = { x: 5.65, z: 3.05 };
export const siteFootprint = { width: 1.8, depth: 1.5 };
export const habitatBoundary = .38;
export const settlements = [
  { id: 'los-choros', name: 'Los Choros', x: -5.8, z: .9, weight: 1 },
  { id: 'trapiche', name: 'El Trapiche', x: 5.9, z: 4.3, weight: .8 },
  { id: 'higuera', name: 'La Higuera', x: 7.8, z: -.9, weight: .75 }
];
export const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const gaussian = (x, z, cx, cz, sx, sz) => Math.exp(-(((x-cx)/sx)**2+((z-cz)/sz)**2));
export function coastline(z) { return -8.2 + .4*Math.sin(z*.8) + .22*Math.cos(z*1.9); }
export function riverZ(x, branch = 0) {
  return branch ? -2.8 + .35*x + .6*Math.sin(x*.55) : .25 + 1.15*Math.sin((x+2)*.38) + .22*Math.sin(x*1.4);
}
export function drainage(x, z) {
  const a = Math.exp(-(((z-riverZ(x))/.85)**2));
  const b = .75*Math.exp(-(((z-riverZ(x,1))/.65)**2));
  return clamp(Math.max(a,b));
}
export function habitat(x, z) {
  return clamp(.9*gaussian(x,z,-3,1.3,3,2)+.8*gaussian(x,z,4,-2.6,2.8,1.7)+.65*gaussian(x,z,7,3.1,2.8,1.4));
}
export function livelihood(x, z) {
  return clamp(.85*gaussian(x,z,-4.7,2,2.4,1.6)+.8*gaussian(x,z,5.9,4,2.4,1.7));
}
function baseHeight(x,z) {
  if(x < coastline(z)) return .055;
  const coast = clamp((x-coastline(z))/2.5);
  const hills = 2.05*gaussian(x,z,-4,-4.5,3.4,2.1)+2.2*gaussian(x,z,3.7,-4.5,3.5,2)
    +2.45*gaussian(x,z,8.6,1,2.8,2.4)+1.75*gaussian(x,z,-2.4,5,3.3,1.7)
    +1.6*gaussian(x,z,2.7,4.7,2,1.9)+.7*gaussian(x,z,-5.4,-.5,2.2,2.1);
  const valleys = 1-.72*drainage(x,z),ridges=ridgeDetail(x,z);
  return .085 + coast*(.1+hills*(.4+ridges*1.05)+ridges*.2)*valleys*.62;
}
const relief=createRelief(baseHeight,coastline);
export const height=(x,z)=>relief(x,z);
export const surfaceHeight = (x,z) => height(x,z);
export function slope(x,z) {
  return Math.hypot(height(x+.16,z)-height(x-.16,z),height(x,z+.16)-height(x,z-.16))/.32;
}
export function siteSuitability(location) {
  let water=false,habitatOverlap=false,minHeight=Infinity,maxHeight=-Infinity;
  for(let j=0;j<=6;j++)for(let i=0;i<=8;i++) {
    const x=location.x+siteFootprint.width*(i/8-.5),z=location.z+siteFootprint.depth*(j/6-.5),h=height(x,z);
    water ||= x<coastline(z);habitatOverlap ||= habitat(x,z)>=habitatBoundary;
    minHeight=Math.min(minHeight,h);maxHeight=Math.max(maxHeight,h);
  }
  const occupied=settlements.filter(s=>Math.abs(s.x-location.x)<siteFootprint.width/2+.625&&Math.abs(s.z-location.z)<siteFootprint.depth/2+.485);
  const relief=maxHeight-minHeight,reasons=[];
  if(water)reasons.push({id:'water',label:'Water',detail:'The tailings footprint overlaps open water.'});
  if(occupied.length)reasons.push({id:'settlement',label:'Settlement',detail:`The tailings footprint overlaps ${occupied.map(s=>s.name).join(' and ')}.`});
  if(habitatOverlap)reasons.push({id:'habitat',label:'Habitat',detail:'The tailings footprint overlaps a sensitive habitat area.'});
  if(relief>.8)reasons.push({id:'terrain',label:'Steep terrain',detail:'Extreme height differences across the footprint make this terrain unsuitable in the model.'});
  return {viable:reasons.length===0,reasons,relief};
}
// A small terrain-cost routing grid is hidden from interaction. The pieces
// retain exact continuous coordinates; only the illustrative corridor is routed.
const nx=67,nz=39,grid=[];
for(let j=0;j<nz;j++)for(let i=0;i<nx;i++) {
  const x=-10.65+i*21.3/(nx-1),z=-6.1+j*12.2/(nz-1);
  grid.push({x,z,h:height(x,z),habitat:habitat(x,z),water:drainage(x,z),sea:x<coastline(z)});
}
const cell = p => Math.round(clamp((p.z+6.1)/12.2)*(nz-1))*nx+Math.round(clamp((p.x+10.65)/21.3)*(nx-1));
const routeCache=new Map();
class Heap {
  items=[];
  push(v) { let i=this.items.push(v)-1;while(i){const p=(i-1)>>1;if(this.items[p].score<=v.score)break;this.items[i]=this.items[p];i=p;}this.items[i]=v; }
  pop() { const top=this.items[0],last=this.items.pop();if(this.items.length){let i=0;while(i*2+1<this.items.length){let c=i*2+1;if(c+1<this.items.length&&this.items[c+1].score<this.items[c].score)c++;if(this.items[c].score>=last.score)break;this.items[i]=this.items[c];i=c;}this.items[i]=last;}return top; }
}
function rawRoute(destination) {
  const end=cell(destination),start=cell(plant);
  let path=routeCache.get(end);
  if(!path) {
    const g=new Float64Array(grid.length).fill(Infinity),parent=new Int32Array(grid.length).fill(-1),closed=new Uint8Array(grid.length),heap=new Heap();
    g[start]=0;heap.push({id:start,score:distance(grid[start],grid[end])});
    while(heap.items.length) {
      const {id}=heap.pop();if(closed[id])continue;closed[id]=1;if(id===end)break;
      const i=id%nx,j=Math.floor(id/nx),a=grid[id];
      for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++) {
        if((!dx&&!dz)||i+dx<0||i+dx>=nx||j+dz<0||j+dz>=nz)continue;
        const next=(j+dz)*nx+i+dx;if(closed[next])continue;const b=grid[next],length=distance(a,b);
        const cost=length*(1+Math.abs(a.h-b.h)/length*1.6+b.habitat*.65+b.water*.3+(b.sea?8:0));
        if(g[id]+cost<g[next]){g[next]=g[id]+cost;parent[next]=id;heap.push({id:next,score:g[next]+distance(b,grid[end])});}
      }
    }
    path=[];for(let id=end;id>=0;id=parent[id]){path.push(grid[id]);if(id===start)break;}
    path.reverse();routeCache.set(end,path);if(routeCache.size>180)routeCache.delete(routeCache.keys().next().value);
  }
  const points=[plant,...path.slice(1,-1),{...destination}];
  const length=points.slice(1).reduce((sum,p,i)=>sum+distance(p,points[i]),0);
  return {points,length};
}
const kmPerUnit=12.2/rawRoute(referenceLocation).length;
export function route(destination) { const result=rawRoute(destination);return {...result,km:result.length*kmPerUnit}; }
export function evaluate(location,requested=[]) {
  const pipeline=route(location),waterSensitivity=drainage(location.x,location.z),habitatSensitivity=habitat(location.x,location.z),landSensitivity=livelihood(location.x,location.z),grade=slope(location.x,location.z);
  const exposed=settlements.map(s=>({...s,proximity:Math.exp(-distance(location,s)/3.1)*s.weight}));
  const communityProximity=clamp(exposed.reduce((sum,s)=>sum+s.proximity,0));
  const offshore=location.x<coastline(location.z);
  const base={
    water:clamp(17+waterSensitivity*59+grade*13+(offshore?30:0),0,100),
    habitat:clamp(14+habitatSensitivity*66+grade*8+(offshore?20:0),0,100),
    community:clamp(12+communityProximity*74,0,100),
    land:clamp(16+landSensitivity*73,0,100),
    cost:clamp(12+pipeline.km*2.45+grade*13+habitatSensitivity*9+(offshore?20:0),0,100)
  };
  const funding=allocateFund(base.cost,requested);
  const strength=Object.fromEntries(interventions.map(i=>[i.id,funding.allocations[i.id].fraction]));
  const mitigationCost=interventions.reduce((sum,i)=>sum+i.cost*strength[i.id],0);
  const current={
    water:clamp(base.water-strength.water*24,8,100),
    habitat:clamp(base.habitat-strength.habitat*22-strength.fund*7,14,100),
    community:clamp(base.community-strength.dust*21,12,100),
    land:clamp(base.land-strength.fund*5,16,100),
    cost:clamp(base.cost+mitigationCost,0,100)
  };
  return {location:{...location},base,current,pipeline,strength,funding,suitability:siteSuitability(location),offshore,waterSensitivity,habitatSensitivity,landSensitivity,grade,exposed,
    oversight:strength.monitor>0?'Independent oversight funded':'No independent oversight',footprintHa:185};
}
export const metricInfo = {
  water:{name:'Water risk',color:'#74C2EE',symbol:'water',basis:'Drainage + downstream users',chain:['Move the footprint closer to a drainage pathway','Greater connection to downstream water users','Higher potential water consequence'],limitation:'Drainage connectivity and elevation are illustrative. This is not a flood, groundwater or failure model. Water protection reduces the demonstration score; monitoring alone does not.'},
  habitat:{name:'Habitat impact',color:'#5FD3A4',symbol:'leaf',basis:'Footprint + sensitive habitat',chain:['The footprint intersects a habitat patch','More sensitive habitat is directly affected','Restoration can reduce some consequences'],limitation:'Habitat patches are project-authored examples. Restoration does not erase the occupied footprint or establish ecological equivalence.'},
  community:{name:'Community exposure',color:'#E9BB63',symbol:'people',basis:'Distance + dust / noise',chain:['Move the facility closer to a settlement','More proximity to construction and operation','Dust and noise protection reduces modeled disturbance'],limitation:'Settlement positions and proximity weights are schematic. These are not measured population, dust or noise exposures.'},
  cost:{name:'Relative cost',color:'#e6a474',symbol:'fund',basis:'Pipeline + protection measures',chain:['A terrain-aware corridor connects plant and deposit','Longer corridors and steeper terrain need more infrastructure','Protection measures add to the relative index'],limitation:'This is a relative demonstration index, not a construction budget. The 12.2 km reference is a calibration value from the supplied KPI slides; the routes are illustrative.'},
  land:{name:'Land & livelihoods',color:'#d7bf8d',symbol:'land',basis:'Occupation + productive land',chain:['The fixed footprint occupies land','Productive-land overlap adds livelihood sensitivity','Local restoration can offset some consequences'],limitation:'The 185 ha footprint and productive-land patches are demonstration assumptions. The original occupied footprint remains visible after restoration.'}
};
