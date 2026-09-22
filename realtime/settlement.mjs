import {constructionSpec,constructionBlockers} from '../shared/craft.js';
import {recordPractice} from '../engine/craft-practice.js';
import {preparationFor,craftTool,toolPlan} from './crafting.mjs';
import {materialSources,harvestSite} from './resource-sites.mjs';
import {distance} from '../engine/navigation.js';
import {coordForPosition} from '../engine/spectator.js';
import {addEvent,remember,relationship,knowsTubers} from '../engine/core.js';
import {woodCommand,projectWood} from '../engine/wood-runtime.js';
import {clock,FOOD,WOOD,CARRY,loadOf,roomFor,makeStore,ownPile,transferItems,syncHoldings,treeUnits} from './holdings.mjs';
import {liveWalkable,liveRoute,liveClear,ARRIVAL_SPACE} from './motion.mjs';
import {partBounds} from './structures.mjs';
const storeBy=(w,id)=>w.settlement.stores.find(s=>s.id===id);
const allowed=(a,s)=>s.ownerId===a.id||s.access==='shared'||!s.ownerId;
const materialKeys={timber:['dryWood','wetWood'],stone:['stones'],reeds:['reeds'],clay:['clay']};
const units=(s,material)=>materialKeys[material].reduce((n,k)=>n+(s.items?.[k]||s.inventory?.[k]||0),0);
export function interactionPoint(w,a,position,{radius=1.15,extra=[],accept=()=>true}={}){
 const options=[...extra];for(let i=0;i<12;i++){const ang=i*Math.PI/6;options.push({x:position.x+Math.sin(ang)*radius,y:position.y+Math.cos(ang)*radius});}
 options.sort((p,q)=>distance(p,a.coordinates)-distance(q,a.coordinates));
 for(const p of options){if(!accept(p)||!liveWalkable(w,p)||w.agents.some(b=>b.id!==a.id&&(distance(p,b.coordinates)<1.1||b.task?.destination&&distance(p,b.task.destination)<1.1)))continue;if(liveRoute(w,a.coordinates,p))return p;}return null;
}
function assemblyPoint(w,a,p,part){
 const b=partBounds(p,part),x=Math.max(b.minX,Math.min(b.maxX,a.coordinates.x)),y=Math.max(b.minZ,Math.min(b.maxZ,a.coordinates.y));
 const options=[{x:b.minX-.65,y},{x:b.maxX+.65,y},{x,y:b.minZ-.65},{x,y:b.maxZ+.65}];
 const bb=p.bounds;if(p.purpose==='storage'||p.affordances?.storage?.enclosed)options.push({x:bb.minX-.65,y},{x:bb.maxX+.65,y},{x,y:bb.minZ-.65},{x,y:bb.maxZ+.65});
 return interactionPoint(w,a,{x,y},{radius:.8,extra:options,accept:q=>Math.hypot(Math.max(b.minX-q.x,q.x-b.maxX,0),Math.max(b.minZ-q.y,q.y-b.maxZ,0))<=1.6&&(!(p.purpose==='storage'||p.affordances?.storage?.enclosed)||q.x<=bb.minX-.4||q.x>=bb.maxX+.4||q.y<=bb.minZ-.4||q.y>=bb.maxZ+.4)});
}
export function materialNeed(p,material){return p.parts.filter(x=>!x.invested&&x.material===material).reduce((n,x)=>n+x.materialUnits,0);}
function findMaterialSource(w,a,material){
 const sources=[];for(const s of w.settlement.stores)if(allowed(a,s)&&s.kind!=='site'&&units(s,material)>0)sources.push({kind:'take',storeId:s.id,position:s.position,item:materialKeys[material].find(k=>s.items[k]>0)});
 if(material==='timber')for(const t of w.settlement.trees)if(treeUnits(w,t)>0&&(a.inventory.boundSharpTool>0||!(t.handGathered>=1)))sources.push({kind:'harvest',treeId:t.id,position:t.position,item:'wetWood'});
 if(material==='timber'){const log=w.worldModel.objects.find(o=>o.type==='fallen_tree');if(log)for(const item of ['dryWood','wetWood'])if(w.resources[item]>0)sources.push({kind:'fallen',position:log.position,item});}
 for(const node of materialSources(w,material,a))sources.push({kind:'gather',nodeId:node.nodeId,resource:node.resource,position:node.position,item:node.item,sourceId:node.id});
 return sources.sort((x,y)=>distance(a.coordinates,x.position)-distance(a.coordinates,y.position));
}
export function settlementCandidates(w,a){
 if(!w.settlement)return [];const result=[],l=loadOf(w,a),full=l.mass>CARRY.mass*.72||l.volume>CARRY.volume*.72;
 const offer=(id,label,score,job,position,opts={})=>{if(a.liveFailures?.[id]&&clock(w)-a.liveFailures[id].at<10)return;const store=job.storeId?storeBy(w,job.storeId):null;const destination=interactionPoint(w,a,position,{...opts,radius:store?.radius?store.radius+.65:opts.radius||1.15});if(destination)result.push({id,label,score:score-distance(a.coordinates,destination)*.18,reasons:[['physical task',score]],job:{...job,destination,position}});};
 const craftKeep={};
 const offerPreparation=(plan,p,score=74)=>{
  if(!plan)return;
  // Preserve carried inputs through the ordinary cargo deposit flow.
  for(const key of ['stones','reeds','cordage','woodPole','sharpStone','boundSharpTool','dryWood','wetWood'])craftKeep[key]=Math.max(craftKeep[key]||0,Math.min(a.inventory[key]||0,{stones:2,reeds:3,cordage:1,woodPole:1,sharpStone:1,boundSharpTool:1,dryWood:1,wetWood:1}[key]));
  if(plan.craft){const id=`craft:${plan.craft}`;if(!a.liveFailures?.[id]||clock(w)-a.liveFailures[id].at>=10)result.push({id,label:plan.label,score,reasons:[['construction prerequisite',score]],job:{kind:'craft',item:plan.craft,projectId:p?.id,destination:{...a.coordinates},minutes:plan.minutes}});return;}
  const material={stones:'stone',reeds:'reeds',timber:'timber'}[plan.item];
  if(!material)return;
  for(const source of findMaterialSource(w,a,material)){if(!roomFor(w,a,source.item))continue;const before=result.length;offer(`tool_supply:${source.treeId||source.storeId||source.sourceId||source.item}`,`Collect ${plan.item} for tools and joints`,score,{...source,quantity:plan.quantity,minutes:source.kind==='harvest'?6:2},source.position);if(result.length>before)return;}
  result.push({id:'explore',label:'Explore for tool materials',score:score-12,reasons:[['missing known tool supplies',score-12]]});
 };
 for(const p of w.settlement.projects.filter(p=>p.status==='complete'&&(p.purpose==='shelter'||p.affordances?.restPoints?.length)))if(a.needs.energy<65)offer(`rest_at:${p.id}`,`Rest in ${p.name}`,(100-a.needs.energy)*1.1+12,{kind:'rest',projectId:p.id,minutes:60},p.affordances?.restPoints?.[0]||p.position,{radius:.3,extra:p.affordances?.restPoints||[p.position]});
 // Food can only be withdrawn after walking to a real, finite store. A norm
 // penalty makes theft a desperate option, never a scheduled story event.
 for(const s of w.settlement.stores){
  if(allowed(a,s)&&s.items.dryWood>0&&a.inventory.dryWood<1&&!w.structures.fire&&a.needs.warmth<40&&roomFor(w,a,'dryWood'))offer(`retrieve_fuel:${s.id}`,'Collect stored fuel for the fire',85,{kind:'take',storeId:s.id,item:'dryWood',quantity:2,minutes:.5},s.position);
  const mine=allowed(a,s);if(!mine&&(s.secured||a.needs.hunger>=8))continue;
  const edible=FOOD.find(k=>s.items[k]>0&&(k!=='tubers'||knowsTubers(a)));if(!edible||!roomFor(w,a,edible)||FOOD.some(k=>a.inventory[k]>0))continue;
  const need=(100-a.needs.hunger)*1.2,penalty=mine?0:48+a.traits.cooperation*25;
  offer(`retrieve_food:${s.id}:${edible}`,`${mine?'Collect':'Take'} ${edible} from ${s.name}`,need-penalty+(mine?8:(8-a.needs.hunger)*9),{kind:'take',storeId:s.id,item:edible,quantity:2,minutes:.5,theft:!mine},s.position);
 }
 const projects=w.settlement.projects.filter(p=>{const owner=w.agents.find(b=>b.id===p.ownerId);return p.status!=='complete'&&(p.ownerId===a.id||p.access==='shared'&&(!owner||(relationship(w,a,owner)?.trust??34)>=20));}).sort((p,q)=>(p.ownerId===a.id?0:1)-(q.ownerId===a.id?0:1));
 for(const p of projects){const stock=storeBy(w,p.stockpileId),base=53+(p.ownerId===a.id?4:0),ready=p.parts.find(part=>!part.built&&part.requires.every(id=>p.parts.find(x=>x.id===id)?.built)&&(!part.worker||part.worker===a.id||!w.agents.some(b=>b.id===part.worker&&b.task?.selected?.job?.partId===part.id&&b.task?.selected?.job?.projectId===p.id)));
  const preparation=ready&&preparationFor(a,ready);if(preparation){offerPreparation(preparation,p);continue;}
  if(ready&&!(a.liveFailures?.[`build:${p.id}:${ready.id}`]&&clock(w)-a.liveFailures[`build:${p.id}:${ready.id}`].at<10)&&(ready.invested||units(a,ready.material)>=ready.materialUnits)){
   const destination=assemblyPoint(w,a,p,ready);if(destination)result.push({id:`build:${p.id}:${ready.id}`,label:`Assemble ${ready.id} · ${p.name}`,score:base+12,reasons:[['planned construction',base]],job:{kind:'assemble',projectId:p.id,partId:ready.id,destination,minutes:ready.requiredMinutes}});
  }
  if(ready&&!ready.invested&&units(a,ready.material)<ready.materialUnits&&units(stock,ready.material)+units(a,ready.material)>=ready.materialUnits){const key=materialKeys[ready.material].find(k=>stock.items[k]>0);offer(`fetch_part:${p.id}:${ready.id}`,`Carry material to ${ready.id} · ${p.name}`,base+11,{kind:'take',projectId:p.id,storeId:stock.id,item:key,quantity:ready.materialUnits-units(a,ready.material),minutes:.5},stock.position);}
  for(const material of Object.keys(p.bill)){
   const missing=materialNeed(p,material)-units(stock,material);if(missing<=0)continue;
   const carried=materialKeys[material].find(k=>a.inventory[k]>0);
   if(carried)offer(`deliver:${p.id}:${material}`,`Carry ${material} to ${p.name}`,base+9,{kind:'deliver',projectId:p.id,storeId:stock.id,item:carried,quantity:missing,minutes:.5},stock.position);
   else if(!full){const sources=findMaterialSource(w,a,material);if(!sources.length&&material==='timber'&&!a.inventory.boundSharpTool)offerPreparation(toolPlan(a,'boundSharpTool'),p);if(!sources.length)result.push({id:'explore',label:'Explore for '+material+' · '+p.name,score:base+4,reasons:[['missing locally known building material',base+4]]});for(const source of sources.slice(0,12)){if(!roomFor(w,a,source.item))continue;const before=result.length;offer(`supply:${p.id}:${source.treeId||source.storeId||source.sourceId||source.resource}`,`Collect ${material} for ${p.name}`,base+(ready?.material===material?4:0),{...source,projectId:p.id,quantity:Math.min(4,missing),minutes:source.kind==='harvest'?3:1.5},source.position);if(result.length>before)break;}}
  }
 }
 // Keep a little food and tools on the body, put bulk goods in owned storage.
 const nextPart=projects[0]?.parts.find(x=>!x.built&&x.requires.every(id=>projects[0].parts.find(t=>t.id===id)?.built)),food=FOOD.find(k=>a.inventory[k]>0),tool=a.inventory.boundSharpTool?'boundSharpTool':'sharpStone';
 const keep=Object.fromEntries(Object.keys(a.inventory).map(k=>[k,k===food?2:projects.length?(k===tool?1:0):['sharpStone','boundSharpTool','firedVessel'].includes(k)?1:0]));
 for(const [key,n]of Object.entries(craftKeep))keep[key]=Math.max(keep[key]||0,n);
 if(nextPart&&!nextPart.invested){let n=nextPart.materialUnits;for(const k of materialKeys[nextPart.material]){keep[k]=Math.min(n,a.inventory[k]||0);n-=keep[k];}}
 const depositKeys=Object.entries(a.inventory).filter(([k,n])=>n>(keep[k]||0)).map(([k])=>k);
 const assemblyLoadBlocked=projects.some(p=>{const part=p.parts.find(x=>!x.built&&!x.invested&&x.requires.every(id=>p.parts.find(t=>t.id===id)?.built));if(!part)return false;const key=materialKeys[part.material][0];return roomFor(w,a,key)+units(a,part.material)<part.materialUnits;});
 if(depositKeys.length){const preferred=w.settlement.stores.filter(s=>s.kind!=='site'&&allowed(a,s)&&depositKeys.some(k=>roomFor(w,s,k))).sort((x,y)=>(['storage','platform'].includes(x.kind)?0:20)-(['storage','platform'].includes(y.kind)?0:20)+distance(x.position,a.coordinates)-distance(y.position,a.coordinates));
  const usingLoad=result.some(c=>['assemble','deliver','craft'].includes(c.job?.kind));
  const s=preferred[0];if(s)offer(`deposit:${s.id}`,`Put supplies in ${s.name}`,assemblyLoadBlocked?96:full&&!usingLoad?86:projects.length?8:27,{kind:'deposit',storeId:s.id,keep,minutes:.75},s.position);
  else if(full||assemblyLoadBlocked)result.push({id:'put_down_load',label:'Put down unrelated cargo for the building work',score:96,reasons:[['carrying space',96]],job:{kind:'put_down',keep,destination:{...a.coordinates},minutes:.75}});
 }
 // Real fuel collection from activated trees is available even when the old
 // log is exhausted. Wet timber remains wet until it dries physically.
 if(a.inventory.dryWood+a.inventory.wetWood<2&&!projects.length&&a.needs.warmth<40&&!w.structures.fire&&!a.liveFailures?.harvest_cold){const source=findMaterialSource(w,a,'timber').find(s=>s.kind==='harvest');if(source&&roomFor(w,a,source.item))offer(`harvest_fuel:${source.treeId}`,'Collect a branch for shelter-drying',38,{...source,quantity:2,minutes:3},source.position);}
 for(const animal of w.ecologySystem?.wildlife||[])if(animal.active&&animal.species!=='fish'&&distance(a.coordinates,animal.position)>=6&&distance(a.coordinates,animal.position)<=12&&liveClear(w,a.coordinates,animal.position)&&(a.animalStudies?.[animal.id]??-Infinity)+120<clock(w)){
  result.push({id:'study:'+animal.id,label:'Observe '+(animal.label||animal.species)+' from a distance',score:20+a.traits.curiosity*10,reasons:[['learn animal behavior',20]],job:{kind:'study',animalId:animal.id,destination:{...a.coordinates},minutes:2}});break;
 }
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
 let need=part.materialUnits;const binding=constructionSpec(part).binding;if(units(a,part.material)<need||(a.inventory.cordage||0)<binding)return false;
 for(const key of materialKeys[part.material]){const q=Math.min(a.inventory[key]||0,need);if(!q)continue;
  if(WOOD[key])woodCommand(w,a,{from:{kind:'carried',id:a.id},to:{kind:'stored',id:`component:${p.id}:${part.id}`},quantity:q,category:key,inputForm:'branch',outputForm:'shelter-component',reason:`install carried material in ${part.id} of ${p.name}`});
  else{a.inventory[key]-=q;(part.materials??={})[key]=(part.materials[key]||0)+q;}
  need-=q;if(!need)break;
 }if(binding){a.inventory.cordage-=binding;part.bindingUsed=binding;}part.invested=true;syncHoldings(w);return true;
}
export function workSettlement(w,a,t,minutes){
 const j=t.selected.job,s=j.storeId?storeBy(w,j.storeId):null,p=j.projectId?w.settlement.projects.find(p=>p.id===j.projectId):null;
 const fail=detail=>({done:true,success:false,detail});
 if(distance(a.coordinates,j.destination)>.4)return fail('The work location changed; walking back is required.');
 if(s&&distance(a.coordinates,s.position)>(s.radius||.8)+1.1)return fail('Storage is beyond reach.');
 if(s&&j.kind==='take'&&!allowed(a,s)&&(s.secured||a.needs.hunger>=8))return fail('Taking these owned supplies is not justified or the container is secured.');
 if(j.kind==='rest'){recordStructureUse(w,a,p,'rest');a.needs.energy=Math.min(100,a.needs.energy+30*minutes/60);t.workMinutes+=minutes;return {done:t.workMinutes>=t.requiredMinutes,success:true,detail:`${a.name} rested in ${p?.name||'the shelter'}.`};}
 if(j.kind==='assemble'){
  const part=p?.parts.find(x=>x.id===j.partId);if(!part||part.built)return {done:true,success:true,detail:'This part is already in place.'};
  const blockers=constructionBlockers(a,part);if(blockers.length)return fail(blockers.join('; '));
  if(part.requires.some(id=>!p.parts.find(x=>x.id===id)?.built))return fail('The supporting parts are not built yet.');
  if((p.purpose==='storage'||p.affordances?.storage)&&part.kind==='wall'&&w.agents.some(b=>b.coordinates.x>p.bounds.minX-.25&&b.coordinates.x<p.bounds.maxX+.25&&b.coordinates.y>p.bounds.minZ-.25&&b.coordinates.y<p.bounds.maxZ+.25))return {done:false};
  const b=partBounds(p,part),dx=Math.max(b.minX-a.coordinates.x,a.coordinates.x-b.maxX,0),dy=Math.max(b.minZ-a.coordinates.y,a.coordinates.y-b.maxZ,0);
  if(Math.hypot(dx,dy)>1.8)return fail('This component is beyond working reach.');
  if(!part.invested&&!investPart(w,a,p,part))return fail('The required material has not been carried to this component.');
  part.worker=a.id;const worked=Math.min(minutes,part.requiredMinutes-part.workMinutes);(part.craftWork??={})[a.id]=(part.craftWork?.[a.id]||0)+worked;part.workMinutes=Math.min(part.requiredMinutes,part.workMinutes+minutes);t.workMinutes=part.workMinutes;t.requiredMinutes=part.requiredMinutes;p.status='building';p.revision++;w.settlement.revision++;
  if(part.workMinutes<part.requiredMinutes)return {done:false};part.built=true;part.worker=null;part.workmanship={builder:a.id,finish:constructionSpec(part).finish,tool:constructionSpec(part).tool,at:clock(w)};for(const [id,worked]of Object.entries(part.craftWork||{})){const worker=w.agents.find(x=>x.id===id);if(worker)recordPractice(w,worker,part.material==='timber'?'woodworking':part.material==='reeds'?'fiberwork':part.material==='stone'?'stoneworking':'clayworking',worked,'Assembled '+part.id+' in '+p.name);}delete part.craftWork;
  addEvent(w,'construction-part',`${a.name} placed ${part.id}`,`${p.name}: ${p.parts.filter(x=>x.built).length}/${p.parts.length} parts assembled.`,{projectId:p.id,agentId:a.id});
  if(p.parts.every(x=>x.built)){
   p.status='complete';p.completedAt=clock(w);
   if(p.affordances?.storage){const properties=p.affordances.storage;p.storeId=makeStore(w,{...properties,kind:properties.enclosed?'storage':'platform',name:p.name,ownerId:p.ownerId,access:p.access,projectId:p.id}).id;}else if(!p.generic&&p.purpose==='storage')p.storeId=makeStore(w,{kind:'storage',name:p.name,position:p.position,ownerId:p.ownerId,access:p.access,covered:p.covered,secured:p.secured,capacityKg:p.capacityKg,capacityVolume:p.capacityVolume,projectId:p.id,radius:Math.max(p.bounds.maxX-p.bounds.minX,p.bounds.maxZ-p.bounds.minZ)/2}).id;
   remember(w,a,`${p.name} is complete and can now be used.`,{importance:9,tags:['construction',p.purpose]});addEvent(w,'construction-complete',`${p.name} is complete`,`${p.designer}’s design was built from delivered materials and elapsed labor.`,{projectId:p.id});
  }return {done:true,success:true,detail:`${a.name} assembled ${part.id} in ${p.name}.`};
 }
 if(j.kind==='study'){
  const animal=w.ecologySystem?.wildlife?.find(x=>x.id===j.animalId&&x.active),gap=animal&&distance(a.coordinates,animal.position);
  if(!animal||gap<6||gap>12||!liveClear(w,a.coordinates,animal.position))return fail('The animal moved out of a safe, visible observation range.');
  if((a.animalStudies?.[animal.id]??-Infinity)+120>=clock(w))return fail('This animal was studied recently.');
 }
 t.workMinutes=Math.min(t.requiredMinutes,t.workMinutes+minutes);if(t.workMinutes<t.requiredMinutes)return {done:false};
 if(j.kind==='craft')return craftTool(w,a,j.item);
 if(j.kind==='study'){const animal=w.ecologySystem.wildlife.find(x=>x.id===j.animalId);(a.animalStudies??={})[animal.id]=clock(w);recordPractice(w,a,'tracking',t.workMinutes,'Observed '+animal.species+' at a safe distance');remember(w,a,`I observed a ${animal.species} ${animal.behavior||'moving'} from a distance.`,{importance:5,tags:['wildlife','tracking']});return {done:true,success:true,detail:'Observed a real nearby animal without approaching it.'};}
 if(j.kind==='fallen'){
  const log=w.worldModel.objects.find(o=>o.type==='fallen_tree');if(!log||distance(a.coordinates,log.position)>1.9)return fail('Fallen branches are beyond reach.');
  const q=Math.min(w.resources[j.item]||0,j.quantity,roomFor(w,a,j.item));if(!q)return fail('No fallen wood or carrying space remains.');woodCommand(w,a,{from:{kind:'ground',id:'log'},quantity:q,category:j.item,reason:'collect loose fallen branches for construction'});return {done:true,success:true,detail:`Collected ${q} loose fallen branches.`};
 }
 if(j.kind==='put_down'||j.kind==='deposit'){
  const dest=s||ownPile(w,a);if(s&&!allowed(a,s))return fail('This is not available storage.');let count=0;
  for(const [k,n]of Object.entries(a.inventory)){const keep=j.keep?.[k]??(FOOD.includes(k)?2:['sharpStone','boundSharpTool','firedVessel'].includes(k)?1:0);count+=transferItems(w,a,dest,k,Math.max(0,n-keep));}
  if(count&&s)recordStructureUse(w,a,w.settlement.projects.find(p=>p.id===s.projectId),'storage');return {done:true,success:count>0,detail:`${a.name} physically put ${count} items into ${dest.name}.`};
 }
 if(j.kind==='take'){
  if(!s)return fail('The store no longer exists.');const q=transferItems(w,s,a,j.item,j.quantity);if(q){recordTaking(w,a,s,j.item,q);recordStructureUse(w,a,w.settlement.projects.find(p=>p.id===s.projectId),'supplies');}return {done:true,success:q>0,detail:`${a.name} collected ${q} ${j.item} from ${s.name}.`};
 }
 if(j.kind==='deliver'){
  if(!s||!p||!allowed(a,s))return fail('The building site is unavailable.');const q=transferItems(w,a,s,j.item,j.quantity);if(p.status!=='complete')p.status='gathering';p.revision++;return {done:true,success:q>0,detail:`${a.name} delivered ${q} ${j.item} to ${p.name}.`};
 }
 if(j.kind==='harvest'){
  const tree=w.settlement.trees.find(x=>x.id===j.treeId);if(!tree||distance(a.coordinates,tree.position)>1.9)return fail('The tree is beyond reach.');
  if(!a.inventory.boundSharpTool&&tree.handGathered>=1)return fail('Further cutting at this tree needs a hafted cutting edge.');
  const source=w.wood.batches.find(b=>b.holder.id===tree.id&&b.holder.kind==='ground'),key=source&&source.waterKg/source.dryKg<=.24?'dryWood':'wetWood',q=Math.min(treeUnits(w,tree),j.quantity,roomFor(w,a,key),a.inventory.boundSharpTool?Infinity:1);
  if(!q)return fail('No timber or carrying room remains.');woodCommand(w,a,{from:{kind:'ground',id:tree.id},quantity:q,category:'any',reason:'cut finite standing timber at the tree'});if(!a.inventory.boundSharpTool)tree.handGathered=(tree.handGathered||0)+q;else recordPractice(w,a,'woodworking',t.requiredMinutes,'Cut timber with a hafted edge');tree.depleted=treeUnits(w,tree)===0;w.settlement.revision++;return {done:true,success:true,detail:`${a.name} ${a.inventory.boundSharpTool?'cut':'snapped a small accessible branch and carried'} ${q} wood units from a real tree.`};
 }
 if(j.kind==='gather'){
  if(distance(a.coordinates,j.position)>1.9)return fail('The resource is beyond reach.');const node=j.nodeId?w.resourceSites?.nodes.find(n=>n.id===j.nodeId):null;if(j.nodeId&&(!node||node.item!==j.item||distance(a.coordinates,node.position)>1.9))return fail('The material deposit is unavailable or out of reach.');const q=j.nodeId?harvestSite(w,j.nodeId,Math.min(j.quantity,roomFor(w,a,j.item)),a.id):Math.max(0,Math.min(w.resources[j.resource]||0,j.quantity,roomFor(w,a,j.item)));if(!j.nodeId)w.resources[j.resource]-=q;a.inventory[j.item]=(a.inventory[j.item]||0)+q;return {done:true,success:q>0,detail:`${a.name} gathered ${q} ${j.item} for construction.`};
 }return fail('Unknown physical job.');
}

export function recordStructureUse(w,a,p,kind){
 if(!p||p.status!=='complete')return;p.feedback??={uses:0,byUser:{},lastUse:null};
 const key=a.id+':'+kind,day=w.day;if(p.feedback.byUser[key]===day)return;p.feedback.byUser[key]=day;p.feedback.uses++;p.feedback.lastUse={kind,user:a.name,day};p.feedback.observations??={};p.feedback.observations[a.id]={uses:(p.feedback.observations[a.id]?.uses||0)+1,lastUse:p.feedback.lastUse};
 if(p.ownerId===a.id||p.access!=='shared')return;const owner=w.agents.find(b=>b.id===p.ownerId);if(!owner)return;
 const rel=relationship(w,a,owner);if(rel)rel.trust=Math.min(100,rel.trust+2);
 remember(w,a,`${owner.name}'s ${p.name} helped me with ${kind}.`,{importance:5,tags:['construction','useful','social']});
 // Designer learns when present; no remote knowledge of unseen appreciation.
 if(distance(owner.coordinates,a.coordinates)<9){p.feedback.observations[owner.id]={uses:(p.feedback.observations[owner.id]?.uses||0)+1,lastUse:p.feedback.lastUse};remember(w,owner,`${a.name} used my ${p.name} for ${kind}.`,{importance:6,tags:['construction','feedback']});}
}
