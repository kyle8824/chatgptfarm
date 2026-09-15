const $=s=>document.querySelector(s);
const RAW_STATE='https://raw.githubusercontent.com/kyle8824/chatgptfarm/main/world/state.json';
let world=null,selectedMemoryAgent='agent-mara',lastDiscoveryCount=0;
const POS={creek:['48%','19%'],berries:['29%','31%'],log:['59%','29%'],camp:['64%','34%'],meadow:['43%','31%'],edge:['78%','42%'],forest:['14%','38%'],stones:['73%','24%'],clay:['86%','21%'],reeds:['10%','22%']};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function normalize(w){
  if(!w.agents&&w.agent){
    w.agents=[w.agent,{id:'agent-ivo',name:'Ivo',position:'forest',needs:{hydration:74,hunger:68,energy:78,warmth:58},inventory:{},memories:[],beliefs:{},traits:{curiosity:.62,cooperation:.77,caution:.46},skills:{},experiments:{},currentAction:'Arriving at the basin'}];
  }
  w.relationships ||= {'agent-ivo|agent-mara':{trust:34,familiarity:12,affinity:50,lastInteraction:null,sharedMemories:0,techniquesShared:0}};
  w.discoveries ||= [];
  w.discovered ||= {};
  w.structures ||= {};
  for(const a of w.agents||[]){a.skills||={};a.experiments||={};a.inventory||={};a.memories||=[]}
  return w;
}
const relKey=(a,b)=>[a,b].sort().join('|');
const hourLabel=(h,m=0)=>`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
const skillName=s=>s.replaceAll('-',' ').replace(/\b\w/g,c=>c.toUpperCase());

async function loadCanonical(){
  const urls=[`${RAW_STATE}?t=${Date.now()}`,`./world/state.json?t=${Date.now()}`];
  for(const url of urls){
    try{
      const response=await fetch(url,{cache:'no-store'});
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      const next=normalize(await response.json());
      const changed=!world||next.meta?.tickNumber!==world.meta?.tickNumber||next.day!==world.day||next.hour!==world.hour;
      const newDiscovery=world&&next.discoveries.length>lastDiscoveryCount;
      world=next;lastDiscoveryCount=world.discoveries.length;
      render(changed,newDiscovery);
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
  $('#agentCards').innerHTML=world.agents.map((a,i)=>{
    const skills=Object.keys(a.skills||{}).filter(k=>(a.skills[k]||0)>0);
    const experiments=Object.entries(a.experiments||{}).filter(([,v])=>v>0&&!skills.some(s=>s.includes('sharp')&&arguments[0])).slice(-3);
    const skillHTML=skills.length?skills.map(s=>`<span class="skill">${esc(skillName(s))}</span>`).join(''):'<span class="empty">no techniques yet</span>';
    const expHTML=Object.entries(a.experiments||{}).filter(([,v])=>v>0).slice(-3).map(([k,v])=>`<span class="skill experiment">${esc(skillName(k))} · ${v} attempt${v===1?'':'s'}</span>`).join('');
    return `<div class="panel agent-panel agent-panel-${i}"><div class="agent-head"><div class="portrait">${esc(a.name[0])}</div><div><small>AGENT ${String(i+1).padStart(2,'0')}</small><h2>${esc(a.name)}</h2><p>${esc(a.currentAction)}</p></div></div><div class="needs">${['hydration','hunger','energy','warmth'].map(k=>needRow(k,a.needs[k])).join('')}</div><div class="inventory"><small>INVENTORY</small><div>${invHTML(a)}</div></div><div class="inventory"><small>LEARNED TECHNIQUES</small><div class="skill-strip">${skillHTML}</div>${expHTML?`<div class="skill-strip">${expHTML}</div>`:''}</div></div>`;
  }).join('');
}

function renderRelationship(){
  const [a,b]=world.agents,r=world.relationships[relKey(a.id,b.id)]||{trust:0,familiarity:0,affinity:50,sharedMemories:0,techniquesShared:0};
  const label=relationshipLabel(r);$('#relationshipSummary').textContent=label;$('#relationshipChip').textContent=label.toUpperCase();
  $('#relationshipBody').innerHTML=[['Trust',r.trust],['Familiarity',r.familiarity],['Affinity',r.affinity]].map(([n,v])=>`<div class="rel-row"><label><span>${n}</span><b>${Math.round(v)}%</b></label><div class="rel-track"><i style="width:${Math.max(0,Math.min(100,v))}%"></i></div></div>`).join('')+`<div class="shared-knowledge"><b>${r.sharedMemories||0}</b><span>memories shared</span></div><div class="shared-knowledge"><b>${r.techniquesShared||0}</b><span>techniques taught</span></div>`;
}

function renderDiscoveries(){
  $('#discoveryCount').textContent=`${world.discoveries.length} discover${world.discoveries.length===1?'y':'ies'}`;
  $('#discoveries').innerHTML=world.discoveries.length?world.discoveries.slice(0,6).map(d=>`<article class="discovery"><header><h3>${esc(d.title)}</h3><code>${esc(d.id)}</code></header><p>${esc(d.detail)}</p><footer><span>Day ${d.day} · ${hourLabel(d.hour)} · ${esc(d.firstAgentName)}</span><span class="discovery-effect">${esc(d.effect)}</span></footer></article>`).join(''):'<div class="discovery-empty">Nothing has been invented yet. The first breakthrough must emerge from experimentation.</div>';
}

function renderFrontier(){
  const rows=[
    ['●','Willow Basin','Creek, berries, fallen wood and stone field',true],
    ['◒','Eastern clay bank','Sticky clay exposed by the creek',!!world.discovered.clayBank],
    ['≋','Western reed marsh','Flexible reeds, marsh and animal traces',!!world.discovered.reedBed],
    ['?','Beyond the basin','Unknown territory',false]
  ];
  $('#frontier').innerHTML=rows.map(([icon,title,copy,known])=>`<div class="frontier-row ${known?'':'unknown'}"><div class="frontier-icon">${icon}</div><div class="frontier-copy"><b>${esc(known?title:'Unknown')}</b><small>${esc(known?copy:'Not yet explored')}</small></div></div>`).join('');
}

function renderMemories(){
  const a=world.agents.find(x=>x.id===selectedMemoryAgent)||world.agents[0];
  $('#memoryTitle').textContent=`What ${a.name} remembers`;
  $('#memoryMara').classList.toggle('active',a.id==='agent-mara');$('#memoryIvo').classList.toggle('active',a.id==='agent-ivo');
  $('#memories').innerHTML=a.memories?.length?a.memories.slice(0,18).map(m=>`<article class="memory"><b>${esc(m.id)}</b><p>${esc(m.text)}</p><footer><span>${esc(m.source)}</span><span class="confidence">${Math.round((m.confidence||0)*100)}% confidence</span></footer></article>`).join(''):`<div class="dna-empty">${esc(a.name)} has not formed a persistent memory yet.</div>`;
}

function renderHistory(){
  $('#eventCount').textContent=`${world.history.length} events`;
  $('#timeline').innerHTML=world.history.length?world.history.slice(0,55).map(e=>{
    const cls=e.type==='discovery'?'discovery-event':e.type==='social'||e.type==='culture'?'social-event':'';
    const titleCls=e.type==='learn'?'learn':e.type==='discovery'?'discovery-title':e.type==='social'||e.type==='culture'?'culture-title':'';
    return `<article class="event ${cls}"><time>D${e.day} · ${hourLabel(e.hour)}</time><div><b class="${titleCls}">${esc(e.title)}</b><p>${esc(e.detail)}</p></div></article>`;
  }).join(''):'<div class="dna-empty">The canonical world has no history yet.</div>';
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
  const bits=analyses.map(x=>{if(x.pivotal.length)return `${x.a.name}: ${x.pivotal[0].removed_memory} is pivotal — removing it changes ${x.dna.action} to ${x.pivotal[0].counterfactual_action}.`;if(x.strongest&&Math.abs(x.strongest.score_delta)>.01)return `${x.a.name}: ${x.strongest.removed_memory} has the strongest measured memory effect (Δ ${x.strongest.score_delta.toFixed(2)}).`;return `${x.a.name}: the latest choice is being driven mainly by current conditions.`});
  const latestDiscovery=world.discoveries?.[0];
  const discoveryRead=latestDiscovery?` Latest world-first: ${latestDiscovery.firstAgentName} discovered ${latestDiscovery.title.toLowerCase()} on Day ${latestDiscovery.day}.`:'';
  $('#guardianStatus').textContent=`${bits.join(' ')}${discoveryRead}`;
}

function positionAgents(){world.agents.forEach((a,i)=>{const el=$(i===0?'#maraSprite':'#ivoSprite');let pos=POS[a.position]||POS.meadow;let left=parseFloat(pos[0]),bottom=parseFloat(pos[1]);if(i===1&&world.agents[0].position===a.position){left+=3;bottom+=1}el.style.left=`${left}%`;el.style.bottom=`${bottom}%`;el.dataset.action=a.currentAction||''})}

function render(changed=false,newDiscovery=false){
  if(!world)return;
  $('#weatherLabel').textContent=`${world.temperature}°F · ${world.weather[0].toUpperCase()+world.weather.slice(1)}`;
  $('#tickCount').textContent=world.meta?.tickNumber||0;$('#worldAge').textContent=`Day ${world.day}`;
  $('#shelter').classList.toggle('hidden',!world.structures?.shelter);$('#fire').classList.toggle('hidden',!world.structures?.fire);$('#cache').classList.toggle('hidden',!world.structures?.cache);$('#dryingRack').classList.toggle('hidden',!world.structures?.dryingRack);
  $('#clayBank').classList.toggle('hidden',!world.discovered?.clayBank);$('#reedBed').classList.toggle('hidden',!world.discovered?.reedBed);
  document.querySelector('.world').style.filter=world.hour<6||world.hour>20?'brightness(.58) saturate(.75)':world.weather==='rain'?'brightness(.82) saturate(.75)':'';
  const latest=world.history?.[0];$('#worldCaption').textContent=latest?.detail||'Mara and Ivo are taking in Willow Basin.';
  renderAgentCards();renderRelationship();renderDiscoveries();renderFrontier();renderMemories();renderHistory();renderDNA();renderGuardian();positionAgents();
  const advanced=world.meta?.lastAdvancedAt?new Date(world.meta.lastAdvancedAt):null;$('#lastAdvanced').textContent=advanced?`Last canonical heartbeat ${advanced.toLocaleTimeString([], {hour:'numeric',minute:'2-digit',second:'2-digit'})}`:'Awaiting first canonical heartbeat';
  if(changed){document.body.classList.add('world-updated');setTimeout(()=>document.body.classList.remove('world-updated'),1200)}
  if(newDiscovery){$('#discoveryPanel').classList.add('milestone-flash');setTimeout(()=>$('#discoveryPanel').classList.remove('milestone-flash'),1800)}
}

function updateProjectedClock(){
  if(!world)return;
  const advanced=world.meta?.lastAdvancedAt?new Date(world.meta.lastAdvancedAt).getTime():Date.now(),elapsed=Math.max(0,Date.now()-advanced),period=(world.meta?.heartbeatMinutes||5)*60000;
  const projectedMinutes=Math.min(59,Math.floor((elapsed/period)*60));$('#dayLabel').textContent=`Day ${world.day} · ${hourLabel(world.hour,projectedMinutes)}`;
  const remaining=Math.max(0,period-elapsed),mins=Math.floor(remaining/60000),secs=Math.floor((remaining%60000)/1000);$('#heartbeatLabel').textContent=elapsed>period?'Canonical heartbeat due now':`Next canonical heartbeat ~${mins}:${String(secs).padStart(2,'0')}`;
}

function breathe(){
  if(!world)return;const t=Date.now()/1000;
  world.agents.forEach((a,i)=>{const el=$(i===0?'#maraSprite':'#ivoSprite'),base=POS[a.position]||POS.meadow;let x=parseFloat(base[0]),y=parseFloat(base[1]);if(i===1&&world.agents[0].position===a.position)x+=3;const amp=/Rest/i.test(a.currentAction)?0.15:0.7;x+=Math.sin(t*.55+i*2.1)*amp;y+=Math.cos(t*.42+i)*amp*.35;el.style.left=`${x}%`;el.style.bottom=`${y}%`})
}

$('#memoryMara').addEventListener('click',()=>{selectedMemoryAgent='agent-mara';renderMemories()});
$('#memoryIvo').addEventListener('click',()=>{selectedMemoryAgent='agent-ivo';renderMemories()});
loadCanonical();setInterval(loadCanonical,15000);setInterval(updateProjectedClock,1000);setInterval(breathe,900);
