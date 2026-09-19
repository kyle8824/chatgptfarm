import {beginTransition,snapshotTransition} from '../runtime/timeline.mjs';
import {tickWithMind,tick,migrateWorld} from '../engine.js';
import {createOpenAIMind} from '../mind.js';
import {readCheckpoint,writeCheckpoint} from './checkpoint.mjs';
import {readEvidence} from './evidence.mjs';

export class WorldController {
  constructor(storage,env={},now=Date.now){
    Object.assign(this,{storage,env,now});this.queue=Promise.resolve();
  }
  serial(operation){const job=this.queue.then(operation);this.queue=job.catch(()=>{});return job;}
  async load(){if(this.record===undefined)this.record=await readCheckpoint(this.storage);return this.record;}
  alarmTime(r){return r.paused?null:Math.max(this.now()+1000,r.next?r.current.end:Math.min(r.current.end,r.current.start+5000));}
  async persist(r,completed=null){await writeCheckpoint(this.storage,r,this.alarmTime(r),completed);this.record=structuredClone(r);}
  async initialize(seed){return this.serial(async()=>{
    if(await this.load())throw Error('World already initialized; replacement is disabled');
    if(!seed?.worldModel||!seed.agents?.length||!seed.meta)throw Error('Invalid world seed');
    const world=migrateWorld(structuredClone(seed));
    const r={version:1,mode:'preview',paused:false,importedAt:this.now(),sourceTick:seed.meta.tickNumber,
      current:await beginTransition(world,this.now()),next:null,aiBudget:{day:'',used:0}};
    await this.persist(r);return this.health();
  });}
  async plan(world,start,r){
    const day=new Date(this.now()).toISOString().slice(0,10);
    if(r.aiBudget.day!==day)r.aiBudget={day,used:0};
    const mind=createOpenAIMind(this.env);
    const limit=Math.max(0,Math.min(2000,(Number.isFinite(Number(this.env.AI_CALLS_PER_DAY))?Number(this.env.AI_CALLS_PER_DAY):100)));
    const configured=this.env.AI_ENABLED==='true'&&mind.enabled;
    const bounded={decide:async context=>{
      if(!configured||r.aiBudget.used>=limit)throw Object.assign(new Error('Daily AI call budget reached'),{code:'budget_exhausted'});
      // Reserve the call durably before making it. Retries cannot evade the budget.
      r.aiBudget.used++;await this.persist(r);
      return mind.decide(context);
    }};
    return beginTransition(world,start,150000,w=>tickWithMind(w,configured?bounded:null,{fallbackReason:this.env.AI_ENABLED!=='true'?'ai_disabled':'missing_api_key'}));
  }
  alarm(){return this.serial(async()=>{
    const original=await this.load();if(!original||original.paused)return;
    let r=structuredClone(original);
    try{
      // Bounded catch-up, independently of browser visits. Old offline actions use
      // utility decisions so downtime cannot trigger an unbounded model bill.
      for(let i=0;this.now()>=r.current.end&&i<8;i++){
        const completed=r.current;
        r.current=r.next||await beginTransition(r.current.after,r.current.end,150000,tick);
        r.next=null;await this.persist(r,completed);r=structuredClone(r);
      }
      if(this.now()<r.current.end&&!r.next){
        r.next=await this.plan(r.current.after,r.current.end,r);
      }
      await this.persist(r);
    }catch(error){
      // Keep trying after Cloudflare's finite built-in alarm retries are exhausted.
      await this.storage.setAlarm(this.now()+30000);
      throw error;
    }
  });}
  async snapshot(){await this.load();if(!this.record)return null;
    const w=snapshotTransition(this.record.current,this.record.paused?this.record.pausedAt:this.now());
    w.runtime.mode='preview';w.runtime.aiCallsToday=this.record.aiBudget.used;
    if(this.record.paused)w.runtime.status='paused';
    return w;
  }
  async evidence(tick){return this.serial(()=>readEvidence(this.storage,tick));}
  async health(){await this.load();const r=this.record;
    return r?{initialized:true,mode:r.mode,paused:r.paused,tick:r.current.before.meta.tickNumber,
      start:r.current.start,end:r.current.end,serverTime:this.now(),planned:!!r.next,
      alarmAt:await this.storage.getAlarm(),sourceTick:r.sourceTick,aiCallsToday:r.aiBudget.used,
      cognition:{enabled:this.env.AI_ENABLED==='true',providerConfigured:!!this.env.OPENAI_API_KEY,model:createOpenAIMind(this.env).model,decisionMode:r.current.after.meta.mindMode||'fallback',lastDecisionReasons:r.current.after.dna.slice(0,r.current.after.agents.length).map(d=>({agentId:d.agent_id,reason:r.current.evidence?.decisions.find(x=>x.decision_id===d.decision_id)?.evidence?.fallbackReason||null})),reflection:'not_integrated',experiments:'disabled'},
      evidence:await this.storage.get('evidence:summary')||{version:1,segments:0,externalArchive:'not_configured'},simulatedSecondsPerTransition:3600,wallMillisecondsPerTransition:150000}
      :{initialized:false,mode:'preview'};
  }
  pause(){return this.serial(async()=>{
    const original=await this.load();if(!original)throw Error('World not initialized');
    if(!original.paused)await this.persist({...original,paused:true,pausedAt:this.now()});
    return this.health();
  });}
  resume(){return this.serial(async()=>{
    const original=await this.load();if(!original)throw Error('World not initialized');
    if(original.paused){
      const r=structuredClone(original),shift=this.now()-r.pausedAt;
      for(const part of [r.current,r.next].filter(Boolean)){
        part.start+=shift;part.end+=shift;part.after.meta.lastAdvancedAt=new Date(part.end).toISOString();
      }
      r.paused=false;delete r.pausedAt;await this.persist(r);
    }
    return this.health();
  });}
}
