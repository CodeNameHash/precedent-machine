# Step 2X-K decision ledger

Date: 2026-08-08. Branch: `cursor/step-2x-free-phase-b641`.

This ledger records the decisions made after the green baseline. A promotion
uses an existing claim definition and an exact operative-text check. A deferral
keeps the candidate as evidence. It does not create a new legal fact.

## Baseline and product correction

`CI=true npm test` passed: 8,378 tests, 8,333 passed, 45 skipped, zero failed.

The No-Shop cross-view now labels a null code as `Not captured`, not `Not
applicable`. The neighbouring missing-party and missing-trigger labels remain
unchanged. The focused cross-surface test passed.

## 2X-B adjudication

**Decision: HOLD and report-only.** The second-chance report contains exactly
three General Covenant would-resolves. It records evidence but never resolves
or promotes a claim. No primary-pattern change is authorised by this report.

| code | evidence | decision |
|---|---|---|
| `COV-TAKEOVER` | Two Concho clauses require all Parties to avoid or exempt the Transactions from `Takeover Laws` | HOLD. Two report-only would-resolves. Do not auto-promote. |
| `COV-SECREPORT` | Metsera clause requires the `Post-Closing SEC Reports` to meet content and legal-compliance standards | HOLD. One report-only would-resolve. Do not auto-promote. |

The direct quote checks and hostile cross-code checks pass. Noun-only mentions
of Takeover Laws, Post-Closing SEC Reports and SEC filings do not corroborate.
These checks explain why the report surfaced the three rows; they do not change
the HOLD decision.

## 2X-G disposition

Scan: 169 newest runs, 25 shapes with at least three deals, 25 gate passes.
The scan reads committed evidence. It therefore continues to list a shape
after a code change until the source run is replayed.

| shape | deals | decision | reason |
|---|---:|---|---|
| `NATIVE_OPEN_WORLD_PROPOSAL` | 7 | Deferred | One carrier covers unrelated facts across 25 families. It has no stable identity. |
| `REPRESENTATION_QUALIFIER_KIND_NOT_GOVERNED` | 7 | Deferred | The quotes mix temporal, threshold and materiality qualifiers. No existing qualifier value covers the set. |
| Proxy `ADJOURNMENT_CONSENT_OVERRIDE` | 6 | Deferred | It needs a new proxy-meeting claim definition and projection field. |
| `SOLE_REMEDY_FEE_CONTEXT_LINKED` | 6 | Deferred | Fee caps, remedies and exceptions vary. The present claim is not a stable sole-remedy value. |
| No-Shop `REQUEST_RETURN_OR_DESTRUCTION_OF_INFORMATION` | 6 | Already promoted | Existing `NO_SHOP_CEASE_ACTION` value. The 2X-G gate and source corroboration were already landed. |
| Proxy `MAILING_DEADLINE` | 6 | Deferred | It needs a new proxy-meeting claim definition and duration model. |
| Material-contract threshold `USD` | 5 | Deferred | A unit is not a material-contract bucket. The amount, period and comparison rule need separate fields. |
| Tax `INTENDED_TREATMENT` | 5 | Deferred | The current enum only accepts exact Section 351 or 368 treatment. Several quotes are intent or representation language without that anchor. |
| Proxy `ADJOURNMENT_CONTROL` | 5 | Deferred | It needs a new proxy-meeting claim definition and party-control model. |
| Closing-condition `BRING_DOWN_TIER` | 4 | Deferred | The proposed accuracy values are outside the controlled accuracy vocabulary. A new value requires separate adjudication. |
| General covenant `COV-ACCESS` | 4 | Deferred | The narrow quotes mix access, information delivery and confidentiality. A broad `furnish information` pattern would overmatch. |
| Tax `TREATMENT_PROTECTION` | 4 | Deferred | The set mixes REIT-status maintenance, reporting, notice of challenge and tax-return filing. One protection pattern would collapse different covenants. |
| General covenant `COV-MERGESUB` | 4 | Promoted | Existing code. Four replays each resolve the recurring clause. The pattern binds `cause` plus Merger Sub, the Surviving Corporation or plural Merger Subsidiaries directly to `to perform`, `to comply` or `to fulfil`. It rejects a split-subject sentence and a mere joint obligor. |
| Material-contract `NONCOMPETE` | 4 | Promoted | Existing bucket. Four exact quotes produce five resolved claims: one bucket claim in Metsera, Red Hat and TopBuild, plus a bucket claim and its paired threshold claim in Modiv. Patterns require right or ability to compete, prohibit from competing, or the exact type or manner of business operative shape. Each quote sole-matches `NONCOMPETE` across the complete material-contract bucket table. Hostile tests reject competing-bidder payment, marketing-budget and regulator-engagement language. |
| Material-contract `AGGREGATE_PAYMENTS` | 3 | Deferred | The quotes use payments, expenditures and receipts. They do not identify one stable aggregate-payments bucket. |
| No-Shop hour notice | 3 | Deferred | The parser detects a duration but the governed notice-period value has no hour unit. Do not convert hours into a day value. |
| Representation qualifier `NOT_EXACT` | 3 | Deferred | The quotes are knowledge qualifiers. They are not an exact accuracy standard. |
| IOC `RESTRICTION_PRESENT` | 3 | Deferred | The quotes state a restriction but do not supply a governed restriction category. |
| Material-contract `IP_LICENSES_IN` | 3 | Deferred | The same clauses grant and receive IP rights. The evidence cannot safely choose inbound rather than outbound. |
| Material-contract `SUPPLY` | 3 | Deferred | The evidence mixes top suppliers and general goods or services contracts. The latter is not a reliable supplier bucket. |
| General covenant `COV-NOTIFY` | 3 | Deferred | The quotes include status updates, embedded notice clauses and a narrowed fragment without an operative actor. A single broad notification regex is unsafe. |
| Material-contract `MA_AGREEMENTS` | 3 | Deferred | The narrow quotes describe acquisitions or dispositions without reliably retaining the contract or agreement limb. |
| Appraisal `SETTLEMENT_CONSENT` | 3 | Deferred | The narrowed quotes omit the appraisal anchor and say only `such demand`. Do not relax the standalone appraisal check without the missing context. |
| Material-contract `IP_LICENSES_OUT` | 3 | Deferred | The same clauses grant and receive IP rights. The evidence cannot safely choose outbound rather than inbound. |
| Material-contract `AFFILIATE_TRANSACTIONS` | 3 | Deferred | Item 404 and officer or director references can also describe another contract bucket. The candidate quote lacks a stable related-party anchor. |

## Verification

Focused checks passed:

- Combined cross-surface, General Covenant, Material Contracts and exact
  replay suite: 68 passed, zero failed.
- 2X-B report: two Concho `COV-TAKEOVER` rows and one Metsera
  `COV-SECREPORT` row are would-resolves. All three remain HOLD and report-only;
  none is auto-promoted.
- 2X-G exact replays: each of four `COV-MERGESUB` and four `NONCOMPETE` runs
  resolve five claims, including Modiv's paired bucket and threshold claims,
  with no target-specific unresolved result.
- Collision scan: 177 General Covenant quotes checked, zero collisions after
  two governed `COV-LITNOTIFY` specificity decisions; 32 tax-cooperation
  quotes checked, zero collisions.
- Full baseline before these focused changes: 8,333 passed, zero failed.
