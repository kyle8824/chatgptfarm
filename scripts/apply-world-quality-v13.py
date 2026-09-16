from pathlib import Path
import re


def once(src, old, new, label):
    if old not in src:
        raise SystemExit(f'{label} anchor missing')
    return src.replace(old, new, 1)

p=Path('world-pixi-v11.js')
src=p.read_text()

# World heartbeats must keep AUTO camera/focus coherent in long-lived browser sessions.
src=once(src,
"if(changed||first){renderWorld();renderUI();renderAgents();if(first)frameActivity(true)}drawAtmosphere();",
"if(changed||first){renderWorld();renderUI();renderAgents();if(first)frameActivity(true);else if(camera.mode==='auto'&&Date.now()>camera.manualUntil)frameActivity(true)}drawAtmosphere();",
'heartbeat auto reframe')

# Debug state must expose real world coordinates and viewport/focus for composition QA.
src=once(src,
"c._debug={...meta,screenBaseY:y,zIndex:c.zIndex};",
"c._debug={...meta,worldX:c.x,worldY:c.y,screenBaseY:y,zIndex:c.zIndex};",
'world debug coordinates')
src=src.replace("c._debug.screenX=p.x;c._debug.screenBaseY=p.y;c._debug.zIndex=c.zIndex", "c._debug.screenX=p.x;c._debug.worldX=p.x;c._debug.worldY=p.y;c._debug.screenBaseY=p.y;c._debug.zIndex=c.zIndex")

old_debug="return{version:'v12.1-depth-basin',camera:{...camera},items,counts:items.reduce((a,x)=>(a[x.kind]=(a[x.kind]||0)+1,a),{}),layers:{ground:terrain.children.length,bank:bankLayer.children.length,water:waterLayer.children.length,shore:shoreLayer.children.length,world:worldLayer.children.length},riverCollisions:creekCollisionAudit(),treeCollisions:treeCollisionAudit(),ecology:{traceCount:(eco.traces||[]).filter(x=>x.active).length,eventCount:(eco.events||[]).length,ambient:eco.ambient||{}}}}"
new_debug="return{version:'v13-world-quality',camera:{...camera},viewport:{width:app?.screen?.width||0,height:app?.screen?.height||0,anchor:viewAnchor()},focus:{agentId:autoAgent()?.id||null,wildlifeId:recentDirectedEvent()?.animalId||null},items,counts:items.reduce((a,x)=>(a[x.kind]=(a[x.kind]||0)+1,a),{}),layers:{ground:terrain.children.length,bank:bankLayer.children.length,water:waterLayer.children.length,shore:shoreLayer.children.length,world:worldLayer.children.length},river:riverStats,riverCollisions:creekCollisionAudit(),treeCollisions:treeCollisionAudit(),ecology:{traceCount:(eco.traces||[]).filter(x=>x.active).length,eventCount:(eco.events||[]).length,ambient:eco.ambient||{}}}}"
src=once(src,old_debug,new_debug,'v13 renderer debug')
src=once(src,
"window.ChatGPTFarmRendererDebug={snapshot:rendererDebug,focusWorldUnit",
"window.ChatGPTFarmRendererDebug={snapshot:rendererDebug,reload:()=>load(false),focusWorldUnit",
'debug reload hook')

# Header should show the canonical object model version, not the legacy state schema version.
old="function renderUI(){const s=$('#worldStatus');if(s)s.innerHTML=`<strong>● OBJECT WORLD · ${esc(current.version||'?')}</strong><span>Day ${current.day} · ${String(current.hour).padStart(2,'0')}:00 · ${Math.round(current.temperature)}°F · ${esc(current.weather)}</span>`;"
new="function renderUI(){const s=$('#worldStatus'),objectVersion=String(current.worldModel?.version||current.version||'?').replace(/^object-field-/,'');if(s)s.innerHTML=`<strong>● OBJECT WORLD · ${esc(objectVersion)}</strong><span>Day ${current.day} · ${String(current.hour).padStart(2,'0')}:00 · ${Math.round(current.temperature)}°F · ${esc(current.weather)}</span>`;"
src=once(src,old,new,'object model status label')

# AUTO composition includes the physical object associated with the agent's current zone.
anchor="function actionFrame(a){"
if anchor not in src: raise SystemExit('actionFrame anchor missing')
context="function contextPoint(a){const o=(current?.worldModel?.objects||[]).find(x=>x.state?.active!==false&&!x.parentId&&x.zone===a?.position&&x.type!=='frontier');return o?.position?wp(o.position):null}\n"
src=src.replace(anchor,context+anchor,1)
src=once(src,
"const s=phase(a),pts=[wp(s)],plan=a.activeAction||{},travelling=s.phase==='travel';",
"const s=phase(a),pts=[wp(s)],plan=a.activeAction||{},travelling=s.phase==='travel',context=contextPoint(a);if(context&&Math.hypot(context.x-pts[0].x,context.y-pts[0].y)<360)pts.push(context);",
'context-aware auto frame')

# Replace the stroked-road creek with variable-width filled ribbons.
if "let app,root,terrain,bankLayer,waterLayer,shoreLayer,worldLayer,screenFx,current,lastTick=null;let worldItems=[];" not in src:
    raise SystemExit('renderer vars anchor missing')
src=src.replace("let app,root,terrain,bankLayer,waterLayer,shoreLayer,worldLayer,screenFx,current,lastTick=null;let worldItems=[];",
                "let app,root,terrain,bankLayer,waterLayer,shoreLayer,worldLayer,screenFx,current,lastTick=null;let worldItems=[],riverStats={};",1)
pat=r"function strokePath\(g,pts,width,color,alpha=1,ox=0,oy=0\)\{.*?\}\nfunction offsetPath\(pts,offset\)\{.*?\}\nfunction drawCreek\(\)\{.*?\}\nfunction makeSelectable"
river=r'''function pathNormal(pts,i){const a=pts[Math.max(0,i-1)],b=pts[Math.min(pts.length-1,i+1)],dx=b.x-a.x,dy=b.y-a.y,m=Math.hypot(dx,dy)||1;return{x:-dy/m,y:dx/m}}
function ribbonGeometry(pts,half,expand=0,phase=0){const left=[],right=[],widths=[];for(let i=0;i<pts.length;i++){const p=pts[i],n=pathNormal(pts,i),t=i/Math.max(1,pts.length-1),lw=half*(1+.11*Math.sin(t*Math.PI*5.2+phase)+.045*Math.sin(t*Math.PI*11.4+phase*.7))+expand,rw=half*(1+.10*Math.sin(t*Math.PI*4.6+phase+1.3)+.04*Math.sin(t*Math.PI*9.7+phase*.45))+expand;left.push({x:p.x+n.x*lw,y:p.y+n.y*lw});right.push({x:p.x-n.x*rw,y:p.y-n.y*rw});widths.push(lw+rw)}return{left,right,poly:[...left,...right.slice().reverse()],widths}}
function fillRibbon(layer,geom,color,alpha=1,dy=0){const g=new PIXI.Graphics(),flat=[];for(const p of geom.poly)flat.push(p.x,p.y+dy);g.beginFill(color,alpha).drawPolygon(flat).endFill();layer.addChild(g);return g}
function drawCreek(){const creek=(current.worldModel.objects||[]).find(o=>o.type==='creek_segment');if(!creek?.geometry?.points)return;let pts=creek.geometry.points.map(([x,y])=>wp({x,y}));const first=pts[0],second=pts[1],last=pts.at(-1),prev=pts.at(-2);pts=[{x:first.x-(second.x-first.x)*1.7,y:first.y-(second.y-first.y)*1.7},...pts,{x:last.x+(last.x-prev.x)*1.7,y:last.y+(last.y-prev.y)*1.7}];const smooth=creekCurve(pts,32),depth=current.worldModel?.fields?.waterDepth?.objects?.[creek.id]??.42,fullWidth=52+depth*18,half=fullWidth*.5,phase=1.73,shadow=ribbonGeometry(smooth,half,43,phase),earth=ribbonGeometry(smooth,half,31,phase),damp=ribbonGeometry(smooth,half,15,phase),water=ribbonGeometry(smooth,half,0,phase),deep=ribbonGeometry(smooth,half*.47,0,phase);fillRibbon(bankLayer,shadow,mix(C.shadow,C.mud,.42),.20,8);fillRibbon(bankLayer,earth,mix(C.bank,C.mud,.34),.96);fillRibbon(bankLayer,damp,mix(C.mud,C.waterDark,.30),.52);fillRibbon(waterLayer,water,mix(C.water,C.waterDark,depth*.30),.99);fillRibbon(waterLayer,deep,mix(C.waterDark,0x315f73,.18),.20);const widths=water.widths;riverStats={mode:'variable-ribbon',samples:smooth.length,minWidth:Math.round(Math.min(...widths)),maxWidth:Math.round(Math.max(...widths)),variation:Number((Math.max(...widths)/Math.min(...widths)).toFixed(2))};const R=rng('creek-ribbon-v13'),shore=new PIXI.Graphics(),ripples=new PIXI.Graphics();for(let i=10;i<smooth.length-10;i+=7+Math.floor(R()*9)){const a=smooth[i],b=smooth[Math.min(smooth.length-1,i+2)],dx=b.x-a.x,dy=b.y-a.y,m=Math.hypot(dx,dy)||1,nx=-dy/m,ny=dx/m;for(const side of[-1,1]){const edge=side<0?water.left[i]:water.right[i],out=7+R()*19,bx=edge.x+nx*out*side,by=edge.y+ny*out*side;if(R()<.72){for(let k=0;k<2+Math.floor(R()*4);k++){const ox=(R()-.5)*14,oy=(R()-.5)*7,h=6+R()*14;shore.lineStyle(1.15,mix(C.reed,C.ground2,.22),.40+R()*.24).moveTo(bx+ox,by+oy+3).lineTo(bx+ox+(R()-.5)*3,by+oy-h)}}if(R()<.38){const s=3+R()*5;shore.beginFill(R()>.5?C.rock:C.rock2,.62).drawEllipse(bx+(R()-.5)*13,by+(R()-.5)*8,s,s*.58).endFill()}if(R()<.30)shore.beginFill(mix(C.bank,C.ground2,.28),.18).drawEllipse(bx,by,11+R()*19,4+R()*7).endFill()}if(R()<.78){const rw=9+R()*24,yy=a.y+(R()-.5)*half*.55;ripples.lineStyle(1,0xd8f0ed,.09+R()*.08).moveTo(a.x-rw*.5,yy).quadraticCurveTo(a.x,yy-2,a.x+rw*.5,yy)}}shoreLayer.addChild(shore);waterLayer.addChild(ripples)}
function makeSelectable'''
src,n=re.subn(pat,river,src,count=1,flags=re.S)
if n!=1: raise SystemExit('stroked creek block missing')

p.write_text(src)

# Replace visual QA with state-transition and composition-aware testing.
p=Path('scripts/visual-qa.mjs')
qa=r'''import { chromium } from 'playwright';
import fs from 'node:fs';
import { migrateWorld, advanceEcology } from '../engine.js';

const base=process.env.BASE_URL||'http://127.0.0.1:4173/';
const qaMode=process.env.QA_MODE||'unknown';
fs.mkdirSync('visual-qa',{recursive:true});
let qaState=migrateWorld(JSON.parse(fs.readFileSync('world/state.json','utf8')));advanceEcology(qaState);const originalState=JSON.parse(JSON.stringify(qaState));fs.writeFileSync('visual-qa/state.json',JSON.stringify(qaState));
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:412,height:915},deviceScaleFactor:1,isMobile:true,hasTouch:true});
const page=await context.newPage();
await page.route(/raw\.githubusercontent\.com\/kyle8824\/chatgptfarm\/main\/world\/state\.json.*/,route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(qaState)}));
const errors=[],failures=[];page.on('pageerror',e=>errors.push(`pageerror: ${e.message}`));page.on('console',m=>{if(m.type()==='error')errors.push(`console: ${m.text()}`)});
await page.goto(base,{waitUntil:'domcontentloaded',timeout:60000});
await page.waitForFunction(()=>document.querySelector('#loading')?.classList.contains('hidden')&&window.ChatGPTFarmRendererDebug?.snapshot().items?.length>0,{timeout:60000});await page.waitForTimeout(1400);
const snap=()=>page.evaluate(()=>window.ChatGPTFarmRendererDebug.snapshot());let snapshot=await snap();
if(snapshot.version!=='v13-world-quality')failures.push(`expected v13-world-quality renderer, got ${snapshot.version}`);if((snapshot.riverCollisions||[]).length)failures.push(`river/object collisions: ${snapshot.riverCollisions.map(x=>`${x.label}:${x.clearance}px`).join(', ')}`);if((snapshot.treeCollisions||[]).length)failures.push(`aggregate tree/object collisions: ${snapshot.treeCollisions.map(x=>x.label).join(', ')}`);if(!snapshot.layers||snapshot.layers.bank<1||snapshot.layers.water<1||snapshot.layers.shore<1||snapshot.layers.world<1)failures.push('depth layer stack is incomplete');if(snapshot.river?.mode!=='variable-ribbon'||snapshot.river.samples<100||snapshot.river.variation<1.12)failures.push(`river is not a sufficiently variable ribbon: ${JSON.stringify(snapshot.river)}`);
const status=(await page.locator('#worldStatus strong').textContent())||'';if(!status.includes('0.9')||status.includes('0.7'))failures.push(`status is exposing stale schema version: ${status}`);
const items=snapshot.items||[],trees=items.filter(x=>x.kind==='tree'),reeds=items.filter(x=>x.kind==='reed-cluster'||x.kind==='reed_stand'),agents=items.filter(x=>x.kind==='agent'),wildlife=items.filter(x=>String(x.kind||'').startsWith('wildlife-')),raisedClay=items.filter(x=>x.kind==='clay_bank');if(trees.length<10)failures.push(`expected visible forest population, got ${trees.length} trees`);if(agents.length!==2)failures.push(`expected 2 agents, got ${agents.length}`);if(wildlife.length<8)failures.push(`expected living wildlife population, got ${wildlife.length}`);if((snapshot.ecology?.traceCount||0)<1)failures.push('expected at least one source-linked wildlife trace after QA ecology advance');if((snapshot.ecology?.ambient?.birds||0)<1)failures.push('ambient bird population is missing');if(raisedClay.length)failures.push('clay bank is incorrectly present in raised/depth-sorted layer');if(trees.length&&reeds.length){const minTree=Math.min(...trees.map(x=>Number(x.height)||0)),maxTree=Math.max(...trees.map(x=>Number(x.height)||0)),maxReed=Math.max(...reeds.map(x=>Number(x.height)||0));if(maxReed>=minTree*.72)failures.push(`reed/tree scale regression: max reed ${maxReed}px vs min tree ${minTree}px`);if(maxTree>84)failures.push(`forest dominance regression: max tree visual height ${maxTree}px`)}
const giant=items.filter(x=>['low-vegetation','ground-object','shrub'].includes(x.tier)&&Number(x.height)>72);if(giant.length)failures.push(`oversized low-tier visuals: ${giant.map(x=>`${x.kind}:${x.height}`).join(', ')}`);if(agents.length===2&&agents.every(x=>Number.isFinite(x.screenX)&&Number.isFinite(x.screenBaseY))){const d=Math.hypot(agents[0].screenX-agents[1].screenX,agents[0].screenBaseY-agents[1].screenBaseY);if(d<22)failures.push(`collocated agents are visually merged: ${d.toFixed(1)}px apart`)}
function screenPoint(s,item){const a=s.viewport.anchor;return{x:a.x+((item.screenX??item.worldX)-s.camera.x)*s.camera.scale,y:a.y+((item.screenBaseY??item.worldY)-s.camera.y)*s.camera.scale}}
function assertFocusVisible(s,label){const id=s.focus?.wildlifeId||s.focus?.agentId,item=(s.items||[]).find(x=>x.sourceId===id);if(!item){failures.push(`${label}: focus subject ${id} is missing`);return}const p=screenPoint(s,item),w=s.viewport.width,h=s.viewport.height;if(p.x<40||p.x>w-40||p.y<115||p.y>h-190)failures.push(`${label}: focus subject is outside useful viewport at ${p.x.toFixed(0)},${p.y.toFixed(0)}`);const a=s.viewport.anchor;if(Math.hypot(p.x-a.x,p.y-a.y)>190)failures.push(`${label}: focus subject is too far from camera anchor`)}
async function shot(name){await page.screenshot({path:`visual-qa/${name}.png`,fullPage:false})}
try{
 await shot('mobile-auto');assertFocusVisible(snapshot,'initial AUTO');
 for(const [button,name,id] of [['MARA','mobile-mara','agent-mara'],['IVO','mobile-ivo','agent-ivo']]){await page.getByRole('button',{name:button,exact:true}).click();await page.waitForTimeout(700);const follow=await page.evaluate(agentId=>{const s=window.ChatGPTFarmRendererDebug.snapshot(),a=(s.items||[]).find(x=>x.kind==='agent'&&x.sourceId===agentId);return{camera:s.camera,agent:a||null}},id);if(!follow.agent||!Number.isFinite(follow.agent.screenX)||!Number.isFinite(follow.agent.screenBaseY))failures.push(`${button} follow target is missing from renderer debug state`);else{const d=Math.hypot(follow.camera.x-follow.agent.screenX,follow.camera.y-follow.agent.screenBaseY);if(d>14)failures.push(`${button} camera is not following the rendered agent: ${d.toFixed(1)}px off target`)}await shot(name)}
 await page.getByRole('button',{name:'AUTO',exact:true}).click();await page.waitForTimeout(350);
 await page.evaluate(()=>window.ChatGPTFarmRendererDebug.focusWorldUnit(48,19,1.45));await page.waitForTimeout(250);await shot('mobile-creek');
 await page.evaluate(()=>window.ChatGPTFarmRendererDebug.focusWorldUnit(86,23,1.55));await page.waitForTimeout(250);await shot('mobile-east-bank');
 await page.evaluate(()=>window.ChatGPTFarmRendererDebug.focusWorldUnit(73,28,1.5));await page.waitForTimeout(250);await shot('mobile-stone-bank');
 if(!await page.evaluate(()=>window.ChatGPTFarmRendererDebug.focusWildlife('W-DEER-001',1.9)))failures.push('could not focus deer for visual QA');await page.waitForTimeout(250);await shot('mobile-deer');if(!await page.evaluate(()=>window.ChatGPTFarmRendererDebug.focusWildlife('W-BEAR-001',1.75)))failures.push('could not focus bear for visual QA');await page.waitForTimeout(250);await shot('mobile-bear');
 await page.locator('#pulseButton').click();await page.waitForTimeout(350);await shot('mobile-world-pulse');if(!await page.locator('#pulseDrawer').evaluate(el=>el.classList.contains('open')))failures.push('World Pulse drawer did not open');for(const [tab,name] of [['relationship','mobile-relationship'],['dna','mobile-decision-dna'],['controls','mobile-ai-usage']]){await page.locator(`[data-pulse-tab="${tab}"]`).click();await page.waitForTimeout(160);await shot(name)}const toggles=await page.locator('#pulseControls input[data-ai]').count();if(toggles!==3)failures.push(`expected 3 AI controls, got ${toggles}`);await page.locator('#pulseClose').click();
 // Reproduce the failure users actually see: state changes while the same AUTO page stays open.
 qaState=JSON.parse(JSON.stringify(originalState));qaState.meta=qaState.meta||{};qaState.meta.tickNumber=Number(qaState.meta.tickNumber||0)+100;qaState.meta.lastAdvancedAt=new Date(Date.now()-10*60*1000).toISOString();qaState.ecologySystem.events=[];const mara=qaState.agents.find(x=>x.id==='agent-mara');mara.position='clay';mara.coordinates={x:86,y:23};mara.currentAction='Inspect clay bank';mara.mind=mara.mind||{};mara.mind.currentGoal='Inspect the clay bank after a new heartbeat.';mara.mind.intent='Examine the clay exposure.';mara.activeAction={id:'QA-HEARTBEAT',decisionId:'QA-HEARTBEAT',label:'Inspect clay bank',actionId:'__qa__',worldDay:qaState.day,worldHour:qaState.hour,from:{x:86,y:23},to:{x:86,y:23},target:{x:86,y:23},moving:false,phases:[{id:'decide',label:'Deciding',start:0,end:.1},{id:'interact',label:'Acting',start:.1,end:.8},{id:'resolve',label:'Resolving',start:.8,end:1}],outcome:{success:true,detail:'QA heartbeat'}};qaState.liveThreads=[{id:'QA-THREAD',kind:'qa',title:'Heartbeat focus',summary:'Mara changed state after page load.',urgency:95,agentIds:['agent-mara']}];
 await page.getByRole('button',{name:'AUTO',exact:true}).click();await page.evaluate(()=>window.ChatGPTFarmRendererDebug.reload());await page.waitForTimeout(900);const heartbeat=await snap();assertFocusVisible(heartbeat,'heartbeat AUTO');if(heartbeat.focus?.agentId!=='agent-mara')failures.push(`heartbeat AUTO focus did not follow Mara: ${heartbeat.focus?.agentId}`);const hbStatus=(await page.locator('#focusCard').textContent())||'';if(!/Mara/i.test(hbStatus)||!/CLAY/i.test(hbStatus))failures.push(`heartbeat focus card/camera context diverged: ${hbStatus}`);await shot('mobile-heartbeat-auto');
}catch(e){failures.push(`interaction QA failed: ${String(e.message||e).slice(0,300)}`);try{await shot('mobile-interaction-error')}catch{}}
fs.writeFileSync('visual-qa/report.json',JSON.stringify({qaMode,base,snapshot,errors,failures,wildlifeCount:wildlife.length,traceCount:snapshot.ecology?.traceCount||0,ecologyEvents:snapshot.ecology?.eventCount||0},null,2));await browser.close();if(errors.length)console.error(errors.join('\n'));if(failures.length){console.error(failures.join('\n'));process.exit(1)}console.log(`Visual QA passed (${qaMode}): ${trees.length} trees, ${agents.length} agents, ${wildlife.length} wildlife, variable-ribbon creek.`);
'''
p.write_text(qa)

# Cache bust the exact renderer asset under review.
p=Path('index.html'); src=p.read_text();src=src.replace('action-visuals-v11.js?v=0905','action-visuals-v11.js?v=0906').replace('world-pixi-v11.js?v=0905','world-pixi-v11.js?v=0906');p.write_text(src)

# Make QA reports distinguish local exact-build review from exact production review.
p=Path('.github/workflows/visual-qa.yml'); src=p.read_text();src=once(src,
'echo "BASE_URL=https://www.chatgptfarm.com/" >> "$GITHUB_ENV"',
'echo "BASE_URL=https://www.chatgptfarm.com/" >> "$GITHUB_ENV"\n            echo "QA_MODE=production-exact" >> "$GITHUB_ENV"',
'production qa mode');src=once(src,
'echo "BASE_URL=http://127.0.0.1:4173/" >> "$GITHUB_ENV"',
'echo "BASE_URL=http://127.0.0.1:4173/" >> "$GITHUB_ENV"\n                echo "QA_MODE=local-exact" >> "$GITHUB_ENV"',
'local qa mode');p.write_text(src)
