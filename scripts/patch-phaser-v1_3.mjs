import fs from 'node:fs';

const file='phaser-world-v1.js';
let s=fs.readFileSync(file,'utf8');
const replaceOnce=(from,to,label)=>{if(!s.includes(from))throw new Error(`Missing patch anchor: ${label}`);s=s.replace(from,to)};
const replaceBetween=(start,end,repl,label)=>{const a=s.indexOf(start);if(a<0)throw new Error(`Missing start: ${label}`);const b=s.indexOf(end,a+start.length);if(b<0)throw new Error(`Missing end: ${label}`);s=s.slice(0,a)+repl+s.slice(b)};

replaceOnce('const TILE=24, UNITS=100, WORLD=TILE*UNITS, POLL_MS=12000, MOVE_MS=9000;','const TILE=24, UNITS=100, WORLD=TILE*UNITS, POLL_MS=12000, MOVE_MS=9000, SURFACE=640;','surface constant');
replaceOnce(
"const pxToWorld=p=>({x:p.x/TILE,y:UNITS-p.y/TILE});",
`const pxToWorld=p=>({x:p.x/TILE,y:UNITS-p.y/TILE});
const lerp=(a,b,t)=>a+(b-a)*t;
const smooth=t=>t*t*(3-2*t);
const mixRGB=(a,b,t)=>[lerp(a[0],b[0],t),lerp(a[1],b[1],t),lerp(a[2],b[2],t)];
function rand2(ix,iy,seed=9176){let n=(Math.imul(ix,374761393)^Math.imul(iy,668265263)^Math.imul(seed,69069))|0;n=Math.imul(n^(n>>>13),1274126177);return((n^(n>>>16))>>>0)/4294967295}
function valueNoise(x,y,seed=9176){const x0=Math.floor(x),y0=Math.floor(y),tx=smooth(x-x0),ty=smooth(y-y0),a=rand2(x0,y0,seed),b=rand2(x0+1,y0,seed),c=rand2(x0,y0+1,seed),d=rand2(x0+1,y0+1,seed);return lerp(lerp(a,b,tx),lerp(c,d,tx),ty)}
function fbm(x,y){return valueNoise(x,y,511)*.55+valueNoise(x*2.07,y*2.07,991)*.28+valueNoise(x*4.11,y*4.11,1559)*.17}`,
'noise helpers');

const preloadOld="for(const n of ['004','005','006','007','008','009'])this.load.image(`tree-${n}`,`${foliage}/foliagePack_${n}.png`);";
const preloadNew=`for(const n of ['004','005','006','007','008','009'])this.load.image(\`tree-\${n}\`,\`\${foliage}/foliagePack_\${n}.png\`);
  for(const n of ['001','002','003'])this.load.image(\`shrub-\${n}\`,\`\${foliage}/foliagePack_\${n}.png\`);
  const carto=\`\${ASSET_ROOT}/ui/cartography-pack/PNG/Default\`;this.load.image('camp-tent',\`\${carto}/tent.png\`);this.load.image('campfire-art',\`\${carto}/campfire.png\`);`;
replaceOnce(preloadOld,preloadNew,'preload art');
replaceOnce('this.cameras.main.setZoom(innerWidth<650?.98:1.08);','this.cameras.main.setZoom(innerWidth<650?1.18:1.12);','camera zoom');

replaceBetween(' buildWorld(){',' drawBiomeUnderlays(){',` buildWorld(){
  this.grid=buildTerrainGrid(canonical);const map=this.make.tilemap({width:UNITS,height:UNITS,tileWidth:TILE,tileHeight:TILE}),tiles=map.addTilesetImage('terrain-sheet','terrain-sheet',TILE,TILE,0,0,0),layer=map.createBlankLayer('Canonical occupancy',tiles,0,0);for(let row=0;row<UNITS;row++)for(let col=0;col<UNITS;col++)layer.putTileAt(this.grid.rows[row][col],col,row);layer.setDepth(-100).setVisible(false);this.terrainLayer=layer;
  this.drawOrganicSurface();this.drawBiomeUnderlays();this.drawCreekDetails();this.spawnGroundDetail();this.spawnForest();this.drawCanonicalObjects();this.renderEntities(true);this.spawnAmbientLife();this.renderWeather();
 }
 drawOrganicSurface(){
  if(this.textures.exists('organic-surface'))this.textures.remove('organic-surface');const c=this.textures.createCanvas('organic-surface',SURFACE,SURFACE),ctx=c.getContext(),img=ctx.createImageData(SURFACE,SURFACE),data=img.data,terr=canonical.worldModel?.terrain||[];
  for(let y=0;y<SURFACE;y++){const wy=UNITS-y/SURFACE*UNITS;for(let x=0;x<SURFACE;x++){const wx=x/SURFACE*UNITS,p={x:wx,y:wy};let forest=0,wet=0;for(const t of terr){const q=terrainInfluence(t,p);if(t.type==='forest')forest=Math.max(forest,q);else if(t.type==='wetland')wet=Math.max(wet,q)}let col=[111,137,88];forest=smooth(clamp(forest*1.12,0,1));wet=smooth(clamp(wet*1.18,0,1));col=mixRGB(col,[58,86,57],forest*.82);col=mixRGB(col,[76,108,91],wet*.72);const cd=creekDistance(p),bank=smooth(clamp((4.9-cd)/3.5,0,1));col=mixRGB(col,[116,102,75],bank*.42);const n=fbm(wx*.075,wy*.075),fine=valueNoise(wx*.33,wy*.33,277),shade=.87+n*.22+(fine-.5)*.055,i=(y*SURFACE+x)*4;data[i]=clamp(col[0]*shade,0,255);data[i+1]=clamp(col[1]*shade,0,255);data[i+2]=clamp(col[2]*shade,0,255);data[i+3]=255}}
  ctx.putImageData(img,0,0);c.refresh();c.setFilter(Phaser.Textures.FilterMode.LINEAR);this.add.image(WORLD/2,WORLD/2,'organic-surface').setDisplaySize(WORLD,WORLD).setDepth(-20)
 }
`,'build/surface');

replaceBetween(' drawBiomeUnderlays(){',' drawCanonicalObjects(){',` drawBiomeUnderlays(){const m=canonical.worldModel?.bounds?.metersPerUnit||2,R=seeded('biome-floor-v1_3');for(const t of canonical.worldModel?.terrain||[]){if(!['forest','wetland'].includes(t.type))continue;const p=worldToPx(t.center),r=(t.radiusM||20)/m*TILE,col=t.type==='forest'?0x263d2d:0x445f54;for(let i=0;i<(t.type==='forest'?18:12);i++){const a=R()*Math.PI*2,rr=Math.sqrt(R())*r*.72,x=p.x+Math.cos(a)*rr,y=p.y+Math.sin(a)*rr*.72,w=35+R()*95,h=18+R()*48;this.add.ellipse(x,y,w,h,col,.045+R()*.045).setDepth(-5)}}}
 drawCreekDetails(){
  const src=creekPoints().map(worldToPx);if(src.length<2)return;const curve=new Phaser.Curves.Spline(src),sample=curve.getSpacedPoints(190),R=seeded('creek-ribbon-v1_3');
  const ribbon=(pad,scale=1)=>{const L=[],RR=[];for(let i=0;i<sample.length;i++){const p=sample[i],a=sample[Math.max(0,i-2)],b=sample[Math.min(sample.length-1,i+2)],dx=b.x-a.x,dy=b.y-a.y,m=Math.hypot(dx,dy)||1,nx=-dy/m,ny=dx/m,t=i/(sample.length-1),w=(29+5*Math.sin(t*11.7+1.2)+3.5*Math.sin(t*25.1+.3))*scale+pad;L.push({x:p.x+nx*w,y:p.y+ny*w});RR.push({x:p.x-nx*w,y:p.y-ny*w})}return L.concat(RR.reverse())};
  const fill=(g,pts,color,alpha=1)=>{g.fillStyle(color,alpha);g.beginPath();g.moveTo(pts[0].x,pts[0].y);for(let i=1;i<pts.length;i++)g.lineTo(pts[i].x,pts[i].y);g.closePath();g.fillPath()};
  const shadow=this.add.graphics().setDepth(3),bank=this.add.graphics().setDepth(4),moist=this.add.graphics().setDepth(5),water=this.add.graphics().setDepth(8),deep=this.add.graphics().setDepth(9);const out=ribbon(22),mid=ribbon(11),wet=ribbon(3),inner=ribbon(-9,.72);fill(shadow,out.map(p=>({x:p.x+3,y:p.y+6})),0x26382e,.24);fill(bank,out,0x665943,.98);fill(moist,mid,0x788066,.78);fill(water,wet,0x64a7b8,.98);fill(deep,inner,0x407b91,.32);
  const details=this.add.graphics().setDepth(10);details.lineStyle(1.2,0xd8eef0,.24);for(let i=10;i<sample.length-10;i+=18){const p=sample[i],p2=sample[i+2],dx=p2.x-p.x,dy=p2.y-p.y,m=Math.hypot(dx,dy)||1,nx=-dy/m,ny=dx/m,len=9+R()*17,off=(R()-.5)*16;details.beginPath();details.moveTo(p.x+nx*off-dx/m*len,p.y+ny*off-dy/m*len);details.lineTo(p.x+nx*off+dx/m*len,p.y+ny*off+dy/m*len);details.strokePath()}
  for(let i=7;i<sample.length-7;i+=7+Math.floor(R()*9)){const p=sample[i],p2=sample[Math.min(sample.length-1,i+2)],dx=p2.x-p.x,dy=p2.y-p.y,m=Math.hypot(dx,dy)||1,nx=-dy/m,ny=dx/m,side=R()<.5?-1:1,d=42+R()*16,q={x:p.x+nx*side*d,y:p.y+ny*side*d};if(R()<.6)this.add.ellipse(q.x,q.y,10+R()*22,5+R()*9,R()<.55?0x6c5b43:0x7e8360,.28+R()*.24).setDepth(12);if(R()<.44){const rr=this.add.image(q.x+(R()-.5)*9,q.y+(R()-.5)*6,'reeds').setOrigin(.5,1).setScale(.16+.11*R()).setAlpha(.75).setDepth(1000+q.y);this.tweens.add({targets:rr,angle:side*(.8+R()*1.4),duration:1700+R()*1100,yoyo:true,repeat:-1,ease:'Sine.InOut'})}if(R()<.22)this.add.ellipse(q.x+(R()-.5)*14,q.y+(R()-.5)*8,5+R()*9,3+R()*5,0x90968d,.8).setDepth(1000+q.y)}this.riverCurve=curve
 }
 spawnGroundDetail(){const R=seeded('ground-life-v1_3');for(let i=0;i<430;i++){const p={x:1+R()*98,y:1+R()*98},t=terrainTypeAt(p);if(t===TERRAIN.WATER||t===TERRAIN.BANK)continue;const q=worldToPx(p);if(t===TERRAIN.FOREST&&R()<.48){const key='shrub-00'+(1+Math.floor(R()*3));if(this.textures.exists(key)){const b=this.add.image(q.x,q.y,key).setOrigin(.5,1).setScale(.18+.14*R()).setAlpha(.45+.3*R()).setDepth(900+q.y);if(R()<.12)this.tweens.add({targets:b,angle:(R()-.5)*1.6,duration:2400+R()*1200,yoyo:true,repeat:-1,ease:'Sine.InOut'});continue}}const tuft=this.add.image(q.x,q.y,'reeds').setOrigin(.5,1).setScale(t===TERRAIN.WETLAND?.11:.045+R()*.04).setAlpha(t===TERRAIN.FOREST?.24:t===TERRAIN.WETLAND?.38:.18).setTint(t===TERRAIN.WETLAND?0x91a45e:t===TERRAIN.FOREST?0x4b6745:0x8d9d70).setDepth(45+q.y*.01);if(R()<.11)this.tweens.add({targets:tuft,angle:(R()-.5)*2,duration:1900+R()*1500,yoyo:true,repeat:-1,ease:'Sine.InOut'})}}
 spawnForest(){
  const R=seeded('canonical-forest-v1_3'),spots=[];for(let tries=0;tries<6200&&spots.length<112;tries++){const p={x:2+R()*96,y:2+R()*96};if(terrainTypeAt(p)!==TERRAIN.FOREST||blocksTree(p))continue;if(spots.some(q=>dist(p,q)<1.42))continue;spots.push(p)}
  const keys=['tree-004','tree-005','tree-006','tree-007','tree-008','tree-009'];for(let i=0;i<spots.length;i++){const p=worldToPx(spots[i]),key=this.textures.exists(keys[i%keys.length])?keys[i%keys.length]:'fallback-tree';this.add.ellipse(p.x+3,p.y+2,50+R()*28,14+R()*8,0x17251b,.16).setDepth(992+p.y);const img=this.add.image(p.x,p.y,key).setOrigin(.5,1),targetH=78+R()*36;img.setDisplaySize(Math.max(42,targetH*(img.width/Math.max(1,img.height))),targetH);img.setDepth(1000+p.y);img.setData('worldPoint',spots[i]);img.setData('kind','tree');this.treeSprites.push(img);if(R()<.72)this.tweens.add({targets:img,angle:(R()-.5)*1.65,duration:2800+R()*2100,yoyo:true,repeat:-1,ease:'Sine.InOut'})}
 }
`,'biome/creek/ground/forest');

const campStart="const shelter=(canonical.worldModel?.objects||[]).find(o=>o.type==='branch_shelter'&&o.state?.active);";
const campEnd=' refreshDynamicWorld(){';
const ai=s.indexOf(campStart),bi=s.indexOf(campEnd,ai);
if(ai<0||bi<0)throw new Error('Missing camp block');
const prefix=s.slice(0,ai),suffix=s.slice(bi),old=s.slice(ai,bi),brace=old.lastIndexOf('\n }');
if(brace<0)throw new Error('Missing drawCanonicalObjects close');
const beforeClose=old.slice(0,old.indexOf(campStart)===0?0:0);
const camp=`const shelter=(canonical.worldModel?.objects||[]).find(o=>o.type==='branch_shelter'&&o.state?.active);if(shelter){const p=worldToPx(shelter.position);this.add.ellipse(p.x+4,p.y+10,104,34,0x17251b,.18).setDepth(995+p.y);if(this.textures.exists('camp-tent'))this.add.image(p.x,p.y+3,'camp-tent').setOrigin(.5,.82).setDisplaySize(92,92).setTint(0xb98258).setDepth(1000+p.y);else this.add.triangle(p.x,p.y,0,46,40,0,80,46,0x74533b,.95).setDepth(1000+p.y)}const fire=(canonical.worldModel?.objects||[]).find(o=>o.type==='camp_fire'&&o.state?.active);if(fire){const p=worldToPx(fire.position),glow=this.add.circle(p.x,p.y+1,26,0xf4a64f,.085).setDepth(996+p.y);this.tweens.add({targets:glow,scale:1.18,alpha:.035,duration:760,yoyo:true,repeat:-1});const f=this.textures.exists('campfire-art')?this.add.image(p.x,p.y,'campfire-art').setDisplaySize(46,46):this.add.circle(p.x,p.y,8,0xef9540,.92);f.setDepth(1000+p.y+2);this.tweens.add({targets:f,scaleX:1.05,scaleY:.94,angle:.7,duration:460,yoyo:true,repeat:-1});for(let i=0;i<3;i++){const smoke=this.add.circle(p.x+(i-1)*3,p.y-12-i*4,4-i*.7,0xd7ded7,.14).setDepth(1002+p.y);this.tweens.add({targets:smoke,y:smoke.y-36,x:smoke.x+(i-1)*8,alpha:0,scale:1.8,duration:2100+i*420,repeat:-1,delay:i*390})}}
 }\n`;
// Replace only the old shelter/fire tail, leaving all earlier canonical object drawing intact.
const tailStart=old.indexOf(campStart);
const replacedOld=old.slice(0,tailStart)+camp;
s=prefix+replacedOld+suffix;

replaceOnce("version:'phaser-v1.2-living-world'","version:'phaser-v1.3-basin-slice'",'version');
fs.writeFileSync(file,s);
console.log('Patched Phaser renderer to v1.3 basin slice');
