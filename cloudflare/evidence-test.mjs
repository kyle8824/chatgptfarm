import assert from 'node:assert/strict';
import {createWorld} from '../engine.js';
import {beginTransition} from '../runtime/timeline.mjs';
import {WorldController} from './world.mjs';
import {readCheckpoint,writeCheckpoint} from './checkpoint.mjs';
import {readEvidence} from './evidence.mjs';
class Storage {
 constructor(){this.map=new Map();this.alarm=null;this.failAt=null;}
 async get(k){return structuredClone(this.map.get(k));}
 async put(k,v){if(k===this.failAt)throw Error('injected write failure');this.map.set(k,structuredClone(v));}
 async delete(k){this.map.delete(k);}
 async getAlarm(){return this.alarm;}
 async setAlarm(v){this.alarm=v;}
 async deleteAlarm(){this.alarm=null;}
 async transaction(fn){const before=structuredClone(this.map),alarm=this.alarm;try{return await fn(this);}catch(e){this.map=before;this.alarm=alarm;throw e;}}
}
let now=1000000;
const storage=new Storage();let controller=new WorldController(storage,{},()=>now);
await controller.initialize(createWorld());
assert.equal((await controller.health()).evidence.segments,0);
now+=5000;await controller.alarm();
assert.equal(await readEvidence(storage,1),null,'Prepared future must not be completed evidence');
const old=await readCheckpoint(storage);
now=old.current.end;
storage.failAt='manifest';
await assert.rejects(controller.alarm(),/injected/);
assert.deepEqual(await readCheckpoint(storage),old,'Checkpoint rolled back');
assert.equal(await readEvidence(storage,1),null,'Archive rolled back with checkpoint');
assert.equal(await storage.get('archive-outbox:000000000001'),undefined,'Outbox rolled back');
storage.failAt=null;
controller=new WorldController(storage,{},()=>now);await controller.alarm();
const first=await readEvidence(storage,1);
assert.equal(first.payload.decisions.length,2);
assert.equal(first.payload.tick,1);
assert.equal((await controller.health()).evidence.segments,1);
await controller.alarm();assert.equal((await controller.health()).evidence.segments,1,'Duplicate alarm is idempotent');
controller=new WorldController(storage,{},()=>now);
assert.deepEqual(await controller.evidence(1),first,'Restart preserves exact evidence');
const next=await readCheckpoint(storage);
await writeCheckpoint(storage,next,next.current.end,old.current);
assert.equal((await controller.health()).evidence.segments,1,'Retry of same completion is idempotent');
const conflict=structuredClone(old.current);conflict.after.temperature++;
await assert.rejects(writeCheckpoint(storage,next,next.current.end,conflict),/Conflicting/);
assert.deepEqual(await readEvidence(storage,1),first);
// Replace the hot lists in a later checkpoint: durable records have independent retention.
next.current.before.dna=[];next.current.before.history=[];
await writeCheckpoint(storage,next,next.current.end);
assert.deepEqual(await readEvidence(storage,1),first);
// Old transitions without envelopes remain honest summaries on first migration.
const legacy=await beginTransition(next.current.after,next.current.end);
delete legacy.evidence;
const promoted={...next,current:await beginTransition(legacy.after,legacy.end),next:null};
// Separate store avoids fabricating a gap in the production archive sequence.
const legacyStorage=new Storage();await writeCheckpoint(legacyStorage,promoted,promoted.current.end,legacy);
assert.equal((await readEvidence(legacyStorage,legacy.after.meta.tickNumber)).payload.coverage,'legacy_summary_only');
const corruptKey='evidence:000000000001:0';storage.map.set(corruptKey,new Uint8Array([1,2,3]));
await assert.rejects(readEvidence(storage,1));
// Configuration and budget failures are observable without paid inference.
for(const [env,reason] of [[{},'ai_disabled'],[{AI_ENABLED:'true'},'missing_api_key'],[{AI_ENABLED:'true',OPENAI_API_KEY:'unused',AI_CALLS_PER_DAY:'0'},'budget_exhausted']]){
 const store=new Storage(),c=new WorldController(store,env,()=>now);
 await c.initialize(createWorld());await c.alarm();
 assert(c.record.next.evidence.decisions.every(d=>d.evidence.fallbackReason===reason));
 assert.equal(c.record.aiBudget.used,0);
}
console.log('PASS atomic evidence/outbox/checkpoint rollback, duplicate/restart/conflict, retention, legacy coverage, corruption and AI gate diagnostics');
