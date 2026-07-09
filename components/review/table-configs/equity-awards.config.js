import React from 'react';
import { cardCode, cardFeatures, cardType, selectCards, textOf, valueText } from './card-utils.js';

// Employee Equity-Award per-instrument table, rebuilt to match the legacy
// pre-schema page: ONE row per instrument (equity type | consideration |
// vesting treatment | CVR entitlement | notes), not three separately-unzipped
// lists, and not duplicated on the Consideration headline card any more --
// consideration-hero.config.js explicitly excludes CONSID-EQUITY from its
// selector (spec REBUILD-SPECS.md §2), so every equity attribute
// (equityAwardTreatment, instrumentTreatments, instrumentVesting,
// outstandingInstruments, espp_treatment, doubleTrigger, vestingAcceleration,
// optionsCvrEarnIn, optionSpread) is owned exclusively here.
//
// Why a per-CARD join is safe here (not a fabricated positional zip):
// lib/parser-v2/extract.js#expandConsidEquityByInstrument runs as part of
// the standard ingest pipeline and splits a multi-instrument CONSID-EQUITY
// section into ONE PROVISION PER INSTRUMENT before persistence, stamping
// singular `instrumentType` / `equityAwardTreatment` / `vestingAcceleration`
// fields (plus singleton outstandingInstruments/instrumentTreatments/
// instrumentVesting arrays) on each resulting card. So for the expected data
// shape, each equity-award CARD already IS one instrument -- reading one row
// per card is a real join grounded in the pipeline's own card boundary, not
// a guess across independently-ordered claims.
//
// A card that still carries >1 items in these lists (stale/un-expanded data,
// or a claims backfill that predates the per-instrument split) has no
// reliable join available -- the claims table re-sorts each attribute's
// list independently (see claims-adapter.js#buildAttributeValue), so index i
// of outstandingInstruments is not guaranteed to be index i of
// instrumentTreatments/instrumentVesting. Rather than silently fabricate
// that pairing, such rows render with an "approximate pairing" flag so a
// reviewer can go verify the source text.

function isEquityAward(card) {
  const code = cardCode(card);
  return code === 'CONSID-EQUITY' || (cardType(card) === 'CONSIDERATION' && /equity award|stock plan/i.test(`${card?.short_title || ''} ${textOf(card)}`));
}

function asList(value) {
  if (Array.isArray(value)) return value;
  return value === undefined || value === null || value === '' ? [] : [value];
}

function instrumentKeyOf(item) {
  if (!item || typeof item !== 'object') return null;
  const raw = item.instrument || item.instrumentCode || item.for;
  return raw ? String(raw).toUpperCase() : null;
}

// Match a treatment/vesting entry to an instrument by an explicit
// cross-tag (same convention extract.js#pairInstrumentWithTreatment uses)
// when present. Returns null (no fabricated fallback) when no code-based
// match exists -- callers decide how to flag that.
function matchByCode(instrumentCode, list) {
  if (!instrumentCode) return null;
  return list.find((item) => instrumentKeyOf(item) === instrumentCode) || null;
}

function isTruthyBoolLike(value) {
  return value === true || value === 'true';
}

// CVR ENTITLEMENT column (spec §2): only options carry a CVR earn-in
// condition -- RSAs/ESPP are simply cashed out/cancelled at closing with no
// ITM gate. optionsCvrEarnIn is a card-level feature (MUST_BE_ITM on
// Metsera), so it only attaches to the row whose instrument label reads as
// an option grant.
function isOptionsLabel(text) {
  return /\boption/i.test(String(text || ''));
}
function cvrEntitlementFor(instrumentLabel, features) {
  if (!isOptionsLabel(instrumentLabel)) return null;
  return valueText(features?.optionsCvrEarnIn) || null;
}

// NOTES column (spec §2, "free"): surfaces the two per-card facts that don't
// have a dedicated column -- the ESPP-specific mechanic prose (espp_treatment,
// only distinct/meaningful on the ESPP row) and the double-trigger flag
// (doubleTrigger, only meaningful for time-vesting instruments, i.e. not
// ESPP contribution rights).
function isEsppLabel(text) {
  return /espp|employee stock purchase/i.test(String(text || ''));
}
function notesFor(instrumentLabel, features) {
  if (isEsppLabel(instrumentLabel)) {
    const espp = valueText(features?.espp_treatment);
    if (espp) return espp;
  } else if (isTruthyBoolLike(features?.doubleTrigger)) {
    return 'Double-trigger: acceleration requires a qualifying termination following the change in control.';
  }
  return null;
}

function rowsForCard(card) {
  const f = cardFeatures(card);
  const instruments = asList(f.outstandingInstruments);
  const treatments = asList(f.instrumentTreatments);
  const vestings = asList(f.instrumentVesting);
  const evidence = textOf(card);

  // Common / expected case: the pipeline has already split this card down
  // to one instrument. instrumentType/equityAwardTreatment/vestingAcceleration
  // are the singular, authoritative fields for that one instrument.
  if (instruments.length <= 1) {
    const instrument = valueText(f.instrumentType) || valueText(instruments[0]);
    if (!instrument) return [];
    const treatment = valueText(f.equityAwardTreatment) || valueText(treatments[0]);
    const vesting = valueText(f.vestingAcceleration) || valueText(vestings[0]);
    return [{
      id: `equity-awards-${card.id || instrument}`,
      instrument,
      treatment: treatment || null,
      vesting: vesting || null,
      cvrEntitlement: cvrEntitlementFor(instrument, f),
      notes: notesFor(instrument, f),
      evidence,
      sourceCard: card,
      approximate: false,
      present: true,
    }];
  }

  // Un-expanded legacy shape: >1 instrument still on one card. Pair by code
  // where the source data supports it; otherwise flag the row rather than
  // guess.
  return instruments.map((inst, index) => {
    const instrumentCode = instrumentKeyOf(inst) || (inst && inst.code ? String(inst.code).toUpperCase() : null);
    const matchedTreatment = matchByCode(instrumentCode, treatments);
    const matchedVesting = matchByCode(instrumentCode, vestings);
    const approximate = !matchedTreatment && !matchedVesting;
    const treatment = matchedTreatment || (approximate ? treatments[index] : null);
    const vesting = matchedVesting || (approximate ? vestings[index] : null);
    const instrumentLabel = valueText(inst) || `Instrument ${index + 1}`;
    return {
      id: `equity-awards-${card.id || 'card'}-${index}`,
      instrument: instrumentLabel,
      treatment: valueText(treatment) || null,
      vesting: valueText(vesting) || null,
      cvrEntitlement: cvrEntitlementFor(instrumentLabel, f),
      notes: notesFor(instrumentLabel, f),
      evidence,
      sourceCard: card,
      approximate,
      present: true,
    };
  });
}

function cutoffRow(cards) {
  for (const card of cards) {
    const f = cardFeatures(card);
    const cutoff = valueText(f.cutoffTreatment);
    if (cutoff) {
      return {
        id: `equity-awards-cutoff-${card.id || 'card'}`,
        instrument: 'Award / contribution cutoff treatment',
        treatment: cutoff,
        vesting: null,
        cvrEntitlement: null,
        notes: null,
        evidence: textOf(card),
        sourceCard: card,
        approximate: false,
        present: true,
      };
    }
  }
  return null;
}

function equityAwardRows(cards) {
  const rows = (cards || []).flatMap(rowsForCard);
  const cutoff = cutoffRow(cards || []);
  return cutoff ? [...rows, cutoff] : rows;
}

function cell(text, ctx, row) {
  if (!text) return React.createElement('span', { className: 'italic text-inkFaint' }, '—');
  const EvidenceHoverSource = ctx?.primitives?.EvidenceHoverSource;
  if (!EvidenceHoverSource) return text;
  return React.createElement(EvidenceHoverSource, { evidence: row.evidence, source: row.sourceCard, as: 'span' }, text);
}

// Approximate-pairing flag, softened (spec §2) from a full amber block per
// row to a small inline icon carrying the same warning as a native `title`
// tooltip -- the reviewer still gets the exact same "verify against source
// text" wording on hover, it just no longer dominates the row.
function renderInstrument(row, ctx) {
  const label = cell(row.instrument, ctx, row);
  if (!row.approximate) return label;
  return React.createElement(
    'span',
    { className: 'inline-flex items-center gap-1' },
    label,
    React.createElement(
      'span',
      {
        className: 'inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border border-amber-300 bg-amber-50 text-[9px] font-semibold leading-none text-amber-700',
        title: 'Approximate pairing — verify against source text',
      },
      '!',
    ),
  );
}

const equityAwardsConfig = {
  id: 'equity-awards',
  title: 'Equity Awards',
  layoutSlot: 'consideration',
  selectRows(reviewDeal) {
    return equityAwardRows(selectCards(reviewDeal, isEquityAward));
  },
  columns: [
    { id: 'equityType', header: 'Equity Type', width: '14rem', renderCell: renderInstrument },
    { id: 'consideration', header: 'Consideration', renderCell: (row, ctx) => cell(row.treatment, ctx, row) },
    { id: 'vestingTreatment', header: 'Vesting Treatment', renderCell: (row, ctx) => cell(row.vesting, ctx, row) },
    { id: 'cvrEntitlement', header: 'CVR Entitlement', renderCell: (row, ctx) => cell(row.cvrEntitlement, ctx, row) },
    { id: 'notes', header: 'Notes', renderCell: (row, ctx) => cell(row.notes, ctx, row) },
  ],
};

export { equityAwardRows, equityAwardsConfig, isEquityAward, rowsForCard };
