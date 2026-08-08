# Diff review — the seven UNREVIEWED/wip commits

Reviewer: Fable (main loop). Date: 2026-08-08. Branch reviewed:
`claude/codex-handoff-plan-status-77wn7n`, commits `66353edf` through
`8eeba42c`. This closes merge blocker 2 of Step 2X-0, subject to one
remediation recorded below. Every commit was read as a diff against its own
stated criteria, looking hardest at what each diff does not do.

## Verdicts

### 66353edf — derive EITHER_PARTY termination scope from role aliases: PASS

`terminationPartyScopeFromRoleAlias` reads the leading token through the V1
alias table (`lib/vocab/party-role-aliases.js`), consumed not re-invented,
and deliberately derives `EITHER_PARTY` or nothing — never `ONE_PARTY`,
because a single-sided alias hit says which side is named first, not that
the right is one-sided. Provenance attributes threaded onto three further
claim shapes. Fail-closed, provenance-carrying, evidence recorded
(termination-fee-resolution 78/78 with the exact command).

### cceb940e — the inheritance-fix checkpoint: PASS, two notes

All five source changes implement rulings that were in force when written,
each with matching hostile tests:

- `ioc-corroboration.js` second chance: exactly the 2X-B discipline —
  fires only on a primary miss, primary path byte-identical, `V1_ONLY`
  sentinel makes an unmapped V1 hit a competing hit that refuses, typed
  `corroboration_provenance`. Hostile test covers all three refusal shapes.
- `mae-clause-label-parse.js` tier 4: structural containment via
  `segmentSubClauses`, single coordinate space (string indices in, nothing
  exported), refuses on ambiguous labels, non-unique quotes, out-of-span.
- `maeDefinedTermScopeText`: definition-scoped verification for bilateral
  MAE definitions (SkyWater's twinned carve-outs), anchors must equal 1,
  strictly additive over the whole-section check.
- `composeQualifierHostClassification`: host+qualifier composition only for
  `UNCLASSIFIED` (never `DISAGREEMENT`), fail-closed at six separate steps,
  derived code carries `HOST_COMPOSED_BRING_DOWN_INFERENCE` provenance.
- (QUALIFIER, ACCURACY, ITEM) table entry with the pathless-ITEM refusal
  (`ACCURACY_ITEM_ATTACHED_NOT_REP_LEVEL`) — Ben's attach-to-host ruling
  honoured mechanically.

Notes: (1) the `MAT_MAE_AGGREGATE` additions in this commit (lexicon v3
front door, contract-bundle V41 widening) implement the never-alias ruling
that Ben reversed later the same day — Step 2X-D retires them; that is a
decided follow-up, not a defect of this diff. (2) The comment in
`composeQualifierHostClassification` that only CAPITALISATION emits
LIMB_ASSERTION candidates becomes stale when 2X-L lands; behaviourally the
composition path stays CAPITALISATION-only because REPRESENTATIONS
qualifiers mint under their own claim key.

### fc0362bb — final termination grammar extensions: PASS WITH A GAP

Three changes: the section-chapeau mutual grant tier
(`TERMINATION_SECTION_EITHER_GRANT_PATTERN` +
`findTerminationSectionEitherGrantContext`, for TopBuild 6.2's real
drafting), a widened `TERMINATION_LIMB_BARE_BY_PATTERN` (terminator
requirement dropped, mutual heads still excluded by lookahead), and the
terminal-leaf bound in `findTerminationLimbChapeau` (newline/section-end
fallback, for Concho 8.1(f)). The new tier's own fail-closed discipline is
right: capacity comparison, colon required, grant must precede the trigger
span, claimed ref must appear verbatim in the grant text.

**The gap: none of the three behaviours has a unit test.**
`tests/canonical-v2-termination-limb-grant-context.test.js` covers the two
pre-existing limb-head grammars only. And the widened bare-by pattern has a
plausible false positive: a limb head naming a compound party ("by the
Company Stockholders' Representative…") now matches with the party read as
"the Company" — the old terminator lookahead rejected it. Downstream
capacity comparison mitigates but does not eliminate it (a model claim of
"Company" would be wrongly corroborated).

**Remediation (required before the code merge):** unit tests for the three
behaviours, plus a fail-closed sharpening of the bare-by pattern against
capitalised continuation of the party name. Tracked as its own commit.

### 684b8c78 + 1137fc38 — subclauses colon rule: PASS

The CHILD-OPEN colon case is deliberately narrow (immediate lead-up only;
prose between colon and bracket fails it), the header documents the exact
negative cases (Redfin §2.10(d)/(h) stay unsplit), tests went 4 → 8, the
four downstream V1 consumers were pinned green (56 tests), and the guard
proof — neutering `isColonIntroduced` fails the Metsera carve-out test —
was run and recorded in 8eeba42c. The known mis-nesting on double
shall-not lists is already recorded as a deciding fact in PLAN Step 2X-A
and is why `findIocChapeau` stays separate; not a defect of this change.

### 39889ca7 + 8eeba42c — absence copy: PASS

2X-E's acceptance verified directly on the tree, not from the commit
messages: zero occurrences of the unsafe "No X found" shapes remain in
`components/review/table-configs/`; every use of `CONDITION_ABSENT_COPY`
is imported (14 uses across 11 files, including the per-cell
`termination-rights.config.js` case the first sweep missed). What the diff
does not do is recorded in the plan as deliberate scope, not silently
narrowed: the NOT_YET_EXTRACTED amber-pill mechanism was not ported because
no other family has a second source to derive it from, and
`NoShopCrossViewPreview.jsx` stays open as its own sibling-consistency fix.
The 2-failure suite run in 8eeba42c was re-run in isolation (3/3) with the
contention explanation recorded; the following commit `8707b2c2` re-ran all
three gates green on a clean tree.

## Disposition

Blocker 2 of Step 2X-0 closes when the fc0362bb remediation lands: three
unit tests plus the bare-by sharpening. Everything else stands as
committed. Live verification (blocker 3) remains open and is tracked
separately.
