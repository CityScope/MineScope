/* Geometry for incoming notes attached to a cluster's sentiment arc. */
(() => {
  'use strict';
  const order=['concerned','hopeful','mixed','neutral'];
  function segment(counts,sentiment){
    const total=order.reduce((sum,key)=>sum+(counts[key]||0),0);
    if(!total||!counts[sentiment])return null;
    const before=order.slice(0,order.indexOf(sentiment)).reduce((sum,key)=>sum+(counts[key]||0),0);
    return {start:before/total*Math.PI*2,end:(before+counts[sentiment])/total*Math.PI*2};
  }
  function place({center,radius,arc,width,height,rects=[],circles=[]}){
    if(!arc)return null;
    const polar=(angle,r)=>({x:Math.sin(angle)*r,y:-Math.cos(angle)*r});
    const overlaps=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
    // Start on the correct colored arc, then prefer the shortest clear leader.
    for(const distance of [23,33,43])for(const fraction of [.5,.25,.75,.1,.9])for(const turn of [0,-.3,.3,-.6,.6]){
      const angle=arc.start+(arc.end-arc.start)*fraction;
      const anchor=polar(angle,radius-1),knee=polar(angle,radius+5),badge=polar(angle+turn,radius+distance);
      const x=center.x+badge.x,y=center.y+badge.y,box={left:x-11,right:x+11,top:y-11,bottom:y+11};
      if(box.left<5||box.top<5||box.right>width-5||box.bottom>height-5||rects.some(r=>overlaps(box,r))||circles.some(c=>Math.hypot(x-c.x,y-c.y)<c.radius+12))continue;
      const dx=badge.x-knee.x,dy=badge.y-knee.y,length=Math.hypot(dx,dy);
      // Avoid a bent leader cutting back through its counter.
      if(knee.x*dx+knee.y*dy<0)continue;
      return {anchor,knee,badge,end:{x:badge.x-dx/length*9,y:badge.y-dy/length*9},box};
    }
    return null;
  }
  const api={segment,place};
  if(typeof module==='object')module.exports=api;
  if(typeof window==='object')window.MineScopeArrivalLayout=api;
})();
