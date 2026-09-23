// One geographic model for the renderer, water access and walking physics.
// The original 0..100 valley stays fixed. New land extends toward negative X/Z,
// directly beyond the creek/trees in the established starting camera view.
export const LAND_BOUNDS={minX:-400,minY:-400,maxX:100,maxY:100,width:500,height:500};
export const NATURAL_REGIONS=[
 {id:'willow-basin',name:'Willow Basin',x:64,y:34,biome:'woodland',color:'#789855'},
 {id:'flint-heights',name:'Flint Heights',x:-330,y:35,biome:'upland',color:'#829574'},
 {id:'reed-fen',name:'Reed Fen',x:55,y:-330,biome:'wetland',color:'#638c71'},
 {id:'ochre-vale',name:'Ochre Vale',x:-325,y:-325,biome:'clay',color:'#9e9566'}
];
export const LANDMARKS=[
 {id:'lake',name:'Stillwater Lake',x:-125,y:-156,view:150},
 {id:'falls',name:'Fern Falls',x:-218,y:-215,view:45},
 {id:'highlands',name:'The High Fells',x:-290,y:-95,view:160},
 {id:'wetlands',name:'Reedwater Ponds',x:27,y:-245,view:85}
];
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
export const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
export const mix=(a,b,t)=>a+(b-a)*t;
const bell=(x,z,cx,cz,rx,rz,h)=>h*Math.exp(-(((x-cx)/rx)**2+((z-cz)/rz)**2));
export function originalRiver(x){const pts=[[0,17.5],[12,19.2],[27,17.4],[43,19.6],[58,18.2],[72,19.4],[86,19.1],[100,21.2]];for(let i=1;i<pts.length;i++)if(x<=pts[i][0]){const[a,b]=[pts[i-1],pts[i]];return mix(a[1],b[1],(x-a[0])/(b[0]-a[0]));}return pts.at(-1)[1];}
export function originalGround(x,z){
 const center=originalRiver(x),d=Math.abs(z-center),side=Math.sign(z-center)||1;
 const raw=s=>{const gap=Math.abs(s-center),hills=Math.max(0,s-53)*.095+Math.max(0,9-s)*.13;return -.48+Math.min(1.12,gap*.36)+Math.sin(x*.16)*Math.sin(s*.15)*Math.min(.5,gap*.055)+hills*(1.2+Math.sin(x*.15)*.6);};
 if(d<=1.25)return -.48+.34*d/1.25;if(d<=2.5)return -.14+(d-1.25)*.56;if(d<3.75)return mix(.56,raw(center+side*3.75),(d-2.5)/1.25);return raw(z);
}
export function preservedValley(x,z){return x>=-3&&x<=104&&z>=-3&&z<=84;}
export function baseGround(x,z){
 let h=.8+Math.sin(x*.026+z*.009)*1.6+Math.cos(z*.031-x*.012)*1.15;
 h+=bell(x,z,-30,-48,38,31,6)+bell(x,z,-94,18,36,47,7);
 h+=bell(x,z,-291,-93,39,62,47)+bell(x,z,-254,-130,29,43,35)+bell(x,z,-326,-157,29,48,32);
 h+=bell(x,z,-208,-286,68,45,13)+bell(x,z,-352,-260,53,63,10);
 h+=bell(x,z,-320,12,68,48,9)+bell(x,z,-170,-27,52,39,12);
 h+=bell(x,z,-55,-325,35,51,8)+bell(x,z,-64,-235,36,26,5);
 // Low wetlands and gently sheltered founding clearings join the terrain.
 h=mix(h,.8,smooth(75,15,Math.hypot((x-35)*.8,z+270))*.85);
 for(const r of NATURAL_REGIONS){const lx=x-r.x+64,lz=z-r.y+34;
  if(lx>=-15&&lx<=115&&lz>=-15&&lz<=92){const t=smooth(-15,0,lx)*(1-smooth(100,115,lx))*smooth(-15,0,lz)*(1-smooth(78,92,lz));const level=r.id==='flint-heights'?8:r.id==='ochre-vale'?6:0;h=mix(h,originalGround(lx,lz)+level,t);}
 }
 return h;
}
export const cliffEdge=x=>-219+8*Math.sin((x+255)*.038);
export function escarpmentHeight(x,z){const edge=cliffEdge(x);return 3.2*smooth(-285,-267,x)*(1-smooth(-206,-187,x))*smooth(edge-43,edge-20,z)*(1-smooth(edge-.17,edge+.17,z));}
function pond(id,name,x,z,rx,rz,level,seed){const points=[];for(let i=0;i<64;i++){const a=i/64*Math.PI*2,r=1+.08*Math.sin(a*3+seed)+.045*Math.cos(a*5-seed);points.push([x+Math.cos(a)*rx*r,z+Math.sin(a)*rz*r]);}return {id,name,kind:'lake',x,z,rx,rz,level,points};}
export const LAKES=[pond('stillwater','Stillwater Lake',-124,-155,46,31,2.8,1),pond('upper-pool','Fern Pool',-239,-245,13,9,10.8,3),pond('reed-pond','Reedwater Pond',26,-244,17,11,.6,5),pond('marsh-pool','Marsh Pool',57,-273,9,14,.45,8),pond('woodland-pool','Woodland Pool',-86,-55,9,6,1.4,2)];
// [x,z,water height,half-width]. The drop is a real non-walkable watercourse.
export const STREAMS=[
 {id:'headwater',name:'Fernwater',points:[[-280,-290,13,1.1],[-265,-278,12,1.2],[-252,-261,11,1.35],[-245,-252,10.8,1.5],[-235,-237,10.8,1.5],[-225,-228,10.5,1.25],[-218,-218,9.8,1.6],[-218,-214,4.4,1.8],[-207,-204,3.8,1.8],[-190,-199,3.2,1.7],[-167,-183,2.8,2]]},
 {id:'longwater',name:'The Longwater',points:[[-86,-146,2.8,2],[-72,-132,2.6,2],[-68,-117,2.3,2],[-52,-103,1.9,1.8],[-47,-85,1.5,1.8],[-39,-69,1.2,1.5],[-32,-49,.85,1.3],[-18,-31,.45,1.25],[-15,-12,.12,1.25],[-1,17.36,-.12,1.25],[0,17.5,-.12,1.25]]},
 ...NATURAL_REGIONS.map(r=>({id:r.id+'-creek',name:r.name+' creek',homeId:r.id,points:[[0,17.5],[12,19.2],[27,17.4],[43,19.6],[58,18.2],[72,19.4],[86,19.1],[100,21.2]].map(([x,z])=>[x+r.x-64,z+r.y-34,(r.id==='flint-heights'?8:r.id==='ochre-vale'?6:0)-.12,1.25])})),
 {id:'fen-run',name:'Reedwater Run',points:[[23,-344,-.12,1.1],[19,-321,.05,1.1],[29,-301,.2,1.1],[41,-289,.45,1.2],[50,-279,.45,1.2]]}
];
export function pointInPolygon(x,z,points){let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const[a,b]=points[i],[c,d]=points[j];if((b>z)!==(d>z)&&x<(c-a)*(z-b)/(d-b)+a)inside=!inside;}return inside;}
export function segmentProjection(x,z,a,b){const dx=b[0]-a[0],dz=b[1]-a[1],t=clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1));const qx=mix(a[0],b[0],t),qz=mix(a[1],b[1],t);return {x:qx,z:qz,t,distance:Math.hypot(x-qx,z-qz)};}
const RIVER_SEGMENTS=STREAMS.flatMap(s=>s.points.slice(1).map((b,i)=>({a:s.points[i],b,id:s.id,name:s.name})));
export function waterSample(x,z){
 let best=null;
 for(const s of RIVER_SEGMENTS){if(x<Math.min(s.a[0],s.b[0])-14||x>Math.max(s.a[0],s.b[0])+14||z<Math.min(s.a[1],s.b[1])-14||z>Math.max(s.a[1],s.b[1])+14)continue;const q=segmentProjection(x,z,s.a,s.b),width=mix(s.a[3],s.b[3],q.t),edge=q.distance-width;if(!best||edge<best.edge)best={...q,edge,level:mix(s.a[2],s.b[2],q.t),id:s.id,kind:'stream'};}
 for(const l of LAKES){if(Math.abs(x-l.x)>l.rx+16||Math.abs(z-l.z)>l.rz+16)continue;let q=null;for(let i=0;i<l.points.length;i++){const p=segmentProjection(x,z,l.points[i],l.points[(i+1)%l.points.length]);if(!q||p.distance<q.distance)q=p;}const edge=q.distance*(pointInPolygon(x,z,l.points)?-1:1);if(!best||edge<best.edge)best={...q,edge,level:l.level,id:l.id,kind:'lake'};}
 return best;
}
export function landHeight(x,z){
 // Preserve the established ground and all original buildings exactly.
 if(preservedValley(x,z))return originalGround(x,z);
 let h=baseGround(x,z)+escarpmentHeight(x,z);const water=waterSample(x,z);
 if(water){const bank=water.level+.12+Math.max(0,water.edge)*.38;if(water.edge<0)h=Math.min(h,water.level-.65-Math.min(1.6,-water.edge*.18));else if(water.edge<9)h=mix(bank,h,smooth(1,9,water.edge));}
 return h;
}
export const naturalWorld=w=>(w?.frontier?.landscapeVersion||0)>=2;
export function mapBounds(w){const b=w?.worldModel?.bounds||{};return {minX:b.minX??0,minY:b.minY??0,maxX:b.maxX??b.width??100,maxY:b.maxY??b.height??100};}
export function insideBounds(w,p,pad=0){const b=mapBounds(w);return p.x>=b.minX+pad&&p.x<=b.maxX-pad&&p.y>=b.minY+pad&&p.y<=b.maxY-pad;}
export function naturalWaypoints(a,b){
 const points=[];for(const lake of LAKES){const near=segmentProjection(lake.x,lake.z,[a.x,a.y],[b.x,b.y]);if(near.distance>Math.max(lake.rx,lake.rz)+12)continue;for(let i=0;i<lake.points.length;i+=8){const [x,z]=lake.points[i],dx=x-lake.x,dz=z-lake.z,len=Math.hypot(dx,dz);points.push({x:x+dx/len*2,y:z+dz/len*2});}}
 if(Math.min(a.x,b.x)<-187&&Math.max(a.x,b.x)>-285&&Math.min(a.y,b.y)<-211&&Math.max(a.y,b.y)>-260)points.push({x:-287,y:-212},{x:-183,y:-215});
 return points;
}

export function naturalStructureBase(p){const water=p.spansWater||p.purpose==='bridge'?waterSample(p.position.x,p.position.y):null;return water?water.level+.44:landHeight(p.position.x,p.position.y);}
