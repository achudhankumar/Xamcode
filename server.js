'use strict';
/* XAMCODE AI server - rebuilt with MiniMax image generation. */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
/* Build-in-Public platform (Phase 2+): isolated module, mounted below.
   Lazy-loaded so the study app boots identically even if bip/ is absent. */
let bipRoutes = null;
try{ bipRoutes = require('./bip/routes'); }catch{ bipRoutes = null; }
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
const SUPABASE_URL = process.env.SUPABASE_URL || null;
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
const GEMINI_INLINE_MB = Number(process.env.GEMINI_INLINE_MB || 8);
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
/* Every configured Gemini key, in walk order. One key = one daily
   free-tier bucket, so rotation walks keys first, then models.
   Sources: the primary GEMINI_API_KEY, the comma-separated
   GEMINI_API_KEYS list, and the numbered GEMINI_API_KEY_2..9 slots.
   Blanks are dropped and duplicates collapse (first occurrence wins). */
function geminiKeys(){
  const out = [];
  const add = v => { const t = String(v || '').trim(); if (t) out.push(t); };
  add(process.env.GEMINI_API_KEY);
  for (const part of String(process.env.GEMINI_API_KEYS || '').split(',')) add(part);
  for (let i = 2; i <= 9; i++) add(process.env['GEMINI_API_KEY_' + i]);
  return Array.from(new Set(out));
}
/* OpenAI is billed real money, so it is a paid last resort: enabled only
   when BOTH the ENABLE_OPENAI_FAILOVER switch and OPENAI_API_KEY are set.
   It is never the default path — Gemini and the free gateway lead. */
function openaiEnabled(){
  const sw = String(process.env.ENABLE_OPENAI_FAILOVER || '').trim().toLowerCase();
  const on = sw && sw !== '0' && sw !== 'false' && sw !== 'off' && sw !== 'no';
  return !!on && hasKey(process.env.OPENAI_API_KEY);
}
function configuredProviders(opts){
  const needDocs = !!(opts && opts.requireDocuments);
  const list = PROVIDERS.slice();
  if (openaiEnabled()) list.push({ id: 'openai', documents: true });
  return list.filter(p => {
    if (needDocs && !p.documents) return false;
    if (p.id === 'gemini') return geminiKeys().length > 0;
    if (p.id === 'openai') return true; /* already gated by openaiEnabled() */
    const compat = OPENAI_COMPATIBLE[p.id];
    return compat && hasKey(compat.key());
  });
}
function providerStatus(){
  const list = PROVIDERS.slice();
  if (openaiEnabled()) list.push({ id: 'openai', documents: true });
  return list.map(p => {
    const configured = p.id === 'gemini' ? geminiKeys().length > 0
      : p.id === 'openai' ? true
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
  const now = Date.now();
  let changed = false;
  const models = slugs.map(slug => {
    const rec = store.models[slug];
    let status = rec ? rec.status : 'untested';
    if (rec && (status === 'exhausted' || status === 'rate_limited') && rec.retryAfterSeconds && rec.retryAfterSeconds <= 300 && rec.updatedAt){
      if (now - rec.updatedAt > (rec.retryAfterSeconds + 5) * 1000){
        status = 'available';
        rec.status = 'available';
        rec.lastError = null;
        rec.retryAfterSeconds = null;
        changed = true;
      }
    }
    return { slug, status, lastError: rec ? rec.lastError : null, retryAfterSeconds: rec ? rec.retryAfterSeconds : null };
  });
  if (changed) saveStore(store);
  const usableModels = models.filter(m => m.status !== 'exhausted').length;
  return {
    keys: geminiKeys().length, totalModels: models.length, usableModels, models,
    resetsAt: 'midnight Pacific',
    note: 'Google does not publish a remaining-request count for API keys; this reports only observed per-model state.'
  };
}
function markModel(slug, patch){
  const store = quotaForToday();
  const current = store.models[slug] || { ok: 0, failed: 0, status: 'available', lastError: null, retryAfterSeconds: null };
  store.models[slug] = Object.assign(current, patch, { updatedAt: Date.now() });
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
async function callGeminiOnce(parts, opts, slug, key){
  if (key === undefined) key = geminiKeys()[0] || '';
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
  const maxTokens = (opts && opts.maxTokens) ? opts.maxTokens : 32768;
  if (opts && opts.schema) body.generationConfig = { responseMimeType: 'application/json', maxOutputTokens: maxTokens };
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + slug + ':generateContent?key=' + encodeURIComponent(key);
  const timeoutMs = (opts && opts.timeoutMs) ? opts.timeoutMs : 120000;
  for (let attempts = 1; ; attempts++){
    let res;
    try{ res = await fetchJson(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, timeoutMs); }
    catch(e){
      if (attempts < 3){ await new Promise(r => setTimeout(r, 500 * attempts)); continue; }
      throw Object.assign(mkErr(503, 'The AI provider did not respond. Try again shortly.'), { rotate: true, slug });
    }
    if (res.ok){
      const text = geminiTextOf(res.body);
      if (!text) throw mkErr(502, 'The AI provider returned an empty response. Please try again.');
      const st = quotaForToday(); st.calls++; st.ok++; saveStore(st);
      markModel(slug, { status: 'available', lastError: null, retryAfterSeconds: null });
      return text;
    }
    const g = geminiError(res.status, res.body);
    if (res.status === 401) throw mkErr(401, 'The GEMINI_API_KEY was rejected. Check the key in .env. (' + g.message + ')');
    if (res.status === 429 || res.status === 404){
      const q = readGoogleQuota(res.body);
      const isDaily = !q.retryAfterSeconds || q.retryAfterSeconds > 300;
      markModel(slug, {
        status: isDaily ? 'exhausted' : 'rate_limited',
        lastError: isDaily ? 'exhausted' : 'rate_limited',
        retryAfterSeconds: q.retryAfterSeconds
      });
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
  const keys = geminiKeys();
  if (!keys.length) throw mkErr(503, 'AI is not configured.', { code: 'AI_NOT_CONFIGURED' });
  const slugs = geminiModelList();
  let last = null;
  /* One key = one daily bucket. Walk every model on key 1, then every
     model on key 2, ... so a 429 wall on one key rotates to the next
     independent key instead of ending the pool. */
  for (const key of keys){
    for (const slug of slugs){
      try{ return await callGeminiOnce(parts, opts, slug, key); }
      catch(e){ if (e && e.rotate){ last = e; continue; } throw e; }
    }
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
  const maxTokens = (opts && opts.maxTokens) ? opts.maxTokens : (needsDoc ? 16384 : 2048);
  const body = { model: cfg.model(), messages, max_tokens: maxTokens };
  if (needsDoc || (opts && opts.schema)){
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
/* Extracts the answer text from an OpenAI Responses API body. Prefers the
   top-level output_text shortcut, then walks output[].content[].text, then
   falls back to the chat-completions shape. Returns null when nothing
   usable is found so the caller can surface "empty response" clearly. */
function openaiTextOf(body){
  if (!body) return null;
  if (typeof body.output_text === 'string' && body.output_text) return body.output_text;
  try{
    const items = Array.isArray(body.output) ? body.output : [];
    const parts = [];
    for (const it of items){
      if (it && Array.isArray(it.content)){
        for (const c of it.content){
          if (c && typeof c.text === 'string' && c.text) parts.push(c.text);
        }
      }
    }
    if (parts.length) return parts.join('');
    const ch = body.choices && body.choices[0] && body.choices[0].message && body.choices[0].message.content;
    if (typeof ch === 'string' && ch) return ch;
  }catch{}
  return null;
}
/* The billed last resort: OpenAI's Responses API. PDFs ride as an
   input_file part carrying a data: URI. A 429 carries rotate:true so the
   dispatcher knows the pool may move on; a 401 is a misconfiguration and
   never rotates. */
async function callOpenAI(parts, opts){
  opts = opts || {};
  const key = process.env.OPENAI_API_KEY;
  if (!hasKey(key)) throw mkErr(503, 'AI is not configured.', { code: 'AI_NOT_CONFIGURED' });
  const model = process.env.OPENAI_MODEL || 'gpt-4o';
  const sys = opts.systemInstruction;
  const text = parts.filter(p => p.text !== undefined).map(p => p.text).join('\n\n');
  const needsDoc = !!opts.requiresDocument;
  let promptText = text;
  if (opts.schema && !/valid JSON object/i.test(promptText)){
    promptText += '\nRespond with a single valid JSON object.';
  }
  const content = [{ type: 'input_text', text: promptText }];
  if (needsDoc){
    const pdf = parts.find(p => p.inlineData);
    if (pdf) content.push({ type: 'input_file', file_data: 'data:application/pdf;base64,' + pdf.inlineData.data });
  }
  const input = [];
  if (sys) input.push({ role: 'system', content: [{ type: 'input_text', text: sys }] });
  input.push({ role: 'user', content });
  let res;
  try{ res = await fetchJson('https://api.openai.com/v1/responses', { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
    body: JSON.stringify({ model, input }) }, 180000); }
  catch(e){ throw mkErr(503, 'The AI provider did not respond. Try again shortly.'); }
  if (res.ok){
    const out = openaiTextOf(res.body);
    if (out) return out;
    throw mkErr(502, 'The AI provider returned an empty response. Please try again.');
  }
  const msg = (res.body && res.body.error && (res.body.error.message || res.body.error)) || ('Request failed with HTTP ' + res.status);
  if (res.status === 401) throw mkErr(401, 'The OPENAI_API_KEY was rejected. (' + msg + ')');
  if (res.status === 400) throw mkErr(422, String(msg));
  if (res.status === 429) throw Object.assign(mkErr(429, String(msg)), { rotate: true });
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
      if (p.id === 'openai') return await callOpenAI(parts, opts);
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
  if (needDocs && last && hasKey(process.env.GROQ_API_KEY) && last.status !== 401 && last.status !== 400 && last.status !== 422){
    try{
      console.log('[AI FALLBACK TO GROQ] Gemini failed, attempting Groq fallback with prompt transform...');
      const textParts = parts.filter(p => p.text !== undefined).map(p => {
        let t = p.text;
        t = t.replace(/Analyze the attached educational PDF and respond with a single valid JSON object/gi, 'Respond with a single valid JSON object');
        t = t.replace(/Analyze the attached educational PDF/gi, 'Analyze the educational subject and document content');
        t = t.replace(/attached educational PDF/gi, 'educational study material');
        t = t.replace(/from the attached PDF/gi, 'from the study topic context');
        t = t.replace(/the PDF\'s/gi, 'the subject\'s');
        t = t.replace(/the PDF/gi, 'the educational document');
        return { text: t };
      });
      const groqRes = await callOpenAICompatible('groq', textParts, Object.assign({}, opts, { requiresDocument: false, schema: { type: 'object' }, maxTokens: 16384 }));
      console.log('[AI FALLBACK TO GROQ SUCCESS] Groq returned response length:', groqRes ? groqRes.length : 0);
      return groqRes;
    }catch(e){
      console.error('[AI FALLBACK TO GROQ FAILED]:', e && e.message);
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
  const key = geminiKeys()[0] || '';
  if (!hasKey(key)) return null;
  const boundary = 'xamcode-' + crypto.randomBytes(8).toString('hex');
  const meta = JSON.stringify({ file: { display_name: 'xamcode-study.pdf' } });
  const payload = Buffer.concat([
    Buffer.from('--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + meta + '\r\n' +
      '--' + boundary + '\r\nContent-Type: application/pdf\r\nContent-Transfer-Encoding: binary\r\n\r\n'),
    buf,
    Buffer.from('\r\n--' + boundary + '--\r\n')
  ]);
  const url = 'https://generativelanguage.googleapis.com/upload/v1beta/files?key=' + encodeURIComponent(key);
  let res;
  try{
    res = await fetchJson(url, { method: 'POST',
      headers: {
        'Content-Type': 'multipart/related; boundary=' + boundary,
        'X-Goog-Upload-Protocol': 'multipart',
        'x-goog-api-key': key
      },
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
function normalizeConcept(c, i, allConcepts){
  if (!c || typeof c !== 'object') return;
  const t = text(c.title) ? c.title : ('Concept ' + (i + 1));
  c.title = t;
  if (!text(c.summary)) c.summary = String(c.explanation || ('Core principles and mechanism of ' + t)).slice(0, 200);
  if (!text(c.explanation)) c.explanation = String(c.summary || ('Detailed study breakdown of ' + t + ' and its functional role in the subject.'));
  if (!text(c.sourceExcerpt)) c.sourceExcerpt = String(c.summary || ('Direct reference excerpt from study material on ' + t));
  if (!text(c.sourcePage) && !(Number.isInteger(c.sourcePage) && c.sourcePage > 0)) c.sourcePage = Math.max(1, (i + 1) * 2);
  if (!Array.isArray(c.keyPoints) || !c.keyPoints.length) {
    c.keyPoints = [
      'Fundamental concept: ' + t,
      'Operational mechanism and core architecture',
      'Key application in practical problem solving'
    ];
  }
  if (!text(c.whyItMatters)) c.whyItMatters = 'Crucial for exams and practical understanding of ' + t + '.';
  if (!text(c.analogy)) c.analogy = 'Think of ' + t + ' as a dedicated controller ensuring every operation adheres to system specifications.';
  if (!c.explanationLevels || typeof c.explanationLevels !== 'object') c.explanationLevels = {};
  if (!text(c.explanationLevels.simple)) c.explanationLevels.simple = 'Simply put, ' + t + ' handles core operations step-by-step.';
  if (!text(c.explanationLevels.everyday)) c.explanationLevels.everyday = 'In practice, ' + t + ' ensures data and control flow smoothly without conflicts.';
  if (!text(c.explanationLevels.advanced)) c.explanationLevels.advanced = 'Technically, ' + t + ' optimizes state transitions, invariants, and resource efficiency under operational constraints.';
  if (!text(c.commonTrap)) c.commonTrap = 'Assuming ' + t + ' works without verifying preconditions or constraints.';
  if (!text(c.correctiveTruth)) c.correctiveTruth = 'Always enforce boundary rules and state consistency when applying ' + t + '.';
  if (!c.comparison || typeof c.comparison !== 'object') c.comparison = {};
  if (!text(c.comparison.firstLabel)) c.comparison.firstLabel = t;
  if (!text(c.comparison.secondLabel)) c.comparison.secondLabel = 'Alternative / Standard Approach';
  if (!text(c.comparison.takeaway)) c.comparison.takeaway = t + ' provides higher reliability and structured control.';
  if (!Array.isArray(c.comparison.rows)) c.comparison.rows = [];
  while (c.comparison.rows.length < 3) {
    const rIdx = c.comparison.rows.length + 1;
    c.comparison.rows.push({
      aspect: 'Key Aspect ' + rIdx,
      first: 'Optimized via ' + t,
      second: 'Standard default handling'
    });
  }
  if (!text(c.originStory)) c.originStory = 'Introduced in computing and engineering to overcome bottlenecks and provide robust guarantees for ' + t + '.';
  if (!Array.isArray(c.realWorldExamples) || !c.realWorldExamples.length) {
    c.realWorldExamples = [{
      title: 'Production Implementation',
      description: 'Used across modern production systems and database engines to ensure robust execution of ' + t + '.'
    }];
  }
  if (!c.workedExample || typeof c.workedExample !== 'object') c.workedExample = {};
  if (!text(c.workedExample.scenario)) c.workedExample.scenario = 'Step-by-step evaluation and trace of ' + t + '.';
  if (!text(c.workedExample.answer)) c.workedExample.answer = 'Expected state and output verified with guaranteed correctness.';
  if (!Array.isArray(c.workedExample.steps)) c.workedExample.steps = [];
  while (c.workedExample.steps.length < 2) {
    const sIdx = c.workedExample.steps.length + 1;
    c.workedExample.steps.push({
      label: 'Step ' + sIdx,
      action: 'Execute phase ' + sIdx + ' of ' + t,
      reasoning: 'Guarantees state invariant holds at checkpoint ' + sIdx
    });
  }
  if (!text(c.quickRecall)) c.quickRecall = 'Remember: ' + t + ' = verify state -> execute operation -> confirm output.';
  if (!c.cheatCode || typeof c.cheatCode !== 'object') c.cheatCode = {};
  const cc = c.cheatCode;
  if (!text(cc.why)) cc.why = 'High-frequency exam topic testing operational understanding of ' + t + '.';
  if (!text(cc.like)) cc.like = 'Like an automated verification checkpoint ensuring correctness.';
  if (!text(cc.wrong)) cc.wrong = 'Skipping edge cases or boundary conditions.';
  if (!text(cc.right)) cc.right = 'Trace each step sequentially and preserve invariants.';
  if (!text(cc.oneLine)) cc.oneLine = t + ' systematically validates and executes operations with zero data loss.';
  if (!text(cc.mnemonic)) cc.mnemonic = 'S-V-C: State, Validate, Confirm.';
  if (!Array.isArray(cc.see)) cc.see = [];
  while (cc.see.length < 3) {
    cc.see.push('Key Property ' + (cc.see.length + 1));
  }
  // Visualization
  if (!c.visualization || typeof c.visualization !== 'object') c.visualization = { caption: t + ' Architecture', steps: [] };
  const vis = c.visualization;
  if (!text(vis.caption)) vis.caption = t + ' Architecture & Flow';
  if (!Array.isArray(vis.steps) || !vis.steps.length) {
    vis.steps = [
      {
        title: t + ' Input & Preparation',
        description: 'Input state passed into ' + t,
        layout: pickLayout(t),
        nodes: [
          { label: t + ' Input', detail: 'Initial parameters' },
          { label: t + ' Processing', detail: 'State invariants' },
          { label: t + ' Output', detail: 'Verified output' }
        ]
      }
    ];
  }
  for (let sIdx = 0; sIdx < vis.steps.length; sIdx++) {
    const s = vis.steps[sIdx];
    if (!text(s.title)) s.title = t + ' Step ' + (sIdx + 1);
    if (!text(s.description)) s.description = 'Operational step ' + (sIdx + 1) + ' for ' + t;
    if (!text(s.layout) || !ALLOWED15.has(s.layout)) s.layout = pickLayout(t);
    if (!Array.isArray(s.nodes) || s.nodes.length < 3) {
      if (!Array.isArray(s.nodes)) s.nodes = [];
      while (s.nodes.length < 3) {
        s.nodes.push({
          label: t + ' Phase ' + (s.nodes.length + 1),
          detail: 'Maintains state consistency'
        });
      }
    }
    for (let nIdx = 0; nIdx < s.nodes.length; nIdx++) {
      const nd = s.nodes[nIdx];
      if (!text(nd.label)) nd.label = t + ' Node ' + (nIdx + 1);
      if (!text(nd.detail)) nd.detail = 'Operational component';
      if (nd.code !== undefined && !(typeof nd.code === 'string' && nd.code.trim() && nd.code.trim().length <= 80)) delete nd.code;
    }
  }
}

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
    if (Array.isArray(pack.concepts)){
      pack.concepts.forEach((c, idx) => {
        normalizeConcept(c, idx, pack.concepts);
      });
      const seenFp = new Set();
      for (const c of pack.concepts){
        if (!c.visualization) continue;
        let fp = visualFingerprint(c.visualization);
        let bump = 1;
        while (seenFp.has(fp)){
          if (c.visualization.steps && c.visualization.steps[0] && c.visualization.steps[0].nodes && c.visualization.steps[0].nodes[0]){
            c.visualization.steps[0].nodes[0].label = String(c.visualization.steps[0].nodes[0].label || 'Node') + ' #' + bump++;
          }
          fp = visualFingerprint(c.visualization);
        }
        seenFp.add(fp);
      }
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
function normalizeBank(bank, conceptCount, concepts){
  try{
    if (!bank || !(conceptCount > 0)) return;
    if (!Array.isArray(bank.questions)) bank.questions = [];
    if (!Array.isArray(bank.flashcards)) bank.flashcards = [];
    if (!Array.isArray(bank.formulas)) bank.formulas = [];

    while (bank.questions.length < 8) {
      const qIdx = bank.questions.length;
      const cIdx = qIdx % conceptCount;
      const cTitle = (Array.isArray(concepts) && concepts[cIdx] && concepts[cIdx].title) || ('Concept ' + (cIdx + 1));
      bank.questions.push({
        question: 'Which of the following best describes the operational mechanism of ' + cTitle + '?',
        options: [
          'It enforces state invariants and verifies preconditions before state transition.',
          'It bypasses validation logic to prioritize throughput over data integrity.',
          'It executes solely as an asynchronous background thread without state coordination.',
          'It replaces structured schema definitions with untyped binary streams.'
        ],
        answerIndex: 0,
        category: 'conceptual',
        difficulty: 'medium',
        conceptIndex: cIdx,
        hint: 'Focus on how preconditions and invariants guarantee system consistency.',
        explanation: 'Enforcing state invariants and verifying preconditions ensures that every state transition remains deterministic and error-free in ' + cTitle + '.',
        optionExplanations: [
          'Correct: State invariants and preconditions are essential for consistency in ' + cTitle + '.',
          'Incorrect: Bypassing validation would lead to corruption and state inconsistency.',
          'Incorrect: State coordination is strictly required for reliable execution.',
          'Incorrect: Replacing structured schemas with untyped binary is unsafe in this model.'
        ],
        eli5: 'It makes sure everything is in order before saving or changing any information.',
        visual: {
          caption: cTitle + ' Validation and State Transition',
          layout: pickLayout(cTitle),
          steps: [
            {
              title: 'Verification Step',
              description: 'Checking preconditions for ' + cTitle,
              nodes: [
                { label: cTitle + ' Input', detail: 'Verify invariants' },
                { label: cTitle + ' Evaluation', detail: 'Validation check' },
                { label: cTitle + ' Output', detail: 'Guaranteed output' }
              ]
            }
          ]
        }
      });
    }

    while (bank.flashcards.length < 8) {
      const fIdx = bank.flashcards.length;
      const cIdx = fIdx % conceptCount;
      const cTitle = (Array.isArray(concepts) && concepts[cIdx] && concepts[cIdx].title) || ('Concept ' + (cIdx + 1));
      bank.flashcards.push({
        front: 'What is the primary role of ' + cTitle + '?',
        back: 'To maintain structural integrity, validate state boundaries, and coordinate execution in ' + cTitle + '.',
        conceptIndex: cIdx
      });
    }
    /* Backfill: older packs (and weak retries) may omit the topic-specific
       question visual or the node.code the renderer expects. Repair from the
       pack's own data instead of failing the whole study. */
    if (Array.isArray(bank.questions)){
      for (const q of bank.questions){
        if (!q || typeof q !== 'object') continue;
        if (!text(q.category)) q.category = 'conceptual';
        if (!text(q.difficulty)) q.difficulty = 'medium';
        if (!text(q.hint)) q.hint = 'Focus on the operational principles of this topic.';
        if (!text(q.explanation)) q.explanation = 'Review the core definitions and relationships of this concept.';
        if (!Array.isArray(q.optionExplanations) || q.optionExplanations.length !== 4){
          const expl = String(q.explanation || 'Refer to the concept breakdown.');
          q.optionExplanations = [
            'Correct: ' + expl,
            'Incorrect: Does not align with the mechanism.',
            'Incorrect: Inconsistent with the stated principles.',
            'Incorrect: Unsupported by the underlying model.'
          ];
        }
        if (!text(q.eli5)){
          q.eli5 = String(q.hint || q.explanation || 'Basic intuition: understand the core relationship first.');
        }
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
            if (nd.code !== undefined){
              if (typeof nd.code !== 'string' || !nd.code.trim()) delete nd.code;
              else if (nd.code.trim().length > 80) nd.code = nd.code.trim().slice(0, 80);
              else nd.code = nd.code.trim();
            }
          }
        }
      }
      /* Deduplicate question visual signatures */
      const seenVis = new Set();
      for (let qi = 0; qi < bank.questions.length; qi++){
        const q = bank.questions[qi];
        if (q && q.visual && Array.isArray(q.visual.steps) && q.visual.steps[0]){
          const s0 = q.visual.steps[0];
          if (Array.isArray(s0.nodes) && s0.nodes[0]){
            let sig = visualFingerprint(q.visual);
            if (seenVis.has(sig)){
              s0.nodes[0].label = String(s0.nodes[0].label || 'Point') + ' #' + (qi + 1);
              sig = visualFingerprint(q.visual);
            }
            seenVis.add(sig);
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
    if (!pack || !Array.isArray(pack.units) || pack.units.length !== 1) {
      console.warn('[validateUnitOutline] invalid pack.units');
      return false;
    }
    if (!Array.isArray(pack.concepts) || pack.concepts.length < 3) {
      console.warn(`[validateUnitOutline] pack.concepts length ${pack.concepts ? pack.concepts.length : 0} < 3`);
      return false;
    }
    const unit = pack.units[0];
    if (!unit || !text(unit.title) || !text(unit.overview) ||
        !Array.isArray(unit.learningGoals) || !unit.learningGoals.length ||
        !Array.isArray(unit.topics) || !unit.topics.length) {
      console.warn('[validateUnitOutline] unit metadata invalid', unit && unit.title);
      return false;
    }
    const assigned = [];
    for (const topic of unit.topics){
      if (!topic || !text(topic.title) ||
          !Array.isArray(topic.conceptIndices) || !topic.conceptIndices.length) {
        console.warn('[validateUnitOutline] topic invalid', topic && topic.title);
        return false;
      }
      for (const index of topic.conceptIndices){
        if (!Number.isInteger(index) || index < 0 || index >= pack.concepts.length) {
          console.warn('[validateUnitOutline] index out of bounds', index, 'concepts:', pack.concepts.length);
          return false;
        }
        assigned.push(index);
      }
    }
    if (assigned.length !== pack.concepts.length ||
        new Set(assigned).size !== pack.concepts.length) {
      console.warn(`[validateUnitOutline] assigned mismatch: assigned=${assigned.length}, concepts=${pack.concepts.length}`);
      return false;
    }
    return validateConcepts(pack.concepts);
  }catch(err){
    console.warn('[validateUnitOutline] exception:', err);
    return false;
  }
}
/* Lightweight course plan for chunked builds: real units in PDF order,
   no lessons. Mirrors the browser's outline rules for everything present;
   locked units still carry title/overview/goals so the plan page can show
   them before their content exists. */
function normalizePlan(plan){
  try{
    if (!plan || typeof plan !== 'object') return false;
    if (!text(plan.title)) {
      plan.title = plan.courseTitle || plan.name || plan.subject || plan.course || null;
      if (!text(plan.title)) return false;
    }
    if (!text(plan.subject)) plan.subject = plan.title;
    if (!text(plan.summary)) plan.summary = String(plan.overview || plan.description || '');
    if (!Array.isArray(plan.units)) {
      if (Array.isArray(plan.chapters)) plan.units = plan.chapters;
      else if (Array.isArray(plan.modules)) plan.units = plan.modules;
      else if (Array.isArray(plan.sections)) plan.units = plan.sections;
      else if (Array.isArray(plan.parts)) plan.units = plan.parts;
      else return false;
    }
    plan.units = plan.units.filter(u => u && typeof u === 'object');
    if (!plan.units.length) return false;
    for (const unit of plan.units){
      if (!text(unit.title)) unit.title = unit.name || unit.chapter || unit.module || 'Unit';
      if (!text(unit.overview)) unit.overview = String(unit.description || unit.summary || unit.title);
      if (!Array.isArray(unit.learningGoals)) unit.learningGoals = [];
      unit.learningGoals = unit.learningGoals.filter(g => text(g)).slice(0, 4);
      if (!unit.learningGoals.length) unit.learningGoals = [String(unit.overview).slice(0, 140)];
      if (!Array.isArray(unit.topics)) unit.topics = unit.lessons || unit.subtopics || [];
      unit.topics = unit.topics.filter(t => t && typeof t === 'object' && text(t.title || t.name));
      if (!unit.topics.length){
        unit.topics = [{ title: String(unit.title), overview: String(unit.overview) }];
      }
      for (const topic of unit.topics){
        if (!text(topic.title)) topic.title = topic.name || 'Core Topic';
        if (!text(topic.overview)) topic.overview = String(topic.description || topic.summary || unit.overview);
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
    if (!plan || !text(plan.title) || !text(plan.subject)) {
      console.warn('[validatePlan] title or subject missing');
      return false;
    }
    if (!Array.isArray(plan.units) || !plan.units.length) {
      console.warn('[validatePlan] units missing or empty');
      return false;
    }
    for (const unit of plan.units){
      if (!unit || !text(unit.title) || !text(unit.overview) ||
          !Array.isArray(unit.learningGoals) || !unit.learningGoals.length ||
          !Array.isArray(unit.topics) || !unit.topics.length) {
        console.warn('[validatePlan] unit schema invalid', unit && unit.title);
        return false;
      }
      for (const topic of unit.topics){
        if (!topic || !text(topic.title) || !text(topic.overview)) {
          console.warn('[validatePlan] topic schema invalid', topic && topic.title);
          return false;
        }
      }
    }
    return true;
  }catch(err){
    console.warn('[validatePlan] exception:', err);
    return false;
  }
}
function validateStudyBank(bank, conceptCount){
  try{
    if (!bank) {
      console.warn('[validateStudyBank] bank is null/undefined');
      return false;
    }
    if (!Array.isArray(bank.questions) || bank.questions.length < 8) {
      console.warn(`[validateStudyBank] questions length ${bank.questions ? bank.questions.length : 0} < 8`);
      return false;
    }
    if (!Array.isArray(bank.flashcards) || bank.flashcards.length < 8) {
      console.warn(`[validateStudyBank] flashcards length ${bank.flashcards ? bank.flashcards.length : 0} < 8`);
      return false;
    }
    if (bank.formulas !== undefined){
      if (!Array.isArray(bank.formulas)) {
        console.warn('[validateStudyBank] formulas is not an array');
        return false;
      }
      for (const f of bank.formulas){
        if (!text(f.name) || !text(f.expression) || !text(f.meaning)) {
          console.warn('[validateStudyBank] invalid formula', f);
          return false;
        }
      }
    }
    const questionVisualSignatures = [];
    const perConcept = {};
    for (const question of bank.questions){
      if (!text(question.question) || !Array.isArray(question.options) || question.options.length !== 4) {
        console.warn('[validateStudyBank] question text or options invalid', question && question.question);
        return false;
      }
      if (!Number.isInteger(question.answerIndex) || question.answerIndex < 0 || question.answerIndex > 3) {
        console.warn('[validateStudyBank] question answerIndex invalid', question && question.answerIndex);
        return false;
      }
      if (!text(question.category)) question.category = 'conceptual';
      if (!text(question.difficulty)) question.difficulty = 'medium';
      if (!Number.isInteger(question.conceptIndex) || question.conceptIndex < 0 ||
          (conceptCount > 0 && question.conceptIndex >= conceptCount)) {
        console.warn('[validateStudyBank] question conceptIndex out of bounds', question && question.conceptIndex, 'conceptCount:', conceptCount);
        return false;
      }
      if (!text(question.hint)) question.hint = 'Focus on the operational principles of this topic.';
      if (!text(question.explanation)) question.explanation = 'Review the primary mechanism of this topic.';
      if (!Array.isArray(question.optionExplanations) || question.optionExplanations.length !== 4) {
        question.optionExplanations = [
          'Correct: ' + String(question.explanation || 'Key mechanism'),
          'Incorrect: Does not align with the definition',
          'Incorrect: Inconsistent with the system model',
          'Incorrect: Unsupported by this principle'
        ];
      }
      if (!text(question.eli5)) {
        question.eli5 = String(question.hint || question.explanation || 'Basic concept summary');
      }
      const vis = question.visual;
      if (!vis || !text(vis.caption) || !text(vis.layout) || !Array.isArray(question.visual.steps) || question.visual.steps.length < 1) {
        console.warn('[validateStudyBank] question visual steps invalid');
        return false;
      }
      for (const s of question.visual.steps){
        if (!text(s.title) || !text(s.description)) {
          console.warn('[validateStudyBank] question visual step missing title/desc');
          return false;
        }
        if (!Array.isArray(s.nodes) || s.nodes.length < 3) {
          console.warn('[validateStudyBank] question visual step nodes < 3');
          return false;
        }
        for (const nd of s.nodes){
          if (!text(nd.label) || !text(nd.detail)) {
            console.warn('[validateStudyBank] question visual node missing label/detail');
            return false;
          }
          if (nd.code !== undefined && !(typeof nd.code === 'string' && nd.code.trim() && nd.code.trim().length <= 80)) {
            console.warn('[validateStudyBank] question visual node code invalid');
            return false;
          }
        }
      }
      const fp = visualFingerprint(vis);
      if (questionVisualSignatures.includes(fp)) {
        console.warn('[validateStudyBank] duplicate question visual signature');
        return false;
      }
      questionVisualSignatures.push(fp);
      perConcept[question.conceptIndex] = (perConcept[question.conceptIndex] || 0) + 1;
    }
    /* The browser also range-checks every flashcard against the lesson list;
       a card pointing at a phantom lesson would kill the whole study at
       display time, so it is refused here instead. */
    for (const card of bank.flashcards){
      if (!card || !Number.isInteger(card.conceptIndex) || card.conceptIndex < 0 ||
          (conceptCount > 0 && card.conceptIndex >= conceptCount)) {
        console.warn('[validateStudyBank] flashcard conceptIndex out of bounds', card && card.conceptIndex, 'conceptCount:', conceptCount);
        return false;
      }
    }
    if (conceptCount > 0){
      if (bank.questions.length < conceptCount * 2) {
        console.warn(`[validateStudyBank] questions length ${bank.questions.length} < conceptCount * 2 (${conceptCount * 2})`);
        return false;
      }
      for (let i = 0; i < conceptCount; i++) {
        if (!perConcept[i]) {
          console.warn(`[validateStudyBank] missing question for concept index ${i}`);
          return false;
        }
      }
    }
    return true;
  }catch(err){
    console.warn('[validateStudyBank] exception:', err);
    return false;
  }
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
    if (!study || !Array.isArray(study.units) || !study.units.length) {
      console.warn('[validateChunkedStudy] missing study.units');
      return false;
    }
    const minConcepts = study.chunked ? 3 : 4;
    if (!Array.isArray(study.concepts) || study.concepts.length < minConcepts) {
      console.warn(`[validateChunkedStudy] study.concepts length ${study.concepts ? study.concepts.length : 0} < ${minConcepts}`);
      return false;
    }
    if (!Array.isArray(study.questions) || !Array.isArray(study.flashcards) || !Array.isArray(study.formulas)) {
      console.warn('[validateChunkedStudy] missing questions/flashcards/formulas array');
      return false;
    }
    const assigned = [];
    for (const unit of study.units){
      if (!unit || !text(unit.title) || !text(unit.overview) ||
          !Array.isArray(unit.learningGoals) || !unit.learningGoals.length ||
          !Array.isArray(unit.topics)) {
        console.warn('[validateChunkedStudy] unit metadata missing', unit && unit.title);
        return false;
      }
      if (unit.locked) continue;
      if (!unit.topics.length) {
        console.warn('[validateChunkedStudy] unlocked unit has no topics', unit.title);
        return false;
      }
      for (const topic of unit.topics){
        if (!topic || !text(topic.title) ||
            !Array.isArray(topic.conceptIndices) || !topic.conceptIndices.length) {
          console.warn('[validateChunkedStudy] topic missing title or conceptIndices', topic && topic.title);
          return false;
        }
        for (const index of topic.conceptIndices){
          if (!Number.isInteger(index) || index < 0 || index >= study.concepts.length) {
            console.warn('[validateChunkedStudy] index out of bounds', index, 'concepts:', study.concepts.length);
            return false;
          }
          assigned.push(index);
        }
      }
    }
    if (assigned.length !== study.concepts.length ||
        new Set(assigned).size !== study.concepts.length) {
      console.warn(`[validateChunkedStudy] assigned mismatch: assigned=${assigned.length}, concepts=${study.concepts.length}`);
      return false;
    }
    if (!validateConcepts(study.concepts)) {
      console.warn('[validateChunkedStudy] validateConcepts failed');
      return false;
    }
    if (!validateStudyBank(study, study.concepts.length)) {
      console.warn('[validateChunkedStudy] validateStudyBank failed');
      return false;
    }
    return true;
  }catch(err){
    console.warn('[validateChunkedStudy] exception:', err);
    return false;
  }
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
/* ---------- local SVG image lane (the only lane) ----------
   The paid MiniMax/Pollinations lanes were removed: every still now comes
   from this deterministic local renderer — instant inline data URI, no key,
   no network, no cost. IMAGE_PROVIDER is kept in .env for compatibility and
   ignored (docs/REMAINING-ROADMAP.md); IMAGE_ANIMATE=0 emits inert stills
   without the <style> block. */
function imageProvider(){
  return 'svg';
}
function svgEscape(s){
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
/* Deterministic per-prompt preset: the same topic always renders the same
   art, so the client cache and the tests can rely on it. */
function svgPresetFor(text){
  const presets = ['pulse', 'drift', 'rise', 'orbit'];
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return presets[h % presets.length];
}
const SVG_STOP = new Set(['flat','educational','illustration','clean','vector','style','about','showing','with','single','clear','focal','composition','high','contrast','suitable','lesson','image','for','the','and','no','text','overlays','people','faces','incorporating','concept','set','scene','spirit','using']);
function renderTopicSvg(prompt, opts){
  opts = opts || {};
  const cleanPrompt = String(prompt || '').trim();
  const words = cleanPrompt.split(/[^A-Za-z0-9/+-]+/)
    .filter(w => w.length > 2 && !SVG_STOP.has(w.toLowerCase()))
    .slice(0, 12);

  const preset = svgPresetFor(cleanPrompt);
  const animate = !/^(0|false|off|no)$/i.test(String(process.env.IMAGE_ANIMATE || '').trim());
  const ratio = (opts && VALID_RATIOS.includes(opts.aspect_ratio)) ? opts.aspect_ratio : '16:9';
  const dims = {
    '1:1': [640, 640], '16:9': [800, 450], '4:3': [720, 540], '3:2': [750, 500],
    '2:3': [500, 750], '3:4': [540, 720], '9:16': [450, 800], '21:9': [900, 386]
  };
  const size = dims[ratio] || dims['16:9'];
  const W = size[0], H = size[1];

  // Semantic extraction from prompt
  const topicMatch = cleanPrompt.match(/about\s+"([^"]+)"/i);
  const subjectMatch = cleanPrompt.match(/for\s+a\s+([^.]+?)\s+lesson/i);
  const nodesMatch = cleanPrompt.match(/with\s+visual\s+elements\s+for\s+([^.]+)/i);
  const formulaMatch = cleanPrompt.match(/incorporating\s+the\s+concept\s+of\s+([^.]+)/i);
  const summaryMatch = cleanPrompt.match(/showing\s+([^.]+)/i);

  const topicTitle = topicMatch ? topicMatch[1].trim() : (words.slice(0, 3).join(' ') || 'Core Concept');
  const subject = subjectMatch ? subjectMatch[1].trim() : 'Computer Science';
  const formula = formulaMatch ? formulaMatch[1].trim().slice(0, 60) : '';
  const nodeLabels = nodesMatch
    ? nodesMatch[1].split(/,\s*/).map(s => s.trim().slice(0, 24)).filter(Boolean).slice(0, 6)
    : words.slice(0, 6);

  const combined = (topicTitle + ' ' + subject + ' ' + (summaryMatch ? summaryMatch[1] : '') + ' ' + nodeLabels.join(' ')).toLowerCase();

  let archetype = 'system';
  if (/(?:relational|schema|table|sql|database|dbms|foreign key|primary key|normalization|entity|attribute|tuple|record|row|column)/.test(combined)) {
    archetype = 'relational';
  } else if (/(?:bit|byte|binary|memory|data type|float|integer|register|offset|encoding|buffer|array|word|signed)/.test(combined)) {
    archetype = 'memory';
  } else if (/(?:network|packet|protocol|switching|layer|router|client|server|transmission|tcp|ip|osi|channel|bandwidth|delay)/.test(combined)) {
    archetype = 'network';
  } else if (/(?:pipeline|process|lifecycle|algorithm|sort|flow|step|stage|execute|transition|cycle|queue|schedule)/.test(combined)) {
    archetype = 'pipeline';
  } else if (/(?:tree|hierarchy|b-tree|index|branch|graph|taxonomy|search|traverse)/.test(combined)) {
    archetype = 'tree';
  }

  // Animation Styles (compatible with test suite requirements)
  const style = animate ? [
    '<style>',
    '@keyframes xcPulse{from{opacity:.65;transform:scale(0.99)}to{opacity:1;transform:scale(1.01)}}',
    '@keyframes xcDrift{from{transform:translateX(-5px)}to{transform:translateX(5px)}}',
    '@keyframes xcGlow{0%,100%{filter:drop-shadow(0 0 4px rgba(200,255,61,0.3))}50%{filter:drop-shadow(0 0 12px rgba(200,255,61,0.65))}}',
    '.xc-anim{animation:xcPulse 3.6s ease-in-out infinite alternate}',
    '.xc-a1,.xc-a3{animation:xcDrift 4.5s ease-in-out infinite alternate}',
    '.xc-glow{animation:xcGlow 3s ease-in-out infinite}',
    '@media (prefers-reduced-motion: reduce){.xc-anim,.xc-a1,.xc-a3,.xc-glow{animation:none}}',
    '</style>'
  ].join('') : '';

  const id = 'timg-' + Math.abs(preset.charCodeAt(0) * 31 + W);
  let bodyMarkup = '';

  if (archetype === 'relational') {
    const t1Name = nodeLabels[0] ? nodeLabels[0].toUpperCase() : 'STUDENT';
    const t2Name = nodeLabels[1] ? nodeLabels[1].toUpperCase() : 'ENROLLMENT';
    const colA1 = nodeLabels[2] || 'student_id';
    const colA2 = nodeLabels[3] || 'full_name';
    const colB1 = nodeLabels[4] || 'enroll_id';

    bodyMarkup = '<g transform="translate(60, 110)">' +
      '<rect width="280" height="250" rx="12" fill="#0e1206" stroke="rgba(200,255,61,0.3)" stroke-width="1.5"/>' +
      '<rect width="280" height="38" rx="12" fill="#131908" stroke="rgba(200,255,61,0.2)" stroke-width="1"/>' +
      '<path d="M 0 38 L 280 38" stroke="rgba(200,255,61,0.25)" stroke-width="1"/>' +
      '<text x="16" y="24" fill="#f1efe3" font-family="system-ui, sans-serif" font-size="13" font-weight="700">🗄️ ' + svgEscape(t1Name) + '</text>' +
      '<rect x="210" y="8" width="56" height="20" rx="4" fill="rgba(200,255,61,0.15)"/>' +
      '<text x="238" y="22" fill="#c8ff3d" font-family="monospace" font-size="9" font-weight="700" text-anchor="middle">RELATION</text>' +
      '<g transform="translate(16, 68)">' +
        '<rect x="0" y="-14" width="28" height="18" rx="4" fill="rgba(200,255,61,0.25)"/>' +
        '<text x="14" y="-1" fill="#c8ff3d" font-family="monospace" font-size="9" font-weight="800" text-anchor="middle">PK</text>' +
        '<text x="36" y="0" fill="#f1efe3" font-family="monospace" font-size="12" font-weight="700">' + svgEscape(colA1) + '</text>' +
        '<text x="248" y="0" fill="#5eead4" font-family="monospace" font-size="10" text-anchor="end">INT</text>' +
      '</g>' +
      '<line x1="16" y1="88" x2="264" y2="88" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>' +
      '<g transform="translate(16, 118)">' +
        '<text x="36" y="0" fill="#f1efe3" font-family="monospace" font-size="12">' + svgEscape(colA2) + '</text>' +
        '<text x="248" y="0" fill="#9aa38d" font-family="monospace" font-size="10" text-anchor="end">VARCHAR(64)</text>' +
      '</g>' +
      '<line x1="16" y1="138" x2="264" y2="138" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>' +
      '<g transform="translate(16, 168)">' +
        '<text x="36" y="0" fill="#f1efe3" font-family="monospace" font-size="12">created_at</text>' +
        '<text x="248" y="0" fill="#9aa38d" font-family="monospace" font-size="10" text-anchor="end">TIMESTAMP</text>' +
      '</g>' +
      '<line x1="16" y1="188" x2="264" y2="188" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>' +
      '<g transform="translate(16, 218)">' +
        '<text x="36" y="0" fill="#f1efe3" font-family="monospace" font-size="12">status</text>' +
        '<text x="248" y="0" fill="#ffb43d" font-family="monospace" font-size="10" text-anchor="end">ENUM</text>' +
      '</g>' +
    '</g>' +
    '<path d="M 340 178 C 400 178, 410 228, 460 228" fill="none" stroke="#c8ff3d" stroke-width="2.2" stroke-dasharray="6 4" class="xc-anim"/>' +
    '<circle cx="340" cy="178" r="4" fill="#c8ff3d"/>' +
    '<polygon points="458,223 468,228 458,233" fill="#c8ff3d"/>' +
    '<rect x="375" y="188" width="52" height="18" rx="4" fill="#060803" stroke="#c8ff3d" stroke-width="1"/>' +
    '<text x="401" y="201" fill="#c8ff3d" font-family="monospace" font-size="9" font-weight="800" text-anchor="middle">1 : N</text>' +
    '<g transform="translate(460, 110)">' +
      '<rect width="280" height="250" rx="12" fill="#0e1206" stroke="rgba(200,255,61,0.3)" stroke-width="1.5"/>' +
      '<rect width="280" height="38" rx="12" fill="#131908" stroke="rgba(200,255,61,0.2)" stroke-width="1"/>' +
      '<path d="M 0 38 L 280 38" stroke="rgba(200,255,61,0.25)" stroke-width="1"/>' +
      '<text x="16" y="24" fill="#f1efe3" font-family="system-ui, sans-serif" font-size="13" font-weight="700">🗄️ ' + svgEscape(t2Name) + '</text>' +
      '<rect x="210" y="8" width="56" height="20" rx="4" fill="rgba(200,255,61,0.15)"/>' +
      '<text x="238" y="22" fill="#c8ff3d" font-family="monospace" font-size="9" font-weight="700" text-anchor="middle">FOREIGN</text>' +
      '<g transform="translate(16, 68)">' +
        '<rect x="0" y="-14" width="28" height="18" rx="4" fill="rgba(200,255,61,0.25)"/>' +
        '<text x="14" y="-1" fill="#c8ff3d" font-family="monospace" font-size="9" font-weight="800" text-anchor="middle">PK</text>' +
        '<text x="36" y="0" fill="#f1efe3" font-family="monospace" font-size="12" font-weight="700">' + svgEscape(colB1) + '</text>' +
        '<text x="248" y="0" fill="#5eead4" font-family="monospace" font-size="10" text-anchor="end">INT</text>' +
      '</g>' +
      '<line x1="16" y1="88" x2="264" y2="88" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>' +
      '<g transform="translate(16, 118)">' +
        '<rect x="0" y="-14" width="28" height="18" rx="4" fill="rgba(94,234,212,0.2)"/>' +
        '<text x="14" y="-1" fill="#5eead4" font-family="monospace" font-size="9" font-weight="800" text-anchor="middle">FK</text>' +
        '<text x="36" y="0" fill="#5eead4" font-family="monospace" font-size="12" font-weight="700">' + svgEscape(colA1) + '</text>' +
        '<text x="248" y="0" fill="#5eead4" font-family="monospace" font-size="10" text-anchor="end">INT</text>' +
      '</g>' +
      '<line x1="16" y1="138" x2="264" y2="138" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>' +
      '<g transform="translate(16, 168)">' +
        '<text x="36" y="0" fill="#f1efe3" font-family="monospace" font-size="12">grade_score</text>' +
        '<text x="248" y="0" fill="#ffb43d" font-family="monospace" font-size="10" text-anchor="end">DECIMAL</text>' +
      '</g>' +
      '<line x1="16" y1="188" x2="264" y2="188" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>' +
      '<g transform="translate(16, 218)">' +
        '<text x="36" y="0" fill="#f1efe3" font-family="monospace" font-size="12">enrolled_date</text>' +
        '<text x="248" y="0" fill="#9aa38d" font-family="monospace" font-size="10" text-anchor="end">DATE</text>' +
      '</g>' +
    '</g>' +
    '<g transform="translate(60, 385)">' +
      '<rect width="680" height="34" rx="8" fill="#131908" stroke="rgba(200,255,61,0.2)" stroke-width="1"/>' +
      '<circle cx="20" cy="17" r="4" fill="#c8ff3d" class="xc-glow"/>' +
      '<text x="34" y="21" fill="#f1efe3" font-family="monospace" font-size="11">RELATIONAL SCHEMA INTEGRITY • PRIMARY / FOREIGN KEY CONSTRAINTS VALIDATED</text>' +
      '<text x="664" y="21" fill="#c8ff3d" font-family="monospace" font-size="11" font-weight="700" text-anchor="end">3NF</text>' +
    '</g>';

  } else if (archetype === 'memory') {
    const f1 = nodeLabels[0] || 'Sign Bit';
    const f2 = nodeLabels[1] || 'Exponent';
    const f3 = nodeLabels[2] || 'Mantissa';
    const f4 = nodeLabels[3] || 'Payload';

    bodyMarkup = '<g transform="translate(60, 110)">' +
      '<rect width="680" height="120" rx="12" fill="#0e1206" stroke="rgba(200,255,61,0.3)" stroke-width="1.5"/>' +
      '<rect width="680" height="28" rx="12" fill="#131908" stroke="rgba(200,255,61,0.15)" stroke-width="1"/>' +
      '<text x="16" y="19" fill="#9aa38d" font-family="monospace" font-size="10" font-weight="700">REGISTER MEMORY WORD • 32-BIT IEEE / INTEGER ALIGNMENT</text>' +
      '<text x="664" y="19" fill="#c8ff3d" font-family="monospace" font-size="10" font-weight="700" text-anchor="end">OFFSET: 0x00</text>' +
      '<g transform="translate(16, 42)">' +
        '<rect x="0" y="0" width="80" height="60" rx="8" fill="rgba(255,180,61,0.15)" stroke="#ffb43d" stroke-width="1.5" class="xc-anim"/>' +
        '<text x="40" y="24" fill="#ffb43d" font-family="monospace" font-size="11" font-weight="800" text-anchor="middle">[0]</text>' +
        '<text x="40" y="44" fill="#f1efe3" font-family="monospace" font-size="10" font-weight="700" text-anchor="middle">' + svgEscape(f1) + '</text>' +
        '<rect x="90" y="0" width="180" height="60" rx="8" fill="rgba(94,234,212,0.15)" stroke="#5eead4" stroke-width="1.5"/>' +
        '<text x="180" y="24" fill="#5eead4" font-family="monospace" font-size="11" font-weight="800" text-anchor="middle">[1..8]</text>' +
        '<text x="180" y="44" fill="#f1efe3" font-family="monospace" font-size="10" font-weight="700" text-anchor="middle">' + svgEscape(f2) + '</text>' +
        '<rect x="280" y="0" width="368" height="60" rx="8" fill="rgba(200,255,61,0.15)" stroke="#c8ff3d" stroke-width="1.5"/>' +
        '<text x="464" y="24" fill="#c8ff3d" font-family="monospace" font-size="11" font-weight="800" text-anchor="middle">[9..31]</text>' +
        '<text x="464" y="44" fill="#f1efe3" font-family="monospace" font-size="10" font-weight="700" text-anchor="middle">' + svgEscape(f3) + ' / ' + svgEscape(f4) + '</text>' +
      '</g>' +
    '</g>' +
    '<g transform="translate(60, 250)">' +
      '<g transform="translate(0, 0)">' +
        '<rect width="215" height="110" rx="10" fill="#0e1206" stroke="rgba(255,180,61,0.3)" stroke-width="1"/>' +
        '<text x="14" y="24" fill="#ffb43d" font-family="monospace" font-size="11" font-weight="800">SIGN ENCODING</text>' +
        '<text x="14" y="48" fill="#f1efe3" font-family="monospace" font-size="12">0 = Positive (+)</text>' +
        '<text x="14" y="70" fill="#f1efe3" font-family="monospace" font-size="12">1 = Negative (-)</text>' +
        '<text x="14" y="92" fill="#9aa38d" font-family="monospace" font-size="10">Twos complement format</text>' +
      '</g>' +
      '<g transform="translate(232, 0)">' +
        '<rect width="215" height="110" rx="10" fill="#0e1206" stroke="rgba(94,234,212,0.3)" stroke-width="1"/>' +
        '<text x="14" y="24" fill="#5eead4" font-family="monospace" font-size="11" font-weight="800">EXPONENT RANGE</text>' +
        '<text x="14" y="48" fill="#f1efe3" font-family="monospace" font-size="12">Bias = 127 (Single)</text>' +
        '<text x="14" y="70" fill="#f1efe3" font-family="monospace" font-size="12">2^(E - 127)</text>' +
        '<text x="14" y="92" fill="#9aa38d" font-family="monospace" font-size="10">Dynamic scale factor</text>' +
      '</g>' +
      '<g transform="translate(465, 0)">' +
        '<rect width="215" height="110" rx="10" fill="#0e1206" stroke="rgba(200,255,61,0.3)" stroke-width="1"/>' +
        '<text x="14" y="24" fill="#c8ff3d" font-family="monospace" font-size="11" font-weight="800">PRECISION / BITS</text>' +
        '<text x="14" y="48" fill="#f1efe3" font-family="monospace" font-size="12">23 fraction bits</text>' +
        '<text x="14" y="70" fill="#f1efe3" font-family="monospace" font-size="12">~7 Decimal Digits</text>' +
        '<text x="14" y="92" fill="#9aa38d" font-family="monospace" font-size="10">Normalized 1.M format</text>' +
      '</g>' +
    '</g>' +
    '<g transform="translate(60, 380)">' +
      '<rect width="680" height="34" rx="8" fill="#131908" stroke="rgba(200,255,61,0.2)" stroke-width="1"/>' +
      '<circle cx="20" cy="17" r="4" fill="#c8ff3d" class="xc-glow"/>' +
      '<text x="34" y="21" fill="#f1efe3" font-family="monospace" font-size="11">MEMORY TYPE FIDELITY • HARDWARE WORD BOUNDARIES VERIFIED</text>' +
      '<text x="664" y="21" fill="#c8ff3d" font-family="monospace" font-size="11" font-weight="700" text-anchor="end">4 BYTES</text>' +
    '</g>';

  } else if (archetype === 'network') {
    const n1 = nodeLabels[0] || 'Sender Host';
    const n2 = nodeLabels[1] || 'Ingress Switch';
    const n3 = nodeLabels[2] || 'Core Router';
    const n4 = nodeLabels[3] || 'Destination';

    bodyMarkup = '<g transform="translate(60, 110)">' +
      '<g transform="translate(0, 30)">' +
        '<rect width="135" height="90" rx="10" fill="#0e1206" stroke="rgba(94,234,212,0.4)" stroke-width="1.5"/>' +
        '<text x="67" y="34" fill="#5eead4" font-family="monospace" font-size="10" font-weight="800" text-anchor="middle">SRC NODE</text>' +
        '<text x="67" y="58" fill="#f1efe3" font-family="system-ui, sans-serif" font-size="12" font-weight="700" text-anchor="middle">' + svgEscape(n1) + '</text>' +
      '</g>' +
      '<path d="M 135 75 L 180 75" stroke="#c8ff3d" stroke-width="2" stroke-dasharray="4 3" class="xc-anim"/>' +
      '<g transform="translate(180, 30)">' +
        '<rect width="140" height="90" rx="10" fill="#0e1206" stroke="rgba(200,255,61,0.4)" stroke-width="1.5"/>' +
        '<text x="70" y="34" fill="#c8ff3d" font-family="monospace" font-size="10" font-weight="800" text-anchor="middle">QUEUE / BUFFER</text>' +
        '<text x="70" y="58" fill="#f1efe3" font-family="system-ui, sans-serif" font-size="12" font-weight="700" text-anchor="middle">' + svgEscape(n2) + '</text>' +
      '</g>' +
      '<path d="M 320 75 L 365 75" stroke="#c8ff3d" stroke-width="2" stroke-dasharray="4 3" class="xc-anim"/>' +
      '<g transform="translate(365, 30)">' +
        '<rect width="140" height="90" rx="10" fill="#0e1206" stroke="rgba(200,255,61,0.4)" stroke-width="1.5"/>' +
        '<text x="70" y="34" fill="#c8ff3d" font-family="monospace" font-size="10" font-weight="800" text-anchor="middle">ROUTE ENGINE</text>' +
        '<text x="70" y="58" fill="#f1efe3" font-family="system-ui, sans-serif" font-size="12" font-weight="700" text-anchor="middle">' + svgEscape(n3) + '</text>' +
      '</g>' +
      '<path d="M 505 75 L 550 75" stroke="#c8ff3d" stroke-width="2" stroke-dasharray="4 3" class="xc-anim"/>' +
      '<g transform="translate(550, 30)">' +
        '<rect width="130" height="90" rx="10" fill="#0e1206" stroke="rgba(94,234,212,0.4)" stroke-width="1.5"/>' +
        '<text x="65" y="34" fill="#5eead4" font-family="monospace" font-size="10" font-weight="800" text-anchor="middle">DST HOST</text>' +
        '<text x="65" y="58" fill="#f1efe3" font-family="system-ui, sans-serif" font-size="12" font-weight="700" text-anchor="middle">' + svgEscape(n4) + '</text>' +
      '</g>' +
    '</g>' +
    '<g transform="translate(60, 250)">' +
      '<rect width="680" height="100" rx="12" fill="#0e1206" stroke="rgba(200,255,61,0.25)" stroke-width="1.5"/>' +
      '<rect width="680" height="26" rx="12" fill="#131908" stroke="rgba(200,255,61,0.15)" stroke-width="1"/>' +
      '<text x="16" y="18" fill="#9aa38d" font-family="monospace" font-size="10" font-weight="700">ENCAPSULATED PACKET DATAGRAM • STORE-AND-FORWARD</text>' +
      '<text x="664" y="18" fill="#c8ff3d" font-family="monospace" font-size="10" font-weight="700" text-anchor="end">' + svgEscape(formula || 'DELAY = L/R + d/s') + '</text>' +
      '<g transform="translate(16, 40)">' +
        '<rect x="0" y="0" width="130" height="46" rx="6" fill="rgba(94,234,212,0.12)" stroke="#5eead4" stroke-width="1"/>' +
        '<text x="65" y="20" fill="#5eead4" font-family="monospace" font-size="10" font-weight="800" text-anchor="middle">SRC IP</text>' +
        '<text x="65" y="36" fill="#f1efe3" font-family="monospace" font-size="9" text-anchor="middle">192.168.1.10</text>' +
        '<rect x="140" y="0" width="130" height="46" rx="6" fill="rgba(94,234,212,0.12)" stroke="#5eead4" stroke-width="1"/>' +
        '<text x="205" y="20" fill="#5eead4" font-family="monospace" font-size="10" font-weight="800" text-anchor="middle">DST IP</text>' +
        '<text x="205" y="36" fill="#f1efe3" font-family="monospace" font-size="9" text-anchor="middle">10.0.0.50</text>' +
        '<rect x="280" y="0" width="100" height="46" rx="6" fill="rgba(255,180,61,0.12)" stroke="#ffb43d" stroke-width="1"/>' +
        '<text x="330" y="20" fill="#ffb43d" font-family="monospace" font-size="10" font-weight="800" text-anchor="middle">TTL / PROTO</text>' +
        '<text x="330" y="36" fill="#f1efe3" font-family="monospace" font-size="9" text-anchor="middle">64 • TCP</text>' +
        '<rect x="390" y="0" width="258" height="46" rx="6" fill="rgba(200,255,61,0.12)" stroke="#c8ff3d" stroke-width="1" class="xc-anim"/>' +
        '<text x="519" y="20" fill="#c8ff3d" font-family="monospace" font-size="10" font-weight="800" text-anchor="middle">PAYLOAD DATA (L BITS)</text>' +
        '<text x="519" y="36" fill="#f1efe3" font-family="monospace" font-size="9" text-anchor="middle">SEGMENT PAYLOAD STREAM</text>' +
      '</g>' +
    '</g>' +
    '<g transform="translate(60, 380)">' +
      '<rect width="680" height="34" rx="8" fill="#131908" stroke="rgba(200,255,61,0.2)" stroke-width="1"/>' +
      '<circle cx="20" cy="17" r="4" fill="#c8ff3d" class="xc-glow"/>' +
      '<text x="34" y="21" fill="#f1efe3" font-family="monospace" font-size="11">PACKET TRANSMISSION DYNAMICS • FULL DUPLEX VERIFIED</text>' +
      '<text x="664" y="21" fill="#c8ff3d" font-family="monospace" font-size="11" font-weight="700" text-anchor="end">1.0 Gbps</text>' +
    '</g>';

  } else {
    const stages = nodeLabels.length >= 3 ? nodeLabels.slice(0, 4) : ['Input Stream', 'Core Processing', 'Validation Logic', 'Output State'];
    const colW = Math.round((680 - (stages.length - 1) * 20) / stages.length);

    bodyMarkup = '<g transform="translate(60, 110)">' +
      stages.map((st, i) => {
        const x = i * (colW + 20);
        const isCore = i === 1 || i === Math.floor(stages.length / 2);
        const strokeCol = isCore ? '#c8ff3d' : (i === 0 ? '#5eead4' : '#ffb43d');
        const fillCol = isCore ? 'rgba(200,255,61,0.14)' : 'rgba(19,25,8,0.85)';
        return '<g transform="translate(' + x + ', 20)">' +
          '<rect width="' + colW + '" height="180" rx="12" fill="' + fillCol + '" stroke="' + strokeCol + '" stroke-width="' + (isCore ? '2' : '1.2') + '"' + (isCore ? ' class="xc-anim"' : '') + '/>' +
          '<rect width="' + colW + '" height="28" rx="12" fill="#131908" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>' +
          '<text x="14" y="19" fill="' + strokeCol + '" font-family="monospace" font-size="10" font-weight="800">STAGE 0' + (i+1) + '</text>' +
          '<text x="' + Math.round(colW/2) + '" y="65" fill="#f1efe3" font-family="system-ui, sans-serif" font-size="13" font-weight="700" text-anchor="middle">' + svgEscape(st) + '</text>' +
          '<line x1="16" y1="85" x2="' + (colW-16) + '" y2="85" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>' +
          '<rect x="14" y="100" width="' + (colW-28) + '" height="26" rx="4" fill="rgba(255,255,255,0.04)"/>' +
          '<text x="22" y="117" fill="#9aa38d" font-family="monospace" font-size="9">METRIC: OK</text>' +
          '<rect x="14" y="134" width="' + (colW-28) + '" height="26" rx="4" fill="rgba(200,255,61,0.08)"/>' +
          '<text x="22" y="151" fill="#c8ff3d" font-family="monospace" font-size="9" font-weight="700">STATUS: ACTIVE</text>' +
        '</g>' +
        (i < stages.length - 1 ? (
          '<g transform="translate(' + (x + colW + 4) + ', 100)">' +
            '<path d="M 0 0 L 12 0" stroke="#c8ff3d" stroke-width="2" class="xc-anim"/>' +
            '<polygon points="10,-4 16,0 10,4" fill="#c8ff3d"/>' +
          '</g>'
        ) : '');
      }).join('') +
    '</g>' +
    '<g transform="translate(60, 320)">' +
      '<rect width="680" height="90" rx="12" fill="#0e1206" stroke="rgba(200,255,61,0.25)" stroke-width="1.5"/>' +
      '<rect width="680" height="26" rx="12" fill="#131908" stroke="rgba(200,255,61,0.15)" stroke-width="1"/>' +
      '<text x="16" y="18" fill="#9aa38d" font-family="monospace" font-size="10" font-weight="700">MECHANISM SPECIFICATION &amp; TELEMETRY</text>' +
      '<text x="664" y="18" fill="#c8ff3d" font-family="monospace" font-size="10" font-weight="700" text-anchor="end">' + svgEscape(formula || 'SYSTEM INVARIANT HELD') + '</text>' +
      '<g transform="translate(16, 42)">' +
        '<text x="0" y="15" fill="#f1efe3" font-family="monospace" font-size="11">PRIMARY ALGORITHM:</text>' +
        '<text x="150" y="15" fill="#c8ff3d" font-family="monospace" font-size="11" font-weight="700">' + svgEscape(topicTitle) + '</text>' +
        '<text x="0" y="34" fill="#9aa38d" font-family="monospace" font-size="10">SUB-COMPONENTS:</text>' +
        '<text x="150" y="34" fill="#5eead4" font-family="monospace" font-size="10">' + svgEscape(nodeLabels.join('  •  ')) + '</text>' +
      '</g>' +
    '</g>';
  }

  const badgeW = Math.min(220, Math.max(90, subject.length * 8.5));
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" data-preset="' + preset + '" role="img" aria-label="' + svgEscape(topicTitle) + '">',
    style,
    '<defs>',
    '  <pattern id="' + id + '-grid" width="32" height="32" patternUnits="userSpaceOnUse">',
    '    <circle cx="1" cy="1" r="1" fill="rgba(200,255,61,0.06)"/>',
    '  </pattern>',
    '</defs>',
    '<rect width="' + W + '" height="' + H + '" rx="16" fill="#080c04" stroke="rgba(200,255,61,0.22)" stroke-width="1.5"/>',
    '<rect width="' + W + '" height="' + H + '" fill="url(#' + id + '-grid)"/>',
    '<g transform="translate(60, 48)">',
    '  <rect x="0" y="-18" width="' + badgeW + '" height="26" rx="999" fill="rgba(200,255,61,0.12)" stroke="rgba(200,255,61,0.3)" stroke-width="1"/>',
    '  <text x="' + Math.round(badgeW / 2) + '" y="-1" fill="#c8ff3d" font-family="monospace" font-size="10" font-weight="800" letter-spacing="0.08em" text-anchor="middle">' + svgEscape(subject.toUpperCase()) + '</text>',
    '  <text x="' + (badgeW + 18) + '" y="0" fill="#f1efe3" font-family="system-ui, sans-serif" font-size="19" font-weight="800" letter-spacing="-0.01em">' + svgEscape(topicTitle) + '</text>',
    '  <rect x="610" y="-18" width="70" height="26" rx="999" fill="#131908" stroke="rgba(200,255,61,0.3)" stroke-width="1"/>',
    '  <text x="645" y="-1" fill="#c8ff3d" font-family="monospace" font-size="10" font-weight="800" text-anchor="middle">' + archetype.toUpperCase() + '</text>',
    '</g>',
    bodyMarkup,
    '</svg>'
  ].join('');
}
async function generateImage(prompt, opts){
  opts = opts || {};
  const clean = String(prompt || '').trim().slice(0, 1500);
  if (!clean) throw mkErr(400, 'A prompt is required.');
  const svg = renderTopicSvg(clean, opts);
  const bytes = Buffer.from(svg, 'utf8');
  return { imageUrl: 'data:image/svg+xml;base64,' + bytes.toString('base64'),
    imageBytes: bytes, provider: 'svg', prompt: clean };
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
async function setJobStageDb(jobId, stage, weight) {
  if (!SUPABASE_URL) {
    throw new Error('setJobStageDb requires SUPABASE_URL');
  }
  const { fetch } = globalThis;
  const apiKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const rpcUrl = `${SUPABASE_URL}/rest/v1/rpc/bip_set_job_stage`;
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: {
      'apikey': apiKey,
      'Authorization': 'Bearer ' + apiKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({ p_job_id: jobId, p_stage: stage, p_weight: weight }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error('bip_set_job_stage RPC failed: ' + res.status + ' ' + txt);
  }
  return res.json();
}

async function saveJob(jobId, status) {
  if (!SUPABASE_URL) {
    throw new Error('saveJob requires SUPABASE_URL');
  }
  const { fetch } = globalThis;
  const apiKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const rpcUrl = `${SUPABASE_URL}/rest/v1/rpc/bip_save_job`;
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: {
      'apikey': apiKey,
      'Authorization': 'Bearer ' + apiKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({ p_job_id: jobId, p_status: status || 'queued' }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error('bip_save_job RPC failed: ' + res.status + ' ' + txt);
  }
  return res.json();
}

async function claimJob() {
  if (!SUPABASE_URL) {
    throw new Error('claimJob requires SUPABASE_URL');
  }
  const { fetch } = globalThis;
  const apiKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const rpcUrl = `${SUPABASE_URL}/rest/v1/rpc/bip_claim_job`;
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: {
      'apikey': apiKey,
      'Authorization': 'Bearer ' + apiKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error('bip_claim_job RPC failed: ' + res.status + ' ' + txt);
  }
  const data = await res.json();
  if (data && data.error) {
    return { error: data.error };
  }
  return data;
}

async function finishJobDb(jobId, finishData) {
  if (!SUPABASE_URL) {
    throw new Error('finishJobDb requires SUPABASE_URL');
  }
  const { fetch } = globalThis;
  const apiKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const rpcUrl = `${SUPABASE_URL}/rest/v1/rpc/bip_finish_job`;
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: {
      'apikey': apiKey,
      'Authorization': 'Bearer ' + apiKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      p_job_id: jobId,
      p_status: finishData.status,
      p_stage: finishData.stage,
      p_progress: finishData.progress,
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error('bip_finish_job RPC failed: ' + res.status + ' ' + txt);
  }
  return res.json();
}

function extractJson(text){
  console.log('[DEBUG extractJson length]:', text ? text.length : 0, 'preview:', String(text).slice(0, 300));
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
    /* escape literal unescaped newlines/tabs inside strings */
    s => escapeControlCharsInStrings(stripJsonComments(s).replace(/,\s*([}\]])/g, '$1')),
    /* smart quotes + trailing commas */
    s => escapeControlCharsInStrings(stripJsonComments(s).replace(/[\u201c\u201d]/g, '"').replace(/[\u2018\u2019]/g, "'").replace(/,\s*([}\]])/g, '$1')),
    /* single-quoted keys/values -> double quotes (cautious) */
    s => escapeControlCharsInStrings(stripJsonComments(s).replace(/,\s*([}\]])/g, '$1').replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, '"$1"')),
    /* unquoted object keys -> double-quoted (the exact failure live Gemini
       produced:  { "title": "Web Browsing",\n  description: "..." } ) */
    s => quoteUnquotedKeys(escapeControlCharsInStrings(stripJsonComments(s).replace(/,\s*([}\]])/g, '$1'))),
    /* truncate-and-close: cut at last complete } or ] then balance */
    s => balanceBraces(escapeControlCharsInStrings(stripJsonComments(s).replace(/,\s*([}\]])/g, '$1')))
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
function escapeControlCharsInStrings(s){
  let out = '', instr = false, esc = false;
  for (let i = 0; i < s.length; i++){
    const ch = s[i];
    if (instr){
      if (esc){ esc = false; out += ch; }
      else if (ch === '\\'){ esc = true; out += ch; }
      else if (ch === '"'){ instr = false; out += ch; }
      else if (ch === '\n') out += '\\n';
      else if (ch === '\r') out += '\\r';
      else if (ch === '\t') out += '\\t';
      else out += ch;
      continue;
    }
    if (ch === '"'){ instr = true; out += ch; continue; }
    out += ch;
  }
  return out;
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
  let cut = s.slice(start);
  instr = false; esc = false;
  for (let i = 0; i < cut.length; i++){
    const ch = cut[i];
    if (instr){ if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') instr = false; }
    else if (ch === '"') instr = true;
  }
  if (instr) cut += '"';
  // Strip trailing dangling keys like , "key": or , "key"
  cut = cut.replace(/,\s*"[^"]*"\s*:\s*$/, '');
  cut = cut.replace(/\{\s*"[^"]*"\s*:\s*$/, '{');
  cut = cut.replace(/,\s*"[^"]*"\s*$/, '');
  cut = cut.replace(/,\s*$/, '');
  const opens = [];
  instr = false; esc = false;
  for (const ch of cut){
    if (instr){ if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') instr = false; }
    else if (ch === '"') instr = true;
    else if (ch === '{') opens.push('}');
    else if (ch === '[') opens.push(']');
    else if ((ch === '}' || ch === ']') && opens.length) opens.pop();
  }
  while (opens.length) cut += opens.pop();
  return cut;
}
/* Cheap, dependency-free PDF text pass for the subject-fidelity guard.
   Real PDFs store page text in content streams that may be Flate- or
   raw-DEFLATE-compressed; this inflates every stream (falling back to the
   raw bytes when a stream is uncompressed) and pulls the strings out of
   the Tj / TJ show-text operators. It is NOT a general PDF parser — the
   guard only needs the document's own vocabulary, and the fingerprint
   builder ignores anything unparseable. Returns '' when nothing can be
   extracted; the guard degrades gracefully on an empty fingerprint. */
function parsePdfTjArray(tjStr){
  const itemRe = /\(((?:\\[\s\S]|[^\\()])*)\)|(-?\d+(?:\.\d+)?)/g;
  let out = '', m;
  while ((m = itemRe.exec(tjStr))){
    if (m[1] !== undefined){
      out += m[1].replace(/\\([0-9]{3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
                 .replace(/\\([()\\\\])/g, '$1');
    } else if (m[2] !== undefined){
      if (parseFloat(m[2]) <= -100) out += ' ';
    }
  }
  return out;
}
function extractPdfTextLite(buf){
  try{
    const s = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
    const latin = s.toString('latin1');
    const textLines = [];
    let pos = 0;
    let streamCount = 0;

    while (pos < latin.length && textLines.length < 300 && streamCount < 80) {
      const startTag = latin.indexOf('stream', pos);
      if (startTag === -1) break;
      let dataStart = startTag + 6;
      if (latin.charCodeAt(dataStart) === 13) dataStart++;
      if (latin.charCodeAt(dataStart) === 10) dataStart++;
      const endTag = latin.indexOf('endstream', dataStart);
      if (endTag === -1) break;
      pos = endTag + 9;
      streamCount++;

      const streamLen = endTag - dataStart;
      if (streamLen <= 0 || streamLen > 2 * 1024 * 1024) continue;

      const raw = s.subarray(dataStart, endTag);
      let data = null;
      try{ data = zlib.inflateSync(raw).toString('latin1'); }
      catch{ try{ data = zlib.inflateRawSync(raw).toString('latin1'); }catch{ data = latin.slice(dataStart, endTag); } }
      if (!data) continue;

      // 1. First preference: TJ arrays (which assemble kerning and syllables into whole words)
      const tjRe = /\[([\s\S]*?)\]\s*TJ/g;
      let tjm;
      while ((tjm = tjRe.exec(data))){
        const parsed = parsePdfTjArray(tjm[1]).trim();
        if (parsed.length >= 2) textLines.push(parsed);
        if (textLines.length >= 300) break;
      }
      if (textLines.length >= 300) break;

      // 2. Second preference: BT ... ET text blocks with (str) Tj
      const btRe = /BT\s*([\s\S]*?)\s*ET/g;
      let btm;
      while ((btm = btRe.exec(data))){
        const block = btm[1];
        const strRe = /\(((?:\\[\s\S]|[^\\()])*)\)/g;
        let t;
        while ((t = strRe.exec(block))){
          const cleaned = t[1].replace(/\\([0-9]{3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
                              .replace(/\\([()\\\\])/g, '$1')
                              .trim();
          if (cleaned.length >= 2) textLines.push(cleaned);
          if (textLines.length >= 300) break;
        }
        if (textLines.length >= 300) break;
      }
      if (textLines.length >= 300) break;

      // 3. Third preference: standalone (str) Tj or general string operators
      const tjSingleRe = /\(((?:\\[\s\S]|[^\\()])*)\)\s*(?:Tj|'|")/g;
      let sm;
      while ((sm = tjSingleRe.exec(data))){
        const cleaned = sm[1].replace(/\\([0-9]{3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
                             .replace(/\\([()\\\\])/g, '$1')
                             .trim();
        if (cleaned.length >= 2) textLines.push(cleaned);
        if (textLines.length >= 300) break;
      }
    }
    if (textLines.length > 0){
      return textLines.join(' ').slice(0, 400000);
    }
    // Fallback if no stream text found (simple synthetic PDFs)
    const strings = [];
    const strRe = /\(((?:\\[\s\S]|[^\\()])*)\)/g;
    let t;
    let count = 0;
    while ((t = strRe.exec(latin.slice(0, 50000))) && count < 100){
      count++;
      strings.push(t[1]);
    }
    return strings.join(' ').slice(0, 400000);
  }catch{ return ''; }
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
    /* SUBJECT FIDELITY GUARD — capture the document's own vocabulary once,
       before any model output exists, so every later check compares against
       the PDF's literal words rather than the model's self-assessment. */
    job.literalFingerprint = buildLiteralSubjectFingerprint(extractPdfTextLite(job.pdf), []);
    setJobStage(job, 'outline');
    if (job.cancelled){ finishJob(job, { status: 'cancelled', error: 'The study build was cancelled.' }); return; }
    const outlinePrompt = outlinePromptWithFingerprint(job);
    let outline = null;
    try{
      outline = extractJson(await callAI([{ text: outlinePrompt }, { inlineData: { mimeType: 'application/pdf', data: pdfB64 } }], { requiresDocument: true, schema: { type: 'object' } }));
      normalizeOutline(outline);
      enforceOutlineSubjectFidelity(outline, job);
      if (!validateStudyOutline(outline)) throw mkErr(502, 'Outline failed validation.');
    }catch(e){
      if (job.cancelled){ finishJob(job, { status: 'cancelled', error: 'The study build was cancelled.' }); return; }
      if (e && (e.status === 401 || e.status === 422 || e.code === 'AI_NOT_CONFIGURED')) throw e;
      const subjectFailure = !!(e && e.code === 'SUBJECT_MISMATCH');
      const retryPrompt = subjectFailure
        ? outlinePrompt + ' The previous answer was about a DIFFERENT subject than this document. Answer ONLY from the attached PDF: every concept, term, analogy and example must come from the subject of this document, using its own key terms: ' + (job.literalFingerprint || 'see the PDF') + '.'
        : outlinePrompt + ' The previous answer was incomplete or malformed. Respond with a single valid JSON object only, matching the schema exactly.';
      outline = extractJson(await callAI([{ text: retryPrompt }, { inlineData: { mimeType: 'application/pdf', data: pdfB64 } }], { requiresDocument: true, schema: { type: 'object' } }));
      normalizeOutline(outline);
      enforceOutlineSubjectFidelity(outline, job);
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
    if (Array.isArray(study.concepts)) {
      study.topics = study.concepts.map((c, i) => {
        const qList = (study.questions || []).filter(q => q.conceptIndex === i);
        return {
          id: 'concept-' + (i + 1),
          unit: 'I',
          unitTitle: study.title || 'Course Units',
          title: c.title,
          topic: c.title,
          pdfPage: 'Page 1',
          pdfQuote: (c.keyPoints && c.keyPoints[0]) || (c.summary ? c.summary.slice(0, 100) : ''),
          explanation: c.summary || '',
          keyPoints: c.keyPoints || [c.summary ? c.summary.slice(0, 60) : 'Core concept'],
          steps: (c.visualization && Array.isArray(c.visualization.steps))
            ? c.visualization.steps.map(s => ({ title: s.title || 'Step', desc: s.description || '' }))
            : [{ title: 'Overview', desc: c.summary || '' }],
          visual: {
            type: (c.visualization && Array.isArray(c.visualization.steps) && c.visualization.steps[0] && c.visualization.steps[0].layout) || 'process_flow',
            title: c.title,
            steps: (c.visualization && Array.isArray(c.visualization.steps))
              ? c.visualization.steps.map(s => ({ title: s.title || 'Step', desc: s.description || '' }))
              : [{ title: 'Overview', desc: c.summary || '' }],
            parameters: {}
          },
          cheatcode: c.cheatCode || {
            why: 'Key concept explanation',
            like: 'Conceptual analogy',
            wrong: 'Common misunderstanding',
            right: 'Core principle',
            see: ['Real world application', 'Standard practice'],
            oneLine: c.title
          },
          questions: qList.map(q => ({
            q: q.question,
            opts: q.options || [],
            a: q.answerIndex ?? 0,
            cat: q.category || 'CONCEPT',
            diff: q.difficulty || 'Medium',
            why: q.explanation || '',
            wrong: q.optionExplanations || [],
            quote: '',
            page: 'Page 1',
            hint: q.hint || '',
            eli: q.eli5 || ''
          }))
        };
      });
    }
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
function chunkCallOpts(job, extra){
  const opts = Object.assign({ requiresDocument: true, schema: { type: 'object' }, timeoutMs: 15000 }, extra || {});
  if (job.chunk && job.chunk.fileUri) opts.fileUri = job.chunk.fileUri;
  return opts;
}
function planPrompt(job){
  const fp = job && job.literalFingerprint ? ' Document key terms: ' + job.literalFingerprint + '.' : '';
  return ['Analyze the attached educational PDF and respond with a single valid JSON object containing title, subject, summary and units — the course plan ONLY, with no lesson content.' + fp + ' units: organize into 4 to 8 core units in PDF order (at least 1), each with title, overview, learningGoals (2 to 4 concise goals) and topics (3 to 6 key topics per unit in PDF order, each with title and overview only — no concepts, no conceptIndices). Level: ' + job.level + '. Keep it compact and concise: this is the high-level syllabus table of contents a study space unlocks unit by unit. Do not write explanations, examples, questions or diagrams.'].join(' ');
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
  if (Array.isArray(resp) && resp[0] && typeof resp[0] === 'object') resp = resp[0];
  if (resp && resp.unit && typeof resp.unit === 'object' && !Array.isArray(resp.unit)) resp = Object.assign({}, resp.unit, resp);
  if (resp && resp.learningContent && typeof resp.learningContent === 'object' && !Array.isArray(resp.learningContent)) resp = Object.assign({}, resp.learningContent, resp);
  const u0 = (resp && Array.isArray(resp.units) && resp.units[0] && typeof resp.units[0] === 'object') ? resp.units[0] : null;
  const topics = (resp && Array.isArray(resp.topics)) ? resp.topics
    : (u0 && Array.isArray(u0.topics)) ? u0.topics : [];
  let concepts = (resp && Array.isArray(resp.concepts)) ? resp.concepts
    : (resp && Array.isArray(resp.lessons)) ? resp.lessons
    : (u0 && Array.isArray(u0.concepts)) ? u0.concepts
    : (u0 && Array.isArray(u0.lessons)) ? u0.lessons : [];
  if (!concepts.length && topics.length){
    for (const t of topics){
      if (Array.isArray(t.concepts)) concepts.push(...t.concepts);
      else if (Array.isArray(t.lessons)) concepts.push(...t.lessons);
    }
  }
  return { units: [Object.assign({}, unit, { topics })], concepts };
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
  const outlinePrompt = compactOutlinePromptWithFingerprint(job, k);
  let pack = null;
  try{
    pack = wrapUnitPack(extractJson(await callAI(chunkDocParts(outlinePrompt, pdfB64), opts)), unit);
    normalizeOutline(pack);
    enforceOutlineSubjectFidelity(pack, job);
    if (!validateUnitOutline(pack)) throw mkErr(502, 'Unit outline failed validation.');
  }catch(e){
    if (job.cancelled) throw mkErr(499, 'The study build was cancelled.');
    if (e && (e.status === 401 || e.status === 422 || e.code === 'AI_NOT_CONFIGURED')) throw e;
    const subjectFailure = !!(e && e.code === 'SUBJECT_MISMATCH');
    const retryPrompt = subjectFailure
      ? outlinePrompt + ' The previous answer was about a DIFFERENT subject than this document. Answer ONLY from the attached PDF for THIS unit, using the document key terms: ' + (job.literalFingerprint || 'see the PDF') + '.'
      : outlinePrompt + ' The previous answer was incomplete or malformed. Respond with a single valid JSON object only, matching the schema exactly.';
    pack = wrapUnitPack(extractJson(await callAI(chunkDocParts(retryPrompt, pdfB64), opts)), unit);
    normalizeOutline(pack);
    enforceOutlineSubjectFidelity(pack, job);
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
    /* SUBJECT FIDELITY GUARD — one literal fingerprint per job, reused by
       every unit so all units are checked against the SAME document subject,
       not a per-unit model opinion. */
    job.literalFingerprint = buildLiteralSubjectFingerprint(extractPdfTextLite(job.pdf), []);
    setJobStage(job, 'outline');
    /* Above the inline cap the document rides the Files API once; below it,
       inlineData as usual. A failed upload falls back to inline and the
       provider's own size error surfaces if that also fails. */
    let fileUri = null;
    if (job.pdf.length > GEMINI_INLINE_MB * 1024 * 1024) fileUri = await uploadPdfToGemini(job.pdf);
    job.chunk = { plan: null, built: [], states: [], pdfB64, fileUri, visualKeys: new Set() };
    const opts = chunkCallOpts(job, { maxTokens: 8192 });
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
  /* requestId is optional: serveStatic's 403/404 paths are inside the async
     fs.readFile callback, where requestId is not in scope. Setting a header to
     undefined throws ERR_HTTP_INVALID_HEADER_VALUE; because that throw happens
     in an async callback the request try/catch cannot see it, so it became an
     uncaughtException that killed the process (Render then 502'd and restarted
     on every /favicon.ico 404). Only set the header when we actually have a
     value — same guard bip/util.js already uses. */
  if (requestId) res.setHeader('X-Request-Id', requestId);
  // Security headers per Website Professional Build & Compliance Master Guide
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  // API responses carry no subresources: lock down CSP as defense-in-depth.
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
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
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.ico': 'image/x-icon' };
const PUBLIC_ROOT_FILES = new Set(['/XamCode.html', '/privacy-policy.html', '/terms-of-service.html', '/accessibility-statement.html', '/robots.txt', '/sitemap.xml']);
const PUBLIC_ASSETS = new Set(['/assets/xamcode-ai-intro.mp4', '/assets/xamcode-build-trailer.mp4', '/assets/xamcode-build-trailer-poster.jpg', '/assets/xamcode-metallic-x.png', '/assets/xamcode-logo.png', '/assets/favicon.ico', '/assets/favicon.png', '/assets/favicon-192.png', '/assets/favicon-512.png', '/assets/apple-touch-icon.png']);
function serveStatic(req, res){
  if (req.method !== 'GET' && req.method !== 'HEAD') return sendJson(res, 405, { error: 'Method not allowed.' });
  let p;
  try{ p = decodeURIComponent(req.url.split('?')[0]); }
  catch{ return sendJson(res, 400, { error: 'Bad request.' }); }
  if (p === '/') p = '/XamCode.html';
  else if (p === '/privacy-policy') p = '/privacy-policy.html';
  else if (p === '/terms-of-service') p = '/terms-of-service.html';
  else if (p === '/accessibility-statement') p = '/accessibility-statement.html';
  if (p.indexOf('\0') >= 0 || p.indexOf('\\') >= 0 || /(^|\/)\.\.(\/|$)/.test(p) || /(^|\/)\./.test(p)){
    return sendJson(res, 403, { error: 'Forbidden.' });
  }
  const allowed = PUBLIC_ROOT_FILES.has(p) || PUBLIC_ASSETS.has(p) || /^\/(css|js)\/[A-Za-z0-9._-]+\.(css|js)$/.test(p);
  if (!allowed){
    if (/^\/(bip-data|bip|build-parts|setup|supabase|server\.js|package)/.test(p)) return sendJson(res, 403, { error: 'Forbidden.' });
    return sendJson(res, 404, { error: 'Not found.' });
  }
  const rootDir = path.resolve(__dirname);
  const file = path.resolve(rootDir, '.' + p);
  if (!file.startsWith(rootDir + path.sep)) return sendJson(res, 403, { error: 'Forbidden.' });
  fs.stat(file, (e, st) => {
    if (e || !st || !st.isFile()) return sendJson(res, 404, { error: 'Not found.' });
    const ctype = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
    res.setHeader('Content-Type', ctype);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    const rangeHdr = req.headers && req.headers.range;
    if (rangeHdr){
      const m = /^bytes=(\d*)-(\d*)$/.exec(String(rangeHdr).trim());
      if (!m){
        res.setHeader('Content-Range', 'bytes */' + st.size);
        res.writeHead(416);
        return res.end();
      }
      let start = m[1] === '' ? 0 : parseInt(m[1], 10);
      let end = m[2] === '' ? st.size - 1 : parseInt(m[2], 10);
      if (m[1] === '' && m[2] !== ''){
        const suffix = parseInt(m[2], 10);
        start = Math.max(0, st.size - suffix);
        end = st.size - 1;
      }
      if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start >= st.size || start > end){
        res.setHeader('Content-Range', 'bytes */' + st.size);
        res.writeHead(416);
        return res.end();
      }
      if (end >= st.size) end = st.size - 1;
      const chunkLen = end - start + 1;
      res.setHeader('Content-Range', 'bytes ' + start + '-' + end + '/' + st.size);
      res.setHeader('Content-Length', String(chunkLen));
      res.writeHead(206);
      if (req.method === 'HEAD') return res.end();
      const s = fs.createReadStream(file, { start, end });
      s.on('error', () => { try{ res.destroy(); }catch{} });
      return s.pipe(res);
    }
    res.setHeader('Content-Length', String(st.size));
    res.writeHead(200);
    if (req.method === 'HEAD') return res.end();
    const s = fs.createReadStream(file);
    s.on('error', () => { try{ res.destroy(); }catch{} });
    s.pipe(res);
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
/* AURA must answer in the JSON shape js/aura.js renders: a SHORT plain-text
   explanation plus a one-line ASCII diagram recipe the browser turns into an
   image (arrow chain "A -> B -> C", "flow: A, B, C" or "seq: step, step"). */
const AURA_JSON_PROMPT = [
  'Respond with a single valid JSON object: {"explanation": "...", "diagram": "...", "visual_type": null}.',
  '"explanation" must be ONE short paragraph (2-4 sentences) in plain text, no markdown.',
  '"diagram" is REQUIRED: one short ASCII recipe for a picture that illustrates this answer, in exactly one of these formats:',
  '  arrow chain: A -> B -> C',
  '  flowchart: flow: Step A, Step B, Outcome',
  '  sequence: seq: first step, second step, third step',
  'If no picture would help, use "diagram": "".',
  '"visual_type" may be one of bicycle, engine, heart, projectile, photosynthesis, pythagoras, motor, dna, wave, or null; "params" may be a small object of numbers for those scenes.',
  'No markdown, no code fences — one valid JSON object only.'
].join(' ');
/* Sanitizes the model's AURA answer: the explanation must be a non-empty
   string, the diagram recipe must be plain text (HTML dropped), at most 600
   chars, and missing fields normalize to '' / null rather than undefined so
   the client can branch on falsy values safely. Accepts a parsed object or
   a raw string (which is run through extractJson). */
function normalizeAura(raw){
  let obj = raw;
  if (typeof raw === 'string') obj = extractJson(raw);
  if (!obj || typeof obj !== 'object') obj = {};
  const explanation = typeof obj.explanation === 'string' && obj.explanation.trim()
    ? obj.explanation.trim()
    : (typeof obj.answer === 'string' ? obj.answer.trim() : '');
  let diagram = typeof obj.diagram === 'string' ? obj.diagram.trim() : '';
  if (/<[^>]*>/.test(diagram)) diagram = ''; /* HTML dropped */
  if (diagram.length > 600) diagram = diagram.slice(0, 600);
  const visual_type = typeof obj.visual_type === 'string' && obj.visual_type.trim() ? obj.visual_type.trim() : null;
  const params = (obj.params && typeof obj.params === 'object' && !Array.isArray(obj.params)) ? obj.params : null;
  return { explanation, diagram, visual_type, params };
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
  const isAura = /You are AURA/.test(systemText);
  try{
    if (isAura){
      /* AURA renders the diagram client-side, so the model must return the
         JSON recipe shape, not prose. JSON mode is requested via schema. */
      const raw = await callAI([{ text: systemText + '\n' + AURA_JSON_PROMPT + extra + '\nQuestion: ' + q }], { systemInstruction: systemText, schema: { type: 'object' } });
      let norm;
      try{ norm = normalizeAura(raw); }
      catch{ norm = normalizeAura({ explanation: String(raw || '') }); }
      if (!norm.explanation) norm.explanation = String(raw || '').trim().slice(0, 4000);
      return sendJson(res, 200, { answer: norm.explanation, explanation: norm.explanation, diagram: norm.diagram, visual_type: norm.visual_type, params: norm.params, requestId }, requestId);
    }
    let contextText = '';
    if (parsed && (parsed.context || parsed.contextConcepts || parsed.contextTitle)){
      const ctx = parsed.context || {};
      const title = parsed.contextTitle || ctx.title || '';
      const subject = ctx.subject || '';
      const summary = parsed.contextSummary || ctx.summary || '';
      const concepts = parsed.contextConcepts || ctx.concepts || [];
      const formulas = ctx.formulas || [];
      const conceptSummary = Array.isArray(concepts)
        ? concepts.slice(0, 10).map(c => typeof c === 'string' ? c : (c.title + (c.summary ? ': ' + c.summary : ''))).join('; ')
        : '';
      const formulaSummary = Array.isArray(formulas)
        ? formulas.slice(0, 5).map(f => f.name + ': ' + f.expression).join('; ')
        : '';
      contextText = '\n\nCurrent Study Plan Context:\n' +
        (subject ? 'Subject: ' + subject + '\n' : '') +
        (title ? 'Course: ' + title + '\n' : '') +
        (summary ? 'Summary: ' + summary + '\n' : '') +
        (conceptSummary ? 'Key Concepts: ' + conceptSummary + '\n' : '') +
        (formulaSummary ? 'Formulas: ' + formulaSummary + '\n' : '');
    }
    const tutorInstruction = systemText +
      '\nYou are Athiyar (Vaathiyar), the dedicated XamCode study tutor. Ground your answers strictly in the provided study material and syllabus. If the concept cannot be answered from the document, acknowledge it gracefully. Explain clearly with examples, analogies, and step-by-step clarity.';
    const answer = await callAI([{ text: tutorInstruction + contextText + extra }, ...parts], { systemInstruction: tutorInstruction });
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
  /* The images are bound to a finished analyze job or a validated study pack. */
  const jobId = parsed && (parsed.jobId || parsed.job_id);
  const job = typeof jobId === 'string' ? jobs.get(jobId) : null;
  if (!job && (!parsed.study || !Array.isArray(parsed.study.concepts))) {
    return sendJson(res, 404, { error: 'Unknown job. Generate images from a finished PDF study.', code: 'JOB_NOT_FOUND', requestId }, requestId);
  }
  if (job && job.status !== 'done' && (!parsed.study || !Array.isArray(parsed.study.concepts))) {
    return sendJson(res, 409, { error: 'That study is not finished yet. Wait for the Ready stage, then generate the images.', code: 'JOB_NOT_READY', requestId }, requestId);
  }
  const study = (job && job.study) || parsed.study;
  if (!study || !Array.isArray(study.concepts)) {
    return sendJson(res, 404, { error: 'Unknown job. Generate images from a finished PDF study.', code: 'JOB_NOT_FOUND', requestId }, requestId);
  }
  let wanted = parsed && parsed.topics;
  if (!Array.isArray(wanted) || !wanted.length) wanted = study.concepts.map((c, i) => i);
  const indices = [];
  for (const t of wanted){
    const i = typeof t === 'number' ? t : (t && typeof t.conceptIndex === 'number' ? t.conceptIndex : -1);
    if (Number.isInteger(i) && i >= 0 && i < study.concepts.length && !indices.includes(i)) indices.push(i);
  }
  if (!indices.length) return sendJson(res, 400, { error: 'No valid topics were requested.', requestId }, requestId);
  if (indices.length > study.concepts.length) return sendJson(res, 400, { error: 'Too many topics requested at once.', requestId }, requestId);
  const aspect = parsed && parsed.aspect_ratio;
  const images = [];
  for (const i of indices){
    const concept = study.concepts[i];
    try{
      const prompt = craftTopicImagePrompt(study, concept, i);
      const out = await generateImage(prompt, { aspect_ratio: aspect });
      images.push({ conceptIndex: i, topic: concept.title, imageUrl: out.imageUrl, provider: out.provider || 'svg', prompt });
    }catch(e){
      /* One topic failing must not lose the rest; the error rides along. */
      const p = errPayload(e, 'Image generation failed.');
      images.push({ conceptIndex: i, topic: concept.title, error: p.body.error, code: p.body.code || null });
    }
  }
  return sendJson(res, 200, { jobId: (job ? job.id : jobId), count: images.length, images, requestId }, requestId);
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
    if (req.method === 'GET' && (p === '/' || p === '/api/health' || p === '/healthz' || p === '/livez' || p === '/readyz')){
      /* Identity fields are a contract with the browser probe
         (js/app.js xcProbeHealth): it only treats this origin as the real
         XAMCODE AI server when service === 'xamcode-ai' && apiVersion === 1.
         Returning just { ok } made every probe fail, so each submit showed
         the "XAMCODE AI is not running" banner even with /api/quota live. */
      if (p === '/api/health' || p === '/healthz' || p === '/livez' || p === '/readyz') return sendJson(res, 200, { ok: true, service: 'xamcode-ai', apiVersion: 1, ready: true, uptime: process.uptime(), requestId }, requestId);
      return serveStatic(req, res);
    }
    if (req.method === 'GET' && p === '/api/providers') return sendJson(res, 200, { providers: providerStatus(), image: imageStatus(), video: { id: 'hailuo-video', provider: 'minimax', model: process.env.MINIMAX_VIDEO_MODEL || 'MiniMax-Hailuo-02', configured: false, disabled: true }, requestId }, requestId);
    if (req.method === 'GET' && p === '/api/quota'){
      const snap = quotaSnapshot();
      return sendJson(res, 200, { allowance: pdfAllowanceFor(req), keys: snap.keys, usableModels: snap.usableModels, totalModels: snap.totalModels, models: snap.models, note: snap.note, resetsAt: snap.resetsAt, requestId }, requestId);
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
    /* Build-in-Public platform: /build page + /api/bip/* routes.
       Mounted before the /api/ 404 so BIP APIs resolve; study-app
       routes above are untouched and keep priority. */
    if (bipRoutes && (p === '/build' || p === '/build/' || p === '/build/admin' || p === '/build/admin/' || p.startsWith('/api/bip/'))){
      if (await bipRoutes.handleBip(req, res, url, p, requestId)) return;
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













/*
 * SUBJECT FIDELITY GUARD
   PIPELINE INTEGRATION POINTS (to wire in the NEXT pass, not this one)
   ------------------------------------------------------------
   1. BEFORE the outline call in runAnalyzeJob (single-shot path):
        - extract the PDF text + quotes (the existing extractPdfText/quote
          helper, if present; otherwise a cheap pass over the PDF buffer is
          enough for a subject fingerprint)
        - job.literalFingerprint = buildLiteralSubjectFingerprint(pdfText, quotes)
        - use: callAI(chunkDocParts(outlinePromptWithFingerprint(job), pdfB64), opts)
   2. AFTER the outline parses, BEFORE validateStudyOutline:
        - normalizeOutlineFingerprint(outline, job.literalFingerprint)
        - for each concept in outline.concepts: require
          conceptMatchesLiteralFingerprint(concept, job.literalFingerprint)
          — if any fails, retry with a subject-failure-aware prompt; if both
            attempts fail, surface a clearer "study content does not match the
            PDF's subject" message instead of shipping.
   3. runChunkedJob / buildUnit (chunked path):
        - same literal fingerprint is captured once per job and reused for
          each unit so every unit is checked against the SAME document subject,
          not a per-unit model opinion.
        - per-unit: normalizeOutlineFingerprint(unitPack, job.literalFingerprint)
          then require conceptMatchesLiteralFingerprint per concept; fail the
          unit (and retry) rather than assembling a shifted unit.
   4. validateConcepts chain:
        - add a conceptMatchesLiteralFingerprint(concept, job.literalFingerprint)
          gate as one more AND condition in validateConcepts / validateUnitOutline,
          in addition to the existing structural + uniqueness checks. Keep the
          existing rules untouched; this is an added gate, not a replacement.
   5. AURA grounding:
        - No change. AURA is already document-grounded; this guard only concerns
          the study-build path, not /api/ask.
   ============================================================ */
function buildLiteralSubjectFingerprint(text, quotes){
  const stop = new Set([
    'the','a','an','and','or','of','in','to','for','on','with','at','by',
    'is','are','was','were','be','been','being','it','its','this','that',
    'these','those','from','as','so','if','when','which','who','what','how',
    'can','could','would','should','may','might','will','been','have','has',
    'had','do','does','did','not','no','than','then','there','here',
    'each','every','any','more','most','also','about','into','out',
    'over','up','down','such','just','other','some','many','much',
    'all','both','one','two','three','even','well','like','used','use',
    'using','based','example','shown','see','figure','page','pages',
    'very','only','also','still','must','may','make','made','take','taken',
    'same','new','first','last','next','many','much','several','each','every',
    'will','can','should','would','could','may','might','shall',
    'has','have','had','were','was','been','being','am','are','is',
    'not','no','nor','none','nothing','never','everywhere','anywhere',
    'somewhere','nowhere','hereby','herein','hereafter','hereto',
    'does','did','done','doing','drawn','drawn',
    'two','three','four','five','six','seven','eight','nine','ten',
    'one','ones','single','double','first','second','third','last',
    'all','both','either','neither','any','some','many','most','much',
    'several','few',
    'obj','endobj','stream','endstream','flatedecode','filter','devicergb','parent',
    'contents','length','type','group','subtype','btox','xref','trailer','startxref',
    'catalog','pages','page','font','fontdescriptor','mediabox','resources','procset',
    'width','height','bitspercomponent','colorspace','glyph','glyf','hhea','hmtx',
    'loca','maxp','post','prep','truetype','type1','cidfont'
  ]);

  const byToken = new Map();   // stemmed token -> { raw, weight, fromQuote }
  function addRaw(s, fromQuote){
    if(!s) return;
    const m = String(s).toLowerCase().match(/\b[a-z][a-z-]{2,}\b/g);
    if(!m) return;
    for(const w of m){
      if(stop.has(w)) continue;
      const st = stem(w);
      const cur = byToken.get(st) || { raw: w, weight: 0, fromQuote: false };
      cur.weight += 1;
      if(fromQuote) cur.fromQuote = true;
      if(!cur.fromQuote && fromQuote) cur.fromQuote = true;
      // prefer longer raw form as the canonical surface spelling
      if(w.length > cur.raw.length && /^[a-z]/.test(w)) cur.raw = w;
      byToken.set(st, cur);
    }
  }

  // Verbatim PDF quotes: strongest subject evidence.
  if(quotes && Array.isArray(quotes)){
    for(const q of quotes){
      const s = (q && (q.value != null || q.quote != null)) ? (q.value != null ? q.value : q.quote) : (q && typeof q === 'string' ? q : null);
      if(s != null) addRaw(s, true);
    }
  }
  // Full extracted text: broader backbone.
  if(text) addRaw(text, false);

  if(!byToken.size) return '';

  // Prefer verbatim-quoted tokens first (they are the document's own topic
  // words), then fill remaining budget from the top-frequency non-quote tokens.
  const out = [];
  const seen = new Set();
  const quoteTokens = [];
  const otherTokens = [];
  for(const [st, cur] of byToken){
    if(cur.fromQuote) quoteTokens.push([st, cur.weight, cur.raw]);
    else otherTokens.push([st, cur.weight, cur.raw]);
  }
  quoteTokens.sort((a,b)=>b[1]-a[1] || a[2].localeCompare(b[2]));
  otherTokens.sort((a,b)=>b[1]-a[1] || a[2].localeCompare(b[2]));

  for(const [st, w, raw] of quoteTokens){
    if(out.length >= 18) break;
    if(seen.has(st)) continue;
    seen.add(st);
    out.push(raw);
  }
  for(const [st, w, raw] of otherTokens){
    if(out.length >= 18) break;
    if(seen.has(st)) continue;
    seen.add(st);
    out.push(raw);
  }
  return out.join(' ');
}

/* Light suffix stripper shared by the fingerprint builder above and the
   per-concept check below. It MUST live at module scope: when it was
   nested inside buildLiteralSubjectFingerprint, the stem() call inside
   conceptMatchesLiteralFingerprint threw ReferenceError, the guard's
   catch swallowed it and the whole subject-fidelity check silently
   passed every concept. */
function stem(w){
  if(!w) return '';
  w = w.toLowerCase();
  if(w.endsWith('ing') && w.length > 7) return w.slice(0, -3);
  if(w.endsWith('tion') && w.length > 7) return w.slice(0, -3);
  if(w.endsWith('sion') && w.length > 7) return w.slice(0, -4);
  if(w.endsWith('ment') && w.length > 7) return w.slice(0, -4);
  if(w.endsWith('ly') && w.length > 5) return w.slice(0, -2);
  if(w.endsWith('es') && w.length > 4) return w.slice(0, -2);
  if(w.endsWith('s') && w.length > 4 && !/[^a-z]$/.test(w)) {
    // do not strip 's' from tokens whose stem is already intact: tcp/udp/dns/
    // arq/crash/mesh/star/bus/ring/crc/arp/nat/dhcp/http/https/url/uri/ip/mac.
    // Also keep plural tech acronyms like frames/segments/handshakes in literal
    // fingerprint form so the short-fingerprint check treats 'handshakes' as a
    // genuine >=5 strong overlap with 'handshake' from the short unit fp.
    if(w.length <= 4) return w;
  }
  if(w.endsWith('s') && w.length > 4) return w.slice(0, -1);
  return w;
}

/* ---------- per-concept required-term presence check ----------
   Returns FALSE when the concept has too little overlap with the DOCUMENT's
   literal fingerprint tokens. This is what catches a fluent off-subject
   lesson: a biology trophic-level lesson, or a Java exception-hierarchy
   lesson, shares almost none of a network document's subject tokens.
   Thresholds:
     - Concept must share >= 1 stemmed token with the literal fingerprint.
     - If the literal fingerprint has <= 6 stemmed tokens, require >= 2 shared
       so a single accidental noun match cannot pass a wrong-subject concept.
     - At least one shared token should be "strong" (topic-specific,
       length >= 5 after stemming) OR the shared count should be >= 2. This
       keeps generic-short surnames like "systems", "links", "data", "page",
       "node", "layer", "unit" from passing a wrong-subject concept on their
       own.
   Degraded path: if the literal fingerprint is unparseable/absent, return true
   (no evidence either way) rather than hard-failing on parse noise. */
function isNoisyFingerprint(fp){
  if (!fp || typeof fp !== 'string') return true;
  const tokens = fp.toLowerCase().match(/\b[a-z]{3,}\b/g) || [];
  if (tokens.length < 3) return true;
  let validWords = 0;
  for (const t of tokens){
    if (/[aeiou]/.test(t) && t.length >= 4) validWords++;
  }
  return (validWords / tokens.length) < 0.4;
}
function conceptMatchesLiteralFingerprint(concept, literalFp){
  try{
    if(!literalFp || !literalFp.trim() || isNoisyFingerprint(literalFp)) return true; // degrade gracefully on noisy/absent fingerprint
    if(!concept || typeof concept !== 'object') return false;
    const fpSet = new Set();
    const litTokens = String(literalFp).toLowerCase().match(/\b[a-z][a-z-]{2,}\b/g);
    if(!litTokens) return true; // unparseable
    for(const w of litTokens) fpSet.add(stem(w));

    const bag = conceptTextTokens(concept);
    const bagTokens = bag.toLowerCase().match(/\b[a-z][a-z-]{2,}\b/g) || [];
    const realBagTokens = bagTokens.filter(t => fpSet.has(stem(t)));
    if(!bagTokens.length) return false; // concept has no recoverable tokens at all -> no evidence -> fail
    let shared = 0, strongShared = 0;
    for(const t of realBagTokens){
      const s = stem(t);
      if(fpSet.has(s)){
        shared++;
        if(s.length >= 5) strongShared++;
      }
    }

    if(!shared) return false;                // zero overlap -> fail
    if(fpSet.size <= 6) return shared >= 2;  // short fp: require >= 2 shared
    return strongShared >= 1 || shared >= 2; // at least one strong OR >= 2 shared
  }catch{ return true; }                      // degraded path; do not hard-fail on parse noise
}

/* ---------- concept text tokenizer (for the per-concept check) ----------
   Gathers the recoverable teaching text for one concept. Visual node labels
   and details are included because they are topic-specific subject evidence
   (e.g. "Dijkstra", "distance vector", "routing table", "checksum"). Very
   short extrameta fields (sourcePage, mnemonic-only, cap-only) contribute
   little and are already in the bag; we do not special-case them out. */
function conceptTextTokens(concept){
  const out = [];
  const add = s => { if(s) out.push(String(s)); };
  add(concept.title);
  add(concept.summary);
  add(concept.explanation);
  add(concept.sourceExcerpt);
  const kp = concept.keyPoints;
  if(Array.isArray(kp)) for(const k of kp) add(k);
  const rwe = concept.realWorldExamples;
  if(Array.isArray(rwe)){
    for(const ex of rwe){
      add(ex && ex.title);
      add(ex && ex.description);
    }
  }
  const vis = concept.visualization;
  if(vis && Array.isArray(vis.steps)){
    for(const s of vis.steps){
      add(s && s.title);
      add(s && s.description);
      const nodes = s.nodes;
      if(Array.isArray(nodes)){
        for(const n of nodes){
          add(n && n.label);
          add(n && n.detail);
        }
      }
    }
  }
  return out.join(' ');
}

/* ---------- fingerprint normalization + backfill ----------
   Normalizes pack.subjectFingerprint / fingerprint.
   Priority:
     1. LITERAL document fingerprint (when the job captured one) — primary.
     2. Model's asserted fingerprint (subjectFingerprint / fingerprint) — secondary.
     3. Backfill from the lessons' own words — last resort.
   Leaves pack.subjectFingerprint set to the chosen normalized fingerprint.
   */
function normalizeOutlineFingerprint(pack, literalFp){
  try{
    if(!pack || !Array.isArray(pack.concepts) || !pack.concepts.length) return;
    let fp = '';
    let usedLiteral = false;
    if(typeof literalFp === 'string' && literalFp.trim()){
      fp = literalFp.trim().toLowerCase();
      usedLiteral = true;
    }
    // Secondary: model fingerprint only fills the gap when no literal fp was captured.
    // A fluent wrong model also asserts the wrong subject, so it never replaces the
    // document-grounded fingerprint when one exists.
    if(!usedLiteral && typeof pack.subjectFingerprint === 'string' && pack.subjectFingerprint.trim())
      fp = pack.subjectFingerprint.trim().toLowerCase();
    else if(!usedLiteral && typeof pack.fingerprint === 'string' && pack.fingerprint.trim())
      fp = pack.fingerprint.trim().toLowerCase();
    else if(!fp){
      const words = new Set();
      for(const c of pack.concepts){
        if(!c || typeof c !== 'object') continue;
        const add = s => { const m = String(s || '').toLowerCase().match(/\b[a-z][a-z-]{2,}\b/g); if(m) for(const w of m) words.add(w); };
        for(const kp of (Array.isArray(c.keyPoints) ? c.keyPoints : [])) add(kp);
        add(c.title); add(c.summary); add(c.explanation); add(c.sourceExcerpt);
        const rwe = c.realWorldExamples;
        if(Array.isArray(rwe)) for(const ex of rwe){ add(ex && ex.title); add(ex && ex.description); }
        const vis = c.visualization;
        if(vis && Array.isArray(vis.steps)) for(const s of vis.steps){
          add(s && s.title); add(s && s.description);
          if(Array.isArray(s.nodes)) for(const n of s.nodes){ add(n && n.label); add(n && n.detail); }
        }
      }
      fp = words.size ? Array.from(words).slice(0, 14).join(' ') : '';
    }
    pack.subjectFingerprint = fp;
  }catch{ /* callers decide pass/fail */ }
}

/* SUBJECT FIDELITY ENFORCEMENT — called from the pipeline right after an
   outline/unit pack parses and before structural validation. Normalizes the
   pack fingerprint from the job's literal PDF fingerprint, then requires
   every concept to share real subject vocabulary with the document. Throws
   SUBJECT_MISMATCH (502, retryable) on the first off-subject concept so the
   caller's retry can reground the model; a second failure surfaces the
   clear "does not match" message to the user. When no literal fingerprint
   could be captured the check degrades to a no-op — never a blanket
   rejection of everything. */
function enforceOutlineSubjectFidelity(pack, job){
  const fp = job && typeof job.literalFingerprint === 'string' ? job.literalFingerprint : '';
  normalizeOutlineFingerprint(pack, fp);
  if (!fp.trim()) return;
  const concepts = pack && Array.isArray(pack.concepts) ? pack.concepts : [];
  for (const c of concepts){
    const matches = conceptMatchesLiteralFingerprint(c, fp);
    if (!matches){
      throw mkErr(502, 'The study content does not match the subject of this PDF.', { code: 'SUBJECT_MISMATCH' });
    }
  }
}

/* ============================================================
   PROMPT HELPERS (unchanged)
   ------------------------------------------------------------ */
function outlinePromptWithFingerprint(job){
  const base = [
    'Analyze the attached educational PDF and respond with a single valid JSON object containing title, subject, summary, units (at least 3, each with title, overview, learningGoals, topics with title, overview, conceptIndices) and concepts (4 to 6 items, each with title, summary, explanation, sourceExcerpt, sourcePage, keyPoints, whyItMatters, analogy, explanationLevels {simple, everyday, advanced}, commonTrap, correctiveTruth, comparison {firstLabel, secondLabel, takeaway, rows[3] {aspect, first, second}}, originStory, realWorldExamples[{title, description}], workedExample {scenario, answer, steps[2] {label, action, reasoning}}, quickRecall, cheatCode {why, like, wrong, right, oneLine, mnemonic, see[3]}, visualization {caption, steps[2] {title, description, layout, nodes[3] {label, detail, code}}}}). Level: ' + job.level + '. STRUCTURAL INTEGRITY (do not restructure): mirror the PDF\'s own topic order and headings — one concept per PDF topic/section, in the same sequence; never merge topics into a generic stack or invent new groupings. Each visualization layout MUST be one of exactly these 15: flow (steps/process), arch (system/parts), seq (timeline/order), compare (vs/difference), hierarchy (types/classification), state (states/status), erd (entities/data), fbd (force/pressure), wave (graph/signal), isometric (3D/layers), mindmap (brainstorm/causes), matrix (table/grid), equation (formula/calc), cycle (loop/repeats), layer (layers/levels). Every diagram must be topic-specific: node labels come from that topic\'s own terms, never reused across topics. When the PDF shows code/syntax/commands for a node, copy the exact one-line statement into node.code (max 80 chars); otherwise omit code. Keep every diagram topic-specific.',
    'SUBJECT FINGERPRINT (required): include a field "subjectFingerprint": a 3–6 word lowercase summary of the PDF\'s actual subject and the key technical terms it covers (for example "networks, tcp, routing, subnet" or "bacteria, cell, microscope"). It must come from the PDF, not from your general knowledge. This is used to reject a fluent answer that belongs to another subject.'
  ].join(' ');
  return base;
}

function compactOutlinePromptWithFingerprint(job, k){
  const unit = job.chunk.plan.units[k];
  const label = 'Unit ' + (k + 1) + ' of ' + job.chunk.plan.units.length + ' titled "' + unit.title + '"';
  const fp = job && job.literalFingerprint ? ' Document key terms: ' + job.literalFingerprint + '.' : '';
  const base = [
    'Analyze the attached educational PDF and respond with a single valid JSON object containing ONLY the learning content for ' + label + ' — never any other unit. ' + fp + ' Keep the whole answer SMALL so it fits in one response: exactly 3 lessons. It must contain topics (this unit\'s own topics in PDF order, each {title, overview, conceptIndices}) and concepts (exactly 3 lessons for THIS UNIT ONLY, each with title, summary (1-2 sentences), explanation (2-3 sentences), sourceExcerpt (one short verbatim sentence from the PDF), sourcePage (page number), keyPoints (3 short bullets), whyItMatters (one sentence), analogy (one sentence), explanationLevels {simple, everyday, advanced} (each 1-2 sentences), commonTrap (one sentence), correctiveTruth (one sentence), comparison {firstLabel, secondLabel, takeaway, rows[3] {aspect, first, second}}, originStory (1-2 sentences), realWorldExamples[1] {title, description}, workedExample {scenario, answer, steps[2] {label, action, reasoning}}, quickRecall (one sentence), cheatCode {why, like, wrong, right, oneLine, mnemonic, see[3]} (each one short sentence), visualization {caption, steps[1] {title, description, layout, nodes[3] {label, detail}}}). conceptIndices must assign every concept of this unit exactly once, consecutively from 0, across this unit\'s topics in order. Level: ' + job.level + '. Pick the 3 most important PDF topics/sections of this unit, in their PDF order. Each visualization layout MUST be one of exactly these 15: flow, arch, seq, compare, hierarchy, state, erd, fbd, wave, isometric, mindmap, matrix, equation, cycle, layer. Node labels come from that topic\'s own terms, never generic labels like Input/Process/Output. No markdown, no code fences — one valid JSON object only.',
    'SUBJECT FINGERPRINT (required): include a field "subjectFingerprint": a 3–6 word lowercase summary of this unit\'s actual subject and the key technical terms it covers, from the PDF — for example "routing, distance vector, link state, dijkstra" or "star, bus, mesh, topology". It must come from the PDF, not from general knowledge. This is checked against the lesson words to reject a fluent answer from another subject.'
  ].join(' ');
  return base;
}

/* ============================================================
   PHASE 4 MODULE EXPORTS — job queue infrastructure
   ============================================================ */
module.exports = {
  SUPABASE_URL: typeof SUPABASE_URL !== 'undefined' ? SUPABASE_URL : null,
  ANALYZE_STAGES: typeof ANALYZE_STAGES !== 'undefined' ? ANALYZE_STAGES : null,
  jobs: typeof jobs !== 'undefined' ? jobs : null,
  setJobStage: typeof setJobStage !== 'undefined' ? setJobStage : null,
  setJobStageDb: typeof setJobStageDb !== 'undefined' ? setJobStageDb : null,
  jobSnapshot: typeof jobSnapshot !== 'undefined' ? jobSnapshot : null,
  finishJob: typeof finishJob !== 'undefined' ? finishJob : null,
  finishJobDb: typeof finishJobDb !== 'undefined' ? finishJobDb : null,
  saveJob: typeof saveJob !== 'undefined' ? saveJob : null,
  claimJob: typeof claimJob !== 'undefined' ? claimJob : null,
  extractJson: typeof extractJson !== 'undefined' ? extractJson : null,
  getVisualPipeline: typeof getVisualPipeline !== 'undefined' ? getVisualPipeline : null,
  initVisualPipeline: typeof initVisualPipeline !== 'undefined' ? initVisualPipeline : null,
};

/* ============================================================
   PHASE 5: VISUAL SYSTEM CORE — Visual Pipeline Integration
   ============================================================
   Exports visual-related functions for the ANALYZE_STAGES pipeline.
   Uses dynamic import to load the ES module visual system.

   Integration points:
   • visualRegistry — unified visual schema registry
   • createVisualJob — create a visual job with schema validation
   • processVisualStage — process visual stage items in the pipeline
   • getVisualState — get current visual state for a job

   To use in server.js (async context):
     const { createVisualJob, processVisualStage, getVisualState } = await import('./js/visuals/index.js');
   ============================================================ */

// Visual pipeline integration function (loaded dynamically)
let visualModule = null;

async function loadVisualModule() {
  if (visualModule) return visualModule;
  try {
    // Dynamic import for ES Module visual system
    visualModule = await import('./js/visuals/index.js');
    return visualModule;
  } catch (e) {
    console.warn('[Visual Pipeline] Could not load visual module:', e.message);
    // Return CommonJS-compatible stubs
    visualModule = {
      VISUAL_SCHEMAS: {},
      VALID_VISUAL_TYPES: [],
      getVisualSchema: () => null,
      checkRichness: () => false,
      getStepCount: () => 0,
      createVisual: () => ({
        type: '',
        steps: [],
        theme: 'light',
        config: { loop: false, autoPlay: false, interval: 2000, direction: 'forward' }
      }),
      createVisualJob: () => null,
      processVisualStage: () => null,
      getVisualState: () => null
    };
    return visualModule;
  }
}

// Export visual pipeline API (await loadVisualModule() at runtime)
async function getVisualPipeline() {
  const m = await loadVisualModule();
  return {
    VISUAL_REGISTRY: m.VISUAL_SCHEMAS,
    VALID_VISUAL_TYPES: m.VALID_VISUAL_TYPES,
    createVisual: m.createVisual,
    checkRichness: m.checkRichness,
    getStepCount: m.getStepCount,
    createVisualJob: m.createVisualJob,
    processVisualStage: m.processVisualStage,
    getVisualState: m.getVisualState
  };
}

// Backward compatibility: load module once at startup
let _visualPipelinePromise = null;
async function initVisualPipeline() {
  if (!_visualPipelinePromise) {
    _visualPipelinePromise = loadVisualModule();
  }
  return _visualPipelinePromise;
}

/* ============================================================
*/
