import {prepare,step,applyEvent} from './elapsed.mjs';
import {readCheckpoint,writeCheckpoint} from '../cloudflare/checkpoint.mjs';
export class LiveController{
 constructor(storage,{now=Date.now,rate=6}={}){this.storage=storage;this.now=now;this.rate=rate;this.queue=Promise.resolve();}
 serial(fn){const job=this.queue.then(fn);this.queue=job.catch(()=>{});return job;}
 async load(){if(this.record===undefined)this.record=await readCheckpoint(this.storage);return this.record;}
 async save(r){await writeCheckpoint(this.storage,r,this.now()+1000);this.record=r;}
 initialize(seed){return this.serial(async()=>{if(await this.load())throw Error('Already initialized');const now=this.now();await this.save({version:1,world:prepare(seed),lastWallTime:now,createdAt:now,steps:0,rate:this.rate});});}
 async advanceTo(target){
  const r=structuredClone(await this.load());if(!r)return;
  // Bound catch-up work. Persisted clock remains behind until subsequent alarms.
  let count=0;while(r.lastWallTime<target&&count++<120){const wall=Math.min(1000,target-r.lastWallTime);r.lastWallTime+=wall;await step(r.world,wall/1000*r.rate,{wallTime:r.lastWallTime});r.steps++;}
  await this.save(r);
 }
 alarm(){return this.serial(async()=>{try{await this.advanceTo(this.now());}catch(e){await this.storage.setAlarm(this.now()+5000);throw e;}});}
 event(event){return this.serial(async()=>{await this.advanceTo(this.now());const r=structuredClone(this.record);if(this.now()-r.lastWallTime>1000)throw Error('Catching up; event not applied');applyEvent(r.world,event);await this.save(r);});}
 snapshot(){return this.serial(async()=>{await this.load();if(!this.record)return null;const r=this.record,w=structuredClone(r.world),now=this.now();w.runtime={version:1,execution:'elapsed-only',environment:'isolated-preview',serverTime:now,start:r.lastWallTime,end:r.lastWallTime+3000,nextUpdateAt:now+1000,revision:r.steps,status:now-r.lastWallTime>5000?'catching-up':'running',decisionSource:'fallback',aiCallsToday:0,rate:r.rate,computedThrough:r.lastWallTime,lagMs:Math.max(0,now-r.lastWallTime),futureFrames:0};return w;});}
}
