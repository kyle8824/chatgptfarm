import {mapBounds} from '../shared/landscape.js';
import {distance} from '../engine/navigation.js';
import {liveWalkable,liveClear} from './motion.mjs';
import {waterBankPoints,withinWaterReach,riverY} from './water.mjs';

// Elapsed-time, species-specific rules. No model calls and no browser simulation.
// Existing individuals, positions, needs and histories are retained on upgrade.
export const SPECIES={
 deer:{label:'White-tailed deer',social:'Loose associations; family and bachelor groups',radius:.48,walk:.42,run:1.7,notice:15,panic:6,range:18},
 rabbit:{label:'Eastern cottontail',social:'Usually solitary; stays close to cover',radius:.18,walk:.30,run:1.35,notice:9,panic:3.6,range:5},
 bear:{label:'Black bear',social:'Usually solitary; avoids close encounters',radius:.65,walk:.38,run:1.1,notice:13,panic:5,range:26},
 fish:{label:'Creek fish school',social:'A school; members move together',radius:.12,walk:.38,run:.85,notice:4,panic:2,range:12}
};
const clamp=(n,a=0,b=100)=>Math.max(a,Math.min(b,n));
const hash=s=>{let h=2166136261;for(const c of String(s))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;};
const random=a=>{const b=a.liveWildlife;b.seed=(Math.imul(b.seed,1664525)+1013904223)>>>0;return b.seed/4294967296;};
function ensure(a){
 a.liveWildlife??={version:1,seed:hash(a.id),age:0,decideIn:0,hold:0,calmFor:0,alertUntil:0,mode:'observe',reason:'Assessing the surroundings',target:null,speed:0,facing:0,companions:[],blocked:0};
 a.needs??={energy:80,hunger:72,thirst:75};a.fear??=0;a.home??={...a.position};return a.liveWildlife;
}
function bounded(w,p){const b=mapBounds(w);return {x:clamp(p.x,b.minX+1,b.maxX-1),y:clamp(p.y,b.minY+1,b.maxY-1)};}
function clear(w,a,to){
 // Escape invalid old positions through elapsed motion, never relocate on load.
 if(!liveWalkable(w,a.position))return liveWalkable(w,to);
 return liveClear(w,a.position,to);
}
function cover(w,a,threat=null){
 const trees=(w.settlement?.trees||[]).filter(t=>!t.depleted&&distance(a.position,t.position)<22);
 const options=trees.map(t=>{const angle=Math.atan2(t.position.y-(threat?.y??a.position.y),t.position.x-(threat?.x??a.position.x));return {x:t.position.x+Math.cos(angle)*1.1,y:t.position.y+Math.sin(angle)*1.1};});
 const safe=options.filter(p=>liveWalkable(w,p)&&(!threat||distance(p,threat)>distance(a.position,threat)+1));
 safe.sort((p,q)=>(distance(p,a.position)+distance(p,a.home)*.15)-(distance(q,a.position)+distance(q,a.home)*.15));
 return safe.find(p=>clear(w,a,p))||null;
}
function escape(w,a,threat){
 const b=a.liveWildlife,base=Math.atan2(a.position.y-threat.y,a.position.x-threat.x)||hash(a.id)%6.28;
 const candidates=[];
 for(const turn of [0,.5,-.5,1,-1,1.5,-1.5]){
  const angle=base+turn,p=bounded(w,{x:a.position.x+Math.cos(angle)*4,y:a.position.y+Math.sin(angle)*4});
  if(distance(p,threat)>distance(a.position,threat)+.6&&clear(w,a,p))candidates.push(p);
 }
 const shelter=a.species==='rabbit'?cover(w,a,threat):null;
 if(shelter)return shelter;
 candidates.sort((p,q)=>distance(q,threat)-distance(p,threat));
 return candidates[0]||null;
}
function set(a,mode,reason,target=null,hold=12){
 const b=a.liveWildlife;b.mode=mode;b.reason=reason;b.target=target;b.hold=hold;
 const labels={flee:'bolting to cover',withdraw:'withdrawing from people',freeze:'frozen, listening',alert:'watching a disturbance',defend:'defensive warning',graze:'grazing',forage:'foraging',rest:'resting in cover',roam:'roaming',associate:'keeping near companions',water:'seeking water',drink:'drinking',swim:'following the creek',dart:'school scattering from disturbance',cover:'moving into cover'};
 a.behavior=labels[mode]||mode;a.activity={flee:'flee',withdraw:'move',freeze:'freeze',alert:'watch',defend:'defend',graze:'graze',forage:'forage',rest:'rest',drink:'drink',swim:'swim',dart:'swim'}[mode]||'move';
}
function perceived(w,a,animals){
 const s=SPECIES[a.species],threats=(w.agents||[]).filter(p=>p.coordinates).map(p=>({id:p.id,position:p.coordinates,kind:'person'}));
 if(['deer','rabbit'].includes(a.species))for(const p of animals)if(p.species==='bear')threats.push({id:p.id,position:p.position,kind:'bear'});
 return threats.map(p=>({...p,distance:distance(a.position,p.position)})).filter(p=>p.distance<s.notice).sort((p,q)=>p.distance-q.distance)[0];
}
function companions(a,animals){
 if(a.species!=='deer')return [];
 return animals.filter(p=>p.id!==a.id&&p.species==='deer'&&distance(a.position,p.position)<13&&(p.sex===a.sex||p.parentId===a.id||a.parentId===p.id||a.familyId&&a.familyId===p.familyId));
}
function choose(w,a,animals){
 const b=a.liveWildlife,s=SPECIES[a.species],threat=perceived(w,a,animals),peers=companions(a,animals);
 b.companions=peers.map(p=>p.id);b.threatId=threat?.id||null;
 const alarm=peers.find(p=>p.liveWildlife?.threatId&&['flee','alert'].includes(p.liveWildlife?.mode)&&distance(a.position,p.position)<8);
 if(threat){
  b.lastThreat={...threat.position};b.alertUntil=b.age+25;b.calmFor=0;
  a.fear=Math.max(a.fear,threat.distance<s.panic?95:55);b.facing=Math.atan2(threat.position.x-a.position.x,threat.position.y-a.position.y);
  if(threat.distance<s.panic){
   const exit=escape(w,a,threat.position);
   if(a.species==='bear'&&!exit&&threat.distance<3)return set(a,'defend','A close approach leaves no clear escape; warning while holding ground.',null,4);
   return set(a,a.species==='bear'?'withdraw':'flee',`${threat.kind==='bear'?'A nearby bear':'A nearby person'} is inside the flight distance.`,exit,8);
  }
  if(a.species==='rabbit')return set(a,'freeze','Remaining still while listening for the nearby disturbance.',null,5);
  if(a.species==='bear')return set(a,'withdraw','Avoiding a person while a route away is available.',escape(w,a,threat.position),8);
  return set(a,'alert','Head raised; checking a nearby disturbance before resuming feeding.',null,4);
 }
 if(alarm&&b.alertUntil<b.age){b.alertUntil=b.age+12;a.fear=Math.max(a.fear,45);return set(a,'alert','A nearby deer is alarmed; pausing to look and listen.',null,5);}
 if(b.age<b.alertUntil){
  if(['flee','withdraw'].includes(b.mode)&&b.target&&distance(a.position,b.target)>.4)return;
  return set(a,a.species==='rabbit'?'freeze':'alert','The disturbance has passed; remaining wary before relaxing.',null,4);
 }
 if(b.hold>0&&(!b.target||distance(a.position,b.target)>.35))return;
 const twilight=w.hour>=5&&w.hour<9||w.hour>=17&&w.hour<21,quietDay=w.hour>=9&&w.hour<17;
 if(a.species!=='rabbit'&&a.needs.thirst<38){
  if(withinWaterReach(w,a.position))return set(a,'drink','Water is physically within reach.',null,35);
  const bank=waterBankPoints(w,a.position).sort((p,q)=>distance(p,a.position)-distance(q,a.position)).find(p=>clear(w,a,p));
  if(bank)return set(a,'water','Moving to an accessible creek bank to drink.',bank,50);
 }
 if(a.needs.energy<35||(quietDay&&a.species!=='bear'&&a.needs.hunger>45)||w.weather==='rain'&&a.species==='rabbit'){
  const shelter=cover(w,a);if(shelter&&distance(a.position,shelter)>2)return set(a,'cover','Seeking nearby vegetation for a sheltered rest.',shelter,40);
  return set(a,'rest',quietDay?'Resting through the quieter daylight period.':'Recovering energy in a quiet place.',null,40+random(a)*60);
 }
 const peer=peers.find(p=>p.fear<35&&distance(a.position,p.position)>4);
 if(peer&&clear(w,a,peer.position)){
  const dx=a.position.x-peer.position.x,dy=a.position.y-peer.position.y,d=Math.hypot(dx,dy)||1;
  return set(a,'associate','Keeping a loose distance from a nearby compatible deer.',{x:peer.position.x+dx/d*3,y:peer.position.y+dy/d*3},20);
 }
 if(a.needs.hunger<65||random(a)<(twilight?.6:.35))return set(a,a.species==='bear'?'forage':'graze',a.species==='bear'?'Searching the ground for plant food and invertebrates.':'Browsing the local ground vegetation.',null,20+random(a)*35);
 for(let i=0;i<8;i++){
  const angle=random(a)*Math.PI*2,r=2+random(a)*(a.species==='rabbit'?3:9),p=bounded(w,{x:a.position.x+Math.cos(angle)*r,y:a.position.y+Math.sin(angle)*r});
  if(a.species==='rabbit'&&distance(p,a.home)>s.range)continue;
  if(clear(w,a,p))return set(a,'roam',twilight?'Active around dawn or dusk; moving between feeding spots.':'Exploring nearby habitat.',p,35);
 }
 set(a,'rest','No clear local route; pausing before trying a new direction.',null,8);
}
function move(w,a,animals,seconds){
 const b=a.liveWildlife,s=SPECIES[a.species],from={...a.position};b.speed=0;
 if(!b.target)return;
 let dx=b.target.x-from.x,dy=b.target.y-from.y,d=Math.hypot(dx,dy);if(d<.08){b.target=null;b.hold=0;return;}
 let vx=dx/d,vy=dy/d;
 // Local separation keeps groups from collapsing into a single sprite.
 for(const other of animals){if(other===a||other.species==='fish')continue;const gap=distance(from,other.position),space=s.radius+(SPECIES[other.species]?.radius||.4)+.35;
  if(gap<space&&gap>.001){vx+=(from.x-other.position.x)/gap*(space-gap)*2;vy+=(from.y-other.position.y)/gap*(space-gap)*2;}
 }
 const speed=['flee','withdraw'].includes(b.mode)?s.run:s.walk,amount=Math.min(d,speed*seconds),length=Math.hypot(vx,vy)||1;vx/=length;vy/=length;
 let next=null;for(const turn of [0,.45,-.45,.9,-.9,1.35,-1.35]){
  const x=vx*Math.cos(turn)-vy*Math.sin(turn),y=vx*Math.sin(turn)+vy*Math.cos(turn),p=bounded(w,{x:from.x+x*amount,y:from.y+y*amount});
  if(clear(w,a,p)&&!w.agents.some(person=>distance(p,person.coordinates)<s.radius+.45)&&!animals.some(other=>other!==a&&other.species!=='fish'&&distance(p,other.position)<s.radius+(SPECIES[other.species]?.radius||.4)&&distance(p,other.position)<distance(from,other.position)-.001)){next=p;break;}
 }
 if(next){a.previousPosition=from;a.position=next;b.speed=distance(from,next)/seconds;b.facing=Math.atan2(next.x-from.x,next.y-from.y);b.blocked=0;}
 else{b.blocked+=seconds;if(b.blocked>2){b.hold=0;b.decideIn=0;b.target=null;}}
}
function fishStep(w,a,seconds){
 const b=ensure(a);b.age+=seconds;b.direction??=hash(a.id)%2?1:-1;
 const near=(w.agents||[]).find(p=>distance(a.position,p.coordinates)<4),speed=near?.85:.32;
 const x=a.position.x;if(x<2&&b.direction<0||x>98&&b.direction>0)b.direction*=-1;
 if(near)b.direction=x<near.coordinates.x?-1:1;
 const nx=clamp(x+b.direction*speed*seconds,1,99),targetY=riverY(nx),dy=clamp(targetY-a.position.y,-speed*seconds,speed*seconds),from={...a.position};
 a.position={x:nx,y:a.position.y+dy};a.previousPosition=from;b.speed=distance(from,a.position)/seconds;b.facing=Math.atan2(nx-from.x,dy);b.threatId=near?.id||null;b.companions=[];
 set(a,near?'dart':'swim',near?'A disturbance at the bank makes the school move away.':'Moving along the creek channel as a school.');a.fear=clamp(a.fear+(near?10:-2)*seconds);
}
export function wildlifeStep(w,seconds){
 if(!(seconds>0&&seconds<=6.000001))throw Error('Invalid wildlife elapsed step');
 const animals=(w.ecologySystem?.wildlife||[]).filter(a=>a.active&&SPECIES[a.species]);
 for(const a of animals){if(a.species==='fish'){fishStep(w,a,seconds);continue;}
  const b=ensure(a);b.age+=seconds;b.hold-=seconds;b.decideIn-=seconds;b.calmFor+=seconds;
  a.fear=clamp(a.fear-seconds*(a.species==='bear'?.7:1.2));
  if(b.decideIn<=0){choose(w,a,animals);b.decideIn=1.5;}
  move(w,a,animals,seconds);
  const hours=seconds/3600,n=a.needs;n.hunger=clamp(n.hunger-hours*1.8);n.thirst=clamp(n.thirst-hours*(a.species==='rabbit'?.35:1.2));n.energy=clamp(n.energy-hours*(b.speed>0?4:.5));
  if(['rest','freeze'].includes(b.mode))n.energy=clamp(n.energy+hours*8);
  if(['graze','forage'].includes(b.mode)){n.hunger=clamp(n.hunger+hours*18);if(a.species==='rabbit')n.thirst=clamp(n.thirst+hours*6);}
  if(b.mode==='drink'&&withinWaterReach(w,a.position))n.thirst=clamp(n.thirst+seconds*.25);
 }
}
export function wildlifeFrame(w){return (w.ecologySystem?.wildlife||[]).filter(a=>a.active).map(a=>({id:a.id,species:a.species,label:a.label||SPECIES[a.species]?.label,position:a.position,behavior:a.behavior,activity:a.activity,sex:a.sex||null,ageClass:a.ageClass||'adult',needs:a.needs,fear:a.fear||0,social:SPECIES[a.species]?.social||'',reason:a.liveWildlife?.reason||'Observing the surroundings',companions:a.liveWildlife?.companions||[],motion:{speed:a.liveWildlife?.speed||0,facing:a.liveWildlife?.facing||0},mode:a.liveWildlife?.mode||'idle'}));}
