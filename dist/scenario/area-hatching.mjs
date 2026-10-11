import * as THREE from 'three';
import {surfaceHeight,habitatBoundary,bounds} from './model.mjs?v=20261010-footprint1';
import {maskedIndices} from './mesh-budget.mjs?v=20261007-ws-status1';

export function createHatchedArea(scene,field,color,direction,opacity) {
  const geometry=new THREE.PlaneGeometry(bounds.width,bounds.depth,256,256);geometry.rotateX(-Math.PI/2);
  const positions=geometry.attributes.position,mask=new Float32Array(positions.count);
  for(let i=0;i<positions.count;i++) {
    const x=positions.getX(i),z=positions.getZ(i);
    positions.setY(i,surfaceHeight(x,z)+.14);mask[i]=field(x,z);
  }
  geometry.setAttribute('areaMask',new THREE.BufferAttribute(mask,1));geometry.setIndex(new THREE.BufferAttribute(maskedIndices(256,mask),1));geometry.computeBoundingSphere();
  const material=new THREE.ShaderMaterial({
    uniforms:{color:{value:new THREE.Color(color)},axis:{value:new THREE.Vector2(...direction).normalize()},opacity:{value:opacity},boundary:{value:habitatBoundary}},
    vertexShader:`attribute float areaMask;varying float vMask;varying vec2 vGround;
void main(){vMask=areaMask;vGround=position.xz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:`uniform vec3 color;uniform vec2 axis;uniform float opacity;uniform float boundary;varying float vMask;varying vec2 vGround;
void main(){
  float edgeAA=max(fwidth(vMask),.0005);
  float area=smoothstep(boundary-edgeAA,boundary+edgeAA,vMask);
  float edge=1.0-smoothstep(edgeAA*.25,edgeAA*1.15,abs(vMask-boundary));
  float coordinate=dot(vGround,axis)/.55;
  float distanceToStripe=abs(fract(coordinate+.5)-.5);
  float aa=max(fwidth(coordinate)*.6,.004);
  float stripe=1.0-smoothstep(max(0.0,.035-aa),.035+aa,distanceToStripe);
  float alpha=max(area*stripe*opacity,edge*min(opacity*1.5,.45));
  if(alpha<.002)discard;
  gl_FragColor=vec4(color*2.0,alpha);
  #include <colorspace_fragment>
}`,
    transparent:true,depthWrite:false,depthTest:false,side:THREE.DoubleSide,toneMapped:false,blending:THREE.AdditiveBlending
  });
  const area=new THREE.Mesh(geometry,material);area.renderOrder=6;scene.add(area);return area;
}
