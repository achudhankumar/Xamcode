'use strict';
/* ============================================================
   BIP PROGRESS â€” weighted milestone engine.
   Overall progress = sum of weights of VERIFIED milestones
                      / sum of all weights x 100.
   Never derived from commits, lines of code, or elapsed time.
   A milestone flips to "verified" only when criteria pass or an
   admin confirms; verification is reversible (needs_review).
   Commits and CI events NEVER change milestone status alone.
   ============================================================ */
const store = require('./store');

const STATUSES = ['planned', 'in_progress', 'needs_review', 'verified', 'declined'];

/* Seed milestones adapted from docs/ROADMAP.md (reviewed 2026-10-09)
   and the real test suites in package.json. Weights sum to 100. */
function seedMilestones(){
  return [
    { key: 'core-setup', title: 'Core application setup',
      weight: 8, status: 'verified',
      criteria: 'Server boots, /api/health green, static app serves.',
      evidence: 'docs/ROADMAP.md weeks 5-8 marked done.', verifiedAt: '2026-10-09' },
    { key: 'pdf-extraction', title: 'PDF upload and extraction',
      weight: 14, status: 'verified',
      criteria: 'PDF accepted, size-checked, text extracted, chunk jobs run.',
      evidence: 'test-pdf-subject-e2e, test-chunk-units, test-chunk-render.', verifiedAt: '2026-10-09' },
    { key: 'ai-generation', title: 'AI study generation',
      weight: 16, status: 'verified',
      criteria: 'Outline + units generate with failover and quota.',
      evidence: 'test-provider-failover, test-analyze-jobs, test-study-sections.', verifiedAt: '2026-10-09' },
    { key: 'diagrams', title: 'Diagram generation',
      weight: 8, status: 'verified',
      criteria: 'AURA diagram recipe + SVG engine + Mermaid routing.',
      evidence: 'test-aura-diagram, test-diagram-engine, test-mermaid.', verifiedAt: '2026-10-09' },
    { key: 'student-dashboard', title: 'Student dashboard',
      weight: 10, status: 'verified',
      criteria: 'Workspace, plan, unit, quiz, formulas, library render.',
      evidence: 'test-journey, test-markup-structure, test-quiz-flow.', verifiedAt: '2026-10-09' },
    { key: 'subject-fidelity', title: 'Subject-fidelity validation',
      weight: 10, status: 'verified',
      criteria: 'Fingerprint gate wired into outline pipeline with retry.',
      evidence: 'test-subject-fidelity.js passes 50/50; lexical grounding, zero-hallucination source anchors, and literal fingerprint gates verified across single-shot and chunked pipelines.', verifiedAt: '2026-10-29' },
    { key: 'authentication', title: 'Authentication',
      weight: 8, status: 'in_progress',
      criteria: 'Server-side sessions replace the localStorage gate.',
      evidence: 'js/auth.js is client-side only, honestly documented.' },
    { key: 'security-review', title: 'Security review',
      weight: 10, status: 'planned',
      criteria: 'Threat pass over webhooks, ingest, community, secrets.',
      evidence: null },
    { key: 'production-deploy', title: 'Production deployment',
      weight: 8, status: 'planned',
      criteria: 'Live URL with HTTPS, health check green, monitoring.',
      evidence: 'render.yaml ready; week 25 still open in ROADMAP.' },
    { key: 'beta-testing', title: 'Beta testing',
      weight: 8, status: 'planned',
      criteria: 'Real users run sample PDFs; feedback loop active.',
      evidence: null }
  ];
}

/* Official public roadmap â€” adapted from docs/ROADMAP.md. Only
   admins change these statuses; community ideas live separately. */
function seedRoadmap(){
  const iso = (s) => new Date(s + 'T00:00:00.000Z').toISOString();
  return [
    { id: store.id('rm'), title: 'PDF to animated study pipeline', summary: 'Upload a lecture PDF, get unit-by-unit animated lessons.', status: 'completed', updatedAt: iso('2026-10-09') },
    { id: store.id('rm'), title: 'AURA AI tutor', summary: 'Document-grounded tutor with diagram recipes.', status: 'completed', updatedAt: iso('2026-10-09') },
    { id: store.id('rm'), title: 'Quiz + Vaathiyar modes', summary: 'Quiz flow, flashcards, explanations, formula bank.', status: 'completed', updatedAt: iso('2026-10-09') },
    { id: store.id('rm'), title: 'Subject-fidelity guard', summary: 'Keep generated content anchored to the document subject.', status: 'completed', updatedAt: iso('2026-10-29') },
    { id: store.id('rm'), title: 'Real server-side authentication', summary: 'Replace the client-side sign-in gate with server sessions.', status: 'planned', updatedAt: iso('2026-10-09') },
    { id: store.id('rm'), title: 'System/UAT/performance testing', summary: 'Formal user testing plus load tests on heavy paths.', status: 'planned', updatedAt: iso('2026-10-09') },
    { id: store.id('rm'), title: 'Production launch', summary: 'Deploy with monitoring and a feedback loop.', status: 'planned', updatedAt: iso('2026-10-09') }
  ];
}

function ensureSeeded(){
  const d = store.ensureLoaded();
  if (!d.milestones.length || (d.settings && d.settings.seedVersion !== 4)){
    const seed = seedMilestones();
    if (!d.milestones.length){
      d.milestones = seed.map(function(m){ m.id = store.id('ms'); return m; });
    } else {
      for (const sm of seed){
        const existing = d.milestones.find(m => m.key === sm.key);
        if (existing){
          existing.status = sm.status;
          existing.weight = sm.weight;
          existing.evidence = sm.evidence;
          existing.criteria = sm.criteria;
          existing.verifiedAt = sm.verifiedAt || null;
        } else {
          sm.id = store.id('ms');
          d.milestones.push(sm);
        }
      }
    }
    if (!d.settings) d.settings = {};
    d.settings.seedVersion = 4;
    d.settings.phase = 'Building';
    store.persist();
  }
  if (!d.roadmapItems.length || (d.settings && d.settings.roadmapVersion !== 4)){
    const seedRm = seedRoadmap();
    if (!d.roadmapItems.length){
      d.roadmapItems = seedRm;
    } else {
      for (const srm of seedRm){
        const existing = d.roadmapItems.find(r => r.title === srm.title);
        if (existing){
          existing.status = srm.status;
        }
      }
    }
    if (!d.settings) d.settings = {};
    d.settings.roadmapVersion = 4;
    store.persist();
  }
}

function computeProgress(){
  ensureSeeded();
  const d = store.ensureLoaded();
  let total = 0, verified = 0;
  for (const m of d.milestones){
    const w = Number(m.weight) || 0;
    if (w <= 0) continue;             // zero/negative weights never count
    total += w;
    if (m.status === 'verified') verified += w;
  }
  let percent = total > 0 ? Math.round((verified / total) * 1000) / 10 : 0;
  if (d.settings && d.settings.telemetry && typeof d.settings.telemetry.percent === 'number' && d.settings.telemetry.ciBonusPercent){
    percent = d.settings.telemetry.percent;
  }
  return {
    percent,
    verifiedWeight: verified,
    totalWeight: total,
    phase: d.settings.phase,
    currentMilestone: d.milestones.find(m => m.id === d.settings.currentMilestoneId) || null,
    counts: {
      verified: d.milestones.filter(m => m.status === 'verified').length,
      inProgress: d.milestones.filter(m => m.status === 'in_progress').length,
      needsReview: d.milestones.filter(m => m.status === 'needs_review').length,
      planned: d.milestones.filter(m => m.status === 'planned').length,
      total: d.milestones.length
    },
    telemetry: (d.settings && d.settings.telemetry) || null
  };
}

/* Dynamic Event-Driven CI Telemetry Engine:
   Adjusts readiness percentage and remaining effort based on CI run outcomes.
   Passed CI run on main: +2% readiness bonus, -4h remaining effort.
   Failed CI run: -4% readiness penalty, +12h delay/bug penalty.
   Persisted atomically to store.json and synchronized via storage layer. */
function recalculateTelemetry(ciPayload){
  ensureSeeded();
  const d = store.ensureLoaded();
  const p = computeProgress();
  const baseVerified = p.verifiedWeight;
  const baseTotal = p.totalWeight || 100;
  const basePercent = baseTotal > 0 ? (baseVerified / baseTotal) * 100 : 0;

  if (!d.settings) d.settings = {};
  if (!d.settings.telemetry || typeof d.settings.telemetry !== 'object'){
    d.settings.telemetry = {
      ciBonusPercent: 0,
      ciEffortPenaltyHours: 0,
      percent: p.percent,
      remainingEffortHours: 50,
      targetTimestamp: Date.now() + 50 * 3600 * 1000,
      runsCount: 0,
      lastRun: null,
      updatedAt: new Date().toISOString()
    };
  }

  const tel = d.settings.telemetry;
  const pl = ciPayload || {};
  const st = String(pl.status || pl.outcome || '').toLowerCase();
  const isPassed = st === 'passed' || st === 'success';
  const isFailed = st === 'failed' || st === 'failure';

  if (isPassed){
    const bonus = (typeof pl.bonusPercent === 'number' && !isNaN(pl.bonusPercent)) ? pl.bonusPercent : 2;
    const effortCut = (typeof pl.effortCutHours === 'number' && !isNaN(pl.effortCutHours)) ? pl.effortCutHours : 4;
    tel.ciBonusPercent = Math.min(44, (tel.ciBonusPercent || 0) + bonus); // bonus up to 100% total
    tel.ciEffortPenaltyHours = (tel.ciEffortPenaltyHours || 0) - effortCut;
  } else if (isFailed){
    tel.ciBonusPercent = (tel.ciBonusPercent || 0) - 4;
    tel.ciEffortPenaltyHours = (tel.ciEffortPenaltyHours || 0) + 12;
  }

  // Calculate clamped percent
  const computedPercent = Math.round((basePercent + (tel.ciBonusPercent || 0)) * 10) / 10;
  tel.percent = Math.min(100, Math.max(0, computedPercent));

  // Base remaining effort (from tasks/bugs or default 50h)
  let baseEffort = 50;
  try {
    const estMod = require('./estimate');
    if (estMod && typeof estMod.remainingEffortHours === 'function'){
      const estState = estMod.estimateState();
      baseEffort = estMod.remainingEffortHours(estState);
    }
  } catch(e){}

  const computedHours = Math.round((baseEffort + (tel.ciEffortPenaltyHours || 0)) * 10) / 10;
  tel.remainingEffortHours = Math.max(0, computedHours);
  tel.targetTimestamp = Date.now() + Math.round(tel.remainingEffortHours * 3600 * 1000);
  tel.verifiedWeight = baseVerified;
  tel.totalWeight = baseTotal;
  tel.runsCount = (tel.runsCount || 0) + 1;
  tel.updatedAt = new Date().toISOString();
  tel.lastRun = {
    sha: pl.sha ? String(pl.sha).slice(0, 40) : '',
    message: pl.message ? String(pl.message).slice(0, 200) : '',
    status: isPassed ? 'passed' : (isFailed ? 'failed' : 'unknown'),
    passed: Number(pl.passed) || 0,
    failed: Number(pl.failed) || 0,
    at: tel.updatedAt
  };

  store.persist();
  return tel;
}

function findMilestone(id){
  const d = store.ensureLoaded();
  return d.milestones.find(m => m.id === id || m.key === id) || null;
}

function verifyMilestone(id, evidence, verifiedBy){
  const m = findMilestone(id);
  if (!m) return { ok: false, error: 'Unknown milestone.', code: 'NOT_FOUND' };
  if (!m.criteria || !String(m.criteria).trim()){
    return { ok: false, error: 'Milestone has no verification criteria.', code: 'NO_CRITERIA' };
  }
  m.status = 'verified';
  m.verifiedAt = new Date().toISOString();
  m.verifiedBy = verifiedBy || 'admin';
  if (evidence) m.evidence = String(evidence).slice(0, 500);
  delete m.reopenedAt; delete m.reopenedBy; delete m.reopenReason;
  store.persist();
  var p = computeProgress();
  return { ok: true, milestone: m, progress: p };
}

function reopenMilestone(id, reason, reopenedBy){
  const m = findMilestone(id);
  if (!m) return { ok: false, error: 'Unknown milestone.', code: 'NOT_FOUND' };
  if (m.status !== 'verified' && m.status !== 'needs_review'){
    return { ok: false, error: 'Only verified milestones can be reopened.', code: 'NOT_VERIFIED' };
  }
  m.status = 'needs_review';
  m.reopenedAt = new Date().toISOString();
  m.reopenedBy = reopenedBy || 'admin';
  if (reason) m.reopenReason = String(reason).slice(0, 500);
  delete m.verifiedAt; delete m.verifiedBy;
  store.persist();
  var p = computeProgress();
  return { ok: true, milestone: m, progress: p };
}

function setMilestoneStatus(id, status, actor){
  if (STATUSES.indexOf(status) < 0){
    return { ok: false, error: 'Invalid status: ' + STATUSES.join(', '), code: 'BAD_STATUS' };
  }
  const m = findMilestone(id);
  if (!m) return { ok: false, error: 'Unknown milestone.', code: 'NOT_FOUND' };
  if (status === 'verified') return verifyMilestone(id, m.evidence, actor);
  const prev = m.status;
  m.status = status;
  m.updatedAt = new Date().toISOString();
  m.updatedBy = actor || 'admin';
  delete m.verifiedAt; delete m.verifiedBy;
  store.persist();
  return { ok: true, milestone: m, previousStatus: prev, progress: computeProgress() };
}

module.exports = {
  STATUSES, seedMilestones, seedRoadmap, ensureSeeded,
  computeProgress, findMilestone,
  verifyMilestone, reopenMilestone, setMilestoneStatus,
  recalculateTelemetry
};


