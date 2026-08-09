'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { canonicalJson } = require('../lib/canonical-v2/canonical-bytes');
const { applyDuplicateSuppression, duplicateSuppressionReceipt, MODES } = require('../lib/canonical-v2/native-producer/duplicate-suppression');

function fixture() {
  const text = 'é exact MAE limb\né exact MAE limb'; const quote = 'é exact MAE limb'; const firstEnd = Buffer.byteLength(quote); const secondStart = firstEnd + 1; const secondEnd = secondStart + firstEnd;
  const attrs = { section_reference: '1.1', defined_term_ref: 'Company Material Adverse Effect', definition_subject: 'Company', limb_path: null };
  const claim = (key, id, edge = { document_ordinal: 0, absolute_start: 0, absolute_end: firstEnd }) => ({ claim_definition_key: key, claim_occurrence_id: id, claim_revision_id: `${id}-revision`, closure_id: `${id}-closure`, raw_value: quote, state: 'PRESENT', attributes: { ...attrs }, evidence: [{ schema_version: 'CLAIM_EVIDENCE/V1', evidence_role: 'OPERATIVE_TEXT', claim_evidence_id: `${id}-evidence`, ...edge }] });
  const carrier = claim('NATIVE_CAPITALISATION_LIMB_ASSERTION_CANDIDATE', 'carrier');
  const typed = claim('NATIVE_MAE_CARVEOUT_CANDIDATE', 'typed'); typed.attributes.limb_path = [];
  const receipt = { run_receipt_id: 'receipt', document_hash: 'document', resolved_sections: [{ section_reference: '1.1', start: 0, end: Buffer.byteLength(text) }], compiled_candidates: [{ ok: true, section_family: 'MAE_DEFINITION', candidate: { kind: 'claim', claim: carrier } }, { ok: true, section_family: 'MAE_DEFINITION', candidate: { kind: 'claim', claim: typed } }] };
  const resolved = [{ generic_claim_key: typed.claim_definition_key, section_reference: '1.1', claim: { ...typed, claim_definition_key: 'MAE_CARVEOUT' }, party: { role: 'DEFINITION_SUBJECT', value: 'Company', capacity: 'TARGET' }, provision_instance: { provision_instance_id: 'provision', document_hash: 'document', concept_key: 'DEF-MAE', party: { role: 'DEFINITION_SUBJECT', value: 'Company', capacity: 'TARGET' } } }];
  const open_world = [{ claim_definition_key: carrier.claim_definition_key, closure_id: carrier.closure_id, raw_value: quote }];
  return { run_receipt: receipt, resolved, open_world, limb_component_trees: [], admitted_source_context: { document_hash: 'document', canonical_text: { text } }, secondStart, secondEnd };
}
function report(input) { return applyDuplicateSuppression({ ...input, mode: MODES.REPORT_ONLY }); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function addResolvedProng(input) {
  const typed = clone(input.run_receipt.compiled_candidates[1].candidate.claim);
  typed.claim_definition_key = 'NATIVE_MAE_DEFINITION_PRONG_CANDIDATE';
  typed.claim_occurrence_id = 'typed-prong'; typed.claim_revision_id = 'typed-prong-revision'; typed.closure_id = 'typed-prong-closure';
  typed.evidence[0].claim_evidence_id = 'typed-prong-evidence';
  input.run_receipt.compiled_candidates.push({ ok: true, section_family: 'MAE_DEFINITION', candidate: { kind: 'claim', claim: typed } });
  const resolved = clone(input.resolved[0]);
  resolved.generic_claim_key = typed.claim_definition_key;
  resolved.claim = { ...typed, claim_definition_key: 'MAE_DEFINITION_PRONG' };
  resolved.provision_instance.provision_instance_id = 'provision-prong';
  input.resolved.push(resolved);
}

test('Stage 2Y-G full-corpus evidence is pinned and mechanically current', () => {
  const script = path.resolve(__dirname, '..', 'scripts/stage-2y-g-duplicate-suppression-evidence.mjs');
  const run = spawnSync(process.execPath, [script, '--check'], { cwd: path.resolve(__dirname, '..'), encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /CHECKED/);
});

test('OFF is referentially byte-identical, REPORT_ONLY changes no output, and ENFORCE is module-only', () => {
  const input = fixture(); const before = JSON.stringify(input.open_world);
  const off = applyDuplicateSuppression({ ...input, mode: MODES.OFF });
  assert.strictEqual(off.open_world, input.open_world); assert.equal(off.records.length, 0);
  const reported = report(input); assert.equal(JSON.stringify(reported.open_world), before); assert.equal(reported.records[0].disposition, 'WOULD_SUPPRESS');
  const enforced = applyDuplicateSuppression({ ...input, mode: MODES.ENFORCE });
  assert.equal(enforced.open_world.length, 0); assert.equal(enforced.records[0].disposition, 'SUPPRESSED');
  const runner = path.resolve(__dirname, '..', 'scripts/canonical-v2-live-extraction-run.mjs');
  const normalRunner = spawnSync(process.execPath, [runner, '--duplicate-suppression-enforce'], { encoding: 'utf8' });
  assert.notEqual(normalRunner.status, 0); assert.match(normalRunner.stderr, /unrecognised argument/);
});

test('identity guards reject the same quote under another defined term, section, non-root path, party, provision, and UTF-8 span', () => {
  const changed = (mutate) => { const input = fixture(); mutate(input); return report(input).records[0].disposition; };
  assert.equal(changed((x) => { x.run_receipt.compiled_candidates[1].candidate.claim.attributes.defined_term_ref = 'Other Defined Term'; }), 'RETAINED');
  assert.equal(changed((x) => { x.resolved[0].claim.attributes.section_reference = '9.9'; }), 'RETAINED');
  assert.equal(changed((x) => {
    x.run_receipt.compiled_candidates[0].candidate.claim.attributes.limb_path = ['(a)'];
    x.run_receipt.compiled_candidates[1].candidate.claim.attributes.limb_path = ['(a)'];
    x.resolved[0].claim = { ...x.resolved[0].claim, attributes: { ...x.resolved[0].claim.attributes, limb_path: ['(b)'] } };
  }), 'RETAINED');
  assert.equal(changed((x) => { x.resolved[0].party.value = 'Parent'; x.resolved[0].provision_instance.party.value = 'Parent'; }), 'RETAINED');
  assert.equal(changed((x) => { x.resolved[0].provision_instance.party.capacity = 'BUYER'; }), 'RETAINED');
  assert.equal(changed((x) => { x.resolved[0].provision_instance.concept_key = 'DEF-OTHER'; }), 'RETAINED');
  assert.equal(changed((x) => { x.resolved[0].claim.evidence[0].absolute_start = x.secondStart; x.resolved[0].claim.evidence[0].absolute_end = x.secondEnd; }), 'RETAINED');
});

test('held and absent peers retain, while a qualifier or component reference fails closed', () => {
  const held = fixture(); held.resolved = []; assert.equal(report(held).records[0].reason_code, 'PARALLEL_TYPED_HELD');
  const absent = fixture(); absent.run_receipt.compiled_candidates.pop(); assert.equal(report(absent).records[0].reason_code, 'NO_TYPED_PEER_FOR_OPERATIVE_SPAN');
  const qualifier = fixture(); qualifier.run_receipt.compiled_candidates[0].candidate.claim.attributes.qualifier_attachment = 'knowledge'; assert.equal(report(qualifier).records[0].reason_code, 'QUALIFIER_SCOPE_DIFFERENT');
  const peerQualifier = fixture(); peerQualifier.resolved[0].claim = { ...peerQualifier.resolved[0].claim, attributes: { ...peerQualifier.resolved[0].claim.attributes, qualifier_attachment: 'knowledge' } }; assert.equal(report(peerQualifier).records[0].reason_code, 'QUALIFIER_SCOPE_DIFFERENT');
  const tree = fixture(); tree.limb_component_trees = [{ assertion_node: { closure_id: 'carrier-closure' } }]; assert.equal(report(tree).records[0].reason_code, 'COMPONENT_TREE_REFERENCE_PRESENT');
});

test('multiple typed resolved codes survive while ENFORCE removes only the generic carrier', () => {
  const input = fixture(); addResolvedProng(input);
  const resolvedBefore = canonicalJson(input.resolved);
  const reported = report(input);
  assert.deepEqual(reported.records[0].surviving_typed_claim_revision_ids, ['typed-prong-revision', 'typed-revision']);
  assert.deepEqual(reported.records[0].surviving_provision_instance_ids, ['provision', 'provision-prong']);
  const enforced = applyDuplicateSuppression({ ...input, mode: MODES.ENFORCE });
  assert.equal(enforced.open_world.length, 0);
  assert.equal(canonicalJson(input.resolved), resolvedBefore);
  assert.deepEqual(input.resolved.map((row) => row.claim.claim_definition_key).sort(), ['MAE_CARVEOUT', 'MAE_DEFINITION_PRONG']);
});

test('candidate permutations have stable records and receipt digest, and ENFORCE is idempotent', () => {
  const input = fixture(); addResolvedProng(input);
  const forward = report(input);
  const permuted = report({
    ...input,
    run_receipt: { ...input.run_receipt, compiled_candidates: [...input.run_receipt.compiled_candidates].reverse() },
    resolved: [...input.resolved].reverse(),
  });
  assert.equal(canonicalJson(permuted.records), canonicalJson(forward.records));
  assert.equal(canonicalJson(permuted.open_world), canonicalJson(forward.open_world));
  assert.equal(
    duplicateSuppressionReceipt({ mode: MODES.REPORT_ONLY, result: permuted, run_receipt: input.run_receipt }).records_digest,
    duplicateSuppressionReceipt({ mode: MODES.REPORT_ONLY, result: forward, run_receipt: input.run_receipt }).records_digest,
  );
  const first = applyDuplicateSuppression({ ...input, mode: MODES.ENFORCE });
  const second = applyDuplicateSuppression({ ...input, mode: MODES.ENFORCE, open_world: first.open_world });
  assert.equal(second.open_world.length, 0);
  assert.equal(second.counts.suppressed, 0);
  assert.equal(second.records.length, 0);
});

test('ENFORCE changes only targeted open-world rows and duplicate-suppression receipt counts', () => {
  const input = fixture();
  input.open_world.push({ claim_definition_key: 'OTHER_OPEN_WORLD_CANDIDATE', closure_id: 'unrelated-closure', raw_value: 'unrelated' });
  const stable = {
    resolved: input.resolved,
    review_queue: [{ claim_revision_id: 'held-claim' }],
    provisions: [{ provision_instance_id: 'provision' }],
    relationships: [{ relationship_id: 'relationship' }],
    source_candidates: input.run_receipt.compiled_candidates,
  };
  const before = canonicalJson(stable);
  const enforced = applyDuplicateSuppression({ ...input, mode: MODES.ENFORCE });
  const receipt = duplicateSuppressionReceipt({ mode: MODES.ENFORCE, result: enforced, run_receipt: input.run_receipt });
  assert.deepEqual(enforced.open_world, [input.open_world[1]]);
  assert.equal(canonicalJson(stable), before);
  assert.deepEqual(
    { scanned: receipt.scanned, would_suppress: receipt.would_suppress, suppressed: receipt.suppressed, retained_typed_peer_held: receipt.retained_typed_peer_held, retained_no_typed_peer: receipt.retained_no_typed_peer },
    { scanned: 1, would_suppress: 1, suppressed: 1, retained_typed_peer_held: 0, retained_no_typed_peer: 0 },
  );
});
