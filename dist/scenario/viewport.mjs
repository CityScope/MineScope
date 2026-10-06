export function createViewportResizer(camera,renderer,display) {
  let previousWidth=0,previousHeight=0;
  return (width,height)=>{
    if(width<=0||height<=0||(width===previousWidth&&height===previousHeight))return false;
    previousWidth=width;previousHeight=height;
    camera.aspect=width/height;
    camera.updateProjectionMatrix();
    renderer.setSize(width,height,false);
    display.resize();
    return true;
  };
}
