'use strict';

const { canonicalJson, contentId } = require('./canonical-bytes');
const { filterResolvedEntriesForPublication } = require('./publication-serving-filter');
const { MAE_CARVEOUT_CODES } = require('./native-producer/anthropic-provider');

const PROJECTION_SCHEMA = 'KEY_TERMS_MAE_PRODUCT_PROJECTION/V1';
const RECORD_SCHEMA = 'KEY_TERMS_MAE_PRODUCT_RECORD/V1';
const MAE_DISPROPORTIONALITY_ROLLUP_SCHEMA = 'MAE_DISPROPORTIONALITY_PRODUCT_ROLLUP/V1';
const AUTHORITY_STATE = 'VALIDATED_NOT_SERVED';

const MAE_PRONG_LABELS = Object.freeze({
  BUSINESS_EFFECTS: 'Business effects',
  CONSUMMATION_PREVENTION: 'Consummation prevention',
});

const KEY_TERM_CLAIMS = Object.freeze({
  ACQUISITION_PROPOSAL_THRESHOLD_PERCENT: Object.freeze({ concept: 'DEF-ACQPROPOSAL', label: 'Acquisition Proposal threshold', value_kind: 'PERCENT' }),
  SUPERIOR_PROPOSAL_THRESHOLD_PERCENT: Object.freeze({ concept: 'DEF-SUPERIOR', label: 'Superior Proposal threshold', value_kind: 'PERCENT' }),
  DEFINED_TERM_THRESHOLD_SUBSTITUTION: Object.freeze({ concept: 'DEF-SUPERIOR', label: 'Threshold substitution rule', value_kind: 'SUBSTITUTION' }),
  SUPERIOR_PROPOSAL_QUALIFIER: Object.freeze({ concept: 'DEF-SUPERIOR', label: 'Superior Proposal qualifier', value_kind: 'ENUM', values: Object.freeze(['FINANCIAL_FAVORABILITY', 'CONSUMMATION_LIKELIHOOD']) }),
  INTERVENING_EVENT_DEFINITION: Object.freeze({ concept: 'DEF-INTERVENING', label: 'Intervening Event definition', value_kind: 'PRESENCE', values: Object.freeze([true]) }),
  INTERVENING_EVENT_EXCLUSION: Object.freeze({ concept: 'DEF-INTERVENING', label: 'Intervening Event exclusion', value_kind: 'ENUM', values: Object.freeze(['ACQUISITION_PROPOSAL_RECEIPT', 'STOCK_PRICE_CHANGE', 'NON_MAE_EFFECT']) }),
  KNOWLEDGE_STANDARD: Object.freeze({ concept: 'DEF-KNOWLEDGE', label: 'Knowledge standard', value_kind: 'ENUM', values: Object.freeze(['ACTUAL', 'AFTER_INQUIRY', 'CONSTRUCTIVE']) }),
  KNOWLEDGE_PERSON_SOURCE: Object.freeze({ concept: 'DEF-KNOWLEDGE', label: 'Knowledge person source', value_kind: 'ENUM', values: Object.freeze(['NAMED_INDIVIDUALS', 'SCHEDULE_REFERENCE', 'TITLE_CLASS']) }),
  WILLFUL_BREACH_DEFINITION: Object.freeze({ concept: 'DEF-WILLFUL', label: 'Willful Breach definition', value_kind: 'PRESENCE', values: Object.freeze([true]) }),
  WILLFUL_BREACH_KNOWLEDGE_STANDARD: Object.freeze({ concept: 'DEF-WILLFUL', label: 'Willful Breach knowledge standard', value_kind: 'ENUM', values: Object.freeze(['ACTUAL', 'ACTUAL_OR_CONSTRUCTIVE']) }),
  TAX_DEFINITION_RECORDED: Object.freeze({ concept: 'DEF-TAX', label: 'Tax definition', value_kind: 'RECORDED_DEFINITION' }),
  TAX_RETURN_DEFINITION_RECORDED: Object.freeze({ concept: 'DEF-TAX-RETURN', label: 'Tax Return definition', value_kind: 'RECORDED_DEFINITION' }),
  MADE_AVAILABLE_DEFINITION_RECORDED: Object.freeze({ concept: 'DEF-MADE-AVAILABLE', label: 'Made Available definition', value_kind: 'RECORDED_DEFINITION' }),
  ORDINARY_COURSE_DEFINITION_RECORDED: Object.freeze({ concept: 'DEF-ORDINARY-COURSE', label: 'Ordinary Course definition', value_kind: 'RECORDED_DEFINITION' }),
});

const MAE_CLAIMS = Object.freeze({
  MAE_CARVEOUT: Object.freeze({ concept: 'DEF-MAE', label: 'MAE carve-out', value_kind: 'ENUM', values: MAE_CARVEOUT_CODES }),
  MAE_DEFINITION_PRONG: Object.freeze({ concept: 'DEF-MAE', label: 'MAE definition prong', value_kind: 'ENUM', values: Object.freeze(['BUSINESS_EFFECTS', 'CONSUMMATION_PREVENTION']) }),
  MAE_DISPROPORTIONALITY_CARVEBACK: Object.freeze({ concept: 'DEF-MAE', label: 'Disproportionality carveback', value_kind: 'PRESENCE', values: Object.freeze([true]) }),
});

class KeyTermsMaeProductProjectionError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'KeyTermsMaeProductProjectionError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new KeyTermsMaeProductProjectionError(code, message, details);
}

function claimDefinitionKey(entry) {
  return entry?.resolved_claim_definition_key || entry?.claim?.claim_definition_key || null;
}

function validateCanonicalValue(definition, value) {
  if (definition.value_kind === 'RECORDED_DEFINITION') return value === true;
  if (definition.value_kind === 'PERCENT' || definition.value_kind === 'SUBSTITUTION') {
    return typeof value === 'string' && /^(0|[1-9]\d*)(?:\.\d+)?$/.test(value);
  }
  return definition.values.includes(value);
}

function nonEmpty(value) {
  return typeof value === 'string' && value.length > 0;
}

function validPercent(value) {
  return typeof value === 'string' && /^(0|[1-9]\d*)(?:\.\d+)?$/.test(value);
}

function validateKeyTermAttributes(key, value, attributes) {
  const thresholdBasis = ['EQUITY_SECURITIES', 'ASSETS', 'REVENUE_OR_EARNINGS'];
  const knowledgeParty = [null, 'TARGET', 'BUYER'];
  const valid = {
    ACQUISITION_PROPOSAL_THRESHOLD_PERCENT: () => nonEmpty(attributes.proposal_term_ref)
      && thresholdBasis.includes(attributes.threshold_basis),
    SUPERIOR_PROPOSAL_THRESHOLD_PERCENT: () => nonEmpty(attributes.superior_term_ref)
      && thresholdBasis.includes(attributes.threshold_basis),
    DEFINED_TERM_THRESHOLD_SUBSTITUTION: () => validPercent(attributes.substitution_from_percent)
      && nonEmpty(attributes.substituted_term_ref) && nonEmpty(attributes.host_term_ref),
    SUPERIOR_PROPOSAL_QUALIFIER: () => nonEmpty(attributes.superior_term_ref)
      && attributes.qualifier_code === value,
    INTERVENING_EVENT_DEFINITION: () => nonEmpty(attributes.event_term_ref),
    INTERVENING_EVENT_EXCLUSION: () => nonEmpty(attributes.event_term_ref)
      && attributes.exclusion_code === value,
    KNOWLEDGE_STANDARD: () => nonEmpty(attributes.knowledge_term_ref)
      && attributes.standard_code === value && knowledgeParty.includes(attributes.knowledge_party ?? null),
    KNOWLEDGE_PERSON_SOURCE: () => nonEmpty(attributes.knowledge_term_ref)
      && attributes.source_code === value && knowledgeParty.includes(attributes.knowledge_party ?? null)
      && (value !== 'NAMED_INDIVIDUALS'
        || (Array.isArray(attributes.named_persons) && attributes.named_persons.length > 0
          && attributes.named_persons.every(nonEmpty))),
    WILLFUL_BREACH_DEFINITION: () => nonEmpty(attributes.breach_term_ref),
    WILLFUL_BREACH_KNOWLEDGE_STANDARD: () => nonEmpty(attributes.breach_term_ref)
      && attributes.standard_code === value,
    TAX_DEFINITION_RECORDED: () => validRecordedDefinitionEnvelope(attributes, 'tax'),
    TAX_RETURN_DEFINITION_RECORDED: () => validRecordedDefinitionEnvelope(attributes, 'tax return'),
    MADE_AVAILABLE_DEFINITION_RECORDED: () => validRecordedDefinitionEnvelope(attributes, 'made available'),
    ORDINARY_COURSE_DEFINITION_RECORDED: () => validRecordedDefinitionEnvelope(attributes, 'ordinary course'),
  }[key];
  return valid && valid();
}

function normaliseDefinedTermIdentity(value) {
  return typeof value === 'string'
    ? value.normalize('NFKC').replace(/[“”"]/g, '').replace(/[^A-Za-z0-9]+/g, ' ').trim().toLowerCase()
    : '';
}

function validRecordedDefinitionEnvelope(attributes, expectedIdentity) {
  const envelope = attributes.definition_envelope;
  return attributes.definition_equivalence === 'NOT_ASSERTED'
    && attributes.defined_term_identity === expectedIdentity
    && envelope && typeof envelope === 'object'
    && normaliseDefinedTermIdentity(envelope.defined_term) === expectedIdentity
    && typeof envelope.definition_head_quote === 'string'
    && envelope.definition_head_quote.includes(envelope.defined_term)
    && typeof envelope.definition_body_quote === 'string'
    && envelope.definition_body_quote.length > 0
    && (envelope.cross_reference_target === null
      || (typeof envelope.cross_reference_target === 'string'
        && envelope.definition_body_quote.includes(envelope.cross_reference_target)));
}

function validateMaeAttributes(key, value, attributes) {
  if (!nonEmpty(attributes.defined_term_ref)
    || !nonEmpty(attributes.definition_subject)
    || !nonEmpty(attributes.section_reference)) return false;
  if (key === 'MAE_CARVEOUT') {
    return attributes.carveout_code === value && nonEmpty(attributes.clause_label);
  }
  if (key === 'MAE_DEFINITION_PRONG') return attributes.prong_code === value;
  const sourceForm = attributes.carveback_source_form;
  const labelsValid = Array.isArray(attributes.applies_to_clause_labels)
    && attributes.applies_to_clause_labels.length > 0
    && attributes.applies_to_clause_labels.every(nonEmpty);
  if (!labelsValid || !nonEmpty(attributes.comparison_baseline_phrase)
    || !['PER_LIMB', 'TRAILING_LIST'].includes(sourceForm)) return false;
  return sourceForm !== 'PER_LIMB'
    || (attributes.applies_to_clause_labels.length === 1
      && Array.isArray(attributes.limb_path)
      && attributes.limb_path.length > 0
      && attributes.limb_path[attributes.limb_path.length - 1] === attributes.applies_to_clause_labels[0]);
}

// Disproportionality clause-label grounding. Added 2026-08-08 (Step 2F
// BREAK 5). What this replaced, and why, because the old rule looked like
// law and was actually one drafter's habit:
//
// Until today this module required, for every carveback source form alike,
// that `claim.raw_value` CONTAIN each entry of `applies_to_clause_labels`.
// That is correct for TRAILING_LIST and wrong for PER_LIMB, and the reason
// is a drafting difference, not a defect:
//
//   - TRAILING_LIST. One trailing proviso names the clauses it reaches
//     INSIDE its own text ("... in the case of the foregoing clauses (a),
//     (b), (c) ..."). The labels are an assertion the quote itself makes,
//     and the quote is their only evidence. A label the quote does not
//     recite is invented scope. Substring-of-quote is SUBSTANCE here and is
//     kept, unchanged, below.
//   - PER_LIMB. Each lettered carve-out carries its own disproportionality
//     exception. The label is the enumeration marker PRECEDING the clause
//     body, not part of it, so a correctly extracted quote can never
//     contain its own label. Requiring it encoded Modiv's convention as a
//     universal invariant, and threw on all ten of TopBuild's carve-backs.
//
// The resolver already settled this, on 2026-08-07, and this module was
// simply never updated to match: candidate-resolution.js's
// handleMaeDisproportionalityCandidate upgraded the PER_LIMB gate to
// verifyMaeClauseLabel's three tiers (quote substring, then adjacency in
// the admitted section text, then a verified same-label sibling) and left
// TRAILING_LIST alone for exactly the reason above. See
// docs/codex-program/notes/mae-clause-label.md sections 3-4. Every PER_LIMB
// carveback that reaches this projection has therefore ALREADY had its
// label verified against the real document; entries that failed queued as
// CARVEBACK_CLAUSE_LABELS_NOT_IN_QUOTE and never resolve.
//
// So the projection does not re-run the resolver's verification -- it has
// no admitted source bytes to run it against -- but it does not drop the
// guard either. It grounds the label in the only real source text a
// resolution entry carries, `governing_context_quote`, in two tiers:
//
//   1. label appears in `claim.raw_value` -- the original check, tried
//      first, so every pre-existing fixture takes the identical path.
//   2. label appears in `governing_context_quote`, that context also
//      contains `claim.raw_value` verbatim, and the label's first
//      occurrence is at or before where the quote starts -- an enumeration
//      marker precedes its own clause body. This is the projection-layer
//      analogue of the resolver's tier 2; weaker (position, not immediate
//      adjacency) because a context quote is all this layer holds.
//
// A label grounded by neither is refused, typed, naming the claim. All
// comparisons here are between two JS strings drawn from the same JSON
// document, so `includes`/`indexOf` are consistent with each other; no byte
// offset is involved and none may be introduced.
function carvebackClauseLabelGrounded({ label, quote, governingContextQuote, sourceForm }) {
  if (typeof quote !== 'string') return false;
  if (quote.includes(label)) return true;
  if (sourceForm !== 'PER_LIMB') return false;
  if (typeof governingContextQuote !== 'string' || governingContextQuote.length === 0) return false;
  const quoteStart = governingContextQuote.indexOf(quote);
  if (quoteStart < 0) return false;
  const labelAt = governingContextQuote.indexOf(label);
  return labelAt >= 0 && labelAt <= quoteStart;
}

function normalisePartyIdentity(value) {
  return typeof value === 'string'
    ? value.normalize('NFKC').replace(/\bthe\b/gi, '').replace(/[^A-Za-z0-9]+/g, ' ').trim().toLowerCase()
    : '';
}

function maeDefinedTermCapacity(definedTermRef) {
  const hasTarget = /\b(?:Company|Target|Seller)\b/i.test(definedTermRef || '');
  const hasBuyer = /\b(?:Parent|Buyer|Acquirer)\b/i.test(definedTermRef || '');
  if (hasTarget === hasBuyer) return null;
  return hasTarget ? 'TARGET' : 'BUYER';
}

function validMaeBinding(entry, attributes) {
  const party = entry?.party;
  const provisionParty = entry?.provision_instance?.party;
  if (!party || !provisionParty || !['TARGET', 'BUYER'].includes(party.capacity)) return false;
  if (canonicalJson(party) !== canonicalJson(provisionParty)) return false;
  if (attributes.section_reference !== entry.section_reference) return false;
  if (normalisePartyIdentity(attributes.definition_subject) !== normalisePartyIdentity(party.value)) return false;
  const termCapacity = maeDefinedTermCapacity(attributes.defined_term_ref);
  return termCapacity === null || termCapacity === party.capacity;
}

function keyTermDimensions(key, attributes) {
  const dimensions = { claim_definition_key: key };
  if (KEY_TERM_CLAIMS[key]?.value_kind === 'RECORDED_DEFINITION') {
    return {
      ...dimensions,
      defined_term_identity: attributes.defined_term_identity,
      definition_kind: attributes.definition_envelope.definition_kind,
      comparison_basis: 'SAME_NORMALIZED_DEFINED_TERM_IDENTITY_ONLY',
      definition_equivalence: 'NOT_ASSERTED',
    };
  }
  if (['ACQUISITION_PROPOSAL_THRESHOLD_PERCENT', 'SUPERIOR_PROPOSAL_THRESHOLD_PERCENT'].includes(key)) {
    dimensions.threshold_basis = attributes.threshold_basis ?? null;
  }
  if (key === 'DEFINED_TERM_THRESHOLD_SUBSTITUTION') {
    dimensions.substitution_from_percent = attributes.substitution_from_percent ?? null;
    dimensions.substituted_term_ref = attributes.substituted_term_ref ?? null;
    dimensions.host_term_ref = attributes.host_term_ref ?? null;
    dimensions.relationship_state = 'OPEN_WORLD_UNADJUDICATED';
  }
  if (['KNOWLEDGE_STANDARD', 'KNOWLEDGE_PERSON_SOURCE'].includes(key)) {
    dimensions.knowledge_party = attributes.knowledge_party ?? null;
  }
  return dimensions;
}

function maeDimensions(key, attributes) {
  if (key === 'MAE_CARVEOUT') return { carveout_code: attributes.carveout_code ?? null };
  if (key === 'MAE_DEFINITION_PRONG') return { prong_code: attributes.prong_code ?? null };
  return {
    relationship_state: 'GOVERNED_CLAUSE_LABEL_RELATIONSHIP',
    carveback_source_form: attributes.carveback_source_form,
    covered_limb_labels: [...attributes.applies_to_clause_labels],
    comparison_baseline_phrase: attributes.comparison_baseline_phrase,
    incremental_impact_phrase: attributes.incremental_impact_phrase ?? null,
    limb_path: Array.isArray(attributes.limb_path) ? [...attributes.limb_path] : [],
  };
}

function marketValue(family, key, definition, canonicalValue, dimensions) {
  if (family === 'KEY_DEFINED_TERMS' && definition.value_kind === 'RECORDED_DEFINITION') {
    return Object.freeze({ market_statistics: 'NOT_CALCULATED' });
  }
  if (family === 'KEY_DEFINED_TERMS' && definition.value_kind === 'PERCENT') {
    return {
      metric_key: 'KEY_DEFINED_TERM_PERCENT_BY_CLAIM_AND_BASIS',
      value_dimension: 'PERCENT', canonical_unit: 'PERCENT', canonical_value: canonicalValue,
      breakdown: dimensions, per_deal_rollup: 'DISTINCT_VALUES', weighting: 'DEAL',
    };
  }
  if (family === 'KEY_DEFINED_TERMS' && definition.value_kind === 'SUBSTITUTION') {
    return {
      metric_key: 'KEY_DEFINED_TERM_SUBSTITUTION_RULE_PRESENCE',
      value_dimension: 'BOOLEAN_PRESENCE', canonical_unit: 'PRESENT_TRUE', canonical_value: true,
      breakdown: dimensions, per_deal_rollup: 'ANY_TRUE', weighting: 'DEAL',
    };
  }
  if (family === 'MAE_DEFINITION') {
    return {
      metric_key: key === 'MAE_DISPROPORTIONALITY_CARVEBACK'
        ? 'MAE_DISPROPORTIONALITY_CARVEBACK_PRESENCE'
        : 'MAE_GOVERNED_VALUE_BY_CLAIM',
      value_dimension: definition.value_kind === 'PRESENCE' ? 'BOOLEAN_PRESENCE' : 'ENUM',
      canonical_unit: definition.value_kind === 'PRESENCE' ? 'PRESENT_TRUE' : 'CODE',
      canonical_value: canonicalValue, breakdown: dimensions,
      per_deal_rollup: definition.value_kind === 'PRESENCE' ? 'ANY_TRUE' : 'DISTINCT_VALUES', weighting: 'DEAL',
    };
  }
  return {
    metric_key: 'KEY_DEFINED_TERM_GOVERNED_VALUE_BY_CLAIM',
    value_dimension: definition.value_kind === 'PRESENCE' ? 'BOOLEAN_PRESENCE' : 'ENUM',
    canonical_unit: definition.value_kind === 'PRESENCE' ? 'PRESENT_TRUE' : 'CODE',
    canonical_value: canonicalValue, breakdown: dimensions,
    per_deal_rollup: definition.value_kind === 'PRESENCE' ? 'ANY_TRUE' : 'DISTINCT_VALUES', weighting: 'DEAL',
  };
}

function projectEntry(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    fail('INVALID_RESOLVED_ENTRY', 'Each resolved entry must be an object.');
  }
  const key = claimDefinitionKey(entry);
  const definition = KEY_TERM_CLAIMS[key] || MAE_CLAIMS[key];
  if (!definition) {
    fail('UNGOVERNED_CLAIM', 'Only governed Key Defined Terms and MAE claims can be projected.', { claim_definition_key: key });
  }
  const family = KEY_TERM_CLAIMS[key] ? 'KEY_DEFINED_TERMS' : 'MAE_DEFINITION';
  if (entry.concept_key !== definition.concept) {
    fail('CONCEPT_OWNERSHIP_MISMATCH', 'The claim does not belong to its governed family concept.');
  }
  const claim = entry.claim;
  if (!claim || claim.state !== 'PRESENT' || claim.claim_definition_key !== key
    || !validateCanonicalValue(definition, claim.canonical_value)) {
    fail('INVALID_GOVERNED_CLAIM', 'The claim value does not match its governed definition.');
  }
  const provision = entry.provision_instance;
  const expectedProvisionSchema = family === 'KEY_DEFINED_TERMS'
    ? 'STRUCTURAL_PROVISION_INSTANCE/V1'
    : 'PROVISION_INSTANCE/V1';
  if (!provision || provision.schema_version !== expectedProvisionSchema
    || claim.subject_occurrence_id !== provision.provision_instance_id) {
    fail('INVALID_PROVISION_BINDING', 'The claim must bind to its governed provision instance.');
  }
  const attributes = claim.attributes || {};
  const attributesValid = family === 'KEY_DEFINED_TERMS'
    ? validateKeyTermAttributes(key, claim.canonical_value, attributes)
    : validateMaeAttributes(key, claim.canonical_value, attributes);
  if (!attributesValid) {
    fail('INVALID_GOVERNED_ATTRIBUTES', 'The claim attributes do not match its governed definition.');
  }
  if (family === 'MAE_DEFINITION' && !validMaeBinding(entry, attributes)) {
    fail('INVALID_MAE_DEFINITION_BINDING', 'The MAE claim must bind to the same section, defined-term party and provision party.');
  }
  if (key === 'MAE_DISPROPORTIONALITY_CARVEBACK') {
    // Substance, unchanged: the comparison baseline is the whole legal
    // content of a disproportionality carveback ("relative to whom"), and
    // it is asserted to be verbatim from the quote shown beside it.
    if (typeof claim.raw_value !== 'string'
      || !claim.raw_value.includes(attributes.comparison_baseline_phrase)) {
      fail(
        'INVALID_GOVERNED_ATTRIBUTES',
        'Disproportionality relationships must retain their exact comparison baseline in the claim quote.',
        {
          claim_definition_key: key,
          claim_revision_id: claim.claim_revision_id ?? null,
          section_reference: entry.section_reference ?? null,
          comparison_baseline_phrase: attributes.comparison_baseline_phrase,
        },
      );
    }
    const ungroundedLabel = attributes.applies_to_clause_labels.find((label) => !carvebackClauseLabelGrounded({
      label,
      quote: claim.raw_value,
      governingContextQuote: entry.governing_context_quote,
      sourceForm: attributes.carveback_source_form,
    }));
    if (ungroundedLabel !== undefined) {
      fail(
        'CARVEBACK_CLAUSE_LABEL_UNGROUNDED',
        `MAE_DISPROPORTIONALITY_CARVEBACK asserts clause label ${ungroundedLabel} `
        + `(${attributes.carveback_source_form}) in section ${entry.section_reference}, and that label is grounded `
        + 'neither in the claim quote nor in the entry\'s governing_context_quote ahead of the quote. '
        + 'See carvebackClauseLabelGrounded in lib/canonical-v2/key-terms-mae-product-projection.js.',
        {
          claim_definition_key: key,
          claim_revision_id: claim.claim_revision_id ?? null,
          section_reference: entry.section_reference ?? null,
          carveback_source_form: attributes.carveback_source_form,
          clause_label: ungroundedLabel,
        },
      );
    }
  }
  const dimensions = family === 'KEY_DEFINED_TERMS'
    ? keyTermDimensions(key, attributes)
    : maeDimensions(key, attributes);
  if (Object.hasOwn(attributes, 'effective_threshold_percent')
    || Object.hasOwn(attributes, 'applies_to_carveout_claim_ids')) {
    fail('UNADJUDICATED_RELATIONSHIP', 'Producer-supplied claim-id links and effective thresholds are not governed inputs.');
  }
  const fieldKey = family === 'KEY_DEFINED_TERMS' ? 'definedTermFact' : 'maeDefinitionFact';
  const productValue = {
    concept_key: definition.concept,
    claim_definition_key: key,
    canonical_value: claim.canonical_value,
    dimensions,
    ...(definition.value_kind === 'RECORDED_DEFINITION'
      ? {
        definition_envelope: attributes.definition_envelope,
        definition_equivalence: 'NOT_ASSERTED',
      }
      : {}),
  };
  const body = {
    schema_version: RECORD_SCHEMA,
    authority_state: AUTHORITY_STATE,
    owner_family: family,
    claim_revision_id: claim.claim_revision_id,
    provision_instance_id: provision.provision_instance_id,
    review: {
      row_key: key,
      label: definition.label,
      value: claim.canonical_value,
      dimensions,
      ...(definition.value_kind === 'RECORDED_DEFINITION'
        ? {
          exact_definition: attributes.definition_envelope,
          definition_equivalence: 'NOT_ASSERTED',
        }
        : {}),
      ...(key === 'MAE_DISPROPORTIONALITY_CARVEBACK'
        ? {
          source_form: dimensions.carveback_source_form,
          evidence: {
            claim_revision_id: claim.claim_revision_id,
            exact_quote: claim.raw_value,
            source_section_reference: entry.section_reference,
          },
        }
        : {}),
      source_section_reference: entry.section_reference,
    },
    query: { field_key: fieldKey, value: productValue },
    compare: { field_key: fieldKey, value: productValue },
    market: { metric_version: 1, ...marketValue(family, key, definition, claim.canonical_value, dimensions) },
  };
  return Object.freeze({ ...body, projection_record_id: contentId(RECORD_SCHEMA, body) });
}

function maeEntryGroupKey(entry) {
  const attributes = entry?.claim?.attributes || {};
  return canonicalJson([
    entry?.provision_instance?.provision_instance_id || null,
    attributes.defined_term_ref || null,
  ]);
}

function limbIdentity(provisionInstanceId, definedTermRef, limbPath) {
  return contentId('MAE_CARVEOUT_LIMB_IDENTITY/V1', {
    provision_instance_id: provisionInstanceId,
    defined_term_ref: definedTermRef,
    limb_path: limbPath,
  });
}

function buildMaeDisproportionalityRollups(resolvedEntries, openWorldEntries = []) {
  const maeEntries = resolvedEntries.filter((entry) => entry?.concept_key === 'DEF-MAE');
  const groups = new Map();
  const groupFor = (entry) => {
    const attributes = entry.claim?.attributes || {};
    const groupKey = maeEntryGroupKey(entry);
    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        provision_instance_id: entry.provision_instance.provision_instance_id,
        defined_term_ref: attributes.defined_term_ref,
        section_reference: entry.section_reference,
        party: entry.party,
        limbs: new Map(),
        limb_paths_by_label: new Map(),
        ambiguous_relationships: [],
      });
    }
    return groups.get(groupKey);
  };

  for (const entry of maeEntries.filter((candidate) => claimDefinitionKey(candidate) === 'MAE_CARVEOUT')) {
    const attributes = entry.claim?.attributes || {};
    if (!nonEmpty(attributes.clause_label) || !nonEmpty(attributes.carveout_code)) continue;
    const group = groupFor(entry);
    const limbPath = Array.isArray(attributes.limb_path) && attributes.limb_path.length
      ? [...attributes.limb_path]
      : [attributes.clause_label];
    const pathKey = canonicalJson(limbPath);
    if (!group.limbs.has(pathKey)) {
      group.limbs.set(pathKey, {
        clause_label: attributes.clause_label,
        limb_path: limbPath,
        carveout_claims: new Map(),
        open_world_evidence: new Map(),
        sources: new Map(),
      });
    }
    group.limbs.get(pathKey).carveout_claims.set(entry.claim.claim_revision_id, {
      carveout_code: attributes.carveout_code,
      claim_revision_id: entry.claim.claim_revision_id,
      exact_carveout_quote: entry.claim.raw_value,
      source_section_reference: entry.section_reference,
    });
    if (!group.limb_paths_by_label.has(attributes.clause_label)) {
      group.limb_paths_by_label.set(attributes.clause_label, new Set());
    }
    group.limb_paths_by_label.get(attributes.clause_label).add(pathKey);
  }

  for (const entry of maeEntries.filter((candidate) => claimDefinitionKey(candidate) === 'MAE_DISPROPORTIONALITY_CARVEBACK')) {
    const claim = entry.claim;
    const attributes = claim?.attributes || {};
    if (!validateMaeAttributes('MAE_DISPROPORTIONALITY_CARVEBACK', true, attributes)) continue;
    const group = groupFor(entry);
    const sourceForm = attributes.carveback_source_form;
    const source = {
      disproportionality_claim_revision_id: claim.claim_revision_id,
      source_form: sourceForm,
      exact_disproportionality_quote: claim.raw_value,
      source_section_reference: entry.section_reference,
      comparison_baseline_phrase: attributes.comparison_baseline_phrase,
      incremental_impact_phrase: attributes.incremental_impact_phrase ?? null,
      limb_path: Array.isArray(attributes.limb_path) ? [...attributes.limb_path] : [],
    };
    const ambiguousLabels = sourceForm === 'TRAILING_LIST'
      ? attributes.applies_to_clause_labels.filter((clauseLabel) => (
        (group.limb_paths_by_label.get(clauseLabel) || new Set()).size > 1
      ))
      : [];
    if (ambiguousLabels.length > 0) {
      for (const clauseLabel of ambiguousLabels) {
        const targetPathKeys = [...group.limb_paths_by_label.get(clauseLabel)];
        group.ambiguous_relationships.push({
          reason: 'AMBIGUOUS_DUPLICATE_CLAUSE_LABEL',
          clause_label: clauseLabel,
          candidate_limb_paths: targetPathKeys.map((pathKey) => JSON.parse(pathKey)),
          source,
        });
      }
      continue;
    }
    for (const clauseLabel of attributes.applies_to_clause_labels) {
      let targetPathKeys;
      if (sourceForm === 'PER_LIMB') {
        targetPathKeys = [canonicalJson(attributes.limb_path)];
      } else {
        targetPathKeys = [...(group.limb_paths_by_label.get(clauseLabel) || [])];
      }
      if (sourceForm === 'PER_LIMB' && !group.limbs.has(targetPathKeys[0])) {
        group.ambiguous_relationships.push({
          reason: 'PER_LIMB_TARGET_LIMB_NOT_FOUND',
          clause_label: clauseLabel,
          candidate_limb_paths: [],
          source,
        });
        continue;
      }
      let targetPathKey = targetPathKeys[0] || null;
      if (!targetPathKey) {
        const openWorldMatches = openWorldEntries.filter((candidate) => (
          candidate?.section_reference === group.section_reference
          && typeof candidate.raw_value === 'string'
          && candidate.raw_value.includes(clauseLabel)
          && (!candidate.attributes?.defined_term_ref
            || candidate.attributes.defined_term_ref === group.defined_term_ref)
        ));
        if (openWorldMatches.length !== 1) {
          group.ambiguous_relationships.push({
            reason: openWorldMatches.length > 1
              ? 'AMBIGUOUS_OPEN_WORLD_CARVEOUT_LIMB'
              : 'UNRESOLVED_CARVEOUT_LIMB_NO_OPEN_WORLD_EVIDENCE',
            clause_label: clauseLabel,
            candidate_limb_paths: [],
            source,
          });
          continue;
        }
        targetPathKey = canonicalJson(['OPEN_WORLD_LABEL', clauseLabel]);
        if (!group.limbs.has(targetPathKey)) {
          group.limbs.set(targetPathKey, {
            clause_label: clauseLabel,
            limb_path: [],
            carveout_claims: new Map(),
            open_world_evidence: new Map(),
            sources: new Map(),
          });
        }
        const openWorld = openWorldMatches[0];
        group.limbs.get(targetPathKey).open_world_evidence.set(openWorld.closure_id, {
          closure_id: openWorld.closure_id,
          exact_open_world_quote: openWorld.raw_value,
          reason: openWorld.reason,
          source_section_reference: openWorld.section_reference,
        });
      }
      if (!group.limbs.has(targetPathKey)) {
        group.limbs.set(targetPathKey, {
          clause_label: clauseLabel,
          limb_path: JSON.parse(targetPathKey),
          carveout_claims: new Map(),
          open_world_evidence: new Map(),
          sources: new Map(),
        });
      }
      group.limbs.get(targetPathKey).sources.set(claim.claim_revision_id, source);
    }
  }

  return [...groups.values()].map((group) => {
    const limbs = [...group.limbs.values()].map((limb) => {
      const carveoutClaims = [...limb.carveout_claims.values()]
        .sort((left, right) => left.claim_revision_id.localeCompare(right.claim_revision_id));
      const openWorldEvidence = [...limb.open_world_evidence.values()]
        .sort((left, right) => canonicalJson(left).localeCompare(canonicalJson(right)));
      const sources = [...limb.sources.values()]
        .sort((left, right) => canonicalJson(left).localeCompare(canonicalJson(right)));
      const claimRevisionIds = carveoutClaims.map(({ claim_revision_id: claimRevisionId }) => claimRevisionId);
      const stableLimbIdentity = limbIdentity(
        group.provision_instance_id,
        group.defined_term_ref,
        limb.limb_path.length ? limb.limb_path : ['UNRESOLVED_LABEL', limb.clause_label],
      );
      const relationshipState = sources.length
        ? (claimRevisionIds.length
          ? 'ESTABLISHED'
          : (openWorldEvidence.length ? 'OPEN_WORLD_LIMB_RELATIONSHIP' : 'NOT_ESTABLISHED'))
        : 'NOT_ESTABLISHED';
      const edges = sources.flatMap((source) => claimRevisionIds.map((targetClaimRevisionId) => ({
        relationship_type: 'DISPROPORTIONALITY_CARVEBACK_APPLIES_TO_MAE_LIMB',
        limb_identity: stableLimbIdentity,
        source_disproportionality_claim_revision_id: source.disproportionality_claim_revision_id,
        target_carveout_claim_revision_id: targetClaimRevisionId,
        source_form: source.source_form,
        exact_disproportionality_quote: source.exact_disproportionality_quote,
        comparison_baseline_phrase: source.comparison_baseline_phrase,
      })));
      return {
        clause_label: limb.clause_label,
        limb_path: [...limb.limb_path],
        limb_identity: stableLimbIdentity,
        carveout_codes: [...new Set(carveoutClaims.map(({ carveout_code: code }) => code))].sort(),
        carveout_claims: carveoutClaims,
        carveout_claim_revision_ids: claimRevisionIds,
        open_world_evidence: openWorldEvidence,
        hasDisproportionateImpactCarveback: relationshipState === 'ESTABLISHED'
          || relationshipState === 'OPEN_WORLD_LIMB_RELATIONSHIP'
          ? true
          : 'NOT_ESTABLISHED',
        relationship_state: relationshipState,
        source_forms: [...new Set(sources.map(({ source_form: sourceForm }) => sourceForm))].sort(),
        sources,
        relationship_edges: edges,
      };
    }).sort((left, right) => canonicalJson(left.limb_path).localeCompare(canonicalJson(right.limb_path), undefined, { numeric: true }));
    const coveredLimbs = limbs.filter(({ hasDisproportionateImpactCarveback: value }) => value === true);
    const relationshipReviewItems = [...group.ambiguous_relationships]
      .sort((left, right) => canonicalJson(left).localeCompare(canonicalJson(right)));
    const productValue = {
      concept_key: 'DEF-MAE',
      claim_definition_key: 'MAE_DISPROPORTIONALITY_CARVEBACK',
      canonical_value: coveredLimbs.length > 0,
      dimensions: {
        relationship_state: relationshipReviewItems.length
          ? 'REVIEW_REQUIRED'
          : 'GOVERNED_FULL_LIMB_IDENTITY_RELATIONSHIP',
        defined_term_ref: group.defined_term_ref,
        limbs,
        relationship_review_items: relationshipReviewItems,
      },
    };
    const body = {
      schema_version: MAE_DISPROPORTIONALITY_ROLLUP_SCHEMA,
      authority_state: AUTHORITY_STATE,
      provision_instance_id: group.provision_instance_id,
      defined_term_ref: group.defined_term_ref,
      section_reference: group.section_reference,
      party: group.party,
      limbs,
      covered_limbs: coveredLimbs,
      relationship_review_items: relationshipReviewItems,
      review: {
        row_key: 'MAE_DISPROPORTIONALITY_COVERED_LIMBS',
        label: 'Disproportionality carveback by MAE limb',
        value: limbs,
        relationship_review_items: relationshipReviewItems,
      },
      query: { field_key: 'maeDefinitionFact', value: productValue },
      compare: { field_key: 'maeDefinitionFact', value: productValue },
    };
    return Object.freeze({
      ...body,
      mae_disproportionality_rollup_id: contentId(MAE_DISPROPORTIONALITY_ROLLUP_SCHEMA, body),
    });
  }).sort((left, right) => (
    left.mae_disproportionality_rollup_id.localeCompare(right.mae_disproportionality_rollup_id)
  ));
}

function stableResolvedAssertionIdentity(entry) {
  const claim = entry?.claim || {};
  const optionalIdentity = {
    concept_key: entry?.concept_key,
    claim_definition_key: claimDefinitionKey(entry),
    provision_instance_id: entry?.provision_instance?.provision_instance_id,
    section_reference: entry?.section_reference,
    party: entry?.party,
    canonical_value: claim.canonical_value,
    raw_value: claim.raw_value,
    attributes: claim.attributes,
    evidence: claim.evidence,
    source_citation: entry?.source_citation,
  };
  return canonicalJson(Object.fromEntries(
    Object.entries(optionalIdentity).filter(([, value]) => value !== undefined),
  ));
}

function dedupeResolvedAssertions(resolvedEntries) {
  const seen = new Set();
  return resolvedEntries.filter((entry) => {
    const identity = stableResolvedAssertionIdentity(entry);
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}

function maeFeatureEntriesByGroup(resolvedEntries) {
  const groups = new Map();
  for (const entry of resolvedEntries.filter((candidate) => candidate?.concept_key === 'DEF-MAE')) {
    const key = maeEntryGroupKey(entry);
    if (!groups.has(key)) groups.set(key, {
      provision_instance_id: entry.provision_instance.provision_instance_id,
      defined_term_ref: entry.claim.attributes.defined_term_ref,
      section_reference: entry.section_reference,
      party: entry.party,
      prongs: [],
      disproportionality_relationships: [],
    });
    const group = groups.get(key);
    const claim = entry.claim;
    const claimKey = claimDefinitionKey(entry);
    if (claimKey === 'MAE_DEFINITION_PRONG') {
      group.prongs.push({
        code: claim.canonical_value,
        label: MAE_PRONG_LABELS[claim.canonical_value],
        text: claim.raw_value,
        quotes: [claim.raw_value],
        claim_revision_id: claim.claim_revision_id,
        source_claim_revision_ids: [claim.claim_revision_id],
        source_section_reference: entry.section_reference,
      });
    }
    if (claimKey === 'MAE_DISPROPORTIONALITY_CARVEBACK') {
      const attributes = claim.attributes;
      group.disproportionality_relationships.push({
        code: 'MAE_DISPROPORTIONALITY_CARVEBACK',
        label: 'Disproportionality carveback',
        text: claim.raw_value,
        quotes: [claim.raw_value],
        claim_revision_id: claim.claim_revision_id,
        source_claim_revision_ids: [claim.claim_revision_id],
        source_section_reference: entry.section_reference,
        source_form: attributes.carveback_source_form,
        covered_limb_labels: [...attributes.applies_to_clause_labels],
        comparison_baseline_phrase: attributes.comparison_baseline_phrase,
        incremental_impact_phrase: attributes.incremental_impact_phrase ?? null,
        limb_path: Array.isArray(attributes.limb_path) ? [...attributes.limb_path] : [],
        relationship_type: 'DISPROPORTIONALITY_CARVEBACK_APPLIES_TO_MAE_LIMB',
        relationship_state: 'GOVERNED_CLAUSE_LABEL_RELATIONSHIP',
      });
    }
  }
  for (const group of groups.values()) {
    group.prongs.sort((left, right) => left.claim_revision_id.localeCompare(right.claim_revision_id));
    group.disproportionality_relationships.sort(
      (left, right) => left.claim_revision_id.localeCompare(right.claim_revision_id),
    );
  }
  return groups;
}

function buildMaeDisproportionalityReviewCards(rollups, resolvedEntries = []) {
  const quarantinedClaimRevisionIds = new Set(rollups.flatMap((rollup) => (
    rollup.relationship_review_items.map(
      (item) => item.source.disproportionality_claim_revision_id,
    )
  )));
  const featureGroups = maeFeatureEntriesByGroup(resolvedEntries.filter(
    (entry) => !quarantinedClaimRevisionIds.has(entry?.claim?.claim_revision_id),
  ));
  const cards = rollups.map((rollup) => {
    const groupKey = canonicalJson([rollup.provision_instance_id, rollup.defined_term_ref]);
    const featureGroup = featureGroups.get(groupKey) || { prongs: [], disproportionality_relationships: [] };
    const carveouts = rollup.limbs.flatMap((limb) => {
      const shared = {
        clause_label: limb.clause_label,
        limb_path: limb.limb_path,
        limb_identity: limb.limb_identity,
        relationship_state: limb.relationship_state,
        hasDisproportionateImpactCarveback: limb.hasDisproportionateImpactCarveback,
        disproportionality_quotes: limb.sources.map(({ exact_disproportionality_quote: quote }) => quote),
        relationship_edges: limb.relationship_edges,
      };
      const governed = limb.carveout_claims.map((claim) => ({
        ...shared,
        code: claim.carveout_code,
        claim_revision_id: claim.claim_revision_id,
        text: claim.exact_carveout_quote,
        quotes: [claim.exact_carveout_quote],
      }));
      const openWorld = limb.open_world_evidence.map((evidence) => ({
        ...shared,
        code: null,
        label: `Open-world carve-out ${limb.clause_label}`,
        closure_id: evidence.closure_id,
        text: evidence.exact_open_world_quote,
        quotes: [evidence.exact_open_world_quote],
      }));
      return [...governed, ...openWorld];
    });
    const exactText = carveouts.map(({ text }) => text).filter(nonEmpty).join('\n');
    const featureClaimRevisionIds = {
      carveouts: [...new Set(carveouts.map((item) => item.claim_revision_id).filter(nonEmpty))].sort(),
      maeCarveouts: [...new Set(carveouts.map((item) => item.claim_revision_id).filter(nonEmpty))].sort(),
      maeDisproportionalityRollup: [...new Set(rollup.limbs.flatMap((limb) => [
        ...limb.carveout_claim_revision_ids,
        ...limb.sources.map((source) => source.disproportionality_claim_revision_id),
      ]))].sort(),
      maeDefinitionProngs: featureGroup.prongs.map((item) => item.claim_revision_id),
      maeDisproportionalityRelationships: featureGroup.disproportionality_relationships
        .map((item) => item.claim_revision_id),
    };
    const claimRevisionIds = [...new Set(Object.values(featureClaimRevisionIds).flat())].sort();
    const features = {
      carveouts,
      maeCarveouts: carveouts,
      maeDisproportionalityRollup: {
        ...rollup.review,
        relationship_review_items: [],
      },
      ...(featureGroup.prongs.length ? { maeDefinitionProngs: featureGroup.prongs } : {}),
      ...(featureGroup.disproportionality_relationships.length
        ? { maeDisproportionalityRelationships: featureGroup.disproportionality_relationships }
        : {}),
    };
    featureGroups.delete(groupKey);
    return Object.freeze({
      id: rollup.provision_instance_id,
      provision_instance_id: rollup.provision_instance_id,
      type: 'MAE',
      provision_type: 'MAE_DEFINITION',
      provision_subtype: 'DEF-MAE',
      code: 'DEF-MAE',
      defined_term: rollup.defined_term_ref,
      short_title: rollup.defined_term_ref,
      section_ref: rollup.section_reference,
      primary_quote: exactText,
      full_text: exactText,
      region_full_text: exactText,
      party: rollup.party,
      features,
      ai_metadata: { features },
      canonical_v2_lineage: {
        source: 'KEY_TERMS_MAE_PRODUCT_PROJECTION',
        authority_state: AUTHORITY_STATE,
        mae_disproportionality_rollup_id: rollup.mae_disproportionality_rollup_id,
        claim_revision_ids: claimRevisionIds,
        feature_claim_revision_ids: featureClaimRevisionIds,
      },
    });
  });

  const additionalCards = [];
  for (const featureGroup of featureGroups.values()) {
    if (!featureGroup.prongs.length && !featureGroup.disproportionality_relationships.length) continue;
    const features = {
      ...(featureGroup.prongs.length ? { maeDefinitionProngs: featureGroup.prongs } : {}),
      ...(featureGroup.disproportionality_relationships.length
        ? { maeDisproportionalityRelationships: featureGroup.disproportionality_relationships }
        : {}),
    };
    const featureClaimRevisionIds = {
      ...(featureGroup.prongs.length
        ? { maeDefinitionProngs: featureGroup.prongs.map((item) => item.claim_revision_id) }
        : {}),
      ...(featureGroup.disproportionality_relationships.length
        ? {
          maeDisproportionalityRelationships: featureGroup.disproportionality_relationships
            .map((item) => item.claim_revision_id),
        }
        : {}),
    };
    const claimRevisionIds = [...new Set(Object.values(featureClaimRevisionIds).flat())].sort();
    const exactText = [
      ...featureGroup.prongs.map((item) => item.text),
      ...featureGroup.disproportionality_relationships.map((item) => item.text),
    ].filter(nonEmpty).join('\n');
    additionalCards.push(Object.freeze({
      id: featureGroup.provision_instance_id,
      provision_instance_id: featureGroup.provision_instance_id,
      type: 'MAE',
      provision_type: 'MAE_DEFINITION',
      provision_subtype: 'DEF-MAE',
      code: 'DEF-MAE',
      defined_term: featureGroup.defined_term_ref,
      short_title: featureGroup.defined_term_ref,
      section_ref: featureGroup.section_reference,
      primary_quote: exactText,
      full_text: exactText,
      region_full_text: exactText,
      party: featureGroup.party,
      features,
      ai_metadata: { features },
      canonical_v2_lineage: {
        source: 'KEY_TERMS_MAE_PRODUCT_PROJECTION',
        authority_state: AUTHORITY_STATE,
        claim_revision_ids: claimRevisionIds,
        feature_claim_revision_ids: featureClaimRevisionIds,
      },
    }));
  }
  additionalCards.sort((left, right) => (
    left.provision_instance_id.localeCompare(right.provision_instance_id)
      || left.defined_term.localeCompare(right.defined_term)
  ));
  return [...cards, ...additionalCards];
}

function projectKeyTermsMaeClaims({ resolved_entries: resolvedEntries, open_world_entries: openWorldEntries = [], publication_filter: publicationFilter, release_receipt_id: releaseReceiptId, publication_evaluation_time: publicationEvaluationTime } = {}) {
  const permittedEntries = filterResolvedEntriesForPublication(resolvedEntries, publicationFilter, releaseReceiptId, publicationEvaluationTime);
  if (permittedEntries.length === 0) {
    fail('INVALID_INPUT', 'At least one resolved claim is required.');
  }
  if (!Array.isArray(openWorldEntries)) fail('INVALID_INPUT', 'open_world_entries must be an array.');
  const uniqueResolvedEntries = dedupeResolvedAssertions(permittedEntries);
  const maeDisproportionalityRollups = buildMaeDisproportionalityRollups(uniqueResolvedEntries, openWorldEntries);
  const quarantinedClaimRevisionIds = new Set(maeDisproportionalityRollups.flatMap((rollup) => (
    rollup.relationship_review_items.map((item) => item.source.disproportionality_claim_revision_id)
  )));
  const nonQuarantinedEntries = uniqueResolvedEntries.filter(
    (entry) => !quarantinedClaimRevisionIds.has(entry?.claim?.claim_revision_id),
  );
  const records = nonQuarantinedEntries
    .map(projectEntry)
    .sort((left, right) => left.projection_record_id.localeCompare(right.projection_record_id));
  const ids = records.map((record) => canonicalJson([
    record.claim_revision_id,
    record.owner_family,
  ]));
  if (new Set(ids).size !== ids.length) fail('DUPLICATE_PRODUCT_CLAIM', 'Distinct governed assertions produced duplicate product records.');
  const maeReviewCards = buildMaeDisproportionalityReviewCards(
    maeDisproportionalityRollups,
    nonQuarantinedEntries,
  );
  const body = {
    schema_version: PROJECTION_SCHEMA,
    authority_state: AUTHORITY_STATE,
    records,
    mae_disproportionality_rollups: maeDisproportionalityRollups,
    mae_review_cards: maeReviewCards,
  };
  return Object.freeze({ ...body, projection_id: contentId(PROJECTION_SCHEMA, body) });
}

module.exports = {
  AUTHORITY_STATE,
  KEY_TERM_CLAIMS,
  MAE_DISPROPORTIONALITY_ROLLUP_SCHEMA,
  MAE_CLAIMS,
  PROJECTION_SCHEMA,
  RECORD_SCHEMA,
  KeyTermsMaeProductProjectionError,
  buildMaeDisproportionalityRollups,
  buildMaeDisproportionalityReviewCards,
  projectKeyTermsMaeClaims,
};
