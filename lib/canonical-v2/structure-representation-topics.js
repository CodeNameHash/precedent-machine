'use strict';

// Topic classification for authored representation sentences, in the Stage 2Y
// structure path.
//
// The classifier itself is `lib/vocab/resolution/representation-topic-registry.js`,
// a governed Phase 1 source. Nothing here modifies it; this module only decides
// how the structure path calls it and how its answers are read.
//
// Three rules, all of them Ben's, 2026-08-13.
//
// 1. THE STATEMENT CLASSIFIES ITSELF. A representation is identified by what it
//    says, not by the heading above it, so `subject` is deliberately never
//    passed. Letting the heading arbitrate drops classification from 84% to 50%
//    across the seven M2 agreements, because a heading naming one topic sits
//    above sentences stating several.
//
// 2. A TIE IS A COMPOUND, NOT A FAILURE. The registry returns
//    NON_HIERARCHICAL_TIE when a sentence matches several topics with no
//    precedence between them. That is not an error: an HSR statement really can
//    live inside a no-conflicts representation. Such a sentence carries every
//    topic it matched, which is what lets it be compared against a standalone
//    HSR representation in another agreement. 456 of 1,130 sentences are
//    compound this way.
//
// 3. NO TOPIC IS AN ANSWER TOO. 179 sentences match no anchor. They are
//    reported as UNCLASSIFIED with the registry's own reason rather than being
//    dropped or guessed at.

const registry = require('../vocab/resolution/representation-topic-registry');

const TOPIC_STATES = Object.freeze({
  SINGLE: 'SINGLE_TOPIC',
  COMPOUND: 'COMPOUND_TOPICS',
  UNCLASSIFIED: 'NO_TOPIC',
});

const RULE_ID_PREFIX = 'REP_TOPIC_V1_';
const KNOWN_RULE_IDS = new Set(registry.TOPIC_RULES.map((entry) => entry.id));

function topicCode(ruleId) {
  return ruleId.startsWith(RULE_ID_PREFIX) ? ruleId.slice(RULE_ID_PREFIX.length) : ruleId;
}

// The registry gates on this key and returns WRONG_KEY for anything else. An
// authored representation sentence is a limb assertion candidate in substance,
// so the gate is satisfied deliberately and recorded on every result rather
// than being quietly slipped past.
const SCOPE_KEY = registry.NATIVE_LIMB_KEY;

function classifyAuthoredRepresentation({ canonicalText, span, rawValue }) {
  const result = registry.classifyRepresentationTopic({
    subject: null,
    raw_value: rawValue,
    family: 'REPRESENTATIONS',
    generic_claim_key: SCOPE_KEY,
    evidence: {
      source_text: canonicalText,
      spans: [{ absolute_start: span.start_byte, absolute_end: span.end_byte }],
    },
  });

  if (result.state === registry.CLASSIFIED) {
    return Object.freeze({
      topic_state: TOPIC_STATES.SINGLE,
      topics: Object.freeze([result.canonical_value]),
      topic_match_rule_id: result.topic_match_rule_id,
      unclassified_reason: null,
      classified_via: registry.REGISTRY_VERSION,
      scope_key: SCOPE_KEY,
    });
  }

  const matched = (result.matched_rule_ids || []).filter((id) => KNOWN_RULE_IDS.has(id));
  if (result.reason === registry.UNCLASSIFIED_REASONS.NON_HIERARCHICAL_TIE && matched.length > 1) {
    return Object.freeze({
      topic_state: TOPIC_STATES.COMPOUND,
      topics: Object.freeze([...new Set(matched.map(topicCode))].sort()),
      topic_match_rule_id: null,
      unclassified_reason: null,
      classified_via: registry.REGISTRY_VERSION,
      scope_key: SCOPE_KEY,
    });
  }

  return Object.freeze({
    topic_state: TOPIC_STATES.UNCLASSIFIED,
    topics: Object.freeze([]),
    topic_match_rule_id: null,
    unclassified_reason: result.reason,
    classified_via: registry.REGISTRY_VERSION,
    scope_key: SCOPE_KEY,
  });
}

module.exports = {
  TOPIC_STATES,
  classifyAuthoredRepresentation,
};
