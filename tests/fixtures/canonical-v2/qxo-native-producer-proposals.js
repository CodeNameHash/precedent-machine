/**
 * tests/fixtures/canonical-v2/qxo-native-producer-proposals.js
 *
 * A RECORDED proposal fixture standing in for a live native-producer model
 * call against the QXO capitalisation representation. Every proposal here
 * is pre-compilation: plain data shaped to feed straight into
 * candidate-proposal-compiler.js, mirroring the same claims that
 * lib/canonical-v2/reviewed-qxo-capitalisation-f27.js hand-authors for the
 * clause (i)/(iii) accuracy bring-down, but expressed as PROPOSALS rather
 * than as already-reviewed canonical output.
 *
 * The source text is the real admitted QXO section 3.1(b) capital
 * structure text (tests/fixtures/qxo-section-3-1-b.txt), placed at the
 * same governed CAPITAL_STRUCTURE_INTERVAL / SECTION_5_2_INTERVAL byte
 * offsets used throughout the existing QXO capitalisation tests, so
 * evidence spans here are real, byte-exact offsets into real contract
 * text -- not synthetic placeholders.
 *
 * Included, per the native-producer batch-1 spec:
 *  - 3 valid positive claim proposals with real evidence spans
 *    (two accuracy-standard-shaped claims on clauses (i) and (iii), one
 *    measurement-date-shaped claim), all evidence-backed and PRESENT.
 *  - 1 open-world candidate: a proposition the producer found evidence for
 *    but that does not map onto any known claim_definition_key/taxonomy --
 *    preserved verbatim rather than forced onto the nearest known concept.
 *  - 1 deliberately invalid proposal: otherwise well-formed, but asserts a
 *    taxonomy code outside the supplied codebook, for the isolation test.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const {
  buildExcerpt,
  buildImmutableSource,
  buildProvisionInstance,
  buildSemanticSpan,
} = require('../../../lib/canonical-v2/source-structure');
const { compileFixtureContract } = require('../../../lib/canonical-v2/contract-bundle');
const {
  CAPITAL_STRUCTURE_INTERVAL,
  SECTION_5_2_INTERVAL,
} = require('../../../lib/canonical-v2/reviewed-qxo-capitalisation-slice');
const { QXO_5_2_TEXT } = require('../qxo-section-5-2');

const CAPITAL_TEXT = fs.readFileSync(
  path.join(__dirname, '..', 'qxo-section-3-1-b.txt'),
  'utf8',
);

const REVIEW_VERSION = 'QXO_NATIVE_PRODUCER_FIXTURE/V1';
const REPRESENTATION_PARTY = Object.freeze({
  role: 'REPRESENTATION_MAKER',
  value: 'COMPANY',
  capacity: 'TARGET',
});
const CLAIM_DEFINITION_KEY = 'NATIVE_CAPITALISATION_ACCURACY_CANDIDATE';
const MEASUREMENT_DEFINITION_KEY = 'NATIVE_CAPITALISATION_MEASUREMENT_DATE_CANDIDATE';
const OPEN_WORLD_DEFINITION_KEY = 'OPEN_WORLD_PROPOSITION';
const ACCURACY_CODEBOOKS = Object.freeze({
  accuracy_standard: Object.freeze(['MAT_ALL_RESPECTS_DE_MINIMIS', 'MAT_ALL_MATERIAL']),
});

function buildQxoNativeProducerFixtureSourceText() {
  const chunks = [' '.repeat(CAPITAL_STRUCTURE_INTERVAL.start), CAPITAL_TEXT];
  const afterCapital = CAPITAL_STRUCTURE_INTERVAL.start + Buffer.byteLength(CAPITAL_TEXT, 'utf8');
  if (afterCapital > SECTION_5_2_INTERVAL.start) {
    throw new Error('native-producer fixture source geometry overlaps the governed capitalisation intervals');
  }
  chunks.push(' '.repeat(SECTION_5_2_INTERVAL.start - afterCapital), QXO_5_2_TEXT);
  const afterCondition = SECTION_5_2_INTERVAL.start + Buffer.byteLength(QXO_5_2_TEXT, 'utf8');
  if (afterCondition > SECTION_5_2_INTERVAL.end) {
    throw new Error('native-producer fixture condition text exceeds the governed capitalisation interval');
  }
  chunks.push(' '.repeat(SECTION_5_2_INTERVAL.end - afterCondition));
  return chunks.join('');
}

function buildQxoNativeProducerFixtureSource() {
  return buildImmutableSource({
    sourceBytes: buildQxoNativeProducerFixtureSourceText(),
    sourceKind: 'PLAIN_UTF8',
    sourceOccurrenceKey: 'QXO_NATIVE_PRODUCER_FIXTURE_SOURCE',
  });
}

function locateUnique(bytes, needle, label) {
  const token = Buffer.from(needle, 'utf8');
  const start = bytes.indexOf(token);
  if (start < 0) throw new TypeError(`native-producer fixture selector was not found: ${label}`);
  if (bytes.indexOf(token, start + token.length) >= 0) {
    throw new TypeError(`native-producer fixture selector is ambiguous: ${label}`);
  }
  return start;
}

function excerptFor(source, bytes, needle, label) {
  const start = locateUnique(bytes, needle, label);
  const span = buildSemanticSpan(source, start, start + Buffer.byteLength(needle, 'utf8'));
  return buildExcerpt({ source, span });
}

function evidenceFor(excerpt, role, ordinal = 0) {
  return {
    evidence_role: role,
    excerpt_id: excerpt.excerpt_id,
    document_ordinal: 0,
    absolute_start: excerpt.absolute_start,
    absolute_end: excerpt.absolute_end,
    ordinal,
  };
}

/**
 * @param {object} [args]
 * @param {object} [args.source]          an admitted immutable source; defaults to the
 *                                        real QXO capital-structure/closing-condition text
 * @param {object} [args.contractBundle]  defaults to the frozen fixture contract (governs
 *                                        the concept_key used for the representation subject)
 * @returns {{
 *   source: object,
 *   representationProvision: object,
 *   excerpts: Record<string, object>,
 *   proposals: object[],
 * }}
 */
function buildQxoNativeProducerProposals({
  source = buildQxoNativeProducerFixtureSource(),
  contractBundle = compileFixtureContract(),
} = {}) {
  const bytes = Buffer.from(source.canonical_text.text, 'utf8');

  const representationSpan = buildSemanticSpan(
    source,
    CAPITAL_STRUCTURE_INTERVAL.start,
    CAPITAL_STRUCTURE_INTERVAL.start + Buffer.byteLength(CAPITAL_TEXT, 'utf8'),
  );
  const representationProvision = buildProvisionInstance({
    source,
    span: representationSpan,
    conceptKey: 'REP-T-CAP',
    party: REPRESENTATION_PARTY,
    ordinal: 1,
    contractBundle,
  });

  const excerpts = {
    limb_i: excerptFor(
      source,
      bytes,
      '(i)The authorized capital stock of the Company consists of',
      'limb (i) opening clause',
    ),
    limb_iii: excerptFor(
      source,
      bytes,
      '(iii)Except for any obligations pursuant to this Agreement,',
      'limb (iii) opening clause',
    ),
    measurement_date: excerptFor(
      source,
      bytes,
      'As of April 17, 2026, other than 1,600,514 Company Shares reserved for issuance',
      'capitalisation measurement date anchor',
    ),
    novel_condition: excerptFor(
      source,
      bytes,
      'No Company Material Adverse Effect shall have occurred since the date of this Agreement.',
      'novel closing-condition proposition',
    ),
  };

  const subject = representationProvision.provision_instance_id;

  const clauseIClaim = Object.freeze({
    kind: 'claim',
    proposal_kind: 'GOVERNED',
    subject_occurrence_id: subject,
    claim_definition_key: CLAIM_DEFINITION_KEY,
    ordinal: 0,
    state: 'PRESENT',
    raw_value: excerpts.limb_i.exact_text,
    canonical_value: 'MAT_ALL_RESPECTS_DE_MINIMIS',
    attributes: { comparison_class_key: 'CAPITALISATION_CLAUSE_B_LIMBS_I_III' },
    allowed_attributes: ['comparison_class_key'],
    taxonomy_codes: { accuracy_standard: 'MAT_ALL_RESPECTS_DE_MINIMIS' },
    codebooks: ACCURACY_CODEBOOKS,
    evidence: [evidenceFor(excerpts.limb_i, 'OPERATIVE_TEXT')],
    extraction_version: REVIEW_VERSION,
    normalisation_version: REVIEW_VERSION,
    derivation_version: REVIEW_VERSION,
  });

  const clauseIIIClaim = Object.freeze({
    kind: 'claim',
    proposal_kind: 'GOVERNED',
    subject_occurrence_id: subject,
    claim_definition_key: CLAIM_DEFINITION_KEY,
    ordinal: 1,
    state: 'PRESENT',
    raw_value: excerpts.limb_iii.exact_text,
    canonical_value: 'MAT_ALL_MATERIAL',
    attributes: { comparison_class_key: 'CAPITALISATION_CLAUSE_C_LIMBS_II_IV_V' },
    allowed_attributes: ['comparison_class_key'],
    taxonomy_codes: { accuracy_standard: 'MAT_ALL_MATERIAL' },
    codebooks: ACCURACY_CODEBOOKS,
    evidence: [evidenceFor(excerpts.limb_iii, 'OPERATIVE_TEXT')],
    extraction_version: REVIEW_VERSION,
    normalisation_version: REVIEW_VERSION,
    derivation_version: REVIEW_VERSION,
  });

  const measurementDateClaim = Object.freeze({
    kind: 'claim',
    proposal_kind: 'GOVERNED',
    subject_occurrence_id: subject,
    claim_definition_key: MEASUREMENT_DEFINITION_KEY,
    ordinal: 0,
    state: 'PRESENT',
    raw_value: excerpts.measurement_date.exact_text,
    canonical_value: '2026-04-17',
    unit: 'CALENDAR_DAY',
    attributes: { raw_measurement_date: '2026-04-17' },
    allowed_attributes: ['raw_measurement_date'],
    taxonomy_codes: {},
    codebooks: {},
    evidence: [evidenceFor(excerpts.measurement_date, 'OPERATIVE_TEXT')],
    extraction_version: REVIEW_VERSION,
    normalisation_version: REVIEW_VERSION,
    derivation_version: REVIEW_VERSION,
  });

  // Open-world candidate: real evidence, but no known claim_definition_key
  // or taxonomy fits it -- the fixed closing-condition clause 5.2(a)(iii)
  // isn't among the concepts this fixture's contract governs. Preserved
  // as-is rather than mapped onto the nearest known concept.
  const openWorldCandidate = Object.freeze({
    kind: 'claim',
    proposal_kind: 'OPEN_WORLD',
    subject_occurrence_id: subject,
    claim_definition_key: OPEN_WORLD_DEFINITION_KEY,
    ordinal: 0,
    state: 'PRESENT',
    raw_value: excerpts.novel_condition.exact_text,
    canonical_value: null,
    attributes: { novel_proposition_text: excerpts.novel_condition.exact_text },
    allowed_attributes: ['novel_proposition_text'],
    taxonomy_codes: {},
    codebooks: {},
    evidence: [evidenceFor(excerpts.novel_condition, 'OPERATIVE_TEXT')],
    extraction_version: REVIEW_VERSION,
    normalisation_version: REVIEW_VERSION,
    derivation_version: REVIEW_VERSION,
  });

  // Deliberately invalid: otherwise a well-formed, evidence-backed claim,
  // but it asserts a taxonomy code the supplied codebook does not
  // recognise. buildClaimRevision quarantines this via a typed
  // INVALID_TAXONOMY_CODE residual rather than throwing -- this is the
  // proposal the failure-isolation test expects to be dropped alone.
  const invalidTaxonomyCodeClaim = Object.freeze({
    kind: 'claim',
    proposal_kind: 'GOVERNED',
    subject_occurrence_id: subject,
    claim_definition_key: CLAIM_DEFINITION_KEY,
    ordinal: 2,
    state: 'PRESENT',
    raw_value: excerpts.limb_iii.exact_text,
    canonical_value: 'NOT_A_REAL_CODE',
    attributes: { comparison_class_key: 'CAPITALISATION_CLAUSE_C_LIMBS_II_IV_V' },
    allowed_attributes: ['comparison_class_key'],
    taxonomy_codes: { accuracy_standard: 'NOT_A_REAL_CODE' },
    codebooks: ACCURACY_CODEBOOKS,
    evidence: [evidenceFor(excerpts.limb_iii, 'OPERATIVE_TEXT', 1)],
    extraction_version: REVIEW_VERSION,
    normalisation_version: REVIEW_VERSION,
    derivation_version: REVIEW_VERSION,
  });

  return Object.freeze({
    source,
    representationProvision,
    excerpts: Object.freeze(excerpts),
    proposals: Object.freeze([
      clauseIClaim,
      clauseIIIClaim,
      measurementDateClaim,
      openWorldCandidate,
      invalidTaxonomyCodeClaim,
    ]),
  });
}

module.exports = {
  REVIEW_VERSION,
  CLAIM_DEFINITION_KEY,
  MEASUREMENT_DEFINITION_KEY,
  OPEN_WORLD_DEFINITION_KEY,
  ACCURACY_CODEBOOKS,
  buildQxoNativeProducerFixtureSourceText,
  buildQxoNativeProducerFixtureSource,
  buildQxoNativeProducerProposals,
  excerptFor,
  evidenceFor,
  locateUnique,
};
