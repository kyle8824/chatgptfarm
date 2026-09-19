import fs from 'node:fs/promises';
await fs.mkdir(new URL('./public/',import.meta.url),{recursive:true});
for(const file of ['phaser-world.css','phaser-world-v1.js'])await fs.copyFile(new URL('../'+file,import.meta.url),new URL('./public/'+file,import.meta.url));
let html=await fs.readFile(new URL('../phaser.html',import.meta.url),'utf8');
html=html.replace('<head>','<head><script>window.CHATGPTFARM_RUNTIME_URL=location.origin;</script>').replace('LIVING WORLD · v1.6.8','ISOLATED LIVE SERVER · 6×');
await fs.writeFile(new URL('./public/index.html',import.meta.url),html);
