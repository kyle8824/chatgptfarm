import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createWorld} from '../engine/core.js';
import {prepare} from './elapsed.mjs';
import {validateBlueprint,adoptBlueprint,designContext,buildingSites} from './blueprints.mjs';
import {advanceStructures,recordWorkmanship,workQuality,requestMaintenance,noteCargoLimits,recordCrossingWear} from './structure-lifecycle.mjs';
import {structurePerformance,conditionOf,cargoAllowance} from '../shared/structure-performance.js';
import {onDeck,coverEffectiveness} from './structures.mjs';
import {liveRoute} from './motion.mjs';
import {makeStore,roomFor} from './holdings.mjs';
import {settlementCandidates,workSettlement} from './settlement.mjs';
import {gatherWood,woodCommand,advanceWood} from '../engine/wood-runtime.js';
import {totals} from '../engine/wood-materials.js';
const example=JSON.parse(await fs.readFile(new URL('../structure-workshop/example.json',import.meta.url)));
const fresh=()=>{const w=prepare(createWorld());w.agents=w.agents.slice(0,1);const a=w.agents[0];a.coordinates={x:66,y:36};a.needs={hunger:95,hydration:95,energy:95,warmth:95};return w;};
// These fixtures stand for already-built structures. Full physical construction
// is exercised separately by open-construction and hewn-construction tests.
const built=(w,raw=example)=>{const a=w.agents[0],p=adoptBlueprint(w,a,validateBlueprint(w,a,{...raw,build:true}),'fixture');for(const part of p.parts){part.built=true;part.invested=true;recordWorkmanship(w,a,part);}p.status='complete';if(p.affordances.storage)p.storeId=makeStore(w,{...p.affordances.storage,projectId:p.id,ownerId:a.id,kind:'platform',name:p.name}).id;return p;};
const w=fresh(),a=w.agents[0],p=built(w);const initial=w.wood.initialDryKg;
const strong=structuredClone(w);for(const x of strong.settlement.projects[0].parts)x.durability.quality=.9;
advanceStructures(w,86400);advanceStructures(strong,86400);assert(structurePerformance(p).condition<structurePerformance(strong.settlement.projects[0]).condition,'poor work wears faster under identical weather');
const store=w.settlement.stores.find(s=>s.id===p.storeId),strongStore=strong.settlement.stores.find(s=>s.id===p.storeId);assert(store.capacityKg<strongStore.capacityKg);assert(store.coverage<strongStore.coverage);
assert(coverEffectiveness(w,{x:p.position.x,y:p.position.y})<coverEffectiveness(strong,{x:p.position.x,y:p.position.y}));
// A leaking roof changes real wetting of conserved stored wood.
const damp=(coverage)=>{const q=fresh(),agent=q.agents[0];q.weather='rain';const s=makeStore(q,{position:agent.coordinates,covered:true});s.coverage=coverage;gatherWood(q,agent,'dryWood',2);woodCommand(q,agent,{to:{kind:'stored',id:s.id},quantity:2,category:'dryWood',reason:'fixture stores supplies'});advanceWood(q,q.wood.lastHour+4);return q.wood.batches.filter(b=>b.holder.id===s.id).reduce((n,b)=>n+b.waterKg,0);};
assert(damp(.2)>damp(.9),'better roofing has a material benefit, not only a label');
const bridgeRaw={build:true,name:'Branch crossing',purpose:'cross the creek',siteId:'crossing-48',rationale:'A route to the other bank.',code:Array.from({length:5},(_,i)=>`part(${JSON.stringify({id:'deck-'+i,kind:'deck',material:'timber',center:[0,.1,2.4-i*1.2],size:[1.4,.2,1.2],requires:i?['deck-'+(i-1)]:[]})});`).join('\n')};
const bw=fresh(),ba=bw.agents[0];ba.coordinates={x:48,y:24};const bridge=built(bw,bridgeRaw),middle={...bridge.position};ba.coordinates={x:48,y:bridge.position.y+4};ba.inventory.stones=12;
assert(liveRoute(bw,ba.coordinates,{x:48,y:bridge.position.y-4}),'unloaded geometric route exists');assert(!liveRoute(bw,ba.coordinates,{x:48,y:bridge.position.y-4},ba),'actor carrying a load beyond the rating cannot route onto it');
noteCargoLimits(bw,ba);assert(Object.values(bridge.observations).some(o=>o.kind==='load-limit'));const memory=ba.memories.length;noteCargoLimits(bw,ba);assert.equal(ba.memories.length,memory,'repeated checks do not spam memories');
for(const part of bridge.parts){part.finish='hewn';part.durability.quality=.9;}
assert(liveRoute(bw,ba.coordinates,{x:48,y:bridge.position.y-4},ba),'stronger workmanship supports the same real carried load');
recordCrossingWear(bw,ba,{x:48,y:bridge.position.y+.5},middle);assert(bridge.parts.some(x=>x.durability.useWear>0),'actual traversal causes wear');
// Close a critically weakened crossing to entrants, let its occupant get off,
// then withdraw failed support. No teleport or scripted drowning.
ba.coordinates={...middle};for(const part of bridge.parts)part.durability.condition=.13;advanceStructures(bw,86400);assert(bridge.closing);assert(onDeck(bw,middle,ba));const visitor={...ba,id:'visitor',coordinates:{x:48,y:bridge.position.y+4}};assert(!onDeck(bw,middle,visitor));ba.coordinates={...visitor.coordinates};advanceStructures(bw,60);assert(!onDeck(bw,middle));assert(bridge.parts.some(x=>conditionOf(x)===0));
// Physical repair consumes supplies at the component and survives interruption.
a.coordinates={x:66,y:36};p.parts[0].durability.condition=.4;gatherWood(w,a,'dryWood',2);const beforeMass=totals(w.wood).dryKg;
let choice=settlementCandidates(w,a).find(c=>c.job?.kind==='repair');assert(choice);const task={selected:choice,workMinutes:0,requiredMinutes:choice.job.minutes};const bad=workSettlement(w,a,task,1);assert.equal(bad.success,false,'remote repair refused');assert.equal(p.parts[0].durability.condition,.4);
a.coordinates={...choice.job.destination};workSettlement(w,a,task,1);assert(p.repair.invested);assert.equal(p.parts[0].durability.condition,.4,'supplies alone do not repair it');
const saved=prepare(JSON.parse(JSON.stringify(w)));assert.deepEqual(saved.settlement.projects[0].repair,p.repair,'partial repair survives reload');
const result=workSettlement(w,a,task,20);assert(result.success);assert.equal(p.parts[0].durability.condition,1);assert.equal(p.parts[0].repairs,1);assert.equal(totals(w.wood).dryKg,beforeMass);assert.equal(w.wood.initialDryKg,initial,'no new material was introduced');
store.items.berries=3;for(const x of p.parts)if(x.kind==='deck'||x.kind==='roof')x.durability.condition=0;advanceStructures(w,60);assert.equal(store.capacityKg,0);assert.equal(store.items.berries,3,'failed storage preserves possessions');assert.equal(roomFor(w,store,'berries'),0);assert.equal(store.coverage,0);
const context=designContext(w,a);assert(context.projects[0].performance.condition===0);assert(context.projects[0].id===p.id);
requestMaintenance(w,a,p.id,'Recover useful storage');assert(p.maintenanceRequested);assert.equal(p.parts.find(x=>x.kind==='deck').durability.condition,0,'a model request is not a free repair');
const site=buildingSites(w,a).find(s=>!s.spansWater);const replacement=validateBlueprint(w,a,{...example,build:true,siteId:site.id,replacesProjectId:p.id});assert.equal(replacement.replacesProjectId,p.id);assert.throws(()=>validateBlueprint(w,a,{...example,build:true,siteId:site.id,replacesProjectId:'missing'}),/Replacement/);
const legacy=structuredClone(w);for(const part of legacy.settlement.projects[0].parts)delete part.durability;advanceStructures(legacy,60);assert(legacy.settlement.projects[0].parts.every(x=>x.durability.origin==='legacy-estimate'&&x.durability.condition>.99),'existing structures activate now, without invented historical damage');
console.log('PASS quality-dependent decay/capacity/roof wetting, cargo-aware routing, real use wear, safe closure, physical repair/reload/conservation, preserved failed-store contents and design feedback');
