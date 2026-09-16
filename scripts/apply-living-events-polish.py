from pathlib import Path
import re
p=Path('world-pixi-v11.js')
src=p.read_text()
src=src.replace("version:'v11.1-living-events'","version:'v11.2-living-director'",1)
src=src.replace("version:'v11.1-living-events',camera:","version:'v11.2-living-director',camera:",1)

# Smaller, species-shaped source-linked tracks.
pat=r"function renderWildlifeTraces\(\)\{.*?\}\nfunction renderAmbientLife"
new=r'''function renderWildlifeTraces(){for(const t of current.ecologySystem?.traces||[]){if(!t.active)continue;const p=wp(t.position),c=new PIXI.Container(),g=new PIXI.Graphics(),clarity=t.clarity||0,alpha=.10+.28*clarity,sp=t.species;c.position.set(p.x,p.y);c.rotation=-(Number(t.heading)||0);const size=sp==='bear'?.78:sp==='deer'?.62:.38,col=sp==='bear'?0x2b2119:sp==='deer'?0x43362b:0x53483e;for(let i=-2;i<=2;i++){const x=i*(sp==='rabbit'?5:7)*size,y=(i%2?1.4:-1.4)*size;if(sp==='deer'){g.beginFill(col,alpha).drawEllipse(x-1.2*size,y,1.25*size,2.6*size).drawEllipse(x+1.2*size,y,1.25*size,2.6*size).endFill()}else if(sp==='bear'){g.beginFill(col,alpha).drawEllipse(x,y,2.8*size,2.3*size).endFill();for(let k=-2;k<=2;k++)g.beginFill(col,alpha*.82).drawCircle(x+k*1.35*size,y-2.8*size-Math.abs(k)*.18,0.62*size).endFill()}else{g.beginFill(col,alpha).drawEllipse(x-1.2*size,y,1.1*size,2.2*size).drawEllipse(x+1.2*size,y+1.2*size,1.1*size,2.2*size).endFill()}}c.addChild(g);terrain.addChild(c)}}
function renderAmbientLife'''
src,n=re.subn(pat,new,src,count=1,flags=re.S)
if n!=1: raise SystemExit('track renderer anchor missing')

# Make aggregate bird activity visible without turning it into fake persistent birds.
src=src.replace("birdN=clamp(Math.round((amb.birds||0)/19),0,5)","birdN=clamp(Math.round((amb.birds||0)/14),0,6)",1)
src=src.replace("g.lineStyle(1.7,0x26352c,.72).moveTo(-7,0).quadraticCurveTo(-3,-4,0,0).quadraticCurveTo(3,-4,7,0);", "g.lineStyle(1.7,0x26352c,.72).moveTo(-7,0).quadraticCurveTo(-3,-4,0,0).quadraticCurveTo(3,-4,7,0).moveTo(8,5).quadraticCurveTo(12,1,16,5);",1)

# Better animal silhouettes: no antlers on the doe; fish school is visibly a school.
pat=r"function animalGraphics\(a\)\{.*?\}\nfunction renderWildlife\(\)"
new=r'''function animalGraphics(a){const c=new PIXI.Container(),g=new PIXI.Graphics(),species=a.species;let h=24;if(species==='deer'){g.beginFill(0x8b6848,.98).drawEllipse(0,0,13,7).drawCircle(12,-7,4.6).endFill();g.lineStyle(2.4,0x644832,1).moveTo(-8,5).lineTo(-9,16).moveTo(6,5).lineTo(7,16);g.beginFill(0xd9c7a6,.75).drawCircle(-13,-1,2.5).endFill();g.beginFill(0x76543b,.98).drawPolygon([9,-10,7,-16,11,-13]).drawPolygon([14,-10,17,-16,17,-12]).endFill();if(/buck/i.test(a.label||'')){g.lineStyle(1.25,0x5a412f,.9).moveTo(11,-11).lineTo(8,-19).moveTo(8,-17).lineTo(5,-20).moveTo(14,-11).lineTo(18,-19).moveTo(18,-17).lineTo(21,-20)}h=34}else if(species==='rabbit'){g.beginFill(0x8f8779,.98).drawEllipse(0,2,6.2,4.2).drawCircle(5,-3,3.8).endFill();g.beginFill(0xaaa292,.98).drawEllipse(3.8,-9,1.25,4.8).drawEllipse(6.6,-8.5,1.25,4.8).endFill();g.beginFill(0xe7dfd0,.9).drawCircle(-6,1,2).endFill();h=17}else if(species==='bear'){g.beginFill(0x44382f,.99).drawEllipse(0,1,18,11).drawCircle(15,-5,7.5).drawCircle(11,-11,2.5).drawCircle(19,-11,2.5).endFill();g.lineStyle(4,0x342b25,1).moveTo(-9,8).lineTo(-10,18).moveTo(8,8).lineTo(10,18);h=34}else if(species==='fish'){for(const [ox,oy,sc] of [[0,0,1],[-11,6,.78],[10,7,.72]]){g.beginFill(0x527f87,.88).drawEllipse(ox,oy,8*sc,3*sc).drawPolygon([ox-7*sc,oy,ox-12*sc,oy-4*sc,ox-12*sc,oy+4*sc]).endFill()}h=13}else{g.beginFill(0x776f61,.9).drawCircle(0,0,6).endFill();h=14}c.addChild(g);const name=new PIXI.Text(a.label||species,{fontFamily:'Arial',fontSize:10,fontWeight:'600',fill:0xf2f4e9,stroke:0x08100b,strokeThickness:3});name.anchor.set(.5);name.y=species==='deer'?-25:species==='bear'?-23:species==='rabbit'?-16:-17;name.alpha=0;c.addChild(name);c._animal={g,name,lastX:null};c.eventMode='static';c.cursor='pointer';c.on('pointerover',()=>name.alpha=.9);c.on('pointerout',()=>name.alpha=0);c.on('pointertap',e=>{e.stopPropagation();showSelection(c);openInspector(a,'wildlife')});return{c,h}}
function renderWildlife()'''
src,n=re.subn(pat,new,src,count=1,flags=re.S)
if n!=1: raise SystemExit('animal graphics anchor missing')

# AUTO should only frame the old route while travel is actually happening.
pat=r"function actionFrame\(a\)\{.*?\}\nfunction frameActivity"
new=r'''function actionFrame(a){if(!a)return{x:W*.55,y:W*.62,scale:1.35};const s=phase(a),pts=[wp(s)],plan=a.activeAction||{},travelling=s.phase==='travel';if(travelling&&plan.to)pts.push(wp(plan.to));if(travelling&&plan.from)pts.push(wp(plan.from));const social=/talk|teach|share|speak/i.test(`${a.currentAction||''} ${a.mind?.intent||''}`);if(social){const other=current?.agents?.find(x=>x.id!==a.id);if(other)pts.push(wp(phase(other)))}let minX=Math.min(...pts.map(p=>p.x)),maxX=Math.max(...pts.map(p=>p.x)),minY=Math.min(...pts.map(p=>p.y)),maxY=Math.max(...pts.map(p=>p.y));const mobile=app.screen.width<650,safeW=app.screen.width*(mobile?.88:.76),safeH=app.screen.height*(mobile?.48:.70),spanX=Math.max(120,maxX-minX),spanY=Math.max(100,maxY-minY),pad=mobile?150:210;let scale=clamp(Math.min(safeW/(spanX+pad),safeH/(spanY+pad)),mobile?1.05:.82,mobile?2.02:1.72);if(pts.length===1||Math.max(spanX,spanY)<150)scale=mobile?1.82:1.5;return{x:(minX+maxX)/2,y:(minY+maxY)/2,scale}}
function eventAge(e){if(!e||!current)return 999;return(current.day-e.day)*24+(current.hour-e.hour)}
function recentDirectedEvent(){const events=current?.ecologySystem?.events||[],urgent=Number(current?.liveThreads?.[0]?.urgency||0);for(const e of events){const age=eventAge(e),importance=Number(e.importance||0);if(age<0||age>2||!e.animalId||importance<7)continue;if(urgent>=90&&importance<9)continue;return e}return null}
function wildlifeEventFrame(e){const animal=wildlifeSprites.get(e?.animalId);if(!animal)return null;const pts=[{x:animal.x,y:animal.y}],agent=e.agentId?agentSprites.get(e.agentId):null;if(agent)pts.push({x:agent.x,y:agent.y});let minX=Math.min(...pts.map(p=>p.x)),maxX=Math.max(...pts.map(p=>p.x)),minY=Math.min(...pts.map(p=>p.y)),maxY=Math.max(...pts.map(p=>p.y));const mobile=app.screen.width<650,spanX=Math.max(70,maxX-minX),spanY=Math.max(70,maxY-minY),safeW=app.screen.width*(mobile?.82:.72),safeH=app.screen.height*(mobile?.46:.66),pad=mobile?140:190,scale=clamp(Math.min(safeW/(spanX+pad),safeH/(spanY+pad)),mobile?1.28:.9,mobile?1.92:1.7);return{x:(minX+maxX)/2,y:(minY+maxY)/2,scale}}
function autoFrame(){const e=recentDirectedEvent(),f=e?wildlifeEventFrame(e):null;return f||actionFrame(autoAgent())}
function frameActivity'''
src,n=re.subn(pat,new,src,count=1,flags=re.S)
if n!=1: raise SystemExit('actionFrame anchor missing')
src=src.replace("const f=actionFrame(autoAgent());camera.x=f.x;", "const f=autoFrame();camera.x=f.x;",1)
src=src.replace("if(camera.mode==='auto'&&Date.now()>camera.manualUntil)target=actionFrame(autoAgent());", "if(camera.mode==='auto'&&Date.now()>camera.manualUntil)target=autoFrame();",1)

# Focus card follows the same real-event director logic.
pat=r"function updateFocus\(\)\{.*?\}\nfunction flatten"
new=r'''function updateFocus(){const event=recentDirectedEvent();if(event){$('#focusCard').innerHTML=`<div class="focusInner"><small>LIVE · WILDLIFE · ${esc(event.species||'ANIMAL').toUpperCase()}</small><strong>${esc(event.title)}</strong><p>${esc(event.detail)}</p></div>`;return}const a=autoAgent();if(!a)return;const s=phase(a),v=window.ChatGPTFarmActionVisuals,d=v?.descriptor(a),where=v?.placeLabel(a.position)||a.position,what=d?.label?` · ${d.label}`:'';$('#focusCard').innerHTML=`<div class="focusInner"><small>${esc(s.label).toUpperCase()} · ${esc(where).toUpperCase()}${esc(what).toUpperCase()}</small><strong>${esc(a.name)} — ${esc(a.mind?.currentGoal||a.currentAction||'Responding to the world')}</strong><p>${esc(a.mind?.intent||a.currentAction||'')}</p></div>`}
function flatten'''
src,n=re.subn(pat,new,src,count=1,flags=re.S)
if n!=1: raise SystemExit('updateFocus anchor missing')

# Don't let low-signal resting events crowd out meaningful events in World Pulse.
src=src.replace("const ecoEvents=(current.ecologySystem?.events||[]).slice(0,4),life=ecoEvents.map", "const allEcoEvents=current.ecologySystem?.events||[],importantEco=allEcoEvents.filter(x=>(x.importance||0)>=4),ecoEvents=(importantEco.length?importantEco:allEcoEvents).slice(0,4),life=ecoEvents.map",1)
p.write_text(src)
