function cardCode(card) {
  return String(card?.provision_subtype || card?.canonical_code || card?.provision_code || card?.code || '').trim().toUpperCase();
}

function cardType(card) {
  return String(card?.provision_type || card?.type || '').trim().toUpperCase();
}

function cardFeatures(card) {
  if (card?.features && typeof card.features === 'object') return card.features;
  const meta = card?.ai_metadata;
  if (meta?.features && typeof meta.features === 'object') return meta.features;
  return {};
}

function textOf(card) {
  return String(card?.primary_quote || card?.region_full_text || '').trim();
}

function labelOf(card) {
  return String(card?.short_title || card?.defined_term || cardCode(card) || 'Provision').trim();
}

function valueText(value) {
  if (value === null || value === undefined || value === '') return null;
  if (Array.isArray(value)) return value.map(valueText).filter(Boolean).join('; ');
  if (typeof value === 'object') {
    if (value.value !== undefined) return valueText(value.value);
    if (value.label || value.code) {
      // Tagged value shape { code, label, text, quotes }. Read view shows
      // the friendly label only; the raw canonical code is kept on the value
      // object (`.code`) for edit-mode/card-view consumers but must never be
      // re-appended to this display string. Claims backfills sometimes store
      // the code itself as `text`/`verbatim` when no distinguishing quote
      // was captured, which would otherwise double the code onto the label,
      // e.g. "One-step merger: ONE_STEP_MERGER". Only suppress `.text` when
      // it's a LITERAL echo of the code or the already-friendly label
      // (exact string match, no case-folding) -- genuine verbatim prose that
      // merely overlaps in wording with the label (e.g. label "Reasonable
      // best efforts" + text "reasonable best efforts" quoted from the
      // agreement) is real supporting evidence and must still render.
      const primary = value.label || value.code;
      const text = value.text ? String(value.text).trim() : null;
      const textIsRedundant = text !== null && (text === primary || text === value.code);
      return [primary, textIsRedundant ? null : value.text].filter(Boolean).join(': ');
    }
    // No code/label -- either a plain feature object, or a JSON-parsed
    // structured-object attribute (e.g. interestOnLatePayment { rate, base },
    // materialContractsDollarThresholds { bucket, threshold }). Render the
    // meaningful fields rather than falling back to the raw `.text`
    // (verbatim JSON) bookkeeping field, which is what produced the
    // raw-JSON-blob read-view bug this helper now avoids.
    const fieldEntries = Object.entries(value).filter(
      ([key, val]) => key !== 'text' && key !== 'quotes' && val !== null && val !== undefined && val !== '',
    );
    if (fieldEntries.length > 0) {
      return fieldEntries
        .map(([key, val]) => {
          const rendered = valueText(val);
          return rendered ? `${key}: ${rendered}` : null;
        })
        .filter(Boolean)
        .join('; ');
    }
    return value.text ? String(value.text) : null;
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

function firstFeature(cards, keys) {
  const list = Array.isArray(keys) ? keys : [keys];
  for (const card of cards) {
    const features = cardFeatures(card);
    for (const key of list) {
      const detail = valueText(features[key]);
      if (detail) return { key, value: features[key], detail, card };
    }
  }
  return null;
}

function makeRow(prefix, id, label, kind, hit) {
  if (!hit?.detail) return null;
  return {
    id: `${prefix}-${id}`,
    label,
    kind,
    detail: hit.detail,
    evidence: textOf(hit.card),
    source: labelOf(hit.card),
    present: true,
  };
}

function mappedRows(prefix, cards, specs) {
  return specs
    .map(([id, label, kind, keys]) => makeRow(prefix, id, label, kind, firstFeature(cards, keys || id)))
    .filter(Boolean);
}

// Multi-instance counterpart to firstFeature(): where firstFeature stops at
// the FIRST card with a non-empty value (dropping every other card's data),
// allFeatures returns ONE hit PER CARD that has a value for any of the given
// keys. For families where every card is a genuinely distinct instance (a
// per-rep qualifier, a per-right termination party, a Company-vs-Parent MAE
// split), this is what stops N claims from collapsing into a single row.
function allFeatures(cards, keys) {
  const list = Array.isArray(keys) ? keys : [keys];
  const hits = [];
  for (const card of cards || []) {
    const features = cardFeatures(card);
    for (const key of list) {
      const detail = valueText(features[key]);
      if (detail) {
        hits.push({ key, value: features[key], detail, card });
        break; // first matching alias wins for THIS card; still visit every other card
      }
    }
  }
  return hits;
}

// Builds one row per hit (see allFeatures) instead of makeRow's single row.
// Row ids are suffixed by the source card id so React keys stay stable and
// unique even when several cards share the same row label.
function makeRows(prefix, id, label, kind, hits) {
  return (hits || []).map((hit, index) => ({
    id: `${prefix}-${id}-${hit?.card?.id || index}`,
    label,
    kind,
    detail: hit.detail,
    evidence: textOf(hit.card),
    source: labelOf(hit.card),
    value: hit.value,
    featureKey: hit.key,
    sourceCard: hit.card,
    present: true,
  }));
}

function mappedRowsMulti(prefix, cards, specs) {
  return specs.flatMap(([id, label, kind, keys]) => makeRows(prefix, id, label, kind, allFeatures(cards, keys || id)));
}

function selectCards(reviewDeal, predicate) {
  return (reviewDeal?.cards || []).filter(predicate);
}

// Phase B compact-column reshaping: the pure truncation math behind
// ProvisionTablePrimitives.jsx's <TruncatedWithSeeText>, split out into
// plain JS so it's testable under `node --test` without a JSX loader (the
// primitive itself lives in a .jsx file the test runner can't import
// directly — see tests/review/provision-table-compact-columns.spec.js).
// Word-boundary-trims the preview so it never cuts mid-word.
function splitForCell(text, max = 160) {
  const value = text === null || text === undefined ? '' : String(text);
  if (!value) return { value: '', short: '', truncated: false };
  if (value.length <= max) return { value, short: value, truncated: false };
  const cut = value.slice(0, max);
  const short = (cut.replace(/\s+\S*$/, '').trim() || cut.trim());
  return { value, short, truncated: true };
}

export {
  allFeatures,
  cardCode,
  cardFeatures,
  cardType,
  firstFeature,
  labelOf,
  makeRow,
  makeRows,
  mappedRows,
  mappedRowsMulti,
  selectCards,
  splitForCell,
  textOf,
  valueText,
};
