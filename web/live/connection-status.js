// Transport state and world freshness are separate: a late frame does not
// mean the WebSocket disconnected. Keep short delays out of the large banner.
export function connectionStatus({readyState,hasWorld,runtime,frameAge}){
 if(readyState!==1)return {live:false,label:hasWorld?'Reconnecting':'Connecting',notice:hasWorld?'Connection interrupted. Reconnecting to the world…':null};
 if(runtime?.status==='persistence-blocked')return {live:false,label:'World paused',notice:'World paused: saving is unavailable. Waiting for hosting to recover.'};
 if(runtime?.status==='catching-up')return {live:false,label:'Recovering world',notice:'World recovery in progress. The view is held until the server reaches the present.'};
 if(runtime?.status==='error')return {live:false,label:'World paused',notice:'The world server reported a problem. Waiting for it to resume.'};
 if(!hasWorld)return {live:false,label:'Connecting',notice:null};
 if(frameAge>=2000)return {live:false,label:'Updates delayed',notice:frameAge>=10000?'Still connected. Waiting for the next world update…':null};
 return {live:runtime?.status==='running',label:'Live world',notice:null};
}
