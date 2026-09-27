import {promptFor} from './core.mjs';
import {runProvider} from '../realtime/providers.mjs';

const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const positive=(value,fallback)=>Number.isFinite(Number(value))&&Number(value)>0?Number(value):fallback;
export class BuildLabService{
 constructor(storage,env,{now=Date.now,provider=runProvider}={}){this.storage=storage;this.env=env;this.now=now;this.provider=provider;this.queue=Promise.resolve();}
 config(){return {dailyUsd:Math.min(.10,positive(this.env.BUILD_LAB_DAILY_USD,.10)),dailyCalls:Math.min(12,Math.floor(positive(this.env.BUILD_LAB_DAILY_CALLS,12))),model:this.env.OPENAI_MODEL||null,inputRate:positive(this.env.OPENAI_INPUT_USD_PER_MILLION,0),outputRate:positive(this.env.OPENAI_OUTPUT_USD_PER_MILLION,0)};}
 async ledger(){
  const date=new Date(this.now()).toISOString().slice(0,10);let d=await this.storage.get('budget');
  if(!d||d.date!==date){if(d)for(const id of Object.keys(d.requests||{}))await this.storage.delete('result:'+id);d={date,reservedUsd:0,reportedUsd:0,calls:0,requests:{},priceMismatch:false};}
  return d;
 }
 async status(){const d=await this.ledger(),c=this.config();return {...c,date:d.date,calls:d.calls,reservedUsd:d.reservedUsd,reportedUsd:d.reportedUsd,priceMismatch:d.priceMismatch,
  configured:!!(this.env.OPENAI_API_KEY&&c.model&&c.inputRate&&c.outputRate),provider:'openai',cloudflareAiUsed:false,resetAt:Date.parse(d.date)+86400000};}
 fetch(request){
  if(!this.env.ADMIN_KEY||request.headers.get('Authorization')!==`Bearer ${this.env.ADMIN_KEY}`)return Promise.resolve(reply({error:'Enter the existing farm owner key to run AI experiments.'},401));
  const work=this.queue.then(()=>this.handle(request));this.queue=work.catch(()=>{});return work.catch(()=>reply({error:'The lab could not safely record this request. No automatic retry was made.'},503));
 }
 async handle(request){
  const path=new URL(request.url).pathname;
  if(request.method==='GET'&&path.endsWith('/status'))return reply(await this.status());
  if(request.method!=='POST'||!path.endsWith('/design'))return reply({error:'Method or route unavailable'},405);
  // Bound the request before parsing it. Credentials stay in request headers.
  let length=0,chunks=[];if(!request.body)return reply({error:'JSON body required'},400);
  for await(const chunk of request.body){length+=chunk.byteLength;if(length>90000)return reply({error:'Experiment context is too large (90 KB maximum).'},413);chunks.push(chunk);}
  let input;try{const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}input=JSON.parse(new TextDecoder().decode(bytes));}catch{return reply({error:'Invalid experiment JSON'},400);}
  if(!/^[a-zA-Z0-9-]{16,80}$/.test(input.requestId||'')||!['baseline','context'].includes(input.variant)||typeof input.context!=='object'||!input.context||Array.isArray(input.context)||typeof(input.instruction??'')!=='string'||(input.instruction||'').length>1500)return reply({error:'Invalid experiment request'},400);
  const c=this.config();if(!this.env.OPENAI_API_KEY||!c.model||!c.inputRate||!c.outputRate)return reply({error:'The lab AI provider is not configured.'},503);
  const payload={messages:[{role:'system',content:promptFor(input.variant,input.instruction||'')},{role:'user',content:JSON.stringify(input.context)}],max_tokens:3500,response_format:{type:'json_object'}};
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(payload))))).map(n=>n.toString(16).padStart(2,'0')).join('');
  const d=await this.ledger(),prior=d.requests[input.requestId];
  if(prior){if(prior.hash!==hash)return reply({error:'A request ID cannot be reused for a different experiment.'},409);const result=await this.storage.get('result:'+input.requestId);return result?reply({...result,reused:true},result.ok?200:502):reply({error:'This request was already reserved; its outcome is uncertain. It will not be sent again.',budget:await this.status()},409);}
  const inputBound=new TextEncoder().encode(JSON.stringify(payload)).length+4096,reservation=(inputBound*c.inputRate+payload.max_tokens*c.outputRate)/1e6;
  if(d.priceMismatch||d.calls>=c.dailyCalls||d.reservedUsd+reservation>c.dailyUsd)return reply({error:'The lab has reached its protected daily budget. Local experiments remain available.',budget:await this.status()},429);
  if(d.lastCallAt&&this.now()-d.lastCallAt<15000)return reply({error:'Wait 15 seconds between AI requests.'},429);
  d.calls++;d.reservedUsd+=reservation;d.lastCallAt=this.now();d.requests[input.requestId]={hash,reservation,at:this.now()};
  await this.storage.put('budget',d); // Durable reservation BEFORE any paid call.
  let result;
  try{
   const response=await this.provider({provider:'openai',model:c.model},payload,{env:this.env});
   const usage=response.usage||{},tokensIn=usage.input_tokens??usage.prompt_tokens,tokensOut=usage.output_tokens??usage.completion_tokens;
   if(Number.isFinite(tokensIn)&&tokensIn>=0&&Number.isFinite(tokensOut)&&tokensOut>=0){const cost=(tokensIn*c.inputRate+tokensOut*c.outputRate)/1e6;d.reportedUsd+=cost;d.reservedUsd+=cost-reservation;if(tokensIn>inputBound||tokensOut>payload.max_tokens||cost>reservation)d.priceMismatch=true;}
   let proposal;try{proposal=JSON.parse(response.response);}catch{throw Error('The model returned invalid JSON. The attempt is recorded and will not be retried automatically.');}
   if(typeof proposal?.build!=='boolean'||proposal.build&&(typeof proposal.code!=='string'||proposal.code.length>14000))throw Error('The model returned an invalid construction response. The attempt is recorded.');
   result={ok:true,proposal,model:c.model,variant:input.variant,requestId:input.requestId,responseId:response.id||null,usage:{inputTokens:tokensIn??null,outputTokens:tokensOut??null},at:this.now()};
  }catch(e){result={ok:false,error:/^openai_http_\d+$/.test(e.message)?'The AI provider returned '+e.message.replace('openai_http_','HTTP ')+'.':e.message==='openai_incomplete_response'?'The model did not finish within the output budget.':'AI generation failed or was incomplete. Its budget reservation is retained; there is no automatic retry.',requestId:input.requestId,at:this.now()};}
  // If response persistence fails, the reservation still protects the cap.
  await this.storage.put('budget',d);result.budget=await this.status();await this.storage.put('result:'+input.requestId,result);return reply(result,result.ok?200:502);
 }
}
