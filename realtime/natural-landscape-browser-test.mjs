import {chromium} from 'playwright';
import {build} from '../cloudflare/node_modules/esbuild/lib/main.js';
import {createServer} from 'node:http';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createWorld} from '../engine/core.js';
import {RealtimeController} from './world.mjs';
const saved=new Map(),storage={get:async k=>saved.get(k),put:async(k,v)=>saved.set(k,v),delete:async k=>saved.delete(k),setAlarm:async()=>{},transaction:async f=>f(storage)};
const c=new RealtimeController(storage,{frontierEnabled:true,landscapeEnabled:true});await c.initialize(createWorld());const frame=c.frame(1);frame.hour=12;frame.weather='clear';frame.wildlife=[];
try{const live=JSON.parse(await fs.readFile('realtime/fixtures/natural-preview.json','utf8'));frame.agents.splice(0,2,...live.agents.filter(a=>['Mara','Ivo'].includes(a.name)));frame.settlement.projects=live.settlement.projects.filter(p=>!p.householdId||p.householdId==='willow-basin');frame.settlement.stores.push(...live.settlement.stores.filter(s=>s.projectId));frame.day=live.day;}catch{}
const source=await fs.readFile('web/live/client.js','utf8'),bundle=await build({stdin:{contents:source+'\nwindow.valley=scene;',resolveDir:process.cwd()+'/web/live'},bundle:true,format:'esm',write:false,nodePaths:[new URL('../cloudflare/node_modules/',import.meta.url).pathname]});
const html=await fs.readFile('web/live/index.html'),css=await fs.readFile('web/live/style.css');await fs.mkdir('realtime-qa',{recursive:true});
const server=createServer((req,res)=>{const path=new URL(req.url,'http://localhost').pathname;res.setHeader('Content-Type',path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':path.endsWith('geometry')?'application/json':'text/html');res.end(path.endsWith('.js')?bundle.outputFiles[0].contents:path.endsWith('.css')?css:path.endsWith('geometry')?JSON.stringify(c.geometry()):html);});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}),report=[];
try{for(const mobile of [true,false]){
 const context=await browser.newContext({viewport:mobile?{width:412,height:915}:{width:1440,height:960},isMobile:mobile,hasTouch:mobile}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.addInitScript(frame=>{window.fixtureFrame=frame;window.WebSocket=class{static OPEN=1;constructor(){this.readyState=1;setTimeout(()=>this.onopen?.(),0);this.interval=setInterval(()=>this.onmessage?.({data:JSON.stringify(window.fixtureFrame)}),250);}send(){}close(){clearInterval(this.interval);}};},frame);
 await page.goto(`http://127.0.0.1:${server.address().port}/`,{timeout:120000});await page.waitForFunction(()=>window.valley?.frame?.agents.length===8,{},{timeout:120000});assert(!(await page.locator('.hint').textContent()).includes('unavailable'));
 await page.evaluate(()=>document.querySelector('.eyebrow').textContent='LANDSCAPE PREVIEW');
 assert.equal(await page.locator('#person-select option').count(),9);
 assert.equal(await page.locator('#home-regions, #people').count(),0);
 for(const place of [...frame.frontier.homes,...frame.frontier.landmarks,{id:'all'}]){
  await page.selectOption('#region-select',place.id);await page.waitForTimeout(350);
  await page.screenshot({path:`realtime-qa/natural-${mobile?'mobile':'desktop'}-${place.id}.png`});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.equal(await page.locator('#person-select option').count(),9,'every person stays selectable in every region');report.push({mobile,place:place.id,people:8});
 }
 await page.selectOption('#person-select','agent-elin');assert.equal(await page.evaluate(()=>valley.focus),'agent-elin');assert.equal(await page.locator('#inspector').evaluate(e=>e.open),false,'following does not obscure the view with details');
 await page.waitForTimeout(350);await page.screenshot({path:`realtime-qa/natural-${mobile?'mobile':'desktop'}-following.png`});await page.locator('#person-details').click();assert.match(await page.locator('#inspect-content').textContent(),/Elin Clay/);await page.locator('[data-tab="relationships"]').click();assert.match(await page.locator('#inspect-content').textContent(),/Ronan Brook/);await page.getByRole('button',{name:'Close inspector'}).click();
 await page.locator('#home').click();assert.equal(await page.locator('#region-select').inputValue(),'willow-basin');assert.equal(await page.locator('#person-select').inputValue(),'');assert.equal(await page.evaluate(()=>valley.focus),null);
 const bounds=await page.locator('.viewer-controls').boundingBox();assert(bounds.y> (mobile?915:960)*.75);assert(bounds.height<85);
 const trees=await page.evaluate(()=>valley.frame.settlement.trees.length);await page.evaluate(()=>{fixtureFrame.settlement.trees=fixtureFrame.settlement.trees.slice(0,1);fixtureFrame.settlement.treesPartial=true;});await page.waitForFunction(()=>valley.frame.settlement.treesPartial);assert.equal(await page.evaluate(()=>valley.frame.settlement.trees.length),trees,'partial frames preserve static trees');
 await page.locator('#connection').click();assert.match(await page.locator('#proof').textContent(),/awaiting configuration/);assert.match(await page.locator('#proof').textContent(),/96 maximum/);assert.deepEqual(errors,[]);await context.close();
}}
finally{await fs.writeFile('realtime-qa/natural-browser-report.json',JSON.stringify(report,null,2));await browser.close();await new Promise(r=>server.close(r));}
console.log('PASS actual WebGL natural landscape on mobile/desktop; unchanged home camera; compact bottom selectors; all people available everywhere; person follow and details; no page errors or horizontal overflow');
