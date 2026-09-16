from pathlib import Path
import re


def replace_once(src, old, new, label):
    if old not in src:
        raise SystemExit(f'{label} anchor missing')
    return src.replace(old, new, 1)

# --- Canonical geography: keep the creek near the basin but out of solid objects. ---
p = Path('engine/world-model.js')
src = p.read_text()
src = replace_once(src, "export const WORLD_MODEL_VERSION='object-field-0.8';", "export const WORLD_MODEL_VERSION='object-field-0.9';", 'world model version')
src = replace_once(src,
"creek:{id:'OBJ-CREEK-001',kind:'feature',type:'creek_segment',label:'creek',zone:'creek',position:{x:48,y:20},geometry:{shape:'polyline',widthM:5,points:[[0,18],[12,21],[27,18],[43,22],[58,19],[72,23],[86,21],[100,24]]},physical:{navigable:true,water:true,liquid:true,potable:true}},",
"creek:{id:'OBJ-CREEK-001',kind:'feature',type:'creek_segment',label:'creek',zone:'creek',position:{x:48,y:19},geometry:{shape:'polyline',widthM:5,points:[[0,17.5],[12,19.2],[27,17.4],[43,19.6],[58,18.2],[72,19.4],[86,19.1],[100,21.2]]},physical:{navigable:true,water:true,liquid:true,potable:true}},", 'creek fixed geometry')
src = replace_once(src, "position:{x:73,y:24},geometry:{shape:'ellipse',radiusM:8}", "position:{x:73,y:28},geometry:{shape:'ellipse',radiusM:8}", 'stone field position')
src = replace_once(src, "position:{x:86,y:21},geometry:{shape:'bank',lengthM:12,widthM:4}", "position:{x:86,y:23},geometry:{shape:'bank',lengthM:12,widthM:4,orientationDeg:8}", 'clay bank position')
old = """ const creek=w.worldModel.objects.find(o=>o.id==='OBJ-CREEK-001');
 if(creek?.provenance?.source==='world-origin'&&Math.max(...(creek.geometry?.points||[]).map(q=>q[1]||0))>50){
  creek.position=clone(FIXED.creek.position);creek.geometry=clone(FIXED.creek.geometry);
  creek.history||=[];creek.history.push({day:w.day,hour:w.hour,type:'coordinate-migration',detail:'Unified the creek visual geometry with its canonical basin position.'});
 }
"""
new = """ const creek=w.worldModel.objects.find(o=>o.id==='OBJ-CREEK-001');
 const creekPoints=creek?.geometry?.points||[],v08Creek=JSON.stringify([[0,18],[12,21],[27,18],[43,22],[58,19],[72,23],[86,21],[100,24]]);
 if(creek?.provenance?.source==='world-origin'&&(Math.max(...creekPoints.map(q=>q[1]||0))>50||JSON.stringify(creekPoints)===v08Creek)){
  creek.position=clone(FIXED.creek.position);creek.geometry=clone(FIXED.creek.geometry);
  creek.history||=[];creek.history.push({day:w.day,hour:w.hour,type:'coordinate-migration',detail:'Refined the creek into a continuous basin channel with solid-object clearance.'});
 }
 const stones=w.worldModel.objects.find(o=>o.id==='OBJ-STONES-001');
 if(stones?.provenance?.source==='world-origin'&&(stones.position?.y??0)<27){stones.position=clone(FIXED.stones.position);stones.history||=[];stones.history.push({day:w.day,hour:w.hour,type:'coordinate-migration',detail:'Moved the stone field clear of the creek channel and bank.'})}
 const clay=w.worldModel.objects.find(o=>o.id==='OBJ-CLAY-001');
 if(clay?.provenance?.source==='world-origin'&&(clay.position?.y??0)<22.5){clay.position=clone(FIXED.clay.position);clay.geometry=clone(FIXED.clay.geometry);clay.history||=[];clay.history.push({day:w.day,hour:w.hour,type:'coordinate-migration',detail:'Moved the clay exposure onto the north creek bank instead of inside the channel.'})}
"""
src = replace_once(src, old, new, 'world geography migration')
p.write_text(src)

# Keep logical travel coordinates aligned with the canonical objects.
p = Path('engine/spectator.js')
src = p.read_text()
src = replace_once(src,
"export const LOCATION_COORDS={camp:{x:64,y:34},creek:{x:48,y:19},berries:{x:29,y:31},log:{x:59,y:29},meadow:{x:43,y:31},edge:{x:78,y:42},forest:{x:14,y:38},stones:{x:73,y:24},clay:{x:86,y:21},reeds:{x:10,y:22}};",
"export const LOCATION_COORDS={camp:{x:64,y:34},creek:{x:48,y:19},berries:{x:29,y:31},log:{x:59,y:29},meadow:{x:43,y:31},edge:{x:78,y:42},forest:{x:14,y:38},stones:{x:73,y:28},clay:{x:86,y:23},reeds:{x:10,y:22}};", 'spectator coordinates')
p.write_text(src)

# --- Renderer: establish explicit visual layers and rebuild the river as terrain, not a blue stroke. ---
p = Path('world-pixi-v11.js')
src = p.read_text()
src = replace_once(src, "let app,root,terrain,screenFx,current,lastTick=null;let worldItems=[];", "let app,root,terrain,bankLayer,waterLayer,shoreLayer,worldLayer,screenFx,current,lastTick=null;let worldItems=[];", 'renderer layer variables')
src = replace_once(src,
"terrain=new PIXI.Container();terrain.zIndex=0;root.addChild(terrain);screenFx=new PIXI.Container();",
"terrain=new PIXI.Container();terrain.zIndex=0;bankLayer=new PIXI.Container();bankLayer.zIndex=5;waterLayer=new PIXI.Container();waterLayer.zIndex=10;shoreLayer=new PIXI.Container();shoreLayer.zIndex=20;worldLayer=new PIXI.Container();worldLayer.zIndex=30;worldLayer.sortableChildren=true;root.addChild(terrain,bankLayer,waterLayer,shoreLayer,worldLayer);screenFx=new PIXI.Container();", 'renderer layer init')
src = replace_once(src, "root.addChild(c);worldItems.push(c);return c}", "worldLayer.addChild(c);worldItems.push(c);return c}", 'world layer routing')
src = replace_once(src,
"function renderWorld(){terrain.removeChildren().forEach(d=>d.destroy({children:true}));clearWorldItems();selectables.clear();drawGround();drawCreek();drawAggregateTerrain();",
"function renderWorld(){terrain.removeChildren().forEach(d=>d.destroy({children:true}));bankLayer.removeChildren().forEach(d=>d.destroy({children:true}));waterLayer.removeChildren().forEach(d=>d.destroy({children:true}));shoreLayer.removeChildren().forEach(d=>d.destroy({children:true}));clearWorldItems();selectables.clear();drawGround();drawCreek();drawAggregateTerrain();", 'render layer clearing')
src = src.replace("creekDistPx(x,y)<48", "creekDistPx(x,y)<82", 1)
src = src.replace("version:'v11.2-living-director'", "version:'v12-depth-basin'", 1)

# Insert collision audit helpers before rendererDebug.
anchor = "function rendererDebug(){"
if anchor not in src:
    raise SystemExit('rendererDebug anchor missing')
helpers = """function objectRadiusPx(o){const g=o?.geometry||{},m=current?.worldModel?.bounds?.metersPerUnit||2;if(Number.isFinite(g.radiusM))return(g.radiusM/m)*PX;if(Number.isFinite(g.widthM))return(g.widthM/(2*m))*PX;if(Number.isFinite(g.diameterM))return(g.diameterM/(2*m))*PX;return 18}\nfunction creekCollisionAudit(){const creek=(current?.worldModel?.objects||[]).find(o=>o.id==='OBJ-CREEK-001');if(!creek?.geometry?.points)return[];const m=current?.worldModel?.bounds?.metersPerUnit||2,half=((creek.geometry.widthM||5)/(2*m))*PX,skip=new Set(['OBJ-CREEK-001','OBJ-REEDS-001']);return(current.worldModel.objects||[]).filter(o=>o.state?.active!==false&&!o.parentId&&!skip.has(o.id)&&o.position).map(o=>{const p=wp(o.position),clearance=creekDistPx(p.x,p.y)-objectRadiusPx(o)-half;return{id:o.id,label:o.label,clearance:Math.round(clearance)}}).filter(x=>x.clearance<8)}\n"""
src = src.replace(anchor, helpers + anchor, 1)
old_debug = "return{version:'v12-depth-basin',camera:{...camera},items,counts:items.reduce((a,x)=>(a[x.kind]=(a[x.kind]||0)+1,a),{}),ecology:{traceCount:(eco.traces||[]).filter(x=>x.active).length,eventCount:(eco.events||[]).length,ambient:eco.ambient||{}}}}"
new_debug = "return{version:'v12-depth-basin',camera:{...camera},items,counts:items.reduce((a,x)=>(a[x.kind]=(a[x.kind]||0)+1,a),{}),layers:{ground:terrain.children.length,bank:bankLayer.children.length,water:waterLayer.children.length,shore:shoreLayer.children.length,world:worldLayer.children.length},riverCollisions:creekCollisionAudit(),ecology:{traceCount:(eco.traces||[]).filter(x=>x.active).length,eventCount:(eco.events||[]).length,ambient:eco.ambient||{}}}}"
src = replace_once(src, old_debug, new_debug, 'renderer debug layer metrics')

# Replace the river drawing block wholesale.
pat = r"function creekCurve\(points,steps=14\)\{.*?\}\nfunction drawCreek\(\)\{.*?\}\nfunction makeSelectable"
river = r'''function creekCurve(points,steps=28){if(points.length<2)return points;const p=[{x:points[0].x-(points[1].x-points[0].x)*.55,y:points[0].y-(points[1].y-points[0].y)*.55},...points,{x:points.at(-1).x+(points.at(-1).x-points.at(-2).x)*.55,y:points.at(-1).y+(points.at(-1).y-points.at(-2).y)*.55}],out=[];for(let i=1;i<p.length-2;i++){const p0=p[i-1],p1=p[i],p2=p[i+1],p3=p[i+2];for(let s=0;s<steps;s++){const t=s/steps,t2=t*t,t3=t2*t;out.push({x:.5*((2*p1.x)+(-p0.x+p2.x)*t+(2*p0.x-5*p1.x+4*p2.x-p3.x)*t2+(-p0.x+3*p1.x-3*p2.x+p3.x)*t3),y:.5*((2*p1.y)+(-p0.y+p2.y)*t+(2*p0.y-5*p1.y+4*p2.y-p3.y)*t2+(-p0.y+3*p1.y-3*p2.y+p3.y)*t3)})}}out.push(points.at(-1));return out}
function strokePath(g,pts,width,color,alpha=1,ox=0,oy=0){if(!pts.length)return g;g.lineStyle(width,color,alpha).moveTo(pts[0].x+ox,pts[0].y+oy);for(let i=1;i<pts.length;i++)g.lineTo(pts[i].x+ox,pts[i].y+oy);return g}
function drawCreek(){const creek=(current.worldModel.objects||[]).find(o=>o.type==='creek_segment');if(!creek?.geometry?.points)return;let pts=creek.geometry.points.map(([x,y])=>wp({x,y}));const first=pts[0],second=pts[1],last=pts.at(-1),prev=pts.at(-2);pts=[{x:first.x-(second.x-first.x)*1.1,y:first.y-(second.y-first.y)*1.1},...pts,{x:last.x+(last.x-prev.x)*1.1,y:last.y+(last.y-prev.y)*1.1}];const smooth=creekCurve(pts,28),depth=current.worldModel?.fields?.waterDepth?.objects?.[creek.id]??.42,baseWidth=50+depth*18;
const undercut=new PIXI.Graphics();strokePath(undercut,smooth,baseWidth+62,mix(C.shadow,C.mud,.55),.20);bankLayer.addChild(undercut);
const earth=new PIXI.Graphics();strokePath(earth,smooth,baseWidth+46,mix(C.bank,C.mud,.34),.98);bankLayer.addChild(earth);
const damp=new PIXI.Graphics();strokePath(damp,smooth,baseWidth+25,mix(C.mud,C.waterDark,.35),.58);bankLayer.addChild(damp);
const water=new PIXI.Graphics();strokePath(water,smooth,baseWidth+4,mix(C.water,C.waterDark,depth*.31),.99);waterLayer.addChild(water);
const channel=new PIXI.Graphics();strokePath(channel,smooth,baseWidth*.50,mix(C.waterDark,0x315f73,.22),.20);waterLayer.addChild(channel);
const shine=new PIXI.Graphics();strokePath(shine,smooth,Math.max(2,baseWidth*.065),0xd0ece8,.16,0,-3);waterLayer.addChild(shine);
const R=rng('creek-depth-v12'),life=new PIXI.Graphics(),pebbles=new PIXI.Graphics(),ripples=new PIXI.Graphics();for(let i=10;i<smooth.length-10;i+=7+Math.floor(R()*8)){const a=smooth[i],b=smooth[Math.min(smooth.length-1,i+2)],dx=b.x-a.x,dy=b.y-a.y,m=Math.hypot(dx,dy)||1,nx=-dy/m,ny=dx/m;for(const side of[-1,1]){const off=side*(baseWidth*.52+18+R()*17),bx=a.x+nx*off,by=a.y+ny*off;if(R()<.76){const tuft=3+Math.floor(R()*4);for(let k=0;k<tuft;k++){const ox=(R()-.5)*13,oy=(R()-.5)*6,h=7+R()*13;life.lineStyle(1.25,mix(C.reed,C.ground2,.22),.42+R()*.25).moveTo(bx+ox,by+oy+3).lineTo(bx+ox+(R()-.5)*3,by+oy-h)}}if(R()<.40){const s=3+R()*5;pebbles.beginFill(R()>.5?C.rock:C.rock2,.62).drawEllipse(bx+(R()-.5)*14,by+(R()-.5)*8,s,s*.58).endFill()}if(R()<.24)pebbles.beginFill(mix(C.bank,C.ground2,.35),.18).drawEllipse(bx,by,12+R()*18,4+R()*7).endFill()}if(R()<.70){const rw=10+R()*20;ripples.lineStyle(1,0xd8f0ed,.10+R()*.08).moveTo(a.x-rw*.5,a.y+(R()-.5)*baseWidth*.25).quadraticCurveTo(a.x,a.y-2,a.x+rw*.5,a.y+(R()-.5)*baseWidth*.25)}}shoreLayer.addChild(pebbles,life);waterLayer.addChild(ripples)}
function makeSelectable'''
src, n = re.subn(pat, river, src, count=1, flags=re.S)
if n != 1:
    raise SystemExit('river renderer block missing')
p.write_text(src)

# --- Structural QA now checks the thing that actually failed: river/object clearance. ---
p = Path('scripts/smoke-test.mjs')
src = p.read_text()
anchor = "const fallbackWorld = migrateWorld(createWorld());"
if anchor not in src:
    raise SystemExit('smoke geography anchor missing')
qa = r'''const geometryWorld=migrateWorld(createWorld());
const geoCreek=findWorldObject(geometryWorld,'OBJ-CREEK-001'),geoPts=geoCreek.geometry.points.map(([x,y])=>({x,y})),meters=geometryWorld.worldModel.bounds.metersPerUnit||2,waterHalf=(geoCreek.geometry.widthM||5)/(2*meters);
const segDistance=(p,a,b)=>{const vx=b.x-a.x,vy=b.y-a.y,wx=p.x-a.x,wy=p.y-a.y,d=vx*vx+vy*vy||1,t=Math.max(0,Math.min(1,(wx*vx+wy*vy)/d)),x=a.x+t*vx,y=a.y+t*vy;return Math.hypot(p.x-x,p.y-y)};
const pathDistance=p=>Math.min(...geoPts.slice(0,-1).map((a,i)=>segDistance(p,a,geoPts[i+1])));
const radiusUnits=o=>{const g=o.geometry||{};if(Number.isFinite(g.radiusM))return g.radiusM/meters;if(Number.isFinite(g.widthM))return g.widthM/(2*meters);if(Number.isFinite(g.diameterM))return g.diameterM/(2*meters);return .7};
for(const id of ['OBJ-CAMP-001','OBJ-BERRIES-001','OBJ-TREE-001','OBJ-STONES-001','OBJ-CLAY-001']){const o=findWorldObject(geometryWorld,id),clearance=pathDistance(o.position)-radiusUnits(o)-waterHalf;if(clearance<.3)fail(`Canonical river collision: ${o.label} overlaps the creek channel (${clearance.toFixed(2)} world units clearance)`)}
for(let i=1;i<geoPts.length-1;i++){const a=geoPts[i-1],b=geoPts[i],c=geoPts[i+1],u={x:b.x-a.x,y:b.y-a.y},v={x:c.x-b.x,y:c.y-b.y},dot=u.x*v.x+u.y*v.y,mu=Math.hypot(u.x,u.y)||1,mv=Math.hypot(v.x,v.y)||1,turn=Math.acos(Math.max(-1,Math.min(1,dot/(mu*mv))))*180/Math.PI;if(turn>32)fail(`Canonical creek has an abrupt ${turn.toFixed(1)}° turn at control point ${i}`)}

'''
src = src.replace(anchor, qa + anchor, 1)
p.write_text(src)

# Browser QA inspects the renderer's live collision audit and captures the two banks that were missed before.
p = Path('scripts/visual-qa.mjs')
src = p.read_text()
old = "const snapshot=await page.evaluate(()=>window.ChatGPTFarmRendererDebug.snapshot());\nconst items=snapshot.items||[],trees="
new = "const snapshot=await page.evaluate(()=>window.ChatGPTFarmRendererDebug.snapshot());\nif(snapshot.version!=='v12-depth-basin')failures.push(`expected v12-depth-basin renderer, got ${snapshot.version}`);if((snapshot.riverCollisions||[]).length)failures.push(`river/object collisions: ${snapshot.riverCollisions.map(x=>`${x.label}:${x.clearance}px`).join(', ')}`);if(!snapshot.layers||snapshot.layers.bank<1||snapshot.layers.water<1||snapshot.layers.shore<1||snapshot.layers.world<1)failures.push('depth layer stack is incomplete');\nconst items=snapshot.items||[],trees="
src = replace_once(src, old, new, 'visual QA snapshot')
old = "await page.evaluate(()=>window.ChatGPTFarmRendererDebug.focusWorldUnit(48,20,1.45));await page.waitForTimeout(250);await shot('mobile-creek');"
new = "await page.evaluate(()=>window.ChatGPTFarmRendererDebug.focusWorldUnit(48,19,1.45));await page.waitForTimeout(250);await shot('mobile-creek');await page.evaluate(()=>window.ChatGPTFarmRendererDebug.focusWorldUnit(86,21,1.55));await page.waitForTimeout(250);await shot('mobile-east-bank');await page.evaluate(()=>window.ChatGPTFarmRendererDebug.focusWorldUnit(73,24,1.5));await page.waitForTimeout(250);await shot('mobile-stone-bank');"
src = replace_once(src, old, new, 'visual QA river views')
p.write_text(src)

# Cache bust the renderer so Visual QA reviews this exact pass.
p = Path('index.html')
src = p.read_text()
src = src.replace('action-visuals-v11.js?v=0902','action-visuals-v11.js?v=0903',1).replace('world-pixi-v11.js?v=0902','world-pixi-v11.js?v=0903',1)
p.write_text(src)
