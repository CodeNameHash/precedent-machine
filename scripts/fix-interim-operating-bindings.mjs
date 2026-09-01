#!/usr/bin/env node
/** Patch INTERIM_OPERATING Work3 bindings in authoring module and test from on-disk evidence. */
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
    `${CONTROL}/m7-v2-repair-contract-work3-interim-operating-unapproved-inventory-review-authority.json`,
    'work3_interim_operating_unapproved_inventory_review_authority_id',
  ),
  packet: binding(
    `${CONTROL}/m7-v2-repair-interim-operating-113-profile-inventory-review-packet-draft.json`,
    'inventory_review_packet_id',
  ),
  disposition: binding(
    `${CONTROL}/m7-v2-repair-interim-operating-113-profile-inventory-disposition.json`,
    'inventory_disposition_id',
  ),
  session: binding(
    `${CONTROL}/m7-v2-repair-interim-operating-ben-inventory-session-receipt.json`,
    'ben_inventory_session_receipt_id',
  ),
  benAuthority: binding(
    `${CONTROL}/m7-v2-repair-contract-work3-interim-operating-ben-inventory-session-successor-authority.json`,
    'work3_interim_operating_ben_inventory_session_successor_authority_id',
  ),
  sealAuthority: binding(
    `${CONTROL}/m7-v2-repair-contract-work3-interim-operating-family-package-seal-successor-authority.json`,
    'work3_interim_operating_family_package_seal_successor_authority_id',
  ),
  sealReceipt: binding(
    `${CONTROL}/m7-v2-repair-interim-operating-family-package-seal-receipt.json`,
    'interim_operating_family_package_seal_receipt_id',
  ),
  registrationAuthority: binding(
    `${CONTROL}/m7-v2-repair-contract-work3-interim-operating-registration-successor-authority.json`,
    'work3_interim_operating_registration_successor_authority_id',
  ),
  familyPackage: binding(
    `${CONTROL}/m7-v2-repair-family-work3-profile-package-interim-operating.json`,
    'family_profile_package_id',
  ),
};

function bindingBlock(name, b) {
  return `const ${name} = Object.freeze({
  byte_length: ${b.byte_length},
  path: '${b.path}',
  record_id: '${b.record_id}',
  record_id_field: '${b.record_id_field}',
  schema_version: '${b.schema_version}',
  sha256: '${b.sha256}',
});`;
}

function patchAuthoring(content) {
  let out = content;
  const pairs = [
    ['INTERIM_OPERATING_WORK3_INVENTORY_AUTHORITY_BINDING', BINDINGS.inventory],
    ['INTERIM_OPERATING_WORK3_PACKET_BINDING', BINDINGS.packet],
    ['INTERIM_OPERATING_WORK3_DISPOSITION_BINDING', BINDINGS.disposition],
    ['INTERIM_OPERATING_WORK3_SESSION_BINDING', BINDINGS.session],
    ['INTERIM_OPERATING_WORK3_BEN_AUTHORITY_BINDING', BINDINGS.benAuthority],
    ['INTERIM_OPERATING_WORK3_SEAL_AUTHORITY_BINDING', BINDINGS.sealAuthority],
    ['INTERIM_OPERATING_WORK3_SEAL_RECEIPT_BINDING', BINDINGS.sealReceipt],
    ['INTERIM_OPERATING_WORK3_REGISTRATION_AUTHORITY_BINDING', BINDINGS.registrationAuthority],
  ];
  for (const [name, b] of pairs) {
    const re = new RegExp(`const ${name} = Object\\.freeze\\(\\{[\\s\\S]*?\\}\\);`);
    out = out.replace(re, bindingBlock(name, b));
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
  return out;
}

const authoringPath = join(REPO_ROOT, 'lib/canonical-v2/m7-v2-interim-operating-authoring.js');
const testPath = join(REPO_ROOT, 'tests/stage-2y-structure-m7-v2-repair-interim-operating-work3.test.js');
writeFileSync(authoringPath, patchAuthoring(readFileSync(authoringPath, 'utf8')));
writeFileSync(testPath, patchTest(readFileSync(testPath, 'utf8')));
console.log(JSON.stringify(BINDINGS, null, 2));
