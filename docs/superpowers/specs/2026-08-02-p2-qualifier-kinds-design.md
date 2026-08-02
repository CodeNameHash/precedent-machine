# P2 — New qualifier kinds (C3+C6, C4, C5, PROP-65)

**Date:** 2026-08-02. **Status:** AUDIT-AMENDED (1 critical, 5
material, 5 minor folded; verdict was AMEND).
**Parent:** `2026-08-02-openworld-promotion-program.md` (slice P2).
**Authority:** Ben's PROMOTE rulings on C3+C6 (with his own THRESHOLD-vs-
schedule question resolved as the new type), C4, C5, and PROP-65
(`docs/acks/OPEN-WORLD-ADJUDICATION-2026-08-02.md`).
**Template:** `2026-08-02-p1-captable-numerics-design.md` (typed abstains,
corroboration, coverage maps on literal fixture bytes, honest additivity
re-pins, harness honesty).

## Deliverable

Four promoted shapes become governed, resolvable claims:

1. **C3+C6** — disclosure-schedule carve-outs ("except as set forth in
   Section 3.2(b) of the Company Disclosure Letter") become a new
   qualifier kind `DISCLOSURE_SCHEDULE_CARVEOUT` carrying a POINTER
   canonical value (new type `SCHEDULE_REFERENCE_STRING`).
2. **C4** — references to a deal-defined date term ("as of the
   Capitalization Date") resolve to ISO dates via a run-scoped
   defined-date map, attributed `date_role: 'DATE_REFERENCE'`.
3. **C5** — the defining quotes ("As of the close of business on May 1,
   2026 (the “Capitalization Date”)") resolve to ISO dates attributed
   `date_role: 'DATE_DEFINITION'` + `defined_term`. Periods ("From the
   Capitalization Date to the date hereof") mint TWO dated claims
   (start/end roles), never a composite string.
4. **PROP-65** — performance-vesting assumptions ("assuming satisfaction
   of applicable performance criteria at target levels") become kind
   `PERFORMANCE_ASSUMPTION` with enum value `TARGET | MAXIMUM`.

**Conversion semantics, stated honestly (the P1 audit C-1 lesson applied
up front).** Unlike P1's cluster members, most P2 fixture members ARE
`NATIVE_CAPITALISATION_QUALIFIER_CANDIDATE` rows banked open-world with
reason `UNMAPPED_GENERIC_CLAIM_KEY` — they re-enter
`handleQualifierCandidate` on a resolution replay over the committed
compiled candidates, so THESE convert in replay tests, closure_id by
closure_id (section 9's coverage map). Two named exceptions:

- Skechers PROP-65 rows `54bf50e5…` / `9b97ca12…` are
  `OPEN_WORLD_PROPOSITION` rows (`proposal_kind === 'OPEN_WORLD'`) —
  they NEVER reach concept resolution (program spec, structural
  finding) and convert only on a fresh post-prompt-change live run. No
  report may claim their conversion before the dated live-run handoff.
- Limb-assertion rows whose text CONTAINS a promoted phrase (e.g.
  Modiv `363955ce…`, Skechers `63fe36fd…`/`06ad88a3…`, F28
  `74e9251c…`/`22593b53…`) are structure, not qualifiers; they REMAIN
  open world, pinned as such in the acceptance tests.

## 1. Lexicon changes (`qualifier-kind-lexicon.js`)

`QUALIFIER_KIND_LEXICON_VERSION` **1 → 2**. `QUALIFIER_KINDS` grows to
six, frozen:

```
['KNOWLEDGE', 'TEMPORAL', 'ACCURACY', 'THRESHOLD',
 'DISCLOSURE_SCHEDULE_CARVEOUT', 'PERFORMANCE_ASSUMPTION']
```

(EXACTLY TWO existing test edits, both named per audit minor 1: the
four-family enum pin at `tests/canonical-v2-qualifier-kind-lexicon.
test.js:43` becomes six, and the lexicon version pin at lines 39-41
becomes 2. Nothing else in that 419-line suite changes.)

### 1a. DISCLOSURE_SCHEDULE_CARVEOUT patterns — two tiers, NEITHER added
to the four-family marker tables

The carve-out patterns are deliberately NOT appended to the marker
tables consumed by `findAllMarkerOccurrences`. Rationale: those tables
feed `containsMarkerOrConnective`, which drives the comma-close rule —
adding a new family there would silently change bound-clause boundaries
on legacy quotes (e.g. Modiv `af9d4710…`'s list commas) and perturb the
binding algorithm the 2026-08-01 spec froze. Instead the carve-out is a
FRONT DOOR on `classifyQualifierQuote` (section 2), leaving
`applyExceptionConnectiveBinding` byte-for-byte untouched. Two exported
patterns, both matched against the zero-width-normalised quote
(`normaliseForMatching` strips the F28 U+200E LTR marks, so the grammar
works on the LITERAL committed fixture bytes):

```
DISCLOSURE_CARVEOUT_CLAUSE_PATTERN  (the CLASSIFY grammar — full match only)
  ^(except|except as|except for|other than|excluding)\s+
   (?:as\s+)?(set\s+forth|provided|disclosed|described|listed)\s+
   (?:in|on)\s+
   Section\s+(\d+\.\d+(?:\([^()\s]+\))*)\s+
   of\s+the\s+(?:\w+\s+){0,2}Disclosure\s+(?:Letter|Schedule)s?
   [\s,;.]*$
  (case-insensitive; applied to the WHOLE normalised quote, trimmed,
   tolerating only trailing whitespace/punctuation)

DISCLOSURE_CARVEOUT_SIGNAL_PATTERN  (the DOUBT tripwire — anywhere)
  (?:set\s+forth|provided|disclosed|described|listed)\s+(?:in|on)\s+
  Sections?\s+\d+\.\d+(?:\([^()\s]+\))*
  (?:[^;]{0,80}?)of\s+the\s+(?:\w+\s+){0,2}Disclosure\s+(?:Letter|Schedule)s?
  (case-insensitive, unanchored; note the plural "Sections?" and the
   bounded bridge so "Sections 3.2(a) and 3.2(b) of the Company
   Disclosure Letter" trips it)
```

Per-pattern rationale:

- **Verb list** `set forth | provided | disclosed | described | listed`:
  "set forth" and "provided" are the two observed fixture verbs (Modiv
  `72cf145f…` et al.; `a7e0b078…`'s first clause uses "provided"); the
  other three are the standard drafting synonyms — including them now
  avoids a lexicon bump per synonym, and they are harmless because the
  ANCHOR (below) is what carries precision, not the verb.
- **Citation token** `\d+\.\d+(\([^()\s]+\))*`: the decimal-section
  shape `citation-constructibility.js` normalizes (`3.2(b)`,
  `3.1(b)(ii)`); label charset mirrors `parseCitationComponents`'s own
  `[^()\s]+`.
- **Anchor** `of the … Disclosure (Letter|Schedule)s?`: REQUIRED. This
  is the whole anti-noise design: agreement-internal cross-references
  ("Except as set forth in this Section 3.7", Skechers `fbc80a36…`;
  "as set forth in Sections ‎3.1(b)(i) and ‎3.1(b)(ii)", F28
  `751b9361…`/`0bc6c5a5…` — which cite the AGREEMENT's own
  capitalization subsections, not the letter) must not fire, and do
  not, because they carry no Disclosure-document anchor. The
  `(?:\w+\s+){0,2}` slot covers "Company" / "Parent Disclosure Letter"
  variants without opening to arbitrary prose.
- **Whole-letter carve-outs** ("except as set forth in the Disclosure
  Letter", NO section citation) match NEITHER pattern. Pinned: they
  stay exactly what they are today — a markerless hostless no-op →
  open world. The existing no-op test at
  `tests/canonical-v2-qualifier-kind-lexicon.test.js:323` passes
  VERBATIM, and the module header's own no-op example stays literally
  true. Rationale: `SCHEDULE_REFERENCE_STRING` (section 3) cannot
  represent a citation-less pointer this slice, and routing an
  unrepresentable-but-recognized shape to review gives a human nothing
  to mint. Flagged for Ben: a future value-grammar extension (bare
  `@DISCLOSURE_LETTER`) would bank these; until then they surface via
  the commonality report as today.

### 1b. PERFORMANCE_ASSUMPTION pattern

Also a front-door check, not a marker-table family (same
binding-preservation rationale):

```
PERFORMANCE_ASSUMPTION_PATTERN
  \bassuming\s+(?:satisfaction|achievement)\s+of\s+(?:the\s+)?
  applicable\s+performance\s+(?:criteria|goals)\s+at\s+(?:the\s+)?
  (target|maximum)\s+levels?\b        (case-insensitive, global)
```

Rationale: the full multi-word phrase is required — a bare
`\bassuming\b` would fire on "assuming the accuracy of the
representations and warranties" (the ubiquitous bring-down/condition
idiom) and corrupt COND-family quotes. Both fixture surface forms are
covered: Skechers "assuming satisfaction of applicable performance
criteria at target levels" (no "the", plural "levels") and F28
"assuming achievement of the applicable performance goals at the
target level" (with "the", singular). The captured group is the level;
derivation to `TARGET`/`MAXIMUM` happens in the resolver (section 5) —
the classifier reports kind only, `code: null`, mirroring the
TEMPORAL/measurement-date division of labor.

## 2. The self-hosting exception to the hostless no-op rule

**Current rule** (module header ~39–41; enforced at ~648–655): a
hostless bound clause with no marker of its own is a no-op; with a
marker, it routes by the doubt rule. The C3/C6 fixture quotes are
exactly the "no marker → no-op → open world" case today.

**New rule — the exact predicate.** `classifyQualifierQuote` gains two
steps at its top, BEFORE `applyExceptionConnectiveBinding` runs (the
binding algorithm, comma-close rule, masking, and split machinery are
untouched):

1. **SELF-HOSTING CLASSIFY.** If the whole normalised quote, trimmed,
   full-matches `DISCLOSURE_CARVEOUT_CLAUSE_PATTERN` (i.e. the quote IS
   one except-family connective plus one citation-anchored
   disclosure-schedule pointer and nothing else, modulo trailing
   punctuation), AND `modelKind !== 'ACCURACY'` and
   `modelKind !== 'PERFORMANCE_ASSUMPTION'`, the quote is
   `{ outcome: 'CLASSIFIED', kind: 'DISCLOSURE_SCHEDULE_CARVEOUT',
   code: null, measurementDateEligible: null }`. The hostless clause
   has become its own qualifier — the self-hosting family. (An
   ACCURACY hint on such a quote → REVIEW `QUALIFIER_KIND_DISAGREEMENT`
   — ACCURACY doubt is never overridden; a PERFORMANCE_ASSUMPTION hint
   → REVIEW — two definite new-vocabulary calls differing.)
2. **CARVEOUT DOUBT.** Else if `DISCLOSURE_CARVEOUT_SIGNAL_PATTERN`
   matches anywhere in the normalised quote, OR
   `modelKind === 'DISCLOSURE_SCHEDULE_CARVEOUT'`, the quote routes to
   REVIEW — typed `DISCLOSURE_CARVEOUT_PARTIAL` (signal fired but the
   quote is not a pure carve-out clause: compound/mixed carve-outs,
   multi-citation "Sections … and …", enumerated lists) or
   `DISCLOSURE_CARVEOUT_UNCORROBORATED` (model claims the kind, no
   deterministic signal — the analogue of the existing
   model-claims-ACCURACY branch at ~661–670). Identity-bearing doubt
   never falls through to open world (section 6).
3. Otherwise the quote proceeds through the EXISTING pipeline —
   byte-identically to lexicon v1 FOR QUOTES MATCHING NEITHER PATTERN
   (audit M-4: stated conditionally, not absolutely; a corpus
   assertion in the acceptance tests proves no currently-resolving
   fixture quote carries the signal, so the committed corpus is
   unperturbed in fact). To keep AFFIRMATIVE schedule references
   ("the awards set forth in Section 3.2(b) of the Company Disclosure
   Letter") out of carve-out doubt, `DISCLOSURE_CARVEOUT_SIGNAL_
   PATTERN` REQUIRES an except-family connective (except|except as|
   except for|other than|excluding) within 40 normalised chars BEFORE
   the verb — an affirmative reference has none and flows to the
   legacy pipeline untouched; a knowledge-plus-carveout compound still
   trips the signal (its "except as set forth..." tail carries the
   connective) and routes to REVIEW `DISCLOSURE_CARVEOUT_PARTIAL`,
   which is the honest outcome for a mixed quote.
   The PERFORMANCE_ASSUMPTION check then runs on the legacy pipeline's
   output: if `PERFORMANCE_ASSUMPTION_PATTERN` matched and the legacy
   `familySet` is EMPTY, classify `PERFORMANCE_ASSUMPTION` (unless
   `modelKind === 'ACCURACY'` → REVIEW, or
   `modelKind === 'DISCLOSURE_SCHEDULE_CARVEOUT'` → REVIEW); if the
   legacy familySet is non-empty, the co-fire routes by the existing
   doubt rule (ACCURACY-touching → REVIEW, else open world) — a
   threshold-plus-assumption tangle is genuine doubt, and
   PERFORMANCE_ASSUMPTION is not identity-bearing, so open world is
   the correct floor.

**Why "whole-quote full match" and not "hostless clause full match":**
the free-standing carve-out phrase inside a longer mixed clause (Modiv
`af9d4710…`: "Except (i) pursuant to the Company Charter, … and (iv) as
set forth in Section 3.2(d) of the Company Disclosure Letter,") must
NOT classify — minting a schedule pointer as THE kind of a four-item
mixed carve-out misstates three of its four legs. Whole-quote
full-match makes the classify path exactly as narrow as the promotion:
a quote that is nothing but the pointer. Everything anchored but
impure is step-2 REVIEW. This wording also keeps every existing
hostless test green: line 311's "except as the Board determines is
material…" carries no anchor (step 3, unchanged), and line 323's
whole-letter quote matches neither pattern (unchanged no-op).

**Ruling-corpus vocabulary (audit M-2):** `ruling-corpus.js` freezes
its OWN four-kind list and rejects other `ruled_kind`s; this slice
extends that list to the same six kinds in the same commit (one
vocabulary, two sites, a shared-vector test pinning they agree — the
lockstep convention), so review items this slice mints CAN be settled
by ruling, and the drafting scripts (which import the lexicon's list)
stay consistent with corpus validation. A ruled
`DISCLOSURE_SCHEDULE_CARVEOUT` applies through the existing
`applyRuling` path unchanged.

**Ruling-corpus interaction:** `handleQualifierCandidate` still applies
exact-match rulings BEFORE classification. Rulings recorded under
lexicon v1 pin `lexicon_version_at_ruling: 1`; `applyRuling` re-runs
the CURRENT lexicon, and an affirmative different-kind fire (e.g. a
stored THRESHOLD ruling on a phrase the v2 lexicon now classifies
DISCLOSURE_SCHEDULE_CARVEOUT) is a `RULING_LEXICON_CONFLICT` → REVIEW,
exactly the existing mechanism. No committed ruling covers any P2
fixture phrase (verify in-build; assert in test 10).

## 3. `SCHEDULE_REFERENCE_STRING` and the three-place validator lockstep

New canonical value type — the POINTER shape. **Format, pinned:**

```
SCHEDULE_REFERENCE_STRING := <citation>[@DISCLOSURE_LETTER]
<citation> := the concatenated normalized reference
              citation-constructibility.js already emits via
              parseCitationComponents + citationFromComponents:
              a decimal section token then zero or more parenthesized
              labels, no separators — e.g. 3.2(f), 3.1(b)(ii)
Validator regex (identical at all three sites — audit minor 2: the
suffix is REQUIRED this slice, relaxed only when P4's suffix-less
emitters actually exist, so an upstream bug can never publish an
ambiguous pointer):
  /^\d+\.\d+(\([0-9A-Za-z]+\))*@DISCLOSURE_LETTER$/
(Audit minor 3, documented so nobody "fixes" it: the lexicon citation
token charset is wider than the value regex's label class —
"3.2(b-1)" passes the grammar then abstains CITATION_UNNORMALIZABLE;
fail-closed and intended.)
```

The `@DISCLOSURE_LETTER` suffix marks the pointer's target document.
This slice's parser ALWAYS emits it (the anchor is what licensed the
fire); the suffix is grammatically optional because the type is shared
with P4's future agreement-internal pointer hybrids, which will emit
suffix-less values. No other suffix is valid this slice.

**Three-place lockstep** (all in one commit, with a shared
accept/reject vector test proving the three copies agree):

1. `contract-bundle.js` fixture-shape validator (~3296): the
   `typedDefinition` whitelist `['ISO_8601_DATE_STRING',
   'NON_NEGATIVE_DECIMAL_STRING']` gains `'SCHEDULE_REFERENCE_STRING'`.
   This is the ONLY registry-validator change.
2. `candidate-resolution.js` `canonicalValueAllowed` (~532): new
   branch, the regex above.
3. `validate-write-set.js` `canonicalValueAllowed` (~741): same branch,
   same regex, byte-identical.

**Registry → V15** (strictly additive spread of V14; V14 arrays
untouched byte-for-byte):

```
DISCLOSURE_SCHEDULE_CARVEOUT_CLAIM_DEFINITION_V1
  claim_definition_key: 'DISCLOSURE_SCHEDULE_CARVEOUT'
  version: 1
  canonical_value_type: 'SCHEDULE_REFERENCE_STRING'
  canonical_value_required_when_present: true

PERFORMANCE_VESTING_ASSUMPTION_CLAIM_DEFINITION_V1
  claim_definition_key: 'PERFORMANCE_VESTING_ASSUMPTION'
  version: 1
  allowed_canonical_values: ['MAXIMUM', 'TARGET']   (enum shape —
    validates under the existing enumDefinition path, zero changes)
  canonical_value_required_when_present: true
```

`EXPECTED_CLAIM_KEYS_V15 = [...V14, 'DISCLOSURE_SCHEDULE_CARVEOUT',
'PERFORMANCE_VESTING_ASSUMPTION'].sort()`. No new concepts — both live
under `REP-T-CAP` (`QUALIFIER_CONCEPT_KEY`), like every qualifier
definition. C4/C5 need NO registry change at all: they mint the
existing `REPRESENTATION_MEASUREMENT_DATE` (`ISO_8601_DATE_STRING`)
with new governed attributes (section 7).

**Explicit non-wiring pin:** schedule-reference citations are NEVER run
through `checkCitationCorroboration` / the constructibility tree — the
Disclosure Letter is a separate, unfiled document whose section numbers
do not exist in the agreement's section tree; wiring that check would
quarantine every valid pointer. The pointer's verification is the
byte-verified quote itself plus the deterministic grammar.

## 4. Resolution-table entries (`candidate-resolution.js`)

`MAPPING_TABLE_VERSION` **4 → 5**. Three new entries, keyed
`(QUALIFIER_CLAIM_KEY, kind, position)`:

```
(QUALIFIER_CLAIM_KEY, 'DISCLOSURE_SCHEDULE_CARVEOUT', 'CHAPEAU')
  → DISCLOSURE_SCHEDULE_CARVEOUT / REP-T-CAP / party_making / REPRESENTATION_MAKER
(QUALIFIER_CLAIM_KEY, 'DISCLOSURE_SCHEDULE_CARVEOUT', 'ITEM')
  → DISCLOSURE_SCHEDULE_CARVEOUT / REP-T-CAP / party_making / REPRESENTATION_MAKER
(QUALIFIER_CLAIM_KEY, 'PERFORMANCE_ASSUMPTION', 'ITEM')
  → PERFORMANCE_VESTING_ASSUMPTION / REP-T-CAP / party_making / REPRESENTATION_MAKER
```

- Carve-outs use TWO fully-keyed entries rather than one
  position-agnostic entry, per Ben's C3+C6 ruling ("attachment-position
  differentiation (chapeau vs item)"): a chapeau carve-out qualifies
  the whole representation, an item carve-out one limb — legally
  distinct facts, and fully-keyed entries mean an unexpected position
  can never silently fall through `lookupGenericClaimKeyMapping`'s
  precedence chain. **TRAILING is deliberately ABSENT** → a
  TRAILING-attached carve-out hits the `!mapping` path, which for this
  kind routes to REVIEW, typed `CARVEOUT_POSITION_UNMAPPED`
  (identity-bearing — section 6), joining the existing
  ACCURACY-ITEM precedent at ~1723 rather than the open-world floor.
- PERFORMANCE_ASSUMPTION registers ITEM only — both fixture qualifier
  rows are ITEM-attached parentheticals hanging off award-count limbs
  (F28 `a9897181…`, `57ac1d2e…`). CHAPEAU/TRAILING absent → `!mapping`
  → open world (not identity-bearing), same floor as THRESHOLD today.
- Both positions of the fixture corpus are exercised: Modiv
  `cc9b6dd9…` is CHAPEAU, `72cf145f…`/`1f5fe703…`/`5e4759d8…`/
  `8f47f525…` are ITEM.

The fail-closed residual is UNCHANGED: any `(kind, position)` pair that
reaches the canonical-value stage without a derivation branch still
lands in `UNSUPPORTED_QUALIFIER_KIND_MAPPING` (~1800) — the two new
kinds get branches BEFORE that else (section 5), and the residual keeps
guarding everything else.

## 5. `resolveQualifierPart` branches + the pointer parser

### 5a. New module `lib/canonical-v2/native-producer/schedule-reference-parse.js`

The P1 parser-contract precedent (`share-count-parse.js` /
`measurement-date-parse.js`): pure, no I/O, no model, every outcome
typed. `SCHEDULE_REFERENCE_PARSE_VERSION = 1`.

```
parseScheduleReference({ quote }) →
  { outcome: 'RESOLVED', canonical_value: '3.2(b)@DISCLOSURE_LETTER',
    citation: '3.2(b)', matched_text }
| { outcome: 'ABSTAIN', reason:
    'NOT_A_PURE_CARVEOUT_CLAUSE'    (whole-quote grammar fails)
  | 'MULTIPLE_SCHEDULE_CITATIONS'   (plural "Sections … and …")
  | 'CITATION_UNNORMALIZABLE' }     (token survives the grammar but
                                     parseCitationComponents/
                                     citationFromComponents yields a
                                     string failing the section-3 regex)
```

Pins: it IMPORTS `DISCLOSURE_CARVEOUT_CLAUSE_PATTERN` from the lexicon
and `parseCitationComponents`/`citationFromComponents` from
`citation-constructibility.js` — one grammar, one normalizer, no
re-derivation (the `CALENDAR_DATE_PATTERN` reuse precedent). It
re-validates its own output against the `SCHEDULE_REFERENCE_STRING`
regex before returning RESOLVED (fail-closed: `canonicalValueAllowed`
must never be the first to catch a drift). Matching runs on the
zero-width-normalised text; `matched_text` is sliced from the original
quote via the offset map (the lexicon's own convention).

### 5b. Branches in `resolveQualifierPart`

Inserted between the KNOWLEDGE branch and the fail-closed else:

```
} else if (kind === 'DISCLOSURE_SCHEDULE_CARVEOUT') {
  const ref = parseScheduleReference({ quote: part.text });
  if (ref.outcome !== 'RESOLVED') →
    pushReviewUnresolved, reasons: [ref.reason]   // identity-bearing:
    // a classified carve-out whose pointer cannot be minted is doubt
    // about a serving value → REVIEW, never open world. Unreachable in
    // practice (classification required the same full-match) but the
    // two modules compute independently — the established
    // "independent sites compute the identical thing" style.
  resolvedCanonicalValue = ref.canonical_value;
} else if (kind === 'PERFORMANCE_ASSUMPTION') {
  const level = derivePerformanceAssumptionLevel(part.text);
  // all PERFORMANCE_ASSUMPTION_PATTERN matches in the quote, distinct
  // captured levels collapsed: exactly one distinct level → that level
  // uppercased ('TARGET'|'MAXIMUM'); zero or 2+ distinct levels →
  if (level === null) →
    pushOpenWorld, reason: 'PERFORMANCE_ASSUMPTION_LEVEL_UNDERIVABLE'
    // not identity-bearing → open world floor, typed
  resolvedCanonicalValue = level;
}
```

`attributesExtra` carries `deterministic_kind` and the MECHANICAL
`answer_provenance` exactly as today; its pins gain
`schedule_reference_parse_version` on carve-out claims. Both kinds then
flow through the unchanged vocabulary/section/party/provision/subject/
gate path — `canonicalValueAllowed` under the V15 definitions is the
final gate, as ever. `resolution_receipt` / `receiptBody` threads
`schedule_reference_parse_version: 1` and the bumped
`measurement_date_parse_version: 2` alongside `mapping_table_version: 5`
and the V15 `contract_vocabulary_digest` (the P1 M-6 convention).

The `!mapping` branch grows one arm: `kind ===
'DISCLOSURE_SCHEDULE_CARVEOUT'` → REVIEW `CARVEOUT_POSITION_UNMAPPED`
(section 4); everything else in that branch is unchanged.

## 6. Identity-bearing set and doubt routing — pinned decisions for Ben

The ACCURACY-only literals in the two doubt branches
(`buildClassified`/single-family disagreement ~679 and `doubtOutcome`
~756) generalize to a frozen set:

```
IDENTITY_BEARING_KINDS = Object.freeze(['ACCURACY', 'DISCLOSURE_SCHEDULE_CARVEOUT'])
```

Doubt touching any member — lexicon fires it and the model definitely
disagrees in the same vocabulary tier, the model claims it and the
lexicon cannot corroborate, or it is entangled past what the front door
can settle — routes to REVIEW. All other doubt routes to open world.
(Audit minor 5 — the refactor touches ONLY the two doubt branches
(lexicon ~679/~756); these ACCURACY literals stay literal and
untouched: lexicon 661-669, candidate-resolution 1680, 1723, 1764,
2055. Nobody "helpfully" generalizes them.)

1. **`DISCLOSURE_SCHEDULE_CARVEOUT` doubt → REVIEW.** Rationale
   (program spec, pinned): it now carries a pointer value that ENTERS
   SERVING; a wrong pointer is a wrong legal fact a user will rely on.
   Concrete REVIEW routes this slice: `DISCLOSURE_CARVEOUT_PARTIAL`,
   `DISCLOSURE_CARVEOUT_UNCORROBORATED`, `CARVEOUT_POSITION_UNMAPPED`,
   the parser abstain reasons, `RULING_LEXICON_CONFLICT`.
2. **`PERFORMANCE_ASSUMPTION` doubt → open world.** Not
   identity-bearing yet (program spec, pinned): the enum is
   low-blast-radius, the kind is new, and open world keeps doubtful
   instances countable for a future hardening pass instead of taxing
   review.
3. **Legacy-hint abstention rule (new, pinned).** A model `kind` hint
   of `KNOWLEDGE`, `TEMPORAL`, or `THRESHOLD` is treated as ABSTENTION
   — not disagreement — against a new-kind front-door fire. Rationale:
   (a) every committed fixture hint predates the new vocabulary — the
   model was FORCED to guess among four kinds that contained no right
   answer (the Modiv carve-outs and F28 assumptions all carry
   `qualifier_kind: 'THRESHOLD'`); treating that as a definite
   differing call would send every replay conversion to
   REVIEW/open-world and nullify the promotion; (b) permanently, both
   new-kind fires rest on high-precision multi-word grammars over
   byte-verified text — a one-word legacy label cannot make "at target
   levels" a dollar threshold. The rule is asymmetric by DESIGN
   precision, not by fixture era, and it has two carve-outs that never
   soften: an `ACCURACY` hint always routes to REVIEW, and a definite
   new-kind hint contradicting a different new-kind fire always routes
   to REVIEW.
4. **Model claims a new kind, lexicon abstains:**
   `DISCLOSURE_SCHEDULE_CARVEOUT` → REVIEW
   (`DISCLOSURE_CARVEOUT_UNCORROBORATED`); `PERFORMANCE_ASSUMPTION` →
   open world. Mirrors the existing ACCURACY-vs-others asymmetry
   exactly.

## 7. C4/C5 date roles (TEMPORAL machinery, existing claim definition)

### 7a. Lexicon TEMPORAL extensions (all under the v2 version bump)

1. **Closed symbolic list grows by one:** `TEMPORAL_SYMBOLIC_DATES` +=
   `'the Capitalization Date'`. It is a market-standard defined term
   appearing in all three deals; the list stays CLOSED — other
   deal-defined date terms wait for their own versioned additions
   (known cost, section 12).
2. **As-of bridge grammar.** `findTemporalOccurrences` currently
   requires a calendar date or symbolic phrase IMMEDIATELY after
   "as of". It gains one optional, bounded bridge:

   ```
   AS_OF_BRIDGE := (?:the\s+close\s+of\s+business\s+on\s+
                   | \d{1,2}:\d{2}\s*[ap]\.m\.,?\s*
                     (?:\w+\s+time,?\s*)?on\s+)?
   ```

   Rationale: the two C5 byte-forms are "As of the close of business
   on May 1, 2026 (…)" (Modiv) and "As of 5:00 p.m., Eastern time, on
   May 2, 2025 (…)" (Skechers); the bridge admits exactly the
   business-close and clock-time idioms and nothing else — free prose
   between "as of" and the date still refuses to fire.
3. **Period grammar** — a new TEMPORAL occurrence shape:

   ```
   (from|since)\s+ENDPOINT\s+(to|through|until)\s+ENDPOINT
   ENDPOINT := calendar date | a TEMPORAL_SYMBOLIC_DATES member
   ```

   emitting `resolution: 'PERIOD'` with both endpoint sub-spans.
   Covers "From the Capitalization Date to the date hereof" (Skechers
   `767fadaf…`) and "Since the Capitalization Date through the date
   hereof" (Modiv `52417899…`/`9d8b08bb…`). Endpoints outside the
   closed vocabulary do not fire (anti-noise: "from time to time",
   "from the Company to Parent" cannot match).

### 7b. `measurement-date-parse.js` v2 (`MEASUREMENT_DATE_PARSE_VERSION` 1 → 2)

- New optional arg `defined_dates`: a caller-injected map
  `{ 'Capitalization Date': 'YYYY-MM-DD' }` — governed run data, the
  `agreement_date` injection precedent. Term keys carry NO leading
  article, exactly as captured from the defining parenthetical.
- Symbolic phrase `'the Capitalization Date'` resolves via
  `defined_dates` → `resolution: 'SYMBOLIC_DEAL_DEFINED'`. Absent →
  typed ABSTAIN `DEFINED_DATE_UNRESOLVED`; present-but-conflicted
  (section 7c) → `DEFINED_DATE_CONFLICT`.
- **Definition detection:** when the CALENDAR path resolves AND the
  defining-parenthetical pattern

  ```
  \(\s*(?:such\s+(?:time\s+and\s+)?date,\s*)?the\s+[“"]
  ([A-Z][A-Za-z ]{0,60}?Date)[”"]\s*\)
  ```

  matches AFTER the matched date, the result carries
  `defined_term: 'Capitalization Date'` (captured, quotes stripped).
  Both fixture forms match: "(the “Capitalization Date”)" and
  "(such time and date, the “Capitalization Date”)". The term must end
  in "Date" — a defining parenthetical for anything else is not a date
  definition and is ignored.
- **Period detection ORDER, pinned (audit M-1 — the naive build
  collapses a period to its end date):** `parseMeasurementDate` v2
  runs the PERIOD grammar FIRST, before every single-date path; a
  period match returns a typed `{ outcome: 'PERIOD_DETECTED' }` signal
  and the resolver then calls `parseMeasurementPeriod` — the
  single-date symbolic scan (which would find "the date hereof" inside
  "From the Capitalization Date to the date hereof" and mint ONE wrong
  claim) is unreachable for period-shaped quotes by construction, and
  a test pins exactly that quote against exactly that failure.
- **`parseMeasurementPeriod({ quote, agreement_date, defined_dates })`**:
  resolves BOTH endpoints independently → `{ outcome:
  'RESOLVED_PERIOD', start: {iso_date, matched_text, resolution,
  start, end}, end: {…} }` where `start`/`end` are ORIGINAL-QUOTE
  UTF-16 offsets per endpoint (audit M-1: `buildPartOriginalClaim`
  needs them to mint the evidence sub-spans; `indexOf` is ambiguous),
  each verified `quote.slice(start, end) === matched_text` before
  returning; EITHER endpoint failing → one typed ABSTAIN
  `PERIOD_ENDPOINT_UNRESOLVED` (carrying which leg) — never a
  one-legged period.

### 7c. Resolver wiring for C4/C5

- **Defined-date pre-pass** (deterministic, order-independent;
  audit minor 4: scoped per `resolveCandidates` invocation = per deal
  document — the function enforces one document_hash/governed_deal_key,
  so cross-deal bleed is structurally impossible; the pre-pass skips
  `ok !== true` entries and `proposal_kind === 'OPEN_WORLD'` entries,
  the line-1578 precedent): before
  qualifier dispatch, scan every `QUALIFIER_CLAIM_KEY` candidate's
  quote; each definition-shaped resolution contributes
  `term → iso_date`. Two DIFFERENT ISO dates for one term → the term
  is marked CONFLICTED (references abstain `DEFINED_DATE_CONFLICT` →
  open world with the parse reason, via the existing
  `TEMPORAL_MEASUREMENT_DATE_UNRESOLVED` push); identical duplicates
  (Modiv's three definition rows) collapse harmlessly.
- The TEMPORAL branch of `resolveQualifierPart` passes `defined_dates`
  into `parseMeasurementDate`, and on a PERIOD occurrence calls
  `parseMeasurementPeriod` and mints **TWO claims** from the one
  candidate — each with evidence narrowed to its own endpoint's
  byte-verified sub-span (the `buildPartOriginalClaim` SPLIT
  machinery, UTF-16→byte conversion included), distinct ordinals,
  and attributes below. Never a composite value.
- **Attributes (governed, participating in claim identity):**
  - definition claims: `date_role: 'DATE_DEFINITION'`,
    `defined_term: '<term>'`;
  - deal-defined references: `date_role: 'DATE_REFERENCE'`,
    `defined_term`, `measurement_date_resolution:
    'SYMBOLIC_DEAL_DEFINED'`;
  - period endpoint claims: `date_role: 'DATE_REFERENCE'`,
    `period_role: 'PERIOD_START' | 'PERIOD_END'`, plus
    `defined_term` where the endpoint is deal-defined;
  - **plain calendar/agreement-date claims mint NO `date_role`** —
    their output stays byte-identical to today (additivity pin).
  Period pairing is recoverable via shared subject + section +
  adjacent ordinals; a dedicated pairing key is out of scope.
- The existing `enrichment_state: 'UNENRICHED'` /
  `comparability: 'NOT_COMPARABLE'` marks apply to every date claim
  minted here, unchanged.
- The TEMPORAL table entry is already position-agnostic — C4/C5 need
  ZERO table changes; CHAPEAU (Skechers `f049b204…`, `e202b9e1…`,
  `5c3b20d6…`) and ITEM (everything else) both already map.

## 8. Materiality

No new tier, no override-map entries. Both new claim definitions and
all C4/C5 date claims live under `REP-T-CAP` → prefix match →
`REPRESENTATIONS`, rank 55. Rationale: these are qualifier facts ABOUT
representations (which exceptions are scheduled; on what assumptions a
number rests; as of when it speaks) — not cap-structure numbers, so the
P1 `CAPITAL_STRUCTURE` override map (`CAPITALIZATION_SHARE_COUNT`,
`RESERVED_SHARE_POOL` only) is untouched, and the five mapping-null
call sites stay concept-based per P1's own pin.

## 9. Coverage map (literal committed fixture bytes; quotes verified
against the three `resolution.json` files 2026-08-02)

Every quote below is the byte-exact `raw_value` of the named
`open_world` row. Replay = re-running candidate resolution over the
committed compiled candidates under the P2 code.

### CONVERTS ON REPLAY — DISCLOSURE_SCHEDULE_CARVEOUT (Modiv)

| closure_id (full) | position | quote | canonical_value |
|---|---|---|---|
| `72cf145f2bd6e4c7953871d74f8b7223fa873b6129e77d9d3ab534266aee9b8e` | ITEM | "except as set forth in Section 3.2(b) of the Company Disclosure Letter" | `3.2(b)@DISCLOSURE_LETTER` |
| `cc9b6dd956a8836a5dde90669108d1316be56ad4735ab6af476faec18e24bdae` | CHAPEAU | "except as set forth in Section 3.2(c) of the Company Disclosure Letter" | `3.2(c)@DISCLOSURE_LETTER` |
| `1f5fe703f428c497beff9cb4139240e8f5a24b1e576e7a793404d1dd57a2f783` | ITEM | "Except as set forth in Section 3.2(c) of the Company Disclosure Letter" | `3.2(c)@DISCLOSURE_LETTER` |
| `5e4759d89d18db01f24f14c6b6a059cbc4e23ed0385bc2ccf406206c208e3ffc` | ITEM | "Except as set forth in Section 3.2(f) of the Company Disclosure Letter" | `3.2(f)@DISCLOSURE_LETTER` |
| `8f47f5256ee0ca2651c0d224822e86b4d8b2c7696b3fb4127fba4727d8a31901` | ITEM | "Except as set forth in Section 3.2(f) of the Company Disclosure Letter" | `3.2(f)@DISCLOSURE_LETTER` |

### ROUTES TO REVIEW ON REPLAY — carve-out doubt, typed `DISCLOSURE_CARVEOUT_PARTIAL` (Modiv)

| closure_id | quote (abridged for the table only; tests use full bytes) |
|---|---|
| `a7e0b0788330cc18…` | "Except as provided in Section 3.2(f) and except as set forth in Section 3.2(d) of the Company Disclosure Letter" |
| `af9d471091f10ad0…` | "Except (i) pursuant to the Company Charter, … and (iv) as set forth in Section 3.2(d) of the Company Disclosure Letter," |
| `eafc21cab5c139a9…` | "Except as set forth in Section 3.2(e) of the Company Disclosure Letter and for transfer restrictions in the organizational documents …" |
| `1c3a8c1e70f50080…` | "Except as provided above or as set forth in Section 3.2(f) of the Company Disclosure Letter, and Preferred Partnership Units" |

### CONVERTS ON REPLAY — C5 DATE_DEFINITION

| deal / closure_id | quote | value + attributes |
|---|---|---|
| Skechers `f049b2040d9581d3…` (CHAPEAU) | "As of 5:00 p.m., Eastern time, on May 2, 2025 (such time and date, the “Capitalization Date”)," | `2025-05-02`, `DATE_DEFINITION`, term `Capitalization Date` |
| Modiv `b750acc821040931…`, `0acab8fc2f015007…`, `b8560c2bce8b7414…` (ITEM ×3) | "As of the close of business on May 1, 2026 (the “Capitalization Date”)" | `2026-05-01`, `DATE_DEFINITION`, term `Capitalization Date` |

### CONVERTS ON REPLAY — C4 DATE_REFERENCE (`SYMBOLIC_DEAL_DEFINED`)

Skechers (`2025-05-02`): `2646a4cfae3ca25d…` (ITEM), `e202b9e174fd0f34…`
(CHAPEAU), `5c3b20d6ee17626a…` (CHAPEAU) — "As of the Capitalization
Date," / "as of the Capitalization Date".
Modiv (`2026-05-01`): `13a45453fa37dffc…`, `127f264e09249307…`,
`43ce03e830216aa5…`, `2d82a869dee00db5…`, `330c78a761c78c0c…` (ITEM) —
"As of the Capitalization Date" / "as of the Capitalization Date".

### CONVERTS ON REPLAY — C4 periods (TWO claims each)

| deal / closure_id | quote | start / end |
|---|---|---|
| Skechers `767fadaf06adf82d…` | "From the Capitalization Date to the date hereof" | `2025-05-02` (PERIOD_START, term) / agreement date (PERIOD_END, "the date hereof") |
| Modiv `524178995a3f4eef…`, `9d8b08bbc937ae44…` | "Since the Capitalization Date through the date hereof" | `2026-05-01` (PERIOD_START, term) / agreement date (PERIOD_END) |

(The agreement-date ISO is asserted from each fixture's own governed
`agreement_date` input at test time, never hard-coded here.)

### CONVERTS ON REPLAY — plain CALENDAR dates unlocked by the AS_OF_BRIDGE (F28, ITEM — audit C-1: these were omitted from the map's first draft and independently discovered by the auditor)

| closure_id | quote | value |
|---|---|---|
| `b6185150ea60d753…` | "as of the close of business on April 17, 2026" | `2026-04-17`, plain CALENDAR — NO date_role (the additivity pin: plain calendar claims mint no role attribute) |
| `565459b0eeab0902…` | "as of the close of business on April 17, 2026" | `2026-04-17`, same |

### CONVERTS ON REPLAY — PERFORMANCE_ASSUMPTION (F28, ITEM)

| closure_id | quote | value |
|---|---|---|
| `a98971817b44a76d2a1f699237bbdba5ea70f651113231acf1628f42f624db19` | "(assuming achievement of the applicable performance goals at the target level)" | `TARGET` |
| `57ac1d2efcf21f7732735574affa74ba582883e0f657a790c672dc609150c08b` | "(including the number of Company Shares assuming achievement of the applicable performance goals at the target level)" | `TARGET` |

### PINNED UNCHANGED (stay open world, byte-identical rows modulo the
section-10 version-field re-pin)

- Skechers `fbc80a360755da22…` "Except as set forth in this Section
  3.7" — agreement-internal cross-reference, no Disclosure anchor:
  neither pattern fires. THE anti-noise pin.
- F28 `751b93616e35a65c…`, `0bc6c5a5ad504099…` "… as set forth in
  Sections ‎3.1(b)(i) and ‎3.1(b)(ii) …" — unanchored agreement
  subsection references (the LITERAL bytes contain U+200E; the tests
  run on them): no fire, unchanged.
- Skechers `54bf50e52f218ef6…`, `9b97ca124cfe6fef…` (PROP-65
  open-world PROPOSITIONS): `proposal_kind === 'OPEN_WORLD'` never
  reaches resolution — convert only on the documented fresh live run.
- Limb-assertion rows containing promoted phrases: Modiv
  `363955ceb0636483…`, Skechers `63fe36fd11e76922…`,
  `06ad88a3383c60ff…`, F28 `74e9251cd9eb4860…`, `22593b534fa9d443…` —
  structure, not qualifiers; remain open world.

## 10. Acceptance tests (numbered; real-fixture-first)

1. **Lexicon front door:** every coverage-map carve-out quote (full
   committed bytes) classifies `DISCLOSURE_SCHEDULE_CARVEOUT` with its
   recorded `THRESHOLD` hint (legacy-hint abstention); the four Modiv
   mixed quotes → REVIEW `DISCLOSURE_CARVEOUT_PARTIAL`; anti-noise:
   Skechers "this Section 3.7", both F28 unanchored quotes (literal
   U+200E bytes), "except as set forth in the Disclosure Letter"
   (whole-letter, no citation) all NON-fires with v1-identical
   outcomes; ACCURACY hint on a pure carve-out quote → REVIEW;
   `modelKind: 'DISCLOSURE_SCHEDULE_CARVEOUT'` with no signal →
   REVIEW `DISCLOSURE_CARVEOUT_UNCORROBORATED`.
2. **Lexicon v1 regression:** the ENTIRE existing
   `canonical-v2-qualifier-kind-lexicon.test.js` suite passes with
   exactly two edits, both named here in advance: the four-family enum
   pin becomes six, and nothing else — in particular the hostless
   no-op test (line 323) and hostless-doubt test (line 311) pass
   VERBATIM.
3. **PERFORMANCE_ASSUMPTION:** both F28 quotes classify with THRESHOLD
   hints and derive `TARGET`; a synthetic "at maximum levels" quote
   (Skechers proposition text) derives `MAXIMUM`; a quote carrying
   both levels → open world
   `PERFORMANCE_ASSUMPTION_LEVEL_UNDERIVABLE`; anti-noise: "assuming
   the accuracy of the representations and warranties" does NOT fire;
   a co-fire with a legacy THRESHOLD marker routes open world; with
   ACCURACY → REVIEW.
4. **Pointer parser:** table-driven over the five converting Modiv
   quotes (exact `canonical_value` incl. suffix), the four mixed
   quotes (typed abstains), multi-citation "Sections 3.2(a) and
   3.2(b) of the Company Disclosure Letter" →
   `MULTIPLE_SCHEDULE_CITATIONS`, whole-letter →
   `NOT_A_PURE_CARVEOUT_CLAUSE`; every RESOLVED value round-trips the
   `SCHEDULE_REFERENCE_STRING` regex.
5. **Three-place lockstep:** one shared accept/reject vector
   (`3.2(f)`, `3.1(b)(ii)@DISCLOSURE_LETTER`, `3.2(f)@DISCLOSURE_LETTER`
   accepted; `3.2(f)@OTHER`, `III-INTRO(b)`, `Section 3.2(f)`, empty
   string, `3.2(f) @DISCLOSURE_LETTER` rejected) asserted IDENTICAL at
   the fixture-shape validator (via a V15 definition), both
   `canonicalValueAllowed` copies.
6. **Registry:** V15 compiles; V14 arrays byte-identical; both new
   definitions validate — the enum one with ZERO validator changes,
   the typed one exercising exactly the one whitelist addition.
7. **Date machinery:** bridge grammar fires on both C5 byte-forms and
   refuses "as of a recent date" / "as of the close of the offer";
   definition detection captures `Capitalization Date` from both
   parenthetical forms and ignores a non-Date defined term; symbolic
   reference resolves via `defined_dates` and abstains
   `DEFINED_DATE_UNRESOLVED` / `DEFINED_DATE_CONFLICT` correctly;
   period parse yields both legs on the two fixture period forms and
   abstains `PERIOD_ENDPOINT_UNRESOLVED` when one endpoint is "the
   Closing Date" (still ungoverned).
8. **Resolution replay, full fixtures:** re-running resolution over
   each committed fixture's compiled candidates yields EXACTLY the
   coverage map — every listed closure_id leaves `open_world` for its
   stated destination (resolved claim with exact canonical value and
   attributes, or review with its typed reason), the period rows mint
   two claims each with byte-verified endpoint evidence sub-spans and
   distinct ordinals, and EVERY row not listed is byte-identical
   modulo the re-pinned version fields. TRAILING carve-out (synthetic)
   → REVIEW `CARVEOUT_POSITION_UNMAPPED`; a synthetic future-kind
   table entry still lands in `UNSUPPORTED_QUALIFIER_KIND_MAPPING`.
9. **Additivity, restated honestly (the P1 M-1 convention; completed
   per audit M-3):** with no P2-shaped input, resolution output is
   byte-identical EXCEPT: receipt-level `mapping_table_version` (5),
   `qualifier_kind_lexicon_version` (2), `contract_vocabulary_digest`
   (V15), `measurement_date_parse_version` (2),
   `schedule_reference_parse_version` (new); PER-CLAIM
   `attributes.answer_provenance.pins.{mapping_table_version,
   qualifier_kind_lexicon_version}` on every resolved qualifier claim
   — which cascades to fresh `claim_revision_id`s and the
   `review_queue[].claim_revision_id` references; and every recomputed
   `resolution_receipt_id`. Documented in the PR as a field-level
   diff. Skipping the bumps to keep old pins green is the named
   anti-pattern.
10. **Ruling corpus:** no committed ruling matches any P2 fixture
    phrase (asserted); a synthetic v1-era THRESHOLD ruling on a pure
    carve-out phrase → `RULING_LEXICON_CONFLICT` → REVIEW.
11. **Write path:** one resolved carve-out claim (ITEM), one
    PERFORMANCE_VESTING_ASSUMPTION claim, and one period pair travel
    adapter → validate-write-set → publishable write set;
    validate-write-set accepts the pointer value ONLY via the new
    branch (a deliberately malformed `3.2(f)@OTHER` is rejected).
12. Full suite + build + forbidden-patterns; phase allowlist for the
    slice's files; quote verification stays at zero flags.

## 11. Out of scope

- Whole-letter (citation-less) carve-out banking — future bare
  `@DISCLOSURE_LETTER` value-grammar extension, flagged for Ben.
- Multi-citation carve-outs as multiple claims (they REVIEW this
  slice); a split rule waits for corpus evidence.
- C7 (securities-law transfer carve-out): pinned in the program spec
  as a THRESHOLD-family concept, P3 — explicitly NOT a
  `DISCLOSURE_SCHEDULE_CARVEOUT` sibling.
- Deal-defined date terms beyond `the Capitalization Date`; governed
  sources for "the Closing Date" / "the Effective Time" (the
  measurement-date-parse v1 DEVIATION stands).
- A period pairing key; cross-deal schedule-reference analytics; any
  serving-projection/market-metric work on the new values.
- The producer-prompt/provider changes' golden-eval reshape: recorded
  responses are never hand-edited; the three fresh live runs
  (subscription CLI, one per deal, after the single PROMPT_VERSION
  bump) are each their own dated handoff, and ONLY then may
  PROP-65's Skechers propositions be claimed converted.
- P4's suffix-less pointer emitters.

## 12. Known costs (eyes open, for Ben's PR read)

1. **Review load:** the four Modiv mixed carve-outs land in review per
   deal-family; that is Ben's C3+C6 identity-bearing ruling working as
   intended, but it is new human work (~4 items on this corpus).
2. **Enum-pin churn:** `QUALIFIER_KINDS` growing to six touches every
   consumer that pinned four; the audit should hunt for un-listed
   pins beyond the one named test.
3. **Legacy-hint abstention** is a real loosening of the
   disagreement rule, permanent by design (section 6 item 3). If a
   post-P2 live model starts labeling genuine thresholds over quotes
   that also full-match a new-kind grammar, the grammars — not the
   routing — are the defense; the fresh-run handoffs must eyeball
   this.
4. **Lexicon version bump** re-dates the ruling-corpus baseline: new
   rulings record v2; v1 rulings stay valid but now conflict-check
   against a six-kind classifier.
5. **The defined-date map is run-scoped:** a reference in a deal whose
   definition quote failed extraction abstains to open world — recall
   there depends on the producer, not this slice.
6. **P2 queues behind the lexical-net merge and P1** (same files:
   `candidate-resolution.js`, `contract-bundle.js`); rebase hazards
   are known and the additivity pins are the tripwire.
