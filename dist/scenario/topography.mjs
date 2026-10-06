const gradients=[[1,0],[-1,0],[0,1],[0,-1],[.707,.707],[-.707,.707],[.707,-.707],[-.707,-.707]];
const fade=t=>t*t*t*(t*(t*6-15)+10);
const lerp=(a,b,t)=>a+(b-a)*t;
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
function gradient(x,z,dx,dz) {
  let hash=Math.imul(x,374761393)+Math.imul(z,668265263)+1857;
  hash=Math.imul(hash^(hash>>>13),1274126177);const g=gradients[(hash^(hash>>>16))&7];
  return g[0]*dx+g[1]*dz;
}
function noise(x,z) {
  const ix=Math.floor(x),iz=Math.floor(z),dx=x-ix,dz=z-iz,u=fade(dx),v=fade(dz);
  return lerp(lerp(gradient(ix,iz,dx,dz),gradient(ix+1,iz,dx-1,dz),u),
    lerp(gradient(ix,iz+1,dx,dz-1),gradient(ix+1,iz+1,dx-1,dz-1),u),v)*1.5;
}
export function ridgeDetail(x,z) {
  const px=x+noise(x*.19+3.4,z*.19-2.1)*1.35,pz=z+noise(x*.19-6.2,z*.19+4.7)*1.35;
  let sum=0,amplitude=.56,frequency=.46,weight=1;
  for(let octave=0;octave<5;octave++) {
    let ridge=1-Math.abs(noise(px*frequency+octave*3.17,pz*frequency-octave*2.83));
    ridge=ridge*ridge*weight;sum+=ridge*amplitude;weight=clamp(ridge*1.8);
    frequency*=2.03;amplitude*=.5;
  }
  return sum;
}

export function createRelief(baseHeight,coastline) {
  const nx=513,nz=305,count=nx*nz,dx=22/(nx-1),dz=13/(nz-1);
  let heights=new Float32Array(count);const land=new Uint8Array(count);
  for(let j=0;j<nz;j++)for(let i=0;i<nx;i++) {
    const x=-11+i*dx,z=-6.5+j*dz,index=j*nx+i;
    heights[index]=baseHeight(x,z);land[index]=Number(x>=coastline(z));
  }
  const order=Uint32Array.from({length:count},(_,i)=>i),downhill=new Int32Array(count),accumulation=new Float32Array(count),grades=new Float32Array(count);
  for(let pass=0;pass<4;pass++) {
    downhill.fill(-1);accumulation.fill(1);grades.fill(0);
    for(let j=1;j<nz-1;j++)for(let i=1;i<nx-1;i++) {
      const index=j*nx+i;if(!land[index])continue;let steepest=0;
      for(let oz=-1;oz<=1;oz++)for(let ox=-1;ox<=1;ox++) {
        if(!ox&&!oz)continue;const next=index+oz*nx+ox,grade=(heights[index]-heights[next])/Math.hypot(ox*dx,oz*dz);
        if(grade>steepest){steepest=grade;downhill[index]=next;}
      }
      grades[index]=steepest;
    }
    order.sort((a,b)=>heights[b]-heights[a]);
    for(const index of order)if(downhill[index]>=0)accumulation[downhill[index]]+=accumulation[index];
    const eroded=heights.slice();
    for(let index=0;index<count;index++) {
      if(!land[index])continue;
      const incision=Math.min(.028,.0016*Math.pow(accumulation[index],.38)*Math.sqrt(grades[index]));
      eroded[index]=Math.max(.072,heights[index]-incision);
    }
    heights=eroded;
  }
  for(let pass=0;pass<2;pass++) {
    const smooth=heights.slice();
    for(let j=1;j<nz-1;j++)for(let i=1;i<nx-1;i++) {
      const index=j*nx+i;
      if(!land[index]||!land[index-1]||!land[index+1]||!land[index-nx]||!land[index+nx])continue;
      smooth[index]=heights[index]*.68+(heights[index-1]+heights[index+1]+heights[index-nx]+heights[index+nx])*.08;
    }
    heights=smooth;
  }
  return (x,z)=> {
    const gx=clamp((x+11)/dx,0,nx-1),gz=clamp((z+6.5)/dz,0,nz-1);
    const i=Math.min(nx-2,Math.floor(gx)),j=Math.min(nz-2,Math.floor(gz)),tx=gx-i,tz=gz-j,index=j*nx+i;
    return lerp(lerp(heights[index],heights[index+1],tx),lerp(heights[index+nx],heights[index+nx+1],tx),tz);
  };
}
