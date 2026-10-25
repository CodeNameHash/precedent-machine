# Apogee, Claude run 88d4032a: a reading order by the machine's own uncertainty

Generated 2026-10-25 by the manager from the run's live review state
(`/api/product/review/88d4032a-d92c-407d-8c2f-9656a85f3916` on the preview
deployment). It is a **reading order only**: it ranks sections by where the
machine is least sure of itself — unresolved coverage assertions, held facts,
its own notes, and dropped table cells. It makes no legal judgement and
says nothing about whether a provision is important; that is the review's
work, and the first column is the only one that asks for it.

## What the queue is

| | Count |
| --- | --- |
| Items in the review | 2,398 |
| Decisions that hold publication | **1,926** |
| Machine notes (readable, no longer blocking — Ben, 2026-10-25) | 472 |

Every item is still there to read; the notes no longer stand between the
review and a release. Of the 1,926 blocking decisions, 869 are facts, 662
coverage assertions, 200 relationships, 127 exception links, 43 held facts
and 5 immaterial routings.

## Where to read first

Sections in this order: most unresolved coverage first, then most held facts.

| Section | Unresolved coverage | Held facts | Machine notes | Cells dropped |
| --- | --- | --- | --- | --- |
| 3.17 | 10 | 3 | 5 | 4 |
| 3.20 | 7 | 2 | 8 | 2 |
| 3.3 | 6 | 2 | 8 | 3 |
| 5.3 | 6 | 1 | 43 | 0 |
| 7.1 | 6 | 1 | 6 | 0 |
| 5.2 | 4 | 1 | 57 | 51 |
| 3.13 | 4 | 1 | 16 | 0 |
| 2.1 | 3 | 0 | 16 | 0 |
| 7.3 | 2 | 0 | 12 | 0 |
| 5.9 | 2 | 0 | 11 | 0 |
| 3.1 | 2 | 0 | 8 | 0 |
| 2.2 | 1 | 0 | 25 | 0 |
| 3.12 | 1 | 0 | 20 | 1 |
| 8.13 | 1 | 0 | 20 | 17 |
| 2.3 | 1 | 0 | 16 | 0 |

The other 77 sections carry one or no unresolved assertion each.

## The three things this run does not show

- **No section is empty.** The page lists no section without facts on this
  run; the DeepSeek run is the one that reports 5.16 and 3.30.
- **No sentence is left uncited** by any fact, on the sentence-level audit
  (finding (260)).
- **No summary is over the cap** (finding (248)): 839 kept, none refused at
  the four-word floor.

## What is already known about the sections at the top

- **5.2** — the interim covenants, and the section with the most dropped
  table cells (51, all the as-drafted column, now repaired at the validator
  (finding (274)); the stored run keeps its drops). Your own capex note
  (`5.2(b)(viii)`, $2,500,000 in the aggregate or $250,000 individually)
  reads MATCHED against this run.
- **7.1** — the termination provision your notes call out (7.1(e)) is one of
  the facts here; the multi-section cross-reference repair (finding (247))
  covers it in new runs.
- **2.1** — your consideration note (`2.1(a)(i)`) is MATCHED.
- **3.17, 3.20, 3.3, 5.3** — the sections where the extractor left the most
  coverage assertions unresolved: read these for what is *missing* as much as
  for what is there.

## Reproducing it

```
node scripts/product/check-preview.js --run 88d4032a-d92c-407d-8c2f-9656a85f3916
```

with `PRODUCT_INTERNAL_TOKEN` and `VERCEL_PROTECTION_BYPASS` set, prints the
read, the sections without facts and the timings; the table above is the
same review state counted by section.
