const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('./canonical-bytes');
const {
  FIXTURE_CONTRACT_FINGERPRINT_V10,
  NOTICE_DEFINITION_SCOPE_CLOSURE_V1,
  validateContractBundle,
} = require('./contract-bundle');
const {
  validateQxoNoShopNoticeSourceBindingF6CarrierIdentity,
} = require('./qxo-no-shop-notice-source-binding-f6');
const {
  validateQxoNoShopDefinitionRelationshipsF8CarrierIdentity,
} = require('./qxo-no-shop-definition-relationships-f8');
const {
  validateQxoNoShopNoticeReceiptF10CarrierIdentity,
} = require('./qxo-no-shop-notice-receipt-f10');
const {
  validateQxoNoShopDefinitionControlF11CarrierIdentity,
} = require('./qxo-no-shop-definition-control-f11');

const AUTHORITY_SCOPE =
  'OFFLINE_REVIEWED_QXO_NO_SHOP_DEFINITION_SCOPE_CLOSURE_F13_ONLY';
const DOCUMENT_HASH =
  'abba043018410d718c207e7d7a43c9567166f6a10c4c9a6b4b0c8c7761cd6b9d';
const CANONICAL_TEXT_ID =
  'bcc60682b1914dcd2dc81417399a74d3f2b82451b8b3119af0d6c8c7e7213ce1';
const CANONICAL_TEXT_SHA256 =
  'a87a18e5eede1c30d319ebf1b541f44ab98e34d52c4604dfd0e4b47268a442f8';
const CANONICAL_TEXT_BYTE_LENGTH = 414782;
const SOURCE_CONTEXT_ID =
  '1b20b897f7e3c33570e4b07fc68f2b2e3b641b187eb617de4847c3a1400ecad8';
const PARSER_ENVELOPE_ID =
  'e3e70f0400b5e3cd3702946708aa267fad4c5ac2cc3c0a72209e49a24dfb4c2e';
const PARSER_ENVELOPE_DIGEST =
  'd47574da2a43e3bc82033c40c5fe9fe0275288da2ad6f39576dce1261d87895a';
const F6_SOURCE_ID =
  '3e4e1a71bf89a360b7d712f96ea28ec2d8496868b7321648f9a214d96fcef7de';
const F6_SOURCE_DIGEST =
  '018dc57ded29b913378007f34ec2d7680076af6a321f0c32daef5b8807c9091b';
const F8_RELATIONSHIPS_ID =
  'bdff2e031cd831d158614965ce1eceed30a6dafc9f9e302338318927b96f3027';
const F8_RELATIONSHIPS_DIGEST =
  '9de3339e9299c2daaf79de33996f1a04e3a6d0dcacd2bbf48fa7b2a5f67d5f2a';
const F10_NOTICE_ID =
  '91cad5c903659fb3a27e3f555e47e705449264233476f11cedef8277940d03af';
const F10_NOTICE_DIGEST =
  'a7b25e321961707391a6369049e03c7f128f54dc0635652ceaddbf60f8c91c89';
const F11_CONTROL_ID =
  '2491852ab58a5470086d859684364a0bdba27fb074361893bcf61e9bebca0e1b';
const F11_CONTROL_DIGEST =
  '2bfebe0c54106f827d2f760404bf6f0e946d99d08ac872a29a9030e656e62812';
const NOTICE_OCCURRENCE_ID =
  '5bfba36963af3a1baec65d09a4fa479e21889ab522f66aaca89de348839c7440';
const ROOT_SCOPE = Object.freeze([207783, 208859]);
const AGREEMENT_DECLARATION_CARRIER = Object.freeze([3281, 3337]);
const MAX_CARRIER_BYTES = 256 * 1024;

const INPUT_KEYS = Object.freeze([
  'admitted_parser_proposal_envelope',
  'admitted_source_context',
  'contract_bundle',
  'qxo_no_shop_definition_control_f11',
  'qxo_no_shop_definition_relationships_f8',
  'qxo_no_shop_notice_receipt_f10',
  'qxo_no_shop_notice_source_binding_f6',
]);
const CARRIER_KEYS = Object.freeze([
  'schema_version',
  'authority_scope',
  'contract_binding',
  'source_binding',
  'upstream_bindings',
  'scan_policy',
  'definition_control_scans',
  'blind_candidate_dispositions',
  'evidence_excerpts',
  'source_party_contexts',
  'reached_transitive_definition_graph',
  'root_token_outcomes',
  'definition_body_token_outcomes',
  'definition_occurrences',
  'definition_use_relationships',
  'party_token_outcomes',
  'governance_designation_outcomes',
  'reviewed_terminal_outcomes',
  'blocking_unresolved_outcomes',
  'definition_scope_closure',
  'notice_child_state_projection',
  'status',
  'qxo_no_shop_definition_scope_closure_f13_id',
  'canonical_payload_digest',
]);

const PARTY_CONTEXTS = Object.freeze({
  Company: Object.freeze({
    role: 'COVENANT_OBLIGOR',
    value: 'COMPANY',
    capacity: 'TARGET',
  }),
  Parent: Object.freeze({
    role: 'RIGHT_HOLDER',
    value: 'PARENT',
    capacity: 'ACQUIRER',
  }),
  'Titanium Merger Sub': Object.freeze({
    role: 'TRANSACTION_PARTY',
    value: 'TITANIUM_MERGER_SUB',
    capacity: 'MERGER_SUB',
  }),
  'Forward Merger Sub': Object.freeze({
    role: 'TRANSACTION_PARTY',
    value: 'FORWARD_MERGER_SUB',
    capacity: 'MERGER_SUB',
  }),
});
const PARTY_DECLARATION_CARRIERS = Object.freeze({
  Company: Object.freeze([3677, 3735]),
  Parent: Object.freeze([3380, 3428]),
  'Titanium Merger Sub': Object.freeze([3430, 3543]),
  'Forward Merger Sub': Object.freeze([3545, 3672]),
});
const PARTY_DECLARED_TERMS = Object.freeze({
  Company: Object.freeze([3724, 3731]),
  Parent: Object.freeze([3418, 3424]),
  'Titanium Merger Sub': Object.freeze([3520, 3539]),
  'Forward Merger Sub': Object.freeze([3650, 3668]),
});
const COMPANY_BOARD_DECLARATION = Object.freeze({
  carrier: Object.freeze([5574, 5637]),
  term: Object.freeze([5620, 5633]),
  governed_company: Object.freeze([5604, 5611]),
});

const PARTY_ALLOWED_STARTS = Object.freeze({
  Company: Object.freeze([
    4070, 4088, 4345, 6079,
    207790, 208070, 208103, 208168, 208201,
    212219, 212421, 212512, 212742,
  ]),
  Parent: Object.freeze([
    4150, 4480, 4865, 207886, 208661,
  ]),
  'Titanium Merger Sub': Object.freeze([4017]),
  'Forward Merger Sub': Object.freeze([4382, 4407]),
});

const DEFINITION_SPECS = Object.freeze([
  Object.freeze({
    key: 'GOVERNMENTAL_ENTITY',
    raw_term: 'Governmental Entity',
    declaration: Object.freeze([38483, 38502]),
    body: Object.freeze([38517, 38680]),
    carrier: Object.freeze([38439, 38680]),
    context: Object.freeze([[38460, 38469]]),
  }),
  Object.freeze({
    key: 'PERSON',
    raw_term: 'Person',
    declaration: Object.freeze([38187, 38193]),
    body: Object.freeze([38208, 38438]),
    carrier: Object.freeze([38143, 38438]),
    context: Object.freeze([[38164, 38173]]),
  }),
  Object.freeze({
    key: 'SUBSIDIARY',
    raw_term: 'Subsidiary',
    declaration: Object.freeze([51262, 51272]),
    body: Object.freeze([51283, 51636]),
    carrier: Object.freeze([51259, 51636]),
  }),
  Object.freeze({
    key: 'COMPANY_SHARES',
    raw_term: 'Company Shares',
    declaration: Object.freeze([6095, 6109]),
    body: Object.freeze([6021, 6086]),
    carrier: Object.freeze([6021, 6113]),
  }),
  Object.freeze({
    key: 'PARENT_SHARES',
    raw_term: 'Parent Shares',
    declaration: Object.freeze([4910, 4923]),
    body: Object.freeze([4819, 4901]),
    carrier: Object.freeze([4819, 4927]),
  }),
  Object.freeze({
    key: 'PARENT_SHARE_ISSUANCE',
    raw_term: 'Parent Share Issuance',
    declaration: Object.freeze([4964, 4985]),
    body: Object.freeze([4819, 4955]),
    carrier: Object.freeze([4819, 4989]),
  }),
  Object.freeze({
    key: 'TITANIUM_MERGER',
    raw_term: 'Titanium Merger',
    declaration: Object.freeze([4269, 4284]),
    body: Object.freeze([4017, 4260]),
    carrier: Object.freeze([4017, 4288]),
  }),
  Object.freeze({
    key: 'FORWARD_MERGER',
    raw_term: 'Forward Merger',
    declaration: Object.freeze([4603, 4617]),
    body: Object.freeze([4298, 4594]),
    carrier: Object.freeze([4298, 4620]),
  }),
  Object.freeze({
    key: 'MERGERS',
    raw_term: 'Mergers',
    declaration: Object.freeze([4687, 4694]),
    body: Object.freeze([4626, 4678]),
    carrier: Object.freeze([4626, 4698]),
  }),
  Object.freeze({
    key: 'TRANSACTIONS',
    raw_term: 'Transactions',
    declaration: Object.freeze([5102, 5114]),
    body: Object.freeze([4994, 5093]),
    carrier: Object.freeze([4994, 5118]),
  }),
  Object.freeze({
    key: 'COMPANY_ACQUISITION_PROPOSAL',
    raw_term: 'Company Acquisition Proposal',
    declaration: Object.freeze([211573, 211601]),
    body: Object.freeze([211611, 212793]),
    carrier: Object.freeze([211538, 212793]),
    context: Object.freeze([[211559, 211568]]),
  }),
  Object.freeze({
    key: 'COMPANY_REQUEST',
    raw_term: 'Company Request',
    declaration: Object.freeze([208354, 208369]),
    body: Object.freeze([208020, 208349]),
    carrier: Object.freeze([208020, 208373]),
  }),
]);

const TERM_SPECS = Object.freeze([
  ...DEFINITION_SPECS.map((entry) => Object.freeze({
    raw_form: entry.raw_term,
    definition_key: entry.key,
    kind: 'DEFINITION',
  })),
  Object.freeze({
    raw_form: 'Company Requests',
    definition_key: 'COMPANY_REQUEST',
    kind: 'DEFINITION_PLURAL',
  }),
  Object.freeze({
    raw_form: 'Subsidiaries',
    definition_key: 'SUBSIDIARY',
    kind: 'DEFINITION_PLURAL',
  }),
  Object.freeze({
    raw_form: 'Persons',
    definition_key: 'PERSON',
    kind: 'DEFINITION_PLURAL',
  }),
  ...Object.keys(PARTY_CONTEXTS).map((rawForm) => Object.freeze({
    raw_form: rawForm,
    kind: 'PARTY',
  })),
  Object.freeze({
    raw_form: 'Company Board',
    kind: 'GOVERNANCE',
  }),
  Object.freeze({
    raw_form: 'other transactions contemplated hereby',
    kind: 'REVIEWED_NON_ENUMERABLE_SOURCE_PHRASE',
  }),
  Object.freeze({
    raw_form: 'Governmental Entity',
    definition_key: 'GOVERNMENTAL_ENTITY',
    kind: 'DEFINITION',
  }),
  Object.freeze({
    raw_form: 'Agreement',
    kind: 'SOURCE_DOCUMENT_DESIGNATION',
  }),
  Object.freeze({
    raw_form: 'EBITDA',
    kind: 'REVIEWED_UNDEFINED_SOURCE_PRIMITIVE',
  }),
  Object.freeze({
    raw_form: 'General Corporation Law',
    kind: 'STATUTE_DESIGNATION',
  }),
  Object.freeze({
    raw_form: 'Delaware Limited Liability Company Act',
    kind: 'STATUTE_DESIGNATION',
  }),
  Object.freeze({
    raw_form: 'DLLCA',
    kind: 'STATUTE_DESIGNATION',
  }),
  Object.freeze({
    raw_form: 'DGCL',
    kind: 'STATUTE_DESIGNATION',
  }),
].sort((left, right) => (
  Buffer.byteLength(right.raw_form, 'utf8')
    - Buffer.byteLength(left.raw_form, 'utf8')
)));

const REVIEWED_CONTEXTUAL_BLIND_CANDIDATES = Object.freeze({
  '4211:4216:State': Object.freeze({
    reviewed_reason_code: 'JURISDICTION_CONTEXT_WITHIN_STATUTE_LONG_FORM',
  }),
  '4220:4228:Delaware': Object.freeze({
    reviewed_reason_code: 'JURISDICTION_CONTEXT_WITHIN_STATUTE_LONG_FORM',
  }),
  '38521:38534:United States': Object.freeze({
    reviewed_reason_code:
      'JURISDICTION_CONTEXT_WITHIN_GOVERNMENTAL_ENTITY_DEFINITION',
  }),
});

const EXPECTED_ROOT_SPANS = Object.freeze([
  207790, 207886, 207970, 207988, 208070, 208085, 208103, 208168,
  208183, 208201, 208222, 208321, 208354, 208505, 208541, 208661,
  208683, 208759, 208830,
]);
class QxoNoShopDefinitionScopeClosureF13Error extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'QxoNoShopDefinitionScopeClosureF13Error';
    this.code = code;
  }
}

function fail(code, message) {
  throw new QxoNoShopDefinitionScopeClosureF13Error(code, message);
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}

function exactKeys(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());
}

function sortedUnique(values) {
  return [...new Set(values)].sort();
}

function span(textBuffer, start, end) {
  const identity = {
    schema_version: 'SEMANTIC_SPAN/V1',
    canonical_text_id: CANONICAL_TEXT_ID,
    absolute_start: start,
    absolute_end: end,
  };
  return freeze({
    ...identity,
    semantic_span_id: contentId('SEMANTIC_SPAN/V1', identity),
    exact_bytes_digest: sha256Hex(textBuffer.subarray(start, end)),
  });
}

function evidenceId(exactSpan) {
  return contentId('QXO_NO_SHOP_F13_EVIDENCE_EXCERPT/V1', {
    document_hash: DOCUMENT_HASH,
    exact_source_span: exactSpan,
  });
}

function buildEvidenceExcerpt(exactSpan) {
  const identity = {
    document_hash: DOCUMENT_HASH,
    exact_source_span: exactSpan,
  };
  return freeze({
    schema_version: 'QXO_NO_SHOP_F13_EVIDENCE_EXCERPT/V1',
    evidence_excerpt_id: contentId(
      'QXO_NO_SHOP_F13_EVIDENCE_EXCERPT/V1',
      identity,
    ),
    semantic_span_id: exactSpan.semantic_span_id,
    absolute_start: exactSpan.absolute_start,
    absolute_end: exactSpan.absolute_end,
    exact_bytes_digest: exactSpan.exact_bytes_digest,
  });
}

function rawText(textBuffer, exactSpan) {
  return textBuffer.subarray(
    exactSpan.absolute_start,
    exactSpan.absolute_end,
  ).toString('utf8');
}

function findByteOffsets(textBuffer, rawForm) {
  const needle = Buffer.from(rawForm, 'utf8');
  const offsets = [];
  let cursor = 0;
  while (cursor <= textBuffer.length - needle.length) {
    const found = textBuffer.indexOf(needle, cursor);
    if (found < 0) break;
    offsets.push(found);
    cursor = found + needle.length;
  }
  return offsets;
}

function buildDefinitionControlScans(textBuffer, definitions, f11Control) {
  const f11ScanByKey = new Map(f11Control.definition_control_scans.map(
    (entry) => [entry.definition_key, entry],
  ));
  return definitions.map((definition) => {
    const f11Scan = f11ScanByKey.get(definition.definition_key);
    if (f11Scan) {
      if (f11Scan.conclusion_code !== 'CONTROLLING_DEFINITION_CONFIRMED'
        || f11Scan.competing_declaration_count !== 0) {
        fail(
          'F11_CONTROL_BINDING_DRIFT',
          `${definition.definition_key} is not bound to its F11 control scan`,
        );
      }
      return freeze({
        schema_version: 'QXO_DEFINITION_CONTROL_SCAN_F13/V1',
        definition_key: definition.definition_key,
        selected_definition_occurrence_id:
          definition.definition_occurrence_id,
        predecessor_selected_definition_occurrence_id:
          f11Scan.selected_definition_occurrence_id,
        control_source: 'F11_REVIEWED_CONTROL_SCAN',
        predecessor_scope_closure_id: f11Scan.scope_closure_id,
        term_occurrence_count: f11Scan.term_occurrence_count,
        competing_declaration_count: f11Scan.competing_declaration_count,
        local_override_count: f11Scan.local_override_count,
        conclusion_code: f11Scan.conclusion_code,
      });
    }
    const termOffsets = findByteOffsets(textBuffer, definition.raw_term);
    const quotedOffsets = findByteOffsets(
      textBuffer,
      `“${definition.raw_term}”`,
    );
    const declarationQuoteStart =
      definition.exact_declaration_span.absolute_start - 3;
    const reviewedOverrideSpan = definition.definition_key === 'TRANSACTIONS'
      ? [401406, 401606]
      : null;
    const competingQuotedOffsets = quotedOffsets.filter(
      (offset) => offset !== declarationQuoteStart
        && !(reviewedOverrideSpan
          && offset >= reviewedOverrideSpan[0]
          && offset < reviewedOverrideSpan[1]),
    );
    const detectedOverrideOffsets = termOffsets.filter((offset) => {
      const windowStart = Math.max(0, offset - 180);
      const windowEnd = Math.min(
        textBuffer.length,
        offset + Buffer.byteLength(definition.raw_term, 'utf8') + 180,
      );
      const window = textBuffer.subarray(windowStart, windowEnd)
        .toString('utf8').toLowerCase();
      return window.includes('shall be substituted for')
        || window.includes('notwithstanding the definition of');
    });
    const overrideOffsets = reviewedOverrideSpan
      ? termOffsets.filter((offset) => (
        offset >= reviewedOverrideSpan[0] && offset < reviewedOverrideSpan[1]
      ))
      : detectedOverrideOffsets;
    const unreviewedOverrideOffsets = detectedOverrideOffsets.filter(
      (offset) => !overrideOffsets.includes(offset),
    );
    const localOverrideEvidenceSpan = reviewedOverrideSpan
      ? span(textBuffer, ...reviewedOverrideSpan)
      : null;
    if (localOverrideEvidenceSpan
      && localOverrideEvidenceSpan.exact_bytes_digest
        !== '4766984cad84ef8c5e7416685587ab3c1a327453b310414825d65dd60fac3851') {
      fail(
        'LOCAL_OVERRIDE_SOURCE_DRIFT',
        'the reviewed Transactions override clause has drifted',
      );
    }
    const expectedQuotedCount = reviewedOverrideSpan ? 2 : 1;
    if (quotedOffsets.length !== expectedQuotedCount
      || competingQuotedOffsets.length !== 0
      || unreviewedOverrideOffsets.length !== 0
      || (reviewedOverrideSpan && overrideOffsets.length === 0)
      || (!reviewedOverrideSpan && overrideOffsets.length !== 0)) {
      fail(
        'DEFINITION_CONTROL_UNRESOLVED',
        `${definition.definition_key} has an unreviewed declaration or override`,
      );
    }
    const identity = {
      document_hash: DOCUMENT_HASH,
      selected_definition_occurrence_id:
        definition.definition_occurrence_id,
      exact_declaration_span: definition.exact_declaration_span,
      term_occurrence_inventory_digest: contentId(
        'QXO_DEFINITION_TERM_OFFSET_INVENTORY_F13/V1',
        termOffsets,
      ),
      quoted_declaration_inventory_digest: contentId(
        'QXO_DEFINITION_QUOTED_OFFSET_INVENTORY_F13/V1',
        quotedOffsets,
      ),
      override_candidate_inventory_digest: contentId(
        'QXO_DEFINITION_OVERRIDE_OFFSET_INVENTORY_F13/V1',
        overrideOffsets,
      ),
      local_override_scope: reviewedOverrideSpan
        ? 'ARTICLE_III_AND_SECTION_4_7_ONLY_INAPPLICABLE_TO_SECTION_4_3_C'
        : 'NONE',
      local_override_classification: reviewedOverrideSpan
        ? 'LOCAL_SCOPE_OVERRIDE_REFERENCE'
        : 'NONE',
      ...(localOverrideEvidenceSpan
        ? {
          local_override_evidence_span: localOverrideEvidenceSpan,
          evidence_excerpt_ids: [evidenceId(localOverrideEvidenceSpan)],
        }
        : {}),
      scan_scope: 'COMPLETE_ADMITTED_CANONICAL_TEXT',
      conclusion_code: 'CONTROLLING_DEFINITION_CONFIRMED',
    };
    return freeze({
      schema_version: 'QXO_DEFINITION_CONTROL_SCAN_F13/V1',
      definition_control_scope_closure_id: contentId(
        'QXO_DEFINITION_CONTROL_SCAN_F13/V1',
        identity,
      ),
      definition_key: definition.definition_key,
      selected_definition_occurrence_id:
        definition.definition_occurrence_id,
      control_source: 'F13_COMPLETE_DOCUMENT_EXACT_SCAN',
      term_occurrence_count: termOffsets.length,
      competing_declaration_count: competingQuotedOffsets.length,
      local_override_count: overrideOffsets.length,
      local_override_scope: reviewedOverrideSpan
        ? 'ARTICLE_III_AND_SECTION_4_7_ONLY_INAPPLICABLE_TO_SECTION_4_3_C'
        : 'NONE',
      conclusion_code: 'CONTROLLING_DEFINITION_CONFIRMED',
      ...identity,
    });
  });
}

function validateInputs(input) {
  if (!exactKeys(input, INPUT_KEYS)) {
    fail('INPUT_CONTRACT_MISMATCH', 'the F13 input is outside its closed contract');
  }
  validateContractBundle(input.contract_bundle);
  validateQxoNoShopNoticeSourceBindingF6CarrierIdentity(
    input.qxo_no_shop_notice_source_binding_f6,
  );
  validateQxoNoShopDefinitionRelationshipsF8CarrierIdentity(
    input.qxo_no_shop_definition_relationships_f8,
  );
  validateQxoNoShopNoticeReceiptF10CarrierIdentity(
    input.qxo_no_shop_notice_receipt_f10,
  );
  validateQxoNoShopDefinitionControlF11CarrierIdentity(
    input.qxo_no_shop_definition_control_f11,
  );
  const source = input.admitted_source_context;
  const parser = input.admitted_parser_proposal_envelope;
  const sourceText = source?.canonical_text?.text;
  if (input.contract_bundle.fingerprint !== FIXTURE_CONTRACT_FINGERPRINT_V10
    || source?.admitted_semantic_source_context_id !== SOURCE_CONTEXT_ID
    || source.document_hash !== DOCUMENT_HASH
    || source.canonical_text_id !== CANONICAL_TEXT_ID
    || source.canonical_text_sha256 !== CANONICAL_TEXT_SHA256
    || source.canonical_text_byte_length !== CANONICAL_TEXT_BYTE_LENGTH
    || typeof sourceText !== 'string'
    || Buffer.byteLength(sourceText, 'utf8') !== CANONICAL_TEXT_BYTE_LENGTH
    || sha256Hex(Buffer.from(sourceText, 'utf8')) !== CANONICAL_TEXT_SHA256
    || parser?.admitted_parser_proposal_envelope_id !== PARSER_ENVELOPE_ID
    || parser.canonical_payload_digest !== PARSER_ENVELOPE_DIGEST
    || input.qxo_no_shop_notice_source_binding_f6
      .qxo_no_shop_notice_source_binding_f6_id !== F6_SOURCE_ID
    || input.qxo_no_shop_notice_source_binding_f6
      .canonical_payload_digest !== F6_SOURCE_DIGEST
    || input.qxo_no_shop_definition_relationships_f8
      .qxo_no_shop_definition_relationships_f8_id !== F8_RELATIONSHIPS_ID
    || input.qxo_no_shop_definition_relationships_f8
      .canonical_payload_digest !== F8_RELATIONSHIPS_DIGEST
    || input.qxo_no_shop_notice_receipt_f10
      .qxo_no_shop_notice_receipt_f10_id !== F10_NOTICE_ID
    || input.qxo_no_shop_notice_receipt_f10
      .canonical_payload_digest !== F10_NOTICE_DIGEST
    || input.qxo_no_shop_definition_control_f11
      .qxo_no_shop_definition_control_f11_id !== F11_CONTROL_ID
    || input.qxo_no_shop_definition_control_f11
      .canonical_payload_digest !== F11_CONTROL_DIGEST) {
    fail('UPSTREAM_BINDING_DRIFT', 'the exact reviewed V10 QXO inputs are required');
  }
  return Buffer.from(sourceText, 'utf8');
}

function buildDefinitionOccurrences(textBuffer) {
  return DEFINITION_SPECS.map((spec) => {
    const declaration = span(textBuffer, ...spec.declaration);
    const bodySpan = span(textBuffer, ...spec.body);
    const carrierSpan = span(textBuffer, ...spec.carrier);
    if (rawText(textBuffer, declaration) !== spec.raw_term
      || !rawText(textBuffer, carrierSpan).includes(spec.raw_term)) {
      fail('DEFINITION_SOURCE_DRIFT', `${spec.key} source geometry has drifted`);
    }
    if (spec.key === 'FORWARD_MERGER'
      && (carrierSpan.exact_bytes_digest
          !== 'b67acdce216a4e91eaa23cd24c6050e7ddbbb21fcddd010dc91440f48743c442'
        || rawText(textBuffer, carrierSpan).includes('\uFFFD'))) {
      fail(
        'FORWARD_MERGER_CARRIER_DRIFT',
        'the reviewed Forward Merger carrier is malformed',
      );
    }
    const identity = {
      document_hash: DOCUMENT_HASH,
      exact_declaration_span: declaration,
      ordered_body_spans: [bodySpan],
      neutral_definition_key: sha256Hex(Buffer.from(spec.raw_term, 'utf8')),
      governed_ordinal: spec.declaration[0],
    };
    return freeze({
      schema_version: 'DEFINITION_OCCURRENCE/V1',
      definition_occurrence_id: contentId('DEFINITION_OCCURRENCE/V1', identity),
      definition_key: spec.key,
      raw_term: spec.raw_term,
      carrier_span: carrierSpan,
      legal_class: [
        'COMPANY_REQUEST',
        'COMPANY_ACQUISITION_PROPOSAL',
        'PERSON',
        'GOVERNMENTAL_ENTITY',
        'SUBSIDIARY',
      ].includes(spec.key)
        ? 'TRUE_DEFINITION'
        : ['COMPANY_SHARES', 'PARENT_SHARES'].includes(spec.key)
          ? 'INSTRUMENT_DESIGNATION'
          : 'TRANSACTION_DESIGNATION',
      ...identity,
    });
  });
}

function scanScope(textBuffer, scopeSpan, declarationStarts = new Map()) {
  const outcomes = [];
  let cursor = scopeSpan.absolute_start;
  while (cursor < scopeSpan.absolute_end) {
    const match = TERM_SPECS.find((term) => {
      const bytes = Buffer.from(term.raw_form, 'utf8');
      return cursor + bytes.length <= scopeSpan.absolute_end
        && textBuffer.subarray(cursor, cursor + bytes.length).equals(bytes);
    });
    if (!match) {
      cursor += 1;
      continue;
    }
    const end = cursor + Buffer.byteLength(match.raw_form, 'utf8');
    const exactSpan = span(textBuffer, cursor, end);
    let kind = match.kind;
    if (match.kind === 'PARTY'
      && !PARTY_ALLOWED_STARTS[match.raw_form]?.includes(cursor)) {
      fail(
        'UNREVIEWED_PARTY_OCCURRENCE',
        `${match.raw_form} at ${cursor} is outside the reviewed party inventory`,
      );
    }
    if (match.kind === 'DEFINITION'
      && declarationStarts.get(match.definition_key) === cursor) {
      kind = 'DEFINITION_DECLARATION';
    }
    outcomes.push({
      ...match,
      kind,
      exact_span: exactSpan,
      governed_ordinal: cursor,
      evidence_excerpt_ids: [evidenceId(exactSpan)],
    });
    cursor = end;
  }
  return outcomes;
}

function partyContextId(rawForm, declarationSpan, declaredTermSpan) {
  return contentId('QXO_NO_SHOP_F13_SOURCE_PARTY_CONTEXT/V1', {
    document_hash: DOCUMENT_HASH,
    party: PARTY_CONTEXTS[rawForm],
    source_declaration_carrier_span: declarationSpan,
    exact_declared_term_span: declaredTermSpan,
  });
}

function compactSourceSpan(exactSpan) {
  return freeze({
    absolute_start: exactSpan.absolute_start,
    absolute_end: exactSpan.absolute_end,
    exact_bytes_digest: exactSpan.exact_bytes_digest,
  });
}

function buildSourcePartyContexts(textBuffer) {
  return freeze(Object.fromEntries(Object.keys(PARTY_CONTEXTS).map((rawForm) => {
    const declarationSpan = span(
      textBuffer,
      ...PARTY_DECLARATION_CARRIERS[rawForm],
    );
    const declaredTermSpan = span(
      textBuffer,
      ...PARTY_DECLARED_TERMS[rawForm],
    );
    if (rawText(textBuffer, declaredTermSpan) !== rawForm
      || !rawText(textBuffer, declarationSpan).includes(rawForm)) {
      fail('PARTY_DECLARATION_DRIFT', `${rawForm} declaration has drifted`);
    }
    const id = partyContextId(rawForm, declarationSpan, declaredTermSpan);
    return [id, freeze({
      raw_form: rawForm,
      party: [
        PARTY_CONTEXTS[rawForm].role,
        PARTY_CONTEXTS[rawForm].value,
        PARTY_CONTEXTS[rawForm].capacity,
      ],
      source_declaration_carrier_span: compactSourceSpan(declarationSpan),
      exact_declared_term_span: compactSourceSpan(declaredTermSpan),
    })];
  })));
}

function buildPartyOutcome(
  token,
  parentScopeIdentity,
  sourcePartyContextIdByRaw,
) {
  const identity = {
    document_hash: DOCUMENT_HASH,
    parent_scope_identity: parentScopeIdentity,
    exact_source_span: token.exact_span,
    raw_source_form: token.raw_form,
    source_party_context_id:
      sourcePartyContextIdByRaw.get(token.raw_form),
    party: PARTY_CONTEXTS[token.raw_form],
    governed_ordinal: token.governed_ordinal,
    evidence_excerpt_ids: token.evidence_excerpt_ids,
  };
  return freeze({
    schema_version: 'NOTICE_DEFINITION_SCOPE_PARTY_TOKEN_OUTCOME/V1',
    party_token_outcome_id: contentId(
      'NOTICE_DEFINITION_SCOPE_PARTY_TOKEN_OUTCOME/V1',
      identity,
    ),
    ...identity,
  });
}

function buildGovernanceOutcome(
  token,
  textBuffer,
  sourcePartyContextIdByRaw,
) {
  const declarationCarrierSpan = span(
    textBuffer,
    ...COMPANY_BOARD_DECLARATION.carrier,
  );
  const declarationTermSpan = span(
    textBuffer,
    ...COMPANY_BOARD_DECLARATION.term,
  );
  const governedCompanySpan = span(
    textBuffer,
    ...COMPANY_BOARD_DECLARATION.governed_company,
  );
  const identity = {
    document_hash: DOCUMENT_HASH,
    exact_designation_span: declarationTermSpan,
    raw_source_form: token.raw_form,
    governed_entity_party_context_id:
      sourcePartyContextIdByRaw.get('Company'),
    governance_role_code: 'BOARD_OF_DIRECTORS',
    governed_ordinal: declarationTermSpan.absolute_start,
    evidence_excerpt_ids: sortedUnique([
      ...token.evidence_excerpt_ids,
      evidenceId(declarationCarrierSpan),
      evidenceId(declarationTermSpan),
      evidenceId(governedCompanySpan),
    ]),
  };
  return freeze({
    schema_version: 'NOTICE_DEFINITION_SCOPE_GOVERNANCE_OUTCOME/V1',
    source_governance_context_id: contentId(
      'NOTICE_DEFINITION_SCOPE_GOVERNANCE_OUTCOME/V1',
      identity,
    ),
    ...identity,
    semantic_transfer_authority: 'NONE',
  });
}

function reviewedTerminalReason(kind) {
  if (kind === 'REVIEWED_UNDEFINED_SOURCE_PRIMITIVE') {
    return {
      typed_reason_code: 'SOURCE_TERM_UNDEFINED_IN_AGREEMENT',
      lawyer_review_note:
        'EBITDA is source-backed but undefined. The affected 20% limb remains visible in Review and is not admitted to a governed market cohort.',
      non_comparable_reason:
        'No governed denominator or cross-deal definition is available for EBITDA.',
    };
  }
  if (kind === 'REVIEWED_NON_ENUMERABLE_SOURCE_PHRASE') {
    return {
      typed_reason_code: 'SOURCE_PHRASE_REAL_BUT_NOT_EXHAUSTIVELY_ENUMERABLE',
      lawyer_review_note:
        'Other transactions contemplated hereby refers to this Agreement but does not enumerate every included transaction.',
      non_comparable_reason:
        'The source phrase is real but does not define an exhaustive comparable cohort.',
    };
  }
  return {
    typed_reason_code: 'SOURCE_CONTEXT_DESIGNATION_ONLY',
    lawyer_review_note:
      'This source designation supplies context and does not become an independent substantive concept.',
    non_comparable_reason:
      'Context designation only, with no independent market cohort.',
  };
}

function buildReviewedTerminal(token, parentScopeIdentity) {
  const reason = reviewedTerminalReason(token.kind);
  const identity = {
    document_hash: DOCUMENT_HASH,
    parent_scope_identity: parentScopeIdentity,
    exact_source_span: token.exact_span,
    raw_source_form: token.raw_form,
    disposition_code: token.kind,
    ...reason,
    governed_ordinal: token.governed_ordinal,
    evidence_excerpt_ids: token.evidence_excerpt_ids,
  };
  return freeze({
    schema_version: 'NOTICE_DEFINITION_SCOPE_REVIEWED_TERMINAL/V1',
    terminal_reviewed_outcome_id: contentId(
      'NOTICE_DEFINITION_SCOPE_REVIEWED_TERMINAL/V1',
      identity,
    ),
    ...identity,
    review_projection: 'VISIBLE_WITH_EVIDENCE_AND_REASON',
    compare_projection: 'EXPLICITLY_NON_COMPARABLE',
    corpus_context_projection: 'EXPLICITLY_NON_COMPARABLE',
  });
}

function buildRelationship(
  token,
  parentDefinitionId,
  selectedDefinition,
  f11RelationshipByOrdinal,
) {
  const useIdentity = {
    document_hash: DOCUMENT_HASH,
    exact_use_span: token.exact_span,
    raw_use_form: token.raw_form,
    governed_ordinal: token.governed_ordinal,
  };
  const definitionUseOccurrenceId = contentId(
    'DEFINITION_USE_OCCURRENCE/V1',
    useIdentity,
  );
  const controlled = f11RelationshipByOrdinal.get(token.governed_ordinal);
  if (controlled) {
    const effect = controlled.relationship_effect;
    if (effect.raw_use_form !== token.raw_form
      || effect.exact_use_span.absolute_start
        !== token.exact_span.absolute_start
      || effect.exact_use_span.absolute_end !== token.exact_span.absolute_end
      ) {
      fail(
        'F11_RELATIONSHIP_BINDING_DRIFT',
        `the F11 controlled effect at ${token.governed_ordinal} has drifted`,
      );
    }
    return freeze({
      schema_version: 'QXO_NO_SHOP_DEFINITION_SCOPE_USE_F13/V1',
      definition_use_relationship_id:
        effect.relationship_effect_revision_id,
      relationship_source: 'F11_CONTROLLED_EFFECT',
      controlled_relationship_occurrence_id:
        controlled.relationship_occurrence.relationship_occurrence_id,
      controlled_relationship_effect_revision_id:
        effect.relationship_effect_revision_id,
      controlled_predecessor_selected_definition_occurrence_id:
        effect.selected_definition_occurrence_id,
      controlled_definition_scope_closure_id: effect.scope_closure_id,
      controlled_interpretation_payload_id:
        effect.relationship_interpretation_payload_id,
      controlled_effect_payload_digest: contentId(
        'QXO_NO_SHOP_F13_BOUND_F11_EFFECT/V1',
        effect,
      ),
      definition_use_occurrence_id: effect.exact_use_occurrence_id,
      selected_definition_occurrence_id:
        selectedDefinition.definition_occurrence_id,
      parent_scope_identity: parentDefinitionId || NOTICE_OCCURRENCE_ID,
      use_form_code: effect.use_form_code,
      governed_ordinal: token.governed_ordinal,
      evidence_excerpt_ids: sortedUnique([
        ...token.evidence_excerpt_ids,
        evidenceId(selectedDefinition.exact_declaration_span),
        ...selectedDefinition.ordered_body_spans.map(evidenceId),
      ]),
      legal_operation: effect.legal_operation,
      propagation: effect.propagation,
      party_transfer: effect.party_transfer,
      alias_authority: effect.alias_authority,
    });
  }
  const identity = {
    document_hash: DOCUMENT_HASH,
    definition_use_occurrence_id: definitionUseOccurrenceId,
    selected_definition_occurrence_id:
      selectedDefinition.definition_occurrence_id,
    parent_scope_identity: parentDefinitionId || NOTICE_OCCURRENCE_ID,
    use_form_code: token.kind === 'DEFINITION_PLURAL'
      ? 'SOURCE_LOCAL_INFLECTION'
      : 'EXACT_DECLARED_TERM',
    governed_ordinal: token.governed_ordinal,
    evidence_excerpt_ids: sortedUnique([
      ...token.evidence_excerpt_ids,
      evidenceId(selectedDefinition.exact_declaration_span),
      ...selectedDefinition.ordered_body_spans.map(evidenceId),
    ]),
  };
  return freeze({
    schema_version: 'QXO_NO_SHOP_DEFINITION_SCOPE_USE_F13/V1',
    definition_use_relationship_id: contentId(
      'QXO_NO_SHOP_DEFINITION_SCOPE_USE_F13/V1',
      identity,
    ),
    relationship_source: 'F13_TRANSITIVE_REVIEW',
    definition_use_occurrence_id: definitionUseOccurrenceId,
    selected_definition_occurrence_id:
      selectedDefinition.definition_occurrence_id,
    parent_scope_identity: parentDefinitionId || NOTICE_OCCURRENCE_ID,
    use_form_code: identity.use_form_code,
    governed_ordinal: token.governed_ordinal,
    evidence_excerpt_ids: identity.evidence_excerpt_ids,
    legal_operation: 'APPLY_SELECTED_DEFINITION_TO_EXACT_USE',
    propagation: 'EXACT_NAMED_TARGET_ONLY',
    party_transfer: 'NONE',
    alias_authority: 'NONE',
  });
}

function buildTokenOutcome(
  token,
  parentScopeIdentity,
  definitionByKey,
  partyOutcomeByKey,
  governanceOutcomeByKey,
  terminalOutcomeByKey,
  blockingOutcomeByKey,
) {
  let dispositionCode;
  let dispositionTarget;
  const blocking = blockingOutcomeByKey.get([
    token.exact_span.absolute_start,
    token.exact_span.absolute_end,
    token.raw_form,
  ].join(':'));
  if (blocking) {
    dispositionCode = 'BLOCKING_UNRESOLVED_CANDIDATE';
    dispositionTarget = {
      target_kind: 'BLOCKING_UNRESOLVED',
      blocking_unresolved_outcome_id:
        blocking.blocking_unresolved_outcome_id,
    };
  } else if (token.kind === 'DEFINITION_DECLARATION') {
    dispositionCode = 'DEFINITION_DECLARATION';
    dispositionTarget = {
      target_kind: 'DEFINITION_OCCURRENCE',
      definition_occurrence_id:
        definitionByKey.get(token.definition_key).definition_occurrence_id,
    };
  } else if (token.kind === 'DEFINITION'
    || token.kind === 'DEFINITION_PLURAL') {
    dispositionCode = 'USES_DEFINITION';
    dispositionTarget = {
      target_kind: 'DEFINITION_OCCURRENCE',
      definition_occurrence_id:
        definitionByKey.get(token.definition_key).definition_occurrence_id,
    };
  } else if (token.kind === 'PARTY') {
    dispositionCode = 'PARTY_TOKEN_TERMINAL';
    dispositionTarget = {
      target_kind: 'PARTY_CONTEXT',
      source_party_context_id:
        partyOutcomeByKey.get(token.governed_ordinal)
          .source_party_context_id,
    };
  } else if (token.kind === 'GOVERNANCE') {
    dispositionCode = 'GOVERNANCE_BODY_DESIGNATION';
    dispositionTarget = {
      target_kind: 'GOVERNANCE_CONTEXT',
      source_governance_context_id:
        governanceOutcomeByKey.get(token.governed_ordinal)
          .source_governance_context_id,
    };
  } else {
    dispositionCode = token.kind;
    dispositionTarget = {
      target_kind: 'REVIEWED_TERMINAL',
      terminal_reviewed_outcome_id:
        terminalOutcomeByKey.get(token.governed_ordinal)
          .terminal_reviewed_outcome_id,
    };
  }
  const identity = {
    document_hash: DOCUMENT_HASH,
    parent_scope_identity: parentScopeIdentity,
    exact_source_span: token.exact_span,
    raw_source_form: token.raw_form,
    candidate_origin: 'RECONCILED_CATALOGUE_AND_BLIND_SCAN',
    disposition_code: dispositionCode,
    disposition_target: dispositionTarget,
    governed_ordinal: token.governed_ordinal,
    evidence_excerpt_ids: token.evidence_excerpt_ids,
  };
  return freeze({
    schema_version: 'NOTICE_DEFINITION_SCOPE_TOKEN_OUTCOME/V1',
    token_outcome_id: contentId(
      'NOTICE_DEFINITION_SCOPE_TOKEN_OUTCOME/V1',
      identity,
    ),
    ...identity,
  });
}

function buildBlindCandidateDispositions(textBuffer, spans, tokenOutcomes) {
  const candidateByKey = new Map();
  let observationCount = 0;
  for (const exactSpan of spans) {
    const value = rawText(textBuffer, exactSpan);
    const matcher = /“[^”]+”|[A-Z][A-Za-z]*(?:\s+[A-Z][A-Za-z]*)*/g;
    for (const match of value.matchAll(matcher)) {
      observationCount += 1;
      const localStart = Buffer.byteLength(value.slice(0, match.index), 'utf8');
      const absoluteStart = exactSpan.absolute_start + localStart;
      const candidateSpan = span(
        textBuffer,
        absoluteStart,
        absoluteStart + Buffer.byteLength(match[0], 'utf8'),
      );
      candidateByKey.set(
        `${candidateSpan.absolute_start}:${candidateSpan.absolute_end}:${match[0]}`,
        {
          raw_form: match[0],
          exact_source_span: candidateSpan,
          governed_ordinal: absoluteStart,
        },
      );
    }
  }
  const dispositions = [...candidateByKey.values()]
    .sort((left, right) => (
      left.governed_ordinal - right.governed_ordinal
      || left.raw_form.localeCompare(right.raw_form)
    ))
    .map((candidate) => {
      const mapped = tokenOutcomes.filter((outcome) => {
        const tokenSpan = outcome.exact_source_span;
        const candidateSpan = candidate.exact_source_span;
        return (candidateSpan.absolute_start <= tokenSpan.absolute_start
            && candidateSpan.absolute_end >= tokenSpan.absolute_end)
          || (tokenSpan.absolute_start <= candidateSpan.absolute_start
            && tokenSpan.absolute_end >= candidateSpan.absolute_end);
      });
      const contextualReview = REVIEWED_CONTEXTUAL_BLIND_CANDIDATES[
        `${candidate.exact_source_span.absolute_start}:`
        + `${candidate.exact_source_span.absolute_end}:`
        + candidate.raw_form
      ];
      const blockingMapped = mapped.filter(
        (outcome) => (
          outcome.disposition_code === 'BLOCKING_UNRESOLVED_CANDIDATE'
        ),
      );
      if (blockingMapped.length !== 0
        && blockingMapped.length !== mapped.length) {
        fail(
          'FAILURE_PROJECTION_DRIFT',
          `${candidate.raw_form} has mixed successful and blocking projections`,
        );
      }
      if (mapped.length === 0 && !contextualReview) {
        fail(
          'UNRECONCILED_BLIND_CANDIDATE',
          `${candidate.raw_form} at ${candidate.governed_ordinal} is unreconciled`,
        );
      }
      const identity = {
        document_hash: DOCUMENT_HASH,
        exact_source_span: candidate.exact_source_span,
        raw_source_form: candidate.raw_form,
        governed_ordinal: candidate.governed_ordinal,
        disposition_code: contextualReview
          ? 'REVIEWED_SOURCE_CONTEXT_CONSTITUENT'
          : blockingMapped.length
            ? 'BLOCKING_UNRESOLVED_CANDIDATE'
            : 'MAPPED_TO_REVIEWED_TOKEN_OUTCOMES',
        mapped_token_outcome_ids: sortedUnique(mapped.map(
          (outcome) => outcome.token_outcome_id,
        )),
        ...(contextualReview
          ? {
            reviewed_reason_code: contextualReview.reviewed_reason_code,
            semantic_transfer_authority: 'NONE',
            comparability_authority: 'NONE',
          }
          : {}),
        evidence_excerpt_ids: [evidenceId(candidate.exact_source_span)],
      };
      return freeze({
        blind_candidate_disposition_id: contentId(
          'QXO_NO_SHOP_F13_BLIND_CANDIDATE_DISPOSITION/V1',
          identity,
        ),
        raw_source_form: candidate.raw_form,
        absolute_start: candidate.exact_source_span.absolute_start,
        absolute_end: candidate.exact_source_span.absolute_end,
        disposition_code: identity.disposition_code,
        mapped_token_outcome_ids: identity.mapped_token_outcome_ids,
        ...(contextualReview
          ? {
            reviewed_reason_code: identity.reviewed_reason_code,
            semantic_transfer_authority:
              identity.semantic_transfer_authority,
            comparability_authority: identity.comparability_authority,
          }
          : {}),
        evidence_excerpt_ids: identity.evidence_excerpt_ids,
      });
    });
  const inventory = dispositions.map((entry) => ({
    absolute_start: entry.absolute_start,
    absolute_end: entry.absolute_end,
    raw_source_form: entry.raw_source_form,
    governed_ordinal: entry.absolute_start,
  }));
  return freeze({
    dispositions,
    candidate_count: dispositions.length,
    raw_observation_count: observationCount,
    duplicate_scope_observation_count:
      observationCount - dispositions.length,
    candidate_inventory_digest: contentId(
      'QXO_NO_SHOP_F13_BLIND_CANDIDATE_INVENTORY/V1',
      inventory,
    ),
    unreviewed_candidate_count: 0,
  });
}

function ownedScopedTokens(rootTokens, bodyTokenGroups) {
  const owners = new Map();
  const candidates = [
    ...rootTokens.map((token) => ({
      token,
      parentScopeIdentity: NOTICE_OCCURRENCE_ID,
      parentDefinitionId: null,
      scopeLength: ROOT_SCOPE[1] - ROOT_SCOPE[0],
      depth: 0,
    })),
    ...bodyTokenGroups.flatMap(({ definition, tokens }) => tokens.map(
      (token) => ({
        token,
        parentScopeIdentity: definition.definition_occurrence_id,
        parentDefinitionId: definition.definition_occurrence_id,
        scopeLength: definition.ordered_body_spans.reduce(
          (sum, item) => (
            sum + item.absolute_end - item.absolute_start
          ),
          0,
        ),
        depth: 1,
      }),
    )),
  ];
  for (const candidate of candidates) {
    const key = [
      candidate.token.exact_span.absolute_start,
      candidate.token.exact_span.absolute_end,
      candidate.token.raw_form,
    ].join(':');
    const current = owners.get(key);
    if (!current
      || candidate.depth > current.depth
      || (candidate.depth === current.depth
        && candidate.scopeLength < current.scopeLength)) {
      owners.set(key, candidate);
    }
  }
  return [...owners.values()].sort((left, right) => (
    left.token.governed_ordinal - right.token.governed_ordinal
    || left.scopeLength - right.scopeLength
  ));
}

function deriveTopologicalOrder(definitions, relationships) {
  const definitionById = new Map(definitions.map(
    (entry) => [entry.definition_occurrence_id, entry],
  ));
  const dependencies = new Map(definitions.map(
    (entry) => [entry.definition_occurrence_id, new Set()],
  ));
  const dependants = new Map(definitions.map(
    (entry) => [entry.definition_occurrence_id, new Set()],
  ));
  for (const relationship of relationships) {
    const parentId = relationship.parent_scope_identity;
    const selectedId = relationship.selected_definition_occurrence_id;
    if (parentId === NOTICE_OCCURRENCE_ID) continue;
    if (!dependencies.has(parentId) || !dependencies.has(selectedId)) {
      fail('DEPENDENCY_SET_DRIFT', 'a relationship points outside the reached set');
    }
    if (parentId === selectedId) continue;
    dependencies.get(parentId).add(selectedId);
    dependants.get(selectedId).add(parentId);
  }
  const compareIds = (left, right) => (
    definitionById.get(left).governed_ordinal
      - definitionById.get(right).governed_ordinal
    || left.localeCompare(right)
  );
  const ready = [...dependencies.entries()]
    .filter(([, values]) => values.size === 0)
    .map(([id]) => id)
    .sort(compareIds);
  const ordered = [];
  const depthById = new Map(definitions.map(
    (entry) => [entry.definition_occurrence_id, 1],
  ));
  while (ready.length) {
    const id = ready.shift();
    ordered.push(id);
    for (const dependantId of dependants.get(id)) {
      depthById.set(
        dependantId,
        Math.max(depthById.get(dependantId), depthById.get(id) + 1),
      );
      dependencies.get(dependantId).delete(id);
      if (dependencies.get(dependantId).size === 0) {
        ready.push(dependantId);
        ready.sort(compareIds);
      }
    }
  }
  if (ordered.length !== definitions.length) {
    fail('DEFINITION_DEPENDENCY_CYCLE', 'the reached definition graph is cyclic');
  }
  const maximumDepth = Math.max(0, ...depthById.values());
  if (maximumDepth > 16) {
    fail('DEFINITION_DEPENDENCY_DEPTH_EXCEEDED', 'definition depth exceeds V10');
  }
  return freeze({
    ordered_ids: ordered,
    ordered_keys: ordered.map((id) => definitionById.get(id).definition_key),
    maximum_depth: maximumDepth,
  });
}

function collectEvidenceIds(value, target = []) {
  if (Array.isArray(value)) {
    value.forEach((entry) => collectEvidenceIds(entry, target));
  } else if (value && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value)) {
      if (key === 'evidence_excerpt_ids' && Array.isArray(entry)) {
        target.push(...entry);
      } else {
        collectEvidenceIds(entry, target);
      }
    }
  }
  return target;
}

function validateBounds(carrier) {
  const closure = carrier.definition_scope_closure;
  const bounds = NOTICE_DEFINITION_SCOPE_CLOSURE_V1.bounds;
  const totalTokens = carrier.root_token_outcomes.length
    + carrier.definition_body_token_outcomes.reduce(
      (sum, group) => sum + group.token_outcomes.length,
      0,
    );
  const evidenceBearingPayload = [
    ...carrier.root_token_outcomes,
    ...carrier.definition_body_token_outcomes.flatMap(
      (group) => group.token_outcomes,
    ),
    ...carrier.party_token_outcomes,
    ...carrier.governance_designation_outcomes,
    ...carrier.reviewed_terminal_outcomes,
    ...carrier.blocking_unresolved_outcomes,
    ...carrier.definition_use_relationships,
    ...carrier.definition_control_scans,
    ...Object.values(carrier.blind_candidate_dispositions),
  ];
  const evidenceReferences = collectEvidenceIds(evidenceBearingPayload);
  const evidenceRecordIds = Object.keys(carrier.evidence_excerpts);
  const evidenceRecordIdSet = new Set(evidenceRecordIds);
  const topologyPositions = new Map(
    closure.topological_definition_occurrence_ids.map(
      (id, index) => [id, index],
    ),
  );
  const topologyInvalid = carrier.definition_use_relationships.some(
    (relationship) => (
      relationship.parent_scope_identity !== NOTICE_OCCURRENCE_ID
      && relationship.parent_scope_identity
        !== relationship.selected_definition_occurrence_id
      && topologyPositions.get(
        relationship.selected_definition_occurrence_id,
      ) >= topologyPositions.get(relationship.parent_scope_identity)
    ),
  );
  const derivedTopology = deriveTopologicalOrder(
    carrier.definition_occurrences,
    carrier.definition_use_relationships,
  );
  const allTokenOutcomeById = new Map([
    ...carrier.root_token_outcomes,
    ...carrier.definition_body_token_outcomes.flatMap(
      (group) => group.token_outcomes,
    ),
  ].map((entry) => [entry.token_outcome_id, entry]));
  const blindMappingInvalid = Object.values(
    carrier.blind_candidate_dispositions,
  ).some(
    (entry) => {
      const mappedOutcomes = entry.mapped_token_outcome_ids.map(
        (id) => allTokenOutcomeById.get(id),
      );
      if (mappedOutcomes.some((outcome) => !outcome)) return true;
      if (entry.disposition_code === 'MAPPED_TO_REVIEWED_TOKEN_OUTCOMES') {
        return mappedOutcomes.length === 0
          || mappedOutcomes.some(
            (outcome) => (
              outcome.disposition_code
                === 'BLOCKING_UNRESOLVED_CANDIDATE'
            ),
          );
      }
      if (entry.disposition_code === 'BLOCKING_UNRESOLVED_CANDIDATE') {
        return mappedOutcomes.length === 0
          || mappedOutcomes.some(
            (outcome) => (
              outcome.disposition_code
                !== 'BLOCKING_UNRESOLVED_CANDIDATE'
            ),
          );
      }
      return entry.disposition_code
        !== 'REVIEWED_SOURCE_CONTEXT_CONSTITUENT';
    },
  );
  const evidenceIdentityInvalid = Object.entries(
    carrier.evidence_excerpts,
  ).some(([id, record]) => {
    const semanticIdentity = {
      schema_version: 'SEMANTIC_SPAN/V1',
      canonical_text_id: CANONICAL_TEXT_ID,
      absolute_start: record.absolute_start,
      absolute_end: record.absolute_end,
    };
    const exactSpan = {
      ...semanticIdentity,
      semantic_span_id: contentId('SEMANTIC_SPAN/V1', semanticIdentity),
      exact_bytes_digest: record.exact_bytes_digest,
    };
    return evidenceId(exactSpan) !== id;
  });
  const expandCompactSpan = (record) => {
    const identity = {
      schema_version: 'SEMANTIC_SPAN/V1',
      canonical_text_id: CANONICAL_TEXT_ID,
      absolute_start: record.absolute_start,
      absolute_end: record.absolute_end,
    };
    return {
      ...identity,
      semantic_span_id: contentId('SEMANTIC_SPAN/V1', identity),
      exact_bytes_digest: record.exact_bytes_digest,
    };
  };
  const blindIdentityInvalid = Object.entries(
    carrier.blind_candidate_dispositions,
  ).some(([id, record]) => {
    const contextualReview = REVIEWED_CONTEXTUAL_BLIND_CANDIDATES[
      `${record.absolute_start}:${record.absolute_end}:${record.raw_source_form}`
    ];
    if (record.disposition_code === 'REVIEWED_SOURCE_CONTEXT_CONSTITUENT'
      ? !contextualReview
        || record.mapped_token_outcome_ids.length !== 0
        || record.reviewed_reason_code
          !== contextualReview.reviewed_reason_code
        || record.semantic_transfer_authority !== 'NONE'
        || record.comparability_authority !== 'NONE'
      : contextualReview
        || Object.hasOwn(record, 'reviewed_reason_code')
        || Object.hasOwn(record, 'semantic_transfer_authority')
        || Object.hasOwn(record, 'comparability_authority')) {
      return true;
    }
    const evidenceRecord = carrier.evidence_excerpts[
      record.evidence_excerpt_ids[0]
    ];
    if (record.evidence_excerpt_ids.length !== 1 || !evidenceRecord) {
      return true;
    }
    const identity = {
      document_hash: DOCUMENT_HASH,
      exact_source_span: expandCompactSpan(evidenceRecord),
      raw_source_form: record.raw_source_form,
      governed_ordinal: record.absolute_start,
      disposition_code: record.disposition_code,
      mapped_token_outcome_ids: record.mapped_token_outcome_ids,
      ...(contextualReview
        ? {
          reviewed_reason_code: record.reviewed_reason_code,
          semantic_transfer_authority: record.semantic_transfer_authority,
          comparability_authority: record.comparability_authority,
        }
        : {}),
      evidence_excerpt_ids: record.evidence_excerpt_ids,
    };
    return contentId(
      'QXO_NO_SHOP_F13_BLIND_CANDIDATE_DISPOSITION/V1',
      identity,
    ) !== id;
  });
  const partyContextIds = new Set(Object.keys(carrier.source_party_contexts));
  const partyContextInvalid = partyContextIds.size !== 4
    || Object.entries(carrier.source_party_contexts).some(([id, record]) => (
      partyContextId(
        record.raw_form,
        expandCompactSpan(record.source_declaration_carrier_span),
        expandCompactSpan(record.exact_declared_term_span),
      ) !== id
    ))
    || carrier.party_token_outcomes.some(
      (outcome) => !partyContextIds.has(outcome.source_party_context_id),
    )
    || carrier.governance_designation_outcomes.some(
      (outcome) => !partyContextIds.has(
        outcome.governed_entity_party_context_id,
      ),
    );
  const exactSetDrift = (
    canonicalJson(sortedUnique(carrier.definition_occurrences.map(
      (entry) => entry.definition_occurrence_id,
    ))) !== canonicalJson(closure.definition_occurrence_ids)
    || canonicalJson(sortedUnique(carrier.definition_use_relationships.map(
      (entry) => entry.definition_use_relationship_id,
    ))) !== canonicalJson(closure.definition_use_relationship_ids)
    || canonicalJson(sortedUnique(carrier.root_token_outcomes.map(
      (entry) => entry.token_outcome_id,
    ))) !== canonicalJson(closure.root_token_outcome_ids)
    || canonicalJson(sortedUnique(carrier.party_token_outcomes.map(
      (entry) => entry.party_token_outcome_id,
    ))) !== canonicalJson(closure.party_token_outcome_ids)
    || canonicalJson(sortedUnique(carrier.reviewed_terminal_outcomes.map(
      (entry) => entry.terminal_reviewed_outcome_id,
    ))) !== canonicalJson(closure.terminal_reviewed_outcome_ids)
    || canonicalJson(sortedUnique(carrier.blocking_unresolved_outcomes.map(
      (entry) => entry.blocking_unresolved_outcome_id,
    ))) !== canonicalJson(closure.blocking_unresolved_outcome_ids)
  );
  if (carrier.definition_occurrences.length > bounds.maximum_definition_nodes
    || carrier.definition_use_relationships.length
      > bounds.maximum_definition_use_relationships
    || carrier.root_token_outcomes.length > bounds.maximum_root_token_outcomes
    || totalTokens > bounds.maximum_total_transitive_token_outcomes
    || carrier.party_token_outcomes.length > bounds.maximum_party_token_outcomes
    || carrier.reviewed_terminal_outcomes.length
      > bounds.maximum_terminal_reviewed_outcomes
    || carrier.blocking_unresolved_outcomes.length
      > bounds.maximum_blocking_unresolved_outcomes
    || evidenceReferences.length
      > bounds.maximum_total_evidence_excerpt_references
    || evidenceRecordIds.length !== evidenceRecordIdSet.size
    || evidenceReferences.some((id) => !evidenceRecordIdSet.has(id))
    || Object.keys(carrier.blind_candidate_dispositions).length
      !== carrier.scan_policy.candidate_count
    || carrier.definition_control_scans.length
      !== carrier.definition_occurrences.length
    || carrier.scan_policy.unreviewed_candidate_count !== 0
    || blindMappingInvalid
    || blindIdentityInvalid
    || evidenceIdentityInvalid
    || partyContextInvalid
    || exactSetDrift
    || closure.topological_definition_occurrence_ids.length
      !== carrier.definition_occurrences.length
    || topologyPositions.size !== carrier.definition_occurrences.length
    || topologyInvalid
    || canonicalJson(derivedTopology.ordered_ids)
      !== canonicalJson(closure.topological_definition_occurrence_ids)
    || derivedTopology.maximum_depth > bounds.maximum_dependency_depth
    || Buffer.byteLength(canonicalJson(carrier), 'utf8') > MAX_CARRIER_BYTES) {
    fail('BOUND_EXCEEDED', `the F13 closure exceeds a frozen V10 bound: ${canonicalJson({
      definition_nodes: carrier.definition_occurrences.length,
      relationships: carrier.definition_use_relationships.length,
      root_tokens: carrier.root_token_outcomes.length,
      total_tokens: totalTokens,
      party_tokens: carrier.party_token_outcomes.length,
      terminals: carrier.reviewed_terminal_outcomes.length,
      blocking: carrier.blocking_unresolved_outcomes.length,
      evidence_references: evidenceReferences.length,
      evidence_records: evidenceRecordIds.length,
      carrier_bytes: Buffer.byteLength(canonicalJson(carrier), 'utf8'),
      top_level_bytes: Object.fromEntries(Object.entries(carrier).map(
        ([key, value]) => [
          key,
          Buffer.byteLength(canonicalJson(value), 'utf8'),
        ],
      )),
      topology_invalid: topologyInvalid,
    })}`);
  }
}

function validateCarrierIdentity(carrier) {
  if (!exactKeys(carrier, CARRIER_KEYS)
    || carrier.schema_version
      !== 'QXO_NO_SHOP_DEFINITION_SCOPE_CLOSURE_F13/V1') {
    fail('CARRIER_CONTRACT_MISMATCH', 'the F13 carrier is invalid');
  }
  const body = { ...carrier };
  delete body.qxo_no_shop_definition_scope_closure_f13_id;
  delete body.canonical_payload_digest;
  if (carrier.qxo_no_shop_definition_scope_closure_f13_id !== contentId(
    'QXO_NO_SHOP_DEFINITION_SCOPE_CLOSURE_F13/V1',
    body,
  ) || carrier.canonical_payload_digest !== contentId(
    'QXO_NO_SHOP_DEFINITION_SCOPE_CLOSURE_F13_PAYLOAD/V1',
    body,
  )) {
    fail('CARRIER_IDENTITY_MISMATCH', 'the F13 carrier identity has drifted');
  }
  validateBounds(carrier);
  return true;
}

function buildCarrier(input, forcedFailure = null) {
  const textBuffer = validateInputs(input);
  const allDefinitions = buildDefinitionOccurrences(textBuffer);
  const definitionByKey = new Map(allDefinitions.map(
    (entry) => [entry.definition_key, entry],
  ));
  const declarationStarts = new Map(DEFINITION_SPECS.map(
    (entry) => [entry.key, entry.declaration[0]],
  ));
  const rootScope = span(textBuffer, ...ROOT_SCOPE);
  if (rootScope.exact_bytes_digest
    !== '3f6d824c70d4194f63bdc3581987be1965c1bb242461ba7a8735341de4c362d5') {
    fail('ROOT_SCOPE_DRIFT', 'the exact QXO notice root span has drifted');
  }
  const rootTokens = scanScope(textBuffer, rootScope, declarationStarts);
  if (canonicalJson(rootTokens.map((entry) => entry.governed_ordinal))
      !== canonicalJson(EXPECTED_ROOT_SPANS)) {
    fail('ROOT_INVENTORY_DRIFT', 'the complete 19-token root inventory has drifted');
  }
  const isDefinitionToken = (token) => [
    'DEFINITION',
    'DEFINITION_PLURAL',
    'DEFINITION_DECLARATION',
  ].includes(token.kind);
  const failedOrdinal = forcedFailure == null ? null : Number(forcedFailure);
  const reachedKeys = new Set();
  const pendingKeys = [];
  const enqueue = (token) => {
    if (!isDefinitionToken(token)
      || token.governed_ordinal === failedOrdinal
      || reachedKeys.has(token.definition_key)
      || pendingKeys.includes(token.definition_key)) return;
    pendingKeys.push(token.definition_key);
  };
  rootTokens.forEach(enqueue);
  const scannedBodyTokensByKey = new Map();
  while (pendingKeys.length) {
    const key = pendingKeys.shift();
    reachedKeys.add(key);
    const definition = definitionByKey.get(key);
    if (!definition) {
      fail('REACHED_DEFINITION_MISSING', `${key} has no reviewed occurrence`);
    }
    const definitionSpec = DEFINITION_SPECS.find(
      (entry) => entry.key === definition.definition_key,
    );
    const contextSpans = (definitionSpec.context || []).map(
      (coordinates) => span(textBuffer, ...coordinates),
    );
    const tokens = [
      ...definition.ordered_body_spans,
      ...contextSpans,
    ].flatMap((bodySpan) => (
      scanScope(textBuffer, bodySpan, declarationStarts)
    )).map((token) => (
      token.raw_form === 'Agreement'
        ? {
          ...token,
          evidence_excerpt_ids: sortedUnique([
            ...token.evidence_excerpt_ids,
            evidenceId(span(textBuffer, ...AGREEMENT_DECLARATION_CARRIER)),
          ]),
        }
        : token
    ));
    scannedBodyTokensByKey.set(key, tokens);
    tokens.forEach(enqueue);
  }
  const definitions = allDefinitions.filter(
    (definition) => reachedKeys.has(definition.definition_key),
  );
  const reachedDefinitionByKey = new Map(definitions.map(
    (entry) => [entry.definition_key, entry],
  ));
  const bodyTokenGroups = definitions.map((definition) => ({
    definition,
    tokens: scannedBodyTokensByKey.get(definition.definition_key),
  }));
  const ownedTokens = ownedScopedTokens(rootTokens, bodyTokenGroups);
  const failedOwnedTokens = failedOrdinal == null
    ? []
    : ownedTokens.filter(
      ({ token }) => token.governed_ordinal === failedOrdinal,
    );
  if (failedOrdinal != null && failedOwnedTokens.length !== 1) {
    fail(
      'INVALID_FORCED_FAILURE',
      'the test-only failure target must resolve to one semantic owner',
    );
  }

  const blockingOutcomes = failedOwnedTokens.map(({
    token,
    parentScopeIdentity,
  }) => {
    const identity = {
      document_hash: DOCUMENT_HASH,
      parent_scope_identity: parentScopeIdentity,
      exact_source_span: token.exact_span,
      raw_source_form: token.raw_form,
      typed_reason_code: 'TEST_ONLY_FORCED_RECONCILIATION_FAILURE',
      candidate_origin: 'RECONCILED_CATALOGUE_AND_BLIND_SCAN',
      governed_ordinal: token.governed_ordinal,
      evidence_excerpt_ids: token.evidence_excerpt_ids,
    };
    return freeze({
      schema_version: 'NOTICE_DEFINITION_SCOPE_UNRESOLVED_OUTCOME/V1',
      blocking_unresolved_outcome_id: contentId(
        'NOTICE_DEFINITION_SCOPE_UNRESOLVED_OUTCOME/V1',
        identity,
      ),
      ...identity,
      review_queue_visibility: 'REQUIRED',
    });
  });
  const blockingOutcomeByKey = new Map(blockingOutcomes.map((entry) => [[
    entry.exact_source_span.absolute_start,
    entry.exact_source_span.absolute_end,
    entry.raw_source_form,
  ].join(':'), entry]));
  const resolvedOwnedTokens = ownedTokens.filter(
    ({ token }) => token.governed_ordinal !== failedOrdinal,
  );
  const sourcePartyContexts = buildSourcePartyContexts(textBuffer);
  const sourcePartyContextIdByRaw = new Map(
    Object.entries(sourcePartyContexts).map(
      ([id, context]) => [context.raw_form, id],
    ),
  );
  const partyOutcomes = resolvedOwnedTokens
    .filter(({ token }) => token.kind === 'PARTY')
    .map(({ token, parentScopeIdentity }) => (
      buildPartyOutcome(
        token,
        parentScopeIdentity,
        sourcePartyContextIdByRaw,
      )
    ));
  const governanceOutcomes = resolvedOwnedTokens
    .filter(({ token }) => token.kind === 'GOVERNANCE')
    .map(({ token }) => buildGovernanceOutcome(
      token,
      textBuffer,
      sourcePartyContextIdByRaw,
    ));
  const terminalOutcomes = resolvedOwnedTokens
    .filter(({ token }) => [
      'SOURCE_DOCUMENT_DESIGNATION',
      'STATUTE_DESIGNATION',
      'REVIEWED_UNDEFINED_SOURCE_PRIMITIVE',
      'REVIEWED_NON_ENUMERABLE_SOURCE_PHRASE',
    ].includes(token.kind))
    .map(({ token, parentScopeIdentity }) => (
      buildReviewedTerminal(token, parentScopeIdentity)
  ));
  const partyOutcomeByKey = new Map(partyOutcomes.map(
    (entry) => [entry.governed_ordinal, entry],
  ));
  const governanceOutcomeByKey = new Map(governanceOutcomes.map(
    (entry) => [208222, entry],
  ));
  const terminalOutcomeByKey = new Map(terminalOutcomes.map(
    (entry) => [entry.governed_ordinal, entry],
  ));
  const f11RelationshipByOrdinal = new Map(
    input.qxo_no_shop_definition_control_f11.relationship_outcomes.map(
      (entry) => [
        entry.relationship_effect.exact_use_span.absolute_start,
        entry,
      ],
    ),
  );
  if (f11RelationshipByOrdinal.size
    !== input.qxo_no_shop_definition_control_f11.relationship_outcomes.length) {
    fail('F11_RELATIONSHIP_INVENTORY_DRIFT', 'F11 use ordinals are not unique');
  }
  const relationships = resolvedOwnedTokens
    .filter(({ token, parentDefinitionId }) => (
      (token.kind === 'DEFINITION' || token.kind === 'DEFINITION_PLURAL')
      && !(parentDefinitionId
        && reachedDefinitionByKey.get(token.definition_key)
          .definition_occurrence_id === parentDefinitionId
        && token.kind === 'DEFINITION_PLURAL')
    ))
    .map(({ token, parentDefinitionId }) => buildRelationship(
      token,
      parentDefinitionId,
      reachedDefinitionByKey.get(token.definition_key),
      f11RelationshipByOrdinal,
    ));
  const boundF11Ids = relationships
    .filter((entry) => entry.relationship_source === 'F11_CONTROLLED_EFFECT')
    .map((entry) => entry.definition_use_relationship_id)
    .sort();
  const expectedF11Ids =
    input.qxo_no_shop_definition_control_f11.relationship_outcomes
      .filter((entry) => (
        entry.relationship_effect.exact_use_span.absolute_start
          !== failedOrdinal
      ))
      .map((entry) => entry.relationship_effect.relationship_effect_revision_id)
      .sort();
  if (canonicalJson(boundF11Ids) !== canonicalJson(expectedF11Ids)) {
    fail('F11_RELATIONSHIP_SET_DRIFT', 'every applicable F11 effect must bind once');
  }

  const rootTokenOutcomes = rootTokens.map((token) => buildTokenOutcome(
    token,
    NOTICE_OCCURRENCE_ID,
    definitionByKey,
    partyOutcomeByKey,
    governanceOutcomeByKey,
    terminalOutcomeByKey,
    blockingOutcomeByKey,
  ));
  const definitionBodyTokenOutcomes = bodyTokenGroups.map(
    ({ definition, tokens }) => freeze({
      definition_occurrence_id: definition.definition_occurrence_id,
      token_outcomes: tokens.map((token) => buildTokenOutcome(
        token,
        definition.definition_occurrence_id,
        definitionByKey,
        partyOutcomeByKey,
        governanceOutcomeByKey,
        terminalOutcomeByKey,
        blockingOutcomeByKey,
      )),
    }),
  );
  const topology = deriveTopologicalOrder(definitions, relationships);
  const rootTokenIds = sortedUnique(rootTokenOutcomes.map(
    (entry) => entry.token_outcome_id,
  ));
  const definitionIds = sortedUnique(definitions.map(
    (entry) => entry.definition_occurrence_id,
  ));
  const relationshipIds = sortedUnique(relationships.map(
    (entry) => entry.definition_use_relationship_id,
  ));
  const partyIds = sortedUnique(partyOutcomes.map(
    (entry) => entry.party_token_outcome_id,
  ));
  const governanceIds = sortedUnique(governanceOutcomes.map(
    (entry) => entry.source_governance_context_id,
  ));
  const terminalIds = sortedUnique(terminalOutcomes.map(
    (entry) => entry.terminal_reviewed_outcome_id,
  ));
  const blockingIds = sortedUnique(blockingOutcomes.map(
    (entry) => entry.blocking_unresolved_outcome_id,
  ));
  const allScanSpans = [
    rootScope,
    ...definitions.flatMap((entry) => entry.ordered_body_spans),
  ];
  const allTokenOutcomes = [
    ...rootTokenOutcomes,
    ...definitionBodyTokenOutcomes.flatMap(
      (group) => group.token_outcomes,
    ),
  ];
  const blindScan = buildBlindCandidateDispositions(
    textBuffer,
    allScanSpans,
    allTokenOutcomes,
  );
  if (failedOrdinal == null
    && (blindScan.raw_observation_count !== 74
      || blindScan.candidate_count !== 65
      || blindScan.duplicate_scope_observation_count !== 9)) {
    fail('BLIND_CANDIDATE_INVENTORY_DRIFT', 'the reviewed blind inventory drifted');
  }
  const {
    dispositions: blindCandidateDispositions,
    ...blindScanSummary
  } = blindScan;
  const blindCandidateDispositionRegistry = freeze(Object.fromEntries(
    blindCandidateDispositions.map((entry) => {
      const {
        blind_candidate_disposition_id: id,
        ...record
      } = entry;
      return [id, record];
    }),
  ));
  const scanPolicy = freeze({
    schema_version: 'QXO_NO_SHOP_DEFINITION_SCOPE_SCAN_POLICY_F13/V1',
    coordinate_space: 'ADMITTED_SOURCE_UTF8_BYTES',
    catalogue_matcher: 'EXACT_CASE_SENSITIVE_UTF8_LONGEST_MATCH',
    catalogue_blind_candidate_scan:
      'QUOTED_OR_TITLE_CASE_SOURCE_CANDIDATES_REVIEWED',
    source_local_plural_rule:
      'EXACT_SINGULAR_PLUS_ASCII_LOWERCASE_S_SOURCE_USE_ONLY',
    automatic_alias_authority: 'NONE',
    parser_catalogue_authority: 'PROPOSAL_ONLY',
    ...blindScanSummary,
  });
  const scanPolicyDigest = contentId(
    'QXO_NO_SHOP_DEFINITION_SCOPE_SCAN_POLICY_F13/V1',
    scanPolicy,
  );
  const definitionControlScans = buildDefinitionControlScans(
    textBuffer,
    definitions,
    input.qxo_no_shop_definition_control_f11,
  );
  if (definitionControlScans.length !== definitions.length
    || definitionControlScans.some(
      (scan) => scan.conclusion_code !== 'CONTROLLING_DEFINITION_CONFIRMED',
    )) {
    fail('DEFINITION_CONTROL_SET_DRIFT', 'every reached definition needs control');
  }
  const evidenceSpanById = new Map();
  const registerEvidenceSpan = (item) => {
    evidenceSpanById.set(evidenceId(item), item);
  };
  {
    rootTokens.forEach((token) => registerEvidenceSpan(token.exact_span));
    bodyTokenGroups.forEach(({ tokens }) => tokens.forEach(
      (token) => registerEvidenceSpan(token.exact_span),
    ));
    definitions.forEach((definition) => {
      registerEvidenceSpan(definition.exact_declaration_span);
      definition.ordered_body_spans.forEach(registerEvidenceSpan);
    });
    registerEvidenceSpan(span(
      textBuffer,
      ...AGREEMENT_DECLARATION_CARRIER,
    ));
    Object.values(PARTY_DECLARATION_CARRIERS).forEach(
      (coordinates) => registerEvidenceSpan(span(textBuffer, ...coordinates)),
    );
    Object.values(COMPANY_BOARD_DECLARATION).forEach(
      (coordinates) => registerEvidenceSpan(span(textBuffer, ...coordinates)),
    );
    registerEvidenceSpan(span(textBuffer, 401406, 401606));
    blindCandidateDispositions.forEach(
      (entry) => registerEvidenceSpan(span(
        textBuffer,
        entry.absolute_start,
        entry.absolute_end,
      )),
    );
  }
  const evidenceBearingPayload = {
    rootTokenOutcomes,
    definitionBodyTokenOutcomes,
    relationships,
    partyOutcomes,
    governanceOutcomes,
    terminalOutcomes,
    blockingOutcomes,
    definitionControlScans,
    blindCandidateDispositions,
  };
  const referencedEvidenceIds = sortedUnique(
    collectEvidenceIds(evidenceBearingPayload),
  );
  const evidenceExcerpts = Object.fromEntries(referencedEvidenceIds.map((id) => {
    const evidenceSpan = evidenceSpanById.get(id);
    if (!evidenceSpan) {
      fail('EVIDENCE_REFERENCE_UNRESOLVED', `${id} has no exact source span`);
    }
    const record = buildEvidenceExcerpt(evidenceSpan);
    return [id, {
      absolute_start: record.absolute_start,
      absolute_end: record.absolute_end,
      exact_bytes_digest: record.exact_bytes_digest,
    }];
  }));
  const documentDefinitionInventory = freeze({
    schema_version: 'QXO_NO_SHOP_DOCUMENT_DEFINITION_INVENTORY_F13/V1',
    inventory_scope:
      'ROOT_REACHABLE_TRANSITIVE_GRAPH_NOT_FULL_DOCUMENT_DEFINITION_CATALOGUE',
    parser_envelope_id: PARSER_ENVELOPE_ID,
    parser_envelope_digest: PARSER_ENVELOPE_DIGEST,
    definition_occurrence_ids: definitionIds,
    ordered_root_token_outcome_ids: rootTokenOutcomes.map(
      (entry) => entry.token_outcome_id,
    ),
    ordered_definition_body_token_outcome_ids:
      definitionBodyTokenOutcomes.flatMap(
        (group) => group.token_outcomes.map((entry) => entry.token_outcome_id),
      ),
    catalogue_blind_candidate_inventory_digest:
      blindScan.candidate_inventory_digest,
    blind_candidate_disposition_ids: blindCandidateDispositions.map(
      (entry) => entry.blind_candidate_disposition_id,
    ),
    definition_control_scope_ids: definitionControlScans.map((entry) => (
      entry.definition_control_scope_closure_id
        || entry.predecessor_scope_closure_id
    )),
    dependency_maximum_depth: topology.maximum_depth,
    fixed_point_reached: blockingIds.length === 0,
  });
  const documentDefinitionInventoryDigest = contentId(
    'QXO_NO_SHOP_DOCUMENT_DEFINITION_INVENTORY_F13/V1',
    documentDefinitionInventory,
  );
  const resolutionState = blockingIds.length
    ? 'BLOCKING_UNRESOLVED'
    : terminalIds.length
      ? 'RESOLVED_WITH_REVIEW_NOTE'
      : 'RESOLVED_CLEAR';
  const closureIdentity = {
    notice_obligation_occurrence_id: NOTICE_OCCURRENCE_ID,
    document_hash: DOCUMENT_HASH,
    canonical_text_id: CANONICAL_TEXT_ID,
    root_scope_span: rootScope,
    scan_policy_digest: scanPolicyDigest,
    document_definition_inventory_digest: documentDefinitionInventoryDigest,
    root_token_outcome_ids: rootTokenIds,
    definition_occurrence_ids: definitionIds,
    definition_use_relationship_ids: relationshipIds,
    party_token_outcome_ids: partyIds,
    terminal_reviewed_outcome_ids: terminalIds,
    blocking_unresolved_outcome_ids: blockingIds,
    topological_definition_occurrence_ids: topology.ordered_ids,
    unresolved_outcome_count: blockingIds.length,
    review_note_outcome_count: terminalIds.length,
    fixed_point_state: blockingIds.length
      ? 'BLOCKING_UNRESOLVED'
      : 'REACHED',
    resolution_state: resolutionState,
  };
  const definitionScopeClosure = freeze({
    schema_version: 'NOTICE_DEFINITION_SCOPE_CLOSURE/V1',
    definition_scope_closure_id: contentId(
      'NOTICE_DEFINITION_SCOPE_CLOSURE/V1',
      closureIdentity,
    ),
    ...closureIdentity,
  });
  const blockers = blockingIds.length
    ? [
      'COPY_CLOCK_ITEM_OR_BATCH_CARDINALITY_UNRESOLVED',
      'NOTICE_COMPLETE_DEFINITION_SCOPE_UNRESOLVED',
      'NOTICE_REVISION_MATERIALISATION_DEFERRED',
    ]
    : [
      'COPY_CLOCK_ITEM_OR_BATCH_CARDINALITY_UNRESOLVED',
      'NOTICE_REVISION_MATERIALISATION_DEFERRED',
    ];
  const body = {
    schema_version: 'QXO_NO_SHOP_DEFINITION_SCOPE_CLOSURE_F13/V1',
    authority_scope: AUTHORITY_SCOPE,
    contract_binding: {
      contract_key: input.contract_bundle.contract_key,
      contract_fingerprint: input.contract_bundle.fingerprint,
      notice_schema_version: 5,
      closure_schema: 'NOTICE_DEFINITION_SCOPE_CLOSURE/V1',
      closure_contract_digest: contentId(
        'NOTICE_DEFINITION_SCOPE_CLOSURE/V1',
        NOTICE_DEFINITION_SCOPE_CLOSURE_V1,
      ),
    },
    source_binding:
      input.qxo_no_shop_notice_source_binding_f6.source_binding,
    upstream_bindings: {
      admitted_parser_proposal_envelope_id: PARSER_ENVELOPE_ID,
      admitted_parser_proposal_envelope_payload_digest:
        PARSER_ENVELOPE_DIGEST,
      qxo_no_shop_notice_source_binding_f6_id: F6_SOURCE_ID,
      qxo_no_shop_notice_source_binding_f6_payload_digest: F6_SOURCE_DIGEST,
      qxo_no_shop_definition_relationships_f8_id: F8_RELATIONSHIPS_ID,
      qxo_no_shop_definition_relationships_f8_payload_digest:
        F8_RELATIONSHIPS_DIGEST,
      qxo_no_shop_notice_receipt_f10_id: F10_NOTICE_ID,
      qxo_no_shop_notice_receipt_f10_payload_digest: F10_NOTICE_DIGEST,
      qxo_no_shop_definition_control_f11_id: F11_CONTROL_ID,
      qxo_no_shop_definition_control_f11_payload_digest: F11_CONTROL_DIGEST,
    },
    scan_policy: scanPolicy,
    definition_control_scans: definitionControlScans,
    blind_candidate_dispositions: blindCandidateDispositionRegistry,
    evidence_excerpts: evidenceExcerpts,
    source_party_contexts: sourcePartyContexts,
    reached_transitive_definition_graph: documentDefinitionInventory,
    root_token_outcomes: rootTokenOutcomes,
    definition_body_token_outcomes: definitionBodyTokenOutcomes,
    definition_occurrences: definitions,
    definition_use_relationships: relationships,
    party_token_outcomes: partyOutcomes,
    governance_designation_outcomes: governanceOutcomes,
    reviewed_terminal_outcomes: terminalOutcomes,
    blocking_unresolved_outcomes: blockingOutcomes,
    definition_scope_closure: definitionScopeClosure,
    notice_child_state_projection: {
      notice_obligation_occurrence_id: NOTICE_OCCURRENCE_ID,
      notice_obligation_revision_id: null,
      definition_scope_closure_id:
        definitionScopeClosure.definition_scope_closure_id,
      child_resolution_states: [
        {
          child_key: 'DEFINITION_SCOPE',
          resolution_state: resolutionState,
        },
        {
          child_key: 'DEFINITION_USES',
          resolution_state: blockingIds.length
            ? 'BLOCKING_UNRESOLVED'
            : 'RESOLVED_CLEAR',
        },
        {
          child_key: 'DEFINITION_DEPENDENCY',
          resolution_state: resolutionState,
        },
      ],
      materialisation_authority: 'NONE',
    },
    status: {
      review_renderable: true,
      root_inventory_complete: true,
      transitive_fixed_point_reached: blockingIds.length === 0,
      definition_scope_state: resolutionState,
      definition_node_count: definitionIds.length,
      definition_relationship_count: relationshipIds.length,
      reviewed_terminal_count: terminalIds.length,
      unresolved_outcome_count: blockingIds.length,
      publication_blocked: true,
      comparison_blocked: true,
      absence_authority: 'NONE',
      canonical_write_authority: 'NONE',
      publication_authority: 'NONE',
      relationship_authority: 'NONE',
      result_authority: 'NONE',
      metric_authority: 'NONE',
      comparability_authority: 'NONE',
      query_authority: 'NONE',
      serving_authority: 'NONE',
      release_authority: 'NONE',
      release_eligible: false,
      blocker_codes: blockers,
    },
  };
  const carrier = freeze({
    ...body,
    qxo_no_shop_definition_scope_closure_f13_id: contentId(
      'QXO_NO_SHOP_DEFINITION_SCOPE_CLOSURE_F13/V1',
      body,
    ),
    canonical_payload_digest: contentId(
      'QXO_NO_SHOP_DEFINITION_SCOPE_CLOSURE_F13_PAYLOAD/V1',
      body,
    ),
  });
  validateCarrierIdentity(carrier);
  return carrier;
}

function validateQxoNoShopDefinitionScopeClosureF13({
  qxo_no_shop_definition_scope_closure_f13: carrier,
  ...input
} = {}) {
  validateCarrierIdentity(carrier);
  if (canonicalJson(carrier) !== canonicalJson(buildCarrier(input))) {
    fail('CARRIER_DRIFT', 'the QXO F13 definition closure carrier has drifted');
  }
  return true;
}

module.exports = {
  AUTHORITY_SCOPE,
  DEFINITION_SPECS,
  EXPECTED_ROOT_SPANS,
  MAX_CARRIER_BYTES,
  QxoNoShopDefinitionScopeClosureF13Error,
  buildQxoNoShopDefinitionScopeClosureF13: buildCarrier,
  buildQxoNoShopDefinitionScopeClosureF13FailureAttestation:
    (input, governedOrdinal) => buildCarrier(input, governedOrdinal),
  validateQxoNoShopDefinitionScopeClosureF13,
  validateQxoNoShopDefinitionScopeClosureF13CarrierIdentity:
    validateCarrierIdentity,
  __test: {
    buildBlindCandidateDispositions,
    deriveTopologicalOrder,
    ownedScopedTokens,
  },
};
