// Shared by the live renderer and its collision/interaction geometry.
export const CAMP={shelter:{x:66,y:35,rotation:-.22,halfWidth:1.95,halfLength:1.7},fire:{x:63,y:33,radius:1.15}};
export function shelterPoint(x,y){const s=CAMP.shelter,c=Math.cos(s.rotation),n=Math.sin(s.rotation);return {x:s.x+c*x+n*y,y:s.y-n*x+c*y};}
export function shelterLocal(p){const s=CAMP.shelter,c=Math.cos(s.rotation),n=Math.sin(s.rotation),x=p.x-s.x,y=p.y-s.y;return {x:c*x-n*y,y:n*x+c*y};}
