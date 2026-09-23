import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createWorld} from '../engine/core.js';
import {candidateActions} from '../engine/decision.js';
import {prepare,step} from './elapsed.mjs';
import {advanceExploration,explorationMotivation} from './exploration.mjs';
import {freeTimeCandidates,advanceFreeTime,beginFreeTime,finishFreeTime,workFreeTime} from './free-time.mjs';
import {liveCandidates} from './behavior.mjs';
import {workSettlement} from './settlement.mjs';
import {clock,makeStore} from './holdings.mjs';
import {faceInteraction} from './motion.mjs';
import {progressRatio,progressText,taskExplanation} from '../web/live/task-view.js';

function fixture(){const w=prepare(createWorld());w.weather='clear';w.temperature=65;for(const [i,a]of w.agents.entries()){a.coordinates={x:66+i*1.8,y:39};a.position='meadow';a.task=null;a.suspendedTasks=[];a.needs={hunger:95,hydration:95,energy:85,warmth:90};a.liveFailures={};a.mind.recentActions=[];}return w;}
function task(a,c){return {id:'test-'+c.id,decisionId:null,actionId:c.id,label:c.label,selected:c,source:'fallback',targetPosition:a.position,origin:{...a.coordinates},destination:{...c.job.destination},path:[{...a.coordinates}],phase:'work',liveSpaceVersion:1,liveTiming:true,workMinutes:0,requiredMinutes:c.job.minutes};}
function familiar(a){a.liveExploration={cells:{},observations:{clayBank:{},reedBed:{}},trips:[]};for(let x=0;x<26;x++)for(let y=0;y<26;y++)a.liveExploration.cells[`${x},${y}`]=3;}
// Reproduce Ivo's loop with actual walking through previously visited ground.
const w=fixture(),a=w.agents[0];w.agents=[a];familiar(a);for(const n of w.resourceSites.nodes)n.knownBy=[a.id];
for(let trip=0;trip<2;trip++){
 const t={actionId:'explore',label:'explore',phase:'work',workMinutes:0};let result;
 for(let i=0;i<1800;i++){result=advanceExploration(w,a,t,.6);if(result.done)break;}
 assert(result?.success);assert(t.progress.distance>=120);assert.equal(t.progress.newCells,0);assert.equal(t.progress.discoveries,0);
}
assert(!explorationMotivation(w,a).allowed,'fruitless repeat searches stop being offered');
assert(!liveCandidates(w,a,candidateActions(w,a)).some(c=>c.id==='explore'));
const reload=prepare(JSON.parse(JSON.stringify(w)));assert.deepEqual(reload.agents[0].liveExploration,a.liveExploration);
assert(!explorationMotivation(reload,reload.agents[0]).allowed,'restart does not reset exploration fatigue');
w.weather='rain';assert(explorationMotivation(w,a).allowed,'changed conditions permit a recheck');w.weather='clear';
a.liveExploration.trips.push({at:clock(w),newCells:8,discoveries:1,weather:w.weather});assert(explorationMotivation(w,a).allowed,'a genuinely productive search changes the remembered expectation');

// Selecting practice gives no materials or experience; actual work consumes
// finite inputs and survives a checkpoint halfway through the attempt.
let p=fixture(),pa=p.agents[0];p.agents=[pa];p.resources.reeds-=3;pa.inventory.reeds=3;
const before=JSON.stringify(pa.inventory),c=freeTimeCandidates(p,pa).find(c=>c.id==='practice:cordage'&&c.job.practice.item==='cordage');assert(c);
assert.equal(JSON.stringify(pa.inventory),before);assert(!pa.craftPractice?.fiberwork);
pa.task=task(pa,c);beginFreeTime(p,pa,pa.task);assert(!workSettlement(p,pa,pa.task,2).done);assert(!pa.craftPractice?.fiberwork);
p=prepare(JSON.parse(JSON.stringify(p)));pa=p.agents[0];const done=workSettlement(p,pa,pa.task,3);finishFreeTime(p,pa,pa.task,done);
assert(done.done);assert.equal(pa.craftPractice.fiberwork.minutes,5);assert(pa.inventory.reeds<3);assert(pa.freeTime.cooldowns.practice>clock(p));
assert(!freeTimeCandidates(p,pa).some(c=>c.job.practice),'practice satisfaction prevents back-to-back attempts');
pa.freeTime.cooldowns.practice=0;makeStore(p,{ownerId:pa.id,position:pa.coordinates,items:{cordage:4,woodPole:2,sharpStone:1,boundSharpTool:1}});
assert(!freeTimeCandidates(p,pa).some(c=>c.job.practice&&c.job.kind!=='practice_technique'),'owned finished goods also cap redundant practice production');

// Both people must be available, within reach, and stay there. A game is one
// shared session; a restart cannot reroll completed rounds or award twice.
let g=fixture(),[ga,gb]=g.agents;assert.equal(progressRatio({task:{actionId:'reconsider',workMinutes:1,requiredMinutes:2}}),0,'idle waiting is not displayed as completed work');
gb.task={id:'idle-pause',label:'Reconsider',actionId:'reconsider',selected:{job:{kind:'reconsider'}}};const game=freeTimeCandidates(g,ga).find(c=>c.job.kind==='hand_game');assert(game);
ga.coordinates={...game.job.destination};ga.task=task(ga,game);let gameResult=workFreeTime(g,ga,ga.task,2);assert(!gameResult.done);assert.equal(ga.task.progress.rounds,1);
const initialRound=structuredClone(ga.task.social.rounds[0]),company=gb.freeTime.company;workFreeTime(g,gb,gb.task,2);assert.equal(ga.task.progress.rounds,1,'guest never advances the shared clock');assert.equal(gb.freeTime.company,company);
g=prepare(JSON.parse(JSON.stringify(g)));[ga,gb]=g.agents;assert.deepEqual(ga.task.social.rounds[0],initialRound);
for(const person of [ga,gb]){for(let i=0;i<10;i++)faceInteraction(g,person,.6);const peer=person===ga?gb:ga,target=Math.atan2(peer.coordinates.x-person.coordinates.x,peer.coordinates.y-person.coordinates.y);assert(Math.abs(Math.atan2(Math.sin(person.locomotion.facing-target),Math.cos(person.locomotion.facing-target)))<.001,'social partners turn to face each other');}
await fs.mkdir('realtime-qa',{recursive:true});await fs.writeFile('realtime-qa/free-time-fixture.json',JSON.stringify(g));
for(let i=0;i<4;i++)gameResult=workFreeTime(g,ga,ga.task,2);
assert(gameResult.success);assert.equal(ga.task.social.rounds.length,5);assert(ga.task.social.scores.reduce((x,y)=>x+y,0)<=5);
for(const r of ga.task.social.rounds){const [x,y]=r.signs;assert.equal(r.winner,x===y?null:({stone:'shears',shears:'reed',reed:'stone'}[x]===y?ga.id:gb.id));}
assert(gb.freeTime.company>company);assert.equal(workFreeTime(g,gb,gb.task,1).detail,gameResult.detail);assert(gb.freeTime.cooldowns.social>clock(g));
assert(progressText({task:ga.task}).includes('5 / 5'));assert(taskExplanation({task:{...ga.task,job:ga.task.selected.job,reason:ga.task.selected.job.reason}}).text.includes('stone beats shears'));
const interrupted=fixture(),[ia,ib]=interrupted.agents,invite=freeTimeCandidates(interrupted,ia).find(c=>c.job.kind==='hand_game');ia.coordinates={...invite.job.destination};ia.task=task(ia,invite);workFreeTime(interrupted,ia,ia.task,2);const fun=ia.freeTime.enjoyment;ib.coordinates.x+=8;assert.equal(workFreeTime(interrupted,ia,ia.task,8).success,false);assert.equal(ia.freeTime.enjoyment,fun,'departure cannot grant finished-game enjoyment');
const busy=fixture(),[ba,bb]=busy.agents;bb.task={actionId:'drink'};assert(!freeTimeCandidates(busy,ba).some(c=>c.job.partnerId===bb.id),'productive/necessary work is not hijacked');bb.task=null;bb.needs.hydration=9;assert(!freeTimeCandidates(busy,ba).some(c=>c.job.partnerId===bb.id),'urgent needs prevent participation');
const urgent=fixture(),ua=urgent.agents[0];ua.task=task(ua,{id:'leisure:relax',label:'Old quiet break',job:{kind:'relax',minutes:20,destination:{...ua.coordinates}}});ua.needs.hydration=9;await step(urgent,.6);assert.equal(ua.task.actionId,'drink','urgent survival interrupts leisure');

// End-to-end rules choose varied useful activity in a fully familiar valley.
const life=fixture(),counts={},ids=life.agents.map(a=>a.id);for(const person of life.agents){familiar(person);person.liveExploration.trips=[{at:clock(life),newCells:0,discoveries:0,weather:life.weather},{at:clock(life),newCells:0,discoveries:0,weather:life.weather}];person.freeTime.enjoyment=15;person.freeTime.company=35;person.freeTime.mastery=40;advanceFreeTime(life,person,.6);}
let last={};for(let i=0;i<3600;i++){await step(life,6);for(const person of life.agents)if(person.task?.id&&person.task.id!==last[person.id]){last[person.id]=person.task.id;const kind=person.task.selected?.job?.kind||person.task.actionId;counts[kind]=(counts[kind]||0)+1;}}
assert.deepEqual(life.agents.map(a=>a.id),ids);assert(counts.hand_game||counts.conversation,'social leisure occurs autonomously');assert(counts.craft,'skill practice occurs autonomously');assert(counts.drink,'survival remains active');assert((counts.explore||0)<8,JSON.stringify(counts));
console.log(JSON.stringify({result:'PASS remembered exploration yield; finite earned practice; mutual social availability; five persisted game rounds; interruption; replay safety; six-hour autonomous balance',actions:counts}));
