/* ─────────────────────────────────────────────────────────────────────────
   lib/termf.js — Termination-Fee (TERMF) feature normalizer.
   ───────────────────────────────────────────────────────────────────────────
   The TERMF extractor stores RICH NESTED feature objects per provision:

     TERMF-TARGET  → companyTerminationFee: { amount, percentage_of_equity,
                                              triggers: [<plain strings with
                                              "Section 7.1(g)" refs>],
                                              payment_deadline }
                     interestOnLatePayment: { rate, base }
                     nakedNoVoteFee: <bool>
     TERMF-TAIL    → tailProvision: { period_months, threshold_percentage,
                                      triggers: [strings] }
     TERMF-SOLE    → soleAndExclusiveRemedy: <bool | {value,text,quotes}>
                     willfulBreachException: <bool | {value,text,quotes}>
     TERMF-EFFECT  → effectOfTermination: <text>, willfulBreachException
     TERMF-EXPENSE → expenseReimbursement: { amount_cap, triggers }

   The review-page renderer (TermfHero / TermfTriggerMatrix / TermfTailMechanics)
   and the cross-deal Compare view (CATEGORY_SUMMARY_FEATURES.TERMF) both read
   FLAT keys (feeAmount, feePercentage, tailFeeWindowMonths, a top-level
   triggers[] of {name, terminationClauses, feeAmount, feeAmountPct},
   tailFeeActivatingClauses, …). None of those exist in the stored data, so the
   fee hero rendered "[object Object]" and the trigger matrix showed everything
   "Not present".

   normalizeTermfFeatures bridges the gap: it returns a NEW features object that
   keeps the nested shapes intact and ADDS the flat keys the UI consumes. It is
   ADDITIVE — a derived flat key is only written when the flat key is currently
   empty, so any genuinely-extracted flat value wins. Pure / framework-free so
   both pages/review/[id].js and pages/compare.js can use it.
   ───────────────────────────────────────────────────────────────────────── */

// "Section 7.1(g)" / "Section 8.02(a)(i)" style references.
const SECTION_REF_RE = /Section\s+\d+\.\d+(?:\([A-Za-z0-9]+\))*/g;

function isEmpty(v) {
  return (
    v === undefined ||
    v === null ||
    v === '' ||
    (Array.isArray(v) && v.length === 0)
  );
}

// Unwrap a value that may be a bare boolean, a citable wrapper
// ({ value, text, quotes }) or a bare { text } object into { bool, text }.
function unwrapBoolish(v) {
  if (v === undefined || v === null) return { bool: null, text: null };
  if (typeof v === 'boolean') return { bool: v, text: null };
  if (typeof v === 'string') return { bool: true, text: v };
  if (typeof v === 'object') {
    const bool = 'value' in v ? !!v.value : true; // a bare {text} implies "present"
    let text = typeof v.text === 'string' ? v.text : null;
    if (!text && Array.isArray(v.quotes)) {
      const q = v.quotes.find((x) => typeof x === 'string' && x.trim());
      if (q) text = q.trim();
    }
    return { bool, text };
  }
  return { bool: null, text: null };
}

// Derive a concise, readable trigger name. Most trigger strings read
// "Termination ... pursuant to Section 7.1(g) (Termination for Superior
// Proposal) ..." — the parenthetical immediately after the section ref is the
// canonical short label. Fall back to the ref-stripped string (truncated).
function deriveTriggerName(s, refs) {
  const labelMatch = s.match(
    /Section\s+\d+\.\d+(?:\([A-Za-z0-9]+\))*\s*\(([^)]{3,80})\)/,
  );
  if (labelMatch) return labelMatch[1].trim();
  let name = s;
  for (const r of refs) name = name.split(r).join(' ');
  name = name
    .replace(/\(\s*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s,;:.–-]+|[\s,;:.–-]+$/g, '')
    .trim();
  if (!name) name = s.trim();
  return name.length > 90 ? `${name.slice(0, 89)}…` : name;
}

// Parse the per-fee `triggers` array (plain strings) into the matrix-friendly
// shape { name, terminationClauses, feeAmount, feeAmountPct }.
function parseTriggerStrings(arr) {
  if (!Array.isArray(arr)) return [];
  const out = [];
  for (const s of arr) {
    if (typeof s !== 'string' || !s.trim()) continue;
    const refs = Array.from(new Set(s.match(SECTION_REF_RE) || []));
    out.push({
      name: deriveTriggerName(s, refs),
      terminationClauses: refs,
      feeAmount: null,
      feeAmountPct: null,
      sourceText: s.trim(),
    });
  }
  return out;
}

function normalizeTermfFeatures(features) {
  if (!features || typeof features !== 'object' || Array.isArray(features)) {
    return features || {};
  }
  const out = { ...features };
  const set = (key, val) => {
    if (isEmpty(out[key]) && !isEmpty(val)) out[key] = val;
  };

  // ── Company termination fee (TERMF-TARGET) ──
  const ctf = features.companyTerminationFee;
  if (ctf && typeof ctf === 'object') {
    set('feeAmount', ctf.amount);
    set('feePercentage', ctf.percentage_of_equity);
    set('terminationFeePercentEquityValue', ctf.percentage_of_equity);
    set('paymentDeadline', ctf.payment_deadline);
    if (Array.isArray(ctf.triggers) && ctf.triggers.length) {
      set('triggers', parseTriggerStrings(ctf.triggers));
      set('triggerEvents', ctf.triggers.filter((t) => typeof t === 'string'));
    }
  }

  // ── Reverse termination fee (TERMF-REVERSE) ──
  const rtf = features.reverseTerminationFee;
  if (rtf && typeof rtf === 'object') {
    set('reverseFeeAmount', rtf.amount);
    set('reverseFeePercentage', rtf.percentage_of_equity);
  }

  // ── Tail provision (TERMF-TAIL) ──
  const tail = features.tailProvision;
  if (tail && typeof tail === 'object') {
    set('tailFeeWindowMonths', tail.period_months);
    set('tailPeriod', tail.period_months);
    set('tailFeeThresholdPct', tail.threshold_percentage);
    if (Array.isArray(tail.triggers) && tail.triggers.length) {
      set('tailFeeActivatingClauses', tail.triggers.filter((t) => typeof t === 'string'));
    }
  }

  // ── Expense reimbursement (TERMF-EXPENSE) ──
  const exp = features.expenseReimbursement;
  if (exp && typeof exp === 'object') {
    set('expenseReimbursementCap', exp.amount_cap);
  }

  // ── Sole & exclusive remedy (TERMF-SOLE) ──
  const sole = unwrapBoolish(features.soleAndExclusiveRemedy);
  if (sole.bool !== null) {
    set('feeSoleAndExclusiveRemedy', sole.bool);
    set('soleRemedy', sole.bool);
  }

  // ── Willful-breach / fraud exception (TERMF-SOLE / TERMF-EFFECT) ──
  const wbe = unwrapBoolish(features.willfulBreachException);
  if (wbe.text) {
    const existing = Array.isArray(out.feeSoleRemedyExceptions)
      ? out.feeSoleRemedyExceptions
      : [];
    if (!existing.includes(wbe.text)) {
      set('feeSoleRemedyExceptions', [...existing, wbe.text]);
    }
  }

  // ── Naked no-vote fee (TERMF-TARGET) ──
  if (typeof features.nakedNoVoteFee === 'boolean') {
    set('nakedNoVoteFeePresent', features.nakedNoVoteFee);
  }

  return out;
}

export { normalizeTermfFeatures, parseTriggerStrings };
