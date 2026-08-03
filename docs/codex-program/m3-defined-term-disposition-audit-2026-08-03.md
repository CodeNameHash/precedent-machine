# M3 defined-term disposition audit

Date: 2026-08-03

Status: OPEN. This audit does not approve a concept. It records the current
corpus, the proposed owner, and the minimum shape needed before promotion.

## Method

The audit used a read-only census of production `provision_cards` where
`provision_type = DEFINITION`. The census returned 5,731 cards. Counts below
are cards / distinct deals. The audit also checked the M3 family designs and
the current Review, Query, Compare and market projection code.

The dispositions mean:

- `GOVERNED`: an existing native family owns the legal fact. A definition
  card can provide evidence, but Key Defined Terms must not publish a second
  claim for the same fact.
- `OPEN_WORLD`: retain exact bytes. Do not publish a controlled fact until
  the concept, variants and consumer are approved.
- `DERIVED`: do not create a standalone market claim. Build a reference,
  entity, calendar or interpretation relationship from governed evidence.
- `RETIRED`: the v1 subtype is a mixed bucket or wrong owner. Keep the source
  card for audit, but never use the subtype as a v2 concept.

## Recurring and material populations

| v1 population | Count | Disposition | Reason and required exact shape |
| --- | ---: | --- | --- |
| `DEF-GENERAL` | 2,715 / 40 | RETIRED | This is a heterogeneous catch-all. It includes GAAP, Closing, Intellectual Property, fee terms, confidentiality terms and hundreds of deal-specific names. Keep `defined_term_ref`, exact head/body quotes, definition kind, cross-reference target and owner hint. Route each term by content and consumer. Never govern `DEF-GENERAL` itself. |
| null subtype | 457 / 12 | RETIRED | The rows mix real definitions, inline parentheticals, proposed fee cards and extraction fragments. Preserve the same neutral definition envelope as `DEF-GENERAL`. Require content-based reclassification before any legal claim. |
| `DEF-EQUITYAWARD` | 271 / 37 | GOVERNED | Consideration and employee/equity-treatment families own award treatment. Preserve award term, instrument type, plan reference, time/performance status, share class and treatment-formula reference. A pure award definition is supporting evidence, not a second Key Terms claim. |
| `DEF-LAW` | 269 / 33 | DERIVED | These terms define reference universes, such as Exchange Act, HSR Act and Environmental Law. Preserve named statutes, jurisdiction, successor wording, included legal instruments and exclusions. Build a definition/reference relationship when a governed fact uses the term. Do not compare the raw universe as one market value. |
| `DEF-GOVAUTH` | 150 / 36 | DERIVED | SEC, DOJ, FTC, IRS and broader Governmental Authority formulations identify entities and entity classes. Preserve named bodies, jurisdiction, successor wording, court/arbitrator inclusion and exclusions. Resolve entity references. Do not create a freestanding market claim. |
| `DEF-CONTRACT` | 134 / 30 | OPEN_WORLD | Contract universes differ materially. Preserve instrument classes, binding standard, written/oral scope, leases/licences/order inclusion and exclusions. A future Contract-definition slice needs a consumer and a reviewed comparison model. |
| `DEF-BENEFITPLAN` | 126 / 35 | OPEN_WORLD | Plan universes vary by ERISA status, jurisdiction, current/former worker scope and exclusions. Preserve plan classes, sponsor/group scope, covered persons, statutory references and exclusions. Employee Matters owns operative covenants, not this definition universe. |
| `DEF-INDEBTEDNESS` | 123 / 31 | OPEN_WORLD | The financing design identifies this as definition-graph territory. Preserve debt categories, guarantees, leases, hedging, accrued amounts, payoff references and exclusions. Financing Covenants owns operative duties, but does not own this universe today. |
| `DEF-MERGERCONSID` | 108 / 30 | GOVERNED | Consideration owns amounts, exchange ratios, CVRs and security treatment. Preserve consideration form, per-security amount or ratio, components, adjustments, CVR reference and affected share class. Pure cross-references are derived links. |
| `DEF-INTERP` | 79 / 32 | DERIVED | These are interpretation operators, such as including, through, writing, date rules and plural rules. Preserve operator kind, exact operands, temporal rule and scope. Apply only through a governed interpretation relationship. Never publish the whole subtype as one fact. |
| `DEF-AFFILIATE` | 77 / 33 | DERIVED | Affiliate is an entity relationship. Preserve direct/indirect control, control definition, ownership threshold, common-control limb and exclusions. Resolve parties and relationships without flattening different control tests. |
| `DEF-SUBSIDIARY` | 69 / 34 | DERIVED | Subsidiary is an entity relationship. Preserve voting/equity threshold, direct/indirect control, partnership/JV treatment and exclusions. Do not assume every formulation means more than 50 per cent. |
| `DEF-MAE` | 68 / 37 | GOVERNED | The MAE family owns prongs, carve-outs, disproportionate-impact carvebacks and clinical variants. Key Defined Terms must emit nothing for these definitions. |
| `DEF-PERSON` | 63 / 37 | DERIVED | Person definitions define entity classes. Preserve included classes, governmental-body treatment and exclusions. Use the result for entity resolution. Do not publish a market statistic for the list. |
| `DEF-TAX` | 62 / 27 | OPEN_WORLD | Tax Matters owns operative tax covenants, but its design leaves Tax definitions to a definition family. Preserve tax types, governmental charges, interest/penalties, jurisdiction, withholding and exclusions. A dedicated Tax-definition shape is required. |
| `DEF-DISCLOSURELETTER` | 61 / 39 | DERIVED | This identifies a disclosure artefact and its relationship to the agreement. Preserve party, artefact name, date/version, delivery mechanism and schedule exception rule. Use it to bind evidence and exceptions. |
| `DEF-COMPANYEMPLOYEE` | 58 / 32 | OPEN_WORLD | Employee Matters owns operative benefits covenants. The defined population still varies by employment status, time, entity group, location and exclusions. Preserve those attributes before deciding whether a reusable employee-population relationship is needed. |
| `DEF-ACQPROPOSAL` | 56 / 32 | OPEN_WORLD | Concept scope is not approved. Variants include Acquisition Proposal, Takeover Proposal, Acquisition Transaction and adjacent confidentiality/alternative-agreement drift. Preserve term name, transaction form, equity/assets/revenue/earnings basis, comparator, percentage, party, written/bona-fide qualifiers and exclusions. Never collapse multi-basis limbs. |
| `DEF-PERMIT` | 56 / 32 | OPEN_WORLD | Permit universes vary by authority, licence class, environmental status and materiality. Preserve permit classes, issuing authority, regulated subject, materiality qualifier and exclusions. Representations own operative permit assertions, not the universe itself. |
| `DEF-COMPANY` | 51 / 22 | DERIVED | These are party, group and security aliases. Preserve entity identity, group members, security class and temporal context. Resolve identity. Do not create a separate legal-market claim. |
| `DEF-REQUIREDAPPROVAL` | 51 / 18 | DERIVED | Approval definitions are reference sets. Preserve approval type, authority, filing/consent form, threshold and cross-reference target. Link them to antitrust, conditions or representation claims through an approved relationship. |
| `DEF-REPRESENTATIVE` | 45 / 29 | DERIVED | Representative definitions identify covered actors. Preserve actor classes, relationship to principal, financing-source inclusion and exclusions. Use the result for party/actor scope. |
| `DEF-BUSINESSDAY` | 37 / 36 | DERIVED | Formulations differ by holidays, bank or agency opening, jurisdiction and cut-off. Preserve excluded weekdays/holidays, jurisdiction, institution/opening test and cut-off. A day-kind default does not prove the definition. Pure cross-references remain unresolved until a definition graph exists. |
| `DEF-TAXRETURN` | 37 / 33 | OPEN_WORLD | Tax Return universes vary by return type, information statement, amendment, election, schedule and jurisdiction. Preserve each included document class and exclusion. Tax Matters does not currently govern the definition. |
| `DEF-SUPERIOR` | 37 / 25 | OPEN_WORLD | Concept scope is not approved. Preserve term variant, host proposal term, absolute or substituted threshold form, each basis, from/to operands, financial-favourability test, completion-likelihood test, board process and all-or-substantially-all form. Do not calculate an effective threshold from a substitution. |
| `DEF-KNOWLEDGE` | 36 / 32 | OPEN_WORLD | Concept scope is not approved. Preserve party, actual/constructive/after-inquiry standard, inquiry duty, named people, schedule source, title class and mixed-source limbs. Split dual-party and mixed-source definitions. Do not emit `NA`. |
| `DEF-PERMITLIEN` | 34 / 31 | OPEN_WORLD | Permitted-lien definitions are exception universes. Preserve category, amount/materiality threshold, release timing, priority/non-impairment test, tax status and exclusions. Property and contract representations own operative assertions. |
| `DEF-LIEN` | 27 / 26 | OPEN_WORLD | Lien definitions vary by security-interest classes and exclusions. Preserve included encumbrance types, title exceptions, statutory liens and exclusions. Do not merge with Permitted Liens. |
| DEFINITION rows labelled `REP-T-BENEFITS` | 27 / 26 | RETIRED | These are wrong-owner labels inside the definitions article. Route genuine benefit-plan definitions to `DEF-BENEFITPLAN`; route operative representation text to Representations. |
| `DEF-MATCONTRACT` | 26 / 13 | OPEN_WORLD | Material Contracts owns contract categories and thresholds in operative representations. Preserve the defined term, category universe, thresholds, party, filing status and exclusions. Do not duplicate an operative Material Contracts claim. |
| `DEF-WILLFUL` | 26 / 26 | OPEN_WORLD | Concept scope is not approved. Preserve the exact term variant, including Willful Breach, Willful and Material Breach, Intentional Breach and line-wrapped forms. Preserve act/omission, materiality, causation, actual or constructive knowledge, reasonable-expectation standard, inquiry deeming and failure-to-cure language. |
| `DEF-INTERVENING` | 25 / 17 | OPEN_WORLD | Concept scope is not approved. Preserve party-specific term, occurrence/development type, timing, unknown/unforeseeable test, magnitude exception and each exclusion. Do not take no-shop notice or match periods. |
| DEFINITION rows labelled `NOSOL-SUPERIOR` | 21 / 21 | RETIRED | The label collides with procedural no-shop cards under another provision type. Preserve Superior Proposal and Superior Offer variants, then reclassify by definition content. Composite `(provision_type, provision_subtype)` mapping is mandatory. |
| DEFINITION rows labelled `NOSOL-ACQPROPOSAL` | 20 / 20 | RETIRED | Same collision. Preserve Acquisition Proposal and Takeover Proposal variants. Do not map the subtype alone to a no-shop procedure or a definition concept. |
| `DEF-MADE-AVAILABLE` | 19 / 15 | OPEN_WORLD | This interpretive term can change disclosure and knowledge risk. Preserve access channel, data-room or filing source, cut-off time, accessibility standard, notice and exclusions. It needs a dedicated interpretation consumer. |
| `DEF-DISSENTING` | 16 / 15 | RETIRED | The Appraisal design treats definition-article text as an echo, not a second operative fact. Preserve statute, holder/share status, perfection and withdrawal wording as evidence. Appraisal owns the operative mechanics. |
| DEFINITION rows labelled `NOSOL-INTERVENING` | 15 / 15 | RETIRED | Same provision-type collision. Preserve exact Intervening Event variants and reclassify by content. No-shop owns procedure. A future approved definition concept would own the definition body. |
| DEFINITION rows labelled `REP-T-TAX` | 15 / 15 | RETIRED | Tax Matters identifies these as a v1 mislabel. Route genuine definitions to `DEF-TAX`; route representation text to Representations. |
| `DEF-ORDINARY` | 12 / 10 | OPEN_WORLD | The design identifies two different shapes: an interpretation clause and a standalone definition. Preserve term form, ordinary-course standard, past-practice period, consistency qualifier, exceptions and consent overlay. Do not promote until the two shapes have separate grounding. |

## Lower-count owner and contamination groups

These groups have fewer than 12 cards. They still matter because the label
shows a different owner or a classification defect.

- `DEF-BURDENSOME` 8 / 7 and DEFINITION `ANTI-BURDEN` 2 / 2: GOVERNED by
  Antitrust. Preserve burden-term alias, remedy/action categories, business
  or asset scope, quantitative cap and MAE-relative formulation.
- `DEF-DISSENTING` is covered above. DEFINITION `COV-APPRAISAL` 2 / 2 is
  RETIRED as a definition label and routed to Appraisal after content review.
- `COV-MARKETING` 3 / 3: GOVERNED by Financing Covenants for the Marketing
  Period construct. Preserve term, start/stop conditions, document
  requirements, blackout periods and extension rules.
- `CONSID-CONVERT` 8 / 8, `CONSID-EQUITY` 7 / 7,
  `CONSID-EXCHANGE-RATIO` 3 / 3 and `CONSID-EXCHANGE` 2 / 2: GOVERNED by
  Consideration. Definition rows are evidence or cross-reference links.
- `TERMR-OUTSIDE` 8 / 8: GOVERNED by Termination Rights. Preserve deadline
  term and extension relationship. Do not use the DEFINITION row as a
  second right grant.
- `REP-T-IP` 9 / 9, `REP-T-SANCTIONS` 8 / 6 and all other `REP-*` labels:
  RETIRED as definition labels. Route a genuine definition to an open
  definition universe, or operative text to Representations.
- `COV-LITNOTIFY` 8 / 8, `COV-PAYAGENT` 10 / 10, `COV-FINANCING` 6 / 6,
  `COV-PROXY` 4 / 4, `COV-DO` 1 / 1, `COV-DEBT` 1 / 1 and `COV-CVR` 1 / 1:
  RETIRED as definition concepts. Route operative facts to their covenant
  owner. Retain exact cross-reference links.
- `STRUCT-CLOSING` 7 / 7 and `STRUCT-MERGER` 6 / 6: GOVERNED by Merger
  Structure for operative mechanics. Definition rows provide identity and
  cross-reference evidence only.
- `MISC-GOVLAW` 6 / 6 and `MISC-AMEND` 1 / 1: RETIRED as definition
  concepts. Route operative boilerplate to Miscellaneous. Preserve an
  Applicable Law definition under `DEF-LAW` semantics.
- `ANTI-FILING` 1 / 1 and `ANTI-EFFORTS` 1 / 1: RETIRED as definition
  labels. Route by content to Antitrust or to an open defined standard.
- `COND-M-REG` 1 / 1 and `COND-M-S4` 1 / 1: RETIRED as definition labels.
  Conditions owns the operative state. Preserve the approval or document
  cross-reference.
- `DEF-ENVIRONMENTAL-CLAIMS` 4 / 4: OPEN_WORLD. Preserve claim type,
  environmental medium, law/permit relationship, release/exposure event and
  exclusions. Environmental representations own operative assertions.
- Remaining one-off oil, well, real-property, funds, equity and insurance
  labels are RETIRED as Key Defined Terms concepts. Their exact definitions
  remain open evidence or derived relationships for the owning family.

## Product-output ruling

The product must not render all 5,731 definition cards as a flat Key Terms
table. It must expose three distinct outputs:

1. Approved comparable facts. These are controlled values from an approved
   definition concept and resolver.
2. Definition relationships. These bind a term to an entity, source,
   calendar, owner or cross-reference. They are derived and are not market
   statistics.
3. Exact definition evidence. This is searchable open-world text for every
   unapproved or deal-specific term.

Review, Query, Compare and market may use output 1. Review and Query may use
output 2. Exact-text search and source detail may use output 3. Compare and
market must not aggregate outputs 2 or 3 as if they were controlled values.

## Remaining decisions before Key Defined Terms can close

1. Approve the initial comparable concept set after reviewing this complete
   owner and variant inventory. The five scaffolded concepts remain
   proposals, not ratified taxonomy.
2. Decide whether Tax, Contract, Benefit Plan, Company Employee, Permit,
   Permitted Lien, Lien, Material Contract, Made Available and Ordinary
   Course need later comparable slices or only exact-text search.
3. Approve one neutral definition-envelope and one definition-relationship
   contract. These are needed to keep the long tail without turning
   `DEF-GENERAL` into a concept.
4. Approve migration rules for retired and mistagged v1 subtypes. The rules
   must use `(provision_type, provision_subtype)` plus content review.
5. Decide the data-hygiene disposition of the empty
   `definition_components` table. Do not make it authoritative merely
   because its schema resembles the proposed envelope.

