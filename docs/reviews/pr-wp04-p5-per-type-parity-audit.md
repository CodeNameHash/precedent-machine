# WP04 P5: Per-Type vs All-Types Extraction Parity Audit

## Scope

Audited `lib/parser-v2/extract.js` and `lib/parser-v2/run-extract.js` for differences between:

- full all-types extraction: `extractProvisions(...)`
- single type re-extraction: `extractProvisionsForType(...)` plus `runExtractTypePhase(...)`

No production reprocess was run.

## Finding

The split is mostly intentional:

- strategy-level parsing/splitting is shared by both paths;
- CONSID and REP-T have explicit per-type parity backfills;
- true cross-type post-passes remain all-types only, as `run-extract.js` states at lines 79-82.

One area deserves future tightening: per-type validation can add `OTHER` orphan rows for a requested type group, and `storeProvisionsForType` will insert those rows while deleting only the requested type group. That can leave stale older `OTHER` rows because `OTHER` is not part of the delete set.

## Shared Strategy-Local Helpers

These run inside strategies used by both all-types and per-type paths, so no separate parity work is needed:

- `splitSubClauses`
- `splitConflatedCondPart`
- `splitOfferConditionAnnex`
- `splitTermrSubClauseRomans`
- `splitIocPreamble`
- `deriveIocLimbEffortsStandard`
- `normalizeTermrParty`
- `splitDefinitions`
- `splitUmbrellaRepSections`
- `extractTitledSubclauses`

## Per-Type Safe / Mirrored

These are already mirrored in `extractProvisionsForType` or `runExtractTypePhase`:

- `expandTypeGroup`: shared grouping for IOC, TERMR, COND.
- DEF inline definitions: `extractInlineDefinitionsFromSections` is called when type is `DEF`.
- DEF ordering: `sortDefinitionsAlphabetically`.
- CONSID repair path: `backfillMissingInstrumentMentions`, `expandConsidEquityByInstrument`, `backfillCvrMaxFromExhibit`.
- REP-T local repair: `splitUndisclosedLiabilitiesFromFinStmt`.
- REP-T material-contract bucket repair: `provisionsWithMaterialContractsDefinitionFromText` plus `stampMaterialContractsBucketsFromDefinitions`, using full agreement text when the DEF row is absent from a standalone REP-T run.
- Code normalisation: `enforceCanonicalCodes` and `consolidateProposedCodes` run in `runExtractTypePhase`.
- Validation shape checks and citable wrapping: `validateProvisions`.
- Human correction reapply: `reapplyCorrections` runs after store in the per-type orchestrator.

## Cross-Type Only By Design

These need provisions from multiple families and should stay out of bare per-type extraction unless the orchestrator preloads the dependent families:

- `linkDefinitionCrossReferences`: DEF to every referencing provision.
- `linkBringDownToReps`: COND-B/COND-S rep bring-down tiers to REP-T/REP-B rows.
- `linkKnowledgeScopeToReps`: DEF Knowledge terms to knowledge-qualified REP-T/REP-B rows.
- `linkMaterialityScopeToReps`: local to REP rows but currently runs in the all-types post-pass only. Low-risk candidate for per-type mirroring for `REP-T` and `REP-B`.
- `normalizeIocLimbEffortsStandards`: local to IOC rows but currently all-types only. Candidate for per-type mirroring for `IOC`.
- `stampIocRestrictionComponents`: local to IOC rows but currently all-types only. Candidate for per-type mirroring for `IOC`.
- `linkWillfulBreachDefinition`: DEF Willful Breach to MISC rows.
- `linkStockholderApprovalDefinition`: DEF Company Stockholder Approval to COND-M-STOCKHOLDER.
- `resolveCondCitedProvisionNames`: COND cite strings to REP provision names.
- `stampMaterialContractsBucketsFromDefinitions`: cross-type in full extraction, but covered by the REP-T full-text fallback in per-type.
- `resolveAocCovenantCitations`: REP AoC covenant cites to IOC names, and it intentionally runs after code enforcement.
- `computeOutsideDateMonths`: needs `dealMeta.signingDate`; per-type does not pass deal metadata. Candidate for per-type TERMR parity if `runExtractTypePhase` threads signing date.
- `backfillSectionLeftovers`: full extraction only. Per-type validation instead has a coarser orphan-section `OTHER` backfill.

## Ambiguous / Follow-Up

1. `validateProvisions` can add `OTHER` rows during a per-type run.

   In `runExtractTypePhase`, validation receives only the requested type sections, then `storeProvisionsForType` deletes only the requested type group but inserts every validated row. If validation backfills an orphan as `OTHER`, that inserted `OTHER` is not removed by a future run of the same type. Recommendation: either disable orphan `OTHER` insertion for per-type runs, or make `storeProvisionsForType` filter insertions to `expandTypeGroup(type)`.

2. Local post-passes should be mirrored where safe.

   `linkMaterialityScopeToReps`, `normalizeIocLimbEffortsStandards`, `stampIocRestrictionComponents`, and `computeOutsideDateMonths` do not require the whole corpus of extracted types except for deal metadata in the last case. Recommendation: mirror them in `extractProvisionsForType` for their own families.

3. `computeOutsideDateMonths` lacks per-type signing-date context.

   `extractProvisionsForType` accepts `fullCleanedText` but not `dealMeta`; `runExtractTypePhase` selects only `id, metadata`. Recommendation: thread `dealMeta.signingDate` from deal metadata / announce date when TERMR per-type parity becomes important.

## Gate

`npm test`: PASS, 667 tests.
