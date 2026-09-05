# Q-0013: synthetic V2 serving path

Read on `ext/m7-verify-finding` (file identical to `origin/codex/recover-m7-20260812` at `bb04be20`). Line cites are that file.

## Verdict

**CONFIRMED.** `lib/canonical-v2/termination-rights-review-serving-source.js` runs `generateAnalysisV2` on a 49-byte synthetic canonical string and attaches the result to five real production deal IDs on the review-cards API when a preview/local gate is on. Production stays hard-off.

## The generator call

`buildRedHatTerminationRightsReviewSource` (lines 323–338) calls `generateAnalysisV2(RED_HAT_GENERATOR_INPUT)` (line 328). The input comes from `__fixtures__/canonical-v2/red-hat-termination-rights-serving.generated.js`.

Measured from that fixture (not from a header):

- `source_binding.canonical_text` is exactly 49 UTF-8 bytes: `shall Company and Parent familytermination all_of`
- one claim
- first profile matcher token includes a family-marker token (`familyantitrustregulatory` on the loaded profile set; the source text itself contains `familytermination`)

Five production deal UUIDs all use that same builder (lines 347–353):

| Constant | Deal id | Lines |
| --- | --- | ---: |
| `RED_HAT_DEAL_ID` | `2b9a6571-6fe7-4aac-931d-a96ab227ea43` | 34, 348 |
| `METSERA_DEAL_ID` | `885edae5-49e8-464a-9f33-edd229119d7c` | 35, 349 |
| `SKECHERS_DEAL_ID` | `af4940e1-a645-437c-acfa-4a53e8d9f7ac` | 36, 350 |
| `SKYWATER_DEAL_ID` | `13894e33-b5b6-4412-96bb-940b841d5130` | 38, 351 |
| `CONCHO_DEAL_ID` | `a267309a-fc22-4160-a652-1144fc64e9cf` | 39, 352 |

After compile, `patchPreviewTerminationAnalysis` (246–264) relabels TERMINATION profiles onto deal-specific subtype paths so review assembly can show rights that the fixture compiler did not emit.

## Caller

`pages/api/review/[id]/cards.js` lines 54–67: after dark-bridge preview and termination-fee serving, it `await attachCanonicalTerminationRightsReview(...)`. Cache-Control becomes `private, no-store` when the attachment ran (`terminationRightsReviewCacheControl`, serving-source 688–696).

## Gate (default off; production denied)

`isCanonicalV2TerminationRightsReviewServingEnabled` (110–116) requires:

1. own-property `CANONICAL_V2_TERMINATION_RIGHTS_REVIEW_SERVING` === `ENABLED_LOCAL_PREPRODUCTION` (29–32)
2. `isPermittedCanonicalV2Runtime` (`lib/canonical-v2/feature-flags.js` 25–31): `VERCEL_ENV === 'preview'`, or no Vercel runtime and `NODE_ENV !== 'production'`

Unset env → off. `VERCEL_ENV=production` → off even if the sentinel is set. `attachCanonicalTerminationRightsReview` (679–685) returns the deal unchanged when the gate is off.

## Other paths that can present V2-derived content to a user

| Path | Gate | Production default |
| --- | --- | --- |
| Termination-rights review attach (`cards.js` → this module) | `CANONICAL_V2_TERMINATION_RIGHTS_REVIEW_SERVING=ENABLED_LOCAL_PREPRODUCTION` and preview/local runtime | off |
| Termination-fee serving (`termination-fee-serving-source.js` 97–103; `cards.js` 64) | `CANONICAL_V2_TERMINATION_FEE_SERVING=ENABLED_LOCAL_PREPRODUCTION` and same runtime allowlist | off |
| Dark-bridge preview (`review-preview-assembly.js`; `cards.js` 54) | `CANONICAL_V2_DARK_BRIDGE=ENABLED_LOCAL_PREPRODUCTION` plus `isPermittedCanonicalV2Runtime`; module claims `VALIDATED_NOT_SERVED` | off; not a serving authority |
| Review API / UI (`feature-flags.js` 33–40) | `CANONICAL_V2_REVIEW_ENABLED` / `NEXT_PUBLIC_CANONICAL_V2_REVIEW_ENABLED` plus runtime allowlist | off |
| Query API / UI (`feature-flags.js` 43–50; `pages/api/canonical-v2/*` via `serving-client.js`) | `CANONICAL_V2_QUERY_ENABLED` / `NEXT_PUBLIC_CANONICAL_V2_QUERY_UI_ENABLED` plus runtime allowlist | off |
| Process-pilot UI (`feature-flags.js` 55–57) | `CANONICAL_V2_PROCESS_PILOT_UI_ENABLED` and `VERCEL_ENV === 'preview'` only | off |

`generateAnalysisV2` is otherwise called from `agreement-analysis-consolidation.js` (not a user route) and from tests. No other production user route calls it.

## Quarantine

A merge of this branch does not turn the path on in production. It does mean any Vercel preview (or local non-production) that sets the termination-rights sentinel will show the 49-byte fixture compiler output on those five real deal IDs. Quarantine is needed before a preview with that env is treated as a real-text review, not before a production merge.
