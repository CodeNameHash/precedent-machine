const { canonicalJson, contentId } = require('./canonical-bytes');
const { normaliseDurationToDays } = require('./observation-normalisers');
const {
  validateExcerpt,
  validateFixtureSourceAdmission,
  validateImmutableSource,
} = require('./source-structure');

const VALUE_FIELDS = Object.freeze([
  'raw_value',
  'canonical_value',
  'unit',
  'day_basis',
  'denominator',
]);
const SUPPORTED_DURATION_CLAIM = 'NO_SHOP_NOTICE_PERIOD_DAYS';
const PROOF_RULE_VERSION = 'canonical-v2/correction-duration-evidence/v1';
const DECIMAL_SOURCE = '(?:0|[1-9]\\d*)(?:\\.\\d+)?';
const NUMBER_WORD_SOURCE = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
  'seventeen', 'eighteen', 'nineteen', 'twenty', 'thirty', 'forty', 'fifty',
  'sixty', 'seventy', 'eighty', 'ninety', 'hundred', 'thousand',
].join('|');
const DURATION_UNIT_SOURCE = '(?:business\\s+days?|calendar\\s+days?|hours?|days?)';

class CorrectionValueEvidenceError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'CorrectionValueEvidenceError';
    this.code = code;
    this.details = details;
  }
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function changedValueFields(predecessor, successor) {
  return VALUE_FIELDS.filter((field) => canonicalJson(predecessor[field]) !== canonicalJson(successor[field]));
}

function admittedSourcePairs(writeSet) {
  if (writeSet.source !== undefined || writeSet.source_admission !== undefined) {
    if (!writeSet.source || !writeSet.source_admission) {
      throw new CorrectionValueEvidenceError(
        'INVALID_CORRECTION_EVIDENCE_SOURCE',
        'The correction write set does not contain a complete admitted source pair.',
      );
    }
    return [{ source: writeSet.source, admission: writeSet.source_admission }];
  }
  if (!Array.isArray(writeSet.sources) || !Array.isArray(writeSet.source_admissions)
    || writeSet.sources.length !== writeSet.source_admissions.length) {
    throw new CorrectionValueEvidenceError(
      'INVALID_CORRECTION_EVIDENCE_SOURCE',
      'The correction write set does not contain complete admitted source pairs.',
    );
  }
  return writeSet.source_admissions.map((admission) => ({
    admission,
    source: writeSet.sources.find((source) => (
      source.immutable_source_document_id === admission.immutable_source_document_id
    )),
  }));
}

function resolveOperativeExcerpt({ writeSet, successor, contractBundle, documentHash }) {
  const operativeEdges = (successor.evidence || []).filter((edge) => edge.evidence_role === 'OPERATIVE_TEXT');
  if (operativeEdges.length !== 1) {
    throw new CorrectionValueEvidenceError(
      'AMBIGUOUS_CORRECTION_OPERATIVE_EVIDENCE',
      'A value-changing correction requires exactly one OPERATIVE_TEXT evidence edge.',
      { operative_evidence_count: operativeEdges.length },
    );
  }
  const edge = operativeEdges[0];
  const excerpts = (writeSet.excerpts || []).filter((excerpt) => excerpt.excerpt_id === edge.excerpt_id);
  if (excerpts.length !== 1) {
    throw new CorrectionValueEvidenceError(
      'INVALID_CORRECTION_EVIDENCE_SOURCE',
      'The OPERATIVE_TEXT evidence edge does not resolve to exactly one excerpt.',
      { excerpt_id: edge.excerpt_id, resolved_excerpt_count: excerpts.length },
    );
  }
  const excerpt = excerpts[0];
  if (edge.absolute_start !== excerpt.absolute_start || edge.absolute_end !== excerpt.absolute_end) {
    throw new CorrectionValueEvidenceError(
      'INVALID_CORRECTION_EVIDENCE_SOURCE',
      'The OPERATIVE_TEXT evidence edge does not use the excerpt exact byte offsets.',
      { excerpt_id: edge.excerpt_id },
    );
  }
  const pairs = admittedSourcePairs(writeSet).filter(({ admission }) => (
    admission && admission.source_ordinal === edge.document_ordinal
  ));
  if (pairs.length !== 1 || !pairs[0].source) {
    throw new CorrectionValueEvidenceError(
      'INVALID_CORRECTION_EVIDENCE_SOURCE',
      'The OPERATIVE_TEXT excerpt does not resolve to exactly one admitted source.',
      { document_ordinal: edge.document_ordinal },
    );
  }
  const { source, admission } = pairs[0];
  try {
    validateImmutableSource(source);
    validateFixtureSourceAdmission({
      source,
      admission,
      dealKey: writeSet.deal.deal_key,
      dealAdmissionId: writeSet.deal.deal_admission_id,
      contractFingerprint: contractBundle.fingerprint,
    });
    validateExcerpt({ source, excerpt });
  } catch (error) {
    throw new CorrectionValueEvidenceError(
      'INVALID_CORRECTION_EVIDENCE_SOURCE',
      'The OPERATIVE_TEXT excerpt failed immutable source or admission validation.',
      { cause_code: error.code || error.name, cause_message: error.message },
    );
  }
  if (source.document_hash !== documentHash || excerpt.document_hash !== documentHash) {
    throw new CorrectionValueEvidenceError(
      'INVALID_CORRECTION_EVIDENCE_SOURCE',
      'The OPERATIVE_TEXT excerpt is not anchored to the correction target document.',
      { excerpt_id: excerpt.excerpt_id },
    );
  }
  return { edge, excerpt, source, admission };
}

const SMALL_NUMBERS = Object.freeze({
  zero: 0n,
  one: 1n,
  two: 2n,
  three: 3n,
  four: 4n,
  five: 5n,
  six: 6n,
  seven: 7n,
  eight: 8n,
  nine: 9n,
  ten: 10n,
  eleven: 11n,
  twelve: 12n,
  thirteen: 13n,
  fourteen: 14n,
  fifteen: 15n,
  sixteen: 16n,
  seventeen: 17n,
  eighteen: 18n,
  nineteen: 19n,
});
const TENS = Object.freeze({
  twenty: 20n,
  thirty: 30n,
  forty: 40n,
  fifty: 50n,
  sixty: 60n,
  seventy: 70n,
  eighty: 80n,
  ninety: 90n,
});

function parseEnglishInteger(phrase) {
  const tokens = phrase.toLowerCase().split(/[\s-]+/).filter(Boolean);
  let total = 0n;
  let group = 0n;
  for (const token of tokens) {
    if (Object.hasOwn(SMALL_NUMBERS, token)) group += SMALL_NUMBERS[token];
    else if (Object.hasOwn(TENS, token)) group += TENS[token];
    else if (token === 'hundred' && group > 0n && group < 10n) group *= 100n;
    else if (token === 'thousand' && group > 0n && group < 1000n) {
      total += group * 1000n;
      group = 0n;
    } else return null;
  }
  return String(total + group);
}

function governedUnit(sourceUnit) {
  const selected = sourceUnit.toLowerCase().replace(/\s+/g, ' ');
  if (/^hours?$/.test(selected)) return { raw_unit: 'HOURS', explicit_day_basis: null };
  if (/^business days?$/.test(selected)) return { raw_unit: 'DAYS', explicit_day_basis: 'BUSINESS' };
  if (/^calendar days?$/.test(selected)) return { raw_unit: 'DAYS', explicit_day_basis: 'CALENDAR' };
  if (/^days?$/.test(selected)) return { raw_unit: 'DAYS', explicit_day_basis: null };
  return null;
}

function durationWitnesses(exactText) {
  const witnessed = [];
  const wordPattern = new RegExp(
    `\\b((?:${NUMBER_WORD_SOURCE})(?:[\\s-]+(?:${NUMBER_WORD_SOURCE}))*)`
      + `\\s*\\(\\s*(${DECIMAL_SOURCE})\\s*\\)\\s*(${DURATION_UNIT_SOURCE})\\b`,
    'gi',
  );
  for (const match of exactText.matchAll(wordPattern)) {
    const magnitude = match[2];
    const wordsMagnitude = parseEnglishInteger(match[1]);
    if (wordsMagnitude === null || !/^\d+$/.test(magnitude) || wordsMagnitude !== magnitude) {
      throw new CorrectionValueEvidenceError(
        'DURATION_WORD_NUMBER_MISMATCH',
        'The duration words and parenthetical magnitude do not agree exactly.',
      );
    }
    witnessed.push({
      magnitude,
      ...governedUnit(match[3]),
      witness_start: match.index,
      witness_end: match.index + match[0].length,
    });
  }

  const decimalPattern = new RegExp(`\\b(${DECIMAL_SOURCE})\\s+(${DURATION_UNIT_SOURCE})\\b`, 'gi');
  for (const match of exactText.matchAll(decimalPattern)) {
    const start = match.index;
    const end = start + match[0].length;
    if (witnessed.some((item) => start >= item.witness_start && end <= item.witness_end)) continue;
    witnessed.push({
      magnitude: match[1],
      ...governedUnit(match[2]),
      witness_start: start,
      witness_end: end,
    });
  }
  return witnessed.sort((left, right) => left.witness_start - right.witness_start);
}

function extractUnambiguousDurationWitness(exactText) {
  const witnesses = durationWitnesses(exactText);
  if (witnesses.length !== 1 || !witnesses[0].raw_unit) {
    throw new CorrectionValueEvidenceError(
      'AMBIGUOUS_DURATION_EVIDENCE',
      'The OPERATIVE_TEXT excerpt must contain exactly one supported duration magnitude and unit.',
      { duration_witness_count: witnesses.length },
    );
  }
  return witnesses[0];
}

function successorProjection(successor) {
  return {
    raw_value: successor.raw_value,
    canonical_value: successor.canonical_value,
    unit: successor.unit,
    day_basis: successor.day_basis,
    denominator: successor.denominator,
    normalisation_attributes: successor.attributes,
  };
}

function buildExpectedDurationProjection({ predecessor, successor, excerpt }) {
  const witness = extractUnambiguousDurationWitness(excerpt.exact_text);
  const governedDayBasis = predecessor.day_basis;
  const governedTrigger = predecessor.attributes && predecessor.attributes.trigger;
  if (typeof governedDayBasis !== 'string' || typeof governedTrigger !== 'string' || !governedTrigger) {
    throw new CorrectionValueEvidenceError(
      'UNSUPPORTED_CORRECTION_VALUE_EVIDENCE',
      'The predecessor duration claim lacks its governed day basis or trigger.',
    );
  }
  if (witness.explicit_day_basis && witness.explicit_day_basis !== governedDayBasis) {
    throw new CorrectionValueEvidenceError(
      'CORRECTED_VALUE_EVIDENCE_MISMATCH',
      'The duration evidence day basis conflicts with the governed predecessor day basis.',
    );
  }
  let normalised;
  try {
    normalised = normaliseDurationToDays({
      rawMagnitude: witness.magnitude,
      rawUnit: witness.raw_unit,
      dayBasis: governedDayBasis,
      trigger: governedTrigger,
      derivationVersion: successor.derivation_version,
    });
  } catch (error) {
    throw new CorrectionValueEvidenceError(
      'CORRECTED_VALUE_EVIDENCE_MISMATCH',
      'The duration evidence cannot produce a governed duration projection.',
      { cause_code: error.code || error.name, cause_message: error.message },
    );
  }
  if (normalised.comparability_state !== 'COMPARABLE') {
    throw new CorrectionValueEvidenceError(
      'CORRECTED_VALUE_EVIDENCE_MISMATCH',
      'The duration evidence cannot produce a comparable governed duration.',
      { exclusion_reason: normalised.exclusion_reason },
    );
  }
  return {
    witness,
    normalised,
    projection: {
      raw_value: excerpt.exact_text,
      canonical_value: normalised.canonical_value,
      unit: normalised.canonical_unit,
      day_basis: normalised.day_basis,
      denominator: null,
      normalisation_attributes: {
        basis_key: normalised.basis_key,
        trigger: normalised.trigger,
        raw_magnitude: normalised.raw_value.magnitude,
        raw_unit: normalised.raw_value.unit,
        normalisation_payload_digest: normalised.normalisation_payload_digest,
      },
    },
  };
}

function proofBody({ correction, application, predecessor, successor, admitted, expected }) {
  return {
    schema_version: 'CORRECTION_VALUE_EVIDENCE_PROOF/V1',
    proof_rule_version: PROOF_RULE_VERSION,
    correction_id: correction.correction_id,
    correction_application_id: application.correction_application_id,
    claim_occurrence_id: successor.claim_occurrence_id,
    predecessor_claim_revision_id: predecessor.claim_revision_id,
    successor_claim_revision_id: successor.claim_revision_id,
    claim_definition_key: successor.claim_definition_key,
    claim_definition_version: successor.claim_definition_version,
    source_admission_manifest_id: admitted.admission.source_admission_manifest_id,
    document_hash: admitted.source.document_hash,
    operative_evidence: {
      excerpt_id: admitted.excerpt.excerpt_id,
      document_ordinal: admitted.edge.document_ordinal,
      absolute_start: admitted.excerpt.absolute_start,
      absolute_end: admitted.excerpt.absolute_end,
      exact_bytes_digest: admitted.excerpt.exact_bytes_digest,
    },
    duration_witness: {
      magnitude: expected.witness.magnitude,
      raw_unit: expected.witness.raw_unit,
      explicit_day_basis: expected.witness.explicit_day_basis,
      witness_start: expected.witness.witness_start,
      witness_end: expected.witness.witness_end,
    },
    governed_inputs: {
      day_basis: predecessor.day_basis,
      trigger: predecessor.attributes.trigger,
      derivation_version: successor.derivation_version,
    },
    expected_successor_projection: expected.projection,
    expected_successor_projection_digest: contentId(
      'CORRECTION_EXPECTED_SUCCESSOR_PROJECTION/V1',
      expected.projection,
    ),
    normalisation_payload_digest: expected.normalised.normalisation_payload_digest,
    status: 'PASS',
  };
}

function deriveCorrectionValueEvidenceProjection({
  writeSet,
  correction,
  predecessor,
  successor,
  contractBundle,
} = {}) {
  const changedFields = changedValueFields(predecessor, successor);
  if (changedFields.length === 0) return null;
  if (successor.claim_definition_key !== SUPPORTED_DURATION_CLAIM) {
    throw new CorrectionValueEvidenceError(
      'UNSUPPORTED_CORRECTION_VALUE_EVIDENCE',
      'Value-changing corrections are not supported for this claim definition.',
      { claim_definition_key: successor.claim_definition_key, changed_fields: changedFields },
    );
  }
  if (successor.state !== 'PRESENT') {
    throw new CorrectionValueEvidenceError(
      'UNSUPPORTED_CORRECTION_VALUE_EVIDENCE',
      'The supported duration proof requires a PRESENT successor claim.',
    );
  }
  const admitted = resolveOperativeExcerpt({
    writeSet,
    successor,
    contractBundle,
    documentHash: correction.target.document_hash,
  });
  const expected = buildExpectedDurationProjection({ predecessor, successor, excerpt: admitted.excerpt });
  return { changed_fields: changedFields, admitted, expected };
}

function buildCorrectionValueEvidenceProof({
  writeSet,
  correction,
  application,
  predecessor,
  successor,
  contractBundle,
} = {}) {
  const derived = deriveCorrectionValueEvidenceProjection({
    writeSet,
    correction,
    predecessor,
    successor,
    contractBundle,
  });
  if (derived === null) return null;
  const { admitted, expected } = derived;
  const actualProjection = successorProjection(successor);
  if (canonicalJson(actualProjection) !== canonicalJson(expected.projection)) {
    const mismatchedFields = Object.keys(expected.projection).filter((field) => (
      canonicalJson(actualProjection[field]) !== canonicalJson(expected.projection[field])
    ));
    throw new CorrectionValueEvidenceError(
      'CORRECTED_VALUE_EVIDENCE_MISMATCH',
      'The corrected duration does not exactly match the source-derived projection.',
      { mismatched_fields: mismatchedFields },
    );
  }
  const body = proofBody({ correction, application, predecessor, successor, admitted, expected });
  const canonicalPayloadDigest = contentId('CORRECTION_VALUE_EVIDENCE_PROOF_PAYLOAD/V1', body);
  return deepFreeze({
    ...body,
    canonical_payload_digest: canonicalPayloadDigest,
    correction_value_evidence_proof_id: contentId('CORRECTION_VALUE_EVIDENCE_PROOF/V1', {
      ...body,
      canonical_payload_digest: canonicalPayloadDigest,
    }),
  });
}

function validateCorrectionValueEvidenceProof(proof) {
  if (!proof || proof.schema_version !== 'CORRECTION_VALUE_EVIDENCE_PROOF/V1' || proof.status !== 'PASS') {
    throw new CorrectionValueEvidenceError('INVALID_CORRECTION_VALUE_EVIDENCE_PROOF', 'Invalid correction value evidence proof.');
  }
  const {
    canonical_payload_digest: canonicalPayloadDigest,
    correction_value_evidence_proof_id: proofId,
    ...body
  } = proof;
  const expectedPayloadDigest = contentId('CORRECTION_VALUE_EVIDENCE_PROOF_PAYLOAD/V1', body);
  const expectedProofId = contentId('CORRECTION_VALUE_EVIDENCE_PROOF/V1', {
    ...body,
    canonical_payload_digest: expectedPayloadDigest,
  });
  if (canonicalPayloadDigest !== expectedPayloadDigest || proofId !== expectedProofId) {
    throw new CorrectionValueEvidenceError(
      'INVALID_CORRECTION_VALUE_EVIDENCE_PROOF',
      'Correction value evidence proof identity does not match its canonical payload.',
    );
  }
  return true;
}

module.exports = {
  PROOF_RULE_VERSION,
  SUPPORTED_DURATION_CLAIM,
  VALUE_FIELDS,
  CorrectionValueEvidenceError,
  buildCorrectionValueEvidenceProof,
  deriveCorrectionValueEvidenceProjection,
  extractUnambiguousDurationWitness,
  validateCorrectionValueEvidenceProof,
};
