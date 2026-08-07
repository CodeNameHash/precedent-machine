// Carries an extraction run's output into the canonical writer.
//
// PLAN.md Step 2B, the write half. Until this existed, a run wrote JSON into
// `evidence/canonical-v2/<deal>-<family>-<date>/` and stopped: grep every
// output filename and the only non-comment consumer was
// `scripts/nets-eligibility-report.mjs`, broken since `0d17ad00`. So a
// successful campaign of 25 families across 15 documents changed nothing any
// user could see. That is a missing stage, not a bug in the runner, and this
// module is it.
//
// WHAT IT DOES NOT DO. It does not decide whether the extraction is good, and
// it does not serve anything. It takes a run directory, re-derives the
// publishable write-set from it, and hands that to the writer. The read half
// -- database back out to a product surface -- is the other half of Step 2B.
//
// WHY IT RE-VALIDATES RATHER THAN TRUSTING validation.json. The run already
// wrote a `publishableWriteSet` into that file, and it would be shorter to
// import it directly. That would mean trusting a file's own claim to have
// been validated, by a validator version that may no longer be the current
// one. PLAN.md Step 4B states the same rule for the import driver: call the
// validators on whatever file you are given, never trust the file's claim.
// A write-set that fails re-validation here is a finding -- either the run
// predates a validator change or the file was edited -- and it must surface
// rather than be written.
//
// WHICH VALIDATOR. There are two, for two write-set shapes, and choosing
// wrong produces a confident false conclusion: an earlier version of this
// file called `validateCanonicalWriteSet` (generic, `WRITE_SET_KEYS`) on a
// deal-scope run and concluded all 24 committed runs were unimportable. They
// are not. An extraction run is a `DEAL_SCOPE_RUN` and is checked by
// `validateResolvedCanonicalWriteSet` against `DEAL_SCOPE_WRITE_SET_KEYS`,
// which 23 of 24 pass.

const fs = require('node:fs');
const path = require('node:path');

const { validateResolvedCanonicalWriteSet } = require('./validate-write-set');
const { createCanonicalWriter } = require('./canonical-writer');
const {
  createRebuildingSourceReferenceResolver,
} = require('./admitted-source-chain-rebuild');

class EvidenceBridgeError extends Error {
  constructor(code, message) {
    super(`${code}: ${message}`);
    this.code = code;
    this.name = 'EvidenceBridgeError';
  }
}

function readJson(absolutePath) {
  if (!fs.existsSync(absolutePath)) {
    throw new EvidenceBridgeError('MISSING_FILE', `expected ${absolutePath}`);
  }
  try {
    return JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
  } catch (err) {
    throw new EvidenceBridgeError('UNREADABLE_JSON', `${absolutePath}: ${err.message}`);
  }
}

// Reads a run directory into the pieces the writer needs. Kept separate from
// the write so a caller can inspect what would be written without a
// repository, and so the run's own identifiers travel with it -- an import
// that cannot say which run produced it is not traceable, which PLAN.md
// Step 4E requires.
function readRunEvidence(runDirectory) {
  const dir = path.resolve(runDirectory);
  if (!fs.existsSync(dir)) {
    throw new EvidenceBridgeError('MISSING_RUN_DIRECTORY', dir);
  }
  // adapter-result.json, NOT validation.json. Both carry a write-set and it
  // is easy to reach for the wrong one: validation.json's
  // `publishableWriteSet` is the post-split publishable subset, and it is
  // missing the five source-admission keys the validator requires
  // (`source`, `source_admission`, `sources`, `source_admissions`,
  // `write_set_origin`) while carrying two it rejects. adapter-result.json
  // carries the complete `write_set` plus `admitted_source_contexts`, which
  // is what the writer actually needs. Verified against
  // modiv-antitrust-20260806 before this was written.
  const adapter = readJson(path.join(dir, 'adapter-result.json'));
  if (!adapter || typeof adapter !== 'object' || !adapter.write_set) {
    throw new EvidenceBridgeError(
      'NO_WRITE_SET',
      `${dir}/adapter-result.json has no write_set. A run that produced none has nothing to import, `
      + 'which is a finding about the run rather than an error here.',
    );
  }
  const validationPath = path.join(dir, 'validation.json');
  const validation = fs.existsSync(validationPath) ? readJson(validationPath) : null;
  // The manifest is optional on purpose: four committed Modiv run directories
  // have none (see CODEBASE-GUIDE section 12.5). Import must not be blocked by
  // an artefact that a legitimate historical run never wrote.
  const manifestPath = path.join(dir, 'run-manifest.json');
  const manifest = fs.existsSync(manifestPath) ? readJson(manifestPath) : null;
  const receiptPath = path.join(dir, 'run-receipt.json');
  const receipt = fs.existsSync(receiptPath) ? readJson(receiptPath) : null;

  // adapter-result.json's write_set is NOT the write-set the run validated,
  // and importing it directly loses most of the run.
  //
  // The runner composes the validated write-set at
  // canonical-v2-live-extraction-run.mjs:1114 as `{...adapterResult.write_set,
  // provisions: [...provisionsById.values()]}` -- the adapter's write-set plus
  // the provision instances from `resolution.resolved[].provision_instance`.
  // The adapter's own write-set carries no provisions at all, and a claim
  // whose governing provision is absent is dropped as non-publishable rather
  // than rejected. So importing adapter-result.json alone SUCCEEDS, publishes
  // the excerpts, and silently discards every claim: on the antitrust run,
  // 10 excerpts written and 13 of 13 claims lost, with `accepted: true`.
  //
  // Caught by a test asserting the import publishes something, not by the
  // import failing. That is the shape of the failure to expect here.
  const resolutionPath = path.join(dir, 'resolution.json');
  const resolution = fs.existsSync(resolutionPath) ? readJson(resolutionPath) : null;
  const provisions = resolution && Array.isArray(resolution.resolved)
    ? [...new Map(resolution.resolved
      .map((entry) => entry.provision_instance)
      .filter(Boolean)
      .map((provision) => [provision.provision_instance_id, provision])).values()]
    : [];
  const writeSet = {
    ...adapter.write_set,
    provisions,
    components: adapter.write_set.components || [],
  };

  return {
    run_directory: dir,
    write_set: writeSet,
    provision_count: provisions.length,
    provisions_recovered_from_resolution: provisions.length > 0,
    admitted_source_contexts: adapter.admitted_source_contexts || null,
    counts: (validation && validation.counts) || adapter.counts || null,
    // What the run itself published, per collection. The yardstick for the
    // shortfall check in importRunEvidence.
    published_counts: validation && validation.publishableWriteSet
      ? Object.fromEntries(Object.entries(validation.publishableWriteSet)
        .filter(([, value]) => Array.isArray(value) && value.length > 0)
        .map(([key, value]) => [key, value.length]))
      : null,
    residual_count: validation && Array.isArray(validation.residuals) ? validation.residuals.length : null,
    quarantine_count: validation && Array.isArray(validation.quarantines) ? validation.quarantines.length : null,
    provenance: {
      deal: manifest ? manifest.deal || null : null,
      section_family: manifest ? manifest.section_family || null : null,
      document_hash: manifest ? manifest.document_hash || null : null,
      prompt_version: manifest ? manifest.prompt_version || null : null,
      contract_bundle_version: manifest ? manifest.contract_bundle_version || null : null,
      code_provenance: manifest ? manifest.code_provenance || null : null,
      resolved_models: manifest ? manifest.resolved_models || null : null,
      run_receipt_id: receipt ? receipt.run_receipt_id || null : null,
      has_manifest: Boolean(manifest),
    },
  };
}

// Deterministic from the run's own identity, so importing the same run twice
// is a no-op rather than a duplicate. Falls back to the directory name when a
// manifest is absent -- weaker, but stable, and better than a random key that
// would make every re-import look new.
function idempotencyKeyFor(evidence) {
  const { provenance, run_directory: runDirectory } = evidence;
  if (provenance.document_hash && provenance.section_family) {
    return `evidence-bridge:${provenance.section_family}:${provenance.document_hash}`;
  }
  return `evidence-bridge:dir:${path.basename(runDirectory)}`;
}

// Writes one run's output. `dryRun` is passed through to the writer, which
// already supports it; the default is true so that calling this without
// thinking about it does not write.
async function importRunEvidence({
  runDirectory,
  repository,
  contractBundle,
  dryRun = true,
  operation = 'DEAL_SCOPE_RUN',
}) {
  if (!repository) throw new EvidenceBridgeError('REPOSITORY_REQUIRED', 'pass a repository');
  if (!contractBundle) throw new EvidenceBridgeError('CONTRACT_BUNDLE_REQUIRED', 'pass a contractBundle');

  const evidence = readRunEvidence(runDirectory);

  // Re-validate rather than trusting the file. See the header.
  //
  // validateResolvedCanonicalWriteSet, NOT validateCanonicalWriteSet. The two
  // enforce DIFFERENT allow-lists for different write-set shapes:
  // `WRITE_SET_KEYS` for the generic form, `DEAL_SCOPE_WRITE_SET_KEYS` for a
  // DEAL_SCOPE_RUN. An extraction run is the latter, and the generic
  // validator rejects it on `definition_occurrences` and `source_references`
  // -- keys the writer's own WRITE_ORDER and OBJECT_ID_FIELDS handle, and
  // which the deal-scope list includes. An earlier version of this file
  // called the generic one and concluded all 24 committed runs were
  // unimportable. They are not: 23 of 24 pass here.
  if (!evidence.admitted_source_contexts) {
    throw new EvidenceBridgeError(
      'NO_ADMITTED_SOURCE_CONTEXTS',
      `${evidence.run_directory}/adapter-result.json has no admitted_source_contexts. The resolved `
      + 'validator needs one per source reference; without them this run cannot be checked, and an '
      + 'unchecked import is exactly what this bridge exists to prevent.',
    );
  }
  let revalidation;
  try {
    revalidation = validateResolvedCanonicalWriteSet({
      writeSet: evidence.write_set,
      contractBundle,
      admittedSourceContexts: evidence.admitted_source_contexts,
    });
  } catch (err) {
    throw new EvidenceBridgeError(
      'REVALIDATION_FAILED',
      `${evidence.run_directory} no longer passes the current validators (${err.message}). `
      + 'Either the run predates a validator change or the file was edited. Do not import it until '
      + 'that is explained.',
    );
  }

  // Publishing fewer rows than the run did is not an error the validators can
  // raise -- a claim with no governing provision is DROPPED, not rejected, and
  // the result is still `accepted: true`. So compare against what the run
  // itself published and refuse a shortfall.
  //
  // Both guards depend on files a run directory MIGHT not have, and a missing
  // file must not read as a clean import: without resolution.json the
  // composition yields `provisions: []`, without validation.json there is no
  // yardstick, and a directory missing both reproduces the original defect
  // exactly -- every claim dropped, `accepted: true`, nothing to see. So each
  // absence is refused rather than skipped.
  if ((evidence.write_set.claims || []).length > 0 && !evidence.provisions_recovered_from_resolution) {
    throw new EvidenceBridgeError(
      'NO_PROVISIONS_TO_GOVERN_CLAIMS',
      `${evidence.run_directory} has ${evidence.write_set.claims.length} claim(s) and no provisions, `
      + 'because resolution.json is missing or carries no resolved entries. A claim with no governing '
      + 'provision is dropped rather than rejected, so importing this would publish the excerpts, lose '
      + 'every claim, and report success.',
    );
  }
  const claimedCounts = evidence.published_counts;
  if (!claimedCounts) {
    throw new EvidenceBridgeError(
      'NO_PUBLISHED_COUNTS_TO_CHECK_AGAINST',
      `${evidence.run_directory} has no validation.json, so there is nothing to measure this import `
      + 'against. Silently skipping the shortfall check is how an import that drops rows passes for one '
      + 'that worked.',
    );
  }
  {
    const shortfalls = Object.entries(claimedCounts)
      .filter(([key, expected]) => (revalidation.publishableWriteSet[key] || []).length < expected)
      .map(([key, expected]) => (
        `${key}: run published ${expected}, this import would publish `
        + `${(revalidation.publishableWriteSet[key] || []).length}`
      ));
    if (shortfalls.length > 0) {
      throw new EvidenceBridgeError(
        'PUBLISHABLE_SHORTFALL',
        `${evidence.run_directory} would import less than the run itself published (${shortfalls.join('; ')}). `
        + 'An import that silently drops rows looks identical to one that worked; do not proceed until '
        + 'the difference is explained.',
      );
    }
  }

  // The writer asks the REPOSITORY to resolve source references as one
  // bounded read (`repository.resolveAdmittedSourceReferences`). That is
  // right for a database-backed repository, which already holds the admitted
  // sources. A run directory is not a database, and the repository has not
  // seen this run yet -- that is what importing means -- so its own resolver
  // cannot know these sources. The bridge decorates it, always, rather than
  // deferring: an earlier version deferred when the repository already had a
  // resolver, which silently picked InMemoryCanonicalRepository's empty
  // implementation and failed with "every source reference must resolve
  // exactly once".
  //
  // WHAT THE RESOLVER RETURNS, AND WHAT IT MUST NOT. The run carries finished
  // `admitted_source_contexts`, and returning those satisfies the resolver's
  // shape. It is wrong. `resolveAdmittedSemanticContexts` does not accept a
  // context: it takes four PRIMITIVES, rebuilds the context from them, and
  // refuses unless the rebuilt reference is byte-identical to the write-set's
  // own `source_references[i]`. Handing back the run's own contexts would be
  // asserting the lineage the writer exists to verify. So the resolver
  // rebuilds the chain from the committed raw HTML instead -- see
  // admitted-source-chain-rebuild.js, including why runs made before
  // 2026-08-07 provably cannot rebuild and what to do about them.
  //
  // DECORATE THE TRANSACTION TOO. The writer resolves twice: once against the
  // repository to compute the input digest, and again against the TRANSACTION
  // HANDLE inside `repository.transaction()` (canonical-writer.js:486). The
  // handle is built by the repository and does not inherit this decoration,
  // so decorating only the repository makes every dry run pass and every real
  // write fail with "every source reference must resolve exactly once" -- the
  // dry-run path never opens a transaction. Caught by a non-dry-run test,
  // which is why there is one.
  const resolver = createRebuildingSourceReferenceResolver({ runDirectory: evidence.run_directory });
  const resolvingRepository = Object.create(repository, {
    resolveAdmittedSourceReferences: { value: resolver },
    transaction: {
      value: (work, ...rest) => repository.transaction(
        (handle) => work(Object.create(handle, {
          resolveAdmittedSourceReferences: { value: resolver },
        })),
        ...rest,
      ),
    },
  });

  const writer = createCanonicalWriter({ repository: resolvingRepository, contractBundle });
  const receipt = await writer.write({
    operation,
    idempotencyKey: idempotencyKeyFor(evidence),
    dryRun,
    writeSet: evidence.write_set,
  });

  return {
    run_directory: evidence.run_directory,
    idempotency_key: idempotencyKeyFor(evidence),
    dry_run: dryRun,
    provenance: evidence.provenance,
    receipt,
  };
}

module.exports = {
  EvidenceBridgeError,
  readRunEvidence,
  idempotencyKeyFor,
  importRunEvidence,
};
