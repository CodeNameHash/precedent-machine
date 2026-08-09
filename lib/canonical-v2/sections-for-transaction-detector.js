'use strict';

/**
 * lib/canonical-v2/sections-for-transaction-detector.js
 *
 * Thin adapter: rebuild hash-verified canonical text from a committed
 * evidence run, sectionize via parseStructure, and feed
 * extractTransactionSteps. Step 2X-F detector-half harness — zero model
 * calls. Passes fullCleanedText so quoted defined-term merger names survive
 * sectionization.
 */

const path = require('path');
const {
  rebuildAdmittedSourcePrimitives,
} = require('./admitted-source-chain-rebuild');
const { parseStructure } = require('../parser-v2/structural');
const {
  extractTransactionSteps,
} = require('../parser-v2/detectors/transaction-steps');

function sectionsFromAdmittedRun(runDirectory) {
  const absolute = path.resolve(runDirectory);
  const { conversion, sourceReference } = rebuildAdmittedSourcePrimitives({
    runDirectory: absolute,
  });
  const structured = parseStructure(conversion.canonical_text);
  return Object.freeze({
    runDirectory: absolute,
    canonical_text: conversion.canonical_text,
    document_hash: conversion.document_hash || null,
    source_reference: sourceReference || null,
    sections: structured.sections,
  });
}

function detectTopologyFromAdmittedRun(runDirectory) {
  const rebuilt = sectionsFromAdmittedRun(runDirectory);
  const model = extractTransactionSteps(rebuilt.sections, {
    fullCleanedText: rebuilt.canonical_text,
  });
  return Object.freeze({
    ...model,
    runDirectory: rebuilt.runDirectory,
    document_hash: rebuilt.document_hash,
  });
}

module.exports = Object.freeze({
  sectionsFromAdmittedRun,
  detectTopologyFromAdmittedRun,
});
