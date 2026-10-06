export const frontLimit=.62;
const sweep=.42,speed=.24;
export class CameraSway {
  active=false;
  start(angle) {
    const bounded=Math.max(-frontLimit,Math.min(frontLimit,angle));
    this.phase=Math.asin(Math.max(-1,Math.min(1,bounded/sweep)));
    this.offset=bounded-sweep*Math.sin(this.phase);this.elapsed=0;this.active=true;
  }
  stop(){this.active=false;}
  advance(seconds) {
    this.elapsed+=Math.max(0,seconds);
    return sweep*Math.sin(this.phase+this.elapsed*speed)+this.offset*Math.exp(-this.elapsed*2.5);
  }
}
