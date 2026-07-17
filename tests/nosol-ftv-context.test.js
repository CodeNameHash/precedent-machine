/* FTV fix (2026-07-16): the NOSOL extraction prompt must carry the
   stockholders-meeting covenant and the termination article as READ-ONLY
   context — forceTheVoteType's codebook needs both (the vote-survives-ARC
   covenant usually lives in the meeting covenant; the SOFT/HARD
   discriminator lives in the termination article). Run: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');

const { extractProvisionsForType } = require('../lib/parser-v2/extract.js');

function capturingClient(captured) {
  return {
    messages: {
      create: async (payload) => {
        captured.push(payload.messages[0].content);
        return { content: [{ text: JSON.stringify({ provisions: [] }) }] };
      },
    },
  };
}

const SECTIONS = [
  {
    provision_type: 'NOSOL', number: '5.02', title: 'No Solicitation',
    text: 'SECTION 5.02. No Solicitation. The Company shall not solicit Acquisition Proposals.',
    startChar: 0,
  },
  {
    provision_type: 'COV', number: '6.02', title: 'Company Stockholders Meeting',
    text: 'SECTION 6.02. Company Stockholders Meeting. Notwithstanding any Adverse Recommendation Change, the Company shall submit this Agreement to its stockholders.',
    startChar: 1000,
  },
  {
    provision_type: 'TERMR', number: '8.01', title: 'Termination',
    text: 'SECTION 8.01. Termination. This Agreement may be terminated by the Company to enter into a Superior Proposal.',
    startChar: 2000,
  },
];

test('NOSOL prompt carries meeting covenant + termination article as context-only text', async () => {
  const captured = [];
  await extractProvisionsForType(SECTIONS, 'NOSOL', capturingClient(captured), '');
  assert.equal(captured.length, 1);
  const prompt = captured[0];
  assert.match(prompt, /RELATED SECTIONS — CONTEXT ONLY/);
  assert.match(prompt, /STOCKHOLDERS MEETING COVENANT/);
  assert.match(prompt, /Notwithstanding any Adverse Recommendation Change/);
  assert.match(prompt, /TERMINATION ARTICLE/);
  assert.match(prompt, /terminated by the Company to enter into a Superior Proposal/);
  // context precedes nothing extractable: the instruction forbids minting
  assert.match(prompt, /do NOT extract provisions from this text/);
});

test('non-NOSOL Strategy-B types get no context block; NOSOL with no related sections gets none either', async () => {
  const captured = [];
  await extractProvisionsForType(SECTIONS, 'ANTI', capturingClient(captured), '');
  for (const prompt of captured) assert.doesNotMatch(prompt, /RELATED SECTIONS — CONTEXT ONLY/);

  const captured2 = [];
  await extractProvisionsForType([SECTIONS[0]], 'NOSOL', capturingClient(captured2), '');
  assert.equal(captured2.length, 1);
  assert.doesNotMatch(captured2[0], /RELATED SECTIONS — CONTEXT ONLY/);
});
