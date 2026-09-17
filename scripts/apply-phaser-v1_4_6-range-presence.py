from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one patch anchor, found {count}")
    return text.replace(old, new, 1)


ecology_path=Path('engine/ecology.js')
renderer_path=Path('phaser-world-v1.js')
qa_path=Path('scripts/ecology-realism-qa.mjs')
browser_qa_path=Path('scripts/phaser-qa.mjs')
html_path=Path('phaser.html')

ecology=ecology_path.read_text()
if "living-basin-1.2.0" not in ecology:
    ecology=replace_once(ecology,"export const ECOLOGY_VERSION='living-basin-1.1.0';","export const ECOLOGY_VERSION='living-basin-1.2.0';",'ecology version')
    old_animal="function animal(id,species,label,x,y,extra={}){return{id,species,label,position:{x,y},previousPosition:{x,y},target:{x,y},home:{x,y},activity:'rest',behavior:'calm',behaviorUntil:0,behaviorGoal:{x,y},fear:0,needs:{energy:80,hunger:72,thirst:75},active:true,ageClass:'adult',history:[],ai:{eligible:true,mode:'simulation',calls:0,lastDecisionAt:null},movement:{from:{x,y},to:{x,y},worldDay:1,worldHour:6},...extra}}"
    new_animal="function animal(id,species,label,x,y,extra={}){return{id,species,label,position:{x,y},previousPosition:{x,y},target:{x,y},home:{x,y},activity:'rest',behavior:'calm',behaviorUntil:0,behaviorGoal:{x,y},fear:0,needs:{energy:80,hunger:72,thirst:75},active:true,localPresence:true,rangeState:'basin',rangeUntil:0,ageClass:'adult',history:[],ai:{eligible:true,mode:'simulation',calls:0,lastDecisionAt:null},movement:{from:{x,y},to:{x,y},worldDay:1,worldHour:6},...extra}}"
    ecology=replace_once(ecology,old_animal,new_animal,'animal range state')
    old_migration="for(const x of w.ecologySystem.wildlife){x.previousPosition||={...x.position};x.target||={...x.position};x.home||={...x.position};x.behaviorGoal||={...x.target};x.behaviorUntil??=0;x.movement||="
    new_migration="for(const x of w.ecologySystem.wildlife){x.previousPosition||={...x.position};x.target||={...x.position};x.home||={...x.position};x.behaviorGoal||={...x.target};x.behaviorUntil??=0;x.localPresence??=true;x.rangeState||=(x.localPresence===false?'outside-basin':'basin');x.rangeUntil??=worldStamp(w)+(x.species==='bear'?4:x.species==='deer'?6:99999);x.movement||="
    ecology=replace_once(ecology,old_migration,new_migration,'range state migration')
    anchor="function updateAmbient(w){"
    presence=r'''function updateLocalPresence(w,a){
 const stamp=worldStamp(w),seg=segmentOfDay(w);
 if(a.species==='rabbit'||a.species==='fish'){a.localPresence=true;a.rangeState='basin';a.rangeUntil=Math.max(a.rangeUntil||0,stamp+24);return true}
 if(a.rangeUntil==null||!Number.isFinite(a.rangeUntil))a.rangeUntil=stamp+(a.species==='bear'?4:6);
 if(a.localPresence===false){
  if(stamp<a.rangeUntil)return false;
  const returnChance=a.species==='bear'?(seg==='dawn'||seg==='dusk'?.16:seg==='night'?.10:.035):(seg==='dawn'||seg==='dusk'?.62:seg==='night'?.18:.08);
  if(unit(w,`${a.id}:range-return:${Math.floor(stamp/3)}`)>returnChance){a.rangeUntil=stamp+(a.species==='bear'?8:3);return false}
  const entry=chooseHabitat(w,a),q=jitter(w,a,entry,a.species==='bear'?2.8:1.7,'range-entry');
  a.localPresence=true;a.rangeState='basin';a.position={...q};a.previousPosition={...q};a.target={...q};a.behaviorGoal={...q};a.activity='move';a.behavior='entering basin';a.behaviorUntil=stamp+1;
  a.needs.energy=Math.max(a.needs.energy,58);a.needs.hunger=Math.max(a.needs.hunger,56);a.needs.thirst=Math.max(a.needs.thirst,56);
  a.rangeUntil=stamp+(a.species==='bear'?2+Math.floor(unit(w,`${a.id}:visit-hours`)*4):3+Math.floor(unit(w,`${a.id}:visit-hours`)*6));
  a.history.push({day:w.day,hour:w.hour,activity:'range-entry',behavior:'entered basin',from:null,to:{...q},goal:{...q}});if(a.history.length>48)a.history=a.history.slice(-48);return true
 }
 if(stamp<a.rangeUntil)return true;
 const leaveChance=a.species==='bear'?.78:(seg==='dawn'||seg==='dusk'?.28:.62);
 if(unit(w,`${a.id}:range-leave:${Math.floor(stamp/2)}`)>leaveChance){a.rangeUntil=stamp+2;return true}
 a.localPresence=false;a.rangeState='outside-basin';a.activity='range';a.behavior='outside basin';a.behaviorUntil=0;
 a.rangeUntil=stamp+(a.species==='bear'?48+Math.floor(unit(w,`${a.id}:range-absence`)*96):7+Math.floor(unit(w,`${a.id}:range-absence`)*17));
 a.movement={from:{...a.position},to:{...a.position},goal:{...a.position},worldDay:w.day,worldHour:w.hour,speed:0};
 a.history.push({day:w.day,hour:w.hour,activity:'range-exit',behavior:'left basin',from:{...a.position},to:null,goal:null});if(a.history.length>48)a.history=a.history.slice(-48);return false
}
'''
    ecology=replace_once(ecology,anchor,presence+anchor,'local range presence')
    ecology=replace_once(ecology,"export function advanceEcology(w){ensureEcology(w);ageTraces(w);for(const a of w.ecologySystem.wildlife){if(!a.active)continue;updateNeeds(a);","export function advanceEcology(w){ensureEcology(w);ageTraces(w);for(const a of w.ecologySystem.wildlife){if(!a.active)continue;if(!updateLocalPresence(w,a))continue;updateNeeds(a);",'presence-aware ecology advance')
    ecology=replace_once(ecology,"return w.ecologySystem.wildlife.filter(x=>x.active&&dist(c,x.position)<=detectionRadius(w,x,radius))","return w.ecologySystem.wildlife.filter(x=>x.active&&x.localPresence!==false&&dist(c,x.position)<=detectionRadius(w,x,radius))",'presence-aware perception')
    ecology_path.write_text(ecology)
else:
    print('v1.4.6 range-presence ecology already applied.')

renderer=renderer_path.read_text()
if "range-presence-v1" not in renderer:
    old_entities="renderEntities(initial=false){for(const a of canonical.agents||[])this.upsertAgent(a,initial);for(const a of canonical.ecologySystem?.wildlife||[])if(a.active)this.upsertWildlife(a,initial)}"
    new_entities="renderEntities(initial=false){for(const a of canonical.agents||[])this.upsertAgent(a,initial);const present=new Set();for(const a of canonical.ecologySystem?.wildlife||[])if(a.active&&a.localPresence!==false){present.add(a.id);this.upsertWildlife(a,initial)}for(const [id,e] of [...this.entities])if(e.getData?.('kind')==='wildlife'&&!present.has(id)){this.tweens.killTweensOf(e);e.destroy();this.entities.delete(id)}}"
    renderer=replace_once(renderer,old_entities,new_entities,'presence-aware entity rendering')
    renderer=replace_once(renderer,"const wildlife=(canonical.ecologySystem?.wildlife||[]).filter(x=>x.active),ambient=canonical.ecologySystem?.ambient||{},events=canonical.ecologySystem?.events||[];","const wildlife=(canonical.ecologySystem?.wildlife||[]).filter(x=>x.active&&x.localPresence!==false),ambient=canonical.ecologySystem?.ambient||{},events=canonical.ecologySystem?.events||[];",'presence-aware HUD count')
    renderer=replace_once(renderer,"$('#phLifeCount').textContent=`${wildlife.length} animals`;","$('#phLifeCount').textContent=`${wildlife.length} animals in basin`;",'basin life label')
    old_snap="coverEcology:'cover-ecology-v1',pulseMode:this.pulseMode||null,concealedWildlife:"
    new_snap="coverEcology:'cover-ecology-v1',rangePresence:'range-presence-v1',rangePresenceCounts:{present:(canonical?.ecologySystem?.wildlife||[]).filter(x=>x.active&&x.localPresence!==false).length,outside:(canonical?.ecologySystem?.wildlife||[]).filter(x=>x.active&&x.localPresence===false).length},pulseMode:this.pulseMode||null,concealedWildlife:"
    renderer=replace_once(renderer,old_snap,new_snap,'range presence snapshot')
    renderer_path.write_text(renderer)
else:
    print('v1.4.6 presence renderer already applied.')

qa=qa_path.read_text()
if "bearAbsentHours" not in qa:
    old_stats="const stats={rabbitMaxHome:0,bearMinHuman:Infinity,rabbitWaterSeeking:0,tracksMax:0,dayRabbitHidden:0,twilightRabbitActive:0,twilightSamples:0,persistence:0,closeHumanHours:0,bearCloseHumanHours:0,humanWildlifeEvents:0,bearEncounterEvents:0,lastBehavior:new Map()};"
    new_stats="const stats={rabbitMaxHome:0,bearMinHuman:Infinity,rabbitWaterSeeking:0,tracksMax:0,dayRabbitHidden:0,twilightRabbitActive:0,twilightSamples:0,persistence:0,closeHumanHours:0,bearCloseHumanHours:0,humanWildlifeEvents:0,bearEncounterEvents:0,rabbitAbsentHours:0,deerPresentHours:0,deerAbsentHours:0,bearPresentHours:0,bearAbsentHours:0,lastBehavior:new Map()};"
    qa=replace_once(qa,old_stats,new_stats,'range presence QA stats')
    old_loop="    if(!Number.isFinite(a.position?.x)||!Number.isFinite(a.position?.y)||a.position.x<0||a.position.x>100||a.position.y<0||a.position.y>100)throw new Error(`invalid wildlife position ${a.id}: ${JSON.stringify(a.position)}`);\n    const humanD=Math.min(...w.agents.map(p=>dist(a.position,p.coordinates)));"
    new_loop="""    if(!Number.isFinite(a.position?.x)||!Number.isFinite(a.position?.y)||a.position.x<0||a.position.x>100||a.position.y<0||a.position.y>100)throw new Error(`invalid wildlife position ${a.id}: ${JSON.stringify(a.position)}`);
    if(a.species==='rabbit'&&a.localPresence===false)stats.rabbitAbsentHours++;
    if(a.species==='deer'){if(a.localPresence===false)stats.deerAbsentHours++;else stats.deerPresentHours++}
    if(a.species==='bear'){if(a.localPresence===false)stats.bearAbsentHours++;else stats.bearPresentHours++}
    const prev=stats.lastBehavior.get(a.id);if(prev===a.behavior)stats.persistence++;stats.lastBehavior.set(a.id,a.behavior);
    if(a.localPresence===false)continue;
    const humanD=Math.min(...w.agents.map(p=>dist(a.position,p.coordinates)));"""
    qa=replace_once(qa,old_loop,new_loop,'presence QA loop')
    qa=replace_once(qa,"    const prev=stats.lastBehavior.get(a.id);if(prev===a.behavior)stats.persistence++;stats.lastBehavior.set(a.id,a.behavior);\n","",'remove duplicate persistence accounting')
    tail="if(stats.bearEncounterEvents>1)failures.push(`bear encounter events are too frequent: ${stats.bearEncounterEvents} in 120 hours`);"
    range_assertions=tail+"\nif(stats.rabbitAbsentHours!==0)failures.push(`resident cottontails left the basin unexpectedly: ${stats.rabbitAbsentHours} rabbit-hours`);\nif(stats.deerAbsentHours<20||stats.deerPresentHours<20)failures.push(`deer range use lacks natural presence/absence variation: present=${stats.deerPresentHours}, absent=${stats.deerAbsentHours}`);\nif(stats.bearAbsentHours<60||stats.bearPresentHours<2)failures.push(`black bear should be an occasional basin visitor: present=${stats.bearPresentHours}, absent=${stats.bearAbsentHours}`);"
    qa=replace_once(qa,tail,range_assertions,'range presence assertions')
    qa_path.write_text(qa)
else:
    print('v1.4.6 range-presence QA already applied.')

browser=browser_qa_path.read_text()
if "expectedPresentWildlife" not in browser:
    browser=replace_once(browser,"if(s.wildlife<8)failures.push(`expected >=8 wildlife, got ${s.wildlife}`);","const expectedPresentWildlife=(state.ecologySystem?.wildlife||[]).filter(x=>x.active&&x.localPresence!==false).length;if(s.wildlife!==expectedPresentWildlife)failures.push(`renderer wildlife count drift: ${s.wildlife} != canonical ${expectedPresentWildlife}`);",'canonical presence count QA')
    anchor="if(!Number.isFinite(s.concealedWildlife))failures.push(`wildlife concealment state missing: ${s.concealedWildlife}`);"
    replacement=anchor+"if(!s.rangePresenceCounts||s.rangePresenceCounts.present!==expectedPresentWildlife)failures.push(`range presence projection missing or stale: ${JSON.stringify(s.rangePresenceCounts)}`);"
    browser=replace_once(browser,anchor,replacement,'range presence browser QA')
    browser=replace_once(browser,"const habitatDeer=state.ecologySystem?.wildlife?.find(x=>x.active&&x.species==='deer');","const habitatDeer=state.ecologySystem?.wildlife?.find(x=>x.active&&x.localPresence!==false&&x.species==='deer');",'truthful habitat deer screenshot')
    browser_qa_path.write_text(browser)

html=html_path.read_text().replace('phaser-world.css?v=00145','phaser-world.css?v=00146').replace('phaser-world-v1.js?v=00145','phaser-world-v1.js?v=00146')
html_path.write_text(html)
print('Applied v1.4.6 natural local-range presence for deer and black bear.')
