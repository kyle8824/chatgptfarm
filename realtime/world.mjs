import {freeTimeContext} from './free-time.mjs';
import {actionInput,actionPayload,parseDecision} from './decision-input.mjs';
import {localSummary,localLeaseActive} from './local-ai.mjs';
import {initializeCloudflareBudget,cloudflareDay} from './cloudflare-budget.mjs';
import {happinessContext} from './happiness.mjs';
import {applyAuthorizedAllowanceReset} from './allowance-reset.mjs';
import {reorganizeLandscape} from './landscape-migration.mjs';
import {providerFor,canRequestProvider,reserveProvider,recordProviderResult,runProvider,providerSummary} from './providers.mjs';
import {residenceOf} from './home-life.mjs';
import {expandFrontier,frontierFrame,householdWorld} from './frontier.mjs';
import {householdProjects} from './blueprints.mjs';
import {ensureLife,isAdult,lifeSummary,relationshipsFor} from './life.mjs';
import {requestMaintenance} from './structure-lifecycle.mjs';
import {resourceFrame} from './resource-sites.mjs';
import {prepare,step} from './elapsed.mjs';
import {wildlifeStep,wildlifeFrame} from './wildlife.mjs';
export {wildlifeStep} from './wildlife.mjs';
import {readCheckpoint,writeCheckpoint} from '../cloudflare/checkpoint.mjs';
import {worldFailure} from '../cloudflare/failure.mjs';
import {comfortContext} from './comfort.mjs';
import {ensureSettlement,settlementFrame,loadOf,CARRY} from './holdings.mjs';
import {designContext,DESIGN_SYSTEM,validateBlueprint,adoptBlueprint} from './blueprints.mjs';
export const MODEL='@cf/meta/llama-3.3-70b-instruct-fp8-fast';
export {parseDecision} from './decision-input.mjs';
export const RATE=6;
export const CHECKPOINT_MS=15000;
export const RECOVERY_STEP_MS=1000;
export const PULSE_BUDGET_MS=40;
export const MAX_PULSE_STEPS=12;
export const RECOVERY_CHECKPOINT_PROGRESS_MS=120000;
export function compact(w){
 w.dna=w.dna.slice(-80);for(const d of w.dna)delete d.evidence;
 w.history=w.history.slice(0,140);
 // Full imported history is archived separately. Preserve all memories and
 // sum historical material sinks; these are accounting, not active bodies.
 if(w.wood?.sinks.length>100){const sums=new Map();for(const s of w.wood.sinks){const k=s.reason;let a=sums.get(k);if(!a){a={...s,operationId:`archive:${k}`,dryKg:0,waterKg:0,units:0,records:0};sums.set(k,a);}a.dryKg+=s.dryKg;a.waterKg+=s.waterKg;a.units+=s.units;a.records+=s.records||1;}w.wood.sinks=[...sums.values()];}
 if(w.wood)w.wood.operations=w.wood.operations.slice(-80);
 for(const a of w.agents){const seen=new Set();a.suspendedTasks=(a.suspendedTasks||[]).filter(t=>{if(seen.has(t.actionId))return false;seen.add(t.actionId);return true;}).slice(-6);}
}
export class RealtimeController{
 constructor(storage,{now=Date.now,ai=null,env={},fetcher=fetch,frontierEnabled=false,landscapeEnabled=false,budgetNow=()=>performance.now(),yieldToHost=()=>new Promise(resolve=>setTimeout(resolve,1))}={}){this.env=env;this.fetcher=fetcher;this.frontierEnabled=frontierEnabled;this.landscapeEnabled=landscapeEnabled;this.storage=storage;this.now=now;this.ai=ai;this.budgetNow=budgetNow;this.yieldToHost=yieldToHost;this.queue=Promise.resolve();this.proposals=new Map();this.jobs=new Map();this.lastSaved=0;this.lastAiCheck=0;this.error=null;this.checkpointIntervalMs=CHECKPOINT_MS;this.persistenceRetryAt=0;this.nextAlarmAt=0;}
 serial(fn){const p=this.queue.then(fn);this.queue=p.catch(()=>{});return p;}
 async load(){if(this.record===undefined){this.record=await readCheckpoint(this.storage);if(this.record){this.checkpointIntervalMs=Math.max(CHECKPOINT_MS,this.record.checkpointIntervalMs||0);const reset=applyAuthorizedAllowanceReset(this.record,this.env,this.now()),budget=initializeCloudflareBudget(this.record,this.now());if(reset||budget)await this.save();ensureSettlement(this.record.world);ensureLife(this.record.world);if(this.frontierEnabled&&!this.record.world.frontier){expandFrontier(this.record.world);await this.save();}if(this.landscapeEnabled&&reorganizeLandscape(this.record.world))await this.save();this.lastSaved=this.record.checkpointAt||0;this.checkpointIntervalMs=Math.max(CHECKPOINT_MS,this.record.checkpointIntervalMs||0);this.nextAlarmAt=this.lastSaved+this.checkpointIntervalMs;}for(const [id,p] of Object.entries(this.record?.pendingDecisions||{}))if(p.expires>this.now())this.proposals.set(id,p);}return this.record;}
 async initialize(seed){if(await this.load())return;const now=this.now(),w=prepare(seed);compact(w);w.meta.actionRulesVersion='realtime-2';w.meta.liveFork={sourceDay:w.day,sourceHour:w.hour,sourceTick:seed.meta.tickNumber,createdAt:now};
  for(const a of w.agents){delete a.runtimeMotion;delete a.motionPath;}
  this.record={version:1,world:w,lastWallTime:now,createdAt:now,revision:0,unattendedSteps:0,alarmCount:0,lastAlarmAt:null,rate:RATE,ai:{date:new Date(now).toISOString().slice(0,10),calls:0,succeeded:0,applied:0,rejected:0,lastError:null},lastDecisionAt:{}};
  initializeCloudflareBudget(this.record,now);if(this.frontierEnabled)expandFrontier(w);if(this.landscapeEnabled)reorganizeLandscape(w);await this.save();
 }
 async save(){if(this.now()<this.persistenceRetryAt)throw Error(this.error||'Persistence unavailable');const at=this.now();try{
  const bytes=await writeCheckpoint(this.storage,{...this.record,checkpointAt:at,checkpointIntervalMs:this.checkpointIntervalMs},at+this.checkpointIntervalMs);
  this.lastSaved=at;this.lastSavedThrough=this.record.lastWallTime;this.nextAlarmAt=at+this.checkpointIntervalMs;this.record.checkpointAt=at;this.persistenceRetryAt=0;
  // Keep routine live-world writes near 30,000 rows/day as checkpoints grow.
  // AI reservations still save immediately and remain inside their own cap.
  this.checkpointIntervalMs=Math.max(CHECKPOINT_MS,Math.ceil((Math.ceil(bytes/64000)+2)*86400000/30000));
 }catch(e){this.error=e.message;this.persistenceRetryAt=at+worldFailure(e,at).retryAfterSeconds*1000;throw e;}}
 async advance(target,viewers=0){const r=this.record;if(!r)return false;this.lastSavedThrough??=r.lastWallTime;if(this.persistenceRetryAt){if(target<this.persistenceRetryAt)return false;await this.save();}let n=0;const started=this.budgetNow();
  while(r.lastWallTime<target&&n++<MAX_PULSE_STEPS){const remaining=target-r.lastWallTime,wall=Math.min(remaining>30000?RECOVERY_STEP_MS:100,remaining),through=r.lastWallTime+wall;
   const adapter={decide:async c=>{const p=this.proposals.get(c.agent.id);this.proposals.delete(c.agent.id);if(r.pendingDecisions)delete r.pendingDecisions[c.agent.id];if(!p||p.expires<this.now())throw Object.assign(Error('Reflex policy'),{code:providerFor(r.world,r.world.agents.find(a=>a.id===c.agent.id),this.env,this.ai).configured?'between_model_decisions':'ai_not_configured'});if(!c.candidates.some(x=>x.id===p.actionId)){if(p.provider==='local'&&r.localAi)r.localAi.rejected++;else r.ai.rejected++;throw Object.assign(Error('Stale action'),{code:'model_action_no_longer_available'});}if(p.provider==='local')r.localAi.applied++;else r.ai.applied++;const a=r.world.agents.find(a=>a.id===c.agent.id);if(a?.liveThought)a.liveThought.status='applied';return p;}};
   await step(r.world,wall/1000*r.rate,{mind:adapter,wallTime:through,fallbackReason:this.ai?'between_model_decisions':'ai_not_configured'});wildlifeStep(r.world,wall/1000*r.rate);r.lastWallTime=through;r.revision++;if(!viewers)r.unattendedSteps++;
   // Resolved promises alone do not yield to incoming requests or alarms.
   // Yield real event-loop turns so recovery cannot starve the CPU refresh
   // and checkpoint alarms. Keep the ordinary 100 ms physical step near now.
   await this.yieldToHost();if(this.budgetNow()-started>=PULSE_BUDGET_MS)break;
  }
  // Production clocks advance on I/O, not during CPU work. Recovery must
  // checkpoint completed progress even while that wall-clock reading is stale.
  if(target-this.lastSaved>=this.checkpointIntervalMs||target-r.lastWallTime>30000&&r.lastWallTime-this.lastSavedThrough>=RECOVERY_CHECKPOINT_PROGRESS_MS){compact(r.world);await this.save();return true;}return false;
 }
 pulse(viewers=0){return this.serial(async()=>{try{await this.advance(this.now(),viewers);if(!this.persistenceRetryAt)this.error=null;}catch(e){this.error=e.message;throw e;}});}
 alarm(viewers=0){return this.serial(async()=>{try{await this.load();if(!this.record)return;this.record.alarmCount++;this.record.lastAlarmAt=this.now();const saved=await this.advance(this.now(),viewers);if(!saved&&this.nextAlarmAt<=this.now()&&!this.persistenceRetryAt)await this.save();if(!this.persistenceRetryAt)this.error=null;}catch(e){this.error=e.message;try{await this.storage.setAlarm(Math.max(this.now()+30000,this.persistenceRetryAt));}catch{/* Provider limits can block alarm writes too; fetch/timer will retry. */}throw e;}});}
 planningOrder(kind){const day=cloudflareDay(this.record,this.now());return [...this.record.world.agents].sort((a,b)=>(day.households[a.householdId||'willow-basin']?.[kind+'Neurons']||0)-(day.households[b.householdId||'willow-basin']?.[kind+'Neurons']||0)||((kind==='design'?this.record.lastDesignAt:this.record.lastDecisionAt)?.[a.id]||0)-((kind==='design'?this.record.lastDesignAt:this.record.lastDecisionAt)?.[b.id]||0));}
 async requestDecisions(){if((!this.ai&&!this.env.OPENAI_API_KEY)||this.persistenceRetryAt||this.now()-this.lastAiCheck<10000||!this.record||this.now()-this.record.lastWallTime>3000)return;this.lastAiCheck=this.now();
  for(const a of this.planningOrder('action')){const route=providerFor(this.record.world,a,this.env,this.ai);if(!route.configured||!isAdult(this.record.world,a))continue;const pending=this.proposals.get(a.id);if(pending?.expires<=this.now()){this.proposals.delete(a.id);if(this.record.pendingDecisions)delete this.record.pendingDecisions[a.id];}
   if(!canRequestProvider(this.record,route,'action',this.now()))continue;
   const failed=this.record.decisionFailures?.[a.id]||(!this.record.decisionFailures&&this.record.ai.lastError);const cooldown=failed&&route.provider==='openai'?120000:1800000;
   if(this.jobs.has(a.id)||localLeaseActive(this,a.id)||this.proposals.has(a.id)||this.now()-(this.record.lastDecisionAt[a.id]||0)<cooldown)continue;
   const {input,choices}=actionInput(householdWorld(this.record.world,a),a);
   const job=this.makeDecision(a.id,input,choices);this.jobs.set(a.id,job);job.finally(()=>this.jobs.delete(a.id)).catch(()=>{});
  }
  void this.requestDesigns();
 }
 async makeDecision(id,input,choices){
  const a=this.record.world.agents.find(a=>a.id===id),route=providerFor(this.record.world,a,this.env,this.ai),payload=actionPayload(input,choices);
  const reserved=await this.serial(async()=>{const entry=reserveProvider(this.record,a,route,'action',payload,this.now());if(entry)await this.save();return entry;});if(!reserved)return;let result;
  try{result=await runProvider(route,payload,{ai:this.ai,env:this.env,fetcher:this.fetcher});
   const p=parseDecision(result,choices);
   await this.serial(async()=>{const r=this.record;recordProviderResult(r,reserved,result,route,'succeeded');r.ai.succeeded++;r.ai.lastError=null;(r.decisionFailures??={})[id]=false;const proposal={...p,brainMode:'ai',choiceType:'known_action',model:route.model,confidence:.7,expires:this.now()+600000,referencedMemoryIds:[]};this.proposals.set(id,proposal);(r.pendingDecisions??={})[id]=proposal;const a=r.world.agents.find(a=>a.id===id);a.liveThought={text:p.decisionSummary,at:this.now(),actionId:p.actionId,source:'model',model:route.model,status:'proposed'};await this.save();});
  }catch(e){await this.serial(async()=>{recordProviderResult(this.record,reserved,result||e.providerResult,route,'failed');(this.record.decisionFailures??={})[id]=true;this.record.ai.lastError=String(e.message||'provider_error').slice(0,120);await this.save();});}
 }
 async requestDesigns(){
  const w=this.record.world;ensureSettlement(w);if(!w.frontier&&w.settlement.projects.filter(p=>p.status!=='complete').length>=2)return;
  for(const a of this.planningOrder('design')){
   if(!canRequestProvider(this.record,providerFor(w,a,this.env,this.ai),'design',this.now())||!isAdult(w,a)||householdProjects(w,a).filter(p=>p.status!=='complete').length>=2)continue;
   const key=`design:${a.id}`,last=this.record.lastDesignAt?.[a.id]||0,cooldown=this.record.designFailures?.[a.id]&&providerFor(w,a,this.env,this.ai).provider==='openai'?180000:3600000;
   if(this.jobs.has(key)||this.now()-last<cooldown||Math.min(a.needs.hunger,a.needs.hydration,a.needs.energy)<20||w.settlement.projects.some(p=>p.ownerId===a.id&&p.status!=='complete'))continue;
   const context=designContext(householdWorld(w,a),a);if(!context.sites.length)continue;
   const job=this.makeDesign(a.id,context);this.jobs.set(key,job);job.finally(()=>this.jobs.delete(key)).catch(()=>{});
  }
 }
 async makeDesign(id,context){
  const a=this.record.world.agents.find(a=>a.id===id),route=providerFor(this.record.world,a,this.env,this.ai),repair=this.record.designRepair?.[id],fresh=(repair?.repeats||0)>=2,payload={messages:[{role:'system',content:DESIGN_SYSTEM},{role:'user',content:JSON.stringify({...context,previousProgram:fresh?null:this.record.designDrafts?.[id]||null,previousRejection:this.record.designFailures?.[id]||null,retryStrategy:fresh?'fresh_design':'revise',failedAttempts:repair?.repeats||0})}],response_format:{type:'json_object'},max_tokens:2600,temperature:.65};
  const reserved=await this.serial(async()=>{const entry=reserveProvider(this.record,a,route,'design',payload,this.now());if(entry)await this.save();return entry;});if(!reserved)return;
  let raw,result;try{result=await runProvider(route,payload,{ai:this.ai,env:this.env,fetcher:this.fetcher});
   raw=typeof result?.response==='string'?JSON.parse(result.response.replace(/^```(?:json)?\s*|\s*```$/g,'')):result?.response;
   if(raw?.repairProjectId&&raw.build!==false)throw Error('A maintenance request must use build:false; a new design uses replacesProjectId.');
   await this.serial(async()=>{const r=this.record,a=r.world.agents.find(a=>a.id===id),w=householdWorld(r.world,a),maintenance=raw?.repairProjectId?requestMaintenance(w,a,raw.repairProjectId,raw.rationale):null,design=maintenance?null:validateBlueprint(w,a,raw,context.sites?.find(s=>s.id===raw.siteId)),project=adoptBlueprint(w,a,design,route.model);recordProviderResult(r,reserved,result,route,'succeeded');r.providerUsage.totals[route.householdId].accepted++;r.ai.succeeded++;(r.designFailures??={})[id]=null;if(r.designRepair)delete r.designRepair[id];if(r.designDrafts)delete r.designDrafts[id];
    w.settlement.designs.push({at:this.now(),agentId:id,status:maintenance?'maintenance_requested':project?'accepted':'deferred',projectId:project?.id||maintenance?.id||null,model:route.model,reason:project?.rationale||String(raw.rationale||'No useful new structure proposed.').slice(0,350)});w.settlement.designs=w.settlement.designs.slice(-30);await this.save();});
  }catch(e){await this.serial(async()=>{recordProviderResult(this.record,reserved,result||e.providerResult,route,'rejected');this.record.providerUsage.totals[route.householdId].rejected++;const reason=String(e.message||'design_provider_error').slice(0,2400);(this.record.designFailures??={})[id]=reason;const previous=this.record.designRepair?.[id];(this.record.designRepair??={})[id]={reason,repeats:previous?.reason===reason?previous.repeats+1:1};if(raw?.build===true&&(typeof raw.code==='string'&&raw.code.length<=14000||Array.isArray(raw.parts)&&raw.parts.length<=48)&&JSON.stringify(raw).length<=40000)(this.record.designDrafts??={})[id]=raw;const s=this.record.world.settlement;s.designs.push({at:this.now(),agentId:id,status:'rejected',model:route.model,reason:reason.slice(0,400)});s.designs=s.designs.slice(-30);await this.save();});}
 }
 frontier(){const w=this.record.world,f=frontierFrame(w);if(f)for(const h of f.homes)h.provider=providerFor(w,{householdId:h.id},this.env,this.ai).provider;return f;}
 frame(viewers=0,{includeTrees=true}={}){const r=this.record,w=r.world,now=this.now();return {type:'state',frontier:this.frontier(),chronicle:w.chronicle?{people:w.chronicle.people,events:w.chronicle.events.slice(-40)}:null,groundRecent:Object.values(w.liveGround?.cells||{}).sort((a,b)=>b.sequence-a.sequence).slice(0,24),day:w.day,hour:w.hour,minute:w.minute,weather:w.weather,temperature:w.temperature,structures:w.structures,resources:w.resources,settlement:settlementFrame(w,{includeTrees}),objects:resourceFrame(w),agents:w.agents.map(a=>({id:a.id,name:a.name,surname:a.surname||null,householdId:a.householdId||null,life:lifeSummary(w,a),relationships:relationshipsFor(w,a),coordinates:a.coordinates,residence:(()=>{const h=residenceOf(w,a);return h?{name:h.name,position:h.position,reason:h.reason,since:h.since}:null;})(),motion:a.locomotion?{speed:a.locomotion.speed,facing:a.locomotion.facing}:null,needs:a.needs,happiness:happinessContext(a),comfort:comfortContext(w,a),improvementGoal:a.improvementGoal||null,restSupport:a.restSupport||null,interests:freeTimeContext(w,a),inventory:a.inventory,skills:a.skills,craftPractice:a.craftPractice||{},carrying:{...loadOf(w,a),capacity:CARRY},currentAction:a.currentAction,position:a.position,task:a.task?{id:a.task.id,actionId:a.task.actionId,label:a.task.label,phase:a.task.phase,workMinutes:a.task.workMinutes,requiredMinutes:a.task.requiredMinutes,source:a.task.source,model:a.task.model,job:a.task.selected?.job||null,progress:a.task.progress||null,interactionReady:a.task.interactionReady,decisionSummary:a.task.decisionSummary||null,reason:a.task.selected?.job?.reason||a.task.selected?.explanation||null}:null,mind:{brainMode:a.mind.brainMode,decisionSummary:a.mind.decisionSummary,currentGoal:a.mind.currentGoal,fallbackReason:a.mind.fallbackReason},thought:a.liveThought,memories:a.memories.slice(0,5).map(m=>({text:m.text,day:m.day,hour:m.hour})),memoryCount:a.memories.length})),wildlife:wildlifeFrame(w),history:w.history.slice(0,12).map(e=>({id:e.id,title:e.title,detail:e.detail,day:e.day,hour:e.hour})),runtime:this.runtime(viewers)};}
 runtime(viewers=0){const r=this.record,w=r.world,now=this.now();return {environment:'independent-live-fork',transport:'websocket',execution:'elapsed-only',revision:r.revision,serverTime:now,computedThrough:r.lastWallTime,lagMs:Math.max(0,now-r.lastWallTime),rate:r.rate,viewers,unattendedSteps:r.unattendedSteps,alarmCount:r.alarmCount,lastAlarmAt:r.lastAlarmAt,createdAt:r.createdAt,status:this.persistenceRetryAt?'persistence-blocked':this.error?'error':now-r.lastWallTime>3000?'catching-up':'running',error:this.error,persistence:{checkpointAt:this.lastSaved||null,intervalMs:this.checkpointIntervalMs,retryAt:this.persistenceRetryAt||null},futureFrames:0,localAi:localSummary(this),providers:providerSummary(r,this.env,this.ai,now),ai:{configured:!!this.ai,model:this.ai?MODEL:null,...r.ai,dailyLimit:null,designDailyLimit:null,designCalls:r.designBudget?.date===new Date(now).toISOString().slice(0,10)?r.designBudget.calls:0},origin:w.meta.liveFork};}
 geometry(){const w=this.record.world;return {bounds:w.worldModel.bounds,frontier:this.frontier(),objects:w.worldModel.objects.filter(o=>o.position).map(o=>({id:o.id,type:o.type,position:o.position,geometry:o.geometry,state:o.state})),sites:Object.values(w.regions?.sites||{}).map(s=>({id:s.id,position:s.position,label:s.label})),surfaceHistory:w.surfaceHistory,groundWear:Object.values(w.liveGround?.cells||{})};}
}
