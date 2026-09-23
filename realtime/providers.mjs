import {homeFor} from '../shared/frontier.js';
export const LLAMA_MODEL='@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const positive=v=>Number.isFinite(Number(v))&&Number(v)>0;
export function providerFor(w,a,env={},ai=null){
 const home=homeFor(w,a),provider=home?.provider||'cloudflare';
 if(provider==='cloudflare')return {provider,model:LLAMA_MODEL,configured:!!ai,householdId:home?.id||'willow-basin'};
 const configured=!!env.OPENAI_API_KEY&&!!env.OPENAI_MODEL&&positive(env.OPENAI_DAILY_USD)&&positive(env.OPENAI_INPUT_USD_PER_MILLION)&&positive(env.OPENAI_OUTPUT_USD_PER_MILLION);
 return {provider:'openai',model:env.OPENAI_MODEL||null,configured,householdId:home.id,dailyUsd:Number(env.OPENAI_DAILY_USD)||0,inputRate:Number(env.OPENAI_INPUT_USD_PER_MILLION)||0,outputRate:Number(env.OPENAI_OUTPUT_USD_PER_MILLION)||0};
}
export function reserveProvider(record,a,route,kind,payload,now){
 if(!route.configured)return null;const date=new Date(now).toISOString().slice(0,10),r=record;
 if(r.ai.date!==date){r.ai.date=date;r.ai.calls=0;r.ai.households={};}
 if(r.designBudget?.date!==date)r.designBudget={date,calls:0};
 // Preserve calls already consumed before this release. No budget reset.
 r.ai.households??={'willow-basin':{calls:r.ai.calls,designCalls:r.designBudget.calls}};
 const h=r.ai.households[route.householdId]??={calls:0,designCalls:0};
 if(r.ai.calls>=96||kind==='design'&&r.designBudget.calls>=24||r.world.frontier&&(h.calls>=24||kind==='design'&&h.designCalls>=6||kind==='action'&&h.calls-h.designCalls>=18))return null;
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
export function providerSummary(record,env,ai,now){return {households:(record.world.frontier?.homes||[{id:'willow-basin'}]).map(h=>{const route=providerFor(record.world,{householdId:h.id},env,ai);return {id:h.id,provider:route.provider,model:route.model,status:route.configured?'configured':'awaiting configuration',callsToday:record.ai.households?.[h.id]?.calls||0,designCallsToday:record.ai.households?.[h.id]?.designCalls||0,totals:record.providerUsage?.totals[h.id]||null,projects:record.world.settlement.projects.filter(p=>(p.householdId||'willow-basin')===h.id).map(p=>({id:p.id,status:p.status,partsBuilt:p.parts.filter(x=>x.built).length,partsTotal:p.parts.length,uses:p.feedback?.uses||0}))};}),openaiToday:record.providerUsage?.days[new Date(now).toISOString().slice(0,10)]||null,rateMismatch:record.providerUsage?.rateMismatch||false,allocation:record.world.frontier?{perHousehold:24,designPerHousehold:6,actionsPerHousehold:18}:null};}
