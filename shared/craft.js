// Technique dependencies, never a catalog of buildings. Pure/read-only helpers
// are shared by the simulation, inspector and workshop.
export const CRAFT_GRAPH = [
 {id:'stoneworking',name:'Stone working',from:[],practice:'Knapping attempts with carried stones',unlocks:'Usable stone flakes'},
 {id:'fiberwork',name:'Fiber working',from:[],practice:'Twisting carried reeds and making bindings',unlocks:'Cordage and lashings'},
 {id:'woodworking',name:'Wood working',from:['stoneworking'],practice:'Cutting wood and assembling real timber pieces',unlocks:'Hewn timber after 12 minutes of practice, with a hafted edge'},
 {id:'hafting',name:'Composite tools',from:['fiberwork','woodworking'],practice:'Binding a stone edge to a worked wooden handle',unlocks:'Stronger cutting and timber harvesting'},
 {id:'tracking',name:'Tracking',from:[],practice:'Observing a nearby animal without losing sight of it',unlocks:'Knowledge of observed animals'},
 {id:'hunting',name:'Hunting',from:['tracking','woodworking'],practice:'Existing physical hunting encounters',unlocks:'Pointed tools are possible; live animal pursuit is not connected yet'},
];
export const TOOL_NAMES={sharpStone:'stone cutting edge',boundSharpTool:'hafted stone edge',cordage:'cordage',woodPole:'worked wooden handle',pointedPole:'pointed wooden pole'};
export function practiceMinutes(a,key){return a.craftPractice?.[key]?.minutes||0;}
export function constructionSpec(part){
 const finish=part.finish==='hewn'?'hewn':'rough';
 const wooden=part.material==='timber',panel=['deck','wall','roof'].includes(part.kind);
 const binding=part.material==='reeds'||wooden&&(panel||part.requires?.length>0)?1:0;
 const thick=wooden&&!panel&&(part.kind==='post'?Math.max(part.size[0],part.size[2]):Math.min(...part.size))>.22;
 return {finish,tool:wooden&&(finish==='hewn'||thick)?'boundSharpTool':null,skill:wooden&&finish==='hewn'?'woodworking':null,minutes:wooden&&finish==='hewn'?12:0,binding,
  description:wooden?(finish==='hewn'?'Hand-hewn timber · tool marks remain':panel?'Uneven branch mat · fiber lashings':'Unshaped branch · bark retained'):part.material==='reeds'?'Overlapped reeds · fiber ties':part.material==='stone'?'Unworked rubble':'Hand-packed clay daub'};
}
export function constructionBlockers(a,part){
 const s=constructionSpec(part),out=[];
 if(s.tool&&!(a.inventory?.[s.tool]>0))out.push('Carry a '+TOOL_NAMES[s.tool]);
 if(s.skill&&practiceMinutes(a,s.skill)<s.minutes)out.push(`${s.minutes} minutes of actual ${s.skill} practice required`);
 if(!part.invested&&s.binding>(a.inventory?.cordage||0))out.push('Make and carry cordage for the joints');
 return out;
}
export function craftSnapshot(a){return {practice:a.craftPractice||{},knownTechniques:a.skills||{},tools:Object.fromEntries(Object.entries(TOOL_NAMES).map(([key])=>[key,a.inventory?.[key]||0]))};}
