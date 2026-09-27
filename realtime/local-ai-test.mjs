import assert from 'node:assert/strict';
import {createWorld} from '../engine/core.js';
import {RealtimeController} from './world.mjs';
import {localAiRequest,localSummary,LOCAL_LEASE_MS} from './local-ai.mjs';
import {infer,runnerConfig} from '../scripts/local-ai-runner.mjs';
class Storage{data=new Map();writes=0;async get(k){return structuredClone(this.data.get(k));}async put(k,v){this.writes++;if(typeof k==='object')for(const [name,value] of Object.entries(k))this.data.set(name,structuredClone(value));else this.data.set(k,structuredClone(v));}async delete(k){for(const key of Array.isArray(k)?k:[k])this.data.delete(key);}async setAlarm(){}async transaction(fn){return fn(this);}}
let now=Date.parse('2026-09-27T12:00:00Z'),cloudCalls=0;
const env={LOCAL_AI_KEY:'test-only-dedicated-key-123456789',LOCAL_AI_MODEL:'llama3.1:8b'},storage=new Storage();
const c=new RealtimeController(storage,{now:()=>now,env,ai:{run:async(model,payload)=>{cloudCalls++;const choices=JSON.parse(payload.messages[1].content).choices;return {response:{actionId:choices[0].id,goal:'survive',intent:'Use the available action',decisionSummary:'Attend to current needs'},usage:{prompt_tokens:50,completion_tokens:50}};}}});
await c.initialize(createWorld());
for(const a of c.record.world.agents){a.task=null;c.record.lastDecisionAt[a.id]=now;}
const request=(route,body,key=env.LOCAL_AI_KEY)=>new Request('https://farm/live/local-ai/'+route,{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify(body)});
assert.equal((await localAiRequest(c,request('next',{model:env.LOCAL_AI_MODEL},'bad'))).status,401);assert.equal(c.record.localAi,undefined,'unauthorized calls never create jobs');
assert.equal((await localAiRequest(c,request('next',{model:'other'}))).status,409);
const writes=storage.writes,cloudState=JSON.stringify({ai:c.record.ai,last:c.record.lastDecisionAt,budget:c.record.cloudflareUsage}),reply=await localAiRequest(c,request('next',{model:env.LOCAL_AI_MODEL})),job=(await reply.json()).job;assert(job);
assert.equal((await (await localAiRequest(c,request('next',{model:env.LOCAL_AI_MODEL}))).json()).job,null,'only one lease, bounded polling');
const before=c.record.revision;now+=100;await c.pulse();assert(c.record.revision>before,'an outstanding local inference does not block live physics');
const choices=job.payload.response_format.json_schema.properties.actionId.enum;
const answer={actionId:choices[0],goal:'survive',intent:'Attend to current circumstances',decisionSummary:'Choose the available action'};
let localRequests=0;
const response=await infer({ollama:'http://127.0.0.1:11434',model:env.LOCAL_AI_MODEL},job.payload,{fetcher:async(url,options)=>{localRequests++;assert.equal(url,'http://127.0.0.1:11434/api/chat');const p=JSON.parse(options.body);assert.equal(p.stream,false);assert.equal(p.options.num_ctx,4096);assert(p.format.properties.actionId.enum.includes(answer.actionId));assert(!options.headers.Authorization,'no farm or provider secret goes to Ollama');return Response.json({done:true,model:env.LOCAL_AI_MODEL,message:{content:JSON.stringify(answer)}});}});
// The world can change during inference. Reissue from the current boundary
// for a valid acceptance, then separately test a stale result.
c.record.world.agents.forEach(a=>{a.task=null;});
const accepted=await localAiRequest(c,request('result',{id:job.id,model:job.model,response}));assert.equal(accepted.status,200);assert.equal(localRequests,1);assert.equal(cloudCalls,0);
assert.equal(c.proposals.get(job.agentId).model,'local/llama3.1:8b');assert.equal(storage.writes,writes,'no extra checkpoint for local polling or proposals');
assert.equal(JSON.stringify({ai:c.record.ai,last:c.record.lastDecisionAt,budget:c.record.cloudflareUsage}),cloudState,'local work does not consume or postpone cloud allowance');
assert.equal((await localAiRequest(c,request('result',{id:job.id,model:job.model,response}))).status,409,'duplicate result cannot apply twice');
await c.save();const restored=new RealtimeController(storage,{now:()=>now,env});await restored.load();assert.equal(restored.proposals.get(job.agentId).provider,'local');assert.equal(localSummary(restored).available,false,'restart must not claim a desktop is connected');
c.proposals.clear();c.record.pendingDecisions={};now+=120001;c.record.lastWallTime=now;for(const a of c.record.world.agents)a.task=null;
const expiring=(await (await localAiRequest(c,request('next',{model:job.model}))).json()).job;assert(expiring);now+=LOCAL_LEASE_MS+1;c.record.lastWallTime=now;
assert.equal((await localAiRequest(c,request('result',{id:expiring.id,model:job.model,response}))).status,422,'late offline result rejected');assert.equal(localSummary(c).available,false);
// After a local disconnect, the existing cloud schedule is still used with
// its own normal reservation, never an immediate per-local-failure retry.
now+=1800001;c.record.lastWallTime=now;c.record.lastDesignAt=Object.fromEntries(c.record.world.agents.map(a=>[a.id,now]));await c.requestDecisions();await Promise.all([...c.jobs.values()]);assert(cloudCalls>0);assert(c.record.ai.calls>0);
const disabled=new RealtimeController(new Storage(),{env:{}});assert.equal((await localAiRequest(disabled,request('next',{model:job.model}))).status,401);
assert.throws(()=>runnerConfig({OLLAMA_URL:'http://public.example:11434'}),/loopback/);assert.throws(()=>runnerConfig({FARM_URL:'http://farm.example'}),/HTTPS/);
console.log('PASS authenticated optional local protocol; real runner request format with fixture inference; bounded lease/polling; advancing physics; duplicate/late rejection; saved proposal; independent cloud fallback/budget; no extra checkpoints or exposed secrets');
