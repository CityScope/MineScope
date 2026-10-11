export const defaultWindBearing=125;
export const plumeLength=4.8,plumeHalfWidth=2.1,profileHeightRange=16;
export function normalizeBearing(value){return Number.isFinite(Number(value))?((Number(value)%360)+360)%360:defaultWindBearing;}
export function windDirection(value){const a=normalizeBearing(value)*Math.PI/180;return {x:Math.sin(a),z:-Math.cos(a)};}
export function windLabel(value){const bearing=normalizeBearing(value);return `${Math.round(bearing)}° ${['N','NE','E','SE','S','SW','W','NW'][Math.round(bearing/45)%8]}`;}
export function dustDensity(result){return (.3+.7*Math.max(0,Math.min(1,(result.base.community-12)/74)))*(1-.72*(result.strength.dust||0));}
export function fillDustProfile(data,width,height,origin,bearing,heightAt){
  const wind=windDirection(bearing);
  for(let j=0;j<height;j++)for(let i=0;i<width;i++){
    const along=i/(width-1)*plumeLength,across=(j/(height-1)*2-1)*plumeHalfWidth;
    const x=origin.x+wind.x*along-wind.z*across,z=origin.z+wind.z*along+wind.x*across;
    const encoded=Math.round(Math.max(0,Math.min(1,heightAt(x,z)/profileHeightRange))*65535),k=(j*width+i)*4;
    data[k]=encoded>>8;data[k+1]=encoded&255;data[k+2]=0;data[k+3]=255;
  }
  return data;
}
