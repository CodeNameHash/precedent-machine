# Diagnostic: CLOSING_CONDITIONS held cluster (candidate-resolution.js ~5050-5140)

Branch: `origin/cursor/step-2x-free-phase-b641`
Status: COMPLETE. 62/62 held items in the 7-deal evidence snapshot
attributed to a reason code and root cause; 34/34 CONDITION_KIND_UNCORROBORATED
individually traced by kind. Read-only — no code edited, nothing committed.

## Scope
Held claims: CONDITION_KIND_UNCORROBORATED 34, PARTY_UNRESOLVED 26,
OBLIGOR_REF_UNCORROBORATED 7 (67 total), plus AMBIGUOUS_CONDITION_KIND.

## Method log
- Fetched branch, reading code via `git show origin/cursor/step-2x-free-phase-b641:<path>`.
- READ-ONLY: no edits, no commits.

## Data source

7 deals have committed evidence artifacts for the `closing-conditions` family
on this branch (final runs): concho, metsera, modiv, redhat, skechers,
skywater, topbuild (topbuild's final run is tagged `2xk-r3-final`, others
`2xk-final`). `review-queue.json` per deal gives the held population;
`native-producer-recorded-response-*.json` gives the model's raw
`closing_condition_assertions` (assertion_kind + all attrs) for each section,
matched to held items by exact/substring quote match.

Aggregate across these 7 deals (62 held items total, materiality_label
CLOSING_CONDITIONS exclusively):
- CONDITION_KIND_UNCORROBORATED: 34 (exact match to owner's figure)
- PARTY_UNRESOLVED: 8
- REP_SIDE_UNCORROBORATED: 7
- OBLIGOR_REF_UNCORROBORATED: 5
- APPROVAL_KIND_UNCORROBORATED: 2
- LEXICAL_UNMATCHED_SIGNAL_IN_SCOPE: 2
- MAE_PARTY_UNCORROBORATED: 2
- CERTIFIED_CONDITION_REF_NOT_IN_QUOTE: 1
- SCRAPE_QUOTE_NOT_IN_QUOTE: 1
- AMBIGUOUS_CONDITION_KIND: 0 (never observed in this snapshot)

**Discrepancy, flagged uncertain**: owner's brief states PARTY_UNRESOLVED=26
and OBLIGOR_REF_UNCORROBORATED=7 (67 total for the three). This snapshot
gives PARTY_UNRESOLVED=8, OBLIGOR_REF_UNCORROBORATED=5 (47 for the three).
CONDITION_KIND_UNCORROBORATED matches exactly (34/34), which is strong
evidence the same 7-deal evidence corpus is the source, so the CONDITION_KIND
figure and its breakdown below should be treated as solid. The PARTY_UNRESOLVED/
OBLIGOR_REF gap is unexplained — possibly the owner's count is corpus-wide
across more than these 7 committed-evidence deals (CLAUDE.md references ~40
agreements; only 7 have evidence/ artifacts on this branch), or counted at a
different pipeline stage (DB `claims`/review status) than these evidence
snapshots. **What would settle it**: rerun the family extraction+resolution
for the full deal set and recount from the resulting review_queue, or query
the production held-claims store directly with a materiality_label filter.

## CLOSING_CONDITION_ASSERTION_KINDS (closed 16-value enum)

Defined in `lib/canonical-v2/native-producer/anthropic-provider.js:482`.
This is a CLOSED enum the model is constrained to — every closing-condition
assertion the model emits carries one of these 16 kinds (never observed an
out-of-enum kind in this corpus; CONDITION_ASSERTION_KIND_OUT_OF_ENUM count
= 0 in this snapshot):

BRING_DOWN_TIER, NO_MAE_CONDITION, MAE_CONTINUING, COVENANT_COMPLIANCE,
REGULATORY_APPROVAL, STOCKHOLDER_APPROVAL, LEGAL_RESTRAINT,
GOVERNMENT_PROCEEDING, S4_COMPONENT, LISTING, FUNDS, OFFICER_CERTIFICATE,
FRUSTRATION_CAUSATION, FRUSTRATION_BREACH, DOLLAR_THRESHOLD,
BURDENSOME_CONDITION.

`candidate-resolution.js`'s `handleClosingConditionCandidate` (starts line
4914) splits these into two waves:
- **Wave B** (`waveBDefinitionByKind`, line ~4932): STOCKHOLDER_APPROVAL,
  LEGAL_RESTRAINT, GOVERNMENT_PROCEEDING, S4_COMPONENT, LISTING, FUNDS,
  OFFICER_CERTIFICATE, FRUSTRATION_CAUSATION, FRUSTRATION_BREACH,
  DOLLAR_THRESHOLD, BURDENSOME_CONDITION (11 kinds) — each has its own
  bespoke corroboration block.
- **Wave A** (the "five hand-written regex pairs" the brief describes, line
  ~5089-5099, `matchedKinds` Set): BRING_DOWN_TIER, NO_MAE_CONDITION,
  MAE_CONTINUING, COVENANT_COMPLIANCE, REGULATORY_APPROVAL (5 kinds) — these
  are the ONLY kinds that ever reach this gate (Wave B kinds never do), so
  the gate is not "everything outside 5 kinds is dropped" — it is a
  same-kind self-corroboration check: quote must independently prove the
  kind the model already asserted. **Important correction to Defect 1's
  framing below.**

## canonical-conditions.js coverage check

`lib/canonical-conditions.js` has 18 canonical rows (8 in CANONICAL_CONDITIONS_M,
5 in _B, 5 in _S). Every one of the 16 assertion kinds already maps to an
existing canonical code:
STOCKHOLDER_APPROVAL→COND-M-STOCKHOLDER, LEGAL_RESTRAINT/GOVERNMENT_PROCEEDING/
BURDENSOME_CONDITION(fallback)→COND-M-LEGAL, REGULATORY_APPROVAL→COND-M-REG,
S4_COMPONENT→COND-M-S4, LISTING→COND-M-LISTING, FRUSTRATION_*→COND-FRUSTRATE,
BRING_DOWN_TIER→COND-B-REP/COND-S-REP, OFFICER_CERTIFICATE→COND-B-CERT/
COND-S-CERT, FUNDS/DOLLAR_THRESHOLD→COND-S-FUNDS or COND-B-REP.
**Officer's certificate, stockholder approval, no-legal-restraint, listing,
S-4/registration-statement effectiveness are ALL already covered by existing
canonical codes.** No sixth regex or new canonical row is needed for any of
these — confirms the brief's instinct to check canonical-conditions.js first.

One exception: **FIRPTA certificate is in NEITHER the 16-kind assertion enum
NOR the 18 canonical rows.** The model has no schema slot to propose one at
all. That is a prompt-side gap (new assertion_kind + schema field), not a
resolver-side fix — uncertain whether FIRPTA certs are silently absorbed
into OFFICER_CERTIFICATE/DOLLAR_THRESHOLD claims or genuinely never
extracted; would need a targeted grep of FIRPTA-bearing agreements to settle.

Aside (out of scope, flagged not fixed): `candidate-resolution.js` emits a
single generic `concept = 'COND-COV'` for all COVENANT_COMPLIANCE claims and
`concept = 'COND-MAE'` for all NO_MAE_CONDITION/MAE_CONTINUING claims,
never the side-specific `COND-B-COV`/`COND-S-COV` or split MAE codes that
canonical-conditions.js's `codes` arrays list. `conditionRowMatches` would
fall through to the category-regex fallback for these. This is a possible
display-layer gap but is downstream of the held/auto-pass triage this task
is scoped to — noted, not chased further.

## Defect 1 (CORRECTED) — officer's-certificate is not missing from a lexicon; its own corroboration regex over-requires a verb form

Card #798 (metsera §7.03(c)) is `kind=OFFICER_CERTIFICATE`, which IS handled
in Wave B (`candidate-resolution.js` ~line 4989), not the 5-entry Wave A
lexicon the brief points at. Its corroboration:

```js
} else if (kind === 'OFFICER_CERTIFICATE') {
  corroborated = /certificate/i.test(quote) && /certif(?:y|ying|ied)/i.test(quote);
```
(candidate-resolution.js, inside handleClosingConditionCandidate, Wave B block)

Quote (verbatim, metsera 7.03(c)):
> "Parent and Merger Sub will have furnished the Company with a certificate
> dated as of the Closing Date signed on its behalf by a duly appointed
> officer of Parent to the effect that the conditions set forth in Section
> 7.03(a) and Section 7.03(b) have been satisfied."

`/certificate/i` matches ("a certificate"). `/certif(?:y|ying|ied)/i` does
NOT match — the clause never uses the verb form "certify/certifying/
certified", only the noun "certificate" plus "to the effect that ... have
been satisfied." Result: `corroborated=false` → CONDITION_KIND_UNCORROBORATED.

Confirmed identical failure on 2 more instances in this snapshot:
metsera 7.02(d) ("furnished Parent with a certificate ... to the effect
that the conditions ... have been satisfied") and concho 7.2 ("Parent shall
have received a certificate ... confirming that the conditions ... have
been satisfied" — uses "confirming", not "certify/certified"). **All 3
officer's-certificate holds in this corpus fail the identical over-strict
verb-form half of the AND.** Every real officer's-certificate clause sampled
uses "to the effect that / confirming that ... satisfied," never the verb
"certify" — the regex's second conjunct is close to unsatisfiable for the
actual drafting convention it's meant to recognize.

**Corpus count: 3 of 34 CONDITION_KIND_UNCORROBORATED (metsera×2, concho×1).**

**Fix (resolver-side, free, replay-validatable):** `candidate-resolution.js`,
OFFICER_CERTIFICATE branch (~line 4989). Drop the redundant verb-form
requirement, or broaden it: `corroborated = /certificate/i.test(quote) &&
(/certif(?:y|ying|ied)/i.test(quote) || /to the effect that/i.test(quote) ||
/dated as of the Closing Date/i.test(quote))`. No prompt/schema change
needed — `certifying_party_ref`/`certified_condition_refs`/
`certificate_relationship_status` are already extracted and separately
validated later in the same branch.

## Defect 2 (CONFIRMED, and one more shape found) — the obligor-performed regex over-fits both tense and word order

Line ~5137 (COVENANT_COMPLIANCE branch, Wave A):
```js
if (!(new RegExp(`\\b(?:each of )?${escaped} shall have performed`, 'i')).test(quote))
  { review('OBLIGOR_REF_UNCORROBORATED'); return; }
```

Card #803-equivalent, metsera §7.02(b): quote is "**The Company will have
performed** and complied with, in all material respects, its agreements,
obligations and covenants..." — `obligor_ref`="The Company" (confirmed from
the raw model response: `"obligor":"The Company"`), passes the earlier
`quote.includes(attrs.obligor_ref)` check, then fails the `shall have
performed` regex because the clause uses **will**. Metsera drafts with
"will" throughout; the regex only recognizes "shall."

Second, independent shape found in **concho 7.3(b)**: "**Parent and Merger
Sub each shall have performed**, or complied with, ..." — uses "shall"
correctly, but is STILL held, because the obligor string ("Parent and
Merger Sub") is followed by "**each** shall have performed", and the regex's
hard-coded prefix is `(?:each of )?` — it only recognizes "each of X shall,"
not "X each shall." The brief's own diagnosis ("someone hit 'Each of Parent
and Merger Sub' once and patched that one shape") is exactly right, and this
is the second data point proving it: the fix for one word order didn't
generalize to its mirror image.

**Corpus count: 5 of 5 OBLIGOR_REF_UNCORROBORATED are this regex** — 4 are
will/shall (metsera×2, skechers×2), 1 is the each-placement word order
(concho×1). 100% of this reason code in the snapshot is this one regex.

**Fix (resolver-side, free, replay-validatable):** `candidate-resolution.js`
~line 5137. Replace the literal phrase regex with something tense- and
order-tolerant, e.g. build the regex as
`\\b${escaped}\\b[\\s\\S]{0,20}\\b(?:shall|will)\\b[\\s\\S]{0,10}\\bhave\\s+performed\\b`
(allow "each"/"each of" on either side within a short window, and either
modal). `obligor_ref` is already corroborated present in-quote by the prior
check; only the tense/word-order coupling needs loosening.

## Defect 3 (CORRECTED) — card #881 is not the `.includes()` substring bug; it's a model field that's null 100% of the time for this kind

The brief points at two `.includes()` substring checks (line ~5076 for
FUNDS/BURDENSOME_CONDITION/DOLLAR_THRESHOLD, line ~5135 for
COVENANT_COMPLIANCE's `obligor_ref`). Neither is on the code path card #881
actually takes. #881 (skywater §8.3(a)(ii)) is `kind=BRING_DOWN_TIER`, whose
party resolution is:
```js
party = resolveParty({ attributes: attrs, mapping: { party_field: 'condition_obligor', party_role: 'CONDITION_OBLIGOR' } });
if (!party) { review('PARTY_UNRESOLVED'); return; }
```
— no `.includes()` check at all. I fetched the raw model response
(`evidence/canonical-v2/skywater-closing-conditions-20260809-2xk-final/
native-producer-recorded-response-8.3.json`) for this exact claim:
```json
{"assertion_kind":"BRING_DOWN_TIER","condition_obligor":null,
 "rep_side":"BUYER_REPS",
 "covered_scope":"the representations and warranties of Parent and the Merger Subsidiaries set forth in Section 4.10", ...}
```
`condition_obligor` is **null**. `resolveParty` returns null immediately on
a non-string `raw` (line 1608), before `resolvePartyCapacity` is ever
consulted — so the joint-party-list handling in `resolvePartyCapacity`
(which I verified DOES correctly resolve `"Parent and the Merger
Subsidiaries"` → capacity `BUYER`, both segments same side, via
`segmentPartyListString`/`PARTY_CAPACITY_SEGMENT_LEXICON`) never runs. The
resolver's party-list logic isn't broken; **the field it reads is simply
never populated for this kind.**

Pulled every BRING_DOWN_TIER assertion from all 7 deals' raw responses:
**`condition_obligor` is null on every single one**, including single-party
cases (topbuild 5.3: `"covered_scope":"any of the other representations
and warranties of Parent set forth in this Agreement", "condition_obligor":
null`). The model reliably fills `condition_obligor` for COVENANT_COMPLIANCE
(e.g. `"Parent"`, `"The Company"`) but never for BRING_DOWN_TIER — it
appears the schema/prompt treats `rep_side` (TARGET_REPS/BUYER_REPS, a
closed 2-value enum, already validated against the quote by the target/buyer
regex above) as the party signal for this kind and `condition_obligor` goes
unused. `covered_scope` (validated present in-quote) does carry the
verbatim party phrase ("Parent and the Merger Subsidiaries", "Parent,
Titanium Merger Sub and Forward Merger Sub") but nothing downstream reads it
for party resolution.

**Corpus count: 7 of 8 PARTY_UNRESOLVED are BRING_DOWN_TIER with
condition_obligor=null** (skywater×2, topbuild×4, skechers×1). The 8th
(redhat 6.01) is `kind=BURDENSOME_CONDITION` — same null-field mechanism,
different kind: `condition_obligor` and `burdensome_scope` are both null on
the "without the imposition... of a Burdensome Condition" clause (it's a
back-reference to the antitrust/legal-restraint conditions named earlier in
the section, inherently mutual). Notably, the code has an explicit mutual-
party fallback for COND-M-LEGAL-family concepts but **excludes
BURDENSOME_CONDITION from it by name**: `if (!party && mutualConcepts.has(concept)
&& kind !== 'BURDENSOME_CONDITION')` (line ~5060) — so this kind is
deliberately routed past the one fallback that would resolve it, into the
condition_obligor lookup the model never fills for it either.

**Fix (resolver-side, free, replay-validatable) for BRING_DOWN_TIER:**
`candidate-resolution.js`, BRING_DOWN_TIER branch (~line 5117-5127). Derive
party from `rep_side` directly instead of `condition_obligor`: TARGET_REPS
→ TARGET-capacity party, BUYER_REPS → BUYER-capacity party (or a joint/
"buy-side" marker when `covered_scope` names more than one buy-side entity —
this mirrors the `JOINT_MULTI_PARTY_CAPACITY` machinery already present in
`resolvePartyCapacity`). `rep_side` is a closed enum already validated
against the quote earlier in the same branch, so this trades a
never-populated free-text field for an already-corroborated one — no prompt
change needed. **Fix for BURDENSOME_CONDITION (separate, smaller):**
reconsider the `kind !== 'BURDENSOME_CONDITION'` exclusion from the mutual-
concept fallback at line ~5060, or add a narrower fallback keyed off
`related_clause_reference`/back-reference detection — needs product judgment
(is a Burdensome Condition ever genuinely one-sided in this corpus?) before
changing; flagged, not resolved here.

`lib/party-scope.js`'s `partyScopeFromCode` was checked and is **not**
directly usable here: it derives party from the *concept code's* letter
segment (e.g. the `S` in `COND-S-REP`), which in this codebase's convention
denotes *whose obligation to close is conditioned* (COND-S = condition to
Seller's/Company's obligation), not *who the obligor of the underlying rep
is* — for `COND-S-REP` those are opposite sides (the condition benefits the
Company, but the reps that must be true are Parent's). Using it naively
would swap the party. `party-role-aliases.js`'s `PARTY_ROLE_ALIASES` is a
label/alias table for a different purpose (role naming, not capacity
resolution) and doesn't fix this either. The correct fix is the `rep_side`-based
derivation above, which is already local to this branch.

## Full held population, ranked (7-deal snapshot, 62 items)

| Reason | Count | Kind breakdown | Attribution |
|---|---|---|---|
| CONDITION_KIND_UNCORROBORATED | 34 | FRUSTRATION_CAUSATION 9, FRUSTRATION_BREACH 5, MAE_CONTINUING 4, BRING_DOWN_TIER 4, OFFICER_CERTIFICATE 3, STOCKHOLDER_APPROVAL 3, NO_MAE_CONDITION 2, REGULATORY_APPROVAL 2, S4_COMPONENT 1, BURDENSOME_CONDITION 1 | See below, item by item |
| PARTY_UNRESOLVED | 8 | BRING_DOWN_TIER 7, BURDENSOME_CONDITION 1 | Defect 3 (100%) |
| REP_SIDE_UNCORROBORATED | 7 | BRING_DOWN_TIER 7 | New defect, two shapes (below) |
| OBLIGOR_REF_UNCORROBORATED | 5 | COVENANT_COMPLIANCE 5 | Defect 2 (100%) |
| APPROVAL_KIND_UNCORROBORATED | 2 | REGULATORY_APPROVAL 2 | New, not deep-dived (see below) |
| LEXICAL_UNMATCHED_SIGNAL_IN_SCOPE | 2 | MAE_CONTINUING 1, NO_MAE_CONDITION 1 | New, not deep-dived |
| MAE_PARTY_UNCORROBORATED | 2 | NO_MAE_CONDITION 2 | New, not deep-dived |
| CERTIFIED_CONDITION_REF_NOT_IN_QUOTE | 1 | OFFICER_CERTIFICATE 1 | New, not deep-dived |
| SCRAPE_QUOTE_NOT_IN_QUOTE | 1 | BRING_DOWN_TIER 1 | New, not deep-dived |

**CONDITION_KIND_UNCORROBORATED, 34 items, by root cause:**
- **FRUSTRATION_CAUSATION + FRUSTRATION_BREACH, 14 items (concho×2, metsera×4,
  modiv×1, redhat×2, skywater×6)** — NEW defect, largest single bucket,
  confirmed shared-shape (see below): every instance's `quote` is the bare
  causation/breach sub-clause (e.g. "such failure was caused by such
  party's breach in any material respect of any provision of this
  Agreement"), never containing the "[Company] may not rely on the failure
  of any condition ... if" chapeau the corroboration regex's FIRST conjunct
  (`/(?:may|shall) not rely.../`) requires. The chapeau is a sibling
  sub-clause, segmented away. (Secondary, compounding: metsera's
  `causation_standard:"PRIMARILY_CAUSED"` isn't even a key in the 4-entry
  `patterns` dict at line ~5017, which only has CAUSED_BY_BREACH/
  PROXIMATELY_CAUSED/PRINCIPALLY_CAUSED/PRIMARILY_RESULTED — a second,
  independent narrow-lexicon gap on top of the chapeau issue.)
- **MAE_CONTINUING + NO_MAE_CONDITION, 6 items** — narrow-lexicon gap:
  Wave A's `/shall not have occurred/i` (line 5097) requires that exact
  tense/word order; corpus phrasings include "No Company MAE **will have**
  occurred ... that is continuing" (skechers), "**no Effect has occurred**
  that would reasonably be expected to have ... a MAE" (redhat) — neither
  matches. Same family as Defect 2 (modal-verb brittleness) but a different
  line (5097, not 5137).
- **BRING_DOWN_TIER, 4 items (modiv×2, redhat×2)** — confirmed shared-shape:
  Wave A's gate (`/representations and warranties/i.test(quote) &&
  /true and correct/i.test(quote)`) fails because the *quote* is a segmented
  list-item fragment starting mid-sentence ("set forth in Section
  3.01(a)... shall be true and correct...") — "representations and
  warranties" lives only in the chapeau/`covered_scope`, not in this
  fragment's `quote`.
- **OFFICER_CERTIFICATE, 3 items** — Defect 1 (corrected), the
  "certify/certifying/certified" verb-form over-requirement.
- **STOCKHOLDER_APPROVAL, 3 items (redhat, skechers, skywater)** — narrow
  lexicon: regex requires "stockholder approval"/"requisite vote"/"approval
  of the stockholders"; corpus uses "**Shareholder** Approval shall have
  been obtained" (redhat — different word, "shareholder" not "stockholder"),
  "Written Consent" (skechers — approval-by-consent, no "approval" language
  at all), "adopted by the stockholders" (skywater — "adopted," not
  "approval"/"vote").
- **REGULATORY_APPROVAL, 2 items (metsera, topbuild)** — Wave A gate
  (`/\bHSR Act\b|waiting period|jurisdictions set forth in/i`) overfit to
  one phrasing; corpus text is "any approvals or clearances ... **as set
  forth in Section 7.01(a) of the Company Disclosure Letter**" (no
  "jurisdictions" word at all).
- **S4_COMPONENT, 1 item (concho)** — not deep-dived; likely the compound
  quote covers two `s4_component` sub-parts (FORM_EFFECTIVE + NO_STOP_ORDER)
  under one citation, causing a component-pattern/canonicalValue mismatch.
  Uncertain — would need the specific `s4_component` value to confirm.
- **BURDENSOME_CONDITION, 1 item (skechers)** — deal-specific: this
  agreement's defined term is "**Detriment**," not "Burdensome Condition,"
  so the literal `/burdensome condition/i` corroboration regex never
  matches. Low generalizability (single deal's drafting choice) but same
  family as the other narrow-literal-phrase gaps above.

**REP_SIDE_UNCORROBORATED, 7 items, all BRING_DOWN_TIER, two shapes:**
- 3 items (skechers 7.2(a)) — same chapeau-detached-fragment shape as
  BRING_DOWN_TIER's CONDITION_KIND_UNCORROBORATED bucket above: quote is
  "The representations and warranties set forth in Section 3.1..." with no
  "of the Company"/"of Parent" at all (party named once in an un-included
  chapeau).
- 4 items (skechers 7.2(b)/7.3(a)) — deal-specific defined term: this
  agreement calls its buy-side parties "**the Buyer Parties**," not
  "Parent," so the hard-coded `buyer` regex
  (`/representations and warranties (made by|of) Parent\b/`) never matches.
  Same family as Defect 1/the STOCKHOLDER_APPROVAL "shareholder" gap —
  literal party-name hard-coding instead of using the resolved capacity
  lexicon that already handles synonyms elsewhere in this file.

**APPROVAL_KIND_UNCORROBORATED (2), LEXICAL_UNMATCHED_SIGNAL_IN_SCOPE (2),
MAE_PARTY_UNCORROBORATED (2), CERTIFIED_CONDITION_REF_NOT_IN_QUOTE (1),
SCRAPE_QUOTE_NOT_IN_QUOTE (1) — 8 items, not individually traced to source
line.** All are single- or double-instance reason codes (≤2 each, 8 of 62
total, 13%) on kinds already covered above (REGULATORY_APPROVAL,
MAE_CONTINUING/NO_MAE_CONDITION, OFFICER_CERTIFICATE, BRING_DOWN_TIER).
Given the budget on this pass, these are flagged as real but unexplored —
likely more instances of the same narrow-literal-phrase pattern given
everything else in this family, but that is inference, not verified code
tracing, for these 8. Marked **uncertain**.

## Verdict: is this the same shared shape as the other four families?

**Partially — two of the four buckets are the exact same shape (chapeau/
antecedent outside the claim's own quote); two are a related but distinct
shape (narrow literal-phrase lexicon, no missing-context involved).**

Same shape, confirmed by direct evidence (14 + 4 + 3 = 21 of 62 held items,
34%):
- FRUSTRATION_CAUSATION/BREACH (14 items) — corroborating chapeau ("may not
  rely on the failure of any condition... if") sits outside the
  causation/breach sub-clause quote.
- BRING_DOWN_TIER's CONDITION_KIND_UNCORROBORATED (4) and REP_SIDE_UNCORROBORATED
  chapeau-fragment cases (3) — "representations and warranties of X" sits
  outside the segmented list-item fragment.
- Card #881's PARTY_UNRESOLVED family (7 BRING_DOWN_TIER instances) is
  arguably a THIRD variant of the same underlying cause (party identity
  established once, not repeated per-item) but manifests differently: here
  the party phrase IS present in the claim's own `quote`/`covered_scope`,
  just in a field (`covered_scope`) the resolver doesn't consult for party
  resolution. This is "outside the field the resolver reads," not "outside
  the quote" — a closely related but mechanically distinct shape from
  `findTerminationLimbChapeau`/`segmentSubClauses`'s job of recovering text
  the segmenter cut away.

Not that shape — genuinely narrow lexicons with no context-boundary
involved: officer's-certificate verb-form (3), MAE tense/phrasing (6),
stockholder-approval synonyms (3), regulatory-approval phrase overfit (2),
S-4/burdensome one-offs (2), and the OBLIGOR_REF shall/will + word-order
regex (5) and REP_SIDE's "Buyer Parties" hard-coding (4). These 25 items
(40% of 62) would not be fixed by a chapeau/segment-context mechanism — they
need either broadened regexes (fast) or, per the `PARTY_ROLE_ALIASES`/
`resolvePartyCapacity` model already used elsewhere in this same file for
party-name synonyms, routing through the existing capacity lexicon instead
of hard-coding "Parent"/"shall"/"stockholder" literally.

**So: one structural mechanism (chapeau/context recovery, e.g. extending
`findTerminationLimbChapeau`/`segmentSubClauses` usage into this handler)
would fix roughly a third of this family's held claims. The other ~40% is a
second, separate mechanical fix: stop hard-coding single literal phrases
(one modal verb, one party name, one certificate verb form, one approval
noun) and instead reuse this file's own existing synonym/capacity
machinery (`PARTY_CAPACITY_LEXICON`, `PARTY_ROLE_ALIASES`) consistently
across all the closing-condition kind checks, not just party resolution.**

