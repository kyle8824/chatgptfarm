from pathlib import Path


def once(src, old, new, label):
    if old not in src:
        raise SystemExit(f'{label} anchor missing')
    return src.replace(old, new, 1)

p=Path('world-pixi-v11.js'); src=p.read_text()

# Decorative aggregate trees must not overwrite real canonical object footprints.
anchor="function rendererDebug(){"
if anchor not in src: raise SystemExit('renderer debug anchor missing')
helpers="""function blocksAggregateTree(x,y){const skip=new Set(['OBJ-CREEK-001','OBJ-REEDS-001','OBJ-FRONTIER-001']);for(const o of current?.worldModel?.objects||[]){if(o.state?.active===false||o.parentId||skip.has(o.id)||!o.position)continue;const p=wp(o.position),pad=o.type==='camp_area'?8:18;if(Math.hypot(x-p.x,y-p.y)<objectRadiusPx(o)+pad)return true}return false}\nfunction treeCollisionAudit(){const skip=new Set(['OBJ-CREEK-001','OBJ-REEDS-001','OBJ-FRONTIER-001']),objects=(current?.worldModel?.objects||[]).filter(o=>o.state?.active!==false&&!o.parentId&&!skip.has(o.id)&&o.position),hits=[];for(const c of worldItems.filter(x=>x._debug?.kind==='tree'))for(const o of objects){const p=wp(o.position),clearance=Math.hypot(c.x-p.x,c.y-p.y)-objectRadiusPx(o)-12;if(clearance<0){hits.push({objectId:o.id,label:o.label,clearance:Math.round(clearance)});break}}return hits}\n"""
src=src.replace(anchor,helpers+anchor,1)
src=once(src,"if(field('wetland',x,y)>.20||creekDistPx(x,y)<82)continue;","if(field('wetland',x,y)>.20||creekDistPx(x,y)<82||blocksAggregateTree(x,y))continue;",'aggregate tree exclusion')
src=once(src,"riverCollisions:creekCollisionAudit(),ecology:","riverCollisions:creekCollisionAudit(),treeCollisions:treeCollisionAudit(),ecology:",'tree collision debug')

# True normal-offset strokes make opposite creek banks read as a raised lip and undercut.
anchor="function drawCreek(){"
if anchor not in src: raise SystemExit('drawCreek anchor missing')
offset="""function offsetPath(pts,offset){return pts.map((p,i)=>{const a=pts[Math.max(0,i-1)],b=pts[Math.min(pts.length-1,i+1)],dx=b.x-a.x,dy=b.y-a.y,m=Math.hypot(dx,dy)||1;return{x:p.x-dy/m*offset,y:p.y+dx/m*offset}})}\n"""
src=src.replace(anchor,offset+anchor,1)
old="const shine=new PIXI.Graphics();strokePath(shine,smooth,Math.max(2,baseWidth*.065),0xd0ece8,.16,0,-3);waterLayer.addChild(shine);"
new="const shine=new PIXI.Graphics();strokePath(shine,smooth,Math.max(2,baseWidth*.065),0xd0ece8,.16,0,-3);waterLayer.addChild(shine);const northLip=new PIXI.Graphics(),southCut=new PIXI.Graphics(),north=offsetPath(smooth,-(baseWidth*.5+20)),south=offsetPath(smooth,baseWidth*.5+20);strokePath(northLip,north,3,mix(C.ground2,0xc5ba82,.35),.28);strokePath(southCut,south,6,mix(C.shadow,C.mud,.38),.30);shoreLayer.addChild(northLip,southCut);"
src=once(src,old,new,'bank relief strokes')
src=src.replace("version:'v12-depth-basin'","version:'v12.1-depth-basin'",1)
p.write_text(src)

p=Path('scripts/visual-qa.mjs'); src=p.read_text()
src=once(src,"if(snapshot.version!=='v12-depth-basin')failures.push(`expected v12-depth-basin renderer, got ${snapshot.version}`);if((snapshot.riverCollisions||[]).length)failures.push(`river/object collisions: ${snapshot.riverCollisions.map(x=>`${x.label}:${x.clearance}px`).join(', ')}`);if(!snapshot.layers||snapshot.layers.bank<1||snapshot.layers.water<1||snapshot.layers.shore<1||snapshot.layers.world<1)failures.push('depth layer stack is incomplete');","if(snapshot.version!=='v12.1-depth-basin')failures.push(`expected v12.1-depth-basin renderer, got ${snapshot.version}`);if((snapshot.riverCollisions||[]).length)failures.push(`river/object collisions: ${snapshot.riverCollisions.map(x=>`${x.label}:${x.clearance}px`).join(', ')}`);if((snapshot.treeCollisions||[]).length)failures.push(`aggregate tree/object collisions: ${snapshot.treeCollisions.map(x=>x.label).join(', ')}`);if(!snapshot.layers||snapshot.layers.bank<1||snapshot.layers.water<1||snapshot.layers.shore<1||snapshot.layers.world<1)failures.push('depth layer stack is incomplete');",'visual composition assertions')
p.write_text(src)
