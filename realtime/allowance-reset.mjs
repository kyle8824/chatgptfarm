// Kyle explicitly requested this one-time reset after connecting OpenAI.
// The deployment flag authorizes only this existing world, pair and UTC day.
export const OPENAI_RESET_ID='2026-09-23-willow-openai-debug-1';
export function applyAuthorizedAllowanceReset(record,env,now){
 if(env.OPENAI_ALLOWANCE_RESET!==OPENAI_RESET_ID||record.allowanceResets?.[OPENAI_RESET_ID])return false;
 const date=new Date(now).toISOString().slice(0,10),householdId='willow-basin';
 if(date!=='2026-09-23'||record.createdAt!==1790030005263||record.ai.date!==date||record.designBudget?.date!==date)return false;
 const people=record.world.agents.filter(a=>a.householdId===householdId);
 if(people.length!==2||!people.some(a=>a.id==='agent-mara')||!people.some(a=>a.id==='agent-ivo'))return false;
 const used=record.ai.households?.[householdId];
 if(!used||!Number.isSafeInteger(used.calls)||!Number.isSafeInteger(used.designCalls)||used.calls<used.designCalls||used.designCalls<0)return false;
 const designs=record.designBudget?.date===date?record.designBudget.calls:0;
 if(record.ai.calls<used.calls||designs<used.designCalls)return false;
 const timers=Object.fromEntries(people.map(a=>[a.id,{action:record.lastDecisionAt?.[a.id]??null,design:record.lastDesignAt?.[a.id]??null}]));
 const audit={id:OPENAI_RESET_ID,date,at:now,householdId,people:people.map(a=>a.id),previous:{household:{...used},globalCalls:record.ai.calls,globalDesigns:designs,timers},reason:'Owner requested fresh OpenAI action/design allowance for Mara and Ivo to debug live progression.'};
 record.ai.calls-=used.calls;record.designBudget.calls-=used.designCalls;
 record.ai.households[householdId]={calls:0,designCalls:0};
 for(const a of people){if(record.lastDecisionAt)delete record.lastDecisionAt[a.id];if(record.lastDesignAt)delete record.lastDesignAt[a.id];}
 // Dollar reservations, token/call history, failures, pending work, needs and
 // the simulated clock are intentionally untouched. Save before any request.
 (record.allowanceResets??={})[OPENAI_RESET_ID]=audit;
 return true;
}
