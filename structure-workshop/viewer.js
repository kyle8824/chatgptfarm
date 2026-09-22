import * as T from 'three';
import {MapGestureControls} from '../shared/visuals/map-controls.js';
import {createStructureModel} from '../shared/visuals/structure-model.js';
export class StructureViewer{
 constructor(element){
  this.element=element;this.scene=new T.Scene();this.scene.background=new T.Color('#e2e9dd');this.camera=new T.PerspectiveCamera(38,1,.05,100);
  this.renderer=new T.WebGLRenderer({antialias:true,powerPreference:'low-power'});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.35));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFSoftShadowMap;this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.12;element.append(this.renderer.domElement);
  this.controls=new MapGestureControls(this.camera,this.renderer.domElement,{planeMode:'screen'});this.controls.enableDamping=false;this.controls.minDistance=.8;this.controls.maxDistance=35;this.controls.minPolarAngle=.04;this.controls.maxPolarAngle=Math.PI*.49;this.controls.mouseButtons={LEFT:T.MOUSE.PAN,MIDDLE:T.MOUSE.DOLLY,RIGHT:T.MOUSE.ROTATE};this.controls.addEventListener('change',()=>this.draw());
  this.scene.add(new T.HemisphereLight('#f4f5e6','#718a63',2.5));const sun=new T.DirectionalLight('#fff3d4',3);sun.position.set(-4,9,5);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-6,right:6,top:6,bottom:-6,near:1,far:25});sun.shadow.bias=-.0005;sun.shadow.normalBias=.03;this.scene.add(sun);
  this.floor=new T.Mesh(new T.CircleGeometry(8,64),new T.MeshStandardMaterial({color:'#dce5d0',roughness:1}));this.floor.rotation.x=-Math.PI/2;this.floor.position.y=-.025;this.floor.receiveShadow=true;this.scene.add(this.floor);
  this.grid=new T.GridHelper(12,24,'#becdb3','#d0dcc5');this.grid.position.y=-.018;this.grid.material.transparent=true;this.grid.material.opacity=.32;this.scene.add(this.grid);
  this.resize=new ResizeObserver(()=>{const r=element.getBoundingClientRect();if(!r.width||!r.height)return;this.camera.aspect=r.width/r.height;this.camera.updateProjectionMatrix();this.renderer.setSize(r.width,r.height);if(this.project)this.home(this.angle||'front');});this.resize.observe(element);
 }
 show(project,appearance,stage,reset=false){
  if(this.model){this.scene.remove(this.model);this.model.userData.disposeStructure();}
  this.project=project;this.model=createStructureModel(project,{appearance,stage});this.scene.add(this.model);
  const bounds=new T.Box3();for(const p of project.parts){bounds.expandByPoint(new T.Vector3(...p.center).sub(new T.Vector3(...p.size).multiplyScalar(.5)));bounds.expandByPoint(new T.Vector3(...p.center).add(new T.Vector3(...p.size).multiplyScalar(.5)));}this.bounds=bounds;
  if(reset)this.home('front');else this.draw();
 }
 home(angle='front'){
  if(!this.bounds)return;this.angle=angle;const center=this.bounds.getCenter(new T.Vector3()),size=this.bounds.getSize(new T.Vector3()),radius=size.length()/2;
  const halfFov=T.MathUtils.degToRad(this.camera.fov/2),horizontal=Math.atan(Math.tan(halfFov)*this.camera.aspect),distance=Math.max(3,radius/Math.sin(Math.min(halfFov,horizontal)))*1.28;
  const direction=angle==='top'?new T.Vector3(0,1,.025):angle==='side'?new T.Vector3(1,.42,.08):new T.Vector3(.72,.50,1);
  this.controls.target.copy(center);this.camera.position.copy(center).add(direction.normalize().multiplyScalar(distance));this.controls.update();this.draw();
 }
 zoom(scale){this.camera.position.sub(this.controls.target).multiplyScalar(scale).clampLength(this.controls.minDistance,this.controls.maxDistance).add(this.controls.target);this.controls.update();this.draw();}
 draw(){if(this.pending)return;this.pending=requestAnimationFrame(()=>{this.pending=null;this.renderer.render(this.scene,this.camera);});}
}
