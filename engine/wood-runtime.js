import {homeAccount,householdWorld,campsOf} from '../shared/frontier.js';
import {importLegacyWood,reconcileLegacyWoodEntities,projectWoodCounts,applyWoodCommand,integrateWood,transferWood,totals} from './wood-materials.js';

const carried=id=>({kind:'carried',id});
const ground=id=>({kind:'ground',id});
const forms={woodPole:'pole',pointedPole:'pointedPole',boundSharpTool:'boundSharpTool'};
const now=w=>w.day*24+w.hour;
export function ensureWood(w){
  if(w.wood)return w.wood;
  const ledger=importLegacyWood(w);
  reconcileLegacyWoodEntities(w,ledger);
  // Worked inventory is distinct from raw branch counts. Its historical wood
  // mass is unknown: use the same explicit one-branch assumption, once only.
  for(const a of w.agents)for(const [key,form] of Object.entries(forms)){
    const count=a.inventory[key]||0;if(!count)continue;
    ledger.batches.push({id:`wood-${ledger.nextId++}`,form,holder:carried(a.id),units:count,dryKg:count,waterKg:count*.12,lineage:[],origin:{kind:'legacy-worked-import',category:key,priorHistory:'unknown',massAssumption:'1 kg wood per item'}});
  }
  // Legacy placed pieces are no longer in any inventory. Preserve them once.
  for(const o of w.worldModel?.objects||[]){
    if(o.parentId||!o.physical?.wood||o.state?.carried||!o.provenance?.detached||o.state?.active===false)continue;
    ledger.batches.push({id:`wood-${ledger.nextId++}`,form:'branch',holder:ground(o.zone),units:1,dryKg:1,waterKg:(o.material?.moisturePct??32)/100,entityIds:[o.id],lineage:[],origin:{kind:'legacy-placed-import',priorHistory:'unknown',massAssumption:'1 kg per legacy branch'}});
  }
  // Existing fire has unknown historical fuel. Preserve one hour of its old
  // state, explicitly, without manufacturing new burnable inventory.
  ledger.legacyFireUntil=w.structures.fire?now(w)+1:null;
  ledger.initialDryKg=totals(ledger).dryKg;ledger.initialWaterKg=totals(ledger).waterKg;
  ledger.nextOperation=1;w.wood=ledger;projectWood(w);return ledger;
}
export function projectWood(w){
  if(!w.wood)return;
  const root=w.rootWorld||w;for(const h of root.frontier?.homes||[null]){const view=h?householdWorld(root,{householdId:h.id}):root;Object.assign(view.resources,projectWoodCounts(root.wood,ground(homeAccount(view,'log'))));}
  for(const a of w.agents){
    Object.assign(a.inventory,projectWoodCounts(w.wood,carried(a.id)));
    for(const [key,form] of Object.entries(forms))a.inventory[key]=w.wood.batches.filter(b=>b.form===form&&b.holder.kind==='carried'&&b.holder.id===a.id).reduce((n,b)=>n+b.units,0);
  }
  for(const b of w.wood.batches)for(const id of b.entityIds||[]){
    const o=w.worldModel?.objects.find(o=>o.id===id);if(!o)continue;
    o.material??={};o.material.moisturePct=100*b.waterKg/b.dryKg;
    o.state.carried=b.holder.kind==='carried';o.carrierId=o.state.carried?b.holder.id:null;
    o.state.inventoryKey=b.form==='branch'?(b.waterKg/b.dryKg<=.24?'dryWood':'wetWood'):null;
    o.state.active=b.form==='branch';o.state.woodBatchId=b.id;
    if(o.state.carried)o.zone=w.agents.find(a=>a.id===o.carrierId)?.position||o.zone;
  }
}
export function woodCommand(w,a,{from=carried(a.id),to=carried(a.id),quantity=1,category='any',inputForm='branch',outputForm='branch',reason}){
  const ledger=ensureWood(w),operationId=`wood-action-${ledger.nextOperation}`;
  const result=applyWoodCommand(ledger,{operationId,from,to,quantity,category,inputForm,outputForm,reason});
  ledger.nextOperation++;projectWood(w);return result;
}
export function gatherWood(w,a,key,count,location='log'){
  return woodCommand(w,a,{from:ground(homeAccount(w,location)),quantity:count,category:key,reason:'gather available branches'});
}
export function fuelFire(w,a,count=Math.min(2,a.inventory.dryWood)){
  woodCommand(w,a,{to:{kind:'stored',id:homeAccount(w,'camp-fire')},quantity:count,category:'dryWood',outputForm:'fuel',reason:'load fire with carried fuel'});
  w.structures.fire=true;
}
export function shelterWood(w,a){return woodCommand(w,a,{to:{kind:'stored',id:homeAccount(w,'camp-shelter')},quantity:4,category:'dryWood',outputForm:'shelter-component',reason:'retain wood in shelter'});}
export function transformWood(w,a,key,outputForm){
  if((a.inventory[key]||0)<1)return false;
  return woodCommand(w,a,{category:key==='dryWood'||key==='wetWood'?key:'any',inputForm:forms[key]||'branch',outputForm,reason:`shape ${key} into ${outputForm}`});
}
export function woodConditions(w,h){
  const location=h.kind==='carried'?w.agents.find(a=>a.id===h.id)?.position:h.id;
  const person=h.kind==='carried'?w.agents.find(a=>a.id===h.id):null;const covered=(w.frontier?campsOf(w).some(c=>c.structures.shelter&&(person?.coordinates?Math.hypot(person.coordinates.x-c.shelter.x,person.coordinates.y-c.shelter.y)<1.5:[homeAccount(householdWorld(w,{householdId:c.home.id}),'camp-shelter'),homeAccount(householdWorld(w,{householdId:c.home.id}),'camp-drying')].includes(location))):!!w.structures.shelter&&['camp','camp-shelter','camp-drying'].includes(location))||!!w.settlement?.stores.find(s=>s.id===location&&s.covered);
  const coverage=w.settlement?.stores.find(s=>s.id===location)?.coverage;
  return {...(coverage!==undefined?{rainExposure:1-coverage}:{}),temperatureC:(w.temperature-32)*5/9,humidity:w.weather==='rain'?.9:w.weather==='cloudy'?.7:.45,airflow:h.kind==='carried'?.6:1,covered,raining:w.weather==='rain'};
}
export function advanceWood(w,toHour){
  const ledger=ensureWood(w),from=ledger.lastHour;
  integrateWood(ledger,toHour,h=>woodConditions(w,h));
  // Small fire: dry fuel consumption of 0.25 kg/hour; energy and exposure
  // remain coarse hourly approximations. No random extinction or free fuel.
  const demands=new Map();
  for(const b of [...ledger.batches].filter(b=>b.form==='fuel')){
    const fire=b.holder.id;let demand=demands.get(fire)??.25*Math.max(0,toHour-from);if(demand<=0)continue;
    const used=Math.min(demand,b.dryKg),fraction=used/b.dryKg;
    const sink={holder:structuredClone(b.holder),origin:structuredClone(b.origin),entityIds:[...(b.entityIds||[])],operationId:`fire:${from}:${toHour}:${b.id}`,batchId:b.id,units:b.units*fraction,dryKg:used,waterKg:b.waterKg*fraction,reason:'fire combustion',at:toHour};
    ledger.sinks.push(sink);b.dryKg-=used;b.waterKg-=sink.waterKg;b.units-=sink.units;demand-=used;demands.set(fire,demand);
    if(b.dryKg<1e-10)ledger.batches=ledger.batches.filter(x=>x!==b);
  }
  const root=w.rootWorld||w;for(const h of root.frontier?.homes||[null]){const view=h?householdWorld(root,{householdId:h.id}):root;view.structures.fire=ledger.batches.some(b=>b.form==='fuel'&&b.holder.id===homeAccount(view,'camp-fire'))||(!h||h.id==='willow-basin')&&(ledger.legacyFireUntil??-1)>toHour;}
  projectWood(w);
}
export function storeWood(w,a){
  if(!w.structures.shelter)return false;
  const retain=0;
  const count=(a.inventory.wetWood||0)+Math.max(0,(a.inventory.dryWood||0)-retain);if(!count)return false;
  a.position='camp';
  if(a.inventory.wetWood)woodCommand(w,a,{to:{kind:'stored',id:homeAccount(w,'camp-drying')},quantity:a.inventory.wetWood,category:'wetWood',reason:'place damp wood beneath existing shelter'});
  if(a.inventory.dryWood>retain)woodCommand(w,a,{to:{kind:'stored',id:homeAccount(w,'camp-drying')},quantity:a.inventory.dryWood-retain,category:'dryWood',reason:'protect spare fuel beneath existing shelter'});
  a.fuelStoreKnown=true;return true;
}
export function storedWood(w){return w.wood?projectWoodCounts(w.wood,{kind:'stored',id:homeAccount(w,'camp-drying')}):{dryWood:0,wetWood:0};}
export function storedFuel(w){return storedWood(w).dryWood;}
// A coarse energy-limited drying action, not instant wet->dry conversion.
// At .25 kg dry fuel/hour (~4 MJ), cap evaporation at .30 kg water/hour
// across all actors (~.68 MJ latent heat). Geometry/heat transfer is approximate.
export function dryWoodByFire(w,a){
  const ledger=ensureWood(w);if(!w.structures.fire)return false;
  const hour=now(w),account=homeAccount(w,'camp-fire'),heat=w.frontier?(ledger.dryingHeatByFire??={})[account]:ledger.dryingHeat,used=heat?.hour===hour?heat.waterKg:0;
  let budget=Math.max(0,.30-used);if(!budget)return false;
  if(!a.inventory.wetWood&&a.position==='camp'&&storedWood(w).wetWood)woodCommand(w,a,{from:{kind:'stored',id:homeAccount(w,'camp-drying')},quantity:1,category:'wetWood',reason:'take one stored branch to dry near fire'});
  const source=ledger.batches.find(b=>b.form==='branch'&&b.holder.kind==='carried'&&b.holder.id===a.id&&b.waterKg/b.dryKg>.24);
  if(!source)return false;
  const id=transferWood(ledger,source.id,1,{kind:'stored',id:`drying-work:${a.id}`});
  const b=ledger.batches.find(b=>b.id===id);b.holder=carried(a.id);
  const evaporated=Math.min(budget,Math.max(0,b.waterKg-b.dryKg*.239));
  b.waterKg-=evaporated;ledger.environmentWaterExchangeKg-=evaporated;
  if(w.frontier)ledger.dryingHeatByFire[account]={hour,waterKg:used+evaporated};else ledger.dryingHeat={hour,waterKg:used+evaporated};
  ledger.operations.push({id:`wood-action-${ledger.nextOperation++}`,at:hour,kind:'fire-drying',batchId:id,evaporatedKg:evaporated});
  a.position='camp';projectWood(w);return {evaporatedKg:evaporated,dry:b.waterKg/b.dryKg<=.24};
}
export function collectStoredFuel(w,a){
  const count=Math.min(2,storedFuel(w));if(!count)return false;
  a.position='camp';woodCommand(w,a,{from:{kind:'stored',id:homeAccount(w,'camp-drying')},quantity:count,category:'dryWood',reason:'retrieve dried wood from camp'});return true;
}
// Attached branch geometry describes the finite ground supply, not additional
// matter. Cutting must claim a real source unit before detaching its entity.
export function claimBranch(w,a,object){
  ensureWood(w);
  const source=w.wood.batches.find(b=>b.form==='branch'&&b.holder.kind==='ground'&&b.holder.id==='log'&&!b.entityIds?.length);if(!source)return false;
  const key=source.waterKg/source.dryKg<=.24?'dryWood':'wetWood';
  const id=transferWood(w.wood,source.id,1,carried(a.id)),b=w.wood.batches.find(b=>b.id===id);
  b.entityIds=[object.id];projectWood(w);return key;
}
export function placeBranch(w,a,object,location){
  ensureWood(w);const b=w.wood.batches.find(b=>b.entityIds?.includes(object.id)&&b.holder.kind==='carried'&&b.holder.id===a.id);
  if(!b||b.form!=='branch')return false;
  transferWood(w.wood,b.id,b.units,ground(location));projectWood(w);return true;
}
export function takeBranch(w,a,object){
  ensureWood(w);const b=w.wood.batches.find(b=>b.entityIds?.includes(object.id)&&b.form==='branch'&&b.holder.kind==='ground'&&b.holder.id===a.position);
  if(!b)return false;
  transferWood(w.wood,b.id,b.units,carried(a.id));projectWood(w);return true;
}
