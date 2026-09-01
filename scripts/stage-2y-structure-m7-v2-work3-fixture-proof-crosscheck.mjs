#!/usr/bin/env node

// Cross-check every approved profile's fixture proofs across the whole Work3
// family-package set, the way `validateProfileFixtures` will once the item-42
// shared-source gate ahead of it passes.
//
// The validator reaches the fixture-proof stage only after the profile gate, so
// while item-42 blocks that gate the proofs the family generators author are
// unverified. This script runs the same recomputation — resolve each bound
// fixture, evaluate every approved match test over its source words, take the
// single most specific match — and reports any proof whose recorded expectation
// disagrees.
//
// Usage:
//   node scripts/stage-2y-structure-m7-v2-work3-fixture-proof-crosscheck.mjs

import { createRequire } from 'node:module';
import canonicalModule from '../lib/canonical-v2/canonical-bytes.js';

const require = createRequire(import.meta.url);
const { buildLawfulWork3FamilyPackageSetFixture } =
  require('../tests/helpers/m7-v2-work3-family-package-fixture.js');

const { canonicalJson, sha256Hex } = canonicalModule;

function normalisedWords(value) {
  return value.normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}

function containsTokenSequence(haystack, needle) {
  if (needle.length === 0 || needle.length > haystack.length) return false;
  for (let offset = 0; offset <= haystack.length - needle.length; offset += 1) {
    if (needle.every((token, index) => haystack[offset + index] === token)) return true;
  }
  return false;
}

function evaluateMatchTest(node, words, leafResults = []) {
  if (['ALL', 'ANY', 'NOT'].includes(node.kind)) {
    const children = node.children.map((child) => evaluateMatchTest(child, words, leafResults));
    const value = node.kind === 'ALL' ? children.every((child) => child.value)
      : node.kind === 'ANY' ? children.some((child) => child.value)
        : !children[0].value;
    return { value, leafResults };
  }
  if (!['SOURCE_TOKEN_SEQUENCE', 'SOURCE_TOKEN_ANY', 'SOURCE_TOKEN_ALL'].includes(node.kind)) {
    throw new Error(`unsupported match predicate ${node.kind}`);
  }
  const requested = node.tokens.flatMap((token) => normalisedWords(token));
  if (requested.length !== node.tokens.length) {
    throw new Error(`match leaf ${node.leaf_id} contains a non-atomic token`);
  }
  const value = node.kind === 'SOURCE_TOKEN_SEQUENCE' ? containsTokenSequence(words, requested)
    : node.kind === 'SOURCE_TOKEN_ANY' ? requested.some((token) => words.includes(token))
      : requested.every((token) => words.includes(token));
  leafResults.push({ leaf_id: node.leaf_id, result: value });
  return { value, leafResults };
}

function profileDepth(profile, profilesById) {
  let depth = 0;
  let current = profile;
  while (current?.parent_profile_id !== null) {
    current = profilesById.get(current.parent_profile_id);
    depth += 1;
    if (depth > 64) throw new Error('approved profile parentage is cyclic');
  }
  return depth;
}

function isDescendant(candidate, ancestorId, profilesById) {
  let current = candidate;
  while (current?.parent_profile_id !== null) {
    if (current.parent_profile_id === ancestorId) return true;
    current = profilesById.get(current.parent_profile_id);
  }
  return false;
}

function main() {
  const fixture = buildLawfulWork3FamilyPackageSetFixture({ useOnDiskFamilyPackages: true });
  const profiles = fixture.validationInput.familyProfileSet.profiles;
  const profilesById = new Map(profiles.map((profile) => [profile.profile_id, profile]));
  const packagesByPath = new Map(fixture.familyPackageSources.map(
    (source) => [source.binding.path, source.record],
  ));

  const evaluatedByWords = new Map();
  function evaluate(words) {
    const key = words.join(' ');
    if (evaluatedByWords.has(key)) return evaluatedByWords.get(key);
    const results = profiles.map((profile) => {
      const leafResults = [];
      const { value } = evaluateMatchTest(profile.match_test, words, leafResults);
      return {
        profile,
        matched: value,
        predicate_result_digest: sha256Hex(canonicalJson({
          matched: value, leaf_results: leafResults,
        })),
      };
    });
    const matched = results.filter((result) => result.matched).map((result) => result.profile);
    const mostSpecific = matched.filter((profile) => !matched.some(
      (candidate) => candidate.profile_id !== profile.profile_id
        && isDescendant(candidate, profile.profile_id, profilesById),
    )).sort((left, right) => profileDepth(right, profilesById) - profileDepth(left, profilesById)
      || left.profile_id.localeCompare(right.profile_id));
    const evaluated = {
      byProfileId: new Map(results.map((result) => [result.profile.profile_id, result])),
      selectedProfileKey: mostSpecific.length === 1 ? mostSpecific[0].profile_key : null,
    };
    evaluatedByWords.set(key, evaluated);
    return evaluated;
  }

  const failures = [];
  let checked = 0;
  for (const profile of profiles) {
    for (const proof of profile.fixture_proofs) {
      const container = packagesByPath.get(proof.fixture_binding.container_path);
      const member = container?.match_fixtures?.[proof.fixture_binding.member_index];
      if (!member || member.match_fixture_id !== proof.fixture_binding.member_record_id) {
        failures.push({
          family_key: profile.family_key,
          profile_key: profile.profile_key,
          fixture_id: proof.fixture_id,
          reason: 'fixture binding does not resolve to the bound package member',
        });
        continue;
      }
      const evaluated = evaluate(normalisedWords(member.effect_source_text));
      const result = evaluated.byProfileId.get(profile.profile_id);
      checked += 1;
      if (result.matched !== proof.expected_match
        || evaluated.selectedProfileKey !== proof.expected_selected_profile_key
        || result.predicate_result_digest !== proof.expected_predicate_result_digest) {
        failures.push({
          family_key: profile.family_key,
          profile_key: profile.profile_key,
          fixture_id: proof.fixture_id,
          kind: proof.kind,
          expected_match: proof.expected_match,
          actual_match: result.matched,
          expected_selected_profile_key: proof.expected_selected_profile_key,
          actual_selected_profile_key: evaluated.selectedProfileKey,
          digest_agrees: result.predicate_result_digest === proof.expected_predicate_result_digest,
        });
      }
    }
  }

  console.log(JSON.stringify({
    profiles: profiles.length,
    proofs_checked: checked,
    failures: failures.slice(0, 20),
    failure_count: failures.length,
  }, null, 2));
  if (failures.length > 0) process.exitCode = 1;
}

main();
