# Step 2X-G: open-world promotion loop

Branch `cursor/step-2x-free-phase-b641`. Closed 2026-08-08 for the gate + first
landed promotion. Further promotions reuse the same gate; they are not
auto-applied from a PASS scan row.

## Ruling (DECISIONS.md §14)

Promote when a shape appears in **three or four deals**, with confidence and a
fail-closed collision check — **not a percentage**. At seven deals one
recurrence is 14%; a fraction is the wrong instrument.

## What landed

| Piece | Path |
|---|---|
| Gate | `lib/canonical-v2/open-world-promotion-gate.js` |
| Discoverability | re-exported from `lib/expected-sets.js` (fractions stay for expected-set importance only) |
| Corpus scan | `scripts/audit/step-2x-g-open-world-promotion-scan.js` |
| Tests | `tests/canonical-v2-open-world-promotion-gate.test.js` (7/7) |
| First promotion | `REQUEST_RETURN_OR_DESTRUCTION_OF_INFORMATION` ungated in `candidate-resolution.js` |

Gate refuses:

- fewer than 3 deals (even at 100% of a tiny corpus)
- incomplete quote coverage / unstable identity → confidence not HIGH/MEDIUM
- promotion mechanisms on the 2X-B HOLD scaffolds (guaranty / tax / GC rubric presentation)
- new vocabulary names that collide with 2X-J **CONSUME**

## Corpus scan (evidence, zero model calls)

```
node scripts/audit/step-2x-g-open-world-promotion-scan.js
```

| metric | value |
|---|---:|
| newest resolution runs selected | 169 |
| shapes with ≥3 deals | 27 |
| gate PASS | 27 |

**Only one PASS row has a named ungate target today:**

`NO_SHOP_RUBRIC_OPEN_WORLD` / `REQUEST_RETURN_OR_DESTRUCTION_OF_INFORMATION` —
6 deals (concho, metsera, redhat, skechers, skywater, topbuild), hint
`UNGATE_REGISTERED_VALUE` → `NOSOL-CEASE` / `NO_SHOP_CEASE_ACTION`.

The other 26 PASS rows are recurrence signals, not promotions. Hints:

- `NEEDS_REVIEW` — most open-world reasons (native proposals, qualifier kinds, sole-remedy, material-contract buckets, tax, etc.)
- `NEEDS_CLAIM_DEFINITION_TAXONOMY` — proxy-meeting assertion kinds
- `PRIMARY_PATTERN_WIDEN` — general-covenant uncorroborated codes (must not travel through the 2X-B HOLD rubric-presentation scaffold)

Do not promote those without a Ben/taxonomy call.

## Proof: before → after on Skywater no-shop

Committed evidence pin: `evidence/canonical-v2/skywater-no-shop-20260808-r1`.

| | open_world total | `NO_SHOP_RUBRIC_OPEN_WORLD` | resolved `REQUEST_RETURN…` under `NOSOL-CEASE` |
|---|---:|---:|---:|
| before (committed `resolution.json`) | 11 | 1 | 0 |
| after (`resolveCandidates` on same receipt + adapter) | 10 | 0 | 1 |

Cited from the test, not asserted by hand:

```
node --test tests/canonical-v2-open-world-promotion-gate.test.js
# 7 pass, including skywater replay
```

Corroboration widened in the same change: accept `request` / `instruct` /
`direct` plus the bare `return … destroy` cease-action shape (Metsera); still
requires a return/destroy marker.

## What this step does *not* claim

- It does not empty the 3,031 open-world candidates.
- It does not invent claim definitions for proxy-meeting or other taxonomy gaps.
- It does not promote through 2X-B HOLD second-chance scaffolds.
- Re-running the scan after the REQUEST_RETURN ungate still lists that shape
  against **committed** evidence (pre-promotion resolutions). Fresh replays of
  those six no-shop runs would drop the open-world row; that refresh is optional
  evidence hygiene, not the proof.
