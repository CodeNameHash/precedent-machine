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
  assertIdRuleSelfTest, dealKeyOf, corpusIdOf, rollUpReviewState, validStateCombination,
  verifyPackage, PACKAGE_SCHEMA_VERSION,
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
const SYNTHETIC_TEXT = [
  'ARTICLE VII',
  '',
  'Section 7.03 Termination Fee. If this Agreement is terminated by Parent '
    + 'pursuant to Section 7.01(c), the Company shall pay to Parent a fee of '
    + 'twelve million dollars ($12,000,000) — the "Company Termination Fee" — '
    + 'within two Business Days after such termination.',
  '',
  'Section 7.04 Parent Fee. If this Agreement is terminated by the Company '
    + 'pursuant to Section 7.01(d), Parent shall pay to the Company an amount '
    + 'equal to the Company Termination Fee, unless the Regulatory Condition '
    + 'shall then be capable of satisfaction, in which case such amount shall '
    + 'be as the parties may then agree.',
  '',
  'Section 6.01 Conditions. The obligations of each party to effect the '
    + 'Merger are subject to the receipt of the Requisite Stockholder Approval.',
  '',
].join('\n');

const SOURCE_BYTES = Buffer.from(SYNTHETIC_TEXT, 'utf8');

// A synthetic M2 structure: three named nodes with half-open UTF-8 byte extents.
function spanOf(needle, nodeSeed) {
  const start = SOURCE_BYTES.indexOf(Buffer.from(needle, 'utf8'));
  if (start < 0) throw new Error(`synthetic span not found: ${needle.slice(0, 40)}`);
  const end = start + Buffer.byteLength(needle, 'utf8');
  const excerpt = SOURCE_BYTES.subarray(start, end).toString('utf8');
  if (!Buffer.from(excerpt, 'utf8').equals(SOURCE_BYTES.subarray(start, end))) {
    throw new Error('span does not fall on a code-point boundary');
  }
  return {
    node_occurrence_id: contentId('DEAL_TERMS_EXAMPLE_M2_NODE/V1', { seed: nodeSeed }),
    start_byte: start,
    end_byte: end,
    text_sha256: sha256Hex(excerpt),
    excerpt_text: excerpt,
  };
}

const SECTION_7_03 = 'Section 7.03 Termination Fee. If this Agreement is terminated by Parent '
  + 'pursuant to Section 7.01(c), the Company shall pay to Parent a fee of '
  + 'twelve million dollars ($12,000,000) — the "Company Termination Fee" — '
  + 'within two Business Days after such termination.';
const SECTION_7_04 = 'Section 7.04 Parent Fee. If this Agreement is terminated by the Company '
  + 'pursuant to Section 7.01(d), Parent shall pay to the Company an amount '
  + 'equal to the Company Termination Fee, unless the Regulatory Condition '
  + 'shall then be capable of satisfaction, in which case such amount shall '
  + 'be as the parties may then agree.';
const SECTION_6_01 = 'Section 6.01 Conditions. The obligations of each party to effect the '
  + 'Merger are subject to the receipt of the Requisite Stockholder Approval.';

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
};

/* ---------------------------------------------------------------- *
 * 3. Claims.                                                         *
 * ---------------------------------------------------------------- */

function displayField(fieldKey, label, renderedValue, typedValue) {
  return {
    field_key: fieldKey,
    label,
    rendered_value: renderedValue,
    rendered_value_digest: sha256Hex(renderedValue),
    typed_value_digest: sha256Hex(canonicalJson(typedValue)),
  };
}

function claim({
  occurrenceSeed, familyKey, definitionKey, classification, sectionReference,
  state, reasonCodes, fields, spans,
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
      displayField('fee_amount', 'Fee amount', 'USD 12,000,000',
        { currency: 'USD', amount: '12000000' }),
      displayField('payment_deadline', 'Payment deadline', 'Two Business Days after termination',
        { unit: 'BUSINESS_DAYS', count: 2, anchor: 'TERMINATION' }),
      displayField('trigger', 'Trigger', 'Termination by Parent under Section 7.01(c)',
        { terminating_party: 'PARENT', trigger_reference: '7.01(c)' }),
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
      displayField('fee_amount', 'Fee amount', 'Not resolved: amount is stated by reference',
        { resolution: 'UNRESOLVED', reference_term: 'Company Termination Fee' }),
    ],
    spans: [spanOf(SECTION_7_04, 'section-7-04')],
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
    const key = `${item.family_key} ${canonicalJson(path)}`;
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

  const summaries = categorySummaries(CLAIMS);
  const dealBody = {
    schema_version: 'DEAL_TERMS_DEAL_DOCUMENT/V1',
    deal_key: DEAL_KEY,
    deal_identity: DEAL_IDENTITY,
    provenance: PROVENANCE,
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

  const corpusBody = {
    schema_version: 'DEAL_TERMS_CORPUS_MANIFEST/V1',
    corpus_id: corpusIdOf('ONE_DEAL', [DEAL_KEY]),
    corpus_kind: 'ONE_DEAL',
    members: [{
      deal_key: DEAL_KEY,
      source_system: DEAL_IDENTITY.source_system,
      issuer_cik: DEAL_IDENTITY.issuer_cik,
      accession: DEAL_IDENTITY.accession,
      document_role_key: DEAL_IDENTITY.document_role_key,
      agreement_id: PROVENANCE.agreement_id,
      canonical_text_sha256: PROVENANCE.canonical_text_sha256,
      source_admission_manifest_id: PROVENANCE.source_admission_manifest_id,
      admission_receipt_id: PROVENANCE.admission_receipt_id,
    }],
    counts: { member_count: 1 },
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
    }),
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
    }],
    files,
    counts: {
      deals: 1,
      files: files.length,
      claims: CLAIMS.length,
      category_summaries: summaries.length,
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
    ['corpusMember', defs.corpusManifest.properties.members.items.required],
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
