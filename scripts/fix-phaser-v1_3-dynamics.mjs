import fs from 'node:fs';
const p='phaser-world-v1.js';
let s=fs.readFileSync(p,'utf8');
if(!s.includes(' renderEntities(initial=false){')){
 const anchor='\n refreshDynamicWorld(){';
 if(!s.includes(anchor))throw new Error('Missing refreshDynamicWorld anchor');
 s=s.replace(anchor,`\n renderEntities(initial=false){for(const a of canonical.agents||[])this.upsertAgent(a,initial);for(const a of canonical.ecologySystem?.wildlife||[])if(a.active)this.upsertWildlife(a,initial)}${anchor}`);
}
fs.writeFileSync(p,s);
const h='phaser.html';let html=fs.readFileSync(h,'utf8');html=html.replace(/phaser-world-v1\.js\?v=\d+/,'phaser-world-v1.js?v=0013').replace(/phaser-world\.css\?v=\d+/,'phaser-world.css?v=0013');fs.writeFileSync(h,html);
console.log('Restored Phaser v1.3 dynamic entity renderer and cache version');
