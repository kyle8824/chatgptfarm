import {gatherWood} from '../engine/wood-runtime.js';
import { createWorld, tick, tickWithMind, migrateWorld, retrieveDecisionContext, buildAffordanceView, findWorldObject, WORLD_MODEL_VERSION, ensureEcology } from '../engine.js';

const fail = message => { throw new Error(message); };
const assertWorld = (world, label) => {
  if (world.version !== '0.7') fail(`${label}: expected v0.7 world`);
  if (world.agents.length !== 2) fail(`${label}: agent count changed`);
  if (!Array.isArray(world.liveThreads)) fail(`${label}: liveThreads missing`);
  if (world.worldModel?.version !== WORLD_MODEL_VERSION) fail(`${label}: world object model missing`);
  if (!Array.isArray(world.worldModel.objects) || world.worldModel.objects.length < 8) fail(`${label}: base world entities missing`);
  if (!world.worldModel.fields?.temperature || !world.worldModel.fields?.soilMoisture) fail(`${label}: environmental fields missing`);
  ensureEcology(world); if((world.ecologySystem?.wildlife||[]).length<8) fail(`${label}: living wildlife missing`); if(world.settings?.ai?.wildlife?.enabled!==false) fail(`${label}: wildlife AI should default off`);
  for (const agent of world.agents) {
    for (const [name, value] of Object.entries(agent.needs)) if (!Number.isFinite(value) || value < 0 || value > 100) fail(`${label}: invalid ${agent.name}.${name}=${value}`);
    if (!agent.mind || !Array.isArray(agent.mind.recentActions)) fail(`${label}: mind state missing for ${agent.name}`);
    if (!Number.isFinite(agent.coordinates?.x) || !Number.isFinite(agent.coordinates?.y)) fail(`${label}: spatial coordinates missing for ${agent.name}`);
    if (!agent.activeAction || !Array.isArray(agent.activeAction.phases) || agent.activeAction.phases.length < 3) fail(`${label}: action playback missing for ${agent.name}`);
  }
  if (!Number.isFinite(world.day) || !Number.isFinite(world.hour)) fail(`${label}: invalid world clock`);
};

const geometryWorld=migrateWorld(createWorld());
const geoCreek=findWorldObject(geometryWorld,'OBJ-CREEK-001'),geoPts=geoCreek.geometry.points.map(([x,y])=>({x,y})),meters=geometryWorld.worldModel.bounds.metersPerUnit||2,waterHalf=(geoCreek.geometry.widthM||5)/(2*meters);
const segDistance=(p,a,b)=>{const vx=b.x-a.x,vy=b.y-a.y,wx=p.x-a.x,wy=p.y-a.y,d=vx*vx+vy*vy||1,t=Math.max(0,Math.min(1,(wx*vx+wy*vy)/d)),x=a.x+t*vx,y=a.y+t*vy;return Math.hypot(p.x-x,p.y-y)};
const pathDistance=p=>Math.min(...geoPts.slice(0,-1).map((a,i)=>segDistance(p,a,geoPts[i+1])));
const radiusUnits=o=>{const g=o.geometry||{};if(Number.isFinite(g.radiusM))return g.radiusM/meters;if(Number.isFinite(g.widthM))return g.widthM/(2*meters);if(Number.isFinite(g.diameterM))return g.diameterM/(2*meters);return .7};
for(const id of ['OBJ-CAMP-001','OBJ-BERRIES-001','OBJ-TREE-001','OBJ-STONES-001','OBJ-CLAY-001']){const o=findWorldObject(geometryWorld,id),clearance=pathDistance(o.position)-radiusUnits(o)-waterHalf;if(clearance<.3)fail(`Canonical river collision: ${o.label} overlaps the creek channel (${clearance.toFixed(2)} world units clearance)`)}
for(let i=1;i<geoPts.length-1;i++){const a=geoPts[i-1],b=geoPts[i],c=geoPts[i+1],u={x:b.x-a.x,y:b.y-a.y},v={x:c.x-b.x,y:c.y-b.y},dot=u.x*v.x+u.y*v.y,mu=Math.hypot(u.x,u.y)||1,mv=Math.hypot(v.x,v.y)||1,turn=Math.acos(Math.max(-1,Math.min(1,dot/(mu*mv))))*180/Math.PI;if(turn>32)fail(`Canonical creek has an abrupt ${turn.toFixed(1)}° turn at control point ${i}`)}

const fallbackWorld = migrateWorld(createWorld());
for (let i = 0; i < 96; i++) {
  const dnas = tick(fallbackWorld);
  if (!Array.isArray(dnas) || dnas.length !== 2) fail(`fallback tick ${i}: expected two Decision DNA records`);
  assertWorld(fallbackWorld, `fallback tick ${i}`);
}
if (fallbackWorld.day < 4) fail('Fallback simulation did not advance across multiple days');
if (!fallbackWorld.history.length || !fallbackWorld.dna.length) fail('Fallback history/DNA missing');

const aiWorld = migrateWorld(createWorld());
let sawMovingPlayback = false;
const fakeMind = {
  async decide(context) {
    const creek = context.affordances.objects.find(o => o.id === 'place:creek');
    if (creek) return {choiceType:'physical_action',actionId:'__physical__',physicalAction:{verb:'move',primaryObjectId:creek.id,secondaryObjectId:'none',configuration:'none',purpose:'Move deliberately toward a known water source.'},goal:'Test a bounded physical intention',intent:'Move to the creek using the primitive movement layer.',decisionSummary:'Synthetic mind selected an accessible world entity through the physical affordance interface.',confidence:.84,referencedMemoryIds:context.memories.slice(0,1).map(m=>m.id),brainMode:'ai',model:'smoke-test-mind'};
    const chosen = context.candidates[0];
    return { choiceType:'known_action',actionId:chosen.id,physicalAction:null,goal:'Stay functional',intent:chosen.label,decisionSummary:'Fallback synthetic known action.',confidence:.7,referencedMemoryIds:[],brainMode:'ai',model:'smoke-test-mind' };
  },
  async replay(context) { const chosen=context.candidates[0]; return { choiceType:'known_action',actionId:chosen.id,physicalAction:null }; }
};
for (let i=0;i<4;i++) {
  const dnas=await tickWithMind(aiWorld,fakeMind,{enableCounterfactualReplay:true});
  if (!dnas.every(d=>d.mind?.brain_mode==='ai')) fail(`AI tick ${i}: DNA did not record AI brain mode`);
  if (!dnas.every(d=>d.protocol==='Decision DNA 0.6-farm')) fail(`AI tick ${i}: Decision DNA protocol changed unexpectedly`);
  if (aiWorld.agents.some(a=>a.activeAction?.moving)) sawMovingPlayback=true;
  assertWorld(aiWorld,`AI tick ${i}`);
}
if (aiWorld.meta.aiDecisions < 8) fail('AI decision counter did not advance');
if (!sawMovingPlayback) fail('No visible movement lifecycle was produced');

// Progressive physical resolution: an aggregate environment becomes detailed only when examined.
const objectWorld = migrateWorld(createWorld());
const observer = objectWorld.agents[0];observer.position='log';observer.inventory.sharpStone=1;
const inspectMind={async decide(context){const target=context.affordances.objects.find(o=>o.id==='place:log');if(!target)fail('Fallen oak place was not exposed from world model');if(target.worldObject?.type!=='fallen_tree')fail('Fallen oak affordance is not backed by persistent entity');return{choiceType:'physical_action',actionId:'__physical__',physicalAction:{verb:'inspect',primaryObjectId:target.id,secondaryObjectId:'none',configuration:'none',purpose:'Examine the fallen tree closely enough to distinguish its parts.'},goal:'Understand the physical tree',intent:'Inspect its structure',decisionSummary:'Resolve detail only where attention is applied.',confidence:.9,referencedMemoryIds:[],brainMode:'ai',model:'object-test'}}};
await tickWithMind(objectWorld,inspectMind);
const fallen=findWorldObject(objectWorld,'OBJ-TREE-001');
if (!fallen?.resolution?.componentsInstantiated || fallen.childrenIds.length<5) fail('Close inspection did not progressively instantiate tree components');
const branch=findWorldObject(objectWorld,'OBJ-TREE-001-BRANCH-1');
if (!branch || branch.parentId!==fallen.id || !branch.physical?.wood || branch.material?.species!=='oak') fail('Resolved branch did not inherit identity/material/provenance from parent tree');
const detailed=buildAffordanceView(objectWorld,observer);const branchAff=detailed.objects.find(o=>o.id===`entity:${branch.id}`);
if (!branchAff || !branchAff.supports.includes('cut')) fail('Resolved physical component did not derive a cut affordance from its properties');
const cutMind={async decide(){return{choiceType:'physical_action',actionId:'__physical__',physicalAction:{verb:'cut',primaryObjectId:`entity:${branch.id}`,secondaryObjectId:'sharp_stone',configuration:'none',purpose:'Separate this specific branch from the fallen tree.'},goal:'Detach one usable branch',intent:'Cut the identified component',decisionSummary:'Use a sharp carried edge against a persistent wood component.',confidence:.92,referencedMemoryIds:[],brainMode:'ai',model:'object-test'}}};
await tickWithMind(objectWorld,cutMind);
const detached=findWorldObject(objectWorld,branch.id);
if (detached.parentId!==null || detached.carrierId!==observer.id || !detached.state?.carried) fail('Cut branch did not preserve identity while becoming an independent carried object');
if (!detached.provenance?.detached) fail('Detached object lost transformation provenance');

const chainWorld = migrateWorld(createWorld());
const mara = chainWorld.agents[0];mara.position='camp';gatherWood(chainWorld,mara,'dryWood',1);mara.inventory.sharpStone=1;mara.inventory.cordage=1;
const physicalMind = proposal => ({async decide(){return{choiceType:'physical_action',actionId:'__physical__',physicalAction:proposal,goal:'Experiment with material properties',intent:proposal.purpose,decisionSummary:'Synthetic emergence-chain action.',confidence:.9,referencedMemoryIds:[],brainMode:'ai',model:'chain-test'}}});
await tickWithMind(chainWorld,physicalMind({verb:'cut',primaryObjectId:'carried_dry_branch',secondaryObjectId:'sharp_stone',configuration:'straight',purpose:'Make the branch straighter and easier to control.'}));
if (chainWorld.agents[0].inventory.woodPole < 1) fail('Cutting branch did not produce a worked pole');
await tickWithMind(chainWorld,physicalMind({verb:'bind',primaryObjectId:'wood_pole',secondaryObjectId:'sharp_stone',configuration:'bound',purpose:'See whether cordage can hold stone and wood together under force.'}));
if (chainWorld.agents[0].inventory.boundSharpTool < 1) fail('Binding materials did not produce a composite tool');
if (!chainWorld.discoveries.some(d=>d.key==='bound-composite-tool')) fail('Composite-tool world discovery missing');

const boundaryWorld=migrateWorld(createWorld());const boundaryAgent=boundaryWorld.agents[0];boundaryAgent.position='camp';boundaryAgent.memories.unshift({id:'M-boundary',text:'West of camp is a marshy reed bed.',importance:7,confidence:.9,tags:['reeds','exploration']});const boundaryContext=retrieveDecisionContext(boundaryWorld,boundaryAgent);const distantReeds=boundaryContext.affordances.objects.find(o=>o.id==='place:reeds');if(!distantReeds||!distantReeds.supports.includes('move')||distantReeds.supports.includes('search'))fail('Distant-place locality boundary failed');if(!('satiety'in boundaryContext.perception.needs)||('hunger'in boundaryContext.perception.needs))fail('Model physiology still exposes ambiguous hunger semantics');


const toggleWorld=migrateWorld(createWorld());toggleWorld.settings.ai.people['agent-mara']=false;let toggleCalls=0;const toggleMind={async decide(context){toggleCalls++;const c=context.candidates[0];return{choiceType:'known_action',actionId:c.id,physicalAction:null,goal:'test',intent:c.label,decisionSummary:'toggle test',confidence:.7,referencedMemoryIds:[],brainMode:'ai',model:'toggle-test'}}};await tickWithMind(toggleWorld,toggleMind);if(toggleCalls!==1)fail(`Per-person AI toggle expected 1 model call, got ${toggleCalls}`);if(!toggleWorld.ecologySystem.wildlife.some(x=>x.movement&&x.movement.from&&x.movement.to))fail('Wildlife movement state missing');

console.log(`Smoke test passed · v0.7 object-field world · ${objectWorld.worldModel.objects.length} resolved entities · fallback Day ${fallbackWorld.day} · AI ${aiWorld.meta.aiDecisions} decisions`);