# F28 — third live end-to-end native extraction run (PROMPT_VERSION 4)

Companion to `F28-FIRST-LIVE-RUN.md` (v1) and `F28-SECOND-LIVE-RUN.md` (v2).
Same filing, same governed section (QXO/TopBuild Section 3.1(b) capital
structure), pinned source hash re-verified byte-exact
(`146189ed…bda3f`). Live Claude Sonnet call via the `claude -p` seam,
CLI-reported cost $0.8671, wall clock ~5m53s. Raw artifacts:
`tests/fixtures/canonical-v2/f28-third-live-run/` (recorded response,
run receipt, resolution, adapter result, validation, and all three
instrument reports). Driver:
`scripts/canonical-v2-f28-third-live-extraction-run.mjs`.

## Headline

**The native pipeline published its first claim.** One
`REPRESENTATION_MEASUREMENT_DATE`, canonical value `2026-04-17`, parsed by
code from the quoted text (never by the model), `answer_provenance:
MECHANICAL`, `publication_state: VALIDATED`, through the real
`validateResolvedCanonicalWriteSet`. Run 1 published 0 of 33 compiled;
run 2 published 0 of 0 compiled; run 3 publishes 1 of 37 compiled, with
everything else visible in typed buckets. Three runs, three different
bottlenecks, each one fixed by the next slice — this is the first run
where the bottleneck is now genuinely "which claim definitions exist",
which is the governed, evidence-driven loop the architecture wants.

## Stage counts

- 37/37 proposals compile: 0 evidence residuals, 0 scope violations, 0
  citation residuals (citation corroboration working; no repeat of run 2's
  total blockage).
- Resolution: 3 resolved (all TEMPORAL → measurement date), 4 review-queue,
  33 open world (21 limb assertions + 12 qualifiers), 0 residuals.
- All 3 resolved claims carry `CITATION_CORROBORATED_ONLY` — the new
  publishing-safety rule fired live for the first time and correctly blocks
  auto-pass while letting the claims publish with the fact visible.
- Adapter: 3 claims written, 0 residuals. Validator: accepted, 2
  quarantines (typed, visible), 1 publishable.

## Quality assessment (Fable read of the recorded response)

**What PROMPT_VERSION 4 fixed:** qualifier decomposition is back. Run 2
collapsed ~12 qualifiers into limb prose and emitted 2; run 3 emits **16
discrete qualifier objects**, and the cross-run comparator shows run 3
strictly recovers run 2's two plus 14 more (0 only-in-run-2). Limb
structure is byte-stable across runs: 21/21 limbs matched, zero
disagreement in either direction — two independent live runs now agree
exactly on the representation's skeleton, which is strong evidence the
limb model is extracting structure, not noise.

**What is honestly imperfect:**
- All 16 qualifiers arrived representation-level; 0 limb-level. Run 2
  attached 2 at limb level. The v4 prompt's decomposition push seems to
  have traded attachment precision for recall. The ASSERTION_SCOPE and
  attachment machinery is live and routes these correctly, but limb-level
  attachment needs prompt attention in the next producer iteration.
- Coverage proxies are clean (0.832 span coverage, qualifier/marker ratio
  1.78, no signals) — but "clean" is calibrated against a threshold of
  0.5; treat as a smoke alarm that did not fire, not a recall proof.
- Enumeration scan: 4 `MARKER_WITHOUT_LIMB` disagreements, all explained
  (chapeau labels and cross-reference tokens) — expected corroboration
  noise, consistent with the scan's conservative design.
- The resolution-stage artifacts were computed while the final audit
  fixes (C1 split merge, M5 auto-pass wiring) were landing; the recorded
  raw response is authoritative and deterministic replays through the
  final committed code are the canonical view. The published claim and
  bucket shape are not affected by either fix on this recording (its
  TEMPORAL quotes are single-family; nothing split).

## Known-limitations register (final pre-Ben audit, 2026-08-01)

Verdict was "ship amended"; the two mandatory fixes (C1 split defect —
fixed in `8fa783c`; M5 auto-pass wiring — fixed in `ef53a57`) are on the
branch. The remaining items are OPEN, logged here so nothing reads as
finished that is not:

1. **Limb-level (ITEM-attached) resolved claims cannot publish yet** (M1).
   Assertion-node subjects have no `PROVISION_COMPONENT` rows in the write
   set — the adapter ships `components: []` — so an ITEM-attached
   KNOWLEDGE/TEMPORAL claim resolves and queues but would land as a typed
   `SEMANTIC_REFERENCE_UNRESOLVED` residual at validation, never silently.
   Component-row minting is canonical-identity design (it must line up
   with the BRINGS_DOWN limb-target contracts) and is the natural next
   slice. Rep-level (CHAPEAU) claims publish fine — run 3's published
   claim is one.
2. **Bring-down tier claims carry a MECHANICAL tag on a model-chosen
   code** (M2). The value is gated by allowed-values membership, but the
   honest tag semantics need a design call (Ben) before auto-pass ever
   opens for that family.
3. **No committed writer for the `RESOLUTION_REVIEW_QUEUE/V1` artifact**
   (M4): three scripts read it; the run driver writes `resolution.json`
   but not the content-addressed queue artifact. Small follow-up.
4. **KNOWLEDGE+TEMPORAL composite dates**: the date is split to open world
   rather than preserved in the knowledge claim's attributes (M6a), and a
   corpus-applied TEMPORAL ruling bypasses the measurement-date
   reachability rule (M6b) — both logged for the next resolver pass.
5. **Coverage proxies / enumeration scan are not yet written into the run
   receipt by `native-extraction-run.js`** (M7) — they run in the driver.
   Wiring them into the receipt is mechanical.
6. **Pending Ben sign-off**: the two implementer-guessed whitelist phrases
   (`MAT_MATERIAL_TO_COMPANY`, `MAT_MAE_QUALIFIED` — flagged in
   `qualifier-kind-lexicon.js`), and the permanent abstention of "the
   Closing Date"/"the Effective Time" in `measurement-date-parse.js`.
7. **Gate-3 note**: the run-2 replay proves zero publishable from that
   recording (both its qualifiers are genuinely THRESHOLD — the lexicon
   confirms run 2's own coding); the nonzero-publishable proof for the
   slice is the synthetic-fixture validator tests plus THIS run's real
   published claim. The replay's counts are labeled an under-extraction
   baseline in the test file, per the spec's requirement.
