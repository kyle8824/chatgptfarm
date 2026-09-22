import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {riverY} from '../../realtime/water.mjs';
const colors={timber:'#96724c',stone:'#969b90',reeds:'#b3a171'};
const box=new T.BoxGeometry(1,1,1),ball=new T.SphereGeometry(1,10,8),log=new T.CylinderGeometry(.075,.1,1,10);
const materials=new Map();const material=(c,vertexColors=false)=>{const key=c+vertexColors;if(!materials.has(key))materials.set(key,new T.MeshStandardMaterial({color:c,roughness:.9,vertexColors}));return materials.get(key);};
function piece(group,geometry,color,position,scale=[1,1,1]){const m=new T.Mesh(geometry,material(color,!!geometry.getAttribute('color')));m.position.set(...position);m.scale.set(...scale);m.castShadow=m.receiveShadow=true;group.add(m);return m;}
const components=new Map();
function componentGeometry(part){
 if(part.material!=='timber'||!['wall','deck','roof'].includes(part.kind))return box;
 const key=part.kind+part.size.join(',');if(components.has(key))return components.get(key);
 // Board seams and slight timber variation describe the assembled panel;
 // one merged mesh per physical part keeps the mobile draw count bounded.
 const axis=part.kind==='wall'?(part.size[0]>part.size[2]?0:2):0,count=Math.max(2,Math.min(18,Math.ceil(part.size[axis]/.2))),geos=[];
 for(let i=0;i<count;i++){const size=[1,1,1],offset=[0,0,0];size[axis]=1/count-.007/part.size[axis];offset[axis]=-.5+(i+.5)/count;const g=new T.BoxGeometry(...size);g.translate(...offset);const colors=[],shade=.90+((i*7+3)%11)*.019;for(let v=0;v<g.attributes.position.count;v++)colors.push(shade,shade,shade);g.setAttribute('color',new T.Float32BufferAttribute(colors,3));geos.push(g);}
 const geometry=mergeGeometries(geos);geos.forEach(g=>g.dispose());components.set(key,geometry);return geometry;
}
export function drawContents(group,inventory,{carried=false,limit=20}={}){
 let index=0;for(const [key,value]of Object.entries(inventory||{})){for(let n=0;n<Math.min(Math.floor(value),carried?3:8)&&index<limit;n++,index++){
  const x=((index%4)-1.5)*.20,y=Math.floor(index/8)*.16+.1,z=(Math.floor(index/4)%2-.5)*.22;
  if(/Wood|Pole/.test(key)){const m=piece(group,log,key==='wetWood'?'#73563b':'#a58456',[x,y,z],[1,carried?.65:1,1]);m.rotation.z=Math.PI/2;m.rotation.y=.2;}
  else if(/berries|Meat|tubers/.test(key))piece(group,ball,key==='berries'?'#b75245':'#bb9465',[x,y,z],[.105,.075,.09]);
  else if(key==='reeds'||key==='cordage')piece(group,box,'#b4a66e',[x,y,z],[.05,.06,.65]);
  else piece(group,ball,key==='clay'?'#ae805b':'#929a92',[x,y,z],[.12,.11,.1]);
 }}return index;
}
export class SettlementView{
 constructor(scene,elevation){this.scene=scene;this.elevation=elevation;this.objects=new Map();this.data=null;}
 base(p){return p.purpose==='bridge'?Math.max(this.elevation(p.position.x,riverY(p.position.x)-2),this.elevation(p.position.x,riverY(p.position.x)+2))+.04:this.elevation(p.position.x,p.position.y);}
 update(data,agents=[]){if(!data)return;this.data=data;const live=new Set();
  for(const p of data.projects){live.add(p.id);const open=!!p.storeId&&agents.some(a=>a.task?.job?.storeId===p.storeId&&a.task.phase==='work'),signature=JSON.stringify([p.parts.map(x=>[x.built,Math.floor(x.workMinutes/x.requiredMinutes*12)]),p.status,open]);let obj=this.objects.get(p.id);if(obj?.signature===signature)continue;if(obj)this.remove(p.id);
   const g=new T.Group();g.position.set(p.position.x,this.base(p),p.position.y);g.userData.objectId=p.id;this.scene.add(g);
   for(const part of p.parts){
    if(part.built||part.invested){let parent=g,center=part.center;if(open&&part.kind==='roof'&&p.purpose==='storage'){parent=new T.Group();parent.position.set(part.center[0],part.center[1],part.center[2]-part.size[2]/2);parent.rotation.x=-1.15;g.add(parent);center=[0,0,part.size[2]/2];}const m=piece(parent,componentGeometry(part),colors[part.material],center,part.size);if(!part.built){m.scale.y*=Math.max(.08,part.workMinutes/part.requiredMinutes);m.position.y=part.center[1]-part.size[1]/2+m.scale.y/2;}}
    if(!part.built){const geo=new T.EdgesGeometry(box),line=new T.LineSegments(geo,new T.LineBasicMaterial({color:'#d7cb95',transparent:true,opacity:.24}));line.position.set(...part.center);line.scale.set(...part.size);g.add(line);}
   }
   const hit=new T.Mesh(new T.BoxGeometry(p.bounds.maxX-p.bounds.minX,1.5,p.bounds.maxZ-p.bounds.minZ),new T.MeshBasicMaterial({visible:false}));hit.position.y=.75;g.add(hit);this.objects.set(p.id,{group:g,signature});
  }
  for(const s of data.stores){live.add(s.id);const signature=JSON.stringify([s.items,s.secured,s.revision]);let obj=this.objects.get(s.id);if(obj?.signature===signature)continue;if(obj)this.remove(s.id);
   const g=new T.Group();g.position.set(s.position.x,this.elevation(s.position.x,s.position.y)+.025,s.position.y);g.userData.objectId=s.id;this.scene.add(g);
   if(s.kind!=='storage'){
    piece(g,box,s.kind==='site'?'#9f865d':'#b9a57a',[0,.025,0],[1.1,.05,.85]);
    for(const x of [-.6,.6])for(const z of [-.48,.48])piece(g,box,'#8c6945',[x,.20,z],[.055,.4,.055]);
   }
   const contents=new T.Group();contents.position.y=s.kind==='storage'?.3:.07;g.add(contents);drawContents(contents,s.items);
   // A small ownership pennant is visible, while inspection supplies names.
   piece(g,box,s.ownerId?.endsWith('mara')?'#c99a68':s.ownerId?'#80b1b1':'#d7d4b0',[-.48,.42,-.37],[.18,.22,.025]);
   if(s.secured)piece(g,box,'#d9b872',[0,.58,.55],[.12,.16,.07]);
   const hit=new T.Mesh(new T.BoxGeometry(1.3,1.1,1.2),new T.MeshBasicMaterial({visible:false}));hit.position.y=.55;g.add(hit);this.objects.set(s.id,{group:g,signature});
  }
  for(const id of this.objects.keys())if(!live.has(id))this.remove(id);
 }
 remove(id){const obj=this.objects.get(id);if(!obj)return;this.scene.remove(obj.group);obj.group.traverse(m=>{if(m.isLineSegments){m.geometry.dispose();m.material.dispose();}else if(m.isMesh&&!m.material.visible){m.geometry.dispose();m.material.dispose();}});this.objects.delete(id);}
 elevationAt(x,z){for(const p of this.data?.projects||[])if(p.purpose==='bridge')for(const part of p.parts){if(!part.built||part.kind!=='deck')continue;const [cx,y,cz]=part.center,[sx,sy,sz]=part.size;if(Math.abs(x-p.position.x-cx)<=sx/2+.05&&Math.abs(z-p.position.y-cz)<=sz/2+.05)return this.base(p)+y+sy/2;}return this.elevation(x,z);}
}
export function updateCargo(person,inventory){const signature=JSON.stringify(inventory||{});if(person.cargoSignature===signature)return;person.cargoSignature=signature;const r=person.rig;if(!r)return;
 if(r.cargo)r.body.remove(r.cargo);r.cargo=new T.Group();r.cargo.position.set(0,1.18,-.36);r.body.add(r.cargo);drawContents(r.cargo,inventory,{carried:true,limit:8});r.bag.visible=Object.values(inventory||{}).some(v=>v>0);
}
