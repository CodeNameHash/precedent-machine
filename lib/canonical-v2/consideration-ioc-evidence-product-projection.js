'use strict';

const { canonicalJson, contentId } = require('./canonical-bytes');

const PROJECTION_SCHEMA = 'CANONICAL_V2_CONSIDERATION_IOC_EVIDENCE_PRODUCT_PROJECTION/V1';
const AUTHORITY_STATE = 'VALIDATED_NOT_SERVED';
const EVIDENCE_SOURCE = 'CANONICAL_V2_OPEN_WORLD_EVIDENCE';

const CONSIDERATION_SURFACES = new Set([
  'CVR', 'ELECTION_ALTERNATIVE', 'ELECTION_ALLOCATION', 'ELECTION_DEFAULT',
  'ELECTION_DEADLINE', 'PRORATION_FORMULA', 'EQUITY_AWARD_TREATMENT',
  'COLLAR_WALKAWAY_TICKING', 'WITHHOLDING', 'EXCHANGE_MECHANICS',
]);
const IOC_SURFACES = new Set([
  'AFFIRMATIVE_COVENANT', 'LONG_TAIL_RESTRICTION',
  'CONSENT_OR_EFFORTS_STANDARD', 'EXCEPTION', 'THRESHOLD_OR_NOTICE_WINDOW',
]);

function clone(value) {
  return JSON.parse(canonicalJson(value));
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}

function surfaceOf(entry) {
  const surface = entry?.attributes?.structured_mechanic?.surface;
  if (typeof surface === 'string' && surface) return surface;
  const reason = String(entry?.attributes?.why_unmapped || '');
  return reason.split(':', 1)[0].trim() || null;
}

function evidenceEntries(resolution, acceptedSurfaces) {
  if (!resolution || !Array.isArray(resolution.open_world)) {
    throw new TypeError('resolution.open_world must be an array');
  }
  return resolution.open_world.filter((entry) => (
    entry?.claim_definition_key === 'OPEN_WORLD_PROPOSITION'
      && acceptedSurfaces.has(surfaceOf(entry))
      && typeof entry.raw_value === 'string'
      && entry.raw_value.length > 0
  ));
}

function mechanic(entry) {
  const value = entry?.attributes?.structured_mechanic;
  return value && typeof value === 'object' ? clone(value) : { surface: surfaceOf(entry) };
}

function featureSet(family, surface, quote, structuredMechanic) {
  if (family === 'CONSIDERATION') {
    const base = { considerationEvidenceMechanic: quote };
    if (surface === 'CVR') return { ...base, cvrPresent: true, cvrEvidence: quote };
    if (surface === 'EQUITY_AWARD_TREATMENT') {
      return { ...base, equityAwardTreatmentPresent: true, equityAwardTreatmentEvidence: quote };
    }
    if (surface === 'ELECTION_DEADLINE') {
      return { ...base, electionMechanicsPresent: true, electionDeadlineEvidence: quote };
    }
    if (surface === 'PRORATION_FORMULA' || surface === 'ELECTION_ALLOCATION') {
      return {
        ...base,
        electionMechanicsPresent: true,
        prorationMechanics: quote,
        prorationFormulaEvidence: structuredMechanic,
      };
    }
    if (surface.startsWith('ELECTION_')) {
      return { ...base, electionMechanicsPresent: true, electionMechanics: quote };
    }
    return { ...base, considerationMechanicPresent: true };
  }
  return {
    iocEvidenceMechanic: quote,
    iocEvidenceMechanicPresent: true,
    iocEvidenceSurface: surface,
    // These fields deliberately retain raw evidence.  They do not turn a
    // long-tail surface name, a number, or an exception into a governed IOC code.
    iocEvidenceNumeric: {
      value_literal: structuredMechanic.value_literal || null,
      unit_literal: structuredMechanic.unit_literal || null,
      basis_literal: structuredMechanic.basis_literal || null,
      period_literal: structuredMechanic.period_literal || null,
    },
  };
}

function reviewLabel(family, surface) {
  if (family === 'CONSIDERATION') {
    return ({
      CVR: 'Contingent value right',
      EQUITY_AWARD_TREATMENT: 'Equity-award treatment',
      ELECTION_DEADLINE: 'Election deadline',
      PRORATION_FORMULA: 'Proration formula',
    })[surface] || 'Consideration mechanism';
  }
  return 'Interim operating covenant evidence';
}

function fieldFor(family, surface) {
  if (family === 'CONSIDERATION') {
    if (surface === 'CVR') return 'cvrPresent';
    if (surface === 'EQUITY_AWARD_TREATMENT') return 'equityAwardTreatmentEvidence';
    if (surface === 'ELECTION_DEADLINE') return 'electionDeadlineEvidence';
    if (surface === 'PRORATION_FORMULA' || surface === 'ELECTION_ALLOCATION') return 'prorationMechanics';
    if (surface.startsWith('ELECTION_')) return 'electionMechanics';
    return 'considerationEvidenceMechanic';
  }
  return 'iocEvidenceMechanic';
}

function metricFor(family, surface) {
  if (family === 'CONSIDERATION') {
    if (surface === 'CVR') return { metric_key: 'CVR_PRESENCE', value: true };
    if (surface === 'EQUITY_AWARD_TREATMENT') return { metric_key: 'EQUITY_AWARD_TREATMENT_PRESENCE', value: true };
    if (surface.startsWith('ELECTION_') || surface === 'PRORATION_FORMULA') {
      return { metric_key: 'ELECTION_MECHANISM_PRESENCE_BY_SURFACE', value: surface };
    }
    return { metric_key: 'CONSIDERATION_EVIDENCE_PRESENCE_BY_SURFACE', value: surface };
  }
  return { metric_key: 'IOC_EVIDENCE_COMMONALITY_BY_SURFACE', value: surface };
}

function projectFamily({ resolution, deal_id: dealId, family }) {
  if (typeof dealId !== 'string' || !dealId) throw new TypeError('deal_id must be a non-empty string');
  const acceptedSurfaces = family === 'CONSIDERATION' ? CONSIDERATION_SURFACES : IOC_SURFACES;
  const provisionType = family === 'CONSIDERATION' ? 'CONSIDERATION' : 'COVENANT_INTERIM_OPERATING';
  const type = family === 'CONSIDERATION' ? 'CONSID' : 'IOC';
  const records = evidenceEntries(resolution, acceptedSurfaces).map((entry, ordinal) => {
    const surface = surfaceOf(entry);
    const quote = entry.raw_value;
    const structuredMechanic = mechanic(entry);
    const features = featureSet(family, surface, quote, structuredMechanic);
    const id = entry.closure_id || contentId('CANONICAL_V2_EVIDENCE_PRODUCT_CARD/V1', {
      deal_id: dealId, family, surface, quote, ordinal,
    });
    const fieldKey = fieldFor(family, surface);
    const metric = metricFor(family, surface);
    return {
      id,
      surface,
      quote,
      structured_mechanic: structuredMechanic,
      card: {
        id,
        provision_instance_id: id,
        deal_id: dealId,
        excerpt_id: `native-open-world:${id}`,
        type,
        provision_type: provisionType,
        provision_subtype: 'OPEN-WORLD-EVIDENCE',
        section_ref: entry.section_reference || null,
        short_title: reviewLabel(family, surface),
        primary_quote: quote,
        region_full_text: quote,
        full_text: quote,
        features,
        ai_metadata: { features },
        canonical_v2_lineage: { source: EVIDENCE_SOURCE, closure_id: entry.closure_id || null },
      },
      review: {
        row_id: `${family.toLowerCase()}-evidence-${id}`,
        label: reviewLabel(family, surface),
        value: quote,
        source_section_reference: entry.section_reference || null,
        evidence: quote,
        structured_mechanic: structuredMechanic,
      },
      query: { field_key: fieldKey, value: surface === 'CVR' ? true : quote, evidence: quote },
      compare: { field_key: fieldKey, value: surface === 'CVR' ? true : quote, evidence: quote },
      market: {
        ...metric,
        metric_version: 1,
        value_dimension: metric.value === true ? 'BOOLEAN_PRESENCE' : 'EXACT_EVIDENCE_SURFACE',
        canonical_value: metric.value,
        canonical_value_type: metric.value === true ? 'BOOLEAN' : 'STRING',
        per_deal_rollup: metric.value === true ? 'ANY_TRUE' : 'DISTINCT_VALUE_SET',
        weighting: 'DEAL',
        evidence: quote,
      },
      side_table: family === 'CONSIDERATION' ? {
        table_key: 'consideration_equity_evidence',
        mechanism_surface: surface,
        exact_evidence: quote,
        structured_mechanic: structuredMechanic,
      } : null,
    };
  });
  const body = {
    schema_version: PROJECTION_SCHEMA,
    authority_state: AUTHORITY_STATE,
    family,
    deal_id: dealId,
    cards: records.map((record) => record.card).sort((a, b) => a.id.localeCompare(b.id)),
    review: records.map((record) => record.review).sort((a, b) => a.row_id.localeCompare(b.row_id)),
    query: records.map((record) => record.query),
    compare: records.map((record) => record.compare),
    market: records.map((record) => record.market),
    side_tables: records.map((record) => record.side_table).filter(Boolean),
  };
  return freeze({ ...clone(body), projection_id: contentId(PROJECTION_SCHEMA, body) });
}

function projectConsiderationEvidenceProductSurfaces(input = {}) {
  return projectFamily({ ...input, family: 'CONSIDERATION' });
}

function projectIocEvidenceProductSurfaces(input = {}) {
  return projectFamily({ ...input, family: 'INTERIM_OPERATING_COVENANTS' });
}

module.exports = {
  AUTHORITY_STATE,
  CONSIDERATION_SURFACES,
  EVIDENCE_SOURCE,
  IOC_SURFACES,
  PROJECTION_SCHEMA,
  projectConsiderationEvidenceProductSurfaces,
  projectIocEvidenceProductSurfaces,
};
