// Health responses expose only a bounded storage/runtime error, never a stack,
// request headers, bindings, or the saved world itself.
export function worldFailure(error,now=Date.now()){
 const detail=String(error?.message||error||'Unknown runtime error').replace(/https?:\/\/\S+/gi,'[URL]').replace(/(Bearer\s+|(?:token|password|api[_-]?key)\s*[:=]\s*)\S+/gi,'$1[redacted]').replace(/[\r\n\t]+/g,' ').slice(0,320);
 const quota=/exceeded.*(?:limit|quota|allowed|free tier)|(?:limit|quota).*exceeded|daily.*limit|too many.*(?:rows|requests)/i.test(detail);
 const daily=quota&&(/daily/i.test(detail)||/free tier/i.test(detail)&&/rows|requests|duration/i.test(detail));
 const full=/SQLITE_FULL|database or disk is full/i.test(detail);
 // A quota rejection just after midnight must not defer recovery for another
 // entire day. Probe at most every five minutes, or at the next UTC reset.
 const untilReset=Math.ceil((Date.UTC(new Date(now).getUTCFullYear(),new Date(now).getUTCMonth(),new Date(now).getUTCDate()+1)-now)/1000);
 return {code:quota?'hosting_limit':full?'storage_full':/checkpoint|gzip|decompress/i.test(detail)?'checkpoint_unavailable':'world_unavailable',error:daily?'Cloudflare is still reporting the daily hosting allowance as exhausted. Allowances normally renew at 00:00 UTC; we’ll keep checking for recovery.':quota?'The world’s hosting limit has been reached. The server cannot run the world right now.':full?'The world’s storage is full. The server cannot save new progress.':'The world server is temporarily unavailable.',detail,retryAfterSeconds:daily?Math.min(300,untilReset):30};
}
export function unavailableResponse(error,{diagnostic=false,build}={}){
 const failure=worldFailure(error);if(!diagnostic)delete failure.detail;
 return Response.json({...failure,...(build?{build}:{}),stateReset:false},{status:503,headers:{'Cache-Control':'no-store','Retry-After':String(failure.retryAfterSeconds),'Access-Control-Allow-Origin':'*'}});
}
