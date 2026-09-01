#!/usr/bin/env node

// Refresh the on-disk family-package bindings inside the lawful Work3
// family-package test fixture.
//
// tests/helpers/m7-v2-work3-family-package-fixture.js loads the sealed
// packages named in `on_disk_family_package_overrides` and asserts their bytes
// against the bindings recorded there. Re-sealing any of those packages
// therefore invalidates the fixture until this script rewrites the bindings and
// re-seals `fixture_digest`. Nothing else in the fixture is touched.
//
// Usage:
//   node scripts/stage-2y-structure-m7-v2-lawful-work3-fixture-refresh-overrides.mjs [--check]

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync, gunzipSync } from 'node:zlib';
import canonicalModule from '../lib/canonical-v2/canonical-bytes.js';

const { canonicalJson, sha256Hex } = canonicalModule;

const REPO_ROOT = join(import.meta.dirname, '..');
const FIXTURE_PATH =
  'tests/fixtures/canonical-v2/m7-v2-repair/lawful-work3-family-package-set.json.gz.b64';
const CHECK_ONLY = process.argv.includes('--check');

function gitBlobOid(bytes) {
  return createHash('sha1').update(Buffer.concat([
    Buffer.from(`blob ${bytes.length}\0`, 'utf8'),
    bytes,
  ])).digest('hex');
}

function loadFixture() {
  const encoded = readFileSync(join(REPO_ROOT, FIXTURE_PATH), 'utf8').trim();
  return JSON.parse(gunzipSync(Buffer.from(encoded, 'base64')).toString('utf8'));
}

function bindingForPackage(path) {
  const bytes = readFileSync(join(REPO_ROOT, path));
  const record = JSON.parse(bytes.toString('utf8'));
  return {
    byte_length: bytes.length,
    git_blob_oid: gitBlobOid(bytes),
    path,
    record_id: record.family_profile_package_id,
    record_id_field: 'family_profile_package_id',
    schema_version: record.schema_version,
    sha256: sha256Hex(bytes),
  };
}

function sealFixture(fixture) {
  const body = { ...fixture };
  delete body.fixture_digest;
  return { ...body, fixture_digest: sha256Hex(Buffer.from(canonicalJson(body), 'utf8')) };
}

function main() {
  const fixture = loadFixture();
  const changes = [];
  const overrides = fixture.on_disk_family_package_overrides.map((override) => {
    const binding = bindingForPackage(override.binding.path);
    if (canonicalJson(binding) !== canonicalJson(override.binding)) {
      changes.push({
        family_key: override.family_key,
        from: { byte_length: override.binding.byte_length, sha256: override.binding.sha256 },
        to: { byte_length: binding.byte_length, sha256: binding.sha256 },
      });
    }
    return { ...override, binding };
  });
  const refreshed = sealFixture({ ...fixture, on_disk_family_package_overrides: overrides });

  if (CHECK_ONLY || changes.length === 0) {
    console.log(JSON.stringify({
      path: FIXTURE_PATH,
      fixture_digest: refreshed.fixture_digest,
      stale_overrides: changes,
      written: false,
    }, null, 2));
    if (CHECK_ONLY && changes.length > 0) process.exitCode = 1;
    return;
  }

  const encoded = `${gzipSync(
    Buffer.from(JSON.stringify(refreshed), 'utf8'), { level: 9 },
  ).toString('base64')}\n`;
  writeFileSync(join(REPO_ROOT, FIXTURE_PATH), encoded);
  console.log(JSON.stringify({
    path: FIXTURE_PATH,
    fixture_digest: refreshed.fixture_digest,
    refreshed_overrides: changes,
    written: true,
  }, null, 2));
}

main();
