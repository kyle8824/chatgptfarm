import { buildPlayback } from '../engine/spectator.js';
import { createWorld, tickWithMind } from '../engine.js';

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
if(failures.length){console.error(failures.join('\n'));process.exit(1)}
console.log(JSON.stringify({travelHistory:{routeId:route.id,traversals:route.traversals,campUses:routeWorld.surfaceHistory.campWear.uses}},null,2));
