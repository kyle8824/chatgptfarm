// Phaser Living World QA · v1.3 diagnostic gate
import { chromium } from 'playwright';
import fs from 'node:fs';
import { migrateWorld, advanceEcology } from '../engine.js';

const base=process.env.BASE_URL||'http://127.0.0.1:4173/phaser.html';
fs.mkdirSync('phaser-qa',{recursive:true});
let state=migrateWorld(JSON.parse(fs.readFileSync('world/state.json','utf8')));
advanceEcology(state);
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
if(s.version!=='phaser-v1.4-living-world')failures.push(`wrong renderer: ${s.version}`);
if(!String(s.phaser||'').startsWith('3.'))failures.push(`Phaser failed to initialize: ${s.phaser}`);
if(s.agents!==2)failures.push(`expected 2 agents, got ${s.agents}`);
if(s.wildlife<8)failures.push(`expected >=8 wildlife, got ${s.wildlife}`);
if(s.trees<55)failures.push(`expected a forest, got ${s.trees} trees`);
if(s.treeWaterCollisions!==0)failures.push(`trees spawned in canonical water: ${s.treeWaterCollisions}`);
if((s.terrain?.water||0)<20||(s.terrain?.bank||0)<20||(s.terrain?.forest||0)<100)failures.push(`terrain occupancy is incomplete: ${JSON.stringify(s.terrain)}`);
if(s.movingEntities<1)failures.push('no entity has visible interpolated movement');
const expectedDNA=state.dna?.[0]?.decision_id||null;if(!String(s.decisionDNA?.protocol||'').startsWith('Decision DNA'))failures.push(`Decision DNA projection missing: ${JSON.stringify(s.decisionDNA)}`);if(expectedDNA&&s.decisionDNA?.decisionId!==expectedDNA)failures.push(`renderer DNA drifted from canonical state: ${s.decisionDNA?.decisionId} != ${expectedDNA}`);if((s.agentArtModes||[]).length!==2||(s.agentArtModes||[]).some(x=>x!=='natural-procedural'))failures.push(`natural agent embodiment failed: ${JSON.stringify(s.agentArtModes)}`);if(s.campVisualMode!=='canonical-branch-camp-v1')failures.push(`canonical camp visual mode missing: ${s.campVisualMode}`);if(!s.lightCycle||s.lightCycle.hour!==state.hour)failures.push(`light cycle state missing or stale: ${JSON.stringify(s.lightCycle)}`);const expectedTracks=(state.ecologySystem?.traces||[]).filter(t=>t.active&&(t.clarity??0)>.38&&(t.ageHours??0)<=14&&(t.species!=='rabbit'||(t.clarity??0)>.55)).length;if(s.livingWorld?.trackVisuals!==expectedTracks||s.livingWorld?.canonicalTracks!==expectedTracks)failures.push(`wildlife trace projection drift: rendered=${s.livingWorld?.trackVisuals} canonical=${expectedTracks}`);const expectedCue=state.dna?.[0]?.decision_id||null;if(expectedCue&&s.livingWorld?.decisionCueId!==expectedCue)failures.push(`Decision DNA world cue drift: ${s.livingWorld?.decisionCueId} != ${expectedCue}`);
await page.screenshot({path:'phaser-qa/mobile-auto.png'});

for(const [name,id] of [['MARA','agent-mara'],['IVO','agent-ivo']]){
 await page.getByRole('button',{name,exact:true}).click();await page.waitForTimeout(600);s=await snap();if(s.camera.mode!==id)failures.push(`${name} camera did not enter follow mode`);await page.screenshot({path:`phaser-qa/mobile-${name.toLowerCase()}.png`});
}
await page.getByRole('button',{name:'AUTO',exact:true}).click();await page.waitForTimeout(350);

let before=(await snap()).positions['W-DEER-001'];
if(!before)failures.push('missing deer for movement QA');
else{
 const targetWorld={x:45,y:36},targetPx={x:targetWorld.x*24,y:(100-targetWorld.y)*24};
 await page.evaluate(({to})=>window.ChatGPTFarmPhaserDebug.simulateMove('W-DEER-001',to,2400),{to:targetWorld});
 await page.waitForTimeout(950);const mid=(await snap()).positions['W-DEER-001'];
 await page.waitForTimeout(1900);const end=(await snap()).positions['W-DEER-001'];
 const d0=Math.hypot(mid.x-before.x,mid.y-before.y),d1=Math.hypot(mid.x-targetPx.x,mid.y-targetPx.y),de=Math.hypot(end.x-targetPx.x,end.y-targetPx.y);
 if(!(d0>5&&d1>5))failures.push(`deer did not visibly interpolate through a midpoint (${d0.toFixed(1)}, ${d1.toFixed(1)})`);
 if(de>4)failures.push(`deer did not reach visible movement target (${de.toFixed(1)}px)`);
 await page.evaluate(()=>window.ChatGPTFarmPhaserDebug.focusWorldUnit(45,36,.95));await page.waitForTimeout(250);await page.screenshot({path:'phaser-qa/mobile-wildlife.png'});
}

await page.evaluate(()=>window.ChatGPTFarmPhaserDebug.focusWorldUnit(50,19,.92));await page.waitForTimeout(300);await page.screenshot({path:'phaser-qa/mobile-creek.png'});
await page.evaluate(()=>window.ChatGPTFarmPhaserDebug.focusWorldUnit(64,34,1.05));await page.waitForTimeout(300);await page.screenshot({path:'phaser-qa/mobile-camp.png'});
await page.evaluate(()=>window.ChatGPTFarmPhaserDebug.focusWorldUnit(14,29,1.0));await page.waitForTimeout(300);await page.screenshot({path:'phaser-qa/mobile-forest.png'});

state=JSON.parse(JSON.stringify(state));state.meta=state.meta||{};state.meta.tickNumber=Number(state.meta.tickNumber||0)+100;const rabbit=state.ecologySystem?.wildlife?.find(x=>x.id==='W-RABBIT-001');if(rabbit){rabbit.previousPosition={...rabbit.position};rabbit.movement={from:{...rabbit.position},to:{x:Math.min(95,rabbit.position.x+5),y:rabbit.position.y+2},goal:{x:Math.min(95,rabbit.position.x+7),y:rabbit.position.y+2},worldDay:state.day,worldHour:state.hour,speed:3};rabbit.position={...rabbit.movement.to}}
await page.evaluate(()=>window.ChatGPTFarmPhaserDebug.reload());await page.waitForTimeout(800);s=await snap();if(!s.positions['W-RABBIT-001'])failures.push('same-page heartbeat lost rabbit');if(s.movingEntities<1)failures.push('heartbeat did not create visible movement');await page.screenshot({path:'phaser-qa/mobile-heartbeat.png'});

fs.writeFileSync('phaser-qa/report.json',JSON.stringify({base,snapshot:s,errors,failures},null,2));
await browser.close();
if(errors.length)console.error(errors.join('\n'));
if(failures.length){console.error(failures.join('\n'));process.exit(1)}
console.log(`Phaser QA passed: ${s.trees} trees, ${s.wildlife} wildlife, ${s.movingEntities} moving entities, zero trees in water.`);
