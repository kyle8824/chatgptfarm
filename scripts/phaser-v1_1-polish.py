from pathlib import Path
p=Path('phaser-world-v1.js')
s=p.read_text()

def once(old,new,label):
    global s
    if old not in s: raise SystemExit(f'{label} anchor missing')
    s=s.replace(old,new,1)

once("function canonicalAgentPoint(a,w=canonical){if(a?.coordinates&&Number.isFinite(a.coordinates.x))return a.coordinates;const o=(w?.worldModel?.objects||[]).find(x=>!x.parentId&&x.zone===a?.position&&x.position);return o?.position||{x:50,y:50}}",
"function canonicalAgentPoint(a,w=canonical){if(a?.coordinates&&Number.isFinite(a.coordinates.x))return a.coordinates;const o=(w?.worldModel?.objects||[]).find(x=>!x.parentId&&x.zone===a?.position&&x.position);return o?.position||{x:50,y:50}}\nfunction agentPresentationOffset(a,w=canonical){const mine=canonicalAgentPoint(a,w),near=(w?.agents||[]).some(x=>x.id!==a.id&&dist(mine,canonicalAgentPoint(x,w))<.35);if(!near)return{x:0,y:0};return a.id==='agent-mara'?{x:-14,y:2}:{x:14,y:-2}}",
'agent presentation offset')

once("this.cameras.main.setBackgroundColor(COLORS.meadow);this.cameras.main.setBounds(0,0,WORLD,WORLD);this.cameras.main.setZoom(innerWidth<650?.82:1.02);",
"this.cameras.main.setBackgroundColor(COLORS.meadow);this.cameras.main.setBounds(0,0,WORLD,WORLD);this.cameras.main.roundPixels=true;this.cameras.main.setZoom(innerWidth<650?.98:1.08);",
'camera presentation')

once("fills=[COLORS.meadow,COLORS.forest,COLORS.wet,COLORS.bank,COLORS.water]",
"fills=[COLORS.meadow,COLORS.forest,COLORS.wet,'#6f7658',COLORS.water]",
'terrain bank blend')

once("this.drawCreekDetails();this.spawnForest();this.drawCanonicalObjects();this.renderEntities(true);this.spawnAmbientLife();this.renderWeather();",
"this.drawCreekDetails();this.spawnGroundDetail();this.spawnForest();this.drawCanonicalObjects();this.renderEntities(true);this.spawnAmbientLife();this.renderWeather();",
'ground detail call')

start=s.index(' drawCreekDetails(){')
end=s.index(' spawnForest(){',start)
new_creek=""" drawCreekDetails(){
  const pts=creekPoints().map(worldToPx);if(pts.length<2)return;const curve=new Phaser.Curves.Spline(pts),sample=curve.getSpacedPoints(190),g=this.add.graphics().setDepth(8),R=seeded('phaser-creek-organic-v1_1');
  // Build the channel from overlapping pools instead of parallel road-like strokes.
  g.fillStyle(0x5f9fb6,.98);for(let i=0;i<sample.length;i++){const p=sample[i],t=i/Math.max(1,sample.length-1),r=25+Math.sin(t*17.1)*3.8+Math.sin(t*41.7)*2.1;g.fillCircle(p.x,p.y,r)}
  const depth=this.add.graphics().setDepth(9);depth.fillStyle(0x467b94,.18);for(let i=3;i<sample.length-3;i+=2){const p=sample[i],t=i/(sample.length-1),r=13+Math.sin(t*12.2+1.5)*2.4;depth.fillCircle(p.x,p.y+2,r)}
  const shore=this.add.graphics().setDepth(14);for(let i=5;i<sample.length-5;i+=4+Math.floor(R()*7)){const p=sample[i],p2=sample[i+1],dx=p2.x-p.x,dy=p2.y-p.y,m=Math.hypot(dx,dy)||1,n={x:-dy/m,y:dx/m};for(const side of[-1,1]){const q={x:p.x+n.x*side*(31+R()*19),y:p.y+n.y*side*(31+R()*19)};if(R()<.55){shore.fillStyle(R()<.55?0x665b45:0x7e7457,.16+R()*.14);shore.fillEllipse(q.x,q.y,18+R()*28,7+R()*12)}if(R()<.48){const reeds=this.add.image(q.x+(R()-.5)*11,q.y+(R()-.5)*7,'reeds').setOrigin(.5,1).setScale(.22+.12*R()).setDepth(1000+q.y);this.tweens.add({targets:reeds,angle:side*(.8+R()*1.2),duration:1600+R()*1100,yoyo:true,repeat:-1,ease:'Sine.InOut'})}if(R()<.22)shore.fillStyle(0x828b85,.75).fillEllipse(q.x+(R()-.5)*13,q.y+(R()-.5)*8,6+R()*8,4+R()*5)}}
  const ripples=this.add.graphics().setDepth(11);ripples.lineStyle(1,0xd7edf0,.13);for(let i=12;i<sample.length-12;i+=13){const p=sample[i],w=10+R()*20;ripples.beginPath();ripples.moveTo(p.x-w,p.y);ripples.lineTo(p.x+w,p.y);ripples.strokePath()}
  this.riverCurve=curve
 }
 spawnGroundDetail(){const R=seeded('ground-life-v1_1');for(let i=0;i<210;i++){const p={x:1+R()*98,y:1+R()*98},t=terrainTypeAt(p);if(t===TERRAIN.WATER||t===TERRAIN.BANK)continue;const q=worldToPx(p),tuft=this.add.image(q.x,q.y,'reeds').setOrigin(.5,1).setScale(t===TERRAIN.WETLAND?.13:.075+R()*.045).setAlpha(t===TERRAIN.FOREST?.38:.26).setTint(t===TERRAIN.WETLAND?0x8c9d60:t===TERRAIN.FOREST?0x506b48:0x87966d).setDepth(30+q.y*.01);if(R()<.16)this.tweens.add({targets:tuft,angle:(R()-.5)*2,duration:1800+R()*1300,yoyo:true,repeat:-1,ease:'Sine.InOut'})}}
"""
s=s[:start]+new_creek+s[end:]

once("const R=seeded('canonical-forest-v1'),spots=[];for(let tries=0;tries<900&&spots.length<92;tries++){",
"const R=seeded('canonical-forest-v1_1'),spots=[];for(let tries=0;tries<4200&&spots.length<96;tries++){",
'forest sampling')
once("if(spots.some(q=>dist(p,q)<2.0))continue;spots.push(p)","if(spots.some(q=>dist(p,q)<1.55))continue;spots.push(p)",'forest spacing')
once("const targetH=58+R()*26;","const targetH=64+R()*27;",'tree scale')

old="const fallback=canonicalAgentPoint(a),to=worldToPx(a.activeAction?.to||fallback),from=worldToPx(a.activeAction?.from||fallback);if(initial&&dist(pxToWorld(from),pxToWorld(to))>.35)"
new="const fallback=canonicalAgentPoint(a),to=worldToPx(a.activeAction?.to||fallback),from=worldToPx(a.activeAction?.from||fallback),off=agentPresentationOffset(a);to.x+=off.x;to.y+=off.y;from.x+=off.x;from.y+=off.y;if(initial&&dist(pxToWorld(from),pxToWorld(to))>.35)"
once(old,new,'agent offset application')

once("version:'phaser-v1-living-world'","version:'phaser-v1.1-living-world'",'debug version')
p.write_text(s)

p=Path('scripts/phaser-qa.mjs');q=p.read_text();q=q.replace("s.version!=='phaser-v1-living-world'","s.version!=='phaser-v1.1-living-world'")
q=q.replace("if(s.trees<30)","if(s.trees<55)")
q=q.replace("await page.screenshot({path:'phaser-qa/mobile-camp.png'});","await page.screenshot({path:'phaser-qa/mobile-camp.png'});\nawait page.evaluate(()=>window.ChatGPTFarmPhaserDebug.focusWorldUnit(14,29,1.0));await page.waitForTimeout(300);await page.screenshot({path:'phaser-qa/mobile-forest.png'});")
p.write_text(q)
