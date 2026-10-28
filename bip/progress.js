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
      weight: 10, status: 'in_progress',
      criteria: 'Fingerprint gate wired into outline pipeline with retry.',
      evidence: 'Guard helpers exist; integration marked NEXT pass.' },
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
    { id: store.id('rm'), title: 'Subject-fidelity guard', summary: 'Keep generated content anchored to the document subject.', status: 'in_progress', updatedAt: iso('2026-10-09') },
    { id: store.id('rm'), title: 'Real server-side authentication', summary: 'Replace the client-side sign-in gate with server sessions.', status: 'planned', updatedAt: iso('2026-10-09') },
    { id: store.id('rm'), title: 'System/UAT/performance testing', summary: 'Formal user testing plus load tests on heavy paths.', status: 'planned', updatedAt: iso('2026-10-09') },
    { id: store.id('rm'), title: 'Production launch', summary: 'Deploy with monitoring and a feedback loop.', status: 'planned', updatedAt: iso('2026-10-09') }
  ];
}

function ensureSeeded(){
  const d = store.ensureLoaded();
  if (!d.milestones.length || (d.settings && d.settings.seedVersion !== 3)){
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
    d.settings.seedVersion = 3;
    d.settings.phase = 'Building';
    store.persist();
  }
  if (!d.roadmapItems.length || (d.settings && d.settings.roadmapVersion !== 3)){
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
    d.settings.roadmapVersion = 3;
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
  const percent = total > 0 ? Math.round((verified / total) * 1000) / 10 : 0;
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
    }
  };
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
  verifyMilestone, reopenMilestone, setMilestoneStatus
};


