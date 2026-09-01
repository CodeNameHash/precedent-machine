#!/usr/bin/env node
/**
 * Generate Ben Termination family package seal receipt evidence file.
 * Binds Q01–Q03 rulings digest, inventory disposition, session receipt, extension DEFERRED.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { canonicalJson, contentId } from '../lib/canonical-v2/canonical-bytes.js';

const REPO_ROOT = join(import.meta.dirname, '..');
const RECEIPT_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-termination-family-package-seal-receipt.json';
const PROBE_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-termination-family-package-seal-probe.json';
const RECEIPT_SCHEMA = 'STAGE_2Y_M7_V2_TERMINATION_FAMILY_PACKAGE_SEAL_RECEIPT/V1';

const RULINGS_PATH = 'docs/codex-program/notes/TERMINATION-BEN-RULINGS-Q01-Q03-2026-08-24.md';
const RULINGS_SHA256 =
  '7bdc740d6fc9ac18dac4dee5f84310a081218089d0812936564ac46376ac7d27';
const EXTENSION_PATH =
  'docs/codex-program/notes/TERMINATION-OUTSIDE-DATE-EXTENSION-DISPOSITION-TABLE-2026-08-24.md';

function sha256Hex(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

const probe = spawnSync(
  process.execPath,
  [
    '--test',
    '--test-name-pattern',
    'family package seal',
    'tests/stage-2y-structure-m7-v2-repair-work3.test.js',
  ],
  {
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      CI: 'true',
      NODE_OPTIONS: '--max-old-space-size=8192',
      TERMINATION_WRITE_FAMILY_PACKAGE_SEAL_PROBE: '1',
    },
    stdio: 'inherit',
  },
);

if (probe.status !== 0) {
  process.exit(probe.status ?? 1);
}

const sealProbe = JSON.parse(readFileSync(join(REPO_ROOT, PROBE_PATH), 'utf8'));
const extensionBytes = readFileSync(join(REPO_ROOT, EXTENSION_PATH));

const receiptUnsigned = {
  schema_version: RECEIPT_SCHEMA,
  seal_classification: 'TERMINATION_WORK3_FAMILY_PACKAGE_SEAL',
  completion_state: 'COMPLETE',
  reviewer: 'BEN_GOODCHILD',
  family_package_seal_id: sealProbe.family_package_seal_id,
  ben_rulings_binding: {
    path: RULINGS_PATH,
    sha256: RULINGS_SHA256,
    rulings: {
      'TERMINATION-Q01': 'AGREED',
      'TERMINATION-Q02': 'AGREED',
      'TERMINATION-Q03': 'MODIFIED',
    },
  },
  disposition_binding: sealProbe.disposition_binding,
  session_receipt_binding: sealProbe.session_receipt_binding,
  extension_disposition_binding: {
    path: EXTENSION_PATH,
    disposition_status: 'DEFERRED',
    sha256: sha256Hex(extensionBytes),
  },
  zero_effect_boundary: {
    work3_identity_count: 0,
    profile_identity_count: 0,
    package_registration_count: 0,
    product_write_count: 0,
    registration_count: 0,
  },
  next_governance_stop: {
    state: 'STOP_AFTER_FAMILY_PACKAGE_SEAL_RECEIPT_BEFORE_REGISTRATION',
    package_seal_state: 'RECORDED',
    extension_disposition_state: 'DEFERRED',
    registration_permitted: false,
    required_successor_sequence: ['WORK3_TERMINATION_REGISTRATION_SUCCESSOR_AUTHORITY'],
  },
};

const sealReceipt = {
  ...receiptUnsigned,
  termination_family_package_seal_receipt_id: contentId(RECEIPT_SCHEMA, receiptUnsigned),
};

writeFileSync(join(REPO_ROOT, RECEIPT_PATH), `${canonicalJson(sealReceipt)}\n`);

console.log(
  JSON.stringify({
    termination_family_package_seal_receipt_id:
      sealReceipt.termination_family_package_seal_receipt_id,
    family_package_seal_id: sealReceipt.family_package_seal_id,
    inventory_disposition_id: sealReceipt.disposition_binding.inventory_disposition_id,
    ben_inventory_session_receipt_id:
      sealReceipt.session_receipt_binding.ben_inventory_session_receipt_id,
    extension_disposition_status: 'DEFERRED',
  }),
);
