import{remember}from'./core.js';
import{findWorldObject,instantiateObjectComponents,detachComponent,addObjectHistory}from'./world-model.js';

const sharp=y=>['sharp_stone','bound_sharp_tool'].includes(y?.id)||y?.properties?.includes('sharp');
const readable=o=>Object.entries(o?.physical||{}).filter(([,v])=>v===true).map(([k])=>k.replaceAll('_',' ')).slice(0,5).join(', ');

export function resolveWorldObject(w,a,p,x,y,n){
 const id=x?.worldObjectId;if(!id)return{handled:false,success:false,detail:''};const obj=findWorldObject(w,id);if(!obj)return{handled:false,success:false,detail:''};
 if(p.verb==='inspect'){
  const before=(obj.childrenIds||[]).length,parts=instantiateObjectComponents(w,obj.id,{reason:'close inspection',actorId:a.id}),created=Math.max(0,parts.length-before),qualities=readable(obj);
  let detail;if(created>0)detail=`${a.name} examines the ${obj.label} closely. What looked like one environmental feature resolves into ${parts.length} persistent parts that can now be distinguished and interacted with.`;else detail=`${a.name} studies the ${obj.label} closely${qualities?`, noticing ${qualities}`:''}.`;
  addObjectHistory(w,obj,'inspect',detail,{actorId:a.id});remember(w,a,`Close inspection of the ${obj.label} revealed ${parts.length?`${parts.length} distinguishable persistent parts`:'more of its physical properties'}.`,{importance:created?6:4,tags:['inspection','environment',obj.type],confidence:.84});return{handled:true,success:true,detail,worldObjectId:obj.id,resolvedComponents:parts.map(q=>q.id)}
 }
 if(p.verb==='cut'&&obj.kind==='component'&&obj.physical?.wood&&obj.physical?.carryable){
  if(!sharp(y))return{handled:true,success:false,detail:`${a.name} tests the ${obj.label}, but lacks a controlled cutting edge.`};
  const detached=detachComponent(w,obj.id,{actorId:a.id,newZone:a.position});if(!detached)return{handled:true,success:false,detail:`${a.name} cannot separate the ${obj.label} from its parent object.`};const moisture=Number(detached.material?.moisturePct??32),key=moisture<=24?'dryWood':'wetWood';a.inventory[key]=(a.inventory[key]||0)+1;detached.state={...detached.state,carried:true,inventoryKey:key};detached.carrierId=a.id;detached.zone=a.position;detached.position={x:a.coordinates?.x??detached.position.x,y:a.coordinates?.y??detached.position.y};addObjectHistory(w,detached,'carried',`${a.name} cut this component free and began carrying it.`,{actorId:a.id});const detail=`${a.name} cuts ${obj.label} free from the larger tree. It remains the same physical piece of oak, now an independent ${moisture<=24?'dry':'damp'} branch carried away from its parent.`;remember(w,a,`A component cut from a larger object remains the same material object after separation.`,{importance:6,tags:['wood','object','cutting','provenance'],confidence:.9});return{handled:true,success:true,detail,worldObjectId:detached.id,detached:true,inventoryKey:key}
 }
 if(p.verb==='place'&&obj.state?.carried&&obj.carrierId===a.id){
  const dest=y?.worldObjectId?findWorldObject(w,y.worldObjectId):null;obj.state.carried=false;obj.carrierId=null;obj.zone=dest?.zone||a.position;obj.position=dest?.position?{...dest.position}:{x:a.coordinates?.x??obj.position.x,y:a.coordinates?.y??obj.position.y};addObjectHistory(w,obj,'placed',`${a.name} placed the object at ${dest?.label||obj.zone}.`,{actorId:a.id});const key=obj.state.inventoryKey;if(key&&(a.inventory[key]||0)>0)a.inventory[key]--;return{handled:true,success:true,detail:`${a.name} places the same persistent ${obj.label} at ${dest?.label||obj.zone}.`,worldObjectId:obj.id}
 }
 return{handled:false,success:false,detail:''};
}
