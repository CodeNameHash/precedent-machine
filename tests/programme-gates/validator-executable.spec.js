const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  VALIDATOR_EXECUTABLE_FILES,
  programmeGateValidatorExecutableDigest,
} = require('../../lib/programme-gates/validator-executable');

const ROOT = path.resolve(__dirname, '../..');

test('validator executable digest binds the exact closed implementation set', () => {
  assert.deepEqual(VALIDATOR_EXECUTABLE_FILES, [...VALIDATOR_EXECUTABLE_FILES].sort());
  assert.equal(new Set(VALIDATOR_EXECUTABLE_FILES).size, VALIDATOR_EXECUTABLE_FILES.length);
  for (const file of VALIDATOR_EXECUTABLE_FILES) {
    assert.equal(fs.statSync(path.resolve(ROOT, file)).isFile(), true);
  }
  assert.match(
    programmeGateValidatorExecutableDigest({ root: ROOT }),
    /^[a-f0-9]{64}$/,
  );
});

test('one changed executable byte changes the digest', () => {
  const original = programmeGateValidatorExecutableDigest({ root: ROOT });
  const changed = programmeGateValidatorExecutableDigest({
    root: ROOT,
    readFileSync(file) {
      const bytes = fs.readFileSync(file);
      return file.endsWith('validator.js')
        ? Buffer.concat([bytes, Buffer.from('\n')])
        : bytes;
    },
  });
  assert.notEqual(changed, original);
});
