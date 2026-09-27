import {homeFor,knownPerson} from '../shared/frontier.js';
import {pairKey,remember,addEvent} from '../engine/core.js';
import {distance} from '../engine/navigation.js';
import {clock} from './holdings.mjs';
import {liveClear,advanceLiveRoute,motionState} from './motion.mjs';
import {beginReturnRoute,advanceReturnRoute} from './return-route.mjs';
import {restSurfaces} from './rest-surfaces.mjs';
import {coverEffectiveness} from './structures.mjs';

// Residence is a personal commitment, distinct from ancestry/provider routing
// and from the nearest camp used for an immediate meal or emergency shelter.
export function residenceOf(w,a){
 if(a.residence)return a.residence;
 const h=homeFor(w,a);return h?{position:{x:h.x,y:h.y},name:h.name,campId:h.id,reason:'The familiar starting home',since:null}:null;
}
export function closeCompanions(w,a){
 const now=clock(w);
 return w.agents.filter(b=>b.id!==a.id&&knownPerson(a,b)).flatMap(b=>{
  const r=w.relationships?.[pairKey(a.id,b.id)];if(!r||r.trust<55||r.affinity<65)return [];
  const partner=a.life?.partnerId===b.id,strength=partner?1:Math.min(1,(r.trust+r.affinity+r.familiarity)/300);
  const visible=distance(a.coordinates,b.coordinates)<12&&liveClear(w,a.coordinates,b.coordinates);
  const observations=[a.freeTime?.seen?.[b.id],a.knownPeople?.[b.id]&&{at:a.knownPeople[b.id].lastSeenAt,position:a.knownPeople[b.id].coordinates}].filter(s=>s?.position&&Number.isFinite(s.at)).sort((x,y)=>y.at-x.at);
  const seen=visible?{at:now,position:b.coordinates}:observations[0];
  return [{id:b.id,name:b.name,partner,strength,position:seen&&now-seen.at<=1440?{...seen.position}:null,lastSeenAt:seen?.at??null,locationKnown:!!seen&&now-seen.at<=1440}];
 });
}
export function homeContext(w,a){
 const home=residenceOf(w,a),companions=closeCompanions(w,a);
 return {home,awayDistance:home?Math.round(distance(a.coordinates,home.position)):0,companions,
  guidance:'Prefer improving the familiar home and staying within practical reach of close companions. Travel for supplies, discovery, safety or a worthwhile project is allowed. A temporary trip is not a decision to move home. Companion locations are sightings, not live tracking.'};
}
export function siteAttachment(w,a,position,context=homeContext(w,a)){
 const homeDistance=context.home?distance(position,context.home.position):null;
 const people=context.companions.filter(b=>b.position);
 const companionDistance=people.length?Math.min(...people.map(b=>distance(position,b.position))):null;
 return {homeDistance:homeDistance===null?null:Math.round(homeDistance),companionDistance:companionDistance===null?null:Math.round(companionDistance),
  preference:(homeDistance===null?0:24*Math.exp(-homeDistance/30))+(companionDistance===null?0:12*Math.exp(-companionDistance/20)),
  reason:homeDistance!==null&&homeDistance<=30?'Near the established home':homeDistance!==null&&homeDistance>60?'Away from home: weigh travel, existing work and close relationships against the specific benefit here':'Within a normal trip from home'};
}
function failedRecently(w,a,id){const f=a.liveFailures?.[id];return f&&clock(w)-f.at<f.retryMinutes;}
function suppliesKnownNear(w,a,p){
 return Object.entries(a.siteKnowledge||{}).some(([id,seen])=>seen.quantity>0&&w.regions?.sites?.[id]?.position&&distance(w.regions.sites[id].position,p)<35);
}
export function relocationChoices(w,a){
 const home=residenceOf(w,a);if(!home)return [];
 const old=a.campKnowledge?.[home.campId],companions=closeCompanions(w,a),options=[];
 for(const h of w.frontier?.homes||[]){
  const p={x:h.x,y:h.y},seen=a.campKnowledge?.[h.id];
  if(h.id===home.campId||!a.knownCamps?.includes(h.id)||distance(a.coordinates,p)>18||!seen?.shelter||!suppliesKnownNear(w,a,p))continue;
  const close=companions.filter(b=>b.position&&distance(b.position,p)<25),separated=companions.filter(b=>b.position&&distance(b.position,home.position)<35&&distance(b.position,p)>60);
  const reasons=[];if(old?.shelter===false)reasons.push('dependable shelter missing at the old home');if(close.length&&!separated.length)reasons.push('a close companion recently seen here');
  if(!reasons.length)continue;
  const separationCost=separated.reduce((n,b)=>n+(b.partner?18:6)*b.strength,0);
  options.push({id:h.id,campId:h.id,name:h.name,position:p,reason:`Consider settling here because of ${reasons.join(' and ')}, with familiar food nearby.${separated.length?' This would mean living farther from close companions.':''}`,score:(old?.shelter===false?48:32)-separationCost});
 }
 // An earned, usable home can also be made at any constructed site. Require
 // actual comfortable use and observed food; a drawing or a passing visit
 // cannot turn into a relocation. Existing investment and separation count.
 const rest=a.comfort?.lastRest;
 for(const p of w.settlement?.projects||[]){
  if(p.id===home.projectId||distance(p.position,home.position)<35||distance(a.coordinates,p.position)>18||p.status!=='complete'||p.ownerId!==a.id&&p.access!=='shared')continue;
  if(rest?.projectId!==p.id||rest.score<55||clock(w)-rest.at>1440||!suppliesKnownNear(w,a,p.position))continue;
  if(!restSurfaces(p).some(s=>coverEffectiveness(w,s.position)>.5))continue;
  const improvement=rest.score-(home.restComfort??32);if(improvement<15)continue;
  const separated=companions.filter(b=>b.position&&distance(b.position,home.position)<35&&distance(b.position,p.position)>60);
  const separationCost=separated.reduce((n,b)=>n+(b.partner?18:6)*b.strength,0);
  options.push({id:p.id,projectId:p.id,name:p.name,position:{...p.position},reason:`Make a home at ${p.name}: actual rest was more comfortable under built cover, with known food nearby.${separated.length?' Weigh living farther from close companions.':''}`,score:36+Math.min(15,improvement/3)-separationCost});
 }
 return options;
}
export function homeCandidates(w,a){
 const home=residenceOf(w,a),n=a.needs;if(!home||n.hunger<35||n.hydration<35||n.energy<40||n.warmth<20)return [];
 const result=relocationChoices(w,a).map(h=>({id:`settle_home:${h.id}`,label:`Make ${h.name} my home`,score:h.score,reasons:[[h.reason,h.score]],job:{kind:'settle_home',homeId:h.id,destination:{...a.coordinates},minutes:1,reason:h.reason}}));
 const gap=distance(a.coordinates,home.position),id='return_home';
 if(gap<=28||failedRecently(w,a,id)||(a.residence?.returnAfter||0)>clock(w))return result;
 const companions=closeCompanions(w,a),lonely=(100-(a.freeTime?.company??55))/100,night=w.hour>=18||w.hour<6;
 const score=14+Math.min(25,gap/5)+lonely*(companions.length?25:8)+(night?8:0)-gap*.025;
 const reason=`Return to ${home.name} after being away${companions.length?', where familiar life and close relationships matter':''}. Useful trips and urgent needs can take priority.`;
 result.push({id,label:`Return home to ${home.name}`,score,reasons:[[reason,score]],explanation:reason,job:{kind:'return_home',destination:{...a.coordinates},homePosition:{...home.position},homeName:home.name,minutes:30,reason}});
 return result;
}
export function homeBonus(w,a,c){
 const home=residenceOf(w,a);if(!home)return 0;
 // Survival is scored by its own real urgency, not attachment.
 if(['hunger','hydration','energy'].some(k=>a.needs[k]<35)||/^eat_|^drink$|^return_|^settle_home:/.test(c.id))return 0;
 if(c.id==='explore')return distance(a.coordinates,home.position)>45?-Math.min(25,(distance(a.coordinates,home.position)-45)/5):0;
 const p=c.job?.destination;if(!p)return 0;
 return siteAttachment(w,a,p).preference*.3;
}
export function observeResidence(w,a){
 const home=residenceOf(w,a);if(!home)return;
 a.residence??=structuredClone(home);
 if(distance(a.coordinates,home.position)<=18){a.residence.lastHomeAt=clock(w);a.residence.returnAfter=clock(w)+45;}
 if(distance(a.coordinates,home.position)<=18&&a.comfort?.lastRest?.at>=clock(w)-1)a.residence.restComfort=a.comfort.lastRest.score;
}
export function settleHome(w,a,t,minutes){
 const choice=relocationChoices(w,a).find(h=>h.id===(t.selected.job.homeId||t.selected.job.campId));
 if(!choice)return {done:true,success:false,detail:'Circumstances no longer justify this move.'};
 t.workMinutes+=minutes;if(t.workMinutes<t.requiredMinutes)return {done:false};
 a.residence={campId:choice.campId||null,projectId:choice.projectId||null,name:choice.name,position:{...choice.position},reason:choice.reason,since:clock(w),lastHomeAt:clock(w),returnAfter:clock(w)+45};
 const detail=`${a.name} chose ${choice.name} as home. ${choice.reason}`;
 remember(w,a,detail,{importance:9,tags:['home','relocation'],confidence:1});addEvent(w,'home','A new home',detail,{agentId:a.id,position:choice.position});
 return {done:true,success:true,detail};
}
export function advanceHomeReturn(w,a,t,seconds){
 const home=residenceOf(w,a),goal=t.selected.job.homePosition;
 if(!home||distance(home.position,goal)>1)return {done:true,success:true,detail:'My home changed; reconsider the trip.'};
 if(distance(a.coordinates,goal)<=8.2){a.residence??=structuredClone(home);a.residence.returnAfter=clock(w)+90;return {done:true,success:true,detail:`${a.name} returned to ${home.name} on foot.`};}
 if(!t.homeJourney){t.homeJourney={search:beginReturnRoute(a.coordinates,goal),travelled:0};t.phase='planning';}
 const journey=t.homeJourney;
 if(journey.search){
  const motion=motionState(a);motion.vx=motion.vy=motion.speed=0;
  const route=advanceReturnRoute(w,a,journey.search);
  if(route.blocked)return {done:true,success:false,detail:'No safe route home was found within the bounded search.'};
  if(!route.path)return {done:false};
  t.path=route.path;t.destination={...route.path.at(-1)};t.pathIndex=1;t.phase='travel';t.progressIndex=null;
  journey.total=route.path.slice(1).reduce((n,p,i)=>n+distance(p,route.path[i]),0);delete journey.search;
 }
 const before={...a.coordinates},movement=advanceLiveRoute(w,a,t,seconds);journey.travelled+=distance(before,a.coordinates);a.position='travel';
 t.progress={kind:'return_home',distance:journey.travelled*(w.worldModel.bounds.metersPerUnit||2),targetDistance:journey.total*(w.worldModel.bounds.metersPerUnit||2),camp:home.name};
 if(movement.blocked)return {done:true,success:false,detail:'The route home became blocked; reconsider after a cooldown.'};
 return {done:false};
}
