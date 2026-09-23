import assert from 'node:assert/strict';
import {createWorld} from '../engine/core.js';
import {prepare,step} from './elapsed.mjs';
import {expandFrontier} from './frontier.mjs';
import {reorganizeLandscape} from './landscape-migration.mjs';
import {householdWorld} from '../shared/frontier.js';
import {liveUrgency,liveCandidates} from './behavior.mjs';
import {candidateActions} from '../engine/decision.js';
import {liveWalkable} from './motion.mjs';

// Reproduce Mara's observed wilderness position and needs, with a burning
// home fire far away. This fixture is isolated; it never edits saved state.
const w=prepare(createWorld());expandFrontier(w);reorganizeLandscape(w);
const a=w.agents.find(a=>a.id==='agent-mara');w.agents=[a];
w.weather='rain';w.temperature=38;w.structures.fire=true;
a.coordinates={x:-56.721699070049375,y:-102.32770455281673};a.position='travel';
a.needs={hydration:30.5,hunger:12.29,energy:21.29,warmth:0};
for(const k of Object.keys(a.inventory))a.inventory[k]=0;
a.task=null;a.suspendedTasks=[];a.siteKnowledge={};a.locomotion=null;
const view=householdWorld(w,a),site=w.regions.sites['wild-food-150-210'];
assert(site&&site.quantity>0);const foodBefore=site.quantity,hungerBefore=a.needs.hunger;
const candidates=liveCandidates(view,a,candidateActions(view,a));
assert(candidates.some(c=>c.id===`survey:${site.id}`));
assert(!candidates.some(c=>c.id==='seek_warmth'),'distant camp warmth is not an available local action');
assert.equal(liveUrgency(view,a),'hunger','a remote fire cannot preempt urgent local food');
const away={...a.coordinates};a.coordinates={x:65,y:33};a.needs.hunger=30;
assert.equal(liveUrgency(householdWorld(w,a),a),'warmth','nearby usable heat still gets priority');
a.coordinates=away;a.needs.hunger=hungerBefore;
let lastAction=null,changes=0,eaten=false,maxHunger=hungerBefore,steps=0;
for(;steps<1800;steps++){
 await step(w,6);assert(liveWalkable(w,a.coordinates),'food recovery uses walkable ground');
 if(a.task?.actionId!==lastAction){lastAction=a.task?.actionId;changes++;}
 maxHunger=Math.max(maxHunger,a.needs.hunger);
 if(a.needs.hunger>hungerBefore+20){eaten=true;break;}
}
assert(a.siteKnowledge[site.id],'the food search completes and identifies the nearby patch');
assert(site.quantity<foodBefore,'food is physically gathered from the finite patch');
assert(eaten,`gathered food is eaten and hunger recovers: ${a.needs.hunger}`);
assert(changes<30,`work persists instead of restarting each physical step: ${changes}`);
assert(!w.history.some(e=>e.type==='action-interrupted'&&e.detail.includes('warmth')),'remote warmth never cancels local survival work');
assert(a.needs.warmth<5,'unavailable heat is not silently awarded');
console.log(JSON.stringify({result:'PASS cold wilderness traveler identifies finite food, gathers and eats without remote-fire interruptions; nearby warmth remains urgent',steps,changes,maxHunger,foodUsed:foodBefore-site.quantity}));
