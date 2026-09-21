import {chromium} from 'playwright';
import fs from 'node:fs/promises';import assert from 'node:assert/strict';
const base='https://chatgptfarm.kyle8824.workers.dev';
await fs.mkdir('hosted-evidence',{recursive:true});const report={url:base+'/live/',checkedAt:new Date().toISOString(),viewports:[]};
const read=async()=>{const r=await fetch(base+'/live/health');assert.equal(r.status,200);return r.json();};
let browser;
try{
 report.before=await read();assert.equal(report.before.createdAt,1790030005263,'deployment retains the original live continuation');assert.equal(report.before.ai.model,'@cf/meta/llama-3.3-70b-instruct-fp8-fast');await new Promise(r=>setTimeout(r,12000));report.unattended=await read();
 assert(report.unattended.revision>report.before.revision,'hosted server progresses without browsers');
 assert(report.unattended.alarmCount>report.before.alarmCount,'hosted alarms run');
 assert.equal(report.unattended.viewers,0);
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 for(const[name,viewport]of [['desktop',{width:1440,height:960}],['mobile',{width:412,height:915}]]){
  const ctx=await browser.newContext({viewport,deviceScaleFactor:1,isMobile:name==='mobile',hasTouch:name==='mobile'}),p=await ctx.newPage(),errors=[],frames=[];
  p.on('pageerror',e=>errors.push(e.message));p.on('websocket',ws=>ws.on('framereceived',e=>{try{const m=JSON.parse(e.payload.toString());if(m.type==='state')frames.push(m);}catch{}}));
  await p.goto(base+'/live/',{waitUntil:'networkidle'});await p.getByText('Live world',{exact:true}).waitFor({timeout:30000});await p.waitForTimeout(6000);assert(!(await p.locator('.hint').innerText()).includes('3D unavailable'),'hosted 3D renderer initialized');
  await p.screenshot({path:'hosted-evidence/'+name+'.png'});await p.locator('#agent-mara').click();await p.getByRole('button',{name:'Memories',exact:true}).click();await p.screenshot({path:'hosted-evidence/'+name+'-inspector.png'});await p.getByRole('button',{name:'Close inspector'}).click();
  await p.locator('#connection').click();await p.screenshot({path:'hosted-evidence/'+name+'-connection.png'});await p.getByRole('button',{name:'Close connection details'}).click();await p.waitForTimeout(5000);
  assert(frames.length>15);assert(frames.at(-1).runtime.revision>frames[0].runtime.revision);assert(frames.every(f=>f.runtime.futureFrames===0&&f.runtime.computedThrough<=f.runtime.serverTime));assert.deepEqual(errors,[]);
  report.viewports.push({name,frames:frames.length,first:frames[0],last:frames.at(-1),errors});await ctx.close();
 }
 report.closed=await read();assert.equal(report.closed.viewers,0);await new Promise(r=>setTimeout(r,8000));report.after=await read();assert(report.after.unattendedSteps>report.closed.unattendedSteps);assert.equal(report.after.createdAt,report.before.createdAt);
 assert(report.after.ai.succeeded>0,'native model returns validated proposals');
 console.log(JSON.stringify({result:'PASS hosted unattended progression, WebSocket state, desktop/mobile UI and reload identity',ai:report.after.ai,unattended:[report.before.unattendedSteps,report.after.unattendedSteps],alarms:[report.before.alarmCount,report.after.alarmCount]}));
}finally{await fs.writeFile('hosted-evidence/report.json',JSON.stringify(report,null,2));if(browser)await browser.close();}
