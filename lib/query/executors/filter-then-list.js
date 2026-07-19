const { getFeatures } = require('../../feature-compare');
const { comparisonDeals, dealColumn, dealMetaValue, provisionsWithField, provisionFieldValue, buildProv, hasValue } = require('./shared');
const { primaryQuote } = require('../types');

function testOp(value, op, expected) {
  if (op === 'eq') return String(value) === String(expected);
  if (op === 'neq') return String(value) !== String(expected);
  if (op === 'in') return Array.isArray(expected) && expected.map(String).includes(String(value));
  if (op === 'not_in') return Array.isArray(expected) && !expected.map(String).includes(String(value));
  if (op === 'contains') return String(value || '').toLowerCase().includes(String(expected || '').toLowerCase());
  if (op === 'not_contains') return !String(value || '').toLowerCase().includes(String(expected || '').toLowerCase());
  if (op === 'lt') return Number(value) < Number(expected);
  if (op === 'lte') return Number(value) <= Number(expected);
  if (op === 'gt') return Number(value) > Number(expected);
  if (op === 'gte') return Number(value) >= Number(expected);
  if (op === 'before') return String(value || '') < String(expected || '');
  if (op === 'after') return String(value || '') > String(expected || '');
  if (op === 'between') return Array.isArray(expected) && Number(value) >= Number(expected[0]) && Number(value) <= Number(expected[1]);
  return false;
}

// r10: the quote shown under "Show provision" must be the evidence for the
// MATCHED FIELD, not whichever card the match happened to anchor to. Order:
// the field's own claim-level quote; a `<field>Details` sibling (e.g.
// forceTheVoteDetails carries the verbatim force-the-vote language); the
// provision's full text as last resort.
function hitQuote(resolved, provision, filter) {
  const base = primaryQuote(provision);
  if (typeof resolved.quote === 'string' && resolved.quote.trim() && resolved.quote !== provision.full_text) {
    return { ...base, text: resolved.quote };
  }
  // Read the Details sibling RAW off the features — provisionFieldValue
  // would alias `<field>Details` back onto the parent field (resolveKey
  // collapses the pair) and lose the text.
  const raw = getFeatures(provision)[`${filter.field}Details`];
  const detailsText = typeof raw === 'string' ? raw
    : (raw && typeof raw === 'object' ? (typeof raw.value === 'string' ? raw.value : (typeof raw.text === 'string' ? raw.text : null)) : null);
  if (detailsText && detailsText.trim()) return { ...base, text: detailsText };
  return base;
}

// The obligation a hit's value attaches to, in words: the provision's own
// human category/title, falling back to its subtype code humanized.
function attachmentLabel(provision) {
  const cat = provision && (provision.category || provision.short_title);
  if (cat && !/^[A-Z0-9_-]+$/.test(String(cat))) return String(cat);
  const code = provision && (provision.category || provision.type);
  return code ? String(code).replace(/[_-]+/g, ' ').toLowerCase().replace(/^\w/, (ch) => ch.toUpperCase()) : null;
}

function executeFilterThenList(payload, context) {
  const deals = comparisonDeals(context.deals || [], payload.deal_filter);
  const rows = [];
  for (const deal of deals) {
    const hits = [];
    let ok = true;
    for (const filter of payload.filters || []) {
      // r10c (Ben: "be clear WHAT the standard attaches to"): a qualifier is
      // a property of an OBLIGATION, and different obligations in one family
      // legitimately carry different standards (RBE main efforts covenant,
      // CRE cooperation clause). So: the deal matches when ANY obligation's
      // value passes the filter, and every passing obligation becomes its
      // own hit, labelled with what it attaches to. No silent majority-pick
      // here — that stays only where a single value per deal is structural
      // (market-range / deal-to-market via firstProvisionWithField).
      const candidates = provisionsWithField(context.provisions || [], deal.id, filter.provision_type, filter.field, deal);
      const passing = candidates.filter((c) => testOp(c.value, filter.op, filter.value));
      if (candidates.length ? !passing.length : !testOp(null, filter.op, filter.value)) {
        ok = false;
        break;
      }
      if (!passing.length) {
        // Absence-match (e.g. "is No" on a deal with no captured value):
        // keep the legacy single null hit so the row still explains itself.
        hits.push({ provision_type: filter.provision_type, card_id: null, field: filter.field, value: null, quote: null });
        continue;
      }
      // One hit per DISTINCT value: several cards carrying the SAME value
      // is section-level duplication (the FTV shape), so each value keeps
      // only its best-evidenced carrier; genuinely different values (RBE
      // main covenant vs CRE cooperation clause) each surface, labelled.
      const byValue = new Map();
      for (const c of passing) {
        const key = JSON.stringify(c.value);
        const cur = byValue.get(key);
        if (!cur || (!cur.ownQuote && c.ownQuote)) byValue.set(key, c);
      }
      for (const c of [...byValue.values()].slice(0, 6)) {
        hits.push({
          provision_type: filter.provision_type,
          card_id: c.provision.id,
          field: c.resolved.key || filter.field,
          value: c.value,
          attaches_to: attachmentLabel(c.provision),
          quote: hitQuote(c.resolved, c.provision, filter),
          ...(hasValue(c.value) ? { _prov: buildProv(c.resolved, c.provision) } : {}),
        });
      }
    }
    if (!ok) continue;
    const columns = {};
    for (const column of payload.columns || []) columns[column] = dealMetaValue(deal, column);
    rows.push({ ...dealColumn(deal), columns, matched_provision_hits: hits });
  }
  rows.sort((a, b) => String(b.signing_date || '').localeCompare(String(a.signing_date || '')));
  return { kind: 'FILTER_THEN_LIST', filters_applied: payload.filters || [], total_matches: rows.length, rows };
}

module.exports = { executeFilterThenList };
