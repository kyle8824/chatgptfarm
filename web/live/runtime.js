export const LIVE_RUNTIME='https://chatgptfarm.kyle8824.workers.dev';
// Vercel serves the public page; the authoritative socket connects directly to
// the existing Worker. Local tests keep their own isolated server and world.
export function runtimeOrigin(pageUrl){
 const page=new URL(pageUrl),publicViewer=['chatgptfarm.com','www.chatgptfarm.com'].includes(page.hostname)||page.hostname.endsWith('.vercel.app');
 return publicViewer?LIVE_RUNTIME:page.origin;
}
export function runtimeUrl(path,pageUrl){return new URL(path,runtimeOrigin(pageUrl));}
