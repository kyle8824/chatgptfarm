import * as T from 'three';
import {landHeight,waterSample,LAND_BOUNDS,STREAMS,LAKES,NATURAL_REGIONS,smooth} from '../../shared/landscape.js';

export function naturalTerrain(){
 const g=new T.PlaneGeometry(1000,1000,500,500);g.rotateX(-Math.PI/2);const p=g.attributes.position,colors=[],c=new T.Color(),grass=new T.Color('#75915e'),rock=new T.Color('#8a9085'),high=new T.Color('#b8b9ac'),bank=new T.Color('#a7a182'),fen=new T.Color('#6c917d');
 for(let i=0;i<p.count;i++){
  const x=p.getX(i)-150,z=p.getZ(i)-150,h=landHeight(x,z),water=waterSample(x,z),slope=Math.hypot(landHeight(x+.7,z)-h,landHeight(x,z+.7)-h)/.7;
  p.setXYZ(i,x,h,z);c.copy(grass);c.lerp(fen,smooth(85,0,Math.hypot(x-35,z+275))*.6);c.lerp(new T.Color('#a5a070'),smooth(115,5,Math.hypot(x+325,z+325))*.4);
  c.lerp(rock,Math.max(smooth(.55,1.15,slope),smooth(19,38,h))*.9);c.lerp(high,smooth(36,53,h)*.65);
  if(water&&water.edge<2.4)c.lerp(bank,.8*(1-smooth(.2,2.4,water.edge)));
  const variation=Math.sin(x*.054+Math.sin(z*.029)*2)*Math.cos(z*.043+x*.013)*.035+Math.sin(x*.21+z*.18)*.012;c.offsetHSL(0,0,variation);
  colors.push(c.r,c.g,c.b);
 }
 g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.computeVertexNormals();return g;
}
function streamGeometry(s){const v=[],indices=[];for(let i=0;i<s.points.length;i++){const p=s.points[i],prev=s.points[Math.max(0,i-1)],next=s.points[Math.min(s.points.length-1,i+1)],dx=next[0]-prev[0],dz=next[1]-prev[1],n=Math.hypot(dx,dz)||1,rx=-dz/n*p[3],rz=dx/n*p[3];v.push(p[0]+rx,p[2],p[1]+rz,p[0]-rx,p[2],p[1]-rz);if(i<s.points.length-1){const k=i*2;indices.push(k,k+1,k+2,k+1,k+3,k+2);}}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v,3));g.setIndex(indices);g.computeVertexNormals();return g;}
export function installNaturalWater(view){
 // Remove the old infinitely extrapolated creek ribbon; all water now uses
 // the exact server polylines and lake shores, including the original creek.
 for(const o of [...view.scene.children])if(o.material===view.waterMat)view.scene.remove(o);
 view.waterMat.uniforms.deep.value.set('#1f6376');view.waterMat.uniforms.shallow.value.set('#83b9b0');
 for(const s of STREAMS){const mesh=new T.Mesh(streamGeometry(s),view.waterMat);mesh.userData.landscapeWater=s.id;view.scene.add(mesh);}
 for(const l of LAKES){const shape=new T.Shape();l.points.forEach(([x,z],i)=>i?shape.lineTo(x,-z):shape.moveTo(x,-z));shape.closePath();const g=new T.ShapeGeometry(shape);g.rotateX(-Math.PI/2);const mesh=new T.Mesh(g,view.waterMat);mesh.position.y=l.level;mesh.userData.landscapeWater=l.id;view.scene.add(mesh);}
 // Foam lies where the descending shared water surface reaches the pool.
 const foam=new T.Mesh(new T.CircleGeometry(2.1,24),new T.MeshBasicMaterial({color:'#e1eee4',transparent:true,opacity:.5,depthWrite:false}));foam.rotation.x=-Math.PI/2;foam.scale.set(1,.6,1);foam.position.set(-218,4.43,-213.7);view.scene.add(foam);view.waterfallFoam=foam;
 const mist=new T.BufferGeometry(),v=[];for(let i=0;i<50;i++)v.push(-218+Math.sin(i*2.39)*1.7,4.6+(i%9)*.13,-214+Math.cos(i*1.77)*1.5);mist.setAttribute('position',new T.Float32BufferAttribute(v,3));view.scene.add(new T.Points(mist,new T.PointsMaterial({color:'#e5f0e7',size:.16,transparent:true,opacity:.35,depthWrite:false})));
 // Bank plants and low stones follow real shore contours. These small ground
 // details are not phantom harvestable trees or giant unmodelled colliders.
 const reedGeo=new T.ConeGeometry(.07,.8,4),reedMat=new T.MeshStandardMaterial({color:'#a2a87d',roughness:1}),stoneGeo=new T.IcosahedronGeometry(.35,0),stoneMat=new T.MeshStandardMaterial({color:'#969e8b',roughness:1}),reeds=new T.InstancedMesh(reedGeo,reedMat,250),stones=new T.InstancedMesh(stoneGeo,stoneMat,250),dummy=new T.Object3D();let ri=0,si=0;
 for(const l of LAKES)for(let i=0;i<l.points.length;i++){const [x,z]=l.points[i],dx=x-l.x,dz=z-l.z,n=Math.hypot(dx,dz),px=x+dx/n*.8,pz=z+dz/n*.8;if(i%3){dummy.position.set(px,landHeight(px,pz)+.32,pz);dummy.scale.set(1,.8+(i%4)*.15,1);dummy.rotation.y=i*2.39;dummy.updateMatrix();reeds.setMatrixAt(ri++,dummy.matrix);}else{dummy.position.set(px,landHeight(px,pz)+.06,pz);dummy.scale.set(1.4,.5,1);dummy.rotation.y=i;dummy.updateMatrix();stones.setMatrixAt(si++,dummy.matrix);}}
 reeds.count=ri;stones.count=si;reeds.castShadow=stones.castShadow=true;view.scene.add(reeds,stones);
}
