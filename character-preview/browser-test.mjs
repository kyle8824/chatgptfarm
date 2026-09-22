import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.CHARACTER_PREVIEW_URL||'http://127.0.0.1:4178/character-preview/';
const out=new URL('./evidence/',import.meta.url);await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const report=[];
try{
 for(const [name,size]of [['desktop',{width:1440,height:1050}],['mobile',{width:412,height:915}]]){
  const context=await browser.newContext({viewport:size,deviceScaleFactor:name==='mobile'?2:1,hasTouch:name==='mobile',isMobile:name==='mobile'}),page=await context.newPage(),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
  await page.goto(base,{waitUntil:'networkidle'});await page.waitForFunction(()=>window.previewMetrics?.fps>0);assert.equal(await page.locator('#failure').isVisible(),false,'actual WebGL rendered');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'no horizontal overflow');
  await page.locator('#pause').click();await page.screenshot({path:new URL(`${name}-together.png`,out).pathname});
  const initial=await page.evaluate(()=>window.previewMetrics);assert(initial.counts.mara.triangles<20000);assert(initial.counts.ivo.triangles<20000);assert(initial.counts.deer.triangles<10000);assert.equal(initial.previewOnly,true);
  if(name==='mobile'){
   const cdp=await context.newCDPSession(page);await page.waitForTimeout(1400);const before=await page.evaluate(()=>window.previewMetrics);
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:140,y:410,id:1}]});
   for(let x=150;x<=220;x+=10)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:410,id:1}]});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(1800);const after=await page.evaluate(()=>window.previewMetrics);
   assert(Math.hypot(...after.camera.target.map((x,i)=>x-before.camera.target[i]))>.05,'single-finger drag pans the camera');
   const direction=m=>m.camera.position.map((x,i)=>x-m.camera.target[i]);assert(Math.hypot(...direction(after).map((x,i)=>x-direction(before)[i]))<.01,'single-finger drag does not orbit');
   assert.equal(after.animationTime,before.animationTime,'pause stops the model animation');
   await page.locator('#home').click();await page.waitForTimeout(1800);
   const pinchBefore=await page.evaluate(()=>window.previewMetrics);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:150,y:420,id:1},{x:250,y:420,id:2}]});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:120,y:420,id:1},{x:280,y:420,id:2}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(1800);
   const pinchAfter=await page.evaluate(()=>window.previewMetrics);assert(Math.hypot(...direction(pinchAfter))<Math.hypot(...direction(pinchBefore))*.8,'two-finger pinch zooms');await page.locator('#home').click();
  }
  for(const subject of ['mara','ivo','deer']){
   await page.locator(`[data-subject=${subject}]`).click();await page.waitForTimeout(1300);await page.screenshot({path:new URL(`${name}-${subject}.png`,out).pathname});
   await page.locator('#close-up').click();await page.waitForTimeout(1300);await page.screenshot({path:new URL(`${name}-${subject}-close.png`,out).pathname});
   if(name==='desktop'){await page.locator('[data-angle=side]').click();await page.waitForTimeout(1300);await page.screenshot({path:new URL(`${name}-${subject}-side.png`,out).pathname});await page.locator('[data-angle=back]').click();await page.waitForTimeout(1300);await page.screenshot({path:new URL(`${name}-${subject}-back.png`,out).pathname});await page.locator('[data-angle=front]').click();}
  }
  await page.locator('[data-subject=together]').click();await page.locator('#pause').click();await page.locator('[data-mode=walk]').click();await page.waitForTimeout(3500);await page.screenshot({path:new URL(`${name}-walking.png`,out).pathname});
  await page.locator('#stats-toggle').click();assert.equal(await page.locator('#stats').isVisible(),true);await page.selectOption('#population','4');await page.waitForTimeout(4000);const crowd=await page.evaluate(()=>window.previewMetrics);assert.equal(crowd.population,12);await page.screenshot({path:new URL(`${name}-crowd.png`,out).pathname});
  await page.selectOption('#quality','detail');await page.waitForTimeout(1800);const detail=await page.evaluate(()=>window.previewMetrics);assert.equal(detail.quality,'detail');
  await page.selectOption('#population','1');await page.locator('[data-mode=work]').click();await page.waitForTimeout(1500);await page.screenshot({path:new URL(`${name}-working.png`,out).pathname});
  assert(requests.every(u=>new URL(u).origin===new URL(base).origin),'preview makes no external, world or storage requests');assert(requests.every(u=>!u.includes('/live/')),'preview never opens the world');assert.deepEqual(errors,[]);
  report.push({viewport:name,initial,crowd,detail,requests,errors});await context.close();
 }
}finally{await fs.writeFile(new URL('report.json',out),JSON.stringify(report,null,2));await browser.close();}
console.log('PASS independent WebGL preview; desktop/mobile views; model geometry budgets; selectors and quality controls; 12-model load; no world connections or console errors. Software-rendered frame rates are not phone benchmarks.');
