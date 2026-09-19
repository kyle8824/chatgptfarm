// Append-only local completed segments. Nothing here archives an unfinished future.
// The outbox is durable intent for a later verified external backup; no compaction
// is allowed until an external archive/acknowledgment policy is implemented.
const CHUNK=64000;
const prefix=tick=>`evidence:${String(tick).padStart(12,'0')}`;
export async function digest(text){
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
  return Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('');
}
export async function prepareEvidence(transition){
  const {before,after}=transition;
  const tick=after.meta.tickNumber;
  if(!Number.isSafeInteger(tick)||tick<1)throw Error('Invalid evidence revision');
  const startEvent=before.seq.event, startDecision=before.seq.decision;
  const events=after.history.filter(e=>Number(e.id.slice(2))>=startEvent).reverse();
  if(events.length!==after.seq.event-startEvent)throw Error('Completed events exceeded working-set capture');
  const decisions=transition.evidence?.decisions||after.dna.filter(d=>Number(d.decision_id.slice(2))>=startDecision).map(d=>({...d,evidenceAvailability:'legacy_summary_only'}));
  if(decisions.length!==after.seq.decision-startDecision)throw Error('Completed decisions exceeded evidence capture');
  const payload={version:1,tick,rulesVersion:after.meta.physicsVersion||null,worldSchemaVersion:after.version,simTime:{day:after.day,hour:after.hour},
    stateHash:{algorithm:'SHA-256',before:await digest(JSON.stringify(before)),after:await digest(JSON.stringify(after))},
    events,decisions,coverage:transition.evidence?'exact_decisions':'legacy_summary_only'};
  const text=JSON.stringify(payload),checksum=await digest(text);
  const bytes=new Uint8Array(await new Response(new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
  return {tick,checksum,bytes,eventCount:events.length,decisionCount:decisions.length,coverage:payload.coverage};
}
export async function commitEvidence(tx,segment){
  if(!segment)return;
  const key=prefix(segment.tick),previous=await tx.get(`${key}:manifest`);
  if(previous){if(previous.checksum!==segment.checksum)throw Error('Conflicting completed evidence');return;}
  const summary=await tx.get('evidence:summary');
  if(summary&&segment.tick!==summary.lastTick+1)throw Error('Non-contiguous completed evidence');
  const chunks=Math.ceil(segment.bytes.length/CHUNK);
  for(let i=0;i<chunks;i++)await tx.put(`${key}:${i}`,segment.bytes.slice(i*CHUNK,(i+1)*CHUNK));
  const manifest={version:1,tick:segment.tick,checksum:segment.checksum,chunks,bytes:segment.bytes.length,eventCount:segment.eventCount,decisionCount:segment.decisionCount,coverage:segment.coverage};
  await tx.put(`${key}:manifest`,manifest);
  await tx.put(`archive-outbox:${String(segment.tick).padStart(12,'0')}`,{tick:segment.tick,checksum:segment.checksum,status:'pending_external_archive'});
  await tx.put('evidence:summary',{version:1,firstTick:summary?.firstTick??segment.tick,lastTick:segment.tick,
    segments:(summary?.segments||0)+1,events:(summary?.events||0)+segment.eventCount,decisions:(summary?.decisions||0)+segment.decisionCount,
    compressedBytes:(summary?.compressedBytes||0)+segment.bytes.length,externalArchive:'not_configured',pendingSegments:(summary?.pendingSegments||0)+1});
}
export async function readEvidence(storage,tick){
  if(!Number.isSafeInteger(tick)||tick<1)throw Error('Invalid evidence revision');
  const key=prefix(tick),manifest=await storage.get(`${key}:manifest`);
  if(!manifest)return null;
  const chunks=[];
  for(let i=0;i<manifest.chunks;i++){
    const chunk=await storage.get(`${key}:${i}`);if(!chunk)throw Error('Incomplete evidence segment');chunks.push(chunk);
  }
  const text=await new Response(new Blob(chunks).stream().pipeThrough(new DecompressionStream('gzip'))).text();
  if(await digest(text)!==manifest.checksum)throw Error('Evidence checksum mismatch');
  return {manifest,payload:JSON.parse(text)};
}
