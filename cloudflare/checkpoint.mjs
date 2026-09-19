import {prepareEvidence,commitEvidence} from './evidence.mjs';
const CHUNK=64000;
export async function readCheckpoint(storage) {
  const manifest=await storage.get('manifest');
  if(!manifest)return null;
  if(manifest.version!==1)throw Error('Unknown checkpoint format');
  const chunks=[];
  for(let i=0;i<manifest.chunks;i++){
    const value=await storage.get(`chunk:${i}`);
    if(!value)throw Error('Incomplete checkpoint');
    chunks.push(value);
  }
  const stream=new Blob(chunks).stream().pipeThrough(new DecompressionStream('gzip'));
  return JSON.parse(await new Response(stream).text());
}
export async function writeCheckpoint(storage, record, alarmAt, completed = null) {
  const segment=completed?await prepareEvidence(completed):null;
  const stream=new Blob([JSON.stringify(record)]).stream().pipeThrough(new CompressionStream('gzip'));
  const bytes=new Uint8Array(await new Response(stream).arrayBuffer());
  const count=Math.ceil(bytes.length/CHUNK);
  // State and wake-up commit together, including when the instance is evicted.
  await storage.transaction(async tx=>{
    await commitEvidence(tx,segment);
    const previous=await tx.get('manifest');
    for(let i=0;i<count;i++)await tx.put(`chunk:${i}`,bytes.slice(i*CHUNK,(i+1)*CHUNK));
    for(let i=count;i<(previous?.chunks||0);i++)await tx.delete(`chunk:${i}`);
    await tx.put('manifest',{version:1,chunks:count,bytes:bytes.length});
    if(alarmAt===null)await tx.deleteAlarm();else await tx.setAlarm(alarmAt);
  });
  return bytes.length;
}
