import {householdWorld} from '../shared/frontier.js';
import {isAdult} from './life.mjs';
import {providerFor,canRequestProvider} from './providers.mjs';
import {actionInput,actionPayload,parseDecision} from './decision-input.mjs';

// Optional outbound desktop worker. One expiring lease, no inbound desktop
// port, no remote code execution, no changes to cloud quotas or its clock.
export const LOCAL_INTERVAL_MS=120000;
export const LOCAL_LEASE_MS=90000;
const POLL_MS=10000;
export function localConfigured(env){return typeof env.LOCAL_AI_KEY==='string'&&env.LOCAL_AI_KEY.length>=24&&!!env.LOCAL_AI_MODEL;}
const authorized=(env,request)=>localConfigured(env)&&request.headers.get('Authorization')===`Bearer ${env.LOCAL_AI_KEY}`;
const state=c=>c.localAi??={lastPollAt:0,onlineUntil:0,lease:null};
const ledger=c=>c.record.localAi??={calls:0,succeeded:0,rejected:0,applied:0,lastAttemptAt:{},lastResult:null};
export function localSummary(c){const s=c.localAi,l=c.record.localAi;return {configured:localConfigured(c.env),available:!!s&&s.onlineUntil>c.now(),model:c.env.LOCAL_AI_MODEL?`local/${c.env.LOCAL_AI_MODEL}`:null,intervalSeconds:LOCAL_INTERVAL_MS/1000,calls:l?.calls||0,succeeded:l?.succeeded||0,rejected:l?.rejected||0,applied:l?.applied||0,lastResult:l?.lastResult||null};}
export function localLeaseActive(c,agentId){const l=c.localAi?.lease;return l?.agentId===agentId&&l.expires>c.now();}
export function claimLocalJob(c){
 const now=c.now(),s=state(c);
 if(now-s.lastPollAt<POLL_MS)return {job:null,retryAfterSeconds:10};s.lastPollAt=now;s.onlineUntil=now+45000;
 if(s.lease?.expires>now)return {job:null,retryAfterSeconds:10};
 if(s.lease){ledger(c).rejected++;ledger(c).lastResult={at:now,status:'expired'};s.lease=null;}
 if(c.persistenceRetryAt||now-c.record.lastWallTime>3000)return {job:null,retryAfterSeconds:30};
 const l=ledger(c),w=c.record.world;
 const people=[...w.agents].sort((a,b)=>(l.lastAttemptAt[a.id]||0)-(l.lastAttemptAt[b.id]||0));
 for(const a of people){
  const pending=c.proposals.get(a.id);if(pending?.expires<=now){c.proposals.delete(a.id);if(c.record.pendingDecisions)delete c.record.pendingDecisions[a.id];}
  if(!isAdult(w,a)||c.jobs.has(a.id)||c.proposals.has(a.id)||now-(l.lastAttemptAt[a.id]||0)<LOCAL_INTERVAL_MS)continue;
  // Avoid queueing guesses for a long running task. Reconsider at a genuine
  // decision boundary; survival continues to interrupt without any model.
  if(a.task&&!['relax','reconsider'].includes(a.task.selected?.job?.kind)&&!(a.task.phase==='work'&&a.task.requiredMinutes-a.task.workMinutes<=1))continue;
  const route=providerFor(w,a,c.env,c.ai);
  if(canRequestProvider(c.record,route,'action',now)&&now-(c.record.lastDecisionAt[a.id]||0)>=1800000)continue;
  const {input,choices}=actionInput(householdWorld(w,a),a);if(!choices.length)continue;
  const job={id:crypto.randomUUID(),agentId:a.id,person:a.name,model:c.env.LOCAL_AI_MODEL,expires:now+LOCAL_LEASE_MS,payload:actionPayload(input,choices)};
  l.calls++;l.lastAttemptAt[a.id]=now;s.lease={...job,choices};return {job,retryAfterSeconds:10};
 }
 return {job:null,retryAfterSeconds:10};
}
export function acceptLocalResult(c,body){
 const s=state(c),lease=s.lease,now=c.now();
 if(!lease||body?.id!==lease.id)return {status:409,error:'unknown_or_completed_job'};
 s.lease=null;const l=ledger(c),a=c.record.world.agents.find(a=>a.id===lease.agentId);
 try{
  if(lease.expires<=now||!a||body.model!==lease.model)throw Error('expired_or_wrong_model');
  if(body.error)throw Error('local_inference_failed');
  if(typeof body.response!=='string'||body.response.length>6000)throw Error('invalid_response');
  const p=parseDecision({response:body.response},lease.choices);
  if(c.proposals.has(a.id)||c.jobs.has(a.id))throw Error('newer_planning_in_progress');
  const {choices}=actionInput(householdWorld(c.record.world,a),a);
  if(!choices.some(c=>c.id===p.actionId))throw Error('action_no_longer_available');
  const model=`local/${lease.model}`,proposal={...p,brainMode:'ai',choiceType:'known_action',model,provider:'local',confidence:.6,expires:now+120000,referencedMemoryIds:[]};
  c.proposals.set(a.id,proposal);(c.record.pendingDecisions??={})[a.id]=proposal;
  a.liveThought={text:p.decisionSummary,at:now,actionId:p.actionId,source:'model',model,status:'proposed'};
  l.succeeded++;l.lastResult={at:now,status:'accepted',agentId:a.id,model};s.onlineUntil=now+45000;
  // Included in the normal checkpoint. Extra thinking must not add a durable
  // write per heartbeat, poll or response. Lost leases simply expire on restart.
  return {status:200,accepted:true};
 }catch(e){l.rejected++;l.lastResult={at:now,status:String(e.message).slice(0,80),agentId:lease.agentId};return {status:422,accepted:false,error:l.lastResult.status};}
}
async function boundedJson(request){
 const reader=request.body?.getReader();if(!reader)throw Error('body_required');let bytes=0,text='';const decoder=new TextDecoder();
 try{while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>16000)throw Error('body_too_large');text+=decoder.decode(value,{stream:true});}return JSON.parse(text+decoder.decode());}finally{await reader.cancel().catch(()=>{});}
}
export async function localAiRequest(c,request){
 const respond=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
 if(!authorized(c.env,request))return respond({error:'unauthorized_or_disabled'},401);
 if(request.method!=='POST')return respond({error:'post_required'},405);
 let body;try{body=await boundedJson(request);}catch{return respond({error:'invalid_body'},400);}
 const path=new URL(request.url).pathname;
 if(path==='/live/local-ai/next'){
  if(body.model!==c.env.LOCAL_AI_MODEL)return respond({error:'model_mismatch'},409);
  return c.serial(()=>respond(claimLocalJob(c)));
 }
 if(path==='/live/local-ai/result')return c.serial(()=>{const {status,...result}=acceptLocalResult(c,body);return respond(result,status);});
 return respond({error:'not_found'},404);
}
