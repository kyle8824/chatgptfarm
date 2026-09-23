import * as T from 'three';
import {CREEK_POINTS} from '../../realtime/water.mjs';
const invisible=new T.MeshBasicMaterial({visible:false,side:T.DoubleSide});
const sphere=new T.SphereGeometry(1,12,8),cylinder=new T.CylinderGeometry(1,1,1,10),box=new T.BoxGeometry(1,1,1);
const materials=new Map(),material=color=>{if(!materials.has(color))materials.set(color,new T.MeshStandardMaterial({color,roughness:1}));return materials.get(color);};
function piece(g,geo,color,p,s){const m=new T.Mesh(geo,material(color));m.position.set(...p);m.scale.set(...s);m.castShadow=m.receiveShadow=true;g.add(m);return m;}
function hit(g,p,s,geometry=box){const m=new T.Mesh(geometry,invisible);m.position.set(...p);m.scale.set(...s);g.add(m);}
export class NaturalObjects{
 constructor(scene,elevation){this.scene=scene;this.elevation=elevation;this.objects=new Map();}
 update(frame){
  const list=[...(frame.objects||[]),...(frame.settlement?.trees||[]).map(t=>({...t,type:'tree',radius:.7,name:t.pine?'Evergreen':'Broadleaf tree'}))],ids=new Set(list.map(o=>o.id));
  for(const o of list){const signature=JSON.stringify([o.type,o.remaining,o.height,o.mapped]),old=this.objects.get(o.id);if(old?.signature===signature)continue;if(old)this.scene.remove(old.group);
   const g=new T.Group();g.position.set(o.position.x,this.elevation(o.position.x,o.position.y),o.position.y);g.userData.objectId=o.id;g.userData.natural=true;this.scene.add(g);this.objects.set(o.id,{group:g,signature,data:o});
   if(o.type==='tree'){const h=o.remaining?o.height||5:.4;hit(g,[0,h*.48,0],[Math.max(.7,h*.20),h*.5,Math.max(.7,h*.20)],sphere);continue;}
   if(o.type==='water'){
    const waterPoints=o.points||CREEK_POINTS;for(let i=1;i<waterPoints.length;i++){const [x,z]=waterPoints[i-1],[bx,bz]=waterPoints[i],length=Math.hypot(bx-x,bz-z),m=new T.Mesh(box,invisible);m.position.set((x+bx)/2-o.position.x,-.13-g.position.y,(z+bz)/2-o.position.y);m.scale.set(length,.06,2.5);m.rotation.y=-Math.atan2(bz-z,bx-x);g.add(m);}continue;
   }
   const extraBerry=o.type==='berries'&&o.id!=='OBJ-BERRIES-001';
   if(o.type==='log'&&o.id!=='OBJ-TREE-001'){const m=piece(g,cylinder,'#775638',[0,.3,0],[.32,2.8,.32]);m.rotation.z=Math.PI/2;}
   if(o.mapped||extraBerry){
    const count=o.type==='berries'?4:Math.max(1,Math.min(7,Math.ceil(o.remaining/3)));
    for(let i=0;i<count;i++){
     const ang=i*2.4,x=Math.sin(ang)*(.3+i*.11),z=Math.cos(ang)*(.3+i*.11),y=this.elevation(o.position.x+x,o.position.y+z)-g.position.y;
     if(['stones','flint','resin'].includes(o.type)){const size=o.remaining?.19+(i%3)*.07:.06;const m=piece(g,sphere,o.type==='resin'?'#b88938':o.type==='flint'?'#5e6668':i%2?'#939c8b':'#a6ac98',[x,y+size*.55,z],[size*1.3,size*.7,size]);m.rotation.y=ang;}
     else if(['reeds','longFiber'].includes(o.type)){if(!o.remaining)continue;for(let j=0;j<3;j++){const h=.6+(i%3)*.15;piece(g,cylinder,'#819155',[x+j*.1,y+h/2,z],[.014,h,.014]);piece(g,cylinder,'#7d6844',[x+j*.1,y+h*.93,z],[.035,.2,.035]);}}
     else if(['clay','potteryClay'].includes(o.type))piece(g,sphere,'#a47b57',[x,y+.02,z],[.45,.09,.32]);
     else if(o.type==='berries'){piece(g,sphere,'#446b45',[x,y+.34,z],[.55,.45,.5]);if(o.remaining>0)for(let j=0;j<3;j++)piece(g,sphere,'#ad5247',[x+(j-1)*.19,y+.72,z+.12],[.07,.07,.07]);}
    }
   }
   hit(g,[0,o.type==='reeds'?.5:.35,0],[o.radius||1.4,o.type==='reeds'?.7:.6,o.radius||1.4],sphere);
  }
  for(const [id,o]of this.objects)if(!ids.has(id)){this.scene.remove(o.group);this.objects.delete(id);}
 }
}
