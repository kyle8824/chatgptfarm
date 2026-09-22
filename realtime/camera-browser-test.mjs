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
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
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
  const pan={before,after};before=await home(page);after=await gesture([[130,400],[230,400]],[[170,440],[270,440]]);
  assert(distance(before.target,after.target)<.001,'rotation keeps the chosen viewing location');
  assert(Math.abs(after.azimuth-before.azimuth)>.05,'rotation changes horizontal angle');
  assert(Math.abs(after.polar-before.polar)>.05,'rotation changes vertical angle');
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
   await page.touchscreen.tap(...person);assert.equal((await measure(page)).selections,1,'single tap still selects a person');
  }
  assert.deepEqual(errors,[]);report.push({viewport:mobile?'mobile':'desktop',pan,rotate,zoom,errors});await context.close();
 }
 console.log('PASS camera: ground pan without rotation, two-finger/right-drag orbit and tilt, pinch/wheel zoom, release follow, genuine taps only.');
}finally{await fs.writeFile('realtime-qa/camera-report.json',JSON.stringify(report,null,2));await browser.close();await new Promise(resolve=>server.close(resolve));}
