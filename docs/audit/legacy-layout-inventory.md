# Legacy Layout Inventory — 2026-07-08T16:33:09.282Z

WP-M2-08 Step 1 static inventory of structured review-page surfaces against the M2-06 config set.

| Rank | Surface | Slot | Legacy selector | M2-06 mapping | Status | Source |
|---:|---|---|---|---|---|---|
| 1 | Structure & Mechanics | deal-mechanics | STRUCT provisions; dealStructure, mergerForm, offer, closing, effects, effective-time, governance fields | Partial overlap only: consideration-hero and sec-meeting cover economics / SEC offer filings, not the full structure table. | gap | pages/review/[id].js:3748 |
| 2 | Antitrust / Regulatory Summary | covenants | ANTI provisions plus antitrust condition and TERMR outside-date context | No M2-06 config maps ANTI fields. | gap | pages/review/[id].js:9125 |
| 3 | MAE Definition Summary | mae | MAE-DEF / MAE-DEF-P and MAE-like DEF/REP provisions; carveouts, disproportionality, prevent-delay, test limbs | No M2-06 config maps MAE definition fields. | gap | pages/review/[id].js:8297 |
| 4 | Termination Rights Summary | termination | TERMR-M / TERMR-B / TERMR-T provisions; outside date, extensions, vote failure, breach, change-of-recommendation, superior-proposal rights | tail-fee.config.js covers tail-fee mechanics only, not termination rights. | gap | pages/review/[id].js:167 |
| 5 | Termination Fee Matrix | termination | TERMF provisions; target fee, reverse fee, regulatory ticking fee, tail mechanics, remedy effect | tail-fee.config.js maps only the tail mechanics subset. | gap | pages/review/[id].js:5616 |
| 6 | General Covenants | covenants | COV provisions plus IOC affirmative and negative covenant rows; efforts, access, public statements, insurance, ordinary-course restrictions | ioc-exceptions.config.js covers exception preambles, not affirmative/negative covenant substance. | gap | pages/review/[id].js:8747 |
| 7 | Approvals / Votes | conditions | COND-M-STOCKHOLDER, TERMR-VOTE, STRUCT shareholder-approval fields; vote threshold, quorum, record-date, dual-class mechanics | conditions-m.config.js and sec-meeting.config.js cover existence / meeting mechanics, not vote-standard mechanics. | gap | pages/review/[id].js:167 |
| 8 | Advisers / Fees / Expenses | misc | MISC provisions; fee-expense allocation, jurisdiction, governing law, specific performance, adviser fees where extracted | No M2-06 config maps non-termination fee/expense allocation or adviser-fee misc rows. | gap | pages/review/[id].js:8895 |
| 9 | Representation Qualifiers | reps | REP-T / REP-B plus COND-B-REP / COND-S-REP; materiality, knowledge, bring-down tiers, SEC filing carve-outs, schedules | conditions-b/s configs show bring-down condition existence, not the rep-side qualifier and exception package. | gap | pages/review/[id].js:6995 |
| 10 | Consideration Hero | consideration | CONSID / CONSID-CVR / CONSID-EQUITY and STRUCT-OFFER cards | Mapped by consideration-hero.config.js. | mapped | pages/review/[id].js |
| 11 | Closing Conditions | conditions | COND-M / COND-B / COND-S provisions | Mapped by conditions-m.config.js, conditions-b.config.js, and conditions-s.config.js. | mapped | pages/review/[id].js:167 |
| 12 | Material Contracts | reps | REP-T-MATERIAL-CONTRACTS buckets and thresholds | Mapped by material-contracts.config.js. | mapped | pages/review/[id].js:7359 |
| 13 | No-Shop / Fiduciary-Out Stack | covenants | NOSOL cards and Superior Proposal / Intervening Event definitions | Mapped by nosol-noshop, nosol-superior, nosol-intervening, and nosol-fiduciary configs. | mapped | pages/review/[id].js |
| 14 | Employee Benefits | covenants | COV-EMPLOYEE compensationItems and legacy employee-benefit fields | Mapped by employee-benefits.config.js. | mapped | pages/review/[id].js:799 |
| 15 | SEC Meeting / Tender-Offer Filings | covenants | COV-PROXY, COV-MEETING, STRUCT-OFFER SEC filing and meeting fields | Mapped by sec-meeting.config.js. | mapped | pages/review/[id].js |
| 16 | No Other Reps / Fraud | misc | MISC-ENTIRE, REP-T-NOREP, REP-B-NOREP, REP-B-ANTIRELIANCE | Mapped by no-other-reps-fraud.config.js. | mapped | pages/review/[id].js:6290 |
