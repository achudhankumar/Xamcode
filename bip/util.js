'use strict';
/* ============================================================
   BIP UTILITIES — shared helpers for the Build-in-Public module.
   Mirrors the patterns already used in server.js (sendJson with
   security headers, readJson body gates, IP rate limiting) so the
   public site behaves consistently with the study app.
   Zero dependencies: Node builtins only.
   ============================================================ */
const crypto = require('node:crypto');

/* ---------- responses ---------- */
function sendJson(res, status, obj, requestId){
  const body = JSON.stringify(obj);
  if (!res.headersSent){
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    if (requestId) res.setHeader('X-Request-Id', requestId);
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    // JSON carries no subresources: deny everything, defense-in-depth.
    res.setHeader('Content-Security-Policy', cspForApi());
    res.setHeader('Cache-Control', 'no-store');
  }
  res.writeHead(status);
  res.end(body);
  /* Return TRUE so route handlers can `return sendJson(...)` and the
     dispatcher can tell "handled" from "not my route". The handlers
     already follow this convention (denied/durableUnavailable return
     true). Returning undefined would make the dispatcher fall through
     and overwrite the response with a 404. */
  return true;
}

/* ---------- Content-Security-Policy ----------
   build.html loads ZERO external origins: one inline <script>, two
   inline <style> blocks, 11 inline style= attributes, and every
   fetch/EventSource is same-origin. That makes a tight CSP possible:
   scripts are locked to a per-request nonce (no unsafe-inline), and
   the only relaxation is style-src 'unsafe-inline' for the inline
   style= attributes, which cannot carry a nonce and are not worth a
   risky refactor. Verified against the live dashboard. */
function newNonce(){
  return crypto.randomBytes(16).toString('base64');
}
function cspForPage(nonce){
  return [
    "default-src 'self'",
    "script-src 'self' 'nonce-" + nonce + "'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data:",
    "media-src 'self'",
    "connect-src 'self'",
    "font-src 'self' https://fonts.gstatic.com",
    "object-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'"
  ].join('; ');
}
function cspForApi(){
  return "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";
}

/* ---------- security headers ----------
   Applies the full hardened header set to an HTML response. Kept in
   sync with server.js sendJson so BIP pages match the study app. */
function applySecurityHeaders(res, opts){
  opts = opts || {};
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  if (opts.csp) res.setHeader('Content-Security-Policy', opts.csp);
  if (process.env.NODE_ENV === 'production'){
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
}


function mkErr(status, message, code){
  const e = new Error(message);
  e.status = status;
  if (code) e.code = code;
  return e;
}

/* ---------- body gates ---------- */
function readBody(req, limitBytes){
  return new Promise((resolve, reject) => {
    let total = 0;
    const chunks = [];
    req.on('data', c => {
      total += c.length;
      if (total > limitBytes){ reject(mkErr(413, 'Request body too large.', 'BODY_TOO_LARGE')); req.destroy(); }
      else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function readJson(req, limitBytes){
  const raw = await readBody(req, limitBytes);
  try{ return JSON.parse(raw); }
  catch{ throw mkErr(400, 'The request body was unreadable.', 'BAD_JSON'); }
}

/* Raw body accessor for webhook signature checks — signature must be
   computed over the exact bytes that were sent, not a re-serialization. */
function readRawBody(req, limitBytes){
  return readBody(req, limitBytes);
}

/* ---------- identity / ip ---------- */
function clientIp(req){
  const fwd = req.headers && req.headers['x-forwarded-for'];
  const raw = (typeof fwd === 'string' && fwd.split(',')[0].trim()) || (req.socket && req.socket.remoteAddress) || 'unknown';
  return raw;
}

function sha(s){ return crypto.createHash('sha256').update(String(s)).digest('hex'); }

function timingSafeEqualStr(a, b){
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}


/* ---------- rate limiting (sliding window per key) ---------- */
function createRateLimiter(opts){
  const windowMs = (opts && opts.windowMs) || 60000;
  const max = (opts && opts.max) || 10;
  const hits = new Map();
  function allow(key){
    const now = Date.now();
    // Prune occasionally so the map cannot grow without bound.
    if (hits.size > 5000){
      for (const [k, arr] of hits){
        const kept = arr.filter(t => now - t < windowMs);
        if (kept.length) hits.set(k, kept); else hits.delete(k);
      }
    }
    const arr = (hits.get(key) || []).filter(t => now - t < windowMs);
    if (arr.length >= max) { hits.set(key, arr); return false; }
    arr.push(now);
    hits.set(key, arr);
    return true;
  }
  /* Test hook: forget all state. */
  function reset(){ hits.clear(); }
  return { allow, reset, max, windowMs };
}

/* ---------- visitor identity (signed cookie) ----------
   Anonymous-but-stable identity used for vote de-duplication and
   gentle abuse control. Cookie: "<randomId>.<hmac(secret, randomId)>".
   HttpOnly so page scripts cannot tamper with the signature. */
function parseCookies(req){
  const out = {};
  const header = req.headers && req.headers.cookie;
  if (!header) return out;
  for (const part of String(header).split(';')){
    const i = part.indexOf('=');
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function visitorSecret(){
  // Explicit secret in env; otherwise a persisted generated secret so
  // identities survive restarts. Never committed (bip-data/ is ignored).
  if (typeof process.env.BIP_SESSION_SECRET === 'string' && process.env.BIP_SESSION_SECRET.trim().length >= 16){
    return process.env.BIP_SESSION_SECRET.trim();
  }
  if (visitorSecret._cached) return visitorSecret._cached;
  const { fs, path } = visitorSecret._deps;
  const dir = process.env.BIP_DATA_DIR || path.join(__dirname, '..', 'bip-data');
  const file = path.join(dir, 'session.secret');
  try{
    visitorSecret._cached = fs.readFileSync(file, 'utf8').trim();
    if (visitorSecret._cached.length >= 16) return visitorSecret._cached;
  }catch{}
  const generated = crypto.randomBytes(32).toString('hex');
  try{
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, generated, { mode: 0o600 });
  }catch{
    // Read-only dir: fall back to an in-memory secret (identities then
    // reset on restart — acceptable degradation, documented).
  }
  visitorSecret._cached = generated;
  return generated;
}
visitorSecret._deps = { fs: require('node:fs'), path: require('node:path') };

function getOrCreateVisitor(req, res){
  const cookies = parseCookies(req);
  const raw = cookies.bip_vid || '';
  const dot = raw.indexOf('.');
  if (dot > 0){
    const id = raw.slice(0, dot);
    const mac = raw.slice(dot + 1);
    const expect = sha('bip-vid|' + id + '|' + visitorSecret()).slice(0, 40);
    if (/^[a-f0-9]{16,32}$/.test(id) && timingSafeEqualStr(mac, expect)) return id;
  }
  const id = crypto.randomBytes(12).toString('hex');
  const mac = sha('bip-vid|' + id + '|' + visitorSecret()).slice(0, 40);
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  if (res && !res.headersSent){
    res.setHeader('Set-Cookie', 'bip_vid=' + id + '.' + mac + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000' + secure);
  }
  return id;
}

/* ---------- sanitization ---------- */
/* Patterns that must never reach a public payload even if someone
   pastes them into a commit message or chat line. */
const SECRET_PATTERNS = [
  /gh[pousr]_[A-Za-z0-9]{20,}/g,          // GitHub tokens
  /github_pat_[A-Za-z0-9_]{20,}/g,
  /sk-[A-Za-z0-9_-]{16,}/g,                // OpenAI-style keys
  /AKIA[0-9A-Z]{16}/g,                     // AWS access keys
  /AIza[0-9A-Za-z_-]{30,}/g,               // Google API keys
  /rzp_(live|test)_[A-Za-z0-9]{10,}/g,     // Razorpay keys
  /Bearer\s+[A-Za-z0-9._-]{16,}/gi,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/g,
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g  // emails in public feeds
];

/* Strips control characters, HTML, and secret-looking substrings,
   then truncates. Used for every public-facing free-text field. */
function sanitizePublicText(input, maxLen){
  let s = (input == null) ? '' : String(input);
  s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  for (const re of SECRET_PATTERNS) s = s.replace(re, '[redacted]');
  s = s.replace(/<[^>]*>/g, '');            // drop HTML tags outright
  s = s.replace(/\s+/g, ' ').trim();
  const max = maxLen || 500;
  if (s.length > max) s = s.slice(0, max);
  return s;
}

/* Multi-line variant for descriptions: keeps newlines, still no HTML. */
function sanitizeMultiline(input, maxLen){
  let s = (input == null) ? '' : String(input);
  s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  for (const re of SECRET_PATTERNS) s = s.replace(re, '[redacted]');
  s = s.replace(/<[^>]*>/g, '');
  s = s.replace(/\r\n/g, '\n');
  s = s.replace(/\n{3,}/g, '\n\n').trim();
  const max = maxLen || 2000;
  if (s.length > max) s = s.slice(0, max);
  return s;
}

function isValidEmail(email){
  if (typeof email !== 'string') return false;
  const e = email.trim();
  if (e.length < 5 || e.length > 254) return false;
  return /^[^\s@<>]+@[^\s@<>]+\.[A-Za-z]{2,}$/.test(e);
}

/* ---------- auth gates ---------- */
/* CI / Actions ingest: "Authorization: Bearer <token>". */
function bearerMatches(req, expected){
  if (!expected || typeof expected !== 'string' || expected.trim().length < 8) return { ok: false, configured: false };
  const h = req.headers && req.headers.authorization;
  if (typeof h !== 'string' || !h.startsWith('Bearer ')) return { ok: false, configured: true, missing: true };
  return { ok: timingSafeEqualStr(h.slice(7).trim(), expected.trim()), configured: true };
}

/* Admin actions: "Authorization: Bearer <BIP_ADMIN_TOKEN>". */
function isAdmin(req){
  return bearerMatches(req, process.env.BIP_ADMIN_TOKEN);
}

function isoNow(){ return new Date().toISOString(); }

module.exports = {
  sendJson, mkErr, readBody, readJson, readRawBody,
  clientIp, sha, timingSafeEqualStr, createRateLimiter,
  parseCookies, getOrCreateVisitor,
  sanitizePublicText, sanitizeMultiline, isValidEmail,
  bearerMatches, isAdmin, isoNow,
  newNonce, cspForPage, cspForApi, applySecurityHeaders
};
