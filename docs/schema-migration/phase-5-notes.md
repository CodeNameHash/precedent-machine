# WP-SCHEMA Phase 5 Notes

## Discovery

- The extractor already has one central field-prompt seam: `buildFeatureInstructions()` in `lib/parser-v2/extract.js`.
- All extraction strategies call that seam, then append existing type-specific legal guardrails.
- The generated Phase 3 schema preserved every legacy rubric feature key, but it did not preserve all legacy extraction metadata such as `scope` and `source`.
- A naive schema-only renderer would leak post-pass/internal fields into prompts. Known dangerous keys include `linkedBringDownStandard`, `knowledgeScope`, `aocCitedCovenantNames`, `citedProvisionNames`, `restrictionComponents`, `outsideDateMonthsPostSigning`, `extensionMonths`, and internal parser metadata.
- Ben confirmed:
  - `scheduleReference` is low-value metadata and should not drive extraction or benchmarks.
  - `mainConcept` is valuable in admin/review contexts, but should remain a fallback summary rather than a substitute for structured fields.
  - `permittedExceptions` must stay conservative because exceptions appear in many shapes.
  - `materialContractsBuckets` should remain broad and promptable; the tag family is a canonical spine, not a closed universe.

## Implementation

- Added `lib/schema/prompt.js`:
  - `renderExtractionPrompt(type, code, ctx)`
  - `renderExtractionPromptParts(type, code, ctx)`
  - prompt policy for model-readonly fields and low-value fields
  - schema-backed field rendering, grouped by display group
  - `mainConcept` rendered under fallback summary wording
  - `permittedExceptions` rendered with conservative shape/quote wording
  - `materialContractsBuckets` rendered as broad, non-closed-world tagged extraction
- Exported the prompt module from `lib/schema/index.js`.
- Routed `buildFeatureInstructions()` through `renderExtractionPromptParts()` for the generic feature-line list.
- Kept all existing bespoke legal guardrails in `extract.js` intact.
- De-emphasised `scheduleReference` in extractor instructions and schema wording.
- Added `tests/schema/prompt.test.js`.

## Prompt-Diff Safety Check

Compared `origin/main` prompt field-line keys against this branch for representative type/scope combinations.

The only removed generic field-line key is `scheduleReference`, intentionally.

| Type/scope | Before | After | Removed | Added |
| --- | ---: | ---: | --- | --- |
| `IOC/preamble` | 21 | 20 | `scheduleReference` | none |
| `IOC/clause` | 6 | 6 | none | none |
| `REP-T/preamble` | 22 | 22 | none | none |
| `REP-T` | 40 | 39 | `scheduleReference` | none |
| `REP-B` | 23 | 23 | none | none |
| `TERMR` | 15 | 15 | none | none |
| `NOSOL` | 72 | 72 | none | none |
| `ANTI` | 46 | 46 | none | none |
| `COND-B` | 19 | 18 | `scheduleReference` | none |
| `COND-M` | 17 | 16 | `scheduleReference` | none |
| `TERMF` | 35 | 35 | none | none |
| `DEF` | 22 | 22 | none | none |
| `STRUCT` | 9 | 9 | none | none |
| `CONSID` | 31 | 31 | none | none |
| `COV` | 30 | 30 | none | none |
| `MISC` | 36 | 36 | none | none |

## Compatibility Choices

- This is a bridge implementation. Feature selection still uses the legacy rubric scope logic, then the schema prompt renderer formats the field lines. That preserves extraction parity while moving prompt rendering into `lib/schema`.
- Model-readonly/internal fields are excluded in `lib/schema/prompt.js` because the Phase 3 generated registry does not yet carry enough source metadata.
- `scheduleReference` remains represented in the registry for live-data parity, but is excluded from default prompts and should not be benchmarkable.
- No full LLM corpus re-extract was run in this phase. The deterministic prompt field-key diff above is the safety check for this conservative bridge. Corpus QA still runs against stored production data.

## Verification

- Focused prompt/extraction tests passed:
  - `node --test tests/schema/prompt.test.js tests/metsfb2-extraction-batch2.test.js tests/termr-outside-date-months.test.js tests/sec-meeting.test.js tests/anti-regulatory-efforts.test.js tests/ioc-efforts-standard.test.js` (`56` passing)
- Full repo tests passed:
  - `npm test` (`799` passing)
- Schema tests passed:
  - `node --test tests/schema/*.test.js` (`24` passing, `1` skipped without env)
  - with Supabase env loaded, `node --test tests/schema/coverage.test.js` passed live coverage
- Production build passed:
  - `npm run build`
- Corpus QA passed:
  - `node scripts/ingest-qa.js --all`
  - Current corpus size is `25` deals.
  - Overall result: `PASS`, `0` unverified quotes, `0` duplicate clauses.
