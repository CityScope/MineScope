import * as THREE from 'three';
import {surfaceHeight,clamp,bounds} from './model.mjs?v=20261010-footprint1';
import {siteMoved} from './render-policy.mjs?v=20261007-ws-status1';

export function createContactLight(scene,color,size=1.8) {
  const geometry=new THREE.PlaneGeometry(size,size,20,20);geometry.rotateX(-Math.PI/2);
  const vertexShader='varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}';
  const shadow=new THREE.Mesh(geometry,new THREE.ShaderMaterial({vertexShader,fragmentShader:'varying vec2 vUv;uniform float strength;void main(){vec2 p=(vUv-.5)*2.0;float a=exp(-dot(p,p)*7.0)*strength*.3;gl_FragColor=vec4(0.0,0.0,0.0,a);}',uniforms:{strength:{value:1}},transparent:true,depthWrite:false,toneMapped:false}));
  shadow.renderOrder=2;scene.add(shadow);
  const glow=new THREE.Mesh(geometry,new THREE.ShaderMaterial({vertexShader,fragmentShader:'varying vec2 vUv;uniform float strength;uniform vec3 color;void main(){vec2 p=(vUv-.5)*2.0;float a=exp(-dot(p,p)*4.5)*strength*.16;gl_FragColor=vec4(color*1.8,a);}',uniforms:{strength:{value:1},color:{value:new THREE.Color(color)}},transparent:true,depthWrite:false,toneMapped:false,blending:THREE.AdditiveBlending}));
  glow.renderOrder=3;scene.add(glow);
  let previous;
  return {
    update(location,strength=1,visible=true){
      shadow.visible=glow.visible=visible;
      shadow.material.uniforms.strength.value=.4+.6*strength;glow.material.uniforms.strength.value=strength;
      if(!siteMoved(previous,location))return;
      const position=geometry.attributes.position,uv=geometry.attributes.uv;
      for(let i=0;i<position.count;i++) {
        const x=clamp(location.x+(uv.getX(i)-.5)*size,-bounds.width/2,bounds.width/2),z=clamp(location.z+(.5-uv.getY(i))*size,-bounds.depth/2,bounds.depth/2);
        position.setXYZ(i,x,surfaceHeight(x,z)+.1,z);
      }
      position.needsUpdate=true;geometry.computeBoundingSphere();previous={...location};
    }
  };
}
