#!/usr/bin/env node
//
// Builds example-one-deal-package/ deterministically. Running it twice
// produces byte-identical files; running it after any edit to verify.mjs
// re-derives every content ID from the edited rule, so the example and the
// verifier can never silently disagree.
//
// It makes NO network call and NO model call. It reads exactly two things
// outside its own directory: the producer's lib/canonical-v2/canonical-bytes.js,
// which it uses only to CROSS-CHECK the copy of the ID rule embedded in
// verify.mjs, and nothing else. If that module is not resolvable (as it will
// not be for a consumer holding only a package) the cross-check is reported as
// skipped and the build continues on verify.mjs's own copy.
//
// The deal identity here is deliberately impossible: CIK 0000000000 is not
// issuable and accession 0000000000-00-000000 is not a real accession number.
// The text is invented. Nothing in this example refers to a real transaction.
//
// Usage: node build-example.mjs [--check]
//        --check rebuilds into a temporary directory and fails if the
//        committed example differs, without touching the committed files.

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import {
  cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

import {
  DOMAIN, REVIEW_STATES, RECORD_KEYS, canonicalJson, contentId, sha256Hex, utf8ByteLength,
  assertIdRuleSelfTest, dealKeyOf, rollUpReviewState, validStateCombination,
  verifyPackage, PACKAGE_SCHEMA_VERSION, typedValueProblem, unitFor, sortValueFor,
} from './verify.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const EXAMPLE_DIR = join(HERE, 'example-one-deal-package');
const PRODUCER_MODULE = resolve(HERE, '../../../../../lib/canonical-v2/canonical-bytes.js');

/* ---------------------------------------------------------------- *
 * 0. The ID rule in verify.mjs must be the producer's ID rule.       *
 * ---------------------------------------------------------------- */

function crossCheckIdRule() {
  assertIdRuleSelfTest();
  if (!existsSync(PRODUCER_MODULE)) {
    return 'SKIPPED (producer module not resolvable from here)';
  }
  const require = createRequire(import.meta.url);
  const producer = require(PRODUCER_MODULE);
  const vectors = [
    ['DEAL_TERMS_DEAL_KEY/V1', { a: 1, b: ['x', null], c: { d: true } }],
    ['DEAL_TERMS_CLAIM_REVISION/V1', { nested: { deep: [1, 2, { z: 'ü — ß' }] }, empty: [] }],
    ['DEAL_TERMS_RELEASE_MANIFEST/V1', { zebra: false, alpha: 'A', mid: null }],
  ];
  for (const [domain, payload] of vectors) {
    const mine = contentId(domain, payload);
    const theirs = producer.contentId(domain, payload);
    if (mine !== theirs) {
      throw new Error(`contentId disagrees with lib/canonical-v2/canonical-bytes.js for ${domain}: ${mine} vs ${theirs}`);
    }
    if (canonicalJson(payload) !== producer.canonicalJson(payload)) {
      throw new Error(`canonicalJson disagrees with the producer module for ${domain}`);
    }
  }
  for (const sample of ['', 'a', 'ü — ß', 'x'.repeat(1000)]) {
    if (sha256Hex(sample) !== producer.sha256Hex(sample)) {
      throw new Error('sha256Hex disagrees with the producer module');
    }
    if (utf8ByteLength(sample) !== producer.utf8ByteLength(sample)) {
      throw new Error('utf8ByteLength disagrees with the producer module');
    }
  }
  return 'PASS (agrees with lib/canonical-v2/canonical-bytes.js on 3 content-ID and 8 hash vectors)';
}

/* ---------------------------------------------------------------- *
 * 1. Synthetic source text and byte-exact spans.                     *
 * ---------------------------------------------------------------- */

// One invented clause set. The en dash below is three UTF-8 bytes, so any
// verifier that measured spans in UTF-16 code units instead of UTF-8 bytes
// would fail on this example. That is deliberate.
const ARTICLE_VII = 'ARTICLE VII';
const GOVERNING_CHAPEAU = 'The following Sections govern termination of this Agreement and the '
  + 'fees and expenses payable on termination.';
const SECTION_6_01 = 'Section 6.01 Conditions. The obligations of each party to effect the '
  + 'Merger are subject to the receipt of the Requisite Stockholder Approval.';
const SECTION_7_03 = 'Section 7.03 Termination Fee. If this Agreement is terminated by Parent '
  + 'pursuant to Section 7.01(c), the Company shall pay to Parent a fee of '
  + 'twelve million dollars ($12,000,000) — the "Company Termination Fee" — '
  + 'within two Business Days after such termination, without interest and '
  + 'without any escrow or holdback.';
const SECTION_7_04 = 'Section 7.04 Parent Fee. If this Agreement is terminated by the Company '
  + 'pursuant to Section 7.01(d), Parent shall pay to the Company an amount '
  + 'equal to the Company Termination Fee, unless the Regulatory Condition '
  + 'shall then be capable of satisfaction, in which case such amount shall '
  + 'be as the parties may then agree.';
const SECTION_7_05 = 'Section 7.05 Expense Reimbursement. The Company shall reimburse the '
  + 'documented out-of-pocket expenses of Parent up to five hundred thousand '
  + 'dollars ($500,000).';

const SYNTHETIC_TEXT = [
  'ARTICLE VI',
  '',
  SECTION_6_01,
  '',
  ARTICLE_VII,
  '',
  GOVERNING_CHAPEAU,
  '',
  SECTION_7_03,
  '',
  SECTION_7_04,
  '',
  SECTION_7_05,
  '',
].join('\n');

const SOURCE_BYTES = Buffer.from(SYNTHETIC_TEXT, 'utf8');

// A synthetic M2 structure: named nodes with half-open UTF-8 byte extents.
function byteSpanOf(needle) {
  const start = SOURCE_BYTES.indexOf(Buffer.from(needle, 'utf8'));
  if (start < 0) throw new Error(`synthetic span not found: ${needle.slice(0, 40)}`);
  const end = start + Buffer.byteLength(needle, 'utf8');
  const text = SOURCE_BYTES.subarray(start, end).toString('utf8');
  if (!Buffer.from(text, 'utf8').equals(SOURCE_BYTES.subarray(start, end))) {
    throw new Error('span does not fall on a code-point boundary');
  }
  return { start_byte: start, end_byte: end, text_sha256: sha256Hex(text), text };
}

const nodeIdOf = (seed) => contentId('DEAL_TERMS_EXAMPLE_M2_NODE/V1', { seed });

function spanOf(needle, nodeSeed) {
  const { start_byte, end_byte, text_sha256, text } = byteSpanOf(needle);
  return {
    node_occurrence_id: nodeIdOf(nodeSeed),
    start_byte,
    end_byte,
    text_sha256,
    excerpt_text: text,
  };
}

// An evidence span for one field: the same geometry, keyed to a source unit.
function evidenceSpanOf(needle, nodeSeed) {
  const { start_byte, end_byte, text_sha256, text } = byteSpanOf(needle);
  return {
    source_unit_id: nodeIdOf(nodeSeed),
    start_byte,
    end_byte,
    text_sha256,
    excerpt_text: text,
  };
}

// A governed authored unit: its full canonical text plus its context spans.
function sourceUnit(nodeSeed, heading, documentOrder, needle, contexts = []) {
  const extent = byteSpanOf(needle);
  return {
    node_occurrence_id: nodeIdOf(nodeSeed),
    heading_or_reference: heading,
    document_order: documentOrder,
    ...extent,
    context_spans: contexts.map(({ kind, seed, text: contextNeedle }) => ({
      kind,
      node_occurrence_id: nodeIdOf(seed),
      ...byteSpanOf(contextNeedle),
    })),
  };
}

/* ---------------------------------------------------------------- *
 * 2. Deal identity and provenance.                                   *
 * ---------------------------------------------------------------- */

const DEAL_IDENTITY = {
  source_system: 'SEC_EDGAR',
  issuer_cik: '0000000000',
  accession: '0000000000-00-000000',
  document_role_key: 'MERGER_AGREEMENT',
};
const DEAL_KEY = dealKeyOf(DEAL_IDENTITY);

// The consumer mints this, not the producer. It is reproduced here only so the
// example shows a package carrying one; PM computes it from nothing and copies
// it out of the corpus manifest. Payload shape is Q-0001 section 2's
// PUBLIC_MA_DEAL/V1; the package calls the resulting ID transaction_id, to keep
// it distinct from the per-document deal_key.
const TRANSACTION_ID = sha256Hex(canonicalJson({
  schema: 'PUBLIC_MA_DEAL/V1',
  payload: {
    target_cik: '0000000000',
    transaction_anchor: {
      issuer_cik: DEAL_IDENTITY.issuer_cik,
      accession_number: DEAL_IDENTITY.accession,
      document_role: DEAL_IDENTITY.document_role_key,
    },
    announced_transaction_ordinal: 0,
  },
}));

// Producer-side identities a package quotes but a consumer cannot recompute
// without the producer's inputs. In a real package these come from the run;
// here they are derived from the synthetic content so the example is
// reproducible and obviously synthetic.
const synthetic = (label) => contentId('DEAL_TERMS_EXAMPLE_PRODUCER_ID/V1', {
  label, deal_key: DEAL_KEY, canonical_text_sha256: sha256Hex(SYNTHETIC_TEXT),
});

const PROVENANCE = {
  agreement_id: synthetic('agreement_id'),
  canonical_text_id: synthetic('canonical_text_id'),
  canonical_text_sha256: sha256Hex(SYNTHETIC_TEXT),
  canonical_text_byte_length: SOURCE_BYTES.length,
  coordinate_system: 'UTF8_CANONICAL_TEXT_HALF_OPEN',
  immutable_source_document_id: synthetic('immutable_source_document_id'),
  source_response_content_id: synthetic('source_response_content_id'),
  source_admission_manifest_id: synthetic('source_admission_manifest_id'),
  admission_receipt_id: synthetic('admission_receipt_id'),
  raw_source_sha256: synthetic('raw_source_sha256'),
  raw_source_byte_length: SOURCE_BYTES.length * 2,
  retrieval_url_sha256: synthetic('retrieval_url_sha256'),
  // From the admitted-source receipt. A real package copies these out of the
  // receipt; a receipt that did not record them yields null, and a package with
  // any null here cannot be PUBLIC.
  sec_document_name: 'synthetic-exhibit-2-1.htm',
  sec_document_sequence: 1,
};

/* ---------------------------------------------------------------- *
 * 3. Claims.                                                         *
 * ---------------------------------------------------------------- */

function displayField({
  fieldKey, label, factState, valueType, typedValue = null, renderedValue,
  evidenceSpans = [], examinedSourceUnitId = null, reasonCode = null,
}) {
  if (factState === 'PRESENT') {
    const problem = typedValueProblem(valueType, typedValue);
    if (problem !== null) throw new Error(`example builds an invalid ${valueType}: ${problem}`);
  } else if (typedValue !== null) {
    throw new Error(`example gives ${factState} a typed value`);
  }
  const present = factState === 'PRESENT';
  return {
    field_key: fieldKey,
    label,
    fact_state: factState,
    value_type: valueType,
    typed_value: typedValue,
    unit: present ? unitFor(valueType, typedValue) : null,
    sort_value: present ? sortValueFor(valueType, typedValue) : null,
    evidence_spans: evidenceSpans,
    examined_source_unit_id: examinedSourceUnitId,
    reason_code: reasonCode,
    rendered_value: renderedValue,
    rendered_value_digest: sha256Hex(renderedValue),
    typed_value_digest: sha256Hex(canonicalJson(typedValue)),
  };
}

function claim({
  occurrenceSeed, familyKey, definitionKey, classification, sectionReference,
  state, reasonCodes, limitation = null, fields, spans,
}) {
  const [extraction, quality, review] = state;
  if (!validStateCombination(extraction, quality, review)) {
    throw new Error(`example builds an illegal state combination ${extraction}/${quality}/${review}`);
  }
  const body = {
    claim_occurrence_id: contentId('DEAL_TERMS_EXAMPLE_M4_OCCURRENCE/V1', { seed: occurrenceSeed }),
    family_key: familyKey,
    claim_definition_key: definitionKey,
    classification_levels: classification,
    section_reference: sectionReference,
    state: { extraction_state: extraction, source_quality: quality, review_state: review },
    reason_codes: reasonCodes,
    limitation,
    fields,
    source: {
      node_occurrence_ids: [...new Set(spans.map((span) => span.node_occurrence_id))].sort(),
      coordinate_system: 'UTF8_CANONICAL_TEXT_HALF_OPEN',
      spans,
    },
  };
  return { ...body, claim_revision_id: contentId(DOMAIN.CLAIM_REVISION, body) };
}

const TERMINATION_FEE_PATH = ['Termination fee', 'Reverse and company termination fees'];

// The governed authored units, in document order, with their context spans.
// Section 7.03 carries both an Article chapeau and a governing chapeau, which
// is what a real closure looks like under the re-plan's source-closure rule.
const SOURCE_UNITS = [
  sourceUnit('section-6-01', 'Section 6.01 Conditions', 0, SECTION_6_01),
  sourceUnit('section-7-03', 'Section 7.03 Termination Fee', 1, SECTION_7_03, [
    { kind: 'ARTICLE_CHAPEAU', seed: 'article-vii', text: ARTICLE_VII },
    { kind: 'GOVERNING_CHAPEAU', seed: 'governing-chapeau', text: GOVERNING_CHAPEAU },
  ]),
  sourceUnit('section-7-04', 'Section 7.04 Parent Fee', 2, SECTION_7_04, [
    { kind: 'ARTICLE_CHAPEAU', seed: 'article-vii', text: ARTICLE_VII },
  ]),
  sourceUnit('section-7-05', 'Section 7.05 Expense Reimbursement', 3, SECTION_7_05, [
    { kind: 'GOVERNING_CHAPEAU', seed: 'governing-chapeau', text: GOVERNING_CHAPEAU },
  ]),
];

const CLAIMS = [
  claim({
    occurrenceSeed: 'company-termination-fee',
    familyKey: 'TERMINATION_FEE',
    definitionKey: 'TERMINATION_FEE_AMOUNT_PRESENT',
    classification: [
      { level: 'APPLIES_TO', value: 'Company' },
      { level: 'PROVISION_TYPE', value: TERMINATION_FEE_PATH[0] },
      { level: 'SUB_PROVISION_TYPE', value: TERMINATION_FEE_PATH[1] },
    ],
    sectionReference: 'Section 7.03',
    state: ['COMPLETE', 'SUFFICIENT', 'NORMAL'],
    reasonCodes: [],
    fields: [
      displayField({
        fieldKey: 'fee_amount',
        label: 'Fee amount',
        factState: 'PRESENT',
        valueType: 'MONEY',
        typedValue: { amount: 12000000, currency: 'USD' },
        renderedValue: 'USD 12,000,000',
        evidenceSpans: [evidenceSpanOf('twelve million dollars ($12,000,000)', 'section-7-03')],
      }),
      displayField({
        fieldKey: 'payment_deadline',
        label: 'Payment deadline',
        factState: 'PRESENT',
        valueType: 'DURATION',
        typedValue: { bound_type: 'WITHIN', count: 2, unit: 'DAY' },
        renderedValue: 'Within two days after termination',
        evidenceSpans: [evidenceSpanOf('within two Business Days after such termination', 'section-7-03')],
      }),
      // false is a value, not an absence: fact_state PRESENT.
      displayField({
        fieldKey: 'escrow_required',
        label: 'Escrow required',
        factState: 'PRESENT',
        valueType: 'BOOLEAN',
        typedValue: false,
        renderedValue: 'No',
        evidenceSpans: [evidenceSpanOf('without any escrow or holdback', 'section-7-03')],
      }),
      // ABSENT: the clause was read and says nothing about interest.
      displayField({
        fieldKey: 'interest_rate',
        label: 'Interest on late payment',
        factState: 'ABSENT',
        valueType: 'PERCENTAGE',
        renderedValue: 'Not stated in this Section',
        examinedSourceUnitId: nodeIdOf('section-7-03'),
      }),
      // NOT_APPLICABLE: the profile field does not apply to this subtype.
      displayField({
        fieldKey: 'trigger_regulatory_condition',
        label: 'Regulatory-condition trigger',
        factState: 'NOT_APPLICABLE',
        valueType: 'ENUM',
        renderedValue: 'Not applicable to a company termination fee',
        reasonCode: 'FIELD_NOT_IN_SUBTYPE_PROFILE',
      }),
    ],
    spans: [spanOf(SECTION_7_03, 'section-7-03')],
  }),
  claim({
    occurrenceSeed: 'parent-fee',
    familyKey: 'TERMINATION_FEE',
    definitionKey: 'TERMINATION_FEE_AMOUNT_PRESENT',
    classification: [
      { level: 'APPLIES_TO', value: 'Parent' },
      { level: 'PROVISION_TYPE', value: TERMINATION_FEE_PATH[0] },
      { level: 'SUB_PROVISION_TYPE', value: TERMINATION_FEE_PATH[1] },
    ],
    sectionReference: 'Section 7.04',
    state: ['AMBIGUOUS', 'DRAFTING_AMBIGUOUS', 'REVIEW_ONLY'],
    reasonCodes: ['DEPENDENCY_UNRESOLVED', 'MATERIAL_SPAN_UNMODELLED'],
    fields: [
      // FAILED: extraction could not resolve it, and the claim says why.
      displayField({
        fieldKey: 'fee_amount',
        label: 'Fee amount',
        factState: 'FAILED',
        valueType: 'MONEY',
        renderedValue: 'Not resolved: stated by reference and left open',
      }),
      // NOT_EXAMINED: this subtype profile does not carry the field at all.
      displayField({
        fieldKey: 'escrow_required',
        label: 'Escrow required',
        factState: 'NOT_EXAMINED',
        valueType: 'BOOLEAN',
        renderedValue: 'Not examined',
      }),
    ],
    spans: [spanOf(SECTION_7_04, 'section-7-04')],
  }),
  claim({
    occurrenceSeed: 'expense-reimbursement',
    familyKey: 'TERMINATION_FEE',
    definitionKey: 'TERMINATION_FEE_AMOUNT_PRESENT',
    classification: [
      { level: 'APPLIES_TO', value: 'Company' },
      { level: 'PROVISION_TYPE', value: TERMINATION_FEE_PATH[0] },
      { level: 'SUB_PROVISION_TYPE', value: TERMINATION_FEE_PATH[1] },
    ],
    sectionReference: 'Section 7.05',
    state: ['COMPLETE', 'SOURCE_LIMITED', 'APPROVED_LIMITED'],
    reasonCodes: [],
    limitation: {
      code: 'TRIGGER_NOT_EXPRESSLY_STATED',
      text: 'Not expressly stated in the complete reviewed clause: the Section '
        + 'caps reimbursable expenses but does not state the termination events '
        + 'that trigger reimbursement.',
      ruling_id: contentId('DEAL_TERMS_EXAMPLE_RULING/V1', { seed: 'expense-reimbursement-limitation' }),
    },
    fields: [
      displayField({
        fieldKey: 'expense_cap',
        label: 'Expense cap',
        factState: 'PRESENT',
        valueType: 'MONEY',
        typedValue: { amount: 500000, currency: 'USD' },
        renderedValue: 'USD 500,000',
        evidenceSpans: [evidenceSpanOf('five hundred thousand '
          + 'dollars ($500,000)', 'section-7-05')],
      }),
    ],
    spans: [spanOf(SECTION_7_05, 'section-7-05')],
  }),
  claim({
    occurrenceSeed: 'stockholder-approval-condition',
    familyKey: 'CLOSING_CONDITIONS',
    definitionKey: 'CLOSING_CONDITION_PRESENT',
    classification: [
      { level: 'APPLIES_TO', value: 'Both parties' },
      { level: 'PROVISION_TYPE', value: 'Closing conditions' },
      { level: 'SUB_PROVISION_TYPE', value: 'Mutual conditions' },
    ],
    sectionReference: 'Section 6.01',
    state: ['COMPLETE', 'SUFFICIENT', 'NO_OUTPUT'],
    reasonCodes: ['NOT_MODELLED_AS_A_COMPARABLE_TERM'],
    fields: [],
    spans: [spanOf(SECTION_6_01, 'section-6-01')],
  }),
].sort((left, right) => (left.claim_occurrence_id < right.claim_occurrence_id ? -1 : 1));

/* ---------------------------------------------------------------- *
 * 4. Category summaries. One per (family, classification path), over *
 *    every claim except those in review state NO_OUTPUT.             *
 * ---------------------------------------------------------------- */

function categorySummaries(claims) {
  const groups = new Map();
  for (const item of claims) {
    if (item.state.review_state === 'NO_OUTPUT') continue;
    const path = item.classification_levels.slice(1).map((level) => level.value);
    const key = `${item.family_key} ${canonicalJson(path)}`;
    if (!groups.has(key)) groups.set(key, { family_key: item.family_key, classification_path: path, items: [] });
    groups.get(key).items.push(item);
  }
  return [...groups.values()]
    .map((group) => {
      const states = group.items.map((item) => item.state.review_state);
      const body = {
        family_key: group.family_key,
        classification_path: group.classification_path,
        claim_occurrence_ids: group.items.map((item) => item.claim_occurrence_id).sort(),
        counts: Object.fromEntries(REVIEW_STATES.map((state) => [
          state, states.filter((value) => value === state).length,
        ])),
        summary_review_state: rollUpReviewState(states),
      };
      return { ...body, category_summary_id: contentId(DOMAIN.CATEGORY_SUMMARY, body) };
    })
    .sort((left, right) => (left.category_summary_id < right.category_summary_id ? -1 : 1));
}

/* ---------------------------------------------------------------- *
 * 5. Assemble and write.                                            *
 * ---------------------------------------------------------------- */

// The approved transaction-selection record this corpus_id comes from. In a
// real package Ben approves it and the producer copies its content ID out; here
// it is built synthetically so the example is self-contained and reproducible.
const SELECTION = (() => {
  const body = {
    schema_version: 'SHARED_50_DEAL_SELECTION/V1',
    purpose: 'INTERNAL_PROOF',
    required_deal_count: 1,
    selection_rule_version: 'SYNTHETIC_EXAMPLE_RULE/V1',
    approved_by: 'Ben',
    approved_on: '2026-09-03',
    ben_approval_id: contentId('DEAL_TERMS_EXAMPLE_APPROVAL/V1', { seed: 'one-deal-example' }),
    deals: [{
      ordinal: 0,
      deal_id: TRANSACTION_ID,
      target_cik: '0000000000',
      transaction_anchor: {
        issuer_cik: DEAL_IDENTITY.issuer_cik,
        accession_number: DEAL_IDENTITY.accession,
        document_role: DEAL_IDENTITY.document_role_key,
      },
      required_agreements: [{
        agreement_role: 'merger_agreement',
        issuer_cik: DEAL_IDENTITY.issuer_cik,
        accession_number: DEAL_IDENTITY.accession,
        document_name: 'synthetic-exhibit-2-1.htm',
        document_role: DEAL_IDENTITY.document_role_key,
        required: true,
      }],
    }],
  };
  return {
    corpus_id: contentId('SHARED_50_DEAL_SELECTION/V1', body),
    selection_record_sha256: sha256Hex(canonicalJson(body)),
    ben_approval_id: body.ben_approval_id,
  };
})();

const RELEASED_AT = '2026-09-03T00:00:00Z';
// A synthetic producer commit: this example is not cut from a real run, and a
// real 40-hex commit here would assert a provenance that does not exist.
const PRODUCER_COMMIT = '0'.repeat(40);

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function buildInto(root) {
  rmSync(root, { recursive: true, force: true });
  mkdirSync(join(root, 'deals', DEAL_KEY), { recursive: true });
  mkdirSync(join(root, 'corpus'), { recursive: true });
  mkdirSync(join(root, 'source_units'), { recursive: true });

  const summaries = categorySummaries(CLAIMS);

  const sourceUnitBody = {
    schema_version: 'DEAL_TERMS_SOURCE_UNIT_SET/V1',
    deal_key: DEAL_KEY,
    units: SOURCE_UNITS,
    counts: {
      units: SOURCE_UNITS.length,
      context_spans: SOURCE_UNITS.reduce((total, unit) => total + unit.context_spans.length, 0),
    },
  };
  const sourceUnitSet = {
    ...sourceUnitBody,
    source_unit_set_id: contentId(DOMAIN.SOURCE_UNIT_SET, sourceUnitBody),
  };
  writeFileSync(join(root, 'source_units', `${DEAL_KEY}.json`), stableJson(sourceUnitSet));

  const dealBody = {
    schema_version: 'DEAL_TERMS_DEAL_DOCUMENT/V1',
    deal_key: DEAL_KEY,
    transaction_id: TRANSACTION_ID,
    deal_identity: DEAL_IDENTITY,
    provenance: PROVENANCE,
    source_unit_set_id: sourceUnitSet.source_unit_set_id,
    claims: CLAIMS,
    category_summaries: summaries,
    counts: {
      claims: CLAIMS.length,
      category_summaries: summaries.length,
      families: [...new Set(CLAIMS.map((item) => item.family_key))].length,
      by_review_state: Object.fromEntries(REVIEW_STATES.map((state) => [
        state, CLAIMS.filter((item) => item.state.review_state === state).length,
      ])),
    },
  };
  const dealDocument = { ...dealBody, deal_document_id: contentId(DOMAIN.DEAL_DOCUMENT, dealBody) };
  writeFileSync(join(root, 'deals', DEAL_KEY, 'deal.json'), stableJson(dealDocument));

  // corpus_id is the content ID of Ben's approved transaction-selection record.
  // The package carries it; it is never recomputed from the document keys.
  const corpusBody = {
    schema_version: 'DEAL_TERMS_CORPUS_MANIFEST/V1',
    corpus_id: SELECTION.corpus_id,
    corpus_kind: 'ONE_DEAL',
    selection_record_sha256: SELECTION.selection_record_sha256,
    ben_approval_id: SELECTION.ben_approval_id,
    transactions: [{
      transaction_id: TRANSACTION_ID,
      documents: [{
        deal_key: DEAL_KEY,
        source_system: DEAL_IDENTITY.source_system,
        issuer_cik: DEAL_IDENTITY.issuer_cik,
        accession: DEAL_IDENTITY.accession,
        document_role_key: DEAL_IDENTITY.document_role_key,
        sec_document_name: PROVENANCE.sec_document_name,
        sec_document_sequence: PROVENANCE.sec_document_sequence,
        agreement_id: PROVENANCE.agreement_id,
        canonical_text_sha256: PROVENANCE.canonical_text_sha256,
        source_admission_manifest_id: PROVENANCE.source_admission_manifest_id,
        admission_receipt_id: PROVENANCE.admission_receipt_id,
      }],
    }],
    counts: { transaction_count: 1, document_count: 1 },
  };
  const corpus = { ...corpusBody, corpus_manifest_id: contentId(DOMAIN.CORPUS_MANIFEST, corpusBody) };
  writeFileSync(join(root, 'corpus', 'corpus-manifest.json'), stableJson(corpus));

  // A package ships the verifier it is verified with, byte for byte.
  cpSync(join(HERE, 'verify.mjs'), join(root, 'verify.mjs'));

  const files = walk(root)
    .filter((path) => path !== 'manifest.json')
    .sort()
    .map((path) => {
      const bytes = readFileSync(join(root, path));
      return { path, sha256: sha256Hex(bytes), byte_length: bytes.length };
    });

  const manifestBody = {
    schema_version: 'DEAL_TERMS_RELEASE_MANIFEST/V1',
    package_schema_version: PACKAGE_SCHEMA_VERSION,
    production_release_id: contentId('DEAL_TERMS_PRODUCTION_RELEASE/V1', {
      corpus_id: corpus.corpus_id,
      producer_commit: PRODUCER_COMMIT,
      released_at: RELEASED_AT,
      release_state: 'REVIEW_ONLY_INTERNAL',
      release_sequence: 1,
    }),
    supersedes_release_manifest_id: null,
    release_sequence: 1,
    producer_commit: PRODUCER_COMMIT,
    release_state: 'REVIEW_ONLY_INTERNAL',
    public: false,
    released_at: RELEASED_AT,
    corpus: {
      corpus_id: corpus.corpus_id,
      corpus_kind: corpus.corpus_kind,
      corpus_manifest_id: corpus.corpus_manifest_id,
      corpus_manifest_path: 'corpus/corpus-manifest.json',
    },
    deals: [{
      deal_key: DEAL_KEY,
      deal_document_id: dealDocument.deal_document_id,
      path: `deals/${DEAL_KEY}/deal.json`,
      source_units_path: `source_units/${DEAL_KEY}.json`,
    }],
    files,
    counts: {
      deals: 1,
      files: files.length,
      claims: CLAIMS.length,
      category_summaries: summaries.length,
      source_units: SOURCE_UNITS.length,
    },
  };
  const manifest = {
    ...manifestBody,
    release_manifest_id: contentId(DOMAIN.RELEASE_MANIFEST, manifestBody),
  };
  writeFileSync(join(root, 'manifest.json'), stableJson(manifest));
  return { manifest, dealDocument, corpus };
}

function walk(root, relativeDir = '') {
  const absolute = relativeDir ? join(root, relativeDir) : root;
  const out = [];
  for (const entry of readdirSync(absolute, { withFileTypes: true })) {
    const rel = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...walk(root, rel));
    else if (entry.isFile()) out.push(rel);
  }
  return out;
}

function snapshot(root) {
  return walk(root).sort().map((path) => `${path} ${sha256Hex(readFileSync(join(root, path)))}`).join('\n');
}

/* ---------------------------------------------------------------- *
 * 6. The schema must list exactly the fields the verifier enforces.  *
 * ---------------------------------------------------------------- */

// JSON.parse silently keeps the last of two members with the same name, so a
// duplicate-key defect survives every parse-based check. This walks the raw
// token stream and reports any object that declares a name twice. Q-0002 s6
// reported duplicates in draft 1; this guard shows there were none, and makes
// sure a real one can never ship unnoticed.
function duplicateJsonKeys(text) {
  const duplicates = [];
  const stack = [];
  let i = 0;
  let expectKey = false;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '"') {
      let j = i + 1;
      let raw = '';
      while (j < text.length && text[j] !== '"') {
        if (text[j] === '\\') { raw += text[j] + text[j + 1]; j += 2; continue; }
        raw += text[j];
        j += 1;
      }
      const value = JSON.parse(`"${raw}"`);
      let k = j + 1;
      while (k < text.length && /\s/.test(text[k])) k += 1;
      if (expectKey && text[k] === ':') {
        const frame = stack[stack.length - 1];
        if (frame && frame.names.has(value)) duplicates.push(value);
        if (frame) frame.names.add(value);
        expectKey = false;
      }
      i = j + 1;
      continue;
    }
    if (ch === '{') { stack.push({ names: new Set() }); expectKey = true; i += 1; continue; }
    if (ch === '}') { stack.pop(); expectKey = false; i += 1; continue; }
    if (ch === '[') { stack.push(null); expectKey = false; i += 1; continue; }
    if (ch === ']') { stack.pop(); expectKey = false; i += 1; continue; }
    if (ch === ',') {
      expectKey = Boolean(stack[stack.length - 1]);
      i += 1;
      continue;
    }
    i += 1;
  }
  return duplicates;
}

function crossCheckNoDuplicateKeys() {
  const files = [
    'deal-terms-package.schema.json',
    'corpus-manifest.schema.json',
  ];
  for (const file of files) {
    const duplicates = duplicateJsonKeys(readFileSync(join(HERE, file), 'utf8'));
    if (duplicates.length > 0) {
      throw new Error(`${file} declares duplicate JSON member names: ${[...new Set(duplicates)].join(', ')}`);
    }
  }
  return `PASS (${files.length} schema files, no duplicate member names)`;
}

function crossCheckSchema() {
  const schema = JSON.parse(readFileSync(join(HERE, 'deal-terms-package.schema.json'), 'utf8'));
  const defs = schema.$defs;
  const pairs = [
    ['releaseManifest', schema.required],
    ['dealDocument', defs.dealDocument.required],
    ['dealIdentity', defs.dealIdentity.required],
    ['provenance', defs.provenance.required],
    ['claim', defs.claim.required],
    ['state', defs.claim.properties.state.required],
    ['claimSource', defs.claim.properties.source.required],
    ['displayField', defs.displayField.required],
    ['sourceSpan', defs.sourceSpan.required],
    ['categorySummary', defs.categorySummary.required],
    ['corpusManifest', defs.corpusManifest.required],
    ['corpusTransaction', defs.corpusManifest.properties.transactions.items.required],
    ['corpusDocument', defs.corpusManifest.properties.transactions.items
      .properties.documents.items.required],
    ['evidenceSpan', defs.evidenceSpan.required],
    ['limitation', defs.limitation.required],
    ['sourceUnit', defs.sourceUnit.required],
    ['contextSpan', defs.contextSpan.required],
    ['sourceUnitSet', defs.sourceUnitSet.required],
  ];
  for (const [name, required] of pairs) {
    const fromSchema = canonicalJson([...required].sort());
    const fromVerifier = canonicalJson([...RECORD_KEYS[name]]);
    if (fromSchema !== fromVerifier) {
      throw new Error(`deal-terms-package.schema.json and verify.mjs disagree on ${name}: schema ${fromSchema} vs verifier ${fromVerifier}`);
    }
  }
  return `PASS (${pairs.length} record shapes agree with verify.mjs)`;
}

function main(argv) {
  process.stdout.write(`ID rule cross-check:  ${crossCheckIdRule()}\n`);
  process.stdout.write(`Schema cross-check:   ${crossCheckSchema()}\n`);
  process.stdout.write(`Duplicate-key check:  ${crossCheckNoDuplicateKeys()}\n`);

  if (argv.includes('--check')) {
    const temporary = mkdtempSync(join(tmpdir(), 'deal-terms-example-'));
    try {
      buildInto(join(temporary, 'example-one-deal-package'));
      const rebuilt = snapshot(join(temporary, 'example-one-deal-package'));
      const committed = snapshot(EXAMPLE_DIR);
      if (rebuilt !== committed) {
        process.stdout.write('FAIL committed example differs from a fresh deterministic build\n');
        return 1;
      }
      process.stdout.write('PASS committed example is byte-identical to a fresh deterministic build\n');
      return 0;
    } finally {
      rmSync(temporary, { recursive: true, force: true });
    }
  }

  const { manifest, dealDocument, corpus } = buildInto(EXAMPLE_DIR);
  process.stdout.write(`deal_key            ${dealDocument.deal_key}\n`);
  process.stdout.write(`deal_document_id    ${dealDocument.deal_document_id}\n`);
  process.stdout.write(`corpus_id           ${corpus.corpus_id}\n`);
  process.stdout.write(`corpus_manifest_id  ${corpus.corpus_manifest_id}\n`);
  process.stdout.write(`release_manifest_id ${manifest.release_manifest_id}\n`);
  process.stdout.write(`files               ${manifest.files.map((file) => file.path).join(', ')}\n`);

  const report = verifyPackage(EXAMPLE_DIR);
  if (report.failures.length > 0) {
    for (const failure of report.failures) process.stdout.write(`FAIL ${failure}\n`);
    return 1;
  }
  process.stdout.write(`self-verified: ${report.checks} checks, 0 failures\n`);
  return 0;
}

process.exit(main(process.argv.slice(2)));
