import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {build} from '../cloudflare/node_modules/esbuild/lib/main.js';
export async function buildLab(){
 const out=new URL('../cloudflare/public/live/build-lab/',import.meta.url);await fs.mkdir(out,{recursive:true});
 for(const file of ['index.html','style.css'])await fs.copyFile(new URL(file,import.meta.url),new URL(file,out));
 const commit=execFileSync('git',['rev-parse','HEAD'],{cwd:new URL('../',import.meta.url),encoding:'utf8'}).trim();
 await build({entryPoints:[new URL('app.mjs',import.meta.url).pathname],outfile:new URL('app.js',out).pathname,nodePaths:[new URL('../cloudflare/node_modules/',import.meta.url).pathname],bundle:true,minify:true,format:'esm',target:'es2022',define:{__LAB_COMMIT__:JSON.stringify(commit)},legalComments:'eof'});
 console.log('Built isolated construction lab');
}
if(process.argv[1]===new URL(import.meta.url).pathname)await buildLab();
