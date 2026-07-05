const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const {
  buildCodingTaskPayload,
  buildCodingTaskRow,
  findNeedsCodeItem,
  taskLockKey,
  validateCodingTaskInput,
} = require('../lib/coding-tasks');

const DEAL_ID = '11111111-1111-4111-8111-111111111111';
const PROVISION_ID = '22222222-2222-4222-8222-222222222222';

const deal = {
  id: DEAL_ID,
  acquirer: 'Buyer Inc.',
  target: 'Target Co.',
};

const item = {
  id: 'U-001',
  provision_id: PROVISION_ID,
  type: 'NOSOL',
  family_type: 'NOSOL',
  category: '[PROPOSED] Go-Shop',
  code: '[PROPOSED] NOSOL-GOSHOP',
  proposed: true,
  suggested_reason: 'Proposed taxonomy item awaiting review.',
  rough_heading: 'Section 5.03 Go-Shop',
  section_number: '5.03',
  start_char: 12345,
  region_type: 'body.section.provision',
  preview: 'Section 5.03 Go-Shop. The Company may solicit Acquisition Proposals.',
  full_text: 'Section 5.03 Go-Shop. The Company may solicit Acquisition Proposals for 30 days.',
};

test('validateCodingTaskInput accepts Needs Code action capture', () => {
  const result = validateCodingTaskInput({
    deal_id: DEAL_ID,
    needs_code_id: 'U-001',
    provision_id: PROVISION_ID,
    suggested_action: 'propose_new_code',
    note: 'Add a go-shop canonical code.',
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, {});
  assert.equal(result.value.dealId, DEAL_ID);
  assert.equal(result.value.needsCodeId, 'U-001');
  assert.equal(result.value.provisionId, PROVISION_ID);
  assert.equal(result.value.suggestedAction, 'propose_new_code');
  assert.equal(result.value.note, 'Add a go-shop canonical code.');
});

test('validateCodingTaskInput rejects invalid API writes', () => {
  const result = validateCodingTaskInput({
    deal_id: 'not-a-uuid',
    action: 'direct_taxonomy_edit',
  });

  assert.equal(result.ok, false);
  assert.equal(result.errors.deal_id, 'deal_id must be a UUID');
  assert.equal(result.errors.needs_code_id, 'needs_code_id or provision_id is required');
  assert.match(result.errors.suggested_action, /suggested_action must be one of/);
});

test('validateCodingTaskInput supports old uncoded_id caller alias', () => {
  const result = validateCodingTaskInput({
    deal_id: DEAL_ID,
    uncoded_id: 'U-002',
    suggested_action: 'ignore',
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.needsCodeId, 'U-002');
  assert.equal(result.value.suggestedAction, 'ignore');
});

test('buildCodingTaskPayload contains the CLI handoff fields', () => {
  const payload = buildCodingTaskPayload({
    deal,
    item,
    suggestedAction: 'assign_existing',
    suggestedCode: 'NOSOL-GOSHOP',
    note: 'This belongs under no-shop exceptions.',
  });

  assert.equal(payload.status, 'pending');
  assert.equal(payload.deal_id, DEAL_ID);
  assert.equal(payload.provision_id, PROVISION_ID);
  assert.equal(payload.current_type, 'NOSOL');
  assert.equal(payload.current_category, '[PROPOSED] Go-Shop');
  assert.equal(payload.current_code, '[PROPOSED] NOSOL-GOSHOP');
  assert.equal(payload.full_text, item.full_text);
  assert.equal(payload.ben_note, 'This belongs under no-shop exceptions.');
  assert.equal(payload.suggested_action, 'assign_existing');
  assert.equal(payload.suggested_code, 'NOSOL-GOSHOP');
  assert.equal(payload.needs_code_item.section_number, '5.03');
  assert.equal(payload.needs_code_item.start_char, 12345);
  assert.equal(payload.needs_code_item.region_type, 'body.section.provision');
  assert.equal(payload.audit.direct_taxonomy_write, false);
  assert.equal(payload.audit.cli_audited, true);
});

test('buildCodingTaskRow writes queue columns plus payload without final taxonomy edits', () => {
  const row = buildCodingTaskRow({
    deal,
    item,
    suggestedAction: 'split',
    note: 'Split into go-shop period and fiduciary-out mechanics.',
  });

  assert.equal(row.status, 'pending');
  assert.equal(row.suggested_action, 'split');
  assert.equal(row.deal_id, DEAL_ID);
  assert.equal(row.provision_id, PROVISION_ID);
  assert.equal(row.current_type, 'NOSOL');
  assert.equal(row.current_category, '[PROPOSED] Go-Shop');
  assert.equal(row.current_code, '[PROPOSED] NOSOL-GOSHOP');
  assert.equal(row.full_text, item.full_text);
  assert.equal(row.note, 'Split into go-shop period and fiduciary-out mechanics.');
  assert.equal(row.lock_key, taskLockKey(DEAL_ID, item));
  assert.equal(row.payload.full_text, item.full_text);
});

test('findNeedsCodeItem resolves by provision id before display id', () => {
  const found = findNeedsCodeItem([
    { id: 'U-001', provision_id: '33333333-3333-4333-8333-333333333333' },
    item,
  ], {
    needsCodeId: 'U-001',
    provisionId: PROVISION_ID,
  });

  assert.equal(found.provision_id, PROVISION_ID);
});

test('/api/admin/gaps exposes Needs Code fields and POST task creation', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'pages', 'api', 'admin', 'gaps.js'), 'utf8');
  assert.match(source, /needs_code_count/);
  assert.match(source, /needs_code: needsCode/);
  assert.match(source, /createCodingTask/);
  assert.match(source, /validateCodingTaskInput/);
  assert.match(source, /\.from\('coding_tasks'\)/);
  assert.match(source, /GET, POST/);
});
