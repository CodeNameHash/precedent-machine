# Correct tab — editor corrections with roles, queue, and weekly review

Spec author: Fable (session 2026-07-17). Product decisions from Ben:
approved editors apply immediately; anyone else queues; weekly review
cadence; peer deal names stay visible to all readers (public filings).

## What exists (reuse, do not rebuild)

- `corrections` table: `id, deal_id, provision_id, correction_type, before,
  after, context, reason, user_id, created_at` (26 rows). Written by
  `logCorrection` (pages/api/corrections.js) on every v1 edit-page PATCH.
- `lib/parser-v2/reapply-corrections.js`: corrections survive re-ingest as
  overlays (category + token-similarity matching with anti-misgraft guards).
  Anything stored through the corrections table inherits this durability.
- `components/review-v2/ClauseSidebar.jsx`: reader sidebar with a stub
  `Correct ✎` tab already gated on `isEdit` (`useViewMode`).
- v1 provision PATCH flow in `pages/api/provisions.js` — the "apply" path.

## Schema migration (SQL file in `sql/`, applied manually like prior ones)

Add to `corrections`: `status text not null default 'applied'`
(`'pending' | 'applied' | 'rejected'`), `submitted_by text`,
`reviewed_by text`, `reviewed_at timestamptz`, `card_id uuid`,
`claim_attribute text`. Existing 26 rows keep `status='applied'` (they were
direct edits). Index on `(status, created_at)`.

## Roles — approved editors

- Env var `EDITOR_KEYS` = comma-separated `name:secret` pairs (e.g.
  `ben:xxxx`). Server-side only, checked in the API route. No Supabase Auth
  in this phase.
- Client: the Correct tab has an "editor key" field the first time (stored
  in `localStorage.mtx_editor_key`), sent as `x-editor-key` header.
- API resolves the key: valid → `submitted_by = <name>`, correction is
  APPLIED immediately (existing PATCH machinery) and logged
  `status='applied'`. Missing/invalid → correction stored `status='pending'`
  with `submitted_by` from a free-text "your name" field; NOTHING is
  applied. Never reveal via the response whether a key was wrong vs absent
  beyond queued-vs-applied.

## Correct tab UI (ClauseSidebar, replaces the stub)

Fields: what's wrong (select: `code / party / value / quote / other`),
the specific claim row when relevant (dropdown of the card's claims:
`attribute — current value`), proposed fix (text), rationale (text,
required). Submit → POST `/api/corrections/submit`. Show the outcome
distinctly: "Applied to the corpus" vs "Queued for weekly review".
Typography: Inter/IBM Plex Mono only — NO serif. Match existing sidebar
styles (`LAB`/`SEL` constants).

## API — `pages/api/corrections/submit.js`

POST `{ card_id, provision_id, deal_id, target: {kind, claim_attribute?},
proposed, rationale, submitted_by? }` + optional `x-editor-key`.
- Approved: translate the proposal into a provisions PATCH when it maps
  cleanly (code/category/feature value); write through the existing
  provisions PATCH + `logCorrection` path so reapply-corrections overlays
  keep working; store the correction row `status='applied'`.
- If the proposal does NOT map cleanly to an automatable patch (free-text
  "other"), store it `status='pending'` EVEN for approved editors, flagged
  `correction_type='manual_review'` — never guess a write.
- Unapproved: store `status='pending'`, no writes to provisions/claims.
- Rate-limit crudely: reject > 20 pending submissions per hour per IP.

## Review queue — `pages/corrections-review.js` (edit-gated)

Lists `status='pending'` oldest-first: deal, card, target, proposed,
rationale, submitted_by, age. Actions per row (require editor key):
Approve (runs the same apply path; sets `status='applied'`,
`reviewed_by/at`) / Reject (status='rejected' + required note appended to
`context`). Weekly cadence is procedural: the page header shows "N pending ·
oldest X days" and the deals index shows a small badge with the pending
count when `isEdit` (link to the review page).

## Gates

- `npm test` green; new tests: key resolution (approved/unknown/absent),
  pending-vs-applied routing, non-mappable proposals always queue,
  review-approve calls the apply path (mock sb), UI submit-state rendering.
- No serif fonts; verify sidebar renders in both outcomes.
- Migration file reviewed before apply; do NOT run SQL against prod —
  deliver the file, the session owner applies it.
