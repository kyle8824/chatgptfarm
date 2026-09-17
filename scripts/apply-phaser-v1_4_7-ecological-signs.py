from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count=text.count(old)
    if count!=1:
        raise SystemExit(f"{label}: expected exactly one patch anchor, found {count}")
    return text.replace(old,new,1)


ecology_path=Path('engine/ecology.js')
engine_path=Path('engine.js')
runtime_path=Path('engine/runtime.js')
renderer_path=Path('phaser-world-v1.js')
qa_path=Path('scripts/ecology-realism-qa.mjs')
browser_path=Path('scripts/phaser-qa.mjs')
html_path=Path('phaser.html')

ecology=ecology_path.read_text()
if "living-basin-1.3.0" not in ecology:
    ecology=replace_once(ecology,"export const ECOLOGY_VERSION='living-basin-1.2.0';","export const ECOLOGY_VERSION='living-basin-1.3.0';",'ecology version')
    ecology=replace_once(ecology,"function ensureArrays(e){e.events||=[];e.traces||=[];e.eventCooldowns||={}}","function ensureArrays(e){e.events||=[];e.traces||=[];e.signs||=[];e.eventCooldowns||={}}",'ecology signs array')
    old_age="function updateNeeds(a){"
    signs=r'''function ageSigns(w){const rain=w.weather==='rain';for(const s of w.ecologySystem.signs){s.ageHours=(s.ageHours||0)+1;s.clarity=clamp((s.clarity??.7)-(rain?.11:.038),0,1);if(s.ageHours>30||s.clarity<.18)s.active=false}w.ecologySystem.signs=w.ecologySystem.signs.filter(x=>x.active).slice(0,18)}
function addActivitySign(w,a){
 if(a.localPresence===false||a.species==='fish')return;
 let kind=null,label=null,chance=0,clarity=.65;
 if(a.species==='deer'&&a.activity==='graze'){kind='deer-browse';label='browsed twigs';chance=.15;clarity=.72}
 else if(a.species==='deer'&&a.activity==='rest'){kind='deer-bed';label='deer bed';chance=.08;clarity=.66}
 else if(a.species==='rabbit'&&a.activity==='graze'){kind='rabbit-browse';label='clipped vegetation';chance=.075;clarity=.56}
 else if(a.species==='bear'&&a.activity==='forage'){kind='bear-forage';label='disturbed ground';chance=.22;clarity=.84}
 if(!kind||unit(w,`${a.id}:sign:${kind}:${Math.floor(worldStamp(w)/2)}`)>chance)return;
 const e=w.ecologySystem,recent=e.signs.find(s=>s.active&&s.sourceId===a.id&&s.kind===kind&&(worldStamp(w)-((s.created?.day||w.day)*24+(s.created?.hour||0)))<5);if(recent)return;
 const id=`SIGN-${a.id}-${kind}-${w.day}-${String(w.hour).padStart(2,'0')}`;if(e.signs.some(s=>s.id===id))return;
 e.signs.unshift({id,sourceId:a.id,species:a.species,kind,label,position:{...a.position},clarity,ageHours:0,created:{day:w.day,hour:w.hour},active:true});e.signs=e.signs.slice(0,18)
}
'''
    # Avoid compact conditional syntax becoming visually ambiguous in generated JS.
    signs=signs.replace("rain?.11:.038","rain ? .11 : .038")
    ecology=replace_once(ecology,old_age,signs+old_age,'activity sign helpers')
    ecology=replace_once(ecology,"export function advanceEcology(w){ensureEcology(w);ageTraces(w);for(const a of w.ecologySystem.wildlife){","export function advanceEcology(w){ensureEcology(w);ageTraces(w);ageSigns(w);for(const a of w.ecologySystem.wildlife){",'age ecological signs')
    ecology=replace_once(ecology,"a.movement={from,to,goal,worldDay:w.day,worldHour:w.hour,speed:base*mult};addTrace(w,a,from,to);a.history.push", "a.movement={from,to,goal,worldDay:w.day,worldHour:w.hour,speed:base*mult};addTrace(w,a,from,to);addActivitySign(w,a);a.history.push",'create activity signs')
    anchor="export function wildlifeAIEnabled(w,id=null){"
    visible=r'''export function visibleWildlifeSignsForAgent(w,agent,radius=10){ensureEcology(w);const c=agent.coordinates;if(!c)return[];return w.ecologySystem.signs.filter(x=>x.active&&(x.clarity??0)>=.34&&dist(c,x.position)<=radius).map(x=>({id:x.id,sourceId:x.sourceId,species:x.species,kind:x.kind,label:x.label,distance:Math.round(dist(c,x.position)*10)/10,clarity:Math.round((x.clarity||0)*100)/100,ageHours:x.ageHours})).sort((a,b)=>a.distance-b.distance)}
'''
    ecology=replace_once(ecology,anchor,visible+anchor,'visible ecological signs')
    ecology_path.write_text(ecology)
else:
    print('v1.4.7 ecology signs already applied.')

engine=engine_path.read_text()
if 'visibleWildlifeSignsForAgent' not in engine:
    engine=replace_once(engine,"visibleWildlifeForAgent,visibleWildlifeTracesForAgent,wildlifeAIEnabled","visibleWildlifeForAgent,visibleWildlifeTracesForAgent,visibleWildlifeSignsForAgent,wildlifeAIEnabled",'engine sign export')
    engine_path.write_text(engine)

runtime=runtime_path.read_text()
if 'recordWildlifeSigns' not in runtime:
    runtime=replace_once(runtime,"import{visibleWildlifeForAgent,visibleWildlifeTracesForAgent}from'./ecology.js';","import{visibleWildlifeForAgent,visibleWildlifeTracesForAgent,visibleWildlifeSignsForAgent}from'./ecology.js';",'runtime sign import')
    helper="""function recordWildlifeSigns(w,a){a.wildlifeSignsSeen||={};for(const s of visibleWildlifeSignsForAgent(w,a)){if(a.wildlifeSignsSeen[s.id])continue;a.wildlifeSignsSeen[s.id]={day:w.day,hour:w.hour,signId:s.id,sourceId:s.sourceId};const age=s.ageHours<=3?'fresh':'older';remember(w,a,`I found ${age} ${s.label}; ${s.species} activity left this sign here.`,{importance:s.species==='bear'?8:5,tags:['animal','wildlife-sign',s.species,s.kind],source:`wildlife-sign:${s.id}`,confidence:Math.max(.5,s.clarity||.55)})}}
"""
    runtime=replace_once(runtime,"function shareKnowledge(w,a,b){",helper+"function shareKnowledge(w,a,b){",'wildlife sign memory helper')
    runtime=replace_once(runtime,"recordWildlifeSightings(w,live);const a=snap.agents.find", "recordWildlifeSightings(w,live);recordWildlifeSigns(w,live);const a=snap.agents.find",'record signs before decision')
    runtime=replace_once(runtime,"a.wildlifeTracksSeen=clone(live.wildlifeTracksSeen||{});const c=retrieveDecisionContext", "a.wildlifeTracksSeen=clone(live.wildlifeTracksSeen||{});a.wildlifeSignsSeen=clone(live.wildlifeSignsSeen||{});const c=retrieveDecisionContext",'clone sign knowledge')
    runtime_path.write_text(runtime)

renderer=renderer_path.read_text()
if "ecological-signs-v1" not in renderer:
    renderer=replace_once(renderer,"this.entities=new Map();this.treeSprites=[];this.ambient=[];this.traceVisuals=[];", "this.entities=new Map();this.treeSprites=[];this.ambient=[];this.traceVisuals=[];this.signVisuals=[];",'sign visual scene state')
    renderer=replace_once(renderer,"this.drawCanonicalObjects();this.renderCanonicalTraces();this.renderEntities(true);", "this.drawCanonicalObjects();this.renderCanonicalTraces();this.renderCanonicalSigns();this.renderEntities(true);",'initial sign render')
    renderer=replace_once(renderer,"refreshDynamicWorld(){this.renderCanonicalTraces();this.renderEntities(false);", "refreshDynamicWorld(){this.renderCanonicalTraces();this.renderCanonicalSigns();this.renderEntities(false);",'refresh sign render')
    anchor=" updateDecisionCue(initial=false){"
    method=r''' renderCanonicalSigns(){for(const v of this.signVisuals)v.destroy();this.signVisuals=[];const signs=(canonical?.ecologySystem?.signs||[]).filter(s=>s.active&&(s.clarity??0)>.34&&(s.ageHours??0)<=30);for(const s of signs){const p=worldToPx(s.position),a=clamp((s.clarity??.6)*.34,.09,.3),g=this.add.graphics().setDepth(700+p.y*.02).setAlpha(a);if(s.kind==='deer-bed'){g.fillStyle(0x514b37,1);g.fillEllipse(p.x,p.y,25,10);g.lineStyle(1,0x7d805c,.8);for(let i=-2;i<=2;i++)g.lineBetween(p.x+i*5,p.y+3,p.x+i*6+2,p.y-5)}else if(s.kind==='deer-browse'){g.lineStyle(1.4,0x5c4e35,1);g.lineBetween(p.x-8,p.y+6,p.x+8,p.y-7);g.lineBetween(p.x-1,p.y,p.x-7,p.y-7);g.fillStyle(0x6d7d50,.9);g.fillEllipse(p.x+7,p.y-7,6,3)}else if(s.kind==='rabbit-browse'){g.lineStyle(1,0x66744c,1);for(let i=-2;i<=2;i++)g.lineBetween(p.x+i*3,p.y+5,p.x+i*3+(i%2),p.y-4-(i%2)*2)}else if(s.kind==='bear-forage'){g.fillStyle(0x4d4233,.72);g.fillEllipse(p.x-5,p.y,15,7);g.fillEllipse(p.x+6,p.y+3,13,6);g.lineStyle(1.2,0x786750,.8);g.lineBetween(p.x-9,p.y-6,p.x+10,p.y+7)}g.setData('kind','ecological-sign');g.setData('signId',s.id);g.setData('species',s.species);this.signVisuals.push(g)}}
'''
    renderer=replace_once(renderer,anchor,method+anchor,'ecological sign rendering')
    renderer=replace_once(renderer,"rangePresence:'range-presence-v1',rangePresenceCounts:","rangePresence:'range-presence-v1',ecologicalSigns:'ecological-signs-v1',rangePresenceCounts:",'ecological sign snapshot marker')
    renderer=replace_once(renderer,"livingWorld:{trackVisuals:this.traceVisuals.length,", "livingWorld:{signVisuals:this.signVisuals.length,canonicalSigns:(canonical?.ecologySystem?.signs||[]).filter(s=>s.active&&(s.clarity??0)>.34&&(s.ageHours??0)<=30).length,trackVisuals:this.traceVisuals.length,",'ecological sign snapshot counts')
    renderer_path.write_text(renderer)

qa=qa_path.read_text()
if 'signsMax' not in qa:
    qa=replace_once(qa,"bearPresentHours:0,bearAbsentHours:0,lastBehavior", "bearPresentHours:0,bearAbsentHours:0,signsMax:0,signsSeen:0,lastBehavior",'sign QA stats')
    qa=replace_once(qa,"stats.tracksMax=Math.max(stats.tracksMax,w.ecologySystem.traces.length);", "stats.tracksMax=Math.max(stats.tracksMax,w.ecologySystem.traces.length);stats.signsMax=Math.max(stats.signsMax,w.ecologySystem.signs.length);stats.signsSeen+=w.ecologySystem.signs.length;for(const s of w.ecologySystem.signs){if(s.species==='fish')throw new Error(`fish created terrestrial sign ${s.id}`);if(!w.ecologySystem.wildlife.some(a=>a.id===s.sourceId))throw new Error(`orphan ecological sign ${s.id}`)}",'sign QA accumulation')
    anchor="if(stats.tracksMax>24)failures.push(`trace cap exceeded: ${stats.tracksMax}`);"
    qa=replace_once(qa,anchor,anchor+"\nif(stats.signsMax>18)failures.push(`ecological sign cap exceeded: ${stats.signsMax}`);\nif(stats.signsSeen<3)failures.push(`wildlife activity left too little persistent sign over 120 hours: ${stats.signsSeen}`);",'sign QA assertions')
    qa_path.write_text(qa)

browser=browser_path.read_text()
if 'expectedSigns' not in browser:
    needle="const expectedTracks=(state.ecologySystem?.traces||[]).filter(t=>t.active&&(t.clarity??0)>.38&&(t.ageHours??0)<=14&&(t.species!=='rabbit'||(t.clarity??0)>.55)).length;"
    replacement="const expectedSigns=(state.ecologySystem?.signs||[]).filter(x=>x.active&&(x.clarity??0)>.34&&(x.ageHours??0)<=30).length;if(s.livingWorld?.signVisuals!==expectedSigns||s.livingWorld?.canonicalSigns!==expectedSigns)failures.push(`ecological sign projection drift: rendered=${s.livingWorld?.signVisuals} canonical=${expectedSigns}`);"+needle
    browser=replace_once(browser,needle,replacement,'browser sign projection QA')
    browser_path.write_text(browser)

html=html_path.read_text().replace('phaser-world.css?v=00146','phaser-world.css?v=00147').replace('phaser-world-v1.js?v=00146','phaser-world-v1.js?v=00147')
html_path.write_text(html)
print('Applied v1.4.7 canonical ecological activity signs with local agent perception.')
