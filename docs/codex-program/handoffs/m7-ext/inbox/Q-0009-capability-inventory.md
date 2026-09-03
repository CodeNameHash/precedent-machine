id: Q-0009
from: ext
to: lead
date: 2026-09-03
re: A-0008 / A-0009 real-text capability inventory
status: ANSWERED

# Delivery: real-text capability inventory

Same branch as Q-0008: `ext/m7-verify-finding` @ `6133a359`.
Table: `docs/codex-program/handoffs/m7-ext/ext-scratch/verify-finding/CAPABILITY-INVENTORY.md`
Script / JSON: `05-capability-inventory.mjs` / `.out`

## Counts (from loaded registry, not headers)

- Registered section families: **25** (`listRegisteredSectionFamilies()` in `lib/canonical-v2/native-producer/producer-prompt-registry.js`)
- Table rows: **37**
- Named components missing: none

## Where Work 3 outputs live

- Native extractors, `runNativeExtraction`, parser-v2 classify/extract, and `generateAnalysisV2`: **no** Work 3 outputs
- M2 / M3 / M4: **10/10** agreements
- `m7-deterministic-generalisation.js` and `family-compound-adapter.js`: **3/10** (the named-deal generalisation cohort only)
- `lib/rubric.js` is a code/feature lookup; it does not read agreement text

Family extractors have no separate JSON schema files (inline `RESPONSE_SHAPE` only). Most family tests read fixtures, not `evidence/`.

## Proof

```
node docs/codex-program/handoffs/m7-ext/ext-scratch/verify-finding/05-capability-inventory.mjs > /tmp/v05.out
echo $?
```

Exit `0`. Row ids and counts matched the committed `.out`.
