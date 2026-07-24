BEGIN;
SET LOCAL statement_timeout='20000ms';
SELECT public.canonical_v2_write(
  'staging',
  'FIXTURE_CORRECTION_AUTHORITY',
  'canonical-v2-empty-correction-authority-f3-genesis-v1',
  '550354e29b2c28c342b1358e441d17ef32fd71d97a2b66e101e9346845891c9f',
  $qxo_f3_29382c3ba1fd8adc${"correction_authority_materialisations":[],"correction_discharge_map":{"schema_version":"CORRECTION_DISCHARGE_MAP/V1","stage":"POST_SCOPE","contract_fingerprint":"5cc5607bee8fc816e8682f71b9482ff839ff744cebaaf0f26bfcfa54ea64512c","ordered_entries":[],"counts":{"ordered_entries":0},"roots":{"active_correction_application_root":"8c36140f8969e47ed58cbc60bb3d53bf74cce4596b094354f31336716354cd77","correction_authority_materialisation_root":"656201c0ad2a05e7b645e8f60a6192fdbb5a67ccaaa173a27af10c0e89badf8e"},"status":"PASS","canonical_payload_digest":"9850f0c8647252a48f6f5b0c08b923478bc98f73241d4e11ba480d00213fdeef","correction_discharge_map_id":"d66a396e481c474fca7cb4788d2a958c477b8d780357307077b44e7aedea31fd"},"candidate_input_event":{"schema_version":"CANDIDATE_INPUT_EVENT/V1","environment":"staging","contract_fingerprint":"5cc5607bee8fc816e8682f71b9482ff839ff744cebaaf0f26bfcfa54ea64512c","generation":1,"transition":"INITIALISE","predecessor_candidate_input_head_id":null,"predecessor_candidate_input_head_payload_digest":null,"successor_candidate_input_head_id":"9e55ff718243a0bbea32ac33d8888788c121ac94d9b3f89ec6697d9d4953344a","successor_candidate_input_head_payload_digest":"5591958f2112aed92f374cd51073958fe0ec448d0923aab6157a3fc64f8e21d0","correction_discharge_map_id":"d66a396e481c474fca7cb4788d2a958c477b8d780357307077b44e7aedea31fd","correction_discharge_map_payload_digest":"9850f0c8647252a48f6f5b0c08b923478bc98f73241d4e11ba480d00213fdeef","status":"PASS","canonical_payload_digest":"ef3a68c38e943299d6b648fdd9f942c9f27f040bd06e89e22e013d717a158c1a","candidate_input_event_id":"6bb51aa9dc5ae54f2ca2b91b79c973eadd42563b6f9fdc8f64d6800c071f0ec4"},"expected_candidate_input_head":null,"next_candidate_input_head":{"schema_version":"CANDIDATE_INPUT_HEAD/V1","environment":"staging","contract_fingerprint":"5cc5607bee8fc816e8682f71b9482ff839ff744cebaaf0f26bfcfa54ea64512c","generation":1,"correction_discharge_map_id":"d66a396e481c474fca7cb4788d2a958c477b8d780357307077b44e7aedea31fd","correction_discharge_map_payload_digest":"9850f0c8647252a48f6f5b0c08b923478bc98f73241d4e11ba480d00213fdeef","previous_candidate_input_head_id":null,"status":"SEALED","canonical_payload_digest":"5591958f2112aed92f374cd51073958fe0ec448d0923aab6157a3fc64f8e21d0","candidate_input_head_id":"9e55ff718243a0bbea32ac33d8888788c121ac94d9b3f89ec6697d9d4953344a"}}$qxo_f3_29382c3ba1fd8adc$::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  $qxo_f3_157bda06b0647d02${"receiptId":"2dd7cbf3dddea6810a034fd119fcc9d80735e8ce16c4d266287a3c288aeb9e7f","operation":"FIXTURE_CORRECTION_AUTHORITY","idempotencyKey":"canonical-v2-empty-correction-authority-f3-genesis-v1","inputDigest":"550354e29b2c28c342b1358e441d17ef32fd71d97a2b66e101e9346845891c9f","status":"COMMITTED","publishableObjectCount":3,"residualCount":0,"quarantinedClosureCount":0}$qxo_f3_157bda06b0647d02$::jsonb
) AS authority_result;
DO $qxo_f3_authority_gate$
BEGIN
  IF (SELECT count(*) FROM canonical_v2_staging.candidate_input_heads
      WHERE environment='staging'
        AND contract_fingerprint='5cc5607bee8fc816e8682f71b9482ff839ff744cebaaf0f26bfcfa54ea64512c'
        AND candidate_input_head_id='9e55ff718243a0bbea32ac33d8888788c121ac94d9b3f89ec6697d9d4953344a'
        AND candidate_input_head_payload_digest='5591958f2112aed92f374cd51073958fe0ec448d0923aab6157a3fc64f8e21d0') <> 1 THEN
    RAISE EXCEPTION 'the exact F3 candidate-input head is missing';
  END IF;
  IF (SELECT count(*) FROM canonical_v2_staging.write_receipts
      WHERE operation='FIXTURE_CORRECTION_AUTHORITY'
        AND idempotency_key='canonical-v2-empty-correction-authority-f3-genesis-v1'
        AND input_digest='550354e29b2c28c342b1358e441d17ef32fd71d97a2b66e101e9346845891c9f'
        AND receipt_id='2dd7cbf3dddea6810a034fd119fcc9d80735e8ce16c4d266287a3c288aeb9e7f'
        AND canonical_payload=$qxo_f3_157bda06b0647d02${"receiptId":"2dd7cbf3dddea6810a034fd119fcc9d80735e8ce16c4d266287a3c288aeb9e7f","operation":"FIXTURE_CORRECTION_AUTHORITY","idempotencyKey":"canonical-v2-empty-correction-authority-f3-genesis-v1","inputDigest":"550354e29b2c28c342b1358e441d17ef32fd71d97a2b66e101e9346845891c9f","status":"COMMITTED","publishableObjectCount":3,"residualCount":0,"quarantinedClosureCount":0}$qxo_f3_157bda06b0647d02$::jsonb) <> 1 THEN
    RAISE EXCEPTION 'the exact F3 correction-authority receipt is missing';
  END IF;
END;
$qxo_f3_authority_gate$;
ROLLBACK;
