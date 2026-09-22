import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createWorld,relationship} from '../engine/core.js';
import {prepare,step} from './elapsed.mjs';
import {runConstructionCode} from './construction-code.mjs';
import {validateBlueprint,adoptBlueprint,designContext} from './blueprints.mjs';
import {resourceFrame,ensureResourceSites,harvestSite,materialSources} from './resource-sites.mjs';
import {settlementCandidates,workSettlement,recordStructureUse} from './settlement.mjs';
import {woodConditions} from '../engine/wood-runtime.js';
import {treeUnits} from './holdings.mjs';
const fresh=()=>{const w=prepare(createWorld());w.temperature=65;w.weather='clear';w.structures.shelter=true;for(const [i,a]of w.agents.entries()){a.coordinates={x:66+i*4,y:36};a.needs={hunger:95,hydration:95,energy:95,warmth:80};a.task=null;a.suspendedTasks=[];}return w;};
const code=`const width=1.6;
function upright(id,x,z){ return part({id:id,kind:'post',shape:'cylinder',material:'timber',center:[x,1,z],size:[.14,2,.14],requires:[]}); }
for(let i=0;i<4;i++){ const x=i%2===0?-.75:.75;const z=i<2?-.55:.55;upright('support-'+i,x,z); }
part({id:'shelf',kind:'deck',material:'timber',center:[0,.35,0],size:[width,.12,1.2],requires:['support-0','support-1','support-2','support-3']});
part({id:'weather-top',kind:'roof',material:'reeds',center:[0,2.05,0],size:[1.9,.1,1.5],requires:['support-0','support-1','support-2','support-3']});`;
const raw={build:true,name:'Airy material shelter',purpose:'keep wet branches out of rain while air circulates',siteId:'clearing-0',access:'shared',rationale:'A raised supply surface and weather cap help protect wet material without an enclosure.',code};
const compiled=runConstructionCode(code);assert.equal(compiled.parts.length,6);assert.equal(compiled.parts[3].id,'support-3');
for(const bad of ['fetch("https://example.com")','globalThis.world=1','part.constructor("return globalThis")()','while(true){}','for(let i=0;i<999;i++) {}','function f(){return f();} f();','let x=1/0;','let x={};x.q=3;'])assert.throws(()=>runConstructionCode(bad),undefined,bad);
const w=fresh(),a=w.agents[0],old=JSON.stringify(w),design=validateBlueprint(w,a,raw);assert.equal(JSON.stringify(w),old,'code compilation/validation cannot change the world');
assert(design.generic);assert.equal(design.code,code);assert(design.affordances.storage.covered);assert(!design.affordances.storage.secured);assert(design.affordances.storage.capacityVolume>20);
assert(!validateBlueprint(w,a,{...raw,purpose:'a magic food factory'}).affordances.labels.some(x=>/food factory/.test(x)),'names cannot invent capabilities');
const withoutRoof=validateBlueprint(w,a,{...raw,code:code.slice(0,code.indexOf("part({id:'weather-top'"))});assert(!withoutRoof.affordances.storage.covered,'missing cover cannot shelter supplies');
const floating=code.replace('center:[x,1,z]','center:[x,2,z]');assert.throws(()=>validateBlueprint(w,a,{...raw,code:floating}),/Floating|touch/);
const beforeNodes=JSON.stringify(w.resourceSites);ensureResourceSites(w);assert.equal(JSON.stringify(w.resourceSites),beforeNodes,'activation is idempotent');
const node=w.resourceSites.nodes.find(n=>n.item==='stones'),initial=node.initial;assert.equal(harvestSite(w,node.id,3),3);assert.equal(node.remaining+node.harvested,initial);assert.equal(w.resources.stones,JSON.parse(old).resources.stones,'new deposits do not duplicate or refill old stock');
const snap=JSON.stringify(w);resourceFrame(w);assert.equal(JSON.stringify(w),snap,'inspecting resources is read-only');
const p=adoptBlueprint(w,a,design,'test-model');assert(p.parts.every(p=>!p.built));assert(!p.storeId,'a program confers no physical benefit before construction');
// Supply job must route to its actual node; no virtual remote harvesting.
w.resources.reeds=0;const reed=materialSources(w,'reeds')[0],job={kind:'gather',nodeId:reed.nodeId,item:'reeds',quantity:2,position:reed.position,destination:{x:reed.position.x,y:reed.position.y+1}};
const before=reed.remaining;a.coordinates={x:90,y:75};let t={selected:{job},requiredMinutes:1,workMinutes:0};assert(!workSettlement(w,a,t,1).success);assert.equal(w.resourceSites.nodes.find(n=>n.id===reed.nodeId).remaining,before);
a.coordinates={...job.destination};assert(workSettlement(w,a,t,1).success);assert.equal(w.resourceSites.nodes.find(n=>n.id===reed.nodeId).remaining,before-2);
// Full novel program -> source gathering -> carry -> assembly -> usable surface.
w.agents=[a];a.coordinates={x:66,y:36};a.task=null;const timberBefore=w.settlement.trees.reduce((n,t)=>n+treeUnits(w,t),0);
let count=0;for(;count<34000&&p.status!=='complete';count++)await step(w,.6);
assert.equal(p.status,'complete',JSON.stringify({count,task:a.task,parts:p.parts,needs:a.needs}));assert(w.settlement.trees.reduce((n,t)=>n+treeUnits(w,t),0)<timberBefore);
const store=w.settlement.stores.find(s=>s.id===p.storeId);assert.equal(store.kind,'platform');assert(store.covered);assert(Math.abs(store.baseHeight-.45)<1e-9);w.weather='rain';assert(woodConditions(w,{kind:'stored',id:store.id}).covered,'geometry-derived cover changes real wood weather exposure');
const saved=prepare(JSON.parse(JSON.stringify(w)));assert.equal(saved.settlement.projects[0].code,code);assert.deepEqual(saved.resourceSites,w.resourceSites);assert.deepEqual(saved.settlement.projects[0].parts,p.parts);
// Social feedback follows actual completed use, and has a per-day cap.
const other=fresh().agents[1];other.coordinates={...store.position};w.agents.push(other);const prior=relationship(w,other,a).trust;recordStructureUse(w,other,p,'storage');const after=relationship(w,other,a).trust;assert(after>prior);recordStructureUse(w,other,p,'storage');assert.equal(relationship(w,other,a).trust,after);assert(designContext(w,a).projects[0].feedback.uses===1);
const privateDesign={...p,access:'private',feedback:undefined},memories=other.memories.length;recordStructureUse(w,other,privateDesign,'supplies');assert.equal(relationship(w,other,a).trust,after,'taking personal supplies grants no shared-use reward');assert.equal(other.memories.length,memories,'private use creates no appreciation memory');
await fs.mkdir('realtime-qa',{recursive:true});await fs.writeFile('realtime-qa/open-construction-fixture.json',JSON.stringify(w));
console.log('PASS generated construction code, bounds/no host access, novel purpose, measured affordances, finite local deposits, full gathering/assembly, physical weather cover, use feedback and checkpoint preservation',count);
