const {
  CanonicalValidationError,
  canonicalise,
  validateCanonicalWriteSet,
  validateResolvedCanonicalWriteSet,
} = require('./validate-write-set');
const { canonicalJson, contentId } = require('./canonical-bytes');
const { buildCanonicalWriteInputDigest } = require('./canonical-write-envelope');
const { validateContractBundle } = require('./contract-bundle');
const { validateSecEdgarIntakeCapture } = require('./sec-edgar-intake-capture');
const { validateVerifiedSecSourceAdmission } = require('./sec-source-admission');
const {
  reconstructSourceArtifact,
  validateSourceArtifactChunk,
  validateSourceArtifactManifest,
} = require('./source-artifact-chunks');
const {
  buildAdmittedSemanticSourceContext,
  buildAdmittedSourceReference,
} = require('./admitted-semantic-source');

const ALLOWED_OPERATIONS = new Set([
  'FIXTURE_DEAL_EXTRACTION_RUN',
  'INTAKE_CAPTURE',
  'STAGE_SOURCE_ARTIFACT_CHUNK',
  'PREPARE_SOURCE_ADMISSION',
  'DEAL_SCOPE_RUN',
]);
const WRITE_ORDER = [
  'excerpts',
  'validated_semantic_graphs',
  'provisions',
  'components',
  'condition_groups',
  'claims',
  'relationships',
  'open_world_candidates',
  'open_world_candidate_occurrences',
  'open_world_evidence_references',
  'open_world_candidate_dispositions',
  'open_world_primitives',
  'semantic_impact_closures',
  'reviewed_source_specific_rows',
  'incomplete_canonical_result_rows',
];
const OBJECT_ID_FIELDS = Object.freeze({
  excerpts: 'excerpt_id',
  validated_semantic_graphs: 'validated_semantic_graph_id',
  provisions: 'provision_instance_id',
  components: 'provision_component_id',
  condition_groups: 'condition_group_revision_id',
  claims: 'claim_revision_id',
  relationships: 'relationship_revision_id',
  open_world_candidates: 'candidate_id',
  open_world_candidate_occurrences: 'open_world_candidate_occurrence_id',
  open_world_evidence_references: 'evidence_reference_id',
  open_world_candidate_dispositions: 'final_disposition_id',
  open_world_primitives: 'primitive_id',
  semantic_impact_closures: 'semantic_impact_closure_id',
  reviewed_source_specific_rows: 'reviewed_source_specific_row_serving_key',
  incomplete_canonical_result_rows: 'incomplete_result_review_row_serving_key',
});
const DEAL_SCOPE_WRITE_SET_KEYS = Object.freeze([
  'source_references',
  'deal',
  ...WRITE_ORDER,
]);

class CanonicalWriterError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'CanonicalWriterError';
    this.code = code;
    this.details = details;
  }
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function assertOperation(operation) {
  if (!ALLOWED_OPERATIONS.has(operation)) {
    throw new CanonicalWriterError('UNSUPPORTED_OPERATION', 'The canonical writer operation is not permitted.', { operation });
  }
}

function assertIdempotencyKey(value) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new CanonicalWriterError('INVALID_IDEMPOTENCY_KEY', 'idempotencyKey must be a non-empty string.');
  }
  return value.trim();
}

function buildCanonicalWriteReceipt({
  operation,
  idempotencyKey,
  inputDigest,
  validation,
}) {
  const body = {
    operation,
    idempotencyKey,
    inputDigest,
    status: 'COMMITTED',
    publishableObjectCount: validation.counts.publishable,
    residualCount: validation.counts.residuals,
    quarantinedClosureCount: validation.counts.quarantinedClosures,
  };
  return {
    receiptId: contentId('CANONICAL_WRITE_RECEIPT/V1', body),
    ...body,
  };
}

function idempotencyConflict(operation, idempotencyKey, existingDigest, inputDigest) {
  return new CanonicalWriterError(
    'IDEMPOTENCY_CONFLICT',
    'The idempotency key is already bound to different canonical input.',
    { operation, idempotencyKey, existingDigest, inputDigest },
  );
}

function admittedRows(publishableWriteSet) {
  if (publishableWriteSet.sources) {
    return {
      sources: publishableWriteSet.sources,
      admissions: publishableWriteSet.source_admissions,
    };
  }
  return {
    sources: [publishableWriteSet.source],
    admissions: [publishableWriteSet.source_admission],
  };
}

function validateIntakeWriteSet(writeSet) {
  if (!writeSet || Array.isArray(writeSet)
    || Object.getPrototypeOf(writeSet) !== Object.prototype
    || Object.keys(writeSet).length !== 1
    || !Object.hasOwn(writeSet, 'intake_capture')) {
    throw new CanonicalWriterError(
      'INVALID_INTAKE_WRITE_SET',
      'INTAKE_CAPTURE writeSet must contain exactly intake_capture.',
    );
  }
  validateSecEdgarIntakeCapture(writeSet.intake_capture);
  return {
    counts: { publishable: 1, residuals: 0, quarantinedClosures: 0 },
    publishableWriteSet: canonicalise(writeSet),
    residuals: [],
    quarantines: [],
    quarantinedClosureIds: [],
  };
}

function validateSourceArtifactWriteSet(writeSet) {
  const keys = ['source_artifact_manifest', 'source_artifact_chunk'];
  if (!writeSet || Array.isArray(writeSet)
    || Object.getPrototypeOf(writeSet) !== Object.prototype
    || Object.keys(writeSet).sort().join('|') !== keys.sort().join('|')) {
    throw new CanonicalWriterError(
      'INVALID_SOURCE_ARTIFACT_WRITE_SET',
      'STAGE_SOURCE_ARTIFACT_CHUNK writeSet must contain exactly source_artifact_manifest and source_artifact_chunk.',
    );
  }
  validateSourceArtifactChunk({
    manifest: writeSet.source_artifact_manifest,
    chunk: writeSet.source_artifact_chunk,
  });
  return {
    counts: { publishable: 2, residuals: 0, quarantinedClosures: 0 },
    publishableWriteSet: canonicalise(writeSet),
    residuals: [],
    quarantines: [],
    quarantinedClosureIds: [],
  };
}

function validateCaptureReference(reference) {
  const keys = [
    'schema_version',
    'intake_capture_receipt_id',
    'source_response_content_id',
  ];
  if (!reference || Array.isArray(reference)
    || Object.getPrototypeOf(reference) !== Object.prototype
    || Object.keys(reference).sort().join('|') !== keys.sort().join('|')
    || reference.schema_version !== 'INTAKE_CAPTURE_REFERENCE/V1'
    || !/^[a-f0-9]{64}$/.test(reference.intake_capture_receipt_id || '')
    || !/^[a-f0-9]{64}$/.test(reference.source_response_content_id || '')) {
    throw new CanonicalWriterError(
      'INVALID_INTAKE_CAPTURE_REFERENCE',
      'capture_reference must match its closed portable identity contract.',
    );
  }
}

function validateSourceAdmissionWriteSet(writeSet) {
  const keys = [
    'capture_reference',
    'conversion_artifact_manifest',
    'verification',
    'source_admission_bundle',
  ];
  if (!writeSet || Array.isArray(writeSet)
    || Object.getPrototypeOf(writeSet) !== Object.prototype
    || Object.keys(writeSet).sort().join('|') !== keys.sort().join('|')) {
    throw new CanonicalWriterError(
      'INVALID_SOURCE_ADMISSION_WRITE_SET',
      'PREPARE_SOURCE_ADMISSION writeSet must contain exactly capture_reference, conversion_artifact_manifest, verification and source_admission_bundle.',
    );
  }
  validateCaptureReference(writeSet.capture_reference);
  validateSourceArtifactManifest(writeSet.conversion_artifact_manifest);
  return {
    counts: { publishable: 6, residuals: 0, quarantinedClosures: 0 },
    publishableWriteSet: canonicalise(writeSet),
    residuals: [],
    quarantines: [],
    quarantinedClosureIds: [],
  };
}

async function resolveSourceAdmissionWriteSet(repository, writeSet) {
  const required = [
    'getIntakeCapture',
    'getSourceArtifactManifest',
    'getSourceArtifactChunks',
  ];
  if (required.some((method) => typeof repository[method] !== 'function')) {
    throw new CanonicalWriterError(
      'INVALID_REPOSITORY',
      'source admission requires intake and source-artifact repository reads.',
    );
  }
  const reference = writeSet.capture_reference;
  const capture = await repository.getIntakeCapture(reference.intake_capture_receipt_id);
  if (!capture) {
    throw new CanonicalWriterError(
      'INTAKE_CAPTURE_NOT_FOUND',
      'Source admission requires its exact intake capture to be committed first.',
    );
  }
  validateSecEdgarIntakeCapture(capture);
  if (capture.source_response_content_id !== reference.source_response_content_id) {
    throw new CanonicalWriterError(
      'INTAKE_CAPTURE_CONFLICT',
      'Committed intake capture differs from the portable capture reference.',
    );
  }
  const requestedManifest = writeSet.conversion_artifact_manifest;
  const storedManifest = await repository.getSourceArtifactManifest(
    requestedManifest.artifact_manifest_id,
  );
  if (!storedManifest) {
    throw new CanonicalWriterError(
      'SOURCE_ARTIFACT_MANIFEST_NOT_FOUND',
      'Source admission requires its exact conversion artifact manifest to be staged first.',
    );
  }
  if (contentId('CANONICAL_OBJECT/V1', storedManifest)
    !== contentId('CANONICAL_OBJECT/V1', requestedManifest)) {
    throw new CanonicalWriterError(
      'SOURCE_ARTIFACT_MANIFEST_CONFLICT',
      'Stored source artifact manifest differs from the source-admission reference.',
    );
  }
  const chunks = await repository.getSourceArtifactChunks(requestedManifest.artifact_manifest_id);
  const conversion = reconstructSourceArtifact({ manifest: storedManifest, chunks });
  validateVerifiedSecSourceAdmission({
    capture,
    conversion,
    verification: writeSet.verification,
    bundle: writeSet.source_admission_bundle,
  });
  return {
    counts: { publishable: 6, residuals: 0, quarantinedClosures: 0 },
    publishableWriteSet: canonicalise(writeSet),
    resolved: { capture, conversion },
    residuals: [],
    quarantines: [],
    quarantinedClosureIds: [],
  };
}

function assertDealScopeWriteSetShape(writeSet, contractBundle) {
  const actualKeys = Object.keys(writeSet || {}).sort();
  const requiredKeys = [...DEAL_SCOPE_WRITE_SET_KEYS].sort();
  const allowedKeys = [...DEAL_SCOPE_WRITE_SET_KEYS, 'persisted_object_references'].sort();
  const allowsLegacyConditionGroups =
    contractBundle.capitalisation_semantic_schema_definition == null;
  const legacyKeys = DEAL_SCOPE_WRITE_SET_KEYS.filter((key) => key !== 'condition_groups').sort();
  const legacyAllowedKeys = [...legacyKeys, 'persisted_object_references'].sort();
  if (!writeSet || Array.isArray(writeSet)
    || Object.getPrototypeOf(writeSet) !== Object.prototype
    || (canonicalJson(actualKeys) !== canonicalJson(requiredKeys)
      && canonicalJson(actualKeys) !== canonicalJson(allowedKeys))
    && (!allowsLegacyConditionGroups
      || (canonicalJson(actualKeys) !== canonicalJson(legacyKeys)
        && canonicalJson(actualKeys) !== canonicalJson(legacyAllowedKeys)))
    || !Array.isArray(writeSet.source_references)
    || writeSet.source_references.length === 0
    || (writeSet.persisted_object_references !== undefined
      && !Array.isArray(writeSet.persisted_object_references))) {
    throw new CanonicalWriterError(
      'INVALID_DEAL_SCOPE_WRITE_SET',
      'DEAL_SCOPE_RUN writeSet must match the closed reference-only semantic contract.',
    );
  }
  for (const key of WRITE_ORDER) {
    if (key === 'condition_groups' && writeSet[key] === undefined && allowsLegacyConditionGroups) continue;
    if (!Array.isArray(writeSet[key])) {
      throw new CanonicalWriterError(
        'INVALID_DEAL_SCOPE_WRITE_SET',
        `DEAL_SCOPE_RUN writeSet.${key} must be an array.`,
      );
    }
  }
}

async function resolvePersistedCanonicalObjects(resolver, references) {
  if (references.length === 0) return [];
  if (typeof resolver !== 'function') {
    throw new CanonicalWriterError(
      'PERSISTED_REFERENCE_RESOLVER_UNAVAILABLE',
      'repository must resolve persisted canonical object references as one bounded read.',
    );
  }
  const records = await resolver(references);
  if (!Array.isArray(records) || records.length !== references.length
    || records.some((record) => !record || typeof record !== 'object' || Array.isArray(record))) {
    throw new CanonicalWriterError(
      'PERSISTED_REFERENCE_UNRESOLVED',
      'every persisted canonical object reference must resolve exactly once.',
    );
  }
  return records;
}

async function resolveAdmittedSemanticContexts(resolver, sourceReferences) {
  if (typeof resolver !== 'function') {
    throw new CanonicalWriterError(
      'SOURCE_REFERENCE_RESOLVER_UNAVAILABLE',
      'repository must resolve admitted source references as one bounded read.',
    );
  }
  const records = await resolver(sourceReferences);
  if (!Array.isArray(records) || records.length !== sourceReferences.length) {
    throw new CanonicalWriterError(
      'ADMITTED_SOURCE_REFERENCE_UNRESOLVED',
      'every source reference must resolve exactly once.',
    );
  }
  return records.map((record, index) => {
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      throw new CanonicalWriterError(
        'ADMITTED_SOURCE_REFERENCE_UNRESOLVED',
        'every source reference must resolve exactly once.',
        { index },
      );
    }
    const reference = sourceReferences[index];
    const input = {
      immutable_source_document: record.immutable_source_document,
      source_admission_manifest: record.source_admission_manifest,
      semantic_extraction_input_envelope: record.semantic_extraction_input_envelope,
      conversion: record.conversion,
      governed_deal_key: reference.governed_deal_key,
      deal_admission_id: reference.deal_admission_id,
      source_ordinal: reference.source_ordinal,
    };
    const context = buildAdmittedSemanticSourceContext(input);
    if (canonicalJson(buildAdmittedSourceReference(context)) !== canonicalJson(reference)) {
      throw new CanonicalWriterError(
        'ADMITTED_SOURCE_REFERENCE_MISMATCH',
        'resolved source lineage does not match its governed reference.',
        { index },
      );
    }
    return context;
  });
}

async function writeDealScopeRun({
  repository,
  contractBundle,
  idempotencyKey,
  dryRun,
  writeSet,
}) {
  validateContractBundle(contractBundle);
  assertDealScopeWriteSetShape(writeSet, contractBundle);
  const validateResolved = async (resolver) => {
    const [admittedSourceContexts, retainedCanonicalObjects] = await Promise.all([
      resolveAdmittedSemanticContexts(resolver.sourceReferences, writeSet.source_references),
      resolvePersistedCanonicalObjects(
        resolver.persistedObjects,
        writeSet.persisted_object_references || [],
      ),
    ]);
    return validateResolvedCanonicalWriteSet({
      writeSet,
      contractBundle,
      admittedSourceContexts,
      retainedCanonicalObjects,
    });
  };
  const digestValidation = (resolvedValidation) => buildCanonicalWriteInputDigest({
    operation: 'DEAL_SCOPE_RUN',
    idempotencyKey,
    writeSet: resolvedValidation.publishableWriteSet,
    residuals: resolvedValidation.residuals,
    quarantines: resolvedValidation.quarantines,
  });
  const validation = await validateResolved(
    {
      sourceReferences: repository.resolveAdmittedSourceReferences?.bind(repository),
      persistedObjects:
        repository.resolvePersistedCanonicalObjectReferences?.bind(repository),
    },
  );
  const inputDigest = digestValidation(validation);
  const existing = await repository.getReceipt('DEAL_SCOPE_RUN', idempotencyKey);
  if (existing && existing.inputDigest !== inputDigest) {
    throw idempotencyConflict(
      'DEAL_SCOPE_RUN',
      idempotencyKey,
      existing.inputDigest,
      inputDigest,
    );
  }

  if (existing || dryRun === true) {
    if (existing) {
      return { dryRun: false, replayed: true, receipt: clone(existing), validation };
    }
    return { dryRun: true, replayed: false, inputDigest, receipt: null, validation };
  }

  const committed = await repository.transaction(async (transaction) => {
    const concurrent = await transaction.getReceipt('DEAL_SCOPE_RUN', idempotencyKey);
    if (concurrent) {
      if (concurrent.inputDigest !== inputDigest) {
        throw idempotencyConflict(
          'DEAL_SCOPE_RUN',
          idempotencyKey,
          concurrent.inputDigest,
          inputDigest,
        );
      }
      const validation = await validateResolved(
        {
          sourceReferences: transaction.resolveAdmittedSourceReferences?.bind(transaction),
          persistedObjects:
            transaction.resolvePersistedCanonicalObjectReferences?.bind(transaction),
        },
      );
      if (digestValidation(validation) !== inputDigest) {
        throw new CanonicalWriterError(
          'VALIDATION_SNAPSHOT_CONFLICT',
          'Resolved canonical outputs changed before replay validation.',
        );
      }
      return { receipt: concurrent, replayed: true, validation };
    }

    const transactionValidation = await validateResolved(
      {
        sourceReferences: transaction.resolveAdmittedSourceReferences?.bind(transaction),
        persistedObjects:
          transaction.resolvePersistedCanonicalObjectReferences?.bind(transaction),
      },
    );
    const transactionDigest = digestValidation(transactionValidation);
    if (transactionDigest !== inputDigest) {
      throw new CanonicalWriterError(
        'VALIDATION_SNAPSHOT_CONFLICT',
        'Resolved canonical outputs changed before the write transaction.',
      );
    }
    const publishableClosureIds = new Set(WRITE_ORDER.flatMap(
      (kind) => transactionValidation.publishableWriteSet[kind].map((row) => row.closure_id),
    ));
    for (const closureId of publishableClosureIds) {
      if (await transaction.getQuarantineByClosure(closureId)) {
        throw new CanonicalWriterError(
          'QUARANTINED_CLOSURE_CONFLICT',
          'A quarantined semantic closure cannot later publish under the same identity.',
          { closureId },
        );
      }
    }

    const receipt = buildCanonicalWriteReceipt({
      operation: 'DEAL_SCOPE_RUN',
      idempotencyKey,
      inputDigest,
      validation: transactionValidation,
    });
    if (typeof transaction.writeDealAdmission !== 'function') {
      throw new CanonicalWriterError(
        'DEAL_ADMISSION_WRITER_UNAVAILABLE',
        'DEAL_SCOPE_RUN requires immutable deal admission identity persistence.',
      );
    }
    await transaction.writeDealAdmission(
      transactionValidation.publishableWriteSet.deal,
    );
    for (const kind of WRITE_ORDER) {
      for (const row of transactionValidation.publishableWriteSet[kind]) {
        await transaction.writeObject(kind, row);
      }
    }
    for (const residual of transactionValidation.residuals) {
      await transaction.writeResidual(residual);
    }
    for (const quarantine of transactionValidation.quarantines) {
      await transaction.writeQuarantine(quarantine);
    }
    await transaction.writeReceipt(receipt);
    return { receipt, replayed: false, validation: transactionValidation };
  });

  return {
    dryRun: false,
    replayed: committed.replayed,
    receipt: clone(committed.receipt),
    validation: committed.validation,
  };
}

function createCanonicalWriter({ repository, contractBundle }) {
  if (!repository || typeof repository.transaction !== 'function' || typeof repository.getReceipt !== 'function') {
    throw new CanonicalWriterError('INVALID_REPOSITORY', 'repository must implement getReceipt and transaction.');
  }

  return {
    async write({ operation, idempotencyKey, dryRun = false, writeSet } = {}) {
      assertOperation(operation);
      const key = assertIdempotencyKey(idempotencyKey);
      if (operation === 'DEAL_SCOPE_RUN') {
        return writeDealScopeRun({
          repository,
          contractBundle,
          idempotencyKey: key,
          dryRun,
          writeSet,
        });
      }
      const isSemantic = operation === 'FIXTURE_DEAL_EXTRACTION_RUN';
      if (isSemantic) validateContractBundle(contractBundle);
      let validation = operation === 'INTAKE_CAPTURE'
        ? validateIntakeWriteSet(writeSet)
        : operation === 'STAGE_SOURCE_ARTIFACT_CHUNK'
          ? validateSourceArtifactWriteSet(writeSet)
          : operation === 'PREPARE_SOURCE_ADMISSION'
            ? validateSourceAdmissionWriteSet(writeSet)
            : validateCanonicalWriteSet(writeSet, contractBundle);
      const inputDigest = buildCanonicalWriteInputDigest({
        operation,
        idempotencyKey: key,
        writeSet: validation.publishableWriteSet,
        residuals: validation.residuals,
        quarantines: validation.quarantines,
      });

      const existing = await repository.getReceipt(operation, key);
      if (existing) {
        if (existing.inputDigest !== inputDigest) {
          throw idempotencyConflict(operation, key, existing.inputDigest, inputDigest);
        }
        return { dryRun: false, replayed: true, receipt: clone(existing), validation };
      }

      if (dryRun === true) {
        if (operation === 'PREPARE_SOURCE_ADMISSION') {
          validation = await resolveSourceAdmissionWriteSet(repository, writeSet);
        }
        return { dryRun: true, replayed: false, inputDigest, receipt: null, validation };
      }

      const receipt = buildCanonicalWriteReceipt({
        operation,
        idempotencyKey: key,
        inputDigest,
        validation,
      });
      const isIntake = operation === 'INTAKE_CAPTURE';
      const isSourceArtifactChunk = operation === 'STAGE_SOURCE_ARTIFACT_CHUNK';
      const isSourceAdmission = operation === 'PREPARE_SOURCE_ADMISSION';
      const publishableClosureIds = !isSemantic ? new Set() : new Set(WRITE_ORDER.flatMap(
        (kind) => validation.publishableWriteSet[kind].map((row) => row.closure_id),
      ));
      const committed = await repository.transaction(async (transaction) => {
        const concurrent = await transaction.getReceipt(operation, key);
        if (concurrent) {
          if (concurrent.inputDigest !== inputDigest) {
            throw idempotencyConflict(operation, key, concurrent.inputDigest, inputDigest);
          }
          return { receipt: concurrent, replayed: true };
        }

        for (const closureId of publishableClosureIds) {
          if (await transaction.getQuarantineByClosure(closureId)) {
            throw new CanonicalWriterError(
              'QUARANTINED_CLOSURE_CONFLICT',
              'A quarantined semantic closure cannot later publish under the same identity.',
              { closureId },
            );
          }
        }

        if (isIntake) {
          await transaction.writeIntakeCapture(validation.publishableWriteSet.intake_capture);
        } else if (isSourceArtifactChunk) {
          await transaction.writeSourceArtifactManifest(
            validation.publishableWriteSet.source_artifact_manifest,
          );
          await transaction.writeSourceArtifactChunk(
            validation.publishableWriteSet.source_artifact_chunk,
          );
        } else if (isSourceAdmission) {
          validation = await resolveSourceAdmissionWriteSet(transaction, writeSet);
          const sourceAdmission = validation.publishableWriteSet;
          const { conversion } = validation.resolved;
          const bundle = sourceAdmission.source_admission_bundle;
          await transaction.writeCanonicalTextConversion(conversion);
          await transaction.writeVerificationManifest(sourceAdmission.verification);
          await transaction.writeSource(bundle.immutable_source_document);
          await transaction.writeSourceAdmission(bundle.source_admission_manifest);
          await transaction.writeSourceAdmissionPreparationReceipt(
            bundle.source_admission_preparation_receipt,
          );
          await transaction.writeSemanticExtractionInputEnvelope(
            bundle.semantic_extraction_input_envelope,
          );
        } else {
          const admitted = admittedRows(validation.publishableWriteSet);
          for (const source of admitted.sources) await transaction.writeSource(source);
          for (const admission of admitted.admissions) await transaction.writeSourceAdmission(admission);
          await transaction.writeDeal(validation.publishableWriteSet.deal);
          for (const kind of WRITE_ORDER) {
            for (const row of validation.publishableWriteSet[kind]) await transaction.writeObject(kind, row);
          }
          for (const residual of validation.residuals) await transaction.writeResidual(residual);
          for (const quarantine of validation.quarantines) await transaction.writeQuarantine(quarantine);
        }
        await transaction.writeReceipt(receipt);
        return { receipt, replayed: false };
      });

      return {
        dryRun: false,
        replayed: committed.replayed,
        receipt: clone(committed.receipt),
        validation,
      };
    },
  };
}

class InMemoryCanonicalRepository {
  constructor({ persistedCanonicalObjects = [] } = {}) {
    this.state = {
      intakeCaptures: [],
      sources: [],
      sourceAdmissions: [],
      deals: [],
      dealAdmissionRecords: [],
      excerpts: [],
      validated_semantic_graphs: [],
      provisions: [],
      components: [],
      condition_groups: [],
      claims: [],
      relationships: [],
      open_world_candidates: [],
      open_world_candidate_occurrences: [],
      open_world_evidence_references: [],
      open_world_candidate_dispositions: [],
      open_world_primitives: [],
      semantic_impact_closures: [],
      reviewed_source_specific_rows: [],
      incomplete_canonical_result_rows: [],
      residuals: [],
      quarantines: [],
      receipts: [],
    };
    this.persistedCanonicalPayloadDigests = new Map();
    for (const record of persistedCanonicalObjects) {
      const identityField = OBJECT_ID_FIELDS[record?.object_kind];
      const row = record?.canonical_payload;
      const objectId = identityField && row?.[identityField];
      const digest = record?.canonical_payload_digest;
      if (!identityField
        || !objectId
        || !row
        || row.closure_id === undefined
        || !/^[0-9a-f]{64}$/.test(digest || '')) {
        throw new CanonicalWriterError(
          'INVALID_PERSISTED_CANONICAL_OBJECT',
          'Seeded canonical objects must carry exact kind, identity, closure and stored digest.',
        );
      }
      const key = `${record.object_kind}:${objectId}`;
      if (this.persistedCanonicalPayloadDigests.has(key)
        || this.state[record.object_kind].some(
          (entry) => entry[identityField] === objectId,
        )) {
        throw new CanonicalWriterError(
          'DUPLICATE_PERSISTED_CANONICAL_OBJECT',
          'Seeded canonical object identities must be unique.',
          { objectKind: record.object_kind, objectId },
        );
      }
      this.state[record.object_kind].push(clone(row));
      this.persistedCanonicalPayloadDigests.set(key, digest);
    }
    this.transactionCount = 0;
    this._failure = null;
  }

  injectFailureOnce(step, after = 1) {
    this._failure = { step, remaining: after };
  }

  snapshot() {
    return clone(this.state);
  }

  async getReceipt(operation, idempotencyKey) {
    return clone(this.state.receipts.find((row) => row.operation === operation && row.idempotencyKey === idempotencyKey) || null);
  }

  async getIntakeCapture(intakeCaptureReceiptId) {
    return clone(this.state.intakeCaptures.find(
      (row) => row.intake_capture_receipt_id === intakeCaptureReceiptId,
    ) || null);
  }

  async getSourceArtifactManifest(artifactManifestId) {
    return clone((this.state.sourceArtifactManifests || []).find(
      (row) => row.artifact_manifest_id === artifactManifestId,
    ) || null);
  }

  async getSourceArtifactChunks(artifactManifestId) {
    return clone((this.state.sourceArtifactChunks || [])
      .filter((row) => row.artifact_manifest_id === artifactManifestId)
      .sort((left, right) => left.chunk_ordinal - right.chunk_ordinal));
  }

  _resolveAdmittedSourceReferences(state, references) {
    const sourcesById = new Map(state.sources.map((row) => [
      row.immutable_source_document_id,
      row,
    ]));
    const admissionsById = new Map(state.sourceAdmissions.map((row) => [
      row.source_admission_manifest_id,
      row,
    ]));
    const envelopesById = new Map((state.semanticExtractionInputEnvelopes || []).map((row) => [
      row.semantic_extraction_input_envelope_id,
      row,
    ]));
    const conversionsById = new Map((state.canonicalTextConversions || []).map((row) => [
      row.canonical_text_id,
      row,
    ]));
    return references.map((reference) => {
      const immutableSource = sourcesById.get(reference.immutable_source_document_id);
      const sourceAdmission = admissionsById.get(reference.source_admission_manifest_id);
      const semanticEnvelope = envelopesById.get(
        reference.semantic_extraction_input_envelope_id,
      );
      const conversion = conversionsById.get(reference.canonical_text_id);
      if (!immutableSource || !sourceAdmission || !semanticEnvelope || !conversion) return null;
      return {
        immutable_source_document: immutableSource,
        source_admission_manifest: sourceAdmission,
        semantic_extraction_input_envelope: semanticEnvelope,
        conversion,
      };
    });
  }

  async resolveAdmittedSourceReferences(references) {
    return clone(this._resolveAdmittedSourceReferences(this.state, references));
  }

  _resolvePersistedCanonicalObjectReferences(state, references) {
    return references.map((reference) => {
      const identityField = OBJECT_ID_FIELDS[reference.object_kind];
      const row = identityField
        ? (state[reference.object_kind] || []).find(
          (entry) => entry[identityField] === reference.object_id,
        )
        : null;
      if (!row || state.quarantines.some((entry) => entry.closure_id === row.closure_id)) {
        return null;
      }
      return {
        object_kind: reference.object_kind,
        object_id: reference.object_id,
        closure_id: row.closure_id,
        canonical_payload_digest: this.persistedCanonicalPayloadDigests.get(
          `${reference.object_kind}:${reference.object_id}`,
        ) || contentId('CANONICAL_OBJECT/V1', row),
        canonical_payload: row,
      };
    });
  }

  async resolvePersistedCanonicalObjectReferences(references) {
    return clone(this._resolvePersistedCanonicalObjectReferences(this.state, references));
  }

  _maybeFail(step) {
    if (!this._failure || this._failure.step !== step) return;
    this._failure.remaining -= 1;
    if (this._failure.remaining <= 0) {
      this._failure = null;
      throw new CanonicalWriterError('INJECTED_REPOSITORY_FAILURE', `Injected repository failure at ${step}.`, { step });
    }
  }

  async transaction(work) {
    this.transactionCount += 1;
    const staged = clone(this.state);
    const uniquePush = (collection, row, identityField) => {
      if (!Array.isArray(staged[collection])) staged[collection] = [];
      const existing = staged[collection].find((entry) => entry[identityField] === row[identityField]);
      if (!existing) staged[collection].push(clone(row));
      else if (contentId('CANONICAL_OBJECT/V1', existing) !== contentId('CANONICAL_OBJECT/V1', row)) {
        throw new CanonicalWriterError('CANONICAL_IDENTITY_CONFLICT', `${collection}.${row[identityField]} has different canonical content.`);
      }
    };
    const transaction = {
      getReceipt: async (operation, idempotencyKey) => clone(staged.receipts.find(
        (row) => row.operation === operation && row.idempotencyKey === idempotencyKey,
      ) || null),
      getIntakeCapture: async (intakeCaptureReceiptId) => clone(staged.intakeCaptures.find(
        (row) => row.intake_capture_receipt_id === intakeCaptureReceiptId,
      ) || null),
      getSourceArtifactManifest: async (artifactManifestId) => clone(
        (staged.sourceArtifactManifests || []).find(
          (row) => row.artifact_manifest_id === artifactManifestId,
        ) || null,
      ),
      getSourceArtifactChunks: async (artifactManifestId) => clone(
        (staged.sourceArtifactChunks || [])
          .filter((row) => row.artifact_manifest_id === artifactManifestId)
          .sort((left, right) => left.chunk_ordinal - right.chunk_ordinal),
      ),
      resolveAdmittedSourceReferences: async (references) => clone(
        this._resolveAdmittedSourceReferences(staged, references),
      ),
      resolvePersistedCanonicalObjectReferences: async (references) => clone(
        this._resolvePersistedCanonicalObjectReferences(staged, references),
      ),
      getQuarantineByClosure: async (closureId) => clone(staged.quarantines.find(
        (row) => row.closure_id === closureId,
      ) || null),
      writeIntakeCapture: async (row) => {
        this._maybeFail('intake_capture');
        uniquePush('intakeCaptures', row, 'intake_capture_receipt_id');
      },
      writeSourceArtifactManifest: async (row) => {
        this._maybeFail('source_artifact_manifest');
        uniquePush('sourceArtifactManifests', row, 'artifact_manifest_id');
      },
      writeSourceArtifactChunk: async (row) => {
        this._maybeFail('source_artifact_chunk');
        if (!Array.isArray(staged.sourceArtifactChunks)) staged.sourceArtifactChunks = [];
        const existingOrdinal = staged.sourceArtifactChunks.find((entry) => (
          entry.artifact_manifest_id === row.artifact_manifest_id
            && entry.chunk_ordinal === row.chunk_ordinal
        ));
        if (existingOrdinal && contentId('CANONICAL_OBJECT/V1', existingOrdinal)
          !== contentId('CANONICAL_OBJECT/V1', row)) {
          throw new CanonicalWriterError(
            'CANONICAL_IDENTITY_CONFLICT',
            `sourceArtifactChunks.${row.artifact_manifest_id}:${row.chunk_ordinal} has different canonical content.`,
          );
        }
        uniquePush('sourceArtifactChunks', row, 'chunk_id');
      },
      writeCanonicalTextConversion: async (row) => {
        this._maybeFail('canonical_text_conversion');
        uniquePush('canonicalTextConversions', row, 'canonical_text_id');
      },
      writeVerificationManifest: async (row) => {
        this._maybeFail('verification_manifest');
        uniquePush('verificationManifests', row, 'verification_manifest_id');
      },
      writeSource: async (row) => {
        this._maybeFail('source');
        uniquePush('sources', row, 'immutable_source_document_id');
      },
      writeSourceAdmission: async (row) => {
        this._maybeFail('source_admission');
        uniquePush('sourceAdmissions', row, 'source_admission_manifest_id');
      },
      writeSourceAdmissionPreparationReceipt: async (row) => {
        this._maybeFail('source_admission_preparation_receipt');
        uniquePush(
          'sourceAdmissionPreparationReceipts',
          row,
          'source_admission_preparation_receipt_id',
        );
      },
      writeSemanticExtractionInputEnvelope: async (row) => {
        this._maybeFail('semantic_extraction_input_envelope');
        uniquePush(
          'semanticExtractionInputEnvelopes',
          row,
          'semantic_extraction_input_envelope_id',
        );
      },
      writeDeal: async (row) => {
        this._maybeFail('deal');
        uniquePush('deals', row, 'deal_key');
      },
      writeDealAdmission: async (row) => {
        this._maybeFail('deal_admission');
        uniquePush('dealAdmissionRecords', row, 'deal_admission_id');
      },
      writeObject: async (kind, row) => {
        this._maybeFail(kind);
        const identity = OBJECT_ID_FIELDS[kind];
        if (!identity) throw new CanonicalWriterError('UNKNOWN_OBJECT_KIND', `Unknown canonical object kind ${kind}.`);
        uniquePush(kind, row, identity);
      },
      writeResidual: async (row) => {
        this._maybeFail('residuals');
        uniquePush('residuals', row, 'residual_id');
      },
      writeQuarantine: async (row) => {
        this._maybeFail('quarantines');
        const existingClosure = staged.quarantines.find((entry) => entry.closure_id === row.closure_id);
        if (existingClosure && existingClosure.quarantine_id !== row.quarantine_id) {
          throw new CanonicalWriterError(
            'CANONICAL_IDENTITY_CONFLICT',
            `quarantines.${row.closure_id} has different canonical content.`,
          );
        }
        uniquePush('quarantines', row, 'quarantine_id');
      },
      writeReceipt: async (row) => {
        this._maybeFail('receipt');
        const existing = staged.receipts.find((entry) => entry.operation === row.operation && entry.idempotencyKey === row.idempotencyKey);
        if (!existing) staged.receipts.push(clone(row));
        else if (existing.inputDigest !== row.inputDigest) {
          throw idempotencyConflict(row.operation, row.idempotencyKey, existing.inputDigest, row.inputDigest);
        }
      },
    };
    const result = await work(transaction);
    this.state = staged;
    return clone(result);
  }
}

module.exports = {
  ALLOWED_OPERATIONS,
  CanonicalValidationError,
  CanonicalWriterError,
  InMemoryCanonicalRepository,
  buildCanonicalWriteReceipt,
  createCanonicalWriter,
};
