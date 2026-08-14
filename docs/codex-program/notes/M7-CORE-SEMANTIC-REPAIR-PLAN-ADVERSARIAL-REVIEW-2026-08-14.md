# Adversarial review: M7 core semantic repair plan

**Date:** 14 August 2026
**Reviewer:** Fable, auditor role, independent session. No drafting context shared
with the plan's author.
**Reviewed commit:** `0ad55f43` on `codex/recover-m7-20260812`
("Document M7 core semantic repair plan").
**Documents reviewed:** `M7-CORE-SEMANTIC-REPAIR-PLAN-2026-08-14.md` (the plan),
`M7-LAWYER-REVIEW-QUESTIONS-AND-ANSWERS-2026-08-14.md` (the Q&A transcript), the
PLAN.md amendment, verified against the sealed packet, ledger, evidence tree and
code at that commit.

## Verdict

**The diagnosis is right. The gate is not yet closed.**

Every root-cause claim in plan §3 verifies against the code, and several are
understated. The bound review result in plan §2 matches the sealed artefacts
byte for byte, and the transcript is a faithful copy of the packet and ledger
for all 50 items. Nothing in the reviewed commit touches a sealed M0–M4
artefact.

But the plan, as drafted, does not close the routes it exists to close. This
review found compliant implementations — implementations that satisfy every
sentence of the plan — that still mark incomplete rules complete, select wrong
topics, misuse the limited-drafting exception, and bypass the compiler binding.
The single most serious finding is not in the plan at all: **the completed
lawyer decision ledger, the factual basis for the entire repair, is sealed by
nothing** (finding F1). The findings below must be resolved by amendment before
the plan carries implementation authority. None of them requires abandoning the
plan's architecture; all of them require making its guarantees testable.

---

## 1. What was verified and holds

1. **Plan §2 matches the sealed record exactly.** Packet SHA-256
   `7a3fb9e7…`, packet ID `1508b03c…`, ledger SHA-256 `d9caf0ea…`, ledger ID
   `7a23e007…`, gate `FAILED_RETURN_AFFECTED_ITEM_TYPES_FOR_REPAIR`, counts
   19 / 31 / 0 — all confirmed against the files. Both content IDs recompute
   exactly under the repo's own `contentId` scheme
   (`lib/canonical-v2/canonical-bytes.js:46-60`,
   `scripts/stage-2y-m7-lawyer-sample-finalise.mjs:37-39`). The sample-policy
   hash `af4a927f…` verifies.
2. **The transcript is faithful.** All 50 items match the packet on review-item
   ID, family, item kind, section reference, source excerpt, compact row and
   expanded row; all 50 ledger decisions and verbatim notes match the
   transcript. No duplicate review-item or row IDs. Repair-set arithmetic
   (21 + 14 + 1 + 1 + 1 = 38, 12 controls, six correct-with-note = items 1, 2,
   22, 23, 24, 35, artefact = item 15) is consistent between plan §2 and Q&A §4.
3. **§3.1 confirmed, structurally.** The correction runner
   (`scripts/stage-2y-structure-m5-correct.mjs:109,149`) calls
   `policyForFamily()` and never reads the 25 sealed schemas
   (`evidence/canonical-v2/stage-2y-structure-migration/control/family-role-schemas/`,
   25 files confirmed). Worse than the plan says: `adaptCompoundFamily`
   type-guards its policy argument to `STAGE_2Y_M5_FAMILY_SPECIFIC_POLICY/V1`
   (`lib/canonical-v2/family-compound-adapter.js:320-324`), so the sealed
   schemas (`STAGE_2Y_FAMILY_REQUIRED_ROLE_SCHEMA/V1`) *cannot* be passed to the
   correction path at all. The schema-enforcing path
   (`family-aggregate → consolidateAnalysis`) existed, worked, and was routed
   around — this repo's documented failure mode, live in its flagship pipeline.
   And `policyForFamily` **manufactures its own approval markers**
   (`ben_approval_id: 'BEN-M5-CORRECTION-2026-08-12'`,
   `approval_state: 'BEN_APPROVED_AND_SEALED'`, lines 298-320), violating
   PLAN.md:585-590 ("It cannot manufacture legal authority").
4. **§3.2 confirmed, understated.** In the completeness test
   (`family-compound-adapter.js:269-289`): `LEGAL_EFFECT_OR_MECHANIC` and
   `MEMBER_FACTS` are non-empty for every proposition *by construction*;
   `QUALIFICATIONS` is never required for any family; the timing requirement is
   self-satisfying (the same regex hit both triggers and fulfils it, lines
   190-196, 217-224); dead conditionals at lines 197-199 are the residue of an
   abandoned stricter check. Review item 2's proposition (`e26c922f…`) is
   COMPLETE with the full 951-byte clause copied verbatim into its own
   `TRIGGER_OR_TIMING` bucket and empty `QUALIFICATIONS` — exactly as plan §3.2
   describes.
5. **§3.3 confirmed.** All 342 subtype role entries across the 25 sealed V1
   schemas share one identical generic five-role tuple.
6. **§3.4 confirmed at exact lines.** `agreement-projection.js` derives topics
   from claim keys (lines 144-180), humanises codes, filters attributes, and
   hard-codes `material_fact_omitted: false` (lines 490, 502) and zero omission
   counts (lines 523-524). The M6 run self-reported **1,111 normal rows, 0
   review rows, 0 material-fact omissions** across seven agreements
   (`shadow/m6/omission-ledger.json`, 1,111 × `material_fact_omitted:false`;
   projection row counts sum 110+169+174+236+169+160+93 = 1,111) — and the
   50-item human sample then failed 38 of 50. That contrast is the whole case
   for this plan, and it is real.
7. **§3.5 confirmed, with one correction.** The first-unit fallback exists at
   two levels (`m7-deterministic-generalisation.js:411-428` document-order
   fallback; `:383-394` heading-only container fallback). But at this commit
   `applySelectionModeGate()` (lines 767-810) already demotes
   `DOCUMENT_ORDER_FALLBACK` selections to BLOCKED. The plan's present-tense
   "can use the first authored unit" describes the run that produced the
   reviewed packet, not the current gating; §3.5 should say so (the residual
   heading-container fallback still needs the plan's replacement rule).
8. **Work 6 numbers reconcile.** 244 (`known-loss-244-ledger.json`, 244/244
   verified-fixed), 69 (`red-hat-69-ledger.json`; note one member
   `RESIDUAL_QUOTE_UNVERIFIED`), 23 (`m2-inline-23-ledger.json`;
   `dependent_propositions_blocked: 0`), all bound to corpus digest
   `b8825b71…`.
9. **Item 39 is bindable.** The packet item carries
   `lineage.ambiguity_id = 21f1bca5…`, which resolves in the m2-inline ledger
   and in the sealed Red Hat M2 index (`UNRESOLVED_INLINE_LIST`,
   `AMBIGUOUS_SAME_STYLE_RESTART`, bytes 229260–229525, status OPEN), under a
   LIMB whose reference is `7.01(d)`. The §3.6 overlay has a real anchor.
10. **The three audited commits touch no sealed M0–M4 artefact.** Verified by
    full file listing of `bcc19c0`, `b137602`, `0ad55f43` against the sealed
    receipt set (all sealed 2026-08-11, single-commit histories, intact). The
    apparent M4 collision is a basename collision only: M4 binds
    `shadow/m4/resolution-set-diff.json`, not the M7 file of the same name.

---

## 2. Material findings

Ordered by severity. Every finding cites the exact plan or Q&A section.

### F1. The completed decision ledger — the plan's entire factual basis — is sealed by nothing

**Where:** plan §2 ("Bound review result"); ledger at
`evidence/…/m7-comparison-entry-correction/lawyer-decision-ledger.json`.

The receipts sealed at `bcc19c0` bind the ledger in its **pre-review** state
(`PENDING_HUMAN_REVIEW`); no receipt anywhere binds the ledger's digest at all
(the two M6 receipts that mention it list its path in `changed_files` arrays
with no hash). Commit `b137602` then wrote Ben's 50 decisions and the FAILED
gate — and no reseal followed. The completed ledger's hash `d9caf0ea…` exists
only in the plan document's prose, which is itself unbound. **Anyone can edit
Ben's 19/31 verdicts, or flip `gate_state` to a pass, and no digest check in the
repository will ever notice.** This is route 1 (mark incomplete work complete)
at the programme level, and it is open today.

**Required amendment:** Work 0 must seal the completed ledger first — a receipt
binding `lawyer-decision-ledger.json` at `d9caf0ea…`, the packet at
`7a3fb9e7…`, and the plan document itself, signed as the repair's evidence
root. §11's gate must verify that binding.

### F2. The three programme rulings in plan §4 have no sealed record

**Where:** plan §4; Q&A §2.

All 25 calibration packs still record their three questions as
`OPEN_REQUIRES_BEN_RULING` with `ben_ruling_id: null` — there is **not one
non-null `ben_ruling_id` in the entire evidence tree**, and the decision ledger
contains only the 50 item decisions. The rulings the whole V2 architecture
stands on (one limb one rule; one owner with links; never guess), the extension
"the same answers apply to all 25 families", and the "final clarification
accepted by Ben" on programme question 2 exist only in the Markdown transcript.
Worse, the verbatim record shows Ben initially did not understand question 2
("I don't quite follow what you mean…"); the acceptance of the clarification is
precisely the part with no machine-readable record.

**Required amendment:** Work 0 must write and seal a programme-ruling ledger:
the three questions, the verbatim exchange including the initial
misunderstanding, the final labels, the all-25-families extension, Ben's
identity, and a fresh Ben confirmation of ruling 2 specifically. The 75 open
pack questions must be closed against it.

### F3. Invariant 11 does not deliver its promise: four of six compiler inputs are digest-bound nowhere, and the compiler attests its own digests

**Where:** plan §1 (input list), §5.2 (governance block), §7 invariant 11,
§9 Work 2 (final bullet), §10 case 13, §13 Q10/Q12.

`consolidateAnalysis` takes six inputs. The binding machinery binds three
things: compiler ID + code digest, profile ID + profile-set digest,
validation-result ID. `agreementIndex`, `contextCompilation`,
`approvedFamilyPackets` and `approvedStructureDispositions` are bound into no
rule and no successor receipt. Invariant 11 says "a caller cannot substitute an
unbound semantic path" — but a caller can, while passing every stated check,
substitute a doctored context compilation (a fabricated chapeau or definition
edge) or an unapproved overlay set. Separately, the entity computing and
stamping the governance digests is the compiler itself; the plan never says
where the *approved* digests are registered, who signs the registration, or
that the Work 7 gate independently recomputes the digest of the code actually
reviewed. The V1 precedent is exact: `policyForFamily` fabricated
`BEN_APPROVED_AND_SEALED` markers in code and the runner consumed them.

**Required amendment:** the governance block, invariant 11, Work 2 and §11 must
bind **all six inputs** by digest; approved compiler/profile-set/overlay-set
digests must live in a sealed registration file signed by Ben at Work 7, and
the gate must recompute the deployed code's digest against it.

### F4. The structure-disposition overlay is a general, ungoverned route to change effective M2 meaning

**Where:** plan §3.6, §9 Work 3 item 5, §9 Work 6, §10 case 5; Q&A item 39;
DECISIONS.md Decision 18.

The overlay mechanism is general; the plan authorises one overlay (item 39,
ambiguity `21f1bca5…`) but Work 6 requires rechecking all 23 parser
ambiguities, creating immediate demand for up to 22 more overlays with **no
defined authority path**: "governed" names no approver, and the "lawyer ruling"
is a field the implementer writes into the overlay. Only item 39 has an actual
ledger ruling. Combined with F3 (overlay set unbound), an overlay can be added
or edited after review without any digest failing. Two further wrinkles:
Decision 18 records Ben's rejection of single-source exceptions to structural
rules ("A Concho-only exception was not acceptable") — an item-39-only overlay
sits in tension with that precedent if parent-scoping resolves other members of
the 23; and the m2-inline ledger records `dependent_propositions_blocked: 0`
for this ambiguity, so the plan should state exactly what the overlay changes
(the recorded resolved reading, not any blocked row). Note also the M2 record
stores the competing readings as two labels (`AUTHORED_LIST`,
`CROSS_REFERENCE`), not materialised parse trees — acceptance case 5's "yield
one structure" test requires the overlay to construct both trees, which the
plan should say explicitly.

**Required amendment:** overlays are per-ambiguity-ID, each carrying a sealed
Ben ruling; the overlay set has a digest bound per F3; a validator rejects any
overlay whose ambiguity ID is not in the sealed M2 ambiguity set; the plan
states its relationship to Decision 18 (a bounded generic parent-scoping
principle applied ambiguity-by-ambiguity under ruling, not a one-item
exception).

### F5. The V1 path stays callable and the 1,111 defective rows have no disposal step

**Where:** plan §1, §3.1, §9 (no work item), §11, §13 Q10.

`agreement-analysis-consolidation.js` (V1) and `agreement-projection.js` remain
live and invoked by `family-aggregate.mjs`, `m6-project.mjs` and tests. No work
item retires, gates or graveyards the V1 path. §11's binding line inspects only
V2 rules — V1 output carries no binding and therefore **escapes the check
rather than failing it**. The 1,111 defective rows and their
`material_fact_omitted: false` ledgers stay in the evidence tree as
normal-looking outputs with no supersession marker.

**Required amendment:** a Work item that (a) marks the 1,111-row output set and
its ledgers superseded-for-all-consumers, (b) graveyards or hard-gates the V1
consolidation/projection entry points (successor M6 must refuse any input that
is not `AGREEMENT_ANALYSIS/V2` with valid bindings), and (c) adds a negative
test that the V1 path cannot produce a row the successor serving path will
read.

### F6. The programme's standing rules contradict the plan's authority and seal premise

**Where:** plan header ("M0-M4 stay sealed"); OPERATING-RULES.md:29-47;
DECISIONS.md Decision 19; COMPLETED.md M3/M4 closures.

The rules-of-record authority boundary still reads, dated 2026-08-11: "No M3 or
later implementation stage is authorised… The sealed M0, M1 and M2 artefacts
must not be changed." It was never amended for the M3/M4 closures (2026-08-11)
or Decision 19 (2026-08-12), which authorised M5–M7 shadow-only. A fresh
session obeying CLAUDE.md ("read the authority boundary in full") would
conclude the entire M5–M7 history was unauthorised. Separately, no rule or
decision formally names M3/M4 **sealed**; the plan's "M0-M4 stay sealed" and
§11's "M0-M4 remain byte-identical" are stricter than any recorded rule —
protective, but asserting a seal status the governing documents do not record.

**Required amendment:** update the OPERATING-RULES authority boundary to record
Decision 19 and the current position; have Ben ratify the M3/M4 seal so §11's
byte-identical gate has a rule behind it.

### F7. The "fixed 50" was already resampled once, under a commit message that says otherwise

**Where:** plan §2 ("The repair baseline is fixed. Do not resample it."),
§9 Work 5, §13 Q11; commit `bcc19c0`.

Commit `bcc19c0` ("Reseal M7 packet with plain deal labels") is not a relabel:
it re-ran projection and re-sampled the packet. Every item received a new
review-item ID, and several ordinals point at **different provisions
entirely** (ordinal 3 changed from a §5.02 access-information covenant to the
§5.09 delisting covenant; ordinal 1 changed provisions). This is internally
consistent — Ben reviewed the resealed packet and the ledger binds it — but it
proves the exact risk Q11 asks about: sample identity can shift wholesale under
an innocuous message, and the 19/31 verdict applies only to the resealed
sample. Any future "reseal" of the review baseline is a resample unless proven
otherwise.

**Required amendment:** Work 0's freeze must bind the 50 review-item IDs *and*
their source identities (node occurrence IDs / ambiguity ID / byte spans) in
the sealed evidence root (F1), and §11 must verify the replay ran against
exactly those identities. Commit messages that regenerate evidence must say so.

### F8. Two dispositions in the Q&A contradict the plan's own mechanics and invite sealed-work damage

**Where:** Q&A item 15 ("Remove the page-number artefact before semantic
compilation") and §11 ("the page-number artefact is removed"); Q&A item 39
("Repeated (i) under a different parent must parse normally"); plan §3.6, §5.1.

Removal-before-compilation means compiling over a mutated text stream: every
byte offset after the artefact shifts, so provenance either points into an
unsealed derived text or passes through an offset-translation shim — the exact
byte-offset error class CLAUDE.md records as having produced three confident
false findings. The plan's own §5.1 already provides the correct mechanism: a
governed non-modelled `SOURCE_ARTEFACT` span over the sealed bytes, no
removal. Similarly, item 39's disposition "must parse normally" reads as an M2
parser change, which §3.6 expressly forbids without separate authority.

**Required amendment:** rewrite both dispositions: item 15 → "cover the
page-number span with a governed SOURCE_ARTEFACT non-modelled disposition;
never mutate the compiled text stream"; item 39 → "resolve via the governed M5
overlay (§3.6); the M2 parser is unchanged"; align §11's artefact line.

### F9. Sub-clause verbatim "blob" facts satisfy every completion invariant while structuring nothing

**Where:** plan §5.1, §5.2 ("Whole-clause text is citation evidence only"),
§7 invariants 5-7, §9 Work 1, §10 case 1; Q&A items 2, 23, 24, 44.

Only *whole-clause* text is banned from satisfying a semantic field. A
compliant implementation of item 2 can emit
`cure_mechanism: <the entire 60-word limb (ii) verbatim>` and
`proviso_limit: <the entire proviso verbatim>` as text-typed facts: every byte
is covered by a proved fact, no residual connective spans exist (the `or`,
`earlier of` and `provided that` sit *inside* fact spans), the expression tree
legally collapses toward a single leaf, and invariant 5 ("preserves source
connectives and nesting") has no test that a connective inside a fact span
violates it. Acceptance case 1 says the rule must "record" the elements — a
verbatim labelled quote records them.

**Required amendment:** a granularity rule in §5.2 — no fact span may contain
an unmodelled operative connective, proviso marker or enumeration boundary;
deadline/period/party/standard values must be typed, not quoted; §10 cases 1
and 4 must each state the expected typed fields and expression-tree shape
(e.g. item 2: two deadline facts under earlier-of, an OR of cure branches, the
proviso as an exception node scoped to the grant).

### F10. Every completeness guard is indexed to profiles the implementer writes, with no minimum-specificity standard — and the replay questions inherit the thinness while presupposing the classification

**Where:** plan §3.3, §3.7, §5.3, §7 invariants 2-3 and 8, §9 Work 3/5, §11;
Q&A items 20, 22, 27, 31, 47, 49.

§7.3 ("every subtype-required field is present"), §7.8 ("every required
definition edge"), §11's "no complete rule lacks a profile-required material
field" — all requirements the V2 profile author writes. A NO_SHOP
disclosure-exception profile requiring `{obligor, disclosure_right}` marks item
31 COMPLETE while omitting all three things Ben flagged. Materiality has no
decider independent of the profiles (§5.2/§5.3), so "no material span is
unmodelled" is circular. And §3.7's subtype-specific replay questions
presuppose the classification: the broad question ("does this row preserve the
important legal meaning?") is precisely what caught the wrong-family failures
(items 20, 27, 47, 49); a field checklist about a mis-familied rule can be
answered yes on every field. Ben approves profiles (Work 3) — but Ben reviewing
a proposed field list cannot see what the list omits, which is exactly the
failure §3.7 describes for the original review.

**Required amendment:** each V2 subtype profile must ship with (a) positive and
negative corpus fixtures proving its deterministic test and field list against
real clauses Ben has ruled on, (b) an explicit "fields this profile does NOT
capture" declaration for Ben's approval, and (c) the Work 5 replay must retain
one broad meaning-preservation question per item alongside the field
checklist, plus "is this the right family and subtype?" as an explicit
question.

### F11. The enumerate-effects step has no completeness check, and implementer-authored non-modelled rules can absorb what it misses

**Where:** plan §3.5, §5.3 ("approved non-modelled span rules"), §7 invariants
6-7, §9 Work 1; Q&A items 6, 23, 46.

Nothing tests the enumeration itself: if the enumerator finds one effect where
item 23's Section 8.11 contains three (specific performance; automatic
Termination Date extension; Financing Sources no-recourse — Ben flagged the
latter two), the missed limbs never face a subtype test. The intended backstop
is the coverage partition, but §5.3 lets profiles carry non-modelled span rules
justified by a deterministic rule with **no specific lawyer ruling**, and Work
1's anti-hiding fixture is disarmed by its own qualifier ("…without its exact
approved rule"): once a bad rule is inside an approved profile, hiding passes
by construction. Concrete: generalise Ben's item 46 ruling into "definitional
lead-in text up to the first quoted term is structural" and it eats item 6's
opening "with respect to any agreement or covenant in this Agreement" — an
operative scope limiter. A "For purposes of this Section 5.2 only" fixture is
absent from Work 1.

**Required amendment:** every non-modelled *rule* (not just span) requires a
lawyer ruling at profile approval, listed separately from the field contract;
Work 1 gains fixtures: a multi-effect unit whose enumeration must find all
three effects (item 23's own text), and scope-limiting preambles that must NOT
be structural.

### F12. SOURCE_LIMITED's absence proof is over an undefined and narrowable scope

**Where:** plan §6, §7 invariant 1, §9 Work 2; §8 example; Q&A items 4, 9.

`SOURCE_LIMITED` requires "the complete reviewed source scope proves that
result", but the scope is never defined, and Work 2 narrows inspection to
M4-bound units. Route (a), definition inheritance — item 9: the match-period
day count lives in the defined term "Superior Proposal Notice Period"; a
profile treating `match_period_days` as an expected display dimension but not a
required dependency yields COMPLETE + SOURCE_LIMITED with a *truthful* absence
proof while the agreement states the number one definition edge away — exactly
Ben's complaint. Route (b), truncated units — item 4 proves the review surface
itself can omit a governing chapeau ("Can't see the chapeau but I think it is
right"); an absence proved over a truncated unit is not an absence. Also
unresolved: whether source quality is per-rule or per-field — §8's "normal
lawyer view" example shows a `Not expressly stated…` line without the reviewed
scope and lawyer ruling §6 requires for APPROVED_LIMITED, and §6 excludes whole
*rows* from market statistics when one dimension is absent (overbroad).

**Required amendment:** define the absence-proof scope as the complete
governing authored unit **plus every resolved definition and reference edge
required by the profile** — an expected dimension reachable through a required
dependency edge is never SOURCE_LIMITED; make the observation per-field with
per-field ruling display; require the successor packet to render the complete
scope (chapeau included) that the lawyer is ruling on.

### F13. Invariant 1 has no proof procedure inside the Work 2 bounds — required chapeaux may be unreachable, and heading-derived context is not banned

**Where:** plan §7 invariant 1, §9 Work 2 ("Add only M3-proved chapeaux…",
"not… scanning every M2 node"), §11; Q&A items 4, 40.

If M3 never proved the chapeau edge a closing condition needs (whose
obligations are conditioned; who can waive), the unit can never satisfy
invariant 1 inside the stated bounds — the item is permanently REVIEW_ONLY, in
direct tension with §11's requirement that item 40 receive an evidenced
repair. The pressure resolves the bad way: source the party scope from the
section heading, which §3.5 bans only for *topic* proof, not for context.
Nothing records or binds the candidate set a run actually inspected, so the
bounding rule itself is enforced by prose only.

**Required amendment:** an explicit governed escalation: when invariant 1 fails
for want of a context edge, the run records a typed
`CONTEXT_EDGE_UNPROVED` defect naming the M2 node it believes governs; adding
that edge is a bounded, lawyer-ruled context amendment (new M3-layer evidence,
not an M2 change, not silent heading use). Successor receipts must bind the
inspected candidate-set digest so the bounding is checkable.

### F14. "No increase in unresolved source items" perversely rewards forcing classifications

**Where:** plan §9 Work 2, §11.

The honest effect of stricter V2 tests is that many of the 1,111 false-complete
rows become INCOMPLETE/AMBIGUOUS → REVIEW_ONLY. "Unresolved source items" is
undefined; if it includes REVIEW_ONLY dispositions, the constraint is
unsatisfiable by honest work, and the compliant route is to force marginal
units into some single-matching subtype or absorb spans under non-modelled
codes to keep the count flat — at sign-off, corpus-wide, where Ben only reviews
changed results.

**Required amendment:** define the term as governed-identity accounting only
(every M4 claim identity mapped to exactly one successor disposition; nothing
dropped), and state explicitly that REVIEW_ONLY counts are expected to *rise*
and are not a gate failure.

### F15. Single-match is treated as proof of correct classification; "compatible" is undefined; family scope and family corrections are unspecified

**Where:** plan §3.5, §5.3, §7 invariant 2, §9 Work 2/5, §11, §13 Q2/Q4;
Q&A items 20, 27, 29 vs 48, 33/34/47, 49.

The anti-wrong-topic defence is "exactly one compatible approved subtype" —
which detects error only when two profiles fire. If the wrong test is
over-inclusive and the right test under-inclusive (or the right profile does
not exist yet), exactly one profile matches — the wrong one — and the rule
compiles NORMAL. Concrete: any deterministic test tuned to keep control 29
(Company-MAE consummation prong) passing will also fire on item 48's
Parent-MAE text. "Compatible" is undefined for parent/child subtype paths
(§8's hierarchy): if ancestor/descendant matches are compatible-resolve-to-
parent, every carve-out compiles under the generic parent profile — exactly
the shallowness Ben rejected in items 33/34/47. The plan also never says which
families' profiles are tried against a sealed-seven unit (only the old M4
family's, or all 25); items 20, 27, 49 need cross-family moves that the
cheaper reading never attempts. And Work 5's "record the family correction"
names no approver — over the whole corpus (Work 6), the implementer records
family corrections unilaterally, including into families whose profiles are
laxer. One more mapping hole: "map each old row to its successor rule" is
singular, but ruling 1 splits rows into linked children — for item 23 the
replay could bind the easiest child rule and show that beside Ben's note.

**Required amendment:** (a) define compatible: within one family, an
ancestor/descendant pair resolves to the most specific *only when the
descendant's test passed*; a match at generic level with no specific-subtype
attempt is INCOMPLETE, not NORMAL; (b) all 25 families' profiles are candidates
for every unit; cross-family single-match still requires a recorded family
correction; (c) every family correction carries a lawyer ruling (sampled Ben
review for corpus-wide corrections, itemised for the 50); (d) Work 5 maps old
rows to the complete linked rule *set*, and the replay displays the set.

### F16. NO_COMPARISON and the per-family "no-output policy" are self-approvable pressure valves invisible at the gates

**Where:** plan §5.3, §6, §9 Work 6/7, §10 case 6, §11; Q&A items 15, 41.

§11 checks that an approved reason *exists* per no-comparison row — never the
breadth of the deterministic test that routes rows there. A test justified
from item 41 ("Article II unit mentioning Paying Agent, letter of transmittal,
or surrender") also captures item 15's dissenting-shares clause, which Ben
confirmed is a genuine comparison row. The family-level "approved no-output
policy" is worse: passive voice, no named approver, no criteria — and a family
routed to no-output produces no changed results, so Work 7's Ben review never
sees the suppression.

**Required amendment:** NO_COMPARISON subtype tests need negative fixtures
(item 15's clause must NOT match item 41's rule); the no-output policy requires
an explicit Ben ruling per family; §11 must list, by family, row counts by
disposition including no-comparison and no-output, so a hollowed family is
visible at sign-off.

### F17. The six-operator expression model cannot express drafting in this very sample, and nothing requires compilation to be deterministic — so identical drafting can produce different rule identities

**Where:** plan §5.2, §5.3, §7 invariant 5, §8 (equivalence signature),
§9 Work 1, §13 Q8; Q&A items 6, 17, 23, 31, 33-36, 47, 11 vs 30.

No operator exists for: priority overrides ("Notwithstanding anything to the
contrary…", item 23's Financing Sources limb — one of the two limbs Ben
flagged — and control 17); partial exceptions with consequence modification
("except… to the extent…, in which case only the incremental disproportionate
effect shall be taken into account", items 33-36 and 47); conditional deeming
("shall be deemed to be a Parent Change of Recommendation", item 31); compound
intent-plus-knowledge standards (item 6). Each shoehorn validates cleanly
while encoding wrong semantics. In the other direction, every Work 1 test runs
one way (different structure → different identity); nothing requires that the
same bytes produce the same tree twice, or that near-identical clauses across
deals (items 11 vs 30; 33/35/36 vs 47) produce comparable signatures — under
§5.2's identity rule, nondeterministic encoding manufactures false cross-deal
differences, which is fatal to a precedent-comparison product.

**Required amendment:** either extend the authorised operator vocabulary
(override/priority, conditional, scoped partial exception with consequence
modifier) or specify per-profile the canonical encoding of each known proviso
pattern; add convergence tests to Work 1 (same bytes → identical rule; the
sample's near-duplicate pairs → equal-shaped trees and comparable signatures).

### F18. Fact identity and ownership across families is undefined — and the ruling it rests on is the one Ben visibly did not follow

**Where:** plan §4 ruling 2, §7 invariants 8-9, §13 Q7; Q&A programme question
2, items 25, 28, 42.

"The same fact" has no definition. Value-keyed identity merges the two legally
distinct six-year periods in items 28/42 (survival of rights vs
no-adverse-amendment of charter provisions), erasing the distinction Ben drew.
Span-keyed identity makes item 25's `7.01(f)` trigger two facts (one in
TERMINATION_FEE, one in TERMINATION), defeating the owner rule. Ben's recorded
note on programme question 2 was "I don't quite follow what you mean"; the
clarification he accepted covers storage dedup only — and per F2 even that is
unsealed.

**Required amendment:** define the canonical fact-identity key
(family-agnostic: resolved source span set + typed value + field semantics);
give cross-family links a validator; and have Ben re-confirm ruling 2 with the
items 28/42 example in front of him.

### F19. M6 reconciliation is fact-ID-only: value fidelity, label-fact binding and the compact layout all escape it

**Where:** plan §8, §9 Work 4, §10 cases 10-12, §13 Q6; Q&A items 13, 18.

Reconciliation stops on unmatched fact IDs. A fact whose displayed value is
truncated or mis-rendered still matches its ID. Labels are M6's own domain, so
swapping labels between two facts of one rule — payer/payee, from-whom/to-whom
— passes reconciliation while recreating exactly the failures of items 13 and
18. And §8 permits compact and expanded layouts without saying which layout
must carry display-required facts — empty compact rows were part of the
original complaint surface.

**Required amendment:** reconciliation must check (fact ID, typed value, label
binding) tuples; a rendered-value round-trip test per row; a compact-layout
floor (at minimum the full classification hierarchy and applies-to); the
omission ledger computed per layout.

### F20. "The 12 clean controls do not regress" is undefined, and no lawyer ever looks at the repaired controls

**Where:** plan §2, §9 Work 5 ("Re-review the 38… Re-run the 12"), §11;
Q&A items 3, 17, 33.

Every control card's rendering changes under V2 (Ben's item 33 note orders the
new layout for "all of the other cards too"), so byte- or field-diff
definitions fail all 12 and the plan supplies no alternative. The wording
contrast is load-bearing: the 38 are *re-reviewed* (Ben), the 12 are *re-run*
(nobody). A control whose subtype has no approved V2 profile yet falls to
REVIEW_ONLY by the plan's own §6 table — regression by design (controls 3 and
16 are in no archetype family). An implementer can define non-regression as
"still COMPLETE and NORMAL" and substantively degrade a control unseen.

**Required amendment:** define regression per control — same source identity,
same family and subtype (or a Ben-ruled correction), no previously displayed
correct meaning removed, disposition stays NORMAL — and put the 12 repaired
control cards in front of Ben in the Work 5 packet with their old cards
side-by-side (they are 12 cards; the cost is trivial).

### F21. Three ledger records contradict themselves, and the successor replay's handling is unspecified

**Where:** plan §2, §9 Work 0/5, §11; Q&A items 2, 4, 45.

Item 2: decision `CORRECT`, verbatim note begins "No - it gets it generally
right but misses specifics". Item 4: `INCORRECT` with "Can't see the chapeau
but I think it is right" — functionally a cannot-judge caused by a packet
defect, yet §2 reports "Cannot judge: 0" (the sample policy's
`cannot_judge_rule` would have returned the item type for repair; the recorded
INCORRECT reaches the same repair outcome, but the record misdescribes what
happened). Item 45: `INCORRECT` with no note at all — §11 requires "every one
of the 31 incorrect decisions has an evidenced repair", and item 45's repair
has no note evidence to repair against; its CLASSIFICATION diagnosis is a
programme inference. All three are safely inside the 38-item repair set, so no
item escapes repair — but any successor tooling that keys repair membership or
the side-by-side display off the decision enum will misread item 2 as a pass.

**Required amendment:** Work 0 freezes repair-set membership off the Q&A §4
repair-class table, not the decision enum; the Work 5 packet displays verbatim
notes beside enums and flags the three contradictions rather than resolving
them; items 2, 4 and 45 get explicit fresh questions (4 with the chapeau
rendered; 45 re-asked from scratch).

### F22. What "after adversarial approval" authorises is never enumerated

**Where:** plan §0 (programme boundary) vs §9 title, §11.

The boundary withholds implementation, model calls, database writes, selector
changes, serving changes and publication; §9 is titled "Implementation work
order after adversarial approval". Nothing enumerates which of the withheld
effects that approval unlocks, in which paths. The only brake is "all external
and product effects remain zero", with "external/product" undefined relative
to shadow evidence writes. Related: the plan silently assumes the zero-model-
call constraint through M9 (PLAN.md:124; Decision 18) — V2 compilation of
typed facts and expression trees must be **deterministic**; the plan never
states this constraint or its consequence (classes that resist deterministic
compilation land INCOMPLETE/REVIEW_ONLY and stop under §12; they may not wait
for a model).

**Required amendment:** a one-paragraph authority grant in §9: exactly which
effects Work 0-7 may produce (shadow evidence writes on the recovery branch;
no model calls; no database, selector, serving or publication effects), signed
by Ben with the approval.

---

## 3. Minor findings and observations

- **M-1.** TopBuild (QXO / TopBuild, agreement
  `3888fa7618bbd9fd6530b657aaa18c7e85ff515acf80edb1fc78a190af86e9cb`) has
  **zero human-reviewed items** despite the largest projection (236 of 1,111
  rows) and the largest known-loss contribution (84 of 244). Within the sample
  policy — coverage strata require per-agreement coverage only for the additive
  three — but a real blind spot the plan should name. Work 6's corpus audit is
  the mitigation; §11 should require it explicitly for TopBuild. (Note: the
  review brief's shorthand `57aaa18c…` is a mid-string fragment of that ID,
  from a truncated filename in a commit stat; use the full ID.)
- **M-2.** The additive-three cohort is AbbVie/Landos, Lilly/Verve,
  Rocket/Redfin. Their sampled record: AbbVie/Landos 0-for-14, Rocket/Redfin
  0-for-1, Lilly/Verve 1 clean control. The additive path has exactly **one**
  demonstrated human-confirmed success. Work 5's replay alone cannot qualify
  the additive path; §11 should demand additive-three calibration evidence
  beyond the fixed 50.
- **M-3.** The plan cites the schema directory as `control/family-role-schemas/`
  (migration-root-relative shorthand); the repo path is
  `evidence/canonical-v2/stage-2y-structure-migration/control/family-role-schemas/`.
- **M-4.** PLAN.md §§10-11 still mandate the V1
  `consolidateAnalysis(baseAnalysis, approvedFamilyPackets)` contract the plan
  supersedes; the receipts table names no successor receipts; the header still
  reads "As at 2026-08-11". Amend PLAN.md when the plan is adopted.
- **M-5.** GRAVEYARD entry 16: typed TERMINATION_FEE payment-timing schemas
  (V3/V4: `payment_trigger_event`, structured `{count, unit, bound_type}`
  delay) are already built and tested, deliberately unregistered. Work 3 class
  1 includes TERMINATION_FEE and never cites them — the repo's #1 failure mode
  (rebuilding what exists) waiting to recur. Same class: Decision 18's
  correction of Decision 13 (exact source + approved role schema is the
  oracle) should be cited as the authority for FamilyProfile V2's rigour.
- **M-6.** The packet's `coverage.grouped_row_count` is 9 but only 8 sampled
  items carry a linked point. Cosmetic, but the successor packet generator
  should assert its own coverage metadata.
- **M-7.** The "combined ten-agreement corpus digest" does not hash ten
  agreement IDs: it is `contentId` over `{sealed_seven_digest (four receipt
  bindings), additive_agreement_ids (3)}`, and `combined_agreements: 10` is a
  hard-coded literal (`stage-2y-structure-generalisation-shadow.mjs:326-351`).
  It is a corpus-state binding, which is fine — but documents should not imply
  it is a content hash of ten sources.
- **M-8.** A full sweep of 4,289 `{path, sha256}` bindings across the evidence
  tree found 14 stale bindings (none caused by the three audited commits):
  the M1 receipt carries a stale draft-time binding of `prototype/m1/decision.json`
  alongside the correct final one (same path, two hashes — a strict validator
  should reject that receipt); `m5-preparation-authority.json` binds
  `docs/core/PLAN.md` by content hash, guaranteeing permanent staleness for a
  living document; 12 historical receipts bind code files as-of-run that have
  since moved. None is tampering; together they prove **receipt verification
  is not continuously enforced** — and the verification script itself
  (`scripts/stage-2y-structure-migration-validate.mjs`) cannot even load in a
  fresh checkout (`MODULE_NOT_FOUND: react` via
  `lib/review-parity/rendered-row-preview.js` with empty node_modules). The
  plan's binding architecture (F3) needs an enforced, dependency-light
  verifier in CI, or it will rot the same way.
- **M-9.** §12's class-level stop condition ("no single approved subtype
  fits" stops the affected legal class) has no definition of "affected legal
  class"; read literally one anomalous clause halts seven families, so
  implementers will self-scope it. The per-unit behaviour (§3.5: return
  unclassified/incomplete) already exists; define the class-stop trigger
  (e.g. >N% of a family's units failing) or drop it.
- **M-10.** The plan's "successor" vocabulary collides with the unrelated
  `contracts/canonical-v2/successor/` tree (GRAVEYARD entry 15). Name the new
  modules and receipts unambiguously.
- **M-11.** Item 39's review card shows "Section reference: Not recorded"
  although the sealed M2 index places the ambiguity under a LIMB with
  reference `7.01(d)` — the parentage acceptance case 5 relies on exists but
  was not surfaced to the reviewer. The successor packet should render it.

---

## 4. Answers to the plan's §13 questions

**Q1. Can any catch-all source value still make an incomplete rule look
complete?** Yes. The ban covers whole-clause text only; sub-clause verbatim
blobs cover the partition, swallow connectives, and pass invariants 5-7 and
acceptance case 1 as drafted (F9). Thin profiles make the required-field test
itself gameable (F10). Closed by the granularity rule, typed-value
requirements, and typed acceptance-case shapes.

**Q2. Can a heading, cross-reference or first-in-document fallback still
select the wrong topic?** The three named routes are addressed (the
document-order fallback is even already gated in code — `applySelectionModeGate`
demotes it to BLOCKED). But wrong topic survives by subtler routes: a single
wrong profile matching alone is accepted as proof (F15); "compatible"
parent/child resolution can legitimise generic-profile rows (F15); the family
candidate scope for sealed-seven units is unstated (F15); heading-derived
*context* (as opposed to topic) is not banned (F13); and the successor's
subtype-specific questions presuppose the classification they should test
(F10).

**Q3. Can the source-coverage test miss a material proviso or nested limb?**
Yes, three ways: a truncated governing unit passes coverage over the wrong
scope, and invariant 1 has no proof procedure inside the Work 2 bounds — item
4 is the live demonstration (F13); the effect-enumeration step has no
completeness check, so missed limbs never face the partition as *effects*
(F11); and implementer-authored structural/non-modelled rules can lawfully
absorb operative spans (F11, the item 46 → item 6 generalisation).

**Q4. Can two profiles match and still produce a normal row?** As drafted,
yes in the reading where ancestor/descendant matches count as "compatible" and
resolve to the parent — which reproduces the shallow rows Ben rejected. The
plan must define compatibility and require most-specific-with-passed-test
(F15). The bigger hole is the converse: one *wrong* match producing a normal
row with no ambiguity signal at all.

**Q5. Can SOURCE_LIMITED be abused to excuse extraction failure?** Yes. The
absence proof is over an undefined "complete reviewed source scope" that Work
2 narrows: facts stated one definition edge away (item 9) or in an unbound
chapeau (item 4) can be truthfully "not expressly stated" in the inspected
scope (F12). Per-field vs per-rule state is unresolved and §8's own example
omits the required scope-and-ruling display. Closed by defining the scope to
include required dependency edges and rendering the full ruled-on scope to the
lawyer.

**Q6. Can M6 omit a required fact while its reconciliation still passes?**
The fact-ID reconciliation closes silent *dropping* of facts. It does not
close value truncation, label-fact swaps (payer/payee — items 13/18's exact
failure class), or compact-layout emptiness, and the "approved omission"
ledger has no stated author or approver (F19).

**Q7. Can one source fact be duplicated across families despite the owner
rule?** Yes — "the same fact" is undefined, and both natural identity keys
fail in opposite directions on this very sample (merging items 28/42's
distinct six-year periods; duplicating item 25's 7.01(f) trigger). The ruling
underneath (programme question 2) is also the one Ben visibly misunderstood,
and it is unsealed (F2, F18).

**Q8. Does the legal-expression model preserve the actual structure without
becoming too broad?** Not yet. Six operators cannot express priority
overrides, partial exceptions with consequence modification, or conditional
deeming — all present in the sample — so shoehorning is guaranteed; and with
no determinism/convergence requirement, §5.2's identity rule converts encoding
noise into false cross-deal differences (F17). The model needs either a wider
closed operator vocabulary or per-profile canonical encodings, plus
convergence tests.

**Q9. Are the V2 profiles specific enough to prevent false completeness
without an unmanageable subtype explosion?** Unprovable as drafted: no
minimum-specificity standard exists, so every completeness guard is indexed to
what the profile author chose to require (F10), and the two escape valves —
NO_COMPARISON breadth and the per-family no-output policy — are self-approvable
and invisible at the gates (F16). The explosion risk is real but bounded by
the archetype ordering and Ben's approval; the falsifiability gap is the
binding problem.

**Q10. Does any runner bypass the shared compiler?** Today, yes by
construction: the V1 consolidation and projection paths remain callable, the
1,111 defective rows have no disposal step, and §11's binding line inspects
only V2 rules, so V1 output escapes rather than fails (F5). The binding
itself is self-attested by the compiler with no registration ceremony or
independent recomputation (F3) — and the V1 correction demonstrated the exact
attack, fabricating `BEN_APPROVED_AND_SEALED` markers in code.

**Q11. Can the fixed 50 be silently remapped to easier source units or new
rows?** The packet's identity binding is good (node occurrence IDs, ambiguity
ID for item 39, recomputing content IDs). But the risk is demonstrated, not
hypothetical: `bcc19c0` resampled the packet — new review-item IDs, ordinals
pointing at different provisions — under the message "Reseal M7 packet with
plain deal labels" (F7). Work 5's mapping has three unclosed routes: family
corrections with no approver, one-to-one mapping under limb splitting binding
the easiest child, and tooling that keys off the decision enum misreading item
2 (F15, F21). And the completed ledger these identities live beside is itself
unsealed (F1).

**Q12. Is there any path that changes M0-M4, serves data, calls a model or
starts M8?** The three audited commits change no sealed M0-M4 artefact, and
the plan authorises no serving, model calls or M8. But four paths need
closing: the completed decision ledger — the record that M7 *failed* — can be
rewritten without any digest failing (F1); the structure-disposition overlay
plus four unbound compiler inputs form a route to change effective M2/M3
meaning without touching sealed bytes (F3, F4); Q&A item 15's
"remove the page-number artefact" instruction invites compiling over a mutated
text stream, severing byte provenance against sealed source, and item 39's
"must parse normally" reads as a forbidden M2 parser change (F8); and the
standing rules never formally sealed M3/M4 nor recorded the M5-M7
authorisation, so the plan's boundary rests on documents that contradict it
(F6).

---

## 5. The seven review routes, answered

1. **Mark an incomplete legal rule complete:** open — blob facts (F9), thin
   profiles (F10), enumeration gaps + non-modelled absorption (F11), and at
   programme level the unsealed FAILED gate (F1).
2. **Omit a material source fact:** open — truncated units (F13),
   SOURCE_LIMITED scope abuse (F12), M6 value/label/compact blind spots (F19).
3. **Select the wrong legal topic:** open — single-wrong-match acceptance,
   undefined compatibility, unstated family scope, unapproved family
   corrections (F15); replay questions that presuppose classification (F10).
4. **Misuse the limited-drafting exception:** open — undefined absence-proof
   scope, definition-inheritance route, per-field/per-rule ambiguity (F12).
5. **Alter sealed M0-M4 work:** no direct route in the reviewed commits;
   indirect routes open — unbound overlay/context inputs change effective
   meaning (F3, F4), item 15's disposition invites derived-text compilation
   (F8), and the M3/M4 seal itself is formally unrecorded (F6).
6. **Bypass the approved compiler or family rules:** open — V1 path callable
   with no disposal (F5), self-attested digests with no registration or
   independent recomputation (F3), fabricated-approval precedent unaddressed
   by name (F3).
7. **Regress any of the 12 clean review controls:** open — "regress" undefined,
   no lawyer review of repaired controls, profile-gap regression to
   REVIEW_ONLY by design (F20).

## 6. Disposition

The plan should **not** receive implementation authority in its current form.
It should be amended per F1-F22 — F1, F2, F3 and F5 are preconditions for
Work 0 even beginning, since they concern the integrity of the evidence the
repair stands on — and then return for a short second adversarial pass limited
to the amendments. The architecture (one compiler, typed rules, expression
trees, state separation, M6 as formatter) survives this review intact; what
does not survive is the assumption that any of its guarantees are currently
testable.

One note on the review that produced the 19/31 result: nothing in this audit
suggests the extraction quality was a surprise the system could have caught
internally. The run reported 1,111 complete rows, zero review rows and zero
material omissions because its completeness definition was satisfiable by
construction and its omission counter was a hard-coded zero. The first honest
measurement of this pipeline was Ben's 50-card review. The plan's core move —
making completeness a falsifiable, profile-bound, coverage-partitioned claim —
is the right one; the amendments above exist to keep the V2 guarantees from
becoming satisfiable by construction in their turn.
