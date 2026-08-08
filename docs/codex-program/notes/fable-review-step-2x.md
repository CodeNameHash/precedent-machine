# Fable adversarial review — Step 2X

Reviewer: Fable. Date: 2026-08-08. Branch: `claude/codex-handoff-plan-status-77wn7n`.
Scope: PLAN.md Step 2X (lines 1913–2365), sweep-disposition.md, DECISIONS.md
entry 14. No code edited, nothing committed. Every claim below was checked
against the code or the evidence directories, not the plan's own prose.

---

## 1. Decision: Step 2X-A — converge a named subset, not all five

**Decision: converge TWO of the five (the structural halves of the termination
limb finder, plus the 2X-I limb pre-pass) onto one structure-context service
over `segmentSubClauses`. Keep `findIocChapeau`, `qualifier-attachment.js` and
`limb-components.js` separate, with the written reasons below.** Full
convergence of all five would be a category error: only two of the five
actually answer "what governs this span" by reading text structure. The other
three answer different questions on different inputs.

### The comparison (code read, not headers)

**1. `findTerminationLimbGrantContext`** (`candidate-resolution.js:1896`).
Real input: section byte range + canonical text + `sectionReference` ("7.1") +
`citationReference` ("7.1(c)(i)") + claimed party + party scope. Real output:
`{ span }` of the limb's own chapeau head, or null. Question: "does THIS limb's
chapeau grant the termination right to THIS party?" It is two functions fused:
a **structural locator** (`findTerminationLimbChapeau`, line 1808: find the one
paragraph-initial `(c)` marker, bound the head at the first of `:`/`;`/newline,
fail closed on 0 or >1 occurrences) and a **semantic grammar**
(`parseTerminationLimbDirection`, line 1855: four party-grant patterns compared
by resolved capacity, fail closed on UNRECOGNISED).

**2. `findIocChapeau`** (`candidate-resolution.js:1639`). Real input: section
byte range + canonical text + `beforeAbsoluteStart` byte offset + covenant
side. Real output: the **nearest preceding** `{ party, span, quote }` matching
`/(company|parent|…) shall not/` bounded at the next `:`, or null. Question:
"which negative-covenant chapeau binds the restriction starting at this byte
offset, and which party does it bind?" Its anchor is a **lexical verb pattern**,
not an outline marker; its selection rule is proximity-before-offset filtered
by party capacity.

**3. `qualifier-attachment.js`**. Real input: model-reported position
(CHAPEAU/ITEM/TRAILING) + the qualifier's **own verbatim quote** + sibling limb
paths. It **never touches section text and takes no span at all**. Real output:
frozen `scope_reading` (ALL_ITEMS / THIS_ITEM_ONLY / AMBIGUOUS) + decision-
support readings. Question: "what scope does this qualifier's own wording
imply?" — the last-antecedent problem, resolved by a marker lexicon
("in each case" vs "solely with respect to"), refusing on silence or
contradiction.

**4. `limb-components.js`**. Real input: compiled candidates (model-emitted
`limb_path` arrays + byte-verified evidence spans) + a provision instance id.
Real output: frozen PATH/ASSERTION identity tree with content-derived ids,
attachment resolution, flow-down suspension. Question: "given limb paths the
model already declared, mint stable identities and decide qualifier
attachment." It **consumes** structure; it discovers none.

**5. `segmentSubClauses`** (`subclauses.js`). Real input: raw section text
(UTF-16 string). Real output: leaf spans partitioning the text with dotted
outline paths and explicit chapeau leaves. Question: "what is the outline
structure of this text?" No parties, no scope, no claims, no bytes.

### Concrete inputs on which they differ

- **1 vs 5:** a leaf limb with an internal semicolon — `findTerminationLimbChapeau`
  returns only the head up to the first `;`; `segmentSubClauses` returns the
  whole limb to the next marker. A duplicate paragraph-initial `(b)` —
  the limb finder fails closed (null, `matches.length !== 1`);
  `segmentSubClauses` resolves it by outline state (sibling/dedent). Concho
  8.1(f)'s terminal period-bounded leaf is handled by the limb finder's special
  case; `segmentSubClauses` needs no special case.
- **2 vs 5:** a section with two shall-not lists ("The Company shall not:
  (a)…(b)…; Parent shall not: (a)…") — `findIocChapeau` correctly returns the
  nearest preceding chapeau of the requested side; `segmentSubClauses`'s
  CHILD-OPEN colon rule **nests the second `(a)` under `(b)`** at the wrong
  depth (value 0 + colon-introduced fires; sibling needs value+1; dedent needs
  value+1 of an ancestor). Also a mid-limb "the Company shall not" chapeau at
  no outline position at all: mechanism 5 cannot see it; mechanism 2 exists
  for it. **`segmentSubClauses` is not a superset of `findIocChapeau`.**
- **3 vs all:** input is a quote string, not a span. TRAILING + "in each
  case, except as set forth…" → ALL_ITEMS. No other mechanism accepts this
  input shape or emits a scope reading. No overlap to converge.
- **4 vs 5:** three assertions under one bare `["(ii)"]` (F28 second live
  run) — mechanism 4 mints three ASSERTION nodes under one PATH node;
  mechanism 5 structurally cannot represent multiple assertions per leaf.
  And Red Hat 3.02's model response carries `limb_path: ["Corporate power and
  authority"]` — a **descriptive heading, not an outline marker** — a path
  mechanism 5 could never produce but mechanism 4 must carry.
- **5 vs all:** QXO §5.2(a)(ii)'s inline comma-separated (A)–(D) siblings —
  only `segmentSubClauses` recovers them.

### The service, exactly

`resolveGoverningStructure({ sectionText, startByte, endByte })` →
- `{ status: 'RESOLVED', leaf: { path, depth, startByte, endByte }, chain:
  [{ path|null, startByte, endByte, text }, …] }` — chain innermost-first,
  ending at the section chapeau (`path: null` leaf), every offset UTF-8 bytes.
- `{ status: 'UNDETERMINED', reason: 'SPAN_CROSSES_LEAVES' |
  'SPAN_OUTSIDE_TEXT' | 'AMBIGUOUS_OUTLINE' }` — never a guess. This satisfies
  the standing rule's third clause by construction.

Implementation: call `segmentSubClauses` on the string; build a byte-offset
map once per section via `utf8ByteLength` prefixes; convert at the boundary;
**`subclauses.js` untouched** (8 tests, four live V1 consumers —
`span-claims.js`, `span-residual.js`, `consideration-equity.js`,
`bring-down-tiers.js` — byte-identical fixtures required, per the plan).

Adapters:
- `findTerminationLimbChapeau` becomes an adapter (structure only). Must
  preserve: fail-closed on ambiguous letters; head bounding at first `:`/`;`
  (the service returns the leaf; the adapter trims to the head); the terminal
  period case; byte-identical spans on the Modiv/Concho/TopBuild pinned
  fixtures. `parseTerminationLimbDirection` and the capacity comparison stay
  exactly as they are — they are semantics, not structure.
- The 2X-I limb tree pre-pass consumes the service to corroborate/normalise
  model-emitted `limb_path` values (marker paths vs descriptive headings —
  see §3.1, this is now urgent).
- **Not adapters, with reasons:** `findIocChapeau` (lexical anchor, proximity
  selection, and a demonstrated input where the service is wrong and it is
  right); `qualifier-attachment.js` (no span input; different question;
  converging it would change what it is); `limb-components.js` (identity
  minting over model output; complementary consumer, not a rival).

---

## 2. Adjudication: the determinism rule

**Verdict: adopt the standing rule, but sharpened with a distinction the
evidence forces and neither position states: deterministic components divide
into those that DISCOVER content in raw text (generation-side) and those that
CLASSIFY content the model already surfaced (verification/classification-side).
Every cited failure is generation-side; every cited success is
classification-side or closed-convention.**

Walk the evidence: the two over-fits — the topology detector and
`findTerminationLimbGrantContext`'s original two Modiv grammars — both scan
raw text for open drafting patterns (step names, party-grant phrasings) and
both failed silently on unseen drafting. The successes —
`canonical-conditions.js`, `ioc-categories.js` (105→33), the IOC
second-chance, `bring-down-tiers.js` — classify or bound content that was
already surfaced, and fail closed. `segmentSubClauses` is generation-side yet
safe, because outline enumeration is a **closed formal convention**, not open
drafting. So the operational rule is three-tier:

1. **Closed formal conventions** (outline markers, punctuation bounds):
   deterministic generation is fine, with UNDETERMINED on no-match.
2. **Open drafting, stereotyped**: deterministic **classification of
   model-surfaced candidates**, never raw-text discovery, with a mandatory
   competition signal.
3. **Open drafting, novel**: the model.

This largely reconciles the two positions: the counter-position is right that
generation-side determinism on open drafting fails silently — and the two
over-fits prove it — but wrong to conclude the current architecture should
simply stand, because the 13–26% chapeau families and 3,031 open-world
candidates are a measured cost of leaving classification to the model.

The four questions:

1. **Where does stereotyped end?** There is a measurable test, and Ben already
   set it without naming it: **stereotyped = promoted** (recurred in 3–4 deals,
   confidence-checked, collision-free — the 2X-G gate). Novel = not yet
   promoted. Anything not in a vocabulary earned through promotion is novel by
   definition and goes to the model. This removes judgement from the boundary.
2. **Competition signal:** yes, mandatory, and cross-vocabulary. This is
   exactly what 2X-C enforces and what the IOC second-chance already does.
   Any 2X-B port that ships without it recreates the comment-asserted safety
   property 2X-C exists to kill.
3. **Does deterministic-first everywhere recreate Modiv at scale?** Only if
   "everywhere" includes raw-text discovery. Under the three-tier rule it does
   not: vocabularies classify what the model surfaced, so an over-fitted
   pattern's failure mode is a non-match → open world → **visible**. The
   silent failure mode (matching the wrong text) requires discovery-side use.
   Keep discovery model-side and the Modiv failure class is structurally
   excluded.
4. **Does the promotion loop drift?** The corpus-fitting risk is real but its
   failure mode is benign under fail-closed: an entry fitted to seven deals
   either matches deal eight (fine) or doesn't (open world, visible). The
   genuinely dangerous drift is **over-broad promoted patterns** matching
   wrong text — mitigated by the collision check plus one addition 2X-G
   should carry: record per-entry provenance (which deals earned it) and
   count per-entry corroboration hits per run, so a pattern that suddenly
   matches everything is measurable. Cheap, and turns "drift" from a fear
   into a metric.

---

## 3. Attack on Step 2X

### 3.1 The 2X-I load-bearing claim is FALSE for REPRESENTATIONS — and the plan's ordering is wrong because of it

The plan: "the REPRESENTATIONS producer emits zero limb-assertion candidates
at all… The raw material is absent from the run." Verified against
`evidence/canonical-v2/redhat-representations-20260808-r1`:

- The **compiled** receipt does show 80 candidates: 68 qualifier, 12
  open-world, 0 limb-assertion. That half is true.
- But the **recorded model responses** contain the limbs. Response 3.01: 29
  instances, **60 limbs** with `limb_path` + `assertion_quote`. Response
  3.02: 3 instances, **9 limbs**. The prompt
  (`representations-producer-prompt.js` line 37, `native-producer-
  representations/v1`) already requests the `limbs` array. Zero drops, zero
  rejections recorded — the limbs were never even attempted.
- The cause is the response shaper: `FAMILY_RESPONSE_SHAPERS.REPRESENTATIONS =
  shapeRepresentationQualifierProposals` (`anthropic-provider.js:3367`), which
  reads only `instance.qualifiers` and `open_world_candidates`. The full
  `shapeProposals` — which mints `LIMB_ASSERTION_CLAIM_KEY` from
  `instance.limbs` at line 749 — is registered **only for CAPITALISATION**.
  That is also why `limb_component_trees` is non-empty in exactly 1 of 202
  runs: one family routes to the minting shaper.
- Replay serves `raw_response_text` back through the full parse→shape→resolve
  pipeline (`provider-record-replay.js:333`). **A shaper fix is therefore
  validated by replay at zero model cost.**

Consequence: the largest single coverage lever in the plan — representations,
421 attempted, 22% — does **not** wait for the prompt bump. The limb work for
REPRESENTATIONS belongs in the free replay phase, alongside 2X-A, and its
acceptance ("non-empty limb tree on at least one deal") is achievable this
week on recorded Red Hat data. MAE is different: its recorded response
(redhat-mae-definition r1) contains no `limbs` array and its prompt does not
ask — MAE limb emission genuinely needs 2X-I. The disposition row
"`limb_component_trees` non-empty in 1 of 202 runs → 2X-I — producer emits no
limb candidates; resolver work cannot reach it" is wrong for the same reason.

One new problem this exposes, missing from the plan entirely: model-emitted
`limb_path` values are inconsistent — outline markers (`["(a)","(i)"]`) in
3.01, **descriptive headings** (`["Corporate power and authority"]`) in 3.02.
Once limbs mint, path hygiene decides identity stability. The 2X-A service is
the natural corroborator (model path vs segmented outline), but no step names
this, and it should be an explicit acceptance criterion of the shaper fix.

### 3.2 2X-C: the diff is nearly sufficient; strengthen it two ways

The deal-by-deal diff is the right instrument, but as specified it can be run
too narrowly. (1) Land the collision check in **report-only mode first**: the
check itself generates the collision list corpus-wide with no behaviour
change, so the diff reviewed is produced by the same code that will enforce —
no bespoke diff tooling, no gap between what was reviewed and what ships.
(2) Run it over **all importable runs by replay**, not just the ladder rungs —
collisions are corpus-dependent, and the Modiv-first ladder could pass while a
Concho collision waits silently. Replay is free; there is no cost argument
for sampling.

### 3.3 2X-K: the twice-climbed ladder mostly holds, with two gaps

Checked the one step that could have broken it: 2X-D is replay-safe —
`MAT_MAE_AGGREGATE` was already REMOVED from the producer prompt
(`capitalisation-producer-prompt.js:91`); the split now lives only in
resolver-side `qualifier-kind-lexicon.js:936`. 2X-A/B/C/E/J are resolver-side.
2X-G operates on recorded open-world candidates → replayable. Gaps: (a) the
phase list "2X-A through 2X-E, 2X-J" **omits 2X-F, 2X-G, 2X-H entirely** —
2X-F straddles both phases (detector-side replayable; "model-extracted steps
primary" needs `transaction_steps` from the bump, so 2X-F's seven-deal proof
cannot complete pre-bump and its acceptance should be split in the plan);
2X-H needs one live call by definition. (b) With §3.1, the phase assignment
of the REPRESENTATIONS limb work is not just unassigned but wrong.

### 3.4 Sweep disposition audit

One row wrong (the limb_component_trees row, §3.1). The rest checked out
where checkable: the three empty `lib/vocab` scaffolds marked DROP are
`ioc-other-exclusions` / `rw-general-lookback-scopes` /
`rw-sec-filings-portions-excluded` — **not** the 2X-B families, so no
conflict between the DROP and 2X-B's vocabulary curation. IOC 11 vs 25
verified: producer enum has exactly 11 (`ioc-producer-prompt.js:6-18`, v5),
V1 canonical list exactly 25. The taxonomy duplicate key verified at
`taxonomy.js:105` (EXCEPTION_CODES) and `:143` (MATERIALITY_CODES) — two
objects, same key, different glosses, exactly as 2X-D states.
`pages/deals/[id].js` orphan claim: no inbound links found; GRAVEYARD stands.

### 3.5 Missing entirely

1. **Limb-path hygiene** (§3.1) — the biggest genuine gap.
2. **ACTIONS vs EFFECTS** is dispositioned "to Fable" but has no plan step to
   land the answer in; it will be forgotten by the mechanism this repo's own
   CLAUDE.md warns about. It needs a named home (2X-F acceptance is the
   natural one).
3. 2X-G promotion provenance/hit-rate telemetry (§2 question 4) — one field
   and one counter, cheap, converts drift into a metric.
4. The 2X-I acceptance ("non-empty limb tree on one deal") has no
   non-regression criterion for the other three batched changes; the blind
   96-card re-score backstops this but is the last rung — a per-family
   resolved-count diff at the bump rung would attribute a regression to the
   bump rather than discovering it three rungs later.

---

## 4. Factually wrong statements found

1. **PLAN 2X-I: "the REPRESENTATIONS producer emits zero limb-assertion
   candidates at all… The raw material is absent from the run."** The recorded
   Red Hat responses contain 69 limbs; the shaper discards them; the fix is
   replayable at zero cost. (Evidence: §3.1.) The two sub-claims that survive:
   compiled candidates do show zero, and MAE genuinely lacks the raw material.
2. **Sweep disposition, structure table:** "producer emits no limb candidates;
   resolver work cannot reach it" — same error, same evidence.
3. Everything else checked — the resolution-rate denominator correction, the
   duplicate taxonomy key and line numbers, IOC 11/25, the qualifier-
   attachment and limb-components call-site descriptions, the prompt-side
   removal of MAT_MAE_AGGREGATE, the UTF-16/UTF-8 boundary description, the
   four V1 consumers of subclauses.js — is accurate as written.

No Ben ruling in DECISIONS entry 14 is factually contradicted by anything
found. The 2X-I finding does not overturn a ruling; it re-orders a step.

---

## 5. Ben's question: why not broaden segmentation to all 25 families? — REVISED: broaden

**Answered 2026-08-08, after the coordinator's survey (2 of 25 prompts declare
limbs; 22 families are flat assertion lists; the 13–26% families are flat lists
pointed at nested drafting).**

### 5.1 The actual reason

Broadening was **not considered**. My comparison answered the question as
posed — five mechanisms, converge or keep — and the service contract I wrote
(`resolveGoverningStructure(sectionText, span)`) is already family-agnostic,
but I named consumers only among the existing five mechanisms plus 2X-L. That
was scope inherited from the question, not a decision taken on evidence.
There is no rejection to defend.

### 5.2 Is placement the same operation as the limb families?

Same containment lookup, materially different consequence. The limb families
use model-declared trees to mint **claim identity** — new claim subjects,
content-derived ids, pinned forever. Placing an existing flat assertion into
a text-derived tree adds **inheritance context** to a claim that already has
its identity: additive, reversible, and unable to re-mint anything. The
difference argues FOR broadening — the flat-family version is the lower-stakes
half of the operation the limb families already do.

### 5.3 What actually breaks — failure modes, named

1. **Quote span crosses leaf boundaries** — whole-sentence quoting rules
   (termination-fee PROMPT_VERSION 2 explicitly) can produce spans covering a
   chapeau plus its first limb. Must return UNDETERMINED, never the deeper
   leaf. Affected: families quoting whole sentences or multi-limb passages.
2. **Assertion whose quote IS the chapeau** — termination grants, IOC
   chapeaus. Not a failure: containment correctly returns the chapeau leaf.
3. **Same-style restart mis-nest** — the colon CHILD-OPEN rule nests a second
   enumeration's `(a)`/`(1)` under the previous list's last frame. Verified
   real, not hypothetical: TopBuild 2.1's second election list `(1)/(2)`
   lands at `b.2.1`/`b.2.2` under the first list's `(2)`. This is the silent
   failure mode — a wrong parent, no refusal.
4. **MAX_DEPTH=3 truncation and unfired CHILD-OPEN** — conservative by
   design: coarser leaves, never a wrong parent (except via 3).

### 5.4 Reliability, measured — not assumed

Ran `segmentSubClauses` (read-only scratchpad script,
`segmenter-survey.js`) over **every resolved section of all 213 evidence
runs, all 7 deals**, canonical texts rebuilt via
`rebuildAdmittedSourcePrimitives` (Modiv from a post-08-07 run dir; the
pre-08-07 Modiv dirs correctly refuse with NO_RECORDED_RETRIEVAL_TIMESTAMP).

- **538 unique sections**; 171 (32%) have no markers at all — trivially safe,
  section-level context only. 367 have markers; 2,360 markers total; max
  depth 1/2/3 = 261/75/31 sections.
- **Mis-nest suspicion signature** (same-style parent-child link, computable
  from output paths alone): **45 markers in 6 sections — 1.1% of sections**:
  concho Annex-A (`c.a…`), modiv 8.12 (`g.a…`, `ll.a…`), modiv 8.3 (`b.a`),
  redhat 3.01 (`vii.M.A…J`), skywater 3.21 (`a.G.A…D`), topbuild 2.1
  (`b.2.1`, `b.2.2` — inspected, confirmed a real restart mis-nest).
- So: clean on ~99% of sections, and the residual 1% is **machine-flaggable
  from the segmenter's own output** — the service refuses any chain passing
  through a same-style link, converting the one silent failure mode into a
  visible UNDETERMINED at a measured cost of six sections corpus-wide. Those
  six become a pinned fixture list.

### 5.5 Revised 2X-A scope

**Broaden.** The architecture of §1 stands unchanged (the kept-separate
reasons for `findIocChapeau`, `qualifier-attachment.js`, `limb-components.js`
are untouched — note the two-shall-not-list drafting shape is exactly the
same-style restart signature, so the service now refuses where it would have
mis-nested). What changes is the consumer list: add a **corpus-wide placement
pass** — every family's assertions get a `structure_context` (governing
chapeau chain by containment lookup on their existing byte spans) at
resolution time. Fail-closed on: span crossing leaves; any chain through a
same-style parent-child link; markerless sections get section-chapeau context
only. **Context annotation only — the derived tree must never mint identity
for flat families**; identity minting stays with model-declared limbs
(2X-L/2X-I), which is what keeps this pass additive and unable to regress a
claim. Sits in the free replay phase immediately after 2X-L, which supplies
its first consumer (path-hygiene corroboration) and whose limb trees it
cross-checks.

---

## 6. The sixth mechanism, and the per-step re-walk (2026-08-08, later)

Code read: `deterministic-sectionizer.js` in full around `buildMarkerTree`
(:228–319), `classifyOpeningKind`/`expectedNext` (:114–205), `MARKER_PATTERN`
(:112); `subclauses.js` `MARKER_TOKEN_RE` (:246, read-only — under edit);
commit 501e2d26 and its replay evidence. The coordinator's table is mostly
right; two of its conclusions are wrong in ways that matter.

### 6.1 Does the sixth mechanism change the 2X-A decision?

**The architecture stands: converge two, keep three. The sectionizer is
neither the base nor a seventh kept-separate — it is the service's SECOND
INPUT, and it is also the section inventory the broadened placement pass now
requires.** Ben's "all sections, not only those with claims" needs an
enumeration of every section including ones no family touched;
`deterministic-sectionizer.js` on the live path (`native-extraction-run.js:173`)
already is that enumeration. Base stays `segmentSubClauses` for recall — the
QXO inline `(A)`–`(D)` fact that decided recall is untouched, `buildMarkerTree`
structurally cannot see inline markers.

**Where the coordinator's table is wrong, from the code:**

1. **"They fail in opposite directions" is false for parentage.** An
   unmatched candidate in `buildMarkerTree` "opens a brand-new child level
   directly under whatever sequence is currently deepest" (:212, :297–311).
   A second list restarting at `(a)` under an open `(b)` frame nests as a
   child — the SAME same-style restart mis-nest as `segmentSubClauses`, and
   the module's own history shows a worse variant (the ever-deepening
   letter-overflow chain, :164–177). **Agreement between the two detectors
   does not confirm tree shape.** Corroboration is a marker-EXISTENCE signal
   only; the same-style refusal stays mandatory regardless.
2. **"Line-anchored only → conventional list item" understates it.**
   `MARKER_TOKEN_RE` is `{1,3}` letters; `MARKER_PATTERN` allows 9. `(viii)`
   and doubled-letter overflow past three chars are sectionizer-ONLY finds —
   a recall gap, so line-anchored-only markers must be UNIONED into the
   marker set, not merely annotated. (Width may change with the in-flight
   `subclauses.js` work — recheck after it lands.)
3. Line-anchor immunity is conditional on line breaks being structural
   (HTML-derived cleanText). All seven deals are modern EDGAR HTML; a
   hard-wrapped plain-text filing voids it. Record the assumption.

**Per-marker corroboration tiers for the service:** CORROBORATED (both);
LINE_ANCHORED_ONLY (union in — width/inline gaps); PERMISSIVE_ONLY (the risky
set: genuine inline list or cross-reference — annotation allowed with tier
recorded; identity minting and absence assertions require corroboration).

### 6.2 Does corroboration solve the reference hazards? (coordinator Q3)

Smaller, and for the two observed shapes, effectively yes — but by two
different tests. The colon back-reference (`(A) and (B) above.`) is inline →
PERMISSIVE_ONLY → flagged; it also breaks `expectedNext` sequence. The
forward reference (`provided that (D)…; (D) do four.`) is the sharper case:
both detectors find "(D)", at DIFFERENT offsets — same expected label, one
inline start, one line-anchored start. That specific disagreement is
detectable and the line-anchored start wins. So: existence hazards largely
handled by mechanisms we own (corpus frequency already measured low);
parentage hazards NOT handled (6.1.1) — they remain the same-style rule's
job, and its blind spot (manufactured siblings) remains, now partially
covered by the start-offset-disagreement test. Not a solved problem; a
bounded one.

### 6.3 Per-step walk, 2X-0 through 2X-L (Ben's question)

- **2X-0 — unchanged in substance; blocker 2 grew.** 501e2d26 and 3bfcf15b
  are new UNREVIEWED/wip commits on the branch. 2X-D is confirmed NOT in the
  cursor range (no taxonomy/lexicon file in the diff), so blocker 1 stands.
- **2X-A — CHANGED** as §6.1: second input, corroboration tiers,
  sectionizer as section inventory, and the plan's own prose still says
  "converge two of the five / only two of the five" three times (PLAN
  :2101–2122) after the header was updated to six — a stale-count fix.
- **2X-A1 — unchanged.** Qualifier lexicon; the sectionizer has no bearing.
- **2X-B — unchanged.** Family vocabularies, no structural dependency.
- **2X-C — unchanged.**
- **2X-D — unchanged and still open.** The belief it had landed in the
  cursor branch was false; verified against the diff.
- **2X-E — unchanged** (done; the `NoShopCrossViewPreview` sibling item open).
- **2X-F — unchanged.** Topology consumes defined terms and
  `transaction_steps`, not sub-clause trees.
- **2X-G — unchanged.**
- **2X-H — unchanged.**
- **2X-I — changed at the margin.** Its open question (segment ahead of the
  model call so the model cites limbs by path) must inherit the rule from
  the identity note: derived structure may DESCRIBE what the model said,
  never SELECT what the model reads. Citing by path is admissible only if
  the model still receives full section text; otherwise the 1% becomes an
  invisible coverage hole. Otherwise unchanged.
- **2X-L — landed, UNREVIEWED, acceptance NOT yet shown met.** The commit
  message's own numbers do not reconcile: 69 limbs recorded, "2 trees, 7
  path nodes, 6 assertion nodes, zero residuals" claimed, while
  `resolution.json` carries 26 `limb_component_id`s and 65 `limb_path`
  occurrences. Zero residuals plus any shortfall = silent drop until the
  reconciliation table (69 → minted/dropped-with-reason) is published. That
  table is the step's stated acceptance; the diff review must demand it.
- **2X-J — unchanged.**
- **2X-K — unchanged as design** (2X-L was already placed in the free
  phase); its first free rung now has an artefact awaiting the gate above.

### 6.4 Tie-back to derived identity

Corroborated marker starts strengthen the start-anchored identity design in
`derived-structure-identity.md`: the mintable set, when the stability
criterion is eventually met, should be CORROBORATED starts only — two
independent detectors agreeing on `{canonical_text_id, start_byte}` is the
closest a derived limb gets to attestation.
