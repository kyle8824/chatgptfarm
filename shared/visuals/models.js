import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Canonical assets for the model workshop and the live valley. Metre dimensions;
// geometry/animation only: never fetch, save or advance simulation state.
const surface=new T.MeshStandardMaterial({vertexColors:true,roughness:.78,metalness:0});
const v=(x,y,z)=>new T.Vector3(x,y,z);
function paint(g,color){
 if(g.index)g=g.toNonIndexed();g.deleteAttribute('uv');
 const c=new T.Color(color),a=new Float32Array(g.attributes.position.count*3);
 for(let i=0;i<a.length;i+=3){a[i]=c.r;a[i+1]=c.g;a[i+2]=c.b;}
 g.setAttribute('color',new T.BufferAttribute(a,3));return g;
}
function mesh(parent,g,color,p=[0,0,0],scale){const m=new T.Mesh(paint(g,color),surface);m.position.set(...p);if(scale)m.scale.set(...scale);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function ell(parent,color,p,size,segments=16){return mesh(parent,new T.SphereGeometry(1,segments,12),color,p,size);}
function group(parent,p=[0,0,0]){const g=new T.Group();g.position.set(...p);parent.add(g);return g;}
function tube(parent,color,points,radius=.006,segments=12,sides=6){return mesh(parent,new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>v(...p))),segments,radius,sides,false),color);}
// Cross sections give jackets, limbs and faces an intentional silhouette.
function loft(parent,color,rings,sides=16){
 const pos=[],idx=[];
 for(const [y,rx,rz,z=0,x=0]of rings)for(let j=0;j<sides;j++){const a=j/sides*Math.PI*2;pos.push(x+Math.sin(a)*rx,y,z+Math.cos(a)*rz);}
 for(let i=0;i<rings.length-1;i++)for(let j=0;j<sides;j++){const a=i*sides+j,b=i*sides+(j+1)%sides;idx.push(a,b,b+sides,a,b+sides,a+sides);}
 // Caps have independent vertices. Sharing cap normals with the outer surface
 // produces pinched dark triangles at cuffs, knees and the neck.
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();
 const side=g.toNonIndexed(),cp=[],cn=[];
 for(const end of [0,rings.length-1]){const [y,rx,rz,z=0,x=0]=rings[end],normal=end===0?-1:1;
  for(let j=0;j<sides;j++){const a=j/sides*Math.PI*2,b=(j+1)/sides*Math.PI*2,points=[[x,y,z],[x+Math.sin(a)*rx,y,z+Math.cos(a)*rz],[x+Math.sin(b)*rx,y,z+Math.cos(b)*rz]];if(normal===-1)points.reverse();for(const p of points){cp.push(...p);cn.push(0,normal,0);}}
 }
 const cap=new T.BufferGeometry();cap.setAttribute('position',new T.Float32BufferAttribute(cp,3));cap.setAttribute('normal',new T.Float32BufferAttribute(cn,3));const merged=mergeGeometries([side,cap]);g.dispose();side.dispose();cap.dispose();return mesh(parent,merged,color);
}
function ribbon(parent,color,points,width=.018,depth=.004){const m=tube(parent,color,points,width,12,8);m.scale.z=depth/width;return m;}
function bake(root){
 for(const child of [...root.children])if(child.isGroup)bake(child);
 const parts=root.children.filter(o=>o.isMesh);
 if(!parts.length)return;
 const gs=parts.map(o=>{o.updateMatrix();const g=o.geometry.clone().applyMatrix4(o.matrix);root.remove(o);o.geometry.dispose();return g;});
 const merged=new T.Mesh(mergeGeometries(gs,false),surface);merged.castShadow=true;merged.receiveShadow=true;root.add(merged);gs.forEach(g=>g.dispose());
}
function hairLock(parent,color,points,width=.035,depth=.025){
 const path=new T.CatmullRomCurve3(points.map(p=>v(...p))),frames=path.computeFrenetFrames(14,false),pos=[],idx=[];
 for(let i=0;i<=14;i++){const p=path.getPointAt(i/14),t=i/14,fall=Math.max(.08,Math.sin(Math.PI*(.12+t*.88))**.6);
  for(let j=0;j<8;j++){const a=j/8*Math.PI*2,q=p.clone().addScaledVector(frames.normals[i],Math.cos(a)*width*fall).addScaledVector(frames.binormals[i],Math.sin(a)*depth*fall);pos.push(q.x,q.y,q.z);}}
 for(let i=0;i<14;i++)for(let j=0;j<8;j++){const a=i*8+j,b=i*8+(j+1)%8;idx.push(a,a+8,b+8,a,b+8,b);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();return mesh(parent,g,color);
}
function scalp(parent,color,long){
 const pos=[],idx=[],n=28,m=9;
 for(let j=0;j<=m;j++)for(let i=0;i<=n;i++){
  const a=i/n*Math.PI*2,front=Math.cos(a),edge=long?1.03+(1-front)*.63:1.04+(1-front)*.49;
  const theta=.015+j/m*edge,bulge=long?1:.98;
  pos.push(Math.sin(theta)*Math.sin(a)*.140,.014+Math.cos(theta)*.179,Math.sin(theta)*Math.cos(a)*.122*bulge-.018);
 }
 for(let j=0;j<m;j++)for(let i=0;i<n;i++){const a=j*(n+1)+i;idx.push(a,a+n+2,a+1,a,a+n+1,a+n+2);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();return mesh(parent,g,color);
}
function eye(parent,x,skin,iris){
 const g=group(parent,[x,.034,.098]),outline=[];
 // An almond-shaped white, lying almost flush with the face; no eyeball spheres.
 const shape=new T.Shape();shape.moveTo(-.026,0);shape.quadraticCurveTo(0,.020,.026,0);shape.quadraticCurveTo(0,-.014,-.026,0);
 mesh(g,new T.ShapeGeometry(shape,12),'#fff2d7',[0,0,.007]);
 ell(g,iris,[.001,.001,.009],[.010,.012,.002],14);ell(g,'#24221e',[.001,.001,.011],[.0058,.008,.0014],12);ell(g,'#ffffff',[-.002,.005,.013],[.0027,.003,.001],8);
 tube(g,'#453027',[[-.026,0,.008],[-.013,.012,.01],[.006,.014,.012],[.026,0,.008]],.0024,12,5);
 tube(g,skin,[[-.026,-.001,.008],[0,-.009,.012],[.026,-.001,.008]],.002,10,5);
 return g;
}
function face(head,{skin,hair,iris,female}){
 loft(head,skin,[[-.145,female?.036:.047,.048,.016],[-.13,female?.056:.068,.065,.014],[-.103,female?.078:.089,.081,.009],[-.060,.105,.09,.001],[0,female?.111:.116,.100,0],[.065,female?.108:.114,.10,-.004],[.12,.099,.084,-.014],[.157,.055,.049,-.018],[.168,.005,.005,-.018]],32);
 for(const s of [-1,1]){ell(head,skin,[s*.115,-.008,-.006],[.023,.036,.018]);ell(head,'#bd8569',[s*.130,-.009,.006],[.008,.021,.009]);}
 // Bridge and tip form one restrained nose; lips follow the face's surface.
 loft(head,skin,[[-.038,.006,.005,.100],[-.031,female?.013:.016,.011,.105],[-.023,female?.013:.016,.017,.106],[-.005,.009,.012,.102],[.016,.005,.005,.098],[.028,.001,.001,.098]],20);
 for(const s of [-1,1])ell(head,'#b47d61',[s*.008,-.032,.115],[.0018,.001,.001],8);
 tube(head,'#9d6150',[[-.033,-.077,.085],[-.015,-.081,.095],[0,-.080,.098],[.015,-.078,.095],[.032,-.072,.085]],.0028,16,6);
 tube(head,'#d0977c',[[-.021,-.086,.089],[0,-.088,.095],[.021,-.083,.089]],.003,12,5);
 const eyes=[eye(head,-.044,skin,iris),eye(head,.044,skin,iris)];
 for(const s of [-1,1])tube(head,hair,[[s*.023,.065,.097],[s*.042,.075,.098],[s*.065,.074,.087],[s*.073,.066,.080]],female?.004:.006,14,6);
 ell(head,hair,[0,.005,-.047],[.123,.160,.098],24);scalp(head,hair,female);
 if(female){
  for(const s of [-1,1])for(let i=0;i<4;i++){
   const x=s*(.058+i*.019),z=-.04-i*.017;
   hairLock(head,i%2?'#62422f':'#533525',[[x,.134,z],[s*(.135+i*.008),-.004,z],[s*(.151+i*.010),-.13,z-.014],[s*(.13+i*.012),-.24,z+.022],[s*(.152+i*.010),-.32,z-.015],[s*(.11+i*.012),-.405+i*.008,z]],.040,.031);
  }
  for(let i=0;i<5;i++)hairLock(head,i%2?'#65432f':'#543724',[[(i-2)*.043,.08,-.105],[(i-2)*.046,-.08,-.142],[(i-2)*.049,-.24,-.145],[(i-2)*.044,-.37,-.125]],.043,.034);
  hairLock(head,'#6b4934',[[.023,.176,.028],[-.05,.154,.099],[-.12,.062,.087],[-.135,-.02,.035]],.040,.025);
  hairLock(head,'#674530',[[.027,.176,.025],[.106,.111,.080],[.136,-.004,.02],[.145,-.13,-.017]],.035,.023);
 }else{
  for(let i=0;i<6;i++)hairLock(head,i%2?'#513825':'#493020',[[.10-i*.031,.09,.075],[.096-i*.028,.165,.072],[.025-i*.019,.185,.021],[-.03-i*.009,.149,-.033]],.029,.021);
  for(const s of [-1,1])ell(head,hair,[s*.111,.025,-.012],[.010,.052,.04]);
 }
 return eyes;
}
export function createVillager(name='Mara'){
 const female=name==='Mara',root=new T.Group();root.name=name;
 const skin=female?'#dba17b':'#d5a079',hair=female?'#503322':'#453022',coat=female?'#247c80':'#a77540',shade=female?'#1c6267':'#916137',trim=female?'#3d9795':'#bd8c51',pants=female?'#394c50':'#4b5340',leather='#64462f',boots='#725037';
 const hips=group(root,[0,.82,0]),torso=group(hips);
 const wide=female?.176:.210;
 loft(torso,coat,[[0,.154,.084,0],[.08,.142,.088,0],[.24,female?.13:.173,.093,0],[.39,wide,.101,0],[.46,wide*.90,.083,-.005],[.48,.09,.06,0]],20);
 // Shirt inset, open collar, jacket hems and seams.
 loft(torso,'#343a34',[[.12,.034,.009,.091],[.37,.053,.010,.100],[.47,.060,.01,.072]],10);
 for(const s of [-1,1]){
  tube(torso,trim,[[s*.031,.04,.080],[s*.031,.24,.096],[s*.047,.39,.102],[s*.083,.44,.066]],.004);
  const collar=mesh(torso,new T.BoxGeometry(.052,.115,.017),shade,[s*.066,.43,.072]);collar.rotation.z=s*.27;collar.rotation.x=-.15;
  const pocket=mesh(torso,new T.BoxGeometry(.070,.065,.013),shade,[s*.093,.11,.078]);pocket.rotation.z=-s*.08;
  tube(torso,trim,[[s*.06,.139,.09],[s*.094,.135,.096],[s*.125,.139,.081]],.003);
  tube(torso,leather,[[s*.132,.06,.080],[s*.141,.27,.098],[s*.152,.42,.075],[s*.12,.47,-.036],[s*.10,.19,-.101]],.012,18,6);
 }
 loft(torso,leather,[[.175,.139,.099],[.203,.139,.099]],20);
 mesh(torso,new T.BoxGeometry(.034,.030,.012),'#bfad83',[.035,.190,.103]);
 loft(torso,skin,[[.46,.052,.05,0],[.535,.052,.052,0],[.56,.049,.05,0]],16);
 const head=group(torso,[0,.667,0]);const eyes=face(head,{skin,hair,iris:female?'#597a61':'#7a5739',female});
 const arms=[],legs=[];
 for(const s of [-1,1]){
  const arm=group(torso,[s*(wide+.007),.418,0]);arms.push(arm);arm.rotation.z=s*.065;
  loft(arm,coat,[[-.27,.054,.051,0],[-.20,.062,.060,0],[-.06,.074,.065,0],[0,.066,.061,0],[.035,.025,.035,0]],14);
  const fore=group(arm,[0,-.25,0]);arm.userData.fore=fore;
  ell(fore,coat,[0,0,0],[.055,.047,.052],14);
  loft(fore,coat,[[-.25,.044,.041,0],[-.18,.049,.048,0],[-.03,.055,.051,0],[.014,.050,.046,0]],14);
  loft(fore,shade,[[-.235,.047,.044,0],[-.197,.050,.047,0]],14);
  const hand=group(fore,[0,-.271,.004]);
  ell(hand,skin,[0,-.014,0],[.038,.054,.024]);
  for(let i=0;i<4;i++){const x=(i-1.5)*.016;ell(hand,skin,[x,-.067+(i===0||i===3?.012:0),.008],[.009,.036,.014],10);}
  const thumb=ell(hand,skin,[-s*.038,-.021,.015],[.013,.035,.015]);thumb.rotation.z=-s*.40;
  const leg=group(hips,[s*.083,-.015,0]);legs.push(leg);
  loft(leg,pants,[[-.37,.062,.068,0],[-.25,.077,.083,0],[-.08,.082,.089,0],[.025,.080,.084,0]],16);
  const shin=group(leg,[0,-.365,0]);leg.userData.shin=shin;
  ell(shin,pants,[0,0,0],[.062,.050,.065],14);
  loft(shin,pants,[[-.30,.053,.056,0],[-.15,.055,.057,0],[.015,.063,.068,0]],14);
  const foot=group(shin,[0,-.34,0]);leg.userData.foot=foot;
  loft(foot,boots,[[-.397,.069,.098,.03],[-.34,.066,.074,.012],[-.15,.068,.061,0],[-.12,.067,.059,0]],16);
  ell(foot,boots,[0,-.357,.064],[.071,.057,.135],16);
  loft(foot,'#46352a',[[-.433,.072,.135,.063],[-.406,.074,.136,.063]],18);
  loft(foot,'#886144',[[-.17,.069,.063,0],[-.142,.070,.064,0]],16);
  tube(foot,'#4f3929',[[-.033,-.235,.059],[.033,-.252,.063],[-.032,-.27,.063],[.032,-.287,.070]],.0035,12,5);
  for(const part of foot.children)part.position.y+=.34;
 }
 // A compact pack, without simulated cloth or hair, keeps the cost predictable.
 const bag=group(torso);loft(bag,leather,[[.11,.109,.065,-.112],[.15,.126,.065,-.12],[.35,.117,.062,-.116],[.41,.081,.049,-.113]],16);
 tube(bag,'#987249',[[-.11,.35,-.17],[0,.37,-.183],[.11,.35,-.17]],.009);
 const model={root,hips,torso,head,eyes,arms,legs,bag,name,female};bake(root);return model;
}
export function animateVillager(m,t,mode='idle'){
 const walk=mode==='walk',work=mode==='work',cycle=t*5.4,breath=Math.sin(t*1.8);
 m.hips.position.y=.82+(walk?Math.abs(Math.sin(cycle))*.013:breath*.002);
 m.torso.rotation.x=work?.25:0;m.head.rotation.y=Math.sin(t*.55+(m.female?1:0))*(walk?.025:.10);m.head.rotation.x=work?.10:Math.sin(t*.8)*.015;
 m.arms.forEach((a,i)=>{const phase=cycle+i*Math.PI;a.rotation.x=walk?Math.sin(phase)*.29:work?-.6+Math.sin(t*2.6+i*.2)*.22:Math.sin(t*.9+i)*.015;a.userData.fore.rotation.x=work?-.75:walk?-.12:-.06;});
 m.legs.forEach((l,i)=>{const phase=cycle+i*Math.PI;l.rotation.x=walk?-Math.sin(phase)*.32:0;l.userData.shin.rotation.x=walk?Math.max(0,Math.cos(phase))*.42:0;});
 const blink=(t+(m.female?1.2:3.1))%5.3<.10;m.eyes.forEach(e=>e.scale.y=blink?.09:1);
}
function deerSkin(body,neck){
 const sides=24,steps=40,g=new T.BufferGeometry(),positions=new Float32Array((steps+1)*sides*3),colors=new Float32Array(positions.length),indices=[];
 for(let i=0;i<steps;i++)for(let j=0;j<sides;j++){const a=i*sides+j,b=i*sides+(j+1)%sides;indices.push(a,a+sides,b,b,a+sides,b+sides);}
 g.setAttribute('position',new T.BufferAttribute(positions,3).setUsage(T.DynamicDrawUsage));g.setAttribute('color',new T.BufferAttribute(colors,3));g.setIndex(indices);
 const coat=new T.Color('#b48a58'),belly=new T.Color('#d7bb87'),bib=new T.Color('#eee0bd');
 for(let i=0;i<=steps;i++)for(let j=0;j<sides;j++){const t=i/steps,a=j/sides*Math.PI*2,c=coat.clone();if(t<.58)c.lerp(belly,Math.max(0,-Math.cos(a))*.50);else c.lerp(bib,Math.max(0,Math.cos(a))**10*.55);c.toArray(colors,(i*sides+j)*3);}
 const skin=new T.Mesh(g,surface);skin.castShadow=skin.receiveShadow=true;body.add(skin);let previous;
 const fixed=[v(0,.015,-.49),v(0,.005,-.39),v(0,0,-.22),v(0,0,0),v(0,.025,.16)];
 const radii=[[.001,.001],[.15,.19],[.203,.238],[.205,.245],[.175,.207],[.124,.137],[.092,.102],[.072,.077],[.045,.050]];
 function update(){if(previous===neck.rotation.x)return;previous=neck.rotation.x;neck.updateMatrix();
  const points=[...fixed,...[[0,.015,0],[0,.25,.018],[0,.51,.032],[0,.665,.04]].map(p=>v(...p).applyMatrix4(neck.matrix))];
  const path=new T.CatmullRomCurve3(points,false,'centripetal'),p=new T.Vector3(),tangent=new T.Vector3();
  for(let i=0;i<=steps;i++){const t=i/steps,k=t*(radii.length-1),n=Math.min(radii.length-2,Math.floor(k)),f=k-n,rx=T.MathUtils.lerp(radii[n][0],radii[n+1][0],f),ry=T.MathUtils.lerp(radii[n][1],radii[n+1][1],f);path.getPoint(t,p);path.getTangent(t,tangent);
   for(let j=0;j<sides;j++){const a=j/sides*Math.PI*2,off=(i*sides+j)*3;positions[off]=Math.sin(a)*rx;positions[off+1]=p.y+Math.cos(a)*ry*tangent.z;positions[off+2]=p.z-Math.cos(a)*ry*tangent.y;}
  }
  g.attributes.position.needsUpdate=true;g.computeVertexNormals();g.computeBoundingSphere();
 }
 update();return {mesh:skin,update};
}
export function createDeer(){
 const root=new T.Group(),body=group(root,[0,.85,0]),fur='#b48a58',light='#d7bb87',dark='#5c4430',white='#eee0bd';

 const neck=group(body,[0,.08,.27]);neck.rotation.x=.35;
 // The neck skin is continuous with the torso; no cylinder extends behind its pivot.
 const head=group(neck,[0,.64,.06]);
 ell(head,fur,[0,.022,.025],[.085,.108,.16],20);
 ell(head,light,[0,-.018,.14],[.058,.060,.14],18);ell(head,dark,[0,-.005,.257],[.048,.033,.023],16);
 tube(head,'#664b33',[[-.04,-.051,.17],[0,-.056,.225],[.04,-.051,.17]],.0025);
 const ears=[];
 for(const s of [-1,1]){
  const ear=group(head,[s*.064,.079,-.025]);ear.rotation.z=-s*.62;ear.rotation.x=-.12;ears.push(ear);
  loft(ear,fur,[[0,.035,.021],[.07,.050,.022],[.15,.034,.014],[.205,.002,.002]],14);
  ell(ear,'#ddbd9c',[0,.096,.016],[.029,.078,.007],14);
  ell(head,dark,[s*.077,.048,.078],[.004,.016,.016],14);ell(head,'#eee9d8',[s*.081,.053,.085],[.001,.0025,.003],8);
  tube(head,light,[[s*.071,.069,.062],[s*.084,.073,.082],[s*.078,.060,.10]],.0035,10,5);
 }
 const legs=[];
 for(const front of [true,false])for(const s of [-1,1]){
  const leg=group(body,[s*.103,-.02,front?.22:-.26]);legs.push(leg);leg.userData.front=front;
  loft(leg,fur,[[-.41,.028,.033],[-.30,.038,.042,front?0:-.025],[-.15,front?.065:.078,front?.067:.083,front?0:-.025],[-.035,.069,.075],[.015,.036,.040]],14);
  const shin=group(leg,[0,-.405,0]);leg.userData.shin=shin;
  ell(shin,fur,[0,0,0],[.030,.028,.034],12);
  loft(shin,light,[[-.345,.017,.025],[front?-.12:-.10,.021,.027,front?0:-.035],[0,.030,.035]],12);
  ell(shin,dark,[0,-.370,.016],[.033,.038,.052],14);
  tube(shin,'#382e24',[[0,-.386,.060],[0,-.353,.061]],.0025,4,4);
 }
 const tail=group(body,[0,.025,-.45]);tail.rotation.x=-.35;ell(tail,fur,[0,-.036,-.047],[.055,.06,.105]);ell(tail,white,[0,-.052,-.04],[.043,.045,.086]);
 bake(root);const skin=deerSkin(body,neck);return {root,body,neck,head,ears,legs,tail,skin};
}
export function animateDeer(m,t,mode='idle',dt=1){
 const walk=mode==='walk',graze=mode==='work';m.body.position.y=.85+(walk?Math.cos(t*6)*.007:Math.sin(t*1.5)*.002);
 const blend=1-Math.exp(-dt*7);m.neck.rotation.x+=((graze?2.55:.35+Math.sin(t*.8)*.025)-m.neck.rotation.x)*blend;m.head.rotation.x+=((graze?-.65:0)-m.head.rotation.x)*blend;m.head.rotation.y=graze?0:Math.sin(t*.47)*.10;
 m.skin.update();m.ears.forEach((e,i)=>e.rotation.y=Math.sin(t*1.4+i*2.3)*.13);m.tail.rotation.x=-.35+Math.sin(t*2)*.08;
 m.legs.forEach((l,i)=>{const phase=t*5.4+[0,Math.PI,Math.PI,0][i];l.rotation.x=walk?Math.sin(phase)*.32:0;l.userData.shin.rotation.x=walk?Math.max(0,-Math.sin(phase))*(l.userData.front?.45:-.45):0;});
}
export function geometryStats(root){let triangles=0,meshes=0;root.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;}});return {triangles,meshes};}
