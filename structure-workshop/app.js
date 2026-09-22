import example from './example.json';
import {StructureViewer} from './viewer.js';
import {WORLD_BASE,SNAPSHOT_KEY,catalogFromFrame,readCatalog,resourceRows,physicalFunctions} from './catalog.js';
import {structureSignature,makeStructureLook,readStructureLook} from '../shared/visuals/structure-appearance.js';
import {releasedStructureLook} from '../shared/visuals/structure-looks.js';
const $=s=>document.querySelector(s),all=s=>[...document.querySelectorAll(s)],esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let storage;try{storage=localStorage;}catch{}
let selectionIntent=new URL(location.href).searchParams.get('project');
let catalog=readCatalog(storage),selected=null,look=null,stage='design',viewer,mode='cached',requesting=false,codeRequest=0;
try{viewer=new StructureViewer($('#stage'));}catch(e){$('#graphics-error').hidden=false;}
const draftKey=p=>'chatgptfarm-structure-look:'+p.id,stamp=()=>catalog?new Date(catalog.savedAt).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'';
function currentProjects(){return [...(catalog?.projects||[]),example];}
function renderCatalog(){
 $('#catalog').innerHTML=currentProjects().map(p=>`<button class="design-card" data-project="${esc(p.id)}" aria-pressed="${p.id===selected?.id}"><strong>${esc(p.name)}</strong><small>${p.source==='example'?'Workshop example · not in the world':esc(p.designer)+' · '+p.parts.filter(x=>x.built).length+'/'+p.parts.length+' built'}</small></button>`).join('');
 all('[data-project]').forEach(b=>b.onclick=()=>{selectionIntent=b.dataset.project;select(selectionIntent);});
}
function select(id){
 selected=currentProjects().find(p=>p.id===id)||catalog?.projects[0]||example;codeRequest++;$('#program').open=false;$('#code').textContent='';$('#compare').checked=false;
 look={...releasedStructureLook(selected)};let hasDraft=false;
 try{const raw=storage?.getItem(draftKey(selected));if(raw){look=readStructureLook(selected,JSON.parse(raw));hasDraft=true;}}catch{}
 $('#draft-status').textContent=hasDraft?'Appearance draft restored from this device.':'Showing the released look.';
 const url=new URL(location.href);url.searchParams.set('project',selected.id);history.replaceState(null,'',url);renderCatalog();renderInfo();renderLook();redraw(true);
}
function renderInfo(){
 const p=selected,isExample=p.source==='example',done=p.parts.filter(x=>x.built).length;
 $('#name').textContent=p.name;$('#author').textContent=isExample?'AN EXAMPLE FOR EXPLORING THE WORKSHOP':'DESIGNED BY '+(p.designer||'A VILLAGER').toUpperCase();
 $('#origin').textContent=isExample?'EXAMPLE · NOT FROM THE LIVE WORLD':mode==='cached'?'SAVED WORLD DESIGN':'WORLD DESIGN · SNAPSHOT';
 $('#progress').textContent=isExample?'Illustrative build progress · '+done+' / '+p.parts.length+' pieces':`${done} / ${p.parts.length} pieces built · ${p.status==='complete'?'Complete':p.status==='planned'?'Planned':'Under construction'}`;
 $('#progress-bar').style.width=done/p.parts.length*100+'%';$('#rationale').textContent=p.rationale||'No design reason was recorded.';
 $('#function-label').textContent=p.status==='complete'&&!isExample?'Physical uses':'Expected uses when built';$('#functions').innerHTML=physicalFunctions(p).map(x=>`<li>${esc(x)}</li>`).join('');
 $('#access').textContent=p.access==='shared'?'Shared access · other villagers can use it.':'Personal property · taking supplies can affect relationships.';
 $('#feedback').textContent=isExample?'This authored example demonstrates the workshop. It is not a villager decision or a record of live construction.':p.feedback?.uses?`${p.feedback.uses} recorded uses · Last used by ${p.feedback.lastUse?.user||'a villager'}`:'No use feedback has been recorded yet.';
 $('#materials').innerHTML=resourceRows(p,isExample?[]:catalog?.stores).map(r=>`<tr><td>${esc(r.material)}</td><td>${r.required}</td><td>${r.committed}</td><td>${r.atSite}</td><td>${r.missing}</td></tr>`).join('');
 $('#parts').innerHTML=p.parts.map(x=>`<li><strong>${esc(x.id)}</strong> · ${esc(x.material)} × ${x.materialUnits}<br><span class="muted">${x.built?'Assembled':x.invested?'Being assembled':'Materials needed'}${x.requires?.length?' · after '+x.requires.map(esc).join(', '):' · on the ground'}</span></li>`).join('');
 const mins=[0,1,2].map(i=>Math.min(...p.parts.map(x=>x.center[i]-x.size[i]/2))),maxs=[0,1,2].map(i=>Math.max(...p.parts.map(x=>x.center[i]+x.size[i]/2)));$('#scale-note').textContent=(maxs[0]-mins[0]).toFixed(1)+' × '+(maxs[2]-mins[2]).toFixed(1)+' unit footprint';
}
function renderLook(){
 $('#colors').innerHTML='<legend>Material colors</legend>'+[...new Set(selected.parts.map(p=>p.material))].map(material=>`<label class="swatch">${esc(material)}<input type="color" data-color="${material}" aria-label="${material} color" value="${look[material]}"></label>`).join('');
 all('[data-color]').forEach(input=>input.oninput=()=>{look[input.dataset.color]=input.value;saveLook();});$('#grain').value=look.grain;$('#roughness').value=look.roughness;
}
function redraw(reset=false){$('#view-note').textContent=stage==='design'?'Finished design preview · every planned piece':'Recorded build progress · outlines show unbuilt pieces';viewer?.show(selected,$('#compare').checked?releasedStructureLook(selected):look,stage,reset);}
function saveLook(){
 $('#compare').checked=false;let saved=false;try{if(storage){storage.setItem(draftKey(selected),JSON.stringify(makeStructureLook(selected,look)));saved=true;}}catch{}
 $('#draft-status').textContent=saved?'Draft saved on this device · world unchanged.':'Draft is in this tab · export it to keep it.';redraw();
}
async function refresh(){
 if(requesting)return;requesting=true;$('#refresh').disabled=true;$('#connection').textContent='Checking the world’s design catalog…';const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),10000);
 try{const response=await fetch(WORLD_BASE+'/state',{signal:abort.signal,cache:'no-store'});const data=await response.json();if(!response.ok)throw Error(data.code==='hosting_limit'?'World paused by the hosting allowance.':data.error||'The world is unavailable.');catalog=catalogFromFrame(data);mode='snapshot';try{storage?.setItem(SNAPSHOT_KEY,JSON.stringify(catalog));}catch{}
  $('#connection').textContent=catalog.projects.length?'World snapshot · '+stamp():'No villager designs yet. The example is available below.';
  const keep=selected?.source!=='example'?selected?.id:selectionIntent==='example-supply-shelter'?selectionIntent:null;select(keep||catalog.projects[0]?.id);
 }catch(e){mode='cached';$('#connection').textContent=(e.name==='AbortError'?'The world did not respond in time.':e.message)+' '+(catalog?.projects.length?'Showing designs saved '+stamp()+'.':'Showing an example, not live world data.');renderInfo();}
 finally{clearTimeout(timer);requesting=false;$('#refresh').disabled=false;}
}
$('#refresh').onclick=refresh;
all('[data-stage]').forEach(b=>b.onclick=()=>{stage=b.dataset.stage;all('[data-stage]').forEach(x=>x.setAttribute('aria-pressed',x===b));redraw();});
all('[data-angle]').forEach(b=>b.onclick=()=>{all('[data-angle]').forEach(x=>x.setAttribute('aria-pressed',x===b));viewer?.home(b.dataset.angle);});
$('#home').onclick=()=>{viewer?.home();all('[data-angle]').forEach(x=>x.setAttribute('aria-pressed',x.dataset.angle==='front'));};$('#zoom-in').onclick=()=>viewer?.zoom(.8);$('#zoom-out').onclick=()=>viewer?.zoom(1.25);
function tab(name){all('[data-tab]').forEach(b=>{const active=b.dataset.tab===name;b.setAttribute('aria-selected',active);b.tabIndex=active?0:-1;$('#panel-'+b.dataset.tab).hidden=!active;});}
all('[data-tab]').forEach(b=>{b.onclick=()=>tab(b.dataset.tab);b.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const list=all('[data-tab]'),i=list.indexOf(b),next=e.key==='Home'?0:e.key==='End'?list.length-1:(i+(e.key==='ArrowRight'?1:-1)+list.length)%list.length;tab(list[next].dataset.tab);list[next].focus();};});
for(const id of ['grain','roughness'])$('#'+id).oninput=e=>{look[id]=Number(e.target.value);saveLook();};$('#compare').onchange=()=>redraw();
$('#reset').onclick=()=>{look={...releasedStructureLook(selected)};try{storage?.removeItem(draftKey(selected));}catch{}$('#compare').checked=false;$('#draft-status').textContent='Restored the released look.';renderLook();redraw();};
$('#export').onclick=()=>{const document=makeStructureLook(selected,look),blob=new Blob([JSON.stringify(document,null,2)+'\n'],{type:'application/json'}),url=URL.createObjectURL(blob),a=window.document.createElement('a');a.href=url;a.download=selected.id.replace(/[^a-z0-9_-]/gi,'-')+'-appearance.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('#import').onclick=()=>$('#look-file').click();$('#look-file').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>100000)throw Error('The look file is too large.');look=readStructureLook(selected,JSON.parse(await file.text()));renderLook();saveLook();}catch(error){$('#draft-status').textContent=error.message;}e.target.value='';};
$('#program').ontoggle=async()=>{if(!$('#program').open)return;const p=selected,token=++codeRequest;$('#code-note').textContent=p.source==='example'?'Authored example program. This code creates a plan; it does not grant materials or completed construction.':'The original construction program is read-only here.';$('#code').textContent='Loading…';try{let code=p.code;if(!code&&p.source!=='example'){const response=await fetch(WORLD_BASE+'/design/'+encodeURIComponent(p.id),{signal:AbortSignal.timeout(10000),cache:'no-store'});if(!response.ok)throw Error('Source is unavailable while the world is disconnected.');const data=await response.json();code=data.code||JSON.stringify(data.parts,null,2);}if(token===codeRequest)$('#code').textContent=code||'This older design uses a declarative list of parts.';}catch(e){if(token===codeRequest)$('#code').textContent=e.message;}};
select(new URL(location.href).searchParams.get('project'));refresh();
// Read-only inspection for the automated browser check; no live-world controls.
Object.defineProperty(window,'structureWorkshop',{get:()=>({projectId:selected.id,signature:structureSignature(selected),stage,appearance:{...look},mode,drawCalls:viewer?.renderer.info.render.calls,triangles:viewer?.renderer.info.render.triangles,camera:viewer?.camera.position.toArray(),target:viewer?.controls.target.toArray()})});
