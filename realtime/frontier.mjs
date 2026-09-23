import {syncLegacyIntoWorldModel} from '../engine/world-model.js';
import {walkable} from '../engine/navigation.js';
import {liveClear} from './motion.mjs';
import {HOME_REGIONS,FRONTIER_SIZE,GREAT_RIVER,FRONTIER_OBSTACLES,householdWorld,knownPerson,regionFor} from '../shared/frontier.js';
import {makeAgent,addEvent,remember,pairKey} from '../engine/core.js';
import {ensureLife} from './life.mjs';
import {ensureSettlement,clock} from './holdings.mjs';
import {forestLayout} from './forest.mjs';
import {RESOURCE_SITES} from './resource-sites.mjs';

export const FOUNDERS=[
 ['agent-mara','Mara','Vale','female',26,'willow-basin'],['agent-ivo','Ivo','Reed','male',28,'willow-basin'],
 ['agent-tessa','Tessa','Flint','female',27,'flint-heights'],['agent-oren','Oren','Hale','male',28,'flint-heights'],
 ['agent-nia','Nia','Fen','female',26,'reed-fen'],['agent-kellan','Kellan','Moss','male',29,'reed-fen'],
 ['agent-elin','Elin','Clay','female',25,'ochre-vale'],['agent-ronan','Ronan','Brook','male',28,'ochre-vale'],
];
function timber(w,id,position,units=8,height=4,pine=true){
 const tree={id,position,initialUnits:units,timber:units,height,pine,rotation:0,color:0};w.settlement.trees.push(tree);
 w.wood.batches.push({id:`wood-${w.wood.nextId++}`,form:'branch',holder:{kind:'ground',id},units,dryKg:units,waterKg:units*.55,lineage:[],origin:{kind:'frontier-standing-timber',treeId:id,at:clock(w)}});
 w.wood.initialDryKg+=units;w.wood.initialWaterKg+=units*.55;
}
// Deliberately invoked once by the release migration, never by a read or by
// resizing the viewer. Existing IDs, coordinates, clocks and accounts remain.
export function expandFrontier(w){
 if(w.frontier){if(w.frontier.version!==1)throw Error('Unknown frontier version');return w.frontier;}
 ensureSettlement(w);ensureLife(w);
 w.frontier={version:1,size:FRONTIER_SIZE,activatedAt:clock(w),homes:HOME_REGIONS.map(h=>({...h,resources:h.id==='willow-basin'?null:{berries:18,dryWood:0,wetWood:0,stones:24,clay:10,reeds:18,creekWater:true},ecology:h.id==='willow-basin'?null:{animalTracks:false,gameTrail:false,smallGame:0,tuberPatch:false,tubers:8,tubersEdible:true},structures:h.id==='willow-basin'?null:{fire:false,shelter:false,cache:false,dryingRack:false},discovered:{creek:true,berries:true,stoneField:true,clayBank:false,reedBed:false},provider:h.id==='ochre-vale'?'openai':'cloudflare'})),firstContacts:{}};
 w.chronicle??={people:{},events:[]};w.worldModel.bounds={...w.worldModel.bounds,width:FRONTIER_SIZE,height:FRONTIER_SIZE};
 const origins=w.worldModel.objects.filter(o=>/^OBJ-(CAMP|CREEK|BERRIES|STONES|CLAY|REEDS|FRONTIER|TREE)-001$/.test(o.id));
 const food=Object.values(w.regions.sites).filter(s=>s.regionId==='willow-basin');
 for(const h of w.frontier.homes){
  const dx=h.x-64,dy=h.y-34;
  w.regions.items[h.id]??={id:h.id,label:h.name,bounds:{width:100,height:100},neighbors:[]};
  if(h.id!=='willow-basin'){
   for(const [units,moisture]of [[12,.12],[6,.55]]){w.wood.batches.push({id:`wood-${w.wood.nextId++}`,form:'branch',holder:{kind:'ground',id:h.id+':log'},units,dryKg:units,waterKg:units*moisture,lineage:[],origin:{kind:'new-region-fallen-wood',homeId:h.id,at:clock(w)}});w.wood.initialDryKg+=units;w.wood.initialWaterKg+=units*moisture;}h.resources.dryWood=12;h.resources.wetWood=6;
   for(const original of origins){const o=structuredClone(original);o.id=h.id+':'+o.id;o.homeId=h.id;o.regionId=h.id;o.position={x:o.position.x+dx,y:o.position.y+dy};if(o.geometry.points)o.geometry.points=o.geometry.points.map(([x,y])=>[x+dx,y+dy]);o.childrenIds=[];o.history=[];o.state.active=true;o.provenance={source:'frontier-initialization',at:clock(w)};w.worldModel.objects.push(o);}
   for(const old of food){const s={...structuredClone(old),id:h.id+':'+old.id.split(':').at(-1),regionId:h.id,label:h.name+' '+old.habitat+' berries',position:{x:old.position.x+dx,y:old.position.y+dy},quantity:12,lastRegrowthHour:w.day*24+w.hour};w.regions.sites[s.id]=s;w.worldModel.objects.push({id:s.id,type:'berry_patch',label:s.label,zone:s.id,regionId:h.id,homeId:h.id,position:s.position,geometry:{radiusM:5},physical:{biological:true,harvestable:true},state:{active:true,ediblePortions:s.quantity}});}
   for(const old of RESOURCE_SITES){const node={...old,id:h.id+':'+old.id,name:h.name+' '+old.name,position:{x:old.position.x+dx,y:old.position.y+dy},remaining:old.initial,harvested:0,knownBy:[]};if(node.position.x>0&&node.position.y>0&&node.position.x<FRONTIER_SIZE&&node.position.y<FRONTIER_SIZE)w.resourceSites.nodes.push(node);}
   for(const t of forestLayout().filter(t=>t.position.x>4&&t.position.x<98&&t.position.y>4&&t.position.y<78))timber(w,h.id+':'+t.id,{x:t.position.x+dx,y:t.position.y+dy},t.timber,t.height,t.pine);
  }
  w.resourceSites.nodes.push({id:h.id+':specialty',item:h.specialty,name:h.name+' '+h.specialty,position:{x:h.x+12,y:h.y+8},initial:90,remaining:90,harvested:0,knownBy:[],regionId:h.id});
 }
 w.worldModel.objects.push({id:'frontier-great-river',type:'creek_segment',label:'The Longwater',position:{x:250,y:riverCenter()},geometry:{points:GREAT_RIVER,widthM:5},physical:{water:true,potable:true},state:{active:true,potable:true}});
 for(const r of FRONTIER_OBSTACLES)w.worldModel.terrain.push({...r,type:r.kind,source:'frontier-initialization'});
 for(let x=115;x<390;x+=35)for(let y=70;y<480;y+=35){const p={x:x+Math.sin(x+y)*9,y:y+Math.cos(x-y)*9};if(regionFor(p)||!walkable(w,p))continue;for(let n=0;n<3;n++){const pos={x:p.x+n*2.3,y:p.y+Math.sin(n)*3};if(walkable(w,pos))timber(w,`wild-tree-${x}-${y}-${n}`,pos,6,3.5+n*.6,n%2===0);}if((x+y)%3===0){const id=`wild-food-${x}-${y}`,s={id,regionId:'wilderness',label:'Wild woodland berry patch',habitat:'woodland opening',position:p,resource:'berries',quantity:8,capacity:8,regrowthPerDay:2,lastRegrowthHour:w.day*24+w.hour};w.regions.sites[id]=s;w.worldModel.objects.push({id,type:'berry_patch',label:s.label,zone:id,regionId:'wilderness',position:p,geometry:{radiusM:4},physical:{harvestable:true},state:{active:true,ediblePortions:8}});}}
 for(const [i,[id,name,surname,sex,age,homeId]]of FOUNDERS.entries()){
  let a=w.agents.find(a=>a.id===id);const h=w.frontier.homes.find(h=>h.id===homeId);
  if(!a){a=makeAgent(id,name,'camp',{hydration:80,hunger:85,energy:85,warmth:65},{curiosity:.58+(i%3)*.08,cooperation:.63+(i%2)*.12,caution:.4+(i%3)*.09});a.coordinates={x:h.x+(i%2?2:-2),y:h.y};w.agents.push(a);}
  a.surname??=surname;a.householdId??=homeId;a.regionId=homeId;a.knownPeople??={};a.siteKnowledge??={};a.surveyedRegions??={};
  ensureLife(w);a.life.sex=sex;if(!['agent-mara','agent-ivo'].includes(id)){a.life.ageAtEpoch=age;a.life.ageEpoch=clock(w);}
  w.chronicle.people[id]??={id,givenName:a.name,surname:a.surname,parents:[...a.life.parents],bornAt:a.life.bornAt,founder:true,householdId:a.householdId,firstRecordedAt:clock(w)};
 }
 for(const a of w.agents)for(const b of w.agents)if(a.id!==b.id&&a.householdId===b.householdId)a.knownPeople[b.id]??={firstMetAt:clock(w),lastSeenAt:clock(w),coordinates:{...b.coordinates}};
 for(const h of w.frontier.homes){const people=w.agents.filter(a=>a.householdId===h.id);if(h.id==='willow-basin')continue;const rel=w.relationships[pairKey(people[0].id,people[1].id)];rel.trust=34;rel.familiarity=12;rel.affinity=50;}
 addEvent(w,'frontier','Four distant valleys','The existing valley is now part of a larger continuous landscape. Six new adult founders live in three distant regions. They have not met the original villagers.',{homeIds:w.frontier.homes.map(h=>h.id)});
 syncLegacyIntoWorldModel(w);return w.frontier;
}
const riverCenter=()=>244;
export function observePeople(w){
 if(!w.frontier)return;
 for(let i=0;i<w.agents.length;i++)for(let j=i+1;j<w.agents.length;j++){
  const a=w.agents[i],b=w.agents[j];if(!a.coordinates||!b.coordinates||Math.hypot(a.coordinates.x-b.coordinates.x,a.coordinates.y-b.coordinates.y)>8||!liveClear(w,a.coordinates,b.coordinates))continue;
  const fresh=!knownPerson(a,b);for(const[p,q]of [[a,b],[b,a]])(p.knownPeople??={})[q.id]={firstMetAt:p.knownPeople?.[q.id]?.firstMetAt??clock(w),lastSeenAt:clock(w),coordinates:{...q.coordinates}};
  if(fresh){const detail=`${a.name} ${a.surname} and ${b.name} ${b.surname} encountered one another in the landscape.`;remember(w,a,detail,{importance:9,tags:['social','first-contact']});remember(w,b,detail,{importance:9,tags:['social','first-contact']});const k=[a.householdId,b.householdId].sort().join('|');if(!w.frontier.firstContacts[k]){w.frontier.firstContacts[k]={at:clock(w),people:[a.id,b.id],position:{...a.coordinates}};addEvent(w,'first-contact','People from distant valleys meet',detail,{agentIds:[a.id,b.id],position:{...a.coordinates}});}}
 }
}
export function frontierFrame(w){return w.frontier?{version:1,size:FRONTIER_SIZE,homes:w.frontier.homes.map(h=>({id:h.id,name:h.name,x:h.x,y:h.y,biome:h.biome,color:h.color,provider:h.provider,structures:h.id==='willow-basin'?w.structures:h.structures})),obstacles:FRONTIER_OBSTACLES,river:GREAT_RIVER,firstContacts:w.frontier.firstContacts}:null;}
export {householdWorld};
