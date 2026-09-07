'use strict';

const LABELS = Object.freeze({
  ACCEPTED: 'Accepted',
  CONTEXT_ONLY: 'Supporting context',
  EDITED: 'Edited',
  FAMILY_ASSIGNED: 'Relevant legal provisions',
  IMMATERIAL: 'Not material to this review',
  NO_SHOP: 'No-shop',
  PENDING: 'Needs review',
  REJECTED: 'Rejected',
  UNRESOLVED: 'Unresolved',
  UNUSUAL_PROVISION: 'Unusual provision',
  UNRESOLVED_UNUSUAL_PROVISION: 'Unresolved unusual provision',
});

const UPPERCASE_WORDS = new Set(['ai', 'dno', 'ftc', 'hsr', 'mae', 'us']);

function displayReviewLabel(value) {
  if (typeof value !== 'string') return '';
  if (LABELS[value]) return LABELS[value];
  const words = value.trim().toLowerCase().split('_').filter(Boolean).map((word) => (
    UPPERCASE_WORDS.has(word) ? (word === 'dno' ? 'D&O' : word.toUpperCase()) : word
  ));
  if (words.length === 0) return '';
  return `${words[0][0].toUpperCase()}${words[0].slice(1)}${words.length > 1 ? ` ${words.slice(1).join(' ')}` : ''}`;
}

module.exports = { displayReviewLabel };
