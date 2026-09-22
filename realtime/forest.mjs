import {riverY} from './water.mjs';
// One layout for visible trees, collision and the finite timber accounts.
export function forestLayout(){
 let seed=313;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;},trees=[];
 for(let i=0;i<410;i++){
  const x=rnd()*144-22,y=rnd()*104-12,central=x>18&&x<91&&y>12&&y<54;
  if(central&&rnd()>.045)continue;
  if(Math.abs(y-riverY(x))<3.5||Math.hypot(x-64,y-34)<9||Math.hypot(x-29,y-31)<6)continue;
  const height=3+rnd()*5.5,color=Math.floor(rnd()*5),rotation=rnd()*6.28,pine=rnd()<.7;
  trees.push({id:`tree-${i}`,position:{x,y},height,color,rotation,pine,timber:Math.ceil(height*2)});
 }
 return trees;
}
