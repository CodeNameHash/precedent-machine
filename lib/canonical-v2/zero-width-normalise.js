/**
 * lib/canonical-v2/zero-width-normalise.js
 *
 * Zero-width and bidirectional marks are REAL characters in SEC filings.
 * EDGAR routinely emits `Section&nbsp;<B><I>&lrm;</I></B>3.1(b)(i)` — the
 * left-to-right mark forces rendering order around a cross-reference number
 * and is genuinely present in the document.
 *
 * TWO LAYERS, DELIBERATELY SEPARATE:
 *
 *  1. CANONICAL TEXT IS FAITHFUL. The converter decodes `&lrm;` to U+200E and
 *     keeps it. Deleting it would make our text a lie about the document:
 *     quotes would stop reproducing the source honestly, and every byte offset
 *     after the deletion would shift. Reviewed slices in this repo already
 *     depend on those marks being present (see
 *     reviewed-qxo-admitted-no-shop-actions-slice.js, whose anchor string
 *     contains a literal U+200E between "Article" and "VI").
 *
 *  2. MATCHING IS TOLERANT. Searching for a section heading or resolving a
 *     citation must not fail because an invisible mark sits between "Section"
 *     and "3.1". Comparison-time normalisation strips these marks from BOTH
 *     sides of a comparison without ever mutating stored text.
 *
 * Use `normaliseForMatching` anywhere you compare human-meaningful text —
 * section detection, citation constructibility, quote location. Never use it
 * to produce anything that gets stored, hashed, or offset-indexed.
 */

'use strict';

// U+200B ZWSP, U+200C ZWNJ, U+200D ZWJ, U+200E LRM, U+200F RLM,
// U+FEFF BOM/ZWNBSP, U+00AD SOFT HYPHEN.
const ZERO_WIDTH_PATTERN = /[​‌‍‎‏﻿­]/g;

/**
 * Strip zero-width and bidi marks for comparison purposes only.
 * @param {string} value
 * @returns {string}
 */
function normaliseForMatching(value) {
  if (typeof value !== 'string') {
    throw new TypeError('normaliseForMatching expects a string');
  }
  return value.replace(ZERO_WIDTH_PATTERN, '');
}

/**
 * True when two strings are equal once zero-width marks are disregarded.
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function equalsIgnoringZeroWidth(a, b) {
  return normaliseForMatching(a) === normaliseForMatching(b);
}

/**
 * Index of `needle` in `haystack`, ignoring zero-width marks on both sides,
 * returned as an offset into the ORIGINAL haystack so byte spans stay valid.
 * Returns -1 when absent.
 * @param {string} haystack
 * @param {string} needle
 * @returns {number}
 */
function indexOfIgnoringZeroWidth(haystack, needle) {
  if (typeof haystack !== 'string' || typeof needle !== 'string') {
    throw new TypeError('indexOfIgnoringZeroWidth expects strings');
  }
  // Build a map from normalised index -> original index so the caller gets an
  // offset it can still slice the untouched source with.
  const originalIndexByNormalised = [];
  let normalised = '';
  for (let i = 0; i < haystack.length; i += 1) {
    const ch = haystack[i];
    if (!/[​‌‍‎‏﻿­]/.test(ch)) {
      originalIndexByNormalised.push(i);
      normalised += ch;
    }
  }
  const normalisedNeedle = normaliseForMatching(needle);
  if (normalisedNeedle === '') return -1;
  const hit = normalised.indexOf(normalisedNeedle);
  if (hit === -1) return -1;
  return originalIndexByNormalised[hit];
}

module.exports = {
  ZERO_WIDTH_PATTERN,
  normaliseForMatching,
  equalsIgnoringZeroWidth,
  indexOfIgnoringZeroWidth,
};
