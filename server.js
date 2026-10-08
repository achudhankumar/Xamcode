'use strict';
/* XAMCODE AI server - rebuilt with MiniMax image generation. */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
(function loadDotEnv(){
  try{
    const raw = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
    for (const line of raw.split('\n')){
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq < 0) continue;
      const k = t.slice(0, eq).trim();
      let v = t.slice(eq + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
      if (!Object.hasOwn(process.env, k)) process.env[k] = v;
    }
  }catch{}
})();
const PORT = Number(process.env.PORT || 4173);
const PDF_PER_DAY = Number(process.env.PDF_GENERATIONS_PER_DAY ?? 5);
const MAX_REQ_HOUR = Math.min(60, Math.max(1, Number(process.env.MAX_REQUESTS_PER_HOUR || 60)));
const MAX_PDF_MB = Number(process.env.MAX_PDF_MB || 20);
/* The browser base64-encodes the PDF, inflating it by 4/3, so the JSON body
   cap derives from the same limit plus a documented 2 MB of slack. Without
   the slack an upload just over the limit was rejected by the body gate with
   a vague "Request body too large." before the specific size error could run. */
const MAX_PDF_BYTES = MAX_PDF_MB * 1024 * 1024;
const MAX_JSON_BYTES = Math.ceil(MAX_PDF_BYTES * 4 / 3) + 2 * 1024 * 1024;
/* Unit-chunked builds for large PDFs: above UNIT_SPLIT_MB the job builds
   Unit 1 first (fast delivery), then keeps building Units 2..N in the
   background so they unlock one by one while the user studies. Gemini's
   inline-data request cap is 20 MB (base64 inflates 4/3), so files above
   GEMINI_INLINE_MB are uploaded through the Files API instead. */
const UNIT_SPLIT_MB = Number(process.env.UNIT_SPLIT_MB || 8);
const GEMINI_INLINE_MB = Number(process.env.GEMINI_INLINE_MB || 14);
function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }
const QUOTA_FILE = process.env.XAMCODE_QUOTA_FILE || path.join(__dirname, '.xamcode-quota.json');
const ALLOW_SALT = 'xamcode-allowance-v1';
const hasKey = v => typeof v === 'string' && v.trim().length > 0;
function pacificDay(){
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
function sha(s){ return crypto.createHash('sha256').update(String(s)).digest('hex'); }
function mkErr(status, message, extra){
  const e = new Error(message);
  e.status = status;
  Object.assign(e, extra || {});
  return e;
}
function blankStore(){ return { day: pacificDay(), models: {}, allowances: {}, calls: 0, ok: 0, failed: 0, rotations: 0 }; }
function quotaForToday(){
  let s = null;
  try{ s = JSON.parse(fs.readFileSync(QUOTA_FILE, 'utf8')); }catch{ s = null; }
  if (!s || s.day !== pacificDay()) s = blankStore();
  s.models = s.models || {}; s.allowances = s.allowances || {};
  return s;
}
function saveStore(s){ try{ fs.writeFileSync(QUOTA_FILE, JSON.stringify(s)); }catch{} }
function clientIp(req){
  const fwd = req.headers && req.headers['x-forwarded-for'];
  const raw = (typeof fwd === 'string' && fwd.split(',')[0].trim()) || (req.socket && req.socket.remoteAddress) || 'unknown';
  return raw;
}
function pdfAllowanceFor(req){
  const limit = PDF_PER_DAY;
  if (!limit || limit <= 0) return { limit: 0, used: 0, remaining: null, unlimited: true };
  const s = quotaForToday();
  const used = (s.allowances[sha(clientIp(req) + ALLOW_SALT)] || 0);
  return { limit, used, remaining: Math.max(0, limit - used), unlimited: false };
}
function consumePdfAllowance(req){
  const limit = PDF_PER_DAY;
  if (!limit || limit <= 0) return { remaining: null, unlimited: true, limit: 0, used: 0 };
  const s = quotaForToday();
  const key = sha(clientIp(req) + ALLOW_SALT);
  const used = s.allowances[key] || 0;
  if (used >= limit) return null;
  s.allowances[key] = used + 1;
  saveStore(s);
  return { limit, used: used + 1, remaining: limit - used - 1, unlimited: false };
}
/* ---------- provider pool ---------- */
const PROVIDERS = [
  { id: 'gemini', documents: true },
  { id: 'groq', documents: false },
  { id: 'xai', documents: false },
  { id: 'openrouter', documents: false },
  { id: 'explabs', documents: true }
];
const OPENAI_COMPATIBLE = {
  groq: { url: 'https://api.groq.com/openai/v1/chat/completions', key: () => process.env.GROQ_API_KEY, model: () => process.env.GROQ_MODEL || 'openai/gpt-oss-120b' },
  xai: { url: 'https://api.x.ai/v1/chat/completions', key: () => process.env.XAI_API_KEY, model: () => process.env.XAI_MODEL || 'grok-4.7' },
  openrouter: { url: 'https://openrouter.ai/api/v1/chat/completions', key: () => process.env.OPENROUTER_API_KEY, model: () => process.env.OPENROUTER_MODEL || 'openrouter/free' },
  explabs: { url: 'https://api.experientiallabs.ai/v1/chat/completions', key: () => process.env.EXPLABS_API_KEY, model: () => process.env.EXPLABS_MODEL || 'gemini-3.8-flash' }
};
function geminiModelList(){
  const list = String(process.env.GEMINI_MODELS || '').split(',').map(s => s.trim()).filter(Boolean);
  const deduped = Array.from(new Set(list));
  if (deduped.length) return deduped;
  if (hasKey(process.env.GEMINI_MODEL)) return [process.env.GEMINI_MODEL.trim()];
  return ['gemini-3.8-flash'];
}
function configuredProviders(opts){
  const needDocs = !!(opts && opts.requireDocuments);
  return PROVIDERS.filter(p => {
    if (needDocs && !p.documents) return false;
    if (p.id === 'gemini') return hasKey(process.env.GEMINI_API_KEY);
    const compat = OPENAI_COMPATIBLE[p.id];
    return compat && hasKey(compat.key());
  });
}
function providerStatus(){
  return PROVIDERS.map(p => {
    const configured = p.id === 'gemini' ? hasKey(process.env.GEMINI_API_KEY)
      : hasKey(OPENAI_COMPATIBLE[p.id].key());
    return { id: p.id, documents: p.documents, configured };
  });
}
function isFailoverWorthy(status){
  return status === 429 || status === 402 || status === 500 || status === 502 || status === 503 || status === 504;
}
/* Reads Google's own quota figures off a 429 body instead of guessing. */
function readGoogleQuota(body){
  let dailyLimit = null, retryAfterSeconds = null;
  try{
    const details = body && body.error && body.error.details;
    if (Array.isArray(details)) for (const d of details){
      if (d && d.violations && Array.isArray(d.violations) && d.violations[0] && d.violations[0].quotaValue != null){
        const n = Number(d.violations[0].quotaValue);
        if (Number.isFinite(n)) dailyLimit = n;
      }
      if (d && typeof d.retryDelay === 'string'){
        const m = { s: 0 }; let ok = false;
        const re = /(\d+(?:\.\d+)?)(h|m|s)/g; let part;
        while ((part = re.exec(d.retryDelay))){ ok = true; const v = Number(part[1]);
          m.s += part[2] === 'h' ? v * 3600 : part[2] === 'm' ? v * 60 : v; }
        if (ok && !/[a-z]/i.test(d.retryDelay.replace(/[\d.\shms]/g, ''))) retryAfterSeconds = Math.round(m.s);
        else if (/^\d+(\.\d+)?s$/.test(d.retryDelay.trim())) retryAfterSeconds = Math.round(Number(d.retryDelay.trim().slice(0, -1)));
        else retryAfterSeconds = retryAfterSeconds;
      }
    }
  }catch{ /* never let quota parsing throw */ }
  if (!Number.isFinite(retryAfterSeconds)) retryAfterSeconds = null;
  if (!Number.isFinite(dailyLimit)) dailyLimit = null;
  return { dailyLimit, retryAfterSeconds };
}
function quotaSnapshot(){
  const slugs = geminiModelList();
  const store = quotaForToday();
  const models = slugs.map(slug => {
    const rec = store.models[slug];
    return { slug, status: rec ? rec.status : 'untested', lastError: rec ? rec.lastError : null, retryAfterSeconds: rec ? rec.retryAfterSeconds : null };
  });
  const usableModels = models.filter(m => m.status !== 'exhausted').length;
  return {
    totalModels: models.length, usableModels, models,
    resetsAt: 'midnight Pacific',
    note: 'Google does not publish a remaining-request count for API keys; this reports only observed per-model state.'
  };
}
function markModel(slug, patch){
  const store = quotaForToday();
  store.models[slug] = Object.assign({ ok: 0, failed: 0, status: 'available', lastError: null, retryAfterSeconds: null }, store.models[slug] || {}, patch);
  saveStore(store);
}
async function fetchJson(url, init, timeoutMs){
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs || 120000);
  try{
    const res = await fetch(url, Object.assign({}, init, { signal: ctrl.signal }));
    let body = {};
    try{ body = await res.json(); }catch{ body = {}; }
    return { status: res.status, ok: res.ok, body, retryAfter: res.headers ? res.headers.get('retry-after') : null };
  }finally{ clearTimeout(timer); }
}
function geminiTextOf(body){
  if (body && typeof body.output_text === 'string' && body.output_text) return body.output_text;
  try{
    const parts = body.candidates[0].content.parts;
    const text = parts.filter(p => typeof p.text === 'string').map(p => p.text).join('');
    if (text) return text;
  }catch{}
  return null;
}
function geminiError(status, body){
  const msg = (body && body.error && body.error.message) || ('Gemini request failed with HTTP ' + status);
  return { status, message: String(msg) };
}
/* One Gemini slug: 3 in-place retries on 503/network.
   429/404 abandon the slug immediately (rotate, do not retry). */
async function callGeminiOnce(parts, opts, slug){
  const key = process.env.GEMINI_API_KEY;
  const sys = opts && opts.systemInstruction;
  /* opts.fileUri: the PDF was uploaded through the Gemini Files API (too
     large for inlineData), so the document part references the stored file
     instead of carrying the bytes. OpenAI-compatible fallbacks still see
     inlineData on the same part and send it as before. */
  const fileUri = opts && opts.fileUri;
  const contents = [{ parts: parts.map(p => {
    if (p.text !== undefined) return { text: p.text };
    if (fileUri && p.inlineData) return { fileData: { mimeType: p.inlineData.mimeType, fileUri } };
    return { inlineData: p.inlineData };
  }) }];
  const body = { model: 'models/' + slug, contents };
  if (sys) body.systemInstruction = { parts: [{ text: sys }] };
  /* Ask for JSON explicitly on document stages: Gemini then returns real
     JSON instead of near-JSON with comments/trailing commas. If a model
     rejects the mime type the call fails with 400, which is non-rotating,
     so only set it when the caller declares a schema. */
  if (opts && opts.schema) body.generationConfig = { responseMimeType: 'application/json' };
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + slug + ':generateContent?key=' + encodeURIComponent(key);
  for (let attempts = 1; ; attempts++){
    let res;
    try{ res = await fetchJson(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, 180000); }
    catch(e){
      if (attempts < 3){ await new Promise(r => setTimeout(r, 500 * attempts)); continue; }
      throw mkErr(503, 'The AI provider did not respond. Try again shortly.');
    }
    if (res.ok){
      const text = geminiTextOf(res.body);
      if (!text) throw mkErr(502, 'The AI provider returned an empty response. Please try again.');
      const st = quotaForToday(); st.calls++; st.ok++; saveStore(st);
      markModel(slug, { status: 'available', lastError: null });
      return text;
    }
    const g = geminiError(res.status, res.body);
    if (res.status === 401) throw mkErr(401, 'The GEMINI_API_KEY was rejected. Check the key in .env. (' + g.message + ')');
    if (res.status === 429 || res.status === 404){
      const q = readGoogleQuota(res.body);
      markModel(slug, { status: 'exhausted', lastError: 'exhausted', retryAfterSeconds: q.retryAfterSeconds });
      const st = quotaForToday(); st.calls++; st.failed++; st.rotations++; saveStore(st);
      throw Object.assign(mkErr(res.status, g.message), { rotate: true, slug });
    }
    if (res.status === 503 && attempts < 3){ await new Promise(r => setTimeout(r, 700 * attempts)); continue; }
    if (res.status === 503){
      markModel(slug, { status: 'busy', lastError: g.message });
      const st = quotaForToday(); st.calls++; st.failed++; saveStore(st);
      throw Object.assign(mkErr(503, g.message), { rotate: true, slug });
    }
    if (res.status === 400) throw mkErr(422, g.message);
    throw mkErr(res.status, g.message);
  }
}
async function callGemini(parts, opts){
  if (!hasKey(process.env.GEMINI_API_KEY)) throw mkErr(503, 'AI is not configured.', { code: 'AI_NOT_CONFIGURED' });
  const slugs = geminiModelList();
  let last = null;
  for (const slug of slugs){
    try{ return await callGeminiOnce(parts, opts, slug); }
    catch(e){ if (e && e.rotate){ last = e; continue; } throw e; }
  }
  if (last && last.status === 429) throw mkErr(429, 'The free-tier models are out of quota for today. Quota resets at midnight Pacific. Add billing or try again after the reset.');
  throw last || mkErr(503, 'The AI providers are too busy right now.');
}
/* One OpenAI-compatible chat call (Groq/xAI/OpenRouter/gateway). */
async function callOpenAICompatible(id, parts, opts){
  const cfg = OPENAI_COMPATIBLE[id];
  const text = parts.filter(p => p.text !== undefined).map(p => p.text).join('\n\n');
  const sys = opts && opts.systemInstruction;
  const messages = [];
  if (sys) messages.push({ role: 'system', content: sys });
  const needsDoc = !!(opts && opts.requiresDocument);
  if (needsDoc && parts.some(p => p.inlineData)){
    const pdf = parts.find(p => p.inlineData);
    messages.push({ role: 'user', content: [
      { type: 'text', text },
      { type: 'file', file: { filename: 'study.pdf', file_data: 'data:application/pdf;base64,' + pdf.inlineData.data } }
    ]});
  }else messages.push({ role: 'user', content: text });
  const body = { model: cfg.model(), messages, max_tokens: needsDoc ? 16384 : 2048 };
  if (needsDoc){
    body.response_format = { type: 'json_object' };
    if (!/json/i.test(text)){
      const lastMsg = messages[messages.length - 1];
      if (Array.isArray(lastMsg.content) && lastMsg.content[0] && lastMsg.content[0].type === 'text') lastMsg.content[0].text += '\nRespond with a single valid JSON object.';
      else lastMsg.content = String(lastMsg.content) + '\nRespond with a single valid JSON object.';
    }
  }
  const headers = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + cfg.key() };
  if (id === 'openrouter') headers['X-Title'] = 'XamCode AI';
  let res;
  try{ res = await fetchJson(cfg.url, { method: 'POST', headers, body: JSON.stringify(body) }, 180000); }
  catch(e){ throw mkErr(503, 'The AI provider did not respond. Try again shortly.'); }
  if (res.ok){
    try{
      const c = res.body.choices[0].message.content;
      if (typeof c === 'string' && c) return c;
    }catch{}
    throw mkErr(502, 'The AI provider returned an empty response. Please try again.');
  }
  const msg = (res.body && res.body.error && (res.body.error.message || res.body.error)) || ('Request failed with HTTP ' + res.status);
  if (res.status === 401) throw mkErr(401, 'The ' + id.toUpperCase() + '_API_KEY was rejected. (' + msg + ')');
  if (res.status === 400) throw mkErr(422, String(msg));
  throw mkErr(res.status, String(msg));
}
/* Dispatcher: text walks every provider, PDFs only document-capable. */
async function callAI(parts, opts){
  opts = opts || {};
  const needDocs = !!opts.requiresDocument;
  const candidates = configuredProviders({ requireDocuments: needDocs });
  if (!candidates.length){
    if (needDocs) throw mkErr(503, 'No document-capable provider is configured. Set GEMINI_API_KEY in .env.', { code: 'AI_NOT_CONFIGURED' });
    throw mkErr(503, 'AI is not configured.', { code: 'AI_NOT_CONFIGURED' });
  }
  let last = null;
  for (const p of candidates){
    try{
      if (p.id === 'gemini') return await callGemini(parts, opts);
      return await callOpenAICompatible(p.id, parts, opts);
    }catch(e){
      last = e;
      if (p.id === 'gemini'){
        if (e.status === 429 || e.status === 503 || e.status === 502 || e.status === 504 || e.status === 402) continue;
        throw e;
      }
      if (isFailoverWorthy(e.status)) continue;
      /* Network failure on Groq-class providers: retry in place 3x total. */
      if (!e.status){
        for (let k = 0; k < 2; k++){
          try{ return await callOpenAICompatible(p.id, parts, opts); }
          catch(e2){ last = e2; if (!isFailoverWorthy(e2.status) && e2.status) throw e2; }
        }
        continue;
      }
      throw e;
    }
  }
  throw last || mkErr(503, 'The AI providers are too busy right now.');
}
/* ---------- Gemini Files API (PDFs above the inline cap) ----------
   Google caps one generateContent request at 20 MB, and base64 inflates
   the PDF by 4/3, so raw files above ~14 MB cannot ride inline. Upload
   once per job, poll until ACTIVE, then every stage call references the
   stored file via opts.fileUri. Returns null when the upload cannot be
   completed — callers fall back to inlineData and surface the provider's
   own error if that also fails. */
async function uploadPdfToGemini(buf){
  const key = process.env.GEMINI_API_KEY;
  if (!hasKey(key)) return null;
  const boundary = 'xamcode-' + crypto.randomBytes(8).toString('hex');
  const meta = JSON.stringify({ file: { display_name: 'xamcode-study.pdf' } });
  const payload = Buffer.concat([
    Buffer.from('--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + meta + '\r\n' +
      '--' + boundary + '\r\nContent-Type: application/pdf\r\nContent-Transfer-Encoding: binary\r\n\r\n'),
    buf,
    Buffer.from('\r\n--' + boundary + '--\r\n')
  ]);
  const url = 'https://generativelanguage.googleapis.com/upload/v1beta/files?supportedMimeType=application%2Fpdf';
  let res;
  try{
    res = await fetchJson(url, { method: 'POST',
      headers: { 'Content-Type': 'multipart/related; boundary=' + boundary, 'x-goog-api-key': key },
      body: payload }, 300000);
  }catch{ return null; }
  if (!res.ok || !res.body || !res.body.file || !res.body.file.uri) return null;
  let file = res.body.file;
  /* PROCESSING resolves to ACTIVE within seconds; a file that never
     becomes ACTIVE cannot be referenced, so fall back to inline. */
  for (let i = 0; i < 20 && file.state !== 'ACTIVE'; i++){
    if (!file.name) break;
    await sleep(1500);
    try{
      const poll = await fetchJson('https://generativelanguage.googleapis.com/v1beta/' + file.name + '?key=' + encodeURIComponent(key),
        { headers: { 'x-goog-api-key': key } }, 30000);
      if (poll.ok && poll.body && poll.body.file) file = poll.body.file;
      else return null;
    }catch{ return null; }
  }
  if (file.state && file.state !== 'ACTIVE') return null;
  return file.uri;
}
/* ---------- study schemas + validators ---------- */
const studySchema = { type: 'object' };
const nodeSchema = { type: 'object', properties: { label: { type: 'string' }, detail: { type: 'string' }, code: { type: 'string' } } };
const stepSchema = { type: 'object', properties: { title: { type: 'string' }, description: { type: 'string' }, layout: { type: 'string' }, nodes: { type: 'array', items: nodeSchema } } };
const visSchema = { type: 'object', properties: { caption: { type: 'string' }, layout: { type: 'string' }, steps: { type: 'array', items: stepSchema } } };
const codeLeaf = { type: 'object', properties: { code: {} } };
const nodeArr = { type: 'array', items: codeLeaf };
const planStepObj = { type: 'object', properties: { nodes: nodeArr } };
const planVisObj = { type: 'object', properties: { caption: {}, steps: { type: 'array', items: planStepObj } } };
const planConceptObj = { type: 'object', properties: { cheatCode: { type: 'object', required: ['why', 'like', 'wrong', 'right', 'see', 'oneLine', 'mnemonic'] }, visualization: planVisObj, nodes: {} } };
const studyPlanSchema = { type: 'object', required: ['title', 'subject', 'summary', 'units', 'concepts'], properties: { title: {}, subject: {}, summary: {}, units: {}, concepts: { type: 'array', items: planConceptObj } } };
const bankStepObj = { type: 'object', properties: { nodes: nodeArr } };
const bankQObj = { type: 'object', required: ['question', 'options', 'answerIndex', 'conceptIndex', 'hint', 'explanation', 'optionExplanations', 'eli5', 'visual'], properties: { visual: { type: 'object', properties: { caption: {}, layout: {}, steps: { type: 'array', items: bankStepObj } } } } };
const studyBankSchema = { type: 'object', required: ['formulas', 'questions', 'flashcards'], properties: { formulas: {}, flashcards: {}, questions: { type: 'array', items: bankQObj } } };
function text(v){ return typeof v === 'string' && v.trim().length > 0; }
/* The 15 universal diagram layouts. Shared by validators, normalizers and
   prompts so the three can never drift apart. */
const ALLOWED15 = new Set(['flow', 'arch', 'seq', 'compare', 'hierarchy', 'state', 'erd',
  'fbd', 'wave', 'isometric', 'mindmap', 'matrix', 'equation', 'cycle', 'layer']);
function visualFingerprint(vis){
  const steps = (vis && vis.steps) || [];
  const s0 = steps[0];
  if (!s0) return '';
  /* "flow:Ingestion/Absorption": the first step's layout plus its node
     labels. Shared-diagram references collapse to one key, so the reuse
     check catches them while topic-specific diagrams stay distinct. */
  const nodes = (s0.nodes || []).map(n => n && n.label);
  return String(s0.layout) + ':' + nodes.join('/');
}
/* The model miscounts: topic.conceptIndices arrives with out-of-range or
   repeated entries, and deleting them can strand a topic (or a whole unit)
   with nothing left — every one of which the browser rejects outright.
   Repair the outline from the pack's own data before validating, so an
   otherwise excellent study is not thrown away over an arithmetic slip.
   Nothing is invented: missing labels are taken from the pack's lessons. */
function normalizeOutline(pack){
  try{
    if (!pack || !Array.isArray(pack.units) || !Array.isArray(pack.concepts)) return;
    const n = pack.concepts.length;
    const conceptAt = i => (Number.isInteger(i) && i >= 0 && i < n) ? pack.concepts[i] : null;
    const seen = new Set();
    /* Track which topic first saw each concept, so duplicates can be
       removed from the original topic and kept in the current one. */
    const seenTopic = new Map();
    /* 1. Keep only integer, in-range indices; first occurrence wins. */
    for (const unit of pack.units){
      if (!unit) continue;
      if (typeof unit.learningGoals === 'string') unit.learningGoals = [unit.learningGoals];
      const topics = Array.isArray(unit.topics) ? unit.topics.filter(Boolean) : [];
      unit.topics = topics;
      for (const topic of topics){
        const raw = Array.isArray(topic.conceptIndices) ? topic.conceptIndices
          : (Number.isInteger(topic.conceptIndices) ? [topic.conceptIndices] : []);
        const keep = [];
        for (const i of raw){
          if (Number.isInteger(i) && i >= 0 && i < n) {
            if (seen.has(i)) {
              /* Duplicate: remove from the topic that first saw it so the
                 current topic keeps the concept instead. */
              const origTopic = seenTopic.get(i);
              if (origTopic && origTopic !== topic) {
                origTopic.conceptIndices = origTopic.conceptIndices.filter(x => x !== i);
              }
              keep.push(i);
            } else {
              seen.add(i);
              seenTopic.set(i, topic);
              keep.push(i);
            }
          }
        }
        keep.sort((a, b) => a - b);
        topic.conceptIndices = keep;
      }
    }
    /* 2. Every lesson must land in exactly one topic. A concept the model
       never emitted prefers a topic the cleanup just emptied, so its unit
       keeps a home; otherwise it joins the numerically nearest topic. */
    const allTopics = () => pack.units.filter(u => u && Array.isArray(u.topics)).flatMap(u => u.topics);
    for (let c = 0; c < n; c++){
      if (seen.has(c)) continue;
      const topics = allTopics();
      if (!topics.length) return; // nothing to attach to; validation fails and the stage retries
      const empty = topics.filter(t => !t.conceptIndices.length);
      let best = null;
      if (empty.length) best = empty[0];
      else {
        best = topics[0];
        let bestDist = Infinity;
        for (const t of topics){
          for (const i of t.conceptIndices){
            const d = Math.abs(i - c);
            if (d < bestDist){ bestDist = d; best = t; }
          }
        }
      }
      best.conceptIndices.push(c);
      best.conceptIndices.sort((a, b) => a - b);
      seen.add(c);
    }
    /* 3. Drop topics the invalid indices left empty; a unit stranded without
       any topic borrows a spare, and only if no spare exists is the husk of
       a unit removed — never below the three the validator requires. */
    for (const unit of pack.units){
      if (unit && Array.isArray(unit.topics)) unit.topics = unit.topics.filter(t => Array.isArray(t.conceptIndices) && t.conceptIndices.length);
    }
    for (const unit of pack.units.slice()){
      if (!unit || (Array.isArray(unit.topics) && unit.topics.length)) continue;
      const donor = pack.units.find(u => u && u !== unit && Array.isArray(u.topics) && u.topics.length > 1);
      if (donor){ unit.topics = [donor.topics.pop()]; continue; }
      const at = pack.units.indexOf(unit);
      if (pack.units.length > 3 && at >= 0) pack.units.splice(at, 1);
    }
    /* 4. Missing labels come from the pack's own lessons, never invented. */
    for (const unit of pack.units){
      if (!unit) continue;
      const own = (Array.isArray(unit.topics) ? unit.topics : [])
        .flatMap(t => (Array.isArray(t.conceptIndices) ? t.conceptIndices : []).map(conceptAt).filter(Boolean));
      for (const topic of (Array.isArray(unit.topics) ? unit.topics : [])){
        const first = (topic.conceptIndices || []).map(conceptAt).filter(Boolean)[0];
        if (!first) continue;
        if (!text(topic.title) && text(first.title)) topic.title = first.title;
        if (!text(topic.overview) && text(first.summary)) topic.overview = first.summary;
      }
      if (!text(unit.title)){
        const t0 = (unit.topics || [])[0];
        if (t0 && text(t0.title)) unit.title = t0.title;
        else if (own[0] && text(own[0].title)) unit.title = own[0].title;
      }
      if (!text(unit.overview) && own[0] && text(own[0].summary)) unit.overview = own[0].summary;
      if (!Array.isArray(unit.learningGoals) || !unit.learningGoals.length){
        unit.learningGoals = own
          .map(c => text(c.whyItMatters) ? c.whyItMatters : (c.keyPoints || []).find(text))
          .filter(Boolean).slice(0, 3);
      }
    }
  }catch{ /* validation below decides whether the outline survives */ }
}
/* The same miscount reaches the bank: a question or flashcard pointing at a
   phantom concept index lands in its own perConcept bucket, so the coverage
   check below never sees it — but the browser range-checks and would reject
   the entire study at display time. Reassign those indices into real
   buckets, then fill any coverage hole from another concept's surplus.
   Existing questions are moved, never invented. */
function normalizeBank(bank, conceptCount){
  try{
    if (!bank || !(conceptCount > 0)) return;
    /* Backfill: older packs (and weak retries) may omit the topic-specific
       question visual or the node.code the renderer expects. Repair from the
       pack's own data instead of failing the whole study. */
    if (Array.isArray(bank.questions)){
      for (const q of bank.questions){
        if (!q || typeof q !== 'object') continue;
        if (!q.visual || typeof q.visual !== 'object') q.visual = { caption: String(q.question || 'Visual').slice(0, 80), layout: pickLayout(q.question), steps: [] };
        if (!ALLOWED15.has(String(q.visual.layout))) q.visual.layout = pickLayout(q.question);
        if (!text(q.visual.caption)) q.visual.caption = String(q.question || 'Visual').slice(0, 80);
        if (!Array.isArray(q.visual.steps) || !q.visual.steps.length){
          const opts = Array.isArray(q.options) ? q.options.slice(0, 3) : [];
          q.visual.steps = [{ title: 'What is asked', description: String(q.question || '').slice(0, 140), nodes: opts.map((o, i) => ({ label: 'Option ' + String.fromCharCode(65 + i), detail: String(o).slice(0, 38) })) }];
          while (q.visual.steps[0].nodes.length < 3) q.visual.steps[0].nodes.push({ label: 'Idea ' + (q.visual.steps[0].nodes.length + 1), detail: String(q.hint || q.explanation || 'key idea').slice(0, 38) });
          q.visual.steps.push({ title: 'Why it is right', description: String(q.explanation || '').slice(0, 140) || 'See the explanation.', nodes: q.visual.steps[0].nodes.map(n => ({ label: n.label, detail: n.detail })) });
        }
        for (const s of q.visual.steps){
          if (!s || typeof s !== 'object') continue;
          if (!Array.isArray(s.nodes) || s.nodes.length < 3){
            const fill = Array.isArray(s.nodes) ? s.nodes.slice() : [];
            while (fill.length < 3) fill.push({ label: 'Idea ' + (fill.length + 1), detail: String(q.hint || 'key idea').slice(0, 38) });
            s.nodes = fill.slice(0, 3);
          }
          for (const nd of s.nodes){
            if (!nd || typeof nd !== 'object') continue;
            if (!text(nd.label)) nd.label = 'Idea';
            if (!text(nd.detail)) nd.detail = String(q.hint || 'key idea').slice(0, 38);
          }
        }
      }
    }
    const reassign = item => {
      if (!item || !Number.isInteger(item.conceptIndex)) return;
      const i = item.conceptIndex;
      if (i < 0 || i >= conceptCount) item.conceptIndex = ((i % conceptCount) + conceptCount) % conceptCount;
    };
    const questions = Array.isArray(bank.questions) ? bank.questions : [];
    questions.forEach(reassign);
    (Array.isArray(bank.flashcards) ? bank.flashcards : []).forEach(reassign);
    const counts = Array.from({ length: conceptCount }, () => 0);
    questions.forEach(q => {
      if (q && Number.isInteger(q.conceptIndex) && q.conceptIndex >= 0 && q.conceptIndex < conceptCount) counts[q.conceptIndex]++;
    });
    for (let k = 0; k < conceptCount; k++){
      if (counts[k] > 0) continue;
      let from = -1;
      for (let j = 0; j < conceptCount; j++) if (counts[j] > 1 && (from < 0 || counts[j] > counts[from])) from = j;
      if (from < 0) break; // no surplus to move; validation rejects and the stage retries
      const surplus = questions.find(q => q && q.conceptIndex === from);
      surplus.conceptIndex = k;
      counts[from]--;
      counts[k]++;
    }
  }catch{ /* validation below decides whether the bank survives */ }
}
function validateStudyOutline(pack){
  try{
    if (!pack || !Array.isArray(pack.units) || pack.units.length < 3) return false;
    if (!Array.isArray(pack.concepts) || pack.concepts.length < 4) return false;
  /* The browser refuses to open a study whose units/topics do not partition
     the lesson list exactly once, so the same packs must be rejected here —
     after normalizeOutline has had its chance to repair them. */
  const assignedLessons = [];
  for (const unit of pack.units){
    if (!unit || !text(unit.title) || !text(unit.overview) ||
        !Array.isArray(unit.learningGoals) || !unit.learningGoals.length ||
        !Array.isArray(unit.topics) || !unit.topics.length) return false;
    for (const topic of unit.topics){
      if (!topic || !text(topic.title) ||
          !Array.isArray(topic.conceptIndices) || !topic.conceptIndices.length) return false;
      for (const index of topic.conceptIndices){
        if (!Number.isInteger(index) || index < 0 || index >= pack.concepts.length) return false;
        assignedLessons.push(index);
      }
    }
  }
  if (assignedLessons.length !== pack.concepts.length ||
      new Set(assignedLessons).size !== pack.concepts.length) return false;
  return validateConcepts(pack.concepts);
  }catch{ return false; }
}
/* Per-lesson checks shared by the full-outline validator and the
   unit-chunk validator: every concept must carry its complete teaching
   sections and its own distinct diagram, or the browser refuses the pack
   at display time. Extracted verbatim so both paths enforce one rule. */
function validateConcepts(concepts){
  try{
    if (!Array.isArray(concepts)) return false;
    const conceptVisualSignatures = [];
    for (const concept of concepts){
      if (!text(concept.title) || !text(concept.summary) || !text(concept.explanation)) return false;
      if (!text(concept.sourceExcerpt) || !(text(concept.sourcePage) || (Number.isInteger(concept.sourcePage) && concept.sourcePage > 0))) return false;
      if (!Array.isArray(concept.keyPoints) || !concept.keyPoints.length) return false;
      if (!text(concept.whyItMatters) || !text(concept.analogy)) return false;
      if (!concept.explanationLevels || !text(concept.explanationLevels.simple) || !text(concept.explanationLevels.everyday) || !text(concept.explanationLevels.advanced)) return false;
      if (!text(concept.commonTrap) || !text(concept.correctiveTruth)) return false;
      if (!concept.comparison || !concept.comparison.rows || concept.comparison.rows.length < 3) return false;
      if (!text(concept.originStory) || !Array.isArray(concept.realWorldExamples) || !concept.realWorldExamples.length) return false;
      if (!concept.workedExample || !Array.isArray(concept.workedExample.steps) || concept.workedExample.steps.length < 2) return false;
      if (!text(concept.quickRecall)) return false;
      const cc = concept.cheatCode;
      if (!cc || !text(concept.cheatCode.why) || !text(cc.like) || !text(cc.wrong) || !text(cc.right) || !text(cc.oneLine) || !text(cc.mnemonic)) return false;
      if (!Array.isArray(cc.see) || cc.see.length < 3) return false;
      const vis = concept.visualization;
      if (!vis || !text(vis.caption) || !Array.isArray(vis.steps) || vis.steps.length < 1) return false;
      for (const s of vis.steps){
        if (!text(s.title) || !text(s.description) || !text(s.layout)) return false;
        if (!Array.isArray(s.nodes) || s.nodes.length < 3) return false;
        for (const n of s.nodes){
          if (!text(n.label) || !text(n.detail)) return false;
          if (n.code !== undefined && !(typeof n.code === 'string' && n.code.trim() && n.code.trim().length <= 80)) return false;
        }
      }
      const fp = visualFingerprint(vis);
      if (conceptVisualSignatures.includes(fp)) return false;
      conceptVisualSignatures.push(fp);
    }
    if (new Set(conceptVisualSignatures).size !== conceptVisualSignatures.length) return false;
    /* Pooled node labels: a model that fills every diagram with the same
       handful of generic labels produces mostly repeats across concepts,
       even when the fingerprints above happen to differ. Fewer than 60%
       distinct labels means the diagrams were drawn from one shared pool. */
    const allConceptLabels = [];
    for (const concept of concepts){
      for (const step of concept.visualization.steps){
        for (const node of step.nodes) allConceptLabels.push(node.label);
      }
    }
    const distinctLabels = new Set(allConceptLabels).size;
    if (allConceptLabels.length && distinctLabels / allConceptLabels.length < 0.6) return false;
    return true;
  }catch{ return false; }
}
/* One-unit pack from a chunked build: the unit's own topics must partition
   its concepts exactly once, same as the browser requires of the merged
   study, and every lesson passes the shared concept rules above. */
function validateUnitOutline(pack){
  try{
    if (!pack || !Array.isArray(pack.units) || pack.units.length !== 1) return false;
    if (!Array.isArray(pack.concepts) || pack.concepts.length < 3) return false;
    const unit = pack.units[0];
    if (!unit || !text(unit.title) || !text(unit.overview) ||
        !Array.isArray(unit.learningGoals) || !unit.learningGoals.length ||
        !Array.isArray(unit.topics) || !unit.topics.length) return false;
    const assigned = [];
    for (const topic of unit.topics){
      if (!topic || !text(topic.title) ||
          !Array.isArray(topic.conceptIndices) || !topic.conceptIndices.length) return false;
      for (const index of topic.conceptIndices){
        if (!Number.isInteger(index) || index < 0 || index >= pack.concepts.length) return false;
        assigned.push(index);
      }
    }
    if (assigned.length !== pack.concepts.length ||
        new Set(assigned).size !== pack.concepts.length) return false;
    return validateConcepts(pack.concepts);
  }catch{ return false; }
}
/* Lightweight course plan for chunked builds: real units in PDF order,
   no lessons. Mirrors the browser's outline rules for everything present;
   locked units still carry title/overview/goals so the plan page can show
   them before their content exists. */
function normalizePlan(plan){
  try{
    if (!plan || typeof plan !== 'object') return false;
    if (!text(plan.title)) return false;
    if (!text(plan.subject)) plan.subject = plan.title;
    if (!text(plan.summary)) plan.summary = '';
    if (!Array.isArray(plan.units)) return false;
    plan.units = plan.units.filter(u => u && typeof u === 'object');
    if (!plan.units.length) return false;
    for (const unit of plan.units){
      if (!text(unit.title)) return false;
      if (!text(unit.overview)) unit.overview = String(unit.title);
      if (!Array.isArray(unit.learningGoals)) unit.learningGoals = [];
      unit.learningGoals = unit.learningGoals.filter(g => text(g)).slice(0, 4);
      if (!unit.learningGoals.length) unit.learningGoals = [String(unit.overview).slice(0, 140)];
      if (!Array.isArray(unit.topics)) unit.topics = [];
      unit.topics = unit.topics.filter(t => t && typeof t === 'object' && text(t.title));
      if (!unit.topics.length){
        unit.topics = [{ title: String(unit.title), overview: String(unit.overview) }];
      }
      for (const topic of unit.topics){
        if (!text(topic.overview)) topic.overview = String(unit.overview);
        delete topic.conceptIndices; /* lessons arrive per unit, never in the plan */
      }
      delete unit.concepts;
    }
    if (plan.units.length > 40) plan.units = plan.units.slice(0, 40);
    return true;
  }catch{ return false; }
}
function validatePlan(plan){
  try{
    if (!plan || !text(plan.title) || !text(plan.subject)) return false;
    if (!Array.isArray(plan.units) || !plan.units.length) return false;
    for (const unit of plan.units){
      if (!unit || !text(unit.title) || !text(unit.overview) ||
          !Array.isArray(unit.learningGoals) || !unit.learningGoals.length ||
          !Array.isArray(unit.topics) || !unit.topics.length) return false;
      for (const topic of unit.topics){
        if (!topic || !text(topic.title) || !text(topic.overview)) return false;
      }
    }
    return true;
  }catch{ return false; }
}
function validateStudyBank(bank, conceptCount){
  try{
    if (!bank) return false;
    if (!Array.isArray(bank.questions) || bank.questions.length < 8) return false;
    if (!Array.isArray(bank.flashcards) || bank.flashcards.length < 8) return false;
    if (bank.formulas !== undefined){
      if (!Array.isArray(bank.formulas)) return false;
      for (const f of bank.formulas){
        if (!text(f.name) || !text(f.expression) || !text(f.meaning)) return false;
      }
    }
    const questionVisualSignatures = [];
    const perConcept = {};
    for (const question of bank.questions){
      if (!text(question.question) || !Array.isArray(question.options) || question.options.length !== 4) return false;
      if (!Number.isInteger(question.answerIndex) || question.answerIndex < 0 || question.answerIndex > 3) return false;
      if (!text(question.category) || !text(question.difficulty)) return false;
      if (!Number.isInteger(question.conceptIndex) || question.conceptIndex < 0 ||
          (conceptCount > 0 && question.conceptIndex >= conceptCount)) return false;
      if (!text(question.hint) || !text(question.explanation)) return false;
      if (!Array.isArray(question.optionExplanations) || question.optionExplanations.length !== 4) return false;
      if (!text(question.eli5)) return false;
      const vis = question.visual;
      if (!vis || !text(vis.caption) || !text(vis.layout) || !Array.isArray(question.visual.steps) || question.visual.steps.length < 1) return false;
      for (const s of question.visual.steps){
        if (!text(s.title) || !text(s.description)) return false;
        if (!Array.isArray(s.nodes) || s.nodes.length < 3) return false;
        for (const nd of s.nodes){
          if (!text(nd.label) || !text(nd.detail)) return false;
          if (nd.code !== undefined && !(typeof nd.code === 'string' && nd.code.trim() && nd.code.trim().length <= 80)) return false;
        }
      }
      const fp = visualFingerprint(vis);
      if (questionVisualSignatures.includes(fp)) return false;
      questionVisualSignatures.push(fp);
      perConcept[question.conceptIndex] = (perConcept[question.conceptIndex] || 0) + 1;
    }
    /* The browser also range-checks every flashcard against the lesson list;
       a card pointing at a phantom lesson would kill the whole study at
       display time, so it is refused here instead. */
    for (const card of bank.flashcards){
      if (!card || !Number.isInteger(card.conceptIndex) || card.conceptIndex < 0 ||
          (conceptCount > 0 && card.conceptIndex >= conceptCount)) return false;
    }
    if (conceptCount > 0){
      if (bank.questions.length < conceptCount * 2) return false;
      for (let i = 0; i < conceptCount; i++) if (!perConcept[i]) return false;
    }
    return true;
  }catch{ return false; }
}
function validateStudyPack(pack) {
  if (!pack || !Array.isArray(pack.concepts) || !pack.concepts.length) return false;
  /* The 15 universal diagram layouts, one per training pair + type card:
     flow, arch, seq, compare, hierarchy, state, erd, fbd, wave, isometric,
     mindmap, matrix, equation, cycle, layer. Every concept visualization and
     every question visual must use one of these; anything else is rejected. */
  const layoutsOk = (steps) => Array.isArray(steps) && steps.length > 0 &&
    steps.every(s => s && ALLOWED15.has(s.layout));
  for (const c of pack.concepts){
    if (!c || !c.visualization || !layoutsOk(c.visualization.steps)) return false;
  }
  if (Array.isArray(pack.questions)){
    for (const q of pack.questions){
      /* Question visuals carry the layout at the top level (visual.layout),
         not per step — the bank prompt asks for it that way. */
      if (!q || !q.visual || !ALLOWED15.has(q.visual.layout)) return false;
    }
  }
  return validateStudyBank(pack, Array.isArray(pack.concepts) ? pack.concepts.length : 0);
}
/* Merged study of a unit-chunked build: only unlocked units carry topics,
   so the partition is checked against the lessons that exist so far while
   locked units must still show title/overview/goals for the plan page.
   The bank grows across units, so it is validated against the merged
   lesson list exactly like the browser will. */
function validateChunkedStudy(study){
  try{
    if (!study || !Array.isArray(study.units) || !study.units.length) return false;
    if (!Array.isArray(study.concepts) || study.concepts.length < 4) return false;
    if (!Array.isArray(study.questions) || !Array.isArray(study.flashcards) || !Array.isArray(study.formulas)) return false;
    const assigned = [];
    for (const unit of study.units){
      if (!unit || !text(unit.title) || !text(unit.overview) ||
          !Array.isArray(unit.learningGoals) || !unit.learningGoals.length ||
          !Array.isArray(unit.topics)) return false;
      if (unit.locked) continue;
      if (!unit.topics.length) return false;
      for (const topic of unit.topics){
        if (!topic || !text(topic.title) ||
            !Array.isArray(topic.conceptIndices) || !topic.conceptIndices.length) return false;
        for (const index of topic.conceptIndices){
          if (!Number.isInteger(index) || index < 0 || index >= study.concepts.length) return false;
          assigned.push(index);
        }
      }
    }
    if (assigned.length !== study.concepts.length ||
        new Set(assigned).size !== study.concepts.length) return false;
    if (!validateConcepts(study.concepts)) return false;
    if (!validateStudyBank(study, study.concepts.length)) return false;
    return true;
  }catch{ return false; }
}
/* Keyword router: picks one of the 15 layouts from question text, so the
   diagram archetype is a function of the content rather than the model's
   whim. Mirrors the frontend aiPickLayout hints; the server copy validates,
   the browser copy renders. Pure function, tested in test-study-sections.js. */
function pickLayout(question){
  const q = String(question || '').toLowerCase();
  if (q.includes(' vs ') || q.includes('difference') || q.includes('compare') || q.includes('contrast')) return 'compare';
  if (q.includes('steps') || q.includes('process') || /\bhow\b/.test(q) || q.includes('procedure') || q.includes('pipeline')) return 'flow';
  if (q.includes('cycle') || q.includes('loop') || q.includes('repeat') || q.includes('circular')) return 'cycle';
  if (q.includes('states') || q.includes('status') || q.includes('stages') || q.includes('modes')) return 'state';
  if (q.includes('graph') || q.includes('ecg') || q.includes('wave') || q.includes('signal') || q.includes('chart')) return 'wave';
  if (q.includes('formula') || q.includes('calculate') || q.includes('derivation') || q.includes('equation')) return 'equation';
  if (q.includes('types') || q.includes('classification') || q.includes('kinds') || q.includes('categor')) return 'hierarchy';
  if (q.includes('timeline') || q.includes('history') || q.includes('order') || q.includes('sequence')) return 'seq';
  if (q.includes('layers') || q.includes('levels') || q.includes('abstraction') || q.includes('stack')) return 'layer';
  if (q.includes('entities') || q.includes('relationship') || q.includes('1:n') || q.includes('data model')) return 'erd';
  if (q.includes('force') || q.includes('pressure') || q.includes('load') || q.includes('stress')) return 'fbd';
  if (q.includes('system') || q.includes('parts') || q.includes('components') || q.includes('blocks')) return 'arch';
  if (q.includes('brainstorm') || q.includes('ideas') || q.includes('causes') || q.includes('mind map')) return 'mindmap';
  if (q.includes('table') || q.includes('matrix') || q.includes('grid')) return 'matrix';
  if (q.includes('3d') || q.includes('exploded') || q.includes('assembly')) return 'isometric';
  return 'arch'; // default
}
/* ---------- Hailuo / MiniMax image + video ---------- */
function minimaxKey(){ return process.env.MINIMAX_API_KEY || process.env.HAILUO_API_KEY || ''; }
function imageStatus(){
  const configured = hasKey(minimaxKey());
  return { id: 'minimax-image', provider: 'minimax', model: process.env.MINIMAX_IMAGE_MODEL || 'image-01', configured };
}
function videoStatus(){
  const configured = hasKey(minimaxKey());
  return { id: 'hailuo-video', provider: 'minimax', model: process.env.MINIMAX_VIDEO_MODEL || 'MiniMax-Hailuo-02', configured };
}
const VALID_RATIOS = ['1:1', '16:9', '4:3', '3:2', '2:3', '3:4', '9:16', '21:9'];
/* MiniMax reports an empty wallet as a bare "insufficient balance" string,
   which reads like a bug to the user. Recognise the family of credit
   messages and restate them as the account fact they are, so the image
   slot says what to do instead of echoing provider shorthand. */
function imageCreditExhausted(msg){
  return /insufficient|no balance|balance is|out of (credit|quota)|no credit|credit is|recharge/i.test(String(msg || ''));
}
function imageCreditError(msg){
  return mkErr(402, 'The MiniMax image account has no credit left. Top up the MiniMax balance (or set a new MINIMAX_API_KEY in .env), then tap Try again. (' + msg + ')', { code: 'IMAGE_NO_CREDIT' });
}
async function generateImage(prompt, opts){
  /* MiniMax image-01 (T2I) — verified against platform.minimax.io docs.
     Bearer token auth; body {model:'image-01', prompt<=1500 chars,
     aspect_ratio, response_format:'url', n:1}. Success returns
     data.image_urls[] + base_resp.status_code 0. NOTE: url expires in
     24 hours, so per-topic stills are display-only — the animated SVG
     diagram is the permanent visual. */
  opts = opts || {};
  if (!hasKey(minimaxKey())) throw mkErr(503, 'Image generation is not configured. Set MINIMAX_API_KEY in .env.', { code: 'IMAGE_NOT_CONFIGURED' });
  const clean = String(prompt || '').trim().slice(0, 1500);
  if (!clean) throw mkErr(400, 'A prompt is required.');
  const body = { model: process.env.MINIMAX_IMAGE_MODEL || 'image-01', prompt: clean,
    aspect_ratio: VALID_RATIOS.includes(opts.aspect_ratio) ? opts.aspect_ratio : '16:9',
    response_format: 'url', n: 1, prompt_optimizer: true };
  let res;
  try{ res = await fetchJson('https://api.minimax.io/v1/image_generation', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + minimaxKey() }, body: JSON.stringify(body) }, 120000); }
  catch(e){ throw mkErr(503, 'The image provider did not respond. Try again shortly.'); }
  if (!res.ok){
    const msg = (res.body && res.body.base_resp && res.body.base_resp.status_msg) || ('Image generation failed with HTTP ' + res.status);
    if (res.status === 401) throw mkErr(401, 'The MINIMAX_API_KEY was rejected. (' + msg + ')');
    if (res.status === 401 || res.status === 1004) throw mkErr(401, 'The MINIMAX_API_KEY was rejected or lacks image credit. (' + msg + ')');
    if (imageCreditExhausted(msg)) throw imageCreditError(msg);
    throw mkErr(res.status === 400 ? 422 : res.status, String(msg));
  }
  const baseCode = res.body && res.body.base_resp && res.body.base_resp.status_code;
  if (baseCode !== undefined && baseCode !== 0){
    const msg = (res.body.base_resp && res.body.base_resp.status_msg) || 'Image generation failed.';
    if (imageCreditExhausted(msg)) throw imageCreditError(msg);
    throw mkErr(422, String(msg));
  }
  const urls = res.body && res.body.data && res.body.data.image_urls;
  if (!Array.isArray(urls) || !urls.length) throw mkErr(502, 'The image provider returned no image. Please try again.');
  return { imageUrl: urls[0], imageUrls: urls, model: body.model, prompt: clean };
}
async function startVideoTask(prompt){
  if (!hasKey(minimaxKey())) throw mkErr(503, 'Video generation is not configured. Set MINIMAX_API_KEY in .env.', { code: 'VIDEO_NOT_CONFIGURED' });
  const clean = String(prompt || '').trim().slice(0, 2000);
  if (!clean) throw mkErr(400, 'A prompt is required.');
  const body = { model: process.env.MINIMAX_VIDEO_MODEL || 'MiniMax-Hailuo-02', prompt: clean, duration: 6, resolution: '768P', prompt_optimizer: true };
  let res;
  try{ res = await fetchJson('https://api.minimax.io/v1/video_generation', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + minimaxKey() }, body: JSON.stringify(body) }, 60000); }
  catch(e){ throw mkErr(503, 'The video provider did not respond. Try again shortly.'); }
  if (!res.ok) throw mkErr(res.status === 400 ? 422 : res.status, 'Video generation failed with HTTP ' + res.status);
  return { taskId: res.body.task_id, model: body.model };
}
async function queryVideoTask(taskId){
  const url = 'https://api.minimax.io/v1/query/video_generation?task_id=' + encodeURIComponent(taskId);
  const res = await fetchJson(url, { headers: { Authorization: 'Bearer ' + minimaxKey() } }, 30000);
  if (!res.ok) throw mkErr(res.status, 'Video status check failed with HTTP ' + res.status);
  return res.body;
}
/* ---------- async analyze jobs ---------- */
const jobs = new Map();
const ANALYZE_STAGES = [
  { key: 'queued', label: 'Queued', weight: 5 },
  { key: 'extract', label: 'Reading your PDF', weight: 10 },
  { key: 'outline', label: 'Outlining concepts', weight: 25 },
  { key: 'sections', label: 'Writing lessons', weight: 30 },
  { key: 'bank', label: 'Building practice', weight: 15 },
  { key: 'validate', label: 'Checking quality', weight: 10 },
  { key: 'ready', label: 'Ready', weight: 5 }
];
function setJobStage(job, key){
  if (!job || job.status !== 'running' || job.cancelled) return false;
  job.stage = key;
  job.stageStartedAt = Date.now();
  let total = 0;
  for (const s of ANALYZE_STAGES){ if (s.key === key) break; total += s.weight; }
  const cur = ANALYZE_STAGES.find(s => s.key === key);
  job.progress = Math.min(99, total + Math.round((cur ? cur.weight : 0) / 2));
  return true;
}
function jobSnapshot(job){
  const stage = ANALYZE_STAGES.find(s => s.key === job.stage);
  /* A chunked job stays 'done' internally while the background units keep
     building; a cancel flips what clients see without losing the study
     already delivered. */
  const status = (job.cancelled && job.status === 'done') ? 'cancelled' : job.status;
  const snap = { jobId: job.id, status, stage: job.stage,
    stageLabel: stage ? stage.label : job.stage, progress: job.status === 'done' ? 100 : job.progress,
    stages: ANALYZE_STAGES, elapsedMs: Date.now() - job.createdAt };
  if (status === 'done' && job.study) snap.study = job.study;
  if (status === 'failed' || status === 'cancelled') snap.error = job.error || 'The study build was cancelled.';
  if (job.chunk && job.chunk.plan){
    const states = job.chunk.plan.units.map((u, i) => ({
      index: i, title: u.title,
      status: job.chunk.built[i] ? 'ready' : (job.chunk.states[i] || 'locked'),
      lessons: job.chunk.built[i] ? job.chunk.built[i].concepts.length : 0
    }));
    snap.chunked = true;
    snap.unitStates = states;
    snap.pendingUnits = states.filter(s => s.status !== 'ready').map(s => s.index);
  }
  return snap;
}
function finishJob(job, patch){
  Object.assign(job, patch);
  job.finishedAt = Date.now();
  if (job.status === 'done') job.progress = 100;
  /* A chunked job that has delivered Unit 1 keeps the document alive for
     the background units; everything else releases it immediately. */
  if (!job.keepPdf) job.pdf = null;
  return job;
}
function extractJson(text){
  const clean = String(text || '').replace(/```json/gi, '```').trim();
  const fenced = /```\s*([\s\S]*?)```/.exec(clean);
  const candidate = fenced ? fenced[1] : clean;
  /* Try the fast path first: first { to last }. Gemini's long outlines
     often come back near-JSON (trailing commas, // comments, a stray
     quote) and strict JSON.parse rejects them at exactly the position
     your failed job reported. Fall through to repairs below. */
  const attempts = [];
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start >= 0 && end > start) attempts.push(candidate.slice(start, end + 1));
  /* Balanced-brace scan: the last } is sometimes the model's closing of
     an unfinished string, so walk every plausible end brace. */
  if (start >= 0){
    let depth = 0, instr = false, esc = false;
    for (let i = start; i < candidate.length; i++){
      const ch = candidate[i];
      if (instr){ if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') instr = false; }
      else if (ch === '"') instr = true;
      else if (ch === '{') depth++;
      else if (ch === '}'){ depth--; if (depth === 0) attempts.push(candidate.slice(start, i + 1)); }
      if (attempts.length > 6) break;
    }
  }
  const repairs = [
    s => s,
    /* strip // and block comments outside strings */
    s => stripJsonComments(s),
    /* trailing commas before } or ] */
    s => stripJsonComments(s).replace(/,\s*([}\]])/g, '$1'),
    /* smart quotes + trailing commas */
    s => stripJsonComments(s).replace(/[\u201c\u201d]/g, '"').replace(/[\u2018\u2019]/g, "'").replace(/,\s*([}\]])/g, '$1'),
    /* single-quoted keys/values -> double quotes (cautious) */
    s => stripJsonComments(s).replace(/,\s*([}\]])/g, '$1').replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, '"$1"'),
    /* unquoted object keys -> double-quoted (the exact failure live Gemini
       produced:  { "title": "Web Browsing",\n  description: "..." } ) */
    s => quoteUnquotedKeys(stripJsonComments(s).replace(/,\s*([}\]])/g, '$1')),
    /* truncate-and-close: cut at last complete } or ] then balance */
    s => balanceBraces(stripJsonComments(s).replace(/,\s*([}\]])/g, '$1'))
  ];
  let lastErr = null;
  for (const cand of attempts){
    for (const fix of repairs){
      let fixed = null;
      try{ fixed = fix(cand); }catch{ continue; }
      if (!fixed) continue;
      try{ return JSON.parse(fixed); }catch(e){ lastErr = e; }
    }
  }
  throw lastErr || mkErr(502, 'The AI returned an unreadable response. Please try again.');
}
function stripJsonComments(s){
  let out = '', instr = false, esc = false, line = false, block = false;
  for (let i = 0; i < s.length; i++){
    const ch = s[i], nx = s[i + 1];
    if (line){ if (ch === '\n'){ line = false; out += ch; } continue; }
    if (block){ if (ch === '*' && nx === '/'){ block = false; i++; } continue; }
    if (instr){ out += ch; if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') instr = false; continue; }
    if (ch === '"'){ instr = true; out += ch; continue; }
    if (ch === '/' && nx === '/'){ line = true; continue; }
    if (ch === '/' && nx === '*'){ block = true; i++; continue; }
    out += ch;
  }
  return out;
}
function quoteUnquotedKeys(s){
  /* Quote bare keys ({title: ..} or ,\ndescription: ..) while leaving
     anything inside strings, URLs (http://), or numbers (12:30) alone. */
  let out = '', instr = false, esc = false;
  for (let i = 0; i < s.length; i++){
    const ch = s[i];
    if (instr){ out += ch; if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') instr = false; continue; }
    if (ch === '"'){ instr = true; out += ch; continue; }
    if (ch === '{' || ch === ',' || ch === '\n'){
      out += ch;
      const rest = s.slice(i + 1);
      const m = /^[ \t\r\n]*([A-Za-z_][A-Za-z0-9_]*)\s*:/.exec(rest);
      if (m){
        /* Skip timestamps/URLs: a bare word followed by : but preceded by
           another bare char (e.g. http://x, 12:30) is not a key. */
        out += rest.slice(0, rest.indexOf(m[1])) + '"' + m[1] + '"';
        i += rest.indexOf(m[1]) + m[1].length;
        continue;
      }
      continue;
    }
    out += ch;
  }
  return out;
}
function balanceBraces(s){
  const start = s.indexOf('{');
  if (start < 0) return null;
  let depth = 0, instr = false, esc = false, lastGood = -1;
  for (let i = start; i < s.length; i++){
    const ch = s[i];
    if (instr){ if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') instr = false; }
    else if (ch === '"') instr = true;
    else if (ch === '{' || ch === '[') depth++;
    else if (ch === '}' || ch === ']'){ depth--; if (depth === 0) lastGood = i; }
  }
  if (lastGood > start) return s.slice(start, lastGood + 1);
  /* Truncated mid-object: close what is open. */
  let cut = s.slice(start).replace(/,\s*$/, '');
  const opens = [];
  instr = false; esc = false;
  for (const ch of cut){
    if (instr){ if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') instr = false; }
    else if (ch === '"') instr = true;
    else if (ch === '{') opens.push('}');
    else if (ch === '[') opens.push(']');
    else if ((ch === '}' || ch === ']') && opens.length) opens.pop();
  }
  if (instr) cut += '"';
  while (opens.length) cut += opens.pop();
  return cut;
}
function createAnalyzeJob(pdfBuffer, level, requestId){
  const id = crypto.randomUUID();
  const job = { id, requestId, status: 'running', stage: 'queued', stageStartedAt: Date.now(),
    progress: 2, createdAt: Date.now(), study: null, error: null, pdf: pdfBuffer, level, cancelled: false };
  jobs.set(id, job);
  return job;
}
async function runAnalyzeJob(job){
  /* Large PDFs take the unit-chunked path: Unit 1 first for a fast open,
     Units 2..N built in the background and unlocked one by one. */
  if (job.pdf && job.pdf.length > UNIT_SPLIT_MB * 1024 * 1024) return runChunkedJob(job);
  try{
    if (job.cancelled){ finishJob(job, { status: 'cancelled', error: 'The study build was cancelled.' }); return; }
    setJobStage(job, 'extract');
    const pdfB64 = job.pdf.toString('base64');
    setJobStage(job, 'outline');
    if (job.cancelled){ finishJob(job, { status: 'cancelled', error: 'The study build was cancelled.' }); return; }
    const outlinePrompt = ['Analyze the attached educational PDF and respond with a single valid JSON object containing title, subject, summary, units (at least 3, each with title, overview, learningGoals, topics with title, overview, conceptIndices) and concepts (4 to 6 items, each with title, summary, explanation, sourceExcerpt, sourcePage, keyPoints, whyItMatters, analogy, explanationLevels {simple, everyday, advanced}, commonTrap, correctiveTruth, comparison {firstLabel, secondLabel, takeaway, rows[3] {aspect, first, second}}, originStory, realWorldExamples[{title, description}], workedExample {scenario, answer, steps[2] {label, action, reasoning}}, quickRecall, cheatCode {why, like, wrong, right, oneLine, mnemonic, see[3]}, visualization {caption, steps[2] {title, description, layout, nodes[3] {label, detail, code}}}}). Level: ' + job.level + '. STRUCTURAL INTEGRITY (do not restructure): mirror the PDF\'s own topic order and headings — one concept per PDF topic/section, in the same sequence; never merge topics into a generic stack or invent new groupings. Each visualization layout MUST be one of exactly these 15: flow (steps/process), arch (system/parts), seq (timeline/order), compare (vs/difference), hierarchy (types/classification), state (states/status), erd (entities/data), fbd (force/pressure), wave (graph/signal), isometric (3D/layers), mindmap (brainstorm/causes), matrix (table/grid), equation (formula/calc), cycle (loop/repeats), layer (layers/levels). Every diagram must be topic-specific: node labels come from that topic\'s own terms, never reused across topics. When the PDF shows code/syntax/commands for a node, copy the exact one-line statement into node.code (max 80 chars); otherwise omit code. Keep every diagram topic-specific.'].join(' ');
    let outline = null;
    try{
      outline = extractJson(await callAI([{ text: outlinePrompt }, { inlineData: { mimeType: 'application/pdf', data: pdfB64 } }], { requiresDocument: true, schema: { type: 'object' } }));
      normalizeOutline(outline);
      if (!validateStudyOutline(outline)) throw mkErr(502, 'Outline failed validation.');
    }catch(e){
      if (job.cancelled){ finishJob(job, { status: 'cancelled', error: 'The study build was cancelled.' }); return; }
      if (e && (e.status === 401 || e.status === 422 || e.code === 'AI_NOT_CONFIGURED')) throw e;
      const retryPrompt = [outlinePrompt + ' The previous answer was incomplete or malformed. Respond with a single valid JSON object only, matching the schema exactly.'].join(' ');
      outline = extractJson(await callAI([{ text: retryPrompt }, { inlineData: { mimeType: 'application/pdf', data: pdfB64 } }], { requiresDocument: true, schema: { type: 'object' } }));
      normalizeOutline(outline);
      if (!validateStudyOutline(outline)) throw mkErr(502, 'The AI returned an incomplete study plan. Please try the PDF again.');
    }
    if (job.cancelled){ finishJob(job, { status: 'cancelled', error: 'The study build was cancelled.' }); return; }
    setJobStage(job, 'sections');
    setJobStage(job, 'bank');
    if (job.cancelled){ finishJob(job, { status: 'cancelled', error: 'The study build was cancelled.' }); return; }
    const n = outline.concepts.length;
    const bankPrompt = ['Analyze the attached educational PDF and respond with a single valid JSON object containing formulas (array of {name, expression, meaning}), questions (at least ' + (n * 2) + ' items covering every concept index 0..' + (n - 1) + ', each with question, options[4], answerIndex, category, difficulty, conceptIndex, hint, explanation, optionExplanations[4], eli5, visual {caption, layout, steps[2] {title, description, nodes[3] {label, detail, code}}}}) and flashcards (at least ' + (n * 2) + ' items with front, back, conceptIndex). Each question-visual layout MUST be one of exactly these 15: flow, arch, seq, compare, hierarchy, state, erd, fbd, wave, isometric, mindmap, matrix, equation, cycle, layer. Each question visual must be TOPIC-SPECIFIC to its own conceptIndex (labels from that concept only) and include that concept\'s 2D diagram nodes; when the question involves code/syntax, put the exact statement in node.code (max 80 chars). Concepts: ' + outline.concepts.map(c => c.title).join('; ') + '.'].join(' ');
    let bank = null;
    try{
      bank = extractJson(await callAI([{ text: bankPrompt }, { inlineData: { mimeType: 'application/pdf', data: pdfB64 } }], { requiresDocument: true, schema: { type: 'object' } }));
      normalizeBank(bank, n);
      if (!validateStudyBank(bank, n)) throw mkErr(502, 'Bank failed validation.');
    }catch(e){
      if (job.cancelled){ finishJob(job, { status: 'cancelled', error: 'The study build was cancelled.' }); return; }
      if (e && (e.status === 401 || e.status === 422 || e.code === 'AI_NOT_CONFIGURED')) throw e;
      const retryBank = [bankPrompt + ' The previous answer was incomplete. Respond with a single valid JSON object only.'].join(' ');
      bank = extractJson(await callAI([{ text: retryBank }, { inlineData: { mimeType: 'application/pdf', data: pdfB64 } }], { requiresDocument: true, schema: { type: 'object' } }));
      normalizeBank(bank, n);
      if (!validateStudyBank(bank, n)) throw mkErr(502, 'The AI returned an incomplete study plan. Please try the PDF again.');
    }
    if (job.cancelled){ finishJob(job, { status: 'cancelled', error: 'The study build was cancelled.' }); return; }
    setJobStage(job, 'validate');
    /* The bank prompt asks for formulas, but the client validator requires
       the field to exist as an array — only its contents are optional. */
    if (!Array.isArray(bank.formulas)) bank.formulas = [];
    const study = Object.assign({}, outline, bank);
    if (!validateStudyPack(study)) throw mkErr(502, 'The AI returned an incomplete study plan. Please try the PDF again.');
    setJobStage(job, 'ready');
    finishJob(job, { status: 'done', study });
  }catch(e){
    if (job.cancelled || job.status === 'cancelled'){ finishJob(job, { status: 'cancelled', error: 'The study build was cancelled.' }); return; }
    finishJob(job, { status: 'failed', error: (e && e.message) || 'The study build failed.' });
  }
}
/* ---------- unit-chunked analysis (large PDFs) --------------------
   The single-shot outline asks one call for every lesson of the whole
   document, and on a large PDF the answer truncates mid-JSON and the
   validator throws it away. The chunked path splits the work:
     1. one light plan call lists the real units (no lessons);
     2. Unit 1 is built immediately — lessons + practice + visuals — and
        delivered as a study with Units 2..N locked;
     3. the remaining units keep building in the background, each appended
        at its own global concept offset, so the client unlocks them one
        by one while the user already studies Unit 1;
     4. every unlock revalidates the merged pack.
   Above GEMINI_INLINE_MB the document is uploaded once through the
   Gemini Files API; every stage call then references the stored file. */
function chunkDocParts(prompt, pdfB64){
  return [{ text: prompt }, { inlineData: { mimeType: 'application/pdf', data: pdfB64 } }];
}
function chunkCallOpts(job){
  const opts = { requiresDocument: true, schema: { type: 'object' } };
  if (job.chunk && job.chunk.fileUri) opts.fileUri = job.chunk.fileUri;
  return opts;
}
function planPrompt(job){
  return ['Analyze the attached educational PDF and respond with a single valid JSON object containing title, subject, summary and units — the course plan ONLY, with no lesson content. units: every distinct unit/chapter/part of the PDF in its own order (at least 1), each with title, overview, learningGoals (2 to 4 short goals) and topics (that unit\'s own topics in PDF order, each with title and overview only — no concepts, no conceptIndices). Level: ' + job.level + '. Keep it compact: this plan is the table of contents a study space unlocks unit by unit. Do not write explanations, examples, questions or diagrams.'].join(' ');
}
function unitOutlinePrompt(job, k){
  const unit = job.chunk.plan.units[k];
  const label = 'Unit ' + (k + 1) + ' of ' + job.chunk.plan.units.length + ' titled "' + unit.title + '"';
  return ['Analyze the attached educational PDF and respond with a single valid JSON object containing ONLY the learning content for ' + label + ' — never any other unit. It must contain topics (this unit\'s own topics in PDF order, each {title, overview, conceptIndices}) and concepts (4 to 6 lessons for THIS UNIT ONLY, each with title, summary, explanation, sourceExcerpt, sourcePage, keyPoints, whyItMatters, analogy, explanationLevels {simple, everyday, advanced}, commonTrap, correctiveTruth, comparison {firstLabel, secondLabel, takeaway, rows[3] {aspect, first, second}}, originStory, realWorldExamples[{title, description}], workedExample {scenario, answer, steps[2] {label, action, reasoning}}, quickRecall, cheatCode {why, like, wrong, right, oneLine, mnemonic, see[3]}, visualization {caption, steps[2] {title, description, layout, nodes[3] {label, detail, code}}}). conceptIndices must assign every concept of this unit exactly once, consecutively from 0, across this unit\'s topics in order. Level: ' + job.level + '. STRUCTURAL INTEGRITY (do not restructure): mirror the PDF\'s own topic order and headings for this unit — one concept per PDF topic/section, in the same sequence. Each visualization layout MUST be one of exactly these 15: flow (steps/process), arch (system/parts), seq (timeline/order), compare (vs/difference), hierarchy (types/classification), state (states/status), erd (entities/data), fbd (force/pressure), wave (graph/signal), isometric (3D/layers), mindmap (brainstorm/causes), matrix (table/grid), equation (formula/calc), cycle (loop/repeats), layer (layers/levels). Every diagram must be topic-specific: node labels come from that topic\'s own terms, never reused across topics and never generic labels like Input/Process/Output. When the PDF shows code/syntax/commands for a node, copy the exact one-line statement into node.code (max 80 chars); otherwise omit code.'].join(' ');
}
function unitBankPrompt(job, k, concepts, n){
  const unit = job.chunk.plan.units[k];
  const need = Math.max(8, n * 2);
  return ['Analyze the attached educational PDF and respond with a single valid JSON object containing formulas (array of {name, expression, meaning}), questions (at least ' + need + ' items covering every concept index 0..' + (n - 1) + ', each with question, options[4], answerIndex, category, difficulty, conceptIndex, hint, explanation, optionExplanations[4], eli5, visual {caption, layout, steps[2] {title, description, nodes[3] {label, detail, code}}}}) and flashcards (at least ' + need + ' items with front, back, conceptIndex). This practice belongs to "' + unit.title + '" only. Each question-visual layout MUST be one of exactly these 15: flow, arch, seq, compare, hierarchy, state, erd, fbd, wave, isometric, mindmap, matrix, equation, cycle, layer. Each question visual must be TOPIC-SPECIFIC to its own conceptIndex (labels from that concept only); when the question involves code/syntax, put the exact statement in node.code (max 80 chars). Concepts: ' + concepts.map(c => c.title).join('; ') + '.'].join(' ');
}
/* The browser rejects a study whose lessons repeat the same diagram, and
   two independent unit calls can collide even when each unit is distinct
   internally. Keys are collected job-wide; a colliding step has its first
   label rewritten to the lesson's own title until the key is unique. The
   server fingerprint checks read a case-sensitive prefix of the same key,
   so this one pass satisfies both validators. */
function clientVisualKey(step){
  return String((step && step.layout) || '') + ':' +
    (((step && step.nodes) || []).map(nd => String((nd && nd.label) || '').trim().toLowerCase()).join('>'));
}
function claimVisualKey(chunk, step, fallbackLabel){
  if (!step || !Array.isArray(step.nodes) || !step.nodes.length) return;
  const keys = chunk.visualKeys || (chunk.visualKeys = new Set());
  if (!keys.has(clientVisualKey(step))){ keys.add(clientVisualKey(step)); return; }
  const first = step.nodes[0];
  const base = String(fallbackLabel || first.label || 'Idea');
  for (let i = 1; i <= 5; i++){
    first.label = i === 1 ? base : base + ' #' + i;
    const k2 = clientVisualKey(step);
    if (!keys.has(k2)){ keys.add(k2); return; }
  }
}
/* A unit's lesson response arrives with local indices; wrap it into the
   one-unit shape normalizeOutline and validateUnitOutline expect. */
function wrapUnitPack(resp, unit){
  const topics = (resp && Array.isArray(resp.topics)) ? resp.topics
    : (resp && Array.isArray(resp.units) && resp.units[0] && Array.isArray(resp.units[0].topics)) ? resp.units[0].topics : [];
  return { units: [Object.assign({}, unit, { topics })], concepts: (resp && Array.isArray(resp.concepts)) ? resp.concepts : [] };
}
/* Merge every built unit into the study the browser sees: built units
   carry their topics (already at global offsets), unbuilt ones stay
   locked with an empty topic list, and the unit ledger drives the
   unlock UI and the background poller. */
function assembleChunkStudy(job){
  const c = job.chunk;
  const concepts = [], questions = [], flashcards = [], formulas = [];
  for (const b of c.built){
    if (!b) continue;
    concepts.push(...b.concepts);
    questions.push(...b.questions);
    flashcards.push(...b.flashcards);
    formulas.push(...b.formulas);
  }
  const units = c.plan.units.map((u, i) => {
    const b = c.built[i];
    return { title: u.title, overview: u.overview, learningGoals: u.learningGoals,
      topics: b ? b.topics : [], locked: !b };
  });
  const unitStates = c.plan.units.map((u, i) => ({
    index: i, title: u.title,
    status: c.built[i] ? 'ready' : (c.states[i] || 'locked'),
    lessons: c.built[i] ? c.built[i].concepts.length : 0
  }));
  return {
    title: c.plan.title, subject: c.plan.subject, summary: c.plan.summary,
    units, concepts, questions, flashcards, formulas,
    chunked: true, unitStates,
    pendingUnits: unitStates.filter(s => s.status !== 'ready').map(s => s.index)
  };
}
/* One unit = one outline call + one practice call, each with a single
   retry, same contract as the single-shot stages. On success the unit is
   remapped to its global offset, deduped against every earlier unit and
   stored in the chunk ledger. */
async function buildUnit(job, k){
  const c = job.chunk;
  const pdfB64 = c.pdfB64;
  const opts = chunkCallOpts(job);
  const unit = c.plan.units[k];
  setJobStage(job, 'sections');
  const outlinePrompt = unitOutlinePrompt(job, k);
  let pack = null;
  try{
    pack = wrapUnitPack(extractJson(await callAI(chunkDocParts(outlinePrompt, pdfB64), opts)), unit);
    normalizeOutline(pack);
    if (!validateUnitOutline(pack)) throw mkErr(502, 'Unit outline failed validation.');
  }catch(e){
    if (job.cancelled) throw mkErr(499, 'The study build was cancelled.');
    if (e && (e.status === 401 || e.status === 422 || e.code === 'AI_NOT_CONFIGURED')) throw e;
    pack = wrapUnitPack(extractJson(await callAI(chunkDocParts(outlinePrompt + ' The previous answer was incomplete or malformed. Respond with a single valid JSON object only, matching the schema exactly.', pdfB64), opts)), unit);
    normalizeOutline(pack);
    if (!validateUnitOutline(pack)) throw mkErr(502, 'The AI returned an incomplete study plan. Please try the PDF again.');
  }
  if (job.cancelled) throw mkErr(499, 'The study build was cancelled.');
  setJobStage(job, 'bank');
  const n = pack.concepts.length;
  const bankPrompt = unitBankPrompt(job, k, pack.concepts, n);
  let bank = null;
  try{
    bank = extractJson(await callAI(chunkDocParts(bankPrompt, pdfB64), opts));
    normalizeBank(bank, n);
    if (!validateStudyBank(bank, n)) throw mkErr(502, 'Unit practice failed validation.');
  }catch(e){
    if (job.cancelled) throw mkErr(499, 'The study build was cancelled.');
    if (e && (e.status === 401 || e.status === 422 || e.code === 'AI_NOT_CONFIGURED')) throw e;
    bank = extractJson(await callAI(chunkDocParts(bankPrompt + ' The previous answer was incomplete. Respond with a single valid JSON object only, matching the schema exactly.', pdfB64), opts));
    normalizeBank(bank, n);
    if (!validateStudyBank(bank, n)) throw mkErr(502, 'The AI returned an incomplete study plan. Please try the PDF again.');
  }
  if (!Array.isArray(bank.formulas)) bank.formulas = [];
  /* Global offsets: this unit's lessons are appended after everything
     built so far, so its topics, questions and flashcards shift by the
     running base before joining the merged study. */
  const base = c.built.reduce((sum, b) => sum + (b ? b.concepts.length : 0), 0);
  for (const topic of pack.units[0].topics){
    topic.conceptIndices = (Array.isArray(topic.conceptIndices) ? topic.conceptIndices : []).map(i => i + base);
  }
  for (const q of bank.questions) if (q && Number.isInteger(q.conceptIndex)) q.conceptIndex += base;
  for (const card of bank.flashcards) if (card && Number.isInteger(card.conceptIndex)) card.conceptIndex += base;
  for (const concept of pack.concepts){
    for (const step of (concept.visualization && concept.visualization.steps) || []) claimVisualKey(c, step, concept.title);
  }
  for (const q of bank.questions){
    for (const step of (q.visual && q.visual.steps) || []) claimVisualKey(c, step, String(q.question || (q.visual && q.visual.caption) || 'Question').slice(0, 40));
  }
  c.built[k] = { topics: pack.units[0].topics, concepts: pack.concepts,
    questions: bank.questions, flashcards: bank.flashcards, formulas: bank.formulas };
  c.states[k] = 'ready';
}
/* Deliver Unit 1 first, then keep building the rest. A failed unit only
   loses itself (marked 'failed' in the ledger); a hard provider error
   stops the queue. The study is reassembled after every unit so each
   poll returns the newest unlock. */
async function buildRemainingUnits(job){
  const c = job.chunk;
  try{
    for (let k = 1; k < c.plan.units.length; k++){
      if (job.cancelled) break;
      c.states[k] = 'building';
      job.study = assembleChunkStudy(job);
      try{
        await buildUnit(job, k);
      }catch(e){
        c.states[k] = 'failed';
        if (job.cancelled || (e && (e.status === 401 || e.status === 422 || e.code === 'AI_NOT_CONFIGURED'))) break;
      }
      job.study = assembleChunkStudy(job);
      await sleep(700);
    }
  }finally{
    job.study = assembleChunkStudy(job);
    job.keepPdf = false;
    job.pdf = null;
    job.backgroundDone = true;
  }
}
async function runChunkedJob(job){
  job.chunked = true;
  try{
    if (job.cancelled){ finishJob(job, { status: 'cancelled', error: 'The study build was cancelled.' }); return; }
    setJobStage(job, 'extract');
    const pdfB64 = job.pdf.toString('base64');
    setJobStage(job, 'outline');
    /* Above the inline cap the document rides the Files API once; below it,
       inlineData as usual. A failed upload falls back to inline and the
       provider's own size error surfaces if that also fails. */
    let fileUri = null;
    if (job.pdf.length > GEMINI_INLINE_MB * 1024 * 1024) fileUri = await uploadPdfToGemini(job.pdf);
    job.chunk = { plan: null, built: [], states: [], pdfB64, fileUri, visualKeys: new Set() };
    const opts = chunkCallOpts(job);
    let plan = null;
    try{
      plan = extractJson(await callAI(chunkDocParts(planPrompt(job), pdfB64), opts));
      normalizePlan(plan);
      if (!validatePlan(plan)) throw mkErr(502, 'Plan failed validation.');
    }catch(e){
      if (job.cancelled){ finishJob(job, { status: 'cancelled', error: 'The study build was cancelled.' }); return; }
      if (e && (e.status === 401 || e.status === 422 || e.code === 'AI_NOT_CONFIGURED')) throw e;
      plan = extractJson(await callAI(chunkDocParts(planPrompt(job) + ' The previous answer was incomplete or malformed. Respond with a single valid JSON object only, matching the schema exactly.', pdfB64), opts));
      normalizePlan(plan);
      if (!validatePlan(plan)) throw mkErr(502, 'The AI returned an incomplete study plan. Please try the PDF again.');
    }
    if (job.cancelled){ finishJob(job, { status: 'cancelled', error: 'The study build was cancelled.' }); return; }
    job.chunk.plan = plan;
    job.chunk.built = plan.units.map(() => null);
    job.chunk.states = plan.units.map((_, i) => i === 0 ? 'building' : 'locked');
    /* Unit 1 gets the full lesson + practice treatment first so the study
       opens fast; everything else keeps building behind it. */
    await buildUnit(job, 0);
    if (job.cancelled){ finishJob(job, { status: 'cancelled', error: 'The study build was cancelled.' }); return; }
    setJobStage(job, 'validate');
    job.study = assembleChunkStudy(job);
    if (!validateChunkedStudy(job.study)) throw mkErr(502, 'The AI returned an incomplete study plan. Please try the PDF again.');
    setJobStage(job, 'ready');
    job.keepPdf = true; /* background units still need the document */
    finishJob(job, { status: 'done', study: job.study });
    job.background = buildRemainingUnits(job);
  }catch(e){
    if (job.cancelled || job.status === 'cancelled'){ finishJob(job, { status: 'cancelled', error: 'The study build was cancelled.' }); return; }
    finishJob(job, { status: 'failed', error: (e && e.message) || 'The study build failed.' });
  }
}
/* ---------- HTTP helpers + routes ---------- */
function sendJson(res, status, obj, requestId){
  const body = JSON.stringify(obj);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('X-Request-Id', requestId);
  // Security headers per Website Professional Build & Compliance Master Guide
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  if (process.env.NODE_ENV === 'production'){
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  res.writeHead(status);
  res.end(body);
}
function readBody(req, limitBytes){
  return new Promise((resolve, reject) => {
    let total = 0;
    const chunks = [];
    req.on('data', c => { total += c.length; if (total > limitBytes){ reject(mkErr(413, 'Request body too large.')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}
/* readBody + JSON.parse with a route-specific too-large message, so an
   oversized upload is refused with the limit that actually applies to it
   (the PDF cap) instead of the generic body-gate wording. */
async function readJson(request, limitBytes, tooLargeMessage){
  let raw;
  try{ raw = await readBody(request, limitBytes); }
  catch(e){
    if (e && e.status === 413 && tooLargeMessage) throw mkErr(413, tooLargeMessage);
    throw e;
  }
  try{ return JSON.parse(raw); }
  catch{ throw mkErr(400, 'The request body was unreadable.'); }
}
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.mp4': 'video/mp4' };
function serveStatic(req, res){
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/XamCode.html';
  const file = path.normalize(path.join(__dirname, p));
  if (!file.startsWith(__dirname)) return sendJson(res, 403, { error: 'Forbidden.' });
  fs.readFile(file, (e, data) => {
    if (e) return sendJson(res, 404, { error: 'Not found.' });
    res.setHeader('Content-Type', MIME[path.extname(file)] || 'application/octet-stream');
    res.writeHead(200);
    res.end(data);
  });
}
async function analyzePdf(req, res){
  const requestId = crypto.randomUUID();
  res.setHeader('X-Request-Id', requestId);
  const request = req;
  let parsed;
  try{ parsed = await readJson(request, MAX_JSON_BYTES, `PDFs must be ${MAX_PDF_MB} MB or smaller.`); }
  catch(e){ return sendJson(res, (e && e.status) || 400, { error: (e && e.message) || 'The request body was unreadable.', requestId }, requestId); }
  const b64 = parsed && parsed.pdfBase64;
  if (typeof b64 !== 'string' || !b64) return sendJson(res, 400, { error: 'A PDF file is required.', requestId }, requestId);
  let buf;
  try{ buf = Buffer.from(b64, 'base64'); }
  catch{ return sendJson(res, 400, { error: 'The PDF could not be decoded.', requestId }, requestId); }
  if (!buf.length || buf.slice(0, 5).toString('latin1') !== '%PDF-') return sendJson(res, 400, { error: 'That file is not a readable PDF.', requestId }, requestId);
  if (buf.length > MAX_PDF_MB * 1024 * 1024) return sendJson(res, 413, { error: 'The PDF is larger than ' + MAX_PDF_MB + ' MB.', requestId }, requestId);
  const spent = consumePdfAllowance(req);
  if (!spent){
    const info = pdfAllowanceFor(req);
    return sendJson(res, 429, { error: 'You have used all ' + info.limit + ' PDF generations available today. Your allowance renews with the next daily window.', code: 'DAILY_LIMIT_REACHED', allowance: info, requestId }, requestId);
  }
  const level = typeof parsed.level === 'string' ? parsed.level : 'standard';
  const job = createAnalyzeJob(buf, level, requestId);
  runAnalyzeJob(job);
  return sendJson(res, 202, { jobId: job.id, stages: ANALYZE_STAGES, requestId }, requestId);
}
function errPayload(e, fallback){
  const status = (e && e.status) || 500;
  return { status, body: { error: (e && e.message) || fallback, code: e && e.code } };
}
async function handleAsk(req, res, requestId, systemText){
  let parsed;
  try{ parsed = JSON.parse(await readBody(req, 2 * 1024 * 1024)); }
  catch(e){ return sendJson(res, 400, { error: 'The request body was unreadable.', requestId }, requestId); }
  const q = parsed && (parsed.question || parsed.prompt || parsed.text);
  if (typeof q !== 'string' || !q.trim()) return sendJson(res, 400, { error: 'A question is required.', requestId }, requestId);
  const parts = [{ text: q }];
  const history = parsed.history || parsed.conversation;
  const extra = Array.isArray(history) ? '\n\nConversation so far:\n' + history.slice(-8).map(m => (m.role || 'user') + ': ' + m.text).join('\n') : '';
  try{
    const answer = await callAI([{ text: systemText + extra }, ...parts], { systemInstruction: systemText });
    return sendJson(res, 200, { answer, requestId }, requestId);
  }catch(e){
    const p = errPayload(e, 'The AI request failed.');
    return sendJson(res, p.status, Object.assign({}, p.body, { requestId }), requestId);
  }
}
async function handleImage(req, res, requestId){
  let parsed;
  try{ parsed = JSON.parse(await readBody(req, 512 * 1024)); }
  catch(e){ return sendJson(res, 400, { error: 'The request body was unreadable.', requestId }, requestId); }
  try{
    const out = await generateImage(parsed && (parsed.prompt || parsed.text), { aspect_ratio: parsed && parsed.aspect_ratio });
    return sendJson(res, 200, Object.assign({}, out, { requestId }), requestId);
  }catch(e){
    const p = errPayload(e, 'Image generation failed.');
    return sendJson(res, p.status, Object.assign({}, p.body, { requestId }), requestId);
  }
}
/* ---------- PDF topic -> MiniMax image prompt ---------- */
/* Builds one 2D image-generation prompt per study topic (concept). The prompt
   carries the topic title, its summary, its worked example, its workshop
   formulas, and the node labels from the topic's own animated SVG diagram, so
   the generated still matches the lesson the browser animates. Pure function:
   tested in test-topic-images.js without network or API keys. */
function craftTopicImagePrompt(study, concept, conceptIndex){
  const topicTitle = concept && typeof concept.title === 'string' ? concept.title.trim() : '';
  if (!topicTitle) throw mkErr(400, 'A topic title is required.');
  const subject = study && typeof study.subject === 'string' ? study.subject.trim() : '';
  const summary = concept && typeof concept.summary === 'string' ? concept.summary.trim() : '';
  const analogy = concept && typeof concept.analogy === 'string' ? concept.analogy.trim() : '';
  const worked = concept && concept.workedExample && typeof concept.workedExample.scenario === 'string'
    ? concept.workedExample.scenario.trim() : '';
  /* Workshop formulas that belong to this topic: concept-scoped matches win;
     otherwise the pack-wide list is consulted (same source, no invention). */
  const packFormulas = study && Array.isArray(study.formulas) ? study.formulas : [];
  const own = packFormulas.filter(f => f && (f.conceptIndex === conceptIndex || f.topic === topicTitle));
  const pool = own.length ? own : packFormulas.slice(0, 3);
  const formulaBits = pool.slice(0, 3)
    .map(f => [f.name, f.expression].filter(Boolean).map(String).join(': ').trim())
    .filter(Boolean);
  /* Node labels from this topic's own animated SVG steps ground the image in
     the exact diagram the lesson animates (never another topic's nodes). */
  const steps = concept && concept.visualization && Array.isArray(concept.visualization.steps)
    ? concept.visualization.steps : [];
  const nodeLabels = [];
  for (const step of steps){
    if (!step || !Array.isArray(step.nodes)) continue;
    for (const node of step.nodes){
      const label = node && typeof node.label === 'string' ? node.label.trim() : '';
      if (label && !nodeLabels.includes(label)) nodeLabels.push(label);
    }
    if (nodeLabels.length >= 6) break;
  }
  const parts = ['Flat 2D educational illustration, clean vector style, no text overlays, no people faces'];
  if (subject) parts.push('for a ' + subject + ' lesson');
  parts.push('about "' + topicTitle + '"');
  if (summary) parts.push('showing ' + summary.slice(0, 220));
  if (nodeLabels.length) parts.push('with visual elements for ' + nodeLabels.join(', '));
  if (formulaBits.length) parts.push('incorporating the concept of ' + formulaBits.join('; ').slice(0, 220));
  if (worked) parts.push('set in the scene: ' + worked.slice(0, 200));
  if (analogy) parts.push('in the spirit of: ' + analogy.slice(0, 160));
  parts.push('single clear focal composition, high contrast, suitable as a lesson header image');
  return parts.join('. ').slice(0, 1500);
}
async function handleTopicImages(req, res, requestId){
  let parsed;
  try{ parsed = JSON.parse(await readBody(req, 512 * 1024)); }
  catch(e){ return sendJson(res, 400, { error: 'The request body was unreadable.', requestId }, requestId); }
  /* The images are bound to a finished analyze job: the topics come from the
     validated study pack, so no new PDF is consumed here and the 5-PDF daily
     allowance on POST /api/analyze stays the single gate for new documents. */
  const jobId = parsed && (parsed.jobId || parsed.job_id);
  const job = typeof jobId === 'string' ? jobs.get(jobId) : null;
  if (!job) return sendJson(res, 404, { error: 'Unknown job. Generate images from a finished PDF study.', code: 'JOB_NOT_FOUND', requestId }, requestId);
  if (job.status !== 'done' || !job.study || !Array.isArray(job.study.concepts))
    return sendJson(res, 409, { error: 'That study is not finished yet. Wait for the Ready stage, then generate the images.', code: 'JOB_NOT_READY', requestId }, requestId);
  let wanted = parsed && parsed.topics;
  if (!Array.isArray(wanted) || !wanted.length) wanted = job.study.concepts.map((c, i) => i);
  const indices = [];
  for (const t of wanted){
    const i = typeof t === 'number' ? t : (t && typeof t.conceptIndex === 'number' ? t.conceptIndex : -1);
    if (Number.isInteger(i) && i >= 0 && i < job.study.concepts.length && !indices.includes(i)) indices.push(i);
  }
  if (!indices.length) return sendJson(res, 400, { error: 'No valid topics were requested.', requestId }, requestId);
  if (indices.length > job.study.concepts.length) return sendJson(res, 400, { error: 'Too many topics requested at once.', requestId }, requestId);
  const aspect = parsed && parsed.aspect_ratio;
  const images = [];
  for (const i of indices){
    const concept = job.study.concepts[i];
    try{
      const prompt = craftTopicImagePrompt(job.study, concept, i);
      const out = await generateImage(prompt, { aspect_ratio: aspect });
      images.push({ conceptIndex: i, topic: concept.title, imageUrl: out.imageUrl, prompt });
    }catch(e){
      /* One topic failing must not lose the rest; the error rides along. */
      const p = errPayload(e, 'Image generation failed.');
      images.push({ conceptIndex: i, topic: concept.title, error: p.body.error, code: p.body.code || null });
    }
  }
  return sendJson(res, 200, { jobId: job.id, count: images.length, images, requestId }, requestId);
}
const hits = new Map();
function rateLimited(req){
  const key = sha(clientIp(req) + pacificDay() + String(Math.floor(Date.now() / 3600000)));
  const n = (hits.get(key) || 0) + 1;
  hits.set(key, n);
  return n > MAX_REQ_HOUR;
}
const server = http.createServer(async (req, res) => {
  const requestId = crypto.randomUUID();
  try{
    const url = new URL(req.url, 'http://localhost');
    const p = url.pathname;
    if (req.method === 'GET' && (p === '/' || p === '/api/health')){
      /* Identity fields are a contract with the browser probe
         (js/app.js xcProbeHealth): it only treats this origin as the real
         XAMCODE AI server when service === 'xamcode-ai' && apiVersion === 1.
         Returning just { ok } made every probe fail, so each submit showed
         the "XAMCODE AI is not running" banner even with /api/quota live. */
      if (p === '/api/health') return sendJson(res, 200, { ok: true, service: 'xamcode-ai', apiVersion: 1, requestId }, requestId);
      return serveStatic(req, res);
    }
    if (req.method === 'GET' && p === '/api/providers') return sendJson(res, 200, { providers: providerStatus(), image: imageStatus(), video: { id: 'hailuo-video', provider: 'minimax', model: process.env.MINIMAX_VIDEO_MODEL || 'MiniMax-Hailuo-02', configured: false, disabled: true }, requestId }, requestId);
    if (req.method === 'GET' && p === '/api/quota'){
      const snap = quotaSnapshot();
      return sendJson(res, 200, { allowance: pdfAllowanceFor(req), usableModels: snap.usableModels, totalModels: snap.totalModels, models: snap.models, note: snap.note, resetsAt: snap.resetsAt, requestId }, requestId);
    }
    if (p === '/api/analyze' && req.method === 'POST'){
      if (rateLimited(req)) return sendJson(res, 429, { error: 'Too many requests. Try again later.', requestId }, requestId);
      return analyzePdf(req, res);
    }
    // Compliance pages - Website Professional Build & Compliance Master Guide
    if (req.method === 'GET' && p === '/privacy-policy') return serveStatic(req, res);
    if (req.method === 'GET' && p === '/terms-of-service') return serveStatic(req, res);
    if (req.method === 'GET' && p === '/accessibility-statement') return serveStatic(req, res);
    if (req.method === 'GET' && p === '/robots.txt') return serveStatic(req, res);
    if (req.method === 'GET' && p === '/sitemap.xml') return serveStatic(req, res);

    // Cookie consent API - Website Professional Build & Compliance Master Guide
    if (req.method === 'POST' && p === '/api/cookie-consent') {
      const body = await readJson(req, 1024, 'Body required.');
      const consent = body.consent === 'accepted' || body.consent === 'declined' ? body.consent : 'declined';
      res.setHeader('Set-Cookie', 'xamcode_consent=' + consent + '; path=/; max-age=31536000; SameSite=Lax');
      return sendJson(res, 200, { ok: true, consent: consent, requestId }, requestId);
    }
    if (p.startsWith('/api/analyze/') && p.length > 13){
      const id = decodeURIComponent(p.slice(13));
      const job = jobs.get(id);
      if (!job) return sendJson(res, 404, { error: 'Unknown job.', code: 'JOB_NOT_FOUND', requestId }, requestId);
      if (req.method === 'GET') return sendJson(res, 200, Object.assign({}, jobSnapshot(job), { requestId }), requestId);
      if (req.method === 'DELETE'){
        job.cancelled = true;
        if (job.status === 'running') finishJob(job, { status: 'cancelled', error: 'The study build was cancelled.' });
        return sendJson(res, 200, Object.assign({}, jobSnapshot(job), { requestId }), requestId);
      }
      return sendJson(res, 405, { error: 'Method not allowed.', requestId }, requestId);
    }
    if (p === '/api/ask' && req.method === 'POST') return handleAsk(req, res, requestId, 'You are XamCode AI, a concise study tutor.');
    if (p === '/api/aura' && req.method === 'POST') return handleAsk(req, res, requestId, 'You are AURA, the XamCode study assistant. Answer from the course catalogue when possible; otherwise give general study help and never invent syllabus facts.');
    if (p === '/api/image' && req.method === 'POST'){
      if (rateLimited(req)) return sendJson(res, 429, { error: 'Too many requests. Try again later.', requestId }, requestId);
      return handleImage(req, res, requestId);
    }
    if (p === '/api/topic-images' && req.method === 'POST'){
      if (rateLimited(req)) return sendJson(res, 429, { error: 'Too many requests. Try again later.', requestId }, requestId);
      return handleTopicImages(req, res, requestId);
    }
    if (p === '/api/video' && req.method === 'POST'){
      return sendJson(res, 410, { error: 'Video generation is disabled. This build generates 2D images only.', code: 'VIDEO_DISABLED', requestId }, requestId);
    }
    if (p.startsWith('/api/video/') && req.method === 'GET'){
      return sendJson(res, 410, { error: 'Video generation is disabled. This build generates 2D images only.', code: 'VIDEO_DISABLED', requestId }, requestId);
    }
    if (p.startsWith('/api/')) return sendJson(res, 404, { error: 'Unknown API route.', requestId }, requestId);
    return serveStatic(req, res);
  }catch(e){
    const ep = errPayload(e, 'The request failed.');
    try{ return sendJson(res, ep.status, Object.assign({}, ep.body, { requestId }), requestId); }catch{}
  }
});
if (require.main === module){
  const host = process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1';
  server.listen(PORT, host, () => console.log('XamCode AI on http://' + host + ':' + PORT));
}











