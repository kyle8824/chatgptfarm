import {distance} from '../engine/navigation.js';
import {homeAccount,campLayout} from '../shared/frontier.js';
import {clock,roomFor} from './holdings.mjs';
import {findMaterialSource,interactionPoint} from './settlement.mjs';

// A cold person needs executable preparation, not just a wish for an already
// lit fire. These jobs use the ordinary finite gathering/handling machinery.
export function coldPreparationCandidates(w,a){
 if(a.needs.warmth>=40||w.structures.fire||!w.settlement)return [];
 const result=[],raw=(a.inventory.dryWood||0)+(a.inventory.wetWood||0),camp=campLayout(w);
 const blocked=id=>a.liveFailures?.[id]&&clock(w)-a.liveFailures[id].at<a.liveFailures[id].retryMinutes;
 const offer=(id,label,job,position,score=132)=>{
  if(blocked(id))return false;
  const destination=interactionPoint(w,a,position,{radius:1.15});if(!destination)return false;
  result.push({id,label,score:score-distance(a.coordinates,destination)*.18,reasons:[['prepare real protection from the cold',score]],job:{...job,coldPreparation:true,destination,position}});return true;
 };
 const stores=w.settlement.stores.filter(s=>s.kind!=='site'&&(s.ownerId===a.id||s.access==='shared'||!s.ownerId)&&(s.id===homeAccount(w,'camp-drying')||a.landmarks?.[s.id]||s.ownerId===a.id||distance(a.coordinates,s.position)<9)&&distance(a.coordinates,s.position)<60);
 // Carry usable fuel first, walking to the actual store to take it.
 if(a.inventory.dryWood<1)for(const s of stores.filter(s=>s.items.dryWood>=1).sort((s,t)=>distance(a.coordinates,s.position)-distance(a.coordinates,t.position)))if(roomFor(w,a,'dryWood')&&offer('prepare_warmth:fuel:'+s.id,'Collect dry fuel to light the camp fire',{kind:'take',storeId:s.id,item:'dryWood',quantity:2,minutes:.5},s.position,146))return result;
 if(a.inventory.dryWood>=1&&w.structures.shelter)return result;
 const needsShelter=!w.structures.shelter; // Distant workers do not supply remote knowledge or protection.

 if(needsShelter&&(raw>=4||w.structures.shelterConstruction))return result; // Existing build/return actions use it.
 const drying=stores.filter(s=>s.covered);
 if(w.structures.shelter&&a.inventory.wetWood>0&&!drying.some(s=>(s.items.wetWood||0)>=2)){
  for(const s of drying.filter(s=>roomFor(w,s,'wetWood')>0).sort((s,t)=>distance(s.position,camp.shelter)-distance(t.position,camp.shelter))){
   const keep={...a.inventory,wetWood:0};
   if(offer('prepare_warmth:drying:'+s.id,'Put damp fuel under cover to dry',{kind:'deposit',storeId:s.id,keep,minutes:.75},s.position,140))return result;
  }
 }
 // Two branches already drying are enough to wait for actual evaporation;
 // do not keep stripping trees or retrieving the same wet stock indefinitely.
 if(!needsShelter&&(raw>=2||drying.some(s=>(s.items.wetWood||0)>=2)))return result;
 const needed=(needsShelter?4:2)-raw;if(needed<=0)return result;
 const sources=findMaterialSource(w,a,'timber').filter(s=>!s.storeId||!drying.some(t=>t.id===s.storeId));
 for(const s of sources.filter(s=>!blocked('prepare_warmth:supply:'+(s.treeId||s.storeId||s.nodeId||s.item))).slice(0,12)){
  if(!roomFor(w,a,s.item))continue;
  const id='prepare_warmth:supply:'+(s.treeId||s.storeId||s.nodeId||s.item);
  if(offer(id,needsShelter?'Collect branches for a crude shelter':'Collect fuel to dry under shelter',{...s,quantity:needed,minutes:s.kind==='harvest'?3:s.kind==='take'?.5:2},s.position))break;
 }
 // Make room by putting unrelated cargo at the person's actual feet. Keep
 // shelter inputs, food and working tools; no inventory is deleted.
 if(!result.length&&sources.length&&!roomFor(w,a,'wetWood')){
  const id='prepare_warmth:make_room',keep={dryWood:a.inventory.dryWood,wetWood:a.inventory.wetWood,berries:2,cookedMeat:2,tubers:2,sharpStone:1,boundSharpTool:1,firedVessel:1};
  if(!blocked(id)&&Object.entries(a.inventory).some(([k,n])=>n>(keep[k]||0)))result.push({id,label:'Put down spare cargo to carry shelter materials',score:136,reasons:[['carrying space for cold protection',136]],job:{kind:'put_down',keep,coldPreparation:true,minutes:.75,destination:{...a.coordinates}}});
 }
 return result;
}
const checks=new WeakMap();
export function coldPreparationAvailable(w,a){
 // Idle checks are bounded; costly source/route searches do not run every
 // physics step when all known options really are exhausted or blocked.
 const at=clock(w),saved=checks.get(a);if(saved&&at-saved.at<1)return saved.available;
 const available=coldPreparationCandidates(w,a).length>0;checks.set(a,{at,available});return available;
}
