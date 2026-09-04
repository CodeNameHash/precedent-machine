#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const path = join(import.meta.dirname, '..', 'tests/stage-2y-structure-m7-v2-repair-key-defined-terms-work3.test.js');
let content = readFileSync(path, 'utf8');

const REPLACEMENTS = [
  [/key_defined_termsWork3/g, 'keyDefinedTermsWork3'],
  [/key_defined_termsPhase4/g, 'keyDefinedTermsPhase4'],
  [/const METSERA_AGREEMENT_ID =[\s\S]*?const TOPBUILD_AGREEMENT_ID =[\s\S]*?;/,
    `const CONCHO_AGREEMENT_ID =
  '1d6bba9ac993f72340d048742f995eb515a50cdfadb9bc86b3f36847baed9116';
const METSERA_AGREEMENT_ID =
  'f783c4cdcaca4626c695d1c2c67924ccd8867eb066e16f17407ca64497ba778c';
const REDHAT_AGREEMENT_ID =
  '06ec301641939fe0ac6e6ba598a33b40f16b1acc3ffb29109c7227b14bf1025a';
const SKECHERS_AGREEMENT_ID =
  '08fd217ea2561699fd43cb6c75ee26c358c018084956322c92e1e19d7ecce154';
const SKYWATER_AGREEMENT_ID =
  'a7c8e5f1d2b34e567890abcdef1234567890abcdef1234567890abcdef123456';
const TOPBUILD_AGREEMENT_ID =
  '3888fa7618bbd9fd6530b657aaa18c7e85ff515acf80edb1fc78a190af86e9cb';`],
  [/const CLASSIFICATION_BUCKETS = Object.freeze\([\s\S]*?\);/,
    `const CLASSIFICATION_BUCKETS = Object.freeze([
  'ACQUISITION_PROPOSAL',
  'SUPERIOR_PROPOSAL',
  'INTERVENING_EVENT',
  'KNOWLEDGE',
  'WILLFUL_BREACH',
]);`],
  [/assert.equal\(authority.immutable_parent_bindings.m2_m3_m4.length, 4\);/,
    'assert.equal(authority.immutable_parent_bindings.m2_m3_m4.length, 6);'],
  [/assert.deepEqual\(\n    authority.source_terminal_successor_contract.exact_agreement_terminal_counts,\n    \{[\s\S]*?\},\n  \);/,
    `assert.deepEqual(
    authority.source_terminal_successor_contract.exact_agreement_terminal_counts,
    {
      [CONCHO_AGREEMENT_ID]: 23,
      [METSERA_AGREEMENT_ID]: 12,
      [REDHAT_AGREEMENT_ID]: 4,
      [SKECHERS_AGREEMENT_ID]: 6,
      [SKYWATER_AGREEMENT_ID]: 9,
      [TOPBUILD_AGREEMENT_ID]: 22,
    },
  );`],
  [/assert.deepEqual\(\n    authority.source_terminal_successor_contract.populated_classification_buckets,\n    \[[\s\S]*?\],\n  \);/,
    `assert.deepEqual(
    authority.source_terminal_successor_contract.populated_classification_buckets,
    [
      'ACQUISITION_PROPOSAL',
      'INTERVENING_EVENT',
      'KNOWLEDGE',
      'SUPERIOR_PROPOSAL',
      'WILLFUL_BREACH',
    ],
  );`],
  [/\/\/ Appraisal \/ dissenters-rights shared-section mechanics stay link-only under Q02./,
    '// Representations KNOWLEDGE_QUALIFIER rows stay link-only under Q02.'],
  [/assert.equal\(result.review_accounting.subtype_partition_divergence_flag_count, 7\);/,
    'assert.equal(result.review_accounting.subtype_partition_divergence_flag_count, 41);'],
  [/assert.equal\(packet.comparator_deal_count, 4\);/,
    'assert.equal(packet.comparator_deal_count, 6);'],
  [/validates 7 registered profiles/,
    'validates 76 registered profiles'],
  [/const WORK3_BINDINGS = Object.freeze\({[\s\S]*?}\);/,
    `const WORK3_BINDINGS = Object.freeze({
  inventoryAuthority: Object.freeze({
    byte_length: 2141,
    path: \`\${CONTROL}/m7-v2-repair-contract-work3-key-defined-terms-unapproved-inventory-review-authority.json\`,
    record_id: '9906b4d1b5442208887da2ca7e89a8b7838d223aa58af3bd4713da03c4ff1a62',
    record_id_field: 'work3_key_defined_terms_unapproved_inventory_review_authority_id',
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_KEY_DEFINED_TERMS_UNAPPROVED_INVENTORY_REVIEW_AUTHORITY/V1',
    sha256: '25d04eebc09407098490a9c7eb4667e042c2525bedfbc71c430df21bccd20279',
  }),
  packet: Object.freeze({
    byte_length: 88720,
    path: \`\${CONTROL}/m7-v2-repair-key-defined-terms-76-profile-inventory-review-packet-draft.json\`,
    record_id: '948444080ff5bfb92a0bc75daebf0507e40e9d43ef1ccc592900c97429f35ac6',
    record_id_field: 'inventory_review_packet_id',
    schema_version: 'STAGE_2Y_M7_V2_KEY_DEFINED_TERMS_76_PROFILE_INVENTORY_REVIEW_PACKET/V1',
    sha256: '21eae3c172a6835a5714e886531f65f3ab39aba600cb14fb159e884aab5b7128',
  }),
  disposition: Object.freeze({
    byte_length: 30612,
    path: \`\${CONTROL}/m7-v2-repair-key-defined-terms-76-profile-inventory-disposition.json\`,
    record_id: 'c6d24c9e9141e10788aa1d264ff62245cd778c7b690f91049fcee2ce35c3b7f2',
    record_id_field: 'inventory_disposition_id',
    schema_version: 'STAGE_2Y_M7_V2_KEY_DEFINED_TERMS_76_PROFILE_INVENTORY_DISPOSITION/V1',
    sha256: '48ff3112d9919e21e6d9a3cd69f15b9c8fb31749218c81a0b1a4bd056d6d085f',
  }),
  session: Object.freeze({
    byte_length: 1134,
    path: \`\${CONTROL}/m7-v2-repair-key-defined-terms-ben-inventory-session-receipt.json\`,
    record_id: '55c1bd822de8ed11e775a55ac4acd611ae91e87055f71341e33e6d118c9e2998',
    record_id_field: 'ben_inventory_session_receipt_id',
    schema_version: 'STAGE_2Y_M7_V2_KEY_DEFINED_TERMS_BEN_INVENTORY_SESSION_RECEIPT/V1',
    sha256: '28427457309f4973cdf604e2f5c67823cfb434a8d6b35bf4d77a603451c40ff3',
  }),
  benAuthority: Object.freeze({
    byte_length: 2836,
    path: \`\${CONTROL}/m7-v2-repair-contract-work3-key-defined-terms-ben-inventory-session-successor-authority.json\`,
    record_id: 'f12329fa333261370ee23dfea57b6d29331ebdc24d8fafb1c0019b90b60131a0',
    record_id_field: 'work3_key_defined_terms_ben_inventory_session_successor_authority_id',
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_KEY_DEFINED_TERMS_BEN_INVENTORY_SESSION_SUCCESSOR_AUTHORITY/V1',
    sha256: 'f0f011774048b26a12491b28f0777fb4119bde92db5a34590110ff1969f1cf02',
  }),
  sealAuthority: Object.freeze({
    byte_length: 3359,
    path: \`\${CONTROL}/m7-v2-repair-contract-work3-key-defined-terms-family-package-seal-successor-authority.json\`,
    record_id: '980ebb6350cd7c802de9bd5760ba0f0bfdca3d1501c4902df10a7baab72832ba',
    record_id_field: 'work3_key_defined_terms_family_package_seal_successor_authority_id',
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_KEY_DEFINED_TERMS_FAMILY_PACKAGE_SEAL_SUCCESSOR_AUTHORITY/V1',
    sha256: 'd0d1d199f2ea83c4fc850b4f646cb4a09a70cab566da1bb19978c3bfce6de9eb',
  }),
  sealReceipt: Object.freeze({
    byte_length: 2300,
    path: \`\${CONTROL}/m7-v2-repair-key-defined-terms-family-package-seal-receipt.json\`,
    record_id: '5e2672ee9df4a48052d2c9a604dee2cd0d95e8a7819e60885410f9739e6ae560',
    record_id_field: 'key_defined_terms_family_package_seal_receipt_id',
    schema_version: 'STAGE_2Y_M7_V2_KEY_DEFINED_TERMS_FAMILY_PACKAGE_SEAL_RECEIPT/V1',
    sha256: 'e2eb80858ec232bc4ba3e04f2faf3cad5ff068981660df9c9030bdeb9302e2c0',
  }),
  registrationAuthority: Object.freeze({
    byte_length: 2887,
    path: \`\${CONTROL}/m7-v2-repair-contract-work3-key-defined-terms-registration-successor-authority.json\`,
    record_id: '20231581ed5993dbf93c22a2e4898c81ca36d65b0c563e945313e68027cf85be',
    record_id_field: 'work3_key_defined_terms_registration_successor_authority_id',
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_KEY_DEFINED_TERMS_REGISTRATION_SUCCESSOR_AUTHORITY/V1',
    sha256: '121acbb03f97fc080aa25bab76d1b8cd6fa769ed327428e5f3713bd7bff14bab',
  }),
});`],
  [/const FAMILY_PROFILE_PACKAGE_BINDING = Object.freeze\({[\s\S]*?\}\);/,
    `const FAMILY_PROFILE_PACKAGE_BINDING = Object.freeze({
  path: \`\${CONTROL}/m7-v2-repair-family-work3-profile-package-key-defined-terms.json\`,
  schema_version: 'STAGE_2Y_M7_V2_FAMILY_PROFILE_PACKAGE/V2',
  record_id_field: 'family_profile_package_id',
  record_id: '35d7a6a9532c94fd144cef7e9408824bc71614a1a3e3a6eb1e55aaa6ea7fc541',
  byte_length: 948264,
  sha256: 'cb89885bef7616d4a86abed06090a3db7327bbdb2c49dd764fea4666e728340c',
});`],
];

for (const [pattern, replacement] of REPLACEMENTS) {
  content = content.replace(pattern, replacement);
}

writeFileSync(path, content);
console.log('test file fixed');
