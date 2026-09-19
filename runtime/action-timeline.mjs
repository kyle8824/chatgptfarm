import {migrateWorld} from '../engine.js';
import {advanceActionHour} from '../engine/persistent-actions.js';
import {distance} from '../engine/navigation.js';
const copy=x=>structuredClone(x);
function visible(w){return JSON.parse(JSON.stringify(w,(k,v)=>k==='evidence'?undefined:v));}
export function difference(a,b,path=[],out=[]){
 if(a===b)return out;
 if(a===null||b===null||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b)){out.push({path,value:b});return out;}
 if(Array.isArray(a)){
  const identity=x=>x&&typeof x==='object'?(x.id||x.decision_id):null;
  const first=identity(a[0]),shift=first?b.findIndex(x=>identity(x)===first):-1;
  if(shift>0&&b.slice(shift).every((x,i)=>identity(x)===identity(a[i]))){
   out.push({path,prepend:b.slice(0,shift),length:b.length});
   for(let i=shift;i<b.length;i++)difference(a[i-shift],b[i],[...path,i],out);
  }else{
   for(let i=0;i<b.length;i++)difference(a[i],b[i],[...path,i],out);
   if(b.length<a.length)out.push({path:[...path,'length'],value:b.length});
  }
  return out;
 }
 for(const k of Object.keys(a))if(!(k in b))out.push({path:[...path,k],remove:true});
 for(const k of Object.keys(b))difference(a[k],b[k],[...path,k],out);
 return out;
}
export function applyDifference(w,patch){for(const p of patch){let target=w;for(const key of p.path.slice(0,-1))target=target[key];const key=p.path.at(-1);if(p.prepend){target[key].unshift(...copy(p.prepend));target[key].length=p.length;}else if(p.remove)delete target[key];else target[key]=copy(p.value);}return w;}
export async function beginActionTransition(world,start,duration=150000,mind=null,options={}){
 const before=migrateWorld(copy(world)),after=copy(before),frames=[];let previous=options.captureFrames===false?null:visible(before);
 await advanceActionHour(after,mind,{...options,onFrame(w,minute){if(options.captureFrames===false)return;const frame=visible(w);frames.push({minute,patch:difference(previous,frame)});previous=frame;}});
 after.meta.tickNumber=(before.meta.tickNumber||0)+1;after.meta.lastAdvancedAt=new Date(start+duration).toISOString();
 const decisions=after.dna.filter(d=>d.evidence&&Number(d.decision_id.slice(2))>=before.seq.decision).map(copy);
 for(const d of after.dna)delete d.evidence;
 return {version:1,actionVersion:1,start,end:start+duration,before,after,frames,evidence:{version:1,decisions}};
}
function pointOnPath(path,fraction){const lengths=path.slice(1).map((p,i)=>distance(path[i],p)),total=lengths.reduce((a,b)=>a+b,0);let remaining=total*fraction;for(let i=0;i<lengths.length;i++){if(remaining<=lengths[i]){const t=lengths[i]?remaining/lengths[i]:1;return {x:path[i].x+(path[i+1].x-path[i].x)*t,y:path[i].y+(path[i+1].y-path[i].y)*t};}remaining-=lengths[i];}return path.at(-1);}
export function snapshotActionTransition(r,now){
 if(!r.frames.length){if(now<r.end)throw Error('Missing active action frames');const w=copy(r.after);w.runtime={version:1,actionVersion:1,serverTime:now,start:r.start,end:r.end,revision:r.after.meta.tickNumber,status:'catching-up',decisionSource:w.meta.mindMode||'fallback'};return w;}
 const elapsed=Math.max(0,Math.min(60,(now-r.start)/(r.end-r.start)*60));
 const w=copy(r.before);let index=0;
 for(let i=0;i<r.frames.length&&r.frames[i].minute<=elapsed;i++){applyDifference(w,r.frames[i].patch);index=i;}
 const current=r.frames[index],following=r.frames[index+1],next=following?applyDifference(copy(w),following.patch):w;
 const frameStart=r.start+current.minute/60*(r.end-r.start),frameEnd=following?r.start+following.minute/60*(r.end-r.start):r.end;
 for(const a of w.agents){
  const b=next.agents.find(x=>x.id===a.id),moving=a.task?.phase==='travel',path=moving&&b.motionPath?.length?b.motionPath:[a.coordinates,a.coordinates];
  const f=frameEnd>frameStart?Math.max(0,Math.min(1,(now-frameStart)/(frameEnd-frameStart))):1;
  a.coordinates=copy(pointOnPath(path,f));a.runtimeMotion={from:path[0],to:path.at(-1),path,start:frameStart,end:Math.max(frameStart+1,frameEnd)};
 }
 for(const animal of w.ecologySystem?.wildlife||[]){
  const before=r.before.ecologySystem?.wildlife?.find(x=>x.id===animal.id),after=r.after.ecologySystem?.wildlife?.find(x=>x.id===animal.id);
  if(!before?.position||!after?.position)continue;
  const fraction=after.species==='fish'?1:/rest|hide|freeze|drink/i.test(after.activity||'')?.12:.22;
  const end=r.start+(r.end-r.start)*fraction,f=Math.max(0,Math.min(1,(now-r.start)/(end-r.start)));
  animal.position=pointOnPath([before.position,after.position],f);animal.runtimeMotion={from:before.position,to:after.position,start:r.start,end};animal.activity=after.activity;animal.behavior=after.behavior;
 }
 w.runtime={version:1,actionVersion:1,serverTime:now,start:r.start,end:r.end,nextUpdateAt:Math.max(now+1000,frameEnd),revision:r.after.meta.tickNumber,status:now>=r.end?'catching-up':'running',decisionSource:w.agents.some(a=>a.mind.brainMode==='ai')?(w.agents.every(a=>a.mind.brainMode==='ai')?'ai':'mixed'):'fallback'};
 w.meta.lastAdvancedAt=new Date(frameStart).toISOString();w.meta.heartbeatMinutes=(r.end-r.start)/60000;
 return w;
}
