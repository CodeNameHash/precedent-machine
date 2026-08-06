# Phantom citation re-derivation: f28-third-live-run

## What this is

`tests/fixtures/canonical-v2/f28-third-live-run/resolution.json` carried forty
entries whose `section_reference` was `III-INTRO(b)`, a phantom produced by
the sectionizer defect fixed in commit `63a1fe3a` (78-character title cap
swallowed TopBuild Sections 3.1 and 3.2 into the Article III chapeau, which
then minted lettered children of its own). That commit fixed the sectionizer
and the pilot manifest, and deliberately left this fixture's own forty
entries uncorrected, naming it the owner's call. This note re-derives them
and reports the result.

This is a re-derivation, not a re-extraction. No live model call was made.
The recorded model response (`qxo-topbuild-3-1-b-live-response.json`) was
replayed, byte-for-byte, through the current (corrected) sectionizer,
resolver and validator.

## Mechanism used

The fixture's own originating driver,
`scripts/canonical-v2-f28-third-live-extraction-run.mjs`, makes a live model
call (`claude -p`) and cannot replay a recorded response as-is. Rather than
modify that script or hand-edit JSON, the re-derivation reused the pipeline's
existing pieces directly, in the same order that driver uses them, with the
live call replaced by a stub:

1. `admitted_source_contexts[0]` from the existing, committed
   `adapter-result.json` supplied the full canonical text and `document_hash`
   (410,009 bytes). This is the same shortcut two existing tests already use
   (`tests/canonical-v2-m3-topbuild-ioc-sibling-citation-replay.test.js`,
   `tests/canonical-v2-component-rows.test.js`), and it is independently
   correct here: the raw TopBuild HTML is separately committed at
   `tests/fixtures/canonical-v2/mae-definition-family/topbuild-raw-fetched.htm`,
   and its sha256 (`146189ed57883d25aa571650fe5c40dff4bfce0e3ea75d67be463440417bda3f`)
   matches `document_hash` exactly. `canonical_text_sha256` was independently
   recomputed and matched too.
2. `lib/canonical-v2/native-producer/recorded-provider-response-replay.js`'s
   `reshapeRecordedProviderOutput` is the pipeline's own purpose-built
   mechanism for exactly this situation: replay a retained raw model response
   through whatever the current family adapter does today. It is already
   proven against this same family in
   `tests/canonical-v2-recorded-provider-response-replay.test.js`.
3. `runNativeExtraction({ section_references: ['3.1(b)'], provider: <replay
   stub using reshapeRecordedProviderOutput> })` was called with everything
   else identical to the original driver: `contract_bundle:
   compileFixtureContractV13()`, `definitions: { known_definitions: [] }`.
   `runNativeExtraction` re-sectionizes internally from `source_text` +
   `document_hash`, so the corrected sectionizer is exercised automatically;
   no separate sectionizer call was needed.
4. `resolveCandidates` (with `agreement_date: '2026-04-18'`, the same pinned
   value the original driver used), then `buildNativeWriteSet`, then
   `validateResolvedCanonicalWriteSet` -- the exact call sequence and
   parameters the original driver used, copied verbatim.

The recorded response file was never opened for writing. Its content was
verified byte-identical before and after every run (sha256
`457818eb742a6e2318493861978e0863c1c763856f461012ad425d78ac4520b3`).

The regeneration is deterministic: run twice independently, all four output
files were byte-identical both times.

## Files changed

Regenerated and overwritten in place:

- `tests/fixtures/canonical-v2/f28-third-live-run/run-receipt.json`
- `tests/fixtures/canonical-v2/f28-third-live-run/resolution.json`
- `tests/fixtures/canonical-v2/f28-third-live-run/adapter-result.json`
- `tests/fixtures/canonical-v2/f28-third-live-run/validation.json`

Deliberately left untouched, with reasons:

- `qxo-topbuild-3-1-b-live-response.json` -- the recorded model response.
  Evidence, never edited.
- `call-telemetry.json` -- a historical receipt of the actual live API call
  (real wall-clock time, real CLI-reported cost). Regenerating it would
  fabricate telemetry for a call that did not happen. Left as the true
  record of what the original run actually cost.
- `run-comparator-vs-run2.json`, `coverage-proxies.json`,
  `limb-enumeration-scan.json` -- these Task-8 instrument reports never
  carried the phantom reference in the first place (verified: zero
  occurrences of `III-INTRO` in the committed files). They are computed
  against a hardcoded `COMPARATOR_SECTION_REFERENCE = '3.1(b)'` in the
  original driver, independent of whatever the sectionizer resolved for the
  live extraction call, so the phantom bug never reached them. Regenerating
  them was tried as a check: `run-comparator-vs-run2.json` and
  `coverage-proxies.json` came back byte-identical to the committed files.
  `limb-enumeration-scan.json` did not -- it picked up an unrelated
  `limb-enumeration-scan.js` schema change since this fixture was recorded
  (a new `classification`/`AMBIGUOUS_MARKER_FAMILY` concept, disagreement
  count 4 -> 3), verified independent of the sectionizer choice (identical
  `governedSectionText` input either way) and independent of the phantom
  reference (0 occurrences in the committed file to begin with). Overwriting
  it would import that unrelated drift into this change under the phantom
  fix's name, so it was left alone. Named here for transparency, not acted
  on.
- `review-queue.json` was never part of this fixture directory's committed
  file set (the driver's writer for it postdates this recording) and was not
  added.

## What changed, grouped by kind (the field-by-field account)

To separate the sectionizer fix's own effect from unrelated pipeline
evolution since this fixture was recorded (2026-08-01), the fixed sectionizer
was compared against a controlled re-run using the PRE-FIX sectionizer
(`git show 63a1fe3a~1:lib/canonical-v2/native-producer/deterministic-sectionizer.js`,
requesting the old `III-INTRO(b)` reference, which still resolves under that
code) with every other module held at current code. That control run
reproduced identical bucket counts and identical `resolution_receipt` fields
to the fully-corrected run (38 compiled candidates, 3 resolved, 6
review-queue, 31 open-world, 1 residual -- all four figures differ from the
committed fixture's 37/3/4/33/0, and all four are unchanged whether the
sectionizer is old or new). This proves that gap is unrelated pipeline
evolution, not a consequence of the citation fix, discussed in its own
section below.

Diffing the pre-fix-sectionizer control run against the fully-corrected run
(both otherwise on current code) isolates the sectionizer fix's own effect
precisely. Every one of the 34 changed leaf-field generic paths across
`resolution.json`, `run-receipt.json`, `adapter-result.json` and
`validation.json` falls into one of two groups, and nothing fell outside
them:

**Group 1: section references and identity derived from them (expected to
move, and did).**

- `section_reference` everywhere it appears as the resolver's own
  governing-section label (`resolved[]`, `review_queue[]`, `open_world[]`,
  `residuals[]`, `compiled_candidates[]`, `resolved_sections[]`,
  `citation_context.parent_section_reference` /
  `.child_section_reference`): `III-INTRO(b)` -> `3.1(b)`.
- `source_citation` and `citation_validation.derived_citation`, which carry
  the per-proposal citation (section reference plus the proposal's own limb
  suffix, e.g. `III-INTRO(b)(i)` -> `3.1(b)(i)`).
- `citation_validation.status` and `.validation_source` genuinely upgraded:
  `CITATION_NOT_CONSTRUCTIBLE` / `CORROBORATED_BY_DOCUMENT_TEXT` ->
  `AGREEMENT` / `CONSTRUCTED_FROM_TREE`. Under the phantom label the
  sectionizer's own tree could not construct `3.1(b)` as a citation (the
  model's own `model_citation` was always `3.1(b)`, corroborated only by a
  weaker document-text-substring check); under the corrected tree it can, so
  the strong, tree-constructed status now applies. `triage.reasons` lost the
  `CITATION_CORROBORATED_ONLY` entry for the same reason -- this is a real,
  intended consequence of the fix, not a side effect to be suspicious of.
- Every content-addressed identity hash that is computed over an object
  containing the section reference or the section-tree-derived `section_id`:
  `closure_id`, `extraction_provenance.governed_scope_digest`,
  `.extraction_provenance_id`, `.producer_receipt_id`, `.prompt_digest`,
  `resolved_sections[].section_id`, `.parent_section_id`, `.prompt_digest`,
  `.producer_receipt.*`, and the top-level `run_receipt_id` (the whole
  receipt's own content hash, so it necessarily moves too).
  `resolution_receipt_id` moved from
  `16939d3bbf295686be514e51245429c7096fd99e1dca1b19f8037a10a6b41a79` to
  `81a307dad8257628eeaa2773083ef7f8d9df41f29fe8da3f33e0b746b8756cce`
  (matching the fresh baseline two dependent tests independently compute;
  see "Tests updated" below).

Notably, `claim_revision_id`, `claim_occurrence_id` and
`subject_occurrence_id` -- the claim's own identity -- did **not** move under
the sectionizer fix in isolation. Those are anchored to the claim's own
content (`attributes`, evidence spans, `claim_definition_key`), which never
included the phantom label: the model's own `attributes.section_reference`
was `3.1(b)` from the start (see next section). Only the wrapping
provenance/citation layer moved.

**Group 2: quoted text, byte offsets, content hashes (expected NOT to move
-- verified, did not).**

- Every `raw_value` (the model's literal quoted text) is byte-identical.
- Every `evidence[].absolute_start` / `.absolute_end` is byte-identical.
  Cross-checked three ways: direct field diff (zero changes reported), a
  reordering check on `validation.json`'s two `quarantines[]` entries (their
  array position swapped because they are sorted by a hash that moved, but
  the `(raw_value, start, end)` triple for each is identical before and
  after), and independent confirmation that
  `resolved_sections[0].{start,end,text_sha256}` for the corrected `3.1(b)`
  node are `57763`, `62446`,
  `ab4ce66d8e07577673bf4ea1f99838b21bd518786778e8511c71efab3df30487` -- the
  exact figures the manifest correction in `63a1fe3a` independently pinned
  for the same span.
- Every content hash of the underlying agreement bytes
  (`canonical_text_sha256`, `document_hash`, section `text_sha256`) is
  unchanged, as it must be: nothing about the admission chain or the
  document's own bytes was touched.
- `adapter-result.json`'s actual write-set claims -- the data that would
  reach the product -- changed in exactly one field across all three claims:
  `closure_id`. Nothing else on any claim moved: not `raw_value`, not
  `attributes`, not `evidence`, not `canonical_value`.

Nothing in Group 2 moved. Had it, this note would stop here and report it as
a finding rather than a relabelling; it did not become necessary.

**A third thing, named so it is not confused with either group: unrelated
pipeline evolution since 2026-08-01.** The committed fixture was last
computed under resolver `mapping_table_version` 3. Current code is at
version 20 -- seventeen unrelated slices landed on this resolver since this
recording was made (share-count parsing, qualifier-kind lexicon, measurement-
date parsing, termination fee/no-shop/MAE/proxy/antitrust families, and
more). This alone changes `compiled_candidates` from 37 to 38, moves one
resolved claim's identity (a different, now-better-disambiguated pick among
several near-duplicate "as of April 17, 2026"-style qualifiers for the
measurement-date claim), and shifts `review_queue`/`open_world` counts from
4/33 to 6/31. This is proven independent of the citation fix by the control
run described above (identical counts and `resolution_receipt` fields with
the pre-fix sectionizer). It is real, and it is why two "FIXTURE PIN" tests
and a components-per-claim test needed updating (below) -- but it is not
what this task was about, and the report separates it out so it is not
mistaken for a consequence of the citation relabelling.

## Run receipt, document hash and source pin verification

- `document_hash` (`146189ed57883d25aa571650fe5c40dff4bfce0e3ea75d67be463440417bda3f`)
  is unchanged and independently verified against the separately-committed
  raw HTML fixture's own sha256, as above.
- `canonical_text_sha256` is unchanged and independently recomputed from the
  admitted text.
- The section pin the manifest correction in `63a1fe3a` established
  (`3.1(b)`, start `57763`, end `62446`, `section_text_sha256`
  `ab4ce66d8e07577673bf4ea1f99838b21bd518786778e8511c71efab3df30487`) is
  reproduced exactly by this fixture's own regenerated tree lookup.
- `run_receipt_id` and `resolution_receipt_id` are NOT pins in the "must
  match something external" sense -- they are content hashes of this run's
  own output, expected to move when the output legitimately changes. They
  are reported under Group 1 above, not treated as a mismatch.
- Nothing recorded a document hash or source pin that failed to match. No
  hash was hand-edited to force agreement; every hash reported as "moved" is
  a hash this note independently recomputed via the pipeline's own code, not
  asserted from the old value.

## Tests updated

Six test files pinned values derived from the phantom fixture and needed
updating once it was regenerated. In every case the fix was a re-pin
(computed by running the current code against the regenerated fixture, never
guessed, never hand-typed) with reasoning added inline, in the same style
the manifest correction in `63a1fe3a` used. **These are re-pins to newly
correct values, not weakened checks: every assertion still asserts an exact
value; the values changed because the fixture they check now correctly
reflects the corrected sectionizer, and (separately, in the two FIXTURE PIN
tests and the components test) because current resolver code has moved on
since 2026-08-01 regardless of this fix.**

- `tests/canonical-v2-share-count-parse.test.js` -- five `closure_id`
  literals used only as lookup keys into `resolution.json`'s `open_world`
  bucket (`loadOpenWorldQuote`). `closure_id` moved (Group 1, above);
  `raw_value`, the actual thing each test checks, did not. Re-pinned by
  matching each old closure_id's `raw_value` to its new closure_id in the
  regenerated fixture.
- `tests/canonical-v2-p1-captable-numerics-resolution.test.js` -- the same
  pattern, two closure_id literals.
- `tests/canonical-v2-lexical-net-wiring.test.js` and
  `tests/canonical-v2-v1v2-comparator-wiring.test.js` -- each had a "FIXTURE
  PIN" test computing a fresh `resolveCandidates()` baseline from the
  fixture's own `run-receipt.json`/`adapter-result.json` and asserting it
  against two hardcoded `resolution_receipt_id` values: the fixture's own
  (stale) committed value, and a separate "fresh baseline" value that used
  to differ from it (documenting a known staleness gap under
  `mapping_table_version` 4). The regenerated fixture is no longer stale --
  a fresh baseline over its own `run-receipt.json` now reproduces the
  fixture's own `resolution_receipt_id` byte-for-byte
  (`81a307dad8257628eeaa2773083ef7f8d9df41f29fe8da3f33e0b746b8756cce`), so
  the `assert.notEqual` proving staleness was flipped to `assert.equal`, and
  both hardcoded hex constants were updated to the single new value, with a
  new dated entry appended to each file's existing historical re-pin
  comment chain (that chain was preserved, not deleted, matching the
  standing convention in both files).
- `tests/canonical-v2-component-rows.test.js` -- one test's main assertion
  (the CHAPEAU-attached claim is byte-identical with or without a resolution
  context) is untouched and still passes unmodified; that is the load-bearing
  claim. A secondary block in the same test, asserting specific
  publishable-claim and minted-component counts for the same recording,
  needed re-pinning: `components.length` moved 1 -> 2 and
  `publishableWriteSet.claims.length` moved 2 -> 3, because the resolver's
  now-different pick among near-duplicate temporal qualifiers (the same
  unrelated `mapping_table_version` drift noted above) changed which limb
  paths the two ITEM-attached claims attach to -- both now resolve to
  ASSERTION-node subjects, so neither is left as the PATH-node-subject
  example the test used to demonstrate "path nodes never mint." That
  invariant is independently covered by
  `tests/canonical-v2-native-write-set-adapter.test.js`'s synthetic test of
  the same name, cited in the updated comment. Verified independent of the
  sectionizer choice (identical component count under the pre-fix
  sectionizer control run) before re-pinning.

## Other committed fixtures or evidence carrying the same defect

Searched `III-INTRO` across all of `tests/fixtures/` and `evidence/`.

**Not the same defect (checked and ruled out):**
`tests/fixtures/canonical-v2/modiv-first-live-run/section-location-scan.json`,
`tests/fixtures/canonical-v2/v1v2-comparator/modiv-v1-provision-snapshot.json`
and `tests/fixtures/canonical-v2/v1v2-comparator/skechers-v1-provision-snapshot.json`
all reference a bare `III-INTRO` with no lettered child. For Modiv this is a
real, correctly-bounded `SECTION` node (`"General Introduction"`, 51737-
52925, immediately followed by a correctly-recognised `3.1` at 52925) --
confirmed directly from the sectionizer's own node listing in that file.
Both V1 snapshot cards label a genuine "Reps Preamble" card `III-INTRO`,
consistent with that. Ruled out.

**Same defect, in scope by the task's own definition, NOT fixed here:**
`tests/fixtures/canonical-v2/skechers-first-live-run/resolution.json` and
`run-receipt.json` carry `III-INTRO(d)` in 38 `citation_validation.
derived_citation` fields (1 resolved claim, 1 review-queue item, 36
open-world entries; `adapter-result.json`, `validation.json` and
`review-queue.json` are clean, 0 occurrences, matching the TopBuild pattern).
Confirmed same defect class and same fix path, more narrowly than TopBuild:

- The diagnostic file already committed alongside it,
  `tests/fixtures/canonical-v2/skechers-first-live-run/section-location-scan.json`,
  independently documents the identical mechanism: a phantom `III-INTRO(d)`
  node spanning `[118472, 181651)` -- the rest of Article III -- because
  "Section 3.7 Company Capitalization" was never recognised as a heading,
  with its own note concluding "STOP... no sectionizer tree node aligns with
  the real decimal-numbered '3.7 Company Capitalization.' section."
  This file predates the present investigation and independently corroborates it.
- Unlike TopBuild, Skechers' governing `section_reference` was already
  correctly `3.7` throughout (`requested_section_references: ['3.7']`,
  `resolved_sections[0].section_reference: '3.7'`, start `122698`, end
  `127852`) -- the phantom only ever reached the PER-PROPOSAL citation
  derivation step, not the top-level governed scope. This matches the
  already-fixed "Skechers-first-live-run defect" documented in
  `lib/canonical-v2/native-producer/native-extraction-run.js`'s own header
  comment (per-proposal derivation shifted from the section's outer span to
  each proposal's own evidence span).
- Confirmed against the current, already-corrected sectionizer directly:
  `findSectionByReference(tree, '3.7')` resolves to `{start: 122698, end:
  127852, kind: 'SECTION'}` (matching the committed run-receipt exactly);
  `findSectionByReference(tree, 'III-INTRO(d)')` returns `null`. The phantom
  is already gone from the tree; only the committed fixture is stale.
- Confirmed the model's own citation was always organic and independent, not
  prompt-locked: the recorded response
  (`native-producer-recorded-response.json`) shows the model's own
  `section_reference` values are `3.7(a)`, `3.7(b)`, `3.7(c)`, `3.7(d)` --
  never `III-INTRO(d)` anywhere in the raw response. Same evidentiary
  footing as TopBuild's `3.1(b)`.

This is a smaller, cleaner instance of the identical bug, independently
diagnosed, independently verified fixable by the identical replay mechanism,
with no top-level relabelling even required (only the per-proposal
`derived_citation`/`source_citation` fields would move). It was not
re-derived in this pass: fixing it properly means finding and updating
Skechers' own dependent tests (by the pattern seen here, at least one
`closure_id`-keyed lookup test should be expected), which is a distinct,
bounded piece of work deserving its own review rather than being folded
silently into this change. Recommended as a direct, low-risk follow-up using
exactly this note's method.

**Same defect, deeper and out of scope -- needs a fresh model call, named and
stopped:** `evidence/canonical-v2/m3-pilot-20260804-fresh/checkpoints/
ca57663078c5861f3412230919655fb3d4d264b0fddecce418bd6d6a6e94bd86.json` and
`evidence/canonical-v2/m3-pilot-20260804-fresh/final-output/
execution-result.json` (325 occurrences) are a full pilot execution snapshot,
dated 2026-08-04, predating the manifest fix in `63a1fe3a` (2026-08-05).
Their `section_id` for the TopBuild capitalisation item matches the OLD,
pre-fix manifest value exactly
(`77955b9a124841078a565df44e2fd4bc7d6d43c20afdc21be6d3347c8250c4d7`).
Unlike the F28 and Skechers recordings, this is not safely re-derivable by
simple replay: the checkpoint's own recorded prompt explicitly instructs the
model, in writing, "SECTION REFERENCE: III-INTRO(b) ... Every emitted
section_reference must equal 'III-INTRO(b)' exactly" -- the phantom is baked
into what was actually sent to and returned by the model, not merely into
the sectionizer's derived label. There is no organic, independent model
citation to corroborate against here the way there was for F28 and Skechers,
so replaying this recording through the corrected sectionizer would produce
an internally inconsistent result (a governing section labelled `3.1(b)`
whose own claims still assert `III-INTRO(b)`) rather than a clean relabelling.
Confirmed this evidence bundle is not part of the currently-verified test
path: `resolveDurableArtifactRoot()` (which gates the one test that reads a
"sealed final pilot review packet") returns `null` without the
`CANONICAL_V2_M3_PILOT_ARTIFACT_ROOT` environment variable set, and no
`final-review-v6/` packet exists under this directory regardless, so the full
suite run (below) never touched it. Named here per the task's explicit
instruction and left alone; fixing it needs a fresh model call under the
corrected section identity, which is out of scope for this task.

## Verification

```
CI=true npm test > /tmp/phantom.log 2>&1; echo "EXIT=$?"
```

`EXIT=0`. `ℹ tests 7675`, `ℹ pass 7633`, `ℹ fail 0`, `ℹ skipped 42`,
`ℹ cancelled 0` -- exactly the stated baseline test count, zero failures.
`npm run build` also completed cleanly (exit 0) as an additional check.

Eleven test files were identified as depending on this fixture directory and
run individually before the full-suite run: all pass, including the five
files with re-pinned values above and six others
(`tests/canonical-v2-comparator-wiring-replay.test.js`,
`tests/canonical-v2-m3-live-checkpoint-replay.test.js`,
`tests/canonical-v2-native-sectionizer.test.js`,
`tests/canonical-v2-m3-12-call-pilot-manifest.test.js`,
`tests/canonical-v2-m3-topbuild-ioc-sibling-citation-replay.test.js`,
`tests/canonical-v2-f28-third-live-family-classifier-driver.test.js`) that
needed no changes at all.
