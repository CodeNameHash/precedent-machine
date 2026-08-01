# Claim identity, qualifier classification and provenance — implementation plan

Implements `docs/superpowers/specs/2026-08-01-claim-identity-provenance-design.md`.
Every task is test-first. No task registers a new claim definition, touches
the auto-pass block, or introduces a model call into the resolver.

## Scope and sequencing

Tasks 1–3 are the identity core and land together (the resolution-table rekey
in Task 3 depends on the classifier in Task 2 and mints subjects from Task 1).
Tasks 4–6 are independent of each other and follow. Task 7 (AI review
drafter) is deliberately last and separable — the pipeline is complete and
publishable without it.

## Task 1: limb component minting

Files:

- `lib/canonical-v2/native-producer/limb-components.js` (new)
- `lib/canonical-v2/native-producer/candidate-resolution.js` (integration)
- `tests/canonical-v2-limb-components.test.js` (new)

Work:

1. Mint one component row per distinct `limb_path` under a minted provision:
   content-derived `limb_component_id`, explicit `parent_limb_component_id`,
   `ordinal_under_parent`, verbatim `limb_path`, real `SEMANTIC_SPAN/V1` from
   the union of that limb's byte-verified evidence.
2. Parent resolution is mechanical: the parent of `["(ii)","(A)"]` is the
   component for `["(ii)"]`; mint missing ancestors from the paths present.
3. Allow claim subjects to be limb components: qualifier claims whose
   `attachment.governs_path` names a limb attach to that limb's component,
   not to the section provision.
4. Qualifier scope traversal helper: given a component, return the component
   set it governs (itself plus descendants via parent links).

Tests: deterministic IDs; parent links correct at every nesting depth in the
run-2 fixture; ancestor minting; span unions; a `governs_path` qualifier
attaching to the right component; byte-identical output on identical input.

## Task 2: qualifier-kind lexicon and classifier

Files:

- `lib/canonical-v2/native-producer/qualifier-kind-lexicon.js` (new)
- `tests/canonical-v2-qualifier-kind-lexicon.test.js` (new)

Work:

1. `QUALIFIER_KIND_LEXICON_VERSION = 1`, exported, pinned into the resolution
   receipt alongside `MAPPING_TABLE_VERSION`.
2. Marker tables for KNOWLEDGE / TEMPORAL / ACCURACY / THRESHOLD per the
   spec, including the closed symbolic-date list.
3. Classification order: zero-width normalise (comparison only) →
   exception-connective binding → deterministic split of free-standing
   multi-family quotes (each part re-verified byte-exact) → single-family
   fire + model-hint agreement → kind.
4. Asymmetric doubt routing: ACCURACY-boundary doubt returns a typed review
   outcome (`QUALIFIER_KIND_DISAGREEMENT` / `QUALIFIER_KIND_UNCLASSIFIED`);
   non-ACCURACY doubt returns an open-world outcome.
5. Exact-phrase → ACCURACY-code whitelist with stated precedence; zero or
   multiple matches → code null (and review when the kind is ACCURACY).
6. Pure functions only; no I/O.

Tests (each fails first): the run-1/run-2 disagreement clause classifies
THRESHOLD both times; "true and correct, except for inaccuracies that are not
material …" stays ONE ACCURACY unit (binding rule); "… in all material
respects as of the Closing Date" splits into ACCURACY + TEMPORAL with both
parts byte-verified; "as of the date hereof" fires TEMPORAL via the symbolic
list; "correct and complete list of Company Options" ITEM-attached never
resolves rep-level; U+200E inside a marker phrase still matches; whitelist
ambiguity yields null code; version pinned in receipt.

## Task 3: resolution-table rekey and the two mappings

Files:

- `lib/canonical-v2/native-producer/candidate-resolution.js`
- `lib/canonical-v2/native-producer/measurement-date-parse.js` (new)
- `tests/canonical-v2-candidate-resolution.test.js` (extend)
- `tests/canonical-v2-measurement-date-parse.test.js` (new)

Work:

1. Rekey `GENERIC_CLAIM_KEY_RESOLUTION_TABLE` on (generic_claim_key,
   deterministic kind, attachment position). Bump `MAPPING_TABLE_VERSION`.
2. `(QUALIFIER, ACCURACY, CHAPEAU)` → `REPRESENTATION_ACCURACY_STANDARD`
   (unchanged semantics, narrowed key). `(QUALIFIER, ACCURACY, ITEM)` →
   review queue.
3. `(QUALIFIER, TEMPORAL, *)` → `REPRESENTATION_MEASUREMENT_DATE` only when
   `measurement-date-parse.js` produces the ISO value (calendar parse, or
   symbolic date resolved from governed deal metadata). Claim minted
   unenriched + not-comparable. Unresolvable → open world.
4. `(QUALIFIER, KNOWLEDGE, *)` → `KNOWLEDGE_QUALIFIER`, canonical value
   `true`, knowledge standard preserved in `attributes`.
5. THRESHOLD and everything unmapped: open world, unchanged.
6. Subject assignment: ITEM-attached claims take the limb component subject
   (Task 1); CHAPEAU-attached take the provision subject.

Tests: replay of the run-2 fixture end-to-end asserting the new bucket
counts (limb components minted with correct tree; the two THRESHOLD
qualifiers in open world attached to limbs (ii)/(iv); nonzero
`publishableWriteSet` rows through the real validator); date parse table
tests; symbolic resolution needs the deal's agreement date or abstains.

## Task 4: ruling corpus

Files:

- `lib/canonical-v2/native-producer/ruling-corpus.js` (new)
- `tests/canonical-v2-ruling-corpus.test.js` (new)

Work:

1. `RULING_CORPUS/V1`: exact normalised phrase → ruled kind (+ code where
   applicable), ruler, timestamp, provenance tag. Content-addressed,
   versioned, pinned in the resolution receipt.
2. Only VERIFIED rulings apply. Exact match only; near-match goes to review.
3. Application order: corpus exact match runs BEFORE the lexicon (a ruled
   phrase is settled precedent); the applied answer is tagged MECHANICAL
   with a link to the originating VERIFIED ruling.

Tests: exact match applies; one-character difference does not; unverified
rulings never apply; receipt pins corpus version; corpus + lexicon
precedence.

## Task 5: provenance tags

Files:

- `lib/canonical-v2/native-producer/candidate-resolution.js`
- `lib/canonical-v2/native-producer/native-write-set-adapter.js`
- `lib/canonical-v2/validate-write-set.js` (accept + require the field)
- `tests/canonical-v2-provenance-tags.test.js` (new)

Work:

1. `answer_provenance` on every resolved claim and ruling:
   `{tag: MECHANICAL|AI|VERIFIED, pins: {...}}` per the spec's pinning rules.
2. Resolver outputs are MECHANICAL (pinning lexicon, table, corpus
   versions). Producer-originated raw values carried into open world are AI
   (pinning model, PROMPT_ID, PROMPT_VERSION).
3. Validator requires the field, rejects unknown tags, and never accepts an
   AI tag on an identity-bearing field (claim_definition_key resolution).
4. Supersession scaffolding: rule-version bumps mint superseding revisions
   linked to the superseded ones; VERIFIED survives version bumps.

Tests: tag required; identity-with-AI-tag rejected; pins round-trip through
adapter identity recomputation; supersession links.

## Task 6: PROMPT_VERSION 4 vocabulary cleanup

Files:

- `lib/canonical-v2/native-producer/capitalisation-producer-prompt.js`
- `tests/canonical-v2-capitalisation-producer-prompt.test.js` (extend)

Work:

1. Remove `MAT_MATERIAL_INLINE`, `MAT_MATERIALITY_SCRAPE`,
   `MAT_NO_QUALIFIER`, `MAT_MAE_AGGREGATE`; merge `MAT_DE_MINIMIS` into
   `MAT_ALL_RESPECTS_DE_MINIMIS`. Final five per the spec.
2. PROMPT_VERSION = 4; instructions note that aggregation language is
   reported as qualifier text, never as a code.
3. `lib/taxonomy.js` untouched.

Tests: exactly the five codes; version bump; removed codes absent from the
rendered prompt text.

## Task 7 (separable): AI review drafter

Files:

- `scripts/draft-kind-rulings.mjs` (new)
- `skills/` ruling-drafter skill file (new; location per repo convention)
- `tests/` for the queue-file round-trip (drafts never write to the corpus)

Work:

1. Reads the review queue, composes a self-contained prompt per quote (kind
   definitions, binding rule, current corpus), runs the cheap model per
   routing rules (`codex exec`), writes AI-tagged drafts with quote-anchored
   reasons into the answer field.
2. Drafts NEVER enter the ruling corpus. Only a human confirmation
   (VERIFIED) does.
3. No secrets in prompts; prompts are self-contained per CLAUDE.md Codex
   mechanics.

## Gates before merge

1. Every task test-first; each new rule's test fails for the right reason
   before the implementation.
2. `npm test` and `npm run build` green.
3. Replay of both recorded F28 fixtures with asserted new bucket counts and
   a nonzero publishable write set from the run-2 recording.
4. One fresh live extraction run under PROMPT_VERSION 4, documented in
   `docs/handoffs/` in the F28 run-doc format.
5. Fable adversarial audit of the full diff before Ben review. Never
   downgrade the auditor.
