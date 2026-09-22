import {chromium} from 'playwright';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
const base='https://chatgptfarm.kyle8824.workers.dev';await fs.mkdir('hosted-motion-evidence',{recursive:true});
const before=await(await fetch(base+'/live/state')).json(),report={url:base+'/live/',checkedAt:new Date().toISOString(),before,views:[]};
assert.equal(before.runtime.createdAt,1790030005263,'same saved live world');assert(before.agents.every(a=>Number.isFinite(a.motion?.facing)),'new server motion deployed');
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 for(const [name,viewport] of [['desktop',{width:1440,height:960}],['mobile',{width:412,height:915}]]){
  const ctx=await browser.newContext({viewport,deviceScaleFactor:1,isMobile:name==='mobile',hasTouch:name==='mobile'}),p=await ctx.newPage(),frames=[],errors=[];
  p.on('pageerror',e=>errors.push(e.message));p.on('websocket',ws=>ws.on('framereceived',e=>{try{const f=JSON.parse(e.payload.toString());if(f.type==='state')frames.push(f);}catch{}}));
  await p.goto(base+'/live/',{waitUntil:'networkidle'});await p.getByText('Live world',{exact:true}).waitFor({timeout:30000});await p.waitForTimeout(8000);
  assert(!(await p.locator('.hint').innerText()).includes('3D unavailable'));await p.screenshot({path:'hosted-motion-evidence/'+name+'.png'});
  await p.locator('#agent-mara').click();await p.getByRole('button',{name:'Memories',exact:true}).click();await p.screenshot({path:'hosted-motion-evidence/'+name+'-inspector.png'});await p.getByRole('button',{name:'Close inspector'}).click();await p.waitForTimeout(12000);await p.screenshot({path:'hosted-motion-evidence/'+name+'-close.png'});
  const clearance=Math.min(...frames.map(f=>Math.hypot(f.agents[0].coordinates.x-f.agents[1].coordinates.x,f.agents[0].coordinates.y-f.agents[1].coordinates.y))),first=frames[0],last=frames.at(-1);
  assert(frames.length>20);assert(clearance>=1.02,'physical body separation');assert(last.runtime.revision>first.runtime.revision);assert(frames.every(f=>f.runtime.computedThrough<=f.runtime.serverTime&&f.runtime.futureFrames===0));assert(frames.some(f=>f.groundRecent?.length),'persistent recorded footsteps');
  const progress=last.agents.map(a=>{const initial=first.agents.find(b=>b.id===a.id);return {name:a.name,travel:Math.max(...frames.map(f=>{const p=f.agents.find(b=>b.id===a.id).coordinates;return Math.hypot(p.x-initial.coordinates.x,p.y-initial.coordinates.y);})),worked:frames.some(f=>{const b=f.agents.find(b=>b.id===a.id);return b.task?.id!==initial.task?.id||b.task?.workMinutes>initial.task?.workMinutes+.05;})};});assert(progress.every(p=>p.travel>.5||p.worked),'each villager makes real progress, including stationary work');assert.deepEqual(errors,[]);
  report.views.push({name,progress,frames:frames.length,minimumSeparation:clearance,first,last,errors});await ctx.close();
 }
 report.after=await(await fetch(base+'/live/state')).json();assert.equal(report.after.runtime.createdAt,report.before.runtime.createdAt);
 console.log(JSON.stringify({result:'PASS deployed body separation, recorded ground wear, live task progression, desktop/mobile graphics, world identity and no page errors',views:report.views.map(v=>({name:v.name,frames:v.frames,minimumSeparation:v.minimumSeparation})),agents:report.after.agents.map(a=>({name:a.name,needs:a.needs,position:a.coordinates,action:a.currentAction}))}));
}finally{await fs.writeFile('hosted-motion-evidence/report.json',JSON.stringify(report,null,2));await browser.close();}
