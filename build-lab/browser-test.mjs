import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import {startServer} from './dev-server.mjs';
const require=createRequire(process.env.LAB_BROWSER_MODULES||new URL('../cloudflare/package.json',import.meta.url));
const {chromium}=require('playwright');
const server=await startServer(0),base='http://127.0.0.1:'+server.address().port+'/live/build-lab/';
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const context=await browser.newContext({viewport:{width:1440,height:1050}}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await page.goto(base);await page.locator('#scene canvas').waitFor();
 assert.equal(await page.locator('#elapsed').textContent(),'0.0 simulated minutes');
 await page.locator('#scenario').selectOption('comfortable');await page.locator('#new-experiment').click();
 await page.locator('#generate').click();assert(await page.locator('#access').getAttribute('open')!==null);await page.locator('#owner-key').fill('local-lab-test-key');await page.locator('#unlock').click();await page.waitForFunction(()=>document.querySelector('#budget').textContent.includes('fixture-provider'));
 await page.locator('#generate').click();await page.waitForFunction(()=>document.querySelector('#proposal-status').textContent==='Geometry accepted');
 assert((await page.locator('#reasoning').textContent()).includes('not a real AI result'));
 await page.locator('#adopt').click();await page.locator('#run30').click();await page.waitForFunction(()=>document.querySelector('#elapsed').textContent==='30.0 simulated minutes'&&!document.querySelector('#run30').disabled);
 assert((await page.locator('#surfaces').textContent()).includes('Lying surface'));assert((await page.locator('#progress').textContent()).includes('1 / 1'));
 await page.locator('[data-use]').first().click();await page.waitForFunction(()=>document.querySelector('#elapsed').textContent==='40.0 simulated minutes'&&!document.querySelector('#run10').disabled);
 const saved=await page.evaluate(()=>localStorage.getItem('chatgptfarm-build-lab-v1'));assert(!saved.includes('local-lab-test-key'));const parsed=JSON.parse(saved);assert(parsed.lab.world.agents[0].comfort.lastRest.projectId);assert(parsed.runs[0].usage.inputTokens>0);
 const downloadPromise=page.waitForEvent('download');await page.locator('#export').click();const download=await downloadPromise;await fs.mkdir('realtime-qa',{recursive:true});await download.saveAs('realtime-qa/build-lab-export.json');
 await page.screenshot({path:'realtime-qa/build-lab-desktop.png',fullPage:true});await page.reload();await page.waitForFunction(()=>document.querySelector('#elapsed').textContent==='40.0 simulated minutes');await page.locator('#generate').click();assert((await page.locator('#notice').textContent()).includes('owner key'));
 await page.locator('[data-restore]').first().click();assert.equal(await page.locator('#elapsed').textContent(),'0.0 simulated minutes');await page.locator('#nearbySites').check();await page.locator('#new-experiment').click();assert((await page.locator('#sites').textContent()).includes('experimental nearby site'));
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'realtime-qa/build-lab-mobile.png',fullPage:true});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no mobile horizontal overflow');
 await page.locator('#import').setInputFiles('realtime-qa/build-lab-export.json');await page.waitForFunction(()=>document.querySelector('#notice').textContent.includes('Imported comparisons'));
 assert.deepEqual(errors,[]);await fs.writeFile('realtime-qa/build-lab-browser.json',JSON.stringify({result:'PASS',provider:'fixture only; no paid API used',checks:['3D render','owner authentication','API request/response','shared validator','finite assembly','actual surface use','saved comparison','reload without credential storage','export/import','baseline restore','nearby-site switch','mobile overflow'],pageErrors:errors},null,2));
 console.log('PASS: browser → authenticated API → recorded fixture response → validation → construction → use → persistence/export/import; desktop/mobile, no page errors.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
