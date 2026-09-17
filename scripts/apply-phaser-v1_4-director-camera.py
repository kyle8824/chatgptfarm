from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one patch anchor, found {count}")
    return text.replace(old, new, 1)


rp = Path('phaser-world-v1.js')
src = rp.read_text()
if "director-camera-v1" in src:
    print('Living Director camera pass already applied.')
    raise SystemExit(0)

old_focus = "function focusAgent(w=canonical){const urgent=(w?.liveThreads||[]).slice().sort((a,b)=>(b.urgency||0)-(a.urgency||0))[0],id=urgent?.agentIds?.[0];return(w?.agents||[]).find(a=>a.id===id)||(w?.agents||[])[0]||null}"
new_focus = "function focusAgent(w=canonical){const urgent=(w?.liveThreads||[]).slice().sort((a,b)=>(b.urgency||0)-(a.urgency||0))[0],id=urgent?.agentIds?.[0];return(w?.agents||[]).find(a=>a.id===id)||(w?.agents||[])[0]||null}\nfunction directorTarget(w=canonical){const thread=(w?.liveThreads||[]).slice().sort((a,b)=>(b.urgency||0)-(a.urgency||0))[0]||null;if(thread?.focus&&Number.isFinite(thread.focus.x)&&Number.isFinite(thread.focus.y))return{kind:'director',threadId:thread.id||null,threadKind:thread.kind||null,point:{x:thread.focus.x,y:thread.focus.y},evidenceId:thread.evidenceId||null,ecologyEventId:thread.ecologyEventId||null,sourceId:thread.sourceId||null};const a=focusAgent(w);return a?{kind:'agent',threadId:thread?.id||null,threadKind:thread?.kind||null,agentId:a.id}:null}"
src = replace_once(src, old_focus, new_focus, 'director target helper')
src = replace_once(src, "this.grid=null;this.drag=null;this.assetOk={};", "this.grid=null;this.drag=null;this.cameraTarget=null;this.assetOk={};", 'camera target state')

old_camera = "applyCamera(immediate=false){let id=cameraMode;if(id==='auto')id=focusAgent()?.id||'agent-mara';const e=this.entities.get(id);if(!e)return;const cam=this.cameras.main;if(immediate){cam.stopFollow();cam.centerOn(e.x,e.y)}cam.startFollow(e,true,.075,.075,0,innerWidth<650?35:0)}"
new_camera = "applyCamera(immediate=false){const cam=this.cameras.main;if(cameraMode==='auto'){const target=directorTarget();this.cameraTarget=target;if(target?.kind==='director'){cam.stopFollow();const p=worldToPx(target.point);if(immediate)cam.centerOn(p.x,p.y);else cam.pan(p.x,p.y,1100,'Sine.easeInOut',true);return}const e=this.entities.get(target?.agentId||'agent-mara');if(!e)return;if(immediate){cam.stopFollow();cam.centerOn(e.x,e.y)}cam.startFollow(e,true,.075,.075,0,innerWidth<650?35:0);return}const e=this.entities.get(cameraMode);if(!e)return;this.cameraTarget={kind:'agent',agentId:cameraMode,threadId:null,threadKind:null};if(immediate){cam.stopFollow();cam.centerOn(e.x,e.y)}cam.startFollow(e,true,.075,.075,0,innerWidth<650?35:0)}"
src = replace_once(src, old_camera, new_camera, 'event-aware auto camera')

old_drag = "cameraMode='free';cam.stopFollow();cam.scrollX=this.drag.scrollX-dx;cam.scrollY=this.drag.scrollY-dy;this.syncButtons()"
new_drag = "cameraMode='free';this.cameraTarget={kind:'free'};cam.stopFollow();cam.scrollX=this.drag.scrollX-dx;cam.scrollY=this.drag.scrollY-dy;this.syncButtons()"
src = replace_once(src, old_drag, new_drag, 'manual camera override marker')

src = replace_once(src, "alpha=.055+.31*clarity", "alpha=.028+.19*clarity", 'track softening alpha')
src = replace_once(src, "for(let i=-2;i<=2;i++){const x=i*7.2*size", "for(let i=-1;i<=1;i++){const x=i*8.2*size", 'track mark density')

old_cam_snap = "camera:{mode:cameraMode,zoom:this.cameras.main.zoom,scrollX:this.cameras.main.scrollX,scrollY:this.cameras.main.scrollY}"
new_cam_snap = "directorCamera:'director-camera-v1',camera:{mode:cameraMode,targetKind:this.cameraTarget?.kind||null,threadId:this.cameraTarget?.threadId||null,threadKind:this.cameraTarget?.threadKind||null,agentId:this.cameraTarget?.agentId||null,evidenceId:this.cameraTarget?.evidenceId||null,ecologyEventId:this.cameraTarget?.ecologyEventId||null,sourceId:this.cameraTarget?.sourceId||null,focus:this.cameraTarget?.point?{...this.cameraTarget.point}:null,zoom:this.cameras.main.zoom,scrollX:this.cameras.main.scrollX,scrollY:this.cameras.main.scrollY}"
src = replace_once(src, old_cam_snap, new_cam_snap, 'camera provenance snapshot')

old_debug = "focusWorldUnit(x,y,zoom=1){if(!sceneRef)return false;cameraMode='free';sceneRef.cameras.main.stopFollow();const p=worldToPx({x,y});sceneRef.cameras.main.centerOn(p.x,p.y);sceneRef.setZoom(zoom);sceneRef.syncButtons();return true}"
new_debug = "focusWorldUnit(x,y,zoom=1){if(!sceneRef)return false;cameraMode='free';sceneRef.cameraTarget={kind:'free'};sceneRef.cameras.main.stopFollow();const p=worldToPx({x,y});sceneRef.cameras.main.centerOn(p.x,p.y);sceneRef.setZoom(zoom);sceneRef.syncButtons();return true}"
src = replace_once(src, old_debug, new_debug, 'debug manual camera provenance')
rp.write_text(src)

qp = Path('scripts/phaser-qa.mjs')
qa = qp.read_text()
qa = replace_once(qa, "import { migrateWorld, advanceEcology } from '../engine.js';", "import { migrateWorld, advanceEcology } from '../engine.js';\nimport { updateSpectatorState } from '../engine/spectator.js';", 'QA spectator import')
qa = replace_once(qa, "advanceEcology(state);", "advanceEcology(state);\nupdateSpectatorState(state);", 'QA director state refresh')
needle = "if(s.wildlifeCoherence!=='wildlife-coherence-v1')failures.push(`wildlife coherence marker missing: ${s.wildlifeCoherence}`);"
qa = replace_once(qa, needle, needle + "if(s.directorCamera!=='director-camera-v1')failures.push(`Living Director camera marker missing: ${s.directorCamera}`);", 'director camera marker QA')

heartbeat_anchor = "state=JSON.parse(JSON.stringify(state));state.meta=state.meta||{};state.meta.tickNumber=Number(state.meta.tickNumber||0)+100;const rabbit=state.ecologySystem?.wildlife?.find(x=>x.id==='W-RABBIT-001');"
director_test = "const directorTrace=(state.ecologySystem?.traces||[]).find(x=>x.active!==false&&x.position);if(directorTrace){state=JSON.parse(JSON.stringify(state));state.meta=state.meta||{};state.meta.tickNumber=Number(state.meta.tickNumber||0)+50;state.liveThreads=[{id:'qa-director-evidence',urgency:999,kind:'wildlife-sign',focus:{...directorTrace.position},evidenceId:directorTrace.id,sourceId:directorTrace.sourceId||null,agentIds:[],placeIds:[]}];await page.evaluate(()=>window.ChatGPTFarmPhaserDebug.reload());await page.waitForTimeout(450);await page.getByRole('button',{name:'AUTO',exact:true}).click();await page.waitForTimeout(1300);s=await snap();if(s.camera.targetKind!=='director'||s.camera.threadId!=='qa-director-evidence'||s.camera.evidenceId!==directorTrace.id)failures.push(`AUTO camera did not frame canonical Director evidence: ${JSON.stringify(s.camera)}`);await page.screenshot({path:'phaser-qa/mobile-director.png'});await page.evaluate(()=>window.ChatGPTFarmPhaserDebug.focusWorldUnit(50,50,1));await page.waitForTimeout(150);s=await snap();if(s.camera.mode!=='free'||s.camera.targetKind!=='free')failures.push('manual camera override did not take precedence over Living Director');}\n" + heartbeat_anchor
qa = replace_once(qa, heartbeat_anchor, director_test, 'director camera QA sequence')
qa = replace_once(qa, "if(s.movingEntities<1)failures.push('heartbeat did not create visible movement');", "if(s.movingEntities<1)failures.push('heartbeat did not create visible movement');if(s.camera.mode!=='free')failures.push('heartbeat stole manual camera control');", 'manual override heartbeat assertion')
qp.write_text(qa)
print('Applied provenance-aware Living Director AUTO camera and softened canonical tracks.')
