import {chromium} from 'playwright';
import {build} from '../cloudflare/node_modules/esbuild/lib/main.js';
import {createServer} from 'node:http';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {RealtimeController} from './world.mjs';
const worlds=JSON.parse(await fs.readFile('realtime-qa/construction-stages-fixtures.json')),frames={};
for(const [key,w]of Object.entries(worlds)){
 const saved=new Map(),storage={get:async k=>saved.get(k),put:async(k,v)=>saved.set(k,v),delete:async k=>saved.delete(k),setAlarm:async()=>{},transaction:async fn=>fn(storage)};
 const c=new RealtimeController(storage);await c.initialize(w);frames[key]=c.frame(1);
}
const source=await fs.readFile('web/live/client.js','utf8');
const bundle=await build({stdin:{contents:source+'\nwindow.valley=scene;window.inspectFixture=openPerson;',resolveDir:process.cwd()+'/web/live'},bundle:true,format:'esm',write:false,nodePaths:[new URL('../cloudflare/node_modules/',import.meta.url).pathname]});
const html=await fs.readFile('web/live/index.html'),css=await fs.readFile('web/live/style.css');
const server=createServer((req,res)=>{const path=new URL(req.url,'http://localhost').pathname;res.setHeader('Content-Type',path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':path.endsWith('geometry')?'application/json':'text/html');res.end(path.endsWith('.js')?bundle.outputFiles[0].contents:path.endsWith('.css')?css:path.endsWith('geometry')?'{}':html);});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}),report=[];
try{for(const mobile of [true,false]){
 const context=await browser.newContext({viewport:mobile?{width:412,height:915}:{width:1440,height:960},isMobile:mobile,hasTouch:mobile}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.addInitScript(frames=>{window.stageFrames=frames;window.currentStage='planned';window.WebSocket=class{static OPEN=1;constructor(){this.readyState=1;setTimeout(()=>this.onopen?.(),0);this.interval=setInterval(()=>this.onmessage?.({data:JSON.stringify(window.stageFrames[window.currentStage])}),100);}send(){}close(){clearInterval(this.interval);}};},frames);
 await page.goto(`http://127.0.0.1:${server.address().port}/`);await page.waitForFunction(()=>window.valley?.settlementView?.objects.size);
 for(const kind of Object.keys(frames)){
  await page.evaluate(kind=>{window.currentStage=kind;valley.focus=null;const p=stageFrames[kind].settlement.projects[0];valley.controls.target.set(p.position.x,.9,p.position.y);const zoom=innerWidth<650?1.65:1;valley.camera.position.set(p.position.x+4*zoom,3.8*zoom,p.position.y+5*zoom);valley.controls.update();document.querySelector('.eyebrow').textContent='ISOLATED CONSTRUCTION · '+kind.replaceAll('_',' ');},kind);
  await page.waitForFunction(kind=>{const target=stageFrames[kind].settlement.projects[0],actual=valley.frame?.settlement.projects[0];return actual&&JSON.stringify(actual.parts)===JSON.stringify(target.parts)&&valley.settlementView.objects.get(actual.id);},kind);
  const geometry=await page.evaluate(()=>{const p=valley.frame.settlement.projects[0],g=valley.settlementView.objects.get(p.id).group;return {built:p.parts.filter(x=>x.built).length,total:p.parts.length,meshes:g.children.filter(x=>x.isMesh&&x.userData.partId).map(x=>({id:x.userData.partId,scale:x.scale.toArray(),y:x.position.y,phase:x.userData.constructionPhase||'built',draw:x.geometry.drawRange.count,index:x.geometry.index.count})),markers:g.children.filter(x=>x.isLineSegments).map(x=>({height:x.scale.y,y:x.position.y}))};});
  assert(geometry.markers.every(x=>x.height<=.025&&x.y<=.025),'future parts are ground markings, not full-height buildings');
  if(kind==='planned')assert.equal(geometry.meshes.length,0);
  if(kind==='preparing'){assert.equal(geometry.meshes[0].phase,'preparing');assert(geometry.meshes[0].draw<geometry.meshes[0].index,'bundles appear progressively');assert.equal(geometry.meshes[0].scale[1],.08,'material thickness does not grow from a progress bar');}
  if(kind==='first_use')assert.equal(geometry.built,1);
  if(kind==='frame'){assert.equal(geometry.meshes.length,2);assert.equal(geometry.built,2);}
  if(kind==='covering'){assert.equal(geometry.meshes.find(x=>x.id==='roof').phase,'placing');assert(geometry.meshes.find(x=>x.id==='roof').draw<geometry.meshes.find(x=>x.id==='roof').index);}
  if(kind==='finished')assert.equal(geometry.built,geometry.total);
  await page.screenshot({path:`realtime-qa/stages-${mobile?'mobile':'desktop'}-${kind}.png`});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);report.push({mobile,kind,...geometry});
 }
 await page.evaluate(()=>inspectFixture(valley.frame.settlement.projects[0].id));await page.getByText('Building history',{exact:true}).waitFor();assert.match(await page.locator('#inspect-content').textContent(),/Stage 2.*Weather cover/s);await page.screenshot({path:`realtime-qa/stages-${mobile?'mobile':'desktop'}-history.png`});await page.getByRole('button',{name:'Close inspector'}).click();
 await page.selectOption('#person-select','agent-mara');await page.locator('#person-details').click();assert.equal(await page.locator('#inspect-content .stat').count(),6);assert.match(await page.locator('.improvement-goal').textContent(),/Ongoing goal/);await page.screenshot({path:`realtime-qa/stages-${mobile?'mobile':'desktop'}-goal.png`});
 assert.deepEqual(errors,[]);await context.close();
}}
finally{await fs.writeFile('realtime-qa/construction-browser-report.json',JSON.stringify(report,null,2));await browser.close();await new Promise(r=>server.close(r));}
console.log('PASS production Three.js/client at mobile and desktop sizes: real component preparation, placement, preserved dimensions, usable stages, extension history, goals and no console errors');
