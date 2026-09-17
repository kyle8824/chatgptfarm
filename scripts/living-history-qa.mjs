import { buildPlayback } from '../engine/spectator.js';
import { createWorld, tickWithMind } from '../engine.js';
import { candidateActions } from '../engine/decision.js';

const w=createWorld();
const mara=w.agents.find(a=>a.id==='agent-mara');
const deer=w.ecologySystem.wildlife.find(a=>a.id==='W-DEER-001');
if(!mara||!deer)throw new Error('Living-history QA requires Mara and W-DEER-001');

const sign={
  id:'SIGN-QA-DEER-BROWSE',
  sourceId:deer.id,
  species:'deer',
  kind:'deer-browse',
  label:'browsed twigs',
  position:{x:43,y:31},
  clarity:.93,
  ageHours:1,
  created:{day:w.day,hour:w.hour},
  active:true
};
w.ecologySystem.signs=[sign];

const contexts=[];
const mind={
  async decide(context){
    contexts.push(structuredClone(context));
    const signMemory=context.memories.find(m=>(m.tags||[]).includes('wildlife-sign'));
    const action=context.candidates[0];
    if(!action)throw new Error('No bounded known action available for QA mind');
    return{
      choiceType:'known_action',
      actionId:action.id,
      physicalAction:null,
      goal:'Respond to the bounded local situation.',
      intent:action.label,
      decisionSummary:'QA mind selects the highest-ranked supplied action without adding a wildlife-specific command.',
      confidence:.7,
      referencedMemoryIds:signMemory?[signMemory.id]:[],
      brainMode:'ai',
      model:'living-history-qa'
    };
  }
};

const dnas=await tickWithMind(w,mind);
const maraContext=contexts.find(c=>c.agent.id==='agent-mara');
const maraDNA=dnas.find(d=>d.agent_id==='agent-mara');
const memory=mara.memories.find(m=>m.source===`wildlife-sign:${sign.id}`);
const failures=[];

if(!maraContext)failures.push('Mara decision context was not captured');
if(!maraDNA)failures.push('Mara Decision DNA record was not created');
if(!memory)failures.push('Mara did not form a private memory from the nearby canonical ecological sign');
if(!maraContext?.perception?.wildlifeSigns?.some(s=>s.id===sign.id))failures.push('canonical ecological sign was absent from Mara local perception');
if(!maraDNA?.observation?.wildlifeSigns?.some(s=>s.id===sign.id))failures.push('ecological sign was absent from Decision DNA observation');
if(memory&&!maraDNA?.retrieved_memories?.includes(memory.id))failures.push('sign-derived memory did not enter the retrieved Decision DNA memory set');
if(memory&&!maraDNA?.mind?.referenced_memory_ids?.includes(memory.id))failures.push('QA mind reference to sign-derived memory was not preserved by Decision DNA');
const forced=(maraContext?.candidates||[]).filter(c=>/(hunt|track|sign|animal)/i.test(`${c.id} ${c.label}`));
if(forced.length)failures.push(`ecological evidence created a forced wildlife action: ${forced.map(x=>x.id).join(', ')}`);
const ivoContext=contexts.find(c=>c.agent.id==='agent-ivo');
if(ivoContext?.perception?.wildlifeSigns?.some(s=>s.id===sign.id))failures.push('Ivo perceived Mara-local ecological sign outside his local radius');

console.log(JSON.stringify({
  ok:true,
  signId:sign.id,
  maraPerceived:maraContext.perception.wildlifeSigns.map(s=>s.id),
  memoryId:memory.id,
  dnaId:maraDNA.decision_id,
  selectedAction:maraDNA.action,
  forcedWildlifeActions:forced.length,
  ivoPerceivedSign:false
},null,2));


const routeWorld=createWorld(),walker=routeWorld.agents.find(a=>a.id==='agent-mara'),from={x:43,y:31},to={x:64,y:34};
walker.position='camp';
for(let i=0;i<3;i++)buildPlayback(routeWorld,walker,{decisionId:`ROUTE-QA-${i}`,label:'Walk used ground',actionId:'qa_walk',from:i%2?to:from,to:i%2?from:to,outcome:{success:true,detail:'QA traversal'}});
const routes=routeWorld.surfaceHistory?.routes||[],route=routes[0];
if(routes.length!==1)failures.push(`reverse travel should reinforce one canonical route, got ${routes.length}`);
if(route?.traversals!==3)failures.push(`canonical route traversal count drifted: ${route?.traversals}`);
if((route?.agents?.[walker.id]||0)!==3)failures.push(`route did not retain per-agent use: ${JSON.stringify(route?.agents)}`);
if((routeWorld.surfaceHistory?.campWear?.uses||0)!==3)failures.push(`camp use did not accumulate canonical wear: ${routeWorld.surfaceHistory?.campWear?.uses}`);


const scarcityWorld=createWorld(),scarcityMara=scarcityWorld.agents.find(a=>a.id==='agent-mara');
scarcityWorld.resources.berries=0;
const resourceContexts=[];
const resourceMind={async decide(context){resourceContexts.push(structuredClone(context));const action=context.candidates[0];return{choiceType:'known_action',actionId:action.id,physicalAction:null,goal:'Respond to locally observed resource conditions.',intent:action.label,decisionSummary:'QA mind uses only supplied bounded context.',confidence:.71,referencedMemoryIds:(context.memories.find(m=>(m.tags||[]).includes('resource-observation'))?[context.memories.find(m=>(m.tags||[]).includes('resource-observation')).id]:[]),brainMode:'ai',model:'LOCAL-RESOURCE-QA'}}};
let resourceDNA=await tickWithMind(scarcityWorld,resourceMind),scarcityContext=resourceContexts.find(c=>c.agent.id==='agent-mara'),scarcityDNA=resourceDNA.find(d=>d.agent_id==='agent-mara'),scarcityMemory=scarcityMara.memories.find(m=>(m.tags||[]).includes('resource-observation')&&(m.tags||[]).includes('berries'));
if(!scarcityContext?.perception?.localResources?.some(x=>x.key==='berries'&&x.band==='depleted'&&!('quantity' in x)))failures.push('Mara did not locally perceive the depleted berry patch');
if(resourceContexts.find(c=>c.agent.id==='agent-ivo')?.perception?.localResources?.some(x=>x.key==='berries'))failures.push('Ivo received omniscient berry depletion outside his local resource view');
if(!scarcityMemory)failures.push('depleted local resource did not become a private Mara memory');
if(!scarcityDNA?.observation?.localResources?.some(x=>x.key==='berries'&&x.band==='depleted'))failures.push('local resource depletion was absent from Decision DNA observation');
if(scarcityContext?.perception?.localResources?.some(x=>'quantity' in x))failures.push('exact numeric resource quantity leaked into bounded perception');
if(scarcityDNA?.observation?.localResources?.some(x=>'quantity' in x))failures.push('exact numeric resource quantity leaked into Decision DNA');
if(/\b0 usable units?\b/i.test(scarcityMemory?.text||''))failures.push('resource memory retained database-like exact quantity wording');
if(scarcityContext?.candidates?.some(c=>c.id==='gather_berries'))failures.push('depleted berry patch still offered a gather_berries known action');
scarcityMara.position='meadow';scarcityWorld.resources.berries=18;resourceContexts.length=0;await tickWithMind(scarcityWorld,resourceMind);const recoveryMemory=scarcityMara.memories.find(m=>(m.tags||[]).includes('resource-observation')&&(m.tags||[]).includes('berries')&&(m.tags||[]).includes('recovery'));
if(!recoveryMemory)failures.push('resource recovery did not create a later private recovery memory');


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
arrivalIvo.position='forest';arrivalWorld.hour=(arrivalWorld.hour+19)%24;arrivalWorld.day+=1;const staleIds=candidateActions(arrivalWorld,arrivalIvo).map(x=>x.id);if(!staleIds.includes('gather_berries'))failures.push('stale renewable depletion never became uncertain enough to recheck');
if(failures.length){console.error(failures.join('\n'));process.exit(1)}
console.log(JSON.stringify({travelHistory:{routeId:route.id,traversals:route.traversals,campUses:routeWorld.surfaceHistory.campWear.uses}},null,2));
