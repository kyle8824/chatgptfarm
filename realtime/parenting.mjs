import {clamp,relationship} from '../engine/core.js';
import {distance} from '../engine/navigation.js';
import {clock} from './holdings.mjs';
import {ageYears,isAdult,lifeStage} from './life.mjs';
import {liveRoute,liveClear,liveWalkable,advanceLiveRoute,motionState} from './motion.mjs';
import {interactionPoint} from './settlement.mjs';
import {waterBankPoints,withinWaterReach} from './water.mjs';

export const dependents=(w,a)=>w.agents.filter(c=>c.life?.parents.includes(a.id)&&!isAdult(w,c));
const edible=a=>['berries','cookedMeat',...(a.skills?.['tuber-edible']?['tubers']:[])].find(k=>a.inventory[k]>=1);
const canNurse=(w,a,c)=>ageYears(w,c)<1&&c.life.parents[0]===a.id&&a.life.lastBirthAt!==null&&a.needs.hunger>30&&a.needs.hydration>30&&a.needs.energy>20;
export function familyFoodNeed(w,a){return edible(a)?0:Math.max(0,...dependents(w,a).filter(c=>ageYears(w,c)>=.5&&!canNurse(w,a,c)).map(c=>c.needs.hunger<60?100-c.needs.hunger:0));}
export function parentingCandidates(w,a){
 if(!isAdult(w,a))return [];
 const result=[];
 for(const c of dependents(w,a)){
  if(w.agents.some(p=>p.id!==a.id&&p.task?.selected?.job?.childId===c.id))continue;
  const near=distance(a.coordinates,c.coordinates),nurse=canNurse(w,a,c),food=edible(a),destination=c.life.carriedBy===a.id?{...a.coordinates}:interactionPoint(w,a,c.coordinates,{radius:1.5});
  const offer=(mode,label,score,minutes,to=destination)=>{if(to)result.push({id:`care:${mode}:${c.id}`,label,score:score-near*.2,reasons:[['dependent child needs care',score]],job:{kind:'care',mode,childId:c.id,minutes,destination:to,reason:`${c.name} depends on adult care. Help requires reaching them and spending real time.`}});};
  if(nurse&&Math.min(c.needs.hunger,c.needs.hydration)<65)offer('nurse',`Feed ${c.name}`,25+(100-Math.min(c.needs.hunger,c.needs.hydration))*1.3,5);
  else if(food&&c.needs.hunger<65&&ageYears(w,c)>=.5)offer('feed',`Prepare food for ${c.name}`,25+(100-c.needs.hunger)*1.3,4);
  if(!nurse&&c.needs.hydration<55&&ageYears(w,c)>=1){const bank=waterBankPoints(w,a.coordinates).sort((p,q)=>distance(p,a.coordinates)-distance(q,a.coordinates)).find(p=>liveWalkable(w,p)&&liveRoute(w,a.coordinates,p,a));offer('water',`Take ${c.name} to drink`,30+(100-c.needs.hydration)*1.3,2,bank);}
  if(c.needs.warmth<50||(c.youth?.attention??70)<45)offer('comfort',`Comfort and spend time with ${c.name}`,15+Math.max(100-c.needs.warmth,100-(c.youth?.attention??70))*.6,8);
 }
 return result;
}
export function workParenting(w,a,t,minutes){
 const j=t.selected.job,c=w.agents.find(p=>p.id===j.childId),fail=detail=>({done:true,success:false,detail});
 if(!c||isAdult(w,c)||!c.life.parents.includes(a.id))return fail('This child no longer needs this care.');
 if(distance(a.coordinates,c.coordinates)>2.5||!liveClear(w,a.coordinates,c.coordinates)||distance(a.coordinates,j.destination)>.5){t.waitMinutes=(t.waitMinutes||0)+minutes;return t.waitMinutes>30?fail('Could not reach the child to provide care.'):{done:false};}
 if(j.mode==='water'&&(!withinWaterReach(w,c.coordinates)||!withinWaterReach(w,a.coordinates))){t.waitMinutes=(t.waitMinutes||0)+minutes;return t.waitMinutes>30?fail('No safe shared access to water was reached.'):{done:false};}
 if(j.mode==='nurse'&&!canNurse(w,a,c))return fail('The nursing parent needs food, water or rest first.');
 if(j.mode==='feed'&&!t.carePortion){const item=edible(a);if(!item)return fail('There is no carried food to prepare.');a.inventory[item]--;t.carePortion={item,remaining:1};}
 const spent=Math.min(minutes,Math.max(0,t.requiredMinutes-t.workMinutes)),fraction=spent/t.requiredMinutes;
 if(j.mode==='nurse'){a.needs.hunger=clamp(a.needs.hunger-7*fraction);a.needs.hydration=clamp(a.needs.hydration-7*fraction);a.needs.energy=clamp(a.needs.energy-3*fraction);c.needs.hunger=clamp(c.needs.hunger+35*fraction);c.needs.hydration=clamp(c.needs.hydration+35*fraction);}
 if(j.mode==='feed'){const used=Math.min(t.carePortion.remaining,fraction);t.carePortion.remaining-=used;c.needs.hunger=clamp(c.needs.hunger+(t.carePortion.item==='cookedMeat'?46:28)*used);}
 if(j.mode==='water')c.needs.hydration=clamp(c.needs.hydration+35*fraction);
 c.youth??={attention:70};c.youth.attention=clamp((c.youth.attention??70)+spent*3);
 if(j.mode==='comfort')c.needs.warmth=clamp(c.needs.warmth+Math.max(0,a.needs.warmth-c.needs.warmth)*Math.min(1,spent/20));
 t.workMinutes+=spent;
 if(t.workMinutes+1e-8<t.requiredMinutes)return {done:false};
 if(!t.careRecorded){t.careRecorded=true;const r=relationship(w,a,c);if(r){r.trust=clamp(r.trust+1);r.familiarity=clamp(r.familiarity+2);r.affinity=clamp(r.affinity+1);}}
 return {done:true,success:true,detail:`${a.name} finished caring for ${c.name}${j.mode==='feed'?` using one ${t.carePortion.item} portion`:j.mode==='nurse'?'; nursing used the parent’s nutrition, hydration and energy':j.mode==='water'?' at the creek':''}.`};
}
function moveChild(w,c,destination,seconds){
 const y=c.youth,now=clock(w);
 if(!y.route||distance(y.route.destination,destination)>1||now-(y.routeAt||0)>2){const path=liveRoute(w,c.coordinates,destination,c);y.routeAt=now;y.route=path?{path,pathIndex:1,destination,egressing:!liveWalkable(w,c.coordinates)}:null;}
 if(!y.route)return false;
 const result=advanceLiveRoute(w,c,y.route,seconds);if(result.blocked||result.arrived)y.route=null;return !result.blocked;
}
export function advanceChild(w,c,seconds){
 c.youth??={attention:70};const y=c.youth,n=c.needs,hours=seconds/3600,stage=lifeStage(w,c),parents=c.life.parents.map(id=>w.agents.find(a=>a.id===id)).filter(Boolean);
 c.task=null;c.activeAction=null;c.restSupport=null;c.suspendedTasks=[];motionState(c).speed=0;
 n.hunger=clamp(n.hunger-(stage==='infant'?6:4.2)*hours);n.hydration=clamp(n.hydration-(stage==='infant'?6:6.5)*hours);y.attention=clamp((y.attention??70)-hours*4);
 const carrier=w.agents.find(a=>a.id===c.life.carriedBy);
 if(stage==='infant'&&carrier){c.coordinates={...carrier.coordinates};c.position=carrier.position;n.energy=clamp(n.energy+hours*8);n.warmth=clamp(n.warmth+(carrier.needs.warmth-n.warmth)*Math.min(1,hours*.5));c.currentAction=Math.min(n.hunger,n.hydration)<35?'Calling for feeding':`Being carried by ${carrier.name}`;return;}
 const carer=parents.find(a=>a.task?.selected?.job?.childId===c.id)||parents.sort((a,b)=>distance(a.coordinates,c.coordinates)-distance(b.coordinates,c.coordinates))[0];
 n.energy=clamp(n.energy+(n.energy<45?12:-2.8)*hours);n.warmth=clamp(n.warmth+(w.temperature<50?-2:1)*hours);
 if(n.hydration<80&&withinWaterReach(w,c.coordinates)){n.hydration=clamp(n.hydration+seconds*35/120);c.currentAction='Drinking at the creek';return;}
 const food=edible(c);if(food&&n.hunger<65){if(!y.portion){c.inventory[food]--;y.portion={item:food,remaining:1};}const used=Math.min(y.portion.remaining,seconds/60);y.portion.remaining-=used;n.hunger=clamp(n.hunger+28*used);if(y.portion.remaining<=0)delete y.portion;c.currentAction='Eating a prepared portion';return;}
 if(carer){
  const watering=carer.task?.selected?.job?.childId===c.id&&carer.task.selected.job.mode==='water'&&withinWaterReach(w,carer.coordinates);
  if(distance(c.coordinates,carer.coordinates)>2.4||y.needsSpace||watering&&!withinWaterReach(w,c.coordinates)){
   let destination=y.route?.destination;
   if(!destination||distance(destination,carer.coordinates)>3||watering&&!withinWaterReach(w,destination)){
    if((y.reconsiderAt??-Infinity)<=clock(w)){
     y.reconsiderAt=clock(w)+.25;
     destination=watering?waterBankPoints(w,c.coordinates).sort((p,q)=>distance(p,c.coordinates)-distance(q,c.coordinates)).find(p=>distance(p,carer.coordinates)<2.5&&distance(p,carer.coordinates)>1.15&&liveRoute(w,c.coordinates,p,c)):interactionPoint(w,c,carer.coordinates,{radius:1.65});
    }else destination=null;
   }
   if(destination&&moveChild(w,c,destination,seconds)){c.currentAction=`Staying near ${carer.name}`;if(distance(c.coordinates,destination)<.2)y.needsSpace=false;return;}
  }
 }
 c.currentAction=n.hunger<35?'Waiting for food from a caregiver':n.hydration<35?'Waiting for help getting water':n.energy<45?'Resting near family':stage==='infant'?'Waiting for a caregiver':'Playing and watching nearby activity';
 c.mind.fallbackReason='dependent_child';c.mind.decisionSummary='Stay near family, rest, play and receive care.';
}
