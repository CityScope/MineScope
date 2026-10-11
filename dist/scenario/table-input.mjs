export class TablePointerInput {
  constructor({getControls,pick,beginDrag,finishDrag,isDragging,blocked=()=>false}) {
    Object.assign(this,{getControls,pick,beginDrag,finishDrag,isDragging,blocked});
    this.touches=new Set();
  }
  down(event) {
    if(this.blocked(event)){event.stopImmediatePropagation();return;}
    const controls=this.getControls();if(!controls?.enabled)return;
    const touch=event.pointerType==='touch';
    if(touch){
      this.touches.add(event.pointerId);
      if(this.touches.size>1){
        if(this.isDragging())this.finishDrag(false,true);
        controls.enableRotate=true;return;
      }
    }
    if(event.button!==0||this.isDragging())return;
    const id=this.pick(event);if(!id)return;
    event.preventDefault();this.beginDrag(id,event);
    controls.enableRotate=!touch;
    controls.enabled=touch;
    if(!touch)event.stopImmediatePropagation();
  }
  end(event){this.touches.delete(event.pointerId);}
  restore(){const controls=this.getControls();if(controls){controls.enabled=true;controls.enableRotate=true;}}
}

export function nearHandle(pointer,center,radius=30) {
  return !!center&&Math.hypot(pointer.clientX-center.x,pointer.clientY-center.y)<=radius;
}
