'use strict';

/**
 * lib/review-parity/compare.js
 *
 * The comparison engine. Pure: two arrays of row objects and a compiled
 * mapping in, one deterministic result object out. No I/O, no clock, no
 * locale.
 *
 * FIVE OUTCOMES, never collapsed:
 *
 *   IDENTICAL     Same bytes on both sides.
 *   COSMETIC      Different bytes, same meaning under the folds declared in
 *                 normalise.js.
 *   V2_LOSS       Legacy says something Canonical V2 does not. A dropped
 *                 row, a dropped field, a truncated quotation, a shrunken
 *                 set. This is the dangerous one.
 *   V2_ADDITION   Canonical V2 says something legacy does not.
 *   DISAGREEMENT  Both sides speak; they say different things.
 *
 * V2_LOSS, V2_ADDITION and DISAGREEMENT are all substantive and each is
 * counted separately -- there is no "differs" bucket anywhere in this file.
 */

const {
  ABSENT,
  compareCodeUnits,
  isAbsent,
  normKey,
  normaliseValue,
  parseNumeric,
  readPath,
  renderNormalised,
  sortStrings,
  stableStringify,
} = require('./normalise');

const OUTCOMES = Object.freeze({
  IDENTICAL: 'IDENTICAL',
  COSMETIC: 'COSMETIC',
  V2_LOSS: 'V2_LOSS',
  V2_ADDITION: 'V2_ADDITION',
  DISAGREEMENT: 'DISAGREEMENT',
});

const OUTCOME_ORDER = Object.freeze([
  OUTCOMES.IDENTICAL, OUTCOMES.COSMETIC, OUTCOMES.V2_ADDITION,
  OUTCOMES.DISAGREEMENT, OUTCOMES.V2_LOSS,
]);

const SUBSTANTIVE_OUTCOMES = Object.freeze([
  OUTCOMES.V2_LOSS, OUTCOMES.DISAGREEMENT, OUTCOMES.V2_ADDITION,
]);

function isSubstantive(outcome) {
  return SUBSTANTIVE_OUTCOMES.includes(outcome);
}

// Severity ranking for the single-label summary of a row. V2_LOSS ranks
// above DISAGREEMENT deliberately: a disagreement is visible to whoever
// reads the table, a silent loss is not.
function severityOf(outcome) {
  const index = OUTCOME_ORDER.indexOf(outcome);
  return index === -1 ? 0 : index;
}

function worstOutcome(outcomes) {
  let worst = OUTCOMES.IDENTICAL;
  for (const outcome of outcomes) {
    if (severityOf(outcome) > severityOf(worst)) worst = outcome;
  }
  return worst;
}

function emptyCounts() {
  const counts = {};
  for (const outcome of OUTCOME_ORDER) counts[outcome] = 0;
  return counts;
}

function multiset(members) {
  const counts = new Map();
  for (const member of members) {
    const key = normKey(member);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

function multisetDelta(from, to) {
  const removed = [];
  for (const [key, count] of from) {
    const remaining = count - (to.get(key) || 0);
    for (let index = 0; index < remaining; index += 1) removed.push(key);
  }
  return sortStrings(removed);
}

/** True when `candidate` appears inside `full` in order (not necessarily contiguously). */
function isSubsequence(candidate, full) {
  let cursor = 0;
  for (const item of full) {
    if (cursor < candidate.length && candidate[cursor] === item) cursor += 1;
  }
  return cursor === candidate.length;
}

function asMemberArray(value) {
  if (isAbsent(value)) return [];
  return Array.isArray(value) ? value : [value];
}

/**
 * Classify one field of one paired row.
 *
 * Returns { outcome, detail } where detail carries whatever a reviewer needs
 * to adjudicate the finding without re-running anything.
 */
function classifyField(field, legacyRaw, v2Raw) {
  const options = { fold_case: field.fold_case };
  const legacy = normaliseValue(legacyRaw, options);
  const v2 = normaliseValue(v2Raw, options);

  const legacyAbsent = isAbsent(legacy);
  const v2Absent = isAbsent(v2);

  // Rule: missing on both sides is not a difference.
  if (legacyAbsent && v2Absent) return { outcome: OUTCOMES.IDENTICAL, detail: { reason: 'ABSENT_BOTH_SIDES' }, legacy, v2 };
  // Rule: present on one side only is ALWAYS a difference, never skipped.
  if (legacyAbsent) return { outcome: OUTCOMES.V2_ADDITION, detail: { reason: 'PRESENT_IN_V2_ONLY' }, legacy, v2 };
  if (v2Absent) return { outcome: OUTCOMES.V2_LOSS, detail: { reason: 'PRESENT_IN_LEGACY_ONLY' }, legacy, v2 };

  if (normKey(legacy) === normKey(v2)) {
    const identical = stableStringify(legacyRaw) === stableStringify(v2Raw);
    return {
      outcome: identical ? OUTCOMES.IDENTICAL : OUTCOMES.COSMETIC,
      detail: { reason: identical ? 'BYTE_IDENTICAL' : 'EQUAL_AFTER_NORMALISATION' },
      legacy,
      v2,
    };
  }

  if (field.kind === 'number') {
    const legacyNumber = typeof legacy === 'string' ? parseNumeric(legacy) : null;
    const v2Number = typeof v2 === 'string' ? parseNumeric(v2) : null;
    if (legacyNumber !== null && v2Number !== null) {
      if (legacyNumber === v2Number) {
        return { outcome: OUTCOMES.COSMETIC, detail: { reason: 'EQUAL_NUMERIC_VALUE' }, legacy, v2 };
      }
      return {
        outcome: OUTCOMES.DISAGREEMENT,
        detail: { reason: 'NUMERIC_VALUE_CHANGED', legacy_number: legacyNumber, v2_number: v2Number },
        legacy,
        v2,
      };
    }
    // One side is not parseable as a number. That is itself a finding, and
    // it is a disagreement rather than a fold -- the harness must not guess.
    return {
      outcome: OUTCOMES.DISAGREEMENT,
      detail: { reason: 'NUMERIC_UNPARSEABLE', legacy_parsed: legacyNumber, v2_parsed: v2Number },
      legacy,
      v2,
    };
  }

  if (field.kind === 'quote' && typeof legacy === 'string' && typeof v2 === 'string') {
    if (legacy.includes(v2)) {
      return {
        outcome: OUTCOMES.V2_LOSS,
        detail: { reason: 'QUOTE_TRUNCATED', legacy_length: legacy.length, v2_length: v2.length },
        legacy,
        v2,
      };
    }
    if (v2.includes(legacy)) {
      return {
        outcome: OUTCOMES.V2_ADDITION,
        detail: { reason: 'QUOTE_EXTENDED', legacy_length: legacy.length, v2_length: v2.length },
        legacy,
        v2,
      };
    }
    return { outcome: OUTCOMES.DISAGREEMENT, detail: { reason: 'QUOTE_TEXT_CHANGED' }, legacy, v2 };
  }

  if (field.kind === 'set') {
    const legacyMembers = multiset(asMemberArray(legacy));
    const v2Members = multiset(asMemberArray(v2));
    const lostMembers = multisetDelta(legacyMembers, v2Members);
    const addedMembers = multisetDelta(v2Members, legacyMembers);
    if (!lostMembers.length && !addedMembers.length) {
      // Same membership, different order. For a `set` field that is the
      // definition of cosmetic -- it is the whole reason the kind exists.
      return { outcome: OUTCOMES.COSMETIC, detail: { reason: 'SET_REORDERED' }, legacy, v2 };
    }
    if (lostMembers.length && !addedMembers.length) {
      return { outcome: OUTCOMES.V2_LOSS, detail: { reason: 'SET_MEMBERS_DROPPED', lost_members: lostMembers }, legacy, v2 };
    }
    if (addedMembers.length && !lostMembers.length) {
      return { outcome: OUTCOMES.V2_ADDITION, detail: { reason: 'SET_MEMBERS_ADDED', added_members: addedMembers }, legacy, v2 };
    }
    return {
      outcome: OUTCOMES.DISAGREEMENT,
      detail: { reason: 'SET_MEMBERSHIP_CHANGED', lost_members: lostMembers, added_members: addedMembers },
      legacy,
      v2,
    };
  }

  if (field.kind === 'sequence') {
    const legacyMembers = asMemberArray(legacy).map(normKey);
    const v2Members = asMemberArray(v2).map(normKey);
    const lost = multisetDelta(multiset(asMemberArray(legacy)), multiset(asMemberArray(v2)));
    const added = multisetDelta(multiset(asMemberArray(v2)), multiset(asMemberArray(legacy)));
    if (isSubsequence(v2Members, legacyMembers)) {
      return { outcome: OUTCOMES.V2_LOSS, detail: { reason: 'SEQUENCE_MEMBERS_DROPPED', lost_members: lost }, legacy, v2 };
    }
    if (isSubsequence(legacyMembers, v2Members)) {
      return { outcome: OUTCOMES.V2_ADDITION, detail: { reason: 'SEQUENCE_MEMBERS_ADDED', added_members: added }, legacy, v2 };
    }
    return {
      outcome: OUTCOMES.DISAGREEMENT,
      detail: { reason: 'SEQUENCE_CHANGED', lost_members: lost, added_members: added },
      legacy,
      v2,
    };
  }

  // text | citation | flag: any surviving difference is a disagreement.
  const reasonByKind = { citation: 'CITATION_CHANGED', flag: 'FLAG_CHANGED' };
  return {
    outcome: OUTCOMES.DISAGREEMENT,
    detail: { reason: reasonByKind[field.kind] || 'VALUE_CHANGED' },
    legacy,
    v2,
  };
}

function rowKeyOf(mapping, row) {
  const parts = [];
  const readable = {};
  for (const fieldId of mapping.row_key) {
    const field = mapping.fields.find((candidate) => candidate.field_id === fieldId);
    const raw = readPath(row.value, row.side === 'legacy' ? field.legacy : field.v2);
    const normalised = normaliseValue(raw, { fold_case: field.fold_case });
    parts.push(normKey(normalised));
    readable[fieldId] = renderNormalised(normalised);
  }
  return { key: parts.join(''), readable };
}

function bucketRows(mapping, rows, side) {
  const buckets = new Map();
  rows.forEach((value, index) => {
    const { key, readable } = rowKeyOf(mapping, { value, side });
    if (!buckets.has(key)) buckets.set(key, { key, readable, entries: [] });
    buckets.get(key).entries.push({ index, value });
  });
  return buckets;
}

function displayValue(normalised) {
  return isAbsent(normalised) ? null : renderNormalised(normalised);
}

/**
 * Compare one family for one deal.
 *
 * @param {object}   args
 * @param {object}   args.mapping      compiled mapping (see mapping.js)
 * @param {string}   args.deal_id
 * @param {string=}  args.deal_label
 * @param {object[]} args.legacy_rows  rows as the legacy view produces them
 * @param {object[]} args.v2_rows      rows as the Canonical V2 view produces them
 */
function compareDeal({ mapping, deal_id: dealId, deal_label: dealLabel = null, legacy_rows: legacyRows, v2_rows: v2Rows }) {
  if (!mapping || !Array.isArray(mapping.fields)) throw new TypeError('compareDeal requires a compiled mapping');
  if (typeof dealId !== 'string' || dealId === '') throw new TypeError('compareDeal requires a non-empty deal_id');
  if (!Array.isArray(legacyRows)) throw new TypeError('compareDeal requires legacy_rows to be an array');
  if (!Array.isArray(v2Rows)) throw new TypeError('compareDeal requires v2_rows to be an array');

  const legacyBuckets = bucketRows(mapping, legacyRows, 'legacy');
  const v2Buckets = bucketRows(mapping, v2Rows, 'v2');

  const allKeys = sortStrings(new Set([...legacyBuckets.keys(), ...v2Buckets.keys()]));

  const findings = [];
  const counts = emptyCounts();
  const rowSummaries = [];
  let pairedRows = 0;
  let rowLossCount = 0;
  let rowAdditionCount = 0;
  let identicalFieldCount = 0;

  for (const key of allKeys) {
    const legacyBucket = legacyBuckets.get(key);
    const v2Bucket = v2Buckets.get(key);
    const legacyEntries = legacyBucket ? legacyBucket.entries : [];
    const v2Entries = v2Bucket ? v2Bucket.entries : [];
    const readable = (legacyBucket || v2Bucket).readable;
    const pairCount = Math.min(legacyEntries.length, v2Entries.length);

    // Duplicate row keys are paired by ordinal rather than collapsed, so a
    // dropped duplicate row still surfaces as a row-level loss.
    for (let ordinal = 0; ordinal < pairCount; ordinal += 1) {
      pairedRows += 1;
      const legacyRow = legacyEntries[ordinal].value;
      const v2Row = v2Entries[ordinal].value;
      const fieldOutcomes = [];
      for (const field of mapping.fields) {
        const legacyRaw = readPath(legacyRow, field.legacy);
        const v2Raw = readPath(v2Row, field.v2);
        const result = classifyField(field, legacyRaw, v2Raw);
        counts[result.outcome] += 1;
        fieldOutcomes.push(result.outcome);
        if (result.outcome === OUTCOMES.IDENTICAL) {
          identicalFieldCount += 1;
          continue;
        }
        findings.push({
          deal_id: dealId,
          deal_label: dealLabel,
          family_id: mapping.family_id,
          scope: 'field',
          outcome: result.outcome,
          row_key: readable,
          row_ordinal: ordinal,
          field_id: field.field_id,
          field_kind: field.kind,
          reason: result.detail.reason,
          detail: result.detail,
          legacy_value: displayValue(result.legacy),
          v2_value: displayValue(result.v2),
        });
      }
      rowSummaries.push({
        row_key: readable,
        row_ordinal: ordinal,
        outcome: worstOutcome(fieldOutcomes),
        present_in: 'BOTH',
      });
    }

    for (let ordinal = pairCount; ordinal < legacyEntries.length; ordinal += 1) {
      rowLossCount += 1;
      counts[OUTCOMES.V2_LOSS] += 1;
      findings.push({
        deal_id: dealId,
        deal_label: dealLabel,
        family_id: mapping.family_id,
        scope: 'row',
        outcome: OUTCOMES.V2_LOSS,
        row_key: readable,
        row_ordinal: ordinal,
        field_id: null,
        field_kind: null,
        reason: 'ROW_PRESENT_IN_LEGACY_ONLY',
        detail: { legacy_rows_with_key: legacyEntries.length, v2_rows_with_key: v2Entries.length },
        legacy_value: rowDigest(mapping, legacyEntries[ordinal].value, 'legacy'),
        v2_value: null,
      });
      rowSummaries.push({ row_key: readable, row_ordinal: ordinal, outcome: OUTCOMES.V2_LOSS, present_in: 'LEGACY_ONLY' });
    }

    for (let ordinal = pairCount; ordinal < v2Entries.length; ordinal += 1) {
      rowAdditionCount += 1;
      counts[OUTCOMES.V2_ADDITION] += 1;
      findings.push({
        deal_id: dealId,
        deal_label: dealLabel,
        family_id: mapping.family_id,
        scope: 'row',
        outcome: OUTCOMES.V2_ADDITION,
        row_key: readable,
        row_ordinal: ordinal,
        field_id: null,
        field_kind: null,
        reason: 'ROW_PRESENT_IN_V2_ONLY',
        detail: { legacy_rows_with_key: legacyEntries.length, v2_rows_with_key: v2Entries.length },
        legacy_value: null,
        v2_value: rowDigest(mapping, v2Entries[ordinal].value, 'v2'),
      });
      rowSummaries.push({ row_key: readable, row_ordinal: ordinal, outcome: OUTCOMES.V2_ADDITION, present_in: 'V2_ONLY' });
    }
  }

  // Row ORDER is not itself compared -- rows are paired by key, so a
  // reordered table is not a difference. It is still recorded, because
  // "not a difference" and "invisible" are not the same thing.
  const legacyOrder = legacyRows.map((row) => rowKeyOf(mapping, { value: row, side: 'legacy' }).key);
  const v2Order = v2Rows.map((row) => rowKeyOf(mapping, { value: row, side: 'v2' }).key);
  const sameOrder = legacyOrder.length === v2Order.length
    && legacyOrder.every((key, index) => key === v2Order[index]);

  sortFindings(findings);

  return {
    deal_id: dealId,
    deal_label: dealLabel,
    family_id: mapping.family_id,
    status: 'COMPARED',
    row_counts: {
      legacy: legacyRows.length,
      v2: v2Rows.length,
      paired: pairedRows,
      legacy_only: rowLossCount,
      v2_only: rowAdditionCount,
    },
    outcome_counts: counts,
    identical_field_count: identicalFieldCount,
    row_order_matches: sameOrder,
    row_summaries: rowSummaries,
    findings,
    substantive_count: counts[OUTCOMES.V2_LOSS] + counts[OUTCOMES.V2_ADDITION] + counts[OUTCOMES.DISAGREEMENT],
  };
}

/**
 * A compact, deterministic description of a row that exists on only one
 * side, so a row-level loss is legible without opening the source data.
 */
function rowDigest(mapping, row, side) {
  const parts = [];
  for (const field of mapping.fields) {
    const raw = readPath(row, side === 'legacy' ? field.legacy : field.v2);
    const normalised = normaliseValue(raw, { fold_case: field.fold_case });
    if (isAbsent(normalised)) continue;
    parts.push(`${field.field_id}=${renderNormalised(normalised)}`);
  }
  return parts.join('; ');
}

function findingSortKey(finding) {
  const rowKey = sortStrings(Object.keys(finding.row_key || {}))
    .map((key) => `${key}=${finding.row_key[key] === null ? ' ' : finding.row_key[key]}`)
    .join('');
  return [
    finding.deal_id,
    rowKey,
    String(finding.row_ordinal).padStart(6, '0'),
    finding.scope === 'row' ? '0' : '1',
    finding.field_id === null ? '' : finding.field_id,
  ].join('');
}

function sortFindings(findings) {
  findings.sort((left, right) => compareCodeUnits(findingSortKey(left), findingSortKey(right)));
  return findings;
}

/** A deal whose data the harness could not reach on one or both sides. */
function uncomparableDeal({ deal_id: dealId, deal_label: dealLabel = null, family_id: familyId, reason, missing_sides: missingSides }) {
  return {
    deal_id: dealId,
    deal_label: dealLabel,
    family_id: familyId,
    status: 'UNCOMPARABLE',
    reason,
    missing_sides: sortStrings(missingSides || []),
    row_counts: { legacy: null, v2: null, paired: 0, legacy_only: 0, v2_only: 0 },
    outcome_counts: emptyCounts(),
    identical_field_count: 0,
    row_order_matches: null,
    row_summaries: [],
    findings: [],
    substantive_count: 0,
  };
}

module.exports = {
  ABSENT,
  OUTCOMES,
  OUTCOME_ORDER,
  SUBSTANTIVE_OUTCOMES,
  classifyField,
  compareDeal,
  emptyCounts,
  isSubsequence,
  isSubstantive,
  rowDigest,
  sortFindings,
  uncomparableDeal,
  worstOutcome,
};
