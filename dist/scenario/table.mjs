import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';
import { createEffects } from './effects.mjs?v=20261005-perf1';
import { createDisplay } from './display.mjs?v=20261005-perf1';
import { printedMaterial, resinMaterial } from './printed-material.mjs?v=20261005-perf1';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { createAtmosphere } from './atmosphere.mjs?v=20261005-perf1';
import {createFrameProfile} from './performance.mjs';
import {renderPixelRatio,siteMoved} from './render-policy.mjs';
import {terrainHit} from './terrain-hit.mjs';
import { CameraSway, frontLimit } from './camera-sway.mjs';
import { createViewportResizer } from './viewport.mjs';
import { bounds, plant, initialLocation, referenceLocation, settlements, interventions, clamp, coastline, surfaceHeight, habitat, livelihood, riverZ, evaluate, metricInfo, siteFootprint } from './model.mjs';

const $=s=>document.querySelector(s),canvas=$('#terrain-canvas'),stage=$('#model-stage');
const icon=id=>`<svg aria-hidden="true"><use href="#i-${id}"/></svg>`;
const state={location:{...initialLocation},protections:['water','habitat'],selected:'tailings',layers:{water:true,habitat:true,communities:true,pipeline:true,land:true,pollution:true,dust:true,noise:true,protection:true}};
let result=evaluate(state.location,state.protections),renderer,scene,camera,controls,terrain,frame=0,lastFrame=0,dirty=true,modelDirty=true,drag=null,toastTimer,selectedHover=null,resizeViewport;
const pieces=new Map(),labels=[],groups={},vec=new THREE.Vector3(),raycaster=new THREE.Raycaster(),mouse=new THREE.Vector2(),groundPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
let pipelineMesh,footprint,footprintBorder,selectionRing,ghost,terrainColors,terrainPositions,terrainOcclusion,terrainMaterial,resizeObserver,effects,display,atmosphere,profile,geometryLocation,sceneReady=false,motionUntil=0;
let terrainColorVariants,terrainColorKey=-1;
const printedSurface=(x,z)=>surfaceHeight(x,z)+.04;
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
const sway=new CameraSway(),upAxis=new THREE.Vector3(0,1,0);
const metricNodes={};
for(const id of ['water','habitat','community']) {
  const m=metricInfo[id],button=document.createElement('button');button.className='metric';button.style.setProperty('--color',m.color);button.dataset.metric=id;
  button.innerHTML=`<div class="metric-top"><svg class="metric-icon" aria-hidden="true"><use href="#i-${m.symbol}"/></svg><div class="metric-heading"><span class="metric-name">${m.name}</span><span class="metric-value"><strong>—</strong> <small>/ 100</small></span></div><span class="metric-chevron">›</span></div><div class="metric-track"><div class="metric-fill"></div></div><span class="metric-delta"></span>`;
  button.onclick=()=>showMetric(id);$('#metrics').append(button);metricNodes[id]={value:button.querySelector('strong'),fill:button.querySelector('.metric-fill'),delta:button.querySelector('.metric-delta')};
}
const money=value=>`US$${Number(value.toFixed(2))}M`;
const fundCard=document.createElement('button');fundCard.className='metric fund-card';fundCard.id='fund-card';
fundCard.innerHTML='<div class="fund-title">Company fund <span id="fund-total"></span></div><div class="fund-visual"><svg class="fund-donut" viewBox="0 0 100 100" aria-hidden="true"><circle class="fund-base" cx="50" cy="50" r="38"/><g id="fund-segments"></g><use href="#i-fund" x="37" y="37" width="26" height="26"/></svg><div><strong id="fund-remaining"></strong><span>available</span></div></div><div class="fund-breakdown"><span><i class="site-key"></i>Site <b id="fund-site"></b></span><span><i class="protection-key"></i>Protection <b id="fund-protection"></b></span></div>';
fundCard.onclick=showFund;$('#metrics').append(fundCard);
for(const token of interventions) {
  const button=document.createElement('button');button.className='token-button';button.dataset.token=token.id;button.style.setProperty('--color',token.color);button.setAttribute('aria-pressed','false');
  button.innerHTML=`${icon(token.symbol)}<span>${token.name}<small class="token-funding"></small></span><span class="token-state" aria-hidden="true">＋</span>`;
  button.onclick=()=>toggleToken(token.id);
  $('#token-tray').append(button);
}
function updateUI() {
  for(const [id,n] of Object.entries(metricNodes)) {
    const current=Math.round(result.current[id]),change=Math.round(result.current[id]-result.base[id]);
    n.value.textContent=current;n.fill.style.width=`${current}%`;
    n.delta.textContent=change<0?`−${-change} with protection`:change>0?`+${change} with protection`:'Unchanged';
    n.delta.classList.toggle('unchanged',change===0);n.delta.classList.toggle('cost-up',change>0);
    n.value.parentElement.parentElement.parentElement.parentElement.setAttribute('aria-label',`${metricInfo[id].name}: ${current} out of 100. ${n.delta.textContent}. Click to see why.`);
  }
  $('#pipeline-km').textContent=`${result.pipeline.km.toFixed(1)} km`;
  const fund=result.funding;
  $('#fund-total').textContent=money(fund.total);$('#fund-remaining').textContent=`$${fund.remaining.toFixed(1)}M`;
  $('#fund-site').textContent=`$${fund.site.toFixed(1)}M`;$('#fund-protection').textContent=`$${fund.protection.toFixed(1)}M`;
  let offset=0;
  $('#fund-segments').innerHTML=[{amount:fund.site,color:'#e6a474'},...interventions.map(i=>({amount:fund.allocations[i.id].amount,color:i.color}))].map(segment=>{
    const size=segment.amount/fund.total*100,svg=`<circle cx="50" cy="50" r="38" pathLength="100" fill="none" stroke="${segment.color}" stroke-width="10" stroke-dasharray="${size} ${100-size}" stroke-dashoffset="${-offset}"/>`;offset+=size;return size>0?svg:'';
  }).join('');
  fundCard.setAttribute('aria-label',`Company fund: ${money(fund.total)} total. ${money(fund.site)} for the site, ${money(fund.protection)} for protections, ${money(fund.remaining)} available. Click for allocation details.`);
  const funded=interventions.filter(i=>fund.allocations[i.id].fraction===1).length;
  $('#token-count').textContent=`${funded} / 5 fully funded`;
  for(const token of interventions) {
    const b=$(`[data-token="${token.id}"]`),allocation=fund.allocations[token.id],active=allocation.requested;
    b.setAttribute('aria-pressed',String(active));b.dataset.funded=allocation.fraction.toFixed(3);
    b.querySelector('.token-state').textContent=active?(allocation.fraction===1?'✓':allocation.fraction>0?'◐':'!'):'＋';
    b.querySelector('.token-funding').textContent=active?(allocation.fraction===1?`${money(allocation.cost)} · funded`:allocation.fraction>0?`${money(allocation.amount)} / ${money(allocation.cost)} · ${Math.round(allocation.fraction*100)}%`:'Waiting for funds'):money(allocation.cost);
    b.classList.toggle('underfunded',active&&allocation.fraction<1);
    b.title=active?`${token.name}: ${Math.round(allocation.fraction*100)}% funded. Click to release its allocation.`:`Allocate ${money(allocation.cost)} to ${token.name}.`;
  }
  const suitability=result.suitability,status=$('#live-state');
  const text=suitability.viable?(drag?'Checking site':'Candidate site'):`Not viable · ${suitability.reasons[0].label}${suitability.reasons.length>1?' +'+(suitability.reasons.length-1):''}`;
  status.classList.toggle('dragging',!!drag);status.classList.toggle('invalid',!suitability.viable);
  if(status.querySelector('span').textContent!==text)status.querySelector('span').textContent=text;
  status.title=suitability.viable?'No demo exclusion detected. Click for placement checks.':suitability.reasons.map(r=>r.detail).join(' ')+' Click for placement checks.';
  canvas.dataset.viable=String(suitability.viable);canvas.dataset.exclusions=suitability.reasons.map(r=>r.id).join(',');
}
function recalculate() {result=evaluate(state.location,state.protections);updateUI();modelDirty=true;canvas.dataset.x=state.location.x;canvas.dataset.z=state.location.z;canvas.dataset.phase=drag?'dragging':'placed';if(drag)canvas.dataset.liveUpdates=Number(canvas.dataset.liveUpdates||0)+1;invalidate();if($('#detail-dialog').open&&$('#detail-dialog').dataset.metric)renderMetric($('#detail-dialog').dataset.metric);}
window.toast=message=>{clearTimeout(toastTimer);$('#toast').textContent=message;$('#toast').hidden=false;toastTimer=setTimeout(()=>$('#toast').hidden=true,2600);};
function dialog(html,metric='') {$('#detail-content').innerHTML=html;$('#detail-dialog').dataset.metric=metric;if(!$('#detail-dialog').open)$('#detail-dialog').showModal();}
$('#detail-dialog .close-dialog').onclick=()=>$('#detail-dialog').close();
$('#detail-dialog').addEventListener('click',e=>{if(e.target===$('#detail-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
function renderMetric(id) {
  const m=metricInfo[id],strengths=interventions.filter(i=>state.protections.includes(i.id)).map(i=>`<div class="detail-row"><span>${i.name}</span><strong>${Math.round(result.strength[i.id]*100)}% funded${i.id==='monitor'?' · oversight only':''}</strong></div>`).join('');
  $('#detail-content').innerHTML=`<span class="eyebrow">WHY IT CHANGES</span><h2 id="detail-title">${m.name}</h2><div class="dialog-score"><div><strong>${Math.round(result.base[id])}</strong><span>Location alone / 100</span></div><div><strong>${Math.round(result.current[id])}</strong><span>With your protections / 100</span></div></div><h3>The causal chain</h3><ol>${m.chain.map(text=>`<li>${text}</li>`).join('')}</ol><h3>Your location</h3><div class="detail-row"><span>Pipeline corridor</span><strong>${result.pipeline.km.toFixed(1)} km</strong></div><div class="detail-row"><span>Drainage connection</span><strong>${Math.round(result.waterSensitivity*100)} / 100</strong></div><div class="detail-row"><span>Habitat overlap sensitivity</span><strong>${Math.round(result.habitatSensitivity*100)} / 100</strong></div>${strengths}<h3>What the model assumes</h3><p>${m.limitation}</p><p>Protections follow the site. Their benefit scales with the funded share; each cylinder emits illustrative rings, not a measured protection radius. Monitoring supports oversight and does not reduce physical impact scores.</p>`;
}
function showMetric(id) {dialog('',id);renderMetric(id);}
function showSuitability() {
  const s=result.suitability;
  dialog(`<span class="eyebrow">PLACEMENT CHECK</span><h2 id="detail-title">${s.viable?'Candidate site':'Not a viable location'}</h2>${s.viable?'<p>No demo exclusion detected across the tailings footprint.</p>':s.reasons.map(r=>`<div class="detail-row"><span>${r.label}</span><strong>${r.detail}</strong></div>`).join('')}<p>Move the tailings site to explore another location. Protection funding cannot remove these exclusions.</p><p>The check uses the full footprint: open water, settlement buildings, the shown habitat areas, and extreme differences in terrain height. These are schematic demonstration constraints, not an engineering assessment or a legal protected-area determination. Passing the check does not establish site feasibility.</p>`);
}
$('#live-state').onclick=showSuitability;
function showFund() {
  const f=result.funding;
  dialog(`<span class="eyebrow">COMPANY FUND</span><h2 id="detail-title">${money(f.remaining)} available</h2><div class="detail-row"><span>Total fund</span><strong>${money(f.total)}</strong></div><div class="detail-row"><span>Site setup & corridor</span><strong>${money(f.site)}</strong></div>${state.protections.map(id=>{const i=interventions.find(i=>i.id===id),a=f.allocations[id];return `<div class="detail-row"><span>${i.name}</span><strong>${money(a.amount)} / ${money(a.cost)}</strong></div>`;}).join('')}<p>Site costs are deducted first. Protections are funded in the order you add them. A partial allocation gives a proportional benefit; an unfunded protection waits until money becomes available. Removing a protection releases its allocation.</p><p>The US$20 million fund and all costs are illustrative game assumptions, not mining company commitments or engineering estimates. Site setup is US$2 million plus US$0.18 million per point of the location’s relative cost index, capped at the total fund.</p>`);
}
function showProtections() {
  dialog(`<span class="eyebrow">ALLOCATE TO PROTECTION</span><h2 id="detail-title">What each protection does</h2><p>Site setup draws first from the US$20M company fund. Protections use the remaining balance in the order you add them. A more expensive site leaves less to allocate; removing a protection returns its funds.</p><ul class="protection-guide">${interventions.map(i=>`<li style="--color:${i.color}">${icon(i.symbol)}<div><div class="protection-guide-title"><strong>${i.name}</strong><span>${money(i.budgetCost)}</span></div><p>${i.description}</p></div></li>`).join('')}</ul><p>Cylinders follow the tailings site. A shorter fill shows partial funding; translucent, dashed cylinders are waiting for funds. Their rings show activity, not a measured protection radius.</p><p>Costs and benefits are illustrative assumptions for this demo.</p>`);
}
$('#protection-info').onclick=showProtections;
function showComparison() {
  const reference=evaluate(referenceLocation);
  dialog(`<span class="eyebrow">COMPARE SCENARIOS</span><h2 id="detail-title">Your proposal & El Negrillo</h2><p>El Negrillo is the project-selected reference. It is not an optimal or preferred location.</p><table class="comparison-table"><thead><tr><th>Indicator</th><th>Your proposal<br>with protection</th><th>El Negrillo<br>location alone</th></tr></thead><tbody>${['water','habitat','community','cost'].map(id=>`<tr><td>${metricInfo[id].name}</td><td>${Math.round(result.current[id])} / 100</td><td>${Math.round(reference.base[id])} / 100</td></tr>`).join('')}</tbody></table><p>All impact values and corridors are illustrative. The reference corridor is calibrated to the 12.2 km value in the supplied KPI slides. Existing physical footprint: ${result.footprintHa} demo hectares in both scenarios.</p><div class="dialog-actions"><button class="button" id="try-reference">Place at reference location</button></div>`);
  $('#try-reference').onclick=()=>{state.location={...referenceLocation};state.selected='tailings';recalculate();$('#detail-dialog').close();window.toast('Tailings moved to the project-selected reference.');};
}
$('#compare').onclick=showComparison;
$('#pipeline-detail').onclick=()=>showMetric('cost');
$('#reset').onclick=()=>{cancelDrag();state.location={...initialLocation};state.protections=['water','habitat'];state.selected='tailings';resetCamera();recalculate();};
$('#fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{window.toast('Full screen is unavailable in this browser.');}};
document.addEventListener('fullscreenchange',()=>{$('#fullscreen').setAttribute('aria-label',document.fullscreenElement?'Exit full screen':'Enter full screen');$('#fullscreen span').textContent=document.fullscreenElement?'Exit full screen':'Full screen';});
$('#layers').onclick=()=>{const open=$('#layer-menu').hidden;$('#layer-menu').hidden=!open;$('#layers').setAttribute('aria-expanded',String(open));};
document.addEventListener('pointerdown',e=>{if(!e.target.closest('#layer-menu,#layers')){$('#layer-menu').hidden=true;$('#layers').setAttribute('aria-expanded','false');}});
for(const input of document.querySelectorAll('[data-layer]'))input.onchange=()=>{state.layers[input.dataset.layer]=input.checked;applyLayers();invalidate();};

function material(color,extra={}) {return new THREE.MeshStandardMaterial({color,roughness:.88,metalness:.03,...extra});}
function mesh(geometry,mat,parent=scene) {const m=new THREE.Mesh(geometry,mat);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function box(x,y,z,mat,parent,position=[0,0,0]) {const m=mesh(new THREE.BoxGeometry(x,y,z),mat,parent);m.position.set(...position);return m;}
function addLabel(text,anchor,cls='',action=null) {
  const el=document.createElement(action?'button':'span');el.className=`model-label ${cls}`;el.textContent=text;if(action)el.onclick=action;$('#model-labels').append(el);
  const item={el,anchor};labels.push(item);return item;
}
function selectPiece(id) {state.selected=id;dirty=true;invalidate();}
function createTailings() {
  const id='tailings',group=new THREE.Group();scene.add(group);
  const mat=resinMaterial('#E9BB63'),rim=resinMaterial('#ffdd91',{emissiveIntensity:.62}),dark=material('#8d6428');
  const resinBox=(x,y,z,m,position)=>{const piece=mesh(new RoundedBoxGeometry(x,y,z,3,Math.min(.035,y*.3)),m,group);piece.position.set(...position);};
  resinBox(1.35,.18,1.08,mat,[0,.09,0]);resinBox(1.21,.065,.94,rim,[0,.205,0]);
  box(1.07,.045,.8,dark,group,[0,.249,0]);resinBox(.93,.045,.66,mat,[0,.275,0]);
  resinBox(1.21,.08,.08,rim,[0,.28,.43]);resinBox(1.21,.08,.08,rim,[0,.28,-.43]);
  resinBox(.08,.08,.78,rim,[-.565,.28,0]);resinBox(.08,.08,.78,rim,[.565,.28,0]);
  const light=new THREE.PointLight('#ffd486',1.5,3.2,2);light.position.y=.22;group.add(light);
  const marker=mesh(new THREE.BoxGeometry(.26,.015,.26),material('#fff0bd'),group);marker.position.y=.306;marker.rotation.y=Math.PI/4;
  mesh(new THREE.BoxGeometry(.14,.016,.14),dark,group).position.y=.317;
  const pick=mesh(new THREE.BoxGeometry(1.55,.75,1.25),new THREE.MeshBasicMaterial({visible:false}),group);pick.position.y=.3;
  group.traverse(o=>o.userData.piece=id);
  const label=addLabel('↕ Tailings',()=>group.localToWorld(new THREE.Vector3(0,.58,0)),'piece-label',()=>selectPiece(id));
  label.el.dataset.piece=id;label.el.style.setProperty('--color','#E9BB63');label.el.title='Lift and move the tailings site';
  label.el.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();beginDrag(id,e,label.el);});
  label.el.addEventListener('keydown',e=>moveByKey(id,e));
  pieces.set(id,{id,group,pick,label,lift:0,light,materials:[mat,rim,dark],colors:[mat,rim,dark].map(m=>m.color.clone())});
}
function toggleToken(id) {
  profile?.input();
  if(state.protections.includes(id))state.protections=state.protections.filter(p=>p!==id);
  else state.protections.push(id);
  recalculate();
}
function supportHeight(p,id) {const radius=id==='tailings'?.58:.22;return Math.max(surfaceHeight(p.x,p.z),surfaceHeight(p.x-radius,p.z-radius),surfaceHeight(p.x+radius,p.z+radius),surfaceHeight(p.x-radius,p.z+radius),surfaceHeight(p.x+radius,p.z-radius))+.055;}
function setLocation(id,p) {
  const next={x:clamp(p.x,-10.25,10.25),z:clamp(p.z,-5.85,5.85)};
  if(id!=='tailings')return;state.location=next;recalculate();
}
function moveByKey(id,event) {
  const directions={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]},d=directions[event.key];if(!d)return;
  event.preventDefault();const p=id==='tailings'?state.location:null;if(!p)return;const step=event.shiftKey ? .65 : .16;selectPiece(id);setLocation(id,{x:p.x+d[0]*step,z:p.z+d[1]*step});
}

async function initTerrain() {
  renderer=new THREE.WebGLRenderer({canvas,antialias:false,alpha:true});renderer.setPixelRatio(renderPixelRatio(stage.clientWidth,stage.clientHeight,devicePixelRatio));renderer.shadowMap.enabled=true;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.94;
  if(new URLSearchParams(location.search).has('profile'))profile=createFrameProfile(canvas,renderer);
  scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(35,1,.1,120);
  controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.dampingFactor=.12;controls.enablePan=false;controls.minPolarAngle=.22;controls.maxPolarAngle=1.32;controls.minAzimuthAngle=-frontLimit;controls.maxAzimuthAngle=frontLimit;controls.minDistance=16;controls.maxDistance=85;controls.rotateSpeed=.6;controls.zoomSpeed=.65;controls.addEventListener('change',()=>{motionUntil=performance.now()+200;invalidate();});controls.addEventListener('start',stopSway);
  atmosphere=createAtmosphere(renderer,scene,camera);
  display=createDisplay(scene,$('#physical-display'),stage);resizeViewport=createViewportResizer(camera,renderer,display);
  box(22.65,.32,13.65,material('#192c3b',{roughness:.5,metalness:.2}),scene,[0,-.14,0]);box(22.35,.06,13.35,printedMaterial('#e8e4dc'),scene,[0,.04,0]);
  const geometry=new THREE.PlaneGeometry(bounds.width,bounds.depth,512,304);geometry.rotateX(-Math.PI/2);terrainPositions=geometry.attributes.position;
  terrainColors=new Float32Array(terrainPositions.count*3);terrainOcclusion=new Float32Array(terrainPositions.count);
  for(let i=0;i<terrainPositions.count;i++) {
    const x=terrainPositions.getX(i),z=terrainPositions.getZ(i),h=surfaceHeight(x,z);terrainPositions.setY(i,h+.04);
    let shelter=0;
    for(let direction=0;direction<8;direction++) {
      const a=direction*Math.PI/4;let horizon=0;
      for(const radius of [.45,1.15])horizon=Math.max(horizon,(surfaceHeight(x+Math.cos(a)*radius,z+Math.sin(a)*radius)-h)/radius);
      shelter+=Math.atan(Math.max(0,horizon));
    }
    terrainOcclusion[i]=1-clamp(shelter/8*.62,0,.32);
  }
  geometry.setAttribute('color',new THREE.BufferAttribute(terrainColors,3));geometry.computeVertexNormals();
  terrainMaterial=printedMaterial('#ffffff',{vertexColors:true});
  terrain=mesh(geometry,terrainMaterial);terrain.userData.terrain=true;updateTerrainColors();effects=createEffects(scene);
  for(const [axis,sign] of [['x',-1],['x',1],['z',-1],['z',1]]) {
    const points=[],steps=axis==='x'?304:512;
    for(let i=0;i<=steps;i++){const x=axis==='x'?sign*11:-11+22*i/steps,z=axis==='z'?sign*6.5:-6.5+13*i/steps,y=surfaceHeight(x,z)+.04;points.push(x,.075,z,x,y,z);}
    const side=new THREE.BufferGeometry();side.setAttribute('position',new THREE.Float32BufferAttribute(points,3));const indices=[];
    for(let i=0;i<steps;i++){const a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}side.setIndex(indices);side.computeVertexNormals();mesh(side,printedMaterial('#e6e1d8',{side:THREE.DoubleSide}));
  }
  groups.water=new THREE.Group();scene.add(groups.water);
  for(let branch=0;branch<2;branch++) {
    const points=[];for(let i=0;i<=180;i++){const x=-8.65+i*18/180,z=riverZ(x,branch);if(Math.abs(z)>6.2)continue;points.push(new THREE.Vector3(x,surfaceHeight(x,z)+.075,z));}
    const river=mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),230,branch?.025:.043,5,false),effects.createRiverMaterial(),groups.water);river.castShadow=false;
  }
  groups.communities=new THREE.Group();scene.add(groups.communities);
  for(const settlement of settlements) {
    const group=new THREE.Group();groups.communities.add(group);
    for(let i=0;i<12;i++){const x=settlement.x+Math.sin(i*2.4)*(.24+.035*i),z=settlement.z+Math.cos(i*2.4)*(.22+.024*i);box(.14+(i%3)*.035,.14+(i%4)*.027,.16,material('#e6e6d8'),group,[x,surfaceHeight(x,z)+.16,z]);}
    const label=addLabel(settlement.name,()=>new THREE.Vector3(settlement.x,surfaceHeight(settlement.x,settlement.z)+.65,settlement.z),'settlement',()=>{window.MineScopeUnity?.select(settlement.id);window.toast(`${settlement.name} · schematic community receptor`);});label.community=true;
  }
  const plantGroup=new THREE.Group();plantGroup.position.set(plant.x,supportHeight(plant,'tailings'),plant.z);scene.add(plantGroup);
  const gray=material('#bcc5bd');box(.58,.4,.48,gray,plantGroup,[-.15,.2,0]);box(.36,.55,.35,gray,plantGroup,[.25,.275,-.12]);mesh(new THREE.CylinderGeometry(.12,.12,.45,24),gray,plantGroup).position.set(-.45,.225,.28);mesh(new THREE.CylinderGeometry(.045,.045,.94,16),material('#8e9c95'),plantGroup).position.set(.23,.8,-.12);
  addLabel('Processing plant',()=>plantGroup.localToWorld(new THREE.Vector3(0,1.1,0)));
  addLabel('PACIFIC OCEAN',()=>new THREE.Vector3(-9.2,.15,-2.1),'ocean-label');
  const footprintGeometry=new THREE.PlaneGeometry(siteFootprint.width,siteFootprint.depth,20,18);footprintGeometry.rotateX(-Math.PI/2);
  footprint=mesh(footprintGeometry,new THREE.MeshBasicMaterial({color:'#edb64f',transparent:true,opacity:.23,depthWrite:false,side:THREE.DoubleSide}));footprint.castShadow=false;
  footprintBorder=new THREE.LineLoop(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:'#edbd64',transparent:true,opacity:.85}));scene.add(footprintBorder);
  selectionRing=mesh(new THREE.TorusGeometry(.58,.018,4,64),new THREE.MeshBasicMaterial({color:'#f1d28c',transparent:true,opacity:.7}));selectionRing.rotation.x=-Math.PI/2;selectionRing.castShadow=false;
  ghost=new THREE.LineLoop(new THREE.BufferGeometry(),new THREE.LineDashedMaterial({color:'#E9BB63',dashSize:.13,gapSize:.1,transparent:true,opacity:.55}));ghost.visible=false;scene.add(ghost);
  createTailings();
  for(const i of interventions) {
    const label=addLabel(i.shortName,()=>{const p=effects.protectionAnchor(i.id,state.location);return new THREE.Vector3(p.x,surfaceHeight(p.x,p.z)+.65,p.z);},'protection-label');
    label.protection=i.id;label.el.style.setProperty('--color',i.color);
  }
  resizeObserver=new ResizeObserver(resize);resizeObserver.observe(stage);resize();resetCamera();applyLayers();
  canvas.addEventListener('pointerdown',onCanvasDown,{capture:true});canvas.addEventListener('pointermove',onHover);
  canvas.addEventListener('pointerleave',()=>{if(!drag){selectedHover=null;canvas.style.cursor='grab';}});
  canvas.addEventListener('keydown',e=>moveByKey(state.selected,e));canvas.tabIndex=0;
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();$('#loading').hidden=false;$('#loading').textContent='Restoring the terrain…';cancelDrag();});
  canvas.addEventListener('webglcontextrestored',()=>{$('#loading').hidden=true;modelDirty=true;invalidate();});
  updateModel();scene.updateMatrixWorld(true);atmosphere.render();
  await renderer.compileAsync(scene,camera);
  sceneReady=true;$('#loading').hidden=true;recalculate();invalidate();
}
function updateTerrainColors() {
  if(!terrainPositions)return;
  const key=Number(state.layers.habitat)+2*Number(state.layers.land);if(key===terrainColorKey)return;
  if(!terrainColorVariants) {
    terrainColorVariants=Array.from({length:4},()=>new Float32Array(terrainColors.length));
    const ivory=new THREE.Color('#eee9df'),sea=new THREE.Color('#1e5367'),green=new THREE.Color('#69bf9b'),land=new THREE.Color('#c9ad77'),c=new THREE.Color();
    for(let i=0;i<terrainPositions.count;i++) {
      const x=terrainPositions.getX(i),z=terrainPositions.getZ(i),coast=coastline(z),isSea=x<coast;
      const habitatMix=isSea?0:habitat(x,z)*.18,landMix=isSea?0:livelihood(x,z)*.2;
      for(let variant=0;variant<4;variant++) {
        if(isSea)c.copy(sea).multiplyScalar(.75+.3*clamp((coast-x)/2.4));
        else {c.copy(ivory);if(variant&1)c.lerp(green,habitatMix);if(variant&2)c.lerp(land,landMix);}
        c.multiplyScalar(terrainOcclusion[i]);const colors=terrainColorVariants[variant];colors[i*3]=c.r;colors[i*3+1]=c.g;colors[i*3+2]=c.b;
      }
    }
  }
  terrainColorKey=key;terrainColors.set(terrainColorVariants[key]);if(terrain)terrain.geometry.attributes.color.needsUpdate=true;
}
function applyLayers() {
  effects?.setLayers(state.layers);updateTerrainColors();if(groups.water)groups.water.visible=state.layers.water;if(groups.communities)groups.communities.visible=state.layers.communities;if(pipelineMesh)pipelineMesh.visible=state.layers.pipeline;
  if(renderer)renderer.shadowMap.needsUpdate=true;
  for(const label of labels)if(label.community)label.el.hidden=!state.layers.communities;
}
function rectanglePoints(p,w,d) {const points=[];for(let edge=0;edge<4;edge++)for(let i=0;i<20;i++){const t=i/20,x=p.x+(edge===0?-w/2+w*t:edge===1?w/2:edge===2?w/2-w*t:-w/2),z=p.z+(edge===0?-d/2:edge===1?-d/2+d*t:edge===2?d/2:d/2-d*t);points.push(new THREE.Vector3(x,surfaceHeight(x,z)+.105,z));}return points;}
function updateModel() {
  const invalid=!result.suitability.viable,piece=pieces.get('tailings');
  const alertColors=['#e3756e','#f5a09b','#803b3b'];
  piece.materials.forEach((m,i)=>{if(invalid)m.color.set(alertColors[i]);else m.color.copy(piece.colors[i]);if(i<2)m.emissive.copy(m.color);});
  piece.light.color.set(invalid?'#ee7b72':'#ffd486');
  piece.label.el.textContent=invalid?'↕ Not viable':'↕ Tailings';piece.label.el.classList.toggle('invalid',invalid);
  piece.label.el.title=invalid?result.suitability.reasons.map(r=>r.detail).join(' ')+' Move to another location.':'Lift and move the tailings site';
  footprint.material.color.set(invalid?'#ef6f67':'#edb64f');footprint.material.opacity=invalid?.35:.23;
  footprintBorder.material.color.set(invalid?'#f58c85':'#edbd64');selectionRing.material.color.set(invalid?'#f58c85':'#f1d28c');
  if(siteMoved(geometryLocation,state.location)) {
    const points=[];
    for(let i=0;i<result.pipeline.points.length-1;i++) {
      const a=result.pipeline.points[i],b=result.pipeline.points[i+1];for(let k=0;k<3;k++){const t=k/3,x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t;points.push(new THREE.Vector3(x,surfaceHeight(x,z)+.105,z));}
    }
    points.push(new THREE.Vector3(state.location.x,surfaceHeight(state.location.x,state.location.z)+.105,state.location.z));
    if(pipelineMesh){pipelineMesh.geometry.dispose();pipelineMesh.geometry=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),Math.min(180,points.length*2),.036,5,false);}
    else pipelineMesh=mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),Math.min(180,points.length*2),.036,5,false),material('#e8b856',{emissive:'#e8a640',emissiveIntensity:.65,roughness:.65}));
    pipelineMesh.visible=state.layers.pipeline;pipelineMesh.castShadow=false;
    const pos=footprint.geometry.attributes.position;
    for(let j=0;j<=18;j++)for(let i=0;i<=20;i++){const index=j*21+i,x=state.location.x+siteFootprint.width*(i/20-.5),z=state.location.z+siteFootprint.depth*(.5-j/18);pos.setXYZ(index,x,surfaceHeight(x,z)+.088,z);}pos.needsUpdate=true;footprint.geometry.computeBoundingSphere();
    footprintBorder.geometry.dispose();footprintBorder.geometry=new THREE.BufferGeometry().setFromPoints(rectanglePoints(state.location,siteFootprint.width,siteFootprint.depth));
    geometryLocation={...state.location};
    if(profile)canvas.dataset.geometryUpdates=Number(canvas.dataset.geometryUpdates||0)+1;
  }
  effects?.update(result);renderer.shadowMap.needsUpdate=true;modelDirty=false;
}
function resetCamera() {
  if(!camera)return;stopSway();const aspect=stage.clientWidth/stage.clientHeight,tan=Math.tan(THREE.MathUtils.degToRad(camera.fov/2));
  const direction=new THREE.Vector3(1,18.5,26).normalize(),right=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),direction).normalize(),up=new THREE.Vector3().crossVectors(direction,right);
  controls.target.set(0,3,0);let distance=24;
  for(const x of [-11.6,11.6])for(const y of [-.5,display?.top||9])for(const z of [-8.3,6.9]) {
    const p=new THREE.Vector3(x,y,z).sub(controls.target),depth=p.dot(direction);
    distance=Math.max(distance,depth+Math.abs(p.dot(right))/(tan*aspect)*1.12,depth+Math.abs(p.dot(up))/tan*1.1);
  }
  camera.position.copy(controls.target).addScaledVector(direction,distance);controls.update();invalidate();
}
function resize() {
  if(renderer){const ratio=renderPixelRatio(stage.clientWidth,stage.clientHeight,devicePixelRatio);if(ratio!==renderer.getPixelRatio())renderer.setPixelRatio(ratio);}
  if(resizeViewport?.(stage.clientWidth,stage.clientHeight))invalidate();
}
function invalidate() {dirty=true;if(!frame)frame=requestAnimationFrame(render);}
function render(time) {
  frame=0;if(!sceneReady||document.hidden)return;
  const liftMoving=Math.abs((drag?.id==='tailings'?.88:0)-(pieces.get('tailings')?.lift||0))>.002;
  if(!dirty&&!drag&&!sway.active&&!liftMoving&&time>motionUntil&&time-lastFrame<32){frame=requestAnimationFrame(render);return;}
  const profileStart=profile?.start()||0;
  const dt=Math.min((time-lastFrame)/16.7,3)||1;lastFrame=time;
  if(modelDirty)updateModel();
  if(sway.active){const angle=sway.advance(dt*.0167),offset=camera.position.clone().sub(controls.target);offset.applyAxisAngle(upAxis,angle-controls.getAzimuthalAngle());camera.position.copy(controls.target).add(offset);}
  controls.update();
  let animating=false;
  for(const [id,piece] of pieces) {
    const p=id==='tailings'?state.location:null;if(!p)continue;const targetLift=drag?.id===id ? .88 : 0;
    const difference=targetLift-piece.lift;if(Math.abs(difference)>.002){piece.lift+=difference*(reducedMotion?1:1-Math.pow(.66,dt));animating=true;}else piece.lift=targetLift;
    piece.group.position.set(p.x,supportHeight(p,id)+piece.lift,p.z);
    piece.label.el.classList.toggle('selected',state.selected===id);
  }
  const selected=pieces.get(state.selected),p=state.selected==='tailings'?state.location:null;
  if(selected&&p){selectionRing.visible=true;selectionRing.position.set(p.x,surfaceHeight(p.x,p.z)+.16,p.z);selectionRing.scale.setScalar(state.selected==='tailings'?1.35:.85);}else selectionRing.visible=false;
  effects?.tick(reducedMotion?0:time/1000);if(animating)renderer.shadowMap.needsUpdate=true;scene.updateMatrixWorld(true);atmosphere.render();
  if(dirty||animating) {
    display.update(camera);
    const occupied=[];
    const labelPriority=label=>label.el.dataset.piece?2:label.protection?1:0;
    const orderedLabels=[...labels].sort((a,b)=>labelPriority(b)-labelPriority(a));
    for(const label of orderedLabels) {
      if(label.community&&!state.layers.communities){label.el.hidden=true;continue;}
      if(label.protection) {
        const a=result.funding.allocations[label.protection];
        if(!state.layers.protection||!a.requested||a.fraction===1){label.el.hidden=true;continue;}
        label.el.textContent=`${Math.round(a.fraction*100)}%`;
      }
      const world=label.anchor();world.project(camera);const w=stage.clientWidth,h=stage.clientHeight,x=(world.x*.5+.5)*w,y=(-world.y*.5+.5)*h;
      label.el.hidden=world.z>1||x<10||x>w-10||y<8||y>h-8;
      let top=y;const lw=label.el.offsetWidth||80,lh=label.el.offsetHeight||20;
      for(let n=0;n<7;n++){if(!occupied.some(r=>x+lw/2>r.left&&x-lw/2<r.right&&top>r.top&&top-lh<r.bottom))break;top-=lh+5;}
      const tv=display.projectedBounds;
      if(tv&&x+lw/2>tv.left&&x-lw/2<tv.right&&top>tv.top&&top-lh<tv.bottom){label.el.hidden=true;continue;}
      occupied.push({left:x-lw/2-3,right:x+lw/2+3,top:top-lh-3,bottom:top+3});
      label.el.style.left=`${x}px`;label.el.style.top=`${top}px`;label.el.style.setProperty('--leader',`${y-top+10}px`);
    }
  }
  dirty=false;if((animating||drag||sway.active||!reducedMotion)&&!frame)frame=requestAnimationFrame(render);
  canvas.dataset.lift=pieces.get('tailings')?.lift.toFixed(3)||'0';
  canvas.dataset.cameraDistance=camera.position.distanceTo(controls.target).toFixed(4);
  canvas.dataset.cameraAzimuth=controls.getAzimuthalAngle().toFixed(4);
  if(drag)canvas.dataset.maxLift=Math.max(Number(canvas.dataset.maxLift||0),pieces.get(drag.id)?.lift||0).toFixed(3);
  profile?.frame(profileStart);
}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)invalidate();});
function pointerRay(event) {const r=canvas.getBoundingClientRect();mouse.set((event.clientX-r.left)/r.width*2-1,-(event.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(mouse,camera);}
function groundPoint(event) {
  pointerRay(event);const intersection=terrainHit(raycaster.ray.origin,raycaster.ray.direction,printedSurface,bounds.width,bounds.depth);if(intersection)return {x:intersection.x,z:intersection.z};
  const point=raycaster.ray.intersectPlane(groundPlane,vec);return point?{x:point.x,z:point.z}:null;
}
function pickPiece(event) {pointerRay(event);return raycaster.intersectObjects([...pieces.values()].map(p=>p.pick),false)[0]?.object.userData.piece;}
function onCanvasDown(event) {if(event.button!==0)return;const id=pickPiece(event);if(!id)return;event.preventDefault();event.stopImmediatePropagation();beginDrag(id,event,canvas);}
function onHover(event) {
  if(drag)return;const id=pickPiece(event);selectedHover=id||null;canvas.style.cursor=id?'grab':'grab';if(id)invalidate();
}
function beginDrag(id,event,target) {
  if(!renderer||id!=='tailings')return;cancelDrag();const p=state.location,ground=groundPoint(event)||p;
  drag={id,pointerId:event.pointerId,target,before:{...p},offset:{x:p.x-ground.x,z:p.z-ground.z}};
  state.selected=id;controls.enabled=false;stopSway();stage.classList.add('dragging');target.setPointerCapture(event.pointerId);canvas.dataset.maxLift='0';canvas.dataset.liveUpdates='0';
  ghost.geometry.dispose();ghost.geometry=new THREE.BufferGeometry().setFromPoints(rectanglePoints(p,1.35,1.08));ghost.computeLineDistances();ghost.visible=true;
  updateUI();invalidate();
}
function finishDrag(cancel=false) {
  if(!drag)return;const previous=drag;drag=null;
  if(cancel)state.location=previous.before;
  if(previous.target.hasPointerCapture(previous.pointerId))previous.target.releasePointerCapture(previous.pointerId);
  controls.enabled=true;stage.classList.remove('dragging');ghost.visible=false;recalculate();
}
function cancelDrag() {finishDrag(true);}
window.addEventListener('pointermove',event=>{
  if(!drag||event.pointerId!==drag.pointerId)return;event.preventDefault();const point=groundPoint(event);if(point)setLocation('tailings',{x:point.x+drag.offset.x,z:point.z+drag.offset.z});
},{passive:false});
window.addEventListener('pointerup',event=>{if(drag&&event.pointerId===drag.pointerId)finishDrag();});
window.addEventListener('pointercancel',event=>{if(drag?.pointerId===event.pointerId)cancelDrag();});
window.addEventListener('blur',cancelDrag);
document.addEventListener('keydown',event=>{if(event.key==='Escape'){cancelDrag();$('#layer-menu').hidden=true;$('#layers').setAttribute('aria-expanded','false');}});
function stopSway(){sway.stop();$('#rotate-view').setAttribute('aria-pressed','false');}
$('#rotate-view').onclick=()=>{if(!controls)return;if(sway.active)stopSway();else{sway.start(controls.getAzimuthalAngle());$('#rotate-view').setAttribute('aria-pressed','true');}invalidate();};
$('#zoom-in').onclick=()=>{if(!camera)return;stopSway();const offset=camera.position.clone().sub(controls.target);if(offset.length()<=controls.minDistance)return;camera.position.copy(controls.target).add(offset.multiplyScalar(.87));controls.update();invalidate();};
$('#zoom-out').onclick=()=>{if(!camera)return;stopSway();const offset=camera.position.clone().sub(controls.target);if(offset.length()>=controls.maxDistance)return;camera.position.copy(controls.target).add(offset.multiplyScalar(1.13));controls.update();invalidate();};
updateUI();
initTerrain().catch(error=>{console.error('Scenario terrain unavailable:',error);$('#loading').innerHTML='<div class="error-message"><strong>3D graphics are unavailable</strong><p>Enable graphics acceleration in your browser to use the movable terrain model.</p><button class="button" onclick="location.reload()">Try again</button><br><a href="../">Open the project map ↗</a></div>';});
window.MineScopeTable={read:()=>structuredClone({location:state.location,protections:state.protections,result,selected:state.selected,dragging:!!drag,lift:pieces.get('tailings')?.lift,ready:!!renderer}),project(id='tailings'){
  const piece=pieces.get(id);if(!piece)return null;const point=piece.group.localToWorld(new THREE.Vector3(0,.25,0)).project(camera),r=canvas.getBoundingClientRect();return {x:r.left+(point.x*.5+.5)*r.width,y:r.top+(-point.y*.5+.5)*r.height};
},projectGround(x,z){const p=new THREE.Vector3(x,surfaceHeight(x,z)+.08,z).project(camera),r=canvas.getBoundingClientRect();return {x:r.left+(p.x*.5+.5)*r.width,y:r.top+(-p.y*.5+.5)*r.height};}};
