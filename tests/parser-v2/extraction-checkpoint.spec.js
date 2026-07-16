const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { createExtractionCheckpoint, inputHashFor } = require('../../lib/parser-v2/extraction-checkpoint');
const { extractProvisions } = require('../../lib/parser-v2/extract');

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ckpt-test-'));
}

test('checkpoint round-trips a stage when resume is on', () => {
  const dir = tmpDir();
  const hash = inputHashFor('agreement text');
  const writer = createExtractionCheckpoint({ dir, key: 'deal-1', inputHash: hash });
  writer.save('strategy-c', [{ type: 'REP-T', code: 'REP-T-AUTH' }]);
  const reader = createExtractionCheckpoint({ dir, key: 'deal-1', inputHash: hash, resume: true });
  assert.deepEqual(reader.load('strategy-c'), [{ type: 'REP-T', code: 'REP-T-AUTH' }]);
  assert.equal(reader.load('strategy-a'), null); // never saved
});

test('checkpoint load returns null without resume', () => {
  const dir = tmpDir();
  const hash = inputHashFor('agreement text');
  const ckpt = createExtractionCheckpoint({ dir, key: 'deal-1', inputHash: hash });
  ckpt.save('classify', [{ number: '1.01' }]);
  assert.equal(ckpt.load('classify'), null);
});

test('checkpoint rejects a stage saved against different input text', () => {
  const dir = tmpDir();
  const writer = createExtractionCheckpoint({ dir, key: 'deal-1', inputHash: inputHashFor('old text') });
  writer.save('classify', [{ number: '1.01' }]);
  const reader = createExtractionCheckpoint({ dir, key: 'deal-1', inputHash: inputHashFor('NEW text'), resume: true });
  assert.equal(reader.load('classify'), null);
});

test('checkpoint clear removes the deal directory', () => {
  const dir = tmpDir();
  const hash = inputHashFor('agreement text');
  const ckpt = createExtractionCheckpoint({ dir, key: 'deal-1', inputHash: hash, resume: true });
  ckpt.save('classify', []);
  assert.ok(fs.existsSync(ckpt.dir));
  ckpt.clear();
  assert.ok(!fs.existsSync(ckpt.dir));
  assert.equal(ckpt.load('classify'), null);
});

test('extractProvisions serves checkpointed stages without calling the LLM', async () => {
  const dir = tmpDir();
  const sectionText = 'Section 4.01. Authority. The Company has all requisite corporate power and authority to execute and deliver this Agreement.';
  const sections = [{ number: '4.01', title: 'Authority', text: sectionText, provision_type: 'REP-T' }];
  const fullText = sectionText;
  const hash = inputHashFor(fullText);

  const provision = {
    type: 'REP-T',
    code: 'REP-T-AUTH',
    category: 'Authority',
    text: sectionText,
    favorability: 'neutral',
    features: {},
  };
  const writer = createExtractionCheckpoint({ dir, key: 'deal-x', inputHash: hash });
  writer.save('strategy-a', []);
  writer.save('strategy-b', []);
  writer.save('strategy-c', [provision]);
  writer.save('strategy-d', []);
  writer.save('inline-defs', []);

  // Any LLM call is a test failure: every stage must come from the checkpoint.
  const client = {
    messages: {
      create: async () => { throw new Error('LLM called despite full checkpoint'); },
    },
  };
  const checkpoint = createExtractionCheckpoint({ dir, key: 'deal-x', inputHash: hash, resume: true });
  const out = await extractProvisions(sections, client, fullText, {}, { checkpoint });
  const rep = out.find((p) => p.code === 'REP-T-AUTH');
  assert.ok(rep, 'checkpointed provision should survive post-processing');
});
