# Diagnosis: REPRESENTATIONS / MAE_DEFINITION undiagnosed gap

Branch under diagnosis: `origin/cursor/step-2x-free-phase-b641` (7535782a).
Status: IN PROGRESS — appended as work proceeds.

## Slice

1. `REPRESENTATION_KNOWLEDGE_STANDARD_UNCORROBORATED` — 91, REPRESENTATIONS, open-world, raised at candidate-resolution.js:9833
2. `MAE_CARVEOUT_UNCORROBORATED` — 19, MAE_DEFINITION, raised at :9048
3. `PARTY_UNRESOLVED` in MAE_DEFINITION — 14
4. Sweep of remaining UNDIAGNOSED rows in REPRESENTATIONS / MAE_DEFINITION

## Log

- Starting: reading unresolved-register.json and undiagnosed.md for my rows.
- Full slice confirmed from undiagnosed.md: 6 rows total under REPRESENTATIONS/MAE_DEFINITION —
  REPRESENTATION_KNOWLEDGE_STANDARD_UNCORROBORATED(91), MAE_CARVEOUT_UNCORROBORATED(19),
  PARTY_UNRESOLVED/MAE_DEFINITION(14), REPRESENTATION_SIDE_UNRESOLVED(1),
  QUALIFIER_KIND_DISAGREEMENT(1), CARVEBACK_CLAUSE_LABELS_NOT_IN_QUOTE(1). Sum 127 ~ "roughly 124".

---

## 1. REPRESENTATION_KNOWLEDGE_STANDARD_UNCORROBORATED (91) — DIAGNOSED

**Raised**: `lib/canonical-v2/native-producer/candidate-resolution.js`,
`handleRepresentationQualifierCarrier`, KNOWLEDGE branch, ~line 9825-9834:
```js
if (qualifierKind === 'KNOWLEDGE') {
  const knowledge = exactRepresentationKnowledgeQualifier(claim.raw_value);
  if (!knowledge) { pushOpenWorld({..., reason: 'REPRESENTATION_QUALIFIER_KIND_NOT_EXACT'}); return; }
  if (claim.canonical_value != null && knowledge.knowledge_standard !== claim.canonical_value) {
    pushOpenWorld({..., reason: 'REPRESENTATION_KNOWLEDGE_STANDARD_UNCORROBORATED'}); return;
  }
  ...
```
`knowledge.knowledge_standard = deriveKnowledgeStandard(quote)` (line 2235) tests the
qualifier's own quote against three literal patterns: `/actual knowledge/i`,
`/constructive knowledge/i`, `/after (?:due|reasonable) inquiry/i` (line 2229-2233).

**Confirmed distinct from the qualifier-proxy diagnosis.** diag-qualifier-proxy.md's
1c (`REPRESENTATION_QUALIFIER_KIND_NOT_EXACT`, the possessive-form gap in
`exactRepresentationKnowledgeQualifier`) is the check ONE LINE ABOVE this one and
gates whether the raw quote's *shape* is even eligible (e.g. "to the knowledge of
X"). `REPRESENTATION_KNOWLEDGE_STANDARD_UNCORROBORATED` only fires *after* that
shape check has already passed — it is a value-mismatch check between the model's
`canonical_value` (the `code` field from the extraction) and the resolver's own
independently-derived `knowledge_standard`. These do not fold together.

**Population, measured** (82/91 recovered from `resolution.json` across the six
`*-representations-*-20260809-2xk-final` deals; gap is the same non-2xk-final-tag
undercount diag-qualifier-proxy.md already flagged, not a new discrepancy):
100% of measured rows have `canonical_value: "ACTUAL"` and `raw_value` one of the
bare forms `"to the knowledge of the Company"` / `"To the knowledge of the
Company"` / `"known to..."` — **never** containing the literal word "actual".
`deriveKnowledgeStandard` therefore returns `null` for every single one, `null !==
"ACTUAL"`, mismatch, open-world. Zero exceptions across 82 samples, 6 deals
(concho, metsera, redhat, skechers, skywater covered; every deal in the family).

**Root cause — confirmed instance of the brief's primary pattern ("the
corroborating detail sits outside the claim's own quote").** Every one of the 5
agreements checked (concho, metsera, redhat, skechers, skywater — 100%) has its
own Article-I/Annex-A "Knowledge" defined term reading literally **"actual
knowledge of [named individuals]"**, e.g.:
- concho: `"knowledge" means the actual knowledge of, (a) in the case of the
  Company, the individuals listed in Schedule 1.1 ... (b) in the case of Parent...`
- skywater: `"knowledge" means, (a) with respect to the Company, the actual
  knowledge of the officers and employees of the Company set forth on Section
  10.14...`
- redhat: `"knowledge" means, with respect to any matter in question, the actual
  knowledge of the persons identified in Section 8.03(k) of the Company Letter`
- skechers: `"Knowledge" of the Company ... means the actual knowledge of (i) the
  Company's Chief Financial Officer or General Counsel...`
- metsera: `knowledge of any Person means, with respect to any matter in
  question, the actual knowledge of such Person's executive officers`

This definition lives in the definitions article (§1.1 / Annex-A / §9.03), a
**different section** from the representation qualifier quote (§4.9-4.11 etc).
Per-section extraction (`native-extraction-run.js` line 634:
`sliceSectionText(sourceText, node.start, node.end)`) means the model, when
extracting the §4.x qualifier, **never sees** the Article-I "Knowledge"
definition's text in that call — `known_definitions` passed into the prompt only
carries `{defined_term}` names (representations-producer-prompt.js line 75-77:
`` `- ${item.defined_term}` ``), never the resolved value. The model still
correctly tags `code: "ACTUAL"` — almost certainly on real M&A drafting-convention
knowledge (bare "knowledge of the Company" defaults to actual knowledge of named
individuals absent contrary drafting, and this is in fact confirmed true in every
sampled agreement) — but the resolver's `deriveKnowledgeStandard` can only ever
see the bare qualifier quote, which never repeats the word "actual". The
resolver's own header comment (line 2224-2228: "a miss here never blocks
resolution, it just leaves the attribute null") describes behaviour for a MISS
with no model-asserted value; it does not anticipate the mismatch-with-a-real-
value case that this reason code actually guards, which downgrades a correct
model answer to open-world.

**Confirms the KEY_DEFINED_TERMS side has the same document's "Knowledge"
definition, independently broken**: concho's KEY_DEFINED_TERMS 2xk-final run
resolves `"...the individuals listed in Schedule 1.1..."` fine
(`KNOWLEDGE_PERSON_SOURCE`), but the clause `"the actual knowledge of"` itself
sits in `review_queue` with reason `STANDARD_CODE_OUT_OF_ENUM` (concept
`DEF-KNOWLEDGE`) — unresolved for a different, KEY_DEFINED_TERMS-family reason,
out of this slice's scope, but confirming there is no live cross-reference
resolveParty/representations could lean on even if it tried.

**Diagnosis**: not a lost/unreachable vocabulary (`taxonomy.js`'s
`KNOWLEDGE_QUALIFIER_CODES`/`KNOWLEDGE_STANDARD_META` are irrelevant here — this
resolver path uses its own inline `KNOWLEDGE_STANDARD_PATTERNS`, not taxonomy.js,
confirming the DONE re-audit's "not reachable from canonical-V2" finding but for
a different reason: this code never imports taxonomy.js's version at all, it
reinvented its own 3-value ACTUAL/CONSTRUCTIVE/AFTER_INQUIRY enum which matches
taxonomy's 3 values 1:1 by name). The 91 are not out-of-vocabulary — they are a
resolver check that only trusts its own literal-word derivation and discards the
model's (correct, convention-grounded) answer when the word isn't repeated in the
narrow quote.

**Fix — RESOLVER_SIDE, free, replay-validatable.** In
`handleRepresentationQualifierCarrier`'s KNOWLEDGE branch (candidate-resolution.js
~9828-9834), stop treating "`deriveKnowledgeStandard` found nothing in the bare
quote" as a *disagreement* with the model's non-null `canonical_value`. Concretely:
when `knowledge.knowledge_standard === null` and `claim.canonical_value` is a
member of `{ACTUAL, CONSTRUCTIVE, AFTER_INQUIRY}`, trust the model's tagged value
(defer to it, the same way the ACCURACY branch already trusts
`classification.code` from the lexicon without independently re-deriving it from
the quote) rather than discarding to open-world. Reserve the UNCORROBORATED path
for the case that's a *genuine* value conflict — `deriveKnowledgeStandard` finds
one standard in the quote and the model tagged a *different* one (e.g. quote
literally says "constructive knowledge" but the model tagged ACTUAL) — a shape not
observed once in the 82 measured samples. No prompt change; the model's answer is
already recorded and does not need re-extraction.

---

## 2. MAE_CARVEOUT_UNCORROBORATED (19, measured 23 across 8 deal-runs incl.
   modiv/topbuild r4 variants not in the official 2xk-final tag set) — DIAGNOSED

**Raised**: `handleMaeCarveoutCandidate`, candidate-resolution.js ~9048:
```js
const corroborated = carveoutCode ? maeCarveoutCorroborated(carveoutCode, claim.raw_value) : false;
if (!corroborated) { pushMaeReview({..., reason: 'MAE_CARVEOUT_UNCORROBORATED'}); return; }
```

**The drift the brief asked me to check for is REFUTED.** `MAE_CARVEOUT_CODES`
used in the enum-membership gate just above (line 9017) traces through
`anthropic-provider.js` (imported as `MAE_CARVEOUT_CODES_V2` from
`../contract-bundle`) — single-sourced, not hand-copied at that layer, per that
file's own comment ("never hand-copied as a frozen literal ... can never drift
from the resolver's own enum gate"). `contract-bundle.js`'s
`MAE_CARVEOUT_CODES_V2` (line 3057) genuinely *is* a hand-copied literal from
`taxonomy.js`'s `MAE_CARVEOUT_META` (per its own comment, "adopted verbatim minus
OTHER") — but a full key-for-key diff of the 26 codes in each shows **zero
drift**: identical sets, only the documented `OTHER` removal. So
`MAE_CARVEOUT_CODE_UNREGISTERED` (the enum-gate reason, not in my slice, 0
observed) would be the drift symptom, and it doesn't fire. The 19/23
UNCORROBORATED occurrences are downstream of the enum gate, inside the
corroboration-pattern check.

**Three separate mechanisms found, all producing the same reason code — NOT the
brief's primary "outside-the-quote" pattern; this is different in shape.**

**(a) `carveout_code: null` from the model is treated identically to "a code was
asserted but its pattern failed to corroborate."** ~7/23 measured (skechers
"the availability or cost of equity, debt or other financing to the Buyer
Parties" §1.1; redhat "any public statement by Parent regarding the Neutral
Platform Model..." §8.03(l); skechers "changes in regulatory, legislative or
political conditions..." §1.1; modiv "(j) the identity of Parent... as the
acquiror" and "(j) the identity of the Company... as the target" §8.12 x2;
topbuild "(F) any Action alleging breach of fiduciary duty..." §3.1 and §3.2 x2).
Confirmed from the recorded model responses: every one of these carries literal
`"carveout_code":null` — the model is following its own prompt instruction
(mae-definition-producer-prompt.js line 130: *"When no listed carveout_code fits
the clause, or you are unsure, set carveout_code to null and still emit the
assertion (do NOT silently drop it)"*) — an honest, correct "none of the 26
codes fit" answer for genuinely novel carve-outs (financing-cost carve-outs,
deal-specific press-release carve-outs, fiduciary-duty-litigation carve-outs,
acquiror/target-identity carve-outs — none of which has a registered
`MAE_CARVEOUT_CODES` slot). The resolver's `corroborated = carveoutCode ? ... :
false` collapses this correct-null case into the same UNCORROBORATED bucket as a
genuine pattern-match failure, even though they mean opposite things to a
reviewer.

**(b) `CHANGE_IN_LAW`'s pattern is too narrow for the extremely common compound
"applicable Law or GAAP" drafting form.** ~3/23 (metsera clause (C) "changes
after the date hereof in applicable Law or GAAP..."; redhat "any change in GAAP
or applicable Law..."; skechers "changes or proposed changes in GAAP or other
accounting standards..."). Pattern: `/changes? in (?:applicable )?Law|changes?
or developments? after the date hereof in applicable Laws|regulatory,
legislative or political/i`. Neither alternative tolerates "applicable Law"
(singular) followed immediately by "or GAAP", nor "changes ... after the date
hereof ... in applicable Law" with intervening words before "in". In every
sampled case the SAME clause is also independently tagged `CHANGE_IN_GAAP` by
the model (one clause naming both concepts, exactly per the prompt's own
"if a single clause legitimately matches TWO carve-out codes ... emit TWO ...
entries" instruction), and `CHANGE_IN_GAAP`'s pattern (`/GAAP/` or
accounting-principles) passes trivially — so the clause resolves once and fails
once, a duplicate-emission/mismatched-strictness shape, same class as
diag-qualifier-proxy.md's Part-2 ADJOURNMENT_REASON finding.

**(c) Genuine but too-literal/zero-gap-tolerance corroboration patterns miss
real qualifying language sitting a few words further away, inside the SAME
quote** (this is the dominant residual, ~9-10/23): `COMPLIANCE_WITH_AGREEMENT`
requires the literal adjacent string `"compliance with"` or `"required by this
Agreement"`, but real drafting reads "compliance **by any Party** with the terms
of this Agreement" (skechers) or "actions expressly **required of** the Company
**under** this Agreement" (topbuild (E)) — different preposition/word order, same
concept, same quote. `FAILURE_TO_MEET_PROJECTIONS`'s gap tolerance
(`.{0,30}` between "fail(ure)" and "to meet") is too small for "the failure, **in
and of itself, of the Company** to meet" (metsera (F), ~36 chars) or "any
failure, **in and of itself, by the Company Group** to meet" (skechers, ~40
chars). `ECONOMY_GENERAL` requires literal-adjacent `"general economic"` but
skywater's clause (A) reads "general **U.S. or global** economic conditions" —
a geography qualifier inserted between the two words. `ACTIONS_REQUESTED_BY_
PARENT`'s four alternatives are all noun-phrase forms ("request of Parent",
"Parent's request") and none match the inverse verb-first construction "which
**Parent has** ... consented to or requested" (skechers). One case
(redhat, NATURAL_DISASTERS on "**national** disaster") is the brief's **second
recurring species exactly** — the pattern is anchored to the single word
"natural" and the agreement's own carve-out literally reads "national disaster"
(a genuine synonym/variant, confirmed verbatim in the source, not an OCR
artifact — appears alongside "act of terrorism, war ... cyber-attack" in a
calamity-carveout list where "national disaster" is plainly used as a
near-synonym for what other agreements call "natural disaster").

One residual case (modiv "(e) resulting from the negotiation, execution,
announcement, performance, consummation or existence of this Agreement..."
tagged `COMPLIANCE_WITH_AGREEMENT` in addition to a passing `ANNOUNCEMENT_OR_
PENDENCY` tag on the same clause) reads as a **plausible correct refusal** —
the clause is about the Agreement's negotiation/execution/performance
generally, not an assertion of "compliance with" its terms; flagged uncertain,
not confidently a resolver bug.

**Verdict on the brief's primary pattern**: does **not** apply here. Every
corroborating word for the (c)-class misses is present **inside the claim's own
quote** — the regex is simply too tight (zero-to-30-char literal-adjacency
budgets) to reach it. This is a different, narrower defect shape from
REPRESENTATION_KNOWLEDGE_STANDARD_UNCORROBORATED (item 1, genuinely
outside-the-quote) and from CLOSING_CONDITIONS' PARTY_UNRESOLVED (unread field).

**Fix**:
- (a) **RESOLVER_SIDE, free.** Give `carveout_code: null` its own reason (e.g.
  `MAE_CARVEOUT_CODE_NOT_APPLICABLE` or similar) distinct from
  `MAE_CARVEOUT_UNCORROBORATED`, in `handleMaeCarveoutCandidate` — a one-line
  branch before the `corroborated` check. Recovers ~30% of the population by
  correctly separating "no code fits" (expected, honest) from "code asserted,
  pattern missed" (a real gap to keep tracking).
- (b) **RESOLVER_SIDE, free.** Widen `CHANGE_IN_LAW`'s pattern in
  `MAE_CARVEOUT_CORROBORATION_TABLE` (candidate-resolution.js ~3967) to accept
  "applicable Law or GAAP" / "GAAP or applicable Law" compounds and a wider gap
  between "changes" and "in ... Law".
- (c) **RESOLVER_SIDE, free**, several independent regex widenings in the same
  table: `COMPLIANCE_WITH_AGREEMENT` to accept "compliance by X with"/"required
  of X under"; `FAILURE_TO_MEET_PROJECTIONS`'s gap budget raised from 30 to
  ~60 chars (mirroring the qualifier-proxy Part-2 fix already made for
  ADJOURNMENT_REASON); `ECONOMY_GENERAL` to tolerate a geography phrase between
  "general" and "economic"; `ACTIONS_REQUESTED_BY_PARENT` to add a verb-first
  alternative; `NATURAL_DISASTERS` to add "national disaster" as a synonym.
  None of these touch the prompt — same recorded quotes, wider resolver regex.

---

## 3. PARTY_UNRESOLVED in MAE_DEFINITION (14) — DIAGNOSED, CORRECT REFUSAL

**Raised**: candidate-resolution.js ~8933-8936, inside `finalizeMaeClaim`'s
shared party-resolution tail (used by MAE_CARVEOUT/MAE_DEFINITION_PRONG/
MAE_DISPROPORTIONALITY alike):
```js
const party = resolveParty({ attributes: claim.attributes, mapping: partyMapping }); // party_field: 'definition_subject'
if (!party) {
  // Party-neutral subjects ("any Party", the Concho Annex-A form) queue
  // PARTY_UNRESOLVED -- correct, not a defect (spec section 4: "a
  // bilateral definition genuinely binds both parties and which
  // statistics row it feeds is a Ben call, not a lexicon default").
  pushMaeReview({ entry, claim, reason: 'PARTY_UNRESOLVED', normalisedPhrase });
  return;
}
```

**Population**: all 14 (2xk-final tag) are a single deal, **concho** — every one
of concho's MAE_DEFINITION Annex-A carve-out/prong/disproportionality clauses.
(A `-20260808-r1` predecessor run has the same 11 rows, confirming this is
stable across reruns, not a one-off.)

**Confirmed NOT the CLOSING_CONDITIONS sibling shape (party absent while a
sibling field sits unread).** Read the recorded model response directly
(`native-producer-recorded-response-Annex_A.json`): `"definition_subject":"any
Party"` — the field **is populated**, and `resolveParty` **does read it**
(`party_field: 'definition_subject'` in the mapping). `resolvePartyCapacity("any
Party")` correctly returns `null` because `PARTY_CAPACITY_LEXICON` only matches
literal party-name synonyms (company/target/parent/purchaser/buyer/pubco/merger
sub/seller) — none of which appears in the generic pronoun "any Party".

**Confirmed against the source agreement**: concho's Annex-A reads verbatim
`"Material Adverse Effect means, when used with respect to any Party, any fact,
circumstance, effect, change, event or development..."` — a genuinely SINGLE,
party-generic definition applying identically to Company and Parent, unlike
every other sampled deal (metsera, redhat, skechers, skywater), which each
define a separate "**Company** Material Adverse Effect" and "**Parent**
Material Adverse Effect". This is a real, confirmed drafting-form difference,
not an extraction gap: the model transcribed the chapeau's own words
faithfully, and the resolver correctly declines to force a TARGET-only or
BUYER-only capacity onto a definition the source document itself wrote as
bilateral.

**Diagnosis: correct refusal**, exactly as the resolver's own comment claims —
verified against real extraction data and the real source text, not just taken
on the comment's word (per CLAUDE.md's "read the code, not the comment" rule,
this one held up under an actual population check).

**Fix — not a bug, but a real, documented option exists**: `resolveParty`'s
multi-segment path already has a `JOINT_MULTI_PARTY_CAPACITY = 'JOINT_MULTI_
PARTY'` value (line 1278) for lists like "Company, Parent and Merger Sub" that
span both sides — but it is only reachable through `segmentPartyListString`
finding 2+ list segments, and "any Party" is a single token, never entering that
branch. A **TAXONOMY_DESIGN**-classed option (not something to patch silently,
per the resolver's own comment: "which statistics row it feeds is a Ben call")
would add a small single-token lexicon (`/\bany party\b/i`, `/\beach party\b/i`,
`/\bsuch party\b/i`, `/\beither party\b/i`) mapping straight to
`JOINT_MULTI_PARTY_CAPACITY`, letting Concho's 14 resolve as bilateral MAE
claims instead of parking in review — contingent on confirming
`MAE_DEFINITION_PRONG`/`MAE_CARVEOUT`/`MAE_DISPROPORTIONALITY`'s claim
definitions actually accept a JOINT_MULTI_PARTY party role downstream (not
checked — out of this diagnosis's scope, flagged for whoever picks this up).
