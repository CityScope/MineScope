export function terrainHit(origin,direction,height,width=22,depth=13) {
  let enter=0,exit=Infinity;
  for(const [axis,min,max] of [['x',-width/2,width/2],['y',0,6],['z',-depth/2,depth/2]]) {
    const d=direction[axis],o=origin[axis];
    if(Math.abs(d)<1e-10){if(o<min||o>max)return null;continue;}
    const a=(min-o)/d,b=(max-o)/d;enter=Math.max(enter,Math.min(a,b));exit=Math.min(exit,Math.max(a,b));
  }
  if(exit<enter)return null;
  const at=t=>({x:origin.x+direction.x*t,y:origin.y+direction.y*t,z:origin.z+direction.z*t});
  const gap=t=>{const p=at(t);return p.y-height(p.x,p.z);};
  const step=.06/Math.max(Math.hypot(direction.x,direction.z),Math.abs(direction.y),1e-10);
  let previous=gap(enter),t=enter;
  if(Math.abs(previous)<1e-8)return at(t);
  while(t<exit) {
    const next=Math.min(t+step,exit),current=gap(next);
    if(previous>=0&&current<=0) {
      let low=t,high=next;
      for(let n=0;n<10;n++){const mid=(low+high)/2;if(gap(mid)>0)low=mid;else high=mid;}
      return at((low+high)/2);
    }
    t=next;previous=current;
  }
  return null;
}
