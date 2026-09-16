from pathlib import Path
import re

p=Path('world-pixi-v11.js')
src=p.read_text()

def once(old,new,label):
    global src
    if old not in src: raise SystemExit(f'{label} anchor missing')
    src=src.replace(old,new,1)

once("let app,root,terrain,bankLayer,waterLayer,shoreLayer,worldLayer,screenFx,current,lastTick=null;let worldItems=[],riverStats={};",
     "let app,root,terrain,bankLayer,waterLayer,shoreLayer,worldLayer,screenFx,current,lastTick=null;let worldItems=[],riverStats={},terrainDepth={clayFace:false};",
     'terrain depth state')
once("function renderWorld(){terrain.removeChildren().forEach(d=>d.destroy({children:true}));bankLayer.removeChildren().forEach(d=>d.destroy({children:true}));waterLayer.removeChildren().forEach(d=>d.destroy({children:true}));shoreLayer.removeChildren().forEach(d=>d.destroy({children:true}));clearWorldItems();selectables.clear();drawGround();drawCreek();",
     "function renderWorld(){terrainDepth={clayFace:false};terrain.removeChildren().forEach(d=>d.destroy({children:true}));bankLayer.removeChildren().forEach(d=>d.destroy({children:true}));waterLayer.removeChildren().forEach(d=>d.destroy({children:true}));shoreLayer.removeChildren().forEach(d=>d.destroy({children:true}));clearWorldItems();selectables.clear();drawGround();drawCreek();",
     'reset terrain depth')
once("river:riverStats,riverCollisions:","river:riverStats,terrainDepth:{...terrainDepth},riverCollisions:",'terrain depth debug')
once("version:'v13-world-quality'","version:'v13.1-natural-depth'",'renderer version')

# Replace creek drawing only: no uniform nested brown bands; use asymmetric bank strips and intermittent material patches.
pat=r"function drawCreek\(\)\{.*?\}\nfunction makeSelectable"
new=r'''function stripGeometry(outer,inner){return{poly:[...outer,...inner.slice().reverse()]}}
function fillPoly(layer,poly,color,alpha=1){const g=new PIXI.Graphics(),flat=[];for(const p of poly)flat.push(p.x,p.y);g.beginFill(color,alpha).drawPolygon(flat).endFill();layer.addChild(g);return g}
function drawCreek(){const creek=(current.worldModel.objects||[]).find(o=>o.type==='creek_segment');if(!creek?.geometry?.points)return;let pts=creek.geometry.points.map(([x,y])=>wp({x,y}));const first=pts[0],second=pts[1],last=pts.at(-1),prev=pts.at(-2);pts=[{x:first.x-(second.x-first.x)*1.8,y:first.y-(second.y-first.y)*1.8},...pts,{x:last.x+(last.x-prev.x)*1.8,y:last.y+(last.y-prev.y)*1.8}];const smooth=creekCurve(pts,34),depth=current.worldModel?.fields?.waterDepth?.objects?.[creek.id]??.42,fullWidth=50+depth*18,half=fullWidth*.5,phase=1.73,water=ribbonGeometry(smooth,half,0,phase),outer=ribbonGeometry(smooth,half,34,phase+.6),deep=ribbonGeometry(smooth,half*.45,0,phase+1.1);const leftBank=stripGeometry(outer.left,water.left),rightBank=stripGeometry(outer.right,water.right);fillPoly(bankLayer,leftBank.poly,mix(C.ground,C.mud,.18),.82);fillPoly(bankLayer,rightBank.poly,mix(C.ground,C.mud,.28),.78);const undercutGeom=stripGeometry(ribbonGeometry(smooth,half+8,0,phase+.2).right,water.right);fillPoly(bankLayer,undercutGeom.poly,mix(C.shadow,C.mud,.44),.28);fillRibbon(waterLayer,water,mix(C.water,C.waterDark,depth*.31),.99);fillRibbon(waterLayer,deep,mix(C.waterDark,0x315f73,.12),.13);const widths=water.widths;riverStats={mode:'variable-ribbon',bankMode:'asymmetric-natural',samples:smooth.length,minWidth:Math.round(Math.min(...widths)),maxWidth:Math.round(Math.max(...widths)),variation:Number((Math.max(...widths)/Math.min(...widths)).toFixed(2))};const R=rng('creek-natural-v131'),shore=new PIXI.Graphics(),ripples=new PIXI.Graphics(),patches=new PIXI.Graphics();for(let i=8;i<smooth.length-8;i+=5+Math.floor(R()*8)){const a=smooth[i],b=smooth[Math.min(smooth.length-1,i+2)],dx=b.x-a.x,dy=b.y-a.y,m=Math.hypot(dx,dy)||1,nx=-dy/m,ny=dx/m;for(const side of[-1,1]){const inner=side<0?water.left[i]:water.right[i],outerEdge=side<0?outer.left[i]:outer.right[i],q=.20+R()*.72,bx=inner.x+(outerEdge.x-inner.x)*q,by=inner.y+(outerEdge.y-inner.y)*q;if(R()<.52){const rx=8+R()*26,ry=3+R()*9,col=R()<.45?mix(C.bank,C.ground2,.42):mix(C.mud,C.ground,.40);patches.beginFill(col,.18+R()*.22).drawEllipse(bx+(R()-.5)*12,by+(R()-.5)*8,rx,ry).endFill()}if(R()<.58){for(let k=0;k<1+Math.floor(R()*4);k++){const ox=(R()-.5)*18,oy=(R()-.5)*7,h=5+R()*16;shore.lineStyle(1.1,mix(C.reed,C.ground2,.18),.34+R()*.26).moveTo(bx+ox,by+oy+2).lineTo(bx+ox+(R()-.5)*3,by+oy-h)}}if(R()<.27){const s=2.5+R()*5.5;shore.beginFill(R()>.5?C.rock:C.rock2,.56).drawEllipse(bx+(R()-.5)*15,by+(R()-.5)*10,s,s*.57).endFill()}}if(R()<.65){const ww=8+R()*25,yy=a.y+(R()-.5)*half*.52;ripples.lineStyle(1,0xd8f0ed,.07+R()*.08).moveTo(a.x-ww*.5,yy).quadraticCurveTo(a.x,yy-1.8,a.x+ww*.5,yy)}}bankLayer.addChild(patches);shoreLayer.addChild(shore);waterLayer.addChild(ripples)}
function makeSelectable'''
src,n=re.subn(pat,new,src,count=1,flags=re.S)
if n!=1: raise SystemExit('drawCreek block missing')

old="if(o.type==='clay_bank'){const g=new PIXI.Graphics();g.beginFill(mix(C.clay,C.mud,.20),.72).drawEllipse(0,7,78,34).endFill();g.beginFill(C.mud,.20).drawEllipse(-22,12,31,10).drawEllipse(29,5,24,8).endFill();for(let i=0;i<16;i++)g.beginFill(i%2?0xd19a73:0x77513c,.16+R()*.10).drawEllipse((R()-.5)*105,(R()-.5)*37+7,3+R()*8,1.5+R()*4).endFill();groundFeature(o,p,g);return}"
newclay="if(o.type==='clay_bank'){const top=new PIXI.Graphics(),pts=[-78,-10,-55,-24,-20,-28,18,-25,56,-16,80,-4,66,13,31,20,-9,19,-45,14,-73,5];top.beginFill(mix(C.clay,C.mud,.18),.76).drawPolygon(pts).endFill();for(let i=0;i<14;i++)top.beginFill(i%2?0xd19a73:0x77513c,.13+R()*.10).drawEllipse((R()-.5)*118,(R()-.5)*27-2,3+R()*9,1.5+R()*4).endFill();groundFeature(o,p,top);const face=new PIXI.Container();face.position.set(p.x,p.y);const fg=new PIXI.Graphics();fg.beginFill(mix(C.clay,C.mud,.46),.82).drawPolygon([-73,5,-45,14,-9,19,31,20,66,13,61,27,29,35,-11,34,-47,28,-69,19]).endFill();fg.lineStyle(2,mix(C.clay,0xe2b08b,.22),.32).moveTo(-70,5).lineTo(-44,14).lineTo(-8,19).lineTo(31,20).lineTo(65,13);for(let i=0;i<8;i++){const x=-54+i*15+R()*5,y=18+R()*10;fg.lineStyle(1,mix(C.mud,0x3f3026,.32),.20).moveTo(x,y).lineTo(x+5+R()*8,y+3+R()*4)}face.addChild(fg);makeSelectable(face,o);shoreLayer.addChild(face);terrainDepth.clayFace=true;return}"
once(old,newclay,'clay relief')

p.write_text(src)

# Tighten QA so a green result requires the natural-bank renderer and clay relief.
p=Path('scripts/visual-qa.mjs');q=p.read_text();q=q.replace("snapshot.version!=='v13-world-quality'","snapshot.version!=='v13.1-natural-depth'").replace("expected v13-world-quality renderer","expected v13.1-natural-depth renderer");q=q.replace("snapshot.river?.mode!=='variable-ribbon'||snapshot.river.samples<100||snapshot.river.variation<1.12","snapshot.river?.mode!=='variable-ribbon'||snapshot.river?.bankMode!=='asymmetric-natural'||snapshot.river.samples<100||snapshot.river.variation<1.12");needle="if(snapshot.river?.mode!=='variable-ribbon'||snapshot.river?.bankMode!=='asymmetric-natural'||snapshot.river.samples<100||snapshot.river.variation<1.12)failures.push(`river is not a sufficiently variable ribbon: ${JSON.stringify(snapshot.river)}`);";q=q.replace(needle,needle+"if(!snapshot.terrainDepth?.clayFace)failures.push('clay bank has no rendered relief face');");p.write_text(q)

p=Path('index.html');h=p.read_text().replace('action-visuals-v11.js?v=0906','action-visuals-v11.js?v=0907').replace('world-pixi-v11.js?v=0906','world-pixi-v11.js?v=0907');p.write_text(h)
