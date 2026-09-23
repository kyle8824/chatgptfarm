const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function modelName(model){
 if(model==='@cf/meta/llama-3.3-70b-instruct-fp8-fast')return 'Llama 3.3 70B';
 if(model==='gpt-5.6-luna')return 'GPT-5.6 Luna';
 return model||'No model assigned';
}
export function personProvider(state,person){
 return state.runtime?.providers?.households?.find(h=>h.id===(person.householdId||'willow-basin'))||null;
}
export function providerStatus(h){
 if(!h)return 'Configuration unavailable';
 if(h.status!=='configured')return h.missingConfiguration?.includes('OPENAI_API_KEY')?'Awaiting API key':'Awaiting configuration';
 return ({daily_limit:'Daily allowance used · resets 00:00 UTC',spend_limit:'Daily spending limit reached',price_check:'Paused for pricing check'})[h.availability]||'Connected for periodic planning';
}
export function providerMarkup(state,person){
 const h=personProvider(state,person),allocation=state.runtime?.providers?.allocation;
 const source=person.task?.source==='ai'?`Current action chosen by ${modelName(person.task.model)}.`:'Current action uses autonomous behavior rules.';
 return `<section class="provider-card" aria-label="Assigned AI"><strong>${esc(h?.provider==='openai'?'OpenAI':h?.provider==='cloudflare'?'Cloudflare':'AI')} · ${esc(modelName(h?.model))}</strong><span>${esc(providerStatus(h))}</span>${h&&allocation?`<small>${h.callsToday} calls used today · ${allocation.perHousehold}/day shared by this household (${allocation.actionsPerHousehold} action + ${allocation.designPerHousehold} design).</small>`:''}<small>${esc(source)}</small></section>`;
}
