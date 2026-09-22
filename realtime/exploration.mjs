import {remember,addEvent} from '../engine/core.js';
import {coordForPosition} from '../engine/spectator.js';
import {distance} from '../engine/navigation.js';
import {advanceLiveRoute,explorationCell,explorationDestination,liveRoute,liveWalkable,motionState} from './motion.mjs';

export function observeExploration(w,a){
 const memory=a.liveExploration??={cells:{},observations:{}};
 // A discovery requires visiting its real location. No east-then-west script,
 // remote resources, or animal tracks manufactured by task completion.
 for(const [key,zone,label,tags]of [['clayBank','clay','clay-rich creek bank',['clay']],['reedBed','reeds','reed bed beside the creek',['reeds']]]){
  if(memory.observations[key]||distance(a.coordinates,coordForPosition(zone,w))>3)continue;
  memory.observations[key]={day:w.day,hour:w.hour,coordinates:{...a.coordinates}};
  const first=!w.discovered[key];w.discovered[key]=true;w.discovered[zone==='clay'?'east':'west']=true;
  remember(w,a,`I reached the ${label} and observed it nearby.`,{importance:7,tags:['exploration',...tags],confidence:.95});
  if(first)addEvent(w,'world',`Place discovered · ${label}`,`${a.name} observed it while physically exploring this part of the valley.`,{agentId:a.id,coordinates:{...a.coordinates}});
 }
}
function nextLeg(w,a,t){const destination=explorationDestination(w,a);if(!destination)return false;const path=liveRoute(w,a.coordinates,destination);if(!path)return false;Object.assign(t,{destination,path,pathIndex:1,phase:'travel',progressIndex:null,egressing:!liveWalkable(w,a.coordinates)});return true;}
export function advanceExploration(w,a,t,seconds){
 const memory=a.liveExploration??={cells:{},observations:{}};
 if(!t.exploration){
  t.exploration={distance:0,targetDistance:120,cells:{},movingSeconds:0};
  // Preserve the old timer as historical task metadata; it is not evidence of
  // ground covered and must not appear as measured exploration progress.
  t.legacyStationaryMinutes=t.workMinutes||0;t.workMinutes=0;
  t.targetPosition='basin';t.label='Explore the surrounding valley';
  memory.cells[explorationCell(a.coordinates)]??=1;
  if(!nextLeg(w,a,t))return {done:true,success:false,detail:'No traversable route to explore from here.'};
 }
 const e=t.exploration,from={...a.coordinates};a.position='travel';
 if(t.phase!=='travel'&&!nextLeg(w,a,t))return {done:true,success:false,detail:'The next exploration route is blocked.'};
 const movement=advanceLiveRoute(w,a,t,seconds),moved=distance(from,a.coordinates);
 if(moved>.00001){
  const cell=explorationCell(a.coordinates);if(cell!==e.lastCell){memory.cells[cell]=(memory.cells[cell]||0)+1;e.cells[cell]=true;e.lastCell=cell;}
  e.distance+=moved*(w.worldModel.bounds.metersPerUnit||2);e.movingSeconds+=seconds;t.workMinutes=e.movingSeconds/60;observeExploration(w,a);
 }
 t.progress={kind:'exploration',distance:e.distance,targetDistance:e.targetDistance,cells:Object.keys(e.cells).length};
 if(e.distance>=e.targetDistance&&Object.keys(e.cells).length>=6){
  const detail=`${a.name} walked ${Math.round(e.distance)} metres through ${Object.keys(e.cells).length} ground areas while exploring.`;
  remember(w,a,detail,{importance:3,tags:['exploration'],confidence:.98});motionState(a).speed=0;
  return {done:true,success:true,detail};
 }
 if(movement.blocked||(movement.arrived&&!nextLeg(w,a,t)))return {done:true,success:false,detail:'Exploration stopped where the route became impassable.'};
 return {done:false};
}
