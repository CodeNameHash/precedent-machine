// ───────────────────────────────────────────────────────────────────────────
// html-entities.js — numeric HTML-entity decoding with Windows-1252 awareness.
// ───────────────────────────────────────────────────────────────────────────
// SEC EDGAR filings routinely encode "smart" typography using the Windows-1252
// code points in the 128–159 range rather than the Unicode entities:
//   &#147; / &#148;  → “ / ”   (curly double quotes — DELIMIT every defined term)
//   &#145; / &#146;  → ‘ / ’   (curly single quotes / apostrophes)
//   &#150; / &#151;  → – / —   (en / em dash)
// Naively decoding these with String.fromCharCode(147) yields a C1 control
// character (U+0093), not a quote, so any downstream logic that keys on quote
// marks (inline / parenthetical definition detection) silently fails. Map the
// 128–159 range through the cp1252 table; everything else decodes normally.
// CommonJS so both the ingest scripts (require) and the Next API routes (import)
// can use it.

// Windows-1252 printable characters occupying the C1 (128–159) range.
const CP1252 = {
  128: '€', 130: '‚', 131: 'ƒ', 132: '„', 133: '…',
  134: '†', 135: '‡', 136: 'ˆ', 137: '‰', 138: 'Š',
  139: '‹', 140: 'Œ', 142: 'Ž', 145: '‘', 146: '’',
  147: '“', 148: '”', 149: '•', 150: '–', 151: '—',
  152: '˜', 153: '™', 154: 'š', 155: '›', 156: 'œ',
  158: 'ž', 159: 'Ÿ',
};

// Decode a single numeric code point (decimal or hex already parsed) to a
// character, honoring the cp1252 remap for the C1 range.
function fromCp(code) {
  if (Number.isNaN(code)) return '';
  if (code >= 128 && code <= 159 && CP1252[code]) return CP1252[code];
  try { return String.fromCodePoint(code); } catch { return ''; }
}

// Decode all numeric HTML entities (&#NNN; and &#xHH;) in a string, cp1252-aware.
function decodeNumericEntities(s) {
  if (typeof s !== 'string') return '';
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => fromCp(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => fromCp(parseInt(n, 10)));
}

module.exports = { CP1252, fromCp, decodeNumericEntities };
