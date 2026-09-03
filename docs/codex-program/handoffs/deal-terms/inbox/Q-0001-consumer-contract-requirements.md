id: Q-0001
from: ds
to: pm
date: 2026-09-03
re: consumer fields, deal identity, corpus manifest and package order
status: OPEN

# 1. Consumer interface fields

The package can choose its final property names. The following information is
the consumer requirement. DS will use only fields defined in the package
schema.

## Common identity and evidence envelope

Every record used by an interface needs these identities:

- package schema version, package content ID, release ID and corpus content ID;
- DS deal ID plus producer aliases;
- `agreement_id`;
- SEC source identity: issuer CIK, accession number, document name and governed
  document role;
- admitted document or canonical-text content ID and SHA-256;
- section or source-unit occurrence ID;
- claim occurrence ID and current claim revision ID;
- governed family ID, concept ID, role and ordinal where applicable; and
- evidence start byte, end byte, span-text SHA-256 and a reference to the exact
  canonical text carried by, or verifiably retrieved for, the package.

Every displayed answer needs:

- typed state, typed value, value type and unit;
- resolution disposition and legal-review state;
- short display label and section heading or reference;
- exact evidence text or an offline-resolvable evidence reference; and
- explicit unavailable or non-comparable reason where applicable.

Release and review states are functional fields. A
`REVIEW_ONLY_INTERNAL` package can be admitted to a development store, but it
cannot make the user-facing Deal Terms module ready.

## Terms Summary

Identity fields read: deal, agreement, family, concept, claim occurrence,
revision and evidence identities from the common envelope.

Display fields read: category label, term label, typed answer, unit,
qualification, party or role labels, typed state, review state, evidence
excerpt and source reference.

Filter keys: family, concept, party role, typed state, review state and document
role.

Sort keys: governed category order, governed term order and document order.
Numeric values need a separate sortable value. The consumer must not parse a
formatted display string.

## Provision Analysis

Identity fields read: deal, agreement, document, section or source-unit,
claim occurrence, revision and evidence identities.

Display fields read: agreement title, document version, section heading,
section reference, section text or exact text reference, claims within the
section, typed answers, qualifications, review state and evidence ranges.

Filter keys: family, concept, section reference, document role, amendment
state, typed state and review state.

Sort keys: agreement version, document order, section order, occurrence ordinal
and evidence start byte.

## Compare Deals

Identity fields read: corpus, release, deal, agreement, concept, claim
occurrence and revision identities.

Display fields read: one typed comparison cell per deal and concept, unit,
qualification, evidence link, review state and comparability state.

Filter keys supplied by Deal Terms: family, concept, typed state, review state,
comparability state, value type, unit and party role. Core product filters such
as announcement date, consideration form, industry and adviser are owned by DS
and are not requested from this package unless they are already governed Deal
Terms facts.

Sort keys: typed numeric, date, duration, boolean or governed categorical value;
never a display string. A missing, absent, not-applicable or non-comparable cell
must remain distinct from zero and false.

## Search Precedents

Identity fields read: package, corpus, release, deal, agreement, section or
search-unit occurrence, claim occurrence and evidence identities.

Display fields read: exact searchable text, section heading and reference,
matched concept or family, result excerpt, evidence range, typed state, review
state and agreement version.

Filter keys: family, concept, agreement role, document role, review state,
typed state and corpus membership. DS adds its own deal and entity filters.

Sort keys: producer relevance score with its score version, then deterministic
deal, document and byte-position tie-breakers. The contract may expose
producer-created search records or a governed portable index. It must not
require DS to read an internal table or infer the legal concept from raw text.

# 2. Deal identity convention

DS assigns the canonical deal ID in the corpus manifest. PM carries it and its
own aliases; PM does not derive or remint it.

The proposed V1 payload is:

```json
{
  "schema": "PUBLIC_MA_DEAL/V1",
  "payload": {
    "target_cik": "10-digit zero-padded CIK",
    "transaction_anchor": {
      "issuer_cik": "10-digit zero-padded CIK",
      "accession_number": "SEC accession without formatting ambiguity",
      "document_role": "governed role for the first executed transaction or launched offer"
    },
    "announced_transaction_ordinal": 0
  }
}
```

`deal_id` is the SHA-256 content ID of that canonical payload. The anchor is an
explicit, immutable selection in the approved manifest. A later-discovered
source cannot change it.

Other documents bind to the deal by issuer CIK, accession number, document
name and document role. Each binding states its relationship, for example
initial agreement, amendment, supplement, vote, closing or termination. An
amendment keeps the deal ID. A later signed transaction with a different buyer
gets a different deal ID even if it concerns the same target. DS can link those
deals through a separate process-group identity. A withdrawn signed transaction
keeps its deal ID and receives a withdrawn or terminated status.

PM's `agreement_id` remains a producer alias. A package must carry both IDs and
the exact SEC source identity that proves their binding. A binding mismatch is
a typed blocking state, not a fuzzy name match.

# 3. Shared 50-deal corpus manifest shape

Keep selection and admission as two content-addressed records. This prevents
admission results from changing the identity of the approved selection.

```json
{
  "schema_version": "SHARED_50_DEAL_SELECTION/V1",
  "corpus_id": "content ID of the canonical payload excluding corpus_id",
  "purpose": "INTERNAL_PROOF",
  "required_deal_count": 50,
  "selection_rule_version": "governed rule ID",
  "approved_by": "Ben",
  "approved_on": "YYYY-MM-DD",
  "deals": [
    {
      "ordinal": 0,
      "deal_id": "64-hex DS deal ID",
      "target_cik": "10-digit zero-padded CIK",
      "transaction_anchor": {
        "issuer_cik": "10-digit zero-padded CIK",
        "accession_number": "SEC accession",
        "document_role": "governed role"
      },
      "required_agreements": [
        {
          "agreement_role": "merger_agreement",
          "issuer_cik": "10-digit zero-padded CIK",
          "accession_number": "SEC accession",
          "document_name": "SEC document name",
          "document_role": "governed role",
          "required": true
        }
      ]
    }
  ]
}
```

The producer's separate admission receipt should add, without rewriting the
selection manifest: corpus ID, deal ID, agreement ID, admitted-source receipt
content ID, canonical-text SHA-256, admission state, producer run ID and any
typed failure reason. The released package cites both the immutable selection
and its admission receipt.

Please make A-0003 state whether this two-record split is accepted. If the
package instead uses one record, it must identify exactly which fields are in
the pre-admission input and which producer fields are added without changing
the selected corpus identity.

# 4. Package order and use

1. One deal first. It is needed to implement digest, identity, evidence and
   schema validation. A `REVIEW_ONLY_INTERNAL` package is sufficient. It is not
   user-visible.
2. Five deals next. They are needed to implement cross-deal search, comparison,
   typed missing states, update and rollback. The first five-deal package can
   remain wiring-only. It does not pass the combined five-deal product gate.
3. Reissue a five-deal package after the producer legal gate with a release
   state that permits internal user display. This is the Deal Terms input to
   the combined five-deal gate.
4. The shared 50-deal proof package is required for the internal proof. It must
   contain exactly the approved selection and its admission receipt.

All sizes must use the same schema. A smaller package is a corpus manifest with
fewer admitted deal entries, not a reduced interface contract.
