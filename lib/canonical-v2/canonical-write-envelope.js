const { contentId } = require('./canonical-bytes');

const CANONICAL_WRITE_INPUT_DOMAIN = 'CANONICAL_WRITE_INPUT/V2';

function assertSqlCanonicalString(value) {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit === 0) {
      throw new TypeError('canonical write input strings cannot contain NUL');
    }
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) {
        throw new TypeError('canonical write input strings require paired Unicode surrogates');
      }
      index += 1;
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      throw new TypeError('canonical write input strings require paired Unicode surrogates');
    }
  }
}

function assertSqlCanonicalValue(value, seen = new Set()) {
  if (value === null || typeof value === 'boolean') return;
  if (typeof value === 'string') {
    assertSqlCanonicalString(value);
    return;
  }
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) {
      throw new TypeError('canonical write input numbers must be JavaScript-safe integers');
    }
    return;
  }
  if (!value || typeof value !== 'object') {
    throw new TypeError(`canonical write input does not support ${typeof value}`);
  }
  if (seen.has(value)) {
    throw new TypeError('canonical write input does not support cyclic values');
  }
  const prototype = Object.getPrototypeOf(value);
  if (!Array.isArray(value)
    && prototype !== Object.prototype
    && prototype !== null) {
    throw new TypeError('canonical write input requires plain objects');
  }
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      for (let index = 0; index < value.length; index += 1) {
        if (!Object.hasOwn(value, index)) {
          throw new TypeError('canonical write input arrays must be dense');
        }
        assertSqlCanonicalValue(value[index], seen);
      }
      return;
    }
    for (const [key, item] of Object.entries(value)) {
      if (!/^[\x00-\x7f]*$/.test(key)) {
        throw new TypeError('canonical write input object keys must be ASCII');
      }
      assertSqlCanonicalString(key);
      assertSqlCanonicalValue(item, seen);
    }
  } finally {
    seen.delete(value);
  }
}

function buildCanonicalWriteInputDigest({
  operation,
  idempotencyKey,
  writeSet,
  residuals,
  quarantines,
} = {}) {
  if (typeof operation !== 'string' || operation.length === 0
    || typeof idempotencyKey !== 'string' || idempotencyKey.length === 0
    || !writeSet || typeof writeSet !== 'object' || Array.isArray(writeSet)
    || !Array.isArray(residuals)
    || !Array.isArray(quarantines)) {
    throw new TypeError('canonical write input requires its exact closed persistence envelope');
  }
  const envelope = {
    operation,
    idempotencyKey,
    writeSet,
    residuals,
    quarantines,
  };
  assertSqlCanonicalValue(envelope);
  return contentId(CANONICAL_WRITE_INPUT_DOMAIN, envelope);
}

module.exports = {
  CANONICAL_WRITE_INPUT_DOMAIN,
  buildCanonicalWriteInputDigest,
};
