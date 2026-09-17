from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one patch anchor, found {count}")
    return text.replace(old, new, 1)


renderer_path = Path('phaser-world-v1.js')
qa_path = Path('scripts/phaser-qa.mjs')
html_path = Path('phaser.html')
renderer = renderer_path.read_text()

if "phaser-v1.4-living-world" in renderer:
    print('Phaser v1.4 living-world pass is already applied.')
    raise SystemExit(0)

renderer = replace_once(
    renderer,
    "constructor(){super('LivingWorld');this.entities=new Map();this.treeSprites=[];this.ambient=[];this.grid=null;this.drag=null;this.assetOk={};this.lastRenderedTick=null}",
    "constructor(){super('LivingWorld');this.entities=new Map();this.treeSprites=[];this.ambient=[];this.traceVisuals=[];this.decisionCue=null;this.lastDecisionCueId=null;this.grid=null;this.drag=null;this.assetOk={};this.lastRenderedTick=null}",
    'scene state',
)
renderer = replace_once(
    renderer,
    "this.drawOrganicSurface();this.drawBiomeUnderlays();this.drawCreekDetails();this.spawnGroundDetail();this.spawnForest();this.drawCanonicalObjects();this.renderEntities(true);this.spawnAmbientLife();this.renderWeather();",
    "this.drawOrganicSurface();this.drawBiomeUnderlays();this.drawCreekDetails();this.spawnGroundDetail();this.spawnForest();this.drawCanonicalObjects();this.renderCanonicalTraces();this.renderEntities(true);this.updateDecisionCue(true);this.spawnAmbientLife();this.renderWeather();",
    'initial living world build',
)
renderer = replace_once(
    renderer,
    "refreshDynamicWorld(){this.renderEntities(false);this.renderWeather(true);this.refreshAmbient()}",
    "refreshDynamicWorld(){this.renderCanonicalTraces();this.renderEntities(false);this.updateDecisionCue(false);this.renderWeather(true);this.refreshAmbient()}",
    'dynamic living world refresh',
)
anchor = " upsertAgent(a,initial){"
methods = r''' renderCanonicalTraces(){for(const v of this.traceVisuals)v.destroy();this.traceVisuals=[];const traces=(canonical?.ecologySystem?.traces||[]).filter(t=>t.active&&(t.clarity??0)>.2);for(const t of traces){const p=worldToPx(t.position),heading=-(t.heading||0),size=clamp(t.size||1,.45,1.6),alpha=clamp((t.clarity??.7)*.62,.16,.58),g=this.add.graphics().setDepth(720+p.y*.02);g.setAlpha(alpha);const c=t.species==='bear'?0x3b3229:t.species==='rabbit'?0x665d51:0x55483b;g.fillStyle(c,1);const dx=Math.cos(heading)*7*size,dy=Math.sin(heading)*7*size,nx=-Math.sin(heading)*3.3*size,ny=Math.cos(heading)*3.3*size;for(let i=-1;i<=1;i++){const along=i*7.5*size,cx=p.x+dx*i,cy=p.y+dy*i;g.fillEllipse(cx+nx,cy+ny,5.6*size,3.4*size);g.fillEllipse(cx-nx,cy-ny,5.6*size,3.4*size);if(t.species==='bear'&&i===0)g.fillEllipse(cx,cy+1,5*size,4*size)}g.setData('kind','wildlife-trace');g.setData('traceId',t.id);g.setData('species',t.species);this.traceVisuals.push(g)} }
 updateDecisionCue(initial=false){const dna=canonical?.dna?.[0],agent=dna?this.entities.get(dna.agent_id):null;if(!dna||!agent)return;if(this.decisionCue&&this.lastDecisionCueId!==dna.decision_id){this.decisionCue.destroy();this.decisionCue=null}if(!this.decisionCue){const label=String(dna.action_label||dna.action||'').replace(/^./,c=>c.toUpperCase()),intent=String(dna.mind?.intent||'').trim(),text=intent&&intent.toLowerCase()!==label.toLowerCase()?`${label}\n${intent}`:label;this.decisionCue=this.add.text(agent.x,agent.y-92,text,{fontFamily:'Arial',fontSize:'10px',fontStyle:'bold',align:'center',color:'#eef5e9',backgroundColor:'rgba(9,19,12,.72)',padding:{x:7,y:5},stroke:'#111a13',strokeThickness:2,wordWrap:{width:190}}).setOrigin(.5,1).setDepth(9100).setAlpha(initial?.78:.94);this.lastDecisionCueId=dna.decision_id;this.decisionCue.setData('decisionId',dna.decision_id)}else this.decisionCue.setPosition(agent.x,agent.y-92);}
'''
renderer = replace_once(renderer, anchor, methods + anchor, 'canonical trace and decision cue methods')
renderer = replace_once(
    renderer,
    " update(){for(const [id,e] of this.entities){if(e.getData?.('kind')==='wildlife'&&e.getData('species')!=='fish')e.setDepth(1000+e.y+2)} }",
    " update(){for(const [id,e] of this.entities){if(e.getData?.('kind')==='wildlife'&&e.getData('species')!=='fish')e.setDepth(1000+e.y+2)}if(this.decisionCue&&this.lastDecisionCueId){const dna=canonical?.dna?.[0],agent=dna?this.entities.get(dna.agent_id):null;if(agent)this.decisionCue.setPosition(agent.x,agent.y-92)} }",
    'decision cue tracking',
)
renderer = replace_once(renderer, "version:'phaser-v1.3.1-art-bridge'", "version:'phaser-v1.4-living-world'", 'renderer version')
renderer = replace_once(
    renderer,
    "visualFixes:'visual-fixes-v1',camera:",
    "visualFixes:'visual-fixes-v1',livingWorld:{trackVisuals:this.traceVisuals.length,canonicalTracks:(canonical?.ecologySystem?.traces||[]).filter(t=>t.active&&(t.clarity??0)>.2).length,decisionCueId:this.decisionCue?.getData?.('decisionId')||null},camera:",
    'living world snapshot',
)
renderer_path.write_text(renderer)

qa = qa_path.read_text()
qa = replace_once(qa, "if(s.version!=='phaser-v1.3.1-art-bridge')failures.push(`wrong renderer: ${s.version}`);", "if(s.version!=='phaser-v1.4-living-world')failures.push(`wrong renderer: ${s.version}`);", 'qa version')
needle = "if(s.campVisualMode!=='canonical-branch-camp-v1')failures.push(`canonical camp visual mode missing: ${s.campVisualMode}`);"
replacement = needle + "const expectedTracks=(state.ecologySystem?.traces||[]).filter(t=>t.active&&(t.clarity??0)>.2).length;if(s.livingWorld?.trackVisuals!==expectedTracks||s.livingWorld?.canonicalTracks!==expectedTracks)failures.push(`wildlife trace projection drift: rendered=${s.livingWorld?.trackVisuals} canonical=${expectedTracks}`);const expectedCue=state.dna?.[0]?.decision_id||null;if(expectedCue&&s.livingWorld?.decisionCueId!==expectedCue)failures.push(`Decision DNA world cue drift: ${s.livingWorld?.decisionCueId} != ${expectedCue}`);"
qa = replace_once(qa, needle, replacement, 'living world QA')
qa_path.write_text(qa)

html = html_path.read_text()
html = html.replace('phaser-world.css?v=00131','phaser-world.css?v=0014')
html = html.replace('phaser-world-v1.js?v=00131','phaser-world-v1.js?v=0014')
html_path.write_text(html)

print('Applied Phaser v1.4 canonical wildlife traces + Decision DNA world cue.')
