import assert from 'node:assert/strict';
import {createWorld} from '../engine/core.js';
import {gatherWood} from '../engine/wood-runtime.js';
import {prepare,step} from './elapsed.mjs';
import {validateBlueprint,adoptBlueprint} from './blueprints.mjs';
import {settlementCandidates,workSettlement} from './settlement.mjs';
import {transferItems,syncHoldings} from './holdings.mjs';

const w=prepare(createWorld()),a=w.agents[0];w.agents=[a];
a.coordinates={x:66,y:36};a.needs={hunger:95,hydration:95,energy:90,warmth:90};a.task=null;a.suspendedTasks=[];
w.weather='clear';w.temperature=65;w.liveWeatherUntil=w.day*24+w.hour+6;
const raw={build:true,name:'Mat and independent frame',purpose:'comfort',rationale:'Build supported pieces while gathering the remaining materials.',siteId:'clearing-0',access:'private',extendsProjectId:null,replacesProjectId:null,
 code:"part({id:'mat',kind:'deck',material:'reeds',center:[0,.04,0],size:[1,.08,2.2],requires:[]});for(let i=0;i<2;i++)part({id:i?'right':'left',kind:'post',material:'timber',center:[i?.9:-.9,.75,.9],size:[.14,1.5,.14],requires:[]});part({id:'beam',kind:'beam',material:'timber',center:[0,1.5,.9],size:[2,.14,.14],requires:['left','right']});"};
const before=JSON.stringify(w),design=validateBlueprint(w,a,raw);
assert.equal(JSON.stringify(w),before,'normalizing optional fields never changes the world');
assert.equal(raw.extendsProjectId,null,'validation does not mutate the submitted response');
assert(!design.extendsProjectId&&!design.replacesProjectId);
assert.throws(()=>validateBlueprint(w,a,{...raw,extendsProjectId:'invented'}),/offered extension/);
assert.throws(()=>validateBlueprint(w,a,{...raw,replacesProjectId:'invented'}),/accessible completed/);
assert.throws(()=>validateBlueprint(w,a,{...raw,code:"part({id:'floating',kind:'roof',material:'reeds',center:[0,2,0],size:[1,.1,1],requires:[]});"}),/Floating/);
const p=adoptBlueprint(w,a,design,'isolated-building-flow'),stock=w.settlement.stores.find(s=>s.id===p.stockpileId);
// Match the production blocker: an early reed component needs cordage,
// while independent, supported rough posts have finite timber on the rack.
a.inventory.cordage=0;a.inventory.reeds=0;gatherWood(w,a,'wetWood',2);
transferItems(w,a,stock,'wetWood',2);
let options=settlementCandidates(w,a),fetch=options.find(c=>c.id===`fetch_part:${p.id}:left`);
assert(fetch,'missing cordage for the mat cannot block fetching timber for a post');
assert(!options.some(c=>c.job?.partId==='beam'),'dependencies must actually be built');
const timberBefore=w.wood.batches.reduce((n,b)=>n+b.units,0);
a.coordinates={...fetch.job.destination};assert(workSettlement(w,a,{selected:fetch,requiredMinutes:.5,workMinutes:0},.5).success);
// Cargo handling reserves the selected component, not the blocked first one.
a.inventory.rawClayVessel=1;
const deposit=settlementCandidates(w,a).find(c=>c.job?.kind==='deposit');
if(deposit){assert.equal(deposit.job.keep.wetWood,1);a.coordinates={...deposit.job.destination};workSettlement(w,a,{selected:deposit,requiredMinutes:.75,workMinutes:0},.75);assert.equal(a.inventory.wetWood,1);}
let build=settlementCandidates(w,a).find(c=>c.id===`build:${p.id}:left`);assert(build);
a.coordinates={...build.job.destination};const task={selected:build,requiredMinutes:7,workMinutes:0};
assert(!workSettlement(w,a,task,1).done);assert(p.parts[1].invested);assert(!p.parts[1].built);
const restored=prepare(JSON.parse(JSON.stringify(w))),person=restored.agents[0],project=restored.settlement.projects.find(x=>x.id===p.id);
assert(settlementCandidates(restored,person).some(c=>c.id===`build:${p.id}:left`),'invested work remains resumable after reload');
assert.equal(project.parts[1].workMinutes,1);assert.equal(project.parts[0].workMinutes,0);
// Exercise the real autonomous loop with finite supplies. There are no
// provider calls, live-state writes, instant completions or replenishments.
person.task=null;person.suspendedTasks=[];let steps=0;
for(;steps<500&&!project.parts[2].built;steps++)await step(restored,6);
assert(project.parts[1].built&&project.parts[2].built,'autonomous work completes both independent posts');
assert.equal(project.parts[0].built,false,'the reed mat has not been granted its missing binding');
assert.equal(project.parts[3].built,false,'the lashed beam still needs real prerequisites');
syncHoldings(restored);
assert.equal(restored.wood.batches.reduce((n,b)=>n+b.units,0),timberBefore,'construction conserves the finite wood ledger');
assert.equal(restored.settlement.stores.find(s=>s.id===stock.id).items.wetWood,0);
console.log(JSON.stringify({result:'PASS null optional ids, strict ownership/geometry, independent staged work, finite rack transfers, cargo reservation, checkpoint resume and autonomous post assembly',steps}));
