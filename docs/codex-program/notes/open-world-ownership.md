# Open-world ownership: classifying and fixing the 119 unowned candidates

Scope: the review at `docs/codex-program/notes/all-families-aggregate-review.md` found
that the fix plan in `all-families-aggregate.md` wrote fixes for at most 74 of the 193
open-world candidates across the 25-family Modiv sweep, leaving 119 with no owner. This
note classifies all 193 (not just the 119), reports which mechanism produced each one,
implements the ones that are genuinely mechanical in the files this task owns
(`lib/canonical-v2/native-producer/anthropic-provider.js` and family vocabulary modules
outside `lib/canonical-v2/native-producer/candidate-resolution.js`), and specifies the
rest precisely for either the candidate-resolution.js owner or Ben.

Every count below is read directly from `evidence/canonical-v2/modiv-*-20260806/resolution.json`
and `evidence/canonical-v2/topbuild-mae-definition-20260806/resolution.json`, or produced by
replaying the real, committed `run-receipt.json` for each family through the real,
unmodified `resolveCandidates()` (never a live model call). The replay harness and the
per-family JSON dumps this note is built from are throwaway scripts under `/tmp`, never
added to the repository.

## 0. A correction to my own working method, up front

Three prior findings in this repo's history were retracted because a probe compared a
JavaScript string index (`indexOf`/`slice`, which count UTF-16 code units) against a
UTF-8 byte offset. Every claim below that cites a byte range was produced by rebuilding
the canonical text from the pinned fixture
(`tests/fixtures/canonical-v2/mae-definition-family/modiv-raw-fetched.htm`, independently
re-verified against `evidence/canonical-v2/*/source-reference.json`'s
`canonical_text_sha256`) and converting any character index into a byte offset with the
codebase's own established idiom, `Buffer.byteLength(text.slice(0, charIndex), 'utf8')`
, the same one-line pattern independently reimplemented as `charToByteOffset`
(`deterministic-sectionizer.js:340`), `utf16OffsetToByteOffset`
(`candidate-resolution.js:1615`) and `charIndexToByteOffset`
(`lexical-disagreement-net.js:987`), and, wherever a byte range needed to be read back
out as text, `utf8Slice` from `lib/canonical-v2/canonical-bytes.js`. Section 3 (the
KEY_DEFINED_TERMS section-mapping finding) and section 5 (the material-contracts chapeau
finding) both depend on this and were cross-checked against the real, deterministic
sectionizer (`sectionizeAdmittedSource`, no model call) rather than asserted from a
manual byte count.

## 1. Headline: mechanism x count x families

| # | Mechanism | Count | Families | Mine to fix? |
|---|---|---|---|---|
| 1 | Stale compiled contract version: the resolver dispatch table and claim definitions already exist (built and tested through V38) but the live runner still calls `compileFixtureContractV34()` | 11 | ANTITRUST_REGULATORY | No (fix site is `scripts/canonical-v2-live-extraction-run.mjs`, not owned), fully diagnosed, verified safe by replay, unapplied diff given |
| 2 | Corroboration synonym/regex list too narrow, in `lib/taxonomy.js`, driving a generic check in `candidate-resolution.js` | 10 | MATERIAL_CONTRACTS | **Yes, implemented and verified unblocked** (7 of 10 bucket codes) |
| 3 | Corroboration regex too narrow, hardcoded inside `candidate-resolution.js` itself (not vocabulary-driven, so not fixable by widening a file this task owns) | 5 | TAX_MATTERS | No, precisely diagnosed, unapplied diff given |
| 4 | Chapeau/limb structural defect: a check requires a word (`"any"`, a Code-section citation) inside the candidate's own narrowed quote, when the word lives once in a shared chapeau/definition the prompt correctly does not repeat | 12 | MATERIAL_CONTRACTS (9), TAX_MATTERS (3, medium confidence) | No, same defect class the review already proved for MAE/MEETING_REF/TERMINATING_PARTY_REF; unapplied diff given |
| 5 | Party-side keyword lexicon missing an entity: two independent, duplicate keyword lists (one in `anthropic-provider.js`, one in `candidate-resolution.js`) both need the same new word | 3 | REPRESENTATIONS | **Half mine, implemented** (`anthropic-provider.js`); companion half specified for `candidate-resolution.js`, verified by patch-and-replay to be necessary but not sufficient alone |
| 6 | Section-mapping gap: the family was pointed at the section whose heading merely contains a matching word, not the section holding its schema's real target content | 15 | KEY_DEFINED_TERMS | No, needs a live re-run (barred) and a runner-script section-list change (not owned); fully diagnosed and evidenced with the deterministic sectionizer, no live call |
| 7 | Deliberate, documented design: an "evidence-only mechanics" bucket the family's own prompt instructions say is not a governed legal code | 16 | DNO_INDEMNIFICATION (7), EMPLOYEE_MATTERS (3), TERMINATION (6) | **No fix, confirmed correct as designed**, checked against V1's own field granularity |
| 8 | Deliberate, documented design: a named spec decision that only ACCURACY is identity-bearing; KNOWLEDGE/TEMPORAL/THRESHOLD doubt is defined to route to open world | 7 | REPRESENTATIONS | **No fix, confirmed correct as designed**, corrects the plan's speculative framing |
| 9 | Spec/implementation gap: the qualifier-kind lexicon's own documented routing rule (ACCURACY-touching doubt reaches human review) is not wired into the caller, which sends it to open world instead | 9 | REPRESENTATIONS | No (`candidate-resolution.js`), precisely diagnosed by running the real classifier against all 9 quotes; unapplied diff given |
| 10 | Canonical value/claim type genuinely never built, at any layer, for an assertion kind the prompt is already allowed to emit | 4 | PROXY_MEETING | No, real design work (new claim definitions + resolver dispatch); precisely specified for Ben |
| 11 | V1 has a named, described, aliased provision type; V2 has never ported it (the family's `RESPONSE_LISTS` entry is `open_world_candidates` only, at every contract-bundle version through V38); porting requires new claim definitions and resolver dispatch, not a synonym edit | 20 | CONSIDERATION (18), FINANCING_COVENANTS (2) | No, real design work; precisely specified, including a correction to the plan's proposed V1 anchor for consideration |
| 12 | REIT-specific tax/dividend content forced into an assertion kind built for a different concept, because neither family has a REIT-status-maintenance concept | 3 | TAX_MATTERS (2), DIVIDENDS (1) | No, legal-judgement call (new concept), flagged as a cross-family pattern worth Ben's attention |
| 13 | One resolver check contradicts its own parser module's documented intent (hour-denominated NOTICE periods routed to open world when the parser's own comment says "routed to review, forever") | 1 | NO_SHOP | No (`candidate-resolution.js`), precisely diagnosed; unapplied diff given |
| 14 | Corroboration check reuses a V1 display-naming field (`lib/rubric.js`'s `CODES[code].label`/`.aliases`) as if it were an operative-text lexicon; will almost never match ordinary operative drafting, which doesn't restate its own section's display title | 11 | GENERAL_COVENANTS | No (`candidate-resolution.js`), precisely diagnosed; deliberately did not "fix" this by padding `rubric.js`'s aliases, since that field is reused elsewhere in V1 |
| 15 | Narrow, deal-specific procedural fact with no V1 precedent and no honest existing governed slot; forcing a mapping would be a legal-judgement call, not a mechanical one | 64 | NO_SHOP (8), PROXY_MEETING (4), TERMINATION (7), TERMINATION_FEE (20), MERGER_STRUCTURE_CLOSING (3), REPRESENTATIONS (9), MATERIAL_CONTRACTS (7), DIVIDENDS (2), TAX_MATTERS (1), CONSIDERATION (2), GENERAL_COVENANTS (1) | No, left unmapped on purpose; see section 8 |
|, | MAE_DEFINITION's 2 items are REPRESENTATIONS-shaped content (an ACCURACY qualifier on TopBuild's Organization/Standing rep) surfacing inside a different family's section scope; not a MAE_DEFINITION gap at all | 2 | MAE_DEFINITION | No fix needed within this family |

Total: 11+10+5+12+3+15+16+7+9+4+20+3+1+11+64+2 = 193, reconciled against the per-family
census in section 9 (also 193) and independently against
`evidence/canonical-v2/*/resolution.json`'s own `open_world.length` for all 17 families
with any open-world output. Two rows were added after this table's first draft, once
found in the course of fully classifying every item as instructed (row 14, general
covenants; `FINANCING_COVENANTS` folded into row 11), an early draft of this table
summed to 190, not 193, and the discrepancy itself led to catching both a missing family
row and (separately, in section 4) a real regex bug, described in section 4.1.

Of the three mechanisms the brief named in advance, all three are confirmed present
(rows 11, 2, and, for antitrust, a variant of "canonical value outside its enum" that
turned out to be a version-staleness bug rather than a missing enum value, row 1). Five
more mechanisms were found that the brief's menu did not name: a stale contract-version
pin (1), a resolver check reading the wrong vocabulary source (3), the chapeau/limb
structural defect recurring a fourth time (4), a spec-vs-implementation wiring gap (9),
and a section-mapping error (6).

## 2. Antitrust: all 11 are one bug, fully verified, not mine to apply

All 11 of ANTITRUST_REGULATORY's open-world items share one `claim_definition_key`
(`NATIVE_REGULATORY_EFFORTS_CANDIDATE`) and one reason (`CANONICAL_VALUE_OUT_OF_ENUM`),
across three `assertion_kind`s: `NOTIFICATION_OBLIGATION` (6), `INFORMATION_SHARING_OBLIGATION`
(3), `COOPERATION_OBLIGATION` (2).

Reading `candidate-resolution.js`'s `handleRegulatoryEffortsCandidate` (read-only) shows
the resolver already has a complete, tested dispatch path for these three kinds:
`REGULATORY_ASSERTION_MAP` (line 2643) maps all three to concept keys and claim
definition keys, and dedicated corroboration blocks exist for each (lines 8098, 8134,
checking `cooperation_scope_ref`/`information_scope_ref`/`notification_event_ref`
against the quote). The gate that actually fires, at line 8071, is a shared check:
`canonicalValueAllowed(vocabulary.claimDefinitions.get(kindMap.definition_key), proposedValue)`.

`contract-bundle.js` defines the three claim definitions
(`REGULATORY_COOPERATION_OBLIGATION`, `REGULATORY_INFORMATION_SHARING_OBLIGATION`,
`REGULATORY_NOTIFICATION_OBLIGATION`, each `allowed_canonical_values: [true]`) inside
`EXPANDED_ANTITRUST_CLAIM_DEFINITIONS_V36`, folded into the vocabulary bundle starting
at `FIXTURE_CONTRACT_INPUT_V36`. The live runner
(`scripts/canonical-v2-live-extraction-run.mjs`, in its "Step 3: LIVE model calls" block)
calls `compileFixtureContractV34()`
, four versions behind the tip, `FIXTURE_CONTRACT_INPUT_V38`. This is not a guess: every
committed `run-manifest.json` in this batch stamps
`"contract_bundle_version": "compileFixtureContractV34"` literally (confirmed for
antitrust, tax-matters, key-defined-terms directly), and `compileFixtureContractV34()`
is `return compileFixtureContract(FIXTURE_CONTRACT_INPUT_V34)`, a hardcoded input, not a
"latest" alias. The antitrust producer prompt's own instructions already say "Do not
emit legacy TIMING_RESTRICTION, ANTI-FOREIGN, or ANTI-INTERIM labels", i.e. the prompt
was already updated for the V36 vocabulary; only the runner's compiled-bundle call was
never bumped.

**Verified by replay**, not estimated: `resolveCandidates()` was called with the real,
committed `run-receipt.json`, an independently-rebuilt `admitted_source_context`
(source hash matches the pin exactly), and `compileFixtureContractV38()` in place of
`compileFixtureContractV34()`. The V34 replay first reproduced the committed baseline
exactly (10 resolved / 22 queued / 11 open world, byte-for-byte reason codes matched), proving the harness is faithful before trusting its output. Under V38:

```
resolved=13  review_queue=33  open_world=0  residuals=0
```

All 11 originally-open-world candidates now have a governed home: 2 resolve outright
(`5.5(a)` and `5.5(g)`, both `COOPERATION_OBLIGATION`), 9 move to `review_queue` pending
the existing scope/event corroboration checks (a correct, safe outcome, these are
genuinely governed candidates that need their `cooperation_scope_ref` /
`information_scope_ref` / `notification_event_ref` verified against the quote, exactly
the same discipline every other regulatory-efforts kind already gets). **Zero
regressions**: every one of the 10 originally-resolved claims is still resolved,
byte-identical, under V38 (checked by signature comparison, not just counts); nothing
that was queued became worse.

**Not implemented.** `scripts/canonical-v2-live-extraction-run.mjs` is not
`candidate-resolution.js`, but it is also not `anthropic-provider.js` or a family
vocabulary module, it is outside this task's explicit file grant, and I judged it safer
to specify the fix than to take a one-line liberty in a shared orchestration script
during a session where another agent is concurrently and substantially editing
`candidate-resolution.js`. The change needed is exactly this:

```diff
--- a/scripts/canonical-v2-live-extraction-run.mjs
+++ b/scripts/canonical-v2-live-extraction-run.mjs
@@
-  const contractBundle = compileFixtureContractV34();
+  const contractBundle = compileFixtureContractV38();
@@
-    contract_bundle_version: 'compileFixtureContractV34',
+    contract_bundle_version: 'compileFixtureContractV38',
```

(and the top-of-file `require('../lib/canonical-v2/contract-bundle')` destructure
changed from `{ compileFixtureContractV34 }` to `{ compileFixtureContractV38 }`; exact
line numbers are not quoted here since another agent is concurrently editing this same
script and they would go stale). `compileFixtureContractV38` is not experimental, `tests/canonical-v2-sole-remedy-resolution.test.js`,
`tests/canonical-v2-ioc-mechanic-resolution.test.js` and
`tests/canonical-v2-contract-bundle-versions.test.js` already exercise it. The
versioning scheme's own header comment
(`lib/canonical-v2/contract-bundle.js:3`, "SPEC-VERSIONED-CONTRACT-2026-07-23") explains
that old versions are kept so *already-reviewed* artifacts stay reproducible forever, not that new runs should stay pinned to an old version. This is the single highest-leverage
fix in this entire task: one line, fully verified safe, unblocks all 11 antitrust items.

## 3. Key defined terms: all 15 are a section-mapping gap, not a vocabulary gap

`family-detection-profiles.js`'s own entry for this family
(`KEY_DEFINED_TERMS: { heading_terms: ['definitions', 'defined terms'], lexical_terms: ['"acquisition proposal"', 'means', 'superior proposal', 'willful breach'] }`)
describes what this family should be reading. The batch instead requested only section
`8.5`, whose real heading (confirmed by `section-location-scan.json` and independently by
re-running the real, unmodified `sectionizeAdmittedSource()` against the pinned canonical
text, no model call) is "Interpretation; Certain Definitions", 3,391 bytes of
construction canons (`"include" means without limitation`, `hereof/herein/hereunder`,
`$ means US dollars`, `days means calendar days`, and so on). The model's own raw
recorded response for this section (`native-producer-recorded-response-8.5.json`) shows
`"defined_term_assertions": []`, it correctly found zero of the substantive facts this
family's schema targets (`ACQ_THRESHOLD`, `SUPERIOR_THRESHOLD`, `WILLFUL_DEFINITION`,
`KNOWLEDGE_STANDARD`, …), because none of them are in section 8.5. All 15 open-world
items are generic `definition_envelopes`, for which `candidate-resolution.js`'s
`handleDefinedTermCandidate` has no promotion path except a 4-term allowlist
(`recordedDefinitionMaps`: tax / tax return / made available / ordinary course) that
none of the 15 hit exactly.

Modiv's real "Superior Proposal" and "Willful and Intentional Breach" definitions, the
exact terms this family's `family-detection-profiles.js` entry names, live in
**Section 8.12, "Definitions"** (bytes 360030, 414712 of the canonical text; confirmed
directly: `"Superior Proposal" means a bona fide written Company Acquisition Proposal…`
at byte 410853, subsection `8.12(nnn)`; `"Willful and Intentional Breach" means…` at byte
414435, subsection `8.12(uuu)`). This is the same section already correctly pinned for
`TERMINATION_FEE` in this deal's `DEAL_PINS` entry
(`default_section_refs_by_family: { TERMINATION_FEE: ['7.1', '7.3', '8.12'] }`, with its
own comment confirming `'8.12' -> SECTION heading /Definitions/i` was verified against
this exact filing before the runner script was first written). `8.12` was never added to
a `default_section_refs_by_family` entry for `KEY_DEFINED_TERMS`, there is none; this
family's `--section-refs 8.5` for this run was passed explicitly, not derived from
`family-detection-profiles.js`'s classifier or any pin.

This is the same *shape* of defect the plan's own section 5 found for GUARANTY_FINANCING_PARTY
(mapped to a section with no relevant content while the real content sat in a section
already scoped to a different family), not the disproved "sectionizer bug" the review
killed for appraisal. It is evidenced entirely by the deterministic sectionizer replaying
against the pinned text; no live call was made or needed.

**Not implemented, for two independent reasons**: (1) fixing it only has effect on a
fresh live extraction run against `8.12`, and this task is barred from live model calls;
(2) the section-reference list lives in `scripts/canonical-v2-live-extraction-run.mjs`'s
`DEAL_PINS`, not in a file this task owns. The 15 committed open-world items themselves
would very likely stay open-world even after the fix, they are correctly-classified,
non-substantive interpretive boilerplate; the fix reveals the family's real yield is
simply *absent* from this evidence set, not hiding inside these 15. Recommended fix,
ready to apply: add `'8.12'` to a new `KEY_DEFINED_TERMS` entry in `modiv`'s
`default_section_refs_by_family` (alongside or instead of `'8.5'`, whether the
construction-canon content in `8.5` is worth also keeping is a five-second call for Ben,
not a technical question), then re-run live.

## 4. Material contracts: two distinct, independently-verified mechanisms

### 4.1 Corroboration synonym list too narrow, implemented in `lib/taxonomy.js`

`materialContractGroundingFailure` in `candidate-resolution.js` (read-only; not edited)
is a thin, generic check: `!(meta.synonyms || []).some((pattern) => pattern.test(quote))`,
where `meta` comes from `MATERIAL_CONTRACT_BUCKET_META[bucketCode]`, imported directly
from `lib/taxonomy.js` (`require('../../taxonomy')`, confirmed at
`candidate-resolution.js:105`). The check is entirely data-driven from a file this task
owns; no candidate-resolution.js change is needed to widen it.

Ten bucket-code pairs in Modiv's `3.17(b)` were checked individually against their real
quotes. Seven fail on a synonym gap that is safe to widen (each hostile-tested against a
plausible false-positive before being added):

| Bucket | Real Modiv text | Why the old synonyms miss | Widening added |
|---|---|---|---|
| `REAL_ESTATE` (x2) | "Space Lease, Ground Lease or Company Lease"; "any real property with a fair market value…" | required literal "real estate" or "lease agreement" | added `space lease`, `ground lease`, `real property` |
| `MA_AGREEMENTS` | "an acquisition, divestiture, merger or similar **transaction**" | required "…agreement" as the tail noun | widened to accept "transaction" and "divestiture" alongside "agreement" |
| `MA_ONGOING_OBLIGATIONS` | "continuing indemnification, guarantee, **'earn-out'** or other contingent payment obligations" | "earn-out", the bucket's own label word, was simply missing from its synonym list | added `earn-?out` |
| `SETTLEMENT` | "the settlement (or proposed settlement) **of** any pending or threatened suit" | required "settlement agreement" as a bigram | added a pattern anchored on "settlement of [a] pending/threatened" dispute |
| `IP_LICENSES_IN` | "**in-bound** licenses" | `inbound\s+licens` requires a closed compound; `\s+` does not match a hyphen | made hyphen-tolerant: `in-?bound` |
| `IP_LICENSES_OUT` | "**out-bound** licenses" | same hyphen gap, mirrored | made hyphen-tolerant: `out-?bound` |
| `AGGREGATE_PAYMENTS` | "payment obligations… in excess of $200,000 **in the** aggregate" | required "aggregate" immediately adjacent to "payment(s)" | added a same-sentence co-occurrence pattern, either word order |

One of these seven went through two iterations, worth recording because it is exactly
the discipline this task's brief asked for: the first `SETTLEMENT` pattern
(`settlement\s+(?:of|\()\s*(?:any\s+)?(?:proposed\s+)?(?:pending|threatened)`) was
verified before writing by testing a hand-typed paraphrase of the Modiv quote, which
passed. Testing it again afterwards against the *actual* `raw_value` string pulled from
`resolution.json`, not the paraphrase, failed: the real drafting has a parenthetical
aside, "the settlement **(or proposed settlement)** of any pending…", so neither
occurrence of the word "settlement" sits the required `\s+` away from "of"/"(" and then
directly into "pending"/"threatened" with nothing else intervening. Caught by the
mandatory replay-against-real-evidence step in section 4.1 below (the item simply never
left `open_world`), not by re-reading the regex. Replaced with a bounded same-sentence
co-occurrence (`settlement` and `pending`/`threatened` within 60 characters, `[^.]`
bounding it to one sentence), re-verified against the real quote, and re-hostile-tested
including against a genuine, unrelated settlement agreement ("a settlement agreement with
a former employee regarding a compensation dispute", no "pending"/"threatened" in the
same sentence, correctly does not match). Every one of the other six widened patterns
in the table above was separately confirmed to match its own real `raw_value` string,
not a paraphrase, after this was found.

Two bucket codes (`NONCOMPETE`, `AFFILIATE_TRANSACTIONS`) fail for a different reason and
were **deliberately not touched**: their Modiv text is purely functional description
("limit…the type of business…or the geographic area", "is with any current executive
officer or director") with no lexical anchor at all, no variant of "non-compete",
"restrictive covenant", "affiliate" or "related party" appears anywhere in the quote. The
model's own classification is very likely correct, but confirming it requires recognising
the *legal effect* of the clause, not a synonym of a term already used, exactly the line
this task's brief draws between mechanical and judgement. Left as an open question for
Ben in section 8.

**Verified by replay**: MATERIAL_CONTRACTS replayed against the real committed
`run-receipt.json` (V34, unrelated to the antitrust version issue) first reproduced the
baseline exactly (5/5/26), confirming the harness, then with the taxonomy.js change in
place (final version, after the `SETTLEMENT` correction above): **10 of the 26
open-world items leave open world**, all 10 landing in `resolved` (none merely moved to
`review_queue`):

```
3.17(b)(ii)   REAL_ESTATE bucket           -> resolved
3.17(b)(v)    MA_AGREEMENTS bucket         -> resolved
3.17(b)(v)    MA_ONGOING_OBLIGATIONS       -> resolved
3.17(b)(vi)   REAL_ESTATE bucket           -> resolved
3.17(b)(vi)   REAL_ESTATE threshold        -> resolved   (this pair is now fully clear)
3.17(b)(viii) SETTLEMENT bucket            -> resolved
3.17(b)(x)    IP_LICENSES_IN bucket        -> resolved
3.17(b)(x)    IP_LICENSES_OUT bucket       -> resolved
3.17(b)(xiii) AGGREGATE_PAYMENTS bucket    -> resolved
3.17(b)(xiii) AGGREGATE_PAYMENTS threshold -> resolved  (this pair is now fully clear)
```

Post-fix: **resolved 5→15, review_queue 5→15, open_world 26→16**. Zero regressions,
checked twice, an initial signature-comparison script wrongly flagged 4 "regressions"
that turned out to be a field-name bug in the verification script itself (it read
`r.claim_definition_key` where the committed `resolution.json` actually names the field
`r.resolved_claim_definition_key`); re-run with the correct field name, the true
regression count is 0, and every one of the 5 originally-committed resolved claims is
still resolved, byte-identical. Full test suite green at 7718 tests, 0 failures, run
twice (once per taxonomy.js version) (section 10).

Of the 10, 4 items (2 pairs: `REAL_ESTATE`'s `$200,000` pair, `AGGREGATE_PAYMENTS`'s
pair) are **fully** clear, both the bucket and its paired threshold candidate resolved.
The other 6 (`REAL_ESTATE`'s Space/Ground Lease pair's bucket, `MA_AGREEMENTS`'s bucket,
`MA_ONGOING_OBLIGATIONS`'s bucket, `SETTLEMENT`'s bucket, `IP_LICENSES_IN`'s bucket,
`IP_LICENSES_OUT`'s bucket) cleared the bucket gate but their paired threshold candidate
remains open-world, blocked by the second, unrelated mechanism below.

### 4.2 The `threshold_kind: 'ANY'` chapeau/limb defect, not mine, same class as MEETING_REF

`materialContractGroundingFailure`'s threshold branch, for `threshold_kind === 'ANY'`:

```js
if (thresholdKind === 'ANY'
  && (!/^any$/i.test(thresholdValue) || !/\bany\b[\s\S]{0,80}\bcontracts?\b/i.test(quote))) {
  return 'MATERIAL_CONTRACT_THRESHOLD_UNCORROBORATED';
}
```

requires the literal word "any" within 80 characters of "contract(s)" **inside the
candidate's own narrowed quote**. Modiv's `3.17(b)` chapeau reads: "…of each Contract…
to which the Company or any of the Company Subsidiaries is a party… that: (i) is a
limited liability company agreement… (ii) is a Company Space Lease, Ground Lease or
Company Lease; (iii) contains covenants…", "Contract" and "any" both live once in the
chapeau; the lettered limbs (correctly narrowed by the model, per the same
"narrow the quote to one clause" instruction pattern seen throughout this codebase's
producer prompts) never repeat them. Checked programmatically against all ten
`threshold_kind: 'ANY'` candidates' real `raw_value`: **none** contain both words in the
required order inside their own limb text. `SEC_ITEM_601`'s clause `(a)` is its own
independent sentence and does contain both words, but in the wrong order for this
one-directional regex ("...Contracts...to any report...", Contract-then-any, not
any-then-Contract), a second, narrower bug on top of the first.

This is the fourth occurrence of the exact defect shape the review already proved for
MAE's `clause_label`, `MEETING_REF`/`CONTROL_PARTY_REF`, and (per the review's own
diagnosis) `TERMINATING_PARTY_REF`: a narrowed quote correctly omits chapeau-level
context; the checker checks only the narrow quote. Affects `3.17(a)` (SEC_ITEM_601),
`3.17(b)(i)` (JV_PARTNERSHIPS), `3.17(b)(xi)` (HEDGING) directly (their buckets already
pass), plus the threshold half of six of the pairs fixed in 4.1 once their bucket gate
clears (`REAL_ESTATE`'s Space/Ground Lease pair, `MA_AGREEMENTS`, `MA_ONGOING_OBLIGATIONS`,
`SETTLEMENT`, `IP_LICENSES_IN`, `IP_LICENSES_OUT`), 9 items total. **Not implemented**
(`candidate-resolution.js`). Recommended fix,
mirroring the already-shipped MAE adjacency pattern: verify "any" + the governing noun
against the section's real admitted text (with its chapeau), not just the candidate's own
quote, with the same same-label-sibling fallback MAE's tier-3 logic already established
for compound/enumerated clauses.

### 4.3 The three genuinely novel items

`3.17`'s open-world items `23`, `24`, `25` (outbound equity/capital-contribution
investment commitments; loans made **by** the Company as lender; forward equity sale
transactions) have no bucket that fits, checked against all 26 `MATERIAL_CONTRACT_BUCKET_META`
codes, none covers "the Company lends money out" or "forward equity sale" as a concept.
The model's own `why_unmapped` reasoning for each is precise and correctly declines to
force a nearby-but-wrong bucket (e.g. explicitly distinguishing from `INDEBTEDNESS`,
which covers the Company *borrowing*, not lending). Judgement call, not mechanical;
flagged in section 8.

## 5. Representations: three mechanisms, one of them corrects the plan's own framing

### 5.1 Deliberate design (confirmed): TEMPORAL/THRESHOLD qualifiers are not yet identity-bearing, on purpose

The plan speculated representations' `TEMPORAL`/`THRESHOLD` qualifier-kind gap (7 items:
6 `TEMPORAL`, 1 `THRESHOLD`, reason `REPRESENTATION_QUALIFIER_KIND_NOT_GOVERNED`) might
be a port gap worth checking against V1. It is not. `qualifier-kind-lexicon.js`'s own
header (a real, dated spec citation:
`docs/superpowers/specs/2026-08-02-p2-qualifier-kinds-design.md`) states this in plain
language: *"ASYMMETRIC DOUBT ROUTING… Doubt confined to KNOWLEDGE / THRESHOLD / TEMPORAL
routes to open world, exactly as an unmapped generic key does today. Rationale: only
ACCURACY is identity-bearing under the currently registered claim definitions."* This is
a named, reasoned decision, not an oversight, V2 chose, deliberately, to make only
ACCURACY (and `DISCLOSURE_SCHEDULE_CARVEOUT`) identity-bearing when it expanded the
qualifier-kind vocabulary from four kinds to six. **No fix recommended.** This corrects
the plan's speculative framing; per this task's brief, a plausible-looking wrong mapping
is worse than no mapping, and forcing a TEMPORAL/THRESHOLD port here would be exactly that.

### 5.2 Spec/implementation gap: ACCURACY-touching doubt should reach review, not open world

The 9 `REPRESENTATION_QUALIFIER_KIND_NOT_EXACT` items are different: the qualifier kind
here **is** ACCURACY (identity-bearing, per 5.1). `handleRepresentationQualifierCarrier`
calls the real, unmodified `classifyQualifierQuote({ quote, modelKind: 'ACCURACY' })`
(from `qualifier-kind-lexicon.js`, a file this task owns) and requires
`outcome === 'CLASSIFIED'`. Run directly against all 9 real quotes (no model call, this
classifier is documented as "pure functions of their string inputs"), every one returns:

```
{"outcome":"REVIEW","reason":"QUALIFIER_KIND_UNCLASSIFIED","lexiconKind":null,"modelKind":"ACCURACY","families":[]}
```

The model confidently said ACCURACY; the deterministic lexicon fires zero marker
families at all (not a disagreement, an abstention). The same file's header is explicit
about what should happen next: *"Doubt that touches ACCURACY… is the only doubt that
reaches human review, typed `QUALIFIER_KIND_DISAGREEMENT`… or
`QUALIFIER_KIND_UNCLASSIFIED`… [and] never falls through to open world (section 6)."*
But the caller in `candidate-resolution.js` (line 8629, 8634) does not distinguish
`outcome === 'REVIEW'` from any other non-`CLASSIFIED` outcome, it pushes everything to
open world:

```js
if (classification.outcome !== 'CLASSIFIED' || classification.kind !== 'ACCURACY'
  || typeof classification.code !== 'string') {
  pushOpenWorld({ entry, claimRow: claim, reason: 'REPRESENTATION_QUALIFIER_KIND_NOT_EXACT' });
  return;
}
```

REPRESENTATIONS currently has **zero** `review_queue` items across all 28 candidates,
consistent with this routing path never actually being reached in this family. **Not
implemented** (`candidate-resolution.js`). Recommended fix: when
`classification.outcome === 'REVIEW'`, route to the family's review-queue push
(mirroring `pushRegulatoryReview`/`pushProxyMeetingReview`'s existing pattern) carrying
`classification.reason` (`QUALIFIER_KIND_DISAGREEMENT` or `QUALIFIER_KIND_UNCLASSIFIED`)
as the queued reason, rather than collapsing to open world.

### 5.3 Party-side lexicon gap, half-implemented, verified necessary-but-not-sufficient

3 items (`REPRESENTATION_SIDE_UNRESOLVED`, all `party_making: "the Partnership"`,
`3.3(b)`) failed because `representationSideFor()` in `anthropic-provider.js`, the
function that derives `representation_side` at shaping time, confirmed by tracing every
assignment site of that attribute across `native-producer/*.js`, tested only
`/\b(?:company|target|seller)\b/i` for TARGET and `/\b(?:parent|buyer|acquir)/i` for
BUYER; "Partnership" matched neither. Modiv's own preamble names "MODIV OPERATING
PARTNERSHIP, LP" as the second party (immediately after "MODIV INDUSTRIAL, INC."), and
Article III is titled "REPRESENTATIONS AND WARRANTIES OF **THE COMPANY PARTIES**"
(plural), Modiv's Operating Partnership is unambiguously target-side; this is a standard
UPREIT structure. **Implemented**: added `partnership` to the TARGET marker list.

Verified by patching *only* the derived `representation_side` field on the three real
recorded candidates (leaving every quote, evidence span and provenance record
byte-identical) and replaying through the real, unmodified `resolveCandidates()`: the
reason changes from `REPRESENTATION_SIDE_UNRESOLVED` to a **different, later** reason,
`REPRESENTATION_SIDE_PARTY_UNRESOLVED`, proving the fix is real and necessary, but not
sufficient alone. The next gate, `resolveParty()`, consults a second, independent
keyword list in `candidate-resolution.js`, `PARTY_CAPACITY_LEXICON` (company/target →
TARGET, parent/purchaser/buyer/pubco → BUYER, merger sub → BUYER_AFFILIATE, seller →
SELLER) which also has no "partnership" entry. **Not implemented** (the second list is in
`candidate-resolution.js`). Recommended, mirrored fix:

```diff
 const PARTY_CAPACITY_LEXICON = Object.freeze([
   Object.freeze({ pattern: /\bcompany\b/i, capacity: 'TARGET' }),
   Object.freeze({ pattern: /\btarget\b/i, capacity: 'TARGET' }),
+  Object.freeze({ pattern: /\bpartnership\b/i, capacity: 'TARGET' }),
   Object.freeze({ pattern: /\bparent\b/i, capacity: 'BUYER' }),
   ...
```

Residual risk, disclosed rather than hidden: a future deal whose *buyer*-side operating
partnership is named without the word "Parent"/"Buyer" (Modiv's own counterparty, Global
Net Lease, has exactly such an entity, "Global Net Lease Operating Partnership, L.P.", though it is never `party_making` for a REPRESENTATIONS candidate on this run, since this
batch only requested Article III, the Company Parties' reps). This is the same class of
risk the existing lexicon already carries for "seller"/"company" as bare words; not a new
category of risk introduced by this fix. Net effect once both halves land: 0 items
unblocked by my half alone (confirmed by replay); the two together would unblock up to 3,
subject to the qualifier-kind checks in 5.1/5.2 still passing for each (`3.3(b)`'s two
`TEMPORAL` items are already correctly open-world per 5.1; only the `ACCURACY` item,
"subject to the Bankruptcy and Equity Exception", would newly resolve).

### 5.4 The 9 genuinely novel items

`REPRESENTATION_QUALIFIER_KIND_NOT_EXACT`/`NOT_GOVERNED` do not apply to these 9 at all, they are not accuracy, knowledge, materiality or temporal qualifiers on a representation
limb; they are a different category (jurisdictional-recognition carve-out, disclosure-schedule
cross-references, financial-statement recordation basis, board-resolution durability,
conditions precedent on a non-conflict rep, an enumerated permitted-filings carve-out
list). The model's own `candidate_kind: "ATTRIBUTE_OR_QUESTION"` tag and per-item
reasoning already state this precisely. Judgement calls, not forced; section 8.

## 6. Consideration: 18 of 20 are a real V1 port, corrected from the plan's own proposal

Checked directly against `lib/rubric.js` (not inherited from the plan): `CONSID-EXCHANGE`
(line 252), label "Exchange of Certificates / Payment Mechanics", description "Exchange
fund, letter of transmittal, payment procedures", aliases `['Exchange Fund', 'Payment for
Shares', 'Exchange Procedures', 'Surrender of Certificates']`, is the exact provision-level
home for the 13 `EXCHANGE_MECHANICS`-tagged items (fractional-share cash-out mechanics,
letter-of-transmittal exemptions, unclaimed-property/escheat handling, no-interest rules,
exchange-agent expense allocation, DTC book-entry carve-outs, OpCo partnership joinder
requirement) plus the 3 `PRORATION_FORMULA`-tagged items. `CONSID-WITHHOLD` (line 276,
aliases `['Tax Withholding', 'Withholding']`) is the home for the 2 `WITHHOLDING`-tagged
items (net-of-withholding language, W-9 delivery requirement).

**A correction to the plan, independently re-verified, not inherited**: the plan proposed
mapping the fractional-share items onto V1's `prorationMechanics` field. Read directly
(`lib/rubric.js:4046-4050`): `prorationMechanics` is `{ electionType,
oversubscriptionTreatment, electionDeadline, text }`, an election-deal concept (cash/stock
election with oversubscription across the whole shareholder base, a deadline to elect).
None of Modiv's three `PRORATION_FORMULA` items involve an election at all; each is a
fractional-share cash-out formula for holders who did not previously make any election.
The word "fractional" does not appear anywhere in `lib/rubric.js`. The correct anchor is
`CONSID-EXCHANGE` (payment mechanics), which already covers "how a holder gets paid when
the exchange doesn't divide evenly" as part of its stated scope, not `prorationMechanics`,
which V1 built for a structurally different mechanism. Porting to `prorationMechanics`
would have encoded a wrong legal concept.

**Not mechanical, not implemented.** V2's CONSIDERATION family currently has zero
governed claim types for exchange mechanics, proration or withholding at all (confirmed:
`anthropic-provider.js`'s `RESPONSE_LISTS.CONSIDERATION` is `['open_world_candidates']`
only, and this held true under every contract-bundle version through V38, the
open-world delta for CONSIDERATION going V34→V38 was verified at 0). Building this out
needs new claim definitions (`contract-bundle.js`, owned) *and* new resolver dispatch
logic (`candidate-resolution.js`, not owned) *and* new producer-prompt response fields
(`consideration-producer-prompt.js`, owned but pointless to add alone, the model would
have a new field with nowhere for its output to go). This is real design work, not a
synonym edit; the legal-judgement question (which V1 concept each maps to) is answered
above, but the wiring is not mechanical by this task's own bar.

2 items are not force-mapped: idx3 (Class X→Class C OP unit conversion, an antecedent
reclassification feeding into a later exchange, arguably `CONSID-EQUITY`'s territory but
not cleanly) and idx19 (a transfer-tax indemnity on payment to a non-registered-holder
transferee, distinct from withholding on the consideration itself). Flagged in section 8.

## 7. Deliberate designs confirmed correct (no fix)

Two families' entire open-world yield, plus a chunk of a third, is a documented,
deliberate "evidence-only mechanics" bucket, checked against each family's own producer
prompt instructions, not assumed:

- **DNO_INDEMNIFICATION (7 items)**: `dno-producer-prompt.js`'s own instructions:
  *"Preserve advancement timing, successor assumption, pending-claim survival,
  indemnification-agreement, fee-shifting and claims-handling mechanics in
  `employee_dno_mechanics` as exact evidence… A mechanics surface label routes evidence
  only and is not a governed legal code."* All 7 open-world items' `why_unmapped` tags
  are exactly these six surfaces. Cross-checked against V1: `lib/rubric.js`'s shared
  `COV` field array has exactly one D&O-specific structured field
  (`indemnificationPeriod`, the tail period in years), V1 never modelled advancement
  timing, successor assumption etc. as structured facts either. This is not a port gap;
  V2 matches V1's own granularity here.
- **EMPLOYEE_MATTERS (3 items)**: identical pattern in
  `employee-matters-producer-prompt.js` ("Preserve 401(k), bonus or LTI, WARN and CBA
  mechanics in `employee_dno_mechanics` as exact evidence… not a governed legal code").
  These are current-state representations (401(k) qualification, CBA absence, WARN Act
  compliance), while the family's governed scope (`ITEM_STANDARD`, `CONTINUATION_PERIOD`,
  `SERVICE_CREDIT`, `WELFARE_RELIEF`) is specifically post-closing continuation covenants
, matching V1's own `COV-EMPLOYEE` scope. Correctly out of scope, not a gap.
- **TERMINATION (6 of 13 items)**: `termination-producer-prompt.js`: *"Vote-threshold and
  breach-standard ownership remains unsettled, so those two surfaces remain evidence
  only… These are evidence-only mechanics, not new standards or termination-right
  claims."* `RESTRAINT_FINALITY` (1), `PRE_VOTE_LIMIT` (2), `BREACH_STANDARD` (3) all
  carry this exact, self-flagged "unsettled" status. Correctly not forced into a claim
  type while genuinely undecided.

## 8. Everything else: precisely specified, left for Ben

Consistent with the brief, "a plausible-looking wrong mapping is worse than no
mapping", the following got no forced mapping. Each is a short, concrete question Ben
can answer quickly; none needed to be guessed at.

- **Material contracts, `NONCOMPETE`/`AFFILIATE_TRANSACTIONS` (4 items)**: does a clause
  that describes the *effect* of a non-compete/affiliate-transaction restriction, with no
  term-of-art present, count as a corroborated match? (Section 4.1.)
- **Material contracts, 3 items (`3.17`)**: outbound investment/capital-contribution
  commitments, loans made *by* the Company as lender, forward equity sale transactions,   none of the 26 existing buckets fit; is a new bucket warranted, or are these
  intentionally out of scope? (Section 4.3.)
- **Consideration, 2 items**: Class X→Class C OP unit conversion; transfer-tax indemnity
  on non-registered-holder payments, closest existing homes noted, neither clean.
  (Section 6.)
- **Proxy meeting, 4 items** (`MAILING_DEADLINE`, `ADJOURNMENT_CONTROL`,
  `ADJOURNMENT_CONSENT_OVERRIDE`): these three `assertion_kind`s are already in the
  prompt's allowed vocabulary but have **no claim definition anywhere in
  `contract-bundle.js`, at any version V1, V38** (checked directly, zero hits, unlike
  antitrust, this is not a staleness bug, nobody has built these yet) and no entry in
  `PROXY_MEETING_ASSERTION_MAP`. Real, well-defined M&A mechanics (who mails the proxy
  statement and by when; who controls adjournment; whether the other side's consent is
  required) but genuine new-concept design work. Plus 4 more genuinely novel items
  (record-date-tied postponement restriction, solicitation-update reporting duty,
  efforts-to-obtain-the-vote covenant, sole-matters-voted restriction).
- **No-shop, 8 items**: each carries the model's own explicit reasoning for why it is
  *not* its nearest existing concept (e.g. "affirmative permission to correspond for
  clarification… distinct from the furnish-information/engage-in-discussions
  exceptions"). A REIT-specific item (ownership-limit-waiver restriction tied to a
  termination ground) has no nearest concept at all.
- **Termination, 7 items**: all are "qualifications on the grant", standard
  no-benefit-from-own-breach provisos ("you can't invoke this termination right if your
  own breach caused the problem") and compliance gates, recurring across multiple
  termination rights in the same agreement. Whether these deserve a governed
  `RIGHT_GRANT`-qualification concept, distinct from the bare grant, is a product-scope
  call.
- **Termination fee, 20 items**: the richest and most varied cluster, including a
  recurring, actionable pattern worth flagging first, **7 items** where a bare
  cross-reference to a termination ground (e.g. "(i) by Parent pursuant to Section
  7.1(d)(ii)") states no payment-direction language, so `fee_side` cannot be determined
  without following the citation into `7.1` and finding no fee obligation stated there
  either (fee obligations are stated separately in `7.3`). This looks like the edge of
  what citation-following (`docs/codex-program/notes/citation-following-implementation.md`)
  was built to solve; whether it is a remaining citation-following gap or a genuinely
  harder cross-document inference is a question for whoever owns that mechanism, not
  diagnosed further here to avoid guessing into an area under active, separate
  development. The other 13: sole-remedy evidence (owned by `SPECIFIC_PERFORMANCE_REMEDIES`
  cross-family, likely already served by the V38 `SOLE_REMEDY_*` claim definitions and
  `sole-remedy-resolution.js` machinery, not re-diagnosed here), late-payment interest,
  a 12-month tail-fee arming structure (x2, same concept different citations), an
  election-of-remedies rule, a one-time-payment cap, a liquidated-damages characterisation,
  a REIT Qualifying-Income savings-clause fee cap (x2), an escrow-and-release mechanism
  with a 5-year sunset (x2), and two payment-mechanism-with-no-dollar-figure items. None
  is a synonym fix; each would need its own new `wave_b_mechanics` surface or claim type.
- **Merger structure, 3 items**: "parties may mutually agree to a different
  date/time/place" fallback provisos on `EFFECTIVE_TIME`/`CLOSING_TIMING`. V1 has one
  free-text `closingTiming` field only; this granularity would be new, not ported.
- **Representations, 9 items** (section 5.4) and **MAE_DEFINITION, 2 items** (not a gap
  in this family, see below).
- **Dividends (1 item) and tax matters (2 items), a REIT-specific pattern worth
  flagging as one question, not three**: Dividends' `idx0` ("the Company and any
  Company Subsidiary that is a REIT may make distributions… reasonably necessary… to
  maintain its status as a REIT… or avoid the payment of income or excise tax under
  Sections 857 or 4981") was tagged `assertion_kind: COORDINATION` by the model, but
  `DIVD-COORD`'s actual corroboration check requires "coordinate…record…payment dates"
  language that has nothing to do with this clause, this is REIT-status-maintenance
  language, not dividend-date coordination, forced into the nearest existing kind.
  Tax matters' `idx8`/`idx9` (REIT-qualification-maintenance efforts under Section
  856/857/4981) were similarly tagged `TREATMENT_PROTECTION`, whose actual check is
  scoped to the *merger's* Intended Tax Treatment (351/368(a)), not REIT status, a
  different tax concept entirely. Neither DIVIDENDS nor TAX_MATTERS has a dedicated
  REIT-qualification concept, so the model reached for the nearest labelled kind in each
  family. This is a genuine, cross-family vocabulary gap specific to REIT-to-REIT deals
  (Modiv/Global Net Lease), not a one-off phrasing issue, worth Ben's attention as one
  question ("does this product need a REIT-status-maintenance concept, and in which
  family") rather than three separate small ones. Dividends' other 2 items (a bare
  cross-reference fragment; a pre-Effective-Time record-date dividend paid on the Closing
  Date) are also not force-mapped.

## 9. Full per-item classification

For every one of the 193, family / mechanism-row / fix status. "Mechanism" cross-references
section 1's table.

| Family | Count | Mechanism (§) | Mechanical fix by this task? |
|---|---|---|---|
| ANTITRUST_REGULATORY | 11 | Stale contract version (§2) | Diagnosed + verified; not applied (file not owned) |
| CONSIDERATION | 18 | V1 port, real design work (§6) | No, specified |
| CONSIDERATION | 2 | Novel, no clean home (§6) | No, judgement |
| DIVIDENDS | 1 | REIT-concept gap (§8) | No, judgement |
| DIVIDENDS | 2 | Novel (§8) | No, judgement |
| DNO_INDEMNIFICATION | 7 | Deliberate design, confirmed correct (§7) | No fix needed |
| EMPLOYEE_MATTERS | 3 | Deliberate design, confirmed correct (§7) | No fix needed |
| FINANCING_COVENANTS | 2 | V1 port (COV-FINANCING), family unbuilt (§6) | No, specified |
| GENERAL_COVENANTS | 11 | Corroboration reads wrong vocabulary source (rubric.js display labels used as an operative-text lexicon) (§9.1) | No, specified |
| GENERAL_COVENANTS | 1 | Novel (§9.1) | No, judgement |
| KEY_DEFINED_TERMS | 15 | Section-mapping gap (§3) | No, diagnosed, needs live re-run |
| MATERIAL_CONTRACTS | 10 | Synonym list too narrow (§4.1) | **Yes, implemented, verified unblocked** |
| MATERIAL_CONTRACTS | 9 | Chapeau/limb defect (§4.2) | No, specified |
| MATERIAL_CONTRACTS | 4 | Functional-description text, no anchor (§4.1) | No, judgement |
| MATERIAL_CONTRACTS | 3 | Novel (§4.3) | No, judgement |
| MERGER_STRUCTURE_CLOSING | 3 | Novel granularity beyond V1 (§8) | No, judgement |
| NO_SHOP | 1 | Resolver contradicts its own parser's documented intent (§9.2) | No, specified |
| NO_SHOP | 8 | Novel, model explicitly declined nearest concepts (§8) | No, judgement |
| PROXY_MEETING | 4 | Never-built claim types (§8) | No, judgement/design |
| PROXY_MEETING | 4 | Novel (§8) | No, judgement |
| REPRESENTATIONS | 7 | Deliberate design, confirmed correct (§5.1) | No fix needed, corrects the plan |
| REPRESENTATIONS | 9 | Spec/implementation gap (§5.2) | No, specified |
| REPRESENTATIONS | 3 | Party lexicon gap (§5.3) | **Half implemented**, companion specified |
| REPRESENTATIONS | 9 | Novel category (§5.4) | No, judgement |
| TAX_MATTERS | 5 | Corroboration regex too narrow, hardcoded (§9.3) | No, specified |
| TAX_MATTERS | 3 | Chapeau/cross-document defined-term defect, `INTENDED_TREATMENT` (§9.3) | No, specified, medium confidence |
| TAX_MATTERS | 2 | REIT-concept gap (§8) | No, judgement |
| TAX_MATTERS | 1 | Novel (§8) | No, judgement |
| TERMINATION | 6 | Deliberate design, confirmed correct (§7) | No fix needed |
| TERMINATION | 7 | Novel, right-grant qualifications (§8) | No, judgement |
| TERMINATION_FEE | 7 | Fee-side cross-reference unresolved (§8) | No, flagged for citation-following owner |
| TERMINATION_FEE | 13 | Novel mechanics, various (§8) | No, judgement |
| MAE_DEFINITION | 2 | Cross-family scope overlap, not a gap in this family | No fix needed within this family |

Family subtotals check against the per-family census used throughout this note:
ANTITRUST_REGULATORY 11, CONSIDERATION 20, DIVIDENDS 3, DNO_INDEMNIFICATION 7,
EMPLOYEE_MATTERS 3, FINANCING_COVENANTS 2, GENERAL_COVENANTS 12, KEY_DEFINED_TERMS 15,
MATERIAL_CONTRACTS 26, MERGER_STRUCTURE_CLOSING 3, NO_SHOP 9, PROXY_MEETING 8,
REPRESENTATIONS 28, TAX_MATTERS 11, TERMINATION 13, TERMINATION_FEE 20, MAE_DEFINITION 2
, sums to 193.

(GENERAL_COVENANTS and TAX_MATTERS' non-mechanical resolver-side findings are detailed in
section 9's sub-notes below, having been found after section 1's table was first
drafted, in the course of fully classifying every item as instructed; section 1 was
updated to match once found, rather than left inconsistent with the detail below it.)

### 9.1 General covenants: all 11 paired items share one root cause

Every one of the 11 `GENERAL_COVENANT_CODE_UNCORROBORATED` items (`COV-ACCESS` x2,
`COV-PUBLICITY` x2, `COV-NOTIFY` x7) already carries the *correct* `canonical_value`, the model classified them right. `generalCovenantGroundingFailure` in
`candidate-resolution.js` corroborates by testing whether the quote contains the
covenant's own V1 rubric label or alias, verbatim, after normalisation, reading `CODES`
directly from `require('../../rubric')`:

```js
const phrases = [CODES[code]?.label, ...(CODES[code]?.aliases || [])]...
if (!phrases.some((phrase) => normalisedQuote.includes(phrase))) {
  return 'GENERAL_COVENANT_CODE_UNCORROBORATED';
}
```

`COV-NOTIFY`'s label is "Notification of Certain Matters", aliases "Notification
Covenant"/"Material Developments Notice". Real operative drafting ("The Company shall
give prompt notice to Parent…") does the notifying; it does not restate its own section's
display title. This will fail on almost any real notice covenant, by construction, a
display-naming field is being read as an operative-text lexicon, a different design
mistake from material contracts' merely-too-narrow synonym lists. **Not implemented.**
Deliberately did **not** take the tempting shortcut of padding `lib/rubric.js`'s aliases
with operative phrases like "shall give prompt notice", that field is a display/naming
list consumed elsewhere across the V1 codebase (search, classification), and repurposing
it for this one V2 check's needs risks unrelated breakage. The correct fix is in
`candidate-resolution.js`: read from a dedicated general-covenants synonym lexicon
(mirroring `MATERIAL_CONTRACT_BUCKET_META`'s pattern, which this task did widen), not
`CODES[code].label/aliases`. One further item (`idx2`, a non-contact-with-business-relationships
restriction distinct from `COV-ACCESS`) is genuinely novel; judgement call.

### 9.2 No-shop: a resolver contradicting its own parser's documented intent

`no-shop-period-parse.js` (owned; not edited, since the actual defect is in the caller)
deliberately abstains on hour-denominated periods, by design, with its own header
comment: *"an hour-denominated obligation is typed ABSTAIN `PERIOD_UNIT_HOURS`, never
[converted]… routed to review, forever."* `candidate-resolution.js`'s caller honours this
for every period role **except** `NOTICE`, which it special-cases to open world instead:

```js
if (periodRole === 'NOTICE' && parseResult.reason === 'PERIOD_UNIT_HOURS') {
  pushOpenWorld({ entry, claimRow: claim, reason: 'NO_SHOP_PERIOD_HOUR_NOTICE_OPEN_WORLD' });
  return;
}
```

Modiv's one occurrence ("no event later than forty-eight (48) hours", a bidder-notice
period) is real, common M&A drafting that would be dropped to open world under this
special case while an otherwise-identical hour period on a different role would correctly
reach review. Not implemented (`candidate-resolution.js`); flagged as an inconsistency
with the parser module's own stated intent, not asserted as certainly a bug, the special
case might be deliberate for a reason not visible from the parser module alone, which is
exactly why it is specified as a question rather than silently "corrected".

### 9.3 Tax matters: the same chapeau/cross-reference and narrow-regex shapes, checked individually

- **`TAX_OPINION_COOPERATION` (4 items, `5.12(b)`)**: `handleTaxMattersCandidate`
  requires the literal bigram "tax opinion" in the quote. Modiv's actual text says
  "…to enable [counsel] to render **the opinion** described in Section 6.3(d)…" and "a
  **'Company Tax Representation Letter'**", "tax" and "opinion" never sit adjacent.
  Same shape as material contracts' regex-too-narrow findings, but the check itself is
  hardcoded inline in `candidate-resolution.js` rather than reading a vocabulary list, so
  it is not fixable by widening a file this task owns. Specified, not implemented.
- **`TRANSFER_COOPERATION` (1 item, `5.12(d)`)**: same shape, different word-form gap.
  `handleTaxMattersCandidate` requires `cooperate.*(?:preparation|filing)` (or the
  reverse order) in the quote. The real text, "Parent shall, with the Company's good
  faith cooperation and assistance, **prepare**, execute and **file**… and Parent and the
  Company shall reasonably **cooperate** to minimize…", uses "prepare"/"file" as verbs
  throughout; the exact noun forms "preparation"/"filing" the regex requires never
  appear. Verified directly: `/cooperate.*(?:preparation|filing)|(?:preparation|filing).*cooperate/i`
  returns `false` against the real `raw_value`. Specified, not implemented.
- **`INTENDED_TREATMENT` (3 items)**: requires a literal "Section 351" or "Section
  368(a)" citation in the quote. Modiv's reps instead reference the defined term
  "Intended Income Tax Treatment" without inlining the Code section its own definition
  specifies, the same *class* of defect as the chapeau/limb pattern (information that
  lives once, elsewhere in the document, not repeated in a correctly-narrowed quote), but
  the "elsewhere" here is the defined term's own definition rather than a parent clause
  chapeau. Flagged at medium confidence, this task did not locate and read the "Intended
  Income Tax Treatment" definition itself to confirm which Code section it names, to
  avoid the risk of asserting a mapping without checking it, consistent with this task's
  standard for judgement-adjacent findings.

## 10. Verification

```
CI=true npm test > /tmp/openworld_test.log 2>&1; echo "EXIT=$?"
```

Run twice: once after the first `lib/taxonomy.js` version (before the `SETTLEMENT`
correction described in section 4.1) and once after the final version. Both runs:
`EXIT=0`. Final run: 7718 tests, 7676 passed, 0 failed, 42 skipped (the total is higher
than the "green at 7690" baseline in this task's brief because another agent concurrently
landed substantial, unrelated `candidate-resolution.js` changes, proxy-meeting and
terminating-party reference fixes, matching the review's own fix items 2/3, during this
task; confirmed by `git diff --stat` showing 241 insertions / 5 deletions in that file
and new test files not authored by this task. Those changes are not this task's to claim
or verify beyond confirming the suite is still green with them present.)

Files changed by this task:

- `lib/taxonomy.js`, `MATERIAL_CONTRACT_BUCKET_META` synonym widening for `REAL_ESTATE`,
  `MA_AGREEMENTS`, `MA_ONGOING_OBLIGATIONS`, `SETTLEMENT`, `IP_LICENSES_IN`,
  `IP_LICENSES_OUT`, `AGGREGATE_PAYMENTS` (section 4.1).
- `lib/canonical-v2/native-producer/anthropic-provider.js`, `representationSideFor()`
  recognises "partnership" as a TARGET-side marker (section 5.3).

Nothing in `lib/canonical-v2/native-producer/candidate-resolution.js` was edited, per the
file constraint; every fix that needed a change there is specified above as a precise,
unapplied diff or description, each independently diagnosed by reading the real resolver
code and, wherever practical, testing the exact proposed change against the real quotes
, not a paraphrase, after the `SETTLEMENT` near-miss in section 4.1 showed why that
distinction matters, before writing it down.

## 11. Net measured impact

10 of the 193 committed open-world candidates are unblocked by this task's implemented
changes, measured by replaying the real, committed evidence through the real,
unmodified `resolveCandidates()`, not estimated: all 10 in MATERIAL_CONTRACTS, all 10
landing in `resolved`, zero regressions. The REPRESENTATIONS party-lexicon fix is real
and independently verified (moves 3 items to a different, later failure reason) but does
not on its own move any item out of open world, its companion half lives in a file this
task does not own, and is specified precisely in section 5.3. The single largest unblock
identified, all 11 of ANTITRUST_REGULATORY, fully verified safe with zero regressions, is not counted in the 10 because its one-line fix site is outside this task's file grant;
it is documented in section 2 as the highest-priority item for whoever picks this note up
next. Together, the fully-verified findings in this note (antitrust's 11 plus material
contracts' 10) account for 21 of the 193; the remaining diagnoses (chapeau/limb defects,
the general-covenants lexicon-source defect, the qualifier-kind routing gap, and so on)
are each precise enough to implement directly once picked up by the owner of
`candidate-resolution.js`, without further investigation.
