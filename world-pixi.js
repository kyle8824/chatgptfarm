(()=>{
'use strict';
const RAW='https://raw.githubusercontent.com/kyle8824/chatgptfarm/main/world/state.json';
const WORLD_UNITS=100, PX=18, WORLD_PX=WORLD_UNITS*PX;
let app,root,terrainLayer,objectLayer,artifactLayer,agentLayer,fxWorld,screenFx,current=null,lastTick=null;
let camera={x:WORLD_PX*.5,y:WORLD_PX*.63,scale:.72,mode:'auto',manualUntil:0};
const agents=new Map(),selectables=new Map();
const $=s=>document.querySelector(s);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const wp=p=>({x:(p?.x??50)*PX,y:(100-(p?.y??50))*PX});
const color={ground:0x526846,meadow:0x667a50,forest:0x304836,forestDark:0x20372c,wetland:0x48685a,water:0x5f9fb3,waterDeep:0x3f7f96,bank:0x6f7555,wood:0x765039,woodDark:0x4c3528,leaf:0x315f35,berry:0xb84851,rock:0x768078,rockDark:0x505b55,clay:0xa36d4d,reed:0x6e8954,fire:0xf39b45,fire2:0xffd36a,mara:0x688b72,ivo:0x6f7197,shadow:0x0a100c};

function hash(s){let h=2166136261;for(let i=0;i<String(s).length;i++){h^=String(s).charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function rng(seed){let x=hash(seed)||1;return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return(x>>>0)/4294967296}}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}

async function init(){
  const host=$('#worldViewport');
  app=new PIXI.Application({resizeTo:host,backgroundColor:0x10180f,antialias:true,resolution:Math.min(devicePixelRatio||1,2),autoDensity:true});
  host.appendChild(app.view);
  app.stage.sortableChildren=true;
  root=new PIXI.Container(); root.sortableChildren=true; app.stage.addChild(root);
  terrainLayer=new PIXI.Container();objectLayer=new PIXI.Container();artifactLayer=new PIXI.Container();agentLayer=new PIXI.Container();fxWorld=new PIXI.Container();
  terrainLayer.zIndex=0;objectLayer.zIndex=20;artifactLayer.zIndex=30;agentLayer.zIndex=40;fxWorld.zIndex=50;
  root.addChild(terrainLayer,objectLayer,artifactLayer,agentLayer,fxWorld);
  screenFx=new PIXI.Container();screenFx.zIndex=100;app.stage.addChild(screenFx);
  wireCamera();wireUI();
  app.ticker.add(tick);
  await loadWorld(true);
  setInterval(()=>loadWorld(false),12000);
  window.addEventListener('resize',()=>{drawScreenFx();updateCamera(true)});
}

async function loadWorld(first){
  let w=null;
  for(const u of [`${RAW}?v=${Date.now()}`,`./world/state.json?v=${Date.now()}`]){
    try{const r=await fetch(u,{cache:'no-store'});if(!r.ok)throw new Error(String(r.status));w=await r.json();break}catch(e){console.warn('world source failed',u,e)}
  }
  if(!w?.worldModel)return;
  const changed=lastTick!==w.meta?.tickNumber;
  current=w;lastTick=w.meta?.tickNumber;
  if(changed||first){renderStatic();renderUI();drawMiniMap();if(first)fitWorld()}
  renderAgents();drawScreenFx();
  $('#loading')?.classList.add('hidden');
}

function renderStatic(){
  terrainLayer.removeChildren().forEach(d=>d.destroy({children:true}));
  objectLayer.removeChildren().forEach(d=>d.destroy({children:true}));
  artifactLayer.removeChildren().forEach(d=>d.destroy({children:true}));
  selectables.clear();
  drawTerrain();
  const objects=(current.worldModel?.objects||[]).filter(o=>o.state?.active!==false);
  objects.filter(o=>!o.parentId).forEach(drawObject);
  objects.filter(o=>o.parentId).forEach(drawComponent);
  (current.artifacts||[]).filter(a=>a.status==='active'||a.status==='remnant').forEach(drawArtifact);
}

function drawTerrain(){
  const base=new PIXI.Graphics();base.beginFill(color.ground).drawRect(0,0,WORLD_PX,WORLD_PX).endFill();terrainLayer.addChild(base);
  for(const t of current.worldModel?.terrain||[]){
    const p=wp(t.center),r=(t.radiusM||20)/2*PX;
    const g=new PIXI.Graphics();
    if(t.type==='meadow'){g.beginFill(color.meadow,.8).drawCircle(p.x,p.y,r).endFill();scatterGrass(t,p,r)}
    else if(t.type==='forest'){g.beginFill(color.forest,.68).drawCircle(p.x,p.y,r).endFill();scatterForest(t,p,r)}
    else if(t.type==='wetland'){g.beginFill(color.wetland,.68).drawCircle(p.x,p.y,r).endFill();scatterWetland(t,p,r)}
    terrainLayer.addChildAt(g,1);
  }
  drawCreekFromGeometry();
  const shade=new PIXI.Graphics();shade.lineStyle(5,0x1c2c20,.18).drawRect(6,6,WORLD_PX-12,WORLD_PX-12);terrainLayer.addChild(shade);
}
function scatterGrass(t,p,r){const R=rng(t.id);const g=new PIXI.Graphics();for(let i=0;i<220;i++){const a=R()*Math.PI*2,rr=Math.sqrt(R())*r,x=p.x+Math.cos(a)*rr,y=p.y+Math.sin(a)*rr;g.lineStyle(1,0x78915b,.15+R()*.18).moveTo(x,y).lineTo(x+(R()-.5)*3,y-3-R()*4)}terrainLayer.addChild(g)}
function scatterForest(t,p,r){const R=rng(t.id);for(let i=0;i<46;i++){const a=R()*Math.PI*2,rr=Math.sqrt(R())*r*.96,x=p.x+Math.cos(a)*rr,y=p.y+Math.sin(a)*rr;const c=new PIXI.Graphics();const sz=10+R()*12;c.beginFill(color.shadow,.2).drawEllipse(x+3,y+5,sz*.8,sz*.45).endFill();c.beginFill(i%3?color.forestDark:0x375440,.92).drawCircle(x,y,sz).endFill();c.beginFill(0x456349,.65).drawCircle(x-4,y-4,sz*.62).endFill();terrainLayer.addChild(c)}}
function scatterWetland(t,p,r){const R=rng(t.id);const g=new PIXI.Graphics();for(let i=0;i<72;i++){const a=R()*Math.PI*2,rr=Math.sqrt(R())*r,x=p.x+Math.cos(a)*rr,y=p.y+Math.sin(a)*rr;g.lineStyle(2,0x708956,.45).moveTo(x,y+5).lineTo(x+(R()-.5)*3,y-8-R()*10)}terrainLayer.addChild(g)}
function drawCreekFromGeometry(){const creek=(current.worldModel?.objects||[]).find(o=>o.type==='creek_segment');if(!creek?.geometry?.points)return;const pts=creek.geometry.points.map(([x,y])=>wp({x,y}));const depth=current.worldModel?.fields?.waterDepth?.objects?.[creek.id]??.42;const bank=new PIXI.Graphics();bank.lineStyle(38+depth*10,color.bank,.65);bank.moveTo(pts[0].x,pts[0].y);pts.slice(1).forEach(p=>bank.lineTo(p.x,p.y));terrainLayer.addChild(bank);const water=new PIXI.Graphics();water.lineStyle(27+depth*10,color.water,.92);water.moveTo(pts[0].x,pts[0].y);pts.slice(1).forEach(p=>water.lineTo(p.x,p.y));terrainLayer.addChild(water);const glint=new PIXI.Graphics();glint.lineStyle(5,0xbde4e9,.22);glint.moveTo(pts[0].x,pts[0].y-3);pts.slice(1).forEach(p=>glint.lineTo(p.x,p.y-3));terrainLayer.addChild(glint)}

function makeSelectable(display,data,kind='object'){
  display.eventMode='static';display.cursor='pointer';display.on('pointertap',e=>{e.stopPropagation();openInspector(data,kind)});selectables.set(data.id,display);return display;
}
function labelFor(c,text){const t=new PIXI.Text(text,{fontFamily:'Arial',fontSize:12,fill:0xe7efe4,stroke:0x0b110c,strokeThickness:4});t.anchor.set(.5);t.y=26;t.alpha=.0;c.addChild(t);c.on('pointerover',()=>t.alpha=.95);c.on('pointerout',()=>t.alpha=0);return t}
function drawObject(o){
  const p=wp(o.position),c=new PIXI.Container();c.position.set(p.x,p.y);c.zIndex=p.y;const R=rng(o.id);let g=new PIXI.Graphics();
  if(o.type==='camp_area'){g.beginFill(0xb99b62,.08).drawEllipse(0,0,95,65).endFill();g.lineStyle(1,0xd7c681,.12).drawEllipse(0,0,95,65)}
  else if(o.type==='berry_patch'){for(let i=0;i<9;i++){const x=(R()-.5)*80,y=(R()-.5)*46,sz=9+R()*8;g.beginFill(color.leaf,.95).drawCircle(x,y,sz).endFill();const fruit=Math.max(0,o.state?.ediblePortions||0);if(i<fruit)g.beginFill(color.berry,.95).drawCircle(x+(R()-.5)*10,y+(R()-.5)*8,2.5).endFill()}}
  else if(o.type==='fallen_tree'){const len=(o.geometry?.lengthM||4.8)*22;g.lineStyle(18,color.woodDark,.98).moveTo(-len/2,0).lineTo(len/2,0);g.lineStyle(12,color.wood,.98).moveTo(-len/2,0).lineTo(len/2,0);for(let i=0;i<4;i++){const x=-len*.32+i*len*.2,dir=i%2?-1:1;g.lineStyle(6,color.woodDark,.94).moveTo(x,0).lineTo(x+dir*(18+R()*18),dir*(14+R()*18))}c.rotation=((o.geometry?.orientationDeg||0)-90)*Math.PI/180}
  else if(o.type==='stone_field'){for(let i=0;i<14;i++){const a=R()*Math.PI*2,rr=Math.sqrt(R())*65,x=Math.cos(a)*rr,y=Math.sin(a)*rr*.55,sz=5+R()*8;g.beginFill(i%2?color.rock:color.rockDark,.96).drawEllipse(x,y,sz,sz*.72).endFill()}}
  else if(o.type==='clay_bank'){g.beginFill(color.clay,.78).drawEllipse(0,0,70,36).endFill();g.lineStyle(3,0xc48b64,.28).drawEllipse(-7,-4,45,21);for(let i=0;i<8;i++)g.beginFill(0x744c38,.25).drawCircle((R()-.5)*100,(R()-.5)*46,2+R()*3).endFill()}
  else if(o.type==='reed_marsh'){for(let i=0;i<35;i++){const x=(R()-.5)*95,y=(R()-.5)*75,h=18+R()*35;g.lineStyle(2,color.reed,.85).moveTo(x,y+8).lineTo(x+(R()-.5)*5,y-h);if(i%3===0)g.beginFill(0x7c613b,.8).drawEllipse(x,y-h,2,6).endFill()}}
  else if(o.type==='frontier'){for(let i=0;i<9;i++){g.beginFill(0xc8d0c8,.055+R()*.04).drawCircle((R()-.5)*160,(R()-.5)*170,55+R()*65).endFill()}}
  else if(o.type==='branch_shelter'){g.beginFill(0x5b4330,.92).moveTo(-40,22).lineTo(0,-37).lineTo(44,22).lineTo(30,22).lineTo(0,-18).lineTo(-25,22).closePath().endFill();g.lineStyle(3,0x8a6743,.8).moveTo(-35,20).lineTo(0,-34).lineTo(38,20)}
  else if(o.type==='camp_fire'){const glow=new PIXI.Graphics();glow.beginFill(color.fire2,.12).drawCircle(0,0,52).endFill();c.addChild(glow);g.beginFill(color.woodDark,.95).drawRoundedRect(-22,8,44,6,3).endFill();g.rotation=.2;const f=new PIXI.Graphics();f.beginFill(color.fire,.95).drawPolygon([-9,10,0,-20,9,10]).endFill();f.beginFill(color.fire2,.9).drawPolygon([-5,8,0,-10,5,8]).endFill();f.name='flame';c.addChild(f)}
  else if(o.type==='drying_rack'){g.lineStyle(5,color.wood,.95).moveTo(-30,18).lineTo(-20,-20).moveTo(30,18).lineTo(20,-20).moveTo(-25,-8).lineTo(25,-8);for(let i=-15;i<=15;i+=10)g.lineStyle(2,0x8e7652,.8).moveTo(i,-8).lineTo(i,14)}
  else if(o.type==='animal_tracks'){for(let i=0;i<7;i++){const x=i*10-30,y=(i%2?5:-5)+i*2;g.beginFill(0x241b15,.52).drawEllipse(x,y,4,6).endFill();g.beginFill(0x241b15,.4).drawCircle(x-4,y-4,2).drawCircle(x,y-6,2).drawCircle(x+4,y-4,2).endFill()}}
  else return;
  c.addChildAt(g,0);makeSelectable(c,o);if(!['camp_area','frontier'].includes(o.type))labelFor(c,o.label);objectLayer.addChild(c)
}
function drawComponent(o){const p=wp(o.position),c=new PIXI.Container();c.position.set(p.x,p.y);c.zIndex=p.y+2;const g=new PIXI.Graphics();if(o.type==='branch')g.lineStyle(5,color.wood,.98).moveTo(-14,0).lineTo(14,0);else if(o.type==='rock')g.beginFill(color.rock,.96).drawEllipse(0,0,8,6).endFill();else if(o.type==='berry_bush')g.beginFill(color.leaf,.96).drawCircle(0,0,11).endFill();else if(o.type==='clay_deposit')g.beginFill(color.clay,.9).drawEllipse(0,0,12,7).endFill();else if(o.type==='reed_stand'){for(let i=-8;i<=8;i+=4)g.lineStyle(2,color.reed,.9).moveTo(i,8).lineTo(i+(i%3),-18-Math.abs(i))}else return;c.addChild(g);makeSelectable(c,o);labelFor(c,o.label);objectLayer.addChild(c)}
function drawArtifact(a){const p=wp(a.coordinates||{x:50,y:50}),c=new PIXI.Container();c.position.set(p.x+10,p.y-8);c.zIndex=p.y+6;const g=new PIXI.Graphics();const type=a.type||'';if(type.includes('ClayVessel')){g.lineStyle(2,0xd3a67f,.9).beginFill(0x9a694c,.95).drawEllipse(0,3,8,10).endFill().moveTo(-6,-4).lineTo(6,-4)}else if(type.includes('sharpStone'))g.beginFill(0x9ba49d,.96).drawPolygon([-9,7,0,-9,8,6]).endFill();else if(type.includes('Pole'))g.lineStyle(4,color.wood,.96).moveTo(-15,8).lineTo(15,-8);else if(type.includes('cordage'))g.lineStyle(3,0xb49a63,.9).drawCircle(0,0,8);else g.beginFill(0xd5c58c,.9).drawCircle(0,0,5).endFill();c.addChild(g);makeSelectable(c,a,'artifact');artifactLayer.addChild(c)}

function phaseState(a){const plan=a.activeAction,p=heartbeatProgress();if(!plan?.phases?.length)return{phase:'idle',label:'Between actions',x:a.coordinates?.x??50,y:a.coordinates?.y??50};const phase=plan.phases.find(x=>p>=x.start&&p<x.end)||plan.phases.at(-1),from=plan.from||a.coordinates,to=plan.to||a.coordinates;let x=to.x,y=to.y;if(plan.moving){const travel=plan.phases.find(x=>x.id==='travel');if(travel&&p<travel.start){x=from.x;y=from.y}else if(travel&&p<travel.end){const q=clamp((p-travel.start)/(travel.end-travel.start),0,1);x=from.x+(to.x-from.x)*q;y=from.y+(to.y-from.y)*q}}return{phase:phase.id,label:phase.label,x,y}}
function heartbeatProgress(){if(!current)return 1;const t=current.meta?.lastAdvancedAt?new Date(current.meta.lastAdvancedAt).getTime():Date.now(),period=(current.meta?.heartbeatMinutes||5)*60000;return clamp((Date.now()-t)/period,0,1)}
function createAgentSprite(a,index){const c=new PIXI.Container();c.zIndex=999;const shadow=new PIXI.Graphics();shadow.beginFill(color.shadow,.32).drawEllipse(0,13,16,7).endFill();const legs=new PIXI.Graphics();legs.lineStyle(5,0x2a302c,1).moveTo(-5,7).lineTo(-7,18).moveTo(5,7).lineTo(7,18);legs.name='legs';const body=new PIXI.Graphics();body.beginFill(index?color.ivo:color.mara).drawRoundedRect(-10,-8,20,25,7).endFill();body.name='body';const head=new PIXI.Graphics();head.beginFill(index?0xb78b70:0xc69a7a).drawCircle(0,-16,8).endFill();head.name='head';const arm=new PIXI.Graphics();arm.lineStyle(4,index?0x555879:0x55705d,1).moveTo(7,-1).lineTo(14,8);arm.name='arm';const name=new PIXI.Text(a.name,{fontFamily:'Arial',fontSize:12,fontWeight:'600',fill:0xf0f5ed,stroke:0x0b110c,strokeThickness:4});name.anchor.set(.5);name.y=-34;const action=new PIXI.Text('',{fontFamily:'Arial',fontSize:9,fill:0xb8c7b8,stroke:0x0b110c,strokeThickness:3});action.anchor.set(.5);action.y=29;c.addChild(shadow,legs,body,head,arm,name,action);c.eventMode='static';c.cursor='pointer';c.on('pointertap',e=>{e.stopPropagation();openInspector(a,'agent')});c._parts={legs,body,head,arm,action};agentLayer.addChild(c);agents.set(a.id,c);return c}
function renderAgents(){if(!current)return;current.agents.forEach((a,i)=>{let c=agents.get(a.id);if(!c)c=createAgentSprite(a,i);c._data=a})}

function tick(delta){if(!current)return;const t=performance.now()/1000;current.agents.forEach((a,i)=>{const c=agents.get(a.id);if(!c)return;const s=phaseState(a),p=wp(s);c.position.set(p.x,p.y);c.zIndex=p.y+20;const parts=c._parts;parts.action.text=s.phase==='travel'?'walking':s.phase==='interact'?(a.currentAction||'working').toLowerCase().slice(0,22):s.phase==='resolve'?'finishing':'idle';const isTalk=/talk/i.test(a.currentAction||a.mind?.intent||''),isRest=/rest/i.test(a.currentAction||a.mind?.intent||'');if(s.phase==='travel'){parts.legs.rotation=Math.sin(t*9+i)*.18;parts.body.y=Math.sin(t*9+i)*1.2;parts.arm.rotation=-Math.sin(t*9+i)*.14;c.rotation=0}else if(isRest){parts.legs.rotation=.35;parts.body.rotation=-.18;parts.body.y=7;parts.head.y=5;parts.arm.rotation=.5;c.rotation=.02}else if(s.phase==='interact'){parts.arm.rotation=Math.sin(t*6+i)*.35;parts.body.y=Math.sin(t*5+i)*.7;parts.legs.rotation=0;c.rotation=0}else{parts.legs.rotation=0;parts.body.rotation=0;parts.body.y=Math.sin(t*2+i)*.35;parts.head.y=0;parts.arm.rotation=0;c.rotation=0}if(isTalk&&s.phase!=='travel')parts.action.text='talking';});animateFire(t);animateRain(delta);updateCamera(false)}
function animateFire(t){for(const c of objectLayer.children){const f=c.getChildByName?.('flame');if(f){f.scale.y=.85+Math.sin(t*8)*.14;f.rotation=Math.sin(t*5)*.07}}}

let rainDrops=[];
function drawScreenFx(){if(!app)return;screenFx.removeChildren().forEach(d=>d.destroy({children:true}));rainDrops=[];const fields=current?.worldModel?.fields||{};const precip=fields.precipitation?.global||0;if(precip>0){for(let i=0;i<Math.round(45+precip*45);i++){const g=new PIXI.Graphics();g.lineStyle(1,0xcde6e9,.16+Math.random()*.18).moveTo(0,0).lineTo(-4,10+Math.random()*8);g.x=Math.random()*app.screen.width;g.y=Math.random()*app.screen.height;g._speed=5+Math.random()*8;screenFx.addChild(g);rainDrops.push(g)}}const light=fields.light?.global??.5;const darkness=clamp(.55-light*.58,0,.5);if(darkness>.02){const g=new PIXI.Graphics();g.beginFill(0x07101a,darkness).drawRect(0,0,app.screen.width,app.screen.height).endFill();g.eventMode='none';screenFx.addChild(g)}}
function animateRain(delta){for(const d of rainDrops){d.y+=d._speed*delta;d.x-=d._speed*.26*delta;if(d.y>app.screen.height+20){d.y=-20;d.x=Math.random()*app.screen.width}if(d.x<-20)d.x=app.screen.width+20}}

function wireCamera(){
  const canvas=app.view;let drag=null;
  canvas.addEventListener('pointerdown',e=>{drag={id:e.pointerId,x:e.clientX,y:e.clientY,cx:camera.x,cy:camera.y,moved:false};canvas.setPointerCapture?.(e.pointerId);$('#worldViewport').classList.add('dragging')});
  canvas.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.abs(dx)+Math.abs(dy)>5)drag.moved=true;if(drag.moved){camera.mode='free';camera.manualUntil=Date.now()+30000;camera.x=drag.cx-dx/camera.scale;camera.y=drag.cy-dy/camera.scale;syncButtons();updateCamera(true)}});
  const end=e=>{if(drag?.id===e.pointerId)drag=null;$('#worldViewport').classList.remove('dragging')};canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);
  canvas.addEventListener('wheel',e=>{e.preventDefault();camera.mode='free';camera.manualUntil=Date.now()+30000;const old=camera.scale,next=clamp(old*Math.exp(-e.deltaY*.001),.34,2.2);const rect=canvas.getBoundingClientRect(),sx=e.clientX-rect.left,sy=e.clientY-rect.top;const wx=(sx-app.screen.width/2)/old+camera.x,wy=(sy-app.screen.height/2)/old+camera.y;camera.scale=next;camera.x=wx-(sx-app.screen.width/2)/next;camera.y=wy-(sy-app.screen.height/2)/next;syncButtons();updateCamera(true)},{passive:false});
}
function fitWorld(){if(!current)return;const objs=(current.worldModel.objects||[]).filter(o=>o.state?.active!==false&&o.position&&o.type!=='frontier');if(!objs.length)return;const pts=objs.map(o=>wp(o.position));const minX=Math.min(...pts.map(p=>p.x))-180,maxX=Math.max(...pts.map(p=>p.x))+180,minY=Math.min(...pts.map(p=>p.y))-180,maxY=Math.max(...pts.map(p=>p.y))+180;camera.x=(minX+maxX)/2;camera.y=(minY+maxY)/2;camera.scale=clamp(Math.min(app.screen.width/(maxX-minX),app.screen.height/(maxY-minY))*.88,.4,1.25);camera.mode='auto';syncButtons();updateCamera(true)}
function focusAgent(id){const a=current?.agents?.find(a=>a.id===id);if(!a)return;camera.mode=id;camera.manualUntil=0;syncButtons();updateCamera(true)}
function autoTarget(){if(!current)return{x:WORLD_PX*.5,y:WORLD_PX*.63};let a=null;const top=current.liveThreads?.[0];if(top?.agentIds?.length)a=current.agents.find(x=>x.id===top.agentIds[0]);if(!a)a=current.agents.find(x=>x.activeAction?.moving)||current.agents.find(x=>x.activeAction?.physicalProposal)||current.agents[0];return wp(phaseState(a))}
function updateCamera(force){if(!root||!app)return;let target={x:camera.x,y:camera.y};if(camera.mode==='auto'&&Date.now()>camera.manualUntil)target=autoTarget();else if(camera.mode.startsWith('agent-')){const a=current?.agents?.find(a=>a.id===camera.mode);if(a)target=wp(phaseState(a))}const speed=force?1:.055;camera.x+=(target.x-camera.x)*speed;camera.y+=(target.y-camera.y)*speed;root.scale.set(camera.scale);root.position.set(app.screen.width/2-camera.x*camera.scale,app.screen.height/2-camera.y*camera.scale)}

function wireUI(){
  document.querySelectorAll('[data-camera]').forEach(b=>b.addEventListener('click',()=>{const m=b.dataset.camera;if(m==='auto'){camera.mode='auto';camera.manualUntil=0;syncButtons()}else focusAgent(m)}));
  $('#zoomIn')?.addEventListener('click',()=>{camera.scale=clamp(camera.scale*1.2,.34,2.2);camera.mode='free';camera.manualUntil=Date.now()+30000;syncButtons();updateCamera(true)});
  $('#zoomOut')?.addEventListener('click',()=>{camera.scale=clamp(camera.scale/1.2,.34,2.2);camera.mode='free';camera.manualUntil=Date.now()+30000;syncButtons();updateCamera(true)});
  $('#fitWorld')?.addEventListener('click',fitWorld);$('#closeInspector')?.addEventListener('click',()=>$('#inspector').classList.remove('open'));
}
function syncButtons(){document.querySelectorAll('[data-camera]').forEach(b=>b.classList.toggle('active',b.dataset.camera===camera.mode))}

function renderUI(){
  const status=$('#worldStatus');if(status){status.innerHTML=`<strong>● OBJECT WORLD · ${esc(current.version||'?')}</strong><span>Day ${current.day} · ${String(current.hour).padStart(2,'0')}:00 · ${Math.round(current.temperature)}°F · ${esc(current.weather)}</span>`}
  const threads=$('#threads');if(threads){const list=current.liveThreads||[];threads.innerHTML=list.length?list.map(t=>`<article class="thread ${t.urgency>=85?'urgent':t.urgency>=60?'high':''}"><b>${esc(t.title)}</b><p>${esc(t.summary)}</p><small>${esc(t.kind)} · urgency ${t.urgency}</small></article>`).join(''):'<article class="thread"><b>Quiet stretch</b><p>No high-signal unresolved thread right now.</p></article>';$('#threadCount').textContent=`${list.length} active thread${list.length===1?'':'s'}`}
  updateFocusCard();
}
function updateFocusCard(){if(!current)return;let a=camera.mode.startsWith('agent-')?current.agents.find(x=>x.id===camera.mode):null;if(!a){const top=current.liveThreads?.[0];a=(top?.agentIds?.length&&current.agents.find(x=>x.id===top.agentIds[0]))||current.agents[0]}if(!a)return;const s=phaseState(a);$('#focusCard').innerHTML=`<div class="focusInner"><small>${esc(s.label).toUpperCase()} · ${esc(a.position).toUpperCase()}</small><strong>${esc(a.name)} — ${esc(a.mind?.currentGoal||a.currentAction||'Responding to the world')}</strong><p>${esc(a.mind?.intent||a.currentAction||'')}</p></div>`}

function openInspector(data,kind){
  const panel=$('#inspector'),title=$('#inspectTitle'),type=$('#inspectType'),body=$('#inspectBody');if(!panel)return;type.textContent=kind==='agent'?'AUTONOMOUS AGENT':kind==='artifact'?'PERSISTENT ARTIFACT':'CANONICAL WORLD OBJECT';title.textContent=data.name||data.label||data.id;
  if(kind==='agent')body.innerHTML=agentInspector(data);else if(kind==='artifact')body.innerHTML=artifactInspector(data);else body.innerHTML=objectInspector(data);panel.classList.add('open')
}
function flatten(obj,prefix=''){const out=[];for(const[k,v]of Object.entries(obj||{})){if(v==null)continue;const key=prefix?`${prefix}.${k}`:k;if(typeof v==='object'&&!Array.isArray(v))out.push(...flatten(v,key));else out.push([key,Array.isArray(v)?v.join(', '):String(v)])}return out}
function objectInspector(o){const physical=Object.entries(o.physical||{}).filter(([,v])=>v===true).map(([k])=>k);const props=[['ID',o.id],['Type',o.type],['Zone',o.zone],['Resolution',o.resolution?.level||'—'],['Parent',o.parentId||'independent'],['Position',`${o.position?.x?.toFixed?.(1)??o.position?.x}, ${o.position?.y?.toFixed?.(1)??o.position?.y}`]];const material=flatten(o.material||{}).slice(0,8);const state=flatten(o.state||{}).slice(0,8);return `<div class="kv">${props.map(([k,v])=>`<span>${esc(k)}</span><b>${esc(v)}</b>`).join('')}</div><div class="pillRow">${physical.map(x=>`<span class="pill">${esc(x)}</span>`).join('')}</div>${material.length?`<div class="kv">${material.map(([k,v])=>`<span>${esc(k)}</span><b>${esc(v)}</b>`).join('')}</div>`:''}${state.length?`<div class="kv">${state.map(([k,v])=>`<span>state.${esc(k)}</span><b>${esc(v)}</b>`).join('')}</div>`:''}<div class="historyList"><h3>OBJECT HISTORY</h3>${(o.history||[]).slice(-7).reverse().map(h=>`<div class="historyItem">D${h.day} ${String(h.hour).padStart(2,'0')}:00 · ${esc(h.detail||h.type)}</div>`).join('')||'<div class="historyItem">No recorded object-specific events yet.</div>'}</div>`}
function agentInspector(a){const n=a.needs||{};return `<div class="kv"><span>ID</span><b>${esc(a.id)}</b><span>Location</span><b>${esc(a.position)}</b><span>Hydration</span><b>${Math.round(n.hydration||0)}%</b><span>Satiety</span><b>${Math.round(n.hunger||0)}%</b><span>Energy</span><b>${Math.round(n.energy||0)}%</b><span>Warmth</span><b>${Math.round(n.warmth||0)}%</b><span>Brain</span><b>${esc(a.mind?.brainMode||'unknown')}</b><span>Goal</span><b>${esc(a.mind?.currentGoal||'—')}</b><span>Intent</span><b>${esc(a.mind?.intent||a.currentAction||'—')}</b></div><div class="pillRow">${Object.keys(a.skills||{}).map(s=>`<span class="pill">${esc(s)}</span>`).join('')}</div><div class="historyList"><h3>RECENT MEMORIES</h3>${(a.memories||[]).slice(0,6).map(m=>`<div class="historyItem">${esc(m.text)}</div>`).join('')}</div>`}
function artifactInspector(a){return `<div class="kv"><span>ID</span><b>${esc(a.id)}</b><span>Type</span><b>${esc(a.type)}</b><span>Status</span><b>${esc(a.status)}</b><span>Carrier</span><b>${esc(a.carrierId||'none')}</b><span>Position</span><b>${esc(a.position)}</b><span>Created</span><b>Day ${a.created?.day??'?'} · ${String(a.created?.hour??0).padStart(2,'0')}:00</b><span>Provenance</span><b>${esc(a.provenance||'—')}</b></div><div class="pillRow">${(a.properties||[]).map(p=>`<span class="pill">${esc(p)}</span>`).join('')}</div>`}

function drawMiniMap(){const c=$('#miniMapCanvas');if(!c||!current)return;const dpr=Math.min(devicePixelRatio||1,2),r=c.getBoundingClientRect();c.width=r.width*dpr;c.height=r.height*dpr;const x=c.getContext('2d');x.scale(dpr,dpr);x.fillStyle='#15251a';x.fillRect(0,0,r.width,r.height);const sx=r.width/100,sy=r.height/100;const creek=(current.worldModel.objects||[]).find(o=>o.type==='creek_segment');if(creek?.geometry?.points){x.strokeStyle='#68a9bd';x.lineWidth=3;x.beginPath();creek.geometry.points.forEach(([px,py],i)=>{const X=px*sx,Y=(100-py)*sy;i?x.lineTo(X,Y):x.moveTo(X,Y)});x.stroke()}for(const o of current.worldModel.objects||[]){if(o.state?.active===false||!o.position)continue;x.fillStyle=o.kind==='structure'?'#d2ad69':o.physical?.biological?'#75a35d':'#a1aaa2';x.beginPath();x.arc(o.position.x*sx,(100-o.position.y)*sy,2,0,Math.PI*2);x.fill()}for(const a of current.agents){x.fillStyle=a.id.endsWith('mara')?'#9bd6a9':'#a9acd9';x.beginPath();x.arc(a.coordinates.x*sx,(100-a.coordinates.y)*sy,3,0,Math.PI*2);x.fill()}}

init().catch(e=>{console.error(e);const l=$('#loading');if(l)l.innerHTML=`<div class="loadingBox"><div class="loadingMark">!</div><strong>Renderer failed to start</strong><p>${esc(e.message||e)}</p></div>`});
})();