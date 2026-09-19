// Phaser Living World QA · v1.3 diagnostic gate
import { chromium } from 'playwright';
import fs from 'node:fs';
import { migrateWorld, advanceEcology } from '../engine.js';

const base=process.env.BASE_URL||'http://127.0.0.1:4173/phaser.html';
fs.mkdirSync('phaser-qa',{recursive:true});
let state=migrateWorld(JSON.parse(fs.readFileSync('world/state.json','utf8')));
advanceEcology(state);
const qaMara=state.agents.find(a=>a.id==='agent-mara');if(qaMara)qaMara.memories.unshift({id:'M-QA-NESTED',text:'Ivo told me: Mara told me: Ivo told me: The creek crossing is unsafe after rain.',importance:8,tags:['social','water'],source:'social:agent-ivo:M-QA',confidence:.8,lastSeen:`${state.day}:${state.hour}`});
state.meta.lastAdvancedAt=new Date().toISOString();
state.surfaceHistory={version:'surface-history-1',routes:[{id:'ROUTE-QA-VISUAL',key:'43,31|64,34',from:{x:43,y:31},to:{x:64,y:34},traversals:5,agents:{'agent-mara':3,'agent-ivo':2},firstUsed:{day:state.day,hour:Math.max(0,state.hour-5)},lastUsed:{day:state.day,hour:state.hour},lastActionId:'qa_walk'}],campWear:{uses:12,agents:{'agent-mara':7,'agent-ivo':5},lastUsed:{day:state.day,hour:state.hour}}};
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:412,height:915},deviceScaleFactor:1,isMobile:true,hasTouch:true});
const page=await context.newPage();
const errors=[],failures=[];
page.on('pageerror',e=>{const v=`pageerror: ${e.message}`;errors.push(v);console.error(v)});
page.on('console',m=>{if(m.type()==='error'){const v=`console: ${m.text()}`;errors.push(v);console.error(v)}});
await page.route(/raw\.githubusercontent\.com\/kyle8824\/chatgptfarm\/main\/world\/state\.json.*/,route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(state)}));
await page.goto(base,{waitUntil:'domcontentloaded',timeout:60000});
await page.waitForFunction(()=>window.ChatGPTFarmPhaserDebug?.snapshot()?.ready===true,{timeout:60000});
try{await page.waitForSelector('#phLoading.hidden',{state:'attached',timeout:10000})}catch(e){await page.screenshot({path:'phaser-qa/build-failure.png'});const snap=await page.evaluate(()=>window.ChatGPTFarmPhaserDebug?.snapshot?.()||null);fs.writeFileSync('phaser-qa/build-failure.json',JSON.stringify({snap,errors},null,2));await browser.close();throw new Error(`Phaser canonical state loaded but scene build never completed. ${errors.join(' | ')||'No browser error surfaced.'}`)}
await page.waitForTimeout(1200);
const snap=()=>page.evaluate(()=>window.ChatGPTFarmPhaserDebug.snapshot());
let s=await snap();
if(s.version!=='phaser-v1.6.7-world-continuity')failures.push(`wrong renderer: ${s.version}`);
if(!String(s.phaser||'').startsWith('3.'))failures.push(`Phaser failed to initialize: ${s.phaser}`);
if(s.agents!==2)failures.push(`expected 2 agents, got ${s.agents}`);
const expectedPresentWildlife=(state.ecologySystem?.wildlife||[]).filter(x=>x.active&&x.localPresence!==false).length;if(s.wildlife!==expectedPresentWildlife)failures.push(`renderer wildlife count drift: ${s.wildlife} != canonical ${expectedPresentWildlife}`);
if(s.trees<55)failures.push(`expected a forest, got ${s.trees} trees`);
if(s.treeWaterCollisions!==0)failures.push(`trees spawned in canonical water: ${s.treeWaterCollisions}`);
if((s.terrain?.water||0)<20||(s.terrain?.bank||0)<20||(s.terrain?.forest||0)<100)failures.push(`terrain occupancy is incomplete: ${JSON.stringify(s.terrain)}`);
if(s.movingEntities<1)failures.push('no entity has visible interpolated movement');if(!Number.isFinite(s.concealedWildlife))failures.push(`wildlife concealment state missing: ${s.concealedWildlife}`);const expectedRoutes=(state.surfaceHistory?.routes||[]).filter(r=>(r.traversals||0)>=2).length;if(s.livingWorld?.routeVisuals!==expectedRoutes||s.livingWorld?.canonicalRoutes!==expectedRoutes)failures.push(`travel-wear projection drift: rendered=${s.livingWorld?.routeVisuals} canonical=${expectedRoutes}`);if(s.livingWorld?.campWear!==12)failures.push(`camp-wear projection drift: ${s.livingWorld?.campWear}`);if((s.livingWorld?.campWearVisuals||0)<5||s.livingWorld?.campWearState?.uses!==12)failures.push(`camp wear visual projection missing: ${JSON.stringify(s.livingWorld?.campWearState)}`);const expectedResourceVisuals={stonesLoose:Math.round(13*Math.max(0,Math.min(1,(state.resources?.stones||0)/24))),reedsStanding:Math.round(28*Math.max(0,Math.min(1,(state.resources?.reeds||0)/18))),berryFruitingBushes:Math.round(9*Math.max(0,Math.min(1,(state.resources?.berries||0)/20))),clayRichness:+Math.max(0,Math.min(1,(state.resources?.clay||0)/10)).toFixed(2)};if(Object.keys(state.regions?.sites||{}).length)expectedResourceVisuals.siteFruitingBushes=Object.fromEntries(Object.values(state.regions.sites).filter(x=>x.resource==='berries').map(x=>[x.id,Math.round(9*Math.max(0,Math.min(1,x.quantity/x.capacity)))]));if(JSON.stringify(s.resourceVisualState)!==JSON.stringify(expectedResourceVisuals))failures.push(`resource landscape drift: ${JSON.stringify(s.resourceVisualState)} != ${JSON.stringify(expectedResourceVisuals)}`);if(!s.rangePresenceCounts||s.rangePresenceCounts.present!==expectedPresentWildlife)failures.push(`range presence projection missing or stale: ${JSON.stringify(s.rangePresenceCounts)}`);
const expectedDNA=state.dna?.[0]?.decision_id||null;if(!String(s.decisionDNA?.protocol||'').startsWith('Decision DNA'))failures.push(`Decision DNA projection missing: ${JSON.stringify(s.decisionDNA)}`);if(expectedDNA&&s.decisionDNA?.decisionId!==expectedDNA)failures.push(`renderer DNA drifted from canonical state: ${s.decisionDNA?.decisionId} != ${expectedDNA}`);if((s.agentArtModes||[]).length!==2||(s.agentArtModes||[]).some(x=>x!=='natural-procedural'))failures.push(`natural agent embodiment failed: ${JSON.stringify(s.agentArtModes)}`);if(s.embodiment!=='embodiment-v2'||(s.embodimentState?.agents||[]).length!==2||(s.embodimentState?.agents||[]).some(x=>!['walking','still'].includes(x.mode)))failures.push(`agent embodiment state missing: ${JSON.stringify(s.embodimentState)}`);if(s.campVisualMode!=='canonical-lean-to-v4-layered')failures.push(`canonical camp visual mode missing: ${s.campVisualMode}`);if(s.shelterLayering?.mode!=='layered-occlusion-v1'||!(s.shelterLayering.frontDepth>s.shelterLayering.rearDepth)||!(s.shelterLayering.interiorBaseline>s.shelterLayering.roofFront))failures.push(`shelter occlusion layering missing or invalid: ${JSON.stringify(s.shelterLayering)}`);if(!s.lightCycle||s.lightCycle.hour!==state.hour)failures.push(`light cycle state missing or stale: ${JSON.stringify(s.lightCycle)}`);const wetExpected=+(state.environmentState?.surfaceWetness??.32).toFixed(3),levelExpected=+(state.environmentState?.creekLevel??.42).toFixed(3);if(s.weatherMemory?.surfaceWetness!==wetExpected||s.weatherMemory?.creekLevel!==levelExpected)failures.push(`weather memory projection drift: ${JSON.stringify(s.weatherMemory)} expected wet=${wetExpected} level=${levelExpected}`);if(!s.habitatDetail||s.habitatDetail.meadow<100||s.habitatDetail.forest<20)failures.push(`habitat detail missing: ${JSON.stringify(s.habitatDetail)}`);if(!s.meadowRelief||s.meadowRelief.patches<35||s.meadowRelief.contours<8)failures.push(`meadow relief missing: ${JSON.stringify(s.meadowRelief)}`);const expectedSigns=(state.ecologySystem?.signs||[]).filter(x=>x.active&&(x.clarity??0)>.34&&(x.ageHours??0)<=30).length;if(s.livingWorld?.signVisuals!==expectedSigns||s.livingWorld?.canonicalSigns!==expectedSigns)failures.push(`ecological sign projection drift: rendered=${s.livingWorld?.signVisuals} canonical=${expectedSigns}`);const expectedTracks=(state.ecologySystem?.traces||[]).filter(t=>t.active&&(t.clarity??0)>.38&&(t.ageHours??0)<=14&&(t.species!=='rabbit'||(t.clarity??0)>.55)).length;if(s.livingWorld?.trackVisuals!==expectedTracks||s.livingWorld?.canonicalTracks!==expectedTracks)failures.push(`wildlife trace projection drift: rendered=${s.livingWorld?.trackVisuals} canonical=${expectedTracks}`);if(s.livingWorld?.decisionCueId!==null)failures.push(`stale single-agent decision cue is still rendered: ${s.livingWorld?.decisionCueId}`);
await page.screenshot({path:'phaser-qa/mobile-auto.png'});const savedResources={...state.resources};state.meta.tickNumber=Number(state.meta.tickNumber||0)+31;Object.assign(state.resources,{berries:0,reeds:0,stones:0,clay:0});await page.evaluate(()=>window.ChatGPTFarmPhaserDebug.reload());await page.waitForTimeout(650);let depleted=await snap();if(depleted.resourceVisualState?.stonesLoose!==0||depleted.resourceVisualState?.reedsStanding!==0||depleted.resourceVisualState?.berryFruitingBushes!==0||depleted.resourceVisualState?.clayRichness!==0)failures.push(`depleted resources remained visually full: ${JSON.stringify(depleted.resourceVisualState)}`);await page.screenshot({path:'phaser-qa/mobile-resource-depletion-proof.png'});Object.assign(state.resources,savedResources);state.meta.tickNumber++;state.meta.lastAdvancedAt=new Date().toISOString();await page.evaluate(()=>window.ChatGPTFarmPhaserDebug.reload());await page.waitForTimeout(650);s=await snap();if(JSON.stringify(s.resourceVisualState)!==JSON.stringify(expectedResourceVisuals))failures.push(`resource landscape failed to recover after canonical quantities restored: ${JSON.stringify(s.resourceVisualState)}`);


if(s.aiAgentMarkers!==2)failures.push(`expected 2 visible AI identity markers, got ${s.aiAgentMarkers}`);
if((s.aiMarkerLabels||[]).length!==2||(s.aiMarkerLabels||[]).some(x=>x!=='✦'))failures.push(`AI world markers should be bare diamonds only: ${JSON.stringify(s.aiMarkerLabels)}`);
const aiKey=(await page.locator('#phAiKey').textContent())||'';
if(!/✦\s*=/.test(aiKey))failures.push(`AI model key missing: ${aiKey}`);
if(/PREVIEW/i.test((await page.locator('#phWorldStatus').textContent())||''))failures.push('public world status still uses PREVIEW wording');
const agentNow=await page.evaluate(()=>[...document.querySelectorAll('[data-agent-now]')].map(x=>x.textContent.replace(/\s+/g,' ').trim()));
if(agentNow.length!==2||!agentNow.some(x=>/Mara/i.test(x))||!agentNow.some(x=>/Ivo/i.test(x)))failures.push(`Agents Now panel does not show both agents: ${agentNow.join(' | ')}`);
const profileOpened=await page.evaluate(()=>window.ChatGPTFarmPhaserDebug.inspectAgent('agent-mara'));
if(!profileOpened)failures.push('Mara spectator profile could not be opened');
else{
 await page.waitForSelector('#phInspector:not([hidden])',{timeout:5000});
 const profile=await page.evaluate(()=>({
  autonomy:document.querySelector('#phInspectAutonomy')?.textContent?.trim()||'',
  activity:document.querySelector('.phActivityCard strong')?.textContent?.trim()||'',
  tabs:[...document.querySelectorAll('[data-ph-tab]')].map(x=>x.textContent.trim()),
  meters:[...document.querySelectorAll('.phMeter')].map(x=>x.textContent.replace(/\s+/g,' ').trim()),
  relationship:document.querySelector('.phRelation')?.textContent?.replace(/\s+/g,' ').trim()||''
 }));
 if(!/AI/i.test(profile.autonomy)||!(s.aiControllerModel?profile.autonomy.toLowerCase().includes(String(s.aiControllerModel).replace(/^gpt-/i,'GPT-').replace(/-([a-z])/g,(_m,c)=>` ${c.toUpperCase()}`).toLowerCase()):true))failures.push(`AI model autonomy badge missing or stale: ${profile.autonomy}`);
 if(!profile.activity)failures.push('current activity is missing from the agent profile');
 if(profile.tabs.join('|')!=='Overview|Mind|Memory')failures.push(`agent profile tabs missing or reordered: ${profile.tabs.join('|')}`);
 if(!profile.meters.includes(`Hunger ${Math.round(100-qaMara.needs.hunger)}%`)||profile.meters.some(x=>x.includes('Satiety')))failures.push('Hunger meter must invert legacy satiety');
 if(profile.meters.length<7)failures.push(`expected condition + relationship meters, got ${profile.meters.length}`);
 if(!/Trust/i.test(profile.relationship)||!/Familiarity/i.test(profile.relationship)||!/Affinity/i.test(profile.relationship))failures.push(`relationship visual is incomplete: ${profile.relationship}`);
 await page.getByRole('button',{name:'Mind',exact:true}).click();
 if(!(await page.locator('[data-ph-panel="mind"]').isVisible()))failures.push('Mind tab did not become visible');
 await page.getByRole('button',{name:'Memory',exact:true}).click();
 if(!(await page.locator('[data-ph-panel="memory"]').isVisible()))failures.push('Memory tab did not become visible');
 const memoryText=(await page.locator('[data-ph-panel="memory"]').textContent())||'';
 if(/told me:\s*.*told me:/i.test(memoryText))failures.push(`nested hearsay leaked into memory UI: ${memoryText.replace(/\s+/g,' ').trim()}`);
 if(!/SHARED BY IVO/i.test(memoryText)||!/creek crossing is unsafe after rain/i.test(memoryText))failures.push(`flattened shared-memory presentation missing: ${memoryText.replace(/\s+/g,' ').trim()}`);
 await page.screenshot({path:'phaser-qa/mobile-agent-profile.png'});
 await page.locator('#phWorldStatus').click();
 if(await page.locator('#phInspector').isVisible())failures.push('clicking outside the inspector did not close it');
 const reopened=await page.evaluate(()=>window.ChatGPTFarmPhaserDebug.inspectAgent('agent-mara'));
 if(!reopened)failures.push('could not reopen Mara profile for camera-dismiss QA');
 else{
  await page.getByRole('button',{name:'IVO',exact:true}).click();
  if(await page.locator('#phInspector').isVisible())failures.push('IVO camera button did not close the inspector');
  if((await snap()).camera.mode!=='agent-ivo')failures.push('IVO camera button did not move focus after closing inspector');
 }
}

for(const [name,id] of [['MARA','agent-mara'],['IVO','agent-ivo']]){
 await page.getByRole('button',{name,exact:true}).click();await page.waitForTimeout(600);s=await snap();if(s.camera.mode!==id)failures.push(`${name} camera did not enter follow mode`);await page.screenshot({path:`phaser-qa/mobile-${name.toLowerCase()}.png`});
}
await page.getByRole('button',{name:'AUTO',exact:true}).click();await page.waitForTimeout(350);
const habitatDeer=state.ecologySystem?.wildlife?.find(x=>x.active&&x.localPresence!==false&&x.species==='deer');if(habitatDeer){await page.evaluate(({x,y})=>window.ChatGPTFarmPhaserDebug.focusWorldUnit(x,y,.95),habitatDeer.position);await page.waitForTimeout(250);await page.screenshot({path:'phaser-qa/mobile-wildlife-habitat.png'});}

const campfire=state.worldModel?.objects?.find(x=>x.type==='camp_fire');
if(campfire){
 const opened=await page.evaluate(id=>window.ChatGPTFarmPhaserDebug.inspectObject(id),campfire.id);
 if(!opened)failures.push('campfire inspector could not be opened');
 else{
  const rows=await page.evaluate(()=>[...document.querySelectorAll('#phInspectBody dt')].map(x=>x.textContent.trim()));
  const bodyText=(await page.locator('#phInspectBody').textContent())||'';
  const material=campfire.material;
  const materiallyEmpty=!material||(typeof material==='string'&&!material.trim())||(typeof material==='object'&&!Array.isArray(material)&&Object.keys(material).length===0);
  if(materiallyEmpty&&rows.includes('Material'))failures.push('campfire inspector still shows an empty Material row');
  if(/Material\s*\{\}/i.test(bodyText))failures.push('campfire inspector exposes empty material JSON');
  if(!/Fire state/i.test(bodyText))failures.push('campfire inspector does not explain whether the fire is burning or out');
  await page.keyboard.press('Escape');
  if(await page.locator('#phInspector').isVisible())failures.push('Escape did not close the inspector');
 }
}

const movementSubject=state.ecologySystem?.wildlife?.find(x=>x.active&&x.localPresence!==false&&x.species!=='fish');
const movementId=movementSubject?.id;
let before=movementId?(await snap()).positions[movementId]:null;
if(!before)failures.push('missing visible land animal for movement QA');
else{
 const targetWorld={x:45,y:36},targetPx={x:targetWorld.x*24,y:(100-targetWorld.y)*24};
 await page.evaluate(({id,to})=>window.ChatGPTFarmPhaserDebug.simulateMove(id,to,2400),{id:movementId,to:targetWorld});
 await page.waitForTimeout(950);const mid=(await snap()).positions[movementId];
 await page.waitForTimeout(1900);const end=(await snap()).positions[movementId];
 const d0=Math.hypot(mid.x-before.x,mid.y-before.y),d1=Math.hypot(mid.x-targetPx.x,mid.y-targetPx.y),de=Math.hypot(end.x-targetPx.x,end.y-targetPx.y);
 if(!(d0>5&&d1>5))failures.push(`land animal did not visibly interpolate through a midpoint (${d0.toFixed(1)}, ${d1.toFixed(1)})`);
 if(de>4)failures.push(`land animal did not reach visible movement target (${de.toFixed(1)}px)`);
 await page.evaluate(()=>window.ChatGPTFarmPhaserDebug.focusWorldUnit(45,36,.95));await page.waitForTimeout(250);await page.screenshot({path:'phaser-qa/mobile-movement-proof.png'});
}

await page.evaluate(()=>window.ChatGPTFarmPhaserDebug.focusWorldUnit(50,19,.92));await page.waitForTimeout(300);await page.screenshot({path:'phaser-qa/mobile-creek.png'});state.environmentState={surfaceWetness:.86,creekLevel:.73,lastRainAt:{day:state.day,hour:Math.max(0,state.hour-2)},hoursSinceRain:2};state.weather='clear';state.meta.tickNumber++;state.meta.lastAdvancedAt=new Date().toISOString();await page.evaluate(()=>window.ChatGPTFarmPhaserDebug.reload());await page.waitForTimeout(650);const wetAfter=await snap();if(wetAfter.weatherMemory?.surfaceWetness<.8||wetAfter.weatherMemory?.visuals<3)failures.push(`wet aftermath did not render from canonical weather memory: ${JSON.stringify(wetAfter.weatherMemory)}`);await page.evaluate(()=>window.ChatGPTFarmPhaserDebug.focusWorldUnit(50,19,.92));await page.waitForTimeout(200);await page.screenshot({path:'phaser-qa/mobile-after-rain.png'});state.environmentState={surfaceWetness:.24,creekLevel:.43,lastRainAt:{day:Math.max(1,state.day-1),hour:state.hour},hoursSinceRain:24};state.meta.tickNumber++;state.meta.lastAdvancedAt=new Date().toISOString();await page.evaluate(()=>window.ChatGPTFarmPhaserDebug.reload());await page.waitForTimeout(650);const dryAfter=await snap();if(!(dryAfter.weatherMemory?.surfaceWetness<wetAfter.weatherMemory?.surfaceWetness&&dryAfter.weatherMemory?.visuals<wetAfter.weatherMemory?.visuals))failures.push(`weather-memory visuals did not recede as canonical ground dried: wet=${JSON.stringify(wetAfter.weatherMemory)} dry=${JSON.stringify(dryAfter.weatherMemory)}`);
await page.evaluate(()=>window.ChatGPTFarmPhaserDebug.focusWorldUnit(64,34,1.05));await page.waitForTimeout(300);await page.screenshot({path:'phaser-qa/mobile-camp.png'});
const qaShelterAgent=state.agents.find(a=>a.id==='agent-ivo');if(qaShelterAgent){const saved={position:qaShelterAgent.position,coordinates:qaShelterAgent.coordinates?{...qaShelterAgent.coordinates}:null,activeAction:qaShelterAgent.activeAction?JSON.parse(JSON.stringify(qaShelterAgent.activeAction)):null};qaShelterAgent.position='camp';qaShelterAgent.coordinates={x:64,y:34};qaShelterAgent.activeAction=null;state.meta.tickNumber++;state.meta.lastAdvancedAt=new Date().toISOString();await page.evaluate(()=>window.ChatGPTFarmPhaserDebug.reload());await page.waitForTimeout(650);const campSnap=await snap(),ivoCamp=campSnap.positions['agent-ivo'],campPx={x:64*24,y:(100-34)*24};if(!ivoCamp||ivoCamp.y<campPx.y+18)failures.push(`Ivo is not seated visually inside the shelter opening: ${JSON.stringify(ivoCamp)}`);await page.evaluate(()=>window.ChatGPTFarmPhaserDebug.focusWorldUnit(64,34,1.2));await page.waitForTimeout(250);await page.screenshot({path:'phaser-qa/mobile-shelter-occlusion.png'});qaShelterAgent.position=saved.position;qaShelterAgent.coordinates=saved.coordinates;qaShelterAgent.activeAction=saved.activeAction;state.meta.tickNumber++;state.meta.lastAdvancedAt=new Date().toISOString();await page.evaluate(()=>window.ChatGPTFarmPhaserDebug.reload());await page.waitForTimeout(450);}

await page.evaluate(()=>window.ChatGPTFarmPhaserDebug.focusWorldUnit(14,29,1.0));await page.waitForTimeout(300);await page.screenshot({path:'phaser-qa/mobile-forest.png'});

state=JSON.parse(JSON.stringify(state));state.meta=state.meta||{};state.meta.tickNumber=Number(state.meta.tickNumber||0)+50;state.hour=20;state.weather='clear';await page.evaluate(()=>window.ChatGPTFarmPhaserDebug.reload());await page.waitForTimeout(650);let light=await snap();if(light.lightCycle?.hour!==20||light.lightCycle?.alpha<.2)failures.push(`dusk lighting failed: ${JSON.stringify(light.lightCycle)}`);await page.evaluate(()=>window.ChatGPTFarmPhaserDebug.focusWorldUnit(64,34,1.0));await page.waitForTimeout(200);await page.screenshot({path:'phaser-qa/mobile-dusk.png'});state.hour=2;state.meta.tickNumber++;state.meta.lastAdvancedAt=new Date().toISOString();await page.evaluate(()=>window.ChatGPTFarmPhaserDebug.reload());await page.waitForTimeout(650);light=await snap();if(light.lightCycle?.hour!==2||light.lightCycle?.alpha<.4)failures.push(`night lighting failed: ${JSON.stringify(light.lightCycle)}`);await page.screenshot({path:'phaser-qa/mobile-night.png'});state.hour=12;state.weather='rain';state.meta.tickNumber++;state.meta.lastAdvancedAt=new Date().toISOString();await page.evaluate(()=>window.ChatGPTFarmPhaserDebug.reload());await page.waitForTimeout(650);

state=JSON.parse(JSON.stringify(state));state.meta=state.meta||{};state.meta.tickNumber=Number(state.meta.tickNumber||0)+100;const rabbit=state.ecologySystem?.wildlife?.find(x=>x.id==='W-RABBIT-001');if(rabbit){rabbit.previousPosition={...rabbit.position};rabbit.movement={from:{...rabbit.position},to:{x:Math.min(95,rabbit.position.x+5),y:rabbit.position.y+2},goal:{x:Math.min(95,rabbit.position.x+7),y:rabbit.position.y+2},worldDay:state.day,worldHour:state.hour,speed:3};rabbit.position={...rabbit.movement.to}}
state.meta.lastAdvancedAt=new Date().toISOString();await page.evaluate(()=>window.ChatGPTFarmPhaserDebug.reload());await page.waitForTimeout(800);s=await snap();if(!s.positions['W-RABBIT-001'])failures.push('same-page heartbeat lost rabbit');if(s.movingEntities<1)failures.push('heartbeat did not create visible movement');await page.screenshot({path:'phaser-qa/mobile-heartbeat.png'});


// Exercise user input, not debug methods that bypass input wiring.
await page.getByRole('button',{name:'MARA',exact:true}).click();
await page.waitForTimeout(300);
let cameraState=await snap();
const mara=cameraState.positions['agent-mara'],cam=cameraState.camera;
const sx=(mara.x-cam.scrollX-206)*cam.zoom+206,sy=(mara.y-20-cam.scrollY-457.5)*cam.zoom+457.5;
await page.touchscreen.tap(sx,sy);
await page.getByRole('dialog',{name:'World details'}).waitFor({state:'visible'});
if((await snap()).selected?.id!=='agent-mara')failures.push('tap did not select Mara');
if(!(await page.locator('[data-ph-tab="memory"]').count()))failures.push('inspector lost persistent memory navigation');else{await page.locator('[data-ph-tab="memory"]').click();if(!(await page.locator('[data-ph-panel="memory"]').isVisible()))failures.push('persistent memory panel did not open');if(!(await page.locator('[data-ph-panel="memory"]').textContent()).match(/Recent memories|No memories recorded/i))failures.push('inspector lost persistent memory information')}
await page.screenshot({path:'phaser-qa/mobile-inspector.png'});
await page.getByRole('button',{name:'Close details'}).click();
const cdp=await context.newCDPSession(page),zoomBefore=(await snap()).camera.zoom;
await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:155,y:400,id:1},{x:255,y:400,id:2}]});
await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:110,y:400,id:1},{x:300,y:400,id:2}]});
await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
if((await snap()).camera.zoom<=zoomBefore+.05)failures.push('two-finger pinch did not zoom');
await page.screenshot({path:'phaser-qa/mobile-pinch.png'});
// Stale data must be visibly stale, and reloading it must NOT replay old actions.
state.meta.lastAdvancedAt=new Date(Date.now()-3600000).toISOString();state.meta.tickNumber++;
await page.evaluate(()=>window.ChatGPTFarmPhaserDebug.reload());
await page.waitForTimeout(400);
if(await page.locator('#phWorldStatus').getAttribute('data-freshness')!=='stale')failures.push('stale world reported as connected');
const staleBefore=(await snap()).positions;
await page.reload({waitUntil:'domcontentloaded'});
await page.waitForSelector('#phLoading.hidden',{state:'attached'});
await page.waitForTimeout(800);
const staleAfter=(await snap()).positions;
for(const id of Object.keys(staleBefore)){if(Math.hypot(staleBefore[id].x-staleAfter[id].x,staleBefore[id].y-staleAfter[id].y)>.1)failures.push(`reload replayed stale movement for ${id}`)}
await page.screenshot({path:'phaser-qa/mobile-stale-world.png'});
// A real HTTP poll must deliver a fresh newer state without a reload/debug call.
state.meta.tickNumber++;state.meta.lastAdvancedAt=new Date().toISOString();
const expectedTick=state.meta.tickNumber;
await page.waitForFunction(t=>window.ChatGPTFarmPhaserDebug.snapshot().freshness.tick===t,expectedTick,{timeout:20000});
if(await page.locator('#phWorldStatus').getAttribute('data-freshness')!=='current')failures.push('fresh poll did not recover status');
const movingBefore=(await snap()).positions;
await page.waitForTimeout(12000);
const movingAfter=(await snap()).positions;
if(!Object.keys(movingBefore).some(id=>Math.hypot(movingBefore[id].x-movingAfter[id].x,movingBefore[id].y-movingAfter[id].y)>.5))failures.push('movement stopped after the initial 9-second window');
await page.screenshot({path:'phaser-qa/mobile-sustained-movement.png'});

// A runtime handoff must arrive without waiting for the twelve-second poll.
state.meta.tickNumber++;
state.runtime={serverTime:Date.now(),start:Date.now()-1000,end:Date.now()+2200,status:'running',decisionSource:'fallback'};
await page.evaluate(()=>window.ChatGPTFarmPhaserDebug.reload());
state.meta.tickNumber++;
state.runtime={...state.runtime,serverTime:Date.now()+2300,start:state.runtime.end,end:state.runtime.end+150000};
try{await page.waitForFunction(tick=>window.ChatGPTFarmPhaserDebug.snapshot().freshness.tick===tick,state.meta.tickNumber,{timeout:6000});}
catch{failures.push('Runtime handoff waited beyond six seconds instead of fetching at the deadline');}
// A critical hunger reading is full/red, not an empty green meter.
state.agents.find(a=>a.id==='agent-mara').needs.hunger=0;state.meta.tickNumber++;state.runtime.serverTime=Date.now();
await page.evaluate(()=>window.ChatGPTFarmPhaserDebug.reload());
await page.evaluate(()=>window.ChatGPTFarmPhaserDebug.inspectAgent('agent-mara'));
const hungryMeter=await page.evaluate(()=>[...document.querySelectorAll('.phMeter')].find(x=>x.querySelector('span')?.textContent==='Hunger')?.outerHTML||'');
if(!hungryMeter.includes('100%')||!hungryMeter.includes('phMeter low'))failures.push('Empty stomach must render Hunger 100% with a warning color');

fs.writeFileSync('phaser-qa/report.json',JSON.stringify({base,snapshot:s,errors,failures},null,2));
await browser.close();
if(errors.length)console.error(errors.join('\n'));
if(failures.length){console.error(failures.join('\n'));process.exit(1)}
console.log(`Phaser QA passed: ${s.trees} trees, ${s.wildlife} wildlife, ${s.movingEntities} moving entities, zero trees in water.`);
