import {structurePerformance} from '../shared/structure-performance.js';
import {constructionSpec} from '../shared/craft.js';
// The existing main-domain /live rewrite keeps snapshot reads same-origin.
export const WORLD_BASE='/live';
export const SNAPSHOT_KEY='chatgptfarm-structure-catalog-v1';
export function validProject(p){
 return !!p&&typeof p.id==='string'&&typeof p.name==='string'&&Array.isArray(p.parts)&&p.parts.length>0&&p.parts.length<=96&&p.parts.every(x=>typeof x.id==='string'&&['post','beam','deck','wall','roof'].includes(x.kind)&&['timber','stone','reeds','clay'].includes(x.material)&&Array.isArray(x.center)&&x.center.length===3&&x.center.every(n=>Number.isFinite(n)&&Math.abs(n)<=10)&&Array.isArray(x.size)&&x.size.length===3&&x.size.every(n=>Number.isFinite(n)&&n>0&&n<=6)&&Number.isFinite(x.materialUnits)&&x.materialUnits>=0);
}
export function catalogFromFrame(frame){
 if(!frame?.settlement||!Array.isArray(frame.settlement.projects)||!frame.settlement.projects.every(validProject))throw Error('The world returned an unreadable design catalog.');
 return {savedAt:Date.now(),worldId:frame.runtime?.createdAt??null,revision:frame.runtime?.revision??null,day:frame.day,agents:(frame.agents||[]).map(a=>({id:a.id,name:a.name,inventory:a.inventory||{},skills:a.skills||{},craftPractice:a.craftPractice||{}})),projects:frame.settlement.projects.slice(0,12),stores:frame.settlement.stores||[]};
}
export function readCatalog(storage){try{const raw=storage.getItem(SNAPSHOT_KEY);if(!raw||raw.length>2000000)return null;const x=JSON.parse(raw);return Array.isArray(x.projects)&&x.projects.every(validProject)&&Number.isFinite(x.savedAt)?x:null;}catch{return null;}}
export function resourceRows(p,stores=[]){
 const rows=new Map(),stock=stores.find(s=>s.id===p.stockpileId)?.items||{},keys={timber:['dryWood','wetWood'],stone:['stones'],reeds:['reeds'],clay:['clay']};
 for(const part of p.parts){const row=rows.get(part.material)||{material:part.material,required:0,committed:0,atSite:0,missing:0};row.required+=part.materialUnits;if(part.built||part.invested)row.committed+=part.materialUnits;rows.set(part.material,row);}
 const bindings=p.parts.reduce((n,x)=>n+constructionSpec(x).binding,0);if(bindings)rows.set('cordage',{material:'cordage',required:bindings,committed:p.parts.reduce((n,x)=>n+(x.bindingUsed||0),0),atSite:0,missing:0});keys.cordage=['cordage'];
 for(const row of rows.values()){row.atSite=keys[row.material].reduce((n,key)=>n+(stock[key]||0),0);row.missing=Math.max(0,row.required-row.committed-row.atSite);}return [...rows.values()];
}
export function physicalFunctions(p){
 const result=[],a=p.affordances,live=p.status==='complete',performance=structurePerformance(p),factor=live?performance.storageFactor:1;
 if(a){if(a.rainCover?.length&&(!live||performance.roofProtection>0))result.push(live?Math.round(performance.roofProtection*100)+'% rain protection beneath intact roofing':'Rain cover beneath the roof');if(a.storage&&factor>0)result.push(`${Math.round(a.storage.capacityKg*factor)} kg / ${Math.round(a.storage.capacityVolume*factor)} space units of ${a.storage.covered?'covered':'open'} storage${a.storage.secured?' · secured':''}`);if(a.restPoints?.length&&(!live||performance.roofProtection>0))result.push('Accessible sheltered rest');if(a.walkableDecks?.length&&(!live||performance.cargoKg>0))result.push(live?performance.cargoKg.toFixed(1)+' kg cargo allowance across intact deck sections':'Walkable sections across water');}
 else {if(p.purpose==='storage')result.push(`${Math.round(p.capacityKg||0)} kg of ${p.covered?'covered':'open'} storage${p.secured?' · secured':''}`);if(p.purpose==='bridge')result.push('A walkable crossing as its deck is assembled');if(p.purpose==='shelter')result.push('Sheltered rest beneath the roof');}
 return result.length?result:[live?'Failed components currently prevent this structure from providing its intended uses.':'No additional physical function has been measured for this design.'];
}

export function constructionPrograms(data){
 return data.stages?.length?data.stages.map((stage,i)=>"// Stage "+(i+1)+" · "+stage.name+"\n"+(stage.code||JSON.stringify(data.parts.filter(p=>stage.partIds.includes(p.id)),null,2))).join("\n\n"):data.code||JSON.stringify(data.parts,null,2);
}
