import * as THREE from 'three';
import {bounds,geographyData} from './model.mjs?v=20261010-footprint1';

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
  const {elevation}=geographyData(),size=elevation.width,count=size*size,distance=new Float32Array(count),pixels=new Uint8Array(count*4);
  for(let i=0;i<count;i++)distance[i]=elevation.data[i]<=0?10000:0;
  const dx=bounds.width/(size-1),dz=bounds.depth/(size-1),diag=Math.hypot(dx,dz);
  for(let j=0;j<size;j++)for(let i=0;i<size;i++){const k=j*size+i;if(i)distance[k]=Math.min(distance[k],distance[k-1]+dx);if(j)distance[k]=Math.min(distance[k],distance[k-size]+dz);if(i&&j)distance[k]=Math.min(distance[k],distance[k-size-1]+diag);if(i<size-1&&j)distance[k]=Math.min(distance[k],distance[k-size+1]+diag);}
  for(let j=size-1;j>=0;j--)for(let i=size-1;i>=0;i--){const k=j*size+i;if(i<size-1)distance[k]=Math.min(distance[k],distance[k+1]+dx);if(j<size-1)distance[k]=Math.min(distance[k],distance[k+size]+dz);if(i<size-1&&j<size-1)distance[k]=Math.min(distance[k],distance[k+size+1]+diag);if(i&&j<size-1)distance[k]=Math.min(distance[k],distance[k+size-1]+diag);}
  for(let i=0;i<count;i++){pixels[i*4]=elevation.data[i]<=0?255:0;pixels[i*4+1]=Math.min(255,Math.round(distance[i]/2.5*255));pixels[i*4+3]=255;}
  const field=new THREE.DataTexture(pixels,size,size);field.minFilter=field.magFilter=THREE.LinearFilter;field.needsUpdate=true;
  const geometry=new THREE.PlaneGeometry(bounds.width,bounds.depth,128,128);geometry.rotateX(-Math.PI/2);const positions=geometry.attributes.position;
  for(let i=0;i<positions.count;i++)positions.setY(i,.13);geometry.computeBoundingSphere();
  const material=new THREE.ShaderMaterial({uniforms:{time:{value:0},seaField:{value:field}},side:THREE.DoubleSide,
    vertexShader:`uniform float time;uniform sampler2D seaField;varying vec2 seaUv;
varying vec3 waterPosition;varying float vShore;
${waves}
void main(){
  seaUv=vec2(uv.x,1.0-uv.y);float shoreDistance=texture2D(seaField,seaUv).g*2.5;vec3 p=position;float shoaling=mix(.35,1.0,smoothstep(0.0,.55,shoreDistance));
  p.y+=surface(p.xz).x*shoaling;
  waterPosition=(modelMatrix*vec4(p,1.0)).xyz;vShore=shoreDistance;
  gl_Position=projectionMatrix*viewMatrix*vec4(waterPosition,1.0);
}`,
    fragmentShader:`uniform float time;uniform sampler2D seaField;varying vec2 seaUv;varying vec3 waterPosition;varying float vShore;
${waves}
float ripples(vec2 p){vec2 q=vec2(p.x*4.2-time*.14,p.y*1.7+time*.04);
q+=vec2(noise(p*.6),noise(p*.6+7.5))*.7;return noise(q)+.38*noise(q*2.1+5.0);}
void main(){
  vec4 sea=texture2D(seaField,seaUv);if(sea.r<.5)discard;float shore=sea.g*2.5;
  vec2 p=waterPosition.xz;vec3 swell=surface(p);
  float shoaling=mix(.35,1.0,smoothstep(0.0,.55,shore));
  vec2 fineSlope=vec2(ripples(p+vec2(.025,0.0))-ripples(p-vec2(.025,0.0)),ripples(p+vec2(0.0,.025))-ripples(p-vec2(0.0,.025)))*.22;
  vec3 normal=normalize(vec3(-swell.y*shoaling-fineSlope.x,1.0,-swell.z*shoaling-fineSlope.y));
  vec3 viewDirection=normalize(cameraPosition-waterPosition);
  float fresnel=.025+.975*pow(1.0-max(dot(viewDirection,normal),0.0),5.0);
  vec3 reflected=reflect(-viewDirection,normal);
  vec3 sky=mix(vec3(.06,.115,.17),vec3(.56,.66,.73),smoothstep(-.2,1.0,reflected.y));
  vec3 deep=vec3(.008,.052,.08),shallow=vec3(.028,.19,.205);
  vec3 color=mix(shallow,deep,smoothstep(.05,2.3,shore));
  color=mix(color,sky,.035+fresnel*.58);
  vec3 lightDirection=normalize(vec3(-.28,.85,-.45));
  vec3 halfway=normalize(lightDirection+viewDirection);
  float highlight=pow(max(dot(normal,halfway),0.0),125.0);
  color+=vec3(.82,.89,.9)*highlight*.13;
  float broadRipple=.5+.5*sin(p.x*3.9+p.y*1.1-time*1.1);
  color*=.92+broadRipple*.08;
  float warpedShore=shore+noise(p*3.0-vec2(time*.12,0.0))*.045;
  float crest=smoothstep(.78,.99,sin(warpedShore*18.0+time*1.3+noise(p*1.9)*.6));
  float breaks=smoothstep(.27,.7,noise(p*25.0-vec2(time*.35,time*.08)));
  float foam=crest*breaks*(1.0-smoothstep(.03,.5,shore))*.55;
  foam+=exp(-shore*48.0)*(.18+noise(p*38.0)*.18);
  color=mix(color,vec3(.59,.72,.73),clamp(foam,0.0,.7));
  gl_FragColor=vec4(color,1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`});
  const mesh=new THREE.Mesh(geometry,material);mesh.renderOrder=1;scene.add(mesh);
  return material;
}
