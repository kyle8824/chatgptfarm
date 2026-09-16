(()=>{
const RAW='https://raw.githubusercontent.com/kyle8824/chatgptfarm/main/world/state.json';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const known=(w,o)=>o.type==='clay_bank'?!!w.discovered?.clayBank:o.type==='reed_marsh'?!!w.discovered?.reedBed:o.type==='frontier'?false:true;
const renderable=o=>o?.state?.active!==false&&['camp_area','creek_segment','berry_patch','fallen_tree','stone_field','clay_bank','reed_marsh','frontier'].includes(o.type);
const componentRenderable=o=>o?.state?.active!==false&&o.parentId&&['branch','rock','berry_bush','clay_deposit','reed_stand'].includes(o.type);
function render(w){const root=document.querySelector('#worldPlaces');if(!root||!w.worldModel?.objects)return;const major=w.worldModel.objects.filter(renderable),parts=w.worldModel.objects.filter(componentRenderable);root.innerHTML=major.map(o=>{const p=o.position||{x:50,y:50},k=known(w,o);return `<div class="world-entity entity-${esc(o.type)} ${k?'':'unknown'}" data-world-object="${esc(o.id)}" style="left:${p.x}%;bottom:${p.y}%">${o.type==='frontier'?'':`<span class="entity-label">${esc(k?o.label:'unknown')}</span>`}</div>`}).join('')+parts.map(o=>{const p=o.position||{x:50,y:50};return `<div class="world-component component-${esc(o.type)}" data-world-object="${esc(o.id)}" title="${esc(o.label)}" style="left:${p.x}%;bottom:${p.y}%"></div>`}).join('');
const badge=document.querySelector('#worldMode');if(badge)badge.innerHTML=`<span class="world-model-badge"><b>OBJECT WORLD</b> · ${esc(w.worldModel.version)}</span>`;
const creek=document.querySelector('.terrain-creek'),creekObj=w.worldModel.objects.find(o=>o.type==='creek_segment');if(creek&&creekObj){const depth=w.worldModel.fields?.waterDepth?.objects?.[creekObj.id];creek.style.opacity=depth!=null?String(Math.min(1,.72+depth*.25)):'1'}
}
async function refresh(){try{const r=await fetch(`${RAW}?worldmodel=${Date.now()}`,{cache:'no-store'});if(!r.ok)throw new Error(`HTTP ${r.status}`);render(await r.json())}catch(e){console.warn('World model renderer sync failed',e)}}
const root=document.querySelector('#worldPlaces');if(root){const observer=new MutationObserver(()=>{if(root.querySelector('.world-place'))setTimeout(refresh,0)});observer.observe(root,{childList:true})}
refresh();setInterval(refresh,12000);
})();