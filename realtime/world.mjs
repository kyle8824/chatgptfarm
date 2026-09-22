import {resourceFrame} from './resource-sites.mjs';
import {prepare,step} from './elapsed.mjs';
import {retrieveDecisionContext} from '../engine/runtime.js';
import {wildlifeStep,wildlifeFrame} from './wildlife.mjs';
export {wildlifeStep} from './wildlife.mjs';
import {readCheckpoint,writeCheckpoint} from '../cloudflare/checkpoint.mjs';
import {worldFailure} from '../cloudflare/failure.mjs';
import {liveCandidates} from './behavior.mjs';
import {ensureSettlement,settlementFrame,loadOf,CARRY} from './holdings.mjs';
import {designContext,DESIGN_SYSTEM,validateBlueprint,adoptBlueprint} from './blueprints.mjs';
export const MODEL='@cf/meta/llama-3.3-70b-instruct-fp8-fast';
export function parseDecision(result,choices){
 const response=result?.response;let p=response;
 if(typeof response==='string'){const match=response.match(/\{[\s\S]*\}/);if(!match)throw Error('invalid_json');p=JSON.parse(match[0]);}
 if(!p||typeof p!=='object'||!choices.some(c=>c.id===p.actionId))throw Error('invalid_action');
 for(const key of ['goal','intent','decisionSummary'])if(typeof p[key]!=='string'||!p[key].trim())throw Error('invalid_decision');
 return {actionId:p.actionId,goal:p.goal.slice(0,180),intent:p.intent.slice(0,260),decisionSummary:p.decisionSummary.slice(0,260)};
}
export const RATE=6;
export const CHECKPOINT_MS=15000;
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
 constructor(storage,{now=Date.now,ai=null}={}){this.storage=storage;this.now=now;this.ai=ai;this.queue=Promise.resolve();this.proposals=new Map();this.jobs=new Map();this.lastSaved=0;this.lastAiCheck=0;this.error=null;this.checkpointIntervalMs=CHECKPOINT_MS;this.persistenceRetryAt=0;this.nextAlarmAt=0;}
 serial(fn){const p=this.queue.then(fn);this.queue=p.catch(()=>{});return p;}
 async load(){if(this.record===undefined){this.record=await readCheckpoint(this.storage);if(this.record){ensureSettlement(this.record.world);this.lastSaved=this.record.checkpointAt||0;this.checkpointIntervalMs=Math.max(CHECKPOINT_MS,this.record.checkpointIntervalMs||0);this.nextAlarmAt=this.lastSaved+this.checkpointIntervalMs;}for(const [id,p] of Object.entries(this.record?.pendingDecisions||{}))if(p.expires>this.now())this.proposals.set(id,p);}return this.record;}
 async initialize(seed){if(await this.load())return;const now=this.now(),w=prepare(seed);compact(w);w.meta.actionRulesVersion='realtime-2';w.meta.liveFork={sourceDay:w.day,sourceHour:w.hour,sourceTick:seed.meta.tickNumber,createdAt:now};
  for(const a of w.agents){delete a.runtimeMotion;delete a.motionPath;}
  this.record={version:1,world:w,lastWallTime:now,createdAt:now,revision:0,unattendedSteps:0,alarmCount:0,lastAlarmAt:null,rate:RATE,ai:{date:new Date(now).toISOString().slice(0,10),calls:0,succeeded:0,applied:0,rejected:0,lastError:null},lastDecisionAt:{}};
  await this.save();
 }
 async save(){if(this.now()<this.persistenceRetryAt)throw Error(this.error||'Persistence unavailable');const at=this.now();try{
  const bytes=await writeCheckpoint(this.storage,{...this.record,checkpointAt:at,checkpointIntervalMs:this.checkpointIntervalMs},at+this.checkpointIntervalMs);
  this.lastSaved=at;this.nextAlarmAt=at+this.checkpointIntervalMs;this.record.checkpointAt=at;this.persistenceRetryAt=0;
  // Keep routine live-world writes near 30,000 rows/day as checkpoints grow.
  // AI reservations still save immediately and remain inside their own cap.
  this.checkpointIntervalMs=Math.max(CHECKPOINT_MS,Math.ceil((Math.ceil(bytes/64000)+2)*86400000/30000));
 }catch(e){this.error=e.message;this.persistenceRetryAt=at+worldFailure(e,at).retryAfterSeconds*1000;throw e;}}
 async advance(target,viewers=0){const r=this.record;if(!r)return false;if(this.persistenceRetryAt){if(target<this.persistenceRetryAt)return false;await this.save();}let n=0;
  while(r.lastWallTime<target&&n++<300){const wall=Math.min(100,target-r.lastWallTime);r.lastWallTime+=wall;
   const adapter={decide:async c=>{const p=this.proposals.get(c.agent.id);this.proposals.delete(c.agent.id);if(r.pendingDecisions)delete r.pendingDecisions[c.agent.id];if(!p||p.expires<this.now())throw Object.assign(Error('Reflex policy'),{code:this.ai?'between_model_decisions':'ai_not_configured'});if(!c.candidates.some(x=>x.id===p.actionId)){r.ai.rejected++;throw Object.assign(Error('Stale action'),{code:'model_action_no_longer_available'});}r.ai.applied++;const a=r.world.agents.find(a=>a.id===c.agent.id);if(a?.liveThought)a.liveThought.status='applied';return p;}};
   await step(r.world,wall/1000*r.rate,{mind:adapter,wallTime:r.lastWallTime,fallbackReason:this.ai?'between_model_decisions':'ai_not_configured'});wildlifeStep(r.world,wall/1000*r.rate);r.revision++;if(!viewers)r.unattendedSteps++;
  }
  if(target-this.lastSaved>=this.checkpointIntervalMs){compact(r.world);await this.save();return true;}return false;
 }
 pulse(viewers=0){return this.serial(async()=>{try{await this.advance(this.now(),viewers);if(!this.persistenceRetryAt)this.error=null;}catch(e){this.error=e.message;throw e;}});}
 alarm(viewers=0){return this.serial(async()=>{try{await this.load();if(!this.record)return;this.record.alarmCount++;this.record.lastAlarmAt=this.now();const saved=await this.advance(this.now(),viewers);if(!saved&&this.nextAlarmAt<=this.now()&&!this.persistenceRetryAt)await this.save();if(!this.persistenceRetryAt)this.error=null;}catch(e){this.error=e.message;try{await this.storage.setAlarm(Math.max(this.now()+30000,this.persistenceRetryAt));}catch{/* Provider limits can block alarm writes too; fetch/timer will retry. */}throw e;}});}
 async requestDecisions(){if(!this.ai||this.persistenceRetryAt||this.now()-this.lastAiCheck<10000||!this.record)return;this.lastAiCheck=this.now();void this.requestDesigns();
  for(const a of this.record.world.agents){const pending=this.proposals.get(a.id);if(pending?.expires<=this.now()){this.proposals.delete(a.id);if(this.record.pendingDecisions)delete this.record.pendingDecisions[a.id];}
   const failed=this.record.decisionFailures?.[a.id]||(!this.record.decisionFailures&&this.record.ai.lastError);const cooldown=failed?120000:1800000;
   if(this.jobs.has(a.id)||this.proposals.has(a.id)||this.now()-(this.record.lastDecisionAt[a.id]||0)<cooldown)continue;
   const context=retrieveDecisionContext(this.record.world,a);const choices=liveCandidates(this.record.world,a,context.candidates).slice(0,8).map(x=>({id:x.id,label:x.label}));
   const input=JSON.stringify({person:a.name,needs:context.perception.needs,weather:context.perception.weather,temperature:context.perception.temperature,location:a.position,inventory:a.inventory,relationships:context.perception.knownPeople,memories:context.memories.slice(0,5).map(m=>m.text.slice(0,170)),recentActions:context.agent.recentActions.slice(-4),choices}).slice(0,6000);
   const job=this.makeDecision(a.id,input,choices);this.jobs.set(a.id,job);job.finally(()=>this.jobs.delete(a.id)).catch(()=>{});
  }
 }
 async makeDecision(id,input,choices){
  const reserved=await this.serial(async()=>{const r=this.record,date=new Date(this.now()).toISOString().slice(0,10);if(r.ai.date!==date){r.ai.date=date;r.ai.calls=0;}if(r.ai.calls>=96)return false;r.ai.calls++;r.lastDecisionAt[id]=this.now();await this.save();return true;});if(!reserved)return;
  try{const result=await this.ai.run(MODEL,{messages:[{role:'system',content:'You are a person surviving in a physical valley. Choose one currently available action. Prioritize immediate needs but learn from memories. Return JSON with actionId from choices, goal (short), intent (one sentence), decisionSummary (one sentence grounded in supplied facts). Never invent completed events or resources.'},{role:'user',content:input}],response_format:{type:'json_schema',json_schema:{type:'object',properties:{actionId:{type:'string',enum:choices.map(c=>c.id)},goal:{type:'string'},intent:{type:'string'},decisionSummary:{type:'string'}},required:['actionId','goal','intent','decisionSummary']}},max_tokens:180,temperature:.65});
   const p=parseDecision(result,choices);
   await this.serial(async()=>{const r=this.record;r.ai.succeeded++;r.ai.lastError=null;(r.decisionFailures??={})[id]=false;const proposal={...p,brainMode:'ai',choiceType:'known_action',model:MODEL,confidence:.7,expires:this.now()+600000,referencedMemoryIds:[]};this.proposals.set(id,proposal);(r.pendingDecisions??={})[id]=proposal;const a=r.world.agents.find(a=>a.id===id);a.liveThought={text:p.decisionSummary,at:this.now(),actionId:p.actionId,source:'model',model:MODEL,status:'proposed'};await this.save();});
  }catch(e){await this.serial(async()=>{(this.record.decisionFailures??={})[id]=true;this.record.ai.lastError=String(e.message||'provider_error').slice(0,120);await this.save();});}
 }
 async requestDesigns(){
  const w=this.record.world;ensureSettlement(w);if(w.settlement.projects.length>=12||w.settlement.projects.filter(p=>p.status!=='complete').length>=2)return;
  for(const a of w.agents){
   const key=`design:${a.id}`,last=this.record.lastDesignAt?.[a.id]||0,cooldown=this.record.designFailures?.[a.id]?180000:3600000;
   if(this.jobs.has(key)||this.now()-last<cooldown||Math.min(a.needs.hunger,a.needs.hydration,a.needs.energy)<20||w.settlement.projects.some(p=>p.ownerId===a.id&&p.status!=='complete'))continue;
   const context=designContext(w,a);if(!context.sites.length)continue;
   const job=this.makeDesign(a.id,context);this.jobs.set(key,job);job.finally(()=>this.jobs.delete(key)).catch(()=>{});
  }
 }
 async makeDesign(id,context){
  const reserved=await this.serial(async()=>{const r=this.record,date=new Date(this.now()).toISOString().slice(0,10);if(r.ai.date!==date){r.ai.date=date;r.ai.calls=0;}r.designBudget??={date,calls:0};if(r.designBudget.date!==date)r.designBudget={date,calls:0};if(r.ai.calls>=96||r.designBudget.calls>=24)return false;r.ai.calls++;r.designBudget.calls++;(r.lastDesignAt??={})[id]=this.now();await this.save();return true;});if(!reserved)return;
  let raw;try{
   const result=await this.ai.run(MODEL,{messages:[{role:'system',content:DESIGN_SYSTEM},{role:'user',content:JSON.stringify({...context,previousProgram:this.record.designDrafts?.[id]||null,previousRejection:this.record.designFailures?.[id]||null})}],response_format:{type:'json_object'},max_tokens:2600,temperature:.65});
   raw=typeof result?.response==='string'?JSON.parse(result.response.replace(/^```(?:json)?\s*|\s*```$/g,'')):result?.response;
   await this.serial(async()=>{const r=this.record,w=r.world,a=w.agents.find(a=>a.id===id),design=validateBlueprint(w,a,raw,context.sites?.find(s=>s.id===raw.siteId)),project=adoptBlueprint(w,a,design,MODEL);r.ai.succeeded++;(r.designFailures??={})[id]=null;if(r.designDrafts)delete r.designDrafts[id];
    w.settlement.designs.push({at:this.now(),agentId:id,status:project?'accepted':'deferred',projectId:project?.id||null,model:MODEL,reason:project?.rationale||String(raw.rationale||'No useful new structure proposed.').slice(0,350)});w.settlement.designs=w.settlement.designs.slice(-30);await this.save();});
  }catch(e){await this.serial(async()=>{const reason=String(e.message||'design_provider_error').slice(0,2400);(this.record.designFailures??={})[id]=reason;if(raw?.build===true&&(typeof raw.code==='string'&&raw.code.length<=14000||Array.isArray(raw.parts)&&raw.parts.length<=48)&&JSON.stringify(raw).length<=40000)(this.record.designDrafts??={})[id]=raw;const s=this.record.world.settlement;s.designs.push({at:this.now(),agentId:id,status:'rejected',model:MODEL,reason:reason.slice(0,400)});s.designs=s.designs.slice(-30);await this.save();});}
 }
 frame(viewers=0){const r=this.record,w=r.world,now=this.now();return {type:'state',groundRecent:Object.values(w.liveGround?.cells||{}).sort((a,b)=>b.sequence-a.sequence).slice(0,24),day:w.day,hour:w.hour,minute:w.minute,weather:w.weather,temperature:w.temperature,structures:w.structures,resources:w.resources,settlement:settlementFrame(w),objects:resourceFrame(w),agents:w.agents.map(a=>({id:a.id,name:a.name,coordinates:a.coordinates,motion:a.locomotion?{speed:a.locomotion.speed,facing:a.locomotion.facing}:null,needs:a.needs,inventory:a.inventory,carrying:{...loadOf(w,a),capacity:CARRY},currentAction:a.currentAction,position:a.position,task:a.task?{id:a.task.id,actionId:a.task.actionId,label:a.task.label,phase:a.task.phase,workMinutes:a.task.workMinutes,requiredMinutes:a.task.requiredMinutes,source:a.task.source,model:a.task.model,job:a.task.selected?.job||null,progress:a.task.progress||null,interactionReady:a.task.interactionReady,decisionSummary:a.task.decisionSummary||null}:null,mind:{brainMode:a.mind.brainMode,decisionSummary:a.mind.decisionSummary,currentGoal:a.mind.currentGoal,fallbackReason:a.mind.fallbackReason},thought:a.liveThought,memories:a.memories.slice(0,5).map(m=>({text:m.text,day:m.day,hour:m.hour})),memoryCount:a.memories.length})),wildlife:wildlifeFrame(w),history:w.history.slice(0,12).map(e=>({id:e.id,title:e.title,detail:e.detail,day:e.day,hour:e.hour})),runtime:{environment:'independent-live-fork',transport:'websocket',execution:'elapsed-only',revision:r.revision,serverTime:now,computedThrough:r.lastWallTime,lagMs:Math.max(0,now-r.lastWallTime),rate:r.rate,viewers,unattendedSteps:r.unattendedSteps,alarmCount:r.alarmCount,lastAlarmAt:r.lastAlarmAt,createdAt:r.createdAt,status:this.persistenceRetryAt?'persistence-blocked':this.error?'error':now-r.lastWallTime>3000?'catching-up':'running',error:this.error,persistence:{checkpointAt:this.lastSaved||null,intervalMs:this.checkpointIntervalMs,retryAt:this.persistenceRetryAt||null},futureFrames:0,ai:{configured:!!this.ai,model:this.ai?MODEL:null,...r.ai},origin:w.meta.liveFork}};}
 geometry(){const w=this.record.world;return {bounds:w.worldModel.bounds,objects:w.worldModel.objects.filter(o=>o.position).map(o=>({id:o.id,type:o.type,position:o.position,geometry:o.geometry,state:o.state})),sites:Object.values(w.regions?.sites||{}).map(s=>({id:s.id,position:s.position,label:s.label})),surfaceHistory:w.surfaceHistory,groundWear:Object.values(w.liveGround?.cells||{})};}
}
