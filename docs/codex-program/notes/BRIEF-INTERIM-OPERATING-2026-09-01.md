# Interim Operating comparison brief

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

## What V1 displays

V1 separates the Target and Parent provisions. Inside each party section, it shows these bands in order:

1. Affirmative covenants.
2. Exceptions.
3. Negative covenants.
4. Other restrictions.

A negative-covenant row has this shape:

**Party section → Covenant label → Specific restrictions | Exceptions**

For example, **Negative covenants, Target → Liens and encumbrances → Specific restriction: mortgage or pledge assets | Exception: Permitted Liens**.

V1 also has a 14-item vocabulary for the pills inside **Specific restrictions**. Those pills describe what a covenant restricts. They are not the names of the comparison lines.

| V1 specific-restriction vocabulary |
|---|
| Acquisitions / business combinations |
| Asset sales / divestitures / licenses |
| Merger / consolidation / liquidation / recapitalization |
| Indebtedness / financing |
| Guarantees / third-party obligations |
| Loans / advances / capital contributions |
| Capital expenditures |
| Litigation settlements |
| New material contracts |
| Contract amendments / terminations |
| Employee compensation / benefit increases |
| Real estate / leases |
| Intellectual property licenses / assignments |
| Other / unspecified |

## What V2 found

The sealed package has 113 rows. Every row is a restrictive covenant. The M4 evidence has the same 113 restrictions. No sealed row measures an affirmative covenant as its own line.

| Sealed bucket | Rows | Distinct deals |
|---|---:|---:|
| Restrictive covenant | 113 | 6 |
| Affirmative covenant | 0 | Not measurable from this sealed package |
| Standalone exception or qualification | 0 | Not measurable from this sealed package |

The party evidence assigns 105 rows to the Target and 8 rows to the Parent or buyer. It assigns no row to both parties. Exception wording can still appear inside a restrictive-covenant clause. The package does not extract that wording as a separate profile row.

## Proposed negative-covenant lines

These 16 lines map all 113 sealed rows. The labels use V1's existing covenant language. The deal names show the basis for each distinct deal count.

| Proposed line | Target rows | Parent or buyer rows | Total rows | Distinct deals | Deals |
|---|---:|---:|---:|---:|---|
| Accounting changes | 1 | 0 | 1 | 1 | TopBuild |
| Capital expenditures | 6 | 0 | 6 | 6 | Concho, Metsera, Red Hat, Skechers, SkyWater, TopBuild |
| Charter and bylaws | 7 | 1 | 8 | 6 | Concho, Metsera, Red Hat, Skechers, SkyWater, TopBuild |
| Compensation and benefits | 18 | 0 | 18 | 6 | Concho, Metsera, Red Hat, Skechers, SkyWater, TopBuild |
| Material contracts | 8 | 0 | 8 | 4 | Red Hat, Skechers, SkyWater, TopBuild |
| Indebtedness and loans | 18 | 1 | 19 | 6 | Concho, Metsera, Red Hat, Skechers, SkyWater, TopBuild |
| Dividends and distributions | 6 | 2 | 8 | 6 | Concho, Metsera, Red Hat, Skechers, SkyWater, TopBuild |
| Hiring and termination | 3 | 0 | 3 | 3 | Red Hat, SkyWater, TopBuild |
| Insurance | 2 | 0 | 2 | 2 | Metsera, Skechers |
| Intellectual property | 4 | 0 | 4 | 3 | Metsera, Skechers, SkyWater |
| Securities issuances | 7 | 2 | 9 | 6 | Concho, Metsera, Red Hat, Skechers, SkyWater, TopBuild |
| Liens and encumbrances | 1 | 0 | 1 | 1 | Skechers |
| Mergers and acquisitions | 4 | 2 | 6 | 5 | Concho, Metsera, Skechers, SkyWater, TopBuild |
| Equity repurchases | 1 | 0 | 1 | 1 | Red Hat |
| Litigation settlements | 2 | 0 | 2 | 1 | TopBuild |
| Tax matters | 17 | 0 | 17 | 5 | Concho, Metsera, Skechers, SkyWater, TopBuild |
| **Total** | **105** | **8** | **113** |  |  |

The sealed rows do not contain a separate asset-sale or disposition topic. The proposed **Mergers and acquisitions** line therefore does not claim that this slice measures dispositions.

Three proposed lines combine closely related source topics:

| Proposed line | Source topics combined | Row detail |
|---|---|---|
| Compensation and benefits | Benefit plans; collective bargaining; employee compensation | 4 + 5 + 9 = 18 |
| Indebtedness and loans | Indebtedness; loans, advances and investments | 14 + 5 = 19 |
| Mergers and acquisitions | Acquisitions and business combinations | 6 |

## Operative clauses for the material negative variants

### Accounting changes

TopBuild, section 4.1, bytes `[190575,190660)` in the TopBuild M4 evidence:

> make any material changes with respect to financial accounting policies or procedures

### Capital expenditures

Metsera, section 5.01, bytes `[156048,156204)` in the Metsera M4 evidence:

> make or agree to make any capital expenditure or expenditures that individually are in excess of $2,000,000 and in the aggregate are in excess of $2,500,000

### Charter and bylaws

TopBuild, section 4.1, bytes `[181441,181596)` in the TopBuild M4 evidence:

> adopt any amendments to the Charter or its bylaws or, in the case of any Subsidiary that is not a corporation, similar applicable organizational documents;

### Compensation and benefits

**Benefit plans.** Red Hat, section 4.01, bytes `[124909,125023)` in the Red Hat M4 evidence:

> adopt, establish, enter into, terminate, materially amend or modify any material Benefit Plan or Benefit Agreement

**Collective bargaining.** SkyWater, section 5.1, bytes `[199056,199229)` in the SkyWater M4 evidence:

> enter into any collective bargaining agreement or other agreement with any labor organization, works council, trade union, labor association or other employee representative

**Employee compensation.** Metsera, section 5.01, bytes `[150905,151044)` in the Metsera M4 evidence:

> grant to any director, employee or other service provider of the Company or any Company Subsidiary any increase in compensation or benefits

### Material contracts

TopBuild, section 4.1, bytes `[190886,191050)` in the TopBuild M4 evidence:

> amend any Company Material Contract or Company Real Property Lease in any material respect or terminate any Company Material Contract or Company Real Property Lease

### Indebtedness and loans

**Indebtedness.** Metsera, section 5.01, bytes `[154578,154764)` in the Metsera M4 evidence:

> incur, create, assume or otherwise become liable or responsible for, or amend or modify the terms of, any indebtedness for borrowed money, or guarantee any indebtedness of another Person

**Loans, advances and investments.** Red Hat, section 4.01, bytes `[121924,122072)` in the Red Hat M4 evidence:

> make any loans, advances or capital contributions to, or investments in excess of $5,000,000, individually or in the aggregate, in, any other person

### Dividends and distributions

TopBuild, section 4.1, bytes `[184182,184327)` in the TopBuild M4 evidence:

> declare, set aside or pay any dividend or other distribution, whether payable in cash, stock or other property, with respect to its capital stock

### Hiring and termination

Red Hat, section 4.01, bytes `[126388,126509)` in the Red Hat M4 evidence:

> hire any Company Personnel at the Vice President level or above or terminate the employment of any such Company Personnel

### Insurance

Metsera, section 5.01, bytes `[158854,159051)` in the Metsera M4 evidence:

> fail to use commercially reasonable efforts to maintain in effect material insurance policies covering the Company and each Company Subsidiary and their respective properties, assets and businesses

### Intellectual property

Skechers, section 5.2, bytes `[213680,213888)` in the Skechers M4 evidence:

> sell, assign, transfer, lease, license, sublicense, allow to lapse, abandon, grant a covenant-not-to-assert to a third party with respect to, or otherwise dispose of any material Company Intellectual Property

### Securities issuances

Red Hat, section 4.01, bytes `[118079,118221)` in the Red Hat M4 evidence:

> issue, deliver, sell, pledge or otherwise encumber any (A) shares of its capital stock, other equity or voting interests or Equity Equivalents

### Liens and encumbrances

Skechers, section 5.2, bytes `[212163,212315)` in the Skechers M4 evidence:

> mortgage or pledge any of its and its Subsidiaries’ assets, tangible or intangible, or create or incur any lien thereupon (other than Permitted Liens)

### Mergers and acquisitions

SkyWater, section 5.1, bytes `[195611,195765)` in the SkyWater M4 evidence:

> adopt a plan or agreement of complete or partial liquidation, dissolution, merger, consolidation, restructuring, recapitalization or other reorganization;

### Equity repurchases

Red Hat, section 4.01, bytes `[117009,117282)` in the Red Hat M4 evidence:

> purchase, redeem or otherwise acquire any shares of capital stock, other equity or voting interests or any other securities of the Company or any of its Subsidiaries or any options, restricted shares, warrants, calls or rights to acquire any such shares or other securities

### Litigation settlements

TopBuild, section 4.1, bytes `[189132,189544)` in the TopBuild M4 evidence:

> release, assign, compromise, pay, discharge, waive, settle, agree to settle, or satisfy any Action against the Company or any of its Affiliates or its or their respective directors, officers, managers, employees or agents (including any Action relating to this Agreement or the Transactions) or other rights, claims, liabilities or obligations (absolute, accrued, asserted or unasserted, contingent or otherwise)

### Tax matters

SkyWater, section 5.1, bytes `[205178,205349)` in the SkyWater M4 evidence:

> make, revoke or amend any material election relating to Taxes or change any of its Tax accounting periods, methods of Tax accounting or Tax procedures currently in effect;

## Affirmative-covenant band: current evidence gap

V1 can display 11 affirmative-covenant subparts. Ben's proposed structure keeps them as their own band. The present sealed package has no affirmative rows, so it cannot supply a valid deal count or source quote for any subpart. Each entry below is an unmeasured gap, not an absent covenant.

| Affirmative comparison line | Sealed rows | Distinct deals |
|---|---:|---|
| Maintain REIT qualification | 0 | Not measurable |
| Not impede regulatory approvals | 0 | Not measurable |
| Notify of customer/relationship issues | 0 | Not measurable |
| Comply with anti-corruption & sanctions laws | 0 | Not measurable |
| Comply with applicable laws | 0 | Not measurable |
| Maintain corporate existence & good standing | 0 | Not measurable |
| Maintain permits, franchises & authorizations | 0 | Not measurable |
| Maintain leases & material property | 0 | Not measurable |
| Retain officers & key employees | 0 | Not measurable |
| Preserve business organization & relationships | 0 | Not measurable |
| Conduct business in ordinary course | 0 | Not measurable |

The Exceptions and Other restrictions bands also have no standalone sealed rows in this slice. They should remain visible in the display. Their contents need a later source-backed measurement pass before a cross-deal count can be stated.

## Rendered row example

This is one real Target row derived from the Skechers sealed profile and its cited source clause:

| Party band | Covenant label | Specific restrictions | Exceptions |
|---|---|---|---|
| Negative covenants, Target | Liens and encumbrances | Mortgage or pledge assets, or create or incur a lien | Permitted Liens |

## Question for Ben

Are the Target and Parent bands, these 16 negative-covenant lines, and the separate affirmative-covenant band the cuts you would compare deals on, and what is missing?
