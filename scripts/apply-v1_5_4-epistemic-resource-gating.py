from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one anchor, found {count}')
    return text.replace(old, new, 1)


decision_path=Path('engine/decision.js')
runtime_path=Path('engine/runtime.js')
qa_path=Path('scripts/living-history-qa.mjs')

decision=decision_path.read_text()
if 'function resourceBeliefAllows' not in decision:
    anchor="export function localResourceState(w,a){const r=w.resources||{},here=a.position,out=[],add=(key,label,quantity,capacity,zones)=>{if(!zones.includes(here))return;const q=Math.max(0,Number(quantity)||0),ratio=capacity?Math.max(0,Math.min(1,q/capacity)):0,band=q<=0?'depleted':ratio<=.25?'scarce':ratio<=.6?'available':'abundant';out.push({key,label,quantity:q,capacity,band})};add('berries','berry patch',r.berries,20,['berries','meadow']);add('stones','loose stone field',r.stones,24,['stones','meadow']);if(knowsClay(a))add('clay','clay bank',r.clay,10,['clay','creek']);if(knowsReeds(a))add('reeds','reed marsh',r.reeds,18,['reeds','edge']);add('dryWood','dry branches',r.dryWood,12,['log','forest']);add('wetWood','damp branches',r.wetWood,14,['log','forest']);return out}\n"
    helper=anchor+"const RESOURCE_ZONES={berries:['berries','meadow'],stones:['stones','meadow'],clay:['clay','creek'],reeds:['reeds','edge'],dryWood:['log','forest'],wetWood:['log','forest']};\nfunction observationAgeHours(w,o){if(!o||o.day==null||o.hour==null)return Infinity;return Math.max(0,(w.day-o.day)*24+(w.hour-o.hour))}\nfunction resourceBeliefAllows(w,a,key,actual,{renewable=false}={}){const zones=RESOURCE_ZONES[key]||[];if(zones.includes(a.position))return(Number(actual)||0)>0;const seen=a.resourceObservations?.[key];if(!seen)return true;if(seen.band!=='depleted')return true;return renewable&&observationAgeHours(w,seen)>=18}\n"
    decision=replace_once(decision,anchor,helper,'resource belief helper')
    old="export function candidateActions(w,a,{excludedMemoryId=null}={}){const n=a.needs,r=w.resources,i=a.inventory,s=w.structures,b=otherAgent(w,a),rel=b?relationship(w,a,b):null,c=[],nov=novelty(a),mb=t=>memoryBoost(a,t,excludedMemoryId),push=x=>{x.score=+(x.score-penalty(a,x.id)).toFixed(3);c.push(x)};if(r.creekWater)push({id:'drink',label:'Drink from the creek',score:(100-n.hydration)*1.45+mb('water')*.8,reasons:[['thirst',100-n.hydration]]});if(r.berries>0||i.berries>0)push({id:'eat_berries',label:'Eat wild berries',score:(100-n.hunger)*1.2+mb('berries')*.65,reasons:[['hunger',100-n.hunger]]});if(i.cookedMeat>0)push({id:'eat_cooked_meat',label:'Eat cooked meat',score:(100-n.hunger)*1.5+16,reasons:[['dense food',16]]});if(i.tubers>0&&knows(a,'tuber-edible'))push({id:'eat_tuber',label:'Eat a tested edible tuber',score:(100-n.hunger)*1.15+8,reasons:[['known root food',8]]});if(r.berries>0&&i.berries<5)push({id:'gather_berries',label:'Gather berries',score:16+(100-n.hunger)*.22,reasons:[['future hunger',(100-n.hunger)*.22]]});if(r.dryWood>0)push({id:'gather_dry_wood',label:knows(a,'sharp-edge')?'Cut dry branches with sharp stone':'Gather dry branches',score:13+(100-n.warmth)*.26+(!s.shelter?6:0),reasons:[['cold',(100-n.warmth)*.26]]});if(r.wetWood>0)push({id:'gather_wet_wood',label:'Gather damp branches',score:8+(100-n.warmth)*.14-mb('wet-wood-bad'),reasons:[['cold',(100-n.warmth)*.14]]});if(r.stones>0&&i.stones<4)push({id:'gather_stones',label:'Gather loose stones',score:7+a.traits.curiosity*8+nov*.3,reasons:[['curiosity',a.traits.curiosity*8]]});if(knowsClay(a)&&r.clay>0&&i.clay<3)push({id:'gather_clay',label:'Gather sticky clay',score:8+a.traits.curiosity*8+nov*.3,reasons:[['curiosity',a.traits.curiosity*8]]});if(knowsReeds(a)&&r.reeds>0&&i.reeds<5)push({id:'gather_reeds',label:'Gather flexible reeds',score:8+a.traits.curiosity*8+nov*.3,reasons:[['curiosity',a.traits.curiosity*8]]});"
    new="export function candidateActions(w,a,{excludedMemoryId=null}={}){const n=a.needs,r=w.resources,i=a.inventory,s=w.structures,b=otherAgent(w,a),rel=b?relationship(w,a,b):null,c=[],nov=novelty(a),mb=t=>memoryBoost(a,t,excludedMemoryId),push=x=>{x.score=+(x.score-penalty(a,x.id)).toFixed(3);c.push(x)},can=(key,q,renewable=false)=>resourceBeliefAllows(w,a,key,q,{renewable});if(r.creekWater)push({id:'drink',label:'Drink from the creek',score:(100-n.hydration)*1.45+mb('water')*.8,reasons:[['thirst',100-n.hydration]]});if(i.berries>0||(RESOURCE_ZONES.berries.includes(a.position)&&r.berries>0))push({id:'eat_berries',label:'Eat wild berries',score:(100-n.hunger)*1.2+mb('berries')*.65,reasons:[['hunger',100-n.hunger]]});if(i.cookedMeat>0)push({id:'eat_cooked_meat',label:'Eat cooked meat',score:(100-n.hunger)*1.5+16,reasons:[['dense food',16]]});if(i.tubers>0&&knows(a,'tuber-edible'))push({id:'eat_tuber',label:'Eat a tested edible tuber',score:(100-n.hunger)*1.15+8,reasons:[['known root food',8]]});if(can('berries',r.berries,true)&&i.berries<5)push({id:'gather_berries',label:'Gather berries',score:16+(100-n.hunger)*.22,reasons:[['future hunger',(100-n.hunger)*.22]]});if(can('dryWood',r.dryWood,true))push({id:'gather_dry_wood',label:knows(a,'sharp-edge')?'Cut dry branches with sharp stone':'Gather dry branches',score:13+(100-n.warmth)*.26+(!s.shelter?6:0),reasons:[['cold',(100-n.warmth)*.26]]});if(can('wetWood',r.wetWood,true))push({id:'gather_wet_wood',label:'Gather damp branches',score:8+(100-n.warmth)*.14-mb('wet-wood-bad'),reasons:[['cold',(100-n.warmth)*.14]]});if(can('stones',r.stones)&&i.stones<4)push({id:'gather_stones',label:'Gather loose stones',score:7+a.traits.curiosity*8+nov*.3,reasons:[['curiosity',a.traits.curiosity*8]]});if(knowsClay(a)&&can('clay',r.clay)&&i.clay<3)push({id:'gather_clay',label:'Gather sticky clay',score:8+a.traits.curiosity*8+nov*.3,reasons:[['curiosity',a.traits.curiosity*8]]});if(knowsReeds(a)&&can('reeds',r.reeds,true)&&i.reeds<5)push({id:'gather_reeds',label:'Gather flexible reeds',score:8+a.traits.curiosity*8+nov*.3,reasons:[['curiosity',a.traits.curiosity*8]]});"
    decision=replace_once(decision,old,new,'epistemic resource candidate gating')
    decision_path.write_text(decision)
else:
    print('epistemic resource gating already present')

runtime=runtime_path.read_text()
if 'finds the berry patch picked clean' not in runtime:
    replacements={
      "case'eat_berries':if(i.berries>0)i.berries--;else if(r.berries>0)r.berries--;n.hunger=clamp(n.hunger+28);a.position='berries';d=`${a.name} eats tart red berries.`;break;": "case'eat_berries':if(i.berries>0){i.berries--;n.hunger=clamp(n.hunger+28);d=`${a.name} eats carried wild berries.`}else if(r.berries>0){r.berries--;n.hunger=clamp(n.hunger+28);a.position='berries';d=`${a.name} eats tart red berries at the patch.`}else{a.position='berries';d=`${a.name} reaches the berry patch but could not eat any; the patch is picked clean.`}break;",
      "case'gather_berries':if(r.berries>0){const q=Math.min(2,r.berries);r.berries-=q;i.berries+=q;spendEnergy(a,4);a.position='berries';d=`${a.name} gathers ${q} berry portion${q===1?'':'s'}.`}break;": "case'gather_berries':a.position='berries';if(r.berries>0){const q=Math.min(2,r.berries);r.berries-=q;i.berries+=q;spendEnergy(a,4);d=`${a.name} gathers ${q} berry portion${q===1?'':'s'}.`}else d=`${a.name} reaches the berry patch but could not gather any; it is picked clean.`;break;",
      "case'gather_dry_wood':if(r.dryWood>0){const q=Math.min(knows(a,'sharp-edge')?3:2,r.dryWood);r.dryWood-=q;i.dryWood+=q;spendEnergy(a,knows(a,'sharp-edge')?4:6);a.position='log';d=`${a.name} gathers ${q} dry branches.`}break;": "case'gather_dry_wood':a.position='log';if(r.dryWood>0){const q=Math.min(knows(a,'sharp-edge')?3:2,r.dryWood);r.dryWood-=q;i.dryWood+=q;spendEnergy(a,knows(a,'sharp-edge')?4:6);d=`${a.name} gathers ${q} dry branches.`}else d=`${a.name} reaches the fallen tree but could not gather dry branches; none are usable now.`;break;",
      "case'gather_wet_wood':if(r.wetWood>0){const q=Math.min(2,r.wetWood);r.wetWood-=q;i.wetWood+=q;spendEnergy(a,7);a.position='log';d=`${a.name} gathers damp branches.`}break;": "case'gather_wet_wood':a.position='log';if(r.wetWood>0){const q=Math.min(2,r.wetWood);r.wetWood-=q;i.wetWood+=q;spendEnergy(a,7);d=`${a.name} gathers damp branches.`}else d=`${a.name} reaches the fallen tree but could not gather damp branches; none remain.`;break;",
      "case'gather_stones':if(r.stones>0){const q=Math.min(2,r.stones);r.stones-=q;i.stones+=q;spendEnergy(a,4);a.position='stones';d=`${a.name} gathers loose stones.`;remember(w,a,'Some stones fracture differently from others when struck.',{importance:4,tags:['stone','experiment'],confidence:.62})}break;": "case'gather_stones':a.position='stones';if(r.stones>0){const q=Math.min(2,r.stones);r.stones-=q;i.stones+=q;spendEnergy(a,4);d=`${a.name} gathers loose stones.`;remember(w,a,'Some stones fracture differently from others when struck.',{importance:4,tags:['stone','experiment'],confidence:.62})}else d=`${a.name} reaches the stone field but could not gather any loose stones; the obvious pieces are gone.`;break;",
      "case'gather_clay':if(r.clay>0&&knowsClay(a)){const q=Math.min(2,r.clay);r.clay-=q;i.clay+=q;spendEnergy(a,4);a.position='clay';d=`${a.name} gathers sticky clay.`}break;": "case'gather_clay':if(knowsClay(a)){a.position='clay';if(r.clay>0){const q=Math.min(2,r.clay);r.clay-=q;i.clay+=q;spendEnergy(a,4);d=`${a.name} gathers sticky clay.`}else d=`${a.name} reaches the clay bank but could not gather usable clay; the exposed deposit is exhausted.`}break;",
      "case'gather_reeds':if(r.reeds>0&&knowsReeds(a)){const q=Math.min(3,r.reeds);r.reeds-=q;i.reeds+=q;spendEnergy(a,4);a.position='reeds';d=`${a.name} gathers flexible reeds.`}break;": "case'gather_reeds':if(knowsReeds(a)){a.position='reeds';if(r.reeds>0){const q=Math.min(3,r.reeds);r.reeds-=q;i.reeds+=q;spendEnergy(a,4);d=`${a.name} gathers flexible reeds.`}else d=`${a.name} reaches the reed marsh but could not gather usable stalks; the nearby stand is cut down.`}break;"
    }
    for old,new in replacements.items():
        runtime=replace_once(runtime,old,new,'runtime epistemic resource arrival')
    runtime_path.write_text(runtime)
else:
    print('runtime epistemic resource arrivals already present')

qa=qa_path.read_text()
if 'EPISTEMIC-RESOURCE-QA' not in qa:
    qa=replace_once(qa,"import { createWorld, tickWithMind } from '../engine.js';","import { createWorld, tickWithMind } from '../engine.js';\nimport { candidateActions } from '../engine/decision.js';",'candidateActions QA import')
    marker="if(!recoveryMemory)failures.push('resource recovery did not create a later private recovery memory');\n"
    block=marker+r'''

const hiddenFull=createWorld(),hiddenEmpty=createWorld(),ivoFull=hiddenFull.agents.find(a=>a.id==='agent-ivo'),ivoEmpty=hiddenEmpty.agents.find(a=>a.id==='agent-ivo');
hiddenEmpty.resources.berries=0;
const fullRemoteIds=candidateActions(hiddenFull,ivoFull).map(x=>x.id).sort(),emptyRemoteIds=candidateActions(hiddenEmpty,ivoEmpty).map(x=>x.id).sort();
if(JSON.stringify(fullRemoteIds)!==JSON.stringify(emptyRemoteIds))failures.push(`remote hidden berry quantity leaked through candidate actions: ${JSON.stringify(fullRemoteIds)} vs ${JSON.stringify(emptyRemoteIds)}`);
if(!emptyRemoteIds.includes('gather_berries'))failures.push('Ivo lost the gather_berries possibility before observing remote depletion');
const arrivalWorld=createWorld(),arrivalIvo=arrivalWorld.agents.find(a=>a.id==='agent-ivo');arrivalWorld.resources.berries=0;const arrivalContexts=[];
const arrivalMind={async decide(context){arrivalContexts.push(structuredClone(context));const action=context.agent.id==='agent-ivo'&&context.candidates.some(c=>c.id==='gather_berries')?context.candidates.find(c=>c.id==='gather_berries'):context.candidates[0];return{choiceType:'known_action',actionId:action.id,physicalAction:null,goal:'Test only what the agent currently believes is possible.',intent:action.label,decisionSummary:'EPISTEMIC-RESOURCE-QA chooses a bounded known action without hidden resource knowledge.',confidence:.72,referencedMemoryIds:[],brainMode:'ai',model:'EPISTEMIC-RESOURCE-QA'}}};
let arrivalDNA=await tickWithMind(arrivalWorld,arrivalMind),ivoArrivalDNA=arrivalDNA.find(d=>d.agent_id==='agent-ivo');
if(ivoArrivalDNA?.action!=='gather_berries')failures.push(`remote Ivo did not retain gather_berries before checking the patch: ${ivoArrivalDNA?.action}`);
if(ivoArrivalDNA?.physics?.outcome?.success!==false)failures.push('empty remote berry patch did not resolve as a failed physical outcome after arrival');
if(arrivalIvo.position!=='berries')failures.push(`Ivo did not physically arrive at the depleted berry patch: ${arrivalIvo.position}`);
arrivalContexts.length=0;await tickWithMind(arrivalWorld,arrivalMind);const postArrivalContext=arrivalContexts.find(c=>c.agent.id==='agent-ivo'),arrivalMemory=arrivalIvo.memories.find(m=>(m.tags||[]).includes('resource-observation')&&(m.tags||[]).includes('berries')&&(m.tags||[]).includes('depleted'));
if(!arrivalMemory)failures.push('Ivo did not privately learn depletion after physically checking the berry patch');
if(postArrivalContext?.candidates?.some(c=>c.id==='gather_berries'))failures.push('gather_berries remained available after Ivo locally learned the patch was depleted');
'''
    qa=replace_once(qa,marker,block,'epistemic resource leakage QA')
    qa_path.write_text(qa)
else:
    print('epistemic resource QA already present')

print('Applied v1.5.4 epistemic resource action gating.')
