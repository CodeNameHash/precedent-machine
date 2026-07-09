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
// Ben (round 6): the divestiture-cap pill read as a raw clause fragment. Where
// the cap gives the buyer broad protection (no obligation to divest / accept
// conditions), that IS the anti-hell-or-high-water posture -- say so.
function divestitureCapLabel(rawValue, card) {
  const t = `${valueText(rawValue) || ''} ${textOf(card) || ''}`.toLowerCase();
  if (/no obligation|shall not be required|not (?:be )?required to (?:divest|accept|agree|sell|dispose|hold separate|take)|has no obligation|without any obligation/.test(t)) return 'Anti-hell-or-high-water';
  if (/hell.?or.?high.?water|whatever.*(?:necessary|required)|all actions? necessary|take any and all/.test(t)) return 'Hell-or-high-water';
  return null;
}
function divestitureCapRow(cards) {
  const capHit = firstFeature(cards, ['divestitureCapDescription', 'burdenCommitment', 'divestitureCap', 'burdensomeConditionLimit']);
  const conditionHit = firstFeature(cards, ['divestitureInCondition']);
  if (!capHit && !conditionHit) return null;
  const primaryCard = capHit?.card || conditionHit.card;
  const signals = [];
  if (capHit) {
    const label = divestitureCapLabel(capHit.value, capHit.card) || shortText(readableValue(capHit.key, capHit.value), 60);
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
//
// foreignFilingsRequired is really a reference flag (its list content is a
// scratch note of which jurisdictions apply, not a fact worth rendering
// verbatim) -- the reader just needs to know foreign filings ARE required.
// The more useful fact is that the foreign filing TIMELINE is a distinct
// commitment from the HSR deadline (the former is typically an open-ended
// "as promptly as reasonably practicable" while HSR carries a fixed
// business-day count), so this row presents both limbs side by side rather
// than making the reader cross-reference the separate HSR row above.
function foreignPresenceLabel(value) {
  return isFalsy(value) ? 'Not required' : 'Required';
}

function foreignTimelineLabel(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw === 'number') return `${raw} days`;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const n = parseInt(trimmed, 10);
    return String(n) === trimmed ? `${n} days` : trimmed;
  }
  if (typeof raw === 'object') {
    const standard = raw.standard || raw.value?.standard;
    if (standard) return String(standard).trim();
    const text = raw.text || raw.value?.text;
    if (text) return String(text).trim();
    const days = raw.days ?? raw.value?.days ?? (typeof raw.value === 'number' ? raw.value : null);
    if (typeof days === 'number') return `${days} days`;
  }
  return null;
}

function foreignFilingsRow(cards) {
  const hit = firstFeature(cards, ['foreignFilingsRequired', 'foreignFilings']);
  if (!hit) return null;
  const signals = [{
    id: 'antitrust-regulatory-foreign-filings-signal',
    label: foreignPresenceLabel(hit.value),
    value: hit.value,
    tone: isFalsy(hit.value) ? 'missing' : 'present',
    evidence: textOf(hit.card),
    source: hit.card,
  }];
  const hsrHit = firstFeature(cards, ['hsrFilingDeadlineBusinessDays', 'hsrFilingDeadline', 'exHsrFilingDeadline']);
  const hsrLimb = hsrHit && (hsrDaysLabel(hsrHit.value) || shortText(hsrHit.detail, 40));
  if (hsrLimb) {
    signals.push({
      id: 'antitrust-regulatory-foreign-filings-hsr-limb',
      label: `(i) HSR — ${hsrLimb}`,
      value: hsrHit.value,
      tone: 'info',
      evidence: textOf(hsrHit.card),
      source: hsrHit.card,
    });
  }
  const foreignTimelineHit = firstFeature(cards, ['exHsrFilingDeadline', 'otherRegulatoryFilingDeadlines', 'filingDeadline']);
  const foreignLimb = foreignTimelineHit && foreignTimelineLabel(foreignTimelineHit.value);
  if (foreignLimb) {
    signals.push({
      id: 'antitrust-regulatory-foreign-filings-foreign-limb',
      label: `(ii) Foreign — ${foreignLimb}`,
      value: foreignTimelineHit.value,
      tone: 'info',
      evidence: textOf(foreignTimelineHit.card),
      source: foreignTimelineHit.card,
    });
  }
  return {
    id: 'antitrust-regulatory-foreign-filings',
    label: 'Foreign regulatory filings',
    detail: mainConceptOf(hit.card) || hit.detail,
    evidence: textOf(hit.card),
    source: hit.card,
    present: true,
    signals,
  };
}

// --- Strategy control -----------------------------------------------------
//
// This is NOT "who files" (a mechanical task) -- it's which party controls
// the antitrust strategy (litigation posture, remedy negotiation, timing
// calls). "Filing responsibility" mislabels the concept; the Term column
// now reads "Strategy control" and the pill is the bare party name (the
// Term already establishes what's being controlled, so the pill doesn't
// re-say "controls").
//
// Backfilled data carries this control tag in TWO forms for the same
// concept -- the canonical taxonomy code (CONTROL_PARENT) and a plain,
// non-canonical string (PARENT_CONTROL) -- depending on which card wrote
// it. Both must resolve to the same short pill; DATA gap noted in the WP
// report (the non-canonical form belongs at extraction/backfill, not here).
const CONTROL_SHORT_LABELS = {
  CONTROL_PARENT: 'Parent',
  PARENT_CONTROL: 'Parent',
  CONTROL_COMPANY: 'Company',
  COMPANY_CONTROL: 'Company',
  TARGET_CONTROL: 'Company',
  CONTROL_SHARED: 'Shared',
  SHARED_CONTROL: 'Shared',
  CONTROL_SILENT: 'Silent',
  SILENT_CONTROL: 'Silent',
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

function strategyControlRow(cards) {
  const hit = firstFeature(cards, ['regulatoryStrategyControlTagged', 'controllingParty', 'regulatoryStrategyControl']);
  if (!hit) return null;
  const label = controlLabel(hit.value);
  if (!label) return null;
  return {
    id: 'antitrust-regulatory-strategy-control',
    label: 'Strategy control',
    detail: mainConceptOf(hit.card) || hit.detail,
    evidence: textOf(hit.card),
    source: hit.card,
    present: true,
    signals: [{
      id: 'antitrust-regulatory-strategy-control-signal',
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

// Both pullRefile and timingAgreementsProhibited express a mutual/withheld
// consent gate on withdrawing an antitrust notification -- but that consent
// gate often carries a carved-out proviso letting Parent withdraw and
// refile UNILATERALLY within a short window (typically 2 business days).
// That proviso is the whole point for deal timing (it lets Parent reset the
// HSR clock without needing the Company's sign-off) and was previously
// dropped entirely once the consent-standard pill absorbed the row. Surface
// it as a second pill on whichever row(s) carry the underlying text --
// pullRefileText / timingAgreementText live on the same "Timing Agreements"
// card as the two boolean/coded gates, so both rows check both fields.
function withdrawalProvisoLabel(text) {
  if (!text) return null;
  const str = String(text);
  if (!/voluntarily withdraw/i.test(str)) return null;
  if (!/without[^.]{0,40}consent/i.test(str)) return null;
  const daysMatch = str.match(/refiles?[^.]{0,40}?(\d+)[^.]{0,20}?business\s*days?/i);
  const days = daysMatch ? daysMatch[1] : null;
  return days
    ? `Proviso: may withdraw without consent if refiled within ${days} business day${days === '1' ? '' : 's'}`
    : 'Proviso: may withdraw without consent (see text)';
}

function withdrawalProvisoSignal(card, idSuffix) {
  if (!card) return null;
  const features = cardFeatures(card);
  const text = [valueText(features.pullRefileText), valueText(features.timingAgreementText), textOf(card)]
    .filter(Boolean)
    .join(' ');
  const label = withdrawalProvisoLabel(text);
  if (!label) return null;
  return {
    id: `antitrust-regulatory-${idSuffix}-proviso-signal`,
    label,
    value: text,
    tone: 'warning',
    evidence: textOf(card),
    source: card,
  };
}

// Ben (round 6): pull-and-refile and timing agreements are governed by the
// SAME clause (pullRefileText === timingAgreementText) -- one can't read
// "Mutual consent" while the other reads "Prohibited". Derive a consistent
// consent-gate label for both from the shared clause text.
function consentGateLabel(card, fallbackLabel) {
  const text = [valueText(cardFeatures(card).pullRefileText), valueText(cardFeatures(card).timingAgreementText), textOf(card)].filter(Boolean).join(' ');
  if (/without[^.]{0,40}consent/i.test(text)) {
    return /not[^.]{0,30}unreasonably\s+withheld/i.test(text) ? 'Mutual consent required (not unreasonably withheld)' : 'Mutual consent required';
  }
  return fallbackLabel;
}
function pullRefileRow(cards) {
  const hit = firstFeature(cards, ['pullRefile', 'pullAndRefileRight', 'pullRefileText']);
  if (!hit) return null;
  const label = consentGateLabel(hit.card, prohibitionLabel('pullRefile', hit.value));
  if (!label) return null;
  const features = cardFeatures(hit.card);
  const signals = [{
    id: 'antitrust-regulatory-pull-refile-signal',
    label,
    value: hit.value,
    tone: 'warning',
    evidence: textOf(hit.card),
    source: hit.card,
  }];
  const proviso = withdrawalProvisoSignal(hit.card, 'pull-refile');
  if (proviso) signals.push(proviso);
  return {
    id: 'antitrust-regulatory-pull-refile',
    label: 'Pull-and-refile',
    detail: mainConceptOf(hit.card) || valueText(features.pullRefileText) || hit.detail,
    evidence: textOf(hit.card),
    source: hit.card,
    present: true,
    signals,
  };
}

function timingAgreementsRow(cards) {
  const hit = firstFeature(cards, ['timingAgreementsProhibited', 'timingAgreement', 'timingAgreementText']);
  if (!hit) return null;
  const label = consentGateLabel(hit.card, prohibitionLabel('timingAgreementsProhibited', hit.value));
  if (!label) return null;
  const features = cardFeatures(hit.card);
  // The 2-business-day withdraw-and-refile proviso is specific to pull-and-
  // refile -- it lives on that row only, not duplicated here.
  const signals = [{
    id: 'antitrust-regulatory-timing-agreements-signal',
    label,
    value: hit.value,
    tone: 'warning',
    evidence: textOf(hit.card),
    source: hit.card,
  }];
  return {
    id: 'antitrust-regulatory-timing-agreements',
    label: 'Timing agreements',
    detail: mainConceptOf(hit.card) || valueText(features.timingAgreementText) || hit.detail,
    evidence: textOf(hit.card),
    source: hit.card,
    present: true,
    signals,
  };
}

const ROW_BUILDERS = [
  effortsStandardRow,
  divestitureCapRow,
  hsrDeadlineRow,
  foreignFilingsRow,
  strategyControlRow,
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
