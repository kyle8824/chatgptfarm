import {chromium} from 'playwright';
import {build} from '../cloudflare/node_modules/esbuild/lib/main.js';
import {createServer} from 'node:http';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {RealtimeController} from './world.mjs';
const worlds=JSON.parse(await fs.readFile('realtime-qa/family-fixtures.json')),frames={};
for(const [key,w]of Object.entries(worlds)){
 const saved=new Map(),storage={get:async k=>saved.get(k),put:async(k,v)=>saved.set(k,v),delete:async k=>saved.delete(k),setAlarm:async()=>{},transaction:async f=>f(storage)};
 const c=new RealtimeController(storage);await c.initialize(w);frames[key]=c.frame(1);frames[key].hour=12;frames[key].weather='clear';frames[key].wildlife=[];
 if(key==='toddler'){const p=frames[key].agents[0];frames[key].agents[2].coordinates={x:p.coordinates.x+1.65,y:p.coordinates.y};}
}
const source=await fs.readFile('web/live/client.js','utf8'),bundle=await build({stdin:{contents:source+'\nwindow.valley=scene;',resolveDir:process.cwd()+'/web/live'},bundle:true,format:'esm',write:false,nodePaths:[new URL('../cloudflare/node_modules/',import.meta.url).pathname]});
const html=await fs.readFile('web/live/index.html'),css=await fs.readFile('web/live/style.css');
const server=createServer((req,res)=>{const path=new URL(req.url,'http://localhost').pathname;res.setHeader('Content-Type',path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':path.endsWith('geometry')?'application/json':'text/html');res.end(path.endsWith('.js')?bundle.outputFiles[0].contents:path.endsWith('.css')?css:path.endsWith('geometry')?'{}':html);});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}),report=[];
try{for(const mobile of [true,false]){
 const context=await browser.newContext({viewport:mobile?{width:412,height:915}:{width:1440,height:960},isMobile:mobile,hasTouch:mobile}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.addInitScript(frames=>{window.familyFrames=frames;window.currentFamilyFrame=frames.relationships;window.WebSocket=class{static OPEN=1;constructor(){this.readyState=1;setTimeout(()=>this.onopen?.(),0);this.interval=setInterval(()=>this.onmessage?.({data:JSON.stringify(window.currentFamilyFrame)}),150);}send(){}close(){clearInterval(this.interval);}};},frames);
 await page.goto(`http://127.0.0.1:${server.address().port}/`);await page.waitForFunction(()=>window.valley?.frame?.agents.length);assert(!(await page.locator('.hint').textContent()).includes('unavailable'));
 for(const kind of ['relationships','couple','newborn','toddler']){
  await page.evaluate(kind=>{window.currentFamilyFrame=familyFrames[kind];valley.focus=null;const a=currentFamilyFrame.agents[0],x=a.coordinates.x,z=a.coordinates.y;valley.controls.target.set(x+.7,1,z);valley.camera.position.set(x+3.4,3.4,z+6.8);valley.controls.update();document.querySelector('.eyebrow').textContent='ISOLATED FAMILY FIXTURE';},kind);
  await page.waitForFunction(kind=>valley.frame.agents.length===familyFrames[kind].agents.length&&valley.frame.agents[0].life.pregnancy?.daysRemaining===familyFrames[kind].agents[0].life.pregnancy?.daysRemaining,kind);
  if(kind==='newborn')await page.waitForFunction(()=>{const a=valley.frame.agents[2],e=valley.entities.get(a.id),parent=valley.entities.get(a.life.carriedBy);return e?.model.infant&&e.group.position.y>parent.group.position.y+.4;});
  if(kind==='toddler')await page.waitForFunction(()=>{const e=valley.entities.get(valley.frame.agents[2].id);return !e.model.infant&&e.group.scale.y<.7;});
  await page.screenshot({path:`realtime-qa/family-${mobile?'mobile':'desktop'}-${kind}.png`});
  await page.locator('#agent-mara').click();await page.locator('[data-tab="relationships"]').click();
  const text=await page.locator('#inspect-content').textContent();assert.match(text,/years old/);assert.match(text,/Trust/);assert.match(text,/Familiarity/);assert.match(text,/Affection/);assert.match(text,/Mara’s romantic feelings/);assert.match(text,/Ivo’s romantic feelings/);
  if(kind==='relationships'){assert.match(text,/26 years old/);assert.match(text,/82%/);assert.match(text,/0%/);}
  if(kind==='couple'){assert.match(text,/Partner: Ivo/);assert.match(text,/A baby is expected/);}
  if(['newborn','toddler'].includes(kind)){assert.match(text,/Children:/);assert.equal(await page.locator('#people .person').count(),3);}
  assert.equal(await page.locator('#inspect-content .stats .stat').count(),5);
  await page.screenshot({path:`realtime-qa/family-${mobile?'mobile':'desktop'}-${kind}-inspector.png`});
  if(kind==='newborn'){await page.locator('#inspect-content [data-person="agent-child-1"]').first().click();assert.match(await page.locator('#inspect-content').textContent(),/0 months old/);assert.equal(await page.locator('.relationship-meter.romantic').count(),0,'baby has family bonds without adult romance controls');await page.screenshot({path:`realtime-qa/family-${mobile?'mobile':'desktop'}-baby-inspector.png`});}
  await page.getByRole('button',{name:'Close inspector'}).click();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);report.push({mobile,kind,agents:await page.locator('#people .person').count()});
 }
 assert.deepEqual(errors,[]);await context.close();
}}
finally{await fs.writeFile('realtime-qa/family-browser-report.json',JSON.stringify(report,null,2));await browser.close();await new Promise(r=>server.close(r));}
console.log('PASS actual mobile/desktop relationship meters, ages, couple/pregnancy, carried infant, growing toddler, family links, child-safe relationship UI and scrolling population cards');
