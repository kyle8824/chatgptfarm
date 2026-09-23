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
r.cloudflareUsage.days[date].reservedNeurons=9500;
for(const a of r.world.agents){a.needs={hunger:90,hydration:90,energy:90,warmth:90};const memories=a.memories;Object.defineProperty(a,'memories',{configurable:true,get(){contextReads++;return memories;}});}
const before=JSON.stringify({ai:r.ai,design:r.designBudget,decisions:r.lastDecisionAt,designTimes:r.lastDesignAt,usage:r.providerUsage});
for(let i=0;i<6;i++){now+=10001;r.lastWallTime=now;await c.requestDecisions();await Promise.allSettled([...c.jobs.values()]);}
assert.equal(contextReads,0,'exhausted budgets must skip expensive action and building contexts');
assert.equal(calls,0);assert.equal(JSON.stringify({ai:r.ai,design:r.designBudget,decisions:r.lastDecisionAt,designTimes:r.lastDesignAt,usage:r.providerUsage}),before,'preflight never resets or consumes quotas');

const a=r.world.agents.find(a=>a.householdId==='flint-heights'),route=providerFor(r.world,a,{},ai),payload={messages:[],max_tokens:2600};
assert.equal(canRequestProvider(r,route,'action',now),false);
assert.equal(canRequestProvider(r,route,'design',now),false);
// A normal UTC rollover re-enables planning without resetting today's record
// early. The actual reservation remains the authoritative spending gate.
const tomorrow=now+86400000;
assert.equal(canRequestProvider(r,route,'action',tomorrow),true);
assert.equal(canRequestProvider(r,route,'design',tomorrow),true);
assert.equal(r.ai.calls,78);
assert(reserveProvider(r,a,route,'design',payload,tomorrow));assert.equal(r.ai.calls,1);assert.equal(r.designBudget.calls,1);

// Llama is independent of the obsolete call-count ceilings.
r.ai.households[route.householdId]={calls:96,designCalls:24};r.ai.calls=200;r.designBudget.calls=80;
assert.equal(canRequestProvider(r,route,'action',tomorrow),true);
// The serialized reservation rejects a pool exhausted after preflight.
r.cloudflareUsage.days[new Date(tomorrow).toISOString().slice(0,10)].reservedNeurons=9500;
assert.equal(reserveProvider(r,a,route,'action',{messages:[],max_tokens:180},tomorrow),null);
// The paid provider retains both per-household and dollar protection.
const openai={...route,provider:'openai',dailyUsd:1,inputRate:1,outputRate:4};
assert.equal(canRequestProvider(r,openai,'action',tomorrow),false);
r.ai.households[route.householdId]={calls:0,designCalls:0};
r.providerUsage={days:{[new Date(tomorrow).toISOString().slice(0,10)]:{reservedUsd:1}},rateMismatch:false};
assert.equal(canRequestProvider(r,openai,'action',tomorrow),false);
r.providerUsage.days={};r.providerUsage.rateMismatch=true;assert.equal(canRequestProvider(r,openai,'action',tomorrow),false);
console.log('PASS exhausted neuron budgets skip expensive contexts; UTC rollover and immutable reads; obsolete caps removed for Llama; reservation and paid limits remain enforced');
