from pathlib import Path
import json,re
src=Path('world-pixi-v9.js').read_text()

src=src.replace("return{x:app.screen.width/2,y:mobile?app.screen.height*.47:app.screen.height*.50}","return{x:app.screen.width/2,y:mobile?app.screen.height*.52:app.screen.height*.50}",1)

old="c.addChild(shadow,trunk,crown);addWorld(c,y,0,{kind:'tree',tier:'high-vegetation',height:Math.round(s*1.42)})"
new="c.addChild(shadow,trunk,crown);c._sway={amp:.006+R()*.006,phase:R()*Math.PI*2};addWorld(c,y,0,{kind:'tree',tier:'high-vegetation',height:Math.round(s*1.42)})"
if old not in src:raise SystemExit('tree sway anchor not found')
src=src.replace(old,new,1)

old_reed="c.addChild(g);makeSelectable(c,o);addWorld(c,p.y+y,0,{kind:'reed-cluster',tier:'low-vegetation',sourceId:o.id,height:Math.round(h+5)})"
new_reed="c.addChild(g);c._sway={amp:.012+R()*.010,phase:R()*Math.PI*2};makeSelectable(c,o);addWorld(c,p.y+y,0,{kind:'reed-cluster',tier:'low-vegetation',sourceId:o.id,height:Math.round(h+5)})"
if old_reed not in src:raise SystemExit('reed sway anchor not found')
src=src.replace(old_reed,new_reed,1)

# Keep labels compact at any camera zoom and pull them closer to the bodies.
src=src.replace("name.y=-45;","name.y=-35;",1).replace("status.y=34;","status.y=28;",1)
old_labels="function resolveAgentLabels(){const list=current.agents.map(a=>({a,c:agentSprites.get(a.id)})).filter(x=>x.c);for(const x of list){x.c._p.name.x=0;x.c._p.name.y=-45;x.c._p.name.alpha=1}for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){const A=list[i].c,B=list[j].c;if(Math.hypot(A.x-B.x,A.y-B.y)<62){A._p.name.x=-18;A._p.name.y=-51;B._p.name.x=18;B._p.name.y=-38}}}"
new_labels="function resolveAgentLabels(){const list=current.agents.map(a=>({a,c:agentSprites.get(a.id)})).filter(x=>x.c);for(const x of list){x.c._p.name.x=0;x.c._p.name.y=-35;x.c._p.name.alpha=1}for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){const A=list[i].c,B=list[j].c;if(Math.hypot(A.x-B.x,A.y-B.y)<70){A._p.name.x=-15;A._p.name.y=-39;B._p.name.x=15;B._p.name.y=-32}}}"
if old_labels not in src:raise SystemExit('label collision anchor not found')
src=src.replace(old_labels,new_labels,1)

old_tick="const q=c._p;window.ChatGPTFarmActionVisuals?.redraw(q.prop,a,s,t,C,PIXI);c.position.set(p.x,p.y);c.zIndex=worldZ(p.y,8);if(c._debug){c._debug.screenX=p.x;c._debug.screenBaseY=p.y;c._debug.zIndex=c.zIndex;}"
new_tick="const q=c._p;q.prop.x=off.x<0?-22:off.x>0?22:20;q.arm.scale.x=off.x<0?-1:1;q.name.scale.set(1/camera.scale);q.status.scale.set(1/camera.scale);window.ChatGPTFarmActionVisuals?.redraw(q.prop,a,s,t,C,PIXI);c.position.set(p.x,p.y);c.zIndex=worldZ(p.y,8);if(c._debug){c._debug.screenX=p.x;c._debug.screenBaseY=p.y;c._debug.zIndex=c.zIndex;}"
if old_tick not in src:raise SystemExit('agent tick anchor not found')
src=src.replace(old_tick,new_tick,1)

old_flame="resolveAgentLabels();for(const c of worldItems){const f=c.getChildByName?.('flame');if(f){f.scale.y=.87+Math.sin(t*8)*.14;f.rotation=Math.sin(t*5)*.07}}"
new_flame="resolveAgentLabels();const wind=Number(current.worldModel?.fields?.wind?.global||0);for(const c of worldItems){const f=c.getChildByName?.('flame');if(f){f.scale.y=.87+Math.sin(t*8)*.14;f.rotation=Math.sin(t*5)*.07}if(c._sway)c.rotation=Math.sin(t*.8+c._sway.phase)*c._sway.amp*clamp(wind/2.5,.25,1.5)}"
if old_flame not in src:raise SystemExit('world animation anchor not found')
src=src.replace(old_flame,new_flame,1)

Path('world-pixi-v10.js').write_text(src)
Path('action-visuals-v10.js').write_text(Path('action-visuals-v9.js').read_text())
index=Path('index.html').read_text().replace('action-visuals-v9.js?v=0809','action-visuals-v10.js?v=0810').replace('world-pixi-v9.js?v=0809','world-pixi-v10.js?v=0810');Path('index.html').write_text(index)
pkg=json.loads(Path('package.json').read_text());pkg['version']='0.8.6';pkg['scripts']['test']=pkg['scripts']['test'].replace('world-pixi-v9.js','world-pixi-v10.js');Path('package.json').write_text(json.dumps(pkg,indent=2)+'\n')
