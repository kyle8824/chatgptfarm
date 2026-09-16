from pathlib import Path
import json, re

src = Path('world-pixi-v6.js').read_text()

new_tree = r'''function drawTree(x,y,s,R){const c=new PIXI.Container();c.position.set(x,y);c.zIndex=y;const shadow=new PIXI.Graphics();shadow.beginFill(C.shadow,.18).drawEllipse(s*.08,s*.30,s*.72,s*.24).endFill();const trunk=new PIXI.Graphics();trunk.beginFill(0x5a3f2b,.98).drawRoundedRect(-s*.11,-s*.12,s*.22,s*.86,Math.max(2,s*.06)).endFill();trunk.beginFill(0x745039,.42).drawRoundedRect(-s*.07,-s*.08,s*.06,s*.72,2).endFill();const crown=new PIXI.Graphics();crown.beginFill(C.forestLeaf,.99).drawCircle(-s*.34,-s*.68,s*.55).drawCircle(s*.34,-s*.66,s*.58).drawCircle(0,-s*1.03,s*.67).endFill();crown.beginFill(C.forestHi,.48).drawCircle(-s*.19,-s*1.18,s*.30).endFill();c.addChild(shadow,trunk,crown);terrain.addChild(c)}'''

src,n = re.subn(r"function drawTree\(x,y,s,R\)\{.*?\}\nfunction drawAggregateTerrain", new_tree + "\nfunction drawAggregateTerrain", src, count=1, flags=re.S)
if n != 1: raise SystemExit('drawTree anchor not found')

new_aggregate = r'''function drawAggregateTerrain(){for(const t of current.worldModel.terrain||[]){const p=wp(t.center),r=((t.radiusM||20)/2)*PX,R=rng(`${t.id}-v7`);if(t.type==='forest'){for(let i=0;i<58;i++){const a=R()*Math.PI*2,rr=Math.sqrt(R())*r*.96,s=30+R()*17;drawTree(p.x+Math.cos(a)*rr,p.y+Math.sin(a)*rr,s,R)}}else if(t.type==='wetland'){const g=new PIXI.Graphics();for(let i=0;i<34;i++){const a=R()*Math.PI*2,rr=Math.sqrt(R())*r*.94,x=p.x+Math.cos(a)*rr,y=p.y+Math.sin(a)*rr;g.beginFill(i%3?C.wet:C.waterDark,.07+R()*.08).drawEllipse(x,y,18+R()*42,6+R()*15).endFill()}for(let i=0;i<92;i++){const a=R()*Math.PI*2,rr=Math.sqrt(R())*r*.94,x=p.x+Math.cos(a)*rr,y=p.y+Math.sin(a)*rr,h=5+R()*10;g.lineStyle(1.2,C.reed,.34+R()*.18).moveTo(x,y+2).lineTo(x+(R()-.5)*2,y-h);if(i%11===0)g.beginFill(0x86623d,.42).drawEllipse(x,y-h,1.2,3).endFill()}terrain.addChild(g)}}}'''

src,n = re.subn(r"function drawAggregateTerrain\(\)\{.*?\}\nfunction drawCreek", new_aggregate + "\nfunction drawCreek", src, count=1, flags=re.S)
if n != 1: raise SystemExit('drawAggregateTerrain anchor not found')

old_marsh = r"else if\(o\.type==='reed_marsh'\)\{.*?\}\nelse if\(o\.type==='frontier'\)"
new_marsh = r'''else if(o.type==='reed_marsh'){g.beginFill(mix(C.wet,C.mud,.12),.46).drawEllipse(0,11,112,66).endFill();for(let i=0;i<13;i++){const px=(R()-.5)*168,py=(R()-.5)*82;g.beginFill(C.waterDark,.12+R()*.08).drawEllipse(px,py+14,10+R()*24,3+R()*8).endFill()}for(let i=0;i<58;i++){const x=(R()-.5)*164,y=(R()-.5)*112,h=14+R()*19;g.lineStyle(1.7,C.reed,.90).moveTo(x,y+7).lineTo(x+(R()-.5)*4,y-h);if(i%8===0)g.beginFill(0x86623d,.82).drawEllipse(x,y-h,1.7,4.6).endFill()}for(let i=0;i<22;i++){const x=(R()-.5)*160,y=(R()-.5)*105;g.beginFill(0x49634c,.42).drawEllipse(x,y+8,7+R()*14,2+R()*5).endFill()}}
else if(o.type==='frontier')'''
src,n = re.subn(old_marsh,new_marsh,src,count=1,flags=re.S)
if n != 1: raise SystemExit('reed_marsh anchor not found')

old_component = "else if(o.type==='reed_stand'){for(let i=-9;i<=9;i+=4)g.lineStyle(2,C.reed,.95).moveTo(i,9).lineTo(i,-22-Math.abs(i))}"
new_component = "else if(o.type==='reed_stand'){for(let i=-8;i<=8;i+=4){const h=13+Math.abs(i)*.45;g.lineStyle(1.7,C.reed,.94).moveTo(i,7).lineTo(i,-h);if(i===-8||i===8)g.beginFill(0x86623d,.8).drawEllipse(i,-h,1.4,3.8).endFill()}}"
if old_component not in src: raise SystemExit('reed_stand anchor not found')
src = src.replace(old_component,new_component,1)

src = src.replace("rng('ground-v5')","rng('ground-v7')",1)
src = src.replace("rng('creek-v4')","rng('creek-v7')",1)
Path('world-pixi-v7.js').write_text(src)

index = Path('index.html').read_text()
index = index.replace('action-visuals.js?v=0806','action-visuals-v7.js?v=0807')
index = index.replace('world-pixi-v6.js?v=0806','world-pixi-v7.js?v=0807')
Path('index.html').write_text(index)

pkg = json.loads(Path('package.json').read_text())
pkg['version'] = '0.8.3'
pkg['scripts']['test'] = pkg['scripts']['test'].replace('world-pixi-v6.js','world-pixi-v7.js')
Path('package.json').write_text(json.dumps(pkg,indent=2)+'\n')
