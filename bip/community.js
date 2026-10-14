'use strict';
/* ============================================================
   BIP COMMUNITY — public chat, ideas board, reports, waitlist.
   ----------------------------------------------------------------
   • Anonymous posting IS allowed (lowers the barrier for students),
     but with per-IP rate limits, length caps, a moderation queue
     (reports), and admin-only deletion.
   • Messages are stored raw-ish (HTML stripped) and MUST be rendered
     with textContent / escaping on the client — never innerHTML.
   • Chat messages are discussion only: they can never change
     development status, and nothing in them is ever treated as an
     instruction to an agent. (Stated in the posting rules too.)
   • Moderation: reports list + resolve/delete are admin-token gated
     in bip/admin.js.
   ============================================================ */
const store = require('./store');
const events = require('./events');
const { sanitizePublicText, sanitizeMultiline, isValidEmail, sha, isoNow } = require('./util');

const LIMITS = {
  chatMessage: 1000,
  nickname: 40,
  ideaTitle: 120,
  ideaBody: 2000,
  comment: 1000,
  reportReason: 500
};

const IDEA_STATUSES = ['submitted', 'under_review', 'planned', 'in_development', 'completed', 'declined'];
const REPORT_STATUSES = ['open', 'resolved', 'dismissed'];

/* ---------- public chat ---------- */
function postMessage(opts){
  const o = opts || {};
  const text = sanitizePublicText(o.text, LIMITS.chatMessage);
  if (!text) return { ok: false, error: 'Write a message first (1-1000 characters).', code: 'BAD_TEXT' };
  if (text.length < 1) return { ok: false, error: 'Write a message first (1-1000 characters).', code: 'BAD_TEXT' };
  const nick = sanitizePublicText(o.nickname || 'Visitor', LIMITS.nickname) || 'Visitor';
  const d = store.ensureLoaded();
  const msg = {
    id: store.id('msg'),
    nickname: nick,
    text,
    at: isoNow(),
    // Identity kept private: only a short fingerprint so repeat
    // offenders can be recognized without publishing IPs or ids.
    authorTag: 'v-' + sha(String(o.visitorId || '') + '|chat').slice(0, 6),
    deleted: false
  };
  d.chatMessages.push(msg);
  store.trimCollection('chatMessages', store.CAPS.chatMessages);
  store.persist();
  events.broadcast({ kind: 'chat', message: publicMessage(msg) });
  return { ok: true, message: publicMessage(msg) };
}

function publicMessage(m){
  return { id: m.id, nickname: m.nickname, text: m.text, at: m.at, authorTag: m.authorTag };
}

function listMessages(opts){
  const o = opts || {};
  const limit = Math.max(1, Math.min(50, Number(o.limit) || 30));
  const d = store.ensureLoaded();
  const visible = d.chatMessages.filter(m => !m.deleted);
  const after = o.after ? String(o.after) : null;
  let slice = visible;
  if (after){
    const i = visible.findIndex(m => m.id === after);
    slice = i >= 0 ? visible.slice(i + 1) : visible.slice(-limit);
  }
  return { messages: slice.slice(-limit).map(publicMessage), total: visible.length };
}

/* ---------- ideas board ---------- */
function submitIdea(opts){
  const o = opts || {};
  const title = sanitizePublicText(o.title, LIMITS.ideaTitle);
  if (!title || title.length < 4) return { ok: false, error: 'Give the idea a title of at least 4 characters.', code: 'BAD_TITLE' };
  const body = sanitizeMultiline(o.description, LIMITS.ideaBody);
  if (!body || body.length < 10) return { ok: false, error: 'Describe the idea in at least 10 characters.', code: 'BAD_BODY' };
  const d = store.ensureLoaded();
  const idea = {
    id: store.id('idea'),
    title,
    description: body,
    status: 'submitted',
    votes: 0,
    authorTag: 'v-' + sha(String(o.visitorId || '') + '|idea').slice(0, 6),
    createdAt: isoNow(),
    updatedAt: isoNow()
  };
  d.ideas.push(idea);
  store.persist();
  events.broadcast({ kind: 'idea', idea: publicIdea(idea, null) });
  return { ok: true, idea: publicIdea(idea, null) };
}

function publicIdea(idea, visitorId){
  const d = store.ensureLoaded();
  return {
    id: idea.id,
    title: idea.title,
    description: idea.description,
    status: idea.status,
    votes: idea.votes,
    createdAt: idea.createdAt,
    updatedAt: idea.updatedAt,
    commentCount: d.ideaComments.filter(c => c.ideaId === idea.id && !c.deleted).length,
    votedByMe: visitorId ? d.ideaVotes.some(v => v.ideaId === idea.id && v.voterId === visitorId) : false
  };
}

function listIdeas(opts){
  const o = opts || {};
  const d = store.ensureLoaded();
  const sort = o.sort === 'new' ? 'new' : 'top';
  const rows = d.ideas.map(i => publicIdea(i, o.visitorId));
  rows.sort((a, b) => sort === 'new'
    ? (b.createdAt < a.createdAt ? -1 : 1)
    : ((b.votes - a.votes) || (b.createdAt < a.createdAt ? -1 : 1)));
  return { ideas: rows.slice(0, 100), total: rows.length };
}

/* One vote per idea per visitor identity. Toggle-off allowed.
   Votes are counted on the idea row; rows are unique by
   (ideaId, voterId) so a double-submit cannot inflate the count. */
function voteIdea(ideaId, visitorId){
  if (!visitorId) return { ok: false, error: 'Identity cookie required.', code: 'NO_IDENTITY' };
  const d = store.ensureLoaded();
  const idea = d.ideas.find(i => i.id === ideaId);
  if (!idea) return { ok: false, error: 'Unknown idea.', code: 'NOT_FOUND' };
  const idx = d.ideaVotes.findIndex(v => v.ideaId === ideaId && v.voterId === visitorId);
  let voted;
  if (idx >= 0){
    d.ideaVotes.splice(idx, 1);           // toggle off
    idea.votes = Math.max(0, (idea.votes || 0) - 1);
    voted = false;
  } else {
    d.ideaVotes.push({ ideaId, voterId: visitorId, at: isoNow() });
    idea.votes = (idea.votes || 0) + 1;
    voted = true;
  }
  idea.updatedAt = isoNow();
  store.persist();
  events.broadcast({ kind: 'vote', ideaId, votes: idea.votes });
  return { ok: true, votes: idea.votes, voted };
}

function addComment(ideaId, opts){
  const o = opts || {};
  const d = store.ensureLoaded();
  const idea = d.ideas.find(i => i.id === ideaId);
  if (!idea) return { ok: false, error: 'Unknown idea.', code: 'NOT_FOUND' };
  const text = sanitizePublicText(o.text, LIMITS.comment);
  if (!text || text.length < 1) return { ok: false, error: 'Write a comment first.', code: 'BAD_TEXT' };
  const nick = sanitizePublicText(o.nickname || 'Visitor', LIMITS.nickname) || 'Visitor';
  const comment = {
    id: store.id('cmt'), ideaId, nickname: nick, text, at: isoNow(),
    authorTag: 'v-' + sha(String(o.visitorId || '') + '|comment').slice(0, 6),
    deleted: false
  };
  d.ideaComments.push(comment);
  idea.updatedAt = isoNow();
  store.persist();
  return { ok: true, comment: publicComment(comment) };
}

function publicComment(c){
  return { id: c.id, ideaId: c.ideaId, nickname: c.nickname, text: c.text, at: c.at, authorTag: c.authorTag };
}

function listComments(ideaId){
  const d = store.ensureLoaded();
  return {
    comments: d.ideaComments.filter(c => c.ideaId === ideaId && !c.deleted).map(publicComment)
  };
}


/* ---------- abuse reports (public can file, admins resolve) ---------- */
function reportContent(kind, targetId, opts){
  const o = opts || {};
  if (kind !== 'chat' && kind !== 'idea' && kind !== 'comment'){
    return { ok: false, error: 'Report target must be chat, idea or comment.', code: 'BAD_KIND' };
  }
  const d = store.ensureLoaded();
  let exists = false;
  if (kind === 'chat') exists = d.chatMessages.some(m => m.id === targetId && !m.deleted);
  else if (kind === 'idea') exists = d.ideas.some(i => i.id === targetId);
  else exists = d.ideaComments.some(c => c.id === targetId && !c.deleted);
  if (!exists) return { ok: false, error: 'Reported item no longer exists.', code: 'NOT_FOUND' };
  const reason = sanitizePublicText(o.reason, LIMITS.reportReason) || 'No reason given.';
  const rep = {
    id: store.id('rep'), kind,
    targetId: String(targetId),
    reason, status: 'open', at: isoNow(),
    reporterTag: 'v-' + sha(String(o.visitorId || '') + o.kind + '|report').slice(0, 6)
  };
  d.reports.push(rep);
  store.trimCollection('reports', store.CAPS.reports);
  store.persist();
  return { ok: true, reportId: rep.id };
}

/* ---------- waitlist ---------- */
function joinWaitlist(opts){
  const o = opts || {};
  const email = typeof o.email === 'string' ? o.email.trim().toLowerCase() : '';
  if (!isValidEmail(email)){
    return { ok: false, error: 'Enter a valid email address.', code: 'BAD_EMAIL' };
  }
  if (o.consent !== true && o.consent !== 'yes' && o.consent !== 'on'){
    return { ok: false, error: 'Please accept the consent note so we may contact you about the launch.', code: 'NO_CONSENT' };
  }
  const d = store.ensureLoaded();
  const emailHash = sha('waitlist|' + email);
  const existing = d.waitlist.find(w => w.emailHash === emailHash);
  if (existing){
    // Duplicate signup: refresh consent timestamp, stay friendly.
    existing.consentAt = isoNow();
    store.persist();
    return { ok: true, duplicate: true, position: d.waitlist.indexOf(existing) + 1 };
  }
  const entry = {
    id: store.id('wl'),
    email,                      // stored server-side only; never published
    emailHash,
    nickname: sanitizePublicText(o.nickname, LIMITS.nickname) || '',
    consent: true,
    consentAt: isoNow(),
    joinedAt: isoNow(),
    source: 'site'
  };
  d.waitlist.push(entry);
  store.persist();
  events.broadcast({ kind: 'waitlist', count: d.waitlist.length });
  return { ok: true, duplicate: false, position: d.waitlist.length };
}

function waitlistCount(){
  return store.ensureLoaded().waitlist.length;
}

module.exports = {
  LIMITS, IDEA_STATUSES, REPORT_STATUSES,
  postMessage, publicMessage, listMessages,
  submitIdea, publicIdea, listIdeas, voteIdea,
  addComment, publicComment, listComments,
  reportContent, joinWaitlist, waitlistCount
};
