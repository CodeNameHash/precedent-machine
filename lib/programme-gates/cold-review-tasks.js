const { REVIEW_LANES } = require('./registry');

const OUTPUT_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['disposition', 'findings'],
  properties: {
    disposition: { type: 'string', enum: ['PASS', 'FAIL'] },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['severity', 'code', 'message', 'evidence'],
        properties: {
          severity: { type: 'string', enum: ['BLOCKING', 'NON_BLOCKING'] },
          code: { type: 'string', pattern: '^[A-Z][A-Z0-9_]{2,63}$' },
          message: { type: 'string', minLength: 1 },
          evidence: { type: 'string', minLength: 1 },
        },
      },
    },
  },
});

const LANE_FOCUS = Object.freeze({
  ARCHITECTURE: 'the implementability and authority boundaries of the G0 gate, signer, status projection and publication path',
  LEGAL_SEMANTIC: 'whether G0 grants any legal-semantic, taxonomy, corpus-write or publication authority beyond isolated staging implementation',
  QUERY_EFFICIENCY: 'whether containment evidence proves zero corpus reads and whether G0 can expose an unsafe market or Query request path',
  OPEN_WORLD: 'whether G0 can publish, compare or silently discard unresolved legal propositions before the later governed gates pass',
  RELEASE_PROPAGATION: 'whether G0 can import, activate or mutate a corpus release, production data or a product feature before later gates pass',
});

function promptFor(lane) {
  return [
    `You are the independent ${lane.lane_id} G0 start-safety cold reviewer.`,
    'Review the five frozen specification members in this directory only for the generation-1 G0 decision.',
    'The decision is whether the signed V2 status can safely permit implementation planning, isolated staging setup and staging-only canonical engineering behind disabled production feature flags.',
    'In scope are the ten G0 gates, their evidence, the work-class projection, the one-use bootstrap, the protected signer, the two-file compare-and-swap publication and the prohibition on production data, release and feature activation.',
    'P1 contract freeze, vertical-slice completeness, corpus architecture and every P9 import, serving, load, cutover and completion requirement remain OPEN.',
    'A defect confined to an OPEN P1 or P9 requirement is outside this G0 disposition. It can be NON_BLOCKING only.',
    'A defect is BLOCKING only if it can falsify a G0 evidence claim, prevent the generation-1 V2 publication, grant authority beyond the permitted start scope, or bypass a later OPEN gate.',
    `Focus on ${LANE_FOCUS[lane.lane_id]}.`,
    'Do not modify files. Do not use prior review findings or conclusions.',
    'Return FAIL if any BLOCKING finding exists. Otherwise return PASS.',
    'Every finding must cite the exact specification path and section or identifier in evidence.',
    'Return only the required structured output.',
  ].join('\n');
}

const COLD_REVIEW_TASKS = Object.freeze(REVIEW_LANES.map((lane) => Object.freeze({
  lane_id: lane.lane_id,
  registered_prompt_id: lane.registered_prompt_id,
  prompt: promptFor(lane),
})));

module.exports = {
  COLD_REVIEW_TASKS,
  OUTPUT_SCHEMA,
};
