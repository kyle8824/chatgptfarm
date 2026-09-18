import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {WorldController} from './world.mjs';
import {readCheckpoint,writeCheckpoint} from './checkpoint.mjs';
const seed=JSON.parse(await fs.readFile(new URL('../world/state.json',import.meta.url),'utf8'));
class Storage {
  constructor(){this.map=new Map();this.alarm=null;this.fail=false;}
  async get(key){return structuredClone(this.map.get(key));}
  async put(key,value){if(this.fail)throw Error('disk full');this.map.set(key,structuredClone(value));}
  async delete(key){this.map.delete(key);}
  async getAlarm(){return this.alarm;}
  async setAlarm(value){this.alarm=value;}
  async deleteAlarm(){this.alarm=null;}
  async transaction(fn){const map=structuredClone(this.map),alarm=this.alarm;try{return await fn(this)}catch(e){this.map=map;this.alarm=alarm;throw e;}}
}
let now=1000000;
const storage=new Storage();
let world=new WorldController(storage,{},()=>now);
await world.initialize(seed);
await assert.rejects(world.initialize(seed),/already initialized/);
const first=await world.snapshot();
assert.deepEqual(first.dna,seed.dna,'Unfinished results stay private');
assert.deepEqual(first.agents.map(a=>a.memories),seed.agents.map(a=>a.memories));
now+=5000;await world.alarm();assert((await world.health()).planned);
const scheduled=await storage.getAlarm();
assert.equal(scheduled,1150000);
now+=40000;
const mid=await world.snapshot();
assert(mid.ecologySystem.wildlife.some((a,i)=>JSON.stringify(a.position)!==JSON.stringify(first.ecologySystem.wildlife[i].position)));
world=new WorldController(storage,{},()=>now);
assert.deepEqual(await world.snapshot(),mid,'Eviction preserves exact shared state');
now=scheduled;await world.alarm();
assert.equal((await world.snapshot()).meta.tickNumber,seed.meta.tickNumber+1);
await world.alarm();assert.equal((await world.snapshot()).meta.tickNumber,seed.meta.tickNumber+1,'Duplicate alarm cannot duplicate outcomes');
await world.pause();const paused=await world.snapshot();
now+=3600000;await world.alarm();
assert.equal(await storage.getAlarm(),null);
assert.deepEqual((await world.snapshot()).agents,paused.agents);
await world.resume();assert.equal((await world.snapshot()).meta.tickNumber,paused.meta.tickNumber);
const safe=await readCheckpoint(storage);
storage.fail=true;await assert.rejects(world.pause(),/disk full/);
assert.deepEqual(await readCheckpoint(storage),safe);
storage.fail=false;
now+=8*3600000;
for(let i=0;i<26&&(await world.health()).end<=now;i++)await world.alarm();
assert((await world.health()).end>now,'Recover eight hours without visitors');
assert((await world.snapshot()).agents.every(a=>a.memories.length));
const manifest=await storage.get('manifest');
console.log(`PASS Cloudflare controller: alarms without visitors, duplicate delivery, eviction, pause/resume, atomic failure, 8h catch-up. Checkpoint ${manifest.bytes} bytes in ${manifest.chunks} chunks.`);
