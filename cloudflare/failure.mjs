// Health responses expose only a bounded storage/runtime error, never a stack,
// request headers, bindings, or the saved world itself.
export function worldFailure(error,now=Date.now()){
 const detail=String(error?.message||error||'Unknown runtime error').replace(/https?:\/\/\S+/gi,'[URL]').replace(/(Bearer\s+|(?:token|password|api[_-]?key)\s*[:=]\s*)\S+/gi,'$1[redacted]').replace(/[\r\n\t]+/g,' ').slice(0,320);
 const quota=/exceeded.*(?:limit|quota|allowed|free tier)|(?:limit|quota).*exceeded|daily.*limit|too many.*(?:rows|requests)/i.test(detail);
 const daily=quota&&(/daily/i.test(detail)||/free tier/i.test(detail)&&/rows|requests|duration/i.test(detail));
 const full=/SQLITE_FULL|database or disk is full/i.test(detail);
 return {code:quota?'hosting_limit':full?'storage_full':/checkpoint|gzip|decompress/i.test(detail)?'checkpoint_unavailable':'world_unavailable',error:daily?'The world’s daily hosting allowance has been reached. It resets at 00:00 UTC.':quota?'The world’s hosting limit has been reached. The server cannot run the world right now.':full?'The world’s storage is full. The server cannot save new progress.':'The world server is temporarily unavailable.',detail,retryAfterSeconds:daily?Math.ceil((Date.UTC(new Date(now).getUTCFullYear(),new Date(now).getUTCMonth(),new Date(now).getUTCDate()+1)-now)/1000):30};
}
export function unavailableResponse(error,{diagnostic=false,build}={}){
 const failure=worldFailure(error);if(!diagnostic)delete failure.detail;
 return Response.json({...failure,...(build?{build}:{}),stateReset:false},{status:503,headers:{'Cache-Control':'no-store','Retry-After':String(failure.retryAfterSeconds),'Access-Control-Allow-Origin':'*'}});
}
