const $=s=>document.querySelector(s);
const RAW_STATE='https://raw.githubusercontent.com/kyle8824/chatgptfarm/main/world/state.json';
let world=null,selectedMemoryAgent='agent-mara',lastCanonicalLoad=0;
const POS={creek:['48%','19%'],berries:['29%','31%'],log:['59%','29%'],camp:['64%','34%'],meadow:['43%','31%'],edge:['78%','42%'],forest:['14%','38%']};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function normalize(w){
  if(!w.agents&&w.agent){
    w.agents=[w.agent,{id:'agent-ivo',name:'Ivo',position:'forest',needs:{hydration:74,hunger:68,energy:78,warmth:58},inventory:{berries:0,dryWood:0,wetWood:0,stones:0},memories:[],beliefs:{},traits:{curiosity:.58,cooperation:.76,caution:.48},currentAction:'Arriving at the basin'}];
  }
  w.relationships ||= {'agent-ivo|agent-mara':{trust:34,familiarity:12,affinity:50,lastInteraction:null,sharedMemories:0}};
  return w;
}
const relKey=(a,b)=>[a,b].sort().join('|');
const hourLabel=(h,m=0)=>`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;

async function loadCanonical(){
  const urls=[`${RAW_STATE}?t=${Date.now()}`,`./world/state.json?t=${Date.now()}`];
  for(const url of urls){
    try{
      const response=await fetch(url,{cache:'no-store'});
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      const next=normalize(await response.json());
      const changed=!world||next.meta?.tickNumber!==world.meta?.tickNumber||next.day!==world.day||next.hour!==world.hour;
      world=next;lastCanonicalLoad=Date.now();
      render(changed);
      $('#saveState').textContent='● CANONICAL WORLD LIVE';
      return;
    }catch(error){console.warn('World source unavailable',url,error)}
  }
  $('#saveState').textContent='● WORLD SYNC ERROR';
}

function needRow(name,value){const cls=value<32?'danger':value<52?'warning':'';return `<div class="need ${cls}"><label><span>${esc(name.toUpperCase())}</span><b>${Math.round(value)}%</b></label><div class="need-track"><i style="width:${Math.max(0,Math.min(100,value))}%"></i></div></div>`}
function invHTML(a){const inv=Object.entries(a.inventory||{}).filter(([,v])=>v>0);return inv.length?inv.map(([k,v])=>`<span class="inv">${esc(k.replace(/([A-Z])/g,' $1'))} ×${v}</span>`).join(''):'<span class="empty">nothing carried</span>'}
function relationshipLabel(r){if((r?.familiarity||0)<20)return'Strangers';if((r?.trust||0)>70&&(r?.familiarity||0)>65)return'Trusted partners';if((r?.familiarity||0)>55)return'Companions';if((r?.familiarity||0)>30)return'Getting acquainted';return'Familiar faces'}

function renderAgentCards(){
  $('#agentCards').innerHTML=world.agents.map((a,i)=>`<div class="panel agent-panel agent-panel-${i}"><div class="agent-head"><div class="portrait">${esc(a.name[0])}</div><div><small>AGENT ${String(i+1).padStart(2,'0')}</small><h2>${esc(a.name)}</h2><p>${esc(a.currentAction)}</p></div></div><div class="needs">${['hydration','hunger','energy','warmth'].map(k=>needRow(k,a.needs[k])).join('')}</div><div class="inventory"><small>INVENTORY</small><div>${invHTML(a)}</div></div></div>`).join('');
}

function renderRelationship(){
  const [a,b]=world.agents,r=world.relationships[relKey(a.id,b.id)]||{trust:0,familiarity:0,affinity:50,sharedMemories:0};
  const label=relationshipLabel(r);$('#relationshipSummary').textContent=label;$('#relationshipChip').textContent=label.toUpperCase();
  $('#relationshipBody').innerHTML=[['Trust',r.trust],['Familiarity',r.familiarity],['Affinity',r.affinity]].map(([n,v])=>`<div class="rel-row"><label><span>${n}</span><b>${Math.round(v)}%</b></label><div class="rel-track"><i style="width:${Math.max(0,Math.min(100,v))}%"></i></div></div>`).join('')+`<div class="shared-knowledge"><b>${r.sharedMemories||0}</b><span>memories deliberately shared</span></div>`;
}

function renderMemories(){
  const a=world.agents.find(x=>x.id===selectedMemoryAgent)||world.agents[0];
  $('#memoryTitle').textContent=`What ${a.name} remembers`;
  $('#memoryMara').classList.toggle('active',a.id==='agent-mara');$('#memoryIvo').classList.toggle('active',a.id==='agent-ivo');
  $('#memories').innerHTML=a.memories?.length?a.memories.slice(0,16).map(m=>`<article class="memory"><b>${esc(m.id)}</b><p>${esc(m.text)}</p><footer><span>${esc(m.source)}</span><span class="confidence">${Math.round((m.confidence||0)*100)}% confidence</span></footer></article>`).join(''):`<div class="dna-empty">${esc(a.name)} has not formed a persistent memory yet.</div>`;
}

function renderHistory(){
  $('#eventCount').textContent=`${world.history.length} events`;
  $('#timeline').innerHTML=world.history.length?world.history.slice(0,45).map(e=>`<article class="event ${e.type==='social'?'social-event':''}"><time>D${e.day} · ${hourLabel(e.hour)}</time><div><b class="${e.type==='learn'?'learn':e.type==='social'?'social-title':''}">${esc(e.title)}</b><p>${esc(e.detail)}</p></div></article>`).join(''):'<div class="dna-empty">The canonical world has no history yet.</div>';
}

function renderDNA(){
  const dna=world.dna?.[0],el=$('#dnaInspector');
  if(!dna){el.innerHTML='<div class="dna-empty">Waiting for the first canonical Decision DNA trace.</div>';return}
  const fs=[...(dna.factors||[])].sort((a,b)=>Math.abs(b[1])-Math.abs(a[1])),max=Math.max(1,...fs.map(x=>Math.abs(x[1])));
  const cfs=(dna.memory_counterfactuals||[]).filter(x=>x.action_changed||Math.abs(x.score_delta)>.01).sort((a,b)=>Number(b.action_changed)-Number(a.action_changed)||Math.abs(b.score_delta)-Math.abs(a.score_delta)).slice(0,5);
  el.innerHTML=`<div class="dna-action"><small>${esc(dna.agent_name||dna.agent_id)} · DECISION</small><strong>${esc(dna.action_label)}</strong><code>${esc(dna.decision_id)}</code></div><div class="dna-factors">${fs.map(([name,v])=>`<div class="factor"><div class="factor-head"><span>${esc(name)}</span><b>${v>=0?'+':''}${(+v).toFixed(1)}</b></div><div class="factor-track"><i style="width:${Math.abs(v)/max*100}%"></i></div></div>`).join('')}</div><div class="cf-box"><small>COUNTERFACTUAL MEMORY TEST</small>${cfs.length?cfs.map(c=>`<div class="cf"><code>− ${esc(c.removed_memory)}</code><span>${esc(c.original_action)} → <b class="${c.action_changed?'flip':''}">${esc(c.counterfactual_action)}</b></span></div>`).join(''):'<div class="cf"><span>No single stored memory changed this action by itself.</span></div>'}</div>`;
}

function renderGuardian(){
  const analyses=world.agents.map(a=>{const dna=world.dna.find(d=>d.agent_id===a.id);if(!dna)return null;const pivotal=(dna.memory_counterfactuals||[]).filter(x=>x.action_changed);const strongest=[...(dna.memory_counterfactuals||[])].sort((x,y)=>Math.abs(y.score_delta)-Math.abs(x.score_delta))[0];return{a,dna,pivotal,strongest}}).filter(Boolean);
  if(!analyses.length){$('#guardianStatus').textContent='Guardian is observing. It needs behavioral history before it can diagnose the agents.';return}
  const bits=analyses.map(x=>{if(x.pivotal.length)return `${x.a.name}: ${x.pivotal[0].removed_memory} is pivotal — removing it changes ${x.dna.action} to ${x.pivotal[0].counterfactual_action}.`;if(x.strongest&&Math.abs(x.strongest.score_delta)>.01)return `${x.a.name}: ${x.strongest.removed_memory} currently has the strongest measured memory effect (Δ ${x.strongest.score_delta.toFixed(2)}).`;return `${x.a.name}: the latest choice is being driven mainly by current needs rather than one stored memory.`});
  const r=world.relationships[relKey(world.agents[0].id,world.agents[1].id)];
  $('#guardianStatus').textContent=`${bits.join(' ')} Relationship: ${relationshipLabel(r).toLowerCase()}, trust ${Math.round(r.trust)}%.`;
}

function positionAgents(){
  world.agents.forEach((a,i)=>{const el=$(i===0?'#maraSprite':'#ivoSprite');let pos=POS[a.position]||POS.meadow;let left=parseFloat(pos[0]),bottom=parseFloat(pos[1]);if(i===1&&world.agents[0].position===a.position){left+=3;bottom+=1}el.style.left=`${left}%`;el.style.bottom=`${bottom}%`;el.dataset.action=a.currentAction||'';});
}

function render(changed=false){
  if(!world)return;
  $('#weatherLabel').textContent=`${world.temperature}°F · ${world.weather[0].toUpperCase()+world.weather.slice(1)}`;
  $('#tickCount').textContent=world.meta?.tickNumber||0;$('#worldAge').textContent=`Day ${world.day}`;
  $('#shelter').classList.toggle('hidden',!world.structures?.shelter);$('#fire').classList.toggle('hidden',!world.structures?.fire);$('#cache').classList.toggle('hidden',!world.structures?.cache);
  document.querySelector('.world').style.filter=world.hour<6||world.hour>20?'brightness(.58) saturate(.75)':world.weather==='rain'?'brightness(.82) saturate(.75)':'';
  const latest=world.history?.[0];$('#worldCaption').textContent=latest?.detail||'Mara and Ivo are taking in Willow Basin.';
  renderAgentCards();renderRelationship();renderMemories();renderHistory();renderDNA();renderGuardian();positionAgents();
  const advanced=world.meta?.lastAdvancedAt?new Date(world.meta.lastAdvancedAt):null;$('#lastAdvanced').textContent=advanced?`Last canonical heartbeat ${advanced.toLocaleTimeString([], {hour:'numeric',minute:'2-digit',second:'2-digit'})}`:'Awaiting first canonical heartbeat';
  if(changed){document.body.classList.add('world-updated');setTimeout(()=>document.body.classList.remove('world-updated'),1200)}
}

function updateProjectedClock(){
  if(!world)return;
  const advanced=world.meta?.lastAdvancedAt?new Date(world.meta.lastAdvancedAt).getTime():Date.now();
  const elapsed=Math.max(0,Date.now()-advanced),period=(world.meta?.heartbeatMinutes||5)*60000;
  const projectedMinutes=Math.min(59,Math.floor((elapsed/period)*60));
  $('#dayLabel').textContent=`Day ${world.day} · ${hourLabel(world.hour,projectedMinutes)}`;
  const remaining=Math.max(0,period-elapsed),mins=Math.floor(remaining/60000),secs=Math.floor((remaining%60000)/1000);
  $('#heartbeatLabel').textContent=elapsed>period?'Canonical heartbeat due now':`Next canonical heartbeat ~${mins}:${String(secs).padStart(2,'0')}`;
}

function breathe(){
  if(!world)return;
  const t=Date.now()/1000;
  world.agents.forEach((a,i)=>{const el=$(i===0?'#maraSprite':'#ivoSprite');const base=POS[a.position]||POS.meadow;let x=parseFloat(base[0]),y=parseFloat(base[1]);if(i===1&&world.agents[0].position===a.position)x+=3;const amp=/Rest/i.test(a.currentAction)?0.15:0.7;x+=Math.sin(t*.55+i*2.1)*amp;y+=Math.cos(t*.42+i)*amp*.35;el.style.left=`${x}%`;el.style.bottom=`${y}%`;});
}

$('#memoryMara').addEventListener('click',()=>{selectedMemoryAgent='agent-mara';renderMemories()});
$('#memoryIvo').addEventListener('click',()=>{selectedMemoryAgent='agent-ivo';renderMemories()});
loadCanonical();setInterval(loadCanonical,20000);setInterval(updateProjectedClock,1000);setInterval(breathe,900);
