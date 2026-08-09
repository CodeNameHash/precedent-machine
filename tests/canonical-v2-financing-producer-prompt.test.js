'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { buildFinancingProducerPrompt, PROMPT_ID, PROMPT_VERSION } = require('../lib/canonical-v2/native-producer/financing-producer-prompt');
test('financing prompt is separate and positive-only', () => { const prompt = buildFinancingProducerPrompt({ source_text: '"Marketing Period" means fifteen (15) consecutive Business Days.', governed_scope: {} }); assert.equal(prompt.prompt_id, PROMPT_ID); assert.match(prompt.messages[0].content, /absent financing condition/); });

test('financing prompt assigns a financing kind only when its quote says that kind', () => {
  const prompt = buildFinancingProducerPrompt({ source_text: 'Parent shall use reasonable best efforts to obtain the Debt Financing.', governed_scope: {} });
  assert.equal(PROMPT_VERSION, 3);
  assert.equal(prompt.prompt_version, 3);
  assert.match(prompt.messages[0].content, /DEBT \| EQUITY \| DEBT_AND_EQUITY \| null/);
  assert.match(prompt.messages[0].content, /Only set financing_kind when the quote expressly names the matching kind/);
  assert.match(prompt.messages[0].content, /PAYOFF_LEAD_TIME only with an express numeric advance day count/);
  assert.match(prompt.messages[0].content, /OBTAIN_EFFORTS only for an express effort to obtain financing/);
  assert.match(prompt.messages[0].content, /COOPERATION_GRANT only for an express cooperation duty/);
  assert.match(prompt.messages[0].content, /NO_FINANCING_CONDITION_ACK only for express no-condition language/);
  assert.match(prompt.messages[0].content, /MARKETING_PERIOD_LENGTH only for an express numeric Marketing Period/);
  assert.match(prompt.messages[0].content, /Bare payoff or furnishing limbs belong in open_world_candidates/);
});
