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
  constructor(camera,target){
    this.camera=camera;this.target=target;this.Vector=camera.position.constructor;
    this.angle=Math.atan2(camera.position.x-target.x,camera.position.z-target.z);this.desiredAngle=this.angle;
    this.focus=target.clone();this.baseHeight=target.y;this.moving=false;
    camera.zoom=1.45;camera.updateProjectionMatrix();
  }
  track(point){
    this.camera.updateMatrixWorld();const screen=point.clone().project(this.camera);
    if(Math.abs(screen.x)<.72&&Math.abs(screen.y)<.65)return false;
    const desired=Math.PI/4+Math.round((Math.atan2(point.x,point.z)-Math.PI/4)/(Math.PI/2))*Math.PI/2;
    let difference=desired-this.angle;difference=Math.atan2(Math.sin(difference),Math.cos(difference));
    this.desiredAngle=this.angle+difference;
    this.focus.set(point.x*.58,this.baseHeight*.4+point.y*.6,point.z*.58);
    this.moving=true;return true;
  }
  tick(seconds){
    if(!this.moving)return false;
    const alpha=1-Math.exp(-Math.min(seconds,.1)*5);
    this.angle+=(this.desiredAngle-this.angle)*alpha;this.target.lerp(this.focus,alpha);
    if(Math.abs(this.desiredAngle-this.angle)<.001&&this.target.distanceTo(this.focus)<.01){this.angle=this.desiredAngle;this.target.copy(this.focus);this.moving=false;}
    const direction=new this.Vector(Math.sin(this.angle),Math.SQRT1_2,Math.cos(this.angle)).normalize();
    this.camera.position.copy(this.target).addScaledVector(direction,60);this.camera.lookAt(this.target);this.camera.updateMatrixWorld();return true;
  }
}
