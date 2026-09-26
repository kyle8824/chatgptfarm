import {distance} from '../engine/navigation.js';
import {coordForPosition} from '../engine/spectator.js';
import {liveWalkable,motionState} from './motion.mjs';
import {waterBankPoints,withinWaterReach} from './water.mjs';
import {beginReturnRoute,advanceReturnRoute} from './return-route.mjs';

export const routedSurvival=t=>t.actionId==='drink'||/^(forage:|survey:)/.test(t.actionId);
export function survivalReach(w,t,p){return t.actionId==='drink'?withinWaterReach(w,p):distance(p,coordForPosition(t.targetPosition,w))<=5.5;}
export function beginSurvivalRoute(w,a,t){
 const center=coordForPosition(t.targetPosition,w),points=t.actionId==='drink'?waterBankPoints(w,a.coordinates):[center];
 if(t.actionId!=='drink')for(const radius of [1,2,4])for(let i=0;i<8;i++)points.push({x:center.x+Math.cos(i*Math.PI/4)*radius,y:center.y+Math.sin(i*Math.PI/4)*radius});
 const goal=points.filter(p=>liveWalkable(w,p,a)&&survivalReach(w,t,p)).sort((p,q)=>distance(a.coordinates,p)-distance(a.coordinates,q))[0];
 t.survivalJourney=goal?{search:beginReturnRoute(a.coordinates,goal,{arrivalRadius:3.75,precise:true})}:{blocked:true};
 t.phase='planning';t.path=[{...a.coordinates}];t.destination={...a.coordinates};
}
export function advanceSurvivalRoute(w,a,t){
 const m=motionState(a);m.vx=m.vy=m.speed=0;
 const journey=t.survivalJourney;
 if(journey.blocked)return {blocked:true};
 const result=advanceReturnRoute(w,a,journey.search,{maxExpansions:8});
 t.progress={kind:'survival_route',stage:'planning',expanded:journey.search.expanded};
 if(result.path){
  t.path=result.path;t.pathIndex=1;t.destination={...result.path.at(-1)};t.phase='travel';t.progressIndex=null;
  delete t.survivalJourney;delete t.progress;delete t.routeProgress;
 }
 return result;
}
