const { TextDecoder } = require('node:util');
const fs = require('node:fs');

const { canonicalJson, contentId, sha256Hex } = require('./canonical-bytes');
const { validateSecEdgarIntakeCapture } = require('./sec-edgar-intake-capture');

const CONFIG = Object.freeze({
  schema_version: 'SEC_HTML_CANONICAL_TEXT_CONFIG/V1',
  encoding: 'UTF-8_FATAL_PRESERVE_BOM',
  entity_policy: 'HTML_NUMERIC_CP1252_AND_PINNED_NAMED/V1',
  whitespace_policy: 'COLLAPSE_TEXT_AND_STRUCTURAL_BREAKS/V1',
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
});

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
  const sourceMapDigest = contentId('SEC_CANONICAL_TEXT_SOURCE_MAP/V1', {
    input_regions: publicInputRegions,
    output_mappings: canonical.mappings,
  });
  const identity = {
    source_response_content_id: capture.source_response_content_id,
    converter_digest: CONVERTER_DIGEST,
    converter_config_digest: CONFIG_DIGEST,
    canonical_text_sha256: canonicalTextSha256,
    canonical_text_byte_length: canonical.byteLength,
    source_map_digest: sourceMapDigest,
  };
  return deepFreeze({
    schema_version: 'SEC_HTML_CANONICAL_TEXT_CONVERSION/V1',
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
    source_map_digest: sourceMapDigest,
    canonical_text_id: contentId('SEC_CANONICAL_TEXT/V1', identity),
    input_regions: publicInputRegions,
    output_mappings: canonical.mappings,
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
  SecHtmlCanonicalTextError,
  convertSecHtmlToCanonicalText,
  validateSecHtmlCanonicalTextConversion,
};
