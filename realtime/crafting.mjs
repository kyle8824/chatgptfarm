import {resolveMaterial} from '../engine/physical-materials.js';
import {recordPractice} from '../engine/craft-practice.js';
import {constructionSpec,bindingCoils,practiceMinutes,TOOL_NAMES} from '../shared/craft.js';
import {addEvent} from '../engine/core.js';
import {syncHoldings} from './holdings.mjs';

// Recipes here describe physical tool operations, not structure designs.
const recipes={
 sharpStone:{inputs:{stones:2},minutes:6,skill:'stoneworking',verb:'strike',x:'carried_stone',y:'carried_stone'},
 cordage:{inputs:{reeds:3},minutes:5,skill:'fiberwork',verb:'twist',x:'carried_reeds'},
 woodPole:{inputs:{branch:1,edge:1},minutes:8,skill:'woodworking',verb:'cut'},
 boundSharpTool:{inputs:{woodPole:1,sharpStone:1,cordage:1},minutes:8,skill:'hafting',verb:'bind',x:'wood_pole',y:'sharp_stone'},
 pointedPole:{inputs:{woodPole:1,edge:1},minutes:8,skill:'woodworking',verb:'shape',x:'wood_pole',configuration:'pointed'},
};
export function toolPlan(a,item,depth=0){
 if(depth>6)throw Error('Tool dependency cycle');
 if(item==='sharpStone'&&a.inventory.flint>=1)return {craft:item,intermediate:item,minutes:4,label:'Knapp a fine flint edge'};if(item==='cordage'&&a.inventory.longFiber>=1)return {craft:item,intermediate:item,minutes:4,label:'Twist long reed fibers into cordage'};
 const recipe=recipes[item];if(!recipe)return {item,quantity:1};
 for(const [input,count]of Object.entries(recipe.inputs)){
  const key=input==='branch'?(a.inventory.dryWood?'dryWood':'wetWood'):input==='edge'?(a.inventory.boundSharpTool?'boundSharpTool':'sharpStone'):input;
  if((a.inventory[key]||0)>=count)continue;
  if(recipes[key])return toolPlan(a,key,depth+1);
  return {item:input==='branch'?'timber':key,quantity:count-(a.inventory[key]||0),intermediate:item};
 }
 return {craft:item,intermediate:item,minutes:recipe.minutes,label:'Make '+TOOL_NAMES[item]};
}
export function preparationFor(a,part,project){
 const spec=constructionSpec(part);
 if(spec.tool&&!a.inventory[spec.tool])return {...toolPlan(a,spec.tool),goal:spec.tool,goalQuantity:1};
 // Useful practice produces actual worked poles; these retain their wood mass.
 if(spec.skill&&practiceMinutes(a,spec.skill)<spec.minutes)return toolPlan(a,'woodPole');
 const binding=bindingCoils(part,project);
 if(!part.invested&&binding>(a.inventory.cordage||0))return {...toolPlan(a,'cordage'),goal:'cordage',goalQuantity:binding-(a.inventory.cordage||0)};
 return null;
}
export function craftTool(w,a,item){
 const special=item==='sharpStone'&&a.inventory.flint>=1?'flint':item==='cordage'&&a.inventory.longFiber>=1?'longFiber':null;if(special){a.inventory[special]--;a.inventory[item]=(a.inventory[item]||0)+1;recordPractice(w,a,item==='sharpStone'?'stoneworking':'fiberwork',4,'Worked '+special+' into '+item);return {done:true,success:true,detail:'One unit of '+special+' became one '+item+' through elapsed work.'};}
 const recipe=recipes[item],plan=recipe&&toolPlan(a,item);
 if(!recipe||plan.craft!==item)return {done:true,success:false,detail:'The tool materials are no longer carried here.'};
 const x=recipe.x||(a.inventory.dryWood?'carried_dry_branch':'carried_wet_branch'),y=recipe.y||(['woodPole','pointedPole'].includes(item)?a.inventory.boundSharpTool?'bound_sharp_tool':'sharp_stone':null);
 const p={verb:recipe.verb,configuration:recipe.configuration},attemptKey='craft:'+item,n=(a.affordanceAttempts[attemptKey]||0)+1;a.affordanceAttempts[attemptKey]=n;
 const r=resolveMaterial(w,a,p,{id:x},y?{id:y}:null,n);syncHoldings(w);
 recordPractice(w,a,recipe.skill,recipe.minutes,`${plan.label}: ${r.detail}`,r.success);
 addEvent(w,r.success?'tool-crafted':'craft-attempt',plan.label,r.detail,{agentId:a.id});
 return {done:true,success:r.success,detail:r.detail};
}
