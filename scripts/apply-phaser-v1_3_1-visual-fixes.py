from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one patch anchor, found {count}")
    return text.replace(old, new, 1)


path = Path('phaser-world-v1.js')
text = path.read_text()
if "visual-fixes-v1" in text:
    print('Screenshot-driven visual fixes are already applied.')
    raise SystemExit(0)

old_offset = "function agentPresentationOffset(a,w=canonical){const mine=canonicalAgentPoint(a,w),near=(w?.agents||[]).some(x=>x.id!==a.id&&dist(mine,canonicalAgentPoint(x,w))<.35);let x=near?(a.id==='agent-mara'?-14:14):0,y=near?(a.id==='agent-mara'?2:-2):0;const camp=(w?.worldModel?.objects||[]).find(o=>o.type==='camp_area'&&o.state?.active!==false);if(a?.position==='camp'&&camp?.position&&dist(mine,camp.position)<3.5){x+=a.id==='agent-mara'?-30:30;y+=a.id==='agent-mara'?16:9}return{x,y}}"
new_offset = "function agentPresentationOffset(a,w=canonical){const mine=canonicalAgentPoint(a,w),near=(w?.agents||[]).some(x=>x.id!==a.id&&dist(mine,canonicalAgentPoint(x,w))<.35);let x=near?(a.id==='agent-mara'?-14:14):0,y=near?(a.id==='agent-mara'?2:-2):0;const camp=(w?.worldModel?.objects||[]).find(o=>o.type==='camp_area'&&o.state?.active!==false);if(a?.position==='camp'&&camp?.position&&dist(mine,camp.position)<3.5){x+=a.id==='agent-mara'?-52:44;y+=a.id==='agent-mara'?18:10}return{x,y}}"
text = replace_once(text, old_offset, new_offset, 'camp clearance')
text = replace_once(
    text,
    "this.tweens.add({targets:[flame,inner],scaleX:1.08,scaleY:.88,y:-2,duration:430,yoyo:true,repeat:-1,ease:'Sine.InOut'});",
    "this.tweens.add({targets:[flame,inner],scaleX:1.08,scaleY:.88,y:'-=2',duration:430,yoyo:true,repeat:-1,ease:'Sine.InOut'});",
    'camp fire relative tween',
)
text = replace_once(
    text,
    "campVisualMode:this.campVisualMode||null,camera:",
    "campVisualMode:this.campVisualMode||null,visualFixes:'visual-fixes-v1',camera:",
    'visual fix marker',
)
path.write_text(text)
print('Applied camp clearance and fixed the fire animation to use relative Y movement.')
