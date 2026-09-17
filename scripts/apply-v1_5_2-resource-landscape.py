from pathlib import Path


def replace_once(text, old, new, label):
    count=text.count(old)
    if count!=1:
        raise SystemExit(f'{label}: expected exactly one anchor, found {count}')
    return text.replace(old,new,1)

renderer_path=Path('phaser-world-v1.js')
browser_path=Path('scripts/phaser-qa.mjs')
html_path=Path('phaser.html')
renderer=renderer_path.read_text()

if "resource-responsive-v1" not in renderer:
    renderer=replace_once(renderer,"this.signVisuals=[];this.routeVisuals=[];", "this.signVisuals=[];this.routeVisuals=[];this.resourceVisuals=[];",'resource visual scene state')
    berry="make('berry-bush',(g)=>{g.fillStyle(0x3e713f,1).fillCircle(31,35,22).fillCircle(48,38,18).fillCircle(39,24,20);g.fillStyle(0xc74f5a,1);for(const [x,y] of [[27,29],[42,25],[49,39],[35,45]])g.fillCircle(x,y,3)},76,68);"
    empty=berry+"make('berry-bush-empty',(g)=>{g.fillStyle(0x3b693d,1).fillCircle(31,35,22).fillCircle(48,38,18).fillCircle(39,24,20);g.lineStyle(1.4,0x5b4d38,.7);g.lineBetween(28,48,42,20);g.lineBetween(38,39,51,30)},76,68);"
    renderer=replace_once(renderer,berry,empty,'empty berry bush texture')
    renderer=replace_once(renderer,"this.drawCanonicalObjects();this.renderCanonicalTraces();", "this.drawCanonicalObjects();this.renderResourceLandscape();this.renderCanonicalTraces();",'initial resource landscape')
    renderer=replace_once(renderer,"refreshDynamicWorld(){this.renderTravelWear();this.renderCanonicalTraces();", "refreshDynamicWorld(){this.renderTravelWear();this.renderResourceLandscape();this.renderCanonicalTraces();",'dynamic resource landscape')
    old_loop="drawCanonicalObjects(){for(const o of canonical.worldModel?.objects||[]){if(o.state?.active===false||o.parentId||o.type==='creek_segment'||o.type==='frontier')continue;const p="
    new_loop="drawCanonicalObjects(){for(const o of canonical.worldModel?.objects||[]){if(o.state?.active===false||o.parentId||o.type==='creek_segment'||o.type==='frontier')continue;if(['stone_field','clay_bank','reed_marsh','berry_patch'].includes(o.type))continue;const p="
    renderer=replace_once(renderer,old_loop,new_loop,'skip dynamic resource objects in static pass')
    anchor=" renderEntities(initial=false){"
    method=r''' renderResourceLandscape(){
  for(const v of this.resourceVisuals){this.tweens.killTweensOf(v);v.destroy()}this.resourceVisuals=[];
  const keep=v=>{this.resourceVisuals.push(v);return v},res=canonical?.resources||{},state={stonesLoose:0,reedsStanding:0,berryFruitingBushes:0,clayRichness:0};
  for(const o of canonical.worldModel?.objects||[]){if(o.state?.active===false||o.parentId||!o.position||!['stone_field','clay_bank','reed_marsh','berry_patch'].includes(o.type))continue;const p=worldToPx(o.position),R=seeded(`${o.id}:resource-v1`);
   if(o.type==='stone_field'){const ratio=clamp((res.stones||0)/24,0,1),count=Math.round(13*ratio);state.stonesLoose=count;keep(this.add.ellipse(p.x,p.y,130,62,0x6d7269,.07).setDepth(17));for(let i=0;i<count;i++){const a=R()*Math.PI*2,rr=Math.sqrt(R())*58,x=p.x+Math.cos(a)*rr,y=p.y+Math.sin(a)*rr*.55;keep(this.add.ellipse(x,y,8+R()*12,5+R()*7,0x8c9690,.95).setDepth(1000+y))}continue}
   if(o.type==='clay_bank'){const ratio=clamp((res.clay||0)/10,0,1);state.clayRichness=+ratio.toFixed(2);keep(this.add.ellipse(p.x+6,p.y+13,105,28,0x744a38,.72).setDepth(17).setScale(1,.45));const rich=keep(this.add.ellipse(p.x,p.y-2,62+56*ratio,31+14*ratio,0xa96f4d,.52+.3*ratio).setDepth(18));rich.setStrokeStyle(2,0xc9956c,.22+.22*ratio);const scars=Math.round((1-ratio)*6);if(scars){const g=keep(this.add.graphics().setDepth(19));g.lineStyle(2,0x604238,.45);for(let i=0;i<scars;i++){const x=p.x-36+R()*72,y=p.y-10+R()*25;g.lineBetween(x,y,x+6+R()*9,y+5+R()*5)}}continue}
   if(o.type==='reed_marsh'){const ratio=clamp((res.reeds||0)/18,0,1),count=Math.round(28*ratio);state.reedsStanding=count;keep(this.add.ellipse(p.x,p.y+4,190,108,0x587569,.18).setDepth(11));for(let i=0;i<28;i++){const a=R()*Math.PI*2,rr=Math.sqrt(R())*82,x=p.x+Math.cos(a)*rr,y=p.y+Math.sin(a)*rr*.55;if(i<count){const reed=keep(this.add.image(x,y,'reeds').setOrigin(.5,1).setScale(.27+.18*R()).setAlpha(.78+.18*ratio).setDepth(1000+y));this.tweens.add({targets:reed,angle:(R()-.5)*2.5,duration:1500+R()*1300,yoyo:true,repeat:-1,ease:'Sine.InOut'})}else if(i<count+Math.min(8,28-count)){const g=keep(this.add.graphics().setDepth(900+y));g.lineStyle(1.4,0x667655,.32);g.lineBetween(x,y,x+(R()-.5)*3,y-(4+R()*7))}}continue}
   if(o.type==='berry_patch'){const ratio=clamp((res.berries||0)/20,0,1),fruiting=Math.round(9*ratio);state.berryFruitingBushes=fruiting;for(let i=0;i<9;i++){const a=R()*Math.PI*2,rr=Math.sqrt(R())*58,x=p.x+Math.cos(a)*rr,y=p.y+Math.sin(a)*rr*.52,key=i<fruiting?'berry-bush':'berry-bush-empty';keep(this.add.image(x,y,key).setOrigin(.5,1).setScale(.42+.08*R()).setAlpha(.92).setDepth(1000+y))}}
  }
  this.resourceVisualState=state;
 }
'''
    renderer=replace_once(renderer,anchor,method+anchor,'resource landscape renderer')
    renderer=replace_once(renderer,"travelWear:'travel-wear-v1',rangePresenceCounts:", "travelWear:'travel-wear-v1',resourceLandscape:'resource-responsive-v1',resourceVisualState:this.resourceVisualState||null,rangePresenceCounts:",'resource landscape snapshot')
    renderer_path.write_text(renderer)
else:
    print('resource-responsive landscape already present')

browser=browser_path.read_text()
if 'expectedResourceVisuals' not in browser:
    anchor="if(s.livingWorld?.campWear!==12)failures.push(`camp-wear projection drift: ${s.livingWorld?.campWear}`);"
    checks=anchor+"const expectedResourceVisuals={stonesLoose:Math.round(13*Math.max(0,Math.min(1,(state.resources?.stones||0)/24))),reedsStanding:Math.round(28*Math.max(0,Math.min(1,(state.resources?.reeds||0)/18))),berryFruitingBushes:Math.round(9*Math.max(0,Math.min(1,(state.resources?.berries||0)/20))),clayRichness:+Math.max(0,Math.min(1,(state.resources?.clay||0)/10)).toFixed(2)};if(JSON.stringify(s.resourceVisualState)!==JSON.stringify(expectedResourceVisuals))failures.push(`resource landscape drift: ${JSON.stringify(s.resourceVisualState)} != ${JSON.stringify(expectedResourceVisuals)}`);"
    browser=replace_once(browser,anchor,checks,'initial resource projection QA')
    shot="await page.screenshot({path:'phaser-qa/mobile-auto.png'});"
    depletion=shot+r'''const savedResources={...state.resources};state.meta.tickNumber=Number(state.meta.tickNumber||0)+31;Object.assign(state.resources,{berries:0,reeds:0,stones:0,clay:0});await page.evaluate(()=>window.ChatGPTFarmPhaserDebug.reload());await page.waitForTimeout(650);let depleted=await snap();if(depleted.resourceVisualState?.stonesLoose!==0||depleted.resourceVisualState?.reedsStanding!==0||depleted.resourceVisualState?.berryFruitingBushes!==0||depleted.resourceVisualState?.clayRichness!==0)failures.push(`depleted resources remained visually full: ${JSON.stringify(depleted.resourceVisualState)}`);await page.screenshot({path:'phaser-qa/mobile-resource-depletion-proof.png'});Object.assign(state.resources,savedResources);state.meta.tickNumber++;await page.evaluate(()=>window.ChatGPTFarmPhaserDebug.reload());await page.waitForTimeout(650);s=await snap();if(JSON.stringify(s.resourceVisualState)!==JSON.stringify(expectedResourceVisuals))failures.push(`resource landscape failed to recover after canonical quantities restored: ${JSON.stringify(s.resourceVisualState)}`);'''
    browser=replace_once(browser,shot,depletion,'resource depletion dynamic QA')
    browser_path.write_text(browser)

html=html_path.read_text().replace('phaser-world.css?v=00151','phaser-world.css?v=00152').replace('phaser-world-v1.js?v=00151','phaser-world-v1.js?v=00152')
html_path.write_text(html)
print('Applied v1.5.2 resource-responsive landscape.')
