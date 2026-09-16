// Living Basin ecology is intentionally simulation-first; model escalation remains optional.
export const ECOLOGY_VERSION='living-basin-0.9.1';

const clamp=(n,a=0,b=100)=>Math.max(a,Math.min(b,n));
const hash=s=>{let h=2166136261;for(const c of String(s)){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0};
const unit=(w,salt)=>{const x=Math.sin((w.day*24+w.hour+hash(salt)%10000)*12.9898)*43758.5453;return x-Math.floor(x)};
const dist=(a,b)=>Math.hypot((a?.x||0)-(b?.x||0),(a?.y||0)-(b?.y||0));
const bound=p=>({x:clamp(p.x,1,99),y:clamp(p.y,1,99)});
const point=(x,y)=>({x,y});
const creekPoints=[[2,18.5],[12,21],[27,18],[43,22],[58,19],[72,23],[86,21],[98,23.7]].map(([x,y])=>({x,y}));
const habitat={
 deer:[point(18,34),point(26,42),point(41,40),point(57,39),point(74,36),point(84,31)],
 rabbit:[point(28,30),point(38,34),point(52,31),point(68,34),point(78,28),point(20,27)],
 bear:[point(8,46),point(12,55),point(24,52),point(82,49),point(91,42),point(88,56)]
};
const SPECIES={
 deer:{step:4.2,fearRadius:15,panicRadius:8,traceChance:.72,traceSize:1},
 rabbit:{step:3.1,fearRadius:9,panicRadius:5,traceChance:.42,traceSize:.55},
 bear:{step:2.4,fearRadius:7,panicRadius:3.5,traceChance:.82,traceSize:1.45},
 fish:{step:4.6,fearRadius:0,panicRadius:0,traceChance:0,traceSize:0}
};
function animal(id,species,label,x,y,extra={}){return{id,species,label,position:{x,y},previousPosition:{x,y},target:{x,y},activity:'rest',behavior:'calm',fear:0,needs:{energy:80,hunger:72,thirst:75},active:true,ageClass:'adult',history:[],ai:{eligible:true,mode:'simulation',calls:0,lastDecisionAt:null},movement:{from:{x,y},to:{x,y},worldDay:1,worldHour:6},...extra}}
function ensureArrays(e){e.events||=[];e.traces||=[];e.eventCooldowns||={};}
export function ensureEcology(w){
 w.settings||={};w.settings.ai||={};w.settings.ai.people||={};for(const a of w.agents||[])if(w.settings.ai.people[a.id]==null)w.settings.ai.people[a.id]=true;
 w.settings.ai.wildlife||={enabled:false,individuals:{}};w.settings.ai.usage||={track:true};
 w.ecologySystem||={version:ECOLOGY_VERSION,wildlife:[],ambient:{birds:0,frogs:0,insects:0,fishActivity:0},events:[],traces:[],eventCooldowns:{},lastAdvanced:null};
 w.ecologySystem.version=ECOLOGY_VERSION;w.ecologySystem.wildlife||=[];w.ecologySystem.ambient||={birds:0,frogs:0,insects:0,fishActivity:0};ensureArrays(w.ecologySystem);
 if(!w.ecologySystem.wildlife.length){w.ecologySystem.wildlife=[
  animal('W-DEER-001','deer','doe',24,37,{sex:'female'}),animal('W-DEER-002','deer','young buck',72,35,{sex:'male'}),
  animal('W-RABBIT-001','rabbit','cottontail',35,31),animal('W-RABBIT-002','rabbit','cottontail',62,33),animal('W-RABBIT-003','rabbit','cottontail',77,27),
  animal('W-BEAR-001','bear','black bear',91,50,{sex:'female',behavior:'wary'}),
  animal('W-FISH-001','fish','creek fish school',15,69,{ageClass:'school'}),animal('W-FISH-002','fish','creek fish school',67,72,{ageClass:'school'})
 ];}
 for(const x of w.ecologySystem.wildlife){x.previousPosition||={...x.position};x.target||={...x.position};x.movement||={from:{...x.position},to:{...x.position},worldDay:w.day,worldHour:w.hour};x.ai||={eligible:true,mode:'simulation',calls:0,lastDecisionAt:null};x.history||=[];if(x.species==='fish'&&((x.position?.y||0)>50||(x.target?.y||0)>50||(x.movement?.to?.y||0)>50)){const q=creekPoints[hash(x.id)%creekPoints.length];x.position={...q};x.previousPosition={...q};x.target={...q};x.movement={from:{...q},to:{...q},goal:{...q},worldDay:w.day,worldHour:w.hour,speed:0};x.history.push({day:w.day,hour:w.hour,activity:'migration',behavior:'coordinate migration',from:null,to:{...q},goal:{...q}})}else if(x.behavior==='seeking water'&&(x.target?.y||0)>50){const q=nearestCreek(x.position);x.target={...q};x.movement={...x.movement,to:{...x.position},goal:{...q}}}}
 updateAmbient(w);return w.ecologySystem;
}
function nearestAgent(w,a){let best=null,d=Infinity;for(const p of w.agents||[]){const c=p.coordinates;if(!c)continue;const q=dist(a.position,c);if(q<d){d=q;best={agent:p,distance:q,position:c}}}return best}
function chooseHabitat(w,a){const choices=habitat[a.species]||[point(50,40)];return choices[Math.floor(unit(w,`${a.id}:habitat`)*choices.length)%choices.length]}
function creekTarget(w,a){return creekPoints[Math.floor(unit(w,`${a.id}:creek`)*creekPoints.length)%creekPoints.length]}
function nearestCreek(p){return creekPoints.reduce((best,q)=>dist(p,q)<dist(p,best)?q:best,creekPoints[0])}
function fleeFrom(a,threat,amount){const dx=a.position.x-threat.x,dy=a.position.y-threat.y,m=Math.hypot(dx,dy)||1;return bound({x:a.position.x+dx/m*amount,y:a.position.y+dy/m*amount})}
function jitter(w,a,p,scale=3){const ax=unit(w,`${a.id}:jx`)*2-1,ay=unit(w,`${a.id}:jy`)*2-1;return bound({x:p.x+ax*scale,y:p.y+ay*scale})}
function moveToward(from,goal,maxStep){const dx=goal.x-from.x,dy=goal.y-from.y,d=Math.hypot(dx,dy);if(!d||d<=maxStep)return bound(goal);return bound({x:from.x+dx/d*maxStep,y:from.y+dy/d*maxStep})}
function worldStamp(w){return w.day*24+w.hour}
function ecoEvent(w,{kind,title,detail,animal=null,agent=null,importance=4,cooldown=5,key=null}){const e=w.ecologySystem,stamp=worldStamp(w),coolKey=key||`${kind}:${animal?.id||''}:${agent?.id||''}`;if((e.eventCooldowns[coolKey]??-999)+cooldown>stamp)return null;e.eventCooldowns[coolKey]=stamp;const out={id:`ECO-${w.day}-${String(w.hour).padStart(2,'0')}-${String(e.events.length+1).padStart(3,'0')}`,day:w.day,hour:w.hour,kind,title,detail,importance,animalId:animal?.id||null,species:animal?.species||null,agentId:agent?.id||null};e.events.unshift(out);e.events=e.events.slice(0,60);return out}
function heading(from,to){return Math.atan2(to.y-from.y,to.x-from.x)}
function addTrace(w,a,from,to){const s=SPECIES[a.species];if(!s?.traceChance||a.species==='fish'||dist(from,to)<.65)return;if(unit(w,`${a.id}:trace:${a.history.length}`)>s.traceChance)return;const e=w.ecologySystem,m={x:from.x+(to.x-from.x)*.58,y:from.y+(to.y-from.y)*.58},id=`TRACE-${a.id}-${w.day}-${String(w.hour).padStart(2,'0')}`;if(e.traces.some(x=>x.id===id))return;e.traces.unshift({id,sourceId:a.id,species:a.species,label:`${a.species} tracks`,position:bound(m),heading:heading(from,to),clarity:a.activity==='flee'?.92:.78,size:s.traceSize,ageHours:0,created:{day:w.day,hour:w.hour},active:true});e.traces=e.traces.slice(0,32)}
function ageTraces(w){const rain=w.weather==='rain';for(const t of w.ecologySystem.traces){t.ageHours=(t.ageHours||0)+1;t.clarity=clamp((t.clarity??.8)-(rain?.17:.045),0,1);if(t.ageHours>20||t.clarity<.12)t.active=false}w.ecologySystem.traces=w.ecologySystem.traces.filter(x=>x.active).slice(0,32)}
function updateNeeds(a){a.needs.hunger=clamp(a.needs.hunger-2.2);a.needs.thirst=clamp(a.needs.thirst-1.7);a.needs.energy=clamp(a.needs.energy-(a.activity==='flee'?5:a.activity==='move'?2.3:.8));if(a.activity==='rest')a.needs.energy=clamp(a.needs.energy+5)}
function decideAnimal(w,a){
 const s=SPECIES[a.species]||SPECIES.deer,near=nearestAgent(w,a);a.fear=clamp(a.fear-(a.species==='bear'?8:12));
 if(a.species==='fish'){const t=creekTarget(w,a);a.activity='swim';a.behavior='schooling';return jitter(w,a,t,1.8)}
 if(near&&near.distance<s.panicRadius){a.fear=100;a.activity='flee';a.behavior=a.species==='bear'?'defensive retreat':'startled';ecoEvent(w,{kind:a.species==='bear'?'bear-encounter':'wildlife-flight',title:a.species==='bear'?`${a.label} retreats from ${near.agent.name}`:`${a.label} bolts from ${near.agent.name}`,detail:`${a.label} reacted at ${near.distance.toFixed(1)} world units and moved away.`,animal:a,agent:near.agent,importance:a.species==='bear'?10:7,cooldown:a.species==='bear'?8:4});return fleeFrom(a,near.position,a.species==='rabbit'?13:10)}
 if(near&&near.distance<s.fearRadius){a.fear=Math.max(a.fear,a.species==='bear'?45:72);a.activity='move';a.behavior='wary';ecoEvent(w,{kind:'wildlife-alert',title:`${a.label} notices ${near.agent.name}`,detail:`${a.label} became wary at ${near.distance.toFixed(1)} world units.`,animal:a,agent:near.agent,importance:a.species==='bear'?8:5,cooldown:6});return fleeFrom(a,near.position,a.species==='rabbit'?8:6)}
 if(a.needs.thirst<46){const water=nearestCreek(a.position);if(dist(a.position,water)<2.8){a.activity='drink';a.behavior='drinking';a.needs.thirst=clamp(a.needs.thirst+28);ecoEvent(w,{kind:'wildlife-drink',title:`${a.label} drinks at the creek`,detail:`${a.label} stopped at the water to drink.`,animal:a,importance:3,cooldown:12});return jitter(w,a,a.position,.8)}a.activity='move';a.behavior='seeking water';return jitter(w,a,water,1.2)}
 const r=unit(w,`${a.id}:behavior`);
 if(r<.16||a.needs.energy<34){a.activity='rest';a.behavior='resting';a.needs.energy=clamp(a.needs.energy+9);return jitter(w,a,a.position,a.species==='rabbit'?1:2)}
 if(r<.64){a.activity=a.species==='bear'?'forage':'graze';a.behavior=a.species==='bear'?'foraging':'feeding';a.needs.hunger=clamp(a.needs.hunger+7);return jitter(w,a,chooseHabitat(w,a),a.species==='rabbit'?4:6)}
 a.activity='move';a.behavior='roaming';return jitter(w,a,chooseHabitat(w,a),a.species==='bear'?9:6)
}
function updateAmbient(w){const daylight=w.hour>=6&&w.hour<20?1:0,wet=w.weather==='rain'?1:0,twilight=(w.hour>=5&&w.hour<=8)||(w.hour>=18&&w.hour<=21);w.ecologySystem.ambient={birds:Math.round(clamp((daylight?55:12)+(twilight?28:0)-(wet?22:0)+unit(w,'birds')*18)),frogs:Math.round(clamp((!daylight?58:22)+(wet?26:0)+unit(w,'frogs')*14)),insects:Math.round(clamp((w.temperature-42)*1.9+(daylight?18:6)-(wet?8:0))),fishActivity:Math.round(clamp(42+(twilight?28:0)+(wet?14:0)+unit(w,'fish')*18)),seed:hash(`${w.day}:${w.hour}:${w.weather}`)}}
export function advanceEcology(w){ensureEcology(w);ageTraces(w);for(const a of w.ecologySystem.wildlife){if(!a.active)continue;updateNeeds(a);const prevBehavior=a.behavior,from={...a.position},goal=decideAnimal(w,a),base=SPECIES[a.species]?.step||3;let mult=1;if(a.activity==='flee')mult=1.7;else if(a.activity==='rest'||a.activity==='drink')mult=.28;else if(a.activity==='graze'||a.activity==='forage')mult=.65;const to=moveToward(from,goal,base*mult);a.previousPosition=from;a.target=goal;a.position=to;a.movement={from,to,goal,worldDay:w.day,worldHour:w.hour,speed:base*mult};addTrace(w,a,from,to);a.history.push({day:w.day,hour:w.hour,activity:a.activity,behavior:a.behavior,from,to,goal});if(a.history.length>36)a.history=a.history.slice(-36);if(prevBehavior!==a.behavior&&['feeding','foraging','resting'].includes(a.behavior)&&unit(w,`${a.id}:quiet-event`)<.18)ecoEvent(w,{kind:'wildlife-routine',title:`${a.label} is ${a.behavior}`,detail:`A routine wildlife behavior emerged from its needs and habitat.`,animal:a,importance:2,cooldown:12});a.ai.mode=(w.settings.ai.wildlife.individuals?.[a.id]??w.settings.ai.wildlife.enabled)?'eligible-ai':'simulation'}updateAmbient(w);w.ecologySystem.lastAdvanced={day:w.day,hour:w.hour};return w.ecologySystem}
export function visibleWildlifeForAgent(w,agent,radius=18){ensureEcology(w);const c=agent.coordinates;if(!c)return[];return w.ecologySystem.wildlife.filter(x=>x.active&&dist(c,x.position)<=radius).map(x=>({id:x.id,species:x.species,label:x.label,distance:Math.round(dist(c,x.position)*10)/10,behavior:x.behavior,activity:x.activity,fear:Math.round(x.fear)})).sort((a,b)=>a.distance-b.distance)}
export function visibleWildlifeTracesForAgent(w,agent,radius=12){ensureEcology(w);const c=agent.coordinates;if(!c)return[];return w.ecologySystem.traces.filter(x=>x.active&&dist(c,x.position)<=radius).map(x=>({id:x.id,sourceId:x.sourceId,species:x.species,label:x.label,distance:Math.round(dist(c,x.position)*10)/10,clarity:Math.round((x.clarity||0)*100)/100,heading:x.heading,ageHours:x.ageHours})).sort((a,b)=>a.distance-b.distance)}
export function wildlifeAIEnabled(w,id=null){ensureEcology(w);if(id&&w.settings.ai.wildlife.individuals?.[id]!=null)return !!w.settings.ai.wildlife.individuals[id];return !!w.settings.ai.wildlife.enabled}
