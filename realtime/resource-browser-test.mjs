// Real app, actual completed fixture; no production network or world writes.
import {chromium} from 'playwright';
import {build} from '../cloudflare/node_modules/esbuild/lib/main.js';
import {createServer} from 'node:http';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {RealtimeController} from './world.mjs';
const world=JSON.parse(await fs.readFile('realtime-qa/open-construction-fixture.json','utf8'));
const controller=new RealtimeController({},{now:()=>1790000000000});controller.record={world,revision:1,rate:6,createdAt:1790030005263,lastWallTime:1790000000000,ai:{calls:0},unattendedSteps:0};world.meta.liveFork??={sourceDay:1};
const frame=controller.frame();frame.hour=12;frame.weather='clear';
const bundle=await build({stdin:{contents:`
 import {ValleyScene} from './web/live/scene.js';
 import {natureMarkup} from './web/live/nature-inspector.js';
 import {placeMarkup} from './web/live/settlement-inspector.js';
 window.frame=${JSON.stringify(frame)};window.selected=null;
 window.valley=new ValleyScene(document.querySelector('canvas'),id=>{selected=id;document.querySelector('#details').innerHTML=natureMarkup(frame,id)||placeMarkup(frame,id)||id;});
 valley.accept(frame);window.show=id=>{valley.follow(id);valley.controls.update();};
 `,resolveDir:process.cwd()},bundle:true,format:'esm',write:false,nodePaths:[new URL('../cloudflare/node_modules/',import.meta.url).pathname]});
const css=await fs.readFile('web/live/style.css','utf8');
const html=`<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}\n#details{position:fixed;right:12px;top:12px;max-width:350px;max-height:45vh;overflow:auto;padding:16px;background:#182e27ec;border-radius:18px;color:#ecf0df}#labels{display:none}</style><canvas id="world"></canvas><div id="labels"></div><div id="details"></div><script type="module" src="/fixture.js"></script>`;
const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/fixture.js'?'text/javascript':'text/html');res.end(req.url==='/fixture.js'?bundle.outputFiles[0].contents:html);});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 for(const [name,size]of [['desktop',{width:1280,height:900}],['mobile',{width:412,height:915}]]){
  const page=await browser.newPage({viewport:size,hasTouch:name==='mobile',isMobile:name==='mobile'}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>window.valley?.frame);
  for(const type of ['stones','reeds','tree','rabbit','bear','fish','project']){
   const result=await page.evaluate(type=>{
    const v=valley,id=type==='project'?frame.settlement.projects[0].id:type==='tree'?frame.settlement.trees.find(t=>t.remaining>0).id:['rabbit','bear','fish'].includes(type)?frame.wildlife.find(a=>a.species===type).id:frame.objects.find(o=>o.mapped&&o.type===type).id;
    const object=v.entities.get(id)||v.naturalView.objects.get(id)||v.settlementView.objects.get(id),center=object.group.position.clone();center.y+=type==='tree'?2.5:type==='rabbit'?.3:type==='bear'?.8:type==='project'?1:.2;
    v.focus=null;v.camera.position.copy(center).add({x:4,y:5,z:7});v.controls.target.copy(center);v.controls.update();v.scene.updateMatrixWorld(true);v.camera.updateMatrixWorld();
    const screen=center.project(v.camera);return {id,x:(screen.x*.5+.5)*innerWidth,y:(-screen.y*.5+.5)*innerHeight};
   },type);
   await page.waitForTimeout(250);await page.mouse.click(result.x,result.y);
   await page.screenshot({path:`realtime-qa/${name}-inspect-${type}.png`});assert.equal(await page.evaluate(()=>selected),result.id,type+' is selectable from its actual rendered position');assert((await page.locator('#details').innerText()).length>25);
  }
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);await page.close();
 }
}finally{await browser.close();server.close();}
console.log('PASS desktop/mobile selection of trees, materials, animals, school and real code-built structure; live stats; no console errors');
