# Extraction cost and time ledger, 2026-10-18

Evidence for work package E1 (plan finding (167); implementer E, findings from (180)). Ben, 2026-10-18: "do you think it is worth spooling an ageng to look at the cost of extractions/number of runs because it seems SO high ... I'm thinking like a 10-100x reduciton in cost"; "I agree but I'd say get AS much cost reduction and increase in speed as possible." Standing rule: "everything to be driven by coding and not just a layer on top so all edits need to be repeatable across corpus".

Two runs, read from `product_model_calls` and the run tables on the Supabase preview branch by SQL (the queries are at the end; nothing written):

- NCS generation 5, run `51577c57-41b1-4b75-bcdf-c84ef2558589`, the Anthropic API provider (`claude-opus-5`, routing and residual at low effort, extraction at high; prompt bundle V9; the two-block cached prompt with the 1-hour entry). READY 2026-10-18 20:48 UTC.
- Metsera generation 8, run `72d94dd2-cb59-49cf-8f46-c89d161b7769`, the Claude CLI subscription provider (the same model and efforts, zero marginal API cost). READY 2026-10-18 10:26 UTC.

The same reading is code: `scripts/product/extraction-cost-ledger.js --run <id>` (or `--snapshot <file>`) writes this ledger for any run from its rows (`lib/product/extraction-cost-ledger.js`), and the per-run gate metrics with it. The preview branch's keys are not in this session's environment, so the numbers below are the SQL's; the script is the repeatable form and the manager is asked to run it on both runs and keep the two outputs beside this note.

## 1. The run in one line

| | NCS generation 5 (API) | Metsera generation 8 (CLI) |
| --- | ---: | ---: |
| Agreement (section bytes / bytes spanned) | 295,516 / 310,395 | 337,275 / 348,692 |
| Sections (extracted) | 104 (104) | 85 (83; two out of scope or closure-incomplete) |
| Facts (VALID / held) | 1,037 (1,015 / 22) | 974 (961 / 13) |
| Model calls (routing / residual / extraction) | 393 (118 / 118 / 157) | 313 (93 / 90 / 130) |
| Input tokens | 12,787,497 | 10,878,349 |
| of which fresh (uncached) | 6,113,441 | 575,985 |
| of which cache reads | 4,909,773 | 588,491 |
| of which cache writes (1h) | 1,764,283 | 9,713,873 |
| Output tokens | 3,800,737 | 3,623,975 |
| of which thinking | not reported by the API path (36% assumed, below) | 1,249,344 (34%; the CLI reports it) |
| Stored cost | $145.68 | $0 (subscription) |
| Cost at the API's rates for the same tokens | $145.68 | $191 (every call wrote its own cache entry; see 4) |
| Call time (sum of call durations) | 729 min | 625 min |
| Wall clock, first call start to last call end | 439 min (7 h 19 m) | 435 min |
| Worker loops on the sandbox | 2 | 2 |

The split of NCS's input tokens stated in plan finding (165) (6.37m uncached, 4.68m read, 1.73m written) summed the failure records' `usage.input_tokens`, which is the whole prompt, as fresh input; the four failed calls' own `raw_response.usage` gives the split above. The total is the same.

## 2. Where the $145.68 went (NCS, at `claude-opus-5` rates: $5 fresh, $10 1h write, $0.50 read, $25 output per million)

| Component | Tokens | $ | Share |
| --- | ---: | ---: | ---: |
| Extraction output | 3,694,650 | 92.37 | 63% |
| of which thinking (36%, assumed from Metsera's reported share) | ~1,330,000 | ~33 | 23% |
| of which the visible JSON answer | ~2,365,000 | ~59 | 41% |
| Extraction fresh input (the section block: closure text and its JSON) | 5,766,854 | 28.83 | 20% |
| Extraction cache writes (the stable block, 51 distinct blocks) | 1,745,829 | 17.46 | 12% |
| Extraction cache reads | 3,839,441 | 1.92 | 1% |
| Residual passes (118) | 0.31m in, 90k out | 3.29 | 2% |
| Routing calls (118) | 1.12m in, 16k out | 1.82 | 1% |
| Total | | 145.68 | |

Of that total:

- $13.84 (9.5%) went on 37 calls of attempts that never committed (the committed attempt's calls carry the invocation ids of the work row's attempt token): 5.1's three attempts that ran past the 64,000-token cap ($9.29, 47 minutes of call time, 262,499 output tokens); 5.8's first attempt, two parts done and lost to the 18:34 UTC worker restart with no error record ($2.69); 3.4's one answer that was not one JSON object ($1.23); 1.2's three routing and residual pairs lost to the residual-consistency rule of finding (74) and 2.1's and 2.2's three pairs each lost to the store's part-identity defect of finding (77) ($0.64). The four failed calls alone are $6.92.
- The stored per-call costs reconcile exactly to the rates: every successful call to the cent, the four failures to the cent on their own usage.

## 3. What the calls sent, and how many times each agreement byte went

The extraction request's section block (the part that changes per section and is never cached) carried 16.36 MB over 157 calls for an agreement of 0.31 MB:

| Role in the closure | Spans sent | Bytes sent | Times the agreement |
| --- | ---: | ---: | ---: |
| cross_references (the referenced sections' full text, transitively) | 1,570 | 10,289,563 | 33x |
| definitions (the defined terms' paragraphs) | 402 | 4,121,962 | 13x |
| operative (the section's own limbs) | | 335,957 | 1.1x |
| chapeau | | 232,015 | 0.75x |
| full_section (sent whole for unsplit sections, emptied for parts) | | 125,255 | 0.4x |
| routing: the section | 118 | 396,036 | 1.3x |
| residual: the paragraphs | | 395,247 | 1.3x |

Median context (definitions plus cross-references) per extraction call: 86,810 bytes; the largest 258,998 bytes. 3.21 is 193 bytes of representation and went out with 32,078 fresh tokens of context ($0.30 for one fact). At the run's measured 2.7 bytes per fresh token (JSON-escaped text with 64-hex span ids), the 14.4 MB of definitions and cross-references are about 5.3 million fresh tokens, $26.5 of the $28.8 fresh input, and they are the reason "uncached input is 6.1m of 12.8m": the cache breakpoint covers the stable block only, and this text differs from section to section.

How many times each byte of the agreement was sent to the model (a sweep over every span every call sent):

| Times sent | Bytes | Byte-sends | Deepest |
| --- | ---: | ---: | ---: |
| 3 to 5 | 25,192 | 125,822 | 5 |
| 6 to 10 | 62,394 | 376,208 | 10 |
| 11 to 20 | 93,611 | 1,450,318 | 20 |
| 21 to 50 | 41,830 | 1,481,672 | 47 |
| 71 to 75 | 9,165 | 669,080 | 75 |
| 119 to 277 | 63,324 | 11,912,683 | 277 |
| Total | 295,516 | 16,015,783 | mean 54 |

No byte went fewer than three times (routing, residual, extraction). 63,324 bytes, a fifth of the agreement (the definitions article 8.3 and the sections most referred to), went between 119 and 277 times each and are 74% of all byte-sends.

## 4. The stable block (the cache's unit)

The stable block is what the API caches: 11.53 MB over 157 extraction calls, 73 KB each on average, by key:

| Key | Bytes over the run | Share |
| --- | ---: | ---: |
| table_shapes (the routed families' tables) | 4,228,752 | 37% |
| family_contracts (the routed families') | 2,655,848 | 23% |
| cross_section_target_contracts (every family's fact types and subtypes, the same on every call) | 1,553,672 | 13% |
| component_instruction | 1,007,436 | 9% |
| response_contract | 755,515 | 7% |
| instruction | 727,852 | 6% |
| conclusion_instruction | 723,142 | 6% |
| scope_instruction and the rest | 150,000 | 1% |

51 distinct stable blocks (one per routed family set), 22 of them used once (a write at twice the input price with no read to pay for it), 51 writes, 1,745,829 tokens written ($17.46) against 3,839,441 read ($1.92). Only two writes were re-writes after a repeat (an entry past its hour); the entries do not expire, there are too many of them. Routing and residual have one stable block each (8,198 and 1,029 tokens) and read it on 116 of 118 calls.

On the CLI provider (Metsera) the picture inverts: 9.7m tokens written and 0.59m read, because each `claude -p` process writes its own entry and the next process starts cold. On the subscription that is free; on the API it would be $191 for the same run.

## 5. What the output tokens were spent on

4,729,080 bytes of response text over 153 successful extraction answers (1,073 proposals, held included), measured in the JSON as the model wrote it:

| Part of the answer | Bytes | Share |
| --- | ---: | ---: |
| components (the trees) | 2,067,843 | 44% |
| of which verbatim quotes (12,460 nodes) | 1,016,238 | 21% |
| of which 64-hex `source_span_id` strings | 797,440 | 17% |
| of which labels | 402,280 | 9% |
| evidence_quotes (the same words a second time, 2,419 quotes, with their 64-hex ids) | 703,961 | 15% |
| roles (the V1 role dictionary, still required by the V9 request) | 562,747 | 12% |
| statement | 418,037 | 9% |
| conclusions | 339,512 | 7% |
| headline | 190,105 | 4% |
| groups, links, coverage | 331,983 | 7% |

So of the visible output, 30% is the agreement's own words written back (twice), 20% is span ids, 12% is roles the V2 page never shows, and the rest is labels, summaries, readouts and JSON scaffolding. The stored substance of the 1,015 VALID facts (component quotes 481 KB, labels 190 KB, statements 405 KB, headlines 105 KB, conclusion cells 377 KB) is 1.56 MB.

Metsera reports the thinking share: 1,249,344 of 3,512,309 extraction output tokens (36%). The API path's `usage` does not break it out; the same share is assumed for NCS (the output rate, 87 tokens per second, is the same on both).

## 6. Wall clock and the idle gaps

NCS: 439 minutes from the first call's start (13:27:44 UTC) to the last call's end (20:46:51); 729 call-minutes; 62 minutes with no call in flight, 24 with one, 353 with two (the hosted worker's two loops). The gaps over two minutes: 13:29 to 13:32 (the 1.2 residual failures), 13:39 to 14:22 in five gaps (the part-identity store defect, finding (77), three attempts each on 2.1 and 2.2 with the worker stopped between), 18:19 to 18:36 (the model-config identity refusal, finding (87)). Metsera: 435 minutes, 625 call-minutes, 78 idle, 88 with one call, 268 with two.

Per extraction call: median about 4 minutes, the longest parts 25 to 30 minutes (5.1's part 2 at 115,352 output tokens). The time is the output: 3.69m extraction output tokens at 87 tokens per second is 707 minutes, 97% of all call time. Input size does not set the pace; output does.

## 7. The floor and the ratio

Floor, defined as: read the agreement once and write the facts once.

- Input: 295,516 section bytes at the run's measured 2.7 bytes per token (the JSON-escaped text as sent) is about 110,000 tokens; as plain text it is about 75,000. At $5 per million: $0.38 to $0.55.
- Output: the facts' substance once (statements, labels, headlines, readouts, and a pair of byte offsets per component instead of each quote) is about 1.15 MB, about 575,000 visible tokens at the run's 2.0 bytes per visible token; at $25 per million: $14.4. With the thinking that produced them at the same 36% share: $22.5.
- Cost floor: about $15 without thinking, $23 with. Actual $145.68: 6.3x to 9.7x the floor.
- Tokens: input 12.79m against 0.11m, 116x; output 3.80m against 0.58m to 0.90m, 4.2x to 6.6x.
- Time floor at 87 output tokens per second: 575,000 tokens serial is 110 minutes; every section in parallel (the largest, 5.1, is 12% of the output) about 13 minutes. Actual 439 minutes: 4x the serial floor, 34x the parallel floor.

The 10x that Ben asked for is within the output side and the context side together; a 100x is not while a frontier model writes the facts: the output floor alone is $14 to $23 on `claude-opus-5` ($12 to $18 on `claude-opus-5-5`).

## 8. Gate metrics (the figures the per-run gate compares)

NCS generation 5, the baseline the gate holds (`tests/fixtures/product/run-cost-baseline.ncs-generation-5.json`):

```json
{
  "cost_usd": 145.68,
  "facts": 1037,
  "valid_facts": 1015,
  "cost_per_valid_fact_usd": 0.1435,
  "input_tokens_per_agreement_byte": 43.27,
  "output_tokens_per_agreement_byte": 12.86,
  "output_tokens_per_valid_fact": 3745,
  "call_minutes_per_section": 7.01,
  "wall_minutes_per_section": 4.22,
  "calls_per_section": 3.78,
  "sends_per_agreement_byte": 54.2,
  "failed_call_cost_usd": 6.92,
  "uncommitted_attempt_cost_usd": 13.84
}
```

Metsera generation 8 for comparison: 3.68 calls per section, 32.3 input and 10.7 output tokens per agreement byte, 7.35 call-minutes per section, $0 stored.

## 9. Reconciliation to the console

The pipeline's figure reconciles to the published rates to the cent. The Anthropic console's billed usage for the workspace over 2026-10-18 13:27 to 20:47 UTC is the one number this note cannot read (the key and workspace id are never read here); the manager is asked for the figure Ben reads off the console, and the difference, if any, is the calls the pipeline did not record (a request refused before a response, a retry inside the SDK after a 5xx, a stream cut before `finalMessage`). Until then the console line in the ledger reads "not reconciled".

## 10. The SQL

All on the preview branch, read-only. `R` is the run id.

```sql
-- 1. Tokens by call kind, with the cache split read from each call's own usage (a failure record's usage is its raw_response's).
with x as (select m.call_kind, m.output_tokens, m.cost_microusd, m.duration_ms, (m.response ? 'schema_version') failed,
  coalesce(case when m.response ? 'schema_version' then (m.response->'raw_response'->'usage'->>'input_tokens')::bigint else (m.response->'usage'->>'input_tokens')::bigint end,0) fresh,
  coalesce(case when m.response ? 'schema_version' then (m.response->'raw_response'->'usage'->>'cache_read_input_tokens')::bigint else (m.response->'usage'->>'cache_read_input_tokens')::bigint end,0) cread,
  coalesce(case when m.response ? 'schema_version' then (m.response->'raw_response'->'usage'->>'cache_creation_input_tokens')::bigint else (m.response->'usage'->>'cache_creation_input_tokens')::bigint end,0) cwrite
 from product_model_calls m where m.run_id = R)
select call_kind, count(*), sum(fresh), sum(cread), sum(cwrite), sum(output_tokens), sum(cost_microusd), sum(duration_ms) from x group by 1;

-- 2. Per section: calls by kind, parts, failures, tokens, cost, seconds, facts (the section block's extraction_part names the part).
with calls as (select m.structure_node_id node, m.call_kind, m.created_at, m.output_tokens o, m.cost_microusd cost, m.duration_ms dur, (m.response ? 'schema_version') failed,
  ((m.request->'messages'->0->'content'->1->>'text')::jsonb->'source_closure'->'extraction_part'->>'of')::int part_of
 from product_model_calls m where m.run_id = R)
select c.section_reference, s.end_byte-s.start_byte bytes, w.attempts,
 count(*) filter (where call_kind='ROUTING'), count(*) filter (where call_kind='RESIDUAL'), count(*) filter (where call_kind='EXTRACTION'), max(part_of), count(*) filter (where failed),
 sum(o), sum(cost), sum(dur), (select count(*) from product_proposals pp where pp.run_id=w.run_id and pp.structure_node_id=w.node_id)
from product_section_work w join product_source_closures c on c.run_id=w.run_id and c.structure_node_id=w.node_id
join product_source_spans s on s.run_id=w.run_id and s.span_id=c.payload->>'full_section_span_id'
left join calls on calls.node=w.node_id where w.run_id = R group by w.run_id, w.node_id, 1,2,3 order by w.authored_order;

-- 3. What the section blocks carried, by role (bytes of exact_text per closure list).
with x as (select (m.request->'messages'->0->'content'->1->>'text')::jsonb sec, m.call_kind from product_model_calls m where m.run_id = R)
select call_kind,
 (select sum(length(s->>'exact_text')) from x x2, jsonb_array_elements(coalesce(x2.sec->'source_closure'->'operative','[]')) s where x2.call_kind=x.call_kind) operative,
 (select sum(length(s->>'exact_text')) from x x2, jsonb_array_elements(coalesce(x2.sec->'source_closure'->'definitions','[]')) s where x2.call_kind=x.call_kind) definitions,
 (select sum(length(s->>'exact_text')) from x x2, jsonb_array_elements(coalesce(x2.sec->'source_closure'->'cross_references','[]')) s where x2.call_kind=x.call_kind) cross_refs
from x group by 1;

-- 4. How many times each byte went: a sweep over every (start_byte, end_byte) in every call's section block (operative, chapeau, definitions, cross_references, full_section when its text was sent, the routing section, the residual paragraphs' spans by id), +1 at each start and -1 at each end, the running depth times the gap to the next event, bucketed by depth.
-- (lib/product/extraction-cost-ledger.js bytesSentHistogram is the same sweep in code.)

-- 5. The stable block by key and the cache sets.
with x as (select m.call_kind, (m.request->'messages'->0->'content'->0->>'text')::jsonb st, md5(m.request->'messages'->0->'content'->0->>'text') h,
  coalesce((m.response->'usage'->>'cache_creation_input_tokens')::bigint,0) cwrite, coalesce((m.response->'usage'->>'cache_read_input_tokens')::bigint,0) cread
 from product_model_calls m where m.run_id = R)
select call_kind, k, sum(octet_length((st->k)::text)) from x, jsonb_object_keys(st) k group by 1,2;
select call_kind, count(distinct h) sets, count(*) filter (where cwrite>0) writes, sum(cwrite), sum(cread) from x group by 1;

-- 6. What the output tokens were spent on: every successful extraction answer's text parsed, the proposals' fields measured as JSON text.
with t as (select m.model_call_id, string_agg(b->>'text','' order by o) txt from product_model_calls m, jsonb_array_elements(m.response->'content') with ordinality c(b,o)
  where m.run_id = R and m.call_kind='EXTRACTION' and not (m.response ? 'schema_version') and b->>'type'='text' group by 1),
j as (select txt::jsonb js, octet_length(txt) bytes from t where txt ~ '^\s*\{'), p as (select pr from j, jsonb_array_elements(js->'proposals') pr)
select (select sum(bytes) from j), (select count(*) from p), (select sum(octet_length((pr->'components')::text)) from p), (select sum(octet_length((pr->'evidence_quotes')::text)) from p),
 (select sum(octet_length((pr->'roles')::text)) from p), (select sum(octet_length(pr->>'statement')) from p),
 (select sum(octet_length(q #>> '{}')) from p, jsonb_path_query(pr, '$.components.**.quote') q), (select sum(octet_length(q #>> '{}')) from p, jsonb_path_query(pr, '$.components.**.source_span_id') q);

-- 7. The calls of attempts that did not commit: a call is kept when its invocation_id is the committed attempt's (the work row's attempt_token, per call kind, and ':part-n' for the parts).
with committed as (
 select encode(extensions.digest(convert_to('PRODUCT_MODEL_INVOCATION/V1'||chr(31)||w.attempt_token::text||chr(31)||k,'UTF8'),'sha256'),'hex') inv from product_section_work w, unnest(array['ROUTING','RESIDUAL','EXTRACTION']) k where w.run_id = R
 union all select encode(extensions.digest(convert_to('PRODUCT_MODEL_INVOCATION/V1'||chr(31)||w.attempt_token::text||':part-'||p||chr(31)||'EXTRACTION','UTF8'),'sha256'),'hex') from product_section_work w, generate_series(1,20) p where w.run_id = R)
select (m.invocation_id in (select inv from committed)) kept, count(*), sum(m.cost_microusd), sum(m.duration_ms) from product_model_calls m where m.run_id = R group by 1;

-- 8. Wall clock, idle and concurrency: each call's interval is [created_at - duration_ms, created_at]; a sweep gives the minutes at depth 0 (idle), 1 and 2.
with c as (select created_at - make_interval(secs => duration_ms/1000.0) s, created_at e from product_model_calls where run_id = R),
ev as (select s t, 1 d from c union all select e, -1 from c), sw as (select t, sum(d) over (order by t, d) depth, lead(t) over (order by t, d) nxt from ev)
select depth, round(sum(extract(epoch from (nxt-t)))/60) minutes from sw where nxt is not null group by 1;
```

## 11. The levers, ranked by measured dollars and minutes

Each lever against NCS generation 5 as stored ($145.68, 439 minutes of wall clock, 377 without the 62 idle; `claude-opus-5` rates: $5 fresh, $10 1-hour write, $0.50 read, $25 output per million; output at 87 tokens a second; the worker's two loops). "Reading unchanged" means the model is asked to read the same words; the dollars are arithmetic on the ledger, the facts are what the three-section ablation (section 12) has to show. Prices from the claude-api skill's reference and `ANTHROPIC_API_PRICES`, never memory.

| Rank | Lever | Mechanism | $ per NCS | Wall minutes (2 loops) | Reading | Built |
| ---: | --- | --- | ---: | ---: | --- | --- |
| 1 | The answer's format: components alone, short span aliases | evidence_quotes repeat the components' words (15% of the answer), roles are the V1 dictionary the V2 page never shows (12%), the 64-hex span ids are 20%; the compiler derives the evidence from the OWN components, maps aliases back, holds nothing for a role | -$28 (1.11m output tokens) | -107 | unchanged | yes: `response_format: 'V10'` |
| 2 | Batch API | 50% off every token, cache reads and writes included; the pipeline's calls are already unattended | -50% of whatever remains (-$46 on the lean total below) | unknown: a batch answers within 24 hours, usually far sooner; three waves (routing, residual, extraction) instead of a section loop | unchanged | no: a batch runner against the section-lease store is the next build (estimate two days) |
| 3 | Concurrency: eight section loops, parts in parallel | the sections are independent and 97% of call time is output generation; the pool already runs two agreements, not one faster | $0 | -280 (377 to about 95, then the rate limit decides; the longest section, 5.1's four parts in parallel, about 25 minutes) | unchanged | partly: `--workers` is capped at 2; the parts loop is serial |
| 4 | Thinking: extraction at medium effort | about 36% of the output tokens are thinking (Metsera's reported split); medium roughly halves it | -$17 (0.66m) | -63 | unchanged in words, changed in depth | yes: `callKindModels` per variant; the run config once the ablation decides |
| 5 | `claude-opus-5-5` for extraction | $4 / $20 against $5 / $25, cache reads $0.20 against $0.50 | -$29 on the stored mix (-$17 on the lean mix) | 0 | unchanged (the same tier) | yes: the variant; the run config once decided |
| 6 | The context by reference: the agreement cached once | 14.4 MB of definitions and cross-references were sent fresh; the whole agreement under one 1-hour breakpoint is read at a tenth of the price. Net, because 115,000 cached tokens a call cost nearly as much as the 37,000 fresh ones they replace: -$24 fresh, +$9 reads, +$9 writes | -$6 at Opus 5 rates, -$9 at Opus 5.5 | 0 | changed: the model has the whole agreement, the closure says which parts govern | yes: `context_mode: 'cached_agreement'` |
| 6b | The context trimmed instead: cross-references one hop deep, each referenced section cut to its opening | cross-references are 10.3 MB of the 14.4; one hop and 1,500 bytes a reference is about a third | -$13 | 0 | changed: the model reads less | no: proposed as `context_mode: 'trimmed'` for the ablation if 6 does not hold |
| 7 | Anchored quotes: a long component's first and last words | the verbatim words are 21% of the answer; two four-word anchors are about 50 bytes against an average 82 | -$9 (0.35m) | -34 | unchanged | yes: `quote_mode: 'anchors'`, the validator resolves |
| 8 | Two stable blocks | the instructions, response contract and every family's target contracts are 41% of the stable block and the same on every call; written once a run instead of once per routed family set | -$7 | 0 | unchanged | yes: `stable_blocks: 2` |
| 9 | Routing and residual on `claude-haiku-5-5` (or `claude-sonnet-5-5`) | $5.11 of routing and residual at Opus rates; the routing is widened by code either way | -$5 (-$3 on Sonnet) | -15 | changed for those calls | yes: the variants; the run config once the routing agrees |
| 10 | Nothing wasted on attempts that do not commit | $13.84 and 69 call-minutes went to the cap, the store defect and the restarts, all fixed before this note; the gate's `uncommitted_attempt_cost_usd` keeps it at zero | -$14 | -62 idle, -35 call | | yes: the gate |
| 11 | Part sizing | smaller parts are more parallel and never near the cap; each part re-sends its context, cheap once lever 6 holds | about 0 | with lever 3 | unchanged | the constant `LONG_SECTION_SPLIT.group_bytes` |

Projection per NCS-size agreement, the levers stacked in the order they are safe to take:

| Step | Levers | $ | Wall, 2 loops | Wall, 8 loops |
| --- | --- | ---: | ---: | ---: |
| As stored | | 145.68 | 439 | |
| 1. No reading change, no model change | 1, 8, 9, 10 | about 92 | about 255 | about 70 |
| 2. Same tier | step 1 plus 7 and 5 | about 66 | about 220 | about 60 |
| 3. If medium effort holds the facts | step 2 plus 4 | about 53 | about 170 | about 45 |
| 4. If the cached agreement holds the facts | step 3 plus 6 | about 42 | about 170 | about 45 |
| 5. Batch | step 4 plus 2 | about 21 | the batch's latency | |

Read against Ben's "10-100x": the code in this package, with nothing changed in what the model reads and the same model, is 1.6x (step 1); the same tier with the format and anchors, 2.2x; with the effort and the context, 3.5x, each a question the ablation answers in facts; with the Batch API, about 7x; 10x needs every step and a batch runner. 100x is not available: the floor of section 7 is $15 to $23 while a frontier model writes the facts at $20 to $25 a million output tokens, and the facts' substance alone is 0.58m tokens. The next 10x after that would need a smaller model writing the facts (Sonnet 5.5 at $10, Haiku 5.5 at $0.50 a million) and would lose whatever those models lose on a merger agreement's qualifications, carve-outs and cross-references, which no one has measured on this corpus; the ablation harness runs the same ladder on them when Ben wants that number.

Time, separately from money: the floor is set by the longest section's output, not by the agreement; eight loops and parallel parts take a generation from 7 hours 19 minutes to about an hour, and the output levers (1, 4, 7) take the hour to about 45 minutes. The rate limits (platform.claude.com/docs/en/api/rate-limits, read 2026-10-18 through the claude-api skill's live sources): `claude-opus-5` has its own bucket, 400,000 output tokens a minute and 2,000,000 uncached input tokens a minute on the Start tier (1,000,000 and 5,000,000 on Build; 2,000,000 and 10,000,000 on Scale; an organisation new to the API may sit in an Evaluation tier below Start until it has a history), and cache reads do not count towards the input limit. Eight streams at 87 tokens a second are 42,000 output tokens a minute, a tenth of the Start tier; the Start tier would carry about seventy streams. The sandbox and the store's leases, not the API, bound the concurrency; the workspace's own limit is on the console's Rate limits page.

## 12. The three-section ablation (design; the manager runs the calls)

Sections: 3.19 (the intellectual property representations: 3,364 bytes, seven facts, one call, $1.31 as stored), 5.2 (the no-shop: 8,578 bytes, 27 facts, three parts, $3.43) and 5.17 (the registration covenant: 13,807 bytes, 41 facts, five parts, $4.98). Every variant extracts the same bytes: the routing and residual answers are the stored ones, so the routed families and the parts are the run's; only the extraction call is live.

```
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/product/cost-ablation.js --run 51577c57-41b1-4b75-bcdf-c84ef2558589 --sections 3.19,5.2,5.17 --dump-snapshot ablation-rows.json
node scripts/product/cost-ablation.js --snapshot ablation-rows.json --sections 3.19,5.2,5.17 --variant baseline --out ablation.md
ANTHROPIC_API_KEY=... node scripts/product/cost-ablation.js --snapshot ablation-rows.json --sections 3.19,5.2,5.17 --variant format,anchors,offsets,all_contracts,trimmed,lean,lean_medium,lean_opus55,lean_opus55_medium,routing_sonnet,routing_haiku --live --record ablation-recording.json --out ablation.md --json ablation.json --analysis-dir ablation-analysis
```

The manager's direction of 2026-10-18 22:30 UTC adds three rungs: `offsets` (a long component's words as character offsets within the cited span, read back from the span; implementer A's validator-level acceptance is work package 21), `all_contracts` (every family's contracts and tables in the stable block, one block per call kind for the run) and `trimmed` (cross-references one hop deep by the section's own words, each whole and once). The script is `scripts/product/cost-ablation.js`, run in a hosted worker sandbox created for experiments (the sandbox holds the key at wake; no session reads it); the thinking share is measured per live call with `count_tokens`; `--analysis-dir` writes the stored and the variant facts in the analysis read's shape for `scripts/product/compare-generations.js --v1-file --v2-file`. The baseline row is free (the stored calls through the compiler as it is now). The live ladder at the stored sections' size is about $10 a variant at the start and less as the output shrinks: about $65 for the nine extraction variants and under $1 for the two routing variants on the API; the manager chooses the rungs.

Work package E2 (the manager, 2026-10-19 02:55 UTC): the ladder runs on the subscription provider on the experiments sandbox (`pm-codex-preview-worker-3`, created with `create-sandbox-worker.js --provider ANTHROPIC_CLAUDE_CLI_SUBSCRIPTION --name pm-codex-preview-worker-3`) through the deployment's own wake path, so no session reads the branch keys or the provider credential and no API credit is spent:

```
curl -sS -X POST "$DEPLOYMENT/api/product/ablation" -H "Authorization: Bearer $PRODUCT_INTERNAL_TOKEN" -H 'content-type: application/json' \
  -d '{"run_id":"51577c57-41b1-4b75-bcdf-c84ef2558589","sections":["3.19","5.2","5.17"],"variants":["baseline","format","anchors","offsets","all_contracts","trimmed","anchors_medium","anchors_opus55","anchors_opus55_medium","routing_sonnet","routing_haiku","lean"]}'
curl -sS -X POST "$DEPLOYMENT/api/product/ablation" -H "Authorization: Bearer $PRODUCT_INTERNAL_TOKEN" -H 'content-type: application/json' -d '{"status":true}'
```

The first answers 202 with the job id (`pm-ablation-<timestamp>`); the second returns the job's state, the log tail and `ablation.md` once written; the files are under `/vercel/sandbox/<job id>/` on the sandbox (`ablation.md`, `ablation.json`, `ablation-rows.json`, `ablation-recording.json`, `analysis/` for `compare-generations.js --v1-file analysis/stored.analysis.json --v2-file analysis/<variant>.analysis.json`). On the CLI the `lean*` rungs are listed as not run (the agreement block is an API cache breakpoint the CLI does not control); the CLI-expressible model rungs are `anchors_medium`, `anchors_opus55` and `anchors_opus55_medium`; the thinking share, the list-price cost and the API seconds are what the CLI reports per call. What the table has to show, variant by variant: the stored VALID facts matched on the bytes (half or more of each fact's own bytes covered by one variant fact), the partial and unmatched ones named with their summaries, the new facts, the held facts and why, the readouts present, the routing families the same; beside them the fresh, read, written and output tokens, the seconds and the dollars. A lever holds when the matched count is the stored count less the facts the audit already holds for another reason, with no new unexplained holds, and it goes into the LEAN run config (`PRODUCT_ANTHROPIC_API_PROFILE=LEAN` for the next intake); a lever that loses facts is reported with the facts it lost and stays out. The recording makes every later question about the same answers free.

## 13. The default profile (work package E3, finding (184)) and what the next NCS generation would cost on it

The stack that needs no proof is the default for every new run from this push: the V10 answer with span aliases and anchored quotes (levers 1 and 7), every family's contracts in two stable blocks (lever 8), routing and residual on Haiku 5.5 (lever 9), eight section loops with a split section's parts four at a time (lever 3), nothing on uncommitted attempts (lever 10), and Opus 5.5 for extraction on the API (lever 5; the reference's model table lists it Active with the same context and output limits; the CLI keeps Opus 5 for extraction until its rung has run). Medium effort (lever 4) and the cached agreement (lever 6) wait for the ablation.

NCS generation 6 on that default, by this ledger's method, on the API:

| Component | Tokens | $ |
| --- | ---: | ---: |
| Extraction output (3.69m less 1.11m of roles and evidence quotes and 0.35m of verbatim words) at $20 | 2.34m | 46.8 |
| Extraction fresh input (5.77m less 0.35m of 64-hex ids) at $4 | 5.42m | 21.7 |
| Cache writes, one stable block per call kind for the run, at $8 (measured with the real table shapes, finding (186): the extraction's two blocks are 387 KB, about 143,000 tokens; 0.15m with the routing and residual blocks) | 0.15m | 1.2 |
| Cache reads at $0.20 | 5.5m | 1.1 |
| Routing and residual, 236 calls on Haiku 5.5 | 1.4m in, 0.1m out | 0.5 |
| Uncommitted attempts | | 0 |
| Total | | about 71 |

Against $145.68: about half the money, $0.07 a VALID fact. Time: 2.34m output tokens at 87 a second are 448 call-minutes; eight loops with the parts together, about 70 wall minutes for the 104 sections against 439, and the longest section (5.1, its parts together) about 12 minutes. On the subscription CLI the money is $0 and the time the same. The projected baseline file carries these figures for the gate until the first run under the default measures them.

## 14. The fresh sheet (work package E3 part 2, finding (185))

Ben, 2026-10-19: "imagine itself like a nasa engineer in Apollo 13, having to figure out how to get all required performance on even less juice and even quicker. It can experiment, tear up ideas etc. cone at completely fresh." Required performance: the same VALID facts on the agreement's bytes, judged by `compare-generations.js`. The sheet against the default profile's projected $72 and 70 minutes (section 13), every assumption the pipeline carries, the experiment the ablation job can run, the saving by this ledger's method, and what it risks. "Built" means a request-profile flag and a rung of the ladder exist now; "designed" means the experiment is specified and its cost known, and the build is the next step.

| # | Assumption | Experiment (rung) | Expected saving on the default | Risk | State |
| ---: | --- | --- | --- | --- | --- |
| 1 | Three model passes per section: routing, residual, extraction | `deterministic_routing`: the routing from the heading rules and the anchoring defined terms, no routing call where the words decide; the residual stays as the net for the 25-family catalogue | 118 routing calls to about 40 on NCS (the title rules name the family on most covenant, representation and termination headings): $0.3 at Haiku, about 8 wall minutes at eight loops; the larger gain is one fewer thing to fail | A heading that misnames its section (a "Termination" heading over a fee clause); the residual pass and the compiler's widening still catch what the heading missed, and the row shows every section where the words and the stored model routing disagree | built (flag `routing_mode`) |
| 2 | The residual pass on every section, the section's paragraphs sent a third time | `merged_residual` (finding (190)): the residual question rides in the extraction call of an unsplit section (`residual_paragraphs` by span id, `paragraph_dispositions` in the answer); a split section, an out-of-scope exhibit, an incomplete closure and a section routed to no family keep their own residual call | the 118 residual calls' 0.31m input and 90k output tokens and their call minutes (section 2), against about 40 output tokens per paragraph added to the extraction answer: about $3 and two calls' latency off every unsplit section's critical path | The widening the residual gives the routing comes after the extraction: a family the residual names that the extraction was not asked for is UNRESOLVED on the section with a `RESIDUAL_FAMILY_NOT_EXTRACTED` issue, never NOT_FOUND, and the `RESIDUAL_IN_EXTRACTION` note counts them per section; the ablation row says how often it happens | built (flag `residual_mode`) |
| 3 | The whole closure in every extraction call: definitions transitively, cross-references transitively | `direct_definitions` (built): only the definitions the section's own words use go whole, the rest listed by first words for the model to ask for by alias; `trimmed` (built): cross-references one hop; `cached_agreement` (built, API only) | definitions 4.12 MB to about 1.5 MB and cross-references 10.29 MB to about 3.5 MB of the 16.36 MB sent: fresh input 5.42m tokens to about 2.6m, $11 of the $72; nothing on time | A definition the section uses only through another definition is no longer in front of the model; a fact whose words depend on it may lose its qualifier. compare-generations on the bytes says which | built |
| 4 | A frontier model for every call | `routing_haiku` (default now), `anchors_sonnet55` (built): Sonnet 5.5 writes the facts, `anchors_opus55_medium` (built) | Sonnet 5.5 at $2 / $10: output $46.8 to $23.4, input $21.7 to $10.8, about $36 of the $72 | The qualifications, carve-outs and cross-references a merger agreement turns on; the ablation's byte match on 3.19, 5.2 and 5.17 is the measure, and the default stays Opus until it holds | built |
| 5 | The agreement's words written back into JSON | aliases and anchors (default now), `offsets` (built): no words at all for a long component, two integers | output 2.34m to about 2.1m tokens (the anchors' 50 bytes to the offsets' 12): $5 | None on the facts when the validator reads the span's own bytes (implementer A's work package 21 does); a model that miscounts characters loses the component, which the validator holds | built |
| 6 | Statement and summary as model prose | `derived_statement` (finding (190)): the statement is the OWN components' words in source order, an ellipsis at a gap, written by the code (`statement_derived: true` on the proposal; a statement the model writes anyway is kept); the summary stays the model's | statement 9 per cent of the answer: 0.2m tokens, $4 | The page's statement becomes a splice of the source words, not a sentence; Ben's rule on summaries ("a summary of the provision ... not just a sec ref") is about the summary, which stays, but the statement is read beside it | built (flag `statement_mode`) |
| 7 | One answer per section (the JSON object) rather than streamed facts | `fact_lines`: one JSON object per proposal on its own line (NDJSON), the reader assembling; a cap or a timeout keeps every fact before the cut | nothing on tokens; on time the parts of a split section become unnecessary (5.1's three attempts and 47 call-minutes, finding (180)) and a 64,000-token cap costs one fact, not an attempt | A line the model breaks across two lines; the reader's repair is deterministic and the loss is that fact | designed |
| 8 | A fixed number of facts is whatever the model writes | `fact_budget` (built): the request carries the expected count and a ceiling from the section's bytes; an answer past the ceiling is a note | nothing certain: a check on over-production (the 1,037 facts hold 22 held; the budget names the sections where the model wrote twice the corpus rate) | A dense section that passes the ceiling is noted, never cut; the risk is the model under-writing to a number it reads as a target, which the instruction forbids and the byte match would show | built |
| 9 | The sandbox worker's loop | the Batch API (finding (181), lever 2): three waves, routing, residual, extraction, each a batch; the run's leases become batch ids (section 15) | 50 per cent of every token: $72 to $36 | The batch's latency (within 24 hours, usually far less) against the hour the loop now takes; the worker's restart story becomes the batch's | designed (section 15) |
| 10 | 64-hex identities on the wire | aliases (default now) | done: 0.95 MB of the answer and 0.35 MB of the request | none | built |
| 11 | One extraction call per section | `section_batching`: small sections sharing a closure (3.21's 193 bytes went out with 32,078 tokens of context) grouped into one call up to a byte budget, the answer split by owned span | about 30 of NCS's 104 sections are under 1,500 bytes: 30 calls' stable and context blocks, about $3, and their call minutes in parallel anyway; small | Attribution across sections in one answer; the identity of a section result is per node, so the split must be exact | designed |

Together, the built rungs that hold under the byte match take the default's $72 to about $55 (3 and 5), and the designed ones with the model tier (4) and the Batch API (9) to about $12: that, with the $0 of the subscription CLI, is the 10x Ben named, with the facts judged the same way at every step. The time floor stays the longest section's output (finding (181)); rung 7 removes the attempts the cap costs, and rungs 1 and 2 take two calls off every section's critical path.

Run on the third sandbox, in the order the money goes: `default`, `deterministic_routing` (free), `direct_definitions`, `fact_budget`, `anchors_sonnet55`, `offsets`, `trimmed`; the `--analysis-dir` files to `compare-generations.js` for each.

On the subscription CLI the same all-families block is sent and counted fresh on every call (`claude -p` caches on its own terms, section 4), about 143,000 tokens of the subscription's capacity per extraction call; the CLI's default therefore sends the routed families' contracts (`DEFAULT_CLI`, about 23,000 tokens of stable blocks), the same request otherwise, and the ladder does the same on the CLI for any rung that names every family (finding (186)).

## 15. The Batch API on the API provider (finding (190), designed)

The reference (`typescript/claude-api/batches.md`): `client.messages.batches.create({ requests: [{ custom_id, params }] })`, up to 100,000 requests or 256 MB in one batch; `batches.retrieve(id)` until `processing_status` is `ended`; `batches.results(id)` streams one line per request with `custom_id` and a `result` whose `type` is `succeeded`, `errored`, `canceled` or `expired`; `batches.cancel(id)`; most batches finish within an hour, every one within 24 hours, and the price is 50 per cent of the list price on every token, cache reads and writes included. Cache hits inside a batch are best-effort: the two-block prompt still names its breakpoints, and the design prices on the 50 per cent of list without the cache's saving, which is then upside.

The design, against today's worker (`scripts/product-hosted-worker.js`, implementer D's; the change is the worker's and goes to D through this finding, the pipeline's side being in place):

1. Three waves per run, each one batch of the sections' calls of one kind: routing (the sections without deterministic routing), residual (the sections whose residual is not merged into the extraction), extraction (one request per section or part). A wave's requests are the same request bodies the loop sends now; `custom_id` is the model invocation id the ledger already computes (`PRODUCT_MODEL_INVOCATION/V1` over the attempt token and the call kind, section 10, query 7, with the part number for a split section), so a result maps to its work row without a new table.
2. The batch id is the lease: `product_section_work` rows in a wave carry the batch id in place of a worker's lease token, and a worker that restarts finds the batch by id and resumes at `retrieve`. A `canceled` or `expired` result re-queues the row into the next batch of its kind; an `errored` result is the row's failure as a loop failure is now.
3. The compiler runs on the worker as results stream: a routing result decides the section's residual and extraction requests, which go into the next wave; an extraction result compiles into the section result and the run's rows. A long section's split after an output cap (`cap_failed_parts`) is one more extraction request in the following wave.
4. The run's stop cancels the open batch; the wake path (`wakeSandboxRun`) is unchanged, the sandbox's work being three waits instead of eight loops.

Cost on the default's projection: $72 to $36. Time: three batch turnarounds in series, typically well under an hour each, against the 70 minutes the loop takes at eight loops; the floor is no longer the longest section's output but the batch's queue. The subscription CLI has no batch; the design is the API provider's only, and so is the full-agreement confirmation run's second half where it goes to the API.
