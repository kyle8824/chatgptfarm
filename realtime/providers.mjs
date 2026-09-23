import {homeFor} from '../shared/frontier.js';
export const LLAMA_MODEL='@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const positive=v=>Number.isFinite(Number(v))&&Number(v)>0;
export function providerFor(w,a,env={},ai=null){
 const home=homeFor(w,a),householdId=home?.id||'willow-basin';
 // Deployment configuration can move the comparison to the original pair
 // without changing anyone's ancestry, home, saved work, or consumed quota.
 const provider=env.OPENAI_HOUSEHOLD?(householdId===env.OPENAI_HOUSEHOLD?'openai':'cloudflare'):home?.provider||'cloudflare';
 if(provider==='cloudflare')return {provider,model:LLAMA_MODEL,configured:!!ai,householdId:home?.id||'willow-basin'};
 const missing=['OPENAI_API_KEY','OPENAI_MODEL'].filter(k=>!env[k]).concat(['OPENAI_DAILY_USD','OPENAI_INPUT_USD_PER_MILLION','OPENAI_OUTPUT_USD_PER_MILLION'].filter(k=>!positive(env[k])));
 return {provider:'openai',model:env.OPENAI_MODEL||null,configured:missing.length===0,missing,householdId,dailyUsd:Number(env.OPENAI_DAILY_USD)||0,inputRate:Number(env.OPENAI_INPUT_USD_PER_MILLION)||0,outputRate:Number(env.OPENAI_OUTPUT_USD_PER_MILLION)||0};
}
// Cheap, read-only eligibility before perception, routes or building sites.
// The serialized reservation still checks the exact payload cost before use.
export function canRequestProvider(record,route,kind,now){
 if(!route.configured)return false;
 const date=new Date(now).toISOString().slice(0,10),today=record.ai.date===date;
 const calls=today?record.ai.calls:0,designCalls=record.designBudget?.date===date?record.designBudget.calls:0;
 const households=today?(record.ai.households??{'willow-basin':{calls,designCalls}}):{};
 const h=households[route.householdId]||{calls:0,designCalls:0};
 if(calls>=96||kind==='design'&&designCalls>=24||record.world.frontier&&(h.calls>=24||kind==='design'&&h.designCalls>=6||kind==='action'&&h.calls-h.designCalls>=18))return false;
 if(route.provider==='openai'&&(record.providerUsage?.rateMismatch||(record.providerUsage?.days?.[date]?.reservedUsd||0)>=route.dailyUsd))return false;
 return true;
}
export function reserveProvider(record,a,route,kind,payload,now){
 if(!route.configured)return null;const date=new Date(now).toISOString().slice(0,10),r=record;
 if(r.ai.date!==date){r.ai.date=date;r.ai.calls=0;r.ai.households={};}
 if(r.designBudget?.date!==date)r.designBudget={date,calls:0};
 // Preserve calls already consumed before this release. No budget reset.
 r.ai.households??={'willow-basin':{calls:r.ai.calls,designCalls:r.designBudget.calls}};
 const h=r.ai.households[route.householdId]??={calls:0,designCalls:0};
 if(!canRequestProvider(record,route,kind,now))return null;
 r.providerUsage??={days:{},records:[],totals:{}};const day=r.providerUsage.days[date]??={reservedUsd:0,reportedUsd:0};
 // A conservative reservation uses UTF-8 bytes (plus framing), output ceiling
 // and explicit configured rates. Unknown/failed requests keep reservations.
 const upperUsd=route.provider==='openai'?((new TextEncoder().encode(JSON.stringify(payload)).length+4096)*route.inputRate+payload.max_tokens*route.outputRate)/1e6:0;
 if(route.provider==='openai'&&(day.reservedUsd+upperUsd>route.dailyUsd||r.providerUsage.rateMismatch))return null;
 day.reservedUsd+=upperUsd;r.ai.calls++;h.calls++;if(kind==='design'){r.designBudget.calls++;h.designCalls++;(r.lastDesignAt??={})[a.id]=now;}else r.lastDecisionAt[a.id]=now;
 const entry={id:`${date}:${r.ai.calls}`,date,at:now,agentId:a.id,householdId:route.householdId,provider:route.provider,model:route.model,kind,status:'reserved',reservedUsd:upperUsd};r.providerUsage.records.push(entry);r.providerUsage.records=r.providerUsage.records.slice(-400);
 return entry;
}
export function recordProviderResult(record,entry,result,route,status){
 if(entry.accounted){entry.status=status;return;}entry.accounted=true;
 const usage=result?.usage||{},input=usage.input_tokens??usage.prompt_tokens,output=usage.output_tokens??usage.completion_tokens;Object.assign(entry,{status,inputTokens:Number.isFinite(input)?input:null,outputTokens:Number.isFinite(output)?output:null,responseId:result?.id||null});
 const key=entry.householdId,tot=record.providerUsage.totals[key]??={calls:0,actionCalls:0,designCalls:0,inputTokens:0,outputTokens:0,accepted:0,rejected:0};tot.calls++;tot[entry.kind+'Calls']++;tot.inputTokens+=entry.inputTokens||0;tot.outputTokens+=entry.outputTokens||0;
 if(route.provider==='openai'&&Number.isFinite(input)&&Number.isFinite(output)){const cost=(input*route.inputRate+output*route.outputRate)/1e6,day=record.providerUsage.days[entry.date];entry.reportedUsd=cost;day.reportedUsd+=cost;if(cost<=entry.reservedUsd)day.reservedUsd-=entry.reservedUsd-cost;else record.providerUsage.rateMismatch=true;}
}
export async function runProvider(route,payload,{ai,env={},fetcher=fetch}){
 if(route.provider==='cloudflare')return ai.run(route.model,payload);
 // Official Responses structured-output format:
 // https://developers.openai.com/api/docs/guides/structured-outputs
 const format=payload.response_format.type==='json_schema'?{type:'json_schema',name:'villager_action',strict:true,schema:{...payload.response_format.json_schema,additionalProperties:false}}:{type:'json_object'};
 const body={model:route.model,input:payload.messages,max_output_tokens:payload.max_tokens,text:{format},store:false};
 if(env.OPENAI_REASONING_EFFORT)body.reasoning={effort:env.OPENAI_REASONING_EFFORT};
 const response=await fetcher('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(45000)});
 if(!response.ok)throw Error(`openai_http_${response.status}`);const data=await response.json();if(data.status!=='completed')throw Object.assign(Error('openai_incomplete_response'),{providerResult:data});
 const text=(data.output||[]).filter(x=>x.type==='message').flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join('');if(!text)throw Object.assign(Error('openai_no_output'),{providerResult:data});
 return {...data,response:text};
}
export function providerSummary(record,env,ai,now){
 const date=new Date(now).toISOString().slice(0,10),today=record.ai.date===date;
 const day=record.providerUsage?.days[date]||null;
 return {
  households:(record.world.frontier?.homes||[{id:'willow-basin'}]).map(h=>{
   const route=providerFor(record.world,{householdId:h.id},env,ai);
   const usage=today?(record.ai.households?.[h.id]||(!record.ai.households&&h.id==='willow-basin'?{calls:record.ai.calls,designCalls:record.designBudget?.date===date?record.designBudget.calls:0}:null)):null;
   const actionAvailable=canRequestProvider(record,route,'action',now),designAvailable=canRequestProvider(record,route,'design',now);
   const availability=!route.configured?'awaiting_configuration':route.provider==='openai'&&record.providerUsage?.rateMismatch?'price_check':route.provider==='openai'&&(day?.reservedUsd||0)>=route.dailyUsd?'spend_limit':!actionAvailable&&!designAvailable?'daily_limit':'ready';
   return {id:h.id,provider:route.provider,model:route.model,status:route.configured?'configured':'awaiting configuration',missingConfiguration:route.missing||[],availability,actionAvailable,designAvailable,callsToday:usage?.calls||0,designCallsToday:usage?.designCalls||0,totals:record.providerUsage?.totals[h.id]||null,projects:record.world.settlement.projects.filter(p=>(p.householdId||'willow-basin')===h.id).map(p=>({id:p.id,status:p.status,partsBuilt:p.parts.filter(x=>x.built).length,partsTotal:p.parts.length,uses:p.feedback?.uses||0}))};
  }),openaiToday:day,openaiDailyUsd:positive(env.OPENAI_DAILY_USD)?Number(env.OPENAI_DAILY_USD):0,rateMismatch:record.providerUsage?.rateMismatch||false,allocation:record.world.frontier?{perHousehold:24,designPerHousehold:6,actionsPerHousehold:18}:null
 };
}
