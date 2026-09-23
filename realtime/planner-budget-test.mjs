import assert from 'node:assert/strict';
import {createWorld} from '../engine/core.js';
import {RealtimeController} from './world.mjs';
import {canRequestProvider,providerFor,reserveProvider} from './providers.mjs';
const saved=new Map(),storage={get:async k=>saved.get(k),put:async(k,v)=>saved.set(k,v),delete:async k=>saved.delete(k),setAlarm:async()=>{},transaction:async f=>f(storage)};
let now=Date.UTC(2026,8,23),calls=0,contextReads=0;
const ai={run:async()=>{calls++;throw Error('No provider calls in this test');}};
const c=new RealtimeController(storage,{now:()=>now,ai,frontierEnabled:true,landscapeEnabled:true});await c.initialize(createWorld());
const r=c.record,date=new Date(now).toISOString().slice(0,10);
// Production's exhausted budgets: Willow consumed the earlier global design
// allowance, and the other configured households spent their action shares.
r.ai={date,calls:78,households:{'willow-basin':{calls:42,designCalls:24},'flint-heights':{calls:18,designCalls:0},'reed-fen':{calls:18,designCalls:0}}};
r.designBudget={date,calls:24};
for(const a of r.world.agents){a.needs={hunger:90,hydration:90,energy:90,warmth:90};const memories=a.memories;Object.defineProperty(a,'memories',{configurable:true,get(){contextReads++;return memories;}});}
const before=JSON.stringify({ai:r.ai,design:r.designBudget,decisions:r.lastDecisionAt,designTimes:r.lastDesignAt,usage:r.providerUsage});
for(let i=0;i<6;i++){now+=10001;r.lastWallTime=now;await c.requestDecisions();await Promise.allSettled([...c.jobs.values()]);}
assert.equal(contextReads,0,'exhausted budgets must skip expensive action and building contexts');
assert.equal(calls,0);assert.equal(JSON.stringify({ai:r.ai,design:r.designBudget,decisions:r.lastDecisionAt,designTimes:r.lastDesignAt,usage:r.providerUsage}),before,'preflight never resets or consumes quotas');

const a=r.world.agents.find(a=>a.householdId==='flint-heights'),route=providerFor(r.world,a,{},ai),payload={messages:[],max_tokens:180};
assert.equal(canRequestProvider(r,route,'action',now),false);
assert.equal(canRequestProvider(r,route,'design',now),false);
// A normal UTC rollover re-enables planning without resetting today's record
// early. The actual reservation remains the authoritative spending gate.
const tomorrow=now+86400000;
assert.equal(canRequestProvider(r,route,'action',tomorrow),true);
assert.equal(canRequestProvider(r,route,'design',tomorrow),true);
assert.equal(r.ai.calls,78);
assert(reserveProvider(r,a,route,'design',payload,tomorrow));assert.equal(r.ai.calls,1);assert.equal(r.designBudget.calls,1);

// Action and design shares remain independent until a household/global cap.
r.ai.households[route.householdId]={calls:18,designCalls:0};r.ai.calls=18;r.designBudget.calls=0;
assert.equal(canRequestProvider(r,route,'action',tomorrow),false);
assert.equal(canRequestProvider(r,route,'design',tomorrow),true);
r.ai.households[route.householdId]={calls:6,designCalls:6};r.ai.calls=6;r.designBudget.calls=6;
assert.equal(canRequestProvider(r,route,'action',tomorrow),true);
assert.equal(canRequestProvider(r,route,'design',tomorrow),false);
r.ai.calls=96;assert.equal(canRequestProvider(r,route,'action',tomorrow),false);
assert.equal(reserveProvider(r,a,route,'action',payload,tomorrow),null,'the reservation also rejects a cap reached after preflight');
// Historical pre-household accounting must count the existing Willow calls.
delete r.ai.households;r.ai.calls=24;r.designBudget.calls=6;
assert.equal(canRequestProvider(r,{...route,householdId:'willow-basin'},'action',tomorrow),false);
assert.equal(canRequestProvider(r,route,'action',tomorrow),true);
const openai={...route,provider:'openai',dailyUsd:1,inputRate:1,outputRate:4};
r.providerUsage={days:{[new Date(tomorrow).toISOString().slice(0,10)]:{reservedUsd:1}},rateMismatch:false};
assert.equal(canRequestProvider(r,openai,'action',tomorrow),false);
r.providerUsage.days={};r.providerUsage.rateMismatch=true;assert.equal(canRequestProvider(r,openai,'action',tomorrow),false);
console.log('PASS exhausted budgets skip all planning contexts; quotas remain immutable until reservation; UTC rollover and independent shares work; actual reservations fail closed');
