import {allocateFund,interventions} from './funding.mjs?v=20261007-ws-status1';
import {bounds,kmPerUnit,geoToLocal,localToGeo,verticalExaggeration} from './extent.mjs?v=20261007-ws-status1';
import {sampleGrid,flowPath} from './geography-core.mjs?v=20261007-ws-status1';
export {interventions} from './funding.mjs?v=20261007-ws-status1';
export {bounds,kmPerUnit} from './extent.mjs?v=20261007-ws-status1';
export const plant=geoToLocal({lat:-29.368376,lon:-71.158140});
export const referenceLocation=geoToLocal({lat:-29.435528,lon:-71.078105});
export const initialLocation={...referenceLocation};
// The 185 ha demonstration footprint is scaled in metres; the luminous handle is oversized.
export const siteFootprint={width:Math.sqrt(1.85*1.2)/kmPerUnit,depth:Math.sqrt(1.85/1.2)/kmPerUnit};
export const habitatBoundary=.38;
export const settlements=[];
export const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
export const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
let geography,locationEvaluation;
export function configureGeography(data) {
  geography=data;locationEvaluation=undefined;settlements.splice(0,settlements.length,...data.settlements);routeCache.clear();buildRoutingGrid();
}
export const geographyData=()=>geography;
function ready(){if(!geography)throw new Error('Geography must be loaded before evaluating the table');return geography;}
export const elevation=(x,z)=>ready().heights(x,z);
export const isWater=(x,z)=>elevation(x,z)<=0;
export const surfaceHeight=(x,z)=>.06+Math.max(0,elevation(x,z))*verticalExaggeration/(kmPerUnit*1000);
export const height=surfaceHeight;
export const drainage=(x,z)=>sampleGrid(ready().masks.water,x,z);
export const habitat=(x,z)=>sampleGrid(ready().masks.protected,x,z);
export const livelihood=(x,z)=>sampleGrid(ready().masks.land,x,z);
export const runoffPath=p=>flowPath(p,elevation);
export function slope(x,z) {
  const step=.04;
  return Math.hypot(elevation(x+step,z)-elevation(x-step,z),elevation(x,z+step)-elevation(x,z-step))/(2*step*kmPerUnit*1000);
}
export function siteSuitability(location) {
  let water=false,protectedOverlap=false,urbanOverlap=false,minHeight=Infinity,maxHeight=-Infinity,maxSlope=0;
  for(let j=0;j<=6;j++)for(let i=0;i<=8;i++) {
    const x=location.x+siteFootprint.width*(i/8-.5),z=location.z+siteFootprint.depth*(j/6-.5),h=elevation(x,z);
    water ||= isWater(x,z);protectedOverlap ||= habitat(x,z)>=habitatBoundary;urbanOverlap ||= sampleGrid(ready().masks.urban,x,z)>.38;
    minHeight=Math.min(minHeight,h);maxHeight=Math.max(maxHeight,h);maxSlope=Math.max(maxSlope,slope(x,z));
  }
  const occupied=settlements.filter(s=>Math.abs(s.x-location.x)<siteFootprint.width/2+.25&&Math.abs(s.z-location.z)<siteFootprint.depth/2+.25);
  const relief=maxHeight-minHeight,reasons=[];
  if(water)reasons.push({id:'water',label:'Water',detail:'The tailings footprint overlaps open water in the elevation model.'});
  if(occupied.length||urbanOverlap)reasons.push({id:'settlement',label:'Occupied land',detail:occupied.length?`The footprint overlaps the vicinity of ${occupied.map(s=>s.name).join(' and ')}.`:'The footprint overlaps mapped urban or industrial land.'});
  if(protectedOverlap)reasons.push({id:'habitat',label:'Protected area',detail:'The footprint overlaps a SIMBIO protected area or mapped wetland.'});
  if(relief>150||maxSlope>.35)reasons.push({id:'terrain',label:'Steep terrain',detail:'Terrain relief or slope exceeds the demonstration placement threshold.'});
  if(Math.abs(location.x)+siteFootprint.width/2>bounds.width/2||Math.abs(location.z)+siteFootprint.depth/2>bounds.depth/2)reasons.push({id:'extent',label:'Table edge',detail:'The footprint extends outside the supplied study boundary.'});
  return {viable:reasons.length===0,reasons,relief,maxSlope,complete:ready().warnings.length===0};
}
const nx=67,nz=69,grid=[],routeCache=new Map();let routeParents;
function buildRoutingGrid(){
  grid.length=0;
  for(let j=0;j<nz;j++)for(let i=0;i<nx;i++) {
    const x=-bounds.width/2+i*bounds.width/(nx-1),z=-bounds.depth/2+j*bounds.depth/(nz-1);
    grid.push({x,z,h:surfaceHeight(x,z)/verticalExaggeration,habitat:habitat(x,z),water:drainage(x,z),sea:isWater(x,z)});
  }
  buildRoutes();
}
const cell=p=>Math.round(clamp(p.z/bounds.depth+.5)*(nz-1))*nx+Math.round(clamp(p.x/bounds.width+.5)*(nx-1));
class Heap {
  items=[];
  push(v) { let i=this.items.push(v)-1;while(i){const p=(i-1)>>1;if(this.items[p].score<=v.score)break;this.items[i]=this.items[p];i=p;}this.items[i]=v; }
  pop() { const top=this.items[0],last=this.items.pop();if(this.items.length){let i=0;while(i*2+1<this.items.length){let c=i*2+1;if(c+1<this.items.length&&this.items[c+1].score<this.items[c].score)c++;if(this.items[c].score>=last.score)break;this.items[i]=this.items[c];i=c;}this.items[i]=last;}return top; }
}
function buildRoutes() {
    const start=cell(plant),g=new Float64Array(grid.length).fill(Infinity),parent=new Int32Array(grid.length).fill(-1),closed=new Uint8Array(grid.length),heap=new Heap();
    g[start]=0;heap.push({id:start,score:0});
    while(heap.items.length) {
      const {id}=heap.pop();if(closed[id])continue;closed[id]=1;
      const i=id%nx,j=Math.floor(id/nx),a=grid[id];
      for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++) {
        if((!dx&&!dz)||i+dx<0||i+dx>=nx||j+dz<0||j+dz>=nz)continue;
        const next=(j+dz)*nx+i+dx;if(closed[next])continue;const b=grid[next],length=distance(a,b);
        const cost=length*(1+Math.abs(a.h-b.h)/length*1.6+b.habitat*.65+b.water*.3+(b.sea?8:0));
        if(g[id]+cost<g[next]){g[next]=g[id]+cost;parent[next]=id;heap.push({id:next,score:g[next]});}
      }
    }
    routeParents=parent;
}
function rawRoute(destination) {
  const end=cell(destination),start=cell(plant);
  let path=routeCache.get(end);
  if(!path) {
    path=[];for(let id=end;id>=0;id=routeParents[id]){path.push(grid[id]);if(id===start)break;}
    path.reverse();routeCache.set(end,path);if(routeCache.size>180)routeCache.delete(routeCache.keys().next().value);
  }
  const points=[plant,...path.slice(1,-1),{...destination}];
  const length=points.slice(1).reduce((sum,p,i)=>sum+distance(p,points[i]),0);
  return {points,length};
}

export function route(destination) { const result=rawRoute(destination);return {...result,km:result.length*kmPerUnit}; }
function evaluateLocation(location) {
  const pipeline=route(location),waterSensitivity=drainage(location.x,location.z),habitatSensitivity=habitat(location.x,location.z),landSensitivity=livelihood(location.x,location.z),grade=slope(location.x,location.z);
  const exposed=settlements.map(s=>({...s,proximity:Math.exp(-distance(location,s)/3.1)*s.weight}));
  const communityProximity=clamp(exposed.reduce((sum,s)=>sum+s.proximity,0));
  const offshore=isWater(location.x,location.z);
  const base={
    water:clamp(17+waterSensitivity*59+grade*13+(offshore?30:0),0,100),
    habitat:clamp(14+habitatSensitivity*66+grade*8+(offshore?20:0),0,100),
    community:clamp(12+communityProximity*74,0,100),
    land:clamp(16+landSensitivity*73,0,100),
    cost:clamp(12+pipeline.km*2.45+grade*13+habitatSensitivity*9+(offshore?20:0),0,100)
  };
  return {location:{...location},base,pipeline,suitability:siteSuitability(location),offshore,waterSensitivity,habitatSensitivity,landSensitivity,grade,exposed,footprintHa:185,coordinates:localToGeo(location),geographyComplete:geography.warnings.length===0};
}
export function evaluate(location,requested=[]) {
  if(!locationEvaluation||locationEvaluation.location.x!==location.x||locationEvaluation.location.z!==location.z)locationEvaluation=evaluateLocation(location);
  const {base}=locationEvaluation;
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
  return {...locationEvaluation,current,strength,funding,oversight:strength.monitor>0?'Independent oversight funded':'No independent oversight'};
}
export const metricInfo = {
  water:{name:'Water risk',color:'#74C2EE',symbol:'water',basis:'Drainage + downstream users',chain:['Move the footprint closer to a drainage pathway','Greater connection to downstream water users','Higher potential water consequence'],limitation:'Drainage proximity uses SIMBIO watercourses; terrain comes from elevation tiles. Flow and impact scores remain illustrative. This is not a flood, groundwater or failure model. Water protection reduces the demonstration score; monitoring alone does not.'},
  habitat:{name:'Habitat impact',color:'#5FD3A4',symbol:'leaf',basis:'Footprint + sensitive habitat',chain:['The footprint intersects a habitat patch','More sensitive habitat is directly affected','Restoration can reduce some consequences'],limitation:'The shown boundaries are SIMBIO protected areas and wetlands; they are not a complete species habitat inventory. Restoration does not erase the occupied footprint or establish ecological equivalence.'},
  community:{name:'Community exposure',color:'#E9BB63',symbol:'people',basis:'Distance + dust / noise',chain:['Move the facility closer to a settlement','More proximity to construction and operation','Dust and noise protection reduces modeled disturbance'],limitation:'Settlement centers come from the live gazetteer. Displayed building blocks and proximity weights remain illustrative. These are not measured population, dust or noise exposures.'},
  cost:{name:'Relative cost',color:'#e6a474',symbol:'fund',basis:'Pipeline + protection measures',chain:['A terrain-aware corridor connects plant and deposit','Longer corridors and steeper terrain need more infrastructure','Protection measures add to the relative index'],limitation:'This is a relative demonstration index, not a construction budget. Distances now use the supplied geographic boundary. Routes are coarse terrain-cost alternatives, not surveyed pipeline alignments.'},
  land:{name:'Land & livelihoods',color:'#d7bf8d',symbol:'land',basis:'Occupation + productive land',chain:['The fixed footprint occupies land','Productive-land overlap adds livelihood sensitivity','Local restoration can offset some consequences'],limitation:'The 185 ha footprint is a demonstration assumption, scaled to the table. Productive land uses the SIMBIO COT land-cover layer. The original occupied footprint remains visible after restoration.'}
};
