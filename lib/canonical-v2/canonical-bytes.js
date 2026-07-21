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
    if (Array.isArray(value)) {
      return `[${value.map((item) => canonicalize(item, seen)).join(',')}]`;
    }
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

function bytesOf(value) {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  if (typeof value === 'string') return Buffer.from(value, 'utf8');
  throw new TypeError('hash input must be a string, Buffer or Uint8Array');
}

function sha256Hex(value) {
  return crypto.createHash('sha256').update(bytesOf(value)).digest('hex');
}

function contentId(domain, payload) {
  if (typeof domain !== 'string' || domain.length === 0) {
    throw new TypeError('content ID domain must be a non-empty string');
  }
  const domainBytes = Buffer.from(domain, 'utf8');
  const payloadBytes = Buffer.from(canonicalJson(payload), 'utf8');
  return sha256Hex(Buffer.concat([
    Buffer.from('CANONICAL_CONTENT_ID/V1\0', 'utf8'),
    Buffer.from(String(domainBytes.length), 'ascii'),
    Buffer.from(':', 'ascii'),
    domainBytes,
    Buffer.from('\0', 'utf8'),
    payloadBytes,
  ]));
}

function utf8ByteLength(value) {
  return Buffer.byteLength(String(value), 'utf8');
}

function utf8Slice(value, start, end) {
  const bytes = Buffer.from(String(value), 'utf8');
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || end > bytes.length) {
    throw new RangeError('UTF-8 slice requires valid half-open byte offsets');
  }
  const selected = bytes.subarray(start, end);
  const decoded = selected.toString('utf8');
  if (!Buffer.from(decoded, 'utf8').equals(selected)) {
    throw new RangeError('UTF-8 slice offsets must fall on code-point boundaries');
  }
  return decoded;
}

module.exports = {
  canonicalJson,
  sha256Hex,
  contentId,
  utf8ByteLength,
  utf8Slice,
};
