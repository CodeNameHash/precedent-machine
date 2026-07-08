# M2-09 Schema Augmentations — 2026-07-08T17:01:51.467Z

WP-M2-09 Step 1b inventory of structured schema-card fields and vocabularies that should enrich the rebuilt schema-first tables beyond the legacy JSX shapes.

Cross-cutting augmentation: every rendered value that traces to a card should carry provenance-bundle hover-source data and the future click-to-open-source-overlay seam.

## Conditions

Legacy components: `CondSingleTable`.
Schema configs: `conditions-m.config.js`, `conditions-b.config.js`, `conditions-s.config.js`.

| Field / source signal | Required | Legacy showed | Rebuilt table should show | Source citation(s) |
|---|---|---|---|---|
| canonicalCode | yes | Condition term/detail rows and present/absent ordering. | canonical-condition-code pill on each row | components/review/table-configs/conditions-m.config.js |
| effortsStandard | yes | Condition term/detail rows and present/absent ordering. | efforts-standard pill on antitrust-clearance rows | lib/category-summary-features.js |
| consentStandard | yes | Condition term/detail rows and present/absent ordering. | consent-standard pill on third-party-consent rows | components/review/table-configs/conditions-m.config.js, components/review/table-configs/conditions-b.config.js, components/review/table-configs/conditions-s.config.js |
| materialityScrapeBoolean | yes | Condition term/detail rows and present/absent ordering. | materiality-scrape yes/no badge on bring-down rows | components/review/table-configs/conditions-m.config.js, components/review/table-configs/conditions-b.config.js, components/review/table-configs/conditions-s.config.js |

## Material Contracts

Legacy components: `RepMaterialContractsTable`.
Schema configs: `material-contracts.config.js`.

| Field / source signal | Required | Legacy showed | Rebuilt table should show | Source citation(s) |
|---|---|---|---|---|
| materialContractsBuckets | yes | Bucket rows, thresholds, roman ordering, and coverage checklist. | canonical bucket pills with also-covered synonyms | components/review/table-configs/material-contracts.config.js |
| materialContractsDollarThresholds | yes | Bucket rows, thresholds, roman ordering, and coverage checklist. | threshold cell with hover quote | components/review/table-configs/material-contracts.config.js |
| MATERIAL_CONTRACT_BUCKET_META.synonyms | yes | Bucket rows, thresholds, roman ordering, and coverage checklist. | top-of-table coverage percentage rollup | components/review/table-configs/material-contracts.config.js |

## IOC / General Covenants

Legacy components: `IocGeneralExceptionsTableSingle`, `IocNegativeCovenantsTableSingle`, `IocAffirmativeCovenantsTableSingle`, `CovSummaryTable`.
Schema configs: `ioc-exceptions.config.js`, `general-covenants.config.js`.

| Field / source signal | Required | Legacy showed | Rebuilt table should show | Source citation(s) |
|---|---|---|---|---|
| iocEffortsStandard | yes | Exception matrix plus affirmative/negative covenant summary rows. | efforts-standard pill per covenant subrow | components/review/table-configs/ioc-exceptions.config.js, components/review/table-configs/general-covenants.config.js |
| iocConsentStandard | yes | Exception matrix plus affirmative/negative covenant summary rows. | consent-standard pill per covenant subrow | components/review/table-configs/ioc-exceptions.config.js, components/review/table-configs/general-covenants.config.js |
| knowledgeQualifier | yes | Exception matrix plus affirmative/negative covenant summary rows. | knowledge scope/type badge | components/review/table-configs/ioc-exceptions.config.js, components/review/table-configs/general-covenants.config.js |
| dayCountDeadline | yes | Exception matrix plus affirmative/negative covenant summary rows. | day-count deadline column where present | components/review/table-configs/ioc-exceptions.config.js, components/review/table-configs/general-covenants.config.js |
| absenceConductedOrdinaryCourse | no | Exception matrix plus affirmative/negative covenant summary rows. | absenceConductedOrdinaryCourse as an evidence-backed structured value where populated | components/review/table-configs/general-covenants.config.js |
| absenceNoMAE | no | Exception matrix plus affirmative/negative covenant summary rows. | absenceNoMAE as an evidence-backed structured value where populated | components/review/table-configs/general-covenants.config.js |
| absenceSpecifiedIOCs | no | Exception matrix plus affirmative/negative covenant summary rows. | absenceSpecifiedIOCs as an evidence-backed structured value where populated | components/review/table-configs/general-covenants.config.js |
| accessRights | no | Exception matrix plus affirmative/negative covenant summary rows. | accessRights as an evidence-backed structured value where populated | components/review/table-configs/general-covenants.config.js |
| affirmativeCovenants | no | Exception matrix plus affirmative/negative covenant summary rows. | affirmativeCovenants as an evidence-backed structured value where populated | components/review/table-configs/general-covenants.config.js |
| aocNoMaePresent | no | Exception matrix plus affirmative/negative covenant summary rows. | aocNoMaePresent as an evidence-backed structured value where populated | components/review/table-configs/general-covenants.config.js |
| doInsurance | no | Exception matrix plus affirmative/negative covenant summary rows. | doInsurance as an evidence-backed structured value where populated | components/review/table-configs/general-covenants.config.js |
| effortsStandard | no | Exception matrix plus affirmative/negative covenant summary rows. | effortsStandard as an evidence-backed structured value where populated | components/review/table-configs/general-covenants.config.js, lib/category-summary-features.js |
| financingCooperation | no | Exception matrix plus affirmative/negative covenant summary rows. | financingCooperation as an evidence-backed structured value where populated | components/review/table-configs/general-covenants.config.js, lib/category-summary-features.js |
| informationAccess | no | Exception matrix plus affirmative/negative covenant summary rows. | informationAccess as an evidence-backed structured value where populated | components/review/table-configs/general-covenants.config.js |
| insuranceCap | no | Exception matrix plus affirmative/negative covenant summary rows. | insuranceCap as an evidence-backed structured value where populated | components/review/table-configs/general-covenants.config.js, lib/category-summary-features.js |
| insurancePeriod | no | Exception matrix plus affirmative/negative covenant summary rows. | insurancePeriod as an evidence-backed structured value where populated | components/review/table-configs/general-covenants.config.js |
| negativeCovenant | no | Exception matrix plus affirmative/negative covenant summary rows. | negativeCovenant as an evidence-backed structured value where populated | components/review/table-configs/general-covenants.config.js |
| negativeCovenantBaskets | no | Exception matrix plus affirmative/negative covenant summary rows. | negativeCovenantBaskets as an evidence-backed structured value where populated | components/review/table-configs/general-covenants.config.js |
| ordinaryCourseConduct | no | Exception matrix plus affirmative/negative covenant summary rows. | ordinaryCourseConduct as an evidence-backed structured value where populated | components/review/table-configs/general-covenants.config.js |
| positiveObligations | no | Exception matrix plus affirmative/negative covenant summary rows. | positiveObligations as an evidence-backed structured value where populated | components/review/table-configs/general-covenants.config.js |
| publicStatementExceptions | no | Exception matrix plus affirmative/negative covenant summary rows. | publicStatementExceptions as an evidence-backed structured value where populated | components/review/table-configs/general-covenants.config.js |
| publicStatements | no | Exception matrix plus affirmative/negative covenant summary rows. | publicStatements as an evidence-backed structured value where populated | components/review/table-configs/general-covenants.config.js, lib/category-summary-features.js |
| reasonableBestEfforts | no | Exception matrix plus affirmative/negative covenant summary rows. | reasonableBestEfforts as an evidence-backed structured value where populated | components/review/table-configs/general-covenants.config.js |
| restrictedActions | no | Exception matrix plus affirmative/negative covenant summary rows. | restrictedActions as an evidence-backed structured value where populated | components/review/table-configs/general-covenants.config.js |

## Tail Fee / Fees

Legacy components: `CategoryFeatureSummaryTable`.
Schema configs: `tail-fee.config.js`, `termination-fees.config.js`.

| Field / source signal | Required | Legacy showed | Rebuilt table should show | Source citation(s) |
|---|---|---|---|---|
| tailDurationMonths | yes | Tail-fee and termination-fee rows with fee amount/detail text. | tail duration pill | components/review/table-configs/tail-fee.config.js, components/review/table-configs/termination-fees.config.js |
| triggerRules | yes | Tail-fee and termination-fee rows with fee amount/detail text. | triggering-events pill list | components/review/table-configs/termination-fees.config.js |
| terminationFees | yes | Tail-fee and termination-fee rows with fee amount/detail text. | fee amount with hover quote | components/review/table-configs/termination-fees.config.js, docs/vocab/FROZEN-triggerCode-v1.json |
| tailFeeActivatingClauses | no | Tail-fee and termination-fee rows with fee amount/detail text. | tailFeeActivatingClauses as an evidence-backed structured value where populated | components/review/table-configs/tail-fee.config.js |
| tailFeeSameProposalRequired | no | Tail-fee and termination-fee rows with fee amount/detail text. | tailFeeSameProposalRequired as an evidence-backed structured value where populated | components/review/table-configs/tail-fee.config.js, components/review/table-configs/termination-fees.config.js |
| tailFeeThresholdPct | no | Tail-fee and termination-fee rows with fee amount/detail text. | tailFeeThresholdPct as an evidence-backed structured value where populated | components/review/table-configs/tail-fee.config.js |
| tailFeeWindowMonths | no | Tail-fee and termination-fee rows with fee amount/detail text. | tailFeeWindowMonths as an evidence-backed structured value where populated | components/review/table-configs/tail-fee.config.js, lib/category-summary-features.js |
| exclusiveRemedy | no | Tail-fee and termination-fee rows with fee amount/detail text. | exclusiveRemedy as an evidence-backed structured value where populated | components/review/table-configs/termination-fees.config.js |
| feeAmount | no | Tail-fee and termination-fee rows with fee amount/detail text. | feeAmount as an evidence-backed structured value where populated | components/review/table-configs/termination-fees.config.js, lib/category-summary-features.js |
| feePercent | no | Tail-fee and termination-fee rows with fee amount/detail text. | feePercent as an evidence-backed structured value where populated | components/review/table-configs/termination-fees.config.js, lib/category-summary-features.js |
| feeRequired | no | Tail-fee and termination-fee rows with fee amount/detail text. | feeRequired as an evidence-backed structured value where populated | components/review/table-configs/termination-fees.config.js, lib/category-summary-features.js |
| feeTriggers | no | Tail-fee and termination-fee rows with fee amount/detail text. | feeTriggers as an evidence-backed structured value where populated | components/review/table-configs/termination-fees.config.js |
| nakedNoVoteFeePresent | no | Tail-fee and termination-fee rows with fee amount/detail text. | nakedNoVoteFeePresent as an evidence-backed structured value where populated | components/review/table-configs/termination-fees.config.js, lib/category-summary-features.js |
| regulatoryTerminationFee | no | Tail-fee and termination-fee rows with fee amount/detail text. | regulatoryTerminationFee as an evidence-backed structured value where populated | components/review/table-configs/termination-fees.config.js |
| remedyEffect | no | Tail-fee and termination-fee rows with fee amount/detail text. | remedyEffect as an evidence-backed structured value where populated | components/review/table-configs/termination-fees.config.js |
| reverseFeeAmount | no | Tail-fee and termination-fee rows with fee amount/detail text. | reverseFeeAmount as an evidence-backed structured value where populated | components/review/table-configs/termination-fees.config.js, lib/category-summary-features.js |
| reverseTerminationFee | no | Tail-fee and termination-fee rows with fee amount/detail text. | reverseTerminationFee as an evidence-backed structured value where populated | components/review/table-configs/termination-fees.config.js, lib/category-summary-features.js |
| tailProvision | no | Tail-fee and termination-fee rows with fee amount/detail text. | tailProvision as an evidence-backed structured value where populated | components/review/table-configs/termination-fees.config.js |
| targetTerminationFee | no | Tail-fee and termination-fee rows with fee amount/detail text. | targetTerminationFee as an evidence-backed structured value where populated | components/review/table-configs/termination-fees.config.js |
| terminationFeeAmount | no | Tail-fee and termination-fee rows with fee amount/detail text. | terminationFeeAmount as an evidence-backed structured value where populated | components/review/table-configs/termination-fees.config.js |
| terminationFeePercent | no | Tail-fee and termination-fee rows with fee amount/detail text. | terminationFeePercent as an evidence-backed structured value where populated | components/review/table-configs/termination-fees.config.js, lib/category-summary-features.js |
| terminationFeeRequired | no | Tail-fee and termination-fee rows with fee amount/detail text. | terminationFeeRequired as an evidence-backed structured value where populated | components/review/table-configs/termination-fees.config.js |
| tickingFee | no | Tail-fee and termination-fee rows with fee amount/detail text. | tickingFee as an evidence-backed structured value where populated | components/review/table-configs/termination-fees.config.js |

## NoSol

Legacy components: `CategoryFeatureSummaryTable`.
Schema configs: `nosol-noshop.config.js`, `nosol-superior.config.js`, `nosol-intervening.config.js`, `nosol-fiduciary.config.js`.

| Field / source signal | Required | Legacy showed | Rebuilt table should show | Source citation(s) |
|---|---|---|---|---|
| matchingRightBusinessDays | yes | Separate no-shop, superior-proposal, intervening-event, and fiduciary-out tables. | matching-right days pill per subrow | components/review/table-configs/nosol-noshop.config.js, components/review/table-configs/nosol-superior.config.js, components/review/table-configs/nosol-intervening.config.js, components/review/table-configs/nosol-fiduciary.config.js |
| fiduciaryOutStandard | yes | Separate no-shop, superior-proposal, intervening-event, and fiduciary-out tables. | fiduciary-out standard pill | lib/category-summary-features.js |
| interveningEventScope | yes | Separate no-shop, superior-proposal, intervening-event, and fiduciary-out tables. | grouped subrow under the NoSol stack | components/review/table-configs/nosol-intervening.config.js |
| ceaseDiscussionsAffiliateStandard | no | Separate no-shop, superior-proposal, intervening-event, and fiduciary-out tables. | ceaseDiscussionsAffiliateStandard as an evidence-backed structured value where populated | components/review/table-configs/nosol-noshop.config.js |
| ceaseDiscussionsExceptions | no | Separate no-shop, superior-proposal, intervening-event, and fiduciary-out tables. | ceaseDiscussionsExceptions as an evidence-backed structured value where populated | components/review/table-configs/nosol-noshop.config.js |
| ceaseDiscussionsLiability | no | Separate no-shop, superior-proposal, intervening-event, and fiduciary-out tables. | ceaseDiscussionsLiability as an evidence-backed structured value where populated | components/review/table-configs/nosol-noshop.config.js |
| ceaseDiscussionsProhibitedList | no | Separate no-shop, superior-proposal, intervening-event, and fiduciary-out tables. | ceaseDiscussionsProhibitedList as an evidence-backed structured value where populated | components/review/table-configs/nosol-noshop.config.js |
| fiduciaryCarveoutThreshold | no | Separate no-shop, superior-proposal, intervening-event, and fiduciary-out tables. | fiduciaryCarveoutThreshold as an evidence-backed structured value where populated | components/review/table-configs/nosol-noshop.config.js |
| mainRestriction | no | Separate no-shop, superior-proposal, intervening-event, and fiduciary-out tables. | mainRestriction as an evidence-backed structured value where populated | components/review/table-configs/nosol-noshop.config.js |
| noShopType | no | Separate no-shop, superior-proposal, intervening-event, and fiduciary-out tables. | noShopType as an evidence-backed structured value where populated | components/review/table-configs/nosol-noshop.config.js |
| permittedExceptions | no | Separate no-shop, superior-proposal, intervening-event, and fiduciary-out tables. | permittedExceptions as an evidence-backed structured value where populated | components/review/table-configs/nosol-noshop.config.js |
| prohibitedActions | no | Separate no-shop, superior-proposal, intervening-event, and fiduciary-out tables. | prohibitedActions as an evidence-backed structured value where populated | components/review/table-configs/nosol-noshop.config.js |
| changeRecStandard | no | Separate no-shop, superior-proposal, intervening-event, and fiduciary-out tables. | changeRecStandard as an evidence-backed structured value where populated | components/review/table-configs/nosol-superior.config.js, components/review/table-configs/nosol-fiduciary.config.js |
| engagementStandard | no | Separate no-shop, superior-proposal, intervening-event, and fiduciary-out tables. | engagementStandard as an evidence-backed structured value where populated | components/review/table-configs/nosol-superior.config.js, components/review/table-configs/nosol-fiduciary.config.js |
| fiduciaryEngageStandard | no | Separate no-shop, superior-proposal, intervening-event, and fiduciary-out tables. | fiduciaryEngageStandard as an evidence-backed structured value where populated | components/review/table-configs/nosol-superior.config.js, components/review/table-configs/nosol-fiduciary.config.js, lib/category-summary-features.js |
| fiduciaryFinalStandard | no | Separate no-shop, superior-proposal, intervening-event, and fiduciary-out tables. | fiduciaryFinalStandard as an evidence-backed structured value where populated | components/review/table-configs/nosol-superior.config.js, components/review/table-configs/nosol-fiduciary.config.js, lib/category-summary-features.js |
| superiorProposalDeterminer | no | Separate no-shop, superior-proposal, intervening-event, and fiduciary-out tables. | superiorProposalDeterminer as an evidence-backed structured value where populated | components/review/table-configs/nosol-superior.config.js |
| superiorProposalPercentage | no | Separate no-shop, superior-proposal, intervening-event, and fiduciary-out tables. | superiorProposalPercentage as an evidence-backed structured value where populated | components/review/table-configs/nosol-superior.config.js |
| superiorProposalTest | no | Separate no-shop, superior-proposal, intervening-event, and fiduciary-out tables. | superiorProposalTest as an evidence-backed structured value where populated | components/review/table-configs/nosol-superior.config.js |
| superiorProposalThresholdPct | no | Separate no-shop, superior-proposal, intervening-event, and fiduciary-out tables. | superiorProposalThresholdPct as an evidence-backed structured value where populated | components/review/table-configs/nosol-superior.config.js |
| boardChangeForInterveningEvent | no | Separate no-shop, superior-proposal, intervening-event, and fiduciary-out tables. | boardChangeForInterveningEvent as an evidence-backed structured value where populated | components/review/table-configs/nosol-intervening.config.js, lib/category-summary-features.js |
| interveningEventDefinition | no | Separate no-shop, superior-proposal, intervening-event, and fiduciary-out tables. | interveningEventDefinition as an evidence-backed structured value where populated | components/review/table-configs/nosol-intervening.config.js, lib/category-summary-features.js |
| interveningEventExceptions | no | Separate no-shop, superior-proposal, intervening-event, and fiduciary-out tables. | interveningEventExceptions as an evidence-backed structured value where populated | components/review/table-configs/nosol-intervening.config.js |
| interveningEventProvision | no | Separate no-shop, superior-proposal, intervening-event, and fiduciary-out tables. | interveningEventProvision as an evidence-backed structured value where populated | components/review/table-configs/nosol-intervening.config.js, lib/category-summary-features.js |
| interveningEventTermination | no | Separate no-shop, superior-proposal, intervening-event, and fiduciary-out tables. | interveningEventTermination as an evidence-backed structured value where populated | components/review/table-configs/nosol-intervening.config.js, lib/category-summary-features.js |
| boardChangeForSuperiorProposal | no | Separate no-shop, superior-proposal, intervening-event, and fiduciary-out tables. | boardChangeForSuperiorProposal as an evidence-backed structured value where populated | components/review/table-configs/nosol-fiduciary.config.js, lib/category-summary-features.js |
| boardChangeStandard | no | Separate no-shop, superior-proposal, intervening-event, and fiduciary-out tables. | boardChangeStandard as an evidence-backed structured value where populated | components/review/table-configs/nosol-fiduciary.config.js, lib/category-summary-features.js |
| companyTerminationForSuperior | no | Separate no-shop, superior-proposal, intervening-event, and fiduciary-out tables. | companyTerminationForSuperior as an evidence-backed structured value where populated | components/review/table-configs/nosol-fiduciary.config.js, lib/category-summary-features.js |
| companyTerminationForSuperiorConditions | no | Separate no-shop, superior-proposal, intervening-event, and fiduciary-out tables. | companyTerminationForSuperiorConditions as an evidence-backed structured value where populated | components/review/table-configs/nosol-fiduciary.config.js, lib/category-summary-features.js |
| forceTheVote | no | Separate no-shop, superior-proposal, intervening-event, and fiduciary-out tables. | forceTheVote as an evidence-backed structured value where populated | components/review/table-configs/nosol-fiduciary.config.js, lib/category-summary-features.js |
| forceTheVoteDetails | no | Separate no-shop, superior-proposal, intervening-event, and fiduciary-out tables. | forceTheVoteDetails as an evidence-backed structured value where populated | components/review/table-configs/nosol-fiduciary.config.js, lib/category-summary-features.js |
| initialMatchPeriodDays | no | Separate no-shop, superior-proposal, intervening-event, and fiduciary-out tables. | initialMatchPeriodDays as an evidence-backed structured value where populated | components/review/table-configs/nosol-fiduciary.config.js, lib/category-summary-features.js |
| matchingPeriod | no | Separate no-shop, superior-proposal, intervening-event, and fiduciary-out tables. | matchingPeriod as an evidence-backed structured value where populated | components/review/table-configs/nosol-fiduciary.config.js, lib/category-summary-features.js |
| noticeContent | no | Separate no-shop, superior-proposal, intervening-event, and fiduciary-out tables. | noticeContent as an evidence-backed structured value where populated | components/review/table-configs/nosol-fiduciary.config.js, lib/category-summary-features.js |
| noticePeriod | no | Separate no-shop, superior-proposal, intervening-event, and fiduciary-out tables. | noticePeriod as an evidence-backed structured value where populated | components/review/table-configs/nosol-fiduciary.config.js, lib/category-summary-features.js |
| parentTerminationRightForNonsolicitBreach | no | Separate no-shop, superior-proposal, intervening-event, and fiduciary-out tables. | parentTerminationRightForNonsolicitBreach as an evidence-backed structured value where populated | components/review/table-configs/nosol-fiduciary.config.js, lib/category-summary-features.js |
| representativeBreachIsCompanyBreach | no | Separate no-shop, superior-proposal, intervening-event, and fiduciary-out tables. | representativeBreachIsCompanyBreach as an evidence-backed structured value where populated | components/review/table-configs/nosol-fiduciary.config.js, lib/category-summary-features.js |
| representativesStandard | no | Separate no-shop, superior-proposal, intervening-event, and fiduciary-out tables. | representativesStandard as an evidence-backed structured value where populated | components/review/table-configs/nosol-fiduciary.config.js, lib/category-summary-features.js |
| subsequentMatchPeriodDays | no | Separate no-shop, superior-proposal, intervening-event, and fiduciary-out tables. | subsequentMatchPeriodDays as an evidence-backed structured value where populated | components/review/table-configs/nosol-fiduciary.config.js, lib/category-summary-features.js |
| subsequentMatchingPeriod | no | Separate no-shop, superior-proposal, intervening-event, and fiduciary-out tables. | subsequentMatchingPeriod as an evidence-backed structured value where populated | components/review/table-configs/nosol-fiduciary.config.js, lib/category-summary-features.js |

## Rep Materiality / Qualifiers

Legacy components: `RepMaterialContractsTable`, `RepGeneralExceptionsTable`, `BringdownTable`.
Schema configs: `representations-qualifiers.config.js`.

| Field / source signal | Required | Legacy showed | Rebuilt table should show | Source citation(s) |
|---|---|---|---|---|
| materialityQualifier | yes | Per-rep materiality, knowledge, schedule, and bring-down detail rows. | materiality-tier pill | components/review/table-configs/representations-qualifiers.config.js, lib/rep-materiality.js, lib/category-summary-features.js |
| knowledgeQualifier | yes | Per-rep materiality, knowledge, schedule, and bring-down detail rows. | knowledge-qualifier pill | components/review/table-configs/representations-qualifiers.config.js |
| rw-general-lookback-scopes.js | yes | Per-rep materiality, knowledge, schedule, and bring-down detail rows. | scope pill from lookback vocabulary | components/review/table-configs/representations-qualifiers.config.js |
| rw-sec-filings-portions-excluded.js | yes | Per-rep materiality, knowledge, schedule, and bring-down detail rows. | SEC filings carve-out scope pill | components/review/table-configs/representations-qualifiers.config.js |
| bringDownStandard | no | Per-rep materiality, knowledge, schedule, and bring-down detail rows. | bringDownStandard as an evidence-backed structured value where populated | components/review/table-configs/representations-qualifiers.config.js, lib/category-summary-features.js |
| bringDownTiers | no | Per-rep materiality, knowledge, schedule, and bring-down detail rows. | bringDownTiers as an evidence-backed structured value where populated | components/review/table-configs/representations-qualifiers.config.js, lib/category-summary-features.js |
| disclosureScheduleException | no | Per-rep materiality, knowledge, schedule, and bring-down detail rows. | disclosureScheduleException as an evidence-backed structured value where populated | components/review/table-configs/representations-qualifiers.config.js |
| dollarThreshold | no | Per-rep materiality, knowledge, schedule, and bring-down detail rows. | dollarThreshold as an evidence-backed structured value where populated | components/review/table-configs/representations-qualifiers.config.js, lib/canonical-conditions.js |
| knowledgeScopeType | no | Per-rep materiality, knowledge, schedule, and bring-down detail rows. | knowledgeScopeType as an evidence-backed structured value where populated | components/review/table-configs/representations-qualifiers.config.js |
| knowledgeStandard | no | Per-rep materiality, knowledge, schedule, and bring-down detail rows. | knowledgeStandard as an evidence-backed structured value where populated | components/review/table-configs/representations-qualifiers.config.js |
| linkedBringDownStandard | no | Per-rep materiality, knowledge, schedule, and bring-down detail rows. | linkedBringDownStandard as an evidence-backed structured value where populated | components/review/table-configs/representations-qualifiers.config.js |
| lookbackPeriod | no | Per-rep materiality, knowledge, schedule, and bring-down detail rows. | lookbackPeriod as an evidence-backed structured value where populated | components/review/table-configs/representations-qualifiers.config.js |
| materialityScopeType | no | Per-rep materiality, knowledge, schedule, and bring-down detail rows. | materialityScopeType as an evidence-backed structured value where populated | components/review/table-configs/representations-qualifiers.config.js |
| materialityScrape | no | Per-rep materiality, knowledge, schedule, and bring-down detail rows. | materialityScrape as an evidence-backed structured value where populated | components/review/table-configs/representations-qualifiers.config.js, lib/canonical-conditions.js |
| materialityScrapeScope | no | Per-rep materiality, knowledge, schedule, and bring-down detail rows. | materialityScrapeScope as an evidence-backed structured value where populated | components/review/table-configs/representations-qualifiers.config.js |
| scheduleReference | no | Per-rep materiality, knowledge, schedule, and bring-down detail rows. | scheduleReference as an evidence-backed structured value where populated | components/review/table-configs/representations-qualifiers.config.js, lib/canonical-conditions.js, lib/category-summary-features.js |
| secFilingsCarvedOutReps | no | Per-rep materiality, knowledge, schedule, and bring-down detail rows. | secFilingsCarvedOutReps as an evidence-backed structured value where populated | components/review/table-configs/representations-qualifiers.config.js |
| secFilingsExceptionCarvedOutReps | no | Per-rep materiality, knowledge, schedule, and bring-down detail rows. | secFilingsExceptionCarvedOutReps as an evidence-backed structured value where populated | components/review/table-configs/representations-qualifiers.config.js |
| specificFeatures | no | Per-rep materiality, knowledge, schedule, and bring-down detail rows. | specificFeatures as an evidence-backed structured value where populated | components/review/table-configs/representations-qualifiers.config.js |

## MAE / Definitions

Legacy components: `CategoryFeatureSummaryTable`.
Schema configs: `mae-definitions.config.js`.

| Field / source signal | Required | Legacy showed | Rebuilt table should show | Source citation(s) |
|---|---|---|---|---|
| maeLimbType | yes | Definition detail text and MAE carve-out wording. | ONE_LIMB vs TWO_LIMB pill | components/review/table-configs/mae-definitions.config.js |
| carveouts | yes | Definition detail text and MAE carve-out wording. | MAE carve-out category pill groups | components/review/table-configs/mae-definitions.config.js, lib/category-summary-features.js |
| disproportionateImpactClause | yes | Definition detail text and MAE carve-out wording. | disproportionate-impact clause pill | components/review/table-configs/mae-definitions.config.js |
| preventDelayProng | yes | Definition detail text and MAE carve-out wording. | prevent-delay prong pill | components/review/table-configs/mae-definitions.config.js, lib/category-summary-features.js |
| carveoutExceptions | no | Definition detail text and MAE carve-out wording. | carveoutExceptions as an evidence-backed structured value where populated | components/review/table-configs/mae-definitions.config.js |
| disproportionalityClause | no | Definition detail text and MAE carve-out wording. | disproportionalityClause as an evidence-backed structured value where populated | components/review/table-configs/mae-definitions.config.js |
| maeCarveoutExceptions | no | Definition detail text and MAE carve-out wording. | maeCarveoutExceptions as an evidence-backed structured value where populated | components/review/table-configs/mae-definitions.config.js |
| maeCarveouts | no | Definition detail text and MAE carve-out wording. | maeCarveouts as an evidence-backed structured value where populated | components/review/table-configs/mae-definitions.config.js |
| maeLimbs | no | Definition detail text and MAE carve-out wording. | maeLimbs as an evidence-backed structured value where populated | components/review/table-configs/mae-definitions.config.js |
| maeParty | no | Definition detail text and MAE carve-out wording. | maeParty as an evidence-backed structured value where populated | components/review/table-configs/mae-definitions.config.js |
| maePreventDelay | no | Definition detail text and MAE carve-out wording. | maePreventDelay as an evidence-backed structured value where populated | components/review/table-configs/mae-definitions.config.js |
| maeTest | no | Definition detail text and MAE carve-out wording. | maeTest as an evidence-backed structured value where populated | components/review/table-configs/mae-definitions.config.js |
| mainConcept | no | Definition detail text and MAE carve-out wording. | mainConcept as an evidence-backed structured value where populated | components/review/table-configs/mae-definitions.config.js, lib/canonical-conditions.js |
| partyScope | no | Definition detail text and MAE carve-out wording. | partyScope as an evidence-backed structured value where populated | components/review/table-configs/mae-definitions.config.js |

## Antitrust / Regulatory

Legacy components: `AntitrustSummaryTable`.
Schema configs: `antitrust-regulatory.config.js`.

| Field / source signal | Required | Legacy showed | Rebuilt table should show | Source citation(s) |
|---|---|---|---|---|
| burdensomeConditionLimit | yes | Regulatory efforts, caps, filings, litigation, and remedy rows. | BURDEN_COMMITMENT / remedies-cap pill | components/review/table-configs/antitrust-regulatory.config.js |
| effortsStandard | yes | Regulatory efforts, caps, filings, litigation, and remedy rows. | efforts-standard pill | components/review/table-configs/antitrust-regulatory.config.js, lib/category-summary-features.js |
| hsrFilingDeadline | yes | Regulatory efforts, caps, filings, litigation, and remedy rows. | HSR filing deadline business-day pill | components/review/table-configs/antitrust-regulatory.config.js, lib/category-summary-features.js |
| tickingFee | yes | Regulatory efforts, caps, filings, litigation, and remedy rows. | ticking-fee pill | components/review/table-configs/antitrust-regulatory.config.js |
| antitrustApprovals | no | Regulatory efforts, caps, filings, litigation, and remedy rows. | antitrustApprovals as an evidence-backed structured value where populated | components/review/table-configs/antitrust-regulatory.config.js |
| antitrustEffortsStandard | no | Regulatory efforts, caps, filings, litigation, and remedy rows. | antitrustEffortsStandard as an evidence-backed structured value where populated | components/review/table-configs/antitrust-regulatory.config.js |
| antitrustOutsideDateExtension | no | Regulatory efforts, caps, filings, litigation, and remedy rows. | antitrustOutsideDateExtension as an evidence-backed structured value where populated | components/review/table-configs/antitrust-regulatory.config.js |
| burdenBaseline | no | Regulatory efforts, caps, filings, litigation, and remedy rows. | burdenBaseline as an evidence-backed structured value where populated | components/review/table-configs/antitrust-regulatory.config.js |
| clearSkies | no | Regulatory efforts, caps, filings, litigation, and remedy rows. | clearSkies as an evidence-backed structured value where populated | components/review/table-configs/antitrust-regulatory.config.js, lib/category-summary-features.js |
| clearSkiesObligation | no | Regulatory efforts, caps, filings, litigation, and remedy rows. | clearSkiesObligation as an evidence-backed structured value where populated | components/review/table-configs/antitrust-regulatory.config.js |
| consultationTier | no | Regulatory efforts, caps, filings, litigation, and remedy rows. | consultationTier as an evidence-backed structured value where populated | components/review/table-configs/antitrust-regulatory.config.js, lib/category-summary-features.js |
| cooperationStandard | no | Regulatory efforts, caps, filings, litigation, and remedy rows. | cooperationStandard as an evidence-backed structured value where populated | components/review/table-configs/antitrust-regulatory.config.js |
| divestitureObligation | no | Regulatory efforts, caps, filings, litigation, and remedy rows. | divestitureObligation as an evidence-backed structured value where populated | components/review/table-configs/antitrust-regulatory.config.js |
| foreignFilings | no | Regulatory efforts, caps, filings, litigation, and remedy rows. | foreignFilings as an evidence-backed structured value where populated | components/review/table-configs/antitrust-regulatory.config.js |
| hellOrHighWater | no | Regulatory efforts, caps, filings, litigation, and remedy rows. | hellOrHighWater as an evidence-backed structured value where populated | components/review/table-configs/antitrust-regulatory.config.js |
| litigationObligation | no | Regulatory efforts, caps, filings, litigation, and remedy rows. | litigationObligation as an evidence-backed structured value where populated | components/review/table-configs/antitrust-regulatory.config.js, lib/category-summary-features.js |
| noInconsistentAction | no | Regulatory efforts, caps, filings, litigation, and remedy rows. | noInconsistentAction as an evidence-backed structured value where populated | components/review/table-configs/antitrust-regulatory.config.js |
| outsideDateExtension | no | Regulatory efforts, caps, filings, litigation, and remedy rows. | outsideDateExtension as an evidence-backed structured value where populated | components/review/table-configs/antitrust-regulatory.config.js, lib/category-summary-features.js |
| parentLitigationObligation | no | Regulatory efforts, caps, filings, litigation, and remedy rows. | parentLitigationObligation as an evidence-backed structured value where populated | components/review/table-configs/antitrust-regulatory.config.js, lib/category-summary-features.js |
| regulatoryApprovals | no | Regulatory efforts, caps, filings, litigation, and remedy rows. | regulatoryApprovals as an evidence-backed structured value where populated | components/review/table-configs/antitrust-regulatory.config.js |
| regulatoryFilingsDeadline | no | Regulatory efforts, caps, filings, litigation, and remedy rows. | regulatoryFilingsDeadline as an evidence-backed structured value where populated | components/review/table-configs/antitrust-regulatory.config.js |
| remedyObligation | no | Regulatory efforts, caps, filings, litigation, and remedy rows. | remedyObligation as an evidence-backed structured value where populated | components/review/table-configs/antitrust-regulatory.config.js |
| timingAgreement | no | Regulatory efforts, caps, filings, litigation, and remedy rows. | timingAgreement as an evidence-backed structured value where populated | components/review/table-configs/antitrust-regulatory.config.js, lib/category-summary-features.js |
| timingAgreementText | no | Regulatory efforts, caps, filings, litigation, and remedy rows. | timingAgreementText as an evidence-backed structured value where populated | components/review/table-configs/antitrust-regulatory.config.js |

## Structure / Mechanics

Legacy components: `StructTable`.
Schema configs: `structure-mechanics.config.js`, `consideration-hero.config.js`.

| Field / source signal | Required | Legacy showed | Rebuilt table should show | Source citation(s) |
|---|---|---|---|---|
| dealStructure | yes | Transaction form, merger mechanics, closing/effective-time mechanics, and governance rows. | transaction-form pill | components/review/table-configs/structure-mechanics.config.js, lib/category-summary-features.js |
| mergerForm | yes | Transaction form, merger mechanics, closing/effective-time mechanics, and governance rows. | topology pill | components/review/table-configs/structure-mechanics.config.js, lib/category-summary-features.js |
| section251h | yes | Transaction form, merger mechanics, closing/effective-time mechanics, and governance rows. | 251(h) badge | components/review/table-configs/structure-mechanics.config.js |
| backendMergerMechanic | yes | Transaction form, merger mechanics, closing/effective-time mechanics, and governance rows. | back-end / top-up badge | components/review/table-configs/structure-mechanics.config.js, lib/category-summary-features.js |
| appraisalRightsAvailable | yes | Transaction form, merger mechanics, closing/effective-time mechanics, and governance rows. | appraisal-rights badge | components/review/table-configs/structure-mechanics.config.js, components/review/table-configs/consideration-hero.config.js, lib/category-summary-features.js |
| buyerBoardDesignation | no | Transaction form, merger mechanics, closing/effective-time mechanics, and governance rows. | buyerBoardDesignation as an evidence-backed structured value where populated | components/review/table-configs/structure-mechanics.config.js |
| bylaws | no | Transaction form, merger mechanics, closing/effective-time mechanics, and governance rows. | bylaws as an evidence-backed structured value where populated | components/review/table-configs/structure-mechanics.config.js, lib/vocab/ioc-categories.js |
| certificateOfIncorporation | no | Transaction form, merger mechanics, closing/effective-time mechanics, and governance rows. | certificateOfIncorporation as an evidence-backed structured value where populated | components/review/table-configs/structure-mechanics.config.js |
| closingDeadline | no | Transaction form, merger mechanics, closing/effective-time mechanics, and governance rows. | closingDeadline as an evidence-backed structured value where populated | components/review/table-configs/structure-mechanics.config.js |
| closingLocation | no | Transaction form, merger mechanics, closing/effective-time mechanics, and governance rows. | closingLocation as an evidence-backed structured value where populated | components/review/table-configs/structure-mechanics.config.js |
| closingTiming | no | Transaction form, merger mechanics, closing/effective-time mechanics, and governance rows. | closingTiming as an evidence-backed structured value where populated | components/review/table-configs/structure-mechanics.config.js, lib/category-summary-features.js |
| directorsAtEffectiveTime | no | Transaction form, merger mechanics, closing/effective-time mechanics, and governance rows. | directorsAtEffectiveTime as an evidence-backed structured value where populated | components/review/table-configs/structure-mechanics.config.js |
| effectiveTime | no | Transaction form, merger mechanics, closing/effective-time mechanics, and governance rows. | effectiveTime as an evidence-backed structured value where populated | components/review/table-configs/structure-mechanics.config.js |
| effectiveTimeShort | no | Transaction form, merger mechanics, closing/effective-time mechanics, and governance rows. | effectiveTimeShort as an evidence-backed structured value where populated | components/review/table-configs/structure-mechanics.config.js |
| effectsOfMergerReference | no | Transaction form, merger mechanics, closing/effective-time mechanics, and governance rows. | effectsOfMergerReference as an evidence-backed structured value where populated | components/review/table-configs/structure-mechanics.config.js |
| exchangeProcedures | no | Transaction form, merger mechanics, closing/effective-time mechanics, and governance rows. | exchangeProcedures as an evidence-backed structured value where populated | components/review/table-configs/structure-mechanics.config.js |
| governanceAtEffectiveTime | no | Transaction form, merger mechanics, closing/effective-time mechanics, and governance rows. | governanceAtEffectiveTime as an evidence-backed structured value where populated | components/review/table-configs/structure-mechanics.config.js |
| lostCertificates | no | Transaction form, merger mechanics, closing/effective-time mechanics, and governance rows. | lostCertificates as an evidence-backed structured value where populated | components/review/table-configs/structure-mechanics.config.js |
| mainConcept | no | Transaction form, merger mechanics, closing/effective-time mechanics, and governance rows. | mainConcept as an evidence-backed structured value where populated | components/review/table-configs/structure-mechanics.config.js, lib/canonical-conditions.js |
| officersAtEffectiveTime | no | Transaction form, merger mechanics, closing/effective-time mechanics, and governance rows. | officersAtEffectiveTime as an evidence-backed structured value where populated | components/review/table-configs/structure-mechanics.config.js |
| paymentAgent | no | Transaction form, merger mechanics, closing/effective-time mechanics, and governance rows. | paymentAgent as an evidence-backed structured value where populated | components/review/table-configs/structure-mechanics.config.js |
| shortFormMergerMechanic | no | Transaction form, merger mechanics, closing/effective-time mechanics, and governance rows. | shortFormMergerMechanic as an evidence-backed structured value where populated | components/review/table-configs/structure-mechanics.config.js |
| survivingEntity | no | Transaction form, merger mechanics, closing/effective-time mechanics, and governance rows. | survivingEntity as an evidence-backed structured value where populated | components/review/table-configs/structure-mechanics.config.js, lib/category-summary-features.js |
| cashAmount | no | Transaction form, merger mechanics, closing/effective-time mechanics, and governance rows. | cashAmount as an evidence-backed structured value where populated | components/review/table-configs/consideration-hero.config.js |
| considerationType | no | Transaction form, merger mechanics, closing/effective-time mechanics, and governance rows. | considerationType as an evidence-backed structured value where populated | components/review/table-configs/consideration-hero.config.js, lib/category-summary-features.js |
| exchangeRatio | no | Transaction form, merger mechanics, closing/effective-time mechanics, and governance rows. | exchangeRatio as an evidence-backed structured value where populated | components/review/table-configs/consideration-hero.config.js, lib/category-summary-features.js |
| offerConsideration | no | Transaction form, merger mechanics, closing/effective-time mechanics, and governance rows. | offerConsideration as an evidence-backed structured value where populated | components/review/table-configs/consideration-hero.config.js |
| offerPrice | no | Transaction form, merger mechanics, closing/effective-time mechanics, and governance rows. | offerPrice as an evidence-backed structured value where populated | components/review/table-configs/consideration-hero.config.js, lib/category-summary-features.js |
| perShareAmount | no | Transaction form, merger mechanics, closing/effective-time mechanics, and governance rows. | perShareAmount as an evidence-backed structured value where populated | components/review/table-configs/consideration-hero.config.js, lib/category-summary-features.js |

## Termination Rights

Legacy components: `CategoryFeatureSummaryTable`.
Schema configs: `termination-rights.config.js`.

| Field / source signal | Required | Legacy showed | Rebuilt table should show | Source citation(s) |
|---|---|---|---|---|
| outsideDate | yes | Termination trigger/right rows and outside-date detail text. | outside-date pill | components/review/table-configs/termination-rights.config.js, lib/category-summary-features.js |
| recommendationChangeTermination | yes | Termination trigger/right rows and outside-date detail text. | fiduciary-termination-right badge | components/review/table-configs/termination-rights.config.js |
| terminationTriggers | yes | Termination trigger/right rows and outside-date detail text. | termination-trigger pill list | components/review/table-configs/termination-rights.config.js, lib/category-summary-features.js |
| breachStandard | yes | Termination trigger/right rows and outside-date detail text. | breach-threshold pill | components/review/table-configs/termination-rights.config.js |
| curePeriod | no | Termination trigger/right rows and outside-date detail text. | curePeriod as an evidence-backed structured value where populated | components/review/table-configs/termination-rights.config.js, lib/canonical-conditions.js, lib/category-summary-features.js |
| extensionAvailable | no | Termination trigger/right rows and outside-date detail text. | extensionAvailable as an evidence-backed structured value where populated | components/review/table-configs/termination-rights.config.js, lib/category-summary-features.js |
| extensionPeriod | no | Termination trigger/right rows and outside-date detail text. | extensionPeriod as an evidence-backed structured value where populated | components/review/table-configs/termination-rights.config.js, lib/category-summary-features.js |
| extensionTrigger | no | Termination trigger/right rows and outside-date detail text. | extensionTrigger as an evidence-backed structured value where populated | components/review/table-configs/termination-rights.config.js, lib/category-summary-features.js |
| faultBasedExclusion | no | Termination trigger/right rows and outside-date detail text. | faultBasedExclusion as an evidence-backed structured value where populated | components/review/table-configs/termination-rights.config.js, lib/category-summary-features.js |
| mainConcept | no | Termination trigger/right rows and outside-date detail text. | mainConcept as an evidence-backed structured value where populated | components/review/table-configs/termination-rights.config.js, lib/canonical-conditions.js |
| outsideDateISO | no | Termination trigger/right rows and outside-date detail text. | outsideDateISO as an evidence-backed structured value where populated | components/review/table-configs/termination-rights.config.js |
| outsideDateMonths | no | Termination trigger/right rows and outside-date detail text. | outsideDateMonths as an evidence-backed structured value where populated | components/review/table-configs/termination-rights.config.js, lib/category-summary-features.js |
| outsideDateMonthsPostSigning | no | Termination trigger/right rows and outside-date detail text. | outsideDateMonthsPostSigning as an evidence-backed structured value where populated | components/review/table-configs/termination-rights.config.js |
| parentTerminationRightForNonsolicitBreach | no | Termination trigger/right rows and outside-date detail text. | parentTerminationRightForNonsolicitBreach as an evidence-backed structured value where populated | components/review/table-configs/termination-rights.config.js, lib/category-summary-features.js |
| partyWhoCanTerminate | no | Termination trigger/right rows and outside-date detail text. | partyWhoCanTerminate as an evidence-backed structured value where populated | components/review/table-configs/termination-rights.config.js, lib/category-summary-features.js |
| shareholderApprovalFailure | no | Termination trigger/right rows and outside-date detail text. | shareholderApprovalFailure as an evidence-backed structured value where populated | components/review/table-configs/termination-rights.config.js |
| superiorProposalTermination | no | Termination trigger/right rows and outside-date detail text. | superiorProposalTermination as an evidence-backed structured value where populated | components/review/table-configs/termination-rights.config.js |
| voteThreshold | no | Termination trigger/right rows and outside-date detail text. | voteThreshold as an evidence-backed structured value where populated | components/review/table-configs/termination-rights.config.js, lib/category-summary-features.js |

## SEC / Meeting

Legacy components: `CondSingleTable`.
Schema configs: `sec-meeting.config.js`, `approvals-votes.config.js`.

| Field / source signal | Required | Legacy showed | Rebuilt table should show | Source citation(s) |
|---|---|---|---|---|
| proxyFilingDeadline | yes | Proxy/tender filing, meeting, vote, and adjournment detail rows. | proxy-filing-deadline pill | components/review/table-configs/sec-meeting.config.js |
| voteThreshold | yes | Proxy/tender filing, meeting, vote, and adjournment detail rows. | vote-mechanic pill | components/review/table-configs/approvals-votes.config.js, lib/category-summary-features.js |
| adjournmentRights | yes | Proxy/tender filing, meeting, vote, and adjournment detail rows. | adjournment-rights pill | components/review/table-configs/sec-meeting.config.js, components/review/table-configs/approvals-votes.config.js |
| mailingDeadline | no | Proxy/tender filing, meeting, vote, and adjournment detail rows. | mailingDeadline as an evidence-backed structured value where populated | components/review/table-configs/sec-meeting.config.js |
| meetingControlNotes | no | Proxy/tender filing, meeting, vote, and adjournment detail rows. | meetingControlNotes as an evidence-backed structured value where populated | components/review/table-configs/sec-meeting.config.js |
| meetingDeadline | no | Proxy/tender filing, meeting, vote, and adjournment detail rows. | meetingDeadline as an evidence-backed structured value where populated | components/review/table-configs/sec-meeting.config.js, components/review/table-configs/approvals-votes.config.js |
| approvalDefinition | no | Proxy/tender filing, meeting, vote, and adjournment detail rows. | approvalDefinition as an evidence-backed structured value where populated | components/review/table-configs/approvals-votes.config.js |
| companyApprovalMethod | no | Proxy/tender filing, meeting, vote, and adjournment detail rows. | companyApprovalMethod as an evidence-backed structured value where populated | components/review/table-configs/approvals-votes.config.js |
| meetingRecordDate | no | Proxy/tender filing, meeting, vote, and adjournment detail rows. | meetingRecordDate as an evidence-backed structured value where populated | components/review/table-configs/approvals-votes.config.js |
| parentApprovalMethod | no | Proxy/tender filing, meeting, vote, and adjournment detail rows. | parentApprovalMethod as an evidence-backed structured value where populated | components/review/table-configs/approvals-votes.config.js |
| quorum | no | Proxy/tender filing, meeting, vote, and adjournment detail rows. | quorum as an evidence-backed structured value where populated | components/review/table-configs/approvals-votes.config.js |
| quorumRequirement | no | Proxy/tender filing, meeting, vote, and adjournment detail rows. | quorumRequirement as an evidence-backed structured value where populated | components/review/table-configs/approvals-votes.config.js |
| recordDate | no | Proxy/tender filing, meeting, vote, and adjournment detail rows. | recordDate as an evidence-backed structured value where populated | components/review/table-configs/approvals-votes.config.js |
| requiredVote | no | Proxy/tender filing, meeting, vote, and adjournment detail rows. | requiredVote as an evidence-backed structured value where populated | components/review/table-configs/approvals-votes.config.js |
| shareholderApprovalFailure | no | Proxy/tender filing, meeting, vote, and adjournment detail rows. | shareholderApprovalFailure as an evidence-backed structured value where populated | components/review/table-configs/approvals-votes.config.js |
| shareholderApprovalMethodCompany | no | Proxy/tender filing, meeting, vote, and adjournment detail rows. | shareholderApprovalMethodCompany as an evidence-backed structured value where populated | components/review/table-configs/approvals-votes.config.js |
| shareholderApprovalMethodParent | no | Proxy/tender filing, meeting, vote, and adjournment detail rows. | shareholderApprovalMethodParent as an evidence-backed structured value where populated | components/review/table-configs/approvals-votes.config.js |
| stockholderApprovalDefinition | no | Proxy/tender filing, meeting, vote, and adjournment detail rows. | stockholderApprovalDefinition as an evidence-backed structured value where populated | components/review/table-configs/approvals-votes.config.js |
| stockholderMeetingDeadline | no | Proxy/tender filing, meeting, vote, and adjournment detail rows. | stockholderMeetingDeadline as an evidence-backed structured value where populated | components/review/table-configs/approvals-votes.config.js |
| voteFailureTermination | no | Proxy/tender filing, meeting, vote, and adjournment detail rows. | voteFailureTermination as an evidence-backed structured value where populated | components/review/table-configs/approvals-votes.config.js |

## Approvals / Votes

Legacy components: `CondSingleTable`.
Schema configs: `approvals-votes.config.js`.

| Field / source signal | Required | Legacy showed | Rebuilt table should show | Source citation(s) |
|---|---|---|---|---|
| voteThreshold | yes | Approval condition existence and meeting mechanics. | vote-standard pill | components/review/table-configs/approvals-votes.config.js, lib/category-summary-features.js |
| quorumRequirement | yes | Approval condition existence and meeting mechanics. | quorum pill | components/review/table-configs/approvals-votes.config.js |
| dualClassTreatment | yes | Approval condition existence and meeting mechanics. | dual-class treatment pill | components/review/table-configs/approvals-votes.config.js |
| recordDate | yes | Approval condition existence and meeting mechanics. | record-date mechanic pill | components/review/table-configs/approvals-votes.config.js |
| adjournmentRights | no | Approval condition existence and meeting mechanics. | adjournmentRights as an evidence-backed structured value where populated | components/review/table-configs/approvals-votes.config.js |
| approvalDefinition | no | Approval condition existence and meeting mechanics. | approvalDefinition as an evidence-backed structured value where populated | components/review/table-configs/approvals-votes.config.js |
| companyApprovalMethod | no | Approval condition existence and meeting mechanics. | companyApprovalMethod as an evidence-backed structured value where populated | components/review/table-configs/approvals-votes.config.js |
| meetingDeadline | no | Approval condition existence and meeting mechanics. | meetingDeadline as an evidence-backed structured value where populated | components/review/table-configs/approvals-votes.config.js |
| meetingRecordDate | no | Approval condition existence and meeting mechanics. | meetingRecordDate as an evidence-backed structured value where populated | components/review/table-configs/approvals-votes.config.js |
| parentApprovalMethod | no | Approval condition existence and meeting mechanics. | parentApprovalMethod as an evidence-backed structured value where populated | components/review/table-configs/approvals-votes.config.js |
| quorum | no | Approval condition existence and meeting mechanics. | quorum as an evidence-backed structured value where populated | components/review/table-configs/approvals-votes.config.js |
| requiredVote | no | Approval condition existence and meeting mechanics. | requiredVote as an evidence-backed structured value where populated | components/review/table-configs/approvals-votes.config.js |
| shareholderApprovalFailure | no | Approval condition existence and meeting mechanics. | shareholderApprovalFailure as an evidence-backed structured value where populated | components/review/table-configs/approvals-votes.config.js |
| shareholderApprovalMethodCompany | no | Approval condition existence and meeting mechanics. | shareholderApprovalMethodCompany as an evidence-backed structured value where populated | components/review/table-configs/approvals-votes.config.js |
| shareholderApprovalMethodParent | no | Approval condition existence and meeting mechanics. | shareholderApprovalMethodParent as an evidence-backed structured value where populated | components/review/table-configs/approvals-votes.config.js |
| stockholderApprovalDefinition | no | Approval condition existence and meeting mechanics. | stockholderApprovalDefinition as an evidence-backed structured value where populated | components/review/table-configs/approvals-votes.config.js |
| stockholderMeetingDeadline | no | Approval condition existence and meeting mechanics. | stockholderMeetingDeadline as an evidence-backed structured value where populated | components/review/table-configs/approvals-votes.config.js |
| voteFailureTermination | no | Approval condition existence and meeting mechanics. | voteFailureTermination as an evidence-backed structured value where populated | components/review/table-configs/approvals-votes.config.js |

## Employee Benefits

Legacy components: `CompensationItemsTable`.
Schema configs: `employee-benefits.config.js`.

| Field / source signal | Required | Legacy showed | Rebuilt table should show | Source citation(s) |
|---|---|---|---|---|
| compensationItems | yes | Compensation item rows and employment covenant detail text. | structured compensation object rows | components/review/table-configs/employee-benefits.config.js |
| comparisonGroup | yes | Compensation item rows and employment covenant detail text. | comparison-group pill | components/review/table-configs/employee-benefits.config.js |
| benefitStandard | yes | Compensation item rows and employment covenant detail text. | benefit-standard pill | components/review/table-configs/employee-benefits.config.js |
| bundling | yes | Compensation item rows and employment covenant detail text. | aggregate/bundled-test badge | components/review/table-configs/employee-benefits.config.js |
| baseSalaryStandard | no | Compensation item rows and employment covenant detail text. | baseSalaryStandard as an evidence-backed structured value where populated | components/review/table-configs/employee-benefits.config.js, lib/category-summary-features.js |
| benefitsStandard | no | Compensation item rows and employment covenant detail text. | benefitsStandard as an evidence-backed structured value where populated | components/review/table-configs/employee-benefits.config.js, lib/category-summary-features.js |
| bonusStandard | no | Compensation item rows and employment covenant detail text. | bonusStandard as an evidence-backed structured value where populated | components/review/table-configs/employee-benefits.config.js, lib/category-summary-features.js |
| healthWelfareStandard | no | Compensation item rows and employment covenant detail text. | healthWelfareStandard as an evidence-backed structured value where populated | components/review/table-configs/employee-benefits.config.js, lib/category-summary-features.js |
| longTermIncentiveStandard | no | Compensation item rows and employment covenant detail text. | longTermIncentiveStandard as an evidence-backed structured value where populated | components/review/table-configs/employee-benefits.config.js, lib/category-summary-features.js |
| ltiStandard | no | Compensation item rows and employment covenant detail text. | ltiStandard as an evidence-backed structured value where populated | components/review/table-configs/employee-benefits.config.js, lib/category-summary-features.js |
| severanceStandard | no | Compensation item rows and employment covenant detail text. | severanceStandard as an evidence-backed structured value where populated | components/review/table-configs/employee-benefits.config.js, lib/category-summary-features.js |
| targetBonusStandard | no | Compensation item rows and employment covenant detail text. | targetBonusStandard as an evidence-backed structured value where populated | components/review/table-configs/employee-benefits.config.js, lib/category-summary-features.js |

## No Other Reps / Fraud

Legacy components: `CategoryFeatureSummaryTable`.
Schema configs: `no-other-reps-fraud.config.js`.

| Field / source signal | Required | Legacy showed | Rebuilt table should show | Source citation(s) |
|---|---|---|---|---|
| noOtherRepsScope | yes | Abry four-question checklist and fraud silence/detail rows. | scope pill | components/review/table-configs/no-other-reps-fraud.config.js |
| nonRelianceScope | yes | Abry four-question checklist and fraud silence/detail rows. | non-reliance scope pill | components/review/table-configs/no-other-reps-fraud.config.js |
| fraudCarveout | yes | Abry four-question checklist and fraud silence/detail rows. | fraud carve-out badge | components/review/table-configs/no-other-reps-fraud.config.js |

## Advisers / Fees / Expenses

Legacy components: `MiscSummaryTable`.
Schema configs: `advisers-fees-expenses.config.js`.

| Field / source signal | Required | Legacy showed | Rebuilt table should show | Source citation(s) |
|---|---|---|---|---|
| feeExpenseAllocation | yes | General fee/expense, adviser, governing-law, forum, and remedy rows. | fee/expense allocation pill | components/review/table-configs/advisers-fees-expenses.config.js, lib/category-summary-features.js |
| feeExpenseExceptions | yes | General fee/expense, adviser, governing-law, forum, and remedy rows. | expense-exceptions pill list | components/review/table-configs/advisers-fees-expenses.config.js |
| adviserFees | yes | General fee/expense, adviser, governing-law, forum, and remedy rows. | adviser-fee badge | components/review/table-configs/advisers-fees-expenses.config.js |
| brokerFees | no | General fee/expense, adviser, governing-law, forum, and remedy rows. | brokerFees as an evidence-backed structured value where populated | components/review/table-configs/advisers-fees-expenses.config.js |
| companyAdvisor | no | General fee/expense, adviser, governing-law, forum, and remedy rows. | companyAdvisor as an evidence-backed structured value where populated | components/review/table-configs/advisers-fees-expenses.config.js |
| companyFinancialAdvisor | no | General fee/expense, adviser, governing-law, forum, and remedy rows. | companyFinancialAdvisor as an evidence-backed structured value where populated | components/review/table-configs/advisers-fees-expenses.config.js |
| expenseExceptions | no | General fee/expense, adviser, governing-law, forum, and remedy rows. | expenseExceptions as an evidence-backed structured value where populated | components/review/table-configs/advisers-fees-expenses.config.js |
| expensesAllocation | no | General fee/expense, adviser, governing-law, forum, and remedy rows. | expensesAllocation as an evidence-backed structured value where populated | components/review/table-configs/advisers-fees-expenses.config.js |
| financialAdvisorFees | no | General fee/expense, adviser, governing-law, forum, and remedy rows. | financialAdvisorFees as an evidence-backed structured value where populated | components/review/table-configs/advisers-fees-expenses.config.js |
| governingLaw | no | General fee/expense, adviser, governing-law, forum, and remedy rows. | governingLaw as an evidence-backed structured value where populated | components/review/table-configs/advisers-fees-expenses.config.js, lib/category-summary-features.js |
| jurisdictionExclusive | no | General fee/expense, adviser, governing-law, forum, and remedy rows. | jurisdictionExclusive as an evidence-backed structured value where populated | components/review/table-configs/advisers-fees-expenses.config.js, lib/category-summary-features.js |
| jurisdictionExclusiveText | no | General fee/expense, adviser, governing-law, forum, and remedy rows. | jurisdictionExclusiveText as an evidence-backed structured value where populated | components/review/table-configs/advisers-fees-expenses.config.js |
| parentAdvisor | no | General fee/expense, adviser, governing-law, forum, and remedy rows. | parentAdvisor as an evidence-backed structured value where populated | components/review/table-configs/advisers-fees-expenses.config.js |
| parentFinancialAdvisor | no | General fee/expense, adviser, governing-law, forum, and remedy rows. | parentFinancialAdvisor as an evidence-backed structured value where populated | components/review/table-configs/advisers-fees-expenses.config.js |
| specificPerformance | no | General fee/expense, adviser, governing-law, forum, and remedy rows. | specificPerformance as an evidence-backed structured value where populated | components/review/table-configs/advisers-fees-expenses.config.js, lib/category-summary-features.js |
| thirdPartyBeneficiaryExceptions | no | General fee/expense, adviser, governing-law, forum, and remedy rows. | thirdPartyBeneficiaryExceptions as an evidence-backed structured value where populated | components/review/table-configs/advisers-fees-expenses.config.js, lib/category-summary-features.js |
