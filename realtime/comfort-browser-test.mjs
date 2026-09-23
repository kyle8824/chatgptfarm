import {chromium} from 'playwright';
import {build} from '../cloudflare/node_modules/esbuild/lib/main.js';
import {createServer} from 'node:http';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {RealtimeController} from './world.mjs';
const worlds=JSON.parse(await fs.readFile('realtime-qa/comfort-fixtures.json')),frames={};
for(const [key,w]of Object.entries(worlds)){
 const saved=new Map(),storage={get:async k=>saved.get(k),put:async(k,v)=>saved.set(k,v),delete:async k=>saved.delete(k),setAlarm:async()=>{},transaction:async fn=>fn(storage)};
 const c=new RealtimeController(storage);await c.initialize(w);for(const a of c.record.world.agents)a.currentAction=a.task.label;frames[key]=c.frame(1);
}
// Exact production client/UI, with test-only access to its scene and an
// explicitly isolated fixture transport. No live world is seeded or edited.
const source=await fs.readFile('web/live/client.js','utf8');
const bundle=await build({stdin:{contents:source+'\nwindow.valley=scene;',resolveDir:process.cwd()+'/web/live'},bundle:true,format:'esm',write:false,nodePaths:[new URL('../cloudflare/node_modules/',import.meta.url).pathname]});
const html=await fs.readFile('web/live/index.html'),css=await fs.readFile('web/live/style.css');
const server=createServer((req,res)=>{const path=new URL(req.url,'http://localhost').pathname;res.setHeader('Content-Type',path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':path.endsWith('geometry')?'application/json':'text/html');res.end(path.endsWith('.js')?bundle.outputFiles[0].contents:path.endsWith('.css')?css:path.endsWith('geometry')?'{}':html);});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}),report=[];
try{for(const mobile of [true,false]){
 const context=await browser.newContext({viewport:mobile?{width:412,height:915}:{width:1440,height:960},isMobile:mobile,hasTouch:mobile}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.addInitScript(frames=>{window.comfortFrames=frames;window.currentComfortFrame=frames.ground;window.WebSocket=class{static OPEN=1;constructor(){this.readyState=1;window.fixtureSocket=this;setTimeout(()=>this.onopen?.(),0);this.interval=setInterval(()=>this.onmessage?.({data:JSON.stringify(window.currentComfortFrame)}),100);}send(){}close(){clearInterval(this.interval);}};},frames);
 await page.goto(`http://127.0.0.1:${server.address().port}/`);await page.waitForFunction(()=>window.valley?.frame?.agents.length);assert(!(await page.locator('.hint').textContent()).includes('unavailable'));
 for(const kind of ['ground','seat','mat','bed']){
  await page.evaluate(kind=>{window.currentComfortFrame=comfortFrames[kind];valley.focus=null;const a=currentComfortFrame.agents[0],x=a.coordinates.x,z=a.coordinates.y;valley.controls.target.set(x,.6,z);valley.camera.position.set(x+2.8,3.2,z+4.8);valley.controls.update();document.querySelector('.eyebrow').textContent='ISOLATED COMFORT FIXTURE';},kind);
  await page.waitForTimeout(1000);
  const pose=await page.evaluate(()=>{const a=valley.frame.agents[0],e=valley.entities.get(a.id);return {hip:e.model.hips.position.y,tilt:e.model.hips.rotation.x,scale:e.group.scale.y,support:a.restSupport,base:e.group.position.y,structureBase:a.restSupport?.projectId?valley.settlementView.objects.get(a.restSupport.projectId).group.position.y:null};});
  if(kind==='ground'){assert(pose.hip<.13,'bare ground pose sits on the ground, not an invisible chair');assert(Math.abs(pose.tilt)<.01);}
  else if(kind==='seat'){assert(Math.abs(pose.hip*pose.scale-pose.support.height-.08*pose.scale)<.01);assert(Math.abs(pose.base-pose.structureBase)<.01,'seat height is not added twice');}
  else {assert(Math.abs(pose.tilt+Math.PI/2)<.02,'bed/mat pose reclines on its real surface');assert(Math.abs(pose.hip*pose.scale-pose.support.height-.11*pose.scale)<.01);assert(Math.abs(pose.base-pose.structureBase)<.01);}
  await page.screenshot({path:`realtime-qa/comfort-${mobile?'mobile':'desktop'}-${kind}.png`});
  await page.locator('#agent-mara').click();assert.equal(await page.locator('#inspect-content .stat').count(),5);assert.match(await page.locator('#inspect-content .stat').last().textContent(),/Comfort\d+%/);assert.match(await page.locator('#inspect-content .action-box').textContent(),/resting comfort/);await page.screenshot({path:`realtime-qa/comfort-${mobile?'mobile':'desktop'}-${kind}-inspector.png`});await page.getByRole('button',{name:'Close inspector'}).click();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);report.push({mobile,kind,...pose});
 }
 assert.deepEqual(errors,[]);await context.close();
}}
finally{await fs.writeFile('realtime-qa/comfort-browser-report.json',JSON.stringify(report,null,2));await browser.close();await new Promise(r=>server.close(r));}
console.log('PASS actual mobile/desktop client: grounded posture, supported seats, reclining mat/bed, live comfort meter, no console errors or overflow');
