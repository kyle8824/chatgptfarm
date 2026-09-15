const $=s=>document.querySelector(s);
let world=null;
let lastLoad=0;

const hour=h=>String(h).padStart(2,'0')+':00';

function needRow(name,value){
  const cls=value<32?'danger':value<52?'warning':'';
  return `<div class="need ${cls}"><label><span>${name.toUpperCase()}</span><b>${Math.round(value)}%</b></label><div class="need-track"><i style="width:${value}%"></i></div></div>`;
}

async function loadCanonical(){
  try{
    const response=await fetch(`./world/state.json?t=${Date.now()}`,{cache:'no-store'});
    if(!response.ok) throw new Error(`HTTP ${response.status}`);
    world=await response.json();
    lastLoad=Date.now();
    render();
    $('#saveState').textContent='● CANONICAL WORLD LIVE';
    $('#saveState').title='This is the shared world state. It advances automatically from GitHub Actions.';
  }catch(error){
    console.error('Unable to load canonical world',error);
    $('#saveState').textContent='● WORLD SYNC ERROR';
  }
}

function renderGuardian(){
  const el=$('#guardianStatus');
  if(!el||!world) return;
  const dna=world.dna?.[0];
  const memories=world.agent?.memories||[];
  if(!dna){
    el.innerHTML='<b>Guardian is observing.</b><span>It needs behavioral history before it can diagnose drift.</span>';
    return;
  }
  const pivotal=(dna.memory_counterfactuals||[]).filter(x=>x.action_changed);
  const strongest=[...(dna.memory_counterfactuals||[])].sort((a,b)=>Math.abs(b.score_delta)-Math.abs(a.score_delta))[0];
  let diagnosis='No memory currently flips the latest decision on its own.';
  if(pivotal.length){
    diagnosis=`${pivotal[0].removed_memory} is pivotal: removing it changes ${dna.action} to ${pivotal[0].counterfactual_action}.`;
  }else if(strongest&&Math.abs(strongest.score_delta)>.01){
    diagnosis=`${strongest.removed_memory} has the strongest measured memory effect on the latest action (Δ ${strongest.score_delta.toFixed(2)}).`;
  }
  el.innerHTML=`<b>Latest Guardian read</b><span>${diagnosis}</span><small>${memories.length} memories · ${world.meta?.tickNumber||0} autonomous ticks observed</small>`;
}

function render(){
  if(!world) return;
  $('#dayLabel').textContent=`Day ${world.day} · ${hour(world.hour)}`;
  $('#weatherLabel').textContent=`${world.temperature}°F · ${world.weather[0].toUpperCase()+world.weather.slice(1)}`;
  $('#currentAction').textContent=world.agent.currentAction;
  $('#needs').innerHTML=['hydration','hunger','energy','warmth'].map(k=>needRow(k,world.agent.needs[k])).join('');

  const inv=Object.entries(world.agent.inventory).filter(([,v])=>v>0);
  $('#inventory').innerHTML=inv.length?inv.map(([k,v])=>`<span class="inv">${k.replace(/([A-Z])/g,' $1')} ×${v}</span>`).join(''):`<span class="empty">nothing carried</span>`;

  $('#memoryCount').textContent=world.agent.memories.length;
  $('#memories').innerHTML=world.agent.memories.length?world.agent.memories.slice(0,12).map(m=>`<article class="memory"><b>${m.id}</b><p>${m.text}</p><footer><span>${m.source}</span><span class="confidence">${Math.round(m.confidence*100)}% confidence</span></footer></article>`).join(''):`<div class="dna-empty">Mara has not formed a persistent memory yet.</div>`;

  $('#eventCount').textContent=`${world.history.length} event${world.history.length===1?'':'s'}`;
  $('#timeline').innerHTML=world.history.length?world.history.slice(0,32).map(e=>`<article class="event"><time>D${e.day} · ${hour(e.hour)}</time><div><b class="${e.type==='learn'?'learn':''}">${e.title}</b><p>${e.detail}</p></div></article>`).join(''):`<div class="dna-empty">The canonical world has no history yet.</div>`;

  $('#shelter').classList.toggle('hidden',!world.structures.shelter);
  $('#fire').classList.toggle('hidden',!world.structures.fire);
  const pos={creek:['48%','19%'],berries:['29%','31%'],log:['59%','29%'],camp:['64%','34%'],meadow:['43%','31%'],edge:['78%','42%']}[world.agent.position]||['43%','31%'];
  $('#agentSprite').style.left=pos[0];
  $('#agentSprite').style.bottom=pos[1];
  document.querySelector('.world').style.filter=world.hour<6||world.hour>20?'brightness(.58) saturate(.75)':world.weather==='rain'?'brightness(.82) saturate(.75)':'';
  $('#worldCaption').textContent=world.history[0]?.detail||'Mara wakes beside the creek with no shelter and no stored food.';

  const dna=world.dna[0];
  if(dna){
    $('#dnaEmpty').classList.add('hidden');
    $('#dnaInspector').classList.remove('hidden');
    $('#dnaAction').textContent=dna.action_label;
    $('#dnaId').textContent=dna.decision_id;
    const fs=[...dna.factors].sort((a,b)=>Math.abs(b[1])-Math.abs(a[1]));
    const max=Math.max(1,...fs.map(x=>Math.abs(x[1])));
    $('#dnaFactors').innerHTML=fs.map(([name,v])=>`<div class="factor"><div class="factor-head"><span>${name}</span><b>${v>=0?'+':''}${(+v).toFixed(1)}</b></div><div class="factor-track"><i style="width:${Math.abs(v)/max*100}%"></i></div></div>`).join('')||`<small>No strong factors recorded.</small>`;
    const cfs=dna.memory_counterfactuals.filter(x=>x.action_changed||Math.abs(x.score_delta)>.01).slice(0,5);
    $('#counterfactuals').innerHTML=cfs.length?cfs.map(c=>`<div class="cf"><code>− ${c.removed_memory}</code><span>${c.original_action} → <b class="${c.action_changed?'flip':''}">${c.counterfactual_action}</b></span></div>`).join(''):`<div class="cf"><span>No stored memory was pivotal to this decision.</span></div>`;
  }

  const advanced=world.meta?.lastAdvancedAt?new Date(world.meta.lastAdvancedAt):null;
  const stamp=$('#lastAdvanced');
  if(stamp) stamp.textContent=advanced?`Last autonomous tick ${advanced.toLocaleString()}`:'Awaiting first autonomous tick';
  renderGuardian();
}

loadCanonical();
setInterval(loadCanonical,60000);
