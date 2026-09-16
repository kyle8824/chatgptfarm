from pathlib import Path
import re

# 1) Canonical world geography: the creek must occupy the same basin coordinates
# used by agent navigation, clay, reeds, wildlife, and rendering.
p=Path('engine/world-model.js')
src=p.read_text()
src=src.replace("export const WORLD_MODEL_VERSION='object-field-0.7';","export const WORLD_MODEL_VERSION='object-field-0.8';",1)
old="creek:{id:'OBJ-CREEK-001',kind:'feature',type:'creek_segment',label:'creek',zone:'creek',position:{x:48,y:19},geometry:{shape:'polyline',widthM:5,points:[[0,73],[28,66],[48,76],[70,71],[100,62]]},physical:{navigable:true,water:true,liquid:true,potable:true}},"
new="creek:{id:'OBJ-CREEK-001',kind:'feature',type:'creek_segment',label:'creek',zone:'creek',position:{x:48,y:20},geometry:{shape:'polyline',widthM:5,points:[[0,18],[12,21],[27,18],[43,22],[58,19],[72,23],[86,21],[100,24]]},physical:{navigable:true,water:true,liquid:true,potable:true}},"
if old not in src: raise SystemExit('fixed creek definition anchor missing')
src=src.replace(old,new,1)
anchor="ensureBaseObjects(w);syncLegacyIntoWorldModel(w);return w.worldModel;"
replacement="""ensureBaseObjects(w);
 // v0.8 geography migration: old renderer geometry placed the visible creek far north
 // of its canonical zone. Only migrate the untouched world-origin creek shape.
 const creek=w.worldModel.objects.find(o=>o.id==='OBJ-CREEK-001');
 if(creek?.provenance?.source==='world-origin'&&Math.max(...(creek.geometry?.points||[]).map(q=>q[1]||0))>50){
  creek.position=clone(FIXED.creek.position);creek.geometry=clone(FIXED.creek.geometry);
  creek.history||=[];creek.history.push({day:w.day,hour:w.hour,type:'coordinate-migration',detail:'Unified the creek visual geometry with its canonical basin position.'});
 }
 syncLegacyIntoWorldModel(w);return w.worldModel;"""
if anchor not in src: raise SystemExit('ensure world migration anchor missing')
src=src.replace(anchor,replacement,1)
p.write_text(src)

# 2) Ecology follows the same creek. Existing fish and stale water-seeking movement
# are migrated once if they still occupy the old north-creek coordinate range.
p=Path('engine/ecology.js')
src=p.read_text()
old="const creekPoints=[[2,72],[15,69],[28,66],[39,72],[48,76],[58,74],[70,71],[84,67],[98,62]].map(([x,y])=>({x,y}));"
new="const creekPoints=[[2,18.5],[12,21],[27,18],[43,22],[58,19],[72,23],[86,21],[98,23.7]].map(([x,y])=>({x,y}));"
if old not in src: raise SystemExit('ecology creek points anchor missing')
src=src.replace(old,new,1)
old="for(const x of w.ecologySystem.wildlife){x.previousPosition||={...x.position};x.target||={...x.position};x.movement||={from:{...x.position},to:{...x.position},worldDay:w.day,worldHour:w.hour};x.ai||={eligible:true,mode:'simulation',calls:0,lastDecisionAt:null};x.history||=[];}"
new="""for(const x of w.ecologySystem.wildlife){x.previousPosition||={...x.position};x.target||={...x.position};x.movement||={from:{...x.position},to:{...x.position},worldDay:w.day,worldHour:w.hour};x.ai||={eligible:true,mode:'simulation',calls:0,lastDecisionAt:null};x.history||=[];if(x.species==='fish'&&((x.position?.y||0)>50||(x.target?.y||0)>50||(x.movement?.to?.y||0)>50)){const q=creekPoints[hash(x.id)%creekPoints.length];x.position={...q};x.previousPosition={...q};x.target={...q};x.movement={from:{...q},to:{...q},goal:{...q},worldDay:w.day,worldHour:w.hour,speed:0};x.history.push({day:w.day,hour:w.hour,activity:'migration',behavior:'coordinate migration',from:null,to:{...q},goal:{...q}})}else if(x.behavior==='seeking water'&&(x.target?.y||0)>50){const q=nearestCreek(x.position);x.target={...q};x.movement={...x.movement,to:{...x.position},goal:{...q}}}}"""
if old not in src: raise SystemExit('wildlife migration anchor missing')
src=src.replace(old,new,1)
p.write_text(src)

# 3) Renderer: keep trunks out of the water and make the creek banks read as habitat.
p=Path('world-pixi-v11.js')
src=p.read_text()
anchor="function field(type,x,y){return terrainBy(type).reduce((m,t)=>Math.max(m,influence(t,x,y)),0)}"
extra="""function field(type,x,y){return terrainBy(type).reduce((m,t)=>Math.max(m,influence(t,x,y)),0)}
function segDist(px,py,a,b){const vx=b.x-a.x,vy=b.y-a.y,wx=px-a.x,wy=py-a.y,c=vx*vx+vy*vy||1,t=clamp((wx*vx+wy*vy)/c,0,1),x=a.x+t*vx,y=a.y+t*vy;return Math.hypot(px-x,py-y)}
function creekDistPx(x,y){const creek=(current?.worldModel?.objects||[]).find(o=>o.id==='OBJ-CREEK-001'),pts=(creek?.geometry?.points||[]).map(([px,py])=>wp({x:px,y:py}));let d=Infinity;for(let i=0;i<pts.length-1;i++)d=Math.min(d,segDist(x,y,pts[i],pts[i+1]));return d}"""
if anchor not in src: raise SystemExit('renderer field anchor missing')
src=src.replace(anchor,extra,1)
src=src.replace("if(field('wetland',x,y)>.20)continue;const s=38+R()*10;", "if(field('wetland',x,y)>.20||creekDistPx(x,y)<48)continue;const s=38+R()*10;",1)

# Add low, non-interactive riparian vegetation based on the canonical creek itself.
old="const R=rng('creek-v11');for(let i=7;i<smooth.length-7;i+=Math.max(5,Math.round(7+R()*8))){const a=smooth[i],z=3+R()*5,x=a.x+(R()-.5)*baseWidth*.68,y=a.y+(R()-.5)*baseWidth*.55;const rock=new PIXI.Graphics();rock.beginFill(R()>.5?C.rock:C.rock2,.82).drawEllipse(x,y,z,z*.62).endFill();terrain.addChild(rock)}}"
new="""const R=rng('creek-v12'),bankLife=new PIXI.Graphics();for(let i=7;i<smooth.length-7;i+=Math.max(5,Math.round(7+R()*8))){const a=smooth[i],z=3+R()*5,x=a.x+(R()-.5)*baseWidth*.68,y=a.y+(R()-.5)*baseWidth*.55;const rock=new PIXI.Graphics();rock.beginFill(R()>.5?C.rock:C.rock2,.82).drawEllipse(x,y,z,z*.62).endFill();terrain.addChild(rock);const b=smooth[Math.min(smooth.length-1,i+1)],dx=b.x-a.x,dy=b.y-a.y,m=Math.hypot(dx,dy)||1,nx=-dy/m,ny=dx/m;for(const side of[-1,1]){if(R()<.28)continue;const off=side*(baseWidth*.62+8+R()*15),bx=a.x+nx*off,by=a.y+ny*off;for(let k=0;k<3+Math.floor(R()*3);k++){const ox=(R()-.5)*11,oy=(R()-.5)*5,h=5+R()*9;bankLife.lineStyle(1.1,mix(C.reed,C.ground2,.28),.32+R()*.20).moveTo(bx+ox,by+oy+2).lineTo(bx+ox+(R()-.5)*2,by+oy-h)}}}terrain.addChild(bankLife)}"""
if old not in src: raise SystemExit('creek bank renderer anchor missing')
src=src.replace(old,new,1)
p.write_text(src)

# 4) QA must inspect the migrated creek, not the obsolete north coordinate.
p=Path('scripts/visual-qa.mjs')
src=p.read_text().replace("focusWorldUnit(48,74,1.45)","focusWorldUnit(48,20,1.45)")
p.write_text(src)
