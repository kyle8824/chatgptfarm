// A look contains no dimensions, materials, costs, ownership or capabilities.
// Bind it to the exact physical design so later redesigns cannot inherit it by ID.
export const DEFAULT_STRUCTURE_LOOK=Object.freeze({timber:'#96724c',stone:'#969b90',reeds:'#b3a171',clay:'#ab805e',roughness:.9,grain:1});
export function normalizeStructureLook(value={}){
 const out={...DEFAULT_STRUCTURE_LOOK};
 for(const key of Object.keys(value)){
  if(!Object.hasOwn(out,key))throw Error('A look can only change color and surface finish.');
  if(['roughness','grain'].includes(key)){if(!Number.isFinite(value[key])||value[key]<(key==='grain'?0:.7)||value[key]>1)throw Error('Surface finish is out of range.');out[key]=value[key];}
  else {if(typeof value[key]!=='string'||!/^#[0-9a-f]{6}$/i.test(value[key]))throw Error('Use a six-digit color.');out[key]=value[key].toLowerCase();}
 }return out;
}
export function structureSignature(p){return JSON.stringify({id:p.id,purpose:p.purpose,access:p.access,spansWater:!!p.spansWater,parts:p.parts.map(x=>({id:x.id,kind:x.kind,material:x.material,shape:x.shape||'box',center:x.center,size:x.size,requires:x.requires||[],materialUnits:x.materialUnits}))});}
export function makeStructureLook(p,appearance){return {schema:'chatgptfarm-structure-look/1',projectId:p.id,designSignature:structureSignature(p),appearance:normalizeStructureLook(appearance)};}
export function readStructureLook(p,document){
 if(!document||Object.keys(document).some(k=>!['schema','projectId','designSignature','appearance'].includes(k))||document.schema!=='chatgptfarm-structure-look/1'||document.projectId!==p.id||document.designSignature!==structureSignature(p))throw Error('This look belongs to a different physical design.');
 return normalizeStructureLook(document.appearance);
}
