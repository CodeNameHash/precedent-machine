# ext/m7-w5-renderer

id: status-w5
from: ext
to: lead
date: 2026-09-03
re: ext/m7-w5-renderer
status: PLANNED

## State

Branch `ext/m7-w5-renderer` created from pinned base `b11388ab7c9605b1df872b1c6cd2e927d1a2dbab`. Lowest priority. No renderer work until the Work 7 verifier has a draft PR.

## What this branch will deliver

A deterministic static renderer (HTML or Markdown) for Ben's 50-item replay packet. Inputs: the fixed-sample identity manifest, the Q&A note, and the candidate's projections. Output only under

`evidence/canonical-v2/stage-2y-structure-migration/m7-v2-repair/work5/`

Rendering only. Binding the packet to the registration and the Work 5 transition stay with Lead.

Required surfaces, from the repair plan:

- all 50 items: old card, enum and verbatim note beside the new V2 result
- item 4 with its operative chapeau
- item 39 with sealed parent `7.01(d)` and both materialised candidate trees
- complete reviewed source closure for every source-limited decision
- three standing questions per item

Verified input on the pinned base: `evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-fixed-sample-identity-manifest.json` (79758 bytes, SHA-256 `dc6024da8b7b3e8e31fbd99406693b676c2785c6b3fdf2bfe41552336f128c37`, 50 members).

## Sub-agent split

- Lead writes the card schema and the exact input list before any HTML.
- One worker implements the renderer against that schema.
- Fresh-session adversarial review before the delivery `Q`.

## Candidate-bound paths

Read-only. Delivery will include the empty `git diff --stat b11388ab -- <53 paths>` proof.
