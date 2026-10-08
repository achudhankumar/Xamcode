'use strict';
/* The daily-allowance refusal is the single most common way a PDF run ends
   for a real user, and it is the one path that never runs a study, so no
   happy-path test ever touches it.

   test-pdf-allowance.js covers the SERVER half, but it deliberately spends
   the entire live allowance to do it, so it can never join `npm test` - and
   that also left the CLIENT half (the 429 branch of analyzePdfRequest, and
   the teardown contract that stops the journey animation) untested.

   This exercises that branch against the real function with a stubbed
   XMLHttpRequest. No network, no provider, no allowance spent. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const app = fs.readFileSync(path.join(__dirname, 'js', 'app.js'), 'utf8');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m); } };

/* ---- pull the real function out of app.js ---- */
const start = app.indexOf('function analyzePdfRequest(');
/* Cut at the OPENING of the next section banner, not at its title, or the
   slice keeps a dangling "/* ===..." with no terminator and the block will
   not parse. */
const end = app.lastIndexOf('/*', app.indexOf('ANALYSIS JOB POLLING'));
if (start < 0 || end < start) throw new Error('analyzePdfRequest not found in app.js');
const block = app.slice(start, end);

/* ---- a stubbed XMLHttpRequest that replays one canned response ---- */
const makeXhr = ({ status, body, headers = {} }) => {
  const listeners = {}, upload = {};
  return {
    status,
    responseText: typeof body === 'string' ? body : JSON.stringify(body),
    timeout: 0,
    upload: { addEventListener: (t, f) => { (upload[t] = upload[t] || []).push(f); } },
    addEventListener: (t, f) => { (listeners[t] = listeners[t] || []).push(f); },
    setRequestHeader: () => {},
    getResponseHeader: n => headers[n] || headers[n.toLowerCase()] || null,
    open: () => {},
    send() { setTimeout(() => { (listeners.load || []).forEach(f => f()); }, 0); }
  };
};

let nextResponse = null;
let quotaRenders = [];
const sandbox = {
  module: { exports: {} },
  console, Math, Number, String, JSON, Promise, setTimeout, Error,
  location: { origin: 'http://127.0.0.1:4173', hostname: '127.0.0.1' },
  /* quotaLast is the last /api/quota snapshot and renderQuota paints the
     panel. Both are module-level in the app, so they resolve to these. */
  quotaLast: { usableModels: 7, totalModels: 10, models: [] },
  renderQuota: d => { quotaRenders.push(d); sandbox.quotaLast = d; },
  XMLHttpRequest: function () { return nextResponse; }
};
vm.createContext(sandbox);
vm.runInContext(block + '\nmodule.exports={analyzePdfRequest};', sandbox);
const { analyzePdfRequest } = sandbox.module.exports;

/* Ask for a response; get back the rejection (or the resolution). */
const attempt = async response => {
  nextResponse = makeXhr(response);
  return analyzePdfRequest('ZmFrZQ==', 'standard', () => {}, () => {})
    .then(value => ({ ok: true, value }), error => ({ ok: false, error }));
};

/* The exact payload server.js sends when the daily allowance is spent. */
const LIMIT_429 = {
  error: 'You have used all 5 PDF generations available today. Your allowance renews with the next daily window.',
  code: 'DAILY_LIMIT_REACHED',
  allowance: { limit: 5, remaining: 0, used: 5, unlimited: false },
  requestId: 'efcac0a7-3682-4266-a654-9275fd5045f6'
};

(async () => {
  console.log('\nthe refusal reaches the user in the server\'s own words');
  quotaRenders = [];
  const refused = await attempt({ status: 429, body: LIMIT_429 });
  ok(!refused.ok, 'the run rejects rather than resolving with a half-built job');
  /* Anchored to the exact sentence shown to a user who hit the cap. */
  ok(refused.error.message === `${LIMIT_429.error} Reference: ${LIMIT_429.requestId}.`,
    'the message is the real server wording plus the request reference');
  ok(refused.error.message.includes('all 5 PDF generations available today'),
    'the cap is stated in numbers, not as "try again later"');
  ok(refused.error.message.includes('renews with the next daily window'),
    'and says when it renews, so the wait is not a mystery');

  console.log('\nthe panel updates from the refusal itself, with no second request');
  ok(quotaRenders.length === 1, `renderQuota is called once (${quotaRenders.length})`);
  ok(quotaRenders[0] && quotaRenders[0].allowance.remaining === 0,
    'the count drops to 0 straight away rather than at the next poll');
  ok(quotaRenders[0].allowance.limit === 5, 'and keeps the real limit');
  ok(quotaRenders[0].usableModels === 7,
    'model capacity from the previous snapshot is preserved, not blanked');

  console.log('\nthe refusal cannot fabricate a count it was not told');
  quotaRenders = [];
  const bare = await attempt({ status: 429, body: { error: 'Slow down.', code: 'DAILY_LIMIT_REACHED' } });
  ok(!bare.ok, 'it still rejects');
  ok(quotaRenders.length === 0,
    'with no allowance in the body the panel is left alone rather than zeroed');
  quotaRenders = [];
  await attempt({ status: 500, body: { error: 'The providers are too busy.' } });
  ok(quotaRenders.length === 0, 'an unrelated server error never touches the allowance');

  console.log('\nthe request id survives even when the body omits it');
  const headerOnly = await attempt({
    status: 429, body: { error: 'No room today.' },
    headers: { 'X-Request-Id': 'header-ref-1234' }
  });
  ok(headerOnly.error.message === 'No room today. Reference: header-ref-1234.',
    'the X-Request-Id header is used as the fallback reference');

  console.log('\ntransport failures keep their own honest wording');
  const bad = await attempt({ status: 0, body: '<html>gateway</html>' });
  ok(!bad.ok && bad.error.message.includes('unreadable response'),
    'an unreadable body explains itself instead of showing raw HTML');
  ok(!bad.error.message.includes('<html>'), 'and strips markup out of the preview');

  console.log('\na run that fails must not leave the animation running');
  /* The submit handler catches, calls resetProgress(), and resetProgress is
     what hides the journey. If that link is ever removed the scene would sit
     mid-battle with no way out, so it is asserted rather than assumed. */
  const resetAt = app.indexOf('const resetProgress=');
  const resetBody = app.slice(resetAt, app.indexOf('};', resetAt));
  ok(/journeyHide\(\)/.test(resetBody), 'resetProgress() tears the journey down');
  const catchAt = app.indexOf('}catch(error){', resetAt);
  const catchBody = app.slice(catchAt, app.indexOf('}finally{', catchAt));
  ok(/resetProgress\(\)/.test(catchBody), 'the failure path calls it');
  ok(/setStatus\([^)]*true\)/.test(catchBody), 'and reports the failure as an error');
  ok(!/journeyFinish\(\)/.test(catchBody),
    'and never calls journeyFinish(), so a failed run cannot reach the finale');
  const finallyAt = app.indexOf('}finally{', catchAt);
  ok(/submit\.disabled=false/.test(app.slice(finallyAt, finallyAt + 400)),
    'the submit button is re-enabled so the user can retry after the window rolls');

  console.log(`\n${fail === 0 ? '*** PASS ***' : '*** FAIL ***'}  ${pass} passed, ${fail} failed\n`);
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
