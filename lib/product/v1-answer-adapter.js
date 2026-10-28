'use strict';

// Reading a V1 provision as an answer (work package 54, plan finding (304)).
// The corpus in tzulhdasmioeechxapdy holds 12,816 provisions, each with a type,
// a category, the old coded metadata (`ai_metadata.code`, `features`) and its
// exceptions. That is provision-level and coded, so it can sit beside a V2
// answer in one comparison -- provided every cell says which generation it came
// from and the two vocabularies are never silently pooled.
//
// Pure: it takes a provision row and returns the same {answer, condition} shape
// the V2 presentation schema returns.

function humanizeCode(code) {
  return String(code || '').toLowerCase().split(/[-_]/).filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function exceptionSummary(exceptions) {
  if (!exceptions) return null;
  if (Array.isArray(exceptions)) return exceptions.length ? `${exceptions.length} exception${exceptions.length === 1 ? '' : 's'}` : null;
  if (typeof exceptions === 'object') {
    const keys = Object.keys(exceptions);
    return keys.length ? `${keys.length} exception${keys.length === 1 ? '' : 's'}` : null;
  }
  return null;
}

/**
 * @param {object} provision a row from public.provisions
 * @returns {{generation: 'V1', row_key: string, row_label: string, answer: object|null, condition: object|null}}
 */
function answerFromV1(provision) {
  const metadata = provision?.ai_metadata || {};
  const code = metadata.code || null;
  const answer = code ? {
    text: humanizeCode(code),
    kind: 'code',
    pill: true,
    tone: 'neutral',
    generation: 'V1',
    code,
  } : null;
  const exception = exceptionSummary(provision?.exceptions);
  const condition = exception ? {
    text: exception,
    kind: 'condition',
    pill: true,
    tone: 'info',
    generation: 'V1',
  } : null;
  return {
    generation: 'V1',
    row_key: String(provision?.type || ''),
    row_label: String(provision?.category || provision?.type || ''),
    answer,
    condition,
  };
}

module.exports = { answerFromV1, humanizeCode, exceptionSummary };
