import {activeParts,cargoAllowance,surfaceProtection} from '../shared/structure-performance.js';
import {loadOf} from './holdings.mjs';
// Pure geometry shared by server navigation and the renderer.
export function partBounds(project,part){const [x,y,z]=part.center,[sx,sy,sz]=part.size;return {minX:project.position.x+x-sx/2,maxX:project.position.x+x+sx/2,minZ:project.position.y+z-sz/2,maxZ:project.position.y+z+sz/2,bottom:y-sy/2,top:y+sy/2};}
const inside=(b,part,p,pad=0)=>{const r=partBounds(b,part);return p.x>=r.minX+.12-pad&&p.x<=r.maxX-.12+pad&&p.y>=r.minZ-.05-pad&&p.y<=r.maxZ+.05+pad;};
export function onDeck(w,p,actor=null){return (w.settlement?.projects||[]).some(b=>{
 if(!(b.purpose==='bridge'||b.spansWater))return false;
 const incumbent=actor&&b.parts.some(x=>x.built&&x.kind==='deck'&&inside(b,x,actor.coordinates,.15)),active=activeParts(b);
 if(b.closing&&!incumbent)return false;
 return b.parts.some(part=>active.has(part.id)&&part.kind==='deck'&&inside(b,part,p)&&(incumbent||!actor||loadOf(w,actor).mass<=cargoAllowance(b,part)+1e-6));
});}
export function crossingPace(w,a){for(const b of w.settlement?.projects||[])if(b.spansWater||b.purpose==='bridge')for(const part of b.parts)if(part.built&&part.kind==='deck'&&inside(b,part,a.coordinates))return .4+.5*(part.durability?.quality??.45)*(part.durability?.condition??1);return 1;}
export function structureBlocks(w,p){
 for(const b of w.settlement?.projects||[]){const active=activeParts(b);for(const part of b.parts){if(!active.has(part.id))continue;const r=partBounds(b,part),vertical=['wall','post'].includes(part.kind)&&part.size[1]>=.5,bodyHeightPanel=['deck','beam','roof'].includes(part.kind)&&r.top>.65&&r.bottom<1.35;if(!vertical&&!bodyHeightPanel)continue;if(p.x>r.minX-.25&&p.x<r.maxX+.25&&p.y>r.minZ-.25&&p.y<r.maxZ+.25)return true;}}
 return false;
}
export function structureWaypoints(w){const points=[];for(const b of w.settlement?.projects||[]){
  const bb=b.bounds;for(const x of [bb.minX-.65,bb.maxX+.65])for(const y of [bb.minZ-.65,bb.maxZ+.65])points.push({x,y});
  if((b.purpose==='bridge'||b.spansWater)){for(const part of b.parts.filter(p=>p.kind==='deck'&&activeParts(b).has(p.id))){const r=partBounds(b,part),x=(r.minX+r.maxX)/2;for(const y of [r.minZ,r.maxZ,(r.minZ+r.maxZ)/2])points.push({x,y});}points.push({x:b.position.x,y:bb.minZ-.5},{x:b.position.x,y:bb.maxZ+.5});}
 }return points;}
export function coverEffectiveness(w,p){let protection=0;for(const b of w.settlement?.projects||[])if(b.status==='complete'&&(b.purpose==='shelter'||b.affordances?.restPoints?.length))for(const part of b.parts){if(!activeParts(b).has(part.id)||part.kind!=='roof'||part.center[1]-part.size[1]/2<1.35)continue;const r=partBounds(b,part);if(p.x>=r.minX&&p.x<=r.maxX&&p.y>=r.minZ&&p.y<=r.maxZ)protection=Math.max(protection,surfaceProtection(part));}return protection;}
export const builtCover=(w,p)=>coverEffectiveness(w,p)>0;
