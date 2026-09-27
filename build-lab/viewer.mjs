import * as T from 'three';
import {MapGestureControls} from '../shared/visuals/map-controls.js';
import {createStructureModel} from '../shared/visuals/structure-model.js';
import {campsOf} from '../shared/frontier.js';
export class LabViewer{
 constructor(element){
  this.scene=new T.Scene();this.scene.background=new T.Color('#dbe2ca');this.camera=new T.PerspectiveCamera(42,1,.1,200);this.renderer=new T.WebGLRenderer({antialias:true,powerPreference:'low-power'});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));this.renderer.outputColorSpace=T.SRGBColorSpace;element.append(this.renderer.domElement);
  this.controls=new MapGestureControls(this.camera,this.renderer.domElement,{planeMode:'screen'});this.controls.enableDamping=false;this.controls.minDistance=3;this.controls.maxDistance=70;this.controls.maxPolarAngle=Math.PI*.49;this.controls.mouseButtons={LEFT:T.MOUSE.PAN,MIDDLE:T.MOUSE.DOLLY,RIGHT:T.MOUSE.ROTATE};this.controls.addEventListener('change',()=>this.draw());
  this.scene.add(new T.HemisphereLight('#fff9df','#738c5c',2.7));const sun=new T.DirectionalLight('#fff4d2',2.8);sun.position.set(-10,20,10);this.scene.add(sun);
  const floor=new T.Mesh(new T.CircleGeometry(35,64),new T.MeshStandardMaterial({color:'#c4d3ad',roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.set(65,-.03,37);this.scene.add(floor);
  const grid=new T.GridHelper(70,70,'#aabd93','#b5c6a2');grid.position.set(65,-.02,37);grid.material.transparent=true;grid.material.opacity=.25;this.scene.add(grid);this.root=new T.Group();this.scene.add(this.root);this.home();
  new ResizeObserver(()=>{const r=element.getBoundingClientRect();this.camera.aspect=r.width/Math.max(1,r.height);this.camera.updateProjectionMatrix();this.renderer.setSize(r.width,r.height);this.draw();}).observe(element);
 }
 home(){this.controls.target.set(66,.5,36);this.camera.position.set(81,16,52);this.controls.update();this.draw();}
 clear(){for(const object of [...this.root.children]){if(object.userData.disposeStructure)object.userData.disposeStructure();else object.traverse(x=>{x.geometry?.dispose();if(Array.isArray(x.material))x.material.forEach(m=>m.dispose());else x.material?.dispose();});this.root.remove(object);}}
 show(lab,sites,mode='construction'){
  this.clear();const w=lab.world,planned=mode==='design'&&lab.validation?.project;
  for(const site of sites){const line=new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(site.width,.02,site.depth)),new T.LineBasicMaterial({color:site.experimental?'#aa7734':'#8f9f75',transparent:true,opacity:site.experimental?.75:.3}));line.position.set(site.position.x,.01,site.position.y);this.root.add(line);}
  for(const p of [...w.settlement.projects,...(planned?[lab.validation.project]:[])]){if(planned?.extendsProjectId===p.id)continue;const model=createStructureModel(p,{stage:mode});model.position.set(p.position.x,0,p.position.y);this.root.add(model);}
  const a=w.agents[0],body=new T.Mesh(new T.CapsuleGeometry(.2,.75,4,8),new T.MeshStandardMaterial({color:'#4d705b'}));body.position.set(a.coordinates.x,.7,a.coordinates.y);this.root.add(body);
  for(const c of campsOf(w)){
   const ring=new T.Mesh(new T.RingGeometry(3.94,4,64),new T.MeshBasicMaterial({color:'#b48646',transparent:true,opacity:c.structures.fire?.5:.15,side:T.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.set(c.fire.x,.025,c.fire.y);this.root.add(ring);
   const fire=new T.Mesh(new T.ConeGeometry(.38,c.structures.fire?.7:.15,7),new T.MeshStandardMaterial({color:c.structures.fire?'#d49642':'#6b6758',emissive:c.structures.fire?'#654019':'#000000'}));fire.position.set(c.fire.x,.3,c.fire.y);this.root.add(fire);
  }
  for(const store of w.settlement.stores.filter(s=>Math.hypot(s.position.x-65,s.position.y-37)<25&&Object.values(s.items).some(n=>n>0))){const pile=new T.Mesh(new T.BoxGeometry(.6,.28,.5),new T.MeshStandardMaterial({color:'#a69465'}));pile.position.set(store.position.x,.15,store.position.y);this.root.add(pile);}
  this.draw();
 }
 draw(){if(this.pending)return;this.pending=requestAnimationFrame(()=>{this.pending=null;this.renderer.render(this.scene,this.camera);});}
}
