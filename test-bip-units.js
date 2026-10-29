'use strict';
/* BIP unit suite â€” pure module tests (no HTTP, no network).
   Covers: weighted progress + reversible verification, webhook HMAC
   + idempotency + field allowlisting, community validation + vote
   integrity, waitlist privacy, and launch tri-state math.
   Each test case points BIP_DATA_DIR at a scratch dir so the real
   bip-data/ store is never touched.
   Run: node test-bip-units.js */
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

let pass = 0, fail = 0;
function ok(c, m){ if (c){ pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m); } }

function freshDataDir(){
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bip-units-'));
  process.env.BIP_DATA_DIR = dir;
  for (const mod of ['bip/store', 'bip/progress', 'bip/events', 'bip/community', 'bip/admin', 'bip/estimate']) {
    try { delete require.cache[require.resolve('./' + mod)]; } catch (e) {}
  }
  try { delete require.cache[require.resolve('./bip/util')]; } catch (e) {}
  const store = require('./bip/store');
  store.reset();
  return dir;
}
const dirs = [];



/* ================= cases ================= */
(function main(){
  var crypto2 = require('crypto');

  var d1 = freshDataDir(); dirs.push(d1);
  var progress = require('./bip/progress');
  var store1 = require('./bip/store');
  var r = progress.computeProgress();
  ok(r.totalWeight === 100, 'milestone weights sum to 100 (got ' + r.totalWeight + ')');
  ok(r.verifiedWeight === 97, 'seeded verified weight is 97 (got ' + r.verifiedWeight + ')');
  ok(r.percent === 97, 'seeded progress is 97pct (got ' + r.percent + ')');
  ok(r.counts.total === 10 && r.counts.verified === 9, 'seeded counts 9 verified of 10');
  ok(r.phase === 'AI Verification & Smoke Test', 'seeded phase is AI Verification & Smoke Test');

  var target = store1.ensureLoaded().milestones.filter(function(m){ return m.status === 'in_progress'; })[0];
  var v = progress.verifyMilestone(target.id, 'unit evidence', 'unit-test');
  ok(v.ok && v.milestone.status === 'verified', 'verify flips in_progress to verified');
  var after = progress.computeProgress();
  ok(after.percent > 97, 'progress rises after verification (' + after.percent + ')');
  var ro = progress.reopenMilestone(target.id, 'regression found', 'unit-test');
  ok(ro.ok && ro.milestone.status === 'needs_review', 'reopen flips verified to needs_review');
  var back = progress.computeProgress();
  ok(back.percent === 97, 'progress returns to 97 after reopen (got ' + back.percent + ')');
  ok(progress.verifyMilestone('nope', 'x', 't').ok === false, 'verify unknown milestone fails');
  ok(progress.setMilestoneStatus(target.id, 'bogus', 't').ok === false, 'invalid status rejected');
  var commitsNeverVerify = store1.ensureLoaded().milestones.filter(function(m){ return m.status === 'verified'; }).length;
  ok(commitsNeverVerify === 9, 'commits alone verified nothing (still 9 verified)');

  var d2 = freshDataDir(); dirs.push(d2);
  var events = require('./bip/events');
  process.env.GITHUB_WEBHOOK_SECRET = 'unit-test-secret-123';
  var raw = JSON.stringify({ ref: 'refs/heads/main', commits: [{ id: 'abc123def456', message: 'fix: thing' }] });
  var sig = 'sha256=' + crypto2.createHmac('sha256', process.env.GITHUB_WEBHOOK_SECRET).update(Buffer.from(raw, 'utf8')).digest('hex');
  ok(events.verifyGitHubSignature(raw, sig).ok === true, 'valid webhook signature verifies');
  ok(events.verifyGitHubSignature(raw, 'sha256=dead').ok === false, 'forged signature rejected');
  delete process.env.GITHUB_WEBHOOK_SECRET;
  ok(events.verifyGitHubSignature(raw, sig).configured === false, 'missing secret reports not-configured');
  var mapped = events.mapGitHubEvent('push', null, JSON.parse(raw), 'deliv-1');
  ok(mapped.length === 1 && mapped[0].ref === 'abc123d', 'push maps to commit event with short sha');
  ok(!('commits' in mapped[0]), 'mapped event carries allowlisted fields only');
  var leak = events.mapGitHubEvent('push', null, { ref: 'refs/heads/main', commits: [{ id: 'aaa', message: 'oops ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ1234' }] }, 'deliv-2');
  var rec1 = events.recordDevEvent(leak[0]);
  ok(rec1.ok && rec1.event.summary.indexOf('ghp_') < 0, 'secret-looking token redacted from summary');
  ok(events.recordDevEvent({ type: 'build_passed', summary: 'CI green', dedupeKey: 'unit-k1' }).ok === true, 'first delivery stored');
  ok(events.recordDevEvent({ type: 'build_passed', summary: 'CI green', dedupeKey: 'unit-k1' }).duplicate === true, 'duplicate delivery key stored once');
  ok(events.latestActivity(50).filter(function(e){ return e.summary === 'CI green'; }).length === 1, 'no duplicate event in feed');
  ok(events.statusBoard().build.state === 'passed', 'status board reflects build_passed');
  ok(events.integrationStatus().live === false, 'integration honestly not-live without secrets');

  // Render deployment webhook verification & mapping tests
  var rawRender = JSON.stringify({ type: 'deploy_started', data: { serviceName: 'xamcode-ai', serviceId: 'srv-123' }, timestamp: '2026-10-19T10:00:00Z' });
  var renderSecret = 'whsec_' + Buffer.from('my-render-secret-key-1234567890123456').toString('base64');
  process.env.RENDER_WEBHOOK_SECRET = renderSecret;
  var nowSec = Math.floor(Date.now() / 1000);
  var renderId = 'msg-deploy-001';
  var keyBuf = Buffer.from('my-render-secret-key-1234567890123456');
  var expectedRenderSig = crypto2.createHmac('sha256', keyBuf).update(renderId + '.' + nowSec + '.' + rawRender, 'utf8').digest('base64');
  var renderHeaders = { 'webhook-id': renderId, 'webhook-timestamp': String(nowSec), 'webhook-signature': 'v1,' + expectedRenderSig };

  ok(events.verifyRenderSignature(rawRender, renderHeaders).ok === true, 'valid Render webhook signature verifies');
  ok(events.verifyRenderSignature(rawRender, Object.assign({}, renderHeaders, { 'webhook-signature': 'v1,invalid' })).ok === false, 'forged Render signature rejected');
  ok(events.verifyRenderSignature(rawRender, Object.assign({}, renderHeaders, { 'webhook-timestamp': String(nowSec - 600) })).ok === false, 'expired Render webhook timestamp rejected');
  delete process.env.RENDER_WEBHOOK_SECRET;
  ok(events.verifyRenderSignature(rawRender, renderHeaders).configured === false, 'missing Render secret reports not-configured');

  var mappedStart = events.mapRenderWebhook(JSON.parse(rawRender), renderId);
  ok(mappedStart.length === 1 && mappedStart[0].type === 'deploy_started', 'Render deploy_started maps to deploy_started event');
  events.recordDevEvent(mappedStart[0]);
  ok(events.statusBoard().deploy.state === 'running', 'status board deploy reflects running');

  var rawEndSuccess = JSON.stringify({ type: 'deploy_ended', data: { serviceName: 'xamcode-ai', status: 'succeeded' } });
  var mappedEnd = events.mapRenderWebhook(JSON.parse(rawEndSuccess), 'msg-deploy-002');
  ok(mappedEnd.length === 1 && mappedEnd[0].type === 'deploy_succeeded', 'Render deploy_ended (succeeded) maps to deploy_succeeded');
  events.recordDevEvent(mappedEnd[0]);
  ok(events.statusBoard().deploy.state === 'passed', 'status board deploy reflects passed');

  var rawEndUnknown = JSON.stringify({ type: 'deploy_ended', data: { serviceName: 'xamcode-ai', status: 'unknown_state' } });
  var mappedUnknown = events.mapRenderWebhook(JSON.parse(rawEndUnknown), 'msg-deploy-003');
  ok(mappedUnknown.length === 0, 'unknown deploy outcome is ignored (never guessed as passed)');


  var d3 = freshDataDir(); dirs.push(d3);
  var community = require('./bip/community');
  ok(community.postMessage({ text: '   ', nickname: 'x', visitorId: 'v1' }).ok === false, 'blank chat rejected');
  var xss = community.postMessage({ text: 'alert(1) hi', nickname: 'bob', visitorId: 'v1' });
  ok(xss.ok && xss.message.text.indexOf('alert(1)') >= 0, 'chat stores plain text');
  ok(community.submitIdea({ title: 'x', description: 'y', visitorId: 'v1' }).ok === false, 'short idea rejected');
  var idea = community.submitIdea({ title: 'Unit idea', description: 'A description well over ten characters.', visitorId: 'v1' });
  ok(idea.ok && idea.idea.status === 'submitted', 'idea submits as submitted');
  var ideaId = idea.idea.id;
  var v1 = community.voteIdea(ideaId, 'v1');
  var v2 = community.voteIdea(ideaId, 'v1');
  ok(v1.ok && v1.votes === 1 && v1.voted === true, 'first vote counts');
  ok(v2.ok && v2.votes === 0 && v2.voted === false, 'second vote toggles off');
  ok(community.voteIdea(ideaId, 'v2').votes === 1, 'second visitor votes independently');
  ok(community.addComment(ideaId, { text: 'nice', nickname: 'c', visitorId: 'v2' }).ok === true, 'comment posts');
  ok(community.listComments(ideaId).comments.length === 1, 'comment lists back');
  ok(community.reportContent('idea', ideaId, { reason: 'spam', visitorId: 'v3', kind: 'idea' }).ok === true, 'abuse report files');
  ok(community.reportContent('chat', 'missing', { reason: 'x', visitorId: 'v3', kind: 'chat' }).ok === false, 'report on missing item fails');

  var d4 = freshDataDir(); dirs.push(d4);
  var community2 = require('./bip/community');
  var store4 = require('./bip/store');
  var admin = require('./bip/admin');
  ok(community2.joinWaitlist({ email: 'bad', consent: true }).ok === false, 'bad email rejected');
  ok(community2.joinWaitlist({ email: 'a@example.com', consent: false }).ok === false, 'missing consent rejected');
  var w1 = community2.joinWaitlist({ email: 'A@Example.com', consent: true });
  var w2 = community2.joinWaitlist({ email: 'a@example.com', consent: true });
  ok(w1.ok && w1.position === 1, 'waitlist joins at position 1');
  ok(w2.ok && w2.duplicate === true && w2.position === 1, 'case-insensitive duplicate handled');
  ok(community2.waitlistCount() === 1, 'waitlist count is 1');
  var stored = store4.ensureLoaded().waitlist[0];
  ok(stored.email === 'a@example.com' && stored.consent === true, 'email normalized plus consent recorded');
  var L = admin.publicLaunch();
  ok(L.hasConfirmedDate === false && L.countdownMs === null, 'no confirmed date means no countdown');
  ok(L.readinessPercent === 97 && typeof L.readiness === 'string', 'readiness separate from dates');

  var d5 = freshDataDir(); dirs.push(d5);
  var estimate = require('./bip/estimate');
  var base = estimate.computeEstimate();
  ok(base.remainingHours === 50, 'estimate seeds 50 remaining hours (got ' + base.remainingHours + ')');
  ok(base.velocityHoursPerDay === 8 && typeof base.projectedAt === 'string', 'nominal velocity 8 h/day with projected date');
  var doneTask = estimate.setTaskStatus('load-testing', 'done', 'unit-test');
  ok(doneTask.ok && doneTask.estimate.remainingHours === 42, 'done task drops 8h of remaining (got ' + doneTask.estimate.remainingHours + ')');
  ok(estimate.setTaskStatus('load-testing', 'bogus', 'unit-test').ok === false, 'invalid task status rejected');
  ok(estimate.setTaskEstimate('nope', { effortHours: 1 }, 'unit-test').ok === false, 'unknown task key rejected');
  var bugHigh = estimate.setBug(null, { title: 'pdf render crash', severity: 'high' }, 'unit-test');
  ok(bugHigh.ok && bugHigh.estimate.remainingHours === 50, 'high bug adds 8h repair effort (got ' + bugHigh.estimate.remainingHours + ')');
  ok(estimate.setBug(null, { title: 'x', severity: 'nonsense' }, 'unit-test').ok === false, 'invalid severity rejected');
  var overlap = estimate.setBlocker(null, { title: 'pdf render infra blocked', effortHours: 5 }, 'unit-test');
  ok(overlap.ok && overlap.estimate.remainingHours === 50, 'blocker overlapping an open bug is deduped (got ' + overlap.estimate.remainingHours + ')');
  var distinct = estimate.setBlocker(null, { title: 'unrelated deploy token wait', effortHours: 5 }, 'unit-test');
  ok(distinct.ok && distinct.estimate.remainingHours === 55, 'distinct blocker adds effort (got ' + distinct.estimate.remainingHours + ')');
  var vel = estimate.setVelocity(4, null, 'unit-test');
  ok(vel.ok && vel.estimate.velocityHoursPerDay === 4, 'velocity calibration halves the rate');
  ok(estimate.setVelocity(-1, null, 'unit-test').ok === false, 'non-positive velocity rejected');
  ok(estimate.history(50).length >= 4, 'estimate mutations record history');

  for (var i = 0; i < dirs.length; i++){ try { fs.rmSync(dirs[i], { recursive: true, force: true }); } catch (e) {} }
  console.log('UNITS: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
