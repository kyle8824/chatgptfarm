import {DurableObject} from 'cloudflare:workers';
import {BuildLabService} from './service.mjs';
export class BuildLab extends DurableObject{
 constructor(ctx,env){super(ctx,env);this.service=new BuildLabService(ctx.storage,env);}
 fetch(request){return this.service.fetch(request);}
}
