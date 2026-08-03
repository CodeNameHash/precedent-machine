# Family — Key defined terms (MAE-adjacent definitional architecture, DEF-*)

**Date:** 2026-08-02. **Status:** AUDIT-AMENDED — adversarial audit applied
(3 CRITICAL, 3 MATERIAL, 5 minor fixes folded 2026-08-03; 0 parked for
Fable). Per program convention (spec-detail → audit → build → review), next
step is build.
**Parent:** `2026-08-02-openworld-promotion-program.md` (five-layer promotion
structure and cross-slice invariants apply verbatim).
**Template:** `2026-08-02-p1-captable-numerics-design.md` (slice shape,
typed-abstain parsers, corroboration tables, coverage-map anchored-overlap +
honesty pins); wave-one folded exemplars
`2026-08-02-family-termination-fee-design.md` /
`2026-08-02-family-termination-rights-design.md` (this spec writes against
the producer-prompt-registry seam the termination-rights spec defines — ALL
new families dispatch through it, never a capitalisation fallback); wave-two
folded exemplars `2026-08-02-family-closing-conditions-design.md`
(subsumption-pair ambiguity device; revisit-pin mechanics),
`2026-08-02-family-consideration-design.md` (family-specific
exclusion-class inversion precedent), `2026-08-02-family-ioc-design.md`
(list-heavy limb splitting), `2026-08-02-family-no-shop-design.md`
(spelled-restatement collapse; percent-exclusion complement — see
Boundaries), `2026-08-02-family-mae-definition-design.md` (the OWNING spec
for the MAE definition — see Boundaries),
`2026-08-02-family-antitrust-regulatory-efforts-design.md` (the OWNING spec
for burdensome-condition defined-term caps — see Boundaries).
**Protocol authority:** docs/codex-program/EXECUTION-LEDGER.md — M3 review
protocol + extraction semantics rules 1–3. This spec may not amend them.
Definitions are quoted-PRESENT claims; a definition a deal lacks is
scope-closure territory, never a producer negative — every "this deal has no
Willful Breach definition"-shaped conclusion is BANNED from this family's
producer and resolver, forever.

## Cross-family boundaries (BINDING; duplication is an automatic audit
CRITICAL, so each boundary below is pinned by an acceptance test in §6)

1. **The MAE definition itself is OWNED by
   `2026-08-02-family-mae-definition-design.md`** (`DEF-MAE`: prongs,
   carve-outs, disproportionate-impact carvebacks, clinical shapes). This
   spec registers NO MAE concept, reproduces NO MAE carve-out taxonomy, and
   its producer emits NOTHING for the MAE definition even though the MAE
   definition sits inside the same definitions article this family's prompt
   reads. Resolver backstop: any assertion in this family whose
   `definition_head_quote` matches the MAE definitional head
   (`/["“][^"”]{0,60}Material Adverse Effect["”]\s+(means|shall mean)/` —
   audit-C3-amended: widened to tolerate the corpus-dominant prefixed form,
   "Company Material Adverse Effect" / "Parent Material Adverse Effect";
   the unprefixed-only regex matched only 9 of 68 `DEF-MAE` cards) routes
   to review, typed `MAE_BOUNDARY_BREACH`, never resolves under any DEF-*
   concept here (test 4). The `NON_MAE_EFFECT` intervening-event exclusion
   code (§1) references the MAE term as USED in an exclusion limb ("does
   not amount to a Material Adverse Effect", card
   `729920e2-8f53-4179-b0f9-4924e1fd58d2`); it is an intervening-event
   limb, not MAE carve-out taxonomy, and this spec never enumerates what an
   MAE definition contains.
2. **Termination-fee machinery is OWNED by
   `2026-08-02-family-termination-fee-design.md`** (`TERMF-*`: fee amounts,
   fee triggers, tail periods, fee_side). The corpus's fee-section
   threshold-substitution drafting ("all references to '15%' in the
   definition of 'Acquisition Transaction' will be deemed to be references
   to '50%'", deal `ce061fd0-a437-4d20-8a84-fdd6296aa5a0` §8.1 TERMF-TARGET
   card; "all references in the definition of Acquisition Proposal to 20%
   shall instead refer to 50%", deal `dc042001-b987-404f-bd02-41e1939fb914`
   §10.1) is used in this slice ONLY as parser-grammar fixture bytes
   (§2) — the pure parser is exercised on them, but NO claim of this family
   is ever minted from a `TERMINATION_FEE`-classified section: the dispatch
   registry keeps fee sections with the termination-fee prompt (test 5),
   and the fee-side substitution shape stays TERMF/open-world territory.
3. **No-shop covenant machinery is OWNED by
   `2026-08-02-family-no-shop-design.md`** (`NOSOL-PROHIBIT/EXCEPT/NOTICE/
   MATCH/REMATCH`: prohibited actions, exception prerequisites, notice and
   match windows). This family takes NO day-count claims: the
   intervening-event NOTICE mechanics ("at least four (4) Business Days" —
   deal `2b9a6571-6fe7-4aac-931d-a96ab227ea43` §4.01, NOSOL-INTERVENING
   host card) and every board-recommendation-change procedure stay outside
   this family (NOSOL-INTERVENING / NOSOL-RECOMMEND have no registered v2
   concept — the no-shop spec deliberately left them out, and its lexicon
   explicitly excluded "Intervening Event" for that reason; this slice now
   registers `DEF-INTERVENING` and keys that tell here, closing the gap the
   no-shop spec named). Complementarity pin: the no-shop parser EXCLUDES
   percent literals as noise (its exclusion class 6, corpus-forced by
   Acquisition Proposal definitions saturating no-shop sections); this
   family is where those percents become claims — from DEFINITION-family
   sections only.
4. **Burdensome-condition defined-term caps are OWNED by
   `2026-08-02-family-antitrust-regulatory-efforts-design.md`**
   (`ANTI-BURDEN`, `burden_term_ref`, the `BURDENSOME_CONDITION` efforts
   cap). v1's `DEF-BURDENSOME` cards (8 cards / 7 deals, including the
   "Substantial Detriment" alias, deal
   `dc042001-b987-404f-bd02-41e1939fb914` §7.1) are NOT modeled here.
5. **MAE-conditioned closing conditions** (`COND-MAE`,
   `NO_MAE_CONDITION_CONTINUING`) are owned by the closing-conditions spec;
   nothing here touches conditions articles.

## Corpus grounding (production Supabase, project `tzulhdasmioeechxapdy`;
evidence pack read 2026-08-02 — pack quotes are ground truth, cited by card
id / deal + section_ref; two supplementary SELECT-only queries run
2026-08-02 by this spec's author, receipts inline below)

v1 `provision_cards`, `provision_type = 'DEFINITION'`, in-scope subtypes:
DEF-ACQPROPOSAL 55 cards / 32 deals, DEF-SUPERIOR 37/25, DEF-KNOWLEDGE
36/32, DEF-WILLFUL 26/26, DEF-INTERVENING 25/17. Adjacent host-family
populations that REFERENCE these terms (owned elsewhere, listed so nobody
reads them as this family's input): TERMR-SUPERIOR 32/31 (termination
rights), NOSOL-SUPERIOR / NOSOL-ACQPROPOSAL / NOSOL-INTERVENING under
`provision_type = 'COVENANT_NO_SOLICITATION'` 14 cards/14 deals, 13/13, and
28 cards/24 deals respectively (audit-M1-amended — the prior 14/13/15
grounding line was internally inconsistent with §5's own 28-card
priced-noise pin) (no-shop), TERMF-* (fees).

**Partition warning, pinned (evidence pack variant warning #1):** the
subtype strings `NOSOL-SUPERIOR` (21 cards / 21 deals), `NOSOL-ACQPROPOSAL`
(20/20) and `NOSOL-INTERVENING` (15/15) ALSO appear under
`provision_type = 'DEFINITION'` — a v1 mistag population where definitional
cards carry NOSOL-prefixed subtypes. Any rollup, comparator or future
FAMILY_MAPPING_TABLE row for this family MUST partition on
`(provision_type, provision_subtype)`, never `provision_subtype` alone;
keying on the subtype string alone silently merges definitional cards with
procedural no-shop cards. The mapping table itself is out of scope (P1
convention — separate Fable+Ben edit), but this partition rule is recorded
here because this family is where the trap lives.

Grounding quotes this spec builds on (verbatim; every corroboration pattern
and lexicon entry below traces to one of these — nothing fabricated):

- **Acquisition Proposal thresholds** — card
  `751d3f42-1db4-4e63-83bc-49d81a65e44f` (deal `86a01770…`, §1.1):
  ""Acquisition Transaction" means any transaction or series of related
  transactions … of securities representing more than 15% of the total
  outstanding equity securities of the Company"; card
  `f68a2431-65e9-4168-801e-66bab8e74162` (deal `13211d88…`, §1.1):
  near-identical 15% form; deal `1e4b7102…` Annex-A (card `fcfc2e0e0254`
  section): ""Acquisition Proposal" means any offer or proposal …
  (a) any acquisition or purchase by any Person or group … of more than
  twenty percent (20%) of any class of outstanding voting or equity
  securities of the Company"; deal `c7c16365…` §1.01 (Kraft):
  ""Takeover Proposal" means any proposal or offer … (i) direct or
  indirect acquisition of 20% or more of the consolidated assets of Kraft
  … or assets comprising 20% or more of the consolidated revenues, net
  income or EBITDA of Kraft" — the pinned MULTI-BASIS COMPOUND.
- **Superior Proposal, restated-absolute threshold** — deal `7dc3a05f…`
  §4.1 (card `5dfec9972981` section): ""Company Superior Proposal" means a
  bona fide, unsolicited written Company Acquisition Proposal (i) that if
  consummated would result in a third party … acquiring, directly or
  indirectly, more than 80% of the outstanding Company Shares or more than
  80% of the assets of the Company and its Subsidiaries, taken as a whole";
  card `9ac6c80c-8437-4463-b883-4bea37bdca05` (deal `cf32899a…`, §10.1,
  author query receipt 2026-08-02): ""Company Superior Proposal" means a
  Company Takeover Proposal (i) that if consummated would result in a third
  party … acquiring, directly or indirectly, more than 50% of the voting
  power of the Company Common Stock or all or substantially all the assets
  of the Company and its Subsidiaries, taken as a whole, for consideration
  consisting of cash and/or securities, (ii) that is reasonably capable of
  being completed, taking into account".
- **Superior Proposal, substitution form** — deal `667447f0…` §9.14 (card
  `ac7fde09a184` section): ""Superior Proposal" means any bona fide written
  Acquisition Proposal (with all references to "twenty percent (20%)"
  included in the definition of Acquisition Proposal deemed to be
  references to "fifty percent (50%)")"; card
  `74eafcf0-eaa2-4034-a4c6-e14c3e3a0ba5` (deal `4f015417…`, §4.01, author
  query receipt 2026-08-02): ""Superior Proposal" means any unsolicited,
  bona fide Takeover Proposal (with the percentages set forth in the
  definition thereof changed from 15% to 50%) made in writing after the
  date of this Agreement that the Board of Directors of the Company
  determines in good faith is reasonably likely to be consummated and that
  is on terms which the Board of Directors of the Company determines in
  good faith, if consummated, would result in a transaction more favorable
  to the stockholders of the Company from a financial point of view than
  the Merger, taking into account all financial, legal, regulatory,
  financing, certainty and timing of consummation and other aspects" —
  grounds BOTH qualifier codes and the changed-from substitution grammar.
- **Superior Proposal, all-or-substantially-all (unpromoted shape)** —
  cards `f4784467-babb-4b06-93f4-5c9fcfe37fd1` and
  `48d2c1fa-7af4-4cb6-a8f3-1b665915ebe6` (deal `a267309a…`, Annex-A, author
  query receipt 2026-08-02): two-sided "Company Superior Proposal" /
  "Parent Superior Proposal" definitions keyed to "businesses or assets …
  that account for all or substantially all of the fair market value" —
  zero percent literals; stays open world this slice (Known costs).
- **Intervening Event** — card `729920e2-8f53-4179-b0f9-4924e1fd58d2`
  (deal `a267309a…`, Annex-A): ""Parent Intervening Event" means a material
  development or change in circumstance that occurs or arises after the
  date of this Agreement that was not known to or reasonably foreseeable by
  the Parent Board as of the date of this Agreement (or, if known or
  reasonably foreseeable, the magnitude or material consequences of which
  were not known or reasonably foreseeable …); provided, however, that in
  no event shall (i) the receipt, existence or terms of an actual or
  possible Parent Competing Proposal or Parent Superior Proposal, (ii) any
  Effect relating to the Company or any of its Subsidiaries that does not
  amount to a Material Adverse Effect, individually or in the aggregate,
  (iii) any change, in and of itself, in the price or trading volume of
  shares of Parent Common Stock or\nCompany Common Stock" (audit-m1-amended:
  production bytes line-wrap between "or" and "Company Common Stock";
  quoted here with the wrap preserved rather than silently normalized —
  the committed fixture text carries the literal wrap, not this prose);
  mirror card
  `447a31b8-19f1-431b-bd35-0ee545d1eee2` (same deal, "Company Intervening
  Event" — the two-sided merger-of-equals shape); card
  `d1ab2254-3ec0-4dcf-853d-a94cd095bc74` (deal `df393645…`, DEF section):
  ""Columbus Intervening Event" means any material event, change, effect,
  development or occurrence occurring or arising after the date of this
  Agreement that (i) was not known or reasonably foreseeable … and
  (ii) does not relate to or involve a Columbus Acquisition Proposal".
- **Knowledge** — card `1c6f3c9d-117d-4fb1-a399-53f8aff7f88b` (deal
  `c34415ed…`, Exhibit-A): ""knowledge," with respect to an Entity, means
  with respect to the matter in question the actual knowledge of Gregory
  Oakes, Fabio Cataldi, David Pereira, Dawn Louro, and Rebecca Mosig, Fred
  Callori, solely with respect to Section 3.12 (Intellectual Property), in
  each case, after reasonable inquiry of their direct reports reasonably
  expected to have knowledge of such matters" (card bleeds into adjacent
  "LABP-66"/"Law" definitions — pack warning #2); card
  `37647fd3-ff6a-4b8e-824c-f4428c729bcd` (deal `0d38cc1f…`, §9.5):
  ""knowledge" (i) with respect to the Company means the actual knowledge
  of any of the individuals listed in Section 9.5(a) of the Company
  Disclosure Letter … and (ii) with respect to Parent or Merger Sub means
  the actual knowledge of any of the individuals listed in Section 9.5(a)
  of the Parent Disclosure Letter" — the DUAL-PARTY compound; card
  `f7ff2b2c-578c-4c1b-aaeb-9249baceb34a` (deal `b57d0d65…`, Exhibit-A):
  ""knowledge" means, with respect to the Company …, the actual knowledge
  of the Persons set forth on Schedule A of the Company Disclosure Letter,
  and, with respect to Parent, any executive officer of Parent" — the
  MIXED-SOURCE compound (schedule pointer + title class in one sentence).
- **Willful Breach** — deal `eee4f270…` §1.1 (card `bedc21e67d1a`
  section): ""Willful Breach" shall mean a material breach of this
  Agreement that is the consequence of an act or omission by the breaching
  party with the actual knowledge that the taking of such act or failure to
  take such action could reasonably cause or constitute a material breach";
  deal `6369cc9c…` §1.1 (card `3550bfdcb3b1` section): ""Willful Breach"
  means an intentional and willful breach … that is the consequence of a
  deliberate action or omission (including a failure to cure circumstances)
  by a Party with the Knowledge that the taking of, or failure to take,
  such act would, or would reasonably be expected to, result in a breach";
  deal `ce061fd0…` DEF section (card `c114d48a3565` section): ""Willful and
  Material Breach" means … a material breach that is a consequence of an
  act or failure to act undertaken or omitted to be taken by the breaching
  Party with the actual or constructive knowledge (which shall be deemed to
  include knowledge of facts that a Person acting reasonably should have
  known, based on reasonable due inquiry)" — the term-name VARIANT
  population (pack warning #4: "Willful Breach" / "Willful and Material
  Breach" / "Willfully and Materially Breach," / line-wrapped "Willful and
  Material\nBreach" all map to DEF-WILLFUL); card
  `df078b03-2bcb-4194-88c3-47bf26c8e2b6` (deal `555579a6…`): quote runs
  500+ chars past the definition into a 60-row Term/Section index table —
  the pinned CONTAMINATION fixture (pack warning #6).
- **Quote-span drift, corroborated by author query (2026-08-02):** card
  `069b58c5-0f9f-4956-8a11-522fcf1f1f55` (deal `1f80bec7…`,
  DEF-ACQPROPOSAL-tagged, full text is the adjacent "Acceptable
  Confidentiality Agreement" definition) and card
  `c389fc29-2de5-40b5-b0c4-a75121eb653a` (same deal, DEF-SUPERIOR-tagged,
  full text is the SRO/Subject Courts/Subsidiary definitions run) — v1
  labels are UNTRUSTED input to this design; every corroboration table
  below exists because the corpus itself demonstrates label↔text drift
  inside this family.

**Companion-table state (pack warning #10):** `definition_components` has a
full schema (`component_kind`, `component_label`, `verbatim_quote`,
`source_span_*`) and ZERO rows corpus-wide. This slice neither reads nor
writes it; its disposition (drop vs. adopt) is a Ben data-hygiene call,
flagged in Out of scope. Same for `termination_fee_triggers` (0 rows —
TERMF family's problem, named there).

**rubric.js state:** CODES entries exist for all five subtypes
(`lib/rubric.js` ~1890–1938, audit-m2-amended anchor — was ~1765–1820) but
NO per-code FEATURES arrays — they resolve to the generic `DEF:` fallback
(~3814, audit-m2-amended — was ~3645), which mixes MAE-specific fields
with `knowledgeStandard`/`superiorProposalPercentage`/
`acquisitionProposalPercentage` in one block; a second, differently-named
field set for the same three fiduciary concepts lives in the NOSOL FEATURES
block (~3112, audit-m2-amended — was ~2860–3010). Neither is adopted as v2 vocabulary; both corroborate
the dual-provision_type tagging above. `lib/taxonomy.js`
`KNOWLEDGE_STANDARD_META` (`ACTUAL`, `CONSTRUCTIVE`, `AFTER_INQUIRY`, `NA`)
is the source vocabulary for the knowledge-standard enum — minus `NA`,
which is a producer-asserted negative and is BANNED under M3 rule 1 (a deal
whose knowledge definition fits no code goes to open world, never to "NA").

## Deliverable (honest conversion semantics)

Governed, resolvable claims for the five cross-cutting defined-term
concepts the family brief names: (a) Acquisition Proposal ownership/asset
thresholds; (b) Superior Proposal thresholds — restated-absolute AND
substitution-form — plus the financial/certainty qualifiers; (c) the
Intervening Event definition and its exclusion limbs; (d) Knowledge
constructions (standard + person-source); (e) Willful Breach definitions
and their knowledge standard.

**No recorded native runs exist for this family.** No open-world fixture
rows to convert, no closure_ids to track. The deliverable is the five-layer
capability plus a pre-rerun harness: a COVERAGE MAP over committed
corpus-quote fixtures (the cards named above, committed as LITERAL
production bytes with provenance headers: deal, provision_card id where the
pack or a query receipt supplies one, section_ref, retrieval date, subtype
— including the mistagged/drift cards labeled as such, the TERMF m-2
discipline), each hand-enumerated with its expected outcome. The P1 audit
M-5 honesty pins apply verbatim: "the pipeline natively extracts key
defined terms" may be claimed only after dated post-merge live-run handoffs
(subscription CLI); until then the honest claim is "the machinery exists
and is proven on committed fixtures".

**Fixture placement is load-bearing:** all committed fixture text lives
under `tests/fixtures/canonical-v2/defined-terms-live-run/` so the
forbidden-patterns PROSE_CLASS_FINGERPRINTS exemption
(`scripts/lint/forbidden-patterns.sh`, `RECORDED_LIVE_RUN_DIR`) applies by
construction. No other new file in this slice may contain fingerprint
strings; this spec's own prose lives under `docs/` (outside the lint walk)
and deliberately does not quote the burdensome-condition drafting it
declines to own.

## 1. Registry (`contract-bundle.js` → next frozen version at this slice's
merge; superset-diff tests written against sorted CONTENT, never the
numeral — the closing-conditions correction #5 convention)

Strictly additive spread of the current head version. **New concepts —
five, ALL FLAGGED FOR BEN in the PR body** (concept-key additions are
taxonomy decisions; this spec proposes, Ben settles — the 2026-07-23
convention). v1 subtype keys reused verbatim so the future
FAMILY_MAPPING_TABLE rows are rename-free (the DEF-MAE precedent):

- `DEF-ACQPROPOSAL` — the Acquisition Proposal / Takeover Proposal /
  Acquisition Transaction definitional threshold architecture. 55/32.
- `DEF-SUPERIOR` — the Superior Proposal definition: thresholds
  (restated or substituted) and board-determination qualifiers. 37/25.
- `DEF-INTERVENING` — the Intervening Event definition: knowability test
  plus exclusion limbs. 25/17 (plus the 15-deal DEFINITION-typed
  NOSOL-INTERVENING mistag population, partitioned per the warning above).
- `DEF-KNOWLEDGE` — the "knowledge" construction: standard + person
  source. 36/32.
- `DEF-WILLFUL` — Willful Breach and its term-name variants. 26/26.

NOT added: `DEF-ORDINARY` (12/10 — structurally split between an
interpretive-construction clause and a standalone defined term, pack
warning #3; not in the family brief's scope list; deferred with its own
grounding pass), `DEF-BURDENSOME` (owned by ANTI-BURDEN — Boundaries item
4), every other `DEF-*` subtype (DEF-GENERAL 2702-card long tail through
DEF-BUSINESSDAY — including the pure-cross-reference Business Day shape,
pack warning #9, which has nothing quote-local to extract), and any
NOSOL-prefixed key (no-shop family vocabulary, never minted here).

**Claim definitions** (ten; each is either a mechanical percent value, a
registry-hosted enum, or a presence claim):

```
ACQUISITION_PROPOSAL_THRESHOLD_PERCENT_CLAIM_DEFINITION_V1
  claim_definition_key: 'ACQUISITION_PROPOSAL_THRESHOLD_PERCENT'
  version: 1
  canonical_value_type: 'NON_NEGATIVE_DECIMAL_STRING'   // existing type
  canonical_value_required_when_present: true            // '15', '20'

SUPERIOR_PROPOSAL_THRESHOLD_PERCENT_CLAIM_DEFINITION_V1
  claim_definition_key: 'SUPERIOR_PROPOSAL_THRESHOLD_PERCENT'
  version: 1
  canonical_value_type: 'NON_NEGATIVE_DECIMAL_STRING'    // '50', '80'
  canonical_value_required_when_present: true

DEFINED_TERM_THRESHOLD_SUBSTITUTION_CLAIM_DEFINITION_V1
  claim_definition_key: 'DEFINED_TERM_THRESHOLD_SUBSTITUTION'
  version: 1
  canonical_value_type: 'NON_NEGATIVE_DECIMAL_STRING'    // the TO percent
  canonical_value_required_when_present: true

SUPERIOR_PROPOSAL_QUALIFIER_CLAIM_DEFINITION_V1
  claim_definition_key: 'SUPERIOR_PROPOSAL_QUALIFIER'
  version: 1
  allowed_canonical_values: ['FINANCIAL_FAVORABILITY',
                             'CONSUMMATION_LIKELIHOOD']
  canonical_value_required_when_present: true

INTERVENING_EVENT_DEFINITION_CLAIM_DEFINITION_V1
  claim_definition_key: 'INTERVENING_EVENT_DEFINITION'
  version: 1
  allowed_canonical_values: [true]          // presence claim, the
  canonical_value_required_when_present: true  // KNOWLEDGE_QUALIFIER shape

INTERVENING_EVENT_EXCLUSION_CLAIM_DEFINITION_V1
  claim_definition_key: 'INTERVENING_EVENT_EXCLUSION'
  version: 1
  allowed_canonical_values: ['ACQUISITION_PROPOSAL_RECEIPT',
                             'STOCK_PRICE_CHANGE',
                             'NON_MAE_EFFECT']
  canonical_value_required_when_present: true

KNOWLEDGE_STANDARD_CLAIM_DEFINITION_V1
  claim_definition_key: 'KNOWLEDGE_STANDARD'
  version: 1
  allowed_canonical_values: ['ACTUAL', 'AFTER_INQUIRY', 'CONSTRUCTIVE']
  canonical_value_required_when_present: true

KNOWLEDGE_PERSON_SOURCE_CLAIM_DEFINITION_V1
  claim_definition_key: 'KNOWLEDGE_PERSON_SOURCE'
  version: 1
  allowed_canonical_values: ['NAMED_INDIVIDUALS', 'SCHEDULE_REFERENCE',
                             'TITLE_CLASS']
  canonical_value_required_when_present: true

WILLFUL_BREACH_DEFINITION_CLAIM_DEFINITION_V1
  claim_definition_key: 'WILLFUL_BREACH_DEFINITION'
  version: 1
  allowed_canonical_values: [true]
  canonical_value_required_when_present: true

WILLFUL_BREACH_KNOWLEDGE_STANDARD_CLAIM_DEFINITION_V1
  claim_definition_key: 'WILLFUL_BREACH_KNOWLEDGE_STANDARD'
  version: 1
  allowed_canonical_values: ['ACTUAL', 'ACTUAL_OR_CONSTRUCTIVE']
  canonical_value_required_when_present: true
```

No new canonical value types; no validator changes. New concepts and
definitions grow the expected-keys rows as sorted supersets (prior rows
byte-untouched). Named seam to verify at build time (MAE-spec convention):
`EXPECTED_PROPOSAL_BOUNDARY` and `KNOWN_VERSION_SHAPES` — if either
enumerates proposal kinds/generic keys, adding this family's is a
validator-constant change called out in the PR; the fixture-shape validator
is never loosened.

**Enum decisions, pinned as legal rulings:**

- **The knowledge enum drops v1's `NA` and keeps `CONSTRUCTIVE` despite
  zero grounded standalone bytes.** `NA` is a producer-asserted negative —
  banned, M3 rule 1. `CONSTRUCTIVE` is registered because
  `KNOWLEDGE_STANDARD_META` already carries it as reviewed v1 vocabulary
  and because banning it would force rule-3 nearest-fit the day a
  constructive-knowledge definition appears — but the ONLY corpus
  constructive-knowledge bytes sit inside a Willful Breach definition
  (`ce061fd0`), not a standalone knowledge definition, so `CONSTRUCTIVE`
  has NO corroboration pattern this slice and queues unconditionally,
  typed `KNOWLEDGE_STANDARD_UNCORROBORATED` (the TERMR
  NO_SOLICITATION_BREACH precedent verbatim). Zero auto-published
  constructive-knowledge claims until grounded standalone text exists and
  a pattern lands by reviewed diff.
- **`DEFINED_TERM_THRESHOLD_SUBSTITUTION` never becomes an "effective
  Superior Proposal threshold".** The canonical value is the TO percent
  (`'50'`), with the FROM percent and the substituted term as governed
  attributes. Deriving "this deal's Superior Proposal threshold is 50%"
  requires APPLYING the substitution rule to a separately-defined term —
  that is cross-reference resolution (relationship machinery), not
  quote-local production, exactly like TERMF's section-cite triggers. A
  consumer wanting the effective threshold joins the substitution claim to
  the Acquisition Proposal threshold claim downstream; the producer and
  resolver never pre-compute it, and no report may present a substitution
  claim as a restated threshold (pack warning #5 is this family's primary
  corruption trap: the substitution operands LOOK like thresholds to any
  naive percent reader).
- **The all-or-substantially-all Superior Proposal shape is NOT
  promoted.** Cards `f4784467`/`48d2c1fa` draft the acquisition test as
  "all or substantially all of the fair market value" — no percent
  literal (audit-M2-amended: `9ac6c80c` was wrongly listed here — it
  contains "more than 50% of the voting power of the Company Common
  Stock", has exactly one percent literal, and RESOLVES `'50'`; it is the
  spec's own grounding for `CONSUMMATION_LIKELIHOOD` and the
  voting-power `EQUITY_SECURITIES` basis, not an unpromoted zero-percent
  card). Forcing the zero-percent pair into a percent definition would be
  rule-3 forcing; it stays open world, feeding the commonality report.
  Priced.
- **Comparator direction is evidence, not a value.** "more than 15%" vs
  "20% or more" is a real legal difference at the boundary; it travels in
  the quoted evidence for Ben's read, never as a parsed field this slice
  (a direction enum without a full corpus sweep of the boundary drafting
  would be a plausible-but-wrong vocabulary).
- **Named persons are never mapped to title codes.** v1's
  `KNOWLEDGE_PERSON_META` (CEO/CFO/…) requires outside knowledge to map
  "Gregory Oakes" to a title; the v2 claim carries the verbatim
  `named_persons` list only. Cross-deal person/title canonicalization is a
  Ben adjudication over observed values later (the share_class_ref
  precedent verbatim).

**Governed attributes (never in keys; all participate in claim
identity/closure so same-section claims never collide or dedupe —
essential here: merger-of-equals deals carry MIRRORED definitions,
`729920e2` + `447a31b8`):**

- `ACQUISITION_PROPOSAL_THRESHOLD_PERCENT`: `proposal_term_ref` — the
  verbatim defined term being defined ("Acquisition Transaction",
  "Acquisition Proposal", "Takeover Proposal", "Company Acquisition
  Proposal"), REQUIRED, verbatim substring of the `definition_head_quote`
  (P1 M-3 discipline, audit-C1-amended: gated against the definition-head
  span, never the limb span — see §3 two-span shape), failure → review
  typed `PROPOSAL_TERM_NOT_IN_QUOTE`; `threshold_basis` — enum
  `EQUITY_SECURITIES | ASSETS | REVENUE_OR_EARNINGS`, corroborated against
  `limb_quote` (§4). Identity-bearing both: Kraft's one definition mints
  separate asset-basis and revenue-basis claims, each sharing one
  `definition_head_quote` and carrying its own `limb_quote`.
- `SUPERIOR_PROPOSAL_THRESHOLD_PERCENT`: `superior_term_ref` (verbatim,
  required, gated against `definition_head_quote`,
  `SUPERIOR_TERM_NOT_IN_QUOTE` on failure); `threshold_basis` (same enum,
  corroborated against `limb_quote`).
- `DEFINED_TERM_THRESHOLD_SUBSTITUTION`: `substitution_from_percent` —
  decimal string, REQUIRED, parser-emitted (never producer-asserted alone —
  §2); `substituted_term_ref` — the verbatim term whose definition is
  being re-percented ("Acquisition Proposal", "Acquisition Transaction"),
  required, substring-enforced, `SUBSTITUTED_TERM_NOT_IN_QUOTE` on
  failure; `host_term_ref` — the verbatim term whose definition HOSTS the
  substitution ("Superior Proposal"), required, substring-enforced.
- `SUPERIOR_PROPOSAL_QUALIFIER`: `superior_term_ref` as above.
- `INTERVENING_EVENT_DEFINITION` / `INTERVENING_EVENT_EXCLUSION`:
  `event_term_ref` — verbatim ("Parent Intervening Event", "Company
  Intervening Event", "Columbus Intervening Event", "Intervening Event"),
  required, substring-enforced against `definition_head_quote`,
  `EVENT_TERM_NOT_IN_QUOTE` on failure. Identity-bearing: the two-sided
  `a267309a` definitions mint distinct, non-deduping claims via the term
  ref. No cross-deal normalization of the prefixed spellings this slice.
- `KNOWLEDGE_STANDARD` / `KNOWLEDGE_PERSON_SOURCE`: `knowledge_term_ref`
  (verbatim — "knowledge", "Knowledge"; required, substring-enforced
  against `definition_head_quote`); `knowledge_party` — OPTIONAL enum
  `TARGET | BUYER`, supplied only when the definition is party-limbed
  ("(i) with respect to the Company … (ii) with respect to Parent",
  `37647fd3`); when supplied it is positionally corroborated against
  `limb_quote` (§4), when absent the claim resolves party-undimensioned
  (the single-construction norm, `1c6f3c9d`). `KNOWLEDGE_PERSON_SOURCE`
  additionally: `named_persons` — REQUIRED when the value is
  `NAMED_INDIVIDUALS`: a non-empty list of verbatim name phrases, EACH a
  verbatim substring of `limb_quote` (or `definition_head_quote` when the
  two spans are identical); any failure → review, typed
  `NAMED_PERSON_NOT_IN_QUOTE`. This substring gate IS the corroboration
  for the named-list shape — person names are an open class no frozen
  pattern can corroborate.
- `WILLFUL_BREACH_DEFINITION` / `WILLFUL_BREACH_KNOWLEDGE_STANDARD`:
  `breach_term_ref` — verbatim defined term, required, substring-enforced
  against `definition_head_quote`, `BREACH_TERM_NOT_IN_QUOTE` on failure.
  This gate is the pack-warning-#4 defense: the four observed term
  variants (including the line-wrapped "Willful and Material\nBreach")
  all pass because the check runs against LITERAL committed bytes, and no
  pattern anywhere in this slice anchors on the exact string "Willful
  Breach".
- No party tuple is minted anywhere in this family this slice
  (`party_field: null`, `party_role: null` on the resolution-table row,
  with the termination-rights build-time check that nothing reads them
  before the handler runs): a definition's "party" is the term's subject,
  not a contract actor with a quote of its own — the TERMF payee ruling
  verbatim. `knowledge_party` is a governed attribute, not a resolved
  party.

## 2. Value parser: `defined-term-threshold-parse.js`

New pure module, `measurement-date-parse.js` contract shape: typed
`{outcome:'RESOLVED', canonical_value, matched_text, …}` or
`{outcome:'ABSTAIN', reason}` — never a throw on prose, never arithmetic,
never repair. `DEFINED_TERM_THRESHOLD_PARSE_VERSION` threaded into the
resolution receipt (P1 M-6). The enum/presence definitions need no parser
— their gates are allowed-values membership + corroboration (the MAE-spec
"no parse module for enum families" ruling, adopted for those kinds); the
two percent definitions and the substitution definition get these two
exported functions:

**`parsePercentThreshold(quote)`** — the family-specific exclusion-class
INVERSION, third of its kind (P1 excluded currency and counted bare
numerals; consideration counted currency; no-shop EXCLUDED percents as
noise): this parser counts ONLY percent literals and ignores everything
else.

- Candidate token: a digit run (optional single decimal point)
  immediately followed by `%` — the no-shop percent grammar, reused as the
  INCLUSION rule. Spelled-restatement collapse (the no-shop tokenization
  precedent, verbatim semantics): "twenty percent (20%)" is ONE candidate
  — the parenthesized digit form; the word sequence is recognized as a
  restatement, never read as a number, never arithmetic-validated against
  the digits ("five percent (3%)" yields `3` and the drafting mismatch
  surfaces to Ben in the quote itself).
- Inherited exclusions (P1 tokenizer discipline, matched on LITERAL
  committed bytes): section references (LTR-mark-tolerant), calendar
  dates, currency-prefixed literals, clock times. Bare non-percent
  numerals are simply not candidates — "Section 13(d)", "Rule 14d-1(g)"
  and limb numbering never contaminate the count.
- **Substitution-grammar veto, checked FIRST (the family-distinctive
  rule; pack warning #5):** if the quote matches ANY of the three
  substitution grammars below, ABSTAIN `SUBSTITUTION_GRAMMAR_PRESENT` —
  the percents in a substitution construction are substitution OPERANDS,
  not thresholds, and resolving one of them as an absolute threshold is
  this family's flagship corruption path. The producer must route such
  quotes to a `THRESHOLD_SUBSTITUTION` assertion instead; an
  absolute-threshold assertion over substitution text queues, never
  resolves.
- Exactly one surviving percent literal → RESOLVED; canonical form: strip
  `%`, preserve any decimal as-written (`'15'`, `'20'`, `'80'`); must
  round-trip `canonicalValueAllowed`'s `NON_NEGATIVE_DECIMAL_STRING`
  regex.
- Two or more survivors → ABSTAIN `MULTIPLE_PERCENT_LITERALS` (the Kraft
  multi-basis compound and the equity-or-assets pair in `7dc3a05f` are
  the NORM; the producer splits per basis limb, each sub-quote a
  contiguous substring of the parent — the parser never picks).
- Zero survivors → ABSTAIN `NO_PERCENT_LITERAL` (the
  all-or-substantially-all shape, and pure cross-reference definitions).
- Word-only percents ("twenty percent" with no parenthesized digit) →
  ABSTAIN `NON_LITERAL_PERCENT`.

**`parseThresholdSubstitution(quote)`** — recognizes exactly the three
corpus-grounded substitution grammars; anything else abstains:

1. DEEMED form: `references to ["“]?<FROM>["”]? … deemed to be references
   to ["“]?<TO>["”]?` — grounded: "with all references to "twenty percent
   (20%)" included in the definition of Acquisition Proposal deemed to be
   references to "fifty percent (50%)"" (deal `667447f0` §9.14).
2. INSTEAD form: `references … to <FROM> shall instead refer to <TO>` —
   grounded: deal `dc042001` §10.1 (TERMF card bytes; parser-grammar
   fixture ONLY, per Boundaries item 2; the ce061fd0 "will be deemed to be
   references to" fee variant likewise exercises grammar 1 at
   parser-level only).
3. CHANGED-FROM form: `changed from <FROM> to <TO>` — grounded: "with the
   percentages set forth in the definition thereof changed from 15% to
   50%" (card `74eafcf0`).

- FROM and TO must each be a single percent literal (spelled-restatement
  collapse applies inside the quoted operands). RESOLVED yields
  `canonical_value = <TO>` and `substitution_from_percent = <FROM>`, both
  as decimal strings — the resolver copies the parser's FROM into the
  governed attribute and rejects any producer-asserted FROM that differs
  (mismatch → review, typed `SUBSTITUTION_OPERAND_MISMATCH`).
- No grammar match → ABSTAIN `NO_SUBSTITUTION_GRAMMAR`.
- More than one grammar instance, or any surviving percent literal
  OUTSIDE the matched FROM/TO pair → ABSTAIN
  `MULTIPLE_SUBSTITUTION_PAIRS` / `EXTRA_PERCENT_LITERALS` respectively —
  the parser never picks (a Superior Proposal definition that both
  substitutes AND restates is two claims; the producer splits).
- Word-only operands → ABSTAIN `NON_LITERAL_PERCENT`.
- The parser NEVER applies a substitution, never subtracts, never
  computes an effective threshold — the §1 ruling, enforced by the module
  having no code path that reads a second definition.

## 3. Producer prompt + provider

- **New prompt module**
  `lib/canonical-v2/native-producer/defined-terms-producer-prompt.js`. No
  existing prompt module is edited; every existing PROMPT_VERSION stays
  put; recorded fixtures replay byte-identically. New
  `PROMPT_ID 'native-producer-defined-terms/v1'`, `PROMPT_VERSION 1`,
  bumped once per slice, never mid-slice.
- **Dispatch through `producer-prompt-registry.js`** — the seam the
  termination-rights spec defines (its §3); this spec writes against it
  and does not re-design it: one frozen entry added,
  `DEFINED_TERMS → buildDefinedTermsProducerPrompt`. Unknown family → no
  prompt, no candidates, typed record — never a silent capitalisation
  fallback. Build-order note (audit-m4-amended: `producer-prompt-registry.js`
  already exists at HEAD — capitalisation-only, fail-closed, exactly as
  the termination-rights spec describes — so the "whichever family slice
  merges first builds the seam" contingency in that spec's text is moot;
  this slice only adds an entry to the existing registry); the
  capitalisation byte-identical-replay test guards all orderings.
- **Section-family classifier extension:** stage-1 title rules ported
  from and tested against v1 `lib/parser-v2/classify.js` — the exact-title
  rule `/^definitions?\s*$/i` (~200–201) and the broad `/definition/i`
  title rule (~400, which also catches "Superior Proposal Definition" /
  "Acquisition Proposal Definition" titled sections, the observed
  `667447f0` §9.14 / `7dc3a05f` §4.1 shape). Stage-2 AI-assisted
  classification per the Ben-ruled two-stage design (provenance
  `SECTION_FAMILY_AI_CLASSIFIED`, `SECTION_FAMILY_AI_UNVERIFIED` blocking
  auto-pass, travels on every downstream artifact — termination-rights §3
  verbatim). Known coverage hole, priced: definitional annex/exhibit
  bodies whose titles carry no "definition" token ("Annex A", "Exhibit A"
  — the corpus norm for this family, pack warning #7) reach stage 2 or
  classify UNKNOWN → typed record, no prompt; the live-run handoffs
  measure the miss rate. Stage 1 is validated against ALL deals' section
  titles before dispatch (repo classify-rules convention) — including the
  negative assertions that termination-fee titles and no-shop covenant
  titles do NOT classify DEFINED_TERMS (Boundaries items 2–3).
- **Coexistence with the MAE prompt's section scope, pinned:** the MAE
  family enters definitions sections via its own section-scope mechanism
  (MAE spec §3). A definitions article may therefore be visited by BOTH
  the MAE prompt and this prompt. This is deliberately NOT fenced the way
  closing-conditions fenced capitalisation overlap: that fence existed
  because two paths would mint COLLIDING claims of the same definition;
  here the two prompts' claim vocabularies are disjoint by construction
  (no shared claim definition, no shared concept). The enforcement
  backstop is content-level: this prompt instructs "the Material Adverse
  Effect definition is owned by another producer — emit no assertion and
  no open-world candidate for it", and the resolver's
  `MAE_BOUNDARY_BREACH` gate (Boundaries item 1) catches any leak.
- **Two-span assertion shape (audit C1 fix — required because split limbs
  cannot, by construction, contain both their own basis/exclusion text AND
  the term-ref/"means" language of the definition head; see the Kraft and
  `729920e2` failure scenarios the audit traced):** every split assertion
  carries TWO quote spans, both contiguous substrings of the section text —
  `definition_head_quote` (the defining sentence's head: the quoted defined
  term through "means"/"shall mean", e.g. Kraft's ""Takeover Proposal"
  means any proposal or offer …") and `limb_quote` (the specific
  basis/party/exclusion clause this assertion is about, e.g. Kraft's
  "20% or more of the consolidated revenues, net income or EBITDA of
  Kraft" clause). For a non-split assertion (one legal fact, one
  self-contained span) the two spans MAY be identical. Term-ref REQUIRED
  gates (§1: `proposal_term_ref`, `superior_term_ref`, `event_term_ref`,
  etc.) and the full-table kind-corroboration patterns (§4) run against
  `definition_head_quote`; value parsers (`parsePercentThreshold`,
  `parseThresholdSubstitution`) and the `threshold_basis`/exclusion-code/
  standard-code corroboration patterns (§4) run against `limb_quote`.
  Claim identity (§4) carries both spans.
- **Response shape:** a `defined_term_assertions` array — each element
  `{ section_reference, assertion_kind: 'ACQ_THRESHOLD' |
  'SUPERIOR_THRESHOLD' | 'THRESHOLD_SUBSTITUTION' | 'SUPERIOR_QUALIFIER' |
  'INTERVENING_DEFINITION' | 'INTERVENING_EXCLUSION' |
  'KNOWLEDGE_STANDARD' | 'KNOWLEDGE_PERSON_SOURCE' | 'WILLFUL_DEFINITION' |
  'WILLFUL_STANDARD', definition_head_quote, limb_quote }` plus per-kind
  fields: the term refs of §1; `threshold_basis` (threshold kinds);
  `qualifier_code` / `exclusion_code` / `standard_code` / `source_code`
  (enum kinds); `knowledge_party` (optional); `named_persons`
  (NAMED_INDIVIDUALS only).
  One element per legal fact, with the split rules pinned IN the prompt
  because this family's drafting is compound as the norm:
  - one assertion per threshold BASIS limb (Kraft: assets and
    revenue/EBITDA are two claims, each carrying the SAME
    `definition_head_quote` and its own `limb_quote`);
  - one assertion per PARTY limb of a dual-party knowledge definition
    (`37647fd3`: Company and Parent limbs are separate assertions, each
    with its own `limb_quote` and the shared `definition_head_quote`);
  - one assertion per exclusion LIMB of an Intervening Event proviso
    (`729920e2`: limbs (i)–(iii) are three exclusion assertions, each
    with its own `limb_quote` and the shared `definition_head_quote`);
  - `definition_head_quote` is ALWAYS the single definition's head span —
    never the alphabetically adjacent definition, never the Term/Section
    index table (pack warnings #2 and #6; the drift cards
    `069b58c5`/`c389fc29` are quoted in the prompt's negative examples);
  - substitution constructions go to `THRESHOLD_SUBSTITUTION`, never to a
    threshold kind (the parser's `SUBSTITUTION_GRAMMAR_PRESENT` veto is
    the backstop, not the plan).
  PRESERVE-THE-NOVEL retained verbatim; when unsure of any enum, term ref
  or kind, keep the assertion in `open_world_candidates`. The producer
  never asserts a negative (M3 rule 1): no "definition absent", no "NA"
  knowledge standard, no "no intervening-event exclusion" — quoted
  positives or open world, nothing else.
- **Provider (`anthropic-provider.js`):** ONE new generic key,
  `NATIVE_DEFINED_TERM_CANDIDATE`, proposal_kind `DEFINED_TERM`
  (≠ OPEN_WORLD). `defined_term_assertions` is NOT added to
  `REQUIRED_RESPONSE_LISTS` (share_count precedent verbatim: recorded
  responses predate the key; missing/non-array reads as empty list, never
  a schema failure). Quote byte-verification identical to existing
  proposals.
- Golden evals: recorded responses are never hand-edited into the new
  shape; the first defined-terms recordings are minted by the first live
  runs, each its own dated handoff.

## 4. Resolver wiring (`candidate-resolution.js`)

- **ONE new `RESOLUTION_UNCONDITIONAL` entry** (P1 M-2: the Map is keyed
  on generic_claim_key alone): `NATIVE_DEFINED_TERM_CANDIDATE`,
  `deterministic_kind: null`, `attachment_position: null`,
  `registered_claim_definition_key: null`, `concept_key: null` (explicit,
  with the build-time check that nothing reads `mapping.concept_key`
  before the handler's kind map runs), `party_field: null`,
  `party_role: null` (§1 party ruling). `MAPPING_TABLE_VERSION` bumped;
  table-validation still asserts no duplicate generic keys.
- **Handler order — concept assignment FIRST, and therefore NO pending
  routing token in this family (a deliberate divergence from
  TERMF-PENDING/COND-PENDING, pinned with its reason):** the frozen
  assertion_kind → (concept × claim definition) map is total and
  attribute-independent —
  `ACQ_THRESHOLD → DEF-ACQPROPOSAL × ACQUISITION_PROPOSAL_THRESHOLD_PERCENT`;
  `SUPERIOR_THRESHOLD → DEF-SUPERIOR × SUPERIOR_PROPOSAL_THRESHOLD_PERCENT`;
  `THRESHOLD_SUBSTITUTION → DEF-SUPERIOR × DEFINED_TERM_THRESHOLD_SUBSTITUTION`;
  `SUPERIOR_QUALIFIER → DEF-SUPERIOR × SUPERIOR_PROPOSAL_QUALIFIER`;
  `INTERVENING_DEFINITION → DEF-INTERVENING × INTERVENING_EVENT_DEFINITION`;
  `INTERVENING_EXCLUSION → DEF-INTERVENING × INTERVENING_EVENT_EXCLUSION`;
  `KNOWLEDGE_STANDARD → DEF-KNOWLEDGE × KNOWLEDGE_STANDARD`;
  `KNOWLEDGE_PERSON_SOURCE → DEF-KNOWLEDGE × KNOWLEDGE_PERSON_SOURCE`;
  `WILLFUL_DEFINITION → DEF-WILLFUL × WILLFUL_BREACH_DEFINITION`;
  `WILLFUL_STANDARD → DEF-WILLFUL × WILLFUL_BREACH_KNOWLEDGE_STANDARD`.
  Unlike TERMF (where fee_side corroboration had to precede the concept
  split) nothing here gates the concept, so the handler assigns the
  concept BEFORE any corroboration/gate — every review item this family
  mints carries a real registered concept key and prefix-matches its real
  materiality tier. Out-of-enum assertion_kind → explicit `pushOpenWorld`,
  typed reason (P1 C-4: the main loop's open-world routing keys on
  proposal_kind and will not catch it).
- **MAE boundary gate, run before everything else** (Boundaries item 1):
  `definition_head_quote` matches the (widened, audit-C3-amended) MAE
  definitional head → review, typed `MAE_BOUNDARY_BREACH`, never
  resolved, never open-worlded silently.
- **Full-table kind ambiguity rule (the TERMF C-3 device — required here
  because definitional prose is compound as the norm):** the handler runs
  ALL kinds' corroboration patterns (below) over `definition_head_quote`.
  Patterns for ≥2 distinct, non-subsumed kinds matching → review, typed
  `AMBIGUOUS_DEFINED_TERM_KIND` — UNLESS the assertion quotes a narrower
  contiguous sub-quote in which exactly one kind's patterns match (P1
  overlap rule). FOUR subsumption pairs are pinned this slice
  (audit-C2-amended: the byte-identical patterns below make same-concept
  sibling kinds indistinguishable at the pattern level by construction, so
  each pair is pinned subsumed rather than left to collide with the rule
  as drafted; the closing-conditions MAE_CONTINUING device, extended):
  - `INTERVENING_DEFINITION` / `INTERVENING_EXCLUSION`: `
    INTERVENING_DEFINITION`'s knowability pattern legitimately co-occurs
    with every `INTERVENING_EXCLUSION` pattern inside a full-definition
    quote — when an INTERVENING_EXCLUSION assertion quotes its own
    proviso limb, the knowability pattern is absent from the sub-quote and
    no ambiguity arises; an UNSPLIT full-definition quote asserted as
    either kind queues.
  - `KNOWLEDGE_STANDARD` / `KNOWLEDGE_PERSON_SOURCE`: byte-identical
    pattern (/\bknowledge\b/i AND /\bmeans\b/i) — both are legitimate
    co-readings of the same knowledge-definition sentence (one asserts the
    standard, the other the person source); the discriminator is the
    asserted claim definition itself (which code table — standard codes
    vs. person-source codes — corroborates the assertion's own
    `standard_code`/`source_code`), never the kind pattern. A single
    knowledge sentence legitimately mints one `KNOWLEDGE_STANDARD` claim
    and one `KNOWLEDGE_PERSON_SOURCE` claim; the kind pattern match alone
    never queues either.
  - `WILLFUL_DEFINITION` / `WILLFUL_STANDARD`: byte-identical pattern
    (/\bWillful/ AND /\bbreach\b/i) — same subsumption as the knowledge
    pair, same reason: one Willful Breach sentence legitimately mints one
    `WILLFUL_DEFINITION` claim (the presence claim) and one
    `WILLFUL_STANDARD` claim (the knowledge-standard code), discriminated
    by their own code corroboration, not by the kind pattern.
  - `ACQ_THRESHOLD` / `SUPERIOR_THRESHOLD`: both match on /\bmeans\b/i
    plus a surviving percent literal; the discriminator is the
    `superior_term_ref` clause (`SUPERIOR_THRESHOLD` additionally requires
    `superior_term_ref` to match /Superior Proposal/, below) — treated as
    the term-ref gate, not the kind pattern, so this pair is pinned
    subsumed on the SAME `definition_head_quote` rather than routed to
    `AMBIGUOUS_DEFINED_TERM_KIND` whenever both patterns happen to match;
    a genuinely ambiguous case (kind pattern matches both AND the
    term-ref clause fails to discriminate — neither or both term refs
    present) still queues, typed `DEFINED_TERM_KIND_UNCORROBORATED`.
  No other subsumption exceptions exist beyond these four pairs.
- **Corroboration tables (frozen resolver constants; label must match
  quote text — corroboration is a VETO on the proposed label, never a
  classifier; every pattern grounded in a committed fixture quote,
  word-bounded, case as shown; audit-C1-amended: "Kind patterns" below run
  against `definition_head_quote`, never `limb_quote` — a split limb is
  never expected to carry its own "means"/defined-term language):**
  - Kind patterns (matched against `definition_head_quote`):
    `ACQ_THRESHOLD` / `SUPERIOR_THRESHOLD` ↔ /\bmeans\b/i AND a surviving
    percent literal found ANYWHERE across the definition's limb set per
    §2's tokenizer (i.e. the per-limb `parsePercentThreshold` call on
    `limb_quote` RESOLVED at least once; `751d3f42`, `7dc3a05f`);
    additionally `SUPERIOR_THRESHOLD` requires the `superior_term_ref` to
    match /Superior Proposal/ (case-sensitive; `9ac6c80c` "Company
    Superior Proposal") — a Superior threshold asserted on an Acquisition
    Proposal definition queues, typed `DEFINED_TERM_KIND_UNCORROBORATED`.
    `THRESHOLD_SUBSTITUTION` ↔ the parser's grammar match IS the
    corroboration (no separate pattern — `NO_SUBSTITUTION_GRAMMAR`
    already vetoes). `SUPERIOR_QUALIFIER` ↔ the asserted code's own
    pattern below (matched against `limb_quote`). `INTERVENING_DEFINITION`
    ↔ /not known( to)? or (not )?reasonably foreseeable/i (covers both
    corpus forms: "was not known to or reasonably foreseeable by"
    `729920e2`; "was not known or reasonably foreseeable" `d1ab2254`).
    `INTERVENING_EXCLUSION` ↔ the asserted code's own pattern below
    (matched against `limb_quote`). `KNOWLEDGE_STANDARD` /
    `KNOWLEDGE_PERSON_SOURCE` ↔ /\bknowledge\b/i AND /\bmeans\b/i.
    `WILLFUL_DEFINITION` / `WILLFUL_STANDARD` ↔ /\bWillful/
    (case-sensitive stem — the four term-name variants all carry it; a
    lowercase-"willful" definition is a recorded blind spot) AND
    /\bbreach\b/i.
  - `threshold_basis` (matched against `limb_quote`): `EQUITY_SECURITIES`
    ↔ /outstanding (voting or )?equity securities|class of outstanding
    voting|voting power|outstanding Company Shares/i (`751d3f42`,
    `fcfc2e0e` section, `9ac6c80c`, `7dc3a05f`); `ASSETS` ↔
    /consolidated assets|of the assets of the Company/i (Kraft §1.01;
    `7dc3a05f`); `REVENUE_OR_EARNINGS` ↔ /revenues, net income or
    EBITDA/i (Kraft §1.01). Asserted-basis mismatch → review typed
    `THRESHOLD_BASIS_UNCORROBORATED`; ≥2 basis patterns matching
    `limb_quote` → review typed `AMBIGUOUS_THRESHOLD_BASIS` unless the
    producer's `limb_quote` already isolates one — the Kraft compound
    (each basis its own `limb_quote` sharing one `definition_head_quote`)
    is the pinned regression fixture.
  - `SUPERIOR_PROPOSAL_QUALIFIER` codes: `FINANCIAL_FAVORABILITY` ↔
    /more favorable .{0,120}from a financial point of view/i
    (`74eafcf0`); `CONSUMMATION_LIKELIHOOD` ↔
    /reasonably (likely to be consummated|capable of being (completed|
    consummated))/i (`74eafcf0`, `9ac6c80c`). Both matching one quote is
    the corpus NORM (`74eafcf0` carries both) — two assertions, each
    quoting its own clause; an unsplit quote asserted as one code with
    both patterns matching → `AMBIGUOUS_QUALIFIER_CODE` review.
  - `INTERVENING_EVENT_EXCLUSION` codes (matched against `limb_quote`;
    audit-M3-amended, the second alternative anchored to a proposal
    token): `ACQUISITION_PROPOSAL_RECEIPT` ↔
    /receipt, existence or terms of an? (actual or possible )?/i OR
    /does not relate to or involve a[^.;]{0,60}(Acquisition|Takeover|
    Competing) Proposal/i (`729920e2` limb (i), `d1ab2254` limb (ii));
    `STOCK_PRICE_CHANGE` ↔
    /change, in and of itself, in the (market )?price or trading volume/i
    (`729920e2` limb (iii)); `NON_MAE_EFFECT` ↔
    /does not amount to a \bMaterial Adverse Effect\b/ (case-sensitive
    defined term; `729920e2` limb (ii)). Out-of-enum exclusion codes →
    explicit `pushOpenWorld`, typed `EXCLUSION_CODE_OUT_OF_VOCABULARY`
    (an Intervening Event proviso excluding, say, analyst-estimate
    changes is real market drafting with no grounded bytes here — open
    world, never nearest-fit).
  - `KNOWLEDGE_STANDARD` codes: `ACTUAL` ↔ /actual knowledge/i;
    `AFTER_INQUIRY` ↔ /(after |due |reasonable )inquiry/i — with the
    pinned subsumption rule: the corpus AFTER_INQUIRY drafting CONTAINS
    "actual knowledge" ("the actual knowledge of [names] … after
    reasonable inquiry", `1c6f3c9d`), so when BOTH patterns match, the
    asserted code must be `AFTER_INQUIRY` (corroborates); an `ACTUAL`
    label on an inquiry-bearing quote → review, typed
    `KNOWLEDGE_STANDARD_UNDERSTATED` — an understated knowledge standard
    silently corrupts the cross-deal knowledge-standard statistic, which
    is this concept's product. `CONSTRUCTIVE` ↔ NO pattern; queues
    unconditionally (§1 ruling).
  - `KNOWLEDGE_PERSON_SOURCE` codes: `SCHEDULE_REFERENCE` ↔
    /listed in Section .{0,60}Disclosure Letter|set forth on Schedule/i
    (`37647fd3`, `f7ff2b2c`); `TITLE_CLASS` ↔ /executive officer/i
    (`f7ff2b2c`); `NAMED_INDIVIDUALS` ↔ the `named_persons` substring
    gate (§1) AND NEITHER other pattern matching the (sub-)quote — the
    mixed-source `f7ff2b2c` sentence (schedule for Company + executive
    officers for Parent) asserted unsplit under any single code →
    review, typed `AMBIGUOUS_PERSON_SOURCE`; split per party limb, each
    resolves.
  - `knowledge_party` positional gate (when supplied; matched against
    `limb_quote`): `TARGET` ↔ /with respect to the Company/i; `BUYER` ↔
    /with respect to (the )?Parent( or Merger Sub)?/i (`37647fd3` both
    limbs). Both matching one `limb_quote` → the producer failed to split
    → review, typed `AMBIGUOUS_KNOWLEDGE_PARTY`. A supplied party whose
    pattern is absent → `KNOWLEDGE_PARTY_UNCORROBORATED`.
  - `WILLFUL_BREACH_KNOWLEDGE_STANDARD` codes: `ACTUAL` ↔
    /actual knowledge|with the Knowledge/ (case-sensitive second limb —
    the `3550bfdcb3b1` capitalized defined-term usage);
    `ACTUAL_OR_CONSTRUCTIVE` ↔ /actual or constructive knowledge/i
    (`c114d48a3565`). The two phrase families cannot co-occur as one
    contiguous phrase; if a long quote contains both separately →
    `AMBIGUOUS_DEFINED_TERM_KIND`-style review typed
    `AMBIGUOUS_WILLFUL_STANDARD`.
- **Gate order per claim:** MAE boundary gate (run against
  `definition_head_quote`) → kind corroboration (full-table, against
  `definition_head_quote`) → term-ref verbatim gates (against
  `definition_head_quote`) → per-kind branch, run against `limb_quote`:
  threshold kinds → `parsePercentThreshold`; substitution → 
  `parseThresholdSubstitution` (+ operand-mismatch check); enum kinds →
  allowed-values membership (`canonicalValueAllowed`) + the code's
  corroboration pattern; presence kinds → canonical `true` + the kind
  pattern. Every ABSTAIN routes to review with the parser's typed reason;
  RESOLVED values still pass `canonicalValueAllowed` (a parser bug must
  not bypass the gate); every out-of-enum code → explicit `pushOpenWorld`,
  typed. Every enum/presence claim carries
  `buildMechanicalAnswerProvenance({ extraPins: { gate:
  'ALLOWED_VALUES_MEMBERSHIP' } })` — the closing-conditions
  one-tag-construction-story-per-family convention; NO
  revisit-pending entry is added (Ben's CLAIM-IDENTITY item-2 approval
  covers bring-down tiers only; this family neither inherits that block
  nor needs one invented — flagged so the auditor sees the decision was
  made, not missed).
- **Materiality — NO new tier; three existing-tier prefix wirings, ALL
  FLAGGED FOR BEN in the PR body** (tier membership is a legal-materiality
  call; this spec proposes, Ben settles — the MAE spec's rank-30 wiring
  precedent):
  - `DEF-ACQPROPOSAL`, `DEF-SUPERIOR`, `DEF-INTERVENING` → rank 40
    `FIDUCIARY` (its `concept_key_prefixes` is empty today,
    `candidate-resolution.js` ~450; these three ARE the fiduciary-out
    definitional architecture the ledger's "fiduciary provisions" tier
    names). Full-key prefixes, so no collision with the MAE tier's
    `DEF-MAE` prefix at rank 30.
  - `DEF-KNOWLEDGE` → rank 55 `REPRESENTATIONS` prefix addition (the
    knowledge construction modulates every knowledge-qualified rep).
  - `DEF-WILLFUL` → rank 20 `FEES` prefix addition — proposed reading:
    the willful-breach definition's operative bite is the
    fee-as-sole-remedy carve-out and post-termination damages cap
    (TERMF-SOLE/TERMF-EFFECT territory). The alternative reading (rank
    10 `TERMINATION_RIGHTS`, as effect-of-termination machinery) is
    named for Ben to settle; the acceptance test pins whichever rank Ben
    initials in the PR.
  A test pins all three wirings so a refactor cannot silently drop them.
  No pending token exists in this family (handler-order ruling above), so
  no token-routing pin is needed.
- **Receipt + additivity (honest form, P1 M-1):**
  `defined_term_threshold_parse_version` threads into `receiptBody`
  alongside the bumped `mapping_table_version` and the new bundle
  version's `contract_vocabulary_digest`. With no defined-term input,
  resolution output must be byte-identical EXCEPT those fields and the
  recomputed `resolution_receipt_id`; field-level diff documented in the
  PR. Skipping the version bump to keep old pins green is the named
  anti-pattern.
- **Identity:** assertion kind, all term refs (`proposal_term_ref`,
  `superior_term_ref`, `substituted_term_ref`, `host_term_ref`,
  `event_term_ref`, `knowledge_term_ref`, `breach_term_ref`),
  `threshold_basis`, every enum code, `knowledge_party`,
  `substitution_from_percent`, and `limb_quote` (audit-C1-amended: the
  limb span, not just the enum/attribute values derived from it,
  participates in identity — this is what keeps Kraft's two basis limbs
  and `729920e2`'s three exclusion limbs from colliding even before their
  parsed attributes are compared) participate in claim identity/closure —
  the two-sided `a267309a` Intervening Events, Kraft's two basis limbs,
  and a dual-party knowledge definition each mint distinct, stable,
  non-deduping claims; re-run is byte-stable.

## 5. Lexicon additions (`LEXICAL_FAMILY_LEXICON` version bump; keys MUST
be registered concept keys — which is why all five concepts land in this
same slice; every edit a reviewed diff; explicit `\b` on every
case-sensitive defined-term regex per the TERMR boundary pin; every
pattern grounded in a quoted corpus card above; content hash re-pinned)

- `DEF-ACQPROPOSAL`: BOUNDED_REGEX /\bAcquisition Transaction\b/
  (case-sensitive; `751d3f42`), /\bTakeover Proposal\b/ (case-sensitive;
  Kraft §1.01 — deliberate cross-family DUPLICATE of NOSOL-PROHIBIT's
  entry, the TERMF duplication-as-safety ruling: veto-only design makes a
  duplicate a second net, never a wrong claim); LITERAL_PHRASE "of the
  total outstanding equity securities" (`751d3f42`), "of any class of
  outstanding voting or equity securities" (`fcfc2e0e` section).
- `DEF-SUPERIOR`: BOUNDED_REGEX /\bSuperior Proposal\b/ (case-sensitive —
  deliberate duplicate of TERMR-SUPERIOR's and NOSOL-EXCEPT's entries,
  same ruling); LITERAL_PHRASE "deemed to be references to" (`667447f0`
  §9.14 — the substitution construction, the family's most discriminating
  tell), "from a financial point of view" (`74eafcf0`), "reasonably
  capable of being completed" (`9ac6c80c`).
- `DEF-INTERVENING`: BOUNDED_REGEX /\bIntervening Event\b/
  (case-sensitive; `729920e2`, `d1ab2254` — "Columbus Intervening Event"
  contains it). This closes the coverage gap the no-shop spec explicitly
  priced when it excluded the phrase (its lexicon exclusions named
  "Intervening Event" as a real tell of a then-unregistered concept).
  LITERAL_PHRASE "not known to or reasonably foreseeable" (`729920e2`) and
  "not known or reasonably foreseeable" (`d1ab2254`) — two entries per the
  multi-form rule, never a `/`.
- `DEF-KNOWLEDGE`: LITERAL_PHRASE "actual knowledge" (`1c6f3c9d`,
  `37647fd3`, `f7ff2b2c`; ALSO keyed under DEF-WILLFUL — see below),
  "after reasonable inquiry" (`1c6f3c9d`).
- `DEF-WILLFUL`: BOUNDED_REGEX /\bWillful(ly)?\b/ (case-sensitive — the
  pack-warning-#4 defense: the single capitalized stem fires on "Willful
  Breach", "Willful and Material Breach", "Willfully and Materially
  Breach," AND the line-wrapped "Willful and Material\nBreach", because
  the token precedes every wrap point; a multi-word literal would miss
  half the corpus); LITERAL_PHRASE "deliberate action or omission"
  (`3550bfdcb3b1` section), "actual knowledge" (duplicate under this key —
  in a willful-breach section with no DEF-WILLFUL candidate, the phrase
  vetoes a careless ABSENT here even when DEF-KNOWLEDGE has its own
  candidate elsewhere; veto-only, pure safety).

**Priced cross-hit noise, pinned like TERMR's Outside-Date cost:**
`\bIntervening Event\b` verifiably saturates no-shop
recommendation-change/notice sections (the NOSOL-INTERVENING host
population, 28 cards) — those hits sit outside DEF-INTERVENING candidate
evidence and will raise `LEXICAL_UNMATCHED_SIGNALS` → queue. Same for
`\bSuperior Proposal\b` and `\bTakeover Proposal\b` corpus-wide, and for
every pattern against the Term/Section INDEX TABLES that Article-1
sections carry (pack warning #6: a 60-row index contains "Superior
Proposal", "Willful Breach", … as bare rows). Same again for the
`DEF-KNOWLEDGE`/`DEF-WILLFUL` "actual knowledge" LITERAL_PHRASE
(audit-m5-added): 55 cards / 35 deals corpus-wide, of which 21 sit outside
DEF-KNOWLEDGE and DEF-WILLFUL sections entirely — veto-only, same
accepted-cost shape. Accepted, recorded costs — these are the family's
strongest veto tells; deletion asymmetry applies; the anti-noise test pins
one index-table hit as EXPECTED so a future silent deletion breaks a
test.

**Priced exclusions (deletion-asymmetry doc-comment applies; every miss
costs a missed VETO, never a wrong claim):** naked "knowledge"/"Knowledge"
(saturates every knowledge-qualified rep corpus-wide — "to the Knowledge
of the Company" chapeau prose; only the standard/inquiry phrases are
patterns); naked "means" / "shall mean" (every definition in Article 1);
"Disclosure Letter", "Schedule" (ubiquitous); "bona fide" (the no-shop
spec measured it in 84 NOSOL cards — zero discriminating power here too);
naked percent tokens ("15%", "20%" — not word-boundable, and saturated
across fee/no-shop text); lowercase "willful" (fires on "willful
misconduct" indemnification prose; the capital-W stem covers the defined
terms — a deal drafting the definition entirely in lowercase loses a
veto, recorded blind spot).

## 6. Acceptance tests (real-fixture-first; the pre-rerun harness honesty
pins from P1 audit M-5 apply VERBATIM — no recorded native runs exist, so
every resolver/registry test drives synthetic compiled candidates pinned
to REAL corpus quotes, byte-verified against committed fixture text,
clearly labeled as the pre-rerun harness)

0. **Fixture commit:** definition-section text for the named cards —
   `751d3f42`, `f68a2431`, Kraft §1.01, `fcfc2e0e` section, `7dc3a05f`
   §4.1, `9ac6c80c`, `667447f0` §9.14, `74eafcf0`, `f4784467`, `48d2c1fa`,
   `729920e2`, `447a31b8`, `d1ab2254`, `1c6f3c9d`, `37647fd3`, `f7ff2b2c`,
   the four Willful cards (incl. the line-wrapped-variant bytes and the
   `df078b03` index-table contamination card), the two drift cards
   (`069b58c5`, `c389fc29`, labeled MISTAGGED in their headers), and the
   two TERMF substitution cards (`ce061fd0` §8.1 span, `dc042001` §10.1
   span — headers labeled PARSER-GRAMMAR-ONLY, TERMF-owned) — committed as
   LITERAL production bytes under
   `tests/fixtures/canonical-v2/defined-terms-live-run/` with provenance
   headers (deal, card id where known, section_ref, subtype incl.
   mistags, retrieval date). Every test quote asserted a contiguous
   substring of committed bytes; typographic quotes and line-wraps never
   retyped.
1. **Parser, table-driven over the coverage map:**
   `parsePercentThreshold` — `751d3f42` limb → `'15'`; `fcfc2e0e` limb →
   `'20'` (spelled-restatement collapse on "twenty percent (20%)");
   `7dc3a05f` full quote (80%/80% pair) → `MULTIPLE_PERCENT_LITERALS`,
   each hand-enumerated basis sub-quote → `'80'`; Kraft full quote →
   `MULTIPLE_PERCENT_LITERALS`, each basis sub-quote → `'20'`;
   `f4784467` (all-or-substantially-all) → `NO_PERCENT_LITERAL`;
   `667447f0`/`74eafcf0` quotes → `SUBSTITUTION_GRAMMAR_PRESENT` (the
   warning-#5 defense, asserted on real bytes); word-only percent →
   `NON_LITERAL_PERCENT`; section-ref/date/currency immunity on real
   quotes ("Section 13(d) of the Exchange Act" inside `751d3f42`).
   `parseThresholdSubstitution` — `667447f0` (deemed form) →
   `{'50', from '20'}`; `74eafcf0` (changed-from form) →
   `{'50', from '15'}`; `dc042001` TERMF bytes (instead form) →
   `{'50', from '20'}` (grammar fixture only); `ce061fd0` TERMF bytes →
   `{'50', from '15'}`; a threshold-only quote →
   `NO_SUBSTITUTION_GRAMMAR`; a hand-built two-substitution span from
   committed bytes → `MULTIPLE_SUBSTITUTION_PAIRS`; a substitution quote
   with an extra restated percent → `EXTRA_PERCENT_LITERALS`.
2. **Registry:** next version compiles; prior arrays untouched
   byte-for-byte; five concepts + ten definitions validate with zero
   validator changes; expected-keys superset-diffs written against sorted
   content, not numerals.
3. **Resolution (pre-rerun harness):** each fixture assertion resolves
   end-to-end onto the right concept × definition per the frozen kind
   map; every corroboration veto exercised with its typed reason:
   `DEFINED_TERM_KIND_UNCORROBORATED` (a SUPERIOR_THRESHOLD label on
   `751d3f42`), `THRESHOLD_BASIS_UNCORROBORATED` +
   `AMBIGUOUS_THRESHOLD_BASIS` (Kraft), `SUBSTITUTION_OPERAND_MISMATCH`
   (producer FROM ≠ parser FROM), `AMBIGUOUS_QUALIFIER_CODE` (`74eafcf0`
   unsplit; its two hand-enumerated clause sub-quotes resolve one
   qualifier each), `EXCLUSION_CODE_OUT_OF_VOCABULARY` via explicit
   `pushOpenWorld`, `KNOWLEDGE_STANDARD_UNDERSTATED` (ACTUAL label on
   `1c6f3c9d`'s inquiry-bearing quote; AFTER_INQUIRY label resolves),
   `KNOWLEDGE_STANDARD_UNCORROBORATED` (CONSTRUCTIVE queues
   unconditionally), `AMBIGUOUS_PERSON_SOURCE` (`f7ff2b2c` unsplit; its
   per-party sub-quotes resolve SCHEDULE_REFERENCE and TITLE_CLASS),
   `NAMED_PERSON_NOT_IN_QUOTE`, `AMBIGUOUS_KNOWLEDGE_PARTY` (`37647fd3`
   unsplit; split limbs resolve TARGET and BUYER),
   `KNOWLEDGE_PARTY_UNCORROBORATED`, `AMBIGUOUS_WILLFUL_STANDARD`, every
   `*_TERM_NOT_IN_QUOTE` gate, every parser ABSTAIN routing to review
   with its typed reason; `729920e2` resolves ONE
   INTERVENING_EVENT_DEFINITION (whose `limb_quote` equals its
   `definition_head_quote`, the knowability sentence) plus THREE
   INTERVENING_EVENT_EXCLUSION claims — each pairing the SAME
   `definition_head_quote` (the "Parent Intervening Event" means …
   sentence, carrying `event_term_ref`) with its OWN hand-enumerated limb
   sub-quote as `limb_quote` (audit-C1-amended two-span shape: this is
   what lets each exclusion claim pass `EVENT_TERM_NOT_IN_QUOTE` even
   though none of limbs (i)–(iii) individually contain "Parent
   Intervening Event") — and the unsplit full quote asserted as a single
   exclusion (`limb_quote` = the whole proviso, matching ≥2 exclusion
   code patterns) queues, typed `AMBIGUOUS_DEFINED_TERM_KIND`-adjacent
   per the exclusion-code corroboration table; likewise Kraft's two basis
   claims each pair the SAME `definition_head_quote` ("Takeover
   Proposal" means … sentence, carrying `proposal_term_ref`) with its own
   basis `limb_quote`, letting both pass `PROPOSAL_TERM_NOT_IN_QUOTE`
   while `parsePercentThreshold` and `threshold_basis` corroboration run
   on the (single-percent) `limb_quote` alone, never re-triggering
   `MULTIPLE_PERCENT_LITERALS`; the `c114d48a3565`
   Willful card resolves WILLFUL_BREACH_DEFINITION +
   ACTUAL_OR_CONSTRUCTIVE standard as two claims; materiality ranks
   asserted per the Ben-settled wiring (40/40/40/55/20 as proposed) on
   resolved claims AND on review items (which carry real concept keys —
   the no-pending-token ruling proven by test); additivity re-pin with
   documented field-level diff; `answer_provenance.gate ===
   'ALLOWED_VALUES_MEMBERSHIP'` on every enum/presence claim.
4. **Boundary pins (each named finding is an audit CRITICAL if it
   fails):** (a) TWO committed-fixture `definition_head_quote` variants,
   both required to pass (audit-C3-amended — the unprefixed-only fixture
   alone under-tests the corpus norm): a synthetic assertion quoting a
   committed unprefixed MAE definitional head ("Material Adverse Effect"
   means …) AND a second synthetic assertion quoting a committed PREFIXED
   MAE definitional head ("Company Material Adverse Effect" means … /
   "Parent Material Adverse Effect" means …, the corpus-dominant form) —
   each under every assertion_kind → `MAE_BOUNDARY_BREACH` review, never
   resolved — and a grep-level test asserts this spec's built modules
   contain NO MAE carve-out code tokens (no `PANDEMIC`, no carve-out enum
   from the MAE spec's vocabulary); (b) no claim of this family is minted
   from the
   TERMF fixture spans at the dispatch level — the classifier test
   routes fee-titled sections to the termination-fee family, and the
   TERMF-owned fixture headers are asserted PARSER-GRAMMAR-ONLY; (c) no
   day-count/notice-period claim exists anywhere in this family's
   vocabulary (a static test over the registry additions asserts no
   `*_DAYS` definition key was added — the no-shop boundary).
5. **Provider + dispatch:** response missing `defined_term_assertions` →
   empty list, not schema failure; recorded capitalisation fixtures
   replay byte-identically through the registry seam; section-family
   classifier: "Definitions" / "Certain Definitions" / "Superior Proposal
   Definition" titles classify DEFINED_TERMS; termination-fee, no-shop
   covenant and conditions titles do NOT; bare "Annex A" titles reach
   stage 2 or classify UNKNOWN with a typed record; validated against all
   deals' section titles; MAE-scope coexistence: a definitions section in
   both scopes dispatches BOTH prompts without a
   `SECTION_CLAIMED_BY_*` fence (the disjoint-vocabulary pin, asserted so
   a future refactor doesn't cargo-cult the closing-conditions fence
   here).
6. **Identity:** `729920e2` vs `447a31b8` (Parent vs Company Intervening
   Event) mint distinct stable identities via `event_term_ref`; Kraft's
   two basis claims never collide; a dual-party knowledge definition's
   TARGET and BUYER claims never dedupe; substitution and
   restated-threshold claims in one deal never collide; re-run
   byte-stable.
7. **Lexicon:** table validation (keys registered — which requires the
   five concepts to be in the same slice; explicit `\b` on case-sensitive
   regexes; static max ≤ 128; rationale per pattern; content hash
   re-pinned; version bump); anti-noise regression paragraph extended
   with "to the Knowledge of the Company" chapeau prose, "willful
   misconduct" (lowercase — zero hits under the capital-W stem),
   "pursuant" / "unwillingly" (word-boundary proofs), and a committed
   Term/Section index-table span pinned as an EXPECTED unmatched-signal
   hit (the priced index-table cost, deletion-proofed); the
   `\bIntervening Event\b` cross-hit in a committed NOSOL-INTERVENING
   host quote pinned as EXPECTED; each surviving pattern hits its own
   grounding quote in committed fixtures.
8. Full suite + `npm run build` + forbidden-patterns (fixtures inside the
   `*-live-run` exempt directory class; zero new exemption entries);
   phase allowlist for the slice's files.

## Out of scope

- `DEF-ORDINARY` (own future slice: the interpretive-clause vs
  defined-term structural split, pack warning #3, needs its own grounding
  pass and probably two shapes); `DEF-BURDENSOME` (owned by ANTI-BURDEN);
  every other `DEF-*` subtype including the 2702-card DEF-GENERAL tail
  and the pure-cross-reference Business Day shape (pack warning #9 —
  nothing quote-local to extract).
- The MAE definition in every respect (owned spec; Boundaries item 1).
- Effective-threshold derivation from substitution claims
  (cross-reference/relationship machinery — the §1 ruling); comparator
  direction ("more than" vs "or more") as a parsed field; the
  all-or-substantially-all Superior Proposal shape (open world, cards
  named); intervening-event notice/match procedural mechanics (no-shop
  territory, unregistered there); board-determination good-faith
  machinery beyond the two grounded qualifier codes.
- Cross-deal canonicalization of every `*_term_ref` and of
  `named_persons` → titles (Ben adjudication over observed values,
  later).
- `definition_components` and `termination_fee_triggers` table
  disposition (0 rows each; Ben data-hygiene call, flagged).
- FAMILY_MAPPING_TABLE extension (separate Fable+Ben edit; MUST honor the
  `(provision_type, provision_subtype)` partition rule pinned in Corpus
  grounding — the NOSOL-* mistag population makes this table Ben-reviewed,
  never implementer-inferred).
- The live re-extraction runs (each a dated handoff; until they land, NO
  report may claim native defined-terms extraction — M-5); any M3
  amendment; any scope-closure/ABSENT work (a missing definition is
  NEVER produced as absent — restated once more because this family is
  where the temptation is strongest: "this deal has no Willful Breach
  definition" is a market statistic someone will want, and it belongs to
  scope closure, forever).

## Known costs, stated up front

- **Compound definitions are this family's norm** — multi-basis
  thresholds (Kraft), dual-qualifier Superior definitions (`74eafcf0`),
  dual-party knowledge (`37647fd3`), mixed-source knowledge (`f7ff2b2c`),
  multi-limb intervening provisos (`729920e2`). Until producers split
  reliably, the `AMBIGUOUS_*` review classes carry material volume;
  two-strike escalation applies to prompt iteration, never to loosening
  the full-table check or the parsers' one-literal rules.
- Substitution-form deals produce NO published "Superior Proposal
  threshold" number this slice — only the substitution claim. Consumers
  see `'50'` with a FROM and a substituted term, not an effective
  threshold; anyone wanting the joined number waits for relationship
  machinery. Honest shape of the work; stating otherwise in any report is
  the named overclaim.
- `CONSTRUCTIVE` knowledge queues unconditionally (zero grounded
  standalone bytes); all-or-substantially-all Superior definitions stay
  open world; both feed the commonality report.
- v1 quote-span drift (warnings #2/#6) means v1↔v2 comparator runs over
  this family will show disagreements that are v1 defects (drift cards
  `069b58c5`/`c389fc29`, index-table bleed `df078b03`) — flagged to the
  ingest-QA owner; the comparator's job is to surface them, not to make
  v1 canonical.
- Annex/Exhibit definitional bodies without a "definition" title token
  under-classify this slice (typed, measured by the live-run handoffs);
  definitions drafted inline inside covenant articles (the 21/20/15-card
  DEFINITION-typed NOSOL-* mistag population) are reached only when their
  section titles carry "Definition" — the remainder is priced
  under-coverage until the classifier's stage-2 data justifies a reviewed
  widening.
- The `\bIntervening Event\b` / `\bSuperior Proposal\b` /
  `\bTakeover Proposal\b` lexicon entries and the index-table
  contamination will queue false vetoes in adjacent sections; queue data
  measures the rate; remedies are reviewed lexicon refinements, never
  module-side heuristics (deletion asymmetry applies).
- Lowercase-drafted defined terms ("willful breach" uncapitalized) lose
  a veto, never gain a wrong claim; recorded blind spot.
- **Unnamed-term blind spot (audit-m3-added):** one DEFINITION-typed
  NOSOL-SUPERIOR card (deal `bb5f062d…`) defines its term as "Superior
  Offer" rather than "Superior Proposal"; the `SUPERIOR_THRESHOLD`
  corroboration's requirement that `superior_term_ref` match
  /Superior Proposal/ queues it forever (typed
  `DEFINED_TERM_KIND_UNCORROBORATED`). Fails safe — it never resolves a
  wrong claim — but is a recorded, permanent blind spot alongside the
  lowercase-willful one above, not a transient gap the corpus will close.
