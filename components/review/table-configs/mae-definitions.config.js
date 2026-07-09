import React from 'react';
import taxonomy from '../../../lib/taxonomy.js';
import { cardCode, cardFeatures, cardType, firstFeature, makeRow, selectCards, textOf, valueText } from './card-utils.js';

const { labelForCode, taxonomyForFeatureKey } = taxonomy;

// Row order matters: 'test'/'limbs' render first as the MAE Test summary,
// then the carve-outs table, then the supporting definition detail. The two
// carveouts-CODE-LIST rows the legacy version force-rendered
// (disproportionateImpactCarveouts / nonDisproportionateImpactCarveouts) are
// intentionally dropped from this list: their information now lives as a
// per-row "Disp. carveback applies" pill inside the carve-outs table itself
// (see carveoutsTableNode) rather than a second, redundant flat pill list.
const ROWS = [
  ['test', 'MAE Test — full definition', 'Definition', ['maeTest', 'mainConcept']],
  ['limbs', 'MAE Test', 'Definition', ['maeLimbType', 'maeLimbs']],
  ['carveouts', 'Carve-outs', 'Carve-outs', ['carveouts', 'maeCarveouts']],
  ['exceptions', 'Exceptions to carve-outs', 'Carve-outs', ['carveoutExceptions', 'maeCarveoutExceptions']],
  ['disproportionate', 'Disproportionate-impact clause', 'Exceptions', ['disproportionateImpactClause', 'disproportionalityClause']],
  ['disproportionate-scope', 'Disproportionate-impact scope', 'Exceptions', ['disproportionateImpact', 'disproportionateImpactScope']],
  ['pandemic-cyber', 'Pandemic / cyber carve-outs', 'Carve-outs', ['pandemicCarveout', 'cyberSecurityCarveout']],
  ['prevent-delay', 'Prevent / delay prong', 'Definition', ['preventDelayProng', 'maePreventDelay']],
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

function readableValue(key, value) {
  const rendered = valueText(value);
  if (!rendered) return null;
  if (Array.isArray(value)) return value.map((item) => readableValue(key, item)).filter(Boolean).join('; ');
  const code = value?.code || value?.value || (typeof value === 'string' ? value : null);
  const dict = taxonomyForFeatureKey(key);
  return (dict && code && labelForCode(String(code), dict)) || rendered;
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
// `carveouts` list -- CARVE-OUT (resolved taxonomy name) | TEXT (quoted,
// truncated + "see text") -- with a "Disp. carveback applies" pill on the
// carve-out name when the disproportionate-impact carveback reaches that
// specific carve-out. Replaces the old single joined-string pill (which
// concatenated every carve-out's label into one "A; B; C; ..." pill and lost
// the per-item quoted text and carveback flag entirely).
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
  if (item && typeof item === 'object' && item.label) return String(item.label);
  return valueText(item) || 'Carve-out';
}

function carveoutHasCarveback(item, code, dispSet) {
  const flag = item && typeof item === 'object' ? item.hasDisproportionateImpactCarveback : null;
  if (flag === true || flag === 'true') return true;
  return !!(code && dispSet.has(code));
}

function carveoutText(item) {
  if (item && typeof item === 'object' && item.text) return String(item.text).trim() || null;
  return null;
}

function carveoutsTableNode(row, ctx) {
  const items = Array.isArray(row.value) ? row.value : [];
  if (!items.length) return null;
  const PillCell = ctx?.primitives?.PillCell;
  const TruncatedWithSeeText = ctx?.primitives?.TruncatedWithSeeText;
  const dict = taxonomyForFeatureKey('carveouts');
  const dispSet = disproportionateCodeSet(row.sourceCard);

  return React.createElement(
    'table',
    { className: 'w-full max-w-[46rem] border-separate border-spacing-0 text-[11px]' },
    React.createElement(
      'thead',
      null,
      React.createElement(
        'tr',
        null,
        React.createElement('th', { className: 'w-[14rem] border-b border-border px-1.5 py-1 text-left font-medium uppercase tracking-wider text-inkFaint' }, 'Carve-out'),
        React.createElement('th', { className: 'border-b border-border px-1.5 py-1 text-left font-medium uppercase tracking-wider text-inkFaint' }, 'Text'),
      ),
    ),
    React.createElement(
      'tbody',
      null,
      items.map((item, index) => {
        const code = normalizeCarveoutCode(item);
        const name = carveoutName(item, dict);
        const text = carveoutText(item);
        const hasCarveback = carveoutHasCarveback(item, code, dispSet);
        return React.createElement(
          'tr',
          { key: code || `${name}-${index}` },
          React.createElement(
            'td',
            { className: 'border-b border-border/60 px-1.5 py-1.5 align-top' },
            React.createElement(
              'div',
              { className: 'space-y-1' },
              React.createElement('span', { className: 'text-ink', title: code || undefined }, name),
              hasCarveback && PillCell
                ? React.createElement('div', null, React.createElement(PillCell, { label: 'Disp. carveback applies', tone: 'warning' }))
                : null,
            ),
          ),
          React.createElement(
            'td',
            { className: 'border-b border-border/60 px-1.5 py-1.5 align-top text-inkLight' },
            text
              ? (TruncatedWithSeeText
                ? React.createElement(TruncatedWithSeeText, { text, evidence: text, source: row.sourceCard, max: 120 })
                : React.createElement('span', null, text))
              : React.createElement('span', { className: 'italic text-inkFaint' }, 'No text captured'),
          ),
        );
      }),
    ),
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

  // MAE Test full definition: an AI-synthesized sentence (mainConcept /
  // maeTest), never a full-sentence dump inside a pill -- truncate + "see
  // text" like every other long-prose field in this rebuild.
  if (row.featureKey === 'maeTest' || row.featureKey === 'mainConcept') {
    const TruncatedWithSeeText = ctx?.primitives?.TruncatedWithSeeText;
    const sig = row.signals && row.signals[0];
    if (row.detail && TruncatedWithSeeText) {
      return React.createElement(TruncatedWithSeeText, { text: row.detail, evidence: sig ? sig.evidence : row.detail, source: row.sourceCard, max: 140 });
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

const maeDefinitionsConfig = {
  id: 'mae-definitions',
  title: 'Material Adverse Effect',
  layoutSlot: 'mae',
  selectRows(reviewDeal) {
    return mappedMaeRows(selectCards(reviewDeal, isMae));
  },
  columns: [
    { id: 'term', header: 'Term', width: '18rem', renderCell: (row) => row.label },
    { id: 'signals', header: 'Signals', width: '18rem', renderCell: renderSignals },
    { id: 'detail', header: 'Detail', renderCell: renderDetail },
  ],
};

export { maeDefinitionsConfig, mappedMaeRows, renderDetail, renderSignals, signalFor };
