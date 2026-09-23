import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createWorld} from '../engine/core.js';
import {prepare,step} from './elapsed.mjs';
import {buildingSites,validateBlueprint,adoptBlueprint,designContext,DESIGN_SYSTEM} from './blueprints.mjs';
import {restSurfaces} from './rest-surfaces.mjs';
import {comfortCandidates,restPlace,workComfortRest,comfortContext} from './comfort.mjs';
import {workQuality} from './structure-lifecycle.mjs';
import {makeStore,clock} from './holdings.mjs';

function world(){const w=prepare(createWorld());w.agents=w.agents.slice(0,1);const a=w.agents[0];a.coordinates={x:70,y:39};a.task=null;a.suspendedTasks=[];a.needs={hunger:95,hydration:95,energy:40,warmth:80};w.temperature=65;w.weather='clear';w.environmentState.surfaceWetness=.2;return w;}
const matCode=`for(let x=0;x<2;x++)for(let z=0;z<2;z++)part({id:'mat'+x+z,kind:'deck',material:'reeds',center:[(x-.5)*.5,.04,(z-.5)*1.1],size:[.5,.08,1.1],requires:[]});`;
const bedCode=`for(let x=0;x<2;x++)for(let z=0;z<2;z++)part({id:'leg'+x+z,kind:'post',material:'timber',center:[(x-.5)*.8,.15,(z-.5)*1.9],size:[.14,.3,.14],requires:[]});part({id:'platform',kind:'deck',material:'timber',center:[0,.35,0],size:[1,.1,2.2],requires:['leg00','leg01','leg10','leg11']});part({id:'bedding',kind:'deck',material:'reeds',center:[0,.44,0],size:[1,.08,2.2],requires:['platform']});`;
const seatCode=`for(let x=0;x<2;x++)for(let z=0;z<2;z++)part({id:'leg'+x+z,kind:'post',material:'timber',center:[(x-.5)*.42,.15,(z-.5)*.42],size:[.12,.3,.12],requires:[]});part({id:'seat',kind:'deck',material:'timber',center:[0,.35,0],size:[.65,.1,.65],requires:['leg00','leg01','leg10','leg11']});`;
function design(w,code,name='Individual rest design'){return validateBlueprint(w,w.agents[0],{build:true,name,purpose:'improve uncomfortable rest',siteId:buildingSites(w,w.agents[0]).find(s=>!s.spansWater).id,access:'shared',rationale:'Resting on hard ground is uncomfortable.',code});}
function completeFixture(w,code){const a=w.agents[0],p=adoptBlueprint(w,a,design(w,code),'isolated-fixture');p.status='complete';for(const part of p.parts){part.built=true;part.durability={condition:1,quality:.8,origin:'work',useWear:0};}return p;}
function restTask(a,choice){return {id:'comfort-fixture',actionId:choice?.id||'rest',label:choice?.label||'Rest',source:'fallback',selected:choice||{id:'rest',label:'Rest'},destination:{...a.coordinates},origin:{...a.coordinates},path:[{...a.coordinates}],phase:'work',targetPosition:'meadow',liveSpaceVersion:1,liveTiming:true,workMinutes:0,requiredMinutes:60};}

// Bare ground never invents a seat, and wet exposure reduces real rest quality.
const ground=world(),g=ground.agents[0],dry=restPlace(ground,g);assert.equal(dry.posture,'ground');assert.equal(dry.height,0);ground.weather='rain';const wet=restPlace(ground,g);assert(wet.score<dry.score);ground.weather='clear';
g.task=restTask(g);for(let i=0;i<20;i++)workComfortRest(ground,g,g.task,1);
assert(g.comfort.value<55);assert(g.memories.some(m=>m.tags.includes('comfort')));assert(comfortContext(ground,g).improvementWanted);assert(designContext(ground,g).comfort.improvementWanted);assert.match(DESIGN_SYSTEM,/comfort.lastRest/);
const restored=prepare(JSON.parse(JSON.stringify(ground)));assert.deepEqual(restored.agents[0].comfort,g.comfort,'rest experience survives restart without free comfort');

// Design words alone, unfinished parts, broken supports, gaps, obstruction,
// inaccessible ownership, occupied surfaces and stored cargo confer no benefit.
const w=world(),a=w.agents[0],bed=adoptBlueprint(w,a,design(w,bedCode),'isolated-fixture');assert.equal(restSurfaces(bed).length,0);assert.equal(comfortCandidates(w,a).length,0);assert(bed.affordances.labels.includes('Supported lying surface'));assert.equal(bed.affordances.storage,null,'bedding is not auto-filled as cargo storage');
bed.status='complete';for(const p of bed.parts){p.built=true;p.durability={condition:1,quality:.8,origin:'work',useWear:0};}
assert.equal(restSurfaces(bed).length,1);let surface=restSurfaces(bed)[0];assert.equal(surface.posture,'lie');assert(surface.soft);
const choice=comfortCandidates(w,a).find(c=>c.job.surfaceId===surface.id);assert(choice);a.coordinates={...surface.position};a.task=restTask(a,choice);
const firm=structuredClone(bed);firm.parts=firm.parts.filter(p=>p.id!=='bedding');assert(restSurfaces(firm)[0].comfort<surface.comfort,'soft material has a real advantage');
const before=a.needs.energy;for(let i=0;i<20;i++)workComfortRest(w,a,a.task,1);assert(a.needs.energy-before>g.needs.energy-40,'comfortable rest restores energy faster');assert(a.comfort.value>55);assert.equal(a.restSupport.height,.48);assert(bed.parts.find(p=>p.id==='bedding').durability.useWear>0);
bed.parts[0].durability.condition=0;const comfortBefore=a.comfort.value,energyBefore=a.needs.energy;assert.equal(workComfortRest(w,a,a.task,1).success,false);assert.equal(a.needs.energy,energyBefore);assert.equal(a.comfort.value,comfortBefore);assert.equal(restSurfaces(bed).length,0);bed.parts[0].durability.condition=1;
bed.parts[0].durability.condition=.3;assert.equal(restSurfaces(bed).length,0,'unsafe underlying supports cannot be hidden by soft bedding');bed.parts[0].durability.condition=1;
bed.access='private';bed.ownerId='someone-else';assert.equal(comfortCandidates(w,a).length,0);bed.ownerId=a.id;bed.access='shared';
w.agents.push({...structuredClone(a),id:'other',coordinates:{...a.coordinates},task:null});assert.equal(comfortCandidates(w,a).length,0);w.agents.pop();
const store=makeStore(w,{projectId:bed.id,ownerId:a.id,position:bed.position,items:{stones:1}});assert.equal(comfortCandidates(w,a).length,0);store.items.stones=0;
const blocked=structuredClone(bed);blocked.parts.push({id:'blocking-wall',built:true,kind:'wall',material:'timber',size:[.1,1,2],center:[0,1,0],requires:[]});assert.equal(restSurfaces(blocked).length,0);
const hole=structuredClone(bed);hole.parts=hole.parts.filter(p=>p.id!=='bedding');hole.parts.find(p=>p.id==='platform').size=[.3,.1,.3];assert.equal(restSurfaces(hole).length,0);
const bad=world();assert.throws(()=>design(bad,matCode.replace(',.04,',',.14,')),/supporting deck/,'floating bedding is rejected');assert.throws(()=>design(bad,bedCode.replace('size:[1,.1,2.2]','size:[.5,.1,2.2]')),/full footprint/,'soft bedding cannot bridge missing hard support');
const matWorld=world(),mat=completeFixture(matWorld,matCode);assert(restSurfaces(mat)[0].soft);assert.equal(restSurfaces(mat)[0].height,.08);
const seatWorld=world(),seat=completeFixture(seatWorld,seatCode);assert.equal(restSurfaces(seat)[0].posture,'seat');

// A comfort-motivated program still needs real gathering, bindings, labor and
// construction. This second fixture does not mark anything built by hand.
const life=world(),worker=life.agents[0];worker.needs.energy=95;const project=adoptBlueprint(life,worker,design(life,matCode),'isolated-model-response');
for(const node of life.resourceSites.nodes)node.knownBy.push(worker.id);worker.comfort.value=25;worker.comfort.uncomfortableMinutes=60;
let steps=0;while(project.status!=='complete'&&steps++<12000)await step(life,6);
assert.equal(project.status,'complete',JSON.stringify({steps,task:worker.task,inventory:worker.inventory,parts:project.parts,history:life.history.slice(0,3)}));assert(project.parts.every(p=>p.invested&&p.workMinutes>=p.requiredMinutes&&p.bindingUsed>0));
assert(worker.craftPractice.fiberwork.minutes>0);assert(comfortCandidates(life,{...worker,needs:{...worker.needs,energy:40}}).length>0,'completed furniture becomes available to rest on');
const restart=prepare(JSON.parse(JSON.stringify(life)));assert.deepEqual(restart.settlement.projects,life.settlement.projects);
// Renderer fixtures explicitly represent isolated test constructions.
for(const [world,p]of [[w,bed],[matWorld,mat],[seatWorld,seat]]){const actor=world.agents[0],s=restSurfaces(p)[0];actor.coordinates={...s.position};actor.needs.energy=30;actor.task=restTask(actor,comfortCandidates(world,actor)[0]);workComfortRest(world,actor,actor.task,.1);}
await fs.mkdir('realtime-qa',{recursive:true});await fs.writeFile('realtime-qa/comfort-fixtures.json',JSON.stringify({ground,bed:w,mat:matWorld,seat:seatWorld}));
console.log(JSON.stringify({result:'PASS physical comfort, wet ground, memory/planning, bounded bedding geometry, completed supports, ownership, occupancy, cargo, wear, restart and autonomous finite construction',constructionSteps:steps,groundComfort:dry.score,wetGroundComfort:wet.score,bedComfort:surface.comfort}));
