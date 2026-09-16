from pathlib import Path
import re

# Runtime: people can notice real tracks left by persistent animals.
p=Path('engine/runtime.js'); src=p.read_text()
src=src.replace("import{visibleWildlifeForAgent}from'./ecology.js';","import{visibleWildlifeForAgent,visibleWildlifeTracesForAgent}from'./ecology.js';",1)
old=re.search(r"function recordWildlifeSightings\(w,a\)\{.*?\}\nfunction shareKnowledge",src,re.S)
if not old: raise SystemExit('recordWildlifeSightings anchor missing')
fn="""function recordWildlifeSightings(w,a){a.wildlifeSeen||={};a.wildlifeTracksSeen||={};for(const x of visibleWildlifeForAgent(w,a)){if(a.wildlifeSeen[x.species])continue;a.wildlifeSeen[x.species]={day:w.day,hour:w.hour,animalId:x.id};remember(w,a,`I saw ${x.label} nearby; it was ${x.behavior}.`,{importance:x.species==='bear'?9:6,tags:['animal','wildlife',x.species],source:`wildlife:${x.id}`,confidence:.9});addEvent(w,'wildlife',`${a.name} saw ${x.label}`,`${x.label} was ${x.behavior} about ${x.distance} world units away.`,{agentId:a.id,wildlifeId:x.id,species:x.species})}for(const t of visibleWildlifeTracesForAgent(w,a)){if((t.clarity||0)<.45||a.wildlifeTracksSeen[t.species])continue;a.wildlifeTracksSeen[t.species]={day:w.day,hour:w.hour,traceId:t.id,sourceId:t.sourceId};remember(w,a,`I found fresh ${t.species} tracks. They seem to lead somewhere.`,{importance:t.species==='bear'?9:6,tags:['animal','tracks',t.species],source:`wildlife-trace:${t.id}`,confidence:Math.max(.55,t.clarity||.6)});addEvent(w,'wildlife-track',`${a.name} found ${t.species} tracks`,`The tracks were ${Math.round((t.clarity||0)*100)}% clear and came from a real animal moving through the basin.`,{agentId:a.id,wildlifeId:t.sourceId,traceId:t.id,species:t.species})}}\nfunction shareKnowledge"""
src=src[:old.start()]+fn+src[old.end():]
src=src.replace("a.wildlifeSeen=clone(live.wildlifeSeen||{});const c=retrieveDecisionContext", "a.wildlifeSeen=clone(live.wildlifeSeen||{});a.wildlifeTracksSeen=clone(live.wildlifeTracksSeen||{});const c=retrieveDecisionContext",1)
p.write_text(src)

# Retire old permanent decorative tracks; ecology owns source-linked traces.
p=Path('engine/world-model.js'); src=p.read_text()
pat=r"const tracks=findWorldObject\(w,'OBJ-TRACKS-001'\);if\(e\.animalTracks&&!tracks\)w\.worldModel\.objects\.push\(\{.*?\}\);"
repl="const tracks=findWorldObject(w,'OBJ-TRACKS-001');if(tracks){tracks.state.active=false;tracks.state.retiredReason='replaced by source-linked wildlife traces';}"
src,n=re.subn(pat,repl,src,count=1,flags=re.S)
if n!=1: raise SystemExit('legacy tracks anchor missing')
p.write_text(src)

# Renderer integration.
p=Path('world-pixi-v11.js'); src=p.read_text()
src=src.replace("version:'v11-living-basin'","version:'v11.1-living-events'",1)
old="function rendererDebug(){const items=worldItems.map(c=>c._debug).filter(Boolean);return{version:'v11.1-living-events',camera:{...camera},items,counts:items.reduce((a,x)=>(a[x.kind]=(a[x.kind]||0)+1,a),{})}}"
new="function rendererDebug(){const items=worldItems.map(c=>c._debug).filter(Boolean),eco=current?.ecologySystem||{};return{version:'v11.1-living-events',camera:{...camera},items,counts:items.reduce((a,x)=>(a[x.kind]=(a[x.kind]||0)+1,a),{}),ecology:{traceCount:(eco.traces||[]).filter(x=>x.active).length,eventCount:(eco.events||[]).length,ambient:eco.ambient||{}}}}"
if old not in src: raise SystemExit('rendererDebug anchor missing')
src=src.replace(old,new,1)
src=src.replace("window.ChatGPTFarmRendererDebug={snapshot:rendererDebug};", "window.ChatGPTFarmRendererDebug={snapshot:rendererDebug,focusWorldUnit(x,y,scale=1.7){const p=wp({x,y});camera.mode='free';camera.manualUntil=Date.now()+60000;camera.x=p.x;camera.y=p.y;camera.scale=clamp(scale,MIN,MAX);camera.vx=camera.vy=0;syncButtons();updateCamera(true)},focusWildlife(id,scale=1.85){const c=wildlifeSprites.get(id);if(!c)return false;camera.mode='free';camera.manualUntil=Date.now()+60000;camera.x=c.x;camera.y=c.y;camera.scale=clamp(scale,MIN,MAX);camera.vx=camera.vy=0;syncButtons();updateCamera(true);return true}};",1)
src=src.replace("(current.artifacts||[]).filter(a=>a.status==='active'||a.status==='remnant').forEach(drawArtifact);renderWildlife()}","(current.artifacts||[]).filter(a=>a.status==='active'||a.status==='remnant').forEach(drawArtifact);renderWildlifeTraces();renderAmbientLife();renderWildlife()}",1)
marker="function wildlifePos(a){"
if marker not in src: raise SystemExit('wildlifePos marker missing')
extra=r'''function renderWildlifeTraces(){for(const t of current.ecologySystem?.traces||[]){if(!t.active)continue;const p=wp(t.position),c=new PIXI.Container(),g=new PIXI.Graphics(),s=Math.max(.48,Number(t.size)||1),alpha=.16+.42*(t.clarity||0);c.position.set(p.x,p.y);c.rotation=-(Number(t.heading)||0);const col=t.species==='bear'?0x2b2119:t.species==='deer'?0x43362b:0x53483e;for(let i=-2;i<=2;i++){const x=i*7*s,y=(i%2?2:-2)*s;g.beginFill(col,alpha).drawEllipse(x,y,2.7*s,4.2*s).endFill();if(t.species!=='rabbit'){g.beginFill(col,alpha*.8).drawCircle(x-2.7*s,y-3.6*s,1.15*s).drawCircle(x+2.7*s,y-3.6*s,1.15*s).endFill()}}c.addChild(g);terrain.addChild(c)}}
function renderAmbientLife(){const amb=current.ecologySystem?.ambient||{},seed=amb.seed||0,R=rng(`ambient:${seed}`),birdN=clamp(Math.round((amb.birds||0)/19),0,5),frogN=clamp(Math.round((amb.frogs||0)/28),0,3),insectN=clamp(Math.round((amb.insects||0)/26),0,3);for(let i=0;i<birdN;i++){const c=new PIXI.Container(),g=new PIXI.Graphics(),x=(18+R()*70)*PX,y=(100-(34+R()*35))*PX;g.lineStyle(1.7,0x26352c,.72).moveTo(-7,0).quadraticCurveTo(-3,-4,0,0).quadraticCurveTo(3,-4,7,0);c.addChild(g);c.position.set(x,y);c._ambient={type:'bird',baseX:x,baseY:y,phase:R()*6.28,speed:.7+R()*.8,range:55+R()*75};addWorld(c,y,60,{kind:'ambient-bird',tier:'ambient',height:9})}for(let i=0;i<frogN;i++){const c=new PIXI.Container(),g=new PIXI.Graphics(),p=wp({x:6+R()*10,y:17+R()*11});g.beginFill(0x385d3f,.78).drawEllipse(0,0,4,2.5).endFill();g.beginFill(0x8ca568,.65).drawCircle(2,-1,1).endFill();c.addChild(g);c.position.set(p.x,p.y);c._ambient={type:'frog',baseX:p.x,baseY:p.y,phase:R()*6.28};addWorld(c,p.y,5,{kind:'ambient-frog',tier:'ambient',height:7})}for(let i=0;i<insectN;i++){const c=new PIXI.Container(),g=new PIXI.Graphics(),p=wp({x:8+R()*18,y:19+R()*13});g.beginFill(0xe0d58a,.55).drawCircle(0,0,1.5).endFill();c.addChild(g);c.position.set(p.x,p.y);c._ambient={type:'insect',baseX:p.x,baseY:p.y,phase:R()*6.28,range:10+R()*12};addWorld(c,p.y,35,{kind:'ambient-insect',tier:'ambient',height:3})}}
function updateAmbientLife(t){for(const c of worldItems){const a=c._ambient;if(!a)continue;if(a.type==='bird'){c.x=a.baseX+((t*a.speed*18+a.phase*31)%Math.max(40,a.range))-a.range*.5;c.y=a.baseY+Math.sin(t*a.speed+a.phase)*9;c.rotation=Math.sin(t*2+a.phase)*.06}else if(a.type==='frog'){const hop=Math.max(0,Math.sin(t*.72+a.phase));c.y=a.baseY-hop*5;c.x=a.baseX+Math.sin(t*.27+a.phase)*3}else if(a.type==='insect'){c.x=a.baseX+Math.sin(t*1.8+a.phase)*a.range;c.y=a.baseY+Math.cos(t*2.3+a.phase)*a.range*.45}}}
'''
src=src.replace(marker,extra+marker,1)
pat=r"function animalGraphics\(a\)\{.*?\}\nfunction renderWildlife\(\)"
new=r'''function animalGraphics(a){const c=new PIXI.Container(),g=new PIXI.Graphics(),species=a.species;let h=24;if(species==='deer'){g.beginFill(0x8b6848,.98).drawEllipse(0,0,13,7).drawCircle(12,-7,4.6).endFill();g.lineStyle(2.4,0x644832,1).moveTo(-8,5).lineTo(-9,16).moveTo(6,5).lineTo(7,16).moveTo(11,-11).lineTo(8,-17).moveTo(13,-11).lineTo(17,-17);g.beginFill(0xd9c7a6,.75).drawCircle(-13,-1,2.5).endFill();if(/buck/i.test(a.label||''))g.lineStyle(1.2,0x5a412f,.9).moveTo(13,-11).lineTo(10,-18).moveTo(13,-13).lineTo(18,-18);h=34}else if(species==='rabbit'){g.beginFill(0x8f8779,.98).drawEllipse(0,2,6.2,4.2).drawCircle(5,-3,3.8).endFill();g.beginFill(0xaaa292,.98).drawEllipse(3.8,-9,1.25,4.8).drawEllipse(6.6,-8.5,1.25,4.8).endFill();g.beginFill(0xe7dfd0,.9).drawCircle(-6,1,2).endFill();h=17}else if(species==='bear'){g.beginFill(0x44382f,.99).drawEllipse(0,1,18,11).drawCircle(15,-5,7.5).drawCircle(11,-11,2.5).drawCircle(19,-11,2.5).endFill();g.lineStyle(4,0x342b25,1).moveTo(-9,8).lineTo(-10,18).moveTo(8,8).lineTo(10,18);h=34}else if(species==='fish'){g.beginFill(0x527f87,.88).drawEllipse(0,0,8,3).drawPolygon([-7,0,-12,-4,-12,4]).endFill();g.beginFill(0xb9d7d2,.7).drawCircle(4,-1,.8).endFill();h=8}else{g.beginFill(0x776f61,.9).drawCircle(0,0,6).endFill();h=14}c.addChild(g);const name=new PIXI.Text(a.label||species,{fontFamily:'Arial',fontSize:10,fontWeight:'600',fill:0xf2f4e9,stroke:0x08100b,strokeThickness:3});name.anchor.set(.5);name.y=species==='deer'?-25:species==='bear'?-23:species==='rabbit'?-16:-14;name.alpha=0;c.addChild(name);c._animal={g,name,lastX:null};c.eventMode='static';c.cursor='pointer';c.on('pointerover',()=>name.alpha=.9);c.on('pointerout',()=>name.alpha=0);c.on('pointertap',e=>{e.stopPropagation();showSelection(c);openInspector(a,'wildlife')});return{c,h}}
function renderWildlife()'''
src,n=re.subn(pat,new,src,count=1,flags=re.S)
if n!=1: raise SystemExit('animalGraphics anchor missing')
pat=r"function updateWildlife\(t\)\{.*?\}\nfunction progress\(\)"
new=r'''function updateWildlife(t){for(const a of current.ecologySystem?.wildlife||[]){const c=wildlifeSprites.get(a.id);if(!c)continue;const p=wp(wildlifePos(a)),from=a.movement?.from||a.position,to=a.movement?.to||a.position,moving=Math.hypot((to.x||0)-(from.x||0),(to.y||0)-(from.y||0))>.4;c.position.set(p.x,p.y);c.zIndex=worldZ(p.y,7);if(c._debug){c._debug.screenX=p.x;c._debug.screenBaseY=p.y;c._debug.zIndex=c.zIndex}const g=c._animal?.g;if(g){const dx=(to.x||0)-(from.x||0);if(Math.abs(dx)>.08)g.scale.x=dx<0?-1:1;const pace=a.activity==='flee'?1.8:a.species==='rabbit'?1.15:1;g.y=moving?Math.sin(t*(a.species==='rabbit'?10:a.species==='deer'?6.5:3.5)*pace+hash(a.id)%7)*(a.activity==='flee'?1.8:1.05):Math.sin(t*2+hash(a.id)%5)*.28;if(a.species==='fish')g.rotation=Math.sin(t*2+hash(a.id)%11)*.08}c._animal.name.scale.set(1/camera.scale)}}
function progress()'''
src,n=re.subn(pat,new,src,count=1,flags=re.S)
if n!=1: raise SystemExit('updateWildlife anchor missing')
src=src.replace("}updateWildlife(t);resolveAgentLabels();const wind=", "}updateWildlife(t);updateAmbientLife(t);resolveAgentLabels();const wind=",1)
wild_marker="const wild=animals.map(x=>`<span class=\"wildlifeChip\"><i></i>${esc(x.label)} · ${esc(x.behavior||x.activity)}</span>`).join('');"
if wild_marker not in src: raise SystemExit('Pulse wildlife marker missing')
src=src.replace(wild_marker,wild_marker+"const ecoEvents=(current.ecologySystem?.events||[]).slice(0,4),life=ecoEvents.map(x=>`<div class=\"pulseCard lifeEvent\"><small>${esc(x.kind)} · DAY ${x.day} ${String(x.hour).padStart(2,'0')}:00</small><h3>${esc(x.title)}</h3><p>${esc(x.detail)}</p></div>`).join('');",1)
old="<p>${wild||'Wildlife state is initializing.'}</p></div>`+(current.liveThreads||[])"
new="<p>${wild||'Wildlife state is initializing.'}</p></div>`+life+(current.liveThreads||[])"
if old not in src: raise SystemExit('Pulse now insertion missing')
src=src.replace(old,new,1)
p.write_text(src)

# Visual QA: require new ecology state and inspect creek/deer/bear directly.
p=Path('scripts/visual-qa.mjs'); src=p.read_text()
src=src.replace("if(wildlife.length<8)failures.push(`expected living wildlife population, got ${wildlife.length}`);", "if(wildlife.length<8)failures.push(`expected living wildlife population, got ${wildlife.length}`);if((snapshot.ecology?.traceCount||0)<1)failures.push('expected at least one source-linked wildlife trace after QA ecology advance');if((snapshot.ecology?.ambient?.birds||0)<1)failures.push('ambient bird population is missing');",1)
old="await page.getByRole('button',{name:'AUTO',exact:true}).click();await page.waitForTimeout(400);\n  await page.locator('#pulseButton').click();"
new="await page.getByRole('button',{name:'AUTO',exact:true}).click();await page.waitForTimeout(400);\n  await page.evaluate(()=>window.ChatGPTFarmRendererDebug.focusWorldUnit(48,74,1.45));await page.waitForTimeout(250);await shot('mobile-creek');\n  if(!await page.evaluate(()=>window.ChatGPTFarmRendererDebug.focusWildlife('W-DEER-001',1.9)))failures.push('could not focus deer for visual QA');await page.waitForTimeout(250);await shot('mobile-deer');\n  if(!await page.evaluate(()=>window.ChatGPTFarmRendererDebug.focusWildlife('W-BEAR-001',1.75)))failures.push('could not focus bear for visual QA');await page.waitForTimeout(250);await shot('mobile-bear');\n  await page.locator('#pulseButton').click();"
if old not in src: raise SystemExit('QA screenshot insertion missing')
src=src.replace(old,new,1)
src=src.replace("wildlifeCount:wildlife.length}","wildlifeCount:wildlife.length,traceCount:snapshot.ecology?.traceCount||0,ecologyEvents:snapshot.ecology?.eventCount||0}",1)
p.write_text(src)
