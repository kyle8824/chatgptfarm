import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {tickWithMind} from '../engine.js';
import {createOpenAIMind} from '../mind.js';
import {Timeline} from './timeline.mjs';

// Run exactly one writer, on a persistent disk. Refuse accidental duplicate writers.
const directory=path.resolve(process.env.WORLD_DATA_DIR||'runtime-data');
await fs.mkdir(directory,{recursive:true});
const lockPath=path.join(directory,'writer.lock');
let lock;
try {lock=await fs.open(lockPath,'wx');} catch(error) {
  if(error.code!=='EEXIST')throw error;
  const pid=Number(await fs.readFile(lockPath,'utf8'));
  if(!Number.isInteger(pid)||pid<=0)throw Error('Invalid writer lock; inspect before restarting');
  try {process.kill(pid,0);throw Error('Another world writer is already running');}
  catch(e) {if(e.code!=='ESRCH')throw e;}
  await fs.unlink(lockPath);
  lock=await fs.open(lockPath,'wx');
}
await lock.writeFile(String(process.pid));
const checkpoint=path.join(directory,'checkpoint.json');
let timer,server;
async function save(record) {
  const tmp=checkpoint+'.tmp';
  const file=await fs.open(tmp,'w',0o600);
  try {await file.writeFile(JSON.stringify(record));await file.sync();} finally {await file.close();}
  await fs.rename(tmp,checkpoint);
  const dir=await fs.open(directory,'r');
  try {await dir.sync();} finally {await dir.close();}
}
async function load() {
  try {return JSON.parse(await fs.readFile(checkpoint,'utf8'));}
  catch(e) {if(e.code==='ENOENT')return null;throw e;}
}
async function close() {
  clearInterval(timer);
  server?.close();
  await lock.close();
  await fs.unlink(path.join(directory,'writer.lock'));
  process.exit(0);
}
process.on('SIGTERM',close);process.on('SIGINT',close);
try {
  const seed=JSON.parse(await fs.readFile(process.env.WORLD_SEED||'world/state.json','utf8'));
  const mind=createOpenAIMind();
  const planner=state=>tickWithMind(state,mind.enabled?mind:null);
  const world=await new Timeline({load,save,seed,planner}).init();
  // This timer runs independently of visitors or page deployments.
  timer=setInterval(()=>world.advance().catch(e=>console.error('World save failed:',e.message)),1000);
  const allowed=process.env.WORLD_ORIGIN||'https://www.chatgptfarm.com';
  server=http.createServer(async(req,res)=>{
    res.setHeader('Cache-Control','no-store');
    res.setHeader('Access-Control-Allow-Origin',allowed);
    res.setHeader('Vary','Origin');
    if(req.method!=='GET'||!['/state','/health'].includes(req.url?.split('?')[0])) {
      res.writeHead(404);res.end();return;
    }
    try {
      const state=await world.advance();
      const result=req.url.startsWith('/health')?{...state.runtime,tick:state.meta.tickNumber}:state;
      res.writeHead(state.runtime.status==='running'?200:503,{'Content-Type':'application/json'});
      res.end(JSON.stringify(result));
    } catch(e) {
      console.error('World read failed:',e.message);
      res.writeHead(503,{'Content-Type':'application/json'});
      res.end(JSON.stringify({error:'World persistence unavailable'}));
    }
  });
  server.listen(Number(process.env.PORT||8787),'0.0.0.0');
} catch(e) {
  await lock.close();await fs.unlink(path.join(directory,'writer.lock'));throw e;
}
