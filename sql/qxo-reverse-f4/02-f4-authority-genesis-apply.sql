BEGIN;
SET LOCAL statement_timeout='20000ms';
SELECT public.canonical_v2_write(
  'staging',
  'FIXTURE_CORRECTION_AUTHORITY',
  'canonical-v2-empty-correction-authority-f4-genesis-v1',
  'adb5e9714e2b98af86748211c06b0a95bcdef59f155336b0b87ea892a06764b0',
  $qxo_f4_05da47d3940e1062${"correction_authority_materialisations":[],"correction_discharge_map":{"schema_version":"CORRECTION_DISCHARGE_MAP/V1","stage":"POST_SCOPE","contract_fingerprint":"d4ce5235be1818a42d9aba0dfb34198456eb062381e7d7db7b8289dd88671c74","ordered_entries":[],"counts":{"ordered_entries":0},"roots":{"active_correction_application_root":"8c36140f8969e47ed58cbc60bb3d53bf74cce4596b094354f31336716354cd77","correction_authority_materialisation_root":"656201c0ad2a05e7b645e8f60a6192fdbb5a67ccaaa173a27af10c0e89badf8e"},"status":"PASS","canonical_payload_digest":"5be882158e8204d75d00e4e6d5761b718e8c72e8e6b7177f71a3e13f229bfa6f","correction_discharge_map_id":"aff8a0ea09b2689313f18ee47d74d2f805062e2bbf5c54f3ca24e51f9b753aa5"},"candidate_input_event":{"schema_version":"CANDIDATE_INPUT_EVENT/V1","environment":"staging","contract_fingerprint":"d4ce5235be1818a42d9aba0dfb34198456eb062381e7d7db7b8289dd88671c74","generation":1,"transition":"INITIALISE","predecessor_candidate_input_head_id":null,"predecessor_candidate_input_head_payload_digest":null,"successor_candidate_input_head_id":"5891c0424afd3eadda631b9a5cfdf37764e1d657bde91041ca9a13ad54655821","successor_candidate_input_head_payload_digest":"f7325a655d34e761bd2a2040d5f42d91238ac51a5e5d50ea1b44fd70619bf57f","correction_discharge_map_id":"aff8a0ea09b2689313f18ee47d74d2f805062e2bbf5c54f3ca24e51f9b753aa5","correction_discharge_map_payload_digest":"5be882158e8204d75d00e4e6d5761b718e8c72e8e6b7177f71a3e13f229bfa6f","status":"PASS","canonical_payload_digest":"b0819698de8116d69a9327a2d8d2abe163db7bdd2d78e8a822e7d10ac4d60136","candidate_input_event_id":"93f222d826590c7fc33c8790d0aafaf8c83034296ef26a33eabb5965a100239f"},"expected_candidate_input_head":null,"next_candidate_input_head":{"schema_version":"CANDIDATE_INPUT_HEAD/V1","environment":"staging","contract_fingerprint":"d4ce5235be1818a42d9aba0dfb34198456eb062381e7d7db7b8289dd88671c74","generation":1,"correction_discharge_map_id":"aff8a0ea09b2689313f18ee47d74d2f805062e2bbf5c54f3ca24e51f9b753aa5","correction_discharge_map_payload_digest":"5be882158e8204d75d00e4e6d5761b718e8c72e8e6b7177f71a3e13f229bfa6f","previous_candidate_input_head_id":null,"status":"SEALED","canonical_payload_digest":"f7325a655d34e761bd2a2040d5f42d91238ac51a5e5d50ea1b44fd70619bf57f","candidate_input_head_id":"5891c0424afd3eadda631b9a5cfdf37764e1d657bde91041ca9a13ad54655821"}}$qxo_f4_05da47d3940e1062$::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  $qxo_f4_cbef517134c95a9d${"receiptId":"217705cb474748bd414516ec66df30eb7b139abd6b0977c3d84b1a18cb426d28","operation":"FIXTURE_CORRECTION_AUTHORITY","idempotencyKey":"canonical-v2-empty-correction-authority-f4-genesis-v1","inputDigest":"adb5e9714e2b98af86748211c06b0a95bcdef59f155336b0b87ea892a06764b0","status":"COMMITTED","publishableObjectCount":3,"residualCount":0,"quarantinedClosureCount":0}$qxo_f4_cbef517134c95a9d$::jsonb
) AS authority_result;
DO $qxo_f4_authority_gate$
BEGIN
  IF (SELECT count(*) FROM canonical_v2_staging.candidate_input_heads
      WHERE environment='staging'
        AND contract_fingerprint='d4ce5235be1818a42d9aba0dfb34198456eb062381e7d7db7b8289dd88671c74'
        AND candidate_input_head_id='5891c0424afd3eadda631b9a5cfdf37764e1d657bde91041ca9a13ad54655821'
        AND candidate_input_head_payload_digest='f7325a655d34e761bd2a2040d5f42d91238ac51a5e5d50ea1b44fd70619bf57f') <> 1 THEN
    RAISE EXCEPTION 'the exact F4 candidate-input head is missing';
  END IF;
  IF (SELECT count(*) FROM canonical_v2_staging.write_receipts
      WHERE operation='FIXTURE_CORRECTION_AUTHORITY'
        AND idempotency_key='canonical-v2-empty-correction-authority-f4-genesis-v1'
        AND input_digest='adb5e9714e2b98af86748211c06b0a95bcdef59f155336b0b87ea892a06764b0'
        AND receipt_id='217705cb474748bd414516ec66df30eb7b139abd6b0977c3d84b1a18cb426d28'
        AND canonical_payload=$qxo_f4_cbef517134c95a9d${"receiptId":"217705cb474748bd414516ec66df30eb7b139abd6b0977c3d84b1a18cb426d28","operation":"FIXTURE_CORRECTION_AUTHORITY","idempotencyKey":"canonical-v2-empty-correction-authority-f4-genesis-v1","inputDigest":"adb5e9714e2b98af86748211c06b0a95bcdef59f155336b0b87ea892a06764b0","status":"COMMITTED","publishableObjectCount":3,"residualCount":0,"quarantinedClosureCount":0}$qxo_f4_cbef517134c95a9d$::jsonb) <> 1 THEN
    RAISE EXCEPTION 'the exact F4 correction-authority receipt is missing';
  END IF;
END;
$qxo_f4_authority_gate$;
COMMIT;
