from pathlib import Path
import json,re

src=Path('world-pixi-v7.js').read_text()

src=src.replace("let app,root,terrain,objects,artifacts,agentsLayer,screenFx,current,lastTick=null;","let app,root,terrain,screenFx,current,lastTick=null;let worldItems=[];",1)

new_init=r'''async function init(){const host=$('#worldViewport');app=new PIXI.Application({resizeTo:host,backgroundColor:C.ground,antialias:true,resolution:Math.min(devicePixelRatio||1,2),autoDensity:true});host.appendChild(app.view);app.stage.sortableChildren=true;root=new PIXI.Container();root.sortableChildren=true;app.stage.addChild(root);terrain=new PIXI.Container();terrain.zIndex=0;root.addChild(terrain);screenFx=new PIXI.Container();screenFx.zIndex=100000;app.stage.addChild(screenFx);wireCamera();wireUI();app.ticker.add(tick);await load(true);setInterval(()=>load(false),12000);window.addEventListener('resize',()=>{drawAtmosphere();updateCamera(true)})}'''
src,n=re.subn(r"async function init\(\)\{.*?\}\nasync function load",new_init+"\nasync function load",src,count=1,flags=re.S)
if n!=1:raise SystemExit('init anchor not found')

helper_anchor="function field(type,x,y){return terrainBy(type).reduce((m,t)=>Math.max(m,influence(t,x,y)),0)}\n"
helpers=r'''function field(type,x,y){return terrainBy(type).reduce((m,t)=>Math.max(m,influence(t,x,y)),0)}
function worldZ(y,bias=0){return 100+Math.round(y)+bias}
function addWorld(c,y,bias=0,meta={}){c.zIndex=worldZ(y,bias);c._debug={...meta,screenBaseY:y,zIndex:c.zIndex};root.addChild(c);worldItems.push(c);return c}
function addGround(c){terrain.addChild(c);return c}
function clearWorldItems(){for(const c of worldItems){try{c.destroy({children:true})}catch{}}worldItems=[];agentSprites.clear();selection=null}
function groundFeature(o,p,g){const c=new PIXI.Container();c.position.set(p.x,p.y);c.addChild(g);makeSelectable(c,o);terrain.addChild(c);return c}
function rendererDebug(){const items=worldItems.map(c=>c._debug).filter(Boolean);return{version:'v8-spatial-depth',camera:{...camera},items,counts:items.reduce((a,x)=>(a[x.kind]=(a[x.kind]||0)+1,a),{})}}
window.ChatGPTFarmRendererDebug={snapshot:rendererDebug};
'''
if helper_anchor not in src:raise SystemExit('field helper anchor not found')
src=src.replace(helper_anchor,helpers,1)

new_render=r'''function renderWorld(){terrain.removeChildren().forEach(d=>d.destroy({children:true}));clearWorldItems();selectables.clear();drawGround();drawCreek();drawAggregateTerrain();const os=(current.worldModel.objects||[]).filter(o=>o.state?.active!==false);os.filter(o=>!o.parentId).forEach(drawObject);os.filter(o=>o.parentId).forEach(drawComponent);(current.artifacts||[]).filter(a=>a.status==='active'||a.status==='remnant').forEach(drawArtifact)}'''
src,n=re.subn(r"function renderWorld\(\)\{.*?\}\nfunction drawGround",new_render+"\nfunction drawGround",src,count=1,flags=re.S)
if n!=1:raise SystemExit('renderWorld anchor not found')

new_tree=r'''function drawTree(x,y,s,R){const c=new PIXI.Container();c.position.set(x,y);const shadow=new PIXI.Graphics();shadow.beginFill(C.shadow,.18).drawEllipse(s*.08,s*.30,s*.72,s*.24).endFill();const trunk=new PIXI.Graphics();trunk.beginFill(0x5a3f2b,.98).drawRoundedRect(-s*.11,-s*.12,s*.22,s*.86,Math.max(2,s*.06)).endFill();trunk.beginFill(0x745039,.42).drawRoundedRect(-s*.07,-s*.08,s*.06,s*.72,2).endFill();const crown=new PIXI.Graphics();crown.beginFill(C.forestLeaf,.99).drawCircle(-s*.34,-s*.68,s*.55).drawCircle(s*.34,-s*.66,s*.58).drawCircle(0,-s*1.03,s*.67).endFill();crown.beginFill(C.forestHi,.48).drawCircle(-s*.19,-s*1.18,s*.30).endFill();c.addChild(shadow,trunk,crown);addWorld(c,y,0,{kind:'tree',tier:'high-vegetation',height:Math.round(s*2.05)})}'''
src,n=re.subn(r"function drawTree\(x,y,s,R\)\{.*?\}\nfunction drawAggregateTerrain",new_tree+"\nfunction drawAggregateTerrain",src,count=1,flags=re.S)
if n!=1:raise SystemExit('drawTree anchor not found')

new_aggregate=r'''function drawAggregateTerrain(){for(const t of current.worldModel.terrain||[]){const p=wp(t.center),r=((t.radiusM||20)/2)*PX,R=rng(`${t.id}-v8`);if(t.type==='forest'){for(let i=0;i<54;i++){const a=R()*Math.PI*2,rr=Math.sqrt(R())*r*.96,s=39+R()*16;drawTree(p.x+Math.cos(a)*rr,p.y+Math.sin(a)*rr,s,R)}}else if(t.type==='wetland'){const g=new PIXI.Graphics();for(let i=0;i<42;i++){const a=R()*Math.PI*2,rr=Math.sqrt(R())*r*.94,x=p.x+Math.cos(a)*rr,y=p.y+Math.sin(a)*rr;g.beginFill(i%3?C.wet:C.waterDark,.07+R()*.08).drawEllipse(x,y,18+R()*42,6+R()*15).endFill()}for(let i=0;i<115;i++){const a=R()*Math.PI*2,rr=Math.sqrt(R())*r*.94,x=p.x+Math.cos(a)*rr,y=p.y+Math.sin(a)*rr,h=4+R()*7;g.lineStyle(1.1,C.reed,.25+R()*.16).moveTo(x,y+2).lineTo(x+(R()-.5)*2,y-h)}terrain.addChild(g)}}}'''
src,n=re.subn(r"function drawAggregateTerrain\(\)\{.*?\}\nfunction drawCreek",new_aggregate+"\nfunction drawCreek",src,count=1,flags=re.S)
if n!=1:raise SystemExit('aggregate anchor not found')

new_object=r'''function drawObject(o){if(o.type==='creek_segment')return;const p=wp(o.position),R=rng(`${o.id}-v8`);
if(o.type==='camp_area'){const g=new PIXI.Graphics();for(let i=0;i<18;i++){const a=R()*Math.PI*2,rr=Math.sqrt(R())*90;g.beginFill(C.mud,.07).drawEllipse(Math.cos(a)*rr,Math.sin(a)*rr*.58,8+R()*20,3+R()*7).endFill()}groundFeature(o,p,g);return}
if(o.type==='clay_bank'){const g=new PIXI.Graphics();g.beginFill(mix(C.clay,C.mud,.20),.72).drawEllipse(0,7,78,34).endFill();g.beginFill(C.mud,.20).drawEllipse(-22,12,31,10).drawEllipse(29,5,24,8).endFill();for(let i=0;i<16;i++)g.beginFill(i%2?0xd19a73:0x77513c,.16+R()*.10).drawEllipse((R()-.5)*105,(R()-.5)*37+7,3+R()*8,1.5+R()*4).endFill();groundFeature(o,p,g);return}
if(o.type==='frontier'){const g=new PIXI.Graphics();for(let i=0;i<12;i++){const x=(R()-.5)*210,y=(R()-.5)*220,r=40+R()*75;g.beginFill(0xdbe1da,.010+R()*.010).drawCircle(x,y,r).endFill()}groundFeature(o,p,g);return}
if(o.type==='animal_tracks'){const g=new PIXI.Graphics(),clarity=clamp(o.state?.clarity??.72,.1,1);for(let i=0;i<7;i++){const x=i*12-35,y=(i%2?6:-5)+i*2;g.beginFill(0x2b2119,.5*clarity).drawEllipse(x,y,4,6).endFill();g.beginFill(0x2b2119,.36*clarity).drawCircle(x-4,y-4,2).drawCircle(x,y-6,2).drawCircle(x+4,y-4,2).endFill()}groundFeature(o,p,g);return}
if(o.type==='berry_patch'){const footprint=new PIXI.Graphics();footprint.beginFill(0x405f3f,.13).drawEllipse(0,9,65,35).endFill();groundFeature(o,p,footprint);if(!o.resolution?.componentsInstantiated){const fruit=Math.max(0,o.state?.ediblePortions||0),count=o.state?.exhausted?4:11;for(let i=0;i<count;i++){const x=(R()-.5)*102,y=(R()-.5)*54,s=(o.state?.exhausted?7:10)+R()*7,b=new PIXI.Container();b.position.set(p.x+x,p.y+y);const g=new PIXI.Graphics();g.beginFill(o.state?.exhausted?C.leafDry:C.leaf,.98).drawCircle(0,0,s).endFill();g.beginFill(shade(o.state?.exhausted?C.leafDry:C.leaf,.12),.45).drawCircle(-4,-5,s*.45).endFill();if(i<fruit*2)g.beginFill(C.berry,.95).drawCircle((R()-.5)*8,(R()-.5)*7,3).endFill();b.addChild(g);makeSelectable(b,o);addWorld(b,p.y+y,1,{kind:'berry-bush',tier:'shrub',sourceId:o.id,height:Math.round(s*2)})}}return}
if(o.type==='stone_field'){const footprint=new PIXI.Graphics();footprint.beginFill(C.rock2,.06).drawEllipse(0,8,82,39).endFill();groundFeature(o,p,footprint);if(!o.resolution?.componentsInstantiated){for(let i=0;i<16;i++){const a=R()*Math.PI*2,rr=Math.sqrt(R())*72,x=Math.cos(a)*rr,y=Math.sin(a)*rr*.46,s=5+R()*9,c=new PIXI.Container();c.position.set(p.x+x,p.y+y);const g=new PIXI.Graphics();g.beginFill(i%2?C.rock:C.rock2,.98).drawEllipse(0,0,s,s*.7).endFill();g.beginFill(0xd2d8d3,.17).drawEllipse(-2,-2,s*.55,s*.25).endFill();c.addChild(g);makeSelectable(c,o);addWorld(c,p.y+y,1,{kind:'rock',tier:'ground-object',sourceId:o.id,height:Math.round(s*1.4)})}}return}
if(o.type==='reed_marsh'){const ground=new PIXI.Graphics();ground.beginFill(mix(C.wet,C.mud,.12),.34).drawEllipse(0,10,108,62).endFill();for(let i=0;i<14;i++){const x=(R()-.5)*155,y=(R()-.5)*80;ground.beginFill(C.waterDark,.10+R()*.07).drawEllipse(x,y+13,10+R()*22,3+R()*7).endFill()}groundFeature(o,p,ground);if(!o.resolution?.componentsInstantiated){for(let i=0;i<22;i++){const x=(R()-.5)*145,y=(R()-.5)*93,h=17+R()*17,c=new PIXI.Container();c.position.set(p.x+x,p.y+y);const g=new PIXI.Graphics();for(let k=-1;k<=1;k++){const hh=h-(Math.abs(k)*3)+R()*3;g.lineStyle(1.6,C.reed,.88).moveTo(k*3,5).lineTo(k*2,-hh);if(i%7===0&&k===0)g.beginFill(0x86623d,.78).drawEllipse(k*2,-hh,1.5,4).endFill()}c.addChild(g);makeSelectable(c,o);addWorld(c,p.y+y,0,{kind:'reed-cluster',tier:'low-vegetation',sourceId:o.id,height:Math.round(h+5)})}}return}
const c=new PIXI.Container();c.position.set(p.x,p.y);const g=new PIXI.Graphics();let meta={kind:o.type,tier:'world-object',sourceId:o.id,height:32};
if(o.type==='fallen_tree'){const len=(o.geometry?.lengthM||4.8)*29,wc=wetWood(o);g.lineStyle(25,C.woodDark,.98).moveTo(-len/2,0).lineTo(len/2,0);g.lineStyle(17,wc,.99).moveTo(-len/2,0).lineTo(len/2,0);g.lineStyle(2,shade(wc,.2),.5).moveTo(-len/2+9,-4).lineTo(len/2-9,-4);if(!o.resolution?.componentsInstantiated)for(let i=0;i<4;i++){const x=-len*.34+i*len*.22,d=i%2?-1:1;g.lineStyle(7,wc,.96).moveTo(x,0).lineTo(x+d*(24+R()*24),d*(18+R()*21))}c.rotation=((o.geometry?.orientationDeg||0)-90)*Math.PI/180;meta.height=34}
else if(o.type==='branch_shelter'){const shadow=new PIXI.Graphics();shadow.beginFill(C.shadow,.18).drawEllipse(3,25,55,16).endFill();c.addChild(shadow);g.beginFill(0x5f462f,.98).moveTo(-52,29).lineTo(0,-50).lineTo(54,29).lineTo(36,29).lineTo(0,-26).lineTo(-31,29).closePath().endFill();g.lineStyle(4,0x9a7449,.9).moveTo(-46,26).lineTo(0,-47).lineTo(47,26);meta={kind:'shelter',tier:'structure',sourceId:o.id,height:79}}
else if(o.type==='camp_fire'){const glow=new PIXI.Graphics();glow.beginFill(C.fire2,.14).drawCircle(0,0,72).endFill();c.addChild(glow);g.beginFill(C.rock2,.95);for(let i=0;i<8;i++){const a=i/8*Math.PI*2;g.drawCircle(Math.cos(a)*20,Math.sin(a)*12+8,5)}g.endFill();g.lineStyle(6,C.woodDark,.98).moveTo(-19,13).lineTo(19,3).moveTo(-19,3).lineTo(19,13);const f=new PIXI.Graphics();f.beginFill(C.fire,.98).drawPolygon([-12,12,0,-31,12,12]).endFill();f.beginFill(C.fire2,.95).drawPolygon([-6,9,0,-15,6,9]).endFill();f.name='flame';c.addChild(f);meta={kind:'fire',tier:'structure',sourceId:o.id,height:43}}
else if(o.type==='drying_rack'){g.lineStyle(6,C.wood,.98).moveTo(-36,24).lineTo(-24,-27).moveTo(36,24).lineTo(24,-27).moveTo(-31,-10).lineTo(31,-10);for(let i=-18;i<=18;i+=9)g.lineStyle(2,0xb09a69,.86).moveTo(i,-10).lineTo(i,16);meta={kind:'drying-rack',tier:'structure',sourceId:o.id,height:51}}
else return;c.addChildAt(g,0);makeSelectable(c,o);label(c,o.label);addWorld(c,p.y,2,meta)}'''
src,n=re.subn(r"function drawObject\(o\)\{.*?\}\nfunction drawComponent",new_object+"\nfunction drawComponent",src,count=1,flags=re.S)
if n!=1:raise SystemExit('drawObject anchor not found')

new_component=r'''function drawComponent(o){const p=wp(o.position),c=new PIXI.Container();c.position.set(p.x,p.y);const g=new PIXI.Graphics();let h=20,tier='component';if(o.type==='branch'){g.lineStyle(6,C.wood,.98).moveTo(-17,0).lineTo(17,0);h=10}else if(o.type==='rock'){g.beginFill(C.rock,.98).drawEllipse(0,0,10,7).endFill();h=14}else if(o.type==='berry_bush'){g.beginFill(C.leaf,.98).drawCircle(0,0,13).endFill();h=26;tier='shrub'}else if(o.type==='clay_deposit'){g.beginFill(C.clay,.78).drawEllipse(0,2,12,6).endFill();h=12;tier='ground-object'}else if(o.type==='reed_stand'){for(let i=-7;i<=7;i+=4){const hh=16+Math.abs(i)*.35;g.lineStyle(1.6,C.reed,.94).moveTo(i,6).lineTo(i,-hh);if(i===-7||i===7)g.beginFill(0x86623d,.75).drawEllipse(i,-hh,1.3,3.5).endFill()}h=25;tier='low-vegetation'}else if(o.type==='trunk'){g.lineStyle(20,C.wood,.98).moveTo(-24,0).lineTo(24,0);h=22}else return;c.addChild(g);makeSelectable(c,o);label(c,o.label,28);addWorld(c,p.y,3,{kind:o.type,tier,sourceId:o.id,height:h})}'''
src,n=re.subn(r"function drawComponent\(o\)\{.*?\}\nfunction drawArtifact",new_component+"\nfunction drawArtifact",src,count=1,flags=re.S)
if n!=1:raise SystemExit('drawComponent anchor not found')

new_artifact=r'''function drawArtifact(a){const p=wp(a.coordinates||{x:50,y:50}),c=new PIXI.Container();c.position.set(p.x+12,p.y-10);const g=new PIXI.Graphics(),t=a.type||'';let h=20;if(/ClayVessel/i.test(t)){g.lineStyle(2,0xe0b28b,.9).beginFill(0xa87150,.98).drawEllipse(0,3,10,13).endFill().moveTo(-7,-5).lineTo(7,-5);h=26}else if(/sharpStone/i.test(t)){g.beginFill(0xa9b1aa,.98).drawPolygon([-11,8,0,-11,10,7]).endFill();h=19}else if(/Pole/i.test(t)){g.lineStyle(5,C.wood,.98).moveTo(-18,9).lineTo(18,-9);h=18}else if(/cordage/i.test(t)){g.lineStyle(3,0xc3aa70,.95).drawCircle(0,0,10);h=20}else g.beginFill(0xd3c38a,.92).drawCircle(0,0,6).endFill();c.addChild(g);makeSelectable(c,a,'artifact');addWorld(c,p.y-10,5,{kind:'artifact',tier:'carried-or-ground-object',sourceId:a.id,height:h})}'''
src,n=re.subn(r"function drawArtifact\(a\)\{.*?\}\nfunction progress",new_artifact+"\nfunction progress",src,count=1,flags=re.S)
if n!=1:raise SystemExit('drawArtifact anchor not found')

new_agent=r'''function makeAgent(a,i){const c=new PIXI.Container();const sh=new PIXI.Graphics();sh.beginFill(C.shadow,.28).drawEllipse(0,18,21,8).endFill();const legs=new PIXI.Graphics();legs.lineStyle(6,0x29312c,1).moveTo(-6,10).lineTo(-8,24).moveTo(6,10).lineTo(8,24);const body=new PIXI.Graphics();body.beginFill(i?C.ivo:C.mara).drawRoundedRect(-13,-10,26,32,9).endFill();const head=new PIXI.Graphics();head.beginFill(i?C.skinB:C.skinA).drawCircle(0,-22,10).endFill();const hair=new PIXI.Graphics();hair.beginFill(i?0x2d2927:0x5b3d2d).drawEllipse(0,-26,10,5).endFill();const arm=new PIXI.Graphics();arm.lineStyle(5,i?0x5b5f8c:0x587b64,1).moveTo(10,-1).lineTo(18,10);const prop=new PIXI.Container();prop.position.set(20,4);const name=new PIXI.Text(a.name,{fontFamily:'Arial',fontSize:13,fontWeight:'700',fill:0xffffff,stroke:0x08100b,strokeThickness:4});name.anchor.set(.5);name.y=-45;const status=new PIXI.Text('',{fontFamily:'Arial',fontSize:9,fill:0xd7e1d6,stroke:0x08100b,strokeThickness:3});status.anchor.set(.5);status.y=34;c.addChild(sh,legs,body,head,hair,arm,prop,name,status);c.eventMode='static';c.cursor='pointer';c.on('pointertap',e=>{e.stopPropagation();showSelection(c);openInspector(a,'agent')});c._p={legs,body,head,hair,arm,prop,name,status};addWorld(c,wp(a.coordinates||{x:50,y:50}).y,8,{kind:'agent',tier:'agent',sourceId:a.id,height:58});agentSprites.set(a.id,c);return c}'''
src,n=re.subn(r"function makeAgent\(a,i\)\{.*?\}\nfunction renderAgents",new_agent+"\nfunction renderAgents",src,count=1,flags=re.S)
if n!=1:raise SystemExit('makeAgent anchor not found')

render_anchor="function renderAgents(){current.agents.forEach((a,i)=>{let c=agentSprites.get(a.id);if(!c)c=makeAgent(a,i);c._data=a})}\n"
label_func=r'''function renderAgents(){current.agents.forEach((a,i)=>{let c=agentSprites.get(a.id);if(!c)c=makeAgent(a,i);c._data=a})}
function resolveAgentLabels(){const list=current.agents.map(a=>({a,c:agentSprites.get(a.id)})).filter(x=>x.c);for(const x of list){x.c._p.name.x=0;x.c._p.name.y=-45;x.c._p.name.alpha=1}for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){const A=list[i].c,B=list[j].c;if(Math.hypot(A.x-B.x,A.y-B.y)<62){A._p.name.x=-18;A._p.name.y=-51;B._p.name.x=18;B._p.name.y=-38}}}
'''
if render_anchor not in src:raise SystemExit('renderAgents anchor not found')
src=src.replace(render_anchor,label_func,1)

src=src.replace("c.zIndex=p.y+20;","c.zIndex=worldZ(p.y,8);if(c._debug){c._debug.screenBaseY=p.y;c._debug.zIndex=c.zIndex;}",1)
src=src.replace("}for(const c of objects.children){","}resolveAgentLabels();for(const c of worldItems){",1)

# Sanity: all raised visuals should now be direct world items rather than fixed visual layers.
for bad in ['objects.addChild','artifacts.addChild','agentsLayer.addChild','objects.children']:
    if bad in src:raise SystemExit(f'legacy fixed-depth reference remains: {bad}')

src=src.replace("rng('ground-v7')","rng('ground-v8')",1).replace("rng('creek-v7')","rng('creek-v8')",1)
Path('world-pixi-v8.js').write_text(src)
Path('action-visuals-v8.js').write_text(Path('action-visuals-v7.js').read_text())

index=Path('index.html').read_text().replace('action-visuals-v7.js?v=0807','action-visuals-v8.js?v=0808').replace('world-pixi-v7.js?v=0807','world-pixi-v8.js?v=0808')
Path('index.html').write_text(index)

pkg=json.loads(Path('package.json').read_text());pkg['version']='0.8.4';pkg['scripts']['test']=pkg['scripts']['test'].replace('world-pixi-v7.js','world-pixi-v8.js');Path('package.json').write_text(json.dumps(pkg,indent=2)+'\n')
