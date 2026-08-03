'use strict';

const { GENERAL_COVENANT_CODES_V1 } = require('./contract-bundle');

const GENERAL_COVENANT_SOURCE_DISPOSITIONS_SCHEMA = 'GENERAL_COVENANT_SOURCE_DISPOSITIONS/V1';
const GROUNDED_REPOSITORY_PRODUCTION_SNAPSHOT = 'GROUNDED_REPOSITORY_PRODUCTION_SNAPSHOT';
const OPEN_NO_GROUNDED_PRODUCTION_EVIDENCE = 'OPEN_NO_GROUNDED_PRODUCTION_EVIDENCE';

const GENERAL_COVENANT_SOURCE_DISPOSITIONS = Object.freeze(Object.fromEntries(
  GENERAL_COVENANT_CODES_V1.map((code) => [
    code,
    GROUNDED_REPOSITORY_PRODUCTION_SNAPSHOT,
  ]),
));

function validateGeneralCovenantSourceDispositions(value = GENERAL_COVENANT_SOURCE_DISPOSITIONS) {
  const keys = Object.keys(value).sort();
  const expected = [...GENERAL_COVENANT_CODES_V1].sort();
  if (JSON.stringify(keys) !== JSON.stringify(expected)) throw new TypeError('General Covenant source dispositions must cover exactly the routed codes.');
  for (const disposition of Object.values(value)) {
    if (![GROUNDED_REPOSITORY_PRODUCTION_SNAPSHOT, OPEN_NO_GROUNDED_PRODUCTION_EVIDENCE].includes(disposition)) {
      throw new TypeError(`Unknown General Covenant source disposition: ${disposition}`);
    }
  }
  return true;
}

function sourceEvidencePromotionPermitted(code) {
  return GENERAL_COVENANT_SOURCE_DISPOSITIONS[code] === GROUNDED_REPOSITORY_PRODUCTION_SNAPSHOT;
}

module.exports = {
  GENERAL_COVENANT_SOURCE_DISPOSITIONS_SCHEMA,
  GENERAL_COVENANT_SOURCE_DISPOSITIONS,
  GROUNDED_REPOSITORY_PRODUCTION_SNAPSHOT,
  OPEN_NO_GROUNDED_PRODUCTION_EVIDENCE,
  sourceEvidencePromotionPermitted,
  validateGeneralCovenantSourceDispositions,
};
