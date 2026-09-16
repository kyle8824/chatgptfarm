from pathlib import Path
p=Path('phaser-world-v1.js');s=p.read_text()

def once(old,new,label):
    global s
    if old not in s: raise SystemExit(f'{label} anchor missing')
    s=s.replace(old,new,1)

once("ctx.globalAlpha=1}c.refresh()","ctx.globalAlpha=1}c.refresh();c.setFilter(Phaser.Textures.FilterMode.NEAREST)",'terrain texture filter')
once("this.drawCreekDetails();this.spawnGroundDetail();","this.drawBiomeUnderlays();this.drawCreekDetails();this.spawnGroundDetail();",'biome underlay call')

anchor=" drawCreekDetails(){"
idx=s.index(anchor)
biomes=""" drawBiomeUnderlays(){const m=canonical.worldModel?.bounds?.metersPerUnit||2;for(const t of canonical.worldModel?.terrain||[]){if(!['forest','wetland'].includes(t.type))continue;const p=worldToPx(t.center),r=(t.radiusM||20)/m*TILE,R=seeded(`biome:${t.id}`),col=t.type==='forest'?0x425f45:0x58766a,alpha=t.type==='forest'?.28:.24;for(let i=0;i<6;i++){const a=R()*Math.PI*2,off=r*(.06+R()*.17),rx=r*(.62+R()*.25),ry=r*(.54+R()*.25);this.add.ellipse(p.x+Math.cos(a)*off,p.y+Math.sin(a)*off,rx*2,ry*2,col,alpha).setDepth(2)}}}\n"""
s=s[:idx]+biomes+s[idx:]

start=s.index(' drawCreekDetails(){')
end=s.index(' spawnGroundDetail(){',start)
new_creek=""" drawCreekDetails(){
  const pts=creekPoints().map(worldToPx);if(pts.length<2)return;const curve=new Phaser.Curves.Spline(pts),sample=curve.getSpacedPoints(260),R=seeded('phaser-creek-v1_2');
  const water=this.add.graphics().setDepth(9);water.lineStyle(58,0x5f9fb6,.98).strokePoints(sample,false);water.lineStyle(27,0x467b94,.18).strokePoints(sample,false);
  const shore=this.add.graphics().setDepth(14);for(let i=8;i<sample.length-8;i+=5+Math.floor(R()*8)){const p=sample[i],p2=sample[i+1],dx=p2.x-p.x,dy=p2.y-p.y,m=Math.hypot(dx,dy)||1,n={x:-dy/m,y:dx/m};for(const side of[-1,1]){const d=31+R()*22,q={x:p.x+n.x*side*d,y:p.y+n.y*side*d};if(R()<.62){shore.fillStyle(R()<.58?0x6b6048:0x78805c,.13+R()*.13);shore.fillEllipse(q.x,q.y,15+R()*34,6+R()*13)}if(R()<.52){const reeds=this.add.image(q.x+(R()-.5)*12,q.y+(R()-.5)*8,'reeds').setOrigin(.5,1).setScale(.18+.12*R()).setDepth(1000+q.y);this.tweens.add({targets:reeds,angle:side*(.7+R()*1.1),duration:1600+R()*1100,yoyo:true,repeat:-1,ease:'Sine.InOut'})}if(R()<.23)shore.fillStyle(0x838b84,.72).fillEllipse(q.x+(R()-.5)*15,q.y+(R()-.5)*9,5+R()*9,3+R()*6)}}
  const ripples=this.add.graphics().setDepth(11);ripples.lineStyle(1,0xd7edf0,.14);for(let i=14;i<sample.length-14;i+=17){const p=sample[i],w=8+R()*18;ripples.beginPath();ripples.moveTo(p.x-w,p.y+(R()-.5)*16);ripples.lineTo(p.x+w,p.y+(R()-.5)*16);ripples.strokePath()}this.riverCurve=curve
 }
"""
s=s[:start]+new_creek+s[end:]
once("version:'phaser-v1.1-living-world'","version:'phaser-v1.2-living-world'",'v1.2 debug version')
p.write_text(s)

q=Path('scripts/phaser-qa.mjs');x=q.read_text().replace("s.version!=='phaser-v1.1-living-world'","s.version!=='phaser-v1.2-living-world'")
q.write_text(x)
