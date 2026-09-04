#!/usr/bin/env node

import { createHash, randomBytes } from 'node:crypto';
import {
  closeSync,
  existsSync,
  fstatSync,
  fsyncSync,
  linkSync,
  lstatSync,
  openSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import canonicalModule from '../lib/canonical-v2/canonical-bytes.js';
import { validateSingleFamilyPackageInventory } from '../lib/canonical-v2/m7-v2-contract.js';

const { canonicalJson, contentId, sha256Hex } = canonicalModule;
const REPO_ROOT = join(import.meta.dirname, '..');
const CONTROL = 'evidence/canonical-v2/stage-2y-structure-migration/control';
const RULING_PATH =
  'docs/codex-program/notes/N1-BEN-LEGAL-RULINGS-RECEIPT-2026-09-01B.json';
const SMALL_BRIEF_PATH =
  'docs/codex-program/notes/BRIEF-SMALL-FAMILIES-2026-09-01.md';
const INTERIM_BRIEF_PATH =
  'docs/codex-program/notes/BRIEF-INTERIM-OPERATING-2026-09-01.md';
const COVERAGE_LEDGER_PATH =
  'docs/codex-program/notes/V1-COVERAGE-LEDGER-2026-09-01.md';
const WORK3_AUTHORITY_PATH =
  CONTROL + '/m7-v2-repair-contract-work3-entry-correction-authority.json';
const GROUPING_FLAG = 'LEGAL_GROUPING_REVIEW_REQUIRED';
const FAMILY_PROFILE_SCHEMA = 'STAGE_2Y_M7_V2_APPROVED_FAMILY_PROFILE/V1';
const FAMILY_PACKAGE_SCHEMA = 'STAGE_2Y_M7_V2_FAMILY_PROFILE_PACKAGE/V2';
const FAMILY_APPROVAL_SCHEMA =
  'STAGE_2Y_M7_V2_FAMILY_PROFILE_PACKAGE_APPROVAL/V1';
const EXPECTED_RULING_BINDING = Object.freeze({
  byte_length: 2565,
  git_blob_oid: '8973876bc0e8560c61e2ac9760d73f43bc4662cc',
  path: RULING_PATH,
  schema_version: 'N1_BEN_LEGAL_RULINGS_RECEIPT/V1',
  sha256: '9ba8b7f30bd0513b9a98820757a6962f6d90b6ada6354bc74f299430eb022b33',
});
const EXPECTED_WORK3_AUTHORITY_BINDING = Object.freeze({
  byte_length: 237749,
  git_blob_oid: '5ff4bcd0ca719c4da97dd9bb64d610349e3d7afd',
  path: WORK3_AUTHORITY_PATH,
  record_id: '561e48f1865259ba58d69f33cefcdf1c1ac606cf9468925dee47227603fad873',
  record_id_field: 'correction_authority_id',
  schema_version: 'STAGE_2Y_M7_V2_REPAIR_WORK3_ENTRY_CORRECTION_AUTHORITY/V1',
  sha256: '42dce2b3bc1f8730bb9a9532e8e9b34872f14117a38cdd97ba1be659e7647deb',
});
const EXPECTED_SOURCE_BINDINGS = Object.freeze({
  smallBrief: {
    byte_length: 16138,
    git_blob_oid: '6927fb0ff7cc7fe4293bfc33b74f2a798f91d53a',
    path: SMALL_BRIEF_PATH,
    schema_version: null,
    sha256: '6e84ba3289e37fdfec20030e07e7a007ca317f6425419261bcaf2d3c88951841',
  },
  interimBrief: {
    byte_length: 13038,
    git_blob_oid: 'a4c37b798142c3cde4a3dacc9465f3f96e07673c',
    path: INTERIM_BRIEF_PATH,
    schema_version: null,
    sha256: 'cf9f25e7730093461f0f47e7ca4a9eb7cb75fbec64fc9ccdd40b5eee2d5005de',
  },
  coverageLedger: {
    byte_length: 7736,
    git_blob_oid: '200dc5aa5e24c3c5c67f805fd9f27b8a02ba5c94',
    path: COVERAGE_LEDGER_PATH,
    sha256: 'fcf55d8ec98c1c17da435301eda0c8526c65abfe87b7b8e6445555e1cb5d37b5',
  },
});

const CHECK_ONLY = process.argv.includes('--check');
const WRITE = process.argv.includes('--write');
const FAMILY_INDEX = process.argv.indexOf('--family');
const SELECTED_FAMILY = FAMILY_INDEX === -1 ? null : process.argv[FAMILY_INDEX + 1];

if (CHECK_ONLY === WRITE) {
  throw new Error('use exactly one of --check or --write');
}
if (FAMILY_INDEX !== -1 && SELECTED_FAMILY === undefined) {
  throw new Error('--family requires a family key or slug');
}

function packagePath(slug) {
  return CONTROL + '/m7-v2-repair-family-work3-profile-package-' + slug + '.json';
}

function successorPackagePath(slug) {
  return CONTROL + '/m7-v2-repair-family-work3-profile-package-' + slug
    + '-grouping-successor-2026-09-01B.json';
}

const CONFIGS = Object.freeze([
  {
    familyKey: 'DIVIDENDS',
    slug: 'dividends',
    sessionStem: 'dividends',
    profileCount: 1,
    rulingOrdinal: 1,
    predecessorDisposition:
      CONTROL + '/m7-v2-repair-dividends-1-profile-inventory-disposition.json',
    expectedPredecessor: {
      byte_length: 18004,
      git_blob_oid: 'f5c2aea8d5a2ac3f3d49e02a78ba8729131bbb52',
      record_id: '4226cea7ffbdbdc8a9c7a6d5e3d57f224d96731838f87228d38592fd9221064c',
      sha256: '560ecb4655a5e9afc8388b89285f863e0179d6f3f56784bd020a93e49848dce0',
    },
  },
  {
    familyKey: 'MAE_DEFINITION',
    slug: 'mae-definition',
    sessionStem: 'mae',
    profileCount: 4,
    rulingOrdinal: 2,
    predecessorDisposition:
      CONTROL + '/m7-v2-repair-mae-4-profile-inventory-disposition.json',
    expectedPredecessor: {
      byte_length: 54673,
      git_blob_oid: '22fd4fea488e3dd08a81a63f8125a5a9cb7c114f',
      record_id: '397b293c632d87d6fe91d0d2bb6f32eb916dc8f35775e693957ef3f431be0d8e',
      sha256: 'ad1490989320e4175f3f11130abab6b4c64d6a2f25ed830d31b648effa7545f7',
    },
  },
  {
    familyKey: 'GUARANTY_FINANCING_PARTY',
    slug: 'guaranty-financing-party',
    sessionStem: 'guaranty',
    profileCount: 5,
    rulingOrdinal: 3,
    predecessorDisposition:
      CONTROL + '/m7-v2-repair-guaranty-5-profile-inventory-disposition.json',
    expectedPredecessor: {
      byte_length: 69564,
      git_blob_oid: 'da509c93746416616a887facc0f90a5cff62ec7d',
      record_id: '7aca6955f1763b0e99c560901f262ebe9b62cef750a5eada375828fbfd9f8d7e',
      sha256: '155c65d3bfd366ce28b5d889e5f05a71685081e8d12c2bc6b2c1ad7aa52552cb',
    },
  },
  {
    familyKey: 'APPRAISAL_DISSENTERS_RIGHTS',
    slug: 'appraisal-dissenters-rights',
    sessionStem: 'appraisal-dissenters-rights',
    profileCount: 5,
    rulingOrdinal: 4,
    predecessorDisposition:
      CONTROL
      + '/m7-v2-repair-appraisal-dissenters-rights-5-profile-inventory-disposition.json',
    expectedPredecessor: {
      byte_length: 70317,
      git_blob_oid: '57a5833662a0321bbf935aee38a5a5786e6d5689',
      record_id: '4d269a4c0388edfcb616f0a1aefa7dfa0465a21c327ae224d0d53fc4967d0a4f',
      sha256: 'dd5327e4037801753cb06d9725568580aca998967ae0ba9d63081ec324eb4f74',
    },
  },
  {
    familyKey: 'FINANCING_COVENANTS',
    slug: 'financing-covenants',
    sessionStem: 'financing-covenants',
    profileCount: 5,
    rulingOrdinal: 5,
    predecessorDisposition:
      CONTROL + '/m7-v2-repair-financing-covenants-5-profile-inventory-disposition.json',
    expectedPredecessor: {
      byte_length: 68149,
      git_blob_oid: 'ba38348a9e47e83e8287421841d6cda555ca79fc',
      record_id: '6306273e18b1a7ad04176ffa02ca56f31ea7a26556f4463c7c160ad4c83a51ab',
      sha256: '2e545dcb5f0c34b325b689ab951af82675d0662fbda74d2ffc80d83462942cfc',
    },
  },
  {
    familyKey: 'CONSIDERATION',
    slug: 'consideration',
    sessionStem: 'consideration',
    profileCount: 7,
    rulingOrdinal: 6,
    predecessorDisposition:
      CONTROL + '/m7-v2-repair-consideration-7-profile-inventory-disposition.json',
    expectedPredecessor: {
      byte_length: 91494,
      git_blob_oid: '2297468e2756eb8fc40e8bc845ba90bf69073ec9',
      record_id: '8803bfd2579ccb3d8a7fe51cf1f71c3a164a5d679aa3f375227bd7cf63aeb10e',
      sha256: '92127e5e1187ad9a626429aa914c9d6319254499a2eb1b36c6cfcf7ca1505320',
    },
  },
  {
    familyKey: 'INTERIM_OPERATING',
    slug: 'interim-operating',
    sessionStem: 'interim-operating',
    profileCount: 113,
    rulingOrdinal: 7,
    predecessorDisposition:
      CONTROL + '/m7-v2-repair-interim-operating-113-profile-inventory-disposition.json',
    expectedPredecessor: {
      byte_length: 1418275,
      git_blob_oid: 'e015a78b76244b847348727972fc8b216e5745af',
      record_id: '037376ce906360c30bdc15eaa1c2efc1bceba94157d46aa7305908c610cdcf3b',
      sha256: 'ea245e721869f8f20d88cec57363c5ec62402dce696e63a642442558fbd4d730',
    },
  },
]);

const EXPECTED_PREDECESSOR_CHAIN_SHA256 = Object.freeze({
  DIVIDENDS: {
    inventoryAuthority: 'b5a333dfe4bc8fc81e7a2213809e0732031223d88e288aaae5be7e0f83c3eba7',
    disposition: '44cbeeda2e96460aa1b1b1cf96ce31bc4711a50661e53e78005f94187bafcef9',
    sessionReceipt: 'e20a2a22c4ffc7aabdd12353e173e664000df9b6e80cadc73165fe388616857c',
    sealAuthority: '7941928134a8f6105ee1b02380d3aab09ac49aa6f3071b905a43caeb7245ee1b',
    package: '560ecb4655a5e9afc8388b89285f863e0179d6f3f56784bd020a93e49848dce0',
    sealReceipt: '5797baf16641401fe5d5ed63c97ff3843f4db1597bc30be745bbcf21276d2439',
    registrationAuthority:
      '893eee79fcdf885b0376ed783cff09f372ffad2fcc9fbadf91c5889d6fdf8190',
  },
  MAE_DEFINITION: {
    inventoryAuthority: '10dc754c8582b6bbd71dcec7af18f7cb28f56f6a2552f65350a0702b1d742f33',
    disposition: 'd5fe4b54e5dcb506ef459cd3aeb082e81bf50c1e18d212b7b2af20757e0d2e04',
    sessionReceipt: 'c9acf50338fbe24cded59f485e59ab983f2392976c01807aea643e93f79377fb',
    sealAuthority: '3e85694cf56ab11c92ba9873936b6fa2846994326f42c36777d22a3a2fd5d392',
    package: 'ad1490989320e4175f3f11130abab6b4c64d6a2f25ed830d31b648effa7545f7',
    sealReceipt: 'cd1c356c808a970d684c6fd4781fdf1abee1b56337ac0a91a21b33ba43739e8e',
    registrationAuthority:
      'daf7b5d3d9d040fd16d0d09dda4fc47c7c199e867b65e06f39cf5c213e635c58',
  },
  GUARANTY_FINANCING_PARTY: {
    inventoryAuthority: 'd1c1a277aeb7321934aae16a51fb47f4877074044806ffbf2d24d6cec79c819a',
    disposition: 'b80f95de50d877889528b802199f0d6844a5a66ac6218b15fb41a0aa1723fdad',
    sessionReceipt: '2f5c724c93863bff83c3c59f9e8df7ae44db81215bd4da5fb16062c9cbe3c056',
    sealAuthority: 'b80c82b25904597cdb9899ac17e8680c7fdeb6ab50899c679b141b032813ec35',
    package: '155c65d3bfd366ce28b5d889e5f05a71685081e8d12c2bc6b2c1ad7aa52552cb',
    sealReceipt: 'cf8681de66e3e64c5d072c9364dc1b3480f44f53fb3c6953cbcc3c071fe7eba0',
    registrationAuthority:
      '6f4f3fe42e537275d64c0637a7796aad95b502e7b1f54aeee96ab2165c19f464',
  },
  APPRAISAL_DISSENTERS_RIGHTS: {
    inventoryAuthority: '7b4755b9e7ea78ae447f836954a8c9c6bd255b9e11809d59790fccf9a5b6f336',
    disposition: '4f3d7d1e4a9c6f2e4da0cb8a6c0e31b734612c015da1b4f9ec67ce8de7244de2',
    sessionReceipt: '8c130e3acf625e8b968f7829ee6763fe0e330c10c6d794bc4e0449130d4db400',
    sealAuthority: '7c86fce3cd6e589d11c41815d69d4ba5c8a8897c19fb4376075ae31dd8da7dad',
    package: 'dd5327e4037801753cb06d9725568580aca998967ae0ba9d63081ec324eb4f74',
    sealReceipt: '482f07517bc2834025c96c8601c2910447e05b1364f8c89ee3b5e9bd8454cf96',
    registrationAuthority:
      'e6741fa3e6cf91ea142078fb2b4ff7ed28344c8d5283c724d0bf7bf7bb9ece02',
  },
  FINANCING_COVENANTS: {
    inventoryAuthority: 'ebde314b584e033116145acd6d9f5ab9957e95ff0e44b31d68072408356a6346',
    disposition: '98f047da7eb080c9aafff7511d1a7e462d493586f8a59ded27a8f86000a4a933',
    sessionReceipt: '2d5996eaa90bd5c9c6d950675520acb3cdae1670bd37c72b41ed9f991ddeb5d6',
    sealAuthority: 'd3190dc4d1f162637f1a31f38e37c6d8b08d422f445f0eb8f9acf9e51a347d7e',
    package: '2e545dcb5f0c34b325b689ab951af82675d0662fbda74d2ffc80d83462942cfc',
    sealReceipt: '1d94026a271b86811627f00ae0a4be0f7089b9bf40376ef9b6c4cfc12c6412cc',
    registrationAuthority:
      '4782ea179bdd004fca2c1113e17d49d154a9ea945558fc6951dc4e2abb9cef49',
  },
  CONSIDERATION: {
    inventoryAuthority: '5be5ec4fa7408273646be7d4a7b53e77c73f3d1835a16bb66d9112d3ece311b0',
    disposition: 'd0221e39b816f22c0a256f1b26e3eb4ed5208820fb5f9b07298f8cc399897e57',
    sessionReceipt: '0794273e24cb3862f8a42577c9dc4f76ca0018c923647f2e9cd10e4ace6a537a',
    sealAuthority: 'bb438787b50bac1dee294a009a7d5d753ddf8c0a53a4192456415d6ff4c7d064',
    package: '92127e5e1187ad9a626429aa914c9d6319254499a2eb1b36c6cfcf7ca1505320',
    sealReceipt: 'f94be33527b71e565712c8a2147e7d01afe79cd3d35758b2ddd8463fa308af7e',
    registrationAuthority:
      '84e34ea475a2c619133c071166dc6c1499d74afa7830ad3a49983a2867aa251a',
  },
  INTERIM_OPERATING: {
    inventoryAuthority: 'ae92136400c07668a0bc87944f3bb6c01fcb39c916e2fa998f29327b47d426df',
    disposition: '39bed2651c04612b13f7aebb3a70754b47eccffc48df511c4b7f2c04efd83e6c',
    sessionReceipt: '9e276c95eb209ac5dd446447dec57866a9bb8a4c437ebddd3a991a84b5aa54ee',
    sealAuthority: 'af81c93c0504109f15975fffef9ffaf1ecd909cf9ff4716d4c8b7443e9407fba',
    package: 'ea245e721869f8f20d88cec57363c5ec62402dce696e63a642442558fbd4d730',
    sealReceipt: 'c122ea458f115210321c16db904294874414bd179f3463632d9be02ab0adf258',
    registrationAuthority:
      '292b1a8fb16424a8845fa65e0ccbfcf2fc1837ee7349d676f9c77c87d6beac29',
  },
});

const INTERIM_LINE_ORDINALS = Object.freeze({
  'Accounting changes': { Target: [48], Parent: [] },
  'Capital expenditures': { Target: [16, 28, 38, 50, 63, 77], Parent: [] },
  'Charter and bylaws': { Target: [11, 15, 25, 75, 97, 99, 111], Parent: [96] },
  'Compensation and benefits': {
    Target: [17, 20, 34, 42, 53, 56, 58, 62, 68, 69, 70, 84, 85, 88, 100, 102, 108, 112],
    Parent: [],
  },
  'Material contracts': { Target: [19, 30, 33, 59, 67, 79, 91, 101], Parent: [] },
  'Indebtedness and loans': {
    Target: [1, 3, 14, 18, 29, 40, 52, 60, 61, 81, 87, 89, 92, 93, 98, 104, 109, 113],
    Parent: [27],
  },
  'Dividends and distributions': { Target: [8, 23, 43, 51, 64, 82], Parent: [6, 73] },
  'Hiring and termination': { Target: [10, 80, 83], Parent: [] },
  Insurance: { Target: [9, 35], Parent: [] },
  'Intellectual property': { Target: [31, 44, 45, 76], Parent: [] },
  'Securities issuances': { Target: [2, 5, 13, 24, 49, 95, 107], Parent: [39, 110] },
  'Liens and encumbrances': { Target: [103], Parent: [] },
  'Mergers and acquisitions': { Target: [47, 57, 72, 105], Parent: [7, 46] },
  'Equity repurchases': { Target: [74], Parent: [] },
  'Litigation settlements': { Target: [32, 55], Parent: [] },
  'Tax matters': {
    Target: [4, 12, 21, 22, 26, 36, 37, 41, 54, 65, 66, 71, 78, 86, 90, 94, 106],
    Parent: [],
  },
});

const INTERIM_MAPPING = new Map();
for (const [line, bands] of Object.entries(INTERIM_LINE_ORDINALS)) {
  for (const [partyBand, ordinals] of Object.entries(bands)) {
    for (const ordinal of ordinals) {
      if (INTERIM_MAPPING.has(ordinal)) {
        throw new Error('Interim Operating ordinal repeats in the approved line table: ' + ordinal);
      }
      INTERIM_MAPPING.set(ordinal, { comparisonLines: [line], partyBand });
    }
  }
}
if (INTERIM_MAPPING.size !== 113
    || Array.from({ length: 113 }, (_, index) => index + 1)
      .some((ordinal) => !INTERIM_MAPPING.has(ordinal))) {
  throw new Error('Interim Operating approved line table does not partition ordinals 1 through 113');
}

const INTERIM_GUARANTEE_ORDINALS = new Set([1, 14, 27, 40, 93, 104]);

function read(path) {
  return JSON.parse(readFileSync(join(REPO_ROOT, path), 'utf8'));
}

function bytes(path) {
  return readFileSync(join(REPO_ROOT, path));
}

function gitBlobOid(value) {
  return createHash('sha1').update(Buffer.concat([
    Buffer.from('blob ' + value.length + '\0', 'utf8'),
    value,
  ])).digest('hex');
}

function inferIdField(record, kind) {
  const preferred = {
    inventoryAuthority: /ben_inventory_session_successor_authority_id$/,
    disposition: /^inventory_disposition_id$/,
    sessionReceipt: /^ben_inventory_session_receipt_id$/,
    sealAuthority: /family_package_seal_successor_authority_id$/,
    sealReceipt: /family_package_seal_receipt_id$/,
    registrationAuthority: /registration_successor_authority_id$/,
  }[kind];
  const matches = Object.keys(record).filter((key) => preferred.test(key));
  if (matches.length !== 1) {
    throw new Error('cannot infer one ' + kind + ' record ID field');
  }
  return matches[0];
}

function physicalRecordBinding(path, idField) {
  const value = bytes(path);
  const record = JSON.parse(value.toString('utf8'));
  return {
    byte_length: value.length,
    git_blob_oid: gitBlobOid(value),
    path,
    record_id: record[idField],
    record_id_field: idField,
    schema_version: record.schema_version,
    sha256: sha256Hex(value),
  };
}

function physicalFileBinding(path) {
  const value = bytes(path);
  let schemaVersion = null;
  try {
    schemaVersion = JSON.parse(value.toString('utf8')).schema_version ?? null;
  } catch {
    schemaVersion = null;
  }
  return {
    byte_length: value.length,
    git_blob_oid: gitBlobOid(value),
    path,
    schema_version: schemaVersion,
    sha256: sha256Hex(value),
  };
}

function outputBinding(path, record, idField, value) {
  return {
    byte_length: value.length,
    git_blob_oid: gitBlobOid(value),
    path,
    record_id: record[idField],
    record_id_field: idField,
    schema_version: record.schema_version,
    sha256: sha256Hex(value),
  };
}

function sealBoundRecord(schemaVersion, idField, body) {
  const unsigned = { schema_version: schemaVersion, ...body };
  return { ...unsigned, [idField]: contentId(schemaVersion, unsigned) };
}

function buildRecord(path, schemaVersion, idField, body) {
  const record = sealBoundRecord(schemaVersion, idField, body);
  const value = Buffer.from(canonicalJson(record) + '\n', 'utf8');
  return {
    path,
    value,
    record,
    binding: outputBinding(path, record, idField, value),
  };
}

function outputPaths(config) {
  const label = config.familyKey.replaceAll('_', '-');
  return {
    inventoryAuthority:
      CONTROL + '/m7-v2-repair-contract-work3-' + config.slug
      + '-grouping-ben-inventory-session-successor-authority-2026-09-01B.json',
    disposition:
      CONTROL + '/m7-v2-repair-' + config.sessionStem + '-' + config.profileCount
      + '-profile-inventory-disposition-grouping-successor-2026-09-01B.json',
    sessionReceipt:
      CONTROL + '/m7-v2-repair-' + config.sessionStem
      + '-ben-inventory-session-grouping-successor-receipt-2026-09-01B.json',
    sealAuthority:
      CONTROL + '/m7-v2-repair-contract-work3-' + config.slug
      + '-grouping-family-package-seal-successor-authority-2026-09-01B.json',
    package: successorPackagePath(config.slug),
    sealReceipt:
      CONTROL + '/m7-v2-repair-' + config.slug
      + '-grouping-family-package-seal-receipt-2026-09-01B.json',
    registrationAuthority:
      CONTROL + '/m7-v2-repair-contract-work3-' + config.slug
      + '-grouping-registration-successor-authority-2026-09-01B.json',
    applicationReceipt:
      'docs/codex-program/notes/N1-' + label
      + '-GROUPING-RULING-APPLICATION-RECEIPT-2026-09-01B.json',
  };
}

function predecessorPaths(config) {
  return {
    inventoryAuthority:
      CONTROL + '/m7-v2-repair-contract-work3-' + config.slug
      + '-ben-inventory-session-successor-authority.json',
    disposition: config.predecessorDisposition,
    sessionReceipt:
      CONTROL + '/m7-v2-repair-' + config.sessionStem
      + '-ben-inventory-session-receipt.json',
    sealAuthority:
      CONTROL + '/m7-v2-repair-contract-work3-' + config.slug
      + '-family-package-seal-successor-authority.json',
    package: packagePath(config.slug),
    sealReceipt:
      CONTROL + '/m7-v2-repair-' + config.slug + '-family-package-seal-receipt.json',
    registrationAuthority:
      CONTROL + '/m7-v2-repair-contract-work3-' + config.slug
      + '-registration-successor-authority.json',
  };
}

function predecessorChainBindings(config) {
  const paths = predecessorPaths(config);
  const bindings = Object.fromEntries(Object.entries(paths).map(([kind, path]) => {
    const record = read(path);
    const idField = kind === 'package'
      ? 'family_profile_package_id'
      : inferIdField(record, kind);
    return [kind, physicalRecordBinding(path, idField)];
  }));
  const expected = EXPECTED_PREDECESSOR_CHAIN_SHA256[config.familyKey];
  for (const [kind, binding] of Object.entries(bindings)) {
    if (binding.sha256 !== expected[kind]) {
      throw new Error(config.familyKey + ' predecessor ' + kind + ' bytes changed');
    }
  }
  return bindings;
}

function assertExpectedPredecessor(config, binding) {
  const expected = {
    ...config.expectedPredecessor,
    path: packagePath(config.slug),
    record_id_field: 'family_profile_package_id',
    schema_version: FAMILY_PACKAGE_SCHEMA,
  };
  if (canonicalJson(binding) !== canonicalJson(expected)) {
    throw new Error(config.familyKey + ' sealed predecessor package bytes changed');
  }
}

function replaceValues(value, replacements) {
  if (Array.isArray(value)) {
    return value.map((entry) => replaceValues(entry, replacements));
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, replaceValues(entry, replacements)]),
    );
  }
  return typeof value === 'string' && replacements.has(value)
    ? replacements.get(value)
    : value;
}

function replaceContainerPath(value, predecessorPath, nextPath) {
  if (Array.isArray(value)) {
    return value.map((entry) => replaceContainerPath(entry, predecessorPath, nextPath));
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [
      key,
      key === 'container_path' && entry === predecessorPath
        ? nextPath
        : replaceContainerPath(entry, predecessorPath, nextPath),
    ]));
  }
  return value;
}

function collectKnownIds(value, knownIds, found = new Set()) {
  if (Array.isArray(value)) {
    for (const entry of value) collectKnownIds(entry, knownIds, found);
  } else if (value !== null && typeof value === 'object') {
    for (const entry of Object.values(value)) collectKnownIds(entry, knownIds, found);
  } else if (typeof value === 'string' && knownIds.has(value)) {
    found.add(value);
  }
  return found;
}

function resealProfiles(predecessorProfiles, predecessorPath, nextPath) {
  const knownIds = new Set(predecessorProfiles.map((profile) => profile.profile_id));
  const replacements = new Map();
  const pending = [...predecessorProfiles];
  const profiles = [];
  while (pending.length > 0) {
    let progress = false;
    for (let index = pending.length - 1; index >= 0; index -= 1) {
      const predecessorProfile = pending[index];
      const unsigned = structuredClone(predecessorProfile);
      const oldId = unsigned.profile_id;
      delete unsigned.profile_id;
      const dependencies = collectKnownIds(unsigned, knownIds);
      if ([...dependencies].some((dependency) => !replacements.has(dependency))) continue;
      let successorProfile = replaceValues(unsigned, replacements);
      successorProfile = replaceContainerPath(successorProfile, predecessorPath, nextPath);
      const identityPayload = { ...successorProfile };
      delete identityPayload.schema_version;
      successorProfile.profile_id = contentId(FAMILY_PROFILE_SCHEMA, identityPayload);
      replacements.set(oldId, successorProfile.profile_id);
      profiles.push(successorProfile);
      pending.splice(index, 1);
      progress = true;
    }
    if (!progress) {
      throw new Error('profile identity dependency cycle prevents successor reseal');
    }
  }
  profiles.sort((left, right) => (
    left.profile_key < right.profile_key ? -1
      : left.profile_key > right.profile_key ? 1
        : left.profile_id < right.profile_id ? -1
          : left.profile_id > right.profile_id ? 1 : 0
  ));
  return { profiles, replacements };
}

function resealDimensionEvidence(
  predecessorEvidence,
  replacements,
  predecessorPath,
  nextPath,
) {
  return predecessorEvidence.map((evidence) => {
    let unsigned = structuredClone(evidence);
    delete unsigned.dimension_evidence_id;
    unsigned = replaceValues(unsigned, replacements);
    unsigned = replaceContainerPath(unsigned, predecessorPath, nextPath);
    return {
      ...unsigned,
      dimension_evidence_id: contentId(unsigned.schema_version, unsigned),
    };
  }).sort((left, right) => (
    left.dimension_evidence_id < right.dimension_evidence_id ? -1
      : left.dimension_evidence_id > right.dimension_evidence_id ? 1 : 0
  ));
}

function inventoryForPackage(record) {
  return {
    family_key: record.family_key,
    profile_set_version: record.profile_set_version,
    legal_decisions: [...record.legal_decisions],
    profile_ids: record.profiles.map((profile) => profile.profile_id),
    subtype_tree_id: record.subtype_tree.subtype_tree_id,
    match_fixture_record_ids:
      record.match_fixtures.map((fixture) => fixture.match_fixture_id),
    dimension_evidence_ids:
      record.dimension_evidence.map((evidence) => evidence.dimension_evidence_id),
    structure_fixture_ids:
      record.structure_fixture_members.map((fixture) => fixture.structure_fixture_id),
  };
}

function normalisedProfile(profile, idToKey, packagePathValue) {
  const value = structuredClone(profile);
  delete value.profile_id;
  const replacements = new Map(
    [...idToKey.entries()].map(([id, key]) => [id, 'PROFILE_KEY:' + key]),
  );
  return replaceContainerPath(
    replaceValues(value, replacements),
    packagePathValue,
    '<FAMILY_PACKAGE>',
  );
}

function normalisedDimensionEvidence(evidence, idToKey, packagePathValue) {
  const value = structuredClone(evidence);
  delete value.dimension_evidence_id;
  const replacements = new Map(
    [...idToKey.entries()].map(([id, key]) => [id, 'PROFILE_KEY:' + key]),
  );
  return replaceContainerPath(
    replaceValues(value, replacements),
    packagePathValue,
    '<FAMILY_PACKAGE>',
  );
}

function assertPackageContinuity(predecessor, successor, predecessorPath, nextPath) {
  if (predecessor.family_key !== successor.family_key
      || predecessor.profile_set_version !== successor.profile_set_version
      || canonicalJson(predecessor.legal_decisions) !== canonicalJson(successor.legal_decisions)
      || canonicalJson(predecessor.match_fixtures) !== canonicalJson(successor.match_fixtures)
      || canonicalJson(predecessor.subtype_tree) !== canonicalJson(successor.subtype_tree)
      || canonicalJson(predecessor.structure_fixture_members)
        !== canonicalJson(successor.structure_fixture_members)) {
    throw new Error(predecessor.family_key + ' grouping successor changed package semantics');
  }
  const predecessorIdToKey = new Map(
    predecessor.profiles.map((profile) => [profile.profile_id, profile.profile_key]),
  );
  const successorIdToKey = new Map(
    successor.profiles.map((profile) => [profile.profile_id, profile.profile_key]),
  );
  const predecessorProfiles = predecessor.profiles.map(
    (profile) => normalisedProfile(profile, predecessorIdToKey, predecessorPath),
  ).sort((left, right) => left.profile_key.localeCompare(right.profile_key));
  const successorProfiles = successor.profiles.map(
    (profile) => normalisedProfile(profile, successorIdToKey, nextPath),
  ).sort((left, right) => left.profile_key.localeCompare(right.profile_key));
  if (canonicalJson(predecessorProfiles) !== canonicalJson(successorProfiles)) {
    throw new Error(predecessor.family_key + ' grouping successor changed profile semantics');
  }
  const normaliseEvidenceSet = (record, idToKey, path) => record.dimension_evidence
    .map((evidence) => normalisedDimensionEvidence(evidence, idToKey, path))
    .sort((left, right) => canonicalJson(left).localeCompare(canonicalJson(right)));
  if (canonicalJson(normaliseEvidenceSet(predecessor, predecessorIdToKey, predecessorPath))
      !== canonicalJson(normaliseEvidenceSet(successor, successorIdToKey, nextPath))) {
    throw new Error(
      predecessor.family_key + ' grouping successor changed dimension-evidence semantics',
    );
  }
}

function buildSuccessorPackage(config, work3Authority) {
  const predecessorPath = packagePath(config.slug);
  const nextPath = successorPackagePath(config.slug);
  const predecessor = read(predecessorPath);
  const predecessorBinding = physicalRecordBinding(
    predecessorPath,
    'family_profile_package_id',
  );
  assertExpectedPredecessor(config, predecessorBinding);
  const { profiles, replacements } = resealProfiles(
    predecessor.profiles,
    predecessorPath,
    nextPath,
  );
  const dimensionEvidence = resealDimensionEvidence(
    predecessor.dimension_evidence,
    replacements,
    predecessorPath,
    nextPath,
  );
  const inventoryShape = {
    ...predecessor,
    profiles,
    dimension_evidence: dimensionEvidence,
  };
  const inventory = inventoryForPackage(inventoryShape);
  const approvalBody = structuredClone(predecessor.family_approval);
  delete approvalBody.schema_version;
  delete approvalBody.family_approval_id;
  approvalBody.approved_on = '2026-09-01';
  approvalBody.approval_text =
    'Ben approves the ' + config.familyKey + ' ' + config.profileCount
    + '-profile Work3 grouping successor package inventory after applying ruling '
    + config.rulingOrdinal + ' from the 2026-09-01B receipt.';
  approvalBody.approved_inventory_digest =
    sha256Hex(Buffer.from(canonicalJson(inventory), 'utf8'));
  const familyApproval = sealBoundRecord(
    FAMILY_APPROVAL_SCHEMA,
    'family_approval_id',
    approvalBody,
  );
  const packageBody = structuredClone(predecessor);
  delete packageBody.schema_version;
  delete packageBody.family_profile_package_id;
  packageBody.family_approval = familyApproval;
  packageBody.profiles = profiles;
  packageBody.dimension_evidence = dimensionEvidence;
  const packageRecord = sealBoundRecord(
    FAMILY_PACKAGE_SCHEMA,
    'family_profile_package_id',
    packageBody,
  );
  assertPackageContinuity(predecessor, packageRecord, predecessorPath, nextPath);
  if (packageRecord.profiles.length !== config.profileCount
      || packageRecord.dimension_evidence.length !== config.profileCount) {
    throw new Error(config.familyKey + ' successor member counts changed');
  }
  const validation = validateSingleFamilyPackageInventory({
    work3Authority,
    familyKey: config.familyKey,
    profileSetVersion: packageRecord.profile_set_version,
    benApprovalId: packageRecord.family_approval.ben_approval_id,
    legalDecisions: packageRecord.legal_decisions,
    members: {
      profiles: packageRecord.profiles,
      subtype_tree: packageRecord.subtype_tree,
      match_fixtures: packageRecord.match_fixtures,
      dimension_evidence: packageRecord.dimension_evidence,
      structure_fixture_members: packageRecord.structure_fixture_members,
    },
    memberInventory: inventory,
    inventoryFingerprint: packageRecord.family_approval.approved_inventory_digest,
  });
  if (validation.status !== 'FAMILY_MEMBER_IDENTITY_PASS_SEMANTIC_AND_GLOBAL_SET_PENDING') {
    throw new Error(config.familyKey + ' successor package validation failed');
  }
  const value = Buffer.from(canonicalJson(packageRecord) + '\n', 'utf8');
  return {
    predecessor,
    predecessorBinding,
    packageRecord,
    output: {
      path: nextPath,
      value,
      record: packageRecord,
      binding: outputBinding(
        nextPath,
        packageRecord,
        'family_profile_package_id',
        value,
      ),
    },
  };
}

function mappingFor(config, row, profile) {
  const subtype = profile.classification_path.at(-1);
  if (config.familyKey === 'DIVIDENDS' && subtype === 'DIVIDEND_COORDINATION') {
    return { comparisonLines: ['Dividend coordination'], comparisonFields: [] };
  }
  if (config.familyKey === 'MAE_DEFINITION') {
    const lines = {
      UNDERLYING_CAUSE_RESTORATION: ['Exceptions to carve-outs'],
      EXCLUSION: ['Carve-outs'],
      DEFINITION_INSTANCE: ['Definition prongs', 'MAE Test'],
      DISPROPORTIONALITY_CARVEBACK: ['Disproportionality relationships'],
    }[subtype];
    return lines === undefined ? null : { comparisonLines: lines, comparisonFields: [] };
  }
  if (config.familyKey === 'GUARANTY_FINANCING_PARTY'
      && subtype === 'PERFORMANCE_GUARANTY') {
    return {
      comparisonLines: ['Performance guaranty'],
      comparisonFields: [
        'per-deal presence',
        'named guarantor where evidence supplies it',
      ],
    };
  }
  if (config.familyKey === 'APPRAISAL_DISSENTERS_RIGHTS') {
    const field = {
      WITHDRAWAL_RECONVERSION: 'withdrawal/reconversion treatment',
      SETTLEMENT_CONSENT: 'settlement consent',
    }[subtype];
    return field === undefined ? null : {
      comparisonLines: ["Appraisal / dissenters' rights"],
      comparisonFields: [field],
    };
  }
  if (config.familyKey === 'FINANCING_COVENANTS') {
    if (subtype === 'PAYOFF') {
      const field = row.ordinal === 1
        ? 'final executed-payoff timing'
        : row.ordinal === 4 ? 'draft payoff timing' : null;
      return field === null ? null : {
        comparisonLines: ['Payoff'],
        comparisonFields: [field],
      };
    }
    if (subtype === 'OBTAIN_FINANCING') {
      return { comparisonLines: ['Obtain financing'], comparisonFields: [] };
    }
    if (subtype === 'NO_FINANCING_CONDITION') {
      return { comparisonLines: ['No financing condition'], comparisonFields: [] };
    }
    return null;
  }
  if (config.familyKey === 'CONSIDERATION') {
    if (subtype === 'CASH_COMPONENT') {
      const field = {
        1: 'fixed cash per share',
        4: 'cash-election amount',
        5: 'mixed-election cash amount',
      }[row.ordinal];
      return field === undefined ? null : {
        comparisonLines: ['Cash component'],
        comparisonFields: [field],
      };
    }
    if (subtype === 'APPRAISAL_LINK') {
      return {
        comparisonLines: [],
        comparisonFields: ['Appraisal status'],
        linkTarget: "Appraisal / dissenters' rights",
      };
    }
    return null;
  }
  if (config.familyKey === 'INTERIM_OPERATING') {
    const mapping = INTERIM_MAPPING.get(row.ordinal);
    if (mapping === undefined) return null;
    return {
      ...mapping,
      comparisonFields: [],
      groupingNote: INTERIM_GUARANTEE_ORDINALS.has(row.ordinal)
        ? 'Guarantees-of-indebtedness fold into the Indebtedness and loans line.'
        : null,
    };
  }
  return null;
}

function gapEntries(config, sourceBindings) {
  if (config.familyKey === 'CONSIDERATION') {
    return [
      'election/proration mechanics',
      'stock consideration and exchange ratios',
      'fractional-share and adjustment mechanics',
    ].map((concept) => ({
      concept,
      disposition_effect: 'NOT_A_NO_OUTPUT_DISPOSITION',
      source_binding: sourceBindings.smallBrief,
      status: 'OPEN_UNMEASURED',
    }));
  }
  if (config.familyKey === 'INTERIM_OPERATING') {
    const rulingGaps = [
      "affirmative-covenant band carrying V1's refined specifics",
      'asset sales / divestitures / licenses',
      'real estate / leases as its own category',
    ].map((concept) => ({
      concept,
      disposition_effect: 'NOT_A_NO_OUTPUT_DISPOSITION',
      source_binding: sourceBindings.interimBrief,
      status: 'OPEN_UNMEASURED',
    }));
    return [...rulingGaps, {
      concept: 'broader third-party-obligation guarantees beyond debt',
      disposition_effect: 'NOT_A_NO_OUTPUT_DISPOSITION',
      source_binding: sourceBindings.interimBrief,
      status: 'OPEN_UNMEASURED_WATCH_ITEM',
    }];
  }
  return [];
}

function successorRows(config, predecessorDisposition, packageRecord) {
  const profilesBySuffix = new Map();
  for (const profile of packageRecord.profiles) {
    const suffix = profile.profile_key.split(':').at(-1);
    if (profilesBySuffix.has(suffix)) {
      throw new Error(config.familyKey + ' package repeats a proposed-profile-key suffix');
    }
    profilesBySuffix.set(suffix, profile);
  }
  const outcomes = [];
  const rows = predecessorDisposition.profile_dispositions.map((row) => {
    const profile = profilesBySuffix.get(row.proposed_profile_key);
    if (profile === undefined) {
      throw new Error(config.familyKey + ' row has no unique successor package profile');
    }
    const mapping = mappingFor(config, row, profile);
    const priorFlags = [...row.review_flags_acknowledged];
    const hadGroupingFlag = priorFlags.includes(GROUPING_FLAG);
    const next = structuredClone(row);
    next.prior_review_flags_acknowledged = priorFlags;
    if (mapping === null) {
      next.grouping_ruling_application = {
        family_key: config.familyKey,
        question: 'Which approved comparison line contains this row?',
        ruling_ordinal: config.rulingOrdinal,
        state: 'HELD_AMBIGUOUS',
      };
      outcomes.push({ ordinal: row.ordinal, state: 'HELD_AMBIGUOUS' });
      return next;
    }
    next.review_flags_acknowledged = priorFlags.filter((flag) => flag !== GROUPING_FLAG);
    if (Object.hasOwn(next, 'legal_grouping_pending_acknowledged')) {
      next.prior_legal_grouping_pending_acknowledged =
        next.legal_grouping_pending_acknowledged;
      next.legal_grouping_pending_acknowledged = false;
    }
    next.grouping_ruling_application = {
      approved_comparison_fields: [...mapping.comparisonFields],
      approved_comparison_lines: [...mapping.comparisonLines],
      approved_link_target: mapping.linkTarget ?? null,
      family_key: config.familyKey,
      grouping_note: mapping.groupingNote ?? null,
      party_band: mapping.partyBand ?? null,
      ruling_ordinal: config.rulingOrdinal,
      state: 'APPLIED_PENDING_INDEPENDENT_REVIEW',
    };
    outcomes.push({
      ordinal: row.ordinal,
      state: hadGroupingFlag ? 'GROUPING_STAMP_CLEARED' : 'MAPPING_APPLIED_NO_PRIOR_STAMP',
    });
    return next;
  });
  if (rows.length !== config.profileCount) {
    throw new Error(config.familyKey + ' successor disposition row count changed');
  }
  return { rows, outcomes };
}

function summaryFor(predecessorSummary, outcomes) {
  const summary = structuredClone(predecessorSummary);
  const cleared = outcomes.filter(
    (outcome) => outcome.state === 'GROUPING_STAMP_CLEARED',
  ).length;
  const held = outcomes.filter((outcome) => outcome.state === 'HELD_AMBIGUOUS').length;
  if (Object.hasOwn(summary, 'legal_grouping_review_pending_count')) {
    summary.legal_grouping_review_pending_count = held;
  }
  if (Object.hasOwn(summary, 'subtype_grouping_pending_legal')) {
    summary.subtype_grouping_pending_legal = held > 0;
  }
  if (Object.hasOwn(summary, 'performance_guaranty_grouping_pending_legal')) {
    summary.performance_guaranty_grouping_pending_legal = held > 0;
  }
  summary.grouping_ruling_mapped_count = outcomes.length - held;
  summary.legal_grouping_review_cleared_count = cleared;
  summary.legal_grouping_review_held_ambiguous_count = held;
  return summary;
}

function buildFamilyOutputs(config, common) {
  const paths = outputPaths(config);
  const predecessorChain = predecessorChainBindings(config);
  const generated = buildSuccessorPackage(config, common.work3Authority);
  const predecessorDisposition = read(config.predecessorDisposition);
  const { rows, outcomes } = successorRows(
    config,
    predecessorDisposition,
    generated.packageRecord,
  );
  const clearedOrdinals = outcomes.filter(
    (outcome) => outcome.state === 'GROUPING_STAMP_CLEARED',
  ).map((outcome) => outcome.ordinal);
  const heldOrdinals = outcomes.filter(
    (outcome) => outcome.state === 'HELD_AMBIGUOUS',
  ).map((outcome) => outcome.ordinal);
  const mappedNoPriorStampOrdinals = outcomes.filter(
    (outcome) => outcome.state === 'MAPPING_APPLIED_NO_PRIOR_STAMP',
  ).map((outcome) => outcome.ordinal);
  const rulingLocator = {
    family_key: config.familyKey,
    ruling_ordinal: config.rulingOrdinal,
  };
  const permittedWrites = [
    paths.disposition,
    paths.sessionReceipt,
    paths.sealAuthority,
    paths.package,
    paths.sealReceipt,
    paths.registrationAuthority,
    paths.applicationReceipt,
  ];
  const inventoryAuthority = buildRecord(
    paths.inventoryAuthority,
    'N1_GROUPING_INVENTORY_SESSION_SUCCESSOR_AUTHORITY/V1',
    'grouping_inventory_session_successor_authority_id',
    {
      applied_on: '2026-09-01',
      authority_state: 'AUTHORISED_GROUPING_SUCCESSOR_SESSION',
      exact_grouping_stamp_clearance_ordinals: clearedOrdinals,
      exact_held_ambiguous_ordinals: heldOrdinals,
      exact_mapped_without_predecessor_grouping_stamp_ordinals: mappedNoPriorStampOrdinals,
      family_key: config.familyKey,
      permitted_writes: permittedWrites,
      predecessor_chain_bindings: predecessorChain,
      prohibited_effects: {
        database_write: true,
        production_activation: true,
        serving_change: true,
      },
      ruling_locator: rulingLocator,
      ruling_receipt_binding: common.rulingBinding,
    },
  );
  const disposition = buildRecord(
    paths.disposition,
    'N1_GROUPING_INVENTORY_DISPOSITION_SUCCESSOR/V1',
    'inventory_disposition_id',
    {
      applied_on: '2026-09-01',
      family_key: config.familyKey,
      predecessor_binding: predecessorChain.disposition,
      profile_dispositions: rows,
      ruling_locator: rulingLocator,
      ruling_receipt_binding: common.rulingBinding,
      session_summary: summaryFor(predecessorDisposition.session_summary, outcomes),
      successor_authority_id:
        inventoryAuthority.record.grouping_inventory_session_successor_authority_id,
      unmeasured_concepts: gapEntries(config, common.sourceBindings),
    },
  );
  const sessionReceipt = buildRecord(
    paths.sessionReceipt,
    'N1_GROUPING_BEN_INVENTORY_SESSION_RECEIPT/V1',
    'ben_inventory_session_receipt_id',
    {
      completion_state: 'SUCCESSOR_DISPOSITION_AUTHORED',
      disposition_binding: disposition.binding,
      family_key: config.familyKey,
      grouping_stamp_clearance_count: clearedOrdinals.length,
      held_ambiguous_count: heldOrdinals.length,
      independent_review_state: 'PENDING',
      predecessor_session_binding: predecessorChain.sessionReceipt,
      profile_count: config.profileCount,
      ruling_locator: rulingLocator,
      ruling_receipt_binding: common.rulingBinding,
      successor_authority_binding: inventoryAuthority.binding,
      zero_effect_boundary: {
        database_write_count: 0,
        production_activation_count: 0,
        product_write_count: 0,
        serving_change_count: 0,
      },
    },
  );
  const sealAuthority = buildRecord(
    paths.sealAuthority,
    'N1_GROUPING_FAMILY_PACKAGE_SEAL_SUCCESSOR_AUTHORITY/V1',
    'grouping_family_package_seal_successor_authority_id',
    {
      applied_on: '2026-09-01',
      authority_state: 'AUTHORISED_RESEAL_ONLY',
      exact_package_path: paths.package,
      family_key: config.familyKey,
      grouping_stamp_clearance_permitted: true,
      independent_review_state: 'PENDING',
      inventory_session_authority_binding: inventoryAuthority.binding,
      predecessor_package_binding: generated.predecessorBinding,
      production_activation_permitted: false,
      required_profile_count: config.profileCount,
      ruling_locator: rulingLocator,
      ruling_receipt_binding: common.rulingBinding,
      successor_disposition_binding: disposition.binding,
      successor_session_receipt_binding: sessionReceipt.binding,
    },
  );
  const sealReceipt = buildRecord(
    paths.sealReceipt,
    'N1_GROUPING_FAMILY_PACKAGE_SEAL_RECEIPT/V1',
    'grouping_family_package_seal_receipt_id',
    {
      completion_state: 'SUCCESSOR_PACKAGE_SEALED',
      family_key: config.familyKey,
      grouping_stamp_clearance_count: clearedOrdinals.length,
      held_ambiguous_count: heldOrdinals.length,
      independent_review_state: 'PENDING',
      package_transition: {
        predecessor: generated.predecessorBinding,
        successor: generated.output.binding,
      },
      profile_accounting: {
        dimension_evidence_count: generated.packageRecord.dimension_evidence.length,
        profile_count: generated.packageRecord.profiles.length,
      },
      ruling_locator: rulingLocator,
      ruling_receipt_binding: common.rulingBinding,
      seal_successor_authority_binding: sealAuthority.binding,
      stamp_cleared: clearedOrdinals.length > 0 && heldOrdinals.length === 0,
      successor_disposition_binding: disposition.binding,
    },
  );
  const registrationAuthority = buildRecord(
    paths.registrationAuthority,
    'N1_GROUPING_REGISTRATION_SUCCESSOR_AUTHORITY/V1',
    'grouping_registration_successor_authority_id',
    {
      applied_on: '2026-09-01',
      authority_state: 'REGISTERED_ZERO_PRODUCT_WRITE_EFFECT',
      exact_grouping_stamp_clearance_ordinals: clearedOrdinals,
      exact_held_ambiguous_ordinals: heldOrdinals,
      exact_mapped_without_predecessor_grouping_stamp_ordinals: mappedNoPriorStampOrdinals,
      family_key: config.familyKey,
      family_package_seal_receipt_binding: sealReceipt.binding,
      predecessor_package_binding: generated.predecessorBinding,
      production_activation_permitted: false,
      profile_count: config.profileCount,
      ruling_locator: rulingLocator,
      ruling_receipt_binding: common.rulingBinding,
      stamp_clearance_permitted: true,
      successor_disposition_binding: disposition.binding,
      successor_package_binding: generated.output.binding,
      successor_session_receipt_binding: sessionReceipt.binding,
      work3_entry_correction_authority_binding: common.work3AuthorityBinding,
      zero_effect_boundary: {
        database_write_count: 0,
        product_write_count: 0,
        serving_change_count: 0,
      },
    },
  );
  const rowApplications = rows.map((row) => ({
    after_review_flags_acknowledged: [...row.review_flags_acknowledged],
    grouping_ruling_application: row.grouping_ruling_application,
    ordinal: row.ordinal,
    prior_review_flags_acknowledged: [...row.prior_review_flags_acknowledged],
    proposed_profile_key: row.proposed_profile_key,
  }));
  const applicationReceipt = buildRecord(
    paths.applicationReceipt,
    'N1_RULING_APPLICATION_RECEIPT/V1',
    'ruling_application_receipt_id',
    {
      applied_on: '2026-09-01',
      family_key: config.familyKey,
      grouping_stamp_clearance_count: clearedOrdinals.length,
      held_ambiguous_count: heldOrdinals.length,
      independent_review_state: 'PENDING',
      package_transition: {
        predecessor: generated.predecessorBinding,
        successor: generated.output.binding,
      },
      row_applications: rowApplications,
      ruling_locator: rulingLocator,
      ruling_receipt_binding: common.rulingBinding,
      stamp_cleared: clearedOrdinals.length > 0 && heldOrdinals.length === 0,
      successor_authorities: [
        inventoryAuthority.binding,
        sealAuthority.binding,
        registrationAuthority.binding,
      ],
      successor_disposition_binding: disposition.binding,
      successor_seal_receipt_binding: sealReceipt.binding,
      successor_session_receipt_binding: sessionReceipt.binding,
      unmeasured_concepts: disposition.record.unmeasured_concepts,
      zero_effect_boundary: {
        database_write_count: 0,
        product_write_count: 0,
        serving_change_count: 0,
      },
    },
  );
  return {
    outputs: [
      inventoryAuthority,
      disposition,
      sessionReceipt,
      sealAuthority,
      generated.output,
      sealReceipt,
      registrationAuthority,
      applicationReceipt,
    ],
    report: {
      application_receipt: applicationReceipt.binding,
      family_key: config.familyKey,
      grouping_stamps_cleared: clearedOrdinals.length,
      held_ambiguous: heldOrdinals.length,
      package_transition: {
        predecessor: generated.predecessorBinding,
        successor: generated.output.binding,
      },
      registration_authority: registrationAuthority.binding,
    },
  };
}

function removeIfPresent(path, cleanupErrors) {
  try {
    unlinkSync(path);
  } catch (error) {
    if (error.code !== 'ENOENT') cleanupErrors.push(error);
  }
}

function stageOutput(output, fullPath) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const tempPath = fullPath + '.tmp-grouping-successor-' + process.pid + '-'
      + randomBytes(12).toString('hex');
    let descriptor = null;
    let created = false;
    try {
      descriptor = openSync(tempPath, 'wx', 0o666);
      created = true;
      writeFileSync(descriptor, output.value);
      fsyncSync(descriptor);
      closeSync(descriptor);
      descriptor = null;
      const stagedStat = lstatSync(tempPath, { bigint: true });
      return {
        fullPath,
        output,
        stagedDev: stagedStat.dev,
        stagedIno: stagedStat.ino,
        tempPath,
      };
    } catch (error) {
      if (descriptor !== null) {
        try {
          closeSync(descriptor);
        } catch {
          // Preserve the original staging failure.
        }
      }
      const cleanupErrors = [];
      if (created) removeIfPresent(tempPath, cleanupErrors);
      if (cleanupErrors.length > 0) {
        throw new AggregateError(
          [error, ...cleanupErrors],
          'grouping successor staging failed and temporary-file cleanup was incomplete',
        );
      }
      if (error.code !== 'EEXIST') throw error;
    }
  }
  throw new Error('could not allocate a unique grouping successor temporary path');
}

function removeInstalledFinalIfOwned(entry, cleanupErrors) {
  let descriptor = null;
  try {
    descriptor = openSync(entry.fullPath, 'r');
    const descriptorStat = fstatSync(descriptor, { bigint: true });
    if (descriptorStat.dev !== entry.stagedDev || descriptorStat.ino !== entry.stagedIno) return;
    if (!readFileSync(descriptor).equals(entry.output.value)) {
      cleanupErrors.push(new Error(
        'installed grouping successor output changed before rollback: ' + entry.output.path,
      ));
      return;
    }
    const pathStat = lstatSync(entry.fullPath, { bigint: true });
    if (pathStat.dev !== entry.stagedDev || pathStat.ino !== entry.stagedIno) return;
    unlinkSync(entry.fullPath);
  } catch (error) {
    if (error.code !== 'ENOENT') cleanupErrors.push(error);
  } finally {
    if (descriptor !== null) {
      try {
        closeSync(descriptor);
      } catch (error) {
        cleanupErrors.push(error);
      }
    }
  }
}

function persist(outputs) {
  const missing = [];
  const outputPathsSeen = new Set();
  for (const output of outputs) {
    if (outputPathsSeen.has(output.path)) {
      throw new Error('grouping successor output path repeats: ' + output.path);
    }
    outputPathsSeen.add(output.path);
    const fullPath = join(REPO_ROOT, output.path);
    if (existsSync(fullPath)) {
      const existing = readFileSync(fullPath);
      if (!existing.equals(output.value)) {
        throw new Error(
          'create-once grouping successor output already exists with different bytes: '
          + output.path,
        );
      }
      continue;
    }
    missing.push(output);
  }
  if (CHECK_ONLY && missing.length > 0) {
    throw new Error('grouping successor output is missing: ' + missing[0].path);
  }
  if (CHECK_ONLY || missing.length === 0) return;

  const staged = [];
  const installed = [];
  try {
    for (const output of missing) {
      staged.push(stageOutput(output, join(REPO_ROOT, output.path)));
    }
    for (const entry of staged) {
      linkSync(entry.tempPath, entry.fullPath);
      installed.push(entry);
    }
    for (const entry of staged) {
      unlinkSync(entry.tempPath);
    }
  } catch (error) {
    const cleanupErrors = [];
    for (const entry of [...installed].reverse()) {
      removeInstalledFinalIfOwned(entry, cleanupErrors);
    }
    for (const entry of [...staged].reverse()) {
      removeIfPresent(entry.tempPath, cleanupErrors);
    }
    if (cleanupErrors.length > 0) {
      throw new AggregateError(
        [error, ...cleanupErrors],
        'grouping successor write failed and rollback was incomplete',
      );
    }
    throw error;
  }
}

function main() {
  const selectedConfigs = SELECTED_FAMILY === null
    ? CONFIGS
    : CONFIGS.filter(
      (config) => config.familyKey === SELECTED_FAMILY || config.slug === SELECTED_FAMILY,
    );
  if (selectedConfigs.length === 0) {
    throw new Error('unknown grouping successor family: ' + SELECTED_FAMILY);
  }
  const rulingBinding = physicalFileBinding(RULING_PATH);
  if (canonicalJson(rulingBinding) !== canonicalJson(EXPECTED_RULING_BINDING)) {
    throw new Error('2026-09-01B ruling receipt bytes changed');
  }
  const rulingReceipt = read(RULING_PATH);
  if (rulingReceipt.ruled_count !== CONFIGS.length
      || rulingReceipt.rulings?.length !== CONFIGS.length
      || CONFIGS.some((config, index) => (
        rulingReceipt.rulings[index]?.ordinal !== config.rulingOrdinal
        || rulingReceipt.rulings[index]?.family_key !== config.familyKey
      ))) {
    throw new Error('2026-09-01B ruling receipt does not contain the exact seven locators');
  }
  const work3Authority = read(WORK3_AUTHORITY_PATH);
  const work3AuthorityBinding = physicalRecordBinding(
    WORK3_AUTHORITY_PATH,
    'correction_authority_id',
  );
  if (canonicalJson(work3AuthorityBinding)
      !== canonicalJson(EXPECTED_WORK3_AUTHORITY_BINDING)) {
    throw new Error('Work3 entry-correction authority bytes changed');
  }
  const sourceBindings = {
    smallBrief: physicalFileBinding(SMALL_BRIEF_PATH),
    interimBrief: physicalFileBinding(INTERIM_BRIEF_PATH),
    coverageLedger: {
      byte_length: bytes(COVERAGE_LEDGER_PATH).length,
      git_blob_oid: gitBlobOid(bytes(COVERAGE_LEDGER_PATH)),
      path: COVERAGE_LEDGER_PATH,
      sha256: sha256Hex(bytes(COVERAGE_LEDGER_PATH)),
    },
  };
  for (const [name, binding] of Object.entries(sourceBindings)) {
    if (canonicalJson(binding) !== canonicalJson(EXPECTED_SOURCE_BINDINGS[name])) {
      throw new Error(name + ' source bytes changed');
    }
  }
  const common = {
    rulingBinding,
    sourceBindings,
    work3Authority,
    work3AuthorityBinding,
  };
  const built = selectedConfigs.map((config) => buildFamilyOutputs(config, common));
  persist(built.flatMap((entry) => entry.outputs));
  console.log(JSON.stringify({
    mode: CHECK_ONLY ? 'CHECK' : 'WRITE_CREATE_ONCE',
    families: built.map((entry) => entry.report),
  }, null, 2));
}

main();
