import assert from 'node:assert/strict';
import {createWorld} from '../engine/core.js';
import {prepare} from './elapsed.mjs';
import {wildlifeStep,wildlifeFrame} from './wildlife.mjs';
import {distance} from '../engine/navigation.js';
import {riverY} from './water.mjs';
const fresh=()=>{const w=prepare(createWorld());w.hour=6;w.agents.forEach(a=>a.coordinates={x:60,y:60});w.settlement.trees=[];w.structures.shelter=false;return w;};
const specimen=(id,species,x,y,extra={})=>({id,species,position:{x,y},home:{x,y},active:true,needs:{hunger:55,thirst:80,energy:80},fear:0,...extra});
const run=(w,n)=>{for(let i=0;i<n;i++)wildlifeStep(w,.6);};
// Distant deer do not get assigned a pack or teleported to one another.
const w=fresh(),doe=specimen('d1','deer',20,40,{sex:'female'}),peer=specimen('d2','deer',30,40,{sex:'female'});w.ecologySystem.wildlife=[doe,peer];
wildlifeStep(w,.6);assert.deepEqual(doe.liveWildlife.companions,['d2']);assert.equal(doe.liveWildlife.mode,'associate');const before=distance(doe.position,peer.position);run(w,12);assert(distance(doe.position,peer.position)<before);assert(distance(doe.position,peer.position)>1.1,'loose group retains body space');
const restart=JSON.parse(JSON.stringify(w));run(w,25);run(restart,25);assert.deepEqual(restart.ecologySystem.wildlife,w.ecologySystem.wildlife,'behavior and random state resume exactly from checkpoint');
const fear=fresh(),rabbit=specimen('rabbit','rabbit',30,40);fear.ecologySystem.wildlife=[rabbit];fear.agents[0].coordinates={x:36,y:40};wildlifeStep(fear,.6);assert.equal(rabbit.liveWildlife.mode,'freeze');assert.equal(rabbit.liveWildlife.speed,0);fear.agents[0].coordinates={x:32,y:40};run(fear,4);assert.equal(rabbit.liveWildlife.mode,'flee');assert(rabbit.position.x<30);fear.agents[0].coordinates={x:80,y:80};run(fear,4);assert(rabbit.fear>40,'fear decays; cannot switch instantly back to feeding');
const bearWorld=fresh(),bear=specimen('bear','bear',30,40);bearWorld.ecologySystem.wildlife=[bear];bearWorld.agents[0].coordinates={x:32,y:40};run(bearWorld,5);assert.equal(bear.liveWildlife.mode,'withdraw');assert(bear.position.x<30,'open escape is preferred to aggression');assert.deepEqual(bear.liveWildlife.companions,[]);
// An actual enclosure, not a dice roll, prevents an escape and causes warning.
const trapped=fresh(),boxed=specimen('boxed','bear',30,40);trapped.ecologySystem.wildlife=[boxed];trapped.agents[0].coordinates={x:31,y:40};trapped.settlement.projects.push({id:'box',position:{x:30,y:40},parts:[[[-1.3,1,0],[.2,2,3]],[[1.3,1,0],[.2,2,3]],[[0,1,-1.3],[3,2,.2]],[[0,1,1.3],[3,2,.2]]].map(([center,size])=>({kind:'wall',center,size,built:true}))});run(trapped,4);assert.equal(boxed.liveWildlife.mode,'defend');assert.equal(boxed.liveWildlife.speed,0);
const fishWorld=fresh(),fish=specimen('school','fish',30,riverY(30));fishWorld.ecologySystem.wildlife=[fish];run(fishWorld,850);assert(Math.abs(fish.position.y-riverY(fish.position.x))<.06,'school stays in channel over bends');assert(fish.position.x>=1&&fish.position.x<=99);assert(distance(fish.position,fish.home)>1);
// Existing identity, position and inventories cannot be changed by a frame read.
const snapshot=JSON.stringify(w);const frame=wildlifeFrame(w);assert.equal(JSON.stringify(w),snapshot);assert(frame.every(a=>a.motion&&a.needs&&a.reason));assert.deepEqual(frame.map(a=>a.id),['d1','d2']);
console.log('PASS local species behavior, freeze/flight hysteresis, loose deer groups, body spacing, bear escape/defense, fish channel, exact checkpoint continuation and pure inspection');
