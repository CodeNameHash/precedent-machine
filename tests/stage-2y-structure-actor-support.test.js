'use strict';

// Proves a support property over the committed M6 projection: every actor
// shown on a projected row's "Applies to: " line must be traceable to real
// evidence in the underlying proposition -- either
//   (a) a MEMBER_FACTS entry contributing that text as a party or capacity, or
//   (b) an ACTOR_OR_PARTIES entry with provenance_kind === 'DIRECT' whose
//       source_span lies inside one of the proposition's AUTHORED_SOURCE
//       extents (exposed on the row as `citations`).
//
// ACTOR_OR_PARTIES entries in the committed corpus take five real shapes:
//   - { capacity, role, value }                                  no provenance, no span
//   - string (e.g. "TARGET")                                     no provenance, no span
//   - { field, value }                                           no provenance, no span
//   - { context_fact_id, role, value }                           no provenance, no span
//   - { modal, provenance_kind, source_node_occurrence_id,
//       source_span, value }                                     DIRECT or INHERITED_FROM_ANCESTOR
// Only the fifth shape, when provenance_kind is DIRECT, can ever satisfy (b);
// the other four carry no span at all and can only be displayed legitimately
// if a member fact backs the same text.
//
// Byte offsets in this repo are UTF-8. Span containment is compared
// numerically against start_byte/end_byte, never via string indexOf/slice.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  projectLegacyAgreementV1,
  viewPolicyForLegacyV1,
} = require('../lib/canonical-v2/agreement-projection');

const ROOT = path.resolve(__dirname, '..', 'evidence/canonical-v2/stage-2y-structure-migration');

function readJson(relative) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8'));
}

function familyOrder() {
  return readJson('receipts/stage-2y-structure-m5-preparation.json').family_order;
}

function analyses() {
  const dir = path.join(ROOT, 'shadow/m5-correction/analysis');
  return fs.readdirSync(dir)
    .filter((name) => name.endsWith('.agreement-analysis.json'))
    .sort()
    .map((name) => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')));
}

// The text a party/capacity/actor value displays as: a non-empty string as
// itself, or an object's 'value' field (falling back to 'raw_value' then
// 'canonical_value'). This is the minimal "what text does this entry carry"
// question needed to check support -- it does not reproduce actorTexts'
// tiering or selection order, which stays internal to agreement-projection.js.
function textOf(value) {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (value && typeof value === 'object') {
    for (const key of ['value', 'raw_value', 'canonical_value']) {
      const text = textOf(value[key]);
      if (text) return text;
    }
  }
  return null;
}

function normalise(text) {
  return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

function spanInside(span, extent) {
  return Boolean(span) && Boolean(extent)
    && Number.isFinite(span.start_byte) && Number.isFinite(span.end_byte)
    && Number.isFinite(extent.start_byte) && Number.isFinite(extent.end_byte)
    && span.start_byte >= extent.start_byte
    && span.end_byte <= extent.end_byte;
}

// (a): every party/capacity text any MEMBER_FACTS entry on the proposition
// contributes.
function memberClaimTexts(memberFacts) {
  const texts = new Set();
  for (const member of memberFacts) {
    for (const candidate of [member?.party?.value, member?.party, member?.capacity]) {
      const text = textOf(candidate);
      if (text) texts.add(normalise(text));
    }
  }
  return texts;
}

// (b): DIRECT-provenance ACTOR_OR_PARTIES entries whose source_span sits
// inside one of the row's AUTHORED_SOURCE extents (row.citations).
function directSpanBackedTexts(actorOrParties, citations) {
  const texts = new Set();
  for (const entry of actorOrParties) {
    if (!entry || typeof entry !== 'object' || entry.provenance_kind !== 'DIRECT') continue;
    const text = textOf(entry);
    if (!text) continue;
    const inside = citations.some((citation) => spanInside(entry.source_span, citation.source_span));
    if (inside) texts.add(normalise(text));
  }
  return texts;
}

// The displayed actors come straight from the projected row's rendered
// "Applies to: " line -- actorTexts() itself is internal and not re-derived.
function displayedActors(row) {
  const expanded = row.fields.find((field) => field.field_key === 'expanded_text').value;
  const line = expanded.split('\n').find((entry) => entry.startsWith('Applies to: '));
  if (!line) return []; // no actors displayed on this row -- trivially fine
  return line.replace('Applies to: ', '').split('; ');
}

// Five displayed actors on committed data satisfy neither support rule. Every
// one is a PROXY_MEETING row whose MEMBER_FACTS carry no party or capacity and
// whose ACTOR_OR_PARTIES holds no DIRECT entry — only INHERITED_FROM_ANCESTOR —
// so the display falls through to a synthetic {field, value} entry
// (obligated_party / control_party) that has no source span at all and cannot
// be traced to the authored unit.
//
// Pinned, not excused. These need a ruling: either the synthetic entry earns a
// span, or an actor without one must not be displayed. Any SIXTH unsupported
// actor fails this test, and fixing these five fails it too, so neither can
// pass unnoticed.
const KNOWN_UNSUPPORTED = new Set([]);

test('every displayed actor is supported by a member claim or a DIRECT in-unit source span', () => {
  const viewPolicy = viewPolicyForLegacyV1(familyOrder());
  const failures = [];
  const stillUnsupported = new Set();
  let rowsChecked = 0;
  let rowsWithActors = 0;
  let actorsChecked = 0;

  for (const analysis of analyses()) {
    const projection = projectLegacyAgreementV1(analysis, viewPolicy);
    for (const row of projection.rows) {
      rowsChecked += 1;
      const actors = displayedActors(row);
      if (actors.length === 0) continue;
      rowsWithActors += 1;

      const memberFacts = row.fields.find((field) => field.field_key === 'member_facts').value;
      const actorOrParties = row.fields.find((field) => field.field_key === 'actor_or_parties').value;
      const memberTexts = memberClaimTexts(memberFacts);
      const directTexts = directSpanBackedTexts(actorOrParties, row.citations);

      for (const actor of actors) {
        actorsChecked += 1;
        const key = normalise(actor);
        if (memberTexts.has(key) || directTexts.has(key)) continue;
        const pin = `${row.row_id}::${actor}`;
        if (KNOWN_UNSUPPORTED.has(pin)) {
          stillUnsupported.add(pin);
          continue;
        }
        failures.push(
          `agreement ${row.agreement_id} row ${row.row_id}: actor "${actor}" has neither `
          + 'a member claim (party/capacity) nor a DIRECT source span inside its authored unit',
        );
      }
    }
  }

  assert.equal(rowsChecked, 1111, 'sealed M6 row count');
  assert.ok(rowsWithActors > 0, 'expected at least one row with an Applies to line');
  assert.ok(actorsChecked > 0, 'expected at least one displayed actor to check');
  assert.deepEqual(
    failures,
    [],
    `${failures.length} of ${actorsChecked} displayed actors are unsupported and not pinned:\n${failures.join('\n')}`,
  );
  assert.deepEqual(
    [...stillUnsupported].sort(),
    [...KNOWN_UNSUPPORTED].sort(),
    'the pinned unsupported actors changed -- if one was fixed, remove its pin and say so',
  );
});
