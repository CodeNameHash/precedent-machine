#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { canonicalJson } = require('../lib/canonical-v2/canonical-bytes');
const { buildSecEdgarIntakeCapture } = require('../lib/canonical-v2/sec-edgar-intake-capture');
const { convertSecHtmlToCanonicalText } = require('../lib/canonical-v2/sec-html-canonical-text');
const {
  BUYER_CONFIG,
  SELLER_CONFIG,
} = require('../lib/canonical-v2/qxo-buyer-termination-fee-admitted-slice');

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = join(ROOT, '__fixtures__', 'canonical-v2', 'qxo-f4-termination-source-spans.json');
const URL = 'https://www.sec.gov/Archives/edgar/data/1633931/000110465926045245/bld-20260418xex2d1.htm';
const RESPONSE_SHA256 = 'abba043018410d718c207e7d7a43c9567166f6a10c4c9a6b4b0c8c7761cd6b9d';
const CANONICAL_SHA256 = 'a87a18e5eede1c30d319ebf1b541f44ab98e34d52c4604dfd0e4b47268a442f8';

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

const response = await fetch(URL, {
  headers: {
    'User-Agent': 'Deal Corpus canonical intake bengoodchild@gmail.com',
    Accept: 'text/html',
    'Accept-Encoding': 'identity',
  },
});
const responseBytes = Buffer.from(await response.arrayBuffer());
if (response.status !== 200 || sha256(responseBytes) !== RESPONSE_SHA256) {
  throw new Error('The pinned QXO SEC response has drifted.');
}
const capture = buildSecEdgarIntakeCapture({
  retrieval_url: URL,
  final_url: URL,
  status_code: response.status,
  content_type: response.headers.get('content-type'),
  retrieved_at: '2026-07-24T00:00:00.000Z',
  retrieval_policy_digest: '0'.repeat(64),
  redirect_count: 0,
  response_bytes: responseBytes,
});
const canonicalBytes = Buffer.from(convertSecHtmlToCanonicalText(capture).canonical_text, 'utf8');
if (canonicalBytes.length !== 414782 || sha256(canonicalBytes) !== CANONICAL_SHA256) {
  throw new Error('The pinned QXO canonical text has drifted.');
}
const encode = (config) => Object.fromEntries(Object.entries(config.spanPins).map(
  ([key, pin]) => [
    key,
    canonicalBytes.subarray(pin.interval.start, pin.interval.end).toString('base64'),
  ],
));
const fixture = {
  schema_version: 'QXO_F4_TERMINATION_SOURCE_SPANS/V1',
  document_sha256: RESPONSE_SHA256,
  canonical_text_sha256: CANONICAL_SHA256,
  canonical_text_byte_length: canonicalBytes.length,
  buyer: encode(BUYER_CONFIG),
  seller: encode(SELLER_CONFIG),
};
mkdirSync(dirname(OUTPUT), { recursive: true });
writeFileSync(OUTPUT, `${canonicalJson(fixture)}\n`);
process.stdout.write(`${sha256(Buffer.from(canonicalJson(fixture), 'utf8'))}\n`);
