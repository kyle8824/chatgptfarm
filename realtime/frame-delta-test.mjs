import assert from 'node:assert/strict';
import {createWorld} from '../engine/core.js';
import {RealtimeController} from './world.mjs';
import {step} from './elapsed.mjs';
import {frameDelta,applyFrameDelta} from '../shared/live-frame.js';
const saved=new Map(),storage={get:async k=>saved.get(k),put:async(k,v)=>saved.set(k,v),delete:async k=>saved.delete(k),setAlarm:async()=>{},transaction:async f=>f(storage)};const c=new RealtimeController(storage,{frontierEnabled:true});await c.initialize(createWorld());
let previous=null,total=0,max=0;for(let i=0;i<100;i++){await step(c.record.world,.6);c.record.revision++;const next=JSON.parse(JSON.stringify(c.frame(1,{includeTrees:false}))),patch=JSON.parse(JSON.stringify(frameDelta(previous,next))),restored=applyFrameDelta(previous,patch);assert.deepEqual(restored,next);if(i){const bytes=JSON.stringify(patch).length;total+=bytes;max=Math.max(max,bytes);}previous=next;}
assert.throws(()=>applyFrameDelta(null,{delta:true,baseRevision:0,changes:[]}));assert(total/99<20000,'moving updates avoid repeating full map, memories and object descriptions');console.log(JSON.stringify({result:'PASS revisioned live changes reconstruct exact current state; wrong bases fail closed',averageBytes:Math.round(total/99),maxBytes:max,fullBytes:JSON.stringify(previous).length}));
