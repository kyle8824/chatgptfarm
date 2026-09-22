// Interaction points come from the same authoritative creek polyline used by
// navigation. A location label alone never grants access to drinking water.
export const CREEK_POINTS=[[0,17.5],[12,19.2],[27,17.4],[43,19.6],[58,18.2],[72,19.4],[86,19.1],[100,21.2]];
export const CREEK_HALF_WIDTH=1.25;
export function riverY(x){for(let i=1;i<CREEK_POINTS.length;i++)if(x<=CREEK_POINTS[i][0]){const [ax,ay]=CREEK_POINTS[i-1],[bx,by]=CREEK_POINTS[i];return ay+(by-ay)*(x-ax)/(bx-ax);}return CREEK_POINTS.at(-1)[1];}
function segments(w){const result=[];for(const o of w.worldModel.objects){if(o.type!=='creek_segment'||o.state?.active===false||o.state?.potable===false)continue;const points=o.geometry?.points||[];for(let i=1;i<points.length;i++){const [x,y]=points[i-1],[bx,by]=points[i],dx=bx-x,dy=by-y,length=Math.hypot(dx,dy);if(length)result.push({x,y,dx,dy,length,halfWidth:(o.geometry.widthM||5)/(w.worldModel.bounds.metersPerUnit||2)/2});}}return result;}
function projection(s,p){return Math.max(0,Math.min(1,((p.x-s.x)*s.dx+(p.y-s.y)*s.dy)/(s.length*s.length)));}
export function nearestWater(w,p){let best=null;for(const s of segments(w)){const t=projection(s,p),q={x:s.x+s.dx*t,y:s.y+s.dy*t},d=Math.hypot(p.x-q.x,p.y-q.y),edge=d-s.halfWidth;if(!best||edge<best.edge)best={edge,point:q};}return best;}
export function withinWaterReach(w,p){const water=nearestWater(w,p);return !!w.resources.creekWater&&!!water&&water.edge>=.34&&water.edge<=.66;}
export function waterBankPoints(w,p){const points=[];for(const s of segments(w)){const near=projection(s,p)*s.length;for(const offset of [0,-2,2,-5,5]){const t=Math.max(.02,Math.min(.98,(near+offset)/s.length));for(const side of [-1,1]){const r=(s.halfWidth+.47)*side;points.push({x:s.x+s.dx*t-s.dy/s.length*r,y:s.y+s.dy*t+s.dx/s.length*r});}}}return points;}
