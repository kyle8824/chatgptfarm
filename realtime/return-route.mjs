import {distance} from '../engine/navigation.js';
import {liveClear,liveWalkable} from './motion.mjs';

// Long journeys cannot use an unbounded visibility graph. Keep this search
// inside the saved task and spend at most 20 node expansions per physics step.
// Every edge still checks the same water, slope, structure and trunk physics.
export const RETURN_ROUTE_EXPANSIONS=20;
export const RETURN_ROUTE_LIMIT=4096;
const GRID=2.5;
function push(heap,item){heap.push(item);let i=heap.length-1;while(i){const p=(i-1)>>1;if(heap[p].score<=item.score)break;heap[i]=heap[p];i=p;}heap[i]=item;}
function pop(heap){const first=heap[0],last=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let c=i*2+1;if(c+1<heap.length&&heap[c+1].score<heap[c].score)c++;if(heap[c].score>=last.score)break;heap[i]=heap[c];i=c;}heap[i]=last;}return first;}
export function beginReturnRoute(from,goal,{arrivalRadius=8}={}){return {origin:{...from},goal:{...goal},arrivalRadius,nodes:{'0,0':{x:0,y:0,p:{...from},g:0}},open:[{key:'0,0',score:distance(from,goal)}],expanded:0};}
export function advanceReturnRoute(w,a,search,{maxExpansions=RETURN_ROUTE_EXPANSIONS}={}){
 const radius=search.arrivalRadius??8;
 let expanded=0;
 while(search.open.length&&expanded<Math.min(RETURN_ROUTE_EXPANSIONS,maxExpansions)&&search.expanded<RETURN_ROUTE_LIMIT){
  const {key}=pop(search.open),node=search.nodes[key];if(node.closed)continue;
  node.closed=true;expanded++;search.expanded++;
  if(distance(node.p,search.goal)<=radius){const path=[];let n=node;while(n){path.unshift(n.p);n=search.nodes[n.previous];}return {path,expanded};}
  for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
   const x=node.x+dx,y=node.y+dy,k=`${x},${y}`,old=search.nodes[k],p={x:search.origin.x+x*GRID,y:search.origin.y+y*GRID},g=node.g+GRID*Math.hypot(dx,dy);
   if(old?.closed||old&&old.g<=g||!liveWalkable(w,p,a)||!liveClear(w,node.p,p,a))continue;
   search.nodes[k]={x,y,p,g,previous:key};push(search.open,{key:k,score:g+Math.max(0,distance(p,search.goal)-radius)});
  }
 }
 return {blocked:!search.open.length||search.expanded>=RETURN_ROUTE_LIMIT,expanded};
}
