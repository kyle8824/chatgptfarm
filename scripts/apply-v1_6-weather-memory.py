from pathlib import Path


def replace_once(text, old, new, label):
    count=text.count(old)
    if count!=1:
        raise SystemExit(f'{label}: expected exactly one anchor, found {count}')
    return text.replace(old,new,1)

# --- core canonical weather memory -------------------------------------------------
core_path=Path('engine/core.js')
core=core_path.read_text()
if 'advanceWeatherMemory' not in core:
    core=replace_once(core,
        "resources:{berries:18,dryWood:12,wetWood:6,stones:24,clay:10,reeds:14,creekWater:true},structures:",
        "resources:{berries:18,dryWood:12,wetWood:6,stones:24,clay:10,reeds:14,creekWater:true},environmentState:{surfaceWetness:.32,creekLevel:.42,lastRainAt:null,hoursSinceRain:null},structures:",
        'origin environment state')
    resources_anchor="w.resources||={};Object.assign(w.resources,{berries:w.resources.berries??18,dryWood:w.resources.dryWood??12,wetWood:w.resources.wetWood??6,stones:w.resources.stones??24,clay:w.resources.clay??10,reeds:w.resources.reeds??14,creekWater:w.resources.creekWater??true});"
    core=replace_once(core,resources_anchor,resources_anchor+"\n w.environmentState||={};Object.assign(w.environmentState,{surfaceWetness:w.environmentState.surfaceWetness??(w.weather==='rain'?.82:.32),creekLevel:w.environmentState.creekLevel??(w.weather==='rain'?.58:.42),lastRainAt:w.environmentState.lastRainAt??null,hoursSinceRain:w.environmentState.hoursSinceRain??null});",'migrate environment state')
    regrow_anchor='function regrow(w){'
    weather_fn="""export function advanceWeatherMemory(w){
 w.environmentState||={surfaceWetness:.32,creekLevel:.42,lastRainAt:null,hoursSinceRain:null};const e=w.environmentState;
 if(w.weather==='rain'){e.surfaceWetness=clamp((Number(e.surfaceWetness)||.32)+.22,0,1);e.creekLevel=clamp((Number(e.creekLevel)||.42)+.075,.34,.92);e.lastRainAt={day:w.day,hour:w.hour};e.hoursSinceRain=0}
 else{const daylight=w.hour>=8&&w.hour<=18,dry=w.weather==='clear'?(daylight?.055:.032):.018;e.surfaceWetness=clamp((Number(e.surfaceWetness)||.32)-dry,.16,1);const k=w.weather==='clear'?.11:.065;e.creekLevel=clamp((Number(e.creekLevel)||.42)+(0.42-(Number(e.creekLevel)||.42))*k,.34,.92);if(e.lastRainAt)e.hoursSinceRain=Math.max(0,(w.day-e.lastRainAt.day)*24+(w.hour-e.lastRainAt.hour))}
 e.surfaceWetness=Math.round(e.surfaceWetness*1000)/1000;e.creekLevel=Math.round(e.creekLevel*1000)/1000;if(w.worldModel)updateEnvironmentalModel(w);return e
}
"""
    core=replace_once(core,regrow_anchor,weather_fn+regrow_anchor,'weather memory function')
    core=replace_once(core,"updateWeather(w);syncLegacyIntoWorldModel(w)}","updateWeather(w);advanceWeatherMemory(w);syncLegacyIntoWorldModel(w)}",'hourly weather memory')
    core_path.write_text(core)
else:
    print('core weather memory already present')

# --- world fields derive from remembered wetness -----------------------------------
world_path=Path('engine/world-model.js')
world=world_path.read_text()
world=world.replace("export const WORLD_MODEL_VERSION='object-field-0.9';","export const WORLD_MODEL_VERSION='object-field-1.0';")
start=world.index('export function updateEnvironmentalModel(w){')
end=world.index('\n\nfunction spawnComponent',start)
new_env="""export function updateEnvironmentalModel(w){
 if(!w.worldModel)return;
 const rain=w.weather==='rain',cloud=w.weather==='cloudy',wet=Math.max(.12,Math.min(1,Number(w.environmentState?.surfaceWetness??(rain?.82:.32)))),level=Math.max(.2,Math.min(1,Number(w.environmentState?.creekLevel??(rain?.58:.42))));
 const humidity=Math.min(.97,rain?.94:cloud?Math.max(.7,.63+wet*.16):.46+wet*.18);
 const daylight=Math.max(0,Math.sin(((w.hour-6)/24)*Math.PI*2)),zone=(base,span)=>Math.round(Math.min(1,base+wet*span)*100)/100;
 const f=w.worldModel.fields;
 f.temperature={type:'scalar',unit:'F',global:w.temperature};
 f.precipitation={type:'scalar',unit:'relative',global:rain?.78:0,kind:rain?'rain':'none'};
 f.humidity={type:'scalar',unit:'relative',global:Math.round(humidity*100)/100};
 f.light={type:'scalar',unit:'relative',global:Math.round(daylight*100)/100};
 f.soilMoisture={type:'zonal',unit:'relative',zones:{camp:zone(.16,.67),meadow:zone(.14,.69),forest:zone(.31,.58),creek:zone(.72,.27),clay:zone(.76,.22),reeds:zone(.82,.17),berries:zone(.2,.64),stones:zone(.08,.43),log:zone(.18,.58),edge:zone(.18,.62)}};
 f.waterDepth={type:'object',unit:'m',objects:{'OBJ-CREEK-001':Math.round((.31+level*.32)*100)/100}};
 f.surfaceWetness={type:'scalar',unit:'relative',global:Math.round(wet*100)/100,lastRainAt:w.environmentState?.lastRainAt||null,hoursSinceRain:w.environmentState?.hoursSinceRain??null};
 f.wind={type:'scalar',unit:'m/s',global:cloud?2.4:rain?3.1:1.5};
 for(const o of w.worldModel.objects){if(!o.state?.active)continue;const exposed=o.parentId===null||o.state.exposed;if(o.physical?.wood&&exposed){o.material||={};let m=Number(o.material.moisturePct??28);m+=rain?4:cloud?.2:-1.8;o.material.moisturePct=Math.max(8,Math.min(80,Math.round(m*10)/10))}if(o.physical?.weatherSensitive&&rain&&o.state.clarity!=null)o.state.clarity=Math.max(.1,Math.round((o.state.clarity-.08)*100)/100)}
}"""
world=world[:start]+new_env+world[end:]
world_path.write_text(world)

# --- ecology uses canonical wetness ------------------------------------------------
eco_path=Path('engine/ecology.js')
eco=eco_path.read_text().replace("export const ECOLOGY_VERSION='living-basin-1.3.0';","export const ECOLOGY_VERSION='living-basin-1.4.0';")
if 'function surfaceWetness' not in eco:
    eco=replace_once(eco,"function worldStamp(w){return w.day*24+w.hour}","function worldStamp(w){return w.day*24+w.hour}\nfunction surfaceWetness(w){return clamp(Number(w.environmentState?.surfaceWetness??(w.weather==='rain'?.82:.32)),.08,1)}",'ecology wetness helper')
    old="function traceSuitability(w,p){const d=dist(p,nearestCreek(p));let s=d<2.5?.95:d<5?.68:d<9?.35:.12;if(w.weather==='rain')s*=d<7?1.22:.7;return clamp(s,.05,1)}"
    new="function traceSuitability(w,p){const d=dist(p,nearestCreek(p)),wet=surfaceWetness(w);let s=d<2.5?.9:d<5?.64:d<9?.34:.11;s*=.68+wet*.7;if(w.weather==='rain')s*=d<7?1.08:.72;return clamp(s,.04,1)}"
    eco=replace_once(eco,old,new,'wet trace suitability')
    old="const creekD=dist(m,nearestCreek(m)),substrate=creekD<4?'mud':creekD<8?'soft-ground':'forest-floor';"
    new="const creekD=dist(m,nearestCreek(m)),wet=surfaceWetness(w),substrate=creekD<4||(wet>.72&&creekD<9)?'mud':creekD<8||wet>.52?'soft-ground':'forest-floor';"
    eco=replace_once(eco,old,new,'wet substrate classification')
    old="function ageTraces(w){const rain=w.weather==='rain';for(const t of w.ecologySystem.traces){t.ageHours=(t.ageHours||0)+1;const decay=rain?.15:t.substrate==='mud'?.026:t.substrate==='soft-ground'?.042:.065;t.clarity=clamp((t.clarity??.7)-decay,0,1);if(t.ageHours>18||t.clarity<.18)t.active=false}w.ecologySystem.traces=w.ecologySystem.traces.filter(x=>x.active).slice(0,24)}"
    new="function ageTraces(w){const rain=w.weather==='rain',wet=surfaceWetness(w);for(const t of w.ecologySystem.traces){t.ageHours=(t.ageHours||0)+1;const decay=rain?.15:t.substrate==='mud'?(wet>.58?.021:.034):t.substrate==='soft-ground'?(wet>.48?.034:.05):.066;t.clarity=clamp((t.clarity??.7)-decay,0,1);if(t.ageHours>18||t.clarity<.18)t.active=false}w.ecologySystem.traces=w.ecologySystem.traces.filter(x=>x.active).slice(0,24)}"
    eco=replace_once(eco,old,new,'wet trace aging')
eco_path.write_text(eco)

# --- bounded local ground perception -----------------------------------------------
decision_path=Path('engine/decision.js')
decision=decision_path.read_text()
if 'localGroundCondition' not in decision:
    anchor='export function retrieveDecisionContext(w,a,{excludedMemoryId=null}={}){'
    helper="function localGroundCondition(w,a){const v=Number(w.worldModel?.fields?.soilMoisture?.zones?.[a.position]);if(!Number.isFinite(v))return null;return{band:v>=.78?'saturated':v>=.57?'wet':v>=.37?'damp':'dry'}}\n"
    decision=replace_once(decision,anchor,helper+anchor,'local ground helper')
    decision=replace_once(decision,"localResources:resourcePerceptionView(w,a),wildlife:","localResources:resourcePerceptionView(w,a),groundCondition:localGroundCondition(w,a),wildlife:",'local ground perception')
    decision_path.write_text(decision)

# --- renderer ----------------------------------------------------------------------
render_path=Path('phaser-world-v1.js')
render=render_path.read_text()
if 'renderWeatherMemory' not in render:
    render=replace_once(render,"this.resourceVisuals=[];this.decisionCue", "this.resourceVisuals=[];this.weatherMemoryVisuals=[];this.decisionCue",'weather visual scene state')
    render=replace_once(render,"this.spawnAmbientLife();this.renderLightCycle();this.renderWeather();","this.spawnAmbientLife();this.renderLightCycle();this.renderWeatherMemory();this.renderWeather();",'initial weather memory render')
    render=replace_once(render,"this.updateDecisionCue(false);this.renderLightCycle(true);this.renderWeather(true);this.refreshAmbient()","this.updateDecisionCue(false);this.renderLightCycle(true);this.renderWeatherMemory(true);this.renderWeather(true);this.refreshAmbient()",'dynamic weather memory render')
    anchor=' renderWeather(refresh=false){'
    method=r''' renderWeatherMemory(refresh=false){
  for(const v of this.weatherMemoryVisuals){this.tweens.killTweensOf(v);v.destroy()}this.weatherMemoryVisuals=[];
  const keep=v=>{this.weatherMemoryVisuals.push(v);return v},env=canonical?.environmentState||{},wet=clamp(Number(env.surfaceWetness??(canonical?.weather==='rain'?.82:.32)),0,1),level=clamp(Number(env.creekLevel??.42),0,1),R=seeded('weather-memory-basin-v1');
  if(this.riverCurve){const pts=this.riverCurve.getSpacedPoints(150),bank=keep(this.add.graphics().setDepth(6)),water=keep(this.add.graphics().setDepth(7));bank.lineStyle(66+wet*42,0x443f35,.022+wet*.095);bank.strokePoints(pts,false,false);water.lineStyle(28+level*22,0x79adba,.035+level*.12);water.strokePoints(pts,false,false)}
  if(wet>.42){const amount=Math.round((wet-.38)*32);for(let i=0;i<amount;i++){const p={x:4+R()*92,y:4+R()*92},t=terrainTypeAt(p);if(t!==TERRAIN.MEADOW&&t!==TERRAIN.WETLAND)continue;if(t===TERRAIN.MEADOW&&creekDistance(p)>22&&wet<.72)continue;const q=worldToPx(p),alpha=.012+wet*.035;keep(this.add.ellipse(q.x,q.y,34+R()*100,12+R()*34,t===TERRAIN.WETLAND?0x344e45:0x485849,alpha).setDepth(16))}}
  if(wet>.7){for(let i=0;i<10;i++){const p={x:8+R()*84,y:17+R()*34};if(terrainTypeAt(p)!==TERRAIN.MEADOW||creekDistance(p)<5)continue;const q=worldToPx(p),puddle=keep(this.add.ellipse(q.x,q.y,12+R()*26,4+R()*9,0x6e9494,.035+(wet-.7)*.12).setDepth(19));puddle.setStrokeStyle(1,0xa4b9ad,.025+wet*.04)}}
  this.weatherMemoryState={surfaceWetness:+wet.toFixed(3),creekLevel:+level.toFixed(3),lastRainAt:env.lastRainAt||null,hoursSinceRain:env.hoursSinceRain??null,visuals:this.weatherMemoryVisuals.length};
 }
'''
    render=replace_once(render,anchor,method+anchor,'weather memory renderer')
    render=render.replace("version:'phaser-v1.5-living-history'","version:'phaser-v1.6-weather-memory'")
    render=replace_once(render,"lightCycle:this.lightCycle||null,livingWorld:","lightCycle:this.lightCycle||null,weatherMemory:this.weatherMemoryState||null,livingWorld:",'weather snapshot')
    render_path.write_text(render)

# --- engine export -----------------------------------------------------------------
engine_path=Path('engine.js')
engine=engine_path.read_text()
engine=engine.replace("createWorld,migrateWorld,addEvent,remember,recordDiscovery,learnSkill","createWorld,migrateWorld,addEvent,remember,recordDiscovery,learnSkill,advanceWeatherMemory")
engine_path.write_text(engine)

# --- ecology + weather memory QA ----------------------------------------------------
eqa_path=Path('scripts/ecology-realism-qa.mjs')
eqa=eqa_path.read_text()
if "advanceWeatherMemory" not in eqa:
    eqa=eqa.replace("import { ensureEcology, advanceEcology } from '../engine/ecology.js';","import { ensureEcology, advanceEcology } from '../engine/ecology.js';\nimport { advanceWeatherMemory } from '../engine/core.js';")
    anchor='const failures=[];'
    probe="""const hydro={day:3,hour:10,weather:'rain',environmentState:{surfaceWetness:.3,creekLevel:.42,lastRainAt:null,hoursSinceRain:null}};
advanceWeatherMemory(hydro);const rainWet=hydro.environmentState.surfaceWetness,rainLevel=hydro.environmentState.creekLevel;hydro.hour=11;hydro.weather='clear';advanceWeatherMemory(hydro);const afterClear=hydro.environmentState.surfaceWetness,afterLevel=hydro.environmentState.creekLevel;
"""
    eqa=replace_once(eqa,anchor,probe+anchor,'hydrology QA probe')
    checks="""if(rainWet<=.3)failures.push(`rain failed to raise canonical surface wetness: ${rainWet}`);
if(rainLevel<=.42)failures.push(`rain failed to raise canonical creek level: ${rainLevel}`);
if(!(afterClear<rainWet&&afterClear>.3))failures.push(`rain aftermath did not persist while drying: rain=${rainWet} clear=${afterClear}`);
if(!(afterLevel<rainLevel&&afterLevel>.42))failures.push(`creek level did not recede gradually after rain: rain=${rainLevel} clear=${afterLevel}`);
"""
    eqa=replace_once(eqa,"if(stats.rabbitMaxHome>18)",checks+"if(stats.rabbitMaxHome>18)",'hydrology QA assertions')
    eqa_path.write_text(eqa)

# --- living history QA: local ground only ------------------------------------------
lqa_path=Path('scripts/living-history-qa.mjs')
lqa=lqa_path.read_text()
if 'groundCondition' not in lqa.split('const routeWorld=')[0]:
    lqa=lqa.replace("import { candidateActions } from '../engine/decision.js';","import { candidateActions, retrieveDecisionContext } from '../engine/decision.js';\nimport { advanceWeatherMemory } from '../engine/core.js';")
    anchor="const routeWorld=createWorld()"
    test="""const weatherWorld=createWorld(),weatherMara=weatherWorld.agents.find(a=>a.id==='agent-mara');weatherMara.position='meadow';weatherWorld.weather='rain';weatherWorld.environmentState.surfaceWetness=.62;advanceWeatherMemory(weatherWorld);const weatherContext=retrieveDecisionContext(weatherWorld,weatherMara);if(!['wet','saturated'].includes(weatherContext.perception.groundCondition?.band))failures.push(`local rain aftermath missing from bounded ground perception: ${JSON.stringify(weatherContext.perception.groundCondition)}`);if('value' in (weatherContext.perception.groundCondition||{})||'moisture' in (weatherContext.perception.groundCondition||{}))failures.push('ground perception exposed exact environmental telemetry');

"""
    lqa=replace_once(lqa,anchor,test+anchor,'bounded ground QA')
    lqa_path.write_text(lqa)

# --- browser QA --------------------------------------------------------------------
bqa_path=Path('scripts/phaser-qa.mjs')
bqa=bqa_path.read_text()
bqa=bqa.replace("s.version!=='phaser-v1.5-living-history'","s.version!=='phaser-v1.6-weather-memory'")
if 'weather memory projection drift' not in bqa:
    anchor="if(!s.lightCycle||s.lightCycle.hour!==state.hour)failures.push(`light cycle state missing or stale: ${JSON.stringify(s.lightCycle)}`);"
    extra=anchor+"const wetExpected=+(state.environmentState?.surfaceWetness??.32).toFixed(3),levelExpected=+(state.environmentState?.creekLevel??.42).toFixed(3);if(s.weatherMemory?.surfaceWetness!==wetExpected||s.weatherMemory?.creekLevel!==levelExpected)failures.push(`weather memory projection drift: ${JSON.stringify(s.weatherMemory)} expected wet=${wetExpected} level=${levelExpected}`);"
    bqa=replace_once(bqa,anchor,extra,'weather browser assertion')
    anchor="await page.evaluate(()=>window.ChatGPTFarmPhaserDebug.focusWorldUnit(50,19,.92));await page.waitForTimeout(300);await page.screenshot({path:'phaser-qa/mobile-creek.png'});"
    proof=anchor+"state.environmentState={surfaceWetness:.86,creekLevel:.73,lastRainAt:{day:state.day,hour:Math.max(0,state.hour-2)},hoursSinceRain:2};state.weather='clear';state.meta.tickNumber++;await page.evaluate(()=>window.ChatGPTFarmPhaserDebug.reload());await page.waitForTimeout(650);const wetAfter=await snap();if(wetAfter.weatherMemory?.surfaceWetness<.8||wetAfter.weatherMemory?.visuals<3)failures.push(`wet aftermath did not render from canonical weather memory: ${JSON.stringify(wetAfter.weatherMemory)}`);await page.evaluate(()=>window.ChatGPTFarmPhaserDebug.focusWorldUnit(50,19,.92));await page.waitForTimeout(200);await page.screenshot({path:'phaser-qa/mobile-after-rain.png'});state.environmentState={surfaceWetness:.24,creekLevel:.43,lastRainAt:{day:Math.max(1,state.day-1),hour:state.hour},hoursSinceRain:24};state.meta.tickNumber++;await page.evaluate(()=>window.ChatGPTFarmPhaserDebug.reload());await page.waitForTimeout(650);const dryAfter=await snap();if(!(dryAfter.weatherMemory?.surfaceWetness<wetAfter.weatherMemory?.surfaceWetness&&dryAfter.weatherMemory?.visuals<wetAfter.weatherMemory?.visuals))failures.push(`weather-memory visuals did not recede as canonical ground dried: wet=${JSON.stringify(wetAfter.weatherMemory)} dry=${JSON.stringify(dryAfter.weatherMemory)}`);"
    bqa=replace_once(bqa,anchor,proof,'weather aftermath screenshot QA')
    bqa_path.write_text(bqa)

# cache bust
html_path=Path('phaser.html')
html=html_path.read_text().replace('v=001446544321','v=001600001')
html_path.write_text(html)

print('Applied v1.6 Weather Memory across simulation, ecology, bounded perception, renderer, and QA.')
