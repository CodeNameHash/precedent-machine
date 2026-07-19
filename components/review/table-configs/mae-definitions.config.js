import React from 'react';
import taxonomy from '../../../lib/taxonomy.js';
import { cardCode, cardFeatures, cardType, firstFeature, makeRow, selectCards, textOf, valueText } from './card-utils.js';
import { TERM_COL_WIDTH, TERM_COL_MAX } from './layout.js';

const { labelForCode, taxonomyForFeatureKey } = taxonomy;

// Row order matters: 'limbs' renders first as the MAE Test summary (the
// two-limb pill IS the test summary -- fb2 #18 dropped the separate
// full-definition prose row as a redundant duplicate of it), then the
// carve-outs table, then the supporting definition detail. The
// disproportionate-impact rows (clause / scope) are also intentionally
// dropped from this list (fb2 #20): that information now lives ONLY as a
// per-row "Disp. carveback applies" pill inside the carve-outs table itself
// (see carveoutsTableNode) rather than a second, redundant summary row.
//
// fb3 #M3/#M4: the standalone "prevent-delay" and "pandemic-cyber" summary
// rows are also dropped. The two-limb MAE Test pill above already states
// whether the prevent/materially-delay-closing prong is part of the test
// (that's what TWO_LIMB means), and pandemic/cyber are already listed as
// individual carve-out rows in the carve-outs table -- both standalone rows
// were restating information already shown elsewhere on this same card.
const ROWS = [
  ['limbs', 'MAE Test', 'Definition', ['maeLimbType', 'maeLimbs']],
  ['carveouts', 'Carve-outs', 'Carve-outs', ['carveouts', 'maeCarveouts']],
  ['exceptions', 'Exceptions to carve-outs', 'Carve-outs', ['carveoutExceptions', 'maeCarveoutExceptions']],
];

// MAE_LIMB_TEXT: friendly translation for the two-limb / one-limb code so
// the summary pill reads like the old-site "MAE Test: Two-limb: effect on
// the entity + ability to consummate" line instead of the raw taxonomy code
// (there's no MAE_CARVEOUT-style dictionary for maeLimbType/maeLimbs, so the
// raw code -- TWO_LIMB / ONE_LIMB -- is what row.signals[0].label carries;
// this map is display-only and never touches the row's underlying data).
const MAE_LIMB_TEXT = {
  TWO_LIMB: 'Two-limb: effect on the entity + ability to consummate',
  ONE_LIMB: 'One-limb: ability to consummate only',
};

function isMae(card) {
  const code = cardCode(card);
  return cardType(card) === 'MAE' || code.includes('MAE') || /material adverse effect|\bMAE\b/i.test(`${card?.short_title || ''} ${card?.defined_term || ''} ${textOf(card)}`);
}

// DEF-MAE is the actual defined-term card for "Material Adverse Effect"; a
// deal typically carries TWO of these (Company MAE, Parent MAE) that are
// otherwise indistinguishable to isMae()'s broader regex (which also nets
// e.g. a "No Target MAE" closing-condition card). Distinguish sides from
// card.defined_term / short_title ("Company Material Adverse Effect" vs
// "Parent Material Adverse Effect").
function isMaeDefinitionCard(card) {
  return cardCode(card) === 'DEF-MAE';
}

function maeSide(card) {
  const text = `${card?.defined_term || ''} ${card?.short_title || ''}`;
  if (/\bparent\b/i.test(text)) return 'Parent';
  if (/\bcompany\b/i.test(text)) return 'Company';
  return null;
}

// fb4 #M5: carve-out labels read inconsistently (some SHOUTING, some
// Title-Casing every word) whenever the raw extracted text/label falls back
// past the taxonomy dict -- carveoutExceptions/maeCarveoutExceptions in
// particular have no MAE_CARVEOUT_CODES-style dictionary in taxonomy.js at
// all (taxonomyForFeatureKey returns null for them), so their labels were
// rendered completely unnormalized. This is display-only casing cleanup: it
// never touches row.value/code, only the label string. Known acronyms are
// kept upper-case wherever they appear; every other word is sentence-cased.
const CARVEOUT_LABEL_ACRONYMS = new Set(['FDA', 'GAAP', 'MFN', 'COVID', 'SEC', 'HSR', 'GDPR', 'EU', 'UK', 'US', 'IP']);

function sentenceCaseLabel(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return trimmed;
  let firstWordSeen = false;
  return trimmed.replace(/[A-Za-z]+(?:['’][A-Za-z]+)?/g, (word) => {
    if (CARVEOUT_LABEL_ACRONYMS.has(word.toUpperCase())) return word.toUpperCase();
    const lower = word.toLowerCase();
    if (firstWordSeen) return lower;
    firstWordSeen = true;
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  });
}

// Feature keys with no taxonomy dictionary of their own (see comment above)
// whose raw text needs the casing cleanup; keys that DO resolve through a
// dict (e.g. maeLimbType's raw TWO_LIMB/ONE_LIMB code) are left untouched.
const RAW_TEXT_LABEL_KEYS = new Set(['carveoutExceptions', 'maeCarveoutExceptions']);

function readableValue(key, value) {
  const rendered = valueText(value);
  if (!rendered) return null;
  if (Array.isArray(value)) return value.map((item) => readableValue(key, item)).filter(Boolean).join('; ');
  const code = value?.code || value?.value || (typeof value === 'string' ? value : null);
  const dict = taxonomyForFeatureKey(key);
  const resolved = (dict && code && labelForCode(String(code), dict)) || rendered;
  return RAW_TEXT_LABEL_KEYS.has(key) ? sentenceCaseLabel(resolved) : resolved;
}

// Read-view pill is the resolved value alone -- the Term column already
// names the row, so a "<Kind>: " prefix only repeated it.
function signalFor(row) {
  if (!row?.detail) return null;
  return {
    id: `${row.id}-signal`,
    label: readableValue(row.featureKey, row.value) || row.detail,
    value: row.value || row.detail,
    tone: row.kind === 'Exceptions' ? 'warning' : row.kind === 'Carve-outs' ? 'info' : 'neutral',
    evidence: row.evidence,
    source: row.sourceCard,
  };
}

function buildRowsForCards(cards, sidePrefix) {
  return ROWS
    .map(([id, label, kind, keys]) => {
      const hit = firstFeature(cards, keys || id);
      const rowLabel = sidePrefix ? `${sidePrefix}: ${label}` : label;
      const rowId = sidePrefix ? `${sidePrefix.toLowerCase()}-${id}` : id;
      const row = makeRow('mae-definitions', rowId, rowLabel, kind, hit);
      if (!row) return null;
      return {
        ...row,
        value: hit.value,
        featureKey: hit.key,
        sourceCard: hit.card,
        // Which side (Company / Parent) this row belongs to, or null for a
        // single-party MAE definition. Drives the two-table split in
        // renderBody() below; the row's `label`/`id` keep their existing
        // side-prefixed shape (data contract unchanged for selectRows
        // consumers/tests) -- renderBody strips the prefix for display.
        side: sidePrefix || null,
        signals: [signalFor({ ...row, value: hit.value, featureKey: hit.key, sourceCard: hit.card })].filter(Boolean),
      };
    })
    .filter(Boolean);
}

// Company and Parent each get their own DEF-MAE card carrying their OWN
// carve-outs/limbs/etc. firstFeature() across the combined card list would
// let whichever side's card comes first in the array silently absorb rows
// the OTHER side also has data for (e.g. maeLimbs, present on both). Split
// into one row-set per side when a genuine two-sided split exists; fall back
// to the old single-pass behaviour for single-party MAE definitions.
function mappedMaeRows(cards) {
  const defCards = cards.filter(isMaeDefinitionCard);
  const otherCards = cards.filter((card) => !isMaeDefinitionCard(card));
  const sides = [...new Set(defCards.map(maeSide).filter(Boolean))];

  if (sides.length < 2) return buildRowsForCards(cards, null);

  return sides.flatMap((side) => {
    const sideCards = [...defCards.filter((card) => maeSide(card) === side), ...otherCards];
    return buildRowsForCards(sideCards, side);
  });
}

// ---------------------------------------------------------------------------
// Carve-outs table (spec section 4): one row per carve-out in the tagged
// `carveouts` list -- CARVE-OUT (resolved taxonomy name) only (fb2 #19 drops
// the raw-code/quoted-text right-hand column entirely) -- with a "Disp.
// carveback applies" pill on the carve-out name when the disproportionate-
// impact carveback reaches that specific carve-out. Replaces the old single
// joined-string pill (which concatenated every carve-out's label into one
// "A; B; C; ..." pill and lost the per-item carveback flag entirely).
// ---------------------------------------------------------------------------

function normalizeCarveoutCode(entry) {
  if (!entry) return null;
  if (typeof entry === 'string') return entry.trim().toUpperCase() || null;
  if (typeof entry === 'object') {
    const raw = entry.code || entry.value || entry.canonical || null;
    return raw ? String(raw).trim().toUpperCase() : null;
  }
  return null;
}

// The disproportionate-impact carveback can be tagged two ways in the data:
// (a) per-item, via `hasDisproportionateImpactCarveback` on the carveouts[]
//     entry itself (the shape lib/rubric.js's Stage-1 prompt asks for), or
// (b) a sibling codes-only list feature (`disproportionateImpactCarveouts`)
//     on the SAME DEF-MAE card -- the shape actually present in the Metsera
//     extraction today. Both are honoured so the table doesn't go blank on
//     whichever shape a given deal's data happens to use.
function disproportionateCodeSet(card) {
  const raw = cardFeatures(card).disproportionateImpactCarveouts;
  const list = Array.isArray(raw) ? raw : [];
  const set = new Set();
  list.forEach((entry) => {
    const code = normalizeCarveoutCode(entry);
    if (code) set.add(code);
  });
  return set;
}

function carveoutName(item, dict) {
  const code = normalizeCarveoutCode(item);
  const fromDict = code ? labelForCode(code, dict) : null;
  if (fromDict) return fromDict;
  if (item && typeof item === 'object' && item.label) return sentenceCaseLabel(String(item.label));
  return sentenceCaseLabel(valueText(item)) || 'Carve-out';
}

function carveoutHasCarveback(item, code, dispSet) {
  const flag = item && typeof item === 'object' ? item.hasDisproportionateImpactCarveback : null;
  if (flag === true || flag === 'true') return true;
  return !!(code && dispSet.has(code));
}

// fb2 #19: the carve-out NAME alone is sufficient -- the right-hand TEXT
// column used to show raw stored text when present and, when absent, a raw
// taxonomy CODE (e.g. ACTS_OF_WAR_TERRORISM), which read worse than showing
// nothing at all. Dropped entirely; carveoutText() (the old TEXT-column
// source) goes with it.
//
// fb3 #M2: rendered as a plain scannable LIST, not a <table> -- a one-column
// table with a "Carve-out" header restated the obvious (the row above this
// already reads "Carve-outs") and its bordered/padded cells read as a dense
// block rather than a quick scan. A tight list of names, each inline with
// its "Disp. carveback applies" pill when present, scans in one pass.
function carveoutsTableNode(row, ctx) {
  const rawItems = Array.isArray(row.value) ? row.value : [];
  if (!rawItems.length) return null;
  const PillCell = ctx?.primitives?.PillCell;
  const dict = taxonomyForFeatureKey('carveouts');
  const dispSet = disproportionateCodeSet(row.sourceCard);
  // Ben (round 6): the extracted `carveouts` list carries duplicates (26 items
  // on Metsera, several repeated) -- dedupe by resolved carve-out name so each
  // carve-out renders once.
  const seen = new Set();
  const items = rawItems.filter((item) => {
    const key = String(carveoutName(item, dict) || '').trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (!items.length) return null;

  return React.createElement(
    'ul',
    { className: 'max-w-[46rem] divide-y divide-border/40 text-[11px]' },
    items.map((item, index) => {
      const code = normalizeCarveoutCode(item);
      const name = carveoutName(item, dict);
      const hasCarveback = carveoutHasCarveback(item, code, dispSet);
      return React.createElement(
        'li',
        { key: code || `${name}-${index}`, className: 'flex flex-wrap items-baseline gap-x-2 gap-y-0.5 py-1 first:pt-0 last:pb-0' },
        React.createElement('span', { className: 'text-ink', title: code || undefined }, name),
        hasCarveback && PillCell
          ? React.createElement(PillCell, { label: 'Disp. carveback applies', tone: 'warning' })
          : null,
      );
    }),
  );
}

function limbFriendlyText(value) {
  const code = normalizeCarveoutCode(value);
  return code ? MAE_LIMB_TEXT[code] || null : null;
}

function renderSignals(row, ctx) {
  const PillCell = ctx?.primitives?.PillCell;

  // Carve-outs: a proper CARVE-OUT | TEXT table (with a per-row "Disp.
  // carveback applies" pill) instead of one giant joined-string pill.
  if (row.featureKey === 'carveouts') {
    const table = carveoutsTableNode(row, ctx);
    if (table) return table;
  }

  // MAE Test limb summary: translate the raw TWO_LIMB / ONE_LIMB code into
  // the "Two-limb: effect on the entity + ability to consummate" phrasing.
  if ((row.featureKey === 'maeLimbType' || row.featureKey === 'maeLimbs') && PillCell) {
    const friendly = limbFriendlyText(row.value);
    if (friendly) {
      const sig = row.signals && row.signals[0];
      return React.createElement(PillCell, {
        key: `${row.id}-limb`,
        label: friendly,
        tone: 'info',
        value: row.value,
        evidence: sig ? sig.evidence : undefined,
        source: sig ? sig.source : undefined,
      });
    }
  }

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
  // The carve-outs row already renders its full text per-item (with its own
  // "see text" expanders) inside the signals cell -- a second, whole-row
  // "see text" copy of the raw feature array would be redundant/unreadable.
  if (row.featureKey === 'carveouts') return null;
  const EvidenceHoverSource = ctx?.primitives?.EvidenceHoverSource;
  if (!EvidenceHoverSource || !row.evidence) return row.detail;
  return React.createElement(EvidenceHoverSource, { value: row.value, evidence: row.evidence, source: row.sourceCard, as: 'span' }, row.detail);
}

// fb2 #21: legacy :3010 rendered Company MAE and Parent MAE as two entirely
// separate <table> sub-sections (see OLD-review-page.js MaeSinglePartySummary/
// MaeDefinitionSummary), never as one table with "Company:"/"Parent:" text
// prefixes glued onto shared rows. row.label/row.id keep that side prefix
// (selectRows' existing data contract, depended on by unit tests) -- this
// display-only helper strips it back off so each side's own table reads
// with a clean, unprefixed Term column ("MAE Test", not "Company: MAE Test").
const SIDE_LABEL_PREFIX_RE = /^(?:Company|Parent):\s*/;
function displayLabel(row) {
  return row.side ? row.label.replace(SIDE_LABEL_PREFIX_RE, '') : row.label;
}

// One <table> of Term | Signals rows for a single side's row set (or the
// single flat row set when a deal only has one MAE definition). The 'detail'
// feature text -- when there is any beyond what the Signals cell already
// shows -- collapses behind a per-row "see text" expander under the Term
// cell, mirroring ProvisionTable.jsx's own FULL_TEXT_COLUMNS/SeeTextExpander
// treatment (this config bypasses that generic table body via renderBody,
// so it re-creates the same affordance locally rather than losing it).
function maeSideTableNode(sideRows, ctx, key) {
  return React.createElement(
    'table',
    { className: 'min-w-full text-xs font-ui', key },
    React.createElement(
      'thead',
      { className: 'border-b border-border bg-bg/60' },
      React.createElement(
        'tr',
        null,
        React.createElement('th', { className: 'w-[16rem] px-3 py-2 text-left font-medium uppercase tracking-wider text-inkFaint' }, 'Term'),
        React.createElement('th', { className: 'px-3 py-2 text-left font-medium uppercase tracking-wider text-inkFaint' }, 'Provision'),
      ),
    ),
    React.createElement(
      'tbody',
      { className: 'divide-y divide-border' },
      sideRows.map((row) => {
        const detailNode = renderDetail(row, ctx);
        return React.createElement(
          'tr',
          { key: row.id, className: 'align-top hover:bg-bg/40' },
          React.createElement(
            'td',
            { className: 'w-[16rem] px-3 py-2 text-ink font-medium whitespace-normal break-words' },
            displayLabel(row),
            detailNode
              ? React.createElement(
                  'details',
                  { className: 'mt-1' },
                  React.createElement('summary', { className: 'term-cell-seetext', style: { listStyle: 'none' } }, 'See provision'),
                  React.createElement(
                    'div',
                    { className: 'mt-1 max-w-[42rem] whitespace-pre-wrap break-words text-[11px] leading-5 text-inkLight' },
                    detailNode,
                  ),
                )
              : null,
          ),
          React.createElement(
            'td',
            { className: 'px-3 py-2 text-ink whitespace-pre-wrap break-words' },
            renderSignals(row, ctx),
          ),
        );
      }),
    ),
  );
}

const SIDE_TABLE_HEADING = {
  Company: 'Company MAE',
  Parent: 'Parent MAE',
};

// fb2 #21 + #22: two separate <table> sub-sections when the deal has both a
// Company and a Parent MAE definition, each headed "Company MAE" / "Parent
// MAE" -- never "Material Adverse Effect" again (that's already the section
// title ProvisionTable renders once, above this body). Falls back to a
// single plain table (no sub-heading) for the single-party case.
function renderBody(rows, ctx) {
  const sides = [...new Set((rows || []).map((row) => row.side).filter(Boolean))];
  if (sides.length < 2) {
    return maeSideTableNode(rows, ctx, 'mae-single');
  }
  return React.createElement(
    'div',
    { className: 'space-y-4' },
    sides.map((side) => React.createElement(
      'div',
      { key: side, className: 'overflow-hidden rounded border border-border' },
      React.createElement(
        'div',
        { className: 'border-b border-border bg-bg/40 px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider text-inkFaint' },
        SIDE_TABLE_HEADING[side] || side,
      ),
      React.createElement(
        'div',
        { className: 'overflow-x-auto' },
        maeSideTableNode(rows.filter((row) => row.side === side), ctx, side),
      ),
    )),
  );
}

const maeDefinitionsConfig = {
  id: 'mae-definitions',
  title: 'Material Adverse Effect',
  layoutSlot: 'mae',
  // fb4 #M6/G-TITLE: renderBody's own markup never repeats config.title (see
  // the tests covering renderBody() directly) -- the live duplicate is
  // ProvisionTable.jsx's config.renderBody branch, which prints
  // {config.title} unconditionally and does not check hideRepeatedTitle the
  // way its generic-table branch does for material-contracts.config.js.
  // Setting this flag here is the config-side half of that fix; the other
  // half (ProvisionTable.jsx checking it in the renderBody branch) is out of
  // scope for this change.
  hideRepeatedTitle: true,
  selectRows(reviewDeal) {
    return mappedMaeRows(selectCards(reviewDeal, isMae));
  },
  // Legacy Term/Signals/Detail column shape is kept for direct column-level
  // testing and as the data contract other tooling may still inspect, but
  // the live page renders via renderBody (below) instead of ProvisionTable's
  // generic single-table body -- see the ProvisionTable.jsx renderBody hook.
  fixedLayout: true,
  columns: [
    { id: 'term', header: 'Term', width: TERM_COL_WIDTH, maxWidth: TERM_COL_MAX, renderCell: (row) => row.label },
    { id: 'signals', header: 'Provision', renderCell: renderSignals },
    { id: 'detail', header: 'Detail', renderCell: renderDetail },
  ],
  renderBody,
};

export { maeDefinitionsConfig, mappedMaeRows, renderBody, renderDetail, renderSignals, signalFor };
