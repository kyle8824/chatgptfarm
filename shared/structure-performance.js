// Deliberately bounded simulation model, not engineering load certification.
// Quality is captured from actual work; appearance edits never enter this model.
export const clamp01=x=>Math.max(0,Math.min(1,x));
export const conditionOf=part=>clamp01(part.durability?.condition??1);
export const qualityOf=part=>clamp01(part.durability?.quality??(part.finish==='hewn'?.7:.45));
export const activeParts=p=>{const active=new Set();for(const part of p.parts)if(part.built&&conditionOf(part)>.12&&(part.requires||[]).every(id=>active.has(id)))active.add(part.id);return active;};
export function cargoAllowance(p,part){
 const active=activeParts(p);if(!active.has(part.id))return 0;
 const support=(id,seen=new Set())=>{if(seen.has(id))return 1;seen.add(id);const x=p.parts.find(x=>x.id===id);return x?Math.min(conditionOf(x)*qualityOf(x),...(x.requires||[]).map(id=>support(id,seen))):0;};
 const width=Math.min(1.35,part.size[0]/1.1),thickness=Math.min(1.7,part.size[1]/.2),material={timber:1,stone:1.25,reeds:.1,clay:.1}[part.material]||.5;
 return Math.max(0,24*width*thickness*material*support(part.id));
}
export function surfaceProtection(part){return conditionOf(part)*(.5+.5*qualityOf(part))*({timber:.94,reeds:.8,stone:.97,clay:.4}[part.material]||.5);}
export function structurePerformance(p){
 const built=p.parts.filter(x=>x.built),active=activeParts(p),usable=built.filter(x=>active.has(x.id)),roofs=usable.filter(x=>x.kind==='roof'),decks=built.filter(x=>x.kind==='deck');
 const condition=built.length?Math.min(...built.map(conditionOf)):1,quality=built.length?built.reduce((n,x)=>n+qualityOf(x),0)/built.length:null;
 return {condition,quality,recorded:built.every(x=>x.durability?.origin==='work'),activeParts:active.size,
  roofProtection:roofs.reduce((n,x)=>n+surfaceProtection(x)*x.size[0]*x.size[2],0)/Math.max(.001,built.filter(x=>x.kind==='roof').reduce((n,x)=>n+x.size[0]*x.size[2],0)),
  storageFactor:decks.length&&decks.every(x=>active.has(x.id))?Math.min(...decks.map(x=>(.45+.55*qualityOf(x))*conditionOf(x))):0,
  cargoKg:p.closing?0:(p.spansWater||p.purpose==='bridge')&&decks.length?Math.min(...decks.map(x=>cargoAllowance(p,x))):null,
  status:p.closing?'Closing':condition<=.12?'Failed':condition<.35?'Unsafe':condition<.65?'Worn':'Serviceable'};
}
