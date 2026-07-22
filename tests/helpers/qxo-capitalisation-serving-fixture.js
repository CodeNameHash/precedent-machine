const fs = require('node:fs');
const path = require('node:path');

const { contentId, sha256Hex } = require('../../lib/canonical-v2/canonical-bytes');
const { compileFixtureContract } = require('../../lib/canonical-v2/contract-bundle');
const {
  CAPITAL_STRUCTURE_INTERVAL,
  SECTION_5_2_INTERVAL,
  buildQxoReviewedCapitalisationSlice,
} = require('../../lib/canonical-v2/reviewed-qxo-capitalisation-slice');
const {
  buildQxoCapitalisationServingSlice,
} = require('../../lib/canonical-v2/qxo-capitalisation-serving-slice');
const { QXO_5_2_TEXT } = require('../fixtures/qxo-section-5-2');

function digest(label) {
  return contentId('QXO_CAPITALISATION_SERVING_ACCEPTANCE_FIXTURE/V1', label);
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}

function buildSourceContext() {
  const capitalText = fs.readFileSync(
    path.join(process.cwd(), 'tests/fixtures/qxo-section-3-1-b.txt'),
    'utf8',
  );
  const pieces = [' '.repeat(CAPITAL_STRUCTURE_INTERVAL.start), capitalText];
  const capitalEnd = CAPITAL_STRUCTURE_INTERVAL.start + Buffer.byteLength(capitalText, 'utf8');
  pieces.push(' '.repeat(SECTION_5_2_INTERVAL.start - capitalEnd), QXO_5_2_TEXT);
  const conditionEnd = SECTION_5_2_INTERVAL.start + Buffer.byteLength(QXO_5_2_TEXT, 'utf8');
  pieces.push(' '.repeat(SECTION_5_2_INTERVAL.end - conditionEnd));
  const text = pieces.join('');
  const canonicalTextId = digest(`canonical:${sha256Hex(text)}`);
  return freeze({
    schema_version: 'ADMITTED_SEMANTIC_SOURCE_CONTEXT/V1',
    governed_deal_key: 'deal:qxo-topbuild',
    deal_admission_id: digest('deal-admission'),
    source_ordinal: 0,
    immutable_source_document_id: digest('immutable-source'),
    source_admission_manifest_id: digest('source-admission'),
    semantic_extraction_input_envelope_id: digest('semantic-envelope'),
    source_content_id: digest('source-content'),
    source_occurrence_id: digest('source-occurrence'),
    source_occurrence_key: digest('source-occurrence-key'),
    source_kind: 'ORIGINAL_BYTES',
    document_hash: digest('original-response-bytes'),
    source_byte_length: Buffer.byteLength(text, 'utf8') + 1000,
    canonical_text_id: canonicalTextId,
    canonical_text_sha256: sha256Hex(text),
    canonical_text_byte_length: Buffer.byteLength(text, 'utf8'),
    canonical_text: {
      schema_version: 'ADMITTED_CANONICAL_TEXT_RUNTIME/V1',
      canonical_text_id: canonicalTextId,
      text,
    },
    admitted_semantic_source_context_id: digest(`context:${sha256Hex(text)}`),
  });
}

function buildQxoCapitalisationServingFixture() {
  const contractBundle = compileFixtureContract();
  const corpusReleaseId = digest('candidate-release');
  const servingNamespaceId = digest('serving-namespace');
  const sourceContext = buildSourceContext();
  const slice = buildQxoReviewedCapitalisationSlice({
    sourceContext,
    contractBundle,
    corpusReleaseId,
  });
  const serving = buildQxoCapitalisationServingSlice({
    sourceContext,
    slice,
    contractBundle,
    corpusReleaseId,
    servingNamespaceId,
    dealDimensions: {
      buyer: 'QXO',
      merger_form: 'Merger',
      announce_year: 2025,
    },
  });
  return freeze({
    contractBundle,
    corpusReleaseId,
    servingNamespaceId,
    sourceContext,
    slice,
    serving,
  });
}

module.exports = { buildQxoCapitalisationServingFixture };
