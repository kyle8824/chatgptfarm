import {insideBounds} from '../shared/landscape.js';
import {knownPlace} from './frontier-knowledge.mjs';
import {walkable,distance} from '../engine/navigation.js';
import {groundTimber,clock,makeStore} from './holdings.mjs';
import {partBounds} from './structures.mjs';
import {activeParts} from '../shared/structure-performance.js';
import {inferAffordances} from './affordances.mjs';

// Additions retain the structure, every completed component and its supplies.
// Crossings and terrain climbs still use their existing specialized validation.
export function extensionSites(w,a){
 return w.settlement.projects.filter(p=>p.status==='complete'&&!p.supersededBy&&!p.spansWater&&!p.climbsTerrain&&p.purpose!=='bridge'&&p.parts.length<96&&(p.ownerId===a.id||p.access==='shared')&&knownPlace(w,a,p)&&distance(a.coordinates,p.position)<40&&insideBounds(w,p.position,4)).sort((p,q)=>(p.ownerId===a.id?0:1)-(q.ownerId===a.id?0:1)||distance(a.coordinates,p.position)-distance(a.coordinates,q.position)).slice(0,1).map(p=>({id:'extend-'+p.id,extendsProjectId:p.id,position:{...p.position},width:8,depth:8,purposes:[p.purpose],existingParts:p.parts.map(({id,kind,material,center,size,shape,requires,finish})=>({id,kind,material,center:[...center],size:[...size],shape,requires:[...(requires||[])],finish}))}));
}

export function orderParts(parts,existing=[]){
 const known=new Set(existing.map(p=>p.id)),pending=new Map();
 for(const p of parts){if(!p||typeof p.id!=='string'||known.has(p.id)||pending.has(p.id))throw Error('Part IDs must be unique, including existing components');pending.set(p.id,p);}
 for(const p of parts)if(!Array.isArray(p.requires||[])||(p.requires||[]).some(id=>!known.has(id)&&!pending.has(id)))throw Error('Dependency names a missing part');
 const ordered=[];
 while(pending.size){let progress=false;for(const [id,p]of pending)if((p.requires||[]).every(x=>known.has(x))){ordered.push(p);known.add(id);pending.delete(id);progress=true;}if(!progress)throw Error('Construction dependencies contain a cycle');}
 return ordered;
}

export function checkAdditionSpace(w,p,parts){
 const timber=groundTimber(w);
 for(const part of parts){const r=partBounds(p,part);
  for(let x=r.minX;x<=r.maxX+.001;x+=Math.min(.5,part.size[0]))for(let y=r.minZ;y<=r.maxZ+.001;y+=Math.min(.5,part.size[2]))if(!walkable(w,{x,y}))throw Error('Addition requires clear dry terrain');
  if(w.settlement.trees.some(t=>(timber.get(t.id)||0)>0&&Math.hypot(Math.max(r.minX-t.position.x,t.position.x-r.maxX,0),Math.max(r.minZ-t.position.y,t.position.y-r.maxZ,0))<.5))throw Error('Addition overlaps standing timber');
  for(const other of w.settlement.projects)if(other.id!==p.extendsProjectId)for(const q of other.parts){const b=partBounds(other,q);if(r.minX<b.maxX+.25&&r.maxX>b.minX-.25&&r.minZ<b.maxZ+.25&&r.maxZ>b.minZ-.25)throw Error('Addition overlaps another construction site');}
 }
}

export function refreshBuiltFunctions(w,p){
 if(!p.generic)return;
 const active=activeParts(p),built=p.parts.filter(x=>active.has(x.id));
 p.usableAffordances=inferAffordances({...p,parts:built});
 const properties=p.usableAffordances.storage;
 // A finished bed should not acquire a supply pile during its intermediate
 // hard-platform stage. Existing stores and their contents are never deleted.
 if(!properties||p.affordances?.restSurfaces?.some(s=>s.soft)&&!properties.enclosed)return;
 let store=w.settlement.stores.find(s=>s.id===p.storeId);
 if(!store){store=makeStore(w,{...properties,kind:properties.enclosed?'storage':'platform',name:p.name,ownerId:p.ownerId,access:p.access,projectId:p.id});p.storeId=store.id;}
 else {const {position,...changes}=properties;Object.assign(store,changes);store.kind=properties.enclosed?'storage':'platform';store.revision++;}
 store.designCapacity={mass:properties.capacityKg,volume:properties.capacityVolume,covered:properties.covered,secured:properties.secured,baseHeight:properties.baseHeight};
}

export function completeStages(w,p){
 for(const stage of p.stages||[])if(stage.completedAt===undefined&&stage.partIds.every(id=>p.parts.find(x=>x.id===id)?.built))stage.completedAt=clock(w);
 refreshBuiltFunctions(w,p);
}
