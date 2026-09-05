'use strict';

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { repoRootFrom } from './repo-root.mjs';

const repoRoot = repoRootFrom(import.meta.url);

const PROFILE_SET_PATH = resolve(
  repoRoot,
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-work3-approved-profile-set.json',
);
const INDEX_SET_PATH = resolve(
  repoRoot,
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-work3-agreement-index-set.json',
);
const SAMPLE_PACKAGE_PATH = resolve(
  repoRoot,
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-work3-profile-package-no-shop.json',
);

function loadJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function wordTokens(value) {
  return value.normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}

const profileSet = loadJson(PROFILE_SET_PATH);
const profiles = Array.isArray(profileSet.profiles) ? profileSet.profiles : [];
const rawTokenValues = [];
for (const profile of profiles) {
  const tokens = profile?.match_test?.tokens;
  if (!Array.isArray(tokens)) continue;
  for (const token of tokens) rawTokenValues.push(token);
}

const distinctRawTokens = [...new Set(rawTokenValues)];
const distinctWordTokens = new Set();
for (const token of distinctRawTokens) {
  if (typeof token !== 'string') continue;
  for (const word of wordTokens(token)) distinctWordTokens.add(word);
}

const indexSet = loadJson(INDEX_SET_PATH);
const corpusWords = new Set();
const texts = [];
for (const member of indexSet.members) {
  const index = loadJson(resolve(repoRoot, member.path));
  const canonicalText = index?.source_binding?.canonical_text;
  if (typeof canonicalText !== 'string') {
    throw new Error(`missing canonical_text in ${member.path}`);
  }
  const words = wordTokens(canonicalText);
  for (const word of words) corpusWords.add(word);
  texts.push({
    path: member.path,
    record_id: member.record_id,
    agreement_id: index.source_binding?.agreement_id ?? null,
    canonical_text_byte_length: index.source_binding?.canonical_text_byte_length ?? null,
    word_count: words.length,
  });
}

const present = [];
const absent = [];
for (const token of [...distinctWordTokens].sort()) {
  if (corpusWords.has(token)) present.push(token);
  else absent.push(token);
}

const familyPackage = loadJson(SAMPLE_PACKAGE_PATH);
const fixtures = Array.isArray(familyPackage.match_fixtures)
  ? familyPackage.match_fixtures.slice(0, 3)
  : [];
const match_fixtures = fixtures.map((fixture, index) => {
  const text = fixture.authored_unit_source_text;
  const excerpt = typeof text === 'string' ? text.slice(0, 160) : null;
  const looksSynthetic = typeof text === 'string'
    && /family[a-z0-9]+/i.test(text)
    && !/\b(shall|agreement|company|parent|merger)\b/i.test(text);
  return {
    package_path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-work3-profile-package-no-shop.json',
    fixture_index: index,
    match_fixture_id: fixture.match_fixture_id ?? null,
    authored_unit_source_text_length: typeof text === 'string' ? text.length : null,
    authored_unit_source_text_excerpt: excerpt,
    appearance: looksSynthetic ? 'synthetic_marker' : 'looks_like_agreement_prose_or_mixed',
  };
});

process.stdout.write(`${JSON.stringify({
  profile_count: profiles.length,
  raw_token_value_count: rawTokenValues.length,
  distinct_raw_token_count: distinctRawTokens.length,
  distinct_word_token_count: distinctWordTokens.size,
  tokens_present_in_any_of_ten_texts: present.length,
  tokens_absent_from_all_ten_texts: absent.length,
  sample_present_tokens: present.slice(0, 20),
  sample_absent_tokens: absent.slice(0, 20),
  canonical_texts: texts,
  match_fixtures,
}, null, 2)}\n`);
