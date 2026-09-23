import {partBounds} from './structures.mjs';
import {restSurfaces} from './rest-surfaces.mjs';
export function coversRectangle(rectangles,target){
 const xs=[target.minX,target.maxX,...rectangles.flatMap(r=>[Math.max(target.minX,Math.min(target.maxX,r.minX)),Math.max(target.minX,Math.min(target.maxX,r.maxX))])].sort((a,b)=>a-b);
 for(let i=1;i<xs.length;i++){if(xs[i]-xs[i-1]<.001)continue;const x=(xs[i]+xs[i-1])/2,spans=rectangles.filter(r=>r.minX<=x&&r.maxX>=x).sort((a,b)=>a.minZ-b.minZ);let end=target.minZ;for(const r of spans){if(r.minZ>end+.04)break;end=Math.max(end,r.maxZ);}if(end<target.maxZ-.04)return false;}return true;
}
// Names and claimed purposes confer nothing. Functions follow measured surfaces.
export function inferAffordances(p){
 const roofs=p.parts.filter(x=>x.kind==='roof'&&x.size[1]<=.45).map(x=>({...partBounds(p,x),material:x.material}));
 const floors=p.parts.filter(x=>x.kind==='deck'&&x.material!=='reeds'&&x.size[1]<=.45).map(x=>partBounds(p,x));
 const labels=[],out={rainCover:roofs,walkableDecks:[],storage:null,restPoints:[]};
 if(roofs.length)labels.push('Rain cover');
 for(const r of roofs)if(r.bottom-Math.max(0,...floors.filter(f=>f.minX<=(r.minX+r.maxX)/2&&f.maxX>=(r.minX+r.maxX)/2&&f.minZ<=(r.minZ+r.maxZ)/2&&f.maxZ>=(r.minZ+r.maxZ)/2).map(f=>f.top))>=1.35&&r.maxX-r.minX>=1.1&&r.maxZ-r.minZ>=1.1)out.restPoints.push({x:(r.minX+r.maxX)/2,y:(r.minZ+r.maxZ)/2});
 if(p.spansWater)out.walkableDecks=p.parts.filter(x=>x.kind==='deck'&&x.size[0]>=1.1&&x.size[1]<=.45&&partBounds(p,x).top<=.65).map(x=>x.id);
 if(out.walkableDecks.length)labels.push('Walkable deck sections');
 if(!p.spansWater){
  for(const base of floors.filter(f=>f.top<=1.5)){
   const panels=floors.filter(f=>Math.abs(f.top-base.top)<.05),r={minX:Math.min(...panels.map(f=>f.minX)),maxX:Math.max(...panels.map(f=>f.maxX)),minZ:Math.min(...panels.map(f=>f.minZ)),maxZ:Math.max(...panels.map(f=>f.maxZ))};
   if(!coversRectangle(panels,r))continue;
   const area=(r.maxX-r.minX)*(r.maxZ-r.minZ);if(area<.35)continue;
   const walls=p.parts.filter(x=>x.kind==='wall').map(x=>({...partBounds(p,x),material:x.material}));
   const sides=new Map();for(const wall of walls){if(wall.bottom>base.top+.16||wall.top<base.top+.3)continue;
    if(wall.maxZ-wall.minZ>=(r.maxZ-r.minZ)*.9&&wall.maxX-wall.minX<=.3){if(Math.abs(wall.minX-r.minX)<.2)sides.set('left',wall);if(Math.abs(wall.maxX-r.maxX)<.2)sides.set('right',wall);}
    if(wall.maxX-wall.minX>=(r.maxX-r.minX)*.9&&wall.maxZ-wall.minZ<=.3){if(Math.abs(wall.minZ-r.minZ)<.2)sides.set('back',wall);if(Math.abs(wall.maxZ-r.maxZ)<.2)sides.set('front',wall);}
   }
   const enclosed=sides.size>=3,wallHeight=enclosed?Math.min(...[...sides.values()].map(s=>s.top))-base.top:.55;
   const cover=roofs.filter(r=>r.bottom>=base.top+wallHeight-.16),covered=coversRectangle(cover,r),secured=sides.size===4&&covered&&[...sides.values()].every(s=>['timber','stone'].includes(s.material))&&cover.every(s=>s.material==='timber');
   const volume=Math.min(100,Math.floor(area*(enclosed?wallHeight*35:18))),mass=Math.min(90,volume*(enclosed?1.1:.9));
   if(volume<8||out.storage&&out.storage.capacityVolume>=volume)continue;
   out.storage={position:{x:(r.minX+r.maxX)/2,y:(r.minZ+r.maxZ)/2},capacityKg:mass,capacityVolume:volume,covered,secured,enclosed,baseHeight:base.top+.04,radius:Math.max(r.maxX-r.minX,r.maxZ-r.minZ)/2};
  }
 }
 out.restSurfaces=restSurfaces(p,{planned:true});
 // A supported bedding layer reserves its footprint for people rather than
 // turning into an automatic cargo container when the project completes.
 if(out.storage&&!out.storage.enclosed&&out.restSurfaces.some(s=>s.soft))out.storage=null;
 if(out.restSurfaces.some(s=>s.posture==='lie'))labels.push('Supported lying surface');
 if(out.restSurfaces.some(s=>s.posture==='seat'))labels.push('Supported seat');
 if(out.storage)labels.push(out.storage.secured?'Secured supplies':out.storage.covered?'Covered supply surface':'Open supply surface');
 if(out.restPoints.length)labels.push('Potential sheltered rest');out.labels=labels;return out;
}
