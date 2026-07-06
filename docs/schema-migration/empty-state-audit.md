# WP-SCHEMA Empty-State Audit

Generated: 2026-07-06T03:40:21.899Z

Corpus: 25 deals, 7667 provisions.

Feature opportunities: 150432; populated: 13978; empty: 136454.

Proposed states: extraction_pending=3, needs_review=1, silent=519, not_applicable=1.

## Proposed State Changes

No state changes proposed.

## Candidate Signals

These are triage signals only. They do not change empty-state policy unless the registry is explicitly updated.

| Feature | Group | Current | Proposed | Total | Populated | Empty | Notes |
|---|---:|---:|---:|---:|---:|---:|---|
| `mainConcept` | Regulatory | extraction_pending | extraction_pending | 1168 | 1081 | 87 |  |
| `permittedExceptions` | Interim covenants | extraction_pending | extraction_pending | 3 | 0 | 3 | EXCEPTION_CODES, citable |
| `negativePreambleExceptions` | Interim covenants | extraction_pending | extraction_pending | 1 | 0 | 1 | EXCEPTION_CODES, citable |
| `materialContractsBuckets` | Representations | needs_review | needs_review | 24 | 24 | 0 | MATERIAL_CONTRACT_BUCKET_CODES, citable |
| `tsaContemplated` | Interim covenants | silent | silent | 382 | 0 | 382 | benchmarkable, citable |
| `materialityScrape` | Representations | silent | silent | 359 | 0 | 359 | benchmarkable, citable |
| `materialityScrapePresent` | Representations | silent | silent | 277 | 0 | 277 | benchmarkable, citable |
| `secFilingsLookbackMonths` | Representations | silent | silent | 277 | 0 | 277 | benchmarkable, citable |
| `topCustomersSuppliersRepPresent` | Representations | silent | silent | 277 | 0 | 277 | benchmarkable, citable |
| `antiClubbingWaiverPermitted` | Fiduciary out | silent | silent | 198 | 0 | 198 | benchmarkable, citable |
| `boardChangeForInterveningEvent` | Fiduciary out | silent | silent | 198 | 0 | 198 | benchmarkable, citable |
| `dontAskDontWaive` | Fiduciary out | silent | silent | 198 | 0 | 198 | benchmarkable, citable |
| `extendedNegotiatingPeriodDays` | Fiduciary out | silent | silent | 198 | 0 | 198 | benchmarkable, citable |
| `goShopPeriodDays` | Fiduciary out | silent | silent | 198 | 0 | 198 | benchmarkable, citable |
| `goShopPresent` | Fiduciary out | silent | silent | 198 | 0 | 198 | benchmarkable, citable |
| `interveningEventProvision` | Fiduciary out | silent | silent | 198 | 0 | 198 | benchmarkable, citable |
| `interveningEventScope` | Fiduciary out | silent | silent | 198 | 0 | 198 | benchmarkable, citable |
| `parentTerminationRightForNonsolicitBreach` | Fiduciary out | silent | silent | 198 | 0 | 198 | benchmarkable, citable |
| `standstillWaiver` | Fiduciary out | silent | silent | 198 | 0 | 198 | benchmarkable, citable |
| `standstillWaiverPermitted` | Fiduciary out | silent | silent | 198 | 0 | 198 | benchmarkable, citable |
| `lookbackTiedToIncorporation` | Representations | silent | silent | 661 | 8 | 653 | benchmarkable |
| `mutualClosingDeadlineAfterConditionsDays` | Deal certainty | silent | silent | 157 | 0 | 157 | benchmarkable, citable |
| `willfulBreachDefinition` | Definitions | silent | silent | 3751 | 11 | 3740 | benchmarkable, citable |
| `cyberSecurityCarveout` | Definitions | silent | silent | 3421 | 9 | 3412 | benchmarkable, citable |
| `preventDelayProng` | Definitions | silent | silent | 3421 | 18 | 3403 | benchmarkable, citable |
| `disproportionateImpact` | Definitions | silent | silent | 3421 | 25 | 3396 | benchmarkable, citable |
| `covenantComplianceStandard` | Interim covenants | silent | silent | 382 | 2 | 380 | benchmarkable, citable |
| `cvrIncluded` | Interim covenants | silent | silent | 382 | 2 | 380 | benchmarkable, citable |
| `financingCooperationBreachIsCondition` | Interim covenants | silent | silent | 382 | 5 | 377 | benchmarkable, citable |
| `publicStatementsJointApproval` | Interim covenants | silent | silent | 382 | 10 | 372 | benchmarkable, citable |
| `financingCooperation` | Interim covenants | silent | silent | 382 | 13 | 369 | benchmarkable, citable |
| `financingCooperationPresent` | Interim covenants | silent | silent | 382 | 13 | 369 | benchmarkable, citable |
| `expenseReimbursementCap` | Termination | silent | silent | 137 | 0 | 137 | benchmarkable, citable |
| `feeAmount` | Termination | silent | silent | 137 | 0 | 137 | benchmarkable, citable |
| `feePercentage` | Termination | silent | silent | 137 | 0 | 137 | benchmarkable, citable |
| `feeSoleAndExclusiveRemedy` | Termination | silent | silent | 137 | 0 | 137 | benchmarkable, citable |
| `nakedNoVoteFeeAmount` | Termination | silent | silent | 137 | 0 | 137 | benchmarkable, citable |
| `nakedNoVoteFeePresent` | Termination | silent | silent | 137 | 0 | 137 | benchmarkable, citable |
| `reverseFeeAmount` | Termination | silent | silent | 137 | 0 | 137 | benchmarkable, citable |
| `reverseFeePercentage` | Termination | silent | silent | 137 | 0 | 137 | benchmarkable, citable |
| `tailFeeSameProposalRequired` | Termination | silent | silent | 137 | 0 | 137 | benchmarkable, citable |
| `tailFeeThresholdPct` | Termination | silent | silent | 137 | 0 | 137 | benchmarkable, citable |
| `tailFeeTriggerAltAnnouncedDuringPendency` | Termination | silent | silent | 137 | 0 | 137 | benchmarkable, citable |
| `tailFeeTriggerConsummatedDuringTail` | Termination | silent | silent | 137 | 0 | 137 | benchmarkable, citable |
| `tailFeeTriggerEndDate` | Termination | silent | silent | 137 | 0 | 137 | benchmarkable, citable |
| `tailFeeTriggerNakedNoVote` | Termination | silent | silent | 137 | 0 | 137 | benchmarkable, citable |
| `tailFeeWindowMonths` | Termination | silent | silent | 137 | 0 | 137 | benchmarkable, citable |
| `terminationFeePercentEquityValue` | Termination | silent | silent | 137 | 0 | 137 | benchmarkable, citable |
| `bringDownStandard` | Deal certainty | silent | silent | 359 | 0 | 359 | benchmarkable |
| `fundsCondition` | Deal certainty | silent | silent | 95 | 0 | 95 | benchmarkable, citable |
| `antiRelianceRepPresent` | Representations | silent | silent | 82 | 0 | 82 | benchmarkable, citable |
| `parentBrokersRepPresent` | Representations | silent | silent | 82 | 0 | 82 | benchmarkable, citable |
| `parentLitigationRepPresent` | Representations | silent | silent | 82 | 0 | 82 | benchmarkable, citable |
| `parentOwnershipRepPresent` | Representations | silent | silent | 82 | 0 | 82 | benchmarkable, citable |
| `solvencyRepPresent` | Representations | silent | silent | 82 | 0 | 82 | benchmarkable, citable |
| `sufficientFundsRepPresent` | Representations | silent | silent | 82 | 0 | 82 | benchmarkable, citable |
| `extensionMutualOrUnilateral` | Fiduciary out | silent | silent | 54 | 0 | 54 | benchmarkable, citable |
| `extensionParty` | Fiduciary out | silent | silent | 54 | 0 | 54 | benchmarkable, citable |
| `finalAndNonappealableRequired` | Fiduciary out | silent | silent | 54 | 0 | 54 | benchmarkable, citable |
| `lawOrderTerminationPresent` | Fiduciary out | silent | silent | 54 | 0 | 54 | benchmarkable, citable |
| `lostPremiumDamagesPursuit` | Fiduciary out | silent | silent | 54 | 0 | 54 | benchmarkable, citable |
| `marketOutHolder` | Fiduciary out | silent | silent | 54 | 0 | 54 | benchmarkable, citable |
| `adsPresent` | Structure | silent | silent | 32 | 0 | 32 | benchmarkable, citable |
| `shareholderApprovalMethodParent` | Structure | silent | silent | 32 | 0 | 32 | benchmarkable, citable |
| `effortsStandardDiffersByRemedy` | Regulatory | silent | silent | 28 | 0 | 28 | benchmarkable, citable |
| `clearSkiesCompany` | Regulatory | silent | silent | 241 | 1 | 240 | benchmarkable, citable |
| `substantialComplianceDeadlineDays` | Regulatory | silent | silent | 241 | 1 | 240 | benchmarkable, citable |
| `partyControlsStrategy` | Regulatory | silent | silent | 241 | 2 | 239 | benchmarkable, citable |
| `pullAndRefileCompanyConsent` | Regulatory | silent | silent | 241 | 3 | 238 | benchmarkable, citable |
| `pullAndRefileRight` | Regulatory | silent | silent | 241 | 3 | 238 | benchmarkable, citable |
| `clearSkiesParent` | Regulatory | silent | silent | 241 | 4 | 237 | benchmarkable, citable |
| `interimOperatingRestrictions` | Regulatory | silent | silent | 241 | 7 | 234 | benchmarkable, citable |
| `timingAgreementsProhibited` | Regulatory | silent | silent | 241 | 8 | 233 | benchmarkable, citable |
| `parentLitigationObligation` | Regulatory | silent | silent | 241 | 12 | 229 | benchmarkable, citable |
| `noSetoffPresent` | Boilerplate | silent | silent | 330 | 0 | 330 | benchmarkable, citable |
| `willfulBreachCoversOmissions` | Boilerplate | silent | silent | 330 | 0 | 330 | benchmarkable, citable |
| `willfulBreachLimitedToMaterial` | Boilerplate | silent | silent | 330 | 0 | 330 | benchmarkable, citable |
| `willfulBreachRequiresActualKnowledge` | Boilerplate | silent | silent | 330 | 0 | 330 | benchmarkable, citable |
| `forceTheVote` | Fiduciary out | silent | silent | 198 | 1 | 197 | benchmarkable, citable |
| `subsequentMatchPeriodDays` | Fiduciary out | silent | silent | 198 | 2 | 196 | benchmarkable, citable |

## Top Audit Rows

| Feature | Group | Current | Proposed | Total | Populated | Empty | Notes |
|---|---:|---:|---:|---:|---:|---:|---|
| `mainConcept` | Regulatory | extraction_pending | extraction_pending | 1168 | 1081 | 87 |  |
| `permittedExceptions` | Interim covenants | extraction_pending | extraction_pending | 3 | 0 | 3 | EXCEPTION_CODES, citable |
| `negativePreambleExceptions` | Interim covenants | extraction_pending | extraction_pending | 1 | 0 | 1 | EXCEPTION_CODES, citable |
| `materialContractsBuckets` | Representations | needs_review | needs_review | 24 | 24 | 0 | MATERIAL_CONTRACT_BUCKET_CODES, citable |
| `tsaContemplated` | Interim covenants | silent | silent | 382 | 0 | 382 | benchmarkable, citable |
| `materialityScrape` | Representations | silent | silent | 359 | 0 | 359 | benchmarkable, citable |
| `materialityScrapePresent` | Representations | silent | silent | 277 | 0 | 277 | benchmarkable, citable |
| `secFilingsLookbackMonths` | Representations | silent | silent | 277 | 0 | 277 | benchmarkable, citable |
| `topCustomersSuppliersRepPresent` | Representations | silent | silent | 277 | 0 | 277 | benchmarkable, citable |
| `antiClubbingWaiverPermitted` | Fiduciary out | silent | silent | 198 | 0 | 198 | benchmarkable, citable |
| `boardChangeForInterveningEvent` | Fiduciary out | silent | silent | 198 | 0 | 198 | benchmarkable, citable |
| `dontAskDontWaive` | Fiduciary out | silent | silent | 198 | 0 | 198 | benchmarkable, citable |
| `extendedNegotiatingPeriodDays` | Fiduciary out | silent | silent | 198 | 0 | 198 | benchmarkable, citable |
| `goShopPeriodDays` | Fiduciary out | silent | silent | 198 | 0 | 198 | benchmarkable, citable |
| `goShopPresent` | Fiduciary out | silent | silent | 198 | 0 | 198 | benchmarkable, citable |
| `interveningEventProvision` | Fiduciary out | silent | silent | 198 | 0 | 198 | benchmarkable, citable |
| `interveningEventScope` | Fiduciary out | silent | silent | 198 | 0 | 198 | benchmarkable, citable |
| `parentTerminationRightForNonsolicitBreach` | Fiduciary out | silent | silent | 198 | 0 | 198 | benchmarkable, citable |
| `standstillWaiver` | Fiduciary out | silent | silent | 198 | 0 | 198 | benchmarkable, citable |
| `standstillWaiverPermitted` | Fiduciary out | silent | silent | 198 | 0 | 198 | benchmarkable, citable |
| `lookbackTiedToIncorporation` | Representations | silent | silent | 661 | 8 | 653 | benchmarkable |
| `mutualClosingDeadlineAfterConditionsDays` | Deal certainty | silent | silent | 157 | 0 | 157 | benchmarkable, citable |
| `willfulBreachDefinition` | Definitions | silent | silent | 3751 | 11 | 3740 | benchmarkable, citable |
| `cyberSecurityCarveout` | Definitions | silent | silent | 3421 | 9 | 3412 | benchmarkable, citable |
| `preventDelayProng` | Definitions | silent | silent | 3421 | 18 | 3403 | benchmarkable, citable |
| `disproportionateImpact` | Definitions | silent | silent | 3421 | 25 | 3396 | benchmarkable, citable |
| `covenantComplianceStandard` | Interim covenants | silent | silent | 382 | 2 | 380 | benchmarkable, citable |
| `cvrIncluded` | Interim covenants | silent | silent | 382 | 2 | 380 | benchmarkable, citable |
| `financingCooperationBreachIsCondition` | Interim covenants | silent | silent | 382 | 5 | 377 | benchmarkable, citable |
| `publicStatementsJointApproval` | Interim covenants | silent | silent | 382 | 10 | 372 | benchmarkable, citable |
| `financingCooperation` | Interim covenants | silent | silent | 382 | 13 | 369 | benchmarkable, citable |
| `financingCooperationPresent` | Interim covenants | silent | silent | 382 | 13 | 369 | benchmarkable, citable |
| `publicStatementsCarveoutParent` | Interim covenants | silent | silent | 382 | 20 | 362 | benchmarkable, citable |
| `publicStatementsCarveoutCompany` | Interim covenants | silent | silent | 382 | 23 | 359 | benchmarkable, citable |
| `expenseReimbursementCap` | Termination | silent | silent | 137 | 0 | 137 | benchmarkable, citable |
| `feeAmount` | Termination | silent | silent | 137 | 0 | 137 | benchmarkable, citable |
| `feePercentage` | Termination | silent | silent | 137 | 0 | 137 | benchmarkable, citable |
| `feeSoleAndExclusiveRemedy` | Termination | silent | silent | 137 | 0 | 137 | benchmarkable, citable |
| `nakedNoVoteFeeAmount` | Termination | silent | silent | 137 | 0 | 137 | benchmarkable, citable |
| `nakedNoVoteFeePresent` | Termination | silent | silent | 137 | 0 | 137 | benchmarkable, citable |

## Notes

- `scheduleReference` stays low-value metadata and remains silent.
- `materialContractsBuckets` is reviewed when empty because the field is useful but the legal bucket universe is not closed.
- `permittedExceptions` and `negativePreambleExceptions` are extraction pending when empty because silence cannot be trusted until targeted exception extraction runs; `OTHER` with verbatim text is required when no code fits.
- `mainConcept` is extraction pending when empty because it is the admin/search fallback, not a legal absence.
- Benchmarkable low-population fields remain candidate signals, not automatic `needs_review` states.
