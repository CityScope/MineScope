import * as THREE from 'three';
import {coastline} from './model.mjs';

const waves=`
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),f.x),mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0)),f.x),f.y);}
vec3 wave(vec2 p,vec2 direction,float frequency,float amplitude,float speed,float phase) {
  float angle=dot(p,direction)*frequency-time*speed+phase+noise(p*.7+phase)*1.5;
  float slope=cos(angle)*amplitude*frequency;
  return vec3(sin(angle)*amplitude,direction.x*slope,direction.y*slope);
}
vec3 surface(vec2 p) {
  return wave(p,normalize(vec2(1.0,.28)),3.9,.019,1.1,0.0)
    +wave(p,normalize(vec2(.91,-.4)),7.1,.007,.82,1.7)
    +wave(p,normalize(vec2(.76,.65)),13.8,.0016,1.45,2.9)
    +wave(p,normalize(vec2(.95,-.31)),25.5,.0004,1.12,.4);
}`;

export function createOcean(scene) {
  const geometry=new THREE.PlaneGeometry(1,1,80,240),positions=geometry.attributes.position,uv=geometry.attributes.uv;
  const distances=new Float32Array(positions.count);
  for(let i=0;i<positions.count;i++) {
    const z=-6.5+13*uv.getY(i),shore=coastline(z),x=-11+(shore+11)*uv.getX(i);
    positions.setXYZ(i,x,.16,z);distances[i]=shore-x;
  }
  geometry.setAttribute('shoreDistance',new THREE.BufferAttribute(distances,1));geometry.computeBoundingSphere();
  const material=new THREE.ShaderMaterial({uniforms:{time:{value:0}},side:THREE.DoubleSide,
    vertexShader:`uniform float time;attribute float shoreDistance;
varying vec3 waterPosition;varying float vShore;
${waves}
void main(){
  vec3 p=position;float shoaling=mix(.35,1.0,smoothstep(0.0,.55,shoreDistance));
  p.y+=surface(p.xz).x*shoaling;
  waterPosition=(modelMatrix*vec4(p,1.0)).xyz;vShore=shoreDistance;
  gl_Position=projectionMatrix*viewMatrix*vec4(waterPosition,1.0);
}`,
    fragmentShader:`uniform float time;varying vec3 waterPosition;varying float vShore;
${waves}
float ripples(vec2 p){vec2 q=vec2(p.x*4.2-time*.14,p.y*1.7+time*.04);
q+=vec2(noise(p*.6),noise(p*.6+7.5))*.7;return noise(q)+.38*noise(q*2.1+5.0);}
void main(){
  vec2 p=waterPosition.xz;vec3 swell=surface(p);
  float shoaling=mix(.35,1.0,smoothstep(0.0,.55,vShore));
  vec2 fineSlope=vec2(ripples(p+vec2(.025,0.0))-ripples(p-vec2(.025,0.0)),ripples(p+vec2(0.0,.025))-ripples(p-vec2(0.0,.025)))*.22;
  vec3 normal=normalize(vec3(-swell.y*shoaling-fineSlope.x,1.0,-swell.z*shoaling-fineSlope.y));
  vec3 viewDirection=normalize(cameraPosition-waterPosition);
  float fresnel=.025+.975*pow(1.0-max(dot(viewDirection,normal),0.0),5.0);
  vec3 reflected=reflect(-viewDirection,normal);
  vec3 sky=mix(vec3(.06,.115,.17),vec3(.56,.66,.73),smoothstep(-.2,1.0,reflected.y));
  vec3 deep=vec3(.008,.052,.08),shallow=vec3(.028,.19,.205);
  vec3 color=mix(shallow,deep,smoothstep(.05,2.3,vShore));
  color=mix(color,sky,.035+fresnel*.58);
  vec3 lightDirection=normalize(vec3(-.28,.85,-.45));
  vec3 halfway=normalize(lightDirection+viewDirection);
  float highlight=pow(max(dot(normal,halfway),0.0),125.0);
  color+=vec3(.82,.89,.9)*highlight*.13;
  float broadRipple=.5+.5*sin(p.x*3.9+p.y*1.1-time*1.1);
  color*=.92+broadRipple*.08;
  float warpedShore=vShore+noise(p*3.0-vec2(time*.12,0.0))*.045;
  float crest=smoothstep(.78,.99,sin(warpedShore*18.0+time*1.3+noise(p*1.9)*.6));
  float breaks=smoothstep(.27,.7,noise(p*25.0-vec2(time*.35,time*.08)));
  float foam=crest*breaks*(1.0-smoothstep(.03,.5,vShore))*.55;
  foam+=exp(-vShore*48.0)*(.18+noise(p*38.0)*.18);
  color=mix(color,vec3(.59,.72,.73),clamp(foam,0.0,.7));
  gl_FragColor=vec4(color,1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`});
  const mesh=new THREE.Mesh(geometry,material);mesh.renderOrder=1;scene.add(mesh);
  return material;
}
