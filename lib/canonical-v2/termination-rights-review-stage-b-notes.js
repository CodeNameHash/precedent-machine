'use strict';

const REVIEW_ROWS_FIELD = 'canonical_v2_termination_rights_review_rows';
const WITHHELD_IDENTITY_KEYS = Object.freeze([
  'profile_id',
  'requirement_id',
  'expression_id',
  'rule_id',
  'inventory_fingerprint',
  'approval_record',
  'registration_id',
  'activation_id',
]);

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function displayNote(note) {
  if (!isObject(note)
      || typeof note.display_text !== 'string'
      || !note.display_text
      || typeof note.disposition_kind !== 'string'
      || !note.disposition_kind
      || typeof note.field_key !== 'string'
      || !note.field_key) {
    return null;
  }
  const result = {
    display_text: note.display_text,
    disposition_kind: note.disposition_kind,
    field_key: note.field_key,
  };
  if (WITHHELD_IDENTITY_KEYS.some((key) => Object.prototype.hasOwnProperty.call(result, key))) {
    return null;
  }
  return Object.freeze(result);
}

function collectDisplayNotes(blueprint) {
  if (!isObject(blueprint) || !Array.isArray(blueprint.proposed_profiles)) return [];
  const notes = [];
  for (const profile of blueprint.proposed_profiles) {
    if (!isObject(profile) || !Array.isArray(profile.governed_disclosure_notes)) continue;
    const proposedKey = typeof profile.proposed_profile_key === 'string'
      ? profile.proposed_profile_key
      : '';
    for (const note of profile.governed_disclosure_notes) {
      const attached = displayNote(note);
      if (!attached) continue;
      notes.push(Object.freeze({
        ...attached,
        profile_key: typeof note.profile_key === 'string' ? note.profile_key : '',
        proposed_profile_key: proposedKey,
      }));
    }
  }
  return notes;
}

function rowMatchesNote(row, note) {
  const profileKey = typeof row?.profile_key === 'string' ? row.profile_key : '';
  return Boolean(profileKey) && (
    profileKey === note.profile_key
    || (note.proposed_profile_key && profileKey.endsWith(note.proposed_profile_key))
  );
}

function attachNotesToExpression(expression, notes) {
  if (!isObject(expression) || !Array.isArray(expression.children)) return expression;
  return {
    ...expression,
    children: expression.children.map((child) => {
      if (!isObject(child)) return child;
      if (child.kind === 'FACT' && isObject(child.node)) {
        const matches = notes.filter((note) => note.field_key === child.node.field_key)
          .map((note) => displayNote(note))
          .filter(Boolean);
        if (matches.length === 0) return child;
        return {
          ...child,
          node: {
            ...child.node,
            governed_disclosure_notes: matches,
          },
        };
      }
      if (child.kind === 'EXPRESSION') {
        return {
          ...child,
          node: attachNotesToExpression(child.node, notes),
        };
      }
      return child;
    }),
  };
}

function attachStageBGovernedDisclosureNotes(reviewDeal, blueprint) {
  const notes = collectDisplayNotes(blueprint);
  const reviewRows = reviewDeal?.[REVIEW_ROWS_FIELD];
  if (!notes.length
      || !isObject(reviewDeal)
      || !isObject(reviewRows)
      || !Array.isArray(reviewRows.rows)) {
    return reviewDeal;
  }

  let changed = false;
  const rows = reviewRows.rows.map((row) => {
    const matching = notes.filter((note) => rowMatchesNote(row, note));
    if (matching.length === 0) return row;
    changed = true;
    return {
      ...row,
      expression_tree: attachNotesToExpression(row.expression_tree, matching),
    };
  });
  if (!changed) return reviewDeal;

  return Object.freeze({
    ...reviewDeal,
    [REVIEW_ROWS_FIELD]: Object.freeze({
      ...reviewRows,
      rows: Object.freeze(rows),
    }),
  });
}

module.exports = {
  attachStageBGovernedDisclosureNotes,
};
