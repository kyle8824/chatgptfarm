import {homeFor} from '../shared/frontier.js';
import {remember,addEvent} from '../engine/core.js';
import {coordForPosition} from '../engine/spectator.js';
import {distance} from '../engine/navigation.js';
import {advanceLiveRoute,explorationCell,explorationDestination,liveRoute,liveWalkable,motionState} from './motion.mjs';
import {clock} from './holdings.mjs';
import {coldRecovery} from './thermal-return.mjs';

const discoveries=(w,a)=>Object.keys(a.liveExploration?.observations||{}).length+(w.resourceSites?.nodes||[]).filter(n=>n.knownBy?.includes(a.id)).length;
export function explorationMotivation(w,a){
 if(coldRecovery(a))return {allowed:false,penalty:0,reason:'Recover warmth before optional exploration.',lastTrip:a.liveExploration?.trips?.at(-1)||null};
 const trips=a.liveExploration?.trips||[],last=trips.at(-1),age=last?clock(w)-last.at:Infinity;
 // Only remembered outcomes influence this judgment; there is no omniscient
 // percentage of the map/resources that remain undiscovered.
 const recent=trips.filter(t=>clock(w)-t.at<360);let empty=0;for(const t of [...recent].reverse()){if(t.newCells>=3||t.discoveries)break;empty++;}
 const changed=last&&last.weather!==w.weather;
 const discouraged=empty>=2&&age<180&&!changed;
 return {allowed:!discouraged,penalty:recent.reduce((n,t)=>n+(t.discoveries?0:t.newCells<3?18:t.newCells<8?8:3),0)*(changed?.35:1),reason:discouraged?'Recent searches covered familiar ground without finding anything new.':changed?'The weather has changed since the last search.':last?'Look for ground that earlier trips did not cover.':'Learn what lies nearby.',lastTrip:last||null};
}

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
function nextLeg(w,a,t){const destination=explorationDestination(w,a);if(!destination)return false;const path=liveRoute(w,a.coordinates,destination,a);if(!path)return false;Object.assign(t,{destination,path,pathIndex:1,phase:'travel',progressIndex:null,egressing:!liveWalkable(w,a.coordinates)});return true;}
export function advanceExploration(w,a,t,seconds){
 const memory=a.liveExploration??={cells:{},observations:{}};
 if(!t.exploration){
  const provisioned=w.frontier&&(a.inventory.berries||0)+(a.inventory.cookedMeat||0)+(a.inventory.tubers||0)>=3&&a.inventory.firedVessel>0&&a.needs.energy>75;
  t.exploration={distance:0,targetDistance:provisioned?480:120,cells:{},movingSeconds:0,newCells:0,discoveryStart:discoveries(w,a)};
  // Preserve the old timer as historical task metadata; it is not evidence of
  // ground covered and must not appear as measured exploration progress.
  t.legacyStationaryMinutes=t.workMinutes||0;t.workMinutes=0;
  t.targetPosition='basin';t.label=provisioned?'Explore beyond familiar ground with provisions':'Explore the surrounding valley';
  memory.cells[explorationCell(a.coordinates)]??=1;
  if(!nextLeg(w,a,t))return {done:true,success:false,detail:'No traversable route to explore from here.'};
 }
 const e=t.exploration,from={...a.coordinates};a.position='travel';
 e.newCells??=0;e.discoveryStart??=discoveries(w,a);
 if(t.phase!=='travel'&&!nextLeg(w,a,t))return {done:true,success:false,detail:'The next exploration route is blocked.'};
 const movement=advanceLiveRoute(w,a,t,seconds),moved=distance(from,a.coordinates);
 if(moved>.00001){
  const cell=explorationCell(a.coordinates);if(cell!==e.lastCell){if(!memory.cells[cell])e.newCells++;memory.cells[cell]=(memory.cells[cell]||0)+1;e.cells[cell]=true;e.lastCell=cell;}
  e.distance+=moved*(w.worldModel.bounds.metersPerUnit||2);e.movingSeconds+=seconds;t.workMinutes=e.movingSeconds/60;observeExploration(w,a);
 }
 t.progress={kind:'exploration',distance:e.distance,targetDistance:e.targetDistance,cells:Object.keys(e.cells).length,newCells:e.newCells,discoveries:Math.max(0,discoveries(w,a)-e.discoveryStart)};
 if(e.distance>=e.targetDistance&&Object.keys(e.cells).length>=6){
  const found=t.progress.discoveries;
  const detail=`${a.name} walked ${Math.round(e.distance)} metres: ${e.newCells} unfamiliar ground areas and ${found} newly observed resource locations.${e.newCells<3&&!found?' This search mostly retraced familiar ground; there is little reason to repeat it soon.':''}`;
  memory.trips=[...(memory.trips||[]),{at:clock(w),newCells:e.newCells,discoveries:found,weather:w.weather}].slice(-8);
  remember(w,a,detail,{importance:3,tags:['exploration'],confidence:.98});motionState(a).speed=0;
  return {done:true,success:true,detail};
 }
 if(movement.blocked||(movement.arrived&&!nextLeg(w,a,t)))return {done:true,success:false,detail:'Exploration stopped where the route became impassable.'};
 return {done:false};
}
