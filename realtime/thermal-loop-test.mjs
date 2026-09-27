import assert from 'node:assert/strict';
import {createWorld} from '../engine/core.js';
import {distance} from '../engine/navigation.js';
import {householdWorld,homeAccount} from '../shared/frontier.js';
import {totals} from '../engine/wood-materials.js';
import {woodCommand} from '../engine/wood-runtime.js';
import {prepare,step} from './elapsed.mjs';
import {expandFrontier} from './frontier.mjs';
import {reorganizeLandscape} from './landscape-migration.mjs';
import {ensureCampDryingStores,syncHoldings,treeUnits} from './holdings.mjs';
import {observeLandscape} from './frontier-knowledge.mjs';
import {returnCandidate,advanceThermalReturn,updateThermalGoal} from './thermal-return.mjs';

function fixture(name){
 const w=prepare(createWorld());expandFrontier(w);reorganizeLandscape(w);
 const a=w.agents.find(a=>a.name===name);w.agents=[a];
 const h=w.frontier.homes.find(h=>h.id==='ochre-vale');h.structures.shelter=true;h.structures.fire=false;
 a.campId=h.id;a.knownCamps=[h.id];a.coordinates={x:-338,y:-318};a.position='travel';
 a.needs={hunger:name==='Elin'?47:71,hydration:85,energy:name==='Elin'?48:91,warmth:0};a.task=null;a.suspendedTasks=[];a.locomotion=null;a.inventory.berries=a.inventory.tubers=a.inventory.cookedMeat=0;
 w.weather='clear';w.temperature=61;w.liveWeatherUntil=w.day*24+w.hour+6;
 // Recreate the observed finite cargo and a drying pile packed with poles.
 for(const b of w.wood.batches)if(b.form==='branch')b.waterKg=b.dryKg*.55;
 ensureCampDryingStores(w);const v=householdWorld(w,a),store=w.settlement.stores.find(s=>s.id===homeAccount(v,'camp-drying'));
 woodCommand(v,a,{from:{kind:'ground',id:homeAccount(v,'log')},quantity:2,reason:'observed carried wet branches'});
 let left=22;for(const tree of w.settlement.trees){woodCommand(v,a,{from:{kind:'ground',id:tree.id},to:{kind:'stored',id:store.id},quantity:Math.min(left,treeUnits(w,tree)),outputForm:'pole',reason:'finite fixture construction stock'});syncHoldings(w);left=22-store.items.woodPole;if(!left)break;}
 assert.equal(store.items.woodPole,22);store.items.longFiber=1;store.items.cordage=1;syncHoldings(w);
 observeLandscape(w,a);a.thermalGoal={campId:h.id,startedAt:0};
 const site=w.regions.sites[h.id+':woodland-berries'];a.siteKnowledge={[site.id]:{quantity:site.quantity,observedHour:w.day*24+w.hour}};
 a.task={id:'observed-forage',actionId:'forage:'+site.id,label:'Gather woodland berries',selected:{id:'forage:'+site.id,label:'Gather woodland berries'},targetPosition:site.id,origin:{...a.coordinates},phase:'travel',source:'fallback',workMinutes:0,requiredMinutes:4,liveTiming:true};
 return {w,a,h,site,store};
}

// A first real return is allowed. A completed visit is remembered through a
// checkpoint, without making heat or granting knowledge of a remote fire.
let {w,a,h}=fixture('Kellan');a.coordinates={x:h.x-25,y:h.y};
assert(returnCandidate(householdWorld(w,a),a));
a.coordinates={x:h.x-5,y:h.y};const warmth=a.needs.warmth;
assert(advanceThermalReturn(householdWorld(w,a),a,{selected:{job:{campId:h.id}}},.6).done);
assert.equal(a.needs.warmth,warmth);
w=prepare(JSON.parse(JSON.stringify(w)));a=w.agents[0];h=w.frontier.homes.find(h=>h.id==='ochre-vale');
a.coordinates={x:h.x-30,y:h.y};assert.equal(returnCandidate(householdWorld(w,a),a),null,'unchanged unheated shelter must not restart the same return');
h.structures.fire=true;assert.equal(returnCandidate(householdWorld(w,a),a),null,'unseen heat is not known');
a.coordinates={x:h.x-5,y:h.y};observeLandscape(w,a);a.coordinates={x:h.x-30,y:h.y};assert(returnCandidate(householdWorld(w,a),a),'observed new heat justifies returning');
h.structures.fire=false;a.coordinates={x:h.x-5,y:h.y};observeLandscape(w,a);a.coordinates={x:h.x-30,y:h.y};
w.weather='rain';assert(returnCandidate(householdWorld(w,a),a),'worse exposure permits a fresh shelter visit');
a.needs.warmth=45;updateThermalGoal(w,a);assert(!a.thermalGoal,'actual recovery ends the episode');

// Both reported villagers start on the observed food trip beyond the old
// 45-unit exception. They must finish useful handling and obtain finite food.
for(const name of ['Elin','Kellan']){
 let {w,a,h,site}=fixture(name);const foodStock=()=>Object.values(w.regions.sites).reduce((n,s)=>n+s.quantity,0)+w.frontier.homes.reduce((n,h)=>n+(h.resources?.berries||0),0),initial=foodStock(),wood=totals(w.wood).dryKg;let returns=0,prior=null,gathered=false,walked=0,restoredCargo=false;
 for(let i=0;i<1600;i++){
  const from={...a.coordinates};await step(w,6);const moved=distance(from,a.coordinates);walked+=moved;assert(moved<5,'movement must remain elapsed and physical');
  if(a.task?.id!==prior&&a.task?.actionId.startsWith('return_warmth:'))returns++;prior=a.task?.id;
  if(a.dryingClearance&&!restoredCargo){const cargo=structuredClone(a.dryingClearance);w=prepare(JSON.parse(JSON.stringify(w)));a=w.agents[0];assert.deepEqual(a.dryingClearance,cargo);restoredCargo=true;}
  if(i===300){w=prepare(JSON.parse(JSON.stringify(w)));a=w.agents[0];site=w.regions.sites[site.id];}
  if(a.inventory.berries>0){gathered=true;break;}
 }
 if(!gathered)console.log(JSON.stringify({name,returns,needs:a.needs,task:a.task,history:w.history.slice(-12),inventory:a.inventory,failures:a.liveFailures,goal:a.thermalGoal},null,2));
 assert(gathered,name+' must complete actual foraging');assert(foodStock()<initial,'berries are taken from finite resources');assert.equal(totals(w.wood).dryKg,wood,'handling conserves wood mass');const drying=w.settlement.stores.find(s=>s.id===h.id+':camp-drying');assert.equal(drying.items.woodPole,20);assert(drying.items.wetWood>=2,'fuel is physically deposited in the cleared space');assert(w.settlement.stores.some(s=>s.ownerId===a.id&&s.items.woodPole===2&&!s.covered),'cleared construction stock remains in a real ground pile');assert(!a.dryingClearance);assert(restoredCargo);assert(returns<=1,name+' must not repeatedly return to unchanged protection');
 console.log(JSON.stringify({name,returns,walked,berries:a.inventory.berries,warmth:a.needs.warmth}));
}
console.log('PASS remembered physical protection visits, changed conditions, checkpoint persistence and Elin/Kellan finite foraging');
