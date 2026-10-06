export function renderPixelRatio(width,height,dpr=1) {
  return Math.max(.75,Math.min(dpr,1.5,Math.sqrt(1400000/Math.max(1,width*height))));
}
export function siteMoved(previous,current) {
  return !previous||previous.x!==current.x||previous.z!==current.z;
}
