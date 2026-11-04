'use strict';

// Reviewer levels and the reviewer cookie (work package 3). The cookie is a
// preference, not authentication: the session login stays the gate. The
// feedback API reads it to stamp the level; feedback is trusted only when
// the cookie names an active PARTNER or SENIOR_ASSOCIATE reviewer.

const { parseCookieHeader } = require('../auth/cookies');

const REVIEWER_COOKIE = 'pm_reviewer';
const REVIEWER_LEVELS = Object.freeze(['PARTNER', 'SENIOR_ASSOCIATE', 'MID_LEVEL_ASSOCIATE', 'JUNIOR_ASSOCIATE']);
const LEVEL_LABELS = Object.freeze({
  PARTNER: 'Partner',
  SENIOR_ASSOCIATE: 'Senior associate',
  MID_LEVEL_ASSOCIATE: 'Mid-level associate',
  JUNIOR_ASSOCIATE: 'Junior associate',
});
const TRUSTED_LEVELS = new Set(['PARTNER', 'SENIOR_ASSOCIATE']);

function isReviewerLevel(level) {
  return REVIEWER_LEVELS.includes(String(level || ''));
}

function levelLabel(level) {
  return LEVEL_LABELS[String(level || '')] || 'Reviewer';
}

function reviewerCookieId(req) {
  const cookies = parseCookieHeader(req?.headers?.cookie);
  return cookies[REVIEWER_COOKIE] || null;
}

function reviewerCookie(id) {
  return `${REVIEWER_COOKIE}=${encodeURIComponent(String(id))}; Path=/; SameSite=Lax; Max-Age=31536000`;
}

function reviewerFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    level: row.level,
    email: row.email || null,
    active: row.active !== false,
    trusted: row.active !== false && TRUSTED_LEVELS.has(row.level),
  };
}

// The request's reviewer: the cookie's id when it names an active reviewer,
// otherwise null. There is no fallback to a partner or a configured owner:
// a missing, unknown or inactive id, or a database failure, means the
// request has no declared level and is not trusted. The cookie is a
// self-declared preference; the session login stays the identity.
async function reviewerForRequest({ req, client } = {}) {
  const id = reviewerCookieId(req);
  if (!id || !client || typeof client.from !== 'function') return null;
  try {
    const result = await client.from('product_reviewers').select('id,name,level,email,active').eq('id', id).maybeSingle();
    if (result?.error) return null;
    const reviewer = reviewerFromRow(result?.data);
    return reviewer?.active && isReviewerLevel(reviewer.level) ? reviewer : null;
  } catch {
    return null;
  }
}

// What the switcher may show to a reader: no email unless the reader is
// the admin.
function publicReviewer(reviewer, { admin = false } = {}) {
  if (!reviewer) return null;
  if (admin) return reviewer;
  const { email, ...rest } = reviewer;
  return rest;
}

// The body of GET /api/product/reviewers. `current` is the declared
// reviewer, or an undeclared entry carrying the session actor so the
// switcher still renders and a reviewer can be chosen.
function reviewersResponse({ rows = [], declared = null, actor = null, admin = false } = {}) {
  const current = declared
    ? { ...publicReviewer(declared, { admin }), declared: true }
    : { id: null, name: String(actor || 'Reviewer'), level: null, active: true, trusted: false, declared: false };
  return {
    schema_version: 'PRODUCT_REVIEWERS/V1',
    reviewers: (rows || []).map((row) => publicReviewer(reviewerFromRow(row), { admin })),
    current,
  };
}

function adminActor(actor, env = process.env) {
  return String(actor || '') === String(env.AUTH_USERNAME || 'ben');
}

module.exports = {
  REVIEWER_COOKIE,
  REVIEWER_LEVELS,
  LEVEL_LABELS,
  TRUSTED_LEVELS,
  isReviewerLevel,
  levelLabel,
  reviewerCookieId,
  reviewerCookie,
  reviewerFromRow,
  publicReviewer,
  reviewersResponse,
  reviewerForRequest,
  adminActor,
};
