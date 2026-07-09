# M2-08 Coverage — 2026-07-08T16:48:38.762Z

WP-M2-08 Step 3 verification of the Step 1 legacy layout inventory after the Step 2 schema-first config additions.

Surface coverage: 16/16 (100%).
Step 1 gap coverage: 9/9 (100%).

| Rank | Legacy surface | Step 1 status | Slot | Schema-first config(s) | Coverage | Justification |
|---:|---|---|---|---|---:|---|
| 1 | Structure & Mechanics | gap | deal-mechanics | structure-mechanics.config.js | 100% | Schema-first config is present and mounted before the raw card table. |
| 2 | Antitrust / Regulatory Summary | gap | covenants | antitrust-regulatory.config.js | 100% | Schema-first config is present and mounted before the raw card table. |
| 3 | MAE Definition Summary | gap | mae | mae-definitions.config.js | 100% | Schema-first config is present and mounted before the raw card table. |
| 4 | Termination Rights Summary | gap | termination | termination-rights.config.js | 100% | Schema-first config is present and mounted before the raw card table. |
| 5 | Termination Fee Matrix | gap | termination | termination-fees.config.js | 100% | Schema-first config is present and mounted before the raw card table. |
| 6 | General Covenants | gap | covenants | general-covenants.config.js | 100% | Schema-first config is present and mounted before the raw card table. |
| 7 | Approvals / Votes | gap | conditions | approvals-votes.config.js | 100% | Schema-first config is present and mounted before the raw card table. |
| 8 | Advisers / Fees / Expenses | gap | misc | advisers-fees-expenses.config.js | 100% | Schema-first config is present and mounted before the raw card table. |
| 9 | Representation Qualifiers | gap | reps | representations-qualifiers.config.js | 100% | Schema-first config is present and mounted before the raw card table. |
| 10 | Consideration Hero | mapped | consideration | consideration-hero.config.js | 100% | Schema-first config is present and mounted before the raw card table. |
| 11 | Closing Conditions | mapped | conditions | conditions-m.config.js, conditions-b.config.js, conditions-s.config.js | 100% | Schema-first config is present and mounted before the raw card table. |
| 12 | Material Contracts | mapped | reps | material-contracts.config.js | 100% | Schema-first config is present and mounted before the raw card table. |
| 13 | No-Shop / Fiduciary-Out Stack | mapped | covenants | nosol-section.config.js | 100% | Schema-first config is present and mounted before the raw card table. |
| 14 | Employee Benefits | mapped | covenants | employee-benefits.config.js | 100% | Schema-first config is present and mounted before the raw card table. |
| 15 | SEC Meeting / Tender-Offer Filings | mapped | covenants | sec-meeting.config.js | 100% | Schema-first config is present and mounted before the raw card table. |
| 16 | No Other Reps / Fraud | mapped | misc | no-other-reps-fraud.config.js | 100% | Schema-first config is present and mounted before the raw card table. |

## Uncovered

None.

## Notes

- No intentionally uncovered legacy surface remains.
- Detailed CVR modelling stays outside M2-08; the consideration surface itself is covered by `consideration-hero.config.js`.
- Full-corpus schema parity remains enforced separately by the `schema-parity` CI check.
