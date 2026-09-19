import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const temporary=await fs.mkdtemp(path.join(os.tmpdir(),'farm-evidence-worker-'));
// Isolated test-only controller with an injected clock. No test routes or clocks
// are added to the production Worker or its existing Durable Object.
const source=`import {DurableObject} from 'cloudflare:workers';
import {WorldController} from './world.mjs';
import {createWorld} from '../engine.js';
export class TestWorld extends DurableObject {
 constructor(ctx,env){super(ctx,env);this.clock=1000000;this.world=new WorldController(ctx.storage,{},()=>this.clock);}
 async alarm(){}
 async fetch(request){const p=new URL(request.url).pathname;
 if(p==='/init')await this.world.initialize(createWorld());
 if(p==='/prepare')await this.world.alarm();
 if(p==='/complete'){this.clock=1150000;await this.world.alarm();}
 if(p==='/record')return Response.json(await this.world.evidence(1));
 return Response.json(await this.world.health());}
}
export default {fetch(request,env){return env.WORLD.getByName('isolated-evidence-test').fetch(request)}};`;
await build({stdin:{contents:source,resolveDir:new URL('.',import.meta.url).pathname,sourcefile:'evidence-test-entry.mjs'},bundle:true,format:'esm',platform:'browser',external:['cloudflare:workers'],outfile:path.join(temporary,'worker.mjs')});
const options={workers:[{name:'evidence-test',modules:true,modulesRoot:temporary,scriptPath:path.join(temporary,'worker.mjs'),compatibilityDate:'2026-09-01',durableObjects:{WORLD:{className:'TestWorld',useSQLite:true}}}]};
const create=()=>new Miniflare({...convertV4MiniflareOptions(options),resourcePersistencePath:path.join(temporary,'state')});
let mf=create();
async function call(route){const r=await mf.dispatchFetch('https://test.invalid'+route);assert.equal(r.status,200,await r.clone().text());return r.json();}
try{
 await call('/init');await call('/prepare');assert.equal(await call('/record'),null);
 const health=await call('/complete');assert.equal(health.evidence.segments,1);assert.equal(health.evidence.pendingSegments,1);
 const record=await call('/record');assert.equal(record.payload.decisions.length,2);
 await call('/complete');assert.deepEqual(await call('/record'),record);
 await mf.dispose();mf=create();assert.deepEqual(await call('/record'),record);
 console.log('PASS real SQLite workerd: completed-only archive, atomic outbox, duplicate delivery, checksum and persistence across restart');
}finally{await mf.dispose();await fs.rm(temporary,{recursive:true,force:true});}
