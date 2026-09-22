import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {createVillager,createDeer,animateVillager,animateDeer,geometryStats} from './models.js';

const $=s=>document.querySelector(s),scene=new T.Scene();scene.background=new T.Color('#dfebeb');scene.fog=new T.Fog('#dfebeb',12,30);
let renderer;
try{renderer=new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});}catch{ $('#failure').hidden=false;throw Error('WebGL unavailable: visible fallback shown');}
renderer.setPixelRatio(Math.min(devicePixelRatio,1.35));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.23;$('#stage').append(renderer.domElement);
const camera=new T.PerspectiveCamera(35,innerWidth/innerHeight,.05,60),controls=new OrbitControls(camera,renderer.domElement);
controls.enableDamping=true;controls.dampingFactor=.10;controls.minDistance=.48;controls.maxDistance=14;controls.maxPolarAngle=Math.PI*.49;controls.minPolarAngle=.25;controls.screenSpacePanning=true;controls.mouseButtons={LEFT:T.MOUSE.PAN,MIDDLE:T.MOUSE.DOLLY,RIGHT:T.MOUSE.ROTATE};controls.touches={ONE:T.TOUCH.PAN,TWO:T.TOUCH.DOLLY_ROTATE};
scene.add(new T.HemisphereLight('#e9f5ff','#a0ac7c',2.5));const sun=new T.DirectionalLight('#ffe8c6',3.4);sun.position.set(-3.5,6,4.5);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-5,right:5,top:5,bottom:-5,near:.5,far:15});sun.shadow.normalBias=.022;sun.shadow.bias=-.0001;sun.shadow.radius=3;scene.add(sun);const fill=new T.DirectionalLight('#dceaf5',1.2);fill.position.set(3,3,-3);scene.add(fill);
const groundMat=new T.MeshStandardMaterial({color:'#a7b991',roughness:1});const ground=new T.Mesh(new T.PlaneGeometry(80,80),groundMat);ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
// Simple background vegetation shares the models' matte materials and soft edges.
const backdrop=new T.Group();scene.add(backdrop);
function evergreen(x,z,h){const tree=new T.Group();tree.position.set(x,0,z);backdrop.add(tree);const bark=new T.Mesh(new T.CylinderGeometry(.045,.065,h*.55,9),new T.MeshStandardMaterial({color:'#806b4b',roughness:1}));bark.position.y=h*.27;tree.add(bark);for(let i=0;i<3;i++){const y=h*(.40+i*.20),r=h*(.23-i*.04);const geo=new T.ConeGeometry(r,h*.53,10,3);const leaves=new T.Mesh(geo,new T.MeshStandardMaterial({color:['#749879','#698c70','#72997b'][i],roughness:1}));leaves.position.y=y;tree.add(leaves);}return tree;}
for(const [x,z,h]of [[-3,-3,2.8],[3.1,-3.8,3.2],[-4.6,-6,3.6],[.8,-6,3.0],[5,-7,4],[-2,-9,4],[6,-11,4]])evergreen(x,z,h);
for(let i=0;i<10;i++){const rock=new T.Mesh(new T.DodecahedronGeometry(.12+(i%3)*.05,1),new T.MeshStandardMaterial({color:i%2?'#8e9c8a':'#aab39d',roughness:1}));rock.scale.set(1.3,.65,.9);rock.position.set((i%2?1:-1)*(2.1+(i%4)*.46),.055,-1.8-Math.floor(i/2)*.52);backdrop.add(rock);}
const models={mara:createVillager('Mara'),ivo:createVillager('Ivo'),deer:createDeer()};models.mara.root.position.set(.06,0,.20);models.ivo.root.position.set(-.94,0,0);models.ivo.root.scale.setScalar(1.10);models.deer.root.position.set(1.23,0,-.14);models.deer.root.rotation.y=-.45;
for(const m of Object.values(models))scene.add(m.root);
const extras=[];let selected='together',mode='idle',paused=false,close=false,angle='front',clock=0,prev=performance.now(),lastReport=prev,frames=[],renderTimes=[];
let desiredPosition=new T.Vector3(),desiredTarget=new T.Vector3(),transition=false;
function setView(immediate=false){
 const together=selected==='together',m=models[selected],mobile=innerWidth<650;
 for(const [id,obj]of Object.entries(models))obj.root.visible=together||selected===id;
 for(const e of extras)e.root.visible=together;
 const x=together?.05:m.root.position.x,z=together?0:m.root.position.z;
 const y=close?(selected==='deer'?1.22:selected==='ivo'?1.67:1.51):together?.88:selected==='deer'?.70:.84;
 let distance=close?(selected==='deer'?1.5:1.05):together?(mobile?7.9:6.6):selected==='deer'?(mobile?4.0:3.4):(mobile?4.0:3.5);
 if(together&&extras.length)distance=mobile?11:9;
 const theta=angle==='side'?Math.PI/2:angle==='back'?Math.PI:0;
 desiredTarget.set(x,y,z);desiredPosition.set(x+Math.sin(theta)*distance,y+distance*(close?.045:.085),z+Math.cos(theta)*distance);
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
 if($('#population').value==='4')for(let row=0;row<3;row++)for(const kind of ['ivo','mara','deer']){const e=kind==='deer'?createDeer():createVillager(kind==='mara'?'Mara':'Ivo');e.kind=kind;e.root.position.set(-1.6+['ivo','mara','deer'].indexOf(kind)*1.55,0,-1.6-row*1.2);scene.add(e.root);extras.push(e);}
 selected='together';close=false;pressed('[data-subject]','subject',selected);$('#close-up').disabled=true;$('#close-up').setAttribute('aria-pressed','false');setView();
};
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);setView(true);});
let hidden=false;document.addEventListener('visibilitychange',()=>{hidden=document.hidden;prev=performance.now();});
const counts=Object.fromEntries(Object.entries(models).map(([k,m])=>[k,geometryStats(m.root)]));
function animate(now){requestAnimationFrame(animate);if(hidden)return;const delta=Math.min(.05,(now-prev)/1000),elapsed=now-prev;prev=now;if(!paused)clock+=delta;
 animateVillager(models.mara,clock,mode);animateVillager(models.ivo,clock+.5,mode);animateDeer(models.deer,clock,mode);
 extras.forEach((e,i)=>e.kind==='deer'?animateDeer(e,clock+i*.23,mode):animateVillager(e,clock+i*.23,mode));
 if(transition){camera.position.lerp(desiredPosition,.14);controls.target.lerp(desiredTarget,.14);if(camera.position.distanceTo(desiredPosition)<.003)transition=false;}controls.update();
 const begin=performance.now();renderer.render(scene,camera);renderTimes.push(performance.now()-begin);frames.push(elapsed);
 if(now-lastReport>1200){const avg=frames.reduce((a,b)=>a+b,0)/frames.length,fps=1000/avg,sorted=[...frames].sort((a,b)=>a-b),p95=sorted[Math.floor(sorted.length*.95)]||0;$('#fps').textContent=`${Math.round(fps)} fps`;
  const sum=Object.values(counts).reduce((a,b)=>a+b.triangles,0)*(extras.length?4:1);
  $('#numbers').innerHTML=`<span><strong>${(sum/1000).toFixed(1)}k</strong> model triangles</span><span><strong>${renderer.info.render.calls}</strong> draw calls incl. shadows</span><span><strong>${p95.toFixed(1)} ms</strong> frame time, 95th percentile</span><span><strong>${renderer.getPixelRatio().toFixed(2)}×</strong> pixel ratio</span>`;
  window.previewMetrics={fps,p95FrameMs:p95,renderSubmitMs:renderTimes.reduce((a,b)=>a+b,0)/renderTimes.length,counts,drawCalls:renderer.info.render.calls,renderedTriangles:renderer.info.render.triangles,pixelRatio:renderer.getPixelRatio(),population:3+extras.length,mode,selected,quality:$('#quality').value,previewOnly:true};frames=[];renderTimes=[];lastReport=now;
 }
}
setView(true);requestAnimationFrame(animate);
