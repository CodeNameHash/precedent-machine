# M2-09 Per-Family Rebuild Plan — 2026-07-08T17:06:02.988Z

WP-M2-09 Step 1c reconciliation of the legacy JSX audit and schema-augmentation inventory.

Approval question for Ben: approve this batch as the target spec for Step 2 primitives and Step 3 per-family config enrichment.

## Conditions

### Legacy Features
- Carry forward the legacy shape from `CondSingleTable`.
- Condition term/detail rows and present/absent ordering.

### Schema Augmentations
- `canonicalCode`: canonical-condition-code pill on each row
- `effortsStandard`: efforts-standard pill on antitrust-clearance rows
- `consentStandard`: consent-standard pill on third-party-consent rows
- `materialityScrapeBoolean`: materiality-scrape yes/no badge on bring-down rows

### Rebuilt-Table Spec
- Render canonical/schema pills before free-text values where a structured field exists.
- Render the value cell next, preserving the legacy ordering and grouping.
- Attach evidence hover-source data to each card-backed value.
- Use grouped subrows where the legacy table represented related variants in one analytical surface.

Primitives: `PillCell`, `GroupedSubRows`, `EvidenceHoverSource`, `EmptyStateBranch`.

## Material Contracts

### Legacy Features
- Carry forward the legacy shape from `RepMaterialContractsTable`.
- Bucket rows, thresholds, roman ordering, and coverage checklist.

### Schema Augmentations
- `materialContractsBuckets`: canonical bucket pills with also-covered synonyms
- `materialContractsDollarThresholds`: threshold cell with hover quote
- `MATERIAL_CONTRACT_BUCKET_META.synonyms`: top-of-table coverage percentage rollup

### Rebuilt-Table Spec
- Render canonical/schema pills before free-text values where a structured field exists.
- Render the value cell next, preserving the legacy ordering and grouping.
- Attach evidence hover-source data to each card-backed value.
- Use grouped subrows where the legacy table represented related variants in one analytical surface.

Primitives: `PillCell`, `ThresholdCellWithHoverQuote`, `CoverageChecklist`, `RomanNumeralOrdinal`, `EvidenceHoverSource`, `ComputedRollupHeader`.

## IOC / General Covenants

### Legacy Features
- Carry forward the legacy shape from `IocGeneralExceptionsTableSingle`, `IocNegativeCovenantsTableSingle`, `IocAffirmativeCovenantsTableSingle`, `CovSummaryTable`.
- Exception matrix plus affirmative/negative covenant summary rows.

### Schema Augmentations
- `iocEffortsStandard`: efforts-standard pill per covenant subrow
- `iocConsentStandard`: consent-standard pill per covenant subrow
- `knowledgeQualifier`: knowledge scope/type badge
- `dayCountDeadline`: day-count deadline column where present

### Rebuilt-Table Spec
- Render canonical/schema pills before free-text values where a structured field exists.
- Render the value cell next, preserving the legacy ordering and grouping.
- Attach evidence hover-source data to each card-backed value.
- Use grouped subrows where the legacy table represented related variants in one analytical surface.

Primitives: `PillCell`, `ThresholdCellWithHoverQuote`, `GroupedSubRows`, `EvidenceHoverSource`, `ComputedRollupHeader`.

## Tail Fee / Fees

### Legacy Features
- Carry forward the legacy shape from `CategoryFeatureSummaryTable`.
- Tail-fee and termination-fee rows with fee amount/detail text.

### Schema Augmentations
- `tailDurationMonths`: tail duration pill
- `triggerRules`: triggering-events pill list
- `terminationFees`: fee amount with hover quote

### Rebuilt-Table Spec
- Render canonical/schema pills before free-text values where a structured field exists.
- Render the value cell next, preserving the legacy ordering and grouping.
- Attach evidence hover-source data to each card-backed value.
- Use grouped subrows where the legacy table represented related variants in one analytical surface.

Primitives: `PillCell`, `ThresholdCellWithHoverQuote`, `EvidenceHoverSource`.

## NoSol

### Legacy Features
- Carry forward the legacy shape from `CategoryFeatureSummaryTable`.
- Separate no-shop, superior-proposal, intervening-event, and fiduciary-out tables.

### Schema Augmentations
- `matchingRightBusinessDays`: matching-right days pill per subrow
- `fiduciaryOutStandard`: fiduciary-out standard pill
- `interveningEventScope`: grouped subrow under the NoSol stack

### Rebuilt-Table Spec
- Render canonical/schema pills before free-text values where a structured field exists.
- Render the value cell next, preserving the legacy ordering and grouping.
- Attach evidence hover-source data to each card-backed value.
- Use grouped subrows where the legacy table represented related variants in one analytical surface.

Primitives: `PillCell`, `GroupedSubRows`, `EvidenceHoverSource`.

## Rep Materiality / Qualifiers

### Legacy Features
- Carry forward the legacy shape from `RepMaterialContractsTable`, `RepGeneralExceptionsTable`, `BringdownTable`.
- Per-rep materiality, knowledge, schedule, and bring-down detail rows.

### Schema Augmentations
- `materialityQualifier`: materiality-tier pill
- `knowledgeQualifier`: knowledge-qualifier pill
- `rw-general-lookback-scopes.js`: scope pill from lookback vocabulary
- `rw-sec-filings-portions-excluded.js`: SEC filings carve-out scope pill

### Rebuilt-Table Spec
- Render canonical/schema pills before free-text values where a structured field exists.
- Render the value cell next, preserving the legacy ordering and grouping.
- Attach evidence hover-source data to each card-backed value.
- Use grouped subrows where the legacy table represented related variants in one analytical surface.

Primitives: `PillCell`, `GroupedSubRows`, `EvidenceHoverSource`.

## MAE / Definitions

### Legacy Features
- Carry forward the legacy shape from `CategoryFeatureSummaryTable`.
- Definition detail text and MAE carve-out wording.

### Schema Augmentations
- `maeLimbType`: ONE_LIMB vs TWO_LIMB pill
- `carveouts`: MAE carve-out category pill groups
- `disproportionateImpactClause`: disproportionate-impact clause pill
- `preventDelayProng`: prevent-delay prong pill

### Rebuilt-Table Spec
- Render canonical/schema pills before free-text values where a structured field exists.
- Render the value cell next, preserving the legacy ordering and grouping.
- Attach evidence hover-source data to each card-backed value.
- Use grouped subrows where the legacy table represented related variants in one analytical surface.

Primitives: `PillCell`, `GroupedSubRows`, `EvidenceHoverSource`.

## Antitrust / Regulatory

### Legacy Features
- Carry forward the legacy shape from `AntitrustSummaryTable`.
- Regulatory efforts, caps, filings, litigation, and remedy rows.

### Schema Augmentations
- `burdensomeConditionLimit`: BURDEN_COMMITMENT / remedies-cap pill
- `effortsStandard`: efforts-standard pill
- `hsrFilingDeadline`: HSR filing deadline business-day pill
- `tickingFee`: ticking-fee pill

### Rebuilt-Table Spec
- Render canonical/schema pills before free-text values where a structured field exists.
- Render the value cell next, preserving the legacy ordering and grouping.
- Attach evidence hover-source data to each card-backed value.
- Use grouped subrows where the legacy table represented related variants in one analytical surface.

Primitives: `PillCell`, `ThresholdCellWithHoverQuote`, `GroupedSubRows`, `EvidenceHoverSource`, `ComputedRollupHeader`.

## Structure / Mechanics

### Legacy Features
- Carry forward the legacy shape from `StructTable`.
- Transaction form, merger mechanics, closing/effective-time mechanics, and governance rows.

### Schema Augmentations
- `dealStructure`: transaction-form pill
- `mergerForm`: topology pill
- `section251h`: 251(h) badge
- `backendMergerMechanic`: back-end / top-up badge
- `appraisalRightsAvailable`: appraisal-rights badge

### Rebuilt-Table Spec
- Render canonical/schema pills before free-text values where a structured field exists.
- Render the value cell next, preserving the legacy ordering and grouping.
- Attach evidence hover-source data to each card-backed value.
- Use grouped subrows where the legacy table represented related variants in one analytical surface.

Primitives: `PillCell`, `ThresholdCellWithHoverQuote`, `GroupedSubRows`, `EvidenceHoverSource`.

## Termination Rights

### Legacy Features
- Carry forward the legacy shape from `CategoryFeatureSummaryTable`.
- Termination trigger/right rows and outside-date detail text.

### Schema Augmentations
- `outsideDate`: outside-date pill
- `recommendationChangeTermination`: fiduciary-termination-right badge
- `terminationTriggers`: termination-trigger pill list
- `breachStandard`: breach-threshold pill

### Rebuilt-Table Spec
- Render canonical/schema pills before free-text values where a structured field exists.
- Render the value cell next, preserving the legacy ordering and grouping.
- Attach evidence hover-source data to each card-backed value.
- Use grouped subrows where the legacy table represented related variants in one analytical surface.

Primitives: `PillCell`, `GroupedSubRows`, `EvidenceHoverSource`.

## SEC / Meeting

### Legacy Features
- Carry forward the legacy shape from `CondSingleTable`.
- Proxy/tender filing, meeting, vote, and adjournment detail rows.

### Schema Augmentations
- `proxyFilingDeadline`: proxy-filing-deadline pill
- `voteThreshold`: vote-mechanic pill
- `adjournmentRights`: adjournment-rights pill

### Rebuilt-Table Spec
- Render canonical/schema pills before free-text values where a structured field exists.
- Render the value cell next, preserving the legacy ordering and grouping.
- Attach evidence hover-source data to each card-backed value.
- Use grouped subrows where the legacy table represented related variants in one analytical surface.

Primitives: `PillCell`, `GroupedSubRows`, `EvidenceHoverSource`.

## Approvals / Votes

### Legacy Features
- Carry forward the legacy shape from `CondSingleTable`.
- Approval condition existence and meeting mechanics.

### Schema Augmentations
- `voteThreshold`: vote-standard pill
- `quorumRequirement`: quorum pill
- `dualClassTreatment`: dual-class treatment pill
- `recordDate`: record-date mechanic pill

### Rebuilt-Table Spec
- Render canonical/schema pills before free-text values where a structured field exists.
- Render the value cell next, preserving the legacy ordering and grouping.
- Attach evidence hover-source data to each card-backed value.
- Use grouped subrows where the legacy table represented related variants in one analytical surface.

Primitives: `PillCell`, `GroupedSubRows`, `EvidenceHoverSource`.

## Employee Benefits

### Legacy Features
- Carry forward the legacy shape from `CompensationItemsTable`.
- Compensation item rows and employment covenant detail text.

### Schema Augmentations
- `compensationItems`: structured compensation object rows
- `comparisonGroup`: comparison-group pill
- `benefitStandard`: benefit-standard pill
- `bundling`: aggregate/bundled-test badge

### Rebuilt-Table Spec
- Render canonical/schema pills before free-text values where a structured field exists.
- Render the value cell next, preserving the legacy ordering and grouping.
- Attach evidence hover-source data to each card-backed value.
- Use grouped subrows where the legacy table represented related variants in one analytical surface.

Primitives: `PillCell`, `GroupedSubRows`, `EvidenceHoverSource`.

## No Other Reps / Fraud

### Legacy Features
- Carry forward the legacy shape from `CategoryFeatureSummaryTable`.
- Abry four-question checklist and fraud silence/detail rows.

### Schema Augmentations
- `noOtherRepsScope`: scope pill
- `nonRelianceScope`: non-reliance scope pill
- `fraudCarveout`: fraud carve-out badge

### Rebuilt-Table Spec
- Render canonical/schema pills before free-text values where a structured field exists.
- Render the value cell next, preserving the legacy ordering and grouping.
- Attach evidence hover-source data to each card-backed value.
- Use grouped subrows where the legacy table represented related variants in one analytical surface.

Primitives: `PillCell`, `CoverageChecklist`, `EvidenceHoverSource`, `EmptyStateBranch`.

## Advisers / Fees / Expenses

### Legacy Features
- Carry forward the legacy shape from `MiscSummaryTable`.
- General fee/expense, adviser, governing-law, forum, and remedy rows.

### Schema Augmentations
- `feeExpenseAllocation`: fee/expense allocation pill
- `feeExpenseExceptions`: expense-exceptions pill list
- `adviserFees`: adviser-fee badge

### Rebuilt-Table Spec
- Render canonical/schema pills before free-text values where a structured field exists.
- Render the value cell next, preserving the legacy ordering and grouping.
- Attach evidence hover-source data to each card-backed value.
- Use grouped subrows where the legacy table represented related variants in one analytical surface.

Primitives: `PillCell`, `EvidenceHoverSource`.
