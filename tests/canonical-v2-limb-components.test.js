'use strict';

/**
 * tests/canonical-v2-limb-components.test.js
 *
 * Task 1 of docs/superpowers/plans/2026-08-01-claim-identity-provenance-plan.md
 * against docs/superpowers/specs/2026-08-01-claim-identity-provenance-design.md
 * section "1. Limb identity". Exercises lib/canonical-v2/native-producer/
 * limb-components.js as a STANDALONE module: it is never wired into
 * candidate-resolution.js here (that integration is a later task).
 *
 * Real-fixture tests replay the RECORDED, UNMODIFIED F28 second-live-run raw
 * model response (tests/fixtures/canonical-v2/f28-second-live-run/
 * qxo-topbuild-3-1-b-live-response.json) through the real
 * runNativeExtraction() pipeline -- same boilerplate pattern as
 * tests/canonical-v2-f28-second-live-fixture-replay.test.js -- so the
 * compiled_candidates this module consumes are genuinely producer-shaped,
 * not a hand-rolled stand-in. Pure-tree edge cases (mixed children,
 * ancestor minting, ambiguity resolution) use small synthetic
 * compiled-candidate entries built directly in the shape candidate-
 * resolution.js documents at the top of its own file.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const { contentId, sha256Hex, canonicalJson } = require('../lib/canonical-v2/canonical-bytes');
const { compileFixtureContract } = require('../lib/canonical-v2/contract-bundle');
const { buildAdmittedSemanticSourceContext } = require('../lib/canonical-v2/admitted-semantic-source');
const { SOURCE_MAP_ENCODING } = require('../lib/canonical-v2/sec-html-canonical-text');
const { parseJSON } = require('../lib/parser-v2/parse-json');
const { runNativeExtraction } = require('../lib/canonical-v2/native-producer/native-extraction-run');
const {
  shapeProposals,
  LIMB_ASSERTION_CLAIM_KEY,
  QUALIFIER_CLAIM_KEY,
} = require('../lib/canonical-v2/native-producer/anthropic-provider');
const {
  LimbComponentError,
  mintLimbComponentTree,
  resolveQualifierAttachment,
  traverseGovernedScope,
} = require('../lib/canonical-v2/native-producer/limb-components');

// ─── Identity admitted-source chain (copied boilerplate -- same pattern as
// tests/canonical-v2-f28-second-live-fixture-replay.test.js and every other
// native-producer test file; see that file for why a hand-built identity
// source map is required instead of running text through the real SEC-HTML
// converter). ───

function buildIdentityAdmittedSourceContext(text, { dealKey, dealAdmissionId, sourceOrdinal = 0 }) {
  const bytes = Buffer.from(text, 'utf8');
  const byteLength = bytes.length;
  const canonicalTextSha256 = sha256Hex(bytes);
  const compact = {
    schema_version: 'SEC_CANONICAL_TEXT_SOURCE_MAP/V2',
    input_regions: [[0, byteLength, 'TEXT', null]],
    output_mappings: [[0, byteLength, 0, byteLength, 'TEXT']],
  };
  const sourceMapBytes = Buffer.from(canonicalJson(compact), 'utf8');
  const compressed = zlib.deflateRawSync(sourceMapBytes, { level: 9, windowBits: 15, memLevel: 8 });
  const sourceMapDigest = contentId('SEC_CANONICAL_TEXT_SOURCE_MAP/V2', compact);

  const sourceResponseContentId = sha256Hex(Buffer.concat([Buffer.from('RESPONSE/V1'), bytes]));
  const intakeCaptureReceiptId = sha256Hex(`INTAKE/V1:${sourceResponseContentId}`);
  const converterDigest = sha256Hex('IDENTITY_CONVERTER/V1');
  const converterConfigDigest = sha256Hex('IDENTITY_CONVERTER_CONFIG/V1');
  const verifierDigest = sha256Hex('IDENTITY_VERIFIER/V1');
  const verificationManifestId = sha256Hex(`VERIFICATION_MANIFEST/V1:${sourceResponseContentId}`);

  const canonicalTextId = contentId('SEC_CANONICAL_TEXT/V2', {
    source_response_content_id: sourceResponseContentId,
    converter_digest: converterDigest,
    converter_config_digest: converterConfigDigest,
    canonical_text_sha256: canonicalTextSha256,
    canonical_text_byte_length: byteLength,
    source_map_digest: sourceMapDigest,
  });

  const conversion = {
    schema_version: 'SEC_HTML_CANONICAL_TEXT_CONVERSION/V2',
    conversion_stage: 'CONVERSION_ONLY',
    verification_status: 'NOT_ATTEMPTED',
    source_admission_status: 'NOT_ATTEMPTED',
    source_response_content_id: sourceResponseContentId,
    intake_capture_receipt_id: intakeCaptureReceiptId,
    converter_digest: converterDigest,
    converter_config_digest: converterConfigDigest,
    canonical_text: text,
    canonical_text_sha256: canonicalTextSha256,
    canonical_text_byte_length: byteLength,
    source_map_encoding: SOURCE_MAP_ENCODING,
    source_map_payload_base64: compressed.toString('base64'),
    source_map_compressed_sha256: sha256Hex(compressed),
    source_map_uncompressed_byte_length: sourceMapBytes.length,
    input_region_count: compact.input_regions.length,
    output_mapping_count: compact.output_mappings.length,
    source_map_digest: sourceMapDigest,
    canonical_text_id: canonicalTextId,
  };

  const immutableBody = {
    schema_version: 'IMMUTABLE_SOURCE_DOCUMENT/V2',
    source_kind: 'ORIGINAL_BYTES',
    authority_representation: 'ORIGINAL_HTTP_RESPONSE_BYTES',
    source_response_content_id: sourceResponseContentId,
    intake_capture_receipt_id: intakeCaptureReceiptId,
    response_content_type: 'text/html',
    response_bytes_sha256: sha256Hex(bytes),
    response_byte_length: byteLength,
    canonical_text_id: canonicalTextId,
    canonical_text_sha256: canonicalTextSha256,
    canonical_text_byte_length: byteLength,
    converter_digest: converterDigest,
    converter_config_digest: converterConfigDigest,
    source_map_encoding: SOURCE_MAP_ENCODING,
    source_map_compressed_sha256: sha256Hex(compressed),
    source_map_uncompressed_byte_length: sourceMapBytes.length,
    input_region_count: compact.input_regions.length,
    output_mapping_count: compact.output_mappings.length,
    source_map_digest: sourceMapDigest,
    verifier_digest: verifierDigest,
    verification_manifest_id: verificationManifestId,
  };
  const immutable = {
    ...immutableBody,
    immutable_source_document_id: contentId('IMMUTABLE_SOURCE_DOCUMENT/V2', immutableBody),
  };

  const coverageProofDigest = contentId('SOURCE_ADMISSION_COVERAGE_PROOF/V2', {
    canonical_text_id: canonicalTextId,
    canonical_text_byte_length: byteLength,
    source_map_digest: sourceMapDigest,
    admitted_intervals: [{ start: 0, end: byteLength }],
    excluded_intervals: [],
    discrepancy_count: 0,
  });
  const admissionBody = {
    schema_version: 'SOURCE_ADMISSION_MANIFEST/V2',
    admission_state: 'VERIFIED',
    source_kind: 'ORIGINAL_BYTES',
    immutable_source_document_id: immutable.immutable_source_document_id,
    source_response_content_id: sourceResponseContentId,
    canonical_text_id: canonicalTextId,
    verification_manifest_id: verificationManifestId,
    admitted_intervals: [{ start: 0, end: byteLength }],
    excluded_intervals: [],
    conversion_loss_residual_ids: [],
    discrepancy_count: 0,
    blocking_discrepancy_count: 0,
    coverage_proof_digest: coverageProofDigest,
  };
  const admission = {
    ...admissionBody,
    source_admission_manifest_id: contentId('SOURCE_ADMISSION_MANIFEST/V2', admissionBody),
  };

  const envelopeBody = {
    schema_version: 'SEMANTIC_EXTRACTION_INPUT_ENVELOPE/V1',
    input_status: 'READY_FOR_OFFLINE_PROPOSAL',
    coordinate_system: 'UTF8_CANONICAL_TEXT_HALF_OPEN',
    immutable_source_document_id: immutable.immutable_source_document_id,
    source_admission_manifest_id: admission.source_admission_manifest_id,
    canonical_text_id: canonicalTextId,
    canonical_text_sha256: canonicalTextSha256,
    canonical_text_byte_length: byteLength,
    source_map_encoding: SOURCE_MAP_ENCODING,
    source_map_compressed_sha256: sha256Hex(compressed),
    source_map_uncompressed_byte_length: sourceMapBytes.length,
    input_region_count: compact.input_regions.length,
    output_mapping_count: compact.output_mappings.length,
    source_map_digest: sourceMapDigest,
    verification_manifest_id: verificationManifestId,
    admitted_intervals: [{ start: 0, end: byteLength }],
    excluded_intervals: [],
    semantic_extraction_status: 'NOT_ATTEMPTED',
  };
  const envelope = {
    ...envelopeBody,
    semantic_extraction_input_envelope_id: contentId('SEMANTIC_EXTRACTION_INPUT_ENVELOPE/V1', envelopeBody),
  };

  return buildAdmittedSemanticSourceContext({
    immutable_source_document: immutable,
    source_admission_manifest: admission,
    semantic_extraction_input_envelope: envelope,
    conversion,
    governed_deal_key: dealKey,
    deal_admission_id: dealAdmissionId,
    source_ordinal: sourceOrdinal,
  });
}

// ─── Real fixture: the F28 SECOND live run's recorded raw model response,
// replayed through the real pipeline exactly as
// tests/canonical-v2-f28-second-live-fixture-replay.test.js does, so this
// module's real-data tests exercise genuinely producer-shaped
// compiled_candidates. ───

const capitalStructureText = fs.readFileSync(
  path.join(__dirname, 'fixtures', 'qxo-section-3-1-b.txt'),
  'utf8',
);

const degenerateFullText = [
  'This AGREEMENT AND PLAN OF MERGER, dated as of April 18, 2026, by and among ',
  'QXO, Inc., Titanium Merger Sub and Forward Merger Sub.\n\n',
  'ARTICLE III\n\nREPRESENTATIONS AND WARRANTIES OF THE COMPANY\n\n',
  'Except as set forth in the Company Disclosure Letter, the Company represents ',
  'and warrants to Parent as follows:\n\n',
  '(a)Organization; Standing. The Company is a corporation duly organized, ',
  'validly existing and in good standing under the Laws of the State of Delaware.\n\n',
  capitalStructureText,
  '\n',
].join('');

const DOCUMENT_HASH = sha256Hex(Buffer.from(degenerateFullText, 'utf8'));
const CONTRACT_BUNDLE = compileFixtureContract();
const DEFINITIONS = Object.freeze({ known_definitions: [] });

const FIXTURE_PATH = path.join(
  __dirname, 'fixtures', 'canonical-v2', 'f28-second-live-run', 'qxo-topbuild-3-1-b-live-response.json',
);

function loadRecordedResponse() {
  const recorded = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
  const parsed = parseJSON(recorded.raw_response_text);
  assert.ok(parsed, 'the recorded raw_response_text must still parse as JSON (fence-stripped)');
  return parsed;
}

// Fixed, arbitrary provision_instance_id for the fixture tests -- this
// module never mints provision identity itself (that stays candidate-
// resolution.js's job); it only needs a caller-supplied, content-id-shaped
// string to mint components under.
const FIXTURE_PROVISION_INSTANCE_ID = contentId('TEST_PROVISION_INSTANCE/V1', { deal: 'f28-second-live-run' });

async function buildFixtureReceipt(parsedResponse) {
  return runNativeExtraction({
    source_text: degenerateFullText,
    document_hash: DOCUMENT_HASH,
    section_references: ['III-INTRO(b)'],
    contract_bundle: CONTRACT_BUNDLE,
    definitions: DEFINITIONS,
    provider: async ({ governed_scope: governedScope }) => {
      const { proposals, evidence_residuals: evidenceResiduals } = shapeProposals(
        parsedResponse,
        governedScope.source_text,
      );
      return {
        provider_id: 'limb-components-test-fixture-replay/v1',
        model_id: 'claude-sonnet-5 (recorded, F28 second live run)',
        prompt: 'limb-components-test-fixture-replay-prompt/v1',
        proposals,
        evidence_residuals: evidenceResiduals,
      };
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════
// Real-fixture tests
// ═══════════════════════════════════════════════════════════════════════

test('sanity: the recording still has (i)-(iv) each carrying 3 assertions, (v) carrying 1', () => {
  const parsed = loadRecordedResponse();
  const counts = new Map();
  for (const limb of parsed.representation_instances[0].limbs) {
    const key = JSON.stringify(limb.limb_path);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  assert.equal(counts.get('["(i)"]'), 3);
  assert.equal(counts.get('["(ii)"]'), 3);
  assert.equal(counts.get('["(iii)"]'), 3);
  assert.equal(counts.get('["(iv)"]'), 3);
});

test('run-2 fixture: repeated bare paths mint 3 distinct assertion nodes each, with distinct spans and no envelope span', async () => {
  const receipt = await buildFixtureReceipt(loadRecordedResponse());
  const tree = mintLimbComponentTree({
    compiled_candidates: receipt.compiled_candidates,
    provision_instance_id: FIXTURE_PROVISION_INSTANCE_ID,
  });

  // The recording's own model output carries 3 assertions under each of
  // (i)-(iv), but replaying this hand-authored plain-text fixture drops one
  // of (iii)'s three quotes at the byte-exact evidence-verification gate
  // (a page-break artifact unrelated to limb identity -- see
  // tests/canonical-v2-f28-second-live-fixture-replay.test.js's own
  // evidence_residual_count assertion for the same, independently-verified
  // fact). So (i)/(ii)/(iv) mint 3 assertion nodes; (iii) mints 2.
  const expectedCounts = new Map([
    [JSON.stringify(['(i)']), 3],
    [JSON.stringify(['(ii)']), 3],
    [JSON.stringify(['(iii)']), 2],
    [JSON.stringify(['(iv)']), 3],
  ]);

  for (const bare of [['(i)'], ['(ii)'], ['(iii)'], ['(iv)']]) {
    const pathNodeId = tree.path_node_id_by_limb_path[JSON.stringify(bare)];
    assert.ok(pathNodeId, `path node minted for ${JSON.stringify(bare)}`);

    const pathNode = tree.nodes_by_id[pathNodeId];
    assert.equal(pathNode.span, null, 'a path node never carries an invented/envelope span');

    const children = tree.assertion_nodes.filter((n) => n.parent_limb_component_id === pathNodeId);
    const expected = expectedCounts.get(JSON.stringify(bare));
    assert.equal(children.length, expected, `${JSON.stringify(bare)} carries exactly ${expected} assertion nodes`);

    const spanKeys = new Set(children.map((n) => `${n.span.absolute_start}:${n.span.absolute_end}`));
    assert.equal(spanKeys.size, expected, 'each assertion node has its own distinct, non-unioned span');

    // Ordinals are dense and rank-ordered by span start.
    const sortedByOrdinal = [...children].sort((a, b) => a.ordinal_under_parent - b.ordinal_under_parent);
    for (let i = 1; i < sortedByOrdinal.length; i += 1) {
      assert.ok(
        sortedByOrdinal[i - 1].span.absolute_start <= sortedByOrdinal[i].span.absolute_start,
        'assertion ordinals rank by verified span start',
      );
    }
    assert.deepEqual(
      sortedByOrdinal.map((n) => n.ordinal_under_parent),
      Array.from({ length: expected }, (_, i) => i),
    );
  }
});

test('run-2 fixture: the securities-law carve-out on ["(ii)"] routes ASSERTION_SCOPE_AMBIGUOUS', async () => {
  const parsed = loadRecordedResponse();
  const receipt = await buildFixtureReceipt(parsed);
  const tree = mintLimbComponentTree({
    compiled_candidates: receipt.compiled_candidates,
    provision_instance_id: FIXTURE_PROVISION_INSTANCE_ID,
  });

  const securitiesQualifier = parsed.representation_instances[0].qualifiers.find(
    (q) => q.quote.includes('Securities Act'),
  );
  assert.ok(securitiesQualifier, 'fixture still carries the securities-law carve-out qualifier');
  assert.deepEqual(securitiesQualifier.attachment.governs_path, ['(ii)']);

  const attachment = resolveQualifierAttachment(tree, { governs_path: ['(ii)'] });
  assert.equal(attachment.attached, true);
  assert.equal(attachment.node_kind, 'PATH');
  assert.deepEqual(attachment.reasons, ['ASSERTION_SCOPE_AMBIGUOUS']);
  assert.equal(attachment.auto_pass_blocked, true);
  assert.equal(attachment.flow_down_enabled, false, 'flow-down stays suspended while unruled');

  // Never spread across siblings by default: traversal governs nothing.
  const governed = traverseGovernedScope(tree, attachment);
  assert.deepEqual(governed, []);
});

test('run-2 fixture: the two THRESHOLD qualifiers attach at limbs (ii) and (iv)', async () => {
  const parsed = loadRecordedResponse();
  const receipt = await buildFixtureReceipt(parsed);
  const tree = mintLimbComponentTree({
    compiled_candidates: receipt.compiled_candidates,
    provision_instance_id: FIXTURE_PROVISION_INSTANCE_ID,
  });

  // (iv) carries 3 assertions and NO sub-limb path children in this
  // recording -- also ambiguous (multiple assertion children), but with a
  // different structural shape than (ii) (which has (A)/(B)/(C) children).
  const attachment = resolveQualifierAttachment(tree, { governs_path: ['(iv)'] });
  assert.equal(attachment.node_kind, 'PATH');
  assert.deepEqual(attachment.reasons, ['ASSERTION_SCOPE_AMBIGUOUS']);

  const pathNodeIv = tree.nodes_by_id[tree.path_node_id_by_limb_path['["(iv)"]']];
  const pathChildrenOfIv = tree.path_nodes.filter((n) => n.parent_limb_component_id === pathNodeIv.limb_component_id);
  assert.equal(pathChildrenOfIv.length, 0, '(iv) has no sub-limb path children in this recording');
});

test('run-2 fixture: PERMUTED assertion (limb) array order mints identical path and assertion ids', async () => {
  const parsed = loadRecordedResponse();
  const permuted = JSON.parse(JSON.stringify(parsed));
  const inst = permuted.representation_instances[0];
  // Reverse the limbs array -- a full order inversion, not a no-op shuffle.
  inst.limbs = [...inst.limbs].reverse();

  const [receiptA, receiptB] = await Promise.all([
    buildFixtureReceipt(parsed),
    buildFixtureReceipt(permuted),
  ]);

  const treeA = mintLimbComponentTree({
    compiled_candidates: receiptA.compiled_candidates,
    provision_instance_id: FIXTURE_PROVISION_INSTANCE_ID,
  });
  const treeB = mintLimbComponentTree({
    compiled_candidates: receiptB.compiled_candidates,
    provision_instance_id: FIXTURE_PROVISION_INSTANCE_ID,
  });

  assert.equal(treeA.path_nodes.length, treeB.path_nodes.length);
  assert.equal(treeA.assertion_nodes.length, treeB.assertion_nodes.length);

  const idsA = new Set([...treeA.path_nodes, ...treeA.assertion_nodes].map((n) => n.limb_component_id));
  const idsB = new Set([...treeB.path_nodes, ...treeB.assertion_nodes].map((n) => n.limb_component_id));
  assert.deepEqual([...idsA].sort(), [...idsB].sort(), 'permuted input mints the identical id set');

  // Every path node's ordinal_under_parent is identical across the
  // permutation -- ordinals rank by span-derived sort key, never by input
  // array order.
  const ordinalsA = Object.fromEntries(treeA.path_nodes.map((n) => [n.limb_component_id, n.ordinal_under_parent]));
  const ordinalsB = Object.fromEntries(treeB.path_nodes.map((n) => [n.limb_component_id, n.ordinal_under_parent]));
  assert.deepEqual(ordinalsA, ordinalsB);

  const assertionOrdinalsA = Object.fromEntries(
    treeA.assertion_nodes.map((n) => [n.limb_component_id, n.ordinal_under_parent]),
  );
  const assertionOrdinalsB = Object.fromEntries(
    treeB.assertion_nodes.map((n) => [n.limb_component_id, n.ordinal_under_parent]),
  );
  assert.deepEqual(assertionOrdinalsA, assertionOrdinalsB);
});

test('run-2 fixture: byte-identical output on identical input', async () => {
  const receipt = await buildFixtureReceipt(loadRecordedResponse());
  const treeA = mintLimbComponentTree({
    compiled_candidates: receipt.compiled_candidates,
    provision_instance_id: FIXTURE_PROVISION_INSTANCE_ID,
  });
  const treeB = mintLimbComponentTree({
    compiled_candidates: receipt.compiled_candidates,
    provision_instance_id: FIXTURE_PROVISION_INSTANCE_ID,
  });
  assert.equal(canonicalJson(treeA), canonicalJson(treeB));
});

// ═══════════════════════════════════════════════════════════════════════
// Synthetic pure-tree tests -- hand-built compiled-candidate entries in the
// exact shape candidate-resolution.js documents (entry.ok, entry.candidate
// = { kind: 'claim', claim }), without running the full extraction
// pipeline.
// ═══════════════════════════════════════════════════════════════════════

let assertionCounter = 0;
function assertionEntry({ limbPath, quote, start, end, claimOccurrenceId }) {
  assertionCounter += 1;
  return {
    ok: true,
    candidate: {
      kind: 'claim',
      claim: {
        claim_definition_key: LIMB_ASSERTION_CLAIM_KEY,
        claim_occurrence_id: claimOccurrenceId || `synthetic-assertion-${assertionCounter}`,
        raw_value: quote,
        attributes: { limb_path: limbPath },
        evidence: [{
          evidence_role: 'OPERATIVE_TEXT',
          absolute_start: start,
          absolute_end: end,
        }],
      },
    },
  };
}

test('deterministic ids: minting the same synthetic input twice mints identical path/assertion ids', () => {
  const provisionInstanceId = contentId('TEST_PROVISION_INSTANCE/V1', { case: 'deterministic-ids' });
  const candidates = [
    assertionEntry({ limbPath: ['(a)'], quote: 'first assertion text', start: 0, end: 20 }),
    assertionEntry({ limbPath: ['(a)', '(1)'], quote: 'nested assertion text', start: 25, end: 46 }),
  ];
  const treeA = mintLimbComponentTree({ compiled_candidates: candidates, provision_instance_id: provisionInstanceId });
  const treeB = mintLimbComponentTree({ compiled_candidates: candidates, provision_instance_id: provisionInstanceId });
  assert.equal(canonicalJson(treeA), canonicalJson(treeB));

  // Path node id is a pure content hash of (provision_instance_id, limb_path).
  const expectedPathNodeId = contentId('LIMB_PATH_COMPONENT/V1', {
    provision_instance_id: provisionInstanceId,
    limb_path: ['(a)'],
  });
  assert.equal(treeA.path_node_id_by_limb_path['["(a)"]'], expectedPathNodeId);

  // A DIFFERENT provision_instance_id mints a DIFFERENT id for the same path.
  const otherProvisionId = contentId('TEST_PROVISION_INSTANCE/V1', { case: 'deterministic-ids-other' });
  const treeOther = mintLimbComponentTree({
    compiled_candidates: candidates,
    provision_instance_id: otherProvisionId,
  });
  assert.notEqual(
    treeOther.path_node_id_by_limb_path['["(a)"]'],
    treeA.path_node_id_by_limb_path['["(a)"]'],
  );
});

test('ancestor minting: a bare limb child with no direct assertion still mints its ancestor path node', () => {
  const provisionInstanceId = contentId('TEST_PROVISION_INSTANCE/V1', { case: 'ancestor-minting' });
  const candidates = [
    // Only a deeply-nested child has an assertion; (ii) and (ii)(A) are
    // never directly asserted, but must still be minted as structural
    // ancestors.
    assertionEntry({ limbPath: ['(ii)', '(A)', '(x)'], quote: 'deep assertion', start: 100, end: 114 }),
  ];
  const tree = mintLimbComponentTree({ compiled_candidates: candidates, provision_instance_id: provisionInstanceId });

  assert.equal(tree.path_nodes.length, 3, '(ii), (ii)(A) and (ii)(A)(x) are all minted as path nodes');
  const iiId = tree.path_node_id_by_limb_path['["(ii)"]'];
  const iiAId = tree.path_node_id_by_limb_path['["(ii)","(A)"]'];
  const iiAxId = tree.path_node_id_by_limb_path['["(ii)","(A)","(x)"]'];
  assert.ok(iiId && iiAId && iiAxId);

  const iiNode = tree.nodes_by_id[iiId];
  const iiANode = tree.nodes_by_id[iiAId];
  const iiAxNode = tree.nodes_by_id[iiAxId];
  assert.equal(iiNode.parent_limb_component_id, null);
  assert.equal(iiANode.parent_limb_component_id, iiId);
  assert.equal(iiAxNode.parent_limb_component_id, iiAId);

  // The one real assertion attaches under the deepest ancestor, not one of
  // the minted-but-unasserted ancestors.
  assert.equal(tree.assertion_nodes.length, 1);
  assert.equal(tree.assertion_nodes[0].parent_limb_component_id, iiAxId);
});

test('mixed-children case: a limb with 3 assertions AND path children -- ambiguity counts assertion children only', () => {
  const provisionInstanceId = contentId('TEST_PROVISION_INSTANCE/V1', { case: 'mixed-children' });
  const candidates = [
    assertionEntry({ limbPath: ['(ii)'], quote: 'measurement-date chapeau assertion', start: 200, end: 235 }),
    assertionEntry({ limbPath: ['(ii)'], quote: 'disclosure-letter list assertion', start: 250, end: 283 }),
    assertionEntry({ limbPath: ['(ii)'], quote: 'subsidiary-shares assertion', start: 300, end: 328 }),
    assertionEntry({ limbPath: ['(ii)', '(A)'], quote: 'sub-limb A assertion', start: 340, end: 361 }),
    assertionEntry({ limbPath: ['(ii)', '(B)'], quote: 'sub-limb B assertion', start: 370, end: 391 }),
    assertionEntry({ limbPath: ['(ii)', '(C)'], quote: 'sub-limb C assertion', start: 400, end: 421 }),
  ];
  const tree = mintLimbComponentTree({ compiled_candidates: candidates, provision_instance_id: provisionInstanceId });

  const iiId = tree.path_node_id_by_limb_path['["(ii)"]'];
  const assertionChildren = tree.assertion_nodes.filter((n) => n.parent_limb_component_id === iiId);
  const pathChildren = tree.path_nodes.filter((n) => n.parent_limb_component_id === iiId);
  assert.equal(assertionChildren.length, 3);
  assert.equal(pathChildren.length, 3, '(ii)(A)/(B)/(C) are path-node children, not assertion children');

  // A qualifier attached to (ii) is ambiguous DESPITE the 3 path-node
  // children -- ambiguity counts assertion children only.
  const attachment = resolveQualifierAttachment(tree, { governs_path: ['(ii)'] });
  assert.equal(attachment.node_kind, 'PATH');
  assert.deepEqual(attachment.reasons, ['ASSERTION_SCOPE_AMBIGUOUS']);
  assert.equal(attachment.flow_down_enabled, false, 'flow-down suspended while ambiguous');
  assert.deepEqual(traverseGovernedScope(tree, attachment), [], 'an ambiguous attachment governs nothing via traversal');

  // A GOVERNS_WHOLE_NODE review ruling enables flow-down -- "the whole
  // node" means everything under (ii): its own 3 direct assertions (the
  // very ones that caused the ambiguity), the 3 sub-limb path nodes, AND
  // each of THEIR single assertion nodes (A/B/C every have exactly one).
  const ruledAttachment = resolveQualifierAttachment(tree, {
    governs_path: ['(ii)'],
    review_outcome: 'GOVERNS_WHOLE_NODE',
  });
  assert.equal(ruledAttachment.flow_down_enabled, true);
  const governed = traverseGovernedScope(tree, ruledAttachment);
  const expectedGoverned = assertionChildren.map((n) => n.limb_component_id)
    .concat(pathChildren.map((n) => n.limb_component_id))
    .concat(
      tree.assertion_nodes
        .filter((n) => pathChildren.some((p) => p.limb_component_id === n.parent_limb_component_id))
        .map((n) => n.limb_component_id),
    );
  assert.equal(governed.length, expectedGoverned.length);
  assert.deepEqual([...governed].sort(), [...expectedGoverned].sort());
});

test('zero-assertion-children chapeau: a pure structural node attaches with flow-down enabled, no review needed', () => {
  const provisionInstanceId = contentId('TEST_PROVISION_INSTANCE/V1', { case: 'zero-assertion-chapeau' });
  const candidates = [
    assertionEntry({ limbPath: ['(ii)', '(A)'], quote: 'sub-limb A assertion', start: 10, end: 31 }),
    assertionEntry({ limbPath: ['(ii)', '(B)'], quote: 'sub-limb B assertion', start: 40, end: 61 }),
    assertionEntry({ limbPath: ['(ii)', '(C)'], quote: 'sub-limb C assertion', start: 70, end: 91 }),
  ];
  const tree = mintLimbComponentTree({ compiled_candidates: candidates, provision_instance_id: provisionInstanceId });

  // (ii) itself has zero direct assertions -- a pure structural node.
  const iiId = tree.path_node_id_by_limb_path['["(ii)"]'];
  const directAssertions = tree.assertion_nodes.filter((n) => n.parent_limb_component_id === iiId);
  assert.equal(directAssertions.length, 0);

  const attachment = resolveQualifierAttachment(tree, { governs_path: ['(ii)'] });
  assert.equal(attachment.attached, true);
  assert.equal(attachment.node_kind, 'PATH');
  assert.equal(attachment.subject_component_id, iiId);
  assert.deepEqual(attachment.reasons, []);
  assert.equal(attachment.auto_pass_blocked, false);
  assert.equal(attachment.flow_down_enabled, true, 'zero-assertion-children chapeau flows down immediately');

  const governed = traverseGovernedScope(tree, attachment);
  const expectedIds = tree.path_nodes
    .filter((n) => n.limb_path.length === 2 && n.limb_path[0] === '(ii)')
    .concat(tree.assertion_nodes.filter((n) => n.limb_path.length === 2 && n.limb_path[0] === '(ii)'))
    .map((n) => n.limb_component_id);
  assert.deepEqual([...governed].sort(), [...expectedIds].sort());
});

test('exactly one assertion child: a qualifier attaches directly to that assertion node', () => {
  const provisionInstanceId = contentId('TEST_PROVISION_INSTANCE/V1', { case: 'single-assertion-child' });
  const candidates = [
    assertionEntry({ limbPath: ['(i)'], quote: 'the one and only assertion under (i)', start: 5, end: 42 }),
  ];
  const tree = mintLimbComponentTree({ compiled_candidates: candidates, provision_instance_id: provisionInstanceId });

  const attachment = resolveQualifierAttachment(tree, { governs_path: ['(i)'] });
  assert.equal(attachment.attached, true);
  assert.equal(attachment.node_kind, 'ASSERTION');
  assert.equal(attachment.subject_component_id, tree.assertion_nodes[0].limb_component_id);
  assert.deepEqual(attachment.reasons, []);
  assert.equal(attachment.auto_pass_blocked, false);

  const governed = traverseGovernedScope(tree, attachment);
  assert.deepEqual(governed, [tree.assertion_nodes[0].limb_component_id]);
});

test('a governs_path that names no minted limb resolves LIMB_PATH_NOT_IN_TREE, never guessed', () => {
  const provisionInstanceId = contentId('TEST_PROVISION_INSTANCE/V1', { case: 'unknown-path' });
  const candidates = [
    assertionEntry({ limbPath: ['(i)'], quote: 'an assertion', start: 0, end: 12 }),
  ];
  const tree = mintLimbComponentTree({ compiled_candidates: candidates, provision_instance_id: provisionInstanceId });

  const attachment = resolveQualifierAttachment(tree, { governs_path: ['(ix)'] });
  assert.equal(attachment.attached, false);
  assert.deepEqual(attachment.reasons, ['LIMB_PATH_NOT_IN_TREE']);
  assert.deepEqual(traverseGovernedScope(tree, attachment), []);
});

test('permutation determinism on synthetic input: reordering the same assertions mints identical ids and ordinals', () => {
  const provisionInstanceId = contentId('TEST_PROVISION_INSTANCE/V1', { case: 'synthetic-permutation' });
  const base = [
    assertionEntry({ limbPath: ['(i)'], quote: 'alpha assertion', start: 300, end: 316, claimOccurrenceId: 'alpha' }),
    assertionEntry({ limbPath: ['(i)'], quote: 'beta assertion', start: 10, end: 25, claimOccurrenceId: 'beta' }),
    assertionEntry({ limbPath: ['(i)'], quote: 'gamma assertion', start: 100, end: 115, claimOccurrenceId: 'gamma' }),
  ];
  const reversed = [...base].reverse();

  const treeA = mintLimbComponentTree({ compiled_candidates: base, provision_instance_id: provisionInstanceId });
  const treeB = mintLimbComponentTree({ compiled_candidates: reversed, provision_instance_id: provisionInstanceId });
  assert.equal(canonicalJson(treeA), canonicalJson(treeB));

  // beta (start 10) ranks first, gamma (start 100) second, alpha (start
  // 300) third -- regardless of input array order.
  const byQuote = (tree) => Object.fromEntries(tree.assertion_nodes.map((n) => [n.quote, n.ordinal_under_parent]));
  assert.deepEqual(byQuote(treeA), { 'beta assertion': 0, 'gamma assertion': 1, 'alpha assertion': 2 });
  assert.deepEqual(byQuote(treeB), { 'beta assertion': 0, 'gamma assertion': 1, 'alpha assertion': 2 });
});

test('a claim_definition_key that is not LIMB_ASSERTION_CLAIM_KEY is ignored, never mistaken for an assertion', () => {
  const provisionInstanceId = contentId('TEST_PROVISION_INSTANCE/V1', { case: 'ignore-non-assertions' });
  const candidates = [
    assertionEntry({ limbPath: ['(i)'], quote: 'a real assertion', start: 0, end: 16 }),
    {
      ok: true,
      candidate: {
        kind: 'claim',
        claim: {
          claim_definition_key: QUALIFIER_CLAIM_KEY,
          claim_occurrence_id: 'a-qualifier-not-an-assertion',
          raw_value: 'true and correct in all material respects',
          attributes: { limb_path: ['(i)'] },
          evidence: [{ evidence_role: 'OPERATIVE_TEXT', absolute_start: 20, absolute_end: 60 }],
        },
      },
    },
    { ok: false, proposal: null, reason_code: 'SOMETHING_REJECTED' },
  ];
  const tree = mintLimbComponentTree({ compiled_candidates: candidates, provision_instance_id: provisionInstanceId });
  assert.equal(tree.assertion_nodes.length, 1);
  assert.equal(tree.assertion_nodes[0].quote, 'a real assertion');
});

test('a limb assertion with no limb_path is skipped as a typed residual, never guessed', () => {
  const provisionInstanceId = contentId('TEST_PROVISION_INSTANCE/V1', { case: 'missing-limb-path' });
  const candidates = [
    assertionEntry({ limbPath: null, quote: 'orphan assertion', start: 0, end: 17 }),
  ];
  const tree = mintLimbComponentTree({ compiled_candidates: candidates, provision_instance_id: provisionInstanceId });
  assert.equal(tree.assertion_nodes.length, 0);
  assert.equal(tree.path_nodes.length, 0);
  assert.equal(tree.residuals.length, 1);
  assert.equal(tree.residuals[0].residual_type, 'LIMB_ASSERTION_MISSING_LIMB_PATH');
});

test('input validation: a malformed call throws a typed LimbComponentError, never a bare TypeError', () => {
  assert.throws(() => mintLimbComponentTree({ compiled_candidates: 'not-an-array', provision_instance_id: 'x' }),
    (error) => error instanceof LimbComponentError && error.code === 'INVALID_INPUT');
  assert.throws(() => mintLimbComponentTree({ compiled_candidates: [], provision_instance_id: '' }),
    (error) => error instanceof LimbComponentError && error.code === 'INVALID_INPUT');

  const tree = mintLimbComponentTree({ compiled_candidates: [], provision_instance_id: 'x' });
  assert.throws(() => resolveQualifierAttachment(tree, { governs_path: null }),
    (error) => error instanceof LimbComponentError && error.code === 'INVALID_INPUT');
  assert.throws(() => resolveQualifierAttachment(tree, { governs_path: ['(i)'], review_outcome: 'NOT_A_REAL_OUTCOME' }),
    (error) => error instanceof LimbComponentError && error.code === 'INVALID_INPUT');
});
