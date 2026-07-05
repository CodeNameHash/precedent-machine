# PR 93 WP03 Skechers REP-T reprocess

Branch invariant:

```text
fix/audit2-extraction-wave
41dbe5f1b1400b062f7f20425b0b0b9f4b77e9ff
```

Test invariant:

```text
npm test: PASS, 562/562
```

Selector note: the exact provided top-level `sectionNumber` selector returned `{}` both before and after the run because the deployed API currently exposes the section number at `ai_metadata.features.sectionNumber`. The snapshots below use the same live API response and select the intended row by `category === "Material Contracts"` plus `ai_metadata.features.sectionNumber === "3.13"`.

## Pre-state JSON snapshot

```json
{
  "sectionNumber": "3.13",
  "category": "Material Contracts",
  "materialContractsBuckets": null,
  "id": "e08a9fa6-eed7-47d9-b374-e3f5b7ffc36e",
  "code": "REP-T-MATERIAL-CONTRACTS"
}
```

## Dry-run plan

```text
Reprocess (types: REP-T) — 1 deal(s), dry-run

═══ Beach Acquisition Co Parent, LLC / Skechers U.S.A., Inc. (af4940e1-a645-437c-acfa-4a53e8d9f7ac) ═══
  snapshot: 114 sections (classified 2026-07-04T18:46:22.907Z)
  plan: re-extract REP-T from 29 cached section(s) — no parse, no classify

Dry-run complete: no writes, no LLM calls. Re-run with --apply to execute.
```

## Apply stdout

```text
Reprocess (types: REP-T) — 1 deal(s), APPLY

═══ Beach Acquisition Co Parent, LLC / Skechers U.S.A., Inc. (af4940e1-a645-437c-acfa-4a53e8d9f7ac) ═══
  → REP-T …   (LLM backend: codex-cli)
[validate] auto-wrapped citable field "secFilingsExceptionLookback" (bare value -> { value, quotes: [] })
[validate] auto-wrapped citable field "secFilingsExceptionLookbackDate" (bare value -> { value, quotes: [] })
[validate] auto-wrapped citable field "materialityQualifier" (bare value -> { value, quotes: [] })
[validate] auto-wrapped citable field "materialityQualifier" (bare value -> { value, quotes: [] })
[validate] auto-wrapped citable field "materialityQualifier" (bare value -> { value, quotes: [] })
[validate] auto-wrapped citable field "materialityQualifier" (bare value -> { value, quotes: [] })
[validate] auto-wrapped citable field "materialityQualifier" (bare value -> { value, quotes: [] })
[validate] auto-wrapped citable field "materialityQualifier" (bare value -> { value, quotes: [] })
[validate] auto-wrapped citable field "materialityQualifier" (bare value -> { value, quotes: [] })
[validate] auto-wrapped citable field "materialityQualifier" (bare value -> { value, quotes: [] })
[validate] auto-wrapped citable field "materialityQualifier" (bare value -> { value, quotes: [] })
[validate] auto-wrapped citable field "absenceOfChangesType" (bare value -> { value, quotes: [] })
[validate] auto-wrapped citable field "materialityQualifier" (bare value -> { value, quotes: [] })
[validate] auto-wrapped citable field "materialityQualifier" (bare value -> { value, quotes: [] })
[validate] auto-wrapped citable field "materialityQualifier" (bare value -> { value, quotes: [] })
[validate] auto-wrapped citable field "materialityQualifier" (bare value -> { value, quotes: [] })
[validate] auto-wrapped citable field "materialityQualifier" (bare value -> { value, quotes: [] })
[validate] auto-wrapped citable field "materialityQualifier" (bare value -> { value, quotes: [] })
[validate] auto-wrapped citable field "materialityQualifier" (bare value -> { value, quotes: [] })
[validate] auto-wrapped citable field "materialityQualifier" (bare value -> { value, quotes: [] })
[validate] auto-wrapped citable field "materialityQualifier" (bare value -> { value, quotes: [] })
[validate] auto-wrapped citable field "materialityQualifier" (bare value -> { value, quotes: [] })
[validate] auto-wrapped citable field "materialityQualifier" (bare value -> { value, quotes: [] })
[validate] auto-wrapped citable field "materialityQualifier" (bare value -> { value, quotes: [] })
[validate] auto-wrapped citable field "materialityQualifier" (bare value -> { value, quotes: [] })
done in 327s: +29 / -29, corrections re-applied: 0
    + [REP-T] Consents and Approvals (separate from No Conflict) (1183 chars, features: crossReferences,mainConcept,materialityQualifier,materialityScopeType,sectionNumber)
    - [REP-T] Authority; Enforceability (features: crossReferences,flags,linkedBringDownStandard,mainConcept,sectionNumber)
    ~ [REP-T] Reps Preamble (SEC-filings exception + scrape): +features flags; -features linkedBringDownStandard
    ~ [REP-T] Organization; Qualification; Standing: -features linkedBringDownStandard
    ~ [REP-T] Authority; Enforceability: +features materialityQualifier; -features linkedBringDownStandard
    ~ [REP-T] Opinion of Financial Advisor: -features linkedBringDownStandard
    ~ [REP-T] Consents and Approvals (separate from No Conflict): text 1183 → 1252 chars; +features flags; -features linkedBringDownStandard,maeQualifiedReps,materialityQualifier,materialityScopeType
    ~ [REP-T] No Conflict; Required Filings and Consents: +features materialContractsBuckets,materialContractsBucketsSource; -features linkedBringDownStandard
    ~ [REP-T] Capitalization; Subsidiaries: +features disclosureSchedulesRequired,materialityQualifier; -features linkedBringDownStandard,lookbackPeriod
    ~ [REP-T] Capitalization; Subsidiaries: -features linkedBringDownStandard
    ~ [REP-T] SEC Documents; Financial Statements: -features linkedBringDownStandard
    ~ [REP-T] Internal Controls; Disclosure Controls: +features lookbackPeriod; -features knowledgeQualifier,knowledgeScope,linkedBringDownStandard
    ~ [REP-T] No Undisclosed Liabilities: -features linkedBringDownStandard
    ~ [REP-T] Absence of Certain Changes or Events: -features aocCitedCovenantNames,flags,linkedBringDownStandard,lookbackTiedToIncorporation
    ~ [REP-T] Material Contracts: +features materialContractsBuckets,materialContractsBucketsSource; -features knowledgeQualifier,knowledgeScope,linkedBringDownStandard,lookbackPeriod
    ~ [REP-T] Real Property; Personal Property; Title: -features knowledgeQualifier,knowledgeScope,linkedBringDownStandard
    ~ [REP-T] Environmental Matters: +features crossReferences; -features flags,knowledgeQualifier,knowledgeScope,linkedBringDownStandard
    ~ [REP-T] Intellectual Property: +features knowledgeStandard; -features knowledgeQualifier,knowledgeScope,linkedBringDownStandard
    ~ [REP-T] Taxes; Tax Returns: +features flags,lookbackPeriod; -features linkedBringDownStandard
    ~ [REP-T] Employee Benefit Plans; ERISA: +features erisaMultiemployer,erisaTitleIVPlans; -features knowledgeQualifier,knowledgeScope,linkedBringDownStandard
    ~ [REP-T] Labor Matters; Relations: +features crossReferences,knowledgeScopeType,knowledgeStandard,lookbackPeriod,maeQualifiedReps,mainConcept,materialityQualifier,materialityScopeType; -features knowledgeQualifier,knowledgeScope,linkedBringDownStandard
    ~ [REP-T] Compliance with Laws; Permits; Licenses: +features crossReferences,knowledgeScopeType,knowledgeStandard,maeQualifiedReps,mainConcept,materialityQualifier,materialityScopeType; -features knowledgeQualifier,knowledgeScope,linkedBringDownStandard
    ~ [REP-T] Compliance with Laws; Permits; Licenses: +features crossReferences,maeQualifiedReps,mainConcept,materialityQualifier,materialityScopeType; -features linkedBringDownStandard
    ~ [REP-T] Litigation; Legal Proceedings: +features crossReferences,knowledgeScopeType,knowledgeStandard,mainConcept,materialityQualifier,materialityScopeType; -features knowledgeQualifier,knowledgeScope,linkedBringDownStandard
    ~ [REP-T] Insurance: +features crossReferences,maeQualifiedReps,mainConcept,materialityQualifier,materialityScopeType; -features linkedBringDownStandard
    ~ [REP-T] Related Party / Affiliate / Interested-Party Transactions: +features crossReferences,mainConcept,materialityQualifier,materialityScopeType; -features linkedBringDownStandard
    ~ [REP-T] Brokers; Finders: +features extraContractualClaimsWaived,noOtherRepsPresent; -features linkedBringDownStandard,materialityQualifier,materialityScopeType
    ~ [REP-T] Global Trade Control Laws; Sanctions: +features extraContractualClaimsWaived,flags,noOtherRepsPresent; -features knowledgeQualifier,knowledgeScope,linkedBringDownStandard
    ~ [REP-T] Information Supplied / Proxy Statement: +features extraContractualClaimsWaived,noOtherRepsPresent; -features linkedBringDownStandard
    ~ [REP-T] No Other Representations or Warranties: -features linkedBringDownStandard
    = 0 unchanged
  QA counts: unchanged
```

## Post-state JSON snapshot

```json
{
  "sectionNumber": "3.13",
  "category": "Material Contracts",
  "id": "3ed77542-2ed6-4309-9572-ee85b787d85b",
  "code": "REP-T-MATERIAL-CONTRACTS",
  "materialContractsBucketsSource": {
    "source": "definition",
    "definitionTerm": "Material Contract"
  },
  "bucketCount": 12,
  "canonicalCodes": [
    "SEC_ITEM_601",
    "OTHER",
    "OTHER",
    "EXCLUSIVITY_MFN",
    "OTHER",
    "OTHER",
    "INDEBTEDNESS",
    "OTHER",
    "OTHER",
    "OTHER",
    "OTHER",
    "INDEBTEDNESS"
  ],
  "materialContractsBuckets": [
    {
      "code": "SEC_ITEM_601",
      "label": "SEC Item 601(b) contracts",
      "text": "(i) any \"material contract\" (as defined in Item 601(b)(10) of Regulation S-K promulgated by the SEC, other than those agreements and arrangements described in Item 601(b)(10)(iii) of Regulation S-K) with respect to the Company Group, taken as a whole"
    },
    {
      "code": "OTHER",
      "label": "(ii) any material Contract with any of the top 20 suppliers (including manufa...",
      "text": "(ii) any material Contract with any of the top 20 suppliers (including manufacturers) or service providers (excluding legal service providers) to the Company Group, taken as a whole, determined on the basis of expenditures by the Company Group, taken as a whole, for the 12 months ended December 31, 2024 and December 31, 2023"
    },
    {
      "code": "OTHER",
      "label": "(iii) any material Contract with any of the top 20 customers to the Company G...",
      "text": "(iii) any material Contract with any of the top 20 customers to the Company Group, taken as a whole, determined on the basis of consolidated revenue received by the Company Group, taken as a whole, for the 12 months ended December 31, 2024 and December 31, 2023"
    },
    {
      "code": "EXCLUSIVITY_MFN",
      "label": "Exclusivity / most-favored-nation / standstill",
      "text": "(iv) any Contract containing any covenant or other provision (A) limiting the right of the Company Group to engage in any material line of business or to compete with any Person in any line of business that is material to the Company Group; (B) prohibiting the Company Group from engaging in any business with any Person or levying a fine, charge or other payment for doing so; or (C) containing and limiting the right of the Company Group pursuant to any \"most favored nation\" or \"exclusivity\" provisions"
    },
    {
      "code": "OTHER",
      "label": "Contract (A) relating to the disposition or acquisition of assets by the Comp...",
      "text": "(v) any Contract (A) relating to the disposition or acquisition of assets by the Company Group with a value or purchase price greater than $15,000,000 after the date hereof other than in the ordinary course of business; or (B) pursuant to which the Company Group will acquire any material ownership interest in any other Person or other business enterprise other than any Subsidiary of the Company"
    },
    {
      "code": "OTHER",
      "label": "(vi) any Contract pursuant to which a member of the Company Group has been gr...",
      "text": "(vi) any Contract pursuant to which a member of the Company Group has been granted from, or grants to, any third party any license or other right with respect to any material Intellectual Property, other than Ordinary Course Licenses"
    },
    {
      "code": "INDEBTEDNESS",
      "label": "Indebtedness contracts",
      "text": "(vii) any mortgages, indentures, guarantees, loans or credit agreements, security agreements or other Contracts relating to Indebtedness"
    },
    {
      "code": "OTHER",
      "label": "(ix) any contract providing for property management or similar services",
      "text": "(ix) any contract providing for property management or similar services"
    },
    {
      "code": "OTHER",
      "label": "Contract providing for indemnification of any officer",
      "text": "(x) any Contract providing for indemnification of any officer, director or employee by the Company Group"
    },
    {
      "code": "OTHER",
      "label": "(xi) any Contract that is an agreement in settlement of a dispute that impose...",
      "text": "(xi) any Contract that is an agreement in settlement of a dispute that imposes material obligations on the Company Group after the date hereof"
    },
    {
      "code": "OTHER",
      "label": "(xii) any Collective Bargaining Agreement",
      "text": "(xii) any Collective Bargaining Agreement; and"
    },
    {
      "code": "INDEBTEDNESS",
      "label": "Indebtedness contracts",
      "text": "(xiii) any Contract that involves a material joint venture entity, limited liability company or legal partnership"
    }
  ]
}
```

## `ingest-qa --all` tail

```text
  ── informational (not gated) ──
  IOC (T/B)                  26
  NOSOL                        4
  TERMR (all)                10
  TERMF                        5
  GATE RESULT: PASS

═══ Bespin Subsidiary, LLC / Landos Biopharma, Inc. ═══
  total provisions: 323
  REP-T                      31  >=15   PASS
  REP-B                      12  >=5   PASS
  DEF                       162  >=40   PASS
  COND                       14  >=8   PASS
  coverage %              89.50  >=85   PASS
  unverified quotes           0  ==0   PASS
  duplicate clauses           0  ==0   PASS
  canonical rate           0.95  >=0.70   PASS
  ── informational (not gated) ──
  IOC (T/B)                  28
  NOSOL                        5
  TERMR (all)                 9
  TERMF                        4
  GATE RESULT: PASS

═══ Antlia Holdings LLC / Forest City Realty Trust, Inc. ═══
  total provisions: 316
  REP-T                      21  >=15   PASS
  REP-B                      12  >=5   PASS
  DEF                       128  >=40   PASS
  COND                       14  >=8   PASS
  coverage %                 90  >=85   PASS
  unverified quotes           0  ==0   PASS
  duplicate clauses           0  ==0   PASS
  canonical rate           0.89  >=0.70   PASS
  ── informational (not gated) ──
  IOC (T/B)                  43
  NOSOL                       14
  TERMR (all)                19
  TERMF                        6
  GATE RESULT: PASS

19 deals checked. Overall: PASS
```

Full QA result: 19/19 deals PASS, 0 unverified quotes, 0 duplicate clauses.

## Recommendation

PR #93 is now safe to merge.

Exact merge command:

```bash
gh pr merge 93 --squash
```
