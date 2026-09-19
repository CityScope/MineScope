/* Project-authored prototype records. No social accounts or external feeds are accessed. */
(() => {
  'use strict';
  const start=Date.UTC(2026,8,1,12),end=Date.UTC(2026,8,18,23,59);
  const data=window.MineScopeSimulation,labels={community:'Community',x:'X / Twitter',facebook:'Facebook',reddit:'Reddit'};
  const glyphs={community:'<path d="M4 4h16v12h-9l-5 4v-4H4zM8 8h8M8 12h5"/>',x:'<path d="M4 3h4l12 18h-4zM20 3 4 21"/>',facebook:'<path d="M14 22v-9h3l.5-4H14V7c0-1.2.4-2 2-2h2V1.5c-.6-.1-1.8-.2-3-.2-3 0-5 1.8-5 5V9H7v4h3v9z" fill="currentColor" stroke="none"/>',reddit:'<ellipse cx="12" cy="14" rx="8" ry="6"/><path d="m12 8 1.5-6 5 1M7 16q5 4 10 0"/><circle cx="20" cy="3" r="2"/><circle cx="8.5" cy="12" r=".8" fill="currentColor"/><circle cx="15.5" cy="12" r=".8" fill="currentColor"/><path d="M5 10C0 5 0 14 4 13M19 10c5-5 5 4 1 3"/>'};
  const icon=source=>`<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${glyphs[source]||glyphs.community}</svg>`;
  let seed=934721;const random=()=>((seed=(1664525*seed+1013904223)>>>0)/4294967296);
  const dates=[];
  data.records.forEach((n,i)=>{n.platform='community';n.collectedAt=new Date(start+((i*313%640)+random())/640*(end-start)).toISOString();dates.push(n);});
  const messages={
    concerned:[['nature','The coast supports fishing and tourism. What would more ship traffic mean for the places we use every day?'],['water','Water deliveries are already difficult to plan around. We need a clear picture of how demand would change.'],['health','Dust and truck traffic are the part I worry about most. Monitoring should include the roads through town.'],['nature','The marine protected area needs to be part of the discussion about the port, from the beginning.'],['other','Public meetings need to reach people who cannot take an afternoon away from work.'],['water','I want to see groundwater measurements across dry years, not just a single season.']],
    hopeful:[['livelihoods','Training for local people could make a difference. I would like to see apprenticeships start before hiring does.'],['livelihoods','There is an opportunity for small suppliers here if the contracts are accessible to local businesses.'],['other','A public map of questions and responses would make it easier to follow the discussion.'],['water','Better water infrastructure could help, provided households have a say in how it is managed.'],['livelihoods','Young people should be able to find skilled work without moving away. Training needs to be part of the plan.'],['nature','Community monitoring could create jobs while giving us a clearer record of changes along the coast.']],
    mixed:[['livelihoods','More jobs would help families here. I still need to understand the tradeoffs for fishing and tourism.'],['water','Shared water infrastructure sounds useful, but who would operate it after the mine closes?'],['nature','I can see the need for investment. I also want the fishing grounds and coastal routes to remain usable.'],['health','Road upgrades would be welcome. More heavy vehicles through town would be a different matter.'],['other','There are useful ideas in the plan, but commitments need dates and a named person responsible.'],['livelihoods','Local contracts could help our business. We also depend on visitors who come for the coast.']],
    neutral:[['nature','Where can we see the protected area boundaries and the proposed shipping route together?'],['water','Is there a map showing the catchments that connect the inland works to the coast?'],['other','Will there be an evening session where residents can ask questions?'],['health','Where would air quality stations be placed, and how often would results be published?'],['livelihoods','What skills would be needed for the first round of local jobs?'],['water','Can someone explain which water sources supply each part of the project?']]
  };
  const endings=['',' A map would help us discuss this.',' This matters for families around here.',' I would bring this to the next meeting.',' Please keep the updates easy to find.',' It would help to hear from people working in the area.'];
  const social=[];
  for(let i=0;i<320;i++){
    const area=data.areas[i%6],r=random(),weights=area.weights;let sum=0,index=0;
    for(;index<3;index++){sum+=weights[index];if(r<sum)break;}
    const sentiment=['concerned','hopeful','mixed','neutral'][index],choice=messages[sentiment][Math.floor(random()*6)];
    social.push({id:`social-${String(i+1).padStart(3,'0')}`,sample:i+1,platform:['x','facebook','reddit'][(Math.floor(i/6)+i)%3],area:area.id,sentiment,topic:choice[0],text:[choice[1]+endings[Math.floor(random()*endings.length)]],role:['Public conversation'],coords:[+(area.coords[0]+(random()-.5)*area.spread[0]*3).toFixed(6),+(area.coords[1]+(random()-.5)*area.spread[1]*3).toFixed(6)],collectedAt:new Date(start+((i*137%320)+random())/320*(end-start)).toISOString(),synthetic:true,provenance:'Project-authored social-feed example; not an actual platform post',locationBasis:'Place discussed, assigned for the prototype'});
  }
  const records=[...data.records,...social].sort((a,b)=>Date.parse(a.collectedAt)-Date.parse(b.collectedAt));
  const state={progress:.26,playing:true,speed:1,heat:'none',sources:new Set(Object.keys(labels))};
  const model={start,end,records,social,labels,icon,state,colors:{concerned:'#E08063',hopeful:'#5FD3A4',mixed:'#E9BB63',neutral:'#74C2EE'},
    time:()=>start+(end-start)*state.progress,
    includes:n=>Date.parse(n.collectedAt)<=model.time()&&state.sources.has(n.platform)&&layers.find(l=>l.id===(n.platform==='community'?'simulated':'social')).on,
    date:time=>new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'America/Santiago'}).format(new Date(time)),
    sourceTag:n=>`<span class="source-tag" title="${labels[n.platform]}">${icon(n.platform)}${labels[n.platform]}</span>`
  };
  window.MineScopeActivity=model;
})();
