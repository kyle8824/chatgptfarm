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

if "phaser-v1.6.2-world-depth" not in render:
    # Stronger broad-scale terrain variation without introducing gameplay objects.
    old_mosaic=""" drawMeadowMosaic(){
  const R=seeded('meadow-mosaic-v1_4_3');
  for(let i=0;i<46;i++){
   const p={x:3+R()*94,y:3+R()*94};
   if(terrainTypeAt(p)!==TERRAIN.MEADOW)continue;
   const q=worldToPx(p),w=90+R()*220,h=42+R()*120,col=R()<.5?0x617754:0x80916b;
   this.add.ellipse(q.x,q.y,w,h,col,.025+R()*.035).setRotation((R()-.5)*.7).setDepth(-8);
  }
 }
"""
    new_mosaic=""" drawMeadowMosaic(){
  const R=seeded('meadow-mosaic-v1_6_2');this.meadowRelief={patches:0,contours:0};
  for(let i=0;i<78;i++){
   const p={x:3+R()*94,y:3+R()*94};
   if(terrainTypeAt(p)!==TERRAIN.MEADOW)continue;
   const q=worldToPx(p),w=80+R()*250,h=34+R()*118,dark=R()<.54,col=dark?0x5f7451:0x91a077,alpha=(dark?.032:.022)+R()*.045;
   this.add.ellipse(q.x,q.y,w,h,col,alpha).setRotation((R()-.5)*.72).setDepth(-8);this.meadowRelief.patches++;
   if(R()<.38){const g=this.add.graphics().setDepth(-7),tilt=(R()-.5)*.8,len=55+R()*120,dy=8+R()*19;g.lineStyle(1.2,dark?0x4e6345:0xa1ad86,.026+R()*.036);g.beginPath();g.moveTo(q.x-len*.5,q.y+Math.sin(tilt)*dy);g.quadraticCurveTo(q.x,q.y-dy,q.x+len*.5,q.y-Math.sin(tilt)*dy);g.strokePath();this.meadowRelief.contours++}
  }
 }
"""
    render=replace_once(render,old_mosaic,new_mosaic,'meadow depth')

    # Make canonical route wear visible enough to read on mobile while remaining subtle.
    old_route="g.lineStyle(9,0x685b43,.025+.055*strength);g.strokePoints(pts,false,false);g.lineStyle(2.2,0x8b795b,.04+.095*strength);g.strokePoints(pts,false,false)"
    new_route="g.lineStyle(11,0x62553f,.035+.078*strength);g.strokePoints(pts,false,false);g.lineStyle(2.6,0x917e5e,.055+.13*strength);g.strokePoints(pts,false,false)"
    render=replace_once(render,old_route,new_route,'route readability')

    # Camp wear: stronger bare-soil core + edge compression + use-derived scuffs.
    old_base="keep(this.add.ellipse(p.x,p.y+9,142+strength*48,70+strength*24,0x62543e,.075+strength*.12).setDepth(14));"
    new_base="keep(this.add.ellipse(p.x,p.y+10,148+strength*54,74+strength*27,0x5f513c,.105+strength*.16).setDepth(14));keep(this.add.ellipse(p.x-4,p.y+7,96+strength*28,44+strength*12,0x715f46,.055+strength*.10).setDepth(14.5));"
    render=replace_once(render,old_base,new_base,'camp bare ground')
    render=render.replace(".04+strength*(.045+R()*.055)",".055+strength*(.065+R()*.075)")
    render=render.replace("g.lineStyle(1.1,0x5b4d39,.05+strength*.09)","g.lineStyle(1.2,0x564834,.07+strength*.12)")

    # Replace the symmetric tent-like branch shelter with a rough canonical lean-to interpretation.
    old_shelter="""this.campVisualMode='canonical-branch-camp-v1';const shelter=(canonical.worldModel?.objects||[]).find(o=>o.type==='branch_shelter'&&o.state?.active);if(shelter){const p=worldToPx(shelter.position),d=1000+p.y;this.add.ellipse(p.x+3,p.y+14,112,33,0x17251b,.2).setDepth(d-5);const g=this.add.graphics().setDepth(d);g.fillStyle(0x765239,.98);g.fillTriangle(p.x-48,p.y+11,p.x+2,p.y-54,p.x+50,p.y+11);g.fillStyle(0x513a2d,.98);g.fillTriangle(p.x-24,p.y+10,p.x+2,p.y-35,p.x+27,p.y+10);g.fillStyle(0x25271f,.88);g.fillTriangle(p.x-13,p.y+10,p.x+2,p.y-20,p.x+17,p.y+10);g.lineStyle(5,0x5b402d,1);g.lineBetween(p.x-50,p.y+12,p.x+2,p.y-56);g.lineBetween(p.x+50,p.y+12,p.x+2,p.y-56);g.lineStyle(2,0xa77a53,.7);g.lineBetween(p.x-33,p.y-8,p.x+31,p.y-7);g.lineBetween(p.x-23,p.y-24,p.x+21,p.y-23)}"""
    new_shelter="""this.campVisualMode='canonical-lean-to-v2';const shelter=(canonical.worldModel?.objects||[]).find(o=>o.type==='branch_shelter'&&o.state?.active);if(shelter){const p=worldToPx(shelter.position),d=1000+p.y,R=seeded('branch-shelter-lean-to-v2');this.add.ellipse(p.x+3,p.y+15,126,34,0x17251b,.22).setDepth(d-5);const g=this.add.graphics().setDepth(d);g.fillStyle(0x61513a,.96);g.beginPath();g.moveTo(p.x-52,p.y+10);g.lineTo(p.x-27,p.y-42);g.lineTo(p.x+19,p.y-34);g.lineTo(p.x+52,p.y+11);g.closePath();g.fillPath();g.fillStyle(0x394631,.52);for(let i=0;i<7;i++){const x=p.x-40+i*13+R()*5,y=p.y-4-i%2*4;g.fillEllipse(x,y,19+R()*14,8+R()*7)}g.lineStyle(5,0x503a29,1);g.lineBetween(p.x-52,p.y+12,p.x-27,p.y-43);g.lineBetween(p.x+51,p.y+12,p.x+19,p.y-35);g.lineBetween(p.x-28,p.y-42,p.x+20,p.y-34);g.lineStyle(2.2,0x8a6848,.78);for(let i=0;i<6;i++){const t=i/5,x1=p.x-48+t*91,y1=p.y+6-t*42,x2=x1+25,y2=y1+7;g.lineBetween(x1,y1,x2,y2)}g.fillStyle(0x25271f,.78);g.fillEllipse(p.x+24,p.y+7,32,13)}"""
    render=replace_once(render,old_shelter,new_shelter,'lean-to shelter')

    # Slightly enrich grass detail while keeping it presentation-only.
    render=render.replace("for(let i=0;i<980;i++){","for(let i=0;i<1180;i++){",1)
    render=render.replace("const stems=nearForest?3+Math.floor(R()*5):2+Math.floor(R()*4);","const stems=nearForest?3+Math.floor(R()*5):2+Math.floor(R()*5);")

    render=render.replace("version:'phaser-v1.6.1-living-space'","version:'phaser-v1.6.2-world-depth'")
    render=replace_once(render,"habitatDetail:this.habitatDetail||null,lightCycle:","habitatDetail:this.habitatDetail||null,meadowRelief:this.meadowRelief||null,lightCycle:",'world depth snapshot')
    render_path.write_text(render)

qa=qa_path.read_text().replace("s.version!=='phaser-v1.6.1-living-space'","s.version!=='phaser-v1.6.2-world-depth'")
qa=qa.replace("s.campVisualMode!=='canonical-branch-camp-v1'","s.campVisualMode!=='canonical-lean-to-v2'")
if 'meadow relief missing' not in qa:
    anchor="if(!s.habitatDetail||s.habitatDetail.meadow<100||s.habitatDetail.forest<20)failures.push(`habitat detail missing: ${JSON.stringify(s.habitatDetail)}`);"
    qa=replace_once(qa,anchor,anchor+"if(!s.meadowRelief||s.meadowRelief.patches<35||s.meadowRelief.contours<8)failures.push(`meadow relief missing: ${JSON.stringify(s.meadowRelief)}`);",'meadow relief QA')
qa_path.write_text(qa)

html=html_path.read_text().replace('v=001600002','v=001600003')
html_path.write_text(html)
print('Applied v1.6.2 world-depth and camp-quality pass.')
