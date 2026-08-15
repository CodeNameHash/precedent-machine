'use strict';

const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');

const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('../lib/canonical-v2/canonical-bytes');
const {
  validateAnalysisV2,
  validateProjectionV2,
} = require('../lib/canonical-v2/m7-v2-contract');
const cases = require('./fixtures/canonical-v2/m7-v2-repair/work1-acceptance-cases.json');

const FAMILY_KEYS = [
  'EMPLOYEE_MATTERS',
  'TERMINATION',
  'GENERAL_COVENANTS',
  'CLOSING_CONDITIONS',
  'MAE_DEFINITION',
  'KEY_DEFINED_TERMS',
  'REPRESENTATIONS',
  'INTERIM_OPERATING',
  'NO_SHOP',
  'DNO_INDEMNIFICATION',
  'NO_OTHER_REPS_FRAUD',
  'ANTITRUST_REGULATORY',
  'APPRAISAL_DISSENTERS_RIGHTS',
  'CAPITALISATION',
  'CONSIDERATION',
  'DIVIDENDS',
  'FINANCING_COVENANTS',
  'GUARANTY_FINANCING_PARTY',
  'MATERIAL_CONTRACTS',
  'MERGER_STRUCTURE_CLOSING',
  'MISC_BOILERPLATE',
  'PROXY_MEETING',
  'SPECIFIC_PERFORMANCE_REMEDIES',
  'TAX_MATTERS',
  'TERMINATION_FEE',
];

const INPUT_ROLES = [
  'BASE_ANALYSIS_SET',
  'AGREEMENT_INDEX_SET',
  'CONTEXT_COMPILATION_SET',
  'APPROVED_FAMILY_PACKET_SET',
  'APPROVED_FAMILY_PROFILE_SET',
  'APPROVED_STRUCTURE_DISPOSITION_SET',
];

const INPUT_SCHEMAS = {
  BASE_ANALYSIS_SET: 'AGREEMENT_ANALYSIS_SET/V1',
  AGREEMENT_INDEX_SET: 'AGREEMENT_INDEX_SET/V1',
  CONTEXT_COMPILATION_SET: 'CONTEXT_COMPILATION_SET/V1',
  APPROVED_FAMILY_PACKET_SET: 'STAGE_2Y_M7_V2_REPAIR_FAMILY_PACKET_SET/V1',
  APPROVED_FAMILY_PROFILE_SET: 'STAGE_2Y_M7_V2_APPROVED_FAMILY_PROFILE_SET/V1',
  APPROVED_STRUCTURE_DISPOSITION_SET: 'STAGE_2Y_M7_V2_STRUCTURE_DISPOSITION_SET/V1',
};

const FACT_TYPES = [
  'PARTY_SET', 'PARTY', 'ENUM', 'DEFINED_TERM', 'BOOLEAN', 'NUMBER', 'PERCENTAGE',
  'MONEY', 'DATE', 'DURATION', 'PERIOD', 'REFERENCE',
];

const FORMATTERS = {
  PARTY_SET: 'party-set-v1',
  PARTY: 'string-v1',
  ENUM: 'enum-title-v1',
  DEFINED_TERM: 'string-v1',
  BOOLEAN: 'yes-no-v1',
  NUMBER: 'number-v1',
  PERCENTAGE: 'percentage-v1',
  MONEY: 'money-v1',
  DATE: 'date-iso-v1',
  DURATION: 'duration-v1',
  PERIOD: 'duration-v1',
  REFERENCE: 'string-v1',
};

const CHILD_ROLES = {
  ALL_OF: ['MEMBER'],
  ANY_OF: ['MEMBER'],
  NOT: ['NEGATED'],
  IF_THEN: ['CONDITION', 'CONSEQUENCE'],
  EXCEPTION_TO: ['BASE', 'EXCEPTION'],
  OVERRIDES: ['OVERRIDING', 'OVERRIDDEN'],
  DEEMS_AS: ['TRIGGER', 'DEEMED_RESULT'],
  EARLIER_OF: ['MEMBER'],
  LATER_OF: ['MEMBER'],
  TO_EXTENT: ['BASE', 'EXTENT_LIMIT'],
  CONSEQUENCE_MODIFIER: ['BASE_EFFECT', 'MODIFIED_CONSEQUENCE'],
};

const EQUIVALENCE_SLOTS = [
  'actor', 'effect', 'standard', 'threshold', 'timing', 'conditions', 'qualifications',
];

const CANDIDATE_CHECKS = [
  'REGISTRATION_SELF_IDENTITY',
  'AUTHORITY_AND_WORK0_BINDINGS',
  'REQUIRED_COMPONENT_BINDINGS',
  'SIX_SEMANTIC_INPUT_BINDINGS',
  'TWENTY_FIVE_SUBTYPE_TREE_BINDINGS',
  'PREDECESSOR_AND_OUTPUT_SCOPE',
  'ZERO_PROHIBITED_EFFECTS',
];

const CANDIDATE_EFFECTS = {
  registration_file_writes: 1,
  model_calls: 0,
  network_reads: 0,
  network_writes: 0,
  database_writes: 0,
  product_writes: 0,
  m0_m4_mutations: 0,
  m8_actions: 0,
};

const VERIFICATION_EFFECTS = {
  files_written: 0,
  model_calls: 0,
  network_reads: 0,
  network_writes: 0,
  database_writes: 0,
  product_writes: 0,
  m0_m4_mutations: 0,
  m8_actions: 0,
};

const AUTHORITY_SHA256 = '7e858b96fc46a69d7533e8b5ac3cad4a6142c2f30fd71ecfbd8771709e0cdd3c';
const ACTIVATION_SHA256 = 'f0401bb7f75fe72b7719663573ab75581aecffeb2949618b991ec41e54f1c578';
const ITEM39_AMBIGUITY_ID = '21f1bca531ca44030c615da1e88a933704ee74402a35f5aa36982fb1bbb21e00';
const ITEM39_DISPOSITION_ID = '7bc98f42d8580f9aada5ee4274e9ada3d22ddd12e9150898a3188e7ddbf122d3';
const ITEM39_DECISION_ID = 'ac56600e311361f72e9423de2fd9a4a468e536ce25974dbc9f450369b8e097f6';
const ITEM39_PARENT_NODE_ID = '9a9d339a33d7c530a9668482cb65f537e96bf9c78836de56cae76d92f6ceff35';
const MIGRATION_ROOT = 'evidence/canonical-v2/stage-2y-structure-migration';
const WORK0_PATH = `${MIGRATION_ROOT}/receipts/stage-2y-structure-m7-v2-repair-evidence-root.json`;
const FIXED_SAMPLE_PATH = `${MIGRATION_ROOT}/control/m7-v2-repair-fixed-sample-identity-manifest.json`;
const BASELINE_PATH = `${MIGRATION_ROOT}/control/m7-v2-repair-baseline-ledger.json`;
const RULING_MAP_PATH = `${MIGRATION_ROOT}/control/m7-v2-repair-calibration-question-ruling-map.json`;
const REVIEW_PACKET_PATH = `${MIGRATION_ROOT}/shadow/m7-comparison-entry-correction/lawyer-review-packet.json`;
const FAMILY_PACKET_PATH = `${MIGRATION_ROOT}/control/m7-v2-repair-family-packet-set.json`;
const ITEM39_INDEX_PATH = `${MIGRATION_ROOT}/shadow/m2/06ec301641939fe0ac6e6ba598a33b40f16b1acc3ffb29109c7227b14bf1025a.agreement-index.json`;
const STRUCTURE_OVERLAY_SCHEMA = 'STAGE_2Y_M7_V2_STRUCTURE_OVERLAY/V1';
const STRUCTURE_CANDIDATE_TREE_SCHEMA = 'STAGE_2Y_M7_V2_STRUCTURE_CANDIDATE_TREE/V1';
const STRUCTURE_OVERLAY_FIXTURE_SCHEMA = 'STAGE_2Y_M7_V2_STRUCTURE_OVERLAY_FIXTURE/V1';
const RUNNER_PATHS = [
  'scripts/stage-2y-structure-family-aggregate.mjs',
  'scripts/stage-2y-structure-generalisation-shadow.mjs',
  'scripts/stage-2y-structure-m6-project.mjs',
];
const TEST_PATHS = [
  'tests/stage-2y-structure-m7-v2-repair-contract.test.js',
  'tests/stage-2y-structure-m7-v2-repair-execution-manifest.test.js',
  'tests/stage-2y-structure-m7-v2-repair-registration.test.js',
  'tests/stage-2y-structure-m7-v2-repair-work2.test.js',
].sort();
const LINKED_POINT_ORDINALS = [6, 27, 28, 32, 33, 34, 35, 36];
const REPAIR_INVARIANTS = {
  MATERIAL_MEANING_OMITTED_OR_HIDDEN: 'NO_NAMED_EFFECT_PARTY_CONDITION_EXCEPTION_TIMING_STANDARD_THRESHOLD_OR_QUALIFIER_MAY_BE_OMITTED_HIDDEN_IN_DISPLAY_TEXT_OR_RELABELLED_SOURCE_LIMITED',
  CLASSIFICATION_OR_SEMANTIC_DEPTH_FAILURE: 'CORRECT_FAMILY_AND_MOST_SPECIFIC_SUPPORTED_SUBTYPE_WITH_LAWYER_READABLE_TYPED_FIELDS_FOR_EACH_IDENTIFIED_LEGAL_EFFECT',
  FALSE_PARSER_AMBIGUITY: 'NESTED_LIST_LABEL_RESTART_ALONE_IS_NOT_AMBIGUITY_PRESERVE_AUTHORED_NESTING',
  SOURCE_ARTEFACT: 'EXCLUDE_ONLY_THE_IDENTIFIED_ARTEFACT_SPAN_PRESERVE_ADJACENT_LEGAL_TEXT',
  APPROVED_NO_COMPARISON: 'COMPLETE_NO_COMPARISON_ONLY_FOR_THIS_GOVERNED_MECHANICS_OCCURRENCE_NO_ROW_AND_NO_FAMILY_WIDE_SUPPRESSION',
  CLEAN_CONTROL: 'PRESERVE_ACCEPTED_LEGAL_MEANING_CLASSIFICATION_FIELDS_DISPOSITION_AND_RENDERING_WITH_NO_REGRESSION',
};

const REPO_ROOT = join(__dirname, '..');
const PROGRAMME_RULING_RECORD = JSON.parse(readFileSync(
  join(REPO_ROOT, RULING_MAP_PATH), 'utf8',
));
const PROGRAMME_RULING_BY_FAMILY = new Map(
  PROGRAMME_RULING_RECORD.families.map((family) => [
    family.family_key,
    family.question_mappings[0].ruling_id,
  ]),
);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function gitBlobOid(value) {
  const bytes = Buffer.from(value);
  return createHash('sha1').update(Buffer.concat([
    Buffer.from(`blob ${bytes.length}\0`, 'utf8'),
    bytes,
  ])).digest('hex');
}

function canonicalBytes(record) {
  return Buffer.from(`${canonicalJson(record)}\n`, 'utf8');
}

function sealBoundRecord(schema, idField, body) {
  const unsigned = { schema_version: schema, ...body };
  return { ...unsigned, [idField]: contentId(schema, unsigned) };
}

function sealInlineRecord(schema, idField, body) {
  return {
    schema_version: schema,
    [idField]: contentId(schema, body),
    ...body,
  };
}

function bindingForBytes(path, bytes, schemaVersion = null, idField = null, recordId = null) {
  return {
    path,
    schema_version: schemaVersion,
    record_id_field: idField,
    record_id: recordId,
    byte_length: bytes.length,
    sha256: sha256Hex(bytes),
    git_blob_oid: gitBlobOid(bytes),
  };
}

function addRecord(store, path, record, idField) {
  const bytes = canonicalBytes(record);
  store.set(path, bytes);
  return bindingForBytes(path, bytes, record.schema_version, idField, record[idField]);
}

function addText(store, path, text = path) {
  const bytes = Buffer.from(text, 'utf8');
  store.set(path, bytes);
  return bindingForBytes(path, bytes);
}

function addEvidenceFile(store, path) {
  const selected = readFileSync(join(REPO_ROOT, path));
  const record = JSON.parse(selected.toString('utf8'));
  store.set(path, selected);
  const idField = Object.keys(record).find((key) => key.endsWith('_id')
    && typeof record[key] === 'string' && /^[a-f0-9]{64}$/u.test(record[key]));
  assert.ok(idField, `evidence record ${path} has no content ID`);
  return {
    record,
    bytes: selected,
    binding: bindingForBytes(path, selected, record.schema_version, idField, record[idField]),
  };
}

function fixedBinding(path, schemaVersion, idField, recordId, sha256) {
  return {
    path,
    schema_version: schemaVersion,
    record_id_field: idField,
    record_id: recordId,
    byte_length: 1,
    sha256,
    git_blob_oid: '0'.repeat(40),
  };
}

function parseExpressionSignature(signature) {
  const tokens = signature.match(/[A-Z][A-Z0-9_]*|[(),]/gu) ?? [];
  let index = 0;
  function parseNode() {
    const name = tokens[index++];
    assert.match(name, /^[A-Z][A-Z0-9_]*$/u);
    if (tokens[index] !== '(') return { kind: 'FACT', field_key: name };
    index += 1;
    const children = [];
    while (tokens[index] !== ')') {
      children.push(parseNode());
      if (tokens[index] === ',') index += 1;
      else assert.equal(tokens[index], ')');
    }
    index += 1;
    return { kind: 'EXPRESSION', operator: name, children };
  }
  const root = parseNode();
  assert.equal(index, tokens.length);
  return root;
}

function annotateExpressionTree(root) {
  let expressionIndex = 0;
  const expressions = [];
  const fields = [];
  function visit(node) {
    if (node.kind === 'FACT') {
      fields.push(node.field_key);
      return;
    }
    node.expression_key = `expression-${expressionIndex += 1}`;
    expressions.push(node);
    node.children.forEach(visit);
  }
  visit(root);
  return { root, expressions, fields: [...new Set(fields)] };
}

function operatorsIn(root) {
  const values = [];
  (function visit(node) {
    if (node.kind !== 'EXPRESSION') return;
    if (!values.includes(node.operator)) values.push(node.operator);
    node.children.forEach(visit);
  }(root));
  return values;
}

function familyToken(familyKey) {
  return `family${familyKey.toLowerCase().replace(/_/gu, '')}`;
}

function titleEnum(value) {
  return value.toLowerCase().split('_')
    .map((word, index) => index === 0 ? word[0].toUpperCase() + word.slice(1) : word)
    .join(' ');
}

function renderTypedValue(fact) {
  if (fact.value_type === 'PARTY_SET') return fact.typed_value.parties.join('; ');
  if (fact.value_type === 'ENUM') return titleEnum(fact.typed_value);
  if (['PARTY', 'DEFINED_TERM', 'REFERENCE', 'DATE'].includes(fact.value_type)) {
    return fact.typed_value;
  }
  if (fact.value_type === 'BOOLEAN') return fact.typed_value ? 'Yes' : 'No';
  if (fact.value_type === 'NUMBER') return String(fact.typed_value);
  if (fact.value_type === 'PERCENTAGE') return `${fact.typed_value}%`;
  if (fact.value_type === 'MONEY') {
    return `${fact.typed_value.currency} ${fact.typed_value.amount}`;
  }
  const bound = titleEnum(fact.typed_value.bound_type);
  const unit = fact.typed_value.unit.toLowerCase();
  return `${bound} ${fact.typed_value.count} ${unit}${fact.typed_value.count === 1 ? '' : 's'}`;
}

function assertCode(action, code) {
  assert.throws(action, (error) => {
    assert.equal(error instanceof TypeError, true);
    assert.equal(error.code, code);
    return true;
  });
}

function factSpec(fieldKey, valueType, sourceText, typedValue, normalisationRule,
  contextEdgeIds = [], { materiality = 'MATERIAL', displayRule = 'DISPLAY_REQUIRED' } = {}) {
  return {
    field_key: fieldKey,
    value_type: valueType,
    source_text: sourceText,
    typed_value: typedValue,
    normalisation_rule: normalisationRule,
    context_edge_ids: contextEdgeIds,
    materiality,
    display_rule: displayRule,
  };
}

const FOCUSED_WORK0_SOURCE_CONFIG = Object.freeze({
  'item-28-linked-d-and-o-rights-survival': Object.freeze({
    sample_ordinal: 28,
    modal_ranges: [[283620, 283625, 0], [284214, 284219, 0],
      [284292, 284297, 1], [284425, 284430, 1]],
    primary_intervals: [[283494, 284275, 0], [284275, 284497, 1]],
    technical_ranges: [],
  }),
  'item-42-linked-d-and-o-rights-survival': Object.freeze({
    sample_ordinal: 42,
    modal_ranges: [[190173, 190178, 0], [190210, 190215, 1],
      [190283, 190288, 1], [190359, 190364, 0], [190621, 190626, 2]],
    primary_intervals: [[189482, 190206, 0], [190206, 190355, 1],
      [190355, 190550, 0], [190550, 190755, 2]],
    technical_ranges: [[190510, 190511], [190524, 190525]],
    dependency_range: [190600, 190620, 2],
  }),
  'item-44-separate-access-dimensions': Object.freeze({
    sample_ordinal: 44,
    modal_ranges: [[129423, 129428, 0], [129434, 129439, 0],
      [129798, 129803, 0]],
    primary_intervals: [[129148, 129949, 0]],
    technical_ranges: [],
  }),
});

function focusedRangeFact(fieldKey, valueType, sourceText, typedValue, normalisationRule,
  startByte, endByte, contextEdgeIds = [], extra = {}) {
  const spec = factSpec(
    fieldKey, valueType, sourceText, typedValue, normalisationRule, contextEdgeIds,
  );
  spec.focused_parts = [{
    start_byte: startByte,
    end_byte: endByte,
    context_edge_id: contextEdgeIds.length === 1 ? contextEdgeIds[0] : null,
    context_target_id: contextEdgeIds.length === 1 ? typedValue : null,
  }];
  Object.assign(spec, extra);
  return spec;
}

function focusedPartySetFact(fieldKey, sourceText, parts) {
  const contextParts = parts.filter((part) => part.target_id !== null);
  const contextEdgeIds = contextParts.map((part, index) =>
    `edge-focused-${fieldKey.toLowerCase()}-${part.start_byte}-${index}`);
  const spec = factSpec(
    fieldKey,
    'PARTY_SET',
    sourceText,
    { parties: contextParts.map((part) => part.target_id) },
    'BOUND_PARTY_ALIAS/V1',
    contextEdgeIds,
  );
  let edgeIndex = 0;
  spec.focused_parts = parts.map((part) => {
    if (part.target_id === null) {
      return { start_byte: part.start_byte, end_byte: part.end_byte };
    }
    const contextEdgeId = contextEdgeIds[edgeIndex];
    edgeIndex += 1;
    return {
      start_byte: part.start_byte,
      end_byte: part.end_byte,
      context_edge_id: contextEdgeId,
      context_target_id: part.target_id,
    };
  });
  return spec;
}

function focusedPartyFact(fieldKey, sourceText, targetId, startByte, endByte) {
  const edgeId = `edge-focused-${fieldKey.toLowerCase()}-${startByte}`;
  return focusedRangeFact(
    fieldKey, 'PARTY', sourceText, targetId, 'BOUND_PARTY_ALIAS/V1',
    startByte, endByte, [edgeId],
  );
}

function focusedLiteralFact(fieldKey, sourceText, startByte, endByte) {
  return focusedRangeFact(
    fieldKey, 'DEFINED_TERM', sourceText, sourceText, 'DEFINED_TERM_REFERENCE/V1',
    startByte, endByte,
  );
}

function focusedEnumFact(fieldKey, sourceText, startByte, endByte) {
  const typedValue = (sourceText.normalize('NFKC').toLowerCase()
    .match(/[\p{L}\p{N}]+/gu) ?? []).join('_').toUpperCase();
  return focusedRangeFact(
    fieldKey, 'ENUM', sourceText, typedValue, 'ENUM_LITERAL_MAP/V1',
    startByte, endByte,
  );
}

function focusedDurationFact(fieldKey, sourceText, typedValue, startByte, endByte,
  legalEffectRole, temporalScopeSignature, sharedSourceKey = null) {
  return focusedRangeFact(
    fieldKey, 'DURATION', sourceText, typedValue, 'DURATION_PARSER/V1',
    startByte, endByte, [], {
      legal_effect_role: legalEffectRole,
      temporal_scope_signature: temporalScopeSignature,
      ...(sharedSourceKey === null ? {} : { shared_source_key: sharedSourceKey }),
    },
  );
}

function focusedReferenceFact(fieldKey, sourceText, targetId, startByte, endByte) {
  const edgeId = `edge-focused-${fieldKey.toLowerCase()}-${startByte}`;
  const spec = focusedRangeFact(
    fieldKey, 'REFERENCE', sourceText, targetId, 'REFERENCE_EDGE/V1',
    startByte, endByte, [edgeId],
  );
  spec.focused_parts[0].context_target_id = targetId;
  return spec;
}

function focusedFactSpecsForDraft(draft) {
  const { case_id: caseId, effect_index: effectIndex, negative_case_id: negativeCaseId } = draft;
  if (caseId === 'item-28-linked-d-and-o-rights-survival') {
    if (effectIndex === 0) {
      const duration = focusedDurationFact(
        'RIGHTS_SURVIVAL_DURATION', 'not less than six (6) years',
        { bound_type: negativeCaseId === 'item-28-at-least-duration-collapsed-to-exact'
          ? 'EXACT' : 'AT_LEAST', count: 6, unit: 'YEAR' },
        283510, 283537, 'RIGHTS_SURVIVAL_PERIOD',
        'FROM_OPCO_MERGER_EFFECTIVE_TIME_AT_LEAST_SIX_YEARS',
      );
      return [
        duration,
        focusedLiteralFact('RIGHTS_SURVIVAL_START_EVENT',
          'OpCo Merger Effective Time', 283547, 283573),
        focusedPartySetFact('APPLIES_TO',
          'the Surviving Company and the Surviving OpCo', [
            { start_byte: 283575, end_byte: 283596, target_id: 'SURVIVING_COMPANY' },
            { start_byte: 283596, end_byte: 283601, target_id: null },
            { start_byte: 283601, end_byte: 283619, target_id: 'SURVIVING_OPCO' },
          ]),
        focusedEnumFact('LEGAL_EFFECT', 'shall', 283620, 283625),
        focusedEnumFact('EXCULPATION_RIGHT', 'exculpation', 283680, 283691),
        focusedEnumFact('RIGHTS_SURVIVAL', 'indemnification', 283693, 283708),
        focusedLiteralFact('ADVANCEMENT_RIGHT', 'advancement of expenses', 283713, 283736),
        focusedLiteralFact('RIGHTS_MAINTENANCE_STANDARD',
          'provisions no less favorable than such rights', 284228, 284273),
      ];
    }
    return [
      focusedLiteralFact('PROTECTED_PROVISIONS', 'which provisions', 284275, 284291),
      focusedEnumFact('LEGAL_EFFECT', 'shall', 284292, 284297),
      focusedEnumFact('NO_ADVERSE_AMENDMENT', 'amended', 284305, 284312),
      focusedEnumFact('NO_ADVERSE_REPEAL', 'repealed', 284314, 284322),
      focusedEnumFact('NO_ADVERSE_MODIFICATION', 'modified', 284326, 284334),
      focusedDurationFact(
        'NO_ADVERSE_AMENDMENT_DURATION', 'six (6) years',
        { bound_type: 'EXACT', count: 6, unit: 'YEAR' },
        284351, 284364, 'NO_ADVERSE_AMENDMENT_PROTECTION_PERIOD',
        'FOLLOWING_OPCO_MERGER_EFFECTIVE_TIME_EXACTLY_SIX_YEARS',
      ),
      focusedLiteralFact('NO_ADVERSE_START_EVENT',
        'OpCo Merger Effective Time', 284379, 284405),
      focusedLiteralFact('ADVERSE_EFFECT_STANDARD', 'affect adversely', 284431, 284447),
      focusedPartyFact('APPLIES_TO', 'Indemnified Parties',
        'INDEMNIFIED_PARTIES', 284477, 284496),
    ];
  }
  if (caseId === 'item-42-linked-d-and-o-rights-survival') {
    const durationValue = {
      bound_type: negativeCaseId === 'duration-bound-type-is-open' ? 'MORE_THAN' : 'EXACT',
      count: negativeCaseId === 'duration-count-disagrees-with-source' ? 7 : 6,
      unit: negativeCaseId === 'duration-unit-disagrees-with-source' ? 'MONTH' : 'YEAR',
    };
    if (effectIndex === 0) {
      return [
        focusedEnumFact('RIGHTS_SURVIVAL', 'indemnification', 189496, 189511),
        focusedLiteralFact('ADVANCEMENT_RIGHT', 'advancement of expenses', 189513, 189536),
        focusedEnumFact('EXCULPATION_RIGHT', 'exculpation', 189542, 189553),
        focusedPartyFact('APPLIES_TO', 'Indemnified Persons',
          'INDEMNIFIED_PERSONS', 189806, 189825),
        focusedEnumFact('LEGAL_EFFECT', 'shall', 190173, 190178),
        focusedLiteralFact('RIGHTS_SURVIVAL_START_EVENT',
          'the Effective Time', 190187, 190205),
        focusedEnumFact('RIGHTS_OBSERVED', 'observed', 190368, 190376),
        focusedEnumFact('RIGHTS_MAINTAINED', 'maintained', 190381, 190391),
        focusedDurationFact(
          'RIGHTS_SURVIVAL_DURATION', 'six (6) years', durationValue,
          190511, 190524, 'RIGHTS_SURVIVAL_PERIOD',
          'FROM_EFFECTIVE_TIME_FOR_SIX_YEARS', 'item42-six-year-duration',
        ),
        focusedLiteralFact('RIGHTS_DURATION_START_EVENT',
          'the Effective Time', 190530, 190548),
      ];
    }
    if (effectIndex === 1) {
      return [
        focusedEnumFact('LEGAL_EFFECT', 'shall', 190210, 190215),
        focusedEnumFact('NO_ADVERSE_AMENDMENT', 'amended', 190223, 190230),
        focusedEnumFact('NO_ADVERSE_REPEAL', 'repealed', 190232, 190240),
        focusedEnumFact('NO_ADVERSE_MODIFICATION', 'modified', 190255, 190263),
        focusedLiteralFact('ADVERSE_EFFECT_STANDARD', 'adversely affect', 190289, 190305),
        focusedPartyFact('APPLIES_TO', 'any Indemnified Person',
          'INDEMNIFIED_PERSON', 190331, 190353),
        focusedDurationFact(
          'NO_ADVERSE_AMENDMENT_DURATION', 'six (6) years', durationValue,
          190511, 190524, 'NO_ADVERSE_AMENDMENT_PROTECTION_PERIOD',
          'FROM_EFFECTIVE_TIME_FOR_SIX_YEARS', 'item42-six-year-duration',
        ),
      ];
    }
    const claimSpecs = [
      focusedPartyFact('APPLIES_TO', 'Indemnified Persons',
        'INDEMNIFIED_PERSONS', 190071, 190090),
      focusedLiteralFact('CLAIM_MADE_PURSUANT_TO_RIGHTS',
        'any claim made pursuant to such rights', 190554, 190592),
      focusedEnumFact('LEGAL_EFFECT', 'shall', 190621, 190626),
      focusedReferenceFact('CLAIM_CONTINUES_SUBJECT_TO_SECTION',
        'Section 5.7(a)', 'SECTION_5_7_A', 190658, 190672),
      focusedReferenceFact('CLAIM_CONTINUES_WITH_RIGHTS',
        'Section 5.7(a)', 'SECTION_5_7_A', 190708, 190722),
      focusedLiteralFact('UNTIL_CLAIM_DISPOSITION',
        'disposition of such claim', 190729, 190754),
    ];
    if (negativeCaseId === 'item-42-deictic-period-parsed-as-direct-duration') {
      claimSpecs.push(focusedRangeFact(
        'CLAIM_CONTINUATION_PERIOD_REFERENCE', 'DURATION', 'such six-year period',
        { bound_type: 'EXACT', count: 6, unit: 'YEAR' }, 'DURATION_PARSER/V1',
        190600, 190620,
      ));
      claimSpecs.at(-1).deictic_direct_parse = true;
    }
    return claimSpecs;
  }
  if (caseId === 'item-44-separate-access-dimensions') {
    const businessHours = negativeCaseId === 'item-44-normal-business-hours-is-a-reference'
      ? focusedReferenceFact('BUSINESS_HOURS_TIMING', 'normal business hours',
        'NORMAL_BUSINESS_HOURS_REFERENCE', 129552, 129573)
      : focusedEnumFact('BUSINESS_HOURS_TIMING',
        negativeCaseId === 'item-44-normal-business-hours-support-is-truncated'
          ? 'business hours' : 'normal business hours',
        negativeCaseId === 'item-44-normal-business-hours-support-is-truncated'
          ? 129559 : 129552,
        129573);
    if (negativeCaseId === 'item-44-normal-business-hours-loses-normal') {
      businessHours.typed_value = 'BUSINESS_HOURS';
    }
    return [
      focusedLiteralFact('APPLICABLE_LAW_CONDITION', 'applicable Law', 129159, 129173),
      focusedLiteralFact('NOTICE_REQUIREMENT',
        'reasonable advance notice', 129369, 129394),
      focusedEnumFact('LEGAL_EFFECT', 'shall', 129423, 129428),
      focusedPartySetFact('APPLIES_TO', 'Parent and its Representatives', [
        { start_byte: 129475, end_byte: 129481, target_id: 'PARENT' },
        { start_byte: 129481, end_byte: 129486, target_id: null },
        { start_byte: 129486, end_byte: 129505, target_id: 'PARENT_REPRESENTATIVES' },
      ]),
      businessHours,
      focusedPartySetFact('ACCESS_OBJECTS', 'the Company and its Subsidiaries', [
        { start_byte: 129577, end_byte: 129588, target_id: 'COMPANY' },
        { start_byte: 129588, end_byte: 129593, target_id: null },
        { start_byte: 129593, end_byte: 129609, target_id: 'COMPANY_SUBSIDIARIES' },
      ]),
      focusedEnumFact('ACCESS_PERSONNEL', 'personnel', 129611, 129620),
      focusedEnumFact('ACCESS_BOOKS', 'books', 129626, 129631),
      focusedEnumFact('ACCESS_RECORDS', 'records', 129636, 129643),
      focusedEnumFact('ACCESS_PURPOSE', 'strategic', 129691, 129700),
      focusedLiteralFact('INTEGRATION_PLANNING', 'integration planning', 129705, 129725),
      focusedLiteralFact('TRANSACTION_PURPOSE',
        'consummation of the Transactions', 129734, 129766),
      focusedLiteralFact('REASONABLENESS', 'reasonable time', 129822, 129837),
      focusedRangeFact('NON_INTERFERENCE', 'BOOLEAN', 'not', false,
        'BOOLEAN_LITERAL_MAP/V1', 129862, 129865),
      focusedLiteralFact('NON_INTERFERENCE_SCOPE',
        'normal operation of the business of the Company', 129901, 129948),
    ];
  }
  return null;
}

function temporalFactSpec(effect, effectIndex, fieldKey) {
  const negativeCaseId = effect.negative_case_id;
  if (fieldKey === 'CURE_DEADLINE_INITIAL' || fieldKey === 'CURE_DEADLINE_OUTER') {
    const source = fieldKey === 'CURE_DEADLINE_INITIAL' ? '2026-09-01' : '2026-09-02';
    return factSpec(fieldKey, 'DATE', source, source, 'DATE_ISO_PARSER/V1');
  }
  if (fieldKey === 'RIGHTS_SURVIVAL_DURATION'
      || fieldKey === 'NO_ADVERSE_AMENDMENT_DURATION') {
    if (effect.case_id === 'item-28-linked-d-and-o-rights-survival') {
      const spec = fieldKey === 'RIGHTS_SURVIVAL_DURATION'
        ? factSpec(fieldKey, 'DURATION',
          'not less than six (6) years', {
          bound_type: 'AT_LEAST', count: 6, unit: 'YEAR',
        }, 'DURATION_PARSER/V1')
        : factSpec(fieldKey, 'DURATION',
          'six (6) years', {
          bound_type: 'EXACT', count: 6, unit: 'YEAR',
        }, 'DURATION_PARSER/V1');
      spec.source_prefix = fieldKey === 'NO_ADVERSE_AMENDMENT_DURATION'
        ? 'for a period of ' : '';
      spec.source_suffix = fieldKey === 'RIGHTS_SURVIVAL_DURATION'
        ? ' from the OpCo Merger Effective Time'
        : ' following the OpCo Merger Effective Time';
      spec.legal_effect_role = fieldKey === 'RIGHTS_SURVIVAL_DURATION'
        ? 'RIGHTS_SURVIVAL_PERIOD' : 'NO_ADVERSE_AMENDMENT_PROTECTION_PERIOD';
      spec.temporal_scope_signature = fieldKey === 'RIGHTS_SURVIVAL_DURATION'
        ? 'FROM_OPCO_MERGER_EFFECTIVE_TIME_AT_LEAST_SIX_YEARS'
        : 'FOLLOWING_OPCO_MERGER_EFFECTIVE_TIME_EXACTLY_SIX_YEARS';
      if (fieldKey === 'RIGHTS_SURVIVAL_DURATION'
          && negativeCaseId === 'item-28-at-least-duration-collapsed-to-exact') {
        spec.typed_value.bound_type = 'EXACT';
      }
      if (fieldKey === 'RIGHTS_SURVIVAL_DURATION'
          && negativeCaseId === 'duration-within-source-labelled-exact') {
        spec.source_text = 'within six (6) years';
        spec.typed_value = { bound_type: 'EXACT', count: 6, unit: 'YEAR' };
      }
      return spec;
    }
    assert.equal(effect.case_id, 'item-42-linked-d-and-o-rights-survival');
    const spec = factSpec(fieldKey, 'DURATION', 'six (6) years', {
      bound_type: 'EXACT', count: 6, unit: 'YEAR',
    }, 'DURATION_PARSER/V1');
    spec.shared_source_key = 'item42-six-year-duration';
    spec.source_prefix = 'for a period of ';
    spec.source_suffix = ' from the Effective Time';
    spec.legal_effect_role = fieldKey === 'RIGHTS_SURVIVAL_DURATION'
      ? 'RIGHTS_SURVIVAL_PERIOD' : 'NO_ADVERSE_AMENDMENT_PROTECTION_PERIOD';
    spec.temporal_scope_signature = 'FROM_EFFECTIVE_TIME_FOR_SIX_YEARS';
    if (negativeCaseId === 'duration-word-parenthetical-number-disagrees') {
      spec.source_text = 'six (7) years';
    }
    if (fieldKey === 'RIGHTS_SURVIVAL_DURATION') {
      if (negativeCaseId === 'duration-bound-type-is-open') {
        spec.typed_value.bound_type = 'MORE_THAN';
      } else if (negativeCaseId === 'duration-count-disagrees-with-source') {
        spec.typed_value.count = 7;
      } else if (negativeCaseId === 'duration-unit-disagrees-with-source') {
        spec.typed_value.unit = 'MONTH';
      }
    }
    return spec;
  }
  if (fieldKey === 'WITHIN_DURATION') {
    return factSpec(fieldKey, 'DURATION', 'within six (6) years', {
      bound_type: negativeCaseId === 'duration-within-source-labelled-exact'
        ? 'EXACT' : 'WITHIN',
      count: 6,
      unit: 'YEAR',
    }, 'DURATION_PARSER/V1');
  }
  if (fieldKey === 'EXACT_DURATION') {
    return factSpec(fieldKey, 'DURATION',
      negativeCaseId === 'duration-word-parenthetical-number-disagrees'
        ? 'six (7) years' : 'six (6) years', {
        bound_type: 'EXACT', count: 6, unit: 'YEAR',
      }, 'DURATION_PARSER/V1');
  }
  assert.equal(fieldKey, 'BUSINESS_HOURS_TIMING',
    `unsupported temporal field ${fieldKey}`);
  const businessHours = factSpec(
    fieldKey, 'ENUM', 'normal business hours', 'NORMAL_BUSINESS_HOURS',
    'ENUM_LITERAL_MAP/V1',
  );
  if (negativeCaseId === 'item-44-normal-business-hours-is-a-reference') {
    businessHours.value_type = 'REFERENCE';
    businessHours.typed_value = 'NORMAL_BUSINESS_HOURS_REFERENCE';
    businessHours.normalisation_rule = 'REFERENCE_EDGE/V1';
    businessHours.context_edge_ids = [`edge-business-hours-reference-${effectIndex}`];
  } else if (negativeCaseId === 'item-44-normal-business-hours-loses-normal') {
    businessHours.typed_value = 'BUSINESS_HOURS';
  } else if (negativeCaseId === 'item-44-normal-business-hours-support-is-truncated') {
    businessHours.source_text = 'business hours';
  }
  return businessHours;
}

const semanticTemporalFactNegativeCaseIds = new Set([
  'duration-bound-type-is-open',
  'duration-word-parenthetical-number-disagrees',
  'item-28-at-least-duration-collapsed-to-exact',
  'duration-count-disagrees-with-source',
  'duration-unit-disagrees-with-source',
  'duration-within-source-labelled-exact',
  'item-42-deictic-period-parsed-as-direct-duration',
  'item-44-normal-business-hours-is-a-reference',
  'item-44-normal-business-hours-loses-normal',
  'item-44-normal-business-hours-support-is-truncated',
]);

function standardFactSpecs(effect, effectIndex, includeAllTypes) {
  const specs = [
    factSpec('LEGAL_EFFECT', 'ENUM', 'shall', 'SHALL', 'ENUM_LITERAL_MAP/V1'),
    factSpec('APPLIES_TO', 'PARTY_SET', 'Company and Parent',
      { parties: ['COMPANY', 'PARENT'] }, 'BOUND_PARTY_ALIAS/V1', [
        `edge-applies-to-company-${effectIndex}`, `edge-applies-to-parent-${effectIndex}`,
      ]),
    factSpec('FAMILY_MARKER', 'ENUM', effect.family_marker_source,
      effect.family_marker_source.toUpperCase(), 'ENUM_LITERAL_MAP/V1'),
  ];
  const existing = new Set(specs.map((entry) => entry.field_key));
  let tokenIndex = 0;
  for (const fieldKey of effect.expression_fields) {
    if (existing.has(fieldKey)) continue;
    const temporal = effect.temporal_fields.includes(fieldKey);
    const source = `value${effectIndex + 1}${tokenIndex + 1}`;
    specs.push(temporal ? temporalFactSpec(effect, effectIndex, fieldKey)
      : factSpec(fieldKey, 'ENUM', source, source.toUpperCase(), 'ENUM_LITERAL_MAP/V1'));
    existing.add(fieldKey);
    tokenIndex += 1;
  }
  if (includeAllTypes && effectIndex === 0) {
    const additions = [
      factSpec('PARTY_VALUE', 'PARTY', 'Company', 'COMPANY',
        'BOUND_PARTY_ALIAS/V1', [`edge-party-value-company-${effectIndex}`]),
      factSpec('DEFINED_TERM_VALUE', 'DEFINED_TERM', 'Material Adverse Effect',
        'Material Adverse Effect', 'DEFINED_TERM_REFERENCE/V1'),
      factSpec('BOOLEAN_VALUE', 'BOOLEAN', 'yes', true, 'BOOLEAN_LITERAL_MAP/V1'),
      factSpec('NUMBER_VALUE', 'NUMBER', '42', 42, 'NUMBER_PARSER/V1'),
      factSpec('PERCENTAGE_VALUE', 'PERCENTAGE', '15%', 15, 'PERCENTAGE_PARSER/V1'),
      factSpec('MONEY_VALUE', 'MONEY', 'USD 100', { amount: 100, currency: 'USD' },
        'MONEY_PARSER/V1'),
      factSpec('DATE_VALUE', 'DATE', '2026-12-31', '2026-12-31', 'DATE_ISO_PARSER/V1'),
      factSpec('DURATION_VALUE', 'DURATION', 'within 3 days',
        { bound_type: 'WITHIN', count: 3, unit: 'DAY' }, 'DURATION_PARSER/V1'),
      factSpec('PERIOD_VALUE', 'PERIOD', '2 months',
        { bound_type: 'EXACT', count: 2, unit: 'MONTH' }, 'PERIOD_PARSER/V1'),
      factSpec('REFERENCE_VALUE', 'REFERENCE', 'Section 5.1', 'SECTION_5_1',
        'REFERENCE_EDGE/V1', [`edge-reference-value-${effectIndex}`]),
    ];
    for (const addition of additions) {
      if (!existing.has(addition.field_key)) specs.push(addition);
    }
  }
  return specs;
}

function makeEffectDrafts(definition, options) {
  if (definition.unmatched_inspected_effect && definition.effects.length === 0) {
    return [{
      effect_index: 0,
      has_rule: false,
      family_key: null,
      family_marker_source: 'unmatchedtoken',
      expression_tree: null,
      expression_nodes: [],
      expression_fields: [],
      temporal_fields: [],
      output_disposition: 'NO_OUTPUT',
      fact_specs: [],
    }];
  }
  return definition.effects.map((literal, effectIndex) => {
    const expressionTree = annotateExpressionTree(
      parseExpressionSignature(literal.expression_signature),
    );
    let marker = familyToken(literal.family_key);
    if (effectIndex === 0 && options.profileSourceVariant === 'NEAR_NEGATIVE') marker += 'x';
    if (effectIndex === 0 && options.profileSourceVariant === 'WRONG_FAMILY') {
      marker = familyToken(FAMILY_KEYS[(FAMILY_KEYS.indexOf(literal.family_key) + 1)
        % FAMILY_KEYS.length]);
    }
    if (effectIndex === 0 && options.profileSourceVariant === 'WRONG_SUBTYPE') {
      marker = 'unapprovedsubtypetoken';
    }
    if (effectIndex === 0 && options.profileSourceVariant === 'FALSE_MATCH') {
      marker = 'unmatchedtoken';
    }
    const draft = {
      ...literal,
      case_id: definition.case_id,
      negative_case_id: options.negativeCaseId ?? null,
      effect_index: effectIndex,
      has_rule: true,
      family_marker_source: marker,
      expression_tree: expressionTree.root,
      expression_nodes: expressionTree.expressions,
      expression_fields: expressionTree.fields,
      temporal_fields: literal.temporal_fields ?? [],
    };
    draft.fact_specs = standardFactSpecs(
      draft, effectIndex, definition.include_all_fact_value_types === true,
    );
    if (effectIndex === 0 && options.twoActorFacts === true) {
      const actorIndex = draft.fact_specs.findIndex(
        (spec) => spec.field_key === 'APPLIES_TO',
      );
      assert.notEqual(actorIndex, -1);
      const actorSpecs = [
        factSpec('APPLIES_TO', 'PARTY', 'Company', 'COMPANY',
          'BOUND_PARTY_ALIAS/V1', [`edge-two-actor-company-${effectIndex}`]),
        factSpec('APPLIES_TO', 'PARTY', 'Parent', 'PARENT',
          'BOUND_PARTY_ALIAS/V1', [`edge-two-actor-parent-${effectIndex}`]),
      ];
      actorSpecs[0].fact_instance_key = 'APPLIES_TO:COMPANY';
      actorSpecs[1].fact_instance_key = 'APPLIES_TO:PARENT';
      draft.fact_specs.splice(actorIndex, 1, ...actorSpecs);
      draft.applies_to_cardinality = 'ONE_OR_MORE';
    }
    if (draft.subprofile_key === 'CLAIM_CONTINUATION'
        && options.negativeCaseId
          === 'item-42-deictic-period-parsed-as-direct-duration') {
      const direct = factSpec(
        'CLAIM_CONTINUATION_PERIOD_REFERENCE', 'DURATION', 'such six-year period',
        { bound_type: 'EXACT', count: 6, unit: 'YEAR' }, 'DURATION_PARSER/V1',
      );
      direct.deictic_direct_parse = true;
      draft.fact_specs.push(direct);
    }
    if (effectIndex === 0 && options.secondReferenceFact === true) {
      draft.fact_specs.push(factSpec(
        'REFERENCE_VALUE_TWO', 'REFERENCE', 'Section 5.2', 'SECTION_5_2',
        'REFERENCE_EDGE/V1', [`edge-reference-value-two-${effectIndex}`],
      ));
    }
    if (effectIndex === 0 && options.materialProviso === true) {
      draft.fact_specs.push(factSpec(
        'PROVISO_VALUE', 'DEFINED_TERM', 'condition', 'condition',
        'DEFINED_TERM_REFERENCE/V1',
      ));
    }
    if (definition.case_id === 'item-33-scoped-partial-exception' && effectIndex === 0) {
      for (const fieldKey of definition.required_material_field_keys) {
        if (!draft.fact_specs.some((entry) => entry.field_key === fieldKey)) {
          draft.fact_specs.push(factSpec(
            fieldKey,
            'ENUM',
            fieldKey.toLowerCase().replaceAll('_', ' '),
            fieldKey,
            'ENUM_LITERAL_MAP/V1',
          ));
        }
      }
    }
    if (effectIndex === 0 && options.displayFactMode !== undefined) {
      const selected = draft.fact_specs.find((entry) => entry.field_key === 'FAMILY_MARKER');
      if (options.displayFactMode === 'DISPLAY_REQUIRED_NON_MATERIAL') {
        selected.materiality = 'NON_MATERIAL';
      } else if (options.displayFactMode === 'DISPLAY_OPTIONAL_NON_MATERIAL') {
        selected.materiality = 'NON_MATERIAL';
        selected.display_rule = 'DISPLAY_OPTIONAL';
      } else if (options.displayFactMode === 'NEVER_DISPLAY_NON_MATERIAL') {
        selected.materiality = 'NON_MATERIAL';
        selected.display_rule = 'NEVER_DISPLAY';
      } else {
        throw new Error(`unsupported display fact mode ${options.displayFactMode}`);
      }
    }
    if (draft.subprofile_key !== undefined) {
      const sourceToken = `subprofile${draft.subprofile_key.toLowerCase().replaceAll('_', '')}`;
      draft.subprofile_source_token = sourceToken;
      draft.fact_specs.push(factSpec(
        'SUBPROFILE_MARKER', 'ENUM', sourceToken, sourceToken.toUpperCase(),
        'ENUM_LITERAL_MAP/V1',
      ));
    }
    const focusedFactSpecs = focusedFactSpecsForDraft(draft);
    if (focusedFactSpecs !== null) {
      draft.fact_specs = focusedFactSpecs;
      draft.profile_match_tokens = draft.case_id === 'item-28-linked-d-and-o-rights-survival'
        ? draft.subprofile_key === 'RIGHTS_SURVIVAL'
          ? ['exculpation', 'advancement'] : ['amended', 'repealed']
        : draft.case_id === 'item-42-linked-d-and-o-rights-survival'
          ? draft.subprofile_key === 'RIGHTS_SURVIVAL'
            ? ['indemnification', 'advancement']
            : draft.subprofile_key === 'NO_ADVERSE_AMENDMENT'
              ? ['amended', 'repealed'] : ['claim', 'disposition']
          : ['normal', 'business', 'hours'];
    }
    return draft;
  });
}

function buildAgreementIndex(
  agreementId, sourceText, nodeId, sourceArtefactSpecs = [], inlineMarkerSpecs = [],
  nodeOptions = {},
) {
  const sourceBytes = Buffer.from(sourceText, 'utf8');
  const canonicalTextId = contentId('CANONICAL_TEXT/V1', { canonical_text: sourceText });
  const structuralPolicyDigest = sha256Hex('fixture-structural-policy');
  const extentSpan = {
    coordinate_system: 'UTF8_CANONICAL_TEXT_HALF_OPEN',
    start_byte: 0,
    end_byte: sourceBytes.length,
    text_sha256: sha256Hex(sourceBytes),
  };
  let rootNodeId = nodeId;
  const nodes = [{
    node_occurrence_id: nodeId,
    parent_node_occurrence_id: null,
    node_kind: 'SECTION',
    extent_span: extentSpan,
  }];
  if (nodeOptions.item42Sentence === true) {
    const agreementNodeId = `${nodeId}-agreement`;
    const articleNodeId = `${nodeId}-article`;
    const sectionNodeId = `${nodeId}-section`;
    const limbNodeId = `${nodeId}-limb`;
    rootNodeId = agreementNodeId;
    nodes.splice(0, 1,
      {
        node_occurrence_id: agreementNodeId,
        parent_node_occurrence_id: null,
        node_kind: 'AGREEMENT',
        extent_span: extentSpan,
      },
      {
        node_occurrence_id: articleNodeId,
        parent_node_occurrence_id: agreementNodeId,
        node_kind: 'ARTICLE',
        extent_span: extentSpan,
      },
      {
        node_occurrence_id: sectionNodeId,
        parent_node_occurrence_id: articleNodeId,
        node_kind: 'SECTION',
        extent_span: extentSpan,
      },
      {
        node_occurrence_id: limbNodeId,
        parent_node_occurrence_id: sectionNodeId,
        node_kind: 'LIMB',
        extent_span: extentSpan,
      },
      {
        node_occurrence_id: nodeId,
        parent_node_occurrence_id: limbNodeId,
        node_kind: 'SENTENCE',
        extent_span: extentSpan,
      });
  }
  if (inlineMarkerSpecs.length > 0) {
    assert.equal(inlineMarkerSpecs.length >= 2, true,
      'authored inline list requires at least two markers');
    inlineMarkerSpecs.forEach((spec, index) => {
      const limbStart = spec.start_byte;
      const limbEnd = inlineMarkerSpecs[index + 1]?.start_byte ?? sourceBytes.length;
      nodes.push({
        node_occurrence_id: spec.limb_node_occurrence_id,
        parent_node_occurrence_id: nodeId,
        node_kind: 'LIMB',
        roles: ['AUTHORED_INLINE_LIMB'],
        extent_span: {
          coordinate_system: 'UTF8_CANONICAL_TEXT_HALF_OPEN',
          start_byte: limbStart,
          end_byte: limbEnd,
          text_sha256: sha256Hex(sourceBytes.subarray(limbStart, limbEnd)),
        },
      });
    });
  }
  const sourceArtefacts = sourceArtefactSpecs.map((spec) => {
    const span = {
      coordinate_system: 'UTF8_CANONICAL_TEXT_HALF_OPEN',
      start_byte: spec.start_byte,
      end_byte: spec.end_byte,
      text_sha256: sha256Hex(sourceBytes.subarray(spec.start_byte, spec.end_byte)),
    };
    return {
      schema_version: 'AGREEMENT_SOURCE_ARTEFACT/V1',
      source_artefact_id: contentId('AGREEMENT_SOURCE_ARTEFACT/V1', {
        canonical_text_id: canonicalTextId,
        source_artefact_kind: spec.source_artefact_kind,
        start_byte: span.start_byte,
        end_byte: span.end_byte,
        text_sha256: span.text_sha256,
      }),
      source_artefact_kind: spec.source_artefact_kind,
      span,
      containing_node_occurrence_id: nodeId,
    };
  });
  const inlineMarkerDispositions = [];
  if (inlineMarkerSpecs.length > 0) {
    const unsignedDisposition = {
      schema_version: 'AGREEMENT_INLINE_MARKER_DISPOSITION/V1',
      disposition: 'AUTHORED_INLINE_LIST',
      reason: 'NATIVE_AUTHORED_INLINE_LIST_SEQUENCE',
      style: 'ALPHA_LOWER',
      depth: 1,
      parent_node_occurrence_id: nodeId,
      marker_spans: inlineMarkerSpecs.map((spec) => ({
        coordinate_system: 'UTF8_CANONICAL_TEXT_HALF_OPEN',
        start_byte: spec.start_byte,
        end_byte: spec.end_byte,
        text_sha256: sha256Hex(sourceBytes.subarray(spec.start_byte, spec.end_byte)),
      })),
      produced_limb_node_occurrence_ids: inlineMarkerSpecs.map(
        (spec) => spec.limb_node_occurrence_id,
      ),
    };
    inlineMarkerDispositions.push({
      ...unsignedDisposition,
      disposition_id: contentId(
        'AGREEMENT_INLINE_MARKER_DISPOSITION/V1', unsignedDisposition,
      ),
    });
  }
  const arrays = {
    annotations: [],
    source_artefacts: sourceArtefacts,
    aliases: [],
    ambiguities: [],
    diagnostics: [],
    inline_marker_dispositions: inlineMarkerDispositions,
  };
  const counts = { node_count: nodes.length };
  const inlineMarkerPartition = { proof_digest: sha256Hex('fixture-inline-partition') };
  const byteCoverage = { proof_digest: sha256Hex('fixture-byte-coverage') };
  const agreementIndexId = contentId('AGREEMENT_INDEX/V1', {
    agreement_id: agreementId,
    canonical_text_id: canonicalTextId,
    structural_policy_digest: structuralPolicyDigest,
    root_node_occurrence_id: rootNodeId,
    counts,
    node_set_digest: contentId('AGREEMENT_INDEX_NODE_SET/V1', nodes),
    annotation_set_digest: contentId('AGREEMENT_INDEX_ANNOTATION_SET/V1', arrays.annotations),
    source_artefact_set_digest: contentId(
      'AGREEMENT_INDEX_SOURCE_ARTEFACT_SET/V1', arrays.source_artefacts,
    ),
    alias_set_digest: contentId('AGREEMENT_INDEX_ALIAS_SET/V1', arrays.aliases),
    ambiguity_set_digest: contentId('AGREEMENT_INDEX_AMBIGUITY_SET/V1', arrays.ambiguities),
    diagnostic_set_digest: contentId('AGREEMENT_INDEX_DIAGNOSTIC_SET/V1', arrays.diagnostics),
    inline_marker_disposition_set_digest: contentId(
      'AGREEMENT_INDEX_INLINE_MARKER_DISPOSITION_SET/V1',
      arrays.inline_marker_dispositions,
    ),
    inline_marker_partition_proof_digest: inlineMarkerPartition.proof_digest,
    byte_coverage_proof_digest: byteCoverage.proof_digest,
  });
  return {
    schema_version: 'AGREEMENT_INDEX/V1',
    agreement_index_id: agreementIndexId,
    source_binding: {
      agreement_id: agreementId,
      canonical_text: sourceText,
      canonical_text_id: canonicalTextId,
      canonical_text_sha256: sha256Hex(sourceBytes),
      canonical_text_byte_length: sourceBytes.length,
    },
    structural_policy: { policy_digest: structuralPolicyDigest },
    root_node_occurrence_id: rootNodeId,
    counts,
    nodes,
    ...arrays,
    inline_marker_partition: inlineMarkerPartition,
    byte_coverage: byteCoverage,
  };
}

function makeFixtureRecord(fixtureId, occurrenceId, sourceText, {
  nodeKind = 'SECTION',
  ancestorNodeKinds = [],
  typedFacts = [],
  expectedMaterialFieldKeys = [],
  expectedDependencyBackedFieldKeys = [],
  expectedConditionalRequirementIds = [],
  expectedChildRuleRequirementIds = [],
  expectedExcludedDimensionKeys = [],
  expectedDelegatedDimensionKeys = [],
} = {}) {
  return sealBoundRecord('STAGE_2Y_M7_V2_MATCH_FIXTURE/V1', 'match_fixture_id', {
    fixture_id: fixtureId,
    input_occurrence_id: occurrenceId,
    authored_unit_source_text: sourceText,
    effect_source_text: sourceText,
    node_kind: nodeKind,
    ancestor_node_kinds: ancestorNodeKinds,
    context_edges: [],
    typed_facts: typedFacts,
    expected_material_field_keys: expectedMaterialFieldKeys,
    expected_dependency_backed_field_keys: expectedDependencyBackedFieldKeys,
    expected_conditional_requirement_ids: expectedConditionalRequirementIds,
    expected_child_rule_requirement_ids: expectedChildRuleRequirementIds,
    expected_excluded_dimension_keys: expectedExcludedDimensionKeys,
    expected_delegated_dimension_keys: expectedDelegatedDimensionKeys,
  });
}

function predicateDigest(leafId, matched) {
  return sha256Hex(canonicalJson({
    matched,
    leaf_results: [{ leaf_id: leafId, result: matched }],
  }));
}

function profileKey(familyKey) {
  return `PROFILE:${familyKey}`;
}

function profileRuling(familyKey) {
  const rulingId = PROGRAMME_RULING_BY_FAMILY.get(familyKey);
  assert.ok(rulingId, `missing programme ruling for ${familyKey}`);
  return rulingId;
}

function fieldRequirement(fieldKey, valueType, cardinality, rulingId,
  materiality = 'MATERIAL') {
  const body = {
    field_key: fieldKey,
    value_type: valueType,
    cardinality,
    materiality,
    lawyer_ruling_id: rulingId,
  };
  return {
    requirement_id: contentId('STAGE_2Y_M7_V2_PROFILE_REQUIREMENT/V1', body),
    ...body,
  };
}

function fixtureTypedFacts(fieldSpecs) {
  return fieldSpecs.map((field) => ({
    field_key: field.field_key,
    value_type: field.value_type,
    typed_value: field.typed_value,
    materiality: field.materiality ?? 'MATERIAL',
    dependency_types: [],
  })).sort((left, right) => left.field_key < right.field_key ? -1
    : left.field_key > right.field_key ? 1 : 0);
}

function profileFixtures(store, occurrenceId, fieldsByFamily) {
  const result = new Map();
  for (const familyKey of FAMILY_KEYS) {
    const token = familyToken(familyKey);
    const typedFacts = fixtureTypedFacts(fieldsByFamily.get(familyKey));
    const expectedMaterialFieldKeys = typedFacts.filter(
      (fact) => fact.materiality === 'MATERIAL',
    ).map((fact) => fact.field_key).sort();
    const fixtureOptions = { typedFacts, expectedMaterialFieldKeys };
    const positive = makeFixtureRecord(
      `fixture-positive-${familyKey}`, occurrenceId, token, fixtureOptions,
    );
    const nearNegative = makeFixtureRecord(
      `fixture-near-negative-${familyKey}`, `fixture-near-${familyKey}`, `${token}x`,
      fixtureOptions,
    );
    const wrongSubtype = makeFixtureRecord(
      `fixture-wrong-subtype-${familyKey}`, `fixture-subtype-${familyKey}`,
      `unapprovedsubtypetoken${familyKey.toLowerCase()}`, fixtureOptions,
    );
    result.set(familyKey, {
      positive: {
        record: positive,
        binding: addRecord(store, `fixture/match/${familyKey}/positive.json`, positive,
          'match_fixture_id'),
      },
      nearNegative: {
        record: nearNegative,
        binding: addRecord(store, `fixture/match/${familyKey}/near-negative.json`, nearNegative,
          'match_fixture_id'),
      },
      wrongSubtype: {
        record: wrongSubtype,
        binding: addRecord(store, `fixture/match/${familyKey}/wrong-subtype.json`, wrongSubtype,
          'match_fixture_id'),
      },
    });
  }
  return result;
}

function profileFieldSpecs(effectDrafts, definition) {
  const specsByFamily = new Map();
  for (const familyKey of FAMILY_KEYS) {
    specsByFamily.set(familyKey, [
      {
        field_key: 'APPLIES_TO', value_type: 'PARTY_SET',
        typed_value: { parties: ['COMPANY', 'PARENT'] },
      },
      { field_key: 'LEGAL_EFFECT', value_type: 'ENUM', typed_value: 'SHALL' },
      {
        field_key: 'FAMILY_MARKER', value_type: 'ENUM',
        typed_value: familyToken(familyKey).toUpperCase(),
      },
    ]);
  }
  for (const effect of effectDrafts.filter((entry) => entry.has_rule)) {
    const existing = specsByFamily.get(effect.family_key);
    for (const spec of effect.fact_specs) {
      if (!existing.some((entry) => entry.field_key === spec.field_key)) {
        existing.push({
          field_key: spec.field_key,
          value_type: spec.value_type,
          typed_value: spec.typed_value,
        });
      }
    }
    if (effect.missing_required_field
        && !existing.some((entry) => entry.field_key === effect.missing_required_field)) {
      existing.push({
        field_key: effect.missing_required_field,
        value_type: 'ENUM',
        typed_value: 'NOT_EXPRESSLY_STATED',
      });
    }
  }
  if (definition.unmatched_inspected_effect) return specsByFamily;
  return specsByFamily;
}

function buildProfileInfrastructure({
  store, definition, effectDrafts, occurrenceId, options = {},
}) {
  const globalDnoProfileDraft = (subprofileKey, fieldKey) => ({
    case_id: 'global-dno-profile-catalogue',
    family_key: 'DNO_INDEMNIFICATION',
    subprofile_key: subprofileKey,
    subprofile_source_token: `subprofile${subprofileKey.toLowerCase().replaceAll('_', '')}`,
    expression_signature: `ALL_OF(${subprofileKey},${fieldKey})`,
    fact_specs: [
      factSpec('LEGAL_EFFECT', 'ENUM', 'shall', 'SHALL', 'ENUM_LITERAL_MAP/V1'),
      factSpec('APPLIES_TO', 'PARTY_SET', 'Company and Parent', {
        parties: ['COMPANY', 'PARENT'],
      }, 'BOUND_PARTY_ALIAS/V1'),
      factSpec('FAMILY_MARKER', 'ENUM', familyToken('DNO_INDEMNIFICATION'),
        familyToken('DNO_INDEMNIFICATION').toUpperCase(), 'ENUM_LITERAL_MAP/V1'),
      factSpec(subprofileKey, 'ENUM', subprofileKey.toLowerCase(), subprofileKey,
        'ENUM_LITERAL_MAP/V1'),
      factSpec(fieldKey, 'DURATION', 'six (6) years', {
        bound_type: 'EXACT', count: 6, unit: 'YEAR',
      }, 'DURATION_PARSER/V1'),
    ],
  });
  const descriptorGroups = new Map();
  for (const familyKey of FAMILY_KEYS) {
    const familyDrafts = effectDrafts.filter((entry) => entry.family_key === familyKey);
    let descriptorDrafts = options.groupingEnabled === true && familyDrafts.length > 0
      ? [familyDrafts[0]] : familyDrafts.length === 0 ? [null] : familyDrafts;
    if (familyKey === 'DNO_INDEMNIFICATION') {
      descriptorDrafts = options.groupingEnabled === true && familyDrafts.length > 0
        ? [null] : [null, ...descriptorDrafts.filter((draft) => draft !== null)];
      const presentSubprofiles = new Set(descriptorDrafts.filter(Boolean).map(
        (draft) => draft.subprofile_key,
      ));
      if (!presentSubprofiles.has('RIGHTS_SURVIVAL')) {
        descriptorDrafts.push(globalDnoProfileDraft(
          'RIGHTS_SURVIVAL', 'RIGHTS_SURVIVAL_DURATION',
        ));
      }
      if (!presentSubprofiles.has('NO_ADVERSE_AMENDMENT')) {
        descriptorDrafts.push(globalDnoProfileDraft(
          'NO_ADVERSE_AMENDMENT', 'NO_ADVERSE_AMENDMENT_DURATION',
        ));
      }
    }
    const descriptors = descriptorDrafts.map(
      (draft, index) => ({
        family_key: familyKey,
        draft,
        subprofile_key: draft === null ? null
          : options.groupingEnabled === true && familyDrafts.includes(draft) ? null
            : draft.subprofile_key
              ?? (familyDrafts.length > 1
                ? `LINKED_EFFECT_${familyDrafts.indexOf(draft) + 1}` : null),
      }),
    );
    descriptorGroups.set(familyKey, descriptors);
  }
  const descriptors = [...descriptorGroups.values()].flat();
  for (const descriptor of descriptors) {
    descriptor.profile_key = descriptor.subprofile_key === null
      ? profileKey(descriptor.family_key)
      : `${profileKey(descriptor.family_key)}:${descriptor.subprofile_key}`;
    descriptor.match_tokens = descriptor.draft?.profile_match_tokens
      ?? options.profileMatchTokensByFamily?.[descriptor.family_key]
      ?? (descriptor.subprofile_key === null
        ? [familyToken(descriptor.family_key)]
        : [familyToken(descriptor.family_key), descriptor.draft.subprofile_source_token]);
    descriptor.excludedDimensions = options.excludedDimension !== undefined
      && descriptor.family_key === (options.excludedDimensionFamily ?? 'TERMINATION')
      && descriptor.subprofile_key === null
      ? [{
        dimension_key: options.excludedDimension.dimension_key,
        disposition: options.excludedDimension.disposition,
        lawyer_ruling_id: profileRuling(descriptor.family_key),
        owner_profile_id: options.excludedDimension.owner_profile_id,
        owner_field_key: options.excludedDimension.owner_field_key,
      }] : [];
    descriptor.delegatedDimensionKeys = options.ownershipLink === true
      && descriptor.family_key === (options.ownershipConsumerFamily ?? 'TERMINATION_FEE')
      && descriptor.subprofile_key === null ? ['TERMINATION_EVENT_OWNER'] : [];
    const item42ClaimContinuation = descriptor.draft?.case_id
      === 'item-42-linked-d-and-o-rights-survival'
      && descriptor.subprofile_key === 'CLAIM_CONTINUATION';
    const dimensionMutationTarget = descriptor.family_key
      === (definition.effects[0]?.family_key ?? 'TERMINATION')
      && descriptor.subprofile_key === null;
    const dimensionContractTarget = options.dimensionContract === true
      && descriptor.family_key === 'GENERAL_COVENANTS'
      && descriptor.subprofile_key === null;
    const dependencyDimensionTarget = dimensionMutationTarget
      && (options.profileDimensionEvidence === 'DEPENDENCY'
        || options.negativeCaseId === 'profile-dimension-evidence-omits-dependent-field');
    const conditionalDimensionTarget = dimensionMutationTarget
      && (options.profileDimensionEvidence === 'CONDITIONAL'
        || options.negativeCaseId === 'profile-dimension-evidence-omits-conditional-or-child-rule');
    const baseFields = descriptor.draft?.fact_specs ?? [
      factSpec('LEGAL_EFFECT', 'ENUM', 'shall', 'SHALL', 'ENUM_LITERAL_MAP/V1'),
      factSpec('APPLIES_TO', 'PARTY_SET', 'Company and Parent', {
        parties: ['COMPANY', 'PARENT'],
      }, 'BOUND_PARTY_ALIAS/V1'),
      factSpec('FAMILY_MARKER', 'ENUM', familyToken(descriptor.family_key),
        familyToken(descriptor.family_key).toUpperCase(), 'ENUM_LITERAL_MAP/V1'),
    ];
    descriptor.fields = descriptor.draft?.applies_to_cardinality === 'ONE_OR_MORE'
      ? [...new Map(baseFields.map((field) => [field.field_key, field])).values()]
      : [...baseFields];
    if (descriptor.draft?.missing_required_field
        && !descriptor.fields.some(
          (entry) => entry.field_key === descriptor.draft.missing_required_field,
        )) {
      descriptor.fields.push(factSpec(
        descriptor.draft.missing_required_field,
        'ENUM', 'not expressly stated', 'NOT_EXPRESSLY_STATED', 'ENUM_LITERAL_MAP/V1',
      ));
    }
    const typedFacts = fixtureTypedFacts(descriptor.fields);
    if (dimensionContractTarget) {
      typedFacts.find((entry) => entry.field_key === 'FAMILY_MARKER').dependency_types = [
        'REFERENCE_TARGET',
      ];
    }
    if (dependencyDimensionTarget) {
      typedFacts.find((entry) => entry.field_key === 'FAMILY_MARKER').dependency_types = [
        'REFERENCE_TARGET',
      ];
    }
    let expectedMaterialFieldKeys = typedFacts.filter(
      (entry) => entry.materiality === 'MATERIAL',
    ).map((entry) => entry.field_key).sort();
    const conditionalBody = {
      predicate: {
        field_key: 'FAMILY_MARKER',
        value_type: 'ENUM',
        operator: 'EQUALS',
        typed_value: familyToken(descriptor.family_key).toUpperCase(),
      },
      required_field_keys: ['FAMILY_MARKER'],
      lawyer_ruling_id: profileRuling(descriptor.family_key),
    };
    descriptor.conditionalRequirements = dimensionContractTarget || conditionalDimensionTarget
      ? [{
        conditional_requirement_id: contentId(
          'STAGE_2Y_M7_V2_PROFILE_CONDITIONAL_REQUIREMENT/V1', conditionalBody,
        ),
        ...conditionalBody,
      }] : [];
    if (dimensionMutationTarget
        && options.negativeCaseId === 'profile-dimension-evidence-omits-material-field') {
      expectedMaterialFieldKeys = expectedMaterialFieldKeys.slice(1);
    }
    const suffix = descriptor.profile_key.replaceAll(':', '-');
    const fixtureOptions = {
      nodeKind: options.allowedSourceTypeByFamily?.[descriptor.family_key] ?? 'SECTION',
      ancestorNodeKinds: descriptor.draft?.case_id
        === 'item-42-linked-d-and-o-rights-survival'
        ? ['LIMB', 'SECTION', 'ARTICLE', 'AGREEMENT'] : [],
      typedFacts,
      expectedMaterialFieldKeys,
      expectedExcludedDimensionKeys: descriptor.excludedDimensions.map(
        (entry) => entry.dimension_key,
      ).sort(),
      expectedDelegatedDimensionKeys: [
        ...descriptor.delegatedDimensionKeys,
        ...(item42ClaimContinuation ? ['CLAIM_CONTINUATION_PERIOD_REFERENCE'] : []),
      ].sort(),
      expectedDependencyBackedFieldKeys: dimensionMutationTarget
        && options.negativeCaseId === 'profile-dimension-evidence-omits-dependent-field'
        ? [] : typedFacts.filter((entry) => entry.dependency_types.length > 0)
          .map((entry) => entry.field_key).sort(),
      expectedConditionalRequirementIds: dimensionMutationTarget
        && options.negativeCaseId === 'profile-dimension-evidence-omits-conditional-or-child-rule'
        ? [] : descriptor.conditionalRequirements.map(
          (entry) => entry.conditional_requirement_id,
        ).sort(),
    };
    const positive = makeFixtureRecord(
      `fixture-positive-${suffix}`, occurrenceId, descriptor.match_tokens.join(' '),
      fixtureOptions,
    );
    const nearNegative = makeFixtureRecord(
      `fixture-near-negative-${suffix}`, `fixture-near-${suffix}`,
      `${descriptor.match_tokens.join(' ')}x`, fixtureOptions,
    );
    const wrongSubtype = makeFixtureRecord(
      `fixture-wrong-subtype-${suffix}`, `fixture-subtype-${suffix}`,
      descriptor.subprofile_key === null
        ? 'unapprovedsubtypetoken'
        : `${familyToken(descriptor.family_key)} unapprovedsubtypetoken`,
      fixtureOptions,
    );
    descriptor.fixtures = {
      positive: {
        record: positive,
        binding: addRecord(store, `fixture/match/${suffix}/positive.json`, positive,
          'match_fixture_id'),
      },
      nearNegative: {
        record: nearNegative,
        binding: addRecord(store, `fixture/match/${suffix}/near-negative.json`, nearNegative,
          'match_fixture_id'),
      },
      wrongSubtype: {
        record: wrongSubtype,
        binding: addRecord(store, `fixture/match/${suffix}/wrong-subtype.json`, wrongSubtype,
          'match_fixture_id'),
      },
    };
  }
  const profiles = [];
  const profileByDescriptor = new Map();
  for (const familyKey of FAMILY_KEYS) {
    const familyDescriptors = descriptorGroups.get(familyKey);
    let rootProfile = null;
    for (let index = 0; index < familyDescriptors.length; index += 1) {
      const descriptor = familyDescriptors[index];
      const item42ClaimContinuation = descriptor.draft?.case_id
        === 'item-42-linked-d-and-o-rights-survival'
        && descriptor.subprofile_key === 'CLAIM_CONTINUATION';
      const rulingId = profileRuling(familyKey);
      const requiredKeys = new Set(['APPLIES_TO', 'LEGAL_EFFECT']);
      if (descriptor.draft?.missing_required_field) {
        requiredKeys.add(descriptor.draft.missing_required_field);
      }
      const requiredFields = descriptor.fields.filter(
        (entry) => requiredKeys.has(entry.field_key),
      ).map((entry) => fieldRequirement(
        entry.field_key, entry.value_type,
        entry.field_key === 'APPLIES_TO'
          ? descriptor.draft?.applies_to_cardinality ?? 'ONE' : 'ONE',
        rulingId, entry.materiality,
      ));
      const optionalFields = descriptor.fields.filter(
        (entry) => !requiredKeys.has(entry.field_key),
      ).map((entry) => fieldRequirement(
        entry.field_key, entry.value_type, 'ZERO_OR_ONE', rulingId, entry.materiality,
      ));
      const childRuleProfiles = [];
      if (options.dimensionContract === true
          && descriptor.family_key === 'GENERAL_COVENANTS'
          && descriptor.subprofile_key === null) {
        const ownerProfile = profiles.find((entry) => entry.family_key === 'TERMINATION');
        assert.ok(ownerProfile,
          'dimension-contract fixture requires the earlier TERMINATION profile');
        const childBody = {
          profile_id: ownerProfile.profile_id,
          relationship_operator: 'ALL_OF',
          cardinality: 'ZERO_OR_MORE',
          lawyer_ruling_id: rulingId,
        };
        childRuleProfiles.push({
          child_rule_requirement_id: contentId(
            'STAGE_2Y_M7_V2_PROFILE_CHILD_RULE_REQUIREMENT/V1', childBody,
          ),
          ...childBody,
        });
        const suffix = descriptor.profile_key.replaceAll(':', '-');
        const rebuildFixture = (fixture, label) => {
          const body = { ...fixture.record };
          delete body.schema_version;
          delete body.match_fixture_id;
          body.expected_child_rule_requirement_ids = childRuleProfiles.map(
            (entry) => entry.child_rule_requirement_id,
          );
          const record = sealBoundRecord(
            'STAGE_2Y_M7_V2_MATCH_FIXTURE/V1', 'match_fixture_id', body,
          );
          return {
            record,
            binding: addRecord(
              store, `fixture/match/${suffix}/${label}-dimension-contract.json`, record,
              'match_fixture_id',
            ),
          };
        };
        descriptor.fixtures = {
          positive: rebuildFixture(descriptor.fixtures.positive, 'positive'),
          nearNegative: rebuildFixture(descriptor.fixtures.nearNegative, 'near-negative'),
          wrongSubtype: rebuildFixture(descriptor.fixtures.wrongSubtype, 'wrong-subtype'),
        };
      }
      const nextFamily = FAMILY_KEYS[(FAMILY_KEYS.indexOf(familyKey) + 1) % FAMILY_KEYS.length];
      const nextDescriptor = descriptorGroups.get(nextFamily)[0];
      const leafId = `leaf-${descriptor.profile_key}`;
      const expectedRootSelectionForFixture = (fixture) => {
        if (index === 0) return null;
        assert.ok(rootProfile, 'subtype negative fixture requires its sealed family root');
        const sourceText = fixture.record.effect_source_text;
        const siblingProfiles = familyDescriptors.filter(
          (candidate) => candidate !== descriptor && candidate !== familyDescriptors[0],
        ).map((candidate) => ({
          profile_id: candidate.profile_key,
          profile_key: candidate.profile_key,
          match_test: {
            kind: candidate.match_tokens.length === 1
              ? 'SOURCE_TOKEN_SEQUENCE' : 'SOURCE_TOKEN_ALL',
            leaf_id: `fixture-selection-${candidate.profile_key}`,
            tokens: candidate.match_tokens,
          },
        }));
        assert.equal(
          claimedProfileResults(siblingProfiles, sourceText).results.some(
            (result) => result.matched,
          ),
          false,
          'subtype negative fixture must not match a sibling subtype',
        );
        return claimedProfileResults([rootProfile], sourceText).selectedProfileKey;
      };
      const nearNegativeSelectedProfileKey = expectedRootSelectionForFixture(
        descriptor.fixtures.nearNegative,
      );
      const wrongSubtypeSelectedProfileKey = expectedRootSelectionForFixture(
        descriptor.fixtures.wrongSubtype,
      );
      const fixtureProofs = [
        {
          fixture_id: descriptor.fixtures.positive.record.fixture_id,
          kind: 'POSITIVE',
          fixture_binding: descriptor.fixtures.positive.binding,
          input_occurrence_id: descriptor.fixtures.positive.record.input_occurrence_id,
          expected_match: true,
          expected_selected_profile_key: descriptor.profile_key,
          expected_predicate_result_digest: predicateDigest(leafId, true),
          decisive_leaf_ids: [leafId],
          lawyer_ruling_id: rulingId,
        },
        {
          fixture_id: descriptor.fixtures.nearNegative.record.fixture_id,
          kind: 'NEAR_NEGATIVE',
          fixture_binding: descriptor.fixtures.nearNegative.binding,
          input_occurrence_id: descriptor.fixtures.nearNegative.record.input_occurrence_id,
          expected_match: false,
          expected_selected_profile_key: nearNegativeSelectedProfileKey,
          expected_predicate_result_digest: predicateDigest(leafId, false),
          decisive_leaf_ids: [leafId],
          lawyer_ruling_id: rulingId,
        },
        {
          fixture_id: nextDescriptor.fixtures.positive.record.fixture_id,
          kind: 'WRONG_FAMILY',
          fixture_binding: nextDescriptor.fixtures.positive.binding,
          input_occurrence_id: nextDescriptor.fixtures.positive.record.input_occurrence_id,
          expected_match: false,
          expected_selected_profile_key: nextDescriptor.profile_key,
          expected_predicate_result_digest: predicateDigest(leafId, false),
          decisive_leaf_ids: [leafId],
          lawyer_ruling_id: rulingId,
        },
        {
          fixture_id: descriptor.fixtures.wrongSubtype.record.fixture_id,
          kind: 'WRONG_SUBTYPE',
          fixture_binding: descriptor.fixtures.wrongSubtype.binding,
          input_occurrence_id: descriptor.fixtures.wrongSubtype.record.input_occurrence_id,
          expected_match: false,
          expected_selected_profile_key: wrongSubtypeSelectedProfileKey,
          expected_predicate_result_digest: predicateDigest(leafId, false),
          decisive_leaf_ids: [leafId],
          lawyer_ruling_id: rulingId,
        },
      ];
      const allFieldKeys = [...requiredFields, ...optionalFields].map(
        (entry) => entry.field_key,
      );
      const displayFieldKeys = [
        ...allFieldKeys,
        ...descriptor.delegatedDimensionKeys,
        ...(item42ClaimContinuation ? ['CLAIM_CONTINUATION_PERIOD_REFERENCE'] : []),
      ];
      const displayOrder = options.displayFactMode !== undefined
        && displayFieldKeys.includes('FAMILY_MARKER')
        ? ['FAMILY_MARKER',
          ...displayFieldKeys.filter((field) => field !== 'FAMILY_MARKER')]
        : displayFieldKeys;
      const effectFieldKeys = allFieldKeys.filter((fieldKey) => fieldKey !== 'APPLIES_TO'
        && !(item42ClaimContinuation
          && fieldKey === 'CLAIM_CONTINUATION_PERIOD_REFERENCE'));
      const actorFieldKeys = [
        'APPLIES_TO',
        ...descriptor.delegatedDimensionKeys.filter(
          (dimensionKey) => dimensionKey === 'TERMINATION_EVENT_OWNER',
        ),
      ];
      assert.equal(
        actorFieldKeys.length, 1 + descriptor.delegatedDimensionKeys.length,
        'generic ownership may map only its exact APPLIES_TO-owner delegation',
      );
      const emptyMapping = () => ({
        field_keys: [], expression_signature_role: null, lawyer_ruling_id: rulingId,
      });
      const timingMapping = item42ClaimContinuation ? {
        field_keys: ['CLAIM_CONTINUATION_PERIOD_REFERENCE'],
        expression_signature_role: null,
        lawyer_ruling_id: 'M5-RULING-ONE-SEMANTIC-OWNER',
      } : emptyMapping();
      if (item42ClaimContinuation) {
        assert.equal(
          effectFieldKeys.includes('CLAIM_CONTINUATION_PERIOD_REFERENCE'), false,
          'item42 claim continuation period reference must not map to effect fields',
        );
        assert.deepEqual(
          timingMapping.field_keys, ['CLAIM_CONTINUATION_PERIOD_REFERENCE'],
          'item42 claim continuation timing mapping must contain only its period reference',
        );
      }
      const noComparisonPolicy = descriptor.draft?.output_disposition === 'NO_COMPARISON' ? {
        authority_kind: 'BEN_APPROVED_NO_COMPARISON_PROFILE',
        policy_id: `no-comparison-policy-${descriptor.profile_key}`,
        lawyer_ruling_id: rulingId,
        approver: 'BEN_GOODCHILD',
        legal_reason: 'NO_COMPARISON_OUTPUT_IS_INTENTIONALLY_AUTHORISED',
        covered_occurrence_class: descriptor.profile_key,
        positive_fixture_ids: [descriptor.fixtures.positive.record.fixture_id],
        near_negative_fixture_ids: [descriptor.fixtures.nearNegative.record.fixture_id],
      } : null;
      const subtypePath = descriptor.subprofile_key === null
        ? [familyKey] : [familyKey, descriptor.subprofile_key];
      const delegatedDimensions = descriptor.delegatedDimensionKeys.map((dimensionKey) => {
        const ownerProfile = profiles.find((entry) => entry.family_key === 'TERMINATION');
        assert.ok(ownerProfile, 'ownership fixture requires the TERMINATION owner profile first');
        return {
          dimension_key: dimensionKey,
          disposition: 'DELEGATED',
          lawyer_ruling_id: rulingId,
          owner_profile_id: ownerProfile.profile_id,
          owner_field_key: 'APPLIES_TO',
        };
      });
      if (descriptor.delegatedDimensionKeys.includes('TERMINATION_EVENT_OWNER')) {
        assert.deepEqual(
          actorFieldKeys, ['APPLIES_TO', 'TERMINATION_EVENT_OWNER'],
          'termination-event ownership must be grouping-relevant in the actor slot',
        );
        assert.equal(
          delegatedDimensions.find(
            (dimension) => dimension.dimension_key === 'TERMINATION_EVENT_OWNER',
          )?.owner_field_key,
          'APPLIES_TO',
          'termination-event ownership must delegate to the owner APPLIES_TO fact',
        );
        assert.equal(
          displayOrder.includes('TERMINATION_EVENT_OWNER'), true,
          'termination-event ownership must appear once in display order',
        );
      }
      if (item42ClaimContinuation) {
        const ownerProfile = profiles.find((entry) => entry.profile_key
          === 'PROFILE:DNO_INDEMNIFICATION:RIGHTS_SURVIVAL');
        assert.ok(ownerProfile, 'item42 claim continuation requires its rights owner profile');
        delegatedDimensions.push({
          dimension_key: 'CLAIM_CONTINUATION_PERIOD_REFERENCE',
          disposition: 'DELEGATED',
          lawyer_ruling_id: 'M5-RULING-ONE-SEMANTIC-OWNER',
          owner_profile_id: ownerProfile.profile_id,
          owner_field_key: 'RIGHTS_SURVIVAL_DURATION',
        });
        if (options.negativeCaseId === 'item-42-claim-profile-omits-period-delegation') {
          delegatedDimensions.pop();
        } else if (options.negativeCaseId
          === 'item-42-claim-profile-delegates-period-to-wrong-owner') {
          const wrongOwner = profiles.find((entry) => entry.profile_key
            === 'PROFILE:DNO_INDEMNIFICATION:NO_ADVERSE_AMENDMENT');
          assert.ok(wrongOwner);
          delegatedDimensions[0].owner_profile_id = wrongOwner.profile_id;
          delegatedDimensions[0].owner_field_key = 'NO_ADVERSE_AMENDMENT_DURATION';
        } else if (options.negativeCaseId
          === 'item-42-claim-profile-delegation-ruling-drift') {
          delegatedDimensions[0].lawyer_ruling_id = 'M5-RULING-ONE-SEMANTIC-OWNER-DRIFT';
        }
      }
      if (item42ClaimContinuation
          && (options.negativeCaseId === undefined || options.negativeCaseId === null)) {
        const declaredFieldKeys = [...requiredFields, ...optionalFields].map(
          (entry) => entry.field_key,
        );
        const delegatedFieldKeys = delegatedDimensions.filter(
          (entry) => entry.disposition === 'DELEGATED',
        ).map((entry) => entry.dimension_key);
        assert.equal(
          new Set([...declaredFieldKeys, ...delegatedFieldKeys]).size,
          declaredFieldKeys.length + delegatedFieldKeys.length,
          'item42 claim declared and delegated fields must be disjoint',
        );
        assert.deepEqual(
          delegatedFieldKeys, ['CLAIM_CONTINUATION_PERIOD_REFERENCE'],
          'item42 claim must delegate only its period reference',
        );
        assert.equal(
          new Set(displayOrder).size, displayOrder.length,
          'item42 claim display order must not repeat a declared or delegated field',
        );
        assert.deepEqual(
          [...displayOrder].sort(), [...declaredFieldKeys, ...delegatedFieldKeys].sort(),
          'item42 claim display order must cover the declared and delegated union',
        );
        assert.equal(
          effectFieldKeys.includes('CLAIM_CONTINUATION_PERIOD_REFERENCE'), false,
          'item42 claim period reference must remain outside effect mapping',
        );
        assert.deepEqual(
          timingMapping.field_keys, ['CLAIM_CONTINUATION_PERIOD_REFERENCE'],
          'item42 claim timing mapping must contain only its delegated period reference',
        );
      }
      let sharedSourceLawyerDecisionIds = [
        'PROFILE:DNO_INDEMNIFICATION:RIGHTS_SURVIVAL',
        'PROFILE:DNO_INDEMNIFICATION:NO_ADVERSE_AMENDMENT',
      ].includes(descriptor.profile_key)
        ? ['d44da4450537479614de70175996b16a86495de989d1795ed4c01b7cba24412e'] : [];
      if (descriptor.subprofile_key === 'RIGHTS_SURVIVAL'
          && options.negativeCaseId === 'item-42-rights-profile-lacks-shared-source-ruling') {
        sharedSourceLawyerDecisionIds = [];
      } else if (descriptor.subprofile_key === 'NO_ADVERSE_AMENDMENT'
          && options.negativeCaseId
            === 'item-42-no-adverse-profile-lacks-shared-source-ruling') {
        sharedSourceLawyerDecisionIds = [];
      } else if (item42ClaimContinuation
          && options.negativeCaseId === 'item-42-claim-profile-invents-shared-source-ruling') {
        sharedSourceLawyerDecisionIds = [
          'd44da4450537479614de70175996b16a86495de989d1795ed4c01b7cba24412e',
        ];
      } else if (descriptor.profile_key === 'PROFILE:TERMINATION'
          && options.negativeCaseId
            === 'item-42-unrelated-profile-invents-shared-source-ruling') {
        sharedSourceLawyerDecisionIds = [
          'd44da4450537479614de70175996b16a86495de989d1795ed4c01b7cba24412e',
        ];
      }
      if (options.negativeCaseId === undefined || options.negativeCaseId === null) {
        const exactSharedSourceProfileKeys = [
          'PROFILE:DNO_INDEMNIFICATION:RIGHTS_SURVIVAL',
          'PROFILE:DNO_INDEMNIFICATION:NO_ADVERSE_AMENDMENT',
        ];
        assert.deepEqual(
          sharedSourceLawyerDecisionIds,
          exactSharedSourceProfileKeys.includes(descriptor.profile_key)
            ? ['d44da4450537479614de70175996b16a86495de989d1795ed4c01b7cba24412e']
            : [],
          'item42 shared-source authority must belong only to its two exact profiles',
        );
      }
      const body = {
        profile_key: descriptor.profile_key,
        profile_set_version: 1,
        family_key: familyKey,
        parent_profile_id: index === 0 ? null : rootProfile.profile_id,
        subtype_path: subtypePath,
        classification_path: subtypePath,
        required_fields: requiredFields,
        optional_fields: optionalFields,
        conditional_requirements: descriptor.conditionalRequirements,
        minimum_floor_fields: ['APPLIES_TO', 'LEGAL_EFFECT'],
        allowed_source_types: [{
          source_type: options.allowedSourceTypeByFamily?.[familyKey] ?? 'SECTION',
          lawyer_ruling_id: rulingId,
        }],
        allowed_dependency_types: item42ClaimContinuation
          && options.negativeCaseId
            === 'item-42-claim-profile-disallows-duration-reference' ? []
          : item42ClaimContinuation ? [{
          dependency_type: 'DURATION_CONDITION_REFERENCE',
          lawyer_ruling_id: 'M5-RULING-ONE-SEMANTIC-OWNER',
        }] : options.unresolvedDependency === true
          || options.requiredDependencyState !== undefined
          || options.dimensionContract === true ? [{
          dependency_type: 'REFERENCE_TARGET', lawyer_ruling_id: rulingId,
        }] : [],
        child_rule_profiles: childRuleProfiles,
        allowed_operators: Object.keys(CHILD_ROLES),
        required_expression_signature: descriptor.draft?.expression_signature
          ?? 'ALL_OF(APPLIES_TO,FAMILY_MARKER)',
        equivalence_signature_mapping: {
          actor: {
            field_keys: actorFieldKeys, expression_signature_role: null,
            lawyer_ruling_id: rulingId,
          },
          effect: {
            field_keys: effectFieldKeys, expression_signature_role: 'CANONICAL_EXPRESSION',
            lawyer_ruling_id: rulingId,
          },
          standard: emptyMapping(),
          threshold: emptyMapping(),
          timing: timingMapping,
          conditions: emptyMapping(),
          qualifications: emptyMapping(),
        },
        display_order: displayOrder,
        grouping_policy: {
          allowed: options.groupingEnabled === true,
          compatible_profile_ids: [],
          lawyer_ruling_id: options.groupingEnabled === true ? rulingId : null,
        },
        known_relevant_dimensions: [...new Set([
          ...[...requiredFields, ...optionalFields].filter(
            (requirement) => requirement.materiality === 'MATERIAL',
          ).map((requirement) => requirement.field_key),
          ...descriptor.fixtures.positive.record.expected_dependency_backed_field_keys,
          ...descriptor.conditionalRequirements.flatMap((condition) => [
            condition.predicate.field_key,
            ...condition.required_field_keys,
          ]),
          ...descriptor.excludedDimensions.map((entry) => entry.dimension_key),
          ...descriptor.delegatedDimensionKeys,
          ...(item42ClaimContinuation ? ['CLAIM_CONTINUATION_PERIOD_REFERENCE'] : []),
          ...childRuleProfiles.map(
            (entry) => `CHILD_RULE:${entry.child_rule_requirement_id}`,
          ),
        ])].sort().map((dimensionKey) => ({
          dimension_key: dimensionKey,
          source: 'CALIBRATION',
          lawyer_ruling_id: item42ClaimContinuation
            && dimensionKey === 'CLAIM_CONTINUATION_PERIOD_REFERENCE'
            ? 'M5-RULING-ONE-SEMANTIC-OWNER' : rulingId,
        })),
        excluded_or_delegated_dimensions: [
          ...descriptor.excludedDimensions,
          ...delegatedDimensions,
        ],
        approved_structure_disposition_ids: [],
        no_comparison_policy: noComparisonPolicy,
        legal_authority_ids: item42ClaimContinuation
          ? [rulingId, 'M5-RULING-ONE-SEMANTIC-OWNER'].sort() : [rulingId],
        shared_source_lawyer_decision_ids: sharedSourceLawyerDecisionIds,
        fixture_proofs: fixtureProofs,
        match_test: {
          kind: descriptor.match_tokens.length === 1
            ? 'SOURCE_TOKEN_SEQUENCE' : 'SOURCE_TOKEN_ALL',
          leaf_id: leafId,
          tokens: descriptor.match_tokens,
          scope: 'EFFECT_SOURCE_SPANS',
        },
      };
      const profile = sealInlineRecord(
        'STAGE_2Y_M7_V2_APPROVED_FAMILY_PROFILE/V1', 'profile_id', body,
      );
      if (index === 0) rootProfile = profile;
      profiles.push(profile);
      profileByDescriptor.set(descriptor, profile);
    }
  }
  const descriptorByProfileKey = new Map(
    descriptors.map((descriptor) => [descriptor.profile_key, descriptor]),
  );
  const dimensionBindings = profiles.flatMap((profile) => {
    const descriptor = descriptorByProfileKey.get(profile.profile_key);
    const knownDimensionKeys = profile.known_relevant_dimensions.map(
      (entry) => entry.dimension_key,
    ).sort();
    const claimPeriodKey = 'CLAIM_CONTINUATION_PERIOD_REFERENCE';
    const item42ClaimContinuation = profile.profile_key
      === 'PROFILE:DNO_INDEMNIFICATION:CLAIM_CONTINUATION';
    let evidenceSubsets = item42ClaimContinuation ? [
      {
        path_suffix: 'dno',
        source_class: 'CALIBRATION',
        dimension_keys: knownDimensionKeys.filter((key) => key !== claimPeriodKey),
        lawyer_ruling_id: profileRuling(profile.family_key),
      },
      {
        path_suffix: 'period-reference',
        source_class: 'CALIBRATION',
        dimension_keys: [claimPeriodKey],
        lawyer_ruling_id: 'M5-RULING-ONE-SEMANTIC-OWNER',
      },
    ] : [{
      path_suffix: null,
      source_class: 'CALIBRATION',
      dimension_keys: knownDimensionKeys,
      lawyer_ruling_id: profileRuling(profile.family_key),
    }];
    if (item42ClaimContinuation) {
      assert.equal(evidenceSubsets.length, 2,
        'item42 claim must have exactly two dimension-evidence subsets');
      const seenDimensionKeys = new Set();
      for (const subset of evidenceSubsets) {
        assert.equal(subset.dimension_keys.length > 0, true,
          'item42 claim dimension-evidence subsets must be non-empty');
        assert.deepEqual(subset.dimension_keys, [...subset.dimension_keys].sort(),
          'item42 claim dimension-evidence subsets must be canonical');
        for (const dimensionKey of subset.dimension_keys) {
          assert.equal(seenDimensionKeys.has(dimensionKey), false,
            'item42 claim dimension-evidence subsets must be disjoint');
          seenDimensionKeys.add(dimensionKey);
          const knownDimension = profile.known_relevant_dimensions.find(
            (entry) => entry.dimension_key === dimensionKey,
          );
          assert.equal(knownDimension?.source, subset.source_class);
          assert.equal(knownDimension?.lawyer_ruling_id, subset.lawyer_ruling_id,
            'item42 claim dimension evidence must use the dimension authority');
        }
      }
      assert.deepEqual([...seenDimensionKeys].sort(), knownDimensionKeys,
        'item42 claim dimension-evidence subsets must cover the exact known union');
      if (options.negativeCaseId === 'profile-dimension-evidence-subsets-overlap') {
        evidenceSubsets.push({
          path_suffix: 'overlap',
          source_class: 'CALIBRATION',
          dimension_keys: [evidenceSubsets[0].dimension_keys[0]],
          lawyer_ruling_id: profileRuling(profile.family_key),
        });
      } else if (options.negativeCaseId
          === 'profile-dimension-evidence-union-omits-known-key') {
        evidenceSubsets[0].dimension_keys = evidenceSubsets[0].dimension_keys.slice(1);
      } else if (options.negativeCaseId
          === 'profile-dimension-evidence-subset-ruling-drift') {
        evidenceSubsets[1].lawyer_ruling_id = profileRuling(profile.family_key);
      } else if (options.negativeCaseId
          === 'profile-dimension-evidence-subset-invents-underived-key') {
        evidenceSubsets[0].dimension_keys = [
          ...evidenceSubsets[0].dimension_keys, 'UNAPPROVED_DIMENSION',
        ].sort();
      } else if (options.negativeCaseId
          === 'profile-dimension-evidence-subset-source-class-drift') {
        evidenceSubsets[1].source_class = 'ADVERSARIAL';
      }
    }
    const profilePath = profile.profile_key.replaceAll(':', '-');
    return evidenceSubsets.map((subset) => {
      const evidence = sealBoundRecord(
        'STAGE_2Y_M7_V2_DIMENSION_EVIDENCE/V1', 'dimension_evidence_id', {
          family_key: profile.family_key,
          profile_id: profile.profile_id,
          source_class: subset.source_class,
          evidence_binding: descriptor.fixtures.positive.binding,
          dimension_keys: subset.dimension_keys,
          lawyer_ruling_id: subset.lawyer_ruling_id,
        },
      );
      const pathSuffix = subset.path_suffix === null ? '' : `-${subset.path_suffix}`;
      return addRecord(
        store, `fixture/dimension/${profilePath}${pathSuffix}.json`, evidence,
        'dimension_evidence_id',
      );
    });
  }).sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
  const profileByFamily = new Map(FAMILY_KEYS.map((familyKey) => [
    familyKey,
    profiles.find((profile) => profile.family_key === familyKey),
  ]));
  const profileByEffect = new Map(effectDrafts.filter((draft) => draft.has_rule).map((draft) => {
    const descriptor = descriptors.find((entry) => entry.draft === draft);
    return [draft, profileByDescriptor.get(descriptor)];
  }));
  const treeBindings = [...FAMILY_KEYS].sort().map((familyKey) => {
    const familyProfiles = profiles.filter((profile) => profile.family_key === familyKey);
    const profileById = new Map(familyProfiles.map((profile) => [profile.profile_id, profile]));
    const tree = sealBoundRecord(
      'STAGE_2Y_M7_V2_REPAIR_SUBTYPE_TREE/V1', 'subtype_tree_id', {
        family_key: options.negativeCaseId === 'profile-tree-family-key-is-relabeled'
          && familyKey === (definition.effects[0]?.family_key ?? 'TERMINATION')
          ? FAMILY_KEYS.find((entry) => entry !== familyKey) : familyKey,
        tree_id: `tree-${familyKey}`,
        profile_set_version: 1,
        completeness_state: options.incompleteTreeFamily === familyKey
          ? 'TREE_OUTPUT_INCOMPLETE' : 'TREE_OUTPUT_COMPLETE',
        nodes: familyProfiles.map((profile) => ({
          profile_key: profile.profile_key,
          parent_profile_key: profile.parent_profile_id === null
            ? null : profileById.get(profile.parent_profile_id).profile_key,
          node_state: options.negativeCaseId === 'generic-abstract-ancestor-emits-normal'
            && familyKey === (definition.effects[0]?.family_key ?? 'TERMINATION')
            ? 'ABSTRACT' : 'TERMINAL_OUTPUT_PERMITTED',
        })),
      },
    );
    return {
      family_key: familyKey,
      binding: addRecord(
        store, `fixture/trees/${familyKey}.json`, tree, 'subtype_tree_id',
      ),
    };
  });
  const profileOwnedTreeBindings = options.negativeCaseId
    === 'profile-set-misses-family-subtype-tree' ? treeBindings.slice(1) : treeBindings;
  let candidateTreeBindings = treeBindings;
  if (options.negativeCaseId === 'profile-set-tree-binding-differs-from-candidate') {
    const target = treeBindings.find(
      (entry) => entry.family_key === (definition.effects[0]?.family_key ?? 'TERMINATION'),
    );
    const alternateTree = JSON.parse(store.get(target.binding.path).toString('utf8'));
    alternateTree.tree_id += '-candidate-drift';
    restampInline(
      alternateTree, 'STAGE_2Y_M7_V2_REPAIR_SUBTYPE_TREE/V1', 'subtype_tree_id',
    );
    const alternateBinding = addRecord(
      store, `${target.binding.path}.candidate-drift.json`, alternateTree, 'subtype_tree_id',
    );
    candidateTreeBindings = treeBindings.map((entry) => entry === target
      ? { family_key: entry.family_key, binding: alternateBinding } : entry);
  }
  const profileSet = sealBoundRecord(
    'STAGE_2Y_M7_V2_APPROVED_FAMILY_PROFILE_SET/V1', 'family_profile_set_id', {
      state: 'BEN_APPROVED_PROFILE_SET',
      profiles,
      dimension_evidence_bindings: dimensionBindings,
      subtype_tree_bindings: profileOwnedTreeBindings,
    },
  );
  const profileSetBinding = addRecord(
    store, 'fixture/inputs/family-profile-set.json', profileSet, 'family_profile_set_id',
  );
  const treeByFamily = new Map(treeBindings.map((entry) => [entry.family_key, entry.binding]));
  const snapshots = profiles.map((profile) => ({
    ...profile,
    profile_set_binding: profileSetBinding,
    tree_binding: treeByFamily.get(profile.family_key),
  }));
  return {
    fixtureByFamily: new Map(FAMILY_KEYS.map((familyKey) => [
      familyKey, descriptorGroups.get(familyKey)[0].fixtures,
    ])),
    profiles,
    profileByFamily,
    profileByEffect,
    profileSet,
    profileSetBinding,
    treeBindings: candidateTreeBindings,
    snapshots,
  };
}

function buildFocusedWork0SourceBundle({ store, agreementId, drafts, scenarioKey, options }) {
  const config = FOCUSED_WORK0_SOURCE_CONFIG[scenarioKey];
  assert.ok(config, `focused Work0 source configuration is missing for ${scenarioKey}`);
  const fixedEvidence = addEvidenceFile(store, FIXED_SAMPLE_PATH);
  const fixedMember = fixedEvidence.record.members.find(
    (member) => member.sample_ordinal === config.sample_ordinal,
  );
  assert.ok(fixedMember, `fixed Work0 member ${config.sample_ordinal} is missing`);
  assert.equal(agreementId, fixedMember.agreement_id);
  assert.equal(fixedMember.source_node_occurrence_ids.length, 1);
  assert.equal(fixedMember.source_spans.length, 1);
  const fixedSpan = fixedMember.source_spans[0];
  const selected = addEvidenceFile(store, fixedMember.agreement_index_binding.path);
  const agreementIndex = selected.record;
  for (const key of [
    'path', 'schema_version', 'record_id_field', 'record_id', 'byte_length', 'sha256',
  ]) {
    assert.deepEqual(selected.binding[key], fixedMember.agreement_index_binding[key],
      `focused Work0 AgreementIndex ${key} drifted`);
  }
  assert.equal(agreementIndex.source_binding.agreement_id, fixedMember.agreement_id);
  assert.deepEqual({
    canonical_text_id: agreementIndex.source_binding.canonical_text_id,
    canonical_text_sha256: agreementIndex.source_binding.canonical_text_sha256,
    canonical_text_byte_length: agreementIndex.source_binding.canonical_text_byte_length,
  }, fixedMember.canonical_source_binding);
  const nodeId = fixedMember.source_node_occurrence_ids[0];
  const nodeById = new Map(agreementIndex.nodes.map(
    (node) => [node.node_occurrence_id, node],
  ));
  const sourceNode = nodeById.get(nodeId);
  assert.ok(sourceNode, `focused Work0 source node ${nodeId} is absent`);
  assert.equal(sourceNode.extent_span.start_byte, fixedSpan.start_byte);
  assert.equal(sourceNode.extent_span.end_byte, fixedSpan.end_byte);
  assert.equal(sourceNode.extent_span.text_sha256, fixedSpan.text_sha256);
  const sourceBytes = Buffer.from(agreementIndex.source_binding.canonical_text, 'utf8');
  assert.equal(sourceBytes.length, fixedMember.canonical_source_binding.canonical_text_byte_length);
  assert.equal(sha256Hex(sourceBytes), fixedMember.canonical_source_binding.canonical_text_sha256);
  const governingStartByte = fixedSpan.start_byte;
  const governingEndByte = fixedSpan.end_byte;
  const nodeBytes = sourceBytes.subarray(governingStartByte, governingEndByte);
  const nodeText = nodeBytes.toString('utf8');
  assert.equal(sha256Hex(nodeBytes), fixedMember.source_excerpt_sha256);
  assert.equal(fixedMember.source_excerpt_sha256, fixedSpan.text_sha256);
  let agreementIndexBinding = selected.binding;
  if (options.negativeCaseId === 'focused-immutable-source-binding-drift') {
    const driftPath = `${selected.binding.path}.focused-binding-drift.json`;
    store.set(driftPath, Buffer.from(selected.bytes));
    agreementIndexBinding = bindingForBytes(
      driftPath,
      selected.bytes,
      agreementIndex.schema_version,
      'agreement_index_id',
      agreementIndex.agreement_index_id,
    );
  }

  const effectSegments = drafts.map(() => []);
  const physicalSegments = [];
  const physicalByRange = new Map();
  const aliases = [];
  const addPhysical = (segment) => {
    const key = `${segment.start_byte}:${segment.end_byte}`;
    assert.equal(physicalByRange.has(key), false,
      `focused source range ${key} has two physical owners`);
    physicalByRange.set(key, segment);
    physicalSegments.push(segment);
    return segment;
  };

  for (const [startByte, endByte] of config.technical_ranges) {
    addPhysical({
      kind: 'TECHNICAL_WHITESPACE',
      key: `focused-technical-${startByte}-${endByte}`,
      text: sourceBytes.subarray(startByte, endByte).toString('utf8'),
      start_byte: startByte,
      end_byte: endByte,
      effect_indexes: [],
    });
  }
  let dependencySegment = null;
  if (config.dependency_range !== undefined) {
    const [startByte, endByte, effectIndex] = config.dependency_range;
    dependencySegment = addPhysical({
      kind: 'DEPENDENCY',
      key: 'item42-claim-continuation-period-reference',
      text: sourceBytes.subarray(startByte, endByte).toString('utf8'),
      start_byte: startByte,
      end_byte: endByte,
      effect_indexes: [effectIndex],
      dependency_id: 'dependency-item42-claim-continuation-period',
      context_edge_id: 'edge-item42-claim-continuation-period',
      dependency_type: 'DURATION_CONDITION_REFERENCE',
      context_edge_type: 'DURATION_REFERENCE_TARGET',
    });
    assert.equal(dependencySegment.text, 'such six-year period');
    effectSegments[effectIndex].push(dependencySegment);
  }

  for (const draft of drafts) {
    for (const spec of draft.fact_specs) {
      const parts = spec.focused_parts;
      assert.equal(Array.isArray(parts) && parts.length > 0, true,
        `${scenarioKey} ${spec.field_key} lacks exact Work0 fact ranges`);
      const boundText = sourceBytes.subarray(
        parts[0].start_byte, parts.at(-1).end_byte,
      ).toString('utf8');
      assert.equal(boundText, spec.source_text,
        `${scenarioKey} ${spec.field_key} source bytes drifted`);
      for (const part of parts) {
        const key = `${part.start_byte}:${part.end_byte}`;
        const existing = physicalByRange.get(key);
        if (existing !== undefined) {
          if (spec.deictic_direct_parse === true && existing === dependencySegment) {
            const alias = {
              ...existing,
              kind: 'FACT',
              field_key: spec.field_key,
              shared_source_segment: existing,
            };
            delete alias.dependency_id;
            delete alias.context_edge_id;
            delete alias.dependency_type;
            delete alias.context_edge_type;
            delete alias.context_target_id;
            const dependencyIndex = effectSegments[draft.effect_index].indexOf(existing);
            assert.notEqual(dependencyIndex, -1,
              'direct-duration mutation requires the existing deictic dependency segment');
            aliases.push(alias);
            effectSegments[draft.effect_index].splice(dependencyIndex, 1, alias);
            continue;
          }
          assert.equal(spec.shared_source_key, 'item42-six-year-duration');
          assert.equal(existing.shared_source_key, spec.shared_source_key);
          const alias = {
            ...existing,
            field_key: spec.field_key,
            shared_source_segment: existing,
          };
          aliases.push(alias);
          effectSegments[draft.effect_index].push(alias);
          continue;
        }
        const text = sourceBytes.subarray(part.start_byte, part.end_byte).toString('utf8');
        const segment = addPhysical({
          kind: 'FACT',
          key: `focused-fact-${draft.effect_index}-${spec.field_key}-${part.start_byte}`,
          field_key: spec.field_key,
          text,
          start_byte: part.start_byte,
          end_byte: part.end_byte,
          effect_indexes: [draft.effect_index],
          ...(spec.shared_source_key === undefined
            ? {} : { shared_source_key: spec.shared_source_key }),
          ...(part.context_edge_id === undefined || part.context_edge_id === null ? {} : {
            context_edge_id: part.context_edge_id,
            context_edge_type: spec.value_type === 'REFERENCE'
              ? 'REFERENCE_TARGET' : 'PARTY_ALIAS',
            context_target_id: part.context_target_id,
          }),
        });
        if (spec.field_key === 'LEGAL_EFFECT') segment.operative_marker_kind = 'MODAL';
        effectSegments[draft.effect_index].push(segment);
      }
    }
  }

  for (const [startByte, endByte, effectIndex] of config.modal_ranges) {
    const key = `${startByte}:${endByte}`;
    const existing = physicalByRange.get(key);
    if (existing !== undefined) {
      assert.equal(existing.kind, 'FACT');
      assert.equal(existing.field_key, 'LEGAL_EFFECT');
      assert.equal(existing.text.toLowerCase(), 'shall');
      existing.operative_marker_kind = 'MODAL';
      continue;
    }
    const text = sourceBytes.subarray(startByte, endByte).toString('utf8');
    assert.equal(['shall', 'would'].includes(text.toLowerCase()), true);
    const segment = addPhysical({
      kind: 'EXPRESSION',
      key: `focused-modal-${startByte}-${endByte}`,
      text,
      start_byte: startByte,
      end_byte: endByte,
      effect_indexes: [effectIndex],
      operative_marker_kind: 'MODAL',
    });
    effectSegments[effectIndex].push(segment);
  }

  const cutPoints = new Set([governingStartByte, governingEndByte]);
  for (const [startByte, endByte] of config.primary_intervals) {
    cutPoints.add(startByte);
    cutPoints.add(endByte);
  }
  for (const segment of physicalSegments) {
    cutPoints.add(segment.start_byte);
    cutPoints.add(segment.end_byte);
  }
  const orderedCutPoints = [...cutPoints].sort((left, right) => left - right);
  const ownerForResidual = (startByte, endByte) => {
    const interval = config.primary_intervals.find(
      ([start, end]) => startByte >= start && endByte <= end,
    );
    assert.ok(interval,
      `focused residual ${startByte}:${endByte} has no exact legal-effect owner`);
    return interval[2];
  };
  for (let index = 0; index < orderedCutPoints.length - 1; index += 1) {
    const startByte = orderedCutPoints[index];
    const endByte = orderedCutPoints[index + 1];
    if (startByte === endByte) continue;
    const existing = physicalSegments.find(
      (segment) => segment.start_byte === startByte && segment.end_byte === endByte,
    );
    if (existing !== undefined) continue;
    const effectIndex = ownerForResidual(startByte, endByte);
    const segment = addPhysical({
      kind: 'EXPRESSION',
      key: `focused-residual-${startByte}-${endByte}`,
      text: sourceBytes.subarray(startByte, endByte).toString('utf8'),
      start_byte: startByte,
      end_byte: endByte,
      effect_indexes: [effectIndex],
    });
    effectSegments[effectIndex].push(segment);
  }
  physicalSegments.sort((left, right) => left.start_byte - right.start_byte);
  assert.equal(physicalSegments[0].start_byte, governingStartByte);
  assert.equal(physicalSegments.at(-1).end_byte, governingEndByte);
  physicalSegments.forEach((segment, index) => {
    if (index > 0) assert.equal(physicalSegments[index - 1].end_byte, segment.start_byte);
  });

  for (const draft of drafts) {
    const expressionSegments = effectSegments[draft.effect_index].filter(
      (segment) => segment.kind === 'EXPRESSION',
    ).sort((left, right) => left.start_byte - right.start_byte);
    assert.equal(expressionSegments.length >= draft.expression_nodes.length, true,
      `${scenarioKey} effect ${draft.effect_index} lacks expression connective spans`);
    expressionSegments.forEach((segment, index) => {
      segment.expression_key = index < draft.expression_nodes.length
        ? draft.expression_nodes[index].expression_key
        : draft.expression_tree.expression_key;
    });
  }

  for (const segment of physicalSegments) {
    const textBytes = sourceBytes.subarray(segment.start_byte, segment.end_byte);
    const hasAuthoredCharacters = /[\p{L}\p{N}]/u.test(segment.text);
    segment.span = {
      span_id: contentId('AGREEMENT_SOURCE_SPAN/V2', {
        agreement_index_id: agreementIndex.agreement_index_id,
        source_node_occurrence_id: nodeId,
        start_byte: segment.start_byte,
        end_byte: segment.end_byte,
        text_sha256: sha256Hex(textBytes),
      }),
      source_node_occurrence_id: nodeId,
      start_byte: segment.start_byte,
      end_byte: segment.end_byte,
      text_sha256: sha256Hex(textBytes),
      legal_text: hasAuthoredCharacters,
      operative: segment.operative_marker_kind !== undefined,
      materiality: hasAuthoredCharacters ? 'MATERIAL' : 'NON_MATERIAL',
    };
  }
  for (const alias of aliases) alias.span = alias.shared_source_segment.span;
  for (const selectedSegments of effectSegments) {
    selectedSegments.sort((left, right) => left.span.start_byte - right.span.start_byte);
  }

  const sharedDurationSegment = physicalSegments.find(
    (segment) => segment.shared_source_key === 'item42-six-year-duration',
  );
  let requiredDependency = null;
  if (dependencySegment !== null) {
    const ownerDraft = drafts.find((draft) => draft.subprofile_key === 'RIGHTS_SURVIVAL');
    const ownerSpec = ownerDraft.fact_specs.find(
      (spec) => spec.field_key === 'RIGHTS_SURVIVAL_DURATION',
    );
    assert.ok(ownerSpec && sharedDurationSegment);
    const ownerSemanticFactKey = buildFact(
      agreementId, ownerSpec, [sharedDurationSegment.span],
    ).semantic_fact_key;
    dependencySegment.context_target_id = ownerSemanticFactKey;
    requiredDependency = {
      dependency_id: dependencySegment.dependency_id,
      context_edge_id: dependencySegment.context_edge_id,
      dependency_type: dependencySegment.dependency_type,
      state: 'RESOLVED',
      target_id: ownerSemanticFactKey,
      source_support_ids: [dependencySegment.span.span_id],
    };
  }
  const contextEdges = physicalSegments.filter(
    (segment) => segment.context_edge_id !== undefined,
  ).map((segment) => ({
    edge_id: segment.context_edge_id,
    edge_type: segment.context_edge_type,
    target_id: segment.context_target_id,
    state: 'RESOLVED',
    source_support_ids: [segment.span.span_id],
  }));
  const sourceClosure = sealInlineRecord(
    'STAGE_2Y_M7_V2_REVIEWED_SOURCE_CLOSURE/V1', 'source_closure_id', {
      authored_unit_id: nodeId,
      agreement_index_binding: agreementIndexBinding,
      canonical_source_binding: clone(fixedMember.canonical_source_binding),
      source_node_occurrence_id: nodeId,
      complete_review_state: 'COMPLETE_REVIEWED_SOURCE_CLOSURE',
      governing_chapeau_span_ids: [physicalSegments[0].span.span_id],
      required_dependency_ids: requiredDependency === null
        ? [] : [requiredDependency.dependency_id],
      governing_start_byte: governingStartByte,
      governing_end_byte: governingEndByte,
      whitespace_punctuation_policy_id: 'EXACT_UTF8_PARTITION/V1',
      spans: physicalSegments.map((segment) => segment.span),
    },
  );
  const ancestorNodeKinds = [];
  let parentId = sourceNode.parent_node_occurrence_id;
  while (parentId !== null) {
    const parent = nodeById.get(parentId);
    assert.ok(parent);
    ancestorNodeKinds.push(parent.kind);
    parentId = parent.parent_node_occurrence_id;
  }
  return {
    nodeId,
    nodeKind: sourceNode.kind,
    ancestorNodeKinds,
    sourceText: nodeText,
    nodeText,
    sourceBytes,
    segments: physicalSegments,
    effectSegments,
    agreementIndex,
    agreementIndexBinding,
    sourceClosure,
    dependencies: requiredDependency === null ? [] : [requiredDependency],
    contextEdges,
    governingStartByte,
    governingEndByte,
    fixedMember,
    sourceExcerptSha256: fixedMember.source_excerpt_sha256,
  };
}

function buildSourceBundle({ store, agreementId, drafts, scenarioKey, options = {} }) {
  if (FOCUSED_WORK0_SOURCE_CONFIG[scenarioKey] !== undefined) {
    return buildFocusedWork0SourceBundle({
      store, agreementId, drafts, scenarioKey, options,
    });
  }
  const item42Temporal = scenarioKey === 'item-42-linked-d-and-o-rights-survival';
  const focusedSourceNodeIds = {
    'item-28-linked-d-and-o-rights-survival':
      '717b78ef0bd7b4f18a66f142e1213676c2ebc557e5d91811d348fe0ac9e47dc2',
    'item-42-linked-d-and-o-rights-survival':
      '005e1651ed5ba5f031509229658f4e9682d95f1b59ce894bfb4f319388ad9ad4',
    'item-44-separate-access-dimensions':
      'd011f79aae3c051670469038a679a5c72c80eb96af29cfe4f5d607c1d614aa19',
  };
  const nodeId = focusedSourceNodeIds[scenarioKey] ?? `authored-unit-${scenarioKey}`;
  const segments = [];
  const effectSegments = [];
  const sharedSourceSegments = new Map();
  const sharedAliases = [];
  const pendingDeicticDirectAliases = [];
  if (options.enumeratedLimb === true) {
    assert.equal(drafts.length >= 2 && drafts.length <= 26, true,
      'enumerated-limb fixture requires between two and 26 rule drafts');
    assert.equal(drafts.every((draft) => draft.has_rule), true,
      'enumerated-limb fixture cannot contain a no-output draft');
    drafts.forEach((draft, index) => {
      assert.equal(draft.fact_specs.some(
        (spec) => spec.field_key === 'AUTHORED_LIMB_MARKER',
      ), false, 'enumerated-limb fixture repeats its marker fact');
      const marker = `${String.fromCharCode(97 + index)}.`;
      draft.fact_specs.unshift(factSpec(
        'AUTHORED_LIMB_MARKER', 'ENUM', marker, marker, 'EXACT_TOKEN/V1', [],
      ));
    });
  }
  const append = (selected, segment) => {
    segments.push(segment);
    selected.push(segment);
  };
  const appendTechnicalWhitespace = (_selected, key, text = ' ') => {
    segments.push({ kind: 'TECHNICAL_WHITESPACE', key, text });
  };
  for (const draft of drafts) {
    const selected = [];
    if (!draft.has_rule) {
      if (segments.length > 0) append(selected, {
        kind: 'NO_OUTPUT', key: `no-output-space-${draft.effect_index}`, text: ' ',
      });
      append(selected, {
        kind: 'NO_OUTPUT', key: `no-output-modal-${draft.effect_index}`, text: 'shall',
        operative_marker_kind: 'MODAL',
      });
      append(selected, {
        kind: 'NO_OUTPUT', key: `no-output-text-${draft.effect_index}`,
        text: ` ${draft.family_marker_source}`,
      });
    } else {
      for (const spec of draft.fact_specs) {
        if (item42Temporal && spec.deictic_direct_parse === true) {
          pendingDeicticDirectAliases.push({ draft, spec, selected });
          continue;
        }
        if (item42Temporal && spec.shared_source_key !== undefined) {
          const existing = sharedSourceSegments.get(spec.shared_source_key);
          if (existing !== undefined) {
            const alias = {
              kind: 'FACT',
              key: `fact-${draft.effect_index}-${spec.field_key}-shared-alias`,
              field_key: spec.field_key,
              text: existing.text,
              shared_source_segment: existing,
            };
            selected.push(alias);
            sharedAliases.push(alias);
            continue;
          }
          if (segments.length > 0) appendTechnicalWhitespace(
            selected, `item42-shared-prefix-boundary-${draft.effect_index}`,
          );
          append(selected, {
            kind: 'EXPRESSION',
            key: `item42-shared-prefix-${draft.effect_index}`,
            expression_key: draft.expression_tree.expression_key,
            text: spec.source_prefix.trimEnd(),
          });
          appendTechnicalWhitespace(
            selected, `item42-shared-lexical-leading-${draft.effect_index}`,
          );
          const sharedSegment = {
            kind: 'FACT',
            key: `fact-${draft.effect_index}-${spec.field_key}`,
            field_key: spec.field_key,
            text: spec.source_text,
            shared_source_key: spec.shared_source_key,
          };
          append(selected, sharedSegment);
          sharedSourceSegments.set(spec.shared_source_key, sharedSegment);
          appendTechnicalWhitespace(
            selected, `item42-shared-lexical-trailing-${draft.effect_index}`,
          );
          append(selected, {
            kind: 'EXPRESSION',
            key: `item42-shared-suffix-${draft.effect_index}`,
            expression_key: draft.expression_tree.expression_key,
            text: spec.source_suffix.trimStart(),
          });
          continue;
        }
        const exactFocusedTemporalFact = [
          'RIGHTS_SURVIVAL_DURATION',
          'NO_ADVERSE_AMENDMENT_DURATION',
          'BUSINESS_HOURS_TIMING',
        ].includes(spec.field_key) && [
          'item-28-linked-d-and-o-rights-survival',
          'item-44-separate-access-dimensions',
        ].includes(scenarioKey);
        if (segments.length > 0 && spec.fact_instance_key !== undefined) {
          append(selected, {
            kind: 'EXPRESSION',
            key: `fact-${draft.effect_index}-${spec.fact_instance_key}-connector`,
            expression_key: draft.expression_tree.expression_key,
            text: spec.fact_instance_key === 'APPLIES_TO:PARENT' ? ' and ' : ' ',
          });
        } else if (segments.length > 0) append(selected, exactFocusedTemporalFact ? {
          kind: 'EXPRESSION',
          key: `fact-${draft.effect_index}-${spec.field_key}-boundary`,
          expression_key: draft.expression_tree.expression_key,
          text: spec.source_prefix === undefined ? ' ' : ` ${spec.source_prefix}`,
        } : {
          kind: 'FACT',
          key: `fact-${draft.effect_index}-${spec.field_key}-space`,
          field_key: spec.field_key,
          text: spec.field_key === 'AUTHORED_LIMB_MARKER' ? '\n' : ' ',
        });
        if (spec.value_type === 'PARTY_SET') {
          append(selected, {
            kind: 'FACT', key: `fact-${draft.effect_index}-${spec.field_key}-party-1`,
            field_key: spec.field_key, text: 'Company',
            context_edge_id: spec.context_edge_ids[0],
            context_edge_type: 'PARTY_ALIAS', context_target_id: 'COMPANY',
          });
          append(selected, {
            kind: 'FACT', key: `fact-${draft.effect_index}-${spec.field_key}-separator`,
            field_key: spec.field_key, text: ' and ',
          });
          append(selected, {
            kind: 'FACT', key: `fact-${draft.effect_index}-${spec.field_key}-party-2`,
            field_key: spec.field_key, text: 'Parent',
            context_edge_id: spec.context_edge_ids[1],
            context_edge_type: 'PARTY_ALIAS', context_target_id: 'PARENT',
          });
        } else {
          const segment = {
            kind: 'FACT',
            key: `fact-${draft.effect_index}-${spec.fact_instance_key ?? spec.field_key}`,
            field_key: spec.field_key,
            ...(spec.fact_instance_key === undefined
              ? {} : { fact_instance_key: spec.fact_instance_key }),
            text: spec.source_text,
          };
          if (spec.field_key === 'LEGAL_EFFECT') segment.operative_marker_kind = 'MODAL';
          if (spec.field_key === 'AUTHORED_LIMB_MARKER') {
            segment.operative_marker_kind = 'ENUMERATED_LIMB';
            segment.native_inline_marker = true;
            segment.limb_node_occurrence_id = `authored-limb-${scenarioKey}-${draft.effect_index}`;
          }
          if (spec.value_type === 'PARTY') {
            segment.context_edge_id = spec.context_edge_ids[0];
            segment.context_edge_type = 'PARTY_ALIAS';
            segment.context_target_id = spec.typed_value;
          } else if (spec.value_type === 'REFERENCE') {
            segment.context_edge_id = spec.context_edge_ids[0];
            segment.context_edge_type = 'REFERENCE_TARGET';
            segment.context_target_id = spec.typed_value;
          }
          append(selected, segment);
          if (exactFocusedTemporalFact && spec.source_suffix !== undefined) {
            append(selected, {
              kind: 'EXPRESSION',
              key: `fact-${draft.effect_index}-${spec.field_key}-anchor`,
              expression_key: draft.expression_tree.expression_key,
              text: spec.source_suffix,
            });
          }
          if (item42Temporal && draft.subprofile_key === 'CLAIM_CONTINUATION'
              && spec.field_key === 'LEGAL_EFFECT') {
            append(selected, {
              kind: 'EXPRESSION',
              key: 'item42-claim-continuation-source',
              expression_key: draft.expression_tree.expression_key,
              text: ' continue to be subject to this Section 5.7(a) and the rights provided under this Section 5.7(a) until disposition of such claim',
            });
          }
        }
      }
      for (const node of draft.expression_nodes) {
        const segment = {
          kind: 'EXPRESSION',
          key: `expression-${draft.effect_index}-${node.expression_key}`,
          expression_key: node.expression_key,
          text: options.materialProviso === true && draft.effect_index === 0
            && node === draft.expression_nodes[0]
            ? ' provided that exception' : ` ${node.operator.toLowerCase()}`,
        };
        if (options.materialProviso === true && draft.effect_index === 0
            && node === draft.expression_nodes[0]) segment.material_proviso = true;
        append(selected, segment);
      }
      if (
        options.ownershipLink === true
        && draft.family_key === (options.ownershipConsumerFamily ?? 'TERMINATION_FEE')
      ) {
        append(selected, {
          kind: 'DEPENDENCY',
          key: `ownership-consumer-reference-${draft.effect_index}`,
          text: ' termination event owner',
          dependency_id: `dependency-required-${scenarioKey}`,
          context_edge_id: `edge-required-${scenarioKey}`,
          dependency_type: 'REFERENCE_TARGET',
          context_edge_type: 'REFERENCE_TARGET',
          context_target_id: options.requiredDependencyTargetId ?? 'DEFINED_MATCH_PERIOD',
        });
      }
      if (item42Temporal && draft.subprofile_key === 'CLAIM_CONTINUATION') {
        appendTechnicalWhitespace(selected, 'item42-deictic-leading-boundary');
        append(selected, {
          kind: 'DEPENDENCY',
          key: 'item42-claim-continuation-period-reference',
          text: 'such six-year period',
          dependency_id: 'dependency-item42-claim-continuation-period',
          context_edge_id: 'edge-item42-claim-continuation-period',
          dependency_type: 'DURATION_CONDITION_REFERENCE',
          context_edge_type: 'DURATION_REFERENCE_TARGET',
        });
        for (const pending of pendingDeicticDirectAliases.filter(
          (entry) => entry.draft === draft,
        )) {
          const dependencySegment = segments.at(-1);
          assert.equal(selected.pop(), dependencySegment);
          const alias = {
            kind: 'FACT',
            key: `fact-${draft.effect_index}-${pending.spec.field_key}-deictic-alias`,
            field_key: pending.spec.field_key,
            text: 'such six-year period',
            dependency_id: dependencySegment.dependency_id,
            context_edge_id: dependencySegment.context_edge_id,
            dependency_type: dependencySegment.dependency_type,
            context_edge_type: dependencySegment.context_edge_type,
            shared_source_segment: dependencySegment,
          };
          pending.selected.push(alias);
          sharedAliases.push(alias);
        }
      }
    }
    effectSegments.push(selected);
  }
  if (options.nativeSourceArtefact === true) {
    segments.push({
      kind: 'SOURCE_ARTEFACT', key: 'native-page-marker', text: ' Page 15',
      source_artefact_kind: 'PAGE_NUMBER',
    });
  }
  let sourceText = '';
  for (const segment of segments) {
    segment.start_byte = Buffer.byteLength(sourceText, 'utf8');
    sourceText += segment.text;
    segment.end_byte = Buffer.byteLength(sourceText, 'utf8');
  }
  const agreementIndex = buildAgreementIndex(
    agreementId,
    sourceText,
    nodeId,
    segments.filter((segment) => segment.kind === 'SOURCE_ARTEFACT').map((segment) => ({
      source_artefact_kind: segment.source_artefact_kind,
      start_byte: segment.start_byte,
      end_byte: segment.end_byte,
    })),
    segments.filter((segment) => segment.native_inline_marker === true).map((segment) => ({
      start_byte: segment.start_byte,
      end_byte: segment.end_byte,
      limb_node_occurrence_id: segment.limb_node_occurrence_id,
    })),
    { item42Sentence: item42Temporal },
  );
  const agreementIndexBinding = addRecord(
    store, `fixture/index/${scenarioKey}.json`, agreementIndex, 'agreement_index_id',
  );
  const spans = segments.map((segment) => {
    const textBytes = Buffer.from(sourceText, 'utf8').subarray(
      segment.start_byte, segment.end_byte,
    );
    const textSha = sha256Hex(textBytes);
    const technical = segment.kind === 'SOURCE_ARTEFACT';
    const span = {
      span_id: contentId('AGREEMENT_SOURCE_SPAN/V2', {
        agreement_index_id: agreementIndex.agreement_index_id,
        source_node_occurrence_id: nodeId,
        start_byte: segment.start_byte,
        end_byte: segment.end_byte,
        text_sha256: textSha,
      }),
      source_node_occurrence_id: nodeId,
      start_byte: segment.start_byte,
      end_byte: segment.end_byte,
      text_sha256: textSha,
      legal_text: !technical && /[\p{L}\p{N}]/u.test(segment.text),
      operative: segment.operative_marker_kind !== undefined,
      materiality: technical || !/[\p{L}\p{N}]/u.test(segment.text)
        ? 'NON_MATERIAL' : 'MATERIAL',
    };
    segment.span = span;
    return span;
  });
  for (const alias of sharedAliases) alias.span = alias.shared_source_segment.span;
  for (const selected of effectSegments) selected.sort(
    (left, right) => left.span.start_byte - right.span.start_byte,
  );
  const ownershipDependencySegment = segments.find((segment) =>
    segment.kind === 'DEPENDENCY'
      && segment.dependency_id === `dependency-required-${scenarioKey}`);
  if (options.ownershipLink === true) {
    const consumerDraftIndex = drafts.findIndex((draft) =>
      draft.family_key === (options.ownershipConsumerFamily ?? 'TERMINATION_FEE'));
    assert.notEqual(consumerDraftIndex, -1,
      'ownership-link fixture requires its consumer draft');
    assert.deepEqual(effectSegments.map((selected) => selected.filter((segment) =>
      segment.dependency_id === `dependency-required-${scenarioKey}`).length),
      effectSegments.map((_, index) => index === consumerDraftIndex ? 1 : 0),
      'ownership-link dependency must be one dedicated consumer-local segment');
  }
  const dependencySourceSpan = ownershipDependencySegment?.span
    ?? spans.find((_, index) => segments[index].field_key === 'FAMILY_MARKER')
    ?? spans[0];
  const dependencyState = options.requiredDependencyState
    ?? (options.unresolvedDependency === true ? 'UNRESOLVED' : null);
  let requiredDependency = dependencyState !== null ? {
    dependency_id: `dependency-required-${scenarioKey}`,
    context_edge_id: `edge-required-${scenarioKey}`,
    dependency_type: 'REFERENCE_TARGET',
    state: dependencyState,
    target_id: dependencyState === 'RESOLVED'
      ? options.requiredDependencyTargetId ?? 'DEFINED_MATCH_PERIOD'
      : 'UNRESOLVED_SECTION_REFERENCE',
    source_support_ids: [dependencySourceSpan.span_id],
  } : null;
  if (item42Temporal) {
    const sharedSegment = sharedSourceSegments.get('item42-six-year-duration');
    const referenceSegment = segments.find(
      (segment) => segment.key === 'item42-claim-continuation-period-reference',
    );
    const ownerSpec = drafts.find(
      (draft) => draft.subprofile_key === 'RIGHTS_SURVIVAL',
    ).fact_specs.find((spec) => spec.field_key === 'RIGHTS_SURVIVAL_DURATION');
    assert.ok(sharedSegment?.span && ownerSpec,
      'item42 source requires its shared duration span');
    const ownerSemanticFactKey = buildFact(
      agreementId, ownerSpec, [sharedSegment.span],
    ).semantic_fact_key;
    if (referenceSegment !== undefined) {
      requiredDependency = {
        dependency_id: referenceSegment.dependency_id,
        context_edge_id: referenceSegment.context_edge_id,
        dependency_type: referenceSegment.dependency_type,
        state: 'RESOLVED',
        target_id: ownerSemanticFactKey,
        source_support_ids: [referenceSegment.span.span_id],
      };
      referenceSegment.context_target_id = ownerSemanticFactKey;
    }
  }
  const closureBody = {
    authored_unit_id: nodeId,
    agreement_index_binding: agreementIndexBinding,
    canonical_source_binding: {
      canonical_text_id: agreementIndex.source_binding.canonical_text_id,
      canonical_text_sha256: agreementIndex.source_binding.canonical_text_sha256,
      canonical_text_byte_length: agreementIndex.source_binding.canonical_text_byte_length,
    },
    source_node_occurrence_id: nodeId,
    complete_review_state: 'COMPLETE_REVIEWED_SOURCE_CLOSURE',
    governing_chapeau_span_ids: [spans[0].span_id],
    required_dependency_ids: requiredDependency === null
      ? [] : [requiredDependency.dependency_id],
    governing_start_byte: 0,
    governing_end_byte: Buffer.byteLength(sourceText, 'utf8'),
    whitespace_punctuation_policy_id: 'EXACT_UTF8_PARTITION/V1',
    spans,
  };
  const sourceClosure = sealInlineRecord(
    'STAGE_2Y_M7_V2_REVIEWED_SOURCE_CLOSURE/V1', 'source_closure_id', closureBody,
  );
  const contextEdges = segments.filter((segment) => segment.context_edge_id).map(
    (segment) => {
      const sourceSupportIds = segment.kind === 'DEPENDENCY'
        ? [segment.span.span_id]
        : segment.context_edge_type === 'REFERENCE_TARGET'
        ? segments.filter((candidate) => candidate.field_key === segment.field_key)
          .map((candidate) => candidate.span.span_id)
        : [segment.span.span_id];
      return {
        edge_id: segment.context_edge_id,
        edge_type: segment.context_edge_type,
        target_id: segment.context_target_id,
        state: 'RESOLVED',
        source_support_ids: sourceSupportIds,
      };
    },
  );
  if (requiredDependency !== null) {
    const existingEdge = contextEdges.find(
      (edge) => edge.edge_id === requiredDependency.context_edge_id,
    );
    if (existingEdge === undefined) {
      contextEdges.push({
        edge_id: requiredDependency.context_edge_id,
        edge_type: requiredDependency.dependency_type,
        target_id: requiredDependency.target_id,
        state: requiredDependency.state,
        source_support_ids: requiredDependency.source_support_ids,
      });
    } else {
      existingEdge.target_id = requiredDependency.target_id;
      existingEdge.state = requiredDependency.state;
    }
  }
  return {
    nodeId,
    sourceText,
    segments,
    effectSegments,
    agreementIndex,
    agreementIndexBinding,
    sourceClosure,
    dependencies: requiredDependency === null ? [] : [requiredDependency],
    contextEdges,
  };
}

function buildFact(agreementId, spec, spans) {
  const sourceSupportIds = spans.map((span) => span.span_id);
  const legalEffectRole = spec.legal_effect_role
    ?? (spec.field_key === 'APPLIES_TO' ? 'LEGAL_ACTOR'
      : spec.field_key === 'LEGAL_EFFECT' ? 'OPERATIVE_EFFECT' : 'LEGAL_PARAMETER');
  const temporalScopeSignature = spec.temporal_scope_signature ?? 'CURRENT';
  const semanticFactKey = contentId('AGREEMENT_SEMANTIC_FACT/V2', {
    agreement_id: agreementId,
    field_key: spec.field_key,
    normalised_typed_value: spec.typed_value,
    legal_subject: 'COMPANY',
    temporal_scope_signature: temporalScopeSignature,
    source_support_ids: sourceSupportIds,
    legal_effect_role: legalEffectRole,
  });
  return {
    fact_id: contentId('AGREEMENT_SEMANTIC_FACT/V2', {
      agreement_id: agreementId,
      semantic_fact_key: semanticFactKey,
    }),
    semantic_fact_key: semanticFactKey,
    owner_rule_id: 'PENDING_RULE_ID',
    field_key: spec.field_key,
    label_id: `label-${spec.field_key}`,
    value_type: spec.value_type,
    typed_value: spec.typed_value,
    materiality: spec.materiality ?? 'MATERIAL',
    atomicity: 'ATOMIC_TYPED_VALUE',
    legal_effect_role: legalEffectRole,
    legal_subject: 'COMPANY',
    temporal_scope_signature: temporalScopeSignature,
    source_support_ids: sourceSupportIds,
    dependency_ids: [],
    normalisation_proof: {
      rule_id: spec.normalisation_rule,
      input_source_span_ids: sourceSupportIds,
      input_context_edge_ids: spec.context_edge_ids,
      result_digest: sha256Hex(canonicalJson(spec.typed_value)),
    },
    display_rule: spec.display_rule ?? 'DISPLAY_REQUIRED',
  };
}

function buildExpressions(
  draft, factByField, effectSpanIds, segmentByExpressionKey,
  authoredLimbByExpressionKey = new Map(), connectiveSpanIdsByExpressionKey = null,
) {
  const records = [];
  const recordByNode = new Map();
  function visit(node) {
    if (node.kind === 'FACT') return { kind: 'FACT', id: factByField.get(node.field_key).fact_id };
    const childRefs = node.children.map(visit);
    const roles = CHILD_ROLES[node.operator];
    const children = childRefs.map((child, index) => ({
      ...child,
      ordinal: index + 1,
      role: roles.length === 1 ? roles[0] : roles[index],
    }));
    const connectiveSpanIds = connectiveSpanIdsByExpressionKey?.get(node.expression_key)
      ?? [segmentByExpressionKey.get(node.expression_key).span.span_id];
    const resultKind = ['EARLIER_OF', 'LATER_OF'].includes(node.operator)
      ? 'TEMPORAL' : 'LOGICAL';
    const identity = {
      operator: node.operator,
      result_kind: resultKind,
      children,
      connective_span_ids: connectiveSpanIds,
      authored_limb_marker_span_ids: authoredLimbByExpressionKey.get(node.expression_key) ?? [],
      scope_span_ids: effectSpanIds,
    };
    const record = {
      expression_id: contentId('STAGE_2Y_M7_V2_EXPRESSION/V1', identity),
      ...identity,
      parent_expression_id: null,
    };
    recordByNode.set(node, record);
    records.push(record);
    node.children.forEach((childNode, index) => {
      if (childNode.kind === 'EXPRESSION') {
        recordByNode.get(childNode).parent_expression_id = children[index].id;
      }
    });
    return { kind: 'EXPRESSION', id: record.expression_id };
  }
  const rootRef = visit(draft.expression_tree);
  for (const node of draft.expression_nodes) {
    const parentNode = draft.expression_nodes.find((candidate) => candidate.children.includes(node));
    recordByNode.get(node).parent_expression_id = parentNode
      ? recordByNode.get(parentNode).expression_id : null;
  }
  return {
    records,
    rootExpressionId: rootRef.id,
    recordByExpressionKey: new Map(draft.expression_nodes.map(
      (node) => [node.expression_key, recordByNode.get(node)],
    )),
  };
}

function derivedEquivalenceSignature(profile, expressionSignature, facts, {
  ownershipLinks = [], allFacts = facts, consumerRuleId = facts[0]?.owner_rule_id ?? null,
} = {}) {
  const factById = new Map(allFacts.map((fact) => [fact.fact_id, fact]));
  const result = {};
  for (const slot of EQUIVALENCE_SLOTS) {
    const mapping = profile.equivalence_signature_mapping[slot];
    const entries = [];
    for (const fieldKey of mapping.field_keys) {
      const selected = facts.filter((fact) => fact.field_key === fieldKey).map((fact) => ({
        kind: 'FACT',
        field_key: fact.field_key,
        value_type: fact.value_type,
        typed_value: fact.typed_value,
        legal_subject: fact.legal_subject,
        temporal_scope_signature: fact.temporal_scope_signature,
        legal_effect_role: fact.legal_effect_role,
      })).sort((left, right) => {
        const leftBytes = canonicalJson(left);
        const rightBytes = canonicalJson(right);
        return leftBytes < rightBytes ? -1 : leftBytes > rightBytes ? 1 : 0;
      });
      entries.push(...selected);
      const delegated = profile.excluded_or_delegated_dimensions.find(
        (dimension) => dimension.disposition === 'DELEGATED'
          && dimension.dimension_key === fieldKey,
      );
      if (delegated) {
        entries.push(...ownershipLinks.filter(
          (link) => link.consumer_rule_id === consumerRuleId,
        ).map((link) => ({ link, fact: factById.get(link.owner_fact_id) })).filter(
          ({ fact }) => fact?.field_key === delegated.owner_field_key,
        ).map(({ link, fact }) => ({
          kind: 'LINKED_FACT',
          field_key: fieldKey,
          value_type: fact.value_type,
          typed_value: fact.typed_value,
          legal_subject: fact.legal_subject,
          temporal_scope_signature: fact.temporal_scope_signature,
          legal_effect_role: fact.legal_effect_role,
          ownership_link_id: link.link_id,
        })));
      }
    }
    if (mapping.expression_signature_role === 'CANONICAL_EXPRESSION') {
      entries.push({
        kind: 'EXPRESSION',
        role: 'CANONICAL_EXPRESSION',
        signature: expressionSignature,
      });
    }
    result[slot] = entries;
  }
  return result;
}

function buildNativeAgreementIndex({ agreementId, sourceText, nodes, ambiguities,
  inlineMarkerDispositions }) {
  const sourceBytes = Buffer.from(sourceText, 'utf8');
  const canonicalTextId = contentId('CANONICAL_TEXT/V1', { canonical_text: sourceText });
  const structuralPolicyDigest = sha256Hex(`fixture-structural-policy:${agreementId}`);
  const annotations = [];
  const sourceArtefacts = [];
  const aliases = [];
  const diagnostics = [];
  const counts = { node_count: nodes.length };
  const inlineMarkerPartition = { proof_digest: sha256Hex(`fixture-partition:${agreementId}`) };
  const byteCoverage = { proof_digest: sha256Hex(`fixture-coverage:${agreementId}`) };
  const agreementIndexId = contentId('AGREEMENT_INDEX/V1', {
    agreement_id: agreementId,
    canonical_text_id: canonicalTextId,
    structural_policy_digest: structuralPolicyDigest,
    root_node_occurrence_id: nodes[0].node_occurrence_id,
    counts,
    node_set_digest: contentId('AGREEMENT_INDEX_NODE_SET/V1', nodes),
    annotation_set_digest: contentId('AGREEMENT_INDEX_ANNOTATION_SET/V1', annotations),
    source_artefact_set_digest: contentId(
      'AGREEMENT_INDEX_SOURCE_ARTEFACT_SET/V1', sourceArtefacts,
    ),
    alias_set_digest: contentId('AGREEMENT_INDEX_ALIAS_SET/V1', aliases),
    ambiguity_set_digest: contentId('AGREEMENT_INDEX_AMBIGUITY_SET/V1', ambiguities),
    diagnostic_set_digest: contentId('AGREEMENT_INDEX_DIAGNOSTIC_SET/V1', diagnostics),
    inline_marker_disposition_set_digest: contentId(
      'AGREEMENT_INDEX_INLINE_MARKER_DISPOSITION_SET/V1', inlineMarkerDispositions,
    ),
    inline_marker_partition_proof_digest: inlineMarkerPartition.proof_digest,
    byte_coverage_proof_digest: byteCoverage.proof_digest,
  });
  return {
    schema_version: 'AGREEMENT_INDEX/V1',
    agreement_index_id: agreementIndexId,
    source_binding: {
      agreement_id: agreementId,
      canonical_text: sourceText,
      canonical_text_id: canonicalTextId,
      canonical_text_sha256: sha256Hex(sourceBytes),
      canonical_text_byte_length: sourceBytes.length,
    },
    structural_policy: { policy_digest: structuralPolicyDigest },
    root_node_occurrence_id: nodes[0].node_occurrence_id,
    counts,
    nodes,
    annotations,
    source_artefacts: sourceArtefacts,
    aliases,
    ambiguities,
    diagnostics,
    inline_marker_dispositions: inlineMarkerDispositions,
    inline_marker_partition: inlineMarkerPartition,
    byte_coverage: byteCoverage,
  };
}

function outlineFixtureLabel(markerText) {
  const selected = /^\(([A-Za-z]{1,5}|[0-9]{1,3})\)$/u.exec(markerText)?.[1] ?? null;
  assert.notEqual(selected, null, `unsupported structure marker ${markerText}`);
  if (/^[0-9]+$/u.test(selected)) return { style: 'DIGIT', value: Number(selected), first: 1 };
  const lower = selected.toLowerCase();
  const romans = [
    'i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x',
    'xi', 'xii', 'xiii', 'xiv', 'xv', 'xvi', 'xvii', 'xviii', 'xix', 'xx',
  ];
  const roman = romans.indexOf(lower);
  if (roman >= 0) {
    return { style: selected === lower ? 'ROMAN_LOWER' : 'ROMAN_UPPER', value: roman, first: 0 };
  }
  return {
    style: selected === lower ? 'ALPHA_LOWER' : 'ALPHA_UPPER',
    value: lower.charCodeAt(0) - 97,
    first: 0,
  };
}

function materialiseStructureTree(depths, markerEvidence, agreementIndex, parentNodeId) {
  assert.equal(depths.length, markerEvidence.length);
  const sourceBytes = Buffer.from(agreementIndex.source_binding.canonical_text, 'utf8');
  const parentCounts = new Map();
  const nodes = markerEvidence.map((evidence, index) => {
    const depth = depths[index];
    let parentKey;
    if (depth === 1) {
      parentKey = `SEALED_PARENT:${parentNodeId}`;
    } else {
      let parentIndex = index - 1;
      while (parentIndex >= 0 && depths[parentIndex] !== depth - 1) parentIndex -= 1;
      assert.ok(parentIndex >= 0, 'candidate depth has no preceding parent');
      const parentSpan = markerEvidence[parentIndex].marker_span;
      parentKey = `MARKER:${parentSpan.start_byte}:${parentSpan.end_byte}`;
    }
    const siblingOrdinal = parentCounts.get(parentKey) ?? 0;
    parentCounts.set(parentKey, siblingOrdinal + 1);
    const markerSpan = evidence.marker_span;
    return {
      marker_span: markerSpan,
      marker_text: sourceBytes.subarray(markerSpan.start_byte, markerSpan.end_byte)
        .toString('utf8'),
      source_disposition_id: evidence.source_disposition_id,
      parent_key: parentKey,
      sibling_ordinal: siblingOrdinal,
      depth,
    };
  });
  const siblings = new Map();
  for (const node of nodes) {
    const selected = siblings.get(node.parent_key) ?? [];
    selected.push(outlineFixtureLabel(node.marker_text));
    siblings.set(node.parent_key, selected);
  }
  const labelSequencePasses = [...siblings.values()].every((labels) =>
    labels[0].value === labels[0].first
      && labels.every((label, index) => index === 0
        || (label.style === labels[index - 1].style
          && label.value === labels[index - 1].value + 1)));
  const evidenceSpanIds = nodes.map((node) => contentId(
    'STAGE_2Y_M7_V2_STRUCTURE_MARKER_EVIDENCE/V1', {
      agreement_index_id: agreementIndex.agreement_index_id,
      start_byte: node.marker_span.start_byte,
      end_byte: node.marker_span.end_byte,
      text_sha256: node.marker_span.text_sha256,
    },
  ));
  const constraintResults = [
    ['BOUND_PARENT_CONTAINMENT', true],
    ['DOCUMENT_ORDER', true],
    ['CONTIGUOUS_SIBLING_SEQUENCE', true],
    ['LABEL_SEQUENCE_PER_PARENT', labelSequencePasses],
  ].map(([constraint_id, passed]) => ({
    constraint_id,
    status: passed ? 'PASS' : 'FAIL',
    evidence_span_ids: evidenceSpanIds,
  }));
  return sealBoundRecord(
    STRUCTURE_CANDIDATE_TREE_SCHEMA, 'candidate_tree_id', {
      nodes,
      constraint_results: constraintResults,
      tree_state: labelSequencePasses ? 'PASS_PARENT_SCOPING' : 'REJECTED_PARENT_SCOPING',
    },
  );
}

function buildAmbiguousRepeatFixture(store, mutationCaseId = null) {
  const sourceText = '(i)(i)(ii)';
  const sourceBytes = Buffer.from(sourceText, 'utf8');
  const parentNodeId = 'fixture-repeat-parent';
  const markerSpans = [[0, 3], [3, 6], [6, 10]].map(([start_byte, end_byte]) => ({
    coordinate_system: 'UTF8_CANONICAL_TEXT_HALF_OPEN',
    start_byte,
    end_byte,
    text_sha256: sha256Hex(sourceBytes.subarray(start_byte, end_byte)),
  }));
  const disposition = sealBoundRecord(
    'AGREEMENT_INLINE_MARKER_DISPOSITION/V1', 'disposition_id', {
      disposition: 'UNRESOLVED_INLINE_LIST',
      reason: 'AMBIGUOUS_SAME_STYLE_RESTART',
      style: 'romanLower',
      depth: 1,
      parent_node_occurrence_id: parentNodeId,
      marker_spans: markerSpans,
      produced_limb_node_occurrence_ids: [],
    },
  );
  const ambiguity = sealBoundRecord(
    'AGREEMENT_STRUCTURE_AMBIGUITY/V1', 'ambiguity_id', {
      ambiguity_type: 'UNRESOLVED_INLINE_LIST',
      status: 'OPEN',
      node_occurrence_ids: [parentNodeId],
      span: {
        coordinate_system: 'UTF8_CANONICAL_TEXT_HALF_OPEN',
        start_byte: 0,
        end_byte: sourceBytes.length,
        text_sha256: sha256Hex(sourceBytes),
      },
      detail: {
        competing_readings: ['AUTHORED_LIST', 'CROSS_REFERENCE'],
        inline_marker_disposition_id: disposition.disposition_id,
        parser_version: 'AGREEMENT_INLINE_STRUCTURE_PARSER/V1',
        reason: mutationCaseId === 'ambiguous-repeat-lacks-native-same-style-restart-proof'
          ? 'CALLER_ASSERTED_RESTART' : 'AMBIGUOUS_SAME_STYLE_RESTART',
      },
    },
  );
  const node = {
    node_occurrence_id: parentNodeId,
    parent_node_occurrence_id: null,
    node_kind: 'PARAGRAPH',
    reference: null,
    roles: ['AUTHORED_PARAGRAPH'],
    extent_span: {
      coordinate_system: 'UTF8_CANONICAL_TEXT_HALF_OPEN',
      start_byte: 0,
      end_byte: sourceBytes.length,
      text_sha256: sha256Hex(sourceBytes),
    },
  };
  const agreementIndex = buildNativeAgreementIndex({
    agreementId: 'fixture-ambiguous-repeat-agreement',
    sourceText,
    nodes: [node],
    ambiguities: [ambiguity],
    inlineMarkerDispositions: [disposition],
  });
  const agreementIndexBinding = addRecord(
    store, 'fixture/structure/ambiguous-repeat-index.json', agreementIndex,
    'agreement_index_id',
  );
  const markerEvidence = markerSpans.map((marker_span) => ({
    marker_span,
    source_disposition_id: disposition.disposition_id,
  }));
  let candidateTrees = cases.structure_overlay_case
    .ambiguous_repeat_candidate_depth_readings.map((depths) =>
      materialiseStructureTree(depths, markerEvidence, agreementIndex, parentNodeId));
  assert.deepEqual(candidateTrees.flatMap((tree, index) =>
    tree.tree_state === 'PASS_PARENT_SCOPING' ? [index] : []),
  cases.structure_overlay_case.ambiguous_repeat_passing_candidate_indexes);
  if (mutationCaseId === 'ambiguous-repeat-lacks-two-passing-material-readings') {
    candidateTrees = candidateTrees.slice(0, 2);
  }
  const passingTrees = candidateTrees.filter(
    (tree) => tree.tree_state === 'PASS_PARENT_SCOPING',
  );
  const fixture = sealBoundRecord(
    STRUCTURE_OVERLAY_FIXTURE_SCHEMA, 'fixture_id', {
      kind: 'GENUINELY_AMBIGUOUS_REPEAT',
      agreement_index_binding: agreementIndexBinding,
      ambiguity_id: ambiguity.ambiguity_id,
      parent_scoping_rule: {
        rule_id: 'PARENT_SCOPED_ORDERED_SIBLINGS',
        rule_version: 1,
        marker_identity: 'PARENT_SCOPE_PLUS_EXACT_MARKER_SPAN',
        candidate_enumeration:
          'ALL_MATERIAL_CONTINUATION_SAME_PARENT_RESTART_AND_IMMEDIATE_NESTING_READINGS_UNDER_PREORDER_AND_CONTIGUOUS_SOURCE_RULES',
        selection_rule: 'EXACTLY_ONE_PASSING_TREE_ELSE_REVIEW_ONLY',
      },
      marker_eligibility: {
        structural_candidate_disposition_ids: [disposition.disposition_id],
        excluded_glued_reference_disposition_ids: [],
      },
      candidate_trees: candidateTrees,
      expected_selected_candidate_tree_id:
        mutationCaseId === 'ambiguous-repeat-selects-a-candidate'
          ? passingTrees[0]?.candidate_tree_id ?? candidateTrees[0].candidate_tree_id : null,
      expected_output_disposition:
        mutationCaseId === 'ambiguous-repeat-selects-a-candidate' ? 'NORMAL' : 'REVIEW_ONLY',
      lawyer_ruling_id: ITEM39_DECISION_ID,
    },
  );
  return {
    fixture,
    binding: addRecord(
      store, 'fixture/structure/ambiguous-repeat.json', fixture, 'fixture_id',
    ),
  };
}

function buildWork0PacketEvidence(store, options = {}) {
  const work0 = addEvidenceFile(store, WORK0_PATH);
  const fixed = addEvidenceFile(store, FIXED_SAMPLE_PATH);
  const baseline = addEvidenceFile(store, BASELINE_PATH);
  const rulingMap = addEvidenceFile(store, RULING_MAP_PATH);
  const packet = addEvidenceFile(store, REVIEW_PACKET_PATH);
  const fixedByOrdinal = new Map(fixed.record.members.map(
    (entry) => [entry.sample_ordinal, entry],
  ));
  const baselineByOrdinal = new Map(baseline.record.entries.map(
    (entry) => [entry.sample_ordinal, entry],
  ));
  const packetByOrdinal = new Map(packet.record.items.map(
    (entry) => [entry.sample_ordinal, entry],
  ));
  assert.equal(fixedByOrdinal.size, 50);
  assert.equal(baselineByOrdinal.size, 50);
  assert.equal(packetByOrdinal.size, 50);
  const linked = new Set(LINKED_POINT_ORDINALS);
  const memberFor = (identity) => {
    const baselineEntry = baselineByOrdinal.get(identity.sample_ordinal);
    const packetItem = packetByOrdinal.get(identity.sample_ordinal);
    assert.ok(baselineEntry && packetItem,
      `missing Work0 packet evidence for ordinal ${identity.sample_ordinal}`);
    assert.equal(baselineEntry.review_item_id, identity.review_item_id);
    assert.equal(packetItem.review_item_id, identity.review_item_id);
    assert.equal(packetItem.family_key, identity.family_key);
    const invariantId = REPAIR_INVARIANTS[baselineEntry.repair_class];
    assert.ok(invariantId,
      `missing repair invariant for ordinal ${identity.sample_ordinal}`);
    return {
      sample_ordinal: identity.sample_ordinal,
      review_item_id: identity.review_item_id,
      agreement_id: identity.agreement_id,
      item_kind: identity.item_kind,
      prior_row_id: identity.prior_row_id,
      source_node_occurrence_ids: identity.source_node_occurrence_ids,
      ambiguity_id: identity.ambiguity_id,
      source_spans: identity.source_spans,
      source_excerpt_sha256: identity.source_excerpt_sha256,
      repair_membership: baselineEntry.repair_membership,
      repair_class: baselineEntry.repair_class,
      original_decision: baselineEntry.original_decision,
      original_note: baselineEntry.original_note,
      lawyer_decision_id: baselineEntry.lawyer_decision_id,
      reviewer: baselineEntry.reviewer,
      fresh_work5_question_required: baselineEntry.requires_fresh_work5_question,
      linked_point_annotation: linked.has(identity.sample_ordinal),
      broad_legal_meaning_question: 'Does the V2 result preserve every important legal effect, condition, exception, timing term, standard and qualification in this source?',
      family_and_subtype_question: `Is ${identity.family_key ?? 'the post-overlay result'} assigned to the correct family and most-specific supported subtype?`,
      focused_expectation: {
        state: baselineEntry.requires_fresh_work5_question
          ? 'FRESH_WORK5_RULING_REQUIRED' : 'TESTABLE',
        invariant_id: invariantId,
        note_application: baselineEntry.requires_fresh_work5_question
          ? 'PRIOR_RECORD_CONFLICT_VISIBLE_NOT_AUTHORITY'
          : baselineEntry.repair_membership === 'CONTROL'
            ? 'NO_REGRESSION_FROM_ACCEPTED_RESULT'
            : baselineEntry.original_note !== null
              ? 'EVERY_SOURCE_FEATURE_IDENTIFIED_BY_VERBATIM_NOTE_MUST_BE_ACCOUNTED_FOR_IN_TYPED_FACT_EXPRESSION_DEPENDENCY_OR_GOVERNED_DISPOSITION'
              : 'CLASS_INVARIANT_ONLY',
      },
    };
  };
  const families = rulingMap.record.families.map((family) => ({
    family_key: family.family_key,
    wave: family.wave,
    calibration_pack_binding: family.calibration_pack_binding,
    programme_question_mappings: family.question_mappings.map((mapping) => ({
      family_question_id: mapping.family_question_id,
      programme_question_id: mapping.programme_question_id,
      ruling_id: mapping.ruling_id,
      selection: mapping.selection,
      legal_rule: mapping.legal_rule,
    })),
    sample_members: fixed.record.members.filter(
      (member) => member.family_key === family.family_key,
    ).map(memberFor),
    legal_oracle_state: 'WORK1_EVIDENCE_ONLY_NOT_COMPLETENESS_AUTHORITY',
    executable_matcher_present: false,
    profile_set_binding_state: 'PENDING_WORK3_BEN_APPROVAL',
  }));
  const structureAmbiguityMembers = fixed.record.members.filter(
    (member) => member.family_key === null,
  ).map(memberFor);
  const allMembers = [
    ...families.flatMap((family) => family.sample_members),
    ...structureAmbiguityMembers,
  ];
  assert.equal(families.length, 25);
  assert.equal(allMembers.length, 50);
  assert.equal(structureAmbiguityMembers.length, 1);
  assert.equal(structureAmbiguityMembers[0].sample_ordinal, 39);
  assert.equal(new Set(allMembers.map((member) => member.review_item_id)).size, 50);
  const unsigned = {
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_FAMILY_PACKET_SET/V1',
    stage: 'M7_V2_REPAIR_WORK1',
    state: 'LEGAL_EVIDENCE_ORACLE_NOT_EXECUTABLE_PROFILE_AUTHORITY',
    work0_evidence_root_binding: work0.binding,
    fixed_sample_identity_binding: options.negativeCaseId
      === 'fixed-50-identity-binding-drift'
      ? { ...fixed.binding, sha256: 'f'.repeat(64) } : fixed.binding,
    repair_baseline_binding: baseline.binding,
    calibration_ruling_map_binding: rulingMap.binding,
    lawyer_review_packet_binding: packet.binding,
    coverage: {
      ...packet.record.coverage,
      repair_item_count: baseline.record.counts.repair_items,
      control_item_count: baseline.record.counts.control_items,
      linked_point_count: LINKED_POINT_ORDINALS.length,
      linked_point_ordinals: LINKED_POINT_ORDINALS,
    },
    constraints: {
      exact_family_count: 25,
      exact_sample_count: 50,
      exact_structure_ambiguity_count: 1,
      contains_executable_matcher: false,
      can_assert_completeness: false,
      v1_role_relabelling_forbidden: true,
      every_sample_has_broad_and_family_subtype_question: true,
      substantive_notes_preserved_verbatim: true,
      focused_expectations_are_closed_and_testable: true,
    },
    families,
    structure_ambiguity_members: structureAmbiguityMembers,
  };
  const familyPacketSetDigest = sha256Hex(canonicalJson(unsigned));
  const withDigest = { ...unsigned, family_packet_set_digest: familyPacketSetDigest };
  const record = {
    ...withDigest,
    family_packet_set_id: contentId(
      'STAGE_2Y_M7_V2_REPAIR_FAMILY_PACKET_SET/V1', withDigest,
    ),
  };
  return {
    work0,
    fixed,
    baseline,
    rulingMap,
    packet,
    record,
    binding: addRecord(
      store, FAMILY_PACKET_PATH, record, 'family_packet_set_id',
    ),
  };
}

function buildItem39Authority(store, packetEvidence, mutationCaseId = null) {
  const item39Index = addEvidenceFile(store, ITEM39_INDEX_PATH);
  const fixedItem = packetEvidence.fixed.record.members.find(
    (member) => member.sample_ordinal === 39,
  );
  assert.equal(fixedItem.ambiguity_id, ITEM39_AMBIGUITY_ID);
  assert.deepEqual({
    path: item39Index.binding.path,
    schema_version: item39Index.binding.schema_version,
    record_id_field: item39Index.binding.record_id_field,
    record_id: item39Index.binding.record_id,
    byte_length: item39Index.binding.byte_length,
    sha256: item39Index.binding.sha256,
  }, fixedItem.agreement_index_binding);
  const dispositions = new Map(item39Index.record.inline_marker_dispositions.map(
    (entry) => [entry.disposition_id, entry],
  ));
  const structuralIds = [
    ITEM39_DISPOSITION_ID,
    '6a5b77ebda120dc322edf5febfc44c03663e9c3a3dc92b55000a3a40e53f0c7d',
    '64c180da22ae7721b3e0e7cced6786ba824bc632a42dccf53330b1cbc4531b2d',
  ];
  const excludedIds = [
    'c346c4bf8df8e757eeaf8ee241d485c0eb60aec8c19a4da54ee48dcf7ef06afd',
    '8e5b36c152615105d5ba0e3f8c6ef8887e3f4f5a7e3525e9d73cb5f2169c7b54',
  ];
  const markerEvidence = structuralIds.flatMap((dispositionId) => {
    const disposition = dispositions.get(dispositionId);
    assert.ok(disposition, `missing item39 disposition ${dispositionId}`);
    return disposition.marker_spans.map((marker_span) => ({
      marker_span,
      source_disposition_id: dispositionId,
    }));
  }).sort((left, right) => left.marker_span.start_byte - right.marker_span.start_byte);
  assert.equal(markerEvidence.length, cases.structure_overlay_case.expected_eligible_marker_count);
  let candidateTrees = cases.structure_overlay_case.candidate_depth_readings.map(
    (depths) => materialiseStructureTree(
      depths, markerEvidence, item39Index.record, ITEM39_PARENT_NODE_ID,
    ),
  );
  assert.deepEqual(candidateTrees.flatMap((tree, index) =>
    tree.tree_state === 'PASS_PARENT_SCOPING' ? [index] : []),
  cases.structure_overlay_case.expected_passing_candidate_indexes);
  if (mutationCaseId === 'item-39-overlay-omits-material-candidate') {
    candidateTrees = candidateTrees.slice(1);
  } else if (mutationCaseId === 'item-39-overlay-invents-candidate') {
    const invented = clone(candidateTrees[0]);
    invented.nodes[0].depth = 2;
    candidateTrees.push(restampInline(
      invented, STRUCTURE_CANDIDATE_TREE_SCHEMA, 'candidate_tree_id',
    ));
  } else if (mutationCaseId === 'item-39-overlay-node-source-disposition-mismatch') {
    candidateTrees[0].nodes[0].source_disposition_id = excludedIds[0];
    restampInline(candidateTrees[0], STRUCTURE_CANDIDATE_TREE_SCHEMA, 'candidate_tree_id');
  } else if (mutationCaseId === 'item-39-overlay-first-label-is-not-sequence-start') {
    candidateTrees[0].nodes[0].marker_text = '(ii)';
    restampInline(candidateTrees[0], STRUCTURE_CANDIDATE_TREE_SCHEMA, 'candidate_tree_id');
  } else if (mutationCaseId === 'item-39-overlay-singleton-sequence') {
    candidateTrees[0].nodes = candidateTrees[0].nodes.slice(0, 1);
    restampInline(candidateTrees[0], STRUCTURE_CANDIDATE_TREE_SCHEMA, 'candidate_tree_id');
  }
  const ambiguousRepeat = buildAmbiguousRepeatFixture(store, mutationCaseId);
  const item39OccurrenceId = 'fixture-item39-governed-occurrence';
  const inclusion = makeFixtureRecord(
    'fixture-item39-overlay-inclusion', item39OccurrenceId,
    'would give rise to the failure',
  );
  const exclusion = makeFixtureRecord(
    'fixture-item39-overlay-exclusion', 'fixture-item39-outside-occurrence',
    'ordinary clause without the ruled wording',
  );
  const inclusionBinding = addRecord(
    store, 'fixture/structure/item39-inclusion.json', inclusion, 'match_fixture_id',
  );
  const exclusionBinding = addRecord(
    store, 'fixture/structure/item39-exclusion.json', exclusion, 'match_fixture_id',
  );
  const ambiguity = item39Index.record.ambiguities.find(
    (entry) => entry.ambiguity_id === ITEM39_AMBIGUITY_ID,
  );
  const markerEligibility = {
    structural_candidate_disposition_ids: structuralIds,
    excluded_glued_reference_disposition_ids: excludedIds,
  };
  if (mutationCaseId === 'unknown-inline-marker-overlaps-item-39-overlay') {
    markerEligibility.structural_candidate_disposition_ids = [...structuralIds, 'f'.repeat(64)];
  } else if (mutationCaseId === 'item-39-overlay-promotes-glued-reference-marker') {
    markerEligibility.structural_candidate_disposition_ids = [...structuralIds, excludedIds[0]];
    markerEligibility.excluded_glued_reference_disposition_ids = excludedIds.slice(1);
  } else if (mutationCaseId === 'item-39-overlay-misses-authorised-non-structural-marker') {
    markerEligibility.structural_candidate_disposition_ids = structuralIds.slice(0, 2);
  }
  const selectedCandidateTreeId = mutationCaseId === 'item-39-overlay-selects-failed-candidate'
    ? candidateTrees[0].candidate_tree_id
    : candidateTrees[cases.structure_overlay_case.expected_passing_candidate_indexes[0]]
      ?.candidate_tree_id ?? candidateTrees[0].candidate_tree_id;
  const member = sealInlineRecord(
    'STAGE_2Y_M7_V2_STRUCTURE_DISPOSITION_SET/V1', 'structure_disposition_id', {
      kind: 'BEN_AUTHORED_INLINE_LIST_OVERLAY',
      reason_code: 'FALSE_M2_AMBIGUITY',
      policy_id: 'BEN-ITEM39-INLINE-LIST-OVERLAY',
      policy_version: 1,
      authority_class: 'BEN_LEGAL_RULING',
      approver: 'BEN_GOODCHILD',
      lawyer_ruling_id: ITEM39_DECISION_ID,
      scope: {
        agreement_index_id: item39Index.record.agreement_index_id,
        source_node_occurrence_id: ITEM39_PARENT_NODE_ID,
        start_byte: ambiguity.span.start_byte,
        end_byte: ambiguity.span.end_byte,
        governed_input_occurrence_ids: [item39OccurrenceId],
      },
      inclusion_fixture_bindings: [inclusionBinding],
      exclusion_fixture_bindings: [exclusionBinding],
      match_test: {
        kind: 'SOURCE_TOKEN_SEQUENCE',
        leaf_id: 'item39-overlay-source-leaf',
        tokens: ['would', 'give', 'rise'],
        scope: 'AUTHORED_UNIT_SOURCE_CLOSURE',
      },
      inline_list_overlay: {
        schema_version: STRUCTURE_OVERLAY_SCHEMA,
        lawyer_ruling_id: ITEM39_DECISION_ID,
        agreement_index_binding: item39Index.binding,
        sealed_ambiguity_id: ITEM39_AMBIGUITY_ID,
        sealed_ambiguity_type: 'UNRESOLVED_INLINE_LIST',
        sealed_ambiguity_span: ambiguity.span,
        inline_marker_disposition_id: ITEM39_DISPOSITION_ID,
        parent_node_occurrence_id: ITEM39_PARENT_NODE_ID,
        parent_reference: '7.01(d)',
        parent_scoping_rule: {
          rule_id: 'PARENT_SCOPED_ORDERED_SIBLINGS',
          rule_version: 1,
          marker_identity: 'PARENT_SCOPE_PLUS_EXACT_MARKER_SPAN',
          candidate_enumeration:
            'ALL_MATERIAL_CONTINUATION_SAME_PARENT_RESTART_AND_IMMEDIATE_NESTING_READINGS_UNDER_PREORDER_AND_CONTIGUOUS_SOURCE_RULES',
          selection_rule: 'EXACTLY_ONE_PASSING_TREE_ELSE_REVIEW_ONLY',
        },
        marker_eligibility: markerEligibility,
        candidate_trees: candidateTrees,
        selected_candidate_tree_id: selectedCandidateTreeId,
        technical_review: {
          state: 'PASS',
          check_ids: [
            'SEALED_M2_UNCHANGED',
            'ALL_CANDIDATE_TREES_MATERIALISED',
            'PARENT_SCOPING_RECOMPUTED',
            'UNIQUE_SELECTION',
            'AMBIGUOUS_REPEAT_NEGATIVE',
          ],
          effects: {
            files_written: 0,
            model_calls: 0,
            network_reads: 0,
            network_writes: 0,
            database_writes: 0,
            product_writes: 0,
          },
        },
        ambiguous_repeat_fixture_bindings: [ambiguousRepeat.binding],
      },
    },
  );
  return { member, item39Index, ambiguousRepeat };
}

function buildStructureSet({ store, source, occurrenceId, scenarioKey, options = {} }) {
  const packetEvidence = buildWork0PacketEvidence(store, options);
  const item39 = buildItem39Authority(store, packetEvidence, options.negativeCaseId ?? null);
  const inclusion = makeFixtureRecord(
    `structure-inclusion-${scenarioKey}`, occurrenceId, 'unmatchedtoken',
  );
  const exclusion = makeFixtureRecord(
    `structure-exclusion-${scenarioKey}`, `outside-${occurrenceId}`, 'ordinarytoken',
  );
  const inclusionBinding = addRecord(
    store, `fixture/structure/${scenarioKey}-inclusion.json`, inclusion, 'match_fixture_id',
  );
  const exclusionBinding = addRecord(
    store, `fixture/structure/${scenarioKey}-exclusion.json`, exclusion, 'match_fixture_id',
  );
  const memberBody = {
    kind: 'NO_OUTPUT',
    reason_code: 'BEN_APPROVED_NO_OUTPUT_AFTER_ALL_FAMILY_REVIEW',
    policy_id: 'BEN-NO-OUTPUT-POLICY',
    policy_version: 1,
    authority_class: 'BEN_LEGAL_RULING',
    approver: 'BEN_GOODCHILD',
    lawyer_ruling_id: profileRuling('TERMINATION'),
    scope: {
      agreement_index_id: source.agreementIndex.agreement_index_id,
      source_node_occurrence_id: source.nodeId,
      start_byte: source.governingStartByte ?? 0,
      end_byte: source.governingEndByte ?? Buffer.byteLength(source.sourceText, 'utf8'),
      governed_input_occurrence_ids: [occurrenceId],
    },
    inclusion_fixture_bindings: [inclusionBinding],
    exclusion_fixture_bindings: [exclusionBinding],
    match_test: {
      kind: 'SOURCE_TOKEN_SEQUENCE',
      leaf_id: `structure-leaf-${scenarioKey}`,
      tokens: ['unmatchedtoken'],
      scope: 'AUTHORED_UNIT_SOURCE_CLOSURE',
    },
    inline_list_overlay: null,
  };
  const member = sealInlineRecord(
    'STAGE_2Y_M7_V2_STRUCTURE_DISPOSITION_SET/V1',
    'structure_disposition_id', memberBody,
  );
  const artefactSegment = source.segments.find(
    (segment) => segment.kind === 'SOURCE_ARTEFACT',
  );
  let sourceArtefactMember = null;
  if (artefactSegment !== undefined) {
    const artefactInclusion = makeFixtureRecord(
      `source-artefact-inclusion-${scenarioKey}`, occurrenceId, artefactSegment.text,
    );
    const artefactExclusion = makeFixtureRecord(
      `source-artefact-exclusion-${scenarioKey}`, `outside-${occurrenceId}`, 'Page sixteen',
    );
    const artefactInclusionBinding = addRecord(
      store, `fixture/structure/${scenarioKey}-artefact-inclusion.json`,
      artefactInclusion, 'match_fixture_id',
    );
    const artefactExclusionBinding = addRecord(
      store, `fixture/structure/${scenarioKey}-artefact-exclusion.json`,
      artefactExclusion, 'match_fixture_id',
    );
    sourceArtefactMember = sealInlineRecord(
      'STAGE_2Y_M7_V2_STRUCTURE_DISPOSITION_SET/V1', 'structure_disposition_id', {
        kind: 'SOURCE_ARTEFACT',
        reason_code: 'NATIVE_AGREEMENT_INDEX_PAGE_NUMBER',
        policy_id: 'NATIVE-AGREEMENT-INDEX-SOURCE-ARTEFACT',
        policy_version: 1,
        authority_class: 'DETERMINISTIC_TECHNICAL',
        approver: null,
        lawyer_ruling_id: null,
        scope: {
          agreement_index_id: source.agreementIndex.agreement_index_id,
          source_node_occurrence_id: source.nodeId,
          start_byte: artefactSegment.span.start_byte,
          end_byte: artefactSegment.span.end_byte,
          governed_input_occurrence_ids: [occurrenceId],
        },
        inclusion_fixture_bindings: [artefactInclusionBinding],
        exclusion_fixture_bindings: [artefactExclusionBinding],
        match_test: {
          kind: 'SOURCE_TOKEN_SEQUENCE',
          leaf_id: `source-artefact-leaf-${scenarioKey}`,
          tokens: ['page', '15'],
          scope: 'EFFECT_SOURCE_SPANS',
        },
        inline_list_overlay: null,
      },
    );
  }
  const technicalWhitespaceMembers = source.segments.filter(
    (segment) => segment.kind === 'TECHNICAL_WHITESPACE',
  ).map((segment, index) => {
    const inclusion = makeFixtureRecord(
      `item42-whitespace-inclusion-${index}`, occurrenceId, segment.text, {
        nodeKind: 'SENTENCE',
        ancestorNodeKinds: ['LIMB', 'SECTION', 'ARTICLE', 'AGREEMENT'],
      },
    );
    const exclusion = makeFixtureRecord(
      `item42-whitespace-exclusion-${index}`, `outside-${occurrenceId}-${index}`,
      segment.text, { nodeKind: 'SECTION' },
    );
    const inclusionBinding = addRecord(
      store, `fixture/structure/${scenarioKey}-whitespace-${index}-inclusion.json`,
      inclusion, 'match_fixture_id',
    );
    const exclusionBinding = addRecord(
      store, `fixture/structure/${scenarioKey}-whitespace-${index}-exclusion.json`,
      exclusion, 'match_fixture_id',
    );
    return sealInlineRecord(
      'STAGE_2Y_M7_V2_STRUCTURE_DISPOSITION_SET/V1', 'structure_disposition_id', {
        kind: 'TECHNICAL_STRUCTURE',
        reason_code: 'WHITESPACE_OR_PUNCTUATION_ONLY',
        policy_id: 'WHITESPACE_PUNCTUATION_ONLY',
        policy_version: 1,
        authority_class: 'DETERMINISTIC_TECHNICAL',
        approver: null,
        lawyer_ruling_id: null,
        scope: {
          agreement_index_id: source.agreementIndex.agreement_index_id,
          source_node_occurrence_id: source.nodeId,
          start_byte: segment.span.start_byte,
          end_byte: segment.span.end_byte,
          governed_input_occurrence_ids: [occurrenceId],
        },
        inclusion_fixture_bindings: [inclusionBinding],
        exclusion_fixture_bindings: [exclusionBinding],
        match_test: {
          kind: 'INDEX_NODE_KIND',
          leaf_id: 'item42-whitespace-sentence-node',
          node_kind: 'SENTENCE',
          ancestor_node_kinds: ['LIMB', 'SECTION', 'ARTICLE', 'AGREEMENT'],
        },
        inline_list_overlay: null,
      },
    );
  });
  const record = sealBoundRecord(
    'STAGE_2Y_M7_V2_STRUCTURE_DISPOSITION_SET/V1', 'structure_disposition_set_id', {
      state: 'BEN_APPROVED_STRUCTURE_DISPOSITION_SET',
      members: [member, ...(sourceArtefactMember === null ? [] : [sourceArtefactMember]),
        ...technicalWhitespaceMembers, item39.member],
    },
  );
  return {
    member,
    sourceArtefactMember,
    technicalWhitespaceMembers,
    technicalWhitespaceBySpanId: new Map(technicalWhitespaceMembers.map((entry) => {
      const span = source.segments.find((segment) => segment.kind === 'TECHNICAL_WHITESPACE'
        && segment.span.start_byte === entry.scope.start_byte
        && segment.span.end_byte === entry.scope.end_byte);
      return [span.span.span_id, entry];
    })),
    item39,
    packetEvidence,
    record,
    binding: addRecord(
      store, 'fixture/inputs/structure-disposition-set.json', record,
      'structure_disposition_set_id',
    ),
  };
}

function claimedProfileResults(profiles, effectSourceText) {
  const words = effectSourceText.normalize('NFKC').toLowerCase()
    .match(/[\p{L}\p{N}]+/gu) ?? [];
  const results = profiles.map((profile) => {
    const requested = profile.match_test.tokens.flatMap((token) =>
      token.normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []);
    const matched = profile.match_test.kind === 'SOURCE_TOKEN_SEQUENCE'
      ? requested.length > 0 && requested.length <= words.length
        && words.some((_, offset) => offset <= words.length - requested.length
          && requested.every((token, index) => words[offset + index] === token))
      : requested.every((token) => words.includes(token));
    const leafId = profile.match_test.leaf_id;
    return {
      profile_id: profile.profile_id,
      profile_key: profile.profile_key,
      matched,
      predicate_result_digest: predicateDigest(leafId, matched),
      decisive_leaf_ids: [leafId],
    };
  });
  const matches = results.filter((entry) => entry.matched);
  return {
    results,
    selectedProfileId: matches.length === 1 ? matches[0].profile_id : null,
    selectedProfileKey: matches.length === 1 ? matches[0].profile_key : null,
    profileMatchState: matches.length === 0 ? 'NO_COMPATIBLE_PROFILE'
      : matches.length === 1 ? 'EXACT_ONE_MOST_SPECIFIC' : 'AMBIGUOUS_PROFILE_MATCH',
  };
}

function occurrenceState(rules, issues, noOutput) {
  if (noOutput) {
    return {
      extraction_state: 'COMPLETE', source_quality: 'SUFFICIENT',
      output_disposition: 'NO_OUTPUT',
    };
  }
  if (issues.length > 0 || rules.some(
    (rule) => rule.validation.output_disposition === 'REVIEW_ONLY',
  )) {
    return {
      extraction_state: rules.some(
        (rule) => rule.validation.extraction_state === 'AMBIGUOUS',
      ) ? 'AMBIGUOUS' : 'INCOMPLETE',
      source_quality: rules.some(
        (rule) => rule.validation.source_quality === 'DRAFTING_AMBIGUOUS',
      ) ? 'DRAFTING_AMBIGUOUS' : rules.some(
        (rule) => rule.validation.source_quality === 'SOURCE_LIMITED',
      ) ? 'SOURCE_LIMITED' : 'SUFFICIENT',
      output_disposition: 'REVIEW_ONLY',
    };
  }
  if (rules.some((rule) => rule.validation.output_disposition === 'APPROVED_LIMITED')) {
    return {
      extraction_state: 'COMPLETE', source_quality: 'SOURCE_LIMITED',
      output_disposition: 'APPROVED_LIMITED',
    };
  }
  if (rules.some((rule) => rule.validation.output_disposition === 'NORMAL')) {
    return {
      extraction_state: 'COMPLETE', source_quality: 'SUFFICIENT',
      output_disposition: 'NORMAL',
    };
  }
  return {
    extraction_state: 'COMPLETE', source_quality: 'SUFFICIENT',
    output_disposition: 'NO_COMPARISON',
  };
}

function buildSemanticCore({
  agreementId, occurrenceId, priorFamilyKey, definition, drafts, source, profiles,
  profileByFamily, profileByEffect, structureMember, sourceArtefactMember,
  technicalWhitespaceBySpanId, options,
}) {
  const allFacts = [];
  const allExpressions = [];
  const rules = [];
  const candidateEffects = [];
  const effectDetails = [];
  for (const draft of drafts) {
    const segments = source.effectSegments[draft.effect_index];
    const sourceSpanIds = segments.map((segment) => segment.span.span_id);
    if (!draft.has_rule) {
      const profileClaim = claimedProfileResults(
        profiles, segments.map((segment) => segment.text).join(''),
      );
      const effectId = contentId('STAGE_2Y_M7_V2_INSPECTED_EFFECT/V1', {
        input_occurrence_id: occurrenceId,
        source_span_ids: sourceSpanIds,
        fact_ids: [],
        expression_root_id: null,
      });
      const effect = {
        effect_id: effectId,
        input_occurrence_id: occurrenceId,
        source_span_ids: sourceSpanIds,
        fact_ids: [],
        expression_root_id: null,
        profile_results: profileClaim.results,
        selected_profile_id: null,
        selected_profile_key: null,
        no_more_specific_descendant_match: false,
        generic_level_output_authority: null,
      };
      candidateEffects.push(effect);
      effectDetails.push({ draft, effect, rule: null, facts: [], expressions: [], segments });
      continue;
    }
    const factSegments = new Map();
    for (const segment of segments.filter((entry) => entry.kind === 'FACT')) {
      const factInstanceKey = segment.fact_instance_key ?? segment.field_key;
      const selected = factSegments.get(factInstanceKey) ?? [];
      selected.push(segment);
      factSegments.set(factInstanceKey, selected);
    }
    const facts = draft.fact_specs.map((spec) => buildFact(
      agreementId, spec,
      factSegments.get(spec.fact_instance_key ?? spec.field_key).map(
        (segment) => segment.span,
      ),
    ));
    const factByField = new Map(facts.map((fact) => [fact.field_key, fact]));
    const expressionSegmentLists = new Map();
    for (const segment of segments.filter((entry) => entry.kind === 'EXPRESSION')) {
      const selected = expressionSegmentLists.get(segment.expression_key) ?? [];
      selected.push(segment);
      expressionSegmentLists.set(segment.expression_key, selected);
    }
    const expressionSegments = new Map([...expressionSegmentLists].map(
      ([key, selected]) => [key, selected[0]],
    ));
    const connectiveSpanIdsByExpressionKey = new Map([...expressionSegmentLists].map(
      ([key, selected]) => [key, selected.map((segment) => segment.span.span_id)],
    ));
    const expressionBuild = buildExpressions(
      draft, factByField, sourceSpanIds, expressionSegments,
      new Map(), connectiveSpanIdsByExpressionKey,
    );
    if (options.invalidChildRole === true && draft.effect_index === 0) {
      const selected = expressionBuild.records[0];
      selected.children[0].role = 'INVALID_ROLE';
      selected.expression_id = contentId('STAGE_2Y_M7_V2_EXPRESSION/V1', {
        operator: selected.operator,
        result_kind: selected.result_kind,
        children: selected.children,
        connective_span_ids: selected.connective_span_ids,
        authored_limb_marker_span_ids: selected.authored_limb_marker_span_ids,
        scope_span_ids: selected.scope_span_ids,
      });
      if (expressionBuild.records.length === 1) expressionBuild.rootExpressionId = selected.expression_id;
    }
    const factIds = facts.map((fact) => fact.fact_id);
    const effectId = contentId('STAGE_2Y_M7_V2_INSPECTED_EFFECT/V1', {
      input_occurrence_id: occurrenceId,
      source_span_ids: sourceSpanIds,
      fact_ids: factIds,
      expression_root_id: expressionBuild.rootExpressionId,
    });
    const profile = profileByEffect.get(draft) ?? profileByFamily.get(draft.family_key);
    const ruleId = contentId('AGREEMENT_LEGAL_RULE/V2', {
      agreement_id: agreementId,
      input_occurrence_id: occurrenceId,
      effect_id: effectId,
      family_key: draft.family_key,
      profile_id: profile.profile_id,
      subtype_path: profile.subtype_path,
      semantic_fact_keys: facts.map((fact) => fact.semantic_fact_key),
      canonical_expression_signature: draft.expression_signature,
      child_rule_ids: [],
      source_closure_id: source.sourceClosure.source_closure_id,
    });
    facts.forEach((fact) => { fact.owner_rule_id = ruleId; });
    const output = draft.output_disposition;
    const validation = output === 'REVIEW_ONLY' ? {
      extraction_state: draft.extraction_state ?? 'INCOMPLETE',
      source_quality: draft.source_quality ?? 'SUFFICIENT',
      output_disposition: output,
      issue_codes: [draft.issue_code ?? 'UNPROVED_DEPENDENT_RULE'],
      no_comparison_authority: null,
    } : {
      extraction_state: 'COMPLETE',
      source_quality: output === 'APPROVED_LIMITED' ? 'SOURCE_LIMITED' : 'SUFFICIENT',
      output_disposition: output,
      issue_codes: [],
      no_comparison_authority: output === 'NO_COMPARISON' ? {
        authority_kind: 'PROFILE_NO_COMPARISON_APPROVAL',
        policy_id: profile.no_comparison_policy.policy_id,
        lawyer_ruling_id: profile.no_comparison_policy.lawyer_ruling_id,
        input_occurrence_id: occurrenceId,
        rule_id: ruleId,
      } : null,
    };
    const rule = {
      schema_version: 'AGREEMENT_LEGAL_RULE/V2',
      rule_id: ruleId,
      input_occurrence_id: occurrenceId,
      authored_unit_id: source.nodeId,
      effect_id: effectId,
      family_key: draft.family_key,
      profile_id: profile.profile_id,
      subtype_path: profile.subtype_path,
      applies_to_fact_ids: facts.filter((fact) => fact.field_key === 'APPLIES_TO')
        .map((fact) => fact.fact_id),
      fact_ids: factIds,
      consumer_link_ids: [],
      root_expression_id: expressionBuild.rootExpressionId,
      child_rule_ids: [],
      source_closure_id: source.sourceClosure.source_closure_id,
      expression_signature: draft.expression_signature,
      equivalence_signature: derivedEquivalenceSignature(
        profile, draft.expression_signature, facts,
      ),
      validation,
    };
    const claimedSource = options.falseProfileClaim === true && draft.effect_index === 0
      ? [familyToken(draft.family_key), draft.subprofile_source_token].filter(Boolean).join(' ')
      : segments.map((segment) => segment.text).join('');
    const profileClaim = claimedProfileResults(profiles, claimedSource);
    const effect = {
      effect_id: effectId,
      input_occurrence_id: occurrenceId,
      source_span_ids: sourceSpanIds,
      fact_ids: factIds,
      expression_root_id: expressionBuild.rootExpressionId,
      profile_results: profileClaim.results,
      selected_profile_id: profileClaim.selectedProfileId,
      selected_profile_key: profileClaim.selectedProfileKey,
      no_more_specific_descendant_match: profileClaim.selectedProfileId !== null,
      generic_level_output_authority: null,
    };
    allFacts.push(...facts);
    allExpressions.push(...expressionBuild.records);
    rules.push(rule);
    candidateEffects.push(effect);
    effectDetails.push({
      draft, effect, rule, facts, expressions: expressionBuild.records, segments,
    });
  }
  const candidateSet = sealInlineRecord(
    'STAGE_2Y_M7_V2_INSPECTED_CANDIDATE_SET/V1', 'candidate_set_id', {
      authored_unit_id: source.nodeId,
      source_closure_id: source.sourceClosure.source_closure_id,
      considered_family_keys: FAMILY_KEYS,
      effects: candidateEffects,
    },
  );
  const ledgerEntries = effectDetails.map((detail) => {
    const operativeSegments = detail.segments.filter(
      (segment) => segment.operative_marker_kind !== undefined,
    );
    const operativeMarkers = operativeSegments.map((segment) => segment.span.span_id);
    const operativeKinds = operativeSegments.map((segment) => segment.operative_marker_kind);
    const effectKind = operativeKinds.includes('ENUMERATED_LIMB')
      ? operativeKinds.includes('MODAL') ? 'COMBINED_MODAL_LIMB' : 'ENUMERATED_LIMB'
      : 'MODAL';
    let treatments;
    if (detail.rule === null) {
      treatments = [{
        treatment_kind: 'LEGAL_TEXT_EXCLUSION',
        target_id: structureMember.structure_disposition_id,
        source_span_ids: detail.effect.source_span_ids,
        authority_id: structureMember.structure_disposition_id,
      }];
    } else {
      const factSpanIds = detail.segments.filter((segment) => segment.kind === 'FACT')
        .map((segment) => segment.span.span_id);
      treatments = [{
        treatment_kind: 'RULE',
        target_id: detail.rule.rule_id,
        source_span_ids: factSpanIds,
        authority_id: null,
      }, ...detail.expressions.map(
        (expression) => ({
          treatment_kind: 'EXPRESSION',
          target_id: expression.expression_id,
          source_span_ids: [...expression.connective_span_ids],
          authority_id: null,
        }),
      ), ...detail.segments.filter((segment) => segment.dependency_id !== undefined).map(
        (segment) => ({
          treatment_kind: 'DEPENDENCY',
          target_id: segment.dependency_id,
          source_span_ids: [segment.span.span_id],
          authority_id: null,
        }),
      )];
    }
    return {
      effect_id: detail.effect.effect_id,
      input_occurrence_id: occurrenceId,
      effect_kind: effectKind,
      rule_ids: detail.rule === null ? [] : [detail.rule.rule_id],
      source_span_ids: detail.effect.source_span_ids,
      operative_marker_span_ids: operativeMarkers,
      treatments,
    };
  });
  const effectLedger = sealInlineRecord(
    'STAGE_2Y_M7_V2_AUTHORED_UNIT_EFFECT_LEDGER/V1', 'effect_ledger_id', {
      authored_unit_id: source.nodeId,
      source_closure_id: source.sourceClosure.source_closure_id,
      entries: ledgerEntries,
    },
  );
  const sharedFactCoverages = source.segments.filter(
    (segment) => segment.shared_source_key !== undefined,
  ).map((segment) => {
    const factIds = allFacts.filter(
      (fact) => fact.source_support_ids.length === 1
        && fact.source_support_ids[0] === segment.span.span_id,
    ).map((fact) => fact.fact_id).sort();
    assert.equal(factIds.length, 2,
      'item42 shared duration must have exactly two direct fact owners');
    return sealInlineRecord(
      'STAGE_2Y_M7_V2_SHARED_FACT_COVERAGE/V1', 'shared_fact_coverage_id', {
        input_occurrence_id: occurrenceId,
        source_closure_id: source.sourceClosure.source_closure_id,
        span_id: segment.span.span_id,
        fact_ids: factIds,
        lawyer_decision_id:
          'd44da4450537479614de70175996b16a86495de989d1795ed4c01b7cba24412e',
        reason_code: 'SAME_SOURCE_DISTINCT_LEGAL_EFFECT_ROLE',
      },
    );
  });
  const sharedCoverageBySpanId = new Map(sharedFactCoverages.map(
    (coverage) => [coverage.span_id, coverage],
  ));
  const coverageEntries = source.segments.map((segment) => {
    const sharedCoverage = sharedCoverageBySpanId.get(segment.span.span_id);
    if (sharedCoverage !== undefined) {
      return {
        span_id: segment.span.span_id,
        treatment_kind: 'SHARED_FACT',
        owner_id: sharedCoverage.shared_fact_coverage_id,
        reason_code: sharedCoverage.reason_code,
        authority_id: sharedCoverage.lawyer_decision_id,
        materiality: 'MATERIAL',
      };
    }
    if (segment.kind === 'FACT') {
      const fact = allFacts.find((entry) => entry.source_support_ids.includes(segment.span.span_id));
      return {
        span_id: segment.span.span_id,
        treatment_kind: 'FACT',
        owner_id: fact.fact_id,
        reason_code: null,
        authority_id: null,
        materiality: segment.span.materiality,
      };
    }
    if (segment.kind === 'EXPRESSION') {
      const expression = allExpressions.find(
        (entry) => entry.connective_span_ids.includes(segment.span.span_id),
      );
      return {
        span_id: segment.span.span_id,
        treatment_kind: 'LOGIC_CONNECTIVE',
        owner_id: expression.expression_id,
        reason_code: null,
        authority_id: null,
        materiality: segment.span.materiality,
      };
    }
    if (segment.kind === 'DEPENDENCY') {
      return {
        span_id: segment.span.span_id,
        treatment_kind: 'RESOLVED_DEPENDENCY',
        owner_id: segment.dependency_id,
        reason_code: null,
        authority_id: null,
        materiality: segment.span.materiality,
      };
    }
    if (segment.kind === 'TECHNICAL_WHITESPACE') {
      const authority = technicalWhitespaceBySpanId.get(segment.span.span_id);
      assert.ok(authority, 'technical whitespace span requires its exact structure authority');
      return {
        span_id: segment.span.span_id,
        treatment_kind: 'STRUCTURAL_TEXT',
        owner_id: null,
        reason_code: 'WHITESPACE_OR_PUNCTUATION_ONLY',
        authority_id: authority.structure_disposition_id,
        materiality: 'NON_MATERIAL',
      };
    }
    if (segment.kind === 'NO_OUTPUT') {
      return {
        span_id: segment.span.span_id,
        treatment_kind: 'LEGAL_TEXT_EXCLUSION',
        owner_id: null,
        reason_code: structureMember.reason_code,
        authority_id: structureMember.structure_disposition_id,
        materiality: segment.span.materiality,
      };
    }
    if (segment.kind === 'SOURCE_ARTEFACT') {
      assert.notEqual(sourceArtefactMember, null);
      return {
        span_id: segment.span.span_id,
        treatment_kind: 'SOURCE_ARTEFACT',
        owner_id: null,
        reason_code: sourceArtefactMember.reason_code,
        authority_id: sourceArtefactMember.structure_disposition_id,
        materiality: 'NON_MATERIAL',
      };
    }
    return {
      span_id: segment.span.span_id,
      treatment_kind: 'SOURCE_ARTEFACT',
      owner_id: null,
      reason_code: 'UNEXPECTED_FIXTURE_SEGMENT',
      authority_id: null,
      materiality: segment.span.materiality,
    };
  });
  const issues = effectDetails.filter(
    (detail) => detail.rule?.validation.output_disposition === 'REVIEW_ONLY',
  ).map((detail) => ({
    effect_id: detail.effect.effect_id,
    rule_id: detail.rule.rule_id,
    issue_code: detail.rule.validation.issue_codes[0],
    extraction_state: detail.rule.validation.extraction_state,
    source_quality: detail.rule.validation.source_quality,
    source_span_ids: detail.effect.source_span_ids,
  }));
  const absenceProofs = effectDetails.filter(
    (detail) => detail.rule?.validation.output_disposition === 'APPROVED_LIMITED',
  ).map((detail) => {
    const profile = profileByFamily.get(detail.rule.family_key);
    const requirement = profile.required_fields.find(
      (entry) => entry.field_key === detail.draft.missing_required_field,
    );
    return {
      rule_id: detail.rule.rule_id,
      field_key: detail.draft.missing_required_field,
      observation_kind: 'SOURCE_NOT_EXPRESSLY_STATED',
      source_closure_id: source.sourceClosure.source_closure_id,
      authored_unit_id: source.nodeId,
      governing_chapeau_span_ids: source.sourceClosure.governing_chapeau_span_ids,
      checked_dependency_ids: source.sourceClosure.required_dependency_ids,
      profile_requirement_id: requirement.requirement_id,
      lawyer_ruling_id: requirement.lawyer_ruling_id,
    };
  });
  const allFamilyProfileResults = FAMILY_KEYS.map((familyKey) => ({
    family_key: familyKey,
    matched_profile_ids: [...new Set(candidateEffects.flatMap((effect) => effect.profile_results
      .filter((result) => result.matched
        && profiles.some((profile) => profile.family_key === familyKey
          && profile.profile_id === result.profile_id))
      .map((result) => result.profile_id)))].sort(),
  }));
  const isNoOutput = definition.unmatched_inspected_effect === true && rules.length === 0;
  const state = occurrenceState(rules, issues, isNoOutput);
  const matchStates = candidateEffects.map((effect) => {
    const count = effect.profile_results.filter((result) => result.matched).length;
    return count === 0 ? 'NO_COMPATIBLE_PROFILE'
      : count === 1 ? 'EXACT_ONE_MOST_SPECIFIC' : 'AMBIGUOUS_PROFILE_MATCH';
  });
  const profileMatchState = matchStates.every((value) => value === 'NO_COMPATIBLE_PROFILE')
    ? 'NO_COMPATIBLE_PROFILE'
    : matchStates.every((value) => value === 'EXACT_ONE_MOST_SPECIFIC')
      ? 'EXACT_ONE_MOST_SPECIFIC' : 'AMBIGUOUS_PROFILE_MATCH';
  const compatibleCrossFamilyMatchCount = allFamilyProfileResults.filter(
    (entry) => entry.family_key !== priorFamilyKey,
  ).reduce((count, entry) => count + entry.matched_profile_ids.length, 0);
  const noOutputAuthority = isNoOutput ? {
    authority_kind: 'BEN_APPROVED_OCCURRENCE_NO_OUTPUT',
    structure_disposition_id: structureMember.structure_disposition_id,
    policy_id: structureMember.policy_id,
    policy_version: structureMember.policy_version,
    lawyer_ruling_id: structureMember.lawyer_ruling_id,
    approver: structureMember.approver,
    legal_reason: structureMember.reason_code,
    covered_input_occurrence_ids: structureMember.scope.governed_input_occurrence_ids,
    inclusion_fixture_bindings: structureMember.inclusion_fixture_bindings,
    exclusion_fixture_bindings: structureMember.exclusion_fixture_bindings,
  } : null;
  const disposition = sealInlineRecord(
    'STAGE_2Y_M7_V2_DISPOSITION/V1', 'disposition_id', {
      input_occurrence_id: occurrenceId,
      prior_family_key: priorFamilyKey,
      authored_unit_id: source.nodeId,
      source_closure_id: source.sourceClosure.source_closure_id,
      source_closure_digest: sha256Hex(canonicalJson(source.sourceClosure)),
      candidate_set_id: candidateSet.candidate_set_id,
      candidate_set_digest: sha256Hex(canonicalJson(candidateSet)),
      rule_ids: rules.map((rule) => rule.rule_id),
      all_family_profile_results: allFamilyProfileResults,
      compatible_cross_family_match_count: compatibleCrossFamilyMatchCount,
      extraction_state: state.extraction_state,
      source_quality: state.source_quality,
      output_disposition: state.output_disposition,
      profile_match_state: profileMatchState,
      absence_proofs: absenceProofs,
      issues,
      no_comparison_authorities: rules.filter(
        (rule) => rule.validation.output_disposition === 'NO_COMPARISON',
      ).map((rule) => rule.validation.no_comparison_authority),
      no_output_authority: noOutputAuthority,
    },
  );
  const familyCorrections = rules.filter((rule) => rule.family_key !== priorFamilyKey).map(
    (rule) => {
      const body = {
        rule_id: rule.rule_id,
        old_family_key: priorFamilyKey,
        new_family_key: rule.family_key,
        source_support_ids: [allFacts.find(
          (fact) => fact.owner_rule_id === rule.rule_id,
        ).source_support_ids[0]],
        lawyer_ruling_id: profileRuling(rule.family_key),
      };
      return {
        correction_id: contentId('STAGE_2Y_M7_V2_FAMILY_CORRECTION/V1', body),
        ...body,
      };
    },
  );
  return {
    facts: allFacts,
    expressions: allExpressions,
    rules,
    candidateSet,
    effectLedger,
    sharedFactCoverages,
    coveragePartition: {
      source_closure_id: source.sourceClosure.source_closure_id,
      entries: coverageEntries,
    },
    disposition,
    familyCorrections,
  };
}

const DEFAULT_REQUIRED_CLASSIFICATION_LEVELS = Object.freeze([
  'APPLIES_TO',
  'PROVISION_TYPE',
]);

function classificationLevelNames(profile) {
  return [
    'APPLIES_TO',
    ...profile.classification_path.map((_, index) =>
      index === 0 ? 'PROVISION_TYPE'
        : index === 1 ? 'SUB_PROVISION_TYPE'
          : index === 2 ? 'NESTED_SUBTYPE' : `NESTED_SUBTYPE_${index - 1}`),
  ];
}

function requiredClassificationLevelsForDrafts(definition, drafts, profiles) {
  const emittingProfiles = drafts.filter((draft) =>
    draft.has_rule
      && ['NORMAL', 'APPROVED_LIMITED'].includes(draft.output_disposition)).map((draft) =>
    profiles.profileByEffect.get(draft) ?? profiles.profileByFamily.get(draft.family_key));
  assert.equal(emittingProfiles.every(Boolean), true,
    'every emitting draft must resolve to one approved profile');
  if (emittingProfiles.length === 0) return [...DEFAULT_REQUIRED_CLASSIFICATION_LEVELS];
  const vectors = emittingProfiles.map(classificationLevelNames);
  for (const vector of vectors.slice(1)) {
    assert.deepEqual(vector, vectors[0],
      'all emitting profiles must require one common classification-level vector');
  }
  if (definition.case_id === 'item-28-linked-d-and-o-rights-survival') {
    assert.deepEqual(vectors[0], [
      'APPLIES_TO',
      'PROVISION_TYPE',
      'SUB_PROVISION_TYPE',
    ], 'item28 emitting profiles require the exact three-level classification floor');
  }
  return vectors[0];
}

function buildViewPolicy(
  store,
  profileSnapshots,
  options = {},
  requiredClassificationLevels = DEFAULT_REQUIRED_CLASSIFICATION_LEVELS,
) {
  const fieldKeys = [...new Set(profileSnapshots.flatMap((profile) => [
    ...profile.required_fields,
    ...profile.optional_fields,
  ].map((requirement) => requirement.field_key)))].sort();
  const viewPolicy = sealBoundRecord(
    'STAGE_2Y_M7_V2_VIEW_POLICY/V1', 'view_policy_id', {
      labels: fieldKeys.map((fieldKey) => ({
        label_id: `label-${fieldKey}`,
        field_key: fieldKey,
        text: fieldKey.toLowerCase().replaceAll('_', ' '),
      })),
      layouts: ['compact-v2', 'expanded-v2'].map((layoutId) => ({
        layout_id: layoutId,
        required_classification_levels: [...requiredClassificationLevels],
        required_field_keys: ['APPLIES_TO', 'LEGAL_EFFECT'],
        permitted_omission_rule_ids: ['DISPLAY_OPTIONAL_NON_MATERIAL/V1'],
      })),
      formatters: FACT_TYPES.map((valueType) => ({
        value_type: valueType,
        formatter_id: FORMATTERS[valueType],
      })),
      grouping_policy: {
        allowed: options.groupingEnabled === true,
        requires_exact_equivalence_signature: true,
      },
    },
  );
  return {
    record: viewPolicy,
    binding: addRecord(store, 'fixture/inputs/view-policy.json', viewPolicy, 'view_policy_id'),
  };
}

function buildSemanticInputBindings({
  store, agreementId, occurrenceId, source, profiles, structure,
}) {
  const baseSet = sealBoundRecord('AGREEMENT_ANALYSIS_SET/V1', 'agreement_analysis_set_id', {
    members: [{
      agreement_id: agreementId,
      governed_input_occurrence_ids: [occurrenceId],
    }],
  });
  const agreementIndexMembers = [
    source.agreementIndexBinding,
    structure.item39.item39Index.binding,
  ].filter((binding, index, values) => values.findIndex(
    (candidate) => candidate.path === binding.path && candidate.record_id === binding.record_id,
  ) === index).sort(
    (left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
  );
  const agreementIndexSet = sealBoundRecord(
    'AGREEMENT_INDEX_SET/V1', 'agreement_index_set_id', {
      members: agreementIndexMembers,
    },
  );
  const contextSet = sealBoundRecord(
    'CONTEXT_COMPILATION_SET/V1', 'context_compilation_set_id', {
      members: [{ agreement_id: agreementId, edges: source.contextEdges }],
    },
  );
  const records = new Map([
    ['BASE_ANALYSIS_SET', {
      record: baseSet,
      binding: addRecord(
        store, 'fixture/inputs/base-analysis-set.json', baseSet, 'agreement_analysis_set_id',
      ),
    }],
    ['AGREEMENT_INDEX_SET', {
      record: agreementIndexSet,
      binding: addRecord(
        store, 'fixture/inputs/agreement-index-set.json', agreementIndexSet,
        'agreement_index_set_id',
      ),
    }],
    ['CONTEXT_COMPILATION_SET', {
      record: contextSet,
      binding: addRecord(
        store, 'fixture/inputs/context-compilation-set.json', contextSet,
        'context_compilation_set_id',
      ),
    }],
    ['APPROVED_FAMILY_PACKET_SET', {
      record: structure.packetEvidence.record,
      binding: structure.packetEvidence.binding,
    }],
    ['APPROVED_FAMILY_PROFILE_SET', {
      record: profiles.profileSet,
      binding: profiles.profileSetBinding,
    }],
    ['APPROVED_STRUCTURE_DISPOSITION_SET', {
      record: structure.record,
      binding: structure.binding,
    }],
  ]);
  return {
    records,
    bindings: INPUT_ROLES.map((role) => ({ role, binding: records.get(role).binding })),
    candidateBindings: INPUT_ROLES.map((inputRole) => ({
      input_role: inputRole,
      binding: records.get(inputRole).binding,
    })),
  };
}

function buildCandidateGovernance({
  store, semanticInputs, profiles, structure, viewPolicy, options = {},
}) {
  const parentAuthorityBinding = fixedBinding(
    `${MIGRATION_ROOT}/control/m7-v2-repair-work1-7-authority.json`,
    'STAGE_2Y_M7_V2_REPAIR_WORK1_7_AUTHORITY/V1', 'authority_id',
    cases.governance_constants.candidate_authority_id, AUTHORITY_SHA256,
  );
  const activationReceiptBinding = fixedBinding(
    `${MIGRATION_ROOT}/receipts/stage-2y-structure-m7-v2-repair-work1-7-authority-activation.json`,
    'STAGE_2Y_M7_V2_REPAIR_WORK1_7_AUTHORITY_ACTIVATION_RECEIPT/V1',
    'activation_receipt_id', cases.governance_constants.candidate_activation_id,
    ACTIVATION_SHA256,
  );
  const work0Binding = structure.packetEvidence.work0.binding;
  assert.equal(work0Binding.record_id, cases.governance_constants.work0_evidence_root_id);
  const singletonPaths = {
    compiler: 'lib/canonical-v2/agreement-analysis-consolidation.js',
    deterministic_generator: 'lib/canonical-v2/m7-v2-deterministic-generator.js',
    contract_validator: 'lib/canonical-v2/m7-v2-contract.js',
    projector: 'lib/canonical-v2/agreement-projection.js',
    independent_verifier:
      'scripts/stage-2y-structure-m7-v2-repair-verify-candidate.mjs',
  };
  const singletonBindings = Object.fromEntries(Object.entries(singletonPaths).map(
    ([role, path]) => [role, addText(store, path, `fixture component ${role}\n`)],
  ));
  const runnerBindings = RUNNER_PATHS.map((path) => addText(store, path, `${path}\n`));
  const testBindings = TEST_PATHS.map((path) => addText(store, path, `${path}\n`));
  const work1Receipt = sealBoundRecord(
    'STAGE_2Y_M7_V2_REPAIR_WORK1_CONTRACT_RECEIPT/V1', 'work1_contract_receipt_id', {
      status: options.negativeCaseId === 'candidate-predecessor-receipt-not-pass'
        ? 'FAIL' : 'PASS',
      state: options.negativeCaseId === 'candidate-predecessor-receipt-not-pass'
        ? 'FAILED_WORK1_CONTRACT' : 'PASS_WORK1_CONTRACT_FROZEN',
      effects: { files_written: 0 },
    },
  );
  const predecessorBinding = addRecord(
    store,
    `${MIGRATION_ROOT}/receipts/stage-2y-structure-m7-v2-repair-work1-contract.json`,
    work1Receipt,
    'work1_contract_receipt_id',
  );
  const codeBindings = {
    ...singletonBindings,
    runners: runnerBindings,
    tests: testBindings,
  };
  const boundPaths = [
    parentAuthorityBinding,
    activationReceiptBinding,
    work0Binding,
    ...Object.values(singletonBindings),
    ...runnerBindings,
    ...testBindings,
    ...semanticInputs.candidateBindings.map((entry) => entry.binding),
    profiles.profileSetBinding,
    ...profiles.treeBindings.map((entry) => entry.binding),
    structure.binding,
    viewPolicy.binding,
    predecessorBinding,
  ].map((binding) => binding.path);
  const counts = {
    code_file_count: 5 + runnerBindings.length + testBindings.length,
    runner_count: runnerBindings.length,
    test_count: testBindings.length,
    semantic_input_count: semanticInputs.candidateBindings.length,
    subtype_tree_count: profiles.treeBindings.length,
    predecessor_receipt_count: 1,
    unique_bound_path_count: new Set(boundPaths).size,
  };
  const candidateTreeBindings = options.negativeCaseId
    === 'candidate-subtype-tree-binding-drift'
    ? profiles.treeBindings.map((entry, index) => index === 0 ? {
      ...entry,
      binding: { ...entry.binding, sha256: 'f'.repeat(64) },
    } : entry) : profiles.treeBindings;
  const candidate = sealBoundRecord(
    'STAGE_2Y_M7_V2_CANDIDATE_REGISTRATION/V1', 'candidate_registration_id', {
      stage: 'M7_V2_REPAIR',
      lifecycle_state: 'CANDIDATE_PENDING_REVIEW',
      parent_authority_binding: parentAuthorityBinding,
      activation_receipt_binding: activationReceiptBinding,
      work0_evidence_root_binding: work0Binding,
      code_bindings: codeBindings,
      semantic_input_bindings: semanticInputs.candidateBindings,
      family_profile_set_binding: profiles.profileSetBinding,
      subtype_tree_bindings: candidateTreeBindings,
      structure_disposition_set_binding: structure.binding,
      view_policy_binding: viewPolicy.binding,
      predecessor_receipt_bindings: [{ work: 'WORK1', binding: predecessorBinding }],
      allowed_output_root: `${MIGRATION_ROOT}/m7-v2-repair/fixture-candidate/`,
      counts,
      effects: CANDIDATE_EFFECTS,
    },
  );
  const candidatePath = `${MIGRATION_ROOT}/control/m7-v2-repair-candidate-registrations/${candidate.candidate_registration_id}.json`;
  const candidateBinding = addRecord(
    store, candidatePath, candidate, 'candidate_registration_id',
  );
  const verification = sealBoundRecord(
    'STAGE_2Y_M7_V2_CANDIDATE_REGISTRATION_VERIFICATION/V1', 'verification_id', {
      state: 'PASS_CANDIDATE_REGISTRATION',
      candidate_registration_id: candidate.candidate_registration_id,
      registration_binding: candidateBinding,
      checks: CANDIDATE_CHECKS.map((checkId) => ({ check_id: checkId, status: 'PASS' })),
      counts,
      effects: VERIFICATION_EFFECTS,
    },
  );
  const governance = {
    candidate_registration_id: candidate.candidate_registration_id,
    candidate_registration_verification: verification,
    candidate_registration_binding: candidateBinding,
    code_bindings: [
      { role: 'COMPILER', binding: singletonBindings.compiler },
      { role: 'DETERMINISTIC_GENERATOR', binding: singletonBindings.deterministic_generator },
      { role: 'CONTRACT_VALIDATOR', binding: singletonBindings.contract_validator },
    ],
    semantic_input_bindings: semanticInputs.bindings,
    family_profile_set_binding: profiles.profileSetBinding,
    structure_disposition_set_binding: structure.binding,
    view_policy_binding: viewPolicy.binding,
    predecessor_receipt_bindings: [predecessorBinding],
  };
  return { candidate, candidateBinding, verification, governance, predecessorBinding };
}

function normaliseScenarioDefinition(definition) {
  if (definition.case_id === 'item-15-native-source-artefact') {
    return {
      ...definition,
      effects: [{
        family_key: 'CONSIDERATION',
        subprofile_key: 'NATIVE_PAGE_ARTEFACT',
        expression_signature: 'ALL_OF(APPLIES_TO,FAMILY_MARKER)',
        temporal_fields: [],
        extraction_state: 'INCOMPLETE',
        source_quality: 'SOURCE_LIMITED',
        output_disposition: 'REVIEW_ONLY',
        issue_code: 'NATIVE_SOURCE_ARTEFACT_REVIEW_REQUIRED',
      }],
    };
  }
  if (definition.case_id === 'item-41-ben-approved-no-comparison') {
    return {
      ...definition,
      effects: [{
        family_key: 'CONSIDERATION',
        subprofile_key: 'BEN_NO_COMPARISON',
        expression_signature: 'ALL_OF(APPLIES_TO,FAMILY_MARKER)',
        temporal_fields: [],
        output_disposition: 'NO_COMPARISON',
      }],
    };
  }
  if (definition.case_id === 'generic-ancestor-exact-ben-exception') {
    return {
      ...definition,
      effects: definition.effects.map((effect) => ({
        ...effect,
        missing_required_field: 'NOTICE_FORM',
      })),
    };
  }
  return definition;
}

function makeResolver(store) {
  return (binding) => {
    const bytes = store.get(binding.path);
    if (!bytes) throw new Error(`fixture resolver has no bytes for ${binding.path}`);
    return Buffer.from(bytes);
  };
}

function buildScenario(rawDefinition, options = {}) {
  const definition = normaliseScenarioDefinition(rawDefinition);
  const scenarioOptions = {
    ...options,
    allowedSourceTypeByFamily: FOCUSED_WORK0_SOURCE_CONFIG[definition.case_id] !== undefined
      ? {
        ...options.allowedSourceTypeByFamily,
        [definition.work0_authority.family_key]: 'SENTENCE',
      }
      : options.allowedSourceTypeByFamily,
    nativeSourceArtefact: options.nativeSourceArtefact === true
      || definition.case_id === 'item-15-native-source-artefact',
    incompleteTreeFamily: options.incompleteTreeFamily
      ?? (['generic-ancestor-exact-ben-exception', 'generic-ancestor-incomplete-rollout']
        .includes(definition.case_id) ? 'TERMINATION' : undefined),
    genericAuthority: options.genericAuthority === true
      || definition.case_id === 'generic-ancestor-exact-ben-exception',
    excludedDimension: options.excludedDimension
      ?? (definition.required_absence_observations?.length === 1 ? {
        dimension_key: definition.required_absence_observations[0].field_key,
        disposition: 'EXCLUDED',
        owner_profile_id: null,
        owner_field_key: null,
      } : undefined),
    excludedDimensionFamily: options.excludedDimensionFamily
      ?? (definition.required_absence_observations?.length === 1
        ? definition.effects[0].family_key : undefined),
  };
  const store = new Map();
  const agreementId = definition.work0_authority?.agreement_id
    ?? `${cases.governance_constants.agreement_id}:${definition.case_id}`;
  const occurrenceId = `${cases.governance_constants.input_occurrence_id}:${definition.case_id}`;
  const priorFamilyKey = cases.governance_constants.prior_family_key;
  const drafts = makeEffectDrafts(definition, scenarioOptions);
  const source = buildSourceBundle({
    store, agreementId, drafts, scenarioKey: definition.case_id, options: scenarioOptions,
  });
  let heldInvalidFactSpecs = null;
  if (semanticTemporalFactNegativeCaseIds.has(scenarioOptions.negativeCaseId)) {
    const positiveDrafts = makeEffectDrafts(definition, {
      ...scenarioOptions,
      negativeCaseId: null,
    });
    assert.equal(positiveDrafts.length, drafts.length,
      'temporal fact mutation requires an equivalent positive draft set');
    heldInvalidFactSpecs = drafts.map((draft) => draft.fact_specs);
    drafts.forEach((draft, index) => {
      draft.fact_specs = positiveDrafts[index].fact_specs;
    });
  }
  const profiles = buildProfileInfrastructure({
    store, definition, effectDrafts: drafts, occurrenceId, options: scenarioOptions,
  });
  if (heldInvalidFactSpecs !== null) {
    drafts.forEach((draft, index) => {
      draft.fact_specs = heldInvalidFactSpecs[index];
    });
  }
  if (scenarioOptions.negativeCaseId
      === 'item-42-claim-continuation-loses-until-disposition') {
    const claimDraft = drafts.find(
      (draft) => draft.subprofile_key === 'CLAIM_CONTINUATION',
    );
    assert.ok(claimDraft, 'until-disposition mutation requires the claim continuation draft');
    const incompleteSignature =
      'IF_THEN(CLAIM_MADE_PURSUANT_TO_RIGHTS,ALL_OF(CLAIM_CONTINUES_SUBJECT_TO_SECTION,CLAIM_CONTINUES_WITH_RIGHTS))';
    const incompleteTree = annotateExpressionTree(
      parseExpressionSignature(incompleteSignature),
    );
    claimDraft.expression_signature = incompleteSignature;
    claimDraft.expression_tree = incompleteTree.root;
    claimDraft.expression_nodes = incompleteTree.expressions;
    claimDraft.expression_fields = incompleteTree.fields;
  }
  const structure = buildStructureSet({
    store, source, occurrenceId, scenarioKey: definition.case_id, options: scenarioOptions,
  });
  const requiredClassificationLevels = requiredClassificationLevelsForDrafts(
    definition, drafts, profiles,
  );
  const viewPolicy = buildViewPolicy(
    store, profiles.snapshots, scenarioOptions, requiredClassificationLevels,
  );
  const semanticInputs = buildSemanticInputBindings({
    store, agreementId, occurrenceId, source, profiles, structure,
  });
  const candidate = buildCandidateGovernance({
    store, semanticInputs, profiles, structure, viewPolicy, options: scenarioOptions,
  });
  const semantic = buildSemanticCore({
    agreementId,
    occurrenceId,
    priorFamilyKey,
    definition,
    drafts,
    source,
    profiles: profiles.profiles,
    profileByFamily: profiles.profileByFamily,
    profileByEffect: profiles.profileByEffect,
    structureMember: structure.member,
    sourceArtefactMember: structure.sourceArtefactMember,
    technicalWhitespaceBySpanId: structure.technicalWhitespaceBySpanId,
    options: scenarioOptions,
  });
  if (scenarioOptions.genericAuthority === true) {
    const rule = semantic.rules[0];
    const effect = semantic.candidateSet.effects.find(
      (entry) => entry.effect_id === rule.effect_id,
    );
    const profile = profiles.snapshots.find((entry) => entry.profile_id === rule.profile_id);
    const positive = profile.fixture_proofs.find((proof) => proof.kind === 'POSITIVE');
    const negative = profile.fixture_proofs.find((proof) => proof.kind === 'NEAR_NEGATIVE');
    effect.generic_level_output_authority = {
      authority_kind: 'GENERIC_LEVEL_OUTPUT_APPROVED',
      profile_id: profile.profile_id,
      profile_set_version: profile.profile_set_version,
      profile_set_binding: profile.profile_set_binding,
      lawyer_ruling_id: positive.lawyer_ruling_id,
      approver: 'BEN_GOODCHILD',
      covered_occurrence_class: profile.classification_path.join(' > '),
      legal_reason: 'GENERIC_ANCESTOR_OUTPUT_APPROVED_FOR_EXACT_COVERED_OCCURRENCE_CLASS',
      covered_input_occurrence_ids: [occurrenceId],
      inclusion_fixture_bindings: [positive.fixture_binding],
      exclusion_fixture_bindings: [negative.fixture_binding],
    };
    restampInline(
      semantic.candidateSet,
      'STAGE_2Y_M7_V2_INSPECTED_CANDIDATE_SET/V1',
      'candidate_set_id',
    );
    semantic.disposition.candidate_set_id = semantic.candidateSet.candidate_set_id;
    semantic.disposition.candidate_set_digest = sha256Hex(canonicalJson(semantic.candidateSet));
    restampInline(
      semantic.disposition,
      'STAGE_2Y_M7_V2_DISPOSITION/V1',
      'disposition_id',
    );
  }
  const ownershipLinks = [];
  if (definition.case_id === 'item-42-linked-d-and-o-rights-survival'
      && semantic.rules.some((rule) => rule.subtype_path.at(-1) === 'CLAIM_CONTINUATION')) {
    const ownerRule = semantic.rules.find(
      (rule) => rule.subtype_path.at(-1) === 'RIGHTS_SURVIVAL',
    );
    const consumerRule = semantic.rules.find(
      (rule) => rule.subtype_path.at(-1) === 'CLAIM_CONTINUATION',
    );
    const ownerFact = semantic.facts.find(
      (fact) => fact.owner_rule_id === ownerRule?.rule_id
        && fact.field_key === 'RIGHTS_SURVIVAL_DURATION',
    );
    const dependency = source.dependencies.find(
      (entry) => entry.dependency_type === 'DURATION_CONDITION_REFERENCE',
    );
    assert.ok(ownerRule && consumerRule && ownerFact && dependency,
      'item42 requires rights owner, claim consumer, duration fact, and deictic dependency');
    assert.equal(dependency.target_id, ownerFact.semantic_fact_key);
    const linkBody = {
      consumer_rule_id: consumerRule.rule_id,
      owner_rule_id: ownerRule.rule_id,
      owner_fact_id: ownerFact.fact_id,
      resolved_owner_target_id: ownerFact.semantic_fact_key,
      source_support_ids: ownerFact.source_support_ids,
      consumer_reference_span_ids: dependency.source_support_ids,
      consumer_dependency_ids: [dependency.dependency_id],
      consumer_context_edge_ids: [dependency.context_edge_id],
    };
    const link = {
      link_id: contentId('AGREEMENT_SEMANTIC_OWNERSHIP_LINK/V2', linkBody),
      ...linkBody,
    };
    consumerRule.consumer_link_ids = [link.link_id];
    ownershipLinks.push(link);
  }
  if (scenarioOptions.ownershipLink === true) {
    const ownerRule = semantic.rules.find((rule) => rule.family_key === 'TERMINATION');
    const consumerRule = semantic.rules.find(
      (rule) => rule.family_key
        === (scenarioOptions.ownershipConsumerFamily ?? 'TERMINATION_FEE'),
    );
    const ownerFact = semantic.facts.find(
      (fact) => fact.owner_rule_id === ownerRule?.rule_id && fact.field_key === 'APPLIES_TO',
    );
    const dependency = source.dependencies[0];
    assert.ok(ownerRule && consumerRule && ownerFact && dependency,
      'ownership fixture requires owner, consumer, owner fact, and resolved dependency');
    const linkBody = {
      consumer_rule_id: consumerRule.rule_id,
      owner_rule_id: ownerRule.rule_id,
      owner_fact_id: ownerFact.fact_id,
      resolved_owner_target_id: dependency.target_id,
      source_support_ids: ownerFact.source_support_ids,
      consumer_reference_span_ids: dependency.source_support_ids,
      consumer_dependency_ids: [dependency.dependency_id],
      consumer_context_edge_ids: [dependency.context_edge_id],
    };
    const link = {
      link_id: contentId('AGREEMENT_SEMANTIC_OWNERSHIP_LINK/V2', linkBody),
      ...linkBody,
    };
    consumerRule.consumer_link_ids = [link.link_id];
    ownershipLinks.push(link);
  }
  for (const consumerRuleId of new Set(
    ownershipLinks.map((link) => link.consumer_rule_id),
  )) {
    const consumerRule = semantic.rules.find((rule) => rule.rule_id === consumerRuleId);
    const profile = profiles.profiles.find(
      (entry) => entry.profile_id === consumerRule?.profile_id,
    );
    assert.ok(consumerRule && profile,
      'ownership-link fixture requires its consumer rule and approved profile');
    const consumerFacts = semantic.facts.filter(
      (fact) => consumerRule.fact_ids.includes(fact.fact_id),
    );
    consumerRule.equivalence_signature = derivedEquivalenceSignature(
      profile,
      consumerRule.expression_signature,
      consumerFacts,
      { ownershipLinks, allFacts: semantic.facts, consumerRuleId },
    );
    const linkedEntriesBySlot = Object.fromEntries(EQUIVALENCE_SLOTS.map((slot) => [
      slot,
      consumerRule.equivalence_signature[slot].filter((entry) => entry.kind === 'LINKED_FACT'),
    ]));
    if ((scenarioOptions.negativeCaseId === undefined
        || scenarioOptions.negativeCaseId === null)
        && definition.case_id === 'item-42-linked-d-and-o-rights-survival') {
      assert.deepEqual(
        Object.entries(linkedEntriesBySlot).filter(([, entries]) => entries.length > 0)
          .map(([slot]) => slot),
        ['timing'],
        'item42 Claim must group its delegated duration reference only as timing',
      );
      assert.deepEqual(
        linkedEntriesBySlot.timing.map((entry) => entry.field_key),
        ['CLAIM_CONTINUATION_PERIOD_REFERENCE'],
        'item42 Claim timing must contain its exact linked duration fact',
      );
    } else if ((scenarioOptions.negativeCaseId === undefined
        || scenarioOptions.negativeCaseId === null)
        && scenarioOptions.ownershipLink === true) {
      assert.deepEqual(
        Object.entries(linkedEntriesBySlot).filter(([, entries]) => entries.length > 0)
          .map(([slot]) => slot),
        ['actor'],
        'item25 consumer must group its delegated owner only as actor',
      );
      assert.deepEqual(
        linkedEntriesBySlot.actor.map((entry) => entry.field_key),
        ['TERMINATION_EVENT_OWNER'],
        'item25 actor must contain its exact linked termination-event owner',
      );
    }
  }
  const analysisBody = {
    agreement_id: agreementId,
    governed_input_occurrence_ids: [occurrenceId],
    governance: candidate.governance,
    profile_snapshots: profiles.snapshots,
    candidate_sets: [semantic.candidateSet],
    source_closures: [source.sourceClosure],
    dependencies: source.dependencies,
    facts: semantic.facts,
    expressions: semantic.expressions,
    rules: semantic.rules,
    authored_unit_effect_ledgers: [semantic.effectLedger],
    shared_fact_coverages: semantic.sharedFactCoverages,
    coverage_partitions: [semantic.coveragePartition],
    ownership_links: ownershipLinks,
    family_corrections: semantic.familyCorrections,
    dispositions: [semantic.disposition],
    counts: {
      governed_input_occurrences: 1,
      rules: semantic.rules.length,
      facts: semantic.facts.length,
      expressions: semantic.expressions.length,
      shared_fact_coverages: semantic.sharedFactCoverages.length,
      source_closures: 1,
      dispositions: 1,
    },
  };
  const analysis = sealInlineRecord(
    'AGREEMENT_ANALYSIS/V2', 'agreement_analysis_id', analysisBody,
  );
  return {
    definition,
    options: scenarioOptions,
    store,
    resolveBinding: makeResolver(store),
    analysis,
    source,
    profiles,
    structure,
    viewPolicy,
    semanticInputs,
    candidate,
    semantic,
  };
}

function buildItem39Source(store, draft) {
  const selected = addEvidenceFile(store, ITEM39_INDEX_PATH);
  const agreementIndex = selected.record;
  const sourceBytes = Buffer.from(agreementIndex.source_binding.canonical_text, 'utf8');
  const sourceNode = agreementIndex.nodes.find(
    (node) => node.node_occurrence_id === ITEM39_PARENT_NODE_ID,
  );
  assert.ok(sourceNode);
  const governingStartByte = sourceNode.extent_span.start_byte;
  const governingEndByte = sourceNode.extent_span.end_byte;
  assert.equal(sha256Hex(sourceBytes.subarray(governingStartByte, governingEndByte)),
    sourceNode.extent_span.text_sha256);
  const nodeText = sourceBytes.subarray(governingStartByte, governingEndByte).toString('utf8');
  const structuralDispositionIds = [
    ITEM39_DISPOSITION_ID,
    '6a5b77ebda120dc322edf5febfc44c03663e9c3a3dc92b55000a3a40e53f0c7d',
    '64c180da22ae7721b3e0e7cced6786ba824bc632a42dccf53330b1cbc4531b2d',
  ];
  const dispositionById = new Map(agreementIndex.inline_marker_dispositions.map(
    (disposition) => [disposition.disposition_id, disposition],
  ));
  const limbRanges = structuralDispositionIds.flatMap((dispositionId) => {
    const disposition = dispositionById.get(dispositionId);
    assert.ok(disposition);
    return disposition.marker_spans.map((span) => ({
      kind: 'LIMB_MARKER',
      start_byte: span.start_byte,
      end_byte: span.end_byte,
      source_disposition_id: dispositionId,
      operative_marker_kind: 'ENUMERATED_LIMB',
    }));
  });
  const actorOffset = nodeText.indexOf('Parent');
  assert.equal(actorOffset, 3);
  const actorStartByte = governingStartByte
    + Buffer.byteLength(nodeText.slice(0, actorOffset), 'utf8');
  const actorRange = {
    kind: 'FACT',
    field_key: 'APPLIES_TO',
    start_byte: actorStartByte,
    end_byte: actorStartByte + Buffer.byteLength('Parent', 'utf8'),
  };
  const modalRanges = [...nodeText.matchAll(/\b(?:shall|would)\b/giu)].map((match) => {
    const startByte = governingStartByte
      + Buffer.byteLength(nodeText.slice(0, match.index), 'utf8');
    return {
      kind: 'EXPRESSION',
      start_byte: startByte,
      end_byte: startByte + Buffer.byteLength(match[0], 'utf8'),
      operative_marker_kind: 'MODAL',
    };
  });
  assert.deepEqual(modalRanges.map((range) => sourceBytes.subarray(
    range.start_byte, range.end_byte,
  ).toString('utf8').toLowerCase()), ['shall', 'would', 'shall', 'shall']);
  const isolatedRanges = [actorRange, ...modalRanges, ...limbRanges].sort(
    (left, right) => left.start_byte - right.start_byte,
  );
  const segments = [];
  let cursor = governingStartByte;
  for (const range of isolatedRanges) {
    assert.equal(range.start_byte >= cursor, true);
    if (range.start_byte > cursor) {
      segments.push({ kind: 'EXPRESSION', start_byte: cursor, end_byte: range.start_byte });
    }
    segments.push(range);
    cursor = range.end_byte;
  }
  if (cursor < governingEndByte) {
    segments.push({ kind: 'EXPRESSION', start_byte: cursor, end_byte: governingEndByte });
  }
  const connectiveSegments = segments.filter((segment) => segment.kind === 'EXPRESSION');
  assert.equal(connectiveSegments.length >= draft.expression_nodes.length, true);
  connectiveSegments.forEach((segment, index) => {
    segment.expression_key = draft.expression_nodes[index % draft.expression_nodes.length]
      .expression_key;
  });
  for (const segment of segments) {
    const textBytes = sourceBytes.subarray(segment.start_byte, segment.end_byte);
    const containsAuthoredCharacters = /[\p{L}\p{N}]/u.test(textBytes.toString('utf8'));
    segment.text = textBytes.toString('utf8');
    segment.span = {
      span_id: contentId('AGREEMENT_SOURCE_SPAN/V2', {
        agreement_index_id: agreementIndex.agreement_index_id,
        source_node_occurrence_id: ITEM39_PARENT_NODE_ID,
        start_byte: segment.start_byte,
        end_byte: segment.end_byte,
        text_sha256: sha256Hex(textBytes),
      }),
      source_node_occurrence_id: ITEM39_PARENT_NODE_ID,
      start_byte: segment.start_byte,
      end_byte: segment.end_byte,
      text_sha256: sha256Hex(textBytes),
      legal_text: containsAuthoredCharacters,
      operative: segment.operative_marker_kind !== undefined,
      materiality: containsAuthoredCharacters ? 'MATERIAL' : 'NON_MATERIAL',
    };
  }
  const actorSegment = segments.find((segment) => segment === actorRange);
  const contextEdge = {
    edge_id: 'edge-item39-local-parent',
    edge_type: 'PARTY_ALIAS',
    target_id: 'PARENT',
    state: 'RESOLVED',
    source_support_ids: [actorSegment.span.span_id],
  };
  const sourceClosure = sealInlineRecord(
    'STAGE_2Y_M7_V2_REVIEWED_SOURCE_CLOSURE/V1', 'source_closure_id', {
      authored_unit_id: ITEM39_PARENT_NODE_ID,
      agreement_index_binding: selected.binding,
      canonical_source_binding: {
        canonical_text_id: agreementIndex.source_binding.canonical_text_id,
        canonical_text_sha256: agreementIndex.source_binding.canonical_text_sha256,
        canonical_text_byte_length: agreementIndex.source_binding.canonical_text_byte_length,
      },
      source_node_occurrence_id: ITEM39_PARENT_NODE_ID,
      complete_review_state: 'COMPLETE_REVIEWED_SOURCE_CLOSURE',
      governing_chapeau_span_ids: [connectiveSegments[0].span.span_id],
      required_dependency_ids: [],
      governing_start_byte: governingStartByte,
      governing_end_byte: governingEndByte,
      whitespace_punctuation_policy_id: 'EXACT_UTF8_PARTITION/V1',
      spans: segments.map((segment) => segment.span),
    },
  );
  return {
    nodeId: ITEM39_PARENT_NODE_ID,
    sourceText: nodeText,
    nodeText,
    sourceBytes,
    segments,
    effectSegments: [segments],
    agreementIndex,
    agreementIndexBinding: selected.binding,
    sourceClosure,
    dependencies: [],
    contextEdges: [contextEdge],
    governingStartByte,
    governingEndByte,
  };
}

function buildItem39SemanticCore({
  agreementId, occurrenceId, priorFamilyKey, draft, source, profiles, structure,
}) {
  const allSourceSpanIds = source.segments.map((segment) => segment.span.span_id);
  const actorSegment = source.segments.find(
    (segment) => segment.kind === 'FACT' && segment.field_key === 'APPLIES_TO',
  );
  const actorSpec = factSpec(
    'APPLIES_TO', 'PARTY', 'Parent', 'PARENT', 'BOUND_PARTY_ALIAS/V1',
    ['edge-item39-local-parent'],
  );
  const actorFact = buildFact(agreementId, actorSpec, [actorSegment.span]);
  const selectedTree = structure.item39.member.inline_list_overlay.candidate_trees.find(
    (tree) => tree.candidate_tree_id
      === structure.item39.member.inline_list_overlay.selected_candidate_tree_id,
  );
  assert.ok(selectedTree);
  assert.deepEqual(selectedTree.nodes.map((node) => node.depth), [1, 1, 2, 2, 3, 3]);
  assert.equal(draft.expression_nodes.length, 7);
  const limbSegments = source.segments.filter(
    (segment) => segment.kind === 'LIMB_MARKER',
  ).sort((left, right) => left.start_byte - right.start_byte);
  const markerSpanIdsByExpressionKey = new Map();
  selectedTree.nodes.forEach((node, index) => {
    const segment = limbSegments.find((candidate) =>
      candidate.start_byte === node.marker_span.start_byte
        && candidate.end_byte === node.marker_span.end_byte);
    assert.ok(segment);
    markerSpanIdsByExpressionKey.set(
      draft.expression_nodes[index + 1].expression_key, [segment.span.span_id],
    );
  });
  const connectiveSpanIdsByExpressionKey = new Map(draft.expression_nodes.map(
    (node) => [node.expression_key, []],
  ));
  for (const segment of source.segments.filter((entry) => entry.kind === 'EXPRESSION')) {
    connectiveSpanIdsByExpressionKey.get(segment.expression_key).push(segment.span.span_id);
  }
  for (const spanIds of connectiveSpanIdsByExpressionKey.values()) {
    assert.equal(spanIds.length > 0, true);
  }
  const expressionBuild = buildExpressions(
    draft,
    new Map([['APPLIES_TO', actorFact]]),
    allSourceSpanIds,
    new Map(),
    markerSpanIdsByExpressionKey,
    connectiveSpanIdsByExpressionKey,
  );
  const profile = profiles.profileByEffect.get(draft);
  assert.ok(profile);
  const effectId = contentId('STAGE_2Y_M7_V2_INSPECTED_EFFECT/V1', {
    input_occurrence_id: occurrenceId,
    source_span_ids: allSourceSpanIds,
    fact_ids: [actorFact.fact_id],
    expression_root_id: expressionBuild.rootExpressionId,
  });
  const ruleId = contentId('AGREEMENT_LEGAL_RULE/V2', {
    agreement_id: agreementId,
    input_occurrence_id: occurrenceId,
    effect_id: effectId,
    family_key: draft.family_key,
    profile_id: profile.profile_id,
    subtype_path: profile.subtype_path,
    semantic_fact_keys: [actorFact.semantic_fact_key],
    canonical_expression_signature: draft.expression_signature,
    child_rule_ids: [],
    source_closure_id: source.sourceClosure.source_closure_id,
  });
  actorFact.owner_rule_id = ruleId;
  const profileClaim = claimedProfileResults(profiles.profiles, source.nodeText);
  const effect = {
    effect_id: effectId,
    input_occurrence_id: occurrenceId,
    source_span_ids: allSourceSpanIds,
    fact_ids: [actorFact.fact_id],
    expression_root_id: expressionBuild.rootExpressionId,
    profile_results: profileClaim.results,
    selected_profile_id: profileClaim.selectedProfileId,
    selected_profile_key: profileClaim.selectedProfileKey,
    no_more_specific_descendant_match: profileClaim.selectedProfileId !== null,
    generic_level_output_authority: null,
  };
  const rule = {
    schema_version: 'AGREEMENT_LEGAL_RULE/V2',
    rule_id: ruleId,
    input_occurrence_id: occurrenceId,
    authored_unit_id: source.nodeId,
    effect_id: effectId,
    family_key: draft.family_key,
    profile_id: profile.profile_id,
    subtype_path: profile.subtype_path,
    applies_to_fact_ids: [actorFact.fact_id],
    fact_ids: [actorFact.fact_id],
    consumer_link_ids: [],
    root_expression_id: expressionBuild.rootExpressionId,
    child_rule_ids: [],
    source_closure_id: source.sourceClosure.source_closure_id,
    expression_signature: draft.expression_signature,
    equivalence_signature: derivedEquivalenceSignature(
      profile, draft.expression_signature, [actorFact],
    ),
    validation: {
      extraction_state: 'INCOMPLETE',
      source_quality: 'SUFFICIENT',
      output_disposition: 'REVIEW_ONLY',
      issue_codes: ['MISSING_OPERATIVE_CHAPEAU'],
      no_comparison_authority: null,
    },
  };
  const candidateSet = sealInlineRecord(
    'STAGE_2Y_M7_V2_INSPECTED_CANDIDATE_SET/V1', 'candidate_set_id', {
      authored_unit_id: source.nodeId,
      source_closure_id: source.sourceClosure.source_closure_id,
      considered_family_keys: FAMILY_KEYS,
      effects: [effect],
    },
  );
  const sourceOrdinal = new Map(allSourceSpanIds.map((spanId, index) => [spanId, index]));
  const treatments = [{
    treatment_kind: 'RULE',
    target_id: ruleId,
    source_span_ids: [actorSegment.span.span_id],
    authority_id: null,
  }, ...expressionBuild.records.map((expression) => ({
    treatment_kind: 'EXPRESSION',
    target_id: expression.expression_id,
    source_span_ids: [
      ...expression.connective_span_ids,
      ...expression.authored_limb_marker_span_ids,
    ].sort((left, right) => sourceOrdinal.get(left) - sourceOrdinal.get(right)),
    authority_id: null,
  }))];
  const operativeMarkerSpanIds = source.segments.filter(
    (segment) => segment.operative_marker_kind !== undefined,
  ).map((segment) => segment.span.span_id);
  const effectLedger = sealInlineRecord(
    'STAGE_2Y_M7_V2_AUTHORED_UNIT_EFFECT_LEDGER/V1', 'effect_ledger_id', {
      authored_unit_id: source.nodeId,
      source_closure_id: source.sourceClosure.source_closure_id,
      entries: [{
        effect_id: effectId,
        input_occurrence_id: occurrenceId,
        effect_kind: 'COMBINED_MODAL_LIMB',
        rule_ids: [ruleId],
        source_span_ids: allSourceSpanIds,
        operative_marker_span_ids: operativeMarkerSpanIds,
        treatments,
      }],
    },
  );
  const expressionByConnectiveSpanId = new Map(expressionBuild.records.flatMap(
    (expression) => expression.connective_span_ids.map(
      (spanId) => [spanId, expression],
    ),
  ));
  const expressionByLimbSpanId = new Map(expressionBuild.records.flatMap(
    (expression) => expression.authored_limb_marker_span_ids.map(
      (spanId) => [spanId, expression],
    ),
  ));
  const overlayMember = structure.item39.member;
  const coverageEntries = source.segments.map((segment) => {
    if (segment === actorSegment) {
      return {
        span_id: segment.span.span_id,
        treatment_kind: 'FACT',
        owner_id: actorFact.fact_id,
        reason_code: null,
        authority_id: null,
        materiality: segment.span.materiality,
      };
    }
    if (segment.kind === 'LIMB_MARKER') {
      return {
        span_id: segment.span.span_id,
        treatment_kind: 'AUTHORED_LIMB_MARKER',
        owner_id: expressionByLimbSpanId.get(segment.span.span_id).expression_id,
        reason_code: overlayMember.reason_code,
        authority_id: overlayMember.structure_disposition_id,
        materiality: segment.span.materiality,
      };
    }
    return {
      span_id: segment.span.span_id,
      treatment_kind: 'LOGIC_CONNECTIVE',
      owner_id: expressionByConnectiveSpanId.get(segment.span.span_id).expression_id,
      reason_code: null,
      authority_id: null,
      materiality: segment.span.materiality,
    };
  });
  const allFamilyProfileResults = FAMILY_KEYS.map((familyKey) => ({
    family_key: familyKey,
    matched_profile_ids: familyKey === draft.family_key
      ? [profile.profile_id] : [],
  }));
  const issueSpanIds = source.segments.filter(
    (segment) => segment.operative_marker_kind === 'MODAL',
  ).slice(0, 1).map((segment) => segment.span.span_id);
  const disposition = sealInlineRecord(
    'STAGE_2Y_M7_V2_DISPOSITION/V1', 'disposition_id', {
      input_occurrence_id: occurrenceId,
      prior_family_key: priorFamilyKey,
      authored_unit_id: source.nodeId,
      source_closure_id: source.sourceClosure.source_closure_id,
      source_closure_digest: sha256Hex(canonicalJson(source.sourceClosure)),
      candidate_set_id: candidateSet.candidate_set_id,
      candidate_set_digest: sha256Hex(canonicalJson(candidateSet)),
      rule_ids: [ruleId],
      all_family_profile_results: allFamilyProfileResults,
      compatible_cross_family_match_count: 0,
      extraction_state: 'INCOMPLETE',
      source_quality: 'SUFFICIENT',
      output_disposition: 'REVIEW_ONLY',
      profile_match_state: 'EXACT_ONE_MOST_SPECIFIC',
      absence_proofs: [],
      issues: [{
        effect_id: effectId,
        rule_id: ruleId,
        issue_code: 'MISSING_OPERATIVE_CHAPEAU',
        extraction_state: 'INCOMPLETE',
        source_quality: 'SUFFICIENT',
        source_span_ids: issueSpanIds,
      }],
      no_comparison_authorities: [],
      no_output_authority: null,
    },
  );
  return {
    facts: [actorFact],
    expressions: expressionBuild.records,
    rules: [rule],
    candidateSet,
    effectLedger,
    coveragePartition: {
      source_closure_id: source.sourceClosure.source_closure_id,
      entries: coverageEntries,
    },
    disposition,
    familyCorrections: [],
  };
}

function buildItem39ConsumptionScenario() {
  const definition = {
    case_id: cases.structure_overlay_case.case_id,
    effects: [{
      family_key: 'TERMINATION',
      expression_signature:
        'ALL_OF(APPLIES_TO,NOT(APPLIES_TO),ALL_OF(NOT(APPLIES_TO),ALL_OF(NOT(APPLIES_TO),NOT(APPLIES_TO))))',
      temporal_fields: [],
      output_disposition: 'REVIEW_ONLY',
      issue_code: 'MISSING_OPERATIVE_CHAPEAU',
    }],
  };
  const store = new Map();
  const occurrenceId = 'fixture-item39-governed-occurrence';
  const priorFamilyKey = 'TERMINATION';
  const agreementIndex = addEvidenceFile(store, ITEM39_INDEX_PATH).record;
  const agreementId = agreementIndex.source_binding.agreement_id;
  const drafts = makeEffectDrafts(definition, {});
  const draft = drafts[0];
  draft.fact_specs = [
    factSpec('LEGAL_EFFECT', 'ENUM', 'shall', 'SHALL', 'ENUM_LITERAL_MAP/V1'),
    factSpec('APPLIES_TO', 'PARTY', 'Parent', 'PARENT', 'BOUND_PARTY_ALIAS/V1',
      ['edge-item39-local-parent']),
  ];
  const source = buildItem39Source(store, draft);
  const profileOptions = {
    profileMatchTokensByFamily: { TERMINATION: ['would', 'give', 'rise'] },
    allowedSourceTypeByFamily: { TERMINATION: 'PARAGRAPH' },
  };
  const profiles = buildProfileInfrastructure({
    store, definition, effectDrafts: drafts, occurrenceId, options: profileOptions,
  });
  const structure = buildStructureSet({
    store, source, occurrenceId, scenarioKey: definition.case_id, options: {},
  });
  const requiredClassificationLevels = requiredClassificationLevelsForDrafts(
    definition, drafts, profiles,
  );
  const viewPolicy = buildViewPolicy(
    store, profiles.snapshots, profileOptions, requiredClassificationLevels,
  );
  const semanticInputs = buildSemanticInputBindings({
    store, agreementId, occurrenceId, source, profiles, structure,
  });
  const candidate = buildCandidateGovernance({
    store, semanticInputs, profiles, structure, viewPolicy, options: {},
  });
  const semantic = buildItem39SemanticCore({
    agreementId,
    occurrenceId,
    priorFamilyKey,
    draft,
    source,
    profiles,
    structure,
  });
  const analysis = sealInlineRecord('AGREEMENT_ANALYSIS/V2', 'agreement_analysis_id', {
    agreement_id: agreementId,
    governed_input_occurrence_ids: [occurrenceId],
    governance: candidate.governance,
    profile_snapshots: profiles.snapshots,
    candidate_sets: [semantic.candidateSet],
    source_closures: [source.sourceClosure],
    dependencies: [],
    facts: semantic.facts,
    expressions: semantic.expressions,
    rules: semantic.rules,
    authored_unit_effect_ledgers: [semantic.effectLedger],
    shared_fact_coverages: [],
    coverage_partitions: [semantic.coveragePartition],
    ownership_links: [],
    family_corrections: [],
    dispositions: [semantic.disposition],
    counts: {
      governed_input_occurrences: 1,
      rules: 1,
      facts: 1,
      expressions: 7,
      shared_fact_coverages: 0,
      source_closures: 1,
      dispositions: 1,
    },
  });
  return {
    definition,
    options: profileOptions,
    store,
    resolveBinding: makeResolver(store),
    analysis,
    source,
    profiles,
    structure,
    viewPolicy,
    semanticInputs,
    candidate,
    semantic,
  };
}

function classificationForRule(rule, facts, profile) {
  const parties = rule.applies_to_fact_ids.flatMap((factId) =>
    facts.get(factId).value_type === 'PARTY'
      ? [facts.get(factId).typed_value]
      : facts.get(factId).typed_value.parties);
  const levels = classificationLevelNames(profile);
  return [
    { level: levels[0], value: parties.join('; ') },
    ...profile.classification_path.map((value, index) => ({
      level: levels[index + 1],
      value,
    })),
  ];
}

function buildProjection(scenario, analysisValidation) {
  const { analysis } = scenario;
  const facts = new Map(analysis.facts.map((fact) => [fact.fact_id, fact]));
  const profiles = new Map(
    analysis.profile_snapshots.map((profile) => [profile.profile_id, profile]),
  );
  const dispositions = new Map(
    analysis.dispositions.map((disposition) => [disposition.input_occurrence_id, disposition]),
  );
  const rows = analysis.rules.filter((rule) =>
    ['NORMAL', 'APPROVED_LIMITED'].includes(rule.validation.output_disposition)).map((rule) => {
    const profile = profiles.get(rule.profile_id);
    const classificationLevels = classificationForRule(rule, facts, profile);
    const orderedFacts = rule.fact_ids.map((factId) => facts.get(factId)).sort(
      (left, right) => profile.display_order.indexOf(left.field_key)
        - profile.display_order.indexOf(right.field_key),
    );
    const omittedFacts = orderedFacts.filter((fact) => fact.display_rule === 'NEVER_DISPLAY'
      || (scenario.options.omitDisplayOptional === true
        && fact.display_rule === 'DISPLAY_OPTIONAL'));
    const omittedFactIds = new Set(omittedFacts.map((fact) => fact.fact_id));
    const renderedFacts = orderedFacts.filter((fact) => !omittedFactIds.has(fact.fact_id));
    const layouts = scenario.viewPolicy.record.layouts.map((layout) => ({
      layout_id: layout.layout_id,
      classification_levels: classificationLevels,
      render_bindings: renderedFacts.map((fact) => ({
        fact_id: fact.fact_id,
        field_key: fact.field_key,
        ownership_link_id: analysis.ownership_links.find(
          (link) => link.consumer_rule_id === rule.rule_id
            && link.owner_fact_id === fact.fact_id,
        )?.link_id ?? null,
        label_id: fact.label_id,
        typed_value_digest: sha256Hex(canonicalJson(fact.typed_value)),
        rendered_value: renderTypedValue(fact),
        rendered_value_digest: sha256Hex(renderTypedValue(fact)),
        layout_id: layout.layout_id,
      })),
      omission_ledger: omittedFacts.map((fact) => ({
        fact_id: fact.fact_id,
        omission_rule_id: 'DISPLAY_OPTIONAL_NON_MATERIAL/V1',
      })),
    }));
    const disposition = dispositions.get(rule.input_occurrence_id);
    const proofs = disposition.absence_proofs.filter((proof) => proof.rule_id === rule.rule_id);
    const sourceLimitation = rule.validation.output_disposition === 'APPROVED_LIMITED' ? {
      text: 'Not expressly stated in the complete reviewed clause',
      source_closure_id: disposition.source_closure_id,
      authored_unit_id: disposition.authored_unit_id,
      field_keys: [...new Set(proofs.map((proof) => proof.field_key))].sort(),
      lawyer_ruling_ids: [...new Set(proofs.map((proof) => proof.lawyer_ruling_id))].sort(),
    } : null;
    const unsigned = {
      rule_id: rule.rule_id,
      disposition_id: disposition.disposition_id,
      output_disposition: rule.validation.output_disposition,
      classification_levels: classificationLevels,
      equivalence_signature: clone(rule.equivalence_signature),
      source_limitation: sourceLimitation,
      group_id: null,
      layouts,
    };
    return { row_id: contentId('AGREEMENT_PROJECTION_ROW/V2', unsigned), ...unsigned };
  });
  const reviewRows = analysis.dispositions.filter(
    (disposition) => disposition.output_disposition === 'REVIEW_ONLY',
  ).map((disposition) => ({
    disposition_id: disposition.disposition_id,
    input_occurrence_id: disposition.input_occurrence_id,
    rule_ids: disposition.rule_ids,
    issues: disposition.issues,
  }));
  const nonOutputDispositions = [
    ...analysis.rules.filter(
      (rule) => rule.validation.output_disposition === 'NO_COMPARISON',
    ).map((rule) => ({
      disposition_id: dispositions.get(rule.input_occurrence_id).disposition_id,
      input_occurrence_id: rule.input_occurrence_id,
      rule_id: rule.rule_id,
      output_disposition: 'NO_COMPARISON',
    })),
    ...analysis.dispositions.filter(
      (disposition) => disposition.output_disposition === 'NO_OUTPUT',
    ).map((disposition) => ({
      disposition_id: disposition.disposition_id,
      input_occurrence_id: disposition.input_occurrence_id,
      rule_id: null,
      output_disposition: 'NO_OUTPUT',
    })),
  ];
  return sealInlineRecord('AGREEMENT_PROJECTION/V2', 'agreement_projection_id', {
    agreement_id: analysis.agreement_id,
    agreement_analysis_id: analysis.agreement_analysis_id,
    analysis_validation: analysisValidation,
    view_policy_id: scenario.viewPolicy.record.view_policy_id,
    view_policy_binding: scenario.viewPolicy.binding,
    rows,
    review_rows: reviewRows,
    non_output_dispositions: nonOutputDispositions,
    disposition_ledger: clone(analysis.dispositions),
    counts: {
      normal_rows: rows.length,
      review_rows: reviewRows.length,
      non_output_dispositions: nonOutputDispositions.length,
      disposition_records: analysis.dispositions.length,
    },
  });
}

function restampAnalysis(analysis) {
  const unsigned = { ...analysis };
  delete unsigned.schema_version;
  delete unsigned.agreement_analysis_id;
  analysis.agreement_analysis_id = contentId('AGREEMENT_ANALYSIS/V2', unsigned);
  return analysis;
}

function restampProjection(projection) {
  const unsigned = { ...projection };
  delete unsigned.schema_version;
  delete unsigned.agreement_projection_id;
  projection.agreement_projection_id = contentId('AGREEMENT_PROJECTION/V2', unsigned);
  return projection;
}

function restampInline(record, schema, idField) {
  const unsigned = { ...record };
  delete unsigned.schema_version;
  delete unsigned[idField];
  record[idField] = contentId(schema, unsigned);
  return record;
}

function restampBound(record, schema, idField) {
  const unsigned = { ...record };
  delete unsigned[idField];
  record[idField] = contentId(schema, unsigned);
  return record;
}

function projectionRow(projection, index = 0) {
  assert.ok(projection.rows[index], `projection fixture has no row ${index}`);
  return projection.rows[index];
}

function projectionLayout(projection, layoutId) {
  const layout = projectionRow(projection).layouts.find(
    (candidate) => candidate.layout_id === layoutId,
  );
  assert.ok(layout, `projection fixture has no ${layoutId} layout`);
  return layout;
}

function moveFirstRenderedFactToOmission(projection) {
  const layout = projectionLayout(projection, 'compact-v2');
  const [binding] = layout.render_bindings.splice(0, 1);
  assert.ok(binding, 'projection fixture has no rendered fact to omit');
  layout.omission_ledger.push({
    fact_id: binding.fact_id,
    omission_rule_id: 'DISPLAY_OPTIONAL_NON_MATERIAL/V1',
  });
}

function projectionMutationForCase(projection, caseId) {
  if (caseId === 'projection-silent-row-omission') {
    assert.ok(projection.rows.length > 0, 'projection fixture has no row to omit');
    projection.rows.splice(0, 1);
  } else if (caseId === 'projection-source-limitation-drift') {
    projectionRow(projection).source_limitation = {
      text: 'Invented source limitation',
      source_closure_id: 'invented-source-closure',
      authored_unit_id: 'invented-authored-unit',
      field_keys: ['INVENTED_FIELD'],
      lawyer_ruling_ids: ['invented-ruling'],
    };
  } else if (caseId === 'projection-disposition-ledger-drift') {
    assert.ok(projection.disposition_ledger.length > 0,
      'projection fixture has no disposition to omit');
    projection.disposition_ledger.splice(0, 1);
  } else if (caseId === 'analysis-projection-lacks-full-validation-result') {
    projection.analysis_validation = null;
  } else if (caseId === 'projection-display-required-fact-is-omitted'
      || caseId === 'projection-material-fact-is-omitted') {
    moveFirstRenderedFactToOmission(projection);
  } else if (caseId === 'projection-never-display-fact-is-rendered') {
    const layout = projectionLayout(projection, 'compact-v2');
    const [omission] = layout.omission_ledger.splice(0, 1);
    assert.ok(omission, 'NEVER_DISPLAY fixture has no omitted fact');
    const template = layout.render_bindings[0];
    assert.ok(template, 'NEVER_DISPLAY fixture has no render-binding template');
    layout.render_bindings.push({ ...template, fact_id: omission.fact_id });
  } else if (caseId === 'projection-render-value-is-truncated') {
    const binding = projectionLayout(projection, 'compact-v2').render_bindings[0];
    assert.ok(binding, 'projection fixture has no rendered value to truncate');
    binding.rendered_value += ' truncated';
  } else if (caseId === 'projection-render-label-is-swapped') {
    const bindings = projectionLayout(projection, 'compact-v2').render_bindings;
    assert.ok(bindings.length > 1, 'projection fixture needs two labels to swap');
    bindings[0].label_id = bindings[1].label_id;
  } else if (caseId === 'projection-compact-classification-floor-is-missing') {
    const layout = projectionLayout(projection, 'compact-v2');
    assert.ok(layout.classification_levels.length > 1,
      'compact fixture has no classification level to omit');
    layout.classification_levels.splice(-1, 1);
  } else if (caseId === 'projection-layout-ledgers-do-not-reconcile-independently') {
    const layout = projectionLayout(projection, 'expanded-v2');
    assert.ok(layout.render_bindings.length > 0,
      'expanded fixture has no rendered fact to lose');
    layout.render_bindings.splice(0, 1);
  } else if (caseId === 'v1-row-enters-v2-projection') {
    projectionRow(projection).schema_version = 'AGREEMENT_PROJECTION_ROW/V1';
  } else if (caseId === 'equivalence-signature-is-forged') {
    projectionRow(projection).equivalence_signature.actor = [];
  } else if (caseId === 'unequal-equivalence-signatures-share-group') {
    const first = projectionRow(projection, 0);
    const second = projectionRow(projection, 1);
    assert.notDeepEqual(first.equivalence_signature, second.equivalence_signature,
      'grouping fixture signatures must differ');
    first.group_id = 'fixture-unequal-signature-group';
    second.group_id = 'fixture-unequal-signature-group';
  } else if (caseId === 'projection-borrows-valid-analysis-result-from-different-object'
      || caseId === 'projection-reads-raw-source') {
    throw new Error(`${caseId} requires its dedicated public-seam invocation`);
  } else {
    throw new Error(`no projection mutation is registered for ${caseId}`);
  }
  for (const row of projection.rows) {
    const unsignedRow = { ...row };
    delete unsignedRow.row_id;
    row.row_id = contentId('AGREEMENT_PROJECTION_ROW/V2', unsignedRow);
  }
  return restampProjection(projection);
}

function mutateContextCompilationInput(scenario, mutate) {
  const analysis = clone(scenario.analysis);
  const store = new Map([...scenario.store].map(
    ([path, bytes]) => [path, Buffer.from(bytes)],
  ));
  const governanceInput = analysis.governance.semantic_input_bindings.find(
    (entry) => entry.role === 'CONTEXT_COMPILATION_SET',
  );
  assert.ok(governanceInput);
  const contextPath = governanceInput.binding.path;
  const contextRecord = JSON.parse(store.get(contextPath).toString('utf8'));
  mutate(contextRecord);
  restampBound(contextRecord, 'CONTEXT_COMPILATION_SET/V1', 'context_compilation_set_id');
  const contextBinding = addRecord(
    store, contextPath, contextRecord, 'context_compilation_set_id',
  );
  governanceInput.binding = contextBinding;

  const oldCandidateBinding = analysis.governance.candidate_registration_binding;
  const candidate = JSON.parse(store.get(oldCandidateBinding.path).toString('utf8'));
  const candidateInput = candidate.semantic_input_bindings.find(
    (entry) => entry.input_role === 'CONTEXT_COMPILATION_SET',
  );
  assert.ok(candidateInput);
  candidateInput.binding = contextBinding;
  restampBound(
    candidate, 'STAGE_2Y_M7_V2_CANDIDATE_REGISTRATION/V1', 'candidate_registration_id',
  );
  const candidatePath = `${MIGRATION_ROOT}/control/m7-v2-repair-candidate-registrations/${candidate.candidate_registration_id}.json`;
  const candidateBinding = addRecord(
    store, candidatePath, candidate, 'candidate_registration_id',
  );
  const verification = analysis.governance.candidate_registration_verification;
  verification.candidate_registration_id = candidate.candidate_registration_id;
  verification.registration_binding = candidateBinding;
  restampBound(
    verification,
    'STAGE_2Y_M7_V2_CANDIDATE_REGISTRATION_VERIFICATION/V1',
    'verification_id',
  );
  analysis.governance.candidate_registration_id = candidate.candidate_registration_id;
  analysis.governance.candidate_registration_binding = candidateBinding;
  return Object.freeze({
    analysis: restampAnalysis(analysis),
    resolveBinding: makeResolver(store),
  });
}

function factOrSourceScenarioForCase(caseId) {
  if (caseId === 'native-source-artefact-scope-mismatch') {
    return buildScenario(
      cases.state_cases.find((entry) => entry.case_id === 'item-15-native-source-artefact'),
    );
  }
  if (caseId === 'reference-source-contains-two-reference-tokens') {
    return buildScenario(cases.baseline_case, { secondReferenceFact: true });
  }
  if (caseId === 'atomic-fact-absorbs-material-proviso'
      || caseId === 'material-proviso-left-unmodelled') {
    return buildScenario(cases.baseline_case, { materialProviso: true });
  }
  return baselineForNegatives;
}

function factOrSourceMutationForCase(selectedScenario, caseId) {
  const analysis = clone(selectedScenario.analysis);
  const fact = (fieldKey) => {
    const selected = analysis.facts.find((entry) => entry.field_key === fieldKey);
    assert.ok(selected, `mutation ${caseId} requires fact ${fieldKey}`);
    return selected;
  };
  const spanIdsForField = (fieldKey) => selectedScenario.source.segments
    .filter((segment) => segment.field_key === fieldKey)
    .map((segment) => segment.span.span_id);
  const spanIdsBetweenFields = (firstFieldKey, lastFieldKey) => {
    const segments = selectedScenario.source.segments;
    const first = segments.findIndex((segment) => segment.field_key === firstFieldKey);
    const last = segments.findLastIndex((segment) => segment.field_key === lastFieldKey);
    assert.ok(first >= 0 && last >= first,
      `mutation ${caseId} requires ordered ${firstFieldKey}/${lastFieldKey} spans`);
    return segments.slice(first, last + 1).map((segment) => segment.span.span_id);
  };
  const bindFactToSpans = (selected, spanIds) => {
    selected.source_support_ids = spanIds;
    selected.normalisation_proof.input_source_span_ids = spanIds;
  };
  const result = () => Object.freeze({
    analysis: restampAnalysis(analysis),
    resolveBinding: selectedScenario.resolveBinding,
  });

  if (caseId === 'whole-clause-hidden-in-enum') {
    const selected = fact('FAMILY_MARKER');
    const oldFactId = selected.fact_id;
    const closure = analysis.source_closures[0];
    const orderedSpans = [...closure.spans].sort(
      (left, right) => left.start_byte - right.start_byte,
    );
    const wholeClauseBytes = Buffer.from(selectedScenario.source.sourceText, 'utf8').subarray(
      closure.governing_start_byte, closure.governing_end_byte,
    );
    const wholeClauseSpanIds = orderedSpans.map((span) => span.span_id);
    const positiveModelledSpanIds = new Set([
      ...analysis.facts.flatMap((entry) => entry.source_support_ids),
      ...analysis.expressions.flatMap((entry) => [
        ...entry.connective_span_ids,
        ...entry.authored_limb_marker_span_ids,
      ]),
    ]);
    assert.equal(analysis.facts.length > 1, true);
    assert.equal(analysis.expressions.length > 0, true);
    assert.equal(wholeClauseSpanIds.every((spanId) => positiveModelledSpanIds.has(spanId)), true,
      'whole-clause positive must model every proposition span as an atomic fact or expression');
    assert.equal(selected.source_support_ids.length < wholeClauseSpanIds.length, true,
      'whole-clause mutation must expand one atomic ENUM fact over the proposition');
    selected.typed_value = wholeClauseBytes.toString('utf8');
    selected.source_support_ids = wholeClauseSpanIds;
    selected.normalisation_proof.input_source_span_ids = wholeClauseSpanIds;
    selected.normalisation_proof.input_context_edge_ids = [];
    selected.normalisation_proof.result_digest = sha256Hex(canonicalJson(selected.typed_value));
    selected.semantic_fact_key = contentId('AGREEMENT_SEMANTIC_FACT/V2', {
      agreement_id: analysis.agreement_id,
      field_key: selected.field_key,
      normalised_typed_value: selected.typed_value,
      legal_subject: selected.legal_subject,
      temporal_scope_signature: selected.temporal_scope_signature,
      source_support_ids: selected.source_support_ids,
      legal_effect_role: selected.legal_effect_role,
    });
    selected.fact_id = contentId('AGREEMENT_SEMANTIC_FACT/V2', {
      agreement_id: analysis.agreement_id,
      semantic_fact_key: selected.semantic_fact_key,
    });
    assert.equal(selected.value_type, 'ENUM');
    assert.equal(selected.typed_value, wholeClauseBytes.toString('utf8'));
    assert.equal(wholeClauseSpanIds.length, closure.spans.length);
    assert.equal(analysis.expressions.some((expression) => expression.children.some(
      (child) => child.kind === 'FACT' && child.id === oldFactId,
    )), false, 'whole-clause fixture keeps the collapsed display fact outside the expression');
    for (const coverage of analysis.coverage_partitions[0].entries) {
      if (coverage.owner_id === oldFactId) coverage.owner_id = selected.fact_id;
    }
    const effect = analysis.candidate_sets[0].effects.find(
      (entry) => entry.fact_ids.includes(oldFactId),
    );
    assert.ok(effect, 'whole-clause fixture requires the positive effect');
    const oldEffectId = effect.effect_id;
    effect.fact_ids = effect.fact_ids.map(
      (factId) => factId === oldFactId ? selected.fact_id : factId,
    );
    restampEffect(effect);
    relinkMutatedEffect(analysis, effect, oldEffectId);
    const rule = analysis.rules.find((entry) => entry.effect_id === effect.effect_id);
    const profile = analysis.profile_snapshots.find(
      (entry) => entry.profile_id === rule.profile_id,
    );
    rule.equivalence_signature = derivedEquivalenceSignature(
      profile,
      rule.expression_signature,
      rule.fact_ids.map((factId) => analysis.facts.find((entry) => entry.fact_id === factId)),
    );
    return result();
  }
  if (caseId === 'normalisation-rule-value-type-mismatch') {
    fact('BOOLEAN_VALUE').normalisation_proof.rule_id = 'NUMBER_PARSER/V1';
    return result();
  }
  if (caseId === 'normalisation-leaves-non-whitespace-bound-byte-unconsumed') {
    const spans = analysis.source_closures[0].spans;
    assert.ok(spans.length >= 3, 'non-contiguous atomic mutation requires three spans');
    bindFactToSpans(fact('LEGAL_EFFECT'), [spans[0].span_id, spans[2].span_id]);
    return result();
  }
  if (caseId === 'party-value-has-two-alias-tokens') {
    const selected = fact('APPLIES_TO');
    selected.value_type = 'PARTY';
    selected.typed_value = 'COMPANY';
    selected.normalisation_proof.result_digest = sha256Hex(canonicalJson(selected.typed_value));
    return result();
  }
  if (caseId === 'party-set-has-one-alias-token') {
    const selected = fact('PARTY_VALUE');
    selected.value_type = 'PARTY_SET';
    selected.typed_value = { parties: ['COMPANY'] };
    selected.normalisation_proof.result_digest = sha256Hex(canonicalJson(selected.typed_value));
    return result();
  }
  if (caseId === 'party-set-uses-unapproved-separator') {
    const selected = fact('PARTY_VALUE');
    selected.value_type = 'PARTY_SET';
    selected.typed_value = { parties: ['COMPANY', 'MATERIAL_ADVERSE_EFFECT'] };
    bindFactToSpans(selected, spanIdsBetweenFields('PARTY_VALUE', 'DEFINED_TERM_VALUE'));
    selected.normalisation_proof.result_digest = sha256Hex(canonicalJson(selected.typed_value));
    return result();
  }
  if (caseId === 'party-alias-edge-support-does-not-equal-token') {
    fact('APPLIES_TO').normalisation_proof.input_context_edge_ids = [
      'edge-party-value-company-0',
    ];
    return result();
  }
  if (caseId === 'party-alias-target-is-duplicated') {
    return mutateContextCompilationInput(selectedScenario, (record) => {
      const member = record.members.find(
        (entry) => entry.agreement_id === selectedScenario.analysis.agreement_id,
      );
      const company = member.edges.find(
        (edge) => edge.edge_id === 'edge-applies-to-company-0',
      );
      const parent = member.edges.find(
        (edge) => edge.edge_id === 'edge-applies-to-parent-0',
      );
      assert.ok(company && parent);
      parent.target_id = company.target_id;
    });
  }
  if (caseId === 'reference-source-contains-two-reference-tokens') {
    const selected = fact('REFERENCE_VALUE');
    bindFactToSpans(
      selected, spanIdsBetweenFields('REFERENCE_VALUE', 'REFERENCE_VALUE_TWO'),
    );
    return result();
  }
  if (caseId === 'reference-edge-has-wrong-edge-type') {
    return mutateContextCompilationInput(selectedScenario, (record) => {
      const member = record.members.find(
        (entry) => entry.agreement_id === selectedScenario.analysis.agreement_id,
      );
      const edge = member.edges.find(
        (entry) => entry.edge_id === 'edge-reference-value-0',
      );
      assert.ok(edge);
      edge.edge_type = 'PARTY_ALIAS';
    });
  }
  if (caseId === 'reference-edge-support-differs-from-fact-support') {
    const selected = fact('REFERENCE_VALUE');
    const spanIds = [...spanIdsForField('REFERENCE_VALUE')];
    const lastIndex = selectedScenario.source.segments.findLastIndex(
      (segment) => segment.field_key === 'REFERENCE_VALUE',
    );
    assert.ok(selectedScenario.source.segments[lastIndex + 1],
      'reference support mutation requires a following span');
    spanIds.push(selectedScenario.source.segments[lastIndex + 1].span.span_id);
    bindFactToSpans(selected, spanIds);
    return result();
  }
  if (caseId === 'atomic-fact-absorbs-two-source-values') {
    bindFactToSpans(
      fact('NUMBER_VALUE'), spanIdsBetweenFields('NUMBER_VALUE', 'PERCENTAGE_VALUE'),
    );
    return result();
  }
  if (caseId === 'atomic-fact-absorbs-operative-connective') {
    const selected = fact('FAMILY_MARKER');
    bindFactToSpans(selected, spanIdsForField('APPLIES_TO'));
    selected.typed_value = 'COMPANY_AND_PARENT';
    selected.normalisation_proof.result_digest = sha256Hex(canonicalJson(selected.typed_value));
    return result();
  }
  if (caseId === 'atomic-fact-absorbs-material-proviso') {
    const selected = fact('PROVISO_VALUE');
    const sourceSegments = selectedScenario.source.segments;
    const factSpanIds = sourceSegments.filter(
      (segment) => segment.field_key === 'PROVISO_VALUE',
    ).map((segment) => segment.span.span_id);
    const proviso = sourceSegments.find((segment) => segment.material_proviso === true);
    assert.ok(proviso);
    bindFactToSpans(selected, [...factSpanIds, proviso.span.span_id]);
    selected.typed_value = 'condition provided that exception';
    selected.normalisation_proof.result_digest = sha256Hex(canonicalJson(selected.typed_value));
    return result();
  }
  if (caseId === 'source-span-byte-drift') {
    const closure = analysis.source_closures[0];
    const selected = closure.spans[0];
    selected.text_sha256 = 'f'.repeat(64);
    selected.span_id = contentId('AGREEMENT_SOURCE_SPAN/V2', {
      agreement_index_id: selectedScenario.source.agreementIndex.agreement_index_id,
      source_node_occurrence_id: selected.source_node_occurrence_id,
      start_byte: selected.start_byte,
      end_byte: selected.end_byte,
      text_sha256: selected.text_sha256,
    });
    restampInline(
      closure, 'STAGE_2Y_M7_V2_REVIEWED_SOURCE_CLOSURE/V1', 'source_closure_id',
    );
    return result();
  }
  if (caseId === 'native-source-artefact-scope-mismatch') {
    const closure = analysis.source_closures[0];
    const artefactSegment = selectedScenario.source.segments.find(
      (segment) => segment.kind === 'SOURCE_ARTEFACT',
    );
    assert.ok(artefactSegment, 'native artefact mutation requires an artefact span');
    const selected = closure.spans.find(
      (span) => span.span_id === artefactSegment.span.span_id,
    );
    selected.source_node_occurrence_id = 'wrong-native-artefact-node';
    selected.span_id = contentId('AGREEMENT_SOURCE_SPAN/V2', {
      agreement_index_id: selectedScenario.source.agreementIndex.agreement_index_id,
      source_node_occurrence_id: selected.source_node_occurrence_id,
      start_byte: selected.start_byte,
      end_byte: selected.end_byte,
      text_sha256: selected.text_sha256,
    });
    restampInline(
      closure, 'STAGE_2Y_M7_V2_REVIEWED_SOURCE_CLOSURE/V1', 'source_closure_id',
    );
    return result();
  }
  if (caseId === 'textual-source-artefact-lacks-native-or-ben-authority') {
    const entry = analysis.coverage_partitions[0].entries.find(
      (candidate) => candidate.materiality === 'MATERIAL',
    );
    entry.treatment_kind = 'SOURCE_ARTEFACT';
    entry.owner_id = null;
    entry.reason_code = 'UNAUTHORISED_TEXTUAL_ARTEFACT';
    entry.authority_id = null;
    return result();
  }
  if (caseId === 'operative-preamble-labelled-structural') {
    const operativeSpan = analysis.source_closures[0].spans.find((span) => span.operative);
    const entry = analysis.coverage_partitions[0].entries.find(
      (candidate) => candidate.span_id === operativeSpan.span_id,
    );
    entry.treatment_kind = 'STRUCTURAL_TEXT';
    entry.owner_id = null;
    entry.reason_code = selectedScenario.structure.member.reason_code;
    entry.authority_id = selectedScenario.structure.member.structure_disposition_id;
    return result();
  }
  if (caseId === 'material-proviso-left-unmodelled') {
    const proviso = selectedScenario.source.segments.find(
      (segment) => segment.material_proviso === true,
    );
    assert.ok(proviso);
    const entry = analysis.coverage_partitions[0].entries.find(
      (candidate) => candidate.span_id === proviso.span.span_id,
    );
    assert.ok(entry);
    entry.treatment_kind = 'LEGAL_TEXT_EXCLUSION';
    entry.owner_id = null;
    entry.reason_code = 'UNMODELLED_MATERIAL_PROVISO';
    entry.authority_id = null;
    return result();
  }
  throw new Error(`no fact/source mutation is registered for ${caseId}`);
}

function restampCandidateSetAndDisposition(analysis) {
  const candidateSet = analysis.candidate_sets[0];
  restampInline(
    candidateSet, 'STAGE_2Y_M7_V2_INSPECTED_CANDIDATE_SET/V1', 'candidate_set_id',
  );
  const disposition = analysis.dispositions[0];
  disposition.candidate_set_id = candidateSet.candidate_set_id;
  disposition.candidate_set_digest = sha256Hex(canonicalJson(candidateSet));
  restampInline(disposition, 'STAGE_2Y_M7_V2_DISPOSITION/V1', 'disposition_id');
}

function restampEffect(effect) {
  effect.effect_id = contentId('STAGE_2Y_M7_V2_INSPECTED_EFFECT/V1', {
    input_occurrence_id: effect.input_occurrence_id,
    source_span_ids: effect.source_span_ids,
    fact_ids: effect.fact_ids,
    expression_root_id: effect.expression_root_id,
  });
}

function relinkMutatedEffect(analysis, effect, oldEffectId, oldRootExpressionId = null) {
  const rule = analysis.rules.find((entry) => entry.effect_id === oldEffectId);
  assert.ok(rule, 'effect mutation requires its derived rule');
  const oldRuleId = rule.rule_id;
  rule.effect_id = effect.effect_id;
  rule.fact_ids = [...effect.fact_ids];
  rule.root_expression_id = effect.expression_root_id;
  rule.rule_id = contentId('AGREEMENT_LEGAL_RULE/V2', {
    agreement_id: analysis.agreement_id,
    input_occurrence_id: rule.input_occurrence_id,
    effect_id: rule.effect_id,
    family_key: rule.family_key,
    profile_id: rule.profile_id,
    subtype_path: rule.subtype_path,
    semantic_fact_keys: rule.fact_ids.map((factId) => analysis.facts.find(
      (fact) => fact.fact_id === factId,
    ).semantic_fact_key),
    canonical_expression_signature: rule.expression_signature,
    child_rule_ids: rule.child_rule_ids,
    source_closure_id: rule.source_closure_id,
  });
  for (const fact of analysis.facts) {
    if (fact.owner_rule_id === oldRuleId) fact.owner_rule_id = rule.rule_id;
  }
  if (rule.validation.no_comparison_authority !== null) {
    rule.validation.no_comparison_authority.rule_id = rule.rule_id;
  }
  const ledger = analysis.authored_unit_effect_ledgers[0];
  const ledgerEntry = ledger.entries.find((entry) => entry.effect_id === oldEffectId);
  assert.ok(ledgerEntry, 'effect mutation requires its ledger entry');
  ledgerEntry.effect_id = effect.effect_id;
  ledgerEntry.rule_ids = [rule.rule_id];
  ledgerEntry.source_span_ids = [...effect.source_span_ids];
  const closure = analysis.source_closures[0];
  ledgerEntry.operative_marker_span_ids = ledgerEntry.source_span_ids.filter(
    (spanId) => closure.spans.find((span) => span.span_id === spanId)?.operative === true,
  );
  const sourceOrder = new Map(closure.spans.map(
    (span) => [span.span_id, span.start_byte],
  ));
  const factSpanIds = [...new Set(rule.fact_ids.flatMap((factId) => analysis.facts.find(
    (fact) => fact.fact_id === factId,
  ).source_support_ids))].sort(
    (left, right) => sourceOrder.get(left) - sourceOrder.get(right),
  );
  for (const treatment of ledgerEntry.treatments) {
    if (treatment.treatment_kind === 'RULE') {
      treatment.target_id = rule.rule_id;
      treatment.source_span_ids = factSpanIds;
    } else if (oldRootExpressionId !== null
        && treatment.treatment_kind === 'EXPRESSION'
        && treatment.target_id === oldRootExpressionId) {
      treatment.target_id = effect.expression_root_id;
    }
  }
  restampInline(
    ledger, 'STAGE_2Y_M7_V2_AUTHORED_UNIT_EFFECT_LEDGER/V1', 'effect_ledger_id',
  );
  for (const entry of analysis.coverage_partitions[0].entries) {
    if (oldRootExpressionId !== null
        && entry.treatment_kind === 'LOGIC_CONNECTIVE'
        && entry.owner_id === oldRootExpressionId) {
      entry.owner_id = effect.expression_root_id;
    }
  }
  const disposition = analysis.dispositions[0];
  disposition.rule_ids = disposition.rule_ids.map(
    (ruleId) => ruleId === oldRuleId ? rule.rule_id : ruleId,
  );
  disposition.absence_proofs.forEach((proof) => {
    if (proof.rule_id === oldRuleId) proof.rule_id = rule.rule_id;
  });
  disposition.issues.forEach((issue) => {
    if (issue.rule_id === oldRuleId) issue.rule_id = rule.rule_id;
    if (issue.effect_id === oldEffectId) issue.effect_id = effect.effect_id;
  });
  disposition.no_comparison_authorities.forEach((authority) => {
    if (authority.rule_id === oldRuleId) authority.rule_id = rule.rule_id;
  });
  for (const correction of analysis.family_corrections) {
    if (correction.rule_id !== oldRuleId) continue;
    correction.rule_id = rule.rule_id;
    const unsigned = { ...correction };
    delete unsigned.correction_id;
    correction.correction_id = contentId(
      'STAGE_2Y_M7_V2_FAMILY_CORRECTION/V1', unsigned,
    );
  }
  restampCandidateSetAndDisposition(analysis);
}

function analysisMutationForCase(scenario, caseId) {
  const analysis = clone(scenario.analysis);
  if (caseId === 'silent-governed-occurrence-omission') {
    analysis.dispositions = [];
  } else if (caseId === 'no-output-without-ben-authority') {
    const disposition = analysis.dispositions[0];
    disposition.no_output_authority = null;
    restampInline(disposition, 'STAGE_2Y_M7_V2_DISPOSITION/V1', 'disposition_id');
  } else if (caseId === 'linked-review-only-limb-suppresses-complete-sibling') {
    const disposition = analysis.dispositions[0];
    disposition.rule_ids = disposition.rule_ids.filter(
      (ruleId) => analysis.rules.find((rule) => rule.rule_id === ruleId)
        .validation.output_disposition === 'REVIEW_ONLY',
    );
    restampInline(disposition, 'STAGE_2Y_M7_V2_DISPOSITION/V1', 'disposition_id');
  } else if (caseId === 'no-output-suppresses-compatible-cross-family-normal') {
    const disposition = analysis.dispositions[0];
    disposition.output_disposition = 'NO_OUTPUT';
    disposition.no_output_authority = {
      authority_kind: 'BEN_APPROVED_OCCURRENCE_NO_OUTPUT',
      structure_disposition_id: scenario.structure.member.structure_disposition_id,
      policy_id: scenario.structure.member.policy_id,
      policy_version: scenario.structure.member.policy_version,
      lawyer_ruling_id: scenario.structure.member.lawyer_ruling_id,
      approver: 'BEN_GOODCHILD',
      legal_reason: scenario.structure.member.reason_code,
      covered_input_occurrence_ids: [disposition.input_occurrence_id],
      inclusion_fixture_bindings: scenario.structure.member.inclusion_fixture_bindings,
      exclusion_fixture_bindings: scenario.structure.member.exclusion_fixture_bindings,
    };
    restampInline(disposition, 'STAGE_2Y_M7_V2_DISPOSITION/V1', 'disposition_id');
  } else if (caseId === 'no-output-is-relabelled-no-comparison') {
    const disposition = analysis.dispositions[0];
    disposition.output_disposition = 'NO_COMPARISON';
    disposition.no_output_authority = null;
    restampInline(disposition, 'STAGE_2Y_M7_V2_DISPOSITION/V1', 'disposition_id');
  } else if (caseId === 'candidate-six-input-binding-drift') {
    analysis.governance.semantic_input_bindings[0].binding.sha256 = 'f'.repeat(64);
  } else if (caseId === 'candidate-registration-id-changes-without-review-reset') {
    analysis.governance.candidate_registration_id = 'f'.repeat(64);
  } else if (caseId === 'inspected-candidate-set-drift') {
    analysis.candidate_sets[0].considered_family_keys.pop();
    restampInline(
      analysis.candidate_sets[0],
      'STAGE_2Y_M7_V2_INSPECTED_CANDIDATE_SET/V1',
      'candidate_set_id',
    );
  } else if (caseId === 'expression-connective-span-outside-closure') {
    const identity = {
      operator: 'NOT',
      result_kind: 'LOGICAL',
      children: [{
        kind: 'FACT', id: analysis.facts[0].fact_id, ordinal: 1, role: 'NEGATED',
      }],
      connective_span_ids: ['absent-connective-span'],
      authored_limb_marker_span_ids: [],
      scope_span_ids: [analysis.source_closures[0].spans[0].span_id],
    };
    analysis.expressions.push({
      expression_id: contentId('STAGE_2Y_M7_V2_EXPRESSION/V1', identity),
      ...identity,
      parent_expression_id: null,
    });
  } else if (caseId === 'effect-ledger-omits-linked-effect') {
    analysis.authored_unit_effect_ledgers[0].entries.pop();
    restampInline(
      analysis.authored_unit_effect_ledgers[0],
      'STAGE_2Y_M7_V2_AUTHORED_UNIT_EFFECT_LEDGER/V1',
      'effect_ledger_id',
    );
  } else if (caseId === 'cross-effect-fact-leaks-into-sibling-effect'
      || caseId === 'operative-modal-is-absorbed-into-another-effect'
      || caseId === 'operative-limb-is-absorbed-into-another-effect') {
    const [first, second] = analysis.candidate_sets[0].effects;
    const requiredFieldKey = caseId === 'cross-effect-fact-leaks-into-sibling-effect'
      ? 'APPLIES_TO'
      : caseId === 'operative-limb-is-absorbed-into-another-effect'
        ? 'AUTHORED_LIMB_MARKER' : 'LEGAL_EFFECT';
    const sourceFact = analysis.facts.find((fact) => first.fact_ids.includes(fact.fact_id)
      && fact.field_key === requiredFieldKey);
    assert.ok(sourceFact && second, `${caseId} requires two effects and a source fact`);
    const oldEffectId = second.effect_id;
    second.fact_ids.push(sourceFact.fact_id);
    for (const spanId of sourceFact.source_support_ids) {
      if (!second.source_span_ids.includes(spanId)) second.source_span_ids.push(spanId);
    }
    const sourceOrder = new Map(analysis.source_closures[0].spans.map(
      (span) => [span.span_id, span.start_byte],
    ));
    second.source_span_ids.sort((left, right) => sourceOrder.get(left) - sourceOrder.get(right));
    restampEffect(second);
    relinkMutatedEffect(analysis, second, oldEffectId);
  } else if (caseId === 'cross-effect-expression-leaks-into-sibling-effect') {
    const [first, second] = analysis.candidate_sets[0].effects;
    assert.ok(first?.expression_root_id && second?.expression_root_id,
      'expression leak requires two expression effects');
    const oldEffectId = second.effect_id;
    const oldRootExpressionId = second.expression_root_id;
    const expression = analysis.expressions.find(
      (entry) => entry.expression_id === oldRootExpressionId,
    );
    const foreignSpanId = first.source_span_ids.find(
      (spanId) => !second.source_span_ids.includes(spanId),
    );
    assert.ok(expression && foreignSpanId,
      'expression leak requires a foreign sibling-effect source span');
    expression.scope_span_ids = [...expression.scope_span_ids, foreignSpanId];
    expression.expression_id = contentId('STAGE_2Y_M7_V2_EXPRESSION/V1', {
      operator: expression.operator,
      result_kind: expression.result_kind,
      children: expression.children,
      connective_span_ids: expression.connective_span_ids,
      authored_limb_marker_span_ids: expression.authored_limb_marker_span_ids,
      scope_span_ids: expression.scope_span_ids,
    });
    second.expression_root_id = expression.expression_id;
    restampEffect(second);
    relinkMutatedEffect(analysis, second, oldEffectId, oldRootExpressionId);
  } else if (caseId === 'operative-modal-is-omitted'
      || caseId === 'operative-limb-is-omitted') {
    const entry = analysis.authored_unit_effect_ledgers[0].entries[0];
    const markerKind = caseId === 'operative-limb-is-omitted'
      ? 'ENUMERATED_LIMB' : 'MODAL';
    const marker = scenario.source.effectSegments[0].find(
      (segment) => segment.operative_marker_kind === markerKind,
    );
    assert.ok(marker, `${caseId} requires a ${markerKind} marker`);
    assert.equal(entry.operative_marker_span_ids.includes(marker.span.span_id), true);
    entry.operative_marker_span_ids = entry.operative_marker_span_ids.filter(
      (spanId) => spanId !== marker.span.span_id,
    );
    restampInline(
      analysis.authored_unit_effect_ledgers[0],
      'STAGE_2Y_M7_V2_AUTHORED_UNIT_EFFECT_LEDGER/V1',
      'effect_ledger_id',
    );
  } else if (caseId === 'no-output-skips-all-family-candidate-set') {
    analysis.authored_unit_effect_ledgers[0].entries = [];
    restampInline(
      analysis.authored_unit_effect_ledgers[0],
      'STAGE_2Y_M7_V2_AUTHORED_UNIT_EFFECT_LEDGER/V1',
      'effect_ledger_id',
    );
  } else if (caseId === 'family-correction-missing-for-changed-rule') {
    analysis.family_corrections.pop();
  } else if (caseId === 'family-correction-lacks-approved-ruling') {
    const correction = analysis.family_corrections[0];
    correction.lawyer_ruling_id = 'unapproved-family-correction-ruling';
    const unsigned = { ...correction };
    delete unsigned.correction_id;
    correction.correction_id = contentId(
      'STAGE_2Y_M7_V2_FAMILY_CORRECTION/V1', unsigned,
    );
  } else if (caseId === 'consumer-link-targets-non-owner') {
    const link = analysis.ownership_links[0];
    link.resolved_owner_target_id = 'NON_OWNER_TARGET';
    const unsigned = { ...link };
    delete unsigned.link_id;
    link.link_id = contentId('AGREEMENT_SEMANTIC_OWNERSHIP_LINK/V2', unsigned);
    analysis.rules.find((rule) => rule.consumer_link_ids.length > 0).consumer_link_ids = [
      link.link_id,
    ];
  } else if (caseId === 'consumer-duplicates-owner-fact') {
    analysis.ownership_links.push(clone(analysis.ownership_links[0]));
  } else if (caseId === 'heading-derived-context-produces-normal') {
    analysis.dependencies[0].context_edge_id = 'heading-only-context-edge';
  } else if (caseId === 'generic-ben-exception-covers-another-occurrence-class') {
    const effect = analysis.candidate_sets[0].effects[0];
    effect.generic_level_output_authority.covered_occurrence_class = 'ANOTHER > CLASS';
    restampCandidateSetAndDisposition(analysis);
  } else if (caseId === 'item-39-overlay-applied-outside-item-39') {
    const closure = analysis.source_closures[0];
    closure.agreement_index_binding = scenario.structure.item39.item39Index.binding;
    closure.canonical_source_binding = {
      canonical_text_id: scenario.structure.item39.item39Index.record.source_binding
        .canonical_text_id,
      canonical_text_sha256: scenario.structure.item39.item39Index.record.source_binding
        .canonical_text_sha256,
      canonical_text_byte_length: scenario.structure.item39.item39Index.record.source_binding
        .canonical_text_byte_length,
    };
    restampInline(
      closure, 'STAGE_2Y_M7_V2_REVIEWED_SOURCE_CLOSURE/V1', 'source_closure_id',
    );
  } else {
    throw new Error(`no analysis mutation is registered for ${caseId}`);
  }
  return restampAnalysis(analysis);
}

const executableTopologyCases = cases.focused_topology_cases;

const executableStateCases = cases.state_cases;

const topologyById = new Map(executableTopologyCases.map((entry) => [entry.case_id, entry]));
const stateById = new Map(executableStateCases.map((entry) => [entry.case_id, entry]));
const publicById = new Map(cases.public_seam_positive_cases.map(
  (entry) => [entry.case_id, entry],
));

function validateScenario(scenario) {
  return validateAnalysisV2({
    analysis: scenario.analysis,
    resolveBinding: scenario.resolveBinding,
  });
}

function oneRuleDefinition(caseId, familyKey = 'TERMINATION', overrides = {}) {
  return {
    case_id: caseId,
    effects: [{
      family_key: familyKey,
      expression_signature: 'ALL_OF(APPLIES_TO,FAMILY_MARKER)',
      temporal_fields: [],
      output_disposition: 'NORMAL',
      ...overrides,
    }],
  };
}

function item4Scenario() {
  return buildScenario(oneRuleDefinition(
    'item-4-remains-review-only-without-governing-chapeau',
    'CLOSING_CONDITIONS',
    {
      output_disposition: 'REVIEW_ONLY',
      extraction_state: 'INCOMPLETE',
      source_quality: 'SUFFICIENT',
      issue_code: 'GOVERNING_CHAPEAU_NOT_PROVED',
    },
  ), { unresolvedDependency: true });
}

function item9Scenario(dependencyState = 'RESOLVED') {
  return buildScenario(oneRuleDefinition(
    'item-9-inspects-required-defined-match-period', 'NO_SHOP',
  ), { requiredDependencyState: dependencyState });
}

function item41Item15ProfileScenario() {
  return buildScenario({
    case_id: 'item-41-and-item-15-shared-consideration-profile-gate',
    effects: [
      {
        family_key: 'CONSIDERATION',
        subprofile_key: 'BEN_NO_COMPARISON',
        expression_signature: 'ALL_OF(APPLIES_TO,FAMILY_MARKER)',
        temporal_fields: [],
        output_disposition: 'NO_COMPARISON',
      },
      {
        family_key: 'CONSIDERATION',
        subprofile_key: 'NATIVE_PAGE_ARTEFACT',
        expression_signature: 'ALL_OF(APPLIES_TO,FAMILY_MARKER)',
        temporal_fields: [],
        extraction_state: 'INCOMPLETE',
        source_quality: 'SOURCE_LIMITED',
        output_disposition: 'REVIEW_ONLY',
        issue_code: 'NATIVE_SOURCE_ARTEFACT_REVIEW_REQUIRED',
      },
    ],
  }, { nativeSourceArtefact: true });
}

function ownershipScenario(options = {}) {
  const consumerFamily = options.ownershipConsumerFamily ?? 'TERMINATION_FEE';
  return buildScenario({
    case_id: 'item-25-uses-consumer-link-to-termination-event-owner',
    effects: [
      {
        family_key: 'TERMINATION',
        expression_signature: 'ALL_OF(APPLIES_TO,FAMILY_MARKER)',
        temporal_fields: [],
        output_disposition: 'NORMAL',
      },
      {
        family_key: consumerFamily,
        expression_signature: 'ALL_OF(APPLIES_TO,FAMILY_MARKER)',
        temporal_fields: [],
        output_disposition: 'NORMAL',
      },
    ],
  }, {
    ...options,
    ownershipLink: true,
    ownershipConsumerFamily: consumerFamily,
    requiredDependencyState: 'RESOLVED',
    requiredDependencyTargetId: 'COMPANY',
  });
}

function twoEffectProvenanceScenario(options = {}) {
  return buildScenario({
    case_id: 'two-effect-provenance-fixture',
    effects: [
      {
        family_key: 'TERMINATION',
        expression_signature: 'ALL_OF(APPLIES_TO,FAMILY_MARKER)',
        temporal_fields: [],
        output_disposition: 'NORMAL',
      },
      {
        family_key: 'GENERAL_COVENANTS',
        expression_signature: 'ALL_OF(APPLIES_TO,FAMILY_MARKER)',
        temporal_fields: [],
        output_disposition: 'NORMAL',
      },
    ],
  }, options);
}

function groupingScenario() {
  const effect = {
    family_key: 'TERMINATION',
    expression_signature: 'ALL_OF(APPLIES_TO,FAMILY_MARKER,THRESHOLD)',
    temporal_fields: [],
    output_disposition: 'NORMAL',
  };
  return buildScenario({
    case_id: 'grouping-enabled-two-row-fixture',
    effects: [clone(effect), clone(effect)],
  }, { groupingEnabled: true });
}

function projectionScenarioForNegative(caseId) {
  if (caseId === 'projection-source-limitation-drift') {
    return buildScenario(stateById.get('source-limited-approved-row'));
  }
  if (caseId === 'projection-display-required-fact-is-omitted') {
    return buildScenario(cases.baseline_case, {
      displayFactMode: 'DISPLAY_REQUIRED_NON_MATERIAL',
      profileDimensionEvidence: 'CONDITIONAL',
    });
  }
  if (caseId === 'projection-never-display-fact-is-rendered') {
    return buildScenario(cases.baseline_case, {
      displayFactMode: 'NEVER_DISPLAY_NON_MATERIAL',
      profileDimensionEvidence: 'CONDITIONAL',
    });
  }
  if (caseId === 'unequal-equivalence-signatures-share-group') return groupingScenario();
  return buildScenario(cases.baseline_case);
}

function scenarioForAnalysisNegative(caseId) {
  const profileVariant = new Map([
    ['false-profile-match', 'FALSE_MATCH'],
    ['near-negative-cannot-match', 'NEAR_NEGATIVE'],
    ['wrong-family-cannot-match', 'WRONG_FAMILY'],
    ['wrong-subtype-cannot-match', 'WRONG_SUBTYPE'],
  ]).get(caseId);
  if (profileVariant !== undefined) {
    return buildScenario(cases.baseline_case, { profileSourceVariant: profileVariant });
  }
  if (caseId.startsWith('item-39-overlay-')
      || caseId.startsWith('ambiguous-repeat-')
      || caseId === 'unknown-inline-marker-overlaps-item-39-overlay') {
    return buildScenario(cases.baseline_case, { negativeCaseId: caseId });
  }
  if (caseId.startsWith('profile-set-') || caseId.startsWith('profile-tree-')
      || caseId.startsWith('profile-dimension-')) {
    return buildScenario(cases.baseline_case, {
      negativeCaseId: caseId,
      ...(caseId === 'profile-dimension-evidence-omits-dependent-field'
        ? { requiredDependencyState: 'RESOLVED' } : {}),
    });
  }
  if (caseId === 'generic-abstract-ancestor-emits-normal') {
    return buildScenario(cases.baseline_case, { negativeCaseId: caseId });
  }
  if (caseId === 'generic-incomplete-tree-emits-approved-limited') {
    return buildScenario(stateById.get('source-limited-approved-row'), {
      incompleteTreeFamily: 'TERMINATION', negativeCaseId: caseId,
    });
  }
  if (caseId === 'generic-ben-exception-covers-another-occurrence-class') {
    return buildScenario(stateById.get('generic-ancestor-exact-ben-exception'));
  }
  if (caseId === 'missing-required-context-edge-produces-normal') {
    return item9Scenario('UNRESOLVED');
  }
  if (caseId === 'item-9-source-limited-with-uninspected-defined-term') {
    return buildScenario(oneRuleDefinition(
      'item-9-source-limited-with-uninspected-defined-term', 'KEY_DEFINED_TERMS', {
        output_disposition: 'APPROVED_LIMITED', missing_required_field: 'DEFINED_MATCH_PERIOD',
      },
    ), { unresolvedDependency: true });
  }
  if (caseId === 'heading-derived-context-produces-normal') {
    return item9Scenario('RESOLVED');
  }
  if (caseId === 'wrong-item-6-topology-with-same-leaves') {
    return buildScenario(topologyById.get('item-6-intent-knowledge-causation'), {
      invalidChildRole: true,
    });
  }
  if (caseId === 'effect-ledger-omits-linked-effect') {
    return buildScenario(topologyById.get('item-23-three-linked-effects'));
  }
  if (caseId.startsWith('cross-effect-')
      || caseId === 'operative-modal-is-absorbed-into-another-effect') {
    return twoEffectProvenanceScenario();
  }
  if (caseId === 'linked-review-only-limb-suppresses-complete-sibling') {
    return buildScenario(stateById.get('linked-normal-and-review-only'));
  }
  if (caseId.startsWith('family-correction-')) {
    return buildScenario(topologyById.get('item-6-intent-knowledge-causation'));
  }
  if (caseId.startsWith('consumer-')) return ownershipScenario();
  if (caseId === 'no-output-skips-all-family-candidate-set'
      || caseId === 'no-output-without-ben-authority'
      || caseId === 'no-output-is-relabelled-no-comparison') {
    return buildScenario(stateById.get('ben-approved-no-output'));
  }
  if (caseId === 'no-output-suppresses-compatible-cross-family-normal') {
    return buildScenario(stateById.get('no-output-does-not-suppress-cross-family-normal'));
  }
  if (caseId === 'candidate-subtype-tree-binding-drift'
      || caseId === 'candidate-predecessor-receipt-not-pass'
      || caseId === 'fixed-50-identity-binding-drift') {
    return buildScenario(cases.baseline_case, { negativeCaseId: caseId });
  }
  if (caseId === 'operative-limb-is-omitted'
      || caseId === 'operative-limb-is-absorbed-into-another-effect') {
    return twoEffectProvenanceScenario({ enumeratedLimb: true });
  }
  return buildScenario(cases.baseline_case);
}

function positiveScenarioForDirectInvalidCase(caseId) {
  if (['false-profile-match', 'near-negative-cannot-match',
    'wrong-family-cannot-match', 'wrong-subtype-cannot-match'].includes(caseId)) {
    return buildScenario(cases.baseline_case);
  }
  if (caseId.startsWith('item-39-overlay-')
      || caseId.startsWith('ambiguous-repeat-')
      || caseId === 'unknown-inline-marker-overlaps-item-39-overlay') {
    return buildScenario(cases.baseline_case);
  }
  if (caseId.startsWith('profile-set-') || caseId.startsWith('profile-tree-')) {
    return buildScenario(cases.baseline_case);
  }
  if (caseId === 'profile-dimension-evidence-omits-material-field') {
    return buildScenario(cases.baseline_case);
  }
  if (caseId === 'profile-dimension-evidence-omits-dependent-field') {
    return buildScenario(cases.baseline_case, {
      profileDimensionEvidence: 'DEPENDENCY',
      requiredDependencyState: 'RESOLVED',
    });
  }
  if (caseId === 'profile-dimension-evidence-omits-conditional-or-child-rule') {
    return buildScenario(cases.baseline_case, {
      profileDimensionEvidence: 'CONDITIONAL',
    });
  }
  if (caseId === 'generic-abstract-ancestor-emits-normal') {
    return buildScenario(cases.baseline_case);
  }
  if (caseId === 'generic-incomplete-tree-emits-approved-limited') {
    return buildScenario(stateById.get('source-limited-approved-row'));
  }
  if (caseId === 'missing-required-context-edge-produces-normal') {
    return item9Scenario('RESOLVED');
  }
  if (caseId === 'item-9-source-limited-with-uninspected-defined-term') {
    return buildScenario(oneRuleDefinition(
      'item-9-source-limited-with-inspected-defined-term', 'KEY_DEFINED_TERMS', {
        output_disposition: 'APPROVED_LIMITED', missing_required_field: 'DEFINED_MATCH_PERIOD',
      },
    ));
  }
  if (caseId === 'wrong-item-6-topology-with-same-leaves') {
    return buildScenario(topologyById.get('item-6-intent-knowledge-causation'));
  }
  if (caseId === 'candidate-subtype-tree-binding-drift'
      || caseId === 'candidate-predecessor-receipt-not-pass'
      || caseId === 'fixed-50-identity-binding-drift') {
    return buildScenario(cases.baseline_case);
  }
  throw new Error(`no positive baseline is registered for direct-invalid case ${caseId}`);
}

test('acceptance registry is closed and covers every fixed sample ordinal', () => {
  assert.equal(cases.schema_version,
    'STAGE_2Y_M7_V2_REPAIR_WORK1_ACCEPTANCE_CASES/V2');
  const caseIds = [
    cases.baseline_case.case_id,
    cases.structure_overlay_case.case_id,
    cases.profile_dimension_disposition_case.case_id,
    ...cases.public_seam_positive_cases.map((entry) => entry.case_id),
    ...cases.focused_topology_cases.map((entry) => entry.case_id),
    ...cases.focused_topology_cases.flatMap(
      (entry) => entry.work1_absence_assertion_id === undefined
        ? [] : [entry.work1_absence_assertion_id],
    ),
    ...cases.state_cases.map((entry) => entry.case_id),
    ...cases.negative_cases.map((entry) => entry.case_id),
  ];
  assert.equal(new Set(caseIds).size, caseIds.length);
  assert.equal(caseIds.length, 198);
  const negativeCaseIds = cases.negative_cases.map((entry) => entry.case_id);
  assert.equal(negativeCaseIds.length, 152);
  assert.equal(new Set(negativeCaseIds).size, negativeCaseIds.length);
  assert.deepEqual(cases.profile_execution_authority, {
    executable_matching_owner: 'SEPARATE_BEN_APPROVED_FAMILY_PROFILE_SET',
    packet_set_can_assert_completeness: false,
    packet_set_contains_executable_matchers: false,
  });
  assert.deepEqual(cases.programme_coverage.fixed_sample_ordinals, Array.from(
    { length: 50 }, (_, index) => index + 1,
  ));
  assert.equal(cases.programme_coverage.expected_sample_size, 50);
  assert.equal(cases.programme_coverage.expected_family_count, 25);
  assert.equal(cases.structure_overlay_case.expected_eligible_marker_count, 6);
  assert.equal(cases.structure_overlay_case.expected_excluded_glued_reference_count, 2);

  const store = new Map();
  const evidence = buildWork0PacketEvidence(store);
  const reviewPacket = JSON.parse(readFileSync(
    join(REPO_ROOT, evidence.fixed.record.lawyer_review_packet_binding.path), 'utf8',
  ));
  const coverage = cases.programme_coverage;
  assert.equal(evidence.fixed.record.fixed_sample_identity_manifest_id,
    coverage.fixed_sample_identity_manifest_id);
  assert.equal(evidence.fixed.record.lawyer_review_packet_binding.record_id,
    coverage.lawyer_review_packet_id);
  assert.equal(evidence.fixed.record.combined_ten_corpus_digest,
    coverage.combined_ten_corpus_digest);
  assert.equal(reviewPacket.schema_version, coverage.lawyer_review_packet_schema_version);
  assert.equal(reviewPacket.lawyer_review_packet_id, coverage.lawyer_review_packet_id);
  assert.equal(reviewPacket.combined_ten_corpus_digest, coverage.combined_ten_corpus_digest);
  assert.equal(reviewPacket.packet_state, coverage.lawyer_review_packet_state);
  assert.equal(reviewPacket.expected_answers_included,
    coverage.lawyer_review_packet_expected_answers_included);
  assert.equal(reviewPacket.sample_size, coverage.expected_sample_size);
  assert.deepEqual(evidence.fixed.record.counts, {
    parser_ambiguity_items: coverage.expected_parser_ambiguity_items,
    review_only_no_normal_row_items: coverage.expected_review_only_no_normal_row_items,
    source_span_count: coverage.expected_source_span_count,
    source_to_row_items: coverage.expected_source_to_row_items,
    total_items: coverage.expected_sample_size,
    unique_agreement_count: coverage.expected_unique_agreement_count,
  });
  assert.deepEqual(reviewPacket.coverage, {
    additive_agreement_count: coverage.expected_additive_agreement_count,
    ambiguity_count: coverage.expected_ambiguity_count,
    family_count: coverage.expected_family_count,
    grouped_row_count: coverage.expected_grouped_row_count,
    known_loss_class_count: coverage.expected_known_loss_class_count,
    no_output_count: coverage.expected_no_output_count,
  });
  const fixedMembers = [...evidence.fixed.record.members].sort(
    (left, right) => left.sample_ordinal - right.sample_ordinal,
  );
  const baselineEntries = [...evidence.baseline.record.entries].sort(
    (left, right) => left.sample_ordinal - right.sample_ordinal,
  );
  const reviewItems = [...reviewPacket.items].sort(
    (left, right) => left.sample_ordinal - right.sample_ordinal,
  );
  assert.deepEqual(fixedMembers.map((entry) => entry.sample_ordinal),
    coverage.fixed_sample_ordinals);
  assert.deepEqual(baselineEntries.map((entry) => entry.sample_ordinal),
    coverage.fixed_sample_ordinals);
  assert.deepEqual(reviewItems.map((entry) => entry.sample_ordinal),
    coverage.fixed_sample_ordinals);
  for (let index = 0; index < fixedMembers.length; index += 1) {
    assert.equal(fixedMembers[index].review_item_id, reviewItems[index].review_item_id);
    assert.equal(fixedMembers[index].review_item_id, baselineEntries[index].review_item_id);
    assert.equal(fixedMembers[index].agreement_id, reviewItems[index].agreement_id);
    assert.equal(fixedMembers[index].family_key, reviewItems[index].family_key);
    assert.equal(fixedMembers[index].item_kind, reviewItems[index].item_kind);
  }
  const grouped = reviewItems.filter((entry) => entry.member_facts.length > 1);
  assert.deepEqual(grouped.map((entry) => entry.sample_ordinal),
    coverage.grouped_row_sample_ordinals);
  assert.equal(grouped.reduce((count, entry) => count + entry.member_facts.length, 0),
    coverage.expected_grouped_member_fact_count);
  const linkedGrouped = grouped.filter(
    (entry) => entry.compact_row.includes('[1 linked point in full row]'),
  );
  assert.deepEqual(linkedGrouped.map((entry) => entry.sample_ordinal),
    coverage.compact_rows_naming_linked_points);
  assert.equal(linkedGrouped.length, coverage.expected_compact_linked_point_label_count);
  assert.equal(reviewItems.filter((entry) => entry.item_kind === 'SOURCE_TO_ROW').every(
    (entry) => entry.grouping_decision === coverage.required_grouping_decision,
  ), true);
});

test('every public positive is routed to its declared public seam', () => {
  const analysisCases = new Set([
    'all-approved-normalisation-rules-are-source-recomputed',
    'party-and-party-set-have-exact-alias-evidence',
    'reference-is-one-exact-source-reference',
    'item-15-native-page-marker-is-source-artefact',
    'item-41-approved-no-comparison-with-item-15-negative',
    'item-4-remains-review-only-without-governing-chapeau',
    'item-9-inspects-required-defined-match-period',
    'item-25-uses-consumer-link-to-termination-event-owner',
    'profile-set-owns-all-subtype-trees-and-dimension-evidence',
    'generic-ancestor-output-obeys-tree-rollout-gate',
    'linked-rules-retain-independent-states',
    'family-corrections-cover-every-changed-prior-family',
    'no-output-is-classified-after-all-family-evaluation',
    'near-duplicate-clauses-have-comparable-signatures',
  ]);
  const projectionCases = new Set([
    'projection-renders-every-display-required-material-fact',
    'projection-is-deterministic-without-raw-source',
  ]);
  for (const definition of cases.public_seam_positive_cases) {
    assert.equal(definition.expected_result, 'PASS');
    assertImmutableSampleOrdinals(definition);
    if (analysisCases.has(definition.case_id)) {
      assert.equal(definition.public_seam, 'validateAnalysisV2');
    } else if (projectionCases.has(definition.case_id)) {
      assert.equal(definition.public_seam, 'validateProjectionV2');
    } else {
      assert.equal(definition.case_id,
        'candidate-registration-is-fully-verified-and-continuous');
      assert.equal(definition.public_seam, 'verifyRegisteredCandidate');
    }
  }
  assert.equal(analysisCases.size + projectionCases.size + 1,
    cases.public_seam_positive_cases.length);
});

test(cases.baseline_case.case_id, () => {
  const scenario = buildScenario(cases.baseline_case);
  const result = validateAnalysisV2({
    analysis: scenario.analysis,
    resolveBinding: scenario.resolveBinding,
  });
  assert.equal(result.status, 'PASS');
  assert.equal(result.counts.rules, cases.baseline_case.expected_rule_count);
  assert.deepEqual(result.effects, {
    files_written: 0,
    model_calls: 0,
    network_reads: 0,
    network_writes: 0,
    database_writes: 0,
    product_writes: 0,
  });
  const projection = buildProjection(scenario, result);
  const projectionResult = validateProjectionV2({
    projection,
    analysis: scenario.analysis,
    viewPolicy: scenario.viewPolicy.record,
  });
  assert.equal(projectionResult.status, 'PASS');
  assert.equal(projectionResult.normal_row_count,
    cases.baseline_case.expected_normal_row_count);
});

test(cases.structure_overlay_case.case_id, () => {
  const definition = cases.structure_overlay_case;
  assert.deepEqual(definition.sample_ordinals, [39]);
  const scenario = buildScenario(cases.baseline_case);
  assert.equal(validateScenario(scenario).status, 'PASS');
  const overlayMember = scenario.structure.record.members.find(
    (member) => member.kind === 'BEN_AUTHORED_INLINE_LIST_OVERLAY',
  );
  assert.ok(overlayMember);
  const overlay = overlayMember.inline_list_overlay;
  assert.equal(overlay.sealed_ambiguity_id, ITEM39_AMBIGUITY_ID);
  assert.equal(overlay.lawyer_ruling_id, ITEM39_DECISION_ID);
  assert.equal(overlay.marker_eligibility.structural_candidate_disposition_ids.length, 3);
  assert.equal(overlay.marker_eligibility.excluded_glued_reference_disposition_ids.length,
    definition.expected_excluded_glued_reference_count);
  assert.equal(overlay.candidate_trees.every(
    (tree) => tree.nodes.length === definition.expected_eligible_marker_count,
  ), true);
  assert.deepEqual(overlay.candidate_trees.map(
    (tree) => tree.nodes.map((node) => node.depth),
  ), definition.candidate_depth_readings);
  assert.deepEqual(overlay.candidate_trees.flatMap((tree, index) =>
    tree.tree_state === 'PASS_PARENT_SCOPING' ? [index] : []),
  definition.expected_passing_candidate_indexes);
  assert.equal(overlay.selected_candidate_tree_id,
    overlay.candidate_trees[definition.expected_passing_candidate_indexes[0]].candidate_tree_id);
  const ambiguous = JSON.parse(scenario.resolveBinding(
    overlay.ambiguous_repeat_fixture_bindings[0],
  ).toString('utf8'));
  assert.deepEqual(ambiguous.candidate_trees.map(
    (tree) => tree.nodes.map((node) => node.depth),
  ), definition.ambiguous_repeat_candidate_depth_readings);
  assert.deepEqual(ambiguous.candidate_trees.flatMap((tree, index) =>
    tree.tree_state === 'PASS_PARENT_SCOPING' ? [index] : []),
  definition.ambiguous_repeat_passing_candidate_indexes);

  const consumption = buildItem39ConsumptionScenario();
  const consumptionResult = validateScenario(consumption);
  assert.equal(consumptionResult.status, 'PASS');
  assert.deepEqual(consumptionResult.counts, {
    governed_input_occurrences: 1,
    rules: 1,
    facts: 1,
    expressions: 7,
    shared_fact_coverages: 0,
    source_closures: 1,
    dispositions: 1,
    rule_states: {
      normal: 0,
      approved_limited: 0,
      review_only: 1,
      no_comparison: 0,
    },
    review_only_dispositions: 1,
    no_output_dispositions: 0,
  });
  const item39Entry = consumption.analysis.authored_unit_effect_ledgers[0].entries[0];
  assert.equal(item39Entry.effect_kind, 'COMBINED_MODAL_LIMB');
  assert.equal(item39Entry.operative_marker_span_ids.length, 10);
  assert.deepEqual(consumption.analysis.expressions.map(
    (expression) => expression.authored_limb_marker_span_ids.length,
  ).sort(), [0, 1, 1, 1, 1, 1, 1]);
  assert.deepEqual(consumption.analysis.rules[0].validation, {
    extraction_state: 'INCOMPLETE',
    source_quality: 'SUFFICIENT',
    output_disposition: 'REVIEW_ONLY',
    issue_codes: ['MISSING_OPERATIVE_CHAPEAU'],
    no_comparison_authority: null,
  });
});

test(publicById.get('all-approved-normalisation-rules-are-source-recomputed').case_id, () => {
  const definition = publicById.get('all-approved-normalisation-rules-are-source-recomputed');
  assert.deepEqual(definition.requirements, [
    'EXACT_RULE_TO_VALUE_TYPE_MATRIX',
    'EXACT_BOUND_SOURCE_COVERAGE',
    'BOUNDARY_WHITESPACE_ONLY_IGNORED_FOR_PARSING',
    'RESULT_DIGEST_RECOMPUTED',
  ]);
  const scenario = buildScenario(cases.baseline_case);
  assert.equal(validateScenario(scenario).status, definition.expected_result);
  assert.deepEqual([...new Set(scenario.analysis.facts.map((fact) => fact.value_type))].sort(),
    [...FACT_TYPES].sort());
  const approvedRuleByType = new Map([
    ['PARTY_SET', 'BOUND_PARTY_ALIAS/V1'], ['PARTY', 'BOUND_PARTY_ALIAS/V1'],
    ['ENUM', 'ENUM_LITERAL_MAP/V1'], ['DEFINED_TERM', 'DEFINED_TERM_REFERENCE/V1'],
    ['BOOLEAN', 'BOOLEAN_LITERAL_MAP/V1'], ['NUMBER', 'NUMBER_PARSER/V1'],
    ['PERCENTAGE', 'PERCENTAGE_PARSER/V1'], ['MONEY', 'MONEY_PARSER/V1'],
    ['DATE', 'DATE_ISO_PARSER/V1'], ['DURATION', 'DURATION_PARSER/V1'],
    ['PERIOD', 'PERIOD_PARSER/V1'], ['REFERENCE', 'REFERENCE_EDGE/V1'],
  ]);
  for (const fact of scenario.analysis.facts) {
    assert.equal(fact.normalisation_proof.rule_id, approvedRuleByType.get(fact.value_type));
    assert.equal(fact.normalisation_proof.result_digest,
      sha256Hex(canonicalJson(fact.typed_value)));
    assert.equal(fact.normalisation_proof.input_source_span_ids.length > 0, true);
  }
  assert.deepEqual(
    scenario.analysis.coverage_partitions[0].entries.map((entry) => entry.span_id),
    scenario.analysis.source_closures[0].spans.map((span) => span.span_id),
  );
});

test(publicById.get('party-and-party-set-have-exact-alias-evidence').case_id, () => {
  const definition = publicById.get('party-and-party-set-have-exact-alias-evidence');
  assert.deepEqual(definition.requirements, [
    'PARTY_HAS_EXACTLY_ONE_ALIAS_TOKEN',
    'PARTY_SET_HAS_AT_LEAST_TWO_UNIQUE_ALIAS_TOKENS',
    'COMMA_AND_OR_SEPARATORS_ONLY',
    'ONE_RESOLVED_PARTY_ALIAS_EDGE_PER_TOKEN',
    'EDGE_SUPPORT_EXACTLY_COVERS_TOKEN',
  ]);
  const scenario = buildScenario(cases.baseline_case);
  assert.equal(validateScenario(scenario).status, definition.expected_result);
  const party = scenario.analysis.facts.find((fact) => fact.value_type === 'PARTY');
  const partySet = scenario.analysis.facts.find((fact) => fact.value_type === 'PARTY_SET');
  assert.equal(party.normalisation_proof.input_context_edge_ids.length, 1);
  assert.equal(partySet.normalisation_proof.input_context_edge_ids.length,
    partySet.typed_value.parties.length);
  const edgeById = new Map(scenario.source.contextEdges.map((edge) => [edge.edge_id, edge]));
  for (const edgeId of [...party.normalisation_proof.input_context_edge_ids,
    ...partySet.normalisation_proof.input_context_edge_ids]) {
    const edge = edgeById.get(edgeId);
    assert.equal(edge.edge_type, 'PARTY_ALIAS');
    assert.equal(edge.state, 'RESOLVED');
    assert.equal(edge.source_support_ids.length, 1);
  }
});

test(publicById.get('reference-is-one-exact-source-reference').case_id, () => {
  const definition = publicById.get('reference-is-one-exact-source-reference');
  assert.deepEqual(definition.requirements, [
    'REFERENCE_EDGE_VALUE_TYPE_REFERENCE',
    'ONE_REFERENCE_TOKEN',
    'ONE_RESOLVED_REFERENCE_TARGET_EDGE',
    'EDGE_SUPPORT_EQUALS_FACT_SUPPORT',
  ]);
  const scenario = buildScenario(cases.baseline_case);
  assert.equal(validateScenario(scenario).status, definition.expected_result);
  const fact = scenario.analysis.facts.find((entry) => entry.value_type === 'REFERENCE');
  assert.equal(fact.normalisation_proof.input_context_edge_ids.length, 1);
  const edge = scenario.source.contextEdges.find(
    (entry) => entry.edge_id === fact.normalisation_proof.input_context_edge_ids[0],
  );
  assert.equal(edge.edge_type, 'REFERENCE_TARGET');
  assert.equal(edge.state, 'RESOLVED');
  assert.deepEqual(edge.source_support_ids, fact.source_support_ids);
});

test(publicById.get('item-15-native-page-marker-is-source-artefact').case_id, () => {
  const definition = publicById.get('item-15-native-page-marker-is-source-artefact');
  assert.deepEqual(definition.sample_ordinals, [15]);
  assert.deepEqual(definition.requirements, [
    'NATIVE_AGREEMENT_INDEX_ARTEFACT_EVIDENCE',
    'EXACT_SOURCE_ARTEFACT_SCOPE',
    'SOURCE_BYTES_AND_OFFSETS_UNCHANGED',
    'ABSENT_FROM_LEGAL_FACTS_AND_DISPLAY',
  ]);
  const scenario = buildScenario(stateById.get('item-15-native-source-artefact'));
  const result = validateScenario(scenario);
  assert.equal(result.status, definition.expected_result);
  const artefact = scenario.source.agreementIndex.source_artefacts[0];
  const segment = scenario.source.segments.find((entry) => entry.kind === 'SOURCE_ARTEFACT');
  assert.deepEqual(artefact.span, {
    coordinate_system: 'UTF8_CANONICAL_TEXT_HALF_OPEN',
    start_byte: segment.start_byte,
    end_byte: segment.end_byte,
    text_sha256: sha256Hex(Buffer.from(segment.text, 'utf8')),
  });
  assert.equal(scenario.analysis.facts.some(
    (fact) => fact.source_support_ids.includes(segment.span.span_id),
  ), false);
  const projection = buildProjection(scenario, result);
  assert.equal(validateProjectionV2({
    projection, analysis: scenario.analysis, viewPolicy: scenario.viewPolicy.record,
  }).status, 'PASS');
  assert.equal(projection.rows.length, 0);
  assert.equal(JSON.stringify(projection).includes(artefact.source_artefact_id), false);
});

test(publicById.get('item-41-approved-no-comparison-with-item-15-negative').case_id, () => {
  const definition = publicById.get('item-41-approved-no-comparison-with-item-15-negative');
  assert.deepEqual(definition.sample_ordinals, [41, 15]);
  assert.deepEqual(definition.requirements, [
    'ITEM_41_MATCHES_APPROVED_NO_COMPARISON_PROFILE',
    'ITEM_15_FAILS_THE_SAME_PROFILE',
    'BEN_RULING_BOUND',
  ]);
  const scenario = item41Item15ProfileScenario();
  assert.equal(validateScenario(scenario).status, definition.expected_result);
  const [item41Effect, item15Effect] = scenario.analysis.candidate_sets[0].effects;
  const rule = scenario.analysis.rules.find(
    (entry) => entry.effect_id === item41Effect.effect_id,
  );
  assert.equal(rule.validation.output_disposition, 'NO_COMPARISON');
  assert.equal(rule.validation.no_comparison_authority.authority_kind,
    'PROFILE_NO_COMPARISON_APPROVAL');
  const item41Profile = scenario.analysis.profile_snapshots.find(
    (profile) => profile.profile_id === rule.profile_id,
  );
  assert.equal(item15Effect.profile_results.some(
    (entry) => entry.profile_key === item41Profile.profile_key && entry.matched,
  ), false);
  assert.equal(item15Effect.selected_profile_key,
    scenario.analysis.profile_snapshots.find(
      (profile) => profile.profile_id === scenario.analysis.rules.find(
        (entry) => entry.effect_id === item15Effect.effect_id,
      ).profile_id,
    ).profile_key);
  assert.notEqual(item15Effect.selected_profile_key, item41Profile.profile_key);
  assert.equal(item41Effect.profile_results.some(
    (entry) => entry.profile_key === scenario.analysis.profile_snapshots.find(
      (profile) => profile.profile_id === rule.profile_id,
    ).profile_key && entry.matched,
  ), true);
});

test(publicById.get('item-4-remains-review-only-without-governing-chapeau').case_id, () => {
  const definition = publicById.get('item-4-remains-review-only-without-governing-chapeau');
  assert.deepEqual(definition.sample_ordinals, [4]);
  assert.deepEqual(definition.requirements, [
    'GOVERNING_CHAPEAU_REQUIRED',
    'HEADING_CONTEXT_FORBIDDEN_AS_SUBSTITUTE',
    'CONTEXT_EDGE_UNPROVED',
    'REVIEW_ONLY',
  ]);
  const scenario = item4Scenario();
  assert.equal(validateScenario(scenario).status, definition.expected_result);
  assert.equal(scenario.analysis.dependencies[0].state, 'UNRESOLVED');
  assert.equal(scenario.analysis.rules[0].family_key, 'CLOSING_CONDITIONS');
  assert.equal(scenario.analysis.rules[0].validation.output_disposition, 'REVIEW_ONLY');
  assert.equal(scenario.analysis.dispositions[0].issues[0].issue_code,
    'GOVERNING_CHAPEAU_NOT_PROVED');
});

test(publicById.get('item-9-inspects-required-defined-match-period').case_id, () => {
  const definition = publicById.get('item-9-inspects-required-defined-match-period');
  assert.deepEqual(definition.sample_ordinals, [9]);
  assert.deepEqual(definition.requirements, [
    'REQUIRED_DEFINED_TERM_DEPENDENCY_INSPECTED',
    'DEPENDENCY_SUPPORT_BOUND',
    'SOURCE_LIMITED_FORBIDDEN_WHEN_DEPENDENCY_UNINSPECTED',
  ]);
  const scenario = item9Scenario();
  assert.equal(validateScenario(scenario).status, definition.expected_result);
  const dependency = scenario.analysis.dependencies[0];
  assert.equal(scenario.analysis.rules[0].family_key, 'NO_SHOP');
  assert.equal(dependency.state, 'RESOLVED');
  assert.equal(scenario.analysis.source_closures[0].required_dependency_ids.includes(
    dependency.dependency_id,
  ), true);
  assert.equal(dependency.source_support_ids.every((spanId) =>
    scenario.analysis.source_closures[0].spans.some((span) => span.span_id === spanId)), true);
});

test(publicById.get('item-25-uses-consumer-link-to-termination-event-owner').case_id, () => {
  const definition = publicById.get('item-25-uses-consumer-link-to-termination-event-owner');
  assert.deepEqual(definition.sample_ordinals, [25]);
  assert.deepEqual(definition.requirements, [
    'ONE_AUTHORITATIVE_OWNER_FACT',
    'RESOLVED_OWNER_TARGET_ID',
    'CONSUMER_LINK_SOURCE_PROOF',
    'NO_DUPLICATE_OWNER_FACT',
  ]);
  const scenario = ownershipScenario();
  assert.equal(validateScenario(scenario).status, definition.expected_result);
  assert.equal(scenario.analysis.ownership_links.length, 1);
  const link = scenario.analysis.ownership_links[0];
  assert.equal(scenario.analysis.rules.find(
    (rule) => rule.rule_id === link.consumer_rule_id,
  ).family_key, 'TERMINATION_FEE');
  const ownerFact = scenario.analysis.facts.find((fact) => fact.fact_id === link.owner_fact_id);
  assert.deepEqual(link.source_support_ids, ownerFact.source_support_ids);
  assert.equal(link.resolved_owner_target_id, 'COMPANY');
  assert.equal(new Set(scenario.analysis.facts.map((fact) => fact.fact_id)).size,
    scenario.analysis.facts.length);
});

test(publicById.get('profile-set-owns-all-subtype-trees-and-dimension-evidence').case_id, () => {
  const definition = publicById.get('profile-set-owns-all-subtype-trees-and-dimension-evidence');
  assert.deepEqual(definition.requirements, [
    'EXACT_25_FAMILY_SUBTYPE_TREE_BINDINGS',
    'CANDIDATE_TREE_BINDINGS_BYTE_EQUAL_SET_OWNED_BINDINGS',
    'DERIVED_MATERIAL_AND_DEPENDENCY_DIMENSION_INVENTORY',
    'EXCLUDED_AND_DELEGATED_DIMENSIONS_ACCOUNTED',
    'CONDITIONAL_AND_CHILD_RULE_DIMENSIONS_ACCOUNTED',
  ]);
  const scenario = ownershipScenario({
    ownershipConsumerFamily: 'GENERAL_COVENANTS',
    dimensionContract: true,
    excludedDimension: cases.profile_dimension_disposition_case
      .profile_dimension_disposition,
    excludedDimensionFamily: 'TERMINATION',
  });
  assert.equal(validateScenario(scenario).status, definition.expected_result);
  assert.equal(scenario.profiles.profileSet.subtype_tree_bindings.length, 25);
  assert.deepEqual(scenario.candidate.candidate.subtype_tree_bindings,
    scenario.profiles.profileSet.subtype_tree_bindings);
  assert.equal(scenario.profiles.profileSet.dimension_evidence_bindings.length,
    scenario.profiles.profileSet.profiles.length);
  const profile = scenario.profiles.profiles.find(
    (entry) => entry.family_key === 'GENERAL_COVENANTS',
  );
  assert.equal(profile.conditional_requirements.length, 1);
  assert.equal(profile.child_rule_profiles.length, 1);
  const positiveProof = profile.fixture_proofs.find((proof) => proof.kind === 'POSITIVE');
  const fixture = JSON.parse(
    scenario.resolveBinding(positiveProof.fixture_binding).toString('utf8'),
  );
  assert.deepEqual(fixture.expected_conditional_requirement_ids,
    profile.conditional_requirements.map((entry) => entry.conditional_requirement_id));
  assert.deepEqual(fixture.expected_child_rule_requirement_ids,
    profile.child_rule_profiles.map((entry) => entry.child_rule_requirement_id));
  assert.deepEqual(fixture.expected_dependency_backed_field_keys, ['FAMILY_MARKER']);
  assert.deepEqual(fixture.expected_delegated_dimension_keys,
    ['TERMINATION_EVENT_OWNER']);
  assert.equal(profile.excluded_or_delegated_dimensions.some(
    (entry) => entry.disposition === 'DELEGATED'
      && entry.dimension_key === 'TERMINATION_EVENT_OWNER',
  ), true);
  const terminationProfile = scenario.profiles.profiles.find(
    (entry) => entry.family_key === 'TERMINATION',
  );
  assert.equal(terminationProfile.excluded_or_delegated_dimensions.some(
    (entry) => entry.disposition === 'EXCLUDED'
      && entry.dimension_key === cases.profile_dimension_disposition_case
        .profile_dimension_disposition.dimension_key,
  ), true);
  const terminationFixture = JSON.parse(scenario.resolveBinding(
    terminationProfile.fixture_proofs.find((proof) => proof.kind === 'POSITIVE')
      .fixture_binding,
  ).toString('utf8'));
  assert.deepEqual(terminationFixture.expected_excluded_dimension_keys,
    [cases.profile_dimension_disposition_case.profile_dimension_disposition.dimension_key]);
  const childDimension = `CHILD_RULE:${profile.child_rule_profiles[0]
    .child_rule_requirement_id}`;
  assert.equal(profile.known_relevant_dimensions.some(
    (entry) => entry.dimension_key === childDimension,
  ), true);
});

test(cases.profile_dimension_disposition_case.case_id, () => {
  const definition = cases.profile_dimension_disposition_case;
  const dimension = definition.profile_dimension_disposition;
  const scenario = buildScenario(cases.baseline_case, {
    excludedDimension: dimension,
    excludedDimensionFamily: 'TERMINATION',
  });
  assert.equal(validateScenario(scenario).status, definition.expected_result);
  const profile = scenario.profiles.profiles.find((entry) => entry.family_key === 'TERMINATION');
  const actual = profile.excluded_or_delegated_dimensions.find(
    (entry) => entry.dimension_key === dimension.dimension_key,
  );
  assert.deepEqual(actual, {
    dimension_key: dimension.dimension_key,
    disposition: dimension.disposition,
    lawyer_ruling_id: profileRuling('TERMINATION'),
    owner_profile_id: dimension.owner_profile_id,
    owner_field_key: dimension.owner_field_key,
  });
  assert.equal(dimension.lawyer_ruling_required, true);
  const positive = profile.fixture_proofs.find((proof) => proof.kind === 'POSITIVE');
  const fixture = JSON.parse(scenario.resolveBinding(positive.fixture_binding).toString('utf8'));
  assert.deepEqual(fixture.expected_excluded_dimension_keys,
    definition.fixture_expectations.expected_excluded_dimension_keys);
  assert.deepEqual(fixture.expected_delegated_dimension_keys,
    definition.fixture_expectations.expected_delegated_dimension_keys);
});

test('approved profile fixture matrix is executed for every exact fixture kind', () => {
  const scenario = buildScenario(cases.baseline_case);
  assert.equal(validateScenario(scenario).status, 'PASS');
  const profile = scenario.profiles.profiles.find((entry) => entry.family_key === 'TERMINATION');
  for (const expectation of cases.profile_fixture_matrix) {
    const proof = profile.fixture_proofs.find((entry) => entry.kind === expectation.kind);
    assert.ok(proof, `missing ${expectation.kind} proof`);
    assert.equal(proof.expected_match, expectation.expected_match);
    assert.equal(proof.decisive_leaf_ids.length > 0, true);
    assert.equal(expectation.decisive_leaf_result, expectation.expected_match);
    const fixture = JSON.parse(scenario.resolveBinding(proof.fixture_binding).toString('utf8'));
    if (expectation.source_variant === 'EXACT_FAMILY_TOKEN') {
      assert.equal(fixture.authored_unit_source_text, familyToken(profile.family_key));
    } else if (expectation.source_variant === 'TOKEN_WITH_NON_WORD_BOUNDARY_SUFFIX') {
      assert.equal(fixture.authored_unit_source_text,
        `${familyToken(profile.family_key)}x`);
    } else if (expectation.source_variant === 'NEXT_FAMILY_TOKEN') {
      assert.notEqual(fixture.authored_unit_source_text, familyToken(profile.family_key));
    } else if (expectation.source_variant === 'UNAPPROVED_SUBTYPE_TOKEN') {
      assert.equal(fixture.authored_unit_source_text.includes('unapprovedsubtypetoken'), true);
    } else {
      assert.fail(`unhandled profile fixture variant ${expectation.source_variant}`);
    }
  }
});

test(publicById.get('generic-ancestor-output-obeys-tree-rollout-gate').case_id, () => {
  const definition = publicById.get('generic-ancestor-output-obeys-tree-rollout-gate');
  assert.deepEqual(definition.requirements, [
    'TREE_OUTPUT_COMPLETE_TERMINAL_ANCESTOR_OR_EXACT_BEN_EXCEPTION',
    'ABSTRACT_ANCESTOR_NEVER_EMITS',
    'EXCEPTION_LIMITED_TO_NAMED_OCCURRENCE_CLASS',
  ]);
  const complete = buildScenario(stateById.get('generic-ancestor-tree-output-complete'));
  const exception = buildScenario(stateById.get('generic-ancestor-exact-ben-exception'));
  const incomplete = buildScenario(stateById.get('generic-ancestor-incomplete-rollout'));
  assert.equal(validateScenario(complete).status, definition.expected_result);
  assert.equal(validateScenario(exception).status, definition.expected_result);
  assert.equal(validateScenario(incomplete).status, definition.expected_result);
  assert.equal(complete.analysis.candidate_sets[0].effects[0].generic_level_output_authority,
    null);
  const authority = exception.analysis.candidate_sets[0].effects[0]
    .generic_level_output_authority;
  const profile = exception.analysis.profile_snapshots.find(
    (entry) => entry.profile_id === exception.analysis.rules[0].profile_id,
  );
  assert.equal(authority.approver, 'BEN_GOODCHILD');
  assert.equal(authority.covered_occurrence_class, profile.classification_path.join(' > '));
  assert.equal(incomplete.analysis.rules[0].validation.output_disposition, 'REVIEW_ONLY');
});

test(publicById.get('linked-rules-retain-independent-states').case_id, () => {
  const definition = publicById.get('linked-rules-retain-independent-states');
  assert.deepEqual(definition.requirements, [
    'ONE_OCCURRENCE_DISPOSITION',
    'ONE_STATE_PER_LINKED_RULE',
    'COMPLETE_SIBLING_REMAINS_NORMAL',
    'FAILED_DEPENDENT_LIMB_REMAINS_REVIEW_ONLY',
  ]);
  const scenario = buildScenario(stateById.get('linked-normal-and-review-only'));
  assert.equal(validateScenario(scenario).status, definition.expected_result);
  assert.equal(scenario.analysis.dispositions.length, 1);
  assert.deepEqual(scenario.analysis.rules.map(
    (rule) => rule.validation.output_disposition,
  ).sort(), ['NORMAL', 'REVIEW_ONLY']);
  assert.equal(scenario.analysis.dispositions[0].output_disposition, 'REVIEW_ONLY');
});

test(publicById.get('family-corrections-cover-every-changed-prior-family').case_id, () => {
  const definition = publicById.get('family-corrections-cover-every-changed-prior-family');
  assert.deepEqual(definition.requirements, [
    'ONE_CORRECTION_PER_CHANGED_RULE',
    'OLD_AND_NEW_FAMILY_DIFFER',
    'SOURCE_SUPPORT_BOUND',
    'BEN_RULING_BOUND',
  ]);
  const scenario = buildScenario(topologyById.get('item-6-intent-knowledge-causation'));
  assert.equal(validateScenario(scenario).status, definition.expected_result);
  assert.equal(scenario.analysis.family_corrections.length, scenario.analysis.rules.length);
  for (const correction of scenario.analysis.family_corrections) {
    assert.notEqual(correction.old_family_key, correction.new_family_key);
    assert.equal(correction.source_support_ids.every((spanId) =>
      scenario.analysis.source_closures[0].spans.some((span) => span.span_id === spanId)), true);
    assert.equal(PROGRAMME_RULING_BY_FAMILY.get(correction.new_family_key),
      correction.lawyer_ruling_id);
  }
});

test(publicById.get('no-output-is-classified-after-all-family-evaluation').case_id, () => {
  const definition = publicById.get('no-output-is-classified-after-all-family-evaluation');
  assert.deepEqual(definition.requirements, [
    'ONE_EXACT_NO_OUTPUT_RECORD_PER_GOVERNED_OCCURRENCE',
    'ALL_FAMILY_CANDIDATE_SET_INSPECTED',
    'COMPATIBLE_CROSS_FAMILY_NORMAL_RULE_NOT_SUPPRESSED',
    'NO_OUTPUT_DOES_NOT_BECOME_NO_COMPARISON',
  ]);
  const noOutput = buildScenario(stateById.get('ben-approved-no-output'));
  const crossFamily = buildScenario(
    stateById.get('no-output-does-not-suppress-cross-family-normal'),
  );
  assert.equal(validateScenario(noOutput).status, definition.expected_result);
  assert.equal(validateScenario(crossFamily).status, definition.expected_result);
  assert.equal(noOutput.analysis.dispositions.length,
    noOutput.analysis.governed_input_occurrence_ids.length);
  assert.equal(noOutput.analysis.dispositions[0].all_family_profile_results.length, 25);
  assert.equal(noOutput.analysis.candidate_sets[0].considered_family_keys.length, 25);
  assert.equal(noOutput.analysis.dispositions[0].output_disposition, 'NO_OUTPUT');
  assert.equal(noOutput.analysis.dispositions[0].no_comparison_authorities.length, 0);
  assert.equal(crossFamily.analysis.rules[0].validation.output_disposition, 'NORMAL');
  assert.equal(crossFamily.analysis.dispositions[0].output_disposition, 'NORMAL');
});

test(publicById.get('near-duplicate-clauses-have-comparable-signatures').case_id, () => {
  const definition = publicById.get('near-duplicate-clauses-have-comparable-signatures');
  assert.deepEqual(definition.sample_ordinals, [11, 30, 33, 34, 35, 36]);
  assert.deepEqual(definition.requirements, [
    'SOURCE_SPECIFIC_PROOF_RETAINED',
    'SEVEN_SLOT_EQUIVALENCE_SIGNATURE_DERIVED',
    'COMPARABLE_TOPOLOGY_FOR_EQUIVALENT_LEGAL_RULES',
  ]);
  const scenarios = definition.sample_ordinals.map((ordinal) => {
    const topology = executableTopologyCases.find(
      (entry) => entry.sample_ordinals.includes(ordinal),
    );
    return buildScenario({
      ...topology,
      case_id: `${topology.case_id}:sample-${ordinal}`,
      sample_ordinals: [ordinal],
    });
  });
  for (const scenario of scenarios) {
    assert.equal(validateScenario(scenario).status, definition.expected_result);
    for (const rule of scenario.analysis.rules) {
      assert.deepEqual(Object.keys(rule.equivalence_signature), EQUIVALENCE_SLOTS);
      assert.equal(rule.fact_ids.every((factId) => scenario.analysis.facts.find(
        (fact) => fact.fact_id === factId,
      ).source_support_ids.length > 0), true);
    }
  }
  assert.equal(scenarios[0].analysis.rules[0].expression_signature,
    scenarios[1].analysis.rules[0].expression_signature);
  assert.equal(scenarios.slice(2).every((scenario) =>
    scenario.analysis.rules[0].expression_signature
      === scenarios[2].analysis.rules[0].expression_signature), true);
  assert.equal(new Set(scenarios.map(
    (scenario) => scenario.analysis.source_closures[0].source_closure_id,
  )).size, scenarios.length);
});

test(publicById.get('projection-renders-every-display-required-material-fact').case_id, () => {
  const definition = publicById.get('projection-renders-every-display-required-material-fact');
  assert.deepEqual(definition.requirements, [
    'FULL_ANALYSIS_VALIDATION_RESULT_BOUND',
    'DISPLAY_REQUIRED_AND_MATERIAL_FACTS_RENDERED',
    'DISPLAY_OPTIONAL_OMISSIONS_AUTHORISED',
    'COMPACT_AND_EXPANDED_LAYOUTS_RECONCILE_INDEPENDENTLY',
    'CLASSIFICATION_FLOOR_PRESENT',
  ]);
  const scenario = buildScenario(cases.baseline_case, {
    displayFactMode: 'DISPLAY_OPTIONAL_NON_MATERIAL',
    omitDisplayOptional: true,
    profileDimensionEvidence: 'CONDITIONAL',
  });
  const validation = validateScenario(scenario);
  const projection = buildProjection(scenario, validation);
  assert.equal(validateProjectionV2({
    projection, analysis: scenario.analysis, viewPolicy: scenario.viewPolicy.record,
  }).status, definition.expected_result);
  const rule = scenario.analysis.rules[0];
  const requiredFactIds = rule.fact_ids.filter((factId) => {
    const fact = scenario.analysis.facts.find((entry) => entry.fact_id === factId);
    return fact.display_rule === 'DISPLAY_REQUIRED' || fact.materiality === 'MATERIAL';
  }).sort();
  for (const layout of projection.rows[0].layouts) {
    assert.deepEqual(layout.render_bindings.map((entry) => entry.fact_id).sort(),
      requiredFactIds);
    assert.equal(layout.omission_ledger.length, 1);
    const omittedFact = scenario.analysis.facts.find(
      (fact) => fact.fact_id === layout.omission_ledger[0].fact_id,
    );
    assert.equal(omittedFact.display_rule, 'DISPLAY_OPTIONAL');
    assert.equal(omittedFact.materiality, 'NON_MATERIAL');
    assert.deepEqual(layout.classification_levels.map((entry) => entry.level),
      ['APPLIES_TO', 'PROVISION_TYPE']);
  }
  assert.deepEqual(projection.analysis_validation, validation);
});

test(publicById.get('projection-is-deterministic-without-raw-source').case_id, () => {
  const definition = publicById.get('projection-is-deterministic-without-raw-source');
  assert.deepEqual(definition.requirements, [
    'SAME_ANALYSIS_AND_VIEW_POLICY_BYTE_IDENTICAL_OUTPUT',
    'NO_RAW_SOURCE_INPUT',
    'RENDER_BINDINGS_RECOMPUTED',
    'SOURCE_LIMITATION_TEXT_AND_RULING_PRESERVED',
  ]);
  const scenario = buildScenario(stateById.get('source-limited-approved-row'));
  const validation = validateScenario(scenario);
  const first = buildProjection(scenario, validation);
  const second = buildProjection(scenario, validation);
  assert.deepEqual(first, second);
  assert.equal(Object.hasOwn(first, 'raw_source'), false);
  assert.equal(validateProjectionV2({
    projection: first, analysis: scenario.analysis, viewPolicy: scenario.viewPolicy.record,
  }).status, definition.expected_result);
  assert.equal(first.rows[0].source_limitation.text,
    'Not expressly stated in the complete reviewed clause');
  assert.deepEqual(first.rows[0].source_limitation.lawyer_ruling_ids,
    scenario.analysis.dispositions[0].absence_proofs.map(
      (proof) => proof.lawyer_ruling_id,
    ).filter((value, index, array) => array.indexOf(value) === index).sort());
});

test('candidate verifier public case is routed to the independent registration test', () => {
  const definition = publicById.get('candidate-registration-is-fully-verified-and-continuous');
  assert.equal(definition.public_seam, 'verifyRegisteredCandidate');
  assert.equal(definition.expected_result, 'PASS');
  assert.deepEqual(definition.requirements, [
    'SIX_INPUT_BINDINGS_RECOMPUTED',
    'EXACT_25_SUBTYPE_TREES',
    'VIEW_POLICY_BOUND',
    'PREDECESSOR_RECEIPTS_PASS',
    'CANDIDATE_ID_CONTINUITY',
  ]);
});

function assertImmutableSampleOrdinals(definition) {
  if (definition.sample_ordinals === undefined) return;
  const fixed = JSON.parse(readFileSync(join(REPO_ROOT, FIXED_SAMPLE_PATH), 'utf8'));
  const baseline = JSON.parse(readFileSync(join(REPO_ROOT, BASELINE_PATH), 'utf8'));
  const packet = JSON.parse(readFileSync(join(REPO_ROOT, REVIEW_PACKET_PATH), 'utf8'));
  const byOrdinal = new Map(fixed.members.map((entry) => [entry.sample_ordinal, entry]));
  const baselineByOrdinal = new Map(
    baseline.entries.map((entry) => [entry.sample_ordinal, entry]),
  );
  const packetByOrdinal = new Map(packet.items.map((entry) => [entry.sample_ordinal, entry]));
  for (const ordinal of definition.sample_ordinals) {
    const member = byOrdinal.get(ordinal);
    const baselineEntry = baselineByOrdinal.get(ordinal);
    const packetItem = packetByOrdinal.get(ordinal);
    assert.ok(member, `${definition.case_id} has no immutable Work0 member ${ordinal}`);
    assert.ok(baselineEntry && packetItem,
      `${definition.case_id} has no complete Work0 authority chain for ${ordinal}`);
    assert.equal(member.review_item_id.length, 64);
    assert.equal(member.source_spans.length > 0, true);
    if (Array.isArray(definition.effects)
        && definition.effects.length > 0 && member.family_key !== null) {
      assert.equal(definition.effects.some((effect) => effect.family_key === member.family_key),
        true);
    }
    if (definition.work0_authority !== undefined) {
      const authority = definition.work0_authority;
      assert.equal(member.review_item_id, authority.review_item_id);
      assert.equal(member.agreement_id, authority.agreement_id);
      assert.equal(member.family_key, authority.family_key);
      assert.equal(member.source_kind, authority.source_kind);
      assert.equal(member.item_kind, authority.item_kind);
      assert.equal(baselineEntry.review_item_id, authority.review_item_id);
      assert.equal(baselineEntry.lawyer_decision_id, authority.lawyer_decision_id);
      assert.equal(baselineEntry.reviewer, authority.reviewer);
      assert.equal(packetItem.review_item_id, authority.review_item_id);
      assert.equal(packetItem.agreement_id, authority.agreement_id);
      assert.equal(packetItem.family_key, authority.family_key);
      assert.equal(packetItem.source_kind, authority.source_kind);
      assert.equal(packetItem.item_kind, authority.item_kind);
      if (authority.source_reference !== undefined) {
        assert.equal(packetItem.section_reference, authority.source_reference);
      }
    }
  }
}

function assertScopeRequirement(requirement, definition, scenario) {
  const signatures = scenario.analysis.rules.map((rule) => rule.expression_signature);
  const joined = signatures.join('\n');
  if (requirement === 'FAILURE_TO_CURE_SCOPES_TO_INTENTIONAL_OMISSION') {
    assert.equal(joined.includes('INTENTIONALLY_OMITTED_ACT_WITH_STATED_FAILURE_TO_CURE_SCOPE'),
      true);
  } else if (requirement === 'KNOWLEDGE_ANY_OF_SCOPES_OVER_CAUSATION_ANY_OF') {
    assert.equal(joined.includes(
      'ALL_OF(ANY_OF(KNOWS,REASONABLY_SHOULD_HAVE_KNOWN),ANY_OF(WOULD_CAUSE,WOULD_REASONABLY_BE_EXPECTED_TO_CAUSE))',
    ), true);
  } else if (requirement === 'PRIORITY_SCOPES_ONLY_TO_SECOND_EFFECT') {
    assert.equal(signatures.some((signature) =>
      signature === 'OVERRIDES(NOT(SECOND_EFFECT),NOT(PRIORITY_RULE))'), true);
  } else if (requirement === 'EXTENSION_SCOPE_BINDS_ONLY_EXTENSION_EFFECT') {
    assert.equal(signatures.some((signature) =>
      signature === 'TO_EXTENT(EXTENSION_EFFECT,EXTENSION_SCOPE)'), true);
  } else if (requirement === 'DEEMING_APPLIES_ONLY_IF_CONDITION_PASSES') {
    assert.equal(joined.startsWith('IF_THEN(CONDITION,'), true);
  } else if (requirement === 'CONSEQUENCE_MODIFIES_DEEMED_STATE') {
    assert.equal(joined.includes(
      'CONSEQUENCE_MODIFIER(DEEMS_AS(SOURCE_STATE,DEEMED_STATE),LEGAL_CONSEQUENCE)'), true);
  } else if (requirement === 'ONLY_INCREMENTAL_EFFECT_RETURNS') {
    assert.equal(joined.includes(
      'TO_EXTENT(EXCEPTION_TO(BASE_EXCLUSION,DISPROPORTIONATE_EFFECT),INCREMENTAL_DISPROPORTIONATE_SCOPE)'), true);
  } else if (requirement === 'GAAP_EXPRESSLY_INCLUDED'
      || requirement === 'LAW_EXPRESSLY_INCLUDED'
      || requirement === 'PEER_COMPARATOR_EXPRESSLY_INCLUDED'
      || requirement === 'DISPROPORTIONATE_EFFECT_EXCEPTION_EXPRESSLY_INCLUDED'
      || requirement === 'INCREMENTAL_EFFECT_CONSEQUENCE_EXPRESSLY_INCLUDED') {
    const fieldKey = requirement.replace(/_EXPRESSLY_INCLUDED$/u, '');
    assert.equal(scenario.analysis.facts.some((fact) => fact.field_key === fieldKey), true);
  } else if (requirement === 'PARTIAL_EXCEPTION_DOES_NOT_ESCAPE_EXACT_SCOPE') {
    assert.equal(joined,
      'CONSEQUENCE_MODIFIER(TO_EXTENT(EXCEPTION_TO(BASE_RULE,PARTIAL_EXCEPTION),EXACT_EXCEPTION_SCOPE),LIMITED_CONSEQUENCE)');
  } else if (requirement === 'PRESERVE_SOURCE_SCOPE_BEFORE_COMPARISON') {
    assert.equal(scenario.analysis.rules.every((rule) =>
      rule.source_closure_id === scenario.analysis.source_closures[0].source_closure_id), true);
  } else if (requirement === 'ITEM28_DISTINCT_DURATION_BOUNDS_AND_SOURCE_ANCHORS') {
    const rights = scenario.analysis.facts.find(
      (fact) => fact.field_key === 'RIGHTS_SURVIVAL_DURATION',
    );
    const noAdverse = scenario.analysis.facts.find(
      (fact) => fact.field_key === 'NO_ADVERSE_AMENDMENT_DURATION',
    );
    assert.ok(rights && noAdverse);
    assert.deepEqual(rights.typed_value, { bound_type: 'AT_LEAST', count: 6, unit: 'YEAR' });
    assert.deepEqual(noAdverse.typed_value, { bound_type: 'EXACT', count: 6, unit: 'YEAR' });
    assert.equal(rights.legal_effect_role, 'RIGHTS_SURVIVAL_PERIOD');
    assert.equal(noAdverse.legal_effect_role,
      'NO_ADVERSE_AMENDMENT_PROTECTION_PERIOD');
    assert.equal(rights.temporal_scope_signature,
      'FROM_OPCO_MERGER_EFFECTIVE_TIME_AT_LEAST_SIX_YEARS');
    assert.equal(noAdverse.temporal_scope_signature,
      'FOLLOWING_OPCO_MERGER_EFFECTIVE_TIME_EXACTLY_SIX_YEARS');
    assert.notDeepEqual(rights.typed_value, noAdverse.typed_value);
    assert.notDeepEqual(rights.source_support_ids, noAdverse.source_support_ids);
    const sourceTextFor = (fact) => fact.source_support_ids.map((spanId) =>
      scenario.source.segments.find((segment) => segment.span.span_id === spanId).text).join('');
    assert.equal(sourceTextFor(rights), 'not less than six (6) years');
    assert.equal(sourceTextFor(noAdverse), 'six (6) years');
    assert.equal(scenario.source.sourceText.includes(
      'not less than six (6) years from the OpCo Merger Effective Time'), true);
    assert.equal(scenario.source.sourceText.includes(
      'for a period of six (6) years following the OpCo Merger Effective Time'), true);
    assert.equal(scenario.analysis.source_closures[0].source_node_occurrence_id,
      '717b78ef0bd7b4f18a66f142e1213676c2ebc557e5d91811d348fe0ac9e47dc2');
  } else if (requirement === 'LINKED_RULES_SHARE_OCCURRENCE_BUT_NOT_FACT_OWNERSHIP') {
    const linkedRules = scenario.analysis.rules;
    assert.equal(new Set(linkedRules.map(
      (rule) => rule.input_occurrence_id,
    )).size, 1);
    assert.equal(new Set(linkedRules.map((rule) => rule.effect_id)).size, linkedRules.length);
    assert.deepEqual(scenario.analysis.dispositions[0].rule_ids,
      linkedRules.map((rule) => rule.rule_id));
    assert.equal(linkedRules.every((rule) => rule.child_rule_ids.length === 0), true);
    const factIds = linkedRules.flatMap((rule) => rule.fact_ids);
    assert.equal(new Set(factIds).size, factIds.length);
    const durationOwners = scenario.analysis.facts.filter(
      (fact) => ['RIGHTS_SURVIVAL_DURATION', 'NO_ADVERSE_AMENDMENT_DURATION']
        .includes(fact.field_key),
    ).map((fact) => fact.owner_rule_id);
    assert.equal(durationOwners.length, 2);
    assert.equal(new Set(durationOwners).size, 2);
  } else if (requirement === 'NO_SHARED_FACT_COVERAGE') {
    assert.deepEqual(scenario.analysis.shared_fact_coverages, []);
  } else if (requirement === 'ITEM42_EXACT_SHARED_DURATION_AUTHORITY') {
    assert.equal(scenario.analysis.shared_fact_coverages.length, 1);
    const shared = scenario.analysis.shared_fact_coverages[0];
    assert.deepEqual(Object.keys(shared), [
      'schema_version', 'shared_fact_coverage_id', 'input_occurrence_id',
      'source_closure_id', 'span_id', 'fact_ids', 'lawyer_decision_id', 'reason_code',
    ]);
    assert.equal(shared.schema_version, 'STAGE_2Y_M7_V2_SHARED_FACT_COVERAGE/V1');
    assert.equal(shared.lawyer_decision_id,
      'd44da4450537479614de70175996b16a86495de989d1795ed4c01b7cba24412e');
    assert.equal(shared.reason_code, 'SAME_SOURCE_DISTINCT_LEGAL_EFFECT_ROLE');
    const sharedFacts = shared.fact_ids.map(
      (factId) => scenario.analysis.facts.find((fact) => fact.fact_id === factId),
    );
    assert.deepEqual(sharedFacts.map((fact) => fact.field_key).sort(),
      ['NO_ADVERSE_AMENDMENT_DURATION', 'RIGHTS_SURVIVAL_DURATION']);
    assert.equal(sharedFacts.every((fact) =>
      fact.source_support_ids.length === 1
      && fact.source_support_ids[0] === shared.span_id), true);
    assert.equal(scenario.source.segments.find(
      (segment) => segment.span.span_id === shared.span_id,
    ).text, 'six (6) years');
    assert.deepEqual(sharedFacts.map((fact) => fact.legal_effect_role).sort(),
      ['NO_ADVERSE_AMENDMENT_PROTECTION_PERIOD', 'RIGHTS_SURVIVAL_PERIOD']);
    assert.equal(sharedFacts.every((fact) =>
      fact.temporal_scope_signature === 'FROM_EFFECTIVE_TIME_FOR_SIX_YEARS'), true);
    const ruleUses = scenario.analysis.authored_unit_effect_ledgers[0].entries.flatMap(
      (entry) => entry.treatments.filter((treatment) =>
        treatment.treatment_kind === 'RULE'
        && treatment.source_span_ids.includes(shared.span_id)),
    );
    assert.equal(ruleUses.length, 2);
    assert.equal(new Set(ruleUses.map((entry) => entry.target_id)).size, 2);
    assert.deepEqual(scenario.analysis.coverage_partitions[0].entries.find(
      (entry) => entry.span_id === shared.span_id,
    ), {
      span_id: shared.span_id,
      treatment_kind: 'SHARED_FACT',
      owner_id: shared.shared_fact_coverage_id,
      reason_code: 'SAME_SOURCE_DISTINCT_LEGAL_EFFECT_ROLE',
      authority_id:
        'd44da4450537479614de70175996b16a86495de989d1795ed4c01b7cba24412e',
      materiality: 'MATERIAL',
    });
    const directSharedRules = scenario.analysis.rules.filter(
      (rule) => ['RIGHTS_SURVIVAL', 'NO_ADVERSE_AMENDMENT']
        .includes(rule.subtype_path.at(-1)),
    );
    assert.deepEqual(scenario.analysis.profile_snapshots.filter(
      (profile) => profile.shared_source_lawyer_decision_ids.includes(
        'd44da4450537479614de70175996b16a86495de989d1795ed4c01b7cba24412e',
      ),
    ).map((profile) => profile.profile_id).sort(),
    directSharedRules.map((rule) => rule.profile_id).sort());
    assert.equal(scenario.analysis.counts.shared_fact_coverages, 1);
    assert.equal(scenario.analysis.agreement_id,
      'f4a123d7c2bd8ba6358499dd9870513c8bac6a6893985bf5a581a536af280d71');
    assert.equal(scenario.analysis.source_closures[0].source_node_occurrence_id,
      '005e1651ed5ba5f031509229658f4e9682d95f1b59ce894bfb4f319388ad9ad4');
    const technicalSpanIds = new Set(scenario.analysis.coverage_partitions[0].entries.filter(
      (entry) => entry.treatment_kind === 'STRUCTURAL_TEXT',
    ).map((entry) => entry.span_id));
    assert.equal(technicalSpanIds.size > 0, true);
    assert.equal(scenario.analysis.candidate_sets[0].effects.every((effect) =>
      effect.source_span_ids.every((spanId) => !technicalSpanIds.has(spanId))), true);
    assert.equal(scenario.analysis.authored_unit_effect_ledgers[0].entries.every((entry) =>
      entry.source_span_ids.every((spanId) => !technicalSpanIds.has(spanId))), true);
  } else if (requirement === 'CLAIM_CONTINUATION_DEICTIC_REFERENCE_OWNS_RIGHTS_DURATION') {
    const claimRule = scenario.analysis.rules.find(
      (rule) => rule.subtype_path.at(-1) === 'CLAIM_CONTINUATION',
    );
    const link = scenario.analysis.ownership_links.find(
      (entry) => entry.consumer_rule_id === claimRule?.rule_id,
    );
    const ownerFact = scenario.analysis.facts.find(
      (fact) => fact.fact_id === link?.owner_fact_id,
    );
    const dependency = scenario.analysis.dependencies.find(
      (entry) => link?.consumer_dependency_ids.includes(entry.dependency_id),
    );
    assert.ok(claimRule && link && ownerFact && dependency);
    assert.equal(ownerFact.field_key, 'RIGHTS_SURVIVAL_DURATION');
    assert.equal(dependency.dependency_type, 'DURATION_CONDITION_REFERENCE');
    assert.equal(dependency.target_id, ownerFact.semantic_fact_key);
    assert.equal(link.resolved_owner_target_id, ownerFact.semantic_fact_key);
    const claimProfile = scenario.analysis.profile_snapshots.find(
      (profile) => profile.profile_id === claimRule.profile_id,
    );
    const ownerRule = scenario.analysis.rules.find(
      (rule) => rule.rule_id === link.owner_rule_id,
    );
    assert.deepEqual(claimProfile.allowed_dependency_types, [{
      dependency_type: 'DURATION_CONDITION_REFERENCE',
      lawyer_ruling_id: 'M5-RULING-ONE-SEMANTIC-OWNER',
    }]);
    assert.deepEqual(claimProfile.excluded_or_delegated_dimensions.find(
      (entry) => entry.dimension_key === 'CLAIM_CONTINUATION_PERIOD_REFERENCE',
    ), {
      dimension_key: 'CLAIM_CONTINUATION_PERIOD_REFERENCE',
      disposition: 'DELEGATED',
      lawyer_ruling_id: 'M5-RULING-ONE-SEMANTIC-OWNER',
      owner_profile_id: ownerRule.profile_id,
      owner_field_key: 'RIGHTS_SURVIVAL_DURATION',
    });
    assert.equal(scenario.source.sourceText.includes('such six-year period'), true);
    assert.equal(scenario.source.sourceText.includes(
      'shall continue to be subject to this Section 5.7(a) and the rights provided under this Section 5.7(a) until disposition of such claim',
    ), true);
  } else if (requirement === 'CURRENT_WORK1_REMAINS_REVIEW_ONLY_WITHOUT_NORMAL_ROW') {
    assert.equal(scenario.analysis.rules.every(
      (rule) => rule.validation.output_disposition === 'REVIEW_ONLY'), true);
    assert.equal(scenario.analysis.dispositions[0].output_disposition, 'REVIEW_ONLY');
  } else if (requirement === 'SIX_SEPARATE_TYPED_FACTS') {
    const fields = ['ACCESS_OBJECTS', 'ACCESS_PURPOSE', 'NOTICE_REQUIREMENT',
      'BUSINESS_HOURS_TIMING', 'REASONABLENESS', 'NON_INTERFERENCE'];
    assert.equal(fields.every((field) => scenario.analysis.facts.some(
      (fact) => fact.field_key === field,
    )), true);
    const businessHours = scenario.analysis.facts.find(
      (fact) => fact.field_key === 'BUSINESS_HOURS_TIMING',
    );
    assert.deepEqual({
      value_type: businessHours.value_type,
      typed_value: businessHours.typed_value,
      normalisation_rule: businessHours.normalisation_proof.rule_id,
    }, {
      value_type: 'ENUM',
      typed_value: 'NORMAL_BUSINESS_HOURS',
      normalisation_rule: 'ENUM_LITERAL_MAP/V1',
    });
    assert.equal(businessHours.source_support_ids.map((spanId) =>
      scenario.source.segments.find((segment) => segment.span.span_id === spanId).text,
    ).join(''), 'normal business hours');
    assert.equal(scenario.analysis.source_closures[0].source_node_occurrence_id,
      'd011f79aae3c051670469038a679a5c72c80eb96af29cfe4f5d607c1d614aa19');
  } else if (requirement === 'NO_WHOLE_CLAUSE_VALUE') {
    assert.equal(scenario.analysis.facts.every((fact) => fact.source_support_ids.length > 0), true);
    assert.equal(scenario.analysis.facts.every((fact) => {
      const closure = scenario.analysis.source_closures[0];
      const selected = closure.spans.filter((span) => fact.source_support_ids.includes(span.span_id));
      const start = Math.min(...selected.map((span) => span.start_byte));
      const end = Math.max(...selected.map((span) => span.end_byte));
      return end - start <= 256;
    }), true);
  } else {
    assert.fail(`unhandled scope requirement ${requirement} for ${definition.case_id}`);
  }
}

function assertStateRuleLiterals(scenario) {
  const expectedEffects = scenario.definition.effects;
  const rules = scenario.analysis.rules;
  const disposition = scenario.analysis.dispositions[0];
  assert.equal(rules.length, expectedEffects.length);
  assert.deepEqual(rules.map((rule) => rule.family_key),
    expectedEffects.map((effect) => effect.family_key));
  assert.deepEqual(rules.map((rule) => rule.expression_signature),
    expectedEffects.map((effect) => effect.expression_signature));
  assert.deepEqual(rules.map((rule) => rule.validation.output_disposition),
    expectedEffects.map((effect) => effect.output_disposition));
  for (const [index, effect] of expectedEffects.entries()) {
    const rule = rules[index];
    assertOwnedTemporalFields(scenario, effect, rule);
    const reviewOnly = effect.output_disposition === 'REVIEW_ONLY';
    assert.equal(rule.validation.extraction_state,
      reviewOnly ? effect.extraction_state ?? 'INCOMPLETE' : 'COMPLETE');
    assert.equal(rule.validation.source_quality,
      reviewOnly ? effect.source_quality ?? 'SUFFICIENT'
        : effect.output_disposition === 'APPROVED_LIMITED' ? 'SOURCE_LIMITED' : 'SUFFICIENT');
    assert.deepEqual(rule.validation.issue_codes,
      reviewOnly ? [effect.issue_code ?? 'UNPROVED_DEPENDENT_RULE'] : []);
    const dispositionIssues = disposition.issues.filter(
      (issue) => issue.rule_id === rule.rule_id,
    );
    if (reviewOnly) {
      assert.equal(dispositionIssues.length, 1);
      assert.equal(dispositionIssues[0].issue_code,
        effect.issue_code ?? 'UNPROVED_DEPENDENT_RULE');
      assert.equal(dispositionIssues[0].extraction_state, rule.validation.extraction_state);
      assert.equal(dispositionIssues[0].source_quality, rule.validation.source_quality);
    } else {
      assert.equal(dispositionIssues.length, 0);
    }
    const absenceProofs = disposition.absence_proofs.filter(
      (proof) => proof.rule_id === rule.rule_id,
    );
    if (effect.missing_required_field === undefined) {
      assert.equal(absenceProofs.length, 0);
    } else {
      assert.equal(absenceProofs.length, 1);
      assert.equal(absenceProofs[0].field_key, effect.missing_required_field);
      assert.equal(absenceProofs[0].observation_kind, 'SOURCE_NOT_EXPRESSLY_STATED');
      assert.equal(absenceProofs[0].source_closure_id, rule.source_closure_id);
    }
  }
}

function assertOwnedTemporalFields(scenario, effect, rule) {
  const temporalValueTypes = new Set(['DATE', 'DURATION', 'PERIOD', 'REFERENCE', 'ENUM']);
  for (const fieldKey of effect.temporal_fields ?? []) {
    if (fieldKey === 'CLAIM_CONTINUATION_PERIOD_REFERENCE') {
      const link = scenario.analysis.ownership_links.find(
        (entry) => entry.consumer_rule_id === rule.rule_id,
      );
      assert.ok(link,
        `${scenario.definition.case_id} must bind its claim duration owner link`);
      const dependency = scenario.analysis.dependencies.find(
        (entry) => link.consumer_dependency_ids.includes(entry.dependency_id),
      );
      assert.ok(dependency);
      assert.equal(dependency.dependency_type, 'DURATION_CONDITION_REFERENCE');
      assert.equal(dependency.state, 'RESOLVED');
      assert.equal(dependency.target_id, link.resolved_owner_target_id);
      assert.equal(scenario.analysis.facts.some((fact) =>
        fact.owner_rule_id === rule.rule_id
        && fact.field_key === fieldKey), false);
      continue;
    }
    const matches = scenario.analysis.facts.filter((fact) =>
      fact.field_key === fieldKey
      && fact.owner_rule_id === rule.rule_id
      && rule.fact_ids.includes(fact.fact_id));
    assert.equal(matches.length, 1,
      `${scenario.definition.case_id} must bind temporal field ${fieldKey} to its rule`);
    assert.equal(temporalValueTypes.has(matches[0].value_type), true,
      `${scenario.definition.case_id} field ${fieldKey} must have a temporal value type`);
  }
}

for (const definition of executableTopologyCases) {
  test(definition.case_id, () => {
    const scenario = buildScenario(definition);
    const result = validateAnalysisV2({
      analysis: scenario.analysis,
      resolveBinding: scenario.resolveBinding,
    });
    assert.equal(result.status, 'PASS');
    assert.equal(result.counts.rules, definition.expected_rule_count);
    const operators = new Set(scenario.analysis.expressions.map((entry) => entry.operator));
    for (const operator of definition.required_operators) assert.equal(operators.has(operator), true);
    assert.deepEqual(
      scenario.analysis.rules.map((rule) => rule.expression_signature),
      definition.effects.map((effect) => effect.expression_signature),
    );
    assert.deepEqual(
      scenario.analysis.rules.map((rule) => rule.family_key),
      definition.effects.map((effect) => effect.family_key),
    );
    assert.deepEqual(
      scenario.analysis.rules.map((rule) => rule.validation.output_disposition),
      definition.effects.map((effect) => effect.output_disposition),
    );
    for (const [index, effect] of definition.effects.entries()) {
      const rule = scenario.analysis.rules[index];
      assertOwnedTemporalFields(scenario, effect, rule);
      if (effect.subprofile_key !== undefined) {
        assert.equal(rule.subtype_path.at(-1), effect.subprofile_key,
          `${definition.case_id} must bind its declared subprofile as the subtype terminal`);
      }
    }
    assertImmutableSampleOrdinals(definition);
    for (const requirement of definition.scope_requirements) {
      assertScopeRequirement(requirement, definition, scenario);
    }
    if (definition.required_material_field_keys !== undefined) {
      const materialFields = scenario.analysis.facts.filter(
        (fact) => fact.materiality === 'MATERIAL',
      ).map((fact) => fact.field_key);
      assert.equal(definition.required_material_field_keys.every(
        (fieldKey) => materialFields.includes(fieldKey),
      ), true);
    }
    if (definition.required_absence_observations !== undefined) {
      for (const observation of definition.required_absence_observations) {
        assert.equal(observation.reason_code, 'SOURCE_NOT_EXPRESSLY_STATED');
        assert.equal(observation.scope, 'COMPLETE_SOURCE_CLOSURE');
        assert.equal(observation.lawyer_ruling_required, true);
        const profile = scenario.analysis.profile_snapshots.find(
          (entry) => entry.profile_id === scenario.analysis.rules[0].profile_id,
        );
        const excluded = profile.excluded_or_delegated_dimensions.find(
          (entry) => entry.dimension_key === observation.field_key,
        );
        assert.equal(excluded.disposition, 'EXCLUDED');
        assert.equal(profile.legal_authority_ids.includes(excluded.lawyer_ruling_id), true);
      }
    }
    if (definition.expected_normal_row_count !== undefined) {
      const projection = buildProjection(scenario, result);
      const projectionResult = validateProjectionV2({
        projection,
        analysis: scenario.analysis,
        viewPolicy: scenario.viewPolicy.record,
      });
      assert.equal(projectionResult.normal_row_count, definition.expected_normal_row_count);
      assert.equal(projection.rows.length, definition.expected_normal_row_count);
      if (definition.case_id === 'item-28-linked-d-and-o-rights-survival') {
        const facts = new Map(scenario.analysis.facts.map(
          (fact) => [fact.fact_id, fact],
        ));
        const rowForSubtype = (subtype) => {
          const rule = scenario.analysis.rules.find(
            (entry) => entry.subtype_path.at(-1) === subtype,
          );
          assert.ok(rule);
          const row = projection.rows.find((entry) => entry.rule_id === rule.rule_id);
          assert.ok(row);
          return { rule, row };
        };
        const rights = rowForSubtype('RIGHTS_SURVIVAL');
        const noAdverse = rowForSubtype('NO_ADVERSE_AMENDMENT');
        const rightsActor = facts.get(rights.rule.applies_to_fact_ids[0]);
        const noAdverseActor = facts.get(noAdverse.rule.applies_to_fact_ids[0]);
        assert.equal(rightsActor.value_type, 'PARTY_SET');
        assert.deepEqual(rightsActor.typed_value.parties,
          ['SURVIVING_COMPANY', 'SURVIVING_OPCO']);
        assert.equal(noAdverseActor.value_type, 'PARTY');
        assert.equal(noAdverseActor.typed_value, 'INDEMNIFIED_PARTIES');
        assert.equal(rights.row.classification_levels[0].value,
          'SURVIVING_COMPANY; SURVIVING_OPCO');
        assert.equal(noAdverse.row.classification_levels[0].value,
          'INDEMNIFIED_PARTIES');
        const compactBinding = (row, factId) => row.layouts.find(
          (layout) => layout.layout_id === 'compact-v2',
        ).render_bindings.find((binding) => binding.fact_id === factId);
        assert.equal(compactBinding(rights.row, rightsActor.fact_id).rendered_value,
          'SURVIVING_COMPANY; SURVIVING_OPCO');
        assert.equal(compactBinding(noAdverse.row, noAdverseActor.fact_id).rendered_value,
          'INDEMNIFIED_PARTIES');
        assert.equal(scenario.viewPolicy.record.formatters.find(
          (formatter) => formatter.value_type === 'PARTY_SET',
        ).formatter_id, 'party-set-v1');
        assert.equal(scenario.viewPolicy.record.formatters.find(
          (formatter) => formatter.value_type === 'PARTY',
        ).formatter_id, 'string-v1');
      }
    }
  });
}

for (const definition of executableTopologyCases.filter(
  (entry) => entry.work1_absence_assertion_id !== undefined,
)) {
  test(definition.work1_absence_assertion_id, () => {
    const scenario = buildScenario(definition);
    const validation = validateScenario(scenario);
    const projection = buildProjection(scenario, validation);
    const result = validateProjectionV2({
      projection,
      analysis: scenario.analysis,
      viewPolicy: scenario.viewPolicy.record,
    });
    assert.equal(definition.expected_normal_row_count, 0);
    assert.equal(scenario.analysis.rules.every(
      (rule) => rule.validation.output_disposition === 'REVIEW_ONLY'), true);
    assert.equal(projection.rows.length, 0);
    assert.equal(result.normal_row_count, 0);
    assert.equal(result.review_row_count, 1);
  });
}

test('topology convergence groups preserve exact source-specific closure identity', () => {
  const groups = new Map();
  for (const definition of executableTopologyCases.filter(
    (entry) => entry.convergence_group !== undefined,
  )) {
    const selected = groups.get(definition.convergence_group) ?? [];
    selected.push({ definition, scenario: buildScenario(definition) });
    groups.set(definition.convergence_group, selected);
  }
  for (const entries of groups.values()) {
    entries.forEach(({ scenario }) => assert.equal(validateScenario(scenario).status, 'PASS'));
    assert.equal(new Set(entries.map(
      ({ scenario }) => scenario.analysis.rules[0].expression_signature,
    )).size, 1);
    assert.equal(new Set(entries.map(
      ({ scenario }) => scenario.analysis.source_closures[0].source_closure_id,
    )).size, entries.length);
  }
});

for (const definition of executableStateCases) {
  test(definition.case_id, () => {
    const scenario = buildScenario(definition);
    const analysisResult = validateAnalysisV2({
      analysis: scenario.analysis,
      resolveBinding: scenario.resolveBinding,
    });
    assert.equal(analysisResult.status, 'PASS');
    assert.equal(scenario.analysis.dispositions[0].output_disposition,
      definition.expected_summary);
    assertStateRuleLiterals(scenario);
    const projection = buildProjection(scenario, analysisResult);
    const projectionResult = validateProjectionV2({
      projection,
      analysis: scenario.analysis,
      viewPolicy: scenario.viewPolicy.record,
    });
    assert.equal(projectionResult.status, 'PASS');
    if (definition.expected_normal_row_count !== undefined) {
      assert.equal(projectionResult.normal_row_count, definition.expected_normal_row_count);
    }
    if (definition.expected_review_row_count !== undefined) {
      assert.equal(projectionResult.review_row_count, definition.expected_review_row_count);
    }
    if (definition.expected_non_output_count !== undefined) {
      assert.equal(projectionResult.non_output_disposition_count,
        definition.expected_non_output_count);
    }
    if (definition.expected_source_artefact_count !== undefined) {
      assert.equal(scenario.analysis.coverage_partitions[0].entries.filter(
        (entry) => entry.treatment_kind === 'SOURCE_ARTEFACT',
      ).length, definition.expected_source_artefact_count);
    }
    assertImmutableSampleOrdinals(definition);
    if (definition.required_authority === 'BEN_LEGAL_RULING') {
      const rule = scenario.analysis.rules[0];
      const profile = scenario.analysis.profile_snapshots.find(
        (entry) => entry.profile_id === rule.profile_id,
      );
      assert.equal(profile.no_comparison_policy.approver, 'BEN_GOODCHILD');
      assert.equal(rule.validation.no_comparison_authority.lawyer_ruling_id,
        profile.no_comparison_policy.lawyer_ruling_id);
    } else if (definition.required_authority === 'GENERIC_LEVEL_OUTPUT_APPROVED') {
      const authority = scenario.analysis.candidate_sets[0].effects[0]
        .generic_level_output_authority;
      assert.equal(authority.authority_kind, definition.required_authority);
      assert.equal(authority.approver, 'BEN_GOODCHILD');
      assert.equal(authority.covered_input_occurrence_ids.includes(
        scenario.analysis.governed_input_occurrence_ids[0],
      ), true);
    }
    const firstRule = scenario.analysis.rules[0];
    if (firstRule && (definition.required_tree_state !== undefined
        || definition.required_node_state !== undefined)) {
      const profile = scenario.analysis.profile_snapshots.find(
        (entry) => entry.profile_id === firstRule.profile_id,
      );
      const tree = JSON.parse(scenario.resolveBinding(profile.tree_binding).toString('utf8'));
      const node = tree.nodes.find((entry) => entry.profile_key === profile.profile_key);
      if (definition.required_tree_state !== undefined) {
        const expected = definition.required_tree_state === 'TREE_INCOMPLETE'
          ? 'TREE_OUTPUT_INCOMPLETE' : definition.required_tree_state;
        assert.equal(tree.completeness_state, expected);
      }
      if (definition.required_node_state !== undefined) {
        assert.equal(node.node_state, definition.required_node_state);
      }
    }
    if (definition.required_native_evidence === 'AGREEMENT_INDEX_PAGE_MARKER') {
      assert.equal(scenario.source.agreementIndex.source_artefacts.some(
        (entry) => entry.source_artefact_kind === 'PAGE_NUMBER',
      ), true);
    }
    if (definition.expected_model_calls !== undefined) {
      assert.equal(analysisResult.effects.model_calls, definition.expected_model_calls);
    }
  });
}

test('rejects projection-borrows-valid-analysis-result-from-different-object', () => {
  const definition = cases.negative_cases.find(
    (entry) => entry.case_id === 'projection-borrows-valid-analysis-result-from-different-object',
  );
  const first = buildScenario(cases.baseline_case);
  const second = buildScenario({
    ...cases.baseline_case,
    case_id: 'item-2-complete-source-and-expression-second-object',
  });
  const firstResult = validateAnalysisV2({
    analysis: first.analysis,
    resolveBinding: first.resolveBinding,
  });
  const projection = buildProjection(first, firstResult);
  const borrowed = clone(projection);
  borrowed.analysis_validation = validateAnalysisV2({
    analysis: second.analysis,
    resolveBinding: second.resolveBinding,
  });
  restampProjection(borrowed);
  assertCode(() => validateProjectionV2({
    projection: borrowed,
    analysis: first.analysis,
    viewPolicy: first.viewPolicy.record,
  }), definition.expected_code);
  assertCode(() => validateProjectionV2({
    projection,
    analysis: clone(first.analysis),
    viewPolicy: first.viewPolicy.record,
  }), definition.expected_code);
});

const baselineForNegatives = buildScenario(cases.baseline_case);

const item28TemporalDefinition = () => topologyById.get(
  'item-28-linked-d-and-o-rights-survival',
);
const item42TemporalDefinition = () => topologyById.get(
  'item-42-linked-d-and-o-rights-survival',
);
const item44TemporalDefinition = () => topologyById.get(
  'item-44-separate-access-dimensions',
);

const item28TemporalCaseIds = new Set([
  'item-28-at-least-duration-collapsed-to-exact',
]);
const withinTemporalCaseIds = new Set(['duration-within-source-labelled-exact']);
const wordNumeralTemporalCaseIds = new Set([
  'duration-word-parenthetical-number-disagrees',
]);
const item44TemporalCaseIds = new Set([
  'item-44-normal-business-hours-is-a-reference',
  'item-44-normal-business-hours-loses-normal',
  'item-44-normal-business-hours-support-is-truncated',
]);
const temporalBuilderInvalidCaseIds = new Set([
  ...item28TemporalCaseIds,
  ...withinTemporalCaseIds,
  ...item44TemporalCaseIds,
  'duration-bound-type-is-open',
  'duration-word-parenthetical-number-disagrees',
  'duration-count-disagrees-with-source',
  'duration-unit-disagrees-with-source',
  'item-42-deictic-period-parsed-as-direct-duration',
  'item-42-claim-continuation-loses-until-disposition',
  'item-42-rights-profile-lacks-shared-source-ruling',
  'item-42-no-adverse-profile-lacks-shared-source-ruling',
  'item-42-claim-profile-invents-shared-source-ruling',
  'item-42-unrelated-profile-invents-shared-source-ruling',
  'item-42-claim-profile-disallows-duration-reference',
  'item-42-claim-profile-omits-period-delegation',
  'item-42-claim-profile-delegates-period-to-wrong-owner',
  'item-42-claim-profile-delegation-ruling-drift',
  'profile-dimension-evidence-subsets-overlap',
  'profile-dimension-evidence-union-omits-known-key',
  'profile-dimension-evidence-subset-ruling-drift',
  'profile-dimension-evidence-subset-invents-underived-key',
  'profile-dimension-evidence-subset-source-class-drift',
  'focused-immutable-source-binding-drift',
]);

function temporalPositiveScenario(caseId) {
  if (withinTemporalCaseIds.has(caseId)) return buildScenario({
    case_id: 'duration-within-same-source-positive',
    effects: [{
      family_key: 'TERMINATION',
      expression_signature: 'ALL_OF(APPLIES_TO,WITHIN_DURATION)',
      temporal_fields: ['WITHIN_DURATION'],
      output_disposition: 'NORMAL',
    }],
  });
  if (wordNumeralTemporalCaseIds.has(caseId)) return buildScenario({
    case_id: 'duration-word-parenthetical-number-positive',
    effects: [{
      family_key: 'TERMINATION',
      expression_signature: 'ALL_OF(APPLIES_TO,EXACT_DURATION)',
      temporal_fields: ['EXACT_DURATION'],
      output_disposition: 'NORMAL',
    }],
  });
  if (item28TemporalCaseIds.has(caseId)) return buildScenario(item28TemporalDefinition());
  if (item44TemporalCaseIds.has(caseId)) return buildScenario(item44TemporalDefinition());
  return buildScenario(item42TemporalDefinition());
}

function temporalBuilderInvalidScenario(caseId) {
  if (withinTemporalCaseIds.has(caseId)) {
    return buildScenario({
      case_id: 'duration-within-same-source-positive',
      effects: [{
        family_key: 'TERMINATION',
        expression_signature: 'ALL_OF(APPLIES_TO,WITHIN_DURATION)',
        temporal_fields: ['WITHIN_DURATION'],
        output_disposition: 'NORMAL',
      }],
    }, { negativeCaseId: caseId });
  }
  if (wordNumeralTemporalCaseIds.has(caseId)) {
    return buildScenario({
      case_id: 'duration-word-parenthetical-number-positive',
      effects: [{
        family_key: 'TERMINATION',
        expression_signature: 'ALL_OF(APPLIES_TO,EXACT_DURATION)',
        temporal_fields: ['EXACT_DURATION'],
        output_disposition: 'NORMAL',
      }],
    }, { negativeCaseId: caseId });
  }
  const definition = item28TemporalCaseIds.has(caseId) ? item28TemporalDefinition()
    : item44TemporalCaseIds.has(caseId) ? item44TemporalDefinition()
      : item42TemporalDefinition();
  return buildScenario(definition, { negativeCaseId: caseId });
}

const temporalMutationCaseIds = new Set([
  'item-42-shared-fact-record-missing',
  'item-42-shared-fact-record-schema-drift',
  'item-42-shared-fact-record-self-id-drift',
  'item-42-shared-fact-record-occurrence-drift',
  'item-42-shared-fact-record-closure-drift',
  'item-42-shared-fact-record-span-drift',
  'item-42-shared-fact-record-fact-set-drift',
  'item-42-shared-fact-record-lawyer-decision-drift',
  'item-42-shared-fact-record-reason-drift',
  'item-42-shared-duration-has-one-rule-use',
  'item-42-shared-duration-has-third-rule-use',
  'item-42-shared-duration-has-non-rule-use',
  'item-42-shared-duration-two-uses-share-one-rule',
  'item-42-duration-reference-dependency-type-drift',
  'item-42-duration-reference-is-unresolved',
  'item-42-duration-reference-targets-wrong-role',
  'item-42-duration-reference-support-drift',
  'item-42-duration-reference-edge-type-drift',
  'item-42-duration-reference-edge-target-disagrees',
  'item-42-duration-ownership-link-missing',
  'item-42-duration-link-consumer-rule-drift',
  'item-42-duration-link-owner-rule-drift',
  'item-42-duration-link-owner-fact-drift',
  'item-42-duration-link-resolved-target-drift',
  'item-42-duration-link-reference-span-drift',
  'item-42-duration-link-dependency-list-missing',
  'item-42-duration-link-edge-list-missing',
  'item-42-claim-rule-duplicates-owner-duration',
  'item-42-claim-continuation-effect-is-omitted',
  'item-42-claim-continuation-modal-is-absorbed',
  'item-42-claim-continuation-invents-no-output',
  'item-42-work0-ruling-cannot-activate-normal',
  'work0-family-packet-cannot-stand-in-for-ben-approved-profile-set',
  'approved-family-profile-set-is-missing',
]);

const appliesToOrderingCaseIds = new Set([
  'applies-to-fact-ids-duplicate',
  'applies-to-fact-ids-omitted',
  'applies-to-fact-ids-reordered',
]);

function twoActorPositiveScenario() {
  const scenario = buildScenario({
    case_id: 'two-actor-applies-to-source-order-positive',
    effects: [{
      family_key: 'TERMINATION',
      expression_signature: 'ALL_OF(APPLIES_TO,FAMILY_MARKER)',
      temporal_fields: [],
      output_disposition: 'NORMAL',
    }],
  }, { twoActorFacts: true });
  const rule = scenario.analysis.rules[0];
  const actorFacts = rule.fact_ids.map((factId) => scenario.analysis.facts.find(
    (fact) => fact.fact_id === factId,
  )).filter((fact) => fact.field_key === 'APPLIES_TO');
  assert.deepEqual(actorFacts.map((fact) => [fact.value_type, fact.typed_value]), [
    ['PARTY', 'COMPANY'],
    ['PARTY', 'PARENT'],
  ]);
  assert.deepEqual(rule.applies_to_fact_ids, actorFacts.map((fact) => fact.fact_id));
  const sourceBySpanId = new Map(scenario.source.segments.map(
    (segment) => [segment.span.span_id, segment.text],
  ));
  assert.deepEqual(actorFacts.map(
    (fact) => fact.source_support_ids.map((spanId) => sourceBySpanId.get(spanId)).join(''),
  ), ['Company', 'Parent']);
  assert.equal(scenario.source.segments.some(
    (segment) => segment.kind === 'EXPRESSION' && segment.text === ' and ',
  ), true);
  assert.deepEqual(scenario.source.contextEdges.filter(
    (edge) => ['edge-two-actor-company-0', 'edge-two-actor-parent-0'].includes(edge.edge_id),
  ).map((edge) => [edge.edge_type, edge.target_id]), [
    ['PARTY_ALIAS', 'COMPANY'],
    ['PARTY_ALIAS', 'PARENT'],
  ]);
  const profile = scenario.analysis.profile_snapshots.find(
    (entry) => entry.profile_id === rule.profile_id,
  );
  const actorRequirement = profile.required_fields.find(
    (requirement) => requirement.field_key === 'APPLIES_TO',
  );
  assert.ok(actorRequirement);
  assert.equal(actorRequirement.value_type, 'PARTY');
  assert.equal(actorRequirement.cardinality, 'ONE_OR_MORE');
  return scenario;
}

function appliesToOrderingMutation(scenario, caseId) {
  const analysis = clone(scenario.analysis);
  const rule = analysis.rules[0];
  assert.equal(rule.applies_to_fact_ids.length, 2);
  const [companyFactId, parentFactId] = rule.applies_to_fact_ids;
  if (caseId === 'applies-to-fact-ids-duplicate') {
    rule.applies_to_fact_ids = [companyFactId, companyFactId, parentFactId];
  } else if (caseId === 'applies-to-fact-ids-omitted') {
    rule.applies_to_fact_ids = [parentFactId];
  } else {
    assert.equal(caseId, 'applies-to-fact-ids-reordered');
    rule.applies_to_fact_ids = [parentFactId, companyFactId];
  }
  return Object.freeze({
    analysis: restampAnalysis(analysis),
    resolveBinding: scenario.resolveBinding,
  });
}

test('active temporal authority and actor-order negative registry is exact', () => {
  const activeCaseIds = new Set([
    ...temporalBuilderInvalidCaseIds,
    ...temporalMutationCaseIds,
    ...appliesToOrderingCaseIds,
  ]);
  assert.equal(activeCaseIds.size, 62);
  assert.equal([...activeCaseIds].every((caseId) => cases.negative_cases.some(
    (entry) => entry.case_id === caseId,
  )), true);
});

function restampOwnershipLink(analysis, link, consumerRule) {
  const oldLinkId = link.link_id;
  const unsigned = { ...link };
  delete unsigned.link_id;
  link.link_id = contentId('AGREEMENT_SEMANTIC_OWNERSHIP_LINK/V2', unsigned);
  consumerRule.consumer_link_ids = consumerRule.consumer_link_ids.map(
    (linkId) => linkId === oldLinkId ? link.link_id : linkId,
  );
}

function item42Rule(analysis, subtype) {
  const rule = analysis.rules.find((entry) => entry.subtype_path.at(-1) === subtype);
  assert.ok(rule, `item42 fixture requires ${subtype} rule`);
  return rule;
}

function omitItem42ClaimContinuation(scenario) {
  const originalDependency = scenario.analysis.dependencies.find(
    (entry) => entry.dependency_type === 'DURATION_CONDITION_REFERENCE',
  );
  assert.ok(originalDependency,
    'claim-continuation omission requires the exact deictic duration dependency');
  const contextMutation = mutateContextCompilationInput(scenario, (record) => {
    const member = record.members.find(
      (entry) => entry.agreement_id === scenario.analysis.agreement_id,
    );
    assert.ok(member);
    const before = member.edges.length;
    member.edges = member.edges.filter(
      (edge) => edge.edge_id !== originalDependency.context_edge_id,
    );
    assert.equal(member.edges.length, before - 1,
      'claim-continuation omission must remove exactly its deictic context edge');
  });
  const analysis = contextMutation.analysis;
  const claim = item42Rule(analysis, 'CLAIM_CONTINUATION');
  const claimEffectId = claim.effect_id;
  const claimRuleId = claim.rule_id;
  const claimProfileId = claim.profile_id;
  const removedFactIds = new Set(claim.fact_ids);
  const expressionById = new Map(
    analysis.expressions.map((expression) => [expression.expression_id, expression]),
  );
  const removedExpressionIds = new Set();
  const collectExpression = (expressionId) => {
    if (removedExpressionIds.has(expressionId)) return;
    const expression = expressionById.get(expressionId);
    assert.ok(expression, 'claim-continuation expression tree is incomplete');
    removedExpressionIds.add(expressionId);
    expression.children.filter((child) => child.kind === 'EXPRESSION').forEach(
      (child) => collectExpression(child.id),
    );
  };
  collectExpression(claim.root_expression_id);
  const removedDependencyIds = new Set(claim.consumer_link_ids.flatMap((linkId) => {
    const link = analysis.ownership_links.find((entry) => entry.link_id === linkId);
    assert.ok(link, 'claim-continuation omission requires its exact ownership link');
    return link.consumer_dependency_ids;
  }));
  assert.deepEqual([...removedDependencyIds], [originalDependency.dependency_id]);

  analysis.dependencies = analysis.dependencies.filter(
    (dependency) => !removedDependencyIds.has(dependency.dependency_id),
  );
  analysis.ownership_links = analysis.ownership_links.filter(
    (link) => link.consumer_rule_id !== claimRuleId,
  );
  analysis.facts = analysis.facts.filter((fact) => !removedFactIds.has(fact.fact_id));
  analysis.expressions = analysis.expressions.filter(
    (expression) => !removedExpressionIds.has(expression.expression_id),
  );
  analysis.rules = analysis.rules.filter((rule) => rule.rule_id !== claimRuleId);

  const closure = analysis.source_closures[0];
  const oldClosureId = closure.source_closure_id;
  closure.required_dependency_ids = closure.required_dependency_ids.filter(
    (dependencyId) => !removedDependencyIds.has(dependencyId),
  );
  restampInline(
    closure, 'STAGE_2Y_M7_V2_REVIEWED_SOURCE_CLOSURE/V1', 'source_closure_id',
  );
  assert.notEqual(closure.source_closure_id, oldClosureId);

  const ruleIdMap = new Map();
  for (const rule of analysis.rules) {
    const oldRuleId = rule.rule_id;
    rule.source_closure_id = closure.source_closure_id;
    rule.child_rule_ids = rule.child_rule_ids.filter((ruleId) => ruleId !== claimRuleId);
    rule.rule_id = contentId('AGREEMENT_LEGAL_RULE/V2', {
      agreement_id: analysis.agreement_id,
      input_occurrence_id: rule.input_occurrence_id,
      effect_id: rule.effect_id,
      family_key: rule.family_key,
      profile_id: rule.profile_id,
      subtype_path: rule.subtype_path,
      semantic_fact_keys: rule.fact_ids.map((factId) => analysis.facts.find(
        (fact) => fact.fact_id === factId,
      ).semantic_fact_key),
      canonical_expression_signature: rule.expression_signature,
      child_rule_ids: rule.child_rule_ids,
      source_closure_id: rule.source_closure_id,
    });
    ruleIdMap.set(oldRuleId, rule.rule_id);
  }
  for (const fact of analysis.facts) {
    if (ruleIdMap.has(fact.owner_rule_id)) fact.owner_rule_id = ruleIdMap.get(fact.owner_rule_id);
  }

  const candidateSet = analysis.candidate_sets[0];
  candidateSet.source_closure_id = closure.source_closure_id;
  candidateSet.effects = candidateSet.effects.filter(
    (effect) => effect.effect_id !== claimEffectId,
  );
  restampInline(
    candidateSet, 'STAGE_2Y_M7_V2_INSPECTED_CANDIDATE_SET/V1', 'candidate_set_id',
  );

  const ledger = analysis.authored_unit_effect_ledgers[0];
  ledger.source_closure_id = closure.source_closure_id;
  ledger.entries = ledger.entries.filter((entry) => entry.effect_id !== claimEffectId);
  for (const entry of ledger.entries) {
    entry.rule_ids = entry.rule_ids.map((ruleId) => ruleIdMap.get(ruleId) ?? ruleId);
    for (const treatment of entry.treatments) {
      if (treatment.treatment_kind === 'RULE') {
        treatment.target_id = ruleIdMap.get(treatment.target_id) ?? treatment.target_id;
      }
    }
  }
  restampInline(
    ledger, 'STAGE_2Y_M7_V2_AUTHORED_UNIT_EFFECT_LEDGER/V1', 'effect_ledger_id',
  );

  const removedCoverageOwnerIds = new Set([
    ...removedFactIds,
    ...removedExpressionIds,
    ...removedDependencyIds,
  ]);
  const coverage = analysis.coverage_partitions[0];
  coverage.source_closure_id = closure.source_closure_id;
  coverage.entries = coverage.entries.filter(
    (entry) => !removedCoverageOwnerIds.has(entry.owner_id),
  );
  for (const sharedRecord of analysis.shared_fact_coverages) {
    const oldSharedId = sharedRecord.shared_fact_coverage_id;
    sharedRecord.source_closure_id = closure.source_closure_id;
    restampInline(
      sharedRecord, 'STAGE_2Y_M7_V2_SHARED_FACT_COVERAGE/V1',
      'shared_fact_coverage_id',
    );
    const sharedEntry = coverage.entries.find((entry) => entry.owner_id === oldSharedId);
    assert.ok(sharedEntry);
    sharedEntry.owner_id = sharedRecord.shared_fact_coverage_id;
  }

  analysis.family_corrections = analysis.family_corrections.filter(
    (correction) => correction.rule_id !== claimRuleId,
  );
  for (const correction of analysis.family_corrections) {
    correction.rule_id = ruleIdMap.get(correction.rule_id) ?? correction.rule_id;
    const unsigned = { ...correction };
    delete unsigned.correction_id;
    correction.correction_id = contentId(
      'STAGE_2Y_M7_V2_FAMILY_CORRECTION/V1', unsigned,
    );
  }

  const disposition = analysis.dispositions[0];
  disposition.source_closure_id = closure.source_closure_id;
  disposition.source_closure_digest = sha256Hex(canonicalJson(closure));
  disposition.candidate_set_id = candidateSet.candidate_set_id;
  disposition.candidate_set_digest = sha256Hex(canonicalJson(candidateSet));
  disposition.rule_ids = disposition.rule_ids.filter(
    (ruleId) => ruleId !== claimRuleId,
  ).map((ruleId) => ruleIdMap.get(ruleId) ?? ruleId);
  disposition.issues = disposition.issues.filter(
    (issue) => issue.rule_id !== claimRuleId && issue.effect_id !== claimEffectId,
  ).map((issue) => ({
    ...issue,
    rule_id: ruleIdMap.get(issue.rule_id) ?? issue.rule_id,
  }));
  disposition.absence_proofs = disposition.absence_proofs.filter(
    (proof) => proof.rule_id !== claimRuleId,
  ).map((proof) => ({
    ...proof,
    rule_id: ruleIdMap.get(proof.rule_id) ?? proof.rule_id,
    source_closure_id: closure.source_closure_id,
  }));
  disposition.no_comparison_authorities = disposition.no_comparison_authorities.filter(
    (authority) => authority.rule_id !== claimRuleId,
  ).map((authority) => ({
    ...authority,
    rule_id: ruleIdMap.get(authority.rule_id) ?? authority.rule_id,
  }));
  for (const familyResult of disposition.all_family_profile_results) {
    familyResult.matched_profile_ids = familyResult.matched_profile_ids.filter(
      (profileId) => profileId !== claimProfileId,
    );
  }
  disposition.compatible_cross_family_match_count =
    disposition.all_family_profile_results.filter(
      (entry) => entry.family_key !== disposition.prior_family_key,
    ).reduce((count, entry) => count + entry.matched_profile_ids.length, 0);
  restampInline(disposition, 'STAGE_2Y_M7_V2_DISPOSITION/V1', 'disposition_id');

  analysis.counts.rules = analysis.rules.length;
  analysis.counts.facts = analysis.facts.length;
  analysis.counts.expressions = analysis.expressions.length;
  analysis.counts.shared_fact_coverages = analysis.shared_fact_coverages.length;
  return Object.freeze({
    analysis: restampAnalysis(analysis),
    resolveBinding: contextMutation.resolveBinding,
  });
}

function item42Fact(analysis, fieldKey) {
  const fact = analysis.facts.find((entry) => entry.field_key === fieldKey);
  assert.ok(fact, `item42 fixture requires ${fieldKey} fact`);
  return fact;
}

function item42RuleFact(analysis, subtype, fieldKey) {
  const rule = item42Rule(analysis, subtype);
  const fact = analysis.facts.find((entry) =>
    entry.owner_rule_id === rule.rule_id && entry.field_key === fieldKey);
  assert.ok(fact, `item42 ${subtype} fixture requires ${fieldKey} fact`);
  return fact;
}

function item42ClaimModalSupportIds(analysis) {
  const fact = item42RuleFact(analysis, 'CLAIM_CONTINUATION', 'LEGAL_EFFECT');
  assert.equal(fact.source_support_ids.length, 1,
    'item42 Claim modal must have one exact source span');
  const span = analysis.source_closures[0].spans.find(
    (entry) => entry.span_id === fact.source_support_ids[0],
  );
  assert.ok(span, 'item42 Claim modal span is absent from its source closure');
  assert.deepEqual([span.start_byte, span.end_byte], [190621, 190626],
    'item42 Claim modal support must be exact Work0 shall bytes');
  return [...fact.source_support_ids];
}

function mutateCandidateProfileInput(scenario, caseId) {
  const analysis = clone(scenario.analysis);
  const store = new Map([...scenario.store].map(
    ([path, bytes]) => [path, Buffer.from(bytes)],
  ));
  const governanceInputs = analysis.governance.semantic_input_bindings;
  const packetInput = governanceInputs.find(
    (entry) => entry.role === 'APPROVED_FAMILY_PACKET_SET',
  );
  const profileInputIndex = governanceInputs.findIndex(
    (entry) => entry.role === 'APPROVED_FAMILY_PROFILE_SET',
  );
  assert.ok(packetInput && profileInputIndex >= 0,
    `${caseId} requires distinct packet and profile-set inputs`);

  const oldCandidateBinding = analysis.governance.candidate_registration_binding;
  const candidate = JSON.parse(store.get(oldCandidateBinding.path).toString('utf8'));
  const candidatePacketInput = candidate.semantic_input_bindings.find(
    (entry) => entry.input_role === 'APPROVED_FAMILY_PACKET_SET',
  );
  const candidateProfileInputIndex = candidate.semantic_input_bindings.findIndex(
    (entry) => entry.input_role === 'APPROVED_FAMILY_PROFILE_SET',
  );
  assert.ok(candidatePacketInput && candidateProfileInputIndex >= 0);

  if (caseId === 'work0-family-packet-cannot-stand-in-for-ben-approved-profile-set') {
    governanceInputs[profileInputIndex].binding = clone(packetInput.binding);
    analysis.governance.family_profile_set_binding = clone(packetInput.binding);
    candidate.semantic_input_bindings[candidateProfileInputIndex].binding =
      clone(candidatePacketInput.binding);
    candidate.family_profile_set_binding = clone(candidatePacketInput.binding);
    candidate.counts.unique_bound_path_count -= 1;
  } else {
    assert.equal(caseId, 'approved-family-profile-set-is-missing');
    governanceInputs.splice(profileInputIndex, 1);
    candidate.semantic_input_bindings.splice(candidateProfileInputIndex, 1);
    candidate.counts.semantic_input_count = candidate.semantic_input_bindings.length;
  }

  restampBound(
    candidate, 'STAGE_2Y_M7_V2_CANDIDATE_REGISTRATION/V1', 'candidate_registration_id',
  );
  const candidatePath =
    `${MIGRATION_ROOT}/control/m7-v2-repair-candidate-registrations/${candidate.candidate_registration_id}.json`;
  const candidateBinding = addRecord(
    store, candidatePath, candidate, 'candidate_registration_id',
  );
  const verification = analysis.governance.candidate_registration_verification;
  verification.candidate_registration_id = candidate.candidate_registration_id;
  verification.registration_binding = candidateBinding;
  verification.counts = clone(candidate.counts);
  restampBound(
    verification,
    'STAGE_2Y_M7_V2_CANDIDATE_REGISTRATION_VERIFICATION/V1', 'verification_id',
  );
  analysis.governance.candidate_registration_id = candidate.candidate_registration_id;
  analysis.governance.candidate_registration_binding = candidateBinding;
  return { analysis, resolveBinding: makeResolver(store) };
}

function temporalMutationForCase(scenario, caseId) {
  let analysis = clone(scenario.analysis);
  let resolveBinding = scenario.resolveBinding;
  const shared = () => {
    const record = analysis.shared_fact_coverages[0];
    assert.ok(record, `${caseId} requires the shared fact record`);
    return record;
  };
  const updateSharedOwner = (oldId, newId) => {
    const entry = analysis.coverage_partitions[0].entries.find(
      (candidate) => candidate.owner_id === oldId,
    );
    assert.ok(entry);
    entry.owner_id = newId;
  };
  const mutateAndRestampShared = (mutate) => {
    const record = shared();
    const oldId = record.shared_fact_coverage_id;
    mutate(record);
    restampInline(
      record, 'STAGE_2Y_M7_V2_SHARED_FACT_COVERAGE/V1', 'shared_fact_coverage_id',
    );
    updateSharedOwner(oldId, record.shared_fact_coverage_id);
  };
  if (caseId === 'item-42-shared-fact-record-missing') {
    analysis.shared_fact_coverages = [];
    analysis.counts.shared_fact_coverages = 0;
  } else if (caseId === 'item-42-shared-fact-record-schema-drift') {
    shared().schema_version = 'STAGE_2Y_M7_V2_SHARED_FACT_COVERAGE/V2';
  } else if (caseId === 'item-42-shared-fact-record-self-id-drift') {
    shared().shared_fact_coverage_id = 'f'.repeat(64);
  } else if (caseId === 'item-42-shared-fact-record-occurrence-drift') {
    mutateAndRestampShared((record) => { record.input_occurrence_id += ':DRIFT'; });
  } else if (caseId === 'item-42-shared-fact-record-closure-drift') {
    mutateAndRestampShared((record) => { record.source_closure_id = 'f'.repeat(64); });
  } else if (caseId === 'item-42-shared-fact-record-span-drift') {
    const deicticSpanId = analysis.dependencies[0].source_support_ids[0];
    mutateAndRestampShared((record) => { record.span_id = deicticSpanId; });
  } else if (caseId === 'item-42-shared-fact-record-fact-set-drift') {
    mutateAndRestampShared((record) => { record.fact_ids = record.fact_ids.slice(0, 1); });
  } else if (caseId === 'item-42-shared-fact-record-lawyer-decision-drift') {
    mutateAndRestampShared((record) => {
      record.lawyer_decision_id =
        'b7993d5b54e20fb4a66ef27ec9d4906f49a050fba416cba70362972c200d9fff';
    });
  } else if (caseId === 'item-42-shared-fact-record-reason-drift') {
    mutateAndRestampShared((record) => { record.reason_code = 'UNAUTHORISED_SHARED_SOURCE'; });
  } else if (caseId.startsWith('item-42-shared-duration-')) {
    const sharedSpanId = shared().span_id;
    const ledger = analysis.authored_unit_effect_ledgers[0];
    const rights = item42Rule(analysis, 'RIGHTS_SURVIVAL');
    const noAdverse = item42Rule(analysis, 'NO_ADVERSE_AMENDMENT');
    const claim = item42Rule(analysis, 'CLAIM_CONTINUATION');
    const uses = ledger.entries.flatMap((entry) => entry.treatments.filter(
      (treatment) => treatment.treatment_kind === 'RULE'
        && treatment.source_span_ids.includes(sharedSpanId),
    ));
    assert.equal(uses.length, 2);
    if (caseId === 'item-42-shared-duration-has-one-rule-use') {
      uses[1].source_span_ids = uses[1].source_span_ids.filter(
        (spanId) => spanId !== sharedSpanId,
      );
    } else if (caseId === 'item-42-shared-duration-has-third-rule-use') {
      const claimEntry = ledger.entries.find((entry) => entry.rule_ids.includes(claim.rule_id));
      const treatment = claimEntry.treatments.find(
        (entry) => entry.treatment_kind === 'RULE',
      );
      treatment.source_span_ids.push(sharedSpanId);
      const spanOrder = new Map(analysis.source_closures[0].spans.map(
        (span, index) => [span.span_id, index],
      ));
      treatment.source_span_ids.sort(
        (left, right) => spanOrder.get(left) - spanOrder.get(right),
      );
    } else if (caseId === 'item-42-shared-duration-has-non-rule-use') {
      uses[1].treatment_kind = 'EXPRESSION';
      uses[1].target_id = analysis.expressions.find(
        (expression) => expression.expression_id === noAdverse.root_expression_id,
      ).expression_id;
    } else {
      assert.equal(caseId, 'item-42-shared-duration-two-uses-share-one-rule');
      uses[1].target_id = rights.rule_id;
    }
    restampInline(
      ledger, 'STAGE_2Y_M7_V2_AUTHORED_UNIT_EFFECT_LEDGER/V1', 'effect_ledger_id',
    );
  } else if (caseId.startsWith('item-42-duration-reference-')) {
    const dependency = analysis.dependencies[0];
    const contextMutation = new Set([
      'item-42-duration-reference-is-unresolved',
      'item-42-duration-reference-targets-wrong-role',
      'item-42-duration-reference-support-drift',
      'item-42-duration-reference-edge-type-drift',
      'item-42-duration-reference-edge-target-disagrees',
    ]).has(caseId);
    if (contextMutation) {
      const mutated = mutateContextCompilationInput(scenario, (record) => {
        const edge = record.members[0].edges.find(
          (entry) => entry.edge_id === dependency.context_edge_id,
        );
        assert.ok(edge);
        if (caseId === 'item-42-duration-reference-is-unresolved') {
          edge.state = 'UNRESOLVED';
        } else if (caseId === 'item-42-duration-reference-targets-wrong-role') {
          edge.target_id = item42Fact(analysis, 'NO_ADVERSE_AMENDMENT_DURATION')
            .semantic_fact_key;
        } else if (caseId === 'item-42-duration-reference-support-drift') {
          edge.source_support_ids = item42ClaimModalSupportIds(analysis);
        } else if (caseId === 'item-42-duration-reference-edge-type-drift') {
          edge.edge_type = 'REFERENCE_TARGET';
        } else {
          edge.target_id = 'f'.repeat(64);
        }
      });
      analysis = mutated.analysis;
      resolveBinding = mutated.resolveBinding;
    }
    const selected = analysis.dependencies[0];
    if (caseId === 'item-42-duration-reference-dependency-type-drift') {
      selected.dependency_type = 'REFERENCE_TARGET';
    } else if (caseId === 'item-42-duration-reference-is-unresolved') {
      selected.state = 'UNRESOLVED';
    } else if (caseId === 'item-42-duration-reference-targets-wrong-role') {
      selected.target_id = item42Fact(analysis, 'NO_ADVERSE_AMENDMENT_DURATION')
        .semantic_fact_key;
    } else if (caseId === 'item-42-duration-reference-support-drift') {
      selected.source_support_ids = item42ClaimModalSupportIds(analysis);
    }
  } else if (caseId.startsWith('item-42-duration-link-')
      || caseId === 'item-42-duration-ownership-link-missing') {
    const claim = item42Rule(analysis, 'CLAIM_CONTINUATION');
    if (caseId === 'item-42-duration-ownership-link-missing') {
      analysis.ownership_links = [];
      claim.consumer_link_ids = [];
    } else {
      const link = analysis.ownership_links[0];
      const rights = item42Rule(analysis, 'RIGHTS_SURVIVAL');
      const noAdverse = item42Rule(analysis, 'NO_ADVERSE_AMENDMENT');
      const noAdverseFact = item42Fact(analysis, 'NO_ADVERSE_AMENDMENT_DURATION');
      if (caseId === 'item-42-duration-link-consumer-rule-drift') {
        link.consumer_rule_id = noAdverse.rule_id;
      } else if (caseId === 'item-42-duration-link-owner-rule-drift') {
        link.owner_rule_id = noAdverse.rule_id;
      } else if (caseId === 'item-42-duration-link-owner-fact-drift') {
        link.owner_fact_id = noAdverseFact.fact_id;
      } else if (caseId === 'item-42-duration-link-resolved-target-drift') {
        link.resolved_owner_target_id = noAdverseFact.semantic_fact_key;
      } else if (caseId === 'item-42-duration-link-reference-span-drift') {
        link.consumer_reference_span_ids = item42ClaimModalSupportIds(analysis);
      } else if (caseId === 'item-42-duration-link-dependency-list-missing') {
        link.consumer_dependency_ids = [];
      } else {
        assert.equal(caseId, 'item-42-duration-link-edge-list-missing');
        link.consumer_context_edge_ids = [];
      }
      restampOwnershipLink(analysis, link, claim);
      if (caseId === 'item-42-duration-link-reference-span-drift') {
        const claimProfile = analysis.profile_snapshots.find(
          (profile) => profile.profile_id === claim.profile_id,
        );
        assert.ok(claimProfile,
          'duration-link mutation requires the Claim approved profile');
        claim.equivalence_signature = derivedEquivalenceSignature(
          claimProfile,
          claim.expression_signature,
          analysis.facts.filter((fact) => claim.fact_ids.includes(fact.fact_id)),
          {
            ownershipLinks: analysis.ownership_links,
            allFacts: analysis.facts,
            consumerRuleId: claim.rule_id,
          },
        );
        const linkedTiming = claim.equivalence_signature.timing.filter(
          (entry) => entry.kind === 'LINKED_FACT',
        );
        assert.deepEqual(linkedTiming.map((entry) => entry.ownership_link_id), [link.link_id],
          'Claim timing signature must carry the restamped ownership-link ID');
      }
      assert.equal(rights.subtype_path.at(-1), 'RIGHTS_SURVIVAL');
    }
  } else if (caseId === 'item-42-claim-rule-duplicates-owner-duration') {
    const rightsFact = item42Fact(analysis, 'RIGHTS_SURVIVAL_DURATION');
    const claim = item42Rule(analysis, 'CLAIM_CONTINUATION');
    const oldClaimRuleId = claim.rule_id;
    const effect = analysis.candidate_sets[0].effects.find(
      (entry) => entry.effect_id === claim.effect_id,
    );
    const oldEffectId = effect.effect_id;
    effect.fact_ids.push(rightsFact.fact_id);
    effect.source_span_ids = [...new Set([
      ...effect.source_span_ids, ...rightsFact.source_support_ids,
    ])].sort((left, right) => analysis.source_closures[0].spans.find(
      (span) => span.span_id === left,
    ).start_byte - analysis.source_closures[0].spans.find(
      (span) => span.span_id === right,
    ).start_byte);
    restampEffect(effect);
    relinkMutatedEffect(analysis, effect, oldEffectId);
    const mutatedClaim = analysis.rules.find((rule) => rule.effect_id === effect.effect_id);
    const claimLink = analysis.ownership_links.find(
      (link) => link.consumer_rule_id === oldClaimRuleId,
    );
    assert.ok(mutatedClaim && claimLink);
    claimLink.consumer_rule_id = mutatedClaim.rule_id;
    restampOwnershipLink(analysis, claimLink, mutatedClaim);
  } else if (caseId === 'item-42-claim-continuation-effect-is-omitted') {
    return omitItem42ClaimContinuation(scenario);
  } else if (caseId === 'item-42-claim-continuation-modal-is-absorbed') {
    const claim = item42Rule(analysis, 'CLAIM_CONTINUATION');
    const rights = item42Rule(analysis, 'RIGHTS_SURVIVAL');
    const oldRightsRuleId = rights.rule_id;
    const modalFact = analysis.facts.find(
      (fact) => fact.owner_rule_id === claim.rule_id && fact.field_key === 'LEGAL_EFFECT',
    );
    const effect = analysis.candidate_sets[0].effects.find(
      (entry) => entry.effect_id === rights.effect_id,
    );
    const oldEffectId = effect.effect_id;
    effect.fact_ids.push(modalFact.fact_id);
    effect.source_span_ids = [...new Set([
      ...effect.source_span_ids, ...modalFact.source_support_ids,
    ])].sort((left, right) => analysis.source_closures[0].spans.find(
      (span) => span.span_id === left,
    ).start_byte - analysis.source_closures[0].spans.find(
      (span) => span.span_id === right,
    ).start_byte);
    restampEffect(effect);
    relinkMutatedEffect(analysis, effect, oldEffectId);
    const mutatedRights = item42Rule(analysis, 'RIGHTS_SURVIVAL');
    const claimLink = analysis.ownership_links.find(
      (link) => link.owner_rule_id === oldRightsRuleId,
    );
    assert.ok(claimLink,
      'modal absorption must preserve the independent claim duration ownership link');
    claimLink.owner_rule_id = mutatedRights.rule_id;
    restampOwnershipLink(analysis, claimLink, claim);
  } else if (caseId === 'item-42-claim-continuation-invents-no-output'
      || caseId === 'item-42-work0-ruling-cannot-activate-normal') {
    const output = caseId === 'item-42-claim-continuation-invents-no-output'
      ? 'NO_OUTPUT' : 'NORMAL';
    for (const rule of analysis.rules) {
      rule.validation = {
        extraction_state: 'COMPLETE',
        source_quality: 'SUFFICIENT',
        output_disposition: output,
        issue_codes: [],
        no_comparison_authority: null,
      };
    }
    const disposition = analysis.dispositions[0];
    disposition.extraction_state = 'COMPLETE';
    disposition.source_quality = 'SUFFICIENT';
    disposition.output_disposition = output;
    disposition.issues = [];
    disposition.no_output_authority = null;
    restampInline(disposition, 'STAGE_2Y_M7_V2_DISPOSITION/V1', 'disposition_id');
  } else if (caseId === 'work0-family-packet-cannot-stand-in-for-ben-approved-profile-set'
      || caseId === 'approved-family-profile-set-is-missing') {
    ({ analysis, resolveBinding } = mutateCandidateProfileInput(scenario, caseId));
  } else {
    throw new Error(`no temporal mutation is registered for ${caseId}`);
  }
  return Object.freeze({
    analysis: restampAnalysis(analysis),
    resolveBinding,
  });
}

const factOrSourceCaseIds = new Set([
  'whole-clause-hidden-in-enum',
  'normalisation-rule-value-type-mismatch',
  'normalisation-leaves-non-whitespace-bound-byte-unconsumed',
  'party-value-has-two-alias-tokens',
  'party-set-has-one-alias-token',
  'party-set-uses-unapproved-separator',
  'party-alias-edge-support-does-not-equal-token',
  'party-alias-target-is-duplicated',
  'reference-source-contains-two-reference-tokens',
  'reference-edge-has-wrong-edge-type',
  'reference-edge-support-differs-from-fact-support',
  'atomic-fact-absorbs-two-source-values',
  'atomic-fact-absorbs-operative-connective',
  'atomic-fact-absorbs-material-proviso',
  'source-span-byte-drift',
  'native-source-artefact-scope-mismatch',
  'textual-source-artefact-lacks-native-or-ben-authority',
  'operative-preamble-labelled-structural',
  'material-proviso-left-unmodelled',
]);

const projectionCaseIds = new Set([
  'projection-silent-row-omission',
  'projection-source-limitation-drift',
  'projection-disposition-ledger-drift',
  'analysis-projection-lacks-full-validation-result',
  'projection-display-required-fact-is-omitted',
  'projection-material-fact-is-omitted',
  'projection-never-display-fact-is-rendered',
  'projection-render-value-is-truncated',
  'projection-render-label-is-swapped',
  'projection-compact-classification-floor-is-missing',
  'projection-layout-ledgers-do-not-reconcile-independently',
  'v1-row-enters-v2-projection',
  'equivalence-signature-is-forged',
  'unequal-equivalence-signatures-share-group',
]);

const directInvalidScenarioCaseIds = new Set([
  'false-profile-match',
  'near-negative-cannot-match',
  'wrong-family-cannot-match',
  'wrong-subtype-cannot-match',
  'unknown-inline-marker-overlaps-item-39-overlay',
  'item-39-overlay-omits-material-candidate',
  'item-39-overlay-invents-candidate',
  'item-39-overlay-selects-failed-candidate',
  'item-39-overlay-promotes-glued-reference-marker',
  'item-39-overlay-misses-authorised-non-structural-marker',
  'item-39-overlay-node-source-disposition-mismatch',
  'item-39-overlay-first-label-is-not-sequence-start',
  'item-39-overlay-singleton-sequence',
  'ambiguous-repeat-selects-a-candidate',
  'ambiguous-repeat-lacks-two-passing-material-readings',
  'ambiguous-repeat-lacks-native-same-style-restart-proof',
  'profile-set-misses-family-subtype-tree',
  'profile-set-tree-binding-differs-from-candidate',
  'profile-tree-family-key-is-relabeled',
  'profile-dimension-evidence-omits-material-field',
  'profile-dimension-evidence-omits-dependent-field',
  'profile-dimension-evidence-omits-conditional-or-child-rule',
  'generic-abstract-ancestor-emits-normal',
  'generic-incomplete-tree-emits-approved-limited',
  'missing-required-context-edge-produces-normal',
  'item-9-source-limited-with-uninspected-defined-term',
  'wrong-item-6-topology-with-same-leaves',
  'candidate-subtype-tree-binding-drift',
  'candidate-predecessor-receipt-not-pass',
  'fixed-50-identity-binding-drift',
]);

for (const negative of cases.negative_cases.filter(
  (entry) => entry.case_id !== 'projection-borrows-valid-analysis-result-from-different-object',
)) {
  test(`rejects ${negative.case_id}`, () => {
    if (negative.case_id === 'v1-analysis-enters-v2-validation') {
      assertCode(() => validateAnalysisV2({
        analysis: { schema_version: 'AGREEMENT_ANALYSIS/V1' },
        resolveBinding: baselineForNegatives.resolveBinding,
      }), negative.expected_code);
      return;
    }
    if (negative.case_id === 'projection-reads-raw-source') {
      const scenario = buildScenario(cases.baseline_case);
      const validation = validateScenario(scenario);
      const projection = buildProjection(scenario, validation);
      assertCode(() => validateProjectionV2({
        projection,
        analysis: scenario.analysis,
        viewPolicy: scenario.viewPolicy.record,
        rawSource: scenario.source.sourceText,
      }), negative.expected_code);
      return;
    }
    if (temporalBuilderInvalidCaseIds.has(negative.case_id)) {
      const positive = temporalPositiveScenario(negative.case_id);
      assert.equal(validateScenario(positive).status, 'PASS',
        `${negative.case_id} requires its exact temporal positive before mutation`);
      const invalid = temporalBuilderInvalidScenario(negative.case_id);
      assertCode(() => validateScenario(invalid), negative.expected_code);
      return;
    }
    if (appliesToOrderingCaseIds.has(negative.case_id)) {
      const positive = twoActorPositiveScenario();
      assert.equal(validateScenario(positive).status, 'PASS',
        `${negative.case_id} requires its exact two-actor positive before mutation`);
      const mutated = appliesToOrderingMutation(positive, negative.case_id);
      assertCode(() => validateAnalysisV2({
        analysis: mutated.analysis,
        resolveBinding: mutated.resolveBinding,
      }), negative.expected_code);
      return;
    }
    if (temporalMutationCaseIds.has(negative.case_id)) {
      const positive = temporalPositiveScenario(negative.case_id);
      assert.equal(validateScenario(positive).status, 'PASS',
        `${negative.case_id} requires its exact temporal positive before mutation`);
      const mutated = temporalMutationForCase(positive, negative.case_id);
      assertCode(() => validateAnalysisV2({
        analysis: mutated.analysis,
        resolveBinding: mutated.resolveBinding,
      }), negative.expected_code);
      return;
    }
    if (projectionCaseIds.has(negative.case_id)) {
      const scenario = projectionScenarioForNegative(negative.case_id);
      const validation = validateScenario(scenario);
      const projection = buildProjection(scenario, validation);
      if (negative.case_id === 'projection-display-required-fact-is-omitted') {
        const targetId = projection.rows[0].layouts[0].render_bindings[0].fact_id;
        const fact = scenario.analysis.facts.find((entry) => entry.fact_id === targetId);
        assert.equal(fact.display_rule, 'DISPLAY_REQUIRED');
        assert.equal(fact.materiality, 'NON_MATERIAL');
      } else if (negative.case_id === 'projection-material-fact-is-omitted') {
        const targetId = projection.rows[0].layouts[0].render_bindings[0].fact_id;
        assert.equal(scenario.analysis.facts.find(
          (entry) => entry.fact_id === targetId,
        ).materiality, 'MATERIAL');
      } else if (negative.case_id === 'projection-never-display-fact-is-rendered') {
        const targetId = projection.rows[0].layouts[0].omission_ledger[0].fact_id;
        const fact = scenario.analysis.facts.find((entry) => entry.fact_id === targetId);
        assert.equal(fact.display_rule, 'NEVER_DISPLAY');
        assert.equal(fact.materiality, 'NON_MATERIAL');
      } else if (negative.case_id === 'unequal-equivalence-signatures-share-group') {
        assert.equal(scenario.viewPolicy.record.grouping_policy.allowed, true);
        assert.equal(scenario.analysis.rules.every((rule) =>
          scenario.analysis.profile_snapshots.find(
            (profile) => profile.profile_id === rule.profile_id,
          ).grouping_policy.allowed), true);
      }
      assertCode(() => validateProjectionV2({
        projection: projectionMutationForCase(projection, negative.case_id),
        analysis: scenario.analysis,
        viewPolicy: scenario.viewPolicy.record,
      }), negative.expected_code);
      return;
    }
    if (factOrSourceCaseIds.has(negative.case_id)) {
      const sourceScenario = factOrSourceScenarioForCase(negative.case_id);
      assert.equal(validateScenario(sourceScenario).status, 'PASS',
        `${negative.case_id} requires a valid source-first pre-mutation scenario`);
      const mutated = factOrSourceMutationForCase(sourceScenario, negative.case_id);
      assertCode(() => validateAnalysisV2({
        analysis: mutated.analysis,
        resolveBinding: mutated.resolveBinding,
      }), negative.expected_code);
      return;
    }
    if (directInvalidScenarioCaseIds.has(negative.case_id)) {
      const positive = positiveScenarioForDirectInvalidCase(negative.case_id);
      assert.equal(validateScenario(positive).status, 'PASS',
        `${negative.case_id} requires a valid local baseline before its invalid delta`);
      const invalid = scenarioForAnalysisNegative(negative.case_id);
      assertCode(() => validateScenario(invalid), negative.expected_code);
      return;
    }
    const scenario = scenarioForAnalysisNegative(negative.case_id);
    assert.equal(validateScenario(scenario).status, 'PASS',
      `${negative.case_id} requires a valid pre-mutation scenario`);
    const mutated = analysisMutationForCase(scenario, negative.case_id);
    assertCode(() => validateAnalysisV2({
      analysis: mutated,
      resolveBinding: scenario.resolveBinding,
    }), negative.expected_code);
  });
}
