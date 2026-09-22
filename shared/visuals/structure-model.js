import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {normalizeStructureLook} from './structure-appearance.js';
const box=new T.BoxGeometry(1,1,1),cylinder=new T.CylinderGeometry(.5,.5,1,14),components=new Map();
function componentGeometry(part){
 if(part.shape==='cylinder')return cylinder;
 if(part.material!=='timber'||!['wall','deck','roof'].includes(part.kind))return box;
 const key=part.kind+part.size.join(',');if(components.has(key))return components.get(key);
 const axis=part.kind==='wall'?(part.size[0]>part.size[2]?0:2):0,count=Math.max(2,Math.min(18,Math.ceil(part.size[axis]/.2))),geos=[];
 for(let i=0;i<count;i++){const size=[1,1,1],offset=[0,0,0];size[axis]=1/count-.007/part.size[axis];offset[axis]=-.5+(i+.5)/count;const g=new T.BoxGeometry(...size);g.translate(...offset);const colors=[],shade=.90+((i*7+3)%11)*.019;for(let v=0;v<g.attributes.position.count;v++)colors.push(shade,shade,shade);g.setAttribute('color',new T.Float32BufferAttribute(colors,3));geos.push(g);}
 const geometry=mergeGeometries(geos);geos.forEach(g=>g.dispose());components.set(key,geometry);return geometry;
}
// This is used by BOTH the world and the workshop. Geometry comes exclusively
// from physical parts. A look affects shader inputs, never geometry or state.
export function createStructureModel(project,{stage='construction',appearance={},open=false}={}){
 const group=new T.Group(),look=normalizeStructureLook(appearance),materials=new Map(),owned=[];
 const material=part=>{const key=part.material+!!componentGeometry(part).getAttribute('color');if(materials.has(key))return materials.get(key);
  const m=new T.MeshStandardMaterial({color:look[part.material],roughness:look.roughness,vertexColors:!!componentGeometry(part).getAttribute('color')});
  m.onBeforeCompile=shader=>{shader.uniforms.structureGrain={value:look.grain};shader.vertexShader='uniform float structureGrain;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <color_vertex>','#include <color_vertex>\n#ifdef USE_COLOR\nvColor = mix(vec3(1.0), vColor, structureGrain);\n#endif');};
  m.customProgramCacheKey=()=> 'structure-grain-v1';materials.set(key,m);owned.push(m);return m;
 };
 for(const part of project.parts){
  if(stage==='design'||part.built||part.invested){let parent=group,center=part.center;
   if(open&&part.kind==='roof'&&project.purpose==='storage'){parent=new T.Group();parent.position.set(part.center[0],part.center[1],part.center[2]-part.size[2]/2);parent.rotation.x=-1.15;group.add(parent);center=[0,0,part.size[2]/2];}
   const mesh=new T.Mesh(componentGeometry(part),material(part));mesh.position.set(...center);mesh.scale.set(...part.size);mesh.castShadow=mesh.receiveShadow=true;mesh.userData.partId=part.id;parent.add(mesh);
   if(stage==='construction'&&!part.built){mesh.scale.y*=Math.max(.08,Math.min(1,part.workMinutes/part.requiredMinutes||0));mesh.position.y=part.center[1]-part.size[1]/2+mesh.scale.y/2;}
  }
  if(stage==='construction'&&!part.built){const geometry=new T.EdgesGeometry(part.shape==='cylinder'?cylinder:box),m=new T.LineBasicMaterial({color:'#bfa868',transparent:true,opacity:.35}),line=new T.LineSegments(geometry,m);line.position.set(...part.center);line.scale.set(...part.size);group.add(line);owned.push(geometry,m);}
 }
 group.userData.disposeStructure=()=>{owned.forEach(x=>x.dispose());};return group;
}
