/* ─────────────────────────────────────────────────────────────────────────
   lib/citable.js — the value model for parser output.
   ───────────────────────────────────────────────────────────────────────────
   The parser emits feature values in one of four shapes, and the UI has to
   discriminate between them on every render. Centralizing the discriminators
   here (instead of redefining them per-page) keeps "what is this value and
   what quote supports it" answered ONE way everywhere.

     1. bare scalar          "47.50" | 12 | true
     2. citable wrapper       { value, quotes: [...] }      (current)
                              { value, text: "..." }        (legacy)
     3. tagged item           { code, label, text }         (taxonomy-resolved)
     4. provision object      { full_text, ai_metadata, ... }

   Quote-resolution precedence (used by evidenceQuote / resolveEvidence):
     citable quotes → tagged .text → provision.full_text fallback
   ───────────────────────────────────────────────────────────────────────── */

import { taxonomyForFeatureKey, labelForCode } from './taxonomy';

/* Max characters shown inside a hover popover before eliding with "…". */
export const TOOLTIP_MAX = 600;
/* Slice length applied to a provision's full_text when it is used as the
 * evidence fallback (so the document highlighter targets a bounded span,
 * not the entire section). */
export const EVIDENCE_SLICE = 600;

/* ── ai_metadata parsing ── */
export function getAiMetadata(provision) {
  if (!provision || !provision.ai_metadata) return null;
  if (typeof provision.ai_metadata === 'string') {
    try { return JSON.parse(provision.ai_metadata); } catch { return null; }
  }
  return provision.ai_metadata;
}

export function getStructuredFeatures(provision) {
  const meta = getAiMetadata(provision);
  if (!meta || !meta.features) return null;
  const feats = meta.features;
  if (typeof feats !== 'object' || Array.isArray(feats)) return null;
  if (Object.keys(feats).length === 0) return null;
  return feats;
}

/* ── Tagged items: {code, label, text} produced when the parser maps a free-
 *    text exception / qualifier onto a canonical taxonomy code. ── */
export function isTaggedItem(v) {
  return (
    v &&
    typeof v === 'object' &&
    !Array.isArray(v) &&
    typeof v.code === 'string' &&
    v.code.length > 0
  );
}

export function resolveTaggedLabel(featureKey, item, customExtensions) {
  if (!isTaggedItem(item)) return null;
  if (item.label && typeof item.label === 'string') return item.label;
  // Deal-scoped custom extension labels win over canonical when the code matches.
  if (customExtensions && Array.isArray(customExtensions[featureKey])) {
    const hit = customExtensions[featureKey].find((e) => e && e.code === item.code);
    if (hit && hit.label) return hit.label;
  }
  const dict = taxonomyForFeatureKey(featureKey);
  return labelForCode(item.code, dict || {}) || item.code;
}

/* ── Citable wrapper: {value, quotes|text} carrying verbatim source quotes for
 *    a boolean / enum / number. Distinguished from a tagged item by having a
 *    `value` field and NO `code` field. ── */
export function isCitableValue(v) {
  return (
    v != null &&
    typeof v === 'object' &&
    !Array.isArray(v) &&
    'value' in v &&
    !('code' in v)
  );
}

export function getCitableValue(v) {
  return isCitableValue(v) ? v.value : v;
}

/* Returns the verbatim supporting quotes, normalized from the current
 * ({ value, quotes: [...] }) or legacy ({ value, text: "..." }) shape.
 * Empty / whitespace-only entries are dropped. */
export function getCitableQuotes(v) {
  if (!isCitableValue(v)) return [];
  if (Array.isArray(v.quotes)) {
    return v.quotes
      .filter((q) => typeof q === 'string')
      .map((q) => q.trim())
      .filter(Boolean);
  }
  if (typeof v.text === 'string') {
    const t = v.text.trim();
    return t ? [t] : [];
  }
  return [];
}

/* Legacy single-quote accessor — returns the FIRST quote. New code should
 * prefer getCitableQuotes() / resolveEvidence(). */
export function getCitableText(v) {
  const quotes = getCitableQuotes(v);
  return quotes.length > 0 ? quotes[0] : null;
}

/* Find the tightest window of `text` that contains `needle` (e.g. "$47.50"),
 * expanded out to sentence-ish boundaries, capped at EVIDENCE_SLICE chars.
 * Returns null when the needle isn't present. Used so a full_text fallback
 * surfaces the SENTENCE that actually supports the value, not the whole
 * provision. */
export function focusSnippet(text, needle) {
  if (typeof text !== 'string' || !text.trim()) return null;
  if (needle === null || needle === undefined || needle === '') return null;
  const hay = text;
  const probe = String(needle).trim();
  if (!probe) return null;
  let idx = hay.indexOf(probe);
  if (idx < 0) {
    // Retry without a leading currency symbol / commas (value may be stored
    // as "47.50" but printed as "$47.50" or "47,50").
    const bare = probe.replace(/^[$€£]/, '').replace(/,/g, '');
    if (bare && bare !== probe) idx = hay.replace(/,/g, '').indexOf(bare);
  }
  if (idx < 0) return null;
  // Expand to the surrounding sentence: back to the previous sentence
  // terminator, forward to the next one, bounded by a hard window.
  const HARD = Math.floor(EVIDENCE_SLICE * 0.9);
  let start = idx;
  while (start > 0 && idx - start < HARD && !/[.;\n]/.test(hay[start - 1])) start--;
  let end = idx + probe.length;
  while (end < hay.length && end - idx < HARD && !/[.;\n]/.test(hay[end])) end++;
  const snippet = hay.slice(start, Math.min(end + 1, hay.length)).trim();
  return snippet || null;
}

/* ── resolveEvidence — the ONE quote-resolution path ──
 *  Given a feature value (citable / tagged / bare) and optionally the owning
 *  provision, returns:
 *    { quotes, primaryQuote }
 *  Precedence: citable quotes → tagged .text → provision.full_text fallback.
 *  When falling back to full_text and a `focusOn` needle is supplied (or the
 *  rawValue is itself a short scalar), the fallback is narrowed to the
 *  sentence containing that needle instead of dumping the whole provision —
 *  so the hover snippet closely supports the displayed value. Pass
 *  { fallbackToFullText: false } to suppress the provision-text fallback. */
export function resolveEvidence(rawValue, opts = {}) {
  const { provision = null, fallbackToFullText = true, focusOn = null } = opts;
  let quotes = [];
  if (isCitableValue(rawValue)) {
    quotes = getCitableQuotes(rawValue);
  } else if (isTaggedItem(rawValue) && typeof rawValue.text === 'string' && rawValue.text.trim()) {
    quotes = [rawValue.text.trim()];
  }
  if (quotes.length === 0 && fallbackToFullText && provision &&
      typeof provision.full_text === 'string' && provision.full_text.trim()) {
    const full = provision.full_text.trim();
    // Derive a needle to focus on: explicit focusOn, else a short scalar value.
    let needle = focusOn;
    if (!needle) {
      const inner = isCitableValue(rawValue) ? getCitableValue(rawValue) : rawValue;
      if ((typeof inner === 'string' || typeof inner === 'number') &&
          String(inner).trim().length > 0 && String(inner).trim().length <= 40) {
        needle = String(inner).trim();
      }
    }
    const focused = needle ? focusSnippet(full, needle) : null;
    quotes = [focused || full.slice(0, EVIDENCE_SLICE)];
  }
  return { quotes, primaryQuote: quotes.length > 0 ? quotes[0] : null };
}

/* Convenience: just the primary supporting quote (or null). Replaces the many
 * per-component buildQuote() / extractQuote() / buildRowQuote() closures. */
export function evidenceQuote(rawValue, opts = {}) {
  return resolveEvidence(rawValue, opts).primaryQuote;
}
