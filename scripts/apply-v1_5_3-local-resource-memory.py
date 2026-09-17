from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one anchor, found {count}')
    return text.replace(old, new, 1)


decision_path = Path('engine/decision.js')
runtime_path = Path('engine/runtime.js')
qa_path = Path('scripts/living-history-qa.mjs')

decision = decision_path.read_text()
if 'export function localResourceState' not in decision:
    anchor = "function novelty(a){const n=a.needs;if(!(n.hydration>55&&n.hunger>55&&n.energy>50&&n.warmth>45))return 0;return Math.max(0,7+a.traits.curiosity*10-new Set((a.mind?.recentActions||[]).slice(-4).map(family)).size*1.5)}\n"
    helper = anchor + "export function localResourceState(w,a){const r=w.resources||{},here=a.position,out=[],add=(key,label,quantity,capacity,zones)=>{if(!zones.includes(here))return;const q=Math.max(0,Number(quantity)||0),ratio=capacity?Math.max(0,Math.min(1,q/capacity)):0,band=q<=0?'depleted':ratio<=.25?'scarce':ratio<=.6?'available':'abundant';out.push({key,label,quantity:q,capacity,band})};add('berries','berry patch',r.berries,20,['berries','meadow']);add('stones','loose stone field',r.stones,24,['stones','meadow']);if(knowsClay(a))add('clay','clay bank',r.clay,10,['clay','creek']);if(knowsReeds(a))add('reeds','reed marsh',r.reeds,18,['reeds','edge']);add('dryWood','dry branches',r.dryWood,12,['log','forest']);add('wetWood','damp branches',r.wetWood,14,['log','forest']);return out}\n"
    decision = replace_once(decision, anchor, helper, 'local resource helper')
    old = "knownPeople:b?[{name:b.name,trust:rel?.trust??0,familiarity:rel?.familiarity??0,affinity:rel?.affinity??50,nearby:b.position===a.position}]:[],wildlife:visibleWildlifeForAgent(w,a),wildlifeTracks:visibleWildlifeTracesForAgent(w,a),wildlifeSigns:visibleWildlifeSignsForAgent(w,a)}"
    new = "knownPeople:b?[{name:b.name,trust:rel?.trust??0,familiarity:rel?.familiarity??0,affinity:rel?.affinity??50,nearby:b.position===a.position}]:[],localResources:localResourceState(w,a),wildlife:visibleWildlifeForAgent(w,a),wildlifeTracks:visibleWildlifeTracesForAgent(w,a),wildlifeSigns:visibleWildlifeSignsForAgent(w,a)}"
    decision = replace_once(decision, old, new, 'local resources in bounded perception')
    decision_path.write_text(decision)
else:
    print('local resource state already present')

runtime = runtime_path.read_text()
if 'function recordResourceObservations' not in runtime:
    runtime = replace_once(runtime, "import{candidateActions,retrieveDecisionContext}from'./decision.js';", "import{candidateActions,retrieveDecisionContext,localResourceState}from'./decision.js';", 'runtime local-resource import')
    anchor = "function recordWildlifeSigns(w,a){a.wildlifeSignsSeen||={};for(const s of visibleWildlifeSignsForAgent(w,a)){if(a.wildlifeSignsSeen[s.id])continue;a.wildlifeSignsSeen[s.id]={day:w.day,hour:w.hour,signId:s.id,sourceId:s.sourceId};const age=s.ageHours<=3?'fresh':'older';remember(w,a,`I found ${age} ${s.label}; ${s.species} activity left this sign here.`,{importance:s.species==='bear'?8:5,tags:['animal','wildlife-sign',s.species,s.kind],source:`wildlife-sign:${s.id}`,confidence:Math.max(.5,s.clarity||.55)})}}\n"
    helper = anchor + "function recordResourceObservations(w,a){a.resourceObservations||={};for(const x of localResourceState(w,a)){const prev=a.resourceObservations[x.key]||null,changed=!prev||prev.band!==x.band,recovered=!!prev&&['depleted','scarce'].includes(prev.band)&&['available','abundant'].includes(x.band);if(changed&&(['depleted','scarce'].includes(x.band)||recovered)){const text=recovered?`The ${x.label} here has recovered since I last found it ${prev.band}.`:`The ${x.label} here is ${x.band}; ${x.quantity} usable unit${x.quantity===1?' remains':'s remain'}.`;remember(w,a,text,{importance:x.band==='depleted'?7:6,tags:['resource-observation','resource',x.key,recovered?'recovery':x.band],source:`resource-observation:${x.key}:${w.day}-${w.hour}`,confidence:.92})}a.resourceObservations[x.key]={band:x.band,quantity:x.quantity,day:w.day,hour:w.hour}}}\n"
    runtime = replace_once(runtime, anchor, helper, 'resource observation memory helper')
    old = "for(const live of w.agents){recordWildlifeSightings(w,live);recordWildlifeSigns(w,live);const a=snap.agents.find(x=>x.id===live.id);a.memories=clone(live.memories);a.wildlifeSeen=clone(live.wildlifeSeen||{});a.wildlifeTracksSeen=clone(live.wildlifeTracksSeen||{});a.wildlifeSignsSeen=clone(live.wildlifeSignsSeen||{});"
    new = "for(const live of w.agents){recordWildlifeSightings(w,live);recordWildlifeSigns(w,live);recordResourceObservations(w,live);const a=snap.agents.find(x=>x.id===live.id);a.memories=clone(live.memories);a.wildlifeSeen=clone(live.wildlifeSeen||{});a.wildlifeTracksSeen=clone(live.wildlifeTracksSeen||{});a.wildlifeSignsSeen=clone(live.wildlifeSignsSeen||{});a.resourceObservations=clone(live.resourceObservations||{});"
    runtime = replace_once(runtime, old, new, 'resource observations before AI decision')
    old_tick = "export function tick(input){const w=migrateWorld(input);updateSpectatorState(w);updateWeather(w);const snap=clone(w),intents=[];for(const live of w.agents){const a=snap.agents.find(x=>x.id===live.id),c=retrieveDecisionContext(snap,a),m=fallback(a,c);"
    new_tick = "export function tick(input){const w=migrateWorld(input);updateSpectatorState(w);updateWeather(w);const snap=clone(w),intents=[];for(const live of w.agents){recordResourceObservations(w,live);const a=snap.agents.find(x=>x.id===live.id);a.memories=clone(live.memories);a.resourceObservations=clone(live.resourceObservations||{});const c=retrieveDecisionContext(snap,a),m=fallback(a,c);"
    runtime = replace_once(runtime, old_tick, new_tick, 'resource observations in fallback tick')
    runtime_path.write_text(runtime)
else:
    print('resource observation memory already present')

qa = qa_path.read_text()
if 'LOCAL-RESOURCE-QA' not in qa:
    marker = "if((routeWorld.surfaceHistory?.campWear?.uses||0)!==3)failures.push(`camp use did not accumulate canonical wear: ${routeWorld.surfaceHistory?.campWear?.uses}`);\n"
    block = marker + r'''

const scarcityWorld=createWorld(),scarcityMara=scarcityWorld.agents.find(a=>a.id==='agent-mara');
scarcityWorld.resources.berries=0;
const resourceContexts=[];
const resourceMind={async decide(context){resourceContexts.push(structuredClone(context));const action=context.candidates[0];return{choiceType:'known_action',actionId:action.id,physicalAction:null,goal:'Respond to locally observed resource conditions.',intent:action.label,decisionSummary:'QA mind uses only supplied bounded context.',confidence:.71,referencedMemoryIds:(context.memories.find(m=>(m.tags||[]).includes('resource-observation'))?[context.memories.find(m=>(m.tags||[]).includes('resource-observation')).id]:[]),brainMode:'ai',model:'LOCAL-RESOURCE-QA'}}};
let resourceDNA=await tickWithMind(scarcityWorld,resourceMind),scarcityContext=resourceContexts.find(c=>c.agent.id==='agent-mara'),scarcityDNA=resourceDNA.find(d=>d.agent_id==='agent-mara'),scarcityMemory=scarcityMara.memories.find(m=>(m.tags||[]).includes('resource-observation')&&(m.tags||[]).includes('berries'));
if(!scarcityContext?.perception?.localResources?.some(x=>x.key==='berries'&&x.band==='depleted'&&x.quantity===0))failures.push('Mara did not locally perceive the depleted berry patch');
if(resourceContexts.find(c=>c.agent.id==='agent-ivo')?.perception?.localResources?.some(x=>x.key==='berries'))failures.push('Ivo received omniscient berry depletion outside his local resource view');
if(!scarcityMemory)failures.push('depleted local resource did not become a private Mara memory');
if(!scarcityDNA?.observation?.localResources?.some(x=>x.key==='berries'&&x.band==='depleted'))failures.push('local resource depletion was absent from Decision DNA observation');
if(scarcityContext?.candidates?.some(c=>c.id==='gather_berries'))failures.push('depleted berry patch still offered a gather_berries known action');
scarcityMara.position='meadow';scarcityWorld.resources.berries=18;resourceContexts.length=0;await tickWithMind(scarcityWorld,resourceMind);const recoveryMemory=scarcityMara.memories.find(m=>(m.tags||[]).includes('resource-observation')&&(m.tags||[]).includes('berries')&&(m.tags||[]).includes('recovery'));
if(!recoveryMemory)failures.push('resource recovery did not create a later private recovery memory');
'''
    qa = replace_once(qa, marker, block, 'local resource living-history QA')
    qa_path.write_text(qa)
else:
    print('local resource QA already present')

print('Applied v1.5.3 local resource perception and memory.')
