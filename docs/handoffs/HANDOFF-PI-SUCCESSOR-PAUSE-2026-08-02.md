# HANDOFF — Process Intelligence successor plan: pause state (2026-08-02)

Written at Ben's PAUSE + HANDOFF instruction. The resuming session should
assume zero conversation memory: every ref needed is in this document.

## 1. Commit-of-record step — COMPLETE

The 2026-08-02 amendment is the current plan of record.

- **Plan of record:**
  `docs/superpowers/plans/2026-08-02-process-intelligence-successor-plan.md`,
  committed at `b5f2feae` on `codex/process-intelligence-design` (pushed to
  origin), bytes SHA-256
  `36788a52eb281abdb03ffe42421e3d224dee670f0a5572fd8f0d08d53d631abd`.
  Status FINAL; Ben's rulings (2026-08-02) are inside the document
  (full shared-field release day one; costed deltas D1/D2/D5 all accepted;
  extraction-rigor priority; v1 Storylines UI as P6 baseline).
- **Drafting provenance:** identical bytes were authored on
  `claude/claim-definitions-taxonomy-8xy16l` (rulings recorded at
  `1934540a`, finalised at `d3047fb3`, pushed 2026-08-02).
- **Ledger pin:** main commit `27b79430` adds the pin to
  `docs/codex-program/EXECUTION-LEDGER.md` (intro, before "Current state"),
  naming both the 2026-07-29 parent plan and the 2026-08-02 amendment.
- **Provenance question C-1 (the `570e19ff…` hash) — RESOLVED.** The
  committed 2026-07-29 plan copy in `precedent-machine-process-design`
  hashes exactly
  `570e19ff0ef8a8a130f18f11833348d25a0d9783eda01b540bfe7320dec6a55d`,
  equal to the bytes Ben supplied to the drafting session. The historical
  ledger pin `a255661c…` (ledger revision at `7b6bc641`) referenced an
  EARLIER revision of that file, before `bdc4e8f3` ("docs: cap process
  review and defer hardening") amended it. No discrepancy.
- **Source-of-record location note:** the "process-design repository" is
  not a separate repository — it is branch `codex/process-intelligence-design`
  of this repo, checked out at
  `/Users/bengoodchild/Documents/Claude/precedent-machine-process-design`.
  The historical ledger pin path confirms it as the pinned location.
- **Remaining: nothing mechanical.** The plan is committed, pushed and
  pinned. (The amendment is not on `origin/main`; the source-of-record rule
  does not require it to be.)

## 2. Metsera gold provenance — finding: NO Ben review exists

Question examined: who authored each enumeration lane, the reconciliation
and the blind challenge, and does any Ben-review or approval artefact exist
for the seal of `metsera-gold/exclusivity-gold.v1`?

### (a) Authorship — every stage was a model session

| Stage | Commit | Branch / task identity | Evidence |
|---|---|---|---|
| Lane A source enumeration | `e31296d9` "Add Metsera source evidence lane A" (2026-07-30) | `codex/metsera-source-evidence-lane-a-v1` | Codex work-packet branch; worktree `Documents/Claude/precedent-machine-metsera-source-evidence-lane-a-v1` |
| Lane B source enumeration (independent) | `4fdbe5dc` "Add independent Metsera source evidence lane B" | `codex/metsera-source-evidence-lane-b-v1` | Same pattern, separate worktree |
| Source reconciliation | `7bfdf1f4` "Add Metsera source reconciliation" | `codex/metsera-source-reconciliation-v1` | Outputs live on main under `evidence/process-intelligence/pilot/` |
| Gold seal | `9bff4690` "Add sealed Metsera gold evidence" (2026-07-30, on main) | WP `wp-metsera-gold-evidence-v1` (allowlist `.github/phase-allowlists/wp-metsera-gold-evidence-v1.json`) | Delegated work-packet; adds `exclusivity-gold.v1.json`, `source-universe.v1.json`, `lib/canonical-v2/metsera-gold-evidence.js`, tests |
| Blind challenge | — | `codex/process-exclusivity-independent-challenge-v1` | Named by the freeze artefact itself: `evidence/process-intelligence/freeze/exclusivity-challenge-blind-input-manifest.json` → `authoring_task.task_identity`, method class `INDEPENDENT_PUBLIC_PRECEDENT_SOURCE_ONLY_CLAUSE_REVIEW` |

Git author on every commit is `Ben Goodchild <bengoodchild@gmail.com>` —
that is the machine identity carried by all delegated commits and is not
evidence of human authorship. No commit carries a human-review trailer.
The branch naming (`codex/*`, `wp/*`), the agent worktree paths, and the
freeze artefacts' own `authoring_task` fields identify model sessions
throughout. The "independence" evidenced in
`exclusivity-reconciliation-independence.v1.json` is task separation
BETWEEN model sessions, not human independence.

### (b) Ben-review / approval artefact — NONE FOUND

- `docs/acks/` contains no PE1 or gold acknowledgement (only ACK-MASTER,
  CLAIM-IDENTITY-APPROVALS-2026-08-01, M1-CONTRACT-FREEZE-*, M2-VERTICAL-SLICE).
- No document under `docs/` mentions `exclusivity-gold`, "metsera gold" or
  the blind challenge (repo-wide grep, 2026-08-02).
- The execution ledger records no Ben approval of the gold seal.

### Ruling applied (per amendment delta D2, at Ben's 2026-08-02 direction)

**`metsera-gold/exclusivity-gold.v1` is recorded as UNTRUSTED-UNTIL-REVIEWED.**
It is model consensus (two Codex enumeration lanes + a Codex reconciliation
+ a Codex blind challenge), not gold. No graded extractor run may be
reported as recall-against-gold until Ben reviews and rules on it. Until
that ruling, graded output must be labelled agreement-with-model-consensus.

### Cheap conversion path — the spot-check packet (described, not assembled)

The raw material is already committed and content-addressed:

- `evidence/process-intelligence/pilot/metsera-source-reconciliation.v1.json`
  — per-item `agreement_state` across lanes. Counts at this basis:
  - `source_reconciliations` (20): **3 `ONE_LANE_ONLY`** (a lane missed a
    source — highest-value items), 17 same-accession/different-byte-scope.
  - `proposition_event_reconciliations` (104): **48
    `NO_CONTRARY_LANE_A_PROPOSITION_LANE_B_GRANULAR_EVENT_REVIEWED`**
    (single-lane support — roughly half the event layer), 56 substantive
    agreement with lane B more granular.
  - **17 `UNRESOLVED_SOURCE_GAP`** items (4 role-identity + 13 uncertainty);
    11 `unresolved_items` (0 blocking).
- `evidence/process-intelligence/freeze/exclusivity-question-reconciliation.v1.json`
  — 48 challenge-question reconciliations, 23 predicate reconciliations,
  **18 blockers**, and `freeze_disposition: BLOCK_CONTRACT_FREEZE`
  (successor-catalogue blocker) — NOTE: this artefact independently blocks
  contract freeze and must be addressed in the WP3A package.
- The sealed gold itself is small: 8 passages, 6 parties, 3 bidder tracks,
  2 false-match traps, 9 sealed sources (byte-exact against their digests,
  verified 2026-08-02). Full Ben review is tractable.

Packet recipe (a resuming session can build it in one short unit): take all
3 `ONE_LANE_ONLY` sources, all 11 `unresolved_items`, all 17
`UNRESOLVED_SOURCE_GAP` items, a ~15-item sample of the 48 single-lane
event items, a ~5-item control sample from the 56 two-lane-agreement
items, and all 8 gold passages. For each: lane statement(s), anchors, and
the official SEC URL from
`evidence/process-intelligence/metsera-gold/source-universe.v1.json`
(`documents[].officialUrl`), so Ben reviews against sources. Emit one
review document; Ben's dispositions convert the gold to TRUSTED (or amend
it) via a dated acknowledgement in `docs/acks/`.

## 3. State of the two parallel units (both stopped before any commit)

Neither unit created branches, commits or files. Partial read-only findings
from the stopped agents (unverified except where noted):

- **Metsera graded run** — agent verified all 9 sealed sources byte-exact
  (independently re-verified above); stopped while locating extractor
  entry points. **Now GATED on Ben's gold ruling (§2).**
- **WP3A package assembly** — agent reported the successor tree at main
  basis `27b79430` compiles to the exact M1-approved bundle identity;
  stopped while pinning successor-tree history. Treat as unverified until
  the package recomputes it.

## 4. Next actions, exactly

1. **Commit-of-record:** nothing remains.
2. **Ben gold ruling (new, gates the graded run):** build the spot-check
   packet per the §2 recipe (read-only over two committed JSONs; small
   unit), put it to Ben, record his dispositions as a dated
   acknowledgement in `docs/acks/`. Only a TRUSTED ruling (or an amended,
   re-sealed gold) unlocks recall-against-gold reporting.
3. **Metsera graded run (after the ruling):** branch `wp/metsera-graded-run`
   off then-current main; replay-based per D4 (recorded content-addressed
   artefacts, no production access, no Supabase writes); grading checker
   resolves within the governed unit/span per D3; the grading instrument
   ships UNTRUSTED and this run is its first-workload triage per D2;
   deliverable is a committed dated handoff with recall/precision and
   segmentation-defect table. If run before the ruling, label all numbers
   agreement-with-model-consensus.
4. **WP3A pre-freeze package (A1):** branch `wp/wp3a-pre-freeze-package`
   off then-current main; contents per plan §3 A1 — exact successor root
   (reuse the existing bundle-digest tooling; ledger "Current state" table
   holds the current bundle/contract/payload digests), delta since the
   last reviewed state, the four Sol/Fable design dispositions as the
   regression baseline, the P3 judgment debt named (delta-review M-5, not
   discharged), an honest statement of the shared-authority projection
   status under Ben's full-release ruling (WP3A fails on an absent or
   incompatible shared projection), AND the
   `BLOCK_CONTRACT_FREEZE` disposition + 18 blockers in
   `exclusivity-question-reconciliation.v1.json` (§2), which the package
   must carry forward, not bypass. A2 is already ruled (full release) —
   the next Ben touchpoints are the gold ruling, then A3.
