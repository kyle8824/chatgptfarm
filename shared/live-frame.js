// Ordered WebSocket changes retain an explicit revision base. A reconnect gets
// a complete snapshot; no prediction, local simulation or lost event replay.
export function frameDelta(previous,next){
 if(!previous)return next;const changes=[];
 function visit(a,b,path){if(Object.is(a,b))return;if(b===undefined){changes.push([path]);return;}const ao=a!==null&&typeof a==='object',bo=b!==null&&typeof b==='object';if(ao&&bo&&Array.isArray(a)===Array.isArray(b)&&(!Array.isArray(b)||a.length===b.length)){for(const key of Object.keys(a))if(!Object.hasOwn(b,key))changes.push([path.concat(key)]);for(const key of Object.keys(b))visit(a[key],b[key],path.concat(key));}else changes.push([path,b]);}
 visit(previous,next,[]);return {type:'state',delta:true,baseRevision:previous.runtime.revision,changes};
}
export function applyFrameDelta(previous,message){
 if(!message.delta)return message;if(!previous||previous.runtime.revision!==message.baseRevision)throw Error('Live frame base does not match');const result=structuredClone(previous);
 for(const [path,value]of message.changes){if(!Array.isArray(path)||!path.length||path.some(p=>['__proto__','prototype','constructor'].includes(p)))throw Error('Invalid live frame path');let target=result;for(const key of path.slice(0,-1))target=target[key];const key=path.at(-1);if(value===undefined)delete target[key];else target[key]=value;}
 return result;
}
