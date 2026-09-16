from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one patch anchor, found {count}")
    return text.replace(old, new, 1)


renderer_path = Path('phaser-world-v1.js')
qa_path = Path('scripts/phaser-qa.mjs')
renderer = renderer_path.read_text()

if "canonical-branch-camp-v1" in renderer:
    print('Canonical camp composition pass is already applied.')
    raise SystemExit(0)

old_offset = "function agentPresentationOffset(a,w=canonical){const mine=canonicalAgentPoint(a,w),near=(w?.agents||[]).some(x=>x.id!==a.id&&dist(mine,canonicalAgentPoint(x,w))<.35);if(!near)return{x:0,y:0};return a.id==='agent-mara'?{x:-14,y:2}:{x:14,y:-2}}"
new_offset = "function agentPresentationOffset(a,w=canonical){const mine=canonicalAgentPoint(a,w),near=(w?.agents||[]).some(x=>x.id!==a.id&&dist(mine,canonicalAgentPoint(x,w))<.35);let x=near?(a.id==='agent-mara'?-14:14):0,y=near?(a.id==='agent-mara'?2:-2):0;const camp=(w?.worldModel?.objects||[]).find(o=>o.type==='camp_area'&&o.state?.active!==false);if(a?.position==='camp'&&camp?.position&&dist(mine,camp.position)<3.5){x+=a.id==='agent-mara'?-30:30;y+=a.id==='agent-mara'?16:9}return{x,y}}"
renderer = replace_once(renderer, old_offset, new_offset, 'camp-aware presentation offset')

old_camp = "  const shelter=(canonical.worldModel?.objects||[]).find(o=>o.type==='branch_shelter'&&o.state?.active);if(shelter){const p=worldToPx(shelter.position);this.add.ellipse(p.x+4,p.y+10,104,34,0x17251b,.18).setDepth(995+p.y);if(this.textures.exists('camp-tent'))this.add.image(p.x,p.y+3,'camp-tent').setOrigin(.5,.82).setDisplaySize(92,92).setTint(0xb98258).setDepth(1000+p.y);else this.add.triangle(p.x,p.y,0,46,40,0,80,46,0x74533b,.95).setDepth(1000+p.y)}const fire=(canonical.worldModel?.objects||[]).find(o=>o.type==='camp_fire'&&o.state?.active);if(fire){const p=worldToPx(fire.position),glow=this.add.circle(p.x,p.y+1,26,0xf4a64f,.085).setDepth(996+p.y);this.tweens.add({targets:glow,scale:1.18,alpha:.035,duration:760,yoyo:true,repeat:-1});const f=this.textures.exists('campfire-art')?this.add.image(p.x,p.y,'campfire-art').setDisplaySize(46,46):this.add.circle(p.x,p.y,8,0xef9540,.92);f.setDepth(1000+p.y+2);this.tweens.add({targets:f,scaleX:1.05,scaleY:.94,angle:.7,duration:460,yoyo:true,repeat:-1});for(let i=0;i<3;i++){const smoke=this.add.circle(p.x+(i-1)*3,p.y-12-i*4,4-i*.7,0xd7ded7,.14).setDepth(1002+p.y);this.tweens.add({targets:smoke,y:smoke.y-36,x:smoke.x+(i-1)*8,alpha:0,scale:1.8,duration:2100+i*420,repeat:-1,delay:i*390})}}"
new_camp = "  this.campVisualMode='canonical-branch-camp-v1';const shelter=(canonical.worldModel?.objects||[]).find(o=>o.type==='branch_shelter'&&o.state?.active);if(shelter){const p=worldToPx(shelter.position),d=1000+p.y;this.add.ellipse(p.x+3,p.y+14,112,33,0x17251b,.2).setDepth(d-5);const g=this.add.graphics().setDepth(d);g.fillStyle(0x765239,.98);g.fillTriangle(p.x-48,p.y+11,p.x+2,p.y-54,p.x+50,p.y+11);g.fillStyle(0x513a2d,.98);g.fillTriangle(p.x-24,p.y+10,p.x+2,p.y-35,p.x+27,p.y+10);g.fillStyle(0x25271f,.88);g.fillTriangle(p.x-13,p.y+10,p.x+2,p.y-20,p.x+17,p.y+10);g.lineStyle(5,0x5b402d,1);g.lineBetween(p.x-50,p.y+12,p.x+2,p.y-56);g.lineBetween(p.x+50,p.y+12,p.x+2,p.y-56);g.lineStyle(2,0xa77a53,.7);g.lineBetween(p.x-33,p.y-8,p.x+31,p.y-7);g.lineBetween(p.x-23,p.y-24,p.x+21,p.y-23)}const fire=(canonical.worldModel?.objects||[]).find(o=>o.type==='camp_fire'&&o.state?.active);if(fire){const p=worldToPx(fire.position),d=1000+p.y+2,glow=this.add.circle(p.x,p.y+2,29,0xf4a64f,.09).setDepth(d-3);this.tweens.add({targets:glow,scale:1.2,alpha:.035,duration:760,yoyo:true,repeat:-1});const logs=this.add.graphics().setDepth(d-1);logs.lineStyle(6,0x5e3b24,1);logs.lineBetween(p.x-14,p.y+8,p.x+13,p.y-3);logs.lineBetween(p.x-13,p.y-3,p.x+14,p.y+8);const flame=this.add.triangle(p.x,p.y-7,0,25,10,0,20,25,0xe97832,.98).setDepth(d);const inner=this.add.ellipse(p.x,p.y,8,16,0xffc65c,.95).setDepth(d+1);this.tweens.add({targets:[flame,inner],scaleX:1.08,scaleY:.88,y:-2,duration:430,yoyo:true,repeat:-1,ease:'Sine.InOut'});for(let i=0;i<3;i++){const smoke=this.add.circle(p.x+(i-1)*3,p.y-21-i*5,4-i*.7,0xd7ded7,.14).setDepth(d+1);this.tweens.add({targets:smoke,y:smoke.y-36,x:smoke.x+(i-1)*8,alpha:0,scale:1.8,duration:2100+i*420,repeat:-1,delay:i*390})}}"
renderer = replace_once(renderer, old_camp, new_camp, 'canonical camp visuals')

renderer = renderer.replace("e.getData('label').setPosition(from.x,from.y-58)", "e.getData('label').setPosition(from.x,from.y-64)")
renderer = replace_once(
    renderer,
    "agentArtModes:[...this.entities.values()].filter(x=>x.getData?.('kind')==='agent').map(x=>x.getData?.('artMode')||'unknown'),camera:",
    "agentArtModes:[...this.entities.values()].filter(x=>x.getData?.('kind')==='agent').map(x=>x.getData?.('artMode')||'unknown'),campVisualMode:this.campVisualMode||null,camera:",
    'camp mode debug snapshot',
)
renderer_path.write_text(renderer)

qa = qa_path.read_text()
needle = "if((s.agentArtModes||[]).length!==2||(s.agentArtModes||[]).some(x=>x!=='tiny-farm'))failures.push(`Tiny Farm agent art failed to load: ${JSON.stringify(s.agentArtModes)}`);"
replacement = needle + "if(s.campVisualMode!=='canonical-branch-camp-v1')failures.push(`canonical camp visual mode missing: ${s.campVisualMode}`);"
qa = replace_once(qa, needle, replacement, 'camp visual QA assertion')
qa_path.write_text(qa)

print('Applied canonical branch-shelter/fire composition and camp-safe presentation offsets.')
