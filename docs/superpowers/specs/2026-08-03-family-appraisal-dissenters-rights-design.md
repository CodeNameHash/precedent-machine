# Family — Appraisal / dissenters' rights (APPR-*)

**Date:** 2026-08-03. **Status:** AUDIT-AMENDED (6 MATERIAL findings
applied in full [M-1..M-6]; 4 MINOR findings applied [m-1, m-2, m-4 in
full; m-3's parked sub-item RULED by Fable at fold review 2026-08-03:
the narrower corroborated proxy is the receipt of record for grounding
receipt A; the unpinned wider counts are historical context only — see
the inline ruling at receipt A]) (program convention: spec-detail →
audit → build → review).
**Parent:** `2026-08-02-openworld-promotion-program.md` (five-layer promotion
structure and cross-slice invariants apply verbatim).
**Template:** `2026-08-02-p1-captable-numerics-design.md` (slice shape,
typed-abstain discipline, corroboration tables, coverage-map honesty pins).
**Wave exemplars bound:**
`2026-08-02-family-termination-fee-design.md` + the BUILT modules at head
(`lib/canonical-v2/native-producer/{producer-prompt-registry.js,
section-family-classifier.js,termination-fee-producer-prompt.js,
termination-fee-parse.js}`, commit e98695a) — the registry-dispatch
exemplars this spec is written against: registry entry + stage-1 title rule
land in this family's own reviewed diff; shared title-pattern constants
where an exclusion pairs with a claim (the TERMF_TITLE_PATTERN /
NO_SHOP_TITLE_EXCLUSION_PATTERN device, both live at head);
`2026-08-02-family-consideration-design.md` — **this family's dominant
boundary neighbour and a NAMED DISPATCH COLLISION (boundary 1): its
`CONS-DISSENT` concept owns appraisal-rights STATUS
(AVAILABLE/NOT_AVAILABLE) and its classifier port claims
"Dissenting/Appraisal" titles.** Cited throughout, never redefined;
`2026-08-02-family-closing-conditions-design.md` (presence-claim shape;
"no parser is a ruled decision" — applied here family-wide; its own
COND-B-DISSENT zero-population refusal is this spec's boundary 2);
`2026-08-02-family-specific-performance-remedies-design.md` (the REM-CAP
dispatch-vacuity ruling and the REM-NONRECOURSE one-deal-is-not-a-
grounding-set rule — applied to the statutory-regime enum and the
max-dissent threshold);
`2026-08-03-family-dno-indemnification-design.md` (heading-grounded
classifier rules curing stage-1 vacuity — stage-1 rules below are authored
from REAL title surfaces, receipt G);
`2026-08-03-family-dividends-design.md` (small-family honesty:
concept count scaled to evidence; attribute non-promotion of modality
qualifiers; sibling-collision handling as a named Ben call);
`2026-08-03-family-merger-structure-closing-design.md` (its
`CONSID_MECHANICS_TITLE_PATTERN` port already DECLINES dissent titles from
MERGER_STRUCTURE — confirming no third family claims this surface; it also
proposes materiality rank 88 for its own `MERGER_STRUCTURE` tier
(2026-08-03-family-merger-structure-closing-design.md:893) — a same-wave
rank collision with this spec's own proposed rank 88, named as an
unresolved Ben call in section 4).
**Protocol authority:** docs/codex-program/EXECUTION-LEDGER.md — M3 review
protocol + extraction semantics rules 1–3 (producer NEVER asserts a
negative). This spec may not amend them.
**Lexicon authority:** `2026-08-02-lexical-disagreement-net-design.md`
(word boundaries, case-sensitive defined terms, deletion asymmetry, priced
blind spots; static max ≤ 128; explicit `\b` on every case-sensitive
defined-term regex; `LEXICAL_FAMILY_LEXICON_VERSION` is **4** at head
(lexical-disagreement-net.js:181) — this slice bumps to the next number at
build time, re-checked then; no test may pin the head numeral, only
`version === importedHeadConstant + 1`).
**Materiality:** no tier covers this family today (`MATERIALITY_TABLE`,
`lib/canonical-v2/native-producer/candidate-resolution.js` ~658–673 at
head carries 10/20/30/40/50/52/55/60/70/90; `CONS-` holds 60). A resolved
appraisal-mechanics claim would rank UNCLASSIFIED 99, below notices.
Section 4 proposes ONE exact-keys tier, flagged for Ben.

## Corpus grounding — population honesty first

**This family ships TWO concepts, both presence claims, and NO value
parser.** That shape is forced by the evidence, in both directions:

- The two shipping mechanics are among the best-populated single-drafting
  patterns in the corpus: the parent settlement/consent control covenant
  appears in **29 cards / 29 deals** (receipt C2, "offer to settle" +
  appraisal context) and the withdrawal/loss-of-status reconversion
  mechanic in **44 cards / 30 deals** (receipt C2) — out of 40 corpus
  deals. This is not a small-population family; it is a small-CONCEPT
  family, because most of its text restates two statutory mechanics in
  near-boilerplate form.
- The family brief's only numeric — a max-dissent closing-condition
  threshold ("dissenting shares below X%") — has **ZERO corpus
  population**: `COND-B-DISSENT` has 0 cards / 0 deals (evidence pack §2,
  confirmed by direct subtype query; independently confirmed by the
  closing-conditions spec, which found the same zero and refused to
  register the code), and receipt E's label-blind sweep of every
  percentage literal co-occurring with dissent vocabulary found only
  non-family numbers (a 19.9% Share Cap, 90% Top-Up thresholds, a 45%
  cash-election proration cap, note coupons, PSU vesting). **No threshold
  concept and no percentage parser ship. The recorded successor choice
  retires the comparable M3 field and preserves future exact language as
  open-world evidence.**
- The brief's "DGCL 262 vs other-state regimes (enum)" is NOT shipped as
  an enum (Grounding correction 4): the consideration spec already ruled
  statutory citations are a verbatim OPTIONAL `statute_ref` attribute and
  "jurisdiction vocabulary is a Ben adjudication over observed
  statute_ref values later" — this spec adopts that device rather than
  colliding with that ruling, and the non-DGCL populations are each
  one-deal besides (below). FLAGGED FOR BEN as a family-brief deviation.

Evidence pack read 2026-08-03 (pack quotes are ground truth, cited by
provision_card id); seven supplementary SELECT-only queries run 2026-08-03
by this spec's author against production Supabase (project
`tzulhdasmioeechxapdy`, `provision_cards`), receipts inline below.

**v1 label landscape (pack §2–§3, untrusted throughout):** DEF-DISSENTING
16/15, CONSID-DISSENT 13/13, COV-APPRAISAL 2/2 (data-quality suspect —
byte-identical `primary_quote` AND identical `section_ref` hash across two
different deal_ids, AND `provision_type` stored as DEFINITION against the
rubric's `type: 'COV'`; Grounding correction 3), COND-B-DISSENT 0/0. The
label-blind content population is 182 cards / 37 deals on an
`(appraisal|dissent)` match (185 cards adding `Section 262`; the exact
number is sensitive to the query definition, which is not otherwise pinned
here — the magnitude and the homes conclusion below are what is
load-bearing) — the dedicated labels capture a minority; the family's
operative text lives mostly inside
CONSID-CONVERT (26), CONSID-EXCHANGE (21), DEF-GENERAL (24),
DEF-MERGERCONSID (18), and null-subtype STRUCTURE_MECHANICS (13). v1
labels are therefore population hints only; every grounding below cites
quote bytes.

### Grounding set 1 — parent control / settlement-consent covenant
(29 cards / 29 deals; twelve named exemplars, receipt C)

The uniform legal core: Parent directs (or participates in) appraisal
negotiations and proceedings, and the Company may not pay, settle, or
offer to settle appraisal demands without Parent's prior written consent.
Named grounding cards (deal, section, drafting variant):

- `e473a572-6464-455c-8357-86a031fd7ea1` (deal `320a3899…`, §3.3; also
  pack §4): "Parent will have the opportunity and right to direct the
  conduct of all negotiations and proceedings with respect to demands for
  appraisal. Except with the prior written consent of Parent, the Company
  shall not voluntarily make any payment with respect to any demands for
  appraisal or settle or offer to settle any such demands for appraisal,
  or agree to do any of the foregoing."
- `4bf075bd-f8df-4eed-9b5a-b44597009cb7` (deal `667447f0…`, §3.3; pack
  §4): "(at Parent's sole cost and expense) … right to participate in and
  direct all negotiations and Proceedings … including any determination
  to make any payment or deposit … under Section 262(h) of the DGCL prior
  to the entry of judgment" — the cost-allocation and §262(h)
  pre-judgment-payment variant.
- `be2ed546-9bfc-4838-9d1a-8827367e8c10` (deal `00d49e6a…`, §2.06):
  adds "waive any failure to timely deliver a written demand for
  appraisal under the DGCL, approve any withdrawal of any such
  de[mands]" — the widest consent-scope variant (payment, settlement,
  waiver of procedural defects, withdrawal approval).
- `9a48ab72-d245-4e97-b765-6190756b81ec` (deal `0a043659…`, §3.08):
  "shall not, except with the prior written consent of the Parent
  Entities, make any payment, or offer or agree to make any payment …
  or offer to settle or settle any such demands." — plural consent-holder
  ("Parent Entities").
- `50946e9a-cb8d-4502-bfcd-0dc1154a7499` (deal `0d38cc1f…`, §2.4 —
  Theravance/Zymeworks, **Cayman**): "…except with the prior written
  consent of Parent, make any payment with respect to any exercise of
  Dissenter Rights or any demands for appraisal or offer to settle or
  settle any such Dissenter Rights or any demands or approve any
  withdrawal…" — **the SAME card the consideration spec commits as its
  Cayman AVAILABLE fixture.** One card, two families' facts: its
  presupposition sentence corroborates `CONS-DISSENT`
  AVAILABLE under that spec's flagged ruling; its consent sentence
  grounds THIS family's settlement-consent claim. Distinct claim
  surfaces, no double-claiming — pinned in boundary 1 and test 4.
- `f281f4b3-3fec-4fb4-a458-c3622d6c07de` (deal `4f015417…`, §2.01):
  "…without the prior written consent of Parent (which consent shall not
  be unreasonably withheld or delayed), voluntarily make any payment…" —
  the reasonableness-qualified consent variant.
- `3e4bd292-c7fa-4bd3-b708-2af55736cf0b` (deal `555579a6…`, §2.07; pack
  §4's `[PROPOSED]` card): "Except with the prior written consent of
  Parent, **or if required by Applicable Law**, the Company shall not
  make any payment…" — the legal-compulsion carve-out variant.
- `eac817ab-a306-43e2-bc9c-af197ecfaed2` (deal `2c143f44…`, §4.2,
  CONSID-EXCHANGE home): "…schedule any meeting or make any payment with
  respect to any such demands for appraisal or offer to settle or settle
  any such demands." — **Texas regime deal (TBOC Chapter 10, Subchapter H
  — receipt D shows the same card's withdrawal limb citing it)**, and
  proof the covenant lives inside exchange-mechanics cards too.
- `17ed5240-a278-41ff-a4c5-23d627cffe70` (deal `448e524f…`, §4.2,
  CONSID-EXCHANGE home): "Parent shall have the right to direct all
  negotiation with the Dissenting Stockholder(s)…"
- `4d67d6aa-d67d-4ee3-9b69-a962afe4065d` (deal `13211d88…`, §2.7,
  CONSID-CONVERT home): "The Company may not, except with the prior
  written consent of Parent, make any payment … or settle or offer to
  settle any such demands … For purposes of this Section 2.7(d)(ii),
  \"participate\" means…" — the defined-"participate" variant, and "may
  not" rather than "shall not" (modality variance is real; not promoted —
  Registry rulings below).
- `1119ed4b-cd08-40e8-bc03-ecf45f0a290d` (deal `2b9a6571…`, §2.01,
  CONSID-CONVERT home): "…offer to settle or settle, **or approve the
  withdrawal of**, any such demands…" — the named cross-kind trap: the
  settlement limb itself contains the token "withdrawal" (resolver §4).
- `e6c173d1-ca92-4ed8-b48e-5f4caf1f4e89` (deal `1e4b7102…`, §2.3):
  "participate in and **reasonably and in good faith** direct all
  negotiations…" — qualified-direction variant.

Corroborating count: "prior written consent" co-occurring with
appraisal-demand vocabulary = 27 cards / 27 deals (receipt C2) — the
consent gate is the drafting's constant even where "offer to settle"
ordering varies ("settle or offer to settle" vs "offer to settle or
settle" both attested above; any corroboration pattern must not depend on
the ordering).

### Grounding set 2 — withdrawal / loss-of-dissenter-status reconversion
(44 cards / 30 deals; ten named exemplars, receipt D)

The uniform legal core: shares that fail to perfect, withdraw, or lose
appraisal rights forfeit dissenter status and are deemed converted into
the right to receive the merger consideration (recurring value-shape:
"without interest" — pack §5). Named grounding cards:

- `be2ed546…` (deal `00d49e6a…`, §2.06 — same card as grounding set 1):
  "if any such Person shall fail to perfect or otherwise shall waive,
  withdraw or lose the right to appraisal under Section 262 of the DGCL,
  then the right of such Person to receive those rights … shall cease
  and such Appraisal Shares shall be deemed to have been converted as of
  the Effective Time int[o]…" — one card carries BOTH mechanics; the
  co-resolvable-pair pin (§1) exists because of this shape.
- `9a48ab72…` (deal `0a043659…`, §3.08): "…shall not be cancelled and
  converted into, or represent the right to receive, the Company Merger
  Consideration … unless such holder fails to perfect, withdraws or
  otherwise loses the right to appraisal."
- `4d437c49-afee-43d5-b021-b2d21279e2d0` (deal `0d38cc1f…`, §2.1,
  CONSID-CONVERT home — **Cayman**): "who has validly exercised and not
  withdrawn or lost its right to dissent from the Merger (\"Dissenter
  Rights\") pursuant to Section 238 of the Cayman Companies Act…"
- `4d67d6aa…` (deal `13211d88…`, §2.7): "…who shall have failed to
  perfect or who shall have effectively withdrawn or lost their rights to
  appraisal … will thereupon be deemed to have been converted into, and
  to have become exchangeable for, as of the Effective Time, the right to
  receive the Per S[hare]…"
- `2faf7939-d272-4630-a2cd-0b71d81baac0` (deal `13894e33…`, §1.6): adds
  the judicial limb — "or if a court of competent jurisdiction shall
  determine that such Person is not entitled to the relief provided by
  Section 262 of the DGCL" — a third loss-of-status route beyond
  failure-to-perfect and withdrawal (also in `e6c173d1…`, `c583f453…`).
- `e6c173d1…` (deal `1e4b7102…`, §2.3): "If any such holder fails to
  perfect or otherwise waives, withdraws or loses his, her, its or their
  right to appraisal…"
- `c583f453-d4b1-4a71-833c-17dd5af93b3f` (deal `1f80bec7…`, §2.7,
  STRUCTURE_MECHANICS/null home): "…shall have failed to perfect or
  shall have effectively withdrawn or lost such holder's right to
  appraisal and payment under the DGCL…"
- `1119ed4b…` (deal `2b9a6571…`, §2.01): the defined-term-scoped variant
  — dissenter status is written INTO the defined term: "(such shares
  being referred to collectively as the \"Dissenting Shares\" **until
  such time as** such holder fails to perfect, withdraws or otherwise
  loses such holder's appraisal rights…)".
- `eac817ab…` (deal `2c143f44…`, §4.2 — **Texas**): "…unless and until
  such Person fails to comply with the provisions of Chapter 10,
  Subchapter H of the TBOC or effectively withdraws or otherwise loses
  such Person's rights to receive payment under Chapter 10, Subchapter H
  of the TBOC." — non-DGCL drafting with NO "right to appraisal" phrase
  at all (regime-vocabulary warning honored in the corroboration table).
- `3db98df7-03c5-4b57-827e-59202d076f2c` (deal `448e524f…`, §4.1):
  the Excluded-Shares composition variant — "(ii) Shares that are owned
  by stockholders (\"Dissenting Stockholders\") who have perfected and
  not withdrawn a demand for (or lost their right to) appraisal rights
  pursuant to Section 262 of the DGCL".

**Query receipts (SELECT-only, `provision_cards`, run 2026-08-03):**

- **A** — settlement/control vocabulary × dissent content.
  **FABLE RULING (2026-08-03, at fold review, resolving the m-3 park):
  a receipt whose query pattern text is not pinned is not reproducible
  and cannot be the receipt of record. The RECEIPT OF RECORD for this
  bullet is the NARROWER, corroborated proxy pattern (the one re-run at
  audit), whose counts stand: CONSID-CONVERT 9/9, with the same
  zero-covenants-article homes distribution. The wider unpinned-pattern
  counts (CONSID-CONVERT 15/12, CONSID-DISSENT 8/8, STRUCTURE_MECHANICS/
  null 6/6, CONSID-EXCHANGE 4/4, DEF-DISSENTING 2/2, tail 1s) are
  retained below as HISTORICAL, UNREPRODUCIBLE context only — nothing in
  this spec may cite them as grounding.** The load-bearing conclusion is
  unchanged and stands on the receipt of record: the covenant's homes
  are consideration-article sections, NOT a covenants article — the
  dispatch design (§3) rests on the corroborated homes distribution,
  not on the exact deal-count split.
- **B** — withdrawal vocabulary × dissent content, by home:
  CONSID-CONVERT 12/12, CONSID-DISSENT 9/9, STRUCTURE_MECHANICS/null 7/6,
  CONSID-EXCHANGE 4/4, DEF-DISSENTING 3/3, REP-T-FAIRNESS 3/3, tail 1s.
- **C** — "offer to settle" + appraisal/dissent context: 12-deal sample
  quoted above (grounding set 1). **C2** — exact counts: settlement 29
  cards/29 deals; withdrawal-reconversion ("fail to perfect|withdraw…" ×
  dissent × "right to receive") 44 cards/30 deals; "prior written
  consent" × appraisal demands 27/27.
- **D** — withdrawal-reconversion 12-deal sample quoted above (grounding
  set 2), including the TBOC and Cayman §238 regimes.
- **E** — max-dissent-threshold zero-check: every card matching dissent
  vocabulary AND a percentage literal is a NON-family number (19.9% Share
  Cap in `c90905ab…`; 90% Top-Up in `3f2af5fd…`; 3% Top-Up Option in
  `1c11836d…`; 3.625% note coupon in `812a8cbc…`; 45% cash-election cap in
  `b224d0ee…`; 100% PSU vesting in `c92cae64…`). **Zero max-dissent
  closing conditions exist in this corpus.**
- **F** — lexicon noise: "offer to settle" fires on 11 cards OUTSIDE
  dissent context (litigation/indemnification territory — priced
  exclusion, §5); `fail(s|ed)? to perfect` fires on **0** cards outside
  dissent context (a zero-noise discriminator, the receipt-2-class
  anchor); "demands for appraisal" = 23 cards / 17 deals, all on-topic;
  the withdraw-or-lose bigram = 0 hits outside dissent context.
- **G** — the real title surface: "Dissenting Shares" (DEF +
  STRUCTURE_MECHANICS homes), "Dissenting / Appraisal Rights"
  (CONSID-DISSENT's uniform v1 label), "Dissenting Shares / Appraisal
  Rights", "Shares of Dissenting Holders / Appraisal Rights",
  "Dissenting Company Shares" (DEF), "Appraisal / Dissenters Rights"
  (the COV-APPRAISAL data-quality pair, DEF-article home), and ONE
  interim-operating title: §7.1 "[PROPOSED] No Actions Triggering
  Appraisal/Dissenters Rights" (COVENANT_INTERIM_OPERATING/null) — the
  grounded IOC-side exclusion case (§3). These titles are the v1
  `section_ref` label surface, which this spec elsewhere rules untrusted;
  mitigated because the real in-quote heading bytes ("Dissenters'
  Rights", "Appraisal Rights", "Dissenting Shares", "No Dissenters'
  Rights") independently match the proposed stage-1 rules, so this is not
  a REM-CAP vacuity case.

## Grounding corrections (verified against repo + production DB,
2026-08-03)

1. **No registered v2 vocabulary exists for this family.** No `APPR-` key
   anywhere in `lib/canonical-v2/`. The nearest registered surface is the
   consideration spec's PROPOSED `CONS-DISSENT` × `APPRAISAL_RIGHTS_STATUS`
   (unbuilt — head registry carries CAPITALISATION, TERMINATION_FEE,
   NO_SHOP, AND MAE_DEFINITION — four entries, not three
   (producer-prompt-registry.js:83-86)). Both concepts below are new and
   FLAGGED FOR BEN (the
   2026-07-23 convention: this spec proposes, Ben settles).
2. **v1 carries NO structured fields for either shipping mechanic.**
   `CONSID-DISSENT`, `DEF-DISSENTING`, `COND-B-DISSENT` have no FEATURES
   entries at all (pack §1). `FEATURES['COV-APPRAISAL']`
   (`lib/rubric.js` ~4707: parentInfoRights, parentParticipationOrControl,
   settlementConsent, paymentConsent) is prior art for APPR-SETTLE's
   product intent, but its only 2 cards are the byte-identical
   data-quality pair — so the v1↔v2 comparator has only card-level
   presence to disagree with in this family; stated so nobody claims a
   field-level comparator surface that cannot exist.
3. **v1 defect flags for ingest-QA, never absorbed here:** (a) the
   COV-APPRAISAL pair `cd5f80a7…`/`23a32894…` — byte-identical
   primary_quote AND identical section_ref hash across two deal_ids, plus
   provision_type stored DEFINITION against the rubric's COV type (pack
   §4/§6.6): possibly one document double-attributed; COV-APPRAISAL
   counts are NOT treated as independent signal anywhere in this spec;
   (b) the `[PROPOSED]`/`Unclassified`/null-subtype dissent sections
   (receipts A/B: 6–7 STRUCTURE_MECHANICS/null cards) — real family
   content invisible to label queries, which is why every population
   claim above is content-based; (c) the uniform "Dissenting / Appraisal
   Rights" short_title collapsing carve-out, reconversion, settlement
   control, and even the LLC "no appraisal rights" negation under one
   label — v1 labels are UNTRUSTED input throughout this spec.
4. **The family brief's "DGCL 262 vs other-state regimes (enum)" has
   insufficient in-family grounding AND a sibling ruling against it.**
   Observed regimes: DGCL §262 (dominant, with subsection-precision
   citations §262(a)/(d)(2)/(h)/(k) — pack §5); Cayman Companies Act §238
   (1 deal, `0d38cc1f…`); TBOC Chapter 10 Subchapter H (1 deal,
   `2c143f44…`); NRS 92A.300–92A.500 (1 deal, embedded in a Top-Up Option
   card `3f2af5fd…`, not a dissent section); MGCL §3-201 (1 deal, quoted
   in the consideration spec's Forest City fixture); VSCA §13.1-721 (1
   deal, Kraft — no dissent-labeled card exists for it at all, pack §4).
   One deal per non-DGCL regime is not a grounding set (REM-NONRECOURSE
   rule), and the consideration spec already pinned statutory citation as
   verbatim OPTIONAL `statute_ref` with jurisdiction vocabulary deferred
   to Ben. This spec adopts the identical attribute device (§1) and ships
   NO enum. FLAGGED FOR BEN as a family-brief deviation.
5. **The family brief's max-dissent closing-condition threshold is
   zero-population** (receipt E; COND-B-DISSENT 0/0; the closing-
   conditions spec's independent zero). No concept and no percentage
   parser ship in M3. The later recorded choice retires
   `DISSENT_THRESHOLD` as a comparable M3 field and keeps any future exact
   language open world. The decision register carries the adjacent
   session-message provenance.
6. **Bundle version numbering:** this spec binds to "the next frozen
   version at this slice's merge"; every superset-diff acceptance test is
   written against CONTENT (sorted key sets), never the numeral.

## Cross-family boundaries (BINDING; duplication is an automatic audit
CRITICAL; each pin has a named acceptance test in section 6)

1. **Consideration family — `CONS-DISSENT` × `APPRAISAL_RIGHTS_STATUS`
   owns appraisal-rights STATUS; and a NAMED DISPATCH COLLISION exists.
   Cited, never redefined; the collision is a single Ben call.** Two
   distinct pins:
   - **Claim surface (settled by this spec, no Ben call needed):** the
     AVAILABLE/NOT_AVAILABLE status enum, the presupposition-corroboration
     ruling (a "other than … Dissenting Shares" carve-out corroborates
     AVAILABLE), the `statute_ref` attribute on status claims, and the
     quoted no-availability sentences (Concho/Forest City/Modiv, incl.
     both LLC "No Dissenters' Rights" cards `16e1358e…`/`98b879ee…` in
     this family's pack) are ALL the consideration spec's territory. This
     family asserts nothing about whether appraisal rights exist. Its two
     concepts are downstream MECHANICS that presuppose the right: who
     controls the proceedings, and what happens when dissenter status is
     lost. The shared grounding card `50946e9a…` is the proof case: its
     status fact resolves under CONS-DISSENT, its consent fact under
     APPR-SETTLE — different claim definitions, different quotes (limbs),
     no collision. The dissenting-share carve-out from conversion is
     deliberately NOT minted as an APPR concept: under the consideration
     spec's flagged presupposition ruling that sentence is CONS-DISSENT's
     AVAILABLE evidence, and a second presence claim over the same
     sentence would be double-claiming. Test 4.
   - **Dispatch (NOT settled here — FLAGGED FOR BEN, the dividends/D&O
     rank-85 collision device):** the consideration spec's §3 classifier
     port claims the "Dissenting/Appraisal" title family into its
     CONSIDERATION section family, and receipts A/B/G show this family's
     ENTIRE grounding population lives in exactly those sections (plus
     CONSID-CONVERT/CONSID-EXCHANGE homes the consideration family
     unambiguously owns). Both specs are unbuilt; a section dispatches to
     exactly one producer; the two designs cannot both hold the titles.
     This spec proposes **resolution A** and specifies it (§3):
     dissent/appraisal-titled STANDALONE sections dispatch to a new
     APPRAISAL section family owned by this slice, whose producer carries
     an `APPRAISAL_STATUS` pass-through assertion kind resolving to the
     consideration family's registered `(CONS-DISSENT,
     APPRAISAL_RIGHTS_STATUS)` pair, with that spec's corroboration
     patterns imported as shared constants (one pattern, one place — the
     TERMF_TITLE_PATTERN device at the resolver level), so CONS-DISSENT
     loses zero coverage and keeps full semantic ownership. **This row is
     gated on the consideration family's registry having landed first:**
     no `CONS-` key exists in head's contract-bundle at the time this
     spec is written, and the consideration slice is itself unbuilt. If
     this slice merges before that registration lands, the
     `APPRAISAL_STATUS` pass-through row is not addable yet — until the
     consideration registry lands, `APPRAISAL_STATUS` assertion_kind is
     out-of-enum → `pushOpenWorld` (the same route as resolution B), and
     the row is added by a follow-up reviewed diff once the dependency
     clears. Test 1's frozen-map assertion for this row is conditional on
     that landing.
     **Resolution B** (Ben keeps dissent titles with CONSIDERATION): this
     slice's classifier rules and producer prompt are dropped from the
     build; its registry, resolver, lexicon, and fixtures still land; the
     two APPR kinds are added to the consideration producer's assertion
     enum in a Ben-approved cross-slice amendment. Under EITHER
     resolution the claim-ownership boundary above is identical. The call
     lands at whichever PR merges last. Conversion/exchange-titled
     sections (CONSID-CONVERT/CONSID-EXCHANGE homes carrying embedded
     appraisal limbs — 19 of the settlement cards, 16 of the withdrawal
     cards) stay with the CONSIDERATION producer under BOTH resolutions;
     their appraisal limbs flow to `open_world_candidates` per that
     spec's own design, a priced under-coverage this spec accepts and
     states (Known costs).
2. **Closing-conditions family — condition-article machinery, including
   any future max-dissent threshold.** `COND-B-DISSENT` is zero-population
   (receipt E) and the closing-conditions spec declined to register it.
   If a max-dissent condition ever appears in a new deal, it is CONDITION
   text in a conditions article: the closing-conditions family's producer
   surface, not this one's — this family's classifier declines CONDITIONS
   article_context (§3), and the threshold percentage would be that
   family's future typed-abstain numeric, designed there with its own
   corpus receipt. Recorded here so the two specs cannot both claim it
   later. Test 4.
3. **IOC family — restrictions on ACTIONS THAT TRIGGER appraisal
   rights.** Receipt G's §7.1 "[PROPOSED] No Actions Triggering
   Appraisal/Dissenters Rights" (COVENANT_INTERIM_OPERATING/null) is
   interim-operating restriction territory: a covenant not to take acts
   giving rise to dissent rights is conduct-of-business, opposite in kind
   to this family's mechanics. INTERIM_OPERATING article_context declines
   ALL rules here, and the title exclusion below catches the standalone
   form. Test 4.
4. **REP-T-FAIRNESS — fairness-opinion carve-outs.** Six cards exclude
   Dissenting Shares from the consideration opined on (pack §3–4, e.g.
   `02ef1454…`). Presupposition text, rep-article home; REPRESENTATIONS
   article_context declines; no APPR pattern fires on "fair from a
   financial point of view" vocabulary. Test 4.
5. **Merger-structure family** — its ported
   `CONSID_MECHANICS_TITLE_PATTERN` already declines "No Appraisal
   Rights"-class titles from MERGER_STRUCTURE, and its boundary 1 names
   appraisal/dissenters' rights as not its assertions. No third claimant;
   the STRUCTURE_MECHANICS/null dissent cards (receipts A/B) belong to
   THIS family's dispatch surface under resolution A. Cited for
   completeness.
6. **Key-defined-terms family — the "Dissenting Shares" DEFINITION
   cards.** DEF-DISSENTING (16/15) definitional text restates the
   perfection/withdrawal conditions inside Article I / Exhibit-A
   definitions. DEFINITIONS article_context declines here; the operative
   reconversion mechanic in the body section is this family's claim
   surface, the definitional echo is not a second fact. The
   `1119ed4b…` defined-term-scoped drafting (status conditions inside the
   in-line parenthetical of an OPERATIVE section) still dispatches and
   resolves here — the decline is article-context-based, not
   vocabulary-based. Test 4.

## Deliverable (honest conversion semantics)

Governed, resolvable presence claims for: (a) the parent
control/settlement-consent covenant over appraisal demands; (b) the
withdrawal/loss-of-dissenter-status reconversion mechanic — each with an
optional verbatim `statute_ref`.

**No recorded native runs exist over appraisal sections** — the producer
today extracts capitalisation plus the committed wave harnesses. There are
no open-world fixture rows to convert and no closure_ids to track. The
deliverable is the five-layer capability plus a pre-rerun harness: a
COVERAGE MAP over committed corpus-quote fixtures (the named grounding
cards of both sets plus the boundary cards named in test 0), committed as
LITERAL production bytes with provenance headers (deal uuid,
provision_card uuid, retrieval date, provision_type/subtype including the
CONSID-CONVERT/CONSID-EXCHANGE/STRUCTURE_MECHANICS-null homes where true —
the TERMF m-2 discipline), each hand-enumerated with its expected outcome.
The P1 audit M-5 honesty pins apply verbatim: "the pipeline natively
extracts appraisal mechanics" may be claimed ONLY after dated post-merge
live-run handoffs (subscription CLI); until then the honest claim is "the
machinery exists and is proven on committed fixtures".

**Fixture placement is load-bearing:** all committed fixtures live under
`tests/fixtures/canonical-v2/appraisal-fixtures/` (the forbidden-patterns
PROSE_CLASS_FINGERPRINTS-exempt directory class). Checked against
`scripts/lint/forbidden-patterns.sh` globalPatterns: this family's
vocabulary ("demands for appraisal", "fails to perfect", "prior written
consent", "Section 262 of the DGCL", "Dissenting Shares", "withdraw or
lose") collides with no global or scoped fingerprint; no new exemption
entries are needed, and no spec prose, fixture, or module in this slice
may introduce fingerprinted vocabulary outside the exempt fixture
directory. Per the IOC lint pin, fixture headers carry deal uuid +
provision_card uuid + retrieval date ONLY — never v1 `section_ref` label
strings (this family's uniform "Dissenting / Appraisal Rights" label is
exactly the class that must stay out of headers).

## 1. Registry (`contract-bundle.js` → next frozen version)

Strictly additive spread of the head version at build time. **Two new
concepts, both FLAGGED FOR BEN in the PR body**, `{concept_key, version}`
shape only. The `APPR-` prefix is new v2 vocabulary: v1's
CONSID-DISSENT/DEF-DISSENTING/COV-APPRAISAL codes are deliberately NOT
reproduced — the corpus proves the v1 labels collapse four legally
distinct facts (status, carve-out, reconversion, settlement control)
under interchangeable buckets (Grounding correction 3c; the COV-TAXMATTERS
grab-bag ruling).

- `APPR-SETTLE` — parent control of appraisal proceedings and the
  consent requirement on Company payment/settlement of appraisal demands.
  Grounded 29 cards / 29 deals; twelve named exemplars (grounding set 1).
- `APPR-WITHDRAW` — loss-of-dissenter-status reconversion: shares that
  fail to perfect, withdraw, or lose appraisal rights are deemed
  converted into the right to receive the merger consideration. Grounded
  44 cards / 30 deals; ten named exemplars (grounding set 2).

NOT added (each a legal ruling, not an omission):

- **A max-dissent closing-condition threshold concept** — zero corpus
  population (receipt E; COND-B-DISSENT 0/0; boundary 2). It is retired as
  a comparable M3 field. If it appears later, it remains exact open-world
  evidence in closing-conditions territory until a separately reviewed
  governed shape exists.
- **A statutory-regime enum** — Grounding correction 4: one deal per
  non-DGCL regime, and the consideration spec's `statute_ref` ruling
  stands; regime vocabulary is a Ben adjudication over observed verbatim
  values later. FLAGGED FOR BEN as a family-brief deviation.
- **A dissenting-share carve-out concept** — the carve-out sentence is
  `CONS-DISSENT`'s AVAILABLE corroboration evidence under the
  consideration spec's flagged presupposition ruling (boundary 1);
  a second claim over the same sentence is double-claiming.
- **An appraisal-not-available concept** — `CONS-DISSENT`'s
  NOT_AVAILABLE canonical value owns the quoted-negation shape,
  including this pack's two LLC/unit-deal cards (`16e1358e…`,
  `98b879ee…`). The entity-type correlation the pack flags (warning 7 —
  no-appraisal clauses correlate with LLC/unit targets) is recorded as
  input to Ben's future jurisdiction/entity vocabulary adjudication, not
  modeled here.
- **A parent-information-rights / notice-of-demands concept** — real
  drafting (the "written notices of demands" limbs visible in receipts
  C/D and v1's `parentInfoRights` FEATURES intent), but it is
  boilerplate-adjacent notice plumbing; a third presence claim over the
  same sections adds review load without a market statistic Ben has
  asked for. Stays inside the APPR-SETTLE quote as reviewer evidence;
  promotion is a future reviewed diff if live runs show Ben wants it.
  FLAGGED FOR BEN alongside the two shipping concepts.
- **`COV-APPRAISAL`/`CONSID-DISSENT`/`DEF-DISSENTING` as concept keys** —
  the label-collapse ruling above; COV-APPRAISAL additionally rests on a
  data-quality-suspect pair (Grounding correction 3a).

**Claim definitions** (two; both presence):

```
APPRAISAL_SETTLEMENT_CONSENT_CLAIM_DEFINITION_V1
  claim_definition_key: 'APPRAISAL_SETTLEMENT_CONSENT'
  version: 1
  allowed_canonical_values: [true]          // presence claim, the
  canonical_value_required_when_present: true  // KNOWLEDGE_QUALIFIER shape

APPRAISAL_WITHDRAWAL_RECONVERSION_CLAIM_DEFINITION_V1
  claim_definition_key: 'APPRAISAL_WITHDRAWAL_RECONVERSION'
  version: 1
  allowed_canonical_values: [true]
  canonical_value_required_when_present: true
```

No new canonical value types; no validator changes. New concepts and
definitions grow the expected-keys rows as sorted supersets
(content-diffed tests; prior rows byte-untouched).

**Design decisions, pinned as legal rulings:**

- **Both claims are presence-only; no numeric or enum value exists to
  parse.** The family's grounded value-shapes — "without interest",
  "(at Parent's sole cost and expense)", the §262(h) pre-judgment-payment
  right, the reasonableness qualifier, the Applicable-Law carve-out, the
  court-determination loss route, "may not" vs "shall not" modality —
  are ALL real legal gradations and ALL stay inside the quote as reviewer
  evidence (the dividends declaration-modality ruling verbatim; the
  qualifier-track P2 seam owns strength gradations). Structuring any of
  them on this evidence would be fabricated structure; each is a named
  candidate for a future qualifier-track slice.
- **The two claims are pinned co-resolvable over one section, with
  limb-scoped quotes.** `be2ed546…` (and most full dissenting-shares
  sections) carries both mechanics; the producer quotes each limb
  separately, and both kinds resolving from one section is the drafting's
  ordinary shape (the closing-conditions co-resolution device, via the
  dividends adaptation). The failure boundary earns the split: a section
  drafted with only one mechanic resolves that one and stays silent on
  the other — never inferring the missing half.
- **No party tuple is minted.** The consent holder is uniformly
  Parent-side (one plural variant, "Parent Entities" — `9a48ab72…`) and
  the restricted party uniformly the Company; party structure would add
  nothing (the TAXM-FIRPTA ruling). The quote carries the parties.

**Governed attributes (never in keys; participate in claim
identity/closure):**

- Both claims: `statute_ref` — OPTIONAL verbatim citation phrase from the
  quote ("Section 262 of the DGCL", "Section 238 of the Cayman Companies
  Act", "Chapter 10, Subchapter H of the TBOC" — all three observed
  verbatim in grounding cards). When supplied it is enforced as a
  verbatim substring of the byte-verified quote (P1 M-3 discipline);
  failure → review, typed `APPRAISAL_STATUTE_REF_NOT_IN_QUOTE`. OPTIONAL
  is honest on this grounding set: several settlement quotes carry no
  statutory citation at all (`e473a572…`'s consent sentence cites none).
  The typed-reason name is deliberately distinct from the consideration
  spec's `STATUTE_REF_NOT_IN_QUOTE` so the two families' review queues
  never alias. This attribute is the observed-values feedstock for Ben's
  future jurisdiction adjudication (Grounding correction 4) — verbatim
  capture now, vocabulary later.
- Parsed from quote bytes only — the DB `defined_term`/`defined_value`
  columns are never read (untrusted, Grounding correction 3).

M3 rule 1 restated for this family, because its surface makes the
violation easy: the settlement covenant's own text is negative-shaped
("the Company shall not … settle") — the CLAIM is the quoted PRESENT fact
that a consent-control covenant exists, which is self-policing via
byte-verification; the producer NEVER asserts "no settlement restriction
exists", never asserts "appraisal rights are not available" (CONS-DISSENT
territory AND, when unquoted, a derived negative), and never emits any
ABSENT/NOT_APPLICABLE state. Silence on either mechanic stays with the
future scope-closure machinery, forever.

## 2. Value parser — NONE (a ruled decision)

**No parser module ships in this slice.** The closing-conditions "no
parser is a ruled decision" precedent, applied family-wide with receipts:

- The brief's only numeric (max-dissent percentage) is zero-population
  (receipt E) — a percentage parser would be a parser with no possible
  input, the REM-CAP vacuity shape at the module level.
- Both shipping claims are presence claims; their quotes' numerals
  (statutory section numbers "262", "238", "92A.320", subsection letters,
  "one Business Day" record-date bounds, the co-located "$63.50 per
  Share" consideration figure in `57133d5d…`'s home section — pack §4)
  are all NON-family numbers that a family parser would exist only to
  exclude. The consideration family's parsers own the money; this family
  parses nothing.

Any future numeric promotion here (a real max-dissent threshold in a new
deal) starts with its own corpus receipt and its own typed-abstain module
in the closing-conditions family (boundary 2), never by adding a parser
here.

## 3. Producer prompt + provider (built under boundary-1 resolution A;
dropped under resolution B — Ben's call at whichever PR lands last)

- **New prompt module**
  `lib/canonical-v2/native-producer/appraisal-producer-prompt.js`. The
  capitalisation, termination-fee, no-shop, and MAE-definition prompts are
  NOT edited (their PROMPT_VERSIONs do not move; recorded fixtures replay
  byte-identically). New `PROMPT_ID 'native-producer-appraisal/v1'`,
  `PROMPT_VERSION 1`, bumped once per slice, never mid-slice.
- **Dispatch through `producer-prompt-registry.js`, mandatorily.** The
  seam is BUILT at head (CAPITALISATION + TERMINATION_FEE + NO_SHOP +
  MAE_DEFINITION — four registered producers, per
  producer-prompt-registry.js:83-86; fail-closed nulls; module-private
  frozen Map). This slice adds ONE entry in its own reviewed diff, per the
  module's own header convention:
  `APPRAISAL → buildAppraisalProducerPrompt`. Unknown family → no prompt,
  no candidates, typed record — never a silent fallback.
- **Section-family classifier extension**
  (`section-family-classifier.js` — stage-1 rules are added per family in
  that family's reviewed diff; this is that diff for APPRAISAL). At head
  `runStage1(title)` has no `article_context` parameter; if a sibling
  slice extending the signature has landed first, the extended signature
  exists; if this slice lands first, it extends the signature exactly per
  the financing spec's §3 and bumps `SECTION_FAMILY_CLASSIFIER_VERSION`
  (the build-order pin, adopted verbatim from the tax-matters/dividends
  specs — the seam amendment is built once, to that spec, whichever
  family arrives first). Rules authored FRESH from the receipt-G title
  surface:
  - **Shared exclusion constant FIRST —
    `APPRAISAL_TRIGGER_RESTRICTION_TITLE_PATTERN =
    /\bno actions? triggering\b/i`** — the grounded IOC-side standalone
    title "[PROPOSED] No Actions Triggering Appraisal/Dissenters Rights"
    (receipt G; boundary 3). Checked before the claim rules; a matching
    title declines. One pattern, one place (the TERMF_TITLE_PATTERN
    device), shared with the rules below so claim and exclusion can never
    drift.
  - `/\bdissent(ing|ers?)\b/i` — "Dissenting Shares", "Dissenting /
    Appraisal Rights", "Shares of Dissenting Holders / Appraisal Rights",
    "Dissenting Company Shares", "No Dissenters' Rights" (the LLC
    negation sections DISPATCH by design — their status sentences are the
    APPRAISAL_STATUS pass-through's NOT_AVAILABLE input under resolution
    A, resolving to CONS-DISSENT).
  - `/\bappraisal\b/i` — "Appraisal Rights", "Appraisal / Dissenters
    Rights" (title-only forms without the dissent stem).
  - Also excluded before both rules: `/\bno appraisal rights\b/i` when
    the section sits in a consideration-mechanics context is ALREADY
    declined by the merger-structure port's `CONSID_MECHANICS_TITLE_
    PATTERN` for that family; HERE the "No Appraisal Rights" /
    "No Dissenters' Rights" titled standalone sections dispatch (they are
    this surface's status sentences), so no negation exclusion is added —
    deliberate asymmetry with the dividends "No Dividends" exclusion,
    stated so the audit does not flag it as an omission: the dividends
    exclusion kept exchange-fund MECHANICS out; here the negation
    sections ARE family/CONS-DISSENT content.
  - **Declines, pinned:** `article_context` of DEFINITIONS (boundary 6 —
    DEF-DISSENTING and the COV-APPRAISAL pair's DEF-article home never
    dispatch), REPRESENTATIONS (boundary 4 — REP-T-FAIRNESS carve-outs),
    CONDITIONS (boundary 2 — any future max-dissent condition belongs to
    closing-conditions), INTERIM_OPERATING (boundary 3) → decline ALL
    rules. Vacuity check applied at design time (REM-CAP discipline): the
    named grounding cards in CONSID-DISSENT and STRUCTURE_MECHANICS/null
    homes carry real dissent/appraisal headings matching a rule under a
    non-declining context (receipt G); the CONSID-CONVERT/CONSID-EXCHANGE
    -home grounding cards ("Conversion of Shares…", "Exchange of
    Certificates…" headings) do NOT match this family's rules and stay
    with the CONSIDERATION dispatch — reachable population under
    resolution A is the standalone-section majority, and the embedded
    remainder is priced under-coverage (Known costs), not vacuity.
  - Stage 1 is validated against ALL deals' section titles before the
    prompt is ever dispatched (the repo classify-rules safety check) as a
    review-time script against live corpus data — never stubbed into
    fixtures or promoted into `npm test` (the IOC test-5 discipline). The
    known collision surface to verify: "No Actions Triggering …" IOC
    titles (must decline), "Dissenting Shares" DEFINITION-article
    headings (must decline by context), fairness-opinion rep headings
    (context decline), and the consideration spec's own title family —
    the boundary-1 collision is re-verified against real titles in that
    script and its output attached to the Ben flag.
  - Stage 2 (AI-assisted) applies unchanged with
    `SECTION_FAMILY_AI_CLASSIFIED` provenance and the
    `SECTION_FAMILY_AI_UNVERIFIED` auto-pass block.
- **Response shape:** an `appraisal_assertions` array — each element
  `{ section_reference, assertion_kind: 'SETTLEMENT_CONSENT' |
  'WITHDRAWAL_RECONVERSION' | 'APPRAISAL_STATUS', verbatim quote }` plus
  per-kind fields: both APPR kinds carry optional `statute` (verbatim
  citation phrase); APPRAISAL_STATUS carries `appraisal_status`
  ('AVAILABLE'|'NOT_AVAILABLE') and optional `statute` exactly per the
  consideration spec's schema — the pass-through kind exists ONLY under
  resolution A and resolves to that family's registered pair. One element
  per legal fact, split discipline pinned in the prompt:
  - A full dissenting-shares section grounds up to THREE assertions
    (status / reconversion / settlement-consent), each quoting its own
    limb; quotes may share sentence boundaries only where one sentence
    genuinely carries two facts (rare here — the grounded sections
    separate the limbs).
  - The settlement limb's "approve the withdrawal of any such demands"
    (`1119ed4b…`, `be2ed546…`, `50946e9a…`) is part of the
    SETTLEMENT_CONSENT fact — the consent right extends to withdrawal
    approval — and is NEVER a WITHDRAWAL_RECONVERSION assertion (the
    named cross-kind trap; resolver corroboration enforces it, §4).
  - PRESERVE-THE-NOVEL retained verbatim; named in the prompt as NOT this
    family's assertions: per-share amounts, exchange ratios,
    certificate-exchange and payment-fund mechanics and every other
    consideration value (boundary 1 — cited, never asserted here; the
    prompt's exclusion list is deliberately fingerprint-safe phrasing, so
    it never contains the literal "Exchange Fund" or "surrender" tokens
    that test 4's b-1 grep-test forbids from the prompt, corroboration
    tables, and lexicon); closing conditions
    of any kind including any dissent-share threshold (boundary 2);
    interim-operating restrictions (boundary 3); fairness-opinion
    content (boundary 4); definitional restatements in definitions
    articles (boundary 6). Open-world or silence, never forced fit. The
    producer never asserts a negative (M3 rule 1); `NOT_AVAILABLE` is
    asserted only against a quoted no-availability sentence, per the
    consideration spec's own pin.
- **Provider (`anthropic-provider.js`):** ONE new generic key,
  `NATIVE_APPRAISAL_CANDIDATE`, proposal_kind `APPRAISAL` (≠ OPEN_WORLD).
  `appraisal_assertions` is NOT added to `REQUIRED_RESPONSE_LISTS` (the
  share_count precedent verbatim: recorded responses predate the key;
  missing/non-array reads as empty list, never a schema failure). Quote
  byte-verification identical to existing proposals. Golden evals:
  recorded responses are never hand-edited into the new shape; the first
  appraisal recordings are minted by the first live runs, each its own
  dated handoff.

## 4. Resolver wiring (`candidate-resolution.js`)

- **ONE new `RESOLUTION_UNCONDITIONAL` entry** (P1 M-2: the Map is keyed
  on generic_claim_key alone): `NATIVE_APPRAISAL_CANDIDATE`,
  `deterministic_kind: null`, `attachment_position: null`,
  `registered_claim_definition_key: null`, `concept_key: null` (explicit,
  with the TERMR build-time check that nothing reads
  `mapping.concept_key` before the handler's kind map runs),
  `party_field: null` (no kind mints a party — section 1).
  `MAPPING_TABLE_VERSION` bumped; table-validation still asserts no
  duplicate generic keys.
- **Handler split on `assertion_kind`** via a frozen map:
  `SETTLEMENT_CONSENT → APPR-SETTLE × APPRAISAL_SETTLEMENT_CONSENT`;
  `WITHDRAWAL_RECONVERSION → APPR-WITHDRAW ×
  APPRAISAL_WITHDRAWAL_RECONVERSION`;
  `APPRAISAL_STATUS → CONS-DISSENT × APPRAISAL_RIGHTS_STATUS`
  (resolution A ONLY, AND only once the consideration family's `CONS-`
  registry has landed (M-5) — the pass-through row exists in the frozen
  map solely if Ben rules for A and that registry is already built,
  imports the consideration slice's corroboration constants verbatim, and
  applies that spec's negation-first ordering, presupposition ruling and
  `statute_ref` handling unchanged; under resolution B, OR under
  resolution A before the consideration registry lands, the row is absent
  and the kind is out-of-enum). Out-of-enum assertion_kind → explicit
  `pushOpenWorld`,
  typed reason (P1 C-4: the main loop's open-world routing keys on
  proposal_kind and will not catch it).
- **Status-negation gate, FIRST, before the two APPR kinds' corroboration
  — this family's primary corruption trap:** a quote matching the
  consideration spec's NOT_AVAILABLE pattern pair
  (`/\bno (dissenters['’]? or )?appraisal rights\b/i` AND
  `/\bavailable\b/i`, imported as a shared constant, never re-derived)
  asserted as SETTLEMENT_CONSENT or WITHDRAWAL_RECONVERSION → review,
  typed `APPRAISAL_STATUS_TEXT_MISROUTED`, never resolves — a
  no-availability sentence (the LLC deals) can never publish as an
  affirmative mechanics claim. Resolver-side despite the producer
  instructions, because classification and production are independent
  failure surfaces.
- **Full-table kind ambiguity rule (the TERMF C-3 device) with exactly
  ONE pinned co-resolution pair:** the handler runs ALL kinds'
  corroboration patterns over the assertion's single byte-verified quote.
  The pair `{SETTLEMENT_CONSENT, WITHDRAWAL_RECONVERSION}` is pinned
  co-resolvable ONLY in the degenerate overlap where limb-scoped quotes
  share boundary bytes; every other multi-kind match on one quote →
  review, typed `AMBIGUOUS_APPRAISAL_ASSERTION_KIND`. Per the remedies M3
  correction, there is NO resolver-side sub-quote search: corroboration
  runs over the assertion's own quote; the producer owns splits.
  Asserted-kind pattern mismatch → review, typed
  `APPRAISAL_KIND_UNCORROBORATED`.
- **Corroboration tables (frozen resolver constants; label must bind to
  quote text; every pattern grounded in a committed fixture quote):**
  - `SETTLEMENT_CONSENT` ↔ `/\b(prior )?written consent\b/i` AND
    `/\b(settle|compromise)\b/i` (grounded in all twelve named
    settlement cards — the consent gate and the settle verb are the
    drafting's two constants across every ordering variant; receipt C2's
    27/27 and 29/29 populations; the `(prior )?` optionality is required
    by an attested corpus card — `d52db038-ff54-4b63-a937-e7b8deb91dd6`
    (§1.5 "Dissenting / Appraisal Rights") drafts "…offer to settle,
    approve the withdrawal of any claim … without the written consent of
    Parent" with no "prior"; exactly 2 of the 29 settlement-population
    cards lack "prior written consent" per receipt C2's 29-vs-27 delta,
    so "prior written consent" alone would misroute both to
    `APPRAISAL_KIND_UNCORROBORATED` at birth). The order-varying "offer to
    settle" / "settle or offer to settle" bigrams are deliberately NOT the
    pattern (both orders attested; a bigram would break a grounding card
    at birth — the dividends anti-adjacency lesson). A consent covenant
    drafted without any "written consent" phrase (none attested in the
    sample) queues `APPRAISAL_KIND_UNCORROBORATED` — priced; `d52db038…`
    is committed as a priced-review fixture proving the `(prior )?`
    optionality (test 0).
  - `WITHDRAWAL_RECONVERSION` ↔ `/\bfail(s|ed)? to perfect\b/i`
    (grounded ten named cards; receipt F — ZERO hits outside dissent
    content corpus-wide, this family's zero-noise anchor) ∪
    `/\bwithdraw(s|n)?\b[^.]{0,40}\b(lose|loses|lost)\b/i` (grounded
    `be2ed546…` "waive, withdraw or lose", `4d437c49…` "withdrawn or
    lost", `1119ed4b…` "withdraws or otherwise loses", `eac817ab…`
    "withdraws or otherwise loses" — the bounded gap covers the observed
    intervening tokens; receipt F: zero non-dissent noise). The
    settlement limb's "approve the withdrawal of any such demands"
    contains neither pattern (no perfect-failure token; no lose-token
    within the window after "withdrawal") — the named cross-kind trap is
    closed by construction and pinned in test 3. The TBOC card
    corroborates via the withdraw-or-lose limb (its text never says
    "appraisal" or "perfect" — the regime-vocabulary warning honored).
- **Handler order per assertion:** status-negation gate → full-table kind
  corroboration → `statute_ref` verbatim-substring enforcement (when
  supplied; `APPRAISAL_STATUTE_REF_NOT_IN_QUOTE`) → concept assignment →
  gates. Presence claims pass `canonicalValueAllowed` and carry
  `buildMechanicalAnswerProvenance({ extraPins: { gate:
  'ALLOWED_VALUES_MEMBERSHIP' } })` (the tax-matters uniform
  tag-construction story; no auto-pass-block entry rides on it).
- **Materiality: NEW tier proposed, flagged for Ben.** `{ rank: 88,
  label: 'APPRAISAL_RIGHTS', concept_key_prefixes: ['APPR-SETTLE',
  'APPR-WITHDRAW'] }` — exact keys, deliberately never a bare `APPR-`
  prefix (the financing-covenants discipline). Rank context, stated
  fully: head carries 70 (CLOSING_CONDITIONS) and 90
  (NOTICES_ADMINISTRATIVE); unbuilt siblings propose 75 (FINANCING),
  80 (TAX_MATTERS, EMPLOYEE_MATTERS, AND PROXY_MEETING_COVENANTS — a
  three-way unresolved collision in that band, not just TAX_MATTERS and
  EMPLOYEE_MATTERS; the proxy spec proposes rank 80 independently
  (2026-08-02-family-proxy-meeting-covenants-design.md:908)), 85
  (DIVIDENDS and DNO_INDEMNIFICATION — likewise), AND 88 (the
  merger-structure spec's own proposed `MERGER_STRUCTURE` tier,
  2026-08-03-family-merger-structure-closing-design.md:893 — a direct,
  same-wave collision with THIS spec's own rank-88 proposal, named here
  as an unresolved Ben call at whichever PR lands last, per the
  dividends/D&O rank-85 device). The number remains a proposal on Ben's
  single ordering pass over the wave's tiers, now including the
  merger-structure collision. Note under resolution A the pass-through's
  resolved `CONS-DISSENT` claims rank 60 via the existing `CONS-` prefix
  — that is the consideration family's tier operating correctly, not a
  collision.
  **Pre-concept review routing (TERMF M-3):** review items minted before
  the kind map runs (status-negation gate,
  `AMBIGUOUS_APPRAISAL_ASSERTION_KIND`, `APPRAISAL_KIND_UNCORROBORATED`)
  carry conceptFamily `'APPR-SETTLE-PENDING'` — a routing token only,
  never registered, never publishable — which startsWith-matches the
  `APPR-SETTLE` tier key → rank 88 instead of UNCLASSIFIED 99.
- **Identity:** the claim definition key and `statute_ref` participate in
  claim identity/closure — the two APPR claims over one section never
  collide or dedupe; a dual-regime deal (none attested; drafteable) mints
  distinct claims per statute_ref. Re-run is byte-stable.
- **Receipt + additivity (honest form, P1 M-1):** with no appraisal
  input, resolution output must be byte-identical EXCEPT
  `mapping_table_version`, `contract_vocabulary_digest` (under the new
  bundle version), the bumped `section_family_classifier_version` (if
  this slice extends the signature — the build-order pin), and the
  recomputed `resolution_receipt_id`; documented in the PR as a
  field-level diff. No parser-version field exists for this family
  (section 2 — its absence is itself pinned in the receipt test).
  Skipping the version bump to keep old pins green is the named
  anti-pattern.

## 5. Lexicon additions (`LEXICAL_FAMILY_LEXICON` V3 → next at head;
version re-checked at build time; every edit a reviewed diff; keys MUST be
registered concept keys — which is why both concepts land in this same
slice; explicit `\b` on every case-sensitive defined-term regex; static
max ≤ 128; rationale per pattern)

- `APPR-SETTLE`: LITERAL_PHRASE "demands for appraisal" (23 cards / 17
  deals, receipt F — every corpus hit is on-topic; the family's cleanest
  settlement-side signal; also fires inside notice-of-demands limbs in
  the same sections, which is veto-correct).
- `APPR-WITHDRAW`: BOUNDED_REGEX `/\bfail(s|ed)? to perfect\b/i`
  (receipt F: ZERO corpus hits outside dissent content — a zero-noise
  anchor of the receipt-2 class); BOUNDED_REGEX
  `/\bwithdraw(s|n)?\b[^.]{0,40}\b(lose|loses|lost)\b/i` (matches the
  resolver's own corroboration limb — table-consistency by construction;
  receipt F: zero non-dissent noise).

**Priced cross-hit noise, stated (the TERMR M-4 discipline):**
"demands for appraisal" fires on settlement AND reconversion AND
notice-limb text within family sections, and on the CONSID-CONVERT/
CONSID-EXCHANGE-home cards that stay with the CONSIDERATION dispatch
under resolution A — expected `LEXICAL_UNMATCHED_SIGNALS` hits
concentrated exactly where the embedded-limb under-coverage lives (Known
costs), which is the veto working as designed: an appraisal limb the
consideration producer routed open-world cannot be silently concluded
ABSENT while the signal stands. Accepted and recorded; deletion asymmetry
applies; the anti-noise test pins one such hit as EXPECTED so a future
silent deletion breaks a test.

**Priced exclusions** (each a recorded blind spot; veto-only design means
a miss costs a missed VETO, never a wrong claim):

- "appraisal rights", `/\bDissenting (Stockholder|Shares|Company
  Shares)\b/`, `/\bDissenter Rights\b/`: ALL already keyed to
  `CONS-DISSENT` in the consideration spec's lexicon — duplicating them
  under APPR keys would double-fire every family signal across two
  families (the tax-matters IOC-overlap ruling verbatim).
- "offer to settle": 11 corpus cards outside dissent context (receipt F —
  litigation/indemnification settlement-consent drafting, D&O-adjacent);
  the conjunction that makes it safe lives in the resolver's
  corroboration table, not the lexicon.
- Bare "withdraw"/"withdrawal": the no-shop family's
  change-of-recommendation surface ("withdraw … its recommendation") and
  exchange-fund withdrawal mechanics — guaranteed cross-family noise
  flood.
- "prior written consent": ubiquitous consent boilerplate corpus-wide
  (IOC restrictions, assignment clauses, financing covenants); zero
  family discrimination.
- `/\bSection 262\b/`: CONS-DISSENT AVAILABLE-corroboration vocabulary in
  the sibling's resolver; adding it under an APPR key would alias the two
  families' signals in exactly the deals where both fire.
- Residual blind spot, named: a settlement-consent covenant drafted
  without the phrase "demands for appraisal" (e.g. pure "Dissenter
  Rights" Cayman vocabulary — `50946e9a…` carries both, but a
  hypothetical Cayman-only drafting might not) is invisible to this
  family's own lexicon keys; the CONS-DISSENT keys (Dissenter Rights)
  still veto for the sibling family, the v1↔v2 comparator covers the 13
  CONSID-DISSENT-carded deals, and coverage extends by reviewed diff when
  live runs surface the variant.

## 6. Acceptance tests (real-fixture-first; the P1 M-5 pre-rerun-harness
honesty pins apply VERBATIM — no recorded native runs exist for this
family; every resolver/registry test drives synthetic compiled candidates
pinned to REAL corpus quotes, byte-verified against committed fixture
bytes, clearly labeled as the pre-rerun harness)

0. **Fixture commit:** the named grounding cards — settlement set
   (`e473a572…`, `4bf075bd…`, `be2ed546…`, `9a48ab72…`, `50946e9a…`,
   `f281f4b3…`, `3e4bd292…`, `eac817ab…`, `17ed5240…`, `4d67d6aa…`,
   `1119ed4b…`, `e6c173d1…`) and withdrawal set additions (`4d437c49…`,
   `2faf7939…`, `c583f453…`, `3db98df7…`) — plus boundary cards: one LLC
   no-appraisal card (`16e1358e…` — the status-negation gate's committed
   regression fixture; ALSO a consideration-spec fixture, committed here
   independently so neither slice's tests depend on the other's build
   order), one REP-T-FAIRNESS carve-out (`02ef1454…`), the pack's NRS
   Top-Up card (`3f2af5fd…` — committed as the open-world/no-dispatch
   regime exemplar), and `d52db038-ff54-4b63-a937-e7b8deb91dd6` (§1.5
   "Dissenting / Appraisal Rights" — the SETTLEMENT_CONSENT priced-review
   fixture proving the `(prior )?written consent` pattern's optionality;
   M-6). All committed as LITERAL production bytes under
   `tests/fixtures/canonical-v2/appraisal-fixtures/`, provenance headers
   with deal uuid + provision_card uuid + retrieval date +
   provision_type/subtype (including the CONSID-CONVERT/CONSID-EXCHANGE/
   STRUCTURE_MECHANICS-null homes where true), NEVER v1 `section_ref`
   label strings (the IOC lint pin — this family's uniform "Dissenting /
   Appraisal Rights" short_title is exactly the label class that must
   stay out of headers). The COV-APPRAISAL pair is NOT committed
   (data-quality suspect — Grounding correction 3a; recorded in the
   ingest-QA flag only). Every test quote asserted a contiguous substring
   of committed bytes.
1. **Registry:** next version compiles; prior arrays untouched
   byte-for-byte; two concepts + two definitions validate with zero
   validator changes; expected-concept-keys AND expected-claim-keys
   superset-diffs written against sorted CONTENT, never the numeral; a
   test asserts the kind→(concept, definition) frozen map's values are
   all registered keys — including, under resolution A only IF AND ONLY
   IF the consideration family's `CONS-` registry has landed by this
   slice's build time, that the APPRAISAL_STATUS row points at the
   consideration family's registered pair and at IMPORTED (not
   re-declared) corroboration constants; if the consideration registry
   has not yet landed, the test instead asserts the row is absent and
   `APPRAISAL_STATUS` routes `pushOpenWorld` (M-5 build-order gate).
2. **No-parser pin:** a test asserts no `appraisal-*-parse.js` module
   exists in the slice's file set and no parser-version field enters the
   resolution receipt for this family (section 2's ruling made
   mechanical, so a future "helpful" parser addition is a visible,
   reviewed decision).
3. **Resolution (pre-rerun harness, synthetic candidates over committed
   bytes):** each named settlement card resolves
   APPRAISAL_SETTLEMENT_CONSENT presence (the twelve-variant spread —
   reasonableness qualifier, Applicable-Law carve-out, "may not"
   modality, plural consent-holder, TBOC/Cayman regimes — is the point of
   committing all twelve); each named withdrawal card resolves
   APPRAISAL_WITHDRAWAL_RECONVERSION (including `eac817ab…` corroborating
   via the withdraw-or-lose limb with ZERO "appraisal"/"perfect" tokens —
   the non-DGCL-vocabulary regression pin); `be2ed546…` resolves BOTH
   claims from limb-scoped quotes (the pinned co-resolution shape, never
   `AMBIGUOUS_APPRAISAL_ASSERTION_KIND`); the `1119ed4b…` settlement limb
   ("approve the withdrawal of any such demands") asserted as
   WITHDRAWAL_RECONVERSION → `APPRAISAL_KIND_UNCORROBORATED` (the
   cross-kind trap's permanent fixture); the `16e1358e…` LLC negation
   quote asserted as either APPR kind → `APPRAISAL_STATUS_TEXT_MISROUTED`
   review, never a resolved claim; `statute_ref` verbatim-enforced on a
   supplied citation, a corrupted citation →
   `APPRAISAL_STATUTE_REF_NOT_IN_QUOTE`, an omitted citation resolves
   (OPTIONAL honored — `e473a572…`); out-of-enum assertion_kind exercises
   explicit `pushOpenWorld` (which is also APPRAISAL_STATUS's route under
   resolution B — one test, both branches);
   `answer_provenance.gate === 'ALLOWED_VALUES_MEMBERSHIP'` asserted on
   every resolved claim; materiality rank 88 asserted BOTH on a resolved
   claim AND on an `'APPR-SETTLE-PENDING'` review item; additivity re-pin
   with the documented field-level diff.
4. **Cross-family boundary pins (each named for its boundary):** (b-1)
   under resolution A, the `50946e9a…` shared card yields the status fact
   ONLY through the pass-through to `(CONS-DISSENT,
   APPRAISAL_RIGHTS_STATUS)` and the consent fact ONLY under APPR-SETTLE
   — one card, two families, zero duplicated claims; a grep-test asserts
   zero consideration-value vocabulary ("per Share", "Exchange Ratio",
   "Exchange Fund", "surrender") in this slice's prompt, corroboration
   tables and lexicon; (b-2) a synthetic conditions-article
   dissent-threshold title declines classification (CONDITIONS context)
   and a threshold-shaped assertion is out-of-enum → open world; (b-3)
   the "[PROPOSED] No Actions Triggering Appraisal/Dissenters Rights"
   title declines via the shared exclusion constant, and an
   INTERIM_OPERATING article_context fixture declines every rule; (b-4)
   the `02ef1454…` fairness-opinion bytes under REPRESENTATIONS context
   decline classification, and asserted as any APPR kind →
   `APPRAISAL_KIND_UNCORROBORATED`; (b-6) a DEFINITIONS article_context
   fixture declines (the DEF-DISSENTING home class never dispatches)
   while the `1119ed4b…` operative-section defined-term-scoped quote
   still resolves (context-based, not vocabulary-based, decline —
   asserted as a pair).
5. **Identity:** the two APPR claims over one section mint distinct,
   stable, non-deduping identities; two synthetic claims differing only
   in `statute_ref` never collide or dedupe; re-run is byte-stable.
6. **Lexicon:** table validation (keys registered — the two new concepts;
   explicit `\b`; static max ≤ 128; rationale per pattern; content hash
   re-pinned; version bump asserted as `version === importedHeadConstant +
   1` relative to the imported `LEXICAL_FAMILY_LEXICON_VERSION` constant,
   never a literal numeral); anti-noise regression
   paragraph extended with a no-shop recommendation-withdrawal sentence,
   a litigation settlement-consent sentence ("offer to settle" outside
   dissent context — receipt F's 11-card class), an IOC
   consent-boilerplate sentence, and a fairness-opinion sentence —
   asserted zero hits under the exclusions (bare "withdraw"/"settle"/
   "prior written consent"/"appraisal rights" never entered the table);
   one EXPECTED unmatched-signal pinned for "demands for appraisal"
   against a committed CONSID-CONVERT-home quote (the embedded-limb veto,
   deletion-proofed by test); each surviving pattern hits its own
   grounding quote in committed fixtures; determinism permutation tests
   green under the grown table.
7. Full suite + `npm run build` + forbidden-patterns (fixtures inside the
   exempt directory class; zero new exemption entries — any collision is
   fixed by restructuring the offending file, never by widening
   FILE_PATTERN_EXEMPTIONS); phase allowlist for the slice's files;
   recorded fixtures for ALL families registered in
   `producer-prompt-registry.js` at build time (enumerated from the
   registry's own key list, never a hardcoded name list — currently
   capitalisation, termination-fee, no-shop, AND MAE-definition) replay
   byte-identically through the registry with the APPRAISAL entry
   present; unknown family → no prompt, typed record; classifier fixtures
   per §3; the all-titles corpus validation runs as a review-time script
   (live Supabase; never stubbed into `npm test`), its output attached to
   the boundary-1 Ben flag.

## Out of scope

- Appraisal-rights STATUS (AVAILABLE/NOT_AVAILABLE), the dissenting-share
  conversion carve-out as CONS-DISSENT evidence, the presupposition
  ruling, and status-side `statute_ref` semantics (boundary 1; the
  consideration family — under resolution A this slice merely re-routes
  production, importing that spec's constants; it redefines nothing).
- Max-dissent closing-condition thresholds and any percentage parser
  (zero population — receipt E; boundary 2; closing-conditions territory
  if ever populated; family-brief deviation flagged for Ben).
- A statutory-regime/jurisdiction enum (Grounding correction 4; verbatim
  `statute_ref` capture only; Ben adjudication over observed values
  later; family-brief deviation flagged for Ben).
- Restrictions on actions triggering appraisal rights (boundary 3; IOC).
- Fairness-opinion dissent carve-outs (boundary 4; representations).
- Definitional "Dissenting Shares" restatements in definitions articles
  (boundary 6; key-defined-terms family surface).
- Parent-information-rights/notice-of-demands promotion; modality
  ("may/shall not"), reasonableness qualifiers, Applicable-Law carve-outs,
  §262(h) pre-judgment payment rights, cost allocation, the "without
  interest" reconversion term, and the court-determination loss route —
  all evidence-in-quote this slice; qualifier-track (P2 seam) candidates.
- The COV-APPRAISAL byte-identical pair and every null-subtype/
  `[PROPOSED]` dissent card as cleanup targets (ingest-QA flags, never
  absorbed).
- `FAMILY_MAPPING_TABLE` extension for v1 CONSID-DISSENT/DEF-DISSENTING/
  COV-APPRAISAL ↔ v2 APPR-* (separate Fable+Ben table edit — the label
  collapse makes this table Ben-reviewed, never implementer-inferred).
- Live re-extraction runs (dated handoffs; until they land, no report may
  claim native appraisal extraction — M-5); any M3 amendment; any
  scope-closure/ABSENT work; cross-deal canonicalization of any verbatim
  phrase.

## Known costs, stated up front

- **The dispatch collision is the slice's gating risk.** Boundary 1's Ben
  call decides whether this family's producer exists (resolution A) or
  its production defers to a cross-slice amendment (resolution B). The
  registry/resolver/lexicon/fixture layers are identical under both;
  the spec is written so the B-branch build drops exactly two modules
  (classifier rules entry, prompt) and one frozen-map row. Neither branch
  changes any claim's semantics.
- **Embedded-limb under-coverage is priced, not hidden.** Under
  resolution A, roughly half the settlement/withdrawal population (the
  CONSID-CONVERT/CONSID-EXCHANGE-home cards — receipts A/B) sits in
  sections the CONSIDERATION producer owns, whose spec routes appraisal
  limbs to open_world. Those facts reach this family's claims only via
  open-world adjudication or a future cross-slice amendment; meanwhile
  the "demands for appraisal" lexicon key vetoes any careless ABSENT over
  exactly those sections, and the live-run handoffs measure the gap.
- **Both claims are near-universal boilerplate, so their standalone
  market-statistic value is modest** — the value is (a) closing an
  otherwise-uncovered family (uncovered families block auto-pass —
  program invariant), (b) the `statute_ref` observed-values feed for
  Ben's jurisdiction adjudication, and (c) the settlement-consent
  covenant's real variance (consent scope, qualifiers, cost allocation)
  surfacing in review at rank 88 with quotes attached. The slice is
  scaled accordingly: two concepts, two definitions, zero parsers.
- **No auto-pass exists for this family initially:** v1 has no
  field-level data to agree with (Grounding correction 2), so the M3
  v1/v2-agreement leg cannot be satisfied and every resolved claim is
  Ben-reviewed until v2 history accumulates — stated so nobody reads
  "resolves" as "publishes unreviewed".
- **Regime-vocabulary drift is a standing risk:** the TBOC card proves a
  regime can avoid every "appraisal" token; the withdraw-or-lose
  corroboration limb covers it today, but a future regime drafted without
  either limb queues `APPRAISAL_KIND_UNCORROBORATED` (typed, measurable)
  rather than resolving — the correct failure mode, extended by reviewed
  diff when live runs surface it.
