import assert from 'node:assert/strict';
import {createWorld} from '../engine/core.js';
import {prepare,step} from './elapsed.mjs';
import {expandFrontier} from './frontier.mjs';
import {reorganizeLandscape} from './landscape-migration.mjs';
import {distance} from '../engine/navigation.js';
import {householdWorld} from '../shared/frontier.js';
import {configureTask,liveRoute} from './motion.mjs';
import {resumeLiveTask,liveCandidates} from './behavior.mjs';
import {candidateActions} from '../engine/decision.js';
import {syncHoldings} from './holdings.mjs';

// Public live positions and the observed old rest destinations reproduce the
// rest/return loop. This is an isolated fixture, never a production state edit.
let w=prepare(createWorld());expandFrontier(w);reorganizeLandscape(w);
w.weather='rain';w.temperature=40;w.liveWeatherUntil=w.day*24+w.hour+6;
w.structures.shelter=true;w.structures.fire=false;w.wood.legacyFireUntil=null;
for(const b of w.wood.batches)if(b.form==='branch')b.waterKg=b.dryKg*.55;
syncHoldings(w);
const positions={
 'agent-mara':{x:65.84503576606588,y:34.87512036459613},
 'agent-ivo':{x:54.35399305359714,y:28.237951199697566},
 'agent-tessa':{x:-322.7028959388921,y:49.66653749619906},
 'agent-oren':{x:-316.70454077253686,y:-337.8365995756132},
 'agent-nia':{x:46.05976760717664,y:-331.4441735892042},
 'agent-kellan':{x:45.63146629959757,y:-329.602472811185},
 'agent-elin':{x:-333.40772730617397,y:-327.86748959712907},
 'agent-ronan':{x:-338.3849652744477,y:-319.7337671236569},
};
for(const a of w.agents){
 a.coordinates={...positions[a.id]};a.position=a.id==='agent-mara'?'camp':'travel';
 a.needs={hunger:95,hydration:90,energy:15,warmth:0};a.locomotion=null;a.suspendedTasks=[];
 if(a.id==='agent-oren'){a.knownCamps=['ochre-vale'];a.campId='ochre-vale';}
 a.task={id:`old-rest:${a.id}`,actionId:'rest',label:'Rest here on the ground',selected:{id:'rest',label:'Rest here on the ground'},targetPosition:a.id==='agent-ivo'?'creek':'meadow',source:'fallback',origin:{...a.coordinates},destination:{...a.coordinates},path:[{...a.coordinates}],pathIndex:1,phase:a.id==='agent-mara'?'work':'travel',workMinutes:10,requiredMinutes:60,liveSpaceVersion:1};
}
for(const a of w.agents)if(a.id!=='agent-mara')configureTask(householdWorld(w,a),a,{force:true});
// Also keep an already saved, stale Ivo route. Loading new code must repair
// this active task once, not require him to finish another orbit first.
const ivo=w.agents.find(a=>a.id==='agent-ivo');
ivo.task.targetPosition='creek';ivo.task.destination={x:48,y:24};ivo.task.path=liveRoute(householdWorld(w,ivo),ivo.coordinates,ivo.task.destination,ivo)||[];ivo.task.pathIndex=1;ivo.task.phase='travel';delete ivo.task.liveRestVersion;
const track=Object.fromEntries(w.agents.map(a=>[a.id,{walked:0,returns:new Set(),maxRest:10,maxEnergy:15}]));
for(let i=0;i<360;i++){
 const previous=Object.fromEntries(w.agents.map(a=>[a.id,{...a.coordinates}]));await step(w,6);
 for(const a of w.agents){const t=track[a.id];t.walked+=distance(previous[a.id],a.coordinates);t.maxEnergy=Math.max(t.maxEnergy,a.needs.energy);if(a.task?.actionId==='rest')t.maxRest=Math.max(t.maxRest,a.task.workMinutes);if(a.task?.actionId.startsWith('return_warmth:'))t.returns.add(a.task.id);}
 if(i===180)w=prepare(JSON.parse(JSON.stringify(w)));
}
const summary=Object.entries(track).map(([id,t])=>({id,walked:t.walked,returns:t.returns.size,restGain:t.maxRest-10,energyGain:t.maxEnergy-15}));
console.log(JSON.stringify(summary));
for(const t of summary){assert(t.restGain>15,`${t.id} must actually rest instead of orbiting: ${JSON.stringify(t)}`);assert(t.energyGain>5);assert(t.returns<=1,`${t.id} repeatedly returns to the same camp`);assert(t.walked<60,`${t.id} circles instead of settling`);}
assert(w.agents.slice(0,2).every(a=>a.thermalExposure.sheltered),'Mara and Ivo use their real shelter');
// A suspended rest refreshes its location but retains its identity and work.
const person=w.agents.find(a=>a.id==='agent-ivo'),saved=structuredClone(person.task);
saved.targetPosition='creek';saved.destination={x:48,y:24};saved.workMinutes=19;
person.task=null;person.suspendedTasks=[saved];person.needs.energy=11;
assert(resumeLiveTask(householdWorld(w,person),person,'energy'));
assert.equal(person.task.id,saved.id);assert.equal(person.task.workMinutes,19);assert.equal(person.task.targetPosition,'camp');assert(distance(person.task.destination,{x:66,y:35})<2);
// Empty camps and satisfied needs should not replace the return loop with
// another low-value circuit between drinking/eating locations.
const oren=w.agents.find(a=>a.id==='agent-oren');oren.needs={hydration:100,hunger:100,energy:100,warmth:0};
const offers=liveCandidates(householdWorld(w,oren),oren,candidateActions(householdWorld(w,oren),oren));
assert(!offers.some(c=>c.id.startsWith('return_warmth:')));assert(!offers.some(c=>c.score<=0));
console.log('PASS all eight villagers settle and recover energy; old rest destinations and checkpoints cannot restart camp loops');
