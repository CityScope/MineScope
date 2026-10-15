const clamp=(value,low,high)=>Math.max(low,Math.min(high,value));
const smooth=(low,high,value)=>{const t=clamp((value-low)/(high-low),0,1);return t*t*(3-2*t);};

export function inspectionCropState(detail,bounds,radius=3.5) {
  const amount=clamp(Number.isFinite(detail)?detail:0,0,1);
  const transition=smooth(0,.9,amount),overview=Math.hypot(bounds.width,bounds.depth)+4;
  return {detail:amount,radius:overview+(radius-overview)*transition,section:smooth(.9,1,amount),active:amount>.001};
}

// Intersect the real study rectangle with a finely sampled circle. Clipping the
// perimeter, rather than clamping its coordinates, preserves straight boundary
// sections and avoids foldovers or invented land beyond the available terrain.
export function inspectionCropPerimeter(center,radius,bounds,segments=192) {
  const count=clamp(Math.round(segments),160,252);
  let polygon=Array.from({length:count},(_,index)=>{
    const angle=index/count*Math.PI*2;
    return {x:center.x+Math.cos(angle)*radius,z:center.z+Math.sin(angle)*radius};
  });
  for(const [axis,limit,sign] of [['x',-bounds.width/2,1],['x',bounds.width/2,-1],['z',-bounds.depth/2,1],['z',bounds.depth/2,-1]]) {
    const input=polygon;polygon=[];if(!input.length)break;
    let previous=input.at(-1),previousInside=(previous[axis]-limit)*sign>=-1e-10;
    for(const point of input) {
      const inside=(point[axis]-limit)*sign>=-1e-10;
      if(inside!==previousInside) {
        const t=(limit-previous[axis])/(point[axis]-previous[axis]);
        polygon.push({x:previous.x+(point.x-previous.x)*t,z:previous.z+(point.z-previous.z)*t,[axis]:limit});
      }
      if(inside)polygon.push(point);
      previous=point;previousInside=inside;
    }
  }
  return polygon.filter((point,index)=>{
    const previous=polygon[(index+polygon.length-1)%polygon.length];
    return Math.hypot(point.x-previous.x,point.z-previous.z)>1e-8;
  });
}

export function inspectionCropContains(point,center,state,bounds,margin=0) {
  if(!state.active)return true;
  return Math.abs(point.x)<=bounds.width/2+margin&&Math.abs(point.z)<=bounds.depth/2+margin&&Math.hypot(point.x-center.x,point.z-center.z)<=state.radius+margin;
}

function mainBody(source) {
  const match=/\bvoid\s+main\s*\(\s*(?:void\s*)?\)\s*\{/.exec(source);
  if(!match)return null;
  const start=match.index+match[0].length;
  // Comments can contain braces. Ignore them while locating the end of main.
  let depth=1,lineComment=false,blockComment=false;
  for(let index=start;index<source.length;index++) {
    const current=source[index],next=source[index+1];
    if(lineComment){if(current==='\n')lineComment=false;continue;}
    if(blockComment){if(current==='*'&&next==='/'){blockComment=false;index++;}continue;}
    if(current==='/'&&next==='/'){lineComment=true;index++;continue;}
    if(current==='/'&&next==='*'){blockComment=true;index++;continue;}
    if(current==='{')depth++;
    else if(current==='}'&&!--depth)return {declaration:match.index,start,end:index};
  }
  return null;
}

// Reconstruct from the final projected vertex. This includes shader-generated
// particles and camera-facing billboards, as well as morphs and instancing.
export function addInspectionCropShader(vertexShader,fragmentShader) {
  const vertex=mainBody(vertexShader),fragment=mainBody(fragmentShader);
  if(!vertex||!fragment)return null;
  const vertexDeclarations='uniform mat4 inspectionCropInverseProjection;\nuniform mat4 inspectionCropInverseView;\nvarying vec2 inspectionCropGround;\n';
  const fragmentDeclarations='uniform vec2 inspectionCropCenter;\nuniform vec2 inspectionCropHalfExtent;\nuniform float inspectionCropRadius;\nuniform float inspectionCropEnabled;\nvarying vec2 inspectionCropGround;\n';
  const vertexBody='\nvec4 inspectionCropWorld = inspectionCropInverseView * inspectionCropInverseProjection * gl_Position;\ninspectionCropGround = inspectionCropWorld.xz / inspectionCropWorld.w;\n';
  const fragmentBody='\nif (inspectionCropEnabled > .5) {\n  vec2 cropOffset = inspectionCropGround - inspectionCropCenter;\n  if (dot(cropOffset,cropOffset) > inspectionCropRadius * inspectionCropRadius || any(greaterThan(abs(inspectionCropGround), inspectionCropHalfExtent + vec2(.001)))) discard;\n}\n';
  return {
    vertexShader:vertexShader.slice(0,vertex.declaration)+vertexDeclarations+vertexShader.slice(vertex.declaration,vertex.end)+vertexBody+vertexShader.slice(vertex.end),
    fragmentShader:fragmentShader.slice(0,fragment.declaration)+fragmentDeclarations+fragmentShader.slice(fragment.declaration,fragment.start)+fragmentBody+fragmentShader.slice(fragment.start)
  };
}
