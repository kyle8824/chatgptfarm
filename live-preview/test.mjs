import assert from 'node:assert/strict';
import {createWorld} from '../engine.js';
import {prepare,step,applyEvent} from './elapsed.mjs';
import {LiveController} from './controller.mjs';
const forced=id=>({decide:async()=>({choiceType:'known_action',actionId:id,goal:id,intent:id,decisionSummary:'test',brainMode:'ai',model:'fixture',confidence:1,referencedMemoryIds:[]})});
let w=prepare(createWorld());w.agents=w.agents.slice(0,1);let a=w.agents[0];a.inventory.berries=1;Object.assign(a.needs,{hunger:30,hydration:90,warmth:90,energy:90});
await step(w,1,{mind:forced('eat_berries'),wallTime:1000});assert(a.needs.hunger>30&&a.needs.hunger<30.1);const portion=a.task.portion.remaining;assert(portion>0.99);
const restart=structuredClone(w);await step(w,1,{wallTime:2000});await step(restart,1,{wallTime:2000});assert.deepEqual(w,restart);
// An event arriving after work started affects the next physics step, not a saved future.
const beforeWarmth=a.needs.warmth;applyEvent(w,{type:'rain'});await step(w,1,{wallTime:3000});assert.equal(w.weather,'rain');assert.notEqual(a.needs.warmth,beforeWarmth);
w=prepare(createWorld());w.agents=w.agents.slice(0,1);a=w.agents[0];a.position='camp';a.coordinates={x:64,y:34};a.inventory.dryWood=4;Object.assign(a.needs,{hunger:80,hydration:80,warmth:80,energy:80});
await step(w,1,{mind:forced('build_shelter'),wallTime:1000});const originalTask=a.task.id;assert.equal(a.task.actionId,'build_shelter');a.needs.hydration=5;await step(w,1,{wallTime:2000});assert(a.suspendedTasks.some(t=>t.id===originalTask));assert.equal(a.task.actionId,'drink');assert.equal(w.structures.shelter,false);
class Store{constructor(){this.map=new Map();this.alarm=null;}async get(k){return structuredClone(this.map.get(k));}async put(k,v){this.map.set(k,structuredClone(v));}async delete(k){this.map.delete(k);}async setAlarm(v){this.alarm=v;}async deleteAlarm(){this.alarm=null;}async transaction(fn){const backup=structuredClone(this.map),alarm=this.alarm;try{return await fn(this);}catch(e){this.map=backup;this.alarm=alarm;throw e;}}}
let now=10000;const storage=new Store(),controller=new LiveController(storage,{now:()=>now});await controller.initialize(createWorld());const initial=await controller.snapshot();assert.equal(controller.record.steps,0);assert.equal(controller.record.lastWallTime,now);assert(!('next' in controller.record));assert(!('after' in controller.record));
await controller.alarm();assert.equal(controller.record.steps,0);now+=1000;await controller.alarm();assert.equal(controller.record.steps,1);assert.equal(controller.record.lastWallTime,now);assert.equal(controller.record.world.minute,0.1);
const c2=new LiveController(storage,{now:()=>now});assert.deepEqual(await c2.snapshot(),await controller.snapshot());const snapshot=await c2.snapshot();await c2.snapshot();assert.deepEqual(await c2.snapshot(),snapshot,'reads do not drive time');
console.log('PASS elapsed-only clock; no future state; partial meal; exact restart; new rain; urgent interruption after work starts; pure reads');
