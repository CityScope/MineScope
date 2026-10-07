import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {FXAAShader} from 'three/addons/shaders/FXAAShader.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {RectAreaLightUniformsLib} from 'three/addons/lights/RectAreaLightUniformsLib.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {SoftBloomPass} from './bloom.mjs?v=20261007-ws-status1';

function addBackdrop(scene) {
  const backdrop=new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.ShaderMaterial({
    uniforms:{dark:{value:new THREE.Color('#0b111a')},blue:{value:new THREE.Color('#26364f')}},
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,.999999,1.0);}',
    fragmentShader:`varying vec2 vUv;uniform vec3 dark;uniform vec3 blue;
void main(){vec2 p=(vUv-vec2(.63,.36))*vec2(1.0,.85);float glow=exp(-dot(p,p)*3.8);gl_FragColor=vec4(mix(dark,blue,glow*.65),1.0);}`,
    depthWrite:false,depthTest:false,toneMapped:false
  }));
  backdrop.frustumCulled=false;backdrop.renderOrder=-1000;scene.add(backdrop);
  const shadow=new THREE.ShadowMaterial({opacity:.22,depthWrite:false});
  shadow.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec2 vFloor;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvFloor=uv*2.0-1.0;');
    shader.fragmentShader='varying vec2 vFloor;\n'+shader.fragmentShader.replace('#include <fog_fragment>','#include <fog_fragment>\ngl_FragColor.a*=1.0-smoothstep(.35,.95,length(vFloor));');
  };
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(70,70),shadow);
  floor.rotation.x=-Math.PI/2;floor.position.y=-.55;floor.receiveShadow=true;scene.add(floor);
}

export function createAtmosphere(renderer,scene,camera) {
  RectAreaLightUniformsLib.init();
  scene.background=new THREE.Color('#111823');
  scene.fog=new THREE.FogExp2('#111823',.006);
  const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment();
  const environment=pmrem.fromScene(room,.04);
  scene.environment=environment.texture;scene.environmentIntensity=.1;
  room.dispose();pmrem.dispose();

  addBackdrop(scene);
  const key=new THREE.DirectionalLight('#e2e9ff',.62);key.position.set(-12,13,5);key.castShadow=true;
  key.shadow.mapSize.set(1024,1024);Object.assign(key.shadow.camera,{left:-17,right:17,top:17,bottom:-17,far:50});
  key.shadow.normalBias=.012;key.shadow.bias=-.00008;key.shadow.radius=2.5;scene.add(key);
  scene.add(new THREE.HemisphereLight('#9aaed9','#172235',.16));
  const rim=new THREE.DirectionalLight('#7499d5',.22);rim.position.set(9,6,-10);scene.add(rim);
  const projector=new THREE.SpotLight('#c7d8fa',32,40,.79,.95,2);
  projector.position.set(-1,12,1);projector.target.position.set(0,0,0);scene.add(projector,projector.target);

  const target=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType});
  const composer=new EffectComposer(renderer,target);
  composer.addPass(new RenderPass(scene,camera));
  composer.addPass(new SoftBloomPass());
  composer.addPass(new OutputPass());
  const antialias=new ShaderPass(FXAAShader);composer.addPass(antialias);
  const size=new THREE.Vector2();let width=0,height=0,pixelRatio=0;
  return {
    render(){
      renderer.getSize(size);const ratio=renderer.getPixelRatio();
      if(width!==size.x||height!==size.y||pixelRatio!==ratio){
        width=size.x;height=size.y;pixelRatio=ratio;composer.setPixelRatio(ratio);composer.setSize(width,height);
        antialias.uniforms.resolution.value.set(1/(width*ratio),1/(height*ratio));
      }
      composer.render();
    },
    dispose(){composer.passes.forEach(p=>p.dispose?.());composer.dispose();environment.dispose();}
  };
}
