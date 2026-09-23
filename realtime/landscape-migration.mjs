import {NATURAL_REGIONS,LAND_BOUNDS,LAKES,STREAMS,landHeight,waterSample,naturalWorld,LANDMARKS} from '../shared/landscape.js';
import {clock} from './holdings.mjs';
import {addEvent} from '../engine/core.js';

// Spatial migration only. IDs, inventories, ages, relationships, completed work,
// memories, budgets and elapsed clock retain their original values.
export function reorganizeLandscape(w){
 if(!w.frontier)throw Error('Expand the existing world before reorganizing it');
 if(naturalWorld(w))return false;
 const oldHomes=structuredClone(w.frontier.homes),shifts=new Map(oldHomes.map(h=>{const n=NATURAL_REGIONS.find(n=>n.id===h.id);return[h.id,{x:n.x-h.x,y:n.y-h.y}];}));
 const moved=new WeakSet();
 function point(p,home=null){
  if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y)||moved.has(p))return;moved.add(p);
  const h=home||oldHomes.find(h=>Math.abs(p.x-h.x)<77&&Math.abs(p.y-h.y)<72)?.id;
  if(h){const d=shifts.get(h);p.x+=d.x;p.y+=d.y;}
  else {if(p.x>105)p.x=100-p.x;if(p.y>105)p.y=100-p.y;}
 }
 function positions(o,home=null,seen=new Set()){
  if(!o||typeof o!=='object'||seen.has(o))return;seen.add(o);
  if(Number.isFinite(o.x)&&Number.isFinite(o.y)){point(o,home);return;}
  for(const[k,v]of Object.entries(o)){
   if(['parts','code','codeVersion','inventory','items','traits','skills','craftPractice','life','needs','resources','structures','ecology','geometry'].includes(k))continue;
   if(v&&typeof v==='object')positions(v,home,seen);
  }
 }
 const homeOf=o=>o.homeId||oldHomes.find(h=>o.id?.startsWith(h.id+':'))?.id||null;
 for(const collection of [w.worldModel.objects,w.settlement.trees,w.settlement.stores,w.settlement.projects,w.resourceSites.nodes,Object.values(w.regions.sites)])for(const o of collection){
  const h=homeOf(o),before=o.position&&{...o.position};positions(o,h);
  if(before&&o.bounds){const dx=o.position.x-before.x,dy=o.position.y-before.y;for(const k of ['minX','maxX'])o.bounds[k]+=dx;for(const k of ['minZ','maxZ'])o.bounds[k]+=dy;}
  if(o.geometry?.points)for(const pair of (o.geometry.points=structuredClone(o.geometry.points))){const p={x:pair[0],y:pair[1]};point(p,h);pair[0]=p.x;pair[1]=p.y;}
 }
 for(const a of w.agents){positions(a);for(const task of [a.task,...(a.suspendedTasks||[])].filter(Boolean)){task.liveSpaceVersion=0;task.liveWaterVersion=0;task.progressIndex=null;}}
 positions(w.surfaceHistory);positions(w.history);positions(w.chronicle?.events);positions(w.frontier.firstContacts);
 if(w.liveGround?.cells){const cells={};for(const c of Object.values(w.liveGround.cells)){point(c);cells[`${Math.round(c.x*2)},${Math.round(c.y*2)}`]=c;}w.liveGround.cells=cells;}
 for(const a of w.agents){if(a.liveExploration?.cells){const cells={};for(const [key,n]of Object.entries(a.liveExploration.cells)){const[x,y]=key.split(',').map(Number),p={x:x*4,y:y*4};point(p);cells[`${Math.floor(p.x/4)},${Math.floor(p.y/4)}`]=n;}a.liveExploration.cells=cells;}}
 for(const h of w.frontier.homes)Object.assign(h,NATURAL_REGIONS.find(n=>n.id===h.id));
 w.worldModel.bounds={...w.worldModel.bounds,...LAND_BOUNDS};w.frontier.landscapeVersion=2;w.frontier.landscapeMigratedAt=clock(w);
 w.worldModel.terrain=w.worldModel.terrain.filter(t=>t.source!=='frontier-initialization');
 w.worldModel.terrain.push({id:'natural-landscape-v2',type:'continuous-heightfield',source:'landscape-v2'});
 for(const stream of STREAMS){
  const id=stream.homeId?(stream.homeId==='willow-basin'?'OBJ-CREEK-001':stream.homeId+':OBJ-CREEK-001'):stream.id==='longwater'?'frontier-great-river':'landscape:'+stream.id;
  let o=w.worldModel.objects.find(o=>o.id===id);if(!o){o={id,type:'creek_segment',label:stream.name,physical:{water:true,potable:true},state:{active:true,potable:true}};w.worldModel.objects.push(o);}
  o.geometry={...o.geometry,points:stream.points.map(p=>p.slice(0,2)),profile:stream.points.map(p=>p.slice(2)),widthM:stream.points[0][3]*4};o.position={x:stream.points[0][0],y:stream.points[0][1]};
 }
 for(const lake of LAKES)w.worldModel.objects.push({id:'landscape:'+lake.id,type:'lake',label:lake.name,position:{x:lake.x,y:lake.z},geometry:{points:lake.points,waterLevel:lake.level},physical:{water:true,potable:true},state:{active:true,potable:true}});
 // Move newly mapped wilderness trunks/deposits to their bank if the new
 // watercourse intersects them. Keep finite stocks and IDs; never refill.
 function dryPosition(p){const water=waterSample(p.x,p.y);return !water||water.edge>2;}
 for(const o of [...w.settlement.trees,...w.resourceSites.nodes,...Object.values(w.regions.sites)]){
  if(o.position.x>=0&&o.position.y>=0||dryPosition(o.position))continue;
  let found=null;for(let r=3;r<=60&&!found;r+=3)for(let i=0;i<24;i++){const p={x:o.position.x+Math.cos(i*Math.PI/12)*r,y:o.position.y+Math.sin(i*Math.PI/12)*r};if(dryPosition(p)){found=p;break;}}
  if(found){Object.assign(o.position,found);const object=w.worldModel.objects.find(x=>x.id===o.id);if(object)object.position={...found};}
 }
 // A finite forest is mapped once across the formerly empty wilderness.
 let seed=87223,count=0;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 for(let x=-390;x<95;x+=8)for(let y=-390;y<85;y+=8){
  const p={x:x+random()*7,y:y+random()*7};if(p.x>-8&&p.y>-8)continue;
  const density=.42+.24*Math.sin(p.x*.027+Math.sin(p.y*.021)*2)*Math.cos(p.y*.023)+.13*Math.sin(p.x*.07+p.y*.043);
  if(random()>density||landHeight(p.x,p.y)>35||!dryPosition(p)||w.frontier.homes.some(h=>Math.hypot(h.x-p.x,h.y-p.y)<9)||w.settlement.trees.some(t=>Math.hypot(t.position.x-p.x,t.position.y-p.y)<3))continue;
  const id='landscape-tree-'+count++,units=5+Math.floor(random()*6),pine=landHeight(p.x,p.y)>15||random()<.45;
  w.settlement.trees.push({id,position:p,initialUnits:units,timber:units,height:3.8+random()*3.3,pine,rotation:random()*6.28,color:Math.floor(random()*5)});
  w.wood.batches.push({id:`wood-${w.wood.nextId++}`,form:'branch',holder:{kind:'ground',id},units,dryKg:units,waterKg:units*.55,lineage:[],origin:{kind:'landscape-standing-timber',treeId:id,at:clock(w)}});w.wood.initialDryKg+=units;w.wood.initialWaterKg+=units*.55;
 }
 for(const a of w.agents)for(const[id,m]of Object.entries(a.landmarks||{})){const o=w.settlement.trees.find(t=>t.id===id)||w.settlement.projects.find(p=>p.id===id)||w.settlement.stores.find(s=>s.id===id);if(o)m.position={...o.position};}
 w.frontier.landmarks=LANDMARKS;w.frontier.migrationNotes={originalValleyUnmoved:true,mappedTrees:count};
 addEvent(w,'landscape','The wider landscape is remapped','The original valley remains in place. The outer terrain now extends beyond its familiar creek into woodland, hills, lakes and headwaters. Existing people and possessions are retained.',{version:2});
 return true;
}
