import assert from 'node:assert/strict';
import {createWorld} from '../engine/core.js';
import {prepare,step} from './elapsed.mjs';
import {expandFrontier,observePeople} from './frontier.mjs';
import {householdWorld,homeAccount,campLayout,knownPerson} from '../shared/frontier.js';
import {fuelFire,advanceWood} from '../engine/wood-runtime.js';
import {liveClear,liveRoute} from './motion.mjs';
import {thermalExposure} from '../engine/thermal.js';
import {resourceFrame} from './resource-sites.mjs';
import {coordForPosition} from '../engine/spectator.js';
import {designContext} from './blueprints.mjs';
const w=prepare(createWorld());w.minute=17;
const before=structuredClone({day:w.day,hour:w.hour,minute:w.minute,agents:w.agents,resources:w.resources,wood:w.wood.batches,projects:w.settlement.projects});
expandFrontier(w);assert.equal(w.agents.length,8);assert.equal(w.worldModel.bounds.width,500);assert.equal(w.day,before.day);assert.equal(w.minute,before.minute);
for(const a of before.agents){const now=w.agents.find(b=>b.id===a.id);for(const k of ['coordinates','inventory','memories','life'])assert.deepEqual(now[k],a[k]);}
assert.deepEqual(w.resources,before.resources);assert.deepEqual(w.wood.batches.slice(0,before.wood.length),before.wood);const count=w.wood.batches.length;expandFrontier(w);assert.equal(w.wood.batches.length,count);
assert(resourceFrame(w).some(o=>o.type==='flint'));
const elin=w.agents.find(a=>a.name==='Elin'),v=householdWorld(w,elin);assert.notEqual(v.resources,w.resources);assert.equal(coordForPosition('camp',v).x,430);v.resources.stones--;assert.equal(w.resources.stones,before.resources.stones);
const mara=w.agents[0];assert(!knownPerson(mara,elin));observePeople(w);assert(!knownPerson(mara,elin));assert.equal(Object.keys(w.frontier.firstContacts).length,0);
assert.equal(liveClear(w,{x:220,y:60},{x:245,y:60}),false,'ridge is physical');assert.equal(liveClear(w,{x:250,y:235},{x:250,y:250}),false,'great river blocks movement');assert.equal(liveClear(w,{x:400,y:140},{x:400,y:155}),false,'terrace needs an ascent');
const dc=designContext(v,elin);assert(!dc.family.relationships.some(r=>r.id===mara.id));assert(dc.sites.every(s=>Math.hypot(s.position.x-elin.coordinates.x,s.position.y-elin.coordinates.y)<80));
w.structures.fire=true;v.structures.fire=false;assert.equal(thermalExposure(v,elin).fireGain,0,'original fire cannot warm a distant household');
const loaded=prepare(JSON.parse(JSON.stringify(w)));assert.equal(loaded.agents.length,8);assert.equal(loaded.frontier.homes.length,4);
const iterations=Number(process.env.FRONTIER_STEPS||1200);console.time('simulation');for(let i=0;i<iterations;i++){await step(loaded,6);if(i%300===0)console.log(JSON.stringify({step:i,day:loaded.day,hour:loaded.hour,agents:loaded.agents.map(a=>({name:a.name,min:Math.round(Math.min(a.needs.hunger,a.needs.hydration,a.needs.energy)),action:a.task?.actionId}))}));}console.timeEnd('simulation');
for(const a of loaded.agents){assert(Object.values(a.needs).every(Number.isFinite));assert(Object.values(a.inventory).every(n=>n>=0));assert(a.coordinates.x>=0&&a.coordinates.x<=500);}
assert(loaded.agents.slice(2).every(a=>a.needs.hunger>5&&a.needs.hydration>5&&a.needs.energy>5),'new regions sustain basic needs');
console.log(JSON.stringify({result:'PASS preserved original state; one-time expansion; independent supplies; local model knowledge; real barriers; eight-person save/reload and elapsed survival',steps:iterations}));
