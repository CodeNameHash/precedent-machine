// WP-3 (M4-02) normalizer badges: server-side enrichment of the `_prov`
// stubs executors attach to value-bearing cells (lib/query/executors/*.js,
// via shared.js's buildProv()).
//
// canonical_key/matched_key/registry_version are already resolved when the
// executor runs (no DB access needed — see lib/query/resolve.js's
// registryVersion()). extraction_version is the one field that genuinely
// needs a database round trip: it lives on provision_cards.provenance, a
// table the query engine's `provisions` fetch never touches.
//
// There is no foreign key from `provisions.id` (the `card_id` query cells
// already carry) to `provision_cards.id` — see lib/corrections/submit.js's
// comment: "the card model row (card_id), which has NO foreign key to the
// legacy provisions [table]". The only content both tables reliably share
// is deal_id plus the provision's own text, and provision_cards already
// stores a normalized hash of that text as `region_hash` (see
// lib/parser-v2/store-cards.js buildProvenance/regionText and
// scripts/curation/mint-cards.js buildMintedCardRow, both of which hash the
// same full_text with lib/schema/provision-card.js's spanHash()). So the
// join here is content-addressed: (deal_id, spanHash(provisions.full_text))
// -> provision_cards row. This is a best-effort match, not a guaranteed
// one — cards produced by a pipeline that stored different full_text (e.g.
// a wider region) than the legacy `provisions` row won't hash-match, and in
// that case extraction_version/run_id are simply left off the badge. That
// degrades gracefully: canonical_key/matched_key/registry_version still
// render.
const { spanHash } = require('../schema/provision-card');

function collectProvCardIds(node, out = new Set()) {
  if (Array.isArray(node)) {
    for (const item of node) collectProvCardIds(item, out);
    return out;
  }
  if (node && typeof node === 'object') {
    if (node._prov && node._prov.card_id) out.add(node._prov.card_id);
    for (const key of Object.keys(node)) {
      if (key === '_prov') continue;
      collectProvCardIds(node[key], out);
    }
  }
  return out;
}

function enrichProv(node, provenanceByKey, provisionsById) {
  if (Array.isArray(node)) {
    for (const item of node) enrichProv(item, provenanceByKey, provisionsById);
    return;
  }
  if (node && typeof node === 'object') {
    if (node._prov) {
      const cardId = node._prov.card_id;
      const provision = cardId ? provisionsById.get(cardId) : null;
      const lookupKey = provision ? `${provision.deal_id}::${spanHash(provision.full_text)}` : null;
      const provenance = lookupKey ? provenanceByKey.get(lookupKey) : null;
      node._prov.extraction_version = (provenance && provenance.extractor_version) || null;
      node._prov.extraction_run_id = (provenance && provenance.run_id) || null;
      // Transient join key only — never part of the documented _prov
      // contract (lib/query/schemas/README.md) and must not reach the
      // client response.
      delete node._prov.card_id;
    }
    for (const key of Object.keys(node)) {
      if (key === '_prov') continue;
      enrichProv(node[key], provenanceByKey, provisionsById);
    }
  }
}

// Batch-fetches provision_cards provenance for every card_id referenced by
// a `_prov` stub anywhere in `result`, in exactly one additional query (none
// if the result carries no `_prov` at all), then mutates `result` in place
// so every `_prov` gets `extraction_version`/`extraction_run_id` and loses
// its transient `card_id`. `provisions` must be the same array already
// fetched for the query run (no extra provisions query is issued).
async function attachExtractionVersions(result, { provisions, sb }) {
  const cardIds = collectProvCardIds(result);
  const provisionsById = new Map((provisions || []).map((p) => [p.id, p]));
  if (!cardIds.size) return result;

  const dealIds = new Set();
  for (const id of cardIds) {
    const provision = provisionsById.get(id);
    if (provision && provision.deal_id) dealIds.add(provision.deal_id);
  }
  let provenanceByKey = new Map();
  if (dealIds.size && sb) {
    const { data, error } = await sb
      .from('provision_cards')
      .select('deal_id, region_hash, provenance')
      .in('deal_id', [...dealIds]);
    if (error) throw new Error(error.message);
    provenanceByKey = new Map();
    for (const row of data || []) {
      if (!row || !row.deal_id || !row.region_hash) continue;
      const key = `${row.deal_id}::${row.region_hash}`;
      if (!provenanceByKey.has(key)) provenanceByKey.set(key, row.provenance || {});
    }
  }
  enrichProv(result, provenanceByKey, provisionsById);
  return result;
}

module.exports = { attachExtractionVersions, collectProvCardIds, enrichProv };
