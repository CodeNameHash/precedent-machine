#!/usr/bin/env node

// Add or update one family's entry in `on_disk_family_package_overrides` inside
// the lawful Work3 family-package test fixture, then re-seal `fixture_digest`.
//
// The refresh script alongside this one only rewrites bindings for families
// already listed; a family reaching Milestone A for the first time needs its
// override inserted, which is what this does. Every other family's entry is
// carried through byte-identical, so concurrent family work does not collide.
//
// Usage:
//   node scripts/stage-2y-structure-m7-v2-lawful-work3-fixture-add-override.mjs \
//     --family TERMINATION_FEE --package <path-to-family-package.json> [--check]

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

function argValue(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1 || index + 1 >= process.argv.length) {
    throw new Error(`missing required argument ${flag}`);
  }
  return process.argv[index + 1];
}

function gitBlobOid(bytes) {
  return createHash('sha1').update(Buffer.concat([
    Buffer.from(`blob ${bytes.length}\0`, 'utf8'),
    bytes,
  ])).digest('hex');
}

function bindingForPackage(path) {
  const bytes = readFileSync(join(REPO_ROOT, path));
  const record = JSON.parse(bytes.toString('utf8'));
  return {
    binding: {
      byte_length: bytes.length,
      git_blob_oid: gitBlobOid(bytes),
      path,
      record_id: record.family_profile_package_id,
      record_id_field: 'family_profile_package_id',
      schema_version: record.schema_version,
      sha256: sha256Hex(bytes),
    },
    familyKey: record.family_key,
  };
}

function sealFixture(fixture) {
  const body = { ...fixture };
  delete body.fixture_digest;
  return { ...body, fixture_digest: sha256Hex(Buffer.from(canonicalJson(body), 'utf8')) };
}

function main() {
  const familyKey = argValue('--family');
  const packagePath = argValue('--package');
  const { binding, familyKey: packageFamilyKey } = bindingForPackage(packagePath);
  if (packageFamilyKey !== familyKey) {
    throw new Error(`package family_key ${packageFamilyKey} does not match --family ${familyKey}`);
  }

  const encoded = readFileSync(join(REPO_ROOT, FIXTURE_PATH), 'utf8').trim();
  const fixture = JSON.parse(gunzipSync(Buffer.from(encoded, 'base64')).toString('utf8'));
  if (!fixture.family_package_sources.some((source) => source.record.family_key === familyKey)) {
    throw new Error(`lawful fixture has no family_package_sources entry for ${familyKey}`);
  }

  const existing = fixture.on_disk_family_package_overrides.filter(
    (override) => override.family_key !== familyKey,
  );
  const previous = fixture.on_disk_family_package_overrides.find(
    (override) => override.family_key === familyKey,
  );
  const unchanged = previous !== undefined
    && canonicalJson(previous.binding) === canonicalJson(binding);
  const overrides = [...existing, { family_key: familyKey, binding }].sort(
    (left, right) => left.family_key.localeCompare(right.family_key),
  );
  const refreshed = sealFixture({ ...fixture, on_disk_family_package_overrides: overrides });

  if (CHECK_ONLY || unchanged) {
    console.log(JSON.stringify({
      path: FIXTURE_PATH,
      family_key: familyKey,
      override_state: previous === undefined ? 'ABSENT' : (unchanged ? 'CURRENT' : 'STALE'),
      fixture_digest: refreshed.fixture_digest,
      written: false,
    }, null, 2));
    if (CHECK_ONLY && !unchanged) process.exitCode = 1;
    return;
  }

  writeFileSync(join(REPO_ROOT, FIXTURE_PATH), `${gzipSync(
    Buffer.from(JSON.stringify(refreshed), 'utf8'), { level: 9 },
  ).toString('base64')}\n`);
  console.log(JSON.stringify({
    path: FIXTURE_PATH,
    family_key: familyKey,
    override_state: previous === undefined ? 'INSERTED' : 'REFRESHED',
    override_family_keys: overrides.map((override) => override.family_key),
    fixture_digest: refreshed.fixture_digest,
    written: true,
  }, null, 2));
}

main();
