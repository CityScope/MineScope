import * as THREE from 'three';

export function printedMaterial(color,options={}) {
  const {physical=false,...properties}=options;
  const mat=physical?new THREE.MeshPhysicalMaterial({color,roughness:.84,metalness:0,clearcoat:.025,clearcoatRoughness:.8,sheen:.06,sheenColor:'#fff0dc',sheenRoughness:.9,...properties}):new THREE.MeshStandardMaterial({color,roughness:.84,metalness:0,...properties});
  mat.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 printPosition;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nprintPosition = position;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 printPosition;')
      .replace('#include <color_fragment>',`#include <color_fragment>
        float frequency=printPosition.y*251.327;
        float resolution=1.0-smoothstep(0.4,3.0,fwidth(frequency));
        float filament=sin(frequency)*resolution;
        float grain=fract(sin(dot(printPosition.xz,vec2(127.1,311.7)))*43758.5453);
        diffuseColor.rgb *= 1.0 + filament*0.012 + (grain-0.5)*0.022;`)
      .replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
        #if NUM_DIR_LIGHTS > 0
        for(int printLight=0;printLight<NUM_DIR_LIGHTS;printLight++) {
          vec3 throughLight=normalize(directionalLights[printLight].direction+geometryNormal*0.38);
          float backScatter=pow(saturate(dot(geometryViewDir,-throughLight)),3.5);
          float thinEdge=0.25+0.75*exp(-abs(printPosition.y)*0.7);
          reflectedLight.directDiffuse += diffuseColor.rgb*vec3(1.0,0.88,0.73)
            *directionalLights[printLight].color*backScatter*thinEdge*0.08;
        }
        #endif`);
  };
  mat.customProgramCacheKey=()=> 'printed-relief-v2';return mat;
}

export function resinMaterial(color,options={}) {
  const mat=printedMaterial(color,{physical:true,roughness:.43,clearcoat:.22,clearcoatRoughness:.42,
    sheen:.22,sheenRoughness:.75,ior:1.46,emissive:color,emissiveIntensity:.28,...options});
  const printedCompile=mat.onBeforeCompile;
  mat.onBeforeCompile=shader=>{
    printedCompile(shader);
    shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
      vec3 scatterTint=diffuseColor.rgb*vec3(1.0,.91,.78);
      float viewRim=pow(1.0-saturate(dot(geometryNormal,geometryViewDir)),2.4);
      totalEmissiveRadiance *= .65+viewRim*2.2;
      #if NUM_DIR_LIGHTS > 0
      for(int sssLight=0;sssLight<NUM_DIR_LIGHTS;sssLight++) {
        vec3 direction=directionalLights[sssLight].direction;
        float wrap=pow(saturate((dot(geometryNormal,direction)+.55)/1.55),1.5);
        float through=pow(saturate(dot(geometryViewDir,-normalize(direction+geometryNormal*.4))),3.0);
        reflectedLight.directDiffuse += scatterTint*directionalLights[sssLight].color*(wrap*.08+through*.3);
      }
      #endif
      #if NUM_POINT_LIGHTS > 0
      for(int sssPoint=0;sssPoint<NUM_POINT_LIGHTS;sssPoint++) {
        IncidentLight light;getPointLightInfo(pointLights[sssPoint],geometryPosition,light);
        float through=pow(saturate(dot(geometryViewDir,-normalize(light.direction+geometryNormal*.45))),3.0);
        reflectedLight.directDiffuse += scatterTint*light.color*through*.16;
      }
      #endif`);
  };
  mat.customProgramCacheKey=()=> 'printed-resin-scatter-v1';return mat;
}
