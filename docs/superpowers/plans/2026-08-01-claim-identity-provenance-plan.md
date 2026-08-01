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

Work (two-node model per the amended spec — audit A1, blocking):

1. Mint PATH nodes per distinct `limb_path`: content-derived id from
   (provision_instance_id, limb_path), explicit `parent_limb_component_id`,
   `ordinal_under_parent`, verbatim path, span null unless supplied by
   assertions. Mint missing ancestors mechanically.
2. Mint ASSERTION nodes per compiled assertion proposal: id from (path node
   id, document-order assertion ordinal), parent = path node, span = exactly
   that assertion's own byte-verified evidence. Assertion nodes are the
   claim subjects. No union spans anywhere.
3. Qualifier subject assignment: `governs_path` → path node; exactly one
   assertion child → attach to it; multiple children → attach to the path
   node with typed `ASSERTION_SCOPE_AMBIGUOUS`, auto-pass blocked, review.
4. Scope traversal helper over the two-node tree.

Tests: deterministic IDs; the run-2 fixture's repeated paths (`["(i)"]`,
`["(ii)"]`, `["(iii)"]`, `["(iv)"]` each carry 3 assertions) produce 3
assertion nodes each, distinct spans, no envelope spans; the securities-law
carve-out on `["(ii)"]` routes `ASSERTION_SCOPE_AMBIGUOUS`; ancestor minting;
byte-identical output on identical input.

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
   exception-connective binding per the spec's written algorithm
   (depth-tracked tokenisation; clause-close rules; "provided that" /
   "subject to" excluded from auto-binding; hostless bound clause → doubt
   rule) → deterministic split per the spec's partition/residue/inheritance
   rules (each part re-verified byte-exact; failed part voids the split) →
   single-family fire + model-hint agreement → kind. A TEMPORAL part split
   from a THRESHOLD host never reaches the measurement-date mapping.
4. Asymmetric doubt routing: ACCURACY-boundary doubt returns a typed review
   outcome (`QUALIFIER_KIND_DISAGREEMENT` / `QUALIFIER_KIND_UNCLASSIFIED`);
   non-ACCURACY doubt returns an open-world outcome.
5. Exact-phrase → ACCURACY-code whitelist with stated precedence; zero or
   multiple matches → code null (and review when the kind is ACCURACY).
6. Pure functions only; no I/O.

Tests (each fails first): the run-1/run-2 disagreement clause classifies
THRESHOLD both times; "true and correct, except for inaccuracies that are not
material …" stays ONE ACCURACY unit (binding rule); "true and correct,
except as provided in Section X, in all material respects" — bound clause
closes at the second comma, trailing ACCURACY classifies; the fixture's
nested "(other than …)" inside "except for …" binds innermost-first;
"provided that" with markers both sides routes by the doubt rule; "… in all
material respects as of the Closing Date" splits into ACCURACY + TEMPORAL
with both parts byte-verified and inherited attachment; "material to the
Company as of the date hereof" — the TEMPORAL part does NOT reach the
measurement-date mapping; "as of the date hereof" fires TEMPORAL via the
symbolic list; "correct and complete list of Company Options" ITEM-attached
never resolves rep-level; U+200E inside a marker phrase still matches;
whitelist ambiguity yields null code; version pinned in receipt.

## Task 3: resolution-table rekey and the two mappings

Files:

- `lib/canonical-v2/native-producer/candidate-resolution.js`
- `lib/canonical-v2/native-producer/measurement-date-parse.js` (new)
- `lib/canonical-v2/native-producer/native-write-set-adapter.js` (split-part
  and assertion-node identity plumbing: split claims carry new sub-spans and
  assertion subjects whose excerpt/evidence/revision identities must
  re-derive through the adapter — audit A6b)
- `tests/canonical-v2-candidate-resolution.test.js` (extend)
- `tests/canonical-v2-measurement-date-parse.test.js` (new)
- `tests/canonical-v2-native-write-set-adapter.test.js` (extend)

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

Files (add):

- `contracts/ruling-corpus/ruling-corpus.v1.json` (new — persisted,
  content-addressed corpus store; updated only by the confirmation script)
- `scripts/confirm-kind-ruling.mjs` (new — the queue → Ben-confirms →
  corpus write path; audit A6d: the loop needs real storage and a script)

Work:

1. `RULING_CORPUS/V1`: key = (exact normalised phrase, attachment position,
   concept family) — audit A4; record = ruled kind (+ code), ruler,
   timestamp, provenance tag, lexicon version at ruling time.
   Content-addressed, versioned, pinned in the resolution receipt.
2. Only VERIFIED rulings apply. Exact key match only; near-match → review.
3. Application order: corpus exact match runs BEFORE the lexicon, BUT every
   application also runs the current lexicon; a contradiction routes to
   review with `RULING_LEXICON_CONFLICT` instead of applying silently.
4. AI drafts (Task 7) can never enter the corpus file; only the
   confirmation script writes it, and only with a VERIFIED record.

Tests: exact key applies; same phrase + different attachment position does
not; one-character difference does not; unverified rulings never apply;
lexicon conflict routes to review; receipt pins corpus version; the corpus
file round-trips content-addressed.

## Task 5: provenance tags

Files:

- `lib/canonical-v2/native-producer/candidate-resolution.js`
- `lib/canonical-v2/native-producer/native-write-set-adapter.js`
- `lib/canonical-v2/validate-write-set.js` (accept + require the field)
- `tests/canonical-v2-provenance-tags.test.js` (new)

Work:

1. `answer_provenance` on every resolved claim and ruling:
   `{tag: MECHANICAL|AI|VERIFIED, pins: {...}}` per the spec's pinning rules.
   VERIFIED pins include the canonical_text hash and evidence excerpt id
   (audit A5).
2. Resolver outputs are MECHANICAL (pinning lexicon, table, corpus
   versions). Producer-originated raw values carried into open world are AI
   (pinning model, PROMPT_ID, PROMPT_VERSION).
3. Validator STAGED (audit A6a): validates the field whenever present;
   REQUIRES it only for native-producer-originated write sets. Reviewed-
   slice write sets and existing fixtures are untouched; the universal
   requirement and stored-row backfill are a separate decision for Ben.
   Never accepts an AI tag on an identity-bearing field.
4. Supersession scaffolding: rule-version bumps mint superseding revisions
   linked to the superseded ones; VERIFIED survives rule bumps but a
   canonical-text pin mismatch on source re-admission routes it to review
   (`SOURCE_SUPERSEDED`).

Tests: field required on native write sets and optional-but-validated
elsewhere (existing reviewed-slice fixtures stay green); identity-with-AI-
tag rejected; pins round-trip through adapter identity recomputation;
supersession links; pin-mismatch routes to review.

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

## Task 8: recall and volume instrumentation (audit-driven; deterministic)

Files:

- `lib/canonical-v2/native-producer/run-comparator.js` (new)
- `lib/canonical-v2/native-producer/coverage-proxies.js` (new)
- `scripts/queue-volume-dry-run.mjs` (new)
- `tests/canonical-v2-run-comparator.test.js`,
  `tests/canonical-v2-coverage-proxies.test.js` (new)

Work:

1. Cross-run disagreement diff over two run receipts for the same section
   (limbs by path + span overlap; qualifiers by normalised quote); first
   consumers are the two existing F28 recordings, whose known ~10-qualifier
   disagreement is the test fixture (audit B1).
2. Coverage proxies written into the run receipt: verified-span coverage
   share of the governed section, and source-text marker counts versus
   qualifiers emitted; a large gap sets a typed `COVERAGE_SUSPECT` signal.
3. Queue-volume dry run script: given N run receipts, report projected
   review-queue items and corpus exact-key hit rate (audit B6 — price the
   human bottleneck before the 50-deal corpus).
4. Also here: `CITATION_CORROBORATED_ONLY` triage reason in
   `candidate-resolution.js` — corroborated-only citations never auto-pass
   (audit B2).

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
