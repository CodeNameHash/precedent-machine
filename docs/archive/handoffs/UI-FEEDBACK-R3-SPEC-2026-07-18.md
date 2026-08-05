# UI Feedback Round 3 — Investigation + Fix Specs (2026-07-18)

Investigator: Fable (investigation only — no fixes applied). Implementers:
Codex / Sonnet per CLAUDE.md routing. Every item below was diagnosed to root
cause against the live dev render (playwright, 1440/768/390px) and/or the
raw card JSON from `/api/review/<dealId>/cards`.

Deals referenced:
- **Metsera** `885edae5-49e8-464a-9f33-edd229119d7c`
- **QXO** `7dc3a05f-b170-4d59-a255-b7103cca16e1`
- **Theravance** `0d38cc1f-2f49-47ee-bc21-de68d7884b90`

Verification note: the dev-session Supabase connection degraded partway
through (intermittent 500s / 60-90s API latency). All findings below were
verified live BEFORE the degradation except where marked "verify live".
Implementers must re-run the live checks (see Gates at the end).

---

## Item 1 — Metsera: Outside Date / Closing timing / Effective time

### 1a. "Outside Date" must move out of Structure & Mechanics → Termination

**Root cause (render config).** Round-2 feedback deliberately folded an
Outside Date row INTO the structure-mechanics table:
- `components/review-v2/sectionList.js:162-185` — `deriveClosingTimingRows()`
  builds `structure-mechanics-outside-date` from the TERMR-OUTSIDE card.
- `components/review-v2/configDecorations.js:178-191` —
  `decorateStructureMechanicsConfig()` splices those rows in after
  `structure-mechanics-closing-timing`.

Ben has reversed that call: Outside Date belongs in Termination. The
Termination Rights table **already renders it independently** —
`components/review/table-configs/termination-rights.config.js:15` has the
`'Outside / End Date'` group over codes `TERMR-OUTSIDE`/`TERMR-EXTENSION`
(rows built at :73-81 and :253-288) — so nothing is lost by removal.

**Fix.**
1. In `sectionList.js#deriveClosingTimingRows`, delete the `outsideCard`
   block (lines 166-185). Keep the Marketing-Period and Ticking-Fee blocks.
2. Delete/adjust any tests asserting `structure-mechanics-outside-date`
   (grep `tests/` for that id).
3. Update the stale comment block at sectionList.js:125-138 (it cites the
   round-2 decision) to record the round-3 reversal, so this doesn't
   oscillate again.

**Class:** render-only. **Risk:** low.

### 1b. Closing timing "third business day after conditions satisfied"

**Finding: NOT lost.** Verified live on this branch — the
`structure-mechanics-closing-timing` row renders
"At 8:00 a.m., New York City time, on the third business day after
satisfaction or waiver of Article VII conditions." sourced from
STRUCT-CLOSING's `closingTiming` feature
(`structure-mechanics.config.js:12`, data confirmed on the card). The
perceived loss is a legibility problem: the row is sandwiched between the
Outside Date blob (765-char detail, see 1a) and the Effective-time clause
dump (1c), so the short answer drowns. 1a + 1c restore it visually. No code
change for 1b itself; implementer should confirm the row on the live page
after 1a/1c land.

### 1c. Effective time renders the full §1.03 clause instead of "per certificate of merger"

**Root cause (render config — tier ordering).**
`components/review/table-configs/structure-mechanics.config.js:72-94`
(`effectiveTimeHit`): the FIRST tier returns the card's raw clause text
whenever it doesn't match `/surviving corporation/i` (:75-78). Metsera's
STRUCT-EFFTIME card has a clean claim
`effectiveTimeShort = "Upon filing of the Certificate of Merger with the
Delaware Secretary of State."` — but its clause text ("SECTION 1.03.
Effective Time. Prior to the Closing, the Company shall prepare…", ~780
chars) doesn't mention "surviving corporation", so the clause tier wins and
the row dumps the whole section. The clause-first ordering was a stopgap for
corrupted `effectiveTimeShort` values; the corpus reprocess has since fixed
those claims, so the ordering is now inverted from what's wanted.

**Fix.** Reorder the tiers in `effectiveTimeHit` (keep the
EFFECTIVE_TIME_CODE_RE pool narrowing and the SURVIVING_CORP_RE guard):
1. Structured keys first, key-major scan exactly as today (:79-85):
   `effectiveTimeShort` → `effectiveTime` → `mainConcept`, skipping
   guard-hits.
2. Clause text second (current tier 1 moves down), still guard-checked.
3. Keep the final corrupted-claim clause fallback (:86-92) last.
Rewrite the comment block at :32-70 to match. Update
`tests/` specs covering `effectiveTimeHit` (grep for the export — it is
unit-tested).

**Class:** render-only. **Risk:** low-medium (TopBuild regression noted in
the file's comments was clause-tier-related; the code-narrowed pool at
:70-74 already handles it — implementer must re-run the existing
effectiveTimeHit tests, which encode both the TopBuild and corrupted-claim
cases).

---

## Item 2 — Equity Awards: consideration / vesting / CVR columns same width

**Root cause (render config).** Only `equityType` carries a width
(`equity-awards.config.js:446`); `consideration`, `vestingTreatment`,
`cvrEntitlement` (:448-458) have none. `ProvisionTable.jsx:143` renders
`<table class="min-w-full">` with AUTO layout, so the browser sizes the
three columns from their content per deal. Measured live at 1440px:
Metsera 172/212/158px vs QXO 268/159/115px for the same three columns; at
390px the table is the only one that horizontally SCROLLS.

**Fix.**
1. Add fixed-layout support to `ProvisionTable.jsx`: when
   `config.fixedLayout === true`, add `table-fixed` to the `<table>`
   className and emit a `<colgroup>` from `config.columns[].width`
   (col style width; unspecified widths share the remainder).
2. In `equity-awards.config.js` set `fixedLayout: true` and give the three
   treatment columns the SAME width — `width: '18%'` each with
   `equityType` at `'14rem'` (or all four as %: 30/24/24/22). Percentages
   + table-fixed keep them equal at every viewport and kill the 390px
   scroll (long pill labels already wrap — PillCell `wrap` handles it; pass
   `wrap: true` on the pills rendered by `pill()` in this config so
   `truncate` doesn't force min-content overflow).
3. Item 11's shape-3 label fix (below) removes the prose that currently
   inflates these columns on legacy-shape deals.

**Class:** render-only. **Risk:** low.

---

## Item 3 — Consistent column-width system across rep tables (and all tables)

**Root cause (render config — three competing width systems).** Measured
live (Metsera, first data-cell width):

| surface | 1440px | 390px | mechanism |
|---|---|---|---|
| structure-mechanics | 335px | 144px | th width '18rem' hint, auto layout |
| votes/termination/tail/antitrust | 224px | 144px | th '16-18rem' hint, auto |
| reps per-rep table Term | 288px | 136px | th '18rem' (`representations-qualifiers.config.js:663`), auto |
| reps Knowledge/General-Exceptions boxes | 224px | **224px (never shrinks)** | `w-[14rem]` + `whitespace-nowrap` td (`representations-qualifiers.config.js:593`) |
| GroupedSubRows label col (nosol/conditions/termination-rights) | varies | varies | CSS grid `minmax(8rem,14rem)` (`ProvisionTablePrimitives.jsx:208`) |

Because `min-w-full` auto tables treat `th width` as a hint, every table
resolves different real widths from its own content — so sibling tables'
first columns disagree at desktop, and at 390px they shrink by different
amounts while the reps boxes don't shrink at all (nowrap + fixed 14rem):
that is the "jumps around" effect.

**Fix — one shared token, one layout mode.**
1. Define shared constants in a new
   `components/review/table-configs/layout.js`:
   `TERM_COL = 'clamp(9rem, 30%, 14rem)'` is NOT expressible as a table col
   width everywhere, so use the pair: `TERM_COL_WIDTH = '30%'`,
   `TERM_COL_MAX = '14rem'` and apply via `<colgroup><col
   style={{width:'30%', maxWidth:'14rem'}}>` under `table-fixed` (col
   maxWidth is honored under fixed layout in Chromium; fall back to plain
   `width:'30%'` if cross-browser trouble — equality matters more than the
   cap).
2. Turn on the Item-2 `fixedLayout` path for ALL generic ProvisionTable
   configs and normalize every per-config `width:` on the first (Term)
   column to the shared token; second/value columns get the remainder.
3. Reps: `repsTableNode` (`representations-qualifiers.config.js:670-704`)
   and `sectionBox` (:572-599) adopt the same colgroup; in `sectionBox`
   replace `w-[14rem] … whitespace-nowrap` with the shared token and
   `whitespace-normal break-words` so Knowledge Standard/Persons labels
   wrap and match the per-rep table's Term column width exactly (Ben's
   specific ask: knowledge standard/persons column = organization/
   qualification/standing column).
4. GroupedSubRows: change the grid template at
   `ProvisionTablePrimitives.jsx:208` to `grid-cols-[30%_1fr]` with the
   same 14rem cap (`minmax(0,14rem)` won't give 30%; use
   `[minmax(8rem,30%)_1fr]`) — close enough to read as the same system.
5. MaeSection tables (`components/review-v2/MaeSection.jsx:108-130`)
   join the same colgroup mode.

**Class:** render-only. **Risk:** medium (touches every table's layout —
verify at 1440/768/390 on all three deals; acceptance: all first columns
within a few px of each other per viewport, no horizontal scroll except
inside `overflow-x-auto` wrappers).

---

## Item 4 — Phone masthead degrades to "Metsera $7.0B" in a serif font

**Root cause (render config).** `components/review-v2/DealHeader.jsx`:
- :131 — the acquirer line ("ACQUIRED BY Pfizer") is `hidden sm:flex` → it
  DISAPPEARS below 640px.
- :155 — the metric strip is `hidden md:flex` → gone below 768px.
- :179-183 — below md a condensed value renders as
  `<span class="mtx-serif …">$7.0B</span>` — `mtx-serif` = Tinos/Times
  serif (verified computed font live), which is the "weird font".

Verified live: at 640px the bar reads "Metsera ACQUIRED BY Pfizer … $7.0B";
at 390px it reads "Metsera $7.0B" (Pfizer hidden, serif value visible) —
exactly Ben's report.

**Fix (survival order: party names die last).**
1. Make the acquirer line always visible: drop `hidden sm:` at :131
   (`flex items-baseline …`). Below sm, render the compact form
   "**Metsera** / **Pfizer**": keep the `ACQUIRED BY` label only `sm:` up
   (wrap the label span in `hidden sm:inline`), and show a plain `/`
   separator below sm.
2. The condensed `$7.0B` (:179-183): remove `mtx-serif` (use the same Inter
   `font-bold text-[#1F1F1F]` as the metric values) and hide it below
   ~480px: `hidden min-[480px]:flex md:hidden`. Net: at the narrowest
   widths ONLY "Metsera / Pfizer" (+ the toggle button, which wraps to its
   own row) survives.
3. Status chip + `→` stay as-is (they're inside the acquirer line; verify
   they truncate gracefully at 320px — add `min-w-0`/`truncate` on the h1
   and the acquirer span so extreme widths ellipsize rather than overflow).

**Class:** render-only. **Risk:** low. Verify at 390px and 340px.

---

## Item 5 — QXO Equity Awards: PSU + RSU rows appear twice

**Root cause (render config — code-normalization mismatch), verified on
card `7c4ff1fb` (CONSID-EQUITY).** The card's `equityAwardTreatment` is a
keyed map (`psus/rsus/options/restrictedStock`) → shape-1 builds 4 rows
whose canonical codes come from `INSTRUMENT_KEY_META`
(`equity-awards.config.js:130-151`): `PSU`, `RSU`, `STOCK_OPTIONS`,
`RESTRICTED_STOCK`. Then `missingInstrumentRows` (:252-276) walks
`outstandingInstruments`, whose stored codes are **`"PSUs"` / `"RSUs"`**;
`codeOf()` (:53-56) merely uppercases → `PSUS`/`RSUS`, which are NOT in the
covered set (`PSU`/`RSU`) → two spurious "No structured treatment captured
for this instrument" gap rows, using the verbose `valueText(inst)` label
("Restricted Stock Units (RSUs): each outstanding and not yet settled…").
Confirmed live: 6 rows, PSUs/RSUs twice.

**Fix.**
1. Normalize before comparing: in `missingInstrumentRows`, resolve each
   outstanding instrument's code through `INSTRUMENT_KEY_META` (the dict
   already has `psus`/`rsus` keys): `const raw = codeOf(inst); const code =
   (INSTRUMENT_KEY_META[String(raw).toLowerCase()] || {}).code || raw;`.
   Apply the same normalization when building `coveredCodes` (defensive)
   and in shape-3's `instrumentCodes` mapping (:341-345) which has the same
   latent bug.
2. **Secondary (top rows unpopulated):** the shape-1 PSU/RSU rows show "—"
   because the classifiers miss QXO's phrasing:
   - `classifyConsiderationType` (:185-192): add `parent shares?` to the
     STOCK pattern → `/parent\s+(?:stock|shares?|equity|award)|buyer\s+(?:stock|equity|award)|assum|convert(?:ed)?\s+into\s+(?:an?\s+)?adjusted/`.
   - `classifyVestingTreatment` (:194-206): add
     `/retain(?:s|ing)?\s+(?:the\s+)?(?:existing|same)[\s\S]{0,40}vesting|same\s+terms\s+and\s+conditions/`
     → `CONTINUED_VESTING` (check it BEFORE the `cancel|cash|spread` rule).
   Expected result: PSUs/RSUs → "Parent stock / rollover" +
   "Continues vesting…". Add these two QXO strings to the config's unit
   fixtures.

**Class:** render-only (the stored data is correct; the `.text` field on
`equityAwardTreatment` also carries a redundant JSON-string copy of the map
— harmless, ignore). **Risk:** low.

---

## Item 6 — QXO NOSOL: change-of-recommendation prohibited actions repeated

**Root cause (data duplication + render dedup keyed on the wrong thing).**
Two cards carry the SAME six `changeOfRecommendationItems` (identical
canonical codes TENDER_OFFER_ACTION / FAIL_TO_INCLUDE_REC /
ENTER_ALT_AGREEMENT / FAIL_TO_REAFFIRM / WITHDRAW_QUALIFY_REC /
APPROVE_ENDORSE): NOSOL-RECOMMEND `68d853e1` (texts without enumerators)
and NOSOL-DISCLOSE `5a9a201d` (texts prefixed "(A) ", "(B) ", …).
`allFeatureItems` (`nosol-fiduciary.config.js:271-292`) dedupes by EXACT
verbatim text, which the "(A) " prefixes defeat → 12 pills; verified live:
every label appears exactly twice. `notChangeOfRecommendationItems`
duplicates the same way (2 + 4 overlapping plain strings).

**Fix (render; data repair optional).**
1. In `corItemsRow` (:307-319) dedupe the mapped items by canonical
   identity: key = `item.code` when present, else the summarized label
   with any leading `^\([A-Za-z0-9]+\)\s*` stripped from the source text.
   When two entries collide, KEEP the lettered one (it carries the clause's
   own A-E ordering that the sort at :318-319 uses) and keep the other's
   verbatim as additional evidence if trivially mergeable (optional).
2. Same dedup applies to the NOT-COR spec via the shared code path (no
   codes there → label-key dedup; see Item 15 which is the same bug on
   Theravance).
3. Data note: NOSOL-DISCLOSE carrying a full copy of the COR list is
   extraction spillover from the reprocess. Render dedup makes it moot
   corpus-wide; if Ben wants the data clean, a `scripts/reprocess.js`
   per-type refresh of COVENANT_NO_SOLICITATION on QXO would re-split the
   lists, but it is NOT required for this fix.

**Class:** render-only (defensive) over duplicated stored data.
**Risk:** low.

---

## Item 7 — QXO "Parent / Merger Sub approvals" dumps raw provision text

**Root cause (render config — fallback pattern too narrow).** Card
`50c90c2d` (COV-SHAPRV-PARENT) has NO `parentAdoptionMechanism` claim (only
`mainConcept` + `sectionNumber`). The deterministic clause fallback at
`votes-approvals-meeting.config.js:173-179` only matches
"as sole stockholder of (the) Merger Sub"; QXO's §4.15 reads "Parent will
cause a written consent to be executed by all of the record holders of the
stock of Titanium Merger Sub to adopt and approve this Agreement…", so
`parentApprovalText` returns null and `parentApprovalNode` (:194-207) falls
to the TruncatedWithSeeText raw dump. Verified live.

**Fix.** Add a second deterministic pattern in `parentApprovalText` after
the sole-stockholder branch:

```
if (/cause\s+a\s+written\s+consent\s+to\s+be\s+executed\s+by\s+all\s+of\s+the\s+(?:record\s+)?(?:holders|stockholders)\b[\s\S]{0,120}?\bMerger\s+Sub\b/i.test(clause)
    && /\b(?:adopt|approv)/i.test(clause)) {
  const immediate = /immediately\s+(?:following|after)\s+(?:the\s+)?execution/i.test(clause);
  return immediate
    ? 'Merger Sub stockholders adopt by written consent (immediately after signing)'
    : 'Merger Sub stockholders adopt by written consent';
}
```

QXO's clause hits the `immediate` branch. Anything still unmatched keeps
the see-text fallback (never guess). Add the QXO clause to this config's
test fixtures.

**Class:** render-only. **Risk:** low.

---

## Item 8 — "See provision" in the left column of every row; kill the hover tooltip

**What happened to the plan: partially shipped.** Current state:
- `ProvisionTable.jsx:22-49` `FULL_TEXT_COLUMNS` relocates whole full-text
  columns behind a LEFT-column "See provision" expander (:169-171) — but
  only for the 13 listed config ids.
- Other families still show provision text via ad-hoc affordances in the
  RIGHT columns: `TruncatedWithSeeText`/`ClampedWithSeeText`
  (`ProvisionTablePrimitives.jsx:102-169`), `seeText()` in
  `nosol-section.config.js:46-58`, `seeTextNode` in `MaeSection.jsx:94-102`
  ("see text", not even the renamed label), `seeDefinitionLink`
  (nosol-section.config.js:340-348).
- Rows with only pills (equity-awards, termination-fees, votes deadlines)
  expose the clause ONLY via the mouse-over popover (`HoverSource`,
  `components/review/shared.js:197-…`), which was supposed to die.

**Fix spec (two stages, both render-only).**
1. **Left-column expander everywhere.** In `ProvisionTable.jsx`'s generic
   row loop: when `fullTextNodes` is empty but the row carries evidence
   (`row.evidence || textOf(row.sourceCard)`), render the same
   `SeeTextExpander` under column 0 with that text. For `renderBody`
   families: reps — add the expander under the Term cell in
   `repsTableNode` (it already exists there via renderTerm's clauseSeeText;
   verify) and under `sectionBox` label cells; nosol/conditions/
   termination-rights — `GroupedSubRows` rows accept an optional
   `row.seeText` node rendered under the LABEL cell (left), and
   `nosol-section.config.js#rowNode` passes its `seeText(detail)` there
   instead of appending to the right cell; MaeSection — move `seeTextNode`
   under the Party/Carve-out (left) cell and rename its summary to
   "See provision". Normalize ALL summary labels to the literal
   "See provision" (`term-cell-seetext` class stays).
2. **Kill the tooltip.** In `shared.js#HoverSource`, render children
   without the popover listeners (keep the component + `quote` prop so
   call sites don't change; body becomes `<Tag className>{children}</Tag>`).
   Keep `EvidenceHoverSource` API intact. Delete the touch handler. Do NOT
   delete the component (50+ call sites).
   – Items 10/13 (evidence quality) remain worth fixing because the same
   resolved quote feeds the expander text where a row-level clause is
   missing; implement 10 first, then 8-stage-2.

**Class:** render-only. **Risk:** medium-high (touches every family;
gate on a full-page visual sweep of all three deals at 1440 + 390 and the
existing table unit tests).

---

## Item 9 — QXO Termination Fees: ~5 near-identical triggers

**Root cause (data mis-coding + render filter too narrow).** Stored
`companyTerminationFee.triggers` on card `fec8549c` has SEVEN entries:
2 direct triggers plus 5 tail sub-limbs of §6.5(b)(iii) whose labels all
end "…followed within 12 months by the Company signing or consummating a
competing Acquisition Proposal…". Only two are coded `TAIL`;
`lib/termf.js:153` drops exactly those, leaving 5 pills:
RECOMMENDATION_CHANGE, NO_VOTE, NO_SOLICIT_BREACH, COMPANY_BREACH,
RECOMMENDATION_CHANGE — Ben's "~5 similar triggers", two of them the same
code. Verified live. (The reverse fee mirrors it.) Tail mechanics are
already rendered by `tail-fee.config.js` from the TERMF-TAIL card, so the
tail limbs are pure duplication here.

**Fix (render-first).** In `lib/termf.js#parseTriggerStrings` (:135-170):
1. Extend the tail filter at :153 to also catch tail limbs by phrasing:
   `code === 'TAIL' || /^\s*tail[\s-]*fee\b/i.test(label || s) ||
   /followed\s+within\s+\d+\s+months|within\s+\d+\s+months[\s\S]{0,120}?(?:acquisition|takeover|competing)\s+proposal/i.test(label || s)`.
2. Dedupe the surviving triggers per fee by `code` (keep first;
   codeless entries dedupe by `name`).
3. Add the QXO trigger array to `lib/termf` tests (it's unit-tested).
Expected result: Company fee shows $600,000,000 + 2 triggers (COR-change /
no-vote), matching the tail table below.
4. **Data repair (optional, if Ben wants clean storage):** the five
   §6.5(b)(iii) limbs should have been coded `TAIL` at extraction. A
   per-type `scripts/reprocess.js` refresh of TERMINATION_FEE on QXO
   re-extracts them; not required once the filter lands — say so in the PR.

**Class:** render-only fix over mis-coded data (optional data repair).
**Risk:** low.

---

## Item 10 — Tagged-list pill hover shows the START of the whole definition, not the item's own extract

**Root cause (shared evidence-resolution path, three layers).** Stored
tagged items are `{code, label, text, quotes: []}` with per-item verbatim
in `.text` and `quotes` almost always an EMPTY array.
1. `lib/citable.js:73-81` — `isCitableValue()` requires a `value` key and
   NO `code` key → tagged items are never "citable", so
   `getCitableText(item)` → null.
2. `lib/citable.js:90-103` — even for citable wrappers,
   `getCitableQuotes()` returns the (empty) `quotes` array WITHOUT falling
   through to `.text` when `quotes` is `[]` — the fall-through only fires
   when `quotes` is absent.
3. `ProvisionTablePrimitives.jsx:31-38` — `evidenceQuote()` then falls all
   the way to `source.primary_quote || source.region_full_text` = the head
   of the whole card/definition. `HoverSource` additionally truncates to
   `TOOLTIP_MAX` from the START (`shared.js:209`), so long definitions
   always show their opening boilerplate.
4. `components/review-v2/MaeSection.jsx:89-92` — `itemQuote()` reads ONLY
   `item.quotes[0]`, ignores `item.text`, then the call sites (:207, :219)
   fall back to `row.evidence` (the full MAE definition clause). This is
   the exact carve-out-pill case Ben saw.

**Fix (render-only).**
1. `lib/citable.js#getCitableQuotes`: when the quotes array normalizes to
   empty, fall through to the `.text` branch (move the `.text` check after
   the array branch's empty result).
2. Add `export function getTaggedItemQuote(item)` in `lib/citable.js`:
   `quotes[0]` (non-empty) → `.text` when it is a non-echo (trimmed text
   !== code and !== label) → null. Use it in
   `ProvisionTablePrimitives.jsx#evidenceQuote` between the citable check
   and the array/`source` fallbacks: `if (isTaggedItem(value)) { const q =
   getTaggedItemQuote(value); if (q) return q; }`.
3. `MaeSection.jsx#itemQuote`: `return item.quotes[0] || nonEchoText(item)`
   (same rule), keeping `row.evidence` as the LAST resort only (per Ben:
   fall back to the definition head ONLY when the item has no text).
4. Corpus-wide: this one shared path fixes every pill that passes the
   tagged item as `value` (COR items, IOC exception pills already pass
   explicit per-item evidence — `ioc-exceptions.config.js:117` — and are
   unaffected). Audit remaining call sites that pass card-level `evidence`
   explicitly while holding a tagged item (grep `evidence: textOf(` in
   table-configs) and switch them to per-item where the item is tagged.
5. **Data gap note:** items with genuinely missing `.text` (e.g. some
   backfilled lists) still show the definition head — acceptable per spec;
   no data repair required now. If QA later wants per-item quotes
   everywhere, that's an extraction-prompt change (Fable-owned), out of
   scope here.

**Class:** render-only. **Risk:** low-medium (evidence popovers/expander
text change app-wide; spot-check MAE carve-outs, IOC, COR, material-
contract buckets on all three deals).

---

## Item 11 — Theravance Equity Awards "all wrong": prose dumps instead of pills

**Root cause (data shape → untreated render branch).** Theravance's
CONSID-EQUITY card `b1514608` stores `equityAwardTreatment` as a SINGLE
tagged value (`{code: null, text: "...", quotes:[...]}`), not a keyed
per-instrument map → `instrumentTreatmentEntries()` returns [] → shape-3
legacy branch (`equity-awards.config.js:336-368`). That branch renders
`valueText(inst)` / `valueText(treatment)` — and `valueText`
(card-utils.js:44-47) joins `label: text`, producing "Stock Options: Each
Company Option, whether vested or unvested, that is outstanding…" and
871-char "Cashed Out at Spread: will, at the Effective Time, be canceled…"
cells. Verified live. QXO/Metsera render pills because their cards carry
the keyed map (shape 1).

**Fix (render-only — shape 3 gets the same pill treatment as shape 1).**
In the shape-3 row builder (:348-367):
1. **Instrument cell:** label only — `INSTRUMENT_KEY_META` label for the
   resolved code, else `inst.label`, else `valueText(inst)` split before
   the first ": ". Never append `.text` (it stays as the row/cell
   evidence).
2. **Consideration/Vesting cells:** resolve a pill label + tone, in
   priority order: (a) map the matched entry's own canonical code —
   treatments: `CASHED_OUT_SPREAD`→CASH meta, `CASHED_OUT`/
   `CASHED_OUT_AT_MERGER_CONSIDERATION`→CASH, `ASSUMED_BY_BUYER`→STOCK,
   `CANCELLED_NO_CONSIDERATION`→CANCELLATION; vesting:
   `FULLY_ACCELERATED`→FULLY_VESTED_ACCELERATED, `NO_ACCELERATION`→new
   meta `{label: 'No acceleration', tone: 'neutral'}`,
   `TIME_BASED_VESTING`→CONTINUED_VESTING,
   `PERFORMANCE_DEEMED_ACHIEVED`→new meta `{label: 'Performance deemed
   achieved (at target)', tone: 'info'}`; (b) unknown code → run
   `classifyConsiderationType`/`classifyVestingTreatment` over the entry's
   `.text`; (c) still nothing → the entry's short `label` string alone
   (never `.text`). Render via the existing `pill()` with the entry `.text`
   as evidence.
3. Shape-2 single-instrument branch (:317-334) has the same `valueText`
   leak — apply the same label-only + code-mapping rule there.
4. Fixtures: add the Theravance card's feature JSON to the config tests;
   acceptance: 4 rows (Options / PSUs / RSUs / ESPP-last), every cell a
   short pill, CVR column "Must be in the money at closing" on Options.

**Class:** render-only. **Risk:** medium (touch also affects other legacy-
shape deals — run the equity table on the whole corpus via existing tests/
spot-check Skechers, which the mention-pairing comments call out).

---

## Item 12 — "since the Applicable Date" should show the actual date

**Root cause (data stores the raw phrase; the resolving fact exists
elsewhere on the deal).** REP-T-PREAMBLE stores
`secFilingsExceptionLookback = "since the Applicable Date"`; the cut-off
pill renders it verbatim (`representations-qualifiers.config.js:431-455`
builds `secCutoff`; rendered at :609/:615). The date IS on the deal:
REP-T-SEC's and DEF-GENERAL's clause text contains
`…the U.S. Securities and Exchange Commission (the "SEC") since
January 1, 2024 (the "Applicable Date")…`. Verified in stored card text.

**Fix (render resolution; no new extraction).** In
`buildGeneralExceptionsRow` (or a small helper next to it):
1. If `cutoff` matches `/\bthe\s+([A-Z][A-Za-z ]*?Date)\b/` AND contains no
   literal date (`/\b(19|20)\d{2}\b|January|February|…/` guard), scan all
   deal cards' `textOf()` (and `definitions[].defined_value`) for
   `since\s+([A-Z][a-z]+ \d{1,2}, \d{4})\s*\(the\s+["“]<Term>["”]\)` (also
   accept `means <date>` definition shapes).
2. On a hit, render the pill as
   `since Jan 1, 2024 (the "Applicable Date")` and set
   `secCutoffQuote` to the resolving sentence so the evidence shows the
   definition, not the preamble.
3. No hit → current behavior (raw phrase). Unit-test with the Theravance
   REP-T-SEC sentence. This helper is generic — any `"the <X> Date"`
   lookback resolves the same way.
4. **Data option (later):** adding `secFilingsExceptionLookbackISO` to the
   extraction schema is the durable fix, but it's an extraction-prompt
   change (Fable-owned per CLAUDE.md) — do NOT bundle it here.

**Class:** render-only. **Risk:** low.

---

## Item 13 — Qualifier mouseover needs surrounding context tying the quote to its rep

**Root cause.** `HoverSource` (`shared.js:197-…`) shows a bare quote,
head-truncated at `TOOLTIP_MAX` (:209), with no indication of WHICH rep the
quote belongs to; rep-qualifier pills pass the full clause
(`representations-qualifiers.config.js:171` `evidence:
textOfValue(hit.value) || textOf(card)`), so the popover often opens on the
rep's opening boilerplate.

**Fix (extends Item 10; if Item 8 stage-2 kills the tooltip, apply the same
to the expander body).**
1. Add optional `sourceLabel` prop to `HoverSource`/`EvidenceHoverSource`:
   rendered as a non-italic bold first line in the popover
   (e.g. "§3.6 Compliance — MAE qualifier"). `EvidenceHoverSource` derives
   it from `source.short_title` + the pill's own label when both exist;
   rep call sites pass the row's rep label explicitly.
2. Center the excerpt on the match: when `highlight` is set and the quote
   exceeds `TOOLTIP_MAX`, run `focusSnippet(quote, highlight)`
   (`lib/citable.js:117` — already exists, currently unused here) before
   truncation so the qualifier language is visible with surrounding text,
   instead of the head of the clause.

**Class:** render-only. **Risk:** low.

---

## Item 14 — Theravance "Company Takeover Proposal": Trigger 20% AND Trigger 80%

**Root cause (render — over-eager % harvesting).** Verified against the
stored NOSOL-ACQPROPOSAL clause: limbs (1)-(4) all use "**20% or more**" of
revenues/assets/voting power; the **80%** appears only in clause (4)'s
continuity-of-ownership carve — "…in which the shareholders of the Company
immediately prior to such transaction will not own, directly or indirectly,
at least 80% of the surviving company…". That is a definitional carve-out,
not an acquisition trigger. `extractPctTriggers`
(`nosol-section.config.js:267-276`) harvests EVERY `NN%` in the clause →
both chips render as "Trigger: 20%" / "Trigger: 80%".

**Fix.** Restrict the trigger pattern to the trigger phrasing:
`/(\d{1,3})\s*%\s+or\s+more/gi` (covers every real trigger limb here and on
Metsera/QXO — verify QXO's definition still yields its trigger chip). Do
not chip other percentages. Optional (nice-to-have): render the continuity
carve as part of the existing `Excludes:` chip only if
`extractExclusionTail` already catches it — do not build new synthesis.
Unit-test with the Theravance clause.

**Class:** render-only. **Risk:** low.

---

## Item 15 — Theravance: "14d-9 / 14e-2 stop-look-listen compliance" pill repeated

**Root cause (render — many-to-one summarization without label dedup).**
NOSOL-RECOMMEND's `notChangeOfRecommendationItems` has three DISTINCT
verbatims; items 1 ("stop-look-and-listen … Rule 14d-9(f)") and 3 ("a
position contemplated by Rule 14d-9, Rule 14e-2(a) or Item 1012 of
Regulation M-A") BOTH match `NOT_COR_SPECS[0]`
(`nosol-fiduciary.config.js:261`) → the same label
"14d-9 / 14e-2 stop-look-listen compliance" renders twice. (QXO showed the
same live — see Item 6 dump.) Not a data bug: the verbatims are genuinely
different clauses; the LABELS collide.

**Fix.** Same change as Item 6 step 1-2: in `corItemsRow`, after mapping,
dedupe by final rendered label (case-insensitive), keeping the first and
(optionally) concatenating the collided verbatims into that pill's
evidence so nothing is lost. One dedup implementation serves items 6 and
15 — implement once.

**Class:** render-only. **Risk:** low.

---

## Item 16 — Junk-looking list entries ("Indemnification, regulatory, foreign regulatory findings"; stray "wise")

**Findings (partially reproduced; DB degraded before full live sweep).**
1. **Fragment defined terms — CONFIRMED stored-data junk.** Theravance's
   definitions include fragment terms minted by ingestion:
   `"from"`, `"to the extent"`, `"made available"`,
   `"under common control with"`, lowercase `"knowledge"`. These render in
   the Definitions section/index. Ben's stray "wise" is this same class (a
   mid-word/mid-phrase capture from "otherwise"/"likewise"); it is not in
   Theravance's current stored terms, so it likely lives on another deal or
   pre-reprocess data — the filter below kills it corpus-wide regardless.
2. **"Indemnification, regulatory, foreign regulatory …" — best-supported
   reading:** the per-section provision index. Theravance's section list
   contains `6.1 | Foreign Regulatory Approvals`,
   `6.1 | Information to Regulators` **twice** (two cards, `5eea8833…` and
   `a2e67986…`, same title+section), `6.1 | Litigation Against Regulators`,
   `6.1 | Regulatory Filing Deadline`, and `6.10 | D&O Indemnification and
   Insurance` — read out as a list this matches the dictation almost
   word-for-word ("findings" ≈ "filings"). The duplicate
   "Information to Regulators" is stored-data duplication (two cards for
   one provision).

**Fix.**
1. **Render filter for fragment definitions** (defensive, corpus-wide): in
   the definitions render path (`ClauseSidebar.jsx` / the `__definitions`
   section builder in `pages/review/[id].js`), drop entries whose
   `defined_term` starts lowercase, OR is a bare stopword phrase
   (blocklist: from, to the extent, made available, under common control
   with, wise, likewise, otherwise), OR is shorter than 3 characters.
   Keep genuinely-lowercase terms of art only via an allowlist if Ben
   objects (start without one).
2. **Dedupe the per-section provision index** by
   `(section_ref number, short_title)` keeping the card with the longer
   text — locate the index builder (`groupCardsBySection` /
   `ProvisionIndex.jsx`) and dedupe at render.
3. **Data repair:** the fragment DEFINITION cards and the duplicated
   ANTI-INFO card are stored rows. Spec a small
   `scripts/cleanup-fragment-definitions.js` (dry-run flag, prints deal +
   term, deletes on `--apply`): fragment rule as in (1) plus
   same-deal same-(section_ref, short_title, provision_subtype) duplicate
   collapse for non-DEFINITION cards. Gate through ingest-qa before apply.
4. **Verify live** (blocked this session by DB degradation): open
   Theravance at 1440px, confirm which visible list Ben meant, and that
   (1)+(2) clear it. If the junk list turns out to be elsewhere (e.g. an
   IOC pill list), the fragment filter in (1) still applies — recheck
   before closing the item.

**Class:** render filter + data repair script. **Risk:** low (filter),
medium (deletion script — dry-run + ingest-qa gate mandatory).

---

## Implementation gates (per CLAUDE.md watchdog protocol)

- `npm test` + `npm run build` after every item; items touching
  table-config row shapes have existing unit specs — extend fixtures as
  noted (items 1c, 5, 7, 9, 11, 12, 14, 15).
- Live verification on the dev server for every render item at 1440px AND
  390px, all three deals (Metsera / QXO / Theravance). Note: dev Supabase
  was intermittently 500ing at 60-90s latency at the end of this session —
  restart `npm run dev` and retry before concluding anything is broken.
- Item 16's deletion script: dry-run output reviewed by Fable before
  `--apply`; `scripts/ingest-qa.js` gates after.
- Suggested batching for implementers: (A) 1a+1c+2+4+5+7+14 (small,
  independent); (B) 6+15 (one dedup), 9 (termf), 12 (resolver); (C) 10+13
  (evidence path), then 8 (placement+tooltip kill) LAST, then 3 (width
  system) with a full visual sweep; 11 alone (equity shape-3); 16 filter
  then script.

## Summary table

| # | Item | Root-cause class | Fix location | Risk |
|---|------|------------------|--------------|------|
| 1a | Outside Date in Structure | render config (deliberate round-2 fold-in, now reversed) | components/review-v2/sectionList.js:162-185 (delete outside block); termination-rights already covers it | low |
| 1b | Closing timing "lost" | not lost — verified rendering; drowned by 1a/1c verbosity | none (verify after 1a/1c) | – |
| 1c | Effective time text dump | render config (clause-first tier order) | structure-mechanics.config.js:72-94 | low-med |
| 2 | Equity column widths unequal | render config (no widths, auto layout) | equity-awards.config.js:445-459 + ProvisionTable.jsx fixedLayout | low |
| 3 | Cross-table width jitter | render config (3 competing width systems) | ProvisionTable.jsx, representations-qualifiers.config.js:593/663, ProvisionTablePrimitives.jsx:208, MaeSection.jsx | med |
| 4 | Masthead "Metsera $7.0B" serif | render config (hidden sm:flex acquirer; mtx-serif compact value) | components/review-v2/DealHeader.jsx:131,155,179-183 | low |
| 5 | QXO PSU/RSU rows twice | render config (RSUS/PSUS vs RSU/PSU code mismatch) + classifier gaps | equity-awards.config.js:252-276, 185-206, 341-345 | low |
| 6 | QXO COR items repeated | data duplication across 2 cards + text-keyed render dedup | nosol-fiduciary.config.js:271-319 (dedupe by code) | low |
| 7 | QXO parent approvals raw dump | render config (fallback pattern too narrow) | votes-approvals-meeting.config.js:160-181 | low |
| 8 | See provision placement + tooltip | render config (plan partially shipped) | ProvisionTable.jsx, shared.js HoverSource, nosol/MaeSection/reps see-text nodes | med-high |
| 9 | QXO ~5 similar termf triggers | data mis-coding (tail limbs not TAIL) + narrow render filter | lib/termf.js:135-170 (filter + code dedup); optional reprocess | low |
| 10 | Pill hover shows definition head | render (shared evidence path ignores tagged .text; quotes:[] short-circuit) | lib/citable.js:73-103, ProvisionTablePrimitives.jsx:31-38, MaeSection.jsx:89-92 | low-med |
| 11 | Theravance equity prose rows | data shape 3 + render branch inlining valueText | equity-awards.config.js:317-368 | med |
| 12 | "since the Applicable Date" | data stores raw phrase; resolvable from deal's own text | representations-qualifiers.config.js:431-455 (+resolver helper) | low |
| 13 | Qualifier popover lacks context | render (head-truncated bare quote) | shared.js HoverSource (+sourceLabel, focusSnippet) | low |
| 14 | Takeover Proposal 20% + 80% | render (harvests every %) | nosol-section.config.js:267-276 ("% or more" only) | low |
| 15 | 14d-9 pill twice | render (label collision, no label dedup) | nosol-fiduciary.config.js:307-319 (same dedup as #6) | low |
| 16 | Junk list entries | data (fragment definition cards; duplicate ANTI-INFO card) + missing render filter | definitions render filter; provision-index dedupe; new scripts/cleanup-fragment-definitions.js | low-med |
