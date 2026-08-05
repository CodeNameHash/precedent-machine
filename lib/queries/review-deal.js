const { buildFeaturesForCard, claimsForCard, groupClaimsByExcerpt } = require('./claims-adapter');
const { hasMidElision, unelideQuote } = require('../unelide-quote');

function parseReferences(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

function sortKey(card) {
  const provenance = card.provenance && typeof card.provenance === 'object' ? card.provenance : {};
  const rawOffset = provenance.source_doc_offset_start;
  const offset = rawOffset !== null && rawOffset !== undefined && rawOffset !== ''
    && Number.isFinite(Number(rawOffset))
    ? Number(provenance.source_doc_offset_start)
    : Number.MAX_SAFE_INTEGER;
  return [offset, card.section_ref || '', card.short_title || '', card.provision_instance_id || ''];
}

function compareCards(a, b) {
  const left = sortKey(a);
  const right = sortKey(b);
  for (let index = 0; index < left.length; index += 1) {
    if (typeof left[index] === 'number' || typeof right[index] === 'number') {
      const diff = Number(left[index]) - Number(right[index]);
      if (diff !== 0) return diff;
    } else {
      const diff = String(left[index]).localeCompare(String(right[index]));
      if (diff !== 0) return diff;
    }
  }
  return 0;
}

function stripProposedShortTitle(shortTitle) {
  return typeof shortTitle === 'string' ? shortTitle.replace(/^\[PROPOSED\] /, '') : shortTitle;
}

function normalizeDisplayRow(row, options = {}) {
  const mode = options.mode || options.renderMode || 'user';
  if (mode === 'admin') return row;
  return {
    ...row,
    short_title: stripProposedShortTitle(row.short_title),
  };
}

function isUncoveredTextCard(row) {
  const shortTitle = String(row && row.short_title ? row.short_title : '');
  const sectionRef = String(row && row.section_ref ? row.section_ref : '');
  return shortTitle.startsWith('Uncovered text') || sectionRef.includes('Uncovered text');
}

function filterRowsForMode(rows, options = {}) {
  const mode = options.mode || options.renderMode || 'user';
  const list = Array.isArray(rows) ? rows : [];
  if (mode === 'admin') return list;
  return list.filter((row) => !isUncoveredTextCard(row));
}

// A cross-reference only needs enough of the target definition to render the
// hover preview (DefinitionPreview in ProvisionCardTable reads exactly these
// five fields). Embedding the WHOLE definition row here duplicated its
// region_full_text / provenance / ai_metadata once per citing card — a
// commonly-cited term like "Material Adverse Effect" ballooned the payload by
// megabytes (Kraft's cards response was 10.4 MB, ~3.3 MB of it resolvedRefs).
// Project to the light shape; the full definition row is still shipped once in
// reviewDeal.definitions for anything that needs the rest.
function projectReference(def) {
  return {
    provision_instance_id: def.provision_instance_id,
    defined_term: def.defined_term,
    short_title: def.short_title,
    defined_value: def.defined_value,
    primary_quote: def.primary_quote,
  };
}

function featureString(value) {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (value && typeof value === 'object' && typeof value.value === 'string' && value.value.trim()) return value.value.trim();
  return null;
}

function normalizeDefinitionTerm(value) {
  return String(value || '').replace(/^[“"]|[”"]$/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function clipDefinitionText(text, ownTerm, knownTerms, boundaryTexts = []) {
  if (typeof text !== 'string' || !text.trim()) return text;
  const own = normalizeDefinitionTerm(ownTerm);
  const header = /(^|(?:\r?\n[ \t]*){2,}|[.;][ \t]+)(?:(?:as\s+used|for\s+purposes)[^“"\n]{0,120})?[“"]([^”"]{1,120})[”"](?:\s+(?:or|and)\s+[“"][^”"]{1,120}[”"])?[^“"\n.;]{0,40}?\b(?:means?|shall\s+mean|has\s+the\s+meaning|shall\s+have\s+the\s+meaning)\b/gim;
  let boundary = text.length;
  let match;
  while ((match = header.exec(text)) !== null) {
    const term = normalizeDefinitionTerm(match[2]);
    if (!term || term === own) continue;
    const prefix = match[1] || '';
    const startsNewParagraph = /\r?\n[ \t]*\r?\n/.test(prefix);
    if (!startsNewParagraph && !knownTerms.has(term)) continue;
    const cutAt = match.index + (/^[.;]/.test(prefix) ? 1 : 0);
    boundary = Math.min(boundary, cutAt);
    break;
  }
  for (const candidate of boundaryTexts) {
    const prefix = String(candidate || '').trim().slice(0, 180);
    if (prefix.length < 80) continue;
    const index = text.indexOf(prefix, 20);
    if (index >= 20) boundary = Math.min(boundary, index);
  }
  return boundary < text.length ? text.slice(0, boundary).trim() : text;
}

function repairDefinitionCardBoundaries(definitions, boundaryCards = []) {
  const list = Array.isArray(definitions) ? definitions : [];
  const knownTerms = new Set(list.map((card) => normalizeDefinitionTerm(card?.defined_term)).filter(Boolean));
  const boundaryTexts = [...new Set((boundaryCards || [])
    .filter((card) => card && card.kind !== 'definition')
    .flatMap((card) => [card.primary_quote, card.region_full_text])
    .filter((value) => typeof value === 'string' && value.trim().length >= 80))];
  return list.map((card) => {
    if (!card || card.kind !== 'definition') return card;
    const primary_quote = clipDefinitionText(card.primary_quote, card.defined_term, knownTerms, boundaryTexts);
    const region_full_text = clipDefinitionText(card.region_full_text, card.defined_term, knownTerms, boundaryTexts);
    const defined_value = clipDefinitionText(card.defined_value, card.defined_term, knownTerms, boundaryTexts);
    if (primary_quote === card.primary_quote && region_full_text === card.region_full_text && defined_value === card.defined_value) return card;
    return { ...card, primary_quote, region_full_text, defined_value };
  });
}

function normalizeCard(row, definitionsById, claimsByExcerpt) {
  const references = parseReferences(row.references);
  const resolvedReferences = references
    .map((id) => definitionsById.get(id))
    .filter(Boolean)
    .map(projectReference);
  // excerpt_id alone is not a unique card identity (2026-08-05 ruling) --
  // claimsForCard narrows the excerpt_id bucket to THIS row's own
  // provision_instance_id so a sibling card sharing the excerpt_id never
  // donates its claims to `row`. See lib/queries/claims-adapter.js.
  const claims = claimsForCard(claimsByExcerpt, row);
  const features = buildFeaturesForCard(claims);
  const isDefinition = row.kind === 'definition';
  const definedTerm = isDefinition ? featureString(features.canonicalTerm) : null;
  const definedValue = isDefinition ? featureString(features.definitionText) : null;
  return {
    ...row,
    defined_term: definedTerm || row.defined_term,
    defined_value: definedValue || row.defined_value,
    kind: row.kind || 'standard',
    references,
    resolvedReferences,
    unresolvedReferences: references.filter((id) => !definitionsById.has(id)),
    features,
  };
}

function groupRowsBySection(cards) {
  const groups = new Map();
  for (const card of cards) {
    const sectionRef = card.section_ref || 'Unspecified';
    if (!groups.has(sectionRef)) {
      groups.set(sectionRef, {
        sectionRef,
        title: sectionRef,
        cards: [],
      });
    }
    groups.get(sectionRef).cards.push(card);
  }
  return [...groups.values()].map((group) => ({
    ...group,
    cards: group.cards.sort(compareCards),
  }));
}

function shapeReviewDealRows(dealId, rows = [], options = {}) {
  const sortedRows = [...filterRowsForMode(rows, options)].sort(compareCards);
  const displayRows = sortedRows.map((row) => normalizeDisplayRow(row, options));
  const claimsByExcerpt = groupClaimsByExcerpt(options.claims);
  const rawDefinitions = displayRows.filter((row) => row.kind === 'definition');
  const definitionSeeds = rawDefinitions.map((row) => normalizeCard(row, new Map(), claimsByExcerpt));
  const seedDefinitionsById = new Map(definitionSeeds.map((row) => [row.provision_instance_id, row]));
  const hydratedDefinitions = repairDefinitionCardBoundaries(
    rawDefinitions.map((row) => normalizeCard(row, seedDefinitionsById, claimsByExcerpt)),
    displayRows,
  );
  const definitionsById = new Map(hydratedDefinitions.map((row) => [row.provision_instance_id, row]));
  const cards = displayRows.map((row) => (
    definitionsById.get(row.provision_instance_id) || normalizeCard(row, definitionsById, claimsByExcerpt)
  ));
  const definitions = cards.filter((card) => card.kind === 'definition');
  const sections = groupRowsBySection(cards);
  return {
    dealId,
    cardCount: cards.length,
    cards,
    definitions,
    sections,
  };
}

function isMissingTable(error, tableName) {
  const message = error && (error.message || String(error));
  return new RegExp(`${tableName}|schema cache|does not exist|Could not find`, 'i').test(message || '');
}

function isMissingProvisionCards(error) {
  return isMissingTable(error, 'provision_cards');
}

function isMissingClaims(error) {
  return isMissingTable(error, 'claims');
}

function isMissingTransactionSteps(error) {
  return isMissingTable(error, 'transaction_steps');
}

// FIX 9: transaction_steps (schema-02, per lib/parser-v2/store.js's
// materializeTransactionSteps) carries one row per merger-topology step --
// e.g. SkyWater/IonQ's two-step reverse-triangular-then-forward structure --
// which the single mergerForm claim on the Structure card can't fully
// describe. Degrades to [] (never throws) on environments that predate the
// schema-02 migration, same convention as fetchDealClaims above.
async function fetchTransactionSteps(dealId, sb) {
  const { data, error } = await sb
    .from('transaction_steps')
    .select('*')
    .eq('deal_id', dealId)
    .order('step_order', { ascending: true });
  if (error) {
    if (isMissingTransactionSteps(error)) return [];
    throw new Error(`Failed to read transaction_steps: ${error.message}`);
  }
  return data || [];
}

// PostgREST caps an unranged select() at 1000 rows. A single unpaginated
// query here silently truncated any deal with >1000 claims — Metsera
// (1,991), Chevron/Anadarko (1,688), and Skechers (2,442) all exceed it —
// dropping roughly half of every large deal's claims with no error, no
// warning, just fewer feature keys per card than the DB actually has. Page
// through with .range() like every other bulk fetch in this codebase (see
// lib/deal-quality-metrics.js#fetchAllProvisions).
const CLAIMS_PAGE_SIZE = 1000;

// Q5 (perf quick-wins, Jul 2026): lib/queries/claims-adapter.js only ever
// reads claim.attribute/canonical/evidence_quote/verbatim/excerpt_id, plus
// provenance.feature_value out of the (much larger) provenance blob — see
// richProvenanceFeatureValue(). select('*') was pulling every other claims
// column (full provenance including extractor metadata, prompt hashes,
// run ids, etc.) across a table that pages this deep on large deals purely
// to build server-side card.features — none of it reaches the wire. Narrow
// to exactly what the adapter reads, re-nesting feature_value back under
// `provenance.feature_value` after the fetch so the adapter's contract
// (and the fixtures in tests/queries/claims-adapter.test.js) stay unchanged.
//
// provision_instance_id (2026-08-05 ruling): excerpt_id is not a unique
// card identity, so claimsForCard() (claims-adapter.js) needs each claim's
// own provision_instance_id to resolve it to the correct sibling card.
// Both live claim-writers (lib/parser-v2/store-claims.js,
// scripts/backfill/claims-from-normalized.js) already stamp this column
// from the owning card row.
const CLAIMS_SELECT = [
  'id',
  'deal_id',
  'excerpt_id',
  'provision_instance_id',
  'attribute',
  'canonical',
  'evidence_quote',
  'verbatim',
  'feature_value:provenance->feature_value',
].join(', ');

function reshapeNarrowClaimRow(row) {
  if (!row || typeof row !== 'object') return row;
  const { feature_value, ...rest } = row;
  return { ...rest, provenance: { feature_value: feature_value ?? null } };
}

async function fetchDealClaims(dealId, sb) {
  const out = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await sb
      .from('claims')
      .select(CLAIMS_SELECT)
      .eq('deal_id', dealId)
      .order('id', { ascending: true })
      .range(offset, offset + CLAIMS_PAGE_SIZE - 1);
    if (error) {
      // The claims table is a newer, separately-backfilled addition. Degrade
      // to "no claims" rather than failing the whole review page when it's
      // not present yet in a given environment; any other error still throws.
      if (isMissingClaims(error)) return [];
      throw new Error(`Failed to read claims: ${error.message}`);
    }
    out.push(...(data || []).map(reshapeNarrowClaimRow));
    if (!data || data.length < CLAIMS_PAGE_SIZE) break;
    offset += CLAIMS_PAGE_SIZE;
  }
  return out;
}

// r13 (Ben, "% of deal value" feature): the review page's fee rows (see
// components/review/table-configs/termination-fees.config.js) need the
// deal's equity value at announcement to compute a % of deal value figure
// next to each fee amount. Degrades to null (never throws) if the deals row
// is missing/unreadable — the fee rows just render without the percentage,
// same as today.
async function fetchDealValueUsd(dealId, sb) {
  const { data, error } = await sb.from('deals').select('value_usd').eq('id', dealId).maybeSingle();
  if (error || !data) return null;
  const value = Number(data.value_usd);
  return Number.isFinite(value) && value > 0 ? value : null;
}

// r17b (Ben): QXO's proration See-provision expansion showed a CUT-OFF
// quote — the stored prorationMechanics.oversubscriptionTreatment excerpt
// carries a literal mid-string " ... " where the extractor elided exactly
// the operative payment formulas ("(1) cash × Cash Proration Fraction
// (2) Parent Shares × (one minus the Cash Proration Fraction)"). The
// complete clause DOES exist in the provisions layer (the deal's CONSID
// provision full_text). Server-side repair: for CONSID-family cards'
// election/proration mechanics strings that carry a mid-elision, fetch the
// deal's CONSID provisions' full_text (one small filtered query) and
// replace the elided excerpt with the complete span where BOTH anchors
// resolve (lib/unelide-quote.js — never guesses; anchor miss keeps the
// stored quote). Scoped tightly to the mechanics objects whose strings
// feed the See-provision expansion (electionMechanics/prorationMechanics,
// incl. oversubscriptionTreatment / electionDeadline / text); everything
// else is untouched. Degrades gracefully: any fetch failure => original
// quotes. Root cause (capture width at extraction time) is on the
// re-extract punchlist in docs/PLAN.md.
const MECHANICS_FEATURE_KEYS = ['electionMechanics', 'prorationMechanics'];

function isConsidFamilyCard(card) {
  const type = String((card && card.provision_type) || '').toUpperCase();
  const subtype = String((card && card.provision_subtype) || '').toUpperCase();
  return type.startsWith('CONSID') || subtype.startsWith('CONSID');
}

// Mutable slots ({ mech, field, quote }) for every top-level string in a
// CONSID card's mechanics objects that carries a mid-string elision.
// Mutating slot.mech[field] also updates reviewDeal.sections/definitions —
// groupRowsBySection shares the same card objects by reference.
function collectElidedMechanicsSlots(cards) {
  const slots = [];
  for (const card of cards || []) {
    if (!isConsidFamilyCard(card)) continue;
    const features = card && card.features;
    if (!features || typeof features !== 'object') continue;
    for (const key of MECHANICS_FEATURE_KEYS) {
      const mech = features[key];
      if (!mech || typeof mech !== 'object' || Array.isArray(mech)) continue;
      for (const [field, value] of Object.entries(mech)) {
        if (typeof value === 'string' && hasMidElision(value)) {
          slots.push({ mech, field, quote: value });
        }
      }
    }
  }
  return slots;
}

async function fetchConsidProvisionTexts(dealId, sb) {
  const { data, error } = await sb
    .from('provisions')
    .select('id, full_text')
    .eq('deal_id', dealId)
    .ilike('type', 'CONSID%');
  if (error) return [];
  return (data || [])
    .map((row) => row && row.full_text)
    .filter((text) => typeof text === 'string' && text.length > 0);
}

async function unelideMechanicsQuotes(dealId, cards, sb) {
  try {
    const slots = collectElidedMechanicsSlots(cards);
    if (!slots.length) return 0;
    const fullTexts = await fetchConsidProvisionTexts(dealId, sb);
    if (!fullTexts.length) return 0;
    // Longest provision first — the richest source is the likeliest home of
    // a long mechanics clause, and a resolved span in a longer text can't be
    // shadowed by a partial match in a fragment.
    fullTexts.sort((a, b) => b.length - a.length);
    let replaced = 0;
    for (const slot of slots) {
      for (const fullText of fullTexts) {
        const complete = unelideQuote(slot.quote, fullText);
        if (complete) {
          slot.mech[slot.field] = complete;
          replaced += 1;
          break;
        }
      }
    }
    return replaced;
  } catch {
    return 0; // degrade to the stored (elided) quotes, never fail the page
  }
}

async function fetchReviewDealCards(dealId, sb, options = {}) {
  if (!dealId) throw new Error('dealId is required');
  if (!sb) throw new Error('Supabase client is required');
  const [cardsResult, claims, transactionSteps, valueUsd] = await Promise.all([
    sb.from('provision_cards').select('*').eq('deal_id', dealId),
    fetchDealClaims(dealId, sb),
    fetchTransactionSteps(dealId, sb),
    fetchDealValueUsd(dealId, sb),
  ]);
  const { data, error } = cardsResult;
  if (error) {
    if (isMissingProvisionCards(error)) {
      throw new Error('provision_cards table missing; run schema-03 and schema-04 card migrations');
    }
    throw new Error(`Failed to read provision_cards: ${error.message}`);
  }
  const reviewDeal = shapeReviewDealRows(dealId, data || [], { ...options, claims });
  await unelideMechanicsQuotes(dealId, reviewDeal.cards, sb);
  return { ...reviewDeal, transactionSteps, value_usd: valueUsd };
}

module.exports = {
  CLAIMS_SELECT,
  collectElidedMechanicsSlots,
  unelideMechanicsQuotes,
  compareCards,
  fetchDealClaims,
  fetchDealValueUsd,
  fetchReviewDealCards,
  fetchTransactionSteps,
  groupRowsBySection,
  filterRowsForMode,
  isUncoveredTextCard,
  parseReferences,
  repairDefinitionCardBoundaries,
  reshapeNarrowClaimRow,
  shapeReviewDealRows,
  stripProposedShortTitle,
};
