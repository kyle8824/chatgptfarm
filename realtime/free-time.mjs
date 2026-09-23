import {romanceKinds,willingRomance,completeRomance,isAdult,familyContext} from './life.mjs';
import {coverEffectiveness} from './structures.mjs';
import {CAMP,shelterLocal} from './layout.mjs';
import {clamp,remember,relationship} from '../engine/core.js';
import {outcome} from '../engine/persistent-actions.js';
import {distance} from '../engine/navigation.js';
import {clock,roomFor} from './holdings.mjs';
import {liveClear,motionState} from './motion.mjs';
import {findMaterialSource,interactionPoint} from './settlement.mjs';
import {toolPlan} from './crafting.mjs';
import {explorationMotivation} from './exploration.mjs';
import {comfortCandidates,comfortContext,workComfortRest} from './comfort.mjs';

const initial=()=>({company:55,enjoyment:55,mastery:55,cooldowns:{},seen:{}});
export const comfortable=a=>a.needs.hunger>55&&a.needs.hydration>55&&a.needs.energy>45&&a.needs.warmth>35;
export function ensureFreeTime(a){return a.freeTime??=initial();}
export function advanceFreeTime(w,a,seconds){
 const f=ensureFreeTime(a),hours=seconds/3600;
 f.company=clamp(f.company-hours*5);f.enjoyment=clamp(f.enjoyment-hours*7);f.mastery=clamp(f.mastery-hours*4);
 // A sighting, not access to the other person's remote current location.
 if((f.noticeAt??-Infinity)+5/60<=clock(w)){f.noticeAt=clock(w);for(const b of w.agents)if(b.id!==a.id&&distance(a.coordinates,b.coordinates)<12&&liveClear(w,a.coordinates,b.coordinates))f.seen[b.id]={at:clock(w),position:{...b.coordinates}};}
 if(f.practice&&clock(w)-f.practice.at>=240)delete f.practice;
}
export function freeTimeContext(w,a){const f=a.freeTime||initial();return {family:familyContext(w,a),comfort:comfortContext(w,a),company:Math.round(f.company),enjoyment:Math.round(f.enjoyment),mastery:Math.round(f.mastery),practiceGoal:f.practice?.item||null,exploration:explorationMotivation(w,a)};}
const ready=(w,a,kind)=>comfortable(a)&&(!a.task||a.task.selected?.job?.kind==='relax')&&(a.freeTime?.cooldowns?.social||0)<=clock(w)&&(romanceKinds.includes(kind)|| (kind==='conversation'?(a.freeTime?.company??55)<80:(a.freeTime?.enjoyment??55)<80));
const owned=(w,a,item)=>(a.inventory[item]||0)+(w.settlement?.stores||[]).filter(s=>s.ownerId===a.id).reduce((n,s)=>n+(s.items[item]||0),0);
const practiceOptions=[['cordage','fiberwork',4],['woodPole','woodworking',2],['sharpStone','stoneworking',1],['boundSharpTool','hafting',1]];

export function freeTimeCandidates(w,a){
 if(!comfortable(a))return [];
 const f=a.freeTime||initial(),now=clock(w),result=comfortCandidates(w,a,{relax:true}),curiosity=a.traits.curiosity,cooperation=a.traits.cooperation;
 const offer=(id,label,score,job,reason)=>result.push({id,label,score,reasons:[[reason,score]],job:{...job,freeTime:true,reason}});
 // Quiet leisure remains possible even after other interests have been met.
 offer('leisure:relax','Relax and enjoy the surroundings',5+(100-a.needs.energy)*.18+(100-f.enjoyment)*.12,{kind:'relax',minutes:20,destination:{...a.coordinates}},'Take an unhurried break while immediate needs are met.');
 if((f.cooldowns.practice||0)<=now){
  const options=practiceOptions.filter(([item,,cap])=>owned(w,a,item)<cap&&(item!=='sharpStone'||!owned(w,a,'boundSharpTool'))).map(([item,skill])=>{
   const last=a.craftPractice?.[skill]?.last,failed=last?.success===false&&(w.day-last.day)*24+w.hour-last.hour<12;
   return {item,skill,score:12+curiosity*9+(100-f.mastery)*.28+(failed?7:0)+(f.practice?.item===item?9:0)-Math.min(8,(a.craftPractice?.[skill]?.minutes||0)/30)};
  }).sort((x,y)=>y.score-x.score);
  for(const option of options){
   const {item,skill,score}=option,plan=toolPlan(a,item),practice={item,skill};
   const reason=`Practice ${skill}${a.craftPractice?.[skill]?.last?.success===false?' after a failed attempt':''} by making a useful ${item}; materials and completed work are required.`;
   if(plan.craft){const actualSkill={sharpStone:'stoneworking',cordage:'fiberwork',woodPole:'woodworking',boundSharpTool:'hafting'}[plan.craft];offer('practice:'+plan.craft,'Practice '+actualSkill+' · '+plan.label,score,{kind:'craft',item:plan.craft,practice:{...practice,skill:actualSkill},minutes:plan.minutes,destination:{...a.coordinates}},plan.craft===item?reason:`Practice ${actualSkill} by making ${plan.craft} as preparation for ${skill}.`);continue;}
   const material={stones:'stone',reeds:'reeds',timber:'timber'}[plan.item];if(!material)continue;
   for(const source of findMaterialSource(w,a,material)){
    if(!roomFor(w,a,source.item))continue;
    const destination=interactionPoint(w,a,source.position);if(!destination)continue;
    offer('practice_supply:'+item+':'+(source.nodeId||source.treeId||source.storeId||source.item),'Collect '+plan.item+' to practice '+skill,score-distance(a.coordinates,destination)*.25,{...source,destination,practice,quantity:plan.quantity,minutes:source.kind==='harvest'?6:2},reason);break;
   }
  }
 }
 if((f.cooldowns.social||0)<=now)for(const b of w.agents){
  if(b.id===a.id||(b.life&&!isAdult(w,b))||(relationship(w,a,b)?.trust??0)<20)continue;
  const seen=f.seen[b.id],gap=distance(a.coordinates,b.coordinates),visible=gap<12&&liveClear(w,a.coordinates,b.coordinates);
  if(visible)for(const kind of ['conversation','hand_game',...romanceKinds]){
   if(!ready(w,b,kind))continue;
   if(romanceKinds.includes(kind)){
    if(!willingRomance(w,a,b,kind))continue;
    const q=shelterLocal(b.coordinates),covered=w.structures.shelter&&Math.abs(q.x)<CAMP.shelter.halfWidth&&Math.abs(q.y)<CAMP.shelter.halfLength||coverEffectiveness(w,b.coordinates)>.5;
    if(kind==='private_time'&&(!covered||w.agents.some(p=>p.id!==a.id&&p.id!==b.id&&distance(p.coordinates,b.coordinates)<4)))continue;
    const destination=interactionPoint(w,a,b.coordinates,{radius:1.6});if(!destination)continue;
    const titles={courtship:'Spend affectionate time with ',commitment:'Talk about becoming a couple with ',family_plan:'Talk about starting a family with ',private_time:'Spend private time with '};
    const score={courtship:42,commitment:60,family_plan:62,private_time:60}[kind];
    offer('social:'+kind+':'+b.id,titles[kind]+b.name,score-gap*.25,{kind,partnerId:b.id,destination,minutes:kind==='courtship'?20:15},'A shared adult choice requiring mutual interest, availability and time together.');continue;
   }
   const destination=interactionPoint(w,a,b.coordinates,{radius:1.6});if(!destination)continue;
   const score=kind==='conversation'?8+cooperation*10+(100-f.company)*.4:7+cooperation*6+(100-f.enjoyment)*.42;
   offer('social:'+kind+':'+b.id,kind==='conversation'?'Spend time talking with '+b.name:'Play a hand-sign game with '+b.name,score-gap*.25,{kind,partnerId:b.id,destination,minutes:kind==='conversation'?12:10},kind==='conversation'?'Seek companionship and exchange remembered experiences.':'Enjoy five rounds together: stone beats shears, shears beat reed, reed beats stone.');
  }
  else if(seen&&now-seen.at<240&&f.company<45&&distance(a.coordinates,seen.position)>3&&(f.cooldowns.visit||0)<=now){
   const destination=interactionPoint(w,a,seen.position);if(destination)offer('leisure:visit:'+b.id,'Look for '+b.name+' where last seen',10+(100-f.company)*.35,{kind:'visit',partnerId:b.id,destination,minutes:.1},'Look at a remembered location; the other person may have moved.');
  }
 }
 return result.filter(c=>!a.liveFailures?.[c.id]||now-a.liveFailures[c.id].at>=90);
}
export function beginFreeTime(w,a,t){
 if(t.selected?.job?.practice){const f=ensureFreeTime(a);if(!f.practice||f.practice.item!==t.selected.job.practice.item)f.practice={...t.selected.job.practice,at:clock(w)};}
}
export function finishFreeTime(w,a,t,result){
 const j=t.selected?.job;if(!j?.practice)return;
 const f=ensureFreeTime(a);
 if(j.kind==='craft'){
  f.mastery=clamp(f.mastery+(result.success===false?12:35));f.enjoyment=clamp(f.enjoyment+8);
  f.cooldowns.practice=clock(w)+90;delete f.practice;
  remember(w,a,`I practiced ${j.practice.skill}. ${result.detail}`,{importance:5,tags:['practice',j.practice.skill],confidence:.95});
 }else if(result.success===false){f.cooldowns.practice=clock(w)+60;delete f.practice;}
}

const socialKinds=['conversation','hand_game',...romanceKinds];
export const isFreeTimeJob=t=>['relax','visit',...socialKinds].includes(t?.selected?.job?.kind);
function shareMemory(w,a,b){
 const m=a.memories.find(m=>m.importance>=6&&!m.tags?.includes('social')&&!String(m.source||'').startsWith('social:')&&!b.memories.some(n=>n.source===`social:${a.id}:${m.id}`));
 if(!m)return;
 remember(w,b,`${a.name} told me: ${m.text}`,{importance:Math.max(4,m.importance-1),tags:[...(m.tags||[]),'social'],source:`social:${a.id}:${m.id}`,confidence:Math.max(.5,(m.confidence||.8)-.15)});
 const rel=relationship(w,a,b);if(rel)rel.sharedMemories=(rel.sharedMemories||0)+1;
}
function sign(a){const m=motionState(a);m.seed=(Math.imul(m.seed,1664525)+1013904223)>>>0;return m.seed%3;}
export function workFreeTime(w,a,t,minutes){
 const j=t.selected.job,f=ensureFreeTime(a),fail=detail=>{f.cooldowns.social=clock(w)+60;return {done:true,success:false,detail};};
 if(t.socialResult)return {done:true,...t.socialResult};
 if(distance(a.coordinates,j.destination)>.5)return fail('The leisure location is no longer within reach.');
 if(j.kind==='relax'){
  return workComfortRest(w,a,t,minutes);
 }
 if(j.kind==='visit'){f.cooldowns.visit=clock(w)+120;return {done:true,success:true,detail:`${a.name} checked ${w.agents.find(b=>b.id===j.partnerId)?.name||'the other villager'}'s last observed location. An encounter still requires their presence and willingness.`};}
 const b=w.agents.find(b=>b.id===j.partnerId);
 if(!b||distance(a.coordinates,b.coordinates)>2.4||!liveClear(w,a.coordinates,b.coordinates))return fail('The other person is no longer close enough to take part.');
 if(j.kind==='private_time'){
  const covered=p=>{const q=shelterLocal(p);return w.structures.shelter&&Math.abs(q.x)<CAMP.shelter.halfWidth&&Math.abs(q.y)<CAMP.shelter.halfLength||coverEffectiveness(w,p)>.5;};
  if(!covered(a.coordinates)||!covered(b.coordinates)||w.agents.some(p=>p.id!==a.id&&p.id!==b.id&&Math.min(distance(p.coordinates,a.coordinates),distance(p.coordinates,b.coordinates))<4))return fail('There is no longer a sheltered, private place for this shared time.');
 }
 if(j.hostId){
  if(b.task?.id!==j.sessionId)return fail('The shared activity ended when the other person left.');
  return {done:false}; // The host advances the one shared session exactly once.
 }
 if(!t.social){
  if(!ready(w,b,j.kind)||romanceKinds.includes(j.kind)&&!willingRomance(w,a,b,j.kind))return fail(`${b.name} is occupied or does not want this activity now.`);
  if(b.task)outcome(w,b,b.task,true,`${b.name} ends the quiet break to join ${a.name}.`,'superseded');
  t.social={rounds:[],scores:[0,0]};
  b.task={...structuredClone(t),id:t.id+':guest',decisionId:null,source:'fallback',model:null,fallbackReason:'accepted_social_invitation',decisionSummary:`I want to join ${a.name} for ${j.kind==='conversation'?'conversation':j.kind==='hand_game'?'a hand-sign game':'time together'}.`,origin:{...b.coordinates},destination:{...b.coordinates},path:[{...b.coordinates}],phase:'work',targetPosition:b.position,selected:{id:'social:guest:'+a.id,label:j.kind==='conversation'?'Talk with '+a.name:j.kind==='hand_game'?'Play a hand-sign game with '+a.name:'Spend time with '+a.name,job:{...j,destination:{...b.coordinates},partnerId:a.id,hostId:a.id,sessionId:t.id}},social:null};
  b.task.label=b.task.selected.label;b.task.actionId=b.task.selected.id;b.task.liveSpaceVersion=1;
 }
 if(b.task?.selected?.job?.sessionId!==t.id||!comfortable(a)||!comfortable(b))return fail('Someone needs to attend to another need; the shared activity stops.');
 t.workMinutes=Math.min(t.requiredMinutes,t.workMinutes+minutes);b.task.workMinutes=t.workMinutes;
 if(j.kind==='hand_game'){
  const names=['stone','reed','shears'];
  while(t.social.rounds.length<Math.min(5,Math.floor((t.workMinutes+1e-8)/2))){
   const x=sign(a),y=sign(b),winner=x===y?null:(x-y+3)%3===1?0:1;
   if(winner!==null)t.social.scores[winner]++;
   t.social.rounds.push({signs:[names[x],names[y]],winner:winner===null?null:[a.id,b.id][winner]});
  }
  t.progress={kind:'hand_game',rounds:t.social.rounds.length,totalRounds:5,scores:[...t.social.scores],players:[a.name,b.name],lastRound:t.social.rounds.at(-1)||null};b.task.progress=structuredClone(t.progress);
 }
 if(t.workMinutes<t.requiredMinutes)return {done:false};
 let detail;
 if(romanceKinds.includes(j.kind)){const result=completeRomance(w,a,b,j.kind);if(!result.success)return fail(result.detail);detail=result.detail;}
 else if(j.kind==='conversation'){shareMemory(w,a,b);shareMemory(w,b,a);detail=`${a.name} and ${b.name} spent time together and compared remembered experiences.`;}
 else {const [x,y]=t.social.scores;detail=`${a.name} and ${b.name} played five hand-sign rounds: ${x}–${y}. ${x===y?'The game was tied.':(x>y?a.name:b.name)+' won.'}`;}
 for(const p of [a,b]){const pf=ensureFreeTime(p);pf.company=clamp(pf.company+(j.kind==='conversation'?40:22));pf.enjoyment=clamp(pf.enjoyment+(j.kind==='hand_game'?38:12));pf.cooldowns.social=clock(w)+120;remember(w,p,detail,{importance:5,tags:['social',j.kind==='hand_game'?'play':'companionship'],confidence:.98});}
 const rel=relationship(w,a,b);if(rel){rel.familiarity=clamp(rel.familiarity+3);rel.affinity=clamp((rel.affinity||50)+1);rel.trust=clamp(rel.trust+1);rel.lastInteraction=`${w.day}:${w.hour}`;}
 t.socialResult=b.task.socialResult={success:true,detail};return {done:true,success:true,detail};
}
