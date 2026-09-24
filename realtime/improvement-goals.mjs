import {clock} from './holdings.mjs';

// A goal belongs to the person, not their interruptible meal/travel/work task.
// It records an experienced need or an accepted drawing, never a free object.
export function updateImprovementGoal(w,a){
 const now=clock(w),goal=a.improvementGoal;
 if(goal?.projectId){
  const project=w.settlement.projects.find(p=>p.id===goal.projectId);
  if(project&&project.status!=='complete'){
   goal.status='working';goal.pausedFor=['hydration','hunger','energy'].find(k=>a.needs[k]<20)||null;
   const part=project.parts.find(p=>!p.built&&(p.requires||[]).every(id=>project.parts.find(x=>x.id===id)?.built));
   goal.nextStep=part?`${part.invested?'Finish assembling':'Prepare and assemble'} ${part.id}`:'Check the remaining supports';
   return goal;
  }
  if(goal.status!=='satisfied'){goal.status='satisfied';goal.completedAt=now;goal.nextStep='Use the finished work and learn what needs improving';goal.pausedFor=null;}
  // Leave time for actual use before another observed problem becomes a goal.
  if(now-goal.completedAt<60)return goal;
 }
 const unfinished=w.settlement.projects.find(p=>p.ownerId===a.id&&p.status!=='complete');
 if(unfinished){a.improvementGoal={kind:'construction',projectId:unfinished.id,reason:unfinished.rationale,startedAt:now,status:'working'};return updateImprovementGoal(w,a);}
 const discomfort=(a.comfort?.uncomfortableMinutes||0)>=15&&(a.comfort?.value??55)<60;
 if(discomfort){
  if(goal?.kind!=='comfort'||goal.status==='satisfied')a.improvementGoal={kind:'comfort',reason:'Repeated uncomfortable rest; find or make a drier, softer supported resting place.',startedAt:now,status:'considering',nextStep:'Prepare useful tools and consider a small usable design'};
 }else if(goal?.kind==='comfort'&&goal.status!=='satisfied'&&(a.comfort?.lastRest?.score??0)>=60){goal.status='satisfied';goal.completedAt=now;goal.nextStep='The resting place is comfortable';}
 return a.improvementGoal||null;
}

export function improvementBonus(a,c){
 const goal=a.improvementGoal;
 if(!goal||goal.status==='satisfied'||['hydration','hunger','energy'].some(k=>a.needs[k]<25))return 0;
 if(goal.projectId&&(c.job?.projectId===goal.projectId||c.projectId===goal.projectId)&&!['rest','relax'].includes(c.job?.kind))return 14;
 // Only existing, finite, useful tool-making candidates qualify. Practice has
 // its own ownership limits and cooldowns; a goal creates no duplicate chore.
 if(goal.kind==='comfort'&&c.job?.practice&&['craft','gather','harvest','take','fallen'].includes(c.job.kind))return 12;
 return 0;
}
