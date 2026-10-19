'use strict';

// The pre-intake structure check (work package B5, plan finding (108)): the
// intake route's own path on one SEC exhibit, run locally with no database
// and no model call, so an exhibit is checked before any run is paid for.
// Exactly the intake's steps: the SEC adapter's fetch (its User-Agent,
// timeout and byte limit), the canonical text, the document identity
// (lib/product/sec-intake.js extractDocumentIdentity, inside the adapter)
// and buildAgreementStructure. The report carries the node count, the
// article and annex boundaries, the identity status with its reasons, and
// the submission fingerprint the intake would compute for this source
// under the active schema, prompt bundle and model config.
//
// The fingerprint reproduces product_phase1_create_run
// (supabase/migrations/20260905020346_product_phase_1_foundation.sql):
//   sha256(source_document_id || chr(31) || schema_version || chr(31)
//     || prompt_bundle_version || chr(31) || model_config::text || chr(31)
//     || explicit_generation || chr(31) || max_attempts)
// where model_config::text is Postgres's jsonb rendering (keys ordered by
// length then bytes, ", " and ": " separators). Two fingerprints the
// preview branch stores are pinned in tests/product-structure-check.test.js.
//
// Ben's rule (plan finding (166) context, verbatim: "everything to be
// driven by coding and not just a layer on top so all edits need to be
// repeatable across corpus"): this is the one path, reusable on any URL.

const crypto = require('node:crypto');
const { createSecIntakeAdapter } = require('./sec-intake');
const { buildAgreementStructure } = require('./agreement-structure');
const { activeSubmissionVersion } = require('./legal-schema-selection');
const { configuredProductModelConfig, hostedModelConfigFor, isHostedProvider } = require('./product-model-config');

const UNIT_SEPARATOR = String.fromCharCode(31);

function compareJsonbKeys(left, right) {
  const leftBytes = Buffer.from(left, 'utf8');
  const rightBytes = Buffer.from(right, 'utf8');
  return leftBytes.length - rightBytes.length || Buffer.compare(leftBytes, rightBytes);
}

function jsonbString(value) {
  // Postgres escapes the quote, the backslash and the control characters;
  // every other character, non-ASCII included, is written as itself.
  let out = '"';
  for (const char of String(value)) {
    const code = char.codePointAt(0);
    if (char === '"') out += '\\"';
    else if (char === '\\') out += '\\\\';
    else if (char === '\n') out += '\\n';
    else if (char === '\r') out += '\\r';
    else if (char === '\t') out += '\\t';
    else if (char === '\b') out += '\\b';
    else if (char === '\f') out += '\\f';
    else if (code < 0x20) out += `\\u${code.toString(16).padStart(4, '0')}`;
    else out += char;
  }
  return `${out}"`;
}

function jsonbNumber(value) {
  if (!Number.isFinite(value)) throw new TypeError('jsonb numbers must be finite');
  // numeric renders integers without an exponent and decimals as written.
  if (Number.isInteger(value)) return BigInt(value).toString();
  return String(value);
}

// Postgres jsonb::text for a JSON value.
function jsonbText(value) {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return jsonbNumber(value);
  if (typeof value === 'string') return jsonbString(value);
  if (Array.isArray(value)) return `[${value.map(jsonbText).join(', ')}]`;
  if (typeof value === 'object') {
    const keys = Object.keys(value).filter((key) => value[key] !== undefined).sort(compareJsonbKeys);
    return `{${keys.map((key) => `${jsonbString(key)}: ${jsonbText(value[key])}`).join(', ')}}`;
  }
  throw new TypeError(`jsonb cannot render ${typeof value}`);
}

function submissionFingerprint({ sourceDocumentId, schemaVersion, promptBundleVersion, modelConfig, explicitGeneration = 0, maxAttempts = 3 }) {
  for (const [name, value] of Object.entries({ sourceDocumentId, schemaVersion, promptBundleVersion })) {
    if (typeof value !== 'string' || value.length === 0) throw new TypeError(`${name} is required`);
  }
  if (!modelConfig || typeof modelConfig !== 'object') throw new TypeError('modelConfig is required');
  if (!Number.isInteger(explicitGeneration) || explicitGeneration < 0) throw new TypeError('explicitGeneration must be a non-negative integer');
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) throw new TypeError('maxAttempts must be positive');
  const material = [sourceDocumentId, schemaVersion, promptBundleVersion, jsonbText(modelConfig), String(explicitGeneration), String(maxAttempts)].join(UNIT_SEPARATOR);
  return crypto.createHash('sha256').update(Buffer.from(material, 'utf8')).digest('hex');
}

function nodeRow(node, byId) {
  return {
    reference: node.reference,
    kind: node.kind,
    parent: byId.get(node.parent_id)?.reference ?? (node.parent_id ? byId.get(node.parent_id)?.kind ?? null : null),
    start_byte: node.span.start_byte,
    end_byte: node.span.end_byte,
    children: 0,
  };
}

function structureSummary(structure) {
  const byId = new Map(structure.nodes.map((node) => [node.node_id, node]));
  const childCount = new Map();
  for (const node of structure.nodes) {
    if (node.parent_id) childCount.set(node.parent_id, (childCount.get(node.parent_id) || 0) + 1);
  }
  const counts = {};
  for (const node of structure.nodes) counts[node.kind] = (counts[node.kind] || 0) + 1;
  const root = structure.nodes.find((node) => node.kind === 'AGREEMENT');
  const articles = structure.nodes
    .filter((node) => node.kind === 'ARTICLE' && node.parent_id === root?.node_id)
    .map((node) => ({ ...nodeRow(node, byId), children: childCount.get(node.node_id) || 0 }));
  // Annexes, exhibits and schedules the sectionizer keeps at the root: the
  // scoped exhibit (its own articles beneath it) and the annex section.
  const annexes = structure.nodes
    .filter((node) => node.parent_id === root?.node_id && node.kind !== 'ARTICLE' && /^(Annex|Exhibit|Schedule)-/i.test(String(node.reference || '')))
    .map((node) => ({ ...nodeRow(node, byId), children: childCount.get(node.node_id) || 0 }));
  const outsideParent = structure.nodes.filter((node) => {
    const parent = byId.get(node.parent_id);
    return parent && (parent.span.start_byte > node.span.start_byte || parent.span.end_byte < node.span.end_byte);
  }).map((node) => node.reference);
  return {
    node_count: structure.nodes.length,
    counts,
    articles,
    annexes,
    last_article_end_byte: articles.length > 0 ? articles[articles.length - 1].end_byte : null,
    nodes_outside_parent: outsideParent,
  };
}

function structureError(error) {
  return {
    code: error?.code || error?.name || 'STRUCTURE_FAILED',
    message: error?.message || String(error),
  };
}

async function checkStructure({ url, fetchImpl, clock, provider = null, modelConfig = null, submissionVersion = null, explicitGeneration = 0, maxAttempts = 3, env = process.env } = {}) {
  if (typeof url !== 'string' || url.length === 0) throw new TypeError('url is required');
  if (provider !== null && !isHostedProvider(provider)) throw new Error(`PRODUCT_HOSTED_PROVIDER_UNSUPPORTED: ${provider}`);
  const adapter = createSecIntakeAdapter({ ...(fetchImpl ? { fetchImpl } : {}), ...(clock ? { clock } : {}) });
  const version = submissionVersion || activeSubmissionVersion(env);
  const config = modelConfig || (provider ? hostedModelConfigFor(provider) : configuredProductModelConfig(env));
  const startedAt = Date.now();
  let source;
  try {
    source = await adapter.intake({ url });
  } catch (error) {
    return Object.freeze({
      url, ok: false, stage: 'INTAKE', ms: Date.now() - startedAt,
      error: { code: error?.code || 'INTAKE_FAILED', message: error?.message || String(error) },
    });
  }
  const report = {
    url,
    ok: true,
    stage: 'STRUCTURE',
    ms: 0,
    source: {
      source_document_id: source.source_document_id,
      raw_byte_length: source.raw_byte_length,
      raw_sha256: source.raw_sha256,
      canonical_text_byte_length: source.canonical_text_byte_length,
      canonical_text_sha256: source.canonical_text_sha256,
      filing_accession: source.filing_accession,
      exhibit_filename: source.exhibit_filename,
    },
    identity: {
      status: source.identity_status,
      reasons: [...source.identity_review_reasons],
      exhibit_type: source.exhibit_type,
      exhibit_description: source.exhibit_description,
      agreement_date: source.agreement_date,
      revision_status: source.revision_status,
      parties: source.parties.map((party) => ({ name: party.name, role: party.role })),
    },
    submission: {
      schema_version: version.schemaVersion,
      prompt_bundle_version: version.promptBundleVersion,
      provider_id: config.provider_id,
      explicit_generation: explicitGeneration,
      max_attempts: maxAttempts,
      fingerprint: submissionFingerprint({
        sourceDocumentId: source.source_document_id,
        schemaVersion: version.schemaVersion,
        promptBundleVersion: version.promptBundleVersion,
        modelConfig: config,
        explicitGeneration,
        maxAttempts,
      }),
    },
    structure: null,
    error: null,
  };
  try {
    const structure = buildAgreementStructure(source);
    report.structure = structureSummary(structure);
    report.structure.root_node_id = structure.root_node_id;
  } catch (error) {
    report.ok = false;
    report.error = structureError(error);
  }
  report.ms = Date.now() - startedAt;
  return Object.freeze(report);
}

function renderStructureCheck(report) {
  const lines = [];
  lines.push(`structure check: ${report.url}`);
  if (report.stage === 'INTAKE') {
    lines.push(`  intake failed: ${report.error.code}: ${report.error.message}`);
    return lines.join('\n');
  }
  const { source, identity, submission, structure } = report;
  lines.push(`  source: ${source.raw_byte_length} raw bytes, ${source.canonical_text_byte_length} canonical bytes, ${source.exhibit_filename} in ${source.filing_accession}`);
  lines.push(`  source_document_id: ${source.source_document_id}`);
  lines.push(`  canonical_text_sha256: ${source.canonical_text_sha256}`);
  lines.push(`  identity: ${identity.status}${identity.reasons.length > 0 ? ` (${identity.reasons.join(', ')})` : ''}; ${identity.exhibit_type || 'no exhibit type'}, dated ${identity.agreement_date || 'unknown'}, ${identity.revision_status || 'no revision status'}`);
  for (const party of identity.parties) lines.push(`    ${party.role}: ${party.name}`);
  lines.push(`  submission: ${submission.schema_version}, ${submission.prompt_bundle_version}, ${submission.provider_id}, generation ${submission.explicit_generation}, attempts ${submission.max_attempts}`);
  lines.push(`  fingerprint: ${submission.fingerprint}`);
  if (report.error) {
    lines.push(`  structure failed: ${report.error.code}: ${report.error.message}`);
    return lines.join('\n');
  }
  const counts = Object.entries(structure.counts).map(([kind, count]) => `${count} ${kind}`).join(', ');
  lines.push(`  structure: ${structure.node_count} nodes (${counts})`);
  for (const article of structure.articles) lines.push(`    ${article.reference} [${article.start_byte}, ${article.end_byte}) ${article.children} children`);
  if (structure.annexes.length === 0) lines.push('    no annex, exhibit or schedule at the root');
  for (const annex of structure.annexes) lines.push(`    ${annex.reference} (${annex.kind}) [${annex.start_byte}, ${annex.end_byte}) ${annex.children} children`);
  if (structure.nodes_outside_parent.length > 0) lines.push(`  nodes outside their parent: ${structure.nodes_outside_parent.join(', ')}`);
  lines.push(`  ${report.ok ? 'ok' : 'failed'} in ${report.ms} ms`);
  return lines.join('\n');
}

module.exports = {
  UNIT_SEPARATOR,
  checkStructure,
  jsonbText,
  renderStructureCheck,
  structureSummary,
  submissionFingerprint,
};
