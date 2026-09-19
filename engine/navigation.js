// Metric routes over the current basin. Unknown slopes/vegetation are not given
// invented collision geometry. Water and explicit blocking footprints are real.
export const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function segmentDistance(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));return distance(p,{x:a.x+t*dx,y:a.y+t*dy});}
export function walkable(w,p){
 const bounds=w.worldModel.bounds,scale=bounds.metersPerUnit||2;
 if(p.x<0||p.y<0||p.x>bounds.width||p.y>bounds.height)return false;
 for(const o of w.worldModel.objects){
  if(o.state?.active===false)continue;
  if(o.type==='creek_segment'){
   const points=o.geometry?.points||[],clearance=(o.geometry?.widthM||5)/scale/2+.35;
   for(let i=1;i<points.length;i++)if(segmentDistance(p,{x:points[i-1][0],y:points[i-1][1]},{x:points[i][0],y:points[i][1]})<clearance)return false;
  }else if(o.physical?.blocksMovement&&o.position&&distance(p,o.position)<(o.geometry?.radiusM||1)/scale+.35)return false;
 }
 return true;
}
export function clearSegment(w,a,b){const n=Math.max(1,Math.ceil(distance(a,b)*4));for(let i=0;i<=n;i++)if(!walkable(w,{x:a.x+(b.x-a.x)*i/n,y:a.y+(b.y-a.y)*i/n}))return false;return true;}
export function findRoute(w,from,to){
 if(!walkable(w,from)||!walkable(w,to))return null;
 if(clearSegment(w,from,to))return [{...from},{...to}];
 const key=p=>`${p.x},${p.y}`,start={x:Math.round(from.x),y:Math.round(from.y)},end={x:Math.round(to.x),y:Math.round(to.y)};
 if(!clearSegment(w,from,start)||!clearSegment(w,end,to))return null;
 const nodes=new Map([[key(start),{p:start,g:0,f:distance(start,end),parent:null}]]),open=[nodes.get(key(start))],closed=new Set();
 while(open.length&&closed.size<11000){
  open.sort((a,b)=>a.f-b.f||a.p.x-b.p.x||a.p.y-b.p.y);const n=open.shift(),k=key(n.p);if(closed.has(k))continue;closed.add(k);
  if(k===key(end)){const path=[{...to}];let cur=n;while(cur){path.unshift(cur.p);cur=cur.parent;}path.unshift({...from});return path;}
  for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
   const p={x:n.p.x+dx,y:n.p.y+dy},pk=key(p);if(closed.has(pk)||!clearSegment(w,n.p,p))continue;
   const g=n.g+Math.hypot(dx,dy),old=nodes.get(pk);if(old&&old.g<=g)continue;
   const next={p,g,f:g+distance(p,end),parent:n};nodes.set(pk,next);open.push(next);
  }
 }
 return null;
}
export function carriedMass(w,a){const wood=(w.wood?.batches||[]).filter(b=>b.holder.kind==='carried'&&b.holder.id===a.id).reduce((s,b)=>s+b.dryKg+b.waterKg,0);return wood+Object.entries(a.inventory).filter(([k])=>!['dryWood','wetWood','woodPole','pointedPole','boundSharpTool'].includes(k)).reduce((s,[,n])=>s+Math.max(0,n)*.5,0);}
export function walkingSpeed(w,a){return 1.1/(1+carriedMass(w,a)/25);}
export function advanceRoute(w,a,task,minutes){
 let units=walkingSpeed(w,a)*60*minutes/(w.worldModel.bounds.metersPerUnit||2),path=[{...a.coordinates}];
 while(task.pathIndex<task.path.length&&units>0){
  const next=task.path[task.pathIndex],d=distance(a.coordinates,next);
  if(!clearSegment(w,a.coordinates,next))return {blocked:true,path};
  if(d<=units){a.coordinates={...next};units-=d;task.pathIndex++;path.push({...next});}
  else{a.coordinates={x:a.coordinates.x+(next.x-a.coordinates.x)*units/d,y:a.coordinates.y+(next.y-a.coordinates.y)*units/d};path.push({...a.coordinates});units=0;}
 }
 return {arrived:task.pathIndex>=task.path.length,path};
}
