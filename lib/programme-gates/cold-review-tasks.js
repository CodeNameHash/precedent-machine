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
  ARCHITECTURE: 'identity stability, authoritative write paths, transactional boundaries, failure isolation and implementability',
  LEGAL_SEMANTIC: 'legal meaning, party and scope fidelity, qualifiers, exceptions, definitions, relationships and absence semantics',
  QUERY_EFFICIENCY: 'bounded set-based reads, indexed cohorts, cacheability, concurrency, database load and interactive latency',
  OPEN_WORLD: 'novel proposition discovery, reviewed source-specific publication, residual blocking and refusal of false comparability',
  RELEASE_PROPAGATION: 'immutable candidate releases, correction survival, certification, atomic activation, rollback and cross-view parity',
});

function promptFor(lane) {
  return [
    `You are the independent ${lane.lane_id} cold reviewer.`,
    'Review only the five frozen specification members in this directory.',
    `Focus on ${LANE_FOCUS[lane.lane_id]}.`,
    'Do not modify files. Do not use prior review findings or conclusions.',
    'A BLOCKING finding is a contradiction, missing binding rule, unsafe authority, unverifiable gate, or defect that prevents the stated outcome.',
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
