import {REGIONAL_ITEMS,knownPerson,campLayout} from '../shared/frontier.js';
import {clock,roomFor,transferItems,loadOf,ITEM} from './holdings.mjs';
import {knownPlace} from './frontier-knowledge.mjs';
import {interactionPoint} from './settlement.mjs';
import {liveClear} from './motion.mjs';
import {addEvent,remember,relationship} from '../engine/core.js';
import {recordPractice} from '../engine/craft-practice.js';
const gap=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const healthy=a=>Math.min(a.needs.hunger,a.needs.hydration,a.needs.energy)>40;
export function economyCandidates(w,a){
 if(!w.frontier)return [];const result=[];
 for(const node of w.resourceSites.nodes){if(!REGIONAL_ITEMS[node.item]||!node.knownBy.includes(a.id)||node.remaining<=0||a.inventory[node.item]>=2||!roomFor(w,a,node.item))continue;const useful=node.item==='flint'&&!a.inventory.sharpStone||node.item==='longFiber'&&(a.inventory.cordage||0)<2||node.item==='potteryClay'&&!a.inventory.firedVessel||node.item==='resin'&&w.settlement.projects.some(p=>p.ownerId===a.id&&p.status==='complete'&&p.parts.some(x=>x.kind==='roof'&&!x.sealant));if(!useful)continue;const destination=interactionPoint(w,a,node.position);if(!destination)continue;result.push({id:'regional:'+node.id,label:'Gather '+REGIONAL_ITEMS[node.item].name,score:34-gap(a.coordinates,destination)*.2,reasons:[['useful local material',34]],job:{kind:'gather',nodeId:node.id,item:node.item,quantity:2,position:node.position,destination,minutes:3}});}
 if(a.inventory.potteryClay>=2&&!a.inventory.rawClayVessel&&!a.inventory.firedVessel)result.push({id:'regional:shape-vessel',label:'Shape a vessel from fine pottery clay',score:37,reasons:[['durable water vessel',37]],job:{kind:'regional_craft',operation:'vessel',minutes:12,destination:{...a.coordinates}}});
 if(a.inventory.rawClayVessel>0&&!a.inventory.firedVessel&&w.structures.fire){const fire=campLayout(w).fire,destination=interactionPoint(w,a,fire,{radius:1.9});if(destination)result.push({id:'regional:fire-vessel',label:'Fire the clay vessel beside the hearth',score:42,reasons:[['make a water-resistant vessel',42]],job:{kind:'regional_craft',operation:'fire',position:fire,minutes:60,destination}});}
 for(const p of w.settlement.projects.filter(p=>p.status==='complete'&&knownPlace(w,a,p)&&(p.ownerId===a.id||p.access==='shared'))){const part=p.parts.find(x=>x.built&&x.kind==='roof'&&!x.sealant&&['timber','reeds'].includes(x.material)),units=part&&Math.ceil(part.size[0]*part.size[2]/2);if(!part||!(a.inventory.resin>=units))continue;const destination=interactionPoint(w,a,p.position,{radius:1.5});if(destination)result.push({id:'seal:'+p.id+':'+part.id,label:'Seal '+p.name+' roofing with resin',score:38,reasons:[['reduce rain leakage and weathering',38]],job:{kind:'regional_craft',operation:'seal',projectId:p.id,partId:part.id,units,minutes:12*units,destination}});}
 if(!healthy(a))return result.filter(c=>!a.liveFailures?.[c.id]||clock(w)-a.liveFailures[c.id].at>=10);
 for(const b of w.agents){if(b.id===a.id||b.householdId===a.householdId||!knownPerson(a,b)||!healthy(b)||(relationship(w,a,b)?.trust??0)<20||gap(a.coordinates,b.coordinates)>6||!liveClear(w,a.coordinates,b.coordinates)||(a.tradeCooldowns?.[b.id]||0)>clock(w))continue;const pair=barterOffer(w,a,b);if(!pair)continue;const destination=interactionPoint(w,a,b.coordinates,{radius:1.5});if(destination)result.push({id:'trade:'+b.id,label:'Offer '+REGIONAL_ITEMS[pair.give].name+' to '+b.name,score:45,reasons:[['exchange surplus for an unfamiliar useful material',45]],job:{kind:'trade',partnerId:b.id,...pair,minutes:4,destination}});}
 return result.filter(c=>!a.liveFailures?.[c.id]||clock(w)-a.liveFailures[c.id].at>=10);
}
export function barterOffer(w,a,b){
 // Both retain a useful reserve and must gain a material they do not carry.
 const keys=Object.keys(REGIONAL_ITEMS),give=keys.find(k=>(a.inventory[k]||0)>=2&&!(b.inventory[k]>0)),take=keys.find(k=>(b.inventory[k]||0)>=2&&!(a.inventory[k]>0));
 if(!give||!take||roomFor(w,a,take)<1||roomFor(w,b,give)<1)return null;return {give,take};
}
export function workEconomy(w,a,t,minutes){const j=t.selected.job,fail=detail=>({done:true,success:false,detail});
 if(j.kind==='trade'){
  const b=w.agents.find(b=>b.id===j.partnerId);if(!b||!healthy(a)||!healthy(b)||gap(a.coordinates,b.coordinates)>2.2||!liveClear(w,a.coordinates,b.coordinates)||b.task&&!['relax','reconsider'].includes(b.task.selected?.job?.kind)||(a.tradeCooldowns?.[b.id]||0)>clock(w))return fail('The other person is unavailable or the meeting has moved apart.');
  const offer=barterOffer(w,a,b);if(!offer||offer.give!==j.give||offer.take!==j.take)return fail('The supplies or willingness to exchange have changed.');t.workMinutes=Math.min(t.requiredMinutes,t.workMinutes+minutes);if(t.workMinutes<t.requiredMinutes)return {done:false};
  // Checked within the serial simulation turn before either finite transfer.
  const give=transferItems(w,a,b,j.give,1),take=transferItems(w,b,a,j.take,1);if(give!==1||take!==1)throw Error('Validated barter transfer failed');
  (a.tradeCooldowns??={})[b.id]=clock(w)+360;(b.tradeCooldowns??={})[a.id]=clock(w)+360;const detail=`${a.name} ${a.surname} exchanged one ${REGIONAL_ITEMS[j.give].name} with ${b.name} ${b.surname} for one ${REGIONAL_ITEMS[j.take].name}.`;
  addEvent(w,'trade','Goods exchanged in person',detail,{agentIds:[a.id,b.id],give:j.give,take:j.take,position:{...a.coordinates}});for(const p of [a,b])remember(w,p,detail,{importance:8,tags:['trade','first-contact']});return {done:true,success:true,detail};
 }
 if(j.operation==='fire'&&(!w.structures.fire||gap(a.coordinates,j.position)>2.5||a.inventory.rawClayVessel<1))return fail('Firing stopped because heat, reach or the clay vessel was unavailable.');
 t.workMinutes=Math.min(t.requiredMinutes,t.workMinutes+minutes);if(t.workMinutes<t.requiredMinutes)return {done:false};
 if(j.operation==='vessel'){if(a.inventory.potteryClay<2||roomFor(w,a,'rawClayVessel')<1)return fail('Insufficient pottery clay or carrying space.');a.inventory.potteryClay-=2;a.inventory.rawClayVessel++;recordPractice(w,a,'clayworking',12,'Shaped fine pottery clay into a vessel');return {done:true,success:true,detail:'Two units of fine clay became one unfired vessel through elapsed shaping.'};}
 if(j.operation==='fire'){a.inventory.rawClayVessel--;a.inventory.firedVessel++;recordPractice(w,a,'clayworking',60,'Fired a clay vessel over a continuously fueled fire');return {done:true,success:true,detail:'The clay vessel was fired with sustained heat from finite fuel.'};}
 if(j.operation==='seal'){const p=w.settlement.projects.find(p=>p.id===j.projectId),part=p?.parts.find(p=>p.id===j.partId);if(!part||part.sealant||a.inventory.resin<j.units||gap(a.coordinates,p.position)>3.5)return fail('The roof or carried resin is unavailable.');a.inventory.resin-=j.units;part.sealant={kind:'pine-resin',units:j.units,appliedAt:clock(w),worker:a.id};p.revision++;return {done:true,success:true,detail:'Carried pine resin now reduces rain leakage and weathering on this roof.'};}
 return fail('Unknown material process.');
}
