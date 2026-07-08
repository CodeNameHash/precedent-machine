# WP-M2-04 Legacy Vocab Deletion Manifest

Generated: 2026-07-08T14:51:29.571Z
Status: audited
Authorization: Review Queue entry authorize-legacy-vocab-deletion approved by Ben on 2026-07-08.
Reference audit SHA-256: 21c08e7d33aaddcd935d34d760e5f5065b3f13cac8d438d99eca5e2b6c302abe

This manifest is conservative: only targets with zero live references are marked `delete`. Targets with any live references are deferred and must not be removed in the deletion PR.

## lib/feature-validation.js

- Semantic role: Legacy adapter around schema validation for provision feature bags.
- Exports audited: validateFeatures, validateProvisionRow, validationSummary, unwrap, INFRA_KEYS
- References remaining: 22
- Codex verdict: unsafe-live-references
- Decision: defer
- Rationale: Live references remain (22); excluded from deletion until callers migrate.
- Reference detail: see `docs/schema-migration/legacy-vocab-references.json`

## lib/expected-sets.js

- Semantic role: Legacy expected-set and taxonomy-growth coverage helper.
- Exports audited: computeExpectedSets, analyzeDealCoverage, analyzeCorpusTaxonomy, familyType, provisionCode, isCanonicalCode, CURATED_CORE, CORE_THRESHOLD, COMMON_THRESHOLD
- References remaining: 19
- Codex verdict: unsafe-live-references
- Decision: defer
- Rationale: Live references remain (19); excluded from deletion until callers migrate.
- Reference detail: see `docs/schema-migration/legacy-vocab-references.json`

## lib/category-summary-features.js

- Semantic role: Legacy per-category summary-table row configuration.
- Exports audited: CATEGORY_SUMMARY_FEATURES
- References remaining: 16
- Codex verdict: unsafe-live-references
- Decision: defer
- Rationale: Live references remain (16); excluded from deletion until callers migrate.
- Reference detail: see `docs/schema-migration/legacy-vocab-references.json`

## lib/taxonomy.js

- Semantic role: Legacy canonical tag dictionaries and feature-key taxonomy resolver.
- Exports audited: taxonomyForFeatureKey, labelForCode, isValidTaxonomyCode, formatDict, normalizeToCode, TERMF_TRIGGER_CODES, MERGER_FORMS, MAE_CARVEOUT_CODES, IOC_CATEGORY_CODES
- References remaining: 35
- Codex verdict: unsafe-live-references
- Decision: defer
- Rationale: Live references remain (35); excluded from deletion until callers migrate.
- Reference detail: see `docs/schema-migration/legacy-vocab-references.json`

## lib/rubric.js

- Semantic role: Legacy provision-type, canonical-code, and feature-schema source.
- Exports audited: PROVISION_TYPES, CODES, FEATURES, CITABLE_FEATURE_KEYS, getCodesForType, isValidCode, findCodeByAlias, getTypeLabel, getFeaturesForType, getFeaturesForCode
- References remaining: 74
- Codex verdict: unsafe-live-references
- Decision: defer
- Rationale: Live references remain (74); excluded from deletion until callers migrate.
- Reference detail: see `docs/schema-migration/legacy-vocab-references.json`

## lib/vocab/party-role-aliases.js

- Semantic role: Legacy alias map for frozen party-role vocabulary normalisation.
- Exports audited: PARTY_ROLE_ALIASES
- References remaining: 4
- Codex verdict: unsafe-live-references
- Decision: defer
- Rationale: Live references remain (4); excluded from deletion until callers migrate.
- Reference detail: see `docs/schema-migration/legacy-vocab-references.json`

## lib/vocab/trigger-code-aliases.js

- Semantic role: Legacy alias map for frozen trigger-code vocabulary normalisation.
- Exports audited: TRIGGER_CODE_ALIASES
- References remaining: 4
- Codex verdict: unsafe-live-references
- Decision: defer
- Rationale: Live references remain (4); excluded from deletion until callers migrate.
- Reference detail: see `docs/schema-migration/legacy-vocab-references.json`
