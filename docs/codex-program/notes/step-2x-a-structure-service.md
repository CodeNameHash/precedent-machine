# Step 2X-A — structure service + placement (implementation note)

Date: 2026-08-08. Branch: `cursor/step-2x-free-phase-b641`. Replay-only.

## Landed

1. **Comparison note** — `docs/codex-program/notes/step-2x-a-mechanism-comparison.md`
   names, per mechanism, at least one differing input (or that it does not
   differ). Converge two of six; keep three separate; sectionizer is second
   input.

2. **Service** — `lib/canonical-v2/native-producer/governing-structure.js`
   - `resolveGoverningStructure({ sectionText, startByte, endByte })` →
     RESOLVED leaf+chain (UTF-8 bytes) or typed UNDETERMINED.
   - Fail closed: `SPAN_OUTSIDE_TEXT`, `SPAN_CROSSES_LEAVES`, `SAME_STYLE_CHAIN`.
   - Markerless → RESOLVED section-only (honest floor).
   - Corroboration tiers: CORROBORATED / LINE_ANCHORED_ONLY / PERMISSIVE_ONLY
     via `findStructuralMarkers` × `findMarkerCandidates`.
   - `segmenter_version` stamped on every outcome (`SEGMENT_SUBCLAUSES/V1+MAX_DEPTH_5+XYZ`).
   - Byte conversion at boundary; `subclauses.js` not ported to bytes.
   - `resolveTerminationLimbChapeauViaStructure` — structural adapter
     (ambiguous-letter refusal + head-bound at `:`/`;`); semantic grammar
     stays in `candidate-resolution.js`.

3. **Placement** — `lib/canonical-v2/native-producer/structure-placement.js`
   - Annotates resolved / review_queue / open_world with `structure_context`
     or typed UNDETERMINED (zero silently absent).
   - Wired at the end of `resolveCandidates` so replay exercises it.
   - Annotation only: does not rewrite `claim_revision_id` / claim payloads;
     `annotation_only: true` on every context.
   - `annotateSectionInventory` for all-sections join (no limb identity).

4. **Segmenter support** — `findStructuralMarkers` now returns `style` per
   marker; exports `SEGMENTER_VERSION`. Sectionizer exports
   `findMarkerCandidates` / `buildMarkerTree` for corroboration.

5. **Fixtures** — six mis-nest sections pinned under
   `tests/fixtures/canonical-v2/step-2x-a-misnest-sections/`
   (concho Annex-A, modiv 8.12, modiv 8.3, redhat 3.01, skywater 3.21,
   topbuild 2.1).

6. **Tests** — `tests/canonical-v2-governing-structure.test.js`.

## Live swap (structural half) — landed

`findTerminationLimbChapeau` now delegates its structural half to
`resolveTerminationLimbChapeauViaStructure` (DECISIONS.md §15). Gate was
byte-identical Modiv 7.1 / Concho 8.1 / TopBuild 6.2–6.4 chapeau spans:
**19 compared, 19 identical, 0 mismatch** (pre-swap vs adapter). Pinned
fixtures cover 14 limbs (Modiv a–d, Concho a–f, TopBuild 6.2 a–d) under
`tests/fixtures/canonical-v2/termination-rights-family/termination-limb-chapeau-structural-parity.json`.
Direction grammar and capacity comparison remain in
`candidate-resolution.js`. UNDETERMINED/null from the service maps to null
(fail closed), never a guessed chapeau.

## Deferred (explicit)

- **2X-I limb pre-pass** consuming the service (path hygiene) — not this
  slice; no live re-extraction / Modiv ladder / prompt bump (2X-K / 2X-I).
- **Derived limb identity** — annotation only; identity model still open
  per `derived-structure-identity.md` (`{canonical_text_id, marker_start_byte}`
  when stability criterion met). Component nesting schema question for Ben
  remains open if/when identity lands (do not bend `PROVISION_COMPONENT/V1`).
- **Human spot-audit** of ~30 unflagged sections (plan acceptance for
  turning signature-cleanliness into a correctness figure) — not done here.
