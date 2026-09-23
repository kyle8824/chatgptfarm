import {chromium} from 'playwright';
import {build} from '../cloudflare/node_modules/esbuild/lib/main.js';
import {createServer} from 'node:http';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createWorld} from '../engine/core.js';
import {RealtimeController} from './world.mjs';
const saved=new Map(),storage={get:async k=>saved.get(k),put:async(k,v)=>saved.set(k,v),delete:async k=>saved.delete(k),setAlarm:async()=>{},transaction:async f=>f(storage)};
const c=new RealtimeController(storage,{frontierEnabled:true});await c.initialize(createWorld());const frame=c.frame(1);frame.hour=12;frame.weather='clear';frame.wildlife=[];
const source=await fs.readFile('web/live/client.js','utf8'),bundle=await build({stdin:{contents:source+'\nwindow.valley=scene;',resolveDir:process.cwd()+'/web/live'},bundle:true,format:'esm',write:false,nodePaths:[new URL('../cloudflare/node_modules/',import.meta.url).pathname]});
const html=await fs.readFile('web/live/index.html'),css=await fs.readFile('web/live/style.css');await fs.mkdir('realtime-qa',{recursive:true});
const server=createServer((req,res)=>{const path=new URL(req.url,'http://localhost').pathname;res.setHeader('Content-Type',path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':path.endsWith('geometry')?'application/json':'text/html');res.end(path.endsWith('.js')?bundle.outputFiles[0].contents:path.endsWith('.css')?css:path.endsWith('geometry')?JSON.stringify(c.geometry()):html);});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}),report=[];
try{for(const mobile of [true,false]){
 const context=await browser.newContext({viewport:mobile?{width:412,height:915}:{width:1440,height:960},isMobile:mobile,hasTouch:mobile}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.addInitScript(frame=>{window.fixtureFrame=frame;window.WebSocket=class{static OPEN=1;constructor(){this.readyState=1;setTimeout(()=>this.onopen?.(),0);this.interval=setInterval(()=>this.onmessage?.({data:JSON.stringify(window.fixtureFrame)}),250);}send(){}close(){clearInterval(this.interval);}};},frame);
 await page.goto(`http://127.0.0.1:${server.address().port}/`);await page.waitForFunction(()=>window.valley?.frame?.agents.length===8);assert(!(await page.locator('.hint').textContent()).includes('unavailable'));
 await page.evaluate(()=>document.querySelector('.eyebrow').textContent='ISOLATED EXPANSION FIXTURE');
 for(const home of [...frame.frontier.homes,{id:'all'}]){
  await page.selectOption('#region-select',home.id);await page.waitForFunction(id=>document.querySelectorAll('#people .person:not([hidden])').length===(id==='all'?8:2),home.id);
  await page.waitForTimeout(200);if(home.id==='all'){await page.waitForFunction(()=>[...document.querySelectorAll('.region-label')].filter(e=>!e.hidden).length===4);assert.equal(await page.locator('.region-label:visible').count(),4,'all four camps fit the overview');assert.equal(await page.locator('#people').evaluate(e=>e.scrollLeft),0);}await page.screenshot({path:`realtime-qa/frontier-${mobile?'mobile':'desktop'}-${home.id}.png`});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  const visible=await page.locator('#people .person:visible').count();report.push({mobile,home:home.id,visible});
 }
 await page.selectOption('#region-select','ochre-vale');await page.locator('#agent-elin').click();assert.match(await page.locator('#inspect-content').textContent(),/Elin Clay/);await page.locator('[data-tab="relationships"]').click();const text=await page.locator('#inspect-content').textContent();assert.match(text,/Ronan Brook/);assert(!text.includes('Mara Vale'),'unknown founders are absent from relationships');await page.screenshot({path:`realtime-qa/frontier-${mobile?'mobile':'desktop'}-lineage.png`});await page.getByRole('button',{name:'Close inspector'}).click();
 const trees=await page.evaluate(()=>valley.frame.settlement.trees.length);await page.evaluate(()=>{fixtureFrame.settlement.trees=fixtureFrame.settlement.trees.slice(0,1);fixtureFrame.settlement.treesPartial=true;});await page.waitForFunction(()=>valley.frame.settlement.treesPartial);assert.equal(await page.evaluate(()=>valley.frame.settlement.trees.length),trees,'partial frames preserve static trees');
 await page.locator('#connection').click();assert.match(await page.locator('#proof').textContent(),/awaiting configuration/);assert.match(await page.locator('#proof').textContent(),/96 maximum/);assert.deepEqual(errors,[]);await context.close();
}}
finally{await fs.writeFile('realtime-qa/frontier-browser-report.json',JSON.stringify(report,null,2));await browser.close();await new Promise(r=>server.close(r));}
console.log('PASS mobile/desktop four regions and overview; local population cards; surnames and known relationships; partial geometry persistence; accurate unconfigured provider status; no console errors or overflow');
