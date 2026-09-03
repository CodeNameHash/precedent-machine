#!/usr/bin/env node
// Work 5 review-packet renderer. Joins the sealed fixed-50 identity
// manifest, lawyer review packet and decision ledger. Writes Markdown only
// under m7-v2-repair/work5/. Does not bind the packet to the registration;
// that stays with Lead. Successor V2 projections are not on this branch
// and are left unmarked rather than invented.

import { pathToFileURL } from 'node:url';

import {
  SEALED_INPUTS,
  WORK5_OUTPUT_ROOT,
  Work5Error,
  readSealedRecord,
  runWork5,
} from './stage-2y-structure-m7-v2-repair-work5-lib.mjs';

const STANDING_QUESTIONS = Object.freeze([
  'Does this comparison row preserve the important legal meaning of the source clause?',
  'Is it correct to keep this item out of the normal comparison because an important fact is missing or unclear?',
  'Is it correct to flag this source structure and block only a comparison item that depends on the unclear wording?',
]);

function fence(text) {
  return String(text ?? '').replaceAll('~~~~', '~~~');
}

function renderItem(identity, packet, decision) {
  const lines = [
    `## Item ${identity.sample_ordinal}`,
    '',
    `- Family: \`${identity.family_key}\``,
    `- Kind: \`${identity.item_kind}\``,
    `- Review item: \`${identity.review_item_id}\``,
    `- Agreement: \`${identity.agreement_id}\``,
    `- Ben's decision: \`${decision?.decision ?? 'ABSENT'}\``,
    `- Ben's note: ${decision?.note ? `\`${String(decision.note).replaceAll('`', "'")}\`` : 'none'}`,
    `- Old row: \`${packet?.row_id ?? identity.prior_row_id ?? 'ABSENT'}\``,
    `- Section: ${packet?.section_reference ?? 'Not recorded'}`,
    `- V2 result: not present on this branch; Lead binds successor projections`,
    '',
    '### Standing questions',
    '',
    ...STANDING_QUESTIONS.map((question, index) => `${index + 1}. ${question}`),
    '',
    '### Source excerpt',
    '',
    '~~~~text',
    fence(packet?.source_excerpt ?? ''),
    '~~~~',
    '',
  ];
  if (identity.sample_ordinal === 4) {
    lines.push(
      '### Item 4 operative chapeau',
      '',
      'Render the sealed parent context from the packet excerpt above. No extra chapeau text is invented.',
      '',
    );
  }
  if (identity.sample_ordinal === 39) {
    lines.push(
      '### Item 39 parent 7.01(d)',
      '',
      'Both materialised candidate trees are a successor-projection input. They are not on this branch and are not invented here.',
      '',
    );
  }
  return lines.join('\n');
}

export function buildPacketMarkdown(root, selected) {
  const identity = readSealedRecord(root, SEALED_INPUTS.identity_manifest);
  const packet = readSealedRecord(root, SEALED_INPUTS.lawyer_review_packet);
  const ledger = readSealedRecord(root, SEALED_INPUTS.lawyer_decision_ledger);
  if (!Array.isArray(identity.record.members) || identity.record.members.length !== 50) {
    throw new Work5Error('COUNT_MISMATCH', 'identity members != 50', SEALED_INPUTS.identity_manifest.path);
  }
  const packets = new Map((packet.record.items ?? []).map((item) => [item.review_item_id, item]));
  const decisions = new Map((ledger.record.decisions ?? []).map((item) => [item.review_item_id, item]));
  const members = [...identity.record.members].sort((left, right) => left.sample_ordinal - right.sample_ordinal);
  const body = members.map((member) => renderItem(member, packets.get(member.review_item_id), decisions.get(member.review_item_id)));
  const text = [
    '# M7 V2 repair Work 5 review packet',
    '',
    `Candidate registration: \`${selected.candidateRegistrationId}\``,
    `Identity manifest: \`${SEALED_INPUTS.identity_manifest.path}\``,
    `Review packet: \`${SEALED_INPUTS.lawyer_review_packet.path}\``,
    `Decision ledger: \`${SEALED_INPUTS.lawyer_decision_ledger.path}\``,
    '',
    'Rendering only. Packet binding and the Work 5 transition stay with Lead.',
    '',
    ...body,
  ].join('\n');
  return {
    outputPath: `${WORK5_OUTPUT_ROOT}/review-packet.md`,
    text,
    itemCount: members.length,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runWork5(process.argv, buildPacketMarkdown);
}
