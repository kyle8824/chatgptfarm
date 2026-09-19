import {addEvent,remember,spendEnergy,recordDiscovery} from './core.js';
export const BASIN='willow-basin';
export const FORAGE='willow-basin:upland-berries';
const hour=w=>w.day*24+w.hour;
const sites=[
  {id:FORAGE,label:'Upland berry thicket',habitat:'upland meadow',position:{x:38,y:43}},
  {id:'willow-basin:woodland-berries',label:'Woodland berry thicket',habitat:'woodland margin',position:{x:20,y:49}},
  {id:'willow-basin:eastern-berries',label:'Eastern berry thicket',habitat:'eastern meadow',position:{x:72,y:48}}
];
export function ensureRegions(w){
  w.regions??={version:1,items:{},sites:{}};
  w.regions.items??={};w.regions.sites??={};
  w.regions.items[BASIN]??={id:BASIN,label:'Willow Basin',bounds:{width:100,height:100},neighbors:[]};
  for(const spec of sites){
    const s=w.regions.sites[spec.id]??={...spec,regionId:BASIN,resource:'berries',quantity:12,capacity:12,regrowthPerDay:3,lastRegrowthHour:hour(w)};
    s.habitat??=spec.habitat;
    if(w.worldModel&&!w.worldModel.objects.some(o=>o.id===s.id))w.worldModel.objects.push({id:s.id,type:'berry_patch',label:s.label,zone:s.id,regionId:BASIN,position:{...s.position},geometry:{radiusM:5},physical:{biological:true,harvestable:true},material:'berry shrub',state:{active:true,ediblePortions:s.quantity,capacity:s.capacity}});
  }
  for(const a of w.agents){a.regionId??=BASIN;a.siteKnowledge??={};a.surveyedRegions??={};}
  return w.regions;
}
export function advanceSites(w){
  for(const s of Object.values(w.regions?.sites||{})){
    const days=Math.max(0,Math.floor((hour(w)-s.lastRegrowthHour)/24));
    if(days){s.quantity=Math.min(s.capacity,s.quantity+days*s.regrowthPerDay);s.lastRegrowthHour+=days*24;}
    const o=w.worldModel.objects.find(o=>o.id===s.id);if(o)o.state.ediblePortions=s.quantity;
  }
}
export function siteCandidates(w,a){
  const out=[],deficit=100-a.needs.hunger,hasFood=a.inventory.berries>0||a.inventory.cookedMeat>0||(a.inventory.tubers>0&&a.skills?.['tuber-edible']>0);
  for(const s of Object.values(w.regions?.sites||{})){
    if(s.regionId!==a.regionId)continue;
    const k=a.siteKnowledge[s.id];
    if(!k){out.push({id:`survey:${s.id}`,label:`Search the ${s.habitat} for useful plants`,score:12+a.traits.curiosity*8+deficit*(hasFood?.1:.85),reasons:[['unexamined habitat',12],['food deficit',deficit]]});continue;}
    if(a.inventory.berries>=5)continue;
    const observed=a.position===s.id?s.quantity:k.quantity;
    if(observed===0&&hour(w)-k.observedHour<24)continue;
    out.push({id:`forage:${s.id}`,label:`Gather berries at ${s.label}`,score:18+deficit*(hasFood?.22:.95),reasons:[['remembered food source',18],['food deficit',deficit]]});
  }
  return out;
}
export function resolveSiteAction(w,a,action){
  if(!/^(survey|forage):/.test(action.id))return null;
  const survey=action.id.startsWith('survey:'),id=action.id.slice(action.id.indexOf(':')+1),s=w.regions?.sites[id];
  if(!s||s.regionId!==a.regionId||(!survey&&!a.siteKnowledge[id]))return {success:false,detail:'The site is not known or reachable.',actionId:action.id};
  a.position=id;spendEnergy(a,survey?7:5);
  let detail,success=true;
  if(survey){
    detail=`${a.name} searches the ${s.habitat} and identifies ${s.label}, a source of familiar edible berries.`;
    remember(w,a,`The ${s.habitat} has an edible berry thicket.`,{importance:8,tags:['food','berries','site',id],source:`site:${id}`,confidence:.95});
    recordDiscovery(w,a,id,s.label,detail,'An alternative forage site is now known.');
  }else{
    const q=Math.max(0,Math.min(2,s.quantity));s.quantity-=q;a.inventory.berries+=q;success=q>0;
    detail=q?`${a.name} gathers ${q} berry portions at ${s.label}.`:`${a.name} finds ${s.label} picked clean and remembers to let it recover.`;
    const o=w.worldModel.objects.find(o=>o.id===id);if(o)o.state.ediblePortions=s.quantity;
  }
  a.siteKnowledge[id]={quantity:s.quantity,observedHour:hour(w)};
  a.currentAction=action.label;addEvent(w,'action',action.label,detail,{agentId:a.id,actionId:action.id,siteId:id,success});
  return {success,detail,actionId:action.id};
}
