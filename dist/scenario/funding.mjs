export const fundTotal=20;
export const interventions=[
  {id:'water',name:'Water protection',shortName:'Water',color:'#74C2EE',symbol:'water',cost:8,budgetCost:2.8,description:'Reduces modeled water risk associated with drainage connections.'},
  {id:'habitat',name:'Habitat restoration',shortName:'Habitat',color:'#5FD3A4',symbol:'leaf',cost:9,budgetCost:3.15,description:'Reduces modeled habitat impact. The occupied footprint remains.'},
  {id:'dust',name:'Dust + noise',shortName:'Dust + noise',color:'#E9BB63',symbol:'wind',cost:5,budgetCost:1.75,description:'Reduces modeled dust and noise exposure for nearby communities.'},
  {id:'monitor',name:'Independent monitoring',shortName:'Monitoring',color:'#B699F3',symbol:'monitor',cost:4,budgetCost:1.4,description:'Funds independent oversight and reporting. It does not reduce physical impact scores.'},
  {id:'fund',name:'Closure restoration',shortName:'Closure',color:'#F28FB4',symbol:'fund',cost:6,budgetCost:2.1,description:'Supports restoration after closure, reducing modeled habitat and livelihood consequences.'}
];
const cents=value=>Math.round(value*100);
export function allocateFund(relativeSiteCost,requested=[],total=fundTotal) {
  const totalCents=Math.max(0,cents(total));
  const siteCents=Math.min(totalCents,Math.max(0,cents(2+Math.max(0,Math.min(100,relativeSiteCost))*.18)));
  let available=totalCents-siteCents;
  const allocations=Object.fromEntries(interventions.map(i=>[i.id,{requested:false,cost:i.budgetCost,amount:0,fraction:0}]));
  for(const id of new Set(requested)) {
    const allocation=allocations[id];if(!allocation)continue;
    const paid=Math.min(available,cents(allocation.cost));available-=paid;
    allocation.requested=true;allocation.amount=paid/100;allocation.fraction=paid/cents(allocation.cost);
  }
  return {total:totalCents/100,site:siteCents/100,protection:(totalCents-siteCents-available)/100,remaining:available/100,allocations};
}
