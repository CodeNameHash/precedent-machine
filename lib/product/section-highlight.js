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

// Two levels of marking: the cited words (strong) inside the whole fact
// (light), so a qualifier reads in the context of its representation (Ben,
// 2026-09-13: "put some form of lighter highlighting on the whole rep so it
// is easily viewed"). Parts carry level 'strong', 'light' or null.
function byteRangesToLayeredParts(sectionText, sectionStartByte, strongSpans, lightSpans) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const bytes = encoder.encode(sectionText);
  const normalise = (spans) => (spans || [])
    .filter((span) => Number.isSafeInteger(span?.start_byte) && Number.isSafeInteger(span?.end_byte))
    .map((span) => [Math.max(0, span.start_byte - sectionStartByte), Math.min(bytes.length, span.end_byte - sectionStartByte)])
    .filter(([start, end]) => end > start);
  const strong = normalise(strongSpans);
  const light = normalise(lightSpans);
  const cuts = new Set([0, bytes.length]);
  for (const [start, end] of [...strong, ...light]) { cuts.add(start); cuts.add(end); }
  const points = [...cuts].sort((left, right) => left - right);
  const levelAt = (start, end) => {
    if (strong.some(([a, b]) => a <= start && end <= b)) return 'strong';
    if (light.some(([a, b]) => a <= start && end <= b)) return 'light';
    return null;
  };
  const parts = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const [start, end] = [points[index], points[index + 1]];
    if (end <= start) continue;
    const level = levelAt(start, end);
    const text = decoder.decode(bytes.slice(start, end));
    const last = parts[parts.length - 1];
    if (last && last.level === level) last.text += text;
    else parts.push({ text, level, marked: level === 'strong' });
  }
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

module.exports = { byteRangesToParts, byteRangesToLayeredParts, firstCitedByte, parseFocusSections };
