'use strict';

// Splits one section's exact text into marked and unmarked parts so a
// focused review can show a fact's cited words inside the full provision.
// Byte offsets are UTF-8 offsets in the canonical text; the section span's
// own start byte anchors them. Overlapping or touching spans merge.

function byteRangesToParts(sectionText, sectionStartByte, spans) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const bytes = encoder.encode(sectionText);
  const ranges = (spans || [])
    .filter((span) => Number.isSafeInteger(span?.start_byte) && Number.isSafeInteger(span?.end_byte))
    .map((span) => [span.start_byte - sectionStartByte, span.end_byte - sectionStartByte])
    .map(([start, end]) => [Math.max(0, start), Math.min(bytes.length, end)])
    .filter(([start, end]) => end > start)
    .sort((left, right) => left[0] - right[0]);
  const merged = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else merged.push([...range]);
  }
  const parts = [];
  let cursor = 0;
  for (const [start, end] of merged) {
    if (start > cursor) parts.push({ text: decoder.decode(bytes.slice(cursor, start)), marked: false });
    parts.push({ text: decoder.decode(bytes.slice(start, end)), marked: true });
    cursor = end;
  }
  if (cursor < bytes.length) parts.push({ text: decoder.decode(bytes.slice(cursor)), marked: false });
  return parts;
}

function firstCitedByte(spans) {
  const starts = (spans || []).map((span) => span?.start_byte).filter(Number.isSafeInteger);
  return starts.length ? Math.min(...starts) : Number.MAX_SAFE_INTEGER;
}

function parseFocusSections(value) {
  const raw = Array.isArray(value) ? value.join(',') : String(value || '');
  return [...new Set(raw.split(',').map((item) => item.trim()).filter(Boolean))];
}

module.exports = { byteRangesToParts, firstCitedByte, parseFocusSections };
