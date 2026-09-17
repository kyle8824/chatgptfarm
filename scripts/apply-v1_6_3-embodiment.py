from pathlib import Path


def replace_once(text, old, new, label):
    count=text.count(old)
    if count!=1:
        raise SystemExit(f'{label}: expected exactly one anchor, found {count}')
    return text.replace(old,new,1)

render_path=Path('phaser-world-v1.js')
qa_path=Path('scripts/phaser-qa.mjs')
html_path=Path('phaser.html')
render=render_path.read_text()

if "phaser-v1.6.3-embodiment" not in render:
    # Re-render canonical branch shelter as a readable, open-sided lean-to.
    old_shelter="""this.campVisualMode='canonical-lean-to-v2';const shelter=(canonical.worldModel?.objects||[]).find(o=>o.type==='branch_shelter'&&o.state?.active);if(shelter){const p=worldToPx(shelter.position),d=1000+p.y,R=seeded('branch-shelter-lean-to-v2');this.add.ellipse(p.x+3,p.y+15,126,34,0x17251b,.22).setDepth(d-5);const g=this.add.graphics().setDepth(d);g.fillStyle(0x61513a,.96);g.beginPath();g.moveTo(p.x-52,p.y+10);g.lineTo(p.x-27,p.y-42);g.lineTo(p.x+19,p.y-34);g.lineTo(p.x+52,p.y+11);g.closePath();g.fillPath();g.fillStyle(0x394631,.52);for(let i=0;i<7;i++){const x=p.x-40+i*13+R()*5,y=p.y-4-i%2*4;g.fillEllipse(x,y,19+R()*14,8+R()*7)}g.lineStyle(5,0x503a29,1);g.lineBetween(p.x-52,p.y+12,p.x-27,p.y-43);g.lineBetween(p.x+51,p.y+12,p.x+19,p.y-35);g.lineBetween(p.x-28,p.y-42,p.x+20,p.y-34);g.lineStyle(2.2,0x8a6848,.78);for(let i=0;i<6;i++){const t=i/5,x1=p.x-48+t*91,y1=p.y+6-t*42,x2=x1+25,y2=y1+7;g.lineBetween(x1,y1,x2,y2)}g.fillStyle(0x25271f,.78);g.fillEllipse(p.x+24,p.y+7,32,13)}"""
    new_shelter="""this.campVisualMode='canonical-lean-to-v3';const shelter=(canonical.worldModel?.objects||[]).find(o=>o.type==='branch_shelter'&&o.state?.active);if(shelter){const p=worldToPx(shelter.position),d=1000+p.y,R=seeded('branch-shelter-lean-to-v3');this.add.ellipse(p.x+3,p.y+17,134,38,0x17251b,.23).setDepth(d-5);const g=this.add.graphics().setDepth(d);g.fillStyle(0x25261f,.82);g.fillRoundedRect(p.x-34,p.y-24,72,36,7);g.fillStyle(0x5f5039,.98);g.beginPath();g.moveTo(p.x-52,p.y-34);g.lineTo(p.x+38,p.y-30);g.lineTo(p.x+55,p.y-7);g.lineTo(p.x-37,p.y-10);g.closePath();g.fillPath();g.fillStyle(0x43513a,.62);for(let i=0;i<9;i++){const x=p.x-39+i*10.5+R()*5,y=p.y-24+(i%3)*5+R()*3;g.fillEllipse(x,y,20+R()*15,7+R()*6)}g.lineStyle(5,0x4d3828,1);g.lineBetween(p.x-38,p.y+14,p.x-38,p.y-34);g.lineBetween(p.x+42,p.y+14,p.x+40,p.y-30);g.lineBetween(p.x-52,p.y-34,p.x+40,p.y-30);g.lineStyle(2.2,0x8e6b49,.8);for(let i=0;i<7;i++){const t=i/6,x1=p.x-46+t*84,y1=p.y-31+t*2,x2=x1+17,y2=p.y-9+t*1.3;g.lineBetween(x1,y1,x2,y2)}g.fillStyle(0x1f211d,.72);g.fillEllipse(p.x+9,p.y+8,48,13)}"""
    render=replace_once(render,old_shelter,new_shelter,'shelter embodiment')

    # People: gait animation only when their canonical playback is actually moving.
    old_agent_tail="""const fallback=canonicalAgentPoint(a),to=worldToPx(a.activeAction?.to||fallback),from=worldToPx(a.activeAction?.from||fallback),off=agentPresentationOffset(a);to.x+=off.x;to.y+=off.y;from.x+=off.x;from.y+=off.y;if(initial&&dist(pxToWorld(from),pxToWorld(to))>.35){e.setPosition(from.x,from.y);e.getData('label').setPosition(from.x,from.y-59);this.moveEntity(e,to,6500)}else this.moveEntity(e,to,initial?0:MOVE_MS*.72)}"""
    new_agent_tail="""const fallback=canonicalAgentPoint(a),to=worldToPx(a.activeAction?.to||fallback),from=worldToPx(a.activeAction?.from||fallback),off=agentPresentationOffset(a);to.x+=off.x;to.y+=off.y;from.x+=off.x;from.y+=off.y;const moveD=dist(pxToWorld(from),pxToWorld(to)),duration=initial&&moveD>.35?6500:(initial?0:MOVE_MS*.72),moving=duration>0&&moveD>.35,baseSY=e.getData('baseScaleY')||e.scaleY;if(!e.getData('baseScaleY'))e.setData('baseScaleY',baseSY);e.scaleY=baseSY;e.setAngle(0);if(initial&&moving){e.setPosition(from.x,from.y);e.getData('label').setPosition(from.x,from.y-59)}this.moveEntity(e,to,duration);e.setData('motionMode',moving?'walking':'still');if(moving)this.tweens.add({targets:e,angle:{from:-1.15,to:1.15},scaleY:baseSY*.96,duration:260,yoyo:true,repeat:Math.max(2,Math.floor(duration/520)-1),ease:'Sine.InOut'})}"""
    render=replace_once(render,old_agent_tail,new_agent_tail,'agent gait')

    # Wildlife: quadruped body sway only during real locomotion; rabbit retains its hop.
    old_wild_tail="""const wf=a.movement?.from||a.previousPosition||a.position,wt=a.movement?.to||a.position,moveD=dist(wf,wt),from=worldToPx(wf),to=worldToPx(wt),moving=moveD>.16&&!['rest','hide','freeze','drink'].includes(a.activity);let duration=moving?(a.species==='rabbit'?3400:a.species==='fish'?8500:a.species==='bear'?9000:6800):0;if(initial&&moving){e.setPosition(from.x,from.y);this.moveEntity(e,to,duration)}else this.moveEntity(e,to,duration);if(a.species==='rabbit'&&moving){const sy=e.scaleY;this.tweens.add({targets:e,scaleY:sy*.84,duration:170,yoyo:true,repeat:Math.max(1,Math.floor(duration/340)-1),ease:'Sine.InOut'})}}"""
    new_wild_tail="""const wf=a.movement?.from||a.previousPosition||a.position,wt=a.movement?.to||a.position,moveD=dist(wf,wt),from=worldToPx(wf),to=worldToPx(wt),moving=moveD>.16&&!['rest','hide','freeze','drink'].includes(a.activity);let duration=moving?(a.species==='rabbit'?3400:a.species==='fish'?8500:a.species==='bear'?9000:6800):0;if(a.species!=='fish'){const baseSY=e.getData('baseScaleY')||e.scaleY;if(!e.getData('baseScaleY'))e.setData('baseScaleY',baseSY);e.scaleY=baseSY;e.setAngle(0)}if(initial&&moving){e.setPosition(from.x,from.y);this.moveEntity(e,to,duration)}else this.moveEntity(e,to,duration);e.setData('motionMode',moving?'moving':(a.activity||'still'));if(a.species==='rabbit'&&moving){const sy=e.getData('baseScaleY')||e.scaleY;this.tweens.add({targets:e,scaleY:sy*.84,duration:170,yoyo:true,repeat:Math.max(1,Math.floor(duration/340)-1),ease:'Sine.InOut'})}else if(moving&&(a.species==='deer'||a.species==='bear')){const sy=e.getData('baseScaleY')||e.scaleY;this.tweens.add({targets:e,angle:{from:-.7,to:.7},scaleY:sy*.975,duration:a.species==='bear'?520:390,yoyo:true,repeat:Math.max(1,Math.floor(duration/(a.species==='bear'?1040:780))-1),ease:'Sine.InOut'})}}"""
    render=replace_once(render,old_wild_tail,new_wild_tail,'wildlife locomotion')

    render=render.replace("version:'phaser-v1.6.2-world-depth'","version:'phaser-v1.6.3-embodiment'")
    render=render.replace("embodiment:'embodiment-v1'","embodiment:'embodiment-v2'")
    snap_anchor="agentArtModes:[...this.entities.values()].filter(x=>x.getData?.('kind')==='agent').map(x=>x.getData?.('artMode')||'unknown'),campVisualMode:"
    snap_new="agentArtModes:[...this.entities.values()].filter(x=>x.getData?.('kind')==='agent').map(x=>x.getData?.('artMode')||'unknown'),embodimentState:{agents:[...this.entities.values()].filter(x=>x.getData?.('kind')==='agent').map(x=>({id:x.getData?.('id'),mode:x.getData?.('motionMode')||'unknown'})),wildlifeMoving:[...this.entities.values()].filter(x=>x.getData?.('kind')==='wildlife'&&x.getData?.('motionMode')==='moving').length},campVisualMode:"
    render=replace_once(render,snap_anchor,snap_new,'embodiment snapshot')
    render_path.write_text(render)

qa=qa_path.read_text().replace("s.version!=='phaser-v1.6.2-world-depth'","s.version!=='phaser-v1.6.3-embodiment'")
qa=qa.replace("s.campVisualMode!=='canonical-lean-to-v2'","s.campVisualMode!=='canonical-lean-to-v3'")
if 'agent embodiment state missing' not in qa:
    anchor="if((s.agentArtModes||[]).length!==2||(s.agentArtModes||[]).some(x=>x!=='natural-procedural'))failures.push(`natural agent embodiment failed: ${JSON.stringify(s.agentArtModes)}`);"
    extra=anchor+"if(s.embodiment!=='embodiment-v2'||(s.embodimentState?.agents||[]).length!==2||(s.embodimentState?.agents||[]).some(x=>!['walking','still'].includes(x.mode)))failures.push(`agent embodiment state missing: ${JSON.stringify(s.embodimentState)}`);"
    qa=replace_once(qa,anchor,extra,'embodiment QA')
qa_path.write_text(qa)

html=html_path.read_text().replace('v=001600003','v=001600004')
html_path.write_text(html)
print('Applied v1.6.3 movement embodiment and shelter readability pass.')
