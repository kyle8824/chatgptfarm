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
if "phaser-v1.4-world-evidence" in renderer:
    print('Phaser v1.4 world evidence is already applied.')
    raise SystemExit(0)

renderer = replace_once(
    renderer,
    "constructor(){super('LivingWorld');this.entities=new Map();this.treeSprites=[];this.ambient=[];this.grid=null;this.drag=null;this.assetOk={};this.lastRenderedTick=null}",
    "constructor(){super('LivingWorld');this.entities=new Map();this.treeSprites=[];this.ambient=[];this.evidence=[];this.evidenceStats={tracks:0,remnants:0};this.grid=null;this.drag=null;this.assetOk={};this.lastRenderedTick=null}",
    'evidence state',
)
renderer = replace_once(
    renderer,
    "this.drawOrganicSurface();this.drawBiomeUnderlays();this.drawCreekDetails();this.spawnGroundDetail();this.spawnForest();this.drawCanonicalObjects();this.renderEntities(true);this.spawnAmbientLife();this.renderWeather();",
    "this.drawOrganicSurface();this.drawBiomeUnderlays();this.drawCreekDetails();this.spawnGroundDetail();this.spawnForest();this.drawCanonicalObjects();this.renderWorldEvidence();this.renderEntities(true);this.spawnAmbientLife();this.renderWeather();",
    'build world evidence hook',
)
renderer = replace_once(
    renderer,
    "refreshDynamicWorld(){this.renderEntities(false);this.renderWeather(true);this.refreshAmbient()}",
    "refreshDynamicWorld(){this.renderEntities(false);this.renderWorldEvidence();this.renderWeather(true);this.refreshAmbient()}",
    'refresh world evidence hook',
)
marker = " spawnAmbientLife(){this.refreshAmbient(true)}"
if marker not in renderer:
    raise SystemExit('ambient marker missing')
methods = r''' clearWorldEvidence(){for(const x of this.evidence){this.tweens.killTweensOf(x);x.destroy?.(true)}this.evidence=[];this.evidenceStats={tracks:0,remnants:0}}
 renderWorldEvidence(){this.clearWorldEvidence();const traces=(canonical?.ecologySystem?.traces||[]).filter(t=>t.active!==false&&t.position&&Number.isFinite(t.position.x)&&Number.isFinite(t.position.y));for(const t of traces){const p=worldToPx(t.position),c=this.add.container(p.x,p.y).setRotation(-(Number(t.heading)||0)).setDepth(720+p.y*.04),g=this.add.graphics(),clarity=clamp(Number(t.clarity)||0,0,1),alpha=.08+.42*clarity,size=Math.max(.5,Number(t.size)||1),col=t.species==='bear'?0x33271f:t.species==='deer'?0x4d3f31:0x5b5045;for(let i=-2;i<=2;i++){const x=i*6.8*size,y=(i%2?2:-2)*size;g.fillStyle(col,alpha).fillEllipse(x,y,5.2*size,7.5*size);if(t.species!=='rabbit'){g.fillStyle(col,alpha*.78).fillCircle(x-2.4*size,y-3.5*size,1.1*size).fillCircle(x+2.4*size,y-3.5*size,1.1*size)}}c.add(g);c.setData('kind','evidence-track');c.setData('sourceId',t.sourceId||null);c.setData('evidenceId',t.id||null);c.setData('clarity',clarity);this.evidence.push(c);this.evidenceStats.tracks++}
 const arts=(canonical?.artifacts||[]).filter(a=>(a.status==='remnant'||(a.status==='active'&&!a.carrierId))&&a.coordinates&&Number.isFinite(a.coordinates.x)&&Number.isFinite(a.coordinates.y));for(const a of arts){const p=worldToPx(a.coordinates),c=this.add.container(p.x,p.y).setDepth(995+p.y),g=this.add.graphics(),type=String(a.type||a.inventoryKey||'');if(type.includes('stone')){g.fillStyle(0x8e9691,.95).fillTriangle(-8,5,1,-7,10,6);g.lineStyle(1,0xc5cbc5,.45).lineBetween(-2,1,5,-4)}else if(type.includes('wood')||type.includes('pole')){g.lineStyle(5,0x795338,.96).lineBetween(-11,6,11,-6);g.lineStyle(1,0xb07a4f,.55).lineBetween(-8,3,8,-5)}else if(type.includes('cord')){g.lineStyle(2,0xb89a63,.9);g.beginPath();g.moveTo(-10,2);g.lineTo(-5,-3);g.lineTo(0,2);g.lineTo(5,-3);g.lineTo(10,2);g.strokePath()}else if(type.includes('clay')||type.includes('vessel')){g.fillStyle(0x9c6648,.92).fillEllipse(0,2,13,8);g.fillStyle(0x4a3529,.7).fillEllipse(0,-1,8,3)}else{g.fillStyle(0x8a8069,.82).fillCircle(0,0,5)}c.add(g);c.setData('kind','evidence-remnant');c.setData('artifactId',a.id||null);c.setData('provenance',a.provenance||null);this.evidence.push(c);this.evidenceStats.remnants++}}
'''
renderer = renderer.replace(marker, methods + marker, 1)
renderer = replace_once(renderer, "version:'phaser-v1.3.1-art-bridge'", "version:'phaser-v1.4-world-evidence'", 'renderer version')
renderer = replace_once(
    renderer,
    "visualFixes:'visual-fixes-v1',camera:",
    "visualFixes:'visual-fixes-v1',evidence:{...this.evidenceStats,ids:this.evidence.map(x=>x.getData?.('evidenceId')||x.getData?.('artifactId')).filter(Boolean)},camera:",
    'snapshot evidence stats',
)
renderer_path.write_text(renderer)

html = html_path.read_text()
html = html.replace('phaser-world-v1.js?v=00131', 'phaser-world-v1.js?v=00140')
html = html.replace('phaser-world.css?v=00131', 'phaser-world.css?v=00140')
html_path.write_text(html)

qa = qa_path.read_text()
qa = replace_once(qa, "if(s.version!=='phaser-v1.3.1-art-bridge')failures.push(`wrong renderer: ${s.version}`);", "if(s.version!=='phaser-v1.4-world-evidence')failures.push(`wrong renderer: ${s.version}`);", 'qa renderer version')
needle = "if(s.campVisualMode!=='canonical-branch-camp-v1')failures.push(`canonical camp visual mode missing: ${s.campVisualMode}`);"
insert = needle + "const expectedTracks=(state.ecologySystem?.traces||[]).filter(x=>x.active!==false&&x.position).length;if(s.evidence?.tracks!==expectedTracks)failures.push(`rendered wildlife evidence drifted from canonical ecology: ${s.evidence?.tracks} != ${expectedTracks}`);const expectedRemnants=(state.artifacts||[]).filter(a=>(a.status==='remnant'||(a.status==='active'&&!a.carrierId))&&a.coordinates&&Number.isFinite(a.coordinates.x)&&Number.isFinite(a.coordinates.y)).length;if(s.evidence?.remnants!==expectedRemnants)failures.push(`rendered artifact evidence drifted from canonical ledger: ${s.evidence?.remnants} != ${expectedRemnants}`);"
qa = replace_once(qa, needle, insert, 'evidence QA assertions')
focus_anchor = "await page.evaluate(()=>window.ChatGPTFarmPhaserDebug.focusWorldUnit(50,19,.92));await page.waitForTimeout(300);await page.screenshot({path:'phaser-qa/mobile-creek.png'});"
focus_new = "const trace=(state.ecologySystem?.traces||[]).find(x=>x.active!==false&&x.position);if(trace){await page.evaluate(({x,y})=>window.ChatGPTFarmPhaserDebug.focusWorldUnit(x,y,1.25),trace.position);await page.waitForTimeout(300);await page.screenshot({path:'phaser-qa/mobile-evidence.png'});}\n" + focus_anchor
qa = replace_once(qa, focus_anchor, focus_new, 'evidence screenshot')
qa = qa.replace("Phaser Living World QA · v1.3 diagnostic gate", "Phaser Living World QA · v1.4 world-evidence gate")
qa_path.write_text(qa)

print('Applied Phaser v1.4 world evidence layer tied to canonical ecology and artifact state.')
