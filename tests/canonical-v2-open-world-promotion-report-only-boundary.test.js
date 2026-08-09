const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('production paths do not consume open-world promotion evidence', () => {
  const root = path.resolve(__dirname, '..');
  const paths = ['lib/canonical-v2/contract-bundle.js', 'lib/canonical-v2/native-producer/candidate-resolution.js', 'lib/canonical-v2/native-producer/native-write-set-adapter.js', 'lib/expected-sets.js'];
  for (const relative of paths) assert.equal(fs.readFileSync(path.join(root, relative), 'utf8').includes('open-world-promotion/candidates'), false, relative);
});
