const {
  CanonicalValidationError,
  canonicalise,
  validateCanonicalWriteSet,
} = require('./validate-write-set');
const { contentId } = require('./canonical-bytes');
const { validateContractBundle } = require('./contract-bundle');

const ALLOWED_OPERATIONS = new Set(['FIXTURE_DEAL_EXTRACTION_RUN']);
const WRITE_ORDER = [
  'excerpts',
  'provisions',
  'components',
  'claims',
  'relationships',
  'open_world_candidates',
  'open_world_candidate_occurrences',
  'open_world_evidence_references',
  'open_world_candidate_dispositions',
  'open_world_primitives',
  'semantic_impact_closures',
  'reviewed_source_specific_rows',
];

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

function buildReceipt({ operation, idempotencyKey, inputDigest, validation }) {
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

function createCanonicalWriter({ repository, contractBundle }) {
  if (!repository || typeof repository.transaction !== 'function' || typeof repository.getReceipt !== 'function') {
    throw new CanonicalWriterError('INVALID_REPOSITORY', 'repository must implement getReceipt and transaction.');
  }
  validateContractBundle(contractBundle);

  return {
    async write({ operation, idempotencyKey, dryRun = false, writeSet } = {}) {
      assertOperation(operation);
      const key = assertIdempotencyKey(idempotencyKey);
      const validation = validateCanonicalWriteSet(writeSet, contractBundle);
      const inputDigest = contentId('CANONICAL_WRITE_INPUT/V1', {
        operation,
        idempotencyKey: key,
        writeSet: canonicalise(writeSet),
      });

      const existing = await repository.getReceipt(operation, key);
      if (existing) {
        if (existing.inputDigest !== inputDigest) {
          throw idempotencyConflict(operation, key, existing.inputDigest, inputDigest);
        }
        return { dryRun: false, replayed: true, receipt: clone(existing), validation };
      }

      if (dryRun === true) {
        return { dryRun: true, replayed: false, inputDigest, receipt: null, validation };
      }

      const receipt = buildReceipt({ operation, idempotencyKey: key, inputDigest, validation });
      const publishableClosureIds = new Set(WRITE_ORDER.flatMap(
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

        const admitted = admittedRows(validation.publishableWriteSet);
        for (const source of admitted.sources) await transaction.writeSource(source);
        for (const admission of admitted.admissions) await transaction.writeSourceAdmission(admission);
        await transaction.writeDeal(validation.publishableWriteSet.deal);
        for (const kind of WRITE_ORDER) {
          for (const row of validation.publishableWriteSet[kind]) await transaction.writeObject(kind, row);
        }
        for (const residual of validation.residuals) await transaction.writeResidual(residual);
        for (const quarantine of validation.quarantines) await transaction.writeQuarantine(quarantine);
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
  constructor() {
    this.state = {
      sources: [],
      sourceAdmissions: [],
      deals: [],
      excerpts: [],
      provisions: [],
      components: [],
      claims: [],
      relationships: [],
      open_world_candidates: [],
      open_world_candidate_occurrences: [],
      open_world_evidence_references: [],
      open_world_candidate_dispositions: [],
      open_world_primitives: [],
      semantic_impact_closures: [],
      reviewed_source_specific_rows: [],
      residuals: [],
      quarantines: [],
      receipts: [],
    };
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
      getQuarantineByClosure: async (closureId) => clone(staged.quarantines.find(
        (row) => row.closure_id === closureId,
      ) || null),
      writeSource: async (row) => {
        this._maybeFail('source');
        uniquePush('sources', row, 'immutable_source_document_id');
      },
      writeSourceAdmission: async (row) => {
        this._maybeFail('source_admission');
        uniquePush('sourceAdmissions', row, 'source_admission_manifest_id');
      },
      writeDeal: async (row) => {
        this._maybeFail('deal');
        uniquePush('deals', row, 'deal_key');
      },
      writeObject: async (kind, row) => {
        this._maybeFail(kind);
        const identity = {
          excerpts: 'excerpt_id',
          provisions: 'provision_instance_id',
          components: 'provision_component_id',
          claims: 'claim_revision_id',
          relationships: 'relationship_revision_id',
          open_world_candidates: 'candidate_id',
          open_world_candidate_occurrences: 'open_world_candidate_occurrence_id',
          open_world_evidence_references: 'evidence_reference_id',
          open_world_candidate_dispositions: 'final_disposition_id',
          open_world_primitives: 'primitive_id',
          semantic_impact_closures: 'semantic_impact_closure_id',
          reviewed_source_specific_rows: 'reviewed_source_specific_row_serving_key',
        }[kind];
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
  createCanonicalWriter,
};
