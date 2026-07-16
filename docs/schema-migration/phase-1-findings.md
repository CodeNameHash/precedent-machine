# WP-SCHEMA P1 Findings

## Executive Finding

The current codebase has 517 feature-like keys across rubric schemas, taxonomy feature mappings, expected-set helpers, summary table specs, validation infrastructure, and review UI references.
Of those, 473 appear in at least two source families, while 44 appear in only one source family and need drift review before deletion.

## Drift Signals

- Strict cross-source type mismatches found: 6.
- Broader schema shape mismatches found: 33.
- Only the rubric currently declares value type in a systematic way; a zero mismatch count here is not proof of no drift.
- UI-only feature-like keys found: 11. These are the highest-risk missing-schema candidates.
- Curated expected-set codes found: 38. These are code bundles, not direct feature definitions.

## Naming Convention Distribution

| Convention |Count |
| --- |--- |
| camelCase |486 |
| lowercase |24 |
| snake_case |7 |

Recommendation for Phase 3: use camelCase for canonical `FeatureDef.key`, because existing provision `features` JSON already mostly uses camelCase and that minimises storage-key churn.

## Top 20 Highest-Appearance Keys

| Key |Appearances |Sources |
| --- |--- |--- |
| mainConcept |110 |expected_sets_js, feature_validation_js, rubric_js, ui |
| scheduleReference |28 |category_summary_features_js, expected_sets_js, feature_validation_js, rubric_js |
| materialityQualifier |25 |category_summary_features_js, expected_sets_js, feature_validation_js, rubric_js, taxonomy_js, ui |
| crossReferences |23 |expected_sets_js, feature_validation_js, rubric_js |
| noOtherRepsParty |21 |expected_sets_js, feature_validation_js, rubric_js, ui |
| partyWhoCanTerminate |21 |category_summary_features_js, expected_sets_js, feature_validation_js, rubric_js, taxonomy_js |
| extraContractualClaimsWaived |20 |expected_sets_js, feature_validation_js, rubric_js |
| fraudCarveout |20 |expected_sets_js, feature_validation_js, rubric_js |
| nonRelianceClause |20 |expected_sets_js, feature_validation_js, rubric_js |
| noOtherRepsPresent |20 |expected_sets_js, feature_validation_js, rubric_js |
| bringDownStandard |19 |category_summary_features_js, expected_sets_js, feature_validation_js, rubric_js, taxonomy_js |
| knowledgeScope |18 |expected_sets_js, feature_validation_js, rubric_js, ui |
| linkedBringDownStandard |18 |expected_sets_js, feature_validation_js, rubric_js, taxonomy_js |
| knowledgeQualifier |17 |expected_sets_js, feature_validation_js, rubric_js, ui |
| materialContractsBuckets |17 |expected_sets_js, feature_validation_js, rubric_js, taxonomy_js, ui |
| materialityScrape |17 |expected_sets_js, feature_validation_js, rubric_js, taxonomy_js |
| knowledgeScopeType |16 |expected_sets_js, feature_validation_js, rubric_js |
| mainCondition |16 |expected_sets_js, feature_validation_js, rubric_js, ui |
| materialContractsDollarThresholds |16 |expected_sets_js, feature_validation_js, rubric_js, ui |
| materialityScopeType |16 |expected_sets_js, feature_validation_js, rubric_js |

## Missing-Feature Patterns To Audit In Phase 3

- UI-only feature-like keys should be checked against live `features` JSONB before Phase 3 registry population:
  - alsoSurfacedAs
  - cashAmount
  - chapeauProviso
  - closingDeadline
  - partOfRep
  - proviso
  - region_id
  - regionId
  - section_number
  - source_section
  - triggerTerminationClauses
- Raw enum display and ambiguous empty states should be mapped to schema formatter and `whenEmpty` fields in later phases.
- Any key in one source family only should be treated as an orphan candidate, not deleted without Supabase usage checks.

## Phase 3 Inputs

- Use `docs/schema-migration/inventory.jsonl` as the machine-readable input for registry generation.
- Use `docs/schema-migration/source-inventory.json` for provision types, canonical codes, taxonomy families, and expected-set code bundles.
- Treat `category_summary_features_js` labels as good UI label hints, but not as authoritative schema shape.
- Treat `feature_validation_js` as generic coverage through `getFeaturesForType`, not as a separate feature-type authority.
