import {makeStore,transferItems} from './holdings.mjs';
import assert from 'node:assert/strict';
import {createWorld} from '../engine/core.js';
import {prepare} from './elapsed.mjs';
import {workSettlement,settlementCandidates} from './settlement.mjs';
import {toolPlan,preparationFor} from './crafting.mjs';
import {constructionSpec,constructionBlockers,craftSnapshot} from '../shared/craft.js';
import {gatherWood} from '../engine/wood-runtime.js';
import {totals} from '../engine/wood-materials.js';
import {validateBlueprint} from './blueprints.mjs';
const w=prepare(createWorld()),a=w.agents[0];w.agents=[a];a.coordinates={x:66,y:36};a.needs={hunger:95,hydration:95,energy:95,warmth:95};
const jobTask=(job,minutes=job.minutes)=>({selected:{job:{...job,destination:{...a.coordinates}}},requiredMinutes:minutes,workMinutes:0});
// Supply fixture transfers existing finite resources, not a capability grant.
w.resources.stones-=10;a.inventory.stones=10;w.resources.reeds-=12;a.inventory.reeds=12;gatherWood(w,a,'dryWood',3);
const mass=totals(w.wood).dryKg,ownBefore=JSON.stringify(a.inventory),studyBefore=JSON.stringify(a.craftPractice);
let t=jobTask({kind:'craft',item:'sharpStone',minutes:6});workSettlement(w,a,t,1);assert.equal(JSON.stringify(a.inventory),ownBefore);assert.equal(JSON.stringify(a.craftPractice),studyBefore,'partial elapsed time is not completed practice');
a.coordinates.x+=1;assert.equal(workSettlement(w,a,t,5).success,false);assert.equal(JSON.stringify(a.inventory),ownBefore,'cannot craft after leaving the work location');a.coordinates.x-=1;
for(let i=0;i<10&&!a.inventory.sharpStone;i++)workSettlement(w,a,jobTask({kind:'craft',item:'sharpStone',minutes:6}),6);
assert(a.inventory.sharpStone>0);assert(a.inventory.stones<10);assert(a.craftPractice.stoneworking.successes===1);
let guard=0;while(!a.inventory.boundSharpTool&&guard++<20){const plan=toolPlan(a,'boundSharpTool');assert(plan.craft,JSON.stringify(plan));workSettlement(w,a,jobTask({kind:'craft',item:plan.craft,minutes:plan.minutes}),plan.minutes);}
assert(a.inventory.boundSharpTool===1,'edge + worked handle + actual binding yield a carried tool');assert.equal(totals(w.wood).dryKg,mass,'crafting preserves wood ledger mass');assert(a.inventory.reeds<12);assert(a.craftPractice.hafting.successes===1);
const hewn={id:'hewn-post',material:'timber',kind:'post',size:[.14,2,.14],center:[0,1,0],requires:[],finish:'hewn'};
assert(constructionBlockers(a,hewn).some(x=>x.includes('practice')),'a tool alone does not grant woodworking experience');assert.equal(preparationFor(a,hewn).craft,'woodPole');
workSettlement(w,a,jobTask({kind:'craft',item:'woodPole',minutes:8}),8);assert.equal(constructionBlockers(a,hewn).length,0);
const restored=prepare(JSON.parse(JSON.stringify(w)));assert.deepEqual(craftSnapshot(restored.agents[0]),craftSnapshot(a),'restart preserves earned work/tools without grants');
const tree=w.settlement.trees.find(x=>x.position.x>60&&x.position.y>32);a.coordinates={x:tree.position.x+1,y:tree.position.y};const toolStore=makeStore(w,{position:a.coordinates,ownerId:a.id});transferItems(w,a,toolStore,'boundSharpTool',1);
let harvest=jobTask({kind:'harvest',treeId:tree.id,quantity:4,minutes:6});assert(workSettlement(w,a,harvest,6).success);assert.equal(tree.handGathered,1,'hand gathering only takes one accessible small branch per tree');assert.equal(workSettlement(w,a,jobTask(harvest.selected.job,6),6).success,false,'cannot hand-harvest the rest of the tree');transferItems(w,toolStore,a,'boundSharpTool',1);
// New precision claims are rejected without changing the world.
a.coordinates={x:66,y:36};const raw={build:true,name:'Impossible precision',rationale:'Test unsupported manufacturing.',purpose:'supply surface',siteId:'clearing-0',code:`for(let i=0;i<4;i++){part({id:'p'+i,kind:'post',material:'timber',finish:'turned',center:[i*.2,1,0],size:[.14,2,.14],requires:[]});}`};assert.throws(()=>validateBlueprint(w,a,raw),/Precision/);
// Studying uses real visible wildlife and stops when the animal leaves.
w.ecologySystem.wildlife=[{id:'observed-deer',active:true,species:'deer',position:{x:74,y:36},behavior:'grazing'}];
const c=settlementCandidates(w,a).find(x=>x.job?.kind==='study');assert(c);t={selected:c,requiredMinutes:2,workMinutes:0};workSettlement(w,a,t,1);w.ecologySystem.wildlife[0].position.x=99;assert.equal(workSettlement(w,a,t,1).success,false);assert(!a.craftPractice.tracking,'a lost observation earns no tracking credit');
w.ecologySystem.wildlife[0].position.x=74;t={selected:c,requiredMinutes:2,workMinutes:0};assert(workSettlement(w,a,t,2).success);assert.equal(a.craftPractice.tracking.minutes,2);assert(!settlementCandidates(w,a).some(x=>x.job?.kind==='study'),'cannot farm the same stationary animal repeatedly');
console.log('PASS finite tool chain, physical location/labor, skill gate, no reload grants, wood conservation, bounded hand gathering and visible animal study');
