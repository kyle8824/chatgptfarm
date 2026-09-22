export {LiveValley} from '../realtime/worker.mjs';
import {DurableObject} from 'cloudflare:workers';
import {WorldController} from './world.mjs';
import {BUILD_INFO} from './build-info.mjs';
import {unavailableResponse} from './failure.mjs';
const json=(data,status=200)=>Response.json(data,{status,headers:{
  'Cache-Control':'no-store',
  // Both viewers read public state. Administrative POSTs require the key.
  'Access-Control-Allow-Origin':'*'
}});
export class FarmWorld extends DurableObject {
  constructor(ctx,env){super(ctx,env);this.world=new WorldController(ctx.storage,env);this.env=env;}
  async alarm(){try{await this.world.alarm();}catch(e){if(this.env.ORIGINAL_WORLD_ARCHIVED==='true'){console.error('Original archive save deferred',e.message);return;}throw e;}}
  async fetch(request){
    const path=new URL(request.url).pathname;
    try{
      // Internal binding route only; the public Worker does not forward it.
      if(request.method==='POST'&&path==='/runtime-recover'){await this.world.recover();return json({ok:true});}
      if(request.method==='GET'&&path==='/evidence'){
        if(!this.env.ADMIN_KEY||request.headers.get('Authorization')!==`Bearer ${this.env.ADMIN_KEY}`)return json({error:'Unauthorized'},401);
        const tick=Number(new URL(request.url).searchParams.get('tick'));
        if(!Number.isSafeInteger(tick)||tick<1)return json({error:'Invalid tick'},400);
        const evidence=await this.world.evidence(tick);
        return evidence?json(evidence):json({error:'No completed evidence for this tick'},404);
      }
      if(request.method==='GET'&&path==='/health')return json({...await this.world.health(),archivedByDeployment:this.env.ORIGINAL_WORLD_ARCHIVED==='true',build:BUILD_INFO});
      if(request.method==='GET'&&path==='/state'){
        const state=await this.world.snapshot();
        if(state)state.runtime.build=BUILD_INFO;
        return state?json(state):json({error:'Open /setup.html to initialize the preview'},503);
      }
      if(request.method!=='POST'||!['/start','/pause','/resume'].includes(path))return json({error:'Not found'},404);
      if(!this.env.ADMIN_KEY||request.headers.get('Authorization')!==`Bearer ${this.env.ADMIN_KEY}`)return json({error:'Incorrect setup password'},401);
      if(this.env.ORIGINAL_WORLD_ARCHIVED==='true'&&['/start','/resume'].includes(path))return json({error:'The original world is archived. The public world is available at /live/.'},409);
      if(path==='/pause')return json(await this.world.pause());
      if(path==='/resume')return json(await this.world.resume());
      if((await this.world.health()).initialized)return json({error:'Already initialized; existing history preserved'},409);
      const response=await fetch('https://raw.githubusercontent.com/kyle8824/chatgptfarm/main/world/state.json', {cache:'no-store',signal:AbortSignal.timeout(10000)});
      if(!response.ok)throw Error('Could not read the saved GitHub world');
      return json(await this.world.initialize(await response.json()));
    }catch(error){console.error('Farm runtime:',error.message);return unavailableResponse(error,{diagnostic:path==='/health',build:BUILD_INFO});}
  }
}
export default {
  async scheduled(event,env,ctx){ctx.waitUntil(Promise.allSettled([
    env.LIVE_VALLEY.getByName('live-valley-v1').fetch('https://internal/live/health'),
    env.WORLD.getByName('preview-v1').fetch('https://internal/runtime-recover',{method:'POST'})
  ]).then(results=>{for(const result of results)if(result.status==='rejected'||!result.value.ok)console.error('Scheduled world recovery deferred');}));},
  async fetch(request,env){
    const path=new URL(request.url).pathname;
    if(['/live/ws','/live/state','/live/health','/live/geometry'].includes(path)){try{return await env.LIVE_VALLEY.getByName('live-valley-v1').fetch(request);}catch(e){return unavailableResponse(e,{diagnostic:path==='/live/health',build:BUILD_INFO});}}
    if(path==='/live')return Response.redirect(new URL('/live/',request.url),302);
    if(['/state','/health','/evidence','/start','/pause','/resume'].includes(path)){
      try{return await env.WORLD.getByName('preview-v1').fetch(request);}catch(e){return unavailableResponse(e,{diagnostic:path==='/health',build:BUILD_INFO});}
    }
    return env.ASSETS.fetch(request);
  }
};
