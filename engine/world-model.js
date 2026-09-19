export const WORLD_MODEL_VERSION='object-field-1.0';

const FIXED={
 camp:{id:'OBJ-CAMP-001',kind:'place',type:'camp_area',label:'camp',zone:'camp',position:{x:64,y:34},geometry:{shape:'ellipse',radiusM:11},physical:{navigable:true,ground:'meadow-soil'}},
 creek:{id:'OBJ-CREEK-001',kind:'feature',type:'creek_segment',label:'creek',zone:'creek',position:{x:48,y:19},geometry:{shape:'polyline',widthM:5,points:[[0,17.5],[12,19.2],[27,17.4],[43,19.6],[58,18.2],[72,19.4],[86,19.1],[100,21.2]]},physical:{navigable:true,water:true,liquid:true,potable:true}},
 berries:{id:'OBJ-BERRIES-001',kind:'organism_group',type:'berry_patch',label:'berry patch',zone:'berries',position:{x:29,y:31},geometry:{shape:'ellipse',radiusM:7},physical:{navigable:true,biological:true,harvestable:true,edible:true,perishable:true}},
 log:{id:'OBJ-TREE-001',kind:'object',type:'fallen_tree',label:'fallen oak',zone:'log',position:{x:59,y:29},geometry:{shape:'capsule',lengthM:4.8,diameterM:.31,orientationDeg:81},physical:{wood:true,rigid:true,cuttable:true,flammable:true,heavy:true,inspectable:true},material:{species:'oak',densityKgM3:690,hardness:5.8}},
 stones:{id:'OBJ-STONES-001',kind:'object_group',type:'stone_field',label:'stone field',zone:'stones',position:{x:73,y:28},geometry:{shape:'ellipse',radiusM:8},physical:{navigable:true,stone:true,hard:true,fracturable:true,impact:true,harvestable:true}},
 clay:{id:'OBJ-CLAY-001',kind:'terrain_feature',type:'clay_bank',label:'clay bank',zone:'clay',position:{x:86,y:23},geometry:{shape:'bank',lengthM:12,widthM:4,orientationDeg:8},physical:{navigable:true,clay:true,plastic:true,moldable:true,harvestable:true,wet:true}},
 reeds:{id:'OBJ-REEDS-001',kind:'organism_group',type:'reed_marsh',label:'reed marsh',zone:'reeds',position:{x:10,y:22},geometry:{shape:'wetland',radiusM:12},physical:{navigable:true,reeds:true,fibrous:true,flexible:true,cuttable:true,harvestable:true,wetland:true}},
 edge:{id:'OBJ-FRONTIER-001',kind:'place',type:'frontier',label:'unknown frontier',zone:'edge',position:{x:78,y:42},geometry:{shape:'boundary',lengthM:40},physical:{navigable:true,unknown:true}}
};

const clone=x=>JSON.parse(JSON.stringify(x));
const now=w=>({day:w.day,hour:w.hour});
const objectId=w=>`OBJ-${String(w.seq.object++).padStart(5,'0')}`;
const componentId=(parent,suffix)=>`${parent.id}-${suffix}`;

function baseEntity(spec,w){return{...clone(spec),parentId:null,childrenIds:[],resolution:{level:'aggregate',componentsInstantiated:false},state:{active:true},provenance:{created:now(w),source:'world-origin'},history:[]}}
function ensureBaseObjects(w){for(const spec of Object.values(FIXED))if(!w.worldModel.objects.some(o=>o.id===spec.id))w.worldModel.objects.push(baseEntity(spec,w))}

export function ensureWorldModel(w){
 w.seq||={};w.seq.object??=1;
 w.worldModel||={version:WORLD_MODEL_VERSION,bounds:{width:100,height:100,metersPerUnit:2},objects:[],fields:{},terrain:[]};
 w.worldModel.version=WORLD_MODEL_VERSION;w.worldModel.bounds||={width:100,height:100,metersPerUnit:2};w.worldModel.objects||=[];w.worldModel.fields||={};w.worldModel.terrain||=[];
 if(!w.worldModel.terrain.length)w.worldModel.terrain=[
  {id:'TERRAIN-MEADOW',type:'meadow',center:{x:48,y:36},radiusM:38,properties:{soil:'loam',vegetation:'grass',drainage:.68}},
  {id:'TERRAIN-FOREST-W',type:'forest',center:{x:14,y:29},radiusM:25,properties:{canopy:.82,soil:'forest-loam',shade:.77}},
  {id:'TERRAIN-FOREST-E',type:'forest',center:{x:83,y:29},radiusM:22,properties:{canopy:.78,soil:'forest-loam',shade:.72}},
  {id:'TERRAIN-WETLAND',type:'wetland',center:{x:10,y:22},radiusM:15,properties:{soil:'saturated-organic',standingWater:true}}
 ];
 ensureBaseObjects(w);
 // v0.8 geography migration: old renderer geometry placed the visible creek far north
 // of its canonical zone. Only migrate the untouched world-origin creek shape.
 const creek=w.worldModel.objects.find(o=>o.id==='OBJ-CREEK-001');
 const creekPoints=creek?.geometry?.points||[],v08Creek=JSON.stringify([[0,18],[12,21],[27,18],[43,22],[58,19],[72,23],[86,21],[100,24]]);
 if(creek?.provenance?.source==='world-origin'&&(Math.max(...creekPoints.map(q=>q[1]||0))>50||JSON.stringify(creekPoints)===v08Creek)){
  creek.position=clone(FIXED.creek.position);creek.geometry=clone(FIXED.creek.geometry);
  creek.history||=[];creek.history.push({day:w.day,hour:w.hour,type:'coordinate-migration',detail:'Refined the creek into a continuous basin channel with solid-object clearance.'});
 }
 const stones=w.worldModel.objects.find(o=>o.id==='OBJ-STONES-001');
 if(stones?.provenance?.source==='world-origin'&&(stones.position?.y??0)<27){stones.position=clone(FIXED.stones.position);stones.history||=[];stones.history.push({day:w.day,hour:w.hour,type:'coordinate-migration',detail:'Moved the stone field clear of the creek channel and bank.'})}
 const clay=w.worldModel.objects.find(o=>o.id==='OBJ-CLAY-001');
 if(clay?.provenance?.source==='world-origin'&&(clay.position?.y??0)<22.5){clay.position=clone(FIXED.clay.position);clay.geometry=clone(FIXED.clay.geometry);clay.history||=[];clay.history.push({day:w.day,hour:w.hour,type:'coordinate-migration',detail:'Moved the clay exposure onto the north creek bank instead of inside the channel.'})}
 w.worldModel.lastEnvironmentHour??=w.day*24+w.hour;
 syncLegacyIntoWorldModel(w);return w.worldModel;
}

export function findWorldObject(w,id){return w.worldModel?.objects?.find(o=>o.id===id)||null}
export function worldObjectForZone(w,zone){return w.worldModel?.objects?.find(o=>o.zone===zone&&o.parentId===null)||null}
export function addObjectHistory(w,obj,type,detail,meta={}){obj.history||=[];obj.history.push({day:w.day,hour:w.hour,type,detail,...meta});if(obj.history.length>80)obj.history=obj.history.slice(-80)}

function structureEntity(w,id,type,label,active,position,physical){let o=findWorldObject(w,id);if(!o){o={id,kind:'structure',type,label,zone:position.zone,position:{x:position.x,y:position.y},geometry:{shape:'structure'},physical:{...physical},material:{},state:{active:!!active},parentId:null,childrenIds:[],resolution:{level:'object',componentsInstantiated:true},provenance:{created:now(w),source:'legacy-structure-migration'},history:[]};w.worldModel.objects.push(o)}o.state.active=!!active;return o}

export function syncLegacyIntoWorldModel(w){
 if(!w.worldModel)return;
 const r=w.resources||{},s=w.structures||{},e=w.ecology||{};
 const patch=findWorldObject(w,FIXED.berries.id);if(patch){patch.state.ediblePortions=r.berries||0;patch.state.exhausted=(r.berries||0)<=0}
 const tree=findWorldObject(w,FIXED.log.id);if(tree){tree.state.availableDryBranches=r.dryWood||0;tree.state.availableWetBranches=r.wetWood||0;const total=(r.dryWood||0)+(r.wetWood||0);tree.state.branchSupply=total;tree.material.moisturePct??=total?Math.round(((r.wetWood||0)/total)*55+12):Math.max(tree.material.moisturePct||28,28)}
 const stones=findWorldObject(w,FIXED.stones.id);if(stones)stones.state.looseStones=r.stones||0;
 const clay=findWorldObject(w,FIXED.clay.id);if(clay){clay.state.harvestableUnits=r.clay||0;clay.state.approxKg=Math.round((r.clay||0)*.45*10)/10}
 const reeds=findWorldObject(w,FIXED.reeds.id);if(reeds)reeds.state.harvestableStalkBundles=r.reeds||0;
 const creek=findWorldObject(w,FIXED.creek.id);if(creek)creek.state.potable=r.creekWater!==false;
 structureEntity(w,'OBJ-SHELTER-001','branch_shelter','branch shelter',s.shelter,{x:64,y:34,zone:'camp'},{shelter:true,wood:true,flammable:true});
 structureEntity(w,'OBJ-FIRE-001','camp_fire','camp fire',s.fire,{x:61,y:33,zone:'camp'},{fire:true,heat:true,light:true});
 structureEntity(w,'OBJ-DRYING-001','drying_rack','drying rack',s.dryingRack,{x:68,y:34,zone:'camp'},{wood:true,dryingSurface:true});
 const tracks=findWorldObject(w,'OBJ-TRACKS-001');if(tracks){tracks.state.active=false;tracks.state.retiredReason='replaced by source-linked wildlife traces';}
 updateEnvironmentalModel(w);
}

export function sampleEnvironmentalFields(w){
 const rain=w.weather==='rain',cloud=w.weather==='cloudy',wet=Math.max(.12,Math.min(1,Number(w.environmentState?.surfaceWetness??(rain?.82:.32)))),level=Math.max(.2,Math.min(1,Number(w.environmentState?.creekLevel??(rain?.58:.42))));
 const humidity=Math.min(.97,rain?.94:cloud?Math.max(.7,.63+wet*.16):.46+wet*.18);
 const daylight=Math.max(0,Math.sin(((w.hour-6)/24)*Math.PI*2)),zone=(base,span)=>Math.round(Math.min(1,base+wet*span)*100)/100;
 const f={};
 f.temperature={type:'scalar',unit:'F',global:w.temperature};
 f.precipitation={type:'scalar',unit:'relative',global:rain?.78:0,kind:rain?'rain':'none'};
 f.humidity={type:'scalar',unit:'relative',global:Math.round(humidity*100)/100};
 f.light={type:'scalar',unit:'relative',global:Math.round(daylight*100)/100};
 f.soilMoisture={type:'zonal',unit:'relative',zones:{camp:zone(.16,.67),meadow:zone(.14,.69),forest:zone(.31,.58),creek:zone(.72,.27),clay:zone(.76,.22),reeds:zone(.82,.17),berries:zone(.2,.64),stones:zone(.08,.43),log:zone(.18,.58),edge:zone(.18,.62)}};
 f.waterDepth={type:'object',unit:'m',objects:{'OBJ-CREEK-001':Math.round((.31+level*.32)*100)/100}};
 f.surfaceWetness={type:'scalar',unit:'relative',global:Math.round(wet*100)/100,lastRainAt:w.environmentState?.lastRainAt||null,hoursSinceRain:w.environmentState?.hoursSinceRain??null};
 f.wind={type:'scalar',unit:'m/s',global:cloud?2.4:rain?3.1:1.5};
 return f;

}

export function updateEnvironmentalModel(w){if(w.worldModel)Object.assign(w.worldModel.fields,sampleEnvironmentalFields(w));}

function spawnComponent(w,parent,suffix,type,label,offset,physical,material,state={}){const id=componentId(parent,suffix);let o=findWorldObject(w,id);if(o)return o;o={id,kind:'component',type,label,zone:parent.zone,position:{x:parent.position.x+offset[0],y:parent.position.y+offset[1]},geometry:{shape:'component'},physical:{...physical},material:{...clone(parent.material||{}),...material},state:{active:true,...state},parentId:parent.id,childrenIds:[],resolution:{level:'component',componentsInstantiated:true},provenance:{created:now(w),source:`resolved from ${parent.id}`},history:[]};w.worldModel.objects.push(o);parent.childrenIds.push(id);return o}

export function instantiateObjectComponents(w,objectId,{reason='inspection',actorId=null}={}){ensureWorldModel(w);const parent=findWorldObject(w,objectId);if(!parent)return[];if(parent.resolution?.componentsInstantiated)return(parent.childrenIds||[]).map(id=>findWorldObject(w,id)).filter(Boolean);const made=[];
 if(parent.type==='fallen_tree'){
  made.push(spawnComponent(w,parent,'TRUNK','trunk','oak trunk',[0,0],{wood:true,rigid:true,cuttable:true,flammable:true,heavy:true},{grain:'longitudinal'},{massKg:150}));
  for(let i=1;i<=4;i++)made.push(spawnComponent(w,parent,`BRANCH-${i}`,'branch',`oak branch ${i}`,[i%2?.8:-.7,(i-2.5)*.35],{wood:true,rigid:true,cuttable:true,flammable:true,carryable:true},{},{massKg:2+i*.7,diameterCm:3+i}));
 }else if(parent.type==='berry_patch')for(let i=1;i<=3;i++)made.push(spawnComponent(w,parent,`BUSH-${i}`,'berry_bush',`berry bush ${i}`,[Math.cos(i*2.1)*1.7,Math.sin(i*2.1)*1.3],{biological:true,harvestable:true,edibleFruit:true},{},{fruitPortions:Math.floor((parent.state.ediblePortions||0)/3)}));
 else if(parent.type==='stone_field')for(let i=1;i<=5;i++)made.push(spawnComponent(w,parent,`ROCK-${i}`,'rock',`loose rock ${i}`,[Math.cos(i)*2,Math.sin(i)*1.5],{stone:true,hard:true,fracturable:true,impact:true,carryable:true},{rockType:i%2?'chert-like':'granite-like'},{massKg:1.1+i*.35}));
 else if(parent.type==='clay_bank')for(let i=1;i<=3;i++)made.push(spawnComponent(w,parent,`DEPOSIT-${i}`,'clay_deposit',`clay exposure ${i}`,[i*.8-1.6,i%2?.5:-.4],{clay:true,plastic:true,moldable:true,harvestable:true,wet:true},{mineralFraction:.62+i*.05},{availableKg:Math.max(.5,(parent.state.approxKg||1)/3)}));
 else if(parent.type==='reed_marsh')for(let i=1;i<=4;i++)made.push(spawnComponent(w,parent,`STAND-${i}`,'reed_stand',`reed stand ${i}`,[Math.cos(i*1.6)*2.3,Math.sin(i*1.6)*2],{biological:true,reeds:true,fibrous:true,flexible:true,cuttable:true,harvestable:true},{},{bundles:Math.max(1,Math.floor((parent.state.harvestableStalkBundles||0)/4))}));
 parent.resolution={level:made.length?'component':'object',componentsInstantiated:made.length>0};if(made.length)addObjectHistory(w,parent,'resolution',`Resolved into ${made.length} persistent components because of ${reason}.`,{actorId});return made;
}

export function detachComponent(w,componentId,{actorId=null,newZone=null}={}){const c=findWorldObject(w,componentId);if(!c||!c.parentId)return null;const p=findWorldObject(w,c.parentId);if(p)p.childrenIds=(p.childrenIds||[]).filter(id=>id!==c.id);c.parentId=null;c.zone=newZone||c.zone;c.provenance={...c.provenance,detached:now(w),detachedBy:actorId};addObjectHistory(w,c,'detached',`Component became an independent object.`,{actorId});return c}

export function objectSnapshot(o){return{id:o.id,type:o.type,label:o.label,zone:o.zone,position:o.position,geometry:o.geometry,physical:o.physical,material:o.material,state:o.state,resolution:o.resolution,parentId:o.parentId,childrenIds:o.childrenIds}}
export function activeWorldObjects(w){return(w.worldModel?.objects||[]).filter(o=>o.state?.active!==false)}
// Explicit physical transition over an interval with the current weather.
// Migrations initialize the watermark at current time; no retroactive drying.
export function advanceObjectEnvironment(w, toHour) {
 if(!w.worldModel)throw new Error('Migrate world before environmental integration');
 const from=w.worldModel.lastEnvironmentHour;
 if(!Number.isFinite(from)||!Number.isFinite(toHour))throw new Error('Invalid environmental interval');
 if(toHour<from)throw new Error('Environmental time cannot go backwards');
 const elapsed=toHour-from;
 if(!elapsed)return;
 const rain=w.weather==='rain',cloud=w.weather==='cloudy';
 for(const o of w.worldModel.objects){if(!o.state?.active)continue;const exposed=o.parentId===null||o.state.exposed;if(o.physical?.wood&&exposed){o.material||={};let m=Number(o.material.moisturePct??28);m+=elapsed*(rain?4:cloud?.2:-1.8);o.material.moisturePct=Math.max(8,Math.min(80,Math.round(m*10)/10))}if(o.physical?.weatherSensitive&&rain&&o.state.clarity!=null)o.state.clarity=Math.max(.1,Math.round((o.state.clarity-.08*elapsed)*100)/100)}
 w.worldModel.lastEnvironmentHour=toHour;
}
