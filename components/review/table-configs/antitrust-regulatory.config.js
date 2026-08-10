import React from 'react';
import taxonomy from '../../../lib/taxonomy.js';
import { cardCode, cardFeatures, cardType, firstFeature, selectCards, splitForCell, textOf, valueText } from './card-utils.js';
import { TERM_COL_WIDTH, TERM_COL_MAX } from './layout.js';
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

// The title/quote fallback below exists for ONE case: a genuine antitrust/
// regulatory card the classifier never subtyped, which carries neither the
// ANTITRUST_REGULATORY provision_type nor an ANTI canonical code and would
// otherwise be invisible to this table. It is NOT a classifier. Run
// unguarded it also nets every card of every OTHER family that merely
// MENTIONS antitrust/regulatory/HSR/competition words -- and that is common:
// a no-conflict / governmental-approvals representation routinely names the
// "Hart-Scott-Rodino Antitrust Improvements Act" (see the real
// REP-T-NOCONFLICT / REP-B-NOCONFLICT cards in
// tests/fixtures/canonical-v2/v1v2-comparator/topbuild-v1-provision-snapshot.json,
// a V1 snapshot of a real production deal, which this guard now keeps out),
// and a Director & Officer indemnification covenant routinely names
// "regulatory" investigations among the indemnified claims (the real COV-DO
// cards in tests/fixtures/canonical-v2/dno-live-run/corpus-cards.json). Once
// such a card is selected, mappedAntitrustRows() folds it into this table's
// card set, and any row builder whose firstFeature() lookup happens to match
// one of its features attributes that row to a foreign clause.
//
// So the fallback is narrowed, not removed: it applies only to a card NO
// family has claimed. A card already carrying another family's
// provision_type or canonical code belongs to that family, and a word match
// in its quote must never re-home it here.
const ANTITRUST_TEXT_RE = /antitrust|regulatory|HSR|competition/i;

// cardType() reads provision_type first and falls back to `type`; canonical
// antitrust cards carry 'ANTITRUST_REGULATORY' on the former and 'ANTI' on
// the latter (lib/canonical-v2/antitrust-product-projection.js), so both
// spellings count as this family's own.
const ANTITRUST_CARD_TYPES = new Set(['ANTITRUST_REGULATORY', 'ANTI']);

function isClaimedByAnotherFamily(card) {
  const type = cardType(card);
  if (type && !ANTITRUST_CARD_TYPES.has(type)) return true;
  const code = cardCode(card);
  return Boolean(code) && !code.startsWith('ANTI');
}

function isAntitrust(card) {
  if (cardType(card) === 'ANTITRUST_REGULATORY' || cardCode(card).startsWith('ANTI')) return true;
  if (isClaimedByAnotherFamily(card)) return false;
  return ANTITRUST_TEXT_RE.test(`${card?.short_title || ''} ${textOf(card)}`);
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

function isNativeProjection(card) {
  return card?.canonical_v2_lineage?.source === 'CANONICAL_V2_NATIVE_CLAIM';
}

function cardPartyLabel(card) {
  const party = card?.party || null;
  if (!party) {
    if (isNativeProjection(card)) throw new TypeError('Antitrust row party is ambiguous');
    return null;
  }
  if (typeof party.role !== 'string' || !party.role.trim()
    || typeof party.value !== 'string' || !party.value.trim()
    || typeof party.capacity !== 'string' || !party.capacity.trim()) {
    throw new TypeError('Antitrust row party is ambiguous');
  }
  return party.value.trim();
}

function rowPartyLabels(row) {
  const sourceCards = [
    row.sourceCard,
    row.source,
    ...(row.signals || []).map((signal) => signal.source),
  ].filter(Boolean);
  const uniqueCards = [...new Map(sourceCards.map((card) => [
    card.provision_instance_id || card.id || card,
    card,
  ])).values()];
  return [...new Set(uniqueCards.map(cardPartyLabel).filter(Boolean))];
}

// Fallback ONLY -- lib/schema/features.js documents mainConcept as "Fallback
// one-sentence provision summary ... when no more specific structured field
// explains the provision." It is an AI paraphrase, not verbatim clause text,
// so every detail: assignment below must try the real structured value
// first and only fall through to this when nothing else was extracted
// (Ben: the "see text" affordance must ALWAYS show the real provision text,
// never a summary -- same fix already applied to representations-qualifiers
// config's per-rep clause -- "the summary isn't the full rep").
function mainConceptOf(card) {
  return valueText(cardFeatures(card).mainConcept) || null;
}

function shortText(text, max = 70) {
  if (!text) return null;
  // E (truncation sweep): drop the literal "…" -- callers wire this
  // through PillCell with evidence, which already exposes the full text.
  const { short } = splitForCell(text, max);
  return short;
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
    detail: valueText(hit.value) || mainConceptOf(hit.card),
    evidence: textOf(hit.card),
    source: hit.card,
    featureKeys: ['antitrustEffortsStandard', 'effortsStandard'],
    marketProvisionCodes: ['ANTI-EFFORTS'],
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
// conditions), that IS the anti-hell-or-high-water posture. The canonical
// code (BURDEN_COMMITMENT.ANTI_HOHW, labelled "Anti-hell-or-high-water" in
// lib/taxonomy.js) now reaches card.features via the claims adapter, so this
// row reads the code through readableValue()/labelForCode instead of
// re-deriving the posture from a render-time regex over the clause text.
function divestitureCapRow(cards) {
  const capHit = firstFeature(cards, ['burdenCommitment', 'divestitureCapDescription', 'divestitureCap', 'burdensomeConditionLimit']);
  const conditionHit = firstFeature(cards, ['divestitureInCondition']);
  const amountHit = firstFeature(cards, ['divestitureCapAmount']);
  const currencyHit = firstFeature(cards, ['divestitureCapCurrency']);
  const baselineHit = firstFeature(cards, ['burdenBaseline']);
  const baselineRefHit = firstFeature(cards, ['burdenBaselineRef']);
  if (!capHit && !conditionHit && !amountHit && !baselineHit) return null;
  const primaryCard = capHit?.card || amountHit?.card || baselineHit?.card || conditionHit.card;
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
  if (amountHit) {
    const currency = currencyHit ? valueText(currencyHit.value) : null;
    signals.push({
      id: 'antitrust-regulatory-divestiture-cap-amount-signal',
      label: `${currency ? `${currency} ` : ''}${valueText(amountHit.value)}`,
      value: amountHit.value,
      tone: 'warning',
      evidence: textOf(amountHit.card),
      source: amountHit.card,
    });
  }
  if (baselineHit) {
    const baselineLabel = readableValue('burdenBaseline', baselineHit.value);
    if (baselineLabel) signals.push({
      id: 'antitrust-regulatory-divestiture-cap-baseline-signal',
      label: baselineLabel,
      value: baselineHit.value,
      tone: 'neutral',
      evidence: textOf(baselineRefHit?.card || baselineHit.card),
      source: baselineRefHit?.card || baselineHit.card,
    });
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
    detail: valueText(baselineRefHit?.value) || (capHit && valueText(cardFeatures(capHit.card).capDetail)) || capHit?.detail || conditionHit?.detail || mainConceptOf(capHit?.card) || mainConceptOf(conditionHit?.card),
    evidence: textOf(primaryCard),
    source: primaryCard,
    featureKeys: ['burdenCommitment', 'divestitureCap', 'divestitureCapAmount', 'divestitureCapCurrency', 'burdenBaseline', 'burdenBaselineRef', 'hellOrHighWater'],
    marketProvisionCodes: ['ANTI-BURDEN'],
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
  const hit = firstFeature(cards, ['hsrFilingDeadlineDays', 'hsrFilingDeadlineBusinessDays', 'hsrFilingDeadline', 'exHsrFilingDeadline']);
  const requiredHit = firstFeature(cards, ['hsrFilingRequired']);
  if (!hit && (!requiredHit || !isTruthy(requiredHit.value))) return null;
  const sourceHit = hit || requiredHit;
  const dayKind = valueText(cardFeatures(sourceHit.card).hsrFilingDeadlineDayKind);
  const numeric = hit && typeof hit.value !== 'object' ? Number(hit.value) : null;
  const label = hit
    ? (Number.isFinite(numeric) && dayKind
      ? `${numeric} ${dayKind.toLowerCase()} days`
      : hsrDaysLabel(hit.value) || shortText(hit.detail, 40))
    : 'Required';
  if (!label) return null;
  const timingTrigger = valueText(cardFeatures(sourceHit.card).hsrFilingDeadlineTimingTrigger);
  const anchoredLabel = timingTrigger ? `${label} ${timingTrigger}` : label;
  return {
    id: 'antitrust-regulatory-hsr-deadline',
    label: hit ? 'HSR filing deadline' : 'HSR filing',
    detail: sourceHit.detail || mainConceptOf(sourceHit.card),
    evidence: textOf(sourceHit.card),
    source: sourceHit.card,
    featureKeys: [
      'hsrFilingDeadlineDays',
      'hsrFilingRequired',
      'hsrFilingDeadlineDayKind',
      'hsrFilingDeadlineBusinessDays',
      'hsrFilingDeadlineTimingRelation',
      'hsrFilingDeadlineTimingTrigger',
    ],
    marketProvisionCodes: ['ANTI-FILING'],
    present: true,
    signals: [{
      id: 'antitrust-regulatory-hsr-deadline-signal',
      label: anchoredLabel,
      value: sourceHit.value,
      tone: 'info',
      evidence: textOf(sourceHit.card),
      source: sourceHit.card,
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

const FILING_TIMING_LABELS = {
  AS_PROMPTLY_AS_PRACTICABLE: 'As promptly as practicable',
  AS_PROMPTLY_AS_REASONABLY_PRACTICABLE: 'As promptly as reasonably practicable',
  AS_SOON_AS_PRACTICABLE: 'As soon as practicable',
  AS_SOON_AS_REASONABLY_PRACTICABLE: 'As soon as reasonably practicable',
  PROMPTLY: 'Promptly',
};

function isHsrRegimeLabel(value) {
  return /^HSR Act$/i.test(String(value || '').trim())
    || /^Hart[- ]Scott[- ]Rodino(?: Antitrust Improvements)? Act/i.test(String(value || '').trim());
}

function filingFactEntries(cards) {
  const entries = [];
  const seen = new Set();
  for (const card of cards) {
    const raw = cardFeatures(card).regulatoryFilingFacts;
    for (const fact of (Array.isArray(raw) ? raw : (raw ? [raw] : []))) {
      if (!fact || typeof fact !== 'object' || isHsrRegimeLabel(fact.filingRegime)) continue;
      const key = JSON.stringify(fact);
      if (seen.has(key)) continue;
      seen.add(key);
      entries.push({ fact, card });
    }
  }
  return entries;
}

function filingFactLabel(fact) {
  if (fact.factKind === 'OBLIGATION') return `Required: ${fact.filingRegime}`;
  if (fact.factKind === 'DEADLINE_DAYS') {
    const dayKind = fact.dayKind ? `${String(fact.dayKind).toLowerCase()} ` : '';
    const trigger = fact.timingTrigger ? ` ${fact.timingTrigger}` : '';
    return `${fact.filingRegime}: ${fact.value} ${dayKind}days${trigger}`;
  }
  if (fact.factKind === 'FIXED_DATE') return `${fact.filingRegime}: ${fact.fixedDate}`;
  if (fact.factKind === 'TIMING_STANDARD') {
    return `${fact.filingRegime}: ${FILING_TIMING_LABELS[fact.timingStandard] || prettifyCode(fact.timingStandard)}`;
  }
  return null;
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
  const nativeFacts = filingFactEntries(cards);
  if (nativeFacts.length > 0) {
    const first = nativeFacts[0];
    const signals = nativeFacts.map(({ fact, card }, index) => ({
      id: `antitrust-regulatory-non-hsr-filing-fact-${index}`,
      label: filingFactLabel(fact),
      value: fact,
      tone: fact.factKind === 'OBLIGATION' ? 'present' : 'info',
      evidence: fact.exactEvidence || textOf(card),
      source: card,
    })).filter(({ label }) => Boolean(label));
    if (!signals.length) return null;
    return {
      id: 'antitrust-regulatory-foreign-filings',
      label: 'Non-HSR regulatory filings',
      detail: signals.map(({ label }) => label).join('; '),
      evidence: first.fact.exactEvidence || textOf(first.card),
      source: first.card,
      featureKeys: ['regulatoryFilingFacts', 'regulatoryFilingTimingStandard'],
      marketProvisionCodes: ['ANTI-FILING'],
      present: true,
      signals,
    };
  }
  const hit = firstFeature(cards, ['foreignFilingsRequired', 'regulatoryFilingRegimes', 'foreignFilings']);
  if (!hit) return null;
  const regimeHit = firstFeature(cards, ['regulatoryFilingRegimes']);
  const regimeLabel = regimeHit && valueText(regimeHit.value);
  const signals = [{
    id: 'antitrust-regulatory-foreign-filings-signal',
    label: regimeLabel ? `Required: ${regimeLabel}` : foreignPresenceLabel(hit.value),
    value: hit.value,
    tone: isFalsy(hit.value) ? 'missing' : 'present',
    evidence: textOf(hit.card),
    source: hit.card,
  }];
  const foreignTimelineHit = firstFeature(cards, ['regulatoryFilingTimingStandard', 'regulatoryFilingFixedDate', 'exHsrFilingDeadline', 'otherRegulatoryFilingDeadlines', 'filingDeadline']);
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
    label: 'Non-HSR regulatory filings',
    detail: hit.detail || mainConceptOf(hit.card),
    evidence: textOf(hit.card),
    source: hit.card,
    featureKeys: ['foreignFilingsRequired', 'regulatoryFilingRegimes', 'regulatoryFilingTimingStandard', 'regulatoryFilingFixedDate', 'otherRegulatoryFilingDeadlines'],
    marketProvisionCodes: ['ANTI-FILING'],
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
  BUYER_WITH_SETTLEMENT_GAG: 'Buyer, settlement gated',
  BUYER_LEAD: 'Buyer lead',
  PRINCIPAL_WITH_VETO: 'Principal, counterparty veto',
  JURISDICTION_SPLIT: 'Split by jurisdiction',
  SELLER_LED: 'Seller lead',
  BUYER: 'Parent',
  TARGET: 'Company',
  MUTUAL: 'Shared',
  SILENT: 'Silent',
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
  const hit = firstFeature(cards, ['regulatoryStrategyControlTagged', 'controllingParty', 'regulatoryStrategyControl', 'partyControlsStrategy']);
  if (!hit) return null;
  const label = controlLabel(hit.value);
  if (!label) return null;
  return {
    id: 'antitrust-regulatory-strategy-control',
    label: 'Strategy control',
    detail: valueText(cardFeatures(hit.card).regulatoryStrategyScope) || hit.detail || mainConceptOf(hit.card),
    evidence: textOf(hit.card),
    source: hit.card,
    featureKeys: ['regulatoryStrategyControlTagged', 'regulatoryStrategyControlHolder', 'regulatoryStrategyScope', 'partyControlsStrategy'],
    marketProvisionCodes: ['ANTI-STRATEGY'],
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
  const hit = firstFeature(cards, ['regulatoryNonImpedimentRequired', 'clearSkiesParent', 'clearSkiesCompany', 'clearSkies']);
  if (!hit) return null;
  const truthy = isTruthy(hit.value);
  const falsy = isFalsy(hit.value);
  if (!truthy && !falsy) return null;
  const features = cardFeatures(hit.card);
  const scope = valueText(features.regulatoryImpairmentEffect) || valueText(features.regulatoryProhibitedAction) || valueText(features.clearSkiesParentScope) || valueText(features.clearSkiesCompanyScope);
  return {
    id: 'antitrust-regulatory-clear-skies',
    label: cardCode(hit.card) === 'ANTI-NOACTION' ? 'No inconsistent action' : 'Clear-skies covenant',
    detail: scope || hit.detail || mainConceptOf(hit.card),
    evidence: textOf(hit.card),
    source: hit.card,
    featureKeys: ['regulatoryNonImpedimentRequired', 'regulatoryProhibitedAction', 'regulatoryImpairmentEffect', 'clearSkiesParent', 'clearSkiesCompany'],
    marketProvisionCodes: ['ANTI-NOACTION'],
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

// pull-and-refile and timing agreements each carry their own canonical code
// (PULL_REFILE / TIMING_AGREEMENT dictionaries), threaded into card.features
// by the claims adapter. Read each row's label from its own code via
// prohibitionLabel()/labelForCode -- do NOT force the two rows to a single
// shared label from a render-time regex over the clause text. When extraction
// assigns different codes to the same clause (e.g. Metsera: pullRefile
// MUTUAL_CONSENT vs timingAgreementsProhibited NOT_UNREASONABLY_WITHHELD) the
// two pills legitimately differ; reconcile that upstream at extraction, not
// by masking it here.
function pullRefileRow(cards) {
  const hit = firstFeature(cards, ['pullRefile', 'pullAndRefileRight', 'pullRefileText']);
  if (!hit) return null;
  const label = prohibitionLabel('pullRefile', hit.value);
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
  const nativeProviso = valueText(features.pullRefileProviso);
  const proviso = nativeProviso ? {
    id: 'antitrust-regulatory-pull-refile-proviso-signal',
    label: nativeProviso,
    value: nativeProviso,
    tone: 'warning',
    evidence: textOf(hit.card),
    source: hit.card,
  } : (isNativeProjection(hit.card) ? null : withdrawalProvisoSignal(hit.card, 'pull-refile'));
  if (proviso) signals.push(proviso);
  return {
    id: 'antitrust-regulatory-pull-refile',
    label: 'Pull-and-refile',
    detail: valueText(features.pullRefileText) || hit.detail || mainConceptOf(hit.card),
    evidence: textOf(hit.card),
    source: hit.card,
    featureKeys: ['pullRefile', 'pullRefileProviso', 'pullRefileProvisoDays', 'pullRefileProvisoDayKind'],
    marketProvisionCodes: ['ANTI-AGREEMENTS'],
    present: true,
    signals,
  };
}

function timingAgreementsRow(cards) {
  const hit = firstFeature(cards, ['timingAgreementsProhibited', 'timingAgreement', 'timingAgreementText']);
  if (!hit) return null;
  const label = prohibitionLabel('timingAgreementsProhibited', hit.value);
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
    detail: valueText(features.timingAgreementText) || hit.detail || mainConceptOf(hit.card),
    evidence: textOf(hit.card),
    source: hit.card,
    featureKeys: ['timingAgreement'],
    marketProvisionCodes: ['ANTI-AGREEMENTS'],
    present: true,
    signals,
  };
}

function litigationObligationRow(cards) {
  const hit = firstFeature(cards, ['litigationObligation']);
  if (!hit) return null;
  const label = readableValue('litigationObligation', hit.value);
  if (!label) return null;
  return {
    id: 'antitrust-regulatory-litigation',
    label: 'Regulatory litigation',
    detail: hit.detail || mainConceptOf(hit.card),
    evidence: textOf(hit.card),
    source: hit.card,
    featureKeys: ['litigationObligation'],
    marketProvisionCodes: ['ANTI-LITIGATION'],
    present: true,
    signals: [{
      id: 'antitrust-regulatory-litigation-signal',
      label,
      value: hit.value,
      tone: 'warning',
      evidence: textOf(hit.card),
      source: hit.card,
    }],
  };
}

function consultationRightsRow(cards) {
  const hit = firstFeature(cards, ['consultationTier']);
  if (!hit) return null;
  const label = readableValue('consultationTier', hit.value);
  if (!label) return null;
  return {
    id: 'antitrust-regulatory-consultation',
    label: 'Consultation rights',
    detail: valueText(cardFeatures(hit.card).consultationRightHolder) || hit.detail || mainConceptOf(hit.card),
    evidence: textOf(hit.card),
    source: hit.card,
    featureKeys: ['consultationTier', 'consultationRightHolder'],
    marketProvisionCodes: ['ANTI-CONSULT'],
    present: true,
    signals: [{
      id: 'antitrust-regulatory-consultation-signal',
      label,
      value: hit.value,
      tone: 'info',
      evidence: textOf(hit.card),
      source: hit.card,
    }],
  };
}

function obligationRow(cards, {
  id, label, presenceKey, detailKeys, marketProvisionCode, tone = 'info', signalLabel,
}) {
  const hit = firstFeature(cards, [presenceKey]);
  if (!hit || !isTruthy(hit.value)) return null;
  const seenDetailLabels = new Set();
  const detailHits = detailKeys.map((key) => firstFeature(cards, [key])).filter((detailHit) => {
    if (!detailHit) return false;
    const labelValue = valueText(detailHit.value);
    if (!labelValue || seenDetailLabels.has(labelValue)) return false;
    seenDetailLabels.add(labelValue);
    return true;
  });
  const details = detailHits.map((detailHit) => valueText(detailHit.value));
  const detail = details.join('; ') || null;
  const signals = [{
    id: `${id}-signal`,
    label: signalLabel,
    value: hit.value,
    tone,
    evidence: textOf(hit.card),
    source: hit.card,
  }];
  detailHits.forEach((detailHit, index) => {
    const detailLabel = valueText(detailHit.value);
    if (!detailLabel) return;
    signals.push({
      id: `${id}-detail-signal-${index}`,
      label: detailLabel,
      value: detailHit.value,
      tone: 'neutral',
      evidence: textOf(detailHit.card),
      source: detailHit.card,
    });
  });
  return {
    id,
    label,
    detail: detail || hit.detail || mainConceptOf(hit.card),
    evidence: textOf(hit.card),
    source: hit.card,
    featureKeys: [presenceKey, ...detailKeys],
    marketProvisionCodes: [marketProvisionCode],
    present: true,
    signals,
  };
}

function cooperationRow(cards) {
  return obligationRow(cards, {
    id: 'antitrust-regulatory-cooperation', label: 'Regulatory cooperation',
    presenceKey: 'regulatoryCooperationRequired', detailKeys: ['regulatoryCooperationScope'],
    marketProvisionCode: 'ANTI-COOPERATE', signalLabel: 'Required',
  });
}

function informationSharingRow(cards) {
  return obligationRow(cards, {
    id: 'antitrust-regulatory-information-sharing', label: 'Information sharing',
    presenceKey: 'regulatoryInformationSharingRequired',
    detailKeys: ['regulatoryInformationScope', 'regulatoryInformationProtections', 'regulatoryInformationProtection'],
    marketProvisionCode: 'ANTI-INFO', signalLabel: 'Required',
  });
}

function notificationRow(cards) {
  return obligationRow(cards, {
    id: 'antitrust-regulatory-notification', label: 'Regulatory notification',
    presenceKey: 'regulatoryNotificationRequired', detailKeys: ['regulatoryNotificationEvent', 'regulatoryNotificationTiming'],
    marketProvisionCode: 'ANTI-NOTIFY', signalLabel: 'Required',
  });
}

function deferredEvidenceRows(cards) {
  return cards.filter((card) => (
    card?.canonical_v2_lineage?.source === 'CANONICAL_V2_OPEN_WORLD_EVIDENCE'
    || isTruthy(cardFeatures(card).antitrustUnresolvedEvidence)
  )).map((card, index) => {
    const reason = valueText(cardFeatures(card).antitrustReviewReason)
      || card?.canonical_v2_lineage?.reason
      || 'Unresolved antitrust evidence';
    return {
      id: `antitrust-regulatory-deferred-evidence-${index}`,
      label: 'Needs review',
      detail: reason,
      evidence: textOf(card),
      source: card,
      sourceCard: card,
      featureKeys: ['antitrustUnresolvedEvidence', 'antitrustReviewReason'],
      marketProvisionCodes: [],
      present: true,
      signals: [{
        id: `antitrust-regulatory-deferred-evidence-signal-${index}`,
        label: 'Unresolved',
        value: reason,
        tone: 'warning',
        evidence: textOf(card),
        source: card,
      }],
    };
  });
}

const ROW_BUILDERS = [
  effortsStandardRow,
  divestitureCapRow,
  litigationObligationRow,
  hsrDeadlineRow,
  foreignFilingsRow,
  strategyControlRow,
  consultationRightsRow,
  cooperationRow,
  informationSharingRow,
  notificationRow,
  clearSkiesRow,
  pullRefileRow,
  timingAgreementsRow,
];

// Item 2 (r5): every row builder above already sets `source` (the card the
// HoverSource popover reads) but resolveRowCard (provisionIndexHelpers.js)
// only reads card/sourceCard/sourceCards -- copy `source` onto `sourceCard`
// here, once, rather than touching all eight row builders individually.
function mappedAntitrustRows(cards) {
  for (const card of cards) cardPartyLabel(card);
  return [...ROW_BUILDERS.map((build) => build(cards)).filter(Boolean), ...deferredEvidenceRows(cards)].map((row) => {
    const sourcedRow = row.sourceCard || !row.source ? row : { ...row, sourceCard: row.source };
    const partyLabels = rowPartyLabels(sourcedRow);
    return {
      ...sourcedRow,
      partyLabel: partyLabels.length === 1 ? partyLabels[0] : null,
      partyLabels,
    };
  });
}

function renderSignals(row, ctx) {
  const PillCell = ctx?.primitives?.PillCell;
  const partyLabels = row.partyLabels || (row.partyLabel ? [row.partyLabel] : []);
  if (!PillCell) {
    return [
      ...partyLabels.map((partyLabel) => `Party: ${partyLabel}`),
      ...(row.signals || []).map((item) => item.label),
    ].join('\n');
  }
  return React.createElement(
    'div',
    { className: 'space-y-1.5' },
    partyLabels.map((partyLabel) => React.createElement(
      'div',
      { key: partyLabel, className: 'text-[11px] text-inkLight' },
      `Party: ${partyLabel}`,
    )),
    React.createElement(
      'div',
      { className: 'flex flex-wrap gap-1' },
      (row.signals || []).map((item) => React.createElement(PillCell, {
        key: item.id,
        label: item.label,
        value: item.value,
        tone: item.tone,
        color: item.color,
        evidence: item.evidence,
        source: item.source,
      })),
    ),
  );
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
  fixedLayout: true,
  columns: [
    { id: 'term', header: 'Term', width: TERM_COL_WIDTH, maxWidth: TERM_COL_MAX, renderCell: (row) => row.label },
    { id: 'signals', header: 'Provision', renderCell: renderSignals },
    { id: 'detail', header: 'Detail', renderCell: renderDetail },
  ],
};

export { antitrustRegulatoryConfig, isAntitrust, mappedAntitrustRows, renderDetail, renderSignals };
