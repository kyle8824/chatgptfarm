// Node 22+. This program makes outbound requests only. Ollama stays on loopback.
import {pathToFileURL} from 'node:url';
const DEFAULT_FARM='https://chatgptfarm.kyle8824.workers.dev';
export function runnerConfig(env=process.env){
 const farm=new URL(env.FARM_URL||DEFAULT_FARM),ollama=new URL(env.OLLAMA_URL||'http://127.0.0.1:11434');
 if(farm.protocol!=='https:'||farm.username||farm.password||farm.search||farm.hash)throw Error('FARM_URL must be an HTTPS origin without credentials.');
 if(ollama.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(ollama.hostname)||ollama.username||ollama.password)throw Error('Ollama must remain on local loopback.');
 return {farm:farm.origin,ollama:ollama.origin,key:env.FARM_LOCAL_AI_KEY,model:env.OLLAMA_MODEL||'llama3.1:8b'};
}
export async function infer(config,payload,{fetcher=fetch,timeoutMs=75000}={}){
 const response=await fetcher(config.ollama+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:config.model,messages:payload.messages,format:payload.response_format.json_schema||'json',stream:false,keep_alive:'5m',options:{num_ctx:4096,num_predict:payload.max_tokens,temperature:payload.temperature??.5}}),signal:AbortSignal.timeout(timeoutMs)});
 if(!response.ok)throw Error(`Ollama returned ${response.status}.`);
 const result=await response.json();if(!result.done||typeof result.message?.content!=='string'||result.message.content.length>6000)throw Error('Incomplete or oversized local response.');
 if(result.model!==config.model)throw Error('Ollama returned a different model; check OLLAMA_MODEL.');
 return result.message.content;
}
async function post(config,path,body){
 const response=await fetch(config.farm+path,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${config.key}`},body:JSON.stringify(body),signal:AbortSignal.timeout(15000),redirect:'error'});
 const data=await response.json();
 if(!response.ok)throw Error(`Farm returned ${response.status}: ${data.error||'request failed'}`);
 return data;
}
export async function check(config){
 const before=performance.now(),payload={messages:[{role:'system',content:'Choose drink because hydration is critical. Return only the requested JSON.'},{role:'user',content:'Hydration 4/100. Choices: drink, explore.'}],response_format:{json_schema:{type:'object',properties:{actionId:{type:'string',enum:['drink','explore']},goal:{type:'string'},intent:{type:'string'},decisionSummary:{type:'string'}},required:['actionId','goal','intent','decisionSummary']}},max_tokens:180};
 const value=JSON.parse(await infer(config,payload));if(value.actionId!=='drink'||!['goal','intent','decisionSummary'].every(k=>typeof value[k]==='string'&&value[k].trim()))throw Error('The local model did not pass the basic structured decision check.');
 return {model:config.model,seconds:Math.round((performance.now()-before)/100)/10,structuredDecision:true};
}
async function main(){
 const config=runnerConfig();console.log('Checking local model (no farm changes)…');console.log(await check(config));
 if(process.argv.includes('--check'))return;
 if(!config.key||config.key.length<24)throw Error('Set FARM_LOCAL_AI_KEY to the dedicated LOCAL_AI_KEY configured on the farm. Never paste it in chat.');
 console.log('Local helper running. Ctrl+C stops extra thinking; cloud planning and the live world continue.');
 while(true){
  let delay=10000;
  try{
   const next=await post(config,'/live/local-ai/next',{model:config.model});delay=Math.max(10000,(next.retryAfterSeconds||10)*1000);
   if(next.job){
    const job=next.job;if(job.model!==config.model)throw Error('Job model does not match the configured local model.');
    let body;try{body={id:job.id,model:config.model,response:await infer(config,job.payload)};}catch{body={id:job.id,model:config.model,error:'local_inference_failed'};}
    const result=await post(config,'/live/local-ai/result',body);console.log(`${new Date().toLocaleTimeString()} · ${job.person} · ${result.accepted?'decision accepted':'decision declined'}`);
   }
  }catch(e){console.error(e.message);delay=30000;}
  await new Promise(resolve=>setTimeout(resolve,delay));
 }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(e=>{console.error(e.message);process.exitCode=1;});
