#!/usr/bin/env node

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  runStagingSecSource,
} from './lib/canonical-v2-staging-sec-source.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const VERVE_SEC_SOURCE_PROFILE = Object.freeze({
  schema_version: 'STAGING_SEC_SOURCE_PROFILE/V1',
  source_key: 'VERVE_AGREEMENT',
  source_locator_deal_id: '320a3899-0d74-42d6-a412-3a962997d6ca',
  source_role: 'AGREEMENT',
  url: 'https://www.sec.gov/Archives/edgar/data/1840574/000119312525141748/d30505dex21.htm',
  required_document_anchors: Object.freeze([
    'AGREEMENT AND PLAN OF MERGER',
    'ELI LILLY AND COMPANY',
    'VERVE THERAPEUTICS, INC.',
  ]),
  retrieval_url_sha256: '3b03a37147053b2c2d9bd78f4f3804e53520160292b17b53700a9a1a316fe437',
  response_bytes_sha256: '0c5317d92be7616364e801ecff9b90c950e466d3e4787f6821294b6bf095317c',
  response_byte_length: 600876,
  intake_idempotency_key: 'VERVE_SEC_AGREEMENT_INTAKE_V1',
  artifact_idempotency_prefix: 'VERVE_SEC_AGREEMENT_ARTIFACT_V1',
  admission_idempotency_key: 'VERVE_SEC_AGREEMENT_SOURCE_ADMISSION_V1',
  expected: Object.freeze({
    retrieval_policy_digest: '9caf62ecf8a92ceaaebc85964464f0e45ded364e09025151924b012a4ad7ff06',
    retrieved_at: '2026-07-24T21:02:33.849Z',
    source_response_content_id: 'c4eaa807a0322559c1204329dc411a701c711a0a27e03501c691e82f94d31f02',
    intake_capture_receipt_id: '152dfb86a496d533c0d0f78d36be8bda1726ea70a418251a70cd4de1f6bcda09',
    converter_digest: 'b991c2619a03b4ea0930cc54264e68f6f40ca6beabec87e56d26a93fcb3df6f3',
    converter_config_digest: '5aa439406823ac17104228b41fcbf9f4fccbbe92623261b66147c2c680331055',
    verifier_digest: 'a5d20173180da7dc17a4b3efe98f1157adc262c94a736c1b46e669a47f9813a2',
    canonical_text_sha256: '90242bd60f9a28464c42344f4f92a7e024b0c5825ca9b8374f72e7dc754203a4',
    canonical_text_byte_length: 369081,
    canonical_text_id: '0ec7f053b719c7091b24f3ccee8df3a5290e53f9cb895ccfbb6264587d98fdff',
    source_map_digest: 'f29b7558f937979d8e68b9b75a640fe01c68ff8a2600455294462d9fad54d894',
    verification_manifest_id: '52012003678fe2fac24c909d72aad69385b2de38e5ca35aee9bdac8e1287f2d3',
    artifact_manifest_id: '23822281c78b355ce8e95ec8489d896e2e5c0ba53a3b6ba5479649494ac1841e',
    artifact_chunk_ids: Object.freeze([
      '6b700dd2b56072c2f9605dffde07984fad8cfd37bc50c5f35bc6822b328f03f3',
      '1a81092ac8cf4cf0555a497a3f61f8288bdabc23e1804bcc313ce323d1eebe93',
      'b1a35a9d2ec1735b358da12929295aee5f332171ce39641df19c0ffeb0c61324',
      '5fadc4c6e80f8171470949c2544cc3f813f9cf09221925754f1a8f058cdb54dc',
      'e79e3b371f92b20527027bc32788272857670033b78565be6705e15cbfbd4bb6',
      '0489cc7e582c928ed555db42845b28ab4b9ef918440f4f837cd9a9f5fc6d8624',
      'c69794ab2eade53635eb693cf0c9acd7d44052c2ade76325029f7d57dc8a68fa',
      '7ed9872b1ec16b37ee9a5c0e8e6041c22d9573269c1e658da973b638a0edc800',
      'd75cc422f76adfefec97aa6c3b26d196265c89620c0c2a969f411a8ccab036aa',
      'df5781f469950105f867be46f279359176b9e3e12e4f1a71110a7ad1969bb4a3',
      'bda5cbc74042461d8a07d1a8ee0f04799691918658f2fcb481c29e785c580541',
    ]),
    artifact_chunk_sha256: Object.freeze([
      'd959a4f9cb9657c3b5a5057740d634c54dfa42264d5e05a02c7d0e8e02f9f856',
      'cc764798edaa28bbee92e134630b74b4aee898181201bf52d9876fbfdf2123f5',
      'b35995fb3989bbe1455dcc799bcb21701bf1f704d873ec64222ceba6b3017b3c',
      '94d98683c40c24536c8ac2be04ba1c10695da99739065333946df570ddc9d79a',
      'd9d448c4355843838a2e3fa3b90d24ad3a8d5522a1075a32fb1bdcd9efb4a1b5',
      '76ec12c976364a1199de83dee58565aa638315e43ca767377174e82a96ca435d',
      '08c3b673027b752da9a76e850eff7fdf9d977b96804b71b6312c06af9ebe1a0f',
      'b26b6265d032e9004bbae601691df65f3e64cdde89b760c8dd81acd42aff9622',
      '52a54aca7a8791c3a7515d60b8e0be4225845ded7dfa5ec75394a44035315d22',
      '01bf7170ad84dd699064d7bebad31990621f05d0477d4c59a3ecd08a781f895f',
      'c5009178060a2d11209329555c915942714d7560d6d018d28101a6036fd158fa',
    ]),
    artifact_chunk_count: 11,
    immutable_source_document_id: '3b0819e1c9e115b08f68ab0c7c782d55ad2488ba612cf11491ccc0f41f390199',
    source_admission_manifest_id: '4d4c85d78f82924a25cb998d2298a9ec0d0c6ec3c359ae906b007c7dcc696be5',
    source_admission_preparation_receipt_id: '06eadf14f2330aa079df5546ebb6f9987ec62405291511525564845cfdaf962b',
    semantic_extraction_input_envelope_id: 'ab1fd868246e8ad75ba741ce41f3f53a3c9a947e4cc3e0d4a7e01717b2438a85',
    verified_sec_source_admission_bundle_id: '887fb7b4bd52a148bcb65543440153dc36782fc526906776690ac6aee7df7f39',
  }),
});

const MODES = Object.freeze({
  '--dry-run': 'DRY_RUN',
  '--apply': 'APPLY',
  '--verify': 'VERIFY',
});
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const mode = MODES[process.argv[2]];
  if (!mode || process.argv.length !== 3) {
    process.stderr.write(
      'Usage: node scripts/canonical-v2-staging-verve-sec-source.mjs --dry-run|--apply|--verify\n',
    );
    process.exit(1);
  }

  try {
    const result = await runStagingSecSource({
      root: ROOT,
      profile: VERVE_SEC_SOURCE_PROFILE,
      mode,
    });
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : 'Verve SEC source admission failed.'}\n`,
    );
    process.exit(1);
  }
}
