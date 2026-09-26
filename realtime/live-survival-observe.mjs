import fs from 'node:fs/promises';
// Read-only observation of already elapsed live state. This does not advance,
// reset, command, or repair the world, and makes no future-state projections.
await fs.mkdir('realtime-qa',{recursive:true});
const root='https://chatgptfarm.kyle8824.workers.dev/live/',samples=[];
for(let sample=0;sample<21;sample++){
 try{
  const responses=await Promise.all(['health','state'].map(p=>fetch(root+p,{cache:'no-store',signal:AbortSignal.timeout(20000)})));
  if(responses.some(r=>!r.ok))throw Error('Public observation failed: '+responses.map(r=>r.status));
  const [health,state]=await Promise.all(responses.map(r=>r.json()));
  const entry={sample,at:new Date().toISOString(),health,day:state.day,hour:state.hour,minute:state.minute,agents:state.agents.filter(a=>['Tessa','Ronan'].includes(a.name)),history:state.history};samples.push(entry);
  await fs.writeFile('realtime-qa/live-survival-observation.json',JSON.stringify(samples));
  console.log(JSON.stringify({sample,revision:state.runtime?.revision,lagMs:health.lagMs,agents:entry.agents.map(a=>({name:a.name,coordinates:a.coordinates,needs:a.needs,inventory:a.inventory,task:a.task}))}));
 }catch(e){console.log(JSON.stringify({sample,error:String(e)}));}
 if(sample<20)await new Promise(r=>setTimeout(r,30000));
}
if(samples.length<18)throw Error('Too few successful live survival observations');
