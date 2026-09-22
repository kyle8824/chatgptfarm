import {distance} from '../engine/navigation.js';
import {coordForPosition} from '../engine/spectator.js';
import {addEvent,remember,relationship,knowsTubers} from '../engine/core.js';
import {woodCommand,projectWood} from '../engine/wood-runtime.js';
import {clock,FOOD,WOOD,CARRY,loadOf,roomFor,makeStore,ownPile,transferItems,syncHoldings,treeUnits} from './holdings.mjs';
import {liveWalkable,liveRoute,liveClear,ARRIVAL_SPACE} from './motion.mjs';
import {partBounds} from './structures.mjs';
const storeBy=(w,id)=>w.settlement.stores.find(s=>s.id===id);
const allowed=(a,s)=>s.ownerId===a.id||s.access==='shared'||!s.ownerId;
const materialKeys={timber:['dryWood','wetWood'],stone:['stones'],reeds:['reeds']};
const units=(s,material)=>materialKeys[material].reduce((n,k)=>n+(s.items?.[k]||s.inventory?.[k]||0),0);
export function interactionPoint(w,a,position,{radius=1.15,extra=[]}={}){
 const options=[...extra];for(let i=0;i<12;i++){const ang=i*Math.PI/6;options.push({x:position.x+Math.sin(ang)*radius,y:position.y+Math.cos(ang)*radius});}
 options.sort((p,q)=>distance(p,a.coordinates)-distance(q,a.coordinates));
 for(const p of options){if(!liveWalkable(w,p)||w.agents.some(b=>b.id!==a.id&&(distance(p,b.coordinates)<1.1||b.task?.destination&&distance(p,b.task.destination)<1.1)))continue;if(liveRoute(w,a.coordinates,p))return p;}return null;
}
function assemblyPoint(w,a,p,part){
 const b=partBounds(p,part),x=Math.max(b.minX,Math.min(b.maxX,a.coordinates.x)),y=Math.max(b.minZ,Math.min(b.maxZ,a.coordinates.y));
 const options=[{x:b.minX-.65,y},{x:b.maxX+.65,y},{x,y:b.minZ-.65},{x,y:b.maxZ+.65}];
 return interactionPoint(w,a,{x,y},{radius:.8,extra:options});
}
export function materialNeed(p,material){return p.parts.filter(x=>!x.invested&&x.material===material).reduce((n,x)=>n+x.materialUnits,0);}
function findMaterialSource(w,a,material){
 const sources=[];for(const s of w.settlement.stores)if(allowed(a,s)&&s.kind!=='site'&&units(s,material)>0)sources.push({kind:'take',storeId:s.id,position:s.position,item:materialKeys[material].find(k=>s.items[k]>0)});
 if(material==='timber')for(const t of w.settlement.trees)if(treeUnits(w,t)>0)sources.push({kind:'harvest',treeId:t.id,position:t.position,item:'wetWood'});
 const key={stone:'stones',reeds:'reeds'}[material];if(key&&w.resources[key]>0)sources.push({kind:'gather',resource:key,position:coordForPosition(key,w),item:key});
 return sources.sort((x,y)=>distance(a.coordinates,x.position)-distance(a.coordinates,y.position));
}
export function settlementCandidates(w,a){
 if(!w.settlement)return [];const result=[],l=loadOf(w,a),full=l.mass>CARRY.mass*.72||l.volume>CARRY.volume*.72;
 const offer=(id,label,score,job,position,opts={})=>{if(a.liveFailures?.[id]&&clock(w)-a.liveFailures[id].at<10)return;const store=job.storeId?storeBy(w,job.storeId):null;const destination=interactionPoint(w,a,position,{...opts,radius:store?.radius?store.radius+.65:opts.radius||1.15});if(destination)result.push({id,label,score:score-distance(a.coordinates,destination)*.18,reasons:[['physical task',score]],job:{...job,destination,position}});};
 for(const p of w.settlement.projects.filter(p=>p.status==='complete'&&p.purpose==='shelter'))if(a.needs.energy<65)offer(`rest_at:${p.id}`,`Rest in ${p.name}`,(100-a.needs.energy)*1.1+12,{kind:'rest',projectId:p.id,minutes:60},p.position,{radius:.3,extra:[p.position]});
 // Food can only be withdrawn after walking to a real, finite store. A norm
 // penalty makes theft a desperate option, never a scheduled story event.
 for(const s of w.settlement.stores){
  if(allowed(a,s)&&s.items.dryWood>0&&a.inventory.dryWood<1&&!w.structures.fire&&a.needs.warmth<40&&roomFor(w,a,'dryWood'))offer(`retrieve_fuel:${s.id}`,'Collect stored fuel for the fire',85,{kind:'take',storeId:s.id,item:'dryWood',quantity:2,minutes:.5},s.position);
  const mine=allowed(a,s);if(!mine&&(s.secured||a.needs.hunger>=8))continue;
  const edible=FOOD.find(k=>s.items[k]>0&&(k!=='tubers'||knowsTubers(a)));if(!edible||!roomFor(w,a,edible)||FOOD.some(k=>a.inventory[k]>0))continue;
  const need=(100-a.needs.hunger)*1.2,penalty=mine?0:48+a.traits.cooperation*25;
  offer(`retrieve_food:${s.id}:${edible}`,`${mine?'Collect':'Take'} ${edible} from ${s.name}`,need-penalty+(mine?8:(8-a.needs.hunger)*9),{kind:'take',storeId:s.id,item:edible,quantity:2,minutes:.5,theft:!mine},s.position);
 }
 const projects=w.settlement.projects.filter(p=>p.status!=='complete'&&(p.ownerId===a.id||p.access==='shared'));
 for(const p of projects){const stock=storeBy(w,p.stockpileId),base=53+(p.ownerId===a.id?4:0),ready=p.parts.find(part=>!part.built&&part.requires.every(id=>p.parts.find(x=>x.id===id)?.built)&&(!part.worker||part.worker===a.id||!w.agents.some(b=>b.id===part.worker&&b.task?.selected?.job?.partId===part.id&&b.task?.selected?.job?.projectId===p.id)));
  if(ready&&(ready.invested||units(a,ready.material)>=ready.materialUnits)){
   const destination=assemblyPoint(w,a,p,ready);if(destination)result.push({id:`build:${p.id}:${ready.id}`,label:`Assemble ${ready.id} · ${p.name}`,score:base+12,reasons:[['planned construction',base]],job:{kind:'assemble',projectId:p.id,partId:ready.id,destination,minutes:ready.requiredMinutes}});
  }
  if(ready&&!ready.invested&&units(a,ready.material)<ready.materialUnits&&units(stock,ready.material)>0){const key=materialKeys[ready.material].find(k=>stock.items[k]>0);offer(`fetch_part:${p.id}:${ready.id}`,`Carry material to ${ready.id} · ${p.name}`,base+11,{kind:'take',projectId:p.id,storeId:stock.id,item:key,quantity:ready.materialUnits-units(a,ready.material),minutes:.5},stock.position);}
  for(const material of Object.keys(p.bill)){
   const missing=materialNeed(p,material)-units(stock,material);if(missing<=0)continue;
   const carried=materialKeys[material].find(k=>a.inventory[k]>0);
   if(carried)offer(`deliver:${p.id}:${material}`,`Carry ${material} to ${p.name}`,base+9,{kind:'deliver',projectId:p.id,storeId:stock.id,item:carried,quantity:missing,minutes:.5},stock.position);
   else if(!full){for(const source of findMaterialSource(w,a,material).slice(0,12)){if(!roomFor(w,a,source.item))continue;const before=result.length;offer(`supply:${p.id}:${source.treeId||source.storeId||source.resource}`,`Collect ${material} for ${p.name}`,base+(ready?.material===material?4:0),{...source,projectId:p.id,quantity:Math.min(4,missing),minutes:source.kind==='harvest'?3:1.5},source.position);if(result.length>before)break;}}
  }
 }
 // Keep a little food and tools on the body, put bulk goods in owned storage.
 const depositKeys=Object.entries(a.inventory).filter(([k,n])=>n>(FOOD.includes(k)?2:['sharpStone','boundSharpTool','firedVessel'].includes(k)?1:0)).map(([k])=>k);
 if(depositKeys.length){const preferred=w.settlement.stores.filter(s=>s.kind!=='site'&&allowed(a,s)&&depositKeys.some(k=>roomFor(w,s,k))).sort((x,y)=>(x.kind==='storage'?0:20)-(y.kind==='storage'?0:20)+distance(x.position,a.coordinates)-distance(y.position,a.coordinates));
  const s=preferred[0];if(s)offer(`deposit:${s.id}`,`Put supplies in ${s.name}`,full?86:projects.length?8:27,{kind:'deposit',storeId:s.id,minutes:.75},s.position);
  else if(full)result.push({id:'put_down_load',label:'Put down the heavy load',score:86,reasons:[['carrying space',86]],job:{kind:'put_down',destination:{...a.coordinates},minutes:.75}});
 }
 // Real fuel collection from activated trees is available even when the old
 // log is exhausted. Wet timber remains wet until it dries physically.
 if(a.inventory.dryWood+a.inventory.wetWood<2&&!projects.length&&a.needs.warmth<40&&!w.structures.fire&&!a.liveFailures?.harvest_cold){const source=findMaterialSource(w,a,'timber').find(s=>s.kind==='harvest');if(source&&roomFor(w,a,source.item))offer(`harvest_fuel:${source.treeId}`,'Collect a branch for shelter-drying',38,{...source,quantity:2,minutes:3},source.position);}
 return result;
}
function recordTaking(w,a,s,key,count){
 if(allowed(a,s))return;const owner=w.agents.find(b=>b.id===s.ownerId),witnesses=w.agents.filter(b=>b.id!==a.id&&distance(b.coordinates,s.position)<9&&liveClear(w,b.coordinates,a.coordinates));
 const incident={id:`incident-${w.settlement.nextId++}`,storeId:s.id,takerId:a.id,ownerId:s.ownerId,item:key,count,at:clock(w),witnesses:witnesses.map(b=>b.id),discovered:false};w.settlement.incidents.push(incident);w.settlement.incidents=w.settlement.incidents.slice(-80);
 remember(w,a,`I took ${count} ${key} from ${owner?.name||'someone'}’s supplies without permission because I was desperate for food.`,{importance:9,tags:['ownership','theft','hunger']});
 for(const b of witnesses){const rel=relationship(w,b,a);if(rel)rel.trust=Math.max(0,rel.trust-22);remember(w,b,`I saw ${a.name} take ${key} from ${owner?.name||'another villager'}’s supplies without permission.`,{importance:9,tags:['ownership','theft','witness']});if(b.id===s.ownerId){b.propertyConcern=(b.propertyConcern||0)+1;incident.discovered=true;}}
 addEvent(w,'theft',`${a.name} took food without permission`,`${count} ${key} moved from ${s.name}. ${witnesses.length?'Witnesses remember it and trust falls.':'Nobody witnessed it; the owner has not identified a taker.'}`,{agentId:a.id,storeId:s.id});
}
export function noticeMissingSupplies(w,a){for(const incident of w.settlement.incidents){if(incident.discovered||incident.ownerId!==a.id)continue;const s=storeBy(w,incident.storeId);if(s&&distance(s.position,a.coordinates)<2){incident.discovered=true;a.propertyConcern=(a.propertyConcern||0)+1;remember(w,a,`Some ${incident.item} are missing from my supplies. I did not see who took them; I want safer storage.`,{importance:9,tags:['ownership','missing','protection']});}}}
function investPart(w,a,p,part){
 let need=part.materialUnits;if(units(a,part.material)<need)return false;
 for(const key of materialKeys[part.material]){const q=Math.min(a.inventory[key]||0,need);if(!q)continue;
  if(WOOD[key])woodCommand(w,a,{from:{kind:'carried',id:a.id},to:{kind:'stored',id:`component:${p.id}:${part.id}`},quantity:q,category:key,inputForm:'branch',outputForm:'shelter-component',reason:`install carried material in ${part.id} of ${p.name}`});
  else{a.inventory[key]-=q;(part.materials??={})[key]=(part.materials[key]||0)+q;}
  need-=q;if(!need)break;
 }part.invested=true;syncHoldings(w);return true;
}
export function workSettlement(w,a,t,minutes){
 const j=t.selected.job,s=j.storeId?storeBy(w,j.storeId):null,p=j.projectId?w.settlement.projects.find(p=>p.id===j.projectId):null;
 const fail=detail=>({done:true,success:false,detail});
 if(distance(a.coordinates,j.destination)>.4)return fail('The work location changed; walking back is required.');
 if(s&&distance(a.coordinates,s.position)>(s.radius||.8)+1.1)return fail('Storage is beyond reach.');
 if(s&&j.kind==='take'&&!allowed(a,s)&&(s.secured||a.needs.hunger>=8))return fail('Taking these owned supplies is not justified or the container is secured.');
 if(j.kind==='rest'){a.needs.energy=Math.min(100,a.needs.energy+30*minutes/60);t.workMinutes+=minutes;return {done:t.workMinutes>=t.requiredMinutes,success:true,detail:`${a.name} rested in ${p?.name||'the shelter'}.`};}
 if(j.kind==='assemble'){
  const part=p?.parts.find(x=>x.id===j.partId);if(!part||part.built)return {done:true,success:true,detail:'This part is already in place.'};
  if(part.requires.some(id=>!p.parts.find(x=>x.id===id)?.built))return fail('The supporting parts are not built yet.');
  const b=partBounds(p,part),dx=Math.max(b.minX-a.coordinates.x,a.coordinates.x-b.maxX,0),dy=Math.max(b.minZ-a.coordinates.y,a.coordinates.y-b.maxZ,0);
  if(Math.hypot(dx,dy)>1.8)return fail('This component is beyond working reach.');
  if(!part.invested&&!investPart(w,a,p,part))return fail('The required material has not been carried to this component.');
  part.worker=a.id;part.workMinutes=Math.min(part.requiredMinutes,part.workMinutes+minutes);t.workMinutes=part.workMinutes;t.requiredMinutes=part.requiredMinutes;p.status='building';p.revision++;w.settlement.revision++;
  if(part.workMinutes<part.requiredMinutes)return {done:false};part.built=true;part.worker=null;
  addEvent(w,'construction-part',`${a.name} placed ${part.id}`,`${p.name}: ${p.parts.filter(x=>x.built).length}/${p.parts.length} parts assembled.`,{projectId:p.id,agentId:a.id});
  if(p.parts.every(x=>x.built)){
   p.status='complete';p.completedAt=clock(w);
   if(p.purpose==='storage')p.storeId=makeStore(w,{kind:'storage',name:p.name,position:p.position,ownerId:p.ownerId,access:p.access,covered:p.covered,secured:p.secured,capacityKg:p.capacityKg,capacityVolume:p.capacityVolume,projectId:p.id,radius:Math.max(p.bounds.maxX-p.bounds.minX,p.bounds.maxZ-p.bounds.minZ)/2}).id;
   remember(w,a,`${p.name} is complete and can now be used.`,{importance:9,tags:['construction',p.purpose]});addEvent(w,'construction-complete',`${p.name} is complete`,`${p.designer}’s design was built from delivered materials and elapsed labor.`,{projectId:p.id});
  }return {done:true,success:true,detail:`${a.name} assembled ${part.id} in ${p.name}.`};
 }
 t.workMinutes=Math.min(t.requiredMinutes,t.workMinutes+minutes);if(t.workMinutes<t.requiredMinutes)return {done:false};
 if(j.kind==='put_down'||j.kind==='deposit'){
  const dest=s||ownPile(w,a);if(s&&!allowed(a,s))return fail('This is not available storage.');let count=0;
  for(const [k,n]of Object.entries(a.inventory)){const keep=FOOD.includes(k)?2:['sharpStone','boundSharpTool','firedVessel'].includes(k)?1:0;count+=transferItems(w,a,dest,k,Math.max(0,n-keep));}
  return {done:true,success:count>0,detail:`${a.name} physically put ${count} items into ${dest.name}.`};
 }
 if(j.kind==='take'){
  if(!s)return fail('The store no longer exists.');const q=transferItems(w,s,a,j.item,j.quantity);if(q)recordTaking(w,a,s,j.item,q);return {done:true,success:q>0,detail:`${a.name} collected ${q} ${j.item} from ${s.name}.`};
 }
 if(j.kind==='deliver'){
  if(!s||!p||!allowed(a,s))return fail('The building site is unavailable.');const q=transferItems(w,a,s,j.item,j.quantity);if(p.status!=='complete')p.status='gathering';p.revision++;return {done:true,success:q>0,detail:`${a.name} delivered ${q} ${j.item} to ${p.name}.`};
 }
 if(j.kind==='harvest'){
  const tree=w.settlement.trees.find(x=>x.id===j.treeId);if(!tree||distance(a.coordinates,tree.position)>1.9)return fail('The tree is beyond reach.');
  const source=w.wood.batches.find(b=>b.holder.id===tree.id&&b.holder.kind==='ground'),key=source&&source.waterKg/source.dryKg<=.24?'dryWood':'wetWood',q=Math.min(treeUnits(w,tree),j.quantity,roomFor(w,a,key));
  if(!q)return fail('No timber or carrying room remains.');woodCommand(w,a,{from:{kind:'ground',id:tree.id},quantity:q,category:'any',reason:'cut finite standing timber at the tree'});tree.depleted=treeUnits(w,tree)===0;w.settlement.revision++;return {done:true,success:true,detail:`${a.name} cut and carried ${q} branches from a real tree.`};
 }
 if(j.kind==='gather'){
  if(distance(a.coordinates,j.position)>1.9)return fail('The resource is beyond reach.');const q=Math.min(w.resources[j.resource]||0,j.quantity,roomFor(w,a,j.item));w.resources[j.resource]-=q;a.inventory[j.item]=(a.inventory[j.item]||0)+q;return {done:true,success:q>0,detail:`${a.name} gathered ${q} ${j.item} for construction.`};
 }return fail('Unknown physical job.');
}
