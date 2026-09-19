import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createWorld,migrateWorld} from '../engine/core.js';
import {FORAGE,ensureRegions,advanceSites,resolveSiteAction,siteCandidates} from '../engine/regions.js';
import {candidateActions,tick} from '../engine/runtime.js';
import {coordForPosition} from '../engine/spectator.js';

const w=createWorld(),[a,b]=w.agents,s=w.regions.sites[FORAGE];
const legacy=w.resources.berries;
assert.equal(Object.keys(a.siteKnowledge).length,0);
assert(!siteCandidates(w,a).some(c=>c.id.startsWith('forage:')));
resolveSiteAction(w,a,{id:`survey:${FORAGE}`,label:'Search'});
assert(a.siteKnowledge[FORAGE]);assert(!b.siteKnowledge[FORAGE]);
assert.deepEqual(coordForPosition(a.position,w),s.position);
s.quantity=1;
resolveSiteAction(w,b,{id:`survey:${FORAGE}`,label:'Search'});
const first=resolveSiteAction(w,a,{id:`forage:${FORAGE}`,label:'Gather'});
const second=resolveSiteAction(w,b,{id:`forage:${FORAGE}`,label:'Gather'});
assert(first.success);assert(!second.success);assert.equal(s.quantity,0);
assert.equal(a.inventory.berries,1);assert.equal(b.inventory.berries,0);
assert.equal(w.resources.berries,legacy,'Independent food pools');
ensureRegions(w);assert.equal(s.quantity,0,'Migration cannot refill exhausted sites');
assert(!siteCandidates(w,b).some(c=>c.id===`forage:${FORAGE}`));
w.day++;advanceSites(w);assert.equal(s.quantity,3);
advanceSites(w);assert.equal(s.quantity,3,'Regrowth is idempotent');
assert.deepEqual(migrateWorld(JSON.parse(JSON.stringify(w))).regions,w.regions);

// New objects must be on land with clearance, using the canonical river geometry.
const river=w.worldModel.objects.find(o=>o.id==='OBJ-CREEK-001');
const scale=w.worldModel.bounds.metersPerUnit||2;
for(const site of Object.values(w.regions.sites))for(let i=1;i<river.geometry.points.length;i++){
  const [ax,ay]=river.geometry.points[i-1],[bx,by]=river.geometry.points[i];
  const dx=bx-ax,dy=by-ay,t=Math.max(0,Math.min(1,((site.position.x-ax)*dx+(site.position.y-ay)*dy)/(dx*dx+dy*dy||1)));
  assert(Math.hypot(site.position.x-ax-t*dx,site.position.y-ay-t*dy)>(5+(river.geometry.widthM||5)/2)/scale);
}

// Depletion memory permits reinspection; it must not reveal remote regrowth.
const fuel=createWorld(),person=fuel.agents[0];person.position='camp';person.needs.warmth=0;
person.resourceObservations={dryWood:{band:'depleted',day:fuel.day,hour:fuel.hour}};
assert(!candidateActions(fuel,person).some(c=>c.id==='gather_dry_wood'));
fuel.hour+=4;
assert(candidateActions(fuel,person).some(c=>c.id==='gather_dry_wood'));

const source=fs.readFileSync('world/state.json','utf8');
const saved=migrateWorld(JSON.parse(source));
const depletedAfterRecovery={hunger:0,warmth:0,hydration:0};
for(let i=0;i<72;i++){
  tick(saved);
  if(i>=12)for(const agent of saved.agents)for(const key of Object.keys(depletedAfterRecovery))
    if(agent.needs[key]===0)depletedAfterRecovery[key]++;
}
assert.deepEqual(depletedAfterRecovery,{hunger:0,warmth:0,hydration:0},'Copied baseline recovers and remains viable for the scenario');
assert.equal(fs.readFileSync('world/state.json','utf8'),source,'Audit must not change saved world');
console.log('PASS private discovery, finite competing harvest, migration, regrowth, land placement, fuel reinspection, copied-state recovery');
