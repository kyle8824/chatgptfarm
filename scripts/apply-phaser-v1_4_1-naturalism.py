from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one patch anchor, found {count}")
    return text.replace(old, new, 1)


renderer_path = Path('phaser-world-v1.js')
qa_path = Path('scripts/phaser-qa.mjs')
ecology_path = Path('engine/ecology.js')
html_path = Path('phaser.html')
css_path = Path('phaser-world.css')

renderer = renderer_path.read_text()
if "naturalism-v1" not in renderer:
    renderer = replace_once(
        renderer,
        "make('animal-deer',(g,w,h)=>{g.fillStyle(0x1b251d,.15).fillEllipse(36,71,44,10);g.fillStyle(0xa06f43,1).fillEllipse(35,48,38,22);g.fillRoundedRect(50,30,8,27,4);g.fillCircle(57,27,9);g.fillStyle(0x7c5232,1).fillTriangle(52,20,55,10,59,21).fillTriangle(60,20,66,12,65,24);g.lineStyle(4,0x71472d,1).lineBetween(25,57,22,74).lineBetween(43,57,45,74)},76,80);",
        "make('animal-deer',(g,w,h)=>{g.fillStyle(0x1b251d,.13).fillEllipse(36,72,42,9);g.fillStyle(0x806044,1).fillEllipse(34,49,37,20);g.fillRoundedRect(49,31,7,25,4);g.fillCircle(56,28,8);g.fillStyle(0x5b4433,1).fillTriangle(51,22,54,13,58,22).fillTriangle(59,22,64,15,64,24);g.lineStyle(3,0x5f4735,1).lineBetween(25,57,23,74).lineBetween(42,57,44,74);g.fillStyle(0xe7dfcf,.8).fillEllipse(18,48,6,5)},76,80);",
        'natural deer silhouette',
    )
    renderer = replace_once(
        renderer,
        "make('animal-rabbit-fallback',(g)=>{g.fillStyle(0x8b8175,1).fillEllipse(34,49,28,21).fillCircle(49,39,12);g.fillEllipse(47,23,7,20).fillEllipse(55,24,7,19);g.fillStyle(0xefe9df,1).fillCircle(19,47,7)},68,70);",
        "make('animal-rabbit-fallback',(g)=>{g.fillStyle(0x776f64,1).fillEllipse(33,50,29,18).fillCircle(48,42,10);g.fillEllipse(46,28,5,19).fillEllipse(53,29,5,18);g.fillStyle(0xeee9df,1).fillCircle(18,49,6);g.fillStyle(0x171a17,1).fillCircle(51,40,1.8)},68,70);",
        'natural rabbit silhouette',
    )
    renderer = replace_once(
        renderer,
        "make('animal-bear-fallback',(g)=>{g.fillStyle(0x352c28,1).fillEllipse(36,48,43,28).fillCircle(55,42,15);g.fillCircle(49,29,7).fillCircle(61,30,7)},76,72);",
        "make('animal-bear-fallback',(g)=>{g.fillStyle(0x312a27,1).fillEllipse(34,49,45,26).fillCircle(55,43,14);g.fillCircle(49,31,6).fillCircle(61,32,6);g.fillRoundedRect(20,55,7,13,3).fillRoundedRect(44,56,7,13,3);g.fillStyle(0x806b5b,1).fillEllipse(61,47,12,8);g.fillStyle(0x121512,1).fillCircle(65,44,2.2)},78,72);",
        'natural bear silhouette',
    )
    old_tree = "const img=this.add.image(p.x,p.y,key).setOrigin(.5,1),targetH=78+R()*36;img.setDisplaySize(Math.max(42,targetH*(img.width/Math.max(1,img.height))),targetH);img.setDepth(1000+p.y);"
    new_tree = "const img=this.add.image(p.x,p.y,key).setOrigin(.5,1),targetH=78+R()*36,tints=[0x83936f,0x718364,0x62785a,0x7c8b69,0x596f53,0x6d805f];img.setDisplaySize(Math.max(42,targetH*(img.width/Math.max(1,img.height))),targetH);img.setTint(tints[i%tints.length]).setAlpha(.96);img.setDepth(1000+p.y);"
    renderer = replace_once(renderer, old_tree, new_tree, 'muted forest palette')
    old_traces = "const traces=(canonical?.ecologySystem?.traces||[]).filter(t=>t.active&&(t.clarity??0)>.2);for(const t of traces){const p=worldToPx(t.position),heading=-(t.heading||0),size=clamp(t.size||1,.45,1.6),alpha=clamp((t.clarity??.7)*.62,.16,.58),g=this.add.graphics().setDepth(720+p.y*.02);g.setAlpha(alpha);const c=t.species==='bear'?0x3b3229:t.species==='rabbit'?0x665d51:0x55483b;"
    new_traces = "const traces=(canonical?.ecologySystem?.traces||[]).filter(t=>t.active&&(t.clarity??0)>.38&&(t.ageHours??0)<=14&&(t.species!=='rabbit'||(t.clarity??0)>.55));for(const t of traces){const p=worldToPx(t.position),heading=-(t.heading||0),size=clamp(t.size||1,.45,1.6),alpha=clamp((t.clarity??.7)*.46,.12,.42),g=this.add.graphics().setDepth(720+p.y*.02);g.setAlpha(alpha);const c=t.substrate==='mud'?0x493d31:t.species==='bear'?0x40372f:t.species==='rabbit'?0x6a6258:0x5b5044;"
    renderer = replace_once(renderer, old_traces, new_traces, 'subtle canonical tracks')
    old_wildlife = "const p=worldToPx(a.position),key=a.species==='bear'?(this.textures.exists('animal-bear')?'animal-bear':'animal-bear-fallback'):a.species==='rabbit'?(this.textures.exists('animal-rabbit')?'animal-rabbit':'animal-rabbit-fallback'):a.species==='fish'?(this.textures.exists('animal-fish')?'animal-fish':'animal-fish'):'animal-deer';"
    new_wildlife = "const p=worldToPx(a.position),key=a.species==='bear'?'animal-bear-fallback':a.species==='rabbit'?'animal-rabbit-fallback':a.species==='fish'?(this.textures.exists('animal-fish')?'animal-fish':'animal-fish'):'animal-deer';"
    renderer = replace_once(renderer, old_wildlife, new_wildlife, 'remove icon-like wildlife art')
    renderer = replace_once(
        renderer,
        "const h=a.species==='bear'?48:a.species==='deer'?42:24;e.setDisplaySize(Math.max(24,h*(e.width/Math.max(e.height,1))),h);e.setDepth(1000+p.y+2)",
        "const h=a.species==='bear'?46:a.species==='deer'?39:18;e.setDisplaySize(Math.max(a.species==='rabbit'?16:24,h*(e.width/Math.max(e.height,1))),h);e.setDepth(1000+p.y+2)",
        'wildlife scale',
    )
    renderer = replace_once(
        renderer,
        "const from=worldToPx(a.movement?.from||a.previousPosition||a.position),to=worldToPx(a.movement?.to||a.position);",
        "e.setAlpha(['hide','freeze'].includes(a.activity)?.72:.96);e.setData('behavior',a.behavior||null);const from=worldToPx(a.movement?.from||a.previousPosition||a.position),to=worldToPx(a.movement?.to||a.position);",
        'behavior-aware wildlife presentation',
    )
    renderer = replace_once(renderer, "visualFixes:'visual-fixes-v1',livingWorld:", "visualFixes:'visual-fixes-v1',naturalism:'naturalism-v1',livingWorld:", 'naturalism marker')
    renderer = renderer.replace(".filter(t=>t.active&&(t.clarity??0)>.2).length", ".filter(t=>t.active&&(t.clarity??0)>.38&&(t.ageHours??0)<=14&&(t.species!=='rabbit'||(t.clarity??0)>.55)).length")
    renderer_path.write_text(renderer)
else:
    print('Renderer naturalism pass already applied.')

ecology = ecology_path.read_text()
old_choose = "function chooseHabitat(w,a){const choices=habitat[a.species]||[a.home||point(50,40)],period=Math.floor(worldStamp(w)/6),i=hash(`${a.id}:${period}:habitat`)%choices.length;return choices[i]}"
new_choose = "function chooseHabitat(w,a){const all=habitat[a.species]||[a.home||point(50,40)],home=a.home||a.position;let choices=all;if(a.species==='rabbit')choices=[...all].sort((x,y)=>dist(x,home)-dist(y,home)).slice(0,2);else if(a.species==='deer')choices=[...all].sort((x,y)=>dist(x,home)-dist(y,home)).slice(0,4);const period=Math.floor(worldStamp(w)/6),i=hash(`${a.id}:${period}:habitat`)%choices.length;return choices[i]}"
if old_choose in ecology:
    ecology = replace_once(ecology, old_choose, new_choose, 'species home-range habitat')
elif new_choose not in ecology:
    raise SystemExit('species home-range habitat: anchor not found')
ecology_path.write_text(ecology)

qa = qa_path.read_text()
old_expected = "const expectedTracks=(state.ecologySystem?.traces||[]).filter(t=>t.active&&(t.clarity??0)>.2).length;"
new_expected = "const expectedTracks=(state.ecologySystem?.traces||[]).filter(t=>t.active&&(t.clarity??0)>.38&&(t.ageHours??0)<=14&&(t.species!=='rabbit'||(t.clarity??0)>.55)).length;"
if old_expected in qa:
    qa = replace_once(qa, old_expected, new_expected, 'QA trace visibility')
qa_path.write_text(qa)

html = html_path.read_text().replace('phaser-world.css?v=0014','phaser-world.css?v=00141').replace('phaser-world-v1.js?v=0014','phaser-world-v1.js?v=00141')
html_path.write_text(html)

css = css_path.read_text()
if '/* naturalism-v1 */' not in css:
    css += "\n/* naturalism-v1 */\n@media(max-width:620px){.phFocus{bottom:max(58px,calc(env(safe-area-inset-bottom) + 58px));min-height:54px;padding:8px 12px}.phFocus strong{font-size:13px;margin-top:3px}.phPulse{height:40px;padding:6px 11px;border-radius:13px}.phPulse b{font-size:9px}.phPulse span{font-size:10px}.phTop{height:60px}.phCamera,.phZoom{top:max(84px,calc(env(safe-area-inset-top) + 84px))}}\n"
css_path.write_text(css)

print('Applied v1.4.1 naturalism: muted habitat, subtle sign, natural silhouettes, tighter home ranges, and leaner mobile HUD.')
