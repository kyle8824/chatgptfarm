from pathlib import Path


def replace_once(text, old, new, label):
    count=text.count(old)
    if count!=1:
        raise SystemExit(f'{label}: expected exactly one anchor, found {count}')
    return text.replace(old,new,1)


decision_path=Path('engine/decision.js')
runtime_path=Path('engine/runtime.js')
qa_path=Path('scripts/living-history-qa.mjs')

decision=decision_path.read_text()
if 'resourcePerceptionView' not in decision:
    anchor="export function candidateActions(w,a,{excludedMemoryId=null}={}){"
    helper="function resourcePerceptionView(w,a){return localResourceState(w,a).map(x=>({key:x.key,label:x.label,band:x.band,estimate:x.band==='depleted'?'none visible':x.band==='scarce'?'only a little':x.band==='available'?'some available':'plentiful'}))}\n"
    decision=replace_once(decision,anchor,helper+anchor,'resource perception helper')
    decision=replace_once(decision,"localResources:localResourceState(w,a),wildlife:","localResources:resourcePerceptionView(w,a),wildlife:",'bounded resource perception')
    decision_path.write_text(decision)
else:
    print('v1.5.5 decision perception already applied')

runtime=runtime_path.read_text()
old="const text=recovered?`The ${x.label} here has recovered since I last found it ${prev.band}.`:`The ${x.label} here is ${x.band}; ${x.quantity} usable unit${x.quantity===1?' remains':'s remain'}.`;remember(w,a,text,{importance:x.band==='depleted'?7:6,tags:['resource-observation','resource',x.key,recovered?'recovery':x.band],source:`resource-observation:${x.key}:${w.day}-${w.hour}`,confidence:.92})}a.resourceObservations[x.key]={band:x.band,quantity:x.quantity,day:w.day,hour:w.hour}}}"
new="const text=recovered?`The ${x.label} here has recovered since I last found it ${prev.band}.`:`The ${x.label} here looks ${x.band}; ${x.band==='depleted'?'I cannot see anything useful left':x.band==='scarce'?'only a little seems to remain':x.band==='available'?'some useful material remains':'there is plenty here for now'}.`;remember(w,a,text,{importance:x.band==='depleted'?7:6,tags:['resource-observation','resource',x.key,recovered?'recovery':x.band],source:`resource-observation:${x.key}:${w.day}-${w.hour}`,confidence:.92})}a.resourceObservations[x.key]={band:x.band,day:w.day,hour:w.hour}}}"
if old in runtime:
    runtime=runtime.replace(old,new,1)
elif "quantity:x.quantity,day:w.day,hour:w.hour" in runtime:
    raise SystemExit('resource observation memory anchor drifted')
runtime_path.write_text(runtime)

qa=qa_path.read_text()
qa=qa.replace("x.band==='depleted'&&x.quantity===0","x.band==='depleted'&&!('quantity' in x)")
if 'exact numeric resource quantity leaked into bounded perception' not in qa:
    anchor="if(!scarcityDNA?.observation?.localResources?.some(x=>x.key==='berries'&&x.band==='depleted'))failures.push('local resource depletion was absent from Decision DNA observation');"
    extra=anchor+"\nif(scarcityContext?.perception?.localResources?.some(x=>'quantity' in x))failures.push('exact numeric resource quantity leaked into bounded perception');\nif(scarcityDNA?.observation?.localResources?.some(x=>'quantity' in x))failures.push('exact numeric resource quantity leaked into Decision DNA');\nif(/\\b0 usable units?\\b/i.test(scarcityMemory?.text||''))failures.push('resource memory retained database-like exact quantity wording');"
    qa=replace_once(qa,anchor,extra,'bounded resource QA')
if 'stale renewable depletion never became uncertain enough to recheck' not in qa:
    anchor="if(postArrivalContext?.candidates?.some(c=>c.id==='gather_berries'))failures.push('gather_berries remained available after Ivo locally learned the patch was depleted');"
    extra=anchor+"\narrivalIvo.position='forest';arrivalWorld.hour=(arrivalWorld.hour+19)%24;arrivalWorld.day+=1;const staleIds=candidateActions(arrivalWorld,arrivalIvo).map(x=>x.id);if(!staleIds.includes('gather_berries'))failures.push('stale renewable depletion never became uncertain enough to recheck');"
    qa=replace_once(qa,anchor,extra,'stale renewable belief QA')
qa_path.write_text(qa)
print('Applied v1.5.5 bounded resource perception and stale-belief uncertainty.')
