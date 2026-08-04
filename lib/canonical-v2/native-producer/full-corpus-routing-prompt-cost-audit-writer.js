'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { resolveDurableArtifactRoot } = require('../durable-artifact-root');
const {
  AUDIT_STATUS,
  buildFullCorpusRoutingPromptCostAudit,
  validateFullCorpusRoutingPromptCostAudit,
} = require('./full-corpus-routing-prompt-cost-audit');

const AUDIT_OUTPUT_DIRECTORY = 'm3-corpus-routing-prompt-cost-audit';

class FullCorpusRoutingPromptCostAuditWriterError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'FullCorpusRoutingPromptCostAuditWriterError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new FullCorpusRoutingPromptCostAuditWriterError(code, message);
}

function isInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function readIfPresent(file) {
  try {
    return fs.readFileSync(file);
  } catch (error) {
    if (error && error.code === 'ENOENT') return null;
    fail('AUDIT_OUTPUT_READ_FAILED', `Could not read audit output: ${error.message}`);
  }
}

function writeContentAddressedAudit({ artifact_root: artifactRoot, audit } = {}) {
  const root = resolveDurableArtifactRoot({ root: artifactRoot, certificationMode: true, requireExisting: true });
  validateFullCorpusRoutingPromptCostAudit(audit);
  if (audit.status !== AUDIT_STATUS) fail('AUDIT_STATUS_INVALID', 'Only an audit-only artifact may be written.');

  const outputDirectory = path.join(root, AUDIT_OUTPUT_DIRECTORY);
  const outputPath = path.join(outputDirectory, `audit-${audit.audit_id}.json`);
  if (!isInside(root, outputDirectory) || !isInside(root, outputPath)) {
    fail('AUDIT_OUTPUT_PATH_INVALID', 'Audit output must stay beneath the explicit durable artifact root.');
  }
  const bytes = Buffer.from(`${JSON.stringify(audit, null, 2)}\n`, 'utf8');
  const existing = readIfPresent(outputPath);
  if (existing) {
    if (!existing.equals(bytes)) fail('CONTENT_ADDRESS_COLLISION', 'Refusing to overwrite different bytes at a content-addressed audit path.');
    return Object.freeze({ status: 'ALREADY_PRESENT', audit_id: audit.audit_id, output_path: outputPath });
  }

  fs.mkdirSync(outputDirectory, { recursive: true, mode: 0o700 });
  const temporaryPath = path.join(outputDirectory, `.${path.basename(outputPath)}.${process.pid}.${Date.now()}.tmp`);
  let temporaryCreated = false;
  try {
    const descriptor = fs.openSync(temporaryPath, 'wx', 0o600);
    temporaryCreated = true;
    try {
      fs.writeFileSync(descriptor, bytes);
      fs.fsyncSync(descriptor);
    } finally {
      fs.closeSync(descriptor);
    }
    try {
      // link(2) creates the final name atomically and fails if a concurrent
      // writer won the race. Unlike rename(2), it can never overwrite bytes.
      fs.linkSync(temporaryPath, outputPath);
    } catch (error) {
      if (!error || error.code !== 'EEXIST') throw error;
      const concurrent = readIfPresent(outputPath);
      if (!concurrent || !concurrent.equals(bytes)) {
        fail('CONTENT_ADDRESS_COLLISION', 'A concurrent writer created different bytes at the audit path.');
      }
      return Object.freeze({ status: 'ALREADY_PRESENT', audit_id: audit.audit_id, output_path: outputPath });
    }
    const directoryDescriptor = fs.openSync(outputDirectory, 'r');
    try {
      fs.fsyncSync(directoryDescriptor);
    } finally {
      fs.closeSync(directoryDescriptor);
    }
    return Object.freeze({ status: 'WRITTEN', audit_id: audit.audit_id, output_path: outputPath });
  } catch (error) {
    if (error instanceof FullCorpusRoutingPromptCostAuditWriterError) throw error;
    fail('AUDIT_OUTPUT_WRITE_FAILED', `Could not atomically write audit output: ${error.message}`);
  } finally {
    if (temporaryCreated) {
      try { fs.unlinkSync(temporaryPath); } catch (error) { if (!error || error.code !== 'ENOENT') throw error; }
    }
  }
}

function buildAndWriteContentAddressedAudit({ artifact_root: artifactRoot } = {}) {
  if (typeof artifactRoot !== 'string' || artifactRoot.length === 0) {
    fail('DURABLE_ARTIFACT_ROOT_REQUIRED', 'An explicit durable artifact root is required.');
  }
  const audit = buildFullCorpusRoutingPromptCostAudit({ artifact_root: artifactRoot });
  return writeContentAddressedAudit({ artifact_root: artifactRoot, audit });
}

module.exports = {
  AUDIT_OUTPUT_DIRECTORY,
  FullCorpusRoutingPromptCostAuditWriterError,
  writeContentAddressedAudit,
  buildAndWriteContentAddressedAudit,
};
