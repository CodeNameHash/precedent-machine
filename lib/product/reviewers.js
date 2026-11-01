'use strict';

// Reviewer levels and the reviewer cookie (work package 3). The cookie is a
// preference, not authentication: the session login stays the gate. The
// feedback API reads it to stamp the author and level; trusted levels are
// PARTNER and SENIOR_ASSOCIATE.

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
    trusted: TRUSTED_LEVELS.has(row.level),
  };
}

function defaultReviewer(env = process.env) {
  const name = env.AUTH_USERNAME || 'Ben Goodchild';
  return { id: null, name, level: 'PARTNER', email: null, active: true, trusted: true };
}

// The request's reviewer: the cookie's id when it names an active reviewer,
// otherwise the first active partner, otherwise the configured owner. A
// database failure falls back rather than blocking feedback.
async function reviewerForRequest({ req, client, env = process.env } = {}) {
  const id = reviewerCookieId(req);
  if (!client || typeof client.from !== 'function') return defaultReviewer(env);
  try {
    if (id) {
      const result = await client.from('product_reviewers').select('id,name,level,email,active').eq('id', id).maybeSingle();
      const reviewer = reviewerFromRow(result.data);
      if (reviewer?.active) return reviewer;
    }
    const fallback = await client.from('product_reviewers').select('id,name,level,email,active').eq('active', true).order('created_at').limit(1).maybeSingle();
    return reviewerFromRow(fallback.data) || defaultReviewer(env);
  } catch {
    return defaultReviewer(env);
  }
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
  defaultReviewer,
  reviewerForRequest,
  adminActor,
};
