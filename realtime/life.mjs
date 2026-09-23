import {clamp,pairKey,makeAgent,remember,addEvent} from '../engine/core.js';
import {clock} from './holdings.mjs';

export const DAY=1440;
export const DEFAULT_YEAR_DAYS=60;
export const romanceKinds=['courtship','commitment','family_plan','private_time'];
const hash=s=>{let n=2166136261;for(const c of s)n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;};
const needsReady=a=>a.needs.hunger>55&&a.needs.hydration>55&&a.needs.energy>45&&a.needs.warmth>35;
export function ensureLife(w){
 w.lifecycle??={version:1,yearDays:DEFAULT_YEAR_DAYS,startedAt:clock(w),nextChild:1,seed:hash('valley-families')};
 for(const a of w.agents){
  a.life??={bornAt:null,ageAtEpoch:a.id==='agent-mara'?26:a.id==='agent-ivo'?28:27,ageEpoch:clock(w),sex:a.id==='agent-mara'?'female':'male',parents:[],children:[],partnerId:null,pregnancy:null,lastBirthAt:null,familyWish:clamp(45+a.traits.cooperation*35-a.traits.caution*10),carriedBy:null};
  a.life.lastBirthday??=Math.floor(ageYears(w,a));a.life.stage??=lifeStage(w,a);
 }
 w.relationships??={};
 for(let i=0;i<w.agents.length;i++)for(let j=i+1;j<w.agents.length;j++){
  const a=w.agents[i],b=w.agents[j],r=w.relationships[pairKey(a.id,b.id)]??={trust:20,familiarity:0,affinity:50,lastInteraction:null,sharedMemories:0,techniquesShared:0};
  r.romance??={feelings:{[a.id]:0,[b.id]:0},status:'none',courtships:0,since:null,cooldownUntil:0,familyAgreedUntil:0,lastAttemptAt:null};
 }
 return w.lifecycle;
}
export const ageYears=(w,a)=>Math.max(0,(a.life.ageAtEpoch||0)+(clock(w)-(a.life.ageEpoch??a.life.bornAt))/((w.lifecycle?.yearDays||DEFAULT_YEAR_DAYS)*DAY));
export const pregnancyProgress=(w,p)=>clamp((p.progressAtEpoch||0)+(clock(w)-(p.epochAt??p.conceivedAt))/((w.lifecycle?.yearDays||DEFAULT_YEAR_DAYS)*DAY*.75),0,1);
// Rebase only the biological clock. Historical births, the world clock and
// physical task progress are untouched; no retroactive birthdays or births.
export function setAgingYearDays(w,days){
 if(!Number.isFinite(days)||days<1||days>3650)throw Error('Aging year must be between 1 and 3650 world days.');
 ensureLife(w);const now=clock(w),ages=w.agents.map(a=>[a,ageYears(w,a)]),pregnancies=w.agents.filter(a=>a.life.pregnancy).map(a=>[a.life.pregnancy,pregnancyProgress(w,a.life.pregnancy)]);
 for(const [a,age]of ages){a.life.ageAtEpoch=age;a.life.ageEpoch=now;}
 for(const [p,progress]of pregnancies){p.progressAtEpoch=progress;p.epochAt=now;p.dueAt=now+(1-progress)*days*DAY*.75;}
 w.lifecycle.yearDays=days;
}
export const isAdult=(w,a)=>!!a.life&&ageYears(w,a)>=18;
export function lifeStage(w,a){const y=ageYears(w,a);return y<1?'infant':y<3?'toddler':y<13?'child':y<18?'teen':y<60?'adult':'elder';}
export function familyRelated(w,a,b){
 const ancestors=p=>{const ids=new Set();let layer=p.life?.parents||[];for(let n=0;n<3;n++){const next=[];for(const id of layer){ids.add(id);next.push(...(w.agents.find(x=>x.id===id)?.life?.parents||[]));}layer=next;}return ids;};
 const aa=ancestors(a),bb=ancestors(b);return aa.has(b.id)||bb.has(a.id)||[...aa].some(id=>bb.has(id));
}
export function romanceEligible(w,a,b){return a.id!==b.id&&isAdult(w,a)&&isAdult(w,b)&&!familyRelated(w,a,b)&&(!a.life.partnerId||a.life.partnerId===b.id)&&(!b.life.partnerId||b.life.partnerId===a.id);}
const attraction=(a,b)=>35+hash(a.id+':'+b.id)%41+(1-Math.abs(a.traits.cooperation-b.traits.cooperation))*8;
export function familyReadiness(w,a,b){
 const mother=[a,b].find(p=>p.life?.sex==='female'),father=[a,b].find(p=>p.life?.sex==='male');
 if(!mother||!father)return {ready:false,reason:'These partners cannot conceive a pregnancy together.'};
 if(mother.life.pregnancy)return {ready:false,reason:'A baby is already expected.'};
 if(ageYears(w,mother)<20||ageYears(w,mother)>=45||ageYears(w,father)<20)return {ready:false,reason:'Not in the simulated family-planning life stage.'};
 if([a,b].some(p=>p.life.familyWish<50))return {ready:false,reason:'Both partners must want to raise a child.'};
 if([a,b].some(p=>p.needs.hunger<65||p.needs.hydration<65||p.needs.energy<55||p.needs.warmth<45))return {ready:false,reason:'Attend to food, water, rest and warmth first.'};
 if(!w.structures.shelter&&!w.settlement?.projects.some(p=>p.status==='complete'&&p.affordances?.rainCover?.length))return {ready:false,reason:'Find dependable shelter before planning a baby.'};
 if([a,b].some(p=>(p.life.children||[]).some(id=>{const c=w.agents.find(x=>x.id===id);return c&&ageYears(w,c)<3;})))return {ready:false,reason:'A young child already needs their care.'};
 const r=w.relationships[pairKey(a.id,b.id)];
 if(r?.romance.status!=='partners'||clock(w)-r.romance.since<3*DAY||r.trust<65||Math.min(...Object.values(r.romance.feelings))<65)return {ready:false,reason:'Build a stable, trusting partnership first.'};
 return {ready:true,reason:'Both partners want a child and have room in their lives to care for one.',motherId:mother.id,fatherId:father.id};
}
export function willingRomance(w,a,b,kind){
 if(!romanceEligible(w,a,b)||!needsReady(a)||!needsReady(b))return false;
 const r=w.relationships[pairKey(a.id,b.id)],love=r?.romance;if(!love||love.cooldownUntil>clock(w))return false;
 if(kind==='courtship')return r.trust>=55&&r.familiarity>=40&&r.affinity>=65&&attraction(a,b)>=48&&attraction(b,a)>=48;
 if(kind==='commitment')return love.status!=='partners'&&love.courtships>=3&&r.trust>=65&&love.feelings[a.id]>=55&&love.feelings[b.id]>=55;
 if(!familyReadiness(w,a,b).ready)return false;
 return kind==='family_plan'?love.familyAgreedUntil<=clock(w):kind==='private_time'&&love.familyAgreedUntil>clock(w)&&(love.lastAttemptAt===null||clock(w)-love.lastAttemptAt>=DAY);
}
function random(w){const l=w.lifecycle;l.seed=(Math.imul(l.seed,1664525)+1013904223)>>>0;return l.seed/4294967296;}
export function completeRomance(w,a,b,kind){
 if(!willingRomance(w,a,b,kind))return {success:false,detail:'Their circumstances or willingness changed; no romantic or family milestone occurred.'};
 const r=w.relationships[pairKey(a.id,b.id)],love=r.romance,now=clock(w);let detail;
 if(kind==='courtship'){
  for(const [p,q]of [[a,b],[b,a]])love.feelings[p.id]=clamp(love.feelings[p.id]+6+attraction(p,q)/10);
  love.courtships++;if(love.status==='none')love.status='courting';
  detail=`${a.name} and ${b.name} enjoyed a date and grew closer. Their feelings developed through time together.`;
 }else if(kind==='commitment'){
  love.status='partners';love.since=now;a.life.partnerId=b.id;b.life.partnerId=a.id;
  detail=`${a.name} and ${b.name} chose to become a couple.`;addEvent(w,'relationship','A new couple',detail,{agentId:a.id,otherAgentId:b.id});
 }else if(kind==='family_plan'){
  love.familyAgreedUntil=now+7*DAY;detail=`${a.name} and ${b.name} agreed they would like to raise a child together.`;addEvent(w,'family-plan','Thinking about a family',detail,{agentId:a.id,otherAgentId:b.id});
 }else{
  love.lastAttemptAt=now;const ready=familyReadiness(w,a,b);detail=`${a.name} and ${b.name} spent private time together.`;
  if(random(w)<.25){
   const mother=w.agents.find(p=>p.id===ready.motherId),father=w.agents.find(p=>p.id===ready.fatherId);
   mother.life.pregnancy={conceivedAt:now,epochAt:now,progressAtEpoch:0,dueAt:now+w.lifecycle.yearDays*DAY*.75,otherParentId:father.id};
   detail+=` ${mother.name} is expecting a baby.`;addEvent(w,'pregnancy','A baby is expected',`${mother.name} and ${father.name} are expecting a child. Pregnancy takes nine months of the aging calendar.`,{agentId:mother.id,otherAgentId:father.id});
  }
 }
 love.cooldownUntil=now+(kind==='courtship'?6:12)*60;
 return {success:true,detail};
}
function birth(w,mother){
 const pregnancy=mother.life.pregnancy;if(!pregnancy||clock(w)<pregnancy.dueAt)return;
 const father=w.agents.find(a=>a.id===pregnancy.otherParentId),n=w.lifecycle.nextChild++;
 let id=`agent-child-${n}`;while(w.agents.some(a=>a.id===id))id=`agent-child-${w.lifecycle.nextChild++}`;
 const female=random(w)<.5,names=female?['Lina','Nora','Ada','Esme','Cora']:['Rowan','Finn','Eli','Oren','Theo'],base=names[(n-1)%names.length],name=w.agents.some(a=>a.name===base)?`${base} ${n}`:base;
 const traits=Object.fromEntries(['curiosity','cooperation','caution'].map(k=>[k,clamp((mother.traits[k]+(father?.traits[k]??.5))/2+(random(w)-.5)*.12,.1,.95)]));
 const baby=makeAgent(id,name,mother.position,{hunger:75,hydration:80,energy:65,warmth:Math.max(45,mother.needs.warmth)},traits);
 baby.coordinates={...mother.coordinates};baby.life={bornAt:clock(w),ageEpoch:clock(w),ageAtEpoch:0,sex:female?'female':'male',parents:[mother.id,...(father?[father.id]:[])],children:[],partnerId:null,pregnancy:null,lastBirthAt:null,familyWish:50+random(w)*30,carriedBy:mother.id,lastBirthday:0,stage:'infant'};
 baby.currentAction=`Being carried by ${mother.name}`;w.agents.push(baby);mother.life.pregnancy=null;mother.life.lastBirthAt=clock(w);mother.needs.energy=clamp(mother.needs.energy-18);mother.needs.hunger=clamp(mother.needs.hunger-8);
 for(const parent of [mother,father].filter(Boolean)){
  parent.life.children.push(id);w.relationships[pairKey(parent.id,id)]={trust:65,familiarity:10,affinity:80,lastInteraction:`${w.day}:${w.hour}`,sharedMemories:0,techniquesShared:0};
  remember(w,parent,`${name} was born. I am responsible for their food, warmth, comfort and care.`,{importance:10,tags:['family','birth',id],confidence:1});
 }
 addEvent(w,'birth',`${name} was born`,`${mother.name}${father?' and '+father.name:''} welcomed ${name}. The baby depends on adult care.`,{agentId:id,parentIds:baby.life.parents});ensureLife(w);
}
export function advanceLife(w){
 ensureLife(w);const now=clock(w);
 for(const a of [...w.agents]){
  const y=ageYears(w,a),birthday=Math.floor(y),stage=lifeStage(w,a);
  if(birthday>a.life.lastBirthday){a.life.lastBirthday=birthday;addEvent(w,'birthday',`${a.name} turned ${birthday}`,`${a.name} is now ${birthday} years old.`,{agentId:a.id});}
  a.life.stage=stage;if(stage!=='infant'&&a.life.carriedBy){a.life.carriedBy=null;a.youth??={};a.youth.needsSpace=true;}
  if(a.life.pregnancy&&now>=a.life.pregnancy.dueAt)birth(w,a);
 }
 if((w.lifecycle.lastRelationshipCheck??-Infinity)+60>now)return;w.lifecycle.lastRelationshipCheck=now;
 for(const [key,r]of Object.entries(w.relationships)){
  if(r.romance?.status!=='partners'||r.trust>=20&&r.affinity>=25)continue;
  const pair=key.split('|').map(id=>w.agents.find(a=>a.id===id));for(const a of pair.filter(Boolean))a.life.partnerId=null;
  r.romance.status='separated';r.romance.familyAgreedUntil=0;r.romance.cooldownUntil=now+7*DAY;
  addEvent(w,'relationship','A couple separates',`${pair.map(a=>a?.name||'A villager').join(' and ')} ended their partnership after trust broke down. Their responsibility to existing children remains.`,{});
 }
}
export function lifeSummary(w,a){
 if(!a.life)return null;const years=ageYears(w,a),p=a.life.pregnancy,byId=id=>({id,name:w.agents.find(a=>a.id===id)?.name||'Unknown'});
 return {ageYears:Math.floor(years),ageMonths:Math.floor(years*12),stage:lifeStage(w,a),sex:a.life.sex,yearDays:w.lifecycle.yearDays,parents:a.life.parents.map(byId),children:a.life.children.map(byId),partner:a.life.partnerId?byId(a.life.partnerId):null,carriedBy:a.life.carriedBy,pregnancy:p?{progress:pregnancyProgress(w,p),daysRemaining:Math.max(0,(p.dueAt-clock(w))/DAY),otherParent:byId(p.otherParentId)}:null};
}
export function relationshipsFor(w,a){return w.agents.filter(b=>b.id!==a.id).map(b=>{
 const r=w.relationships[pairKey(a.id,b.id)],love=r?.romance,kin=familyRelated(w,a,b),status=a.life?.parents.includes(b.id)?'Parent':a.life?.children.includes(b.id)?'Child':kin?'Family':love?.status==='partners'?'Partner':love?.status==='courting'?'Courting':love?.status==='separated'?'Former partner':r?.affinity>=70&&r?.trust>=60?'Friend':'Acquaintance';
 return {id:b.id,name:b.name,status,trust:Math.round(r?.trust??0),familiarity:Math.round(r?.familiarity??0),affinity:Math.round(r?.affinity??50),romance:!kin&&isAdult(w,a)&&isAdult(w,b)?{toward:Math.round(love?.feelings[a.id]??0),from:Math.round(love?.feelings[b.id]??0)}:null,sharedMemories:r?.sharedMemories||0};
});}
export function familyContext(w,a){const life=lifeSummary(w,a),partner=w.agents.find(b=>b.id===a.life?.partnerId);return {life,relationships:relationshipsFor(w,a),familyPlanning:partner?familyReadiness(w,a,partner):null,dependents:w.agents.filter(b=>b.life?.parents.includes(a.id)&&!isAdult(w,b)).map(b=>({name:b.name,stage:lifeStage(w,b),needs:b.needs})),housingGoal:a.life?.pregnancy||a.life?.children.some(id=>{const b=w.agents.find(p=>p.id===id);return b&&!isAdult(w,b);})?'Make dry, sheltered, comfortable space for the family using physically supported construction.':null};}
