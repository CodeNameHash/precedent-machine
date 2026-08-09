'use strict';

const { canonicalJson, sha256Hex } = require('../../canonical-v2/canonical-bytes');
const { isPlainObject, serialise, freeze } = require('./registry-values');

function registryFingerprint(input) {
  if (!isPlainObject(input)) throw new TypeError('registry fingerprint input must be a plain object');
  return `sha256:${sha256Hex(Buffer.from(canonicalJson(serialise(input)), 'utf8'))}`;
}

module.exports = Object.freeze({ isPlainObject, serialise, registryFingerprint, freeze });
