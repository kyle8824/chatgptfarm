import {runConstructionCode} from './construction-code.mjs';
import {inferAffordances} from './affordances.mjs';
import {materialSources} from './resource-sites.mjs';
import {distance,walkable} from '../engine/navigation.js';
import {addEvent,remember} from '../engine/core.js';
import {riverY,nearestWater} from './water.mjs';
import {liveWalkable,liveRoute} from './motion.mjs';
import {partBounds} from './structures.mjs';
import {clock,makeStore,loadOf,treeUnits} from './holdings.mjs';
const text=(s,max)=>{if(typeof s!=='string'||!s.trim())throw Error('Missing design text');return s.trim().slice(0,max);};
const number=(v,min,max)=>{if(!Number.isFinite(v)||v<min||v>max)throw Error('Design dimension out of bounds');return v;};
const vec=(v,min,max)=>{if(!Array.isArray(v)||v.length!==3)throw Error('Expected three dimensions');return v.map(n=>number(n,min,max));};
export function buildingSites(w,a){
 const sites=[];
 for(const [i,p]of [{x:72,y:38},{x:58,y:39},{x:72,y:44},{x:59,y:45},{x:79,y:38},{x:53,y:40}].entries()){
  if(w.settlement.projects.some(b=>distance(b.position,p)<6))continue;
  if(w.settlement.trees.some(t=>treeUnits(w,t)>0&&distance(t.position,p)<3.5))continue;
  if(liveWalkable(w,p)&&liveRoute(w,a.coordinates,p))sites.push({id:`clearing-${i}`,position:p,purposes:['storage','shelter'],width:4,depth:4});
 }
 const local=new Set();for(const radius of [8,14])for(let i=0;i<8;i++){
  const angle=i*Math.PI/4,p={x:Math.round(a.coordinates.x+Math.cos(angle)*radius),y:Math.round(a.coordinates.y+Math.sin(angle)*radius)},id=`local-${p.x}-${p.y}`;
  if(local.has(id)||p.x<4||p.y<4||p.x>w.worldModel.bounds.width-4||p.y>w.worldModel.bounds.height-4)continue;local.add(id);
  if(w.settlement.projects.some(b=>distance(b.position,p)<6)||w.settlement.trees.some(t=>treeUnits(w,t)>0&&distance(t.position,p)<3.5))continue;
  if(![-2,0,2].every(x=>[-2,0,2].every(y=>liveWalkable(w,{x:p.x+x,y:p.y+y}))))continue;
  if(liveRoute(w,a.coordinates,p))sites.push({id,position:p,purposes:['storage','shelter'],width:4,depth:4});if(sites.length>=12)break;
 }
 for(const x of [48,78,25]){const y=riverY(x),p={x,y:y+2.6};if(w.settlement.projects.some(b=>b.purpose==='bridge'&&Math.abs(b.position.x-x)<10))continue;
  if(liveRoute(w,a.coordinates,p))sites.push({id:`crossing-${x}`,position:{x,y},purposes:['bridge'],width:2.8,depth:6,waterHalfWidth:1.25,spansWater:true});
 }return sites;
}
function physicalSite(site){const {purposes,...geometry}=site;return {...geometry,spansWater:!!site.spansWater};}
export function designContext(w,a){return {person:a.name,needs:a.needs,carry:loadOf(w,a),inventory:a.inventory,propertyConcern:a.propertyConcern||0,memories:a.memories.slice(0,5).map(m=>m.text),stores:w.settlement.stores.map(s=>({name:s.name,ownerId:s.ownerId,access:s.access,secured:s.secured,load:loadOf(w,s),capacityKg:s.capacityKg,position:s.position})),projects:w.settlement.projects.map(p=>({name:p.name,purpose:p.purpose,status:p.status,ownerId:p.ownerId,affordances:p.affordances?.labels||[],feedback:p.feedback?.observations?.[a.id]||null,code:p.ownerId===a.id?p.code?.slice(0,3000):undefined})),materialSources:['stone','reeds','clay'].flatMap(kind=>materialSources(w,kind,a).map(s=>({material:kind,position:s.position,remaining:s.remaining}))),resources:{...w.resources,standingTimber:w.settlement.trees.reduce((n,t)=>n+treeUnits(w,t),0)},sites:buildingSites(w,a).map(physicalSite)};}
function touch(a,b){return Math.max(a.minX-b.maxX,b.minX-a.maxX,0)<=.16&&Math.max(a.minZ-b.maxZ,b.minZ-a.maxZ,0)<=.16&&Math.max(a.bottom-b.top,b.bottom-a.top,0)<=.16;}
function coversRectangle(rectangles,target){
 const xs=[target.minX,target.maxX,...rectangles.flatMap(r=>[Math.max(target.minX,Math.min(target.maxX,r.minX)),Math.max(target.minX,Math.min(target.maxX,r.maxX))])].sort((a,b)=>a-b);
 for(let i=1;i<xs.length;i++){if(xs[i]-xs[i-1]<.001)continue;const x=(xs[i]+xs[i-1])/2,spans=rectangles.filter(r=>r.minX<=x&&r.maxX>=x).sort((a,b)=>a.minZ-b.minZ);let end=target.minZ;for(const r of spans){if(r.minZ>end+.04)break;end=Math.max(end,r.maxZ);}if(end<target.maxZ-.04)return false;}return true;
}
// A villager can move during inference. Keep the issued local site identity,
// but recheck its physical clearance and route against the current world.
function issuedLocalSite(w,a,raw,issued){
 if(!issued||issued.id!==raw.siteId||!/^local-\d+-\d+$/.test(issued.id)||issued.spansWater)return null;
 const p=issued.position;
 if(!p||issued.width!==4||issued.depth!==4||issued.id!==`local-${p.x}-${p.y}`||p.x<4||p.y<4||p.x>w.worldModel.bounds.width-4||p.y>w.worldModel.bounds.height-4)return null;
 if(w.settlement.projects.some(b=>distance(b.position,p)<6)||w.settlement.trees.some(t=>treeUnits(w,t)>0&&distance(t.position,p)<3.5))return null;
 if(![-2,0,2].every(x=>[-2,0,2].every(y=>liveWalkable(w,{x:p.x+x,y:p.y+y})))||!liveRoute(w,a.coordinates,p))return null;
 return issued;
}
export function validateBlueprint(w,a,raw,issuedSite=null){
 if(!raw||typeof raw!=='object')throw Error('Invalid construction response');
 if(raw.build===false)return null;
 if(raw.build!==true)throw Error('Explicit build decision required');
 const generated=typeof raw.code==='string',site=buildingSites(w,a).find(s=>s.id===raw.siteId)||(generated&&issuedLocalSite(w,a,raw,issuedSite));if(!site||!generated&&!site.purposes.includes(raw.purpose))throw Error('Site unavailable or wrong purpose');
 const compiled=generated?runConstructionCode(raw.code,{site:physicalSite(site),materials:{timber:w.settlement.trees.reduce((n,t)=>n+treeUnits(w,t),0),stone:materialSources(w,'stone',a).reduce((n,s)=>n+s.remaining,0),reeds:materialSources(w,'reeds',a).reduce((n,s)=>n+s.remaining,0),clay:materialSources(w,'clay',a).reduce((n,s)=>n+s.remaining,0)}}):null;
 if(compiled)raw={...raw,parts:compiled.parts};
 if(!Array.isArray(raw.parts)||raw.parts.length<4||raw.parts.length>(generated?48:28))throw Error('Use 4–'+(generated?48:28)+' parts');
 const p={name:text(raw.name,70),rationale:text(raw.rationale,350),purpose:generated?text(raw.purpose||'individual design',80):raw.purpose,generic:generated,spansWater:!!site.spansWater,...(compiled?{code:compiled.code,codeVersion:compiled.codeVersion}:{}),siteId:site.id,position:{...site.position},access:raw.access==='shared'?'shared':'private',parts:[]};
 const ids=new Set(),errors=[];let total=0;
 for(const input of raw.parts){
  if(!/^[a-zA-Z0-9_-]{1,24}$/.test(input.id)||ids.has(input.id))throw Error('Part IDs must be unique');
  if(!['post','beam','deck','wall','roof'].includes(input.kind)||!['timber','stone','reeds','clay'].includes(input.material))throw Error('Unsupported construction primitive');
  const center=vec(input.center,-3,4),size=vec(input.size,.08,6),part={id:input.id,kind:input.kind,material:input.material,center,size,shape:input.shape==='cylinder'?'cylinder':'box',requires:input.requires||[],built:false,workMinutes:0};
  if(!Array.isArray(part.requires)||part.requires.some(id=>!ids.has(id)))throw Error('Dependencies must refer to earlier parts');
  const r=partBounds(p,part);
  if(Math.abs(center[0])+size[0]/2>site.width/2+.01||Math.abs(center[2])+size[2]/2>site.depth/2+.01||r.bottom<-.1||r.top>4)errors.push(`${part.id} outside site: local x=${(center[0]-size[0]/2).toFixed(2)}..${(center[0]+size[0]/2).toFixed(2)} must fit +/-${site.width/2}; z=${(center[2]-size[2]/2).toFixed(2)}..${(center[2]+size[2]/2).toFixed(2)} must fit +/-${site.depth/2}; height=${r.bottom.toFixed(2)}..${r.top.toFixed(2)} must fit 0..4`);
  if((part.kind==='deck'||part.kind==='roof')&&size[1]>.45)throw Error('Decks and roofs must be horizontal panels');
  if(input.material==='reeds'&&!['wall','roof'].includes(part.kind))throw Error('Reeds cannot support a bridge or frame');
  if(input.material==='clay'&&part.kind!=='wall')throw Error('Unfired clay is daub for supported walls, not load-bearing beams');
  if(part.shape==='cylinder'&&part.kind!=='post')throw Error('Round members currently stand vertically as posts');
  const supports=part.requires.map(id=>p.parts.find(x=>x.id===id));
  if(supports.length&&supports.every(x=>['reeds','clay'].includes(x.material)))throw Error('Soft reed or clay panels cannot carry another structural part');
  for(const disconnected of supports.filter(s=>!touch(r,partBounds(p,s)))){const b=partBounds(p,disconnected),gaps=[Math.max(r.minX-b.maxX,b.minX-r.maxX,0),Math.max(r.bottom-b.top,b.bottom-r.top,0),Math.max(r.minZ-b.maxZ,b.minZ-r.maxZ,0)];errors.push(`${part.id} does not touch ${disconnected.id}: gaps x/height/z=${gaps.map(n=>n.toFixed(2)).join('/')}; each must be <=0.16. Correct centers or dependency`);}
  const ground=r.bottom<=.16&&(!p.spansWater||[r.minZ,r.maxZ].every(y=>(nearestWater(w,{x:p.position.x,y})?.edge??-1)>.25));
  if(!ground&&!supports.length)errors.push(`Floating part ${part.id}: bottom=${r.bottom.toFixed(2)}. A ground piece needs center height=size[1]/2=${(size[1]/2).toFixed(2)} and dry ground; otherwise name a touching earlier support`);
  if(part.kind==='deck'&&p.spansWater&&(size[0]<1.1||size[2]>1.6||r.top>.65))throw Error('Bridge decks need walkable width, low height, and short assembly sections');
  const volume=size[0]*size[1]*size[2]*(part.shape==='cylinder'?Math.PI/4:1);part.materialUnits=Math.max(1,Math.ceil(volume*(part.material==='stone'?8:part.material==='timber'?5:part.material==='clay'?6:3)-1e-9));part.requiredMinutes=1.5+part.materialUnits*.75;
  const maximum=part.material==='timber'?6:part.material==='stone'?12:part.material==='clay'?12:16;if(part.materialUnits>maximum)errors.push(`${part.id} size=${size.join('x')} costs ${part.materialUnits} ${part.material}; maximum ${maximum}. Make thinner/smaller panels. When thinning, recalculate center heights and supports`);
  total+=part.materialUnits;p.parts.push(part);ids.add(part.id);
 }
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
 if(!generated&&p.purpose==='shelter'){const preview={...w,settlement:{...w.settlement,projects:[...w.settlement.projects,{...p,id:'validation',parts:p.parts.map(x=>({...x,built:true}))}]}},roof=p.parts.find(x=>x.kind==='roof');const rest={x:p.position.x+roof.center[0],y:p.position.y+roof.center[2]};if(!liveWalkable(preview,rest)||!liveRoute(preview,a.coordinates,rest))throw Error('Shelter needs an accessible place beneath its roof');}
 if(generated){p.affordances=inferAffordances(p);const finished={...p,id:'validation',status:'complete',parts:p.parts.map(x=>({...x,built:true}))},preview={...w,settlement:{...w.settlement,projects:[...w.settlement.projects,finished]}};
  p.affordances.restPoints=p.affordances.restPoints.filter(point=>liveWalkable(preview,point)&&liveRoute(preview,a.coordinates,point));
  if(!p.affordances.restPoints.length)p.affordances.labels=p.affordances.labels.filter(x=>x!=='Potential sheltered rest');
 }
 p.bill={};for(const part of p.parts)p.bill[part.material]=(p.bill[part.material]||0)+part.materialUnits;return p;
}
export function adoptBlueprint(w,a,design,model){
 if(!design)return null;if(w.settlement.projects.length>=12||w.settlement.projects.filter(p=>p.status!=='complete').length>=2||w.settlement.projects.some(p=>p.ownerId===a.id&&p.status!=='complete'))throw Error('Construction capacity reached');
 const p={...design,id:`project-${w.settlement.nextId++}`,ownerId:a.id,designer:a.name,model,source:'ai',createdAt:clock(w),status:'planned',revision:0};
 const stockPositions=[{x:p.bounds.maxX+1,y:p.bounds.maxZ+1},{x:p.bounds.minX-1,y:p.bounds.maxZ+1},{x:p.bounds.maxX+1,y:p.bounds.minZ-1},{x:p.bounds.minX-1,y:p.bounds.minZ-1}],stockPosition=stockPositions.find(q=>liveWalkable(w,q)&&liveRoute(w,a.coordinates,q));if(!stockPosition)throw Error('No reachable material staging area');
 p.stockpileId=makeStore(w,{position:stockPosition,ownerId:a.id,access:p.access,kind:'site',name:`Materials for ${p.name}`,capacityKg:260,capacityVolume:480,projectId:p.id}).id;
 w.settlement.projects.push(p);w.settlement.revision++;remember(w,a,`I designed ${p.name}: ${p.rationale}`,{importance:8,tags:['construction','design'],source:`design:${p.id}`});
 addEvent(w,'construction-design',`${a.name} designed ${p.name}`,`${p.rationale} The ${p.parts.length} parts are a plan; materials still need to be carried here and assembled.`,{agentId:a.id,projectId:p.id});return p;
}
export const DESIGN_SYSTEM=`You are a person surviving in a physical valley. Design and CODE what you need from your environment. There is NO named building catalog or prefab recipe. A structure's name/purpose grants no functionality. Invent geometry suited to actual needs, terrain, materials, possessions and social context; you may defer with build:false. A proposed design creates no supplies or finished work. People gather, carry and assemble every piece afterwards.
Return JSON {build:boolean,name:string,purpose:string,siteId:string,access:"private"|"shared",rationale:string,code:string}. purpose is YOUR short description, not an enum. code is a construction program in a bounded JavaScript subset: const/let, arithmetic, comparisons, if, for loops (<=128 iterations), plain named functions (<=8 nested calls), arrays and plain objects. Math.min/max/abs/floor/ceil/round/sin/cos/sqrt and Math.PI are available. Variables site and materials expose supplied dimensions and currently gatherable totals. No eval, imports, network, new, timers, global state, property mutation or arbitrary engine changes.
Call part({id,kind,material,shape,center:[x,height,z],size:[width,height,depth],requires:[earlier part ids]}) to emit each physical piece. part returns its id. You choose dimensions, offsets, part arrangement, dependencies and reusable functions/loops. 4–48 pieces, ids unique <=24 letters/digits/_/-, kind post|beam|deck|wall|roof describes a geometric role; shape box or cylinder (vertical posts only). Available materials timber, stone, reeds, clay. Reeds only wall/roof; unfired clay only supported wall daub. Soft panels cannot carry other parts. Keep useful geometries novel; a resource pile, weather cover, elevated platform, enclosure or crossing are possible outcomes, not recipes.
Use a supplied site. Coordinates relative to site center; bottom=center[1]-size[1]/2, top=center[1]+size[1]/2. All sizes>=.08, top<=4, bottom>=0, within site's width/depth. EVERY dependency must touch directly (gap<=.16 each axis); otherwise support on dry ground. Cost=max(1,ceil(volume*density)); cylinder volume=width*height*depth*PI/4. Density timber5, stone8, reeds3, clay6. Each part must cost<=6 timber,12 stone/clay,16 reeds for one person's carrying capacity. Total<=160. Thin panels and shorter sections are useful. Materials need not be in hand at design time but plan a plausible local supply chain.
Functions emerge from geometry: horizontal deck panels (<=.45 thick) can hold finite supplies; roofs shed rain only under their footprint; covered platforms shelter their supplies while wood dries over actual elapsed time. Three distinct enclosing sides on a continuous level deck retain more loose goods; four hard walls plus a full timber cover secure supplies. Roofs >=1.35 above a reachable open rest point offer shelter. Low connected deck sections across water can become a walking route as they are built; each deck >=1.1 wide and <=1.6 long, top<=.65, touching earlier bank-supported sections. Water is local z=-1.25..1.25; initial foundations lie beyond +/-1.6 on dry bank. Deck or roof thickness<=.45. These are the physical functions currently supported; decorative geometry cannot claim new simulation powers.
Consider open food exposure, wet wood, hunger, cold, effort and relationships. Shared useful structures can help others and their experiences feed later decisions. Do not duplicate an existing design without a reason. If previousProgram/previousRejection are supplied, repair your own source according to measured errors and return its complete corrected code. If existing projects show use feedback, learn from it. Never invent a completed event, material or new engine capability.`;
