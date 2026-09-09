# Adversarial review of the NCS review page, 2026-09-09

Scope: the page Ben opened at
`/review/product/eaafcac8-790b-41bb-a5e1-b12187a55e7d` (NCS / Weatherford,
revision 0). Ben reported three things: 1,672 items is too many; near-identical
cards repeat; clicking a role such as "shall be liable" highlights the whole
provision; and it is unclear what a reader will finally be shown.

Evidence limit: this review was made from the code that renders the page on
`codex/product-implementation-plan-20260904` at `f53d0e5`, the extraction
prompt, the legal schema and the recorded run counts. The private database
and the signed-in page were not reachable from this session, so the item
breakdown for NCS is inferred from the code path and the Olaplex record
(816 proposals + 135 relationships = 1,348 items). Nothing was accepted,
rejected, edited, saved or published.

## Findings, most important first

### 1. Role clicks do not cite the role. They cite citation 1 of the fact.

`components/product/ProposalCard.jsx` wires the statement, every role value
("Legal actor", "Legal operation", "Qualifications" and so on) and the
canonical value to the same handler, `openPrimarySource`. That handler calls
`primaryProposalSource`, which returns `savedSourceSpanIds[0]`. There is no
per-role span in the data model: `lib/product/agreement-draft.js` creates one
`SUPPORTING_EVIDENCE` span per model evidence quote, and the prompt tells the
model that "every selected evidence quote set must support every material part
of the proposal statement and roles". The model therefore quotes the whole
sentence, and every role click highlights that sentence.

So the answer to "is the source actually thinking it's the whole thing" is
yes: the stored citation is the whole sentence. The role-level links are a UI
affordance that promises word-level precision the data does not hold. Where a
fact has several citations, a role click always opens citation 1 even when
citation 3 is the one that supports that role.

Recommendation: remove the per-role source buttons, or label the one link
honestly ("Source sentence"). Either change is presentation only.

### 2. The schema declares everything material, so boilerplate becomes facts.

`contracts/product/legal-schema.v1.json` gives 22 of 25 families the same
generated rule: "Every independently operative … provision is material. Every
condition, exception, threshold, timing rule and cross-family dependency that
changes its legal effect is material." The full family object, including that
rule, is sent to the model as `family_contracts`. The extraction instruction
then says: one proposal per independently operative effect, never combine
sibling limbs, repeat the chapeau qualification in each affected proposal,
"do not stop after the primary covenant", and make a second pass to confirm
every sentence with legal effect is represented.

That is a maximal-atomisation contract with no materiality filter. The
exchange-fund "no liability for property delivered to a public official"
sentence is a case in point: under these rules it is a required fact, and its
proviso, actor list and abandoned-property qualification can each become
another. The 1,672 count is the design working as specified, not a defect in
the run.

This is the "compact omission" decision the plan reserves for Ben (section 11):
which families or subtypes are key-provision material for the reader, and
which are captured only for coverage. It cannot be settled by an agent.

### 3. Repetition is prompted, and grouping is not shown.

The prompt requires the model to "repeat a parent or chapeau qualification in
each affected proposal when needed" and to preserve every qualifier in both
the statement and the roles. A section with one chapeau and six limbs yields
six cards that each restate the chapeau. Proposition groups exist in the data
(`proposition_group_id`) but the page renders one flat card per proposal per
section; the group appears only as a small "Original AI group, for context"
list under each card. Nothing is rendered once per group.

### 4. The reader view is the same atomised list, minus the roles.

The published output is `compileReviewSummary` in
`lib/product/review-state.js`, rendered by the accepted-summary block in
`components/product/ReviewWorkspace.jsx`. It lists every accepted fact under
its family heading as one card: statement, subtype and fact type labels, and
citation buttons. It does not compose facts into the family's
`summary_grammar` sentence, does not render proposition groups as one effect,
and does not order by agreement section. `summary_grammar` and
`compact_omissions` are validated for presence in `lib/product/legal-schema.js`
and otherwise unused by rendering code.

So the answer to "what is the reader shown" is: a per-family list of 1,000-odd
one-sentence statements, in review-item-id order. The plan's section 1 promise
of "a complete, usable summary" is not met by that renderer.

### 5. Every one of the 1,672 items must be individually decided before publication.

`can_publish` in `lib/product/review-view.js` requires no item to be PENDING
or UNRESOLVED. Items include every proposal, every model relationship, every
issue, every unresolved or NOT_FOUND coverage assertion, and every immaterial
routing. There is no bulk accept per section or group and no ordering by
materiality. At a few seconds each this is many hours of clicking before the
legal review even starts.

### 6. Smaller presentation defects

- The whole agreement renders as one page: 104 sections and about 1,039 cards
  in one DOM. The section selector helps navigation but not load or focus.
- The source panel header and highlight label show byte offsets
  ("bytes 41230-41612"). These are developer diagnostics, not reader content.
- "Citation 1 of N" on a role does not say which citation supports the role.
- The statement text itself is the source button, so a reader cannot select
  or copy a statement without opening the source panel.

## What is safe to change now, and what is Ben's call

Presentation only, no stored content, prompt or model change, checkable with
the existing display tests (`tests/product-review-ui-presentation.test.js`,
`tests/product-held-issue-ui.test.js`, `tests/product-review-first-load.test.js`):

- One honest source link per fact instead of a link on every role (finding 1).
- Render a proposition group as one block with its member facts beneath it,
  and show the group's shared qualification once (finding 3, display half).
- Bulk decisions per section or group: accept all, reject all, with the
  existing per-item audit trail unchanged (finding 5).
- Section-scoped or paged rendering; byte offsets moved behind the existing
  "Show recorded detail" pattern (finding 6).

Ben's decisions, needed before any extraction or prompt change and before
another agreement run:

1. Materiality: which families and subtypes are reader-facing key provisions,
   and which are coverage-only. Candidates for coverage-only on the current
   evidence: exchange-fund mechanics and no-liability savings clauses inside
   CONSIDERATION / EXCHANGE_MECHANICS, and most of MISC_BOILERPLATE. This is a
   compact-omission decision under plan section 11.
2. Granularity: whether the reader-facing unit is the proposition group (one
   legal effect, one composed sentence per `summary_grammar`) with atomic
   facts retained beneath it for citation, rather than one card per atomic
   fact.
3. Whether coverage-only facts still need individual lawyer decisions before
   publication, or a section-level confirmation suffices.

A prompt or schema change made on the back of 1 or 2 is a material change
under the testing rule and needs an untouched agreement afterwards; the four
already-processed agreements remain the review set until then.

## Exact question for Ben

For the NCS review, do you want to (a) review the full 1,672-item draft as it
stands, or (b) have the page restructured first to one block per proposition
group with per-section bulk decisions, and defer the materiality decision in
item 1 above until you have seen a restructured section? Option (b) is
presentation only and changes no stored content.
