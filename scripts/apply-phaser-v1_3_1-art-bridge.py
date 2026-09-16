from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one patch anchor, found {count}")
    return text.replace(old, new, 1)


renderer_path = Path('phaser-world-v1.js')
html_path = Path('phaser.html')
qa_path = Path('scripts/phaser-qa.mjs')

renderer = renderer_path.read_text()
if "phaser-v1.3.1-art-bridge" in renderer:
    print('Phaser v1.3.1 art bridge is already applied; leaving validated files intact.')
    raise SystemExit(0)

renderer = replace_once(
    renderer,
    "const ASSET_ROOT=`https://raw.githubusercontent.com/Tiddybub/2d-assets/${ASSET_REV}`;",
    "const ASSET_ROOT=`https://raw.githubusercontent.com/Tiddybub/2d-assets/${ASSET_REV}`;\nconst TINY_FARM_ROOT=`${ASSET_ROOT}/fantasy/tiny-farm/Tiles`;",
    'tiny farm root',
)
renderer = replace_once(
    renderer,
    "  const carto=`${ASSET_ROOT}/ui/cartography-pack/PNG/Default`;this.load.image('camp-tent',`${carto}/tent.png`);this.load.image('campfire-art',`${carto}/campfire.png`);",
    "  const carto=`${ASSET_ROOT}/ui/cartography-pack/PNG/Default`;this.load.image('camp-tent',`${carto}/tent.png`);this.load.image('campfire-art',`${carto}/campfire.png`);\n  this.load.image('person-mara-art',`${TINY_FARM_ROOT}/tile_0108.png`);this.load.image('person-ivo-art',`${TINY_FARM_ROOT}/tile_0109.png`);",
    'agent art preload',
)
old_agent = "upsertAgent(a,initial){let e=this.entities.get(a.id);if(!e){const key=a.id==='agent-mara'?'person-mara':'person-ivo',target=worldToPx(canonicalAgentPoint(a));e=this.add.image(target.x,target.y,key).setOrigin(.5,1).setScale(.72).setDepth(1000+target.y+3);e.setData('kind','agent');e.setData('id',a.id);const name=this.add.text(target.x,target.y-58,a.name,{fontFamily:'Arial',fontSize:'12px',fontStyle:'bold',color:'#f5f8f2',stroke:'#111a13',strokeThickness:4}).setOrigin(.5).setDepth(9000);e.setData('label',name);this.entities.set(a.id,e)}"
new_agent = "upsertAgent(a,initial){let e=this.entities.get(a.id);if(!e){const fallbackKey=a.id==='agent-mara'?'person-mara':'person-ivo',artKey=a.id==='agent-mara'?'person-mara-art':'person-ivo-art',key=this.textures.exists(artKey)?artKey:fallbackKey,target=worldToPx(canonicalAgentPoint(a));e=this.add.image(target.x,target.y,key).setOrigin(.5,1);const h=key===artKey?58:55;e.setDisplaySize(Math.max(34,h*(e.width/Math.max(e.height,1))),h).setDepth(1000+target.y+3);e.setData('kind','agent');e.setData('id',a.id);e.setData('artMode',key===artKey?'tiny-farm':'fallback');const name=this.add.text(target.x,target.y-64,a.name,{fontFamily:'Arial',fontSize:'11px',fontStyle:'bold',color:'#f5f8f2',stroke:'#111a13',strokeThickness:4}).setOrigin(.5).setDepth(9000);e.setData('label',name);this.entities.set(a.id,e)}"
renderer = replace_once(renderer, old_agent, new_agent, 'agent renderer')
renderer = renderer.replace("label.setPosition(to.x,to.y-58)", "label.setPosition(to.x,to.y-64)")
renderer = renderer.replace("label.setPosition(e.x,e.y-58)", "label.setPosition(e.x,e.y-64)")
renderer = replace_once(renderer, "version:'phaser-v1.3-basin-slice'", "version:'phaser-v1.3.1-art-bridge'", 'renderer version')
renderer = replace_once(
    renderer,
    "assetErrors:[...assetErrors],camera:",
    "assetErrors:[...assetErrors],decisionDNA:{protocol:canonical?.dna?.[0]?.protocol||null,decisionId:canonical?.dna?.[0]?.decision_id||null,action:canonical?.dna?.[0]?.action||null},agentArtModes:[...this.entities.values()].filter(x=>x.getData?.('kind')==='agent').map(x=>x.getData?.('artMode')||'unknown'),camera:",
    'debug dna/art snapshot',
)
renderer_path.write_text(renderer)

html = html_path.read_text()
html = replace_once(html, 'phaser-world.css?v=0013', 'phaser-world.css?v=00131', 'css cache key')
html = replace_once(html, 'phaser-world-v1.js?v=0013', 'phaser-world-v1.js?v=00131', 'js cache key')
html_path.write_text(html)

qa = qa_path.read_text()
qa = replace_once(qa, "if(s.version!=='phaser-v1.3-basin-slice')failures.push(`wrong renderer: ${s.version}`);", "if(s.version!=='phaser-v1.3.1-art-bridge')failures.push(`wrong renderer: ${s.version}`);", 'qa renderer version')
qa = replace_once(
    qa,
    "if(s.movingEntities<1)failures.push('no entity has visible interpolated movement');",
    "if(s.movingEntities<1)failures.push('no entity has visible interpolated movement');\nconst expectedDNA=state.dna?.[0]?.decision_id||null;if(!String(s.decisionDNA?.protocol||'').startsWith('Decision DNA'))failures.push(`Decision DNA projection missing: ${JSON.stringify(s.decisionDNA)}`);if(expectedDNA&&s.decisionDNA?.decisionId!==expectedDNA)failures.push(`renderer DNA drifted from canonical state: ${s.decisionDNA?.decisionId} != ${expectedDNA}`);if((s.agentArtModes||[]).length!==2||(s.agentArtModes||[]).some(x=>x!=='tiny-farm'))failures.push(`Tiny Farm agent art failed to load: ${JSON.stringify(s.agentArtModes)}`);",
    'qa dna/art assertions',
)
qa_path.write_text(qa)

print('Applied Phaser v1.3.1 art bridge + Decision DNA projection guard.')
