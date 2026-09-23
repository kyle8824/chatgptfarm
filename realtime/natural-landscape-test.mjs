import {buildingSites,validateBlueprint,adoptBlueprint} from './blueprints.mjs';
import assert from 'node:assert/strict';
import {createWorld} from '../engine/core.js';
import {prepare,step} from './elapsed.mjs';
import {expandFrontier} from './frontier.mjs';
import {reorganizeLandscape} from './landscape-migration.mjs';
import {naturalWorld,landHeight,originalGround,insideBounds,LAKES,cliffEdge} from '../shared/landscape.js';
import {householdWorld} from '../shared/frontier.js';
import {chooseDestination,liveWalkable,liveClear} from './motion.mjs';
import {waterBankPoints,withinWaterReach} from './water.mjs';
import {siteCandidates,resolveSiteAction} from '../engine/regions.js';
import {observeLandscape} from './frontier-knowledge.mjs';
import {liveCandidates} from './behavior.mjs';
import {clearHeight} from './climbing.mjs';
import {RealtimeController} from './world.mjs';
const w=prepare(createWorld());expandFrontier(w);const original=structuredClone(w),agents=structuredClone(w.agents),dry=w.wood.initialDryKg,wet=w.wood.initialWaterKg;
assert(!naturalWorld(w));assert(reorganizeLandscape(w));assert(naturalWorld(w));
for(const a of agents){const b=w.agents.find(b=>b.id===a.id);for(const k of ['id','inventory','memories','life','surname','householdId'])assert.deepEqual(b[k],a[k],k);if(a.householdId==='willow-basin')assert.deepEqual(b.coordinates,a.coordinates);else {const old=original.frontier.homes.find(h=>h.id===a.householdId),home=w.frontier.homes.find(h=>h.id===a.householdId);assert.equal(b.coordinates.x-a.coordinates.x,home.x-old.x);assert.equal(b.coordinates.y-a.coordinates.y,home.y-old.y);}}
assert.deepEqual(w.resources,original.resources);assert.deepEqual(w.settlement.projects,original.settlement.projects);assert.equal(w.day,original.day);assert.equal(w.hour,original.hour);
assert.deepEqual(w.wood.batches.slice(0,original.wood.batches.length),original.wood.batches);
const added=w.wood.batches.slice(original.wood.batches.length);assert.equal(w.wood.initialDryKg-dry,added.reduce((n,b)=>n+b.dryKg,0));assert(Math.abs(w.wood.initialWaterKg-wet-added.reduce((n,b)=>n+b.waterKg,0))<1e-7);
for(const p of [{x:64,y:34},{x:12,y:18},{x:39,y:49}])assert.equal(landHeight(p.x,p.y),originalGround(p.x,p.y));
const snapshot=JSON.stringify(w);assert.equal(reorganizeLandscape(w),false);assert.equal(JSON.stringify(w),snapshot);const loaded=prepare(JSON.parse(snapshot));assert(naturalWorld(loaded));assert(insideBounds(w,{x:-390,y:-390}));assert(!insideBounds(w,{x:110,y:20}));
assert(!liveWalkable(w,{x:LAKES[0].x,y:LAKES[0].z}));const banks=waterBankPoints(w,{x:LAKES[0].x+LAKES[0].rx+3,y:LAKES[0].z});assert(banks.some(p=>withinWaterReach(w,p)&&liveWalkable(w,p)),'a real lake bank is drinkable');
const edge=cliffEdge(-239);assert(!clearHeight(w,{x:-239,y:edge-1},{x:-239,y:edge+1}),'natural escarpment blocks unsupported climbing');
// An actual supported stair must open the curved ledge; damage closes it.
const climber=w.agents[0],savedPosition={...climber.coordinates};climber.coordinates={x:-239,y:edge+4};const ascentSite=buildingSites(householdWorld(w,climber),climber).find(s=>s.id==='natural-ascent--239');assert(ascentSite);
const parts=[];for(let i=0;i<8;i++){const z=2.25-i*.5,height=.4*(i+1);parts.push({id:'post'+i,kind:'post',material:'timber',center:[.68,(height-.1)/2,z],size:[.1,height-.1,.4],requires:[]});parts.push({id:'step'+i,kind:'deck',material:'timber',center:[0,height-.05,z],size:[1.4,.1,.5],requires:['post'+i]});}
const p=adoptBlueprint(w,climber,validateBlueprint(householdWorld(w,climber),climber,{build:true,name:'Ledge stair fixture',purpose:'ascent',rationale:'Reach the higher natural shelf.',siteId:ascentSite.id,access:'shared',code:parts.map(p=>'part('+JSON.stringify(p)+');').join('\n')}),'isolated fixture');
const from={x:-239,y:edge+4.2},to={x:-239,y:edge-.8};assert(!clearHeight(w,from,to));for(const part of p.parts){part.built=true;part.durability={condition:1,quality:1};}p.status='complete';assert(clearHeight(w,from,to),'completed treads reach the natural shelf');p.parts.find(p=>p.id==='post4').durability.condition=0;assert(!clearHeight(w,from,to),'broken support closes the natural ascent');w.settlement.projects.pop();w.settlement.stores=w.settlement.stores.filter(s=>s.projectId!==p.id);climber.coordinates=savedPosition;
const a=loaded.agents[0],household=a.householdId,home=loaded.frontier.homes.find(h=>h.id==='flint-heights');a.coordinates={x:home.x+5,y:home.y+3};observeLandscape(loaded,a);const view=householdWorld(loaded,a);assert.equal(view.homeContext.id,home.id);assert.equal(a.householdId,household,'visiting does not rewrite ancestry or AI allocation');
a.coordinates={x:-99,y:-34};a.position='travel';const far=householdWorld(loaded,a);assert.deepEqual(chooseDestination(far,a,'camp',{id:'rest'}),a.coordinates,'rest stays local away from camps');assert(!liveCandidates(far,a,[{id:'gather_stones',score:100,label:'Collect stone',reasons:[]}]).some(c=>c.id==='gather_stones'),'legacy resources cannot pull travelers across the map');
const site=Object.values(loaded.regions.sites)[0];a.coordinates={...site.position};a.regionId='wilderness';assert(siteCandidates(loaded,a).some(c=>c.id===`survey:${site.id}`));assert(resolveSiteAction(loaded,a,{id:`survey:${site.id}`,label:'Survey nearby berries'}).success,'physical access works across region labels');
const storageMap=new Map(),storage={get:async k=>structuredClone(storageMap.get(k)),put:async(k,v)=>storageMap.set(k,structuredClone(v)),delete:async k=>storageMap.delete(k),setAlarm:async()=>{},transaction:async f=>f(storage)};
const c=new RealtimeController(storage,{frontierEnabled:true,landscapeEnabled:true});await c.initialize(createWorld());const created=c.record.createdAt;const c2=new RealtimeController(storage,{frontierEnabled:true,landscapeEnabled:true});await c2.load();assert.equal(c2.record.createdAt,created);assert.equal(c2.frame(1).frontier.landscapeVersion,2);
const iterations=Number(process.env.LANDSCAPE_STEPS||120);console.time('natural simulation');for(let i=0;i<iterations;i++){await step(w,6);if(i%300===0)console.log(JSON.stringify({step:i,needs:w.agents.map(a=>({name:a.name,min:Math.round(Math.min(a.needs.hunger,a.needs.hydration,a.needs.energy)),action:a.task?.actionId}))}));}console.timeEnd('natural simulation');
for(const a of w.agents){assert(insideBounds(w,a.coordinates));assert(Object.values(a.needs).every(Number.isFinite));assert(Object.values(a.inventory).every(n=>n>=0));}
assert(w.agents.slice(2).every(a=>a.needs.hunger>5&&a.needs.hydration>5&&a.needs.energy>5));
console.log('PASS natural geography; unchanged original valley; preserved people, accounts, clock and work; idempotent durable migration; physical water/cliff; local rest and cross-region food; ancestry-independent camps; eight-person elapsed survival');
