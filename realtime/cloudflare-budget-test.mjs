import assert from 'node:assert/strict';
import {CF_MODEL,CF_DAILY_NEURONS,initializeCloudflareBudget,cloudflareDay,cloudflareSummary,tokenNeurons} from './cloudflare-budget.mjs';
import {reserveProvider,recordProviderResult,canRequestProvider} from './providers.mjs';
const start=Date.UTC(2026,8,24),date='2026-09-24';
const record=()=>({world:{frontier:{}},ai:{date,calls:0,households:{}},lastDecisionAt:{}});
const route={provider:'cloudflare',configured:true,model:CF_MODEL,householdId:'flint-heights'};
const person={id:'test-person'},payload=(kind)=>({messages:[{role:'user',content:'A useful physical decision. '.repeat(kind==='design'?200:40)}],max_tokens:kind==='design'?2600:180});
const success=(r,e,kind,input=kind==='design'?3500:1000,output=kind==='design'?500:90)=>recordProviderResult(r,e,{usage:{prompt_tokens:input,completion_tokens:output}},route,'succeeded');
assert.equal(tokenNeurons(1000000,0),26668);assert.equal(tokenNeurons(0,1000000),204805);

// Run a full UTC day of six eligible villagers, without any real model calls.
const r=record();initializeCloudflareBudget(r,start);let actions=0,designs=0;
for(let minute=0;minute<1440;minute+=10){
 const now=start+minute*60000;
 for(const kind of ['action','design']){
  if(minute%(kind==='action'?30:60))continue;
  const homes=['flint-heights','reed-fen','ochre-vale'].sort((a,b)=>(cloudflareDay(r,now).households[a]?.[kind+'Neurons']||0)-(cloudflareDay(r,now).households[b]?.[kind+'Neurons']||0));
  for(const home of homes)for(let i=0;i<2;i++){
   const rt={...route,householdId:home},e=reserveProvider(r,{id:home+i},rt,kind,payload(kind),now);
   if(!e)continue;
   assert(cloudflareDay(r,now).reservedNeurons<=CF_DAILY_NEURONS+1e-6,'concurrent reservations cannot overdraw free target');
   success(r,e,kind);if(kind==='action')actions++;else designs++;
  }
 }
}
const d=cloudflareDay(r,start);
assert(actions>54,'more action planning than the old three-duo allowance');
assert(designs>=18,'representative planning preserves construction while increasing ordinary thought');
assert(d.reportedNeurons>8500&&d.reportedNeurons<=9500,'use most of the free allowance with representative demand');
assert(Object.values(r.ai.households).every(h=>h.calls>24),'no old per-duo cap');
assert(d.designNeurons>2000&&d.actionNeurons>4000,'both planning purposes receive compute');
assert(!d.rateMismatch);
console.log(`Full-day fixture: ${actions} action + ${designs} design calls, ${d.reportedNeurons.toFixed(1)} neurons.`);

// Pending, failed and missing-usage requests retain their reserved upper bound.
const pending=record();initializeCloudflareBudget(pending,start);
const e=reserveProvider(pending,person,route,'action',payload('action'),start);
assert(e);const held=cloudflareDay(pending,start).reservedNeurons;
recordProviderResult(pending,e,null,route,'failed');assert.equal(cloudflareDay(pending,start).reservedNeurons,held);
assert.equal(cloudflareDay(pending,start).unverifiedCalls,1);
const copy=structuredClone(pending);assert.deepEqual(cloudflareSummary(copy,start),cloudflareSummary(pending,start),'reservations survive checkpoint round trip');
const e2=reserveProvider(pending,person,route,'action',payload('action'),start);
success(pending,e2,'action');const once=JSON.stringify(pending.cloudflareUsage);success(pending,e2,'action');assert.equal(JSON.stringify(pending.cloudflareUsage),once,'no double refunds');
const snapshot=JSON.stringify(pending);cloudflareSummary(pending,start);canRequestProvider(pending,route,'design',start);assert.equal(JSON.stringify(pending),snapshot,'status reads do not change quotas');

// Old allowance resets and missing request records cannot silently grant credit.
const legacy=record();legacy.ai.calls=12;legacy.allowanceResets={old:{date,previous:{household:{calls:42}}}};
initializeCloudflareBudget(legacy,start);assert.equal(cloudflareDay(legacy,start).legacyUntrackedCalls,54);
assert(!canRequestProvider(legacy,route,'action',start+23*3600000));
assert(canRequestProvider(legacy,route,'action',start+86400000),'clean next UTC day opens naturally');
assert.equal(initializeCloudflareBudget(legacy,start),false,'restarts do not repeat migration');

const known=record();known.ai.calls=1;known.providerUsage={records:[{date,provider:'cloudflare',model:CF_MODEL,kind:'action',householdId:route.householdId,inputTokens:1000,outputTokens:90}]};
initializeCloudflareBudget(known,start);assert.equal(cloudflareDay(known,start).reportedNeurons,tokenNeurons(1000,90));
assert.equal(cloudflareDay(known,start).legacyUntrackedCalls,0);

// Bounded diagnostic retention never grants spending credit. Tiny responses
// exercise >400 requests cheaply; this does not change the real cadence.
const many=record();initializeCloudflareBudget(many,start);
for(let i=0;i<430;i++){
 const entry=reserveProvider(many,person,route,'action',payload('action'),start+20*3600000);
 assert(entry);success(many,entry,'action',1,1);
}
assert.equal(many.providerUsage.records.length,400);
assert.equal(cloudflareDay(many,start).calls,430);
assert(Math.abs(cloudflareDay(many,start).reportedNeurons-430*tokenNeurons(1,1))<1e-6);

// A result crossing midnight settles only the day that reserved it.
const midnight=record();initializeCloudflareBudget(midnight,start);
const late=reserveProvider(midnight,person,route,'action',payload('action'),start+86399000);
const next=reserveProvider(midnight,person,route,'action',payload('action'),start+86400000);
assert(late&&next);const nextHeld=cloudflareDay(midnight,start+86400000).reservedNeurons;
success(midnight,late,'action');assert.equal(cloudflareDay(midnight,start+86400000).reservedNeurons,nextHeld);

// Token bounds fail closed; an implausible provider response is fully charged.
const mismatch=record();initializeCloudflareBudget(mismatch,start);
const bound=reserveProvider(mismatch,person,route,'action',payload('action'),start);
success(mismatch,bound,'action',bound.inputTokenBound+1,180);
assert.equal(canRequestProvider(mismatch,route,'action',start),false);
assert.equal(reserveProvider(record(),person,route,'design',{messages:[],max_tokens:999999},start),null);
assert.equal(canRequestProvider(record(),{...route,model:'unknown-model'},'action',start),false);

// Llama consumption does not spend OpenAI dollars or disable its household.
const openai={provider:'openai',configured:true,model:'configured-openai',householdId:'willow-basin',dailyUsd:.1,inputRate:.2,outputRate:1.2};
r.ai.households['willow-basin']={calls:0,designCalls:0};
assert(canRequestProvider(r,openai,'action',start+86399000));
assert(reserveProvider(r,person,openai,'action',payload('action'),start+86399000));
r.providerUsage.days[date].reservedUsd=.1;
assert(!canRequestProvider(r,openai,'action',start+86399000));
console.log('PASS paced free allowance, action/design balance, durable pending costs, idempotency, legacy migration, midnight settlement, bounds, and independent paid limits');
