// ───────────────────────────────────────────────────────────────────────────
// lib/abry.js — pure derivation logic for the "No Other Reps / Fraud (Abry)"
// review-page summary.
//
// DELIBERATELY JSX-FREE and dependency-free: `npm test` runs under
// `node --test` with no build step, so this module is directly importable by
// tests via dynamic import (same pattern as components/review/table-logic.js
// and lib/canonical-conditions.js). components/review/NoOtherRepsFraudTable.js
// imports these helpers and wires them into JSX.
//
// THE FOUR QUESTIONS this feeds (one row each):
//   Q1  Does the BUYER make a clear non-reliance representation?
//   Q2  Does the SELLER make a clear no-other-reps statement — and scope?
//   Q3  Reciprocal of Q1 — seller non-reliance on buyer's extra-contractual
//       statements.
//   Q4  Reciprocal of Q2 — buyer no-other-reps statement + scope.
// Plus a fraud line: verbatim carve-out, or "Silent on fraud" (silence is
// legally meaningful — never inferred).
//
// SOURCE PROVISIONS: the five underlying fields (noOtherRepsPresent,
// noOtherRepsParty, nonRelianceClause, extraContractualClaimsWaived,
// fraudCarveout — see lib/rubric.js) can land on a titled section
// (REP-T-NOREP / REP-B-NOREP / REP-B-ANTIRELIANCE) OR be embedded in a
// MISC-ENTIRE "Entire Agreement" section with no dedicated title (Metsera
// §9.07 pattern — see lib/parser-v2/extract.js's MISC block). This module
// scans EVERY provision regardless of type/code, so it is agnostic to which
// of those landing spots a given deal used.
//
// PARTY → QUESTION MAPPING: noOtherRepsParty records WHOSE reps are
// disclaimed beyond the agreement. A single clause pairs that disclaimer
// with the counterparty's non-reliance acknowledgment (drafters write these
// as one sentence — see the nonRelianceClause field definition), so:
//   party COMPANY (or BOTH) → evidences Q1 (buyer non-reliance) AND
//                              Q2 (seller no-other-reps)
//   party PARENT  (or BOTH) → evidences Q3 (seller non-reliance) AND
//                              Q4 (buyer no-other-reps)
// When a single MISC-ENTIRE provision addresses BOTH sides in separate
// sub-paragraphs, nonRelianceClause carries both verbatim excerpts separated
// by a blank line (company-side first) — splitDualSegments recovers them so
// Q1/Q2 and Q3/Q4 each get their own quote instead of sharing one.
// ───────────────────────────────────────────────────────────────────────────

const isCitable = (v) => v != null && typeof v === 'object' && !Array.isArray(v) && 'value' in v && !('code' in v);
const isTagged = (v) => v != null && typeof v === 'object' && !Array.isArray(v) && typeof v.code === 'string' && v.code.length > 0;
const unwrap = (v) => (isCitable(v) ? v.value : v);

/* Read a provision's structured features object, mirroring
 * lib/citable.js's getStructuredFeatures (inlined so this module stays
 * dependency-free rather than importing the ESM/CJS-interop-sensitive
 * lib/citable.js). */
function getFeatures(p) {
  const meta = p && p.ai_metadata;
  if (!meta || typeof meta !== 'object' || !meta.features) return null;
  const feats = meta.features;
  if (typeof feats !== 'object' || Array.isArray(feats)) return null;
  return feats;
}

/* Best-effort verbatim text out of a feature value of unknown shape (bare
 * string, citable { value, quotes } / { value, text } wrapper, or tagged
 * { code, label, text } item). Returns null for anything unusable. */
function textOf(raw) {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'string') {
    const t = raw.trim();
    return t || null;
  }
  if (isCitable(raw)) {
    // Prefer the verbatim evidence (quotes / legacy text) over the inner
    // "value" — for a citable wrapper the value can be a normalized/derived
    // answer rather than the verbatim source. Only fall back to the inner
    // value when no verbatim quote was captured.
    if (Array.isArray(raw.quotes) && raw.quotes.length) {
      const q = String(raw.quotes[0]).trim();
      if (q) return q;
    }
    if (typeof raw.text === 'string' && raw.text.trim()) return raw.text.trim();
    const inner = unwrap(raw);
    if (typeof inner === 'string' && inner.trim()) return inner.trim();
    return null;
  }
  if (isTagged(raw)) {
    if (typeof raw.text === 'string' && raw.text.trim()) return raw.text.trim();
    if (typeof raw.label === 'string' && raw.label.trim()) return raw.label.trim();
    return null;
  }
  return null;
}

function boolOf(raw) {
  return unwrap(raw) === true;
}

function partyOf(raw) {
  const v = unwrap(raw);
  if (typeof v !== 'string') return null;
  const u = v.trim().toUpperCase();
  return u === 'COMPANY' || u === 'PARENT' || u === 'BOTH' ? u : null;
}

/* Split a verbatim clause into its (up to 2) party-side segments. The
 * MISC-embedded prompt rule instructs the extractor to separate a
 * company-side excerpt from a parent-side excerpt with a blank line when one
 * section addresses both directions (Metsera §9.07(b)/(c)). A section that
 * only addresses one direction — or that couldn't be cleanly split — comes
 * back as a single-element (or empty) array. */
function splitDualSegments(text) {
  if (!text) return [];
  return text
    .split(/\n\s*\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/* Grounded scope label for the no-other-reps questions. Driven ONLY by the
 * extraContractualClaimsWaived boolean (never inferred beyond it); the
 * keyword scan over the actual verbatim quote just names WHICH extra-
 * contractual materials the quote itself names, instead of a generic
 * catch-all — it never adds a descriptor the quote doesn't support. */
function deriveScopeLabel(quoteText, extraContractualClaimsWaived) {
  if (!extraContractualClaimsWaived) return 'Agreement only';
  const t = String(quoteText || '');
  const descriptors = [];
  if (/data\s*rooms?/i.test(t)) descriptors.push('data room');
  if (/management\s+presentations?/i.test(t)) descriptors.push('management presentations');
  if (/projections?|forecasts?/i.test(t)) descriptors.push('projections/forecasts');
  if (/disclosure\s+(?:letter|schedules?)/i.test(t)) descriptors.push('disclosure schedules');
  if (/\bcertificates?\b/i.test(t)) descriptors.push('certificates');
  if (/ancillary\s+agreements?|confidentiality\s+agreement/i.test(t)) descriptors.push('ancillary agreements');
  const suffix = descriptors.length > 0 ? descriptors.join(', ') : 'extra-contractual materials';
  return `Agreement + ${suffix}`;
}

/* Every provision (any type/code) whose features carry noOtherRepsPresent
 * === true, in the order passed in (callers should pass document-order
 * provisions, matching the rest of the review page). */
function collectAbryProvisions(provisions) {
  const out = [];
  for (const p of provisions || []) {
    const f = getFeatures(p);
    if (f && boolOf(f.noOtherRepsPresent)) out.push({ provision: p, features: f });
  }
  return out;
}

/* First non-empty fraudCarveout across ALL provisions (not just the
 * noOtherRepsPresent set — a slightly wider net costs nothing since the key
 * is only ever populated alongside genuine Abry language, per the extraction
 * prompt's pairing rule). */
function firstFraudCarveout(provisions) {
  for (const p of provisions || []) {
    const f = getFeatures(p);
    if (!f) continue;
    const text = textOf(f.fraudCarveout);
    if (text) return { provision: p, text };
  }
  return null;
}

/* First non-empty willfulBreachDefinition across ALL provisions (any type).
 * FB3 missed item 5: the verbatim definition core can land natively on a DEF
 * provision (the deal's own "Willful Breach" / "willful and material breach"
 * defined term — Metsera's pattern) or get copied onto a MISC provision by
 * the linkWillfulBreachDefinition post-pass (lib/parser-v2/extract.js) when
 * the LLM only cross-referenced it there. This table is agnostic to which
 * provision carries it — never filtered to type === 'MISC'. */
function firstWillfulBreachDefinition(provisions) {
  for (const p of provisions || []) {
    const f = getFeatures(p);
    if (!f) continue;
    const text = textOf(f.willfulBreachDefinition);
    if (text) return { provision: p, text };
  }
  return null;
}

/* Build the four-question + fraud summary the review page renders.
 * `provisions` should be the deal's FULL provision list (any type/code) —
 * see the module header for why this can't be scoped to one type. */
function deriveAbrySummary(provisions) {
  const hits = collectAbryProvisions(provisions);

  let companySide = null; // evidences Q1 (buyer non-reliance) + Q2 (seller no-other-reps)
  let parentSide = null; // evidences Q3 (seller non-reliance) + Q4 (buyer no-other-reps)

  for (const hit of hits) {
    const { features: f, provision } = hit;
    const party = partyOf(f.noOtherRepsParty);
    if (!party) continue;
    const segments = splitDualSegments(textOf(f.nonRelianceClause));
    // The extra-contractual-materials language (data room, management
    // presentations, projections) that grounds extraContractualClaimsWaived
    // frequently sits in the ADJACENT fraud-carveout sentence rather than the
    // core non-reliance sentence itself (Metsera §9.07(b): the reliance
    // disclaimer and the "data rooms/management presentations" carve-out are
    // two different sentences in the same sub-paragraph). Fold the
    // matching-index fraud segment into the scope scan — never into the
    // displayed quote — so the scope label isn't blind to language that's
    // right there in the same sub-paragraph.
    const fraudSegments = splitDualSegments(textOf(f.fraudCarveout));
    const waived = boolOf(f.extraContractualClaimsWaived);

    if (party === 'BOTH') {
      const [seg0, seg1] = segments;
      const [fraud0, fraud1] = fraudSegments;
      if (!companySide) companySide = { text: seg0 || null, scopeText: [seg0, fraud0].filter(Boolean).join(' '), waived, provision };
      if (!parentSide) parentSide = { text: seg1 || seg0 || null, scopeText: [seg1 || seg0, fraud1].filter(Boolean).join(' '), waived, provision };
    } else if (party === 'COMPANY') {
      if (!companySide) companySide = { text: segments[0] || null, scopeText: [segments[0], fraudSegments[0]].filter(Boolean).join(' '), waived, provision };
    } else if (party === 'PARENT') {
      if (!parentSide) parentSide = { text: segments[0] || null, scopeText: [segments[0], fraudSegments[0]].filter(Boolean).join(' '), waived, provision };
    }
  }

  const notPresent = { status: 'not_present' };
  const q1 = companySide
    ? { status: 'yes', quote: companySide.text, provision: companySide.provision }
    : notPresent;
  const q2 = companySide
    ? {
        status: 'yes',
        quote: companySide.text,
        scope: deriveScopeLabel(companySide.scopeText, companySide.waived),
        provision: companySide.provision,
      }
    : notPresent;
  const q3 = parentSide
    ? { status: 'yes', quote: parentSide.text, provision: parentSide.provision }
    : notPresent;
  const q4 = parentSide
    ? {
        status: 'yes',
        quote: parentSide.text,
        scope: deriveScopeLabel(parentSide.scopeText, parentSide.waived),
        provision: parentSide.provision,
      }
    : notPresent;

  const fraudHit = firstFraudCarveout(provisions);
  const fraud = fraudHit
    ? { status: 'present', quote: fraudHit.text, provision: fraudHit.provision }
    : { status: 'silent' };

  const wbHit = firstWillfulBreachDefinition(provisions);
  const willfulBreach = wbHit
    ? { status: 'defined', quote: wbHit.text, provision: wbHit.provision }
    : { status: 'not_defined' };

  return { q1, q2, q3, q4, fraud, willfulBreach };
}

export {
  getFeatures,
  textOf,
  boolOf,
  partyOf,
  splitDualSegments,
  deriveScopeLabel,
  collectAbryProvisions,
  firstFraudCarveout,
  firstWillfulBreachDefinition,
  deriveAbrySummary,
};
