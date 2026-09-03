# Fixed-50 temporal and amount census (Q-0019 / A-0020)

Candidates are regex-found in each item node span, then passed to `lib/canonical-v2/native-producer/*-parse.js` exports. `NO_PARSER` is reserved for a kind with no binding; every kind below has at least one export.

- Items: **50**. Item 39 has no source node.
- SHA-verified spans: **69**. Failed: **0**.

## Totals

| Kind | Candidates | Parsed | Abstained | No parser |
| --- | ---: | ---: | ---: | ---: |
| duration | 9 | 3 | 6 | 0 |
| date | 1 | 1 | 0 | 0 |
| money | 2 | 2 | 0 | 0 |
| percentage | 0 | 0 | 0 | 0 |
| share_count | 8 | 8 | 0 | 0 |

## Parser exports (grep)

| Kind | Module | Export | Function line | Export line |
| --- | --- | --- | ---: | ---: |
| money | `lib/canonical-v2/native-producer/antitrust-regulatory-parse.js` | `parseDivestitureCapAmount` | 31 | 84 |
| duration | `lib/canonical-v2/native-producer/antitrust-regulatory-parse.js` | `parseFilingDeadlineDays` | 59 | 84 |
| duration | `lib/canonical-v2/native-producer/cure-period-parse.js` | `parseCurePeriod` | 207 | 267 |
| percentage | `lib/canonical-v2/native-producer/defined-term-threshold-parse.js` | `parsePercentThreshold` | 48 | 92 |
| percentage | `lib/canonical-v2/native-producer/defined-term-threshold-parse.js` | `parseThresholdSubstitution` | 64 | 93 |
| duration | `lib/canonical-v2/native-producer/financing-day-count-parse.js` | `parseFinancingDayCount` | 70 | 120 |
| money | `lib/canonical-v2/native-producer/ioc-threshold-parse.js` | `parseThresholdAmount` | 34 | 93 |
| date | `lib/canonical-v2/native-producer/measurement-date-parse.js` | `parseMeasurementDate` | 173 | 340 |
| duration | `lib/canonical-v2/native-producer/measurement-date-parse.js` | `parseMeasurementPeriod` | 273 | 341 |
| duration | `lib/canonical-v2/native-producer/no-shop-period-parse.js` | `parseNoShopPeriod` | 174 | 249 |
| money | `lib/canonical-v2/native-producer/per-share-cash-parse.js` | `parsePerShareCash` | 20 | 70 |
| duration | `lib/canonical-v2/native-producer/proxy-meeting-count-parse.js` | `parseDayCount` | 21 | 46 |
| share_count | `lib/canonical-v2/native-producer/share-count-parse.js` | `parseShareCount` | 207 | 293 |
| date | `lib/canonical-v2/native-producer/termination-deadline-parse.js` | `parseTerminationDeadline` | 111 | 142 |
| money | `lib/canonical-v2/native-producer/termination-fee-parse.js` | `parseFeeAmount` | 181 | 452 |
| duration | `lib/canonical-v2/native-producer/termination-fee-parse.js` | `parseTailPeriodMonths` | 409 | 455 |

## Per item

| Ordinal | Dur P/A | Date P/A | Money P/A | % P/A | Shares P/A | Notes |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | — |
| 2 | 1/0 | 0/0 | 0/0 | 0/0 | 0/0 | — |
| 3 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | — |
| 4 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | — |
| 5 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | — |
| 6 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | — |
| 7 | 0/0 | 0/0 | 0/0 | 0/0 | 4/0 | — |
| 8 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | — |
| 9 | 1/0 | 0/0 | 0/0 | 0/0 | 0/0 | — |
| 10 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | — |
| 11 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | — |
| 12 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | — |
| 13 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | — |
| 14 | 0/0 | 1/0 | 0/0 | 0/0 | 3/0 | — |
| 15 | 0/0 | 0/0 | 0/0 | 0/0 | 1/0 | — |
| 16 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | — |
| 17 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | — |
| 18 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | — |
| 19 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | — |
| 20 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | — |
| 21 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | — |
| 22 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | — |
| 23 | 1/0 | 0/0 | 0/0 | 0/0 | 0/0 | — |
| 24 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | — |
| 25 | 0/0 | 0/0 | 1/0 | 0/0 | 0/0 | — |
| 26 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | — |
| 27 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | — |
| 28 | 0/2 | 0/0 | 0/0 | 0/0 | 0/0 | — |
| 29 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | — |
| 30 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | — |
| 31 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | — |
| 32 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | — |
| 33 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | — |
| 34 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | — |
| 35 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | — |
| 36 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | — |
| 37 | 0/0 | 0/0 | 1/0 | 0/0 | 0/0 | — |
| 38 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | — |
| 39 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | NO_SOURCE_NODE |
| 40 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | — |
| 41 | 0/1 | 0/0 | 0/0 | 0/0 | 0/0 | — |
| 42 | 0/1 | 0/0 | 0/0 | 0/0 | 0/0 | — |
| 43 | 0/1 | 0/0 | 0/0 | 0/0 | 0/0 | — |
| 44 | 0/1 | 0/0 | 0/0 | 0/0 | 0/0 | — |
| 45 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | — |
| 46 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | — |
| 47 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | — |
| 48 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | — |
| 49 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | — |
| 50 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | — |
