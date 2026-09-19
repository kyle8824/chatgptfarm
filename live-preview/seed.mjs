import p0 from "./seed-0.mjs";
import p1 from "./seed-1.mjs";
import p2 from "./seed-2.mjs";
import p3 from "./seed-3.mjs";
import p4 from "./seed-4.mjs";
import p5 from "./seed-5.mjs";
import p6 from "./seed-6.mjs";
import p7 from "./seed-7.mjs";
const encoded=p0+p1+p2+p3+p4+p5+p6+p7;
export default async function seed(){const bytes=Uint8Array.from(atob(encoded),x=>x.charCodeAt(0));return JSON.parse(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))).text());}
