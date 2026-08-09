# The blind review sample — 2026-08-08

**This is the original sample. It was reported lost; it was not.** It lived in a
session-local scratchpad under `/tmp`, which is why a later session could not
find it. Committed here so exact replay is always possible and no successor
sample is ever needed on grounds of loss.

## What it is

**96 cards: twelve hold-back reason codes, eight cards each, stratified.** All
seven deals, nine families. It is a *stratified sample*, not a census — the
held-back population at the time was 1,246 of 2,891 attempted.

The twelve strata, eight each:

`TERMINATING_PARTY_REF_NOT_IN_QUOTE`, `ASSERTION_KIND_UNCORROBORATED`,
`QUALIFIER_KIND_UNCLASSIFIED`, `CATEGORY_UNCORROBORATED`,
`CONDITION_KIND_UNCORROBORATED`, `NO_SHOP_PREREQUISITE_UNCORROBORATED`,
`IOC_PARENT_ATTACHMENT_SCOPE_UNCORROBORATED`, `CLAUSE_LABEL_NOT_IN_QUOTE`,
`PARTY_UNRESOLVED`, `IOC_ATTACHMENT_TARGET_QUOTE_MISSING`,
`PROXY_MEETING_KIND_UNCORROBORATED`, `DNO_KIND_UNCORROBORATED`.

## The files

| file | what |
|---|---|
| `blind-sample.json` | what the blind reviewer saw — `deal`, `family`, `section`, `quote`, `claim_key`, `id`. **No reason code**, which is what made it blind |
| `blind-key.json` | the same 96 with `_reason` — the answer key |
| `blind-verdicts.json` | the blind verdicts — `id`, `verdict`, `why`, `lawyer_use` |
| `blind-rescore.json` | the 2026-08-08 re-score after the four staged resolver fixes |

Join on `id`.

## How to read a re-score, and how not to

The 2026-08-08 re-score returned **21 of 96**. That number is not the result.

| stratum | resolved |
|---|---|
| `TERMINATING_PARTY_REF_NOT_IN_QUOTE` | 7/8 |
| `CLAUSE_LABEL_NOT_IN_QUOTE` | 6/8 |
| `QUALIFIER_KIND_UNCLASSIFIED` | 4/8 |
| `CATEGORY_UNCORROBORATED` | 4/8 |
| the other eight strata | **0/8 each** |

**The eight zeros are the result.** Movement confined exactly to the four
staged reason codes is what shows nothing moved by accident. A total alone
cannot show that, and a total drawn from a different stratification cannot be
compared with this one at all — a stratified sample's headline figure is
meaningless without its strata.

So: report per-stratum movement against these twelve strata of eight. If a
future run reports strata of other sizes, it is measuring a different sample
and its total is not comparable to 21.

## Provenance

Drawn 2026-08-08 from the held-back population across concho (18), modiv (17),
topbuild (14), metsera (14), skechers (13), skywater (11), redhat (9). Families:
INTERIM_OPERATING (24), CLOSING_CONDITIONS (14), NO_SHOP (9), MAE_DEFINITION (9),
TERMINATION (8), FINANCING_COVENANTS (8), REPRESENTATIONS (8), PROXY_MEETING (8),
DNO_INDEMNIFICATION (8).
