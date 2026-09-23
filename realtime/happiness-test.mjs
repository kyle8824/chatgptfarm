import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createWorld} from '../engine/core.js';
import {candidateActions} from '../engine/decision.js';
import {householdWorld} from '../shared/frontier.js';
import {prepare,step} from './elapsed.mjs';
import {expandFrontier} from './frontier.mjs';
import {reorganizeLandscape} from './landscape-migration.mjs';
import {ensureHappiness,happinessContext,interestBonus,recordEnjoyedWork,advanceHappiness} from './happiness.mjs';
import {liveCandidates,retireObsoleteTask} from './behavior.mjs';
import {freeTimeCandidates,workFreeTime,leisureReady,ensureFreeTime} from './free-time.mjs';
import {returnCandidate} from './thermal-return.mjs';
import {happinessMarkup} from '../web/live/happiness-view.js';

let w=prepare(createWorld());expandFrontier(w);reorganizeLandscape(w);
for(const a of w.agents)ensureHappiness(a);
assert.equal(new Set(w.agents.map(a=>JSON.stringify(a.happiness.preferences))).size,8,'people have stable individual profiles');
const a=w.agents[0],initial=JSON.stringify(w);happinessContext(a);assert.equal(JSON.stringify(w),initial,'inspection is read-only');
const restored=prepare(JSON.parse(initial));assert.deepEqual(restored.agents.map(a=>a.happiness),w.agents.map(a=>a.happiness));
const game={id:'play',job:{kind:'hand_game'}},building={id:'build',job:{kind:'assemble'}};
a.happiness.preferences.games=95;a.happiness.preferences.building=20;
assert(interestBonus(a,game)>interestBonus(a,building));
a.happiness.satisfaction.games=95;assert(interestBonus(a,game)<interestBonus(a,building),'a satisfied favorite yields to variety');
const prior=a.happiness.satisfaction.games;advanceHappiness(a,3600);assert(a.happiness.satisfaction.games<prior);

// Real work alone earns activity minutes. Reading/selecting, waiting and a
// checkpoint replay cannot award the same work again.
a.happiness.satisfaction.games=0;const t={actionId:'play',selected:game,workMinutes:0,happinessWork:0};
const before=a.happiness.value;recordEnjoyedWork(w,a,t);assert.equal(a.happiness.value,before);
t.workMinutes=5;recordEnjoyedWork(w,a,t);assert(a.happiness.value>before);assert.equal(a.happiness.activityMinutes.games,5);
const persisted=JSON.parse(JSON.stringify({a,t}));recordEnjoyedWork(w,persisted.a,persisted.t);assert.deepEqual(persisted.a.happiness,a.happiness);
const quiet={selected:{job:{kind:'relax'}},workMinutes:10,happinessWork:0};a.restSupport={score:10};const unhappy=a.happiness.value;recordEnjoyedWork(w,a,quiet);assert.equal(a.happiness.value,unhappy,'uncomfortable idle rest does not manufacture happiness');
assert.match(happinessMarkup({...a,name:'<script>',happiness:happinessContext(a)}),/&lt;script&gt;/);assert(!happinessMarkup({...a,name:'<script>',happiness:happinessContext(a)}).includes('<script>'));
assert.equal((happinessMarkup({...a,happiness:happinessContext(a)}).match(/role="meter"/g)||[]).length,9);
assert.match(happinessMarkup({...a,happiness:happinessContext(a)}),/Activity not yet available/);

// Both people may join a real shared game while cold but protected. Fully
// rested guests are available; tired people and exposed cold destinations are not.
w=prepare(createWorld());expandFrontier(w);reorganizeLandscape(w);w.agents=w.agents.slice(0,2);
w.structures.shelter=true;w.structures.fire=false;w.wood.legacyFireUntil=null;w.weather='rain';w.temperature=40;
for(const [i,p] of w.agents.entries()){
 p.coordinates={x:66,y:33.6+i*1.8};p.position='camp';p.needs={hunger:95,hydration:95,energy:100,warmth:0};p.task=null;p.suspendedTasks=[];p.freeTime.company=0;p.freeTime.enjoyment=0;
}
const [host,guest]=w.agents,view=householdWorld(w,host);assert(leisureReady(view,host));assert(!leisureReady(view,host,{x:80,y:50}));
guest.task={id:'old-rest',actionId:'rest',workMinutes:15,requiredMinutes:60};
const invite=freeTimeCandidates(view,host).find(c=>c.job.kind==='hand_game');assert(invite,'a sheltered, rested guest can be invited');
host.coordinates={...invite.job.destination};host.task={id:'game',actionId:invite.id,selected:invite,workMinutes:0,requiredMinutes:10};
for(let i=0;i<5;i++)assert.notEqual(workFreeTime(view,host,host.task,2).success,false);
assert.equal(host.task.social.rounds.length,5);assert(host.freeTime.company>0&&guest.freeTime.company>0);assert.equal(host.needs.warmth,0);
guest.needs.energy=10;assert(!freeTimeCandidates(view,guest).length,'urgent rest defeats recreation');
host.task={id:'old-full-rest',actionId:'rest',label:'Rest',workMinutes:10};retireObsoleteTask(view,host);assert.equal(host.task,null);
host.needs.hunger=3;host.inventory.berries=2;await step(w,6);assert.equal(host.task.actionId,'eat_berries','hunger overrides personal interests');

// Productive short trips must not be interrupted every time they cross the
// camp boundary. Long expeditions still trigger the physical return policy.
host.needs={hunger:95,hydration:95,energy:95,warmth:0};host.coordinates={x:85,y:34};host.task={actionId:'supply:test',selected:{job:{kind:'gather',projectId:'test',destination:{x:90,y:34}}}};
assert.equal(returnCandidate(view,host),null);host.task.selected.job.destination={x:140,y:34};assert(returnCandidate(view,host));

// All eight observed fully-rested people leave energy-rest and carry out
// useful work. Finite carried reeds are transferred from their local stock;
// this is an isolated fixture and makes no production inventory changes.
w=prepare(createWorld());expandFrontier(w);reorganizeLandscape(w);w.weather='rain';w.temperature=40;w.liveWeatherUntil=w.day*24+w.hour+6;
w.structures.shelter=true;w.structures.fire=false;w.wood.legacyFireUntil=null;
for(const b of w.wood.batches)if(b.form==='branch')b.waterKg=b.dryKg*.55;
for(const [i,p] of w.agents.entries()){
 const h=w.frontier.homes.find(h=>h.id===p.householdId);p.coordinates=i<2?{x:66,y:33.6+i*1.8}:{x:h.x+(i%2?2:-2),y:h.y};p.position='camp';p.needs={hunger:95,hydration:95,energy:100,warmth:0};
 p.suspendedTasks=[];p.task={id:'stale:'+p.id,actionId:'rest',label:'Rest',phase:'work',workMinutes:15,requiredMinutes:60};
 ensureFreeTime(p);p.freeTime.enjoyment=0;p.freeTime.company=0;p.freeTime.mastery=0;ensureHappiness(p);p.happiness.preferences.learning=90;
 const v=householdWorld(w,p);v.resources.reeds-=3;p.inventory.reeds=3;
}
const activities=Object.fromEntries(w.agents.map(p=>[p.id,new Set()]));
for(let i=0;i<200;i++){
 await step(w,6);for(const p of w.agents){if(p.task)activities[p.id].add(p.task.selected?.job?.kind||p.task.actionId);assert(!(p.needs.energy>90&&p.task?.actionId==='rest'));}
 if(i===100)w=prepare(JSON.parse(JSON.stringify(w)));
}
for(const p of w.agents){assert(activities[p.id].has('craft'),p.id+' must perform useful practice');assert(p.craftPractice?.fiberwork?.minutes>0);assert(p.happiness.activityMinutes.learning>0);assert(p.needs.warmth<1,'no invented warmth');}
await fs.mkdir('realtime-qa',{recursive:true});await fs.writeFile('realtime-qa/happiness-person.json',JSON.stringify({...w.agents[0],happiness:happinessContext(w.agents[0])}));
console.log(JSON.stringify({result:'PASS individual persistent likes; repeat saturation; actual-work rewards; restart idempotence; cold sheltered games; satisfied rest ends; urgent food wins; bounded supply trips; all eight practice',activities:Object.fromEntries(Object.entries(activities).map(([id,s])=>[id,[...s]]))}));
