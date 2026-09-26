import {extensionSites,orderParts,checkAdditionSpace} from './construction-stages.mjs';
import {happinessSummary} from './happiness.mjs';
import {insideBounds,naturalWorld,segmentProjection} from '../shared/landscape.js';
import {climbingSites} from './climbing.mjs';
import {localPosition,householdWorld} from '../shared/frontier.js';
import {knownPlace} from './frontier-knowledge.mjs';
import {familyContext} from './life.mjs';
import {structurePerformance,activeParts} from '../shared/structure-performance.js';
import {constructionSpec,craftSnapshot,CRAFT_GRAPH,bindingBudget} from '../shared/craft.js';
import {runConstructionCode} from './construction-code.mjs';
import {inferAffordances} from './affordances.mjs';
import {materialSources} from './resource-sites.mjs';
import {distance,walkable} from '../engine/navigation.js';
import {addEvent,remember} from '../engine/core.js';
import {riverY,nearestWater} from './water.mjs';
import {liveWalkable,liveRoute} from './motion.mjs';
import {partBounds} from './structures.mjs';
import {clock,makeStore,loadOf,groundTimber} from './holdings.mjs';
import {comfortContext} from './comfort.mjs';
const text=(s,max)=>{if(typeof s!=='string'||!s.trim())throw Error('Missing design text');return s.trim().slice(0,max);};
const number=(v,min,max)=>{if(!Number.isFinite(v)||v<min||v>max)throw Error('Design dimension out of bounds');return v;};
const vec=(v,min,max)=>{if(!Array.isArray(v)||v.length!==3)throw Error('Expected three dimensions');return v.map(n=>number(n,min,max));};
export function buildingSites(w,a){
 const timber=groundTimber(w),occupied=p=>w.settlement.trees.some(t=>distance(t.position,p)<3.5&&(timber.get(t.id)||0)>0);
 const sites=climbingSites(w,a).filter(s=>!w.settlement.projects.some(p=>distance(p.position,s.position)<6)&&liveRoute(w,a.coordinates,{x:s.position.x,y:s.position.y+(s.upperEdge<0?1:-1)*2.5},a));
 for(const [i,p]of [{x:72,y:38},{x:58,y:39},{x:72,y:44},{x:59,y:45},{x:79,y:38},{x:53,y:40}].map(p=>localPosition(w,p)).entries()){
  if(naturalWorld(w)&&distance(a.coordinates,p)>22)continue;
  if(w.settlement.projects.some(b=>distance(b.position,p)<6))continue;
  if(occupied(p))continue;
  if(liveWalkable(w,p)&&liveRoute(w,a.coordinates,p,a))sites.push({id:`clearing-${i}`,position:p,purposes:['storage','shelter'],width:4,depth:4});
 }
 const local=new Set();for(const radius of [8,14])for(let i=0;i<8;i++){
  const angle=i*Math.PI/4,p={x:Math.round(a.coordinates.x+Math.cos(angle)*radius),y:Math.round(a.coordinates.y+Math.sin(angle)*radius)},id=`local-${p.x}-${p.y}`;
  if(local.has(id)||!insideBounds(w,p,4))continue;local.add(id);
  if(w.settlement.projects.some(b=>distance(b.position,p)<6)||occupied(p))continue;
  if(![-2,0,2].every(x=>[-2,0,2].every(y=>liveWalkable(w,{x:p.x+x,y:p.y+y}))))continue;
  if(liveRoute(w,a.coordinates,p,a))sites.push({id,position:p,purposes:['storage','shelter'],width:4,depth:4});if(sites.length>=12)break;
 }
 const crossings=w.frontier?waterCrossings(w,a):[48,53,78,83,25,30].map(x=>({x,y:riverY(x)}));
 for(const {x,y,halfWidth=1.25}of crossings){const p={x,y:y+Math.max(2.6,halfWidth+.8)};if(w.settlement.projects.some(b=>(b.purpose==='bridge'||b.spansWater)&&Math.abs(b.position.x-x)<4))continue;
  if(liveRoute(w,a.coordinates,p,a))sites.push({id:w.frontier?`crossing-${x}-${Math.round(y)}`:`crossing-${x}`,position:{x,y},purposes:['bridge'],width:2.8,depth:Math.max(6,halfWidth*2+3),waterHalfWidth:halfWidth,spansWater:true});
 }return [...sites,...extensionSites(w,a)];
}
function waterCrossings(w,a){const out=[];for(const o of w.worldModel.objects.filter(o=>o.type==='creek_segment')){const pts=o.geometry.points||[];for(let i=1;i<pts.length;i++){const [u,v]=[pts[i-1],pts[i]],dx=v[0]-u[0],dy=v[1]-u[1];if(Math.abs(dx)<Math.abs(dy)||Math.abs(dx)<3)continue;const q=segmentProjection(a.coordinates.x,a.coordinates.y,u,v),x=Math.round(q.x),y=u[1]+dy*(x-u[0])/dx,width=o.geometry.profile?Math.max(o.geometry.profile[i-1][1],o.geometry.profile[i][1]):1.25,halfWidth=width*Math.hypot(dx,dy)/Math.abs(dx);if(halfWidth>2.8)continue;if(Math.hypot(x-a.coordinates.x,y-a.coordinates.y)<18)out.push({x,y,halfWidth});}}return out;}

export function householdProjects(w,a){return w.settlement.projects.filter(p=>!w.frontier||(p.householdId||w.agents.find(b=>b.id===p.ownerId)?.householdId||'willow-basin')===a.householdId);}
function physicalSite(site){const {purposes,...geometry}=site;return {...geometry,spansWater:!!site.spansWater};}
export function designContext(w,a){const timber=groundTimber(w),projects=w.settlement.projects.filter(p=>knownPlace(w,a,p)),stores=w.settlement.stores.filter(s=>knownPlace(w,a,s)),trees=w.settlement.trees.filter(t=>knownPlace(w,a,t));return {person:[a.name,a.surname].filter(Boolean).join(' '),personId:a.id,improvementGoal:a.improvementGoal||null,allowedExtensionIds:extensionSites(w,a).map(s=>s.extendsProjectId),allowedReplacementIds:projects.filter(p=>p.status==='complete'&&(p.ownerId===a.id||p.access==='shared')).map(p=>p.id),family:familyContext(w,a),comfort:comfortContext(w,a),happiness:happinessSummary(a),remainingDesignSlots:Math.max(0,12-householdProjects(w,a).length),craft:craftSnapshot(a),techniqueGraph:CRAFT_GRAPH,needs:a.needs,carry:loadOf(w,a),inventory:a.inventory,propertyConcern:a.propertyConcern||0,memories:a.memories.slice(0,5).map(m=>m.text),stores:stores.map(s=>({name:s.name,ownerId:s.ownerId,access:s.access,secured:s.secured,load:loadOf(w,s),capacityKg:s.capacityKg,position:s.position})),projects:projects.map(p=>({id:p.id,name:p.name,bindings:bindingBudget(p),performance:structurePerformance(p),observedProblems:Object.values(p.observations||{}).filter(o=>o.agentId===a.id),repairs:p.parts.reduce((n,x)=>n+(x.repairs||0),0),maintenanceRequested:p.maintenanceRequested||null,replacesProjectId:p.replacesProjectId||null,supersededBy:p.supersededBy||null,purpose:p.purpose,status:p.status,ownerId:p.ownerId,ownerName:w.agents.find(x=>x.id===p.ownerId)?.name||'Unknown',canReplace:p.status==='complete'&&(p.ownerId===a.id||p.access==='shared'),affordances:p.affordances?.labels||[],feedback:p.feedback?.observations?.[a.id]||null,code:p.ownerId===a.id?p.code?.slice(0,3000):undefined})),materialSources:['stone','reeds','clay'].flatMap(kind=>materialSources(w,kind,a).map(s=>({material:kind,position:s.position,remaining:s.remaining}))),resources:{...w.resources,standingTimber:trees.reduce((n,t)=>n+(timber.get(t.id)||0),0)},sites:buildingSites(w,a).map(physicalSite)};}
function touch(a,b){return Math.max(a.minX-b.maxX,b.minX-a.maxX,0)<=.16&&Math.max(a.minZ-b.maxZ,b.minZ-a.maxZ,0)<=.16&&Math.max(a.bottom-b.top,b.bottom-a.top,0)<=.16;}
function coversRectangle(rectangles,target){
 const xs=[target.minX,target.maxX,...rectangles.flatMap(r=>[Math.max(target.minX,Math.min(target.maxX,r.minX)),Math.max(target.minX,Math.min(target.maxX,r.maxX))])].sort((a,b)=>a-b);
 for(let i=1;i<xs.length;i++){if(xs[i]-xs[i-1]<.001)continue;const x=(xs[i]+xs[i-1])/2,spans=rectangles.filter(r=>r.minX<=x&&r.maxX>=x).sort((a,b)=>a.minZ-b.minZ);let end=target.minZ;for(const r of spans){if(r.minZ>end+.04)break;end=Math.max(end,r.maxZ);}if(end<target.maxZ-.04)return false;}return true;
}
// A villager can move during inference. Keep the issued local site identity,
// but recheck its physical clearance and route against the current world.
function issuedLocalSite(w,a,raw,issued){
 if(!issued||issued.id!==raw.siteId||!/^local--?\d+--?\d+$/.test(issued.id)||issued.spansWater)return null;
 const p=issued.position,timber=groundTimber(w);
 if(!p||issued.width!==4||issued.depth!==4||issued.id!==`local-${p.x}-${p.y}`||!insideBounds(w,p,4))return null;
 if(w.settlement.projects.some(b=>distance(b.position,p)<6)||w.settlement.trees.some(t=>distance(t.position,p)<3.5&&(timber.get(t.id)||0)>0))return null;
 if(![-2,0,2].every(x=>[-2,0,2].every(y=>liveWalkable(w,{x:p.x+x,y:p.y+y})))||!liveRoute(w,a.coordinates,p,a))return null;
 return issued;
}
export function validateBlueprint(w,a,raw,issuedSite=null){
 if(!raw||typeof raw!=='object')throw Error('Invalid construction response');
 if(raw.build===false)return null;
 if(raw.build!==true)throw Error('Explicit build decision required');
 // Optional JSON fields may be null. Treat that as omission, without
 // accepting an invented project id or relaxing ownership/support checks.
 raw={...raw,extendsProjectId:raw.extendsProjectId??undefined,replacesProjectId:raw.replacesProjectId??undefined};
 const generated=typeof raw.code==='string',site=buildingSites(w,a).find(s=>s.id===raw.siteId)||(generated&&issuedLocalSite(w,a,raw,issuedSite));if(!site||!generated&&!site.purposes.includes(raw.purpose))throw Error('Site unavailable or wrong purpose');
 const extended=raw.extendsProjectId?w.settlement.projects.find(p=>p.id===raw.extendsProjectId):null;
 if(site.extendsProjectId!==raw.extendsProjectId||raw.extendsProjectId&&(!generated||!extended||extended.status!=='complete'||raw.replacesProjectId))throw Error('Use an offered extension site and its matching extendsProjectId; additions cannot also replace a structure');
 const replaced=raw.replacesProjectId?w.settlement.projects.find(p=>p.id===raw.replacesProjectId):null;if(raw.replacesProjectId&&(!replaced||replaced.status!=='complete'||replaced.ownerId!==a.id&&replaced.access!=='shared'))throw Error('Replacement must reference an accessible completed structure. '+(replaced?replaced.id+' belongs to '+(w.agents.find(x=>x.id===replaced.ownerId)?.name||replaced.ownerId)+'. ':'')+'For a new independent structure, omit replacesProjectId entirely. Only use allowedReplacementIds to replace an existing one.');
 const compiled=generated?runConstructionCode(raw.code,{site:physicalSite(site),materials:{timber:(()=>{const timber=groundTimber(w);return w.settlement.trees.filter(t=>knownPlace(w,a,t)).reduce((n,t)=>n+(timber.get(t.id)||0),0);})(),stone:materialSources(w,'stone',a).reduce((n,s)=>n+s.remaining,0),reeds:materialSources(w,'reeds',a).reduce((n,s)=>n+s.remaining,0),clay:materialSources(w,'clay',a).reduce((n,s)=>n+s.remaining,0)}}):null;
 if(compiled)raw={...raw,parts:compiled.parts};
 if(!Array.isArray(raw.parts)||raw.parts.length<(generated?1:4)||raw.parts.length>(generated?48:28))throw Error('Use '+(generated?'1–48':'4–28')+' parts');
 if((extended?.parts.length||0)+raw.parts.length>96)throw Error('A structure can retain at most 96 components; consider a separate replacement');
 const p={name:text(raw.name,70),rationale:text(raw.rationale,350),purpose:generated?text(raw.purpose||'individual design',80):raw.purpose,generic:generated,constructionVersion:2,...(extended?{extendsProjectId:extended.id,extensionBase:JSON.stringify(extended.parts.map(x=>x.id))}:{}),...(replaced?{replacesProjectId:replaced.id}:{}),spansWater:!!site.spansWater,...(site.climbsTerrain?{climbsTerrain:site.climbsTerrain}:{}),...(compiled?{code:compiled.code,codeVersion:compiled.codeVersion}:{}),siteId:site.id,position:{...site.position},access:extended?.access||(raw.access==='shared'?'shared':'private'),parts:extended?structuredClone(extended.parts):[]};
 const ids=new Set(p.parts.map(x=>x.id)),errors=[];let total=0;
 for(const input of orderParts(raw.parts,p.parts)){
  if(!/^[a-zA-Z0-9_-]{1,24}$/.test(input.id)||ids.has(input.id))throw Error('Part IDs must be unique');
  if(!['post','beam','deck','wall','roof'].includes(input.kind)||!['timber','stone','reeds','clay'].includes(input.material))throw Error('Unsupported construction primitive');
  const center=vec(input.center,extended?-4:-3,4),size=vec(input.size,.08,6),part={id:input.id,kind:input.kind,material:input.material,center,size,shape:input.shape==='cylinder'?'cylinder':'box',requires:input.requires||[],finish:input.finish||'rough',built:false,workMinutes:0};
  if(!['rough','hewn'].includes(part.finish)||input.joinery&&!['lashed','stacked'].includes(input.joinery))throw Error('Precision pegs, drilled joints and sawn boards require tool chains not yet available. Use rough or hand-hewn material with lashings or ground support.');
  if(part.finish==='hewn'&&part.material!=='timber')throw Error('Hewn finish is only supported for timber.');
  part.craftVersion=1;
  if(!Array.isArray(part.requires)||part.requires.some(id=>!ids.has(id)))throw Error('Dependencies must refer to earlier parts');
  const r=partBounds(p,part);
  if(Math.abs(center[0])+size[0]/2>site.width/2+.01||Math.abs(center[2])+size[2]/2>site.depth/2+.01||r.bottom<-.1||r.top>4)errors.push(`${part.id} outside site: local x=${(center[0]-size[0]/2).toFixed(2)}..${(center[0]+size[0]/2).toFixed(2)} must fit +/-${site.width/2}; z=${(center[2]-size[2]/2).toFixed(2)}..${(center[2]+size[2]/2).toFixed(2)} must fit +/-${site.depth/2}; height=${r.bottom.toFixed(2)}..${r.top.toFixed(2)} must fit 0..4`);
  if((part.kind==='deck'||part.kind==='roof')&&size[1]>.45)throw Error('Decks and roofs must be horizontal panels');
  if(input.material==='reeds'&&!['wall','roof','deck'].includes(part.kind))throw Error('Reeds cannot support a bridge or frame');
  if(input.material==='reeds'&&part.kind==='deck'&&(p.spansWater||size[1]>.18))throw Error('Reed bedding must be a thin layer on dry ground or a hard supporting deck');
  if(input.material==='clay'&&part.kind!=='wall')throw Error('Unfired clay is daub for supported walls, not load-bearing beams');
  if(part.shape==='cylinder'&&part.kind!=='post')throw Error('Round members currently stand vertically as posts');
  const supports=part.requires.map(id=>p.parts.find(x=>x.id===id));
  if(extended&&supports.some(s=>extended.parts.some(x=>x.id===s.id)&&!activeParts(extended).has(s.id)))throw Error('Repair failed existing supports before adding dependent components');
  if(supports.length&&supports.every(x=>['reeds','clay'].includes(x.material)))throw Error('Soft reed or clay panels cannot carry another structural part');
  for(const disconnected of supports.filter(s=>!touch(r,partBounds(p,s)))){const b=partBounds(p,disconnected),gaps=[Math.max(r.minX-b.maxX,b.minX-r.maxX,0),Math.max(r.bottom-b.top,b.bottom-r.top,0),Math.max(r.minZ-b.maxZ,b.minZ-r.maxZ,0)];errors.push(`${part.id} does not touch ${disconnected.id}: gaps x/height/z=${gaps.map(n=>n.toFixed(2)).join('/')}; each must be <=0.16. Correct centers or dependency`);}
  const ground=r.bottom<=.16&&(!p.spansWater||[r.minZ,r.maxZ].every(y=>(nearestWater(w,{x:p.position.x,y})?.edge??-1)>.25));
  if(part.material==='reeds'&&part.kind==='deck'&&r.bottom>.025&&!coversRectangle(supports.filter(s=>s.kind==='deck'&&['timber','stone'].includes(s.material)&&Math.abs(partBounds(p,s).top-r.bottom)<=.03).map(s=>partBounds(p,s)),r))throw Error('Reed bedding needs a hard supporting deck underneath its full footprint, or dry ground');
  if(!ground&&!supports.length)errors.push(`Floating part ${part.id}: bottom=${r.bottom.toFixed(2)}. A ground piece needs center height=size[1]/2=${(size[1]/2).toFixed(2)} and dry ground; otherwise name a touching earlier support`);
  if(part.kind==='deck'&&p.spansWater&&(size[0]<1.1||size[2]>1.6||r.top>.65))throw Error('Bridge decks need walkable width, low height, and short assembly sections');
  const volume=size[0]*size[1]*size[2]*(part.shape==='cylinder'?Math.PI/4:1);part.materialUnits=Math.max(1,Math.ceil(volume*(part.material==='stone'?8:part.material==='timber'?5:part.material==='clay'?6:3)-1e-9));part.requiredMinutes=(part.finish==='hewn'?16:5)+part.materialUnits*2;
  const maximum=part.material==='timber'?6:part.material==='stone'?12:part.material==='clay'?12:16;if(part.materialUnits>maximum)errors.push(`${part.id} size=${size.join('x')} costs ${part.materialUnits} ${part.material}; maximum ${maximum}. Make thinner/smaller panels. When thinning, recalculate center heights and supports`);
  total+=part.materialUnits;p.parts.push(part);ids.add(part.id);
 }
 if(extended)checkAdditionSpace(w,p,p.parts.slice(extended.parts.length));
 if(total>160)errors.push(`Total material cost ${total} exceeds 160`);if(errors.length)throw Error(errors.slice(0,12).join('\n'));
 const bounds=p.parts.map(part=>partBounds(p,part));p.bounds={minX:Math.min(...bounds.map(b=>b.minX)),maxX:Math.max(...bounds.map(b=>b.maxX)),minZ:Math.min(...bounds.map(b=>b.minZ)),maxZ:Math.max(...bounds.map(b=>b.maxZ))};
 if(!generated&&p.purpose==='bridge'){
  const decks=p.parts.filter(p=>p.kind==='deck').map(x=>partBounds(p,x)).sort((a,b)=>a.minZ-b.minZ);
  if(!decks.length||decks[0].minZ>p.position.y-1.7||decks.at(-1).maxZ<p.position.y+1.7)throw Error('Bridge deck must connect both banks');
  for(let i=1;i<decks.length;i++)if(decks[i].minZ>decks[i-1].maxZ+.04||Math.min(decks[i].maxX,decks[i-1].maxX)-Math.max(decks[i].minX,decks[i-1].minX)<1.05||Math.abs(decks[i].top-decks[i-1].top)>.25)throw Error('Bridge deck is not continuously walkable');
 }else if(!generated&&p.purpose==='storage'){
  const floors=p.parts.filter(x=>x.kind==='deck'),walls=p.parts.filter(x=>x.kind==='wall');
  if(!floors.length||walls.length<3)throw Error('Storage requires a floor and at least three walls');
  const panels=floors.map(x=>partBounds(p,x)),f={minX:Math.min(...panels.map(x=>x.minX)),maxX:Math.max(...panels.map(x=>x.maxX)),minZ:Math.min(...panels.map(x=>x.minZ)),maxZ:Math.max(...panels.map(x=>x.maxZ)),bottom:Math.min(...panels.map(x=>x.bottom)),top:Math.max(...panels.map(x=>x.top))};
  if(f.top-Math.min(...panels.map(x=>x.top))>.05||!coversRectangle(panels,f))throw Error('Storage floor panels must form one continuous level rectangle without holes');
  const width=f.maxX-f.minX,depth=f.maxZ-f.minZ,height=Math.min(...walls.map(x=>partBounds(p,x).top))-f.top;
  if(height<.45||walls.some(x=>!touch({...f,top:f.top+height},partBounds(p,x))))throw Error('Storage walls must enclose its floor');
  const sides=new Set();for(const wall of walls){const b=partBounds(p,wall);if(b.bottom>f.top+.16)continue;
   if(wall.size[2]>=depth*.9&&wall.size[0]<=.3){if(Math.abs(b.minX-f.minX)<.2)sides.add('left');if(Math.abs(b.maxX-f.maxX)<.2)sides.add('right');}
   if(wall.size[0]>=width*.9&&wall.size[2]<=.3){if(Math.abs(b.minZ-f.minZ)<.2)sides.add('back');if(Math.abs(b.maxZ-f.maxZ)<.2)sides.add('front');}
  }if(sides.size<3)throw Error('Storage walls must cover three distinct sides of the floor');
  p.capacityVolume=Math.min(100,Math.floor(width*depth*height*35));p.capacityKg=Math.min(90,p.capacityVolume*1.1);
  if(p.capacityVolume<20)throw Error('Storage is too small to use');
  const lids=p.parts.filter(x=>x.kind==='roof'&&partBounds(p,x).bottom>=f.top+height-.16);p.covered=coversRectangle(lids.map(x=>partBounds(p,x)),f);
  p.secured=p.covered&&sides.size===4&&walls.every(x=>['timber','stone'].includes(x.material))&&lids.length>0&&lids.every(x=>x.material==='timber');
 }else if(!generated&&(!p.parts.some(x=>x.kind==='roof')||p.parts.filter(x=>x.kind==='post'||x.kind==='wall').length<3))throw Error('Shelter needs a roof and supporting sides');
 if(!generated&&p.purpose==='shelter'){const preview={...w,settlement:{...w.settlement,projects:[...w.settlement.projects,{...p,id:'validation',parts:p.parts.map(x=>({...x,built:true}))}]}},roof=p.parts.find(x=>x.kind==='roof');const rest={x:p.position.x+roof.center[0],y:p.position.y+roof.center[2]};if(!liveWalkable(preview,rest)||!liveRoute(preview,a.coordinates,rest,a))throw Error('Shelter needs an accessible place beneath its roof');}
 if(generated){p.affordances=inferAffordances(p);const finished={...p,id:'validation',status:'complete',parts:p.parts.map(x=>({...x,built:true}))},preview={...w,settlement:{...w.settlement,projects:[...w.settlement.projects.filter(x=>x.id!==extended?.id),finished]}};
  p.affordances.restPoints=p.affordances.restPoints.filter(point=>liveWalkable(preview,point)&&liveRoute(preview,a.coordinates,point,a));
  if(!p.affordances.restPoints.length)p.affordances.labels=p.affordances.labels.filter(x=>x!=='Potential sheltered rest');
 }
 p.bill={};for(const part of p.parts)p.bill[part.material]=(p.bill[part.material]||0)+part.materialUnits;return p;
}
export function adoptBlueprint(w,a,design,model){
 if(!design)return null;if(!design.extendsProjectId&&householdProjects(w,a).length>=12||householdProjects(w,a).filter(p=>p.status!=='complete').length>=2||w.settlement.projects.some(p=>p.ownerId===a.id&&p.status!=='complete'))throw Error('Construction capacity reached');
 const existing=design.extendsProjectId?w.settlement.projects.find(p=>p.id===design.extendsProjectId):null;
 if(design.extendsProjectId&&(!existing||existing.status!=='complete'||existing.ownerId!==a.id&&existing.access!=='shared'||design.extensionBase!==JSON.stringify(existing.parts.map(x=>x.id))))throw Error('Structure changed while the addition was being designed; reconsider it');
 const p={...design,id:existing?.id||`project-${w.settlement.nextId++}`,ownerId:existing?.ownerId||a.id,...(a.householdId?{householdId:a.householdId}:{}),designer:a.name,model,source:'ai',createdAt:clock(w),status:'planned',revision:0};
 if(existing)checkAdditionSpace(w,design,design.parts.slice(existing.parts.length));
 const stockPositions=[{x:p.bounds.maxX+1,y:p.bounds.maxZ+1},{x:p.bounds.minX-1,y:p.bounds.maxZ+1},{x:p.bounds.maxX+1,y:p.bounds.minZ-1},{x:p.bounds.minX-1,y:p.bounds.minZ-1}],stockPosition=stockPositions.find(q=>liveWalkable(w,q)&&liveRoute(w,a.coordinates,q,a));
 // Reuse a finished project's rack where it was physically put aside. Its
 // identity, coordinates and any remaining supplies are retained, not moved
 // to the new drawing's corner or duplicated on each design request.
 const spare=w.settlement.stores.filter(s=>s.kind==='site'&&s.ownerId===a.id&&distance(s.position,p.position)<24&&w.settlement.projects.find(old=>old.id===s.projectId)?.status==='complete'&&liveRoute(w,a.coordinates,s.position,a)).sort((x,y)=>distance(x.position,p.position)-distance(y.position,p.position))[0];
 if(!spare&&!stockPosition)throw Error('No reachable material staging area');
 if(spare){if(spare.projectId!==p.id)spare.previousProjects=[...(spare.previousProjects||[]),spare.projectId];spare.projectId=p.id;spare.access=p.access;spare.name=`Materials for ${p.name}`;spare.revision++;p.stockpileId=spare.id;}
 else p.stockpileId=makeStore(w,{position:stockPosition,ownerId:a.id,access:p.access,kind:'site',name:`Materials for ${p.name}`,capacityKg:260,capacityVolume:480,projectId:p.id}).id;
 const stage={name:design.name,rationale:design.rationale,designerId:a.id,model,code:design.code||null,createdAt:clock(w),partIds:design.parts.slice(existing?.parts.length||0).map(x=>x.id)};
 let adopted=p;
 if(existing){const oldParts=existing.parts,priorStage={name:existing.name,rationale:existing.rationale,designerId:existing.ownerId,model:existing.model,code:existing.code||null,createdAt:existing.createdAt,completedAt:existing.completedAt,partIds:oldParts.map(x=>x.id)};existing.stages??=[priorStage];existing.stages.push(stage);Object.assign(existing,{parts:[...oldParts,...design.parts.slice(oldParts.length)],bounds:design.bounds,bill:design.bill,affordances:design.affordances,stockpileId:p.stockpileId,status:'planned',constructionVersion:2,revision:existing.revision+1});adopted=existing;}
 else {p.stages=[stage];delete p.extensionBase;delete p.extendsProjectId;w.settlement.projects.push(p);}
 a.improvementGoal={kind:'construction',projectId:adopted.id,reason:design.rationale,startedAt:clock(w),status:'active'};w.settlement.revision++;remember(w,a,`I designed ${p.name}: ${p.rationale}`,{importance:8,tags:['construction','design'],source:`design:${p.id}`});
 addEvent(w,'construction-design',`${a.name} designed ${p.name}`,`${p.rationale} The ${stage.partIds.length} new parts are a plan; materials still need to be carried here and assembled.`,{agentId:a.id,projectId:p.id});return adopted;
}
export const DESIGN_SYSTEM=`You are a person surviving in a physical valley. Design and CODE what you need from your environment. There is NO named building catalog or prefab recipe. A structure's name/purpose grants no functionality. Invent geometry suited to actual needs, terrain, materials, possessions and social context; you may defer with build:false. A proposed design creates no supplies or finished work. People gather, carry and assemble every piece afterwards.
Return JSON {build:boolean,name:string,purpose:string,siteId:string,access:"private"|"shared",rationale:string,code:string,replacesProjectId?:string,extendsProjectId?:string}. purpose is YOUR short description, not an enum. code is a construction program in a bounded JavaScript subset: const/let, arithmetic, comparisons, if, for loops (<=128 iterations), plain named functions (<=8 nested calls), arrays (bounded local array.push is supported), template strings and plain objects. Math.min/max/abs/floor/ceil/round/sin/cos/sqrt and Math.PI are available. Variables site and materials are already supplied and expose real dimensions and currently gatherable totals. Read site.width/site.depth; use different names for your own dimensions. A local variable cannot change the actual site boundaries. No eval, imports, network, new, timers, global state, property mutation or arbitrary engine changes.
Call part({id,kind,material,shape,finish,center:[x,height,z],size:[width,height,depth],requires:[support part ids]}) to emit each physical piece. part returns its id. You choose dimensions, offsets, part arrangement, dependencies and reusable functions/loops. 1–48 new pieces, ids unique <=24 letters/digits/_/-, kind post|beam|deck|wall|roof describes a geometric role; shape box or cylinder (vertical posts only). Available materials timber, stone, reeds, clay. Reeds may form walls/roofs or thin bedding decks (<=.18 thick) on dry ground or a hard timber/stone deck covering their full footprint. A raised bedding layer must touch its hard deck (gap<=.03); reeds cannot carry another part. Unfired clay is only supported wall daub. Soft panels cannot carry other parts. Keep useful geometries novel; a resource pile, weather cover, elevated platform, enclosure or crossing are possible outcomes, not recipes.
Build in useful stages: a small primitive start may be just a few pieces. Finish that stage, use it, then decide whether to add walls, a roof, bedding, more space, repair it, or build a different replacement. There is no required upgrade ladder. An extension site has extendsProjectId and existingParts with exact geometry. To extend it, return that siteId and matching extendsProjectId, and emit ONLY new parts with unique ids. Existing parts can be named as supports. They cannot be moved, replaced, renamed or spent again. Up to 96 retained components and 160 new material units per stage; a completed usable section stays useful while additions are built. Check improvementGoal and actual experience. Do not design a large final building when a smaller useful stage addresses the need.
Technique rules: shape describes a physical envelope, not manufactured lumber. finish defaults to rough: bark-on poles, uneven branch mats and reed bundles. Cordage is made through actual work: three reed bundles or one long-fiber unit makes a 4 m coil. Panels use 0.8 m of ties per square unit of face area; timber frame members use 0.5 m per supporting joint. Workers cut measured lengths and retain the unused cord at that project for later pieces and additions. The projects context includes the remaining binding budget. Splitting a panel into smaller pieces does not multiply its binding cost. finish:hewn means hand-hewn timber with visible tool marks, requiring a carried hafted stone edge and 12 minutes of recorded woodworking practice. Tools themselves require stone flakes, worked handles and cordage; they are not granted by a plan. No sawn boards, turned pegs, nails or precision joinery: those tool chains are not implemented. Designers may plan ahead of available tools, but workers must acquire materials, craft prerequisites and practice first. Check the supplied craft context. Use a supplied site. Coordinates relative to site center; bottom=center[1]-size[1]/2, top=center[1]+size[1]/2. All sizes>=.08, top<=4, bottom>=0, within site's width/depth. EVERY dependency must touch directly (gap<=.16 each axis); otherwise support on dry ground. Cost=max(1,ceil(volume*density)); cylinder volume=width*height*depth*PI/4. Density timber5, stone8, reeds3, clay6. Each part must cost<=6 timber,12 stone/clay,16 reeds for one person's carrying capacity. Total<=160. Thin panels and shorter sections are useful. Materials need not be in hand at design time but plan a plausible local supply chain.
Functions emerge from geometry: horizontal deck panels (<=.45 thick) can hold finite supplies; roofs shed rain only under their footprint; covered platforms shelter their supplies while wood dries over actual elapsed time. Three distinct enclosing sides on a continuous level deck retain more loose goods; four hard walls plus a full timber cover secure supplies. Roofs >=1.35 above a reachable open rest point offer shelter. Low connected deck sections across water can become a walking route as they are built; each deck >=1.1 wide and <=1.6 long, top<=.65, touching earlier bank-supported sections. Water extends across local z=-site.waterHalfWidth..site.waterHalfWidth (default 1.25); foundations must lie at least .35 beyond those edges on actual dry bank. Use the supplied site depth for the complete crossing. Deck or roof thickness<=.45. Resting comfort follows completed usable geometry: open horizontal deck surfaces top<=.65 can support seated rest when at least .55 by .55, or lying rest when at least .85 wide and 2.1 long. Adjacent level panels must continuously cover the footprint; support dependencies must remain sound. Walls, low roofs, supplies and other occupants can prevent use. Soft reed bedding on dry ground or a full hard supporting deck is more comfortable than bare timber/stone; rain exposure and poor condition reduce comfort. A shelter alone provides weather protection, not a mattress. Consult comfort.lastRest, uncomfortableMinutes and improvementWanted: repeated uncomfortable rest is a reason to find or design better seating/bedding, while urgent survival and existing useful furniture still matter. Name/purpose grants no comfort. At a site with climbsTerrain, supported hard deck treads can climb the supplied heightDifference. Use tread width>=1.1, depth>=.3, continuous touching edges and height increments<=.46. A real supported series must join dry lower ground to the upperEdge at the supplied height; a name does not enable climbing. These are the physical functions currently supported; decorative geometry cannot claim new simulation powers.
Durability is consequential: captured workmanship, tools, materials, weather and real use govern wear. Rough/worn roofs leak; storage holds less; crossings have cargo limits and slow travelers. Failed supporting parts remove their dependent uses. Inspect performance and observedProblems for actual reasons to repair or improve. You may request maintenance with {build:false,repairProjectId:<existing id>,rationale:<reason>}; this requests real work, not instant repair. For a NEW independent structure OMIT replacesProjectId. To replace one, use only an id from allowedReplacementIds; a private structure owned by another person is not yours to replace. Or code a replacement design on an available site with replacesProjectId:<allowed id>. The original remains until the replacement is built, with its resources preserved. Better tools, practice, material selection and dimensions can improve reliability and capacity; a new name alone cannot. Repair when sufficient, replace when the current design cannot meet a real need, or defer. There is no scripted age or sequence at which a replacement must happen. Consider family.housingGoal and actual dependent children or pregnancy as reasons for safe, dry resting space. A child is not labor or an extra adult. Consider open food exposure, wet wood, hunger, cold, effort and relationships. Shared useful structures can help others and their experiences feed later decisions. Do not duplicate an existing design without a reason. If previousProgram/previousRejection are supplied, repair your source according to measured errors and return complete corrected code. If retryStrategy is fresh_design, abandon the repeatedly rejected geometry, reconsider the current need and write a simpler NEW program; do not copy the failed draft. Each call is scarce. Check ground heights, direct support contact and ownership before returning. If existing projects show use feedback, learn from it. Never invent a completed event, material or new engine capability.`;
