export function landIndices(elevation,stride=1) {
  const segments=elevation.width-1,size=elevation.width,indices=[];
  function cell(row,col,step) {
    let land=false;
    for(let j=0;j<=step&&!land;j++)for(let i=0;i<=step;i++)if(elevation.data[(row+j)*size+col+i]>0){land=true;break;}
    if(!land)return;
    const a=row*size+col,b=a+step,c=a+size*step,d=c+step;
    if(step>1&&[a,b,c,d].every(i=>elevation.data[i]<=0)) {
      const half=step/2;
      cell(row,col,half);cell(row,col+half,half);cell(row+half,col,half);cell(row+half,col+half,half);return;
    }
    indices.push(a,c,b,b,c,d);
  }
  for(let row=0;row<segments;row+=stride)for(let col=0;col<segments;col+=stride)cell(row,col,stride);
  return new Uint32Array(indices);
}

export function maskedIndices(segments,mask,threshold=.15) {
  const size=segments+1,indices=[];
  for(let row=0;row<segments;row++)for(let col=0;col<segments;col++) {
    const a=row*size+col,b=a+1,c=a+size,d=c+1;
    if(Math.max(mask[a],mask[b],mask[c])>threshold)indices.push(a,c,b);
    if(Math.max(mask[b],mask[c],mask[d])>threshold)indices.push(b,c,d);
  }
  return new Uint32Array(indices);
}

export function terrainStride(distance,current=2) {
  return current===1?(distance>32?2:1):(distance<28?1:2);
}
