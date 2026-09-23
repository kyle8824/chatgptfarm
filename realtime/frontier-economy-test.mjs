import assert from 'node:assert/strict';
import {createWorld} from '../engine/core.js';
import {prepare} from './elapsed.mjs';
import {expandFrontier,observePeople} from './frontier.mjs';
import {householdWorld} from '../shared/frontier.js';
import {barterOffer,workEconomy} from './regional-economy.mjs';
import {craftTool} from './crafting.mjs';
import {validateBlueprint,adoptBlueprint,buildingSites} from './blueprints.mjs';
import {liveClear} from './motion.mjs';
import {treadHeight} from './climbing.mjs';
const w=prepare(createWorld());expandFrontier(w);const a=w.agents[0],b=w.agents[2];a.coordinates={x:150,y:100};b.coordinates={x:151.6,y:100};for(const p of [a,b]){p.needs={hunger:90,hydration:90,energy:90,warmth:80};p.task=null;}
observePeople(w);assert(a.knownPeople[b.id]);assert.equal(Object.keys(w.frontier.firstContacts).length,1);observePeople(w);assert.equal(w.chronicle.events.filter(e=>e.type==='first-contact').length,1);
a.inventory.resin=2;b.inventory.flint=2;const offer=barterOffer(w,a,b);assert.deepEqual(offer,{give:'resin',take:'flint'});const task={selected:{job:{kind:'trade',partnerId:b.id,...offer}},workMinutes:0,requiredMinutes:4};assert.equal(workEconomy(w,a,task,3).done,false);assert.equal(a.inventory.flint||0,0);assert.equal(workEconomy(w,a,task,1).success,true);assert.equal(a.inventory.flint,1);assert.equal(b.inventory.resin,1);assert.equal(workEconomy(w,a,task,4).success,false,'trade cannot replay');
assert(craftTool(w,a,'sharpStone').success);assert.equal(a.inventory.flint,0);assert.equal(a.inventory.sharpStone,1);a.inventory.longFiber=1;assert(craftTool(w,a,'cordage').success);assert.equal(a.inventory.longFiber,0);assert.equal(a.inventory.cordage,1);
// Construct a valid sequence of supported steps; a name alone is irrelevant.
a.coordinates={x:409,y:139.5};const v=householdWorld(w,a),site=buildingSites(v,a).find(s=>s.id==='ascent-409');assert(site,'ascent is offered only nearby');
const parts=[];for(let i=0;i<8;i++){const z=-2.25+i*.5,height=.4*(i+1);parts.push({id:'post'+i,kind:'post',material:'timber',center:[.68,(height-.1)/2,z],size:[.1,height-.1,.4],requires:[]});parts.push({id:'step'+i,kind:'deck',material:'timber',center:[0,height-.05,z],size:[1.4,.1,.5],requires:['post'+i]});}
const raw={build:true,name:'Unnamed test ascent',purpose:'reach a higher ledge',rationale:'The nearby terrace cannot be crossed on foot.',access:'shared',siteId:site.id,code:parts.map(p=>'part('+JSON.stringify(p)+');').join('\n')};
const project=adoptBlueprint(v,a,validateBlueprint(v,a,raw),'isolated-fixture');assert(!liveClear(w,{x:409,y:140.5},{x:409,y:146}), 'unfinished ascent remains blocked');for(const p of project.parts){p.built=true;p.durability={condition:1,quality:1};}project.status='complete';assert(liveClear(w,{x:409,y:140.5},{x:409,y:146}),'built, touching treads join lower ground to terrace');project.parts.find(p=>p.id==='post4').durability.condition=0;assert(!liveClear(w,{x:409,y:140.5},{x:409,y:146}),'failed support closes the route');
console.log('PASS observed first contact once; finite mutually useful barter with replay guard; regional flint/fiber processing; supported ascent opens only when built and closes on structural failure');
