import { ensureEcology, advanceEcology } from '../engine/ecology.js';

const dist=(a,b)=>Math.hypot((a?.x||0)-(b?.x||0),(a?.y||0)-(b?.y||0));
const w={day:1,hour:0,weather:'clear',temperature:58,settings:{ai:{people:{},wildlife:{enabled:false,individuals:{}},usage:{track:true}}},agents:[{id:'agent-mara',name:'Mara',coordinates:{x:50,y:50}},{id:'agent-ivo',name:'Ivo',coordinates:{x:53,y:49}}],ecologySystem:null};
ensureEcology(w);
const home=Object.fromEntries(w.ecologySystem.wildlife.map(a=>[a.id,{...a.home}]));
const stats={rabbitMaxHome:0,bearMinHuman:Infinity,rabbitWaterSeeking:0,tracksMax:0,dayRabbitHidden:0,twilightRabbitActive:0,twilightSamples:0,persistence:0,lastBehavior:new Map()};
for(let step=0;step<120;step++){
  w.weather=(step%31>=27&&step%31<=29)?'rain':'clear';
  advanceEcology(w);
  for(const a of w.ecologySystem.wildlife){
    if(!Number.isFinite(a.position?.x)||!Number.isFinite(a.position?.y)||a.position.x<0||a.position.x>100||a.position.y<0||a.position.y>100)throw new Error(`invalid wildlife position ${a.id}: ${JSON.stringify(a.position)}`);
    if(a.species==='rabbit'){
      stats.rabbitMaxHome=Math.max(stats.rabbitMaxHome,dist(a.position,home[a.id]));
      if(a.behavior==='seeking water')stats.rabbitWaterSeeking++;
      if(w.hour>=9&&w.hour<17&&['hide','freeze','rest'].includes(a.activity))stats.dayRabbitHidden++;
      if((w.hour>=5&&w.hour<=8)||(w.hour>=17&&w.hour<=21)){stats.twilightSamples++;if(!['hide','freeze','rest'].includes(a.activity))stats.twilightRabbitActive++}
    }
    if(a.species==='bear')for(const p of w.agents)stats.bearMinHuman=Math.min(stats.bearMinHuman,dist(a.position,p.coordinates));
    const prev=stats.lastBehavior.get(a.id);if(prev===a.behavior)stats.persistence++;stats.lastBehavior.set(a.id,a.behavior);
  }
  stats.tracksMax=Math.max(stats.tracksMax,w.ecologySystem.traces.length);
  w.hour++;if(w.hour>=24){w.hour=0;w.day++}
}
const failures=[];
if(stats.rabbitMaxHome>18)failures.push(`cottontail exceeded local home-range envelope: ${stats.rabbitMaxHome.toFixed(1)} world units`);
if(stats.rabbitWaterSeeking!==0)failures.push(`cottontails sought open water ${stats.rabbitWaterSeeking} times`);
if(stats.bearMinHuman<7)failures.push(`bear approached humans too closely in routine simulation: ${stats.bearMinHuman.toFixed(1)} world units`);
if(stats.tracksMax>24)failures.push(`trace cap exceeded: ${stats.tracksMax}`);
if(stats.dayRabbitHidden<8)failures.push(`cottontails did not spend enough daylight time in cover: ${stats.dayRabbitHidden}`);
if(stats.twilightSamples&&stats.twilightRabbitActive/stats.twilightSamples<.18)failures.push(`cottontails were implausibly inactive at dawn/dusk: ${(stats.twilightRabbitActive/stats.twilightSamples).toFixed(2)}`);
if(stats.persistence<80)failures.push(`wildlife behavior is changing too frequently; persistence count ${stats.persistence}`);
if(failures.length){console.error(failures.join('\n'));process.exit(1)}
console.log(JSON.stringify({ok:true,...stats,lastBehavior:undefined},null,2));
