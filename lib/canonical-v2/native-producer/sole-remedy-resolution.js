'use strict';

const { contentId, utf8Slice } = require('../canonical-bytes');
const { buildClaimRevision } = require('../claims-relationships');
const { buildSemanticSpan, buildStructuralProvisionInstance } = require('../source-structure');

const RESOLUTION_SCHEMA = 'NATIVE_SOLE_REMEDY_RESOLUTION/V1';
const CONCEPT_KEY = 'REM-SOLE';
const LEGAL_EFFECT_DEFINITION = 'SOLE_REMEDY_LEGAL_EFFECT_PRESENT';
const CARVEOUT_DEFINITION = 'SOLE_REMEDY_CARVEOUT_KIND';
const CARVEOUT_KINDS = Object.freeze(['FRAUD', 'WILLFUL_BREACH']);

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}

function vocabularySupportsSoleRemedy(contractVocabulary) {
  const concepts = new Set((contractVocabulary?.concepts || []).map((entry) => entry.concept_key));
  const definitions = new Set((contractVocabulary?.claim_definitions || []).map((entry) => entry.claim_definition_key));
  return concepts.has(CONCEPT_KEY)
    && definitions.has(LEGAL_EFFECT_DEFINITION)
    && definitions.has(CARVEOUT_DEFINITION);
}

function isSoleRemedyItem(item) {
  return item?.claim_definition_key === 'OPEN_WORLD_PROPOSITION'
    && item?.attributes?.structured_mechanic?.surface === 'SOLE_REMEDY_EVIDENCE';
}

function oneOccurrence(haystack, needle) {
  if (typeof needle !== 'string' || needle.length === 0) return -1;
  const first = haystack.indexOf(needle);
  if (first < 0 || haystack.indexOf(needle, first + needle.length) >= 0) return -1;
  return first;
}

function sectionEvidence(item, sectionText, exactQuote) {
  if (!Array.isArray(item.evidence) || item.evidence.length !== 1) return null;
  const sourceQuote = typeof item.raw_value === 'string' ? item.raw_value : '';
  const sourceOffset = oneOccurrence(sectionText, sourceQuote);
  const childOffset = oneOccurrence(sourceQuote, exactQuote);
  if (sourceOffset < 0 || childOffset < 0) return null;
  const edge = item.evidence[0];
  const prefix = sectionText.slice(0, sourceOffset) + sourceQuote.slice(0, childOffset);
  const absoluteStart = Buffer.byteLength(prefix, 'utf8');
  return Object.freeze({
    evidence_role: 'OPERATIVE_TEXT',
    excerpt_id: edge.excerpt_id,
    document_ordinal: edge.document_ordinal,
    absolute_start: absoluteStart,
    absolute_end: absoluteStart + Buffer.byteLength(exactQuote, 'utf8'),
  });
}

function claimFor({ provisionId, definitionKey, ordinal, canonicalValue, rawValue, evidence }) {
  const built = buildClaimRevision({
    subject_occurrence_id: provisionId,
    claim_definition_key: definitionKey,
    claim_definition_version: 1,
    ordinal,
    state: 'PRESENT',
    raw_value: rawValue,
    canonical_value: canonicalValue,
    evidence: [evidence],
    attributes: {},
    allowed_attributes: [],
    taxonomy_codes: {},
    codebooks: {},
    extraction_version: 'native-sole-remedy-resolution/v1',
    normalisation_version: 'native-sole-remedy-resolution/v1',
    derivation_version: 'native-sole-remedy-resolution/v1',
  });
  return freeze({
    ...built,
    closure_id: contentId('CLAIM_CLOSURE/V1', {
      provision_instance_id: provisionId,
      claim_revision_id: built.claim_revision_id,
    }),
  });
}

function provisionFor({ section, admittedSourceContext, contractVocabulary }) {
  const provision = buildStructuralProvisionInstance({
    source: admittedSourceContext,
    span: buildSemanticSpan(admittedSourceContext, section.start, section.end),
    conceptKey: CONCEPT_KEY,
    ordinal: 1,
    contractBundle: contractVocabulary,
  });
  return freeze({
    ...provision,
    closure_id: contentId('PROVISION_CLOSURE/V1', {
      provision_instance_id: provision.provision_instance_id,
    }),
  });
}

function resolvedEntry({ item, provision, claim, definitionKey, feeContext }) {
  const sourceCitation = item.source_citation || item.section_reference;
  return freeze({
    section_reference: item.section_reference,
    source_citation: sourceCitation,
    citation_context: null,
    governing_context_quote: null,
    generic_claim_key: 'OPEN_WORLD_PROPOSITION',
    resolved_claim_definition_key: definitionKey,
    concept_key: CONCEPT_KEY,
    owner_family: 'SPECIFIC_PERFORMANCE_REMEDIES',
    party: null,
    party_source_span: null,
    provision_instance: provision,
    claim,
    linked_fee_context: feeContext,
    triage: {
      auto_pass: false,
      deterministic_gates_passed: true,
      unevaluated_conditions: [
        'V1_V2_COMPARATOR_ABSENT',
        'LEXICAL_DISAGREEMENT_NET_ABSENT',
        'SOURCE_SCOPE_CERTIFICATION_ABSENT',
      ],
      reasons: [],
      materiality_rank: 99,
      materiality_label: 'UNCLASSIFIED',
      known_defect: null,
      citation_validation: item.citation_validation || null,
    },
  });
}

function reviewItem(resolved) {
  return freeze({
    section_reference: resolved.section_reference,
    generic_claim_key: resolved.generic_claim_key,
    resolved_claim_definition_key: resolved.resolved_claim_definition_key,
    concept_key: resolved.concept_key,
    reasons: resolved.triage.reasons,
    materiality_rank: resolved.triage.materiality_rank,
    materiality_label: resolved.triage.materiality_label,
    auto_pass: false,
    has_resolution: true,
    claim_revision_id: resolved.claim.claim_revision_id,
    closure_id: resolved.claim.closure_id,
    normalised_phrase: resolved.claim.raw_value.toLowerCase().replace(/\s+/g, ' ').trim(),
    attachment_position: null,
    concept_family: CONCEPT_KEY,
  });
}

function residualItem(item, reason, proposedCarveOut, ordinal) {
  return freeze({
    ...item,
    reason,
    closure_id: contentId('SOLE_REMEDY_OPEN_WORLD_RESIDUAL/V1', {
      source_closure_id: item.closure_id || null,
      reason,
      proposed_carve_out: proposedCarveOut || null,
      ordinal,
    }),
    attributes: {
      ...item.attributes,
      why_unmapped: `SOLE_REMEDY_CARVEOUT_REVIEW: ${reason}`,
      structured_mechanic: {
        surface: 'SOLE_REMEDY_CARVEOUT_REVIEW',
        proposed_carve_out: proposedCarveOut || null,
      },
    },
  });
}

function effectResidualItem(item, reason) {
  return freeze({
    ...item,
    reason,
    closure_id: contentId('SOLE_REMEDY_OPEN_WORLD_RESIDUAL/V1', {
      source_closure_id: item.closure_id || null,
      reason,
      proposed_mechanic: item.attributes.structured_mechanic,
    }),
    attributes: {
      ...item.attributes,
      why_unmapped: `SOLE_REMEDY_LEGAL_EFFECT_REVIEW: ${reason}`,
      structured_mechanic: {
        surface: 'SOLE_REMEDY_LEGAL_EFFECT_REVIEW',
        owner_family: 'SPECIFIC_PERFORMANCE_REMEDIES',
        proposed_mechanic: item.attributes.structured_mechanic,
      },
    },
  });
}

function feeEvidenceItem(item, paymentContextQuote, remediesClaimLink) {
  return freeze({
    ...item,
    reason: remediesClaimLink ? 'SOLE_REMEDY_FEE_CONTEXT_LINKED' : item.reason,
    attributes: {
      ...item.attributes,
      structured_mechanic: {
        surface: 'SOLE_REMEDY_EVIDENCE',
        owner_family: 'TERMINATION_FEE',
        payment_context_quote: paymentContextQuote,
        remedies_claim_link: remediesClaimLink,
      },
    },
  });
}

function resolveSoleRemedyOpenWorld({
  open_world: openWorld,
  resolved_sections: resolvedSections,
  admitted_source_context: admittedSourceContext,
  contract_vocabulary: contractVocabulary,
} = {}) {
  if (!Array.isArray(openWorld)) throw new TypeError('open_world must be an array');
  if (!Array.isArray(resolvedSections)) throw new TypeError('resolved_sections must be an array');
  if (!admittedSourceContext?.canonical_text?.text) throw new TypeError('admitted_source_context canonical text is required');
  if (!vocabularySupportsSoleRemedy(contractVocabulary)) {
    // `openWorld` here is the CALLER's own live array (candidate-resolution.js's
    // `openWorld`, still being mutated after this call returns), not a copy.
    // `freeze()` walks every value in the object below and calls Object.freeze
    // on each, so passing the caller's array through by reference would freeze
    // it in place -- corrupting a structure this function does not own and the
    // caller has not finished building. Spread it into a fresh array (an inert
    // pass-through has to be a copy, exactly like the `enabled: true` branch
    // below builds its own new `retainedOpenWorld` rather than reusing this one).
    return freeze({ schema_version: RESOLUTION_SCHEMA, enabled: false, resolved: [], review_queue: [], open_world: [...openWorld], provisions: [] });
  }

  const sections = new Map(resolvedSections.map((section) => [section.section_reference, section]));
  const provisions = new Map();
  const claimOrdinals = new Map();
  const resolved = [];
  const reviewQueue = [];
  const retainedOpenWorld = [];

  for (const item of openWorld) {
    if (!isSoleRemedyItem(item)) {
      retainedOpenWorld.push(item);
      continue;
    }
    const mechanic = item.attributes.structured_mechanic;
    const section = sections.get(item.section_reference);
    const sectionText = section
      ? utf8Slice(admittedSourceContext.canonical_text.text, section.start, section.end)
      : '';
    const paymentContextQuote = oneOccurrence(item.raw_value || '', mechanic.payment_context_quote) >= 0
      ? mechanic.payment_context_quote : null;
    const effectQuote = mechanic.remedy_effect_quote;
    const effectEvidence = section ? sectionEvidence(item, sectionText, effectQuote) : null;
    if (!effectEvidence) {
      retainedOpenWorld.push(feeEvidenceItem(item, paymentContextQuote, null));
      retainedOpenWorld.push(effectResidualItem(
        item,
        typeof effectQuote === 'string' && effectQuote.length > 0
          ? 'SOLE_REMEDY_LEGAL_EFFECT_QUOTE_UNCORROBORATED'
          : 'SOLE_REMEDY_LEGAL_EFFECT_QUOTE_MISSING',
      ));
      continue;
    }

    let provision = provisions.get(item.section_reference);
    if (!provision) {
      provision = provisionFor({ section, admittedSourceContext, contractVocabulary });
      provisions.set(item.section_reference, provision);
    }
    const feeContext = freeze({
      payment_context_quote: paymentContextQuote,
      source_section_reference: item.section_reference,
      fee_evidence_closure_id: item.closure_id || null,
    });
    const effectOrdinalKey = `${provision.provision_instance_id}:${LEGAL_EFFECT_DEFINITION}`;
    const effectOrdinal = claimOrdinals.get(effectOrdinalKey) || 0;
    claimOrdinals.set(effectOrdinalKey, effectOrdinal + 1);
    const effectClaim = claimFor({
      provisionId: provision.provision_instance_id,
      definitionKey: LEGAL_EFFECT_DEFINITION,
      ordinal: effectOrdinal,
      canonicalValue: true,
      rawValue: effectQuote,
      evidence: effectEvidence,
    });
    const effectResolved = resolvedEntry({ item, provision, claim: effectClaim, definitionKey: LEGAL_EFFECT_DEFINITION, feeContext });
    resolved.push(effectResolved);
    reviewQueue.push(reviewItem(effectResolved));
    const remediesClaimLink = freeze({
      provision_instance_id: provision.provision_instance_id,
      claim_revision_id: effectClaim.claim_revision_id,
    });
    retainedOpenWorld.push(feeEvidenceItem(item, paymentContextQuote, remediesClaimLink));

    for (const [carveOutOrdinal, carveOut] of (Array.isArray(mechanic.carve_outs) ? mechanic.carve_outs : []).entries()) {
      if (!CARVEOUT_KINDS.includes(carveOut?.kind)) {
        retainedOpenWorld.push(residualItem(item, 'SOLE_REMEDY_CARVEOUT_KIND_OUT_OF_ENUM', carveOut, carveOutOrdinal));
        continue;
      }
      const carveOutEvidence = sectionEvidence(item, sectionText, carveOut.quote);
      if (!carveOutEvidence) {
        retainedOpenWorld.push(residualItem(item, 'SOLE_REMEDY_CARVEOUT_QUOTE_UNCORROBORATED', carveOut, carveOutOrdinal));
        continue;
      }
      const ordinalKey = `${provision.provision_instance_id}:${CARVEOUT_DEFINITION}`;
      const ordinal = claimOrdinals.get(ordinalKey) || 0;
      claimOrdinals.set(ordinalKey, ordinal + 1);
      const claim = claimFor({
        provisionId: provision.provision_instance_id,
        definitionKey: CARVEOUT_DEFINITION,
        ordinal,
        canonicalValue: carveOut.kind,
        rawValue: carveOut.quote,
        evidence: carveOutEvidence,
      });
      const resolvedCarveOut = resolvedEntry({ item, provision, claim, definitionKey: CARVEOUT_DEFINITION, feeContext });
      resolved.push(resolvedCarveOut);
      reviewQueue.push(reviewItem(resolvedCarveOut));
    }
  }

  return freeze({
    schema_version: RESOLUTION_SCHEMA,
    enabled: true,
    resolved,
    review_queue: reviewQueue,
    open_world: retainedOpenWorld,
    provisions: [...provisions.values()],
  });
}

module.exports = {
  CARVEOUT_DEFINITION,
  CARVEOUT_KINDS,
  CONCEPT_KEY,
  LEGAL_EFFECT_DEFINITION,
  RESOLUTION_SCHEMA,
  resolveSoleRemedyOpenWorld,
};
