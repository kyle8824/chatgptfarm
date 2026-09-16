(()=>{
'use strict';
const PLACE={camp:'camp',creek:'creek',berries:'berry patch',log:'fallen oak',meadow:'meadow',edge:'frontier',forest:'forest',stones:'stone field',clay:'clay bank',reeds:'reed marsh'};
function descriptor(a){
  const plan=a?.activeAction||{}, stored=plan.interaction||{}, pp=plan.physicalProposal||{};
  const ids=`${stored.primaryAffordanceId||''} ${stored.secondaryAffordanceId||''} ${stored.worldObjectId||''} ${pp.primaryObjectId||''} ${pp.secondaryObjectId||''}`.toLowerCase();
  const text=`${plan.actionId||''} ${plan.label||''} ${a?.currentAction||''} ${a?.mind?.intent||''} ${stored.material||''} ${stored.verb||''} ${pp.verb||''} ${ids}`.toLowerCase();
  let kind=null,label='';
  if(/reed|cordage|twist/.test(text)){kind='reeds';label=/cordage|twist|bind/.test(text)?'working reeds':'reeds'}
  else if(/clay|vessel|mold|shape/.test(text)){kind='clay';label=/vessel|shape|mold/.test(text)?'shaping clay':'clay'}
  else if(/stone|sharp|strike|rock/.test(text)){kind='stone';label=/sharp|strike/.test(text)?'working stone':'stone'}
  else if(/water|drink|creek/.test(text)){kind='water';label='water'}
  else if(/berry|berries/.test(text)){kind='berries';label='berries'}
  else if(/track|trail|follow/.test(text)){kind='tracks';label='tracks'}
  else if(/fire|heat/.test(text)){kind='fire';label='fire'}
  else if(/wood|branch|pole|shelter|cut/.test(text)){kind='wood';label=/pole|cut|shape/.test(text)?'working wood':'wood'}
  const verb=stored.verb||pp.verb||plan.actionId||'';
  return kind?{kind,label,verb,ids}:null;
}
function placeLabel(p){return PLACE[p]||p||'world'}
function redraw(prop,a,s,t,C,PIXI){
  const d=descriptor(a), key=d?`${d.kind}:${d.verb}:${s.phase}`:'none';
  if(prop._key!==key){
    prop.removeChildren().forEach(x=>x.destroy({children:true})); prop._key=key;
    if(d){
      const g=new PIXI.Graphics();
      if(d.kind==='reeds'){
        for(let i=-3;i<=3;i++){g.lineStyle(2.2,C.reed,.98).moveTo(i*3,11).lineTo(i*2,-15-Math.abs(i)*2);if(i%2===0)g.beginFill(0x89633c,.95).drawEllipse(i*2,-16-Math.abs(i)*2,2.2,5.5).endFill()}
        if(/twist|bind/.test(String(d.verb)))g.lineStyle(2.5,0xc3aa70,.95).drawCircle(14,3,8);
      } else if(d.kind==='clay'){
        g.beginFill(C.clay,.98).drawEllipse(0,4,12,8).endFill(); if(/shape|mold/.test(String(d.verb)))g.lineStyle(2,0xe4b28f,.92).drawEllipse(0,0,8,11);
      } else if(d.kind==='stone'){
        g.beginFill(C.rock,.98).drawPolygon([-10,7,-3,-9,8,5]).endFill(); if(/strike|sharp/.test(String(d.verb)))g.beginFill(0xd4ddd7,.9).drawPolygon([8,3,18,-5,13,9]).endFill();
      } else if(d.kind==='wood'){
        g.lineStyle(6,C.wood,.98).moveTo(-14,8).lineTo(16,-6); if(/cut|shape/.test(String(d.verb)))g.lineStyle(3,0xbac3bb,.96).moveTo(5,-10).lineTo(13,-1);
      } else if(d.kind==='water'){
        g.beginFill(C.water,.95).drawCircle(0,4,8).endFill(); g.beginFill(0xdaf3f6,.55).drawCircle(-3,1,3).endFill();
      } else if(d.kind==='berries'){
        g.beginFill(C.leaf,.95).drawCircle(0,3,9).endFill(); g.beginFill(C.berry,.98).drawCircle(-4,0,3).drawCircle(3,4,3).drawCircle(2,-3,3).endFill();
      } else if(d.kind==='tracks'){
        for(let i=-1;i<=1;i++)g.beginFill(0x30251c,.75).drawEllipse(i*8,4+i*2,3,5).endFill();
      } else if(d.kind==='fire'){
        g.beginFill(C.fire,.95).drawPolygon([-8,9,0,-12,8,9]).endFill();g.beginFill(C.fire2,.9).drawPolygon([-4,7,0,-5,4,7]).endFill();
      }
      prop.addChild(g);
    }
  }
  prop.visible=!!d&&(s.phase==='interact'||s.phase==='resolve');
  if(prop.visible){prop.rotation=Math.sin(t*5)*.05;prop.y=3+Math.sin(t*6)*1.2;prop.alpha=s.phase==='resolve'?.82:1}
}
window.ChatGPTFarmActionVisuals={descriptor,placeLabel,redraw};
})();
