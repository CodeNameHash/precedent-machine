const { getFeatures } = require('../../feature-compare');
const { comparisonDeals, dealColumn, dealMetaValue, provisionsWithField, provisionsForDealAndType, firstProvisionWithField, provisionFieldValue, buildProv, hasValue } = require('./shared');
const { primaryQuote } = require('../types');
const { taxonomyForFeatureKey, labelForCode } = require('../../taxonomy');

// r15 (Ben: "I should just be able to get a list of ALL deals whether they
// have FTV or not — an 'either/all' mode. Same for fees — just see all."):
// a boolean field's graded sibling — when the user show-alls the boolean,
// prefer surfacing the graded code (Hard/Soft/None) over a bare Yes/No.
// Additive only: extend as more boolean/graded pairs get backfilled.
const GRADED_SIBLINGS = { forceTheVote: 'forceTheVoteType' };

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

// r15 show-all: the graded-sibling annotation is additive on TOP of the
// primary hit (a boolean forceTheVote hit still carries its own has/value,
// this just adds grade/gradeLabel alongside it when the sibling field is
// populated on the SAME deal — independent of whether the primary field
// itself has a value, so e.g. a deal whose forceTheVote wasn't separately
// stamped but whose forceTheVoteType was still surfaces the grade).
function gradeAnnotation(deal, provisions, filter) {
  const siblingField = GRADED_SIBLINGS[filter.field];
  if (!siblingField) return {};
  // Read the sibling RAW off ai_metadata.features, same technique hitQuote()
  // uses for `<field>Details` above: forceTheVoteType is a freshly
  // backfilled feature key not yet in the normalized-v1 field registry, so
  // routing it through provisionFieldValue()/fieldDef() would throw
  // BLOCKED_KEY_MISSING. This annotation is additive/best-effort only, so a
  // direct feature read is the right amount of machinery.
  const rows = provisionsForDealAndType(provisions, deal.id, filter.provision_type);
  for (const row of rows) {
    const raw = getFeatures(row)[siblingField];
    // The claims-layer backfill stores codebook values as {code, text}
    // (forceTheVoteType) — unwrap .value first (citable shape), then .code.
    const value = raw && typeof raw === 'object' ? (raw.value ?? raw.code) : raw;
    if (!hasValue(value)) continue;
    const dict = taxonomyForFeatureKey(siblingField);
    const label = dict ? labelForCode(value, dict) : null;
    return { grade: value, ...(label ? { gradeLabel: label } : {}) };
  }
  return {};
}

// r15 show-all: one hit per deal for the field, regardless of whether the
// deal carries it. `has` distinguishes "extracted, value present" (true —
// including a boolean false, which is a real captured value) from "field
// never captured on this deal" (false — no card, no quote). Graded
// vocabularies (forceTheVoteType FTV_HARD/SOFT/NONE, etc.) resolve their
// human label via lib/taxonomy exactly like the rest of the query engine.
function showAllHit(filter, deal, provisions) {
  const card = firstProvisionWithField(provisions, deal.id, filter.provision_type, filter.field, null, deal);
  const resolved = card ? provisionFieldValue(card, filter.provision_type, filter.field, deal) : null;
  const has = !!(card && resolved && hasValue(resolved.value));
  const hit = {
    provision_type: filter.provision_type,
    field: (resolved && resolved.key) || filter.field,
    has,
    value: has ? resolved.value : null,
  };
  if (has) {
    const dict = taxonomyForFeatureKey(resolved.key || filter.field);
    const label = dict ? labelForCode(resolved.value, dict) : null;
    if (label) hit.valueLabel = label;
    hit.card_id = card.id;
    hit.attaches_to = attachmentLabel(card);
    hit.quote = hitQuote(resolved, card, filter);
    hit._prov = buildProv(resolved, card);
  }
  return { ...hit, ...gradeAnnotation(deal, provisions, filter) };
}

function executeFilterThenList(payload, context) {
  const deals = comparisonDeals(context.deals || [], payload.deal_filter);
  const gatingFilters = (payload.filters || []).filter((f) => f.mode !== 'all');
  const showAllFilters = (payload.filters || []).filter((f) => f.mode === 'all');
  const rows = [];
  for (const deal of deals) {
    const hits = [];
    let ok = true;
    for (const filter of gatingFilters) {
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
    // r15 show-all: every deal that survived the (possibly empty) gating
    // filters gets one additional hit per show-all filter, whether or not
    // it carries the field — this is what makes "list ALL deals" possible.
    for (const filter of showAllFilters) hits.push(showAllHit(filter, deal, context.provisions || []));
    const columns = {};
    for (const column of payload.columns || []) columns[column] = dealMetaValue(deal, column);
    rows.push({ ...dealColumn(deal), columns, matched_provision_hits: hits });
  }
  if (showAllFilters.length) {
    // Sort: has:true first, then by deal name (r15) — the show-all hit is
    // always last in matched_provision_hits (pushed after any gating hits),
    // so the first show-all filter's hit is a stable anchor even when
    // gating filters also produced hits ahead of it.
    const hasFlag = (row) => {
      const hit = (row.matched_provision_hits || []).find((h) => Object.prototype.hasOwnProperty.call(h, 'has'));
      return hit ? hit.has : false;
    };
    rows.sort((a, b) => {
      const byHas = (hasFlag(b) ? 1 : 0) - (hasFlag(a) ? 1 : 0);
      if (byHas) return byHas;
      return String(a.deal_name || '').localeCompare(String(b.deal_name || ''));
    });
  } else {
    rows.sort((a, b) => String(b.signing_date || '').localeCompare(String(a.signing_date || '')));
  }
  return { kind: 'FILTER_THEN_LIST', filters_applied: payload.filters || [], total_matches: rows.length, rows };
}

module.exports = { executeFilterThenList };
