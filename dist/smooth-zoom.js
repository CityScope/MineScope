/* Continuous wheel zoom for the bundled Leaflet 1.9.4 map. */
(() => {
  'use strict';
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const idleTime=140,settleDistance=.001,maxLead=1.25;

  L.Map.mergeOptions({smoothWheelZoom:false,smoothWheelPxPerZoomLevel:360});
  L.Map.SmoothWheelZoom=L.Handler.extend({
    addHooks(){
      this._container=this._map.getContainer();
      this._wheel=this._onWheel.bind(this);
      this._interrupt=this._finish.bind(this);
      this._tick=this._onFrame.bind(this);
      this._container.addEventListener('wheel',this._wheel,{passive:false});
      // Finish before a drag, touch pinch, keyboard action or map control takes over.
      this._container.addEventListener('pointerdown',this._interrupt,true);
      this._container.addEventListener('keydown',this._interrupt,true);
      window.addEventListener('blur',this._interrupt);
      this._map.on('movestart zoomstart',this._onOtherMove,this);
      this._map.on('unload',this.disable,this);
    },

    removeHooks(){
      this._finish();
      this._container.removeEventListener('wheel',this._wheel);
      this._container.removeEventListener('pointerdown',this._interrupt,true);
      this._container.removeEventListener('keydown',this._interrupt,true);
      window.removeEventListener('blur',this._interrupt);
      this._map.off('movestart zoomstart',this._onOtherMove,this);
      this._map.off('unload',this.disable,this);
    },

    _onWheel(event){
      const map=this._map;
      if(!map._loaded||event.defaultPrevented||event.shiftKey||
        event.target.closest?.('.leaflet-control')||Math.abs(event.deltaX)>Math.abs(event.deltaY))return;
      // WheelEvent units differ between mice and browsers; trackpads use pixels.
      const unit=event.deltaMode===1?16:event.deltaMode===2?map.getSize().y:1;
      const pixels=event.deltaY*unit;
      if(!Number.isFinite(pixels)||pixels===0)return;
      event.preventDefault();
      event.stopPropagation();
      const delta=-pixels/(event.ctrlKey?100:map.options.smoothWheelPxPerZoomLevel);
      const now=performance.now();

      if(!this._active){
        // Stop a previous fly-to or button animation before taking ownership.
        map._stop();
        if(map._animatingZoom)map._onZoomTransitionEnd();
        this._target=map.getZoom();
        if(clamp(this._target+delta,map.getMinZoom(),map.getMaxZoom())===this._target)return;
        this._active=true;
        this._point=null;
        this._direction=0;
        this._lastFrame=now;
        this._starting=true;
        map._moveStart(true,false);
        this._starting=false;
      }

      const point=map.mouseEventToContainerPoint(event);
      if(!this._point||!point.equals(this._point)){
        this._point=point;
        this._anchor=map.containerPointToLatLng(point);
      }
      const zoom=map.getZoom(),direction=Math.sign(delta);
      // Reversing the wheel cancels pending travel in the old direction immediately.
      if(this._direction&&direction!==this._direction)this._target=zoom;
      this._direction=direction;
      this._target=clamp(clamp(this._target+delta,zoom-maxLead,zoom+maxLead),map.getMinZoom(),map.getMaxZoom());
      this._lastInput=now;
      if(!this._frame)this._frame=requestAnimationFrame(this._tick);
    },

    _onFrame(now){
      this._frame=0;
      if(!this._active)return;
      const map=this._map,zoom=map.getZoom();
      const elapsed=clamp(now-this._lastFrame,0,50);
      this._lastFrame=now;
      this._target=clamp(this._target,map.getMinZoom(),map.getMaxZoom());
      if(now-this._lastInput>=idleTime)this._target=Math.round(this._target*1e9)/1e9;
      const remaining=this._target-zoom;
      const step=clamp(remaining*(1-Math.exp(-elapsed/65)),-elapsed*.004,elapsed*.004);
      const next=Math.abs(remaining)<settleDistance?this._target:zoom+step;
      if(next!==zoom){
        const offset=this._point.subtract(map.getSize().divideBy(2));
        const center=map.unproject(map.project(this._anchor,next).subtract(offset),next);
        // Leaflet's pinch path transforms existing tiles and canvases each frame.
        // Keep one gesture open so note clusters are rebuilt only after it ends.
        map._move(center,next,{pinch:true,round:false});
      }
      if(now-this._lastInput>=idleTime&&next===this._target){
        this._finish();
      }else{
        this._frame=requestAnimationFrame(this._tick);
      }
    },

    _onOtherMove(){if(!this._starting)this._finish();},

    _finish(){
      if(this._frame)cancelAnimationFrame(this._frame);
      this._frame=0;
      if(!this._active)return;
      this._active=false;
      // End at the displayed position, including when another interaction interrupts.
      // A regular zoom event releases pinch tile retention before the final redraw.
      this._map.fire('zoom');
      this._map._moveEnd(true);
    }
  });
  L.Map.addInitHook('addHandler','smoothWheelZoom',L.Map.SmoothWheelZoom);
})();
