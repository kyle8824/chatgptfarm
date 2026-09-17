from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one patch anchor, found {count}")
    return text.replace(old, new, 1)


p = Path('engine/spectator.js')
src = p.read_text()
if "LIVING_DIRECTOR_VERSION='1.4-real-evidence'" in src:
    print('Living Director v1.4 already applied.')
    raise SystemExit(0)

src = "export const LIVING_DIRECTOR_VERSION='1.4-real-evidence';\n" + src
src = replace_once(
    src,
    "const thread=(id,title,urgency,summary,kind,agentIds=[],placeIds=[])=>({id,title,urgency,summary,kind,agentIds,placeIds});",
    "const thread=(id,title,urgency,summary,kind,agentIds=[],placeIds=[],extra={})=>({id,title,urgency,summary,kind,agentIds,placeIds,...extra});\nconst nearestPlaceId=p=>Object.entries(LOCATION_COORDS).reduce((best,[id,c])=>!best||distance(p,c)<best.d?{id,d:distance(p,c)}:best,null)?.id||'meadow';\nconst ecologyAgeHours=(w,e)=>Math.max(0,(w.day-Number(e?.day||w.day))*24+(w.hour-Number(e?.hour||w.hour)));",
    'director helpers',
)
legacy = "if(w.ecology.animalTracks&&!w.ecology.gameTrail&&w.agents.some(knowsTracks))t.push(thread('tracks','Animal tracks remain unresolved',66,'At least one agent knows about the marsh tracks, but nobody has yet converted that sign into a reliable trail.','mystery',w.agents.filter(knowsTracks).map(a=>a.id),['reeds']));if(w.ecology.gameTrail&&w.ecology.smallGame===0)t.push(thread('game-trail','A game trail is known',61,'The trail is real, but no animal is currently in sight. Waiting, following or preparing may change that.','opportunity',w.agents.filter(knowsGameTrail).map(a=>a.id),['reeds']));"
real = "const realTraces=(w.ecologySystem?.traces||[]).filter(x=>x.active!==false&&x.position&&(x.clarity||0)>=.42).sort((a,b)=>(b.clarity||0)-(a.clarity||0)||(a.ageHours||0)-(b.ageHours||0));const trace=realTraces[0];if(trace){const place=nearestPlaceId(trace.position),knowers=w.agents.filter(a=>a.wildlifeTracksSeen?.[trace.species]).map(a=>a.id),species=trace.species||'animal',clarity=Math.round((trace.clarity||0)*100),urgency=Math.round(38+(trace.clarity||0)*23+(species==='bear'?24:species==='deer'?9:3)-Math.min(10,(trace.ageHours||0)*.55)),title=species==='bear'?`Fresh bear sign near ${place}`:`Fresh ${species} tracks near ${place}`;t.push(thread(`wildlife-trace-${trace.id}`,title,urgency,`These are source-linked tracks from ${trace.sourceId||'a persistent animal'}, ${clarity}% clear and about ${Math.round(trace.ageHours||0)} world-hours old.`,'wildlife-sign',knowers,[place],{evidenceId:trace.id,sourceId:trace.sourceId||null,focus:{...trace.position}}))}const eco=(w.ecologySystem?.events||[]).find(e=>(e.importance||0)>=7&&ecologyAgeHours(w,e)<=8);if(eco){const animal=(w.ecologySystem?.wildlife||[]).find(x=>x.id===eco.animalId),agent=w.agents.find(x=>x.id===eco.agentId),focus=animal?.position||agent?.coordinates||null,place=focus?nearestPlaceId(focus):null;t.push(thread(`ecology-event-${eco.id}`,eco.title,Math.min(94,54+(eco.importance||0)*4),eco.detail||'A significant ecology event occurred in the living basin.','wildlife-event',eco.agentId?[eco.agentId]:[],place?[place]:[],{ecologyEventId:eco.id,sourceId:eco.animalId||null,focus:focus?{...focus}:null}))}"
src = replace_once(src, legacy, real, 'legacy fake-track threads')
p.write_text(src)
print('Replaced legacy fake hunting threads with real ecology traces/events in the Living Director.')
