# Precedent Machine — Master Reviewer Playbook v1

**Companion to:** `pm-master-straitjacket.codex.md` (v1, SHA256 pinned in `docs/acks/ACK-MASTER-V1.reference.md`)
**Purpose:** Enumerate every surface where the reviewer's decision is required. Codex NEVER edits this file's semantics. Codex builds the UIs and API routes that implement these surfaces; the surfaces themselves — what they ask, what inputs they accept, what they write to — are frozen unless the reviewer amends this file via Appendix L.
**Non-goal:** Not a tutorial. Not a onboarding doc. This is the exhaustive contract for reviewer touch-points.

---

## Reading order

1. Section 1 lists the seven decision surfaces at a glance so Codex knows the total surface area.
2. Sections 2–8 specify each surface in detail: what it displays, what the reviewer chooses, what the system writes, and what invariants apply.
3. Section 9 specifies the anti-scope: things the reviewer will NOT be asked to do, so Codex doesn't invent new prompts.

---

# 1. The seven reviewer decision surfaces

| # | Surface | Location | Phase | Input burden |
|---|---|---|---|---|
| 1 | **Freeze buttons** | `/admin/registry/*` (Phase 0-B, 0-C, and forward per phase) | Phase 0-B onward | One click per phase, ~5 phases lifetime |
| 2 | **Reconciliation queue** | `/admin/registry/reconcile` | Phase 0-C onward | Bounded by corpus size; ~50-150 decisions at seed time, ~5-10/week ongoing |
| 3 | **Card inline editor** | `/review/[deal_id]`, pencil icon | Phase 1 onward | Ad-hoc; only when reviewer disagrees with extraction |
| 4 | **Needs-review queue** | `/admin/candidates?status=needs_review` | WP-INGEST-CONTINUOUS onward | ~3-5 deals/week at steady state |
| 5 | **Novelty flag approval** | `/outliers/pending` | WP-NOVELTY onward | Batched; ~1 batch/week |
| 6 | **Favorability rule authoring** | `/admin/favorability-rules` | WP-SCORE onward | Setup burst (~30 rules), then ~1 rule/month |
| 7 | **Feature-key migration approval** | `/admin/registry/proposed-merges` | WP-LEARN onward | ~1-3 proposals/month |

**Total steady-state reviewer input:** an hour a week, mostly the reconciliation queue and needs-review queue. Everything else is Codex's job.

---

# 2. Surface 1 — Freeze buttons

## 2.1 What the reviewer sees

At the end of every phase that produces a FROZEN artifact (canonical shape, vocab, market registry entry), the corresponding admin page displays a single `Freeze <artifact>` button. The button is disabled until every precondition for freeze is met (invariants pass, all required fields populated, all reviewer-signable rows signed).

## 2.2 What the reviewer chooses

One click. That's the entire input surface.

## 2.3 What the system writes

- Sets the artifact's `status` field to `FROZEN-v<N>` where `<N>` is the next monotonic version number for that artifact family.
- Writes a signed entry to `docs/schema-shape/freeze-log.jsonl` recording: artifact path, previous status, new status, reviewer identity, timestamp, and the SHA256 of the artifact at freeze time.
- Writes a `.frozen` marker file if the phase requires one (currently only Phase 0-C, per straitjacket Appendix P.2).
- Triggers CI to re-run all invariants; if any invariant now fails against the frozen artifact, the freeze is automatically reversed and a `BLOCKED-<phase>-FREEZE.md` is written to the repo.

## 2.4 Enumeration of freeze buttons across phases

- Phase 0-B: `Freeze canonical-registry-v1.md`, `Freeze FROZEN-triggerCode-v1.json`, `Freeze FROZEN-party_role-v1.json`, `Freeze FROZEN-IOC-other-exclusions-v1.json`, `Freeze FROZEN-R&W-sec-portions-excluded-v1.json`, `Freeze FROZEN-R&W-lookback-scopes-v1.json`.
- Phase 0-C: `Freeze audit for <shape>` (one per canonical shape declared in-scope for audit).
- Phase 0.5–7: per-phase freeze surfaces as those phases open; each phase's straitjacket entry names its own freeze buttons.
- WP-SCORE (later): `Freeze favorability-weights-v<N>.js`.

## 2.5 Anti-scope

- Reviewer NEVER edits the frozen artifact's file directly. All edits go through admin UI drafts (which produce a diff for the reviewer's approval), and freeze locks in the draft.
- Reviewer NEVER un-freezes. Reversal is via the Amendment Protocol (straitjacket Appendix L), which is a code-authored PR flow with the reviewer approving the PR, not an in-UI action.

---

# 3. Surface 2 — Reconciliation queue

**Straitjacket reference:** Phase 0-C step 4, Appendix M.5, Appendix G.1.

## 3.1 What the reviewer sees

At `/admin/registry/reconcile`, a queue of `NEW` and `IN_REVIEW` entries. Each entry displays:

- The raw extractor value (e.g. `"End Date"`)
- The field it was extracted for (e.g. `triggerCode` on the outside-date shape)
- The source provision, with the surrounding clause text
- The similarity engine's top three candidate canonical keys, with sub-score breakdown (`string: 0.42, context: 0.88, priors: 1.0, total: 0.63`)
- Any relevant `distinguished_from` blocks from `canonical-definitions.md` (i.e. "why isn't this the same as X?")
- The Merge / Promote / Split / Freeform verb chips

## 3.2 What the reviewer chooses

One of four verbs, plus a required one-line rationale (10-character minimum, 240-character maximum):

- **Merge:** raw value maps into an existing canonical key. Reviewer picks the target key from the similarity ranking or searches manually. Writes an alias entry to `docs/schema-shape/feature-key-aliases.json` (per straitjacket Appendix M) if this is a field-key merge, or to the field's `*-aliases.js` file if it's a value-level merge.
- **Promote:** raw value is a legitimately new canonical key that should be added to the `PROPOSED-<vocab>-vNEXT.md`. Reviewer supplies a proposed `canonicalKey` (uppercase, snake_case) and a required draft definition (1-3 sentences). The Promote flow writes the entry to the PROPOSED file and closes the queue entry with status `PROMOTED`. The reviewer must separately Freeze the PROPOSED file for the promoted value to become FROZEN.
- **Split:** an existing canonical key was over-collapsed; the raw value indicates two distinct concepts should live where one currently does. Reviewer supplies both new `canonicalKey` proposals and a rationale. Triggers a Split flow (heavier — re-classifies existing stored values into the two new keys; some rows land in a follow-up sub-queue for reviewer attention).
- **Freeform:** raw value is legitimately non-canonicalizable (e.g. free-text notes field, deal-specific one-off language). Sets the stored triple's `canonicalKey` to the literal `FREEFORM` per G.1.5 rule 4. Requires a rationale explaining why canonicalization is inappropriate.

## 3.3 What the system writes

Every verb writes atomically via `pages/api/admin/reconcile/decide.js`:

- Appends a reconciliation-log entry to `docs/schema-shape/reconciliation-log.jsonl` with the reviewer's identity, verb, rationale, and full state diff.
- Updates the affected stored triples in `normalized-v1.json` (Merge changes `canonicalKey`; Freeform sets `canonicalKey: "FREEFORM"`; Split rewrites both key and, potentially, sourceProvisionId if provisions moved between shapes).
- Updates the relevant aliases file (`feature-key-aliases.json` for field-key merges, `party-role-aliases.js` / `trigger-code-aliases.js` for value-level).
- Moves the queue entry to `RESOLVED-<verb>` and refreshes the similarity engine's `reconciliation-log`-derived priors so future similar values get boosted matches.

## 3.4 Invariants that apply

- Invariant #17 (`no-orphan-values`): no stored triple leaves the queue as an orphan.
- Invariant #21 (`feature-key-integrity`): every alias entry produced by a Merge verb passes the seven checks in Appendix M.4.
- The queue MUST NOT be bypassable. Adding a canonical key to a FROZEN vocab requires the Promote verb; hand-editing the FROZEN file is a straitjacket violation.

## 3.5 Anti-scope

- Reviewer is NEVER asked to invent similarity scores, override the engine's math, or hand-rank candidates. The engine ranks; the reviewer picks or overrides with a rationale.
- Reviewer is NEVER shown provisions from OTHER deals as part of a single decision. The queue displays per-deal, per-provision context. Cross-deal patterns emerge via WP-QUERY (Surface 7 for feature-key merges, later).
- Reviewer NEVER edits the reconciliation log. It is append-only, and the log's byte-identical replay reconstructs the current state (blocking test PH0C-J).

---

# 4. Surface 3 — Card inline editor

**Straitjacket reference:** Phase 0-C step 7 (design), Phase 1 (implementation).

## 4.1 What the reviewer sees

On any card in `/review/[deal_id]`, next to any canonical-keyed field, a small pencil icon. Click opens an inline editor with:

- A dropdown populated from the current FROZEN vocab for that field. Labels displayed; definitions revealed on hover.
- A provenance strip below the dropdown: `"Currently: OUTSIDE_DATE_ELAPSED (extracted from 'End Date' on 2026-05-14 via reconciliation log entry #143)"`. Shows the full lineage of the current value.
- A one-line rationale input (required, same 10/240 bounds as reconciliation queue).
- Save and Cancel buttons.
- A `Revert override` button if the current value is already an override (not the extractor's output).

## 4.2 What the reviewer chooses

- Pick a different canonical key from the dropdown, OR
- Revert an existing override to the extractor's cached value, OR
- Cancel.

Every non-cancel action requires a one-line rationale.

## 4.3 What the system writes

- Appends to `docs/schema-shape/manual-overrides.jsonl` with: deal_id, provision_id, field, old canonicalKey, new canonicalKey, reviewer identity, timestamp, rationale.
- Updates the stored triple in `normalized-v1.json` for that provision only (this override is deal-scoped, NOT a corpus-wide alias).
- Marks the override in the extractor cache so re-extractions don't silently revert it. Reverting requires the explicit `Revert override` button.

## 4.4 Invariants that apply

- Invariant #17: manual overrides count as "resolved to a canonical key" — never leave a card override in an orphan state.
- Invariant #18 (extractor cache integrity): manual overrides are honored by the cache. Downstream artifacts read the override, not the extractor row.

## 4.5 Anti-scope

- The card editor NEVER lets the reviewer type an arbitrary string as `canonicalKey`. Dropdown only. If the reviewer wants to introduce a new key, they use the reconciliation queue's Promote verb — this surface is for correcting mis-classification on a known key set, not for expanding the key set.
- The card editor NEVER writes to `feature-key-aliases.json`. Card-level overrides are per-deal, per-provision. Corpus-wide alias creation goes through Surface 7.

---

# 5. Surface 4 — Needs-review queue

**Straitjacket reference:** WP-INGEST-CONTINUOUS (in Roadmap v5); enforced from that WP onward.

## 5.1 What the reviewer sees

At `/admin/candidates?status=needs_review`, a list of deals that ingest flagged for reviewer attention. Each entry displays:

- Deal metadata (parties, value, date, structure)
- The reason it was flagged: QA failure, novelty flag count > 3, Codex/Claude parity disagreement on N fields, or manual flag from the admin
- Per-field disagreement or novelty details, with links into the source provisions
- Approve / Reject / Edit buttons

## 5.2 What the reviewer chooses

- **Approve:** ingest the deal as-is. The system promotes the deal from `deal_candidates.status='needs_review'` to `status='ingested'` and moves its provisions into the primary `provisions` table.
- **Reject:** the deal doesn't belong in the corpus (e.g. wrong exhibit, non-M&A filing). Sets `status='rejected'` with a required reason.
- **Edit:** open the deal in an ephemeral review page where per-field disagreements can be resolved individually (via Surface 3's card editor). Return to the queue when done. Once all disagreements are resolved, Approve becomes the next action.

## 5.3 What the system writes

- Approve: promotes the deal into `provisions`; appends to `docs/ingest/approvals-log.jsonl`.
- Reject: records reason in `deal_candidates.skip_reason` and appends to `docs/ingest/rejections-log.jsonl`.
- Edit: no immediate write; edits happen via Surface 3 and get logged there.

## 5.4 Invariants that apply

- Invariant #18: parity-extracted rows (`extractor_id: claude`) are additional cache entries; approving a deal does NOT promote them to primary render, only the `codex` rows are promoted.

## 5.5 Anti-scope

- The reviewer is NEVER asked to write extraction prompts, re-extract deals manually, or debug why a particular clause didn't parse. Those are Codex's problems, filed as `WP-BUG-XX` briefs against the extractor.
- The queue MAY NOT accumulate more than 10 pending entries at any time (per Roadmap v5 backpressure rule). If it does, WP-INGEST-CONTINUOUS pauses auto-ingest and switches to catalog-only mode until the reviewer drains the queue.

---

# 6. Surface 5 — Novelty flag approval

**Straitjacket reference:** none (WP-NOVELTY per Roadmap v5).

## 6.1 What the reviewer sees

At `/outliers/pending`, a weekly batched list of feature values that fired the novelty check (2σ from median, or ≤ 15% frequency for enums). Each row displays:

- The feature and value
- The deal(s) it appears in
- The corpus distribution or frequency table
- The system's suggested interpretation: "genuine outlier" | "corpus caught up, no longer unusual" | "candidate systematic extractor bug"
- Dismiss / Confirm-outlier / File-bug buttons

## 6.2 What the reviewer chooses

Batched. Reviewer sweeps through the list quickly:

- **Dismiss:** value is normal, novelty check was a false positive. Downweights the priors for this feature.
- **Confirm outlier:** value is a genuine unusual pattern; keep the flag; may subscribe to future occurrences via "precedent alert".
- **File bug:** value is likely an extraction error. Creates a `WP-BUG` entry in Codex's backlog with the flagged deal(s) attached.

## 6.3 What the system writes

- Dismiss: appends to `docs/learn/novelty-dismissals.jsonl`, updates novelty priors.
- Confirm outlier: updates `provisions.ai_metadata.novelty_flags[]` to `status: confirmed`.
- File bug: writes to `docs/bugs/wp-bug-<slug>.md` with the reviewer's identity and the flagged deal references.

## 6.4 Anti-scope

- The reviewer is NEVER asked to compute the novelty threshold, retrain the distribution model, or estimate corpus median. The system provides the numbers.
- Novelty flags NEVER auto-promote a deal to `needs_review` without hitting the > 3-flag threshold (per Roadmap v5). Below threshold, they sit in this queue silently.

---

# 7. Surface 6 — Favorability rule authoring

**Straitjacket reference:** Appendix O.

## 7.1 What the reviewer sees

At `/admin/favorability-rules`, the current rules file (`lib/schema/favorability-weights.js`) rendered as an editable form, one row per rule. Each row displays:

- Field key (with alias-resolver-computed current canonical key)
- Direction (buyer / seller)
- Weight (integer, 1-10)
- Curve type (linear_percent / enum_map / linear_range / step)
- Curve parameters (form varies by curve type)
- Family (deal_certainty / termination_economics / fiduciary_out / regulatory / structure / consideration / risk_allocation / interim_covenants)
- Notes (freeform, required when weight > 5 or curve is enum_map)

Plus: a "New rule" button, a "Freeze rules v<N+1>" button, and the current version's history log.

## 7.2 What the reviewer chooses

- Add a rule (all fields required per the shape above).
- Edit an existing rule's parameters (any change requires a rationale; freeze bumps the version).
- Delete a rule (rare; requires reviewer identity + rationale; the deletion is logged, not silent).
- Freeze the current draft as `favorability-weights-v<N+1>.js`. This is the same click-model as Surface 1's freeze buttons.
- Fork a personal rule set (per Roadmap v5's per-user overrides) — creates a copy under `docs/favorability/user-forks/<reviewer_id>/v<N>.js`. Only the reviewer's own rankings use their fork; corpus-wide rankings use the base version.

## 7.3 What the system writes

- Edits: draft state in `docs/favorability/drafts/<reviewer_id>-v<N+1>.js`.
- Freeze: promotes the draft to `lib/schema/favorability-weights-v<N+1>.js`; updates the rules-version registry; triggers a full corpus recompute of `favorability_score_runs` against the new version (which produces NEW rows, preserving the old rows so rankings history is queryable).

## 7.4 Invariants that apply

- Invariant #21: every rule's `field_key` passes `resolveKey()`. Rules can't reference nonexistent or historical-only keys.
- Invariant #22: every rule's parameters match the curve-type contract; the frozen file passes `contribution-shape.spec.js` before it can freeze.
- Straitjacket Appendix O.3: overlay never blends into primary render. This surface does NOT touch `provisions` or any primary artifact.

## 7.5 Anti-scope

- The reviewer NEVER writes SQL, JavaScript, or free-form logic. Rules are structured form fields. Codex refuses to add a "custom formula" field.
- The reviewer NEVER exports the ranking to a third-party system from this surface. That's a WP-REPORTS export flow.
- The reviewer NEVER blends favorability into a primary render. The overlay toggle is user-scoped (per Roadmap v5) and never persists as an "always on" default.

---

# 8. Surface 7 — Feature-key migration approval

**Straitjacket reference:** Appendix M.5.

## 8.1 What the reviewer sees

At `/admin/registry/proposed-merges`, a list of candidate feature-key migrations proposed by Codex's learning loops (WP-LEARN Layer 1, correction mining; or WP-LEARN Layer 2, re-extract diff clustering). Each candidate displays:

- Proposed direction (merge / split / rename / deprecate)
- `old_key` and `new_key` (or split_targets)
- Rationale from the mining pass: cluster size, evidence deals, sample corrections
- Impact analysis: how many stored triples would move, which saved queries reference the old key, which favorability rules reference the old key
- Approve / Reject / Modify / Defer buttons

## 8.2 What the reviewer chooses

- **Approve:** the alias entry lands in `feature-key-aliases.json`; the migration script runs in a follow-up PR (which Codex opens automatically) to move stored data and update downstream consumers.
- **Reject:** the candidate is dismissed with a required rationale. The mining pass will not re-propose the same cluster for 90 days.
- **Modify:** the reviewer accepts the substance but adjusts the proposed keys (e.g. "yes merge, but rename the target to `qualifierStandard` not `materialityQualifierGeneral`"). Re-submits as a new candidate that the reviewer then Approves.
- **Defer:** parks the candidate for later; the reviewer will come back to it. Does NOT expire.

## 8.3 What the system writes

- Approve: appends to `docs/schema-shape/feature-key-aliases.json` per Appendix M.1; kicks off a Codex-authored migration PR referencing the alias entry.
- Reject: writes to `docs/schema-shape/rejected-merges.jsonl` with reason.
- Modify: rewrites the candidate; no downstream action until re-Approve.
- Defer: sets `status: deferred` with a reviewer identity and timestamp; the candidate persists in the queue.

## 8.4 Invariants that apply

- Invariant #21: the alias entry produced by Approve MUST pass all seven checks in Appendix M.4.
- Straitjacket Appendix M.5: system-authored alias entries are FORBIDDEN. Every alias entry has `created_by: <reviewer_id>`, sourced from this surface (or from Surface 2's Merge verb for narrower value-level merges — but feature-key-level merges route here).

## 8.5 Anti-scope

- The reviewer NEVER hand-edits `feature-key-aliases.json`. This surface is the only writer.
- The reviewer is NEVER asked to write the migration script or the downstream-consumer updates. Codex generates those in the follow-up PR; the reviewer approves the PR normally (via GitHub review), but this is NOT a decision surface for the merge itself.

---

# 9. Anti-scope: what the reviewer is NEVER asked to do

The following would violate the playbook's discipline. Codex refuses to build surfaces that ask the reviewer to:

- Write code, SQL, prompts, or free-form logic in any admin UI. All inputs are structured form fields with a defined shape.
- Hand-edit any FROZEN file. Reversal is only via the Amendment Protocol (straitjacket Appendix L), which is a code-authored PR that the reviewer approves via GitHub, not an in-UI action.
- Approve pull requests inside the app. GitHub is the PR review surface. No in-app PR approval UI.
- Rank things by dragging. All ranking inputs are keyed by numeric weight or explicit priority integer.
- Choose between arbitrarily many options. Every dropdown is populated from a FROZEN or PROPOSED source. Every free-text field has a length cap (10-240 chars unless otherwise noted).
- Answer open-ended prompts ("what do you think of this deal?"). Every reviewer input is a structured decision with a rationale field, not an essay.
- Provide legal opinions or drafting advice in-app. This is a corpus analytics tool, not a drafting workflow.

If Codex proposes a UI that violates any of the above, the reviewer should reject the PR and cite this section.

---

# 10. Amendment

This playbook is a FROZEN artifact under straitjacket Appendix L. Changes to the seven surfaces (adding an eighth, removing one, changing what inputs a surface accepts) require an amendment PR at `docs/amendments/<yyyy-mm-dd>-playbook-<slug>.md` following the full L.2 protocol. Codex NEVER edits this file's semantics via a code PR.

Cosmetic edits (typos, prose tightening that does not change decision behavior) may land as chore commits with a note in the PR description.

---

## END OF REVIEWER PLAYBOOK
