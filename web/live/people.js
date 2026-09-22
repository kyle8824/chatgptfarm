import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
const material=color=>new T.MeshStandardMaterial({color,roughness:.88});
function part(parent,geometry,mat,x,y,z,scale){const o=new T.Mesh(geometry,mat);o.position.set(x,y,z);if(scale)o.scale.set(...scale);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
const ball=new T.SphereGeometry(1,24,16);
const detailBall=new T.SphereGeometry(1,12,8);
function sphere(parent,mat,x,y,z,sx,sy=sx,sz=sx){return part(parent,Math.max(sx,sy,sz)<.1?detailBall:ball,mat,x,y,z,[sx,sy,sz]);}
function curve(parent,mat,points,radius){return part(parent,new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),12,radius,6,false),mat,0,0,0);}
export function createPerson(id,name){
 const group=new T.Group();group.userData.agentId=id;
 // A continuous body hit area keeps mobile taps forgiving around the neck,
 // fingers and joints, where the detailed visible meshes contain small gaps.
 const hitArea=new T.Mesh(new T.CapsuleGeometry(.34,1.32,4,8),new T.MeshBasicMaterial({visible:false}));hitArea.position.y=.98;group.add(hitArea);
 const mara=name==='Mara',skin=material(mara?'#c99778':'#d3a47f'),shirt=material(mara?'#c48c61':'#598d91'),cuff=material(mara?'#ead4ac':'#aed0c3'),pants=material(mara?'#59634f':'#435966'),hair=material(mara?'#573b2c':'#392c25'),leather=material('#69503b'),sole=material('#3c352d'),white=material('#fff5de'),iris=material(mara?'#63836a':'#725338'),dark=material('#292a25'),lip=material('#975e50');
 const body=new T.Group();group.add(body);
 const torso=part(body,new T.CapsuleGeometry(.235,.38,6,16),shirt,0,1.04,0,[1.1,1,.75]);
 // Neck, collar, seams and a small fastening retain detail when zoomed in.
 sphere(body,skin,0,1.40,0,.09,.13,.09);
 part(body,new T.TorusGeometry(.105,.035,8,24),cuff,0,1.37,.005).rotation.x=Math.PI/2;
 curve(body,cuff,[[0,1.34,.175],[0,1.22,.19],[0,1.08,.185]],.012);
 sphere(body,leather,0,1.27,.20,.023);
 const head=new T.Group();head.position.set(0,1.68,0);body.add(head);
 sphere(head,skin,0,0,0,.255,.29,.235);
 for(const side of [-1,1]){
  sphere(head,skin,side*.25,-.02,-.015,.058,.085,.048);
  sphere(head,lip,side*.273,-.02,.017,.018,.04,.012);
 }
 const eyes=[];
 for(const side of [-1,1]){
  const eye=new T.Group();eye.position.set(side*.091,.029,.219);head.add(eye);eyes.push(eye);
  sphere(eye,white,0,0,0,.057,.036,.018);
  sphere(eye,iris,side*.003,0,.016,.024,.028,.012);
  sphere(eye,dark,side*.003,0,.026,.012,.019,.007);
  sphere(eye,white,-.006,.010,.032,.006);
  curve(head,hair,[[side*.045,.091,.225],[side*.092,.105,.220],[side*.14,.087,.201]],.013);
 }
 sphere(head,skin,0,-.03,.246,.044,.062,.056);
 curve(head,lip,[[-.064,-.119,.208],[0,-.130,.225],[.064,-.119,.208]],.009);
 sphere(head,skin,0,-.185,.154,.12,.074,.06);
 part(head,new T.SphereGeometry(.273,24,16,0,Math.PI*2,0,1.21),hair,0,.022,-.012,[1,1.04,.94]);
 sphere(head,hair,0,.009,-.105,.245,.255,.158);
 if(mara){sphere(head,hair,0,.085,-.29,.13,.15,.13);part(head,new T.TorusGeometry(.10,.016,6,20),cuff,0,.085,-.28);}
 else for(let i=0;i<3;i++)sphere(head,hair,-.15+i*.11,.23-i*.012,.102,.085,.045,.07);
 const limbs=[],knees=[],elbows=[];
 for(const side of [-1,1]){
  const leg=new T.Group();leg.position.set(side*.14,.76,0);group.add(leg);
  part(leg,new T.CapsuleGeometry(.089,.18,4,12),pants,0,-.12,0);
  const knee=new T.Group();knee.position.set(0,-.30,0);leg.add(knee);knees.push(knee);sphere(knee,pants,0,0,0,.079);
  part(knee,new T.CapsuleGeometry(.077,.17,4,12),pants,0,-.12,0);
  part(knee,new RoundedBoxGeometry(.20,.18,.32,3,.055),leather,0,-.36,.055);
  part(knee,new RoundedBoxGeometry(.205,.05,.325,2,.02),sole,0,-.43,.055);
  limbs.push(leg);
  const arm=new T.Group();arm.position.set(side*.295,1.29,0);body.add(arm);
  part(arm,new T.CapsuleGeometry(.079,.15,4,12),shirt,side*.016,-.12,0);
  const elbow=new T.Group();elbow.position.set(side*.016,-.26,0);arm.add(elbow);elbows.push(elbow);
  part(elbow,new T.CapsuleGeometry(.063,.095,4,12),shirt,0,-.075,0);
  part(elbow,new T.CylinderGeometry(.069,.069,.06,12),cuff,0,-.155,0);
  sphere(elbow,skin,0,-.22,.009,.064,.079,.050);
  sphere(elbow,skin,-side*.047,-.202,.033,.023,.044,.025);limbs.push(arm);
 }
 const bag=part(body,new RoundedBoxGeometry(.34,.40,.17,3,.045),leather,0,1.055,-.23);
 part(body,new RoundedBoxGeometry(.33,.12,.19,3,.03),material('#876a4a'),0,1.21,-.235);
 for(const side of [-1,1])curve(body,leather,[[side*.18,1.34,-.18],[side*.22,1.31,.12],[side*.19,.90,.14]],.025);
 return {group,limbs,kind:'human',pos:null,target:null,walk:0,rig:{body,torso,head,eyes,knees,elbows,bag},blinkOffset:mara?1:3};
}
export function animatePerson(e,time,dt,walking,fresh){
 const r=e.rig;if(!r||!fresh)return;const action=e.action,working=e.phase==='work',drink=working&&action==='drink',gather=working&&/^(gather_|forage:|survey:)/.test(action||''),rest=working&&action==='rest',eat=working&&action?.startsWith('eat_');
 const blend=Math.min(1,dt*10),approach=(o,k,n)=>o[k]+=(n-o[k])*blend,clamp=n=>Math.max(0,Math.min(1,n)),ease=n=>{n=clamp(n);return n*n*(3-2*n);};
 const cycle=(time*.28)%1,sip=drink?(cycle<.7?ease((cycle-.25)/.20):1-ease((cycle-.7)/.3)):0;
 const hip=drink?.35:gather?.43:rest?.30:.76,lean=drink?1.85-sip*1.60:gather?.7:rest?-.08:0;
 // Rotate around the hips. Feet stay on the bank while the torso leans out
 // over the water; the scoop and sip stages use the same articulated arms.
 approach(r.body.rotation,'x',lean);approach(r.body.position,'y',hip-.76*Math.cos(lean));approach(r.body.position,'z',-.76*Math.sin(lean));
 r.torso.scale.y=1+Math.sin(time*1.8)*.008;
 for(let sideIndex=0;sideIndex<2;sideIndex++){
  const side=sideIndex===0?-1:1,leg=e.limbs[sideIndex*2],arm=e.limbs[sideIndex*2+1],knee=r.knees[sideIndex],elbow=r.elbows[sideIndex];
  approach(leg.position,'y',hip);
  if(drink||gather||rest){
   // Two-bone leg geometry solved to a planted sole, rather than scaling or
   // lifting the character's body and leaving floating boots.
   const forward=rest?.36:.08,down=hip-.03,upper=.30,lower=.43;
   const bend=-Math.acos(Math.max(-1,Math.min(1,(forward*forward+down*down-upper*upper-lower*lower)/(2*upper*lower))));
   const thigh=Math.atan2(forward,down)-Math.atan2(lower*Math.sin(bend),upper+lower*Math.cos(bend));
   approach(leg.rotation,'x',-thigh);approach(knee.rotation,'x',-bend);
  }else{
   const swing=walking?Math.sin(e.walk+sideIndex*Math.PI)*.46:0;approach(leg.rotation,'x',swing);approach(knee.rotation,'x',walking?Math.max(0,-swing)*.5:0);
  }
  let armAngle=walking?-Math.sin(e.walk+sideIndex*Math.PI)*.46:0,elbowAngle=0;
  if(drink){armAngle=-lean-sip*1.65;elbowAngle=-.08-sip*1.12;}
  else if(gather)armAngle=-.8+Math.sin(time*2.5+side)*.25;
  else if(rest)armAngle=-.35;
  else if(eat&&side===1){armAngle=-1.9;elbowAngle=-1.15;}
  approach(arm.rotation,'x',armAngle);approach(arm.rotation,'z',drink?-side*(.42+sip*.30):0);approach(elbow.rotation,'x',elbowAngle);
 }
 approach(r.head.rotation,'x',drink?-.1:gather?.16:0);
 const blink=((time+e.blinkOffset)%4.9)<.13;for(const eye of r.eyes)eye.scale.y=blink?.12:1;
}
