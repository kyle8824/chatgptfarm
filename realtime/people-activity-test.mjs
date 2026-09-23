// Exercise the actual articulated model and renderer adapter without a GPU.
import {build} from '../cloudflare/node_modules/esbuild/lib/main.js';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const folder=await fs.mkdtemp(path.join(os.tmpdir(),'valley-activity-'));
try{
 const file=path.join(folder,'check.mjs');
 await build({stdin:{contents:`
 import assert from 'node:assert/strict';
 import {createPerson,personAction,animatePerson} from './web/live/people.js';
 import {progressRatio,progressText} from './web/live/task-view.js';
 const pause={actionId:'reconsider',label:'Pause to reconsider available work',phase:'work',job:{kind:'reconsider'},workMinutes:1,requiredMinutes:2};
 assert.equal(personAction(pause),'idle','a live pause must not select the supply-handling animation');
 assert.equal(personAction({actionId:'reconsider'}),'idle','a pause without job metadata is also idle');
 assert.equal(personAction({actionId:'future-task',job:{kind:'future-task'}}),'idle','new tasks cannot silently inherit physical labor');
 assert.equal(personAction(null),'idle');
 assert.equal(progressRatio({task:pause}),0);assert.match(progressText({task:pause}),/Looking for useful work/);
 for(const name of ['Mara','Ivo']){
  const e=createPerson('test-'+name,name),m=e.model;e.phase='work';let time=0;
  const frames=(action,seconds=2,walking=false)=>{e.action=action;const samples=[];for(let i=0;i<seconds*60;i++){time+=1/60;e.walk+=walking?9/60:0;animatePerson(e,time,1/60,walking,true);samples.push({hip:m.hips.position.y,lean:m.torso.rotation.x,arm:m.arms[0].rotation.x,leg:m.legs[0].rotation.x});}return samples;};
  // Preserve existing real labor, including the newer practice and rack jobs.
  for(const kind of ['gather','take','deliver','deposit','put_down','fallen','craft','practice_technique','regional_craft','trade','fold_rack','unfold_rack','assemble','repair','harvest']){
   const samples=frames(personAction({actionId:kind,job:{kind}})).slice(-60);
   assert(samples.at(-1).lean>.5,kind+' still has a working posture');
   assert(Math.max(...samples.map(s=>s.arm))-Math.min(...samples.map(s=>s.arm))>.15,kind+' still animates real work');
  }
  // Reproduce the screenshot: stop an actual bent-over job and accept pause.
  const paused=frames(personAction(pause)).slice(-60);
  for(const s of paused){assert(s.hip>.80,'pause stands up');assert(Math.abs(s.lean)<.01,'pause does not keep the gathering crouch');assert(Math.abs(s.arm)<.04,'pause has only small idle motion');}
  const moving=frames(personAction({actionId:'gather_stones'}),1,true);assert(Math.max(...moving.map(s=>s.leg))-Math.min(...moving.map(s=>s.leg))>.5,'physical travel still walks');
  frames(personAction(pause));assert(Math.abs(m.legs[0].rotation.x)<.01,'walking settles when the server pauses');
  const frozen=m.arms[0].quaternion.clone();animatePerson(e,time+10,1,false,false);assert(m.arms[0].quaternion.equals(frozen),'stale frames do not invent continued activity');
 }
 console.log('PASS real male/female rigs: working-to-pause transition, neutral idle, actual work and walking, unknown jobs and stale-frame hold');
 `,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',outfile:file,nodePaths:[new URL('../cloudflare/node_modules/',import.meta.url).pathname]});
 await import(pathToFileURL(file));
}finally{await fs.rm(folder,{recursive:true,force:true});}
