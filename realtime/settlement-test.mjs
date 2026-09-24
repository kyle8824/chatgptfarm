import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createWorld,relationship} from '../engine/core.js';
import {prepare,step} from './elapsed.mjs';
import {shelterPoint} from './layout.mjs';
import {liveRoute,advanceLiveRoute,liveWalkable,BODY_DISTANCE} from './motion.mjs';
import {distance} from '../engine/navigation.js';
import {validateBlueprint,adoptBlueprint,buildingSites} from './blueprints.mjs';
import {makeStore,transferItems,loadOf,enforceCarry,ensureSettlement,treeUnits} from './holdings.mjs';
import {settlementCandidates,workSettlement,noticeMissingSupplies} from './settlement.mjs';
import {totals} from '../engine/wood-materials.js';
import {liveCandidates} from './behavior.mjs';
const fresh=()=>{const w=prepare(createWorld());w.temperature=65;w.weather='clear';w.structures.shelter=true;for(const [i,a]of w.agents.entries()){a.coordinates={x:66+i*4,y:36};a.needs={hunger:95,hydration:95,energy:95,warmth:80};a.task=null;a.suspendedTasks=[];}return w;};
export const chestDesign={build:true,name:'Raised personal supplies chest',purpose:'storage',siteId:'clearing-0',access:'private',rationale:'Keep a finite supply of materials and food near camp in an owned covered container.',parts:[
 {id:'floor',kind:'deck',material:'timber',center:[0,.1,0],size:[1.4,.2,1.2],requires:[]},
 {id:'left',kind:'wall',material:'timber',center:[-.65,.6,0],size:[.1,.8,1.2],requires:['floor']},
 {id:'right',kind:'wall',material:'timber',center:[.65,.6,0],size:[.1,.8,1.2],requires:['floor']},
 {id:'back',kind:'wall',material:'timber',center:[0,.6,-.55],size:[1.4,.8,.1],requires:['floor']},
 {id:'front',kind:'wall',material:'timber',center:[0,.6,.55],size:[1.4,.8,.1],requires:['floor']},
 {id:'lid',kind:'roof',material:'timber',center:[0,1.05,0],size:[1.4,.1,1.2],requires:['left','right','back','front']}
]};
export const bridgeDesign={build:true,name:'Creek crossing',purpose:'bridge',siteId:'crossing-48',access:'shared',rationale:'Reach the north bank using a deck built outward from the south bank.',parts:Array.from({length:5},(_,i)=>({id:`deck-${i}`,kind:'deck',material:'timber',center:[0,.1,2.4-i*1.2],size:[1.4,.2,1.2],requires:i?[`deck-${i-1}`]:[]}))};
// Recreate the video: a stationary person closes the direct shelter exit.
const traffic=fresh(),[walker,blocker]=traffic.agents;walker.coordinates=shelterPoint(0,.6);blocker.coordinates=shelterPoint(0,-.7);const goal={x:59,y:29};walker.locomotion=null;blocker.locomotion=null;
const task={actionId:'gather_dry_wood',targetPosition:'log',destination:goal,path:liveRoute(traffic,walker.coordinates,goal),pathIndex:1,phase:'travel'};
let min=Infinity,steps=0;const points=[];for(;steps<1400;steps++){const r=advanceLiveRoute(traffic,walker,task,.1);points.push({...walker.coordinates});min=Math.min(min,distance(walker.coordinates,blocker.coordinates));if(r.arrived)break;assert(!r.blocked);}
assert(distance(walker.coordinates,goal)<.2,'walk out through the other opening and around the shelter');assert(min>=BODY_DISTANCE);assert(task.detours>0,'dynamic body-aware detour was used');
// Existing items survive finite carry migration. Transfers conserve quantities.
const storage=fresh(),[owner,taker]=storage.agents;owner.inventory.stones=30;enforceCarry(storage,owner);assert(loadOf(storage,owner).mass<=18);assert.equal(owner.inventory.stones+storage.settlement.stores.reduce((n,s)=>n+(s.items.stones||0),0),30);
ensureSettlement(storage);const old=JSON.stringify(storage.settlement);ensureSettlement(storage);assert.equal(JSON.stringify(storage.settlement),old,'migration is idempotent');
const pile=makeStore(storage,{position:{x:42,y:35},ownerId:owner.id,name:'Owned food',capacityKg:2,capacityVolume:4});owner.inventory.berries=6;assert.equal(transferItems(storage,owner,pile,'berries',6),6);assert.equal(transferItems(storage,owner,pile,'stones',5),0,'finite container rejects oversized load');
taker.coordinates={x:42,y:36.15};taker.needs.hunger=3;taker.inventory.berries=0;owner.coordinates={x:42,y:38};const trust=relationship(storage,owner,taker).trust,shareScore=()=>liveCandidates(storage,owner,[{id:'share_food',label:'Share',score:100}]).find(c=>c.id==='share_food').score,beforeSharing=shareScore();
let choice=settlementCandidates(storage,taker).find(c=>c.job?.theft);assert(choice,'desperation can overcome an ownership norm');const theftTask={selected:choice,workMinutes:0,requiredMinutes:.5};taker.coordinates={...choice.job.destination};const theft=workSettlement(storage,taker,theftTask,.5);assert(theft.success);assert.equal(taker.inventory.berries,2);assert(relationship(storage,owner,taker).trust<trust,'witnessed theft changes trust');assert(shareScore()<beforeSharing-20,'distrust changes willingness to share, not only a displayed number');
pile.secured=true;assert(!settlementCandidates(storage,taker).some(c=>c.job?.theft),'secured storage prevents unauthorized taking');pile.secured=false;owner.coordinates={x:5,y:60};taker.inventory.berries=0;choice=settlementCandidates(storage,taker).find(c=>c.job?.theft);taker.coordinates={...choice.job.destination};const before=relationship(storage,owner,taker).trust;workSettlement(storage,taker,{selected:choice,workMinutes:0,requiredMinutes:.5},.5);assert.equal(relationship(storage,owner,taker).trust,before,'no unseen blame');owner.coordinates={...pile.position};noticeMissingSupplies(storage,owner);assert(owner.memories.some(m=>m.text.includes('did not see who')));
// Validate novel programs, not a prefab lookup. Bad programs have no effects.
const world=fresh();world.agents=world.agents.slice(0,1);const a=world.agents[0],beforeBad=JSON.stringify(world);
assert.throws(()=>validateBlueprint(world,a,{...chestDesign,parts:[{...chestDesign.parts[0],center:[0,3,0]},...chestDesign.parts.slice(1)]}),/Floating/);assert.equal(JSON.stringify(world),beforeBad);
assert.throws(()=>validateBlueprint(world,a,{...chestDesign,parts:chestDesign.parts.map((p,i)=>i? p:{...p,size:[NaN,.2,1]})}));
const panelled=structuredClone(chestDesign);panelled.parts.splice(0,1,...[-1,1].map((side,i)=>({id:`floor-${i}`,kind:'deck',material:'timber',center:[side*.35,.1,0],size:[.7,.2,1.2],requires:[]})));for(const part of panelled.parts.filter(x=>x.kind==='wall'))part.requires=part.id==='left'?['floor-0']:part.id==='right'?['floor-1']:['floor-0','floor-1'];
const design=validateBlueprint(world,a,panelled),single=validateBlueprint(world,a,chestDesign);assert.equal(design.capacityVolume,single.capacityVolume,'panelled floor has full enclosure capacity');assert(design.secured);const gap=structuredClone(panelled);gap.parts[0].size[0]=.4;assert.throws(()=>validateBlueprint(world,a,gap),/continuous|touch/,'floor holes cannot create storage');
const multipleErrors=structuredClone(chestDesign);multipleErrors.parts[0].center[1]=3;multipleErrors.parts[1].center[0]=-2;assert.throws(()=>validateBlueprint(world,a,multipleErrors),e=>e.message.includes('Floating')&&e.message.includes('outside site')&&e.message.includes('does not touch'),'one repair gets all measured errors');
const project=adoptBlueprint(world,a,design,'fixture-model');assert(project.parts.every(x=>!x.built));assert.equal(world.settlement.stores.find(s=>s.id===project.stockpileId).items.dryWood||0,0,'planning grants no free materials');
const materialBefore=totals(world.wood).dryKg;let lastBuilt=0,harvested=false,carried=false,progress=false,midBuild=null;let count=0;
for(;count<26000&&project.status!=='complete';count++){
 await step(world,.6);const built=project.parts.filter(p=>p.built).length;assert(built-lastBuilt<=1,'parts appear incrementally');lastBuilt=built;
 harvested ||=world.settlement.trees.some(t=>treeUnits(world,t)<t.initialUnits);carried ||=a.inventory.dryWood+a.inventory.wetWood>0;progress ||=project.parts.some(p=>p.workMinutes>0&&!p.built);
 if(!midBuild&&lastBuilt>=2&&project.parts.some(p=>p.workMinutes>.5&&!p.built))midBuild=structuredClone(world);
 assert(loadOf(world,a).mass<=18.01&&loadOf(world,a).volume<=24.01,'every integrated action respects carry limits');
}
assert.equal(project.status,'complete',JSON.stringify({count,task:a.task,parts:project.parts,inventory:a.inventory,needs:a.needs,events:world.history.slice(0,5)}));assert(harvested&&carried&&progress);assert(Math.abs(totals(world.wood).dryKg+world.wood.sinks.reduce((n,s)=>n+s.dryKg,0)-materialBefore)<1e-6,'construction retains wood mass');assert(world.settlement.stores.find(s=>s.id===project.storeId)?.secured,'completed enclosure creates usable finite protected storage');
const restarted=prepare(JSON.parse(JSON.stringify(world)));assert.deepEqual(restarted.settlement,world.settlement,'all designs, parts, storage and ownership survive checkpoint-style restart');
// A large component plus old possessions must not cause fetch/deposit loops.
const loaded=fresh();loaded.agents=loaded.agents.slice(0,1);const builder=loaded.agents[0];builder.inventory.stones=8;builder.inventory.clay=3;builder.inventory.firedVessel=1;
const large=structuredClone(chestDesign);large.parts[0].size=[4,.2,1.5];for(const part of large.parts.slice(1)){if(['left','right'].includes(part.id)){part.center[0]=part.id==='left'?-1.95:1.95;part.size[2]=1.5;}else if(['front','back'].includes(part.id)){part.center[2]=part.id==='front'?.70:-.70;part.size[0]=4;}else part.size=[4,.1,1.5];}
const heavy=adoptBlueprint(loaded,builder,validateBlueprint(loaded,builder,large),'fixture-model');assert.equal(heavy.parts[0].materialUnits,6);
for(let i=0;i<24000&&heavy.status!=='complete';i++)await step(loaded,.6);assert(heavy.status==='complete',JSON.stringify({task:builder.task,inventory:builder.inventory,stores:loaded.settlement.stores}));assert(loaded.settlement.stores.some(s=>(s.items.stones||0)>0),'unrelated cargo is stored to make room');
const chest=world.settlement.stores.find(s=>s.id===project.storeId);world.resources.stones-=3;a.inventory.stones+=3;a.needs={hunger:95,hydration:95,energy:95,warmth:95};a.task=null;for(let i=0;i<1200&&chest.items.stones!==3;i++)await step(world,.6);assert.equal(chest.items.stones,3,'villager visits and physically populates the completed chest');
// A fully built bridge changes walkability; its plan alone never does.
const bridgeWorld=fresh();bridgeWorld.agents=bridgeWorld.agents.slice(0,1);bridgeWorld.agents[0].coordinates={x:48,y:24};const b=adoptBlueprint(bridgeWorld,bridgeWorld.agents[0],validateBlueprint(bridgeWorld,bridgeWorld.agents[0],bridgeDesign),'fixture-model');
const middle={...b.position};assert(!liveWalkable(bridgeWorld,middle));for(let i=0;i<26000&&b.status!=='complete';i++)await step(bridgeWorld,.6);assert.equal(b.status,'complete',JSON.stringify({parts:b.parts,task:bridgeWorld.agents[0].task}));assert(liveWalkable(bridgeWorld,middle));assert(liveRoute(bridgeWorld,{x:48,y:b.position.y+4},{x:48,y:b.position.y-4}),'real traversable crossing');
await fs.mkdir('realtime-qa',{recursive:true});await fs.writeFile('realtime-qa/settlement-fixture.json',JSON.stringify({world,midBuild,bridge:bridgeWorld,traffic:{steps,min,detours:task.detours}},null,2));
console.log(JSON.stringify({result:'PASS doorway obstruction, finite carry/storage, conservation, witnessed/unseen theft, secured storage, blueprint validation, gathering/hauling/assembly, restart, usable bridge',trafficSteps:steps,minimumSeparation:min,constructionSteps:count,woodMass:materialBefore,parts:project.parts.length}));
