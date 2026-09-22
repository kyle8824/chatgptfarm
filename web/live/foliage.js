import * as T from 'three';
export function crownGeometry(){const geometry=new T.SphereGeometry(1,20,14),p=geometry.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),r=1+Math.sin(x*4+y*3)*.045+Math.sin(z*5-x*2)*.04;p.setXYZ(i,x*r,y*r,z*r);}geometry.computeVertexNormals();return geometry;}
export function pineGeometry(){return new T.LatheGeometry([[0,0],[.48,.025],[.85,.07],[1,.14],[.93,.23],[.75,.4],[.54,.64],[.3,.92],[.08,1.19],[0,1.27]].map(([x,y])=>new T.Vector2(x,y)),20);}
export function foliageMaterial(color,target){
 const material=new T.MeshStandardMaterial({color,roughness:1,alphaHash:true});
 // Dither only leaves that crowd the camera or hide its viewing location.
 // The forest remains batched; this does not add per-tree draw calls.
 material.onBeforeCompile=shader=>{
  shader.uniforms.valleyFocus={value:target};
  shader.vertexShader='varying vec3 canopyPosition;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\ncanopyPosition=(modelMatrix*vec4(transformed,1.0)).xyz;');
  shader.fragmentShader='varying vec3 canopyPosition;\nuniform vec3 valleyFocus;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <alphahash_fragment>',`
   vec3 sight=valleyFocus-cameraPosition;
   float along=dot(canopyPosition-cameraPosition,sight)/max(dot(sight,sight),0.01);
   float radial=length(canopyPosition-(cameraPosition+sight*clamp(along,0.0,1.0)));
   float corridor=mix(0.10,1.0,smoothstep(0.7,2.0,radial));
   if(along<=0.0||along>=0.96)corridor=1.0;
   diffuseColor.a*=min(smoothstep(1.2,4.0,distance(canopyPosition,cameraPosition)),corridor);
   #include <alphahash_fragment>`);
 };
 material.customProgramCacheKey=()=> 'valley-foliage-visibility-1';return material;
}
