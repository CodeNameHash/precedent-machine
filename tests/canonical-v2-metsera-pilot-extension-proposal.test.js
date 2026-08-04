'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  FAMILY_ID,
  METSERA_DEAL_ID,
  METSERA_OCCURRENCE_ID,
  buildMetseraPilotExtensionProposal,
  selectMetseraAntitrustCandidate,
} = require('../lib/canonical-v2/metsera-pilot-extension-proposal');
const { makeRecord } = require('./helpers/canonical-v2-source-intake-fixture');

const ROOT = path.resolve(__dirname, '..');
const METSERA_URL = 'https://www.sec.gov/Archives/edgar/data/2040807/000119312525210030/d921605dex21.htm';

function metseraReceipt({ sourceText = 'Section 6.03 Reasonable Best Efforts; Notification. Pfizer and Metsera shall use reasonable best efforts. ⚖' } = {}) {
  return makeRecord({
    dealId: METSERA_DEAL_ID,
    occurrenceId: METSERA_OCCURRENCE_ID,
    url: METSERA_URL,
    sourceText,
  });
}

test('creates one bounded Metsera antitrust review candidate without execution or source-admission authority', () => {
  const receipt = metseraReceipt();
  const candidate = selectMetseraAntitrustCandidate({ receipt_record: receipt });
  const proposal = buildMetseraPilotExtensionProposal({ receipt_record: receipt });

  assert.equal(candidate.source_occurrence_id, METSERA_OCCURRENCE_ID);
  assert.equal(candidate.raw_sha256, receipt.receipt.raw_sha256);
  assert.equal(candidate.canonical_text_sha256, receipt.conversion.canonical_text_sha256);
  assert.equal(candidate.section_pin.section_reference, '6.03');
  assert.equal(candidate.family_id, FAMILY_ID);
  assert.deepEqual(candidate.model_profile, {
    profile_id: 'TERRA_MEDIUM',
    model: 'gpt-5.6-terra',
    reasoning_effort: 'medium',
  });
  assert.equal(proposal.status, 'SUPERSEDED_INCOMPLETE_SCOPE');
  assert.equal(proposal.superseded_by, 'M3_METSERA_COMPREHENSIVE_SELECTION_REVIEW/V1');
  assert.equal(proposal.separate_from_pilot_work_item_set, 'M3_12_CALL_PILOT');
  assert.equal(proposal.selection_review_packet.status, 'REVIEW_REQUIRED_NOT_AUTHORITY');
  assert.deepEqual(proposal.proposed_work_items, []);
  assert.equal(proposal.execution_authority, 'NOT_GRANTED');
  assert.equal(proposal.source_admission_status, 'NOT_ATTEMPTED');
});

test('fails closed for a wrong Metsera occurrence, section identity, or unregistered model profile', () => {
  const wrongOccurrence = makeRecord({
    dealId: 'wrong-deal',
    occurrenceId: 'METADATA/wrong',
    url: METSERA_URL,
    sourceText: 'Section 6.03 Reasonable Best Efforts; Notification. Text.',
  });
  assert.throws(
    () => buildMetseraPilotExtensionProposal({ receipt_record: wrongOccurrence }),
    { code: 'METSERA_SOURCE_IDENTITY_MISMATCH' },
  );
  assert.throws(
    () => buildMetseraPilotExtensionProposal({ receipt_record: metseraReceipt({ sourceText: 'Section 6.03 Different Heading. Text.' }) }),
    { code: 'METSERA_SECTION_IDENTITY_MISMATCH' },
  );
  assert.throws(
    () => buildMetseraPilotExtensionProposal({ receipt_record: metseraReceipt(), model_profile_id: 'UNKNOWN' }),
    { code: 'METSERA_EXTENSION_CONFIGURATION_INVALID' },
  );
});

test('proposal module contains no provider, network, database, or source-admission execution path', () => {
  const source = fs.readFileSync(path.join(ROOT, 'lib/canonical-v2/metsera-pilot-extension-proposal.js'), 'utf8');
  assert.doesNotMatch(source, /createCodexCliProvider|provider_factory|executeUnifiedRun|anthropic-provider|node:https|node:http|\bfetch\s*\(|supabase|INSERT\s+INTO|activate_candidate_release/i);
  assert.match(source, /REVIEW_REQUIRED_NOT_AUTHORITY/);
});
