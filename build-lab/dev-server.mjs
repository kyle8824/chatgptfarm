// Local/CI verification only. Never bundled or deployed. No paid AI requests.
import http from 'node:http';
import fs from 'node:fs/promises';
import {BuildLabService} from './service.mjs';
const values=new Map(),storage={async get(k){return structuredClone(values.get(k));},async put(k,v){values.set(k,structuredClone(v));},async delete(k){values.delete(k);}};
const fixture={build:true,name:'Fixture resting surface',purpose:'Rest comfortably',rationale:'Browser integration fixture; not a real AI result.',siteId:'clearing-0',access:'private',code:"part({id:'surface',kind:'deck',material:'reeds',center:[0,.04,0],size:[1,.08,2.2],requires:[]});",problem:'Uncomfortable ground',alternatives:[{option:'Improve the resting surface',tradeoff:'Consumes material and labor'},{option:'Defer',tradeoff:'No material cost; discomfort remains'}],expectedBenefit:'Better measured resting comfort',successCheck:'Use the completed surface and measure comfort'};
const service=new BuildLabService(storage,{ADMIN_KEY:'local-lab-test-key',OPENAI_API_KEY:'fixture',OPENAI_MODEL:'fixture-provider',OPENAI_INPUT_USD_PER_MILLION:'.2',OPENAI_OUTPUT_USD_PER_MILLION:'1.2'},{provider:async()=>({response:JSON.stringify(fixture),usage:{input_tokens:1200,output_tokens:400}})});
export function startServer(port=4186){
 const server=http.createServer(async(req,res)=>{try{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname.startsWith('/live/build-lab/api/')){const chunks=[];for await(const chunk of req)chunks.push(chunk);const body=Buffer.concat(chunks);const response=await service.fetch(new Request(url,{method:req.method,headers:req.headers,...(body.length?{body}:{} )}));res.writeHead(response.status,Object.fromEntries(response.headers));res.end(await response.text());return;}
  if(url.pathname==='/'){res.writeHead(302,{Location:'/live/build-lab/'});res.end();return;}
  const relative=url.pathname==='/live/build-lab/'?'index.html':url.pathname.replace('/live/build-lab/','');
  if(!['index.html','app.js','style.css'].includes(relative)){res.writeHead(404);res.end();return;}
  const file=new URL('../cloudflare/public/live/build-lab/'+relative,import.meta.url);res.writeHead(200,{'Content-Type':relative.endsWith('.js')?'text/javascript':relative.endsWith('.css')?'text/css':'text/html'});res.end(await fs.readFile(file));
 }catch(error){console.error(error.message);res.writeHead(500);res.end('Local test server error');}});
 return new Promise(resolve=>server.listen(port,'127.0.0.1',()=>{console.log('Build lab test server: http://127.0.0.1:'+server.address().port+'/live/build-lab/');resolve(server);}));
}
if(process.argv[1]===new URL(import.meta.url).pathname)await startServer();
