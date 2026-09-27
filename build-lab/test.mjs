import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {freshExperiment,siteChoices,requestContext,validateProposal,adoptProposal,advanceExperiment,measures,selectRestTest} from './core.mjs';
import {validateBlueprint} from '../realtime/blueprints.mjs';
import {BuildLabService} from './service.mjs';

const mat={build:true,name:'Regression fixture',purpose:'Rest',rationale:'A test fixture, not an AI-generated result.',siteId:'clearing-0',access:'private',code:"part({id:'surface',kind:'deck',material:'reeds',center:[0,.04,0],size:[1,.08,2.2],requires:[]});"};
const lab=freshExperiment({scenario:'comfortable'}),before=JSON.stringify(lab.world),result=validateProposal(lab,mat);
assert(result.ok);assert.equal(JSON.stringify(lab.world),before,'validation is read-only');assert.deepEqual(result.project,validateBlueprint(lab.world,lab.world.agents[0],mat));assert.equal(result.bindings.coilsNeeded,1);assert.equal(measures(lab).rest.length,0);
const project=adoptProposal(lab),reedsBefore=lab.world.agents[0].inventory.reeds;
await advanceExperiment(lab,30);assert.equal(project.status,'complete');assert.equal(project.parts[0].workMinutes,7);assert(lab.world.agents[0].inventory.reeds<reedsBefore);assert(lab.world.agents[0].craftPractice.fiberwork.minutes>=23);assert(Number.isFinite(lab.world.agents[0].craftPractice.fiberwork.attempts));assert(measures(lab).rest.length);assert(requestContext(lab).measuredUse.length);
const lastUseAt=measures(lab).lastRest?.at??-1,used=measures(lab).rest[0];selectRestTest(lab,used.projectId,used.surfaceId);await advanceExperiment(lab,10);assert(lab.world.agents[0].comfort.lastRest?.projectId===project.id,'completed surface actually used');assert(measures(lab).lastRest.at>lastUseAt,'directed use attempt causes fresh measured use');
const retained=JSON.stringify(project.parts[0]),extension=siteChoices(lab).find(s=>s.extendsProjectId===project.id);assert(extension);
const addition={...mat,siteId:extension.id,extendsProjectId:project.id,code:"part({id:'post',kind:'post',material:'timber',center:[.9,.6,.9],size:[.12,1.2,.12],requires:[]});"};
assert(validateProposal(lab,addition).ok);assert.equal(adoptProposal(lab),project);assert.equal(JSON.stringify(project.parts[0]),retained);assert(measures(lab).rest.length,'existing surface stays useful during addition');
const standard=freshExperiment(),nearby=freshExperiment({nearbySites:true});assert(!siteChoices(standard).some(s=>s.experimental));assert(siteChoices(nearby).some(s=>s.experimental));
const seat={...mat,siteId:'local-67-33',code:"part({id:'block',kind:'deck',material:'stone',center:[-1,.2,0],size:[.6,.4,.6],requires:[]});"};assert(validateProposal(nearby,seat).ok);assert(!validateProposal(standard,seat).ok,'experimental sites do not silently enter baseline');
assert(!validateProposal(nearby,{...mat,code:'fetch("https://example.com")'}).ok);assert(!validateProposal(nearby,{...mat,code:"part({id:'float',kind:'deck',material:'timber',center:[0,3,0],size:[1,.1,1],requires:[]});"}).ok);
const restart=JSON.parse(JSON.stringify(lab));assert.deepEqual(measures(restart),measures(lab));await advanceExperiment(restart,.1);
assert(validateProposal(freshExperiment(),{build:false,rationale:'No worthwhile construction yet.'}).deferred);

class Storage{constructor(){this.data=new Map();}async get(k){return structuredClone(this.data.get(k));}async put(k,v){this.data.set(k,structuredClone(v));}async delete(k){this.data.delete(k);}}
const env={ADMIN_KEY:'test-owner-key',OPENAI_API_KEY:'not-a-real-key',OPENAI_MODEL:'fixture-model',OPENAI_INPUT_USD_PER_MILLION:'.2',OPENAI_OUTPUT_USD_PER_MILLION:'1.2'};
let now=Date.UTC(2026,8,27,18),calls=0;const storage=new Storage(),provider=async()=>{calls++;return {response:JSON.stringify(mat),usage:{input_tokens:1000,output_tokens:300}};};
const service=new BuildLabService(storage,env,{now:()=>now,provider});
const request=(id,token=env.ADMIN_KEY,more={})=>new Request('https://test/live/build-lab/api/design',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({requestId:id,variant:'context',context:requestContext(freshExperiment()),...more})});
assert.equal((await service.fetch(request('request-000000000000','wrong'))).status,401);assert.equal(calls,0);
const response=await service.fetch(request('request-000000000000'));assert.equal(response.status,200);assert.equal(calls,1);const cached=await service.fetch(request('request-000000000000'));assert.equal(cached.status,200);assert((await cached.json()).reused);assert.equal(calls,1,'idempotent retry never doubles AI cost');
assert.equal((await service.fetch(request('request-000000000000',env.ADMIN_KEY,{instruction:'different'}))).status,409);
assert.equal((await service.fetch(request('request-000000000001'))).status,429,'cooldown');
for(let i=1;i<12;i++){now+=16000;assert.equal((await service.fetch(request('request-'+String(i).padStart(12,'0')))).status,200);}
now+=16000;assert.equal((await service.fetch(request('request-000000000099'))).status,429);assert.equal(calls,12);assert.equal((await service.status()).calls,12);
const restarted=new BuildLabService(storage,env,{now:()=>now,provider});assert.equal((await restarted.fetch(request('request-000000000098'))).status,429,'cap survives object restart');
now+=86400000;assert.equal((await restarted.fetch(request('request-000000000098'))).status,200,'UTC day rollover');
const failedStore=new Storage();failedStore.put=async()=>{throw Error('storage failure');};const never=new BuildLabService(failedStore,env,{provider:async()=>{throw Error('must not call provider');}});assert.equal((await never.fetch(request('request-storage-fail'))).status,503);
const failureStorage=new Storage(),failed=new BuildLabService(failureStorage,env,{provider:async()=>{throw Error('timeout');}});assert.equal((await failed.fetch(request('request-provider-fail'))).status,502);assert((await failed.status()).reservedUsd>0,'uncertain calls retain reservation');assert.equal((await failed.fetch(request('request-provider-fail'))).status,502);assert.equal((await failed.status()).calls,1);
const expensive=new BuildLabService(new Storage(),{...env,BUILD_LAB_DAILY_USD:'.0001'},{provider});assert.equal((await expensive.fetch(request('request-too-expensive'))).status,429);
const worker=await fs.readFile(new URL('../cloudflare/worker.mjs',import.meta.url),'utf8');assert(worker.indexOf("if(path.startsWith('/live/build-lab/api/'))")>worker.indexOf('async fetch(request,env)'),'lab routes live only in public router');assert(!/LIVE_VALLEY|\.WORLD\b|env\.AI\b/.test(await fs.readFile(new URL('service.mjs',import.meta.url),'utf8')),'lab service never accesses the production world or Cloudflare AI');
console.log('PASS: shared validation; finite assembly; actual use; retained additions; nearby-site experiment; restart; owner auth; durable cost/call cap; idempotency; cooldown; failure accounting; production isolation.');
