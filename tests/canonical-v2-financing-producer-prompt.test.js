'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { buildFinancingProducerPrompt, PROMPT_ID } = require('../lib/canonical-v2/native-producer/financing-producer-prompt');
test('financing prompt is separate and positive-only', () => { const prompt = buildFinancingProducerPrompt({ source_text: '"Marketing Period" means fifteen (15) consecutive Business Days.', governed_scope: {} }); assert.equal(prompt.prompt_id, PROMPT_ID); assert.match(prompt.messages[0].content, /absent financing condition/); });
