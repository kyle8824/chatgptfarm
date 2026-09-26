// Renewable plant biomass advances only with elapsed simulated time. Starting
// this rule on an old checkpoint never backfills years of missed growth.
export const REED_GROWTH_SECONDS=2*3600;
export function advancePlantGrowth(w,seconds){
 if(!(seconds>0))return;
 const growth=w.plantGrowth??={version:1,beds:{}};
 const weatherFactor=w.temperature<=32?0:w.temperature<45?.5:1;
 const rate=weatherFactor*(w.weather==='rain'?1:.75);
 const advance=(id,amount,capacity)=>{
  const bed=growth.beds[id]??={progress:0,grown:0};
  if(amount>=capacity){bed.progress=0;return 0;}
  bed.progress+=seconds*rate/REED_GROWTH_SECONDS;
  const gain=Math.min(capacity-amount,Math.floor(bed.progress));
  bed.progress-=gain;bed.grown+=gain;if(amount+gain>=capacity)bed.progress=0;
  return gain;
 };
 for(const h of w.frontier?.homes||[null]){
  const account=!h||h.id==='willow-basin'?w.resources:h.resources;
  if(account)account.reeds=(account.reeds||0)+advance('camp:'+(h?.id||'willow-basin'),account.reeds||0,18);
 }
 for(const node of w.resourceSites?.nodes||[]){
  if(!['reeds','longFiber'].includes(node.item))continue;
  const gain=advance(node.id,node.remaining,node.initial);
  if(gain){node.remaining+=gain;node.regrown=(node.regrown||0)+gain;w.resourceSites.revision++;}
 }
}
