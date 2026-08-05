'use strict';

const { canonicalJson, contentId, utf8Slice } = require('../canonical-bytes');
const { IOC_THRESHOLD_PARSE_VERSION, parseThresholdAmount } = require('./ioc-threshold-parse');

const RESOLUTION_SCHEMA = 'NATIVE_IOC_MECHANIC_RESOLUTION/V1';
const ATTACHMENT_SCHEMA = 'IOC_MECHANIC_ATTACHMENT/V1';
const NUMERIC_SCHEMA = 'IOC_MECHANIC_NUMERIC_RESOLUTION/V1';
const IOC_SURFACES = new Set([
  'AFFIRMATIVE_COVENANT', 'LONG_TAIL_RESTRICTION',
  'CONSENT_OR_EFFORTS_STANDARD', 'EXCEPTION', 'THRESHOLD_OR_NOTICE_WINDOW',
]);

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}

function isIocMechanic(item) {
  return item?.claim_definition_key === 'OPEN_WORLD_PROPOSITION'
    && IOC_SURFACES.has(item?.attributes?.structured_mechanic?.surface);
}

function componentText(component, sourceText) {
  return utf8Slice(sourceText, component.absolute_start, component.absolute_end);
}

function uniqueBy(values, key) {
  const seen = new Set();
  return values.filter((value) => {
    const id = key(value);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function exactSectionOccurrence(section, sourceText, quote) {
  if (!section || typeof quote !== 'string' || quote.length === 0) return false;
  const sectionText = utf8Slice(sourceText, section.start, section.end);
  const first = sectionText.indexOf(quote);
  return first >= 0 && sectionText.indexOf(quote, first + quote.length) < 0;
}

function parentWideLanguage(quote) {
  return typeof quote === 'string' && (
    /\bnothing\s+(?:in|contained in)\s+this\s+Section\b/i.test(quote)
    || /\bnotwithstanding\s+anything\s+to\s+the\s+contrary\s+(?:in|contained in)\s+this\s+Section\b/i.test(quote)
    || /\b(?:any|all)\s+of\s+the\s+foregoing\b/i.test(quote)
    || /\banything\s+(?:set\s+forth|described)\s+in\s+this\s+Section\b/i.test(quote)
  );
}

function numericResolution(mechanic, quote) {
  if (typeof mechanic.value_literal !== 'string' || mechanic.value_literal.length === 0) return null;
  if ((mechanic.unverified_operand_fields || []).length > 0) {
    return freeze({
      schema_version: NUMERIC_SCHEMA,
      state: 'REVIEW_REQUIRED',
      reason: 'IOC_NUMERIC_OPERAND_NOT_EXACT',
      parser_version: IOC_THRESHOLD_PARSE_VERSION,
      canonical_value: null,
      canonical_unit: null,
      currency: null,
    });
  }
  const quoteResult = parseThresholdAmount(quote);
  if (quoteResult.outcome !== 'RESOLVED') {
    return freeze({
      schema_version: NUMERIC_SCHEMA,
      state: 'OPEN_WORLD',
      reason: quoteResult.reason,
      parser_version: IOC_THRESHOLD_PARSE_VERSION,
      canonical_value: null,
      canonical_unit: null,
      currency: null,
    });
  }
  const literalResult = parseThresholdAmount(mechanic.value_literal);
  if (literalResult.outcome !== 'RESOLVED'
    || literalResult.canonical_value !== quoteResult.canonical_value
    || literalResult.currency !== quoteResult.currency) {
    return freeze({
      schema_version: NUMERIC_SCHEMA,
      state: 'REVIEW_REQUIRED',
      reason: 'IOC_NUMERIC_VALUE_LITERAL_MISMATCH',
      parser_version: IOC_THRESHOLD_PARSE_VERSION,
      canonical_value: null,
      canonical_unit: null,
      currency: null,
    });
  }
  return freeze({
    schema_version: NUMERIC_SCHEMA,
    state: 'RESOLVED',
    reason: null,
    parser_version: IOC_THRESHOLD_PARSE_VERSION,
    canonical_value: quoteResult.canonical_value,
    canonical_unit: 'MONEY',
    currency: quoteResult.currency,
    scale: quoteResult.scale || null,
  });
}

function limbAttachment({ mechanic, item, components, entriesByComponentId, sourceText }) {
  const targetQuote = mechanic.target_restriction_quote;
  if (typeof targetQuote !== 'string' || targetQuote.length === 0) {
    return { attachment: null, reason: 'IOC_ATTACHMENT_TARGET_QUOTE_MISSING' };
  }
  if (!item.raw_value.includes(targetQuote)) {
    return { attachment: null, reason: 'IOC_ATTACHMENT_TARGET_QUOTE_OUTSIDE_MECHANIC' };
  }
  const matches = components.filter((component) => componentText(component, sourceText) === targetQuote);
  if (matches.length === 0) return { attachment: null, reason: 'IOC_ATTACHMENT_TARGET_ZERO_MATCHES' };
  if (matches.length > 1) return { attachment: null, reason: 'IOC_ATTACHMENT_TARGET_MULTIPLE_MATCHES' };
  const component = matches[0];
  const entries = entriesByComponentId.get(component.provision_component_id) || [];
  if (entries.length !== 1) {
    return {
      attachment: null,
      reason: entries.length === 0
        ? 'IOC_ATTACHMENT_TARGET_HAS_NO_RESOLVED_RESTRICTION'
        : 'IOC_ATTACHMENT_TARGET_HAS_MULTIPLE_RESOLVED_RESTRICTIONS',
    };
  }
  const [entry] = entries;
  return {
    reason: null,
    attachment: freeze({
      schema_version: ATTACHMENT_SCHEMA,
      state: 'RESOLVED',
      scope: 'RESTRICTION_COMPONENT',
      target: {
        provision_component_id: component.provision_component_id,
        component_key: component.component_key,
        parent_provision_instance_id: component.parent_provision_instance_id,
        path: [
          `section:${item.section_reference}`,
          `provision:${component.parent_provision_instance_id}`,
          `component:${component.provision_component_id}`,
        ],
        span: {
          canonical_text_id: component.canonical_text_id,
          absolute_start: component.absolute_start,
          absolute_end: component.absolute_end,
        },
      },
      inherited_party: entry.party,
    }),
  };
}

function parentAttachment({ item, section, sectionEntries, sourceText }) {
  if (!exactSectionOccurrence(section, sourceText, item.raw_value)) {
    return { attachment: null, reason: 'IOC_PARENT_ATTACHMENT_QUOTE_NOT_UNIQUE_IN_SECTION' };
  }
  if (!parentWideLanguage(item.raw_value)) {
    return { attachment: null, reason: 'IOC_PARENT_ATTACHMENT_SCOPE_UNCORROBORATED' };
  }
  if (sectionEntries.length === 0) {
    return { attachment: null, reason: 'IOC_PARENT_ATTACHMENT_HAS_NO_RESTRICTION_CHILDREN' };
  }
  const parties = uniqueBy(sectionEntries.map((entry) => entry.party).filter(Boolean), canonicalJson);
  if (parties.length !== 1) {
    return { attachment: null, reason: 'IOC_PARENT_ATTACHMENT_PARTY_AMBIGUOUS' };
  }
  const provisionIds = uniqueBy(
    sectionEntries.map((entry) => entry.provision_instance?.provision_instance_id).filter(Boolean),
    (value) => value,
  ).sort();
  const targetBody = {
    section_reference: item.section_reference,
    canonical_text_id: sectionEntries[0].provision_instance.canonical_text_id,
    absolute_start: section.start,
    absolute_end: section.end,
    provision_instance_ids: provisionIds,
  };
  return {
    reason: null,
    attachment: freeze({
      schema_version: ATTACHMENT_SCHEMA,
      state: 'RESOLVED',
      scope: 'PARENT_COVENANT',
      target: {
        parent_covenant_target_id: contentId('IOC_PARENT_COVENANT_TARGET/V1', targetBody),
        path: [`section:${item.section_reference}`, 'parent-covenant'],
        span: {
          canonical_text_id: targetBody.canonical_text_id,
          absolute_start: targetBody.absolute_start,
          absolute_end: targetBody.absolute_end,
        },
        provision_instance_ids: provisionIds,
      },
      inherited_party: parties[0],
    }),
  };
}

function unresolvedAttachment(scope, mechanic, reason) {
  return freeze({
    schema_version: ATTACHMENT_SCHEMA,
    state: 'REVIEW_REQUIRED',
    scope: scope === 'PARENT_COVENANT' ? 'PARENT_COVENANT' : 'RESTRICTION_COMPONENT',
    target: null,
    proposed_target_quote: mechanic.target_restriction_quote || null,
    reason,
    inherited_party: null,
  });
}

function reviewItem(item, reasons) {
  return freeze({
    section_reference: item.section_reference,
    source_citation: item.source_citation || item.section_reference,
    generic_claim_key: 'OPEN_WORLD_PROPOSITION',
    resolved_claim_definition_key: null,
    concept_key: 'IOC-PENDING',
    reasons,
    materiality_rank: 65,
    materiality_label: 'INTERIM_OPERATING_COVENANTS',
    auto_pass: false,
    has_resolution: false,
    claim_revision_id: null,
    closure_id: item.closure_id,
    normalised_phrase: item.raw_value.toLowerCase().replace(/\s+/g, ' ').trim(),
    attachment_position: null,
    concept_family: 'IOC-PENDING',
  });
}

function resolveIocMechanics({
  open_world: openWorld,
  resolved,
  ioc_restriction_components: restrictionComponents,
  resolved_sections: resolvedSections,
  admitted_source_context: admittedSourceContext,
} = {}) {
  if (!Array.isArray(openWorld) || !Array.isArray(resolved)
    || !Array.isArray(restrictionComponents) || !Array.isArray(resolvedSections)) {
    throw new TypeError('IOC mechanic resolution requires array inputs');
  }
  const sourceText = admittedSourceContext?.canonical_text?.text;
  if (typeof sourceText !== 'string') throw new TypeError('admitted source text is required');
  if (!openWorld.some(isIocMechanic)) {
    return freeze({ schema_version: RESOLUTION_SCHEMA, enabled: false, open_world: openWorld, review_queue: [] });
  }

  const sections = new Map(resolvedSections.map((section) => [section.section_reference, section]));
  const entriesByComponentId = new Map();
  const entriesBySection = new Map();
  for (const entry of resolved.filter((candidate) => candidate.resolved_claim_definition_key === 'IOC_RESTRICTION_PRESENT')) {
    const componentId = entry.claim?.subject_occurrence_id;
    if (componentId) entriesByComponentId.set(componentId, [...(entriesByComponentId.get(componentId) || []), entry]);
    entriesBySection.set(entry.section_reference, [...(entriesBySection.get(entry.section_reference) || []), entry]);
  }
  const componentsBySection = new Map();
  for (const component of restrictionComponents) {
    const entries = entriesByComponentId.get(component.provision_component_id) || [];
    const sectionReference = entries[0]?.section_reference;
    if (sectionReference) componentsBySection.set(
      sectionReference,
      [...(componentsBySection.get(sectionReference) || []), component],
    );
  }

  const reviewQueue = [];
  const nextOpenWorld = openWorld.map((item) => {
    if (!isIocMechanic(item)) return item;
    const mechanic = item.attributes.structured_mechanic;
    const sectionReference = mechanic.section_reference || item.section_reference;
    const section = sections.get(sectionReference);
    const scope = mechanic.attachment_scope;
    let attachmentResult = { attachment: null, reason: null };
    if (scope === 'RESTRICTION_LIMB') {
      attachmentResult = limbAttachment({
        mechanic, item,
        components: componentsBySection.get(sectionReference) || [],
        entriesByComponentId,
        sourceText,
      });
    } else if (scope === 'PARENT_COVENANT') {
      attachmentResult = parentAttachment({
        item, section,
        sectionEntries: entriesBySection.get(sectionReference) || [],
        sourceText,
      });
    }
    const numeric = numericResolution(mechanic, item.raw_value);
    const reviewReasons = [
      attachmentResult.reason,
      numeric?.state === 'REVIEW_REQUIRED' ? numeric.reason : null,
    ].filter(Boolean);
    if (reviewReasons.length > 0) reviewQueue.push(reviewItem(item, reviewReasons));
    const {
      attachment_scope: requestedAttachmentScope,
      target_restriction_quote: proposedTargetQuote,
      ...rawMechanic
    } = mechanic;
    return freeze({
      ...item,
      attributes: {
        ...item.attributes,
        structured_mechanic: {
          ...rawMechanic,
          section_reference: sectionReference,
          requested_attachment_scope: requestedAttachmentScope || null,
          proposed_target_restriction_quote: proposedTargetQuote || null,
          attachment: attachmentResult.attachment
            || (attachmentResult.reason
              ? unresolvedAttachment(scope, mechanic, attachmentResult.reason) : null),
          numeric_resolution: numeric,
        },
      },
    });
  });

  return freeze({
    schema_version: RESOLUTION_SCHEMA,
    enabled: true,
    open_world: nextOpenWorld,
    review_queue: reviewQueue,
  });
}

module.exports = {
  ATTACHMENT_SCHEMA,
  IOC_SURFACES,
  NUMERIC_SCHEMA,
  RESOLUTION_SCHEMA,
  parentWideLanguage,
  resolveIocMechanics,
};
