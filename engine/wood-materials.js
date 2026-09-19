// Raw-branch material accounts. Not yet wired into legacy action execution.
// Existing branch counts did not record mass/moisture: assumptions are explicit.
export const WOOD_RULES = Object.freeze({version:1,legacyDryKgPerBranch:1,dryWaterRatio:.12,wetWaterRatio:.55,fuelWaterRatio:.24});
const copy=x=>structuredClone(x);
const finite=(v,name)=>{if(!Number.isFinite(v)||v<0)throw Error(`Invalid ${name}`);return v;};
const units=v=>{finite(v,'branch quantity');if(!Number.isInteger(v))throw Error('Branch quantity must be an integer');return v;};
const sameHolder=(a,b)=>a.kind===b.kind&&a.id===b.id;
function holder(h){if(!h||!['ground','carried','stored'].includes(h.kind)||typeof h.id!=='string'||!h.id)throw Error('Invalid wood holder');return {kind:h.kind,id:h.id};}

const category=b=>b.waterKg/b.dryKg<=WOOD_RULES.fuelWaterRatio?'dryWood':'wetWood';

// Build a proposed migration without modifying the source world. Deployment must
// switch *all* raw-wood producers/consumers together before using this authority.
export function importLegacyWood(world){
  const at=finite(world.day*24+world.hour,'simulation hour');
  const ledger={version:1,rulesVersion:WOOD_RULES.version,lastHour:at,nextId:1,batches:[],sinks:[],operations:[],
    migration:{at,source:'legacy raw branch counts',dryKgPerBranchAssumption:1,provenance:'unknown before migration'}};
  const holders=[{holder:{kind:'ground',id:'log'},inventory:world.resources},
    ...world.agents.map(a=>({holder:{kind:'carried',id:a.id},inventory:a.inventory}))];
  for(const entry of holders)for(const key of ['dryWood','wetWood']){
    const count=units(entry.inventory?.[key]??0);if(!count)continue;
    const dryKg=count*WOOD_RULES.legacyDryKgPerBranch;
    ledger.batches.push({id:`wood-${ledger.nextId++}`,form:'branch',holder:entry.holder,units:count,dryKg,
      waterKg:dryKg*(key==='dryWood'?WOOD_RULES.dryWaterRatio:WOOD_RULES.wetWaterRatio),
      origin:{kind:'legacy-import',owner:copy(entry.holder),category:key,at,priorHistory:'unknown'},lineage:[]});
  }
  ledger.initialDryKg=totals(ledger).dryKg;
  ledger.initialWaterKg=totals(ledger).waterKg;
  ledger.environmentWaterExchangeKg=0;
  return ledger;
}
export function totals(ledger){return ledger.batches.reduce((s,b)=>({units:s.units+b.units,dryKg:s.dryKg+b.dryKg,waterKg:s.waterKg+b.waterKg}),{units:0,dryKg:0,waterKg:0});}
export function projectWoodCounts(ledger,location){
  const result={dryWood:0,wetWood:0};
  for(const b of ledger.batches)if((b.form??'branch')==='branch'&&sameHolder(b.holder,location))result[category(b)]+=b.units;
  return result;
}
function find(ledger,id){const b=ledger.batches.find(b=>b.id===id);if(!b)throw Error('Unknown wood batch');return b;}
function quantity(b,count){units(count);if(!count||count>b.units)throw Error('Insufficient wood batch');}

export function transferWood(ledger,id,count,destination){
  const b=find(ledger,id),to=holder(destination);quantity(b,count);
  if(sameHolder(b.holder,to))return b.id;
  if(count===b.units){b.holder=to;return b.id;}
  const fraction=count/b.units;
  const moved={...copy(b),id:`wood-${ledger.nextId++}`,holder:to,units:count,dryKg:b.dryKg*fraction,waterKg:b.waterKg*fraction,lineage:[...b.lineage,b.id]};
  b.units-=count;b.dryKg-=moved.dryKg;b.waterKg-=moved.waterKg;ledger.batches.push(moved);return moved.id;
}

// Caller supplies observed physical conditions for every holder. Resolve and
// validate all conditions before mutating anything (one malformed holder must not
// leave half the world weathered). Rates are coarse approximations for calibration.
export function integrateWood(ledger,toHour,conditionsFor){
  finite(toHour,'simulation hour');if(toHour<ledger.lastHour)throw Error('Wood time cannot go backwards');
  const elapsed=toHour-ledger.lastHour;if(!elapsed)return;
  const updates=ledger.batches.map(b=>{
    const c=conditionsFor(copy(b.holder));
    if(!c||!Number.isFinite(c.temperatureC)||!Number.isFinite(c.humidity)||c.humidity<0||c.humidity>1||!Number.isFinite(c.airflow)||c.airflow<0||typeof c.raining!=='boolean'||typeof c.covered!=='boolean')throw Error('Invalid wood exposure');
    const ratio=b.waterKg/b.dryKg;
    const rain=c.raining&&!c.covered;
    const equilibrium=rain?.8:.08+.12*c.humidity;
    const warmth=Math.max(.05,Math.min(2,(c.temperatureC+5)/25));
    const airflow=Math.max(.1,Math.min(3,c.airflow));
    const rate=rain?.18:.06*warmth*airflow;
    return {b,waterKg:b.dryKg*(equilibrium+(ratio-equilibrium)*Math.exp(-rate*elapsed))};
  });
  for(const {b,waterKg} of updates){ledger.environmentWaterExchangeKg+=waterKg-b.waterKg;b.waterKg=waterKg;}
  ledger.lastHour=toHour;
}

// An explicit disposition keeps consumed raw wood accounted. Future material
// transformations must use a transfer to their output account, not a fake sink.
export function consumeWood(ledger,id,count,{reason,operationId}={}){
  if(typeof reason!=='string'||!reason||typeof operationId!=='string'||!operationId)throw Error('Wood consumption requires evidence');
  const prior=ledger.sinks.find(s=>s.operationId===operationId);
  if(prior){if(prior.batchId!==id||prior.units!==count||prior.reason!==reason)throw Error('Conflicting wood operation');return copy(prior);}
  const b=find(ledger,id);quantity(b,count);
  const fraction=count/b.units,record={operationId,batchId:id,holder:copy(b.holder),units:count,dryKg:b.dryKg*fraction,waterKg:b.waterKg*fraction,origin:copy(b.origin),entityIds:copy(b.entityIds||[]),reason,at:ledger.lastHour};
  b.units-=count;b.dryKg-=record.dryKg;b.waterKg-=record.waterKg;
  if(!b.units)ledger.batches=ledger.batches.filter(x=>x!==b);
  ledger.sinks.push(record);return copy(record);
}

// A command transfers/transforms specific material; output wood remains in the
// ledger. Preconditions for reachability, tools and labor belong to the engine.
// Transaction on a copy prevents partial multi-batch acquisition/consumption.
export function applyWoodCommand(ledger,command){
  const {operationId,from,to,quantity:count,category:kind,outputForm='branch',reason,mode='transfer'}=command;
  if(!operationId||typeof operationId!=='string'||!reason||typeof reason!=='string')throw Error('Wood command requires evidence');
  holder(from);units(count);if(!count)throw Error('Empty wood command');
  if(!['dryWood','wetWood','any'].includes(kind)||!['transfer','burn'].includes(mode))throw Error('Invalid wood command');
  if(mode==='transfer')holder(to);
  if(!['branch','pole','shelter-component'].includes(outputForm))throw Error('Unsupported wood output');
  if(mode==='burn'&&(kind!=='dryWood'||outputForm!=='branch'))throw Error('Only usable raw fuel may burn');
  const fingerprint=JSON.stringify({from:holder(from),to:mode==='transfer'?holder(to):null,count,kind,outputForm,reason,mode});
  const prior=ledger.operations?.find(x=>x.id===operationId);
  if(prior){if(prior.fingerprint!==fingerprint)throw Error('Conflicting wood command');return copy(prior);}
  const draft=copy(ledger);draft.operations??=[];
  const sources=draft.batches.filter(b=>(b.form??'branch')==='branch'&&sameHolder(b.holder,from)&&(kind==='any'||category(b)===kind));
  if(sources.reduce((n,b)=>n+b.units,0)<count)throw Error('Insufficient usable wood');
  let remaining=count;const outputs=[],consumed=[];
  for(const b of sources){
    if(!remaining)break;
    const amount=Math.min(remaining,b.units);
    if(mode==='burn')consumed.push(consumeWood(draft,b.id,amount,{reason,operationId:`${operationId}:${b.id}`}));
    else{
      // Splitting within a holder needs a distinct temporary account; otherwise
      // a partial transformation would change the form of the entire batch.
      const staging={kind:'stored',id:`operation:${operationId}`};
      const id=transferWood(draft,b.id,amount,staging),out=find(draft,id);
      out.holder=holder(to);out.form=outputForm;outputs.push(id);
    }
    remaining-=amount;
  }
  const record={id:operationId,fingerprint,at:draft.lastHour,outputs,consumed};
  draft.operations.push(record);Object.assign(ledger,draft);return copy(record);
}

// Preserve entity links without counting a detached branch a second time.
// Existing code puts detached branches into generic inventory. Import requires
// each such entity to match one of those counted units; ambiguity blocks cutover.
export function reconcileLegacyWoodEntities(world,ledger){
  const draft=copy(ledger),linked=new Set(draft.batches.flatMap(b=>b.entityIds||[]));
  for(const o of world.worldModel?.objects||[]){
    if(!o.state?.carried||!o.physical?.wood||!['dryWood','wetWood'].includes(o.state.inventoryKey)||linked.has(o.id))continue;
    const location={kind:'carried',id:o.carrierId};holder(location);
    const batch=draft.batches.find(b=>!b.entityIds?.length&&(b.form??'branch')==='branch'&&sameHolder(b.holder,location)&&b.origin.category===o.state.inventoryKey);
    if(!batch)throw Error(`Unreconciled legacy wood entity: ${o.id}`);
    const id=transferWood(draft,batch.id,1,{kind:'stored',id:`migration:${o.id}`}),piece=find(draft,id);
    piece.holder=location;piece.entityIds=[o.id];piece.legacyEntityMassKg=o.state.massKg??null;
    piece.reconciliation='Alias of one counted legacy branch; count-based mass assumption retained, historical mass ambiguity explicit';
    linked.add(o.id);
  }
  Object.assign(ledger,draft);
}
