from pathlib import Path
import json

src=Path('world-pixi-v5.js').read_text()

src=src.replace("const name=new PIXI.Text(a.name","const prop=new PIXI.Container();prop.position.set(20,4);const name=new PIXI.Text(a.name",1)
src=src.replace("c.addChild(sh,legs,body,head,hair,arm,name,status);","c.addChild(sh,legs,body,head,hair,arm,prop,name,status);",1)
src=src.replace("c._p={legs,body,head,hair,arm,status};","c._p={legs,body,head,hair,arm,prop,status};",1)
anchor="const s=phase(a),p=wp(s),q=c._p;c.position.set(p.x,p.y);"
if anchor not in src: raise SystemExit('tick anchor missing')
src=src.replace(anchor,"const s=phase(a),p=wp(s),q=c._p;window.ChatGPTFarmActionVisuals?.redraw(q.prop,a,s,t,C,PIXI);c.position.set(p.x,p.y);",1)
old="function updateFocus(){const a=autoAgent();if(!a)return;const s=phase(a);$('#focusCard').innerHTML=`<div class=\"focusInner\"><small>${esc(s.label).toUpperCase()} · ${esc(a.position).toUpperCase()}</small><strong>${esc(a.name)} — ${esc(a.mind?.currentGoal||a.currentAction||'Responding to the world')}</strong><p>${esc(a.mind?.intent||a.currentAction||'')}</p></div>`}"
new="function updateFocus(){const a=autoAgent();if(!a)return;const s=phase(a),v=window.ChatGPTFarmActionVisuals,d=v?.descriptor(a),where=v?.placeLabel(a.position)||a.position,what=d?.label?` · ${d.label}`:'';$('#focusCard').innerHTML=`<div class=\"focusInner\"><small>${esc(s.label).toUpperCase()} · ${esc(where).toUpperCase()}${esc(what).toUpperCase()}</small><strong>${esc(a.name)} — ${esc(a.mind?.currentGoal||a.currentAction||'Responding to the world')}</strong><p>${esc(a.mind?.intent||a.currentAction||'')}</p></div>`}"
if old not in src: raise SystemExit('focus anchor missing')
src=src.replace(old,new,1)
old_reeds="else if(o.type==='reed_marsh'){for(let i=0;i<54;i++){const x=(R()-.5)*116,y=(R()-.5)*90,h=22+R()*42;g.lineStyle(2,C.reed,.92).moveTo(x,y+9).lineTo(x+(R()-.5)*5,y-h);if(i%3===0)g.beginFill(0x86663e,.84).drawEllipse(x,y-h,2,6).endFill()}}"
new_reeds="else if(o.type==='reed_marsh'){g.beginFill(C.wet,.34).drawEllipse(0,9,102,60).endFill();for(let i=0;i<9;i++){const px=(R()-.5)*150,py=(R()-.5)*70;g.beginFill(C.waterDark,.14).drawEllipse(px,py+15,12+R()*24,4+R()*9).endFill()}for(let i=0;i<86;i++){const x=(R()-.5)*150,y=(R()-.5)*104,h=26+R()*52;g.lineStyle(2.4,C.reed,.94).moveTo(x,y+10).lineTo(x+(R()-.5)*6,y-h);if(i%3===0)g.beginFill(0x86623d,.9).drawEllipse(x,y-h,2.6,7).endFill()}}"
if old_reeds in src: src=src.replace(old_reeds,new_reeds,1)
Path('world-pixi-v6.js').write_text(src)

idx=Path('index.html').read_text()
idx=idx.replace('<script src="world-pixi-v5.js?v=0805"></script>','<script src="action-visuals.js?v=0806"></script>\n  <script src="world-pixi-v6.js?v=0806"></script>')
Path('index.html').write_text(idx)

pkg=json.loads(Path('package.json').read_text())
pkg['version']='0.8.2'
pkg['scripts']['test']=pkg['scripts']['test'].replace('world-pixi-v5.js','world-pixi-v6.js')
Path('package.json').write_text(json.dumps(pkg,indent=2)+'\n')
