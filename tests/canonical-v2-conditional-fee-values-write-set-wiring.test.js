// PLAN.md Step 4A3. Regression tests for the wiring Step 4A2 disclosed as
// missing: `native-write-set-adapter.js` and `validate-write-set.js`
// (and, necessarily, `canonical-writer.js`'s own DEAL_SCOPE_RUN shape gate
// -- see its own comment) carried zero references to
// `conditional_termination_fee_values`, so a real extraction run's
// `resolution.conditional_termination_fee_values` never reached a write
// set, even though Step 4A2 gave the kind a table and a SQL shape check.
//
// A live-execution reproduction against a real local Postgres container --
// a real extraction run's OWN adapter output (not a hand-built harness
// input), through the real bridge, into `public.canonical_v2_write`, with
// the Modiv headline round-tripping byte-identical -- is recorded in
// docs/codex-program/notes/step-4a3-fee-values-wiring.md. These tests are
// the CI-executable guard: no live Postgres here, so what is proved here is
// the JS side only -- exactly the convention
// tests/canonical-v2-writer-conditional-termination-fee-shape-sql.test.js
// (Step 4A2) already documents for its own SQL-source pattern-match tests.
//
// **The test that pins the wiring** is the first one below: it asserts, on
// the REAL `buildNativeWriteSet`, that `resolution.conditional_termination_
// fee_values` reaches `write_set.conditional_termination_fee_values`
// unchanged. Delete the adapter's pass-through (revert native-write-set-
// adapter.js to before this step) and this test fails immediately, with the
// key simply absent from the write set -- there is no other path by which
// this array could appear there.

const test = require('node:test');
const assert = require('node:assert/strict');

const { contentId } = require('../lib/canonical-v2/canonical-bytes');
const { compileFixtureContract } = require('../lib/canonical-v2/contract-bundle');
const {
  buildAdmittedSemanticSourceContext,
  buildAdmittedSourceReference,
} = require('../lib/canonical-v2/admitted-semantic-source');
const {
  InMemoryCanonicalRepository,
  createCanonicalWriter,
} = require('../lib/canonical-v2/canonical-writer');
const {
  validateResolvedCanonicalWriteSet,
  CanonicalValidationError,
} = require('../lib/canonical-v2/validate-write-set');
const { buildSecEdgarIntakeCapture } = require('../lib/canonical-v2/sec-edgar-intake-capture');
const { convertSecHtmlToCanonicalText } = require('../lib/canonical-v2/sec-html-canonical-text');
const { verifySecHtmlCanonicalText } = require('../lib/canonical-v2/sec-html-canonical-text-verifier');
const { buildVerifiedSecSourceAdmission } = require('../lib/canonical-v2/sec-source-admission');
const { buildSourceArtifactChunks } = require('../lib/canonical-v2/source-artifact-chunks');
const { RUN_RECEIPT_SCHEMA } = require('../lib/canonical-v2/native-producer/native-extraction-run');
const {
  buildNativeWriteSet,
} = require('../lib/canonical-v2/native-producer/native-write-set-adapter');
const {
  buildConditionalTerminationFeeValue,
} = require('../lib/canonical-v2/native-producer/conditional-termination-fee-value');

const contractBundle = compileFixtureContract();

// ─── A real, minimal admitted-source chain (same pattern tests/canonical-v2-
// deal-scope-writer.test.js already uses) -- conditional_termination_fee_
// values carries no coordinate-shiftable evidence at all (module header,
// native-write-set-adapter.js), so nothing here needs anything more than a
// genuinely admitted document. ───

function sourceChain(html, suffix) {
  const url = `https://www.sec.gov/Archives/edgar/data/1/${suffix}.htm`;
  const capture = buildSecEdgarIntakeCapture({
    retrieval_url: url,
    final_url: url,
    status_code: 200,
    content_type: 'text/html',
    retrieved_at: '2026-08-07T15:00:00.000Z',
    retrieval_policy_digest: 'a'.repeat(64),
    redirect_count: 0,
    response_bytes: Buffer.from(html, 'utf8'),
  });
  const conversion = convertSecHtmlToCanonicalText(capture);
  const verification = verifySecHtmlCanonicalText({ capture, conversion });
  const bundle = buildVerifiedSecSourceAdmission({ capture, conversion, verification });
  const artifact = buildSourceArtifactChunks(conversion);
  return {
    capture, conversion, verification, bundle, artifact,
  };
}

async function admit(writer, chain) {
  await writer.write({
    operation: 'INTAKE_CAPTURE',
    idempotencyKey: `intake:${chain.capture.intake_capture_receipt_id}`,
    writeSet: { intake_capture: chain.capture },
  });
  for (const chunk of chain.artifact.chunks) {
    // eslint-disable-next-line no-await-in-loop
    await writer.write({
      operation: 'STAGE_SOURCE_ARTIFACT_CHUNK',
      idempotencyKey: `artifact:${chunk.chunk_id}`,
      writeSet: {
        source_artifact_manifest: chain.artifact.manifest,
        source_artifact_chunk: chunk,
      },
    });
  }
  await writer.write({
    operation: 'PREPARE_SOURCE_ADMISSION',
    idempotencyKey: `admission:${chain.bundle.source_admission_manifest.source_admission_manifest_id}`,
    writeSet: {
      capture_reference: {
        schema_version: 'INTAKE_CAPTURE_REFERENCE/V1',
        intake_capture_receipt_id: chain.capture.intake_capture_receipt_id,
        source_response_content_id: chain.capture.source_response_content_id,
      },
      conversion_artifact_manifest: chain.artifact.manifest,
      verification: chain.verification,
      source_admission_bundle: chain.bundle,
    },
  });
}

const digest = (value) => contentId('CONDITIONAL_FEE_WIRING_TEST/V1', value);

function sourceContext(chain, dealKey = 'deal:condfee-wiring', dealAdmissionId = digest('deal:condfee-wiring'), ordinal = 0) {
  return buildAdmittedSemanticSourceContext({
    immutable_source_document: chain.bundle.immutable_source_document,
    source_admission_manifest: chain.bundle.source_admission_manifest,
    semantic_extraction_input_envelope: chain.bundle.semantic_extraction_input_envelope,
    conversion: chain.conversion,
    governed_deal_key: dealKey,
    deal_admission_id: dealAdmissionId,
    source_ordinal: ordinal,
  });
}

async function setup(html = '<body><p>Termination fee formula test fixture.</p></body>') {
  const repository = new InMemoryCanonicalRepository();
  const writer = createCanonicalWriter({ repository, contractBundle });
  const chain = sourceChain(html, 'condfee-wiring');
  await admit(writer, chain);
  const context = sourceContext(chain);
  return {
    repository, writer, chain, context,
  };
}

// A minimal, structurally valid run receipt -- conditional_termination_fee_
// values needs nothing from `compiled_candidates`/`resolved_sections` at
// all, so this is genuinely empty rather than a stub standing in for a real
// run.
function minimalRunReceipt(context) {
  const byteLength = Buffer.from(context.canonical_text.text, 'utf8').length;
  return {
    schema_version: RUN_RECEIPT_SCHEMA,
    document_hash: context.document_hash,
    source_byte_length: byteLength,
    source_sha256: context.canonical_text_sha256,
    resolved_sections: [],
    compiled_candidates: [],
    evidence_residuals: [],
    scope_violations: [],
  };
}

// The two real Modiv rows Step 4A2 proved durably (the headline
// SELLER/7.3(b)(i) row and one BUYER/7.3(c) row), built through the real
// producer function -- not hand-typed JSON -- so their shape and identity
// are exactly what production would mint.
function modivHeadlineRow() {
  return buildConditionalTerminationFeeValue({
    fee_side: 'SELLER',
    triggering_branch: '7.3(b)(i)',
    base_amount: '10000000',
    currency: 'USD',
    operator: 'LOWER_OF',
    reit_limit_cap_term_ref: 'REIT Requirements',
    defined_term_lineage: ['Company Termination Fee', 'Company Base Amount'],
    source_citations: ['7.3(b)(i)', '8.12(m)', '8.12(f)'],
    raw_formula: 'an amount equal to the lesser of (i) the Company Base Amount and (ii) the maximum amount...',
  });
}

function modivSecondRow() {
  return buildConditionalTerminationFeeValue({
    fee_side: 'BUYER',
    triggering_branch: '7.3(c)',
    base_amount: '15000000.00',
    currency: 'USD',
    operator: 'LOWER_OF',
    reit_limit_cap_term_ref: 'REIT Requirements',
    defined_term_lineage: ['Parent Termination Fee', 'Parent Base Amount'],
    source_citations: ['7.3(c)', '8.12(m)'],
    raw_formula: 'an amount equal to the lesser of (i) the Parent Base Amount and (ii)...',
  });
}

// ─── Part 1: the adapter (native-write-set-adapter.js) ───

test('THE WIRING PIN: resolution.conditional_termination_fee_values reaches write_set.conditional_termination_fee_values unchanged', async () => {
  const { context } = await setup();
  const rows = [modivHeadlineRow(), modivSecondRow()];
  const result = buildNativeWriteSet({
    run_receipt: minimalRunReceipt(context),
    source_text: context.canonical_text.text,
    document_hash: context.document_hash,
    admitted_source_context: context,
    resolution: {
      provisions: [], limb_component_trees: [], ioc_restriction_components: [],
      conditional_termination_fee_values: rows,
    },
  });

  // The direct assertion Step 4A2's own note said was missing: this key,
  // with this content, present on the write set the adapter builds. Revert
  // the adapter's pass-through and `conditional_termination_fee_values` is
  // simply absent here -- there is no other path that could produce it.
  assert.deepEqual(result.write_set.conditional_termination_fee_values, rows);
  assert.equal(result.counts.conditional_termination_fee_values_written, 2);
});

test('absent, or present-but-empty, resolution.conditional_termination_fee_values OMITS the key entirely (never an empty array)', async () => {
  const { context } = await setup();
  const receipt = minimalRunReceipt(context);
  const common = {
    run_receipt: receipt,
    source_text: context.canonical_text.text,
    document_hash: context.document_hash,
    admitted_source_context: context,
  };

  const noResolution = buildNativeWriteSet(common);
  const resolutionWithoutField = buildNativeWriteSet({
    ...common,
    resolution: { provisions: [], limb_component_trees: [], ioc_restriction_components: [] },
  });
  const resolutionWithEmptyArray = buildNativeWriteSet({
    ...common,
    resolution: {
      provisions: [],
      limb_component_trees: [],
      ioc_restriction_components: [],
      conditional_termination_fee_values: [],
    },
  });

  for (const result of [noResolution, resolutionWithoutField, resolutionWithEmptyArray]) {
    assert.equal(
      Object.prototype.hasOwnProperty.call(result.write_set, 'conditional_termination_fee_values'),
      false,
    );
    assert.equal(result.counts.conditional_termination_fee_values_written, 0);
  }
  // Every other key untouched -- byte-identical write sets in every case.
  assert.deepEqual(resolutionWithoutField.write_set, resolutionWithEmptyArray.write_set);
});

// ─── Part 2: validate-write-set.js ───

test('validateResolvedCanonicalWriteSet accepts a real adapter write set carrying conditional_termination_fee_values, and publishes it unchanged', async () => {
  const { context } = await setup();
  const rows = [modivHeadlineRow(), modivSecondRow()];
  const adapterResult = buildNativeWriteSet({
    run_receipt: minimalRunReceipt(context),
    source_text: context.canonical_text.text,
    document_hash: context.document_hash,
    admitted_source_context: context,
    resolution: {
      provisions: [], limb_component_trees: [], ioc_restriction_components: [],
      conditional_termination_fee_values: rows,
    },
  });

  const validation = validateResolvedCanonicalWriteSet({
    writeSet: adapterResult.write_set,
    contractBundle,
    admittedSourceContexts: adapterResult.admitted_source_contexts,
  });

  assert.equal(validation.accepted, true);
  assert.deepEqual(validation.publishableWriteSet.conditional_termination_fee_values, rows);
  // A real write, not a reference -- must count toward publishable, the
  // same reasoning the SQL side's publishable_object_count sum applies
  // (Step 4A2's own comment on that query).
  assert.equal(validation.counts.publishable, 2);
  assert.equal(validation.residuals.length, 0);
  assert.equal(validation.quarantines.length, 0);
});

test('a write set with no conditional_termination_fee_values key validates exactly as before this step (regression safety)', async () => {
  const { context } = await setup();
  const adapterResult = buildNativeWriteSet({
    run_receipt: minimalRunReceipt(context),
    source_text: context.canonical_text.text,
    document_hash: context.document_hash,
    admitted_source_context: context,
  });
  assert.equal(
    Object.prototype.hasOwnProperty.call(adapterResult.write_set, 'conditional_termination_fee_values'),
    false,
  );
  const validation = validateResolvedCanonicalWriteSet({
    writeSet: adapterResult.write_set,
    contractBundle,
    admittedSourceContexts: adapterResult.admitted_source_contexts,
  });
  assert.equal(validation.accepted, true);
  assert.equal(
    Object.prototype.hasOwnProperty.call(validation.publishableWriteSet, 'conditional_termination_fee_values'),
    false,
  );
  assert.equal(validation.counts.publishable, 0);
});

// ─── Hostile probes, mirroring Step 4A2's SQL-side probes (docs/codex-
// program/notes/step-4a2-conditional-fee-table.md): a well-formed control,
// an extra-key row, a wrong-enum row, and a duplicate id. This is the JS
// mirror of the SQL shape check; both must refuse the same malformed
// shapes, since "do not change the SQL to fit the adapter" cuts both ways
// -- the adapter side must be at least as strict. ───

function baseValidatedWriteSet(context) {
  const adapterResult = buildNativeWriteSet({
    run_receipt: minimalRunReceipt(context),
    source_text: context.canonical_text.text,
    document_hash: context.document_hash,
    admitted_source_context: context,
  });
  return adapterResult;
}

test('hostile: an extra-key conditional termination fee value row is refused, naming the shape', async () => {
  const { context } = await setup();
  const adapterResult = baseValidatedWriteSet(context);
  const malformed = { ...modivHeadlineRow(), garbage_field: 'nope' };
  const writeSet = {
    ...adapterResult.write_set,
    conditional_termination_fee_values: [malformed],
  };
  assert.throws(
    () => validateResolvedCanonicalWriteSet({
      writeSet,
      contractBundle,
      admittedSourceContexts: adapterResult.admitted_source_contexts,
    }),
    (error) => (
      error instanceof CanonicalValidationError
      && /conditional termination fee value shape is invalid/.test(error.message)
    ),
  );
});

test('hostile: a wrong-enum (currency) conditional termination fee value row is refused, naming the shape', async () => {
  const { context } = await setup();
  const adapterResult = baseValidatedWriteSet(context);
  const headline = modivHeadlineRow();
  // Rebuild without re-deriving the id -- the SUPPLIED id must now mismatch
  // its (mutated) content too, but the shape check must fire first.
  const malformed = { ...headline, currency: 'GBP' };
  const writeSet = {
    ...adapterResult.write_set,
    conditional_termination_fee_values: [malformed],
  };
  assert.throws(
    () => validateResolvedCanonicalWriteSet({
      writeSet,
      contractBundle,
      admittedSourceContexts: adapterResult.admitted_source_contexts,
    }),
    (error) => (
      error instanceof CanonicalValidationError
      && /conditional termination fee value shape is invalid/.test(error.message)
    ),
  );
});

test('hostile: a well-formed row whose supplied id does not match its content is refused on identity, not shape', async () => {
  const { context } = await setup();
  const adapterResult = baseValidatedWriteSet(context);
  const tampered = { ...modivHeadlineRow(), conditional_termination_fee_value_id: 'a'.repeat(64) };
  const writeSet = {
    ...adapterResult.write_set,
    conditional_termination_fee_values: [tampered],
  };
  assert.throws(
    () => validateResolvedCanonicalWriteSet({
      writeSet,
      contractBundle,
      admittedSourceContexts: adapterResult.admitted_source_contexts,
    }),
    (error) => (
      error instanceof CanonicalValidationError
      && /conditional termination fee value identity does not match its content/.test(error.message)
    ),
  );
});

test('hostile: duplicate conditional termination fee value ids are refused', async () => {
  const { context } = await setup();
  const adapterResult = baseValidatedWriteSet(context);
  const headline = modivHeadlineRow();
  const writeSet = {
    ...adapterResult.write_set,
    conditional_termination_fee_values: [headline, { ...headline }],
  };
  assert.throws(
    () => validateResolvedCanonicalWriteSet({
      writeSet,
      contractBundle,
      admittedSourceContexts: adapterResult.admitted_source_contexts,
    }),
    (error) => (
      error instanceof CanonicalValidationError
      && /duplicate conditional termination fee value/.test(error.message)
    ),
  );
});

// ─── Part 3: canonical-writer.js's DEAL_SCOPE_RUN shape gate ───
//
// Step 4A2's own note named this exact follow-up: validate-write-set.js
// accepting the key is necessary but not sufficient, because canonical-
// writer.js's assertDealScopeWriteSetShape has its own, separate powerset
// key check that runs BEFORE validateResolvedCanonicalWriteSet is ever
// called -- and it rejected this key with INVALID_DEAL_SCOPE_WRITE_SET
// until this step also widened it. ───

test('createCanonicalWriter (DEAL_SCOPE_RUN) accepts a write set carrying conditional_termination_fee_values, dry run', async () => {
  const { writer, context } = await setup();
  const adapterResult = buildNativeWriteSet({
    run_receipt: minimalRunReceipt(context),
    source_text: context.canonical_text.text,
    document_hash: context.document_hash,
    admitted_source_context: context,
    resolution: {
      provisions: [], limb_component_trees: [], ioc_restriction_components: [],
      conditional_termination_fee_values: [modivHeadlineRow()],
    },
  });
  // Sanity: the key really is on the write set this test hands the writer.
  assert.equal(adapterResult.write_set.conditional_termination_fee_values.length, 1);

  const result = await writer.write({
    operation: 'DEAL_SCOPE_RUN',
    idempotencyKey: 'condfee-wiring-dry-run',
    dryRun: true,
    writeSet: adapterResult.write_set,
  });

  assert.equal(result.dryRun, true);
  assert.deepEqual(
    result.validation.publishableWriteSet.conditional_termination_fee_values,
    [modivHeadlineRow()],
  );
});

test('createCanonicalWriter (DEAL_SCOPE_RUN) commits a write set carrying conditional_termination_fee_values, and replay is idempotent', async () => {
  const { writer, repository, context } = await setup();
  const adapterResult = buildNativeWriteSet({
    run_receipt: minimalRunReceipt(context),
    source_text: context.canonical_text.text,
    document_hash: context.document_hash,
    admitted_source_context: context,
    resolution: {
      provisions: [], limb_component_trees: [], ioc_restriction_components: [],
      conditional_termination_fee_values: [modivHeadlineRow(), modivSecondRow()],
    },
  });

  const transactionsBefore = repository.transactionCount;
  const input = {
    operation: 'DEAL_SCOPE_RUN',
    idempotencyKey: 'condfee-wiring-commit',
    writeSet: adapterResult.write_set,
  };
  const first = await writer.write(input);
  const replay = await writer.write(input);

  assert.equal(first.dryRun, false);
  assert.equal(replay.replayed, true);
  assert.equal(replay.receipt.receiptId, first.receipt.receiptId);
  assert.equal(first.receipt.publishableObjectCount, 2);
  // Exactly one new transaction for the DEAL_SCOPE_RUN commit -- the replay
  // must not open a second one.
  assert.equal(repository.transactionCount, transactionsBefore + 1);
});
