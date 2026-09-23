import {recordCrossingWear,noteCargoLimits} from './structure-lifecycle.mjs';
import {walkable,clearSegment,walkingSpeed,distance} from '../engine/navigation.js';
import {coordForPosition} from '../engine/spectator.js';
import {CAMP,shelterPoint,shelterLocal} from './layout.mjs';
import {waterBankPoints,withinWaterReach,nearestWater} from './water.mjs';
import {onDeck,crossingPace,structureBlocks,structureWaypoints} from './structures.mjs';

export const BODY_DISTANCE=1.05;
export const ARRIVAL_SPACE=1.5;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const hash=s=>{let n=2166136261;for(const c of s)n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;};
export function motionState(a){return a.locomotion??={seed:hash(a.id),vx:0,vy:0,speed:0,facing:0,arrivals:[]};}
function random(a){const m=motionState(a);m.seed=(Math.imul(m.seed,1664525)+1013904223)>>>0;return m.seed/4294967296;}
const angleDiff=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
function segmentDistance(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,t=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1),0,1);return distance(p,{x:a.x+t*dx,y:a.y+t*dy});}
export function liveWalkable(w,p,actor=null,checkTrees=true){
 if((!walkable(w,p)&&!onDeck(w,p,actor))||distance(p,CAMP.fire)<CAMP.fire.radius||structureBlocks(w,p))return false;
 if(checkTrees)for(const tree of w.settlement?.trees||[])if(!tree.depleted&&(p.x-tree.position.x)**2+(p.y-tree.position.y)**2<.43**2)return false;
 if(w.structures.shelter){const q=shelterLocal(p),s=CAMP.shelter;
  // Two roof/wall footprints. Both gable entrances remain open.
  if(Math.abs(q.y)<s.halfLength+.4&&Math.abs(q.x)>.72&&Math.abs(q.x)<s.halfWidth+.43)return false;
 }
 return true;
}
export function liveClear(w,a,b,actor=null){
 // Check each trunk once against the whole segment, rather than rescanning
 // every tree at every quarter-unit sample. This also closes sampling gaps.
 const dx=b.x-a.x,dy=b.y-a.y,length2=dx*dx+dy*dy;
 for(const tree of w.settlement?.trees||[]){if(tree.depleted)continue;const p=tree.position,t=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/(length2||1),0,1);if((p.x-a.x-t*dx)**2+(p.y-a.y-t*dy)**2<.43**2)return false;}
 return clearSegment(w,a,b,(world,p)=>liveWalkable(world,p,actor,false));
}
export function liveRoute(w,from,to,actor=null){
 if(!liveWalkable(w,to,actor))return null;let start=from,escape=null;
 // Old versions could save bodies inside a roof or fire footprint. Walk out
 // of that invalid placement over elapsed time; never teleport on migration.
 if(!liveWalkable(w,start)){
  outer:for(let r=.25;r<=4;r+=.25)for(let i=0;i<24;i++){const p={x:from.x+Math.cos(i/24*Math.PI*2)*r,y:from.y+Math.sin(i/24*Math.PI*2)*r};if(liveWalkable(w,p)){start=p;escape=p;break outer;}}
  if(!escape)return null;
 }
 const others=actor?w.agents.filter(b=>b.id!==actor.id&&!b.life?.carriedBy):[],clear=(a,b)=>liveClear(w,a,b,actor)&&others.every(o=>segmentDistance(o.coordinates,a,b)>=Math.min(BODY_DISTANCE+.08,distance(o.coordinates,a)-.001));
 let path;
 if(clear(start,to))path=[start,to];
 else{
  // Visibility routing through real doorway/corner clearances avoids grid
  // quantization and remains cheap enough for the running server.
  const points=[start,to];for(const x of [-2.65,0,2.65])for(const y of [-2.5,2.5])points.push(shelterPoint(x,y));points.push(shelterPoint(0,0));
  for(let i=0;i<12;i++)points.push({x:CAMP.fire.x+Math.cos(i/12*Math.PI*2)*1.6,y:CAMP.fire.y+Math.sin(i/12*Math.PI*2)*1.6});
  points.push(...structureWaypoints(w));
  for(const b of others)for(let i=0;i<12;i++)points.push({x:b.coordinates.x+Math.cos(i/6*Math.PI)*1.38,y:b.coordinates.y+Math.sin(i/6*Math.PI)*1.38});
  for(const tree of (w.settlement?.trees||[]).filter(t=>!t.depleted&&segmentDistance(t.position,start,to)<1.5).slice(0,16))for(let i=0;i<8;i++)points.push({x:tree.position.x+Math.cos(i/4*Math.PI)*.7,y:tree.position.y+Math.sin(i/4*Math.PI)*.7});
  const costs=points.map(()=>Infinity),heuristic=points.map(p=>distance(p,to)),previous=[],done=new Set();costs[0]=0;
  while(done.size<points.length){let i=-1;for(let n=0;n<points.length;n++)if(!done.has(n)&&(i<0||costs[n]+heuristic[n]<costs[i]+heuristic[i]))i=n;if(i<0||!Number.isFinite(costs[i]))break;if(i===1){path=[];while(i!==undefined){path.unshift(points[i]);i=previous[i];}break;}done.add(i);
   for(let j=0;j<points.length;j++)if(!done.has(j)&&clear(points[i],points[j])){const cost=costs[i]+distance(points[i],points[j]);if(cost<costs[j]){costs[j]=cost;previous[j]=i;}}
  }
 }
 if(!path)return null;
 const simple=[path[0]];let i=0;while(i<path.length-1){let j=path.length-1;while(j>i+1&&!clear(path[i],path[j]))j--;simple.push(path[j]);i=j;}
 return escape?[{...from},...simple]:simple;
}
function freeSpace(w,a,p){let min=Infinity;for(const b of w.agents){if(b.id===a.id||b.life?.carriedBy)continue;min=Math.min(min,distance(p,b.coordinates));if(b.task?.destination)min=Math.min(min,distance(p,b.task.destination));}return min;}
export function chooseDestination(w,a,target,selected={}){
 const id=selected.id||'',center=coordForPosition(target,w),points=[],m=motionState(a);
 if(selected.job?.destination)return {...selected.job.destination};
 if(id==='explore')return explorationDestination(w,a)||{...a.coordinates};
 // Eating carried food is local; there is no artificial trip back to camp.
 if(/^eat_/.test(id)&&a.inventory[id==='eat_berries'?'berries':id==='eat_tuber'?'tubers':'cookedMeat']>0)return {...a.coordinates};
 const banks=id==='drink'?waterBankPoints(w,a.coordinates):null;
 for(let i=0;i<(banks?.length||28);i++){
  let p;
  if(banks)p=banks[i];
  else if(target==='camp'&&w.structures.shelter&&['rest','seek_cover'].includes(id))p=shelterPoint((random(a)-.5)*.95,(random(a)-.5)*2.3);
  else if(target==='camp'&&['seek_warmth','make_fire','dry_wood_by_fire'].includes(id)){const angle=random(a)*Math.PI*2,r=1.8+random(a)*.5;p={x:CAMP.fire.x+Math.cos(angle)*r,y:CAMP.fire.y+Math.sin(angle)*r};}
  else if(['talk','seek_other','share_food'].includes(id)){const b=w.agents.find(b=>b.id!==a.id),angle=random(a)*Math.PI*2,r=1.45+random(a)*.2;p={x:(b?.coordinates.x||center.x)+Math.cos(angle)*r,y:(b?.coordinates.y||center.y)+Math.sin(angle)*r};}
  else {const angle=random(a)*Math.PI*2,r=(target==='creek'?1.5:target==='camp'?3:2.4)*Math.sqrt(random(a));p={x:center.x+Math.cos(angle)*r,y:center.y+Math.sin(angle)*r};}
  if(!liveWalkable(w,p)||(banks&&!withinWaterReach(w,p)))continue;const space=freeSpace(w,a,p),previous=(m.arrivals||[]).slice(-3).reduce((s,q)=>s+Math.max(0,1.5-distance(q,p)),0);
  points.push({p,score:Math.min(3,space)*1.4-distance(a.coordinates,p)*.07-previous*.6+random(a)*.35,space});
 }
 points.sort((a,b)=>b.score-a.score);
 for(const {p,space}of points)if(space>=ARRIVAL_SPACE&&liveRoute(w,a.coordinates,p,a))return p;
 for(const {p,space}of points)if(space>=BODY_DISTANCE+.1&&liveRoute(w,a.coordinates,p,a))return p;
 // Hold safely if an interaction area is full; collision checks still apply.
 return liveWalkable(w,a.coordinates)?{...a.coordinates}:points[0]?.p||center;
}
export function configureTask(w,a,{force=false}={}){
 const t=a.task;if(!t||(!force&&t.liveSpaceVersion===1&&(t.actionId!=='drink'||t.liveWaterVersion===1)))return;
 t.destination=chooseDestination(w,a,t.targetPosition,{...t.selected,id:t.actionId});t.path=liveRoute(w,a.coordinates,t.destination,a)||[];t.pathIndex=1;t.liveSpaceVersion=1;
 t.phase=distance(a.coordinates,t.destination)>.15?'travel':'work';t.egressing=!liveWalkable(w,a.coordinates);t.liveTrace=[{...a.coordinates}];
 if(t.actionId==='drink')t.liveWaterVersion=1;
}
export const explorationCell=p=>`${Math.floor(p.x/4)},${Math.floor(p.y/4)}`;
export function explorationDestination(w,a){
 const memory=a.liveExploration??={cells:{},observations:{}},options=[],offset=random(a)*Math.PI*2;
 for(let i=0;i<24;i++){const angle=offset+i*Math.PI/12,r=9+random(a)*7,p={x:a.coordinates.x+Math.cos(angle)*r,y:a.coordinates.y+Math.sin(angle)*r};
  if(!liveWalkable(w,p)||freeSpace(w,a,p)<ARRIVAL_SPACE)continue;
  const visits=memory.cells[explorationCell(p)]||0,previous=(motionState(a).arrivals||[]).reduce((n,q)=>n+Math.max(0,8-distance(q,p)),0);
  options.push({p,score:10/(1+visits)-previous+random(a)*2});
 }
 options.sort((a,b)=>b.score-a.score);for(const {p}of options)if(liveRoute(w,a.coordinates,p,a))return p;return null;
}
function bodyClear(w,a,from,to){for(const b of w.agents)if(b.id!==a.id&&!b.life?.carriedBy&&segmentDistance(b.coordinates,from,to)<BODY_DISTANCE-1e-6)return false;return true;}
export function advanceLiveRoute(w,a,t,seconds){
 const m=motionState(a);if(!t.path?.length){m.speed=0;return {blocked:true};}
 while(t.pathIndex<t.path.length&&distance(a.coordinates,t.path[t.pathIndex])<.16)t.pathIndex++;
 if(t.pathIndex>=t.path.length){m.vx=m.vy=m.speed=0;return {arrived:true};}
 const p=a.coordinates,next=t.path[t.pathIndex],remaining=distance(p,next),heading=Math.atan2(next.x-p.x,next.y-p.y);
 if(t.progressIndex!==t.pathIndex||remaining<(t.progressDistance??Infinity)-.04){t.progressIndex=t.pathIndex;t.progressDistance=remaining;m.stalledSeconds=0;}else m.stalledSeconds=(m.stalledSeconds||0)+seconds;
 if(m.stalledSeconds>3){const path=liveRoute(w,p,t.destination,a);if(path){t.path=path;t.pathIndex=1;t.progressIndex=null;t.detours=(t.detours||0)+1;}else t.blockedSeconds=(t.blockedSeconds||0)+3;
  m.stalledSeconds=0;m.vx=m.vy=m.speed=0;if(t.blockedSeconds>90)return {blocked:true};return {waiting:true};}
 const pace=.92+(hash(a.id)%160)/1000,maxSpeed=walkingSpeed(w,a)/(w.worldModel.bounds.metersPerUnit||2)*pace*crossingPace(w,a)*(a.life?.stage==='toddler'?.6:a.life?.stage==='child'?.8:a.life?.stage==='elder'?.85:1);
 const end=t.pathIndex===t.path.length-1,speed=Math.min(maxSpeed,(m.speed||0)+seconds*1.3,end?Math.max(.10,remaining*1.3):maxSpeed),length=Math.min(remaining,speed*seconds);
 let best=null;
 for(const offset of [0,.3,-.3,.65,-.65,1,-1,1.4,-1.4,1.7,-1.7,2,-2]){
  const angle=heading+offset,turn=angleDiff(angle,m.facing),steered=m.speed>.02&&!t.egressing?m.facing+clamp(turn,-seconds*2.5,seconds*2.5):angle;
  const q={x:p.x+Math.sin(steered)*length,y:p.y+Math.cos(steered)*length};
  if(!(t.egressing&&!liveWalkable(w,p))&&!liveClear(w,p,q,a))continue;
  if(!bodyClear(w,a,p,q))continue;
  // Do not walk backwards down the same narrow passage to keep an animation
  // running. Wait, then route around the actual blocking body/obstacle.
  if(!t.egressing&&distance(q,next)>remaining+.005)continue;
  let cost=distance(q,next)*7+Math.abs(offset)*.11+Math.abs(angleDiff(steered,m.facing))*.10;
  for(const b of w.agents){if(b.id===a.id||b.life?.carriedBy)continue;const bm=motionState(b),future={x:b.coordinates.x+bm.vx*.8,y:b.coordinates.y+bm.vy*.8},selfFuture={x:q.x+Math.sin(steered)*speed*.8,y:q.y+Math.cos(steered)*speed*.8};cost+=Math.max(0,2-distance(selfFuture,future))*2.2;}
  // Keep-right preference resolves symmetric encounters without random jitter.
  if(offset<0)cost+=.015;
  if(!best||cost<best.cost)best={q,steered,cost};
 }
 if(!best){noteCargoLimits(w,a);m.vx=m.vy=m.speed=0;m.waitSeconds=(m.waitSeconds||0)+seconds;
  return {waiting:true};
 }
 a.coordinates=best.q;m.vx=(best.q.x-p.x)/seconds;m.vy=(best.q.y-p.y)/seconds;m.speed=Math.hypot(m.vx,m.vy);m.facing=best.steered;m.waitSeconds=0;if(liveWalkable(w,a.coordinates))t.egressing=false;
 recordCrossingWear(w,a,p,a.coordinates);recordFootstep(w,a,p,a.coordinates);
 if(end&&distance(a.coordinates,t.destination)<.16){m.arrivals=[...(m.arrivals||[]),{...a.coordinates}].slice(-5);return {arrived:true};}
 return {arrived:false};
}
export function separateBodies(w,seconds){
 for(let i=0;i<w.agents.length;i++)for(let j=i+1;j<w.agents.length;j++){
  const a=w.agents[i],b=w.agents[j];if(a.life?.carriedBy||b.life?.carriedBy)continue;const d=distance(a.coordinates,b.coordinates);if(d>=BODY_DISTANCE)continue;
  const angle=d>.001?Math.atan2(b.coordinates.x-a.coordinates.x,b.coordinates.y-a.coordinates.y):(hash(a.id+b.id)%628)/100;
  const amount=Math.min((BODY_DISTANCE-d)/2+.005,seconds*.65);
  for(const [person,sign]of [[a,-1],[b,1]]){const old=person.coordinates,p={x:old.x+Math.sin(angle)*amount*sign,y:old.y+Math.cos(angle)*amount*sign};
   if(liveClear(w,old,p,person)||!liveWalkable(w,old)){person.coordinates=p;const m=motionState(person);m.vx=(p.x-old.x)/seconds;m.vy=(p.y-old.y)/seconds;m.speed=Math.hypot(m.vx,m.vy);m.facing=Math.atan2(m.vx,m.vy);recordFootstep(w,person,old,p);}
  }
 }
}
export function faceInteraction(w,a,seconds){const m=motionState(a);m.vx=m.vy=m.speed=0;let target;
 if(a.task?.selected?.job?.childId)target=w.agents.find(b=>b.id===a.task.selected.job.childId)?.coordinates;
 else if(a.task?.selected?.job?.partnerId)target=w.agents.find(b=>b.id===a.task.selected.job.partnerId)?.coordinates;
 else if(a.task?.selected?.job){const j=a.task.selected.job,p=w.settlement?.projects.find(p=>p.id===j.projectId),part=p?.parts.find(x=>x.id===j.partId);target=part?{x:p.position.x+part.center[0],y:p.position.y+part.center[2]}:j.position;}
 else if(['talk','share_food','seek_other'].includes(a.task?.actionId))target=w.agents.find(b=>b.id!==a.id)?.coordinates;
 else if(a.position==='camp')target=CAMP.fire;
 else if(a.task?.actionId==='drink')target=nearestWater(w,a.coordinates)?.point;
 else if(a.task)target=coordForPosition(a.task.targetPosition,w);
 if(target&&distance(a.coordinates,target)>.2)m.facing+=clamp(angleDiff(Math.atan2(target.x-a.coordinates.x,target.y-a.coordinates.y),m.facing),-seconds,seconds);
}
export function recordFootstep(w,a,from,to){
 const m=motionState(a);m.lastFootprint??={...from};if(distance(m.lastFootprint,to)<.45)return;m.lastFootprint={...to};
 const key=`${Math.round(to.x*2)},${Math.round(to.y*2)}`,ground=w.liveGround??={cells:{},sequence:0},old=ground.cells[key];if(m.lastGroundCell===key)return;m.lastGroundCell=key;
 ground.cells[key]={x:Math.round(to.x*2)/2,y:Math.round(to.y*2)/2,uses:(old?.uses||0)+1,sequence:++ground.sequence};
 if(Object.keys(ground.cells).length>1600){const oldest=Object.entries(ground.cells).sort((a,b)=>a[1].sequence-b[1].sequence).slice(0,200);for(const[k]of oldest)delete ground.cells[k];}
}
