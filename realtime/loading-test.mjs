import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {build} from '../cloudflare/node_modules/esbuild/lib/main.js';
import {WorldConnection} from '../web/live/connection.js';
import {worldFailure} from '../cloudflare/failure.mjs';
const callbacks=new Map();let clock=100,seq=0;const timers={setTimeout(fn,ms){const id=++seq;callbacks.set(id,{fn,at:clock+ms});return id;},clearTimeout(id){callbacks.delete(id);}};
const advance=ms=>{const end=clock+ms;for(;;){const next=[...callbacks].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;clock=next[1].at;callbacks.delete(next[0]);next[1].fn();}clock=end;};
class Socket{static instances=[];constructor(){Socket.instances.push(this);this.readyState=0;}send(){}close(){this.readyState=3;this.onclose?.();}open(){this.readyState=1;this.onopen?.();}message(data){this.onmessage?.({data:JSON.stringify(data)});}}
const problems=[],frames=[];let probes=0;
const c=new WorldConnection({url:'wss://test/live/ws',onFrame:m=>frames.push(m),onProblem:m=>problems.push(m),WebSocketClass:Socket,timers,now:()=>clock,fetchHealth:async()=>{probes++;return{ok:false,json:async()=>({error:'The world’s hosting limit has been reached.'})};}});
c.start();Socket.instances.at(-1).open();advance(12000);await new Promise(r=>setImmediate(r));assert(problems.some(x=>x.includes('hosting limit')),'silent connection gets a meaningful error after a deadline');assert.equal(probes,1);
const old=c.socket;c.retryNow();assert.notEqual(c.socket,old);old.message({type:'state',runtime:{},agents:[]});assert.equal(frames.length,0,'retired sockets cannot replace the current world');
c.socket.open();c.socket.message({type:'state',runtime:{revision:4},agents:[]});assert.equal(frames.length,1);advance(12000);assert.equal(c.socket.readyState,1,'receiving real state cancels the initial timeout');c.stop();assert.equal(callbacks.size,0);
assert.equal(worldFailure(Error('Exceeded daily limit for rows written')).code,'hosting_limit');assert.equal(worldFailure(Error('Exceeded allowed rows written in Durable Objects free tier.'),Date.UTC(2026,8,22,23,59)).retryAfterSeconds,60);assert.equal(worldFailure(Error('database or disk is full: SQLITE_FULL')).code,'storage_full');assert(!worldFailure(Error('token=secret https://example.com/private')).detail.includes('secret'));
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'valley-load-test-'));
assert.equal(worldFailure(Error('Exceeded allowed rows written in Durable Objects free tier.'),Date.UTC(2026,8,23,0,1)).retryAfterSeconds,300,'a rejection after midnight cannot postpone recovery to the following day');
try{
 await build({entryPoints:[new URL('../cloudflare/worker.mjs',import.meta.url).pathname],outfile:path.join(temp,'worker.mjs'),bundle:true,format:'esm',platform:'node',plugins:[{name:'do-test',setup(b){b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'stub',namespace:'do'}));b.onLoad({filter:/.*/,namespace:'do'},()=>({contents:'export class DurableObject{constructor(ctx,env){this.ctx=ctx;this.env=env}}'}));}}]});
 const {LiveValley,default:worker}=await import(path.join(temp,'worker.mjs'));
 let wake;const routes=[];await worker.scheduled({}, {LIVE_VALLEY:{getByName:name=>({fetch:async url=>{routes.push([name,url]);return new Response('ok');}})},WORLD:{getByName:name=>({fetch:async(url,options)=>{routes.push([name,url,options.method]);return new Response('ok');}})}},{waitUntil:p=>wake=p});await wake;assert.deepEqual(routes.map(r=>r[0]),['live-valley-v1','preview-v1']);assert.equal(routes[1][2],'POST');
 let boot,forks=0,reads=0;const originalError=Error('Exceeded daily limit for rows written');const ctx={storage:{get:async()=>{reads++;throw originalError;}},blockConcurrencyWhile(fn){boot=fn();}};
 const live=new LiveValley(ctx,{WORLD:{getByName(){forks++;throw Error('must never seed on read failure');}}});await boot;
 for(let i=0;i<3;i++){const response=await live.fetch(new Request('https://test/live/health'));assert.equal(response.status,503);const info=await response.json();assert.equal(info.code,'hosting_limit');assert.equal(info.stateReset,false);assert(info.detail.includes('rows written'));}
 assert.equal(forks,0);assert.equal(reads,1,'startup failure backs off instead of crashing and reloading per viewer');assert.equal(live.controller.record,undefined);
 const response=await worker.fetch(new Request('https://test/live/health'),{LIVE_VALLEY:{getByName(){return{fetch:async()=>{throw originalError;}};}}});assert.equal(response.status,503);assert.equal((await response.json()).code,'hosting_limit','outer Worker explains a provider failure before the object starts');
 live.bootRetryAt=0;await live.fetch(new Request('https://test/live/health'));assert.equal(reads,2,'startup retries after backoff');assert.equal(forks,0);
 console.log('PASS bounded loading timeout; health diagnostics; manual retry; socket recovery; startup/storage failure without reset; outer Worker error handling');
}finally{await fs.rm(temp,{recursive:true,force:true});}
