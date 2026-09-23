import {activeParts,qualityOf,conditionOf} from '../shared/structure-performance.js';
import {partBounds} from './structures.mjs';

const overlap=(a,b,pad=0)=>a.minX<b.maxX+pad&&a.maxX>b.minX-pad&&a.minZ<b.maxZ+pad&&a.maxZ>b.minZ-pad;
function filled(parts,r){
 const xs=[r.minX,r.maxX,...parts.flatMap(p=>[p.minX,p.maxX])].sort((a,b)=>a-b);
 for(let i=1;i<xs.length;i++){if(xs[i]-xs[i-1]<.001)continue;const x=(xs[i]+xs[i-1])/2;let z=r.minZ;for(const p of parts.filter(p=>p.minX<=x&&p.maxX>=x).sort((a,b)=>a.minZ-b.minZ)){if(p.minZ>z+.025)return false;z=Math.max(z,p.maxZ);}if(z<r.maxZ-.025)return false;}return true;
}
// Resting functions follow supported, level, unobstructed physical surfaces.
// A name such as "bed" or "chair" confers no comfort by itself.
export function restSurfaces(project,{planned=false}={}){
 if(project.spansWater||project.purpose==='bridge'||!planned&&project.status!=='complete')return [];
 const active=planned?new Set(project.parts.map(p=>p.id)):activeParts(project);
 const parts=project.parts.filter(p=>active.has(p.id)),panels=parts.filter(p=>p.kind==='deck'&&p.size[1]<=.45&&partBounds(project,p).top<=.65),remaining=new Set(panels),result=[];
 while(remaining.size){
  const first=remaining.values().next().value,group=[first],top=partBounds(project,first).top;remaining.delete(first);
  for(let i=0;i<group.length;i++)for(const p of remaining)if(p.material===first.material&&Math.abs(partBounds(project,p).top-top)<.025&&overlap(partBounds(project,p),partBounds(project,group[i]),.026)){group.push(p);remaining.delete(p);}
  const rectangles=group.map(p=>partBounds(project,p)),r={minX:Math.min(...rectangles.map(r=>r.minX)),maxX:Math.max(...rectangles.map(r=>r.maxX)),minZ:Math.min(...rectangles.map(r=>r.minZ)),maxZ:Math.max(...rectangles.map(r=>r.maxZ))};
  if(!filled(rectangles,r))continue;
  const width=r.maxX-r.minX,depth=r.maxZ-r.minZ,bed=Math.min(width,depth)>=.85&&Math.max(width,depth)>=2.1,seat=top>=.3&&width>=.55&&depth>=.55;
  if(!bed&&!seat)continue;
  const position={x:(r.minX+r.maxX)/2,y:(r.minZ+r.maxZ)/2},heading=bed?(width>depth?Math.PI/2:0):0;
  const body=bed?{minX:position.x-(width>depth?1.03:.38),maxX:position.x+(width>depth?1.03:.38),minZ:position.y-(width>depth?.38:1.03),maxZ:position.y+(width>depth?.38:1.03)}:{minX:position.x-.23,maxX:position.x+.23,minZ:position.y-.23,maxZ:position.y+.23};
  // Reject chest interiors, walls through a sleeper, and panels above the lap.
  if(parts.some(p=>!group.includes(p)&&overlap(partBounds(project,p),body)&&partBounds(project,p).top>top+.035&&partBounds(project,p).bottom<top+(bed?.55:1.3)))continue;
  const supports=new Set(),visit=part=>{if(supports.has(part))return;supports.add(part);for(const id of part.requires||[]){const parent=parts.find(p=>p.id===id);if(parent)visit(parent);}};group.forEach(visit);
  if(!planned&&[...supports].some(p=>conditionOf(p)<.35))continue;
  const quality=Math.min(...[...supports].map(p=>qualityOf(p)*conditionOf(p))),soft=first.material==='reeds';
  result.push({id:group.map(p=>p.id).sort().join('+'),partIds:group.map(p=>p.id),position,height:top,posture:bed?'lie':'seat',heading,material:first.material,soft,quality,width,depth,comfort:Math.min(92,(soft?60:first.material==='stone'?28:43)+quality*(soft?30:22)),label:soft?'reed bedding':bed?'resting platform':'seat'});
 }
 return result;
}
