from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one patch anchor, found {count}")
    return text.replace(old, new, 1)

renderer_path=Path('phaser-world-v1.js')
qa_path=Path('scripts/phaser-qa.mjs')
html_path=Path('phaser.html')
renderer=renderer_path.read_text()

if "embodiment-v1" not in renderer:
    renderer=replace_once(renderer,
        "constructor(){super('LivingWorld');this.entities=new Map();this.treeSprites=[];this.ambient=[];this.traceVisuals=[];this.decisionCue=null;this.lastDecisionCueId=null;this.grid=null;this.drag=null;this.assetOk={};this.lastRenderedTick=null}",
        "constructor(){super('LivingWorld');this.entities=new Map();this.treeSprites=[];this.ambient=[];this.traceVisuals=[];this.decisionCue=null;this.lastDecisionCueId=null;this.lightOverlay=null;this.grid=null;this.drag=null;this.assetOk={};this.lastRenderedTick=null}",
        'light overlay scene state')
    renderer=replace_once(renderer,
        "make('person-mara',(g,w,h)=>{g.fillStyle(0x17251b,.22).fillEllipse(w/2,h-8,28,9);g.fillStyle(0x78ac85,1).fillRoundedRect(w/2-9,34,18,33,7);g.fillStyle(0xd2a184,1).fillCircle(w/2,25,10);g.fillStyle(0x49352c,1).fillEllipse(w/2,19,18,9)},54,76);",
        "make('person-mara',(g,w,h)=>{g.fillStyle(0x17251b,.17).fillEllipse(w/2,h-7,29,8);g.fillStyle(0x403d35,1).fillRoundedRect(20,57,6,13,3).fillRoundedRect(30,57,6,13,3);g.fillStyle(0x5e7867,1).fillRoundedRect(17,34,22,28,8);g.fillStyle(0xc99677,1).fillRoundedRect(11,38,7,22,4).fillRoundedRect(38,38,7,22,4);g.fillStyle(0x4a352f,1).fillEllipse(28,22,24,20).fillRoundedRect(16,21,7,22,4).fillRoundedRect(34,21,7,22,4);g.fillStyle(0xd2a184,1).fillCircle(28,26,10);g.fillStyle(0x3a2b28,1).fillEllipse(28,18,19,9);g.fillStyle(0x262824,1).fillCircle(24,27,1.3).fillCircle(32,27,1.3)},56,78);",
        'Mara natural procedural art')
    renderer=replace_once(renderer,
        "make('person-ivo',(g,w,h)=>{g.fillStyle(0x17251b,.22).fillEllipse(w/2,h-8,28,9);g.fillStyle(0x8589c5,1).fillRoundedRect(w/2-9,34,18,33,7);g.fillStyle(0xbe8d72,1).fillCircle(w/2,25,10);g.fillStyle(0x342b27,1).fillEllipse(w/2,19,18,9)},54,76);",
        "make('person-ivo',(g,w,h)=>{g.fillStyle(0x17251b,.17).fillEllipse(w/2,h-7,29,8);g.fillStyle(0x353a3a,1).fillRoundedRect(20,57,6,13,3).fillRoundedRect(30,57,6,13,3);g.fillStyle(0x66717a,1).fillRoundedRect(17,34,22,28,7);g.fillStyle(0xb9876e,1).fillRoundedRect(11,38,7,22,4).fillRoundedRect(38,38,7,22,4);g.fillStyle(0xbe8d72,1).fillCircle(28,26,10);g.fillStyle(0x302a27,1).fillEllipse(28,18,20,10);g.fillStyle(0x242622,1).fillCircle(24,27,1.3).fillCircle(32,27,1.3)},56,78);",
        'Ivo natural procedural art')
    renderer=replace_once(renderer,
        "make('berry-bush',(g)=>{g.fillStyle(0x3e713f,1).fillCircle(31,35,22).fillCircle(48,38,18).fillCircle(39,24,20);g.fillStyle(0xc74f5a,1);for(const [x,y] of [[27,29],[42,25],[49,39],[35,45]])g.fillCircle(x,y,3)},76,68);",
        "make('berry-bush',(g)=>{g.fillStyle(0x3e713f,1).fillCircle(31,35,22).fillCircle(48,38,18).fillCircle(39,24,20);g.fillStyle(0xc74f5a,1);for(const [x,y] of [[27,29],[42,25],[49,39],[35,45]])g.fillCircle(x,y,3)},76,68);make('ambient-bird',(g)=>{g.lineStyle(3,0x263126,.85);g.beginPath();g.moveTo(4,9);g.lineTo(10,5);g.lineTo(16,9);g.strokePath()},20,14);",
        'ambient bird texture')
    renderer=replace_once(renderer,
        "this.drawOrganicSurface();this.drawBiomeUnderlays();this.drawCreekDetails();this.spawnGroundDetail();this.spawnForest();this.drawCanonicalObjects();this.renderCanonicalTraces();this.renderEntities(true);this.updateDecisionCue(true);this.spawnAmbientLife();this.renderWeather();",
        "this.drawOrganicSurface();this.drawBiomeUnderlays();this.drawCreekDetails();this.spawnGroundDetail();this.spawnForest();this.drawCanonicalObjects();this.renderCanonicalTraces();this.renderEntities(true);this.updateDecisionCue(true);this.spawnAmbientLife();this.renderLightCycle();this.renderWeather();",
        'initial light cycle')
    renderer=replace_once(renderer,
        "refreshDynamicWorld(){this.renderCanonicalTraces();this.renderEntities(false);this.updateDecisionCue(false);this.renderWeather(true);this.refreshAmbient()}",
        "refreshDynamicWorld(){this.renderCanonicalTraces();this.renderEntities(false);this.updateDecisionCue(false);this.renderLightCycle(true);this.renderWeather(true);this.refreshAmbient()}",
        'dynamic light cycle')
    old_agent="upsertAgent(a,initial){let e=this.entities.get(a.id);if(!e){const fallbackKey=a.id==='agent-mara'?'person-mara':'person-ivo',artKey=a.id==='agent-mara'?'person-mara-art':'person-ivo-art',key=this.textures.exists(artKey)?artKey:fallbackKey,target=worldToPx(canonicalAgentPoint(a));e=this.add.image(target.x,target.y,key).setOrigin(.5,1);const h=key===artKey?58:55;e.setDisplaySize(Math.max(34,h*(e.width/Math.max(e.height,1))),h).setDepth(1000+target.y+3);e.setData('kind','agent');e.setData('id',a.id);e.setData('artMode',key===artKey?'tiny-farm':'fallback');const name=this.add.text(target.x,target.y-64,a.name,{fontFamily:'Arial',fontSize:'11px',fontStyle:'bold',color:'#f5f8f2',stroke:'#111a13',strokeThickness:4}).setOrigin(.5).setDepth(9000);e.setData('label',name);this.entities.set(a.id,e)}"
    new_agent="upsertAgent(a,initial){let e=this.entities.get(a.id);if(!e){const key=a.id==='agent-mara'?'person-mara':'person-ivo',target=worldToPx(canonicalAgentPoint(a));e=this.add.image(target.x,target.y,key).setOrigin(.5,1);const h=52;e.setDisplaySize(Math.max(33,h*(e.width/Math.max(e.height,1))),h).setDepth(1000+target.y+3);e.setData('kind','agent');e.setData('id',a.id);e.setData('artMode','natural-procedural');const name=this.add.text(target.x,target.y-59,a.name,{fontFamily:'Arial',fontSize:'10px',fontStyle:'bold',color:'#edf4e9',stroke:'#172018',strokeThickness:3}).setOrigin(.5).setDepth(9000).setAlpha(.9);e.setData('label',name);this.entities.set(a.id,e)}"
    renderer=replace_once(renderer,old_agent,new_agent,'natural agent embodiment')
    renderer=renderer.replace("from.y-64", "from.y-59").replace("to.y-64", "to.y-59").replace("e.y-64", "e.y-59")
    old_wild_end="e.setAlpha(['hide','freeze'].includes(a.activity)?.72:.96);e.setData('behavior',a.behavior||null);const from=worldToPx(a.movement?.from||a.previousPosition||a.position),to=worldToPx(a.movement?.to||a.position);if(initial&&dist(a.movement?.from||a.position,a.movement?.to||a.position)>.2){e.setPosition(from.x,from.y);this.moveEntity(e,to,a.species==='rabbit'?5200:a.species==='fish'?8500:7600)}else this.moveEntity(e,to,a.species==='fish'?MOVE_MS:MOVE_MS*.86)}"
    new_wild_end="e.setAlpha(['hide','freeze'].includes(a.activity)?.72:.96);e.setData('behavior',a.behavior||null);const wf=a.movement?.from||a.previousPosition||a.position,wt=a.movement?.to||a.position,moveD=dist(wf,wt),from=worldToPx(wf),to=worldToPx(wt),moving=moveD>.16&&!['rest','hide','freeze','drink'].includes(a.activity);let duration=moving?(a.species==='rabbit'?3400:a.species==='fish'?8500:a.species==='bear'?9000:6800):0;if(initial&&moving){e.setPosition(from.x,from.y);this.moveEntity(e,to,duration)}else this.moveEntity(e,to,duration);if(a.species==='rabbit'&&moving){const sy=e.scaleY;this.tweens.add({targets:e,scaleY:sy*.84,duration:170,yoyo:true,repeat:Math.max(1,Math.floor(duration/340)-1),ease:'Sine.InOut'})}}"
    renderer=replace_once(renderer,old_wild_end,new_wild_end,'species movement presentation')
    old_ambient="refreshAmbient(force=false){const birds=canonical?.ecologySystem?.ambient?.birds||0,target=clamp(Math.round(birds/12),1,8);if(!force&&this.ambient.length===target)return;for(const x of this.ambient)x.destroy();this.ambient=[];const R=seeded(`birds:${canonical?.ecologySystem?.ambient?.seed||0}`);for(let i=0;i<target;i++){const b=this.add.text(R()*WORLD,R()*WORLD*.55+180,'⌁',{fontSize:'17px',color:'#233126'}).setAlpha(.42).setDepth(8000);this.ambient.push(b);this.tweens.add({targets:b,x:b.x+(R()>.5?1:-1)*(240+R()*480),y:b.y+(R()-.5)*100,duration:9000+R()*9000,repeat:-1,yoyo:true,ease:'Sine.InOut'})}}"
    new_ambient="refreshAmbient(force=false){const birds=canonical?.ecologySystem?.ambient?.birds||0,target=clamp(Math.round(birds/14),0,7);if(!force&&this.ambient.length===target)return;for(const x of this.ambient)x.destroy();this.ambient=[];const R=seeded(`birds:${canonical?.ecologySystem?.ambient?.seed||0}`);for(let i=0;i<target;i++){const b=this.add.image(R()*WORLD,R()*WORLD*.5+140,'ambient-bird').setScale(.55+R()*.35).setAlpha(.28+R()*.2).setDepth(8000);this.ambient.push(b);this.tweens.add({targets:b,x:b.x+(R()>.5?1:-1)*(260+R()*520),y:b.y+(R()-.5)*90,duration:10500+R()*11000,repeat:-1,yoyo:true,ease:'Sine.InOut'})}}"
    renderer=replace_once(renderer,old_ambient,new_ambient,'natural ambient birds')
    anchor=" renderWeather(refresh=false){"
    method=r''' renderLightCycle(refresh=false){if(refresh&&this.lightOverlay){this.lightOverlay.destroy();this.lightOverlay=null}const h=canonical?.hour??12,wet=canonical?.weather==='rain';let color=0x0c1620,alpha=0;if(h<5||h>=22)alpha=.34;else if(h<7){color=0x5d4939;alpha=.14}else if(h>=19&&h<22){color=0x5c4437;alpha=.17}else if(wet)alpha=.065;if(alpha>0)this.lightOverlay=this.add.rectangle(WORLD/2,WORLD/2,WORLD,WORLD,color,alpha).setDepth(8800);this.lightCycle={hour:h,alpha:+alpha.toFixed(3),weather:canonical?.weather||null}}
'''
    renderer=replace_once(renderer,anchor,method+anchor,'canonical light cycle method')
    renderer=replace_once(renderer,"naturalism:'naturalism-v1',livingWorld:","naturalism:'naturalism-v1',embodiment:'embodiment-v1',lightCycle:this.lightCycle||null,livingWorld:",'embodiment snapshot')
    renderer_path.write_text(renderer)
else:
    print('Embodiment pass already applied.')

qa=qa_path.read_text()
qa=qa.replace("(s.agentArtModes||[]).some(x=>x!=='tiny-farm')", "(s.agentArtModes||[]).some(x=>x!=='natural-procedural')")
qa=qa.replace("Tiny Farm agent art failed to load", "natural agent embodiment failed")
needle="if(s.campVisualMode!=='canonical-branch-camp-v1')failures.push(`canonical camp visual mode missing: ${s.campVisualMode}`);"
if "light cycle state missing" not in qa:
    qa=replace_once(qa,needle,needle+"if(!s.lightCycle||s.lightCycle.hour!==state.hour)failures.push(`light cycle state missing or stale: ${JSON.stringify(s.lightCycle)}`);",'light cycle QA')
qa_path.write_text(qa)

html=html_path.read_text().replace('phaser-world.css?v=00141','phaser-world.css?v=00142').replace('phaser-world-v1.js?v=00141','phaser-world-v1.js?v=00142')
html_path.write_text(html)
print('Applied v1.4.2 natural embodiment, species movement feel, ambient birds, and canonical light cycle.')
