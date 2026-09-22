import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const temporary=await fs.mkdtemp(path.join(os.tmpdir(),'farm-worker-'));
await build({entryPoints:[new URL('./worker.mjs',import.meta.url).pathname],bundle:true,format:'esm',platform:'browser',external:['cloudflare:workers'],outfile:path.join(temporary,'worker.mjs')});
const seed=await fs.readFile(new URL('../world/state.json',import.meta.url),'utf8');
const options={durableObjectsPersist:path.join(temporary,'state'),workers:[{name:'preview',modules:true,modulesRoot:temporary,scriptPath:path.join(temporary,'worker.mjs'),compatibilityDate:'2026-09-01',
 durableObjects:{WORLD:{className:'FarmWorld',useSQLite:true}},
 bindings:{ADMIN_KEY:'test-only-password',AI_ENABLED:'false'},
 outboundService:async()=>new Response(seed,{headers:{'Content-Type':'application/json'}})}]};
let mf=new Miniflare({...convertV4MiniflareOptions(options),resourcePersistencePath:path.join(temporary,'state')});
const request=(url,options)=>mf.dispatchFetch('https://preview.test'+url,options);
const auth={method:'POST',headers:{Authorization:'Bearer test-only-password'}};
try{
 assert.equal((await request('/start',{method:'POST'})).status,401);
 assert.equal((await request('/state')).status,503);
 const response=await request('/start',auth);assert.equal(response.status,200,await response.clone().text());
 assert.equal((await request('/start',auth)).status,409);
 assert.equal((await request('/evidence?tick=1')).status,401);
 const evidenceAuth={headers:{Authorization:'Bearer test-only-password'}};
 assert.equal((await request('/evidence?tick=1',evidenceAuth)).status,404);
 assert.equal((await request('/evidence?tick=invalid',evidenceAuth)).status,400);
 const before=await(await request('/state')).json();
 await new Promise(resolve=>setTimeout(resolve,6500));
 const health=await(await request('/health')).json();assert(health.planned,'Real Durable Object alarm must prepare next action without requests');
 const moving=await(await request('/state')).json();
 assert(moving.ecologySystem.wildlife.some((a,i)=>JSON.stringify(a.position)!==JSON.stringify(before.ecologySystem.wildlife[i].position)));
 await mf.dispose();mf=new Miniflare({...convertV4MiniflareOptions(options),resourcePersistencePath:path.join(temporary,'state')});
 const restart=await(await request('/health')).json();
 assert.equal(restart.start,health.start);assert.equal(restart.tick,health.tick);assert(restart.planned);
 assert.equal((await request('/pause',auth)).status,200);
 assert.equal((await(await request('/health')).json()).alarmAt,null);
 assert.equal((await request('/resume',auth)).status,200);
 options.workers[0].bindings.ORIGINAL_WORLD_ARCHIVED='true';await mf.dispose();mf=new Miniflare({...convertV4MiniflareOptions(options),resourcePersistencePath:path.join(temporary,'state')});
 assert.equal((await request('/resume',auth)).status,409,'retired original cannot be restarted through the old setup page');
 assert.equal((await request('/start',auth)).status,409,'retired original cannot be initialized again');
 console.log('PASS actual Cloudflare workerd: auth, one-time import, automatic alarm, moving wildlife, SQLite persistence across restart, pause/resume');
}finally{await mf.dispose();await fs.rm(temporary,{recursive:true,force:true});}
