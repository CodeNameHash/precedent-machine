const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const YAML = require('yaml');

const {
  canonicalDigest,
  domainDigest,
} = require('../../lib/programme-gates/bytes');
const {
  BOOTSTRAP_NONCE,
  EXPECTED_GATE_IDS,
  EXPECTED_WORK_CLASS_IDS,
  GOVERNING_REGISTRY_PATH,
  REGISTRY_DIGEST_DOMAIN,
  createGoverningRegistryAuthority,
  requireGoverningRegistryAuthority,
} = require('../../lib/programme-gates/governing-registry');

function dependencies(overrides = {}) {
  return {
    readFileSync: fs.readFileSync,
    parseYaml: YAML.parse,
    domainDigest,
    ...overrides,
  };
}

test('loads the one governing YAML path and preserves the closed source order', () => {
  let observedPath;
  const authority = createGoverningRegistryAuthority(dependencies({
    readFileSync(filePath) {
      observedPath = filePath;
      return fs.readFileSync(filePath);
    },
  }));

  assert.equal(observedPath, GOVERNING_REGISTRY_PATH);
  assert.deepEqual(authority.gate_ids, EXPECTED_GATE_IDS);
  assert.deepEqual(authority.work_class_ids, EXPECTED_WORK_CLASS_IDS);
  assert.deepEqual(authority.gates.map(({ id }) => id), EXPECTED_GATE_IDS);
  assert.deepEqual(Object.keys(authority.work_classes), EXPECTED_WORK_CLASS_IDS);
  assert.equal(authority.gates.length, 35);
  assert.equal(authority.work_class_ids.length, 13);
  assert.equal(authority.bootstrap_nonce, BOOTSTRAP_NONCE);
  assert.equal(authority.digest_domain, REGISTRY_DIGEST_DOMAIN);
  assert.match(authority.digest, /^[a-f0-9]{64}$/);
  assert.equal(Object.isFrozen(authority), true);
  assert.equal(requireGoverningRegistryAuthority(authority), authority);
});

test('registry digest is canonical and domain-separated', () => {
  const parsed = YAML.parse(fs.readFileSync(GOVERNING_REGISTRY_PATH, 'utf8'));
  const authority = createGoverningRegistryAuthority(dependencies());
  assert.equal(
    authority.digest,
    domainDigest(REGISTRY_DIGEST_DOMAIN, parsed.programme_gate_registry),
  );
  assert.notEqual(authority.digest, canonicalDigest(parsed.programme_gate_registry));
});

test('substituted registries, digests and unbranded authorities fail closed', () => {
  const parsed = YAML.parse(fs.readFileSync(GOVERNING_REGISTRY_PATH, 'utf8'));
  parsed.programme_gate_registry.gates[0].id = 'G0_SUBSTITUTED';
  assert.throws(
    () => createGoverningRegistryAuthority(dependencies({
      readFileSync: () => YAML.stringify(parsed),
    })),
    /closed governing order/,
  );
  assert.throws(
    () => createGoverningRegistryAuthority({
      ...dependencies(),
      registryDigest: 'a'.repeat(64),
    }),
    /unsupported fields/,
  );
  assert.throws(
    () => requireGoverningRegistryAuthority({
      gates: parsed.programme_gate_registry.gates,
      digest: 'a'.repeat(64),
    }),
    /loaded governing registry authority/,
  );
});

test('one-use bootstrap and terminal-pair clauses are mandatory', () => {
  const parsed = YAML.parse(fs.readFileSync(GOVERNING_REGISTRY_PATH, 'utf8'));
  parsed.programme_gate_registry.work_classes.gate_status_bootstrap.nonce = 'replacement';
  assert.throws(
    () => createGoverningRegistryAuthority(dependencies({
      readFileSync: () => YAML.stringify(parsed),
    })),
    /one-use contract/,
  );

  const second = YAML.parse(fs.readFileSync(GOVERNING_REGISTRY_PATH, 'utf8'));
  delete second.programme_gate_registry.work_classes.programme_complete.terminal_pair_required;
  assert.throws(
    () => createGoverningRegistryAuthority(dependencies({
      readFileSync: () => YAML.stringify(second),
    })),
    /terminal-pair contract/,
  );
});
