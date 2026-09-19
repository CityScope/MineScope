/* A fixed geographic grid and shared scales keep views comparable during replay. */
(() => {
  'use strict';
  const sentiments=['concerned','hopeful','mixed','neutral'];
  const stops=[[224,128,99],[233,187,99],[95,211,164]];
  const clamp=value=>Math.max(0,Math.min(1,value));
  function color(value){const v=clamp(value)*2,index=Math.min(1,Math.floor(v)),fraction=v-index;return stops[index].map((c,i)=>Math.round(c+(stops[index+1][i]-c)*fraction));}
  function create(records){
    const origin={lat:-29.4,lng:-71.25},kx=111.32*Math.cos(origin.lat*Math.PI/180),ky=111.32;
    const project=coords=>({x:(coords[1]-origin.lng)*kx,y:(coords[0]-origin.lat)*ky});
    const unproject=(x,y)=>[origin.lat+y/ky,origin.lng+x/kx];
    const points=records.map(n=>({...project(n.coords),sentiment:sentiments.indexOf(n.sentiment)}));
    const radius=1.15,reach=10,sigma=4,cells=[],indexById=new Map(records.map((n,i)=>[n.id,i]));
    const minX=Math.min(...points.map(p=>p.x))-reach,maxX=Math.max(...points.map(p=>p.x))+reach,minY=Math.min(...points.map(p=>p.y))-reach,maxY=Math.max(...points.map(p=>p.y))+reach;
    const stepX=Math.sqrt(3)*radius,stepY=1.5*radius;
    let peak=0;
    for(let row=Math.floor(minY/stepY);row<=Math.ceil(maxY/stepY);row++)for(let col=Math.floor(minX/stepX);col<=Math.ceil(maxX/stepX);col++){
      const x=(col+(Math.abs(row)%2)/2)*stepX,y=row*stepY,samples=[];let total=0;
      points.forEach((p,index)=>{const distance=(p.x-x)**2+(p.y-y)**2;if(distance>reach*reach)return;const weight=Math.exp(-distance/(2*sigma*sigma));samples.push({index,weight,sentiment:p.sentiment});total+=weight;});
      if(total<.7)continue;
      peak=Math.max(peak,total);
      const corners=Array.from({length:6},(_,i)=>{const a=(i*60+30)*Math.PI/180;return unproject(x+radius*Math.cos(a),y+radius*Math.sin(a));});
      cells.push({coords:unproject(x,y),corners,samples});
    }
    function evaluate(items,mode){
      const included=new Uint8Array(records.length);items.forEach(n=>{const i=indexById.get(n.id);if(i!==undefined)included[i]=1;});
      return cells.flatMap(cell=>{
        const counts=[0,0,0,0];for(const sample of cell.samples)if(included[sample.index])counts[sample.sentiment]+=sample.weight;
        const total=counts.reduce((a,b)=>a+b,0);if(total<.7)return [];
        const matching=mode==='balance'||mode==='density'?total:counts[sentiments.indexOf(mode)];
        if(!Number.isFinite(matching)||matching<.4)return [];
        // Neutral and mixed notes sit at the center of the balance scale.
        const balance=(counts[1]-counts[0])/total;
        const value=mode==='balance'?clamp(.5+balance/.7):1-clamp(matching/peak);
        return [{...cell,total,matching,balance,color:color(value),opacity:.18+.49*Math.min(1,matching/8)}];
      });
    }
    return {cells,peak,evaluate,radius,reach};
  }
  const api={create,color};
  if(typeof module==='object')module.exports=api;
  if(typeof window==='object')window.MineScopeHeatField=api;
})();
