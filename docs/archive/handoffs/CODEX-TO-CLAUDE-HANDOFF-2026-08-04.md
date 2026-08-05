# Exact working location and authority boundary

Branch: `codex/m3-production-phase1`. Worktree:
`/Users/bengoodchild/Documents/Claude/precedent-machine-m3-production-phase1`.

**Production authority is NONE.** Since 2026-08-05, building and activating
routes locally and on Vercel preview deployments is permitted. Everything
else stays prohibited regardless of that carve-out:

- production activation of any route;
- accessing or changing production data;
- using real credentials or a real production database client;
- running extraction or a model replay against live sources;
- importing candidate data;
- executing the v1 reclassification apply (only "go, fixtures first" is
  authorised; the execution act itself is not);
- issuing a freeze, policy-adoption, successor-M1 PASS, M3 PASS,
  deployment, or production receipt.

A fresh session must not infer more authority than this from anything
below, or from anywhere else.

---

# Codex-to-Claude handoff, 2026-08-04 (superseded)

This document has been superseded. Its content has been folded into
`docs/codex-program/MASTER-PLAN.md`, which is now the single, complete plan
from here to production.

Read `docs/codex-program/MASTER-PLAN.md` instead. This file is kept only
because other sessions and commit messages refer to it by path.
