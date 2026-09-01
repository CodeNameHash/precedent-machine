// Per-profile match-fixture closure for the Milestone A Work3 family packages.
//
// `validateProfileSnapshots` requires every approved profile in a family
// package to carry all four fixture kinds (POSITIVE, NEAR_NEGATIVE,
// WRONG_FAMILY, WRONG_SUBTYPE) and one dimension-evidence row that binds a
// fixture the profile itself proves. The family generators used to give the
// lawful template's four proofs to the anchor profile alone, so every other
// profile carried none.
//
// One fixture cannot positively select many profiles: `evaluateApprovedProfiles`
// runs every approved match test over the fixture's source words and demands
// exactly one most-specific match. This module therefore authors a POSITIVE and
// a NEAR_NEGATIVE fixture per profile, derived from that profile's own match
// tokens, plus two family-level negatives every profile in the family shares:
// the lawful template's WRONG_SUBTYPE fixture, and a generated WRONG_FAMILY
// sample.
//
// The WRONG_FAMILY sample is authored into the family's own package rather than
// bound across packages. The lawful template points every family's WRONG_FAMILY
// proof at one fixture inside the ANTITRUST_REGULATORY package and expects it to
// select that package's single synthetic profile. Neither half survives real
// packages: sealing ANTITRUST_REGULATORY with per-profile fixtures moves the
// bound member's index, and its real profiles do not answer to the synthetic
// profile key. A family-local sample keeps each package's proofs resolvable
// against that package alone.
//
// The fact payload of every generated fixture is copied from the template
// POSITIVE fixture, so `deriveFixtureDimensionKeys` yields the same key set the
// profiles declare as `known_relevant_dimensions` — the profiles are all clones
// of one template profile and share its field shape.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import canonicalModule from '../../lib/canonical-v2/canonical-bytes.js';

const { canonicalJson, contentId, sha256Hex } = canonicalModule;

const REPO_ROOT = join(import.meta.dirname, '..', '..');
export const LAWFUL_FIXTURE_PATH =
  'tests/fixtures/canonical-v2/m7-v2-repair/lawful-work3-family-package-set.json.gz.b64';

const PACKAGE_MEMBER_BINDING_SCHEMA =
  'STAGE_2Y_M7_V2_FAMILY_PROFILE_PACKAGE_MEMBER_BINDING/V1';
const MATCH_FIXTURE_SCHEMA = 'STAGE_2Y_M7_V2_MATCH_FIXTURE/V1';
const FIXTURE_KINDS = ['POSITIVE', 'NEAR_NEGATIVE', 'WRONG_FAMILY', 'WRONG_SUBTYPE'];
const FIXTURE_PAYLOAD_KEYS = [
  'node_kind',
  'ancestor_node_kinds',
  'context_edges',
  'typed_facts',
  'expected_material_field_keys',
  'expected_dependency_backed_field_keys',
  'expected_conditional_requirement_ids',
  'expected_child_rule_requirement_ids',
  'expected_excluded_dimension_keys',
  'expected_delegated_dimension_keys',
];

// Mirrors normalisedWords in lib/canonical-v2/m7-v2-contract.js.
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

function sealBoundRecord(schema, idField, body) {
  const unsigned = { schema_version: schema, ...body };
  return { ...unsigned, [idField]: contentId(schema, unsigned) };
}

function packageMemberBinding(containerPath, memberField, memberIndex, record, idField) {
  const bytes = Buffer.from(canonicalJson(record), 'utf8');
  return {
    schema_version: PACKAGE_MEMBER_BINDING_SCHEMA,
    container_path: containerPath,
    member_field: memberField,
    member_index: memberIndex,
    member_schema_version: record.schema_version,
    member_record_id_field: idField,
    member_record_id: record[idField],
    member_byte_length: bytes.length,
    member_sha256: sha256Hex(bytes),
  };
}

function profileSlug(profileKey) {
  return profileKey.replace(/[^A-Za-z0-9_]+/g, '-');
}

// Every generated match test is a single leaf, so the predicate result the
// validator recomputes is fully determined by whether that one leaf fired.
function singleLeafPredicateDigest(leafId, matched) {
  return sha256Hex(canonicalJson({
    matched,
    leaf_results: [{ leaf_id: leafId, result: matched }],
  }));
}

function matchTestTokens(profile) {
  const test = profile.match_test;
  if (!test
    || !['SOURCE_TOKEN_SEQUENCE', 'SOURCE_TOKEN_ANY', 'SOURCE_TOKEN_ALL'].includes(test.kind)
    || test.scope !== 'EFFECT_SOURCE_SPANS'
    || !Array.isArray(test.tokens)
    || test.tokens.length === 0) {
    throw new Error(`profile ${profile.profile_key} has no single-leaf source-token match test`);
  }
  const tokens = test.tokens.map((token) => {
    const words = normalisedWords(token);
    if (words.length !== 1) {
      throw new Error(`profile ${profile.profile_key} match token ${token} is not atomic`);
    }
    return words[0];
  });
  return tokens;
}

function evaluateMatchTest(profile, words) {
  const test = profile.match_test;
  const tokens = matchTestTokens(profile);
  if (test.kind === 'SOURCE_TOKEN_SEQUENCE') return containsTokenSequence(words, tokens);
  if (test.kind === 'SOURCE_TOKEN_ANY') return tokens.some((token) => words.includes(token));
  return tokens.every((token) => words.includes(token));
}

function fixturePayload(templateFixture) {
  const payload = {};
  for (const key of FIXTURE_PAYLOAD_KEYS) {
    if (!Object.hasOwn(templateFixture, key)) {
      throw new Error(`template match fixture is missing ${key}`);
    }
    payload[key] = structuredClone(templateFixture[key]);
  }
  return payload;
}

function templateProofsByKind(templateProfile) {
  const byKind = new Map(templateProfile.fixture_proofs.map((proof) => [proof.kind, proof]));
  for (const kind of FIXTURE_KINDS) {
    if (!byKind.has(kind)) {
      throw new Error(`lawful template profile has no ${kind} fixture proof`);
    }
  }
  return byKind;
}

function fixtureById(fixtures, fixtureId, label) {
  const found = fixtures.find((fixture) => fixture.fixture_id === fixtureId);
  if (found === undefined) throw new Error(`${label} fixture ${fixtureId} is absent`);
  return found;
}

/**
 * Author the per-profile match fixtures and fixture proofs for one family
 * package.
 *
 * @param {object} input
 * @param {string} input.packagePath repository path of the package being sealed
 * @param {object[]} input.profiles unsealed profile bodies carrying `match_test`
 * @param {object} input.templateProfile lawful-fixture template profile
 * @param {object[]} input.templateFixtures sealed fixtures carried over from the
 *   lawful template package
 * @returns {{matchFixtures: object[], proofsByProfileKey: Map<string, object[]>,
 *   buildDimensionEvidence: (profiles: object[]) => object[]}}
 */
export function buildFamilyProfileFixtureClosure({
  packagePath,
  profiles,
  templateProfile,
  templateFixtures,
}) {
  const templateProofs = templateProofsByKind(templateProfile);
  const positiveTemplate = fixtureById(
    templateFixtures, templateProofs.get('POSITIVE').fixture_id, 'template POSITIVE',
  );
  const wrongSubtypeTemplate = fixtureById(
    templateFixtures, templateProofs.get('WRONG_SUBTYPE').fixture_id, 'template WRONG_SUBTYPE',
  );
  const wrongFamilyProof = templateProofs.get('WRONG_FAMILY');
  const payload = fixturePayload(positiveTemplate);
  const familyKey = templateProfile.family_key;
  const wrongFamilySlug = profileSlug(familyKey);
  // A token no approved match test in any family carries, so the sample lands
  // outside every family rather than inside a neighbouring one.
  const wrongFamilyText = `wrongfamilysample${sha256Hex(Buffer.from(familyKey, 'utf8')).slice(0, 16)}`;
  const wrongFamilyFixture = sealBoundRecord(MATCH_FIXTURE_SCHEMA, 'match_fixture_id', {
    fixture_id: `fixture-wrong-family-${wrongFamilySlug}`,
    input_occurrence_id: `fixture-wrong-family-${wrongFamilySlug}`,
    authored_unit_source_text: wrongFamilyText,
    effect_source_text: wrongFamilyText,
    ...payload,
  });

  const generated = profiles.map((profile) => {
    const tokens = matchTestTokens(profile);
    const slug = profileSlug(profile.profile_key);
    const positiveText = tokens.join(' ');
    const nearText = [...tokens.slice(0, -1), `${tokens.at(-1)}x`].join(' ');
    return {
      profile,
      positive: sealBoundRecord(MATCH_FIXTURE_SCHEMA, 'match_fixture_id', {
        fixture_id: `fixture-positive-${slug}`,
        input_occurrence_id: positiveTemplate.input_occurrence_id,
        authored_unit_source_text: positiveText,
        effect_source_text: positiveText,
        ...payload,
      }),
      nearNegative: sealBoundRecord(MATCH_FIXTURE_SCHEMA, 'match_fixture_id', {
        fixture_id: `fixture-near-negative-${slug}`,
        input_occurrence_id: `fixture-near-${slug}`,
        authored_unit_source_text: nearText,
        effect_source_text: nearText,
        ...payload,
      }),
    };
  });

  const matchFixtures = [
    ...templateFixtures,
    wrongFamilyFixture,
    ...generated.flatMap((entry) => [entry.positive, entry.nearNegative]),
  ].sort((left, right) => (
    left.match_fixture_id < right.match_fixture_id ? -1
      : left.match_fixture_id > right.match_fixture_id ? 1 : 0
  ));
  const fixtureIds = matchFixtures.map((fixture) => fixture.fixture_id);
  if (new Set(fixtureIds).size !== fixtureIds.length) {
    throw new Error('generated match fixtures repeat a fixture ID');
  }
  const bindingByRecordId = new Map(matchFixtures.map((fixture, index) => [
    fixture.match_fixture_id,
    packageMemberBinding(packagePath, 'match_fixtures', index, fixture, 'match_fixture_id'),
  ]));

  // Selection is what the validator recomputes, so decide it here the same way:
  // run every profile's match test over the fixture words and require the
  // intended profile — and only that profile — to fire.
  function selectionFor(fixture) {
    const words = normalisedWords(fixture.effect_source_text);
    const matched = profiles.filter((profile) => evaluateMatchTest(profile, words));
    if (matched.length > 1) {
      throw new Error(
        `fixture ${fixture.fixture_id} selects ${matched.length} profiles in one family`,
      );
    }
    return matched[0] ?? null;
  }

  const proofsByProfileKey = new Map();
  for (const entry of generated) {
    const { profile } = entry;
    const leafId = profile.match_test.leaf_id;
    const selected = selectionFor(entry.positive);
    if (selected?.profile_key !== profile.profile_key) {
      throw new Error(
        `POSITIVE fixture for ${profile.profile_key} does not select it uniquely`,
      );
    }
    if (selectionFor(entry.nearNegative) !== null) {
      throw new Error(`NEAR_NEGATIVE fixture for ${profile.profile_key} still selects a profile`);
    }
    if (selectionFor(wrongSubtypeTemplate) !== null) {
      throw new Error('the family WRONG_SUBTYPE fixture selects an approved profile');
    }
    if (selectionFor(wrongFamilyFixture) !== null) {
      throw new Error('the family WRONG_FAMILY fixture selects an approved profile');
    }
    proofsByProfileKey.set(profile.profile_key, [
      {
        fixture_id: entry.positive.fixture_id,
        kind: 'POSITIVE',
        fixture_binding: bindingByRecordId.get(entry.positive.match_fixture_id),
        input_occurrence_id: entry.positive.input_occurrence_id,
        expected_match: true,
        expected_selected_profile_key: profile.profile_key,
        expected_predicate_result_digest: singleLeafPredicateDigest(leafId, true),
        decisive_leaf_ids: [leafId],
        lawyer_ruling_id: templateProofs.get('POSITIVE').lawyer_ruling_id,
      },
      {
        fixture_id: entry.nearNegative.fixture_id,
        kind: 'NEAR_NEGATIVE',
        fixture_binding: bindingByRecordId.get(entry.nearNegative.match_fixture_id),
        input_occurrence_id: entry.nearNegative.input_occurrence_id,
        expected_match: false,
        expected_selected_profile_key: null,
        expected_predicate_result_digest: singleLeafPredicateDigest(leafId, false),
        decisive_leaf_ids: [leafId],
        lawyer_ruling_id: templateProofs.get('NEAR_NEGATIVE').lawyer_ruling_id,
      },
      {
        fixture_id: wrongFamilyFixture.fixture_id,
        kind: 'WRONG_FAMILY',
        fixture_binding: bindingByRecordId.get(wrongFamilyFixture.match_fixture_id),
        input_occurrence_id: wrongFamilyFixture.input_occurrence_id,
        expected_match: false,
        expected_selected_profile_key: null,
        expected_predicate_result_digest: singleLeafPredicateDigest(leafId, false),
        decisive_leaf_ids: [leafId],
        lawyer_ruling_id: wrongFamilyProof.lawyer_ruling_id,
      },
      {
        fixture_id: wrongSubtypeTemplate.fixture_id,
        kind: 'WRONG_SUBTYPE',
        fixture_binding: bindingByRecordId.get(wrongSubtypeTemplate.match_fixture_id),
        input_occurrence_id: wrongSubtypeTemplate.input_occurrence_id,
        expected_match: false,
        expected_selected_profile_key: null,
        expected_predicate_result_digest: singleLeafPredicateDigest(leafId, false),
        decisive_leaf_ids: [leafId],
        lawyer_ruling_id: templateProofs.get('WRONG_SUBTYPE').lawyer_ruling_id,
      },
    ]);
  }

  function buildDimensionEvidence(sealedProfiles, templateEvidence) {
    return sealedProfiles.map((profile) => {
      const positiveProof = profile.fixture_proofs.find((proof) => proof.kind === 'POSITIVE');
      if (positiveProof === undefined) {
        throw new Error(`profile ${profile.profile_key} has no POSITIVE proof to carry evidence`);
      }
      return sealBoundRecord(templateEvidence.schema_version, 'dimension_evidence_id', {
        family_key: profile.family_key,
        profile_id: profile.profile_id,
        source_class: templateEvidence.source_class,
        evidence_binding: structuredClone(positiveProof.fixture_binding),
        dimension_keys: profile.known_relevant_dimensions
          .map((dimension) => dimension.dimension_key).sort(),
        lawyer_ruling_id: templateEvidence.lawyer_ruling_id,
      });
    }).sort((left, right) => (
      left.dimension_evidence_id < right.dimension_evidence_id ? -1
        : left.dimension_evidence_id > right.dimension_evidence_id ? 1 : 0
    ));
  }

  return { matchFixtures, proofsByProfileKey, buildDimensionEvidence };
}

export function loadLawfulFixtureSnapshot() {
  const encoded = readFileSync(join(REPO_ROOT, LAWFUL_FIXTURE_PATH), 'utf8').trim();
  return JSON.parse(gunzipSync(Buffer.from(encoded, 'base64')).toString('utf8'));
}

export function lawfulFamilyTemplate(snapshot, familyKey) {
  const source = snapshot.family_package_sources.find(
    (entry) => entry.record.family_key === familyKey,
  );
  if (!source) throw new Error(`lawful fixture missing ${familyKey} package template`);
  return structuredClone(source.record);
}

// Resolve a package-member binding that points outside the family being sealed —
// the WRONG_FAMILY proof binds a fixture in another family's package.
export function resolveLawfulMemberBinding(snapshot, binding) {
  const source = snapshot.family_package_sources.find(
    (entry) => entry.binding.path === binding.container_path,
  );
  if (!source) throw new Error(`lawful fixture has no package at ${binding.container_path}`);
  const record = source.record[binding.member_field][binding.member_index];
  if (!record || record[binding.member_record_id_field] !== binding.member_record_id) {
    throw new Error(`lawful fixture member binding ${binding.member_record_id} does not resolve`);
  }
  return structuredClone(record);
}

export function profileMatchToken(signature, maximumPrefix = 48) {
  const slug = signature.toLowerCase().replace(/[^a-z0-9]/g, '');
  return `${slug.slice(0, maximumPrefix)}${sha256Hex(Buffer.from(signature, 'utf8')).slice(0, 16)}`;
}
