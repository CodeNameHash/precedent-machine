'use strict';

const { canonicalJson, sha256Hex } = require('../../canonical-v2/canonical-bytes');

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function serialise(value) {
  if (value instanceof RegExp) return { source: value.source, flags: value.flags };
  if (Array.isArray(value)) return value.map(serialise);
  if (isPlainObject(value)) return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, serialise(child)]));
  if (value == null || ['string', 'number', 'boolean'].includes(typeof value)) return value;
  throw new TypeError('registry fingerprint input must contain only plain serialisable data or RegExp values');
}

function registryFingerprint(input) {
  if (!isPlainObject(input)) throw new TypeError('registry fingerprint input must be a plain object');
  return `sha256:${sha256Hex(Buffer.from(canonicalJson(serialise(input)), 'utf8'))}`;
}

function freeze(value) {
  if (Array.isArray(value)) return Object.freeze(value.map(freeze));
  if (isPlainObject(value)) return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, child]) => [key, freeze(child)])));
  return value;
}

module.exports = Object.freeze({ isPlainObject, serialise, registryFingerprint, freeze });
