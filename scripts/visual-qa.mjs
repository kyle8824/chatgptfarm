import { chromium } from 'playwright';
import fs from 'node:fs';
import { migrateWorld, advanceEcology } from '../engine.js';

const base=process.env.BASE_URL||'http://127.0.0.1:4173/';
const local=base.includes('127.0.0.1')||base.includes('localhost');
fs.mkdirSync('visual-qa',{recursive:true});
let qaState=null;
if(local){
  const raw=JSON.parse(fs.readFileSync('world/state.json','utf8'));
  qaState=migrateWorld(raw);
  advanceEcology(qaState);
  fs.writeFileSync('visual-qa/state.json',JSON.stringify(qaState));
}
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:412,height:915},deviceScaleFactor:1,isMobile:true,hasTouch:true});
const page=await context.newPage();
if(local&&qaState)await page.route(/raw\.githubusercontent\.com\/kyle8824\/chatgptfarm\/main\/world\/state\.json.*/,route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(qaState)}));
const errors=[],failures=[];
page.on('pageerror',e=>errors.push(`pageerror: ${e.message}`));
page.on('console',m=>{if(m.type()==='error')errors.push(`console: ${m.text()}`)});
await page.goto(base,{waitUntil:'domcontentloaded',timeout:60000});
await page.waitForFunction(()=>document.querySelector('#loading')?.classList.contains('hidden')&&window.ChatGPTFarmRendererDebug?.snapshot().items?.length>0,{timeout:60000});
await page.waitForTimeout(1400);
const snapshot=await page.evaluate(()=>window.ChatGPTFarmRendererDebug.snapshot());
const items=snapshot.items||[],trees=items.filter(x=>x.kind==='tree'),reeds=items.filter(x=>x.kind==='reed-cluster'||x.kind==='reed_stand'),agents=items.filter(x=>x.kind==='agent'),wildlife=items.filter(x=>String(x.kind||'').startsWith('wildlife-')),raisedClay=items.filter(x=>x.kind==='clay_bank');
if(trees.length<10)failures.push(`expected visible forest population, got ${trees.length} trees`);
if(agents.length!==2)failures.push(`expected 2 agents, got ${agents.length}`);
if(wildlife.length<8)failures.push(`expected living wildlife population, got ${wildlife.length}`);if((snapshot.ecology?.traceCount||0)<1)failures.push('expected at least one source-linked wildlife trace after QA ecology advance');if((snapshot.ecology?.ambient?.birds||0)<1)failures.push('ambient bird population is missing');
if(raisedClay.length)failures.push('clay bank is incorrectly present in raised/depth-sorted layer');
if(trees.length&&reeds.length){const minTree=Math.min(...trees.map(x=>Number(x.height)||0)),maxTree=Math.max(...trees.map(x=>Number(x.height)||0)),maxReed=Math.max(...reeds.map(x=>Number(x.height)||0));if(maxReed>=minTree*.72)failures.push(`reed/tree scale regression: max reed ${maxReed}px vs min tree ${minTree}px`);if(maxTree>84)failures.push(`forest dominance regression: max tree visual height ${maxTree}px`)}
const giant=items.filter(x=>['low-vegetation','ground-object','shrub'].includes(x.tier)&&Number(x.height)>72);if(giant.length)failures.push(`oversized low-tier visuals: ${giant.map(x=>`${x.kind}:${x.height}`).join(', ')}`);
if(agents.length===2&&agents.every(x=>Number.isFinite(x.screenX)&&Number.isFinite(x.screenBaseY))){const d=Math.hypot(agents[0].screenX-agents[1].screenX,agents[0].screenBaseY-agents[1].screenBaseY);if(d<22)failures.push(`collocated agents are visually merged: ${d.toFixed(1)}px apart`)}
async function shot(name){await page.screenshot({path:`visual-qa/${name}.png`,fullPage:false});}
try{
  await shot('mobile-auto');
  for(const [button,name,id] of [['MARA','mobile-mara','agent-mara'],['IVO','mobile-ivo','agent-ivo']]){
    await page.getByRole('button',{name:button,exact:true}).click();
    await page.waitForTimeout(700);
    const follow=await page.evaluate(agentId=>{const s=window.ChatGPTFarmRendererDebug.snapshot(),a=(s.items||[]).find(x=>x.kind==='agent'&&x.sourceId===agentId);return{camera:s.camera,agent:a||null}},id);
    if(!follow.agent||!Number.isFinite(follow.agent.screenX)||!Number.isFinite(follow.agent.screenBaseY))failures.push(`${button} follow target is missing from renderer debug state`);
    else{const d=Math.hypot(follow.camera.x-follow.agent.screenX,follow.camera.y-follow.agent.screenBaseY);if(d>14)failures.push(`${button} camera is not following the rendered agent: ${d.toFixed(1)}px off target`)}
    await shot(name);
  }
  await page.getByRole('button',{name:'AUTO',exact:true}).click();await page.waitForTimeout(400);
  await page.evaluate(()=>window.ChatGPTFarmRendererDebug.focusWorldUnit(48,74,1.45));await page.waitForTimeout(250);await shot('mobile-creek');
  if(!await page.evaluate(()=>window.ChatGPTFarmRendererDebug.focusWildlife('W-DEER-001',1.9)))failures.push('could not focus deer for visual QA');await page.waitForTimeout(250);await shot('mobile-deer');
  if(!await page.evaluate(()=>window.ChatGPTFarmRendererDebug.focusWildlife('W-BEAR-001',1.75)))failures.push('could not focus bear for visual QA');await page.waitForTimeout(250);await shot('mobile-bear');
  await page.locator('#pulseButton').click();await page.waitForTimeout(350);await shot('mobile-world-pulse');
  if(!await page.locator('#pulseDrawer').evaluate(el=>el.classList.contains('open')))failures.push('World Pulse drawer did not open');
  for(const [tab,name] of [['relationship','mobile-relationship'],['dna','mobile-decision-dna'],['controls','mobile-ai-usage']]){await page.locator(`[data-pulse-tab="${tab}"]`).click();await page.waitForTimeout(160);await shot(name)}
  const toggles=await page.locator('#pulseControls input[data-ai]').count();if(toggles!==3)failures.push(`expected 3 AI controls, got ${toggles}`);
}catch(e){failures.push(`interaction QA failed: ${String(e.message||e).slice(0,300)}`);try{await shot('mobile-interaction-error')}catch{}}
fs.writeFileSync('visual-qa/report.json',JSON.stringify({base,snapshot,errors,failures,wildlifeCount:wildlife.length,traceCount:snapshot.ecology?.traceCount||0,ecologyEvents:snapshot.ecology?.eventCount||0},null,2));
await browser.close();
if(errors.length)console.error(errors.join('\n'));if(failures.length){console.error(failures.join('\n'));process.exit(1)}
console.log(`Visual QA passed: ${trees.length} trees, ${reeds.length} raised reed clusters, ${agents.length} agents, ${wildlife.length} wildlife.`);
