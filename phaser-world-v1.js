(()=>{
'use strict';

const RAW='https://raw.githubusercontent.com/kyle8824/chatgptfarm/main/world/state.json';
const ASSET_REV='e0cbe0d995554a490d4c182fe9beb8769ffbb606';
const ASSET_ROOT=`https://raw.githubusercontent.com/Tiddybub/2d-assets/${ASSET_REV}`;
const TINY_FARM_ROOT=`${ASSET_ROOT}/fantasy/tiny-farm/Tiles`;
const TILE=24, UNITS=100, WORLD=TILE*UNITS, POLL_MS=12000, MOVE_MS=9000, SURFACE=640;
const TERRAIN={MEADOW:0,FOREST:1,WETLAND:2,BANK:3,WATER:4};
const COLORS={
 meadow:'#73895f', meadow2:'#83966d', forest:'#4d684b', forest2:'#3f5c42', wet:'#5f7b67', wet2:'#668473',
 bank:'#84745a', bank2:'#6f604b', water:'#5f9fb6', water2:'#467b94', mud:'#685b45', clay:'#a96f4d', rock:'#8c9690',
 shadow:'#17251b', text:'#f2f7ef', mara:'#78ac85', ivo:'#8589c5'
};
const $=s=>document.querySelector(s);
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const hash=s=>{let h=2166136261;for(const c of String(s)){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0};
const seeded=s=>{let x=hash(s)||1;return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return(x>>>0)/4294967296}};
const dist=(a,b)=>Math.hypot((a?.x||0)-(b?.x||0),(a?.y||0)-(b?.y||0));
const worldToPx=p=>({x:(p?.x??50)*TILE,y:(UNITS-(p?.y??50))*TILE});
const pxToWorld=p=>({x:p.x/TILE,y:UNITS-p.y/TILE});
const lerp=(a,b,t)=>a+(b-a)*t;
const smooth=t=>t*t*(3-2*t);
const mixRGB=(a,b,t)=>[lerp(a[0],b[0],t),lerp(a[1],b[1],t),lerp(a[2],b[2],t)];
function rand2(ix,iy,seed=9176){let n=(Math.imul(ix,374761393)^Math.imul(iy,668265263)^Math.imul(seed,69069))|0;n=Math.imul(n^(n>>>13),1274126177);return((n^(n>>>16))>>>0)/4294967295}
function valueNoise(x,y,seed=9176){const x0=Math.floor(x),y0=Math.floor(y),tx=smooth(x-x0),ty=smooth(y-y0),a=rand2(x0,y0,seed),b=rand2(x0+1,y0,seed),c=rand2(x0,y0+1,seed),d=rand2(x0+1,y0+1,seed);return lerp(lerp(a,b,tx),lerp(c,d,tx),ty)}
function fbm(x,y){return valueNoise(x,y,511)*.55+valueNoise(x*2.07,y*2.07,991)*.28+valueNoise(x*4.11,y*4.11,1559)*.17}
let canonical=null,lastTick=null,sceneRef=null,cameraMode='auto',assetErrors=[];

function segmentDistance(p,a,b){const vx=b.x-a.x,vy=b.y-a.y,wx=p.x-a.x,wy=p.y-a.y,c=vx*vx+vy*vy||1,t=clamp((wx*vx+wy*vy)/c,0,1),x=a.x+t*vx,y=a.y+t*vy;return Math.hypot(p.x-x,p.y-y)}
function creekObject(w=canonical){return(w?.worldModel?.objects||[]).find(o=>o.id==='OBJ-CREEK-001'||o.type==='creek_segment')}
function creekPoints(w=canonical){return(creekObject(w)?.geometry?.points||[]).map(([x,y])=>({x,y}))}
function creekDistance(p,w=canonical){const pts=creekPoints(w);let d=Infinity;for(let i=0;i<pts.length-1;i++)d=Math.min(d,segmentDistance(p,pts[i],pts[i+1]));return d}
function terrainInfluence(t,p,w=canonical){const m=w?.worldModel?.bounds?.metersPerUnit||2,r=(t.radiusM||20)/m;return clamp(1-dist(t.center,p)/r,0,1)}
function terrainTypeAt(p,w=canonical){const m=w?.worldModel?.bounds?.metersPerUnit||2,creek=creekObject(w),waterHalf=Math.max(1.35,((creek?.geometry?.widthM||5)/m)/2),cd=creekDistance(p,w);if(cd<=waterHalf)return TERRAIN.WATER;if(cd<=waterHalf+1.75)return TERRAIN.BANK;let wet=0,forest=0;for(const t of w?.worldModel?.terrain||[]){const q=terrainInfluence(t,p,w);if(t.type==='wetland')wet=Math.max(wet,q);if(t.type==='forest')forest=Math.max(forest,q)}if(wet>.18)return TERRAIN.WETLAND;if(forest>.16)return TERRAIN.FOREST;return TERRAIN.MEADOW}
function objectRadiusUnits(o,w=canonical){const g=o?.geometry||{},m=w?.worldModel?.bounds?.metersPerUnit||2;if(Number.isFinite(g.radiusM))return g.radiusM/m;if(Number.isFinite(g.widthM))return Math.max(1,g.widthM/(2*m));if(Number.isFinite(g.lengthM))return Math.max(1,g.lengthM/(2*m));return 1.2}
function blocksTree(p,w=canonical){const ignore=new Set(['OBJ-CREEK-001','OBJ-FRONTIER-001']);for(const o of w?.worldModel?.objects||[]){if(o.state?.active===false||o.parentId||ignore.has(o.id)||!o.position)continue;if(dist(p,o.position)<objectRadiusUnits(o,w)+1.2)return true}return false}
function buildTerrainGrid(w){const rows=[];const counts={meadow:0,forest:0,wetland:0,bank:0,water:0};for(let row=0;row<UNITS;row++){const line=[];for(let col=0;col<UNITS;col++){const p={x:col+.5,y:UNITS-(row+.5)},type=terrainTypeAt(p,w);line.push(type);counts[['meadow','forest','wetland','bank','water'][type]]++}rows.push(line)}return{rows,counts}}
function canonicalAgentPoint(a,w=canonical){if(a?.coordinates&&Number.isFinite(a.coordinates.x))return a.coordinates;const o=(w?.worldModel?.objects||[]).find(x=>!x.parentId&&x.zone===a?.position&&x.position);return o?.position||{x:50,y:50}}
function agentPresentationOffset(a,w=canonical){const mine=canonicalAgentPoint(a,w),near=(w?.agents||[]).some(x=>x.id!==a.id&&dist(mine,canonicalAgentPoint(x,w))<.35);let x=near?(a.id==='agent-mara'?-14:14):0,y=near?(a.id==='agent-mara'?2:-2):0;const camp=(w?.worldModel?.objects||[]).find(o=>o.type==='camp_area'&&o.state?.active!==false);if(a?.position==='camp'&&camp?.position&&dist(mine,camp.position)<3.5){x+=a.id==='agent-mara'?-52:44;y+=a.id==='agent-mara'?18:10}return{x,y}}
function currentPhase(a){const active=a?.activeAction;if(!active)return{phase:'idle',label:'IDLE'};const p=(active.phases||[]).find(x=>x.id==='travel'&&active.moving)||(active.phases||[]).find(x=>x.id==='interact')||(active.phases||[]).at(-1);return{phase:p?.id||'acting',label:String(p?.label||'ACTING').toUpperCase()}}
function focusAgent(w=canonical){const urgent=(w?.liveThreads||[]).slice().sort((a,b)=>(b.urgency||0)-(a.urgency||0))[0],id=urgent?.agentIds?.[0];return(w?.agents||[]).find(a=>a.id===id)||(w?.agents||[])[0]||null}

class LivingWorld extends Phaser.Scene{
 constructor(){super('LivingWorld');this.entities=new Map();this.treeSprites=[];this.ambient=[];this.traceVisuals=[];this.signVisuals=[];this.routeVisuals=[];this.resourceVisuals=[];this.decisionCue=null;this.lastDecisionCueId=null;this.lightOverlay=null;this.nightLights=[];this.grid=null;this.drag=null;this.assetOk={};this.lastRenderedTick=null}
 preload(){
  this.load.on('loaderror',file=>assetErrors.push(file?.key||file?.src||'asset'));
  const foliage=`${ASSET_ROOT}/nature/foliage-pack/PNG/Default%20size`;
  for(const n of ['004','005','006','007','008','009'])this.load.image(`tree-${n}`,`${foliage}/foliagePack_${n}.png`);
  for(const n of ['001','002','003'])this.load.image(`shrub-${n}`,`${foliage}/foliagePack_${n}.png`);
  const carto=`${ASSET_ROOT}/ui/cartography-pack/PNG/Default`;this.load.image('camp-tent',`${carto}/tent.png`);this.load.image('campfire-art',`${carto}/campfire.png`);
  this.load.image('person-mara-art',`${TINY_FARM_ROOT}/tile_0108.png`);this.load.image('person-ivo-art',`${TINY_FARM_ROOT}/tile_0109.png`);
  const animals=`${ASSET_ROOT}/characters/animal-pack-remastered/PNG/Round`;
  this.load.image('animal-bear',`${animals}/bear.png`);this.load.image('animal-rabbit',`${animals}/rabbit.png`);
  const fish=`${ASSET_ROOT}/characters/fish-pack/PNG/Default`;this.load.image('animal-fish',`${fish}/fish_brown.png`);this.load.image('shore-rock',`${fish}/rock_a.png`);
 }
 async create(){
  sceneRef=this;this.cameras.main.setBackgroundColor(COLORS.meadow);this.cameras.main.setBounds(0,0,WORLD,WORLD);this.cameras.main.roundPixels=true;this.cameras.main.setZoom(innerWidth<650?1.18:1.12);
  this.makeFallbackTextures();this.makeTerrainTextures();this.wireInput();this.wireUI();await this.loadState(true);this.time.addEvent({delay:POLL_MS,loop:true,callback:()=>this.loadState(false)});
 }
 makeFallbackTextures(){
  const make=(key,draw,w=72,h=88)=>{if(this.textures.exists(key))return;const g=this.make.graphics({x:0,y:0,add:false});draw(g,w,h);g.generateTexture(key,w,h);g.destroy()};
  make('fallback-tree',(g,w,h)=>{g.fillStyle(0x17251b,.18).fillEllipse(w/2,h-10,44,13);g.fillStyle(0x6a482e,1).fillRoundedRect(w/2-5,h-47,10,39,4);g.fillStyle(0x3f6844,1).fillCircle(w/2-17,35,21).fillCircle(w/2+17,34,23).fillCircle(w/2,18,27);g.fillStyle(0x62815e,.6).fillCircle(w/2-7,14,10)});
  make('person-mara',(g,w,h)=>{g.fillStyle(0x17251b,.17).fillEllipse(w/2,h-7,29,8);g.fillStyle(0x403d35,1).fillRoundedRect(20,57,6,13,3).fillRoundedRect(30,57,6,13,3);g.fillStyle(0x5e7867,1).fillRoundedRect(17,34,22,28,8);g.fillStyle(0xc99677,1).fillRoundedRect(11,38,7,22,4).fillRoundedRect(38,38,7,22,4);g.fillStyle(0x4a352f,1).fillEllipse(28,22,24,20).fillRoundedRect(16,21,7,22,4).fillRoundedRect(34,21,7,22,4);g.fillStyle(0xd2a184,1).fillCircle(28,26,10);g.fillStyle(0x3a2b28,1).fillEllipse(28,18,19,9);g.fillStyle(0x262824,1).fillCircle(24,27,1.3).fillCircle(32,27,1.3)},56,78);
  make('person-ivo',(g,w,h)=>{g.fillStyle(0x17251b,.17).fillEllipse(w/2,h-7,29,8);g.fillStyle(0x353a3a,1).fillRoundedRect(20,57,6,13,3).fillRoundedRect(30,57,6,13,3);g.fillStyle(0x66717a,1).fillRoundedRect(17,34,22,28,7);g.fillStyle(0xb9876e,1).fillRoundedRect(11,38,7,22,4).fillRoundedRect(38,38,7,22,4);g.fillStyle(0xbe8d72,1).fillCircle(28,26,10);g.fillStyle(0x302a27,1).fillEllipse(28,18,20,10);g.fillStyle(0x242622,1).fillCircle(24,27,1.3).fillCircle(32,27,1.3)},56,78);
  make('animal-deer',(g,w,h)=>{g.fillStyle(0x1b251d,.13).fillEllipse(36,72,42,9);g.fillStyle(0x806044,1).fillEllipse(34,49,37,20);g.fillRoundedRect(49,31,7,25,4);g.fillCircle(56,28,8);g.fillStyle(0x5b4433,1).fillTriangle(51,22,54,13,58,22).fillTriangle(59,22,64,15,64,24);g.lineStyle(3,0x5f4735,1).lineBetween(25,57,23,74).lineBetween(42,57,44,74);g.fillStyle(0xe7dfcf,.8).fillEllipse(18,48,6,5)},76,80);
  make('animal-rabbit-fallback',(g)=>{g.fillStyle(0x776f64,1).fillEllipse(33,50,29,18).fillCircle(48,42,10);g.fillEllipse(46,28,5,19).fillEllipse(53,29,5,18);g.fillStyle(0xeee9df,1).fillCircle(18,49,6);g.fillStyle(0x171a17,1).fillCircle(51,40,1.8)},68,70);
  make('animal-bear-fallback',(g)=>{g.fillStyle(0x312a27,1).fillEllipse(34,49,45,26).fillCircle(55,43,14);g.fillCircle(49,31,6).fillCircle(61,32,6);g.fillRoundedRect(20,55,7,13,3).fillRoundedRect(44,56,7,13,3);g.fillStyle(0x806b5b,1).fillEllipse(61,47,12,8);g.fillStyle(0x121512,1).fillCircle(65,44,2.2)},78,72);
  make('reeds',(g,w,h)=>{for(let i=0;i<7;i++){const x=8+i*6,hh=18+(i%3)*7;g.lineStyle(2,0x879b54,.95).lineBetween(x,h-4,x+(i%2?2:-1),h-hh);if(i%3===0)g.fillStyle(0x77552f,.9).fillEllipse(x,h-hh,4,10)}},52,48);
  make('berry-bush',(g)=>{g.fillStyle(0x3e713f,1).fillCircle(31,35,22).fillCircle(48,38,18).fillCircle(39,24,20);g.fillStyle(0xc74f5a,1);for(const [x,y] of [[27,29],[42,25],[49,39],[35,45]])g.fillCircle(x,y,3)},76,68);make('berry-bush-empty',(g)=>{g.fillStyle(0x3b693d,1).fillCircle(31,35,22).fillCircle(48,38,18).fillCircle(39,24,20);g.lineStyle(1.4,0x5b4d38,.7);g.lineBetween(28,48,42,20);g.lineBetween(38,39,51,30)},76,68);make('ambient-bird',(g)=>{g.lineStyle(3,0x263126,.85);g.beginPath();g.moveTo(4,9);g.lineTo(10,5);g.lineTo(16,9);g.strokePath()},20,14);
 }
 makeTerrainTextures(){
  const c=this.textures.createCanvas('terrain-sheet',TILE*5,TILE),ctx=c.getContext(),R=seeded('phaser-terrain-v1'),fills=[COLORS.meadow,COLORS.forest,COLORS.wet,'#6f7658',COLORS.water];for(let i=0;i<5;i++){ctx.fillStyle=fills[i];ctx.fillRect(i*TILE,0,TILE,TILE);for(let k=0;k<14;k++){ctx.globalAlpha=.05+R()*.09;ctx.fillStyle=i===4?'#d7edf0':i===3?'#342d24':'#dbe4c7';ctx.fillRect(i*TILE+R()*TILE,R()*TILE,1+R()*2,1+R()*2)}ctx.globalAlpha=1}c.refresh();c.setFilter(Phaser.Textures.FilterMode.NEAREST)
 }
 async fetchState(){let error=null;for(const u of [`${RAW}?v=${Date.now()}`,`./world/state.json?v=${Date.now()}`]){try{const r=await fetch(u,{cache:'no-store'});if(!r.ok)throw Error(String(r.status));const w=await r.json();if(w?.worldModel)return w}catch(e){error=e}}throw error||Error('No world state')}
 async loadState(first){try{const w=await this.fetchState(),changed=lastTick!==w.meta?.tickNumber;canonical=w;lastTick=w.meta?.tickNumber;if(first){this.buildWorld();this.renderEntities(true);this.updateHud();this.applyCamera(true);$('#phLoading')?.classList.add('hidden')}else if(changed){this.refreshDynamicWorld();this.updateHud();if(cameraMode==='auto')this.applyCamera(false)}}catch(e){console.error('Phaser world state load failed',e);$('#phWorldStatus').innerHTML='<b>WORLD OFFLINE</b><span>Could not read canonical state</span>'}}
 buildWorld(){
  this.grid=buildTerrainGrid(canonical);const map=this.make.tilemap({width:UNITS,height:UNITS,tileWidth:TILE,tileHeight:TILE}),tiles=map.addTilesetImage('terrain-sheet','terrain-sheet',TILE,TILE,0,0,0),layer=map.createBlankLayer('Canonical occupancy',tiles,0,0);for(let row=0;row<UNITS;row++)for(let col=0;col<UNITS;col++)layer.putTileAt(this.grid.rows[row][col],col,row);layer.setDepth(-100).setVisible(false);this.terrainLayer=layer;
  this.drawOrganicSurface();this.renderTravelWear();this.drawBiomeUnderlays();this.drawMeadowMosaic();this.drawCreekDetails();this.spawnGroundDetail();this.spawnForest();this.drawCanonicalObjects();this.renderResourceLandscape();this.renderCanonicalTraces();this.renderCanonicalSigns();this.renderEntities(true);this.updateDecisionCue(true);this.spawnAmbientLife();this.renderLightCycle();this.renderWeather();
 }
 drawOrganicSurface(){
  if(this.textures.exists('organic-surface'))this.textures.remove('organic-surface');const c=this.textures.createCanvas('organic-surface',SURFACE,SURFACE),ctx=c.getContext(),img=ctx.createImageData(SURFACE,SURFACE),data=img.data,terr=canonical.worldModel?.terrain||[];
  for(let y=0;y<SURFACE;y++){const wy=UNITS-y/SURFACE*UNITS;for(let x=0;x<SURFACE;x++){const wx=x/SURFACE*UNITS,p={x:wx,y:wy};let forest=0,wet=0;for(const t of terr){const q=terrainInfluence(t,p);if(t.type==='forest')forest=Math.max(forest,q);else if(t.type==='wetland')wet=Math.max(wet,q)}let col=[111,137,88];forest=smooth(clamp(forest*1.12,0,1));wet=smooth(clamp(wet*1.18,0,1));col=mixRGB(col,[58,86,57],forest*.82);col=mixRGB(col,[76,108,91],wet*.72);const cd=creekDistance(p),bank=smooth(clamp((4.9-cd)/3.5,0,1));col=mixRGB(col,[116,102,75],bank*.42);const n=fbm(wx*.075,wy*.075),fine=valueNoise(wx*.33,wy*.33,277),shade=.87+n*.22+(fine-.5)*.055,i=(y*SURFACE+x)*4;data[i]=clamp(col[0]*shade,0,255);data[i+1]=clamp(col[1]*shade,0,255);data[i+2]=clamp(col[2]*shade,0,255);data[i+3]=255}}
  ctx.putImageData(img,0,0);c.refresh();c.setFilter(Phaser.Textures.FilterMode.LINEAR);this.add.image(WORLD/2,WORLD/2,'organic-surface').setDisplaySize(WORLD,WORLD).setDepth(-20)
 }
 renderTravelWear(){
  for(const v of this.routeVisuals)v.destroy();this.routeVisuals=[];
  const now=(canonical?.day||1)*24+(canonical?.hour||0),routes=(canonical?.surfaceHistory?.routes||[]).filter(r=>(r.traversals||0)>=2);
  for(const r of routes){const p1=worldToPx(r.from),p2=worldToPx(r.to),last=(r.lastUsed?.day||canonical.day)*24+(r.lastUsed?.hour||0),age=Math.max(0,now-last),recency=clamp(1-age/168,.28,1),strength=clamp(((r.traversals||0)-1)/8,.12,1)*recency,R=seeded(`wear:${r.key||r.id}`),dx=p2.x-p1.x,dy=p2.y-p1.y,m=Math.hypot(dx,dy)||1,nx=-dy/m,ny=dx/m,bend=(10+R()*24)*(R()<.5?-1:1),ctrl=new Phaser.Math.Vector2((p1.x+p2.x)/2+nx*bend,(p1.y+p2.y)/2+ny*bend),curve=new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(p1.x,p1.y),ctrl,new Phaser.Math.Vector2(p2.x,p2.y)),points=curve.getPoints(30),segments=[];let seg=[];for(const p of points){const t=terrainTypeAt(pxToWorld(p));if(t===TERRAIN.WATER||t===TERRAIN.BANK){if(seg.length>1)segments.push(seg);seg=[]}else seg.push(p)}if(seg.length>1)segments.push(seg);const g=this.add.graphics().setDepth(28);for(const pts of segments){g.lineStyle(9,0x685b43,.025+.055*strength);g.strokePoints(pts,false,false);g.lineStyle(2.2,0x8b795b,.04+.095*strength);g.strokePoints(pts,false,false)}g.setData('kind','travel-wear');g.setData('routeId',r.id);g.setData('traversals',r.traversals||0);this.routeVisuals.push(g)}
 }
 drawBiomeUnderlays(){const m=canonical.worldModel?.bounds?.metersPerUnit||2,R=seeded('biome-floor-v1_3');for(const t of canonical.worldModel?.terrain||[]){if(!['forest','wetland'].includes(t.type))continue;const p=worldToPx(t.center),r=(t.radiusM||20)/m*TILE,col=t.type==='forest'?0x263d2d:0x445f54;for(let i=0;i<(t.type==='forest'?18:12);i++){const a=R()*Math.PI*2,rr=Math.sqrt(R())*r*.72,x=p.x+Math.cos(a)*rr,y=p.y+Math.sin(a)*rr*.72,w=35+R()*95,h=18+R()*48;this.add.ellipse(x,y,w,h,col,.045+R()*.045).setDepth(-5)}}}
 drawMeadowMosaic(){
  const R=seeded('meadow-mosaic-v1_4_3');
  for(let i=0;i<46;i++){
   const p={x:3+R()*94,y:3+R()*94};
   if(terrainTypeAt(p)!==TERRAIN.MEADOW)continue;
   const q=worldToPx(p),w=90+R()*220,h=42+R()*120,col=R()<.5?0x617754:0x80916b;
   this.add.ellipse(q.x,q.y,w,h,col,.025+R()*.035).setRotation((R()-.5)*.7).setDepth(-8);
  }
 }
 drawCreekDetails(){
  const src=creekPoints().map(worldToPx);if(src.length<2)return;const curve=new Phaser.Curves.Spline(src),sample=curve.getSpacedPoints(190),R=seeded('creek-ribbon-v1_3');
  const ribbon=(pad,scale=1)=>{const L=[],RR=[];for(let i=0;i<sample.length;i++){const p=sample[i],a=sample[Math.max(0,i-2)],b=sample[Math.min(sample.length-1,i+2)],dx=b.x-a.x,dy=b.y-a.y,m=Math.hypot(dx,dy)||1,nx=-dy/m,ny=dx/m,t=i/(sample.length-1),w=(29+5*Math.sin(t*11.7+1.2)+3.5*Math.sin(t*25.1+.3))*scale+pad;L.push({x:p.x+nx*w,y:p.y+ny*w});RR.push({x:p.x-nx*w,y:p.y-ny*w})}return L.concat(RR.reverse())};
  const fill=(g,pts,color,alpha=1)=>{g.fillStyle(color,alpha);g.beginPath();g.moveTo(pts[0].x,pts[0].y);for(let i=1;i<pts.length;i++)g.lineTo(pts[i].x,pts[i].y);g.closePath();g.fillPath()};
  const shadow=this.add.graphics().setDepth(3),bank=this.add.graphics().setDepth(4),moist=this.add.graphics().setDepth(5),water=this.add.graphics().setDepth(8),deep=this.add.graphics().setDepth(9);const out=ribbon(22),mid=ribbon(11),wet=ribbon(3),inner=ribbon(-9,.72);fill(shadow,out.map(p=>({x:p.x+3,y:p.y+6})),0x26382e,.24);fill(bank,out,0x665943,.98);fill(moist,mid,0x788066,.78);fill(water,wet,0x64a7b8,.98);fill(deep,inner,0x407b91,.32);
  const details=this.add.graphics().setDepth(10);details.lineStyle(1.2,0xd8eef0,.24);for(let i=10;i<sample.length-10;i+=18){const p=sample[i],p2=sample[i+2],dx=p2.x-p.x,dy=p2.y-p.y,m=Math.hypot(dx,dy)||1,nx=-dy/m,ny=dx/m,len=9+R()*17,off=(R()-.5)*16;details.beginPath();details.moveTo(p.x+nx*off-dx/m*len,p.y+ny*off-dy/m*len);details.lineTo(p.x+nx*off+dx/m*len,p.y+ny*off+dy/m*len);details.strokePath()}
  for(let i=7;i<sample.length-7;i+=7+Math.floor(R()*9)){const p=sample[i],p2=sample[Math.min(sample.length-1,i+2)],dx=p2.x-p.x,dy=p2.y-p.y,m=Math.hypot(dx,dy)||1,nx=-dy/m,ny=dx/m,side=R()<.5?-1:1,d=42+R()*16,q={x:p.x+nx*side*d,y:p.y+ny*side*d};if(R()<.6)this.add.ellipse(q.x,q.y,10+R()*22,5+R()*9,R()<.55?0x6c5b43:0x7e8360,.28+R()*.24).setDepth(12);if(R()<.44){const rr=this.add.image(q.x+(R()-.5)*9,q.y+(R()-.5)*6,'reeds').setOrigin(.5,1).setScale(.16+.11*R()).setAlpha(.75).setDepth(1000+q.y);this.tweens.add({targets:rr,angle:side*(.8+R()*1.4),duration:1700+R()*1100,yoyo:true,repeat:-1,ease:'Sine.InOut'})}if(R()<.22)this.add.ellipse(q.x+(R()-.5)*14,q.y+(R()-.5)*8,5+R()*9,3+R()*5,0x90968d,.8).setDepth(1000+q.y)}this.riverCurve=curve
 }
 spawnGroundDetail(){
  const R=seeded('ground-life-v1_4_3');
  this.habitatDetail={meadow:0,edge:0,forest:0,wetland:0};
  const edgeOffsets=[[2,0],[-2,0],[0,2],[0,-2],[1.5,1.5],[-1.5,-1.5]];
  for(let i=0;i<980;i++){
   const p={x:1+R()*98,y:1+R()*98};
   const t=terrainTypeAt(p);
   if(t===TERRAIN.WATER||t===TERRAIN.BANK)continue;
   const q=worldToPx(p);
   let nearForest=false;
   if(t===TERRAIN.MEADOW){
    nearForest=edgeOffsets.some(([dx,dy])=>terrainTypeAt({x:clamp(p.x+dx,0,100),y:clamp(p.y+dy,0,100)})===TERRAIN.FOREST);
   }
   if(t===TERRAIN.FOREST){
    this.habitatDetail.forest++;
    if(R()<.57){
     const key='shrub-00'+(1+Math.floor(R()*3));
     if(this.textures.exists(key)){
      const b=this.add.image(q.x,q.y,key).setOrigin(.5,1).setScale(.12+.16*R()).setTint(R()<.5?0x62775b:0x52684f).setAlpha(.38+.32*R()).setDepth(900+q.y);
      if(R()<.1)this.tweens.add({targets:b,angle:(R()-.5)*1.2,duration:2600+R()*1500,yoyo:true,repeat:-1,ease:'Sine.InOut'});
      continue;
     }
    }
    this.add.ellipse(q.x,q.y,5+R()*13,2+R()*5,R()<.55?0x4f5b43:0x675d45,.15+R()*.14).setDepth(40+q.y*.01);
    continue;
   }
   if(t===TERRAIN.WETLAND){
    this.habitatDetail.wetland++;
    const tuft=this.add.image(q.x,q.y,'reeds').setOrigin(.5,1).setScale(.07+.09*R()).setAlpha(.3+.24*R()).setTint(R()<.5?0x82975c:0x6e8a5f).setDepth(920+q.y);
    if(R()<.18)this.tweens.add({targets:tuft,angle:(R()-.5)*2.2,duration:1800+R()*1600,yoyo:true,repeat:-1,ease:'Sine.InOut'});
    continue;
   }
   this.habitatDetail.meadow++;
   if(nearForest&&R()<.48){
    this.habitatDetail.edge++;
    if(R()<.42){
     const key='shrub-00'+(1+Math.floor(R()*3));
     if(this.textures.exists(key)){
      this.add.image(q.x,q.y,key).setOrigin(.5,1).setScale(.08+.10*R()).setTint(0x70805f).setAlpha(.28+.22*R()).setDepth(880+q.y);
      continue;
     }
    }
   }
   const g=this.add.graphics().setDepth(50+q.y*.01);
   const stems=nearForest?3+Math.floor(R()*5):2+Math.floor(R()*4);
   const base=nearForest?0x76865e:0x87946c;
   const alpha=nearForest ? .34 : .24;
   g.lineStyle(1,base,alpha);
   for(let k=0;k<stems;k++){
    const ox=(R()-.5)*(nearForest?15:11),hh=(nearForest?7:4)+R()*(nearForest?15:10);
    g.lineBetween(q.x+ox,q.y,q.x+ox+(R()-.5)*4,q.y-hh);
   }
   if(R()<.08&&!nearForest)this.add.ellipse(q.x+(R()-.5)*10,q.y+(R()-.5)*5,10+R()*18,4+R()*8,0x657857,.08).setDepth(35);
  }
 }

 spawnForest(){
  const R=seeded('canonical-forest-v1_3'),spots=[];for(let tries=0;tries<6200&&spots.length<112;tries++){const p={x:2+R()*96,y:2+R()*96};if(terrainTypeAt(p)!==TERRAIN.FOREST||blocksTree(p))continue;if(spots.some(q=>dist(p,q)<1.42))continue;spots.push(p)}
  const keys=['tree-004','tree-005','tree-006','tree-007','tree-008','tree-009'];for(let i=0;i<spots.length;i++){const p=worldToPx(spots[i]),key=this.textures.exists(keys[i%keys.length])?keys[i%keys.length]:'fallback-tree';this.add.ellipse(p.x+3,p.y+2,50+R()*28,14+R()*8,0x17251b,.16).setDepth(992+p.y);const img=this.add.image(p.x,p.y,key).setOrigin(.5,1),targetH=78+R()*36,tints=[0x83936f,0x718364,0x62785a,0x7c8b69,0x596f53,0x6d805f];img.setDisplaySize(Math.max(42,targetH*(img.width/Math.max(1,img.height))),targetH);img.setTint(tints[i%tints.length]).setAlpha(.96);img.setDepth(1000+p.y);img.setData('worldPoint',spots[i]);img.setData('kind','tree');this.treeSprites.push(img);if(R()<.72)this.tweens.add({targets:img,angle:(R()-.5)*1.65,duration:2800+R()*2100,yoyo:true,repeat:-1,ease:'Sine.InOut'})}
 }
 drawCanonicalObjects(){for(const o of canonical.worldModel?.objects||[]){if(o.state?.active===false||o.parentId||o.type==='creek_segment'||o.type==='frontier')continue;if(['stone_field','clay_bank','reed_marsh','berry_patch'].includes(o.type))continue;const p=worldToPx(o.position||{x:50,y:50});if(o.type==='camp_area'){const uses=canonical?.surfaceHistory?.campWear?.uses||0,strength=clamp(uses/28,0,1);this.add.ellipse(p.x,p.y+8,150+strength*34,78+strength*16,0x675a43,.12+strength*.11).setDepth(15);continue}if(o.type==='fallen_tree'){const len=(o.geometry?.lengthM||4.8)/(canonical.worldModel.bounds?.metersPerUnit||2)*TILE,g=this.add.rectangle(p.x,p.y,len,16,0x7c5738).setDepth(1000+p.y).setRotation(((o.geometry?.orientationDeg||0)-90)*Math.PI/180);this.add.rectangle(p.x-2,p.y-3,len*.82,3,0xa2744b,.55).setDepth(g.depth+1).setRotation(g.rotation);continue}if(o.type==='stone_field'){const R=seeded(o.id);for(let i=0;i<13;i++){const a=R()*Math.PI*2,rr=Math.sqrt(R())*58,x=p.x+Math.cos(a)*rr,y=p.y+Math.sin(a)*rr*.55;this.add.ellipse(x,y,8+R()*12,5+R()*7,0x8c9690,.95).setDepth(1000+y)}continue}if(o.type==='clay_bank'){const top=this.add.ellipse(p.x,p.y-2,118,45,0xa96f4d,.82).setDepth(18),face=this.add.ellipse(p.x+6,p.y+13,105,28,0x744a38,.82).setDepth(17);top.setStrokeStyle(2,0xc9956c,.4);face.setScale(1,.45);continue}if(o.type==='reed_marsh'){const R=seeded(o.id);this.add.ellipse(p.x,p.y+4,190,108,0x587569,.22).setDepth(11);for(let i=0;i<28;i++){const a=R()*Math.PI*2,rr=Math.sqrt(R())*82,x=p.x+Math.cos(a)*rr,y=p.y+Math.sin(a)*rr*.55;const r=this.add.image(x,y,'reeds').setOrigin(.5,1).setScale(.3+.18*R()).setDepth(1000+y);this.tweens.add({targets:r,angle:(R()-.5)*3,duration:1300+R()*1200,yoyo:true,repeat:-1,ease:'Sine.InOut'})}continue}if(o.type==='berry_patch'){const R=seeded(o.id);for(let i=0;i<9;i++){const a=R()*Math.PI*2,rr=Math.sqrt(R())*58,x=p.x+Math.cos(a)*rr,y=p.y+Math.sin(a)*rr*.52;this.add.image(x,y,'berry-bush').setOrigin(.5,1).setScale(.42+.08*R()).setDepth(1000+y)}}}
  this.campVisualMode='canonical-branch-camp-v1';const shelter=(canonical.worldModel?.objects||[]).find(o=>o.type==='branch_shelter'&&o.state?.active);if(shelter){const p=worldToPx(shelter.position),d=1000+p.y;this.add.ellipse(p.x+3,p.y+14,112,33,0x17251b,.2).setDepth(d-5);const g=this.add.graphics().setDepth(d);g.fillStyle(0x765239,.98);g.fillTriangle(p.x-48,p.y+11,p.x+2,p.y-54,p.x+50,p.y+11);g.fillStyle(0x513a2d,.98);g.fillTriangle(p.x-24,p.y+10,p.x+2,p.y-35,p.x+27,p.y+10);g.fillStyle(0x25271f,.88);g.fillTriangle(p.x-13,p.y+10,p.x+2,p.y-20,p.x+17,p.y+10);g.lineStyle(5,0x5b402d,1);g.lineBetween(p.x-50,p.y+12,p.x+2,p.y-56);g.lineBetween(p.x+50,p.y+12,p.x+2,p.y-56);g.lineStyle(2,0xa77a53,.7);g.lineBetween(p.x-33,p.y-8,p.x+31,p.y-7);g.lineBetween(p.x-23,p.y-24,p.x+21,p.y-23)}const fire=(canonical.worldModel?.objects||[]).find(o=>o.type==='camp_fire'&&o.state?.active);if(fire){const p=worldToPx(fire.position),d=1000+p.y+2,glow=this.add.circle(p.x,p.y+2,29,0xf4a64f,.09).setDepth(d-3);this.tweens.add({targets:glow,scale:1.2,alpha:.035,duration:760,yoyo:true,repeat:-1});const logs=this.add.graphics().setDepth(d-1);logs.lineStyle(6,0x5e3b24,1);logs.lineBetween(p.x-14,p.y+8,p.x+13,p.y-3);logs.lineBetween(p.x-13,p.y-3,p.x+14,p.y+8);const flame=this.add.triangle(p.x,p.y-7,0,25,10,0,20,25,0xe97832,.98).setDepth(d);const inner=this.add.ellipse(p.x,p.y,8,16,0xffc65c,.95).setDepth(d+1);this.tweens.add({targets:[flame,inner],scaleX:1.08,scaleY:.88,y:'-=2',duration:430,yoyo:true,repeat:-1,ease:'Sine.InOut'});for(let i=0;i<3;i++){const smoke=this.add.circle(p.x+(i-1)*3,p.y-21-i*5,4-i*.7,0xd7ded7,.14).setDepth(d+1);this.tweens.add({targets:smoke,y:smoke.y-36,x:smoke.x+(i-1)*8,alpha:0,scale:1.8,duration:2100+i*420,repeat:-1,delay:i*390})}}
 }
 renderResourceLandscape(){
  for(const v of this.resourceVisuals){this.tweens.killTweensOf(v);v.destroy()}this.resourceVisuals=[];
  const keep=v=>{this.resourceVisuals.push(v);return v},res=canonical?.resources||{},state={stonesLoose:0,reedsStanding:0,berryFruitingBushes:0,clayRichness:0};
  for(const o of canonical.worldModel?.objects||[]){if(o.state?.active===false||o.parentId||!o.position||!['stone_field','clay_bank','reed_marsh','berry_patch'].includes(o.type))continue;const p=worldToPx(o.position),R=seeded(`${o.id}:resource-v1`);
   if(o.type==='stone_field'){const ratio=clamp((res.stones||0)/24,0,1),count=Math.round(13*ratio);state.stonesLoose=count;keep(this.add.ellipse(p.x,p.y,130,62,0x6d7269,.07).setDepth(17));for(let i=0;i<count;i++){const a=R()*Math.PI*2,rr=Math.sqrt(R())*58,x=p.x+Math.cos(a)*rr,y=p.y+Math.sin(a)*rr*.55;keep(this.add.ellipse(x,y,8+R()*12,5+R()*7,0x8c9690,.95).setDepth(1000+y))}continue}
   if(o.type==='clay_bank'){const ratio=clamp((res.clay||0)/10,0,1);state.clayRichness=+ratio.toFixed(2);keep(this.add.ellipse(p.x+6,p.y+13,105,28,0x744a38,.72).setDepth(17).setScale(1,.45));const rich=keep(this.add.ellipse(p.x,p.y-2,62+56*ratio,31+14*ratio,0xa96f4d,.52+.3*ratio).setDepth(18));rich.setStrokeStyle(2,0xc9956c,.22+.22*ratio);const scars=Math.round((1-ratio)*6);if(scars){const g=keep(this.add.graphics().setDepth(19));g.lineStyle(2,0x604238,.45);for(let i=0;i<scars;i++){const x=p.x-36+R()*72,y=p.y-10+R()*25;g.lineBetween(x,y,x+6+R()*9,y+5+R()*5)}}continue}
   if(o.type==='reed_marsh'){const ratio=clamp((res.reeds||0)/18,0,1),count=Math.round(28*ratio);state.reedsStanding=count;keep(this.add.ellipse(p.x,p.y+4,190,108,0x587569,.18).setDepth(11));for(let i=0;i<28;i++){const a=R()*Math.PI*2,rr=Math.sqrt(R())*82,x=p.x+Math.cos(a)*rr,y=p.y+Math.sin(a)*rr*.55;if(i<count){const reed=keep(this.add.image(x,y,'reeds').setOrigin(.5,1).setScale(.27+.18*R()).setAlpha(.78+.18*ratio).setDepth(1000+y));this.tweens.add({targets:reed,angle:(R()-.5)*2.5,duration:1500+R()*1300,yoyo:true,repeat:-1,ease:'Sine.InOut'})}else if(i<count+Math.min(8,28-count)){const g=keep(this.add.graphics().setDepth(900+y));g.lineStyle(1.4,0x667655,.32);g.lineBetween(x,y,x+(R()-.5)*3,y-(4+R()*7))}}continue}
   if(o.type==='berry_patch'){const ratio=clamp((res.berries||0)/20,0,1),fruiting=Math.round(9*ratio);state.berryFruitingBushes=fruiting;for(let i=0;i<9;i++){const a=R()*Math.PI*2,rr=Math.sqrt(R())*58,x=p.x+Math.cos(a)*rr,y=p.y+Math.sin(a)*rr*.52,key=i<fruiting?'berry-bush':'berry-bush-empty';keep(this.add.image(x,y,key).setOrigin(.5,1).setScale(.42+.08*R()).setAlpha(.92).setDepth(1000+y))}}
  }
  this.resourceVisualState=state;
 }
 renderEntities(initial=false){for(const a of canonical.agents||[])this.upsertAgent(a,initial);const present=new Set();for(const a of canonical.ecologySystem?.wildlife||[])if(a.active&&a.localPresence!==false){present.add(a.id);this.upsertWildlife(a,initial)}for(const [id,e] of [...this.entities])if(e.getData?.('kind')==='wildlife'&&!present.has(id)){this.tweens.killTweensOf(e);e.destroy();this.entities.delete(id)}}
 refreshDynamicWorld(){this.renderTravelWear();this.renderResourceLandscape();this.renderCanonicalTraces();this.renderCanonicalSigns();this.renderEntities(false);this.updateDecisionCue(false);this.renderLightCycle(true);this.renderWeather(true);this.refreshAmbient()}
 renderCanonicalTraces(){for(const v of this.traceVisuals)v.destroy();this.traceVisuals=[];const traces=(canonical?.ecologySystem?.traces||[]).filter(t=>t.active&&(t.clarity??0)>.38&&(t.ageHours??0)<=14&&(t.species!=='rabbit'||(t.clarity??0)>.55));for(const t of traces){const p=worldToPx(t.position),heading=-(t.heading||0),size=clamp(t.size||1,.45,1.6),alpha=clamp((t.clarity??.7)*.46,.12,.42),g=this.add.graphics().setDepth(720+p.y*.02);g.setAlpha(alpha);const c=t.substrate==='mud'?0x493d31:t.species==='bear'?0x40372f:t.species==='rabbit'?0x6a6258:0x5b5044;g.fillStyle(c,1);const dx=Math.cos(heading)*7*size,dy=Math.sin(heading)*7*size,nx=-Math.sin(heading)*3.3*size,ny=Math.cos(heading)*3.3*size;for(let i=-1;i<=1;i++){const along=i*7.5*size,cx=p.x+dx*i,cy=p.y+dy*i;g.fillEllipse(cx+nx,cy+ny,5.6*size,3.4*size);g.fillEllipse(cx-nx,cy-ny,5.6*size,3.4*size);if(t.species==='bear'&&i===0)g.fillEllipse(cx,cy+1,5*size,4*size)}g.setData('kind','wildlife-trace');g.setData('traceId',t.id);g.setData('species',t.species);this.traceVisuals.push(g)} }
 renderCanonicalSigns(){for(const v of this.signVisuals)v.destroy();this.signVisuals=[];const signs=(canonical?.ecologySystem?.signs||[]).filter(s=>s.active&&(s.clarity??0)>.34&&(s.ageHours??0)<=30);for(const s of signs){const p=worldToPx(s.position),a=clamp((s.clarity??.6)*.34,.09,.3),g=this.add.graphics().setDepth(700+p.y*.02).setAlpha(a);if(s.kind==='deer-bed'){g.fillStyle(0x514b37,1);g.fillEllipse(p.x,p.y,25,10);g.lineStyle(1,0x7d805c,.8);for(let i=-2;i<=2;i++)g.lineBetween(p.x+i*5,p.y+3,p.x+i*6+2,p.y-5)}else if(s.kind==='deer-browse'){g.lineStyle(1.4,0x5c4e35,1);g.lineBetween(p.x-8,p.y+6,p.x+8,p.y-7);g.lineBetween(p.x-1,p.y,p.x-7,p.y-7);g.fillStyle(0x6d7d50,.9);g.fillEllipse(p.x+7,p.y-7,6,3)}else if(s.kind==='rabbit-browse'){g.lineStyle(1,0x66744c,1);for(let i=-2;i<=2;i++)g.lineBetween(p.x+i*3,p.y+5,p.x+i*3+(i%2),p.y-4-(i%2)*2)}else if(s.kind==='bear-forage'){g.fillStyle(0x4d4233,.72);g.fillEllipse(p.x-5,p.y,15,7);g.fillEllipse(p.x+6,p.y+3,13,6);g.lineStyle(1.2,0x786750,.8);g.lineBetween(p.x-9,p.y-6,p.x+10,p.y+7)}g.setData('kind','ecological-sign');g.setData('signId',s.id);g.setData('species',s.species);this.signVisuals.push(g)}}
 updateDecisionCue(initial=false){const dna=canonical?.dna?.[0],agent=dna?this.entities.get(dna.agent_id):null;if(!dna||!agent)return;if(this.decisionCue&&this.lastDecisionCueId!==dna.decision_id){this.decisionCue.destroy();this.decisionCue=null}if(!this.decisionCue){const label=String(dna.action_label||dna.action||'').replace(/^./,c=>c.toUpperCase()),intent=String(dna.mind?.intent||'').trim(),text=intent&&intent.toLowerCase()!==label.toLowerCase()?`${label}\n${intent}`:label;this.decisionCue=this.add.text(agent.x,agent.y-92,text,{fontFamily:'Arial',fontSize:'10px',fontStyle:'bold',align:'center',color:'#eef5e9',backgroundColor:'rgba(9,19,12,.72)',padding:{x:7,y:5},stroke:'#111a13',strokeThickness:2,wordWrap:{width:190}}).setOrigin(.5,1).setDepth(9100).setAlpha(initial?.78:.94);this.lastDecisionCueId=dna.decision_id;this.decisionCue.setData('decisionId',dna.decision_id)}else this.decisionCue.setPosition(agent.x,agent.y-92);}
 upsertAgent(a,initial){let e=this.entities.get(a.id);if(!e){const key=a.id==='agent-mara'?'person-mara':'person-ivo',target=worldToPx(canonicalAgentPoint(a));e=this.add.image(target.x,target.y,key).setOrigin(.5,1);const h=52;e.setDisplaySize(Math.max(33,h*(e.width/Math.max(e.height,1))),h).setDepth(1000+target.y+3);e.setData('kind','agent');e.setData('id',a.id);e.setData('artMode','natural-procedural');const name=this.add.text(target.x,target.y-59,a.name,{fontFamily:'Arial',fontSize:'10px',fontStyle:'bold',color:'#edf4e9',stroke:'#172018',strokeThickness:3}).setOrigin(.5).setDepth(9000).setAlpha(.9);e.setData('label',name);this.entities.set(a.id,e)}const fallback=canonicalAgentPoint(a),to=worldToPx(a.activeAction?.to||fallback),from=worldToPx(a.activeAction?.from||fallback),off=agentPresentationOffset(a);to.x+=off.x;to.y+=off.y;from.x+=off.x;from.y+=off.y;if(initial&&dist(pxToWorld(from),pxToWorld(to))>.35){e.setPosition(from.x,from.y);e.getData('label').setPosition(from.x,from.y-59);this.moveEntity(e,to,6500)}else this.moveEntity(e,to,initial?0:MOVE_MS*.72)}
 upsertWildlife(a,initial){let e=this.entities.get(a.id);if(!e){const p=worldToPx(a.position),key=a.species==='bear'?'animal-bear-fallback':a.species==='rabbit'?'animal-rabbit-fallback':a.species==='fish'?(this.textures.exists('animal-fish')?'animal-fish':'animal-fish'):'animal-deer';if(a.species==='fish'){e=this.add.container(p.x,p.y);for(let i=0;i<4;i++){const f=this.add.image((i-1.5)*12,(i%2?4:-4),key).setScale(.32);e.add(f);this.tweens.add({targets:f,x:f.x+(i%2?8:-8),y:f.y+(i%2?-3:3),duration:1200+i*180,yoyo:true,repeat:-1,ease:'Sine.InOut'})}e.setDepth(25)}else{e=this.add.image(p.x,p.y,key).setOrigin(.5,.82);const h=a.species==='bear'?46:a.species==='deer'?39:18;e.setDisplaySize(Math.max(a.species==='rabbit'?16:24,h*(e.width/Math.max(e.height,1))),h);e.setDepth(1000+p.y+2)}e.setData('kind','wildlife');e.setData('species',a.species);e.setData('id',a.id);this.entities.set(a.id,e)}let visibility=.96;if(a.species==='rabbit'&&a.activity==='hide')visibility=.34;else if(a.activity==='freeze')visibility=.52;else if(a.species==='deer'&&a.activity==='rest')visibility=.84;else if(a.species==='bear'&&a.activity==='rest')visibility=.86;e.setAlpha(visibility);e.setData('visibility',visibility);e.setData('behavior',a.behavior||null);const wf=a.movement?.from||a.previousPosition||a.position,wt=a.movement?.to||a.position,moveD=dist(wf,wt),from=worldToPx(wf),to=worldToPx(wt),moving=moveD>.16&&!['rest','hide','freeze','drink'].includes(a.activity);let duration=moving?(a.species==='rabbit'?3400:a.species==='fish'?8500:a.species==='bear'?9000:6800):0;if(initial&&moving){e.setPosition(from.x,from.y);this.moveEntity(e,to,duration)}else this.moveEntity(e,to,duration);if(a.species==='rabbit'&&moving){const sy=e.scaleY;this.tweens.add({targets:e,scaleY:sy*.84,duration:170,yoyo:true,repeat:Math.max(1,Math.floor(duration/340)-1),ease:'Sine.InOut'})}}
 moveEntity(e,to,duration){this.tweens.killTweensOf(e);const label=e.getData?.('label');if(!duration){e.setPosition(to.x,to.y);if(label)label.setPosition(to.x,to.y-59);e.setDepth(e.getData?.('species')==='fish'?25:1000+to.y+3);return}const start={x:e.x,y:e.y};this.tweens.add({targets:e,x:to.x,y:to.y,duration,ease:'Sine.InOut',onUpdate:()=>{const dx=e.x-start.x;if(e.setFlipX&&Math.abs(dx)>.4)e.setFlipX(dx<0);if(label)label.setPosition(e.x,e.y-59);if(e.getData?.('species')!=='fish')e.setDepth(1000+e.y+3)}})}
 spawnAmbientLife(){this.refreshAmbient(true)}
 refreshAmbient(force=false){const birds=canonical?.ecologySystem?.ambient?.birds||0,target=clamp(Math.round(birds/14),0,7);if(!force&&this.ambient.length===target)return;for(const x of this.ambient)x.destroy();this.ambient=[];const R=seeded(`birds:${canonical?.ecologySystem?.ambient?.seed||0}`);for(let i=0;i<target;i++){const b=this.add.image(R()*WORLD,R()*WORLD*.5+140,'ambient-bird').setScale(.55+R()*.35).setAlpha(.28+R()*.2).setDepth(8000);this.ambient.push(b);this.tweens.add({targets:b,x:b.x+(R()>.5?1:-1)*(260+R()*520),y:b.y+(R()-.5)*90,duration:10500+R()*11000,repeat:-1,yoyo:true,ease:'Sine.InOut'})}}
 renderLightCycle(refresh=false){
  if(refresh&&this.lightOverlay){this.lightOverlay.destroy();this.lightOverlay=null}
  if(refresh&&this.nightLights?.length){for(const x of this.nightLights)x.destroy();this.nightLights=[]}
  const h=canonical?.hour??12,wet=canonical?.weather==='rain';
  let color=0x0b1722,alpha=0,tone='day';
  if(h<5||h>=22){color=0x0b1826;alpha=.46;tone='night'}
  else if(h<7){color=0x7b5b42;alpha=.16;tone='dawn'}
  else if(h>=19&&h<22){color=0x4c3d42;alpha=.24;tone='dusk'}
  else if(wet){color=0x26382f;alpha=.07;tone='rain'}
  if(alpha>0)this.lightOverlay=this.add.rectangle(WORLD/2,WORLD/2,WORLD,WORLD,color,alpha).setDepth(8800);
  const fire=(canonical?.worldModel?.objects||[]).find(o=>o.type==='camp_fire'&&o.state?.active);
  if(fire&&(tone==='night'||tone==='dusk'||tone==='dawn')){
   const p=worldToPx(fire.position);
   const outer=this.add.circle(p.x,p.y,100,0xf6a94d,tone==='night' ? .055 : .035).setDepth(8801).setBlendMode(Phaser.BlendModes.ADD);
   const inner=this.add.circle(p.x,p.y,52,0xffbd66,tone==='night' ? .10 : .065).setDepth(8802).setBlendMode(Phaser.BlendModes.ADD);
   this.nightLights.push(outer,inner);
   this.tweens.add({targets:[outer,inner],scale:1.08,alpha:'-=0.018',duration:900,yoyo:true,repeat:-1,ease:'Sine.InOut'});
  }
  this.lightCycle={hour:h,alpha:+alpha.toFixed(3),tone,weather:canonical?.weather||null,fireGlow:this.nightLights?.length||0};
 }
 renderWeather(refresh=false){if(refresh&&this.rainGroup){this.rainGroup.clear(true,true);this.rainGroup=null}if(canonical?.weather!=='rain')return;this.rainGroup=this.add.group();const R=seeded(`rain:${canonical.day}:${canonical.hour}`);for(let i=0;i<55;i++){const x=R()*WORLD,y=R()*WORLD,line=this.add.rectangle(x,y,1,10,0xc6dbe0,.18).setDepth(9500);this.rainGroup.add(line);this.tweens.add({targets:line,x:x-140,y:y+340,duration:1700+R()*1000,repeat:-1})}}
 updateHud(){
  const s=$('#phWorldStatus'),v=String(canonical.worldModel?.version||'?').replace('object-field-','');
  s.innerHTML=`<b>● OBJECT WORLD · ${v}</b><span>Day ${canonical.day} · ${String(canonical.hour).padStart(2,'0')}:00 · ${Math.round(canonical.temperature)}°F · ${canonical.weather}</span>`;
  const a=focusAgent(),ph=currentPhase(a),place=String(a?.position||'world').replaceAll('_',' ').toUpperCase();
  $('#phFocus').innerHTML=`<small>${ph.label} · ${place}</small><strong>${a?.name||'World'} — ${a?.mind?.currentGoal||a?.currentAction||'Observing the basin.'}</strong>`;
  const wildlife=(canonical.ecologySystem?.wildlife||[]).filter(x=>x.active&&x.localPresence!==false),ambient=canonical.ecologySystem?.ambient||{},events=canonical.ecologySystem?.events||[];
  const currentEvent=events.find(e=>e.day===canonical.day&&e.hour===canonical.hour&&(e.importance??0)>=5);
  const h=canonical.hour;
  let pulse='';
  if(currentEvent){pulse=currentEvent.title;this.pulseMode='current-event'}
  else if(canonical.weather==='rain'){pulse=`Rain across the basin · ${ambient.frogs||0} frog activity`;this.pulseMode='ambient-rain'}
  else if(h<5||h>=22){pulse=`Quiet night · ${ambient.frogs||0} frog activity · ${ambient.insects||0} insect activity`;this.pulseMode='ambient-night'}
  else if((h>=5&&h<=8)||(h>=18&&h<=21)){pulse=`Twilight activity · ${ambient.birds||0} birds · ${ambient.frogs||0} frogs`;this.pulseMode='ambient-twilight'}
  else{pulse=`Basin quiet · ${ambient.birds||0} bird activity`;this.pulseMode='ambient-day'}
  $('#phLifeCount').textContent=`${wildlife.length} animals in basin`;
  $('#phPulseText').textContent=pulse;
 }
 wireUI(){document.querySelectorAll('[data-camera]').forEach(b=>b.addEventListener('click',()=>{cameraMode=b.dataset.camera;this.applyCamera(true);this.syncButtons()}));$('#phZoomIn')?.addEventListener('click',()=>this.setZoom(this.cameras.main.zoom+.12));$('#phZoomOut')?.addEventListener('click',()=>this.setZoom(this.cameras.main.zoom-.12));$('#phHome')?.addEventListener('click',()=>{cameraMode='auto';this.applyCamera(true);this.syncButtons()})}
 syncButtons(){document.querySelectorAll('[data-camera]').forEach(b=>b.classList.toggle('active',b.dataset.camera===cameraMode))}
 applyCamera(immediate=false){let id=cameraMode;if(id==='auto')id=focusAgent()?.id||'agent-mara';const e=this.entities.get(id);if(!e)return;const cam=this.cameras.main;if(immediate){cam.stopFollow();cam.centerOn(e.x,e.y)}cam.startFollow(e,true,.075,.075,0,innerWidth<650?35:0)}
 setZoom(z){this.cameras.main.setZoom(clamp(z,.55,1.8))}
 wireInput(){const cam=this.cameras.main;this.input.on('pointerdown',p=>{if(p.primaryDown)this.drag={x:p.x,y:p.y,scrollX:cam.scrollX,scrollY:cam.scrollY}});this.input.on('pointermove',p=>{if(!this.drag||!p.isDown)return;const dx=(p.x-this.drag.x)/cam.zoom,dy=(p.y-this.drag.y)/cam.zoom;if(Math.abs(dx)+Math.abs(dy)>8){cameraMode='free';cam.stopFollow();cam.scrollX=this.drag.scrollX-dx;cam.scrollY=this.drag.scrollY-dy;this.syncButtons()}});this.input.on('pointerup',()=>this.drag=null);this.input.on('wheel',(_p,_go,_dx,dy)=>this.setZoom(cam.zoom+(dy>0?-.08:.08)))}
 update(){for(const [id,e] of this.entities){if(e.getData?.('kind')==='wildlife'&&e.getData('species')!=='fish')e.setDepth(1000+e.y+2)}if(this.decisionCue&&this.lastDecisionCueId){const dna=canonical?.dna?.[0],agent=dna?this.entities.get(dna.agent_id):null;if(agent)this.decisionCue.setPosition(agent.x,agent.y-92)} }
 snapshot(){const treeWater=this.treeSprites.filter(t=>terrainTypeAt(t.getData('worldPoint'))===TERRAIN.WATER).length,moving=[...this.entities.values()].filter(e=>this.tweens.getTweensOf(e).length>0).length;return{version:'phaser-v1.5-living-history',phaser:Phaser.VERSION,ready:!!canonical,worldModel:canonical?.worldModel?.version||null,terrain:this.grid?.counts||{},trees:this.treeSprites.length,treeWaterCollisions:treeWater,agents:[...this.entities.values()].filter(x=>x.getData?.('kind')==='agent').length,wildlife:[...this.entities.values()].filter(x=>x.getData?.('kind')==='wildlife').length,movingEntities:moving,assetErrors:[...assetErrors],decisionDNA:{protocol:canonical?.dna?.[0]?.protocol||null,decisionId:canonical?.dna?.[0]?.decision_id||null,action:canonical?.dna?.[0]?.action||null},agentArtModes:[...this.entities.values()].filter(x=>x.getData?.('kind')==='agent').map(x=>x.getData?.('artMode')||'unknown'),campVisualMode:this.campVisualMode||null,visualFixes:'visual-fixes-v1',naturalism:'naturalism-v1',embodiment:'embodiment-v1',habitatDepth:'habitat-depth-v1',quietWorld:'quiet-world-v1',coverEcology:'cover-ecology-v1',rangePresence:'range-presence-v1',ecologicalSigns:'ecological-signs-v1',travelWear:'travel-wear-v1',resourceLandscape:'resource-responsive-v1',resourceVisualState:this.resourceVisualState||null,rangePresenceCounts:{present:(canonical?.ecologySystem?.wildlife||[]).filter(x=>x.active&&x.localPresence!==false).length,outside:(canonical?.ecologySystem?.wildlife||[]).filter(x=>x.active&&x.localPresence===false).length},pulseMode:this.pulseMode||null,concealedWildlife:[...this.entities.values()].filter(x=>x.getData?.('kind')==='wildlife'&&(x.getData?.('visibility')??1)<.7).length,habitatDetail:this.habitatDetail||null,lightCycle:this.lightCycle||null,livingWorld:{routeVisuals:this.routeVisuals.length,canonicalRoutes:(canonical?.surfaceHistory?.routes||[]).filter(r=>(r.traversals||0)>=2).length,campWear:canonical?.surfaceHistory?.campWear?.uses||0,signVisuals:this.signVisuals.length,canonicalSigns:(canonical?.ecologySystem?.signs||[]).filter(s=>s.active&&(s.clarity??0)>.34&&(s.ageHours??0)<=30).length,trackVisuals:this.traceVisuals.length,canonicalTracks:(canonical?.ecologySystem?.traces||[]).filter(t=>t.active&&(t.clarity??0)>.38&&(t.ageHours??0)<=14&&(t.species!=='rabbit'||(t.clarity??0)>.55)).length,decisionCueId:this.decisionCue?.getData?.('decisionId')||null},camera:{mode:cameraMode,zoom:this.cameras.main.zoom,scrollX:this.cameras.main.scrollX,scrollY:this.cameras.main.scrollY},positions:Object.fromEntries([...this.entities].map(([id,e])=>[id,{x:e.x,y:e.y,kind:e.getData?.('kind'),species:e.getData?.('species')||null}]))}}
}

const game=new Phaser.Game({type:Phaser.AUTO,parent:'phaserWorld',width:window.innerWidth,height:window.innerHeight,backgroundColor:COLORS.meadow,pixelArt:false,antialias:true,roundPixels:false,scale:{mode:Phaser.Scale.RESIZE,autoCenter:Phaser.Scale.CENTER_BOTH},render:{antialias:true,powerPreference:'high-performance'},scene:[LivingWorld]});
window.ChatGPTFarmPhaserDebug={snapshot:()=>sceneRef?.snapshot()||{ready:false},focusWorldUnit(x,y,zoom=1){if(!sceneRef)return false;cameraMode='free';sceneRef.cameras.main.stopFollow();const p=worldToPx({x,y});sceneRef.cameras.main.centerOn(p.x,p.y);sceneRef.setZoom(zoom);sceneRef.syncButtons();return true},simulateMove(id,to,duration=2200){const e=sceneRef?.entities.get(id);if(!e)return false;sceneRef.moveEntity(e,worldToPx(to),duration);return true},reload:()=>sceneRef?.loadState(false)};
})();