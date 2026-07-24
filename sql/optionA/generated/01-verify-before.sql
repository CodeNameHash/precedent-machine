-- 01-verify-before: blocking, read-only preconditions.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout='60000ms';
DO $verify_before$
BEGIN
  IF (SELECT count(*) FROM canonical_v2_staging.active_corpus_release_pointers
      WHERE environment='staging'
      AND generation=8
      AND pointer_id='eda01d9851522edada42a76f1bb1afebd8061528166523124bed3a20c9babf8b'
      AND corpus_release_id='c9c19dc1ad92496953ee04f52b4a8dc575ea21ab9502acfd449a9299055817d3'
      AND serving_namespace_id='9270602408312e80a65c0ce46b895fa2c8f07d1c676aef5bd171029edd209b68'
      AND candidate_manifest_id='4e955c415bcb4c4e32e818bad11f82e48e247c3e12efee9a5e120d927a6ecf98'
      AND correction_input_seal_id='7fe908d2a5e359f8f87bb8f72e204a90fa4e25a73da4f8588be1350f6ba2a8bd'
      AND correction_input_root='aa260ffdf873a51a93b23f6f85173de1a1183e21ade0668aa5a45977cb0f8012'
      AND previous_pointer_id='15a0e13f45ad596d468b9cfa2878a456ac56c3b84d15a185c0a96dca5ef022a1'
      AND canonical_payload_digest='08e39195cf12156204fa9d129e438ae5dd89a27b35024f91645c9937b4105c69'
      AND canonical_payload=$optionA_40fb5eddd8fd2dee${"schema_version":"FIXTURE_ACTIVE_RELEASE_POINTER/V2","environment":"staging","pointer_id":"eda01d9851522edada42a76f1bb1afebd8061528166523124bed3a20c9babf8b","corpus_release_id":"c9c19dc1ad92496953ee04f52b4a8dc575ea21ab9502acfd449a9299055817d3","serving_namespace_id":"9270602408312e80a65c0ce46b895fa2c8f07d1c676aef5bd171029edd209b68","candidate_release_manifest_id":"4e955c415bcb4c4e32e818bad11f82e48e247c3e12efee9a5e120d927a6ecf98","correction_input_seal_id":"7fe908d2a5e359f8f87bb8f72e204a90fa4e25a73da4f8588be1350f6ba2a8bd","correction_input_root":"aa260ffdf873a51a93b23f6f85173de1a1183e21ade0668aa5a45977cb0f8012","previous_pointer_id":"15a0e13f45ad596d468b9cfa2878a456ac56c3b84d15a185c0a96dca5ef022a1","generation":8,"canonical_payload_digest":"08e39195cf12156204fa9d129e438ae5dd89a27b35024f91645c9937b4105c69"}$optionA_40fb5eddd8fd2dee$::jsonb) <> 1 THEN
    RAISE EXCEPTION 'active staging pointer is not the exact pinned F1 pointer';
  END IF;
  IF (SELECT count(*) FROM canonical_v2_staging.candidate_input_heads
      WHERE environment='staging' AND contract_fingerprint='56da82bee06331793ba2ed8b78ef4186361407e60733595091e5951853e7d41d'
        AND candidate_input_head_id='47e58bdccc8712e52538e001d69237cbe0d5c1d3ab4a8bdd5fcfac57439220bf'
        AND candidate_input_head_payload_digest='6235cfd8f97babed44c1a4666008c239aec08983eb2d186bb00ad527a4f95c47') <> 1 THEN
    RAISE EXCEPTION 'pinned F1 input head moved';
  END IF;
  IF (SELECT count(*) FROM canonical_v2_staging.candidate_input_heads
      WHERE environment='staging' AND contract_fingerprint='46553f1a743dbf9f4ebfd07bff20939f66a57c4973826b5619c8bdfd196b1b83'
        AND candidate_input_head_id='614bb1f8162c5bf2f4c7c857c7701025390fd9cd33a4c4d711dc359a664d427a'
        AND candidate_input_head_payload_digest='bedabdc3f0a46eb500d3165e0b1be5b26036ac494949d9118b3999696a762868') <> 1 THEN
    RAISE EXCEPTION 'pinned F2 input head was not seeded';
  END IF;
  IF EXISTS (SELECT 1 FROM canonical_v2_staging.fixture_corpus_releases WHERE corpus_release_id='1b70bbc8b615e1195a71ba5f9ce9aad88542e2dce4c402813e372fea9277d2b6') THEN
    RAISE EXCEPTION 'the F2 candidate release already exists';
  END IF;
  IF EXISTS (SELECT 1 FROM canonical_v2_staging.write_receipts
      WHERE operation='DEAL_SCOPE_RUN' AND idempotency_key='QXO_TERMINATION_FEE_DEAL_SCOPE_V1') THEN
    RAISE EXCEPTION 'the termination semantic write already exists';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM unnest(ARRAY['cbb678180ec9951f12741a77a58f7ec03a6bebffbdc6e5d9fbea6add9beea596','944c18cb24c5684c04eb3d2c9cae57f932c144790492bc1619ccd566d57a8a3e','89683e5ff72a570948bfadda123254719d848310b5c50ad3720645e2cbd6291b','dd232aa8077fd0d4158cd19c7fa5e8b439fceb8d97b578682c41936889808af8','a08b15c095464e265205ffd87ec380a85e37e9867c9701551b7b59759ed0cab5']::text[]) required(closure_id)
    WHERE NOT EXISTS (
      SELECT 1 FROM canonical_v2_staging.provision_instances provision
      WHERE provision.closure_id = required.closure_id
    )
  ) THEN
    RAISE EXCEPTION 'one or more prior QXO semantic closures are missing';
  END IF;
END;
$verify_before$;
SELECT jsonb_build_object(
  'active_pointer_generation', (SELECT generation FROM canonical_v2_staging.active_corpus_release_pointers WHERE environment='staging'),
  'active_pointer_release', (SELECT canonical_payload->>'corpus_release_id' FROM canonical_v2_staging.active_corpus_release_pointers WHERE environment='staging'),
  'f1_head_unmoved', (SELECT count(*)=1 FROM canonical_v2_staging.candidate_input_heads
    WHERE environment='staging' AND contract_fingerprint='56da82bee06331793ba2ed8b78ef4186361407e60733595091e5951853e7d41d'
      AND candidate_input_head_id='47e58bdccc8712e52538e001d69237cbe0d5c1d3ab4a8bdd5fcfac57439220bf'
      AND candidate_input_head_payload_digest='6235cfd8f97babed44c1a4666008c239aec08983eb2d186bb00ad527a4f95c47'),
  'f2_head_seeded', (SELECT count(*)=1 FROM canonical_v2_staging.candidate_input_heads
    WHERE environment='staging' AND contract_fingerprint='46553f1a743dbf9f4ebfd07bff20939f66a57c4973826b5619c8bdfd196b1b83'
      AND candidate_input_head_id='614bb1f8162c5bf2f4c7c857c7701025390fd9cd33a4c4d711dc359a664d427a'
      AND candidate_input_head_payload_digest='bedabdc3f0a46eb500d3165e0b1be5b26036ac494949d9118b3999696a762868'),
  'new_release_absent', (SELECT count(*)=0 FROM canonical_v2_staging.fixture_corpus_releases WHERE corpus_release_id='1b70bbc8b615e1195a71ba5f9ce9aad88542e2dce4c402813e372fea9277d2b6'),
  'capitalisation_graph', (SELECT count(*) FROM canonical_v2_staging.provision_instances WHERE closure_id='cbb678180ec9951f12741a77a58f7ec03a6bebffbdc6e5d9fbea6add9beea596'),
  'no_shop_graph', (SELECT count(*) FROM canonical_v2_staging.provision_instances WHERE closure_id='944c18cb24c5684c04eb3d2c9cae57f932c144790492bc1619ccd566d57a8a3e'),
  'actions_graph', (SELECT count(*) FROM canonical_v2_staging.provision_instances WHERE closure_id='89683e5ff72a570948bfadda123254719d848310b5c50ad3720645e2cbd6291b'),
  'rematch_graph', (SELECT count(*) FROM canonical_v2_staging.provision_instances WHERE closure_id='dd232aa8077fd0d4158cd19c7fa5e8b439fceb8d97b578682c41936889808af8'),
  'material_graph', (SELECT count(*) FROM canonical_v2_staging.provision_instances WHERE closure_id='a08b15c095464e265205ffd87ec380a85e37e9867c9701551b7b59759ed0cab5'),
  'termination_write_absent', (SELECT count(*)=0 FROM canonical_v2_staging.write_receipts WHERE operation='DEAL_SCOPE_RUN' AND idempotency_key='QXO_TERMINATION_FEE_DEAL_SCOPE_V1')
) AS before_state;
ROLLBACK;
