from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one patch anchor, found {count}")
    return text.replace(old, new, 1)


rp=Path('phaser-world-v1.js')
src=rp.read_text()
if "director-hud-v1" in src:
    print('Director-aware HUD already applied.')
    raise SystemExit(0)

old = "updateHud(){const s=$('#phWorldStatus'),v=String(canonical.worldModel?.version||'?').replace('object-field-','');s.innerHTML=`<b>● OBJECT WORLD · ${v}</b><span>Day ${canonical.day} · ${String(canonical.hour).padStart(2,'0')}:00 · ${Math.round(canonical.temperature)}°F · ${canonical.weather}</span>`;const a=focusAgent(),ph=currentPhase(a),place=String(a?.position||'world').replaceAll('_',' ').toUpperCase();$('#phFocus').innerHTML=`<small>${ph.label} · ${place}</small><strong>${a?.name||'World'} — ${a?.mind?.currentGoal||a?.currentAction||'Observing the basin.'}</strong>`;const wildlife=(canonical.ecologySystem?.wildlife||[]).filter(x=>x.active),ambient=canonical.ecologySystem?.ambient||{},events=canonical.ecologySystem?.events||[];$('#phLifeCount').textContent=`${wildlife.length} animals` ;$('#phPulseText').textContent=events[0]?.title||`${ambient.birds||0} bird activity · ${ambient.frogs||0} frog activity`}"
new = "updateHud(){const s=$('#phWorldStatus'),v=String(canonical.worldModel?.version||'?').replace('object-field-','');s.innerHTML=`<b>● OBJECT WORLD · ${v}</b><span>Day ${canonical.day} · ${String(canonical.hour).padStart(2,'0')}:00 · ${Math.round(canonical.temperature)}°F · ${canonical.weather}</span>`;const target=cameraMode==='auto'?directorTarget():null,thread=target?.threadId?(canonical.liveThreads||[]).find(x=>x.id===target.threadId):null;if(target?.kind==='director'&&thread){const kind=String(thread.kind||'world event').replaceAll('-',' ').toUpperCase(),place=String(thread.placeIds?.[0]||'basin').replaceAll('_',' ').toUpperCase();$('#phFocus').innerHTML=`<small>${kind} · ${place}</small><strong>${thread.title||'The living world changed.'}</strong>`;this.focusHudMode='director'}else{const a=cameraMode==='agent-mara'?(canonical.agents||[]).find(x=>x.id==='agent-mara'):cameraMode==='agent-ivo'?(canonical.agents||[]).find(x=>x.id==='agent-ivo'):focusAgent(),ph=currentPhase(a),place=String(a?.position||'world').replaceAll('_',' ').toUpperCase();$('#phFocus').innerHTML=`<small>${ph.label} · ${place}</small><strong>${a?.name||'World'} — ${a?.mind?.currentGoal||a?.currentAction||'Observing the basin.'}</strong>`;this.focusHudMode='agent'}const wildlife=(canonical.ecologySystem?.wildlife||[]).filter(x=>x.active),ambient=canonical.ecologySystem?.ambient||{},events=canonical.ecologySystem?.events||[];$('#phLifeCount').textContent=`${wildlife.length} animals`;$('#phPulseText').textContent=thread?.summary||events[0]?.title||`${ambient.birds||0} bird activity · ${ambient.frogs||0} frog activity`}"
src=replace_once(src,old,new,'director-aware updateHud')
src=replace_once(src,"directorCamera:'director-camera-v1',camera:","directorCamera:'director-camera-v1',directorHud:'director-hud-v1',focusHudMode:this.focusHudMode||null,focusHudText:$('#phFocus')?.textContent||'',camera:",'HUD debug snapshot')
# Re-render caption immediately on camera buttons rather than waiting for heartbeat.
src=replace_once(src,"cameraMode=b.dataset.camera;this.applyCamera(true);this.syncButtons()","cameraMode=b.dataset.camera;this.applyCamera(true);this.syncButtons();this.updateHud()",'camera button HUD refresh')
src=replace_once(src,"cameraMode='auto';this.applyCamera(true);this.syncButtons()","cameraMode='auto';this.applyCamera(true);this.syncButtons();this.updateHud()",'home HUD refresh')
rp.write_text(src)

qp=Path('scripts/phaser-qa.mjs')
qa=qp.read_text()
needle="if(s.directorCamera!=='director-camera-v1')failures.push(`Living Director camera marker missing: ${s.directorCamera}`);"
qa=replace_once(qa,needle,needle+"if(s.directorHud!=='director-hud-v1')failures.push(`Living Director HUD marker missing: ${s.directorHud}`);",'HUD marker QA')
old_assert="if(s.camera.targetKind!=='director'||s.camera.threadId!=='qa-director-evidence'||s.camera.evidenceId!==directorTrace.id)failures.push(`AUTO camera did not frame canonical Director evidence: ${JSON.stringify(s.camera)}`);"
new_assert=old_assert+"if(s.focusHudMode!=='director'||!String(s.focusHudText||'').includes('WILDLIFE SIGN'))failures.push(`Director camera caption did not match the framed event: ${s.focusHudText}`);"
qa=replace_once(qa,old_assert,new_assert,'Director caption QA')
qp.write_text(qa)
print('Applied Director-aware caption so AUTO explains the event it frames.')
