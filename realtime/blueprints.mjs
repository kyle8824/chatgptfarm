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
 for(const x of [48,78,25]){const y=riverY(x),p={x,y:y+2.6};if(w.settlement.projects.some(b=>b.purpose==='bridge'&&Math.abs(b.position.x-x)<10))continue;
  if(liveRoute(w,a.coordinates,p))sites.push({id:`crossing-${x}`,position:{x,y},purposes:['bridge'],width:2.8,depth:6,waterHalfWidth:1.25});
 }return sites;
}
export function designContext(w,a){return {person:a.name,needs:a.needs,carry:loadOf(w,a),inventory:a.inventory,propertyConcern:a.propertyConcern||0,memories:a.memories.slice(0,5).map(m=>m.text),stores:w.settlement.stores.map(s=>({name:s.name,ownerId:s.ownerId,access:s.access,secured:s.secured,load:loadOf(w,s),capacityKg:s.capacityKg,position:s.position})),projects:w.settlement.projects.map(p=>({name:p.name,purpose:p.purpose,status:p.status,ownerId:p.ownerId})),resources:{...w.resources,standingTimber:w.settlement.trees.reduce((n,t)=>n+treeUnits(w,t),0)},sites:buildingSites(w,a)};}
function touch(a,b){return Math.max(a.minX-b.maxX,b.minX-a.maxX,0)<=.16&&Math.max(a.minZ-b.maxZ,b.minZ-a.maxZ,0)<=.16&&Math.max(a.bottom-b.top,b.bottom-a.top,0)<=.16;}
export function validateBlueprint(w,a,raw){
 if(!raw||typeof raw!=='object')throw Error('Invalid construction response');
 if(raw.build===false)return null;
 if(raw.build!==true)throw Error('Explicit build decision required');
 const site=buildingSites(w,a).find(s=>s.id===raw.siteId);if(!site||!site.purposes.includes(raw.purpose))throw Error('Site unavailable or wrong purpose');
 if(!Array.isArray(raw.parts)||raw.parts.length<4||raw.parts.length>28)throw Error('Use 4–28 parts');
 const p={name:text(raw.name,70),rationale:text(raw.rationale,350),purpose:raw.purpose,siteId:site.id,position:{...site.position},access:raw.access==='shared'?'shared':'private',parts:[]};
 const ids=new Set();let total=0;
 for(const input of raw.parts){
  if(!/^[a-zA-Z0-9_-]{1,24}$/.test(input.id)||ids.has(input.id))throw Error('Part IDs must be unique');
  if(!['post','beam','deck','wall','roof'].includes(input.kind)||!['timber','stone','reeds'].includes(input.material))throw Error('Unsupported construction primitive');
  const center=vec(input.center,-3,4),size=vec(input.size,.08,6),part={id:input.id,kind:input.kind,material:input.material,center,size,requires:input.requires||[],built:false,workMinutes:0};
  if(!Array.isArray(part.requires)||part.requires.some(id=>!ids.has(id)))throw Error('Dependencies must refer to earlier parts');
  const r=partBounds(p,part);
  if(Math.abs(center[0])+size[0]/2>site.width/2+.01||Math.abs(center[2])+size[2]/2>site.depth/2+.01||r.bottom<-.1||r.top>4)throw Error('Part outside buildable site');
  if((part.kind==='deck'||part.kind==='roof')&&size[1]>.45)throw Error('Decks and roofs must be horizontal panels');
  if(input.material==='reeds'&&!['wall','roof'].includes(part.kind))throw Error('Reeds cannot support a bridge or frame');
  const supports=part.requires.map(id=>p.parts.find(x=>x.id===id));
  const disconnected=supports.find(s=>!touch(r,partBounds(p,s)));if(disconnected)throw Error(`${part.id} does not touch ${disconnected.id}; requires must list only immediately touching supports, not all earlier foundations`);
  const ground=r.bottom<=.16&&(p.purpose!=='bridge'||[r.minZ,r.maxZ].every(y=>(nearestWater(w,{x:p.position.x,y})?.edge??-1)>.25));
  if(!ground&&!supports.length)throw Error(`Floating part ${part.id}`);
  if(part.kind==='deck'&&p.purpose==='bridge'&&(size[0]<1.1||size[2]>1.6||r.top>.65))throw Error('Bridge decks need walkable width, low height, and short assembly sections');
  const volume=size[0]*size[1]*size[2];part.materialUnits=Math.max(1,Math.ceil(volume*(part.material==='stone'?8:part.material==='timber'?5:3)-1e-9));part.requiredMinutes=1.5+part.materialUnits*.75;
  const maximum=part.material==='timber'?6:part.material==='stone'?12:16;if(part.materialUnits>maximum)throw Error(`${part.id} costs ${part.materialUnits} ${part.material} units; each part may cost at most ${maximum}. Split it into smaller pieces a person can carry`);
  total+=part.materialUnits;if(total>160)throw Error('Design exceeds material budget');p.parts.push(part);ids.add(part.id);
 }
 const bounds=p.parts.map(part=>partBounds(p,part));p.bounds={minX:Math.min(...bounds.map(b=>b.minX)),maxX:Math.max(...bounds.map(b=>b.maxX)),minZ:Math.min(...bounds.map(b=>b.minZ)),maxZ:Math.max(...bounds.map(b=>b.maxZ))};
 if(p.purpose==='bridge'){
  const decks=p.parts.filter(p=>p.kind==='deck').map(x=>partBounds(p,x)).sort((a,b)=>a.minZ-b.minZ);
  if(!decks.length||decks[0].minZ>p.position.y-1.7||decks.at(-1).maxZ<p.position.y+1.7)throw Error('Bridge deck must connect both banks');
  for(let i=1;i<decks.length;i++)if(decks[i].minZ>decks[i-1].maxZ+.04||Math.min(decks[i].maxX,decks[i-1].maxX)-Math.max(decks[i].minX,decks[i-1].minX)<1.05||Math.abs(decks[i].top-decks[i-1].top)>.25)throw Error('Bridge deck is not continuously walkable');
 }else if(p.purpose==='storage'){
  const floor=p.parts.find(x=>x.kind==='deck'),walls=p.parts.filter(x=>x.kind==='wall');
  if(!floor||walls.length<3)throw Error('Storage requires a floor and at least three walls');
  const f=partBounds(p,floor),height=Math.min(...walls.map(x=>partBounds(p,x).top))-f.top;
  if(height<.45||walls.some(x=>!touch({...f,top:f.top+height},partBounds(p,x))))throw Error('Storage walls must enclose its floor');
  const sides=new Set();for(const wall of walls){const b=partBounds(p,wall);if(b.bottom>f.top+.16)continue;
   if(wall.size[2]>=floor.size[2]*.9&&wall.size[0]<=.3){if(Math.abs(b.minX-f.minX)<.2)sides.add('left');if(Math.abs(b.maxX-f.maxX)<.2)sides.add('right');}
   if(wall.size[0]>=floor.size[0]*.9&&wall.size[2]<=.3){if(Math.abs(b.minZ-f.minZ)<.2)sides.add('back');if(Math.abs(b.maxZ-f.maxZ)<.2)sides.add('front');}
  }if(sides.size<3)throw Error('Storage walls must cover three distinct sides of the floor');
  p.capacityVolume=Math.min(100,Math.floor(floor.size[0]*floor.size[2]*height*35));p.capacityKg=Math.min(90,p.capacityVolume*1.1);
  if(p.capacityVolume<20)throw Error('Storage is too small to use');
  p.covered=p.parts.some(x=>x.kind==='roof'&&x.size[0]>=floor.size[0]&&x.size[2]>=floor.size[2]);
  p.secured=p.covered&&sides.size===4&&walls.every(x=>x.material!=='reeds')&&p.parts.some(x=>x.kind==='roof'&&x.material==='timber');
 }else if(!p.parts.some(x=>x.kind==='roof')||p.parts.filter(x=>x.kind==='post'||x.kind==='wall').length<3)throw Error('Shelter needs a roof and supporting sides');
 if(p.purpose==='shelter'){const preview={...w,settlement:{...w.settlement,projects:[...w.settlement.projects,{...p,id:'validation',parts:p.parts.map(x=>({...x,built:true}))}]}},roof=p.parts.find(x=>x.kind==='roof');const rest={x:p.position.x+roof.center[0],y:p.position.y+roof.center[2]};if(!liveWalkable(preview,rest)||!liveRoute(preview,a.coordinates,rest))throw Error('Shelter needs an accessible place beneath its roof');}
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
export const DESIGN_SYSTEM=`You are a villager designing useful structures in a physical world. Decide whether a new structure is useful based on actual needs, possessions, exposure, theft memories and existing buildings. You may decide build:false. Otherwise create YOUR OWN construction program, not a completed building. Materials need not be in hand yet; villagers will gather and haul them later. Prioritize useful personal storage if belongings lack a proper container; a bridge can open the far bank. Do not duplicate an existing building without a reason.
Return only JSON: {build:boolean,name:string,purpose:"storage"|"bridge"|"shelter",siteId:string,access:"private"|"shared",rationale:string,parts:[{id:string,kind:"post"|"beam"|"deck"|"wall"|"roof",material:"timber"|"stone"|"reeds",center:[x,height,z],size:[width,height,depth],requires:[earlier part ids]}]}.
Choose a supplied available site. Coordinates are local world units relative to its center, bottom height 0 is ground; axis-aligned boxes only. 4–28 parts, total material units <=160. All sizes >=.08, tops <=4, parts within site's width/depth. Parts must rest on dry ground or touch an earlier declared supporting part. EVERY part named in requires must immediately touch this piece; do not list indirect supports (a lid usually touches wall tops, not the floor below). Boxes touch when their faces meet or are within .16 on each axis. No floating geometry, no executable Javascript. Timber and stone can support; reeds only wall/roof. Cost per part=max(1,ceil(width*height*depth * density)), density 5 timber, 8 stone, 3 reeds. EACH part must cost <=6 timber, <=12 stone, or <=16 reeds so one person can carry it. Calculate every part's cost before responding; use thin panels or smaller sections when necessary. Labor comes later.
Storage: horizontal deck floor <=.45 thick, at least 3 vertical walls covering DISTINCT floor edges and touching the floor, inside height >=.45. Each wall is <=.3 thick and spans >=90% of its corresponding floor edge. A full timber lid/roof and 4 timber/stone walls permit owner-only secured storage. Make doors/lids as box parts; visitors access containers from outside. Capacity follows dimensions; a useful chest can be much smaller than the site's maximum width/depth.
Bridge: north-south crossing. Water spans local z=-1.25..1.25, first foundation section must lie fully on dry bank beyond z=1.6 or z=-1.6. Deck sections must be >=1.1 wide in x and <=1.6 long in z, thickness <=.45, deck tops <=.65; neighboring sections touch without gaps and share >=1.05 width. Extend the continuous deck past BOTH z=-1.7 and z=1.7. Assemble consecutive short sections outward from a bank; each declares the previous section as support. You can add bank posts, beams, or rails; they need touching supports. Avoid walls across the walking surface. Shelter: roof on at least three supports with an open doorway.`;
