import {REGIONAL_ITEMS,campsOf,homeAccount} from '../shared/frontier.js';
import {ensureWood,projectWood,woodCommand} from '../engine/wood-runtime.js';
import {projectWoodCounts} from '../engine/wood-materials.js';
import {addEvent} from '../engine/core.js';
import {forestLayout} from './forest.mjs';
import {ensureResourceSites} from './resource-sites.mjs';
import {shelterPoint} from './layout.mjs';
export const clock=w=>(w.day*24+w.hour)*60+(w.minute||0);
export const WOOD={dryWood:'branch',wetWood:'branch',woodPole:'pole',pointedPole:'pointedPole',boundSharpTool:'boundSharpTool'};
export const ITEM={berries:[.3,.5],tubers:[.5,.6],rawMeat:[.6,.6],cookedMeat:[.5,.5],stones:[1.2,.6],clay:[1,.6],reeds:[.2,1],cordage:[.2,.3],sharpStone:[.4,.3],rawClayVessel:[1.5,3],firedVessel:[1.4,3],dryWood:[1.12,3],wetWood:[1.55,3],woodPole:[1.12,4],pointedPole:[1.12,4],boundSharpTool:[1.3,3]};
Object.assign(ITEM,Object.fromEntries(Object.entries(REGIONAL_ITEMS).map(([k,v])=>[k,[v.mass,v.volume]])));
export const CARRY={mass:18,volume:24};
export const FOOD=['berries','cookedMeat','tubers'];
export const holder=o=>({kind:o.inventory?'carried':'stored',id:o.id});
export const items=o=>o.inventory||o.items;
export function loadOf(w,o){
 let mass=0,volume=0;for(const [k,n]of Object.entries(items(o)||{})){const unit=ITEM[k]||[1,1];if(!WOOD[k])mass+=n*unit[0];volume+=n*unit[1];}
 const h=holder(o);for(const b of w.wood?.batches||[])if(b.holder.kind===h.kind&&b.holder.id===h.id)mass+=b.dryKg+b.waterKg;
 if(o.inventory)for(const c of w.agents||[])if(c.life?.carriedBy===o.id){const age=(c.life.ageAtEpoch||0)+(clock(w)-(c.life.ageEpoch??c.life.bornAt))/((w.lifecycle?.yearDays||60)*1440);mass+=3.5+Math.max(0,Math.min(1,age))*6.5;volume+=4;}
 return {mass,volume};
}
export function capacity(o){return o.inventory?CARRY:{mass:o.capacityKg,volume:o.capacityVolume};}
export function roomFor(w,o,k){const l=loadOf(w,o),c=capacity(o),u=ITEM[k]||[1,1];return Math.max(0,Math.floor(Math.min((c.mass-l.mass)/u[0],(c.volume-l.volume)/u[1])+1e-6));}
export function syncHoldings(w){
 projectWood(w);for(const s of w.settlement?.stores||[]){const h=holder(s);Object.assign(s.items,projectWoodCounts(w.wood,h));for(const [k,form]of Object.entries(WOOD))if(form!=='branch')s.items[k]=w.wood.batches.filter(b=>b.form===form&&b.holder.kind===h.kind&&b.holder.id===h.id).reduce((n,b)=>n+b.units,0);}
}
export function makeStore(w,{position,ownerId=null,kind='pile',name='Ground supplies',capacityKg=60,capacityVolume=90,access='private',covered=false,id=null,...extra}){
 const s={id:id||`store-${w.settlement.nextId++}`,position:{...position},ownerId,kind,name,capacityKg,capacityVolume,access,covered,secured:false,items:{},revision:0,createdAt:clock(w),...extra};w.settlement.stores.push(s);return s;
}
export function ensureSettlement(w){
 ensureResourceSites(w);if(w.settlement?.version===1){ensureCampDryingStores(w);return;}ensureWood(w);
 w.settlement={version:1,nextId:1,stores:[],projects:[],incidents:[],trees:[],designs:[],revision:0};
 // The old shared drying account becomes visible at its existing location.
 const existing=w.wood.batches.filter(b=>b.holder.kind==='stored'&&b.holder.id==='camp-drying');
 if(existing.length||w.structures.shelter){const mass=existing.reduce((n,b)=>n+b.dryKg+b.waterKg,0);makeStore(w,{id:'camp-drying',position:shelterPoint(.35,.7),kind:'pile',name:'Sheltered wood pile',access:'shared',capacityKg:Math.max(60,mass),capacityVolume:Math.max(90,existing.reduce((n,b)=>n+b.units*3,0)),covered:!!w.structures.shelter});}
 // Former scenery receives an explicit, finite standing-timber stock. This
 // does not refill the exhausted fallen-log account or replace saved items.
 for(const tree of forestLayout().filter(t=>t.position.x>2&&t.position.x<98&&t.position.y>2&&t.position.y<78)){
  w.settlement.trees.push({...tree,initialUnits:tree.timber});
  w.wood.batches.push({id:`wood-${w.wood.nextId++}`,form:'branch',holder:{kind:'ground',id:tree.id},units:tree.timber,dryKg:tree.timber,waterKg:tree.timber*.55,lineage:[],origin:{kind:'standing-tree-activation',treeId:tree.id,at:clock(w)}});
  w.wood.initialDryKg+=tree.timber;w.wood.initialWaterKg+=tree.timber*.55;
 }
 w.settlement.migration={at:clock(w),standingTimberUnits:w.settlement.trees.reduce((n,t)=>n+t.timber,0),note:'Existing visible trees now have finite harvestable biomass; old inventories and wood accounts retained.'};
 syncHoldings(w);for(const a of w.agents)enforceCarry(w,a);
}
// A physically completed primitive shelter gains an empty, visible drying
// location. This exposes the existing camp account without granting supplies.
export function ensureCampDryingStores(w){
 for(const c of campsOf(w))if(c.structures.shelter){
  const id=homeAccount({homeContext:c.home},'camp-drying');
  if(!w.settlement.stores.some(s=>s.id===id))makeStore(w,{id,position:shelterPoint(.35,.7,null,c.home),kind:'pile',name:'Sheltered wood pile',access:'shared',covered:true});
 }
}
export function transferItems(w,from,to,key,count,{respectCapacity=true,reason='physical transfer'}={}){
 count=Math.min(Math.floor(count),Math.floor(items(from)[key]||0),respectCapacity?roomFor(w,to,key):Infinity);if(count<=0)return 0;
 if(WOOD[key])woodCommand(w,w.agents[0],{from:holder(from),to:holder(to),quantity:count,category:['dryWood','wetWood'].includes(key)?key:'any',inputForm:WOOD[key],outputForm:WOOD[key],reason});
 else{items(from)[key]-=count;items(to)[key]=(items(to)[key]||0)+count;}
 from.revision=(from.revision||0)+1;to.revision=(to.revision||0)+1;w.settlement.revision++;syncHoldings(w);return count;
}
export function ownPile(w,a){
 return w.settlement.stores.find(s=>s.kind==='pile'&&s.ownerId===a.id&&Math.hypot(s.position.x-a.coordinates.x,s.position.y-a.coordinates.y)<1&&loadOf(w,s).volume<s.capacityVolume-5)||makeStore(w,{position:a.coordinates,ownerId:a.id,name:`${a.name}’s ground supplies`});
}
export function enforceCarry(w,a){
 let l=loadOf(w,a);if(l.mass<=CARRY.mass+.001&&l.volume<=CARRY.volume+.001)return;
 const ordered=Object.keys(a.inventory).sort((x,y)=>(FOOD.includes(x)?-10:ITEM[x]?.[1]||1)-(FOOD.includes(y)?-10:ITEM[y]?.[1]||1)).reverse();let pile=null,dropped=0;
 for(const k of ordered)while(a.inventory[k]>=1&&(l.mass>CARRY.mass+.001||l.volume>CARRY.volume+.001)){pile??=ownPile(w,a);if(!roomFor(w,pile,k))pile=makeStore(w,{position:a.coordinates,ownerId:a.id,name:`${a.name}’s ground supplies`});dropped+=transferItems(w,a,pile,k,1);l=loadOf(w,a);}
 if(dropped)addEvent(w,'storage',`${a.name} puts down an oversized load`,'The excess is now a visible, owned pile at their feet; nothing was discarded.',{agentId:a.id,storeId:pile.id});
}
export function treeUnits(w,t){return w.wood.batches.filter(b=>b.holder.kind==='ground'&&b.holder.id===t.id).reduce((n,b)=>n+b.units,0);}
export function settlementFrame(w,{includeTrees=true}={}){
 const s=w.settlement;if(!s)return null;const timber=new Map();for(const b of w.wood.batches)if(b.holder.kind==='ground')timber.set(b.holder.id,(timber.get(b.holder.id)||0)+b.units);const remaining=t=>timber.get(t.id)||0;return {revision:s.revision,stores:s.stores.filter(x=>x.kind!=='pile'||Object.values(x.items).some(n=>n>0)).map(x=>({...x,load:loadOf(w,x)})),projects:s.projects.map(({code,...p})=>p),treesPartial:!includeTrees,trees:s.trees.filter(t=>includeTrees||t.depleted||t.handGathered||t.timber!==t.initialUnits||remaining(t)<t.initialUnits).map(t=>({id:t.id,position:t.position,remaining:remaining(t),initialUnits:t.initialUnits,pine:t.pine,height:t.height})),designs:s.designs.slice(-6),incidents:s.incidents.slice(-8)};
}
