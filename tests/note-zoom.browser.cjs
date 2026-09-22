/* Local browser regression: same environment variables as reliability.browser.cjs. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const out=process.env.MINESCOPE_RESULTS||'/tmp/minescope-note-zoom';fs.mkdirSync(out,{recursive:true});
const results=[];
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.MINESCOPE_BROWSER||undefined});
 try{for(const fallback of [false,true]){
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(25000);
  if(fallback)await context.route('https://tiles.openfreemap.org/styles/dark',r=>r.abort());
  await page.goto(process.env.MINESCOPE_URL||'http://127.0.0.1:4173',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(fallback=>fallback?document.querySelector('.terrain-status')?.textContent==='2D map':window.MineScope3D?.read().loaded,fallback);
  await page.evaluate(()=>{MineScopeActivity.pause();MineScopeActivity.seek(1);MineScopeSim.setMode('clusters');document.querySelector('#inspector').hidden=true;});
  async function zoom(value){await page.evaluate(({value,fallback})=>{document.dispatchEvent(new PointerEvent('pointermove',{bubbles:true}));const a=MineScopeSimulation.areas.find(a=>a.id==='los-choros');if(fallback)map.setView(a.coords,value+1,{animate:false});else MineScope3D.view.jumpTo({center:[a.coords[1],a.coords[0]],zoom:value,pitch:40,bearing:0,padding:{top:0,bottom:0,left:0,right:0}});}, {value,fallback});await page.waitForTimeout(180);}
  async function snapshot(){return page.evaluate(async fallback=>({
   regions:document.querySelectorAll(fallback?'.geo-cluster':'.terrain-cluster').length,
   partial:document.querySelectorAll('.terrain-cell,.sentiment-cluster').length,
   icons:document.querySelectorAll(fallback?'.note-map-marker':'.terrain-note').length,
   dots:fallback?Object.values(map._layers).filter(l=>l instanceof L.CircleMarker&&l.options.radius===3&&l.options.interactive===false).length:(await MineScope3D.view.getSource('note-dots').getData()).features.length,
   count:MineScopeSim.items().length,dom:document.querySelectorAll('*').length
  }),fallback);}
  const stages=[];
  for(const z of [11.2,11.4,11.9,12,12.3,11.9,11.4,11.2]){
   await zoom(z);const s=await snapshot();assert.equal(s.partial,0);
   if(z<11.35){assert.ok(s.regions>0);assert.equal(s.dots,0);assert.equal(s.icons,0);}
   else if(z<12){assert.equal(s.regions,0);assert.ok(s.dots>0);assert.equal(s.icons,0);}
   else{assert.equal(s.regions,0);assert.equal(s.dots,0);assert.ok(s.icons>0);}
   stages.push({zoom:z,...s});
  }
  await zoom(11.2);await page.screenshot({path:path.join(out,`${fallback?'2d':'3d'}-regions.png`)});
  await zoom(11.65);await page.screenshot({path:path.join(out,`${fallback?'2d':'3d'}-dots.png`)});
  await zoom(12.1);await page.waitForTimeout(500);
  const initial=await snapshot();
  for(let i=0;i<12;i++){await zoom(11.2);await zoom(11.65);await zoom(12.1);}
  const final=await snapshot();assert.equal(final.icons,initial.icons);assert.equal(final.dom,initial.dom);
  await page.evaluate(()=>MineScopeSim.setFilters({query:'no-note-matches-this-query'}));await page.waitForTimeout(200);assert.equal((await snapshot()).icons,0);
  await page.evaluate(()=>MineScopeSim.setFilters({query:''}));await page.waitForTimeout(200);assert.equal((await snapshot()).icons,initial.icons);
  await page.evaluate(()=>MineScopeActivity.setHeat('balance'));await page.waitForTimeout(200);const heat=await snapshot();assert.equal(heat.icons+heat.dots+heat.regions,0);
  await page.evaluate(()=>MineScopeActivity.setHeat('none'));await page.waitForTimeout(200);
  await page.evaluate(()=>{setLayer('simulated',false);setLayer('social',false);});await page.waitForTimeout(200);assert.equal((await snapshot()).icons,0);
  await page.evaluate(()=>{setLayer('simulated',true);setLayer('social',true);});await page.waitForTimeout(200);
  const selector=fallback?'.note-map-marker':'.terrain-note';
  const target=await page.evaluate(selector=>Array.from(document.querySelectorAll(selector)).findIndex(el=>{const r=el.getBoundingClientRect();return r.x>370&&r.right<innerWidth-80&&r.y>150&&r.bottom<innerHeight-240&&el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),selector);
  assert.ok(target>=0,'unobstructed icon');const icon=page.locator(selector).nth(target);
  const dims=await icon.evaluate(el=>({target:el.getBoundingClientRect().width,visible:el.querySelector('.note-map-pin').getBoundingClientRect().width}));assert.equal(dims.target,44);assert.equal(dims.visible,32);
  await icon.hover();await page.waitForTimeout(180);assert.ok(await icon.locator('.note-map-pin').evaluate(el=>el.getBoundingClientRect().width)>37);
  await page.screenshot({path:path.join(out,`${fallback?'2d':'3d'}-icons-hover.png`)});
  await icon.click();assert.equal(await page.locator('#inspector').isVisible(),true);
  await page.evaluate(()=>document.querySelector('#inspector').hidden=true);
  await zoom(11.2);await page.evaluate(()=>MineScopeSim.setMode('notes'));await page.waitForTimeout(200);assert.ok((await snapshot()).icons>0);assert.equal((await snapshot()).regions,0);
  await page.evaluate(()=>MineScopeSim.setMode('clusters'));
  await page.setViewportSize({width:390,height:844});await zoom(12.1);assert.ok((await snapshot()).icons>0);await page.screenshot({path:path.join(out,`${fallback?'2d':'3d'}-portrait.png`)});
  await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('.note-map-pin').first().evaluate(el=>getComputedStyle(el).transitionDuration),'0s');
  assert.deepEqual(errors,[]);results.push({renderer:fallback?'2D':'3D',stages,cycles:12,markersBefore:initial.icons,markersAfter:final.icons,domBefore:initial.dom,domAfter:final.dom,dimensions:dims,errors});
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results.at(-1)));await context.close();
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
