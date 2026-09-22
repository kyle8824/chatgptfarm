import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {prepare,step} from './elapsed.mjs';
import {advanceExploration,observeExploration} from './exploration.mjs';
import {chooseDestination,liveRoute,liveWalkable} from './motion.mjs';
import {nearestWater,withinWaterReach,CREEK_POINTS,CREEK_HALF_WIDTH} from './water.mjs';
import {distance} from '../engine/navigation.js';
import {taskExplanation,progressRatio,progressText} from '../web/live/task-view.js';
const seed=JSON.parse(await fs.readFile(new URL('../world/state.json',import.meta.url),'utf8'));
function fixture(action,coordinates={x:68,y:39}){
 const w=prepare(seed),a=w.agents[0];w.agents=w.agents.slice(0,1);w.weather='clear';w.temperature=65;
 a.coordinates={...coordinates};a.position='camp';a.needs={hunger:95,hydration:80,energy:95,warmth:70};a.locomotion=null;a.suspendedTasks=[];
 a.task={id:'test-task',decisionId:'test-decision',actionId:action,label:action,selected:{id:action,label:action},source:'fallback',targetPosition:action==='drink'?'creek':'edge',destination:{...coordinates},origin:{...coordinates},path:[],pathIndex:1,phase:'work',workMinutes:7,requiredMinutes:30,liveSpaceVersion:1};return {w,a,t:a.task};
}
// Reproduce the saved stationary exploration shown in the user's screenshot.
const {w,a,t}=fixture('explore');w.discovered.clayBank=w.discovered.reedBed=w.discovered.east=w.discovered.west=false;
const origin={...a.coordinates};await step(w,.6);assert(distance(origin,a.coordinates)<1,'migration never teleports');assert(t.workMinutes<.02,'old stationary timer cannot count as exploration');
let measured=distance(origin,a.coordinates)*2,cells=new Set(),still=0,completed=false;
for(let i=0;i<1500;i++){
 const from={...a.coordinates},progress=t.progress.distance;await step(w,.6);const moved=distance(from,a.coordinates);measured+=moved*2;
 cells.add(`${Math.floor(a.coordinates.x/4)},${Math.floor(a.coordinates.y/4)}`);
 if(moved<.00001){still++;assert.equal(t.progress.distance,progress,'standing still never fills exploration progress');}
 if(a.task!==t){completed=true;break;}
}
assert(completed,'a traversable expedition completes');assert(measured>=120,'completion requires actual distance');assert(cells.size>=6,'exploration covers different ground areas');assert(Math.abs(measured-t.progress.distance)<.001);assert.equal(t.legacyStationaryMinutes,7);
for(const [key,zone]of [['clayBank',{x:86,y:23}],['reedBed',{x:10,y:22}]])if(w.discovered[key])assert(distance(a.liveExploration.observations[key].coordinates,zone)<=3,'discovery was physically observed');
const blocked=fixture('explore');advanceExploration(blocked.w,blocked.a,blocked.t,.6);
blocked.w.worldModel.objects.push({id:'test-obstruction',position:{...blocked.a.coordinates},geometry:{radiusM:200},physical:{blocksMovement:true}});
const before={distance:blocked.t.progress.distance,work:blocked.t.workMinutes};for(let i=0;i<60;i++)advanceExploration(blocked.w,blocked.a,blocked.t,.6);
assert.equal(blocked.t.progress.distance,before.distance);assert.equal(blocked.t.workMinutes,before.work);
const resumed=structuredClone(blocked);resumed.w.worldModel.objects.pop();resumed.a=resumed.w.agents[0];resumed.t=resumed.a.task;advanceExploration(resumed.w,resumed.a,resumed.t,.6);assert(resumed.t.progress.distance>=before.distance,'checkpointed exploration retains measured progress');
const seeing=fixture('explore');seeing.w.discovered.clayBank=seeing.w.discovered.reedBed=false;observeExploration(seeing.w,seeing.a);assert(!seeing.w.discovered.clayBank&&!seeing.w.discovered.reedBed,'camp cannot discover remote locations');seeing.a.coordinates={x:86,y:22.8};observeExploration(seeing.w,seeing.a);assert(seeing.w.discovered.clayBank&&!seeing.w.discovered.reedBed,'only the place actually reached is discovered');
// Reproduce an old drinking task whose work phase is nowhere near the creek.
const drinking=fixture('drink');drinking.t.requiredMinutes=10;drinking.t.workMinutes=0;
const creek=drinking.w.worldModel.objects.find(o=>o.type==='creek_segment');assert.deepEqual(creek.geometry.points,CREEK_POINTS);assert.equal(creek.geometry.widthM/drinking.w.worldModel.bounds.metersPerUnit/2,CREEK_HALF_WIDTH,'renderer and physical creek width agree');
let gained=false;for(let i=0;i<800;i++){
 const hydration=drinking.a.needs.hydration;await step(drinking.w,.6);
 if(drinking.a.needs.hydration>hydration){gained=true;assert(withinWaterReach(drinking.w,drinking.a.coordinates),'every hydration gain occurs within physical reach');}
 if(drinking.a.task!==drinking.t)break;
}
assert(gained,'the villager reaches the water and drinks');assert(drinking.t.workMinutes>0);
const away=fixture('drink');away.t.liveWaterVersion=1;const hydrated=away.a.needs.hydration;await step(away.w,.6);assert(away.a.needs.hydration<=hydrated,'displacement away from water prevents drinking');assert.equal(away.t.workMinutes,7,'unreachable water gives no work credit');
const sharing=prepare(seed);for(const person of sharing.agents){const p=chooseDestination(sharing,person,'creek',{id:'drink'});assert(liveWalkable(sharing,p));assert(withinWaterReach(sharing,p));assert(liveRoute(sharing,person.coordinates,p));person.task={destination:p};}
assert(distance(sharing.agents[0].task.destination,sharing.agents[1].task.destination)>=1.5,'separate reachable bank spots');
const view={task:{id:'current',actionId:'explore',label:'Explore the surrounding valley',source:'fallback',phase:'travel',progress:{kind:'exploration',distance:30,targetDistance:120,cells:4}},thought:{actionId:'drink',text:'Ivo chooses to drink because hydration is 14.61.'}};
assert(!taskExplanation(view).text.includes('drink'),'an earlier drinking proposal cannot explain exploration');assert.equal(progressRatio(view),.25);assert(progressText(view).includes('30 m'));view.task.source='ai';view.task.decisionSummary='I will scout the ground nearby.';assert.equal(taskExplanation(view).text,view.task.decisionSummary);
console.log(JSON.stringify({result:'PASS physical exploration, stationary/blocked progress, checkpoint continuity, local discoveries, water reach, separate bank access and current-task explanations',walkedMetres:measured,groundAreas:cells.size,stationarySteps:still,drinkBankGap:nearestWater(drinking.w,drinking.a.coordinates).edge}));
