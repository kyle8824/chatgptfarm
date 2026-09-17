from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one patch anchor, found {count}")
    return text.replace(old, new, 1)


ecology_path = Path('engine/ecology.js')
renderer_path = Path('phaser-world-v1.js')
qa_path = Path('scripts/ecology-realism-qa.mjs')
browser_qa_path = Path('scripts/phaser-qa.mjs')
html_path = Path('phaser.html')

ecology = ecology_path.read_text()
if "living-basin-1.1.0" not in ecology:
    ecology = replace_once(
        ecology,
        "export const ECOLOGY_VERSION='living-basin-1.0.0';",
        "export const ECOLOGY_VERSION='living-basin-1.1.0';",
        'ecology version',
    )
    old_helpers = "function fleeFrom(a,threat,amount){const dx=a.position.x-threat.x,dy=a.position.y-threat.y,m=Math.hypot(dx,dy)||1;return bound({x:a.position.x+dx/m*amount,y:a.position.y+dy/m*amount})}\nfunction jitter"
    new_helpers = """function fleeFrom(a,threat,amount){const dx=a.position.x-threat.x,dy=a.position.y-threat.y,m=Math.hypot(dx,dy)||1;return bound({x:a.position.x+dx/m*amount,y:a.position.y+dy/m*amount})}
function escapeCover(w,a,threat,amount){
 const currentThreat=dist(a.position,threat),home=a.home||a.position,raw=habitat[a.species]||[];
 let choices=raw;
 if(a.species==='rabbit')choices=[...raw].sort((x,y)=>dist(x,home)-dist(y,home)).slice(0,3);
 else if(a.species==='deer')choices=[...raw].sort((x,y)=>dist(x,a.position)-dist(y,a.position)).slice(0,5);
 let best=null,bestScore=-Infinity;
 for(const q of choices){
  const threatD=dist(q,threat);if(threatD<currentThreat+1.5)continue;
  const travel=dist(a.position,q),homeCost=a.species==='rabbit'?dist(q,home)*.55:a.species==='deer'?dist(q,home)*.12:0;
  const score=threatD*1.2-travel*.7-homeCost;
  if(score>bestScore){best=q;bestScore=score}
 }
 if(!best)return fleeFrom(a,threat,amount);
 const scale=a.species==='rabbit'?.75:a.species==='deer'?1.8:3.4,covered=jitter(w,a,best,scale,'escape-cover');
 return dist(covered,threat)>currentThreat+.75?covered:fleeFrom(a,threat,amount);
}
function jitter"""
    ecology = replace_once(ecology, old_helpers, new_helpers, 'cover escape helper')
    old_panic = "if(near&&near.distance<s.panicRadius){a.fear=100;const goal=fleeFrom(a,near.position,a.species==='rabbit'?11:a.species==='bear'?13:10);hold(w,a,{activity:'flee',behavior:a.species==='bear'?'withdrawing':'startled',goal,hours:a.species==='rabbit'?1:2});"
    new_panic = "if(near&&near.distance<s.panicRadius){a.fear=100;const goal=escapeCover(w,a,near.position,a.species==='rabbit'?11:a.species==='bear'?13:10);hold(w,a,{activity:'flee',behavior:a.species==='bear'?'withdrawing to cover':'bolting to cover',goal,hours:a.species==='rabbit'?1:2});"
    ecology = replace_once(ecology, old_panic, new_panic, 'panic cover response')
    old_fear = "const goal=fleeFrom(a,near.position,a.species==='bear'?9:a.species==='deer'?5:6);return hold(w,a,{activity:'move',behavior:a.species==='bear'?'avoiding people':'wary',goal,hours:2})}"
    new_fear = "const goal=escapeCover(w,a,near.position,a.species==='bear'?9:a.species==='deer'?5:6);return hold(w,a,{activity:'move',behavior:a.species==='bear'?'avoiding people via cover':a.species==='rabbit'?'moving to cover':'wary, moving to cover',goal,hours:2})}"
    ecology = replace_once(ecology, old_fear, new_fear, 'fear cover response')
    ecology_path.write_text(ecology)
else:
    print('v1.4.5 ecology pass already applied.')

renderer = renderer_path.read_text()
if "cover-ecology-v1" not in renderer:
    old_visibility = "e.setAlpha(['hide','freeze'].includes(a.activity)?.72:.96);e.setData('behavior',a.behavior||null);"
    new_visibility = "let visibility=.96;if(a.species==='rabbit'&&a.activity==='hide')visibility=.34;else if(a.activity==='freeze')visibility=.52;else if(a.species==='deer'&&a.activity==='rest')visibility=.84;else if(a.species==='bear'&&a.activity==='rest')visibility=.86;e.setAlpha(visibility);e.setData('visibility',visibility);e.setData('behavior',a.behavior||null);"
    renderer = replace_once(renderer, old_visibility, new_visibility, 'wildlife concealment')
    old_snap = "quietWorld:'quiet-world-v1',pulseMode:this.pulseMode||null,habitatDetail:"
    new_snap = "quietWorld:'quiet-world-v1',coverEcology:'cover-ecology-v1',pulseMode:this.pulseMode||null,concealedWildlife:[...this.entities.values()].filter(x=>x.getData?.('kind')==='wildlife'&&(x.getData?.('visibility')??1)<.7).length,habitatDetail:"
    renderer = replace_once(renderer, old_snap, new_snap, 'cover ecology debug snapshot')
    renderer_path.write_text(renderer)
else:
    print('v1.4.5 renderer concealment already applied.')

qa = qa_path.read_text()
if "panicProbes" not in qa:
    anchor = "const failures=[];"
    probes = """const panicProbe=(species)=>{
  const pw={day:2,hour:7,weather:'clear',temperature:61,settings:{ai:{people:{},wildlife:{enabled:false,individuals:{}},usage:{track:true}}},agents:[{id:'agent-mara',name:'Mara',coordinates:{x:1,y:1}},{id:'agent-ivo',name:'Ivo',coordinates:{x:2,y:2}}],ecologySystem:null};
  ensureEcology(pw);const a=pw.ecologySystem.wildlife.find(x=>x.species===species);const human={x:a.position.x+1,y:a.position.y};pw.agents[0].coordinates=human;pw.agents[1].coordinates={x:2,y:96};const before=dist(a.position,human);advanceEcology(pw);return{species,before,after:dist(a.position,human),goalDistance:dist(a.target,human),activity:a.activity,behavior:a.behavior};
};
const panicProbes=['rabbit','deer','bear'].map(panicProbe);
const failures=[];"""
    qa = replace_once(qa, anchor, probes, 'panic probe setup')
    tail = "if(stats.bearEncounterEvents>1)failures.push(`bear encounter events are too frequent: ${stats.bearEncounterEvents} in 120 hours`);\nif(failures.length)"
    replacement = """if(stats.bearEncounterEvents>1)failures.push(`bear encounter events are too frequent: ${stats.bearEncounterEvents} in 120 hours`);
for(const p of panicProbes){if(p.activity!=='flee')failures.push(`${p.species} did not flee at panic distance: ${JSON.stringify(p)}`);if(p.after<=p.before+.15)failures.push(`${p.species} failed to increase human distance while fleeing: ${JSON.stringify(p)}`);if(p.goalDistance<=p.before+.75)failures.push(`${p.species} escape goal did not create separation: ${JSON.stringify(p)}`);if(!String(p.behavior).includes('cover'))failures.push(`${p.species} panic behavior did not seek cover: ${JSON.stringify(p)}`)}
if(failures.length)"""
    qa = replace_once(qa, tail, replacement, 'panic cover assertions')
    qa_path.write_text(qa)
else:
    print('v1.4.5 ecology QA already applied.')

browser_qa = browser_qa_path.read_text()
if "concealedWildlife" not in browser_qa:
    anchor = "if(s.movingEntities<1)failures.push('no entity has visible interpolated movement');"
    replacement = anchor + "if(!Number.isFinite(s.concealedWildlife))failures.push(`wildlife concealment state missing: ${s.concealedWildlife}`);"
    browser_qa = replace_once(browser_qa, anchor, replacement, 'concealment browser QA')
    browser_qa_path.write_text(browser_qa)

html = html_path.read_text().replace('phaser-world.css?v=00144','phaser-world.css?v=00145').replace('phaser-world-v1.js?v=00144','phaser-world-v1.js?v=00145')
html_path.write_text(html)
print('Applied v1.4.5 cover-seeking wildlife, concealment, and panic-response QA.')
