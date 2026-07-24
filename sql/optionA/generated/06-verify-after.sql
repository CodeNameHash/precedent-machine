-- 06-verify-after: blocking, read-only post-import verification.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout='60000ms';
DO $verify_after$
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
    RAISE EXCEPTION 'inactive import changed the active staging pointer';
  END IF;
  IF (SELECT count(*) FROM canonical_v2_staging.fixture_corpus_releases
      WHERE corpus_release_id='1b70bbc8b615e1195a71ba5f9ce9aad88542e2dce4c402813e372fea9277d2b6'
        AND candidate_manifest_id='9c93546cb60d03977c2d15bda851154a6104cad04a7df2581c4bb3c90ca5a906'
        AND correction_input_seal_id='5ac54e926bce0e15d4fc0b818eca175a53fc9031231915bd99362df54977b3a5'
        AND correction_input_root='1323429afd038ccb7c7c9bd27b90febfab0be45c03c67cedcdf98f946a2a77c8'
        AND frozen_pair_root_id='98707c480260201d308ecf61e6e8d150ea82adc33f4b6be34b9d036c7751ce01'
        AND contract_fingerprint='46553f1a743dbf9f4ebfd07bff20939f66a57c4973826b5619c8bdfd196b1b83'
        AND projection_version='canonical-v2-serving/v2'
        AND query_projection_contract_digest='048394ed05f7b810b0688e8cc0324f6270196b0c531e50d37fa9ac537efed827'
        AND canonical_payload=$optionA_210dcbafb89a7846${"schema_version":"FIXTURE_CANDIDATE_RELEASE_MANIFEST/V3","release_state":"CERTIFIED_OFFLINE_FIXTURE","contract_fingerprint":"46553f1a743dbf9f4ebfd07bff20939f66a57c4973826b5619c8bdfd196b1b83","serving_namespace_id":"d7f2f04068d9dcac2793def3a7854d953e6419601b274269ac4f4f8b8d8160f2","corpus_release_id":"1b70bbc8b615e1195a71ba5f9ce9aad88542e2dce4c402813e372fea9277d2b6","serving_projection_version":"canonical-v2-serving/v2","query_projection_contract_digest":"048394ed05f7b810b0688e8cc0324f6270196b0c531e50d37fa9ac537efed827","correction_input_seal_id":"5ac54e926bce0e15d4fc0b818eca175a53fc9031231915bd99362df54977b3a5","deal_keys":["deal:qxo-topbuild"],"counts":{"deals":1,"deal_directory_records":1,"metric_slots":11,"observations":9,"exclusions":2,"shared_rows":10,"incomplete_canonical_rows":1,"source_specific_rows":0,"source_specific_serving_records":0,"exact_detail_packages":10,"query_records":9,"validated_semantic_graphs":0,"correction_applications":0,"correction_discharges":0,"unresolved":0,"failed":0,"duplicates":0},"roots":{"deal_directory_root":"1696be797fe77afb18d184331b6f729fca6f04e8c0c90e560f853a6b6b3da9c0","observation_root":"f0fa93ee0b25702b97b3ae14b45e6219b5ed586fc09819a18da522b7d33716ea","exclusion_root":"c61057aca001ef04b3c1b2993164dbf130daad31cfd748262d6b1a8c561bac69","shared_row_root":"927f15025b85475998e88f49cddeeefe3f7fac7d746f098d0b73062acc2af0fe","incomplete_canonical_row_root":"18c871f42f3369d6b3a616836f5f7466bc675b9ef2d783c4e79ce19757ac9aa7","source_specific_row_root":"4877b92c861b1bbc8b1f7416b7276a8bdf1fb019b27ecc48582e80386d843b43","source_specific_serving_projection_root":"36befef29a1d50e092585f930de4fb51759380c617228c1abee96e68c151ddc7","exact_detail_root":"6ffe455303123b387eabf0581373cf867653727d9b21b9d56dc1acf7e5fe3a41","query_projection_root":"44d86e99567c2e569c20585ce4a0fe59a3d179ab6ce927ddb03edac365cf2169","validated_semantic_graph_root":"092eb04d038feb775827a3e1f3fbf57fd18a65ccefde4b77cba682a1a3afd915","correction_input_root":"1323429afd038ccb7c7c9bd27b90febfab0be45c03c67cedcdf98f946a2a77c8"},"candidate_release_manifest_id":"9c93546cb60d03977c2d15bda851154a6104cad04a7df2581c4bb3c90ca5a906","canonical_payload_digest":"4e601922d957ba5c14d98b51ec1a5268c9eb6065ab65cf988636f3fc488c47a3"}$optionA_210dcbafb89a7846$::jsonb
        AND canonical_payload_digest='4e601922d957ba5c14d98b51ec1a5268c9eb6065ab65cf988636f3fc488c47a3') <> 1 THEN
    RAISE EXCEPTION 'the exact F2 candidate release record is missing';
  END IF;
  IF (SELECT count(*) FROM canonical_v2_staging.shared_serving_rows WHERE corpus_release_id='1b70bbc8b615e1195a71ba5f9ce9aad88542e2dce4c402813e372fea9277d2b6') <> 10
    OR (SELECT count(*) FROM canonical_v2_staging.shared_serving_rows WHERE corpus_release_id='1b70bbc8b615e1195a71ba5f9ce9aad88542e2dce4c402813e372fea9277d2b6' AND canonical_payload->>'row_kind'='CANONICAL_RESULT') <> 9
    OR (SELECT count(*) FROM canonical_v2_staging.shared_serving_rows WHERE corpus_release_id='1b70bbc8b615e1195a71ba5f9ce9aad88542e2dce4c402813e372fea9277d2b6' AND canonical_payload->>'row_kind'='INCOMPLETE_CANONICAL_RESULT') <> 1
    OR (SELECT count(*) FROM canonical_v2_staging.market_observations WHERE corpus_release_id='1b70bbc8b615e1195a71ba5f9ce9aad88542e2dce4c402813e372fea9277d2b6') <> 9
    OR (SELECT count(*) FROM canonical_v2_staging.market_metric_slot_exclusions WHERE corpus_release_id='1b70bbc8b615e1195a71ba5f9ce9aad88542e2dce4c402813e372fea9277d2b6') <> 2
    OR (SELECT count(*) FROM canonical_v2_staging.exact_detail_serving_packages WHERE corpus_release_id='1b70bbc8b615e1195a71ba5f9ce9aad88542e2dce4c402813e372fea9277d2b6') <> 10
    OR (SELECT count(*) FROM canonical_v2_staging.deal_serving_directory WHERE corpus_release_id='1b70bbc8b615e1195a71ba5f9ce9aad88542e2dce4c402813e372fea9277d2b6') <> 1
    OR (SELECT count(*) FROM canonical_v2_staging.candidate_release_import_receipts
        WHERE corpus_release_id='1b70bbc8b615e1195a71ba5f9ce9aad88542e2dce4c402813e372fea9277d2b6'
          AND candidate_manifest_id='9c93546cb60d03977c2d15bda851154a6104cad04a7df2581c4bb3c90ca5a906'
          AND serving_namespace_id='d7f2f04068d9dcac2793def3a7854d953e6419601b274269ac4f4f8b8d8160f2'
          AND correction_input_seal_id='5ac54e926bce0e15d4fc0b818eca175a53fc9031231915bd99362df54977b3a5'
          AND correction_input_root='1323429afd038ccb7c7c9bd27b90febfab0be45c03c67cedcdf98f946a2a77c8'
          AND candidate_input_contract_fingerprint='46553f1a743dbf9f4ebfd07bff20939f66a57c4973826b5619c8bdfd196b1b83'
          AND candidate_input_head_id='614bb1f8162c5bf2f4c7c857c7701025390fd9cd33a4c4d711dc359a664d427a'
          AND candidate_input_head_payload_digest='bedabdc3f0a46eb500d3165e0b1be5b26036ac494949d9118b3999696a762868'
          AND correction_discharge_map_id='a42a3ba60a911412bf8ab588af4a54bd8c3e1689fb6d59cdd380354cd37ba3cd'
          AND correction_discharge_map_payload_digest='f56e465a8e6212c0406552bf9b476771f6c278d3bb4785892e31dc9186d87879'
          AND candidate_release_import_plan_id='dd26b85607cc53ea78e74455724db2eab970c4c22c2196f25f4f17343f63ab86'
          AND import_state='IMPORTED_COMPLETE'
          AND expected_counts=$optionA_8d3907031777d9d3${"correction_input_seal_records":1,"correction_discharge_records":0,"deal_directory_records":1,"market_observations":9,"market_exclusions":2,"query_records":9,"incomplete_canonical_records":1,"source_specific_records":0,"exact_detail_packages":10,"validated_semantic_graph_records":0}$optionA_8d3907031777d9d3$::jsonb) <> 1
    OR (SELECT count(*) FROM canonical_v2_staging.shared_serving_rows WHERE corpus_release_id='1b70bbc8b615e1195a71ba5f9ce9aad88542e2dce4c402813e372fea9277d2b6' AND metric_key='SELLER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE') <> 1
    OR (SELECT count(*) FROM canonical_v2_staging.provision_instances WHERE closure_id='6e59b62130b2c0bac205251bf936c7aaca55b84ed9251971a1528870b17672a2') <> 7
    OR (SELECT count(*) FROM canonical_v2_staging.relationship_revisions WHERE closure_id='6e59b62130b2c0bac205251bf936c7aaca55b84ed9251971a1528870b17672a2') <> 6 THEN
    RAISE EXCEPTION 'F2 candidate release or semantic closure counts are not exact';
  END IF;
END;
$verify_after$;
SELECT jsonb_build_object(
  'active_pointer_generation', (SELECT generation FROM canonical_v2_staging.active_corpus_release_pointers WHERE environment='staging'),
  'active_pointer_release', (SELECT canonical_payload->>'corpus_release_id' FROM canonical_v2_staging.active_corpus_release_pointers WHERE environment='staging'),
  'release_records', (SELECT count(*) FROM canonical_v2_staging.fixture_corpus_releases WHERE corpus_release_id='1b70bbc8b615e1195a71ba5f9ce9aad88542e2dce4c402813e372fea9277d2b6'),
  'projection_version', (SELECT projection_version FROM canonical_v2_staging.fixture_corpus_releases WHERE corpus_release_id='1b70bbc8b615e1195a71ba5f9ce9aad88542e2dce4c402813e372fea9277d2b6'),
  'shared_rows', (SELECT count(*) FROM canonical_v2_staging.shared_serving_rows WHERE corpus_release_id='1b70bbc8b615e1195a71ba5f9ce9aad88542e2dce4c402813e372fea9277d2b6'),
  'query_records', (SELECT count(*) FROM canonical_v2_staging.shared_serving_rows WHERE corpus_release_id='1b70bbc8b615e1195a71ba5f9ce9aad88542e2dce4c402813e372fea9277d2b6' AND canonical_payload->>'row_kind'='CANONICAL_RESULT'),
  'incomplete_records', (SELECT count(*) FROM canonical_v2_staging.shared_serving_rows WHERE corpus_release_id='1b70bbc8b615e1195a71ba5f9ce9aad88542e2dce4c402813e372fea9277d2b6' AND canonical_payload->>'row_kind'='INCOMPLETE_CANONICAL_RESULT'),
  'market_observations', (SELECT count(*) FROM canonical_v2_staging.market_observations WHERE corpus_release_id='1b70bbc8b615e1195a71ba5f9ce9aad88542e2dce4c402813e372fea9277d2b6'),
  'market_exclusions', (SELECT count(*) FROM canonical_v2_staging.market_metric_slot_exclusions WHERE corpus_release_id='1b70bbc8b615e1195a71ba5f9ce9aad88542e2dce4c402813e372fea9277d2b6'),
  'exact_detail_packages', (SELECT count(*) FROM canonical_v2_staging.exact_detail_serving_packages WHERE corpus_release_id='1b70bbc8b615e1195a71ba5f9ce9aad88542e2dce4c402813e372fea9277d2b6'),
  'deal_directory_records', (SELECT count(*) FROM canonical_v2_staging.deal_serving_directory WHERE corpus_release_id='1b70bbc8b615e1195a71ba5f9ce9aad88542e2dce4c402813e372fea9277d2b6'),
  'complete_receipts', (SELECT count(*) FROM canonical_v2_staging.candidate_release_import_receipts WHERE corpus_release_id='1b70bbc8b615e1195a71ba5f9ce9aad88542e2dce4c402813e372fea9277d2b6' AND import_state='IMPORTED_COMPLETE'),
  'termination_fee_row', (SELECT count(*) FROM canonical_v2_staging.shared_serving_rows WHERE corpus_release_id='1b70bbc8b615e1195a71ba5f9ce9aad88542e2dce4c402813e372fea9277d2b6' AND metric_key='SELLER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE'),
  'termination_graph_provisions', (SELECT count(*) FROM canonical_v2_staging.provision_instances WHERE closure_id='6e59b62130b2c0bac205251bf936c7aaca55b84ed9251971a1528870b17672a2'),
  'termination_graph_relationships', (SELECT count(*) FROM canonical_v2_staging.relationship_revisions WHERE closure_id='6e59b62130b2c0bac205251bf936c7aaca55b84ed9251971a1528870b17672a2')
) AS after_state;
ROLLBACK;
