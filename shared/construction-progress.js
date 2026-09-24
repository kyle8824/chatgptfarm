export function constructionProgress(part){
 if(part.built)return {phase:'built',label:'In place',fraction:1};
 if(!part.invested)return {phase:'planned',label:'Needs materials',fraction:0};
 const fraction=Math.max(0,Math.min(1,(part.workMinutes||0)/Math.max(.001,part.requiredMinutes||1)));
 return {fraction,phase:fraction<.4?'preparing':fraction<.8?'placing':'fastening',label:fraction<.4?'Preparing materials':fraction<.8?'Placing components':'Securing joints'};
}
