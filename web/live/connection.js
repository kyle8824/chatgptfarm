import {applyFrameDelta} from '../../shared/live-frame.js';
export const SILENT_SOCKET_MS=30000;
// The socket supplies all world state. Health requests only explain failures.
export class WorldConnection{
 constructor({url,onFrame,onPong=()=>{},onProblem=()=>{},WebSocketClass=WebSocket,fetchHealth=()=>fetch('/live/health',{cache:'no-store',signal:AbortSignal.timeout(8000)}),timers=globalThis,now=Date.now}){Object.assign(this,{url,onFrame,onPong,onProblem,WebSocketClass,fetchHealth,timers,now});this.retry=0;this.nextProbe=0;this.active=false;this.problemText=null;this.hostingBackoff=0;}
 start(){this.active=true;this.connect();}
 connect(){if(!this.active)return;this.clearTimers();const socket=this.socket=new this.WebSocketClass(this.url);this.deadline=this.timers.setTimeout(()=>{if(this.socket!==socket)return;this.problem();socket.close();},12000);
  let frame=null;socket.onopen=()=>{if(socket!==this.socket)return;this.lastActivity=this.now();this.ping();};
  socket.onmessage=e=>{if(socket!==this.socket)return;let message;try{message=JSON.parse(e.data);}catch{return;}if(message.type==='pong'){this.lastActivity=this.now();this.onPong(this.now()-message.sent);return;}if(message.type!=='state')return;try{frame=applyFrameDelta(frame,message);message=structuredClone(frame);}catch{socket.close();return;}if(!message.runtime||!Array.isArray(message.agents))return;this.lastActivity=this.now();
   try{this.onFrame(message);}catch{this.onProblem('The world arrived, but the view could not open. Please reload the page.');return;}
   this.timers.clearTimeout(this.deadline);this.retry=0;this.hostingBackoff=0;this.problemText=null;this.lastFrame=this.now();
  };
  socket.onclose=()=>{if(socket!==this.socket||!this.active)return;this.timers.clearTimeout(this.deadline);this.problem();this.reconnect=this.timers.setTimeout(()=>this.connect(),Math.max(this.hostingBackoff,Math.min(30000,1000*2**Math.min(5,this.retry++))));};
  socket.onerror=()=>socket.close();
 }
 problem(){this.onProblem(this.problemText||'Unable to connect to the world server. Retrying automatically…');void this.probe();}
 async probe(){if(this.probing||this.now()<this.nextProbe)return;this.probing=true;this.nextProbe=this.now()+30000;const frameAtStart=this.lastFrame;try{const response=await this.fetchHealth();if(!response.ok){const info=await response.json();if(this.active&&this.lastFrame===frameAtStart){this.problemText=typeof info.error==='string'?`${info.error} Retrying automatically…`:'The world server is unavailable. Retrying automatically…';if(info.code==='hosting_limit'){this.hostingBackoff=300000;this.nextProbe=this.now()+300000;}this.onProblem(this.problemText);}}}catch{/* The connection message also covers a network outage. */}finally{this.probing=false;}}
 ping(){const socket=this.socket;if(socket?.readyState!==1)return;if(this.now()-this.lastActivity>=SILENT_SOCKET_MS){socket.close(4000,'World connection stopped responding');return;}try{socket.send(JSON.stringify({type:'ping',sent:this.now()}));}catch{socket.close();}}
 retryNow(){this.stop();this.retry=0;this.nextProbe=0;this.hostingBackoff=0;this.start();}
 clearTimers(){this.timers.clearTimeout(this.deadline);this.timers.clearTimeout(this.reconnect);}
 stop(){this.active=false;this.clearTimers();const socket=this.socket;this.socket=null;socket?.close();}
}
