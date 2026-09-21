export {LiveValley} from '../realtime/worker.mjs';
import {DurableObject} from 'cloudflare:workers';
import {WorldController} from './world.mjs';
import {BUILD_INFO} from './build-info.mjs';
const json=(data,status=200)=>Response.json(data,{status,headers:{
  'Cache-Control':'no-store',
  // The public site remains on Vercel during the domain migration and reads
  // this public spectator state. Administrative POSTs still require the key.
  'Access-Control-Allow-Origin':'*'
}});
export class FarmWorld extends DurableObject {
  constructor(ctx,env){super(ctx,env);this.world=new WorldController(ctx.storage,env);this.env=env;}
  async alarm(){await this.world.alarm();}
  async fetch(request){
    const path=new URL(request.url).pathname;
    try{
      if(request.method==='GET'&&path==='/evidence'){
        if(!this.env.ADMIN_KEY||request.headers.get('Authorization')!==`Bearer ${this.env.ADMIN_KEY}`)return json({error:'Unauthorized'},401);
        const tick=Number(new URL(request.url).searchParams.get('tick'));
        if(!Number.isSafeInteger(tick)||tick<1)return json({error:'Invalid tick'},400);
        const evidence=await this.world.evidence(tick);
        return evidence?json(evidence):json({error:'No completed evidence for this tick'},404);
      }
      if(request.method==='GET'&&path==='/health')return json({...await this.world.health(),build:BUILD_INFO});
      if(request.method==='GET'&&path==='/state'){
        const state=await this.world.snapshot();
        if(state)state.runtime.build=BUILD_INFO;
        return state?json(state):json({error:'Open /setup.html to initialize the preview'},503);
      }
      if(request.method!=='POST'||!['/start','/pause','/resume'].includes(path))return json({error:'Not found'},404);
      if(!this.env.ADMIN_KEY||request.headers.get('Authorization')!==`Bearer ${this.env.ADMIN_KEY}`)return json({error:'Incorrect setup password'},401);
      if(path==='/pause')return json(await this.world.pause());
      if(path==='/resume')return json(await this.world.resume());
      if((await this.world.health()).initialized)return json({error:'Already initialized; existing history preserved'},409);
      const response=await fetch('https://raw.githubusercontent.com/kyle8824/chatgptfarm/main/world/state.json', {cache:'no-store',signal:AbortSignal.timeout(10000)});
      if(!response.ok)throw Error('Could not read the saved GitHub world');
      return json(await this.world.initialize(await response.json()));
    }catch(error){console.error('Farm runtime:',error.message);return json({error:'World operation failed; saved state retained. Check Worker logs.'},503);}
  }
}
export default {
  async fetch(request,env){
    const path=new URL(request.url).pathname;
    if(['/live/ws','/live/state','/live/health','/live/geometry'].includes(path))return env.LIVE_VALLEY.getByName('live-valley-v1').fetch(request);
    if(path==='/live')return Response.redirect(new URL('/live/',request.url),302);
    if(['/state','/health','/evidence','/start','/pause','/resume'].includes(path)){
      return env.WORLD.getByName('preview-v1').fetch(request);
    }
    return env.ASSETS.fetch(request);
  }
};
