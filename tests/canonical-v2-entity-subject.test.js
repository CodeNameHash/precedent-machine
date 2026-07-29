const test = require('node:test');
const assert = require('node:assert/strict');

const { canonicalJson, contentId } = require('../lib/canonical-v2/canonical-bytes');
const {
  buildEntitySubject,
  buildEntitySubjectRevision,
  validateEntitySubject,
  validateEntitySubjectRevision,
} = require('../lib/canonical-v2/entity-subject');

const id = (value) => contentId('ENTITY_SUBJECT_TEST/V1', value);

function seedSubject(overrides = {}) {
  return buildEntitySubject({
    identity_authority_type: 'BEN_APPROVED_IMMUTABLE_IMPORT_SEED',
    identity_authority_value: 'PFIZER_ENTITY_SEED',
    identity_authority_evidence: {
      evidence_kind: 'GOVERNED_APPROVAL_ATTESTATION',
      approval_attestation_id: id('ben-approval'),
    },
    ...overrides,
  });
}

function presentRevision(entitySubject, overrides = {}) {
  const evidenceEdgeId = id('entity-classification-evidence');
  return buildEntitySubjectRevision({
    entity_subject: entitySubject,
    display_label: 'Pfizer Inc.',
    classification_revisions: [{
      subject_class: 'ORGANISATION',
      classification_code: 'PUBLIC_COMPANY',
      evidence_edge_id: evidenceEdgeId,
      effective_time_scope_id: id('classification-time-scope'),
    }],
    evidence_edges: [evidenceEdgeId],
    revision_status: { state: 'PRESENT' },
    ...overrides,
  });
}

test('builds a deterministic, closed and deeply frozen entity subject', () => {
  const subject = seedSubject();

  assert.equal(validateEntitySubject(subject), true);
  assert.equal(canonicalJson(subject), canonicalJson(seedSubject()));
  assert.equal(Object.isFrozen(subject), true);
  assert.equal(Object.isFrozen(subject.identity_authority_evidence), true);
});

test('identity uses only the governed authority type and value', () => {
  const first = seedSubject();
  const second = seedSubject({
    identity_authority_evidence: {
      evidence_kind: 'GOVERNED_APPROVAL_ATTESTATION',
      approval_attestation_id: id('replacement-approval'),
    },
  });

  assert.equal(first.entity_subject_id, second.entity_subject_id);
  assert.notEqual(canonicalJson(first), canonicalJson(second));
  assert.throws(() => seedSubject({ display_name: 'Pfizer Inc.' }),
    (error) => error.code === 'INVALID_ENTITY_SUBJECT');
  assert.throws(() => seedSubject({ ticker: 'PFE' }),
    (error) => error.code === 'INVALID_ENTITY_SUBJECT');
  assert.throws(() => seedSubject({ deal_economics: '$43 billion' }),
    (error) => error.code === 'INVALID_ENTITY_SUBJECT');
});

test('external identifiers require exact source evidence', () => {
  const cik = buildEntitySubject({
    identity_authority_type: 'SEC_CIK',
    identity_authority_value: '0000078003',
    identity_authority_evidence: {
      evidence_kind: 'EXACT_SOURCE_OCCURRENCE',
      source_occurrence_id: id('sec-cik-source'),
    },
  });
  const lei = buildEntitySubject({
    identity_authority_type: 'LEI',
    identity_authority_value: '5493001KJTIIGC8Y1R12',
    identity_authority_evidence: {
      evidence_kind: 'EXACT_SOURCE_OCCURRENCE',
      source_occurrence_id: id('lei-source'),
    },
  });

  assert.equal(validateEntitySubject(cik), true);
  assert.equal(validateEntitySubject(lei), true);
  assert.throws(() => buildEntitySubject({
    identity_authority_type: 'SEC_CIK',
    identity_authority_value: '78003',
    identity_authority_evidence: {
      evidence_kind: 'EXACT_SOURCE_OCCURRENCE',
      source_occurrence_id: id('bad-cik-source'),
    },
  }), (error) => error.code === 'INVALID_ENTITY_SUBJECT_AUTHORITY');
  assert.throws(() => seedSubject({
    identity_authority_value: '320a3899-0d74-42d6-a412-3a962997d6ca',
  }), (error) => error.code === 'PROHIBITED_ENTITY_SUBJECT_SEED');
});

test('display and classification changes create revisions without rekeying the subject', () => {
  const subject = seedSubject();
  const first = presentRevision(subject);
  const secondEvidence = id('private-classification-evidence');
  const second = presentRevision(subject, {
    display_label: 'Pfizer',
    classification_revisions: [{
      subject_class: 'ORGANISATION',
      classification_code: 'PRIVATE_COMPANY',
      evidence_edge_id: secondEvidence,
      effective_time_scope_id: id('later-classification-time-scope'),
    }],
    evidence_edges: [secondEvidence],
  });

  assert.equal(first.entity_subject_id, second.entity_subject_id);
  assert.notEqual(first.entity_subject_revision_id, second.entity_subject_revision_id);
  assert.equal(validateEntitySubjectRevision({
    revision: first,
    entity_subject: subject,
  }), true);
});

test('classification evidence and subject class must be consistent', () => {
  const subject = seedSubject();

  assert.throws(() => presentRevision(subject, {
    evidence_edges: [id('different-evidence')],
  }), (error) => error.code === 'UNBOUND_ENTITY_CLASSIFICATION_EVIDENCE');
  assert.throws(() => presentRevision(subject, {
    classification_revisions: [{
      subject_class: 'NATURAL_PERSON',
      classification_code: 'PUBLIC_COMPANY',
      evidence_edge_id: id('entity-classification-evidence'),
      effective_time_scope_id: id('classification-time-scope'),
    }],
  }), (error) => error.code === 'INVALID_ENTITY_CLASSIFICATION');
  assert.throws(() => presentRevision(subject, {
    classification_revisions: [
      {
        subject_class: 'ORGANISATION',
        classification_code: 'PUBLIC_COMPANY',
        evidence_edge_id: id('entity-classification-evidence'),
        effective_time_scope_id: id('classification-time-scope'),
      },
      {
        subject_class: 'GOVERNMENT_BODY',
        classification_code: null,
        evidence_edge_id: id('government-evidence'),
        effective_time_scope_id: id('government-time-scope'),
      },
    ],
    evidence_edges: [id('entity-classification-evidence'), id('government-evidence')],
  }), (error) => error.code === 'CONFLICTING_ENTITY_SUBJECT_CLASS');
});

test('non-present revisions cannot assert entity values and absence needs evidence', () => {
  const subject = seedSubject();

  const notExamined = buildEntitySubjectRevision({
    entity_subject: subject,
    display_label: null,
    classification_revisions: [],
    evidence_edges: [],
    revision_status: {
      state: 'NOT_EXAMINED',
      reason: 'The source family was not examined.',
    },
  });
  assert.equal(notExamined.revision_status.state, 'NOT_EXAMINED');
  assert.throws(() => buildEntitySubjectRevision({
    entity_subject: subject,
    display_label: 'Pfizer Inc.',
    classification_revisions: [],
    evidence_edges: [],
    revision_status: {
      state: 'ABSENT',
      complete_scope_id: id('complete-scope'),
    },
  }), (error) => error.code === 'NON_PRESENT_ENTITY_VALUE');
  assert.throws(() => buildEntitySubjectRevision({
    entity_subject: subject,
    display_label: null,
    classification_revisions: [],
    evidence_edges: [],
    revision_status: {
      state: 'ABSENT',
      complete_scope_id: id('complete-scope'),
    },
  }), (error) => error.code === 'ENTITY_SUBJECT_EVIDENCE_REQUIRED');
});

test('validators reject stale identities and added fields', () => {
  const subject = seedSubject();
  const revision = presentRevision(subject);

  assert.throws(() => validateEntitySubject({
    ...structuredClone(subject),
    entity_subject_id: id('stale-subject'),
  }), (error) => error.code === 'STALE_ENTITY_SUBJECT');
  assert.throws(() => validateEntitySubjectRevision({
    revision: {
      ...structuredClone(revision),
      cleaned_name: 'pfizer',
    },
    entity_subject: subject,
  }), (error) => error.code === 'INVALID_ENTITY_SUBJECT');
});
