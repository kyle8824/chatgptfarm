import {naturalWorld,landHeight,cliffEdge,naturalStructureBase} from '../shared/landscape.js';
import {terraceAt,terrainEdge,FRONTIER_OBSTACLES} from '../shared/frontier.js';
import {activeParts,cargoAllowance} from '../shared/structure-performance.js';
import {loadOf} from './holdings.mjs';
// Height transitions require real, supported, built treads. A purpose label
// or an unfinished plan never opens a cliff. Units are shared with geometry.
export function treadHeight(w,p,actor=null){
 let height=naturalWorld(w)?landHeight(p.x,p.y):terraceAt(p)&&w.frontier?3.2:0;
 for(const project of w.settlement?.projects||[]){if(!project.climbsTerrain&&!(naturalWorld(w)&&project.spansWater))continue;const active=activeParts(project);
  for(const part of project.parts){if(!active.has(part.id)||part.kind!=='deck'||!['timber','stone'].includes(part.material)||part.size[0]<1.1||part.size[2]<.3)continue;const[x,y,z]=part.center,[sx,sy,sz]=part.size;if(Math.abs(p.x-project.position.x-x)>sx/2-.12||Math.abs(p.y-project.position.y-z)>sz/2+.03)continue;if(actor&&loadOf(w,actor).mass>cargoAllowance(project,part))continue;height=Math.max(height,projectBase(w,project)+y+sy/2);}
 }return height;
}
export function projectBase(w,p){if(!naturalWorld(w))return 0;return naturalStructureBase(p);}
export function clearHeight(w,a,b,actor=null){
 if(naturalWorld(w)){const d=Math.hypot(b.x-a.x,b.y-a.y),n=Math.max(1,Math.ceil(d*6));let prior=treadHeight(w,a,actor);for(let i=1;i<=n;i++){const p={x:a.x+(b.x-a.x)*i/n,y:a.y+(b.y-a.y)*i/n},h=treadHeight(w,p,actor),onBuilt=w.settlement.projects.some(s=>(s.climbsTerrain||s.spansWater)&&activeParts(s).size>0&&Math.hypot(s.position.x-p.x,s.position.y-p.y)<5);if(Math.abs(h-prior)>(onBuilt?.46:.045+d/n*.65))return false;prior=h;}return true;}
 if(!w.frontier)return true;const r=FRONTIER_OBSTACLES.find(r=>r.kind==='terrace');if((Math.max(a.x,b.x)<r.minX-5||Math.min(a.x,b.x)>r.maxX+5||Math.max(a.y,b.y)<r.minY-8||Math.min(a.y,b.y)>r.maxY+5)&&!w.settlement.projects.some(p=>p.climbsTerrain))return true;
 // Sampling includes every short tread; no leap from one bank to a plateau.
 const n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)*12));let prior=treadHeight(w,a,actor);
 for(let i=1;i<=n;i++){const p={x:a.x+(b.x-a.x)*i/n,y:a.y+(b.y-a.y)*i/n},h=treadHeight(w,p,actor);if(Math.abs(h-prior)>.46)return false;prior=h;}return true;
}
export function climbingSites(w,a){if(!w.frontier)return [];const sites=[];if(naturalWorld(w)){for(const x of [-258,-239,-220]){const p={x,y:cliffEdge(x)+1.5};if(Math.hypot(a.coordinates.x-p.x,a.coordinates.y-p.y)>18)continue;sites.push({id:`natural-ascent-${x}`,position:p,width:2.8,depth:6,climbsTerrain:'fern-escarpment',heightDifference:3.2,upperEdge:-1.5,purposes:['ascent']});}return sites;}
 const r=terraceAt({x:400,y:160});for(const x of [394,409,434]){const p={x,y:r.minY-1.5};if(Math.hypot(a.coordinates.x-p.x,a.coordinates.y-p.y)>18)continue;sites.push({id:`ascent-${x}`,position:p,width:2.8,depth:6,climbsTerrain:r.id,heightDifference:3.2,upperEdge:1.5,purposes:['ascent']});}return sites;
}
