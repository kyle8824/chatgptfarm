from pathlib import Path
import json,re
src=Path('world-pixi-v8.js').read_text()

src=src.replace("return{x:app.screen.width/2,y:mobile?app.screen.height*.405:app.screen.height*.50}","return{x:app.screen.width/2,y:mobile?app.screen.height*.47:app.screen.height*.50}",1)

new_tree=r'''function drawTree(x,y,s,R){const c=new PIXI.Container();c.position.set(x,y);const shadow=new PIXI.Graphics();shadow.beginFill(C.shadow,.15).drawEllipse(s*.06,s*.37,s*.60,s*.20).endFill();const trunk=new PIXI.Graphics();trunk.beginFill(0x5a3f2b,.98).drawRoundedRect(-s*.085,-s*.05,s*.17,s*.58,Math.max(2,s*.05)).endFill();trunk.beginFill(0x76523a,.38).drawRoundedRect(-s*.055,-s*.02,s*.045,s*.48,2).endFill();const crown=new PIXI.Graphics();crown.beginFill(C.forestLeaf,.99).drawCircle(-s*.27,-s*.37,s*.43).drawCircle(s*.27,-s*.35,s*.45).drawCircle(0,-s*.68,s*.50).endFill();crown.beginFill(C.forestHi,.40).drawCircle(-s*.15,-s*.78,s*.22).endFill();c.addChild(shadow,trunk,crown);addWorld(c,y,0,{kind:'tree',tier:'high-vegetation',height:Math.round(s*1.42)})}'''
src,n=re.subn(r"function drawTree\(x,y,s,R\)\{.*?\}\nfunction drawAggregateTerrain",new_tree+"\nfunction drawAggregateTerrain",src,count=1,flags=re.S)
if n!=1:raise SystemExit('drawTree anchor not found')

new_aggregate=r'''function drawAggregateTerrain(){for(const t of current.worldModel.terrain||[]){const p=wp(t.center),r=((t.radiusM||20)/2)*PX,R=rng(`${t.id}-v9`);if(t.type==='forest'){let made=0,tries=0;while(made<44&&tries++<180){const a=R()*Math.PI*2,rr=Math.sqrt(R())*r*.96,x=p.x+Math.cos(a)*rr,y=p.y+Math.sin(a)*rr;if(field('wetland',x,y)>.20)continue;const s=38+R()*10;drawTree(x,y,s,R);made++}}else if(t.type==='wetland'){const g=new PIXI.Graphics();for(let i=0;i<45;i++){const a=R()*Math.PI*2,rr=Math.sqrt(R())*r*.94,x=p.x+Math.cos(a)*rr,y=p.y+Math.sin(a)*rr;g.beginFill(i%3?C.wet:C.waterDark,.07+R()*.08).drawEllipse(x,y,18+R()*42,6+R()*15).endFill()}for(let i=0;i<120;i++){const a=R()*Math.PI*2,rr=Math.sqrt(R())*r*.94,x=p.x+Math.cos(a)*rr,y=p.y+Math.sin(a)*rr,h=4+R()*7;g.lineStyle(1.05,C.reed,.23+R()*.15).moveTo(x,y+2).lineTo(x+(R()-.5)*2,y-h)}terrain.addChild(g)}}}'''
src,n=re.subn(r"function drawAggregateTerrain\(\)\{.*?\}\nfunction drawCreek",new_aggregate+"\nfunction drawCreek",src,count=1,flags=re.S)
if n!=1:raise SystemExit('aggregate anchor not found')

new_artifact=r'''function drawArtifact(a){if(a.carrierId)return;const p=wp(a.coordinates||{x:50,y:50}),seed=hash(a.id),ox=((seed&15)-7.5)*1.35,oy=(((seed>>4)&15)-7.5)*.75,c=new PIXI.Container();c.position.set(p.x+ox,p.y+oy);const g=new PIXI.Graphics(),t=a.type||'';let h=20;if(/ClayVessel/i.test(t)){g.lineStyle(2,0xe0b28b,.9).beginFill(0xa87150,.98).drawEllipse(0,3,10,13).endFill().moveTo(-7,-5).lineTo(7,-5);h=26}else if(/sharpStone/i.test(t)){g.beginFill(0xa9b1aa,.98).drawPolygon([-11,8,0,-11,10,7]).endFill();h=19}else if(/Pole/i.test(t)){g.lineStyle(5,C.wood,.98).moveTo(-18,9).lineTo(18,-9);h=18}else if(/cordage/i.test(t)){g.lineStyle(3,0xc3aa70,.95).drawCircle(0,0,10);h=20}else g.beginFill(0xd3c38a,.92).drawCircle(0,0,6).endFill();c.addChild(g);makeSelectable(c,a,'artifact');addWorld(c,p.y+oy,5,{kind:'artifact',tier:'ground-object',sourceId:a.id,height:h})}'''
src,n=re.subn(r"function drawArtifact\(a\)\{.*?\}\nfunction progress",new_artifact+"\nfunction progress",src,count=1,flags=re.S)
if n!=1:raise SystemExit('artifact anchor not found')

anchor="function resolveAgentLabels(){"
offset=r'''function agentDisplayOffset(a){const mine=phase(a),same=current.agents.filter(b=>{const q=phase(b);return Math.hypot(mine.x-q.x,mine.y-q.y)<.7});if(same.length<2)return{x:0,y:0};const idx=same.findIndex(x=>x.id===a.id),center=(same.length-1)/2;return{x:(idx-center)*28,y:(idx-center)*5}}
function resolveAgentLabels(){'''
if anchor not in src:raise SystemExit('label anchor not found')
src=src.replace(anchor,offset,1)

tick_old="const s=phase(a),p=wp(s),q=c._p;window.ChatGPTFarmActionVisuals?.redraw(q.prop,a,s,t,C,PIXI);c.position.set(p.x,p.y);c.zIndex=worldZ(p.y,8);if(c._debug){c._debug.screenBaseY=p.y;c._debug.zIndex=c.zIndex;}"
tick_new="const s=phase(a),p=wp(s),off=agentDisplayOffset(a);p.x+=off.x;p.y+=off.y;const q=c._p;window.ChatGPTFarmActionVisuals?.redraw(q.prop,a,s,t,C,PIXI);c.position.set(p.x,p.y);c.zIndex=worldZ(p.y,8);if(c._debug){c._debug.screenX=p.x;c._debug.screenBaseY=p.y;c._debug.zIndex=c.zIndex;}"
if tick_old not in src:raise SystemExit('tick agent anchor not found')
src=src.replace(tick_old,tick_new,1)

src=src.replace("rng('ground-v8')","rng('ground-v9')",1).replace("rng('creek-v8')","rng('creek-v9')",1)
Path('world-pixi-v9.js').write_text(src)
Path('action-visuals-v9.js').write_text(Path('action-visuals-v8.js').read_text())
index=Path('index.html').read_text().replace('action-visuals-v8.js?v=0808','action-visuals-v9.js?v=0809').replace('world-pixi-v8.js?v=0808','world-pixi-v9.js?v=0809');Path('index.html').write_text(index)
pkg=json.loads(Path('package.json').read_text());pkg['version']='0.8.5';pkg['scripts']['test']=pkg['scripts']['test'].replace('world-pixi-v8.js','world-pixi-v9.js');Path('package.json').write_text(json.dumps(pkg,indent=2)+'\n')
