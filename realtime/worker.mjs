import {DurableObject} from 'cloudflare:workers';
import {RealtimeController} from './world.mjs';
const json=data=>Response.json(data,{headers:{'Cache-Control':'no-store'}});
export class LiveValley extends DurableObject{
 constructor(ctx,env){super(ctx,env);this.env=env;this.clients=new Set();this.controller=new RealtimeController(ctx.storage,{ai:env.AI||null});ctx.blockConcurrencyWhile(async()=>{if(await this.controller.load())this.startLoop();});}
 startLoop(){if(this.timer)return;this.timer=setInterval(()=>{if(this.busy)return;this.busy=true;this.controller.pulse(this.clients.size).then(()=>{this.broadcast();void this.controller.requestDecisions();}).catch(e=>console.error('Live world pulse',e.message)).finally(()=>this.busy=false);},100);}
 async initialize(){if(await this.controller.load())return;const response=await this.env.WORLD.getByName('preview-v1').fetch('https://original/state');if(!response.ok)throw Error('Original world unavailable; fork was not initialized');const seed=await response.json();
  const bytes=new Uint8Array(await new Response(new Blob([JSON.stringify(seed)]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
  await this.ctx.storage.transaction(async tx=>{for(let i=0;i<bytes.length;i+=64000)await tx.put(`origin:${i/64000}`,bytes.slice(i,i+64000));await tx.put('origin:manifest',{bytes:bytes.length,chunks:Math.ceil(bytes.length/64000),sourceTick:seed.meta.tickNumber,at:Date.now()});});
  await this.controller.initialize(seed);this.startLoop();
 }
 async alarm(){await this.controller.alarm(this.clients.size);this.startLoop();this.broadcast();void this.controller.requestDecisions();}
 broadcast(){if(!this.clients.size)return;const text=JSON.stringify(this.controller.frame(this.clients.size));for(const ws of this.clients){try{ws.send(text);}catch{this.clients.delete(ws);}}}
 async fetch(request){try{await this.initialize();const url=new URL(request.url),path=url.pathname;
  if(path==='/live/ws'){
   if(request.headers.get('Upgrade')?.toLowerCase()!=='websocket')return new Response('WebSocket required',{status:426});
   if(this.clients.size>=100)return new Response('Viewer capacity reached',{status:503});
   const [client,server]=Object.values(new WebSocketPair());server.accept();this.clients.add(server);
   const close=()=>this.clients.delete(server);server.addEventListener('close',close);server.addEventListener('error',close);
   server.addEventListener('message',e=>{if(typeof e.data==='string'&&e.data.length<100){try{const m=JSON.parse(e.data);if(m.type==='ping')server.send(JSON.stringify({type:'pong',sent:m.sent,serverTime:Date.now()}));}catch{}}});
   server.send(JSON.stringify(this.controller.frame(this.clients.size)));return new Response(null,{status:101,webSocket:client});
  }
  if(request.method!=='GET')return new Response('Method not allowed',{status:405});
  if(path==='/live/geometry')return json(this.controller.geometry());
  if(path==='/live/health')return json(this.controller.frame(this.clients.size).runtime);
  if(path==='/live/state')return json({...this.controller.frame(this.clients.size),constructionDrafts:Object.entries(this.controller.record.designDrafts||{}).map(([agentId,program])=>({agentId,program,validation:this.controller.record.designFailures?.[agentId]||null}))});
  return new Response('Not found',{status:404});
 }catch(e){console.error('Live world',e.message);return Response.json({error:'Live world temporarily unavailable; saved world retained.'},{status:503,headers:{'Cache-Control':'no-store'}});}}
}
