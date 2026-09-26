import {homeFor,REGIONAL_ITEMS} from '../shared/frontier.js';
// Finite, explicitly accounted activation of additional landscape deposits.
// Old supplies, world object IDs and inventories are never replaced/refilled.
export const RESOURCE_SITES=[
 ['rock-west','stones','Western loose stone',16,33,16],
 ['rock-north','stones','North-bank stone',38,12,14],
 ['rock-east','stones','Eastern loose stone',82,41,18],
 ['rock-ridge','stones','Ridge stone',52,52,16],
 ['reeds-middle','reeds','Middle-bank reeds',45,22,14],
 ['reeds-east','reeds','Eastern-bank reeds',76,22,12],
 ['reeds-north','reeds','North-bank reeds',24,14,12],
 ['clay-west','clay','Western clay exposure',21,22,12],
 ['clay-north','clay','North-bank clay',68,15,14]
].map(([id,item,name,x,y,quantity])=>({id:`resource-${id}`,item,name,position:{x,y},initial:quantity}));
export function ensureResourceSites(w){
 if(w.resourceSites?.version===1)return;
 if(w.resourceSites)throw Error('Unsupported resource-site version; refusing to overwrite saved deposits');
 w.resourceSites={version:1,revision:0,activatedAt:{day:w.day,hour:w.hour},note:'Additional landscape deposits mapped once; earlier resource accounts retained.',nodes:RESOURCE_SITES.map(s=>({...s,position:{...s.position},remaining:s.initial,harvested:0,knownBy:[]}))};
}
export function harvestSite(w,id,count,actorId=null){
 const s=w.resourceSites?.nodes.find(s=>s.id===id);if(!s)return 0;
 const n=Math.max(0,Math.min(s.remaining,Math.floor(count)));s.remaining-=n;s.harvested+=n;if(actorId&&!(s.knownBy||[]).includes(actorId))(s.knownBy??=[]).push(actorId);if(n)w.resourceSites.revision++;return n;
}
export function materialSources(w,material,actor=null){
 const key={stone:'stones',reeds:'reeds',clay:'clay'}[material];if(!key)return [];
 const old=w.worldModel.objects.find(o=>o.zone===key&&(!w.homeContext||(o.homeId||'willow-basin')===w.homeContext.id)),out=[];
 if(old&&(w.resources[key]||0)>0)out.push({id:old.id,item:key,position:old.position,remaining:w.resources[key],resource:key,homeId:old.homeId||'willow-basin'});
 for(const s of w.resourceSites?.nodes||[])if(s.item===key&&s.remaining>0&&(!actor||(s.knownBy||[]).includes(actor.id)||Math.hypot(s.position.x-actor.coordinates.x,s.position.y-actor.coordinates.y)<9))out.push({id:s.id,nodeId:s.id,item:key,position:s.position,remaining:s.remaining});
 return out;
}
export function resourceFrame(w){
 const objects=[];
 const info={berries:['Berry patch','Food portions','Gather berries'],stones:['Loose stone','Stones','Gather for tools and stone construction'],clay:['Clay bank','Clay units','Gather clay for shaping and supported daub walls'],reeds:['Reed bed','Reed bundles','Cut reeds for bindings, walls and roofing']};
 Object.assign(info,Object.fromEntries(Object.entries(REGIONAL_ITEMS).map(([k,v])=>[k,[v.name,'Units',v.use]])));
 for(const o of w.worldModel.objects){
  const account=o.homeId&&o.homeId!=='willow-basin'?homeFor(w,{householdId:o.homeId}).resources:w.resources;
  if(o.state?.active===false||!o.position)continue;const site=w.regions?.sites?.[o.id],spec=info[site?'berries':o.zone];
  if(spec)objects.push({id:o.id,name:o.label||spec[0],mapped:!!o.homeId,type:site?'berries':o.zone,position:o.position,remaining:site?.quantity??account[o.zone]??0,unit:spec[1],use:spec[2],renewable:!!site||['berries','reeds'].includes(o.zone),radius:site?2.2:o.zone==='clay'?2.8:3.0,knownBy:site?w.agents.filter(a=>a.siteKnowledge?.[site.id]).map(a=>a.name):null});
  else if(o.type==='fallen_tree')objects.push({id:o.id,name:'Fallen oak',type:'log',position:o.position,remaining:(account.dryWood||0)+(account.wetWood||0),dry:account.dryWood||0,wet:account.wetWood||0,unit:'Wood units',use:'Collect remaining fallen wood; carry it before use.',radius:1.5});
  else if(o.type==='creek_segment')objects.push({id:o.id,name:o.label||'Creek',type:'water',position:o.position,points:o.geometry?.points,available:!!w.resources.creekWater,unit:'Flowing water',use:'Drinking requires reaching an accessible bank.',radius:2});
 }
 for(const s of w.resourceSites?.nodes||[])objects.push({...s,knownBy:(s.knownBy||[]).map(id=>w.agents.find(a=>a.id===id)?.name||id),type:s.item,unit:info[s.item][1],use:info[s.item][2],radius:s.item==='stones'?1.6:1.3,renewable:['reeds','longFiber'].includes(s.item),mapped:true});
 return objects;
}

export function observeResourceSites(w){
 for(const node of w.resourceSites?.nodes||[])for(const a of w.agents)if(Math.hypot(node.position.x-a.coordinates.x,node.position.y-a.coordinates.y)<9&&!(node.knownBy||[]).includes(a.id)){(node.knownBy??=[]).push(a.id);w.resourceSites.revision++;}
}
