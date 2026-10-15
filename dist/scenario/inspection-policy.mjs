export const inspectionKinds=[
  {id:'water',label:'Water nearby',overlapLabel:'Water overlap',color:'#72d8f4'},
  {id:'habitat',label:'Protected area nearby',overlapLabel:'Protected area overlap',color:'#62d9a2'},
  {id:'settlement',label:'Settlement nearby',overlapLabel:'Occupied land overlap',color:'#efc774'},
  {id:'terrain',label:'Steep terrain nearby',overlapLabel:'Steep terrain overlap',color:'#f39c82'}
];

// This reads the already sampled display field, never the geographic services.
export function sampleInspectionSignals(field,location,radius=2.8) {
  const signals=[0,0,0,0],{width,height,masks,bounds}=field;
  const dx=bounds.width/(width-1),dz=bounds.depth/(height-1);
  const left=Math.max(0,Math.floor((location.x-radius+bounds.width/2)/dx));
  const right=Math.min(width-1,Math.ceil((location.x+radius+bounds.width/2)/dx));
  const back=Math.max(0,Math.floor((location.z-radius+bounds.depth/2)/dz));
  const front=Math.min(height-1,Math.ceil((location.z+radius+bounds.depth/2)/dz));
  for(let row=back;row<=front;row++)for(let col=left;col<=right;col++) {
    const distance=Math.hypot(col*dx-bounds.width/2-location.x,row*dz-bounds.depth/2-location.z);
    if(distance>radius)continue;
    const weight=1-Math.max(0,(distance-radius*.4)/(radius*.6));
    for(let channel=0;channel<4;channel++)signals[channel]=Math.max(signals[channel],masks[(row*width+col)*4+channel]*weight);
  }
  return Object.fromEntries(inspectionKinds.map((kind,index)=>[kind.id,signals[index]]));
}

export function summarizeInspection(result,signals={},kmPerUnit=1) {
  const overlaps=new Set(result.suitability.reasons.map(reason=>reason.id));
  const items=inspectionKinds.filter(kind=>overlaps.has(kind.id)||(signals[kind.id]||0)>.28)
    .map(kind=>({...kind,overlap:overlaps.has(kind.id),label:overlaps.has(kind.id)?kind.overlapLabel:kind.label}));
  const nearest=(result.exposed||[]).map(settlement=>({
    name:settlement.name,km:Math.hypot(settlement.x-result.location.x,settlement.z-result.location.z)*kmPerUnit
  })).sort((a,b)=>a.km-b.km)[0]||null;
  return {items,nearestSettlement:nearest,incomplete:result.suitability.complete===false,illustrative:true};
}
