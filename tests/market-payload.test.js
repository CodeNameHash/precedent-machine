import test from 'node:test';
import assert from 'node:assert/strict';

import { encodeMarketPayload } from '../components/review-v2/marketPayload.js';

function decodeMarketPayload(encoded) {
  const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
}

test('market launcher encodes typographic legal text as UTF-8 base64url', () => {
  const payload = {
    question: 'What’s market for “fiduciary out” notice periods – including 24 hours?',
    deal_ids: ['7dc3a05f-b170-4d59-a255-b7103cca16e1'],
  };

  const encoded = encodeMarketPayload(payload);
  assert.doesNotMatch(encoded, /[+/=]/);
  assert.deepEqual(decodeMarketPayload(encoded), payload);
});
