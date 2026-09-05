'use strict';

const crypto = require('node:crypto');

function canonicalize(value, seen) {
  if (value === null) return 'null';
  const type = typeof value;
  if (type === 'string' || type === 'boolean') return JSON.stringify(value);
  if (type === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('canonical JSON requires finite numbers');
    return JSON.stringify(value);
  }
  if (type !== 'object') throw new TypeError(`canonical JSON does not support ${type}`);
  if (seen.has(value)) throw new TypeError('canonical JSON does not support cyclic values');
  seen.add(value);
  try {
    if (Array.isArray(value)) return `[${value.map((item) => canonicalize(item, seen)).join(',')}]`;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError('canonical JSON requires plain objects');
    }
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalize(value[key], seen)}`).join(',')}}`;
  } finally {
    seen.delete(value);
  }
}

function canonicalJson(value) {
  return canonicalize(value, new Set());
}

function sha256Hex(value) {
  const bytes = typeof value === 'string' ? Buffer.from(value, 'utf8') : Buffer.from(value);
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function contentId(domain, payload) {
  const domainBytes = Buffer.from(domain, 'utf8');
  return sha256Hex(Buffer.concat([
    Buffer.from('CANONICAL_CONTENT_ID/V1\0', 'utf8'),
    Buffer.from(String(domainBytes.length), 'ascii'),
    Buffer.from(':', 'ascii'),
    domainBytes,
    Buffer.from('\0', 'utf8'),
    Buffer.from(canonicalJson(payload), 'utf8'),
  ]));
}

module.exports = { canonicalJson, contentId, sha256Hex };
