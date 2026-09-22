import * as T from 'three';
import {createVillager} from '../../shared/visuals/models.js';

// The workshop owns geometry; this adapter translates actual task state into
// physical poses. It never invents travel, task progress or inventory.
export function createPerson(id,name){
 const m=createVillager(name),group=m.root;group.userData.agentId=id;group.scale.setScalar(name==='Ivo'?1.10:1);
 const hit=new T.Mesh(new T.CapsuleGeometry(.30,1.10,4,8),new T.MeshBasicMaterial({visible:false}));hit.position.y=.88;group.add(hit);
 const cargoAnchor=new T.Group();cargoAnchor.position.set(0,.32,-.25);m.torso.add(cargoAnchor);
 return {group,model:m,kind:'human',pos:null,target:null,walk:0,blinkOffset:name==='Mara'?1.2:3.1,rig:{body:m.torso,hips:m.hips,torso:m.torso,head:m.head,eyes:m.eyes,bag:m.bag,cargoAnchor},limbs:[m.legs[0],m.arms[0],m.legs[1],m.arms[1]]};
}
const approach=(old,target,blend)=>old+(target-old)*blend;
export function animatePerson(e,time,dt,walking,fresh){
 if(!fresh)return;const m=e.model,work=e.phase==='work'&&!walking,drink=work&&e.action==='drink',gather=work&&/^(gather_|forage:|survey:|building|handling_supplies)/.test(e.action||''),rest=work&&e.action==='rest',eat=work&&/^eat_/.test(e.action||'');
 const blend=1-Math.exp(-dt*10),cycle=(time*.28)%1,sip=drink?Math.sin(Math.min(1,Math.max(0,(cycle-.18)/.62))*Math.PI):0;
 const hip=drink?.42:gather?.56:rest?.38:.813,lean=drink?1.36-sip*1.22:gather?.62:rest?-.08:0;
 m.hips.position.y=approach(m.hips.position.y,hip+(walking?Math.abs(Math.sin(e.walk))*.010:0),blend);m.torso.rotation.x=approach(m.torso.rotation.x,lean,blend);
 m.head.rotation.x=approach(m.head.rotation.x,drink?-.12:gather?.12:0,blend);m.head.rotation.y=Math.sin(time*.55+e.blinkOffset)*(walking?.02:.05);
 for(let i=0;i<2;i++){
  const leg=m.legs[i],shin=leg.userData.shin,arm=m.arms[i],fore=arm.userData.fore,phase=e.walk+i*Math.PI;
  let thigh=0,knee=0;
  if(drink||gather||rest){
   const upper=.365,lower=.34,forward=rest?.32:drink?.12:.06,down=m.hips.position.y-.015-.093;
   const bend=-Math.acos(T.MathUtils.clamp((forward*forward+down*down-upper*upper-lower*lower)/(2*upper*lower),-.999,.999));
   thigh=-(Math.atan2(forward,down)-Math.atan2(lower*Math.sin(bend),upper+lower*Math.cos(bend)));knee=-bend;
  }else if(walking){thigh=-Math.sin(phase)*.38;knee=Math.max(0,Math.cos(phase))*.43;}
  leg.rotation.x=approach(leg.rotation.x,thigh,blend);shin.rotation.x=approach(shin.rotation.x,knee,blend);
  leg.userData.foot.rotation.x=walking?0:-leg.rotation.x-shin.rotation.x;
  const armAngle=drink?-m.torso.rotation.x-sip*1.65:gather?-.75+Math.sin(time*3+i*.3)*.24:rest?-.30:eat&&i===1?-1.9:walking?Math.sin(phase)*.32:Math.sin(time+i)*.015;
  arm.rotation.x=approach(arm.rotation.x,armAngle,blend);arm.rotation.z=approach(arm.rotation.z,(i?1:-1)*(drink?.18:.065),blend);
  fore.rotation.x=approach(fore.rotation.x,drink?-.08-sip*1.12:gather?-.70:eat&&i===1?-1.15:-.06,blend);
 }
 const blink=(time+e.blinkOffset)%5.3<.1;m.eyes.forEach(eye=>eye.scale.y=blink?.09:1);
}
