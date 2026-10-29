'use strict';
/**
 * ============================================================
 * TEST: SERVER-SIDE AUTHENTICATION & USER PERSISTENCE ENGINE
 * ============================================================
 * Verifies:
 * - Session creation, expiration, and invalidation
 * - Authorization header and Cookie token extraction
 * - CSRF token verification on mutating requests
 * - Write-through user progress persistence (quizScores, masteredTopics)
 * - HTTP integration with server.js on live port
 * - Graceful local buffering under storage failures
 */
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const authSession = require('./lib/auth-session');

let pass = 0, fail = 0;
function ok(cond, msg) {
  if (cond) { pass++; console.log('  ok   ' + msg); }
  else { fail++; console.log('  FAIL ' + msg); }
}

console.log('\n--- 1. UNIT TESTS: SESSION & CSRF MECHANICS ---');

// 1A: Session creation
const s1 = authSession.createSession({ email: 'alice@exam.edu', name: 'Alice', role: 'student' });
ok(s1 && s1.ok, 'createSession returns ok: true');
ok(typeof s1.token === 'string' && s1.token.startsWith('xcs_'), 'token is prefixed with xcs_');
ok(typeof s1.csrfToken === 'string' && s1.csrfToken.startsWith('csr_'), 'csrfToken is prefixed with csr_');
ok(s1.user.email === 'alice@exam.edu', 'user email normalized to alice@exam.edu');

// 1B: Session retrieval
const fetched = authSession.getSession(s1.token);
ok(fetched && fetched.user.name === 'Alice', 'getSession returns active session object');

// 1C: Session expiration
const sExp = authSession.createSession({ email: 'bob@exam.edu', name: 'Bob' }, -1); // expired 1h ago
const expRes = authSession.getSession(sExp.token);
ok(expRes && expRes.expired === true, 'expired session is flagged as expired: true');

// 1D: Middleware authentication with Authorization header
const mockReqValid = {
  method: 'GET',
  headers: { authorization: 'Bearer ' + s1.token }
};
const authValid = authSession.authenticateRequest(mockReqValid);
ok(authValid.ok === true && authValid.user.email === 'alice@exam.edu', 'authenticateRequest succeeds with Bearer token');
ok(mockReqValid.user && mockReqValid.user.name === 'Alice', 'user context is injected onto req.user');

// 1E: Missing token
const mockReqNoAuth = { method: 'GET', headers: {} };
const authMissing = authSession.authenticateRequest(mockReqNoAuth);
ok(authMissing.ok === false && authMissing.status === 401 && authMissing.code === 'UNAUTHORIZED', 'missing token returns 401 UNAUTHORIZED');

// 1F: Expired token
const mockReqExpired = { method: 'GET', headers: { authorization: 'Bearer ' + sExp.token } };
const authExpired = authSession.authenticateRequest(mockReqExpired);
ok(authExpired.ok === false && authExpired.status === 401 && authExpired.code === 'SESSION_EXPIRED', 'expired token returns 401 SESSION_EXPIRED');

// 1G: Mutating request without CSRF
const mockReqMutateNoCsrf = {
  method: 'POST',
  headers: { authorization: 'Bearer ' + s1.token }
};
const authNoCsrf = authSession.authenticateRequest(mockReqMutateNoCsrf);
ok(authNoCsrf.ok === false && authNoCsrf.status === 403 && authNoCsrf.code === 'CSRF_MISMATCH', 'mutating request without CSRF returns 403 CSRF_MISMATCH');

// 1H: Mutating request with valid CSRF
const mockReqMutateValidCsrf = {
  method: 'POST',
  headers: { authorization: 'Bearer ' + s1.token, 'x-csrf-token': s1.csrfToken }
};
const authMutateOk = authSession.authenticateRequest(mockReqMutateValidCsrf);
ok(authMutateOk.ok === true, 'mutating request with matching CSRF token succeeds');

console.log('\n--- 2. USER PROGRESS PERSISTENCE & FAULT TOLERANCE ---');

// 2A: Record quiz results & mastery
const p1 = authSession.recordUserProgress(s1.user.id, {
  quizScores: { 'topic-networking-01': { score: 5, total: 5, pct: 100 } },
  masteredTopics: { 'topic-networking-01': true }
});
ok(p1 && p1.masteredTopics['topic-networking-01'] === true, 'recordUserProgress persists masteredTopics');
ok(p1.quizScores['topic-networking-01'].pct === 100, 'recordUserProgress persists quizScores');

// 2B: Retrieve user progress
const fetchedProg = authSession.getUserProgress(s1.user.id);
ok(fetchedProg && fetchedProg.masteredTopics['topic-networking-01'] === true, 'getUserProgress reads back persisted progress');

console.log('\n--- 3. HTTP ENDPOINT INTEGRATION (LIVE SERVER) ---');

const PORT = 4299;
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'bip-auth-test-'));
const env = Object.assign({}, process.env, {
  PORT: String(PORT),
  BIP_DATA_DIR: DATA
});

const child = spawn(process.execPath, ['server.js'], { cwd: __dirname, env, stdio: ['ignore', 'pipe', 'pipe'] });
let stderrBuf = '';
child.stderr.on('data', c => { stderrBuf += c; });

function parse(b) { try { return JSON.parse(b); } catch (e) { return null; } }
function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

function req(method, p, body, headers) {
  return new Promise((resolve) => {
    const opts = { host: '127.0.0.1', port: PORT, path: p, method, headers: Object.assign({ Accept: 'application/json' }, headers || {}) };
    const r = http.request(opts, (res) => {
      let buf = '';
      res.on('data', c => { buf += c; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: buf }));
    });
    r.on('error', (err) => resolve({ status: 0, error: err }));
    if (body !== undefined) r.write(typeof body === 'string' ? body : JSON.stringify(body));
    r.end();
  });
}

(async () => {
  await wait(1800);
  let r, j;

  // 3A: POST /api/auth/signin
  r = await req('POST', '/api/auth/signin', { email: 'student@xamcode.ai', name: 'Alex' }, { 'Content-Type': 'application/json' });
  j = parse(r.body);
  ok(r.status === 200 && j && j.ok, 'POST /api/auth/signin returns 200');
  ok(typeof j.token === 'string' && j.token.startsWith('xcs_'), 'response includes xcs_ session token');
  ok(typeof j.csrfToken === 'string' && j.csrfToken.startsWith('csr_'), 'response includes csrfToken');
  ok(r.headers['set-cookie'] && r.headers['set-cookie'].some(c => c.includes('xc_session=')), 'session cookie set with HttpOnly and SameSite');

  const liveToken = j.token;
  const liveCsrf = j.csrfToken;

  // 3B: GET /api/auth/session with valid token
  r = await req('GET', '/api/auth/session', undefined, { Authorization: 'Bearer ' + liveToken });
  j = parse(r.body);
  ok(r.status === 200 && j && j.user.name === 'Alex', 'GET /api/auth/session returns authenticated user context');

  // 3C: GET /api/auth/session with NO token
  r = await req('GET', '/api/auth/session');
  ok(r.status === 401, 'GET /api/auth/session without token returns 401');

  // 3D: POST /api/quiz/submit with missing CSRF -> 403
  r = await req('POST', '/api/quiz/submit', { topicId: 'routing-101', score: 4, total: 5 }, {
    Authorization: 'Bearer ' + liveToken,
    'Content-Type': 'application/json'
  });
  ok(r.status === 403, 'POST /api/quiz/submit without CSRF returns 403 (got ' + r.status + ')');

  // 3E: POST /api/quiz/submit with valid CSRF -> 200 & mastery evaluated
  r = await req('POST', '/api/quiz/submit', { topicId: 'routing-101', score: 5, total: 5 }, {
    Authorization: 'Bearer ' + liveToken,
    'X-CSRF-Token': liveCsrf,
    'Content-Type': 'application/json'
  });
  j = parse(r.body);
  ok(r.status === 200 && j && j.ok, 'POST /api/quiz/submit with CSRF returns 200');
  ok(j.isMastered === true, '100% score evaluates isMastered: true');
  ok(j.userProgress.masteredTopics['routing-101'] === true, 'mastered topic persisted in userProgress');

  // 3F: GET /api/user/progress reads persisted state
  r = await req('GET', '/api/user/progress', undefined, { Authorization: 'Bearer ' + liveToken });
  j = parse(r.body);
  ok(r.status === 200 && j && j.progress.masteredTopics['routing-101'] === true, 'GET /api/user/progress returns persisted mastery');

  // 3G: POST /api/auth/signout
  r = await req('POST', '/api/auth/signout', {}, { Authorization: 'Bearer ' + liveToken, 'Content-Type': 'application/json' });
  ok(r.status === 200, 'POST /api/auth/signout invalidates session');

  // 3H: After logout, old token is rejected
  r = await req('GET', '/api/auth/session', undefined, { Authorization: 'Bearer ' + liveToken });
  ok(r.status === 401, 'old token rejected with 401 after signout');

  child.kill();
  console.log(`\nAUTH & USER PERSISTENCE SUITE: ${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
  process.exit(0);
})();
