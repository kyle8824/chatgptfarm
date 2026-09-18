// A read-only chapter projection. Recorded events remain the authority.
// This never calls a model, advances a world, or claims missing history exists.
export function buildChronicle(world,{limit=40}={}){
  const seen=new Set(),groups=new Map();
  const events=[...(world.history||[])].sort((a,b)=>a.day-b.day||a.hour-b.hour||String(a.id).localeCompare(String(b.id)));
  for(const e of events){
    if(!e.id||seen.has(e.id)||!e.detail)continue;
    const discovery=e.type==='discovery'||(e.type==='world'&&/^New place discovered/.test(e.title||''));
    const firstCraft=e.type==='physical'&&e.success===true;
    const social=e.type==='action'&&e.actionId==='share_food';
    if(!discovery&&!firstCraft&&!social)continue;
    // Physical events are shown once per action title; routine repetitions are omitted.
    const key=discovery?(e.discoveryKey||e.id):`${e.type}:${e.title}:${e.agentId||''}`;
    if(seen.has(key))continue;seen.add(e.id);seen.add(key);
    if(!groups.has(e.day))groups.set(e.day,[]);
    groups.get(e.day).push({id:e.id,hour:e.hour,title:e.title,text:e.detail,agentId:e.agentId||null,kind:discovery?'discovery':social?'cooperation':'experiment'});
  }
  const chapters=[...groups].map(([day,entries])=>({id:`day-${day}`,day,title:entries.find(e=>e.kind==='discovery')?.title||`What changed on day ${day}`,entries}));
  return {title:'The Chronicle of Willow Basin',source:'retained completed world events',coverageNote:'Earlier events may no longer be present in this world snapshot. This is not a complete historical archive.',chapters:chapters.slice(-Math.max(1,Math.min(100,limit)))};
}
