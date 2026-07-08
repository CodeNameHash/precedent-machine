const {
  excerptId,
  provisionInstanceId,
  spanHash,
  validateProvisionCardShape,
} = require('../schema/provision-card');
const { storeClaimsForDeal } = require('./store-claims');

const TYPE_MAP = {
  ANTI: 'ANTITRUST_REGULATORY',
  COND: 'CLOSING_CONDITION',
  CONSID: 'CONSIDERATION',
  COV: 'COVENANT_OTHER',
  DEF: 'DEFINITION',
  EQUITY: 'CONSIDERATION',
  IOC: 'COVENANT_INTERIM_OPERATING',
  MAE: 'MAE',
  MISC: 'MISC_BOILERPLATE',
  NOSOL: 'COVENANT_NO_SOLICITATION',
  REP: 'REPRESENTATION',
  SEC: 'SEC_FILING_MEETING',
  STRUCT: 'STRUCTURE_MECHANICS',
  STRUCTURE: 'STRUCTURE_MECHANICS',
  TERMF: 'TERMINATION_FEE',
  TERMR: 'TERMINATION_RIGHT',
};

const OPTIONAL_PARTY_TYPES = new Set(['DEFINITION', 'MAE', 'MISC_BOILERPLATE', 'STRUCTURE_MECHANICS']);
const PARTY_SCOPE_MAP = {
  ACQUIRER: 'BUYER',
  BOTH: 'MUTUAL',
  COMPANY: 'COMPANY',
  BUYER: 'BUYER',
  MERGER_SUB: 'MERGER_SUB',
  MUTUAL: 'MUTUAL',
  N_A: 'N_A',
  NA: 'N_A',
  PARENT: 'PARENT',
  SELLER: 'COMPANY',
  TARGET: 'COMPANY',
};

function arrayFromExtractorOutput(output) {
  if (Array.isArray(output)) return output;
  if (!output || typeof output !== 'object') return [];
  for (const key of ['provisions', 'cards', 'items']) {
    if (Array.isArray(output[key])) return output[key];
  }
  return [];
}

function baseType(type) {
  const raw = String(type || '').trim().toUpperCase();
  return raw.split('-')[0] || raw;
}

function provisionType(prov) {
  const raw = prov.provision_type || prov.provisionType || prov.type || prov.code || '';
  return TYPE_MAP[baseType(raw)] || TYPE_MAP[String(raw).toUpperCase()] || 'MISC_BOILERPLATE';
}

function textOf(prov) {
  return String(prov.full_text || prov.fullText || prov.text || prov.region_full_text || prov.regionFullText || '').trim();
}

function featureBag(prov) {
  if (prov.features && typeof prov.features === 'object') return prov.features;
  if (prov.ai_metadata && prov.ai_metadata.features && typeof prov.ai_metadata.features === 'object') return prov.ai_metadata.features;
  return {};
}

function sectionPath(prov) {
  const features = featureBag(prov);
  return String(
    prov.section_path ||
    prov.sectionPath ||
    prov.section_ref ||
    prov.sectionRef ||
    prov.sectionNumber ||
    features.sectionNumber ||
    'Unspecified',
  );
}

function titleOf(prov) {
  const features = featureBag(prov);
  return String(
    prov.short_title ||
    prov.shortTitle ||
    prov.category ||
    prov.title ||
    features.canonicalTerm ||
    features.definedTerm ||
    prov.code ||
    'Untitled provision',
  );
}

function partyScope(prov, cardType) {
  const features = featureBag(prov);
  const raw = String(prov.party_scope || prov.partyScope || features.partyScope || '').trim().toUpperCase();
  if (raw) return PARTY_SCOPE_MAP[raw.replace(/[^A-Z0-9_]/g, '_')] || 'MUTUAL';
  return OPTIONAL_PARTY_TYPES.has(cardType) ? 'N_A' : 'MUTUAL';
}

function regionId(prov) {
  const features = featureBag(prov);
  return prov.region_id || prov.regionId || features.region_id || features.regionId || null;
}

function regionText(prov) {
  return String(prov.region_full_text || prov.regionFullText || prov.sectionText || prov.raw_text || prov.rawText || textOf(prov));
}

function quoteSpan(prov, quote, source) {
  const explicitStart = prov.primary_quote_start ?? prov.primaryQuoteStart;
  const explicitEnd = prov.primary_quote_end ?? prov.primaryQuoteEnd;
  if (Number.isInteger(explicitStart) && Number.isInteger(explicitEnd) && explicitEnd > explicitStart) {
    return { start: explicitStart, end: explicitEnd };
  }
  const index = String(source || '').indexOf(quote);
  if (index >= 0) return { start: index, end: index + quote.length };
  return { start: 0, end: quote.length };
}

function definedTerm(prov) {
  const features = featureBag(prov);
  const explicit = prov.defined_term || prov.definedTerm || features.canonicalTerm || features.definedTerm;
  if (explicit) return String(explicit).replace(/^"|"$/g, '').trim();
  const text = textOf(prov);
  const match = text.match(/^\s*"?([^"]{2,120}?)"?\s+(?:means|shall mean|has the meaning)/i);
  return match ? match[1].trim() : null;
}

function definedValue(prov) {
  const features = featureBag(prov);
  if (prov.defined_value || prov.definedValue) return String(prov.defined_value || prov.definedValue).trim();
  if (features.definitionText) return String(features.definitionText).trim();
  const text = textOf(prov);
  const match = text.match(/\b(?:means|shall mean|has the meaning)\b\s+([\s\S]+)$/i);
  return match ? match[1].trim().replace(/\.$/, '') : null;
}

function buildProvenance(prov, options, span) {
  const existing = prov.provenance && typeof prov.provenance === 'object' ? prov.provenance : {};
  const now = options.extractedAt || new Date().toISOString();
  return {
    source_doc_id: existing.source_doc_id || prov.source_doc_id || prov.sourceDocId || options.sourceDocId || options.source_doc_id || options.dealId,
    source_doc_page: Number.isInteger(existing.source_doc_page) ? existing.source_doc_page : Number(prov.source_doc_page || prov.sourceDocPage || 0),
    source_doc_offset_start: Number.isInteger(existing.source_doc_offset_start)
      ? existing.source_doc_offset_start
      : Number(prov.startChar ?? prov.start_char ?? span.start ?? 0),
    source_doc_offset_end: Number.isInteger(existing.source_doc_offset_end)
      ? existing.source_doc_offset_end
      : Number(prov.endChar ?? prov.end_char ?? span.end ?? 0),
    extractor_name: existing.extractor_name || prov.extractor_name || options.extractorName || 'parser-v2',
    extractor_version: existing.extractor_version || prov.extractor_version || options.extractorVersion || 'm2-00-store-cards-v1',
    model: existing.model || prov.model || options.model || 'unknown',
    prompt_hash: existing.prompt_hash || prov.prompt_hash || options.promptHash || 'unknown',
    run_id: existing.run_id || prov.run_id || options.runId || 'unknown',
    extracted_at: existing.extracted_at || prov.extracted_at || now,
  };
}

function initialCardRow(dealId, prov, options = {}) {
  const text = textOf(prov);
  if (!text) throw new Error('Cannot build provision card without text');
  const type = provisionType(prov);
  const section = sectionPath(prov);
  const region = regionText(prov);
  const quote = String(prov.primary_quote || prov.primaryQuote || text);
  const span = quoteSpan(prov, quote, region);
  const provisionId = provisionInstanceId({ dealId, sectionPath: section, text });
  const region_id = regionId(prov);
  if (!region_id) throw new Error(`Cannot build provision card without region_id for ${section}`);

  const row = {
    deal_id: dealId,
    provision_type: type,
    provision_subtype: prov.code || prov.provision_subtype || prov.provisionSubtype || null,
    section_ref: section,
    short_title: titleOf(prov),
    party_scope: partyScope(prov, type),
    region_id,
    region_full_text: region,
    region_hash: prov.region_hash || prov.regionHash || spanHash(region),
    primary_quote_start: span.start,
    primary_quote_end: span.end,
    primary_quote: quote,
    extracted_by: prov.extracted_by || prov.extractedBy || options.extractedBy || 'CODEX',
    extraction_version: prov.extraction_version || prov.extractionVersion || options.extractionVersion || 'm2-00-store-cards-v1',
    needs_review: Boolean(prov.needs_review || prov.needsReview),
    review_notes: prov.review_notes || prov.reviewNotes || null,
    provision_instance_id: provisionId,
    excerpt_id: excerptId(provisionId, Number.isInteger(prov.excerptIndex) ? prov.excerptIndex : 0),
    kind: 'standard',
    defined_term: null,
    defined_value: null,
    references: [],
  };
  row.provenance = buildProvenance(prov, { ...options, dealId }, span);
  return row;
}

function applyDefinitionPass(rows, provisions) {
  const definitions = [];
  rows.forEach((row, index) => {
    const prov = provisions[index];
    const isDefinition = row.provision_type === 'DEFINITION' || /definition/i.test(prov.regionType || prov.region_type || '');
    if (!isDefinition) return;
    const term = definedTerm(prov);
    const value = definedValue(prov);
    if (!term || !value) return;
    row.kind = 'definition';
    row.defined_term = term;
    row.defined_value = value;
    definitions.push({
      term,
      needle: term.toLowerCase(),
      provision_instance_id: row.provision_instance_id,
    });
  });

  for (const row of rows) {
    if (row.kind === 'definition') continue;
    const haystack = `${row.primary_quote} ${row.region_full_text}`.toLowerCase();
    const refs = definitions
      .filter((definition) => haystack.includes(definition.needle))
      .map((definition) => definition.provision_instance_id);
    if (refs.length > 0) {
      row.kind = 'cross-reference';
      row.references = [...new Set(refs)];
    }
  }
  return rows;
}

function buildProvisionCardRows(dealId, extractorOutput, options = {}) {
  if (!dealId) throw new Error('dealId is required');
  const provisions = arrayFromExtractorOutput(extractorOutput);
  const rows = provisions.map((prov) => initialCardRow(dealId, prov, options));
  applyDefinitionPass(rows, provisions);
  rows.forEach(validateProvisionCardShape);
  return rows;
}

function isMissingCardTable(error) {
  const message = error && (error.message || String(error));
  return /provision_cards|schema cache|does not exist|Could not find/i.test(message || '');
}

// WRITE ORDER (load-bearing, do not revert to delete-then-upsert):
//
// public.claims anchors to public.provision_cards(excerpt_id) with
// ON DELETE CASCADE (see supabase/schema-05-claims.sql). excerpt_id is
// derived from provision_instance_id, which is a deterministic hash of
// (dealId, sectionPath, text) -- so a provision that is unchanged across
// a re-ingest gets the SAME provision_instance_id / excerpt_id both times.
//
// If we deleted all of a deal's provision_cards before upserting the new
// set (the old behaviour), every row -- including ones about to be
// recreated identically -- would be deleted first. That cascade-deletes
// ALL of that deal's claims, even for provisions that survive the
// re-ingest unchanged. The upsert that follows only recreates cards, not
// claims, so claims for that deal would be silently and permanently lost
// on every re-ingest.
//
// Fix: upsert the new rows first (onConflict: provision_instance_id), so
// surviving provisions are updated in place -- same row, same excerpt_id,
// no delete, no cascade, their claims are untouched. Only AFTER the
// upsert do we delete the orphans: cards for this deal whose
// provision_instance_id is not in the new extraction. Those are
// provisions that were genuinely removed, so cascading their claims is
// correct.
async function storeProvisionCards(dealId, extractorOutput, sb, options = {}) {
  if (!sb) throw new Error('Supabase client is required');
  const rows = buildProvisionCardRows(dealId, extractorOutput, options);
  // Index-aligned with `rows` by construction (buildProvisionCardRows maps
  // arrayFromExtractorOutput(extractorOutput) 1:1, in order, with no
  // filtering) -- recomputed here, not threaded out of
  // buildProvisionCardRows, so that function's tested signature/behaviour
  // stays untouched. This gives the claims writer below a native
  // cardRow <-> sourceProvision pairing for every card, no text matching.
  const provisions = arrayFromExtractorOutput(extractorOutput);

  if (rows.length === 0) {
    if (options.replaceDeal) {
      // Nothing survives this extraction, so every existing card for the
      // deal is an orphan by definition -- delete-all is the correct
      // (and only possible) orphan set here. This does still cascade all
      // of that deal's claims, which is correct: there are no provisions
      // left to anchor them.
      const { error: deleteError } = await sb.from('provision_cards').delete().eq('deal_id', dealId);
      if (deleteError) throw new Error(`Failed to delete existing provision_cards: ${deleteError.message}`);
    }
    return { rows: [], insertedCount: 0, claims: { rows: [], insertedCount: 0, staleDeleted: 0, unknownAttributes: [] } };
  }

  const { data, error } = await sb
    .from('provision_cards')
    .upsert(rows, { onConflict: 'provision_instance_id' })
    .select('id,provision_instance_id,kind');
  if (error) {
    if (isMissingCardTable(error)) {
      throw new Error('provision_cards table missing; run supabase/schema-03-card-model.sql and supabase/schema-04-provision-card-canonical.sql');
    }
    throw new Error(`Failed to upsert provision_cards: ${error.message}`);
  }

  if (options.replaceDeal) {
    // Orphaned cards (provisions removed by this re-ingest) cascade-delete
    // their claims for free via claims.excerpt_id's ON DELETE CASCADE FK to
    // provision_cards.excerpt_id (supabase/schema-05-claims.sql) -- run this
    // BEFORE the claims writer below so that cascade has already fired and
    // the claims writer's own stale-claim cleanup (scoped to the SURVIVING
    // excerpt_ids only) never has to reason about rows an orphaned card's
    // cascade would otherwise still be in the middle of removing.
    const survivingIds = new Set(rows.map((row) => row.provision_instance_id));
    const { data: existingRows, error: existingError } = await sb
      .from('provision_cards')
      .select('provision_instance_id')
      .eq('deal_id', dealId);
    if (existingError) {
      throw new Error(`Failed to read existing provision_cards for orphan cleanup: ${existingError.message}`);
    }
    const orphanIds = (existingRows || [])
      .map((row) => row.provision_instance_id)
      .filter((provisionInstanceIdValue) => !survivingIds.has(provisionInstanceIdValue));
    if (orphanIds.length > 0) {
      // .in() (not a hand-built "not in (...)" string) so postgrest-js
      // handles quoting of any reserved characters (",", "(", ")") that
      // can legitimately appear in provision_instance_id via sectionPath
      // (e.g. "Section 5.3(a)").
      const { error: deleteOrphansError } = await sb
        .from('provision_cards')
        .delete()
        .eq('deal_id', dealId)
        .in('provision_instance_id', orphanIds);
      if (deleteOrphansError) {
        throw new Error(`Failed to delete orphaned provision_cards: ${deleteOrphansError.message}`);
      }
    }
  }

  // Claims writer (WP-claims-ingest-writer): (re)writes public.claims for
  // this deal from the SAME extraction output the cards above came from,
  // anchored natively to each card's excerpt_id (see lib/parser-v2/store-
  // claims.js). Runs unconditionally alongside the cards upsert -- not
  // gated on options.replaceDeal -- so incremental per-type reprocess calls
  // (replaceDeal not set) still keep claims in sync with the cards they
  // just wrote; only the STALE-claim cleanup inside storeClaimsForDeal is
  // gated on replaceDeal, mirroring the cards orphan-cleanup gate above.
  const claimsResult = await storeClaimsForDeal(dealId, rows, provisions, sb, options);

  return { rows, data: data || [], insertedCount: rows.length, claims: claimsResult };
}

module.exports = {
  applyDefinitionPass,
  buildProvisionCardRows,
  initialCardRow,
  storeProvisionCards,
};
