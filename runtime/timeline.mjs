import {tick, migrateWorld} from '../engine.js';
import {coordForPosition} from '../engine/spectator.js';

const copy = value => structuredClone(value);
const mix = (a, b, t) => ({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});

// A transition is persisted BEFORE it is published. Its effects stay private
// until its deadline. Reloads and other viewers receive the same transition.
export async function beginTransition(world, start, duration = 150000, advance = tick) {
  // Upgrade the existing world before publishing movement into its environment.
  // Migration is private to this new persisted transition, never a spectator read.
  const before = migrateWorld(copy(world)), after = copy(before);
  await advance(after);
  after.meta.tickNumber = (before.meta.tickNumber || 0) + 1;
  after.meta.lastAdvancedAt = new Date(start + duration).toISOString();
  // Full decision inputs stay private and outside the capped spectator working set.
  const decisions=after.dna.filter(d=>d.evidence&&Number(d.decision_id.slice(2))>=before.seq.decision).map(d=>copy(d));
  for(const d of after.dna)delete d.evidence;
  return {version:1, start, end:start+duration, before, after, evidence:{version:1,decisions}};
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
    this.prepare();
    return this;
  }
  prepare() {
    const record=this.record;
    // Plan the following action while the published transition is still running.
    // No future outcomes are exposed, and a failed planner cannot reject unhandled.
    this.prepared={start:record.end,promise:beginTransition(record.after,record.end,this.duration,
      record.end+this.duration<this.now()?tick:this.planner).catch(()=>null)};
  }
  advance() {
    // Serialize timers and reads; no duplicate outcomes on concurrent requests.
    const operation = this.queue.then(async () => {
      let count = 0;
      while (this.now() >= this.record.end && count++ < 24) {
        const buffered=this.prepared?.start===this.record.end?await this.prepared.promise:null;
        const next = buffered || await beginTransition(this.record.after,this.record.end,this.duration);
        // Offline catch-up uses utility decisions, rather than a burst of paid model calls.
        await this.save(next); // Failed persistence cannot publish an uncommitted world.
        this.record = next;
        this.prepare();
      }
      return this.snapshot();
    });
    this.queue = operation.catch(() => {});
    return operation;
  }
  snapshot() {
    return snapshotTransition(this.record,this.now());
  }
}

export function snapshotTransition(r, now) {
    const t=Math.max(0,Math.min(1,(now-r.start)/(r.end-r.start)));
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
      // A transition represents a full world hour. Wildlife completes its
      // travel during the visible part of that hour, then continues the
      // selected activity (graze, forage, watch, hide, etc.) at its endpoint.
      // Stretching a short rabbit step over the entire interval made valid
      // movement too slow for a person to perceive.
      const resting=/rest|hide|freeze|drink/i.test(next.activity||'');
      const travelFraction=next.species==='fish' ? 1 : (resting ? .12 : .22);
      const motionEnd=r.start+(r.end-r.start)*travelFraction;
      const motionT=Math.max(0,Math.min(1,(now-r.start)/(motionEnd-r.start)));
      animal.position=mix(from,to,motionT);
      animal.runtimeMotion={from,to,start:r.start,end:motionEnd};
      animal.activity=next.activity;
      animal.behavior=next.behavior;
    }
    return w;
}
