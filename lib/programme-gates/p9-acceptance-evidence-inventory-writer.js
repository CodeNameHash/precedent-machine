'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { canonicalJson } = require('../canonical-v2/canonical-bytes');
const { resolveDurableArtifactRoot } = require('../canonical-v2/durable-artifact-root');
const {
  compileP9AcceptanceEvidenceInventory,
  loadLiveP9GateIds,
  validateP9AcceptanceEvidenceInventory,
} = require('./p9-acceptance-evidence-inventory');
const {
  buildP9AcceptanceEvidenceEngineeringQueue,
  validateP9AcceptanceEvidenceEngineeringQueue,
} = require('./p9-acceptance-evidence-engineering-queue');

const OUTPUT_DIRECTORY = 'programme-gates/p9-proposal-only-acceptance-evidence';

class P9AcceptanceEvidenceInventoryWriterError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'P9AcceptanceEvidenceInventoryWriterError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new P9AcceptanceEvidenceInventoryWriterError(code, message);
}

function isInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function readIfPresent(file) {
  try {
    return fs.readFileSync(file);
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    fail('P9_EVIDENCE_OUTPUT_READ_FAILED', `Could not read P9 proposal output: ${error.message}`);
  }
}

function writeOneContentAddressedFile({ outputDirectory, outputPath, bytes, id, artifactType }) {
  const existing = readIfPresent(outputPath);
  if (existing) {
    if (!existing.equals(bytes)) {
      fail('CONTENT_ADDRESS_COLLISION', `Refusing to overwrite different bytes at the ${artifactType} content-addressed path.`);
    }
    return Object.freeze({ status: 'ALREADY_PRESENT', id, output_path: outputPath });
  }

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
      // link(2) installs the final name atomically and never replaces existing bytes.
      fs.linkSync(temporaryPath, outputPath);
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;
      const concurrent = readIfPresent(outputPath);
      if (!concurrent || !concurrent.equals(bytes)) {
        fail('CONTENT_ADDRESS_COLLISION', `A concurrent writer created different ${artifactType} bytes.`);
      }
      return Object.freeze({ status: 'ALREADY_PRESENT', id, output_path: outputPath });
    }
    const directoryDescriptor = fs.openSync(outputDirectory, 'r');
    try {
      fs.fsyncSync(directoryDescriptor);
    } finally {
      fs.closeSync(directoryDescriptor);
    }
    return Object.freeze({ status: 'WRITTEN', id, output_path: outputPath });
  } catch (error) {
    if (error instanceof P9AcceptanceEvidenceInventoryWriterError) throw error;
    fail('P9_EVIDENCE_OUTPUT_WRITE_FAILED', `Could not atomically write ${artifactType}: ${error.message}`);
  } finally {
    if (temporaryCreated) {
      try {
        fs.unlinkSync(temporaryPath);
      } catch (error) {
        if (error?.code !== 'ENOENT') throw error;
      }
    }
  }
}

function writeContentAddressedP9AcceptanceEvidence({
  artifact_root: artifactRoot,
  repository_root: repositoryRoot,
  p9_gate_ids: p9GateIds,
  inventory,
  engineering_queue: engineeringQueue,
} = {}) {
  const root = resolveDurableArtifactRoot({ root: artifactRoot, certificationMode: true, requireExisting: true });
  const currentP9GateIds = p9GateIds || loadLiveP9GateIds({ repositoryRoot });
  validateP9AcceptanceEvidenceInventory(inventory, {
    p9GateIds: currentP9GateIds,
    repositoryRoot,
  });
  validateP9AcceptanceEvidenceEngineeringQueue(engineeringQueue, {
    p9GateIds: currentP9GateIds,
    repositoryRoot,
  });
  if (engineeringQueue.source_inventory_id !== inventory.inventory_id
    || engineeringQueue.source_inventory_digest !== inventory.inventory_digest) {
    fail('P9_EVIDENCE_QUEUE_BINDING_INVALID', 'Engineering queue must bind the exact proposal-only inventory.');
  }
  const outputDirectory = path.join(root, OUTPUT_DIRECTORY);
  const inventoryPath = path.join(outputDirectory, `inventory-${inventory.inventory_id}.json`);
  const queuePath = path.join(outputDirectory, `engineering-queue-${engineeringQueue.queue_id}.json`);
  if (!isInside(root, outputDirectory) || !isInside(root, inventoryPath) || !isInside(root, queuePath)) {
    fail('P9_EVIDENCE_OUTPUT_PATH_INVALID', 'P9 proposal output must stay beneath the explicit durable artifact root.');
  }
  fs.mkdirSync(outputDirectory, { recursive: true, mode: 0o700 });
  const inventoryReceipt = writeOneContentAddressedFile({
    outputDirectory,
    outputPath: inventoryPath,
    bytes: Buffer.from(`${canonicalJson(inventory)}\n`, 'utf8'),
    id: inventory.inventory_id,
    artifactType: 'P9 proposal-only inventory',
  });
  const queueReceipt = writeOneContentAddressedFile({
    outputDirectory,
    outputPath: queuePath,
    bytes: Buffer.from(`${canonicalJson(engineeringQueue)}\n`, 'utf8'),
    id: engineeringQueue.queue_id,
    artifactType: 'P9 proposal-only engineering queue',
  });
  return Object.freeze({
    status: inventoryReceipt.status === 'WRITTEN' || queueReceipt.status === 'WRITTEN' ? 'WRITTEN' : 'ALREADY_PRESENT',
    inventory: inventoryReceipt,
    engineering_queue: queueReceipt,
    output_directory: outputDirectory,
  });
}

function buildAndWriteP9AcceptanceEvidence({ artifact_root: artifactRoot, repository_root: repositoryRoot } = {}) {
  if (typeof artifactRoot !== 'string' || artifactRoot.length === 0) {
    fail('DURABLE_ARTIFACT_ROOT_REQUIRED', 'An explicit durable artifact root is required.');
  }
  const p9GateIds = loadLiveP9GateIds({ repositoryRoot });
  const inventory = compileP9AcceptanceEvidenceInventory({ p9GateIds, repositoryRoot });
  const engineeringQueue = buildP9AcceptanceEvidenceEngineeringQueue({ p9GateIds, repositoryRoot });
  return writeContentAddressedP9AcceptanceEvidence({
    artifact_root: artifactRoot,
    repository_root: repositoryRoot,
    p9_gate_ids: p9GateIds,
    inventory,
    engineering_queue: engineeringQueue,
  });
}

module.exports = {
  OUTPUT_DIRECTORY,
  P9AcceptanceEvidenceInventoryWriterError,
  buildAndWriteP9AcceptanceEvidence,
  writeContentAddressedP9AcceptanceEvidence,
};
