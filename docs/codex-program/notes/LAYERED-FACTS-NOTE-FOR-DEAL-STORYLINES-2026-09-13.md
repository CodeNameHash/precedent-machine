# How the full layer tree and the extraction work (note for Deal Storylines, 2026-09-13)

Written at Ben's request ("write a note to deal storylines on how our full layer tree / extraction works, I want to see if it is useful to include over there"). Published copy: https://claude.ai/code/artifact/f91bd3c2-fc2f-4020-904b-0cdc5eb728d2

## 1. The unit

A fact is a headline plus an ordered tree of components, each a contiguous verbatim substring of the agreement anchored by UTF-8 byte offsets into the canonical text (`contracts/product/fact-components.v2.json`). Components carry a kind from a closed list, a controlled label, the text and span, and an origin (OWN, or CHAPEAU / INTRO / DEFINITION for inherited words, marked and gapped with `[...]`). Rules: verbatim or the fact is held INVALID; numbers parsed by code, never the model; nothing forced (no "none", no "not applicable"); LIST with one LIST_ELEMENT per element that could differ between deals; LITANY for synonym runs; CROSS_REFERENCE resolves to the section and its fact.

## 2. How a fact is produced

Intake (SEC exhibit to canonical text and structure) → route (25 families per section, plus a residual pass per paragraph) → extract (one call per section: headline, component tree with exact quotes, coded readout) → check (bytes resolve, kinds legal, values parsed, hold on failure; a declined response fails the attempt and retries) → review (component-level accept / reject / edit, rebuilt with fresh offsets) → publish (tables of coded pills, every pill opens its words). Every model call is recorded with request, response, tokens and cost.

## 3. The readout layer

Above the words sits the conclusions layer (`contracts/product/fact-conclusions.v1.json`): table key, row label, cells citing component ids, driven by the table shapes contract (`contracts/product/table-shapes.v3.json`). Checks: code in vocabulary, value equals a cited component's parsed value, text a run of cited words, citations the fact's own, basis complete for multi-component codes. A failed readout is dropped with a note; the fact stays valid; a fact without a readout is never a row. Some cells are derived in code (bring-down from the conditions fact via resolved cross-reference; carve-back default No; absent fixed row None).

## 4. Discipline

Contracts and generators, never hand edits (determinism test); extractor guidance travels with the table shape; identity is content including the readout; held, not dropped.

## 5. Possibly useful to Deal Storylines

The evidence primitive under a claim; headlines built for cross-deal contrast; coded readouts as the cross-deal join; derived cells linking provisions across articles; the failure discipline.

## 6. Where it stands

NCS complete on the layered model (104 sections, 850 valid facts); Metsera generation 3 running on V9 with readouts; extraction discipline still being tuned from rendered pages; the model sometimes declines a long section, now caught and retried.
