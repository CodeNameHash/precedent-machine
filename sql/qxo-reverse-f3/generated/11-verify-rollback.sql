BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout='60000ms';
DO $qxo_f3_rollback_after$
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
      AND canonical_payload=$qxo_f3_40fb5eddd8fd2dee${"schema_version":"FIXTURE_ACTIVE_RELEASE_POINTER/V2","environment":"staging","pointer_id":"eda01d9851522edada42a76f1bb1afebd8061528166523124bed3a20c9babf8b","corpus_release_id":"c9c19dc1ad92496953ee04f52b4a8dc575ea21ab9502acfd449a9299055817d3","serving_namespace_id":"9270602408312e80a65c0ce46b895fa2c8f07d1c676aef5bd171029edd209b68","candidate_release_manifest_id":"4e955c415bcb4c4e32e818bad11f82e48e247c3e12efee9a5e120d927a6ecf98","correction_input_seal_id":"7fe908d2a5e359f8f87bb8f72e204a90fa4e25a73da4f8588be1350f6ba2a8bd","correction_input_root":"aa260ffdf873a51a93b23f6f85173de1a1183e21ade0668aa5a45977cb0f8012","previous_pointer_id":"15a0e13f45ad596d468b9cfa2878a456ac56c3b84d15a185c0a96dca5ef022a1","generation":8,"canonical_payload_digest":"08e39195cf12156204fa9d129e438ae5dd89a27b35024f91645c9937b4105c69"}$qxo_f3_40fb5eddd8fd2dee$::jsonb) <> 1 THEN
    RAISE EXCEPTION 'the F3 rollback changed the active staging pointer';
  END IF;
  IF EXISTS (SELECT 1 FROM canonical_v2_staging.fixture_corpus_releases
      WHERE corpus_release_id='4d0aaa6cc4a2f208626c446f1a01f98def3a661f50a2db916af0bb8027b19589')
    OR EXISTS (SELECT 1 FROM canonical_v2_staging.candidate_release_import_receipts
      WHERE corpus_release_id='4d0aaa6cc4a2f208626c446f1a01f98def3a661f50a2db916af0bb8027b19589')
    OR EXISTS (SELECT 1 FROM canonical_v2_staging.market_observations
      WHERE corpus_release_id='4d0aaa6cc4a2f208626c446f1a01f98def3a661f50a2db916af0bb8027b19589')
    OR EXISTS (SELECT 1 FROM canonical_v2_staging.market_metric_slot_exclusions
      WHERE corpus_release_id='4d0aaa6cc4a2f208626c446f1a01f98def3a661f50a2db916af0bb8027b19589')
    OR EXISTS (SELECT 1 FROM canonical_v2_staging.shared_serving_rows
      WHERE corpus_release_id='4d0aaa6cc4a2f208626c446f1a01f98def3a661f50a2db916af0bb8027b19589')
    OR EXISTS (SELECT 1 FROM canonical_v2_staging.reviewed_source_specific_serving_rows
      WHERE corpus_release_id='4d0aaa6cc4a2f208626c446f1a01f98def3a661f50a2db916af0bb8027b19589')
    OR EXISTS (SELECT 1 FROM canonical_v2_staging.exact_detail_serving_packages
      WHERE corpus_release_id='4d0aaa6cc4a2f208626c446f1a01f98def3a661f50a2db916af0bb8027b19589')
    OR EXISTS (SELECT 1 FROM canonical_v2_staging.candidate_release_semantic_graphs
      WHERE corpus_release_id='4d0aaa6cc4a2f208626c446f1a01f98def3a661f50a2db916af0bb8027b19589')
    OR EXISTS (SELECT 1 FROM canonical_v2_staging.deal_serving_directory
      WHERE corpus_release_id='4d0aaa6cc4a2f208626c446f1a01f98def3a661f50a2db916af0bb8027b19589')
    OR EXISTS (SELECT 1 FROM canonical_v2_staging.candidate_release_correction_input_seals
      WHERE corpus_release_id='4d0aaa6cc4a2f208626c446f1a01f98def3a661f50a2db916af0bb8027b19589')
    OR EXISTS (SELECT 1 FROM canonical_v2_staging.candidate_release_correction_discharges
      WHERE corpus_release_id='4d0aaa6cc4a2f208626c446f1a01f98def3a661f50a2db916af0bb8027b19589') THEN
    RAISE EXCEPTION 'the inactive F3 serving partition was not removed exactly';
  END IF;
END;
$qxo_f3_rollback_after$;
SELECT jsonb_build_object(
  'active_release', (SELECT corpus_release_id FROM canonical_v2_staging.active_corpus_release_pointers WHERE environment='staging'),
  'removed_inactive_f3_release', '4d0aaa6cc4a2f208626c446f1a01f98def3a661f50a2db916af0bb8027b19589',
  'f3_release_rows', (SELECT count(*) FROM canonical_v2_staging.fixture_corpus_releases WHERE corpus_release_id='4d0aaa6cc4a2f208626c446f1a01f98def3a661f50a2db916af0bb8027b19589'),
  'f3_import_receipts', (SELECT count(*) FROM canonical_v2_staging.candidate_release_import_receipts WHERE corpus_release_id='4d0aaa6cc4a2f208626c446f1a01f98def3a661f50a2db916af0bb8027b19589')
) AS rollback_state;
ROLLBACK;
