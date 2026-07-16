/**
 * store.js — Phase 5 of the v2 parser pipeline.
 *
 * Atomic storage of extracted provisions into Supabase:
 *   1. Store raw agreement text in deals.metadata.full_text
 *   2. Delete existing provisions + annotations for the deal (clean slate)
 *   3. Batch-insert new provisions
 *
 * CommonJS — consumed by Next.js API routes.
 */

// Canonicalize favorability to neutral / buyer-favorable / seller-favorable so
// new extractions never reintroduce the ~10 spelling variants the model emits.
const { canonicalFavorability } = require('../search');
const { validateFeatures, validationSummary } = require('../schema/validation');
const { normalizeForMatch, sanitizeFeatureQuotes } = require('../verification');
const { enforceConsiderationEquityInvariants } = require('./consideration-equity');
const { enforceElectionInvariants } = require('./elections');
const { deriveTopology, enforceTransactionStepInvariants } = require('../schema/topology-detector');
const {
  buildAdvisorsFact,
  considerationTypeLabel,
  deriveConsiderationFactFromProvisions,
  mergeDealFacts,
} = require('../deal-facts');
const normFav = (v) => canonicalFavorability(v) || 'neutral';

function provisionText(prov) {
  if (!prov || typeof prov !== 'object') return '';
  if (typeof prov.full_text === 'string') return prov.full_text;
  if (typeof prov.text === 'string') return prov.text;
  return '';
}

function stripPipelineMarkers(text) {
  return String(text || '')
    .replace(/\[\[\/?[A-Za-z0-9_ -]+\]\]/g, '')
    .replace(/\[\[\/?[A-Za-z0-9_ -]+\]?$/g, '')
    .replace(/\[\[\/?[A-Za-z0-9_ -]*$/g, '')
    .trim();
}

function scrubMarkerValue(value) {
  if (typeof value === 'string') return stripPipelineMarkers(value);
  if (Array.isArray(value)) return value.map(scrubMarkerValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, val]) => [key, scrubMarkerValue(val)]));
  }
  return value;
}

function cleanProvisionText(prov) {
  return stripPipelineMarkers(provisionText(prov));
}

function normalizeProvisionText(text) {
  return String(text || '')
    .replace(/\[\[\/?[A-Za-z0-9_ -]+\]\]/g, '')
    .replace(/\[\[\/?[A-Za-z0-9_ -]+\]?$/g, '')
    .replace(/\[\[\/?[A-Za-z0-9_ -]*$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function quoteVerificationSummary(scrub) {
  if (!scrub || (scrub.removed <= 0 && scrub.repaired <= 0)) return null;
  return {
    removed: scrub.removed,
    repaired: scrub.repaired || 0,
    details: scrub.details.slice(0, 10),
  };
}

function scrubProvisionFeatureQuotes(prov, sourceText, normalizedSource) {
  const features = prov && prov.features && typeof prov.features === 'object' ? prov.features : {};
  return quoteVerificationSummary(sanitizeFeatureQuotes(features, sourceText, {
    provisionText: provisionText(prov),
    normalizedSource,
  }));
}

function optionalProvisionColumns(prov) {
  const out = {};
  const regionId = prov && (prov.regionId || prov.region_id);
  if (regionId) out.region_id = regionId;
  const considId = prov && (prov.considerationEquityProvisionId || prov.consideration_equity_provision_id);
  if (considId) out.consideration_equity_provision_id = considId;
  return out;
}

function stripOptionalProvisionColumns(row) {
  if (!row || typeof row !== 'object') return row;
  const { region_id, consideration_equity_provision_id, ...rest } = row;
  return rest;
}

function isMissingOptionalProvisionColumnError(msg) {
  return typeof msg === 'string' &&
    /column.*(?:region_id|consideration_equity_provision_id)|(?:region_id|consideration_equity_provision_id).*does not exist|schema cache/i.test(msg);
}

function archiveUnavailable(error) {
  const msg = error && (error.message || String(error));
  return error && (error.code === '42P01' || /provisions_archive_20260706|does not exist|Could not find/i.test(msg || ''));
}

async function archiveProvisionRows(sb, rows, reason) {
  const list = Array.isArray(rows) ? rows.filter(Boolean) : [];
  if (list.length === 0) return { archived: 0 };
  const payload = list.map((row) => ({
    original_provision_id: row.id || null,
    deal_id: row.deal_id || null,
    archive_reason: reason,
    row_data: row,
  }));
  const { error } = await sb.from('provisions_archive_20260706').insert(payload);
  if (error) {
    if (archiveUnavailable(error)) {
      throw new Error('provisions_archive_20260706 table missing; run supabase/parser-regions-consideration-schema.sql before replacing consideration rows');
    }
    throw new Error(`Failed to archive provisions before replacement: ${error.message}`);
  }
  return { archived: list.length };
}

function dbTreatmentRow(provisionId, treatment, extractedBy) {
  return {
    provision_id: provisionId,
    instrument_type: treatment.instrumentType,
    vesting_treatment: treatment.vestingTreatment || 'UNSPECIFIED',
    consideration_type: treatment.considerationType || 'N_A',
    cash_formula: treatment.cashFormula || null,
    stock_formula: treatment.stockFormula || null,
    in_the_money_only: typeof treatment.inTheMoneyOnly === 'boolean' ? treatment.inTheMoneyOnly : null,
    performance_treatment: treatment.performanceTreatment || null,
    tax_treatment_note: treatment.taxTreatmentNote || null,
    span_type: treatment.spanType,
    source_span_start: treatment.sourceSpanStart,
    source_span_end: treatment.sourceSpanEnd,
    verbatim_quote: treatment.verbatimQuote,
    bring_down_section_ref: treatment.bringDownSectionRef || null,
    bring_down_verbatim_quote: treatment.bringDownVerbatimQuote || null,
    bring_down_region_id: treatment.bringDownRegionId || null,
    extracted_by: extractedBy || 'CODEX',
    confidence: treatment.confidence || 'LOW',
    updated_at: new Date().toISOString(),
  };
}

function isMissingSchema02Error(error) {
  const msg = error && (error.message || String(error));
  return /transaction_steps|deal_topology|election_mechanisms|election_options|proration_rules|transaction_step_id|election_needs_review|schema cache|does not exist|Could not find/i.test(msg || '');
}

function dbStepRow(dealId, step) {
  return {
    deal_id: dealId,
    step_order: step.step_order,
    step_kind: step.step_kind,
    disappearing_entity: step.disappearing_entity,
    surviving_entity: step.surviving_entity,
    parent_entity: step.parent_entity || null,
    effective_time_ref: step.effective_time_ref,
    effective_time_definition_quote: step.effective_time_definition_quote,
    is_taxable: step.is_taxable ?? null,
    tax_treatment_note: step.tax_treatment_note || null,
    region_id: step.region_id || step.regionId || null,
    section_refs: Array.isArray(step.section_refs) ? step.section_refs : [],
    extracted_by: step.extracted_by || 'CODEX',
    updated_at: new Date().toISOString(),
  };
}

async function materializeTransactionSteps(dealId, model, sb) {
  if (!model || !Array.isArray(model.steps) || model.steps.length === 0) return null;
  const topology = model.topology || deriveTopology(model.steps);
  enforceTransactionStepInvariants(model.steps, topology);

  let delTopology = await sb.from('deal_topology').delete().eq('deal_id', dealId);
  if (delTopology.error && isMissingSchema02Error(delTopology.error)) return null;
  if (delTopology.error) throw new Error(`Failed to replace deal topology: ${delTopology.error.message}`);

  const delSteps = await sb.from('transaction_steps').delete().eq('deal_id', dealId);
  if (delSteps.error && isMissingSchema02Error(delSteps.error)) return null;
  if (delSteps.error) throw new Error(`Failed to replace transaction steps: ${delSteps.error.message}`);

  const rows = model.steps.map((step) => dbStepRow(dealId, step));
  const { data: inserted, error: stepErr } = await sb
    .from('transaction_steps')
    .insert(rows)
    .select('id, step_order, step_kind, effective_time_ref');
  if (stepErr) {
    if (isMissingSchema02Error(stepErr)) return null;
    throw new Error(`Failed to insert transaction steps: ${stepErr.message}`);
  }

  const stepsByOrder = new Map((inserted || []).map((row) => [Number(row.step_order), row]));
  const primaryOrder = Number(topology.primary_step_order || 1);
  const primary = stepsByOrder.get(primaryOrder) || stepsByOrder.get(1);
  if (!primary) throw new Error('Failed to resolve primary transaction step id');

  const topologyPayload = {
    deal_id: dealId,
    topology: topology.topology,
    step_count: topology.step_count,
    primary_step_id: primary.id,
    topology_needs_review: Boolean(topology.topology_needs_review),
    review_note: topology.review_note || (Array.isArray(model.warnings) && model.warnings.length ? model.warnings.join(' ') : null),
    extracted_by: 'CODEX',
    updated_at: new Date().toISOString(),
  };
  const { error: topoErr } = await sb.from('deal_topology').insert(topologyPayload);
  if (topoErr) {
    if (isMissingSchema02Error(topoErr)) return null;
    throw new Error(`Failed to insert deal topology: ${topoErr.message}`);
  }

  return {
    topology: topologyPayload,
    steps: inserted || [],
    stepsByOrder,
    primaryStepId: primary.id,
  };
}

async function fetchTransactionContext(dealId, sb) {
  const { data: topologyRows, error: topoErr } = await sb
    .from('deal_topology')
    .select('*')
    .eq('deal_id', dealId);
  if (topoErr) {
    if (isMissingSchema02Error(topoErr)) return null;
    throw new Error(`Failed to read deal topology: ${topoErr.message}`);
  }
  const topology = topologyRows && topologyRows[0];
  if (!topology) return null;
  const { data: steps, error: stepsErr } = await sb
    .from('transaction_steps')
    .select('id, step_order, step_kind, effective_time_ref')
    .eq('deal_id', dealId)
    .order('step_order', { ascending: true });
  if (stepsErr) {
    if (isMissingSchema02Error(stepsErr)) return null;
    throw new Error(`Failed to read transaction steps: ${stepsErr.message}`);
  }
  return {
    topology,
    steps: steps || [],
    stepsByOrder: new Map((steps || []).map((row) => [Number(row.step_order), row])),
    primaryStepId: topology.primary_step_id || null,
  };
}

function transactionStepForProvision(prov, context) {
  if (!context || !context.topology || !Array.isArray(context.steps)) return { id: null, needsReview: false };
  if (context.topology.topology === 'SINGLE_MERGER') return { id: null, needsReview: false };
  const text = String((prov && (prov.text || prov.full_text)) || '');
  const steps = context.steps;
  const byKind = (kind) => steps.find((s) => s.step_kind === kind);
  if (/acceptance\s+time|offer/i.test(text)) {
    const step = byKind('TENDER_OFFER');
    if (step) return { id: step.id, needsReview: false };
  }
  if (/second\s+effective\s+time|subsequent\s+merger|second\s+merger/i.test(text)) {
    const step = byKind('SUBSEQUENT_MERGER') || steps[1];
    if (step) return { id: step.id, needsReview: false };
  }
  if (/first\s+effective\s+time|first\s+merger/i.test(text)) {
    const step = byKind('MERGER') || steps[0];
    if (step) return { id: step.id, needsReview: false };
  }
  if (/effective\s+time|merger/i.test(text)) {
    const step = steps.find((s) => s.id === context.primaryStepId) || steps[0];
    if (step) return { id: step.id, needsReview: true };
  }
  return { id: context.primaryStepId || (steps[0] && steps[0].id) || null, needsReview: true };
}

function dbProrationRule(rule) {
  return {
    proration_trigger: rule.prorationTrigger,
    proration_method: rule.prorationMethod,
    cap_definitions: rule.capDefinitions || {},
    non_electing_treatment: rule.nonElectingTreatment,
    source_span_start: rule.sourceSpanStart,
    source_span_end: rule.sourceSpanEnd,
    verbatim_quote: rule.verbatimQuote,
    proration_walkthrough: rule.prorationWalkthrough || null,
    updated_at: new Date().toISOString(),
  };
}

function dbElectionOption(mechanismId, option) {
  return {
    election_mechanism_id: mechanismId,
    option_label: option.optionLabel,
    option_type: option.optionType,
    cash_per_share: option.cashPerShare,
    cash_per_share_formula: option.cashPerShareFormula || null,
    stock_per_share: option.stockPerShare,
    stock_per_share_formula: option.stockPerShareFormula || null,
    cvr_included: option.cvrIncluded,
    cvr_note: option.cvrNote || null,
    aggregate_cap_type: option.aggregateCapType,
    aggregate_cap_value: option.aggregateCapValue,
    aggregate_cap_formula: option.aggregateCapFormula || null,
    source_span_start: option.sourceSpanStart,
    source_span_end: option.sourceSpanEnd,
    verbatim_quote: option.verbatimQuote,
    display_order: option.displayOrder,
    updated_at: new Date().toISOString(),
  };
}

async function cleanupElectionInsert(sb, mechanismId, prorationRuleId) {
  if (mechanismId) {
    const { error } = await sb.from('election_mechanisms').delete().eq('id', mechanismId);
    if (error) console.warn(`[store] failed to clean up election mechanism ${mechanismId}: ${error.message}`);
  }
  if (prorationRuleId) {
    const { error } = await sb.from('proration_rules').delete().eq('id', prorationRuleId);
    if (error) console.warn(`[store] failed to clean up proration rule ${prorationRuleId}: ${error.message}`);
  }
}

async function writeElectionMechanism(provisionId, election, regionFullText, sb, transactionStepId) {
  if (!election) return null;
  enforceElectionInvariants(election, regionFullText);

  const { data: existing, error: existingErr } = await sb
    .from('election_mechanisms')
    .select('id, proration_rule_id')
    .eq('provision_id', provisionId);
  if (existingErr) {
    if (isMissingSchema02Error(existingErr)) throw new Error('WP-SCHEMA-02 election tables missing; run supabase/schema-02-election.sql');
    throw new Error(`Failed to read existing election mechanism: ${existingErr.message}`);
  }
  const oldProrationIds = (existing || []).map((row) => row.proration_rule_id).filter(Boolean);
  if (existing && existing.length > 0) {
    const { error: delErr } = await sb.from('election_mechanisms').delete().eq('provision_id', provisionId);
    if (delErr) throw new Error(`Failed to replace election mechanism: ${delErr.message}`);
  }
  if (oldProrationIds.length > 0) {
    const { error: oldPrErr } = await sb.from('proration_rules').delete().in('id', oldProrationIds);
    if (oldPrErr) throw new Error(`Failed to delete old proration rule: ${oldPrErr.message}`);
  }

  let prorationRuleId = null;
  let mechanismId = null;
  if (election.prorationRule) {
    const { data: prData, error: prErr } = await sb
      .from('proration_rules')
      .insert(dbProrationRule(election.prorationRule))
      .select('id')
      .single();
    if (prErr) throw new Error(`Failed to insert proration rule: ${prErr.message}`);
    prorationRuleId = prData && prData.id;
  }

  const mechanismPayload = {
    provision_id: provisionId,
    transaction_step_id: transactionStepId || null,
    election_type: election.electionType,
    is_prorated: Boolean(election.isProrated),
    default_treatment: election.defaultTreatment,
    election_deadline_ref: election.electionDeadlineRef || null,
    election_deadline_quote: election.electionDeadlineQuote || null,
    proration_rule_id: prorationRuleId,
    source_span_start: election.sourceSpanStart,
    source_span_end: election.sourceSpanEnd,
    verbatim_quote: election.verbatimQuote,
    extracted_by: election.extractedBy || 'CODEX',
    updated_at: new Date().toISOString(),
  };
  const { data: mechanismData, error: mechErr } = await sb
    .from('election_mechanisms')
    .insert(mechanismPayload)
    .select('id')
    .single();
  if (mechErr) {
    await cleanupElectionInsert(sb, null, prorationRuleId);
    throw new Error(`Failed to insert election mechanism: ${mechErr.message}`);
  }
  mechanismId = mechanismData && mechanismData.id;

  const optionRows = election.options.map((option) => dbElectionOption(mechanismId, option));
  const { error: optErr } = await sb.from('election_options').insert(optionRows);
  if (optErr) {
    await cleanupElectionInsert(sb, mechanismId, prorationRuleId);
    throw new Error(`Failed to insert election options: ${optErr.message}`);
  }
  return mechanismId;
}

async function upsertConsiderationEquity(sb, payload) {
  let result = await sb
    .from('consideration_equity_provisions')
    .upsert(payload, { onConflict: 'deal_id,region_hash' })
    .select('id')
    .single();
  if (result.error && isMissingSchema02Error(result.error)) {
    const { transaction_step_id: _stepId, election_needs_review: _needsReview, ...legacyPayload } = payload;
    result = await sb
      .from('consideration_equity_provisions')
      .upsert(legacyPayload, { onConflict: 'deal_id,region_hash' })
      .select('id')
      .single();
  }
  return result;
}

async function writeConsiderationEquity(dealId, prov, sb, context = null) {
  const extracted = prov && prov.features && prov.features.considerationEquity;
  if (!extracted) return null;
  enforceConsiderationEquityInvariants(extracted);
  if (extracted.electionMechanism) enforceElectionInvariants(extracted.electionMechanism, extracted.regionFullText);

  const stepBinding = transactionStepForProvision(prov, context);
  if (context && context.topology && context.topology.topology !== 'SINGLE_MERGER' && !stepBinding.id) {
    throw new Error('transaction_steps invariant failed: multi-step consideration provision missing transaction_step_id');
  }

  const payload = {
    deal_id: dealId,
    section_ref: extracted.sectionRef || null,
    region_id: extracted.regionId || prov.regionId || prov.region_id || null,
    transaction_step_id: stepBinding.id,
    region_full_text: extracted.regionFullText,
    region_hash: extracted.regionHash,
    treatment_grouping: extracted.treatmentGrouping,
    election_needs_review: Boolean(extracted.electionMechanism && stepBinding.needsReview),
    extracted_by: extracted.extractedBy || 'CODEX',
    extraction_version: extracted.extractionVersion || 'consideration-equity-v1',
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await upsertConsiderationEquity(sb, payload);

  if (error) {
    const missing = /consideration_equity_provisions|schema cache|does not exist|Could not find/i.test(error.message || '');
    if (missing) throw new Error('consideration_equity_provisions table missing; run supabase/parser-regions-consideration-schema.sql');
    throw new Error(`Failed to write consideration equity provision: ${error.message}`);
  }

  const provisionId = data && data.id;
  const { error: delErr } = await sb
    .from('consideration_treatments')
    .delete()
    .eq('provision_id', provisionId);
  if (delErr) throw new Error(`Failed to replace consideration treatments: ${delErr.message}`);

  const treatmentRows = (extracted.treatments || []).map((t) => dbTreatmentRow(provisionId, t, extracted.extractedBy));
  if (treatmentRows.length > 0) {
    const { error: insErr } = await sb.from('consideration_treatments').insert(treatmentRows);
    if (insErr) {
      await sb.from('consideration_equity_provisions').delete().eq('id', provisionId);
      throw new Error(`Failed to insert consideration treatments: ${insErr.message}`);
    }
  }

  if (extracted.electionMechanism) {
    await writeElectionMechanism(provisionId, extracted.electionMechanism, extracted.regionFullText, sb, stepBinding.id);
  }

  prov.considerationEquityProvisionId = provisionId;
  prov.consideration_equity_provision_id = provisionId;
  prov.features = {
    ...(prov.features || {}),
    considerationEquityProvisionId: provisionId,
  };
  return provisionId;
}

async function materializeConsiderationEquity(dealId, provisions, sb, context = null) {
  for (const prov of provisions || []) {
    if (!prov) continue;
    if (!(prov.features && prov.features.considerationEquity)) continue;
    await writeConsiderationEquity(dealId, prov, sb, context);
  }
}

// The canonical code for a provision, at the same fallback precedence used
// when shaping ai_metadata for storage (see prov.code || features.canonicalCode
// at lines ~718/933 below). Provisions with NO code resolve to '' — kept
// identical across every provision so the no-code dedupe behavior is
// unchanged (see dedupeProvisions).
function provisionDedupeCode(prov) {
  if (!prov) return '';
  if (prov.code) return String(prov.code);
  if (prov.features && prov.features.canonicalCode) return String(prov.features.canonicalCode);
  return '';
}

// Drops duplicate provisions that share a (near-)identical normalized text
// span. The dedupe key includes the resolved canonical code (see
// provisionDedupeCode) alongside type/text: two provisions with IDENTICAL
// text but DIFFERENT codes are genuinely distinct extractions (e.g. Strategy
// B's minimal-span decomposition can anchor two different codes on the same
// sentence) and must both survive. Provisions with no code at all fall back
// to '' for every entry, so the no-code case dedupes exactly as before.
function dedupeProvisions(provisions) {
  if (!Array.isArray(provisions)) return [];

  const seenTypeCodeAndText = new Set();
  const firstPass = [];

  for (const prov of provisions) {
    const normalizedText = normalizeProvisionText(provisionText(prov));
    if (!normalizedText) {
      firstPass.push(prov);
      continue;
    }

    const key = `${prov && prov.type ? prov.type : ''}||${provisionDedupeCode(prov)}||${normalizedText}`;
    if (seenTypeCodeAndText.has(key)) continue;
    seenTypeCodeAndText.add(key);
    firstPass.push(prov);
  }

  const seenCodeAndText = new Set();
  const deduped = [];

  for (const prov of firstPass) {
    const normalizedText = normalizeProvisionText(provisionText(prov));
    if (!normalizedText) {
      deduped.push(prov);
      continue;
    }

    const key = `${provisionDedupeCode(prov)}||${normalizedText}`;
    if (seenCodeAndText.has(key)) continue;
    seenCodeAndText.add(key);
    deduped.push(prov);
  }

  return deduped;
}

// Differentiate provisions that share (type, category) but have DIFFERENT
// text: two genuinely distinct sections stored under one label read as
// duplicates in the UI ("Capitalization; Subsidiaries" twice — SECTION 3.02
// Capital Structure vs SECTION 3.03 Company Subsidiaries). When a group has
// 2+ members, suffix each member's category with its OWN section heading
// (parsed from the leading "SECTION 3.02. Capital Structure." of its text),
// falling back to the section number, so every row is distinguishable.
// Groups of one are untouched; true duplicates were already removed above.
function differentiateCategories(provisions) {
  const groups = new Map();
  for (const p of provisions || []) {
    if (!p || !p.category) continue;
    const key = `${p.type}||${p.category}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }
  let renamed = 0;
  for (const members of groups.values()) {
    if (members.length < 2) continue;
    for (const p of members) {
      const text = String(p.full_text || p.text || '');
      const m = text.match(/^\s*SECTION\s+(\d+\.\d+)\.?\s+([A-Z][^.\n]{2,60})[.\n]/i);
      const own = m ? m[2].trim() : null;
      const num = m ? m[1] : (p.ai_metadata && p.ai_metadata.features && p.ai_metadata.features.sectionNumber) || null;
      // Only rename when the section's own heading DIFFERS from the shared
      // label — that's what makes the rows distinguishable.
      if (own && own.toLowerCase() !== String(p.category).toLowerCase()) {
        p.category = `${p.category} — ${own}`;
        renamed += 1;
      } else if (!own && num) {
        p.category = `${p.category} (§${num})`;
        renamed += 1;
      }
    }
  }
  if (renamed > 0) console.log(`[store] differentiated ${renamed} same-category provision name(s)`);
  return provisions;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Store provisions atomically in Supabase.
 *
 * @param {string} dealId — the deal UUID
 * @param {Array<Object>} provisions — validated provisions from Phase 4
 * @param {string} agreementText — the full agreement source text
 * @param {string} title — agreement title
 * @param {Object} sb — Supabase client instance (from getServiceSupabase)
 * @returns {{ agreementSourceId: string, insertedCount: number, deletedCount: number, errors: Array }}
 */
async function storeProvisions(dealId, provisions, agreementText, title, sb, extras = {}) {
  const errors = [];
  let agreementSourceId = null;
  let deletedCount = 0;
  let insertedCount = 0;

  // ── Step 1: Store raw agreement text on deals.metadata ──
  try {
    const { data: existingDeal, error: fetchErr } = await sb
      .from('deals')
      .select('metadata')
      .eq('id', dealId)
      .single();

    if (fetchErr) {
      errors.push(`Failed to read deal metadata: ${fetchErr.message}`);
    } else {
      const existingMetadata = (existingDeal && existingDeal.metadata) || {};
      const dealFacts = {};
      const considerationFact = deriveConsiderationFactFromProvisions(provisions || []);
      if (considerationFact) dealFacts.consideration = considerationFact;
      const advisorsFact = buildAdvisorsFact(extras.advisors);
      if (advisorsFact) dealFacts.advisors = advisorsFact;

      const baseMetadata = Object.keys(dealFacts).length > 0
        ? mergeDealFacts(existingMetadata, dealFacts)
        : existingMetadata;
      const newMetadata = {
        ...baseMetadata,
        full_text: agreementText,
        agreement_title: title || existingMetadata.agreement_title || 'Merger Agreement',
        ingested_at: new Date().toISOString(),
        char_count: agreementText.length,
        pipeline: 'parser-v2',
        ...(considerationFact ? {
          headlineConsiderationType: considerationFact.type,
          considerationType: considerationTypeLabel(considerationFact.type) || considerationFact.summary || considerationFact.type,
        } : {}),
        // Stage 4: advisors model. We only OVERWRITE when the caller
        // supplied a non-empty advisors array — that way manual edits
        // persisted on the deal aren't blown away on re-ingest with a
        // weaker auto-extraction.
        ...(Array.isArray(extras.advisors) && extras.advisors.length > 0
          ? { advisors: extras.advisors }
          : (existingMetadata.advisors ? { advisors: existingMetadata.advisors } : {})),
        // Classified-sections snapshot (lib/parser-v2/snapshot.js): persisted
        // at ingest time so later per-type re-extraction (run-extract.js /
        // scripts/reprocess.js) can skip fetch → parse → classify entirely.
        // Only written when the caller supplies it — additive, never clears.
        ...(Array.isArray(extras.classified_sections) && extras.classified_sections.length > 0
          ? {
              classified_sections: extras.classified_sections,
              classify_run_at: new Date().toISOString(),
              ...(extras.classify_breakdown ? { classify_breakdown: extras.classify_breakdown } : {}),
            }
          : {}),
      };

      const { error: updateErr } = await sb
        .from('deals')
        .update({ metadata: newMetadata })
        .eq('id', dealId);

      if (updateErr) {
        errors.push(`Failed to write deal metadata: ${updateErr.message}`);
      } else {
        agreementSourceId = dealId; // use dealId as a stand-in identifier
      }
    }
  } catch (err) {
    errors.push(`Metadata storage error: ${err.message}`);
  }

  // ── Step 2: Delete existing provisions for this deal (clean slate) ──
  try {
    // First, get IDs of existing provisions so we can delete their annotations
    const { data: existingProvisions } = await sb
      .from('provisions')
      .select('*')
      .eq('deal_id', dealId);

    if (existingProvisions && existingProvisions.length > 0) {
      const provisionIds = existingProvisions.map(p => p.id);

      // ── Step 3: Delete annotations for those provisions ──
      const { error: annotErr } = await sb
        .from('annotations')
        .delete()
        .in('provision_id', provisionIds);

      if (annotErr) {
        errors.push(`Failed to delete annotations: ${annotErr.message}`);
        // Non-fatal — continue with provision deletion
      }

      await archiveProvisionRows(sb, existingProvisions, 'storeProvisions/full-replace');

      // Delete the provisions themselves
      const { error: delErr } = await sb
        .from('provisions')
        .delete()
        .eq('deal_id', dealId);

      if (delErr) {
        errors.push(`Failed to delete existing provisions: ${delErr.message}`);
      } else {
        deletedCount = existingProvisions.length;
      }
    }
  } catch (err) {
    errors.push(`Deletion error: ${err.message}`);
  }

  const transactionContext = await materializeTransactionSteps(
    dealId,
    provisions && provisions._transactionStepModel,
    sb,
  );
  await materializeConsiderationEquity(dealId, provisions || [], sb, transactionContext);

  // ── Step 4: Batch-insert all new provisions ──
  const provisionsForInsert = differentiateCategories(dedupeProvisions(provisions));
  const normalizedSource = normalizeForMatch(agreementText || '');
  const duplicateCount = provisions.length - provisionsForInsert.length;
  if (duplicateCount > 0) {
    console.log(`[store] deduped ${duplicateCount} duplicate provision(s)`);
  }

  if (provisionsForInsert.length > 0) {
    // Build core rows (no ai_metadata) and rich rows (with ai_metadata) so we
    // can degrade gracefully if the ai_metadata column doesn't exist yet.
    const buildCoreRow = (prov) => ({
      deal_id: dealId,
      type: prov.type,
      category: prov.category || 'Unclassified',
      full_text: cleanProvisionText(prov),
      ai_favorability: normFav(prov.favorability),
      ...optionalProvisionColumns(prov),
    });

    const buildRichRow = (prov) => {
      const quoteVerification = scrubProvisionFeatureQuotes(prov, agreementText || '', normalizedSource);
      // Flag malformed feature shapes at the door (see lib/schema/validation).
      const validation = validationSummary(validateFeatures(
        prov.type,
        prov.code || (prov.features && prov.features.canonicalCode) || null,
        prov.features || {},
      ));
      return {
        ...buildCoreRow(prov),
        ai_metadata: {
          features: scrubMarkerValue(prov.features || {}),
          code: prov.code || null,
          relatedDefinitions: scrubMarkerValue(prov.relatedDefinitions || []),
          isNewCode: prov.isNewCode || false,
          proposedCode: prov.proposedCode || null,
          proposedLabel: prov.proposedLabel || null,
          startChar: typeof prov.startChar === 'number' ? prov.startChar : null,
          ...(prov.regionId || prov.region_id ? { regionId: prov.regionId || prov.region_id, region_id: prov.regionId || prov.region_id } : {}),
          ...(prov.regionKey ? { regionKey: prov.regionKey } : {}),
          ...(prov.regionType ? { regionType: prov.regionType } : {}),
          ...(quoteVerification ? { quote_verification: quoteVerification } : {}),
          ...(validation ? { validation } : {}),
        },
      };
    };

    const isMissingColumnError = (msg) =>
      typeof msg === 'string' &&
      /column.*ai_metadata|ai_metadata.*does not exist|could not find.*ai_metadata|schema cache/i.test(msg);

    const insertWithFallback = async (richRows, coreRows) => {
      // Try with ai_metadata first
      const richResult = await sb.from('provisions').insert(richRows).select('id');
      if (!richResult.error) {
        return { data: richResult.data, error: null, fellBack: false };
      }
      if (isMissingColumnError(richResult.error.message) || isMissingOptionalProvisionColumnError(richResult.error.message)) {
        const missingAi = isMissingColumnError(richResult.error.message);
        if (missingAi) console.warn('[store] ai_metadata column missing — falling back to core columns. Apply supabase/ai-metadata-schema.sql to persist features.');
        const fallbackRows = isMissingOptionalProvisionColumnError(richResult.error.message)
          ? coreRows.map(stripOptionalProvisionColumns)
          : coreRows;
        const coreResult = await sb.from('provisions').insert(fallbackRows).select('id');
        return { data: coreResult.data, error: coreResult.error, fellBack: true };
      }
      return { data: null, error: richResult.error, fellBack: false };
    };

    try {
      const richRows = provisionsForInsert.map(buildRichRow);
      const coreRows = provisionsForInsert.map(buildCoreRow);

      const { data: insertData, error: insertErr, fellBack } = await insertWithFallback(richRows, coreRows);

      if (insertErr) {
        errors.push(`Batch insert failed: ${insertErr.message}`);

        // Fallback: try inserting one at a time so we don't lose everything
        console.error('[store] Batch insert failed, falling back to individual inserts:', insertErr.message);
        const useCore = fellBack || isMissingColumnError(insertErr.message) || isMissingOptionalProvisionColumnError(insertErr.message);
        for (let i = 0; i < provisionsForInsert.length; i++) {
          const row = useCore ? stripOptionalProvisionColumns(coreRows[i]) : richRows[i];
          try {
            const { error: singleErr } = await sb
              .from('provisions')
              .insert(row);

            if (singleErr) {
              if (!useCore && (isMissingColumnError(singleErr.message) || isMissingOptionalProvisionColumnError(singleErr.message))) {
                // Retry this one without ai_metadata
                const { error: retryErr } = await sb
                  .from('provisions')
                  .insert(stripOptionalProvisionColumns(coreRows[i]));
                if (retryErr) {
                  errors.push(`Insert failed for provision #${i} (${coreRows[i].type}/${provisionsForInsert[i].code || 'unclassified'}): ${retryErr.message}`);
                } else {
                  insertedCount++;
                }
              } else {
                errors.push(`Insert failed for provision #${i} (${coreRows[i].type}/${provisionsForInsert[i].code || 'unclassified'}): ${singleErr.message}`);
              }
            } else {
              insertedCount++;
            }
          } catch (singleCatchErr) {
            errors.push(`Insert error for provision #${i}: ${singleCatchErr.message}`);
          }
        }
      } else {
        insertedCount = insertData ? insertData.length : provisionsForInsert.length;
      }
    } catch (err) {
      errors.push(`Insert error: ${err.message}`);
    }
  }

  return {
    agreementSourceId,
    insertedCount,
    deletedCount,
    errors: errors.length > 0 ? errors : undefined,
  };
}

// ---------------------------------------------------------------------------
// Per-type variant — used by the split ingest pipeline (classify + per-type
// extract). Replaces ONLY the rows whose type matches the requested group;
// other provisions on the deal are untouched. The "type group" covers
// sub-types (e.g. type='IOC' → IOC, IOC-T, IOC-B).
// ---------------------------------------------------------------------------

function expandTypeGroupForStore(type) {
  if (!type) return [];
  if (type === 'IOC') return ['IOC', 'IOC-T', 'IOC-B'];
  if (type === 'TERMR') return ['TERMR', 'TERMR-M', 'TERMR-B', 'TERMR-T'];
  if (type === 'COND') return ['COND', 'COND-M', 'COND-B', 'COND-S'];
  if (type === 'NOSOL') return ['NOSOL', 'NOSOL-T', 'NOSOL-B', 'NOSOL-M'];
  if (type === 'OTHER') return ['OTHER', 'SECTION-LEFTOVER'];
  return [type];
}

/**
 * Replace all provisions on a deal whose type belongs to the requested
 * type-group with the supplied set. Safe to call multiple times — idempotent
 * replace-not-append.
 *
 * @param {string} dealId
 * @param {string} type — canonical type key (e.g. 'REP-T', 'IOC')
 * @param {Array<Object>} provisions — extracted provisions for this type
 * @param {Object} sb — Supabase client
 * @returns {{ insertedCount, deletedCount, errors }}
 */
async function storeProvisionsForType(dealId, type, provisions, sb) {
  const errors = [];
  let deletedCount = 0;
  let insertedCount = 0;

  const subTypes = expandTypeGroupForStore(type);
  if (subTypes.length === 0) {
    return { insertedCount: 0, deletedCount: 0, errors: ['No type specified'] };
  }

  // ── 1. Find existing provisions for this deal+type-group so we can delete
  // their annotations first (FK cascade unknown — be safe). ──
  try {
    const { data: existing, error: existingErr } = await sb
      .from('provisions')
      .select('*')
      .eq('deal_id', dealId)
      .in('type', subTypes);

    if (existingErr) {
      errors.push(`Failed to list existing ${type} provisions: ${existingErr.message}`);
    } else if (existing && existing.length > 0) {
      const ids = existing.map((p) => p.id);
      const { error: annotErr } = await sb
        .from('annotations')
        .delete()
        .in('provision_id', ids);
      if (annotErr) {
        errors.push(`Failed to delete annotations for ${type}: ${annotErr.message}`);
      }
      await archiveProvisionRows(sb, existing, `storeProvisionsForType/${type}`);
      const { error: delErr } = await sb
        .from('provisions')
        .delete()
        .eq('deal_id', dealId)
        .in('type', subTypes);
      if (delErr) {
        errors.push(`Failed to delete existing ${type} provisions: ${delErr.message}`);
      } else {
        deletedCount = existing.length;
      }
    }
  } catch (err) {
    errors.push(`Per-type deletion error: ${err.message}`);
  }

  const transactionContext = await fetchTransactionContext(dealId, sb);
  await materializeConsiderationEquity(dealId, provisions || [], sb, transactionContext);

  // ── 2. Insert the new provisions ──
  const provisionsForInsert = differentiateCategories(dedupeProvisions(provisions || []));
  const duplicateCount = (Array.isArray(provisions) ? provisions.length : 0) - provisionsForInsert.length;
  if (duplicateCount > 0) {
    console.log(`[store] deduped ${duplicateCount} duplicate ${type} provision(s)`);
  }

  if (provisionsForInsert.length > 0) {
    let sourceText = '';
    try {
      const { data: deal, error: dealErr } = await sb
        .from('deals')
        .select('metadata')
        .eq('id', dealId)
        .single();
      if (dealErr) {
        console.warn(`[store] quote verification source lookup failed: ${dealErr.message}`);
      } else {
        sourceText = (deal && deal.metadata && deal.metadata.full_text) || '';
      }
    } catch (err) {
      console.warn(`[store] quote verification source lookup error: ${err.message}`);
    }
    const normalizedSource = normalizeForMatch(sourceText);

    const buildCoreRow = (prov) => ({
      deal_id: dealId,
      type: prov.type,
      category: prov.category || 'Unclassified',
      full_text: cleanProvisionText(prov),
      ai_favorability: normFav(prov.favorability),
      ...optionalProvisionColumns(prov),
    });

    const buildRichRow = (prov) => {
      const quoteVerification = scrubProvisionFeatureQuotes(prov, sourceText, normalizedSource);
      // Flag malformed feature shapes at the door (see lib/schema/validation).
      const validation = validationSummary(validateFeatures(
        prov.type,
        prov.code || (prov.features && prov.features.canonicalCode) || null,
        prov.features || {},
      ));
      return {
        ...buildCoreRow(prov),
        ai_metadata: {
          features: scrubMarkerValue(prov.features || {}),
          code: prov.code || null,
          relatedDefinitions: scrubMarkerValue(prov.relatedDefinitions || []),
          isNewCode: prov.isNewCode || false,
          proposedCode: prov.proposedCode || null,
          proposedLabel: prov.proposedLabel || null,
          startChar: typeof prov.startChar === 'number' ? prov.startChar : null,
          ...(prov.regionId || prov.region_id ? { regionId: prov.regionId || prov.region_id, region_id: prov.regionId || prov.region_id } : {}),
          ...(prov.regionKey ? { regionKey: prov.regionKey } : {}),
          ...(prov.regionType ? { regionType: prov.regionType } : {}),
          ...(quoteVerification ? { quote_verification: quoteVerification } : {}),
          ...(validation ? { validation } : {}),
        },
      };
    };

    const isMissingColumnError = (msg) =>
      typeof msg === 'string' &&
      /column.*ai_metadata|ai_metadata.*does not exist|could not find.*ai_metadata|schema cache/i.test(msg);

    try {
      const richRows = provisionsForInsert.map(buildRichRow);
      const coreRows = provisionsForInsert.map(buildCoreRow);

      const richResult = await sb.from('provisions').insert(richRows).select('id');
      if (!richResult.error) {
        insertedCount = richResult.data ? richResult.data.length : provisionsForInsert.length;
      } else if (isMissingColumnError(richResult.error.message) || isMissingOptionalProvisionColumnError(richResult.error.message)) {
        if (isMissingColumnError(richResult.error.message)) {
          console.warn('[store] ai_metadata column missing — falling back to core columns.');
        }
        const fallbackRows = isMissingOptionalProvisionColumnError(richResult.error.message)
          ? coreRows.map(stripOptionalProvisionColumns)
          : coreRows;
        const coreResult = await sb.from('provisions').insert(fallbackRows).select('id');
        if (coreResult.error) {
          errors.push(`Per-type insert failed: ${coreResult.error.message}`);
        } else {
          insertedCount = coreResult.data ? coreResult.data.length : provisionsForInsert.length;
        }
      } else {
        errors.push(`Per-type insert failed: ${richResult.error.message}`);
        // Fall back to one-at-a-time to salvage what we can
        for (let i = 0; i < provisionsForInsert.length; i++) {
          try {
            const { error: singleErr } = await sb.from('provisions').insert(stripOptionalProvisionColumns(coreRows[i]));
            if (singleErr) {
              errors.push(`Insert #${i} (${coreRows[i].type}): ${singleErr.message}`);
            } else {
              insertedCount++;
            }
          } catch (single) {
            errors.push(`Insert error #${i}: ${single.message}`);
          }
        }
      }
    } catch (err) {
      errors.push(`Per-type insert error: ${err.message}`);
    }
  }

  return {
    insertedCount,
    deletedCount,
    errors: errors.length > 0 ? errors : undefined,
  };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  cleanProvisionText,
  dedupeProvisions,
  differentiateCategories,
  archiveProvisionRows,
  fetchTransactionContext,
  materializeTransactionSteps,
  storeProvisions,
  storeProvisionsForType,
  transactionStepForProvision,
  writeConsiderationEquity,
  writeElectionMechanism,
  expandTypeGroupForStore,
};
