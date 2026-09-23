import * as T from 'three';
import {MapGestureControls} from '../shared/visuals/map-controls.js';
import {createVillager,createAnimal,animateVillager,animateAnimal,geometryStats} from './models.js';

const $=s=>document.querySelector(s),scene=new T.Scene();scene.background=new T.Color('#dfebeb');scene.fog=new T.Fog('#dfebeb',30,75);
let renderer;
try{renderer=new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});}catch{ $('#failure').hidden=false;throw Error('WebGL unavailable: visible fallback shown');}
renderer.info.autoReset=false;renderer.setPixelRatio(Math.min(devicePixelRatio,1.35));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.10;$('#stage').append(renderer.domElement);
const camera=new T.PerspectiveCamera(35,innerWidth/innerHeight,.05,100),controls=new MapGestureControls(camera,renderer.domElement,{planeMode:'screen'});
controls.enableDamping=true;controls.dampingFactor=.10;controls.minDistance=.48;controls.maxDistance=50;controls.maxPolarAngle=Math.PI*.49;controls.minPolarAngle=.25;controls.screenSpacePanning=true;controls.mouseButtons={LEFT:T.MOUSE.PAN,MIDDLE:T.MOUSE.DOLLY,RIGHT:T.MOUSE.ROTATE};
scene.add(new T.HemisphereLight('#e9f5ff','#a0ac7c',1.8));const sun=new T.DirectionalLight('#ffe8c6',2.4);sun.position.set(-3.5,6,4.5);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-5,right:5,top:5,bottom:-5,near:.5,far:15});sun.shadow.normalBias=.022;sun.shadow.bias=-.0001;sun.shadow.radius=3;scene.add(sun);const fill=new T.DirectionalLight('#dceaf5',.9);fill.position.set(3,3,-3);scene.add(fill);
const groundMat=new T.MeshStandardMaterial({color:'#90a577',roughness:1});const ground=new T.Mesh(new T.PlaneGeometry(80,80),groundMat);ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
// Simple background vegetation shares the models' matte materials and soft edges.
const backdrop=new T.Group();scene.add(backdrop);
function evergreen(x,z,h){const tree=new T.Group();tree.position.set(x,0,z);backdrop.add(tree);const bark=new T.Mesh(new T.CylinderGeometry(.045,.065,h*.55,9),new T.MeshStandardMaterial({color:'#806b4b',roughness:1}));bark.position.y=h*.27;tree.add(bark);for(let i=0;i<3;i++){const y=h*(.40+i*.20),r=h*(.23-i*.04);const geo=new T.ConeGeometry(r,h*.53,14,3);const leaves=new T.Mesh(geo,new T.MeshStandardMaterial({color:['#386c50','#497950','#56864f'][i],roughness:1}));leaves.position.y=y;tree.add(leaves);}return tree;}
for(const [x,z,h]of [[-3,-3,2.8],[3.1,-3.8,3.2],[-4.6,-6,3.6],[.8,-6,3.0],[5,-7,4],[-2,-9,4],[6,-11,4]])evergreen(x,z,h);
for(let i=0;i<10;i++){const rock=new T.Mesh(new T.DodecahedronGeometry(.12+(i%3)*.05,1),new T.MeshStandardMaterial({color:i%2?'#8e9c8a':'#aab39d',roughness:1}));rock.scale.set(1.3,.65,.9);rock.position.set((i%2?1:-1)*(2.1+(i%4)*.46),.055,-1.8-Math.floor(i/2)*.52);backdrop.add(rock);}
const villagers=[['mara','Mara','female'],['ivo','Ivo','male'],['tessa','Tessa','female'],['oren','Oren','male'],['nia','Nia','female'],['kellan','Kellan','male'],['elin','Elin','female'],['ronan','Ronan','male']];
// Match the actual live adult rigs; the workshop remains an isolated preview.
const models={};
for(const [i,[id,name,sex]]of villagers.entries()){
 const m=models[id]=createVillager(sex==='female'?'Mara':'Ivo');m.root.name=name;
 m.root.position.set(-1.9+(i%4)*1.05,0,i<4?.35:-1.35);m.root.scale.setScalar(sex==='male'?1.10:1);
}
for(const kind of ['deer','bear','rabbit','fish'])models[kind]=createAnimal(kind);
models.deer.root.position.set(2.2,0,.2);models.deer.root.rotation.y=-.9;
models.bear.root.position.set(3.4,0,-1.4);models.bear.root.rotation.y=-.35;
models.rabbit.root.position.set(1.6,0,1.1);models.fish.root.position.set(0,.65,0);
for(const m of Object.values(models))scene.add(m.root);
const extras=[];let selected='together',mode='idle',paused=false,close=false,angle='front',clock=0,prev=performance.now(),lastReport=prev,frames=[],renderTimes=[];
let desiredPosition=new T.Vector3(),desiredTarget=new T.Vector3(),transition=false;
function setView(immediate=false){
 const together=selected==='together',m=models[selected],mobile=innerWidth<650;
 for(const [id,obj]of Object.entries(models))obj.root.visible=(together&&id!=='fish')||selected===id;
 for(const e of extras)e.root.visible=together;
 document.body.classList.toggle('solo',!together);scene.updateMatrixWorld(true);
 const focus=close?m.head.getWorldPosition(new T.Vector3()):new T.Vector3(together?.65:m.root.position.x,together?.88:selected==='deer'?.70:selected==='bear'?.62:selected==='rabbit'?.25:selected==='fish'?.65:.84,together?-.2:m.root.position.z);
 const {x,y,z}=focus;
 let distance=close?(selected==='deer'?2.2:selected==='bear'?2:selected==='rabbit'?.8:selected==='fish'?.6:1.4):together?(mobile?17:10):selected==='rabbit'?(mobile?1.9:1.7):selected==='fish'?(mobile?1.5:1.3):selected==='bear'?(mobile?5.6:5):selected==='deer'?(mobile?4.8:4.3):(mobile?4.8:4.5);
 if(together){
  const bounds=new T.Box3();for(const model of [...Object.values(models),...extras])if(model.root.visible)bounds.union(new T.Box3().setFromObject(model.root));
  const halfWidth=Math.max(x-bounds.min.x,bounds.max.x-x)+.35,halfDepth=Math.max(z-bounds.min.z,bounds.max.z-z);
  distance=Math.max(distance,halfWidth/(Math.tan(camera.fov*Math.PI/360)*camera.aspect)+halfDepth);
 }
 const theta=(angle==='side'?Math.PI/2:angle==='back'?Math.PI:0)+(together?0:m.root.rotation.y);
 desiredTarget.set(x,y,z);desiredPosition.set(x+Math.sin(theta)*distance,y+distance*(close?.045:together?.20:.085),z+Math.cos(theta)*distance);
 // View offset reserves room for header and controls without tilting the faces.
 const offset=mobile?-.015:-.015;camera.setViewOffset(innerWidth,innerHeight,0,innerHeight*offset,innerWidth,innerHeight);
 if(immediate){controls.target.copy(desiredTarget);camera.position.copy(desiredPosition);controls.update();transition=false;}else transition=true;
}
function pressed(selector,attr,value){for(const b of document.querySelectorAll(selector))b.setAttribute('aria-pressed',String(b.dataset[attr]===value));}
for(const b of document.querySelectorAll('[data-subject]'))b.onclick=()=>{selected=b.dataset.subject;close=false;$('#close-up').setAttribute('aria-pressed','false');$('#close-up').disabled=selected==='together';pressed('[data-subject]','subject',selected);setView();};
for(const b of document.querySelectorAll('[data-mode]'))b.onclick=()=>{mode=b.dataset.mode;pressed('[data-mode]','mode',mode);};
for(const b of document.querySelectorAll('[data-angle]'))b.onclick=()=>{angle=b.dataset.angle;pressed('[data-angle]','angle',angle);setView();};
$('#close-up').disabled=true;$('#close-up').onclick=()=>{close=!close;$('#close-up').setAttribute('aria-pressed',String(close));setView();};
$('#pause').onclick=()=>{paused=!paused;$('#pause').setAttribute('aria-pressed',String(paused));$('#pause').setAttribute('aria-label',paused?'Resume animation':'Pause animation');$('#pause').textContent=paused?'▶':'Ⅱ';};
$('#home').onclick=()=>{angle='front';close=false;pressed('[data-angle]','angle',angle);$('#close-up').setAttribute('aria-pressed','false');setView();};
$('#zoom-in').onclick=()=>{transition=false;camera.position.lerp(controls.target,.20);controls.update();};$('#zoom-out').onclick=()=>{transition=false;camera.position.sub(controls.target).multiplyScalar(1.23).add(controls.target);controls.update();};controls.addEventListener('start',()=>transition=false);
$('#stats-toggle').onclick=()=>{$('#stats').hidden=!$('#stats').hidden;$('#stats-toggle').setAttribute('aria-expanded',String(!$('#stats').hidden));};
$('#quality').onchange=()=>{const detail=$('#quality').value==='detail';renderer.setPixelRatio(Math.min(devicePixelRatio,detail?2:1.35));sun.shadow.mapSize.set(detail?2048:1024,detail?2048:1024);sun.shadow.map?.dispose();sun.shadow.map=null;renderer.shadowMap.needsUpdate=true;frames=[];renderTimes=[];};
$('#population').onchange=()=>{
 for(const e of extras){scene.remove(e.root);e.root.traverse(o=>{if(o.isMesh)o.geometry.dispose();});}extras.length=0;
 if($('#population').value==='4')for(let row=0;row<3;row++)for(const kind of ['ivo','mara','deer']){const e=kind==='deer'?createAnimal('deer'):createVillager(kind==='mara'?'Mara':'Ivo');e.kind=kind;e.root.position.set(-1.6+['ivo','mara','deer'].indexOf(kind)*1.55,0,-3-row*1.2);scene.add(e.root);extras.push(e);}
 selected='together';close=false;pressed('[data-subject]','subject',selected);$('#close-up').disabled=true;$('#close-up').setAttribute('aria-pressed','false');setView();
};
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);setView(true);});
let hidden=false;document.addEventListener('visibilitychange',()=>{hidden=document.hidden;prev=performance.now();});
const counts=Object.fromEntries(Object.entries(models).map(([k,m])=>[k,geometryStats(m.root)]));
function animate(now){requestAnimationFrame(animate);if(hidden)return;const delta=Math.min(.05,(now-prev)/1000),elapsed=now-prev;prev=now;if(!paused)clock+=delta;
 villagers.forEach(([id],i)=>{if(models[id].root.visible)animateVillager(models[id],clock+i*.23,mode);});for(const kind of ['deer','bear','rabbit','fish'])if(models[kind].root.visible)animateAnimal(models[kind],clock,mode==='alert'?(kind==='bear'?'defend':kind==='rabbit'?'freeze':kind==='fish'?'dart':'alert'):mode,paused?0:delta);
 extras.forEach((e,i)=>e.kind==='deer'?animateAnimal(e,clock+i*.23,mode,paused?0:delta):animateVillager(e,clock+i*.23,mode));
 if(transition){const cameraBlend=1-Math.exp(-Math.min(elapsed,500)/1000*11);camera.position.lerp(desiredPosition,cameraBlend);controls.target.lerp(desiredTarget,cameraBlend);if(camera.position.distanceTo(desiredPosition)<.003)transition=false;}controls.update();
 const begin=performance.now();renderer.info.reset();renderer.render(scene,camera);renderTimes.push(performance.now()-begin);frames.push(elapsed);
 if(now-lastReport>1200){const avg=frames.reduce((a,b)=>a+b,0)/frames.length,fps=1000/avg,sorted=[...frames].sort((a,b)=>a-b),p95=sorted[Math.floor(sorted.length*.95)]||0;$('#fps').textContent=`${Math.round(fps)} fps`;
  const sum=Object.entries(counts).reduce((a,[id,b])=>a+(models[id].root.visible?b.triangles:0),0)+extras.reduce((a,e)=>a+(e.root.visible?counts[e.kind].triangles:0),0);
  $('#numbers').innerHTML=`<span><strong>${(sum/1000).toFixed(1)}k</strong> model triangles</span><span><strong>${renderer.info.render.calls}</strong> draw calls incl. shadows</span><span><strong>${p95.toFixed(1)} ms</strong> frame time, 95th percentile</span><span><strong>${renderer.getPixelRatio().toFixed(2)}×</strong> pixel ratio</span>`;
  window.previewMetrics={fps,p95FrameMs:p95,renderSubmitMs:renderTimes.reduce((a,b)=>a+b,0)/renderTimes.length,counts,drawCalls:renderer.info.render.calls,renderedTriangles:renderer.info.render.triangles,pixelRatio:renderer.getPixelRatio(),population:Object.values(models).filter(m=>m.root.visible).length+extras.filter(m=>m.root.visible).length,mode,selected,quality:$('#quality').value,animationTime:clock,camera:{position:camera.position.toArray(),target:controls.target.toArray()},projectedSubjects:Object.fromEntries(Object.entries(models).filter(([,m])=>m.root.visible).map(([id,m])=>{const b=new T.Box3().setFromObject(m.root),corners=[];for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z])corners.push(new T.Vector3(x,y,z).project(camera).x);return [id,{minX:Math.min(...corners),maxX:Math.max(...corners)}];})),previewOnly:true};frames=[];renderTimes=[];lastReport=now;
 }
}
setView(true);requestAnimationFrame(animate);
