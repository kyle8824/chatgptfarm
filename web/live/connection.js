// The socket supplies all world state. Health requests only explain failures.
export class WorldConnection{
 constructor({url,onFrame,onPong=()=>{},onProblem=()=>{},WebSocketClass=WebSocket,fetchHealth=()=>fetch('/live/health',{cache:'no-store',signal:AbortSignal.timeout(8000)}),timers=globalThis,now=Date.now}){Object.assign(this,{url,onFrame,onPong,onProblem,WebSocketClass,fetchHealth,timers,now});this.retry=0;this.nextProbe=0;this.active=false;}
 start(){this.active=true;this.connect();}
 connect(){if(!this.active)return;this.clearTimers();const socket=this.socket=new this.WebSocketClass(this.url);this.deadline=this.timers.setTimeout(()=>{if(this.socket!==socket)return;this.problem();socket.close();},12000);
  socket.onopen=()=>this.ping();
  socket.onmessage=e=>{if(socket!==this.socket)return;let message;try{message=JSON.parse(e.data);}catch{return;}if(message.type==='pong'){this.onPong(this.now()-message.sent);return;}if(message.type!=='state'||!message.runtime||!Array.isArray(message.agents))return;
   try{this.onFrame(message);}catch{this.onProblem('The world arrived, but the view could not open. Please reload the page.');return;}
   this.timers.clearTimeout(this.deadline);this.retry=0;this.lastFrame=this.now();
  };
  socket.onclose=()=>{if(socket!==this.socket||!this.active)return;this.timers.clearTimeout(this.deadline);this.problem();this.reconnect=this.timers.setTimeout(()=>this.connect(),Math.min(30000,1000*2**Math.min(5,this.retry++)));};
  socket.onerror=()=>socket.close();
 }
 problem(){this.onProblem('Unable to connect to the world server. Retrying automatically…');void this.probe();}
 async probe(){if(this.probing||this.now()<this.nextProbe)return;this.probing=true;this.nextProbe=this.now()+30000;const frameAtStart=this.lastFrame;try{const response=await this.fetchHealth();if(!response.ok){const info=await response.json();if(this.active&&this.lastFrame===frameAtStart)this.onProblem(typeof info.error==='string'?`${info.error} Retrying automatically…`:'The world server is unavailable. Retrying automatically…');}}catch{/* The connection message also covers a network outage. */}finally{this.probing=false;}}
 ping(){if(this.socket?.readyState===1)this.socket.send(JSON.stringify({type:'ping',sent:this.now()}));}
 retryNow(){this.stop();this.retry=0;this.nextProbe=0;this.start();}
 clearTimers(){this.timers.clearTimeout(this.deadline);this.timers.clearTimeout(this.reconnect);}
 stop(){this.active=false;this.clearTimers();const socket=this.socket;this.socket=null;socket?.close();}
}
