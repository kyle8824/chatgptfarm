import {completeStages} from './construction-stages.mjs';
import {supplyTripCandidate,pendingSupplyTrips} from './supply-journey.mjs';
import {naturalWorld} from '../shared/landscape.js';
import {treadHeight} from './climbing.mjs';
import {homeAccount} from '../shared/frontier.js';
import {knownPlace} from './frontier-knowledge.mjs';
import {conditionOf,structurePerformance,activeParts} from '../shared/structure-performance.js';
import {recordWorkmanship,workQuality,noteStructureProblem} from './structure-lifecycle.mjs';
import {coverEffectiveness} from './structures.mjs';
import {constructionSpec,constructionBlockers,bindingCoils,bindingLength,CORDAGE_LENGTH_MM} from '../shared/craft.js';
import {recordPractice} from '../engine/craft-practice.js';
import {preparationFor,craftTool,toolPlan} from './crafting.mjs';
import {materialSources,harvestSite} from './resource-sites.mjs';
import {distance} from '../engine/navigation.js';
import {coordForPosition} from '../engine/spectator.js';
import {addEvent,remember,relationship,knowsTubers} from '../engine/core.js';
import {woodCommand,projectWood} from '../engine/wood-runtime.js';
import {clock,FOOD,WOOD,CARRY,loadOf,roomFor,makeStore,ownPile,transferItems,syncHoldings,treeUnits} from './holdings.mjs';
import {liveWalkable,liveRoute,liveClear,ARRIVAL_SPACE,MAX_ROUTE_SAMPLES} from './motion.mjs';
import {partBounds} from './structures.mjs';
import {comfortCandidates} from './comfort.mjs';
const storeBy=(w,id)=>w.settlement.stores.find(s=>s.id===id);
const allowed=(a,s)=>s.ownerId===a.id||s.access==='shared'||!s.ownerId;
const materialKeys={timber:['dryWood','wetWood'],stone:['stones'],reeds:['reeds'],clay:['clay']};
const units=(s,material)=>materialKeys[material].reduce((n,k)=>n+(s.items?.[k]||s.inventory?.[k]||0),0);
export function interactionPoint(w,a,position,{radius=1.15,extra=[],accept=()=>true}={}){
 const budget={remaining:MAX_ROUTE_SAMPLES};
 const options=[...extra];for(let i=0;i<12;i++){const ang=i*Math.PI/6;options.push({x:position.x+Math.sin(ang)*radius,y:position.y+Math.cos(ang)*radius});}
 options.sort((p,q)=>distance(p,a.coordinates)-distance(q,a.coordinates));
 for(const p of options){if(budget.remaining<=0)break;if(!accept(p)||!liveWalkable(w,p)||w.agents.some(b=>b.id!==a.id&&!b.life?.carriedBy&&(distance(p,b.coordinates)<1.1||b.task?.destination&&distance(p,b.task.destination)<1.1)))continue;if(liveRoute(w,a.coordinates,p,a,budget))return p;}return null;
}
function assemblyPoint(w,a,p,part){
 const b=partBounds(p,part),x=Math.max(b.minX,Math.min(b.maxX,a.coordinates.x)),y=Math.max(b.minZ,Math.min(b.maxZ,a.coordinates.y));
 const options=[{x:b.minX-.65,y},{x:b.maxX+.65,y},{x,y:b.minZ-.65},{x,y:b.maxZ+.65}];
 const bb=p.bounds;if(p.purpose==='storage'||p.affordances?.storage?.enclosed)options.push({x:bb.minX-.65,y},{x:bb.maxX+.65,y},{x,y:bb.minZ-.65},{x,y:bb.maxZ+.65});
 return interactionPoint(w,a,{x,y},{radius:.8,extra:options,accept:q=>Math.hypot(Math.max(b.minX-q.x,q.x-b.maxX,0),Math.max(b.minZ-q.y,q.y-b.maxZ,0))<=1.6&&(!(p.purpose==='storage'||p.affordances?.storage?.enclosed)||q.x<=bb.minX-.4||q.x>=bb.maxX+.4||q.y<=bb.minZ-.4||q.y>=bb.maxZ+.4)});
}
export function materialNeed(p,material){return p.parts.filter(x=>!x.built&&!x.invested&&x.material===material).reduce((n,x)=>n+x.materialUnits,0);}
export function findMaterialSource(w,a,material,{range=45,projectId=null}={}){
 const sources=[];for(const s of w.settlement.stores)if(knownPlace(w,a,s)&&allowed(a,s)&&(s.kind!=='site'||s.projectId===projectId||w.settlement.projects.find(p=>p.id===s.projectId)?.status==='complete')&&units(s,material)>0&&!(material==='timber'&&a.needs.warmth<40&&s.id===homeAccount(w,'camp-drying')&&units(s,'timber')<=2))sources.push({kind:'take',storeId:s.id,position:s.position,item:materialKeys[material].find(k=>s.items[k]>0)});
 if(material==='timber'){
  // Build a fresh projection once per query. Re-scanning every wood batch
  // for each remembered tree made planning quadratic as exploration grew.
  // Nothing is cached across transfers, depletion, construction or reloads.
  const timber=new Map();for(const b of w.wood.batches)if(b.holder.kind==='ground')timber.set(b.holder.id,(timber.get(b.holder.id)||0)+b.units);
  for(const t of w.settlement.trees)if(knownPlace(w,a,t)&&(timber.get(t.id)||0)>0&&(a.inventory.boundSharpTool>0||!(t.handGathered>=1)))sources.push({kind:'harvest',treeId:t.id,position:t.position,item:'wetWood'});
 }
 if(material==='timber'){const log=w.worldModel.objects.find(o=>o.type==='fallen_tree'&&(!w.homeContext||(o.homeId||'willow-basin')===w.homeContext.id));if(log)for(const item of ['dryWood','wetWood'])if(w.resources[item]>0)sources.push({kind:'fallen',position:log.position,item});}
 for(const node of materialSources(w,material,a))sources.push({kind:'gather',nodeId:node.nodeId,resource:node.resource,position:node.position,item:node.item,sourceId:node.id,homeId:node.homeId});
 return sources.filter(s=>!naturalWorld(w)||distance(a.coordinates,s.position)<=range).sort((x,y)=>distance(a.coordinates,x.position)-distance(a.coordinates,y.position));
}
function itemSources(w,a,item,p){
 const sources=w.settlement.stores.filter(s=>knownPlace(w,a,s)&&allowed(a,s)&&s.items[item]>0&&(s.kind!=='site'||s.projectId===p?.id||w.settlement.projects.find(p=>p.id===s.projectId)?.status==='complete')).map(s=>({kind:'take',storeId:s.id,item,position:s.position}));
 for(const n of w.resourceSites.nodes)if(n.item===item&&n.remaining>0&&(n.knownBy.includes(a.id)||distance(a.coordinates,n.position)<9))sources.push({kind:'gather',nodeId:n.id,item,position:n.position});
 return sources.sort((s,t)=>distance(a.coordinates,s.position)-distance(a.coordinates,t.position));
}
export function settlementCandidates(w,a){
 if(!w.settlement)return [];const result=[...comfortCandidates(w,a),...pendingSupplyTrips(w,a)],l=loadOf(w,a),full=l.mass>CARRY.mass*.72||l.volume>CARRY.volume*.72;
 const offer=(id,label,score,job,position,opts={})=>{if(a.liveFailures?.[id]&&clock(w)-a.liveFailures[id].at<10)return;if(w.frontier&&distance(a.coordinates,position)>80)return;const store=job.storeId?storeBy(w,job.storeId):null;const destination=interactionPoint(w,a,position,{...opts,radius:store?.radius?store.radius+.65:opts.radius||1.15});if(destination)result.push({id,label,score:score-distance(a.coordinates,destination)*.18,reasons:[['physical task',score]],job:{...job,destination,position}});};
 const craftKeep={};
 const offerSupply=(id,label,score,source,p,quantity,{deliver=false}={})=>{
  if(!roomFor(w,a,source.item))return false;
  const before=result.length;
  if(distance(a.coordinates,source.position)<=45)offer(id,label,score,{...source,projectId:p?.id,quantity,minutes:source.kind==='harvest'?6:source.kind==='take'?.5:2},source.position);
  if(result.length>before)return true;
  const trip=supplyTripCandidate(w,a,p,source,quantity,{score,deliver});if(trip){result.push(trip);return true;}return false;
 };
 for(const s of w.settlement.stores.filter(s=>s.kind==='site'&&!s.folded&&allowed(a,s)&&knownPlace(w,a,s)&&w.settlement.projects.find(p=>p.id===s.projectId)?.status==='complete')){
  const item=Object.keys(s.items).find(k=>s.items[k]>0);
  if(item){if(roomFor(w,a,item))offer('clear_rack:'+s.id,'Clear spare materials from the finished building rack',56,{kind:'take',storeId:s.id,item,quantity:Math.min(4,roomFor(w,a,item)),minutes:.75},s.position);}
  else offer('fold_rack:'+s.id,'Fold away the finished building rack',60,{kind:'fold_rack',storeId:s.id,minutes:1.5},s.position);
 }
 const offerPreparation=(plan,p,score=74)=>{
  if(!plan)return;
  // Preserve carried inputs through the ordinary cargo deposit flow.
  for(const key of ['stones','reeds','cordage','woodPole','sharpStone','boundSharpTool','dryWood','wetWood'])craftKeep[key]=Math.max(craftKeep[key]||0,Math.min(a.inventory[key]||0,{stones:2,reeds:3,cordage:1,woodPole:1,sharpStone:1,boundSharpTool:1,dryWood:1,wetWood:1}[key]));
  // A binding/tool already made by real work can be fetched. Recursing
  // straight into its raw recipe stranded builds beside stocked containers.
  const finished=[];
  for(const goal of new Set([plan.goal,plan.intermediate].filter(Boolean))){
   craftKeep[goal]=Math.max(craftKeep[goal]||0,a.inventory[goal]||0);
   if(goal!==plan.goal&&(a.inventory[goal]||0)>=1)continue;
   finished.push(...itemSources(w,a,goal,p).map(source=>({source,quantity:goal===plan.goal?plan.goalQuantity||1:1})));
  }
  const fetch=({source,quantity})=>offerSupply(`fetch_tool:${p?.id||'practice'}:${source.storeId||source.nodeId}:${source.item}`,`Collect ${source.item} for ${p?.name||'the work'}`,score+4,source,p,quantity);
  for(const option of finished.filter(x=>distance(a.coordinates,x.source.position)<=45))if(fetch(option))return;
  if(plan.craft){const id=`craft:${plan.craft}`;if(!a.liveFailures?.[id]||clock(w)-a.liveFailures[id].at>=10)result.push({id,label:plan.label,score,reasons:[['construction prerequisite',score]],job:{kind:'craft',item:plan.craft,projectId:p?.id,destination:{...a.coordinates},minutes:plan.minutes}});return;}
  const material={stones:'stone',reeds:'reeds',timber:'timber'}[plan.item];
  if(!material)return;
  const substitute=plan.item==='reeds'?'longFiber':plan.item==='stones'?'flint':null;
  const inputs=[...(substitute?itemSources(w,a,substitute,p).map(source=>({source,quantity:1})):[]),...findMaterialSource(w,a,material,{range:Infinity,projectId:p?.id}).map(source=>({source,quantity:plan.quantity}))].sort((x,y)=>distance(a.coordinates,x.source.position)-distance(a.coordinates,y.source.position));
  const collect=({source,quantity})=>offerSupply(`tool_supply:${source.treeId||source.storeId||source.nodeId||source.sourceId||source.item}`,`Collect ${source.item} for tools and joints`,score,source,p,quantity);
  for(const option of inputs.filter(x=>distance(a.coordinates,x.source.position)<=45).slice(0,12))if(collect(option))return;
  for(const option of finished.filter(x=>distance(a.coordinates,x.source.position)>45))if(fetch(option))return;
  for(const option of inputs.filter(x=>distance(a.coordinates,x.source.position)>45).slice(0,12))if(collect(option))return;
  result.push({id:'explore',label:'Explore for tool materials',projectId:p?.id,score:score-12,reasons:[['missing known tool supplies',score-12]]});
 };
 const maintenance=w.settlement.projects.filter(p=>knownPlace(w,a,p)&&(p.ownerId===a.id||p.access==='shared')&&!p.supersededBy);
 for(const p of maintenance){if(naturalWorld(w)&&distance(a.coordinates,p.position)>60)continue;
  const part=p.parts.find(x=>x.built&&conditionOf(x)<(p.maintenanceRequested?.by===a.id?.95:.65)&&(x.requires||[]).every(id=>conditionOf(p.parts.find(x=>x.id===id))>.12));if(!part)continue;
  const repairing=p.repair?.partId===part.id?p.repair:null,needed=repairing?.materialUnits??Math.max(1,Math.ceil(part.materialUnits*(conditionOf(part)<=.12?1:.35)));
  const repairPart={...part,invested:!!repairing?.invested,materialUnits:needed},plan=preparationFor(a,repairPart,p),base=30+(1-conditionOf(part))*40+(p.maintenanceRequested?.by===a.id?15:0);
  if(plan){offerPreparation(plan,p,base+5);continue;}
  for(const k of materialKeys[part.material])craftKeep[k]=Math.max(craftKeep[k]||0,Math.min(a.inventory[k]||0,needed));
  craftKeep.cordage=Math.max(craftKeep.cordage||0,bindingCoils(part,p));
  if(repairing?.invested||units(a,part.material)>=needed){const destination=assemblyPoint(w,a,p,part);if(destination&&(!a.liveFailures?.[`repair:${p.id}:${part.id}`]||clock(w)-a.liveFailures[`repair:${p.id}:${part.id}`].at>=10))result.push({id:`repair:${p.id}:${part.id}`,label:`Repair ${part.id} · ${p.name}`,score:base,reasons:[['restore useful construction',base]],job:{kind:'repair',projectId:p.id,partId:part.id,destination,minutes:6+needed*3}});}
  else for(const source of findMaterialSource(w,a,part.material)){if(!roomFor(w,a,source.item))continue;const before=result.length;offer(`repair_supply:${p.id}:${source.treeId||source.storeId||source.sourceId||source.item}`,`Collect repair material for ${p.name}`,base,{...source,quantity:needed-units(a,part.material),minutes:source.kind==='harvest'?6:2},source.position);if(result.length>before)break;}
 }
 for(const p of w.settlement.projects.filter(p=>knownPlace(w,a,p)&&(p.ownerId===a.id||p.access==='shared')&&(p.purpose==='shelter'||p.affordances?.restPoints?.length)))if(a.needs.energy<65&&coverEffectiveness(w,p.affordances?.restPoints?.[0]||p.position)>0)offer(`rest_at:${p.id}`,`Rest in ${p.name}`,(100-a.needs.energy)*1.1+12,{kind:'rest',projectId:p.id,minutes:60},p.affordances?.restPoints?.[0]||p.position,{radius:.3,extra:p.affordances?.restPoints||[p.position]});
 // Food can only be withdrawn after walking to a real, finite store. A norm
 // penalty makes theft a desperate option, never a scheduled story event.
 for(const s of w.settlement.stores){if(!knownPlace(w,a,s))continue;
  if(allowed(a,s)&&s.items.dryWood>0&&a.inventory.dryWood<1&&!w.structures.fire&&a.needs.warmth<40&&roomFor(w,a,'dryWood'))offer(`retrieve_fuel:${s.id}`,'Collect stored fuel for the fire',85,{kind:'take',storeId:s.id,item:'dryWood',quantity:2,minutes:.5},s.position);
  const mine=allowed(a,s);if(!mine&&(s.secured||a.needs.hunger>=8))continue;
  const edible=FOOD.find(k=>s.items[k]>0&&(k!=='tubers'||knowsTubers(a)));if(!edible||!roomFor(w,a,edible)||FOOD.some(k=>a.inventory[k]>0))continue;
  const need=(100-a.needs.hunger)*1.2,penalty=mine?0:48+a.traits.cooperation*25;
  offer(`retrieve_food:${s.id}:${edible}`,`${mine?'Collect':'Take'} ${edible} from ${s.name}`,need-penalty+(mine?8:(8-a.needs.hunger)*9),{kind:'take',storeId:s.id,item:edible,quantity:2,minutes:.5,theft:!mine},s.position);
 }
 const projects=w.settlement.projects.filter(p=>{const owner=w.agents.find(b=>b.id===p.ownerId);return (!naturalWorld(w)||distance(a.coordinates,p.position)<60)&&knownPlace(w,a,p)&&p.status!=='complete'&&(p.ownerId===a.id||p.access==='shared'&&(!owner||(relationship(w,a,owner)?.trust??34)>=20));}).sort((p,q)=>(p.ownerId===a.id?0:1)-(q.ownerId===a.id?0:1));
 const nextParts=new Map();
 for(const p of projects){const active=activeParts(p),stock=storeBy(w,p.stockpileId),base=53+(p.ownerId===a.id?4:0)+(p.affordances?.restSurfaces?.length?Math.max(0,65-(a.comfort?.value??55))*.3:0),available=p.parts.filter(part=>!part.built&&part.requires.every(id=>active.has(id))&&(!part.worker||part.worker===a.id||!w.agents.some(b=>b.id===part.worker&&b.task?.selected?.job?.partId===part.id&&b.task?.selected?.job?.projectId===p.id)));
  // Source order is not a compulsory construction sequence. Finish invested
  // work, or use carried/racked materials on another supported component,
  // before chasing a missing prerequisite for the first part in the program.
  const prepared=available.filter(part=>!preparationFor(a,part,p)),ready=prepared.find(part=>part.invested)||prepared.find(part=>units(a,part.material)>=part.materialUnits)||prepared.find(part=>units(a,part.material)+units(stock,part.material)>=part.materialUnits)||available[0];
  if(ready)nextParts.set(p.id,ready);
  if(stock.folded){offer('unfold_rack:'+stock.id,'Set up the reused building rack for '+p.name,base+20,{kind:'unfold_rack',storeId:stock.id,projectId:p.id,minutes:1.5},stock.position);continue;}
  // A fetched binding remains a construction input even after preparation
  // becomes satisfied. Otherwise ordinary cargo handling puts it straight
  // back, and the next decision fetches the same cord again.
  if(ready&&!ready.invested)craftKeep.cordage=Math.max(craftKeep.cordage||0,bindingCoils(ready,p));
  const preparation=ready&&preparationFor(a,ready,p);if(preparation){offerPreparation(preparation,p);continue;}
  if(ready&&!(a.liveFailures?.[`build:${p.id}:${ready.id}`]&&clock(w)-a.liveFailures[`build:${p.id}:${ready.id}`].at<10)&&(ready.invested||units(a,ready.material)>=ready.materialUnits)){
   const destination=assemblyPoint(w,a,p,ready);if(destination)result.push({id:`build:${p.id}:${ready.id}`,label:`Assemble ${ready.id} · ${p.name}`,score:base+12,reasons:[['planned construction',base]],job:{kind:'assemble',projectId:p.id,partId:ready.id,destination,minutes:ready.requiredMinutes}});
  }
  if(ready&&!ready.invested&&units(a,ready.material)<ready.materialUnits&&units(stock,ready.material)+units(a,ready.material)>=ready.materialUnits){const key=materialKeys[ready.material].find(k=>stock.items[k]>0);offer(`fetch_part:${p.id}:${ready.id}`,`Carry material to ${ready.id} · ${p.name}`,base+11,{kind:'take',projectId:p.id,storeId:stock.id,item:key,quantity:ready.materialUnits-units(a,ready.material),minutes:.5},stock.position);}
  for(const material of Object.keys(p.bill)){
   const missing=materialNeed(p,material)-units(stock,material);if(missing<=0)continue;
   const carried=materialKeys[material].find(k=>a.inventory[k]>0);
   if(carried)offer(`deliver:${p.id}:${material}`,`Carry ${material} to ${p.name}`,base+9,{kind:'deliver',projectId:p.id,storeId:stock.id,item:carried,quantity:missing,minutes:.5},stock.position);
   else if(!full){const sources=findMaterialSource(w,a,material,{range:Infinity});if(!sources.length&&material==='timber'&&!a.inventory.boundSharpTool)offerPreparation(toolPlan(a,'boundSharpTool'),p);if(!sources.length)result.push({id:'explore',label:'Explore for '+material+' · '+p.name,projectId:p.id,score:base+4,reasons:[['missing locally known building material',base+4]]});for(const source of sources.slice(0,12))if(offerSupply(`supply:${p.id}:${source.treeId||source.storeId||source.sourceId||source.resource}`,`Collect ${material} for ${p.name}`,base+(ready?.material===material?4:0),source,p,Math.min(4,missing),{deliver:true}))break;}
  }
 }
 // Keep a little food and tools on the body, put bulk goods in owned storage.
 const nextPart=nextParts.get(projects[0]?.id),food=FOOD.find(k=>a.inventory[k]>0),tool=a.inventory.boundSharpTool?'boundSharpTool':'sharpStone';
 const keep=Object.fromEntries(Object.keys(a.inventory).map(k=>[k,k===food?2:['resin','flint','longFiber','potteryClay'].includes(k)?2:projects.length?(k===tool?1:0):['sharpStone','boundSharpTool','firedVessel'].includes(k)?1:0]));
 for(const [key,n]of Object.entries(craftKeep))keep[key]=Math.max(keep[key]||0,n);
 for(const t of [a.task,...(a.suspendedTasks||[])])for(const [key,n]of Object.entries(t?.supplyJourney?.collected||{}))keep[key]=Math.max(keep[key]||0,Math.min(n,a.inventory[key]||0));
 if(a.freeTime?.practice&&clock(w)-a.freeTime.practice.at<240)for(const key of ['stones','reeds','cordage','woodPole','sharpStone','boundSharpTool','dryWood','wetWood'])keep[key]=Math.max(keep[key]||0,Math.min(a.inventory[key]||0,{stones:2,reeds:3,cordage:1,woodPole:1,sharpStone:1,boundSharpTool:1,dryWood:1,wetWood:1}[key]));
 if(nextPart&&!nextPart.invested){let n=nextPart.materialUnits;for(const k of materialKeys[nextPart.material]){const needed=Math.min(n,a.inventory[k]||0);keep[k]=Math.max(keep[k]||0,needed);n-=needed;}}
 // Keep the raw branches needed for a basic shelter through ordinary cargo handling.
 if(a.needs.warmth<40&&!w.structures.fire){let reserve=w.structures.shelter?2:4;for(const k of ['dryWood','wetWood']){keep[k]=Math.max(keep[k]||0,Math.min(reserve,a.inventory[k]||0));reserve-=Math.min(reserve,a.inventory[k]||0);}}
 const depositKeys=Object.entries(a.inventory).filter(([k,n])=>n>(keep[k]||0)).map(([k])=>k);
 const assemblyLoadBlocked=projects.some(p=>{const part=nextParts.get(p.id);if(!part||part.invested)return false;const key=materialKeys[part.material][0];return roomFor(w,a,key)+units(a,part.material)<part.materialUnits;});
 if(depositKeys.length){const preferred=w.settlement.stores.filter(s=>(!naturalWorld(w)||knownPlace(w,a,s)&&distance(a.coordinates,s.position)<40)&&s.kind!=='site'&&allowed(a,s)&&depositKeys.some(k=>roomFor(w,s,k))).sort((x,y)=>(['storage','platform'].includes(x.kind)?0:20)-(['storage','platform'].includes(y.kind)?0:20)+distance(x.position,a.coordinates)-distance(y.position,a.coordinates));
  const usingLoad=result.some(c=>['assemble','repair','deliver','craft'].includes(c.job?.kind));
  const s=preferred[0];if(s)offer(`deposit:${s.id}`,`Put supplies in ${s.name}`,assemblyLoadBlocked?96:full&&!usingLoad?86:projects.length?8:27,{kind:'deposit',storeId:s.id,keep,minutes:.75},s.position);
  else if(full||assemblyLoadBlocked)result.push({id:'put_down_load',label:'Put down unrelated cargo for the building work',score:96,reasons:[['carrying space',96]],job:{kind:'put_down',keep,destination:{...a.coordinates},minutes:.75}});
 }
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
 let need=part.materialUnits;const binding=bindingCoils(part,p);if(units(a,part.material)<need||(a.inventory.cordage||0)<binding)return false;
 for(const key of materialKeys[part.material]){const q=Math.min(a.inventory[key]||0,need);if(!q)continue;
  if(WOOD[key])woodCommand(w,a,{from:{kind:'carried',id:a.id},to:{kind:'stored',id:`component:${p.id}:${part.id}`},quantity:q,category:key,inputForm:'branch',outputForm:'shelter-component',reason:`install carried material in ${part.id} of ${p.name}`});
  else{a.inventory[key]-=q;(part.materials??={})[key]=(part.materials[key]||0)+q;}
  need-=q;if(!need)break;
 }const length=bindingLength(part);if(length){a.inventory.cordage-=binding;p.bindingStockMm=(p.bindingStockMm||0)+binding*CORDAGE_LENGTH_MM-length;p.bindingCoilsOpened=(p.bindingCoilsOpened||0)+binding;part.bindingUsed=length/CORDAGE_LENGTH_MM;part.bindingLengthMm=length;}part.invested=true;syncHoldings(w);if(part.material==='timber'){const batches=w.wood.batches.filter(b=>b.holder.id===`component:${p.id}:${part.id}`);part.woodWaterRatio=batches.reduce((n,b)=>n+b.waterKg,0)/Math.max(.001,batches.reduce((n,b)=>n+b.dryKg,0));}return true;
}
export function workSettlement(w,a,t,minutes){
 const j=t.selected.job,s=j.storeId?storeBy(w,j.storeId):null,p=j.projectId?w.settlement.projects.find(p=>p.id===j.projectId):null;
 const fail=detail=>({done:true,success:false,detail});
 if(distance(a.coordinates,j.destination)>.4)return fail('The work location changed; walking back is required.');
 if(s&&distance(a.coordinates,s.position)>(s.radius||.8)+1.1)return fail('Storage is beyond reach.');
 if(s&&j.kind==='take'&&!allowed(a,s)&&(s.secured||a.needs.hunger>=8))return fail('Taking these owned supplies is not justified or the container is secured.');
 if(j.kind==='practice_technique'&&(!(s?.items[j.item]>0||!s&&a.inventory[j.item]>0)||s&&!allowed(a,s)))return fail('The actual practice tool or cord is no longer available here.');
 if(['fold_rack','unfold_rack'].includes(j.kind)&&(!s||s.kind!=='site'||!allowed(a,s)||j.kind==='fold_rack'&&(Object.values(s.items).some(n=>n>0)||w.settlement.projects.find(p=>p.id===s.projectId)?.status!=='complete')))return fail('The rack is still in use or its supplies must be cleared first.');
 if(j.kind==='rest'){if(!coverEffectiveness(w,a.coordinates))return fail('This shelter no longer provides protection here.');recordStructureUse(w,a,p,'rest');a.needs.energy=Math.min(100,a.needs.energy+30*(.5+.5*coverEffectiveness(w,a.coordinates))*minutes/60);t.workMinutes+=minutes;return {done:t.workMinutes>=t.requiredMinutes,success:true,detail:`${a.name} rested in ${p?.name||'the shelter'}.`};}
 if(j.kind==='repair'){
  const part=p?.parts.find(x=>x.id===j.partId);if(!part||!part.built||p.ownerId!==a.id&&p.access!=='shared')return fail('This component is not available to repair.');
  if(conditionOf(part)>=.999)return {done:true,success:true,detail:'This component is already repaired.'};
  if(part.requires.some(id=>conditionOf(p.parts.find(x=>x.id===id))<=.12))return fail('Repair the failed supporting component first.');
  const b=partBounds(p,part);if(Math.hypot(Math.max(b.minX-a.coordinates.x,a.coordinates.x-b.maxX,0),Math.max(b.minZ-a.coordinates.y,a.coordinates.y-b.maxZ,0))>1.8)return fail('The repair is beyond reach.');
  if(p.repair&&p.repair.partId!==part.id)return fail('Another component is already being repaired.');
  const r=p.repair??={partId:part.id,materialUnits:Math.max(1,Math.ceil(part.materialUnits*(conditionOf(part)<=.12?1:.35))),replacementFraction:conditionOf(part)<=.12?1:.35,workMinutes:0};
  const proxy={...part,materials:{},id:'repair-'+part.id+'-'+(part.repairs||0),materialUnits:r.materialUnits,invested:r.invested,bindingUsed:r.bindingUsed};
  const blockers=constructionBlockers(a,proxy,p);if(blockers.length)return fail(blockers.join('; '));
  if(!r.invested){if(!investPart(w,a,p,proxy))return fail('Repair supplies must be carried to the damaged component.');r.invested=true;r.bindingUsed=proxy.bindingUsed||0;r.materials=proxy.materials;r.woodWaterRatio=proxy.woodWaterRatio??0;}
  r.requiredMinutes=6+r.materialUnits*3;const worked=Math.min(minutes,r.requiredMinutes-r.workMinutes);r.workMinutes+=worked;(r.contributions??={})[a.id]=(r.contributions?.[a.id]||0)+worked;
  t.workMinutes=r.workMinutes;t.requiredMinutes=r.requiredMinutes;p.revision++;w.settlement.revision++;
  if(r.workMinutes<r.requiredMinutes)return {done:false};
  const old=part.durability;recordWorkmanship(w,a,part);const fraction=r.replacementFraction??.35;if(old?.origin==='legacy-estimate'&&fraction<1)part.durability.origin='legacy-estimate';part.durability.quality=(old?.quality??.45)*(1-fraction)+workQuality(w,a,{...part,woodWaterRatio:r.woodWaterRatio})*fraction;part.repairs=(part.repairs||0)+1;part.repairBindings=(part.repairBindings||0)+(r.bindingUsed||0);for(const [key,n]of Object.entries(r.materials||{}))(part.repairMaterials??={})[key]=(part.repairMaterials?.[key]||0)+n;
  for(const [id,n]of Object.entries(r.contributions)){const worker=w.agents.find(a=>a.id===id);if(worker)recordPractice(w,worker,part.material==='timber'?'woodworking':part.material==='reeds'?'fiberwork':part.material==='stone'?'stoneworking':'clayworking',n,'Repaired '+part.id);}
  p.repair=null;if(p.parts.every(x=>conditionOf(x)>=.95))delete p.maintenanceRequested;
  addEvent(w,'structure-repaired',`${a.name} repaired ${part.id}`,`New material and elapsed work restored this component in ${p.name}.`,{projectId:p.id,agentId:a.id});
  return {done:true,success:true,detail:'Repair completed using carried supplies and real work.'};
 }
 if(j.kind==='assemble'){
  const part=p?.parts.find(x=>x.id===j.partId);if(!part||part.built)return {done:true,success:true,detail:'This part is already in place.'};
  const blockers=constructionBlockers(a,part,p);if(blockers.length)return fail(blockers.join('; '));
  if(part.requires.some(id=>!activeParts(p).has(id)))return fail('The supporting parts must be built and sound before assembly.');
  if((p.purpose==='storage'||p.affordances?.storage)&&part.kind==='wall'&&w.agents.some(b=>b.coordinates.x>p.bounds.minX-.25&&b.coordinates.x<p.bounds.maxX+.25&&b.coordinates.y>p.bounds.minZ-.25&&b.coordinates.y<p.bounds.maxZ+.25)){t.obstructionMinutes=(t.obstructionMinutes||0)+minutes;return t.obstructionMinutes>=2?fail('Someone is occupying the wall area; do other useful work before retrying.'): {done:false};}
  t.obstructionMinutes=0;const b=partBounds(p,part),dx=Math.max(b.minX-a.coordinates.x,a.coordinates.x-b.maxX,0),dy=Math.max(b.minZ-a.coordinates.y,a.coordinates.y-b.maxZ,0);
  if(p.climbsTerrain&&b.bottom>treadHeight(w,a.coordinates,a)+1.8)return fail('This component is above working reach; finish lower treads first.');
  if(Math.hypot(dx,dy)>1.8)return fail('This component is beyond working reach.');
  if(!part.invested&&!investPart(w,a,p,part))return fail('The required material has not been carried to this component.');
  part.worker=a.id;const worked=Math.min(minutes,part.requiredMinutes-part.workMinutes);(part.craftWork??={})[a.id]=(part.craftWork?.[a.id]||0)+worked;part.workMinutes=Math.min(part.requiredMinutes,part.workMinutes+minutes);t.workMinutes=part.workMinutes;t.requiredMinutes=part.requiredMinutes;p.status='building';p.revision++;w.settlement.revision++;
  if(part.workMinutes<part.requiredMinutes)return {done:false};part.built=true;part.worker=null;recordWorkmanship(w,a,part);part.workmanship={builder:a.id,finish:constructionSpec(part).finish,tool:constructionSpec(part).tool,at:clock(w)};for(const [id,worked]of Object.entries(part.craftWork||{})){const worker=w.agents.find(x=>x.id===id);if(worker)recordPractice(w,worker,part.material==='timber'?'woodworking':part.material==='reeds'?'fiberwork':part.material==='stone'?'stoneworking':'clayworking',worked,'Assembled '+part.id+' in '+p.name);}delete part.craftWork;
  addEvent(w,'construction-part',`${a.name} placed ${part.id}`,`${p.name}: ${p.parts.filter(x=>x.built).length}/${p.parts.length} parts assembled.`,{projectId:p.id,agentId:a.id});
  completeStages(w,p);
  if(p.parts.every(x=>x.built)){
   p.status='complete';p.completedAt=clock(w);if(p.replacesProjectId){const old=w.settlement.projects.find(x=>x.id===p.replacesProjectId);if(old){old.supersededBy=p.id;addEvent(w,'structure-upgraded',`${p.name} is now usable`,`${p.designer} built this replacement for ${old.name}. The older structure and its supplies remain where they were.`,{projectId:p.id,previousProjectId:old.id});}}
   if(!p.storeId&&!p.generic&&p.purpose==='storage')p.storeId=makeStore(w,{kind:'storage',name:p.name,position:p.position,ownerId:p.ownerId,access:p.access,covered:p.covered,secured:p.secured,capacityKg:p.capacityKg,capacityVolume:p.capacityVolume,projectId:p.id,radius:Math.max(p.bounds.maxX-p.bounds.minX,p.bounds.maxZ-p.bounds.minZ)/2}).id;
   remember(w,a,`${p.name} is complete and can now be used.`,{importance:9,tags:['construction',p.purpose]});addEvent(w,'construction-complete',`${p.name} is complete`,`${p.designer}’s design was built from delivered materials and elapsed labor.`,{projectId:p.id});
  }return {done:true,success:true,detail:`${a.name} assembled ${part.id} in ${p.name}.`};
 }
 if(j.kind==='study'){
  const animal=w.ecologySystem?.wildlife?.find(x=>x.id===j.animalId&&x.active),gap=animal&&distance(a.coordinates,animal.position);
  if(!animal||gap<6||gap>12||!liveClear(w,a.coordinates,animal.position))return fail('The animal moved out of a safe, visible observation range.');
  if((a.animalStudies?.[animal.id]??-Infinity)+120>=clock(w))return fail('This animal was studied recently.');
 }
 t.workMinutes=Math.min(t.requiredMinutes,t.workMinutes+minutes);if(t.workMinutes<t.requiredMinutes)return {done:false};
 if(j.kind==='reconsider')return {done:true,success:true,detail:'Paused briefly; reconsidering reachable activities. No work or learning was credited.'};
 if(j.kind==='practice_technique'){
  if(!t.techniqueRecorded){recordPractice(w,a,j.skill,t.workMinutes,'Practiced with an existing '+j.item);t.techniqueRecorded=true;}
  return {done:true,success:true,detail:`${a.name} practiced ${j.skill} with an existing ${j.item}, leaving it intact.`};
 }
 if(['fold_rack','unfold_rack'].includes(j.kind)){s.folded=j.kind==='fold_rack';s.revision++;w.settlement.revision++;return {done:true,success:true,detail:`${a.name} ${s.folded?'folded the empty rack beside the finished building for reuse':'set up the existing rack for the next project'}.`};}
 if(j.kind==='craft')return craftTool(w,a,j.item);
 if(j.kind==='study'){const animal=w.ecologySystem.wildlife.find(x=>x.id===j.animalId);(a.animalStudies??={})[animal.id]=clock(w);recordPractice(w,a,'tracking',t.workMinutes,'Observed '+animal.species+' at a safe distance');remember(w,a,`I observed a ${animal.species} ${animal.behavior||'moving'} from a distance.`,{importance:5,tags:['wildlife','tracking']});return {done:true,success:true,detail:'Observed a real nearby animal without approaching it.'};}
 if(j.kind==='fallen'){
  const log=w.worldModel.objects.find(o=>o.type==='fallen_tree'&&(!w.homeContext||(o.homeId||'willow-basin')===w.homeContext.id));if(!log||distance(a.coordinates,log.position)>1.9)return fail('Fallen branches are beyond reach.');
  const q=Math.min(w.resources[j.item]||0,j.quantity,roomFor(w,a,j.item));if(!q)return fail('No fallen wood or carrying space remains.');woodCommand(w,a,{from:{kind:'ground',id:homeAccount(w,'log')},quantity:q,category:j.item,reason:'collect loose fallen branches for construction'});return {done:true,success:true,detail:`Collected ${q} loose fallen branches.`};
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
  if(distance(a.coordinates,j.position)>1.9)return fail('The resource is beyond reach.');const node=j.nodeId?w.resourceSites?.nodes.find(n=>n.id===j.nodeId):null;if(j.nodeId&&(!node||node.item!==j.item||distance(a.coordinates,node.position)>1.9))return fail('The material deposit is unavailable or out of reach.');const root=w.rootWorld||w,account=j.homeId&&j.homeId!=='willow-basin'?root.frontier?.homes.find(h=>h.id===j.homeId)?.resources:j.homeId?root.resources:w.resources;if(!account)return fail('The remembered resource account is unavailable.');const q=j.nodeId?harvestSite(w,j.nodeId,Math.min(j.quantity,roomFor(w,a,j.item)),a.id):Math.max(0,Math.min(account[j.resource]||0,j.quantity,roomFor(w,a,j.item)));if(!j.nodeId)account[j.resource]-=q;a.inventory[j.item]=(a.inventory[j.item]||0)+q;return {done:true,success:q>0,detail:`${a.name} gathered ${q} ${j.item} for construction.`};
 }return fail('Unknown physical job.');
}

export function recordStructureUse(w,a,p,kind){
 if(!p||!p.parts.some(x=>x.built))return;p.feedback??={uses:0,byUser:{},lastUse:null};
 const key=a.id+':'+kind,day=w.day;if(p.feedback.byUser[key]===day)return;p.feedback.byUser[key]=day;p.feedback.uses++;p.feedback.lastUse={kind,user:a.name,day};p.feedback.observations??={};p.feedback.observations[a.id]={uses:(p.feedback.observations[a.id]?.uses||0)+1,lastUse:p.feedback.lastUse};
 if(p.ownerId===a.id||p.access!=='shared')return;const owner=w.agents.find(b=>b.id===p.ownerId);if(!owner)return;
 const rel=relationship(w,a,owner);if(rel)rel.trust=Math.min(100,rel.trust+2);
 remember(w,a,`${owner.name}'s ${p.name} helped me with ${kind}.`,{importance:5,tags:['construction','useful','social']});
 // Designer learns when present; no remote knowledge of unseen appreciation.
 if(distance(owner.coordinates,a.coordinates)<9){p.feedback.observations[owner.id]={uses:(p.feedback.observations[owner.id]?.uses||0)+1,lastUse:p.feedback.lastUse};remember(w,owner,`${a.name} used my ${p.name} for ${kind}.`,{importance:6,tags:['construction','feedback']});}
}
