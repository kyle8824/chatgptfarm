import {clamp} from '../engine/core.js';
import {clock} from './holdings.mjs';

export const INTERESTS=[
 {id:'building',label:'Building',active:true},
 {id:'exploring',label:'Exploring',active:true},
 {id:'learning',label:'Learning skills',active:true},
 {id:'socializing',label:'Socializing',active:true},
 {id:'games',label:'Playing games',active:true},
 {id:'quiet',label:'Quiet time',active:true},
 {id:'cooking',label:'Cooking',active:false},
 {id:'fishing',label:'Fishing',active:false},
 {id:'hunting',label:'Hunting',active:false},
];
function affinity(a,id){
 let seed=2166136261;for(const c of `${a.id}:${id}:interests-1`)seed=Math.imul(seed^c.charCodeAt(0),16777619)>>>0;
 const trait=['exploring','learning'].includes(id)?a.traits?.curiosity:['socializing','games'].includes(id)?a.traits?.cooperation:.5;
 return Math.round(clamp(20+seed%61+((trait??.5)-.5)*24));
}
function factors(a){const f=a.freeTime||{},n=a.needs;return [
 {label:'Physical wellbeing',value:(n.hunger+n.hydration+n.energy+n.warmth)/4,weight:.28},
 {label:'Comfort',value:a.comfort?.value??55,weight:.14},
 {label:'Companionship',value:f.company??55,weight:.2},
 {label:'Enjoyment',value:f.enjoyment??55,weight:.24},
 {label:'Sense of progress',value:f.mastery??55,weight:.14},
];}
const target=a=>factors(a).reduce((n,f)=>n+f.value*f.weight,0);
function initial(a){return {version:1,value:target(a),preferences:Object.fromEntries(INTERESTS.map(x=>[x.id,affinity(a,x.id)])),satisfaction:{},activityMinutes:{},lastActivity:null};}
export const ensureHappiness=a=>a.happiness??=initial(a);
export function advanceHappiness(a,seconds){
 const h=ensureHappiness(a),hours=seconds/3600;
 // Preferences persist. The desire to repeat a hobby recovers gradually.
 for(const id of Object.keys(h.satisfaction))h.satisfaction[id]=Math.max(0,h.satisfaction[id]-hours*8);
 h.value=clamp(h.value+(target(a)-h.value)*(1-Math.exp(-hours/2)));
}
export function activityInterest(c){
 const id=c?.actionId||c?.id||'',j=c?.selected?.job||c?.job||{};
 if(j.kind==='hand_game')return 'games';
 if(['conversation','courtship','commitment','family_plan','private_time'].includes(j.kind))return 'socializing';
 if(j.kind==='relax')return 'quiet';
 if(id==='explore')return 'exploring';
 if(j.practice||j.kind==='study')return 'learning';
 if(['assemble','repair'].includes(j.kind)||j.projectId&&['craft','harvest','gather','take','deliver'].includes(j.kind)||id==='build_shelter')return 'building';
 if(j.kind==='craft'||j.kind==='regional_craft')return 'learning';
 return null;
}
export function interestBonus(a,c){
 const id=activityInterest(c);if(!id)return 0;
 const h=a.happiness||initial(a),s=h.satisfaction[id]||0;
 return (h.preferences[id]-50)*.22+(100-h.value)*.12+(100-s)*.12-s*.2;
}
// Called after physical work, not after choosing or requesting an activity.
// The cursor travels with a task through suspension/checkpoint/restart.
export function recordEnjoyedWork(w,a,t){
 const current=t.workMinutes||0,previous=t.happinessWork??current;
 t.happinessWork=Math.max(previous,current);const minutes=Math.max(0,current-previous),id=activityInterest(t);
 if(!id||!minutes)return;
 const h=ensureHappiness(a),s=h.satisfaction[id]||0,liking=h.preferences[id]/100;
 const quality=id==='quiet'?Math.max(0,((a.restSupport?.score??25)-25)/75):1;
 const novelty=Math.max(.05,1-s/100),reward=minutes*(.12+liking*.55)*novelty*quality;
 h.satisfaction[id]=clamp(s+minutes*2);h.activityMinutes[id]=(h.activityMinutes[id]||0)+minutes;
 h.value=clamp(h.value+reward*.35);a.freeTime.enjoyment=clamp(a.freeTime.enjoyment+reward);
 if(['building','learning','exploring'].includes(id))a.freeTime.mastery=clamp(a.freeTime.mastery+reward*.6);
 h.lastActivity={id,label:INTERESTS.find(x=>x.id===id).label,at:clock(w),enjoyment:Math.round(h.preferences[id])};
}
export function happinessContext(a){
 const h=a.happiness||initial(a);
 return {value:Math.round(h.value),feeling:h.value<25?'Unhappy':h.value<45?'Low spirits':h.value<65?'Content':h.value<85?'Happy':'Delighted',
  factors:factors(a).map(({label,value})=>({label,value:Math.round(value)})),lastActivity:h.lastActivity,
  preferences:INTERESTS.map(x=>({...x,value:Math.round(h.preferences[x.id]),satisfaction:Math.round(h.satisfaction[x.id]||0),minutes:Math.round(h.activityMinutes[x.id]||0)})).sort((a,b)=>Number(b.active)-Number(a.active)||b.value-a.value)};
}
export function happinessSummary(a){const h=happinessContext(a);return {value:h.value,feeling:h.feeling,interests:h.preferences.filter(x=>x.active).map(({id,value,satisfaction})=>({activity:id,liking:value,recentSatisfaction:satisfaction}))};}
