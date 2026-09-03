id: A-0010
from: lead
to: ext
date: 2026-09-03
re: Q-0008 and Q-0009 (ext/m7-verify-finding @ 6133a359, PR #487)
status: ANSWERED

# Q-0008: ACCEPT

All three defects confirmed independently, with the same numbers my side
found (2,101 claims / 285 shared nodes; 0 of 1,399 tokens; 0 of 1,382
signatures; compiler passes no payloads; first error verbatim). Your
"overstates ingest" point is right and is how I will state it to Ben:
governance plumbing reaches the generator; the generator is a fixture
compiler. PR #487 stays a scratch branch; it is not integrated.

# Q-0009: ACCEPT

Received. My own diagnosis (eight lenses, running now) agrees on the
shape: real-text capability exists at M2/M3/M4 and in the native-producer
parsers and resolver tables; nothing above M4 has ever run on real text.

# Next tasks, both writable, both useful under any plan Ben picks

Deliver on `ext/m7-verify-finding` (same scratch prefix) unless told
otherwise. Scripts plus outputs plus a short markdown each.

## Q-0010: real-clause anchor table for all 1,382 approved profiles

Finding to build on: every approved profile's `required_expression_signature`
resolves (1,380 of 1,382) to a `terminal_rule_registry` entry in that
family's phase-2 authority (`control/m7-v2-repair-contract-<family>-authoring-phase2-authority-v2.json`,
MAE is `-v1.json`), under `source_terminal_successor_contract.terminal_rule_registry`.
Each entry binds `agreement_id`, M4 claim IDs and `source_node_occurrence_id`;
17 of 24 families also bind exact byte spans, the other 7 need spans
resolved through the M4 claim's `evidence_edge_ids` (M4 analyses under
`shadow/m4/<agreement_id>.agreement-analysis.json`, 4.4 MB each; read by
script).

Produce one JSON table, one row per profile:
`profile_id, profile_key, family_key, classification_path, signature,
agreement_id, m4_claim_ids[], source_node_occurrence_id, span_source
(REGISTRY|M4_EVIDENCE_EDGE|UNRESOLVED), start_byte, end_byte, text_sha256,
verified (bool: sha of canonical bytes at the span equals text_sha256),
node_kind (from the M2 index node), claims_on_node (count of M4 claims
sharing that node)`.
Canonical text is `source_binding.canonical_text` in the M2 index
(`shadow/m2/<agreement_id>.agreement-index.json`); byte offsets are UTF-8
half-open. Report: rows verified / unresolved / sha-mismatch, per family;
the two profiles that do not resolve and why; the distribution of
`node_kind` and `claims_on_node`. Acceptance: the script re-runs to the
same table byte-for-byte; every `verified: true` row was checked against
the bytes, not the registry's own claim.

## Q-0011: typed-value coverage of the fixed 50

For each of the 50 members of
`control/m7-v2-repair-fixed-sample-identity-manifest.json`: the M4 claims
on its `source_node_occurrence_ids` (all of them, not one), each claim's
`claim_definition_key`, whether the claim carries a typed value (numeric,
date, enum, presence boolean, or an untyped whole-sentence raw value), the
producer that minted it (parser module in
`lib/canonical-v2/native-producer/*-parse.js` or a resolver table in
`candidate-resolution.js`, found by grepping the key), and Ben's original
decision and note from `control/m7-v2-repair-baseline-ledger.json`. Then,
per item, one line: can the note's demanded legal content be satisfied
by re-typing values M4 already holds, or does it need a fact no producer
emits today (say which fact). Summarise: items fully coverable from M4,
partly, not at all. Acceptance: table plus script; every "no producer"
claim backed by a grep result, not a header comment.

# What comes next from me

The re-plan is A-0011 (renumbered again; sorry). It arrives when my
diagnosis and adversarial review finish. Keep polling.
