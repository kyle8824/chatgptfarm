export const WORLD_VERSION="0.2";
const clamp=(n,min=0,max=100)=>Math.max(min,Math.min(max,n));
const noise=(d,h,s=0)=>{const x=Math.sin((d*24+h+s)*12.9898)*43758.5453;return x-Math.floor(x)};
const pairKey=(a,b)=>[a,b].sort().join("|");
const hasTag=(m,t)=>m.tags?.includes(t);

function makeAgent(id,name,position,needs,traits){return{id,name,position,needs,inventory:{berries:0,dryWood:0,wetWood:0,stones:0},memories:[],beliefs:{},traits,currentAction:"Waking up"}}

export function createWorld(){return{version:WORLD_VERSION,day:1,hour:6,temperature:49,weather:"clear",resources:{berries:18,dryWood:12,wetWood:6,stones:20,creekWater:true},structures:{shelter:false,fire:false,cache:false},discovered:{creek:true,berries:true,fallenLog:true,stoneField:true,east:false,west:false},agents:[makeAgent("agent-mara","Mara","meadow",{hydration:66,hunger:72,energy:82,warmth:62},{curiosity:.72,cooperation:.68,caution:.56}),makeAgent("agent-ivo","Ivo","forest",{hydration:74,hunger:68,energy:78,warmth:58},{curiosity:.58,cooperation:.76,caution:.48})],relationships:{[pairKey("agent-mara","agent-ivo")]:{trust:34,familiarity:12,affinity:50,lastInteraction:null,sharedMemories:0}},history:[],dna:[],seq:{event:1,memory:1,decision:1},meta:{canonical:true,lastAdvancedAt:null,tickNumber:0}}}

export function migrateWorld(w){
  if(!w.agents){
    const old=w.agent||makeAgent("agent-mara","Mara","meadow",{hydration:66,hunger:72,energy:82,warmth:62},{curiosity:.72,cooperation:.68,caution:.56});
    old.traits ||= {curiosity:.72,cooperation:.68,caution:.56};
    const ivo=makeAgent("agent-ivo","Ivo","forest",{hydration:74,hunger:68,energy:78,warmth:58},{curiosity:.58,cooperation:.76,caution:.48});
    w.agents=[old,ivo]; delete w.agent;
  }
  w.version=WORLD_VERSION;
  w.relationships ||= {[pairKey("agent-mara","agent-ivo")]:{trust:34,familiarity:12,affinity:50,lastInteraction:null,sharedMemories:0}};
  w.resources ||= {berries:18,dryWood:12,wetWood:6,stones:20,creekWater:true};
  w.structures ||= {shelter:false,fire:false,cache:false};
  if(w.structures.cache===undefined)w.structures.cache=false;
  w.discovered ||= {creek:true,berries:true,fallenLog:true,stoneField:true,east:false,west:false};
  w.history ||= []; w.dna ||= []; w.seq ||= {event:1,memory:1,decision:1};
  w.meta ||= {canonical:true,lastAdvancedAt:null,tickNumber:0};
  for(const a of w.agents){a.traits||={curiosity:.6,cooperation:.6,caution:.5};a.memories||=[];a.beliefs||={};a.inventory||={berries:0,dryWood:0,wetWood:0,stones:0}}
  return w;
}

export function addEvent(w,type,title,detail,meta={}){w.history.unshift({id:`E-${String(w.seq.event++).padStart(5,"0")}`,day:w.day,hour:w.hour,type,title,detail,...meta});w.history=w.history.slice(0,300)}

export function remember(w,a,text,{importance=5,tags=[],source=null,confidence=.75}={}){
  const hit=a.memories.find(m=>m.text===text);
  if(hit){hit.confidence=clamp(hit.confidence+.04,0,1);hit.lastSeen=`${w.day}:${w.hour}`;return hit}
  const m={id:`M-${a.id.endsWith("ivo")?"I":"M"}${String(w.seq.memory++).padStart(3,"0")}`,text,importance,tags,source:source||`experience:${w.day}-${w.hour}`,confidence,lastSeen:`${w.day}:${w.hour}`};
  a.memories.unshift(m);a.memories=a.memories.slice(0,60);addEvent(w,"learn",`${a.name} formed a memory`,text,{agentId:a.id,memoryId:m.id});return m;
}
const memoryBoost=(a,tag)=>a.memories.filter(m=>hasTag(m,tag)).reduce((s,m)=>s+m.importance*m.confidence,0);
const otherAgent=(w,a)=>w.agents.find(x=>x.id!==a.id);
const relationship=(w,a,b)=>w.relationships[pairKey(a.id,b.id)];

export function observe(w,a){const n=a.needs,b=otherAgent(w,a),rel=b?relationship(w,a,b):null;return{time:`Day ${w.day}, ${String(w.hour).padStart(2,"0")}:00`,weather:w.weather,temperature:w.temperature,nearby:[w.discovered.creek&&"creek with drinkable water",w.resources.berries>0&&`${w.resources.berries} berry portions`,w.resources.dryWood>0&&"dry branches",w.resources.wetWood>0&&"damp branches",w.discovered.stoneField&&"loose stones",w.structures.shelter&&"a crude shelter",w.structures.fire&&"a small fire",b&&b.position===a.position&&`${b.name} nearby`].filter(Boolean),needs:{...n},inventory:{...a.inventory},knownPeople:b?[{name:b.name,trust:rel?.trust??0,familiarity:rel?.familiarity??0,lastKnownPosition:b.position}]:[]}}

function candidateActions(w,a){
  const n=a.needs,r=w.resources,inv=a.inventory,s=w.structures,mb=t=>memoryBoost(a,t),c=[],b=otherAgent(w,a),rel=b?relationship(w,a,b):null;
  if(r.creekWater)c.push({id:"drink",label:"Drink from the creek",score:(100-n.hydration)*1.45+mb("water")*.8,reasons:[["thirst",100-n.hydration],["memory: water",mb("water")]]});
  if(r.berries>0)c.push({id:"eat_berries",label:"Eat wild berries",score:(100-n.hunger)*1.2+mb("berries")*.65,reasons:[["hunger",100-n.hunger],["memory: berries",mb("berries")]]});
  if(r.berries>0&&inv.berries<5)c.push({id:"gather_berries",label:"Gather berries",score:16+(100-n.hunger)*.22+mb("store-food")*.7,reasons:[["future hunger",(100-n.hunger)*.22],["memory: store food",mb("store-food")]]});
  if(r.dryWood>0)c.push({id:"gather_dry_wood",label:"Gather dry branches",score:13+(100-n.warmth)*.26+mb("dry-wood")*.8+(!s.shelter?6:0),reasons:[["cold",(100-n.warmth)*.26],["memory: dry wood",mb("dry-wood")],["no shelter",!s.shelter?6:0]]});
  if(r.wetWood>0)c.push({id:"gather_wet_wood",label:"Gather damp branches",score:9+(100-n.warmth)*.18-mb("wet-wood-bad")*1.8,reasons:[["cold",(100-n.warmth)*.18],["memory: wet wood",-mb("wet-wood-bad")*1.8]]});
  if(inv.dryWood>=2&&!s.fire)c.push({id:"make_fire",label:"Try to make a fire",score:21+(100-n.warmth)*.8+mb("fire")*.75,reasons:[["cold",(100-n.warmth)*.8],["memory: fire",mb("fire")]]});
  if(inv.wetWood>=2&&!s.fire)c.push({id:"make_fire_wet",label:"Try a fire with damp wood",score:15+(100-n.warmth)*.65-mb("wet-wood-bad")*1.5,reasons:[["cold",(100-n.warmth)*.65],["memory: wet wood",-mb("wet-wood-bad")*1.5]]});
  if(inv.dryWood>=4&&!s.shelter)c.push({id:"build_shelter",label:"Build a crude shelter",score:19+(100-n.warmth)*.38+mb("shelter")*.7,reasons:[["exposure",(100-n.warmth)*.38],["memory: shelter",mb("shelter")]]});
  if(inv.berries>=3&&!s.cache)c.push({id:"make_cache",label:"Make a food cache",score:10+mb("store-food")*.9+(100-n.hunger)*.16,reasons:[["stored food",inv.berries*2],["memory: store food",mb("store-food")]]});
  if(n.energy<48)c.push({id:"rest",label:s.shelter?"Rest in the shelter":"Rest in the meadow",score:(100-n.energy)*1.1+mb("rest")*.4,reasons:[["fatigue",100-n.energy],["memory: rest",mb("rest")]]});
  c.push({id:"explore",label:"Explore beyond the known basin",score:8+a.traits.curiosity*13+mb("exploration")*.22-(100-n.energy)*.16,reasons:[["curiosity",a.traits.curiosity*13],["memory: exploration",mb("exploration")*.22],["fatigue penalty",-(100-n.energy)*.16]]});
  if(b){
    const same=b.position===a.position;
    c.push({id:same?"talk":"seek_other",label:same?`Talk with ${b.name}`:`Look for ${b.name}`,score:(same?9:4)+a.traits.cooperation*8+(rel?.familiarity||0)*.06+mb("social")*.28,reasons:[["cooperation",a.traits.cooperation*8],["familiarity",(rel?.familiarity||0)*.06],["social memory",mb("social")*.28]]});
    if(same&&inv.berries>=2&&b.needs.hunger<50)c.push({id:"share_food",label:`Share berries with ${b.name}`,score:9+a.traits.cooperation*12+(50-b.needs.hunger)*.45+(rel?.trust||0)*.08,reasons:[["cooperation",a.traits.cooperation*12],[`${b.name} hunger`,(50-b.needs.hunger)*.45],["trust",(rel?.trust||0)*.08]]});
  }
  return c.map(x=>({...x,score:+x.score.toFixed(3)}));
}

export function chooseAction(w,a,excludedMemoryId=null){let removed=null;if(excludedMemoryId){const i=a.memories.findIndex(m=>m.id===excludedMemoryId);if(i>=0)removed=a.memories.splice(i,1)[0]}const candidates=candidateActions(w,a).sort((x,y)=>y.score-x.score||x.id.localeCompare(y.id));if(removed)a.memories.unshift(removed);return{winner:candidates[0],candidates}}

function createDNA(w,a,choice){const id=`D-${String(w.seq.decision++).padStart(5,"0")}`;const memories=[...a.memories].slice(0,10);const counterfactuals=memories.map(m=>{const replay=chooseAction(w,a,m.id);const sameCandidate=replay.candidates.find(x=>x.id===choice.winner.id);return{removed_memory:m.id,memory_text:m.text,original_action:choice.winner.id,counterfactual_action:replay.winner.id,action_changed:replay.winner.id!==choice.winner.id,score_delta:+(choice.winner.score-(sameCandidate?.score??0)).toFixed(3)}});const dna={protocol:"Decision DNA 0.2-farm",decision_id:id,day:w.day,hour:w.hour,agent_id:a.id,agent_name:a.name,observation:observe(w,a),action:choice.winner.id,action_label:choice.winner.label,winner_score:choice.winner.score,candidates:choice.candidates.slice(0,7),factors:choice.winner.reasons.filter(x=>Math.abs(x[1])>.01),memory_counterfactuals:counterfactuals};w.dna.unshift(dna);w.dna=w.dna.slice(0,220);return dna}

function shareKnowledge(w,speaker,listener){const candidate=speaker.memories.find(m=>m.importance>=6&&!listener.memories.some(x=>x.text===m.text));if(!candidate)return null;const copy=remember(w,listener,`${speaker.name} told me: ${candidate.text}`,{importance:Math.max(4,candidate.importance-1),tags:[...(candidate.tags||[]),"social"],source:`social:${speaker.id}:${candidate.id}`,confidence:Math.max(.55,candidate.confidence-.12)});relationship(w,speaker,listener).sharedMemories++;return copy}

function execute(w,a,action){
  const n=a.needs,r=w.resources,inv=a.inventory,s=w.structures,b=otherAgent(w,a),rel=b?relationship(w,a,b):null;let detail="";a.currentAction=action.label;
  switch(action.id){
    case"drink":n.hydration=clamp(n.hydration+35);a.position="creek";detail=`${a.name} drinks from the creek until the pressure of thirst eases.`;remember(w,a,"The creek provides reliable drinking water.",{importance:8,tags:["water"],confidence:.96});break;
    case"eat_berries":if(inv.berries>0)inv.berries--;else r.berries=Math.max(0,r.berries-1);n.hunger=clamp(n.hunger+28);a.position="berries";detail=`${a.name} eats tart red berries and hunger recedes.`;remember(w,a,"The red berries in the meadow are edible and reduce hunger.",{importance:7,tags:["berries","food"],confidence:.9});break;
    case"gather_berries":r.berries=Math.max(0,r.berries-2);inv.berries+=2;n.energy=clamp(n.energy-4);a.position="berries";detail=`${a.name} gathers two portions of berries for later.`;if(inv.berries>=4)remember(w,a,"Keeping berries in reserve could protect against later hunger.",{importance:6,tags:["store-food"],confidence:.78});break;
    case"gather_dry_wood":r.dryWood=Math.max(0,r.dryWood-2);inv.dryWood+=2;n.energy=clamp(n.energy-6);a.position="log";detail=`${a.name} breaks dry branches from the fallen tree and carries them back.`;remember(w,a,"Dry branches are light enough to carry and may be useful for heat or building.",{importance:5,tags:["dry-wood"],confidence:.72});break;
    case"gather_wet_wood":r.wetWood=Math.max(0,r.wetWood-2);inv.wetWood+=2;n.energy=clamp(n.energy-7);a.position="log";detail=`${a.name} collects damp branches from beneath the fallen log.`;break;
    case"make_fire":inv.dryWood-=2;s.fire=true;n.warmth=clamp(n.warmth+30);a.position="camp";detail=`${a.name} gets dry twigs to catch. A small fire begins to hold.`;remember(w,a,"Dry wood catches flame and provides strong warmth.",{importance:9,tags:["fire","dry-wood"],confidence:.94});break;
    case"make_fire_wet":inv.wetWood-=2;n.energy=clamp(n.energy-8);n.warmth=clamp(n.warmth-3);a.position="camp";detail=`${a.name} tries damp wood. It smokes, sputters, and the flame dies.`;remember(w,a,"Damp wood smokes and fails to sustain a fire; dry fuel works better.",{importance:10,tags:["wet-wood-bad","fire","dry-wood"],confidence:.98});break;
    case"build_shelter":inv.dryWood-=4;s.shelter=true;n.energy=clamp(n.energy-18);a.position="camp";detail=`${a.name} leans branches against a forked trunk and makes a crude windbreak.`;remember(w,a,"A branch shelter reduces exposure and gives a safer place to rest.",{importance:9,tags:["shelter","rest"],confidence:.91});break;
    case"make_cache":inv.berries-=3;s.cache=true;n.energy=clamp(n.energy-5);a.position="camp";detail=`${a.name} tucks gathered food into a shaded stone-lined cache near camp.`;remember(w,a,"A shaded cache can keep gathered food in one known place.",{importance:8,tags:["store-food","cache"],confidence:.9});break;
    case"rest":n.energy=clamp(n.energy+(s.shelter?30:21));n.warmth=clamp(n.warmth+(s.shelter?8:-3));a.position=s.shelter?"camp":"meadow";detail=s.shelter?`${a.name} rests beneath the crude roof, protected from wind.`:`${a.name} lies down in the grass. Rest helps, but exposure steals warmth.`;remember(w,a,s.shelter?"Rest is more effective inside the shelter.":"Rest restores energy, though exposed ground is cold.",{importance:5,tags:["rest"],confidence:.8});break;
    case"explore":n.energy=clamp(n.energy-12);a.position="edge";if(!w.discovered.east){w.discovered.east=true;detail=`${a.name} follows the creek east and finds clay-rich soil beyond the ridge.`;remember(w,a,"East of the meadow, the creek cuts through exposed clay-rich soil.",{importance:7,tags:["exploration","clay"],confidence:.9})}else if(!w.discovered.west){w.discovered.west=true;detail=`${a.name} scouts west and finds denser forest with signs of small animals.`;remember(w,a,"The western forest is denser and contains signs of small animals.",{importance:6,tags:["exploration","animals"],confidence:.85})}else{detail=`${a.name} traces the basin boundary and reinforces a mental map of the area.`;remember(w,a,"Repeated exploration makes the basin's boundaries more familiar.",{importance:3,tags:["exploration"],confidence:.7})}break;
    case"seek_other":if(b){a.position=b.position;n.energy=clamp(n.energy-6);detail=`${a.name} crosses the basin looking for ${b.name} and finds them near ${b.position}.`;remember(w,a,`I can deliberately seek ${b.name} when I need to exchange information or help.`,{importance:4,tags:["social"],confidence:.72});rel.familiarity=clamp(rel.familiarity+3);rel.lastInteraction=`${w.day}:${w.hour}`;}break;
    case"talk":if(b){const learned=shareKnowledge(w,a,b);rel.familiarity=clamp(rel.familiarity+7);rel.trust=clamp(rel.trust+2);rel.lastInteraction=`${w.day}:${w.hour}`;detail=learned?`${a.name} talks with ${b.name} and passes along something learned earlier.`:`${a.name} and ${b.name} compare what they have seen and what they need.`;remember(w,a,`Talking with ${b.name} helps coordinate what each of us knows.`,{importance:5,tags:["social"],confidence:.78});remember(w,b,`Talking with ${a.name} helps coordinate what each of us knows.`,{importance:5,tags:["social"],confidence:.78});}break;
    case"share_food":if(b&&inv.berries>=2){inv.berries-=2;b.inventory.berries+=2;rel.trust=clamp(rel.trust+7);rel.affinity=clamp(rel.affinity+4);rel.familiarity=clamp(rel.familiarity+4);rel.lastInteraction=`${w.day}:${w.hour}`;detail=`${a.name} gives ${b.name} two stored berry portions after noticing their hunger.`;remember(w,a,`Sharing food with ${b.name} improved cooperation between us.`,{importance:7,tags:["social","cooperation"],confidence:.88});remember(w,b,`${a.name} shared food with me when I was hungry.`,{importance:8,tags:["social","trust"],confidence:.92});}break;
  }
  addEvent(w,action.id==="talk"||action.id==="share_food"||action.id==="seek_other"?"social":"action",action.label,detail,{agentId:a.id,actionId:action.id});
}

function environmentTick(w,a){const n=a.needs;n.hydration=clamp(n.hydration-6.5);n.hunger=clamp(n.hunger-4.2);n.energy=clamp(n.energy-2.8);const cold=w.temperature<50?5:w.temperature<58?2:0;n.warmth=clamp(n.warmth-cold+(w.structures.fire?7:0)+(w.structures.shelter?2:0));if(n.hydration<18)remember(w,a,"Severe thirst makes every other task harder to sustain.",{importance:9,tags:["water","danger"],confidence:.95});if(n.hunger<16)remember(w,a,"Severe hunger quickly drains my ability to work.",{importance:9,tags:["food","danger"],confidence:.95})}
function updateWeather(w){const x=noise(w.day,w.hour,9);if(w.hour===5||w.hour===12||w.hour===18)w.weather=x>.72?"rain":x>.46?"cloudy":"clear";const daylight=Math.sin(((w.hour-6)/24)*Math.PI*2);w.temperature=Math.round(52+10*daylight-(w.weather==="rain"?7:w.weather==="cloudy"?3:0));if(w.weather==="rain")w.resources.wetWood=Math.min(10,w.resources.wetWood+1)}
function afterBothAct(w){const [a,b]=w.agents;if(a.position===b.position&&noise(w.day,w.hour,71)>.62){const rel=relationship(w,a,b);rel.familiarity=clamp(rel.familiarity+2);rel.affinity=clamp(rel.affinity+1);addEvent(w,"social","A quiet shared moment",`${a.name} and ${b.name} spend part of the hour near each other without a specific task. Familiarity grows a little.`,{agents:[a.id,b.id]})}if(w.structures.fire&&noise(w.day,w.hour,44)>.72){w.structures.fire=false;addEvent(w,"world","The fire fades","Without more fuel, the small fire burns down to ash.")}}

export function tick(world){const w=migrateWorld(world);updateWeather(w);const dnas=[];for(const a of w.agents){const choice=chooseAction(w,a);const dna=createDNA(w,a,choice);dnas.push(dna);execute(w,a,choice.winner);environmentTick(w,a)}afterBothAct(w);w.hour++;if(w.hour>=24){w.hour=0;w.day++;w.resources.berries=Math.min(22,w.resources.berries+3);w.resources.dryWood=Math.min(14,w.resources.dryWood+1)}updateWeather(w);return dnas}
