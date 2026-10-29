'use strict';
/**
 * ============================================================
 * XAMCODE SERVER SESSION & USER PERSISTENCE ENGINE
 * ------------------------------------------------------------
 * Implements server-side session authentication, CSRF mitigation,
 * multi-tenant user context injection, and write-through persistence
 * for quiz scores, topic mastery, and study notes.
 * ============================================================
 */
const crypto = require('crypto');
const store = require('../bip/store');

const DEFAULT_TTL_HOURS = 24;

// In-memory fallback cache for offline buffering
const memProgressCache = new Map();
const memSessionCache = new Map();

function ensureStoreStructures() {
  const d = store.ensureLoaded();
  if (!d.sessions || typeof d.sessions !== 'object' || Array.isArray(d.sessions)) {
    d.sessions = {};
  }
  if (!d.userProgress || typeof d.userProgress !== 'object' || Array.isArray(d.userProgress)) {
    d.userProgress = {};
  }
  return d;
}

/**
 * Creates an authentic server-side session with CSRF protection token.
 */
function createSession(userPayload, ttlHours = DEFAULT_TTL_HOURS) {
  ensureStoreStructures();
  const d = store.ensureLoaded();

  const tokenBytes = crypto.randomBytes(32).toString('hex');
  const token = 'xcs_' + tokenBytes;
  const csrfToken = 'csr_' + crypto.randomBytes(24).toString('hex');
  const now = Date.now();
  const expiresAt = now + (ttlHours * 3600 * 1000);

  const user = {
    id: userPayload.id || ('u_' + crypto.randomBytes(8).toString('hex')),
    email: String(userPayload.email || 'student@xamcode.ai').toLowerCase().trim(),
    name: userPayload.name || 'Student',
    role: userPayload.role || 'student',
    isGuest: !!userPayload.isGuest
  };

  const sessionObj = {
    token,
    user,
    csrfToken,
    createdAt: new Date(now).toISOString(),
    expiresAt,
    lastActiveAt: new Date(now).toISOString()
  };

  d.sessions[token] = sessionObj;
  memSessionCache.set(token, sessionObj);

  try {
    store.persist();
  } catch (err) {
    // If durable store fails, session remains active in memory buffer
    console.warn('[Auth] Warning: Could not persist session immediately to durable store:', err.message);
  }

  return {
    ok: true,
    token,
    csrfToken,
    expiresAt,
    user
  };
}

/**
 * Retrieves and validates an existing session token.
 */
function getSession(token) {
  if (!token || typeof token !== 'string') return null;
  ensureStoreStructures();
  const d = store.ensureLoaded();

  let session = d.sessions[token] || memSessionCache.get(token);
  if (!session) return null;

  if (Date.now() > session.expiresAt) {
    session.expired = true;
    return session;
  }

  return session;
}

/**
 * Destroys a session on logout.
 */
function invalidateSession(token) {
  if (!token) return false;
  ensureStoreStructures();
  const d = store.ensureLoaded();
  let existed = false;
  if (d.sessions[token]) {
    delete d.sessions[token];
    existed = true;
  }
  if (memSessionCache.has(token)) {
    memSessionCache.delete(token);
    existed = true;
  }
  try { store.persist(); } catch (e) {}
  return existed;
}

/**
 * Extracts session token from Authorization header or Cookie header.
 */
function extractToken(req) {
  const authHeader = req.headers['authorization'];
  if (authHeader && typeof authHeader === 'string') {
    const parts = authHeader.split(/\s+/);
    if (parts.length === 2 && /^bearer$/i.test(parts[0])) {
      return parts[1].trim();
    }
  }

  const cookieHeader = req.headers['cookie'];
  if (cookieHeader && typeof cookieHeader === 'string') {
    const match = /(?:^|;\s*)xc_session=([^;]+)/.exec(cookieHeader);
    if (match) return decodeURIComponent(match[1].trim());
  }

  return null;
}

/**
 * Session verification middleware.
 * Injects req.user and req.session on success.
 */
function authenticateRequest(req, options = {}) {
  const token = extractToken(req);
  if (!token) {
    return {
      ok: false,
      status: 401,
      code: 'UNAUTHORIZED',
      error: 'Authentication required. No session token provided.'
    };
  }

  const session = getSession(token);
  if (!session) {
    return {
      ok: false,
      status: 401,
      code: 'UNAUTHORIZED',
      error: 'Invalid session token.'
    };
  }

  if (session.expired) {
    return {
      ok: false,
      status: 401,
      code: 'SESSION_EXPIRED',
      error: 'Your session has expired. Please sign in again.'
    };
  }

  // CSRF validation on mutating routes
  const method = (req.method || 'GET').toUpperCase();
  const isMutating = method === 'POST' || method === 'PUT' || method === 'DELETE' || method === 'PATCH';
  if (isMutating && options.requireCsrf !== false) {
    const clientCsrf = req.headers['x-csrf-token'];
    if (!clientCsrf || clientCsrf !== session.csrfToken) {
      return {
        ok: false,
        status: 403,
        code: 'CSRF_MISMATCH',
        error: 'Invalid or missing CSRF protection token.'
      };
    }
  }

  req.user = session.user;
  req.session = session;
  return {
    ok: true,
    status: 200,
    user: session.user,
    session,
    token
  };
}

/**
 * Persists user progress write-through with offline fault tolerance.
 */
function recordUserProgress(userId, progressData) {
  if (!userId) return null;
  ensureStoreStructures();
  const d = store.ensureLoaded();

  const current = d.userProgress[userId] || memProgressCache.get(userId) || {
    userId,
    quizScores: {},
    masteredTopics: {},
    completedNotes: {},
    history: [],
    updatedAt: new Date().toISOString()
  };

  if (progressData.masteredTopics) {
    Object.assign(current.masteredTopics, progressData.masteredTopics);
  }
  if (progressData.quizScores) {
    Object.assign(current.quizScores, progressData.quizScores);
  }
  if (progressData.completedNotes) {
    Object.assign(current.completedNotes, progressData.completedNotes);
  }
  if (progressData.historyItem) {
    current.history.unshift(progressData.historyItem);
    if (current.history.length > 100) current.history.pop();
  }
  current.updatedAt = new Date().toISOString();

  d.userProgress[userId] = current;
  memProgressCache.set(userId, current);

  try {
    store.persist();
  } catch (err) {
    console.warn('[UserProgress] Warning: DB/File write failure, buffered locally:', err.message);
  }

  return current;
}

/**
 * Retrieves persisted user progress.
 */
function getUserProgress(userId) {
  if (!userId) return null;
  ensureStoreStructures();
  const d = store.ensureLoaded();
  return d.userProgress[userId] || memProgressCache.get(userId) || {
    userId,
    quizScores: {},
    masteredTopics: {},
    completedNotes: {},
    history: [],
    updatedAt: new Date().toISOString()
  };
}

/**
 * Reads request JSON body cleanly with error recovery.
 */
function readJsonBody(req, limitBytes = 1048576) {
  return new Promise((resolve) => {
    let buf = '';
    let destroyed = false;
    req.on('data', (chunk) => {
      if (destroyed) return;
      buf += chunk;
      if (buf.length > limitBytes) {
        destroyed = true;
        resolve({ __bodyError: 'Request body exceeds maximum allowed size' });
      }
    });
    req.on('end', () => {
      if (destroyed) return;
      if (!buf.trim()) return resolve({});
      try {
        resolve(JSON.parse(buf));
      } catch (err) {
        resolve({ __bodyError: 'Malformed JSON payload' });
      }
    });
    req.on('error', (err) => resolve({ __bodyError: err.message }));
  });
}

function sendJson(res, statusCode, body, requestId) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'X-Request-Id': requestId || ''
  });
  res.end(JSON.stringify(body));
}

/**
 * Route handler for server-side auth and user progress persistence.
 */
async function handleAuthAndProgress(req, res, url, pathname, requestId) {
  // 1. POST /api/auth/signin
  if (req.method === 'POST' && pathname === '/api/auth/signin') {
    const body = await readJsonBody(req);
    if (body.__bodyError) return sendJson(res, 400, { ok: false, error: body.__bodyError, code: 'BAD_JSON' }, requestId);

    const email = body.email || 'student@xamcode.ai';
    const name = body.name || (email.split('@')[0] || 'Student');
    const isGuest = !!body.isGuest;

    const sessionRes = createSession({ email, name, isGuest });
    res.setHeader('Set-Cookie', `xc_session=${encodeURIComponent(sessionRes.token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`);
    return sendJson(res, 200, {
      ok: true,
      token: sessionRes.token,
      csrfToken: sessionRes.csrfToken,
      expiresAt: sessionRes.expiresAt,
      user: sessionRes.user
    }, requestId);
  }

  // 2. GET /api/auth/session
  if (req.method === 'GET' && pathname === '/api/auth/session') {
    const auth = authenticateRequest(req, { requireCsrf: false });
    if (!auth.ok) {
      return sendJson(res, auth.status, { ok: false, error: auth.error, code: auth.code }, requestId);
    }
    return sendJson(res, 200, {
      ok: true,
      user: auth.user,
      csrfToken: auth.session.csrfToken,
      expiresAt: auth.session.expiresAt
    }, requestId);
  }

  // 3. POST /api/auth/signout
  if (req.method === 'POST' && pathname === '/api/auth/signout') {
    const token = extractToken(req);
    if (token) invalidateSession(token);
    res.setHeader('Set-Cookie', 'xc_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
    return sendJson(res, 200, { ok: true, message: 'Signed out successfully.' }, requestId);
  }

  // 4. POST /api/quiz/submit
  if (req.method === 'POST' && pathname === '/api/quiz/submit') {
    const auth = authenticateRequest(req, { requireCsrf: true });
    if (!auth.ok) {
      return sendJson(res, auth.status, { ok: false, error: auth.error, code: auth.code }, requestId);
    }

    const body = await readJsonBody(req);
    if (body.__bodyError) return sendJson(res, 400, { ok: false, error: body.__bodyError, code: 'BAD_JSON' }, requestId);

    const topicId = String(body.topicId || 'default-topic');
    const score = Number(body.score) || 0;
    const total = Number(body.total) || 1;
    const pct = total > 0 ? Math.round((score / total) * 100) : 0;
    const isMastered = pct >= 80;

    const progressUpdate = {
      quizScores: { [topicId]: { score, total, pct, at: new Date().toISOString() } },
      masteredTopics: isMastered ? { [topicId]: true } : {},
      historyItem: {
        type: 'quiz_submitted',
        topicId,
        score,
        total,
        pct,
        isMastered,
        at: new Date().toISOString()
      }
    };

    const saved = recordUserProgress(auth.user.id, progressUpdate);
    return sendJson(res, 200, {
      ok: true,
      topicId,
      score,
      total,
      pct,
      isMastered,
      userProgress: saved
    }, requestId);
  }

  // 5. GET /api/user/progress
  if (req.method === 'GET' && pathname === '/api/user/progress') {
    const auth = authenticateRequest(req, { requireCsrf: false });
    if (!auth.ok) {
      return sendJson(res, auth.status, { ok: false, error: auth.error, code: auth.code }, requestId);
    }
    const prog = getUserProgress(auth.user.id);
    return sendJson(res, 200, { ok: true, progress: prog }, requestId);
  }

  // 6. POST /api/user/progress
  if (req.method === 'POST' && pathname === '/api/user/progress') {
    const auth = authenticateRequest(req, { requireCsrf: true });
    if (!auth.ok) {
      return sendJson(res, auth.status, { ok: false, error: auth.error, code: auth.code }, requestId);
    }
    const body = await readJsonBody(req);
    if (body.__bodyError) return sendJson(res, 400, { ok: false, error: body.__bodyError, code: 'BAD_JSON' }, requestId);

    const saved = recordUserProgress(auth.user.id, {
      masteredTopics: body.masteredTopics || {},
      quizScores: body.quizScores || {},
      completedNotes: body.completedNotes || {},
      historyItem: body.historyItem || null
    });
    return sendJson(res, 200, { ok: true, progress: saved }, requestId);
  }

  return false;
}

module.exports = {
  createSession,
  getSession,
  invalidateSession,
  extractToken,
  authenticateRequest,
  recordUserProgress,
  getUserProgress,
  handleAuthAndProgress
};
