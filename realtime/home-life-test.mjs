import assert from 'node:assert/strict';
import {createWorld,pairKey} from '../engine/core.js';
import {prepare,step} from './elapsed.mjs';
import {expandFrontier} from './frontier.mjs';
import {householdWorld} from '../shared/frontier.js';
import {clock} from './holdings.mjs';
import {buildingSites,designContext} from './blueprints.mjs';
import {homeContext,homeCandidates,homeBonus,residenceOf,relocationChoices,settleHome,advanceHomeReturn,observeResidence} from './home-life.mjs';
import {liveCandidates} from './behavior.mjs';
import {candidateActions} from '../engine/decision.js';
function fixture(){const w=prepare(createWorld());expandFrontier(w);w.weather='clear';w.temperature=65;for(const a of w.agents){a.task=null;a.suspendedTasks=[];a.needs={hunger:95,hydration:95,energy:90,warmth:85};a.liveFailures={};}return w;}
const w=fixture(),a=w.agents[0],b=w.agents[1];
a.life.partnerId=b.id;b.life.partnerId=a.id;Object.assign(w.relationships[pairKey(a.id,b.id)],{trust:100,affinity:100,familiarity:100});
const original=residenceOf(w,a);observeResidence(w,a);a.coordinates={x:140,y:60};a.campId='flint-heights';
assert.equal(residenceOf(w,a).campId,'willow-basin','a visit never silently changes home');
b.coordinates={x:430,y:430};a.knownPeople[b.id]={lastSeenAt:clock(w),coordinates:{x:66,y:34}};
const context=homeContext(w,a);assert.deepEqual(context.companions[0].position,{x:66,y:34},'partner location uses memory, not remote live tracking');
const reloaded=prepare(JSON.parse(JSON.stringify(w)));assert.deepEqual(residenceOf(reloaded,reloaded.agents[0]).position,original.position);
assert(homeCandidates(w,a).some(c=>c.id==='return_home'));
assert(homeBonus(w,a,{id:'explore'})<0,'a long wandering trip has a reason to come back');
a.needs.hydration=3;assert.equal(homeCandidates(w,a).length,0);assert(liveCandidates(householdWorld(w,a),a,candidateActions(householdWorld(w,a),a)).every(c=>c.id==='drink'),'critical thirst takes priority');a.needs.hydration=95;
// Actual elapsed walking, never a teleport, and a mid-journey restart.
a.coordinates={x:100,y:38};w.agents=[a];a.residence.returnAfter=0;
const c=homeCandidates(w,a).find(c=>c.id==='return_home');let t={actionId:c.id,selected:c,workMinutes:0,requiredMinutes:30,phase:'work'};let result,travel=0;
for(let i=0;i<1800;i++){const before={...a.coordinates};result=advanceHomeReturn(w,a,t,.6);const d=Math.hypot(a.coordinates.x-before.x,a.coordinates.y-before.y);assert(d<1,'physical step is bounded');travel+=d;if(i===25)t=JSON.parse(JSON.stringify(t));if(result.done)break;}
assert(result?.success,JSON.stringify(result));assert(travel>15);assert(Math.hypot(a.coordinates.x-original.position.x,a.coordinates.y-original.position.y)<9);
assert(!homeCandidates(w,a).some(c=>c.id==='return_home'),'arrival ends the return');
// Nearby clearings carry comparable location evidence. Distant sites are not
// banned: an independent purpose can justify a design away from home.
const build=fixture(),builder=build.agents[0];builder.coordinates={x:90,y:39};
const dc=designContext(householdWorld(build,builder),builder);assert(dc.homeLife.home);assert(dc.sites.length);assert(dc.sites.every(s=>Number.isFinite(s.attachment.homeDistance)));
assert(dc.sites.some(s=>s.attachment.homeDistance>20),'travel and remote construction remain possible');
assert(dc.sites[0].attachment.preference>=dc.sites.at(-1).attachment.preference);
// A real alternative with observed shelter and food can become home, while
// an unknown camp, a brief visit alone, or an unreasoned move cannot.
const moving=fixture(),m=moving.agents[0],h=moving.frontier.homes.find(h=>h.id==='flint-heights');
m.coordinates={x:h.x,y:h.y};m.knownCamps=[h.id];m.campKnowledge={'willow-basin':{shelter:false},[h.id]:{shelter:true,at:clock(moving)}};
const food=Object.values(moving.regions.sites).find(s=>s.regionId===h.id);m.siteKnowledge={[food.id]:{quantity:10,observedHour:moving.day*24+moving.hour}};
const options=relocationChoices(moving,m);assert(options.length);
const before=JSON.stringify(m.inventory),ancestry=m.householdId,task={selected:{job:{campId:h.id}},workMinutes:0,requiredMinutes:1};
assert(settleHome(moving,m,task,1).success);assert.equal(m.residence.campId,h.id);assert.equal(m.householdId,ancestry,'residence does not change ancestry/provider');assert.equal(JSON.stringify(m.inventory),before);
assert.equal(relocationChoices(moving,m).length,0,'settling is not a repeated chore');
const noReason=fixture(),n=noReason.agents[0];n.coordinates={x:h.x,y:h.y};n.knownCamps=[h.id];n.campKnowledge={[h.id]:{shelter:true},'willow-basin':{shelter:true}};n.siteKnowledge=m.siteKnowledge;assert.equal(relocationChoices(noReason,n).length,0);
// A custom built home is an option too; no list of predefined camps owns relocation.
const custom=fixture(),resident=custom.agents[0];resident.coordinates={x:130,y:40};resident.knownPeople={};
const made={id:'custom-home',name:'Earned shelter',ownerId:resident.id,access:'private',purpose:'shelter',status:'complete',position:{x:130,y:40},parts:[{id:'surface',kind:'deck',material:'reeds',center:[0,.04,0],size:[1,.08,2.2],requires:[],built:true,durability:{quality:.9,condition:1}},{id:'cover',kind:'roof',material:'timber',center:[0,2,0],size:[3,.1,3],requires:[],built:true,durability:{quality:.9,condition:1}}]};
custom.settlement.projects.push(made);resident.comfort.lastRest={projectId:made.id,score:80,at:clock(custom)};custom.regions.sites.localFood={position:{x:135,y:40}};resident.siteKnowledge={localFood:{quantity:3}};
assert(relocationChoices(custom,resident).some(h=>h.projectId===made.id));
const move={selected:{job:{homeId:made.id}},workMinutes:0,requiredMinutes:1};assert(settleHome(custom,resident,move,1).success);assert.equal(resident.residence.projectId,made.id);
console.log('PASS home persistence; remembered partner location; soft attachment; survival priority; physical return/restart; reasoned relocation without changing ancestry or resources; ranked unrestricted build sites');
