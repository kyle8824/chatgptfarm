// Shared by renderer, collision geometry and physical interactions.
import {campLayout} from '../shared/frontier.js';
export const CAMP=campLayout();
export function shelterPoint(x,y,w=null,h=null){const s=campLayout(w,h).shelter,c=Math.cos(s.rotation),n=Math.sin(s.rotation);return {x:s.x+c*x+n*y,y:s.y-n*x+c*y};}
export function shelterLocal(p,w=null,h=null){const s=campLayout(w,h).shelter,c=Math.cos(s.rotation),n=Math.sin(s.rotation),x=p.x-s.x,y=p.y-s.y;return {x:c*x-n*y,y:n*x+c*y};}
