# Open-world promotion program (Ben's 2026-08-02 adjudication → registry)

**Date:** 2026-08-02. **Status:** DRAFT — program-level spec; each slice
gets its own adversarial audit before build. **Authority:**
`docs/acks/OPEN-WORLD-ADJUDICATION-2026-08-02.md` (Ben's 12 promotions,
C2 split, C15 confirm, tail deferred).

## The structural finding that shapes everything

Open-world candidates NEVER reach `GENERIC_CLAIM_KEY_RESOLUTION_TABLE`:
`candidate-resolution.js` routes any candidate with
`extraction_provenance.proposal_kind === 'OPEN_WORLD'` straight to the
open_world bucket BEFORE concept resolution. So a promotion is not a
registry entry — it is a five-layer change, and the fixtures only
convert on a NEW extraction (or recorded-response reshape):

1. **Producer prompt** (`capitalisation-producer-prompt.js`): teach the
   model to emit the promoted shape as a TYPED proposal, not an
   open-world candidate. Extraction-prompt engineering — Fable end to
   end, golden-eval gated.
2. **Provider** (`anthropic-provider.js`): mint the new generic claim
   keys with a non-OPEN_WORLD proposal_kind.
3. **Registry** (`contract-bundle.js`): new frozen input version
   (V14) — concepts + claim definitions. Code-only; NO SQL migration
   (confirmed: no DB vocabulary catalog exists).
4. **Resolver** (`candidate-resolution.js`): resolution-table entries,
   `MAPPING_TABLE_VERSION` bump, canonical-value derivation branches,
   materiality tiers.
5. **Fixtures/evals**: replay tests proving each promoted concept
   converts its known fixture candidates, plus one fresh live run per
   slice documented before merge.

## Slices (each: spec-detail → audit → build → review; sliced to keep
every diff reviewable and the prompt changes isolated)

### P1 — Cap-table numeric core (C1+C9, C8+C11)

- Concepts under `REP-T-CAP`; new claim definitions
  `CAPITALIZATION_SHARE_COUNT` (per-class: value =
  `NON_NEGATIVE_DECIMAL_STRING`, the existing validated type; class
  carried as a governed attribute, not baked into the key — one
  definition, class-dimensioned, mirroring how measurement dates carry
  attachment) and `RESERVED_SHARE_POOL` (count + `plan_ref` attribute;
  zero case is a count of "0" with the same shape — the M3 rule that
  the producer never asserts a negative does NOT apply to a POSITIVE
  quote stating "no shares reserved", which is quoted text, not a
  derived ABSENT).
- Needs a mechanical numeric parser (`share-count-parse.js`) analogous
  to `measurement-date-parse.js`: literal digit-group parse from the
  byte-verified quote, typed ABSTAIN on anything non-literal
  (spelled-out numbers route to review, not to arithmetic).
- Materiality: new tier `CAPITAL_STRUCTURE` — rank proposal 50 (above
  REPRESENTATIONS' 55; the cap table is closer to consideration
  mechanics than to generic reps). Flagged for Ben in the PR, same
  convention as the REPRESENTATIONS tier's own flag.
- Payoff: with component rows merged, these publish. This is the slice
  that turns the demo's highlighted share counts into database rows.

### P2 — Qualifier kinds (C3+C6, C4, C5, PROP-65)

- `QUALIFIER_KINDS` grows: `DISCLOSURE_SCHEDULE_CARVEOUT`,
  `PERFORMANCE_ASSUMPTION`. Lexicon version bump; marker tables for
  each; binding-algorithm interaction decided IN THE SPEC DETAIL, not
  by the implementer:
  - The hostless no-op rule gets a carve-out: a hostless
    "except as set forth in [Section X of the Disclosure Letter]"
    clause IS the carve-out qualifier itself (self-hosting family) —
    today it is silently dropped, which is exactly the recall hole the
    promotion closes.
  - Identity-bearing: `DISCLOSURE_SCHEDULE_CARVEOUT` doubt routes to
    REVIEW (it now carries a pointer value that enters serving);
    `PERFORMANCE_ASSUMPTION` doubt routes to open world (not
    identity-bearing yet). Recorded as pinned decisions for Ben's PR
    read.
- New canonical value type `SCHEDULE_REFERENCE_STRING` (the POINTER
  shape) added in the three lockstep validators (`contract-bundle.js`
  fixture-shape validator, both `canonicalValueAllowed` copies) —
  format pinned: the normalized section citation grammar the citation
  validator already emits (e.g. `3.2(f)`), optionally suffixed
  `@DISCLOSURE_LETTER`. C4/C5 date roles reuse
  `ISO_8601_DATE_STRING` with role attributes `DATE_REFERENCE` /
  `DATE_DEFINITION`; C4's period shape ("from X to Y") is TWO dated
  claims (start/end roles), never a composite string.
- Resolver: `resolveQualifierPart` gains branches for both kinds; the
  fail-closed `UNSUPPORTED_QUALIFIER_KIND_MAPPING` residual stays for
  anything else.

### P3 — Negative-assertion reps (C2 split, C7, C10, C12, C15)

- C2 splits per Ben's ruling into per-right-type concepts (options /
  warrants / convertibles / voting trusts / registration rights), each
  an enum-valued definition (`allowed_canonical_values:
  ['NONE_OUTSTANDING']`-style), NOT free text — these are
  quote-grounded positive assertions of absence (byte-verified text
  like "no outstanding options"), which under M3 rule 1 are PRESENT
  claims with negative content, distinct from derived ABSENT states.
- C7 (securities-law transfer carve-out) rides in P2's qualifier
  machinery as a `DISCLOSURE_SCHEDULE_CARVEOUT`-sibling kind? NO —
  pinned: C7 is a THRESHOLD-family carve-out with its own concept key
  and no pointer value; it stays a qualifier concept under the
  existing THRESHOLD kind (its text carries a legal standard — the
  securities-law exception — not a schedule pointer). One-line note
  for Ben since it neighbours his C3 question.
- C10/C12/C15: enum-valued rep definitions like C2's split members.

### P4 — REIT/UPREIT family (C14, Ben ruled: design now)

- New concept family `REP-T-OPU` (operating-partnership units):
  GP-status assertion, unit-count assertions (reuse the P1 numeric
  parser), unit-class attributes, ownership-limit/Excepted-Holder
  assertions (enum + pointer hybrids — depends on P2's
  `SCHEDULE_REFERENCE_STRING`).
- Prompt scope widens for REIT deals only via the existing
  section-scope mechanism; non-REIT deals see zero prompt change.
  Golden evals: Modiv fixture is the only REIT recording — P4's eval
  bar is "every C14 fixture candidate converts; zero regressions on
  the two corporate deals' recordings".

## Ordering and dependencies

P1 → P2 → P3 → P4. P1 is pure addition (no new value types, no
lexicon change) — lowest risk, highest payoff, goes first. P2 carries
the two structural changes (new kind enum + new value type) and gates
P3's C7 note and P4's pointer hybrids. All four queue behind the
lexical-net merge (same files). Prompt changes bump `PROMPT_VERSION`
once per slice, never mid-slice; every slice ends with one documented
fresh live run (subscription CLI, per the token-conservation
mechanics) plus the recorded-response replays.

## Invariants that hold across all slices

- Producer never asserts a negative (M3 rule 1): every "no X
  outstanding" promotion is a quoted PRESENT claim; derived ABSENT
  stays with the (future) scope-closure machinery.
- Open-world path stays load-bearing: the prompt keeps its PRESERVE
  THE NOVEL instruction; promotions narrow what counts as novel, they
  never instruct the model to force-fit.
- Every slice's registry additions are strictly additive on the
  compiled bundle (V13 → V14 → …); no existing definition or concept
  is edited, ever.
- The lexical net's family lexicon grows in the SAME slice as any new
  concept family (P4 adds REP-T-OPU patterns), so lexicon coverage
  never lags the taxonomy — uncovered families block auto-pass, and
  we don't ship families pre-blocked when the patterns are knowable.
- Each slice's acceptance tests include: fixture-conversion counts
  (exact: which closure_ids leave open_world and where they land),
  no-input additivity pins, golden-eval pass on the extraction
  prompts, quote verification at zero flags.
