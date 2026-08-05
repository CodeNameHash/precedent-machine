# WP04 Phase 2: Commitments 5.01(ii) roman suffix

Base resolved at phase start: `origin/main` after PR #93 and PR #95 were merged.

## Root Cause

PR #92 identified the unfixed issue: `lib/parser-v2/extract.js` flattened IOC nested roman sub-clauses, so a provision like `5.01(b)(ii)` lost its lettered parent before `features.sectionNumber` was stamped. The prior splitter also only caught inline markers after periods, not the common IOC drafting pattern `: (i) ...; (ii) ...`.

That meant substantive roman limbs under an alpha covenant were either not split or were treated as top-level roman markers, while true internal numbering like `(x)` / `(y)` date alternatives still needed to stay unsplit.

## Fix

- `lib/parser-v2/extract.js:2251` detects IOC splitting separately from COND/TERMR roman skipping.
- `lib/parser-v2/extract.js:2273` lets IOC inline markers appear after `.`, `;`, or `:`, so `shall not: (i) ...; (ii) ...` is visible to the splitter.
- `lib/parser-v2/extract.js:2285` tracks the current alpha parent and emits nested substantive roman limbs as `b.i`, `b.ii`, etc.
- `lib/parser-v2/extract.js:2387` formats dotted sub-clause ids as nested section numbers, e.g. `5.01(b)(ii)`.

Before: `5.01(b)(ii)` could collapse to `5.01` or disappear from the classified IOC rows.

After: substantive nested IOC roman limbs survive with parent suffixes, while non-substantive internal romans remain unsplit.

## Tests

Added `tests/commitments-roman-suffix-extraction.test.js`.

Coverage:
- `5.01(b)(ii)` shape survives and includes the capital contribution / investment text.
- Internal `(x)` / `(y)` date alternatives remain unsplit.
- Buyer-side `6.01(a)(i)` and `6.01(a)(ii)` nested roman limbs survive.

## Verify

Targeted:

```text
node --test tests/commitments-roman-suffix-extraction.test.js
tests 3
pass 3
fail 0
```

Full suite:

```text
npm test
tests 670
pass 670
fail 0
```

Dry-run only, no writes:

```text
node scripts/reprocess.js --deal Skechers --types IOC
Reprocess (types: IOC) - 1 deal(s), dry-run
Beach Acquisition Co Parent, LLC / Skechers U.S.A., Inc.
  plan: re-extract IOC from 2 cached section(s) - no parse, no classify
Dry-run complete: no writes, no LLM calls.
```

## Expected Data Change After Merge

No live data was changed in this phase. After merge, a controlled IOC reprocess for affected deals should insert the previously missing nested Commitments limb with `features.sectionNumber = 5.01(b)(ii)` or the analogous buyer-side section number.
