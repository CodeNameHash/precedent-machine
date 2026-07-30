const fs = require('node:fs');
const path = require('node:path');

const {
  contentId,
  sha256Hex,
} = require('../../../lib/canonical-v2/canonical-bytes');
const {
  compileFixtureContractV13,
} = require('../../../lib/canonical-v2/contract-bundle');
const {
  buildQxoCapitalisationParserSourceClosureF27,
} = require('../../../lib/canonical-v2/qxo-capitalisation-parser-source-closure-f27');
const {
  CAPITAL_STRUCTURE_INTERVAL,
  SECTION_5_2_INTERVAL,
} = require('../../../lib/canonical-v2/reviewed-qxo-capitalisation-slice');
const {
  QXO_5_2_TEXT,
} = require('../qxo-section-5-2');

const capitalStructureText = fs.readFileSync(
  path.join(__dirname, '..', 'qxo-section-3-1-b.txt'),
  'utf8',
);
const preambleText =
  'This AGREEMENT AND PLAN OF MERGER, dated as of April 18, 2026, '
  + 'by and among QXO, Inc., Titanium Merger Sub and Forward Merger Sub.';

function digest(label) {
  return contentId('QXO_CAPITALISATION_F27_TEST_INPUT/V1', label);
}

function buildSourceContext() {
  const chunks = [
    preambleText,
    ' '.repeat(
      CAPITAL_STRUCTURE_INTERVAL.start
        - Buffer.byteLength(preambleText, 'utf8'),
    ),
    capitalStructureText,
  ];
  const afterCapital =
    CAPITAL_STRUCTURE_INTERVAL.start
      + Buffer.byteLength(capitalStructureText, 'utf8');
  chunks.push(
    ' '.repeat(SECTION_5_2_INTERVAL.start - afterCapital),
    QXO_5_2_TEXT,
  );
  const afterCondition =
    SECTION_5_2_INTERVAL.start
      + Buffer.byteLength(QXO_5_2_TEXT, 'utf8');
  chunks.push(' '.repeat(SECTION_5_2_INTERVAL.end - afterCondition));
  const text = chunks.join('');
  const canonicalTextId = digest(`canonical:${sha256Hex(text)}`);
  return Object.freeze({
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
    document_hash: digest('original-sec-response-bytes'),
    source_byte_length: Buffer.byteLength(text, 'utf8') + 1000,
    canonical_text_id: canonicalTextId,
    canonical_text_sha256: sha256Hex(text),
    canonical_text_byte_length: Buffer.byteLength(text, 'utf8'),
    canonical_text: Object.freeze({
      schema_version: 'ADMITTED_CANONICAL_TEXT_RUNTIME/V1',
      canonical_text_id: canonicalTextId,
      text,
    }),
    admitted_semantic_source_context_id:
      digest(`context:${sha256Hex(text)}`),
  });
}

function buildWriterAdmittedSourceContext() {
  const source = buildSourceContext();
  const sourceOccurrenceKey = contentId(
    'ADMITTED_SOURCE_OCCURRENCE_KEY/V1',
    {
      deal_admission_id: source.deal_admission_id,
      source_ordinal: source.source_ordinal,
      immutable_source_document_id: source.immutable_source_document_id,
    },
  );
  const body = {
    ...source,
    source_occurrence_key: sourceOccurrenceKey,
    source_occurrence_id: contentId('SOURCE_OCCURRENCE/V1', {
      source_content_id: source.source_content_id,
      source_occurrence_key: sourceOccurrenceKey,
    }),
    converter_digest: digest('writer-converter'),
    converter_config_digest: digest('writer-converter-config'),
    source_map_encoding: 'DEFLATE_RAW_CANONICAL_JSON_TUPLES/V1',
    source_map_compressed_sha256: digest('writer-source-map-compressed'),
    source_map_uncompressed_byte_length: 1,
    input_region_count: 1,
    output_mapping_count: 1,
    source_map_digest: digest('writer-source-map'),
    verification_manifest_id: digest('writer-verification'),
  };
  delete body.admitted_semantic_source_context_id;
  return Object.freeze({
    ...body,
    admitted_semantic_source_context_id: contentId(
      'ADMITTED_SEMANTIC_SOURCE_CONTEXT/V1',
      body,
    ),
  });
}

function buildF27Inputs() {
  return Object.freeze({
    sourceContext: buildSourceContext(),
    parserSourceClosure:
      buildQxoCapitalisationParserSourceClosureF27({
        capital_structure_text: capitalStructureText,
        closing_condition_text: QXO_5_2_TEXT,
      }),
    contractBundle: compileFixtureContractV13(),
  });
}

module.exports = {
  buildF27Inputs,
  buildSourceContext,
  buildWriterAdmittedSourceContext,
  capitalStructureText,
  preambleText,
};
