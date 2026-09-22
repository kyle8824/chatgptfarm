import {conditionOf,activeParts} from '../structure-performance.js';
import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {normalizeStructureLook} from './structure-appearance.js';
const box=new T.BoxGeometry(1,1,1),cylinder=new T.CylinderGeometry(.5,.5,1,14),components=new Map();
function tint(g,shade){const colors=[];for(let v=0;v<g.attributes.position.count;v++){const variation=shade*(.90+(v%7)*.025);colors.push(variation,variation,variation);}g.setAttribute('color',new T.Float32BufferAttribute(colors,3));return g;}
function branch(seed=0,hewn=false){
 const g=new T.CylinderGeometry(.43,.49,1,hewn?10:9,5),p=g.attributes.position;
 for(let i=0;i<p.count;i++){const y=p.getY(i),bend=Math.sin((y+.5)*Math.PI*1.7+seed)*(hewn?.018:.10),taper=1+(Math.sin(y*13+seed)*(hewn?.02:.085));p.setXYZ(i,p.getX(i)*taper+bend,y,p.getZ(i)*taper);}
 g.computeVertexNormals();return tint(g,.78+(seed%4)*.045);
}
function componentGeometry(part){
 const finish=part.finish==='hewn'?'hewn':'rough',key=part.id+part.material+part.kind+part.size.join(',')+finish;
 if(components.has(key))return components.get(key);
 const geos=[],panel=['wall','deck','roof'].includes(part.kind),hewn=finish==='hewn';
 if((part.material==='timber'||part.material==='reeds')&&panel){
  const axis=part.kind==='wall'?(part.size[0]>part.size[2]?0:2):0;
  const count=Math.max(3,Math.min(26,Math.ceil(part.size[axis]/(part.material==='reeds'?.085:hewn?.18:.12))));
  for(let i=0;i<count;i++){
   const size=[1,1,1],offset=[0,0,0];size[axis]=1/count*.98;offset[axis]=-.5+(i+.5)/count;
   let g;
   if(hewn){g=new T.BoxGeometry(...size);g.translate(...offset);tint(g,.90+((i*7+3)%11)*.019);}
   else {g=branch(i);if(part.kind!=='wall')g.rotateX(Math.PI/2);const along=part.kind==='wall'?1:2;size[along]=.88+((i*7+2)%11)*.012;size[axis]*=.84+((i*3)%7)*.035;offset[along]=((i*5)%7-3)*.011;g.scale(...size);g.translate(...offset);}
   geos.push(g);
  }
  // Fibers lie across the rough mat; folded/joined material stays inside its envelope.
  if(!hewn)for(const t of [-.34,.34]){const g=new T.CylinderGeometry(.018,.018,1,6),sz=[1,1,1],off=[0,0,0];
   if(axis===0)g.rotateZ(Math.PI/2);else g.rotateX(Math.PI/2);
   if(part.kind==='wall'){off[1]=t;off[axis===0?2:0]=.40;sz[axis===0?2:0]=.8;}
   else{off[2]=t;off[1]=.40;}
   g.scale(...sz);g.translate(...off);geos.push(tint(g,1.35));}
 }else if(part.material==='timber'){
  const g=branch(3,hewn);if(part.kind==='beam'){if(part.size[0]>part.size[2])g.rotateZ(Math.PI/2);else g.rotateX(Math.PI/2);}geos.push(g);
 }else if(part.material==='stone'){const g=new T.IcosahedronGeometry(.58,0);geos.push(tint(g,1));}
 else {const g=box.clone();geos.push(tint(g,.95));}
 const geometry=mergeGeometries(geos);geos.forEach(g=>g.dispose());geometry.computeBoundingBox();
 // Normalize to the recorded collision/material envelope. A cosmetic edit
 // cannot expand dimensions, close gaps or upgrade a rough piece to hewn.
 const b=geometry.boundingBox,span=new T.Vector3();b.getSize(span);const center=new T.Vector3();b.getCenter(center);geometry.translate(-center.x,-center.y,-center.z);geometry.scale(1/span.x,1/span.y,1/span.z);
 components.set(key,geometry);return geometry;
}
// This is used by BOTH the world and the workshop. Geometry comes exclusively
// from physical parts. Recorded technique controls the mesh. A look affects shader inputs only.
export function createStructureModel(project,{stage='construction',appearance={},open=false}={}){
 const active=activeParts(project),group=new T.Group(),look=normalizeStructureLook(appearance),materials=new Map(),owned=[];
 const material=part=>{const wear=stage==='construction'?Math.floor(conditionOf(part)*10)/10:1,key=part.material+!!componentGeometry(part).getAttribute('color')+wear;if(materials.has(key))return materials.get(key);
  const m=new T.MeshStandardMaterial({color:look[part.material],roughness:look.roughness,vertexColors:!!componentGeometry(part).getAttribute('color')});
  if(wear<.85)m.color.lerp(new T.Color('#625e4c'),(1-wear)*.5);
  m.onBeforeCompile=shader=>{shader.uniforms.structureGrain={value:look.grain};shader.vertexShader='uniform float structureGrain;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <color_vertex>','#include <color_vertex>\n#ifdef USE_COLOR\nvColor = mix(vec3(1.0), vColor, structureGrain);\n#endif');};
  m.customProgramCacheKey=()=> 'structure-grain-v1';materials.set(key,m);owned.push(m);return m;
 };
 for(const part of project.parts){
  if(stage==='design'||part.built||part.invested){let parent=group,center=part.center;
   if(open&&part.kind==='roof'&&project.purpose==='storage'){parent=new T.Group();parent.position.set(part.center[0],part.center[1],part.center[2]-part.size[2]/2);parent.rotation.x=-1.15;group.add(parent);center=[0,0,part.size[2]/2];}
   const mesh=new T.Mesh(componentGeometry(part),material(part));mesh.position.set(...center);mesh.scale.set(...part.size);mesh.castShadow=mesh.receiveShadow=true;mesh.userData.partId=part.id;parent.add(mesh);
   if(stage==='construction'&&part.built&&!active.has(part.id)){mesh.scale.y=Math.min(.12,mesh.scale.y);mesh.position.y=.06;mesh.rotation.y=.12;mesh.rotation.z=.035;}
   if(stage==='construction'&&!part.built){mesh.scale.y*=Math.max(.08,Math.min(1,part.workMinutes/part.requiredMinutes||0));mesh.position.y=part.center[1]-part.size[1]/2+mesh.scale.y/2;}
  }
  if(stage==='construction'&&!part.built){const geometry=new T.EdgesGeometry(part.shape==='cylinder'?cylinder:box),m=new T.LineBasicMaterial({color:'#bfa868',transparent:true,opacity:.35}),line=new T.LineSegments(geometry,m);line.position.set(...part.center);line.scale.set(...part.size);group.add(line);owned.push(geometry,m);}
 }
 group.userData.disposeStructure=()=>{owned.forEach(x=>x.dispose());};return group;
}
