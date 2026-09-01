# Small-family comparison brief

Date: 2026-09-01
Decision scope: comparison lines only. This brief does not change any sealed evidence or approval record.

## How to read the citations

Each byte span is an absolute UTF-8 span in the canonical agreement text. The first byte is included and the last byte is excluded. Each citation points to the M4 evidence file that verifies the quoted source bytes.

| Deal | M4 evidence file |
|---|---|
| Concho | `evidence/canonical-v2/stage-2y-structure-migration/shadow/m4/1d6bba9ac993f72340d048742f995eb515a50cdfadb9bc86b3f36847baed9116.agreement-analysis.json` |
| Metsera | `evidence/canonical-v2/stage-2y-structure-migration/shadow/m4/f783c4cdcaca4626c695d1c2c67924ccd8867eb066e16f17407ca64497ba778c.agreement-analysis.json` |
| Red Hat | `evidence/canonical-v2/stage-2y-structure-migration/shadow/m4/06ec301641939fe0ac6e6ba598a33b40f16b1acc3ffb29109c7227b14bf1025a.agreement-analysis.json` |
| Skechers | `evidence/canonical-v2/stage-2y-structure-migration/shadow/m4/08fd217ea2561699fd43cb6c75ee26c358c018084956322c92e1e19d7ecce154.agreement-analysis.json` |
| SkyWater | `evidence/canonical-v2/stage-2y-structure-migration/shadow/m4/b74ed1f02f2e1385121b187cb0bb6dd8144ff18449149b6cf20182eede0eb363.agreement-analysis.json` |
| TopBuild | `evidence/canonical-v2/stage-2y-structure-migration/shadow/m4/3888fa7618bbd9fd6530b657aaa18c7e85ff515acf80edb1fc78a190af86e9cb.agreement-analysis.json` |

Distinct deal count means that a deal is counted once for a proposed line, even if the source has more than one row for that line.

## 1. Dividends

### What V1 displays

V1 has no dedicated Dividends table. Its nearest row is **Dividends and Distributions** in the interim-operating table. That row concerns restrictions on declaring or paying dividends. It does not show the separate covenant to coordinate dividend dates.

### What V2 found

| Bucket | Sealed rows | Distinct deals |
|---|---:|---:|
| Dividend coordination | 1 | 1 |

### Proposed comparison line

| Comparison line | Distinct deals | What to compare |
|---|---:|---|
| Dividend coordination | 1 | Whether the parties must coordinate record and payment dates to prevent a double or missed quarterly dividend |

### Operative clause

Concho, section 6.21, bytes `[263811,264197)` in the Concho M4 evidence:

> Parent and the Company shall each coordinate their record and payment dates for their regular quarterly dividends to ensure that the holders of Company Common Stock shall not receive two (2) dividends, or fail to receive one (1) dividend, in any quarter with respect to their Company Common Stock and the Parent Common Stock that such holders receive in exchange therefor in the Merger.

### Rendered row example

| Line | Deal | Result |
|---|---|---|
| Dividend coordination | Concho | Present. Parent and Company coordinate quarterly dividend record and payment dates. |

### Question for Ben

Does your approval of this single Dividend coordination line stand on this source-backed brief?

## 2. Material Adverse Effect definition

### What V1 displays

V1 displays five familiar rows: **Definition prongs**, **MAE Test**, **Carve-outs**, **Disproportionality relationships**, and **Exceptions to carve-outs**.

### What V2 found

| Bucket | Sealed rows | Distinct deals |
|---|---:|---:|
| Definition instance | 1 | 1 |
| Exclusion | 1 | 1 |
| Disproportionality carveback | 1 | 3 |
| Underlying-cause restoration | 1 | 1 |

The four sealed rows collect the relevant clauses for their deals. They are not four individual clause extractions.

### Proposed comparison lines

Keep V1's five-line presentation. The one Definition instance supplies both the Definition prongs and MAE Test lines.

| Comparison line | Distinct deals | V2 source |
|---|---:|---|
| Definition prongs | 1 | Definition instance |
| MAE Test | 1 | Definition instance |
| Carve-outs | 1 | Exclusion |
| Disproportionality relationships | 3 | Disproportionality carveback |
| Exceptions to carve-outs | 1 | Underlying-cause restoration |

### Operative clauses

**Definition prong.** Red Hat, section 8.03(l), bytes `[243381,243552)` in the Red Hat M4 evidence:

> result in a material adverse effect on the business, assets, properties, financial condition or results of operations of the Company and its Subsidiaries, taken as a whole

**MAE Test.** Red Hat, section 8.03(l), bytes `[243561,243710)` in the Red Hat M4 evidence:

> prevent, materially impede or materially delay the consummation by the Company of the Merger or the other transactions contemplated by this Agreement

**Carve-out.** Metsera, section 9.03, bytes `[242770,242875)` in the Metsera M4 evidence:

> (C) changes after the date hereof in applicable Law or GAAP (or the authoritative interpretation thereof)

**Disproportionality relationship.** TopBuild, section 3.1, bytes `[52246,53017)` in the TopBuild M4 evidence:

> (A) changes or developments in economic, business or labor conditions generally in the United States or other countries in which the Company or any of its Subsidiaries conduct operations, including (1) any changes or developments in or affecting the securities, credit or financial markets, (2) any changes or developments in or affecting interest, currency or exchange rates, commodity prices, tariffs, anti-dumping or countervailing duties, surtaxes or any trade wars or (3) the effect of any potential or actual government shutdown, except to the extent such changes or developments have a disproportionate effect on the Company and its Subsidiaries, taken as a whole, relative to others in the industry or industries in which the Company and its Subsidiaries operate;

**Exception to a carve-out.** TopBuild, section 3.2, bytes `[138262,138625)` in the TopBuild M4 evidence:

> any failure by Parent to meet any internal or public projections, forecasts or estimates of revenues or earnings for any period; provided that the exception in this clause shall not prevent or otherwise affect a determination that any change or development underlying such failure constitutes, has resulted in, or contributed to, a Parent Material Adverse Effect;

### Rendered row example

| Line | Deal | Result |
|---|---|---|
| MAE Test | Red Hat | Business-effects test plus a separate test for preventing, materially impeding or materially delaying the deal |

### Question for Ben

Should V2 keep V1's five MAE comparison lines, with the single Definition instance supplying both Definition prongs and MAE Test?

## 3. Guaranty

### What V1 displays

V1 has no dedicated Guaranty comparison table. Its deal-level fallback is **Buyer type**, shown as Take-private or Strategic. That field can be informed by guaranty and equity-commitment language, but it does not compare guaranty clauses.

### What V2 found

| Bucket | Sealed rows | Distinct deals |
|---|---:|---:|
| Performance guaranty | 5 | 2 |

All five rows are already in the same bucket. Three are from Skechers and two are from Red Hat. One row has a direct M4 claim. The other four preserve complete source provisions that M4 did not separately classify.

### Proposed comparison line

| Comparison line | Distinct deals | What to compare |
|---|---:|---|
| Performance guaranty | 2 | Presence by deal, with the named guarantor where the evidence supplies it |

### Operative clause

Skechers, section 4.13, bytes `[198103,198267)` in the Skechers M4 evidence:

> Parent and Merger Sub have delivered a duly executed guaranty from 3G Fund VI, L.P., a Cayman Islands exempted limited partnership (“Guarantor”) to the Company.

### Rendered row example

| Line | Deal | Result |
|---|---|---|
| Performance guaranty | Skechers | Present. Named guarantor: 3G Fund VI, L.P. |

### Question for Ben

Is one Performance guaranty comparison line, with a per-deal presence field, the right cut?

## 4. Appraisal and dissenters' rights

### What V1 displays

V1 has no standalone Appraisal table. It shows **Appraisal rights** as a field in Consideration and **Dissenting Shares Threshold** as a field in Closing Conditions.

### What V2 found

| Bucket | Sealed rows | Distinct deals |
|---|---:|---:|
| Withdrawal and reconversion | 3 | 3 |
| Settlement consent | 2 | 2 |

The five rows cover three distinct deals in total.

### Proposed comparison line

| Comparison line | Distinct deals | Fields inside the line |
|---|---:|---|
| Appraisal / dissenters' rights | 3 | Settlement consent; withdrawal or loss of rights; resulting conversion treatment |

This follows Ben's direction to use one bucket. It also preserves the useful field-within-line approach from V1.

### Operative clauses

**Settlement consent.** Skechers, section 2.7, bytes `[83734,84098)` in the Skechers M4 evidence:

> The Company may not, except with the prior written consent of Parent, make any payment with respect to any demands for appraisal or settle or offer to settle, or approve the withdrawal of, any such demands or waive any failure to timely deliver a written demand for appraisal or otherwise to comply with Section 262 of the DGCL or agree to do any of the foregoing.

**Withdrawal and reconversion.** SkyWater, section 1.6, bytes `[28358,28923)` in the SkyWater M4 evidence:

> provided, however, that if any such Person shall fail to perfect, withdraw or otherwise lose the right to appraisal under Section 262 of the DGCL, or if a court of competent jurisdiction shall determine that such Person is not entitled to the relief provided by Section 262 of the DGCL, then such Appraisal Shares shall thereupon be deemed, as of the Effective Time, to have been converted into, and to represent only the right to receive, the Merger Consideration as provided in Section 1.4, without interest thereon and in accordance with the terms of Article II.

### Rendered row example

| Line | Deal | Settlement control | Lost or withdrawn rights |
|---|---|---|---|
| Appraisal / dissenters' rights | Skechers | Parent's prior written consent is required | Shares convert to the Cash Election Consideration, subject to the stated mixed-election route |

### Question for Ben

Should Appraisal remain one comparison line, with settlement consent and withdrawal or reconversion shown as fields inside it?

## 5. Financing Covenants

### What V1 displays

V1 has no dedicated Financing Covenants table. Its closest display is the Financing row in General Covenants: **Financing cooperation required**, **Financing cooperation scope**, and **Breach is a closing condition**. V1 also has a **Financing / Sufficient Funds** closing-condition field, but that is not the same as a no-financing-condition acknowledgment.

### What V2 found

| Bucket | Sealed rows | Distinct deals |
|---|---:|---:|
| Payoff | 2 | 1 |
| Obtain financing | 2 | 2 |
| No financing condition | 1 | 1 |

The five rows cover three distinct deals in total.

### Proposed comparison lines

| Comparison line | Distinct deals | Fields inside the line |
|---|---:|---|
| Payoff | 1 | Draft lead time; final executed payoff lead time |
| Obtain financing | 2 | Efforts standard; financing type; obligor |
| No financing condition | 1 | Presence of the acknowledgment |

### Operative clauses

**Payoff, draft timing.** Concho, section 6.17, bytes `[251938,252018)` in the Concho M4 evidence:

> at least three (3) Business Days prior to the Closing Date a draft payoff letter

**Payoff, final timing.** Concho, section 6.17, bytes `[252025,252171)` in the Concho M4 evidence:

> at least one (1) Business Day prior to the Closing Date, a payoff letter that has been executed by the applicable agent for the lenders thereunder

**Obtain financing.** TopBuild, section 4.17, bytes `[328496,329129)` in the TopBuild M4 evidence:

> Parent shall use its reasonable best efforts to take, or cause to be taken, all actions and do, or cause to be done all things reasonably necessary, proper or advisable to obtain the Debt Financing on or prior to the Closing Date in an amount required to pay the Required Amount (after taking into account any other Financing, if any, and any available cash and cash equivalents of Parent and the Company), on the terms and conditions described in the Commitment Letter (including the related “flex” provisions), including using reasonable best efforts to enforce its rights and exercise any remedies under the Commitment Letter.

**No financing condition.** Skechers, section 6.6, bytes `[283065,283304)` in the Skechers M4 evidence:

> each of Parent and Merger Sub understands and acknowledges and agrees that obtaining the Financing is not a condition to the obligations of the parties to consummate the Merger in accordance with the terms and provisions of this Agreement.

### Rendered row example

| Line | Deal | Draft payoff | Final payoff |
|---|---|---|---|
| Payoff | Concho | At least 3 business days before closing | Executed payoff at least 1 business day before closing |

### Question for Ben

Should Payoff, Obtain financing, and No financing condition be three comparison lines, with draft and final timing kept as fields inside Payoff?

## 6. Consideration

### What V1 displays

V1 has a dedicated Consideration table. The relevant rows are **Consideration type**, **Per-share consideration**, and **Appraisal rights**.

### What V2 found

| Bucket | Sealed rows | Distinct deals |
|---|---:|---:|
| Cash component | 3 | 2 |
| Appraisal link | 4 | 4 |

**Cash component** is the bucket. **Per-share cash consideration** is the name of a fact extracted inside that bucket, not a second bucket.

### Proposed comparison line

| Comparison line | Distinct deals | Fields inside the line |
|---|---:|---|
| Cash component | 2 | Fixed cash per share; cash-election amount; mixed-election cash amount |

Keep Appraisal status as a link to the single Appraisal / dissenters' rights line. This avoids showing the same legal topic twice. The link has evidence in four deals.

### Operative clauses

**Fixed cash consideration.** Red Hat, section 2.01, bytes `[15969,16275)` in the Red Hat M4 evidence:

> Each share of Company Common Stock issued and outstanding immediately prior to the Effective Time (other than (i) Canceled Shares, (ii) Dissenting Shares, and (iii) Subsidiary Converted Shares) shall be converted into the right to receive $190.00 in cash, without interest (the “Merger Consideration”).

**Cash election.** Skechers, section 2.7, bytes `[78598,78957)` in the Skechers M4 evidence:

> each share of Company Common Stock with respect to which an election to receive only cash (a “Cash Election”) has been validly made and not revoked, deemed revoked or lost (“Cash Election Shares”) shall be converted into the into the right to receive cash in an amount equal to $63.00, without interest thereon (the “Cash Election Consideration”);

**Mixed-election cash component.** Skechers, section 2.7, bytes `[78963,79492)` in the Skechers M4 evidence:

> each share of Company Common Stock with respect to which an election to receive a mixture of cash and Parent Units (a “Mixed Election”) has been validly made and not revoked, deemed revoked or lost (“Mixed Election Shares”) shall be converted into the right to receive (1) an amount in cash equal to $57.00 (the “Mixed Election Cash Consideration”) and (2) one Parent Unit (the “Mixed Election Equity Consideration” and together with the Mixed Election Cash Consideration, the “Mixed Election Consideration”);

**Appraisal link.** Skechers, section 2.7, bytes `[81881,82071)` in the Skechers M4 evidence:

> Holders of Dissenting Company Shares will be entitled to receive payment of the appraised value of such Dissenting Company Shares in accordance with the provisions of Section 262 of the DGCL

### Rendered row example

| Line | Deal | Cash election | Mixed election cash component |
|---|---|---|---|
| Cash component | Skechers | $63.00 per share | $57.00 per share plus one Parent Unit |

### Question for Ben

Should Cash component be the only Consideration comparison line in this sealed slice, with Appraisal status linked to the Appraisal line instead of shown as a second Consideration line?
