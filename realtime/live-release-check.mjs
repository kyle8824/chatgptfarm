// Read-only public deployment verification. Never sends owner events or changes
// a checkpoint, quota, alarm, provider configuration or world identity.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const root='https://chatgptfarm.kyle8824.workers.dev',expected=process.env.EXPECTED_LIVE_COMMIT,observeOnly=process.env.OBSERVE_ONLY==='1',records=[];
const get=async route=>{const response=await fetch(root+route,{cache:'no-store',signal:AbortSignal.timeout(20000)});const value=await response.json();if(!response.ok)throw Error(`${route}: ${response.status} ${value.code||value.error||''}`);return value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
await fs.mkdir('realtime-qa',{recursive:true});
try{
 let healthy=null;
 for(let i=0;i<(observeOnly?1:48);i++){
  try{const h=await get('/live/health');records.push({observedAt:Date.now(),...h});console.log(JSON.stringify({build:h.build?.commit,status:h.status,lagMs:h.lagMs,revision:h.revision,createdAt:h.createdAt,persistence:h.persistence}));
   assert.equal(h.createdAt,1790030005263,'the original live world must be retained');assert.equal(h.rate,6);assert(h.computedThrough<=h.serverTime,'no future simulation');
   if(observeOnly||h.build?.commit===expected&&h.status==='running'&&h.lagMs<5000){healthy=h;break;}
  }catch(e){records.push({observedAt:Date.now(),error:String(e)});console.log(String(e));if(/original live world|future simulation/.test(String(e)))throw e;}
  if(!observeOnly)await wait(15000);
 }
 assert(healthy,observeOnly?'public health unavailable':'deployed build did not reach live time within the verification window');
 const before=await get('/live/state');await fs.writeFile('realtime-qa/live-release-before.json',JSON.stringify(before));
 if(!observeOnly){
  assert.equal(before.agents.length,8);assert.equal(before.runtime.createdAt,1790030005263);
  const socket=new WebSocket(root.replace('https:','wss:')+'/live/ws?protocol=delta-1'),frames=[];let socketError=null;
  socket.addEventListener('message',e=>{try{const value=JSON.parse(e.data);if(value.type==='state')frames.push(value.runtime);}catch(error){socketError=String(error);}});socket.addEventListener('error',()=>{socketError='public WebSocket error';});
  await wait(45000);socket.close();assert.equal(socketError,null);assert(frames.length>=80,'current-state streaming continues for 45 seconds');assert(frames.every(r=>r.computedThrough<=r.serverTime));assert(frames.at(-1).revision>frames[0].revision);
  const after=await get('/live/state');await fs.writeFile('realtime-qa/live-release-after.json',JSON.stringify(after));
  assert.deepEqual(after.agents.map(a=>a.id),before.agents.map(a=>a.id));assert.equal(after.runtime.createdAt,before.runtime.createdAt);assert.equal(after.runtime.rate,6);assert(after.runtime.computedThrough>before.runtime.computedThrough);assert(after.runtime.lagMs<5000);assert(after.runtime.persistence.checkpointAt>before.runtime.persistence.checkpointAt,'real checkpoint writes continue');
  for(const p of before.settlement.projects){const retained=after.settlement.projects.find(q=>q.id===p.id);assert(retained,'existing structure retained');for(const part of p.parts)assert(retained.parts.some(x=>x.id===part.id),'existing component retained');}
  await fs.writeFile('realtime-qa/live-release-stream.json',JSON.stringify({frames:frames.length,first:frames[0],last:frames.at(-1),providers:after.runtime.providers}));console.log(JSON.stringify({result:'PASS deployed commit, original world identity, 6x live clock, preserved people/parts, sustained current-state stream and advancing checkpoints',frames:frames.length,revision:after.runtime.revision}));
 }
}finally{await fs.writeFile('realtime-qa/live-release-health.json',JSON.stringify(records,null,2));}
