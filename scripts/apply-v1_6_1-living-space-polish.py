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

if "phaser-v1.6.1-living-space" not in render:
    render=replace_once(render,"this.weatherMemoryVisuals=[];this.decisionCue","this.weatherMemoryVisuals=[];this.campWearVisuals=[];this.decisionCue",'camp wear scene state')
    render=replace_once(render,"this.drawCanonicalObjects();this.renderResourceLandscape();","this.drawCanonicalObjects();this.renderCampWear();this.renderResourceLandscape();",'initial camp wear render')
    render=replace_once(render,"refreshDynamicWorld(){this.renderTravelWear();this.renderResourceLandscape();","refreshDynamicWorld(){this.renderTravelWear();this.renderCampWear();this.renderResourceLandscape();",'dynamic camp wear render')

    old_camp="if(o.type==='camp_area'){const uses=canonical?.surfaceHistory?.campWear?.uses||0,strength=clamp(uses/28,0,1);this.add.ellipse(p.x,p.y+8,150+strength*34,78+strength*16,0x675a43,.12+strength*.11).setDepth(15);continue}"
    render=replace_once(render,old_camp,"if(o.type==='camp_area'){continue}",'remove static camp wear')

    travel_anchor=' renderTravelWear(){'
    camp_method=r''' renderCampWear(){
  for(const v of this.campWearVisuals){this.tweens.killTweensOf(v);v.destroy()}this.campWearVisuals=[];
  const camp=(canonical?.worldModel?.objects||[]).find(o=>o.type==='camp_area'&&o.state?.active!==false),uses=canonical?.surfaceHistory?.campWear?.uses||0;
  if(!camp||uses<=0){this.campWearState={uses,scuffs:0,visuals:0};return}
  const keep=v=>{this.campWearVisuals.push(v);return v},p=worldToPx(camp.position),strength=clamp(uses/28,0,1),R=seeded('canonical-camp-wear-v1');
  keep(this.add.ellipse(p.x,p.y+9,142+strength*48,70+strength*24,0x62543e,.075+strength*.12).setDepth(14));
  const scuffs=Math.min(22,3+Math.floor(uses*.72));
  for(let i=0;i<scuffs;i++){const a=R()*Math.PI*2,rr=18+Math.sqrt(R())*(64+strength*18),x=p.x+Math.cos(a)*rr,y=p.y+Math.sin(a)*rr*.48,w=7+R()*20,h=2.5+R()*7;keep(this.add.ellipse(x,y,w,h,R()<.62?0x6a5a42:0x77664b,.04+strength*(.045+R()*.055)).setRotation((R()-.5)*1.4).setDepth(15))}
  if(uses>=8){const g=keep(this.add.graphics().setDepth(16));g.lineStyle(1.1,0x5b4d39,.05+strength*.09);for(let i=0;i<Math.min(9,Math.floor(uses/2));i++){const a=R()*Math.PI*2,rr=25+R()*50,x=p.x+Math.cos(a)*rr,y=p.y+Math.sin(a)*rr*.5;g.lineBetween(x-3-R()*5,y,x+3+R()*6,y+(R()-.5)*3)}}
  this.campWearState={uses,scuffs,visuals:this.campWearVisuals.length};
 }
'''
    render=replace_once(render,travel_anchor,camp_method+travel_anchor,'dynamic camp wear method')

    render=render.replace("const alpha=nearForest ? .34 : .24;","const alpha=nearForest ? .40 : .29;")
    render=render.replace("const base=nearForest?0x76865e:0x87946c;","const base=nearForest?0x71845a:0x829168;")

    render=render.replace("bank.lineStyle(66+wet*42,0x443f35,.022+wet*.095);","bank.lineStyle(66+wet*42,0x443f35,.035+wet*.12);")
    render=render.replace("const amount=Math.round((wet-.38)*32);","const amount=Math.round((wet-.34)*42);")
    render=render.replace("const q=worldToPx(p),alpha=.012+wet*.035;","const q=worldToPx(p),alpha=.024+wet*.055;")
    old_puddle="const q=worldToPx(p),puddle=keep(this.add.ellipse(q.x,q.y,12+R()*26,4+R()*9,0x6e9494,.035+(wet-.7)*.12).setDepth(19));puddle.setStrokeStyle(1,0xa4b9ad,.025+wet*.04)"
    new_puddle="const q=worldToPx(p),pw=12+R()*26,ph=4+R()*9,puddle=keep(this.add.ellipse(q.x,q.y,pw,ph,0x6e9494,.065+(wet-.7)*.2).setDepth(19));puddle.setStrokeStyle(1,0xb8c9bd,.035+wet*.05);keep(this.add.ellipse(q.x-pw*.12,q.y-ph*.12,pw*.42,Math.max(1,ph*.18),0xc0d5cf,.025+(wet-.7)*.08).setDepth(20))"
    render=replace_once(render,old_puddle,new_puddle,'puddle readability')

    render=render.replace("version:'phaser-v1.6-weather-memory'","version:'phaser-v1.6.1-living-space'")
    render=replace_once(render,"campWear:canonical?.surfaceHistory?.campWear?.uses||0,signVisuals:","campWear:canonical?.surfaceHistory?.campWear?.uses||0,campWearVisuals:this.campWearVisuals.length,campWearState:this.campWearState||null,signVisuals:",'camp wear snapshot')
    render_path.write_text(render)

qa=qa_path.read_text().replace("s.version!=='phaser-v1.6-weather-memory'","s.version!=='phaser-v1.6.1-living-space'")
if 'camp wear visual projection missing' not in qa:
    anchor="if(s.livingWorld?.campWear!==12)failures.push(`camp-wear projection drift: ${s.livingWorld?.campWear}`);"
    qa=replace_once(qa,anchor,anchor+"if((s.livingWorld?.campWearVisuals||0)<5||s.livingWorld?.campWearState?.uses!==12)failures.push(`camp wear visual projection missing: ${JSON.stringify(s.livingWorld?.campWearState)}`);",'camp wear visual QA')
qa_path.write_text(qa)

html=html_path.read_text().replace('v=001600001','v=001600002')
html_path.write_text(html)
print('Applied v1.6.1 screenshot-driven living-space polish.')
