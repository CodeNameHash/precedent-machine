'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const manifest = require('../component-digest.json');

test('component code digest covers every shipped runtime source file', () => {
  const root = path.join(__dirname, '..');
  const files = ['canonical-bytes.js', 'canonical-text.js', 'index.js', 'intake.js'];
  const hash = crypto.createHash('sha256');
  for (const file of files) hash.update(Buffer.from(`${file}\0`)).update(fs.readFileSync(path.join(root, file)));
  assert.equal(hash.digest('hex'), manifest.digest);
});
