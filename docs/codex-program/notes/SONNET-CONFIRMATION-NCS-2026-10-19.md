# The Sonnet 5.5 whole-agreement confirmation on NCS generation 5, 2026-10-19

Evidence for Ben's tier decision (plan finding (212), "Sonnet makes sense") and the manager's finding (216). Job `pm-ablation-20261019T122404Z` on the experiments sandbox `pm-codex-preview-worker-3` at fa205b1f, the Claude CLI subscription provider, every section of NCS generation 5 (run `51577c57-41b1-4b75-bcdf-c84ef2558589`, 104 sections, 1,015 VALID and 22 held stored facts), variant `anchors_sonnet55` (the ANCHORS words, claude-sonnet-5-5 at high effort writing the facts; Haiku routing and residual), sections one after another, 12:24 to 15:1x UTC, DONE exit 0. The two launches before it failed and are in finding (215). The job's table is `ablation.md` in the job directory (213 lines; the scratchpad copy `ablation5-table.md`); the manager's reading comes first.

## The totals

| | Stored run (Opus 5 high, API) | Sonnet 5.5 high (this job) |
| --- | ---: | ---: |
| Sections | 104 | 102 answered, 2 failed on a provider error |
| Facts VALID (held) | 1,015 (22) | 935 (18), 86 new |
| Matched / partial / unmatched of the 971 stored facts in the 102 sections | | 931 / 20 / 20 |
| Output tokens | 3,473,680 | 2,224,248 (64%) |
| Serial seconds | 39,968 | 15,033 (38%) |
| Cost | $133.64 as billed on the API's cache layout ($106.17 at Opus 5.5 rates) | $62.11 with every input token a one-hour cache write, $24.24 with every one a read; on the stored run's own layout (5.57m fresh, 3.61m read, 1.72m written) about $41 |

So: 95.9% of the stored facts matched outright, 2.1% shortened, 2.1% not matched, at about a third of the cost and 38% of the serial time. Three sections of 75 facts in the ladders (findings (211), (212)) showed none lost; the whole agreement shows where the 2% is, and most of it is not the model.

## The two failed sections (44 stored facts, not in the fact columns)

- **5.17** (41 stored): part 3 of 5 failed `CLAUDE_PRODUCT_JSON: response must be one exact JSON object`. In the two ladders Sonnet 5.5 held 41 of 41 on this section. One call, not retried: the ablation at fa205b1f took a failed call as the section lost, where the pipeline retries the attempt (`product_phase1_fail_section`, three attempts). E's (193), merged after this job started, gives the ablation that rule.
- **3.10** (3 stored): `MODEL_RESPONSE_SHAPE: proposal.client_ref`, the same kind of failure, the same rule.

Both are re-run in the variance job below.

## The 20 unmatched, read one by one

They are three kinds.

**Held by the validator, written by the model: 10, all `CROSS_REFERENCE must resolve`.** Sonnet wrote every one of 4.1's 18 facts (`evidence_derived: 18`); the validator held 7 of them (`INVALID_FACT_COMPONENTS`, "5: CROSS_REFERENCE must resolve" or "0.0: ..."), and the same on 3 of 3.1's. These are the Parent and Company Material Adverse Effect carve-outs and carve-backs: pandemics and natural disasters; changes in Laws; war, terrorism and geopolitical conditions; GAAP changes; industry, economy and market conditions; the disproportionality carve-back ("carve-outs one, two, three, four and seven"); the underlying-cause restoration; and on 3.1 the carve-back, the pandemics exclusion and one more. A lawyer keeps every one. The stored Opus 5 generation wrote the same facts VALID, so Sonnet writes a cross-reference component in a form the resolver does not take where Opus 5 wrote one it does (the disproportionality carve-back names the carve-outs by number; the exclusions reference the definition's limbs). That is a resolver or a contract-instruction gap, to be fixed in code so it holds across the corpus (implementer A, who owns resolution: work package 22 in finding (216)), not a reason to change tier. Eight more holds of the same `INVALID_FACT_COMPONENTS` code elsewhere: four empty quotes ("quote not found in source (EMPTY)", 5.16, 3.18 twice, 4.10), one `LIST without LIST_ELEMENT children` (3.2), one `no parsable value in "an amount in cash"` (2.3), one `CROSS_REFERENCE` on 5.10 and one on 8.3.

**Omitted by the model: about 8.** 3.1 and 3.2 each lose two `REPRESENTATION_QUALIFICATION` facts, the "except as set forth in the Company Disclosure Letter" and "except as disclosed in the Company SEC Documents" qualifiers to the representations (four facts, two sections, the same subtype: Sonnet does not write the qualifier as its own fact where Opus 5 did; 3.2 wrote three new facts, which may carry the qualifiers under another subtype, for A to read); 1.2 "the date the Closing occurs is the Closing Date"; 2.1 the Delaware-law automatic conversion at the Effective Time; 2.3 the Exchange Fund definition and the ten-day VWAP cash in lieu of fractional shares. The qualifiers and the fractional-share mechanics a lawyer keeps; the Closing Date and the conversion sentence are definitional.

**Partials: 20**, each the same fact in fewer words (shares 0.15 to 0.49): the interim-operating consent standard and two restrictive covenants on 5.1, the welfare-plan waiver on 5.16, the notice addresses on 8.2, the Acceptable Confidentiality Agreement and the 48-hour information right on 5.2, the insurance representations on 3.17, the seasonal-fluctuation exclusions on 3.1 and 4.1, and so on. None changes what the fact says.

## What this decides

Ben's tier holds. The whole agreement on Sonnet 5.5 at high effort loses to the model itself about eight facts of 971, four of them one subtype (the representation qualifiers) that a contract instruction can name, and holds ten more on a cross-reference form the resolver can be taught; the rest of the 2% is attempt failures the pipeline retries. The default changes (E's prepared commit 244acaa, findings (191) and (212)) after two things, both under way: A's resolver change for the cross-reference form, and the variance job `pm-ablation-20261019T151819Z` (3.1, 4.1, 3.2, 2.3, 4.10, 3.10, 5.17 on `anchors_sonnet55` and `anchors_opus55_medium`, three sections at once, with (193)'s retry), which says whether the 3.1 and 4.1 losses repeat and whether Opus 5.5 at medium effort writes the cross-references the same way. The four qualifier facts and the fractional-share mechanics go to Ben by name here, as (212) promised; whether to hold the default for them is his call.

## The job's totals row, as written

| Variant | Section | Facts valid (held) | Matched / partial / unmatched of stored | New | Fresh in | Read | Write | Output | Seconds | Cost | List, all written | List, all read | Note |
| anchors_sonnet55 | all 102 sections | 935 (18) | 931 / 20 / 20 of 971 | 86 | 284 | 0 | 9,966,340 | 2,224,248 | 15034 | $0.00 at list $62.11 | $62.11 | $24.24 | the rung's totals over its sections; 2 failed |

The full table (104 stored rows, 104 Sonnet rows) is `ablation.md` in the job directory on the sandbox.

## Addendum, 17:20 UTC: the variance job and the partial Opus 5.5 medium run

The seven lossy sections re-run on both tiers (job `pm-ablation-20261019T151819Z`, finding (217)), 151 stored facts: Sonnet 5.5 high 126 / 13 / 12 (8 held), 322,725 output tokens; Opus 5.5 medium 142 / 3 / 6 (1 held), 308,371. The five facts the model omits are the same on both (the four representation qualifiers, the Exchange Fund); Sonnet's other losses are the cross-reference holds A's (203) now resolves; its partials are the same facts in fewer words.

The Opus 5.5 medium whole-agreement job (`pm-ablation-20261019T155504Z`, four sections at once) met the subscription's five-hour limit after 35 of 104 sections (finding (219)): 422 / 2 / 22 of 446 on those, and on 5.1 it wrote 2,079 and 4,429 output tokens on parts 1 and 3 against 22,739 and 92,153 on parts 2 and 4, losing part 1's 17 facts whole where Sonnet 5.5 high wrote 63 of 66. Not completed; Ben's tier stands and is the default from a38df6be (finding (218)).

| Section | Sonnet 5.5 high (confirmation) | Sonnet 5.5 high (re-run) | Opus 5.5 medium (re-run) | Opus 5.5 medium (partial whole run) |
| --- | ---: | ---: | ---: | ---: |
| 3.1 (24) | 18 / 2 / 4 | 14 / 2 / 8 | 20 / 1 / 3 | 22 / 0 / 2 |
| 4.1 (18) | 10 / 1 / 7 | 17 / 1 / 0 | 17 / 1 / 0 | not reached |
| 3.2 (27) | 25 / 0 / 2 | 17 / 8 / 2 | 25 / 0 / 2 | 25 / 0 / 2 |
| 2.3 (37) | 35 / 0 / 2 | 34 / 2 / 1 | 35 / 1 / 1 | not reached |
| 5.1 (66) | 63 / 3 / 0 | | | 48 / 1 / 17 |
| 5.17 (41) | failed | 40 / 0 / 1 | 41 / 0 / 0 | 40 / 0 / 1 |
