'use strict';

const { classifyQualifierQuote } = require('./qualifier-kind-lexicon');
const { parseMeasurementDate, parseMeasurementPeriod } = require('./measurement-date-parse');

const MODE = 'INERT_REPLAY_ONLY';
const TARGET_REASON = 'REPRESENTATION_QUALIFIER_KIND_NOT_GOVERNED';
const QUALIFIER_KINDS = new Set(['THRESHOLD', 'TEMPORAL']);

const AS_OF_SIGNAL = /\bas\s+of\b/i;
const LOOKBACK_SIGNAL = /^\s*(?:since|from)\b/i;

function fail(message) {
  throw new TypeError(`representation qualifier dispatch measurement: ${message}`);
}

function conceptForSide(side) {
  if (side === 'TARGET') return 'REP-T-QUALIFIER';
  if (side === 'BUYER') return 'REP-B-QUALIFIER';
  return null;
}

function proposedClaim({ definition, concept, canonicalValue, attributes = {} }) {
  return Object.freeze({
    claim_definition_key: definition,
    concept_key: concept,
    canonical_value: canonicalValue,
    attributes: Object.freeze(attributes),
  });
}

/**
 * Evaluates one previously open-world representation qualifier. This is an
 * assessment only. It never returns an active claim and every proposal is
 * explicitly withheld from publishing, writing, and taxonomy mutation.
 */
function assessRepresentationQualifierDispatch({ row, agreement_date = null } = {}) {
  if (!row || typeof row !== 'object') fail('row must be an object');
  if (row.reason !== TARGET_REASON) fail(`row reason must be ${TARGET_REASON}`);
  if (typeof row.raw_value !== 'string' || row.raw_value.trim().length === 0) fail('row raw_value must be non-empty');
  const attributes = row.attributes || {};
  const kind = attributes.qualifier_kind;
  if (!QUALIFIER_KINDS.has(kind)) fail(`unsupported qualifier kind ${String(kind)}`);
  const concept = conceptForSide(attributes.representation_side);
  if (!concept) fail('representation_side must be TARGET or BUYER');

  const quote = row.raw_value;
  const lexicon = classifyQualifierQuote({ quote, modelKind: null });
  const base = {
    mode: MODE,
    source_reason: TARGET_REASON,
    qualifier_kind: kind,
    quote,
    concept_key: concept,
    lexicon: Object.freeze({
      outcome: lexicon.outcome,
      ...(lexicon.kind ? { kind: lexicon.kind } : {}),
      ...(lexicon.lexiconKind ? { lexicon_kind: lexicon.lexiconKind } : {}),
      ...(lexicon.code ? { code: lexicon.code } : {}),
      ...(lexicon.reason ? { reason: lexicon.reason } : {}),
    }),
    publication_disposition: 'WITHHELD',
    writes_performed: false,
    taxonomy_activated: false,
  };

  if (kind === 'THRESHOLD') {
    // MAE tolerance belongs to the existing MAE classifier. A proposed
    // THRESHOLD may only cross into ACCURACY when that classifier has already
    // made the exact governed call. This module does not recreate its grammar.
    if (lexicon.outcome === 'CLASSIFIED' && lexicon.kind === 'ACCURACY' && lexicon.code === 'MAT_MAE_QUALIFIED') {
      return Object.freeze({
        ...base,
        dispatch: 'ACCURACY_MAE_TOLERANCE_RECLASSIFICATION',
        residual_code: 'MODEL_KIND_CONFLICTS_WITH_MAE_TOLERANCE',
        proposed_claims: Object.freeze([proposedClaim({
          definition: 'REPRESENTATION_ACCURACY_STANDARD',
          concept,
          canonicalValue: 'MAT_MAE_QUALIFIED',
          attributes: { qualifier_kind: 'ACCURACY', source_kind: 'THRESHOLD', reclassification: 'COMPOUND_MAE' },
        })]),
      });
    }
    // THRESHOLD_PATTERNS are consumed by classifyQualifierQuote. A raw word
    // such as “Material Contract” is not a controlled positive match.
    if (lexicon.outcome === 'CLASSIFIED' && lexicon.kind === 'THRESHOLD') {
      return Object.freeze({
        ...base,
        dispatch: 'THRESHOLD_MATERIALITY',
        residual_code: null,
        proposed_claims: Object.freeze([proposedClaim({
          definition: 'GENERAL_MATERIALITY_QUALIFIER', concept, canonicalValue: true,
          attributes: { qualifier_kind: 'THRESHOLD' },
        })]),
      });
    }
    return Object.freeze({
      ...base,
      dispatch: 'THRESHOLD_HELD',
      residual_code: 'THRESHOLD_FORM_NOT_GOVERNED',
      proposed_claims: Object.freeze([]),
    });
  }

  if (LOOKBACK_SIGNAL.test(quote)) {
    return Object.freeze({
      ...base,
      dispatch: 'TEMPORAL_RETROSPECTIVE_LOOKBACK',
      residual_code: null,
      proposed_claims: Object.freeze([proposedClaim({
        definition: 'RETROSPECTIVE_LOOKBACK', concept, canonicalValue: true,
        attributes: { qualifier_kind: 'TEMPORAL', temporal_form: 'LOOKBACK' },
      })]),
    });
  }
  if (!AS_OF_SIGNAL.test(quote)) {
    return Object.freeze({
      ...base,
      dispatch: 'TEMPORAL_HELD',
      residual_code: 'TEMPORAL_FORM_NOT_GOVERNED',
      proposed_claims: Object.freeze([]),
    });
  }

  const parsed = parseMeasurementDate({ quote, agreement_date });
  if (parsed.outcome === 'PERIOD_DETECTED') {
    const period = parseMeasurementPeriod({ quote, agreement_date });
    if (period.outcome !== 'RESOLVED_PERIOD') {
      return Object.freeze({ ...base, dispatch: 'TEMPORAL_HELD', residual_code: period.reason, proposed_claims: Object.freeze([]) });
    }
    return Object.freeze({
      ...base,
      dispatch: 'TEMPORAL_MEASUREMENT_PERIOD',
      residual_code: null,
      proposed_claims: Object.freeze([
        proposedClaim({ definition: 'REPRESENTATION_MEASUREMENT_DATE', concept, canonicalValue: period.start.iso_date, attributes: { qualifier_kind: 'TEMPORAL', period_role: 'PERIOD_START' } }),
        proposedClaim({ definition: 'REPRESENTATION_MEASUREMENT_DATE', concept, canonicalValue: period.end.iso_date, attributes: { qualifier_kind: 'TEMPORAL', period_role: 'PERIOD_END' } }),
      ]),
    });
  }
  if (parsed.outcome !== 'RESOLVED') {
    return Object.freeze({ ...base, dispatch: 'TEMPORAL_HELD', residual_code: parsed.reason, proposed_claims: Object.freeze([]) });
  }
  return Object.freeze({
    ...base,
    dispatch: 'TEMPORAL_MEASUREMENT_DATE',
    residual_code: null,
    proposed_claims: Object.freeze([proposedClaim({
      definition: 'REPRESENTATION_MEASUREMENT_DATE', concept, canonicalValue: parsed.iso_date,
      attributes: { qualifier_kind: 'TEMPORAL', measurement_date_resolution: parsed.resolution },
    })]),
  });
}

module.exports = {
  MODE,
  TARGET_REASON,
  assessRepresentationQualifierDispatch,
};
