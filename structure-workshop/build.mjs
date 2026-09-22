import {build} from '../character-preview/node_modules/esbuild/lib/main.js';
import fs from 'node:fs/promises';
const out=new URL('../vercel-public/structure-workshop/',import.meta.url);
await fs.mkdir(out,{recursive:true});
for(const name of ['index.html','style.css'])await fs.copyFile(new URL(name,import.meta.url),new URL(name,out));
await build({entryPoints:[new URL('app.js',import.meta.url).pathname],outfile:new URL('app.js',out).pathname,nodePaths:[new URL('../character-preview/node_modules/',import.meta.url).pathname],bundle:true,minify:true,format:'esm',target:'es2022',legalComments:'eof'});
console.log('Built independent structure workshop');
