import {build} from 'esbuild';
import fs from 'node:fs/promises';
const out=new URL('../vercel-public/character-preview/',import.meta.url);
await fs.mkdir(out,{recursive:true});
for(const name of ['index.html','style.css'])await fs.copyFile(new URL(name,import.meta.url),new URL(name,out));
await build({entryPoints:[new URL('viewer.js',import.meta.url).pathname],outfile:new URL('viewer.js',out).pathname,bundle:true,minify:true,format:'esm',target:'es2022',legalComments:'eof'});
console.log('Built independent character preview');
