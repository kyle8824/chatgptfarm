import assert from 'node:assert/strict';
import {buildChronicle} from '../engine/chronicle.js';
const w={history:[{id:'E-3',day:2,hour:8,type:'action',actionId:'drink',title:'Drink',detail:'Mara drinks.'},{id:'E-2',day:1,hour:9,type:'discovery',discoveryKey:'thicket',title:'Upland berries',detail:'Mara found a thicket.'},{id:'E-1',day:1,hour:8,type:'attempt',title:'Try',detail:'No stable effect.'}]};
const before=JSON.stringify(w),book=buildChronicle(w);
assert.equal(book.chapters.length,1);assert.equal(book.chapters[0].entries[0].id,'E-2');assert.equal(JSON.stringify(w),before);
w.history.push({...w.history[1]});assert.equal(buildChronicle(w).chapters[0].entries.length,1);
assert.deepEqual(buildChronicle({history:[]}).chapters,[]);
assert(book.coverageNote.includes('not a complete'));
console.log('PASS chronicle factual source, routine filtering, duplicate suppression, read-only behavior and empty history');
