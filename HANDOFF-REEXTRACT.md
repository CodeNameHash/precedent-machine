# Handoff — coordinated re-extract + forward roadmap

_Written 2026-07-16, after the party-model + classification batch shipped to `main`
(commit `d6f35d7`, deployed). This is the single remaining piece of that batch (data
population) plus the roadmap beyond it._

---

## Prompt for a fresh session (copy-paste)

```
Precedent Machine (Next.js M&A contract-review app; Supabase Postgres; Vercel tracks
main). Read CLAUDE.md first for the model-routing/watchdog protocol.

CONTEXT — what just shipped to main (commit d6f35d7, deployed to production):
A large "party model + classification" batch landed and is LIVE:
- partySide now derives party from the provision code token (lib/party-scope.js), not the
  uniform MUTUAL default — fixed 752 buyer-side cards mislabeled "Target" across all 40
  deals. This render fix works on EXISTING data (no re-extract needed).
- IOC general-exceptions render as pills + affirmative/negative exceptions layout.
- IOC sub-clause categorization fallback (lib/vocab/ioc-categories.js iocCategoryFromBody,
  earliest-keyword matching) — categorizes previously-"[PROPOSED] Unclassified" covenants.
- IOC-B mirrored-subsection retyping + NOSOL-T/-B/-M party subtypes (default stays bare NOSOL).
- FORCE_THE_VOTE strength codebook (FTV_HARD/SOFT/NONE); forceTheVoteType is a tagged NOSOL
  feature; party rides the row, NOT the code. eval/goldens.json has 5 "armed"
  feature_code_pins (TopBuild/Noble Africa=FTV_HARD, Anadarko/Covance/Frontier=FTV_SOFT).
1419 tests + build + node scripts/eval.js all green on main.

YOUR TASK — run the coordinated re-extract that POPULATES those code fixes into the corpus.
This is the only remaining piece. It is a corpus WRITE, multi-hour, AI-backed. Run it
MONITORED and STAGED, dry-run before every --apply, and verify a mirrored deal before going
corpus-wide.

KEY FACTS:
- reprocess: node scripts/reprocess.js (--deal <substr> | --all) (--types NOSOL[,...] |
  --classify-only) [--apply] [--backend claude|codex]. No --apply = dry-run (no writes, no
  LLM). Per-type --apply writes PROVISIONS ONLY.
- After any provisions --apply you MUST rematerialize cards/claims:
  node scripts/reprocess/rematerialize-claims.js --deal <ids> --apply (dry-run first).
- Gate every write: scripts/ingest-qa.js (0 unverified quotes, 0 dup provisions) +
  node scripts/eval.js (goldens) must stay green; quote verification stays at zero flags.
- The 6 deals with an INCOMPLETE classification pass (code=null across many rows — the
  biggest data gap): Noble Africa/ENDRA, Bioverativ/Sanofi, Juniper/HPE, Summit Materials/
  Quikrete, Catalent/Creek Parent, Endeavor/Wildcat EGH. These need a full re-classify+extract.
- UNVERIFIED HEURISTIC (verify before trusting corpus-wide): IOC-B subsection retyping fires
  on "Conduct of Business by <Parent>" — test it on Starwood/Marriott, Modiv/Global Net Lease,
  CSRA/General Dynamics (mirrored deals) FIRST and eyeball that the parent's covenants become
  IOC-B, before applying broadly.
- --backend codex = zero Claude plan tokens for NOSOL (gated by QA anyway) IF the codex CLI is
  available in this env; otherwise --backend claude uses plan usage. Check availability.
- Metsera deal_id 885edae5-49e8-464a-9f33-edd229119d7c; Noble Africa 65a3e3c8-91e6-4075-
  bad0-4e3c4d1b43b9. DB creds in .env.local (gitignored); NODE_PATH=./node_modules for
  standalone scripts. NOTE: the legacy service_role JWT in .env.local should be rotated.

CONSTRAINTS: dry-run + QA gate before every corpus write; never corrupt the corpus to hit a
number; rematerialize after every provisions write; report each stage's before/after counts.
Merged branches wp/party-covenant, wp/ftv-codebook, wp/classifier-party (+ sub-branches
wp/ioc-subclause-fix, wp/covenant-ui) can be deleted.

START by: (1) confirm main is green (npm test), (2) dry-run a full re-extract of Starwood to
verify IOC-B, (3) report the plan before applying anything.
```

---

## Plan — the re-extract (Phases 0-5)

**Phase 0 — Sanity.** `npm test` green on main; check whether `codex` CLI is available
(decides NOSOL backend); delete the 5 merged `wp/` branches.

**Phase 1 — Verify risky heuristics (dry-run, no writes).** Full re-extract dry-run of
Starwood/Marriott (+ Modiv/GNL, CSRA/GD) → confirm the parent's `IOC-B` subsections retype.
Dry-run a reciprocal deal (Concho) for `NOSOL-M`. **Go/no-go:** if IOC-B mis-fires, fix the
heuristic before any apply.

**Phase 2 — FTV populate (lowest risk, highest signal).** `reprocess --all --types NOSOL
--apply` (`--backend codex` if available). Populates `forceTheVoteType` corpus-wide → the 5
armed eval pins flip from "armed" to enforced. Rematerialize → `ingest-qa` → `eval`. **Also
read ENDRA/Noble Africa's FTV manually** — flagged ambiguous (acquirer-side hard force-the-vote).

**Phase 3 — Fix the 6 broken deals (biggest data gap).** Full re-classify + extract per deal.
Populates hundreds of `code=null` rows + IOC categorization. Rematerialize + QA per deal.
Bioverativ's 23 `[PROPOSED]` DEF codes: check if they should match existing standard codes
(taxonomy under-match) vs. genuinely new.

**Phase 4 — Corpus-wide categorization + party re-mint.** Broader re-extract to land IOC
sub-clause categories + IOC-B/NOSOL typing on the remaining deals; rematerialize all cards so
stored `party_scope` catches up with the render fix. QA + eval + quote-verification stay at
zero flags.

**Phase 5 — Post-populate review.** Spot-check the review UI: a mirrored deal (IOC-B renders),
a reciprocal deal (NOSOL-M), TopBuild (FTV_HARD pill). Then the taxonomy-curation backlog:
~57 COV + 23 Bioverativ `[PROPOSED]` codes — decide which to canonicalize (Fable/Opus, Ben-gated).

Checkpoints: dry-run → QA gate → Ben OK before each phase's corpus write. Nothing here touches
`main` code again — it's data population against the already-deployed fixes.

---

## Roadmap beyond the re-extract (Phases 6+)

**Phase 6 — Harden the ingestion pipeline (highest-leverage reliability fix).** The 6 broken
deals share one root cause: the classification pass silently ships half-done (whole deals with
`code=null` across all provision types). Diagnose why (interrupted job? multi-party naming like
PubCo/OpCo tripping the classifier?) and add a **completeness guard** to the ingest pipeline
(scripts/ingest-qa.js) that FAILS ingestion when a deal has an abnormal fraction of unclassified
rows — so no new deal can enter the corpus half-classified. Prevents the corpus from re-breaking.

**Phase 7 — Unlock precedent search / cross-deal benchmarking (the product payoff).** Now that
FTV, IOC categories, and party are all coded corpus-wide, build/surface the comparison the app
exists for: "all hard force-the-vote deals," termination-fee benchmarks, party-aware precedent
search, force-the-vote / go-shop / MAE-carveout distributions across the 40 deals. This is where
the coding investment turns into user value.

**Phase 8 — Taxonomy curation pass.** Work the `[PROPOSED]` backlog (COV ~57, DEF ~23+):
Fable/Opus canonicalizes the recurring proposed codes into lib/taxonomy.js, leaves genuinely
deal-specific ones as `[PROPOSED]`. Permanently reduces "unclassified" noise. Also resolve the
deferred taxonomy decisions: TAX-2 scoping, the mis-codings (Endeavor Board→Committee,
MAT_MAE merge, governing-law dual).

**Phase 9 — Deferred Ben-gated backlog (from the 2026-07-15 batch).** Security client-auth story
(branch wp/api-auth-middleware — Ben picks Vercel-protection / session / BFF); numeric backfill
(blocked on Ben's `ALTER TABLE public.claims ADD COLUMN canonical_numeric jsonb`); Safe-Disclosure
carve-out apply (7 genuine); staging-deal re-ingest subset. All await Ben's decisions
(reports/BEN-QUEUE-2026-07-15.md).

**Phase 10 — Pre-demo polish.** Demo dry-run against a curated deal set; a11y audit of the review
UI; performance pass on pages/review/[id].js (the largest component); docs reconciliation
(docs/ARCHITECTURE.md ↔ the party model + classification changes). Rotate the leaked service_role
JWT before any external demo.
