# Family spec — Financing covenants & financing cooperation (COV-FINANCING / COV-PAYOFF / COV-MARKETING)

**Date:** 2026-08-02. **Status:** AUDIT-AMENDED — 2026-08-02 adversarial
audit (verdict AMEND) applied: 3 CRITICAL (C-1, C-2, C-3) + 3 MATERIAL
(M-1, M-2, M-3) + 4 MINOR (m-1, m-2, m-3, m-4) fixes folded in; 0 parked
for Fable. Per program convention (spec-detail → audit → build → review),
next step is build.
**Parent:** `2026-08-02-openworld-promotion-program.md` (family-track sibling
of P1–P4; the five-layer promotion structure and cross-slice invariants apply
verbatim).
**Conventions bound:** `2026-08-02-p1-captable-numerics-design.md` (slice
template, typed-abstain parsers, corroboration tables, coverage-map
anchored-overlap + honesty pins); `2026-08-02-family-termination-rights-design.md`
(the producer-prompt-registry dispatch seam — this family dispatches through
it, NEVER a capitalisation fallback; the two-stage section-family classifier
with Ben's 2026-08-02 AI-assisted ruling; the cure-period day-count parser
grammar this slice's parser extends); `2026-08-02-family-termination-fee-design.md`
(full-table kind-ambiguity corroboration, pre-concept review routing, and the
BINDING boundary on fee machinery — cited, never redefined, below);
`2026-08-02-family-closing-conditions-design.md` (definition-keyed pattern
discipline, boundary on financing conditions); `2026-08-02-family-ioc-design.md`
(boundary on IOC-DEBT dollar baskets);
`2026-08-02-family-consideration-design.md` (currency-exclusion inversion —
cited here only to rule that NO money parser exists in this slice at all);
`2026-08-02-lexical-disagreement-net-design.md` (lexicon rules: word
boundaries, case-sensitive defined terms, deletion asymmetry, priced blind
spots); EXECUTION-LEDGER M3 review protocol + extraction semantics rules 1–3
(implemented, never amended, here).
**Materiality:** no financing-covenant tier exists today (`MATERIALITY_TABLE`,
`candidate-resolution.js` ~446–457, carries no `COV-` prefix of any kind).
This spec proposes one (section 4), flagged for Ben.

## Corpus grounding (production Supabase, project `tzulhdasmioeechxapdy`,
evidence pack read 2026-08-02; quotes are pack ground truth, cited by
provision_card id; two additional SELECT-only query receipts of my own are
recorded in Grounding corrections item 5)

v1 `provision_cards`, family + adjacent subtypes (cards/deals):
COV-FINANCING 36/25 (30 on COVENANT_OTHER, 6 on DEFINITION rows),
COV-DEBT 19/16, COV-PAYOFF 7/7, COV-MARKETING 3/3 (ALL THREE on
provision_type DEFINITION — none on a covenant row; pack variant warning 3),
plus the adjacent-family populations this spec pins boundaries against:
IOC-DEBT 51/35, DEF-INDEBTEDNESS 123/31, REP-B-FUNDS 30/28, COND-S-FUNDS 2/2,
and one null-subtype CLOSING_CONDITION card titled "[PROPOSED] Minimum
Financing / Cash Proceeds Condition" (card `f9224f32-b8cb-44e8-ae58-997d63ed4c21`).

Grounding quotes this spec builds on (every concept, corroboration pattern
and lexicon entry below traces to one of these; nothing is fabricated):

- Buyer obtain-financing efforts, debt — card
  `6b29cdd2-3269-4a63-a8f9-05005199a51c` §6.06: "Each of Parent and Merger
  Sub shall use reasonable best efforts to take, or cause to be taken, all
  things necessary, to obtain the Debt Financing on the terms and subject to
  the conditions (including "market flex" provisions) set forth in the Debt
  Commitment Letter…"
- Buyer obtain-financing efforts, equity — card
  `18003c8e-b0bb-4827-9444-e7552efb801d` §7.13: "The Parent Entities and the
  Merger Subs shall, and shall cause each of their respective Affiliates to,
  use its reasonable best efforts to obtain and consummate the Equity
  Financing … subject only to the conditions expressly set forth in the
  Equity Commitment Letter…" (no debt terms in this quoted limb-(a)
  sentence — pack variant warning 2; the same §7.13 region byte-verifiably
  ALSO contains a separate debt-obtain covenant referencing the Debt
  Commitment Letter, corrected here after failing byte verification —
  see test 3, which now enumerates both the EQUITY assertion off this
  quote and the DEBT assertion off the region's debt-obtain limb).
- Target cooperation, debt + the embedded no-condition acknowledgment — card
  `acb32b23-7399-4d87-a707-8938c103b82d` §6.13: "the Company shall, and
  shall cause the Company Subsidiaries to, and shall use its reasonable best
  efforts to cause its and their Representatives to, provide all customary
  cooperation and all customary financial information … (it being understood
  that the receipt of the Debt Financing is not a condition to the Merger),
  including using commercially reasonable efforts to: (i) provide all
  information reasonably requested by Parent and the Financing Parties …
  customarily used in marketing materials for financing" — THREE distinct
  hazards in one quote: RBE and CRE phrases coexist, a cooperation grant and
  a no-condition acknowledgment coexist, and "marketing materials" prose
  sits next to nothing about the Marketing Period.
- Target cooperation, mixed debt + preferred equity — card
  `edbf5766-d061-4d3f-88f1-362d9c34c6dc` §7.12: "the Company Entities shall,
  and shall use their respective reasonable best efforts to cause their
  respective Representatives to, provide such reasonable cooperation as
  requested by the Parent Entities in connection with the obtaining and
  arranging of the Debt Financing and the Preferred Equity Financing."
- Standalone no-financing-condition acknowledgment — card
  `7774a568-5268-4ee4-aa08-f2b3909516e1` §5.13(a): "Parent and Merger Sub
  acknowledge and agree that obtaining the Financing or any Alternate
  Financing is not a condition to consummation of the Transactions…" — with
  the RBE obtain covenant in the SAME section's limb (b) ("Each of Parent and
  Merger Sub shall use its reasonable best efforts to take, or cause to").
  Note the financing here is bare "the Financing" — neither the Debt nor
  Equity defined-term pattern fires (pack variant warning 1/2).
- Payoff, final + draft lead times in ONE sentence — card
  `ad2bdb5d-f903-4b1f-a8f6-8400c9aee0ed` §5.16: "use reasonable best efforts
  to deliver to Parent at least two (2) Business Days prior to the Closing
  Date (with drafts being delivered in advance as reasonably requested by
  Parent and no later than ten (10) Business Days prior to the Closing) (a)
  copies of Payoff Letters…"
- Payoff, DRAFT-stage-only day count — card
  `b3d14b3d-6c53-43e4-9020-408c4529513c` §6.17: "the Company shall … use its
  reasonable best efforts to furnish Parent with the Payoff Deliverables
  (including providing Parent with drafts thereof at least 3 Business Days
  prior to the Closing)." — the ONLY day count in the quote governs the
  drafts, not the final deliverable.
- Payoff, notice limb with no payoff term — card
  `862d6f99-8236-4229-8ec6-f59d72a216d3` §5.16(a): "At least three (3)
  Business Days prior to the anticipated Acceptance Time, the Company shall
  deliver a notice of termination in accordance with Section 2.3(b) of the
  Venture Loan and Security Agreement…" (corrected per audit M-2: the
  "Payoff" term is NOT confined to limb (b) — it also appears in the
  section heading, "5.16 Payoff Letters.", 176 bytes before limb (a). A
  heading-inclusive quote of limb (a) is therefore a live gate-bypass
  hazard, not a clean absence; see section 4's governing-clause-window fix
  and the pinned must-queue fixture in test 4).
- Payoff, spelled-only count — card `7bb30c73-cb9d-4792-ac19-95282c96d73b`
  §6.19: "deliver Payoff Deliverables … at least one Business Day prior to
  the Closing."
- Marketing Period definitions (ALL DEFINITION-typed): card
  `200eee42-e6e7-4d6e-a49d-bbf0adb0cac1` §10.14: ""Marketing Period" means
  the first period of fifteen (15) consecutive business days commencing
  after the date hereof and upon Parent's receipt of the Required Financial
  Information … provided that the Marketing Period shall not commence prior
  to September 4, 2018 … (i) shall not include November 21, 2018 through
  November 23, 2018…" plus the embedded notice-and-cure sub-timer "within
  three (3) business days after delivery of such notice"; card
  `72134a6a-01a5-484c-aae3-5af09caf58fa` §1.01: ""Marketing\nPeriod" shall
  mean the first period of 15 consecutive Business Days commencing on or
  after January 6, 2025…" — NOTE the literal NEWLINE inside the defined term
  in the committed bytes, plus HSR Second-Request gating, blackout-date
  lists, and "(vii) the Marketing Period shall be deemed completed on any
  earlier date on which the Bond Financing is consummated"; card
  `d7cdddd0-9157-4953-b924-59f871f62bac` §1.1: ""Marketing Period" means the
  first period of 15 consecutive Business Days (A) commencing on the later
  of…" with three chained complete-by/commence-no-earlier-than date pairs
  and the Debt-Financing early-completion override.
- Boundary evidence (NOT this family's claims): IOC-DEBT card
  `d8ea56db-…` (deal `13211d88-4f16-4730-bb70-fb1ef6ab3735`, section
  `5.2(x) | Indebtedness | 8fcdd5fe8f85`) — a target debt covenant
  cross-linked to buyer financing ("would not impair the ability of Parent
  to obtain the Debt Financing");
  COND-S-FUNDS/minimum-cash card `f9224f32-…` §8.1(e) ("aggregate gross cash
  proceeds of at least $50,000,000"); REP-B-FUNDS card
  `733b5b4c-c252-400e-8a70-c269f38ef6a7` §4.11 ("Parent will at the
  Effective Time have access to the funds necessary…").

**Provenance fact that frames the deliverable:** every sampled card in this
family carries `provenance.run_id = m2-00-corpus-backfill-2026-07-08…`,
extractor `parser-v2`/`m2-00-store-cards-v1`, `model: "legacy-provisions"`
(pack item 10). This family has NEVER been through a dedicated extraction
pass; all subtype labels are legacy-backfill output and are UNTRUSTED input
to this design — every corroboration table below exists because of that.

## Grounding corrections (verified against repo + production DB, 2026-08-02)

1. **Zero registered v2 vocabulary for this family.** `contract-bundle.js`
   `EXPECTED_CONCEPT_KEYS_V1..V3` (~2838–2861) carry no COV-FINANCING,
   COV-PAYOFF, COV-MARKETING, or any financing concept; no claim definition
   in `EXPECTED_CLAIM_KEYS_V1..V14` touches financing. Everything in section
   1 is a new registration, proposed to Ben.
2. **v1 has NO deterministic title rules for financing or payoff sections.**
   `lib/parser-v2/classify.js` carries exactly ONE family-relevant rule:
   `/marketing\s+period/i → COV-MARKETING` (line ~306,
   SUBCODE_REFINEMENT_RULES, whenType COV). There is nothing to "port" for
   COV-FINANCING/COV-PAYOFF — the v1 subtypes were AI-assigned. Stage-1
   title regexes for this family are authored FRESH here (section 3),
   grounded in the pack's observed section titles, and validated against
   ALL deals' section titles before dispatch (the repo classify-rules
   safety convention). Any spec claiming to port financing title rules from
   v1 would be building against artifacts that do not exist — the
   plausible-but-wrong failure this programme exists to prevent.
3. **No materiality tier covers `COV-` anything.** A financing claim
   resolved today would rank UNCLASSIFIED 99 and sort below notices.
   Section 4 proposes a tier, flagged for Ben; the prefix list is
   deliberately NARROW (exact three concept keys, never a bare `COV-`
   prefix — a bare prefix would silently sweep every future COV-* family
   into the financing tier, a taxonomy decision nobody made).
4. **The v1 generic-COV feature redundancy is hygiene, not vocabulary.**
   `lib/rubric.js`'s generic COV array carries BOTH `financingCooperation`
   (boolean) and `financingCooperationPresent` (boolean) with near-identical
   semantics (pack FEATURES section). Neither is promoted; the redundancy is
   flagged to the ingest-QA owner. The v2 shape is section 1's claim
   definitions — no boolean pair, and per M3 rule 1 the `false` half of any
   such pair is a producer-asserted negative and is BANNED.
5. **Two query receipts (SELECT-only, 2026-08-02) grounding two rulings:**
   - Specific-performance-with-financing text exists in 24 cards / 16 deals,
     with subtype distribution MISC-SPECIFIC 7, TERMF-SOLE 6, null 5,
     MISC-GOVLAW 3, MISC-THIRDPARTY 1, MISC-JURY 1, REP-B-FUNDS 1
     (sums exactly to 24) — **zero cards in
     COV-FINANCING/COV-PAYOFF/COV-MARKETING**. Specific-performance
     carve-outs are remedies/fee-family text, not financing-covenant text
     (see Cross-family boundaries). Note one of the non-null subtypes,
     REP-B-FUNDS, is itself a family this spec pins boundaries against
     (boundary item 4) — its single specific-performance-adjacent card
     mints nothing here either.
   - **Zero `$` literals in any COV-FINANCING `region_full_text`**
     (0 cards / 0 deals), while `reimburse` prose appears in 17/17 —
     cooperation fee-reimbursement obligations exist but carry NO grounded
     dollar caps in this family's corpus text. Consequence: this slice
     ships NO money parser and promotes NO fee-cap value (section 2).

## Deliverable (honest conversion semantics)

Governed, resolvable claims for the family brief's four workstreams:
(a) the buyer's debt/equity-financing efforts standard; (b) the target's
financing-cooperation covenant; (c) the no-financing-condition
acknowledgment — quoted PRESENT claims only, never a derived negative;
(d) the family's numeric surface: payoff-deliverable lead-time day counts
and the marketing-period length in business days. Financing-failure
CONSEQUENCES (reverse-fee interplay, specific-performance carve-outs) are
boundary-cited, never rebuilt (see Cross-family boundaries).

**No recorded native runs exist for this family** (Grounding: the m2-00
backfill provenance above; the producer today extracts only capitalisation
sections). There are no open-world fixture rows to convert and no
closure_ids to track. The deliverable is the five-layer capability plus a
pre-rerun harness: a COVERAGE MAP over committed corpus-quote fixtures (the
cards named above, committed as LITERAL production bytes with provenance
headers — deal, provision_card id, retrieval date, subtype INCLUDING the
DEFINITION provision_type where true, the TERMF m-2 discipline), each
hand-enumerated with its expected outcome. The P1 audit M-5 honesty pins
apply verbatim: "the pipeline natively extracts financing covenants" may be
claimed ONLY after dated post-merge live-run handoffs (subscription CLI);
until then the honest claim is "the machinery exists and is proven on
committed fixtures".

**Fixture placement is load-bearing:** all committed fixtures live under
`tests/fixtures/canonical-v2/financing-covenants-live-run/` so the
forbidden-patterns PROSE_CLASS_FINGERPRINTS exemption
(scripts/lint/forbidden-patterns.sh ~42–55) covers its six listed
patterns for this fixture directory (corrected per audit m-4: the
exemption is scoped to those six prose-class fingerprints only — GLOBAL
patterns still run inside `*-live-run` fixtures; `docs/` itself is
excluded from the walk, so this spec's own prose cannot trip regardless).
Checked against globalPatterns: this family's vocabulary ("marketing
period", "financing cooperation", "payoff letters", "commitment letter")
was spot-checked and collides with no global fingerprint; the scoped
`TSA|transition services agreement` pattern applies only to
registry/OtherCovenants-named runtime files, which this slice does not
touch — and NO spec prose, fixture, or module in this slice may introduce
transition-services vocabulary outside that reviewed exemption route (the
v1 `tsaContemplated` feature is NOT promoted, partly for exactly this
reason: its label text is a scoped-fingerprint collision waiting for an
unreviewed file).

## Cross-family boundaries (BINDING; duplication is an automatic audit
CRITICAL; each pin has a named acceptance test in section 6)

1. **Termination-fee machinery — CITED, never redefined.** The
   termination-fee spec owns all fee amounts, fee triggers, and tails; its
   registry section RULED that v1's `FINANCING_FAILURE` trigger code is a
   COMPOSED trigger and stays open world, unpromoted. This spec adopts that
   ruling verbatim: no financing-failure fee trigger, no reverse-fee
   amount, no fee_side vocabulary appears anywhere in this family's
   definitions, parsers, or corroboration tables. A financing-section quote
   that carries fee-payment text mints NOTHING here — fee content in a
   financing section is at most a lexical cross-hit (priced, section 5) or
   an open-world candidate. Test 4 pins it.
2. **Specific-performance carve-outs — receipt-grounded OUT.** Query
   receipt (Grounding item 5): the drafting lives on MISC-SPECIFIC,
   TERMF-SOLE, and a small tail of other non-null subtypes (restated
   exactly in Grounding correction 5), zero on this family's cards.
   TERMF-SOLE is explicitly out of scope in the termination-fee spec (no
   registered concept); `2026-08-02-family-specific-performance-remedies-design.md`
   (REM-*, DRAFT, same wave) owns the remedies family and itself pins the
   reciprocal boundary (its own lines ~227, ~857: zero COV-FINANCING
   claims). This spec cites that reciprocal pin rather than asserting no
   remedies spec exists. This slice registers no concept, no pattern, and
   no claim for specific performance; the shape stays open world, feeding
   the commonality report.
3. **Financing CONDITIONS — closing-conditions family territory,
   flagged-to-adjudication there, not covered here.** `COND-S-FUNDS`
   (n=2/2) and the null-subtype "[PROPOSED] Minimum Financing / Cash
   Proceeds Condition" card (`f9224f32-…`) belong to the closing-conditions
   family's deferred/null-subtype populations (its Out of scope names the
   funds condition and the [PROPOSED] categories explicitly). This spec's
   `NO_FINANCING_CONDITION_ACKNOWLEDGMENT` claim asserts ONLY that a quoted
   acknowledgment sentence exists — it NEVER implies, derives, or blocks a
   COND-S-FUNDS claim, and its absence never implies a financing condition
   exists. The two vocabularies share no keys. Test 4 pins that the
   minimum-cash quote resolves nothing in this family.
4. **REP-B-FUNDS (buyer sufficient-funds rep)** — reps family (registered
   REP-B- prefix, rank 55). Not touched; the rep's `financingRepIncluded`
   v1 feature is not promoted here.
5. **IOC-DEBT (target debt-incurrence baskets, dollar thresholds)** — the
   IOC family spec owns the concept, its `ioc-threshold-parse.js` money
   parser, and the `/\bIndebtedness\b/` lexicon key. This slice ships NO
   money parser (zero-`$` receipt above), so a swapped or mislabeled
   IOC-DEBT dollar quote structurally cannot mint a value here. The
   cross-linked card (deal `13211d88` §5.2(x), "would not impair the
   ability of Parent to obtain the Debt Financing") is committed as the
   boundary fixture: an IOC quote containing the Debt Financing defined
   term fails this family's kind corroboration (no efforts+obtain pair, no
   cooperation grant, no payoff term) and queues or stays open world —
   never a financing claim. Test 4 pins it.
6. **DEF-INDEBTEDNESS (123 cards)** — definition-graph territory; the
   pack's own references-jsonb warning (item 9: only 3/21 references on a
   sampled COV-FINANCING card are on-topic) is the reason NO design below
   consumes `references` for anything. Definitions sections are dispatched
   to this family's producer ONLY via the Marketing-Period defined-term
   anchor (section 3), which matches nothing in an Indebtedness definition.
7. **No-shop notice content** (`infoRequiredFinancingPapers`, rubric
   ~2963) — no-shop family feature; not promoted, not patterned here.
8. **Antitrust/HSR gating inside Marketing Period definitions** (card
   `72134a6a`'s Second-Request condition) — regulatory-condition semantics
   belong to the closing-conditions/antitrust families. Here that text is
   quote evidence for the reviewer only; no parser or corroboration in this
   slice evaluates an HSR state, ever.

## 1. Registry (`contract-bundle.js` → next frozen version at this slice's
merge; the closing-conditions numbering convention — both wave-one siblings
also bind "V15", so every superset-diff test is written against CONTENT
(sorted key sets), never the numeral)

Strictly additive spread of the current head version. **New concepts, all
three FLAGGED FOR BEN in the PR body** (concept-key additions are taxonomy
decisions; this spec proposes, Ben settles — the 2026-07-23 convention).
`{concept_key, version}` shape only (the fixture-shape validator rejects
anything else):

- `COV-FINANCING` — buyer financing efforts + target financing cooperation
  + the no-financing-condition acknowledgment (36 cards / 25 deals). ONE
  concept for the section-family, with the legal fact split carried by
  claim definitions and governed attributes — the party split
  (buyer-obtain vs target-cooperate) is attribute-and-party data, never a
  key suffix (the ratified TERMR party-attribution precedent; there is no
  legacy side-suffixed sibling here, so the rule applies cleanly).
- `COV-PAYOFF` — payoff letters / payoff deliverables covenant (7/7).
- `COV-MARKETING` — the Marketing Period (3/3). Registered as the
  rubric-consistent key even though ALL corpus instances are
  DEFINITION-typed cards: the concept names the legal construct, and
  section 3's defined-term anchor is what reaches its drafting. The
  COV-typed rubric label's covenant framing is a v1 vocabulary artifact,
  named here so no implementer assumes covenant-article residence (pack
  variant warning 3).

NOT added, each a ruled decision:

- `COV-DEBT` (19/16) — outside the family brief's four workstreams, and the
  corpus population is semantically heterogeneous (pack variant warning 6):
  genuine convertible-notes/indenture-treatment covenants (cards
  `4841a6ec`, `f4341ac3`) PLUS an interest-rate-swap cooperation covenant
  with zero debt-repayment content (card `b19f5c11`) PLUS a bare DEFINITION
  card ("Existing Indebtedness", card `c518301c`) misfiled under the
  covenant subtype. One concept over that population would fuse distinct
  legal facts — rule-3 nearest-fit forcing. Existing-debt treatment gets
  its own follow-on slice with its own grounding pass; the drafting stays
  open world, feeding the commonality report. Priced.
- Any fee-reimbursement or fee-cap concept — zero grounded dollar bytes
  (Grounding item 5); quoted reimbursement obligations stay open world.
- Any specific-performance or financing-failure-consequence concept
  (Cross-family boundaries items 1–2).

**Claim definitions** (five):

```
FINANCING_OBTAIN_EFFORTS_STANDARD_CLAIM_DEFINITION_V1
  claim_definition_key: 'FINANCING_OBTAIN_EFFORTS_STANDARD'
  version: 1
  allowed_canonical_values: [                    // enum, registry-hosted
    'REASONABLE_BEST_EFFORTS',                   // (the NO_SHOP_PROHIBITED_ACTION
    'COMMERCIALLY_REASONABLE_EFFORTS',           //  precedent — Ben reviews the
  ]                                              //  enum in the registry diff)
  canonical_value_required_when_present: true

FINANCING_COOPERATION_PRESENT_CLAIM_DEFINITION_V1
  claim_definition_key: 'FINANCING_COOPERATION_PRESENT'
  version: 1
  allowed_canonical_values: [true]               // presence claim, the
  canonical_value_required_when_present: true    // KNOWLEDGE_QUALIFIER shape

NO_FINANCING_CONDITION_ACKNOWLEDGMENT_CLAIM_DEFINITION_V1
  claim_definition_key: 'NO_FINANCING_CONDITION_ACKNOWLEDGMENT'
  version: 1
  allowed_canonical_values: [true]
  canonical_value_required_when_present: true

PAYOFF_DELIVERY_LEAD_TIME_DAYS_CLAIM_DEFINITION_V1
  claim_definition_key: 'PAYOFF_DELIVERY_LEAD_TIME_DAYS'
  version: 1
  canonical_value_type: 'NON_NEGATIVE_DECIMAL_STRING'   // existing type
  canonical_value_required_when_present: true

MARKETING_PERIOD_LENGTH_DAYS_CLAIM_DEFINITION_V1
  claim_definition_key: 'MARKETING_PERIOD_LENGTH_DAYS'
  version: 1
  canonical_value_type: 'NON_NEGATIVE_DECIMAL_STRING'
  canonical_value_required_when_present: true
```

No new canonical value types; no validator changes. Concepts and
definitions grow the expected-keys rows as sorted supersets (content-diffed
tests; prior rows untouched byte-for-byte).

**Three enum/shape decisions, pinned as legal rulings:**

- **The no-financing-condition acknowledgment is a quoted PRESENT claim,
  never a derived negative — the family's headline M3-rule-1 trap.** The
  claim exists ONLY when the agreement drafts the acknowledgment sentence
  and the producer quotes it ("obtaining the Financing … is not a
  condition to consummation", card `7774a568`; "(it being understood that
  the receipt of the Debt Financing is not a condition to the Merger)",
  card `acb32b23`). A deal without the sentence simply has no such claim;
  "this deal has no financing condition" is a scope-closure derivation
  over the CONDITIONS article, owned by the closing-conditions family's
  future machinery, and no producer, resolver branch, or report in this
  slice may state it. A producer taught to emit the acknowledgment on
  silence would publish an invisible, authoritative-looking negative into
  the market statistic this family feeds — the exact corruption M3 rule 1
  exists to stop.
- **Cooperation is presence-shaped, not standard-shaped.** Card `acb32b23`
  drafts an ABSOLUTE primary obligation ("the Company shall … provide all
  customary cooperation") with RBE limited to causing Representatives and
  CRE governing an enumerated sub-list — THREE standards in one covenant.
  Forcing one enum code onto that structure would be rule-3 nearest-fit
  forcing, and corroborating an "absolute" code by the ABSENCE of an
  efforts phrase would be a derived negative. So
  `FINANCING_COOPERATION_PRESENT` is `[true]`-valued; the standards
  stratification stays in the quote as evidence and in open world until a
  grounded, Ben-adjudicated sub-structure exists. The efforts ENUM applies
  only to the buyer's obtain covenant, where the corpus drafting is a
  single governing phrase (cards `6b29cdd2`, `18003c8e`, `7774a568`).
- **No money value anywhere in this family this slice** (zero-`$` receipt,
  Grounding item 5). The consideration spec's currency-exclusion inversion
  is cited only to say: neither direction applies — there is no
  currency-bearing claim here at all, and any implementer wiring a money
  tokenizer into section 2's parser is off-spec. The family's numeric
  surface is day counts, exclusively.

**Governed attributes (never in keys; all participate in claim
identity/closure so two same-section claims never collide or dedupe):**

- `financing_kind`: enum `DEBT | EQUITY | DEBT_AND_EQUITY | UNSPECIFIED` —
  on the efforts, cooperation and acknowledgment claims. Grounded: DEBT
  (`6b29cdd2`), EQUITY (`18003c8e`), mixed debt + preferred equity
  (`edbf5766`), bare "the Financing" (`7774a568` — UNSPECIFIED). The enum
  is a gate: out-of-enum → explicit `pushOpenWorld`, typed reason (P1 C-4
  — the main loop's open-world routing keys on proposal_kind and will not
  catch it). Corroborated against quote text (section 4), never trusted
  from the label: a regex anchored on "Debt Commitment Letter" alone would
  silently miss every equity-only deal (pack variant warning 2), which is
  why EQUITY and UNSPECIFIED are first-class codes, not fallbacks.
- `obligor_ref` (efforts + cooperation claims): verbatim performing-party
  phrase ("Each of Parent and Merger Sub", "the Company", "The Parent
  Entities and the Merger Subs", "the Company Entities"). REQUIRED; must
  be a verbatim substring of the byte-verified quote (P1 M-3 discipline),
  failure → review, typed `OBLIGOR_REF_NOT_IN_QUOTE`; positionally
  corroborated (section 4 — the TERMR C-2 device, because every
  cooperation quote names BOTH parties: "cooperation … reasonably
  requested by Parent"). Flows through `resolveParty`/
  `PARTY_CAPACITY_LEXICON`, party_role `FINANCING_COVENANT_OBLIGOR` (new
  role value, strictly additive, FLAGGED FOR BEN — inventing a role is a
  vocabulary call this spec proposes, not one already made); unresolvable
  → existing `PARTY_UNRESOLVED` review.
- `PAYOFF_DELIVERY_LEAD_TIME_DAYS` additionally: `day_kind` — enum
  `CALENDAR | BUSINESS`, corroborated in the parser's matched_text
  (section 4); `delivery_stage` — enum `FINAL | DRAFT`, identity-bearing
  and corroborated: card `ad2bdb5d` carries a 2-day FINAL and a 10-day
  DRAFT count in one sentence, and card `b3d14b3d`'s ONLY count (3 days)
  governs drafts — without the stage split the cross-deal lead-time
  statistic conflates two different legal facts, silently;
  `deliverable_term_ref` — verbatim deliverable phrase ("Payoff Letters",
  "Payoff Deliverables", "payoff letter"), REQUIRED, substring-enforced
  INSIDE the parser's governing-clause `matched_text` window (the SAME
  frozen window `day_kind`/`delivery_stage` corroborate against, section
  2/4) — never merely anywhere in the producer's quote (corrected per
  audit M-2: card `862d6f99`'s section heading, "5.16 Payoff Letters.",
  sits 176 bytes before limb (a), so a heading-inclusive quote would
  satisfy a quote-wide substring check even though the count itself
  governs an unrelated loan-termination notice). Typed
  `DELIVERABLE_TERM_NOT_IN_QUOTE` / `DELIVERABLE_TERM_UNIDENTIFIED` — this
  is the gate that stops card `862d6f99`'s limb-(a) loan-termination
  NOTICE day count from publishing as a payoff lead time: the
  governing-clause window around limb (a)'s count carries no payoff term
  even though the heading and limb (b) do; it queues. A heading-inclusive
  quote of the same limb is committed as a pinned must-queue regression
  fixture (test 4) precisely because it is the bypass this gate exists to
  stop.
- `MARKETING_PERIOD_LENGTH_DAYS` additionally: `day_kind` (all three
  grounded quotes are business days; a CALENDAR label queues
  unconditionally this slice — zero grounded calendar-day marketing
  periods exist, the TERMR NO_SOLICITATION_BREACH precedent verbatim);
  `marketing_term_ref` — the verbatim defined-term span, REQUIRED,
  substring-enforced; note the committed `72134a6a` bytes carry a NEWLINE
  inside the term ("Marketing\nPeriod"), so the enforcement is on the
  literal fixture bytes, never a retyped single-space form.

## 2. Value parser: `financing-day-count-parse.js` (the ONLY parser in this
slice — one pure module, `measurement-date-parse.js` contract shape: typed
`{outcome:'RESOLVED', canonical_value, matched_text}` /
`{outcome:'ABSTAIN', reason}`; never a throw on prose, never arithmetic,
never repair; `FINANCING_DAY_COUNT_PARSE_VERSION` threaded into the
resolution receipt, P1 M-6)

Grammar = the TERMR `cure-period-parse.js` grammar, extended by exactly one
frozen device:

- RESOLVES: a literal integer governing a day word — candidate tokens are
  digit runs whose next word is a day word (`day`/`days`/`Days`/`Business
  Day`/`Business Days`/`business day`/`business days`, singular and
  bare-capitalized forms per TERMR m-5) — **with a frozen
  intervening-modifier allowlist of exactly `{consecutive}`** between the
  digit and the day word. Grounded necessity: all three marketing-period
  quotes draft "15 consecutive Business Days" / "fifteen (15) consecutive
  business days" — under the unextended TERMR adjacency rule every one
  ABSTAINs `NO_DAY_COUNT`, making the family's flagship value unreachable.
  The allowlist is a frozen one-element set, not a skip-words heuristic;
  any other intervening token disqualifies the candidate. (Payoff quotes
  are direct-adjacency and need no allowance.)
- Hybrid "two (2) Business Days" / "fifteen (15) consecutive business
  days": the parenthesized DIGIT is the candidate; a preceding spelled
  numeral from the frozen word→value table that CONTRADICTS the digit →
  ABSTAIN `SPELLED_DIGIT_MISMATCH` → review. Spelled-only ("one Business
  Day", card `7bb30c73`) → ABSTAIN `NON_LITERAL_NUMERAL` → review, never a
  lookup-and-resolve (the table detects contradiction; it never reads
  numbers). Honest cost: deal `af4940e1`'s payoff lead time QUEUES this
  slice. Priced.
- Exclusions before candidate counting (P1 tokenizer discipline, inherited
  verbatim): section references, calendar dates, clock times, currency
  literals. This is what makes the marketing-period blackout-date lists
  ("November 26, 2025 through and including November 28, 2025", "commence
  no earlier than September 2, 2025") and anchor dates invisible to the
  day-count candidate set — dates are dates, never day counts (pack
  variant warning 4's multi-numeric hazard, half-defused by exclusion).
- Two or more surviving day counts → ABSTAIN `MULTIPLE_DAY_COUNTS` →
  review. This is the DESIGNED outcome for every full Marketing Period
  definition: the primary 15-day period and the embedded 3-business-day
  notice-and-cure sub-timer coexist in all three corpus definitions, with
  no reliable positional anchor (pack variant warning 4). The parser NEVER
  picks; the producer quotes the "first period of 15 consecutive Business
  Days" limb alone (section 3). Likewise card `ad2bdb5d`'s payoff sentence
  (2-day final + 10-day drafts) ABSTAINs unsplit. Its DRAFT sub-quote
  ("with drafts being delivered in advance as reasonably requested by
  Parent and no later than ten (10) Business Days prior to the Closing")
  is hand-enumerated and resolves `'10'`. Its FINAL sub-quote does NOT
  resolve under this slice's gates (corrected per audit C-3): any
  contiguous span wide enough to carry both the 2-day count and the
  "Payoff Letters" deliverable term also re-includes the drafts
  parenthetical — a second surviving count — and re-triggers
  `MULTIPLE_DAY_COUNTS`; a span narrow enough to exclude the parenthetical
  carries no deliverable term before it (the governing section heading is
  "Prepayment of Indebtedness"), triggering `DELIVERABLE_TERM_NOT_IN_QUOTE`.
  FINAL on `ad2bdb5d` therefore QUEUES this slice under either framing —
  an honest, priced cost (Known costs), never a resolved value.
- Zero candidates → ABSTAIN `NO_DAY_COUNT`.
- Event-based early-completion overrides ("shall be deemed completed on
  any earlier date on which the Bond Financing is consummated", cards
  `72134a6a`/`d7cdddd0` — pack variant warning 5) contain no day-count
  candidates and are legal text for the reviewer inside the quote; the
  parser never models them as a duration modifier or exit value.
- `day_kind` / `delivery_stage` are NOT decided here — the parser returns
  `matched_text` scoped to a FROZEN governing-clause window (audit M-3;
  frozen in the parser contract, not tunable per-fixture): the containing
  parenthetical group (nearest balanced `(`…`)` pair) if the candidate
  digit run sits inside one, else the containing sentence (nearest
  sentence-terminal punctuation on each side). The resolver corroborates
  `day_kind`, `delivery_stage`, and `deliverable_term_ref` against that
  frozen window, never the full quote (section 4). Both `b3d14b3d`
  outcomes are pinned against this exact definition: its only count sits
  inside the parenthetical "(including providing Parent with drafts
  thereof at least 3 Business Days prior to the Closing)", so the window
  IS that parenthetical — DRAFT-labeled resolves `'3'`, FINAL-labeled
  fails `DELIVERY_STAGE_UNCORROBORATED` (test 3).
- Canonical form: strict digits (`^\d+$` after extraction), round-trips
  `NON_NEGATIVE_DECIMAL_STRING`.

The parser never computes: "at least two (2) Business Days prior to the
Closing Date" resolves as the count `'2'` with the at-least/prior-to
structure preserved in the quoted evidence — comparatives and anchors are
legal text for the reviewer, not operands. No money tokenizer exists in
this module (Grounding item 5's zero-`$` receipt; the fence is a named
acceptance test, not a comment).

## 3. Producer prompt + provider

- **New prompt module** `financing-producer-prompt.js`
  (`lib/canonical-v2/native-producer/`). The capitalisation prompt is NOT
  edited (PROMPT_VERSION unmoved; recorded fixtures replay
  byte-identically). New `PROMPT_ID 'native-producer-financing/v1'`,
  `PROMPT_VERSION 1`, bumped once per slice, never mid-slice.
- **Dispatch through `producer-prompt-registry.js`** — the seam the
  termination-rights spec defines; this spec writes against it and does
  not re-design it. One frozen entry added: `FINANCING →
  buildFinancingProducerPrompt`. Unknown family → no prompt, no
  candidates, typed record — never a silent capitalisation fallback.
  Corrected per audit m-3: `producer-prompt-registry.js` already exists at
  head (with the CAPITALISATION entry and fail-closed nulls) — this slice
  ADDS ONE ENTRY to the existing seam, it does not build it. The
  capitalisation byte-identical-replay test guards the addition.
- **Section-family classifier extension — stage 1 rules authored FRESH
  (Grounding correction 2), grounded in the pack's observed titles.
  Corrected per audit C-2: title text alone is NOT a safe dispatch key —
  the corpus's own REP-B-FUNDS sections carry the identical headings
  "Financing" (card `d89441ea` "Section 5.8 Financing.", card `dd37da8c`
  "Section 4.10 Financing.") and "Debt Financing" (card `e8833779` "4.10
  Debt Financing."). Stage 1's rule SIGNATURE is therefore extended from
  `runStage1(title)` to `runStage1(title, article_context)`, where
  `article_context` is sourced from the deterministic sectionizer's
  existing article classification (v1 precedent: `classify.js` ~509).
  This is a classifier schema/version bump (the bumped
  `section_family_classifier_version` threaded in section 4), not an
  in-place edit of the title-only contract:**
  - `/\bfinancing\b/i` matching a section title AND `article_context ===
    'COVENANTS'` — covers "Financing", "Debt Financing", "Financing
    Cooperation", "Financing; Financing Cooperation" (cards `6b29cdd2`,
    `acb32b23`, `7774a568`, `18003c8e`, `edbf5766`), all of which sit in a
    covenants article. The article_context gate is what stops the SAME
    title strings from dispatching the REP-B-FUNDS sections above, which
    sit in a representations article — title regex alone cannot
    distinguish them. Pack variant warning 1 is a FEATURE here, not a
    bug: the no-condition-disclaimer section titled bare "Financing"
    belongs to this family (its content is the acknowledgment claim), so
    title-conflation WITHIN the covenants article costs nothing — the
    kind split happens at corroboration, not classification.
  - `/payoff\s+(letters?|deliverables)|prepayment\s+of\s+indebtedness|repaid\s+indebtedness/i`
    — covers "Payoff Letters", "Payoff Deliverables", "Prepayment of
    Indebtedness", "Repaid Indebtedness" (cards `ad2bdb5d`, `b3d14b3d`,
    `862d6f99`, `7bb30c73`).
  - Stage 1 is validated against ALL deals' section titles before
    dispatch (the classify-rules safety check); the known collision
    surface to verify there is the REAL one, not a hypothetical: the
    REP-B-FUNDS titles "Financing" (§5.8, card `d89441ea`), "Financing"
    (§4.10, card `dd37da8c`), and "Debt Financing" (§4.10, card
    `e8833779`) all verbatim-match `/\bfinancing\b/i` but sit in a
    REPRESENTATIONS article_context, so the extended rule does not
    dispatch them; the `733b5b4c` REP-B-FUNDS card ("Sufficient Funds"
    title) never hits the regex at all and is a weaker, non-representative
    collision fixture on its own. COND articles and TERMF sections
    ("Termination Fee" — no hit) round out the surface. Stage 2
    (AI-assisted, Ben's 2026-08-02 ruling) applies unchanged with its
    `SECTION_FAMILY_AI_CLASSIFIED` provenance and
    `SECTION_FAMILY_AI_UNVERIFIED` auto-pass block.
  - **Defined-term anchor for the Marketing Period — a deliberate,
    FLAGGED-FOR-BEN extension of the two-stage seam.** All three
    COV-MARKETING corpus instances live in DEFINITIONS-article sections
    ("1.01", "1.1", "10.14" — pack variant warning 3); no title rule can
    reach them, and routing entire definitions articles through stage-2 AI
    would be scattershot. New stage 1b, deterministic: a section that
    fails all title rules is dispatched to the FINANCING producer iff its
    canonical text matches the anchored definitional pattern
    `/"Marketing\s{1,3}Period"\s+(?:shall\s+)?means?\b/` — grounded in all
    three committed byte forms (""Marketing Period" means" ×2,
    ""Marketing\nPeriod" shall mean" with the internal newline; the
    `\s{1,3}` bound is what tolerates it; matching runs on LITERAL
    committed bytes, never retyped ASCII). Provenance
    `SECTION_FAMILY_DEFINED_TERM_ANCHORED` travels like the AI tag (run
    receipt, candidate extraction_provenance, review items) so the basis
    is visible in output. It is rule-deterministic, so no
    unverified-condition block applies — but because it extends Ben's
    ruled two-stage design, the PR body flags it as a seam amendment for
    his eyes, and the prompt dispatched to an anchored section instructs
    the producer to quote ONLY marketing-period material from it (a
    definitions section is huge; everything else in it stays untouched —
    other definitions are other families' business, boundary item 6).
- **Response shape:** a `financing_assertions` array — each element
  `{ section_reference, assertion_kind: 'OBTAIN_EFFORTS' |
  'COOPERATION_GRANT' | 'NO_FINANCING_CONDITION_ACK' | 'PAYOFF_LEAD_TIME' |
  'MARKETING_PERIOD_LENGTH', financing_kind (efforts/cooperation/ack),
  standard_code (OBTAIN_EFFORTS only), obligor (verbatim phrase,
  efforts/cooperation), day_kind + delivery_stage + deliverable_term
  (PAYOFF_LEAD_TIME), day_kind + marketing_term (MARKETING_PERIOD_LENGTH),
  verbatim quote }` plus `open_world_candidates`. One element per legal
  fact: card `7774a568`'s §5.13 is TWO assertions (the limb-(a)
  acknowledgment, the limb-(b) obtain covenant); card `acb32b23`'s §6.13(a)
  is TWO (cooperation grant + the parenthetical acknowledgment); card
  `ad2bdb5d`'s payoff sentence is TWO (final lead time, drafts lead time)
  — each quoting its own limb, so the parser's one-count rule and section
  4's single-kind corroboration are satisfiable (the P1 compound-sentence
  rule verbatim). For MARKETING_PERIOD_LENGTH the prompt pins: quote the
  "first period of N consecutive Business Days" limb ONLY — blackout
  windows, commencement gates, notice-and-cure sub-timers and
  early-completion overrides are separate open-world candidates, never
  folded into the length quote. PRESERVE-THE-NOVEL retained verbatim; when
  unsure of any enum, kind, or side, keep the assertion in
  `open_world_candidates` — promotion narrows novelty, never forces fit.
  The producer never asserts a negative (M3 rule 1): no "financing
  condition absent", no "no cooperation covenant", no
  `cooperation: false` — quoted positives or open world, nothing else.
- **Provider (`anthropic-provider.js`):** ONE new generic key,
  `NATIVE_FINANCING_COVENANT_CANDIDATE`, proposal_kind
  `FINANCING_COVENANT` (≠ OPEN_WORLD). `financing_assertions` is NOT added
  to `REQUIRED_RESPONSE_LISTS` (the share_count precedent at ~83–89
  verbatim: recorded responses predate the key; missing/non-array reads as
  empty list, never a schema failure). Quote byte-verification identical
  to existing proposals.
- Golden evals: recorded responses are never hand-edited into the new
  shape; the first financing-family recordings are minted by the first
  live runs (subscription CLI), each its own dated handoff.

## 4. Resolver wiring (`candidate-resolution.js`)

- **ONE `RESOLUTION_UNCONDITIONAL` entry** (P1 M-2: the Map is keyed on
  generic_claim_key alone; two entries would silently last-win):
  `NATIVE_FINANCING_COVENANT_CANDIDATE`, `deterministic_kind: null`,
  `attachment_position: null`, `registered_claim_definition_key: null`,
  `concept_key: null` (explicit, with the TERMR build-time check that
  nothing reads `mapping.concept_key` before the handler's kind map runs),
  `party_field: 'obligor'`, `party_role: 'FINANCING_COVENANT_OBLIGOR'`.
  `MAPPING_TABLE_VERSION` bumped; table-validation still asserts no
  duplicate generic keys.
- **Handler split on `assertion_kind`** via a frozen map:
  `OBTAIN_EFFORTS → COV-FINANCING × FINANCING_OBTAIN_EFFORTS_STANDARD`;
  `COOPERATION_GRANT → COV-FINANCING × FINANCING_COOPERATION_PRESENT`;
  `NO_FINANCING_CONDITION_ACK → COV-FINANCING ×
  NO_FINANCING_CONDITION_ACKNOWLEDGMENT`;
  `PAYOFF_LEAD_TIME → COV-PAYOFF × PAYOFF_DELIVERY_LEAD_TIME_DAYS`;
  `MARKETING_PERIOD_LENGTH → COV-MARKETING × MARKETING_PERIOD_LENGTH_DAYS`.
  Out-of-enum assertion_kind → explicit `pushOpenWorld`, typed reason.
- **Full-table kind ambiguity rule (the TERMF C-3 device, REQUIRED because
  compound financing sections are this family's norm):** the handler runs
  ALL kinds' corroboration patterns over the byte-verified quote; patterns
  for ≥2 distinct kinds matching → review, typed
  `AMBIGUOUS_FINANCING_KIND` — UNLESS the assertion quotes a narrower
  contiguous sub-quote in which exactly one kind's patterns match. Pinned
  regression fixtures: card `acb32b23`'s unsplit §6.13(a) quote (matches
  COOPERATION_GRANT and NO_FINANCING_CONDITION_ACK) queues; its two
  sub-quotes resolve. No subsumption exceptions exist in this family's
  table (unlike the closing-conditions MAE pair) — all five kinds are
  independent.
- **Kind corroboration table** (frozen resolver constants; label must
  match quote text; every pattern grounded in a committed fixture quote):
  - `OBTAIN_EFFORTS` ↔ /efforts/i AND /\bobtain\b/i (cards `6b29cdd2`
    "reasonable best efforts to take, or cause to be taken, all things
    necessary, to obtain the Debt Financing"; `18003c8e` "reasonable best
    efforts to obtain and consummate the Equity Financing").
  - `COOPERATION_GRANT` ↔ /cooperation/i (cards `acb32b23` "provide all
    customary cooperation"; `edbf5766` "provide such reasonable
    cooperation as requested").
  - `NO_FINANCING_CONDITION_ACK` ↔ /is not a condition to/i (cards
    `7774a568`, `acb32b23` — both grounded byte forms end "…condition to
    consummation" / "…condition to the Merger"; the pattern stops at the
    shared stem).
  - `PAYOFF_LEAD_TIME` ↔ /payoff/i (all four payoff cards).
  - `MARKETING_PERIOD_LENGTH` ↔ /\bMarketing\s{1,3}Period\b/
    (case-sensitive, newline-tolerant — the `72134a6a` committed bytes)
    AND /\bconsecutive\b/i AND /first period of/i — the three-way
    conjunction is what stops the embedded notice-and-cure sub-timer
    sub-quote ("within three (3) business days after delivery of such
    notice" — no "first period of", no "consecutive") from ever
    corroborating as a length claim even when perfectly split. Mismatch on
    any asserted kind → review, typed `ASSERTION_KIND_UNCORROBORATED`
    (renamed per audit m-1 to avoid collision with the separate
    `financing_kind` attribute mismatch reason, `FINANCING_SCOPE_UNCORROBORATED`,
    below — the two are checking different things and a review-queue
    reader sees only the reason string, not this disclaimer).
- **`financing_kind` attribute corroboration:** `DEBT` ↔
  /\bDebt (Financing|Commitment Letter)\b/ (case-sensitive) present AND
  the equity pattern absent; `EQUITY` ↔
  /\b(Preferred )?Equity (Financing|Commitment Letter)\b/ present AND the
  debt pattern absent; `DEBT_AND_EQUITY` ↔ both present (card `edbf5766`
  "the Debt Financing and the Preferred Equity Financing");
  `UNSPECIFIED` ↔ /\bFinancing\b/ present AND both defined-term patterns
  absent (card `7774a568` "the Financing or any Alternate Financing").
  Label/pattern mismatch → review, typed
  `FINANCING_SCOPE_UNCORROBORATED`; out-of-enum → explicit
  `pushOpenWorld`, typed.
- **`obligor_ref` positional gate** (TERMR C-2 device): the quote must
  match /\b(each of )?<obligor_ref>[,]? shall\b/i anchored on the verbatim
  ref — both grounded grammatical forms: "Each of Parent and Merger Sub
  shall use…" (`6b29cdd2`), "the Company shall, and shall cause…"
  (`acb32b23`); also covers "The Parent Entities and the Merger Subs
  shall" (`18003c8e`), "the Company Entities shall" (`edbf5766`). Failure
  → review, typed `OBLIGOR_REF_UNCORROBORATED`. Rationale: every
  cooperation quote names the requesting counterparty too ("reasonably
  requested by Parent"), so the substring gate plus `resolveParty` alone
  would pass a producer that swaps obligor and beneficiary — recording a
  buyer-obligated cooperation covenant, inverting the legal substance.
  The positional gate makes the swap fail: "Parent" in `acb32b23` never
  sits in the `<ref> shall` position.
- **Payoff attribute corroboration:** `day_kind` BUSINESS requires
  /business day/i inside the parser's `matched_text`, CALENDAR requires
  its absence; mismatch → `DAY_KIND_UNCORROBORATED` (the TERMR device
  verbatim). `delivery_stage` DRAFT requires /draft/i inside the FROZEN
  governing-clause `matched_text` window defined in section 2; FINAL
  requires its absence there; mismatch → review, typed
  `DELIVERY_STAGE_UNCORROBORATED`. Under that frozen window, card
  `b3d14b3d`'s only count sits inside the parenthetical "(including
  providing Parent with drafts thereof at least 3 Business Days prior to
  the Closing)" — so the window IS exactly that parenthetical: DRAFT
  labeled → /draft/i present in-window → resolves `'3'`; FINAL labeled →
  /draft/i present in-window → `DELIVERY_STAGE_UNCORROBORATED`, queues.
  Both outcomes are pinned against this same frozen window (test 3). A
  resolved-but-misstaged lead time is the invisible-corruption shape this
  attribute exists to stop.
- **Marketing attribute corroboration:** `day_kind` BUSINESS as above;
  CALENDAR queues unconditionally this slice (zero grounded calendar-day
  marketing periods — section 1). `marketing_term_ref`
  substring-enforced on literal bytes (newline form included).
- **Presence/enum gate provenance:** `FINANCING_OBTAIN_EFFORTS_STANDARD`,
  `FINANCING_COOPERATION_PRESENT` and
  `NO_FINANCING_CONDITION_ACKNOWLEDGMENT` canonical values are
  producer-chosen codes / presence trues checked by
  `canonicalValueAllowed`; every such resolved claim carries
  `buildMechanicalAnswerProvenance({ extraPins: { gate:
  'ALLOWED_VALUES_MEMBERSHIP' } })` — the closing-conditions uniform
  tag-construction story, adopted for the same honesty reason (the tag
  never overstates how the value was produced). The
  `BRING_DOWN_TIER_PROVENANCE_REVISIT_PENDING` auto-pass block does NOT
  extend here — Ben's CLAIM-IDENTITY-APPROVALS-2026-08-01 item 2 approval
  covers `REPRESENTATION_ACCURACY_STANDARD` only, and this spec refuses to
  widen a ruling by imitation (the closing-conditions M2 keying rationale,
  honored from the other side).
- **Efforts-standard corroboration:** `REASONABLE_BEST_EFFORTS` ↔
  /reasonable best efforts/i; `COMMERCIALLY_REASONABLE_EFFORTS` ↔
  /commercially reasonable efforts/i. BOTH present in one quote → review,
  typed `AMBIGUOUS_EFFORTS_STANDARD`, never resolve either — card
  `acb32b23` is the committed two-standard fixture (RBE + CRE in one
  sentence); a narrower sub-quote in which exactly one fires resolves
  (TERMF ambiguity shape). Neither → `EFFORTS_STANDARD_UNCORROBORATED`.
- **Handler order** (SHARE_COUNT/TEMPORAL pattern): kind corroboration
  (full-table) → attribute verbatim checks → positional obligor gate →
  per-kind branch: OBTAIN_EFFORTS resolves the enum code (with standard
  corroboration); COOPERATION_GRANT / NO_FINANCING_CONDITION_ACK resolve
  canonical_value `true`; PAYOFF_LEAD_TIME / MARKETING_PERIOD_LENGTH →
  `financing-day-count-parse.js` then day_kind/delivery_stage/term-ref
  corroboration. Every ABSTAIN routes to review with the parser's typed
  reason; RESOLVED values still pass `canonicalValueAllowed` (a parser bug
  must not bypass the gate).
- **Materiality: NEW tier proposed, FLAGGED FOR BEN.**
  `{ rank: 75, label: 'FINANCING_COVENANTS', concept_key_prefixes:
  ['COV-FINANCING', 'COV-PAYOFF', 'COV-MARKETING'] }` — between
  CLOSING_CONDITIONS (70) and NOTICES_ADMINISTRATIVE (90); the ledger's
  explicit ordering does not name financing covenants, so the tier is a
  Ben call, not an implementer default. Rank 75 collides with nothing in
  the current table (verified ~446–457). The prefix list is EXACT concept
  keys, deliberately — never a bare `COV-` prefix (Grounding correction
  3). Prefix-tier only; no override-map entries, no `materialityFor`
  signature change. **Pre-concept review routing** (TERMF M-3 verbatim):
  review items minted before the kind map runs carry conceptFamily
  `'COV-FINANCING-PENDING'` — a routing token only, never registered,
  never publishable — which startsWith-matches the `COV-FINANCING` prefix
  → rank 75 instead of UNCLASSIFIED 99.
- **Identity:** assertion kind, financing_kind, the efforts-standard code,
  day_kind, delivery_stage, deliverable_term_ref, marketing_term_ref and
  the obligor party all participate in claim identity/closure — card
  `7774a568`'s acknowledgment + obtain claims in one section, card
  `ad2bdb5d`'s resolved DRAFT lead time and its queued FINAL review item
  (audit C-3; FINAL never resolves for this fixture) in one sentence, and
  the §7.12 cooperation + §7.13 equity-obtain and debt-obtain claims of
  deal `0a043659-68fb-4d20-98e6-b926aa758799` (cards
  `edbf5766`/`18003c8e`) all mint distinct, stable, non-deduping claims
  (or, for the queued FINAL item, a distinct non-deduping review item);
  re-run is byte-stable.
- **Receipt:** `financing_day_count_parse_version` and the bumped
  `section_family_classifier_version` (stage-1b anchor included) thread
  into `receiptBody`, alongside the bumped `mapping_table_version` and the
  new `contract_vocabulary_digest`.
- **Additivity re-pin, honest (P1 M-1 verbatim):** with no financing
  input, resolution output must be byte-identical EXCEPT
  `mapping_table_version`, `contract_vocabulary_digest` (under the new
  bundle version), the new parser-version field, and the recomputed
  `resolution_receipt_id`; documented in the PR with a field-level diff.
  Skipping the version bump to keep old pins green is the named
  anti-pattern.

## 5. Lexicon additions (`LEXICAL_FAMILY_LEXICON` version bump; keys MUST
be registered concept keys — table-validation enforces it, which is why all
three concepts land in this SAME slice; every edit is a reviewed diff;
explicit `\b` on every case-sensitive defined-term regex per the TERMR
boundary pin; each entry carries a one-line rationale)

- `COV-FINANCING`: BOUNDED_REGEX /\bDebt Financing\b/,
  /\bDebt Commitment Letter\b/, /\bEquity Commitment Letter\b/,
  /\bEquity Financing\b/ (case-sensitive defined terms — grounded
  `6b29cdd2`, `18003c8e`, `edbf5766`); LITERAL_PHRASE "financing
  cooperation" (`acb32b23` section heading prose and body), "customary
  cooperation" (`acb32b23`), "is not a condition to" (`7774a568`,
  `acb32b23`). **Priced cross-hit noise, pinned like TERMR's Outside-Date
  cost:** /\bDebt Financing\b/ verifiably appears inside IOC-DEBT
  covenants (deal `13211d88` §5.2(x)), Marketing Period definitions
  (`72134a6a`, `d7cdddd0`), and — market drafting — termination-fee
  financing-failure prose. Those hits sit outside COV-FINANCING candidate
  evidence and will raise `LEXICAL_UNMATCHED_SIGNALS` → veto/queue.
  Accepted and recorded: the defined term is the family's strongest veto
  tell; deletion asymmetry applies; the anti-noise test pins one such hit
  as EXPECTED so a future silent deletion breaks a test.
- `COV-PAYOFF`: LITERAL_PHRASE "payoff letter", "payoff letters"
  (`ad2bdb5d`, `862d6f99` — case-insensitive covers the capitalized
  defined-term uses), "payoff deliverables" (`b3d14b3d`, `7bb30c73`).
  Priced cross-hit: the DEF-INDEBTEDNESS card `1aa1b681` DEFINES "Payoff
  Deliverables"/"Payoff Amounts" in the definitions article — an expected
  unmatched-signal hit outside this family's sections; recorded, not
  patterned around.
- `COV-MARKETING`: BOUNDED_REGEX /\bMarketing\s{1,3}Period\b/
  (case-sensitive, bounded-quantifier newline tolerance — grounded in the
  `72134a6a` literal bytes; `\s+` is banned by the net's BOUNDED_REGEX
  rule, `{1,3}` is not), /\bRequired Financial Information\b/
  (`200eee42`), /\bRequired Information\b/ (`72134a6a`, `d7cdddd0`).
  Priced cross-hit: Required-Information terms recur inside cooperation
  covenants and financing sections generally — expected unmatched
  signals, same treatment.

Priced exclusions (deletion-asymmetry doc-comment applies; every miss
costs a missed VETO, never a wrong claim):

- Naked "financing"/"Financing": appears in reps (REP-B-FUNDS), conditions,
  termination articles, IOC covenants, and definitions corpus-wide — zero
  discriminating power, and predictable noise pressures lexicon deletions,
  which widen auto-pass (the net spec's own argument).
- Naked "cooperation"/"cooperate": antitrust-efforts and general-efforts
  sections draft it everywhere; only the financing-adjacent phrases above
  are patterns.
- Naked "marketing": card `acb32b23`'s own cooperation quote contains
  "customarily used in marketing materials for financing" — a grounded
  false-positive generator inside this family's own sections; only the
  defined term covers COV-MARKETING.
- "Indebtedness" (the IOC family's registered lexicon key — cross-family
  ownership, boundary item 5), "payoff amounts" (definition-article term,
  weaker than the two deliverable phrases), "commitment letter" bare
  (the debt/equity-prefixed forms carry the discrimination), "lender",
  "wire transfer" (payment mechanics, the TERMF exclusion verbatim).
- Residual blind spot, named: a financing-cooperation covenant drafted
  without any of "cooperation", the defined financing terms, or the
  acknowledgment stem loses its veto; the v1↔v2 comparator covers that
  shape (25 deals carry v1 COV-FINANCING cards to disagree with).

## 6. Acceptance tests (real-fixture-first; pre-rerun harness per P1 M-5 —
no recorded native runs exist for this family, so every resolver/registry
test drives synthetic compiled candidates pinned to REAL corpus quotes,
byte-verified against committed fixture bytes, clearly labeled as the
pre-rerun harness)

0. **Fixture commit:** section text for cards `6b29cdd2`, `acb32b23`,
   `7774a568`, `18003c8e`, `edbf5766`, `ad2bdb5d`, `b3d14b3d`, `862d6f99`,
   `7bb30c73`, `200eee42`, `72134a6a`, `d7cdddd0`, plus boundary fixtures
   (deal `13211d88` §5.2(x) IOC cross-link; `f9224f32` minimum-cash
   condition; `733b5b4c` REP-B-FUNDS) committed as LITERAL production
   bytes under `tests/fixtures/canonical-v2/financing-covenants-live-run/`
   with provenance headers (deal, card id, retrieval date, provision_type
   AND subtype — recording DEFINITION where true, per the TERMF m-2
   discipline; all cards additionally record the shared
   `m2-00-corpus-backfill` run_id). The `72134a6a` fixture MUST preserve
   the "Marketing\nPeriod" internal newline byte-for-byte; every test
   quote is asserted a contiguous substring of committed bytes.
1. **Parser, table-driven over the coverage map:** "two (2) Business Days"
   → `'2'`; the drafts limb → `'10'`; "3 Business Days" → `'3'`;
   "fifteen (15) consecutive business days" → `'15'` (the
   intervening-modifier allowlist exercised); "15 consecutive Business
   Days" → `'15'`; card `ad2bdb5d`'s full sentence ABSTAINs
   `MULTIPLE_DAY_COUNTS`; its DRAFT sub-quote is hand-enumerated and
   resolves `'10'` (byte-verified as a contiguous substring of the parent
   fixture, overlapping the parent quote on the numeric token — the P1
   anchored-overlap rule); its FINAL span does NOT resolve under either
   framing (audit C-3, priced Known cost) — a span wide enough to include
   both the 2-day count and "Payoff Letters" also re-includes the drafts
   parenthetical (`MULTIPLE_DAY_COUNTS`), a narrower span excludes the
   deliverable term (`DELIVERABLE_TERM_NOT_IN_QUOTE`); both queue-only
   outcomes are pinned, and no test asserts a resolved `'2'`; each FULL
   Marketing Period definition (all
   three cards) ABSTAINs `MULTIPLE_DAY_COUNTS` (15-day + 3-day sub-timer);
   the hand-enumerated "first period of…" limbs resolve `'15'`;
   "one Business Day" → `NON_LITERAL_NUMERAL`; "fifteen (45) days" (synthetic
   contradiction) → `SPELLED_DIGIT_MISMATCH`; a blackout-date-only
   sub-quote ("shall exclude … November 26, 2025 through and including
   November 28, 2025") → `NO_DAY_COUNT` (date exclusion proven on real
   bytes); zero candidates → `NO_DAY_COUNT`; **money-fence test:** a quote
   containing `$50,000,000` (the `f9224f32` boundary bytes) yields no
   candidate and no resolution anywhere in this family — the parser has no
   currency path to exercise, asserted structurally.
2. **Registry:** next version compiles; prior arrays untouched
   byte-for-byte; three concepts + five definitions validate with zero
   validator changes; expected-keys superset-diffs written against sorted
   content, not numerals.
3. **Resolution (pre-rerun harness, synthetic candidates over committed
   bytes):** `6b29cdd2` → COV-FINANCING × OBTAIN_EFFORTS resolving
   `REASONABLE_BEST_EFFORTS`, financing_kind DEBT; `18003c8e` limb-(a)
   quote (the Equity Financing obtain sentence) → EQUITY; `18003c8e`'s
   separate §7.13 debt-obtain limb (the region's own Debt Commitment
   Letter sentence, corrected corpus fact per audit C-1) → a second,
   distinct OBTAIN_EFFORTS assertion resolving financing_kind DEBT — both
   assertions from the same section, non-deduping; `edbf5766` cooperation →
   DEBT_AND_EQUITY; `7774a568` limb (a) →
   NO_FINANCING_CONDITION_ACKNOWLEDGMENT `true` with financing_kind
   UNSPECIFIED, limb (b) → the RBE obtain claim, distinct identities;
   `acb32b23` UNSPLIT quote → `AMBIGUOUS_FINANCING_KIND` review
   (cooperation + acknowledgment patterns both fire), its sub-quotes
   resolve — and the cooperation sub-quote containing both RBE and CRE
   phrases, if asserted as OBTAIN_EFFORTS, → `AMBIGUOUS_EFFORTS_STANDARD`;
   obligor swap regression (TERMR C-2 shape): the `acb32b23` cooperation
   claim with `obligor_ref` set to "Parent" (present verbatim, wrong
   position) → `OBLIGOR_REF_UNCORROBORATED`, never a resolved inverted
   covenant; `b3d14b3d` labeled FINAL → `DELIVERY_STAGE_UNCORROBORATED`
   (the drafts-only count), labeled DRAFT → resolves `'3'`; `862d6f99`
   limb (a) → `DELIVERABLE_TERM_UNIDENTIFIED` (notice limb, no payoff
   term); marketing length asserted on the notice-and-cure sub-timer
   sub-quote → `ASSERTION_KIND_UNCORROBORATED` (no "first period
   of"/"consecutive"); a CALENDAR-labeled marketing claim → queues
   unconditionally; out-of-enum assertion_kind and financing_kind each
   exercise explicit `pushOpenWorld`; materiality rank 75 asserted BOTH on
   a resolved claim AND on a `COV-FINANCING-PENDING` review item; the
   `gate: 'ALLOWED_VALUES_MEMBERSHIP'` provenance pin asserted on every
   resolved presence/enum claim AND the absence of any
   `BRING_DOWN_TIER_PROVENANCE_REVISIT_PENDING` entry asserted (the
   ruling-widening fence); additivity re-pin with documented field-level
   diff.
4. **Boundary pins (each a named regression):** the `13211d88` §5.2(x)
   IOC quote asserted as any financing kind → fails kind corroboration,
   queues or open-worlds, and NO dollar value exists anywhere in the
   output; the `f9224f32` minimum-cash condition quote mints nothing in
   this family and its section title never classifies FINANCING; a
   synthetic fee-payment quote ("Parent shall pay the Company … the
   Parent Termination Fee") asserted as a financing assertion → fails
   every kind pattern → no claim, no fee vocabulary minted (fee machinery
   stays cited, boundary item 1); the REP-B-FUNDS titles that verbatim-
   match `/\bfinancing\b/i` — card `d89441ea` "Section 5.8 Financing.",
   card `dd37da8c` "Section 4.10 Financing.", card `e8833779` "4.10 Debt
   Financing." — do NOT classify FINANCING, because their
   `article_context` is REPRESENTATIONS, not COVENANTS (the C-2 fix); the
   `733b5b4c` REP-B-FUNDS title ("Sufficient Funds") also does not
   title-classify FINANCING, on the regex alone; a heading-inclusive
   quote of card `862d6f99` limb (a) — starting at "5.16 Payoff
   Letters.\n\n(a) At least three (3) Business Days … notice of
   termination…" — is a contiguous, committed-byte, one-count quote
   containing "Payoff Letters" in the quote as a whole, but its
   governing-clause window (the frozen definition, section 2) around the
   3-day count carries no payoff term, so `deliverable_term_ref`
   corroboration fails and the assertion QUEUES rather than publishing
   the loan-termination notice count as a payoff lead time (audit M-2,
   pinned must-queue regression).
5. **Identity:** two same-section claims differing only in assertion_kind,
   financing_kind, or delivery_stage mint distinct stable identities; the
   `ad2bdb5d` resolved-DRAFT / queued-FINAL split never collides or
   dedupes (audit C-3); re-run byte-stable.
6. **Provider + dispatch:** response missing `financing_assertions` →
   empty list, not schema failure; recorded capitalisation fixtures replay
   byte-identically through the registry seam; stage-1 title fixtures
   ("Financing; Financing Cooperation", "Debt Financing", "Payoff
   Letters", "Prepayment of Indebtedness", "Repaid Indebtedness") WITH
   `article_context: 'COVENANTS'` classify FINANCING; the SAME title
   strings ("Financing" per card `d89441ea`/`dd37da8c`, "Debt Financing"
   per card `e8833779`) WITH `article_context: 'REPRESENTATIONS'` do NOT
   dispatch (the C-2 regression — this is the real collision surface, not
   the "Sufficient Funds" fixture, which never hits the regex);
   TERMF/COND/REP-B-FUNDS ("Sufficient Funds") fixture titles do NOT
   classify FINANCING either; validated against all deals' section
   titles; the defined-term anchor: the `72134a6a`
   definitions-section fixture (newline form) dispatches with provenance
   `SECTION_FAMILY_DEFINED_TERM_ANCHORED`, an Indebtedness-definition
   fixture does NOT anchor; unknown family → no prompt, typed record,
   never a capitalisation fallback.
7. **Lexicon:** table validation (keys registered, explicit `\b` on every
   case-sensitive regex, bounded quantifiers only, static max ≤ 128,
   rationale per pattern, content hash re-pinned, version bump);
   anti-noise regression paragraph extended with "customarily used in
   marketing materials for financing" (asserting naked-"marketing"
   patterns do not exist and COV-MARKETING stays silent on it), a
   REP-B-FUNDS sentence, and generic "cooperate with the other party"
   antitrust-efforts prose — asserted zero hits; the `13211d88` Debt
   Financing cross-hit pinned as an EXPECTED COV-FINANCING
   unmatched-signal (the priced cost, deletion-proofed by test); the
   `1aa1b681` "Payoff Deliverables" definition hit pinned as EXPECTED
   under COV-PAYOFF; each surviving pattern hits its own grounding quote
   in committed fixtures.
8. Full suite + `npm run build` + forbidden-patterns (fixtures inside the
   exempt live-run directory class; zero new exemption entries; no
   transition-services vocabulary anywhere in the slice); phase allowlist
   for the slice's files.

## Out of scope

- `COV-DEBT` promotion (heterogeneous population; own follow-on slice with
  its own grounding pass); the swap-cooperation and misfiled-definition
  cards are flagged to ingest-QA as v1 hygiene, never silently absorbed.
- Cooperation fee-reimbursement caps and expense-indemnity amounts (zero
  grounded `$` bytes — query receipt; open world until a corpus receipt
  grounds a typed parser).
- Specific-performance carve-outs and every financing-failure CONSEQUENCE
  (remedies/TERMF territory; receipts and rulings in Cross-family
  boundaries items 1–2).
- Marketing-period commencement triggers, blackout windows,
  complete-by/commence-no-earlier date pairs, notice-and-cure sub-timers,
  and event-based early-completion overrides — each a separate open-world
  candidate feeding the commonality report; the length claim never
  composes them.
- Alternative-financing covenants ("Alternate Financing" obligations),
  lender-arrangement detail, "market flex" mechanics — evidence text only.
- The six DEFINITION-typed COV-FINANCING v1 rows and all 123
  DEF-INDEBTEDNESS cards (definition-graph territory).
- Financing conditions (COND-S-FUNDS + the [PROPOSED] minimum-cash card) —
  closing-conditions family adjudication, boundary item 3.
- FAMILY_MAPPING_TABLE extension for v1↔v2 subtype mapping (separate
  Fable+Ben table edit with the wiring slice).
- Live re-extraction runs (dated handoffs; until they land, NO report may
  claim native financing extraction); any M3 amendment; any
  scope-closure/ABSENT work.

## Known costs, stated up front

- **Every full Marketing Period definition ABSTAINs until the producer
  splits to the length limb** — 600–1300-word single-sentence definitions
  with 3–4 nesting levels are the corpus norm (pack variant warning 4);
  expect 100% initial queue on this concept until prompt iteration lands
  the limb split. Two-strike escalation applies to prompt iteration, never
  to loosening the parser's one-count rule.
- Compound financing sections (efforts + cooperation + acknowledgment in
  one section, sometimes one sentence) make `AMBIGUOUS_FINANCING_KIND`
  review volume material initially — the TERMF multi-trigger cost shape,
  named, never a reason to loosen the full-table check.
- Spelled-only day counts queue (`7bb30c73`'s "one Business Day") — a
  one-second Ben confirmation, priced against the interpretation-creep
  alternative.
- **The `ad2bdb5d` FINAL payoff lead time (2-day count) QUEUES this
  slice** (audit C-3): no contiguous span both isolates the count and
  carries the deliverable term without re-including a second count; only
  its DRAFT sibling (`'10'`) resolves. Priced, same shape as the
  spelled-only cost above — never fixed by widening the deliverable-term
  gate or the one-count rule.
- CALENDAR-kind marketing claims and any calendar-day payoff drafting
  queue until grounded text exists; grounded pattern additions are
  reviewed diffs.
- The Debt-Financing and Required-Information lexicon terms flood
  unmatched signals in IOC, definitions, and fee sections — accepted
  (strongest veto tells; deletion asymmetry; pinned by test 7).
- The defined-term anchor reaches ONLY the Marketing Period; every other
  financing-relevant definition (Payoff Deliverables, Existing
  Indebtedness) stays undispatched by design — under-coverage is typed
  and measurable via the classifier's unknown-family records, never
  silent.
- The three-deal COV-MARKETING population is thin; the 15-business-day
  uniformity is suggestive, not statistical, and no report may present
  the cross-deal marketing statistic as market-representative until the
  live-run handoffs widen coverage.
