import assert from 'node:assert/strict';
import {createWorld} from '../engine/core.js';
import {candidateActions} from '../engine/decision.js';
import {householdWorld,homeAccount} from '../shared/frontier.js';
import {woodCommand,advanceWood,woodConditions} from '../engine/wood-runtime.js';
import {totals} from '../engine/wood-materials.js';
import {prepare,step} from './elapsed.mjs';
import {expandFrontier} from './frontier.mjs';
import {reorganizeLandscape} from './landscape-migration.mjs';
import {makeStore,syncHoldings,clock} from './holdings.mjs';
import {liveCandidates,liveUrgency} from './behavior.mjs';
import {coldPreparationCandidates} from './cold-preparation.mjs';
import {returnCandidate} from './thermal-return.mjs';

function fixture(){
 const w=prepare(createWorld());expandFrontier(w);reorganizeLandscape(w);
 const a=w.agents.find(a=>a.id==='agent-tessa');w.agents=[a];
 a.coordinates={x:-322.425,y:22.154};a.position='meadow';a.needs={hunger:99,hydration:99,energy:100,warmth:0};a.task=null;a.suspendedTasks=[];
 w.weather='rain';w.temperature=40;w.liveWeatherUntil=w.day*24+w.hour+200;
 const v=householdWorld(w,a),h=v.homeContext;v.structures.shelter=false;v.structures.fire=false;
 for(const b of w.wood.batches)if(b.form==='branch')b.waterKg=b.dryKg*.55;
 const pile=makeStore(w,{position:{x:a.coordinates.x+1,y:a.coordinates.y},ownerId:a.id,name:'Existing wet supplies'});
 woodCommand(v,a,{from:{kind:'ground',id:homeAccount(v,'log')},to:{kind:'stored',id:pile.id},quantity:6,category:'any',reason:'finite isolated fixture supplies'});
 woodCommand(v,a,{from:{kind:'stored',id:pile.id},quantity:2,category:'any',reason:'observed two damp branches'});
 syncHoldings(w);a.landmarks={[pile.id]:{position:{...pile.position},seenAt:clock(w)}};
 return {w,a,h,pile};
}
let {w,a,h,pile}=fixture(),view=()=>householdWorld(w,a);
const before=totals(w.wood),seedTime=clock(w);
assert.equal(a.inventory.wetWood,2);assert(!candidateActions(view(),a).some(c=>c.id==='build_shelter'));
assert.equal(liveUrgency(view(),a),'warmth');
assert(coldPreparationCandidates(view(),a).some(c=>c.job.kind==='take'&&c.job.quantity===2));
// Work in progress is not completed protection, and an unseen worker cannot
// make this person's own preparation disappear from their choices.
const unseen={id:'unseen-builder',coordinates:{x:h.x,y:h.y},task:{actionId:'build_shelter'}};w.agents.push(unseen);
assert(coldPreparationCandidates(view(),a).some(c=>c.job.kind==='take'&&c.job.quantity===2));w.agents.pop();
const completed=new Set();let builtAt=null;
for(let i=0;i<2400;i++){
 await step(w,6);
 for(const e of w.history)if(e.type==='action-completed'&&e.success)completed.add(e.title);
 if(i===400){const work=a.task?.workMinutes;w=prepare(JSON.parse(JSON.stringify(w)));a=w.agents[0];h=w.frontier.homes.find(h=>h.id===a.householdId);assert.equal(a.task?.workMinutes,work);}
 if(view().structures.shelter&&!builtAt)builtAt=clock(w);
 const drying=w.settlement.stores.find(s=>s.id===homeAccount(view(),'camp-drying'));
 if(drying?.items.wetWood>=2)break;
}
assert(view().structures.shelter,'cold person must physically finish shelter from wet branches');
assert(builtAt-seedTime>=180,'shelter requires full elapsed construction work');
assert(w.wood.batches.filter(b=>b.form==='shelter-component'&&b.holder.id===homeAccount(view(),'camp-shelter')).reduce((n,b)=>n+b.units,0)>=4);
const drying=w.settlement.stores.find(s=>s.id===homeAccount(view(),'camp-drying'));
assert(drying?.items.wetWood>=2,'collected fuel must be deposited under the completed shelter');
assert(!coldPreparationCandidates(view(),a).some(c=>c.id.includes(':supply:')),'a protected fuel reserve stops repeated harvesting');
assert(!liveCandidates(view(),a,candidateActions(view(),a)).some(c=>c.id==='gather_wet_wood'),'legacy gathering also respects the protected fuel reserve');
assert.equal(drying.items.dryWood,0,'wet construction never manufactures dry fuel');
assert.equal(a.needs.warmth,0,'shelter and a drying pile alone create no heat');
assert.equal(totals(w.wood).dryKg,before.dryKg,'preparation only moves existing wood mass');
assert(woodConditions(w,{kind:'stored',id:drying.id}).covered);
const duplicate=JSON.stringify(drying);w=prepare(JSON.parse(JSON.stringify(w)));a=w.agents[0];assert.equal(w.settlement.stores.filter(s=>s.id===drying.id).length,1);assert.equal(JSON.stringify(w.settlement.stores.find(s=>s.id===drying.id)),duplicate);
// A separate material integration checks actual evaporation over elapsed
// simulated time; the production scheduler is never fast-forwarded.
let dryHours=0;
while(drying.items.dryWood<1&&dryHours++<160){
 const now=w.day*24+w.hour+w.minute/60;advanceWood(w,now+1);w.hour++;if(w.hour>=24){w.hour-=24;w.day++;}syncHoldings(w);Object.assign(drying,w.settlement.stores.find(s=>s.id===drying.id));
}
assert(drying.items.dryWood>=1,'covered fuel eventually dries even during rain');
// Fuel must remain usable on the trip and through ignition. An actual dry
// weather window follows this persistent rain fixture; no moisture is reset.
w.weather='cloudy';
a.needs.hunger=a.needs.hydration=a.needs.energy=90;a.task=null;a.suspendedTasks=[];
let lit=false,warmed=false;
for(let i=0;i<850;i++){await step(w,6);lit ||=view().structures.fire;warmed ||=a.needs.warmth>0;if(warmed)break;}
if(!warmed)console.log(JSON.stringify({dryHours,lit,needs:a.needs,position:a.coordinates,inventory:a.inventory,task:a.task,failures:a.liveFailures,store:drying,candidates:liveCandidates(view(),a,candidateActions(view(),a)).slice(0,6)},null,2));
assert(lit&&warmed,'the full preparation chain must reach real fire and positive warmth');
assert(totals(w.wood).dryKg<before.dryKg,'warming burns finite fuel');
console.log(JSON.stringify({shelterAfterMinutes:builtAt-seedTime,dryingHours:dryHours,warmth:a.needs.warmth,completed:[...completed]}));

// Actual cold outliers can carry shelter supplies back to a known empty camp;
// they cannot discover strangers or receive remote protection automatically.
({w,a,h,pile}=fixture());woodCommand(householdWorld(w,a),a,{from:{kind:'stored',id:pile.id},quantity:2,category:'any',reason:'finite return supplies'});
a.coordinates={x:h.x-56,y:h.y-13};a.knownCamps=[h.id];a.campId=h.id;
assert(returnCandidate(householdWorld(w,a),a),'four branches make returning to a known empty building site useful');
const unknown=w.frontier.homes.find(x=>x.id==='ochre-vale');a.coordinates={x:unknown.x-20,y:unknown.y};assert.notEqual(returnCandidate(householdWorld(w,a),a)?.job.campId,unknown.id);

// No available material is not permission to invent it or endlessly retry a
// blocked supply. Critical hunger can interrupt a cold preparation task.
({w,a,h,pile}=fixture());const offer=coldPreparationCandidates(householdWorld(w,a),a)[0];a.liveFailures={[offer.id]:{at:clock(w),retryMinutes:10}};
assert(!coldPreparationCandidates(householdWorld(w,a),a).some(c=>c.id===offer.id));
a.inventory.berries=2;a.needs.hunger=3;await step(w,6);assert.equal(a.task.actionId,'eat_berries');
console.log('PASS wet-wood shelter bootstrap, finite material handling, real covered drying/fire/warming, checkpoint progress, empty-camp return, failure cooldown and urgent food');
