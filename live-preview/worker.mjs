import {DurableObject} from 'cloudflare:workers';
import {LiveController} from './controller.mjs';
import seed from './seed.mjs';
export class LivePreviewWorld extends DurableObject{
 constructor(ctx,env){super(ctx,env);this.live=new LiveController(ctx.storage);this.env=env;ctx.blockConcurrencyWhile(async()=>{if(!await this.live.load())await this.live.initialize(await seed());});}
 async alarm(){await this.live.alarm();}
 async fetch(request){const path=new URL(request.url).pathname;
 if(request.method==='POST'&&path==='/event'){if(!this.env.PREVIEW_ADMIN_KEY||request.headers.get('Authorization')!==`Bearer ${this.env.PREVIEW_ADMIN_KEY}`)return new Response('Unauthorized',{status:401});await this.live.event(await request.json());}
 const w=await this.live.snapshot();return Response.json(path==='/health'?{...w.runtime,agents:w.agents.map(a=>({id:a.id,task:a.task?.id})),ai:'not_configured'}:w,{headers:{'Cache-Control':'no-store','Access-Control-Allow-Origin':'*'}});
 }
}
export default {fetch(request,env){const path=new URL(request.url).pathname;if(['/state','/health','/event'].includes(path))return env.LIVE_PREVIEW.getByName('isolated-live-lab-v1').fetch(request);return env.ASSETS.fetch(request);}};
