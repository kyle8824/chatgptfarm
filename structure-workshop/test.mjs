import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {build} from '../character-preview/node_modules/esbuild/lib/main.js';
import {structureSignature,makeStructureLook,readStructureLook,normalizeStructureLook} from '../shared/visuals/structure-appearance.js';
import {catalogFromFrame,readCatalog,resourceRows,physicalFunctions,validProject,constructionPrograms} from './catalog.js';
const p=JSON.parse(await fs.readFile(new URL('./example.json',import.meta.url))),before=JSON.stringify(p),look=makeStructureLook(p,{timber:'#315347',grain:.2,roughness:.75});
assert.equal(readStructureLook(p,JSON.parse(JSON.stringify(look))).timber,'#315347');
for(const bad of [{...look,parts:[]},{...look,projectId:'another'},{...look,appearance:{size:[8,8,8]}},{...look,appearance:{roughness:NaN}},{...look,appearance:JSON.parse('{"__proto__":"#ffffff"}') }])assert.throws(()=>readStructureLook(p,bad));
const changed=structuredClone(p);changed.parts[0].size[1]+=.1;assert.throws(()=>readStructureLook(changed,look));
const progressed=structuredClone(p);progressed.parts.forEach(x=>{x.built=true;x.workMinutes=x.requiredMinutes;});assert.deepEqual(readStructureLook(progressed,look),look.appearance,'building progress does not erase a valid look');
assert.equal(JSON.stringify(p),before,'drafting a look cannot change a design');
const data=catalogFromFrame({settlement:{projects:[p],stores:[]},runtime:{createdAt:123,revision:4}});assert.equal(readCatalog({getItem:()=>JSON.stringify(data)}).worldId,123);assert.equal(readCatalog({getItem:()=>'{broken'}),null);assert.throws(()=>catalogFromFrame({}));
const rows=resourceRows({...p,stockpileId:'s'},[{id:'s',items:{wetWood:1,dryWood:2,woodPole:99,reeds:1}}]);assert.equal(rows.find(x=>x.material==='timber').atSite,3);assert(rows.every(x=>x.missing===Math.max(0,x.required-x.committed-x.atSite)));assert(physicalFunctions(p).some(x=>x.includes('storage')));
// Bundle the shared renderer for Node with the same pinned Three dependency.
const result=await build({stdin:{contents:"export {createStructureModel} from './shared/visuals/structure-model.js';export {Box3,Vector3} from 'three';",resolveDir:new URL('../',import.meta.url).pathname},bundle:true,format:'esm',platform:'node',write:false,nodePaths:[new URL('../character-preview/node_modules/',import.meta.url).pathname]});
const module=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
const modelA=module.createStructureModel(p,{stage:'design'}),modelB=module.createStructureModel(p,{stage:'design',appearance:look.appearance});
const geometry=m=>{m.updateMatrixWorld(true);const parts=[];m.traverse(x=>{if(x.isMesh)parts.push({id:x.userData.partId,position:x.position.toArray(),scale:x.scale.toArray(),vertices:Array.from(x.geometry.attributes.position.array)});});return parts;};
assert.deepEqual(geometry(modelA),geometry(modelB),'appearance edits retain every physical vertex and part transform');
assert(modelA.children.reduce((n,x)=>n+(x.geometry?.index?.count||x.geometry?.attributes?.position?.count||0)/3,0)<15000,'rough example stays within a mobile geometry budget');
assert.equal(modelA.children.filter(x=>x.isMesh).length,p.parts.length);assert.equal(structureSignature(p),structureSignature(progressed));
assert.equal(modelB.children[0].material.color.getHexString(),'315347');modelA.userData.disposeStructure();modelB.userData.disposeStructure();
const failed=structuredClone(p);for(const x of failed.parts){x.built=true;x.durability={quality:.4,condition:1};}failed.parts[0].durability.condition=0;const damaged=module.createStructureModel(failed,{stage:'construction'});assert(damaged.children.find(x=>x.userData.partId==='weather-top').position.y<.1,'failed support puts dependent roofing on the ground in the recorded view');damaged.userData.disposeStructure();
console.log('PASS appearance-only schema, geometry invariance, design binding, construction progress, resource accounting, cached catalog and shared renderer');

assert(validProject({...p,parts:Array.from({length:96},(_,i)=>({...p.parts[0],id:'part-'+i}))}));assert(!validProject({...p,parts:Array.from({length:97},(_,i)=>({...p.parts[0],id:'part-'+i}))}));
const stages={parts:[],stages:[{name:'First mat',code:'part({id:\'mat\'});',partIds:['mat']},{name:'Added cover',code:'part({id:\'roof\'});',partIds:['roof']}]};assert.match(constructionPrograms(stages),/Stage 1 · First mat[\s\S]*Stage 2 · Added cover/);
