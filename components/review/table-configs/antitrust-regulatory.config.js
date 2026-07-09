import React from 'react';
import taxonomy from '../../../lib/taxonomy.js';
import { cardCode, cardFeatures, cardType, firstFeature, selectCards, splitForCell, textOf, valueText } from './card-utils.js';
import { standardColorKey } from './standard-colors.js';

const { labelForCode, taxonomyForFeatureKey } = taxonomy;

// Rebuilt per REBUILD-SPECS.md §8. The legacy config rendered ~16 separate
// rows -- one per ANTI-* card family (efforts, hsr-deadline, foreign-filings,
// other-filings, approvals, litigation, consultation, strategy-control,
// pull-refile, remedies, burden-cap, divestiture-required, clear-skies,
// timing-agreements, springing-conditions, outside-date) -- which is how the
// 17 ANTITRUST_REGULATORY sub-cards on Metsera produced Ben's "shit show" of
// near-duplicate rows AND the "reasonable best efforts: reasonable best
// efforts" doubling (the old pill literally re-rendered the row's own
// concept name as a "Kind: value" prefix). This rewrite consolidates down to
// the 8 concepts spec §8 asks for, and every pill below is the RESOLVED
// VALUE ALONE -- the Term column already names the concept, so nothing here
// ever prefixes a pill with its own row label.

function isAntitrust(card) {
  return cardType(card) === 'ANTITRUST_REGULATORY' || cardCode(card).startsWith('ANTI') || /antitrust|regulatory|HSR|competition/i.test(`${card?.short_title || ''} ${textOf(card)}`);
}

function isTruthy(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return /^(true|yes)$/i.test(value.trim());
  return Boolean(value);
}

function isFalsy(value) {
  if (typeof value === 'boolean') return value === false;
  if (typeof value === 'string') return /^(false|no)$/i.test(value.trim());
  return false;
}

function mainConceptOf(card) {
  return valueText(cardFeatures(card).mainConcept) || null;
}

function shortText(text, max = 70) {
  if (!text) return null;
  const { short, truncated } = splitForCell(text, max);
  return truncated ? `${short}…` : short;
}

// Generic code -> friendly-label resolver via the shared taxonomy dict for a
// feature key (ported from the legacy readableValue()). Used wherever a
// feature's canonical code already has a proper taxonomy dictionary entry
// (divestiture cap, foreign filings) so this config never invents wording
// the taxonomy already owns.
function readableValue(key, value) {
  const rendered = valueText(value);
  if (!rendered) return null;
  if (Array.isArray(value)) return value.map((item) => readableValue(key, item)).filter(Boolean).join('; ');
  const code = (value && typeof value === 'object') ? (value.code || value.value) : (typeof value === 'string' ? value : null);
  const dict = taxonomyForFeatureKey(key);
  return (dict && code && labelForCode(String(code).toUpperCase(), dict)) || rendered;
}

// --- Efforts standard -------------------------------------------------
//
// antitrustEffortsStandard is a plain kebab-case enum
// (reasonable-best-efforts / flat / commercially-reasonable-efforts / ...);
// older/test fixtures may instead carry the legacy tagged-object shape
// ({code:'REASONABLE_BEST_EFFORTS', text:'reasonable best efforts', ...})
// under the 'effortsStandard' alias. Both resolve to the same short label so
// the pill never doubles the quoted clause text back onto itself.
const ANTITRUST_EFFORTS_LABELS = {
  'best-efforts': 'Best efforts',
  'commercially-reasonable-efforts': 'Commercially reasonable efforts',
  flat: 'Flat (unqualified obligation)',
  'good-faith-efforts': 'Good faith efforts',
  'reasonable-best-efforts': 'Reasonable best efforts',
  'reasonable-efforts': 'Reasonable efforts',
};

function prettifyCode(raw) {
  const spaced = String(raw || '').replace(/[-_]+/g, ' ').trim().toLowerCase();
  return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : null;
}

function effortsLabelFor(value) {
  if (value === null || value === undefined || value === '') return null;
  const code = (value && typeof value === 'object') ? (value.code || value.value) : value;
  if (code === null || code === undefined || code === '') return null;
  const raw = String(code).trim();
  const kebab = raw.toLowerCase().replace(/[_\s]+/g, '-');
  if (ANTITRUST_EFFORTS_LABELS[kebab]) return ANTITRUST_EFFORTS_LABELS[kebab];
  const dict = taxonomyForFeatureKey('effortsStandard');
  const dictLabel = dict && labelForCode(raw.toUpperCase().replace(/[-\s]+/g, '_'), dict);
  if (dictLabel) return dictLabel;
  if (value && typeof value === 'object' && value.label) return value.label;
  return prettifyCode(raw);
}

// The efforts covenant key ('antitrustEffortsStandard' / 'effortsStandard')
// is reused across several ANTI-EFFORTS cards for genuinely different, much
// narrower obligations (a Company-board "flat" duty to neutralise state
// antitrust statutes; a "commercially reasonable efforts" duty to chase
// unrelated third-party contract consents). The OPERATIVE antitrust-efforts
// standard -- the one the burden cap / divestiture cap actually qualifies --
// is the ANTI-EFFORTS card that also carries a cap claim, so prefer that
// pairing before falling back to the first card with any efforts value.
function pickEffortsHit(cards) {
  const keys = ['antitrustEffortsStandard', 'effortsStandard'];
  for (const card of cards) {
    const features = cardFeatures(card);
    const hasCap = valueText(features.divestitureCapDescription) || valueText(features.capDetail);
    if (!hasCap) continue;
    for (const key of keys) {
      const raw = features[key];
      if (valueText(raw)) return { key, value: raw, card };
    }
  }
  return firstFeature(cards, keys);
}

function effortsStandardRow(cards) {
  const hit = pickEffortsHit(cards);
  if (!hit) return null;
  const label = effortsLabelFor(hit.value);
  if (!label) return null;
  return {
    id: 'antitrust-regulatory-efforts',
    label: 'Efforts standard',
    detail: mainConceptOf(hit.card) || valueText(hit.value),
    evidence: textOf(hit.card),
    source: hit.card,
    present: true,
    signals: [{
      id: 'antitrust-regulatory-efforts-signal',
      label,
      value: hit.value,
      tone: 'info',
      color: standardColorKey(label),
      evidence: textOf(hit.card),
      source: hit.card,
    }],
  };
}

// --- Divestiture cap ----------------------------------------------------
//
// Folds in divestitureInCondition (a related-but-distinct "must a divesture
// happen before closing" boolean, previously its own "Divestiture required
// before consummation" row) as a second qualifier pill on the SAME row
// rather than a separate concept row, per the consolidation mandate.
function divestitureCapRow(cards) {
  const capHit = firstFeature(cards, ['divestitureCapDescription', 'burdenCommitment', 'divestitureCap', 'burdensomeConditionLimit']);
  const conditionHit = firstFeature(cards, ['divestitureInCondition']);
  if (!capHit && !conditionHit) return null;
  const primaryCard = capHit?.card || conditionHit.card;
  const signals = [];
  if (capHit) {
    const label = shortText(readableValue(capHit.key, capHit.value), 60);
    if (label) {
      signals.push({
        id: 'antitrust-regulatory-divestiture-cap-signal',
        label,
        value: capHit.value,
        tone: 'warning',
        evidence: textOf(capHit.card),
        source: capHit.card,
      });
    }
  }
  if (conditionHit && isTruthy(conditionHit.value)) {
    signals.push({
      id: 'antitrust-regulatory-divestiture-cap-condition-signal',
      label: 'Required before consummation',
      value: conditionHit.value,
      tone: 'warning',
      evidence: textOf(conditionHit.card),
      source: conditionHit.card,
    });
  }
  if (!signals.length) return null;
  return {
    id: 'antitrust-regulatory-divestiture-cap',
    label: 'Divestiture cap',
    detail: mainConceptOf(capHit?.card) || (capHit && valueText(cardFeatures(capHit.card).capDetail)) || capHit?.detail || mainConceptOf(conditionHit?.card) || conditionHit?.detail,
    evidence: textOf(primaryCard),
    source: primaryCard,
    present: true,
    signals,
  };
}

// --- HSR filing deadline -------------------------------------------------

function hsrDaysLabel(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw === 'number') return `${raw} business days`;
  if (typeof raw === 'string') {
    const n = parseInt(raw, 10);
    if (!Number.isNaN(n)) return `${n} business days`;
  }
  if (typeof raw === 'object') {
    const days = raw.days ?? raw.value?.days ?? (typeof raw.value === 'number' ? raw.value : null);
    if (typeof days === 'number') return `${days} business days`;
    const text = raw.text || raw.value?.text;
    if (text) {
      const m = String(text).match(/(\d+)\s*business\s*days?/i);
      if (m) return `${m[1]} business days`;
    }
  }
  return null;
}

function hsrDeadlineRow(cards) {
  const hit = firstFeature(cards, ['hsrFilingDeadlineBusinessDays', 'hsrFilingDeadline', 'exHsrFilingDeadline']);
  if (!hit) return null;
  const label = hsrDaysLabel(hit.value) || shortText(hit.detail, 40);
  if (!label) return null;
  return {
    id: 'antitrust-regulatory-hsr-deadline',
    label: 'HSR filing deadline',
    detail: mainConceptOf(hit.card) || hit.detail,
    evidence: textOf(hit.card),
    source: hit.card,
    present: true,
    signals: [{
      id: 'antitrust-regulatory-hsr-deadline-signal',
      label,
      value: hit.value,
      tone: 'info',
      evidence: textOf(hit.card),
      source: hit.card,
    }],
  };
}

// --- Foreign regulatory filings -------------------------------------------

function foreignFilingsRow(cards) {
  const hit = firstFeature(cards, ['foreignFilingsRequired', 'foreignFilings']);
  if (!hit) return null;
  const label = shortText(readableValue('foreignFilingsRequired', hit.value), 50);
  if (!label) return null;
  return {
    id: 'antitrust-regulatory-foreign-filings',
    label: 'Foreign regulatory filings',
    detail: mainConceptOf(hit.card) || hit.detail,
    evidence: textOf(hit.card),
    source: hit.card,
    present: true,
    signals: [{
      id: 'antitrust-regulatory-foreign-filings-signal',
      label,
      value: hit.value,
      tone: 'info',
      evidence: textOf(hit.card),
      source: hit.card,
    }],
  };
}

// --- Filing / strategy responsibility ------------------------------------
//
// Backfilled data carries this control tag in TWO forms for the same
// concept -- the canonical taxonomy code (CONTROL_PARENT) and a plain,
// non-canonical string (PARENT_CONTROL) -- depending on which card wrote
// it. Both must resolve to the same short pill; DATA gap noted in the WP
// report (the non-canonical form belongs at extraction/backfill, not here).
const CONTROL_SHORT_LABELS = {
  CONTROL_PARENT: 'Parent controls',
  PARENT_CONTROL: 'Parent controls',
  CONTROL_COMPANY: 'Company controls',
  COMPANY_CONTROL: 'Company controls',
  TARGET_CONTROL: 'Company controls',
  CONTROL_SHARED: 'Shared control',
  SHARED_CONTROL: 'Shared control',
  CONTROL_SILENT: 'Silent on control',
  SILENT_CONTROL: 'Silent on control',
};

function controlLabel(value) {
  if (value === null || value === undefined || value === '') return null;
  const raw = (value && typeof value === 'object') ? (value.code || value.value || value.label) : value;
  const code = String(raw || '').toUpperCase().trim();
  if (!code) return null;
  if (CONTROL_SHORT_LABELS[code]) return CONTROL_SHORT_LABELS[code];
  const dict = taxonomyForFeatureKey('regulatoryStrategyControlTagged');
  const dictLabel = dict && labelForCode(code, dict);
  return dictLabel || shortText(valueText(value), 40);
}

function filingResponsibilityRow(cards) {
  const hit = firstFeature(cards, ['regulatoryStrategyControlTagged', 'controllingParty', 'regulatoryStrategyControl']);
  if (!hit) return null;
  const label = controlLabel(hit.value);
  if (!label) return null;
  return {
    id: 'antitrust-regulatory-filing-responsibility',
    label: 'Filing responsibility',
    detail: mainConceptOf(hit.card) || hit.detail,
    evidence: textOf(hit.card),
    source: hit.card,
    present: true,
    signals: [{
      id: 'antitrust-regulatory-filing-responsibility-signal',
      label,
      value: hit.value,
      tone: 'neutral',
      evidence: textOf(hit.card),
      source: hit.card,
    }],
  };
}

// --- Clear-skies covenant --------------------------------------------------

function clearSkiesRow(cards) {
  const hit = firstFeature(cards, ['clearSkiesParent', 'clearSkiesCompany', 'clearSkies']);
  if (!hit) return null;
  const truthy = isTruthy(hit.value);
  const falsy = isFalsy(hit.value);
  if (!truthy && !falsy) return null;
  const features = cardFeatures(hit.card);
  const scope = valueText(features.clearSkiesParentScope) || valueText(features.clearSkiesCompanyScope);
  return {
    id: 'antitrust-regulatory-clear-skies',
    label: 'Clear-skies covenant',
    detail: mainConceptOf(hit.card) || scope || hit.detail,
    evidence: textOf(hit.card),
    source: hit.card,
    present: true,
    signals: [{
      id: 'antitrust-regulatory-clear-skies-signal',
      label: truthy ? 'Yes' : 'No',
      value: hit.value,
      tone: truthy ? 'present' : 'missing',
      evidence: textOf(hit.card),
      source: hit.card,
    }],
  };
}

// --- Pull-and-refile / timing agreements -----------------------------------
//
// Both concepts live on the same "Timing Agreements" card but as distinct
// feature keys (pullRefile / timingAgreementsProhibited) with distinct
// taxonomy dictionaries (PULL_REFILE / TIMING_AGREEMENT), so spec §8 keeps
// them as two separate rows. Values arrive as either a plain boolean (the
// restriction is present) or a tagged {code,text} object naming the exact
// consent gate -- prefer the coded nuance, fall back to a bare
// Prohibited/Permitted read of the boolean.
function prohibitionLabel(key, value) {
  if (value === null || value === undefined || value === '') return null;
  const dict = taxonomyForFeatureKey(key);
  let code = null;
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    code = value.code || value.value || null;
  } else if (typeof value === 'string' && !/^(true|false)$/i.test(value.trim())) {
    code = value;
  }
  if (code && dict) {
    const label = labelForCode(String(code).toUpperCase(), dict);
    if (label) return label;
  }
  if (isTruthy(value)) return 'Prohibited';
  if (isFalsy(value)) return 'Permitted';
  return shortText(valueText(value), 50);
}

function pullRefileRow(cards) {
  const hit = firstFeature(cards, ['pullRefile', 'pullAndRefileRight', 'pullRefileText']);
  if (!hit) return null;
  const label = prohibitionLabel('pullRefile', hit.value);
  if (!label) return null;
  const features = cardFeatures(hit.card);
  return {
    id: 'antitrust-regulatory-pull-refile',
    label: 'Pull-and-refile',
    detail: mainConceptOf(hit.card) || valueText(features.pullRefileText) || hit.detail,
    evidence: textOf(hit.card),
    source: hit.card,
    present: true,
    signals: [{
      id: 'antitrust-regulatory-pull-refile-signal',
      label,
      value: hit.value,
      tone: 'warning',
      evidence: textOf(hit.card),
      source: hit.card,
    }],
  };
}

function timingAgreementsRow(cards) {
  const hit = firstFeature(cards, ['timingAgreementsProhibited', 'timingAgreement', 'timingAgreementText']);
  if (!hit) return null;
  const label = prohibitionLabel('timingAgreementsProhibited', hit.value);
  if (!label) return null;
  const features = cardFeatures(hit.card);
  return {
    id: 'antitrust-regulatory-timing-agreements',
    label: 'Timing agreements',
    detail: mainConceptOf(hit.card) || valueText(features.timingAgreementText) || hit.detail,
    evidence: textOf(hit.card),
    source: hit.card,
    present: true,
    signals: [{
      id: 'antitrust-regulatory-timing-agreements-signal',
      label,
      value: hit.value,
      tone: 'warning',
      evidence: textOf(hit.card),
      source: hit.card,
    }],
  };
}

const ROW_BUILDERS = [
  effortsStandardRow,
  divestitureCapRow,
  hsrDeadlineRow,
  foreignFilingsRow,
  filingResponsibilityRow,
  clearSkiesRow,
  pullRefileRow,
  timingAgreementsRow,
];

function mappedAntitrustRows(cards) {
  return ROW_BUILDERS.map((build) => build(cards)).filter(Boolean);
}

function renderSignals(row, ctx) {
  const PillCell = ctx?.primitives?.PillCell;
  if (!PillCell) return (row.signals || []).map((item) => item.label).join('\n');
  return (row.signals || []).map((item) => React.createElement(PillCell, {
    key: item.id,
    label: item.label,
    value: item.value,
    tone: item.tone,
    color: item.color,
    evidence: item.evidence,
    source: item.source,
  }));
}

function renderDetail(row, ctx) {
  const EvidenceHoverSource = ctx?.primitives?.EvidenceHoverSource;
  if (!row.detail) return null;
  if (!EvidenceHoverSource) return row.detail;
  return React.createElement(EvidenceHoverSource, { evidence: row.evidence, source: row.source, as: 'span' }, row.detail);
}

const antitrustRegulatoryConfig = {
  id: 'antitrust-regulatory',
  title: 'Antitrust / Regulatory',
  layoutSlot: 'covenants',
  selectRows(reviewDeal) {
    return mappedAntitrustRows(selectCards(reviewDeal, isAntitrust));
  },
  columns: [
    { id: 'term', header: 'Term', width: '18rem', renderCell: (row) => row.label },
    { id: 'signals', header: 'Provision', width: '18rem', renderCell: renderSignals },
    { id: 'detail', header: 'Detail', renderCell: renderDetail },
  ],
};

export { antitrustRegulatoryConfig, isAntitrust, mappedAntitrustRows, renderDetail, renderSignals };
