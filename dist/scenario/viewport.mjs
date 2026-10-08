export function createViewportResizer(camera,renderer,display) {
  let previousWidth=0,previousHeight=0;
  return (width,height)=>{
    if(width<=0||height<=0||(width===previousWidth&&height===previousHeight))return false;
    previousWidth=width;previousHeight=height;
    camera.aspect=width/height;
    if(camera.isOrthographicCamera){const halfHeight=(camera.top-camera.bottom)/2;camera.left=-halfHeight*camera.aspect;camera.right=halfHeight*camera.aspect;}
    camera.updateProjectionMatrix();
    renderer.setSize(width,height,false);
    display.resize();
    return true;
  };
}
