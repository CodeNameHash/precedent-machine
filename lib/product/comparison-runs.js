'use strict';

// The run identities and labels the comparison surfaces share (work package
// 55, note DEEPSEEK-NAV-INDEX-COMPARE-2026-11-01). A comparison can hold a
// released agreement (FINAL) and a run still in review (DRAFT), and every
// surface must name both the same way. Pure functions only: the API routes
// and the pages import this module, so it must not reach a server-only
// dependency.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const STATUS_LABELS = {
  QUEUED: 'Queued',
  RUNNING: 'Analysing',
  READY: 'Ready',
  PARTIAL: 'Partly analysed',
  FAILED: 'Failed',
};

// A run is analysed once it has left the queue: RUNNING runs are read as far
// as their committed sections, and a stopped run (READY, PARTIAL, FAILED) is
// final analysis even before a lawyer publishes it. A QUEUED run has no
// analysis to compare and is not offered on /analysed.
const ANALYSED_STATUSES = new Set(['RUNNING', 'READY', 'PARTIAL', 'FAILED']);

function isAnalysedRun(run) {
  if (!run) return false;
  if (run.released_at) return true;
  return ANALYSED_STATUSES.has(String(run.status || ''));
}

function runPhase(run) {
  return run && run.released_at ? 'FINAL' : 'DRAFT';
}

function phaseLabel(phase) {
  return phase === 'FINAL' ? 'Final' : 'Draft';
}

function statusLabel(status) {
  return STATUS_LABELS[String(status || '')] || (status ? String(status) : 'Run');
}

function partyName(party) {
  if (typeof party === 'string') return party;
  return party?.name || null;
}

// The published read's label rule: target first, then acquirer, then the
// first two named parties. A draft has no release summary, so the same rule
// is applied to the source payload's parties.
function agreementLabelFromParties(parties) {
  const list = Array.isArray(parties) ? parties : [];
  const company = partyName(list.find((party) => (party?.role || '') === 'COMPANY'));
  const parent = partyName(list.find((party) => (party?.role || '') === 'PARENT'))
    || partyName(list.find((party) => (party?.role || '') === 'ACQUIRER'));
  if (company && parent) return `${company} / ${parent}`;
  const names = list.map(partyName).filter(Boolean);
  return names.length >= 2 ? names.slice(0, 2).join(' / ') : null;
}

// "https://www.sec.gov/Archives/edgar/data/.../ncs-merger-agreement.htm" reads
// "ncs merger agreement" until the release gives the agreement its parties.
function agreementLabelFromUrl(url) {
  const path = String(url || '').split(/[?#]/)[0];
  const file = path.split('/').filter(Boolean).pop() || '';
  const stem = file.replace(/\.(?:htm|html|txt|pdf)$/i, '');
  const label = stem.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  return label || null;
}

function agreementLabel(run) {
  return run?.agreement_label
    || agreementLabelFromParties(run?.parties)
    || agreementLabelFromUrl(run?.retrieval_url)
    || String(run?.run_id || '').slice(0, 8)
    || 'Untitled agreement';
}

// The compare page and the tables API both take `?runs=id,id`. A malformed
// id is refused rather than silently dropped: a comparison that loses a
// column without saying so is worse than a 400.
function parseRunIdList(raw, { min = 1, max = 6 } = {}) {
  const text = Array.isArray(raw) ? raw.join(',') : String(raw || '');
  const ids = [...new Set(text.split(',').map((id) => id.trim()).filter(Boolean))];
  if (ids.length < min) return { ids: [], error: min === 1 ? 'runs is required' : `at least ${min} runs are required` };
  if (ids.length > max) return { ids: [], error: `at most ${max} runs may be compared` };
  const invalid = ids.find((id) => !UUID.test(id));
  if (invalid) return { ids: [], error: `invalid run id: ${invalid}` };
  return { ids, error: null };
}

function compareRunsNewestFirst(left, right) {
  const leftAt = String(left?.released_at || left?.created_at || '');
  const rightAt = String(right?.released_at || right?.created_at || '');
  return rightAt.localeCompare(leftAt) || agreementLabel(left).localeCompare(agreementLabel(right));
}

module.exports = {
  UUID,
  ANALYSED_STATUSES,
  STATUS_LABELS,
  isAnalysedRun,
  runPhase,
  phaseLabel,
  statusLabel,
  agreementLabelFromParties,
  agreementLabelFromUrl,
  agreementLabel,
  parseRunIdList,
  compareRunsNewestFirst,
};
