import {interventions,allocateFund} from '../scenario/funding.mjs?v=20261007-ws-status1';

const $=selector=>document.querySelector(selector);
const icons={water:'<path d="M12 2C10 6 5 10 5 15a7 7 0 0 0 14 0c0-5-5-9-7-13Z"/><path d="M8 15a4 4 0 0 0 4 4"/>',habitat:'<path d="M21 3C9 2 3 7 4 14s12 8 17-11Z"/><path d="m3 22 13-13"/>',community:'<circle cx="12" cy="7" r="3"/><path d="M6 21v-3a6 6 0 0 1 12 0v3M3 9a3 3 0 0 0 0 6M21 9a3 3 0 0 1 0 6"/>',land:'<path d="m2 17 6-9 5 7 3-5 6 9M3 22h18M18 3v5m-2-3h4"/>'};
const metrics=[{id:'water',name:'Water risk',color:'#74C2EE'},{id:'habitat',name:'Habitat impact',color:'#5FD3A4'},{id:'community',name:'Community exposure',color:'#E9BB63'},{id:'land',name:'Land & livelihoods',color:'#d7bf8d'}];
for(const item of metrics){
  const card=document.createElement('div');card.className='impact-card';card.dataset.metric=item.id;card.style.setProperty('--color',item.color);
  card.innerHTML=`<div class="impact-name"><svg viewBox="0 0 24 24" aria-hidden="true">${icons[item.id]}</svg>${item.name}</div><strong class="impact-value">—</strong><div class="track"><i></i></div><span class="impact-change"></span><span class="impact-scale">out of 100</span>`;
  $('#impact-cards').append(card);
}
for(const item of interventions){
  const node=document.createElement('div');node.className='protection-item';node.dataset.protection=item.id;node.style.setProperty('--color',item.color);
  node.innerHTML=`<div class="disc" aria-hidden="true">—</div><strong>${item.shortName}</strong><small>Not added</small>`;$('#protection-list').append(node);
}
const money=value=>`$${value.toFixed(1)}M`;
function render(result,{example=false}={}){
  for(const item of metrics){
    const node=$(`[data-metric="${item.id}"]`),score=Math.round(result.current[item.id]),benefit=Math.round(result.base[item.id]-result.current[item.id]);
    node.querySelector('.impact-value').textContent=score;node.style.setProperty('--score',`${score}%`);
    node.querySelector('.impact-change').textContent=benefit>0?`↓ ${benefit} with protection`:'No reduction yet';
    node.setAttribute('aria-label',`${item.name}: ${score} out of 100. ${benefit>0?benefit+' lower with protection':'No reduction yet'}.`);
  }
  const fund=result.funding;
  $('#remaining').textContent=money(fund.remaining);$('#fund-total').textContent=`US$${fund.total}M`;
  $('#pipeline-km').textContent=Number.isFinite(result.pipelineKm)?result.pipelineKm.toFixed(1):'—';
  $('#site-cost').textContent=money(fund.site);$('#protection-cost').textContent=money(fund.protection);
  const segments=[{amount:fund.site,color:'#d39b78',name:'Site'},...interventions.map(i=>({amount:fund.allocations[i.id].amount,color:i.color,name:i.name})),{amount:fund.remaining,color:'#ffffff30',name:'Available'}];
  $('#fund-bar').replaceChildren(...segments.map(segment=>{const node=document.createElement('i');node.style.setProperty('--color',segment.color);node.style.setProperty('--share',`${segment.amount/fund.total*100}%`);return node;}));
  $('#fund-bar').setAttribute('aria-label',segments.filter(s=>s.amount).map(s=>`${s.name}: ${money(s.amount)}`).join(', '));
  $('#funded-count').textContent=`${interventions.filter(i=>fund.allocations[i.id].fraction===1).length} of 5 funded`;
  for(const item of interventions){
    const node=$(`[data-protection="${item.id}"]`),a=fund.allocations[item.id];
    node.dataset.active=String(a.requested);node.dataset.partial=String(a.requested&&a.fraction<1);
    node.querySelector('.disc').textContent=a.fraction===1?'✓':a.fraction>0?'◐':a.requested?'!':'—';
    node.querySelector('small').textContent=a.fraction===1?'Funded':a.fraction>0?`${Math.round(a.fraction*100)}% funded`:a.requested?'No funds':'Not added';
  }
  const status=$('#site-status'),s=result.suitability;
  status.dataset.viable=String(s.viable);
  status.querySelector('span').textContent=!s.viable?`Not viable · ${s.reasons.map(r=>r.label).join(' + ')}`:example?'Preview · candidate site':s.complete?'Candidate site':'Geographic data incomplete';
  status.querySelector('small').textContent=example?'Preview · lower is better':'Illustrative scores · lower is better';
  document.body.dataset.mode=example?'preview':'live';
}
render({current:{water:27,habitat:33,community:41,land:24},base:{water:51,habitat:55,community:41,land:24},pipelineKm:12.4,funding:allocateFund(37.5,['water','habitat']),suitability:{viable:true,reasons:[],complete:true}},{example:true});

const session=window.MineScopeSession,config=session.table;
let joinUrl=session.urlFor('table',{participant:true});
if(['localhost','127.0.0.1','::1'].includes(location.hostname)){
  const production=new URL(joinUrl);production.protocol='https:';production.host='cityscope.media.mit.edu';production.port='';production.pathname='/MineScope/scenario/';joinUrl=production.href;
}
{
  const qr=globalThis.qrcodegen.QrCode.encodeText(joinUrl,globalThis.qrcodegen.QrCode.Ecc.MEDIUM),border=4,size=qr.size+border*2;
  let path='';for(let y=0;y<qr.size;y++)for(let x=0;x<qr.size;x++)if(qr.getModule(x,y))path+=`M${x+border},${y+border}h1v1h-1z`;
  $('#qr').innerHTML=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges" aria-hidden="true"><path fill="currentColor" d="${path}"/></svg>`;
  $('#qr').setAttribute('aria-label',config.apiKey?'Scan to join this interactive table session':'Scan to open the interactive table');
}

let modelReady=false,connectionStatus='key-required';
function showStatus(status){
  connectionStatus=status;
  const labels={unconfigured:'Not connected','key-required':'Preview',connecting:'Connecting…',reconnecting:'Reconnecting…',connected:'Connected',error:'Connection unavailable'};
  $('#connection').dataset.status=status;$('#connection span').textContent=status==='connected'&&!modelReady?'Preparing…':labels[status]||'Connection unavailable';
  document.body.dataset.connection=status;
  if(status!=='connected'&&document.body.dataset.mode==='live')$('#site-status small').textContent='Last received state';
}
const tableDisplay=$('#table-display');
window.addEventListener('message',event=>{
  if(event.origin!==location.origin||event.source!==tableDisplay.contentWindow)return;
  const message=event.data;if(!message||typeof message!=='object')return;
  if(message.type==='minescope.display.status'&&typeof message.status==='string')showStatus(message.status);
  if(message.type==='minescope.display.result'){
    const result=message.result;if(!result?.current||!result.base||!result.funding?.allocations||!Array.isArray(result.suitability?.reasons)||metrics.some(m=>!Number.isFinite(result.current[m.id])||!Number.isFinite(result.base[m.id])))return;
    modelReady=true;render(result,{example:!config.apiKey});showStatus(connectionStatus);
    document.body.dataset.modelUpdates=Number(document.body.dataset.modelUpdates||0)+1;
  }
});
showStatus(config.apiKey?'connecting':'key-required');
$('#fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{}}
document.addEventListener('fullscreenchange',()=>$('#fullscreen').setAttribute('aria-label',document.fullscreenElement?'Exit full screen':'Enter full screen'));
