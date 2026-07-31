const fs = require('node:fs');
const path = require('node:path');
const { TextDecoder } = require('node:util');
const { inflateRawSync } = require('node:zlib');

const { canonicalJson, contentId, sha256Hex } = require('./canonical-bytes');
const { validateSecEdgarIntakeCapture } = require('./sec-edgar-intake-capture');

const CONFIG = Object.freeze({
  schema_version: 'SEC_HTML_CANONICAL_TEXT_CONFIG/V1',
  encoding: 'UTF-8_FATAL_PRESERVE_BOM',
  entity_policy: 'HTML_NUMERIC_CP1252_AND_PINNED_NAMED/V1',
  whitespace_policy: 'COLLAPSE_TEXT_AND_STRUCTURAL_BREAKS/V1',
  source_map_encoding: 'DEFLATE_RAW_CANONICAL_JSON_TUPLES/V1',
  source_map_max_uncompressed_bytes: 64 * 1024 * 1024,
  line_break_tags: Object.freeze([
    'address', 'article', 'aside', 'blockquote', 'br', 'caption', 'dd', 'div', 'dl',
    'dt', 'fieldset', 'figcaption', 'figure', 'footer', 'form', 'h1', 'h2', 'h3',
    'h4', 'h5', 'h6', 'header', 'hr', 'li', 'main', 'nav', 'ol', 'p', 'pre',
    'section', 'table', 'tbody', 'tfoot', 'thead', 'tr', 'ul',
  ]),
  space_break_tags: Object.freeze(['td', 'th']),
  suppressed_raw_text_tags: Object.freeze(['script', 'style']),
});

const CONFIG_DIGEST = contentId('SEC_HTML_CANONICAL_TEXT_CONFIG/V1', CONFIG);
const VERIFIER_DIGEST = sha256Hex(fs.readFileSync(__filename));
const CONVERTER_PATH = path.join(__dirname, 'sec-html-canonical-text.js');
const CONVERSION_KEYS = Object.freeze([
  'schema_version', 'conversion_stage', 'verification_status', 'source_admission_status',
  'source_response_content_id', 'intake_capture_receipt_id', 'converter_digest',
  'converter_config_digest', 'canonical_text', 'canonical_text_sha256',
  'canonical_text_byte_length', 'source_map_encoding', 'source_map_payload_base64',
  'source_map_compressed_sha256', 'source_map_uncompressed_byte_length',
  'input_region_count', 'output_mapping_count', 'source_map_digest', 'canonical_text_id',
]);
const SOURCE_MAP_ENCODING = 'DEFLATE_RAW_CANONICAL_JSON_TUPLES/V1';
const SOURCE_MAP_KEYS = Object.freeze(['schema_version', 'input_regions', 'output_mappings']);
const MAX_SOURCE_MAP_BYTES = 64 * 1024 * 1024;
const DIGEST_RE = /^[a-f0-9]{64}$/;
const LINE_TAGS = new Set(CONFIG.line_break_tags);
const SPACE_TAGS = new Set(CONFIG.space_break_tags);
const RAW_TAGS = new Set(CONFIG.suppressed_raw_text_tags);
const ENTITY_RE = /&(?:#(?:[xX][0-9A-Fa-f]+|[0-9]+)|[A-Za-z][A-Za-z0-9]+);/g;
const SPACE_RE = /^[\u0009-\u000d\u0020\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]$/u;
const CP1252 = Object.freeze([
  0x20ac, 0x81, 0x201a, 0x192, 0x201e, 0x2026, 0x2020, 0x2021,
  0x2c6, 0x2030, 0x160, 0x2039, 0x152, 0x8d, 0x17d, 0x8f,
  0x90, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014,
  0x2dc, 0x2122, 0x161, 0x203a, 0x153, 0x9d, 0x17e, 0x178,
]);
const NAMED = Object.freeze({
  amp: '&', apos: "'", bull: '\u2022', copy: '\u00a9', euro: '\u20ac', gt: '>',
  hellip: '\u2026', ldquo: '\u201c', lsquo: '\u2018', lt: '<', mdash: '\u2014',
  middot: '\u00b7', nbsp: '\u00a0', ndash: '\u2013', pound: '\u00a3', quot: '"',
  rdquo: '\u201d', reg: '\u00ae', rsquo: '\u2019', trade: '\u2122', yen: '\u00a5',
  sect: '\u00a7', para: '\u00b6',
  ensp: '\u2002', emsp: '\u2003', thinsp: '\u2009',
  lrm: '', rlm: '', zwj: '', zwnj: '',
});
// Same zero-width/bidi-control numeric rationale as the primary converter
// (lib/canonical-v2/sec-html-canonical-text.js) \u2014 kept in lockstep here
// because this file is an independent re-implementation used to verify it.
const ZERO_WIDTH_CODEPOINTS = new Set([0x200b, 0x200c, 0x200d, 0x200e, 0x200f]);

class SecHtmlCanonicalTextVerificationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'SecHtmlCanonicalTextVerificationError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new SecHtmlCanonicalTextVerificationError(code, message);
}

function plain(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function sameKeys(value, keys) {
  return plain(value) && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}

function byteOffsets(text) {
  const offsets = new Uint32Array(text.length + 1);
  let byte = 0;
  for (let cursor = 0; cursor < text.length;) {
    const point = text.codePointAt(cursor);
    const width = point > 0xffff ? 2 : 1;
    offsets[cursor] = byte;
    if (width === 2) offsets[cursor + 1] = byte;
    byte += Buffer.byteLength(String.fromCodePoint(point), 'utf8');
    cursor += width;
  }
  offsets[text.length] = byte;
  return offsets;
}

function closingAngle(text, start) {
  let quote = null;
  for (let cursor = start + 1; cursor < text.length; cursor += 1) {
    const value = text[cursor];
    if (quote && value === quote) quote = null;
    else if (!quote && (value === '"' || value === "'")) quote = value;
    else if (!quote && value === '>') return cursor + 1;
  }
  return -1;
}

function describeTag(source) {
  const special = source.match(/^<\s*([!?])/);
  if (special) return {
    closing: false,
    name: special[1] === '?' ? '#processing-instruction' : '#declaration',
    selfClosing: true,
    special: true,
  };
  const match = source.match(/^<\s*(\/)?\s*([A-Za-z][A-Za-z0-9:-]*)/);
  if (!match) return null;
  return {
    closing: Boolean(match[1]),
    name: match[2].toLowerCase(),
    selfClosing: /\/\s*>$/.test(source),
    special: false,
  };
}

function classify(text, offsets) {
  const regions = [];
  const add = (start, end, kind, tagName) => {
    if (end <= start) return;
    const region = { input_start: offsets[start], input_end: offsets[end], region_kind: kind };
    if (tagName) region.tag_name = tagName;
    const previous = regions.at(-1);
    if (previous && previous.input_end === region.input_start
      && previous.region_kind === region.region_kind && previous.tag_name === region.tag_name) {
      previous.input_end = region.input_end;
      previous.character_end = end;
      return;
    }
    region.character_start = start;
    region.character_end = end;
    regions.push(region);
  };

  for (let cursor = 0; cursor < text.length;) {
    const opening = text.indexOf('<', cursor);
    if (opening < 0) {
      add(cursor, text.length, 'TEXT');
      break;
    }
    add(cursor, opening, 'TEXT');
    if (text.startsWith('<!--', opening)) {
      const close = text.indexOf('-->', opening + 4);
      const end = close < 0 ? text.length : close + 3;
      add(opening, end, 'COMMENT');
      cursor = end;
      continue;
    }
    const end = closingAngle(text, opening);
    const tag = end < 0 ? null : describeTag(text.slice(opening, end));
    if (!tag) {
      add(opening, opening + 1, 'TEXT');
      cursor = opening + 1;
      continue;
    }
    add(opening, end, tag.special ? 'MARKUP' : 'TAG', tag.name);
    cursor = end;
    if (!tag.closing && !tag.selfClosing && RAW_TAGS.has(tag.name)) {
      const closing = new RegExp(`<\\/\\s*${tag.name}\\s*>`, 'ig');
      closing.lastIndex = cursor;
      const match = closing.exec(text);
      const rawEnd = match ? match.index : text.length;
      add(cursor, rawEnd, `SUPPRESSED_${tag.name.toUpperCase()}`, tag.name);
      if (match) {
        add(match.index, closing.lastIndex, 'TAG', tag.name);
        cursor = closing.lastIndex;
      } else cursor = text.length;
    }
  }
  return regions;
}

function decodeEntity(entity) {
  if (entity[1] !== '#') return NAMED[entity.slice(1, -1)] ?? null;
  const hex = entity[2] === 'x' || entity[2] === 'X';
  let point = Number.parseInt(entity.slice(hex ? 3 : 2, -1), hex ? 16 : 10);
  if (point >= 0x80 && point <= 0x9f) point = CP1252[point - 0x80];
  if (ZERO_WIDTH_CODEPOINTS.has(point)) return '';
  if (point === 0 || point > 0x10ffff || (point >= 0xd800 && point <= 0xdfff)) point = 0xfffd;
  return String.fromCodePoint(point);
}

function reconstruct(text, offsets, regions) {
  const parts = [];
  const mappings = [];
  let outputEnd = 0;
  let pending = null;
  const append = (value, inputStart, inputEnd, kind) => {
    if (!value) return;
    const length = Buffer.byteLength(value, 'utf8');
    const previous = mappings.at(-1);
    if (previous && previous.output_end === outputEnd && previous.input_end === inputStart
      && previous.mapping_kind === kind) {
      parts[parts.length - 1] += value;
      previous.output_end += length;
      previous.input_end = inputEnd;
    } else {
      parts.push(value);
      mappings.push({
        output_start: outputEnd,
        output_end: outputEnd + length,
        input_start: inputStart,
        input_end: inputEnd,
        mapping_kind: kind,
      });
    }
    outputEnd += length;
  };
  const whitespace = (strength, start, end) => {
    if (!pending) pending = { strength, start, end };
    else {
      pending.strength = Math.max(pending.strength, strength);
      pending.end = Math.max(pending.end, end);
    }
  };
  const emit = (value, start, end, kind) => {
    if (SPACE_RE.test(value)) {
      whitespace(1, start, end);
      return;
    }
    if (pending) {
      if (outputEnd > 0) {
        append(pending.strength === 2 ? '\n' : ' ', pending.start, pending.end,
          pending.strength === 2 ? 'NORMALIZED_LINE_BREAK' : 'NORMALIZED_SPACE');
      }
      pending = null;
    }
    append(value, start, end, kind);
  };
  const literal = (start, end) => {
    for (let cursor = start; cursor < end;) {
      const point = text.codePointAt(cursor);
      const width = point > 0xffff ? 2 : 1;
      emit(String.fromCodePoint(point), offsets[cursor], offsets[cursor + width], 'DIRECT_TEXT');
      cursor += width;
    }
  };
  const textRegion = (start, end) => {
    ENTITY_RE.lastIndex = start;
    let cursor = start;
    for (let match = ENTITY_RE.exec(text); match && match.index < end; match = ENTITY_RE.exec(text)) {
      if (match.index + match[0].length > end) break;
      literal(cursor, match.index);
      const decoded = decodeEntity(match[0]);
      if (decoded === null) literal(match.index, match.index + match[0].length);
      else emit(decoded, offsets[match.index], offsets[match.index + match[0].length], 'DECODED_ENTITY');
      cursor = match.index + match[0].length;
    }
    literal(cursor, end);
  };

  for (const region of regions) {
    if (region.region_kind === 'TEXT') textRegion(region.character_start, region.character_end);
    else if (region.region_kind === 'TAG') {
      if (LINE_TAGS.has(region.tag_name)) whitespace(2, region.input_start, region.input_end);
      else if (SPACE_TAGS.has(region.tag_name)) whitespace(1, region.input_start, region.input_end);
    }
  }
  return { text: parts.join(''), mappings, byteLength: outputEnd };
}

function publicRegions(regions) {
  return regions.map(({ character_start: ignoredStart, character_end: ignoredEnd, ...region }) => region);
}

function assertClosedConversion(conversion) {
  if (!sameKeys(conversion, CONVERSION_KEYS)
    || conversion.schema_version !== 'SEC_HTML_CANONICAL_TEXT_CONVERSION/V2'
    || conversion.conversion_stage !== 'CONVERSION_ONLY'
    || conversion.verification_status !== 'NOT_ATTEMPTED'
    || conversion.source_admission_status !== 'NOT_ATTEMPTED'
    || typeof conversion.canonical_text !== 'string'
    || conversion.source_map_encoding !== SOURCE_MAP_ENCODING) {
    fail('INVALID_CONVERSION_CONTRACT', 'conversion must match the closed conversion-only contract.');
  }
}

function decodeSourceMap(conversion) {
  if (typeof conversion.source_map_payload_base64 !== 'string'
    || conversion.source_map_payload_base64.length === 0) {
    fail('INVALID_COMPRESSED_SOURCE_MAP', 'compressed source map must be non-empty canonical base64.');
  }
  const compressed = Buffer.from(conversion.source_map_payload_base64, 'base64');
  if (compressed.length === 0
    || compressed.toString('base64') !== conversion.source_map_payload_base64
    || compressed.length > MAX_SOURCE_MAP_BYTES) {
    fail('INVALID_COMPRESSED_SOURCE_MAP', 'compressed source map must be non-empty canonical base64 within bounds.');
  }
  if (!DIGEST_RE.test(conversion.source_map_compressed_sha256 || '')
    || sha256Hex(compressed) !== conversion.source_map_compressed_sha256) {
    fail('COMPRESSED_SOURCE_MAP_HASH_MISMATCH', 'compressed source map digest does not match its payload.');
  }
  if (!Number.isInteger(conversion.source_map_uncompressed_byte_length)
    || conversion.source_map_uncompressed_byte_length <= 0
    || conversion.source_map_uncompressed_byte_length > MAX_SOURCE_MAP_BYTES) {
    fail('SOURCE_MAP_LIMIT_EXCEEDED', 'claimed uncompressed source map length is outside the hard bound.');
  }
  let uncompressed;
  try {
    uncompressed = inflateRawSync(compressed, { maxOutputLength: MAX_SOURCE_MAP_BYTES });
  } catch {
    fail('SOURCE_MAP_INFLATE_FAILED', 'compressed source map could not be inflated within the hard bound.');
  }
  if (uncompressed.length !== conversion.source_map_uncompressed_byte_length) {
    fail('SOURCE_MAP_LENGTH_MISMATCH', 'inflated source map length does not match its claim.');
  }
  let sourceMapJson;
  try {
    sourceMapJson = new TextDecoder('utf-8', { fatal: true }).decode(uncompressed);
  } catch {
    fail('INVALID_SOURCE_MAP_UTF8', 'inflated source map must be valid UTF-8.');
  }
  let sourceMap;
  try {
    sourceMap = JSON.parse(sourceMapJson);
  } catch {
    fail('INVALID_SOURCE_MAP_JSON', 'inflated source map must be JSON.');
  }
  if (!sameKeys(sourceMap, SOURCE_MAP_KEYS)
    || sourceMap.schema_version !== 'SEC_CANONICAL_TEXT_SOURCE_MAP/V2'
    || !Array.isArray(sourceMap.input_regions)
    || !Array.isArray(sourceMap.output_mappings)
    || sourceMapJson !== canonicalJson(sourceMap)) {
    fail('INVALID_SOURCE_MAP_CONTRACT', 'inflated source map must match its canonical closed contract.');
  }
  if (!Number.isInteger(conversion.input_region_count) || conversion.input_region_count < 0
    || !Number.isInteger(conversion.output_mapping_count) || conversion.output_mapping_count < 0
    || sourceMap.input_regions.length !== conversion.input_region_count
    || sourceMap.output_mappings.length !== conversion.output_mapping_count) {
    fail('SOURCE_MAP_COUNT_MISMATCH', 'source map tuple counts do not match conversion claims.');
  }
  if (!DIGEST_RE.test(conversion.source_map_digest || '')
    || conversion.source_map_digest !== contentId('SEC_CANONICAL_TEXT_SOURCE_MAP/V2', sourceMap)) {
    fail('SOURCE_MAP_DIGEST_MISMATCH', 'source map digest does not match the canonical tuple payload.');
  }

  const inputRegions = sourceMap.input_regions.map((tuple) => {
    if (!Array.isArray(tuple) || tuple.length !== 4
      || !Number.isInteger(tuple[0]) || !Number.isInteger(tuple[1])
      || typeof tuple[2] !== 'string' || tuple[2].length === 0
      || !(tuple[3] === null || (typeof tuple[3] === 'string' && tuple[3].length > 0))) {
      fail('INVALID_INPUT_REGION_TUPLE', 'every input region must match the closed four-value tuple schema.');
    }
    const region = { input_start: tuple[0], input_end: tuple[1], region_kind: tuple[2] };
    if (tuple[3] !== null) region.tag_name = tuple[3];
    return region;
  });
  const outputMappings = sourceMap.output_mappings.map((tuple) => {
    if (!Array.isArray(tuple) || tuple.length !== 5
      || !Number.isInteger(tuple[0]) || !Number.isInteger(tuple[1])
      || !Number.isInteger(tuple[2]) || !Number.isInteger(tuple[3])
      || typeof tuple[4] !== 'string' || tuple[4].length === 0) {
      fail('INVALID_OUTPUT_MAPPING_TUPLE', 'every output mapping must match the closed five-value tuple schema.');
    }
    return {
      output_start: tuple[0],
      output_end: tuple[1],
      input_start: tuple[2],
      input_end: tuple[3],
      mapping_kind: tuple[4],
    };
  });
  return { inputRegions, outputMappings };
}

function assertRegionCoverage(regions, byteLength) {
  let cursor = 0;
  for (const region of regions) {
    if (!Number.isInteger(region.input_start) || !Number.isInteger(region.input_end)
      || region.input_start !== cursor || region.input_end <= region.input_start
      || region.input_end > byteLength) {
      fail('INPUT_REGION_COVERAGE_MISMATCH', 'input regions must cover every source byte once in order.');
    }
    cursor = region.input_end;
  }
  if (cursor !== byteLength) {
    fail('INPUT_REGION_COVERAGE_MISMATCH', 'input regions must cover every source byte once in order.');
  }
}

function assertMappingCoverage(mappings, inputLength, outputLength) {
  let cursor = 0;
  for (const mapping of mappings) {
    if (!Number.isInteger(mapping.output_start) || !Number.isInteger(mapping.output_end)
      || !Number.isInteger(mapping.input_start) || !Number.isInteger(mapping.input_end)
      || mapping.output_start !== cursor || mapping.output_end <= mapping.output_start
      || mapping.input_start < 0 || mapping.input_end <= mapping.input_start
      || mapping.input_end > inputLength) {
      fail('OUTPUT_MAPPING_COVERAGE_MISMATCH', 'output mappings must cover canonical bytes and map valid input.');
    }
    cursor = mapping.output_end;
  }
  if (cursor !== outputLength) {
    fail('OUTPUT_MAPPING_COVERAGE_MISMATCH', 'output mappings must cover canonical bytes and map valid input.');
  }
}

function verifySecHtmlCanonicalText({ capture, conversion } = {}) {
  validateSecEdgarIntakeCapture(capture);
  assertClosedConversion(conversion);
  const bytes = Buffer.from(capture.response_bytes_base64, 'base64');
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    fail('INVALID_UTF8', 'captured response bytes must be valid UTF-8.');
  }
  const currentConverterDigest = sha256Hex(fs.readFileSync(CONVERTER_PATH));
  if (conversion.converter_digest !== currentConverterDigest) {
    fail('STALE_EXECUTABLE_DIGEST', 'conversion is not bound to the current converter executable.');
  }
  if (conversion.converter_config_digest !== CONFIG_DIGEST) {
    fail('CONFIG_DIGEST_MISMATCH', 'conversion is not bound to the independently pinned config.');
  }
  if (conversion.source_response_content_id !== capture.source_response_content_id
    || conversion.intake_capture_receipt_id !== capture.intake_capture_receipt_id) {
    fail('SOURCE_IDENTITY_MISMATCH', 'conversion must bind the supplied intake capture exactly.');
  }
  const decodedSourceMap = decodeSourceMap(conversion);

  const offsets = byteOffsets(text);
  const classified = classify(text, offsets);
  const expectedRegions = publicRegions(classified);
  assertRegionCoverage(decodedSourceMap.inputRegions, bytes.length);
  if (canonicalJson(decodedSourceMap.inputRegions) !== canonicalJson(expectedRegions)) {
    fail('INPUT_CLASSIFICATION_MISMATCH', 'input regions do not match independent byte classification.');
  }
  const rebuilt = reconstruct(text, offsets, classified);
  assertMappingCoverage(decodedSourceMap.outputMappings, bytes.length, conversion.canonical_text_byte_length);
  if (canonicalJson(decodedSourceMap.outputMappings) !== canonicalJson(rebuilt.mappings)) {
    fail('OUTPUT_MAPPING_MISMATCH', 'output mappings do not match independent transformation.');
  }
  if (conversion.canonical_text !== rebuilt.text
    || conversion.canonical_text_byte_length !== rebuilt.byteLength
    || conversion.canonical_text_sha256 !== sha256Hex(Buffer.from(rebuilt.text, 'utf8'))) {
    fail('CANONICAL_TEXT_MISMATCH', 'canonical text, byte length or digest does not match reconstruction.');
  }
  const expectedSourceMap = {
    schema_version: 'SEC_CANONICAL_TEXT_SOURCE_MAP/V2',
    input_regions: expectedRegions.map((region) => [
      region.input_start, region.input_end, region.region_kind, region.tag_name ?? null,
    ]),
    output_mappings: rebuilt.mappings.map((mapping) => [
      mapping.output_start, mapping.output_end, mapping.input_start, mapping.input_end,
      mapping.mapping_kind,
    ]),
  };
  const sourceMapDigest = contentId('SEC_CANONICAL_TEXT_SOURCE_MAP/V2', expectedSourceMap);
  if (conversion.input_region_count !== expectedRegions.length
    || conversion.output_mapping_count !== rebuilt.mappings.length) {
    fail('SOURCE_MAP_COUNT_MISMATCH', 'source map counts do not match independent reconstruction.');
  }
  const identity = {
    source_response_content_id: capture.source_response_content_id,
    converter_digest: currentConverterDigest,
    converter_config_digest: CONFIG_DIGEST,
    canonical_text_sha256: conversion.canonical_text_sha256,
    canonical_text_byte_length: rebuilt.byteLength,
    source_map_digest: sourceMapDigest,
  };
  if (conversion.source_map_digest !== sourceMapDigest
    || conversion.canonical_text_id !== contentId('SEC_CANONICAL_TEXT/V2', identity)) {
    fail('CANONICAL_TEXT_IDENTITY_MISMATCH', 'source map or canonical text identity is inconsistent.');
  }

  const body = {
    schema_version: 'CANONICAL_TEXT_VERIFICATION_MANIFEST/V1',
    verification_stage: 'INDEPENDENT_CANONICAL_TEXT_VERIFICATION',
    verification_status: 'PASS',
    source_admission_status: 'NOT_ATTEMPTED',
    source_response_content_id: capture.source_response_content_id,
    intake_capture_receipt_id: capture.intake_capture_receipt_id,
    canonical_text_id: conversion.canonical_text_id,
    converter_digest: currentConverterDigest,
    converter_config_digest: CONFIG_DIGEST,
    verifier_digest: VERIFIER_DIGEST,
    canonical_text_sha256: conversion.canonical_text_sha256,
    canonical_text_byte_length: rebuilt.byteLength,
    source_map_digest: sourceMapDigest,
    input_region_count: expectedRegions.length,
    output_mapping_count: rebuilt.mappings.length,
  };
  return freeze({
    ...body,
    verification_manifest_id: contentId('CANONICAL_TEXT_VERIFICATION_MANIFEST/V1', body),
  });
}

module.exports = {
  CONFIG_DIGEST,
  VERIFIER_DIGEST,
  SecHtmlCanonicalTextVerificationError,
  verifySecHtmlCanonicalText,
};
