// Pure geometry shared by server navigation and the renderer.
export function partBounds(project,part){const [x,y,z]=part.center,[sx,sy,sz]=part.size;return {minX:project.position.x+x-sx/2,maxX:project.position.x+x+sx/2,minZ:project.position.y+z-sz/2,maxZ:project.position.y+z+sz/2,bottom:y-sy/2,top:y+sy/2};}
export function onDeck(w,p){return (w.settlement?.projects||[]).some(b=>(b.purpose==='bridge'||b.spansWater)&&b.parts.some(part=>{if(!part.built||part.kind!=='deck')return false;const r=partBounds(b,part);return p.x>=r.minX+.12&&p.x<=r.maxX-.12&&p.y>=r.minZ-.05&&p.y<=r.maxZ+.05;}));}
export function structureBlocks(w,p){
 for(const b of w.settlement?.projects||[])for(const part of b.parts){if(!part.built||!['wall','post'].includes(part.kind)||part.size[1]<.5)continue;const r=partBounds(b,part);if(p.x>r.minX-.25&&p.x<r.maxX+.25&&p.y>r.minZ-.25&&p.y<r.maxZ+.25)return true;}
 return false;
}
export function structureWaypoints(w){const points=[];for(const b of w.settlement?.projects||[]){
  const bb=b.bounds;for(const x of [bb.minX-.65,bb.maxX+.65])for(const y of [bb.minZ-.65,bb.maxZ+.65])points.push({x,y});
  if((b.purpose==='bridge'||b.spansWater)){for(const part of b.parts.filter(p=>p.kind==='deck'&&p.built)){const r=partBounds(b,part),x=(r.minX+r.maxX)/2;for(const y of [r.minZ,r.maxZ,(r.minZ+r.maxZ)/2])points.push({x,y});}points.push({x:b.position.x,y:bb.minZ-.5},{x:b.position.x,y:bb.maxZ+.5});}
 }return points;}
export function builtCover(w,p){return (w.settlement?.projects||[]).some(b=>b.status==='complete'&&(b.purpose==='shelter'||b.affordances?.restPoints?.length)&&b.parts.some(part=>{if(part.kind!=='roof'||part.center[1]-part.size[1]/2<1.35)return false;const r=partBounds(b,part);return p.x>=r.minX&&p.x<=r.maxX&&p.y>=r.minZ&&p.y<=r.maxZ;}));}
