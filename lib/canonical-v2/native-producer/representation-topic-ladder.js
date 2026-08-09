'use strict';

const {
  REGISTRY_VERSION,
  REGISTRY_DIGEST,
  CLASSIFIED,
  classifyRepresentationTopic,
} = require('../../vocab/resolution/representation-topic-registry');

const REPRESENTATION_TOPIC_LADDER_SCHEMA = 'REPRESENTATION_TOPIC_LADDER/V1';
const REPRESENTATION_TOPIC_LADDER_MODES = Object.freeze({
  OFF: 'OFF',
  REPORT_ONLY: 'REPORT_ONLY',
});
const REPRESENTATION_TOPIC_LADDER_RUNGS = Object.freeze({
  OFF: 0,
  EXACT_MATCH: 1,
  HIGH_CONFIDENCE: 2,
  EVIDENCE_CLASSIFICATION: 3,
});
const CLASSIFIER_OFF = 'REPRESENTATION_TOPIC_CLASSIFIER_OFF';
const BELOW_RUNG_THRESHOLD = 'REPRESENTATION_TOPIC_BELOW_RUNG_THRESHOLD';

function validateRepresentationTopicRung(topicRung) {
  if (!Number.isInteger(topicRung)
    || topicRung < REPRESENTATION_TOPIC_LADDER_RUNGS.OFF
    || topicRung > REPRESENTATION_TOPIC_LADDER_RUNGS.EVIDENCE_CLASSIFICATION) {
    throw new TypeError('representation_topic_rung must be an integer from 0 through 3');
  }
  return topicRung;
}

function isLiteralAnchor(anchor) {
  return typeof anchor === 'string' && !/[\\.^$*+?()[\]{}|]/u.test(anchor);
}

function admittedAtRung(classification, topicRung) {
  if (classification.state !== CLASSIFIED) return false;
  if (topicRung === REPRESENTATION_TOPIC_LADDER_RUNGS.EVIDENCE_CLASSIFICATION) return true;
  const subjectCorroborated = classification.subject_corroborated === true;
  const rawAnchors = classification.raw_anchor_matches || [];
  if (topicRung === REPRESENTATION_TOPIC_LADDER_RUNGS.HIGH_CONFIDENCE) {
    return subjectCorroborated || rawAnchors.length > 1;
  }
  return subjectCorroborated && rawAnchors.some(isLiteralAnchor);
}

function classifyRepresentationTopicAtRung(input, topicRung) {
  validateRepresentationTopicRung(topicRung);
  if (topicRung === REPRESENTATION_TOPIC_LADDER_RUNGS.OFF) {
    return Object.freeze({
      topic_rung: topicRung,
      classifier_invoked: false,
      state: 'UNCLASSIFIED',
      canonical_value: null,
      reason: CLASSIFIER_OFF,
      registry_version: REGISTRY_VERSION,
      registry_digest: REGISTRY_DIGEST,
      model_calls: 0,
    });
  }
  const classification = classifyRepresentationTopic(input);
  if (classification.state !== CLASSIFIED || admittedAtRung(classification, topicRung)) {
    return Object.freeze({ topic_rung: topicRung, classifier_invoked: true, ...classification });
  }
  return Object.freeze({
    topic_rung: topicRung,
    classifier_invoked: true,
    ...classification,
    state: 'UNCLASSIFIED',
    canonical_value: null,
    reason: BELOW_RUNG_THRESHOLD,
    base_classifier_state: classification.state,
    base_canonical_value: classification.canonical_value,
  });
}

module.exports = Object.freeze({
  REPRESENTATION_TOPIC_LADDER_SCHEMA,
  REPRESENTATION_TOPIC_LADDER_MODES,
  REPRESENTATION_TOPIC_LADDER_RUNGS,
  CLASSIFIER_OFF,
  BELOW_RUNG_THRESHOLD,
  validateRepresentationTopicRung,
  classifyRepresentationTopicAtRung,
});

