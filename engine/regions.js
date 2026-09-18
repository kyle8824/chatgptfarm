import {addEvent,remember,spendEnergy,recordDiscovery} from './core.js';

export const BASIN='willow-basin';
export const FORAGE='willow-basin:upland-berries';
const hour=w=>w.day*24+w.hour;

// Additive migration: existing identities, coordinates and resource pools survive.
export function ensureRegions(w){
  w.regions??={version:1,items:{},sites:{}};
  w.regions.items[BASIN]??={id:BASIN,label:'Willow Basin',bounds:{width:100,height:100},neighbors:[]};
  w.regions.sites[FORAGE]??={id:FORAGE,regionId:BASIN,label:'Upland berry thicket',position:{x:38,y:43},resource:'berries',quantity:12,capacity:12,regrowthPerDay:3,lastRegrowthHour:hour(w)};
  for(const a of w.agents){a.regionId??=BASIN;a.siteKnowledge??={};a.surveyedRegions??={};}
  // Expose a real world object for rendering/selection, not AI omniscience.
  const s=w.regions.sites[FORAGE];
  if(w.worldModel&&!w.worldModel.objects.some(o=>o.id===FORAGE))w.worldModel.objects.push({id:FORAGE,type:'berry_patch',label:s.label,zone:FORAGE,regionId:BASIN,position:{...s.position},geometry:{radiusM:5},physical:{biological:true,harvestable:true},material:'berry shrub',state:{active:true,ediblePortions:s.quantity,capacity:s.capacity}});
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
  const out=[];
  if(a.regionId===BASIN&&!a.surveyedRegions[BASIN])out.push({id:'survey:willow-basin',label:'Search the upland meadow for useful plants',score:18+a.traits.curiosity*12+(100-a.needs.hunger)*.2,reasons:[['unexamined local terrain',18]]});
  for(const [id,k] of Object.entries(a.siteKnowledge||{})){
    const s=w.regions?.sites[id];if(!s||s.regionId!==a.regionId||a.inventory.berries>=5)continue;
    const age=hour(w)-k.observedHour;
    // Remote decisions use remembered availability; only arrival reveals changes.
    if(k.quantity===0&&age<24)continue;
    out.push({id:`forage:${id}`,label:`Gather berries at ${s.label}`,score:20+(100-a.needs.hunger)*.4,reasons:[['known alternative food source',20]]});
  }
  return out;
}
export function resolveSiteAction(w,a,action){
  if(!/^(survey|forage):/.test(action.id))return null;
  let detail,success=true;
  if(action.id==='survey:willow-basin'&&a.regionId===BASIN){
    const s=w.regions.sites[FORAGE];a.position=s.id;spendEnergy(a,10);a.surveyedRegions[BASIN]=true;
    a.siteKnowledge[s.id]={quantity:s.quantity,observedHour:hour(w)};
    detail=`${a.name} searches the upland meadow and finds ${s.label}, a separate source of the basin's edible berries.`;
    remember(w,a,`The upland meadow has another edible berry thicket.`,{importance:8,tags:['food','berries','site',s.id],source:`site:${s.id}`,confidence:.95});
    recordDiscovery(w,a,s.id,s.label,detail,'An alternative forage site is now known.');
  }else{
    const id=action.id.slice('forage:'.length),s=w.regions.sites[id];
    if(!s||!a.siteKnowledge[id]||s.regionId!==a.regionId)return {success:false,detail:'The forage site is not known or reachable.',actionId:action.id};
    a.position=id;spendEnergy(a,5);const q=Math.min(2,s.quantity);s.quantity-=q;a.inventory.berries+=q;
    a.siteKnowledge[id]={quantity:s.quantity,observedHour:hour(w)};success=q>0;
    detail=q?`${a.name} gathers ${q} berry portions at ${s.label}.`:`${a.name} finds ${s.label} picked clean and remembers to let it recover.`;
    const o=w.worldModel.objects.find(o=>o.id===id);if(o)o.state.ediblePortions=s.quantity;
  }
  a.currentAction=action.label;addEvent(w,'action',action.label,detail,{agentId:a.id,actionId:action.id,regionId:a.regionId,siteId:a.position,success});
  return {success,detail,actionId:action.id};
}
