# Diagnostic: NATIVE_OPEN_WORLD_PROPOSAL characterisation

Status: IN PROGRESS
Branch: origin/cursor/step-2x-free-phase-b641
Started: 2026-08-09

## Task
Characterise the 1,147 NATIVE_OPEN_WORLD_PROPOSAL occurrences (27% of 4,241 reason-code
occurrences). Taxonomy, recoverability, promotion backlog (3+ deal recurrence), duplicate check.

## Log

- Fetching branch and locating evidence directory.

## Method

- Fetched `origin/cursor/step-2x-free-phase-b641`. Corpus source of truth for
  "the corpus" (not every resolution.json under evidence/canonical-v2, which
  includes superseded `-r1` drafts and one-off experiment runs like
  `modiv-closing-conditions-6.1-only`) is `corpus-review-20260809.html`,
  parsed with node (regex over its `<article class="card">` / `<li
  data-state>` structure; 4,141 cards / 4,142 claim rows). That HTML uses
  exactly 151 `resolution.json` runs (7 deals x up to 25 families; modiv only
  has 10 families in this corpus, the rest not yet run). Confirmed against
  the reason-code tally: NATIVE_OPEN_WORLD_PROPOSAL = 1,147 occurrences
  exactly, matching the brief.
- Pulled full `open_world` arrays from all 151 `resolution.json` files
  (`git show <branch>:evidence/canonical-v2/<run>/resolution.json`),
  filtered to `reason` containing `NATIVE_OPEN_WORLD_PROPOSAL` -> 1,147
  records, each with `raw_value`, `attributes.why_unmapped`,
  `attributes.nearest_concept`, evidence span (`excerpt_id`,
  `absolute_start/end` — byte offsets, used as-is, no UTF-16 conversion
  needed since both sides of every comparison are the same byte-offset
  field), `section_reference`, `family` (derived from run-id filename
  against the HTML's 24-family select list), `deal`.
- Family assignment verified: 0 records failed to map to a family.

## CRITICAL MID-TASK FINDING (per coordinator instruction, investigated before finishing)

Coordinator flagged a hypothesized routing bug from Step 2X-L (commit
`501e2d26`, "mint REPRESENTATIONS limb assertions from recorded limbs
(UNREVIEWED)"), and gave two worked examples: card #936 (concho §4.11,
reason `UNMAPPED_GENERIC_CLAIM_KEY`, kind
`NATIVE_CAPITALISATION_LIMB_ASSERTION_CANDIDATE`, text = an employment-law
compliance rep) as the "obvious defect" case, and card #470 (concho §6.2,
text = `other than in immaterial respects`) as the fragment case.

**Checked: is this inside my scoped 1,147 (reason=NATIVE_OPEN_WORLD_PROPOSAL)?**
No. Every one of the 1,147 has `claim_definition_key ==
'OPEN_WORLD_PROPOSITION'` uniformly — zero variation. Card #936 carries a
*different* reason code, `UNMAPPED_GENERIC_CLAIM_KEY` (713 occurrences
corpus-wide, all state=OPEN_WORLD, a sibling class one tier below
NATIVE_OPEN_WORLD_PROPOSAL in size). The two reason codes are disjoint
populations under the same OPEN_WORLD display state. This distinction
matters for the numbers below and is preserved throughout.

**Checked: does `NATIVE_CAPITALISATION_LIMB_ASSERTION_CANDIDATE` dominate
UNMAPPED_GENERIC_CLAIM_KEY regardless of subject matter?** Yes, overwhelmingly:
707 of 713 (99.2%) carry that one kind label. Only 4 are
`NATIVE_FRAUD_CARVEOUT_CANDIDATE` and 1 each of two others. Keyword-scanned
the 707 raw_value texts: 71 employment, 40 IP, 38 tax/ERISA, 36 litigation,
22 environmental, only 30 are actually about capitalisation/cap-table, 470
"other" (mostly other REPRESENTATIONS subject matter — insurance, real
property, regulatory status, etc.). Spans 6 of 7 deals (concho, metsera,
redhat, skechers, skywater, topbuild — not modiv, which has no
`representations-r*` runs in this corpus).

**Root cause, read from code, not comment claims**: this is not an
accidental mislabel — it is documented, deliberate deferral. Header comment
at `lib/canonical-v2/native-producer/anthropic-provider.js:20-30`: "This is
NOT legal classification: every response produces the same bucket structure
regardless of content, so there is no judgment call about which real
production claim type a proposition belongs to. That reconciliation is
deliberately left to a later stage. Limb-assertion proposals
(LIMB_ASSERTION_CLAIM_KEY) are minted by BOTH the CAPITALISATION shaper ...
and the REPRESENTATIONS shaper." The "later stage" resolver-side
reconciliation by actual subject matter for REPRESENTATIONS limb assertions
does not yet exist (or is incomplete) — hence `UNMAPPED_GENERIC_CLAIM_KEY`
for nearly all of them.

**Pre/post 2X-L check**: commit `501e2d26` says "That array [
limb_component_trees] has been empty in 202 of 202 runs on this branch, so a
non-empty one is the whole point of the step." In the current 151-run
corpus, `limb_component_trees` is non-empty in only 17/151 runs — i.e. this
shaper path is only live in a minority of runs so far. If the resolver-side
reconciliation isn't built before the shaper rolls out further, this 707
count will grow, not shrink, as more REPRESENTATIONS runs pick it up.

**This is the single highest-leverage finding in this diagnostic**: fixing
resolver-side reconciliation of `LIMB_ASSERTION_CLAIM_KEY` by actual subject
matter (route employment-shaped limbs to EMPLOYEE_MATTERS-style governed
concepts, tax-shaped to TAX_MATTERS, etc., instead of leaving all of them
generically unmapped) could resolve most of these 707 — nearly all are
"obvious" under the owner's one-phrase test (see below). It sits outside my
scoped 1,147 (different reason code) but the owner explicitly asked it be
investigated and reported. Not itself replay-validatable without a resolver
change; is a resolver/shaper fix, not a taxonomy/enum-widening problem.

## Three-way split (coordinator's reframe), applied to the scoped 1,147

Test used for "obvious" = NOT fragment-shaped (see fragment test below) AND
NOT a duplicate of an already-resolved claim in the same run.

| Bucket | Count | % | What it means |
|---|---|---|---|
| FRAGMENT (structural, needs host reattachment) | 762 | 66.4% | starts lowercase, or opens with other than/except/provided/(/subject to, or <60 bytes |
| DUPLICATE (inflation, not new content) | 106 | 9.2% | 77 span/text-overlap with a resolved claim same run + 29 identical-text self-duplicates within open_world same run |
| OBVIOUS DEFECT (nameable in one phrase, should have resolved) | 218 | 19.0% | complete, standalone clause; maps to a named concept recurring across deals, or the extractor's own why_unmapped says "no controlled bucket for X" |
| GENUINELY UNUSUAL / boilerplate (correctly open-world) | 61 | 5.3% | complete clause but truly miscellaneous/procedural (counterparts, no-third-party-beneficiary, severability, waiver mechanics) — no lawyer extracts these as deal facts |

Sum = 1,147. (Note: REPRESENTATIONS-family free-text entries whose
`why_unmapped` explicitly says "this first slice [of REPRESENTATIONS] only
captures accuracy/knowledge qualifiers" (127 of 370 REPRESENTATIONS
entries mention "first slice") are folded into OBVIOUS DEFECT when the
content is a complete, nameable clause (e.g. "no Company Plan provides
retiree ... medical" -> textbook ERISA rep) and into FRAGMENT when it's a
lettered-limb continuation that lost its "the Company represents that:"
chapeau.)

## Fragment tests used (byte length via Buffer.byteLength, UTF-8-correct)

- under 60 bytes: 169/1,147 = 14.7%
- starts with lowercase letter (mid-sentence continuation marker): 709/1,147 = 61.8% — the single strongest signal
- starts with "other than": 40 (3.5%); "except": 87 (7.6%); "provided that/however": 15 (1.3%); "(" (parenthetical/cross-ref): 70 (6.1%); "subject to": 10 (0.9%)
- combined (any of: <60 bytes, starts lowercase, or starts with one of the above prefixes): 762/1,147 = 66.4%

Owner-flagged examples both confirmed present verbatim in the corpus:
- `other than in immaterial respects` (concho, INTERIM_OPERATING §6.2) — 35 bytes, exact match.
- The `(No Solicitation by Parent)` example: found as the tail of a longer
  clause in concho TERMINATION §8.1: "...the obligations set forth in
  Section 6.4(b) (No Solicitation by Parent)" — a cross-referenced section
  name embedded in a longer sentence, same phenomenon the owner described,
  though not literally a standalone entry in this corpus (searched all 151
  runs' full open_world arrays, not just the 1,147, for "No Solicitation" —
  one hit).

Fragment concentration by family (startsLower% is the strongest per-family
signal, consistent with "chapeau + lettered limbs" families dominating):
MATERIAL_CONTRACTS 100%, KEY_DEFINED_TERMS 91%, INTERIM_OPERATING 91%,
TERMINATION 85%, NO_SHOP 77%, REPRESENTATIONS 71%, DNO_INDEMNIFICATION 64%
— vs. CONSIDERATION 43%, TAX_MATTERS 0%, MISC_BOILERPLATE 17%,
SPECIFIC_PERFORMANCE_REMEDIES 0%. This confirms the CLAUDE.md-stated
structural-depth pattern from the other side.

## Duplicate check detail

- Span/excerpt overlap with a resolved claim's evidence span in the same
  run: 7 (strict, unambiguous).
- Text-containment against a resolved claim's citation_context quote in the
  same run (normalized, case/punctuation-insensitive, min 40-char overlap
  to avoid false hits on short generic phrases like "Company Material
  Adverse Effect"): 70 more.
- Total cross-checked-against-resolved duplicates: 77 (6.7%).
- Additional self-duplicates: identical raw_value text appearing twice+ in
  the SAME run's open_world array itself (not cross-checked against
  resolved): 29 (2.5%).
- Combined duplicate/inflation total: 106 of 1,147 (9.2%). The real count of
  distinct open-world facts is closer to 1,041.

## Concept clustering (from the extractor's own `why_unmapped` field)

582 of 1,147 (50.7%) carry a colon-prefixed category label the extractor
itself assigned (e.g. "LENDER_ARRANGEMENT: Parent selects and retains..."),
53 distinct labels. Grouped by label + counted distinct deals per label —
this is the direct evidence base for the promotion rule (concept in 3+
deals, not a percentage).

21 distinct concepts recur in >=3 deals (146 occurrences); another handful
recur in exactly 2 deals (not yet promotable under the stated rule). Full
list with deal names captured in scratch script output; top candidates
below in the final report.

## Numbers reconciliation

1,147 = 762 (fragment) + 106 (duplicate) + 146 (labeled cluster, >=3 deals)
+ 21 (labeled cluster, <3 deals) + 24 (explicit enum-gap language, no
cross-deal label) + 88 (other free text, no cross-deal label — 27 of which
are REPRESENTATIONS "first slice" scope-gap complete clauses, 61 of which
are genuinely miscellaneous/boilerplate). Buckets are mutually exclusive,
computed in that priority order (dup -> selfdup -> fragment -> labeled ->
enumgap -> freetext).

## Recoverable total by fix type

- Structural attachment (resolver-side, free, replay-validatable — reattach
  lettered limbs / mid-clause exceptions to their parent chapeau before
  classification): 762 (66.4%) — largest lever, and per coordinator's
  reframe, necessary-but-not-always-sufficient: for REPRESENTATIONS
  specifically, many reattached limbs would STILL need a wider governed
  vocabulary since the "first slice" only governs accuracy/knowledge
  qualifiers today.
- Dedup fix (resolver logic, free, replay-validatable): 106 (9.2%).
- Wider enum / prompt change (digest invalidation) — the promotion backlog,
  concepts in >=3 deals: 146 occurrences / 21 concepts (12.7%).
- Vocabulary addition / uncertain (extractor already says "no controlled
  bucket", but <3-deal recurrence so not yet promotable under the rule):
  24 + 21 = 45 (3.9%) — track, don't promote yet.
- Resolver reconciliation for LIMB_ASSERTION_CLAIM_KEY by subject (sibling
  reason code, outside the 1,147 but same root family): up to 707 more,
  pending code fix, not counted in the 1,147 total above.
- Nothing / correctly open-world: 61 (5.3%).

## Promotion backlog (>=3 deals, ranked by deal count then obviousness)

See final report for the named list with quotes — computed from
`why_unmapped` prefix clustering, deal counts verified against the full
(pre-fragment-filter) population so a concept's deal count reflects ALL its
instances, not just the non-fragment ones.

## Status: COMPLETE — final report delivered in conversation response.
