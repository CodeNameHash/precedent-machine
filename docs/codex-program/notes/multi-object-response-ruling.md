# Ruling: multi-object model responses (BREAKs 1 and 4, and the parked capitalisation recordings)

Working note, 2026-08-08. Ruled by Fable under Ben's standing delegation
(DECISIONS.md decision 1 precedent: comparable design decision delegated the
same day). The section below headed **"RULING"** is written to be carried
into `DECISIONS.md` verbatim.

Everything here was established from committed artefacts at **zero model
cost**: the recorded responses, `call-telemetry.json`, the parser source, and
the runner source. No production code was touched. File paths are relative to
the repository root.

---

## RULING — Multi-object model responses are transport truncation, not a model format. RULED 2026-08-08 by Fable, under Ben's delegation.

**The mechanism chosen: raise the CLI output ceiling to the model's real
128K maximum, and make ceiling-overflow a typed, loud, non-retryable failure
detected from telemetry arithmetic, never from response content. Multi-object
responses are never accumulated and never superseded — there is no valid
reading of one, and the parser's refusal remains correct behaviour under a
corrected diagnosis.**

### 1. What the objects are: neither an enumeration nor a retry. They are orphaned array elements of ONE answer whose head the transport destroyed.

The question was posed as accumulate-versus-supersede. The recorded responses
show it is a false dichotomy, in all three instances.

**Every recorded failing response is a tail fragment.** Each begins
mid-JSON — mid-string, inside a structure whose opening braces are absent —
and ends with a clean array close and fence:

- `evidence/canonical-v2/modiv-capitalisation-20260807-step2d1-fix-live/native-producer-recorded-response-4.2.json`
  opens `by Parent free and clear of any Liens other than permitted
  restrictions…"` — the middle of a quote field — and ends with a complete
  `share_counts`-style array closing `] } ``` `.
- The `-nofollow` twin opens ` modifying voting, transfer, or registration
  rights with respect to Parent/Parent Subsidiary capital stock…"` — same
  shape, different sampling.
- `evidence/canonical-v2/topbuild-no-shop-20260808-rung4/native-producer-recorded-response-4.3.json`
  opens `identity of the applicable third party",` and consists of the tail
  of an `open_world_candidates` array.

**The counted "objects" are heterogeneous array members, not candidate
answers.** Replaying the parser's own balanced-brace scan
(`findTopLevelJsonObjects`, `lib/canonical-v2/native-producer/anthropic-provider.js:3409`)
over the recorded text:

- Modiv CAP live, "58 objects": 18 × `{kind, code, quote, attachment}`
  (qualifiers), 17 × `{quote, target}`, 16 × `{section_reference,
  party_making, count_kind, share_class, plan, quote, limb_path}` (share
  counts), 7 × `{defined_term, quote}`. Four different array-element shapes
  from four different arrays of one response object.
- Modiv CAP nofollow, "52 objects": six shapes, same story.
- TopBuild NO_SHOP, "5 objects": five × `{observed_quote, why_unmapped,
  nearest_concept}` — five `open_world_candidates` entries, the **last**
  array in the response shape. Everything before it — every governed no-shop
  assertion — is gone.

They count as "independent top-level objects" only because the enclosing
object's opening structure was amputated: with the outer braces gone, the
scanner correctly finds the surviving members as siblings. (One exact
duplicate object exists among the 58 — consistent with a legitimately
repeated qualifier quote such as "As of the Capitalization Date" attached to
parallel limbs, not with a restart. Immaterial either way, since no
accumulate rule is adopted.)

**Consequently both proposed semantics are catastrophically wrong:**

- *Accumulate* builds a "response" from whatever array tails survived.
  For NO_SHOP §4.3 that is a no-shop family with **zero governed
  restrictions and five open-world scraps** — indistinguishable on the page
  from a weak-but-valid extraction. For capitalisation it is a share
  register missing every class whose row fell before the truncation point.
  This is precisely `OPERATING-RULES.md`'s worst case: plausible, wrong, and
  silent.
- *Supersede* keeps one arbitrary array element as the entire answer.
  Nonsense on its face.

**Same answer in all three instances.** REPRESENTATIONS §3.1 is the same
failure with a different last message: the model's final turn was prose —
*"the head — clauses (a) through (n) — was delivered in my previous message;
the corrected tail — clauses (o) through (t) … Both message halves together
constitute the single complete JSON object requested."* — so the parser
reported `NOT_FOUND` instead of `AMBIGUOUS`. One phenomenon, two
presentations, three families, two documents.

**And even full multi-message capture would not make stitching mechanical.**
The REPRESENTATIONS prose says the tail it delivered was "**corrected**" —
the model superseded part of its own earlier output within the stream. A
concatenation rule would double-count; a supersede rule would discard. The
two cases cannot be distinguished from the response alone, which — per the
constraint governing this ruling — makes **refuse and record** the only
correct behaviour for a truncated stream, and it is what the parser already
does. What is wrong is only the diagnosis label ("cannot guess which is
authoritative" — there is nothing to guess between) and what happens next.

### 2. Overflow, not format — proven arithmetically for every instance

Every recorded instance exceeded the CLI's 64,000-token output ceiling for
`claude-sonnet-5`, and the recorded response is exactly the **final
continuation message**, matching the final `usage.iterations` entry:

| Instance | `output_tokens` | ceiling | final iteration | recorded text |
|---|---|---|---|---|
| Modiv CAP §4.2 (live) | **71,907** | 64,000 | 7,907 tok | 17,731 chars — tail fragment, 58 "objects" |
| Modiv CAP §4.2 (nofollow) | **71,430** | 64,000 | 7,430 tok | 17,175 chars — tail fragment, 52 "objects" |
| TopBuild NO_SHOP §4.3 | **65,210** | 64,000 | 1,210 tok | 3,026 chars — tail fragment, 5 "objects" |
| TopBuild REPS §3.1 | **74,080** | 64,000 | 876 tok | 2,308 chars — prose summary |

The chain: `scripts/canonical-v2-live-extraction-run.mjs:942` drives the
model via `claude -p --output-format json`; when generation hits the CLI's
output cap the CLI continues into a new assistant message; line 1034 takes
`parsed.result` — **the final message only** — as the whole response. The
head halves were never received by the harness and are not in the
recordings. The objects are a transport phenomenon. The model was asked for
one JSON object and, on the evidence of its own final messages, produced
one; the transport delivered a fragment.

**The over-ceiling coin flip, closed with a fifth data point.** The earlier
latency ruling recorded NO_SHOP §5.6 on Modiv at 65,008 tokens "requiring
CLI-side continuation" — and that run *succeeded*. Audit of its committed
artefacts explains why, at zero cost: final iteration 7,617 tokens, and
`modiv-no-shop-20260806/native-producer-recorded-response-5.6.json` **begins
at the beginning** — "All quotes verified. Here is the extraction: ```json
{…" — a complete, self-contained JSON in the continuation message. The
64,000 boundary fell inside invisible thinking (~88–92% of output per the
latency ruling), so the whole visible JSON was emitted after the boundary.
In the four failures the boundary fell inside the visible JSON. Whether an
over-ceiling call survives is a coin flip on where the cap lands; §5.6 came
up heads. This also retires the "same section works one day, fails the next"
puzzle — CAP §3.2 at 63,729 tokens succeeded by a 271-token margin.

Also confirmed: PLAN.md Step 2D2's attribution of the multi-object parse to
capitalisation's nature is wrong, as the TopBuild note already argued —
parking `CAPITALISATION` parked one symptom of a transport defect that has
now hit three other families.

### 3. The mechanism, and why the alternatives lose

**Adopted: raise the output ceiling to the model's maximum, and detect
overflow from arithmetic.** Two parts, both required:

**(a) Raise the ceiling.** The 64,000 figure is the Claude Code CLI's
configured cap for sonnet (visible in every `call-telemetry.json` under
`model_usage.claude-sonnet-5.maxOutputTokens`), **not** the model's limit:
`claude-sonnet-5`'s API maximum output is **128,000 tokens**. The CLI
exposes this as configuration (`CLAUDE_CODE_MAX_OUTPUT_TOKENS`); the
implementation sets it in the runner's `childEnv()`
(`scripts/canonical-v2-live-extraction-run.mjs:934`) and **proves the CLI
honours it** with one cheap call whose telemetry shows the raised
`maxOutputTokens` — configuration claims get verified, not assumed. Worst
observed overflow is 74,080 (15.7% over 64K; 42% headroom under 128K).

- *Cost:* zero dollars (subscription auth; the overflow tokens were already
  being generated and thrown away — each failed call burned ~$1.5–2.1
  notional and 9–11 minutes to deliver nothing). Zero latency change for
  calls under 64K, which are unaffected.
- *Risk:* the ceiling moves, it does not disappear. Thinking volume is
  stochastic and unbounded above; a denser section on a future agreement can
  exceed 128,000. That is why (b) is not optional.
- *What this does not change:* the prompt, the ask, and the response shape
  are all untouched — the cap is not part of the request semantics the model
  sees — so **no parity evaluation of the prompt is required**. Acceptance
  is: TopBuild REPRESENTATIONS §3.1 and NO_SHOP §4.3 re-run to completion,
  parse as one object, and pass the same validation → durable write →
  projection gates every other family passed at Step 2F, plus the standard
  mechanical gates (`CI=true npm test`, `npm run build`,
  `bash scripts/lint/forbidden-patterns.sh`). Replay-based gates
  (`gate:baseline`) are unaffected by construction, since replays never
  exercise the cap.

**(b) Detect overflow arithmetically, fail loudly, never retry, never
parse.** `usage.output_tokens >= maxOutputTokens` is already recorded per
call in `call-telemetry.json` and read by nothing. The provider/runner must:

1. Evaluate that predicate on every live call, **before** the response text
   is handed to `extractSingleJsonObject`.
2. On overflow, raise a typed failure naming the real cause (e.g.
   `RESPONSE_TRUNCATED_BY_OUTPUT_CEILING`, with both token figures in the
   details) — not `MALFORMED_RESPONSE`, and not `RESPONSE_TOO_LARGE`, which
   measures received characters and provably never fires for this (the
   received fragment is *small*).
3. Never retry: 74,080 > 64,000 is arithmetic, not sampling. A retry costs
   ~10 minutes to fail identically.
4. **Fail even when the final message parses.** An over-ceiling call whose
   last message is one well-formed object is not thereby proven complete —
   a continuation could in principle deliver a complete-looking *smaller*
   object, and completeness cannot be established from the response alone.
   The completed-but-over-ceiling run is quarantined pending the audit in
   §4 below, which *is* decidable from artefacts.

### 4. How a run detects it got the wrong reading

In order of authority:

1. **The arithmetic predicate** (§3b). Content-independent, already
   recorded on every call, catches every instance in this ruling including
   the prose-summary presentation. This is the mechanism; nothing
   content-based can be, because a family returning zero can be correct
   (CLAUDE.md) — absence of content is never evidence of truncation, and
   presence of parseable content is never evidence of completeness.
2. **The zero-cost completeness audit for over-ceiling runs that parsed.**
   Decidable from committed artefacts: if the recorded
   `raw_response_text` (i) begins at the beginning — prose preamble and/or
   opening fence and `{` — (ii) parses as one object, and (iii) has length
   consistent with the final `usage.iterations` entry alone, then the
   entire visible JSON was emitted after the boundary and the run is
   complete. `modiv-no-shop-20260806` §5.6 **passes this audit** (verified
   in preparing this ruling: 65,008 total, 7,617 final-iteration tokens,
   17,724-char response opening "All quotes verified. Here is the
   extraction:") and stays importable. Any future over-ceiling run must
   pass the same audit or be re-run.
3. **The parser's refusal stays as defence in depth**, re-labelled: the
   `AMBIGUOUS` path should only ever be reached when `output_tokens` is
   *under* the ceiling. If that ever happens, it is a genuinely new
   phenomenon — a model actually choosing a multi-object format — and gets
   its own investigation and ruling. It is not covered by this one and must
   not be folded into it.
4. **Quote verification against source bytes** remains the floor for
   corrupted content, but it cannot detect *missing* content; do not lean
   on it for this defect.

### 5. Options rejected, with grounds

**Chunk the section — rejected.** The latency ruling already found thinking
does not scale with input size and rejected splitting because it "destroys
within-section cross-reference context"; that ground stands and this ruling
does not need to re-litigate it. Two additional grounds specific to these
instances: (i) the binding constraint is *output/thinking* volume, which
tracks reasoning density, not section bytes — TopBuild §4.3 is 25,457 bytes,
less than a third of §3.1's 83,756, and overflowed anyway, so a byte-based
chunker does not even predict the failure; (ii) chunking changes what the
model is asked, so it could not ship without a parity evaluation (live
paired runs, old-ask versus new-ask, on the affected sections across both
documents, compared at adapter level — recordings cannot help because they
are request-hash keyed). If a section ever exceeds the 128K ceiling with
detection firing loudly, chunking becomes a live question again **and
requires exactly that parity evaluation plus its own ruling** — the split
would have to follow the agreement's own sub-clause boundaries with the
section's definitions and chapeau carried into every chunk, and that design
is explicitly not decided here.

**Accept multi-object responses and define accumulate/supersede semantics —
rejected outright.** There is no semantics to define: §1 shows the objects
are amputated array elements of a response whose head the harness never
received and the recordings do not contain. Any acceptance rule launders a
transport truncation into a confidently wrong legal answer with no signal —
a wrong share register, a no-shop with its restrictions missing. Refusal is
correct; this ruling only corrects the refusal's name and stops the loss of
already-generated work.

### 6. Explicitly not decided

- **Capitalisation stays parked** (Ben, 2026-08-08, PLAN.md Step 9F). Its
  recordings served as evidence here; no capitalisation run on any document
  is authorised by this ruling, even though the fix will likely clear its
  transport failure.
- **BREAKs 2, 3, 5, 6 and `closure_id`** — producer-prompt scope, projection
  validators, identity stability — are separate defects, untouched.
- **Whether 128,000 suffices across 40 agreements** — unknowable until
  measured. The detection in §3b makes the answer arrive loudly instead of
  as a silent wrong extraction; if it fires, escalate per §5.
- **The CLI-wrapper/quota question** from the token-cost ruling — unrelated,
  unchanged.
- **No production code is edited under this ruling.** Implementation — the
  `childEnv()` env var, the typed overflow failure, and the §4.2 audit
  wiring — is an ordinary engineering step: reviewed diff, hostile test
  proving an under-ceiling `AMBIGUOUS` still refuses, and the acceptance
  runs named in §3a. Other agents are on the adjacent files; this lands as
  its own change.

---

*Evidence inventory used (all committed): the four failing recorded
responses and their `call-telemetry.json` under
`evidence/canonical-v2/{modiv-capitalisation-20260807-step2d1-fix-live{,-nofollow},topbuild-no-shop-20260808-rung4,topbuild-representations-20260808-rung3}/`;
the passing over-ceiling run `modiv-no-shop-20260806/`; parser at
`lib/canonical-v2/native-producer/anthropic-provider.js:3402–3528`; runner
transport at `scripts/canonical-v2-live-extraction-run.mjs:934–1034`;
`docs/codex-program/notes/step-2f-topbuild-fan-out.md` BREAKs 1 and 4;
DECISIONS.md "Recently decided" latency ruling. Model output limits
confirmed against current Anthropic model documentation: `claude-sonnet-5`
maximum output is 128K; 64,000 is the CLI's per-model default cap.*
