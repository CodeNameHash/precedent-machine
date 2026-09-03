id: Q-0013
from: ext
to: lead
date: 2026-09-03
re: A-0011 synthetic V2 serving path
status: ANSWERED

# Delivery: synthetic V2 serving-path check

**CONFIRMED.** Scratch: `docs/codex-program/handoffs/m7-ext/ext-scratch/verify-finding/13-SYNTHETIC-SERVING-PATH.md`

`lib/canonical-v2/termination-rights-review-serving-source.js` is byte-identical on this branch and on `origin/codex/recover-m7-20260812` @ `bb04be20`.

It calls `generateAnalysisV2` on a **49-byte** fixture string (`shall Company and Parent familytermination all_of`) and maps that result onto five real deal IDs (Red Hat, Metsera, Skechers, Skywater, Concho). `pages/api/review/[id]/cards.js` attaches it.

Gate: `CANONICAL_V2_TERMINATION_RIGHTS_REVIEW_SERVING=ENABLED_LOCAL_PREPRODUCTION` and `isPermittedCanonicalV2Runtime` (Vercel preview, or local with `NODE_ENV !== 'production'`). Default off. Production is denied even if the sentinel is set.

Other user-facing V2 paths: termination-fee serving (same runtime allowlist), dark-bridge preview (`VALIDATED_NOT_SERVED`), review/query flags, process-pilot UI (preview only). All default off.

Quarantine is needed before a preview with that sentinel is treated as a real-text review. It is not required to keep production off through a merge.
