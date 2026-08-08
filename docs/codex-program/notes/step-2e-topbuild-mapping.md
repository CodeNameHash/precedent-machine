# Step 2E, TopBuild section mapping

Status: done. All 25 registered families have a human-reviewed section list
for TopBuild, each confirmed with
`scripts/canonical-v2-live-extraction-run.mjs --dry-run --deal topbuild
--family <NAME> --section-refs <list>` (exit 0, `would_call_model: false`,
every heading resolved matching the actual filed text). **Zero model calls
made.** Projected total across all 25 families: **68**.

This mapping is **not yet written into `DEAL_PINS.topbuild` in
`scripts/canonical-v2-live-extraction-run.mjs`** — that edit belongs to
whichever step next runs TopBuild live (2F), so it can pin the reviewed list
in the same change that exercises it. This document is the reviewed
artefact 2F pins from. Confirmation below used `--section-refs` on the CLI,
which `resolveRunConfig` accepts in preference to the (currently empty)
`DEAL_PINS.topbuild.default_section_refs_by_family`, so nothing needed
editing to prove every list resolves.

## Method

1. `node scripts/canonical-v2-generate-family-section-refs.mjs --deal
   topbuild` (output already committed as
   `docs/codex-program/notes/family-section-refs-topbuild-20260807-generated.json`,
   PLAN.md Step 2A) — 17 of 25 families matched something, 8 matched
   nothing.
2. Rebuilt TopBuild's canonical text locally (same intake/conversion path
   the generator uses, hash-verified against the pinned
   `canonical_text_sha256`) and read the full table of contents plus the
   body of every section a family's proposal touched, or should have
   touched. Not spot-checked — every one of the 25 rows below was read
   against the actual text, not assumed from the generator's title-rule
   output.
3. Corrected the generator's proposal wherever the text disagreed with it.
   17 of 25 rows changed from the raw generator output; 8 did not.
4. Confirmed all 25 with `--dry-run --section-refs`, capturing
   `sections_resolved[].heading` for each and checking it against the
   table of contents by hand (below).

## Why TopBuild disagrees with the generator so much more than Modiv did

Modiv's article structure is granular: each rep, each covenant topic, gets
its own numbered section (`3.2` capitalisation, `3.11`/`3.12` employee
matters, `3.17` material contracts, `3.25` no-other-reps, each standalone).
TopBuild's is not. Article III is **two sections only** — `3.1`
(Company reps) and `3.2` (Parent/Merger Sub reps) — each a single section
running to tens of lettered sub-paragraphs `(a)` through `(w)`. Capitalisation,
material contracts, no-other-reps, and the MAE definition all live as
sub-paragraphs inside those two sections, not as topics with their own
section number. The stage-1 generator classifies by **title**, and a
sub-paragraph has no section-level title of its own to match — so every
family whose TopBuild content sits inside `3.1`/`3.2` came back empty from
the generator even though the content is there. This is not a generator
defect; it is exactly the "the articles do not align" problem PLAN.md
predicted, playing out at the sub-section level rather than the article
level.

The same pattern recurs at `4.1`/`4.2` (Interim Operations — dividends
restrictions live inside as sub-paragraphs), `4.3`/`4.4` (No Solicitation —
Superior Proposal and Intervening Event definitions live inside), `4.6`
(Cooperation; Reasonable Best Efforts — the HSR/antitrust covenant is
sub-paragraph `(b)` of a section titled about efforts generally), and
Article I (the two-step Titanium Merger / Forward Merger structure means
section titles say "The Titanium Merger" and "The Forward Merger" rather
than the bare "The Merger" the title-rule pattern expects).

## The 25, resolved

Sections in **bold** were added or changed from the raw generator proposal;
everything else matched the generator exactly. "Verified" means the
section's actual text was read and confirmed to carry the family's content
(not just that the heading looks plausible).

| # | Family | Generator proposed | **Resolved (this review)** | Calls | Verified against |
|---|---|---|---|---|---|
| 1 | ANTITRUST_REGULATORY | — (zero) | **`4.6`** | 1 | §4.6(b) "Antitrust": HSR Act filings, foreign antitrust/FDI filings, cooperation with Government Antitrust Entities — the section is titled "Cooperation; Reasonable Best Efforts" (generic), so the title rule never fired; the antitrust covenant is sub-paragraph (b) |
| 2 | APPRAISAL_DISSENTERS_RIGHTS | — (zero) | **`2.1`** | 1 | §2.1(d) "Dissenters' Rights": DGCL §262 appraisal mechanics, settlement-consent ("shall not... make any payment voluntarily... offer to settle... waive any failure") and withdrawal/reconversion ("fails to perfect... shall thereupon automatically be deemed to have converted") — both assertion kinds this family's producer extracts. No standalone Appraisal/Dissenters section exists in TopBuild; this is a lettered sub-paragraph of §2.1 |
| 3 | CAPITALISATION | — (zero) | **`3.1`, `3.2`** | 2 | Capital structure reps are sub-paragraph (b) of both §3.1 (Company) and its analogue in §3.2 (Parent/Merger Subs, incl. "(k) Capitalization of Titanium Merger Sub", "(l) Capitalization of Forward Merger Sub"); no standalone Capitalization section exists |
| 4 | CLOSING_CONDITIONS | `5.1`,`5.2`,`5.3` | `5.1`, `5.2`, `5.3` (unchanged) | 3 | Exact 1:1 match — Article V is exactly these three sections, titles verified |
| 5 | CONSIDERATION | `2.1`,`2.3`,`2.4` | **`2.1`, `2.2`, `2.3`, `2.4`, `2.5`** | 5 | Added `2.2` "Company Shares" (exchange-fund/exchange-agent mechanics — `EXCHANGE_MECHANICS` is an explicit surface this family's producer extracts) and `2.5` "No Fractional Shares" (the per-share cash-out formula for the Merger Fractional Share Payout). Generator missed both because their titles don't contain "consideration"/"exchange of certificates"/etc. verbatim |
| 6 | DIVIDENDS | — (zero) | **`4.1`, `4.2`** | 2 | Dividend-declaration restriction is sub-paragraph (vi) of §4.1 (Company) and (iv) of §4.2 (Parent); no standalone Dividends section exists |
| 7 | DNO_INDEMNIFICATION | `4.13` | `4.13` (unchanged) | 1 | "Indemnification; Directors' and Officers' Insurance" — exact match |
| 8 | EMPLOYEE_MATTERS | — (zero) | **`3.1`, `4.11`** | 2 | Benefit-plan rep is sub-paragraph (h) "Employee Benefits" of §3.1; the covenant is §4.11, titled "Employee Benefits" — doesn't literally contain "employee matters"/"continuing employees"/"employee benefit matters" so the title rule never fired on either |
| 9 | FINANCING_COVENANTS | `4.17` | `4.17` (unchanged) | 1 | "Financing Provisions" — exact match. Deliberately does *not* also claim `7.16`: the title rule excludes "financing sources"-titled content from this family by design, routing it to GUARANTY_FINANCING_PARTY instead (see row 11) |
| 10 | GENERAL_COVENANTS | `4.10`,`4.18`,`4.19`,`4.21` | **`4.8`, `4.9`, `4.10`, `4.18`, `4.19`, `4.21`** | 6 | Added `4.8` "NYSE De-listing" and `4.9` "NYSE Listing" — squarely "stock exchange listing/delisting" content the family's title pattern already intends to cover, but the pattern expects a bare "Delisting"/"Stock Exchange Listing" title and TopBuild's titles carry an "NYSE" prefix |
| 11 | **GUARANTY_FINANCING_PARTY** | — (zero) | **`7.16`** | 1 | **See "The flagged zero" below — this is the family PLAN.md named by name** |
| 12 | INTERIM_OPERATING | `4.1`,`4.2` | `4.1`, `4.2` (unchanged) | 2 | "Interim Operations of the Company"/"...of Parent" — exact match |
| 13 | KEY_DEFINED_TERMS | `7.12` | **`3.1`, `4.3`, `4.4`, `6.5`** | 4 | **Full replacement, not an addition — see "The other real defect" below** |
| 14 | MAE_DEFINITION | `3.1`,`3.2` | `3.1`, `3.2` (unchanged) | 2 | Matches the corpus grounding already recorded in `section-family-classifier.js`'s own header comment: TopBuild's MAE definition is nested inside the "Organization, Good Standing and Qualification" rep with no MAE-specific heading, i.e. inside `3.1`/`3.2` |
| 15 | MATERIAL_CONTRACTS | — (zero) | **`3.1`** | 1 | Sub-paragraph (p) "Contracts" of §3.1 defines "Company Material Contracts". §3.2's sub-paragraph (p) is "Solvency", not Contracts — Parent (the strategic buyer) gives no Material Contracts rep in this agreement, so `3.2` is correctly *not* added here |
| 16 | MERGER_STRUCTURE_CLOSING | `1.3`,`1.4`,`1.5`,`1.8` | **`1.1`, `1.2`, `1.3`, `1.4`, `1.5`, `1.6`, `1.7`, `1.8`** (all of Article I) | 8 | TopBuild is a two-step merger (Titanium Merger then Forward Merger), so §1.1/§1.2 are titled "The Titanium Merger"/"The Forward Merger" rather than the bare "The Merger" the title pattern expects, and §1.6/§1.7 (charter/bylaws) are titled with the same "Titanium"/"Forward" qualifiers inserted mid-pattern. All eight sections are core merger-structure/closing-mechanics content |
| 17 | MISC_BOILERPLATE | `7.2`,`7.3`,`7.4`,`7.5`,`7.7`,`7.8`,`7.9`,`7.13`,`7.15` | **added `7.1`, `7.14`** → `7.1`,`7.2`,`7.3`,`7.4`,`7.5`,`7.7`,`7.8`,`7.9`,`7.13`,`7.14`,`7.15` | 11 | `7.1` "Survival" and `7.14` "Interpretation; Construction" match this family's own `WAIVER_OR_SURVIVAL` and `CONSTRUCTION_OR_EXPENSES` assertion kinds directly; the title pattern's fixed whitelist doesn't include either title string. `7.10` "Obligations of Parent and of the Company" (a subsidiary-compliance boilerplate clause) was read and **deliberately left out** — it doesn't fit any of this family's six assertion kinds and is narrow enough that force-fitting it seemed worse than flagging it as uncovered (see Open questions) |
| 18 | NO_OTHER_REPS_FRAUD | — (zero) | **`3.1`, `3.2`** | 2 | Sub-paragraph (w) "No Other Representations or Warranties" of §3.1 and (r) of §3.2 — both present, neither has its own section number |
| 19 | NO_SHOP | `4.3`,`4.4` | `4.3`, `4.4` (unchanged) | 2 | "No Solicitation by the Company"/"...by Parent" — exact match. (TopBuild is unusual in having a two-sided no-shop: Parent's stockholders vote too, since Parent Shares are being issued as consideration, so Parent can receive competing proposals as well) |
| 20 | PROXY_MEETING | `4.5` | `4.5` (unchanged) | 1 | Combined "Company Stockholder Meeting and Parent Stockholder Meeting; Form S-4 and Joint Proxy Statement/Prospectus" — exact match, single section covers both meetings |
| 21 | REPRESENTATIONS | `3.1`,`3.2` | `3.1`, `3.2` (unchanged) | 2 | Exact match — these are literally the two representations articles |
| 22 | SPECIFIC_PERFORMANCE_REMEDIES | `7.6` | `7.6` (unchanged) | 1 | "Specific Performance" — exact match |
| 23 | TAX_MATTERS | `4.23`,`7.11` | `4.23`, `7.11` (unchanged) | 2 | "Tax Matters"/"Transfer Taxes" — exact match |
| 24 | TERMINATION | `6.1`,`6.2`,`6.3`,`6.4` | `6.1`, `6.2`, `6.3`, `6.4` (unchanged) | 4 | Exact match, correctly excludes `6.5` (the fee/effect-of-termination section) |
| 25 | TERMINATION_FEE | — (zero) | **`6.5`** | 1 | "Effect of Termination and Abandonment" — both `Company Termination Fee` ($600M, §6.5(b)) and `Parent Termination Fee` ($600M, §6.5(c)) are defined and quantified here. Generator returned zero for this family specifically (it matched `TERMINATION` instead, correctly, since `TERMF_TITLE_PATTERN` requires "fee"/"break-up"/"effect of termination"/etc. in the title, and TopBuild's title is "Effect of Termination *and Abandonment*" — a slight variant the exact pattern still matches on its own, but the raw generator run recorded above returned `6.5` for `TERMINATION` and nothing for `TERMINATION_FEE` in the same pass, which is a mutual-exclusion artefact of `classifyRuleSectionFamilies`' first-match merge, not a missed section) |

**Total projected model calls across all 25 families: 68.**

## The flagged zero: `GUARANTY_FINANCING_PARTY`

PLAN.md says this one by name: a zero here, on a financed deal with two
dedicated financing sections, would mean the mapping is wrong, not that the
family is correctly quiet. It was wrong.

TopBuild is a $600M-fee, debt-financed acquisition by QXO, Inc. (39 mentions
of "Debt Financing" against Modiv's zero), with `4.17` "Financing
Provisions" and `7.16` "Waiver of Claims Against Financing Sources" as
dedicated sections — exactly the corpus grounding PLAN.md Step 2F cites for
why this family must not stay quiet on TopBuild.

The generator returned zero because its title rule for this family
(`GUARANTY_TITLE_PATTERN`) only matches titles containing "guarant(y/ee)" —
and TopBuild's financing-party-protection section is titled "Waiver of
Claims Against Financing Sources", which contains no such word. Worse, the
*other* rule that might have caught it — `FINANCING_COVENANTS`'s title
pattern — explicitly **excludes** any title matching `financing\s+sources?`
by design (so that financing-sources content routes to this family instead
of the general financing-cooperation family). The two exclusions compound:
`7.16` is excluded from `FINANCING_COVENANTS` by design and never matched by
`GUARANTY_FINANCING_PARTY`'s title rule, so it fell through both and landed
nowhere.

Read directly, `7.16` is precisely what this family's own producer prompt
(`guaranty-producer-prompt.js`) is built to capture: its `financing_mechanics`
response shape has a dedicated `FINANCING_PARTY_PROTECTION` surface, and
`7.16`'s text — "None of the Financing Sources shall have any liability to
the Company... neither the Company nor any of its Subsidiaries... will have
any rights or claims against any Financing Sources... shall the Company...
be entitled to seek the remedy of specific performance... against any of the
Financing Sources" — is a textbook non-recourse/no-claims-against-lenders
clause, the standard "financing party protection" boilerplate this family
exists to extract.

TopBuild has **no separate Guaranty section** (no "Guaranty"-titled article,
no Parent/Holdco guaranty of Merger Sub's obligations) — searched for every
occurrence of "guarant*" in the document; all hits are either the PBGC
(Pension Benefit Guaranty Corporation, an ERISA rep, unrelated), ordinary
"guarantee" used generically inside the Indebtedness definition and the
financing-cooperation covenant (`4.17`, already covered by
`FINANCING_COVENANTS`), or the credit-agreement/indenture subsidiary
guarantors named in the `Existing Company Credit Agreement`/`Indentures`
definitions (also `4.17`). This is unsurprising and not itself a defect: QXO
is a strategic acquirer acting as Parent directly, not through an SPV that
would need a limited guaranty from a sponsor, so the `guaranty_assertions`
half of this family's producer will likely find nothing on TopBuild — but
that is a different, later finding (from an actual extraction run), not
something to resolve at the mapping stage by pointing the family at nothing.
The mapping's job is only to point it at the section that *can* carry this
family's content, and `7.16` does.

**Verdict: the zero was a mapping defect, corrected. `GUARANTY_FINANCING_PARTY`
is pinned to `['7.16']` for TopBuild, confirmed by dry run
(`projected_model_call_count=1`, heading "Waiver of Claims Against Financing
Sources").**

## The other real defect: `KEY_DEFINED_TERMS`

Not called out by name in PLAN.md, but worth recording with the same rigor,
because pinning the generator's proposal (`7.12`) without reading it would
have reproduced Modiv's original KEY_DEFINED_TERMS mistake — a pin that
looks plausible (a section literally titled "Definitions") but carries no
extractable content.

`7.12` reads, in full: *"Each of the terms set forth in Annex C is defined
in the Section of this Agreement set forth opposite such term."* One
sentence. TopBuild has no centralized definitions article like Modiv's
`8.12` (55 KB of `"X" means...` prose). `Annex C` is a two-column
term-to-citation index (e.g. `Adjusted RSU ‎2.3(c)`, `Bankruptcy and Equity
Exception ‎3.1(c)`), not definitional prose — every term is defined inline,
at first use, scattered across the document.

This family's own producer prompt (`defined-terms-producer-prompt.js`)
targets a specific list of assertion kinds — acquisition/superior-proposal
thresholds, intervening-event definitions, knowledge standards, willful-
breach standards — and every one of those is findable, read directly:

- `Company Superior Proposal` / `Company Intervening Event` defined in
  §4.3(f)/(iii) (No Solicitation by the Company)
- `Parent Superior Proposal` / `Parent Intervening Event` defined in
  §4.4(f)/(ii) (No Solicitation by Parent)
- `"Knowledge"` standard ("actual knowledge... after due inquiry of such
  person's direct reports", scheduled named persons) defined in §3.1(g)(iii)
- `"willful and material breach"` defined in §6.5(a)

Pinning `7.12` alone would have produced a near-empty run for exactly the
reason Modiv's original `KEY_DEFINED_TERMS` pin (`8.5` instead of `8.12`)
did: a plausible-looking "Definitions" section that isn't where the actual
defining sentences live. **Resolved to `['3.1', '4.3', '4.4', '6.5']`** —
all four already pinned for other families (no new sections introduced),
confirmed by dry run (`projected_model_call_count=4`).

## Open questions / not resolved here

- **`7.10` "Obligations of Parent and of the Company"** (§7, Article VII) is
  real text with no clean home in any of the 25 families as reviewed. It's
  a narrow "a requirement on a Subsidiary is deemed a requirement on its
  parent to cause the Subsidiary to comply" clause — boilerplate in effect,
  but doesn't fit any of `MISC_BOILERPLATE`'s six assertion kinds
  (`GOVERNING_LAW | FORUM_FALLBACK | WAIVER_OR_SURVIVAL |
  CONSTRUCTION_OR_EXPENSES | TPB_EXCEPTION | ASSIGNMENT_DETAIL | NOTICE`).
  Left unpinned to any family; flagging rather than force-fitting.
- **`4.12` "Expenses"**, **`4.20` "Consultation; Control of Operations"**,
  **`4.22` "Notices of Certain Events"**, **`4.24` "Election to Parent's
  Board of Directors"** were read at the table-of-contents level only
  (titles, not full body text) and not assigned to any family. `4.12`
  plausibly overlaps `MISC_BOILERPLATE`'s `CONSTRUCTION_OR_EXPENSES` kind;
  `4.24` is idiosyncratic to this deal's board-seat mechanics and doesn't
  map cleanly onto any of the 25. None of these affect the 25 registered
  families' resolved lists above — they are additional content the
  taxonomy may not fully cover, not a defect in any of the 25 rows.

## The empty-family collision, resolved

`resolveRunConfig` (`scripts/canonical-v2-live-extraction-run.mjs`
~357-363) throws `--section-refs is required...` whenever a (deal, family)
pair resolves to an empty section list, from either `DEAL_PINS` or an
explicit `--section-refs`. PLAN.md Step 2A's own proof requires every
registered family have a pinned list for a deal. Put together: a family
that is genuinely, correctly absent from a document — not a mapping miss,
an actual absence — can be recorded in a mapping and then can never be run,
because the runner refuses an empty list outright.

**This mapping does not hit the collision.** Every one of TopBuild's 25
families resolved to at least one real section once read properly — the
8 the generator returned zero for were all mapping defects (title-rule
misses caused by TopBuild's flatter, sub-paragraph-heavy structure), not
genuine absences. Unlike Modiv's `GUARANTY_FINANCING_PARTY` (pinned to
`5.11`, a real section that legitimately produced zero *extraction* output
because the deal is unfinanced), TopBuild has no family in this position:
it is a financed deal, and every family that looked structurally absent
turned out to have real content once the actual sub-paragraphs were read.

The collision is still real and still needs resolving in writing, because
2F or a later document may hit a family that is genuinely, not just
apparently, absent — and the decision needs to exist before that happens,
not be invented under pressure by whoever hits it first.

**Resolution: an explicit `expected_empty` flag on the pin entry, not a
sentinel section reference and not a blanket runner escape hatch.**

Three options were on the table (per PLAN.md's own framing):

1. **A sentinel pinned value** — point the family at some real section
   that plausibly relates, expecting the extraction to correctly find
   nothing (what Modiv did for `GUARANTY_FINANCING_PARTY` → `5.11`).
   **Rejected as the general answer.** PLAN.md's own text names the
   problem with this: "on a document where no such section exists there is
   nothing to pin." It only works when a real, plausibly-related section
   happens to exist to point at. It also produces an artefact that is
   ambiguous on its face — a reader of `DEAL_PINS` looking at
   `GUARANTY_FINANCING_PARTY: ["5.11"]` cannot tell, from the pin alone,
   whether `5.11` was pinned because it plausibly carries the family or as
   an acknowledged placeholder for "nothing exists here." That is exactly
   the failure Decision 2 (`DECISIONS.md`, the open-world marker ruling)
   already rejected in the adjacent case: *the marker must sit on the
   thing, not be inferred from where it came from.*
2. **A runner escape hatch** (e.g. a CLI flag like `--allow-empty` that
   bypasses the throw generally). **Rejected.** Too broad: it would let
   any family run against zero sections for any reason, silently, which is
   precisely the "gate gets quietly weakened" failure PLAN.md warns
   against. An escape hatch doesn't distinguish "this family was reviewed
   and is correctly absent" from "nobody has pinned this family yet."
3. **An explicit `expected_empty` flag the runner honours.** **Chosen.**
   A family's pin entry becomes either a non-empty array (as today) or an
   object `{ expected_empty: true, reason: "<why, citing what was read>" }`.
   `resolveRunConfig` treats `expected_empty: true` as a deliberate,
   reviewed decision — it returns `sectionRefs: []` and a dry run reports
   `projected_model_call_count=0` cleanly instead of throwing; a live run
   (non-dry-run) with an empty resolved list still cannot call a model (no
   sections to extract from), so it exits cleanly with a typed "no sections
   to run, by design" result rather than the generic
   `--section-refs is required` error. 2A's own proof — "every registered
   family has a pinned list" — is satisfied unchanged: the proof checks for
   *a pin entry*, and an `expected_empty` object is one, exactly as
   auditable as a section-reference array, and self-documenting about why.

This mirrors the marker-on-the-row principle from `DECISIONS.md` decision 2
deliberately: the same reasoning that says an open-world row must carry its
own "this is ungoverned" marker rather than relying on which collection it
arrived in says an empty-family pin must carry its own "this is reviewed and
correct" marker rather than relying on a sentinel section that looks
identical to a real pin.

**Not implemented here.** This step's ownership is the TopBuild mapping and
these notes, not `scripts/canonical-v2-live-extraction-run.mjs` — and this
mapping does not need the collision resolved to be usable (see above,
nothing here is empty). Recording the decision in writing, per PLAN.md's
explicit instruction, without touching the shared runner file that Step 2C
may be concurrently editing for Modiv, is the safer scoping. **2F should
implement the `expected_empty` branch in `resolveRunConfig` in the same
change that first needs it** (or before, if it wants to add tests ahead of
need) — the design above is the spec for that change.

## Corpus grounding referenced

- QXO, Inc. / TopBuild Corp. Agreement and Plan of Merger, dated April 18,
  2026 — `tests/fixtures/canonical-v2/mae-definition-family/topbuild-raw-fetched.htm`,
  `canonical_text_sha256`
  `7dfbb5bb90fa7034462e42496e9a5068fa2fa6ac55ba69f977cf7108378e7f5d` (matches
  `DEAL_PINS.topbuild` in `scripts/canonical-v2-live-extraction-run.mjs`).
- Raw generator output:
  `docs/codex-program/notes/family-section-refs-topbuild-20260807-generated.json`
  (PLAN.md Step 2A, committed prior to this step).
- Dry-run confirmations: all 25 run via
  `CI=true node scripts/canonical-v2-live-extraction-run.mjs --dry-run
  --deal topbuild --family <NAME> --section-refs <resolved list above>`,
  each exiting 0 with `would_call_model: false` and every
  `sections_resolved[].heading` checked by hand against the agreement's own
  table of contents (reproduced in full in this review; not re-typed here
  for space — see the per-family rows above for the headings actually
  returned).
