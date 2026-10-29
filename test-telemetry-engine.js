'use strict';
/* ============================================================
   TELEMETRY ENGINE TEST
   Verifies:
   - Dynamic metric calculation hook (recalculateTelemetry)
   - POST /api/bip/events endpoint boosts on pass & penalizes on fail
   - Target timestamp persistence and survival across restarts
   - Frontend HUD elements (#ciPulse, #estVelocityPill, #cliLog)
   ============================================================ */
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 4199;
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'bip-telem-'));
const env = Object.assign({}, process.env, {
  PORT: String(PORT),
  BIP_DATA_DIR: DATA
});

let pass = 0, fail = 0;
function ok(c, m){ if(c){ pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m); } }
function parse(b){ try { return JSON.parse(b); } catch(e){ return null; } }
function wait(ms){ return new Promise(r => setTimeout(r, ms)); }

let child = spawn(process.execPath, ['server.js'], { cwd: __dirname, env, stdio: ['ignore','pipe','pipe'] });
let stderrBuf = '';
child.stderr.on('data', c => { stderrBuf += c; });

function req(method, p, body, headers){
  return new Promise((resolve) => {
    const opts = { host:'127.0.0.1', port:PORT, path:p, method,
      headers: Object.assign({ Accept:'application/json' }, headers || {}) };
    const r = http.request(opts, (res) => {
      let buf = '';
      res.on('data', c => { buf += c; });
      res.on('end', () => resolve({ status:res.statusCode, headers:res.headers, body:buf }));
    });
    r.on('error', () => resolve({ status:0, headers:{}, body:'' }));
    if(body !== undefined) r.write(typeof body === 'string' ? body : JSON.stringify(body));
    r.end();
  });
}

(async () => {
  await wait(1800);
  let r, j;

  // 1. Initial Summary contract
  r = await req('GET', '/api/bip/summary');
  j = parse(r.body);
  ok(r.status === 200 && j && j.progress, 'GET /api/bip/summary returns 200');
  ok(j.progress.percent === 66, 'initial progress percent is 66%');
  ok(j.estimate && j.estimate.remainingHours === 50, 'initial remaining effort is 50h');
  ok(typeof j.targetTimestamp === 'number' && j.targetTimestamp > Date.now(), 'initial targetTimestamp is in the future');

  // 2. Post CI pass event to /api/bip/events
  r = await req('POST', '/api/bip/events', {
    sha: '1a2b3c4',
    message: 'feat: add telemetry engine',
    status: 'passed',
    passed: 26,
    failed: 0
  }, { 'Content-Type': 'application/json' });
  j = parse(r.body);
  ok(r.status === 200 && j && j.ok, 'POST /api/bip/events with status=passed returns 200');
  ok(j.progress.percent === 68, 'progress percent increased from 66% -> 68% (+2% boost)');
  ok(j.estimate.remainingHours === 46, 'remaining effort reduced from 50h -> 46h (-4h effort)');
  ok(j.telemetry && j.telemetry.lastRun.status === 'passed', 'telemetry lastRun status is passed');
  ok(j.recentActivity && j.recentActivity.some(e => e.ref === '1a2b3c4'), 'commit event logged in activity feed');

  // 3. Post CI fail event to /api/bip/events
  r = await req('POST', '/api/bip/events', {
    sha: '9z8y7x6',
    message: 'test: intentional regression',
    status: 'failed',
    passed: 25,
    failed: 1
  }, { 'Content-Type': 'application/json' });
  j = parse(r.body);
  ok(r.status === 200 && j && j.ok, 'POST /api/bip/events with status=failed returns 200');
  ok(j.progress.percent === 64, 'progress percent dropped by 4% (68% -> 64% penalty)');
  ok(j.estimate.remainingHours === 58, 'remaining effort increased with 12h penalty (46h -> 58h)');
  ok(j.recentActivity && j.recentActivity.some(e => e.status === 'failed'), 'incident alert logged in activity feed');

  // 4. Persistence across process restart
  await new Promise(res => { child.kill(); child.on('exit', res); });
  await wait(500);
  child = spawn(process.execPath, ['server.js'], { cwd: __dirname, env, stdio: ['ignore','pipe','pipe'] });
  await wait(2200);

  r = await req('GET', '/api/bip/summary');
  j = parse(r.body);
  ok(r.status === 200 && j.progress.percent === 64, 'after restart: progress percent persisted at 64%');
  ok(j.estimate.remainingHours === 58, 'after restart: remaining hours persisted at 58h');
  ok(j.telemetry && j.telemetry.runsCount === 2, 'after restart: runsCount persisted (2 runs)');

  // 5. Verify /build page contains new HUD elements & intact countdown elements
  r = await req('GET', '/build', undefined, { Accept: 'text/html' });
  ok(r.status === 200, 'GET /build returns 200');
  ok(/id="ciPulse"/.test(r.body), '/build has #ciPulse indicator');
  ok(/id="estVelocityPill"/.test(r.body), '/build has #estVelocityPill');
  ok(/id="cliLog"/.test(r.body), '/build has #cliLog container');
  ok(/xamcode_target_ms/.test(r.body), '/build caches target timestamp in localStorage');
  ok(/id="countCells"[^>]*hidden/.test(r.body), '#countCells remains hidden for test runner compatibility');
  ok(/id="estCells"[^>]*hidden/.test(r.body), '#estCells remains hidden in initial HTML for hydration test');

  console.log('\nTELEMETRY ENGINE TESTS: ' + pass + ' passed, ' + fail + ' failed');
  child.kill();
  setTimeout(() => { try { fs.rmSync(DATA, { recursive:true, force:true }); } catch(e){} process.exit(fail ? 1 : 0); }, 400);
})().catch(e => {
  console.error('TELEMETRY ERROR: ' + (e && e.message));
  if(stderrBuf) console.error('server stderr:\n' + stderrBuf.slice(-2000));
  try { child.kill(); } catch(x){}
  process.exit(1);
});

