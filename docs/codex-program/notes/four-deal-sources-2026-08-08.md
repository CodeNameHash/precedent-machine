# Four new deals — verified sources, 2026-08-08

Identities taken from Ben's own `tests/fixtures/appraisal-rights-decks.json`
deal names, so there is no guessing about which transaction is meant. Each
preamble was read and the parties confirmed before download.

| key | label | agreement date | EDGAR EX-2.1 | raw bytes | raw sha256 |
|---|---|---|---|---|---|
| `metsera` | Pfizer Inc. / Metsera, Inc. | 2025-09-21 | https://www.sec.gov/Archives/edgar/data/2040807/000119312525210030/d921605dex21.htm | 583764 | d0999e48278050a081e552d3e48d9bc3e0905ae9a6b74e59429d62b11206e4ac |
| `concho` | ConocoPhillips / Concho Resources Inc. | 2020-10-18 | https://www.sec.gov/Archives/edgar/data/1358071/000119312520271642/d32162dex21.htm | 552099 | 3c1c08272e7a742ee1ded0d5e2563213a1a44fadeaad55b18c427cac86bed8f6 |
| `redhat` | International Business Machines Corporation / Red Hat, Inc. | 2018-10-28 | https://www.sec.gov/Archives/edgar/data/1087423/000119312518310577/d640856dex21.htm | 464782 | ae199e572529baeda02530a3fd7e9df050c5d9e7dcdfec5d7dd1ac162753696e |
| `skywater` | IonQ, Inc. / SkyWater Technology, Inc. | 2026-01-25 | https://www.sec.gov/Archives/edgar/data/1819974/000119312526022750/d32015dex21.htm | 589570 | d65d01126e1b5d6dca50b5811ee17071a4a9d23aaaffdbd6299619695cb8119a |

Verified preambles:
- Metsera: "AGREEMENT AND PLAN OF MERGER dated as of September 21, 2025 among PFIZER INC., MAYFAIR MERGER SUB, INC. and METSERA, INC."
- Concho: "AGREEMENT AND PLAN OF MERGER among CONOCOPHILLIPS, FALCON MERGER SUB CORP. and CONCHO RESOURCES INC. Dated as of October 18, 2020"
- Red Hat: "AGREEMENT AND PLAN OF MERGER by and among INTERNATIONAL BUSINESS MACHINES CORPORATION SOCRATES ACQUISITION CORP. and RED HAT, INC. Dated as of October 28, 2018"
- SkyWater: "AGREEMENT AND PLAN OF MERGER dated as of January 25, 2026 among IONQ, INC., IRIS MERGER SUBSIDIARY 1 INC., IRIS MERGER SUBSIDIARY 2 LLC and SKYWATER TECHNOLOGY, INC."

## Naming

Deals are keyed by TARGET throughout this repository — `modiv`, `topbuild`,
`skechers` are all targets, never acquirers. So the IonQ deal is keyed
`skywater`, and the QXO deal Ben named is the already-pinned `topbuild`.

## SkyWater is structurally unlike anything in the corpus

Two merger subs, a First Surviving Corporation and a second LLC merger. Every
other pinned deal is a single reverse triangular merger. `MERGER_STRUCTURE_CLOSING`
and `CONSIDERATION` should be expected to behave differently, and a family that
assumes one merger step is a finding rather than a surprise.
