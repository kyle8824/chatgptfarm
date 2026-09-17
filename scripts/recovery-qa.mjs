import assert from 'node:assert/strict';
import fs from 'node:fs';
import { migrateWorld, advanceEcology } from '../engine.js';
const original=JSON.parse(fs.readFileSync('world/state.json','utf8'));
const w=migrateWorld(structuredClone(original));
const memories=w.agents.map(a=>a.memories.map(m=>m.id));
const creek=w.worldModel.objects.find(o=>o.type==='creek_segment').geometry.points;
function distanceToChannel(p){let best=Infinity;for(let i=1;i<creek.length;i++){const [ax,ay]=creek[i-1],[bx,by]=creek[i],dx=bx-ax,dy=by-ay,t=Math.max(0,Math.min(1,((p.x-ax)*dx+(p.y-ay)*dy)/(dx*dx+dy*dy)));best=Math.min(best,Math.hypot(p.x-ax-t*dx,p.y-ay-t*dy))}return best}
const fishIds=w.ecologySystem.wildlife.filter(a=>a.species==='fish').map(a=>a.id);
for(let i=0;i<96;i++){advanceEcology(w);for(const a of w.ecologySystem.wildlife.filter(a=>a.species==='fish')){assert(distanceToChannel(a.position)<.15,`${a.id} stranded outside canonical creek`);assert.equal(a.movement.to.x,a.position.x)}w.hour++;if(w.hour===24){w.hour=0;w.day++}}
assert.deepEqual(w.agents.map(a=>a.memories.map(m=>m.id)),memories);
assert.deepEqual(w.ecologySystem.wildlife.filter(a=>a.species==='fish').map(a=>a.id),fishIds);
assert.deepEqual(JSON.parse(fs.readFileSync('world/state.json','utf8')),original);
console.log('Recovery QA passed: 96 ecology steps, fish confined to canonical creek, identities and memories preserved, source state unchanged.');
