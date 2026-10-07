export function createFrameProfile(canvas,renderer) {
  const frames=[],costs=[];let previous=0,input=0,paint=0;
  renderer.info.autoReset=false;
  return {
    input(){if(!input)input=performance.now();},
    start(){renderer.info.reset();return performance.now();},
    frame(start){
      const end=performance.now();
      if(previous){frames.push(end-previous);if(frames.length>60)frames.shift();}
      previous=end;costs.push(end-start);if(costs.length>60)costs.shift();
      if(input){paint=end-input;input=0;}
      canvas.dataset.profile=JSON.stringify({fps:Math.round(1000/(frames.reduce((a,b)=>a+b,0)/frames.length||1)),cpuMs:+(costs.reduce((a,b)=>a+b,0)/costs.length).toFixed(1),maxCpuMs:+Math.max(...costs).toFixed(1),inputPaintMs:+paint.toFixed(1),programs:renderer.info.programs.length,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,pixels:canvas.width*canvas.height});
    }
  };
}
