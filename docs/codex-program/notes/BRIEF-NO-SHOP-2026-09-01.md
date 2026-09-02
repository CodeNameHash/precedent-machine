# No-shop comparison brief

Date: 2026-09-01
Decision scope: comparison-line grouping and one family-ownership decision only. This brief does not change any sealed evidence or approval record.

A sealed row is one approved Work3 claim record. A field is a fact shown inside a comparison line. Distinct deal count means that a deal is counted once for a proposed line, even if the source has more than one row for that line.

## How to read the citations

Each byte span is an absolute UTF-8 span in the canonical agreement text. The first byte is included and the last byte is excluded. Each operative-clause citation points to an M4 evidence file that verifies the quoted source bytes.

| Deal | M4 evidence file |
|---|---|
| Concho | `evidence/canonical-v2/stage-2y-structure-migration/shadow/m4/1d6bba9ac993f72340d048742f995eb515a50cdfadb9bc86b3f36847baed9116.agreement-analysis.json` |
| Metsera | `evidence/canonical-v2/stage-2y-structure-migration/shadow/m4/f783c4cdcaca4626c695d1c2c67924ccd8867eb066e16f17407ca64497ba778c.agreement-analysis.json` |
| Modiv | `evidence/canonical-v2/stage-2y-structure-migration/shadow/m4/fb76ef57355bef7f05b3b8955f5f7da4f430964923fecce0c95156c6e0b04a5c.agreement-analysis.json` |
| Red Hat | `evidence/canonical-v2/stage-2y-structure-migration/shadow/m4/06ec301641939fe0ac6e6ba598a33b40f16b1acc3ffb29109c7227b14bf1025a.agreement-analysis.json` |
| Skechers | `evidence/canonical-v2/stage-2y-structure-migration/shadow/m4/08fd217ea2561699fd43cb6c75ee26c358c018084956322c92e1e19d7ecce154.agreement-analysis.json` |
| SkyWater | `evidence/canonical-v2/stage-2y-structure-migration/shadow/m4/b74ed1f02f2e1385121b187cb0bb6dd8144ff18449149b6cf20182eede0eb363.agreement-analysis.json` |
| TopBuild | `evidence/canonical-v2/stage-2y-structure-migration/shadow/m4/3888fa7618bbd9fd6530b657aaa18c7e85ff515acf80edb1fc78a190af86e9cb.agreement-analysis.json` |

The current row counts come from:

- `evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-no-shop-365-profile-inventory-review-packet-draft.json`
- `evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-no-shop-365-profile-inventory-disposition.json`
- `evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-work3-profile-package-no-shop.json`

## What V1 displays

V1 presents No-shop in this lawyer-facing order:

1. Go-Shop.
2. No-Shop Core Mechanics.
3. Fiduciary-Out / Engagement.
4. Acquisition Proposal definition.
5. Notice.
6. Matching Rights.
7. Superior Proposal.
8. Intervening Event.
9. Change of Recommendation.

Within Fiduciary-Out / Engagement, V1 separately displays the earlier
engagement standard and the later final-determination standard. Within Notice,
V1 separately displays notice timing and notice content. The notice-content
row can distinguish bidder identity, material terms and conditions, copies of
the proposal, a description of an unwritten proposal and later modifications.

The current Work3 package measures operative No-shop actions, exceptions,
controls, periods and recommendation-change mechanics. Acquisition Proposal,
Superior Proposal and Intervening Event definition facts link to Key Defined
Terms. That link does not imply complete V2 coverage. The sealed Key Defined
Terms package has Acquisition Proposal threshold rows but does not measure all
V1 transaction-type and exclusion fields. It has no Acceptable Confidentiality
Agreement definition row. Recommendation-change fee triggers link to
Termination Fee. Company termination for a Superior Proposal and buyer
termination for a no-solicit breach link to Termination. Intervening Event
termination also links to Termination and remains a coverage-verification item.
Vote standard belongs to Proxy / Meeting under Ben's 2026-09-01 decision.
Force-the-vote is a different fact. Proxy / Meeting also owns it under Ben's
2026-09-01 decision. No-shop supplies the recommendation-change cross-reference.
V1 also has a separate Qualifying Company Takeover Proposal row. Key Defined
Terms owns that definition. No-shop owns its use as the engagement gateway.

Go-shop mechanics, the separate notice fields and the separate final-determination
standard are not Work3 profile keys in this sealed package. They must remain
visible as V1 carry-forward lines until governed V2 rows measure them.
Force-the-vote remains visible through its Proxy / Meeting cross-family link
until that family measures it. The package does measure equal-information delivery and
Acceptable Confidentiality Agreement requirements as No-shop exception
prerequisites. Those governed rows stay in No-shop exceptions and may be linked
from Notice without being counted twice.

## What V2 found

All 365 rows are approved. All 365 still carry `LEGAL_GROUPING_REVIEW_REQUIRED`. The package has six populated classification bands across seven deals.

| Current V2 band | Rows | Distinct deals |
|---|---:|---:|
| Restriction | 247 | 7 |
| Engagement permission | 5 | 4 |
| Standstill | 18 | 7 |
| Recommendation change | 63 | 7 |
| Safe disclosure | 17 | 7 |
| Representative control | 15 | 7 |
| **Total** | **365** |  |

## Proposed comparison lines

The nine governed V2 lines below assign each sealed row to exactly one
lawyer-facing line. They do not, by themselves, preserve the full V1 surface.

| V1 group | Proposed line | Current V2 band | Sealed claim rows assigned | Rows | Distinct deals |
|---|---|---|---|---:|---:|
| No-Shop Core Mechanics | No-shop restriction | Restriction | `NO_SHOP_PROHIBITED_ACTION` | 126 | 7 |
| No-Shop Core Mechanics | Cease existing discussions | Restriction | `NO_SHOP_CEASE_ACTION` | 26 | 7 |
| No-Shop Core Mechanics | No-shop exceptions | Restriction | `NO_SHOP_EXCEPTION_PREREQUISITE` | 78 | 7 |
| No-Shop Core Mechanics | Standstill enforcement | Standstill | `NO_SHOP_STANDSTILL_ACTION` | 18 | 7 |
| No-Shop Core Mechanics | Representative control | Representative control | `NO_SHOP_REPRESENTATIVE_CONTROL_STANDARD` 13; `NO_SHOP_REPRESENTATIVE_BREACH_ATTRIBUTION` 2 | 15 | 7 |
| Fiduciary-Out / Engagement | Engagement standard | Engagement permission | `NO_SHOP_FIDUCIARY_ENGAGEMENT_STANDARD` | 5 | 4 |
| Matching Rights | Matching rights | Restriction | `NO_SHOP_INITIAL_MATCH_PERIOD_DAYS` 9; `NO_SHOP_SUBSEQUENT_MATCH_PERIOD_DAYS` 8 | 17 | 5 |
| Change of Recommendation | Board change right | Recommendation change | `NO_SHOP_RECOMMENDATION_CHANGE_ACTION` 32; `NO_SHOP_RECOMMENDATION_CHANGE_TRIGGER` 16; `NO_SHOP_RECOMMENDATION_CHANGE_FIDUCIARY_STANDARD` 15 | 63 | 7 |
| Change of Recommendation | Safe disclosures / Not a Change of Recommendation | Safe disclosure | `NO_SHOP_RECOMMENDATION_SAFE_DISCLOSURE` | 17 | 7 |
|  | **Total** |  |  | **365** |  |

Three V1 carry-forward lines complete the current No-shop-owned surface without
inventing V2 values:

| V1 group | Carry-forward line | V1 fields | Current V2 state |
|---|---|---|---|
| Go-Shop | Go-shop | `goShopPresent`; `goShopPeriodDays`; `goShopWindow`; `goShopExcludedParties`; `extendedNegotiatingPeriodDays` | No Work3 Go-shop profile. Keep V1 visible and show V2 as not yet measured. |
| Notice | Notice and information delivery | `discussionInitiationNoticePresent`; `discussionInitiationNoticeHours`; `discussionInitiationNoticeText`; `noticePeriod`; `noticeContent`, including identity, material terms, copies, unwritten descriptions and updates | One Work3 exception row requires initial-proposal notice, but it does not measure the V1 notice clock or content fields. Keep those V1 values visible. Link the governed equal-information prerequisite rows without assigning them twice. |
| Fiduciary-Out / Engagement | Final determination standard | `fiduciaryFinalStandard`, the later standard for determining that the proposal is a Superior Proposal before a recommendation change or termination | No dedicated Work3 final-determination profile key. Recommendation-change actions, triggers and fiduciary-duty standards are only partial proxies. Keep V1 visible and show V2 as not yet measured. |

The corrected No-shop-owned comparison surface therefore has twelve lines:
nine governed V2 lines and three V1 carry-forward lines. Force-the-vote remains
visible as a linked Proxy / Meeting line.

The following V1 rows remain visible through cross-family links. A linked row
does not reassign or duplicate its V2 evidence.

| V1 No-shop row | V2 owner | Current coverage |
|---|---|---|
| Force-the-vote | Proxy / Meeting | Ben assigned the owner on 2026-09-01. Neither sealed package measures whether the meeting duty survives a recommendation change. Keep the V1 value visible pending Proxy / Meeting extraction. No-shop supplies the recommendation-change cross-reference. |
| Acquisition Proposal definition, transaction types, exclusions and threshold | Key Defined Terms | Threshold rows exist. The remaining displayed definition components require V2 extraction. |
| Qualifying Company Takeover Proposal definition | Key Defined Terms | V1 separately shows whether the proposal could lead to a Superior Proposal and the Board's good-faith qualifying determination. No sealed Key Defined Terms profile measures this definition. Its use as the engagement gateway remains in No-shop. |
| Superior Proposal threshold, test and determiner | Key Defined Terms | Linked to the sealed Superior Proposal profiles. |
| Intervening Event definition, scope and exceptions | Key Defined Terms | Linked to the sealed definition and exclusion profiles. The operative board-change right remains in No-shop. |
| Acceptable Confidentiality Agreement definition | Key Defined Terms | No sealed profile measures the definition. Keep the V1 field visible pending extraction. The agreement requirement itself is already governed under No-shop exceptions. |
| Company termination for Superior Proposal | Termination | Linked to `SUPERIOR_PROPOSAL_RIGHT`. |
| Buyer termination for no-solicit breach | Termination | Linked to `NO_SOLICITATION_BREACH_RIGHT`. |
| Intervening Event termination | Termination | Owner fixed by subject matter. Exact V2 coverage remains to be verified. |
| Recommendation-change fee triggers | Termination Fee | Linked to Termination Fee. |

The proposed field folds are:

- Representative breach attribution is a field inside Representative control.
- Representative-control fields include the governing standard, attributed breach and any breach conditions.
- No-shop exceptions include the confidentiality-agreement requirement and equal-information delivery prerequisites. Notice links to those rows but does not duplicate them.
- Standstill enforcement includes enforcement, release and waiver actions, don't-ask-don't-waive treatment and anti-clubbing conditions.
- Initial and subsequent match periods are fields inside Matching rights.
- Matching rights also carries the amendment or material-improvement condition that restarts the shorter period when that condition is present in the source row.
- Recommendation-change actions, triggers and fiduciary standards are fields inside Board change right.
- Board change right includes any public-reaffirmation deadline carried by the underlying recommendation-change action.
- Safe disclosures include tender-offer, legally required and factually accurate communications and their conditions.
- A dedicated engagement-standard row stays in Engagement standard. An engagement threshold already stored as an exception prerequisite stays in No-shop exceptions. This prevents double counting.
- Final determination standard stays separate from both Engagement standard and Board change right. It is the later proposal-qualification standard and must not be inferred from either proxy.

## Operative clauses

### No-shop restriction

Skechers, section 5.3, bytes `[221616,221724)` in the Skechers M4 evidence:

> participate or engage in discussions or negotiations with any Person with respect to an Acquisition Proposal

### Cease existing discussions

Skechers, section 5.3, bytes `[222684,222876)` in the Skechers M4 evidence:

> immediately cease, any and all discussions or negotiations that existed on or prior to the date of this Agreement with any parties conducted heretofore with respect to any Acquisition Proposal

### No-shop exceptions

Metsera, section 5.02, bytes `[163639,163973)` in the Metsera M4 evidence:

> so long as the Company also provides Parent, prior to or within twenty-four (24) hours following the time such information is provided or made available to such Person, in accordance with the terms of the Confidentiality Agreement, any non-public information furnished to such other Person which was not previously furnished to Parent

### Standstill enforcement

Red Hat, section 4.02, bytes `[130374,130640)` in the Red Hat M4 evidence:

> The Company shall not modify, amend or terminate, or waive, release or assign, any provisions of, any confidentiality or standstill agreement (or any similar agreement) to which the Company or any of its Subsidiaries is a party relating to any such Takeover Proposal

### Representative control

Red Hat, section 4.02, bytes `[131779,132063)` in the Red Hat M4 evidence:

> it shall instruct and cause each applicable Subsidiary, if any, to instruct each such director, officer, employee, investment banker, attorney, accountant or other advisor or representative of the Company or any of its Subsidiaries (collectively, “Company Representatives”) not to

Concho, section 6.3, bytes `[177254,177319)` in the Concho M4 evidence supplies the proposed attribution field:

> shall be deemed to be a breach of this Section 6.3 by the Company

### Engagement standard

Skechers, section 5.3, bytes `[225623,225744)` in the Skechers M4 evidence:

> such Acquisition Proposal either constitutes a Superior Proposal or is reasonably expected to lead to a Superior Proposal

### Matching rights

Modiv, section 5.6, bytes `[268972,269072)` in the Modiv M4 evidence supplies the initial period:

> three (3) Business Day period following Parent’s receipt of the Notice of Change of Recommendation

Modiv, section 5.6, bytes `[270550,270661)` in the Modiv M4 evidence supplies the subsequent period:

> reduced to two (2) Business Days following receipt by Parent of any such new Notice of Change of Recommendation

### Board change right

SkyWater, section 5.3, bytes `[216415,216602)` in the SkyWater M4 evidence supplies an action:

> withdraw, modify or qualify, or propose publicly to withdraw, modify or qualify, in any manner adverse to Parent, the approval of this Agreement, the Mergers or the Company Recommendation

Skechers, section 5.3, bytes `[229072,229251)` in the Skechers M4 evidence supplies an Intervening Event trigger:

> the Company Board may effect a Company Board Recommendation Change in response to any material event or development or material change in circumstances with respect to the Company

Red Hat, section 4.02, bytes `[141804,142025)` in the Red Hat M4 evidence supplies a fiduciary standard:

> the failure to make such Adverse Recommendation Change or to so terminate this Agreement in accordance with Section 7.01(f), as applicable, would be inconsistent with the directors’ fiduciary duties under applicable Law

### Safe disclosures / Not a Change of Recommendation

Modiv, section 5.6, bytes `[270813,270990)` in the Modiv M4 evidence:

> taking and disclosing to the Company’s stockholders a position contemplated by Rule 14e-2(a) or Rule 14d-9 or Item 1012(a) of Regulation M-A promulgated under the Exchange Act

## Fiduciary and board-change coverage check

The V1 coverage ledger records **Fiduciary and board-change standards** as `OPEN, VERIFY AT BRIEF`. The source check gives this result:

| V1 concept | Verified current coverage | Result |
|---|---|---|
| Engagement standard | Five dedicated rows cover Modiv, Red Hat, Skechers and TopBuild. Concho bytes `[168340,168595)` and SkyWater bytes `[211976,212263)` are exact M4 evidence edges for `NO_SHOP_EXCEPTION_PREREQUISITE` and contain their engagement thresholds. | Metsera remains unmeasured. |
| Final determination standard and Superior Proposal board-change trigger | The package has 32 recommendation-change action rows and 16 trigger rows. Each of the seven deals has at least one trigger row. | Metsera has only an `INTERVENING_EVENT` trigger row. Its separate Superior Proposal final-determination phrase remains unmeasured. |
| Board-change fiduciary standard | Fifteen dedicated rows cover six deals. | Modiv remains unmeasured. |

The V1 notice-content row is also confirmed. It is rendered from
`noticeContent` and decomposes the clause into lawyer-facing content pills.
The sealed Work3 package has no dedicated notice-content profile key, so this
is a confirmed V2 extraction gap rather than an intentional omission.

## V1 fields not yet measured

These are confirmed extraction gaps from the ledger's No-shop verification
item. `OPEN` means that the current sealed Work3 evidence does not measure the
cited comparison fact. It does not mean that the agreement is silent.

| V1 field or concept | Direct source evidence | M4 check | Owner family | Status |
|---|---|---|---|---|
| Go-shop availability and mechanics | V1 renders `goShopPresent`, `goShopPeriodDays`, `goShopWindow`, `goShopExcludedParties` and `extendedNegotiatingPeriodDays` in `components/review/table-configs/nosol-section.config.js`. | No Go-shop profile in the sealed 365-row package. | `NO_SHOP` | OPEN |
| Notice initiation, content and copy-delivery detail | V1 renders the initiation-notice clock and `noticeContent` as distinct rows. Content decomposes identity, material terms, copies, unwritten descriptions and updates in `components/review/table-configs/nosol-fiduciary.config.js`. | One exception profile requires initial-proposal notice. No profile measures `discussionInitiationNoticeHours`, `noticePeriod` or the notice-content fields. | `NO_SHOP` | OPEN |
| Final determination standard as its own comparison fact | V1 renders `fiduciaryFinalStandard` separately from `fiduciaryEngageStandard` in `components/review/table-configs/nosol-fiduciary.config.js`. | No dedicated Work3 final-determination profile key. Existing recommendation-change rows are partial proxies only. | `NO_SHOP` | OPEN |
| Force-the-vote | V1 renders `forceTheVote`, `forceTheVoteDetails` and `forceTheVoteType` as a distinct row. | Neither the No-shop nor Proxy / Meeting sealed package measures survival of the meeting duty after a recommendation change. | `PROXY_MEETING` | OWNER SET; EXTRACTION OPEN |
| Acquisition Proposal transaction types and exclusions | V1 displays definition components as well as the percentage threshold. | The sealed Key Defined Terms package measures Acquisition Proposal thresholds but not all V1 transaction-type and exclusion fields. | `KEY_DEFINED_TERMS` | OPEN |
| Qualifying Company Takeover Proposal definition | V1 separately displays whether a proposal could lead to a Superior Proposal and the Board's good-faith qualifying determination. | The sealed Key Defined Terms package has no dedicated profile for this definition. No-shop retains the separate operative engagement gateway. | `KEY_DEFINED_TERMS` | OPEN |
| Acceptable Confidentiality Agreement definition | V1 displays `acceptableConfidentialityAgreementDefinition` beside the other No-shop defined terms. | The No-shop package measures the agreement requirement. The sealed Key Defined Terms package has no profile for the definition itself. | `KEY_DEFINED_TERMS` | OPEN |
| Metsera engagement standard | M2 agreement index, section 5.02, bytes `[162935,163223)`, SHA-256 `7763bf2bd577d39aa62432c6b10bcb35e5fd634fb803ad0dbed22e73fb95ed40` | No overlapping M4 evidence edge; zero Metsera `NO_SHOP_FIDUARY_ENGAGEMENT_STANDARD` rows | `NO_SHOP` | OPEN |
| Metsera final determination standard and Superior Proposal board-change trigger | M2 agreement index, section 5.02, bytes `[169687,170003)`, SHA-256 `7da280762e63d47b35cdacfc1cc0f0c561221feee7318ed291a6f6038000aff0` | No overlapping M4 evidence edge for the quoted determination; Metsera's only `NO_SHOP_RECOMMENDATION_CHANGE_TRIGGER` value is `INTERVENING_EVENT` | `NO_SHOP` | OPEN |
| Modiv board-change fiduciary standard | M2 agreement index, section 5.6, bytes `[267117,267262)`, SHA-256 `12ab1d1e0ed7142fdd63f771d8e719ee5fdda8526b59255818618e122827c365` | No overlapping M4 evidence edge; zero Modiv `NO_SHOP_RECOMMENDATION_CHANGE_FIDUCIARY_STANDARD` rows | `NO_SHOP` | OPEN |

Intervening Event termination is owned by Termination. The current sealed
Termination package has no dedicated Intervening Event termination subtype.
That fact remains `OPEN, VERIFY` before the linked V1 row can be retired.

The Metsera source file for both cited spans is `evidence/canonical-v2/stage-2y-structure-migration/shadow/m2/f783c4cdcaca4626c695d1c2c67924ccd8867eb066e16f17407ca64497ba778c.agreement-index.json`.

The Modiv source file is `evidence/canonical-v2/stage-2y-structure-migration/shadow/m2/fb76ef57355bef7f05b3b8955f5f7da4f430964923fecce0c95156c6e0b04a5c.agreement-index.json`.

**Metsera engagement standard:**

> the Company Board or a committee thereof acting with the full authority of the Company Board thereof reasonably determines, in good faith, after consultation with its outside counsel and financial advisor, constitutes or could reasonably be expected to lead to a Superior Company Proposal

**Metsera final determination standard:**

> if the Company Board determines, in good faith, after consultation with its outside counsel and financial advisor that such Company Takeover Proposal constitutes a Superior Company Proposal after giving effect to all of the adjustments of this Agreement that are offered in writing by Parent during the Notice Period

**Modiv board-change fiduciary standard:**

> the failure to take such action would reasonably be expected to be inconsistent with the duties of the Company’s directors under applicable Law

## Rendered row examples

| Line | Deal | Result |
|---|---|---|
| Matching rights | Modiv | Initial period: 3 business days. Subsequent period: 2 business days. |
| Board change right | Skechers | Trigger shown inside the line: material event, development or material change in circumstances concerning the Company. |
| Representative control | Concho | Breach attribution shown inside the line: representative breach is deemed a Company breach. |

## Questions for Ben

### 1. No-shop grouping

Do you approve the corrected twelve-line No-shop-owned surface: nine governed
V2 comparison lines that map all 365 sealed rows exactly once, plus the
separate V1 carry-forward lines for Go-shop, Notice and information delivery,
and Final determination standard? Force-the-vote remains visible through the
linked Proxy / Meeting line.

### 2. Vote-standard owner

**Decision (Ben, 2026-09-01):** Proxy / Meeting owns Vote standard as one
stored fact.

### 3. Force-the-vote owner

**Decision (Ben, 2026-09-01):** Proxy / Meeting owns Force-the-vote because the
stored fact is whether the meeting obligation survives a recommendation
change. No-shop supplies the recommendation-change reference only.
