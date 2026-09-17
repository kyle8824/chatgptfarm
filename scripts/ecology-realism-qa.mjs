import { ensureEcology, advanceEcology } from '../engine/ecology.js';
import { advanceWeatherMemory } from '../engine/core.js';

const dist=(a,b)=>Math.hypot((a?.x||0)-(b?.x||0),(a?.y||0)-(b?.y||0));
const panicRadius={deer:7.5,rabbit:4.2,bear:9};
const w={day:1,hour:0,weather:'clear',temperature:58,settings:{ai:{people:{},wildlife:{enabled:false,individuals:{}},usage:{track:true}}},agents:[{id:'agent-mara',name:'Mara',coordinates:{x:50,y:50}},{id:'agent-ivo',name:'Ivo',coordinates:{x:53,y:49}}],ecologySystem:null};
ensureEcology(w);
const home=Object.fromEntries(w.ecologySystem.wildlife.map(a=>[a.id,{...a.home}]));
const stats={rabbitMaxHome:0,bearMinHuman:Infinity,rabbitWaterSeeking:0,tracksMax:0,dayRabbitHidden:0,twilightRabbitActive:0,twilightSamples:0,persistence:0,closeHumanHours:0,bearCloseHumanHours:0,humanWildlifeEvents:0,bearEncounterEvents:0,rabbitAbsentHours:0,deerPresentHours:0,deerAbsentHours:0,bearPresentHours:0,bearAbsentHours:0,signsMax:0,signsSeen:0,lastBehavior:new Map()};
for(let step=0;step<120;step++){
  w.weather=(step%31>=27&&step%31<=29)?'rain':'clear';
  const beforeEvents=new Set((w.ecologySystem.events||[]).map(e=>e.id));
  advanceEcology(w);
  for(const e of w.ecologySystem.events||[]){
    if(beforeEvents.has(e.id))continue;
    if(['bear-encounter','wildlife-flight'].includes(e.kind))stats.humanWildlifeEvents++;
    if(e.kind==='bear-encounter')stats.bearEncounterEvents++;
  }
  for(const a of w.ecologySystem.wildlife){
    if(!Number.isFinite(a.position?.x)||!Number.isFinite(a.position?.y)||a.position.x<0||a.position.x>100||a.position.y<0||a.position.y>100)throw new Error(`invalid wildlife position ${a.id}: ${JSON.stringify(a.position)}`);
    if(a.species==='rabbit'&&a.localPresence===false)stats.rabbitAbsentHours++;
    if(a.species==='deer'){if(a.localPresence===false)stats.deerAbsentHours++;else stats.deerPresentHours++}
    if(a.species==='bear'){if(a.localPresence===false)stats.bearAbsentHours++;else stats.bearPresentHours++}
    const prev=stats.lastBehavior.get(a.id);if(prev===a.behavior)stats.persistence++;stats.lastBehavior.set(a.id,a.behavior);
    if(a.localPresence===false)continue;
    const humanD=Math.min(...w.agents.map(p=>dist(a.position,p.coordinates)));
    if(panicRadius[a.species]&&humanD<panicRadius[a.species]){
      stats.closeHumanHours++;
      if(a.species==='bear')stats.bearCloseHumanHours++;
    }
    if(a.species==='rabbit'){
      stats.rabbitMaxHome=Math.max(stats.rabbitMaxHome,dist(a.position,home[a.id]));
      if(a.behavior==='seeking water')stats.rabbitWaterSeeking++;
      if(w.hour>=9&&w.hour<17&&['hide','freeze','rest'].includes(a.activity))stats.dayRabbitHidden++;
      if((w.hour>=5&&w.hour<=8)||(w.hour>=17&&w.hour<=21)){stats.twilightSamples++;if(!['hide','freeze','rest'].includes(a.activity))stats.twilightRabbitActive++}
    }
    if(a.species==='bear')stats.bearMinHuman=Math.min(stats.bearMinHuman,humanD);
  }
  stats.tracksMax=Math.max(stats.tracksMax,w.ecologySystem.traces.length);stats.signsMax=Math.max(stats.signsMax,w.ecologySystem.signs.length);stats.signsSeen+=w.ecologySystem.signs.length;for(const s of w.ecologySystem.signs){if(s.species==='fish')throw new Error(`fish created terrestrial sign ${s.id}`);if(!w.ecologySystem.wildlife.some(a=>a.id===s.sourceId))throw new Error(`orphan ecological sign ${s.id}`)}
  w.hour++;if(w.hour>=24){w.hour=0;w.day++}
}
const panicProbe=(species)=>{
  const pw={day:2,hour:7,weather:'clear',temperature:61,settings:{ai:{people:{},wildlife:{enabled:false,individuals:{}},usage:{track:true}}},agents:[{id:'agent-mara',name:'Mara',coordinates:{x:1,y:1}},{id:'agent-ivo',name:'Ivo',coordinates:{x:2,y:2}}],ecologySystem:null};
  ensureEcology(pw);const a=pw.ecologySystem.wildlife.find(x=>x.species===species);const human={x:a.position.x+1,y:a.position.y};pw.agents[0].coordinates=human;pw.agents[1].coordinates={x:2,y:96};const before=dist(a.position,human);advanceEcology(pw);return{species,before,after:dist(a.position,human),goalDistance:dist(a.target,human),activity:a.activity,behavior:a.behavior};
};
const panicProbes=['rabbit','deer','bear'].map(panicProbe);
const hydro={day:3,hour:10,weather:'rain',environmentState:{surfaceWetness:.3,creekLevel:.42,lastRainAt:null,hoursSinceRain:null}};
advanceWeatherMemory(hydro);const rainWet=hydro.environmentState.surfaceWetness,rainLevel=hydro.environmentState.creekLevel;hydro.hour=11;hydro.weather='clear';advanceWeatherMemory(hydro);const afterClear=hydro.environmentState.surfaceWetness,afterLevel=hydro.environmentState.creekLevel;
const failures=[];
if(rainWet<=.3)failures.push(`rain failed to raise canonical surface wetness: ${rainWet}`);
if(rainLevel<=.42)failures.push(`rain failed to raise canonical creek level: ${rainLevel}`);
if(!(afterClear<rainWet&&afterClear>.3))failures.push(`rain aftermath did not persist while drying: rain=${rainWet} clear=${afterClear}`);
if(!(afterLevel<rainLevel&&afterLevel>.42))failures.push(`creek level did not recede gradually after rain: rain=${rainLevel} clear=${afterLevel}`);
if(stats.rabbitMaxHome>18)failures.push(`cottontail exceeded local home-range envelope: ${stats.rabbitMaxHome.toFixed(1)} world units`);
if(stats.rabbitWaterSeeking!==0)failures.push(`cottontails sought open water ${stats.rabbitWaterSeeking} times`);
if(stats.bearMinHuman<7)failures.push(`bear approached humans too closely in routine simulation: ${stats.bearMinHuman.toFixed(1)} world units`);
if(stats.tracksMax>24)failures.push(`trace cap exceeded: ${stats.tracksMax}`);
if(stats.signsMax>18)failures.push(`ecological sign cap exceeded: ${stats.signsMax}`);
if(stats.signsSeen<3)failures.push(`wildlife activity left too little persistent sign over 120 hours: ${stats.signsSeen}`);
if(stats.dayRabbitHidden<8)failures.push(`cottontails did not spend enough daylight time in cover: ${stats.dayRabbitHidden}`);
if(stats.twilightSamples&&stats.twilightRabbitActive/stats.twilightSamples<.18)failures.push(`cottontails were implausibly inactive at dawn/dusk: ${(stats.twilightRabbitActive/stats.twilightSamples).toFixed(2)}`);
if(stats.persistence<80)failures.push(`wildlife behavior is changing too frequently; persistence count ${stats.persistence}`);
if(stats.closeHumanHours>10)failures.push(`wildlife spent too many routine hours at panic-close human distance: ${stats.closeHumanHours}`);
if(stats.bearCloseHumanHours>1)failures.push(`bear remained panic-close to people too often: ${stats.bearCloseHumanHours} hours`);
if(stats.humanWildlifeEvents>6)failures.push(`human-wildlife encounter events are too frequent: ${stats.humanWildlifeEvents} in 120 hours`);
if(stats.bearEncounterEvents>1)failures.push(`bear encounter events are too frequent: ${stats.bearEncounterEvents} in 120 hours`);
if(stats.rabbitAbsentHours!==0)failures.push(`resident cottontails left the basin unexpectedly: ${stats.rabbitAbsentHours} rabbit-hours`);
if(stats.deerAbsentHours<20||stats.deerPresentHours<20)failures.push(`deer range use lacks natural presence/absence variation: present=${stats.deerPresentHours}, absent=${stats.deerAbsentHours}`);
if(stats.bearAbsentHours<60||stats.bearPresentHours<2)failures.push(`black bear should be an occasional basin visitor: present=${stats.bearPresentHours}, absent=${stats.bearAbsentHours}`);
for(const p of panicProbes){if(p.activity!=='flee')failures.push(`${p.species} did not flee at panic distance: ${JSON.stringify(p)}`);if(p.after<=p.before+.15)failures.push(`${p.species} failed to increase human distance while fleeing: ${JSON.stringify(p)}`);if(p.goalDistance<=p.before+.75)failures.push(`${p.species} escape goal did not create separation: ${JSON.stringify(p)}`);if(!String(p.behavior).includes('cover'))failures.push(`${p.species} panic behavior did not seek cover: ${JSON.stringify(p)}`)}
if(failures.length){console.error(failures.join('\n'));process.exit(1)}
console.log(JSON.stringify({ok:true,...stats,lastBehavior:undefined},null,2));
