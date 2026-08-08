# Step 3C. Specific Performance and Remedies drop -- fixed

Owner: this session. Files touched: `lib/canonical-v2/native-producer/anthropic-provider.js`
(`isIncompleteSpecificPerformanceGrant`, lines ~1188-1211) and
`tests/canonical-v2-mae-specific-performance-replay.test.js` (two new tests).
No other file was edited.

## What was wrong

`isIncompleteSpecificPerformanceGrant` decides whether a well-formed
`SPECIFIC_PERFORMANCE` grant should be reshaped into a claim or dropped as an
`SPECIFIC_PERFORMANCE_OPERATIVE_PREMISE_UNVERIFIED` evidence residual. Its
third condition tested whether the **quote itself** already stated the
operative premise (irreparable harm + money damages not an adequate remedy),
using two literal, contiguous phrases:

```js
return !(/\birreparable harm would occur\b/i.test(assertion.quote)
  && /\bmoney damages would not be an adequate remedy\b/i.test(assertion.quote));
```

Twelve lines above, `sourceHasSpecificPerformanceOperativePremise` tests the
*same premise* against the source text with a tolerant pattern: `harm|damage`,
`money|monetary`, and up to 180 characters between "damages" and "not be an
adequate remedy". Two predicates for one premise, at two strictnesses.

Modiv Section 8.8's real, model-extracted grant states the premise as:

> "The parties hereto agree that **irreparable harm**, for which **monetary
> damages** (even if available) **would not be an adequate remedy**, would
> occur in the event that..."

This satisfies the tolerant source-side test but fails the strict quote-side
test twice over: the clause "for which monetary damages ... would not be an
adequate remedy" sits between "irreparable harm" and "would occur", breaking
the required contiguous match, and the drafter wrote "monetary" where the
regex demanded "money". The result, measured before any change, on the
committed replay:

```
evidence/canonical-v2/modiv-specific-performance-20260807-replay/run-receipt.json
  producer_receipt.proposal_count: 0
  evidence_residual_count: 1
  evidence_residuals[0].reason: SPECIFIC_PERFORMANCE_OPERATIVE_PREMISE_UNVERIFIED
```

Zero resolved, zero queued, zero open-world for the whole family on Modiv --
a correct extraction, discarded by wording mismatch alone.

## The fix

Made the quote-side check call the exact same tolerant predicate used on the
source text, rather than maintaining a second, stricter regex pair for the
identical premise:

```js
function isIncompleteSpecificPerformanceGrant(assertion, sourceText) {
  if (!assertion || assertion.assertion_kind !== 'SPECIFIC_PERFORMANCE' || typeof assertion.quote !== 'string') return false;
  const operativeGrant = /\bshall be entitled to\b[\s\S]{0,160}\b(?:injunction|specific performance|equitable relief)\b/i.test(assertion.quote);
  if (!operativeGrant) return false;
  if (!sourceHasSpecificPerformanceOperativePremise(sourceText)) return false;
  return !sourceHasSpecificPerformanceOperativePremise(assertion.quote);
}
```

The `operativeGrant` gate and the `sourceHasSpecificPerformanceOperativePremise(sourceText)`
gate are unchanged -- only the final, quote-side wording check was loosened,
and only to match the tolerance the source-side check already had. The
function's header comment was rewritten in the same change to describe the
current behaviour and to stop pointing at the (now nonexistent) two-regex
strict check.

Scope note: this only affects assertions tagged `SPECIFIC_PERFORMANCE` whose
quote already contains the operative grant language (`shall be entitled to
... injunction/specific performance/equitable relief`). It does not touch
assertions that lack that grant language at all -- those already bypassed
this predicate before and after the change (`if (!operativeGrant) return
false;`), which is unrelated to this step and was not reopened.

## Before / after (replayed against the committed Modiv run)

Replayed via `scripts/canonical-v2-live-extraction-run.mjs --deal modiv
--family SPECIFIC_PERFORMANCE_REMEDIES --section-refs 8.8 --replay-from-run
evidence/canonical-v2/modiv-specific-performance-20260806 --out-dir <scratch>`,
i.e. the exact model response recorded in
`evidence/canonical-v2/modiv-specific-performance-20260806/native-producer-recorded-response-8.8.json`
replayed through the (before / after) provider code.

| | compiled_candidates | evidence_residuals | resolution.resolved | resolution.review_queue |
|---|---|---|---|---|
| Before (baseline, matches committed `modiv-specific-performance-20260807-replay`) | 0 | 1 (`SPECIFIC_PERFORMANCE_OPERATIVE_PREMISE_UNVERIFIED`) | 0 | 0 |
| After | 1 | 0 | 1 | 1 (queued for review, not auto-passed -- expected: no comparator/lexical-net/scope-certification signal yet, unrelated to this fix) |

The single resolved claim is `SPECIFIC_PERFORMANCE_REMEDY_PRESENT` /
`assertion_kind: SPECIFIC_PERFORMANCE`, `raw_value` equal to the full
model-recorded quote, evidence anchored at Modiv's Section 8.8 byte range
(354191-357489). At least one candidate now reaches the resolver, which is
the acceptance bar for this step.

I did not overwrite the committed `evidence/canonical-v2/modiv-specific-performance-20260807-replay/`
directory (that is the "before" record this step measured against and
diagnosed from) -- the "after" replay was written to a scratch directory
outside the repo and is not committed. The committed replay directory still
correctly shows the pre-fix zero/zero/zero baseline; regenerating it (if
wanted) is a follow-up for whoever owns evidence capture, not part of this
diff.

## Hostile test

Lives in `tests/canonical-v2-mae-specific-performance-replay.test.js`, two
new tests immediately before the existing
`'a source-exact specific-performance grant resolves when its governed
source has no operative premise'` test:

1. **`'Modiv 8.8(a) resolves once the quote-side premise check is as
   tolerant as the source-side one'`** -- positive case. Loads Modiv Section
   8.8's real text (byte-sliced from the committed
   `tests/fixtures/canonical-v2/mae-definition-family/modiv-raw-fetched.htm`
   via `findSectionByReference` / `diagnosticAdmittedSource`, the same
   helpers the rest of the file already uses), extracts the real recorded
   grant quote with `exact()`, and asserts `shapeSpecificPerformanceRemedyProposals`
   now returns 1 proposal and 0 residuals.

2. **`'HOSTILE: Modiv 8.8(a) bare "acknowledge and agree ... shall be
   entitled" clause is still excluded without the premise in the quote'`**
   -- the gate. Real filed text, quoted from the *second* sentence of the
   same Modiv 8.8(a) paragraph onward: "Accordingly, the parties acknowledge
   and agree that the parties hereto shall be entitled to an injunction,
   specific performance or other equitable relief ... in addition to any
   other remedy to which such party is entitled at Law or in equity." This
   quote carries the operative grant language and even the word
   "acknowledge", but omits the first sentence's irreparable-harm /
   inadequate-remedy premise entirely -- a non-operative acknowledgement of
   entitlement, not a genuine premised grant. Asserts
   `shapeSpecificPerformanceRemedyProposals` still returns 0 proposals and 1
   residual with reason `SPECIFIC_PERFORMANCE_OPERATIVE_PREMISE_UNVERIFIED`.
   Not synthetic prose -- both quotes are exact substrings of the same real
   SEC-filed section this step's fix targets, split at the real sentence
   boundary between premise and grant.

The pre-existing test in the same file, `'TopBuild 7.6 rejects a bare
equitable-relief grant and retains the operative premise'` (real TopBuild
filed text, a different deal/document), exercises the identical class of
case -- operative grant present, quote's premise wording totally absent --
and continues to pass unchanged, giving a second, independent real-filing
confirmation that the loosening did not turn the premise check into a
rubber stamp.

## Targeted test runs (exit codes)

```
CI=true node --test tests/canonical-v2-mae-specific-performance-replay.test.js
  -> EXIT=0 (6/6 pass: MAE 8.12(g) replay, TopBuild bare-grant guard, TopBuild
     publish/open-world split, the two new Modiv tests above, and the
     source-exact synthetic-source regression test)

CI=true node --test tests/canonical-v2-specific-performance-remedies-prompt-adapter.test.js \
  tests/canonical-v2-follow-on-family-prompt-contract.test.js \
  tests/canonical-v2-m3-representations-merger-remedies-resolution.test.js
  -> EXIT=0 (12/12 pass)

CI=true node --test tests/canonical-v2-native-provider.test.js \
  tests/canonical-v2-native-family-adapter-contract.test.js \
  tests/canonical-v2-native-provider-family-dispatch.test.js
  -> EXIT=0 (37/37 pass)
```

These are every test file that references `isIncompleteSpecificPerformanceGrant`,
`sourceHasSpecificPerformanceOperativePremise`, or
`shapeSpecificPerformanceRemedyProposals` directly (found via `grep -rln` across
`lib/ tests/ scripts/`), plus the general provider/family-dispatch contract
suites as a broader sanity check on the shared file. Did not run the full
`npm test` (out of scope for this step; other agents are editing other files
in this checkout concurrently).

## Not done, deliberately

- Did not touch `candidate-resolution.js` (owned by another agent).
- Did not reopen the quote-boundary approach the step's first diagnosis
  proposed and later withdrew.
- Did not regenerate/overwrite the committed
  `evidence/canonical-v2/modiv-specific-performance-20260807-replay/` run
  directory -- it remains the pre-fix baseline record this step measured
  from.
