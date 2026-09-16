(()=>{
'use strict';
const PLACE={camp:'camp',creek:'creek',berries:'berry patch',log:'fallen oak',meadow:'meadow',edge:'frontier',forest:'forest',stones:'stone field',clay:'clay bank',reeds:'reed marsh'};
const WORLD_OBJECT_KIND={
  'OBJ-CREEK-001':'water','OBJ-BERRIES-001':'berries','OBJ-TREE-001':'wood',
  'OBJ-STONES-001':'stone','OBJ-CLAY-001':'clay','OBJ-REEDS-001':'reeds',
  'OBJ-FIRE-001':'fire','OBJ-SHELTER-001':'wood'
};
function descriptor(a){
  const plan=a?.activeAction||{},stored=plan.interaction||{},pp=plan.physicalProposal||{};
  const explicit=`${stored.material||''} ${stored.primaryAffordanceId||''} ${pp.primaryObjectId||''} ${pp.secondaryObjectId||''}`.toLowerCase();
  const task=`${plan.actionId||''} ${plan.label||''} ${stored.verb||''} ${pp.verb||''} ${a?.currentAction||''}`.toLowerCase();
  const fallback=`${a?.mind?.intent||''}`.toLowerCase();
  const objectKind=WORLD_OBJECT_KIND[stored.worldObjectId]||null;
  let kind=objectKind,label='';
  const choose=text=>{
    if(/clay|vessel|mold|shape/.test(text))return['clay',/vessel|shape|mold/.test(text)?'shaping clay':'clay'];
    if(/reed|cordage|twist|bind/.test(text))return['reeds',/cordage|twist|bind/.test(text)?'working reeds':'reeds'];
    if(/stone|sharp|strike|rock/.test(text))return['stone',/sharp|strike/.test(text)?'working stone':'stone'];
    if(/water|drink|creek/.test(text))return['water','drinking'];
    if(/berry|berries/.test(text))return['berries','berries'];
    if(/track|trail|follow/.test(text))return['tracks','tracks'];
    if(/fire|heat/.test(text))return['fire','fire'];
    if(/wood|branch|pole|shelter|cut/.test(text))return['wood',/pole|cut|shape/.test(text)?'working wood':'wood'];
    return null;
  };
  const picked=choose(explicit)||choose(task)||(!kind&&choose(fallback));
  if(picked){kind=picked[0];label=picked[1]}
  if(kind&&!label){label={clay:'clay',reeds:'reeds',stone:'stone',water:'water',berries:'berries',tracks:'tracks',fire:'fire',wood:'wood'}[kind]||kind}
  const verb=stored.verb||pp.verb||plan.actionId||'';
  return kind?{kind,label,verb}:null;
}
function placeLabel(p){return PLACE[p]||p||'world'}
function redraw(prop,a,s,t,C,PIXI){
  const d=descriptor(a),key=d?`${d.kind}:${d.verb}:${s.phase}`:'none';
  if(prop._key!==key){
    prop.removeChildren().forEach(x=>x.destroy({children:true}));prop._key=key;
    if(d){
      const g=new PIXI.Graphics();
      if(d.kind==='reeds'){
        for(let i=-2;i<=2;i++){const h=13+Math.abs(i)*1.5;g.lineStyle(1.8,C.reed,.98).moveTo(i*3,8).lineTo(i*2,-h);if(i===-2||i===2)g.beginFill(0x89633c,.9).drawEllipse(i*2,-h,1.6,4).endFill()}
        if(/twist|bind|cordage/.test(String(d.verb)))g.lineStyle(2,0xc3aa70,.95).drawEllipse(10,2,5,3);
      }else if(d.kind==='clay'){
        g.beginFill(C.clay,.98).drawEllipse(0,5,9,6).endFill();
        if(/shape|mold|vessel/.test(String(d.verb))){g.beginFill(0xc88d69,.98).drawEllipse(0,1,7,7).endFill();g.beginFill(0x624b3c,.65).drawEllipse(0,-2,3.5,2).endFill()}
      }else if(d.kind==='stone'){
        g.beginFill(C.rock,.98).drawPolygon([-8,6,-2,-7,7,4]).endFill();
        if(/strike|sharp/.test(String(d.verb)))g.beginFill(0xd4ddd7,.9).drawPolygon([7,2,14,-4,11,7]).endFill();
      }else if(d.kind==='wood'){
        g.lineStyle(5,C.wood,.98).moveTo(-11,7).lineTo(13,-5);if(/cut|shape/.test(String(d.verb)))g.lineStyle(2.5,0xbac3bb,.96).moveTo(4,-8).lineTo(10,-1);
      }else if(d.kind==='water'){
        g.beginFill(C.water,.88).drawEllipse(0,5,8,4).endFill();g.beginFill(0xdaf3f6,.5).drawCircle(-2,3,2.5).endFill();
      }else if(d.kind==='berries'){
        g.beginFill(C.leaf,.95).drawCircle(0,3,7).endFill();g.beginFill(C.berry,.98).drawCircle(-3,1,2.5).drawCircle(3,4,2.5).drawCircle(2,-2,2.5).endFill();
      }else if(d.kind==='tracks'){
        for(let i=-1;i<=1;i++)g.beginFill(0x30251c,.7).drawEllipse(i*6,4+i,2.3,3.5).endFill();
      }else if(d.kind==='fire'){
        g.beginFill(C.fire,.95).drawPolygon([-6,7,0,-10,6,7]).endFill();g.beginFill(C.fire2,.9).drawPolygon([-3,6,0,-4,3,6]).endFill();
      }
      prop.addChild(g);
    }
  }
  prop.visible=!!d&&(s.phase==='interact'||s.phase==='resolve');
  if(prop.visible){prop.rotation=Math.sin(t*5)*.035;prop.y=4+Math.sin(t*6)*.8;prop.alpha=s.phase==='resolve'?.82:1}
}
window.ChatGPTFarmActionVisuals={descriptor,placeLabel,redraw};
})();
