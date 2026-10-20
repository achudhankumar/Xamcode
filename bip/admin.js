'use strict';
/* ============================================================
   BIP ADMIN — privileged endpoints, all gated on BIP_ADMIN_TOKEN.
   If the token is not configured, every admin endpoint answers 503
   with an honest "admin not configured" code instead of silently
   allowing anything. Public users can never reach these actions.
   ============================================================ */
const store = require('./store');
const progress = require('./progress');
const community = require('./community');
const events = require('./events');
const estimate = require('./estimate');
const { sendJson, isAdmin, sanitizePublicText, sanitizeMultiline } = require('./util');

/* Resolve the guard once per request; handlers call requireAdmin()
   first and bail when it answers. Returns true when the request
   was rejected (so callers can simply `return`). */
function requireAdmin(req, res, requestId){
  const g = isAdmin(req);
  if (!g.configured){
    sendJson(res, 503, { error: 'Admin actions are not configured on this server.', code: 'ADMIN_NOT_CONFIGURED', requestId }, requestId);
    return true;
  }
  if (!g.ok){
    sendJson(res, 401, { error: 'Admin authorization required.', code: 'UNAUTHORIZED', requestId }, requestId);
    return true;
  }
  return false;
}

/* ---------- milestones ---------- */
async function adminVerifyMilestone(req, res, id, body, requestId){
  const r = progress.verifyMilestone(id, body && body.evidence, 'admin');
  if (!r.ok) return sendJson(res, r.code === 'NOT_FOUND' ? 404 : 400, { error: r.error, code: r.code, requestId }, requestId);
  const ev = await events.recordDevEventAsync({ type: 'milestone_verified', summary: 'Milestone verified: ' + r.milestone.title, ref: r.milestone.key || '', source: 'admin' });
  if (ev.code === 'DURABLE_STORAGE_UNAVAILABLE'){
    /* The milestone flip itself is local and already applied — say so
       honestly instead of hiding the failure behind a fake 200. */
    return sendJson(res, 503, { error: 'Durable Build-in-Public storage is unavailable; this verification is NOT in the public activity feed.', code: ev.code, milestoneChanged: true, requestId }, requestId);
  }
  return sendJson(res, 200, { milestone: r.milestone, progress: r.progress, requestId }, requestId);
}

async function adminReopenMilestone(req, res, id, body, requestId){
  const r = progress.reopenMilestone(id, body && body.reason, 'admin');
  if (!r.ok) return sendJson(res, r.code === 'NOT_FOUND' ? 404 : 400, { error: r.error, code: r.code, requestId }, requestId);
  const ev = await events.recordDevEventAsync({ type: 'milestone_reopened', summary: 'Milestone reopened for review: ' + r.milestone.title, ref: r.milestone.key || '', source: 'admin' });
  if (ev.code === 'DURABLE_STORAGE_UNAVAILABLE'){
    return sendJson(res, 503, { error: 'Durable Build-in-Public storage is unavailable; this reopen is NOT in the public activity feed.', code: ev.code, milestoneChanged: true, requestId }, requestId);
  }
  return sendJson(res, 200, { milestone: r.milestone, progress: r.progress, requestId }, requestId);
}

function adminSetMilestone(req, res, id, body, requestId){
  const r = progress.setMilestoneStatus(id, body && body.status, 'admin');
  if (!r.ok){
    const code = r.code === 'NOT_FOUND' ? 404 : 400;
    return sendJson(res, code, { error: r.error, code: r.code, requestId }, requestId);
  }
  return sendJson(res, 200, { milestone: r.milestone, progress: r.progress, requestId }, requestId);
}

function adminUpdateCriteria(req, res, id, body, requestId){
  const m = progress.findMilestone(id);
  if (!m) return sendJson(res, 404, { error: 'Unknown milestone.', code: 'NOT_FOUND', requestId }, requestId);
  const criteria = sanitizePublicText(body && body.criteria, 500);
  if (!criteria) return sendJson(res, 400, { error: 'Criteria text is required.', code: 'BAD_CRITERIA', requestId }, requestId);
  m.criteria = criteria;
  m.updatedAt = new Date().toISOString();
  store.persist();
  return sendJson(res, 200, { milestone: m, requestId }, requestId);
}


/* ---------- launch target ---------- */
const ROADMAP_STATUSES = ['planned', 'in_progress', 'completed'];

function adminSetLaunch(req, res, body, requestId){
  const d = store.ensureLoaded();
  const patch = (body && body.launch) || body || {};
  const next = Object.assign({}, d.settings.launch);
  if (patch.estimated !== undefined){
    if (patch.estimated === null || patch.estimated === ''){
      next.estimated = null;
    } else {
      const t = Date.parse(patch.estimated);
      if (Number.isNaN(t)) return sendJson(res, 400, { error: 'Estimated date must be an ISO date.', code: 'BAD_DATE', requestId }, requestId);
      next.estimated = new Date(t).toISOString();
    }
  }
  if (patch.confirmed !== undefined){
    if (patch.confirmed === null || patch.confirmed === ''){
      next.confirmed = null;
    } else {
      const t = Date.parse(patch.confirmed);
      if (Number.isNaN(t)) return sendJson(res, 400, { error: 'Confirmed date must be an ISO date.', code: 'BAD_DATE', requestId }, requestId);
      next.confirmed = new Date(t).toISOString();
    }
  }
  if (patch.note !== undefined) next.note = sanitizePublicText(patch.note, 500);
  next.updatedAt = new Date().toISOString();
  d.settings.launch = next;
  store.persist();
  events.broadcast({ kind: 'launch', launch: publicLaunch() });
  return sendJson(res, 200, { launch: next, requestId }, requestId);
}

/* Launch response: keeps readiness, estimated and confirmed clearly
   separate so the site never shows a fake guaranteed countdown. */
function publicLaunch(){
  progress.ensureSeeded();
  const d = store.ensureLoaded();
  const p = progress.computeProgress();
  const launch = d.settings.launch || {};
  const now = Date.now();
  const confirmedAt = launch.confirmed ? Date.parse(launch.confirmed) : NaN;
  let estimated = launch.estimated || null;
  if (!estimated) {
    try {
      const est = estimate.computeEstimate();
      if (est && est.projectedAt) estimated = est.projectedAt;
    } catch (e) {}
  }
  const estimatedAt = estimated ? Date.parse(estimated) : NaN;
  return {
    readinessPercent: p.percent,
    readiness: readinessLabel(p.percent),
    estimated: estimated,
    confirmed: launch.confirmed || null,
    note: launch.note || '',
    countdownMs: !Number.isNaN(confirmedAt) ? Math.max(0, confirmedAt - now) : null,
    estimatedCountdownMs: !Number.isNaN(estimatedAt) ? Math.max(0, estimatedAt - now) : null,
    hasConfirmedDate: !Number.isNaN(confirmedAt)
  };
}

function readinessLabel(percent){
  if (percent >= 90) return 'Launch-ready';
  if (percent >= 70) return 'Nearly there';
  if (percent >= 40) return 'Building';
  return 'Early build';
}


/* ---------- roadmap / ideas moderation ---------- */
function adminSetRoadmap(req, res, id, body, requestId){
  const d = store.ensureLoaded();
  const item = d.roadmapItems.find(r => r.id === id);
  if (!item) return sendJson(res, 404, { error: 'Unknown roadmap item.', code: 'NOT_FOUND', requestId }, requestId);
  const status = body && body.status;
  if (ROADMAP_STATUSES.indexOf(status) < 0){
    return sendJson(res, 400, { error: 'Invalid status: ' + ROADMAP_STATUSES.join(', '), code: 'BAD_STATUS', requestId }, requestId);
  }
  item.status = status;
  item.updatedAt = new Date().toISOString();
  store.persist();
  events.broadcast({ kind: 'roadmap', item });
  return sendJson(res, 200, { item, requestId }, requestId);
}

function adminSetIdeaStatus(req, res, id, body, requestId){
  const d = store.ensureLoaded();
  const idea = d.ideas.find(i => i.id === id);
  if (!idea) return sendJson(res, 404, { error: 'Unknown idea.', code: 'NOT_FOUND', requestId }, requestId);
  const status = body && body.status;
  if (community.IDEA_STATUSES.indexOf(status) < 0){
    return sendJson(res, 400, { error: 'Invalid status: ' + community.IDEA_STATUSES.join(', '), code: 'BAD_STATUS', requestId }, requestId);
  }
  idea.status = status;
  idea.updatedAt = new Date().toISOString();
  store.persist();
  events.broadcast({ kind: 'idea-status', idea: community.publicIdea(idea, null) });
  return sendJson(res, 200, { idea: community.publicIdea(idea, null), requestId }, requestId);
}

function adminListReports(req, res, requestId){
  const d = store.ensureLoaded();
  const open = d.reports.filter(r => r.status === 'open');
  return sendJson(res, 200, { reports: open.slice(-100), openCount: open.length, total: d.reports.length, requestId }, requestId);
}

function adminResolveReport(req, res, id, body, requestId){
  const d = store.ensureLoaded();
  const rep = d.reports.find(r => r.id === id);
  if (!rep) return sendJson(res, 404, { error: 'Unknown report.', code: 'NOT_FOUND', requestId }, requestId);
  const action = (body && body.action) || 'resolve';
  if (action === 'dismiss'){
    rep.status = 'dismissed';
  } else {
    rep.status = 'resolved';
  }
  rep.resolvedAt = new Date().toISOString();
  /* Optional enforcement: hide the offending content on resolve. */
  if (body && body.hide === true && rep.status === 'resolved'){
    hideReportedContent(d, rep);
  }
  store.persist();
  return sendJson(res, 200, { report: rep, requestId }, requestId);
}

function hideReportedContent(d, rep){
  if (rep.kind === 'chat'){
    const m = d.chatMessages.find(x => x.id === rep.targetId);
    if (m) m.deleted = true;
  } else if (rep.kind === 'comment'){
    const c = d.ideaComments.find(x => x.id === rep.targetId);
    if (c) c.deleted = true;
  }
  /* Ideas are never hard-deleted by moderation — they are set to
     declined so the status history stays visible and honest. */
}

function adminDeleteMessage(req, res, id, requestId){
  const d = store.ensureLoaded();
  const m = d.chatMessages.find(x => x.id === id);
  if (!m) return sendJson(res, 404, { error: 'Unknown message.', code: 'NOT_FOUND', requestId }, requestId);
  m.deleted = true;
  store.persist();
  events.broadcast({ kind: 'chat-deleted', id });
  return sendJson(res, 200, { deleted: true, id, requestId }, requestId);
}

function adminDeleteComment(req, res, id, requestId){
  const d = store.ensureLoaded();
  const c = d.ideaComments.find(x => x.id === id);
  if (!c) return sendJson(res, 404, { error: 'Unknown comment.', code: 'NOT_FOUND', requestId }, requestId);
  c.deleted = true;
  store.persist();
  return sendJson(res, 200, { deleted: true, id, requestId }, requestId);
}

function adminOverview(req, res, requestId){
  const d = store.ensureLoaded();
  const ideas = d.ideas.slice().reverse().map(i => ({
    id: i.id,
    title: i.title,
    description: i.description,
    status: i.status,
    votes: i.votes || 0,
    authorTag: i.authorTag || '',
    createdAt: i.createdAt,
    updatedAt: i.updatedAt,
    commentCount: d.ideaComments.filter(c => c.ideaId === i.id && !c.deleted).length
  }));
  const reports = d.reports.filter(r => r.status === 'open').slice(-100).reverse();
  const chatMessages = d.chatMessages.filter(m => !m.deleted).slice(-50).reverse().map(m => ({
    id: m.id,
    nickname: m.nickname,
    text: m.text,
    at: m.at,
    authorTag: m.authorTag || ''
  }));
  const comments = d.ideaComments.filter(c => !c.deleted).slice(-50).reverse().map(c => ({
    id: c.id,
    ideaId: c.ideaId,
    nickname: c.nickname,
    text: c.text,
    at: c.at,
    authorTag: c.authorTag || ''
  }));
  return sendJson(res, 200, {
    ideas,
    reports,
    chatMessages,
    comments,
    counts: {
      ideas: d.ideas.length,
      openReports: d.reports.filter(r => r.status === 'open').length,
      chatMessages: d.chatMessages.filter(m => !m.deleted).length,
      comments: d.ideaComments.filter(c => !c.deleted).length,
      waitlist: d.waitlist.length
    },
    requestId
  }, requestId);
}

/* ---------- estimate (deterministic effort model) ---------- */

function adminSetTaskEstimate(req, res, key, body, requestId){
  if (requireAdmin(req, res, requestId)) return;
  const r = estimate.setTaskEstimate(key, body || {}, 'admin');
  if (!r.ok) return sendJson(res, r.code === 'NOT_FOUND' ? 404 : 400, { error: r.error, code: r.code, requestId }, requestId);
  return sendJson(res, 200, { task: r.task, estimate: r.estimate, requestId }, requestId);
}

function adminSetTaskStatus(req, res, key, body, requestId){
  if (requireAdmin(req, res, requestId)) return;
  const r = estimate.setTaskStatus(key, body && body.status, 'admin');
  if (!r.ok) return sendJson(res, r.code === 'NOT_FOUND' ? 404 : 400, { error: r.error, code: r.code, requestId }, requestId);
  return sendJson(res, 200, { task: r.task, estimate: r.estimate, requestId }, requestId);
}

function adminSetBug(req, res, bugId, body, requestId){
  if (requireAdmin(req, res, requestId)) return;
  const id = bugId === 'new' ? null : bugId;
  const r = estimate.setBug(id, body || {}, 'admin');
  if (!r.ok) return sendJson(res, 400, { error: r.error, code: r.code, requestId }, requestId);
  return sendJson(res, 200, { bug: r.bug, estimate: r.estimate, requestId }, requestId);
}

function adminSetBlocker(req, res, blockerId, body, requestId){
  if (requireAdmin(req, res, requestId)) return;
  const id = blockerId === 'new' ? null : blockerId;
  const r = estimate.setBlocker(id, body || {}, 'admin');
  if (!r.ok) return sendJson(res, 400, { error: r.error, code: r.code, requestId }, requestId);
  return sendJson(res, 200, { blocker: r.blocker, estimate: r.estimate, requestId }, requestId);
}

function adminSetVelocity(req, res, body, requestId){
  if (requireAdmin(req, res, requestId)) return;
  const b = body || {};
  const r = estimate.setVelocity(b.observedHoursPerDay, b.samples, 'admin');
  if (!r.ok) return sendJson(res, 400, { error: r.error, code: r.code, requestId }, requestId);
  return sendJson(res, 200, { velocity: r.velocity, estimate: r.estimate, requestId }, requestId);
}

/* CSV export of waitlist EMAILS is admin-only. Public API exposes
   only the count, never addresses. */
function adminExportWaitlist(req, res, requestId){
  const d = store.ensureLoaded();
  /* Spreadsheet-formula-injection guard: a nickname like
     =cmd|' /c calc'!A1 would execute when an admin opens the CSV in
     Excel/Sheets. Neutralize any leading =, +, -, @, tab or CR by
     prefixing a single quote, then quote+escape as usual. */
  const esc = (s) => {
    let v = String(s == null ? '' : s);
    if (/^[=+\-@\t\r]/.test(v)) v = "'" + v;
    return '"' + v.replace(/"/g, '""') + '"';
  };
  const lines = ['email,nickname,joinedAt,consentAt,source'];
  for (const w of d.waitlist){
    lines.push([esc(w.email), esc(w.nickname), esc(w.joinedAt), esc(w.consentAt), esc(w.source)].join(','));
  }
  res.writeHead(200, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': 'attachment; filename="bip-waitlist.csv"',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end('\ufeff' + lines.join('\r\n'));
  /* Return TRUE: this handler writes the response itself (CSV, not JSON),
     so it must still tell the dispatcher "handled". Returning undefined
     made the dispatcher fall through and overwrite the CSV with a 404. */
  return true;
}

module.exports = {
  requireAdmin,
  adminVerifyMilestone, adminReopenMilestone, adminSetMilestone, adminUpdateCriteria,
  adminSetLaunch, publicLaunch, readinessLabel,
  adminSetRoadmap, adminSetIdeaStatus,
  adminListReports, adminResolveReport,
  adminDeleteMessage, adminDeleteComment, adminOverview, adminExportWaitlist,
  adminSetTaskEstimate, adminSetTaskStatus, adminSetBug, adminSetBlocker, adminSetVelocity
};
