import assert from 'node:assert/strict';
import {createWorld,finishHour} from '../engine/core.js';
import {distance} from '../engine/navigation.js';
import {prepare,step} from './elapsed.mjs';
import {expandFrontier} from './frontier.mjs';
import {reorganizeLandscape} from './landscape-migration.mjs';
import {makeStore,transferItems} from './holdings.mjs';
import {advancePlantGrowth,REED_GROWTH_SECONDS} from './plant-growth.mjs';
import {harvestSite,resourceFrame} from './resource-sites.mjs';
import {validateBlueprint,adoptBlueprint,designContext} from './blueprints.mjs';
import {settlementCandidates,workSettlement} from './settlement.mjs';
import {supplyTripCandidate,advanceSupplyJourney} from './supply-journey.mjs';
import {rememberFailure,resumeLiveTask} from './behavior.mjs';
import {configureTask,liveWalkable} from './motion.mjs';
import {bindingLength,bindingBudget} from '../shared/craft.js';
import {progressText,progressRatio} from '../web/live/task-view.js';

function fixture(){
 const w=prepare(createWorld()),a=w.agents[0];w.agents=[a];a.coordinates={x:66,y:36};a.needs={hunger:98,hydration:98,energy:98,warmth:98};a.task=null;a.suspendedTasks=[];
 w.weather='clear';w.temperature=65;w.liveWeatherUntil=w.day*24+w.hour+6;
 const p=adoptBlueprint(w,a,validateBlueprint(w,a,{build:true,name:'Four small reed panels',purpose:'bedding',rationale:'A small useful start with finite supplies.',siteId:'clearing-0',access:'private',code:"for(let i=0;i<4;i++)part({id:'mat'+i,kind:'deck',material:'reeds',center:[i%2-.5,.04,Math.floor(i/2)-.5],size:[1,.08,1],requires:[]});"}),'isolated-supply-test');
 return {w,a,p,stock:w.settlement.stores.find(s=>s.id===p.stockpileId)};
}
// Every reed/fiber bed regrows gradually; minerals do not. No past-time refill.
{
 const w=prepare(createWorld());expandFrontier(w);reorganizeLandscape(w);w.temperature=65;w.weather='rain';w.resources.reeds=0;
 const reed=w.resourceSites.nodes.find(n=>n.item==='reeds'),fiber=w.resourceSites.nodes.find(n=>n.item==='longFiber'),stone=w.resourceSites.nodes.find(n=>n.item==='stones');
 for(const n of [reed,fiber,stone])harvestSite(w,n.id,n.remaining);
 const oldStone={...stone};advancePlantGrowth(w,6);assert.equal(w.resources.reeds,0);assert.equal(reed.remaining,0);
 advancePlantGrowth(w,REED_GROWTH_SECONDS/2);const restored=prepare(JSON.parse(JSON.stringify(w)));
 advancePlantGrowth(w,REED_GROWTH_SECONDS/2);advancePlantGrowth(restored,REED_GROWTH_SECONDS/2);
 assert.deepEqual(restored.plantGrowth,w.plantGrowth);assert.equal(reed.remaining,1);assert.equal(fiber.remaining,1);assert.equal(w.resources.reeds,1);assert.deepEqual(stone,oldStone);
 assert.equal(reed.initial+reed.regrown,reed.remaining+reed.harvested);assert(resourceFrame(w).find(n=>n.id===fiber.id).renewable);
 const before=reed.remaining;w.temperature=25;advancePlantGrowth(w,REED_GROWTH_SECONDS*10);assert.equal(reed.remaining,before);
 w.temperature=65;advancePlantGrowth(w,REED_GROWTH_SECONDS*1000);assert.equal(reed.remaining,reed.initial);assert.equal(fiber.remaining,fiber.initial);assert.equal(w.resources.reeds,18);
 w.resources.reeds=0;w.hour=23;finishHour(w,{needs:false,wood:false,ecology:false});assert.equal(w.resources.reeds,0,'midnight does not add a second reed regrowth mechanism');
}
// Four cut panels use the same total cord as one full panel, and the cut
// remainder persists at the actual project through interruption and reload.
{
 let {w,a,p}=fixture();assert.equal(p.parts.reduce((n,x)=>n+bindingLength(x),0),bindingLength({...p.parts[0],size:[2,.08,2]}));
 a.inventory.reeds=4;a.inventory.cordage=1;
 assert.equal(bindingBudget(p).coilsNeeded,1);assert.equal(designContext(w,a).projects[0].bindings.coilsNeeded,1);
 for(let i=0;i<4;i++){
  const c=settlementCandidates(w,a).find(x=>x.job?.kind==='assemble');assert(c,'a cut remainder should support the next panel');a.coordinates={...c.job.destination};
  const t={selected:c,requiredMinutes:7,workMinutes:0};assert(!workSettlement(w,a,t,1).done);
  const savedCord=a.inventory.cordage,savedStock=p.bindingStockMm;
  w=prepare(JSON.parse(JSON.stringify(w)));a=w.agents[0];p=w.settlement.projects[0];
  assert(workSettlement(w,a,t,10).success);assert.equal(a.inventory.cordage,savedCord);assert.equal(p.bindingStockMm,savedStock,'resuming an invested panel consumes no second binding');
 }
 assert.equal(p.status,'complete');assert.equal(a.inventory.reeds,0);assert.equal(a.inventory.cordage,0);assert.equal(p.bindingCoilsOpened,1);assert.equal(p.bindingStockMm,800);assert.equal(p.parts.reduce((n,x)=>n+x.bindingLengthMm,0)+p.bindingStockMm,4000);
}
// An existing site rack can provide crafting input. Local craft takes priority
// over walking far for a finished coil; multiple-coil panels fetch their deficit.
{
 const {w,a,p,stock}=fixture();a.inventory.cordage=0;a.inventory.reeds=0;
 stock.items.reeds=3;let c=settlementCandidates(w,a).find(x=>x.job?.kind==='take'&&x.job.storeId===stock.id);assert(c);assert.equal(c.job.quantity,3);
 const remote=makeStore(w,{position:{x:10,y:40},ownerId:null,access:'shared'});remote.items.cordage=4;a.inventory.reeds=3;
 assert(settlementCandidates(w,a).some(x=>x.job?.kind==='craft'&&x.job.item==='cordage'));
 assert(!settlementCandidates(w,a).some(x=>x.job?.kind==='supply_trip'));
 p.parts=p.parts.slice(0,1);p.parts[0].size=[3,.08,3];a.inventory.cordage=1;stock.items.cordage=1;
 c=settlementCandidates(w,a).find(x=>x.job?.kind==='take'&&x.job.item==='cordage');assert(c);assert.equal(c.job.quantity,1);
}
// Real outbound and return movement, finite source transfer, saved collection
// progress, no second pickup after reload, and correct ownership/knowledge.
let totalWalked=0;
{
 let {w,a,p,stock}=fixture();w.settlement.trees=[];a.inventory.reeds=0;a.inventory.cordage=0;
 const sourceStore=makeStore(w,{position:{x:10,y:40},ownerId:null,access:'shared'});sourceStore.items.longFiber=2;
 const source={kind:'take',storeId:sourceStore.id,item:'longFiber',position:sourceStore.position};
 const c=supplyTripCandidate(w,a,p,source,1);assert(c);
 a.task={id:'persistent-supply-test',actionId:c.id,label:c.label,selected:c,phase:'planning',requiredMinutes:30,workMinutes:0};configureTask(w,a);
 let picked=false,complete=false;
 for(let i=0;i<700;i++){
  const before={...a.coordinates},t=a.task,expanded=t.supplyJourney?.search?.expanded||0;
  const r=await advanceSupplyJourney(w,a,t,6);const moved=distance(before,a.coordinates);totalWalked+=moved;
  assert(moved<5,'supplies move with the body, never by teleport');assert(liveWalkable(w,a.coordinates));
  if(t.supplyJourney?.search)assert(t.supplyJourney.search.expanded-expanded<=8,'routing spends bounded work per step');
  if(!picked&&t.supplyJourney?.stage==='return'){
   picked=true;assert.equal(a.inventory.longFiber,1);assert.equal(w.settlement.stores.find(s=>s.id===sourceStore.id).items.longFiber,1);
   w=prepare(JSON.parse(JSON.stringify(w)));a=w.agents[0];p=w.settlement.projects[0];stock=w.settlement.stores.find(s=>s.id===p.stockpileId);
   const pending=a.task;a.task=null;a.suspendedTasks=[pending];assert(resumeLiveTask(w,a,null),'a remembered trip resumes even away from the project');assert.equal(a.task.id,'persistent-supply-test');
  }
  if(r.done){assert.equal(r.success,true,r.detail);complete=true;break;}
 }
 assert(picked&&complete,'physically fetch known supplies and return');assert(distance(a.coordinates,stock.position)<2.5);assert.equal(a.inventory.longFiber,1);assert.equal(w.settlement.stores.find(s=>s.id===sourceStore.id).items.longFiber,1);
 assert.match(progressText({task:a.task}),/building site/);assert.equal(progressRatio({task:a.task}),0,'no invented percentage for an open-ended trip');
 // Supply failure is cooled down; unrelated sources remain eligible.
 rememberFailure(w,a,a.task,'isolated blocked source');assert.equal(supplyTripCandidate(w,a,p,source,1),null);
 delete a.liveFailures[c.id];const privateSource=w.settlement.stores.find(s=>s.id===sourceStore.id);privateSource.ownerId='someone-else';privateSource.access='private';assert.equal(supplyTripCandidate(w,a,p,source,1),null);
 const unknown=w.resourceSites.nodes.find(n=>n.item==='reeds');unknown.knownBy=[];a.coordinates={x:80,y:45};assert.equal(supplyTripCandidate(w,a,p,{kind:'gather',nodeId:unknown.id,item:'reeds',position:unknown.position},1),null);
}
// Full elapsed loop: interrupt a real material expedition for food, resume its
// return, deliver to the rack, then physically assemble the supplied panels.
{
 let {w,a,p}=fixture();w.settlement.trees=[];w.resources.reeds=0;
 for(const n of w.resourceSites.nodes)if(n.item==='reeds')harvestSite(w,n.id,n.remaining);
 a.inventory.reeds=0;a.inventory.cordage=1;a.inventory.berries=2;
 const supply=makeStore(w,{position:{x:10,y:40},ownerId:null,access:'shared'});supply.items.reeds=4;
 let interrupted=false,resumed=false,journeyId=null,saved=false;
 for(let i=0;i<1300&&p.status!=='complete';i++){
  if(i===12)a.needs.hunger=11;
  const from={...a.coordinates};await step(w,6);assert(distance(from,a.coordinates)<5);
  if(a.task?.selected?.job?.kind==='supply_trip'){journeyId??=a.task.id;if(interrupted&&a.task.id===journeyId)resumed=true;}
  if(a.task?.actionId==='eat_berries'&&a.suspendedTasks.some(t=>t.id===journeyId))interrupted=true;
  if(!saved&&a.task?.supplyJourney?.stage==='return'){saved=true;w=prepare(JSON.parse(JSON.stringify(w)));a=w.agents[0];p=w.settlement.projects[0];}
 }
 assert(journeyId&&interrupted&&resumed&&saved,'meal interrupts and the saved supply journey resumes');
 assert.equal(p.status,'complete',a.currentAction);assert.equal(w.settlement.stores.find(s=>s.id===supply.id).items.reeds,0);assert.equal(p.parts.reduce((n,x)=>n+(x.materials?.reeds||0),0),4);
}
// The ordinary autonomous loop turns one real long-fiber input into a coil,
// assembles the four panels and consumes no extra coils or invented materials.
{
 const {w,a,p}=fixture();a.inventory.longFiber=1;a.inventory.reeds=4;a.inventory.cordage=0;
 let steps=0;for(;steps<1100&&p.status!=='complete';steps++)await step(w,6);
 assert.equal(p.status,'complete',a.currentAction);assert.equal(a.inventory.longFiber,0);assert.equal(p.bindingCoilsOpened,1);assert.equal(p.parts.filter(x=>x.built).length,4);
 assert.equal(p.bindingStockMm,800);assert.equal(p.parts.reduce((n,x)=>n+(x.materials?.reeds||0),0),4);
 console.log(JSON.stringify({result:'PASS renewable finite plants, mineral depletion, cold growth stop, measured bindings, saved remainder, stored inputs, bounded physical round trip, checkpoint/resume, no duplicate pickup, source permissions, and autonomous four-panel construction',steps,totalWalked}));
}
