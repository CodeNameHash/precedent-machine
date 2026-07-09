# Precedent Machine — PLAN

**One page. High level. Points to detail docs. This is the source of truth for what happens next.**

If you (Ben) want to know "what am I doing / what is Codex doing / what's next" — read this file, nothing else.

If Codex wants to know "what do I pick up next" — read this file, then read the detail doc for the current milestone, nothing else.

---

## Goal

Get to **Demo Bar** — all 40 deals rendered from the schema-first path, query working, a fresh ingest lands seamlessly, UI homogenized end-to-end. No legacy fallback anywhere on the render path. Backend and admin pages consistent visual language.

---

## Milestones (do them in this order)

| # | Milestone | What "done" means | Detail doc |
|---|-----------|-------------------|------------|
| M1 | **Review Queue is live** | `/admin/review-queue` renders every open Ben-decision with evidence + click-buttons. All future Ben gates route through it. | `PLAN-M1-review-queue.md` |
| M2 | **Schema is deployed corpus-wide** | Every deal renders from schema-first path. Legacy fallback is dead code. Reconciliation applied. Parity audit green. | `PLAN-M2-schema-deploy.md` |
| M3 | **Ingest is seamless** | A brand-new deal ingests end-to-end and shows up identical to any existing deal — no manual steps, no visual difference. Two-pass definitions extraction works. | `PLAN-M3-ingest-seamless.md` |
| M4 | **Query surface works** | `/query` cross-cutting queries return correct answers on the schema-first data. Query UI polished. | `PLAN-M4-query.md` |
| M5 | **UI homogenized + demo-ready** | Design tokens applied everywhere. Admin pages consistent. Full-doc overlay. Landing grid. Reports UI polish. Ready to show. | `PLAN-M5-ui-homogenized.md` |

**Independent tracks (can run any time, don't block milestones):**

- `PLAN-TAXONOMY-GAPS.md` — G1–G11 from the taxonomy review. Each gap owns a WP; each WP is slotted into the milestone where it does the most good. Codex reads this and picks up gap-WPs when the current milestone's critical path is idle.
- `PLAN-EXTRACTION-GAPS.md` — **WP-EXTRACT-GAPS-01**: five render-driven extraction gaps the review-page redesign surfaced (Material-Contracts per-bucket $ thresholds; IOC "in all material respects" standard; IOC 5.01(k)/(l)/(o) classification; corpus-wide third-party-beneficiary attribute-mapping bug; `effectiveTimeShort` corruption). Moves config-layer regex/text-sniff workarounds into structured extraction so all 40 deals render right without per-clause regex. Slots into M2/M3. SPEC-only; runs on Ben's go after the current design pass. Fable end-to-end (extraction-prompt engineering).

---

## Codex autonomy — plain-English rules

Replace all previous Inv-25 language. These three rules govern everything.

1. **Mechanical + tested = Codex self-merges on green.** Anything with automated test coverage that doesn't touch legal semantics. Ex: build script, audit harness, refactor, allowlist update, doc typo, admin page CSS, adding a new nav entry, exposing a new query executor for an already-defined field.

2. **Canonical semantics = Ben decides.** Anything that changes what a Provision, Claim, Attribute, or canonical value means; anything that adds/removes/renames a canonical vocab entry; anything that changes MAE / carve-out / covenant classification; anything that changes the reconciliation of a raw string to a canonical key. These land in the Review Queue and Ben clicks through.

3. **Destructive delete = Ben decides.** Anything that removes files from the repo (legacy vocab, legacy renderers, deprecated modules). Ben clicks a single "authorize deletion" button in the Review Queue, then Codex opens the delete PR and self-merges on green.

**Codex classifies its own PRs.** Every PR body starts with a single line: `Classification: mechanical` | `Classification: canonical (Ben-review)` | `Classification: destructive (Ben-authorize)`. If mechanical: self-merge on green. Otherwise: create a Review Queue entry, wait.

**Ben spot-checks the classifier.** If Codex miscategorizes a PR (says mechanical when it should have been canonical), Ben says so in one line; Codex updates its classifier rules in the same PR that fixes the miscategorization. No process rebuild needed.

**No more manual "waive threshold" / "unblock this file" ceremonies.** If Codex needs a threshold changed or a file added to an allowlist, it makes the change in the same PR as the work that needs it, classifies the PR appropriately, and moves on.

---

## Freeze gates

Freeze gates still exist for the shapes that are already frozen (Phase-0-C is frozen at `1ea062d`). Codex may not edit frozen files. Period. If Codex thinks a frozen file needs to change, it creates a Review Queue entry titled "Unfreeze request: <file>" and stops. Ben reviews.

New freeze gates are only introduced when a milestone explicitly requires one. No speculative gate-creation.

---

## Review Queue schema (what M1 builds)

Every Ben-gate produces one Queue entry. Shape:

```
{
  "id": "<uuid>",
  "created_at": "<ISO>",
  "kind": "canonical" | "destructive" | "unfreeze" | "clarify",
  "title": "<one line>",
  "summary": "<3-5 sentences: what is being asked, why now, what breaks if not decided>",
  "evidence": [
    {"label": "diff", "url": "<github PR/commit url>"},
    {"label": "<any file>", "url": "<link>"},
    {"label": "<audit report>", "url": "<link to md file>"}
  ],
  "choices": [
    {"key": "approve", "label": "Approve as proposed", "codex_action": "self-merge PR #<n>"},
    {"key": "reject", "label": "Reject", "codex_action": "close PR, comment with reason"},
    {"key": "modify", "label": "Approve with changes", "codex_action": "await Ben-authored diff, apply, self-merge"}
  ],
  "resolution": null,
  "resolved_at": null,
  "resolved_by": null
}
```

Persisted at `docs/review-queue/*.json`. Rendered at `/admin/review-queue`. Every choice button POSTs to `/api/admin/review-queue/[id]/resolve` which writes back the resolution.

---

## How Codex works day-to-day

1. Read this file (`PLAN.md`). Identify the current milestone (topmost with unfinished WPs).
2. Read the milestone's detail doc.
3. Pick the topmost unfinished WP in the milestone's WP list.
4. Read that WP's brief (`pm-wp-<slug>.codex.md`).
5. Execute the WP. Classify the PR. Self-merge OR create Review Queue entry.
6. Loop.

No consultation with Ben mid-milestone unless the Review Queue system tells Codex to wait.

---

## What "on hold pending Ben" looks like

When Codex opens a canonical or destructive PR:

- It classifies the PR body with `Classification: canonical (Ben-review)` or `Classification: destructive (Ben-authorize)`.
- It creates a `docs/review-queue/<id>.json` file with the full entry in the same PR.
- It self-merges the Review Queue entry (mechanical: just a JSON file), so the entry appears on `/admin/review-queue`.
- It leaves the canonical/destructive PR open.
- Ben opens `/admin/review-queue`, clicks the decision.
- The click triggers `/api/admin/review-queue/[id]/resolve` which writes the resolution and POSTs to Codex (via the existing HANDOFF file — Codex polls it) that the decision is made.
- Codex resumes: merges the PR, or closes it, or applies Ben's edit.

**Ben's only tool is `/admin/review-queue`.** No PR-hunt. No "which file was I supposed to edit."

---

## Current status (2026-07-07)

- PR #175 merged. PART 3 of master brief describes current state as of the merge.
- **Next PR:** the one that lands this `PLAN.md`, the milestone detail docs, and starts M1.
- After that PR merges, Codex runs M1 (Review Queue), then M2 (Schema deploy), etc.

Master brief PART 3 §3.3 (the "Active work-package queue" list) is now **superseded by this PLAN.md**. §3.3 gets a two-line pointer: "See PLAN.md at repo root." Everything else in the master brief (constraints, appendices, invariants) remains authoritative for its own domain.
