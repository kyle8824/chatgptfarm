import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createWorld} from '../engine/core.js';
import {prepare,step} from './elapsed.mjs';
import {buildingSites,validateBlueprint,adoptBlueprint,designContext} from './blueprints.mjs';
import {settlementCandidates,workSettlement} from './settlement.mjs';
import {restSurfaces} from './rest-surfaces.mjs';
import {coverEffectiveness} from './structures.mjs';
import {gatherWood} from '../engine/wood-runtime.js';
import {updateImprovementGoal,improvementBonus} from './improvement-goals.mjs';
import {workComfortRest} from './comfort.mjs';
import {retireObsoleteTask,liveUrgency,liveCandidates} from './behavior.mjs';
import {expandFrontier} from './frontier.mjs';
import {reorganizeLandscape} from './landscape-migration.mjs';
import {householdWorld,campLayout} from '../shared/frontier.js';
import {workPrimitiveShelter} from './primitive-shelter.mjs';
import {syncHoldings} from './holdings.mjs';
import {constructionProgress} from '../shared/construction-progress.js';

const w=prepare(createWorld()),a=w.agents[0];w.agents=[a];w.weather='clear';w.temperature=65;a.coordinates={x:66,y:36};a.needs={hunger:95,hydration:95,energy:80,warmth:80};a.task=null;a.suspendedTasks=[];
const raw=(code,more={})=>({build:true,name:'A small resting place',purpose:'rest comfortably',rationale:'Improve a place I actually rest.',siteId:'clearing-0',access:'private',code,...more});
const mat="part({id:'mat',kind:'deck',material:'reeds',center:[0,.04,0],size:[1,.08,2.2],requires:[]});";
const untouched=JSON.stringify(w),design=validateBlueprint(w,a,raw(mat));assert.equal(JSON.stringify(w),untouched,'validation is read-only');assert.equal(design.parts.length,1);
const p=adoptBlueprint(w,a,design,'isolated-stage-test'),fixtures={planned:structuredClone(w)};assert(!restSurfaces(p).length);assert.equal(p.stages.length,1);assert.equal(p.parts[0].built,false);
function workPart(part,minutes=Infinity){
 if(!part.invested){if(part.material==='timber')gatherWood(w,a,'wetWood',part.materialUnits);else a.inventory[part.material==='stone'?'stones':part.material]=part.materialUnits;a.inventory.cordage=1;}
 const option=settlementCandidates(w,a).find(c=>c.job?.kind==='assemble'&&c.job.projectId===p.id&&c.job.partId===part.id);assert(option,'a reachable finite assembly task exists for '+part.id);
 a.coordinates={...option.job.destination};const task={actionId:option.id,selected:option,requiredMinutes:part.requiredMinutes,workMinutes:part.workMinutes};a.task=task;
 const outcome=workSettlement(w,a,task,Math.min(minutes,part.requiredMinutes-part.workMinutes));a.task=null;return outcome;
}
workPart(p.parts[0],1);assert(p.parts[0].invested&&!p.parts[0].built);assert.equal(a.inventory.reeds,0);assert.equal(a.inventory.cordage,0);assert.equal(constructionProgress(p.parts[0]).phase,'preparing');fixtures.preparing=structuredClone(w);
const midway=prepare(JSON.parse(JSON.stringify(w)));assert.deepEqual(midway.settlement.projects[0],p,'restart preserves invested work and its stage');
workPart(p.parts[0]);assert.equal(p.status,'complete');assert(restSurfaces(p).length);assert.equal(p.stages[0].completedAt,p.createdAt);fixtures.first_use=structuredClone(w);
const oldId=p.id,oldCreated=p.createdAt,oldPart=p.parts[0],oldPartJSON=JSON.stringify(oldPart),oldInventory=JSON.stringify(a.inventory),oldStock=p.stockpileId;
const extensionSite=designContext(w,a).sites.find(s=>s.extendsProjectId===p.id);assert(extensionSite);assert.equal(extensionSite.existingParts[0].id,'mat');
// Emission order need not equal assembly order; dependencies still must be real.
const addition="part({id:'roof',kind:'roof',material:'reeds',center:[0,1.75,0],size:[2.4,.1,2.4],requires:['postL','postR']});for(let i=0;i<2;i++)part({id:i?'postR':'postL',kind:'post',material:'timber',center:[i?.9:-.9,.85,.9],size:[.12,1.7,.12],requires:[]});";
const extension=raw(addition,{name:'Weather cover for my mat',siteId:extensionSite.id,extendsProjectId:p.id});
const ext=validateBlueprint(w,a,extension);assert.deepEqual(ext.parts.slice(1).map(p=>p.id),['postL','postR','roof']);assert.equal(JSON.stringify(a.inventory),oldInventory);
const adopted=adoptBlueprint(w,a,ext,'isolated-addition');assert.equal(adopted,p);assert.equal(p.id,oldId);assert.equal(p.createdAt,oldCreated);assert.equal(p.parts[0],oldPart);assert.equal(JSON.stringify(oldPart),oldPartJSON);assert.equal(p.stockpileId,oldStock);assert.equal(p.stages.length,2);assert(restSurfaces(p).length,'the mat stays usable during later building');assert.equal(coverEffectiveness(w,p.position),0,'a drawing is not a roof');
assert.throws(()=>adoptBlueprint(w,a,ext,'stale'),/capacity|changed/i);assert.throws(()=>validateBlueprint(w,a,raw("part({id:'same',kind:'deck',material:'reeds',center:[0,.04,0],size:[1,.08,2],requires:['missing']});",{siteId:'clearing-1'})),/missing part/);
const goal=structuredClone(updateImprovementGoal(w,a));a.needs.hydration=5;assert.equal(liveUrgency(w,a),'hydration');assert.equal(improvementBonus(a,{job:{projectId:p.id,kind:'assemble'}}),0);a.task={actionId:'drink'};updateImprovementGoal(w,a);assert.equal(a.improvementGoal.projectId,goal.projectId);assert.equal(a.improvementGoal.pausedFor,'hydration');a.needs.hydration=90;a.task=null;updateImprovementGoal(w,a);assert.equal(a.improvementGoal.pausedFor,null);
workPart(p.parts.find(x=>x.id==='postL'));fixtures.frame=structuredClone(w);assert(restSurfaces(p).length);assert.equal(coverEffectiveness(w,p.position),0);
workPart(p.parts.find(x=>x.id==='postR'));workPart(p.parts.find(x=>x.id==='roof'),5);fixtures.covering=structuredClone(w);assert.equal(coverEffectiveness(w,p.position),0,'an unfinished roof grants no cover');
workPart(p.parts.find(x=>x.id==='roof'));assert.equal(p.status,'complete');assert(coverEffectiveness(w,p.position)>0);assert.equal(p.parts[0],oldPart);assert(p.stages.every(s=>s.completedAt!==undefined));assert(!p.storeId,'soft bedding does not gain a supply pile during construction');fixtures.finished=structuredClone(w);updateImprovementGoal(w,a);assert.equal(a.improvementGoal.status,'satisfied');
// A private structure cannot be extended by another person, and an extension
// cannot overwrite an old part, smuggle a replacement, or skip support checks.
const stranger={...a,id:'stranger'};assert(!designContext(w,stranger).allowedExtensionIds.includes(p.id));assert.throws(()=>validateBlueprint(w,stranger,extension),/Site unavailable/);
assert.throws(()=>validateBlueprint(w,a,{...extension,code:mat}),/unique/);
assert.throws(()=>validateBlueprint(w,a,{...extension,replacesProjectId:p.id}),/cannot also replace/);
assert.throws(()=>validateBlueprint(w,a,{...extension,code:"part({id:'a',kind:'roof',material:'reeds',center:[0,2,0],size:[1,.1,1],requires:['b']});part({id:'b',kind:'beam',material:'timber',center:[0,2,0],size:[1,.1,.1],requires:['a']});"}),/cycle/);
const damaged=p.parts.find(x=>x.id==='postL');damaged.durability.condition=0;
assert.throws(()=>validateBlueprint(w,a,{...extension,code:"part({id:'brace',kind:'beam',material:'timber',center:[-.9,1.65,.9],size:[.1,.1,.1],requires:['postL']});"}),/Repair failed existing supports/);damaged.durability.condition=1;
// Existing store identity, position and contents survive an additional stage.
const floor=adoptBlueprint(w,a,validateBlueprint(w,a,raw("part({id:'base',kind:'deck',material:'timber',center:[0,.1,0],size:[1,.2,1],requires:[]});",{siteId:'clearing-1'})),'storage-fixture');
const f=floor.parts[0];gatherWood(w,a,'wetWood',f.materialUnits);a.inventory.cordage=1;let option=settlementCandidates(w,a).find(c=>c.job?.projectId===floor.id&&c.job.kind==='assemble');assert(option);a.coordinates={...option.job.destination};workSettlement(w,a,{selected:option,requiredMinutes:f.requiredMinutes,workMinutes:0},f.requiredMinutes);
const store=w.settlement.stores.find(s=>s.id===floor.storeId);assert(store);store.items.stones=2;syncHoldings(w);const storeBefore={id:store.id,position:{...store.position},items:{...store.items}},storeCount=w.settlement.stores.length;
const next=validateBlueprint(w,a,raw("part({id:'side',kind:'deck',material:'timber',center:[1,.1,0],size:[1,.2,1],requires:[]});",{siteId:'extend-'+floor.id,extendsProjectId:floor.id}));adoptBlueprint(w,a,next,'addition');
const side=floor.parts[1];gatherWood(w,a,'wetWood',side.materialUnits);a.inventory.cordage=1;option=settlementCandidates(w,a).find(c=>c.job?.projectId===floor.id&&c.job.partId==='side'&&c.job.kind==='assemble');assert(option);a.coordinates={...option.job.destination};workSettlement(w,a,{selected:option,requiredMinutes:side.requiredMinutes,workMinutes:0},side.requiredMinutes);
assert.equal(w.settlement.stores.length,storeCount);assert.equal(floor.storeId,storeBefore.id);assert.deepEqual(store.position,storeBefore.position);assert.deepEqual(store.items,storeBefore.items);assert(store.designCapacity.mass>9,'new floor space increases actual capacity');
// The reported threshold: a distressed person on bad ground must keep a
// necessary rest after energy crosses 30, but still interrupt for water.
const rest=prepare(createWorld()),r=rest.agents[0];rest.agents=[r];r.coordinates={x:70,y:39};r.needs.energy=30;r.happiness.value=20;r.task={id:'necessary-rest',actionId:'rest',selected:{id:'rest'},workMinutes:0,requiredMinutes:60};workComfortRest(rest,r,r.task,.01);assert(r.needs.energy>30);retireObsoleteTask(rest,r);assert(r.task,'rest commitment survives crossing the threshold');const reloaded=prepare(JSON.parse(JSON.stringify(rest)));retireObsoleteTask(reloaded,reloaded.agents[0]);assert(reloaded.agents[0].task);r.needs.hydration=5;assert.equal(liveUrgency(rest,r),'hydration');
// Primitive shelter work is physical and persistent too; resuming consumes
// neither a second set of branches nor a second copy of already completed work.
const primitive=prepare(createWorld()),b=primitive.agents[0];primitive.agents=[b];b.coordinates={...campLayout(primitive).fire};b.task=null;gatherWood(primitive,b,'wetWood',4);const countBefore=primitive.wood.batches.reduce((n,x)=>n+x.units,0);let task={actionId:'build_shelter',workMinutes:0,requiredMinutes:180};assert(!workPrimitiveShelter(primitive,b,task,70).done);assert(!primitive.structures.shelter);const invested=primitive.wood.batches.filter(x=>x.form==='shelter-component').reduce((n,x)=>n+x.units,0);assert.equal(invested,4);const pr=prepare(JSON.parse(JSON.stringify(primitive))),pb=pr.agents[0];assert(liveCandidates(pr,pb,[]).some(c=>c.id==='build_shelter'));assert(workPrimitiveShelter(pr,pb,{actionId:'build_shelter',workMinutes:0},110).success);assert(pr.structures.shelter);assert.equal(pr.wood.batches.filter(x=>x.form==='shelter-component').reduce((n,x)=>n+x.units,0),4);assert.equal(pr.wood.batches.reduce((n,x)=>n+x.units,0),countBefore);
// Expanded production-sized terrain: site queries must read the ledger once,
// not once for every candidate site and tree. No stale cache after transfer.
const large=prepare(createWorld());expandFrontier(large);reorganizeLandscape(large);const who=large.agents[0],ledger=large.wood.batches;let reads=0;large.wood.batches=new Proxy(ledger,{get(t,k,r){if(/^\d+$/.test(String(k)))reads++;return Reflect.get(t,k,r);}});const started=performance.now();buildingSites(householdWorld(large,who),who);const siteMs=performance.now()-started;assert(reads<=ledger.length*2,`${reads} ledger reads for ${ledger.length} batches`);large.wood.batches=ledger;
await fs.mkdir('realtime-qa',{recursive:true});await fs.writeFile('realtime-qa/construction-stages-fixtures.json',JSON.stringify(fixtures));
console.log(JSON.stringify({result:'PASS small starts, dependency ordering, physical staged work, useful partial structure, extensions, ownership, retained stores/materials/identity, goals through urgent needs/reload, rest threshold, primitive shelter progress and linear site search',reads,batches:ledger.length,siteMs:Math.round(siteMs)}));
