from pathlib import Path


def replace_once(text, old, new, label):
    count=text.count(old)
    if count!=1:
        raise SystemExit(f'{label}: expected exactly one anchor, found {count}')
    return text.replace(old,new,1)

spectator_path=Path('engine/spectator.js')
renderer_path=Path('phaser-world-v1.js')
qa_path=Path('scripts/living-history-qa.mjs')
browser_path=Path('scripts/phaser-qa.mjs')
html_path=Path('phaser.html')

spectator=spectator_path.read_text()
if 'surface-history-1' not in spectator:
    anchor="const distance=(a,b)=>Math.hypot((a.x||0)-(b.x||0),(a.y||0)-(b.y||0));\n"
    helpers=r'''const routePointKey=p=>`${Math.round((p?.x||0)*2)/2},${Math.round((p?.y||0)*2)/2}`;
const routeKey=(from,to)=>[routePointKey(from),routePointKey(to)].sort().join('|');
function recordSurfaceUse(w,a,from,to,actionId){
 const h=w.surfaceHistory||(w.surfaceHistory={version:'surface-history-1',routes:[],campWear:{uses:0,agents:{},lastUsed:null}});h.version='surface-history-1';h.routes||=[];h.campWear||={uses:0,agents:{},lastUsed:null};
 const moving=distance(from,to)>2;
 if(moving){const key=routeKey(from,to);let r=h.routes.find(x=>x.key===key);if(!r){r={id:`ROUTE-${String(h.routes.length+1).padStart(3,'0')}`,key,from:{...from},to:{...to},traversals:0,agents:{},firstUsed:{day:w.day,hour:w.hour},lastUsed:null,lastActionId:null};h.routes.push(r)}r.traversals++;r.agents[a.id]=(r.agents[a.id]||0)+1;r.lastUsed={day:w.day,hour:w.hour};r.lastActionId=actionId||null;h.routes=h.routes.slice(-24)}
 if(a.position==='camp'){const c=h.campWear;c.uses++;c.agents[a.id]=(c.agents[a.id]||0)+1;c.lastUsed={day:w.day,hour:w.hour}}
}
'''
    spectator=replace_once(spectator,anchor,anchor+helpers,'surface-history helpers')
    old="export function buildPlayback(w,a,{decisionId,label,actionId,from,to,outcome,physicalProposal=null}){const moving=distance(from,to)>2,phases="
    new="export function buildPlayback(w,a,{decisionId,label,actionId,from,to,outcome,physicalProposal=null}){recordSurfaceUse(w,a,from,to,actionId);const moving=distance(from,to)>2,phases="
    spectator=replace_once(spectator,old,new,'record surface use in playback')
    spectator_path.write_text(spectator)
else:
    print('surface history already present in spectator source')

renderer=renderer_path.read_text()
if "travel-wear-v1" not in renderer:
    renderer=replace_once(renderer,"this.entities=new Map();this.treeSprites=[];this.ambient=[];this.traceVisuals=[];this.signVisuals=[];", "this.entities=new Map();this.treeSprites=[];this.ambient=[];this.traceVisuals=[];this.signVisuals=[];this.routeVisuals=[];",'route visual scene state')
    renderer=replace_once(renderer,"this.drawOrganicSurface();this.drawBiomeUnderlays();", "this.drawOrganicSurface();this.renderTravelWear();this.drawBiomeUnderlays();",'initial travel wear rendering')
    renderer=replace_once(renderer,"refreshDynamicWorld(){this.renderCanonicalTraces();", "refreshDynamicWorld(){this.renderTravelWear();this.renderCanonicalTraces();",'dynamic travel wear rendering')
    anchor=" drawBiomeUnderlays(){"
    method=r''' renderTravelWear(){
  for(const v of this.routeVisuals)v.destroy();this.routeVisuals=[];
  const now=(canonical?.day||1)*24+(canonical?.hour||0),routes=(canonical?.surfaceHistory?.routes||[]).filter(r=>(r.traversals||0)>=2);
  for(const r of routes){const p1=worldToPx(r.from),p2=worldToPx(r.to),last=(r.lastUsed?.day||canonical.day)*24+(r.lastUsed?.hour||0),age=Math.max(0,now-last),recency=clamp(1-age/168,.28,1),strength=clamp(((r.traversals||0)-1)/8,.12,1)*recency,R=seeded(`wear:${r.key||r.id}`),dx=p2.x-p1.x,dy=p2.y-p1.y,m=Math.hypot(dx,dy)||1,nx=-dy/m,ny=dx/m,bend=(10+R()*24)*(R()<.5?-1:1),ctrl=new Phaser.Math.Vector2((p1.x+p2.x)/2+nx*bend,(p1.y+p2.y)/2+ny*bend),curve=new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(p1.x,p1.y),ctrl,new Phaser.Math.Vector2(p2.x,p2.y)),points=curve.getPoints(30),segments=[];let seg=[];for(const p of points){const t=terrainTypeAt(pxToWorld(p));if(t===TERRAIN.WATER||t===TERRAIN.BANK){if(seg.length>1)segments.push(seg);seg=[]}else seg.push(p)}if(seg.length>1)segments.push(seg);const g=this.add.graphics().setDepth(28);for(const pts of segments){g.lineStyle(9,0x685b43,.025+.055*strength);g.strokePoints(pts,false,false);g.lineStyle(2.2,0x8b795b,.04+.095*strength);g.strokePoints(pts,false,false)}g.setData('kind','travel-wear');g.setData('routeId',r.id);g.setData('traversals',r.traversals||0);this.routeVisuals.push(g)}
 }
'''
    renderer=replace_once(renderer,anchor,method+anchor,'travel wear method')
    old_camp="if(o.type==='camp_area'){this.add.ellipse(p.x,p.y+8,150,78,0x675a43,.16).setDepth(15);continue}"
    new_camp="if(o.type==='camp_area'){const uses=canonical?.surfaceHistory?.campWear?.uses||0,strength=clamp(uses/28,0,1);this.add.ellipse(p.x,p.y+8,150+strength*34,78+strength*16,0x675a43,.12+strength*.11).setDepth(15);continue}"
    renderer=replace_once(renderer,old_camp,new_camp,'camp wear projection')
    renderer=replace_once(renderer,"ecologicalSigns:'ecological-signs-v1',rangePresenceCounts:", "ecologicalSigns:'ecological-signs-v1',travelWear:'travel-wear-v1',rangePresenceCounts:",'travel wear snapshot marker')
    renderer=replace_once(renderer,"livingWorld:{signVisuals:this.signVisuals.length,", "livingWorld:{routeVisuals:this.routeVisuals.length,canonicalRoutes:(canonical?.surfaceHistory?.routes||[]).filter(r=>(r.traversals||0)>=2).length,campWear:canonical?.surfaceHistory?.campWear?.uses||0,signVisuals:this.signVisuals.length,",'travel wear snapshot counts')
    renderer=replace_once(renderer,"version:'phaser-v1.4-living-world'","version:'phaser-v1.5-living-history'",'v1.5 renderer version')
    renderer_path.write_text(renderer)
else:
    print('travel wear already present in renderer source')

qa=qa_path.read_text()
if 'surfaceHistory' not in qa:
    qa="import { buildPlayback } from '../engine/spectator.js';\n"+qa
    qa += r'''

const routeWorld=createWorld(),walker=routeWorld.agents.find(a=>a.id==='agent-mara'),from={x:43,y:31},to={x:64,y:34};
walker.position='camp';
for(let i=0;i<3;i++)buildPlayback(routeWorld,walker,{decisionId:`ROUTE-QA-${i}`,label:'Walk used ground',actionId:'qa_walk',from:i%2?to:from,to:i%2?from:to,outcome:{success:true,detail:'QA traversal'}});
const routes=routeWorld.surfaceHistory?.routes||[],route=routes[0];
if(routes.length!==1)failures.push(`reverse travel should reinforce one canonical route, got ${routes.length}`);
if(route?.traversals!==3)failures.push(`canonical route traversal count drifted: ${route?.traversals}`);
if((route?.agents?.[walker.id]||0)!==3)failures.push(`route did not retain per-agent use: ${JSON.stringify(route?.agents)}`);
if((routeWorld.surfaceHistory?.campWear?.uses||0)!==3)failures.push(`camp use did not accumulate canonical wear: ${routeWorld.surfaceHistory?.campWear?.uses}`);
if(failures.length){console.error(failures.join('\n'));process.exit(1)}
console.log(JSON.stringify({travelHistory:{routeId:route.id,traversals:route.traversals,campUses:routeWorld.surfaceHistory.campWear.uses}},null,2));
'''
    # move the final existing failure check so route assertions can share the same array
    first="if(failures.length){console.error(failures.join('\\n'));process.exit(1)}\nconsole.log(JSON.stringify({\n  ok:true,"
    if first in qa:
        qa=qa.replace(first,"console.log(JSON.stringify({\n  ok:true,",1)
    qa_path.write_text(qa)
else:
    print('travel history QA already present')

browser=browser_path.read_text()
if 'expectedRoutes' not in browser:
    browser=replace_once(browser,"if(s.version!=='phaser-v1.4-living-world')failures.push(`wrong renderer: ${s.version}`);", "if(s.version!=='phaser-v1.5-living-history')failures.push(`wrong renderer: ${s.version}`);",'browser renderer version')
    setup="state=migrateWorld(JSON.parse(fs.readFileSync('world/state.json','utf8')));\nadvanceEcology(state);"
    setup_new=setup+"\nstate.surfaceHistory={version:'surface-history-1',routes:[{id:'ROUTE-QA-VISUAL',key:'43,31|64,34',from:{x:43,y:31},to:{x:64,y:34},traversals:5,agents:{'agent-mara':3,'agent-ivo':2},firstUsed:{day:state.day,hour:Math.max(0,state.hour-5)},lastUsed:{day:state.day,hour:state.hour},lastActionId:'qa_walk'}],campWear:{uses:12,agents:{'agent-mara':7,'agent-ivo':5},lastUsed:{day:state.day,hour:state.hour}}};"
    browser=replace_once(browser,setup,setup_new,'browser canonical route fixture')
    anchor="if(!Number.isFinite(s.concealedWildlife))failures.push(`wildlife concealment state missing: ${s.concealedWildlife}`);"
    check="const expectedRoutes=(state.surfaceHistory?.routes||[]).filter(r=>(r.traversals||0)>=2).length;if(s.livingWorld?.routeVisuals!==expectedRoutes||s.livingWorld?.canonicalRoutes!==expectedRoutes)failures.push(`travel-wear projection drift: rendered=${s.livingWorld?.routeVisuals} canonical=${expectedRoutes}`);if(s.livingWorld?.campWear!==12)failures.push(`camp-wear projection drift: ${s.livingWorld?.campWear}`);"
    browser=replace_once(browser,anchor,anchor+check,'browser travel wear assertions')
    browser_path.write_text(browser)

html=html_path.read_text().replace('phaser-world.css?v=00147','phaser-world.css?v=00151').replace('phaser-world-v1.js?v=00147','phaser-world-v1.js?v=00151')
html_path.write_text(html)
print('Applied v1.5.1 canonical travel wear and emergent camp use.')
