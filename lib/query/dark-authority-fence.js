'use strict';

const DARK_AUTHORITY_STATE = 'VALIDATED_NOT_SERVED';
const UNAUTHENTICATED_SOURCE_STATE = 'SOURCE_UNAUTHENTICATED_EXTERNAL_BOUNDARY';

class DarkAuthorityNotServableError extends Error {
  constructor(message = 'Validated-not-served data cannot enter a served product consumer.') {
    super(message);
    this.name = 'DarkAuthorityNotServableError';
    this.code = 'DARK_AUTHORITY_NOT_SERVABLE';
  }
}

function hasDarkAuthority(value) {
  return Boolean(value && typeof value === 'object'
    && (value.authority_state === DARK_AUTHORITY_STATE
      || value.provenance?.canonical_v2_authority_state === DARK_AUTHORITY_STATE
      || value.source_authentication_state === UNAUTHENTICATED_SOURCE_STATE
      || value.provenance?.source_authentication_state === UNAUTHENTICATED_SOURCE_STATE));
}

function sourceValuesForRow(row) {
  if (!row || typeof row !== 'object') return [];
  return [
    row,
    row.card,
    row.sourceCard,
    row.source,
    ...(Array.isArray(row.sourceCards) ? row.sourceCards : []),
    ...(Array.isArray(row.cards) ? row.cards : []),
  ];
}

function rowHasDarkAuthority(row) {
  return sourceValuesForRow(row).some(hasDarkAuthority);
}

function filterDarkAuthorityRecords(records) {
  return (Array.isArray(records) ? records : []).filter((record) => !hasDarkAuthority(record));
}

function assertNoDarkAuthorityRecords(records, message) {
  if ((Array.isArray(records) ? records : []).some(hasDarkAuthority)) {
    throw new DarkAuthorityNotServableError(message);
  }
}

function assertRowIsServable(row, message) {
  if (rowHasDarkAuthority(row)) throw new DarkAuthorityNotServableError(message);
}

module.exports = {
  DARK_AUTHORITY_STATE,
  UNAUTHENTICATED_SOURCE_STATE,
  DarkAuthorityNotServableError,
  assertNoDarkAuthorityRecords,
  assertRowIsServable,
  filterDarkAuthorityRecords,
  hasDarkAuthority,
  rowHasDarkAuthority,
};
