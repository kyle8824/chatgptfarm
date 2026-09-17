from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count=text.count(old)
    if count!=1:
        raise SystemExit(f"{label}: expected exactly one patch anchor, found {count}")
    return text.replace(old,new,1)

renderer_path=Path('phaser-world-v1.js')
qa_path=Path('scripts/phaser-qa.mjs')
html_path=Path('phaser.html')
renderer=renderer_path.read_text()

if "quiet-world-v1" not in renderer:
    renderer=replace_once(renderer,
        "this.lightOverlay=null;this.grid=null;",
        "this.lightOverlay=null;this.nightLights=[];this.grid=null;",
        'night light scene state')
    renderer=renderer.replace("const alpha=nearForest ? .28 : .18;","const alpha=nearForest ? .34 : .24;")
    old_light=" renderLightCycle(refresh=false){if(refresh&&this.lightOverlay){this.lightOverlay.destroy();this.lightOverlay=null}const h=canonical?.hour??12,wet=canonical?.weather==='rain';let color=0x0c1620,alpha=0;if(h<5||h>=22)alpha=.34;else if(h<7){color=0x5d4939;alpha=.14}else if(h>=19&&h<22){color=0x5c4437;alpha=.17}else if(wet)alpha=.065;if(alpha>0)this.lightOverlay=this.add.rectangle(WORLD/2,WORLD/2,WORLD,WORLD,color,alpha).setDepth(8800);this.lightCycle={hour:h,alpha:+alpha.toFixed(3),weather:canonical?.weather||null}}"
    new_light=r''' renderLightCycle(refresh=false){
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
   const outer=this.add.circle(p.x,p.y,100,0xf6a94d,tone==='night'?.055:.035).setDepth(8801).setBlendMode(Phaser.BlendModes.ADD);
   const inner=this.add.circle(p.x,p.y,52,0xffbd66,tone==='night'?.10:.065).setDepth(8802).setBlendMode(Phaser.BlendModes.ADD);
   this.nightLights.push(outer,inner);
   this.tweens.add({targets:[outer,inner],scale:1.08,alpha:'-=0.018',duration:900,yoyo:true,repeat:-1,ease:'Sine.InOut'});
  }
  this.lightCycle={hour:h,alpha:+alpha.toFixed(3),tone,weather:canonical?.weather||null,fireGlow:this.nightLights?.length||0};
 }'''.replace("tone==='night'?.055:.035","tone==='night' ? .055 : .035").replace("tone==='night'?.10:.065","tone==='night' ? .10 : .065")
    renderer=replace_once(renderer,old_light,new_light,'richer canonical light cycle')
    old_hud=" updateHud(){const s=$('#phWorldStatus'),v=String(canonical.worldModel?.version||'?').replace('object-field-','');s.innerHTML=`<b>● OBJECT WORLD · ${v}</b><span>Day ${canonical.day} · ${String(canonical.hour).padStart(2,'0')}:00 · ${Math.round(canonical.temperature)}°F · ${canonical.weather}</span>`;const a=focusAgent(),ph=currentPhase(a),place=String(a?.position||'world').replaceAll('_',' ').toUpperCase();$('#phFocus').innerHTML=`<small>${ph.label} · ${place}</small><strong>${a?.name||'World'} — ${a?.mind?.currentGoal||a?.currentAction||'Observing the basin.'}</strong>`;const wildlife=(canonical.ecologySystem?.wildlife||[]).filter(x=>x.active),ambient=canonical.ecologySystem?.ambient||{},events=canonical.ecologySystem?.events||[];$('#phLifeCount').textContent=`${wildlife.length} animals` ;$('#phPulseText').textContent=events[0]?.title||`${ambient.birds||0} bird activity · ${ambient.frogs||0} frog activity`}"
    new_hud=r''' updateHud(){
  const s=$('#phWorldStatus'),v=String(canonical.worldModel?.version||'?').replace('object-field-','');
  s.innerHTML=`<b>● OBJECT WORLD · ${v}</b><span>Day ${canonical.day} · ${String(canonical.hour).padStart(2,'0')}:00 · ${Math.round(canonical.temperature)}°F · ${canonical.weather}</span>`;
  const a=focusAgent(),ph=currentPhase(a),place=String(a?.position||'world').replaceAll('_',' ').toUpperCase();
  $('#phFocus').innerHTML=`<small>${ph.label} · ${place}</small><strong>${a?.name||'World'} — ${a?.mind?.currentGoal||a?.currentAction||'Observing the basin.'}</strong>`;
  const wildlife=(canonical.ecologySystem?.wildlife||[]).filter(x=>x.active),ambient=canonical.ecologySystem?.ambient||{},events=canonical.ecologySystem?.events||[];
  const currentEvent=events.find(e=>e.day===canonical.day&&e.hour===canonical.hour&&(e.importance??0)>=5);
  const h=canonical.hour;
  let pulse='';
  if(currentEvent){pulse=currentEvent.title;this.pulseMode='current-event'}
  else if(canonical.weather==='rain'){pulse=`Rain across the basin · ${ambient.frogs||0} frog activity`;this.pulseMode='ambient-rain'}
  else if(h<5||h>=22){pulse=`Quiet night · ${ambient.frogs||0} frog activity · ${ambient.insects||0} insect activity`;this.pulseMode='ambient-night'}
  else if((h>=5&&h<=8)||(h>=18&&h<=21)){pulse=`Twilight activity · ${ambient.birds||0} birds · ${ambient.frogs||0} frogs`;this.pulseMode='ambient-twilight'}
  else{pulse=`Basin quiet · ${ambient.birds||0} bird activity`;this.pulseMode='ambient-day'}
  $('#phLifeCount').textContent=`${wildlife.length} animals`;
  $('#phPulseText').textContent=pulse;
 }'''
    renderer=replace_once(renderer,old_hud,new_hud,'time-aware world pulse')
    renderer=replace_once(renderer,
        "habitatDepth:'habitat-depth-v1',habitatDetail:this.habitatDetail||null,lightCycle:",
        "habitatDepth:'habitat-depth-v1',quietWorld:'quiet-world-v1',pulseMode:this.pulseMode||null,habitatDetail:this.habitatDetail||null,lightCycle:",
        'quiet world snapshot')
    renderer_path.write_text(renderer)
else:
    print('Quiet-world pass already applied.')

qa=qa_path.read_text()
if "mobile-wildlife-habitat.png" not in qa:
    auto_anchor="await page.getByRole('button',{name:'AUTO',exact:true}).click();await page.waitForTimeout(350);"
    addition=auto_anchor+"\nconst habitatDeer=state.ecologySystem?.wildlife?.find(x=>x.active&&x.species==='deer');if(habitatDeer){await page.evaluate(({x,y})=>window.ChatGPTFarmPhaserDebug.focusWorldUnit(x,y,.95),habitatDeer.position);await page.waitForTimeout(250);await page.screenshot({path:'phaser-qa/mobile-wildlife-habitat.png'});}"
    qa=replace_once(qa,auto_anchor,addition,'canonical wildlife habitat screenshot')
    qa=qa.replace("await page.screenshot({path:'phaser-qa/mobile-wildlife.png'});","await page.screenshot({path:'phaser-qa/mobile-movement-proof.png'});")
qa=qa.replace("light.lightCycle?.alpha<.1","light.lightCycle?.alpha<.2")
qa=qa.replace("light.lightCycle?.alpha<.25","light.lightCycle?.alpha<.4")
qa_path.write_text(qa)

html=html_path.read_text().replace('phaser-world.css?v=00143','phaser-world.css?v=00144').replace('phaser-world-v1.js?v=00143','phaser-world-v1.js?v=00144')
html_path.write_text(html)
print('Applied v1.4.4 quiet-world pulse, stronger canonical lighting, fire glow, and habitat-truth screenshot QA.')
