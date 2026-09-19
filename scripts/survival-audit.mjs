// Read-only diagnostic: never persists simulated state or calls a model API.
import fs from 'node:fs';
import {migrateWorld} from '../engine/core.js';
import {tick} from '../engine/runtime.js';
const source=process.argv[2]||'world/state.json';
const world=migrateWorld(JSON.parse(fs.readFileSync(source,'utf8')));
const report={source,start:{day:world.day,hour:world.hour},hours:72,
  initial:world.agents.map(a=>({id:a.id,needs:{...a.needs}})),
  zeroAgentHours:{warmth:0,hunger:0,hydration:0},actions:{},
  note:'Fallback diagnostic only. Zero meters in an exhausted habitat cannot be repaired by decision ranking alone.'};
for(let i=0;i<report.hours;i++){
  for(const d of tick(world))report.actions[d.action]=(report.actions[d.action]||0)+1;
  for(const a of world.agents)for(const key of Object.keys(report.zeroAgentHours))
    if(a.needs[key]===0)report.zeroAgentHours[key]++;
}
console.log(JSON.stringify(report,null,2));
