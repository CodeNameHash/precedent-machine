'use strict';

const CERTIFICATE_RELATIONSHIP_STATUS = Object.freeze({
  VERBATIM_SECTION_REFERENCES: 'VERBATIM_SECTION_REFERENCES',
});

function isVerbatimSectionReferenceRelationship(value) {
  return value === CERTIFICATE_RELATIONSHIP_STATUS.VERBATIM_SECTION_REFERENCES;
}

module.exports = {
  CERTIFICATE_RELATIONSHIP_STATUS,
  isVerbatimSectionReferenceRelationship,
};
