(() => {
  const RAW_STATE = 'https://raw.githubusercontent.com/kyle8824/chatgptfarm/main/world/state.json';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const css = document.createElement('style');
  css.textContent = `
    .mind-observatory{margin:0 0 18px;border:1px solid #334b38;border-radius:14px;background:radial-gradient(circle at 8% 0,#22372777,transparent 30%),#111a13;overflow:hidden}
    .mind-head{display:flex;justify-content:space-between;gap:20px;align-items:center;padding:17px 20px;border-bottom:1px solid var(--line)}.mind-head small{display:block;font:10px var(--mono);color:var(--muted)}.mind-head h2{margin:3px 0 0;font-size:19px}.mind-mode{font:10px var(--mono);padding:6px 9px;border:1px solid #4d664f;border-radius:99px;color:#bfe58f;white-space:nowrap}.mind-mode.fallback{color:#d7bb76;border-color:#665737}.mind-grid{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--line)}.mind-card{background:#121b14;padding:18px 20px;min-width:0}.mind-agent{display:flex;justify-content:space-between;gap:12px;align-items:start;margin-bottom:13px}.mind-agent h3{margin:0;font-size:18px}.mind-brain{font:9px var(--mono);color:#a8b6a4}.mind-field{margin:11px 0}.mind-field label{display:block;font:9px var(--mono);letter-spacing:.08em;color:#758578;margin-bottom:4px}.mind-field p{margin:0;font-size:12px;color:#c1cbc0;line-height:1.45}.mind-summary{color:#99a698!important}.mind-foot{display:flex;flex-wrap:wrap;gap:7px;margin-top:14px}.mind-chip{font:9px var(--mono);padding:4px 6px;border:1px solid #334537;border-radius:6px;color:#8fa08e}.mind-chip.override{color:#e2c96f;border-color:#66592e;background:#2c271533}.mind-chip.ai{color:#bfe58f;border-color:#496447}.mind-key-note{padding:10px 20px;border-top:1px solid var(--line);font:10px var(--mono);color:#7f8d7e;background:#0f1711}.mind-key-note b{color:#cbb77b}.belief-list{display:flex;gap:5px;flex-wrap:wrap}.belief{font:9px var(--mono);border:1px solid #3d4f40;padding:4px 6px;border-radius:99px;color:#9fb09e}
    @media(max-width:760px){.mind-grid{grid-template-columns:1fr}.mind-head{align-items:flex-start;flex-direction:column}}
  `;
  document.head.appendChild(css);

  const section = document.createElement('section');
  section.id = 'mindObservatory';
  section.className = 'mind-observatory';
  section.innerHTML = '<div class="mind-head"><div><small>INTELLIGENCE LAYER</small><h2>Mind Observatory</h2></div><span class="mind-mode fallback">CONNECTING</span></div><div class="mind-key-note">Loading canonical mind state…</div>';
  const status = document.querySelector('.world-status');
  if (status) status.insertAdjacentElement('afterend', section);
  else document.querySelector('main')?.prepend(section);

  function latestDNA(world, agentId){ return (world.dna || []).find(d => d.agent_id === agentId); }
  function beliefHTML(agent){
    const entries = Object.entries(agent.beliefs || {}).slice(-3);
    return entries.length ? `<div class="belief-list">${entries.map(([k,v])=>`<span class="belief" title="${esc(v)}">${esc(k.replaceAll('-',' '))}</span>`).join('')}</div>` : '<span class="mind-chip">no reflections yet</span>';
  }
  function render(world){
    const aiLive = world.meta?.mindMode === 'ai';
    const configured = !!world.meta?.mindConfigured;
    const modeText = aiLive ? `AI MIND LIVE · ${world.meta?.mindModel || 'MODEL'}` : configured ? 'MIXED / FALLBACK' : 'FALLBACK · API KEY NOT CONNECTED';
    const cards = (world.agents || []).map(agent => {
      const mind = agent.mind || {}, dna = latestDNA(world, agent.id), rank = dna?.utility_rank || 1;
      const brain = mind.brainMode === 'ai' ? (mind.model || 'AI') : 'deterministic fallback';
      const refs = mind.lastReferencedMemoryIds || [];
      return `<article class="mind-card"><div class="mind-agent"><div><h3>${esc(agent.name)}</h3><span class="mind-brain">${esc(brain)}</span></div><span class="mind-chip ${mind.brainMode==='ai'?'ai':''}">${mind.brainMode==='ai'?'MODEL DRIVEN':'FALLBACK'}</span></div><div class="mind-field"><label>CURRENT GOAL</label><p>${esc(mind.currentGoal || 'Respond to the immediate world')}</p></div><div class="mind-field"><label>INTENT</label><p>${esc(mind.intent || agent.currentAction || 'Observe')}</p></div><div class="mind-field"><label>EXPLICIT DECISION SUMMARY</label><p class="mind-summary">${esc(mind.decisionSummary || 'No model-authored decision has been recorded yet.')}</p></div><div class="mind-field"><label>BELIEFS / REFLECTIONS</label>${beliefHTML(agent)}</div><div class="mind-foot"><span class="mind-chip">confidence ${Math.round((mind.confidence || 0)*100)}%</span><span class="mind-chip">${refs.length} memories referenced</span>${rank>1?`<span class="mind-chip override">AI OVERRULED UTILITY · rank #${rank}</span>`:`<span class="mind-chip">utility rank #${rank}</span>`}</div></article>`;
    }).join('');
    const totalAI = world.meta?.aiDecisions || 0, totalFallback = world.meta?.fallbackDecisions || 0;
    section.innerHTML = `<div class="mind-head"><div><small>INTELLIGENCE LAYER · BOUNDED BY WORLD PHYSICS</small><h2>Mind Observatory</h2></div><span class="mind-mode ${aiLive?'':'fallback'}">${esc(modeText)}</span></div><div class="mind-grid">${cards}</div><div class="mind-key-note">${configured ? `<b>${totalAI}</b> model decisions · ${totalFallback} fallback decisions. The model chooses only from physically valid affordances; the world engine resolves consequences.` : `The v0.4 intelligence layer is deployed, but the autonomous runner has no <b>OPENAI_API_KEY</b> secret yet. The world stays alive on its deterministic fallback brain until one is added.`}</div>`;
  }

  async function refresh(){
    try{
      const r = await fetch(`${RAW_STATE}?mind=${Date.now()}`, {cache:'no-store'});
      if(!r.ok) throw new Error(`HTTP ${r.status}`);
      render(await r.json());
    }catch(err){
      const note = section.querySelector('.mind-key-note');
      if(note) note.textContent = `Mind state sync error: ${err.message}`;
    }
  }
  refresh();
  setInterval(refresh, 20000);
})();
