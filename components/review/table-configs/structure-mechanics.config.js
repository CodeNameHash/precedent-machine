import React from 'react';
import taxonomy from '../../../lib/taxonomy.js';
import { allFeatures, cardCode, cardFeatures, cardType, firstFeature, makeRow, selectCards, textOf, valueText } from './card-utils.js';
import { TERM_COL_WIDTH, TERM_COL_MAX } from './layout.js';

const { labelForCode, taxonomyForFeatureKey } = taxonomy;

const ROWS = [
  ['deal-structure', 'Deal structure', 'Transaction form', ['dealStructure']],
  ['merger-form', 'Merger form', 'Transaction form', ['mergerForm']],
  ['surviving-entity', 'Surviving entity', 'Merger mechanics', ['survivingEntity']],
  ['closing-location', 'Closing location', 'Closing', ['closingLocation']],
  ['closing-timing', 'Closing timing', 'Closing', ['closingTimingProvisions', 'closingTiming', 'closingDeadline']],
  ['closing-actions', 'Closing actions', 'Closing', ['closingActions']],
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

// The effectiveTimeShort claim was corrupted on some backfilled cards -- it
// used to render "Names the Company as the surviving corporation..." instead
// of the actual filing mechanic ("Upon filing of the Certificate of Merger
// with the Delaware Secretary of State."). This is a DATA bug (real fix
// belongs at extraction/backfill); this guard is the config-side stopgap:
// never let a value matching /surviving corporation/i stand in as the
// effective time -- whether that value is the real clause text or one of
// the AI-synthesized keys below.
//
// Round 3 (Metsera): the corpus reprocess has since fixed the corrupted
// effectiveTimeShort claims, so a deal with a clean short claim
// ("Upon filing of the Certificate of Merger...") was being shadowed by its
// OWN raw ~780-char clause text because the clause-first tier ran before the
// structured-key tier. Tier order is now:
// 1. Structured keys first, KEY-FIRST / CARD-SECOND -- every card's
//    effectiveTimeShort (skipping /surviving corporation/i matches), then
//    every card's effectiveTime, then every card's mainConcept -- only once
//    a whole key has come up empty across every card does it move to the
//    next key. This is the common case and produces the short, human
//    sentence Ben wants.
// 2. The real captured clause text (primary_quote/region_full_text) second,
//    card-by-card, whenever it clears the guard -- used only when no card
//    has a clean structured value.
// 3. Only after all three keys AND the clause tier are exhausted does this
//    fall back to the raw clause text of the first card that had SOME
//    (corrupted) effective-time claim, so the row still shows the
//    filing-mechanic sentence when present in the source text.
const EFFECTIVE_TIME_KEYS = ['effectiveTimeShort', 'effectiveTime', 'mainConcept'];
const SURVIVING_CORP_RE = /surviving corporation/i;

// Ben (TopBuild vs Metsera, round 2): the clause-first scan below used to
// run over EVERY structure-mechanics card for the whole deal (STRUCT-MERGER,
// STRUCT-CLOSING, STRUCT-CHARTER, ...), in array order -- so on a deal whose
// first card or two happened to mention "surviving corporation" (normal
// merger-structure language), the scan fell through to the NEXT card's raw
// clause, even when that card was about something else entirely (Closing,
// not Effective Time). TopBuild's "Effective time" row was showing a
// mid-sentence fragment of the CLOSING clause for exactly this reason. Only
// cards that are actually coded as the effective-time provision get to
// supply their clause text; the full-deal scan is now a last resort, used
// only when the deal carries no such card at all.
const EFFECTIVE_TIME_CODE_RE = /EFF(?:TIME|ECTIVE)/i;

function effectiveTimeHit(cards) {
  const candidates = cards.filter((card) => EFFECTIVE_TIME_CODE_RE.test(cardCode(card)));
  const pool = candidates.length ? candidates : cards;
  for (const card of pool) {
    const clause = valueText(cardFeatures(card).clause);
    if (clause) return { key: 'clause', value: clause, detail: clause, card };
  }
  for (const key of EFFECTIVE_TIME_KEYS) {
    for (const card of pool) {
      const features = cardFeatures(card);
      const detail = valueText(features[key]);
      if (detail && !SURVIVING_CORP_RE.test(detail)) return { key, value: features[key], detail, card };
    }
  }
  for (const card of pool) {
    const clause = textOf(card);
    if (clause && !SURVIVING_CORP_RE.test(clause)) return { key: 'clause', value: clause, detail: clause, card };
  }
  for (const card of pool) {
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

// Tagged-value code, tolerating a bare string/other shape.
function rowCode(value) {
  if (value && typeof value === 'object') return value.code || value.value || null;
  return typeof value === 'string' ? value : null;
}

// FIX 9 (Fable investigation): when a deal's transaction_steps rows
// outnumber the mergerForm CLAIMS (e.g. SkyWater/IonQ's two-step structure
// -- a first-step reverse-triangular merger followed by a second-step
// forward merger into an LLC subsidiary -- carries only one, or zero,
// mergerForm claims because the single-card extraction never modeled a
// second step), the single mergerForm claim under-describes the real
// mechanics. Prefer deriving one natural-language line per step instead.
function isMergerSubEntity(name) {
  return /merger\s*sub/i.test(String(name || ''));
}
// Reverse triangular: a merger sub merges INTO the target and the target
// survives (the classic first-step acquisition merger). Forward / second-
// step: the (now wholly-owned) surviving entity from step 1 merges INTO a
// second merger sub -- typically an LLC -- which survives; extract.js/
// topology-detector.js label this step_kind SUBSEQUENT_MERGER. Falls back to
// a bare "Merger" when neither entity name nor step_kind is conclusive,
// rather than guessing.
function stepMergerFormLabel(step) {
  const kind = String(step?.step_kind || '').toUpperCase();
  const disappearing = step?.disappearing_entity || null;
  const surviving = step?.surviving_entity || null;
  if (/SUBSEQUENT/.test(kind) || (surviving && isMergerSubEntity(surviving))) return 'Forward merger';
  if (/MERGER/.test(kind) && disappearing && isMergerSubEntity(disappearing) && surviving && !isMergerSubEntity(surviving)) {
    return 'Reverse triangular merger';
  }
  return kind.includes('MERGER') ? 'Merger' : (kind ? prettifyStepKind(kind) : 'Merger');
}
function prettifyStepKind(kind) {
  const s = String(kind || '').replace(/_/g, ' ').trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : 'Step';
}
function stepLine(step, index) {
  const form = stepMergerFormLabel(step);
  const disappearing = step?.disappearing_entity;
  const surviving = step?.surviving_entity;
  let detail = '';
  if (disappearing && surviving) detail = ` (${disappearing} into ${surviving}; ${surviving} survives)`;
  else if (surviving) detail = ` (${surviving} survives)`;
  return `Step ${index + 1} — ${form}${detail}`;
}
function mergerFormClaimCount(cards) {
  let count = 0;
  for (const card of cards) {
    const raw = cardFeatures(card).mergerForm;
    if (raw !== null && raw !== undefined && raw !== '') count += 1;
  }
  return count;
}

function distinctMergerFormHits(cards) {
  const byIdentity = new Map();
  for (const hit of allFeatures(cards, ['mergerForm'])) {
    const identity = rowCode(hit.value) || hit.detail;
    if (!identity || byIdentity.has(identity)) continue;
    byIdentity.set(identity, hit);
  }
  return [...byIdentity.values()];
}

// A transaction can use more than one legal merger form. QXO, for example,
// closes through a reverse-triangular first merger followed by a forward
// merger. Treating mergerForm as a scalar made the review table silently
// show only the first card while the market engine correctly saw both
// claims and excluded the subject as multiple_values_for_scalar. Keep one
// compact review row, but surface every distinct form and benchmark each
// form as a multi-select treatment.
function claimedMergerFormRow(cards) {
  const hits = distinctMergerFormHits(cards);
  if (!hits.length) return null;
  const first = hits[0];
  return {
    id: 'structure-mechanics-merger-form',
    label: 'Merger form',
    kind: 'Transaction form',
    detail: hits.map((hit) => hit.detail).join('\n'),
    evidence: hits.map((hit) => textOf(hit.card)).filter(Boolean).join('\n\n'),
    source: first.card?.short_title || 'Merger',
    present: true,
    value: hits.map((hit) => hit.value),
    featureKey: 'mergerForm',
    sourceCard: first.card,
    sourceCards: hits.map((hit) => hit.card),
    signals: hits.map((hit, index) => signalFor({
      id: `structure-mechanics-merger-form-${index}`,
      detail: hit.detail,
      value: hit.value,
      featureKey: hit.key,
      sourceCard: hit.card,
      kind: 'Transaction form',
      evidence: textOf(hit.card),
    })).filter(Boolean),
    marketSubterms: [{
      key: 'forms',
      label: 'Merger forms used',
      featureKeys: ['mergerForm'],
      kind: 'multi_select',
    }],
  };
}
function stepsMergerFormRow(steps, cards) {
  if (!Array.isArray(steps) || !steps.length) return null;
  const ordered = [...steps].sort((a, b) => (Number(a.step_order) || 0) - (Number(b.step_order) || 0));
  const lines = ordered.map((step, index) => stepLine(step, index));
  const sourceCard = cards.length === 1 ? cards[0] : null;
  const featureClaimIds = sourceCard?.canonical_v2_lineage
    ?.feature_claim_revision_ids?.transactionSteps;
  return {
    id: 'structure-mechanics-merger-form',
    label: 'Merger form',
    kind: 'Transaction form',
    detail: lines.join('\n'),
    evidence: null,
    source: null,
    present: true,
    value: null,
    featureKey: 'transactionSteps',
    sourceCard,
    claimRevisionId: Array.isArray(featureClaimIds) && featureClaimIds.length === 1
      ? featureClaimIds[0]
      : null,
    signals: lines.map((line, index) => ({
      id: `structure-mechanics-merger-form-step-${index}`,
      label: line,
      value: line,
      tone: 'info',
      evidence: null,
      source: null,
    })),
  };
}

function mappedStructureRows(cards, transactionSteps) {
  const rows = ROWS
    .map(([id, label, kind, keys]) => {
      // FIX 9: the steps-derived row wins over the single-claim row for
      // 'merger-form' whenever the deal's transaction_steps genuinely carry
      // MORE structure than the mergerForm claims do.
      if (id === 'merger-form' && Array.isArray(transactionSteps) && transactionSteps.length > mergerFormClaimCount(cards)) {
        return stepsMergerFormRow(transactionSteps, cards);
      }
      if (id === 'merger-form') return claimedMergerFormRow(cards);
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
  // Ben (Bioverativ, round 2): tender-offer deals collapse "deal structure"
  // and "merger form" into the SAME concept (TWO_STEP_TENDER_OFFER on both)
  // -- unlike a one-step merger, where they're genuinely distinct
  // (ONE_STEP_MERGER vs REVERSE_TRIANGULAR_MERGER). Two rows saying the same
  // thing is duplicative; drop merger-form when its code matches
  // deal-structure's. (Only applies to the single-claim shape -- the
  // steps-derived row has no `.value` code to compare, so it's never
  // dropped here.)
  const dealStructureRow = rows.find((r) => r.id === 'structure-mechanics-deal-structure');
  const dealStructureCode = dealStructureRow && rowCode(dealStructureRow.value);
  if (dealStructureCode) {
    return rows.filter((r) => r.id !== 'structure-mechanics-merger-form' || rowCode(r.value) !== dealStructureCode);
  }
  return rows;
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

// NOTE: this 'detail' column never renders inline -- structure-mechanics is
// in ProvisionTable.jsx's FULL_TEXT_COLUMNS, so every row's detail is
// relocated behind the label's OWN collapsed "See provision" link (built
// from this exact output). A ClampedWithSeeText clamp+expander here would
// just nest a second, pointless "See provision" inside that already-
// collapsed one -- the VISIBLE long-prose surface for this table is the
// Provision/signals column (renderSignals/signalFor's fallback to
// row.detail as the pill label), not this one.
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
    return mappedStructureRows(selectCards(reviewDeal, isStructure), reviewDeal?.transactionSteps);
  },
  // Item 3: shared TERM_COL width/cap token so this table's first column
  // resolves to the SAME real width as every sibling table, at every
  // viewport (table-fixed + colgroup, not an auto-layout th hint).
  fixedLayout: true,
  columns: [
    { id: 'term', header: 'Term', width: TERM_COL_WIDTH, maxWidth: TERM_COL_MAX, renderCell: (row) => row.label },
    { id: 'signals', header: 'Provision', renderCell: renderSignals },
    { id: 'detail', header: 'Detail', renderCell: renderDetail },
  ],
};

export {
  claimedMergerFormRow, distinctMergerFormHits, effectiveTimeHit, isStructure, mappedStructureRows, mergerFormClaimCount, renderDetail, renderSignals,
  signalFor, stepLine, stepMergerFormLabel, stepsMergerFormRow, structureMechanicsConfig,
};
