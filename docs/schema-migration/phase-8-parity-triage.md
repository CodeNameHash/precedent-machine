# Phase-8 Parity Triage — 2026-07-08T03:11:55.172Z

Schema parity is not clean. Do not delete the legacy renderer or vocab sources yet.

| Category | Count | Initial diagnosis |
|---|---:|---|
| short_title_mismatch | 480 | Same quote appears in both paths but the displayed short form differs. |
| type_mismatch | 285 | Same quote appears in both paths but canonical type differs. |
| missing_schema_card | 145 | Visible legacy provision has no matching schema card. Most likely an M2-00 backfill coverage gap. |
| schema_only_card | 62 | Schema card has no visible legacy counterpart. Likely card backfill over-inclusion or legacy user-mode filtering difference. |

## Top failing deals

| Deal | Diffs | Missing schema cards | Schema-only cards | Type mismatches | Short-title mismatches |
|---|---:|---:|---:|---:|---:|
| Sanofi / Bioverativ Inc. | 51 | 3 | 0 | 15 | 33 |
| Sophos Inc. / SecureWorks Corp. | 38 | 8 | 0 | 12 | 18 |
| Creek Parent, Inc. / Catalent, Inc. | 36 | 7 | 0 | 7 | 22 |
| Rocket Companies, Inc. / Mr. Cooper Group Inc. | 36 | 16 | 1 | 4 | 15 |
| Eli Lilly and Company / Verve Therapeutics, Inc. | 35 | 4 | 1 | 9 | 21 |
| Global Net Lease, Inc. / Modiv Industrial, Inc. | 35 | 13 | 0 | 7 | 15 |
| Antlia Holdings LLC / Forest City Realty Trust, Inc. | 32 | 4 | 4 | 7 | 17 |
| ENDRA Life Sciences Inc. / Noble Africa LLC | 32 | 0 | 0 | 10 | 22 |
| Glow Midco, LLC / European Wax Center, Inc. | 32 | 10 | 0 | 10 | 12 |
| H.J. Heinz Holding Corporation / Kraft Foods Group, Inc. | 32 | 0 | 3 | 6 | 23 |
