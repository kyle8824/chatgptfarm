from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one patch anchor, found {count}")
    return text.replace(old, new, 1)

renderer_path=Path('phaser-world-v1.js')
qa_path=Path('scripts/phaser-qa.mjs')
html_path=Path('phaser.html')
renderer=renderer_path.read_text()

if "habitat-depth-v1" not in renderer:
    renderer=replace_once(renderer,
        "this.drawOrganicSurface();this.drawBiomeUnderlays();this.drawCreekDetails();this.spawnGroundDetail();this.spawnForest();",
        "this.drawOrganicSurface();this.drawBiomeUnderlays();this.drawMeadowMosaic();this.drawCreekDetails();this.spawnGroundDetail();this.spawnForest();",
        'meadow mosaic build order')
    anchor=" drawCreekDetails(){"
    meadow=r''' drawMeadowMosaic(){
  const R=seeded('meadow-mosaic-v1_4_3');
  for(let i=0;i<46;i++){
   const p={x:3+R()*94,y:3+R()*94};
   if(terrainTypeAt(p)!==TERRAIN.MEADOW)continue;
   const q=worldToPx(p),w=90+R()*220,h=42+R()*120,col=R()<.5?0x617754:0x80916b;
   this.add.ellipse(q.x,q.y,w,h,col,.025+R()*.035).setRotation((R()-.5)*.7).setDepth(-8);
  }
 }
'''
    renderer=replace_once(renderer,anchor,meadow+anchor,'meadow mosaic method')
    old_ground=" spawnGroundDetail(){const R=seeded('ground-life-v1_3');for(let i=0;i<430;i++){const p={x:1+R()*98,y:1+R()*98},t=terrainTypeAt(p);if(t===TERRAIN.WATER||t===TERRAIN.BANK)continue;const q=worldToPx(p);if(t===TERRAIN.FOREST&&R()<.48){const key='shrub-00'+(1+Math.floor(R()*3));if(this.textures.exists(key)){const b=this.add.image(q.x,q.y,key).setOrigin(.5,1).setScale(.18+.14*R()).setAlpha(.45+.3*R()).setDepth(900+q.y);if(R()<.12)this.tweens.add({targets:b,angle:(R()-.5)*1.6,duration:2400+R()*1200,yoyo:true,repeat:-1,ease:'Sine.InOut'});continue}}const tuft=this.add.image(q.x,q.y,'reeds').setOrigin(.5,1).setScale(t===TERRAIN.WETLAND?.11:.045+R()*.04).setAlpha(t===TERRAIN.FOREST?.24:t===TERRAIN.WETLAND?.38:.18).setTint(t===TERRAIN.WETLAND?0x91a45e:t===TERRAIN.FOREST?0x4b6745:0x8d9d70).setDepth(45+q.y*.01);if(R()<.11)this.tweens.add({targets:tuft,angle:(R()-.5)*2,duration:1900+R()*1500,yoyo:true,repeat:-1,ease:'Sine.InOut'})}}"
    new_ground=r''' spawnGroundDetail(){
  const R=seeded('ground-life-v1_4_3');
  this.habitatDetail={meadow:0,edge:0,forest:0,wetland:0};
  const edgeOffsets=[[2,0],[-2,0],[0,2],[0,-2],[1.5,1.5],[-1.5,-1.5]];
  for(let i=0;i<980;i++){
   const p={x:1+R()*98,y:1+R()*98};
   const t=terrainTypeAt(p);
   if(t===TERRAIN.WATER||t===TERRAIN.BANK)continue;
   const q=worldToPx(p);
   let nearForest=false;
   if(t===TERRAIN.MEADOW){
    nearForest=edgeOffsets.some(([dx,dy])=>terrainTypeAt({x:clamp(p.x+dx,0,100),y:clamp(p.y+dy,0,100)})===TERRAIN.FOREST);
   }
   if(t===TERRAIN.FOREST){
    this.habitatDetail.forest++;
    if(R()<.57){
     const key='shrub-00'+(1+Math.floor(R()*3));
     if(this.textures.exists(key)){
      const b=this.add.image(q.x,q.y,key).setOrigin(.5,1).setScale(.12+.16*R()).setTint(R()<.5?0x62775b:0x52684f).setAlpha(.38+.32*R()).setDepth(900+q.y);
      if(R()<.1)this.tweens.add({targets:b,angle:(R()-.5)*1.2,duration:2600+R()*1500,yoyo:true,repeat:-1,ease:'Sine.InOut'});
      continue;
     }
    }
    this.add.ellipse(q.x,q.y,5+R()*13,2+R()*5,R()<.55?0x4f5b43:0x675d45,.15+R()*.14).setDepth(40+q.y*.01);
    continue;
   }
   if(t===TERRAIN.WETLAND){
    this.habitatDetail.wetland++;
    const tuft=this.add.image(q.x,q.y,'reeds').setOrigin(.5,1).setScale(.07+.09*R()).setAlpha(.3+.24*R()).setTint(R()<.5?0x82975c:0x6e8a5f).setDepth(920+q.y);
    if(R()<.18)this.tweens.add({targets:tuft,angle:(R()-.5)*2.2,duration:1800+R()*1600,yoyo:true,repeat:-1,ease:'Sine.InOut'});
    continue;
   }
   this.habitatDetail.meadow++;
   if(nearForest&&R()<.48){
    this.habitatDetail.edge++;
    if(R()<.42){
     const key='shrub-00'+(1+Math.floor(R()*3));
     if(this.textures.exists(key)){
      this.add.image(q.x,q.y,key).setOrigin(.5,1).setScale(.08+.10*R()).setTint(0x70805f).setAlpha(.28+.22*R()).setDepth(880+q.y);
      continue;
     }
    }
   }
   const g=this.add.graphics().setDepth(50+q.y*.01);
   const stems=nearForest?3+Math.floor(R()*5):2+Math.floor(R()*4);
   const base=nearForest?0x76865e:0x87946c;
   const alpha=nearForest?.28:.18;
   g.lineStyle(1,base,alpha);
   for(let k=0;k<stems;k++){
    const ox=(R()-.5)*(nearForest?15:11),hh=(nearForest?7:4)+R()*(nearForest?15:10);
    g.lineBetween(q.x+ox,q.y,q.x+ox+(R()-.5)*4,q.y-hh);
   }
   if(R()<.08&&!nearForest)this.add.ellipse(q.x+(R()-.5)*10,q.y+(R()-.5)*5,10+R()*18,4+R()*8,0x657857,.08).setDepth(35);
  }
 }
'''.replace("const alpha=nearForest?.28:.18;","const alpha=nearForest ? .28 : .18;")
    renderer=replace_once(renderer,old_ground,new_ground,'layered habitat ground detail')
    renderer=replace_once(renderer,
        "embodiment:'embodiment-v1',lightCycle:this.lightCycle||null,livingWorld:",
        "embodiment:'embodiment-v1',habitatDepth:'habitat-depth-v1',habitatDetail:this.habitatDetail||null,lightCycle:this.lightCycle||null,livingWorld:",
        'habitat snapshot')
    renderer_path.write_text(renderer)
else:
    print('Habitat depth pass already applied.')

qa=qa_path.read_text()
needle="if(!s.lightCycle||s.lightCycle.hour!==state.hour)failures.push(`light cycle state missing or stale: ${JSON.stringify(s.lightCycle)}`);"
if "habitat detail missing" not in qa:
    qa=replace_once(qa,needle,needle+"if(!s.habitatDetail||s.habitatDetail.meadow<100||s.habitatDetail.forest<20)failures.push(`habitat detail missing: ${JSON.stringify(s.habitatDetail)}`);",'habitat detail QA')
if "mobile-dusk.png" not in qa:
    end_anchor="await page.evaluate(()=>window.ChatGPTFarmPhaserDebug.focusWorldUnit(14,29,1.0));await page.waitForTimeout(300);await page.screenshot({path:'phaser-qa/mobile-forest.png'});"
    extras=end_anchor+"\n\nstate=JSON.parse(JSON.stringify(state));state.meta=state.meta||{};state.meta.tickNumber=Number(state.meta.tickNumber||0)+50;state.hour=20;state.weather='clear';await page.evaluate(()=>window.ChatGPTFarmPhaserDebug.reload());await page.waitForTimeout(650);let light=await snap();if(light.lightCycle?.hour!==20||light.lightCycle?.alpha<.1)failures.push(`dusk lighting failed: ${JSON.stringify(light.lightCycle)}`);await page.evaluate(()=>window.ChatGPTFarmPhaserDebug.focusWorldUnit(64,34,1.0));await page.waitForTimeout(200);await page.screenshot({path:'phaser-qa/mobile-dusk.png'});state.hour=2;state.meta.tickNumber++;await page.evaluate(()=>window.ChatGPTFarmPhaserDebug.reload());await page.waitForTimeout(650);light=await snap();if(light.lightCycle?.hour!==2||light.lightCycle?.alpha<.25)failures.push(`night lighting failed: ${JSON.stringify(light.lightCycle)}`);await page.screenshot({path:'phaser-qa/mobile-night.png'});state.hour=12;state.weather='rain';state.meta.tickNumber++;await page.evaluate(()=>window.ChatGPTFarmPhaserDebug.reload());await page.waitForTimeout(650);"
    qa=replace_once(qa,end_anchor,extras,'dusk/night screenshot QA')
qa_path.write_text(qa)

html=html_path.read_text().replace('phaser-world.css?v=00142','phaser-world.css?v=00143').replace('phaser-world-v1.js?v=00142','phaser-world-v1.js?v=00143')
html_path.write_text(html)
print('Applied v1.4.3 habitat depth and dusk/night visual QA.')
