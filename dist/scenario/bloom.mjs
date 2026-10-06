import * as THREE from 'three';
import {Pass,FullScreenQuad} from 'three/addons/postprocessing/Pass.js';

const vertexShader='varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}';
function material(fragmentShader,uniforms={}) {
  return new THREE.ShaderMaterial({vertexShader,fragmentShader:`varying vec2 vUv;${fragmentShader}`,uniforms,depthWrite:false,depthTest:false,toneMapped:false});
}
export class SoftBloomPass extends Pass {
  constructor() {
    super();this.needsSwap=false;
    this.a=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthBuffer:false});this.b=this.a.clone();
    this.extract=material('uniform sampler2D source;void main(){vec3 c=texture2D(source,vUv).rgb;float l=dot(c,vec3(.2126,.7152,.0722));gl_FragColor=vec4(c*smoothstep(.92,1.25,l),1.0);}',{source:{value:null}});
    this.blur=material(`uniform sampler2D source;uniform vec2 stepSize;
void main(){vec3 c=texture2D(source,vUv).rgb*.227027;
c+=(texture2D(source,vUv+stepSize*1.384615).rgb+texture2D(source,vUv-stepSize*1.384615).rgb)*.316216;
c+=(texture2D(source,vUv+stepSize*3.230769).rgb+texture2D(source,vUv-stepSize*3.230769).rgb)*.070270;
gl_FragColor=vec4(c,1.0);}`,{source:{value:null},stepSize:{value:new THREE.Vector2()}});
    this.add=material('uniform sampler2D source;void main(){gl_FragColor=vec4(texture2D(source,vUv).rgb*.24,1.0);}',{source:{value:this.a.texture}});
    this.add.blending=THREE.AdditiveBlending;this.add.transparent=true;
    this.quad=new FullScreenQuad(this.extract);
  }
  setSize(width,height){this.width=Math.max(1,Math.ceil(width/4));this.height=Math.max(1,Math.ceil(height/4));this.a.setSize(this.width,this.height);this.b.setSize(this.width,this.height);}
  render(renderer,writeBuffer,readBuffer) {
    const autoClear=renderer.autoClear;renderer.autoClear=false;
    this.extract.uniforms.source.value=readBuffer.texture;this.quad.material=this.extract;
    renderer.setRenderTarget(this.a);this.quad.render(renderer);
    this.quad.material=this.blur;this.blur.uniforms.source.value=this.a.texture;this.blur.uniforms.stepSize.value.set(1/this.width,0);
    renderer.setRenderTarget(this.b);this.quad.render(renderer);
    this.blur.uniforms.source.value=this.b.texture;this.blur.uniforms.stepSize.value.set(0,1/this.height);
    renderer.setRenderTarget(this.a);this.quad.render(renderer);
    this.quad.material=this.add;renderer.setRenderTarget(readBuffer);this.quad.render(renderer);
    renderer.autoClear=autoClear;
  }
  dispose(){this.a.dispose();this.b.dispose();this.extract.dispose();this.blur.dispose();this.add.dispose();this.quad.dispose();}
}
