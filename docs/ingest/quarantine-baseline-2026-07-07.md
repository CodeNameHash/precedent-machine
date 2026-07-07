# Ingest QA Quarantine Baseline

Date: 2026-07-07

Command:

```bash
node scripts/ingest-qa.js --all
```

Standing preflight gate:

- Zero unverified quotes across all deals.
- Zero duplicate provisions across all deals.
- No script-level errors, other than known deal-level coverage, canonical-rate, or minimum-count threshold failures.

Gate result for Phase 0-B-tail start:

- 40 deals checked.
- Unverified quotes: 0.
- Duplicate provisions: 0.
- Script ran to completion.

Quarantined deal-level threshold failures present before Phase 0-B-tail:

| Deal | Failure reason |
|---|---|
| SH Residential Holdings, LLC / M.D.C. Holdings, Inc. | coverage 86.40 < 95 |
| Antlia Holdings LLC / Forest City Realty Trust, Inc. | coverage 90 < 95 |
| Hearts Parent, LLC / HireRight Holdings Corporation | coverage 91.10 < 95 |
| ENDRA Life Sciences Inc. / Noble Africa LLC | coverage 73.50 < 95; canonical rate 0.41 < 0.70 |
| Hewlett Packard Enterprise Company / Juniper Networks, Inc. | canonical rate 0.27 < 0.70 |
| Quikrete Holdings, Inc. / Summit Materials, Inc. | coverage 90.60 < 95; canonical rate 0.09 < 0.70 |
| Charter Communications, Inc. / Cox Enterprises, Inc. | coverage 90.40 < 95 |
| Bespin Subsidiary, LLC / Landos Biopharma, Inc. | coverage 93.90 < 95 |
| Creek Parent, Inc. / Catalent, Inc. | canonical rate 0.37 < 0.70 |
| Wildcat EGH Holdco, L.P. / Endeavor Group Holdings, Inc. | canonical rate 0.63 < 0.70 |
| Marriott International, Inc. / Starwood Hotels & Resorts Worldwide, Inc. | coverage 93.60 < 95 |
| Global Net Lease, Inc. / Modiv Industrial, Inc. | coverage 94.40 < 95 |
| General Dynamics Corporation / CSRA Inc. | coverage 90.30 < 95 |

These are quarantine signals for later needs-review handling, not Phase 0-B-tail blockers.
