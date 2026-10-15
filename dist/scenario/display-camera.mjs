export function fitIsometricCamera(camera,target,points,aspect){
  const Vector=camera.position.constructor,direction=new Vector(1,1,1).normalize();
  const right=new Vector().crossVectors(new Vector(0,1,0),direction).normalize();
  const up=new Vector().crossVectors(direction,right);
  const low=[Infinity,Infinity,Infinity],high=[-Infinity,-Infinity,-Infinity];
  for(const point of points)for(let axis=0;axis<3;axis++){low[axis]=Math.min(low[axis],point[axis]);high[axis]=Math.max(high[axis],point[axis]);}
  target.set(...low.map((value,axis)=>(value+high[axis])/2));
  let halfWidth=0,halfHeight=0;
  for(const point of points){const offset=new Vector(...point).sub(target);halfWidth=Math.max(halfWidth,Math.abs(offset.dot(right)));halfHeight=Math.max(halfHeight,Math.abs(offset.dot(up)));}
  halfHeight=Math.max(halfHeight,halfWidth/aspect)*1.06;
  Object.assign(camera,{left:-halfHeight*aspect,right:halfHeight*aspect,top:halfHeight,bottom:-halfHeight,aspect,zoom:1});
  camera.position.copy(target).addScaledVector(direction,60);camera.lookAt(target);camera.updateProjectionMatrix();
}

export class DisplayCameraRig{
  constructor(camera,target,{reducedMotion=false}={}){
    this.camera=camera;this.target=target;this.Vector=camera.position.constructor;
    this.overview=target.clone();this.direction=camera.position.clone().sub(target).normalize();
    this.overviewDirection=this.direction.clone();this.orbitAxis=new this.Vector(0,1,0);
    this.right=new this.Vector().crossVectors(new this.Vector(0,1,0),this.direction).normalize();
    this.up=new this.Vector().crossVectors(this.direction,this.right);
    this.distance=camera.position.distanceTo(target);this.reducedMotion=reducedMotion;
    this.restDelay=.65;this.movementThreshold=.08;this.overviewZoom=1.45;this.detailZoom=3.45;
    this.phase='moving';this.detail=0;this.restElapsed=0;this.moving=false;this.site=null;
    this.orbitAngle=0;this.orbitSpeed=.045;this.orbiting=false;this.inspectionFrame=null;
    camera.zoom=this.overviewZoom;camera.updateProjectionMatrix();
  }
  track(point){
    // Measure from the last accepted position so small intentional steps accumulate,
    // while stationary sensor noise and repeated snapshots leave the rest timer alone.
    if(![point.x,point.y,point.z].every(Number.isFinite))return false;
    if(this.site&&this.site.distanceToSquared(point)<this.movementThreshold**2)return false;
    if(this.site)this.site.copy(point);else this.site=point.clone();
    this.phase='moving';this.restElapsed=0;this.orbiting=false;this.moving=true;return true;
  }
  setInspectionFrame(frame){
    if(frame===null){this.inspectionFrame=null;this.moving=Boolean(this.site);return true;}
    const {center,radius,minY,maxY}=frame||{};
    if(!center||![center.x,center.z,radius,minY,maxY].every(Number.isFinite)||radius<=0||maxY<minY)return false;
    this.inspectionFrame={center:new this.Vector(center.x,(minY+maxY)/2,center.z),radius,minY,maxY};
    this.moving=Boolean(this.site);return true;
  }
  keepSiteVisible(focus,zoom){
    const offset=this.site.clone().sub(focus);
    const horizontal=offset.dot(this.right),vertical=offset.dot(this.up);
    const limitX=(this.camera.right-this.camera.left)/2/zoom*.76;
    const limitY=(this.camera.top-this.camera.bottom)/2/zoom*.7;
    focus.addScaledVector(this.right,horizontal-Math.max(-limitX,Math.min(limitX,horizontal)));
    focus.addScaledVector(this.up,vertical-Math.max(-limitY,Math.min(limitY,vertical)));
  }
  advance(seconds){
    const resting=this.phase==='resting',frame=resting?this.inspectionFrame:null;
    let zoom=resting?this.detailZoom:this.overviewZoom;
    if(frame){
      // Fit the whole section, including relief and the cutaway wall, at any aspect ratio.
      const halfHeight=frame.radius*Math.abs(this.overviewDirection.y)+(frame.maxY-frame.minY)/2*Math.sqrt(1-this.overviewDirection.y**2);
      zoom=Math.min(zoom,(this.camera.right-this.camera.left)/2*.88/frame.radius,(this.camera.top-this.camera.bottom)/2*.84/Math.max(.001,halfHeight));
    }
    const alpha=this.reducedMotion?1:1-Math.exp(-seconds*(resting?2.8:9));
    const detailAlpha=this.reducedMotion?1:1-Math.exp(-seconds*(resting?3.2:12));
    const previousDetail=this.detail;
    this.detail+=((resting?1:0)-this.detail)*detailAlpha;
    this.orbiting=resting&&!this.reducedMotion;
    if(this.orbiting){
      // Fade the orbit in with the close-up, preserving the current angle when it starts.
      const angle=this.orbitAngle+this.orbitSpeed*seconds*(previousDetail+this.detail)/2;
      this.orbitAngle=Math.atan2(Math.sin(angle),Math.cos(angle));
    }else{
      // Accepted movement stops the orbit immediately, then eases back to the overview side.
      this.orbitAngle*=1-alpha;
      if(Math.abs(this.orbitAngle)<.00001)this.orbitAngle=0;
    }
    this.direction.copy(this.overviewDirection).applyAxisAngle(this.orbitAxis,this.orbitAngle);
    this.right.crossVectors(this.orbitAxis,this.direction).normalize();
    this.up.crossVectors(this.direction,this.right);
    const focus=frame?frame.center.clone():resting?this.site.clone():this.overview.clone().lerp(this.site,.58);
    this.keepSiteVisible(focus,zoom);
    this.target.lerp(focus,alpha);this.camera.zoom+=(zoom-this.camera.zoom)*alpha;
    // An abrupt sensor relocation must stay visible even during the return to overview.
    this.keepSiteVisible(this.target,this.camera.zoom);
    const settled=this.target.distanceToSquared(focus)<.000004&&Math.abs(zoom-this.camera.zoom)<.002&&Math.abs((resting?1:0)-this.detail)<.001&&(resting||this.orbitAngle===0);
    if(settled){this.target.copy(focus);this.camera.zoom=zoom;this.detail=resting?1:0;}
    this.camera.position.copy(this.target).addScaledVector(this.direction,this.distance);
    this.camera.lookAt(this.target);this.camera.updateProjectionMatrix();this.camera.updateMatrixWorld();
    return settled;
  }
  tick(seconds,{freshMovement=false}={}){
    if(!this.site)return false;
    if(!this.moving){
      if(!this.inspectionFrame)return false;
      const previousZoom=this.camera.zoom,previousTarget=this.target.clone();this.advance(0);
      return previousZoom!==this.camera.zoom||!previousTarget.equals(this.target);
    }
    seconds=Number.isFinite(seconds)?Math.max(0,seconds):0;
    // Hidden tabs still become resting on time, without jumping through an unseen orbit.
    let animationSeconds=Math.min(seconds,.1);
    const wasMoving=this.moving;
    if(this.phase==='moving'){
      const broadSeconds=Math.min(animationSeconds,Math.max(0,this.restDelay-this.restElapsed));
      this.advance(broadSeconds);
      // A new sample starts its own rest delay, but the return animation still advances.
      this.restElapsed+=freshMovement?0:seconds;
      if(this.restElapsed<this.restDelay){this.moving=true;return true;}
      this.restElapsed=this.restDelay;this.phase='resting';animationSeconds-=broadSeconds;
    }
    const settled=this.advance(animationSeconds);
    this.moving=this.orbiting||!settled;
    return wasMoving||this.moving;
  }
}
