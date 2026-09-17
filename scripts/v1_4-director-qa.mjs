import fs from 'node:fs';
import { migrateWorld, advanceEcology } from '../engine.js';
import { updateSpectatorState, LIVING_DIRECTOR_VERSION } from '../engine/spectator.js';

const w=migrateWorld(JSON.parse(fs.readFileSync('world/state.json','utf8')));
advanceEcology(w);
updateSpectatorState(w);
const failures=[];
if(LIVING_DIRECTOR_VERSION!=='1.4-real-evidence')failures.push(`wrong Living Director: ${LIVING_DIRECTOR_VERSION}`);
if((w.liveThreads||[]).some(t=>t.id==='tracks'||t.id==='game-trail'))failures.push('legacy fake-track/game-trail spectator thread survived');
const active=(w.ecologySystem?.traces||[]).filter(x=>x.active!==false&&x.position&&(x.clarity||0)>=.42);
if(active.length&&!w.liveThreads.some(t=>t.evidenceId&&active.some(x=>x.id===t.evidenceId)))failures.push('real ecology traces exist but Living Director did not surface source-linked evidence');
for(const t of w.liveThreads||[]){if(t.evidenceId&&!active.some(x=>x.id===t.evidenceId))failures.push(`director referenced non-active evidence ${t.evidenceId}`);if(t.ecologyEventId&&!(w.ecologySystem?.events||[]).some(e=>e.id===t.ecologyEventId))failures.push(`director referenced missing ecology event ${t.ecologyEventId}`)}
if(failures.length){console.error(failures.join('\n'));process.exit(1)}
console.log(JSON.stringify({director:LIVING_DIRECTOR_VERSION,threads:(w.liveThreads||[]).map(t=>({id:t.id,kind:t.kind,evidenceId:t.evidenceId||null,ecologyEventId:t.ecologyEventId||null,sourceId:t.sourceId||null,focus:t.focus||null}))},null,2));
