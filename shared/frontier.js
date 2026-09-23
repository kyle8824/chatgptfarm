import {naturalWorld,naturalWaypoints,NATURAL_REGIONS} from './landscape.js';
// Shared geography and household identities. No renderer-only barriers.
export const FRONTIER_SIZE=500;
export const HOME_REGIONS=[
 {id:'willow-basin',name:'Willow Basin',x:64,y:34,biome:'woodland',specialty:'resin',color:'#789855'},
 {id:'flint-heights',name:'Flint Heights',x:430,y:65,biome:'upland',specialty:'flint',color:'#8e9475'},
 {id:'reed-fen',name:'Reed Fen',x:65,y:430,biome:'wetland',specialty:'longFiber',color:'#61856b'},
 {id:'ochre-vale',name:'Ochre Vale',x:430,y:430,biome:'clay',specialty:'potteryClay',color:'#a79970'},
];
export const FRONTIER_OBSTACLES=[
 {id:'north-ridge',kind:'ridge',minX:223,maxX:242,minY:0,maxY:187,height:7},
 {id:'south-ravine',kind:'ravine',minX:144,maxX:354,minY:342,maxY:350,height:-5},
 {id:'flint-terrace',kind:'terrace',minX:386,maxX:445,minY:145,maxY:181,height:3.2},
];
export const GREAT_RIVER=[[0,238],[90,224],[185,239],[270,244],[355,224],[430,242],[500,235]];
export function homeFor(w,a=null){return w.frontier?.homes?.find(h=>h.id===(a?.householdId||w.homeContext?.id))||w.frontier?.homes?.[0]||null;}
// Ancestry/provider assignment stays with the household; daily life uses the
// camp physically encountered nearby. Away from camp, actions stay local.
export function campFor(w,a){
 if(!naturalWorld(w)||!a?.coordinates)return homeFor(w,a);
 const near=w.frontier.homes.filter(h=>Math.hypot(h.x-a.coordinates.x,h.y-a.coordinates.y)<18||(a.knownCamps?.includes(h.id)||h.id===a.householdId)&&Math.hypot(h.x-a.coordinates.x,h.y-a.coordinates.y)<55).sort((h,j)=>Math.hypot(h.x-a.coordinates.x,h.y-a.coordinates.y)-Math.hypot(j.x-a.coordinates.x,j.y-a.coordinates.y));
 return near[0]||w.frontier.homes.find(h=>h.id===a.campId)||homeFor(w,a);
}
export function householdWorld(w,a){
 if(!w.frontier)return w;
 const root=w.rootWorld||w,h=campFor(root,a);if(!h)return root;
 // A view, not a cloned world: events, counters and shared physical supplies
 // are written to the same authoritative record. Only camp accounts differ.
 return new Proxy(root,{get:(t,k)=>k==='rootWorld'?root:k==='homeContext'?h:k==='ecology'?h.id===HOME_REGIONS[0].id?t.ecology:h.ecology:k==='resources'?h.id===HOME_REGIONS[0].id?t.resources:h.resources:k==='structures'?h.id===HOME_REGIONS[0].id?t.structures:h.structures:k==='discovered'?h.id===HOME_REGIONS[0].id?t.discovered:h.discovered:Reflect.get(t,k),set:(t,k,v)=>{if(['resources','structures','discovered','ecology'].includes(k)&&h.id!==HOME_REGIONS[0].id)h[k]=v;else t[k]=v;return true;}});
}
export function localPosition(w,p){const h=w.homeContext;return h?{x:p.x+h.x-64,y:p.y+h.y-34}:{...p};}
export function homeAccount(w,id){const h=w.homeContext;return h&&h.id!==HOME_REGIONS[0].id?h.id+':'+id:id;}
export function campLayout(w=null,h=null){
 h??=w?.homeContext;const dx=(h?.x??64)-64,dy=(h?.y??34)-34;
 return {shelter:{x:66+dx,y:35+dy,rotation:-.22,halfWidth:1.95,halfLength:1.7},fire:{x:63+dx,y:33+dy,radius:1.15}};
}
export function campsOf(w){return w.frontier?w.frontier.homes.map(h=>({home:h,...campLayout(w,h),structures:h.id===HOME_REGIONS[0].id?w.structures:h.structures})):[{...campLayout(),structures:w.structures}];}
export const pointIn=(p,r,pad=0)=>p.x>=r.minX-pad&&p.x<=r.maxX+pad&&p.y>=r.minY-pad&&p.y<=r.maxY+pad;
export function frontierGround(w,p){if(!w.frontier||naturalWorld(w))return true;return !FRONTIER_OBSTACLES.some(r=>r.kind!=='terrace'&&pointIn(p,r,.35));}
export function terrainWaypoints(w,a,b){return naturalWorld(w)?naturalWaypoints(a,b):w.frontier?FRONTIER_OBSTACLES.filter(r=>r.kind!=='terrace'&&(!a||Math.min(a.x,b.x)<r.maxX&&Math.max(a.x,b.x)>r.minX&&Math.min(a.y,b.y)<r.maxY&&Math.max(a.y,b.y)>r.minY)).flatMap(r=>[r.minX-1,r.maxX+1].flatMap(x=>[r.minY-1,r.maxY+1].map(y=>({x,y})))).filter(p=>p.x>0&&p.y>0&&p.x<FRONTIER_SIZE&&p.y<FRONTIER_SIZE):[];}
export function terraceAt(p){return FRONTIER_OBSTACLES.find(r=>r.kind==='terrace'&&pointIn(p,r));}
export function terrainEdge(w,a,b){return !w.frontier||terraceAt(a)?.id===terraceAt(b)?.id;}
export function riverAt(points,x){for(let i=1;i<points.length;i++)if(x<=points[i][0]){const[a,b]=[points[i-1],points[i]];return a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]);}return points.at(-1)[1];}
export function knownPerson(a,b){return a.id===b.id||a.householdId&&a.householdId===b.householdId||!!a.knownPeople?.[b.id]||a.life?.parents?.includes(b.id)||a.life?.children?.includes(b.id);}
export function regionFor(p,w=null){return (naturalWorld(w)?NATURAL_REGIONS:HOME_REGIONS).find(h=>Math.abs(p.x-h.x)<=55&&Math.abs(p.y-h.y)<=55)||null;}
export const REGIONAL_ITEMS={
 resin:{name:'Pine resin',mass:.25,volume:.25,base:'resin',use:'Seal and protect completed roofing from weather'},
 flint:{name:'Fine flint',mass:1.2,volume:.6,base:'stones',use:'Knapping useful cutting edges with less material'},
 longFiber:{name:'Long reed fiber',mass:.2,volume:1,base:'reeds',use:'Efficient cordage and durable bindings'},
 potteryClay:{name:'Pottery clay',mass:1,volume:.6,base:'clay',use:'More reliable clay vessels'},
};
