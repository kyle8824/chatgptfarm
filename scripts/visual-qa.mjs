import { chromium } from 'playwright';
import fs from 'node:fs';

const base=process.env.BASE_URL||'http://127.0.0.1:4173/';
fs.mkdirSync('visual-qa',{recursive:true});
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:412,height:915},deviceScaleFactor:1,isMobile:true,hasTouch:true});
const page=await context.newPage();
const errors=[];
page.on('pageerror',e=>errors.push(`pageerror: ${e.message}`));
page.on('console',m=>{if(m.type()==='error')errors.push(`console: ${m.text()}`)});
await page.goto(base,{waitUntil:'domcontentloaded',timeout:60000});
await page.waitForFunction(()=>document.querySelector('#loading')?.classList.contains('hidden')&&window.ChatGPTFarmRendererDebug?.snapshot().items?.length>0,{timeout:60000});
await page.waitForTimeout(1200);

const snapshot=await page.evaluate(()=>window.ChatGPTFarmRendererDebug.snapshot());
const items=snapshot.items||[];
const trees=items.filter(x=>x.kind==='tree');
const reeds=items.filter(x=>x.kind==='reed-cluster'||x.kind==='reed_stand');
const agents=items.filter(x=>x.kind==='agent');
const raisedClay=items.filter(x=>x.kind==='clay_bank');
const failures=[];
if(trees.length<10)failures.push(`expected visible forest population, got ${trees.length} trees`);
if(agents.length!==2)failures.push(`expected 2 agents, got ${agents.length}`);
if(raisedClay.length)failures.push('clay bank is incorrectly present in raised/depth-sorted layer');
if(trees.length&&reeds.length){const minTree=Math.min(...trees.map(x=>Number(x.height)||0)),maxTree=Math.max(...trees.map(x=>Number(x.height)||0)),maxReed=Math.max(...reeds.map(x=>Number(x.height)||0));if(maxReed>=minTree*.72)failures.push(`reed/tree scale regression: max reed ${maxReed}px vs min tree ${minTree}px`);if(maxTree>84)failures.push(`forest dominance regression: max tree visual height ${maxTree}px`)}
const giant=items.filter(x=>['low-vegetation','ground-object','shrub'].includes(x.tier)&&Number(x.height)>72);
if(giant.length)failures.push(`oversized low-tier visuals: ${giant.map(x=>`${x.kind}:${x.height}`).join(', ')}`);
if(agents.length===2&&agents.every(x=>Number.isFinite(x.screenX)&&Number.isFinite(x.screenBaseY))){const d=Math.hypot(agents[0].screenX-agents[1].screenX,agents[0].screenBaseY-agents[1].screenBaseY);if(d<22)failures.push(`collocated agents are visually merged: ${d.toFixed(1)}px apart`)}

async function shot(name){await page.screenshot({path:`visual-qa/${name}.png`,fullPage:false});}
await shot('mobile-auto');
for(const [button,name] of [['MARA','mobile-mara'],['IVO','mobile-ivo']]){await page.getByRole('button',{name:button,exact:true}).click();await page.waitForTimeout(700);await shot(name)}
await page.getByRole('button',{name:'AUTO',exact:true}).click();
await page.waitForTimeout(500);

fs.writeFileSync('visual-qa/report.json',JSON.stringify({base,snapshot,errors,failures},null,2));
await browser.close();
if(errors.length)console.error(errors.join('\n'));
if(failures.length){console.error(failures.join('\n'));process.exit(1)}
console.log(`Visual QA passed: ${trees.length} trees, ${reeds.length} raised reed clusters, ${agents.length} agents.`);
