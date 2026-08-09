# Step 2X-I: IOC V1 categories, MAE limbs, 2F2 open-world schema

## IOC producer → 25 V1 categories

| File | Change |
|------|--------|
| `lib/canonical-v2/native-producer/ioc-producer-prompt.js` | `IOC_PROMPT_VERSION` 5→6, `PROMPT_ID` `.../v6`, `RESTRICTION_CATEGORIES` from `IOC_CATEGORIES_CANONICAL` |
| `lib/canonical-v2/native-producer/ioc-corroboration.js` | V1-keyed `RESTRICTION_CATEGORY_TO_CONCEPT`, `CATEGORY_TESTS`, identity `V2_CATEGORY_TO_V1_KEYS`; removed second-chance V1 vocabulary path |
| `lib/canonical-v2/native-producer/candidate-resolution.js` | Long-tail open-world guard uses `ACQUISITIONS_BUSINESS_COMBINATIONS` / `MATERIAL_CONTRACTS` |
| `lib/canonical-v2/contract-bundle.js` | `IOC_RESTRICTION_CONCEPT_KEYS_V25` +9 concepts for V1 category resolution |
| `lib/canonical-v2/ioc-wave-a-product-projection.js` | `CONCEPT_LABELS` widened to 20 governed IOC rubric concepts |

Rubric gap: `DATA_PRIVACY_CYBER` maps to `IOC-REGAUTH` (no dedicated cyber/privacy IOC rubric code in `lib/rubric.js`).

## MAE definition limbs

| File | Version bump |
|------|----------------|
| `lib/canonical-v2/native-producer/mae-definition-producer-prompt.js` | 2→3 (`mae-definition-producer/v3`), `limbs[]` on each instance |
| `lib/canonical-v2/native-producer/anthropic-provider.js` | `shapeMaeDefinitionLimbAssertionProposals` → `LIMB_ASSERTION_CLAIM_KEY` |

## 2F2 open-world element schema (bare `[]` → object schema)

| File | Version bump |
|------|----------------|
| `merger-structure-producer-prompt.js` | 1→2 |
| `tax-dividend-appraisal-producer-prompt.js` | 1→2 |
| `tax-matters-producer-prompt.js` | 1→2 |
| `dno-producer-prompt.js` | 1→2 |
| `employee-dno-producer-prompt.js` | 1→2 |
| `key-terms-mae-follow-on-producer-prompt.js` | 2→3 |
| `employee-matters-producer-prompt.js` | 1→2 |
| `financing-producer-prompt.js` | 1→2 |
| `financing-guaranty-producer-prompt.js` | 1→2 |
| `appraisal-producer-prompt.js` | 1→2 |

Skipped (schema already present): guaranty, dividends, ioc-producer, antitrust-regulatory, specific-performance-remedies, remedies-misc, proxy-meeting.

## Tests updated

`canonical-v2-ioc-producer-prompt.test.js`, `canonical-v2-ioc-corroboration.test.js`, `canonical-v2-ioc-parent-child-resolution.test.js`, `canonical-v2-m3-topbuild-ioc-sibling-citation-replay.test.js`, `canonical-v2-ioc-mechanic-resolution.test.js`, `canonical-v2-general-extraction-runner.test.js`.
