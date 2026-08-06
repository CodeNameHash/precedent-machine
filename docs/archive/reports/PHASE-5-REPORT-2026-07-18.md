# Phase 5 report — corpus re-extract program, final review

Fable, 2026-07-18. Closes the HANDOFF-REEXTRACT program (Phases 0–5) on
branch `claude/corpus-reprocess-materialize-njx7ou`. Everything below is
verified against live DB state, not agent self-reports.

## Corpus state

- **31 of 40 deals pass every QA gate** (updated post-Noble-Africa) (21 at program start under the old
  metric; the gates themselves got stricter along the way).
- **Zero hallucinated quotes corpus-wide.** The Phase 5 adversarial audit
  read all 15 residual unverified-quote flags: 0 hallucinated,
  3 normalizer gaps (fixed — United Homes now green), 12 honest catches of
  extraction sloppiness (7 repetition-loops in materialContractsBuckets
  text, 4 unmarked mid-quote elisions, 1 word-drop). The 12 stay flagged
  on principle and clear on next re-extract of their sections.
- **Election data exact**: 2 genuine mechanisms (QXO $505.00/20.200
  default-to-stock; Skechers $63.00 / $57.00+1-unit default-to-cash);
  IonQ and Covance false positives deleted with evidence.
- **Coverage is now a real signal**: body-scoped gated metric + raw
  informational metric + LLM audit of every exclusion and gap. Every
  sub-95% deal is either fixed (Cox, M.D.C., Forest City, CSRA, Modiv,
  HireRight, Kraft, Concho, Whole Foods, Redfin-tail, Landos, Mr. Cooper,
  Verve, Starwood, Red Hat, Bridge, Cooper Tire, Summit) or dispositioned.
- **Open items, all explained**: Redfin 92% coverage + QXO's missing
  bring-down tiers (the two pinned fixtures of the mid-provision-loss
  class — see span-accounting spec); 8 deals × 1–3 honest quote flags per
  above. Noble Africa CLOSED post-report: document proven correct (a
  12-exhibit-trailer reverse merger), re-ingested green — 383 provisions,
  98.3% coverage, 0 quote flags, canonical 0.83 — after one added
  coverage rule for form-of exhibit stub trailers (ff8e60a).

## Defect ledger (found by gates, fixed this program)

| Defect | Caught by | Fix |
|---|---|---|
| CONSID-EQUITY invariant killing whole ingests (2 modes: no-mention carrier, DEF-typed carrier) | zero-treatments invariant | mention guard + type gate |
| Duplicate same-instrument same-span rows (CSRA) | duplicate-key invariant | dedupe collapse |
| Body-end truncation on wrapped "Exhibit B" cross-refs (Catalent 6/92 sections; Landos, Mr. Cooper latent) | Catalent QA FAIL | heading-shaped exhibit markers |
| Invisible `&lrm;` entity pollution (Summit ×99) | quote + coverage gates | strip at ingest + normalizer defense |
| Coverage denominator counting cover/TOC/signatures/exhibits | 7 deals sub-95 | head-matter + tail exclusions, dual reporting |
| Exclusions eating operative text (5 modes: counterparts-clause sig anchor, definition-as-title, list-continuation titles, Annex-A carve-back ordering, attached-agreement TOC/defs) | LLM exclusion audit | qualified-title discipline |
| Taxonomy false flags 335→8 (case-blind lookup; unregistered knowledgeQualifier; missing carve-out dicts) | store-claims TAX-1 flags | registry sync + dicts |
| Mid-provision generative loss (Redfin §2.10, QXO §5.2(a)) | coverage audit + tier check | **open — span-accounting spec, delegable** |
| Quote repetition-loops / unmarked elisions | quote verification | open — folds into span accounting |

Infrastructure shipped: ingest checkpointing + `--resume` (restart cost
seconds), overnight watchdog pattern, LLM coverage audit, dual coverage
metric, corpus-wide TAX-1 survey tooling.

## Product shipped alongside

Mergertrace v2 UI complete on `/review-v2` (masthead, collapsible
sections, provision index, definitions, election card wiring); clause
sidebar reader mode (full filter set, friendly labels, similarity-ranked
comparables); Correct tab (editor keys, pending queue, weekly review
page) awaiting two Ben setup steps (EDITOR_KEYS env var + one additive
migration: `supabase/corrections-status-schema.sql`).

## Decision items for Ben

1. **Route swap to main** (the gate): promote /review-v2 to the production
   review route and merge this branch. Recommend: after a 30-minute
   side-by-side A/B on 3 deals (Metsera, QXO, Bioverativ) — the render
   layer is byte-parity-tested but the A/B is your look-and-feel sign-off.
2. **Recitals policy**: ~7 deals' recitals (board approvals, intended tax
   treatment, deal structure) sit outside provision coverage. Recommend:
   capture as deal FACTS (structured metadata) not provisions — they
   assert history, not obligations. Small extraction addition.
3. **Span accounting build** (#13): spec is written and delegable
   (SPAN-ACCOUNTING-SPEC-2026-07-18.md). Recommend green-lighting Parts
   1–2 + report-only Part 3 immediately; it is the fix for both open
   fixtures and the repetition/elision quote flags.
4. **Coverage gate 95→98**: after span accounting's corpus baseline is
   clean. No action now; flagging intent.
5. **Endeavor proposed codes**: 112 novel take-private concepts (Rollover
   Agreement, Manager Securities, Pre-Closing Restructuring…) await
   curation in the proposed-codes queue. Recommend a 30-minute
   curation session together — these are taxonomy-shaping calls.
6. **Security batch (pre-demo, needs you present)**: rotate the legacy
   Supabase JWT + re-run RLS lockdown over post-July-2 tables
   (provision_cards/claims currently world-readable via anon key).
7. **QXO COND prompt fix (optional pre-demo)**: a targeted COND-B
   extraction-prompt fix could populate QXO's bring-down table before
   span accounting lands. ~1 focused session. Your call on urgency.

## Program constraint compliance

Dry-run + QA gate preceded every corpus write; no number was hit by
weakening a gate without disclosure (the coverage-metric change was
flagged to Ben before shipping and audited by LLM afterwards); every
rematerialize followed every provisions write; before/after counts
reported per stage throughout the session log.
