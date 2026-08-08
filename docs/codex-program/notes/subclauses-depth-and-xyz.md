# subclauses.js — MAX_DEPTH raise and (x)/(y)/(z) corroborated CHILD-OPEN

Working notes for the two changes to `lib/parser-v2/subclauses.js` requested
2026-08-08. Written incrementally; this is a skeleton, filled in as each
step completes.

## Status

- [ ] Harness rebuilt, baseline reproduced (Change 3, part 1)
- [ ] Change 1 — raise MAX_DEPTH
- [ ] Change 2 — (x)/(y)/(z) corroborated CHILD-OPEN
- [ ] Re-measure after each change separately and both together
- [ ] New tests written
- [ ] Guard proof for each change
- [ ] Full verification (existing tests, V1 consumers, npm test, npm run build)

## 1. Harness

Original scratchpad script (`segmenter-survey.js`) referenced in
`docs/codex-program/notes/fable-review-step-2x.md` §5.4 no longer exists on
disk (ephemeral scratchpad from an earlier session). Rebuilt independently at
`/tmp/.../scratchpad/measure.js` (this session's scratchpad — not committed).

Method: for every `evidence/canonical-v2/*` run directory with a usable
`source-reference.json` (deal known, `admitted_source_capture_inputs
.retrieved_at` recorded — i.e. made on/after 2026-08-07) and a
`section-location-scan.json`, rebuild the deal's canonical text ONCE per deal
via `rebuildAdmittedSourcePrimitives` (verified: exactly one
`raw_bytes_sha256` / `canonical_text_sha256` per deal across all its run
directories, so any one run directory's rebuild gives the deal's whole
canonical text). Read each run's `section-location-scan.json` top-level
`resolved` entries (the requested section's own node, byte offsets into the
canonical text), slice with `utf8Slice` (byte offsets, per CLAUDE.md's
byte-slicing rule — NOT string `.slice`), dedupe to unique
`(deal, section_reference, start, end)`, and run `segmentSubClauses` /
`findStructuralMarkers` over each unique section.

Mis-nest signature: a marker whose path is `<parent>.<label>` where the
STYLE of the parent frame's own label equals the style of `<label>` itself
(same-style parent-child link).

Directory-count note: 225 run directories carry `source-reference.json`; 27
of those have no recorded `retrieved_at` (pre-2026-08-07, correctly refused,
consistent with the fable note's "Modiv...pre-08-07...correctly refuse");
198 remain. The fable note recorded 213 runs / 538 sections. This session's
independent rebuild found a different run count (see §2) — reported as-is,
not tuned to match.

## 2. Baseline measurement (unmodified subclauses.js)

(filled in below)

## 3. Change 1 — MAX_DEPTH

(filled in below)

## 4. Change 2 — (x)/(y)/(z)

(filled in below)

## 5. Re-measurement after each change

(filled in below)

## 6. New tests

(filled in below)

## 7. Guard proof

(filled in below)

## 8. Final verification

(filled in below)
