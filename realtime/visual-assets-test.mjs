// Exercise real model geometry and live action/cargo adapters without a GPU.
import {build} from '../cloudflare/node_modules/esbuild/lib/main.js';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const folder=await fs.mkdtemp(path.join(os.tmpdir(),'valley-assets-'));
try{
 const file=path.join(folder,'check.mjs');
 await build({stdin:{contents:`
 import assert from 'node:assert/strict';
 import * as T from 'three';
 import {createDeer,animateDeer,geometryStats} from './shared/visuals/models.js';
 import {createPerson,animatePerson} from './web/live/people.js';
 import {updateCargo} from './web/live/settlement.js';
 for(const name of ['Mara','Ivo']){
  const p=createPerson(name,name);p.phase='work';
  for(const action of ['drink','gather_timber','rest','eat_berries']){
   p.action=action;for(let i=0;i<200;i++)animatePerson(p,0,1/60,false,true);p.group.updateMatrixWorld(true);
   for(const leg of p.model.legs){const foot=new T.Box3().setFromObject(leg.userData.foot);assert(Math.abs(foot.min.y)<.025,name+' '+action+' soles stay at ground: '+foot.min.y);}
  }
  updateCargo(p,{dryWood:2,berries:3});assert.equal(p.rig.cargo.children.length,5);assert(p.rig.bag.visible);
  const cargo=p.rig.cargo;updateCargo(p,{dryWood:2,berries:3});assert.equal(p.rig.cargo,cargo,'unchanged inventory reuses geometry');
  updateCargo(p,{});assert.equal(p.rig.cargo.children.length,0);assert(!p.rig.bag.visible);
  const before=p.model.hips.position.toArray();animatePerson(p,10,.1,true,false);assert.deepEqual(p.model.hips.position.toArray(),before,'stale data never plays walking');
 }
 const deer=createDeer();assert(geometryStats(deer.root).triangles<10000);
 for(const mode of ['idle','walk','work'])for(let i=0;i<100;i++){
  animateDeer(deer,i/60,mode,1/60);deer.root.updateMatrixWorld(true);
  const bounds=new T.Box3().setFromObject(deer.root);assert(bounds.max.y<1.85&&bounds.min.y>-.10,'deer motion stays within anatomical bounds');
  const p=deer.skin.mesh.geometry.attributes.position.array;assert(p.every(Number.isFinite),'deforming skin stays finite');
 }
 console.log('PASS shared asset budget, grounded action poses, physical cargo, stale-frame pause and deer deformation');
 `,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',outfile:file,nodePaths:[new URL('../cloudflare/node_modules/',import.meta.url).pathname]});
 await import(pathToFileURL(file));
}finally{await fs.rm(folder,{recursive:true,force:true});}
