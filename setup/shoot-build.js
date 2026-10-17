'use strict';
/* Screenshot capture for the /build page at required viewports.
   Boots a scratch server (scratch port + scratch BIP_DATA_DIR) so the real
   store is untouched, then captures full-page screenshots into docs/shots.
   Run: node setup/shoot-build.js */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const PORT = 4195;
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'bip-shots-'));
const OUT = path.join(ROOT, 'docs', 'shots');
const env = Object.assign({}, process.env, { PORT: String(PORT), BIP_DATA_DIR: DATA });
const child = spawn(process.execPath, ['server.js'], { cwd: ROOT, env, stdio: ['ignore','pipe','pipe'] });
function wait(ms){ return new Promise(r => setTimeout(r, ms)); }

/* Resolve a Chromium binary: prefer the Playwright-managed one; fall back to
   any chromium-* dir already downloaded in the local ms-playwright cache so
   the script works even when the "headless shell" variant failed to install. */
async function launchBrowser(){
  try { return await chromium.launch(); } catch(e){ /* fall through */ }
  const cacheRoot = path.join(os.homedir(), 'AppData', 'Local', 'ms-playwright');
  let dirs = [];
  try { dirs = fs.readdirSync(cacheRoot).filter(d => /^chromium-/.test(d)).sort(); } catch(e){}
  for (let i = dirs.length - 1; i >= 0; i--){
    const exe = path.join(cacheRoot, dirs[i], 'chrome-win64', 'chrome.exe');
    if (fs.existsSync(exe)) return await chromium.launch({ executablePath: exe });
  }
  throw new Error('No Playwright Chromium found. Run: npx playwright install chromium');
}

const VIEWPORTS = [
  { name: '1440x900', width: 1440, height: 900 },
  { name: '768x1024',  width: 768,  height: 1024 },
  { name: '390x844',   width: 390,  height: 844 },
  { name: '360x800',   width: 360,  height: 800 }
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  await wait(2000);
  const browser = await launchBrowser();
  try {
    for (const vp of VIEWPORTS){
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await ctx.newPage();
      await page.goto('http://127.0.0.1:' + PORT + '/build', { waitUntil: 'networkidle' });
      // Let the estimate panel + reveals settle.
      await page.waitForTimeout(1200);
      // Scroll through so lazy reveals trigger, then settle: IntersectionObserver
      // delivers callbacks asynchronously, so a fast scripted scroll can finish
      // before the last elements flip. Force any stragglers into their revealed
      // state (identical to what a real reader sees once they scroll past) so
      // full-page captures never show blank sections.
      await page.evaluate(async () => {
        const step = Math.max(200, Math.floor(window.innerHeight * 0.8));
        for (let y = 0; y < document.body.scrollHeight; y += step){
          window.scrollTo(0, y);
          await new Promise(r => setTimeout(r, 80));
        }
        window.scrollTo(0, 0);
      });
      await page.waitForTimeout(500);
      await page.evaluate(() => {
        document.querySelectorAll('.reveal:not(.in)').forEach(el => el.classList.add('in'));
      });
      await page.waitForTimeout(400);
      const file = path.join(OUT, 'build-' + vp.name + '.png');
      await page.screenshot({ path: file, fullPage: true });
      console.log('captured ' + file);
      // Also capture the countdown panel specifically for the report.
      const est = await page.$('#estPanel');
      if (est){
        await est.scrollIntoViewIfNeeded();
        await page.waitForTimeout(300);
        const estFile = path.join(OUT, 'countdown-' + vp.name + '.png');
        await est.screenshot({ path: estFile });
        console.log('captured ' + estFile);
      }
      await ctx.close();
    }
    console.log('SHOTS OK');
  } finally {
    await browser.close();
    child.kill();
    try { fs.rmSync(DATA, { recursive:true, force:true }); } catch(e){}
  }
  process.exit(0);
})().catch(e => { console.log('SHOTS ERROR: ' + (e && e.message)); try { child.kill(); } catch(x){} process.exit(1); });
