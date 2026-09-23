import assert from 'node:assert/strict';
import {WorldConnection,SILENT_SOCKET_MS} from '../web/live/connection.js';
import {connectionStatus} from '../web/live/connection-status.js';

let now=100;const pending=new Map();let id=0;
const timers={setTimeout(fn,ms){pending.set(++id,{fn,at:now+ms});return id;},clearTimeout(id){pending.delete(id);}};
class Socket{
 static instances=[];
 constructor(){this.readyState=0;Socket.instances.push(this);}
 open(){this.readyState=1;this.onopen?.();}
 send(){}
 receive(data){this.onmessage?.({data:JSON.stringify(data)});}
 close(code,reason){this.closeCode=code;this.closeReason=reason;this.readyState=3;this.onclose?.();}
}
let frameAt=0,frames=0;const runtime={status:'running',revision:1};
const c=new WorldConnection({url:'wss://test',WebSocketClass:Socket,now:()=>now,timers,fetchHealth:async()=>({ok:true}),onFrame:()=>{frameAt=now;frames++;}});
const status=()=>connectionStatus({readyState:c.socket?.readyState,hasWorld:frames>0,runtime,frameAge:now-frameAt});
c.start();const first=c.socket;first.open();first.receive({type:'state',agents:[],runtime});
assert.equal(status().live,true);
// Reproduce the production symptom: world updates pause, heartbeats still work.
for(const gap of [2500,5000,7200]){
 now=100+gap;first.receive({type:'pong',sent:now-100});c.ping();
 assert.equal(status().label,'Updates delayed');assert.equal(status().notice,null);assert.equal(status().live,false);
 assert.equal(c.socket,first);assert.equal(first.readyState,1);
}
now=10101;first.receive({type:'pong',sent:now-100});
assert.match(status().notice,/Still connected/);
now=50000;first.receive({type:'pong',sent:now-100});c.ping();
assert.equal(first.readyState,1,'heartbeats keep the same connection alive during slow simulation');
assert.equal(frameAt,100,'heartbeats cannot make old world state fresh');
first.receive({type:'state',agents:[],runtime:{...runtime,revision:2}});
assert.equal(status().live,true);assert.equal(status().notice,null);
now+=SILENT_SOCKET_MS;c.ping();assert.equal(first.readyState,3);assert.equal(first.closeCode,4000);
assert.equal(status().label,'Reconnecting');assert.match(status().notice,/Connection interrupted/);
const retry=[...pending.values()].find(t=>t.at===now+1000);assert(retry,'silent sockets schedule a real reconnection');retry.fn();
const second=c.socket;assert.notEqual(second,first);second.open();
first.receive({type:'state',agents:[],runtime});assert.equal(frames,2,'retired socket cannot replace current state');
second.receive({type:'state',agents:[],runtime:{...runtime,revision:3}});assert.equal(status().live,true);
for(const [serverState,label] of [['catching-up','Recovering world'],['persistence-blocked','World paused'],['error','World paused']]){
 const s=connectionStatus({readyState:1,hasWorld:true,runtime:{status:serverState},frameAge:0});
 assert.equal(s.live,false);assert.equal(s.label,label);assert(s.notice);
}
c.stop();console.log('PASS delayed frames retain their connection; heartbeats do not hide stale state; silent and closed sockets reconnect; paused/recovering worlds stay honest');
