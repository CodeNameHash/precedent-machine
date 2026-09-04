#!/usr/bin/env node
/** Patch NO_SHOP Work3 bindings in authoring module and test from on-disk evidence. */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import canonicalModule from '../lib/canonical-v2/canonical-bytes.js';

const { sha256Hex } = canonicalModule;
const REPO_ROOT = join(import.meta.dirname, '..');
const CONTROL = 'evidence/canonical-v2/stage-2y-structure-migration/control';

function binding(path, idField) {
  const bytes = readFileSync(join(REPO_ROOT, path));
  const record = JSON.parse(bytes.toString('utf8'));
  return {
    byte_length: bytes.length,
    path,
    record_id: record[idField],
    record_id_field: idField,
    schema_version: record.schema_version,
    sha256: sha256Hex(bytes),
  };
}

const BINDINGS = {
  inventory: binding(
    `${CONTROL}/m7-v2-repair-contract-work3-no-shop-unapproved-inventory-review-authority.json`,
    'work3_no_shop_unapproved_inventory_review_authority_id',
  ),
  packet: binding(
    `${CONTROL}/m7-v2-repair-no-shop-365-profile-inventory-review-packet-draft.json`,
    'inventory_review_packet_id',
  ),
  disposition: binding(
    `${CONTROL}/m7-v2-repair-no-shop-365-profile-inventory-disposition.json`,
    'inventory_disposition_id',
  ),
  session: binding(
    `${CONTROL}/m7-v2-repair-no-shop-ben-inventory-session-receipt.json`,
    'ben_inventory_session_receipt_id',
  ),
  benAuthority: binding(
    `${CONTROL}/m7-v2-repair-contract-work3-no-shop-ben-inventory-session-successor-authority.json`,
    'work3_no_shop_ben_inventory_session_successor_authority_id',
  ),
  sealAuthority: binding(
    `${CONTROL}/m7-v2-repair-contract-work3-no-shop-family-package-seal-successor-authority.json`,
    'work3_no_shop_family_package_seal_successor_authority_id',
  ),
  sealReceipt: binding(
    `${CONTROL}/m7-v2-repair-no-shop-family-package-seal-receipt.json`,
    'no_shop_family_package_seal_receipt_id',
  ),
  registrationAuthority: binding(
    `${CONTROL}/m7-v2-repair-contract-work3-no-shop-registration-successor-authority.json`,
    'work3_no_shop_registration_successor_authority_id',
  ),
  familyPackage: binding(
    `${CONTROL}/m7-v2-repair-family-work3-profile-package-no-shop.json`,
    'family_profile_package_id',
  ),
};

function patchAuthoring(content) {
  let out = content;
  const pairs = [
    ['NO_SHOP_WORK3_INVENTORY_AUTHORITY_BINDING', BINDINGS.inventory],
    ['NO_SHOP_WORK3_PACKET_BINDING', BINDINGS.packet],
    ['NO_SHOP_WORK3_DISPOSITION_BINDING', BINDINGS.disposition],
    ['NO_SHOP_WORK3_SESSION_BINDING', BINDINGS.session],
    ['NO_SHOP_WORK3_BEN_AUTHORITY_BINDING', BINDINGS.benAuthority],
    ['NO_SHOP_WORK3_SEAL_AUTHORITY_BINDING', BINDINGS.sealAuthority],
    ['NO_SHOP_WORK3_SEAL_RECEIPT_BINDING', BINDINGS.sealReceipt],
    ['NO_SHOP_WORK3_REGISTRATION_AUTHORITY_BINDING', BINDINGS.registrationAuthority],
  ];
  for (const [name, b] of pairs) {
    const re = new RegExp(`const ${name} = Object\\.freeze\\(\\{[\\s\\S]*?\\}\\);`);
    const replacement = `const ${name} = Object.freeze(${JSON.stringify(b, null, 2).replace(/\n/g, '\n')});`;
    out = out.replace(re, `const ${name} = Object.freeze({
  byte_length: ${b.byte_length},
  path: '${b.path}',
  record_id: '${b.record_id}',
  record_id_field: '${b.record_id_field}',
  schema_version: '${b.schema_version}',
  sha256: '${b.sha256}',
});`);
  }
  return out;
}

function patchTest(content) {
  let out = content;
  const work3Block = `const WORK3_BINDINGS = Object.freeze({
  inventoryAuthority: Object.freeze(${JSON.stringify(BINDINGS.inventory)}),
  packet: Object.freeze(${JSON.stringify(BINDINGS.packet)}),
  disposition: Object.freeze(${JSON.stringify(BINDINGS.disposition)}),
  session: Object.freeze(${JSON.stringify(BINDINGS.session)}),
  benAuthority: Object.freeze(${JSON.stringify(BINDINGS.benAuthority)}),
  sealAuthority: Object.freeze(${JSON.stringify(BINDINGS.sealAuthority)}),
  sealReceipt: Object.freeze(${JSON.stringify(BINDINGS.sealReceipt)}),
  registrationAuthority: Object.freeze(${JSON.stringify(BINDINGS.registrationAuthority)}),
});`;
  out = out.replace(
    /const WORK3_BINDINGS = Object\.freeze\(\{[\s\S]*?\}\);/,
    work3Block,
  );
  const fp = BINDINGS.familyPackage;
  out = out.replace(
    /const FAMILY_PROFILE_PACKAGE_BINDING = Object\.freeze\(\{[\s\S]*?\}\);/,
    `const FAMILY_PROFILE_PACKAGE_BINDING = Object.freeze({
  path: '${fp.path}',
  schema_version: '${fp.schema_version}',
  record_id_field: '${fp.record_id_field}',
  record_id: '${fp.record_id}',
  byte_length: ${fp.byte_length},
  sha256: '${fp.sha256}',
});`,
  );
  out = out.replace(/validates 204 registered slice A profiles/g, 'validates 365 registered profiles');
  out = out.replace(
    /MODIV_AGREEMENT_ID[\s\S]*?TOPBUILD_AGREEMENT_ID =[\s\S]*?;/,
    '',
  );
  if (!out.includes('MODIV_AGREEMENT_ID')) {
    out = out.replace(
      /const METSERA_AGREEMENT_ID =[\s\S]*?;/,
      `const METSERA_AGREEMENT_ID =
  'f783c4cdcaca4626c695d1c2c67924ccd8867eb066e16f17407ca64497ba778c';
const MODIV_AGREEMENT_ID =
  'fb76ef57355bef7f05b3b8955f5f7da4f430964923fecce0c95156c6e0b04a5c';`,
    );
  }
  return out;
}

const authoringPath = join(REPO_ROOT, 'lib/canonical-v2/m7-v2-no-shop-authoring.js');
const testPath = join(REPO_ROOT, 'tests/stage-2y-structure-m7-v2-repair-no-shop-work3.test.js');
writeFileSync(authoringPath, patchAuthoring(readFileSync(authoringPath, 'utf8')));
writeFileSync(testPath, patchTest(readFileSync(testPath, 'utf8')));
console.log(JSON.stringify(BINDINGS, null, 2));
