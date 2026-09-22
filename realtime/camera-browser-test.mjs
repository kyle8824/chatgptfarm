// Browser component regression: the actual ValleyScene, rendered in WebGL.
// A test-only bundle exposes camera measurements; production has no test hooks.
import {chromium} from 'playwright';
import {build} from '../cloudflare/node_modules/esbuild/lib/main.js';
import {createServer} from 'node:http';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const bundle=await build({stdin:{contents:`
 import {ValleyScene} from './web/live/scene.js';
 window.selections=[];
 window.valley=new ValleyScene(document.querySelector('canvas'),id=>selections.push(id));
 valley.accept({agents:[{id:'test-person',name:'Camera test',coordinates:{x:51,y:31}}],wildlife:[],structures:{},weather:'clear',hour:12});
 `,resolveDir:process.cwd()},bundle:true,format:'esm',write:false,nodePaths:[new URL('../cloudflare/node_modules/',import.meta.url).pathname]});
const html='<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0;overflow:hidden}canvas{position:fixed;inset:0;width:100%;height:100%;touch-action:none}#labels{display:none}</style><canvas></canvas><div id="labels"></div><script type="module" src="/fixture.js"></script>';
const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/fixture.js'?'text/javascript':'text/html');res.end(req.url==='/fixture.js'?bundle.outputFiles[0].contents:html);});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
await fs.mkdir('realtime-qa',{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const report=[];
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
async function measure(page){return page.evaluate(()=>{
 const v=window.valley;for(let i=0;i<220;i++)v.controls.update();
 return{position:v.camera.position.toArray(),target:v.controls.target.toArray(),offset:v.camera.position.clone().sub(v.controls.target).toArray(),azimuth:v.controls.getAzimuthalAngle(),polar:v.controls.getPolarAngle(),distance:v.controls.getDistance(),focus:v.focus,selections:window.selections.length};
});}
async function home(page){await measure(page);await page.evaluate(()=>valley.home());return measure(page);}
try{
 for(const mobile of [true,false]){
  const context=await browser.newContext({viewport:mobile?{width:412,height:915}:{width:1440,height:960},isMobile:mobile,hasTouch:mobile});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(`http://127.0.0.1:${server.address().port}/`);await page.waitForFunction(()=>window.valley?.frame);await page.waitForTimeout(500);
  const cdp=await context.newCDPSession(page);
  const touch=(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(([x,y],id)=>({id,x,y,radiusX:3,radiusY:3,force:1}))});
  async function gesture(start,end){
   if(mobile){await touch('touchStart',start);for(let i=1;i<=12;i++)await touch('touchMove',start.map((p,j)=>p.map((v,k)=>v+(end[j][k]-v)*i/12)));await touch('touchEnd',[]);}
   else{await page.mouse.move(...start[0]);await page.mouse.down({button:start.length===2?'right':'left'});await page.mouse.move(...end[0],{steps:12});await page.mouse.up({button:start.length===2?'right':'left'});}
   return measure(page);
  }
  let before=await home(page),after=await gesture([[150,430]],[[230,430]]);
  assert(distance(before.target,after.target)>2,'drag changes the place being viewed');
  assert(distance(before.offset,after.offset)<.001,'drag translates without orbiting');
  const delta=after.position.map((v,i)=>v-before.position[i]);assert(distance(delta,after.target.map((v,i)=>v-before.target[i]))<.001,'camera and target translate together');
  await page.screenshot({path:`realtime-qa/camera-${mobile?'mobile':'desktop'}-pan.png`});
  const pan={before,after};before=await home(page);
  if(mobile){
   // Pinch, twist and move the midpoint in ONE gesture. The ground point
   // beneath the original midpoint must finish beneath the new midpoint.
   await touch('touchStart',[[130,430],[230,430]]);
   await page.evaluate(()=>{const c=valley.controls,g=c.gesture;window.gestureAnchor=c.rayAt(g.sample).intersectPlane(g.plane,new c.target.constructor());});
   for(let i=1;i<=12;i++){const t=i/12,a=t*.6,r=50+t*30,cx=180+t*22,cy=430+t*18;await touch('touchMove',[[cx-Math.cos(a)*r,cy-Math.sin(a)*r],[cx+Math.cos(a)*r,cy+Math.sin(a)*r]]);}
   const projected=await page.evaluate(()=>{valley.camera.updateMatrixWorld();const p=gestureAnchor.clone().project(valley.camera);return[(p.x*.5+.5)*innerWidth,(-p.y*.5+.5)*innerHeight];});
   assert(Math.hypot(projected[0]-202,projected[1]-448)<2,'midpoint stays anchored during combined pinch/twist/pan');
   await touch('touchEnd',[]);after=await measure(page);
   assert(Math.abs(after.azimuth-before.azimuth)>.4,'finger twist changes yaw');
   assert(Math.abs(after.polar-before.polar)<.001,'twist does not accidentally tilt');
   assert(after.distance<before.distance*.7,'pinch works during the same twist');
   // Parallel two-finger translation pans without silently becoming rotation.
   before=await home(page);after=await gesture([[130,430],[230,430]],[[170,460],[270,460]]);
   assert(distance(before.target,after.target)>2);assert(distance(before.offset,after.offset)<.001,'two-finger midpoint drag pans without orbit');
   // Adding and removing a second finger must rebase, not jump the camera.
   await touch('touchStart',[[140,430]]);const one=await measure(page);
   await touch('touchStart',[[140,430],[240,430]]);const two=await measure(page);assert(distance(one.position,two.position)<.001);
   await touch('touchEnd',[[140,430]]);const remaining=await measure(page);assert(distance(two.position,remaining.position)<.001);await touch('touchEnd',[]);
  }else{
   after=await gesture([[130,400],[230,400]],[[170,440],[270,440]]);
   assert(distance(before.target,after.target)<.001,'mouse orbit keeps viewing location');assert(Math.abs(after.azimuth-before.azimuth)>.05);assert(Math.abs(after.polar-before.polar)>.05);
  }
  assert.equal(after.selections,0,'camera gestures never select a person');
  await page.screenshot({path:`realtime-qa/camera-${mobile?'mobile':'desktop'}-rotate.png`});
  const rotate={before,after};before=await home(page);
  if(mobile)after=await gesture([[160,430],[240,430]],[[120,430],[280,430]]);
  else{await page.mouse.move(200,430);await page.mouse.wheel(0,-250);after=await measure(page);}
  assert(after.distance<before.distance*.9,'pinch/wheel zooms in');
  const zoom={before,after};
  await home(page);await page.evaluate(()=>valley.follow('test-person'));
  after=await gesture([[150,430]],[[220,430]]);assert.equal(after.focus,null,'manual movement releases person follow');
  if(mobile){
   await home(page);await page.evaluate(()=>valley.follow('test-person'));await page.waitForTimeout(300);
   const person=await page.evaluate(()=>{const v=valley,p=v.entities.get('test-person').group.position.clone();p.y+=1.3;p.project(v.camera);return[(p.x*.5+.5)*innerWidth,(-p.y*.5+.5)*innerHeight];});
   // Two fingers lifted over a person, cancellation, and out-and-back drags
   // must not masquerade as taps. A genuine single tap must still work.
   await touch('touchStart',[person,[person[0]+40,person[1]]]);await touch('touchEnd',[]);
   await touch('touchStart',[person]);await touch('touchCancel',[]);
   await touch('touchStart',[person]);await touch('touchMove',[[person[0]+40,person[1]]]);await touch('touchMove',[person]);await touch('touchEnd',[]);
   assert.equal((await measure(page)).selections,0,'multi-touch, cancellation and returning drags suppress selection');
   // Aim at the current torso after the preceding camera gestures settle.
   const tapPoint=await page.evaluate(()=>{const v=valley;v.camera.updateMatrixWorld();v.scene.updateMatrixWorld(true);const p=v.entities.get('test-person').group.position.clone();p.y+=1.04;p.project(v.camera);return[(p.x*.5+.5)*innerWidth,(-p.y*.5+.5)*innerHeight];});
   await page.touchscreen.tap(...tapPoint);assert.equal((await measure(page)).selections,1,'single tap still selects a person');
  }
  // Staged visual fixtures use the actual renderer/models; these screenshots
  // are close-up previews, not a claim that production villagers were posed.
  await page.evaluate(()=>{
   const v=valley;v.focus=null;for(const e of v.entities.values())v.scene.remove(e.group);v.entities.clear();for(const l of v.labels.values())l.remove();v.labels.clear();
   window.modelFrame={agents:[{id:'agent-mara',name:'Mara',coordinates:{x:45,y:34},motion:{speed:0,facing:0}},{id:'agent-ivo',name:'Ivo',coordinates:{x:46.5,y:34},motion:{speed:0,facing:0}}],wildlife:[{id:'test-deer',species:'deer',position:{x:48,y:34},behavior:'grazing'}],structures:{},weather:'clear',hour:12};
   v.accept(modelFrame);v.controls.target.set(45.75,1.6,34);v.camera.position.set(45.75,2.8,40.6);v.controls.update();window.modelTimer=setInterval(()=>v.accept(modelFrame),500);
  });
  await page.waitForTimeout(800);await page.screenshot({path:`realtime-qa/models-${mobile?'mobile':'desktop'}-day.png`});
  if(mobile){await page.evaluate(()=>{modelFrame.hour=1;valley.accept(modelFrame);});await page.waitForTimeout(500);await page.screenshot({path:'realtime-qa/models-mobile-night.png'});}
  await page.evaluate(()=>{
   const v=valley;modelFrame.hour=12;modelFrame.agents=[{id:'agent-ivo',name:'Ivo',coordinates:{x:48,y:20.85333333333333},motion:{speed:0,facing:Math.PI},task:{actionId:'drink',phase:'work',label:'Drink from the creek'}}];
   const mara=v.entities.get('agent-mara');v.scene.remove(mara.group);v.entities.delete('agent-mara');v.labels.get('agent-mara').remove();v.labels.delete('agent-mara');v.accept(modelFrame);
   const e=v.entities.get('agent-ivo');e.group.position.copy(e.target);e.pos.copy(e.target);e.group.rotation.y=Math.PI;v.controls.target.set(48,.85,20.85);v.camera.position.set(50,2.6,15.7);v.controls.update();v.elapsed=.1;
  });
  await page.waitForTimeout(600);await page.screenshot({path:`realtime-qa/drinking-${mobile?'mobile':'desktop'}-scoop.png`});
  await page.evaluate(()=>{valley.elapsed=1.85;});await page.waitForTimeout(600);await page.screenshot({path:`realtime-qa/drinking-${mobile?'mobile':'desktop'}-sip.png`});
  await page.evaluate(()=>{modelFrame.agents[0].inventory={dryWood:2,berries:3};valley.accept(modelFrame);});await page.waitForTimeout(300);await page.screenshot({path:`realtime-qa/cargo-${mobile?'mobile':'desktop'}.png`});
  const graphics=await page.evaluate(()=>({triangles:valley.renderer.info.render.triangles,drawCalls:valley.renderer.info.render.calls}));
  assert.deepEqual(errors,[]);report.push({viewport:mobile?'mobile':'desktop',pan,rotate,zoom,graphics,errors});await context.close();
 }
 console.log('PASS camera: ground pan without rotation, simultaneous anchored pinch/twist/pan, gesture transitions, right-drag orbit and tilt, pinch/wheel zoom, release follow, genuine taps only.');
}finally{await fs.writeFile('realtime-qa/camera-report.json',JSON.stringify(report,null,2));await browser.close();await new Promise(resolve=>server.close(resolve));}
