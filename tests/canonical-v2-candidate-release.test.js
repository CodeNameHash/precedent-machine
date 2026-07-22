const test = require('node:test');
const assert = require('node:assert/strict');

const { buildLandosCandidateReleaseFixture } = require('../__fixtures__/canonical-v2/landos-candidate-release');
const { buildQxoNoShopReleaseFixture } = require('../__fixtures__/canonical-v2/qxo-no-shop-release');
const { canonicalJson, contentId } = require('../lib/canonical-v2/canonical-bytes');
const {
  buildFixtureCandidateRelease,
  buildInitialActiveReleasePointer,
  planActiveReleasePointerSwap,
  validateActiveReleasePointer,
  validateCandidateReleaseBundle,
  validateCandidateReleaseManifest,
} = require('../lib/canonical-v2/candidate-release');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function resignContentObject(value, { idKey, idDomain, digestKey, digestDomain }) {
  const body = clone(value);
  delete body[idKey];
  delete body[digestKey];
  value[idKey] = contentId(idDomain, body);
  value[digestKey] = contentId(digestDomain, body);
}

function resignManifest(manifest) {
  const body = clone(manifest);
  delete body.candidate_release_manifest_id;
  delete body.canonical_payload_digest;
  manifest.candidate_release_manifest_id = contentId('FIXTURE_CANDIDATE_RELEASE_MANIFEST/V1', body);
  manifest.canonical_payload_digest = contentId('FIXTURE_CANDIDATE_RELEASE_MANIFEST_PAYLOAD/V1', body);
}

function exactDetailRootEntries(packages) {
  return packages.map((detailPackage) => ({
    row_serving_key: detailPackage.row.row_serving_key,
    source_detail_reference_id: detailPackage.references[0].source_detail_reference_id,
    source_detail_payload_id: detailPackage.detail_payloads[0].source_detail_payload_id,
    parent_edge_id: detailPackage.parent_edges[0].parent_edge_id,
    exact_detail_package_digest: contentId('EXACT_DETAIL_ATOMIC_PACKAGE/V1', detailPackage),
  }));
}

test('twelve comparable results and one reviewed source-specific proposition freeze into one deterministic release', () => {
  const first = buildLandosCandidateReleaseFixture();
  const second = buildLandosCandidateReleaseFixture();

  assert.deepEqual(first.release, second.release);
  assert.equal(validateCandidateReleaseManifest(first.release.manifest), true);
  assert.equal(validateCandidateReleaseBundle(first.release), true);
  assert.deepEqual(first.release.manifest.counts, {
    deals: 1,
    deal_directory_records: 1,
    metric_slots: 12,
    observations: 12,
    exclusions: 0,
    shared_rows: 13,
    source_specific_rows: 1,
    source_specific_serving_records: 1,
    exact_detail_packages: 13,
    query_records: 12,
    validated_semantic_graphs: 1,
    correction_applications: 0,
    correction_discharges: 0,
    unresolved: 0,
    failed: 0,
    duplicates: 0,
  });
  assert.deepEqual(first.release.manifest.deal_keys, ['deal:landos-abbvie']);
  assert.equal(first.release.deal_directory_records[0].application_deal_id, 'c34415ed-44f7-432f-8d7c-6464b0310239');
  assert.equal(first.release.market_observations.length, 12);
  assert.equal(first.release.shared_rows.length, 13);
  assert.equal(first.release.reviewed_source_specific_rows.length, 1);
  assert.equal(first.release.source_specific_serving_records.length, 1);
  assert.equal(first.release.exact_detail_packages.length, 13);
  assert.equal(first.release.query_records.length, 12);
  const representation = first.release.query_records.find(
    (row) => row.metric_key === 'REPRESENTATION_ACCURACY_STANDARD',
  );
  assert.deepEqual(representation.canonical_payload.canonical_result.components.map((component) => ({
    slot: component.component_slot_key,
    state: component.component_state,
  })), [
    { slot: 'ACCURACY_TIER_A', state: 'PRESENT' },
    { slot: 'ACCURACY_EXCEPTION', state: 'PRESENT' },
    { slot: 'KNOWLEDGE_QUALIFIER_1', state: 'ABSENT' },
    { slot: 'KNOWLEDGE_QUALIFIER_2', state: 'ABSENT' },
  ]);
  assert.equal(first.release.query_records.some((row) => (
    row.row_serving_key === first.release.reviewed_source_specific_rows[0].row_serving_key
  )), false);
  assert.equal(first.release.validated_semantic_graphs.length, 1);
  assert.equal(
    first.release.validated_semantic_graphs[0].validated_semantic_graph_id,
    first.sourceSpecific.validatedSemanticGraph.validated_semantic_graph_id,
  );
  assert.equal(new Set(Object.values(first.release.manifest.roots)).size, 10);
  assert.match(first.release.manifest.correction_input_seal_id, /^[a-f0-9]{64}$/);
  assert.equal(first.release.candidate_correction_input_seal.counts.expected_active_applications, 0);
  assert.match(first.release.manifest.roots.correction_input_root, /^[a-f0-9]{64}$/);
});

test('candidate release carries raw and normalised money with exact legal query dimensions', () => {
  const { release } = buildLandosCandidateReleaseFixture();
  const byMetric = new Map(release.query_records.map((record) => [record.metric_key, record]));
  const fee = byMetric.get('SELLER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE');
  const material = byMetric.get('MATERIAL_CONTRACT_CASH_FLOW_THRESHOLD_PERCENT_OF_DEAL_VALUE');
  const ioc = byMetric.get('IOC_CAPEX_THRESHOLD_PERCENT_OF_DEAL_VALUE');

  assert.equal(fee.canonical_numeric_value, '5.09090909');
  assert.equal(fee.canonical_payload.canonical_result.components[0].raw_value, '$7,000,000');
  assert.equal(fee.fee_side, 'SELLER');
  assert.equal(fee.payer_capacity, 'TARGET');
  assert.equal(fee.payee_capacity, 'BUYER');
  assert.equal(fee.trigger_codes.length, 3);
  assert.equal(material.canonical_numeric_value, '0.07272727');
  assert.equal(material.criterion_code, 'PAYMENTS_BY_OR_TO_COMPANY_PER_FISCAL_YEAR');
  assert.equal(material.measurement_period_code, 'FISCAL_2023_OR_ANY_SINGLE_FISCAL_YEAR_THEREAFTER');
  assert.equal(ioc.canonical_numeric_value, '0.07272727');
  assert.equal(ioc.canonical_payload.canonical_result.components[0].raw_value, '$100,000');
  assert.equal(byMetric.get('REPRESENTATION_ACCURACY_STANDARD').canonical_numeric_value, null);
  assert.equal(byMetric.get('NO_SHOP_NOTICE_PERIOD_DAYS').canonical_numeric_value, '1');
});

test('duplicate, mismatched, unresolved or source-less members block the whole candidate release', () => {
  const fixture = buildLandosCandidateReleaseFixture();
  assert.throws(() => buildFixtureCandidateRelease({
    contract_bundle: fixture.contract,
    serving_namespace_id: fixture.servingNamespaceId,
    corpus_release_id: fixture.corpusReleaseId,
    members: fixture.members,
    deal_directory_entries: fixture.dealDirectoryEntries,
  }), /candidate input authority selection must be an object/);
  const args = {
    contract_bundle: fixture.contract,
    serving_namespace_id: fixture.servingNamespaceId,
    corpus_release_id: fixture.corpusReleaseId,
    correction_authority_selection: fixture.correctionAuthoritySelection,
  };
  assert.throws(
    () => buildFixtureCandidateRelease({ ...args, members: [...fixture.members, fixture.members[0]] }),
    /duplicate market metric slot/,
  );
  const sourceSpecificMember = {
    shared_row: fixture.sourceSpecific.row,
    exact_detail: {
      package: fixture.sourceSpecific.exactDetail,
      source: fixture.sourceSpecific.source,
      source_admission: fixture.sourceSpecific.sourceAdmission,
      excerpts: Object.values(fixture.sourceSpecific.excerpts),
    },
  };
  assert.throws(
    () => buildFixtureCandidateRelease({
      ...args,
      members: fixture.members,
      source_specific_members: [sourceSpecificMember, sourceSpecificMember],
    }),
    /duplicate shared or source-specific row/,
  );

  const sourceLess = clone(fixture.members);
  sourceLess[0].exact_detail = null;
  assert.throws(
    () => buildFixtureCandidateRelease({ ...args, members: sourceLess }),
    /requires one shared row and one exact-detail package/,
  );

  const unresolved = clone(fixture.members);
  unresolved[0].shared_row = { row_kind: 'UNRECOGNISED_PROVISION_CANDIDATE' };
  assert.throws(
    () => buildFixtureCandidateRelease({ ...args, members: unresolved }),
    /SharedServingRow|shared serving row|fields do not match/i,
  );

  const mismatched = clone(fixture.members);
  mismatched[0].shared_row = clone(fixture.members[1].shared_row);
  assert.throws(
    () => buildFixtureCandidateRelease({ ...args, members: mismatched }),
    /does not close over its market observation/,
  );
});

test('full release validation rejects payload drift behind an otherwise valid manifest', () => {
  const { release } = buildLandosCandidateReleaseFixture();
  const queryDrift = clone(release);
  queryDrift.query_records[0].buyer = 'Different buyer';
  assert.throws(() => validateCandidateReleaseBundle(queryDrift), /query projection/);

  const sourceSpecificDrift = clone(release);
  sourceSpecificDrift.source_specific_serving_records[0].aggregate_authority = 'MARKET_AUTHORITY';
  assert.throws(() => validateCandidateReleaseBundle(sourceSpecificDrift), /aggregate_authority|projection/);

  const missingDetail = clone(release);
  missingDetail.exact_detail_packages.pop();
  assert.throws(() => validateCandidateReleaseBundle(missingDetail), /count does not match/);

  const graphDrift = clone(release);
  graphDrift.validated_semantic_graphs[0].definition_cues[0].raw_term = 'Different Supplier';
  assert.throws(() => validateCandidateReleaseBundle(graphDrift), /DefinitionCue|certified roots|semantic graph/i);

  const missingGraph = clone(release);
  missingGraph.validated_semantic_graphs.pop();
  assert.throws(() => validateCandidateReleaseBundle(missingGraph), /count does not match/);
});

test('the certified exact-detail root binds every byte of uncorrected row, source and detail packages', () => {
  const { release } = buildLandosCandidateReleaseFixture();
  const packageIndex = release.exact_detail_packages.findIndex((detailPackage) => (
    detailPackage.row.row_kind === 'CANONICAL_RESULT'
      && detailPackage.detail_payloads[0].response_body.source_lineage
  ));
  assert.ok(packageIndex >= 0);

  const sourceDrift = clone(release);
  const sourcePayload = sourceDrift.exact_detail_packages[packageIndex].detail_payloads[0];
  sourcePayload.response_body.source_lineage.document_hash = '0'.repeat(64);
  sourcePayload.response_body_digest = contentId(
    'SERVING_EXACT_DETAIL_RESPONSE_BODY/V1',
    sourcePayload.response_body,
  );
  sourcePayload.source_lineage_digest = contentId(
    'SERVING_EXACT_DETAIL_SOURCE_LINEAGE/V1',
    sourcePayload.response_body.source_lineage,
  );
  sourcePayload.encoded_byte_length = Buffer.byteLength(canonicalJson(sourcePayload.response_body), 'utf8');
  resignContentObject(sourcePayload, {
    idKey: 'source_detail_payload_id',
    idDomain: 'SERVING_EXACT_DETAIL_PAYLOAD/V1',
    digestKey: 'canonical_payload_digest',
    digestDomain: 'SERVING_EXACT_DETAIL_PAYLOAD_BODY/V1',
  });
  assert.throws(() => validateCandidateReleaseBundle(sourceDrift), /certified roots/);

  const detailDrift = clone(release);
  const detailPayload = detailDrift.exact_detail_packages[packageIndex].detail_payloads[0];
  const excerpt = detailPayload.response_body.excerpt || detailPayload.response_body.excerpts[0];
  excerpt.exact_text = `${excerpt.exact_text} fabricated`;
  detailPayload.response_body_digest = contentId(
    'SERVING_EXACT_DETAIL_RESPONSE_BODY/V1',
    detailPayload.response_body,
  );
  detailPayload.encoded_byte_length = Buffer.byteLength(canonicalJson(detailPayload.response_body), 'utf8');
  resignContentObject(detailPayload, {
    idKey: 'source_detail_payload_id',
    idDomain: 'SERVING_EXACT_DETAIL_PAYLOAD/V1',
    digestKey: 'canonical_payload_digest',
    digestDomain: 'SERVING_EXACT_DETAIL_PAYLOAD_BODY/V1',
  });
  assert.throws(() => validateCandidateReleaseBundle(detailDrift), /certified roots/);

  const referenceDrift = clone(release);
  const reference = referenceDrift.exact_detail_packages[packageIndex].references[0];
  reference.ordered_path[0].object_payload_digest = 'f'.repeat(64);
  resignContentObject(reference, {
    idKey: 'source_detail_reference_id',
    idDomain: 'SERVING_EXACT_DETAIL_REFERENCE/V1',
    digestKey: 'canonical_payload_digest',
    digestDomain: 'SERVING_EXACT_DETAIL_REFERENCE_BODY/V1',
  });
  assert.throws(() => validateCandidateReleaseBundle(referenceDrift), /certified roots/);

  const edgeDrift = clone(release);
  const edge = edgeDrift.exact_detail_packages[packageIndex].parent_edges[0];
  edge.governed_ordinal = 1;
  resignContentObject(edge, {
    idKey: 'parent_edge_id',
    idDomain: 'RESULT_ROW_SOURCE_DETAIL_EDGE/V1',
    digestKey: 'canonical_payload_digest',
    digestDomain: 'RESULT_ROW_SOURCE_DETAIL_EDGE_BODY/V1',
  });
  assert.throws(() => validateCandidateReleaseBundle(edgeDrift), /certified roots/);
});

test('re-signing a release cannot substitute a different package row for its stable occurrence', () => {
  const { release } = buildLandosCandidateReleaseFixture();
  const drift = clone(release);
  const packageRow = drift.exact_detail_packages[0].row;
  packageRow.canonical_result.refinable_dimensions.buyer = 'Fabricated Buyer';
  const rowBody = clone(packageRow);
  delete rowBody.canonical_payload_digest;
  packageRow.canonical_payload_digest = contentId('SHARED_SERVING_ROW_PAYLOAD/V1', rowBody);
  drift.manifest.roots.exact_detail_root = contentId(
    'FIXTURE_RELEASE_EXACT_DETAILS/V1',
    exactDetailRootEntries(drift.exact_detail_packages),
  );
  resignManifest(drift.manifest);

  assert.throws(
    () => validateCandidateReleaseBundle(drift),
    /not its independently certified shared row/,
  );
});

test('candidate release rejects graphs outside its admitted source and deal inventory', () => {
  const fixture = buildLandosCandidateReleaseFixture();
  assert.throws(() => buildFixtureCandidateRelease({
    contract_bundle: fixture.contract,
    serving_namespace_id: fixture.servingNamespaceId,
    corpus_release_id: fixture.corpusReleaseId,
    members: fixture.members,
    source_specific_members: fixture.sourceSpecificMembers,
    validated_semantic_graphs: [
      fixture.sourceSpecific.validatedSemanticGraph,
      fixture.sourceSpecific.validatedSemanticGraph,
    ],
    correction_authority_selection: fixture.correctionAuthoritySelection,
    deal_directory_entries: fixture.dealDirectoryEntries,
  }), /duplicate validated semantic graph/);

  const qxo = buildQxoNoShopReleaseFixture({
    contractBundle: fixture.contract,
    corpusReleaseId: fixture.corpusReleaseId,
    servingNamespaceId: fixture.servingNamespaceId,
  });
  assert.throws(() => buildFixtureCandidateRelease({
    contract_bundle: fixture.contract,
    serving_namespace_id: fixture.servingNamespaceId,
    corpus_release_id: fixture.corpusReleaseId,
    members: qxo.members,
    validated_semantic_graphs: [fixture.sourceSpecific.validatedSemanticGraph],
    correction_authority_selection: qxo.correctionAuthoritySelection,
    deal_directory_entries: qxo.dealDirectoryEntries,
  }), /no admitted release source lineage/);
});

test('active release movement is an immutable compare-and-swap plan over one certified manifest', () => {
  const { release } = buildLandosCandidateReleaseFixture();
  const current = buildInitialActiveReleasePointer();
  const currentBytes = JSON.stringify(current);
  const swap = planActiveReleasePointerSwap({
    current_pointer: current,
    expected_current_pointer_id: current.pointer_id,
    candidate_manifest: release.manifest,
  });

  assert.equal(JSON.stringify(current), currentBytes);
  assert.equal(validateActiveReleasePointer(current), true);
  assert.equal(current.schema_version, 'FIXTURE_ACTIVE_RELEASE_POINTER/V1');
  assert.equal(current.pointer_id, 'c361a7d6c5aea6dbe9df028e8b67c81ab2151ccc8598b66c7a45fbb0a4df332b');
  assert.equal(current.canonical_payload_digest, '91485640b280dfa07b4a1d201a4a34b0c154867a2dd37471d873d0f039b117cd');
  assert.equal(validateActiveReleasePointer(swap.next_pointer), true);
  assert.equal(swap.schema_version, 'FIXTURE_ACTIVE_RELEASE_POINTER_SWAP/V2');
  assert.equal(swap.next_pointer.schema_version, 'FIXTURE_ACTIVE_RELEASE_POINTER/V2');
  assert.equal(swap.next_pointer.generation, 1);
  assert.equal(swap.next_pointer.previous_pointer_id, current.pointer_id);
  assert.equal(swap.next_pointer.corpus_release_id, release.manifest.corpus_release_id);
  assert.equal(swap.next_pointer.serving_namespace_id, release.manifest.serving_namespace_id);
  assert.equal(swap.next_pointer.candidate_release_manifest_id, release.manifest.candidate_release_manifest_id);
  assert.equal(swap.next_pointer.correction_input_seal_id, release.manifest.correction_input_seal_id);
  assert.equal(swap.next_pointer.correction_input_root, release.manifest.roots.correction_input_root);
  const successor = planActiveReleasePointerSwap({
    current_pointer: swap.next_pointer,
    expected_current_pointer_id: swap.next_pointer.pointer_id,
    candidate_manifest: release.manifest,
  });
  assert.equal(successor.next_pointer.schema_version, 'FIXTURE_ACTIVE_RELEASE_POINTER/V2');
  assert.equal(successor.next_pointer.generation, 2);

  const tamperedPointer = clone(swap.next_pointer);
  tamperedPointer.correction_input_root = '0'.repeat(64);
  assert.throws(() => validateActiveReleasePointer(tamperedPointer), /identity is invalid/);
  assert.throws(
    () => planActiveReleasePointerSwap({
      current_pointer: current,
      expected_current_pointer_id: '0'.repeat(64),
      candidate_manifest: release.manifest,
    }),
    /changed before the atomic swap/,
  );

  const tampered = clone(release.manifest);
  tampered.counts.failed = 1;
  assert.throws(
    () => planActiveReleasePointerSwap({
      current_pointer: current,
      expected_current_pointer_id: current.pointer_id,
      candidate_manifest: tampered,
    }),
    /not a complete certified release/,
  );
});
