# M3 production-plan and lessons delta

Applies to the external `production-extraction-plan-v1` and
`cross-family-lessons-v1` artefacts. This is a proposed V2 amendment, not a
release authorisation.

```json
{
  "production_plan": {
    "replace_current_facts.m3_family_register": {
      "state": "ONE_FOLLOW_ON_BLOCKED",
      "only_family_taxonomy_blocker": {
        "family_id": "CLOSING_CONDITIONS",
        "surface_id": "closing-conditions-dissent-threshold",
        "field": "DISSENT_THRESHOLD",
        "reason": "Its market-field contract remains FOLLOW_ON_REQUIRED."
      },
      "not_a_global_m3_or_release_block": true
    },
    "replace_current_facts.agreement_pilot_final_review_packet": {
      "final_review_packet_id": "f672070ba25e37ba95856532e19a4cc5c28c1c7c2e591f1124c30a2bf40f7584",
      "source_kind_counts": {
        "REPAIRED_REPLAY": 7,
        "ADJUDICATED_FIRST_PASS_REPLAY": 2,
        "PASSED_ITERATION_2": 1,
        "REPLAY_ONLY": 2
      },
      "retained_modiv_replay": {
        "rule": "Rebuild the retained consideration and termination-fee outputs from their exact first-pass recordings through the generic V2 repaired-replay schema.",
        "preserve": ["first_work_result", "adjudication_binding"],
        "termination_fee_conditional_sidecars": 6
      },
      "strict_review_input": {
        "id": "591533924ac6998e60bf0ac0ca52f5f3258c1a694748b79ec9b0f42c52982751",
        "schema_version": "M3_12_CALL_FINAL_PILOT_STRICT_INDEPENDENT_REVIEW_INPUT/V2",
        "model_call_count": 0
      }
    },
    "add_current_facts.preview_lanes": {
      "agreement_lane": ["Modiv", "Skechers", "TopBuild"],
      "process_product_regression_lane": ["Metsera"],
      "rule": "Show the two lanes together in the four-deal preview. Do not describe Metsera regression evidence as agreement-candidate certification."
    },
    "replace_unresolved_ben_decisions": [
      "Authorise a live model provider, profile and budget after the deterministic exception inventory is measured.",
      "Set the review-exit policy after two clean production batches.",
      "Name the legal certifier and technical activation operator before any activation."
    ],
    "add_confirmed_programme_approvals": [
      "Bounded M3 engineering is permitted by the programme ledger.",
      "The two-lane four-deal preview is an approved programme presentation, not a release-cohort decision.",
      "Exact first-pass retained replay, richer-recording selection, source-bound defined-term traversal, source-scope versus citation control, and structured conditional-fee objects are implemented controls, not Ben approvals."
    ]
  },
  "cross_family_lessons": {
    "replace_current_conclusion.next_gate": "Run the sealed V2 strict-review input against the V3 packet, then run the E4 full-corpus review-contract replay and E5 full-corpus conditional-value coverage experiment.",
    "replace_E4_blocking_reason": "The corrected contract and exact current pilot input are sealed. The blocker is the unsealed complete-corpus input set and the unrun full-corpus review.",
    "replace_E5_blocking_reason": "The Modiv pilot now has six conditional fee sidecars. The blocker is full-corpus coverage of termination fee, consideration and other source-defined numeric fields, not the absence of the pilot representation.",
    "add_lessons": [
      "A governed source scope permits examination. It is never a published citation. A published assertion needs the exact child citation plus parent or chapeau, party and qualifier context.",
      "Defined-term traversal must retain the origin clause, each source-bound reference, the definition and its exact path. Unsupported cross-section value paths remain OPEN_WORLD.",
      "Select a richer immutable recording only from sealed lineage that binds the prior recording, source and prompt, selection reason and retained output. Recency alone is not a selection rule.",
      "A conditional fee must retain every branch, side, operator, base, cap, trigger path, timing, offset and exception. It cannot become a scalar claim or comparison value without a separately approved scalarisation rule.",
      "The four-deal preview has two lanes. Agreement-pilot and Process Product regression states must remain distinct in the UI and in release language."
    ]
  }
}
```

The V1 label `m3_family_register.state = BLOCKED` is misleading. It should
identify the one blocked `DISSENT_THRESHOLD` market field, rather than imply
that all family taxonomy work, the M3 programme, or a release is blocked.

The V1 E4 label is also stale. The V3 packet and its exact source-bound strict
review input are already sealed. A legal review result and the two full-corpus
experiments are still required. This is a real readiness blocker, but not a
missing-contract blocker.

The production plan already states the correct controls for source scope versus
citation, defined-term traversal, conditional formulas, and richer recording
selection. The delta makes them current facts and explicit review criteria,
instead of leaving them only as forward-looking requirements.
