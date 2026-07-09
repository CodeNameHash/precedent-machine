import React from 'react';
import taxonomy from '../../../lib/taxonomy.js';
import { cardCode, cardFeatures, cardType, firstFeature, makeRow, selectCards, textOf, valueText } from './card-utils.js';

const { labelForCode, taxonomyForFeatureKey } = taxonomy;

const ROWS = [
  ['deal-structure', 'Deal structure', 'Transaction form', ['dealStructure']],
  ['merger-form', 'Merger form', 'Transaction form', ['mergerForm']],
  ['surviving-entity', 'Surviving entity', 'Merger mechanics', ['survivingEntity']],
  ['closing-location', 'Closing location', 'Closing', ['closingLocation']],
  ['closing-timing', 'Closing timing', 'Closing', ['closingTimingProvisions', 'closingTiming', 'closingDeadline']],
  ['effective-time', 'Effective time', 'Closing', ['effectiveTimeShort', 'effectiveTime', 'mainConcept']],
  ['effects', 'Effects of merger', 'Merger mechanics', ['effectsOfMergerReference']],
  ['section-251h', 'DGCL 251(h) / back-end merger', 'Tender offer', ['section251h', 'backendMergerMechanic']],
  ['short-form', 'Short-form / 90% mechanic', 'Tender offer', ['shortFormMergerMechanic']],
  ['board-designation', 'Post-acceptance board designation', 'Tender offer', ['buyerBoardDesignation']],
  ['charter-bylaws', 'Charter / bylaws at close', 'Governance', ['certificateOfIncorporation', 'bylaws', 'governanceAtEffectiveTime']],
  ['directors-officers', 'Directors / officers at close', 'Governance', ['directorsAtEffectiveTime', 'officersAtEffectiveTime']],
];

// Payment / exchange mechanics (paymentAgent / exchangeProcedures /
// lostCertificates / appraisalRightsAvailable) is deliberately NOT a row
// here. Payment mechanics is a link under Consideration's "Other provisions
// in this section" and appraisal rights is a Consideration signal -- Structure
// must never show a "Payment / exchange mechanics: Yes" boolean row.

// Equity awards (Outstanding instrument / Treatment / Vesting) render as
// their own per-instrument table -- see equity-awards.config.js -- not as
// rows in this generic term/signal grid.

// The effectiveTimeShort claim is corrupted on some backfilled cards -- it
// renders "Names the Company as the surviving corporation..." instead of the
// actual filing mechanic ("Upon filing of the Certificate of Merger with the
// Delaware Secretary of State."). This is a DATA bug (real fix belongs at
// extraction/backfill); this guard is the config-side stopgap: never let a
// value matching /surviving corporation/i stand in as the effective time.
//
// A single card's corrupted effectiveTimeShort must never shadow a GOOD
// effectiveTimeShort sitting on a different card. So this scans KEY-FIRST,
// CARD-SECOND: every card's effectiveTimeShort (skipping /surviving
// corporation/i matches), then every card's effectiveTime, then every card's
// mainConcept -- only once a whole key has come up empty across every card
// does it move to the next key. Only after all three keys are exhausted does
// it fall back to the raw clause text of the first card that had SOME
// (corrupted) effective-time claim, so the row still shows the filing-
// mechanic sentence when present in the source text.
const EFFECTIVE_TIME_KEYS = ['effectiveTimeShort', 'effectiveTime', 'mainConcept'];
const SURVIVING_CORP_RE = /surviving corporation/i;

function effectiveTimeHit(cards) {
  for (const key of EFFECTIVE_TIME_KEYS) {
    for (const card of cards) {
      const features = cardFeatures(card);
      const detail = valueText(features[key]);
      if (detail && !SURVIVING_CORP_RE.test(detail)) return { key, value: features[key], detail, card };
    }
  }
  for (const card of cards) {
    const features = cardFeatures(card);
    const hasCorruptedClaim = EFFECTIVE_TIME_KEYS.some((key) => valueText(features[key]));
    if (!hasCorruptedClaim) continue;
    const clause = textOf(card);
    if (clause) return { key: 'clause', value: clause, detail: clause, card };
  }
  return null;
}

function isStructure(card) {
  const code = cardCode(card);
  return cardType(card) === 'STRUCTURE_MECHANICS' || code.startsWith('STRUCT') || /merger|closing|effective time|tender offer/i.test(`${card?.short_title || ''} ${textOf(card)}`);
}

function readableValue(key, value) {
  const rendered = valueText(value);
  if (!rendered) return null;
  const code = value?.code || value?.value || (typeof value === 'string' ? value : null);
  const dict = taxonomyForFeatureKey(key);
  return (dict && code && labelForCode(String(code), dict)) || rendered;
}

// Read-view pill label is the resolved value alone -- the row's Term column
// already names the concept (e.g. "Merger form"), so a "Form: " / "Closing: "
// prefix on the pill only repeated it. `row.kind` is kept on the row for
// internal grouping/tone logic even though it no longer renders as a column
// or a label prefix.
function signalFor(row) {
  if (!row?.detail) return null;
  return {
    id: `${row.id}-signal`,
    label: readableValue(row.featureKey, row.value) || row.detail,
    value: row.value || row.detail,
    tone: row.kind === 'Tender offer' ? 'warning' : row.kind === 'Transaction form' ? 'info' : 'neutral',
    evidence: row.evidence,
    source: row.sourceCard,
  };
}

function mappedStructureRows(cards) {
  return ROWS
    .map(([id, label, kind, keys]) => {
      const hit = id === 'effective-time' ? effectiveTimeHit(cards) : firstFeature(cards, keys || id);
      const row = makeRow('structure-mechanics', id, label, kind, hit);
      if (!row) return null;
      return {
        ...row,
        value: hit.value,
        featureKey: hit.key,
        sourceCard: hit.card,
        signals: [signalFor({ ...row, value: hit.value, featureKey: hit.key, sourceCard: hit.card })].filter(Boolean),
      };
    })
    .filter(Boolean);
}

function renderSignals(row, ctx) {
  const PillCell = ctx?.primitives?.PillCell;
  if (!PillCell) return (row.signals || []).map((item) => item.label).join('\n');
  return (row.signals || []).map((item) => React.createElement(PillCell, {
    key: item.id,
    label: item.label,
    value: item.value,
    tone: item.tone,
    evidence: item.evidence,
    source: item.source,
  }));
}

function renderDetail(row, ctx) {
  const EvidenceHoverSource = ctx?.primitives?.EvidenceHoverSource;
  if (!EvidenceHoverSource || !row.evidence) return row.detail;
  return React.createElement(EvidenceHoverSource, { value: row.value, evidence: row.evidence, source: row.sourceCard, as: 'span' }, row.detail);
}

const structureMechanicsConfig = {
  id: 'structure-mechanics',
  title: 'Structure & Mechanics',
  layoutSlot: 'deal-mechanics',
  selectRows(reviewDeal) {
    return mappedStructureRows(selectCards(reviewDeal, isStructure));
  },
  columns: [
    { id: 'term', header: 'Term', width: '18rem', renderCell: (row) => row.label },
    { id: 'signals', header: 'Signals', width: '18rem', renderCell: renderSignals },
    { id: 'detail', header: 'Detail', renderCell: renderDetail },
  ],
};

export { effectiveTimeHit, isStructure, mappedStructureRows, renderDetail, renderSignals, signalFor, structureMechanicsConfig };
