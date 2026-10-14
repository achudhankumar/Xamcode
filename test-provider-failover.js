/* ============================================================
   AI PROVIDER POOL — failover tests
   ------------------------------------------------------------
   Tests the routing logic in server.js by stubbing global fetch, so
   it runs with no API keys and no network. This is the only way to
   prove the "Gemini is out of quota -> Groq answers" path without
   burning real quota on every provider.

   Run: node test-provider-failover.js
   ============================================================ */
'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const vm = require('node:vm');
const os = require('node:os');
const path = require('node:path');

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

/* Loads server.js, cuts off the listen tail, and exposes the internals.
   A vm context is used so each test gets a clean provider registry. */
function loadPool(keys){
  const source = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
  const cut = source.indexOf('const server = http.createServer');
  assert.ok(cut > 0, 'could not find the server bootstrap to cut');
  const sandbox = {
    console: { log(){}, warn(){}, error(){} },
    process: { env: { ...keys }, hasOwnProperty: Object.hasOwn },
    /* server.js pulls in node: builtins at the top; pass the real
       require straight through so the module loads unchanged. */
    require,
    __dirname,
    __filename,
    Buffer, URL, fetch, setTimeout, clearTimeout, setInterval, clearInterval,
    AbortController, TextEncoder,
    /* pacificDay() formats dates in the Pacific zone. */
    Intl
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(
    source.slice(0, cut) +
    '\nglobalThis.__pool={callAI,configuredProviders,providerStatus,isFailoverWorthy,PROVIDERS,' +
    'OPENAI_COMPATIBLE,geminiModelList,geminiKeys,quotaSnapshot,callGemini,callGeminiOnce,' +
    'openaiEnabled,callOpenAI,openaiTextOf,' +
    'readGoogleQuota,pdfAllowanceFor,consumePdfAllowance,quotaForToday};',
    sandbox, { filename: 'server.js' }
  );
  return sandbox.__pool;
}

/* Scripts a sequence of fetch outcomes and restores the real fetch after. */
async function withFetch(script, fn){
  const original = fetch;
  const calls = [];
  global.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    const next = script.shift();
    if (!next) throw new Error('unexpected extra fetch call');
    if (next.throw) throw Object.assign(new Error(next.throw), { name: 'TypeError' });
    return {
      ok: next.status >= 200 && next.status < 300,
      status: next.status,
      headers: { get: n => (n === 'retry-after' ? (next.retryAfter ?? null) : null), has: () => false },
      json: async () => next.body ?? {}
    };
  };
  try{ return await fn(calls); }
  finally{ global.fetch = original; }
}

/* server.js loads the real .env from disk, but only for keys that are
   NOT already present on process.env. Pre-claiming every provider key
   AND both model settings here therefore pins the pool exactly,
   instead of inheriting the developer's real .env out of the project
   directory — including GEMINI_MODELS, which now has a real value in
   that file. Empty string still counts as "already present". */
const env = overrides => ({
  GEMINI_API_KEY: '', GROQ_API_KEY: '', OPENROUTER_API_KEY: '', EXPLABS_API_KEY: '',
  GEMINI_MODEL: '', GEMINI_MODELS: '',
  ...overrides
});
const NO_KEYS     = env({});
const GEMINI_ONLY = env({ GEMINI_API_KEY: 'g-test' });
const GROQ_ONLY   = env({ GROQ_API_KEY: 'q-test' });
const ROUTER_ONLY = env({ OPENROUTER_API_KEY: 'o-test' });
const EXPLABS_ONLY = env({ EXPLABS_API_KEY: 'x-test' });
const XAI_ONLY     = env({ XAI_API_KEY: 'a-test' });
const FULL_POOL   = env({ GEMINI_API_KEY: 'g-test', GROQ_API_KEY: 'q-test', XAI_API_KEY: 'a-test', OPENROUTER_API_KEY: 'o-test', EXPLABS_API_KEY: 'x-test' });

/* Arrays built inside the vm come from a different realm, so
   deepStrictEqual rejects them on prototype identity. Copying out with
   Array.from in this realm keeps the comparison meaningful. */
const ids = providers => Array.from(providers, p => p.id);

/* ---------- 1. Pool membership ---------- */
test('no keys configured -> empty pool', () => {
  assert.strictEqual(ids(loadPool(NO_KEYS).configuredProviders()).length, 0);
});

test('gemini only -> pool of one', () => {
  assert.deepStrictEqual(ids(loadPool(GEMINI_ONLY).configuredProviders()), ['gemini']);
});

test('all keys -> pool in declared order', () => {
  assert.deepStrictEqual(ids(loadPool(FULL_POOL).configuredProviders()), ['gemini', 'groq', 'xai', 'openrouter', 'explabs']);
});

test('a blank key counts as unconfigured', () => {
  const pool = loadPool(env({ GEMINI_API_KEY: 'g-test', OPENROUTER_API_KEY: '   ' }));
  assert.deepStrictEqual(ids(pool.configuredProviders()), ['gemini']);
});

/* ---------- 2. Document capability gating ---------- */
/* Both gemini and explabs can read a PDF, but gemini is declared first
   so it always leads; the gateway is the fallback, not the default. */
test('PDF request sees only document-capable providers', () => {
  const pool = loadPool(FULL_POOL);
  assert.deepStrictEqual(ids(pool.configuredProviders({ requireDocuments: true })), ['gemini', 'explabs']);
});

test('a PDF still routes to explabs when gemini has no key', () => {
  const pool = loadPool(env({ EXPLABS_API_KEY: 'x-test' }));
  assert.deepStrictEqual(ids(pool.configuredProviders({ requireDocuments: true })), ['explabs']);
});

test('text request sees every provider', () => {
  assert.strictEqual(ids(loadPool(FULL_POOL).configuredProviders()).length, 5);
});

test('PDF with no gemini key -> AI_NOT_CONFIGURED, never a text provider', async () => {
  const pool = loadPool(env({ GROQ_API_KEY: 'q-test' }));
  const error = await pool.callAI(
    [{ text: 'hi' }, { inlineData: { mimeType: 'application/pdf', data: 'AAA' } }],
    { requiresDocument: true }
  ).then(() => null, e => e);
  assert.ok(error, 'expected a throw');
  assert.strictEqual(error.code, 'AI_NOT_CONFIGURED');
  assert.match(error.message, /GEMINI_API_KEY/);
});
/* ---------- 3. Failover on 429 — the reason this pool exists ---------- */
test('gemini 429 -> groq answers', () => withFetch([
  { status: 429, body: { error: { message: 'quota exceeded' } } },
  { status: 200, body: { choices: [{ message: { content: 'answered by groq' } }] } }
], async calls => {
  const answer = await loadPool(FULL_POOL).callAI([{ text: 'hello' }], {});
  assert.strictEqual(answer, 'answered by groq');
  assert.strictEqual(calls.length, 2);
  assert.match(calls[0].url, /generativelanguage/);
  assert.match(calls[1].url, /api\.groq\.com/);
}));

test('gemini 429 -> groq 429 -> xai answers', () => withFetch([
  { status: 429, body: { error: { message: 'q' } } },
  { status: 429, body: { error: { message: 'q' } } },
  { status: 200, body: { choices: [{ message: { content: 'answered by xai' } }] } }
], async calls => {
  const answer = await loadPool(FULL_POOL).callAI([{ text: 'hi' }], {});
  assert.strictEqual(answer, 'answered by xai');
  assert.strictEqual(calls.length, 3);
  assert.match(calls[2].url, /api\.x\.ai/);
}));

test('every provider rate-limited -> surfaces the error, stops at pool end', () => withFetch([
  { status: 429, body: { error: { message: 'q' } } },
  { status: 429, body: { error: { message: 'q' } } },
  { status: 429, body: { error: { message: 'q' } } },
  { status: 429, body: { error: { message: 'q' } } },
  { status: 429, body: { error: { message: 'q' } } }
], async calls => {
  const error = await loadPool(FULL_POOL).callAI([{ text: 'hi' }], {}).then(() => null, e => e);
  assert.ok(error, 'expected a throw');
  assert.strictEqual(error.status, 429);
  assert.strictEqual(calls.length, 5, 'must not loop past the end of the pool');
}));

/* ---------- 4. Failover on network failure and 5xx ----------
   Gemini gets 3 in-adapter retries before it gives up, so a Gemini
   outage costs 3 calls before the pool moves on. */
test('network failure -> gemini retries 3x, then fails over to groq', () => withFetch([
  { throw: 'fetch failed' }, { throw: 'fetch failed' }, { throw: 'fetch failed' },
  { status: 200, body: { choices: [{ message: { content: 'recovered' } }] } }
], async calls => {
  assert.strictEqual(await loadPool(FULL_POOL).callAI([{ text: 'hi' }], {}), 'recovered');
  assert.strictEqual(calls.length, 4);
  assert.ok(calls.slice(0, 3).every(c => /generativelanguage/.test(c.url)));
  assert.match(calls[3].url, /api\.groq\.com/);
}));

test('503 on gemini -> retries 3x, then fails over', () => withFetch([
  { status: 503, body: {} }, { status: 503, body: {} }, { status: 503, body: {} },
  { status: 200, body: { choices: [{ message: { content: 'recovered' } }] } }
], async calls => {
  assert.strictEqual(await loadPool(FULL_POOL).callAI([{ text: 'hi' }], {}), 'recovered');
  assert.strictEqual(calls.length, 4);
}));

/* ---------- 5. Errors that must NOT fail over ---------- */
test('400 does not fail over (malformed request, not a quota issue)', () => withFetch([
  { status: 400, body: { error: { message: 'bad request' } } }
], async calls => {
  const error = await loadPool(FULL_POOL).callAI([{ text: 'hi' }], {}).then(() => null, e => e);
  assert.ok(error, 'expected a throw');
  assert.strictEqual(error.status, 422);
  assert.strictEqual(calls.length, 1, 'must not waste quota on a malformed request');
}));

test('401 bad key names the env var and does not fail over', () => withFetch([
  { status: 401, body: { error: { message: 'invalid key' } } }
], async calls => {
  const error = await loadPool(FULL_POOL).callAI([{ text: 'hi' }], {}).then(() => null, e => e);
  assert.ok(error, 'expected a throw');
  assert.strictEqual(error.status, 401);
  assert.match(error.message, /API_KEY/);
  assert.strictEqual(calls.length, 1);
}));

test('isFailoverWorthy classification is correct', () => {
  const pool = loadPool(FULL_POOL);
  [429, 402, 500, 502, 503, 504].forEach(s => assert.ok(pool.isFailoverWorthy(s), s + ' should fail over'));
  [400, 401, 403, 404, 422].forEach(s => assert.ok(!pool.isFailoverWorthy(s), s + ' should NOT fail over'));
});
/* ---------- 6. Wire format ---------- */
test('groq request uses OpenAI chat shape with bearer auth', () => withFetch([
  { status: 200, body: { choices: [{ message: { content: 'ok' } }] } }
], async calls => {
  await loadPool(GROQ_ONLY).callAI([{ text: 'first' }, { text: 'second' }], { systemInstruction: 'be terse' });
  const sent = JSON.parse(calls[0].init.body);
  assert.strictEqual(sent.model, 'openai/gpt-oss-120b');
  assert.strictEqual(sent.messages[0].role, 'system');
  assert.strictEqual(sent.messages[0].content, 'be terse');
  assert.match(sent.messages[1].content, /first[\s\S]*second/);
  assert.strictEqual(calls[0].init.headers.Authorization, 'Bearer q-test');
}));

test('openrouter sends attribution headers', () => withFetch([
  { status: 200, body: { choices: [{ message: { content: 'ok' } }] } }
], async calls => {
  await loadPool(ROUTER_ONLY).callAI([{ text: 'hi' }], {});
  assert.match(calls[0].url, /openrouter\.ai/);
  assert.strictEqual(calls[0].init.headers['X-Title'], 'XamCode AI');
}));

test('a PDF never reaches a text-only provider, even mid-failover', () => withFetch([
  { status: 429, body: {} },
  { status: 200, body: { choices: [{ message: { content: 'fabricated' } }] } }
], async calls => {
  const pool = loadPool(FULL_POOL);
  await pool.callAI(
    [{ text: 'x' }, { inlineData: { mimeType: 'application/pdf', data: 'AAA' } }],
    { requiresDocument: true }
  ).catch(() => {});
  assert.ok(!calls.some(c => /groq\.com|openrouter\.ai/.test(c.url)),
    'a text-only provider must never receive a PDF');
}));

/* ---------- 7. Experiential Labs: gateway provider ---------- */
test('an explabs key joins the text pool last', () => {
  const pool = loadPool(FULL_POOL);
  assert.deepStrictEqual(ids(pool.configuredProviders()), ['gemini', 'groq', 'xai', 'openrouter', 'explabs']);
});

test('explabs answers a text request through the OpenAI wire shape', () => withFetch([
  { status: 200, body: { choices: [{ message: { content: 'answered by gateway' } }] } }
], async calls => {
  const answer = await loadPool(EXPLABS_ONLY).callAI([{ text: 'hi' }], {});
  assert.strictEqual(answer, 'answered by gateway');
  assert.match(calls[0].url, /api\.experientiallabs\.ai\/v1\/chat\/completions/);
  assert.strictEqual(calls[0].init.headers.Authorization, 'Bearer x-test');
}));

test('a PDF reaches explabs because it declares documents: true', () => withFetch([
  { status: 200, body: { choices: [{ message: { content: '{"ok":true}' } }] } }
], async calls => {
  const answer = await loadPool(EXPLABS_ONLY).callAI(
    [{ text: 'x' }, { inlineData: { mimeType: 'application/pdf', data: 'AAA' } }],
    { requiresDocument: true, schema: { type: 'object' } }
  );
  assert.strictEqual(answer, '{"ok":true}');
  const sent = JSON.parse(calls[0].init.body);
  /* No systemInstruction was passed, so the user turn is messages[0]. */
  assert.strictEqual(Array.isArray(sent.messages[0].content), true);
  assert.strictEqual(sent.messages[0].content[1].type, 'file');
  assert.match(sent.messages[0].content[1].file.file_data, /^data:application\/pdf;base64,/);
}));

/* A study pack runs well past the 2048 budget used for chat answers, so
   the document path must not inherit it or the JSON gets truncated. */
test('the PDF path asks for a larger output budget than chat', () => withFetch([
  { status: 200, body: { choices: [{ message: { content: '{}' } }] } },
  { status: 200, body: { choices: [{ message: { content: '{}' } }] } }
], async calls => {
  const pool = loadPool(EXPLABS_ONLY);
  await pool.callAI([{ text: 'hi' }], {});
  await pool.callAI(
    [{ text: 'x' }, { inlineData: { mimeType: 'application/pdf', data: 'AAA' } }],
    { requiresDocument: true, schema: { type: 'object' } }
  );
  assert.strictEqual(JSON.parse(calls[0].init.body).max_tokens, 2048);
  assert.ok(JSON.parse(calls[1].init.body).max_tokens > 8192,
    'PDF generation needs more than 8192 tokens');
  assert.deepStrictEqual(JSON.parse(calls[1].init.body).response_format, { type: 'json_object' });
}));

/* json_object mode is only legal when the prompt mentions JSON, which
   the analyse prompt now does. Guard that so a future edit cannot
   silently produce a 400 on every PDF request. */
test('the analyse prompt states it must answer with JSON', () => {
  const src = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
  const from = src.indexOf("'Analyze the attached educational PDF");
  const promptBlock = src.slice(from, src.indexOf("].join(' ');", from));
  assert.ok(from > 0, 'could not locate the analyse prompt');
  assert.match(promptBlock, /single valid JSON object/);
});

/* Gemini must stay ahead of the gateway on PDFs: it is the provider this
   app was built and tested against, so the gateway is only a fallback. */
test('gemini leads PDF analysis and explabs only takes over after a 429', () => withFetch([
  { status: 429, body: {} },
  { status: 200, body: { choices: [{ message: { content: '{"ok":1}' } }] } }
], async calls => {
  const answer = await loadPool(FULL_POOL).callAI(
    [{ text: 'x' }, { inlineData: { mimeType: 'application/pdf', data: 'AAA' } }],
    { requiresDocument: true, schema: { type: 'object' } }
  );
  assert.strictEqual(answer, '{"ok":1}');
  assert.strictEqual(calls.length, 2, 'a PDF must skip the two text-only providers entirely');
  assert.match(calls[0].url, /generativelanguage/);
  assert.match(calls[1].url, /experientiallabs/);
}));

/* ---------- 9. Gemini model rotation and daily usage ---------- */
/* Each call gets its own quota file, so state written by a rotation
   test cannot leak into the next one and make it look dirty. */
let quotaFileSeq = 0;
const quotaEnv = extra => ({
  ...env({ GEMINI_API_KEY: 'g-test', ...extra }),
  XAMCODE_QUOTA_FILE: path.join(os.tmpdir(),
    `xamcode-quota-test-${process.pid}-${quotaFileSeq++}.json`)
});
/* Same cross-realm caveat as ids() above: arrays built inside the vm
   have a different Array prototype, so copy them out before comparing. */
const slugs = pool => Array.from(pool.geminiModelList(), m => m);

test('GEMINI_MODELS is parsed as an ordered rotation list', () => {
  assert.deepStrictEqual(slugs(loadPool(quotaEnv({ GEMINI_MODELS: 'a, b ,c' }))), ['a', 'b', 'c']);
});

test('GEMINI_MODEL still works when GEMINI_MODELS is absent', () => {
  assert.deepStrictEqual(slugs(loadPool(quotaEnv({ GEMINI_MODEL: 'solo-model' }))), ['solo-model']);
});

test('duplicate models collapse so one slug is not tried twice', () => {
  assert.deepStrictEqual(slugs(loadPool(quotaEnv({ GEMINI_MODELS: 'x,y,x' }))), ['x', 'y']);
});

test('a 429 on the first model rotates to the next one', () => withFetch([
  { status: 429, body: { error: { message: 'quota exceeded' } } },
  { status: 200, body: { output_text: 'recovered' } }
], async calls => {
  const pool = loadPool(quotaEnv({ GEMINI_MODELS: 'm-one,m-two' }));
  assert.strictEqual(await pool.callGemini([{ text: 'hi' }], {}), 'recovered');
  assert.strictEqual(calls.length, 2);
  assert.match(JSON.parse(calls[0].init.body).model, /m-one$/);
  assert.match(JSON.parse(calls[1].init.body).model, /m-two$/);
}));

test('a 429 is not retried on the same model before rotating', () => withFetch([
  { status: 429, body: { error: { message: 'quota exceeded' } } },
  { status: 200, body: { output_text: 'second model' } }
], async calls => {
  await loadPool(quotaEnv({ GEMINI_MODELS: 'm-one,m-two' })).callGemini([{ text: 'hi' }], {});
  assert.strictEqual(calls.length, 2, 'the exhausted slug must be abandoned, not retried');
}));

test('a 404 on a model rotates rather than aborting', () => withFetch([
  { status: 404, body: { error: { message: 'no longer available' } } },
  { status: 200, body: { output_text: 'ok' } }
], async calls => {
  const answer = await loadPool(quotaEnv({ GEMINI_MODELS: 'gone,alive' })).callGemini([{ text: 'hi' }], {});
  assert.strictEqual(answer, 'ok');
  assert.strictEqual(calls.length, 2);
}));

test('a rejected key never rotates, so the misconfiguration stays visible', () => withFetch([
  { status: 401, body: { error: { message: 'bad key' } } }
], async calls => {
  const error = await loadPool(quotaEnv({ GEMINI_MODELS: 'm-one,m-two' }))
    .callGemini([{ text: 'hi' }], {}).then(() => null, e => e);
  assert.ok(error, 'expected a throw');
  assert.strictEqual(error.status, 401);
  assert.match(error.message, /GEMINI_API_KEY/);
  assert.strictEqual(calls.length, 1, 'a bad key is not a quota problem');
}));

test('a 400 on the PDF never rotates', () => withFetch([
  { status: 400, body: { error: { message: 'bad pdf' } } }
], async calls => {
  const error = await loadPool(quotaEnv({ GEMINI_MODELS: 'm-one,m-two' }))
    .callGemini([{ text: 'x' }, { inlineData: { mimeType: 'application/pdf', data: 'AA' } }], {}).then(() => null, e => e);
  assert.ok(error);
  assert.strictEqual(calls.length, 1);
}));

test('exhausting the whole rotation explains itself', () => withFetch([
  { status: 429, body: { error: { message: 'quota' } } },
  { status: 429, body: { error: { message: 'quota' } } }
], async calls => {
  const error = await loadPool(quotaEnv({ GEMINI_MODELS: 'm-one,m-two' }))
    .callGemini([{ text: 'hi' }], {}).then(() => null, e => e);
  assert.ok(error, 'expected a throw');
  assert.strictEqual(error.status, 429);
  assert.match(error.message, /out of (free )?quota for today/);
  assert.match(error.message, /midnight Pacific/);
  assert.strictEqual(calls.length, 2);
}));

test('the quota snapshot reports observed state, not an invented remaining count', () => {
  const snap = loadPool(quotaEnv({ GEMINI_MODELS: 'm-one,m-two' })).quotaSnapshot();
  assert.strictEqual(snap.totalModels, 2);
  assert.deepStrictEqual(Array.from(snap.models, m => m.slug), ['m-one', 'm-two']);
  assert.ok(Array.from(snap.models).every(m => m.status === 'untested'), 'untested before any call');
  assert.match(snap.note, /does not publish a remaining-request count/);
  assert.ok(snap.resetsAt, 'must state when the free tier resets');
  assert.ok(!('remaining' in snap), 'must not claim a remaining-requests figure');
});

test('the quota snapshot leaks no key material', () => {
  const json = JSON.stringify(loadPool(quotaEnv({ GEMINI_MODELS: 'm-one' })).quotaSnapshot());
  assert.ok(!json.includes('g-test'), 'key leaked into the quota payload');
});

test("Google's own 429 numbers are captured instead of being guessed", () => {
  const pool = loadPool(quotaEnv({ GEMINI_MODELS: 'm-one' }));
  /* The real shape Google returns on a free-tier 429. */
  const details = pool.readGoogleQuota({
    error: { details: [
      { '@type': 'type.googleapis.com/google.rpc.QuotaFailure', violations: [{
        quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier', quotaValue: '20'
      }] },
      { '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '6810s' }
    ] }
  });
  assert.strictEqual(details.dailyLimit, 20, 'daily cap read from the 429');
  assert.strictEqual(details.retryAfterSeconds, 6810, 'recovery time read from the 429');

  /* Google may also send a compound duration. */
  assert.strictEqual(pool.readGoogleQuota({ error: { details: [
    { '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '1h53m7s' }
  ] } }).retryAfterSeconds, 6787);

  /* An error with no quota details must not fabricate figures. */
  const none = pool.readGoogleQuota({ error: { message: 'boom' } });
  assert.strictEqual(none.dailyLimit, null);
  assert.strictEqual(none.retryAfterSeconds, null);

  /* Nonsense must stay null rather than become NaN and reach the UI. */
  assert.strictEqual(pool.readGoogleQuota({ error: { details: [
    { '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: 'soon' }
  ] } }).retryAfterSeconds, null);
});

test('the daily allowance caps generations and refuses the next one', () => {
  const pool = loadPool(quotaEnv({ GEMINI_MODELS: 'm-one', PDF_GENERATIONS_PER_DAY: '3' }));
  const req = { headers: {}, socket: { remoteAddress: '203.0.113.9' } };

  assert.deepStrictEqual(pool.pdfAllowanceFor(req).remaining, 3, 'full before any use');
  for (let i = 1; i <= 3; i++) {
    const spent = pool.consumePdfAllowance(req);
    assert.strictEqual(spent.remaining, 3 - i, `remaining after ${i}`);
  }
  assert.strictEqual(pool.consumePdfAllowance(req), null, 'refused once at the limit');
  assert.strictEqual(pool.pdfAllowanceFor(req).remaining, 0, 'refusal did not go negative');
});

test('the allowance is per caller, and one caller cannot drain another', () => {
  const pool = loadPool(quotaEnv({ GEMINI_MODELS: 'm-one', PDF_GENERATIONS_PER_DAY: '2' }));
  const a = { headers: {}, socket: { remoteAddress: '203.0.113.1' } };
  const b = { headers: {}, socket: { remoteAddress: '203.0.113.2' } };
  pool.consumePdfAllowance(a);
  pool.consumePdfAllowance(a);
  assert.strictEqual(pool.consumePdfAllowance(a), null, 'caller A is capped');
  assert.strictEqual(pool.pdfAllowanceFor(b).remaining, 2, 'caller B is unaffected');
});

test('the allowance is stored only as a digest, never a raw address', () => {
  const pool = loadPool(quotaEnv({ GEMINI_MODELS: 'm-one', PDF_GENERATIONS_PER_DAY: '2' }));
  const req = { headers: {}, socket: { remoteAddress: '198.51.100.44' } };
  pool.consumePdfAllowance(req);
  const stored = JSON.stringify(pool.quotaForToday());
  assert.ok(!stored.includes('198.51.100.44'), 'raw IP persisted to disk');
  assert.match(stored, /allowances/);
});

test('a zero limit disables the cap rather than blocking everyone', () => {
  const pool = loadPool(quotaEnv({ GEMINI_MODELS: 'm-one', PDF_GENERATIONS_PER_DAY: '0' }));
  const req = { headers: {}, socket: { remoteAddress: '203.0.113.7' } };
  for (let i = 0; i < 25; i++) pool.consumePdfAllowance(req);
  assert.strictEqual(pool.pdfAllowanceFor(req).unlimited, true);
  assert.strictEqual(pool.pdfAllowanceFor(req).remaining, null);
});

/* callGeminiOnce retries a 503 twice on the SAME model before giving
   up, so the script must supply three 503s before the rotation branch
   is ever reached. That mirrors real behaviour: a model that is busy
   briefly is retried in place first, and only a persistent 503 moves
   the request to a sibling. */
test('a 503 on a busy model rotates instead of ending the request', () => withFetch([
  { status: 503, body: { error: { message: 'high demand' } } },
  { status: 503, body: { error: { message: 'high demand' } } },
  { status: 503, body: { error: { message: 'high demand' } } },
  { status: 200, body: { output_text: 'sibling handled it' } }
], async calls => {
  const pool = loadPool(quotaEnv({ GEMINI_MODELS: 'busy-one,calm-two' }));
  assert.strictEqual(await pool.callGemini([{ text: 'hi' }], {}), 'sibling handled it');
  assert.strictEqual(calls.length, 4, 'three in-place retries, then one sibling attempt');
  assert.match(JSON.parse(calls[3].init.body).model, /calm-two$/);
}));

test('a busy model is not recorded as spent, so it returns on the next call', () => withFetch([
  { status: 503, body: { error: { message: 'high demand' } } },
  { status: 503, body: { error: { message: 'high demand' } } },
  { status: 503, body: { error: { message: 'high demand' } } },
  { status: 200, body: { output_text: 'ok' } }
], async calls => {
  const pool = loadPool(quotaEnv({ GEMINI_MODELS: 'busy-one,calm-two' }));
  await pool.callGemini([{ text: 'hi' }], {});
  const snap = pool.quotaSnapshot();
  const busy = Array.from(snap.models).find(m => m.slug === 'busy-one');
  const calm = Array.from(snap.models).find(m => m.slug === 'calm-two');
  assert.strictEqual(busy.status, 'busy', 'busy is its own state, not exhausted');
  assert.strictEqual(calm.status, 'available');
  /* Busy models still count as usable: they have quota, just not right now. */
  assert.strictEqual(snap.usableModels, 2);
}));

/* A 503 on the final model has nowhere left to go, so it must surface
   as a clean error rather than silently reporting "out of quota". */
test('a 503 on the last model surfaces as a demand error, not a quota error', () => withFetch([
  { status: 503, body: { error: { message: 'high demand' } } },
  { status: 503, body: { error: { message: 'high demand' } } },
  { status: 503, body: { error: { message: 'high demand' } } }
], async calls => {
  const error = await loadPool(quotaEnv({ GEMINI_MODELS: 'only-one' }))
    .callGemini([{ text: 'hi' }], {}).then(() => null, e => e);
  assert.ok(error, 'expected a throw');
  assert.match(error.message, /high demand/i);
  assert.doesNotMatch(error.message, /out of quota for today/);
}));

/* ---------- 10. Status endpoint leaks no secrets ---------- */
test('providerStatus never exposes a key', () => {
  const rows = loadPool(FULL_POOL).providerStatus();
  const json = JSON.stringify(rows);
  ['g-test','q-test','a-test','o-test','x-test'].forEach(k =>
    assert.ok(!json.includes(k), `key ${k} leaked in status`));
  /* Every declared provider appears whether or not it has a key, so the UI
     can render it as "not enabled" instead of silently omitting it. */
  assert.strictEqual(rows.length, 5);
  assert.deepStrictEqual(Array.from(rows, r => r.id), ['gemini','groq','xai','openrouter','explabs']);
  assert.strictEqual(rows.find(r => r.id === 'gemini').documents, true);
  assert.strictEqual(rows.find(r => r.id === 'groq').documents, false);
  assert.strictEqual(rows.find(r => r.id === 'explabs').documents, true);
});

/* ---------- xAI Grok safety: never silently swallow a PDF ---------- */
test('xai is wired and reachable for text', () => {
  const pool = loadPool(XAI_ONLY);
  assert.deepStrictEqual(ids(pool.configuredProviders()), ['xai']);
  assert.ok(String(pool.OPENAI_COMPATIBLE.xai.url).includes('api.x.ai'),
    'xai must post to the xAI host, not a guessed endpoint');
});

test('a PDF never reaches xai, because it needs the Files API', () => {
  /* Grok reads PDFs, but only as a file_id from the Files API. Marking it
     documents:true without that upload path would send a PDF to a text-only
     chat endpoint and return a fluent, entirely invented study pack. */
  const pool = loadPool(FULL_POOL);
  assert.strictEqual(pool.providerStatus().find(r => r.id === 'xai').documents, false);
  assert.deepStrictEqual(ids(pool.configuredProviders({ requireDocuments: true })),
    ['gemini', 'explabs']);
});

/* ---------- 8. No keys configured ---------- */
test('text request with zero keys -> AI_NOT_CONFIGURED', async () => {
  const error = await loadPool(NO_KEYS).callAI([{ text: 'hi' }], {}).then(() => null, e => e);
  assert.ok(error, 'expected a throw');
  assert.strictEqual(error.code, 'AI_NOT_CONFIGURED');
  assert.strictEqual(error.status, 503);
});

/* ---------- 11. Multiple Gemini keys multiply free quota ----------
   One key = one daily bucket. When Google 429s that key, every model on
   it dies at once (the "0 of N ready" wall). A second key is a second
   bucket, so rotation must walk keys first, then models. */
test('geminiKeys collects the primary, comma-list and numbered keys, deduped', () => {
  const pool = loadPool(env({
    GEMINI_API_KEY: 'k1',
    GEMINI_API_KEYS: 'k2, k1 ,k3',   /* k1 duplicate must collapse */
    GEMINI_API_KEY_2: 'k4',
    GEMINI_API_KEY_3: '   '           /* blank dropped */
  }));
  assert.deepStrictEqual(Array.from(pool.geminiKeys()), ['k1', 'k2', 'k3', 'k4']);
});

test('no gemini key -> geminiKeys is empty', () => {
  assert.deepStrictEqual(Array.from(loadPool(env({})).geminiKeys()), []);
});

test('a 429 on every model of key1 rotates to key2 and succeeds', () => withFetch([
  { status: 429, body: { error: { message: 'quota' } } },   // k1 m-one
  { status: 429, body: { error: { message: 'quota' } } },   // k1 m-two
  { status: 200, body: { output_text: 'key2 answered' } }   // k2 m-one
], async calls => {
  const pool = loadPool(env({
    GEMINI_API_KEY: 'key-one', GEMINI_API_KEY_2: 'key-two',
    GEMINI_MODELS: 'm-one,m-two'
  }));
  assert.strictEqual(await pool.callGemini([{ text: 'hi' }], {}), 'key2 answered');
  assert.strictEqual(calls.length, 3, 'both models on key1, then the first on key2');
  assert.ok(calls[0].url.includes('key=key-one') && calls[1].url.includes('key=key-one'),
    'the first two calls must carry key-one');
  assert.ok(calls[2].url.includes('key=key-two'), 'the recovery call must carry key-two');
}));

test('a second key makes gemini configured even with no primary key', () => {
  const pool = loadPool(env({ GEMINI_API_KEY_2: 'only-two' }));
  assert.deepStrictEqual(ids(pool.configuredProviders()), ['gemini']);
  assert.deepStrictEqual(ids(pool.configuredProviders({ requireDocuments: true })), ['gemini']);
});

test('the quota snapshot reports how many independent keys are active', () => {
  const snap = loadPool(quotaEnv({
    GEMINI_MODELS: 'm-one',
    GEMINI_API_KEY: 'k1', GEMINI_API_KEYS: 'k2,k3'
  })).quotaSnapshot();
  assert.strictEqual(snap.keys, 3);
  assert.ok(!JSON.stringify(snap).includes('k1'), 'a key leaked into the snapshot');
});

test('providerStatus never leaks any of several gemini keys', () => {
  const json = JSON.stringify(loadPool(env({
    GEMINI_API_KEY: 'secret-one', GEMINI_API_KEY_2: 'secret-two'
  })).providerStatus());
  assert.ok(!json.includes('secret-one') && !json.includes('secret-two'), 'a gemini key leaked');
});

/* ---------- 12. OpenAI paid failover (disabled by default) ---------- */
test('openai is absent from the pool by default', () => {
  const pool = loadPool(FULL_POOL);
  assert.strictEqual(pool.openaiEnabled(), false);
  assert.ok(!ids(pool.configuredProviders()).includes('openai'));
  assert.ok(!ids(pool.configuredProviders({ requireDocuments: true })).includes('openai'));
  assert.strictEqual(pool.providerStatus().length, 5, 'default pool stays at five providers');
});

test('a key alone does not enable openai — the switch must be on', () => {
  const pool = loadPool(env({ OPENAI_API_KEY: 'sk-x' }));
  assert.strictEqual(pool.openaiEnabled(), false);
  assert.ok(!ids(pool.configuredProviders()).includes('openai'));
});

test('the switch alone (no key) does not enable openai', () => {
  const pool = loadPool(env({ ENABLE_OPENAI_FAILOVER: '1' }));
  assert.strictEqual(pool.openaiEnabled(), false);
});

test('switch + key enables openai, appended last, document-capable', () => {
  const pool = loadPool(env({
    GEMINI_API_KEY: 'g-test', GROQ_API_KEY: 'q-test', XAI_API_KEY: 'a-test',
    OPENROUTER_API_KEY: 'o-test', EXPLABS_API_KEY: 'x-test',
    ENABLE_OPENAI_FAILOVER: '1', OPENAI_API_KEY: 'sk-x'
  }));
  assert.strictEqual(pool.openaiEnabled(), true);
  assert.deepStrictEqual(ids(pool.configuredProviders()),
    ['gemini', 'groq', 'xai', 'openrouter', 'explabs', 'openai']);
  assert.ok(ids(pool.configuredProviders({ requireDocuments: true })).includes('openai'));
  assert.strictEqual(pool.providerStatus().length, 6);
});

test('openai is document-capable even when it is the only provider', () => {
  const pool = loadPool(env({ ENABLE_OPENAI_FAILOVER: '1', OPENAI_API_KEY: 'sk-x' }));
  assert.deepStrictEqual(ids(pool.configuredProviders({ requireDocuments: true })), ['openai']);
});

test('openai answers a PDF via the Responses API input_file shape', () => withFetch([
  { status: 200, body: { output_text: '{"study":"by openai"}' } }
], async calls => {
  const pool = loadPool(env({ ENABLE_OPENAI_FAILOVER: '1', OPENAI_API_KEY: 'sk-x' }));
  const answer = await pool.callOpenAI(
    [{ text: 'analyze' }, { inlineData: { mimeType: 'application/pdf', data: 'QUJD' } }],
    { requiresDocument: true, schema: { type: 'object' } }
  );
  assert.strictEqual(answer, '{"study":"by openai"}');
  assert.match(calls[0].url, /api\.openai\.com\/v1\/responses/);
  const sent = JSON.parse(calls[0].init.body);
  const filePart = sent.input[sent.input.length - 1].content.find(c => c.type === 'input_file');
  assert.ok(filePart, 'the PDF must ride as an input_file part');
  assert.strictEqual(filePart.file_data, 'data:application/pdf;base64,QUJD');
  assert.match(sent.input[sent.input.length - 1].content[0].text, /valid JSON object/,
    'a JSON answer must be requested on document stages');
}));

test('openai is reached only after gemini and the gateway are out (full pool)', () => withFetch([
  { status: 429, body: { error: { message: 'quota' } } },                 // gemini
  { status: 429, body: { error: { message: 'quota' } } },                 // explabs gateway
  { status: 200, body: { output_text: 'openai rescued it' } }             // openai
], async calls => {
  const pool = loadPool(env({
    GEMINI_API_KEY: 'g-test', EXPLABS_API_KEY: 'x-test',
    ENABLE_OPENAI_FAILOVER: '1', OPENAI_API_KEY: 'sk-x'
  }));
  const answer = await pool.callAI([{ text: 'hi' }], {});
  assert.strictEqual(answer, 'openai rescued it');
  assert.match(calls[2].url, /api\.openai\.com/, 'openai is the last document fallback');
}));

test('openai 429 rotates instead of aborting', () => withFetch([
  { status: 429, body: { error: { message: 'rate' } } }
], async calls => {
  const pool = loadPool(env({ ENABLE_OPENAI_FAILOVER: '1', OPENAI_API_KEY: 'sk-x' }));
  const err = await pool.callOpenAI([{ text: 'hi' }], {}).then(() => null, e => e);
  assert.ok(err && err.rotate, 'a 429 must carry the rotate flag so the pool moves on');
}));

test('a rejected openai key does not rotate', () => withFetch([
  { status: 401, body: { error: { message: 'bad key' } } }
], async calls => {
  const pool = loadPool(env({ ENABLE_OPENAI_FAILOVER: '1', OPENAI_API_KEY: 'sk-x' }));
  const err = await pool.callOpenAI([{ text: 'hi' }], {}).then(() => null, e => e);
  assert.strictEqual(err.status, 401);
  assert.match(err.message, /OPENAI_API_KEY/);
  assert.strictEqual(calls.length, 1);
}));

test('providerStatus never leaks the openai key', () => {
  const json = JSON.stringify(loadPool(env({ ENABLE_OPENAI_FAILOVER: '1', OPENAI_API_KEY: 'sk-secret' })).providerStatus());
  assert.ok(!json.includes('sk-secret'), 'openai key leaked into status');
});

/* ---------- runner ---------- */
(async () => {
  let passed = 0;
  let failed = 0;
  for (const { name, fn } of tests) {
    try{ await fn(); passed++; console.log('  ok   ' + name); }
    catch (error){ failed++; console.log('  FAIL ' + name + '\n       ' + error.message); }
  }
  console.log('\n' + (failed === 0 ? '*** PASS ***  ' : '*** FAIL ***  ') + passed + ' passed, ' + failed + ' failed\n');
  process.exit(failed === 0 ? 0 : 1);
})();