const ELECTION_SIGNAL_RE = /\b(?:Cash Election|Stock Election|Mixed Election|Non-Election Shares?|Election Deadline|Form of Election|may elect to receive|shall be entitled to elect|Maximum Cash Election|Maximum Stock Election|CVR election|with CVR|without CVR|proration|oversubscribed|Aggregate Cash Consideration|Aggregate Stock Consideration)\b/i;

// ELECTION-REDO-SPEC-2026-07-16 step 2 — negative guard. Some CONSID clauses
// mention "proration"/"election" only to affirmatively DENY that any holder
// choice exists (fixed mixed cash+stock consideration, e.g. IonQ/SkyWater:
// "No election shall be made available ... and no proration shall apply.").
// ELECTION_SIGNAL_RE matches the bare word "proration" in that sentence, so
// without this guard the mechanism gets minted from a clause that is the
// OPPOSITE of an election. The guard only fires when the negative phrasing
// is present AND no affirmative holder-choice language exists anywhere in
// the region — a genuine election document almost always also carries one of
// "entitled to elect" / "may elect" / "Election Deadline" / "Form of
// Election" elsewhere (procedural mechanics), even if one particular sentence
// denies election for a different share class.
const NEGATIVE_ELECTION_RE = /\bno\s+election\s+(?:shall|will)\s+be\s+(?:made\s+available|available|permitted)\b|\bno\s+proration\s+shall\s+apply\b/i;
const AFFIRMATIVE_ELECTION_RE = /\b(?:shall\s+be\s+entitled\s+to\s+elect|may\s+elect\s+to\s+receive|right\s+to\s+elect|Election\s+Deadline|Form\s+of\s+Election)\b/i;

function hasNegativeElectionGuard(text) {
  return NEGATIVE_ELECTION_RE.test(text) && !AFFIRMATIVE_ELECTION_RE.test(text);
}

function findSpan(text, patterns, fallbackRe = ELECTION_SIGNAL_RE) {
  const list = Array.isArray(patterns) ? patterns : [patterns || fallbackRe];
  for (const re of list) {
    const m = re.exec(text);
    if (!m) continue;
    const start = Math.max(0, m.index);
    let end = text.indexOf('. ', m.index + m[0].length);
    if (end < 0 || end - start > 1800) end = Math.min(text.length, start + 1200);
    else end += 1;
    return { start, end, quote: text.slice(start, end) };
  }
  const end = Math.min(text.length, 1200);
  return { start: 0, end, quote: text.slice(0, end) };
}

function numberFromMoney(text) {
  const m = /\$\s*([0-9][0-9,]*(?:\.[0-9]+)?)/.exec(text);
  if (!m) return null;
  return Number(m[1].replace(/,/g, ''));
}

function decimalFromRatio(text) {
  const m = /\b([0-9]+(?:\.[0-9]+)?)\s+(?:shares?|Parent shares?|Buyer shares?)/i.exec(text);
  return m ? Number(m[1]) : null;
}

// --- Cap-avoiding money/ratio pickers (fallback path, no defined-term match)
// A naive "first $ / first N shares" pick is what produced the QXO bug class:
// a proration-cap clause ("subject to the Maximum Cash Election Number equal
// to forty-five percent (45%)...") sitting in the same broad optionSpan as
// the real per-share number. These pickers walk every candidate number in
// span order and skip any whose immediately preceding ~60 chars smell like a
// cap/aggregate/proration clause rather than the option's own economics.
const CAP_CONTEXT_RE = /maximum|aggregate|%|percent|\bcap\b|proration/i;

function pickMoneyAvoidingCaps(text) {
  const re = /\$\s*[0-9][0-9,]*(?:\.[0-9]+)?/g;
  let m;
  const candidates = [];
  while ((m = re.exec(text))) candidates.push(m);
  if (!candidates.length) return null;
  for (const c of candidates) {
    const before = text.slice(Math.max(0, c.index - 60), c.index);
    if (!CAP_CONTEXT_RE.test(before)) return Number(c[0].replace(/[$,]/g, ''));
  }
  return Number(candidates[0][0].replace(/[$,]/g, ''));
}

function pickRatioAvoidingCaps(text) {
  const re = /\b([0-9]+(?:\.[0-9]+)?)\s+(?:shares?|Parent shares?|Buyer shares?)/gi;
  let m;
  const candidates = [];
  while ((m = re.exec(text))) candidates.push(m);
  if (!candidates.length) return null;
  for (const c of candidates) {
    const before = text.slice(Math.max(0, c.index - 60), c.index);
    if (!CAP_CONTEXT_RE.test(before)) return Number(c[1]);
  }
  return Number(candidates[0][1]);
}

function percentCap(text) {
  const m = /\b([0-9]+(?:\.[0-9]+)?)\s*%/.exec(text);
  return m ? `${m[1]}%` : null;
}

function detectElectionSignals(regionFullText) {
  return ELECTION_SIGNAL_RE.test(String(regionFullText || ''));
}

// --- Defined-term economics resolver -----------------------------------
// ELECTION-REDO-SPEC-2026-07-16 step 1: "per-option fields must be populated
// from the option's OWN defined-term clause ('Cash Election Consideration
// means…'), not whatever clause the span matcher landed on." Real merger
// agreements almost always tie the per-share number to a parenthetical
// defined term -- "$505.00 (the "Cash Consideration")" / "$63.00 (the "Cash
// Election Consideration")" -- often FAR from where "Cash Election"/"Stock
// Election" are themselves defined (QXO defines "Cash Election" in the
// Election Procedures subsection, but the $505.00 lives two paragraphs
// earlier under "Merger Consideration"). Scanning the whole region for every
// dollar/share amount tied to a quoted defined term, then matching that term
// to the option by name, is what makes the fix generalize instead of just
// papering over QXO specifically.
const WORD_NUMBERS = { one: 1, two: 2, three: 3, four: 4, five: 5 };
const EXCLUDE_TERM_RE = /\b(?:Maximum|Aggregate|Proration|Fraction|Number|Cap)\b/i;

function scanMoneyTerms(text) {
  const re = /\$\s*([0-9][0-9,]*(?:\.[0-9]+)?)[\s\S]{0,160}?\(\s*(?:the|a|an)\s+["“]([^"”]{2,70})["”]/gi;
  const out = [];
  let m;
  while ((m = re.exec(text))) {
    out.push({ value: Number(m[1].replace(/,/g, '')), term: m[2].trim(), matchStart: m.index, matchEnd: m.index + m[0].length });
  }
  return out;
}

function scanShareTerms(text) {
  const re = /(?<![\d.$(])(?:([0-9]+(?:\.[0-9]+)?)(?!\))|\b(one|two|three|four|five)\b(?!\)))[^$]{0,120}?\b(?:Parent|Buyer|Acquiror|Acquirer)\s+(?:Common\s+Stock|Shares?|Units?)\b[^$]{0,160}?\(\s*(?:the|a|an)\s+["“]([^"”]{2,70})["”]/gi;
  const out = [];
  let m;
  while ((m = re.exec(text))) {
    const value = m[1] !== undefined ? Number(m[1]) : WORD_NUMBERS[String(m[2]).toLowerCase()];
    out.push({ value, term: m[3].trim(), matchStart: m.index, matchEnd: m.index + m[0].length });
  }
  return out;
}

function pickTermCandidate(candidates, optionType) {
  const usable = candidates.filter((c) => !EXCLUDE_TERM_RE.test(c.term));
  if (optionType === 'MIXED_ELECTION') {
    return usable.find((c) => /Mixed/i.test(c.term)) || null;
  }
  const keyword = optionType === 'CASH_ELECTION' ? /Cash/i : /Stock/i;
  const nonMixed = usable.filter((c) => !/Mixed/i.test(c.term) && keyword.test(c.term));
  if (!nonMixed.length) return null;
  // Prefer an "Election"-named term (directly tied to this option), else the
  // single unambiguous candidate.
  const electionHit = nonMixed.find((c) => /Election/i.test(c.term));
  if (electionHit) return electionHit;
  return nonMixed.length === 1 ? nonMixed[0] : null;
}

function definedTermEconomics(regionFullText, optionType, kind) {
  const candidates = kind === 'cash' ? scanMoneyTerms(regionFullText) : scanShareTerms(regionFullText);
  const hit = pickTermCandidate(candidates, optionType);
  if (!hit) return null;
  const { start, end } = sentenceWindow(regionFullText, hit.matchStart, hit.matchEnd);
  return {
    value: hit.value,
    sourceSpanStart: start,
    sourceSpanEnd: end,
    verbatimQuote: regionFullText.slice(start, end),
  };
}

// A ±window around a defined-term match, capped so run-on legalese
// paragraphs (frequently a single ". "-free sentence spanning 1000+ chars)
// don't produce an unreadable quote. Not required to land on a full
// grammatical sentence -- the invariant is exact-substring fidelity, not
// prose completeness.
function sentenceWindow(text, matchStart, matchEnd, pad = 200) {
  const start = Math.max(0, matchStart - pad);
  const end = Math.min(text.length, matchEnd + pad);
  return { start, end };
}

// --- Option label: sourced from the agreement's own defined term ---------
// ELECTION-REDO-SPEC-2026-07-16 step 1: option_label must be the agreement's
// own defined term ("Cash Election", "Stock Election"), not a hardcoded
// constant. Real drafting introduces the term as `(a "Cash Election")` /
// `(the "Cash Election")`; among every quoted defined term matching the
// option's keyword, the SHORTEST one wins ("Cash Election" over "Maximum
// Cash Election Number" or "Cash Election Consideration", both of which also
// contain the keyword substring but name a different concept).
const LABEL_KEYWORD_RE = {
  CASH_ELECTION: /Cash\s+Election/i,
  STOCK_ELECTION: /Stock\s+Election/i,
  MIXED_ELECTION: /Mixed\s+Election/i,
  CVR_INCLUDED: /with\s+CVR|CVR\s+Included/i,
  CVR_EXCLUDED: /without\s+CVR|CVR\s+Excluded/i,
};

function deriveOptionLabel(regionFullText, optionType) {
  const keywordRe = LABEL_KEYWORD_RE[optionType];
  if (!keywordRe) return null;
  const re = /\(\s*(?:the|a|an)\s+["“]([^"”]{2,60})["”]\s*\)/g;
  let m;
  let best = null;
  while ((m = re.exec(regionFullText))) {
    const label = m[1].trim();
    if (!keywordRe.test(label)) continue;
    if (!best || label.length < best.length) best = label;
  }
  return best;
}

function optionSpan(text, type) {
  if (type === 'CASH_ELECTION') return findSpan(text, [/Cash Election[\s\S]{0,900}?(?:Stock Election|Mixed Election|$)/i, /Maximum Cash Election[\s\S]{0,900}?(?:Maximum Stock Election|$)/i]);
  if (type === 'STOCK_ELECTION') return findSpan(text, [/Stock Election[\s\S]{0,900}?(?:Cash Election|Mixed Election|$)/i, /Maximum Stock Election[\s\S]{0,900}?$/i]);
  if (type === 'MIXED_ELECTION') return findSpan(text, [/Mixed Election[\s\S]{0,900}?(?:Cash Election|Stock Election|$)/i]);
  if (type === 'CVR_INCLUDED') return findSpan(text, [/(?:with|including)\s+(?:a\s+)?CVR[\s\S]{0,700}/i, /CVR Included[\s\S]{0,700}/i]);
  if (type === 'CVR_EXCLUDED') return findSpan(text, [/(?:without|excluding)\s+(?:a\s+)?CVR[\s\S]{0,700}/i, /CVR Excluded[\s\S]{0,700}/i]);
  return findSpan(text, ELECTION_SIGNAL_RE);
}

function aggregateCap(type, quote) {
  const pct = percentCap(quote);
  const money = numberFromMoney(quote);
  const capTypeForPercent = /consideration/i.test(quote) ? 'PERCENTAGE_OF_CONSIDERATION' : 'PERCENTAGE_OF_SHARES';
  if (/maximum\s+cash|aggregate\s+cash|cash\s+pool/i.test(quote)) {
    if (money !== null) return { aggregateCapType: 'FIXED_DOLLAR_AMOUNT', aggregateCapValue: `$${money}`, aggregateCapFormula: quote };
    return { aggregateCapType: pct ? capTypeForPercent : 'OTHER', aggregateCapValue: pct || 'Cash cap described in source', aggregateCapFormula: quote };
  }
  if (/maximum\s+stock|aggregate\s+stock|stock\s+pool/i.test(quote)) {
    return { aggregateCapType: pct ? capTypeForPercent : 'OTHER', aggregateCapValue: pct || 'Stock cap described in source', aggregateCapFormula: quote };
  }
  return { aggregateCapType: 'NO_CAP', aggregateCapValue: 'No cap', aggregateCapFormula: null };
}

function buildOption(regionFullText, optionType, displayOrder) {
  const span = optionSpan(regionFullText, optionType);
  const cap = aggregateCap(optionType, span.quote);
  const isCash = optionType === 'CASH_ELECTION' || optionType === 'MIXED_ELECTION';
  const isStock = optionType === 'STOCK_ELECTION' || optionType === 'MIXED_ELECTION';
  const labels = {
    CASH_ELECTION: 'Cash Election',
    STOCK_ELECTION: 'Stock Election',
    MIXED_ELECTION: 'Mixed Election',
    CVR_INCLUDED: 'With CVR',
    CVR_EXCLUDED: 'Without CVR',
  };

  // Defined-term economics take priority over the broad span-based guess;
  // span-based cap-avoiding extraction is the fallback for documents that
  // don't use the "$X (the "Term")" drafting convention (e.g. the synthetic
  // fixtures in tests/schema/elections).
  const cashHit = isCash ? definedTermEconomics(regionFullText, optionType, 'cash') : null;
  const stockHit = isStock ? definedTermEconomics(regionFullText, optionType, 'stock') : null;

  let cashPerShare = null;
  let cashPerShareFormula = null;
  if (isCash) {
    if (cashHit) {
      cashPerShare = cashHit.value;
    } else if (optionType === 'CASH_ELECTION') {
      cashPerShare = pickMoneyAvoidingCaps(span.quote);
      if (cashPerShare === null) cashPerShareFormula = span.quote;
    }
  }
  let stockPerShare = null;
  let stockPerShareFormula = null;
  if (isStock) {
    if (stockHit) {
      stockPerShare = stockHit.value;
    } else if (optionType === 'STOCK_ELECTION') {
      stockPerShare = pickRatioAvoidingCaps(span.quote);
      if (stockPerShare === null) stockPerShareFormula = span.quote;
    }
  }

  // Prefer the tight defined-term quote/span (whichever resolved) as the
  // option's own source span; fall back to the broad optionSpan when neither
  // resolved via defined terms.
  const primaryHit = cashHit || stockHit;
  const sourceSpanStart = primaryHit ? primaryHit.sourceSpanStart : span.start;
  const sourceSpanEnd = primaryHit ? primaryHit.sourceSpanEnd : span.end;
  const verbatimQuote = primaryHit ? primaryHit.verbatimQuote : span.quote;

  return {
    optionLabel: deriveOptionLabel(regionFullText, optionType) || labels[optionType] || 'Election Option',
    optionType,
    cashPerShare,
    cashPerShareFormula,
    stockPerShare,
    stockPerShareFormula,
    cvrIncluded: optionType === 'CVR_INCLUDED' ? true : (optionType === 'CVR_EXCLUDED' ? false : null),
    cvrNote: /cvr|contingent value right/i.test(span.quote) ? span.quote : null,
    aggregateCapType: cap.aggregateCapType,
    aggregateCapValue: cap.aggregateCapValue,
    aggregateCapFormula: cap.aggregateCapFormula,
    sourceSpanStart,
    sourceSpanEnd,
    verbatimQuote,
    displayOrder,
  };
}

// Symmetric window search: finds the nearest "Non-Election Shares"/"No
// Election Shares" anchor and, for each, looks in a window on BOTH sides
// (order-independent — the treatment clause can precede or follow the
// anchor, e.g. QXO says "...deemed to be...Stock Elections have been made
// (such Company Shares, the "No Election Shares")" -- Stock Election
// appears BEFORE the anchor) for the nearest Cash/Stock Election mention.
function defaultTreatment(regionFullText) {
  const anchorRe = /(?:Non[-\s]?Election|No\s+Election)\s+Shares?/gi;
  let m;
  while ((m = anchorRe.exec(regionFullText))) {
    const windowStart = Math.max(0, m.index - 250);
    const windowEnd = Math.min(regionFullText.length, m.index + m[0].length + 250);
    const window = regionFullText.slice(windowStart, windowEnd);
    const anchorIndexInWindow = m.index - windowStart;
    const stockDist = nearestDistance(window, /Stock\s+Election|stock\s+consideration/gi, anchorIndexInWindow);
    const cashDist = nearestDistance(window, /Cash\s+Election|cash\s+consideration/gi, anchorIndexInWindow);
    const mixedDist = nearestDistance(window, /Mixed\s+Election|mixed\s+consideration/gi, anchorIndexInWindow);
    const best = Math.min(stockDist, cashDist, mixedDist);
    if (best === Infinity) continue;
    if (best === mixedDist) return 'NON_ELECTING_GETS_MIXED';
    if (best === stockDist) return 'NON_ELECTING_TREATED_AS_STOCK_ELECTION';
    return 'NON_ELECTING_TREATED_AS_CASH_ELECTION';
  }
  if (/non[-\s]?electing.{0,160}mixed/i.test(regionFullText)) return 'NON_ELECTING_GETS_MIXED';
  if (/non[-\s]?electing.{0,160}stock/i.test(regionFullText)) return 'NON_ELECTING_GETS_STOCK';
  if (/non[-\s]?electing.{0,160}cash/i.test(regionFullText)) return 'NON_ELECTING_GETS_CASH';
  return 'OTHER';
}

function nearestDistance(text, re, anchorIndex) {
  let min = Infinity;
  let m;
  while ((m = re.exec(text))) {
    const d = Math.abs(m.index - anchorIndex);
    if (d < min) min = d;
  }
  return min;
}

function deadline(regionFullText) {
  const span = findSpan(regionFullText, [/Election Deadline[\s\S]{0,500}/i, /deadline[\s\S]{0,500}(?:Election|Form of Election)/i]);
  if (!/deadline|Election Deadline/i.test(span.quote)) return { electionDeadlineRef: null, electionDeadlineQuote: null };
  const ref = /Section\s+[0-9]+(?:\.[0-9]+)*/i.exec(span.quote);
  return {
    electionDeadlineRef: ref ? ref[0] : null,
    electionDeadlineQuote: span.quote,
  };
}

function prorationRule(regionFullText) {
  if (!/\bproration|pro\s+rata|oversubscribed|oversubscription/i.test(regionFullText)) return null;
  const span = findSpan(regionFullText, [/proration[\s\S]{0,1400}/i, /oversubscrib[\s\S]{0,1400}/i, /pro\s+rata[\s\S]{0,1400}/i]);
  const cash = /cash/i.test(span.quote);
  const stock = /stock/i.test(span.quote);
  return {
    prorationTrigger: cash && stock ? 'OVERSUBSCRIBED_EITHER' : (cash ? 'OVERSUBSCRIBED_CASH' : (stock ? 'OVERSUBSCRIBED_STOCK' : 'ALWAYS')),
    prorationMethod: /pro\s+rata|prorat/i.test(span.quote) ? 'PRO_RATA_REDUCTION' : 'OTHER',
    capDefinitions: {
      ...(cash ? { cash_pool: 'Cash cap described in source quote' } : {}),
      ...(stock ? { stock_pool: 'Stock cap described in source quote' } : {}),
    },
    nonElectingTreatment: /non[-\s]?elect/i.test(span.quote) ? 'GET_DEFAULT_TREATMENT' : 'OTHER',
    sourceSpanStart: span.start,
    sourceSpanEnd: span.end,
    verbatimQuote: span.quote,
    prorationWalkthrough: prorationWalkthrough(span.quote),
  };
}

function prorationWalkthrough(quote) {
  if (/cash/i.test(quote) && /stock/i.test(quote) && /pro\s+rata|prorat/i.test(quote)) {
    return 'If an election side is oversubscribed, the oversubscribed choice is reduced pro rata and the balance is reallocated under the source proration mechanic.';
  }
  return 'Proration applies as described in the source proration quote.';
}

function buildElectionMechanism(extracted) {
  const regionFullText = String(extracted && extracted.regionFullText || '');
  if (!detectElectionSignals(regionFullText)) return null;
  if (hasNegativeElectionGuard(regionFullText)) return null;
  const hasCash = /Cash Election|Maximum Cash Election|cash consideration/i.test(regionFullText);
  const hasStock = /Stock Election|Maximum Stock Election|stock consideration/i.test(regionFullText);
  const hasMixed = /Mixed Election/i.test(regionFullText);
  const hasCvr = /CVR|Contingent Value Right/i.test(regionFullText);
  const options = [];
  if (hasCvr && /with(?:out)?\s+(?:a\s+)?CVR|CVR Included|CVR Excluded/i.test(regionFullText)) {
    options.push(buildOption(regionFullText, 'CVR_INCLUDED', 1));
    options.push(buildOption(regionFullText, 'CVR_EXCLUDED', 2));
  } else {
    if (hasCash) options.push(buildOption(regionFullText, 'CASH_ELECTION', options.length + 1));
    if (hasStock) options.push(buildOption(regionFullText, 'STOCK_ELECTION', options.length + 1));
    if (hasMixed) options.push(buildOption(regionFullText, 'MIXED_ELECTION', options.length + 1));
  }
  if (options.length < 2) return null;
  const source = findSpan(regionFullText, ELECTION_SIGNAL_RE);
  const proration = prorationRule(regionFullText);
  const deadlineInfo = deadline(regionFullText);
  return {
    electionType: hasCvr && options.some((o) => o.optionType === 'CVR_INCLUDED')
      ? 'CVR_INCLUSION'
      : (hasCash && hasStock && hasMixed ? 'CASH_OR_STOCK_OR_MIXED' : (hasCash && hasStock ? 'CASH_OR_STOCK' : 'OTHER')),
    isProrated: Boolean(proration),
    defaultTreatment: defaultTreatment(regionFullText),
    electionDeadlineRef: deadlineInfo.electionDeadlineRef,
    electionDeadlineQuote: deadlineInfo.electionDeadlineQuote,
    prorationRule: proration,
    sourceSpanStart: source.start,
    sourceSpanEnd: source.end,
    verbatimQuote: source.quote,
    extractedBy: 'CODEX',
    options,
  };
}

function enforceElectionInvariants(election, regionFullText) {
  if (!election) return;
  if (!Array.isArray(election.options) || election.options.length < 2) {
    throw new Error('election invariant failed: at least two options required');
  }
  if (Boolean(election.isProrated) !== Boolean(election.prorationRule)) {
    throw new Error('election invariant failed: proration flag and proration rule mismatch');
  }
  const orders = election.options.map((o) => Number(o.displayOrder)).sort((a, b) => a - b);
  orders.forEach((order, idx) => {
    if (order !== idx + 1) throw new Error('election invariant failed: display_order values must be 1..N with no gaps');
  });
  const rows = [election, election.prorationRule, ...election.options].filter(Boolean);
  for (const row of rows) {
    const quote = regionFullText.slice(row.sourceSpanStart, row.sourceSpanEnd);
    if (quote !== row.verbatimQuote) throw new Error('election invariant failed: quote fidelity violation');
  }
  if (election.electionType === 'CASH_OR_STOCK') {
    const cashOptions = election.options.filter((o) => o.cashPerShare !== null || o.cashPerShareFormula);
    const stockOptions = election.options.filter((o) => o.stockPerShare !== null || o.stockPerShareFormula);
    if (cashOptions.length !== 1 || stockOptions.length !== 1) {
      throw new Error('election invariant failed: CASH_OR_STOCK requires one cash option and one stock option');
    }
  }
}

// --- appliesTo attribution -------------------------------------------------
// ELECTION-REDO-SPEC-2026-07-16 step 1: "each extracted consideration
// feature (perShareCash, exchangeRatio, …) gets an optional electionOption
// tag." The CONSID headline card carries its own LLM-extracted feature
// values (perShareAmount, cashAmount, offerPrice, exchangeRatio,
// exchangeRatioText) independent of this module's own span-derived option
// economics; this function is the deterministic bridge between the two --
// given an election mechanism's resolved options and a bag of those feature
// values, it numerically matches each value against the option whose own
// cashPerShare/stockPerShare it equals, tagging it with that option's
// optionType (CASH_ELECTION / STOCK_ELECTION / MIXED_ELECTION). Ambiguous or
// unmatched keys are simply omitted -- this never guesses.
const CASH_FEATURE_KEYS = ['perShareAmount', 'cashAmount', 'offerPrice'];
const STOCK_FEATURE_KEYS = ['exchangeRatio', 'exchangeRatioText'];
const NUMERIC_TOLERANCE = 0.005;

function numericFromFeatureValue(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  const inner = typeof raw === 'object' ? (raw.value ?? raw.text ?? raw.label ?? null) : raw;
  if (inner === null || inner === undefined || inner === '') return null;
  const digits = String(inner).replace(/[^0-9.\-]/g, '');
  if (!digits) return null;
  const n = Number.parseFloat(digits);
  return Number.isFinite(n) ? n : null;
}

function matchOptionByValue(options, value, field, tolerance) {
  const numeric = options.filter((o) => typeof o[field] === 'number');
  if (value === null) return null;
  return numeric.find((o) => Math.abs(o[field] - value) <= tolerance) || null;
}

function attributeConsiderationFeatures(mechanism, features) {
  const out = {};
  if (!mechanism || !Array.isArray(mechanism.options) || !features) return out;
  const options = mechanism.options;
  for (const key of CASH_FEATURE_KEYS) {
    if (!(key in features)) continue;
    const value = numericFromFeatureValue(features[key]);
    const match = matchOptionByValue(options, value, 'cashPerShare', NUMERIC_TOLERANCE);
    if (match) out[key] = match.optionType;
  }
  for (const key of STOCK_FEATURE_KEYS) {
    if (!(key in features)) continue;
    const value = numericFromFeatureValue(features[key]);
    const match = matchOptionByValue(options, value, 'stockPerShare', NUMERIC_TOLERANCE);
    if (match) out[key] = match.optionType;
  }
  return out;
}

module.exports = {
  buildElectionMechanism,
  detectElectionSignals,
  enforceElectionInvariants,
  hasNegativeElectionGuard,
  deriveOptionLabel,
  attributeConsiderationFeatures,
};
