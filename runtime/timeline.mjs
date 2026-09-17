import {tick, migrateWorld} from '../engine.js';
import {coordForPosition} from '../engine/spectator.js';

const copy = value => structuredClone(value);
const mix = (a, b, t) => ({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});

// A transition is persisted BEFORE it is published. Its effects stay private
// until its deadline. Reloads and other viewers receive the same transition.
export async function beginTransition(world, start, duration = 150000, advance = tick) {
  const before = copy(world), after = copy(world);
  await advance(after);
  after.meta.tickNumber = (before.meta.tickNumber || 0) + 1;
  after.meta.lastAdvancedAt = new Date(start + duration).toISOString();
  return {version:1, start, end:start+duration, before, after};
}

export class Timeline {
  constructor({load, save, seed, now = Date.now, duration = 150000, planner = tick}) {
    if (!Number.isFinite(duration) || duration < 1000) throw Error('Invalid duration');
    Object.assign(this, {load,save,seed,now,duration,planner});
    this.queue = Promise.resolve();
  }
  async init() {
    this.record = await this.load();
    if (!this.record) {
      const next = await beginTransition(migrateWorld(copy(this.seed)),this.now(),this.duration,this.planner);
      await this.save(next);
      this.record = next;
    }
    if (this.record.version !== 1) throw Error('Unsupported runtime checkpoint');
    return this;
  }
  advance() {
    // Serialize timers and reads; no duplicate outcomes on concurrent requests.
    const operation = this.queue.then(async () => {
      let count = 0;
      while (this.now() >= this.record.end && count++ < 24) {
        const next = await beginTransition(this.record.after,this.record.end,this.duration,this.planner);
        await this.save(next); // Failed persistence cannot publish an uncommitted world.
        this.record = next;
      }
      return this.snapshot();
    });
    this.queue = operation.catch(() => {});
    return operation;
  }
  snapshot() {
    const r=this.record, now=this.now(), t=Math.max(0,Math.min(1,(now-r.start)/(r.end-r.start)));
    const w=copy(r.before);
    w.runtime={version:1,serverTime:now,start:r.start,end:r.end,revision:r.after.meta.tickNumber,
      status:now>=r.end?'catching-up':'running',decisionSource:r.after.meta.mindMode||'fallback'};
    w.meta.lastAdvancedAt=new Date(r.start).toISOString();
    w.meta.heartbeatMinutes=(r.end-r.start)/60000;
    for (const a of w.agents) {
      const next=r.after.agents.find(x=>x.id===a.id);
      const from=a.coordinates||coordForPosition(a.position),to=next.coordinates||coordForPosition(next.position);
      a.coordinates=mix(from,to,Math.min(1,t/.65));
      a.runtimeMotion={from,to,start:r.start,end:r.start+(r.end-r.start)*.65};
      a.currentAction=next.currentAction;
      a.mind=copy(next.mind);
      a.activeAction={...copy(next.activeAction),outcome:undefined};
      // Completed memories, inventories, needs, DNA and resources remain from before.
    }
    for (const animal of w.ecologySystem?.wildlife||[]) {
      const next=r.after.ecologySystem?.wildlife?.find(x=>x.id===animal.id);
      if (!next || !animal.position || !next.position) continue;
      const from=copy(animal.position),to=next.position;
      animal.position=mix(from,to,t);
      animal.runtimeMotion={from,to,start:r.start,end:r.end};
      animal.activity=next.activity;
      animal.behavior=next.behavior;
    }
    return w;
  }
}
