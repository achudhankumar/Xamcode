'use strict';
/* ============================================================
   BIP ESTIMATE â€” deterministic effort model for launch estimation.
   Remaining-effort model seeded from docs/REMAINING-ROADMAP.md;
   bug severityâ†’repair effort mapping; blocker dedup; velocity
   calibration; projected launch date + change history.
   ============================================================ */
const store = require('./store');
const progress = require('./progress');
const SEVERITY_EFFORT = { critical: 16, high: 8, medium: 4, low: 2 };
const VALID_SEVERITIES = Object.keys(SEVERITY_EFFORT);
const NOMINAL_VELOCITY_HOURS_PER_DAY = 8;
const HOURS_PER_CALENDAR_DAY = 8;
function seedTasks() {
  const day0 = '2026-10-09';
  return [
    { key: 'load-testing', title: 'Load & performance testing', effortHours: 8, remainingHours: 8, status: 'todo', estimatedBy: 'admin', estimatedAt: day0 + 'T00:00:00.000Z', lastRecalculatedAt: day0 + 'T00:00:00.000Z' },
    { key: 'large-pdf-hardening', title: 'Large-PDF hardening follow-ups', effortHours: 6, remainingHours: 6, status: 'todo', estimatedBy: 'admin', estimatedAt: day0 + 'T00:00:00.000Z', lastRecalculatedAt: day0 + 'T00:00:00.000Z' },
    { key: 'uat', title: 'Formal UAT with real users', effortHours: 12, remainingHours: 12, status: 'todo', estimatedBy: 'admin', estimatedAt: day0 + 'T00:00:00.000Z', lastRecalculatedAt: day0 + 'T00:00:00.000Z' },
    { key: 'kpi-definitions', title: 'KPI definitions (Week 1 gap)', effortHours: 4, remainingHours: 4, status: 'todo', estimatedBy: 'admin', estimatedAt: day0 + 'T00:00:00.000Z', lastRecalculatedAt: day0 + 'T00:00:00.000Z' },
    { key: 'production-deploy-prep', title: 'Production deploy prep', effortHours: 6, remainingHours: 6, status: 'todo', estimatedBy: 'admin', estimatedAt: day0 + 'T00:00:00.000Z', lastRecalculatedAt: day0 + 'T00:00:00.000Z' },
    { key: 'production-deploy', title: 'Deploy to production', effortHours: 8, remainingHours: 8, status: 'todo', estimatedBy: 'admin', estimatedAt: day0 + 'T00:00:00.000Z', lastRecalculatedAt: day0 + 'T00:00:00.000Z' },
    { key: 'monitor-iterate', title: 'Monitor & iterate', effortHours: 6, remainingHours: 6, status: 'todo', estimatedBy: 'admin', estimatedAt: day0 + 'T00:00:00.000Z', lastRecalculatedAt: day0 + 'T00:00:00.000Z' }
  ];
}
function estimateState() {
  const d = store.ensureLoaded();
  if (!d.settings.estimate || typeof d.settings.estimate !== 'object') {
    d.settings.estimate = emptyEstimate();
    store.persist();
  }
  return d.settings.estimate;
}
function emptyEstimate() {
  return { tasks: seedTasks(), bugs: [], blockers: [],
    velocity: { observedHoursPerDay: null, nominalHoursPerDay: NOMINAL_VELOCITY_HOURS_PER_DAY, calibratedFrom: null, samples: [] },
    history: [] };
}
function num(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }
function nowIso() { return new Date().toISOString(); }
function addDays(iso, days) { const d = new Date(iso); d.setUTCDate(d.getUTCDate() + days); return d.toISOString(); }
function findTask(state, key) { return state.tasks.find(t => t.key === key || t.id === key) || null; }
function findBug(state, id) { return state.bugs.find(b => b.id === id) || null; }
function findBlocker(state, id) { return state.blockers.find(b => b.id === id) || null; }

function bugEffortHours(bug) {
  if (bug.repairEffortHours != null && Number.isFinite(Number(bug.repairEffortHours))) {
    return Math.max(0, Number(bug.repairEffortHours));
  }
  const sev = String(bug.severity || 'medium').toLowerCase();
  return SEVERITY_EFFORT[sev] != null ? SEVERITY_EFFORT[sev] : SEVERITY_EFFORT.medium;
}
function effectiveVelocityHoursPerDay(state) {
  const v = state.velocity;
  if (v.observedHoursPerDay != null && v.observedHoursPerDay > 0) return v.observedHoursPerDay;
  return v.nominalHoursPerDay || NOMINAL_VELOCITY_HOURS_PER_DAY;
}
function remainingEffortHours(state) {
  let hours = 0;
  for (const t of state.tasks) {
    const st = String(t.status || 'todo').toLowerCase();
    if (st === 'done' || st === 'closed' || st === 'resolved') continue;
    hours += Math.max(0, num(t.remainingHours, num(t.effortHours, 0)));
  }
  const openBugTitles = [];
  for (const b of state.bugs) {
    const st = String(b.status || 'open').toLowerCase();
    if (st === 'fixed' || st === 'closed' || st === 'resolved') continue;
    hours += bugEffortHours(b);
    openBugTitles.push(String(b.title || '').toLowerCase());
  }
  for (const bl of state.blockers) {
    if (bl.resolved) continue;
    const title = String(bl.title || '').toLowerCase();
    const overlaps = openBugTitles.some(bt => title && bt && shareKeyword(title, bt));
    if (overlaps) continue;
    hours += Math.max(0, num(bl.effortHours, 0));
  }
  return Math.round(hours * 10) / 10;
}
function shareKeyword(a, b) {
  const words = (s) => String(s || '').split(/\s+/).filter(w => w.length > 3);
  const aw = new Set(words(a)); let hit = 0;
  for (const w of words(b)) if (aw.has(w)) hit++;
  return hit >= 1;
}
function projectLaunchDate(state, remainingHours) {
  const vel = effectiveVelocityHoursPerDay(state);
  if (remainingHours <= 0 || vel <= 0) return null;
  const calendarDays = remainingHours / (vel / HOURS_PER_CALENDAR_DAY);
  return addDays(nowIso(), Math.ceil(calendarDays));
}
function confidence(state) {
  const v = state.velocity; let score = 0; let max = 1;
  if (v.observedHoursPerDay != null && v.samples && v.samples.length > 0) score += 1;
  const doneTasks = state.tasks.filter(t => String(t.status || '').toLowerCase() === 'done').length;
  max += 1; if (doneTasks > 0) score += 1;
  if (max === 0) return 0;
  return Math.round((score / max) * 100);
}


function computeEstimate() {
  const state = estimateState();
  const remaining = remainingEffortHours(state);
  const vel = effectiveVelocityHoursPerDay(state);
  const calendarDays = remaining > 0 && vel > 0 ? remaining / (vel / HOURS_PER_CALENDAR_DAY) : 0;
  const projectedAt = projectLaunchDate(state, remaining);
  const conf = confidence(state);
  const doneTasks = state.tasks.filter(t => String(t.status || '').toLowerCase() === 'done').length;
  const totalTasks = state.tasks.length;
  const openBugs = state.bugs.filter(b => !/^(fixed|closed|resolved)$/.test(String(b.status || '').toLowerCase())).length;
  const openBlockers = state.blockers.filter(b => !b.resolved).length;
  return {
    remainingHours: remaining, velocityHoursPerDay: vel,
    nominalVelocityHoursPerDay: state.velocity.nominalHoursPerDay || NOMINAL_VELOCITY_HOURS_PER_DAY,
    observedVelocityHoursPerDay: state.velocity.observedHoursPerDay || null,
    projectedAt, estimatedLaunchDate: projectedAt, confidencePercent: conf,
    readinessPercent: progress.computeProgress().percent,
    counts: { tasksDone: doneTasks, tasksTotal: totalTasks, openBugs, openBlockers },
    at: nowIso()
  };
}
function recordSnapshot(state, estimate, note) {
  if (!Array.isArray(state.history)) state.history = [];
  state.history.push({ at: nowIso(), remainingHours: estimate.remainingHours, projectedAt: estimate.projectedAt, readinessPercent: estimate.readinessPercent, confidencePercent: estimate.confidencePercent, note: note ? String(note).slice(0, 200) : '' });
  if (state.history.length > 200) state.history = state.history.slice(-200);
  return state.history[state.history.length - 1];
}


function setTaskEstimate(key, fields, actor) {
  const state = estimateState();
  const t = findTask(state, key);
  if (!t) return { ok: false, error: 'Unknown task key.', code: 'NOT_FOUND' };
  if (fields.effortHours != null) { const eh = num(fields.effortHours, null); if (eh == null || eh < 0) return { ok: false, error: 'effortHours must be >= 0.', code: 'BAD_VALUE' }; t.effortHours = eh; }
  if (fields.remainingHours != null) { const rh = num(fields.remainingHours, null); if (rh == null || rh < 0) return { ok: false, error: 'remainingHours must be >= 0.', code: 'BAD_VALUE' }; t.remainingHours = rh; }
  if (fields.title) t.title = String(fields.title).slice(0, 120);
  if (actor) t.estimatedBy = String(actor).slice(0, 80);
  t.estimatedAt = nowIso(); t.lastRecalculatedAt = nowIso();
  const est = computeEstimate(); recordSnapshot(state, est, 'task estimate set: ' + key); store.persist();
  return { ok: true, task: t, estimate: est };
}

function setBug(bugId, fields, actor) {
  const f = fields || {};
  let sev = null;
  if (f.severity != null) { sev = String(f.severity).toLowerCase(); if (VALID_SEVERITIES.indexOf(sev) < 0) return { ok: false, error: 'Invalid severity: ' + VALID_SEVERITIES.join(', '), code: 'BAD_SEVERITY' }; }
  let preEh = null;
  if (f.repairEffortHours != null) { preEh = num(f.repairEffortHours, null); if (preEh == null || preEh < 0) return { ok: false, error: 'repairEffortHours must be >= 0.', code: 'BAD_VALUE' }; }
  const state = estimateState();
  let b = findBug(state, bugId); const isNew = !b;
  if (isNew) { b = { id: store.id('bug'), title: '', severity: 'medium', repairEffortHours: null, isLaunchBlocker: false, status: 'open', reportedAt: nowIso() }; state.bugs.push(b); }
  if (fields.title != null) b.title = String(fields.title).slice(0, 200);
  if (sev != null) b.severity = sev;
  if (preEh != null) b.repairEffortHours = preEh;
  if (fields.isLaunchBlocker != null) b.isLaunchBlocker = !!fields.isLaunchBlocker;
  if (f.status != null) b.status = String(f.status).slice(0, 40);
  if (actor) b.reportedBy = String(actor).slice(0, 80);
  const est = computeEstimate(); recordSnapshot(state, est, isNew ? 'bug filed: ' + b.title : 'bug updated: ' + b.id); store.persist();
  return { ok: true, bug: b, estimate: est };
}

function setBlocker(blockerId, fields, actor) {
  const fb = fields || {};
  let beh = null;
  if (fb.effortHours != null) { beh = num(fb.effortHours, null); if (beh == null || beh < 0) return { ok: false, error: 'effortHours must be >= 0.', code: 'BAD_VALUE' }; }
  const state = estimateState();
  let bl = findBlocker(state, blockerId); const isNew = !bl;
  if (isNew) { bl = { id: store.id('bl'), title: '', effortHours: 0, resolved: false }; state.blockers.push(bl); }
  if (fields.title != null) bl.title = String(fields.title).slice(0, 200);
  if (beh != null) bl.effortHours = beh;
  if (fb.resolved != null) bl.resolved = !!fb.resolved;
  if (actor) bl.updatedBy = String(actor).slice(0, 80);
  bl.updatedAt = nowIso(); const est = computeEstimate(); recordSnapshot(state, est, isNew ? 'blocker added: ' + bl.title : 'blocker updated: ' + bl.id); store.persist();
  return { ok: true, blocker: bl, estimate: est };
}
function setVelocity(observedHoursPerDay, samples, actor) {
  const state = estimateState(); const v = state.velocity;
  if (observedHoursPerDay != null) { const oh = num(observedHoursPerDay, null); if (oh == null || oh <= 0) return { ok: false, error: 'observedHoursPerDay must be > 0.', code: 'BAD_VALUE' }; v.observedHoursPerDay = oh; v.calibratedFrom = nowIso(); }
  if (Array.isArray(samples)) { v.samples = samples.slice(0, 50).map(s => ({ at: s.at || nowIso(), hours: num(s.hours, 0) })); if (v.observedHoursPerDay == null && v.samples.length > 0) { const total = v.samples.reduce((a, s) => a + s.hours, 0); v.observedHoursPerDay = total / v.samples.length; v.calibratedFrom = nowIso(); } }
  if (actor) v.calibratedBy = String(actor).slice(0, 80);
  const est = computeEstimate(); recordSnapshot(state, est, 'velocity calibrated: ' + v.observedHoursPerDay + ' h/day'); store.persist();
  return { ok: true, velocity: v, estimate: est };
}
function setTaskStatus(key, status, actor) {
  const state = estimateState(); const t = findTask(state, key);
  if (!t) return { ok: false, error: 'Unknown task key.', code: 'NOT_FOUND' };
  const st = String(status || '').toLowerCase();
  const valid = ['todo', 'in_progress', 'blocked', 'done', 'closed', 'resolved'];
  if (valid.indexOf(st) < 0) return { ok: false, error: 'Invalid status: ' + valid.join(', '), code: 'BAD_STATUS' };
  t.status = st; if (actor) t.updatedBy = String(actor).slice(0, 80);
  t.updatedAt = nowIso();
  if (st === 'done' || st === 'closed' || st === 'resolved') t.remainingHours = 0;
  const est = computeEstimate(); recordSnapshot(state, est, 'task status: ' + key + ' -> ' + st); store.persist();
  return { ok: true, task: t, estimate: est };
}
function markVerifiedComplete(key, actor) {
  const state = estimateState(); const t = findTask(state, key);
  if (!t) return { ok: false, error: 'Unknown task key.', code: 'NOT_FOUND' };
  const m = progress.findMilestone(key);
  if (!m) return { ok: false, error: 'No BIP milestone for task key.', code: 'NO_MILESTONE' };
  if (m.status !== 'verified') return { ok: false, error: 'Milestone not verified yet.', code: 'NOT_VERIFIED' };
  return setTaskStatus(key, 'done', actor);
}
function history(limit) {
  const state = estimateState();
  const n = Math.max(1, Math.min(200, num(limit, 50)));
  return state.history.slice(-n).reverse();
}
module.exports = {
  SEVERITY_EFFORT, NOMINAL_VELOCITY_HOURS_PER_DAY, HOURS_PER_CALENDAR_DAY,
  estimateState, emptyEstimate, computeEstimate, remainingEffortHours,
  effectiveVelocityHoursPerDay, projectLaunchDate, confidence, recordSnapshot,
  setTaskEstimate, setBug, setBlocker, setVelocity, setTaskStatus,
  markVerifiedComplete, history, findTask, findBug, findBlocker, seedTasks
};
