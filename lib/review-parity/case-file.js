'use strict';

/**
 * lib/review-parity/case-file.js
 *
 * A CASE FILE is one deal's worth of input for one family: the legacy cards
 * and the Canonical V2 side, as data.
 *
 * The format exists so that REACHING the corpus and PROVING parity over it
 * are separate jobs with separate authority. Whoever can read production
 * writes case files; the harness never touches a database, a credential or
 * a model. Point it at case files built from committed fixtures today and at
 * case files exported from production tomorrow -- the engine is unchanged.
 *
 * A case may declare a side `unavailable`. That deal is then UNCOMPARABLE:
 * it is reported by name, it counts against coverage, and it makes the run
 * exit non-zero. Silently passing over a deal whose data could not be
 * reached is the exact failure this harness is built to prevent, so there is
 * no way to express "skip this one" that does not show up in the report.
 */

const fs = require('node:fs');
const path = require('node:path');

const { compareCodeUnits, sortStrings } = require('./normalise');
const { REPO_ROOT, resolveRepoPath } = require('./views');

const CASE_SCHEMA = 'REVIEW_PARITY_CASE/V1';
const CASE_KEYS = new Set(['schema', 'family_id', 'deal_id', 'deal_label', 'notes', 'legacy', 'v2', 'review_deal_extra']);
const SIDE_KEYS = new Set(['cards', 'cards_file', 'cards_path', 'projection', 'projection_file', 'resolution', 'resolution_file', 'unavailable']);

class CaseFileError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'CaseFileError';
    this.code = code;
    this.details = details;
  }
}

function readJson(absolutePath) {
  let text;
  try {
    text = fs.readFileSync(absolutePath, 'utf8');
  } catch (error) {
    throw new CaseFileError('CASE_UNREADABLE', `cannot read ${absolutePath}: ${error && error.message}`);
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new CaseFileError('CASE_BAD_JSON', `invalid JSON in ${absolutePath}: ${error && error.message}`);
  }
}

function readAtPath(value, pointer) {
  if (!pointer) return value;
  let node = value;
  for (const segment of String(pointer).split('.')) {
    if (segment === '__proto__' || segment === 'constructor' || segment === 'prototype') return undefined;
    if (node === null || node === undefined || typeof node !== 'object') return undefined;
    node = Array.isArray(node) ? node[Number.parseInt(segment, 10)] : node[segment];
  }
  return node;
}

function rejectUnknownKeys(value, allowed, label) {
  const unknown = Object.keys(value).filter((key) => !allowed.has(key)).sort(compareCodeUnits);
  if (unknown.length) throw new CaseFileError('CASE_UNKNOWN_KEY', `${label} has unknown keys: ${unknown.join(', ')}`, { unknown });
}

function resolveSide(side, label) {
  if (side === undefined || side === null) {
    return { unavailable: `${label} side is absent from the case file` };
  }
  if (typeof side !== 'object' || Array.isArray(side)) {
    throw new CaseFileError('CASE_BAD_SIDE', `${label} must be an object`);
  }
  rejectUnknownKeys(side, SIDE_KEYS, label);

  if (typeof side.unavailable === 'string' && side.unavailable.trim() !== '') {
    return { unavailable: side.unavailable.trim() };
  }

  const out = {};
  if (Array.isArray(side.cards)) out.cards = side.cards;
  if (side.projection && typeof side.projection === 'object') out.projection = side.projection;
  if (side.resolution && typeof side.resolution === 'object') out.resolution = side.resolution;

  // File references are resolved relative to the repository root, never the
  // case file's own directory, so a case file cannot reach outside the repo
  // by nesting itself somewhere unexpected.
  if (typeof side.cards_file === 'string') {
    const loaded = readJson(resolveRepoPath(side.cards_file));
    const cards = readAtPath(loaded, side.cards_path);
    if (!Array.isArray(cards)) {
      throw new CaseFileError('CASE_CARDS_NOT_ARRAY', `${label}.cards_file "${side.cards_file}" (path "${side.cards_path || ''}") is not an array`);
    }
    out.cards = cards;
  }
  if (typeof side.projection_file === 'string') {
    out.projection = readJson(resolveRepoPath(side.projection_file));
  }
  if (typeof side.resolution_file === 'string') {
    out.resolution = readJson(resolveRepoPath(side.resolution_file));
  }

  if (!out.cards && !out.projection && !out.resolution) {
    return { unavailable: `${label} side declares no cards, projection or resolution` };
  }
  return out;
}

/** Load and validate one case file. */
function loadCaseFile(absolutePath) {
  const raw = readJson(absolutePath);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new CaseFileError('CASE_NOT_OBJECT', `${absolutePath} must contain an object`);
  }
  rejectUnknownKeys(raw, CASE_KEYS, path.basename(absolutePath));
  if (raw.schema !== CASE_SCHEMA) {
    throw new CaseFileError('CASE_BAD_SCHEMA', `${absolutePath}: schema must be ${CASE_SCHEMA}`, { found: raw.schema });
  }
  if (typeof raw.deal_id !== 'string' || raw.deal_id.trim() === '') {
    throw new CaseFileError('CASE_BAD_DEAL_ID', `${absolutePath}: deal_id must be a non-empty string`);
  }
  if (typeof raw.family_id !== 'string' || raw.family_id.trim() === '') {
    throw new CaseFileError('CASE_BAD_FAMILY', `${absolutePath}: family_id must be a non-empty string`);
  }
  return {
    file: path.relative(REPO_ROOT, absolutePath),
    schema: raw.schema,
    family_id: raw.family_id,
    deal_id: raw.deal_id,
    deal_label: typeof raw.deal_label === 'string' ? raw.deal_label : null,
    review_deal_extra: (raw.review_deal_extra && typeof raw.review_deal_extra === 'object' && !Array.isArray(raw.review_deal_extra))
      ? raw.review_deal_extra
      : {},
    legacy: resolveSide(raw.legacy, 'legacy'),
    v2: resolveSide(raw.v2, 'v2'),
  };
}

const CASE_FILE_SUFFIX = '.case.json';

/**
 * Load every case file under a directory (or a single file), sorted by
 * deal_id so a run's order never depends on the filesystem.
 *
 * In a directory, only files ending `.case.json` are loaded. The suffix is
 * required rather than inferred so that a case set can sit alongside the
 * payloads it references (projections, card exports) without those payloads
 * being mistaken for cases. A single file is loaded whatever it is called.
 */
function loadCaseSet(target) {
  const absolute = path.isAbsolute(target) ? target : path.resolve(REPO_ROOT, target);
  const stat = fs.statSync(absolute);
  const files = [];
  if (stat.isDirectory()) {
    // readdirSync order is not guaranteed across platforms; sort explicitly.
    for (const entry of sortStrings(fs.readdirSync(absolute))) {
      if (!entry.endsWith(CASE_FILE_SUFFIX)) continue;
      files.push(path.join(absolute, entry));
    }
  } else {
    files.push(absolute);
  }
  const cases = files.map(loadCaseFile);
  const seen = new Set();
  for (const item of cases) {
    if (seen.has(item.deal_id)) {
      throw new CaseFileError('CASE_DUPLICATE_DEAL', `two case files declare deal_id "${item.deal_id}"`, { deal_id: item.deal_id });
    }
    seen.add(item.deal_id);
  }
  return cases.sort((left, right) => compareCodeUnits(left.deal_id, right.deal_id));
}

module.exports = {
  CASE_FILE_SUFFIX,
  CASE_SCHEMA,
  CaseFileError,
  loadCaseFile,
  loadCaseSet,
  resolveSide,
};
