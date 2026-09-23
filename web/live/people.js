import * as T from 'three';
import {createVillager} from '../../shared/visuals/models.js';

// The workshop owns geometry; this adapter translates actual task state into
// physical poses. It never invents travel, task progress or inventory.
export function createPerson(id,name,life=null){
 if(life?.stage==='infant')return createInfant(id,name);
 const m=createVillager(life?(life.sex==='female'?'Mara':'Ivo'):name),group=m.root;group.userData.agentId=id;group.scale.setScalar(personScale(name,life));
 const hit=new T.Mesh(new T.CapsuleGeometry(.30,1.10,4,8),new T.MeshBasicMaterial({visible:false}));hit.position.y=.88;group.add(hit);
 const cargoAnchor=new T.Group();cargoAnchor.position.set(0,0,-.215);m.torso.add(cargoAnchor);
 return {group,model:m,kind:'human',pos:null,target:null,walk:0,blinkOffset:name==='Mara'?1.2:3.1,rig:{body:m.torso,hips:m.hips,torso:m.torso,head:m.head,eyes:m.eyes,bag:m.bag,cargoAnchor},limbs:[m.legs[0],m.arms[0],m.legs[1],m.arms[1]]};
}
export function personScale(name,life){const grown=(life?life.sex==='male':name==='Ivo')?1.10:1;return grown*(life&&life.ageYears<18?.48+life.ageYears/18*.52:1);}
function createInfant(id,name){
 const group=new T.Group();group.name=name;group.userData.agentId=id;
 const piece=(color,size,pos)=>{const m=new T.Mesh(new T.SphereGeometry(1,16,12),new T.MeshStandardMaterial({color,roughness:.9}));m.scale.set(...size);m.position.set(...pos);m.castShadow=m.receiveShadow=true;group.add(m);return m;};
 piece('#b0bbaa',[.15,.26,.12],[0,.22,0]);piece('#d8a482',[.105,.115,.10],[0,.48,.015]);piece('#72513b',[.10,.05,.085],[0,.56,0]);
 for(const x of [-.038,.038])piece('#44362e',[.012,.009,.008],[x,.49,.108]);piece('#b87f6c',[.024,.008,.009],[0,.435,.11]);
 const hit=new T.Mesh(new T.CapsuleGeometry(.17,.34,4,8),new T.MeshBasicMaterial({visible:false}));hit.position.y=.3;group.add(hit);
 return {group,model:{infant:true,root:group},kind:'human',pos:null,target:null,walk:0,rig:null};
}
const approach=(old,target,blend)=>old+(target-old)*blend;
const downAxis=new T.Vector3(0,-1,0);
// Solve the articulated upper arm and forearm to a real contact point. The
// elbow pole keeps elbows below/outside the hands instead of raising both arms.
function aimBones(joint,lowerJoint,target,upper,lower,pole,blend){
 const direction=target.clone().sub(joint.position),length=T.MathUtils.clamp(direction.length(),Math.abs(upper-lower)+.001,upper+lower-.001);direction.normalize();
 const along=(upper*upper-lower*lower+length*length)/(2*length),height=Math.sqrt(Math.max(0,upper*upper-along*along));
 pole.addScaledVector(direction,-pole.dot(direction)).normalize();
 const elbow=direction.clone().multiplyScalar(along).addScaledVector(pole,height),end=direction.clone().multiplyScalar(length);
 const shoulderQ=new T.Quaternion().setFromUnitVectors(downAxis,elbow.clone().normalize());
 const foreDirection=end.sub(elbow).normalize().applyQuaternion(shoulderQ.clone().invert()),foreQ=new T.Quaternion().setFromUnitVectors(downAxis,foreDirection);
 joint.quaternion.slerp(shoulderQ,blend);lowerJoint.quaternion.slerp(foreQ,blend);
}

export function personAction(task){const kind=task?.job?.kind;return ['relax','rest'].includes(kind)?'rest':['conversation','courtship','commitment','family_plan','private_time'].includes(kind)?'conversation':kind==='care'?'care':kind==='hand_game'?'hand_game':kind==='study'?'observe':kind==='visit'?'visit':kind==='assemble'||kind==='repair'?'building':kind==='harvest'?'gather_timber':kind?'handling_supplies':task?.actionId;}

export function animatePerson(e,time,dt,walking,fresh){
 if(!fresh||e.model.infant)return;const m=e.model,work=e.phase==='work'&&!walking,drink=work&&e.action==='drink',gather=work&&/^(gather_|forage:|survey:|building|handling_supplies)/.test(e.action||''),rest=work&&e.action==='rest',social=work&&['conversation','hand_game','care'].includes(e.action),eat=work&&/^eat_/.test(e.action||'');
 const blend=1-Math.exp(-dt*10),cycle=(time*.28)%1,ease=x=>{x=T.MathUtils.clamp(x,0,1);return x*x*(3-2*x);},sip=drink?(cycle<.7?ease((cycle-.25)/.20):1-ease((cycle-.7)/.3)):0;
 let scoopHip=.35;
 if(drink&&e.waterPoint){m.root.updateMatrixWorld(true);const water=m.root.worldToLocal(e.waterPoint.clone()),forward=water.z-.418*Math.sin(1.85),side=Math.abs(water.x)+(m.female?.183:.217)-.034,maxDrop=Math.sqrt(Math.max(.01,.52*.52-forward*forward-side*side));scoopHip=T.MathUtils.clamp(water.y+maxDrop-.418*Math.cos(1.85),.16,.35);}
 const posture=rest?(e.restSupport?.posture||'ground'):null,lying=posture==='lie',seat=posture==='seat',scale=e.group.scale.y||1;
 const hip=drink?scoopHip:gather?.56:lying?(e.restSupport.height||0)/scale+.11:seat?(e.restSupport.height||0)/scale+.08:rest?.095:.813,lean=drink?1.85-sip*1.60:gather?.62:rest&&!lying?-.08:0;
 m.hips.rotation.x=approach(m.hips.rotation.x,lying?-Math.PI/2:0,blend);
 m.bag.rotation.y=approach(m.bag.rotation.y,lying?Math.PI:0,blend);if(e.rig.cargoAnchor){e.rig.cargoAnchor.position.z=lying?.215:-.215;e.rig.cargoAnchor.rotation.y=lying?Math.PI:0;}
 m.hips.position.y=approach(m.hips.position.y,hip+(walking?Math.abs(Math.sin(e.walk))*.010:0),blend);m.torso.rotation.x=approach(m.torso.rotation.x,lean,blend);
 m.head.rotation.x=approach(m.head.rotation.x,drink?-.12:gather?.12:0,blend);m.head.rotation.y=Math.sin(time*.55+e.blinkOffset)*(walking?.02:.05);
 let scoop,mouth;
 if(drink){m.root.updateMatrixWorld(true);scoop=e.waterPoint?e.waterPoint.clone():m.root.localToWorld(new T.Vector3(0,-.20,.58));scoop=m.torso.worldToLocal(scoop);mouth=m.torso.worldToLocal(m.head.localToWorld(new T.Vector3(0,-.08,.105)));}
 for(let i=0;i<2;i++){
  const leg=m.legs[i],shin=leg.userData.shin,arm=m.arms[i],fore=arm.userData.fore,phase=e.walk+i*Math.PI;
  let thigh=0,knee=0;
  if(drink||gather||rest&&!lying){
   const upper=.365,lower=.34,forward=rest?(seat?.34:.66):drink?.12:.06,down=m.hips.position.y-.015-.093;
   const bend=-Math.acos(T.MathUtils.clamp((forward*forward+down*down-upper*upper-lower*lower)/(2*upper*lower),-.999,.999));
   thigh=-(Math.atan2(forward,down)-Math.atan2(lower*Math.sin(bend),upper+lower*Math.cos(bend)));knee=-bend;
  }else if(walking){thigh=-Math.sin(phase)*.38;knee=Math.max(0,Math.cos(phase))*.43;}
  if(drink){aimBones(leg,shin,new T.Vector3((i?1:-1)*.23,.093-m.hips.position.y,.12),.365,.34,new T.Vector3((i?1:-1)*1.1,0,.6),blend);}
  else{leg.rotation.x=approach(leg.rotation.x,thigh,blend);shin.rotation.x=approach(shin.rotation.x,knee,blend);for(const axis of ['y','z']){leg.rotation[axis]=approach(leg.rotation[axis],0,blend);shin.rotation[axis]=approach(shin.rotation[axis],0,blend);}}
  if(walking)leg.userData.foot.quaternion.identity();else leg.userData.foot.quaternion.copy(leg.quaternion).multiply(shin.quaternion).invert();
  if(drink){const target=scoop.clone().lerp(mouth,sip);target.x+=(i?1:-1)*.034;aimBones(arm,fore,target,.25,.30,new T.Vector3((i?1:-1)*.7,-.8,.35),blend);}
  else{
   const armAngle=social?-.45+Math.sin(time*1.8+i)*.2:gather?-.75+Math.sin(time*3+i*.3)*.24:rest?-.30:eat&&i===1?-1.9:walking?Math.sin(phase)*.32:Math.sin(time+i)*.015;
   arm.rotation.x=approach(arm.rotation.x,armAngle,blend);arm.rotation.y=approach(arm.rotation.y,0,blend);arm.rotation.z=approach(arm.rotation.z,(i?1:-1)*.065,blend);
   fore.rotation.x=approach(fore.rotation.x,social?-.65:gather?-.70:eat&&i===1?-1.15:-.06,blend);fore.rotation.y=approach(fore.rotation.y,0,blend);fore.rotation.z=approach(fore.rotation.z,0,blend);
  }
 }
 const blink=(time+e.blinkOffset)%5.3<.1;m.eyes.forEach(eye=>eye.scale.y=blink?.09:1);
}
