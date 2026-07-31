const { TextDecoder } = require('node:util');
const fs = require('node:fs');
const zlib = require('node:zlib');

const { canonicalJson, contentId, sha256Hex } = require('./canonical-bytes');
const { validateSecEdgarIntakeCapture } = require('./sec-edgar-intake-capture');

const SOURCE_MAP_ENCODING = 'DEFLATE_RAW_CANONICAL_JSON_TUPLES/V1';
const MAX_SOURCE_MAP_UNCOMPRESSED_BYTES = 64 * 1024 * 1024;

const CONFIG = Object.freeze({
  schema_version: 'SEC_HTML_CANONICAL_TEXT_CONFIG/V1',
  encoding: 'UTF-8_FATAL_PRESERVE_BOM',
  entity_policy: 'HTML_NUMERIC_CP1252_AND_PINNED_NAMED/V1',
  whitespace_policy: 'COLLAPSE_TEXT_AND_STRUCTURAL_BREAKS/V1',
  source_map_encoding: SOURCE_MAP_ENCODING,
  source_map_max_uncompressed_bytes: MAX_SOURCE_MAP_UNCOMPRESSED_BYTES,
  line_break_tags: Object.freeze([
    'address', 'article', 'aside', 'blockquote', 'br', 'caption', 'dd', 'div', 'dl',
    'dt', 'fieldset', 'figcaption', 'figure', 'footer', 'form', 'h1', 'h2', 'h3',
    'h4', 'h5', 'h6', 'header', 'hr', 'li', 'main', 'nav', 'ol', 'p', 'pre',
    'section', 'table', 'tbody', 'tfoot', 'thead', 'tr', 'ul',
  ]),
  space_break_tags: Object.freeze(['td', 'th']),
  suppressed_raw_text_tags: Object.freeze(['script', 'style']),
});

const CONVERTER_DIGEST = sha256Hex(fs.readFileSync(__filename));
const CONFIG_DIGEST = contentId('SEC_HTML_CANONICAL_TEXT_CONFIG/V1', CONFIG);
const LINE_BREAK_TAGS = new Set(CONFIG.line_break_tags);
const SPACE_BREAK_TAGS = new Set(CONFIG.space_break_tags);
const RAW_TAGS = new Set(CONFIG.suppressed_raw_text_tags);
const ENTITY_RE = /&(?:#(?:[xX][0-9A-Fa-f]+|[0-9]+)|[A-Za-z][A-Za-z0-9]+);/g;
const WHITESPACE_RE = /^[\u0009-\u000d\u0020\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]$/u;
const CP1252 = Object.freeze([
  0x20ac, 0x81, 0x201a, 0x192, 0x201e, 0x2026, 0x2020, 0x2021,
  0x2c6, 0x2030, 0x160, 0x2039, 0x152, 0x8d, 0x17d, 0x8f,
  0x90, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014,
  0x2dc, 0x2122, 0x161, 0x203a, 0x153, 0x9d, 0x17e, 0x178,
]);
const NAMED_ENTITIES = Object.freeze({
  amp: '&', apos: "'", bull: '\u2022', copy: '\u00a9', euro: '\u20ac', gt: '>',
  hellip: '\u2026', ldquo: '\u201c', lsquo: '\u2018', lt: '<', mdash: '\u2014',
  middot: '\u00b7', nbsp: '\u00a0', ndash: '\u2013', pound: '\u00a3', quot: '"',
  rdquo: '\u201d', reg: '\u00ae', rsquo: '\u2019', trade: '\u2122', yen: '\u00a5',
  sect: '\u00a7', para: '\u00b6',
  // Named whitespace-width entities. These map onto codepoints already inside
  // WHITESPACE_RE, so they fall through the normal collapse-to-one-space path
  // below rather than needing bespoke handling here.
  ensp: '\u2002', emsp: '\u2003', thinsp: '\u2009',
  // Named zero-width / bidi-control entities. These carry no textual meaning
  // (SEC filings use &lrm; purely to force left-to-right rendering around a
  // cross-reference number) and decoding them to a literal character would
  // still corrupt adjacency-sensitive matching (e.g. "Section 3.1"). Decode
  // to the empty string so they vanish rather than surviving as either the
  // raw "&lrm;" text (the pre-fix bug) or an invisible-but-present codepoint.
  lrm: '', rlm: '', zwj: '', zwnj: '',
});
// Numeric-reference zero-width/bidi codepoints (U+200B..U+200F): same
// no-textual-meaning rationale as the named entities above, handled
// separately in decodeEntity because they arrive as &#8203;-style refs.
const ZERO_WIDTH_CODEPOINTS = new Set([0x200b, 0x200c, 0x200d, 0x200e, 0x200f]);

class SecHtmlCanonicalTextError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'SecHtmlCanonicalTextError';
    this.code = code;
  }
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function byteIndex(text) {
  const offsets = new Uint32Array(text.length + 1);
  let byte = 0;
  for (let i = 0; i < text.length;) {
    const point = text.codePointAt(i);
    const width = point > 0xffff ? 2 : 1;
    offsets[i] = byte;
    if (width === 2) offsets[i + 1] = byte;
    byte += Buffer.byteLength(String.fromCodePoint(point), 'utf8');
    i += width;
  }
  offsets[text.length] = byte;
  return offsets;
}

function tagEnd(text, start) {
  let quote = null;
  for (let i = start + 1; i < text.length; i += 1) {
    const character = text[i];
    if (quote) {
      if (character === quote) quote = null;
    } else if (character === '"' || character === "'") {
      quote = character;
    } else if (character === '>') {
      return i + 1;
    }
  }
  return -1;
}

function tagInfo(source) {
  const markup = source.match(/^<\s*([!?])/);
  if (markup) {
    return {
      closing: false,
      name: markup[1] === '?' ? '#processing-instruction' : '#declaration',
      self_closing: true,
      markup: true,
    };
  }
  const match = source.match(/^<\s*(\/)?\s*([A-Za-z][A-Za-z0-9:-]*)/);
  if (!match) return null;
  return {
    closing: Boolean(match[1]),
    name: match[2].toLowerCase(),
    self_closing: /\/\s*>$/.test(source),
  };
}

function lexHtml(text, offsets) {
  const regions = [];
  const add = (start, end, kind, tagName) => {
    if (end <= start) return;
    const previous = regions.at(-1);
    if (previous && previous.input_end === offsets[start]
      && previous.region_kind === kind && previous.tag_name === tagName) {
      previous.input_end = offsets[end];
      previous.character_end = end;
      return;
    }
    const region = {
      input_start: offsets[start],
      input_end: offsets[end],
      region_kind: kind,
      character_start: start,
      character_end: end,
    };
    if (tagName) region.tag_name = tagName;
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
    const end = tagEnd(text, opening);
    const info = end < 0 ? null : tagInfo(text.slice(opening, end));
    if (!info) {
      add(opening, opening + 1, 'TEXT');
      cursor = opening + 1;
      continue;
    }
    add(opening, end, info.markup ? 'MARKUP' : 'TAG', info.name);
    cursor = end;
    if (!info.closing && !info.self_closing && RAW_TAGS.has(info.name)) {
      const closePattern = new RegExp(`<\\/\\s*${info.name}\\s*>`, 'ig');
      closePattern.lastIndex = cursor;
      const close = closePattern.exec(text);
      const rawEnd = close ? close.index : text.length;
      add(cursor, rawEnd, `SUPPRESSED_${info.name.toUpperCase()}`, info.name);
      if (close) {
        add(close.index, closePattern.lastIndex, 'TAG', info.name);
        cursor = closePattern.lastIndex;
      } else {
        cursor = text.length;
      }
    }
  }
  return regions;
}

function decodeEntity(entity) {
  if (entity[1] !== '#') return NAMED_ENTITIES[entity.slice(1, -1)] ?? null;
  const hexadecimal = entity[2] === 'x' || entity[2] === 'X';
  let point = Number.parseInt(entity.slice(hexadecimal ? 3 : 2, -1), hexadecimal ? 16 : 10);
  if (point >= 0x80 && point <= 0x9f) point = CP1252[point - 0x80];
  if (ZERO_WIDTH_CODEPOINTS.has(point)) return '';
  if (point === 0 || point > 0x10ffff || (point >= 0xd800 && point <= 0xdfff)) point = 0xfffd;
  return String.fromCodePoint(point);
}

function canonicalise(text, offsets, regions) {
  const parts = [];
  const mappings = [];
  let outputLength = 0;
  let pending = null;

  const append = (value, inputStart, inputEnd, kind) => {
    if (!value) return;
    const size = Buffer.byteLength(value, 'utf8');
    const previous = mappings.at(-1);
    if (previous && previous.output_end === outputLength && previous.input_end === inputStart
      && previous.mapping_kind === kind) {
      parts[parts.length - 1] += value;
      previous.output_end += size;
      previous.input_end = inputEnd;
    } else {
      parts.push(value);
      mappings.push({
        output_start: outputLength,
        output_end: outputLength + size,
        input_start: inputStart,
        input_end: inputEnd,
        mapping_kind: kind,
      });
    }
    outputLength += size;
  };
  const noteWhitespace = (strength, start, end) => {
    if (!pending) pending = { strength, start, end };
    else {
      pending.strength = Math.max(pending.strength, strength);
      pending.end = Math.max(pending.end, end);
    }
  };
  const emit = (value, start, end, kind) => {
    if (WHITESPACE_RE.test(value)) {
      noteWhitespace(1, start, end);
      return;
    }
    if (pending) {
      if (outputLength > 0) append(pending.strength === 2 ? '\n' : ' ', pending.start, pending.end,
        pending.strength === 2 ? 'NORMALIZED_LINE_BREAK' : 'NORMALIZED_SPACE');
      pending = null;
    }
    append(value, start, end, kind);
  };
  const emitLiteral = (start, end) => {
    for (let index = start; index < end;) {
      const point = text.codePointAt(index);
      const width = point > 0xffff ? 2 : 1;
      emit(String.fromCodePoint(point), offsets[index], offsets[index + width], 'DIRECT_TEXT');
      index += width;
    }
  };
  const emitText = (start, end) => {
    ENTITY_RE.lastIndex = start;
    let cursor = start;
    for (let match = ENTITY_RE.exec(text); match && match.index < end; match = ENTITY_RE.exec(text)) {
      if (match.index + match[0].length > end) break;
      emitLiteral(cursor, match.index);
      const decoded = decodeEntity(match[0]);
      if (decoded === null) emitLiteral(match.index, match.index + match[0].length);
      else emit(decoded, offsets[match.index], offsets[match.index + match[0].length], 'DECODED_ENTITY');
      cursor = match.index + match[0].length;
    }
    emitLiteral(cursor, end);
  };

  for (const region of regions) {
    if (region.region_kind === 'TEXT') emitText(region.character_start, region.character_end);
    else if (region.region_kind === 'TAG') {
      if (LINE_BREAK_TAGS.has(region.tag_name)) noteWhitespace(2, region.input_start, region.input_end);
      else if (SPACE_BREAK_TAGS.has(region.tag_name)) noteWhitespace(1, region.input_start, region.input_end);
    }
  }
  return { text: parts.join(''), mappings, byteLength: outputLength };
}

function compactSourceMap(inputRegions, outputMappings) {
  return {
    schema_version: 'SEC_CANONICAL_TEXT_SOURCE_MAP/V2',
    input_regions: inputRegions.map((region) => [
      region.input_start,
      region.input_end,
      region.region_kind,
      region.tag_name ?? null,
    ]),
    output_mappings: outputMappings.map((mapping) => [
      mapping.output_start,
      mapping.output_end,
      mapping.input_start,
      mapping.input_end,
      mapping.mapping_kind,
    ]),
  };
}

function decodeSecHtmlCanonicalTextSourceMap(conversion) {
  if (!conversion || conversion.schema_version !== 'SEC_HTML_CANONICAL_TEXT_CONVERSION/V2'
    || conversion.source_map_encoding !== SOURCE_MAP_ENCODING) {
    throw new SecHtmlCanonicalTextError('INVALID_SOURCE_MAP', 'conversion does not use the pinned V2 source-map contract.');
  }
  const compressed = Buffer.from(conversion.source_map_payload_base64 || '', 'base64');
  if (compressed.length === 0 || compressed.length > MAX_SOURCE_MAP_UNCOMPRESSED_BYTES
    || compressed.toString('base64') !== conversion.source_map_payload_base64
    || sha256Hex(compressed) !== conversion.source_map_compressed_sha256) {
    throw new SecHtmlCanonicalTextError('INVALID_SOURCE_MAP', 'compressed source-map payload or digest is invalid.');
  }
  if (!Number.isInteger(conversion.source_map_uncompressed_byte_length)
    || conversion.source_map_uncompressed_byte_length <= 0
    || conversion.source_map_uncompressed_byte_length > MAX_SOURCE_MAP_UNCOMPRESSED_BYTES) {
    throw new SecHtmlCanonicalTextError('SOURCE_MAP_LIMIT_EXCEEDED', 'source map exceeds the bounded decode limit.');
  }
  let uncompressed;
  try {
    uncompressed = zlib.inflateRawSync(compressed, {
      maxOutputLength: MAX_SOURCE_MAP_UNCOMPRESSED_BYTES,
    });
  } catch {
    throw new SecHtmlCanonicalTextError('INVALID_SOURCE_MAP', 'source-map payload cannot be inflated within its bound.');
  }
  if (uncompressed.length !== conversion.source_map_uncompressed_byte_length) {
    throw new SecHtmlCanonicalTextError('INVALID_SOURCE_MAP', 'inflated source-map length does not match its contract.');
  }
  let compact;
  try {
    compact = JSON.parse(uncompressed.toString('utf8'));
  } catch {
    throw new SecHtmlCanonicalTextError('INVALID_SOURCE_MAP', 'inflated source map is not canonical JSON.');
  }
  if (canonicalJson(compact) !== uncompressed.toString('utf8')
    || !compact || compact.schema_version !== 'SEC_CANONICAL_TEXT_SOURCE_MAP/V2'
    || !Array.isArray(compact.input_regions) || !Array.isArray(compact.output_mappings)
    || compact.input_regions.length !== conversion.input_region_count
    || compact.output_mappings.length !== conversion.output_mapping_count
    || contentId('SEC_CANONICAL_TEXT_SOURCE_MAP/V2', compact) !== conversion.source_map_digest) {
    throw new SecHtmlCanonicalTextError('INVALID_SOURCE_MAP', 'source-map schema, counts or digest do not match.');
  }
  const integer = (value) => Number.isInteger(value) && value >= 0;
  const inputRegions = compact.input_regions.map((tuple) => {
    if (!Array.isArray(tuple) || tuple.length !== 4 || !integer(tuple[0])
      || !integer(tuple[1]) || tuple[1] <= tuple[0] || typeof tuple[2] !== 'string'
      || (tuple[3] !== null && typeof tuple[3] !== 'string')) {
      throw new SecHtmlCanonicalTextError('INVALID_SOURCE_MAP', 'source-map input tuple is invalid.');
    }
    const region = { input_start: tuple[0], input_end: tuple[1], region_kind: tuple[2] };
    if (tuple[3] !== null) region.tag_name = tuple[3];
    return region;
  });
  const outputMappings = compact.output_mappings.map((tuple) => {
    if (!Array.isArray(tuple) || tuple.length !== 5 || !integer(tuple[0])
      || !integer(tuple[1]) || !integer(tuple[2]) || !integer(tuple[3])
      || tuple[1] <= tuple[0] || tuple[3] <= tuple[2] || typeof tuple[4] !== 'string') {
      throw new SecHtmlCanonicalTextError('INVALID_SOURCE_MAP', 'source-map output tuple is invalid.');
    }
    return {
      output_start: tuple[0], output_end: tuple[1], input_start: tuple[2],
      input_end: tuple[3], mapping_kind: tuple[4],
    };
  });
  return deepFreeze({ input_regions: inputRegions, output_mappings: outputMappings });
}

function convertSecHtmlToCanonicalText(capture) {
  validateSecEdgarIntakeCapture(capture);
  const bytes = Buffer.from(capture.response_bytes_base64, 'base64');
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    throw new SecHtmlCanonicalTextError('INVALID_UTF8', 'captured SEC response bytes must be valid UTF-8.');
  }
  const offsets = byteIndex(text);
  const inputRegions = lexHtml(text, offsets);
  const canonical = canonicalise(text, offsets, inputRegions);
  const canonicalTextSha256 = sha256Hex(Buffer.from(canonical.text, 'utf8'));
  const publicInputRegions = inputRegions.map(({
    character_start: characterStart,
    character_end: characterEnd,
    ...region
  }) => region);
  const compactMap = compactSourceMap(publicInputRegions, canonical.mappings);
  const sourceMapJson = canonicalJson(compactMap);
  const sourceMapBytes = Buffer.from(sourceMapJson, 'utf8');
  if (sourceMapBytes.length > MAX_SOURCE_MAP_UNCOMPRESSED_BYTES) {
    throw new SecHtmlCanonicalTextError('SOURCE_MAP_LIMIT_EXCEEDED', 'source map exceeds the conversion limit.');
  }
  const compressedSourceMap = zlib.deflateRawSync(sourceMapBytes, {
    level: 9,
    windowBits: 15,
    memLevel: 8,
    strategy: zlib.constants.Z_DEFAULT_STRATEGY,
  });
  const sourceMapDigest = contentId('SEC_CANONICAL_TEXT_SOURCE_MAP/V2', compactMap);
  const identity = {
    source_response_content_id: capture.source_response_content_id,
    converter_digest: CONVERTER_DIGEST,
    converter_config_digest: CONFIG_DIGEST,
    canonical_text_sha256: canonicalTextSha256,
    canonical_text_byte_length: canonical.byteLength,
    source_map_digest: sourceMapDigest,
  };
  return deepFreeze({
    schema_version: 'SEC_HTML_CANONICAL_TEXT_CONVERSION/V2',
    conversion_stage: 'CONVERSION_ONLY',
    verification_status: 'NOT_ATTEMPTED',
    source_admission_status: 'NOT_ATTEMPTED',
    source_response_content_id: capture.source_response_content_id,
    intake_capture_receipt_id: capture.intake_capture_receipt_id,
    converter_digest: CONVERTER_DIGEST,
    converter_config_digest: CONFIG_DIGEST,
    canonical_text: canonical.text,
    canonical_text_sha256: canonicalTextSha256,
    canonical_text_byte_length: canonical.byteLength,
    source_map_encoding: SOURCE_MAP_ENCODING,
    source_map_payload_base64: compressedSourceMap.toString('base64'),
    source_map_compressed_sha256: sha256Hex(compressedSourceMap),
    source_map_uncompressed_byte_length: sourceMapBytes.length,
    input_region_count: publicInputRegions.length,
    output_mapping_count: canonical.mappings.length,
    source_map_digest: sourceMapDigest,
    canonical_text_id: contentId('SEC_CANONICAL_TEXT/V2', identity),
  });
}

function validateSecHtmlCanonicalTextConversion({ capture, conversion } = {}) {
  const rebuilt = convertSecHtmlToCanonicalText(capture);
  if (canonicalJson(rebuilt) !== canonicalJson(conversion)) {
    throw new SecHtmlCanonicalTextError('CONVERSION_MISMATCH', 'conversion does not match captured bytes and pinned converter.');
  }
  return true;
}

module.exports = {
  CONFIG_DIGEST,
  CONVERTER_DIGEST,
  MAX_SOURCE_MAP_UNCOMPRESSED_BYTES,
  SOURCE_MAP_ENCODING,
  SecHtmlCanonicalTextError,
  convertSecHtmlToCanonicalText,
  decodeSecHtmlCanonicalTextSourceMap,
  validateSecHtmlCanonicalTextConversion,
};
