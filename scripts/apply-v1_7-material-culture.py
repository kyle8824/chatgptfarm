from pathlib import Path


def replace_once(text, old, new, label):
    count=text.count(old)
    if count!=1:
        raise SystemExit(f'{label}: expected exactly one anchor, found {count}')
    return text.replace(old,new,1)

render_path=Path('phaser-world-v1.js')
qa_path=Path('scripts/phaser-qa.mjs')
html_path=Path('phaser.html')
render=render_path.read_text()

if "phaser-v1.7-material-culture" not in render:
    render=replace_once(render,"this.campWearVisuals=[];this.decisionCue","this.campWearVisuals=[];this.artifactVisuals=[];this.decisionCue",'artifact scene state')
    render=replace_once(render,"this.renderCanonicalSigns();this.renderEntities(true);this.updateDecisionCue(true);","this.renderCanonicalSigns();this.renderEntities(true);this.renderArtifacts();this.updateDecisionCue(true);",'initial artifact render')
    render=replace_once(render,"this.renderCanonicalSigns();this.renderEntities(false);this.updateDecisionCue(false);","this.renderCanonicalSigns();this.renderEntities(false);this.renderArtifacts();this.updateDecisionCue(false);",'dynamic artifact render')

    anchor=' renderEntities(initial=false){'
    method=r''' artifactWorldPoint(art){
  if(art?.coordinates&&Number.isFinite(art.coordinates.x)&&Number.isFinite(art.coordinates.y))return art.coordinates;
  const loc=canonical?.spatial?.locations?.[art?.position];if(loc&&Number.isFinite(loc.x))return loc;
  const o=(canonical?.worldModel?.objects||[]).find(x=>!x.parentId&&x.zone===art?.position&&x.position);return o?.position||{x:64,y:34}
 }
 artifactOffset(type){if(['woodPole','pointedPole','boundSharpTool'].includes(type))return{x:17,y:-19};if(['rawClayVessel','firedVessel'].includes(type))return{x:17,y:-5};if(type==='cordage')return{x:17,y:-12};return{x:14,y:-7}}
 drawArtifactGlyph(container,art,count=1){
  const g=this.add.graphics();container.add(g);const type=art.type||art.inventoryKey,status=art.status||'active';
  if(type==='sharpStone'){g.fillStyle(0xa7aaa1,.98);g.fillTriangle(-6,5,7,1,1,-8);g.lineStyle(1,0xd6d8cf,.7);g.lineBetween(-2,1,3,-4)}
  else if(type==='woodPole'){g.lineStyle(4,0x795536,1);g.lineBetween(-6,9,7,-12);g.lineStyle(1,0xae8053,.7);g.lineBetween(-4,5,6,-10)}
  else if(type==='pointedPole'){g.lineStyle(4,0x765033,1);g.lineBetween(-7,10,6,-11);g.fillStyle(0x4e392c,1);g.fillTriangle(4,-9,9,-17,8,-7)}
  else if(type==='boundSharpTool'){g.lineStyle(4,0x705035,1);g.lineBetween(-8,11,5,-10);g.fillStyle(0x979990,1);g.fillTriangle(1,-8,11,-14,7,-3);g.lineStyle(2,0x927c55,.95);g.lineBetween(0,-4,8,-9);g.lineBetween(2,-1,9,-6)}
  else if(type==='cordage'){g.lineStyle(2,0xb49a62,.95);g.strokeCircle(0,0,7);g.strokeCircle(3,2,5)}
  else if(type==='rawClayVessel'||type==='firedVessel'){const c=type==='firedVessel'?0xa9653f:0xb88261;g.fillStyle(c,1);g.fillEllipse(0,3,17,14);g.fillStyle(type==='firedVessel'?0x56372d:0x755347,1);g.fillEllipse(0,-3,14,5);g.lineStyle(1,0xd29a70,.55);g.strokeEllipse(0,-3,14,5)}
  else if(type==='brokenClay'){g.fillStyle(0xa96647,.92);g.fillTriangle(-8,5,-2,-6,2,4);g.fillTriangle(2,6,7,-4,10,4);g.fillTriangle(-2,7,2,0,5,8)}
  else if(type==='slumpedClay'){g.fillStyle(0x9d6c50,.88);g.fillEllipse(0,3,20,10);g.fillEllipse(-4,-1,11,8)}
  else if(type==='looseReedTwist'){g.lineStyle(1.7,0xa5905c,.9);g.lineBetween(-9,5,9,-5);g.lineBetween(-8,2,8,-7);g.lineBetween(-6,7,10,-2)}
  else{g.fillStyle(status==='remnant'?0x826b50:0x8d8b76,.88);g.fillCircle(0,0,5)}
  if(status==='remnant'){g.lineStyle(1,0x4a3d31,.45);g.strokeCircle(0,2,12)}
  if(count>1){const t=this.add.text(8,-12,`×${count}`,{fontFamily:'Arial',fontSize:'7px',fontStyle:'bold',color:'#e8eee4',stroke:'#172018',strokeThickness:2}).setOrigin(0,.5);container.add(t)}
 }
 renderArtifacts(){
  for(const v of this.artifactVisuals)v.destroy(true);this.artifactVisuals=[];
  const arts=(canonical?.artifacts||[]).filter(a=>a&&['active','remnant'].includes(a.status));const carried=new Map(),ground=[];
  for(const art of arts){if(art.status==='active'&&art.carrierId){const key=`${art.carrierId}:${art.type||art.inventoryKey}`,g=carried.get(key)||{art,count:0};g.count++;carried.set(key,g)}else ground.push(art)}
  const add=(art,count=1)=>{const p=art.carrierId?{x:0,y:0}:worldToPx(this.artifactWorldPoint(art)),c=this.add.container(p.x,p.y).setDepth(art.carrierId?2000:1000+p.y+4);c.setData('kind','artifact');c.setData('artifactId',art.id);c.setData('artifactType',art.type||art.inventoryKey);c.setData('status',art.status);c.setData('carrierId',art.carrierId||null);c.setData('count',count);this.drawArtifactGlyph(c,art,count);this.artifactVisuals.push(c);return c};
  for(const {art,count} of carried.values())add(art,count);for(const art of ground)add(art,1);
  this.artifactState={canonical:arts.length,rendered:this.artifactVisuals.length,carried:[...carried.values()].reduce((s,x)=>s+x.count,0),carriedGroups:carried.size,remnants:ground.filter(x=>x.status==='remnant').length,types:[...new Set(arts.map(x=>x.type||x.inventoryKey))].sort()};
  this.positionCarriedArtifacts();
 }
 positionCarriedArtifacts(){for(const v of this.artifactVisuals){const carrier=v.getData?.('carrierId');if(!carrier)continue;const e=this.entities.get(carrier);if(!e){v.setVisible(false);continue}v.setVisible(true);const off=this.artifactOffset(v.getData('artifactType'));v.setPosition(e.x+off.x,e.y+off.y);v.setDepth((e.depth||1000)+4)}}
'''
    render=replace_once(render,anchor,method+anchor,'material culture renderer')
    render=replace_once(render,"if(this.decisionCue&&this.lastDecisionCueId){const dna=canonical?.dna?.[0]","this.positionCarriedArtifacts();if(this.decisionCue&&this.lastDecisionCueId){const dna=canonical?.dna?.[0]",'artifact follow update')
    render=render.replace("version:'phaser-v1.6.3-embodiment'","version:'phaser-v1.7-material-culture'")
    snap_anchor="resourceLandscape:'resource-responsive-v1',resourceVisualState:this.resourceVisualState||null,rangePresenceCounts:"
    snap_new="resourceLandscape:'resource-responsive-v1',resourceVisualState:this.resourceVisualState||null,materialCulture:'artifact-ledger-v1',artifactState:this.artifactState||null,rangePresenceCounts:"
    render=replace_once(render,snap_anchor,snap_new,'artifact snapshot')
    render_path.write_text(render)

qa=qa_path.read_text().replace("s.version!=='phaser-v1.6.3-embodiment'","s.version!=='phaser-v1.7-material-culture'")
if 'QA-FIRED-VESSEL' not in qa:
    inject_anchor="state.surfaceHistory={version:'surface-history-1',routes:[{id:'ROUTE-QA-VISUAL',key:'43,31|64,34',from:{x:43,y:31},to:{x:64,y:34},traversals:5,agents:{'agent-mara':3,'agent-ivo':2},firstUsed:{day:state.day,hour:Math.max(0,state.hour-5)},lastUsed:{day:state.day,hour:state.hour},lastActionId:'qa_walk'}],campWear:{uses:12,agents:{'agent-mara':7,'agent-ivo':5},lastUsed:{day:state.day,hour:state.hour}}};"
    injected=inject_anchor+"\nstate.artifacts=[...(state.artifacts||[]).filter(x=>!String(x.id||'').startsWith('QA-')),{id:'QA-FIRED-VESSEL',type:'firedVessel',inventoryKey:'firedVessel',label:'fired clay vessel',status:'active',carrierId:'agent-mara',position:'camp',coordinates:null,created:{day:state.day,hour:state.hour},properties:['clay','hollow','fired']},{id:'QA-BOUND-TOOL',type:'boundSharpTool',inventoryKey:'boundSharpTool',label:'bound composite tool',status:'active',carrierId:'agent-ivo',position:'camp',coordinates:null,created:{day:state.day,hour:state.hour},properties:['wood','stone','bound']},{id:'QA-BROKEN-CLAY',type:'brokenClay',inventoryKey:'brokenClay',label:'broken clay vessel fragments',status:'remnant',carrierId:null,position:'camp',coordinates:{x:66,y:35},created:{day:state.day,hour:state.hour},properties:['clay','broken','remnant']}];"
    qa=replace_once(qa,inject_anchor,injected,'artifact QA injection')
    assertion_anchor="if(s.campVisualMode!=='canonical-lean-to-v3')failures.push(`canonical camp visual mode missing: ${s.campVisualMode}`);"
    assertion=assertion_anchor+"if(s.materialCulture!=='artifact-ledger-v1'||s.artifactState?.rendered!==3||s.artifactState?.carried!==2||s.artifactState?.remnants!==1)failures.push(`material culture projection drift: ${JSON.stringify(s.artifactState)}`);"
    qa=replace_once(qa,assertion_anchor,assertion,'artifact projection QA')
    shot_anchor="await page.evaluate(()=>window.ChatGPTFarmPhaserDebug.focusWorldUnit(64,34,1.05));await page.waitForTimeout(300);await page.screenshot({path:'phaser-qa/mobile-camp.png'});"
    shot=shot_anchor+"await page.waitForTimeout(120);await page.screenshot({path:'phaser-qa/mobile-material-culture.png'});"
    qa=replace_once(qa,shot_anchor,shot,'material culture screenshot')
qa_path.write_text(qa)

html=html_path.read_text().replace('v=001600004','v=001700001')
html_path.write_text(html)
print('Applied v1.7 canonical artifact-ledger material culture projection.')
