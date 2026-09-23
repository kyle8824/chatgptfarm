// Workers AI pricing verified 2026-09-23:
// https://developers.cloudflare.com/workers-ai/platform/pricing/
// These rates apply ONLY to @cf/meta/llama-3.3-70b-instruct-fp8-fast.
export const CF_MODEL='@cf/meta/llama-3.3-70b-instruct-fp8-fast';
export const CF_FREE_NEURONS=10000;
export const CF_DAILY_NEURONS=9500;
const DAY_MS=86400000,INPUT_RATE=26668/1e6,OUTPUT_RATE=204805/1e6;
const ceilings={action:180,design:2600};
const dayKey=now=>new Date(now).toISOString().slice(0,10);
const valid=n=>Number.isFinite(n)&&n>=0;
export const tokenNeurons=(input,output)=>input*INPUT_RATE+output*OUTPUT_RATE;
const emptyDay=()=>({reservedNeurons:0,reportedNeurons:0,actionNeurons:0,designNeurons:0,calls:0,unverifiedCalls:0,legacyUntrackedCalls:0,households:{},deferred:{},rateMismatch:false});
export function cloudflareDay(record,now){return record.cloudflareUsage?.days?.[dayKey(now)]||emptyDay();}
function add(day,entry,cost,reported){
 day.reservedNeurons+=cost;day[entry.kind+'Neurons']+=cost;day.calls++;
 const h=day.households[entry.householdId||'willow-basin']??={actionNeurons:0,designNeurons:0,calls:0};h[entry.kind+'Neurons']+=cost;h.calls++;
 if(reported)day.reportedNeurons+=cost;else day.unverifiedCalls++;
}
// Upgrade once without erasing requests consumed before the new ledger.
// A missing historical request could have consumed an entire context window;
// keep this UTC day closed instead of pretending that unknown usage was free.
export function initializeCloudflareBudget(record,now){
 if(record.cloudflareUsage?.version===1)return false;
 const date=dayKey(now),day=emptyDay(),entries=(record.providerUsage?.records||[]).filter(e=>e.date===date);
 for(const e of entries.filter(e=>e.provider==='cloudflare')){
  const known=e.model===CF_MODEL&&valid(e.inputTokens)&&valid(e.outputTokens);
  const cost=known?tokenNeurons(e.inputTokens,e.outputTokens):tokenNeurons(24000,ceilings[e.kind]||2600);
  add(day,e,cost,known);
 }
 const resetCalls=Object.values(record.allowanceResets||{}).filter(x=>x.date===date).reduce((n,x)=>n+(x.previous?.household?.calls||0),0);
 const historicalCalls=(record.ai.date===date?record.ai.calls:0)+resetCalls;
 day.legacyUntrackedCalls=Math.max(0,historicalCalls-entries.length);
 if(day.legacyUntrackedCalls)day.reservedNeurons=Math.max(CF_DAILY_NEURONS,day.reservedNeurons);
 record.cloudflareUsage={version:1,days:{[date]:day}};
 return true;
}
function released(now){return Math.min(CF_DAILY_NEURONS,1200+(CF_DAILY_NEURONS-1200)*(now%DAY_MS)/DAY_MS);}
function available(day,kind,now){
 // Protect both ordinary thought and construction before 18:00 UTC; later
 // either can use the other's unused portion. There is no household call cap.
 const protectedOther=now%DAY_MS<18*3600000?Math.max(0,released(now)*(kind==='design'?.4:.5)-day[(kind==='design'?'action':'design')+'Neurons']):0;
 return Math.max(0,released(now)-protectedOther-day.reservedNeurons);
}
export function cloudflareEligibility(record,route,kind,now){
 const day=cloudflareDay(record,now);
 if(route.model!==CF_MODEL||day.rateMismatch)return 'price_check';
 if(day.legacyUntrackedCalls)return 'usage_unverified';
 if(day.reservedNeurons>=CF_DAILY_NEURONS)return 'free_allowance_used';
 const needed=day.deferred[route.householdId+':'+kind]||tokenNeurons(1024,ceilings[kind]);
 if(CF_DAILY_NEURONS-day.reservedNeurons+1e-8<needed)return 'free_allowance_used';
 return available(day,kind,now)>1e-8?'ready':'budget_pacing';
}
export function reserveCloudflare(record,route,kind,payload,now){
 initializeCloudflareBudget(record,now);
 const date=dayKey(now),day=record.cloudflareUsage.days[date]??=emptyDay();
 if(cloudflareEligibility(record,route,kind,now)!=='ready')return null;
 if(!Number.isInteger(payload.max_tokens)||payload.max_tokens<1||payload.max_tokens>ceilings[kind])return null;
 // UTF-8 bytes upper-bound byte-level prompt tokens; framing/schema overhead
 // is reserved separately. The model cannot accept more than 24k input tokens.
 const inputBound=Math.min(24000,new TextEncoder().encode(JSON.stringify(payload)).length+1024);
 const cost=tokenNeurons(inputBound,payload.max_tokens);
 // One bounded request may borrow ahead of its paced share; its complete
 // worst-case cost must still fit the hard daily budget before sending.
 if(cost>CF_DAILY_NEURONS-day.reservedNeurons+1e-8){day.deferred[route.householdId+':'+kind]=cost;return null;}
 delete day.deferred[route.householdId+':'+kind];
 add(day,{kind,householdId:route.householdId},cost,false);
 // Daily aggregates, not the bounded diagnostic request list, own accounting.
 for(const key of Object.keys(record.cloudflareUsage.days))if(key<dayKey(now-7*DAY_MS))delete record.cloudflareUsage.days[key];
 return {reservedNeurons:cost,inputTokenBound:inputBound,outputTokenBound:payload.max_tokens};
}
export function settleCloudflare(record,entry,input,output){
 const day=record.cloudflareUsage?.days?.[entry.date];
 if(!day||!valid(entry.reservedNeurons)||!valid(input)||!valid(output))return;
 const cost=tokenNeurons(input,output),difference=cost-entry.reservedNeurons;
 day.reportedNeurons+=cost;day.unverifiedCalls=Math.max(0,day.unverifiedCalls-1);
 // Over-reported consumption is charged in full, then further calls pause.
 day.reservedNeurons+=difference;day[entry.kind+'Neurons']+=difference;
 day.households[entry.householdId][entry.kind+'Neurons']+=difference;
 entry.reportedNeurons=cost;
 if(input>entry.inputTokenBound||output>entry.outputTokenBound||cost>entry.reservedNeurons+1e-8)day.rateMismatch=true;
}
export function cloudflareSummary(record,now){
 const d=cloudflareDay(record,now);
 return {scope:'this-world',accountUsageVerified:false,freeAllowanceNeurons:CF_FREE_NEURONS,dailyTargetNeurons:CF_DAILY_NEURONS,marginNeurons:CF_FREE_NEURONS-CF_DAILY_NEURONS,date:dayKey(now),resetAt:(Math.floor(now/DAY_MS)+1)*DAY_MS,reportedNeurons:d.reportedNeurons,reservedNeurons:d.reservedNeurons,releasedNeurons:released(now),calls:d.calls,unverifiedCalls:d.unverifiedCalls,legacyUntrackedCalls:d.legacyUntrackedCalls,rateMismatch:d.rateMismatch};
}
