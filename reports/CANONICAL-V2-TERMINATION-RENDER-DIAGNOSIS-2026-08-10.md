# Termination rendering diagnosis

This is a report-only diagnosis. It changes no production behaviour.

## Counting terms

An attempted item is a compiled candidate from the model run.

A resolved claim is an accepted legal fact.

An open-world item is retained evidence that has no approved claim type.

A review item is an item in the review queue. A resolved claim can also be in this queue. Thus, review totals must not be added to resolved totals.

A claim renders with content when its claim identifier is in the source card selected by a present Review row.

## Result

The supplied count of 79 does not reproduce from the six pinned runs and the current rendering code.

The exact current count is 49 resolved claims without row content. There are 91 resolved claims. There are 42 resolved claims in selected rows. The closest direct count to 79 is 78. This is the number of `TERMINATION_RIGHT_GRANT` claims. The evidence does not support changing 78 to 79.

| Deal | Attempted | Resolved | Open-world | Review total | Review unresolved | Rows with content | Resolved claims in rows | Resolved claims without rows |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Concho | 19 | 18 | 6 | 21 | 3 | 7 | 10 | 8 |
| Metsera | 21 | 12 | 10 | 15 | 3 | 6 | 8 | 4 |
| Red Hat | 22 | 11 | 8 | 18 | 7 | 6 | 6 | 5 |
| Skechers | 26 | 14 | 11 | 20 | 6 | 6 | 8 | 6 |
| SkyWater | 21 | 16 | 11 | 17 | 1 | 7 | 10 | 6 |
| TopBuild | 26 | 20 | 8 | 24 | 4 | 0 | 0 | 20 |
| Total | 135 | 91 | 54 | 115 | 24 | 32 | 42 | 49 |

The review queue has 115 items. Of these, 91 are the same accepted claims shown in the resolved count. Only 24 are unresolved review work.

## Exact causes

1. One Review row selects only the first card for a legal code. This hides 26 resolved claims. For example, two legal-restraint cards both use `TERMR-LEGAL`. The row selects one card. The other card has no row.

2. Three superior-proposal claims do not have a row in Termination Rights. The renderer deliberately sends this concept to the No-Shop section. These are Red Hat, Skechers and SkyWater.

3. TopBuild fails before it returns any cards. One accepted `TERMR-NOSOL-BREACH` claim has no title in the current projection map. The code puts `undefined` into the card. Canonical JSON rejects that value. This one claim blocks all 20 accepted claims and all eight eligible open-world items for TopBuild.

## Duplicate grants and excerpts

The six runs contain 34 pairs of claims for the same legal fact. These pairs contain 68 claims. Each pair has the same section, concept, definition, quote, canonical value and evidence excerpt. One member has `BUYER` capacity. The other has `TARGET` capacity.

This split was deliberate in the code that produced the evidence. The three producer commits state that an `EITHER_PARTY` right must create one Buyer claim and one Target claim. The current branch now creates one `EITHER_PRINCIPAL_PARTY` claim. Therefore, the evidence format and the current resolver rule do not match.

The duplicate pairs are:

| Concept | Fact pairs | Claims |
|---|---:|---:|
| Breach | 3 | 6 |
| Legal restraint | 9 | 18 |
| Mutual consent | 6 | 12 |
| Vote failure | 6 | 12 |
| Outside date | 10 | 20 |
| Total | 34 | 68 |

The renderer does not consolidate these party-specific cards into one row with complete lineage. It selects the first card for the code. This is the direct link between the duplicate grants and the hidden row content.

## Open-world evidence

There are 54 open-world items. Forty have a surface that the projection accepts. Thirty-two render as deferred-evidence rows. Eight eligible items are in TopBuild and are blocked by the projection error. Fourteen items have no approved Termination Rights surface, so the projection retains no row for them.

## Version boundary

Concho, Metsera, Red Hat and SkyWater were produced at `b06c4126`. Skechers was produced at `bd666803`. TopBuild was produced at `7e933cb6`.

All three producer commits contain the two-party claim split. All three also contain a display title for `TERMR-NOSOL-BREACH`. The current diagnostic branch has neither behaviour. The TopBuild error is therefore a branch-integration regression. It is not a failure in the recorded TopBuild model run.

The machine-readable summary pins the source file digests. The diagnosis script emits every resolved, open-world and review item with its rendering result.
