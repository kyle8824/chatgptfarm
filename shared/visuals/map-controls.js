import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';

// Desktop orbit/pan remains familiar. Touch gestures are one simultaneous
// similarity transform, with no exclusive rotate-vs-zoom mode or fixed pivot.
export class MapGestureControls extends OrbitControls {
 constructor(camera,element,{planeMode='ground',heightAt=null}={}){
  super(camera,element);this.touches={ONE:-1,TWO:-1};this.touchPoints=new Map();this.gesture=null;this.planeMode=planeMode;this.heightAt=heightAt;
  this.touchHandlers={pointerdown:e=>this.touchDown(e),pointermove:e=>this.touchMove(e),pointerup:e=>this.touchEnd(e),pointercancel:e=>this.touchEnd(e),lostpointercapture:e=>this.touchEnd(e)};
  for(const [name,fn]of Object.entries(this.touchHandlers))element.addEventListener(name,fn,{passive:false});
 }
 snapshot(){const p=[...this.touchPoints.values()].slice(0,2);return {x:p.reduce((s,q)=>s+q.x,0)/p.length,y:p.reduce((s,q)=>s+q.y,0)/p.length,distance:p.length===2?Math.hypot(p[1].x-p[0].x,p[1].y-p[0].y):0,angle:p.length===2?Math.atan2(p[1].y-p[0].y,p[1].x-p[0].x):0,count:p.length};}
 rayAt(p){const r=this.domElement.getBoundingClientRect(),ray=new T.Raycaster();this.object.updateMatrixWorld();ray.setFromCamera(new T.Vector2((p.x-r.left)/r.width*2-1,1-(p.y-r.top)/r.height*2),this.object);return ray.ray;}
 rebase(){
  if(!this.touchPoints.size){this.gesture=null;return;}
  const sample=this.snapshot(),ray=this.rayAt(sample),normal=this.planeMode==='screen'?this.object.getWorldDirection(new T.Vector3()):new T.Vector3(0,1,0),plane=new T.Plane().setFromNormalAndCoplanarPoint(normal,this.target),anchor=ray.intersectPlane(plane,new T.Vector3());
  if(anchor&&this.heightAt&&this.planeMode==='ground')for(let i=0;i<5;i++){plane.constant=-this.heightAt(anchor.x,anchor.z);if(!ray.intersectPlane(plane,anchor))break;}
  if(!anchor||anchor.distanceTo(this.object.position)>this.maxDistance*3){plane.setFromNormalAndCoplanarPoint(this.object.getWorldDirection(normal),this.target);ray.intersectPlane(plane,normal);}
  this.gesture={sample,plane};
 }
 touchDown(e){if(e.pointerType!=='touch'||!this.enabled)return;e.preventDefault();
  // Flush any remaining mouse damping before a finger establishes its anchor.
  if(!this.touchPoints.size){const damping=this.enableDamping;this.enableDamping=false;this.update();this.enableDamping=damping;this.dispatchEvent({type:'start'});}
  this.touchPoints.set(e.pointerId,{x:e.clientX,y:e.clientY});this.domElement.setPointerCapture(e.pointerId);this.rebase();
 }
 touchMove(e){if(!this.touchPoints.has(e.pointerId)||!this.enabled)return;e.preventDefault();this.touchPoints.set(e.pointerId,{x:e.clientX,y:e.clientY});
  const now=this.snapshot(),old=this.gesture?.sample;if(!old||old.count!==now.count){this.rebase();return;}
  const plane=this.gesture.plane,anchor=this.rayAt(old).intersectPlane(plane,new T.Vector3());if(!anchor){this.rebase();return;}
  if(now.count===2&&old.distance>8&&now.distance>8){
   const distance=this.object.position.distanceTo(this.target),scale=this.enableZoom?T.MathUtils.clamp(distance*old.distance/now.distance,this.minDistance,this.maxDistance)/distance:1;
   const yaw=this.enableRotate?-Math.atan2(Math.sin(now.angle-old.angle),Math.cos(now.angle-old.angle)):0,q=new T.Quaternion().setFromAxisAngle(this.object.up,yaw);
   for(const p of [this.object.position,this.target])p.sub(anchor).multiplyScalar(scale).applyQuaternion(q).add(anchor);
   this.object.lookAt(this.target);this.object.updateMatrixWorld();
  }
  const under=this.rayAt(now).intersectPlane(plane,new T.Vector3());if(under&&this.enablePan){const shift=anchor.clone().sub(under);this.object.position.add(shift);this.target.add(shift);}
  this.update();this.gesture.sample=now;
 }
 touchEnd(e){if(!this.touchPoints.has(e.pointerId))return;this.touchPoints.delete(e.pointerId);this.rebase();if(!this.touchPoints.size)this.dispatchEvent({type:'end'});}
 dispose(){for(const [name,fn]of Object.entries(this.touchHandlers||{}))this.domElement.removeEventListener(name,fn);super.dispose();}
}
