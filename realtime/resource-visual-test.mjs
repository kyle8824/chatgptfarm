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
 import {ValleyScene} from './web/live/scene.js';
 import {NaturalObjects} from './web/live/natural-objects.js';
 import {SettlementView} from './web/live/settlement.js';
 const view={scene:new T.Scene()};ValleyScene.prototype.camp.call(view);
 function scenery(stones,reeds=14,clay=10,wood=18){ValleyScene.prototype.updateResourceScenery.call(view,{resources:{stones,reeds,clay,dryWood:wood,wetWood:0}});}
 scenery(24);assert.equal(view.resourceScenery.stones.filter(m=>m.visible).length,14);
 scenery(12);assert.equal(view.resourceScenery.stones.filter(m=>m.visible).length,7);
 scenery(0,0,0,0);for(const meshes of Object.values(view.resourceScenery))assert(meshes.every(m=>!m.visible),'original depleted scenery disappears');
 scenery(24);assert.equal(view.resourceScenery.stones.filter(m=>m.visible).length,14,'absolute updates can render earlier snapshots without cumulative shrinking');
 scenery(12,7,5,9);assert(view.resourceScenery.clay[0].geometry.drawRange.count<90);assert(view.resourceScenery.log[0].scale.x<1);
 const scene=new T.Scene(),natural=new NaturalObjects(scene,()=>0);
 const object=(type,remaining)=>({id:'test',type,mapped:true,remaining,position:{x:10,y:10}});
 function meshes(type,remaining){natural.update({objects:[object(type,remaining)]});return natural.objects.get('test').group.children.filter(m=>m.material?.visible!==false);}
 for(const type of ['stones','flint','resin','clay','potteryClay','reeds','longFiber','log']){
  assert(meshes(type,12).length>0,type+' visible before harvest');assert.equal(meshes(type,0).length,0,type+' has no resource geometry after depletion');
 }
 const full=meshes('stones',12).length,half=meshes('stones',6).length;assert(half<full);assert(meshes('berries',2).length<meshes('berries',12).length);assert.equal(meshes('berries',0).length,4,'renewable bushes remain without fruit');
 const settlement=new SettlementView(scene,()=>0),rack={id:'rack',kind:'site',items:{},position:{x:0,y:0},revision:0};
 settlement.update({projects:[],stores:[rack]});const height=()=>{const g=settlement.objects.get('rack').group;let max=0;g.traverse(m=>{if(m.isMesh&&m.material.visible){m.updateWorldMatrix(true,false);max=Math.max(max,new T.Box3().setFromObject(m).max.y);}});return max;};
 const tall=height();rack.folded=true;settlement.update({projects:[],stores:[rack]});assert(height()<tall/2,'folded rack is a low bundle without standing legs or flag');
 console.log('PASS actual geometry for original and mapped depletion, fruit, reed/log quantities and folded construction racks');
 `,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',outfile:file,nodePaths:[new URL('../cloudflare/node_modules/',import.meta.url).pathname]});
 await import(pathToFileURL(file));
}finally{await fs.rm(folder,{recursive:true,force:true});}
