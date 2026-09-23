import * as T from 'three';
import {HOME_REGIONS,FRONTIER_OBSTACLES,GREAT_RIVER,riverAt,campLayout,pointIn} from '../../shared/frontier.js';
import {CREEK_POINTS} from '../../realtime/water.mjs';
// Terrain uses the same obstacle footprints and water centerlines as routing.
// The original basin's elevations remain unchanged.
export function frontierElevation(x,z,original){
 let h=.65+Math.sin(x*.028)*Math.sin(z*.024)*.65;
 for(const home of HOME_REGIONS){const lx=x-home.x+64,lz=z-home.y+34;if(lx>=-4&&lx<=104&&lz>=-2&&lz<=84){const blend=Math.max(0,Math.min(1,(lx+4)/4,(104-lx)/4,(lz+2)/4,(84-lz)/4));h=h*(1-blend)+original(lx,lz)*blend;}}
 const gap=Math.abs(z-riverAt(GREAT_RIVER,x));if(gap<4)h=Math.min(h,-.48+gap*.36);
 for(const r of FRONTIER_OBSTACLES)if(pointIn({x,y:z},r))h=r.height;
 return h;
}
export function frontierTerrain(elevation){
 const g=new T.PlaneGeometry(520,520,260,260);g.rotateX(-Math.PI/2);const p=g.attributes.position,colors=[],color=new T.Color();
 for(let i=0;i<p.count;i++){const x=p.getX(i)+250,z=p.getZ(i)+250,h=elevation(x,z),home=HOME_REGIONS.reduce((best,r)=>Math.hypot(x-r.x,z-r.y)<Math.hypot(x-best.x,z-best.y)?r:best,HOME_REGIONS[0]);p.setXYZ(i,x,h,z);color.set(Math.abs(z-riverAt(GREAT_RIVER,x))<3?'#9d9c7e':home.color);color.offsetHSL(0,0,(Math.sin(x*.33)*Math.cos(z*.23))*.035);colors.push(color.r,color.g,color.b);}
 g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.computeVertexNormals();return g;
}
function riverMesh(points,material,y=-.12){const positions=[],indices=[];for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i];for(const [x,z]of [a,b])positions.push(x,y,z-1.25,x,y,z+1.25);const n=(i-1)*4;indices.push(n,n+1,n+2,n+1,n+3,n+2);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();return new T.Mesh(g,material);}
export function installFrontier(view,frame){
 if(view.frontierInstalled||!frame.frontier)return;view.frontierInstalled=true;view.frontier=frame.frontier;
 view.scene.remove(view.groundMesh);view.groundMesh.geometry.dispose();view.groundMesh.geometry=frontierTerrain(view.heightAt);view.scene.add(view.groundMesh);
 view.camera.far=1800;view.camera.updateProjectionMatrix();view.controls.maxDistance=700;view.controls.maxTargetRadius=750;view.scene.fog.density=.002;
 view.camps=new Map([['willow-basin',{shelter:view.shelter,fire:view.fire,flames:view.flames,light:view.fireLight}]]);
 for(const home of frame.frontier.homes.filter(h=>h.id!=='willow-basin')){
  const camp=campLayout(null,home),shelter=view.shelter.clone(true),fire=view.fire.clone(true);shelter.position.set(camp.shelter.x,view.heightAt(camp.shelter.x,camp.shelter.y),camp.shelter.y);fire.position.set(camp.fire.x,view.heightAt(camp.fire.x,camp.fire.y),camp.fire.y);view.scene.add(shelter,fire);const flames=fire.children.find(c=>c.type==='Group'),light=fire.children.find(c=>c.isPointLight);view.camps.set(home.id,{shelter,fire,flames,light});
  view.scene.add(riverMesh(CREEK_POINTS.map(([x,z])=>[x+home.x-64,z+home.y-34]),view.waterMat));
 }
 view.scene.add(riverMesh(GREAT_RIVER,view.waterMat));
 view.forest();
}
export function updateFrontier(view,frame){for(const h of frame.frontier?.homes||[]){const c=view.camps?.get(h.id);if(c){c.shelter.visible=!!h.structures.shelter;c.flames.visible=!!h.structures.fire;c.light.visible=!!h.structures.fire;}}}
