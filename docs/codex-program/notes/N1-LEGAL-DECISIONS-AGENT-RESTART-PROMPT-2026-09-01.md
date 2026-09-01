# Agent restart prompt — full app + current block (2026-09-01)

**Branch (pushed):** `codex/recover-m7-20260812` @ `de43243c` and successors  
**Repo:** https://github.com/CodeNameHash/precedent-machine.git  

Ben is restarting after a failed agent attempt on legal-grouping / taxonomy UX.  
**Deliverable from you first:** a short written **plan** covering (i) how to clear the current block and (ii) the fastest credible path to a **made app** (usable lawyer product), grounded in the docs below — **before** rebuilding UI or clearing stamps.

---

## Paste everything below to the new agent

```text
You are starting a fresh session on Precedent Machine (M&A contract-review product).

Ben’s name is Ben. Escalate only true lawyer judgment. Decide technical and process yourself. Plain English to Ben; no packet IDs / phase jargon in messages to him unless he asks. Rules: `.cursor/rules/ben-escalation-only-legal.mdc`, `.cursor/rules/plain-english-questions.mdc`.

Working tree: confirm with `git status --short --branch`. Expected branch: `codex/recover-m7-20260812`. Production tracks `main`; this work is on the recovery / N1 branch. Do not force-push. Do not invent legal judgments.

═══════════════════════════════════════════════════════════════
PART A — FULL APP: AUTHORITATIVE DOCS (read before planning)
═══════════════════════════════════════════════════════════════

The live reference set is `docs/core/` (six documents). Entry: `docs/core/README.md`.

Read in this order (these are the only programme documents that are “current” as a set):

1. `docs/core/OPERATING-RULES.md`
   Authority boundary, what is permitted (preview builds, extraction limits, import limits, locks). Read with `docs/CODEX-PROGRAM.md`.

2. `docs/core/PLAN.md`
   Sole executable roadmap. Outcome: private user → extract → validate/compare → durable write → serve → review UI → comparison/search → security → production cutover.
   - M0–M10 Stage 2Y extractor / shadow path (§3–§15).
   - **Product work after M10** (§16): Stages 3–9 / 9F — this is the path from certified extractor to a real product / production cutover.
   - Stage 3 is explicitly “finish unresolved semantic and taxonomy work” — related to the current block, but do not confuse N1 Work3 family packages with Stage 3 product receipts.

3. `docs/core/COMPLETED.md`
   Closed work + evidence. Do not rebuild closed steps.

4. `docs/core/DECISIONS.md`
   Binding Ben rulings. Read before proposing “fresh” design choices.

5. `docs/core/CODEBASE-GUIDE.md`
   How the system works end to end: EDGAR → parse → classify → extract → store → **review page a lawyer opens**.
   **Critical:** there are TWO pipelines:
   - **V1 / “old app”** — mature extraction + review UX lawyers already used; still the answer key / fallback on the review page for most families.
   - **Canonical V2** — Stage 2Y structure migration; replacing V1 family by family in preview.
   The guide explains serving, table configs, dark bridges, and that V1 stays until V2 proves parity. **You must actually read how the old app presents provisions (table configs, row shapes, family labels) before inventing a new Ben-facing taxonomy UI.** Prior agent failed this.

6. `docs/core/GRAVEYARD.md`
   Built-but-not-served code. Do not revive casually.

Also governing / architecture (not a seventh “core” doc, but required):

7. `docs/CODEX-PROGRAM.md` — additional governing rules, gates, architecture.
8. `docs/codex-program/programme-gates.yaml` — merge / review gates.
9. `docs/ARCHITECTURE.md` — legacy pipeline detail referenced by the codebase guide.
10. Run `npm run generate:codebase-inventory` when you need the live list of families, review table configs, serving sources, scripts (do not hand-maintain that list from memory).

Dated recovery / status notes (evidence; trust core docs if conflict):

11. `docs/codex-program/notes/HANDOFF-2026-08-12.md` — iCloud recovery context for M5–M7.
12. `docs/codex-program/notes/HANDOFF-2026-08-08.md` — Step 2X merge context.
13. `docs/codex-program/notes/PROGRAMME-N1-STATUS-2026-08-24.md` — **live N1 pickup**: 24/25 families Milestone A on disk; Capitalisation blocked; open technical next; blockers.
14. `docs/codex-program/notes/N1-NEXT-FAMILY-2026-08-24.md`
15. `docs/codex-program/notes/WORK3-FAMILY-LOCAL-TO-SPINE-MERGE-PLAN-2026-08-24.md` — spine merge queue.
16. Per-family run plans / Work3 prep under `docs/codex-program/notes/*-2026-08-24.md` and evidence under `evidence/canonical-v2/stage-2y-structure-migration/`.

`STAGE_B_HANDOFF.md` at repo root is **STALE** (pre–Termination Stage B landing). Do not treat it as the current gate.

Mechanical traps: never pipe `npm test` to tail/head; use `CI=true`; UTF-8 byte offsets not JS string indices; zero claims can be correct for a family.

═══════════════════════════════════════════════════════════════
PART B — THIS LIMITED TASK: WHAT THE PRIOR AGENT DID
═══════════════════════════════════════════════════════════════

Context: N1 Work3 sealed ~24 family Milestone A packages with many rows stamped LEGAL_GROUPING_REVIEW_REQUIRED (subtype / bucket grouping pending Ben). Goal was to get Ben’s legal rulings so stamps can clear and taxonomy can be trusted for comparison — then continue toward product.

What the prior agent built (on branch, committed/pushed in `de43243c`):

- Inventory of ~27 open legal decisions from sealed packages/dispositions:
  - `docs/codex-program/notes/N1-OPEN-LEGAL-DECISIONS-INVENTORY-2026-08-25.json`
  - `docs/codex-program/notes/N1-OPEN-LEGAL-DECISIONS-RICH-PACKETS-2026-08-25.json`
  - `docs/codex-program/notes/N1-OPEN-LEGAL-DECISIONS-BOARD-DATA-2026-08-25.json`
- Cursor canvas UI for Ben to pick options and emit receipt JSON:
  - local path `~/.cursor/projects/.../canvases/n1-legal-decisions.canvas.tsx` (NOT in git; rebuild via script)
  - `scripts/codex-program/build-legal-board-bucket-presentation.js`
  - `docs/codex-program/notes/N1-LEGAL-DECISIONS-BOARD-README-2026-08-25.md`
- Split “blocking” vs “review-stamp” decisions; Ben wanted blocking answers in chat, board for non-blocking.
- Iterated UX: thin cards → jargon → “plain English” → line dumps → capped samples → V5 “buckets had / buckets to add + operative clause from M4 evidence spans”.
- Receipts:
  - `N1-BEN-LEGAL-RULINGS-RECEIPT-2026-08-25.json` (earlier blocking; mechanical sealed mutations largely deferred)
  - `N1-BEN-LEGAL-RULINGS-RECEIPT-2026-09-01.json` (8 review-stamp attempts; **NOT applied** — notes showed confusion)

═══════════════════════════════════════════════════════════════
PART C — WHY BEN REJECTED IT (ISSUES TO INTERNALISE)
═══════════════════════════════════════════════════════════════

1. **Fundamental misunderstanding of the task.** Ben needed lawyer-usable **comparison taxonomy** decisions (how provisions are cut for search/compare). The agent kept asking abstract “approve the proposed subtype split / one bucket?” without showing a real proposed cut or grounding in how the **old app** already surfaces provision types / rows.

2. **Did not pick up points of detail from the old app (V1).** The live review UX, table configs (`components/review/table-configs/`), family labels, and how lawyers already scan deals were not used as the starting model. New buckets/claims were invented from sealed V2 inventory jargon (e.g. “Topic Classification”, one dump “Restrictive Covenant”) instead of aligning with familiar product structure and deal-lawyer categories.

3. **Unusable presentation.** Early cards dumped hundreds of lines; “sample clauses” often lacked real operative language; claim names (e.g. “Per share cash consideration”) were shown as if they were buckets (bucket was Cash Component).

4. **Fake split questions.** Several families had only ONE populated bucket in the inventory (Interim Operating 113× Restrictive Covenant; Guaranty 5× Performance Guaranty; General Covenants 54× Topic Classification) yet still asked Ben to approve a “split.”

5. **Ben’s concrete notes (2026-09-01 receipt) — do not stamp-clear from these without re-confirmation on a good brief:**
   - Antitrust: generally OK directionally, but Red Hat is efforts; wants an **efforts-cap** bucket too.
   - Appraisal: **one bucket** (not the two-way split).
   - Dividends: clean approve (trivial one-bucket).
   - Financing: couldn’t see referenced lines (UI failure).
   - General covenants: “these are all **access**.”
   - Guaranty: “these all seem the same?”
   - Interim operating: confused; expects **Indebtedness / M&A / issuing shares** etc., and **positive covenant + subparts** — not one restrictive dump.
   - No-shop: didn’t understand the question (opaque multi-bucket ask).

6. Canvas “Send to chat” opens a **new** composer chat (API limitation) — copy/paste into the intended thread.

═══════════════════════════════════════════════════════════════
PART D — YOUR FIRST OUTPUT (REQUIRED BEFORE IMPLEMENTATION)
═══════════════════════════════════════════════════════════════

After reading Part A docs enough to be accurate (at least OPERATING-RULES, PLAN §1 + §16, CODEBASE-GUIDE sections on V1 vs V2 and the review page, PROGRAMME-N1-STATUS, DECISIONS skim, and this handoff), reply to Ben with a **plan only** (no large rebuild yet) covering:

(i) **How to get through THIS block**
    - Clear definition of done for legal-grouping / taxonomy so Work3 stamps can be cleared honestly.
    - How you will use **old-app (V1) detail** (table configs, existing provision labels, review UX) as the default vocabulary, and only diverge when V2 extraction proves a better cut.
    - How you will present decisions to Ben (short briefs: had buckets; proposed buckets with one real clause + deal count; one clear question) — and refuse to ask “approve split” when there is no real topic map.
    - Ordered attack list (Interim Operating first as the template is a strong candidate; then No-shop, Antitrust, Appraisal, General/Access, Guaranty, Financing, remaining stamps).
    - What is NOT this block (Capitalisation comparator blockage; spine merge; mutating hash-pinned sealed packages without a proper successor session).

(ii) **How to get to a MADE APP ASAP**
    - Map the shortest path from current N1/Work3 state to a usable lawyer product, using PLAN.md outcome + §16 product stages and CODEBASE-GUIDE’s serving/review reality (V1 still serves; V2 must prove into preview).
    - Separate: what unblocks comparison/taxonomy vs what unblocks serving/import/preview vs what is true production cutover.
    - Identify the critical path and what can stay parallel / deferred (e.g. Capitalisation / Stage 9F).
    - Explicit risks if taxonomy is wrong (misleading precedent search) vs if product stages are skipped.

Do not clear LEGAL_GROUPING stamps from the 2026-09-01 receipt until Ben accepts the plan and re-confirms on usable family briefs.

Confirm in one short sentence that you have the docs list and will return the (i)/(ii) plan next.
```

---

## Files already on origin for this block

| Path | Role |
|---|---|
| `docs/codex-program/notes/N1-LEGAL-DECISIONS-AGENT-HANDOFF-2026-09-01.md` | Earlier narrow handoff (superseded in intent by **this** file for paste) |
| `docs/codex-program/notes/N1-LEGAL-DECISIONS-AGENT-RESTART-PROMPT-2026-09-01.md` | **This file** |
| `docs/codex-program/notes/N1-BEN-LEGAL-RULINGS-RECEIPT-2026-09-01.json` | Confused rulings — not applied |
| `docs/codex-program/notes/N1-OPEN-LEGAL-DECISIONS-*.json` | Inventory / board / rich packets |
| `scripts/codex-program/build-legal-board-bucket-presentation.js` | Board/canvas rebuild helper |
| `docs/codex-program/notes/PROGRAMME-N1-STATUS-2026-08-24.md` | N1 status |
