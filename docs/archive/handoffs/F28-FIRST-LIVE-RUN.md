# F28 — first live end-to-end native extraction run

Real QXO/TopBuild merger agreement, real converter, real sectionizer, one
LIVE model call, real `resolveCandidates` → `buildNativeWriteSet` →
`validateResolvedCanonicalWriteSet`. This is the first time the native
capitalisation pipeline has been driven against a real filing instead of a
stub. Raw filing is NOT committed (large, and fetchable on demand); the
recorded model response, the orchestration script, and this note are.

Recorded fixture: `tests/fixtures/canonical-v2/f28-live-run/qxo-topbuild-3-1-b-live-response.json`
Script: `scripts/canonical-v2-f28-live-extraction-run.mjs`

## Step 1 — source

- Deal: QXO, Inc. acquiring TopBuild Corp. Agreement and Plan of Merger dated
  April 18, 2026 (QXO, Titanium Merger Sub, Forward Merger Sub, TopBuild).
- Filed as **Exhibit 2.1** to QXO's 8-K, accession **0001104659-26-045111**,
  filed 2026-04-20, CIK 1236275.
- EDGAR URL: `https://www.sec.gov/Archives/edgar/data/1236275/000110465926045111/tm2612209d1_ex2-1.htm`
- Fetched with `User-Agent: precedent-machine research bengoodchild@gmail.com`,
  ~400ms between the index and document requests (same pattern as
  `scripts/fetch-metsera-sealed-sources.mjs`).
- Raw bytes: **732,686 bytes**, SHA-256
  `146189ed57883d25aa571650fe5c40dff4bfce0e3ea75d67be463440417bda3f`. This is
  the document's identity used as `document_hash` throughout (per
  `admitted-semantic-source.js`, `document_hash` is the raw response bytes'
  SHA-256, not the canonical text's — see "document_hash convention" below).

## Step 2 — conversion and sectionizing

Used `lib/canonical-v2/sec-html-canonical-text.js`'s byte-precise lexer
standalone, driven exactly as the real pipeline drives it:
`buildSecEdgarIntakeCapture` → `convertSecHtmlToCanonicalText`, then
independently re-verified with `sec-html-canonical-text-verifier.js`'s
`verifySecHtmlCanonicalText` (**PASS**), then the real admission chain
(`sec-source-admission.js` → `admitted-semantic-source.js`) to get a genuine
`ADMITTED_SEMANTIC_SOURCE_CONTEXT/V1`, not the test suite's synthetic
"identity converter" shortcut.

- Canonical text: **413,966 bytes**, SHA-256
  `6f7f30b32c00c1d8acf3524594a3565306ed16f022dd13dda8150ca8d6541a1c`.
- `sectionizeAdmittedSource` found **338 nodes**: 1 ROOT, 8 ARTICLE, 8
  top-level SECTION (mostly degenerate "X-INTRO" catch-alls, see below), 321
  SUBSECTION.
- **Capitalisation representation**: reference `III-INTRO(b)`, bytes
  `[57875, 62564)` (4,689 bytes). Content verified byte-exact against the
  source: starts `"(b) Capital Structure.\n(i) The authorized capital
  stock of the Company consists of..."`.
- **Closing-condition bring-down**: reference `V-INTRO(e)(a)(ii)`, bytes
  `[358375, 360734)`. Content verified: the Section 5.2(a)(ii) bring-down,
  carrying the classic capitalisation carve-out — *"the representations and
  warranties of the Company set forth in Section 3.1(b)(i) and Section
  3.1(b)(iii) (Capital Structure) shall be true and correct at and as of the
  date of this Agreement and the Closing Date... except for De Minimis
  Inaccuracies"* — alongside a separate MAE-qualified tier for the rest of
  Section 3.1(b) and a whole-rep tier for other reps. Not extracted in Step
  3 (Step 3 was scoped to the capitalisation rep only, per instructions).

### `document_hash` convention

`document_hash` is bound to the **raw fetched file's own SHA-256**, not the
canonical text's hash. `admitted-semantic-source.js`'s
`buildAdmittedSemanticSourceContext` sets `document_hash:
immutable.response_bytes_sha256` — i.e. the *raw HTTP response bytes'*
digest. `scripts/canonical-v2-native-extract.mjs` instead derives
`document_hash` as `sha256(source_text)` because, per its own header
comment, it "has no separate admission pipeline to source one from" — a
convenience default for a context with no real admission chain. Once a real
admission chain is in the loop (as it is here), using the canonical-text
hash as `document_hash` would make `resolveCandidates` fail closed with
`DOCUMENT_HASH_MISMATCH`, because `admitted_source_context.document_hash`
and a canonical-text-derived `document_hash` are hashes of two different
byte streams. This run uses the raw-file hash everywhere, consistently, and
it is also literally the identity Step 1 asked for ("the SHA-256 of what you
fetched... becomes the document's identity").

### Converter fidelity notes (observed, not fixed — out of scope)

- **Undecoded entity**: `&lrm;` (U+200E LEFT-TO-RIGHT MARK) is not in
  `sec-html-canonical-text.js`'s `NAMED_ENTITIES` table, so it survives into
  the canonical text as the literal string `"&lrm;"` wherever the filing
  uses it before a cross-reference (e.g. `"Section &lrm;3.1(b)(i)"`). Not
  data-corrupting — the model quoted straight through it, byte-exact — but a
  real fidelity gap against a fully decoded rendering.
- **Page-number leakage**: bare page-break digits (e.g. a lone `"16"` between
  two paragraphs) survive into the canonical text as stray numeral tokens,
  an HTML pagination artifact the converter doesn't strip.
- **Heading capture gap**: the sectionizer's own `captureMarkerHeading`
  heuristic should have captured `"Capital Structure."` as `III-INTRO(b)`'s
  `heading`, but returned `null`. Not investigated further (in
  `native-producer/deterministic-sectionizer.js`, off-limits for this task).
- **Structural degeneracy**: `parseStructure` (`lib/parser-v2/structural.js`)
  found **zero** `"Section X.XX"` headings anywhere in this real filing,
  because QXO/TopBuild's actual drafting convention is a bare lettered list
  `(a)`–`(s)` directly under each ARTICLE heading, with no decimal section
  numbers at all (confirmed: zero occurrences of the string `"Section 3."`
  anywhere in the 413,966-byte canonical text). Every ARTICLE therefore
  collapsed into one big `"X-INTRO"` pseudo-section with all real content
  living as marker-tree `SUBSECTION` nodes underneath it. This is a known,
  designed-for shape (`deterministic-sectionizer.js`'s own header comments
  anticipate "our real QXO fixture starts at `(b)`, not `(a)`"), not a
  surprise — but it means the `III-INTRO(b)` node id is the sectionizer's
  synthetic addressing, not a real "Section 3.1(b)" citation that exists in
  the document (see Step 5, finding 6, for why this matters).

## Step 3 — live extraction run

**No `ANTHROPIC_API_KEY` was available in this environment.** Rather than
skip the live call, this run used the Claude Code subscription CLI
(`claude -p --model sonnet`) as the model backend, injected through
`createAnthropicProvider`'s `client` seam — the same mechanism
`lib/llm-cli-client.js` documents ("subscription-powered LLM backends...
`createClaudeCliClient()` → `claude -p` subprocess") and this repo's
`CLAUDE.md` describes as the zero-metered-token production path. This is a
genuine, unstubbed model call (served model: **Claude Sonnet 5**, per the
CLI's own `--output-format json` telemetry), not a fixture replay.

**Wall clock: 361.5 seconds (~6 minutes).**

**Token usage (as billed by the CLI):**

| | |
|---|---|
| input_tokens (fresh) | 2 |
| cache_creation_input_tokens | 14,741 |
| cache_read_input_tokens | 29,457 |
| output_tokens | 43,101 |
| **CLI-reported cost** | **$0.7477** (Sonnet 5 $0.7438 + $0.0035 Haiku title-generation overhead) |

**This $0.75 figure is NOT a clean per-document extraction cost — read the
caveat below before using it for corpus planning.**

### Why the raw number is misleading, and a better estimate

A control call (a single trivial one-line prompt via the identical `claude
-p` mechanism) burned ~40,000 input tokens purely in Claude Code's own
harness overhead (system prompt, tool definitions, CLAUDE.md, memory files)
before any real content — confirming that most of this run's
44,198-token input total is CLI-harness overhead, not the native-producer
prompt. The actual prompt built by `buildCapitalisationProducerPrompt`
(instructions + controlled vocabularies + response shape + the 4,689-byte
section text) is **11,379 characters** (~2,845 tokens). Of the 43,101 billed
output tokens, only **19,470 characters (~4,868 tokens)** was the model's
visible JSON answer — the remaining ~38,000 tokens were invisible adaptive
thinking (Sonnet 5 runs adaptive thinking by default under the CLI's
defaults; `anthropic-provider.js`'s real metered-API path never requests
`thinking` at all, so this overhead is an artefact of *how this call had to
be sourced*, not of the pipeline itself).

**Metered-API-equivalent estimate** for corpus-scale planning, using
`lib/model.js`'s pinned `DEFAULT_MODEL` (`claude-sonnet-4-6`, $3/$15 per
MTok, no thinking requested):

```
~2,845 input tokens  × $3 /1M  ≈ $0.0085
~4,868 output tokens × $15/1M  ≈ $0.073
                                ────────
                        total  ≈ $0.08 per capitalisation-section call
```

That is roughly **9x cheaper** than the measured CLI figure, and the call
would also almost certainly take single-digit seconds rather than 6 minutes,
because it skips both the harness overhead and the invisible thinking pass.
**This is an estimate, not a measurement** — this environment had no
`ANTHROPIC_API_KEY` to verify it directly. There is genuinely no cost
telemetry anywhere in this repo before this run; `call-telemetry.json` (not
committed — see below) is the first real number, and the $0.08/section
metered estimate is the one to use for corpus planning, not the $0.75
CLI figure.

**Actionable finding:** don't use the `claude -p` subscription-CLI backend
as the production path for native extraction if wall-clock or token cost
matters. It's a legitimate zero-metered-dollar fallback when no API key is
available (as here), but it is not a fair proxy for metered-API economics —
plan corpus-scale cost off the $0.08/section estimate, not the $0.75 figure,
and confirm it with a real API-key call before trusting it further.

## Step 4 — resolve, write, validate

`resolveCandidates` → `buildNativeWriteSet` → real
`validateResolvedCanonicalWriteSet`, exactly as
`tests/canonical-v2-candidate-resolution.test.js`'s
"resolved output feeds buildNativeWriteSet" test wires them.

| Stage | Result |
|---|---|
| Compiled candidates (native-extraction-run) | **33 ok / 0 rejected** |
| Producer evidence_residuals | **0** |
| Scope violations | **0** |
| resolveCandidates: resolved | 15 |
| resolveCandidates: auto_pass | **0** |
| resolveCandidates: review_queue | 15 (all: `UNREGISTERED_CANONICAL_VALUE`) |
| resolveCandidates: open_world | 18 (all: `UNMAPPED_GENERIC_CLAIM_KEY`) |
| resolveCandidates: provisions minted | 1 |
| buildNativeWriteSet: claims written | 15 |
| buildNativeWriteSet: adapter residuals | 0 |
| validateResolvedCanonicalWriteSet: accepted | **true** |
| validateResolvedCanonicalWriteSet: residuals | 15 (all: `INVALID_CANONICAL_VALUE`) |
| validateResolvedCanonicalWriteSet: quarantines | **15** |
| **Publishable claims** | **0** |

Every quote-bearing proposal the model returned verified byte-exact
(0 evidence_residuals, 0 scope_violations across 33 candidates) — the
provider-level evidence gate is working correctly against a real, messy
filing, not just curated fixtures.

**All 15 resolvable claims were quarantined, 0 became publishable.** Root
cause, traced precisely: every one of the 15 came from a qualifier the model
tagged `kind: TEMPORAL`, `THRESHOLD`, or an `ACCURACY` qualifier with no
matching controlled code — i.e. `canonical_value: null` (correctly so, per
the prompt's own "if no code fits, set null" instruction).
`candidate-resolution.js`'s `GENERIC_CLAIM_KEY_RESOLUTION_TABLE` routes
**every** `QUALIFIER_CLAIM_KEY` proposal — regardless of the model's own
`kind` field — to the single registered claim definition
`REPRESENTATION_ACCURACY_STANDARD`, which only accepts a controlled
`ACCURACY_STANDARD` code as `canonical_value`. A `null` value fails
`canonicalValueAllowed()` → `UNREGISTERED_CANONICAL_VALUE` in the resolver,
then the same defect is independently re-caught by
`validate-write-set.js`'s own structural check → `INVALID_CANONICAL_VALUE`
→ quarantined. **This is a real, pre-existing gap in the resolution stage,
not a defect in the model's extraction and not something this run
introduced** — it is simply the first time the resolver has been exercised
against a real filing's real qualifier mix (dominated by `TEMPORAL`/
`THRESHOLD` — "as of [date]", "except as set forth above") instead of a
hand-picked, `ACCURACY`-only test fixture. As things stand today, a
capitalisation-rep qualifier of kind `TEMPORAL` or `THRESHOLD` — two of the
most common qualifier shapes in real capitalization reps — can **never**
become a publishable claim, independent of extraction quality.

The 18 `open_world` entries (every limb's `assertion_quote`) are expected,
not a defect: `LIMB_ASSERTION_CLAIM_KEY` is deliberately unmapped by design
(no registered "a limb was asserted" claim type exists yet in v1's
vocabulary) — this is documented in `candidate-resolution.js`'s own header.

## Step 5 — honest quality assessment

### What it got right

- **Coverage is essentially complete.** Every substantive element of the
  real Section 3.1(b) capital structure representation was found:
  authorized/outstanding common and preferred stock, due-authorization
  language, reserved-for-issuance shares, options/RSU/PSU counts with the
  Disclosure Letter cross-reference, subsidiary equity cleanliness, the "no
  other Company Equity Rights" clause, no cross-subsidiary ownership of
  Company stock, upon-issuance due authorization, the one real limb-level
  materiality carve-out, no voting debt, no voting trusts. Nothing
  substantive from the governed 4,689-byte scope was skipped.
- **Evidence quotes are byte-exact, provably, at scale.** 33/33 compiled
  candidates verified byte-for-byte against the source (0 residuals, 0
  violations) — including a quote that reproduces the un-decoded `&lrm;`
  entity artifact verbatim (`"Sections &lrm;3.1(b)(i) and &lrm;3.1(b)(ii)"`),
  which is strong evidence the model is quoting the literal bytes it was
  handed rather than a cleaned-up paraphrase.
- **It never asserted a negative as a meta-observation.** The document's own
  affirmative "no X" representations (no Company Equity Rights outstanding,
  no voting trusts) were captured correctly as positive assertions the
  Company makes — that's different from (and correct, versus) the model
  claiming on its own initiative that something is absent.
- **`kind: null` code discipline mostly held.** For qualifiers with no
  matching controlled code (`TEMPORAL`, most `THRESHOLD`), the model
  correctly emitted `code: null` rather than forcing a nearest-fit
  `ACCURACY_STANDARD` value. Good instruction-following on the "never
  invent a code" rule specifically.

### What it got wrong

1. **Structural fragmentation — the single biggest defect.** The real
   document has ONE representation — `"(b) Capital Structure."` — with
   limbs `(i)`–`(v)` (and `(i)`, `(ii)` further split into `(A)(B)(C)`
   sub-limbs). The model split this into **12 separate
   `representation_instances`**, most holding a single limb, several
   improperly *reusing the same `limb_reference`* across distinct fragments
   (`"(i)"` used in 3 different pseudo-reps, `"(iii)"` in 2, `"(iv)"` in 2).
   The prompt's schema has no field for "this limb has sub-clauses" nesting,
   and the model resolved that tension by promoting every sub-clause — even
   every sentence — to its own top-level representation, rather than
   flattening sub-limbs into distinct `limb_reference`s (e.g. `"(i)(A)"`)
   inside one representation.
2. **Consequently: the limb-level threshold was NOT correctly kept at limb
   level.** The document's one clear limb-level materiality qualifier
   (*"...with a fair market value that is material to the Company and its
   Subsidiaries, taken as a whole"*, on limb `(iv)`'s clause about
   non-Subsidiary equity holdings) was captured with the **correct**
   controlled code (`MAT_MATERIAL_INLINE`) but the **wrong** attachment:
   `"REPRESENTATION"` instead of `"LIMB"`. This is a direct consequence of
   finding 1 — once the whole representation is atomized into single-limb
   fragments, `"REPRESENTATION"` vs `"LIMB"` becomes an arbitrary choice
   within each fragment, because there is no longer a sibling limb structure
   to be limb-level *relative to*. This is exactly the failure mode this
   feature's own design docs (`capitalisation-producer-prompt.js`'s header)
   describe as the reason the feature exists — and on this live run, it
   happened.
3. **Hallucinated section numbering.** Every fragment's `section_reference`
   reads `"3.1(b)(i)"`, `"3.1(b)(ii)"`, etc. — but this citation does not
   exist anywhere in the document (confirmed: zero occurrences of `"Section
   3."` in the 413,966-byte canonical text) or anywhere in the 4,689 bytes
   the model was actually shown, which begins literally `"(b) Capital
   Structure.\n(i) The authorized capital stock..."` with no `"3.1"` digits
   present at all. The model invented a plausible, conventional-looking
   section citation not present in its input. `section_reference` is a
   free-text metadata field, not a verbatim-quote field, so it is **not**
   caught by the byte-exact evidence gate — this is a class of hallucination
   the current architecture has no mechanism to detect at all.
4. **Incomplete open-world discipline.** One qualifier (`"correct and
   complete"`, describing the Disclosure Letter's completeness) correctly
   got `code: null` — no `ACCURACY_STANDARD` value matches "correct and
   complete" verbatim — but the model did not also raise it as a separate
   `open_world_candidates` entry, as its own instructions require ("If no
   code fits, set the field to null **and raise an open-world candidate**").
   It just left it as a silently uncoded, dead-end qualifier. Minor, but a
   literal instruction-following miss.

### What it missed

Nothing substantive from *within* the governed section — the run saw and
used all 4,689 bytes. What a lawyer reviewing this deal would also want,
and this run structurally could not supply (by design — Step 3 was scoped
to the capitalisation rep only): the Section 5.2(a)(ii) bring-down carve-out
(found and reported in Step 2, not extracted in Step 3) and the companion
"Capitalization of Titanium Merger Sub" representation, which sits entirely
outside the governed scope of this call.

### Bottom line

The provider-level extraction quality is genuinely good on a real, messy
filing — complete coverage, byte-exact quotes at scale, correct negative
handling, mostly correct code discipline. But **zero of the 33 extracted
candidates reached a publishable claim in this run**: 18 by design (no
registered limb-assertion claim type yet), 15 because of a real,
newly-exposed gap in `candidate-resolution.js`'s qualifier-kind-blind
mapping table that quarantines every `TEMPORAL`/`THRESHOLD` qualifier
unconditionally, regardless of extraction quality. And the model's own
worst failure — fragmenting one representation into 12 pseudo-reps, which
then caused the one real limb-level threshold to be mis-attached to
representation level — is exactly the failure mode this feature's design
was built to catch and didn't, on its first live outing.
