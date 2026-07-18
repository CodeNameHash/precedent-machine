import React from 'react';
import { cardCode, cardFeatures, cardType, selectCards, textOf, valueText } from './card-utils.js';

// Employee Equity-Award per-instrument table (Feedback round 2, items #4-#8).
//
// THE DATA BUG THIS REPLACES (DATA FINDINGS #5): the previous version built
// rows by zipping three PARALLEL lists positionally --
// outstandingInstruments[i] <-> instrumentTreatments[i] <-> instrumentVesting[i].
// Those lists are independently re-sorted (alphabetically/by canonical code)
// by claims-adapter.js#buildAttributeValue with no shared index key, so index
// i of one list is NOT guaranteed to be index i of another. On Metsera that
// silently paired ESPP with "Accel Else Double Trigger" -- a vesting clause
// that actually belongs to Stock Options -- because both lists happened to
// sort ESPP/ACCEL_ELSE_DOUBLE_TRIGGER into the same slot alphabetically.
//
// THE FIX: `equityAwardTreatment` is, for a not-yet-split CONSID-EQUITY card,
// a single JSON object KEYED BY INSTRUMENT -- e.g. Metsera's real card carries
// `{ espp: "...", stockOptions: "...", restrictedStock: "..." }`, each value
// the actual clause prose for THAT instrument. That is the one place the
// source data ties a treatment description to a NAMED instrument, so it is
// the reliable join -- not a fabricated pairing across independently-sorted
// lists. Consideration/vesting short labels are then classified straight off
// each instrument's OWN prose (see classifyConsiderationType/
// classifyVestingTreatment below), so "double-trigger" language only ever
// lands on the instrument whose own clause actually contains it.
//
// Two other card shapes are still handled, in priority order:
//   1. equityAwardTreatment keyed-instrument map (above) -- PREFERRED.
//   2. A card the pipeline's expandConsidEquityByInstrument() has already
//      split to one instrument (instrumentType/equityAwardTreatment are
//      singular tagged values for that one instrument) -- still a confident,
//      un-guessed join.
//   3. Legacy un-split, un-keyed data (>1 outstandingInstruments, no
//      equityAwardTreatment map): pairs by an explicit instrument tag when
//      present, else degrades to positional order. Per punch-list #4 this no
//      longer carries a distinct "approximate" warning -- once real deals
//      carry shape 1, this branch is a rare best-effort fallback, not the
//      common case worth a dedicated UI treatment for.
// If an instrument named in outstandingInstruments has no corresponding
// equityAwardTreatment entry, it is surfaced as its own flagged row rather
// than silently dropped or guessed (see missingInstrumentRows).

function isEquityAward(card) {
  const code = cardCode(card);
  return code === 'CONSID-EQUITY' || (cardType(card) === 'CONSIDERATION' && /equity award|stock plan/i.test(`${card?.short_title || ''} ${textOf(card)}`));
}

function asList(value) {
  if (Array.isArray(value)) return value;
  return value === undefined || value === null || value === '' ? [] : [value];
}

function codeOf(value) {
  if (typeof value === 'string') return value.toUpperCase();
  return value && typeof value === 'object' && !Array.isArray(value) && value.code ? String(value.code).toUpperCase() : null;
}

function instrumentKeyOf(item) {
  if (!item || typeof item !== 'object') return null;
  const raw = item.instrument || item.instrumentCode || item.for;
  return raw ? String(raw).toUpperCase() : null;
}

// Match a treatment/vesting entry to an instrument by an explicit
// cross-tag (same convention extract.js#pairInstrumentWithTreatment uses)
// when present. Returns null (no fabricated fallback) when no code-based
// match exists -- callers decide how to degrade.
function matchByCode(instrumentCode, list) {
  if (!instrumentCode) return null;
  return list.find((item) => instrumentKeyOf(item) === instrumentCode) || null;
}

// --- Text-mention pairing (Skechers cross-wire fix) -----------------------
// Legacy shape-3 cards carry outstandingInstruments / instrumentTreatments /
// instrumentVesting as three independent tagged lists with NO cross-tag.
// The lists are independently re-ordered by the claims adapter, so pairing
// by index cross-wires rows (Skechers: the RSU row showed the RSA clause's
// consideration and the PSA clause's vesting). The one place the source
// data ties a clause to its instrument is the clause PROSE itself ("each
// Company RSA ...", "each Company PSA ...", "... under the Company ESPP").
// Match each instrument to the entry whose own text names it — and names NO
// OTHER outstanding instrument, so a multi-instrument sentence never gets
// claimed on a guess. Unmatched slots degrade to the old positional order.
const INSTRUMENT_MENTION_RES = {
  RESTRICTED_STOCK: /\brsas?\b|restricted\s+stock\s+award/i,
  RSU: /\brsus?\b|restricted\s+stock\s+unit/i,
  PSU: /\bpsus?\b|\bpsas?\b|performance\s+(?:stock|share|unit)/i,
  ESPP: /\bespp\b|stock\s+purchase\s+plan/i,
  STOCK_OPTIONS: /\boptions?\b/i,
  SAR: /\bsars?\b|stock\s+appreciation/i,
  PHANTOM_STOCK: /phantom\s+stock/i,
  DSU: /\bdsus?\b|deferred\s+stock\s+unit/i,
};

function entryText(item) {
  if (typeof item === 'string') return item;
  if (item && typeof item === 'object') return String(item.text || item.label || '');
  return '';
}

function pairListByMention(instrumentCodes, list) {
  const claimed = new Set();
  const matches = instrumentCodes.map((code, i) => {
    const re = code ? INSTRUMENT_MENTION_RES[code] : null;
    if (!re) return null;
    for (let j = 0; j < list.length; j += 1) {
      if (claimed.has(j)) continue;
      const text = entryText(list[j]);
      if (!re.test(text)) continue;
      const mentionsOther = instrumentCodes.some((other, k) =>
        k !== i && other && INSTRUMENT_MENTION_RES[other] && INSTRUMENT_MENTION_RES[other].test(text));
      if (mentionsOther) continue;
      claimed.add(j);
      return list[j];
    }
    return null;
  });
  // Positional fallback over the UNCLAIMED remainder for instruments with
  // no unique text match — same behavior as before for data with no
  // instrument mentions at all.
  let cursor = 0;
  return matches.map((m) => {
    if (m) return m;
    while (cursor < list.length && claimed.has(cursor)) cursor += 1;
    return cursor < list.length ? list[cursor++] : undefined;
  });
}

// --- Instrument-key -> canonical code / friendly label -------------------
const INSTRUMENT_KEY_META = {
  espp: { code: 'ESPP', label: 'ESPP (Employee Stock Purchase Plan)' },
  options: { code: 'STOCK_OPTIONS', label: 'Stock Options' },
  stockoptions: { code: 'STOCK_OPTIONS', label: 'Stock Options' },
  restrictedstock: { code: 'RESTRICTED_STOCK', label: 'Restricted Stock Awards' },
  rsa: { code: 'RESTRICTED_STOCK', label: 'Restricted Stock Awards' },
  rsas: { code: 'RESTRICTED_STOCK', label: 'Restricted Stock Awards' },
  restrictedstockunits: { code: 'RSU', label: 'RSUs' },
  rsu: { code: 'RSU', label: 'RSUs' },
  rsus: { code: 'RSU', label: 'RSUs' },
  performancestockunits: { code: 'PSU', label: 'PSUs' },
  psu: { code: 'PSU', label: 'PSUs' },
  psus: { code: 'PSU', label: 'PSUs' },
  sar: { code: 'SAR', label: 'Stock Appreciation Rights' },
  sars: { code: 'SAR', label: 'Stock Appreciation Rights' },
  stockappreciationrights: { code: 'SAR', label: 'Stock Appreciation Rights' },
  phantomstock: { code: 'PHANTOM_STOCK', label: 'Phantom Stock' },
  dsu: { code: 'DSU', label: 'Deferred Stock Units' },
  dsus: { code: 'DSU', label: 'Deferred Stock Units' },
  directorequity: { code: 'DIRECTOR_EQUITY', label: 'Director Equity Awards' },
  otherequity: { code: 'OTHER_EQUITY', label: 'Other Equity Awards' },
};

function humanizeInstrumentKey(key) {
  const spaced = String(key || '')
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim();
  return spaced.replace(/\b\w/g, (ch) => ch.toUpperCase()) || 'Equity Award';
}

function instrumentMetaForKey(key) {
  return INSTRUMENT_KEY_META[String(key).toLowerCase()] || { code: null, label: humanizeInstrumentKey(key) };
}

// (Item 5) codeOf() only uppercases -- outstandingInstruments' stored codes
// are plural strings like "PSUs"/"RSUs" that uppercase to PSUS/RSUS, which
// are NOT the canonical PSU/RSU codes equityAwardTreatment rows carry.
// Resolve through the same INSTRUMENT_KEY_META dict the rest of this file
// uses so a raw code that happens to be a known key (case-insensitively)
// normalizes to its canonical form before being compared/deduped.
function normalizeInstrumentCode(raw) {
  if (!raw) return raw;
  const meta = INSTRUMENT_KEY_META[String(raw).toLowerCase()];
  return (meta && meta.code) || raw;
}

// A card's equityAwardTreatment is a keyed-instrument map (the reliable
// shape) when it carries fields beyond the tagged-value envelope
// (code/label/text/quotes) whose values are non-empty prose strings.
const TAGGED_ENVELOPE_KEYS = new Set(['text', 'quotes', 'code', 'label']);
function instrumentTreatmentEntries(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  return Object.entries(value)
    .filter(([key, val]) => !TAGGED_ENVELOPE_KEYS.has(key) && typeof val === 'string' && val.trim())
    .map(([key, val]) => ({ key, text: val.trim() }));
}

// --- Consideration / Vesting classification (ported, not re-invented, from
// lib/parser-v2/consideration-equity.js's considerationType()/
// vestingTreatment() -- same enum families, same pattern rules; copied
// locally rather than imported so this browser-bundled config doesn't pull
// in that Node-only extraction module. Applied to the per-INSTRUMENT prose
// so a clause's own language (e.g. "double-trigger") only ever tags the
// instrument it actually describes. -------------------------------------
const ESPP_FROZEN_RE = /terminat|frozen|final\s+(?:investment|offering)|offering\s+period|purchase\s+period/;

function classifyConsiderationType(text, instrumentCode) {
  const t = String(text || '').toLowerCase();
  if (instrumentCode === 'ESPP' && ESPP_FROZEN_RE.test(t)) return 'CANCELLATION';
  if (/cash|spread|exercise\s+price|merger\s+consideration|per\s+share|cvr/.test(t)) return 'CASH';
  if (/without\s+(?:any\s+)?consideration|no\s+consideration/.test(t)) return 'CANCELLATION';
  // (Item 5, QXO) "converted into ... adjusted [Parent/Buyer] award" and
  // plain "parent shares" phrasing weren't covered by the original
  // stock/equity/award alternation.
  if (/parent\s+(?:stock|shares?|equity|award)|buyer\s+(?:stock|equity|award)|assum|convert(?:ed)?\s+into\s+(?:an?\s+)?adjusted/.test(t)) return 'STOCK';
  return null;
}

function classifyVestingTreatment(text, instrumentCode) {
  const t = String(text || '').toLowerCase();
  if (instrumentCode === 'ESPP' && ESPP_FROZEN_RE.test(t)) return 'CANCELLED_NO_CONSIDERATION';
  if (/double[-\s]?trigger|same\s+vesting\s+schedule/.test(t)) return 'CONTINUED_VESTING';
  // (Item 5, QXO) "retain(s)/retaining the existing/same ... vesting" and
  // "same terms and conditions" read as continued vesting too -- checked
  // before the cancel|cash|spread rule below so it isn't shadowed by the
  // generic CANCELLED_FOR_CONSIDERATION catch-all.
  if (/retain(?:s|ing)?\s+(?:the\s+)?(?:existing|same)[\s\S]{0,40}vesting|same\s+terms\s+and\s+conditions/.test(t)) return 'CONTINUED_VESTING';
  if (/\bassum/.test(t)) return 'ASSUMED_BY_PARENT';
  if (/\bcontin/.test(t)) return 'CONTINUED_VESTING';
  if (/pro[-\s]?rata/.test(t)) return 'PRO_RATA_ACCELERATION';
  if (/without\s+(?:any\s+)?consideration|no\s+consideration/.test(t)) return 'CANCELLED_NO_CONSIDERATION';
  if (/\brollover\b/.test(t)) return 'ROLLOVER';
  if (/vest(?:ed)?\s+in\s+full|fully\s+vest/.test(t)) return 'FULLY_VESTED_ACCELERATED';
  if (/cancel|cash|spread|exercise\s+price/.test(t)) return 'CANCELLED_FOR_CONSIDERATION';
  return null;
}

const CONSIDERATION_TYPE_META = {
  CASH: { label: 'Cash', tone: 'present' },
  STOCK: { label: 'Parent stock / rollover', tone: 'info' },
  CANCELLATION: { label: 'Cancelled — no consideration', tone: 'missing' },
};

const VESTING_TREATMENT_META = {
  CANCELLED_NO_CONSIDERATION: { label: 'Cancelled — no consideration', tone: 'missing' },
  CONTINUED_VESTING: { label: 'Continues vesting (double-trigger protection)', tone: 'warning' },
  ASSUMED_BY_PARENT: { label: 'Assumed by Parent', tone: 'info' },
  PRO_RATA_ACCELERATION: { label: 'Pro-rata acceleration', tone: 'info' },
  ROLLOVER: { label: 'Rollover into Parent award', tone: 'info' },
  FULLY_VESTED_ACCELERATED: { label: 'Fully vested (accelerated)', tone: 'present' },
  CANCELLED_FOR_CONSIDERATION: { label: 'Cancelled for cash consideration', tone: 'present' },
};

// CVR ENTITLEMENT column (#7, DATA FINDINGS): only options carry a CVR
// earn-in condition -- RSAs/ESPP are simply cashed out/cancelled at closing
// with no ITM gate. optionsCvrEarnIn is a card-level feature (MUST_BE_ITM on
// Metsera); resolveLabel's generic humanizeCode fallback rendered it as the
// unfriendly "Must Be Itm" ("ITM" per the punch-list) -- map the known codes
// to the reviewer-facing phrase explicitly instead.
const CVR_ENTITLEMENT_LABELS = {
  MUST_BE_ITM: 'Must be in the money at closing',
  EARN_IN_ELIGIBLE: 'Earn-in eligible (no in-the-money condition)',
};

function isOptionsLabel(text) {
  return /\boption/i.test(String(text || ''));
}

function cvrEntitlementFor(instrumentCode, instrumentLabel, features) {
  const isOptions = instrumentCode ? instrumentCode === 'STOCK_OPTIONS' : isOptionsLabel(instrumentLabel);
  if (!isOptions) return null;
  const raw = features?.optionsCvrEarnIn;
  const code = codeOf(raw);
  if (code && CVR_ENTITLEMENT_LABELS[code]) return CVR_ENTITLEMENT_LABELS[code];
  return valueText(raw) || null;
}

// Instruments named in outstandingInstruments but with no entry in
// equityAwardTreatment: flagged as their own row (warning tone, honest
// "not captured" copy) rather than silently dropped or given a fabricated
// treatment/vesting value.
function missingInstrumentRows(card, f, coveredCodes) {
  const outstanding = asList(f.outstandingInstruments);
  if (!outstanding.length) return [];
  const evidence = textOf(card);
  const seen = new Set(coveredCodes.map(normalizeInstrumentCode));
  const rows = [];
  for (const inst of outstanding) {
    const code = normalizeInstrumentCode(codeOf(inst));
    if (!code || seen.has(code)) continue;
    seen.add(code);
    rows.push({
      id: `equity-awards-${card.id || 'card'}-gap-${code}`,
      instrument: valueText(inst) || humanizeInstrumentKey(code),
      considerationLabel: 'No structured treatment captured for this instrument — see source',
      considerationTone: 'warning',
      vestingLabel: null,
      vestingTone: 'neutral',
      cvrEntitlement: null,
      evidence,
      sourceCard: card,
      present: true,
    });
  }
  return rows;
}

function rowsForCard(card) {
  const f = cardFeatures(card);
  const evidence = textOf(card);

  // Shape 1 (preferred, DATA FINDINGS #5): equityAwardTreatment as a real
  // per-instrument map.
  const instrumentEntries = instrumentTreatmentEntries(f.equityAwardTreatment);
  if (instrumentEntries.length) {
    const rows = instrumentEntries.map(({ key, text }) => {
      const meta = instrumentMetaForKey(key);
      const considerationCode = classifyConsiderationType(text, meta.code);
      const vestingCode = classifyVestingTreatment(text, meta.code);
      const considerationMeta = considerationCode ? CONSIDERATION_TYPE_META[considerationCode] : null;
      const vestingMeta = vestingCode ? VESTING_TREATMENT_META[vestingCode] : null;
      return {
        id: `equity-awards-${card.id || 'card'}-${key}`,
        instrument: meta.label,
        instrumentCode: meta.code,
        considerationLabel: considerationMeta ? considerationMeta.label : null,
        considerationTone: considerationMeta ? considerationMeta.tone : 'neutral',
        vestingLabel: vestingMeta ? vestingMeta.label : null,
        vestingTone: vestingMeta ? vestingMeta.tone : 'neutral',
        cvrEntitlement: cvrEntitlementFor(meta.code, meta.label, f),
        evidence: text,
        sourceCard: card,
        present: true,
      };
    });
    const coveredCodes = rows.map((r) => normalizeInstrumentCode(r.instrumentCode)).filter(Boolean);
    return [...rows, ...missingInstrumentRows(card, f, coveredCodes)];
  }

  const instruments = asList(f.outstandingInstruments);
  const treatments = asList(f.instrumentTreatments);
  const vestings = asList(f.instrumentVesting);

  // Shape 2: the pipeline has already split this card down to one
  // instrument. instrumentType/equityAwardTreatment/vestingAcceleration are
  // the singular, authoritative fields for that one instrument.
  if (instruments.length <= 1) {
    const instrument = valueText(f.instrumentType) || valueText(instruments[0]);
    if (!instrument) return [];
    const treatment = valueText(f.equityAwardTreatment) || valueText(treatments[0]);
    const vesting = valueText(f.vestingAcceleration) || valueText(vestings[0]);
    return [{
      id: `equity-awards-${card.id || instrument}`,
      instrument,
      considerationLabel: treatment || null,
      considerationTone: 'neutral',
      vestingLabel: vesting || null,
      vestingTone: 'neutral',
      cvrEntitlement: cvrEntitlementFor(codeOf(f.instrumentType), instrument, f),
      evidence,
      sourceCard: card,
      present: true,
    }];
  }

  // Shape 3: un-expanded legacy data, no equityAwardTreatment map to key
  // off. Pair by an explicit cross-tag where the data supports it, then by
  // the instrument named in the entry's own clause text (see
  // pairListByMention), else degrade to positional order -- no confidence
  // icon either way (#4).
  const instrumentCodes = instruments.map((inst) => {
    const raw = instrumentKeyOf(inst) || (inst && inst.code ? String(inst.code).toUpperCase() : null);
    const meta = raw ? INSTRUMENT_KEY_META[String(raw).toLowerCase()] : null;
    return (meta && meta.code) || raw;
  });
  const treatmentsByMention = pairListByMention(instrumentCodes, treatments);
  const vestingsByMention = pairListByMention(instrumentCodes, vestings);
  return instruments.map((inst, index) => {
    const instrumentCode = instrumentCodes[index];
    const matchedTreatment = matchByCode(instrumentCode, treatments);
    const matchedVesting = matchByCode(instrumentCode, vestings);
    const treatment = matchedTreatment || treatmentsByMention[index];
    const vesting = matchedVesting || vestingsByMention[index];
    const instrumentLabel = valueText(inst) || `Instrument ${index + 1}`;
    return {
      id: `equity-awards-${card.id || 'card'}-${index}`,
      instrument: instrumentLabel,
      considerationLabel: valueText(treatment) || null,
      considerationTone: 'neutral',
      vestingLabel: valueText(vesting) || null,
      vestingTone: 'neutral',
      cvrEntitlement: cvrEntitlementFor(instrumentCode, instrumentLabel, f),
      evidence,
      sourceCard: card,
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
        considerationLabel: cutoff,
        considerationTone: 'neutral',
        vestingLabel: null,
        vestingTone: 'neutral',
        cvrEntitlement: null,
        evidence: textOf(card),
        sourceCard: card,
        present: true,
        // Cutoff clauses are full sentences, not short enum-style facts --
        // keep this one row on the plain-text cell (still evidence-linked)
        // instead of squeezing prose into a truncating pill.
        isLongText: true,
      };
    }
  }
  return null;
}

function isEsppRow(row) {
  return row.instrumentCode === 'ESPP' || /\bESPP\b/i.test(row.instrument || '');
}

// ESPP renders last among the per-instrument rows (feedback round 4, EQ1):
// options/RSAs/RSUs are the higher-value awards readers scan for first, so
// ESPP -- typically the smallest, most mechanical treatment -- sorts to the
// bottom regardless of where equityAwardTreatment's own key order (or
// outstandingInstruments' alphabetical sort) happened to place it.
function moveEsppToBottom(rows) {
  const rest = rows.filter((row) => !isEsppRow(row));
  const espp = rows.filter(isEsppRow);
  return [...rest, ...espp];
}

function equityAwardRows(cards) {
  const rows = moveEsppToBottom((cards || []).flatMap(rowsForCard));
  const cutoff = cutoffRow(cards || []);
  return cutoff ? [...rows, cutoff] : rows;
}

function cell(text, ctx, row) {
  if (!text) return React.createElement('span', { className: 'italic text-inkFaint' }, '—');
  const EvidenceHoverSource = ctx?.primitives?.EvidenceHoverSource;
  if (!EvidenceHoverSource) return text;
  return React.createElement(EvidenceHoverSource, { evidence: row.evidence, source: row.sourceCard, as: 'span' }, text);
}

// (#8) Consideration / Vesting Treatment render as PillCell chips, coloured
// by the classification above, instead of plain text.
function pill(text, tone, ctx, row) {
  if (!text) return cell(null, ctx, row);
  const PillCell = ctx?.primitives?.PillCell;
  if (!PillCell) return cell(text, ctx, row);
  // (Item 2) wrap:true lets long pill labels break onto multiple lines
  // instead of forcing min-content overflow -- required now that the
  // consideration/vesting/CVR columns share a fixed percentage width.
  return React.createElement(PillCell, { label: text, tone: tone || 'neutral', evidence: row.evidence, source: row.sourceCard, wrap: true });
}

// (#4) No more "Approximate pairing" icon -- plain evidence-linked text.
function renderInstrument(row, ctx) {
  return cell(row.instrument, ctx, row);
}

const equityAwardsConfig = {
  id: 'equity-awards',
  title: 'Equity Awards',
  layoutSlot: 'consideration',
  selectRows(reviewDeal) {
    return equityAwardRows(selectCards(reviewDeal, isEquityAward));
  },
  // (Item 2) Equal, fixed widths for the three treatment columns so they no
  // longer resize per-deal from an auto-layout table sizing off content
  // (Metsera 172/212/158px vs QXO 268/159/115px at 1440px for the same
  // three columns pre-fix). table-fixed + percentage colgroup widths keep
  // them equal at every viewport and kill the 390px horizontal scroll.
  fixedLayout: true,
  columns: [
    { id: 'equityType', header: 'Equity Type', width: '30%', renderCell: renderInstrument },
    {
      id: 'consideration',
      header: 'Consideration',
      width: '24%',
      renderCell: (row, ctx) => (row.isLongText ? cell(row.considerationLabel, ctx, row) : pill(row.considerationLabel, row.considerationTone, ctx, row)),
    },
    {
      id: 'vestingTreatment',
      header: 'Vesting Treatment',
      width: '24%',
      renderCell: (row, ctx) => (row.isLongText ? cell(row.vestingLabel, ctx, row) : pill(row.vestingLabel, row.vestingTone, ctx, row)),
    },
    // (#7) "Must be in the money at closing" instead of the raw "ITM" code.
    { id: 'cvrEntitlement', header: 'CVR Entitlement', width: '22%', renderCell: (row, ctx) => cell(row.cvrEntitlement, ctx, row) },
    // (#6) NOTES column removed -- added no value.
  ],
};

export {
  classifyConsiderationType,
  classifyVestingTreatment,
  cvrEntitlementFor,
  equityAwardRows,
  equityAwardsConfig,
  instrumentMetaForKey,
  instrumentTreatmentEntries,
  isEquityAward,
  rowsForCard,
};
