#!/usr/bin/env node

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EVIDENCE = path.join(ROOT, 'evidence/canonical-v2');
const MANIFEST_PATH = path.join(EVIDENCE, 'stage-2y-cd-baseline-manifest.json');
const BASELINE_PATH = path.join(EVIDENCE, 'stage-2y-cd-baseline.json');
const REPORT_PATH = path.join(EVIDENCE, 'stage-2y-cd-report.json');
const STAGE_2Y_N_PATH = path.join(EVIDENCE, 'stage-2y-n-rendered-rows.json');
const EXPECTED_RUN_COUNT = 130;
const ABSENCE_COPY = /^(?:not found \(may not be present(?:, or not yet extracted)?\)|not yet extracted|not specified|none specified)$/i;
const PRE_CARD_ERRORS = new Set([
  'CLAIM_PROJECTION_FAILED',
  'CLAIM_PROJECTION_INVALID',
  'CLAIM_PROJECTED_NO_CARD',
]);
const HISTORICAL_EXACT_ROW_MATCH = Object.freeze({
  CLOSING_CONDITIONS: 'SINGLE_SCOPED_ROW',
  GENERAL_COVENANTS: 'SINGLE_SCOPED_ROW',
  MATERIAL_CONTRACTS: 'BUCKET_CODE',
  SPECIFIC_PERFORMANCE_REMEDIES: 'SINGLE_SCOPED_ROW',
  TERMINATION: 'SINGLE_SCOPED_ROW',
  TERMINATION_FEE: 'SINGLE_SCOPED_ROW',
});

const preview = await import(path.join(ROOT, 'lib/review-parity/rendered-row-preview.js'))
  .then((module) => module.default || module);

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function fileHash(filePath) {
  return sha256(fs.readFileSync(filePath));
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  const temporary = `${filePath}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${canonical(value)}\n`);
  fs.renameSync(temporary, filePath);
}

function relativeFromRoot(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, '/');
}

function claimIdentity(entry) {
  return entry?.claim?.claim_revision_id || entry?.claim_revision_id || entry?.closure_id || null;
}

function sectionReference(entry) {
  return entry?.claim?.section_reference || entry?.section_reference || null;
}

function resolutionCounts(resolution) {
  const resolved = Array.isArray(resolution?.resolved) ? resolution.resolved.length : 0;
  const openWorld = Array.isArray(resolution?.open_world) ? resolution.open_world.length : 0;
  const review = Array.isArray(resolution?.review_queue)
    ? resolution.review_queue.filter((row) => row?.has_resolution === false).length
    : 0;
  return { attempted: resolved + review, resolved, open_world: openWorld, review };
}

function hasContent(row) {
  return (row?.cells || []).some((cell) => {
    const text = String(cell?.text || '').trim();
    return text && !ABSENCE_COPY.test(text);
  });
}

function renderOutputPayload(rendered) {
  const rows = (rendered?.rows || []).map((row) => ({
    id: row?.id ?? null,
    label: row?.label ?? '',
    matches_claim_key: row?.matches_claim_key === true,
    cells: (row?.cells || []).map((cell) => ({
      id: cell?.id ?? null,
      header: cell?.header ?? '',
      text: cell?.text ?? null,
      render_error: cell?.render_error ?? null,
    })),
  }));
  const keyMatched = rows.some((row) => row.matches_claim_key);
  const populated = rows.some(hasContent);
  return {
    section: {
      id: rendered?.section?.id ?? null,
      title: rendered?.section?.title ?? '',
    },
    row_selection: keyMatched ? 'KEY_MATCH' : populated ? 'POPULATED' : 'NONE_IDENTIFIED',
    rows,
  };
}

function renderSignature(rendered) {
  const payload = renderOutputPayload(rendered);
  return { digest: sha256(canonical(payload)), payload };
}

function matchedClaimRow(payload) {
  const matched = (payload?.rows || []).filter((row) => row.matches_claim_key === true);
  if (matched.length !== 1) throw new Error(`MEASUREMENT_CLAIM_ROW_NOT_UNIQUE:${matched.length}`);
  return matched[0];
}

function discoverBaselineRuns(evidenceRoot = EVIDENCE) {
  const selected = new Map();
  for (const directory of fs.readdirSync(evidenceRoot).sort()) {
    if (!/-2xk(-r\d)?-final$/.test(directory)) continue;
    const manifestPath = path.join(evidenceRoot, directory, 'run-manifest.json');
    const resolutionPath = path.join(evidenceRoot, directory, 'resolution.json');
    if (!fs.existsSync(manifestPath) || !fs.existsSync(resolutionPath)) continue;
    const manifest = readJson(manifestPath);
    const resolution = readJson(resolutionPath);
    const resolvedCount = Array.isArray(resolution.resolved) ? resolution.resolved.length : 0;
    if (!resolvedCount) continue;
    const key = `${manifest.section_family}|${manifest.deal}`;
    const existing = selected.get(key);
    if (!existing || resolvedCount > existing.resolved_count
      || (resolvedCount === existing.resolved_count && directory.localeCompare(existing.directory) < 0)) {
      selected.set(key, {
        directory,
        deal: manifest.deal,
        family: manifest.section_family,
        run_manifest: {
          path: relativeFromRoot(manifestPath),
          sha256: fileHash(manifestPath),
        },
        resolution: {
          path: relativeFromRoot(resolutionPath),
          sha256: fileHash(resolutionPath),
        },
        resolved_count: resolvedCount,
      });
    }
  }
  return [...selected.values()].sort((left, right) => (
    left.family.localeCompare(right.family)
    || left.deal.localeCompare(right.deal)
    || left.directory.localeCompare(right.directory)
  ));
}

function stage2yNBinding(stage2yNPath = STAGE_2Y_N_PATH) {
  const artifact = readJson(stage2yNPath);
  return {
    path: relativeFromRoot(stage2yNPath),
    sha256: fileHash(stage2yNPath),
    schema_version: artifact.schema_version,
    run_count: artifact.run_count,
    totals: artifact.totals,
    by_family: artifact.by_family,
    sampled_records: artifact.sampled_records,
    records_digest: sha256(canonical(artifact.records || [])),
  };
}

function buildManifest({ runs, stage2yN }) {
  if (!Array.isArray(runs) || runs.length !== EXPECTED_RUN_COUNT) {
    throw new Error(`BASELINE_RUN_COUNT_INVALID:${runs?.length ?? 'null'}`);
  }
  const body = {
    schema_version: 'STAGE_2Y_CD_BASELINE_MANIFEST/V1',
    purpose: 'Pinned report-only baseline for Phase C and Phase D rendered-row measurement.',
    authority: {
      publication_authorisation: 'NONE',
      product_writes: false,
      serving_activated: false,
      model_calls: 0,
    },
    selection: {
      source_pattern: 'evidence/canonical-v2/*-2xk[-rN]-final',
      key: 'section_family|deal',
      rule: 'HIGHEST_RESOLVED_COUNT_THEN_LEXICAL_DIRECTORY',
      run_count: runs.length,
    },
    stage_2y_n_before: stage2yN,
    runs,
    input_set_digest: sha256(canonical(runs)),
  };
  return { ...body, manifest_id: sha256(canonical(body)) };
}

function validateManifest(manifest, { verifyFiles = true } = {}) {
  if (!manifest || manifest.schema_version !== 'STAGE_2Y_CD_BASELINE_MANIFEST/V1') {
    throw new Error('BASELINE_MANIFEST_SCHEMA_INVALID');
  }
  const { manifest_id: suppliedId, ...body } = manifest;
  if (suppliedId !== sha256(canonical(body))) throw new Error('BASELINE_MANIFEST_ID_INVALID');
  if (manifest.runs?.length !== EXPECTED_RUN_COUNT) throw new Error('BASELINE_RUN_COUNT_INVALID');
  if (manifest.input_set_digest !== sha256(canonical(manifest.runs))) throw new Error('BASELINE_INPUT_SET_INVALID');
  const keys = new Set();
  for (const run of manifest.runs) {
    const key = `${run.family}|${run.deal}`;
    if (keys.has(key)) throw new Error(`BASELINE_RUN_DUPLICATED:${key}`);
    keys.add(key);
    if (!verifyFiles) continue;
    for (const input of [run.run_manifest, run.resolution]) {
      const absolute = path.resolve(ROOT, input.path);
      if (!fs.existsSync(absolute)) throw new Error(`BASELINE_INPUT_MISSING:${input.path}`);
      if (fileHash(absolute) !== input.sha256) throw new Error(`BASELINE_INPUT_DRIFT:${input.path}`);
    }
  }
  if (verifyFiles) {
    const before = manifest.stage_2y_n_before;
    const absolute = path.resolve(ROOT, before.path);
    if (!fs.existsSync(absolute) || fileHash(absolute) !== before.sha256) {
      throw new Error('STAGE_2Y_N_BEFORE_DRIFT');
    }
  }
  return true;
}

function emptyFamily(family) {
  return {
    family,
    run_count: 0,
    attempted: 0,
    resolved: 0,
    open_world: 0,
    review: 0,
    rendering_funnel: {
      resolved_input: 0,
      route_available: 0,
      card_projected: 0,
      row_emitted: 0,
      row_with_content: 0,
    },
    render_failures: {},
    duplicates: {
      raw_rendered_claims: 0,
      distinct_full_output_signatures: 0,
      duplicate_excess: 0,
      collapse_rate: null,
    },
  };
}

function addCounts(target, counts) {
  for (const key of ['attempted', 'resolved', 'open_world', 'review']) target[key] += counts[key];
}

function buildDuplicateReport(groups) {
  const rows = [...groups.values()].sort((left, right) => (
    left.family.localeCompare(right.family)
    || left.deal.localeCompare(right.deal)
    || left.signature.localeCompare(right.signature)
  ));
  const raw = rows.reduce((sum, row) => sum + row.members.length, 0);
  const excess = rows.reduce((sum, row) => sum + Math.max(0, row.members.length - 1), 0);
  return {
    raw_rendered_claims: raw,
    distinct_full_output_signatures: rows.length,
    duplicate_excess: excess,
    collapse_rate: raw ? excess / raw : null,
    groups: rows,
  };
}

function historicalGroupHasExactRow(group) {
  const mode = HISTORICAL_EXACT_ROW_MATCH[group.family];
  const rows = group?.full_output?.rows || [];
  if (mode === 'SINGLE_SCOPED_ROW') return rows.length === 1;
  if (mode === 'BUCKET_CODE') return rows.filter((row) => row.matches_claim_key === true).length === 1;
  return false;
}

function historicalProvisionCardinality(manifest) {
  const cardinality = new Map();
  for (const pin of manifest.runs) {
    const resolution = readJson(path.resolve(ROOT, pin.resolution.path));
    const byProvision = new Map();
    for (const entry of resolution.resolved || []) {
      const provisionId = entry?.provision_instance?.provision_instance_id;
      if (!provisionId) continue;
      byProvision.set(provisionId, (byProvision.get(provisionId) || 0) + 1);
    }
    for (const entry of resolution.resolved || []) {
      const claimId = claimIdentity(entry);
      const provisionId = entry?.provision_instance?.provision_instance_id;
      if (claimId && provisionId) cardinality.set(`${pin.family}|${claimId}`, byProvision.get(provisionId));
    }
  }
  return cardinality;
}

function exactifyHistoricalBaselineMeasurement(measurement, manifest) {
  const provisionCardinality = historicalProvisionCardinality(manifest);
  const notClaimScopedByFamily = new Map();
  const includedGroups = [];
  for (const group of measurement.full_output_duplicate_groups || []) {
    if (!historicalGroupHasExactRow(group)) continue;
    const mode = HISTORICAL_EXACT_ROW_MATCH[group.family];
    const members = mode === 'SINGLE_SCOPED_ROW'
      ? group.members.filter((member) => provisionCardinality.get(`${group.family}|${member.claim_revision_id}`) === 1)
      : group.members;
    const excluded = group.members.length - members.length;
    if (excluded > 0) {
      notClaimScopedByFamily.set(group.family, (notClaimScopedByFamily.get(group.family) || 0) + excluded);
    }
    if (members.length) includedGroups.push({ ...group, members });
  }
  const groupsByFamily = new Map();
  for (const group of includedGroups) {
    if (!groupsByFamily.has(group.family)) groupsByFamily.set(group.family, new Map());
    groupsByFamily.get(group.family).set(`${group.deal}|${group.signature}`, group);
  }
  const byFamily = measurement.by_family.map((source) => {
    const familyGroups = groupsByFamily.get(source.family) || new Map();
    const duplicates = buildDuplicateReport(familyGroups);
    const rowWithContent = duplicates.groups.reduce((count, group) => {
      const mode = HISTORICAL_EXACT_ROW_MATCH[group.family];
      const rows = group.full_output.rows || [];
      const matched = mode === 'SINGLE_SCOPED_ROW'
        ? rows[0]
        : rows.find((row) => row.matches_claim_key === true);
      return count + (hasContent(matched) ? group.members.length : 0);
    }, 0);
    const renderFailures = { ...source.render_failures };
    if (!HISTORICAL_EXACT_ROW_MATCH[source.family] && source.rendering_funnel.card_projected > 0) {
      renderFailures.CLAIM_EXACT_ROW_ROUTE_MISSING = source.rendering_funnel.card_projected;
    }
    if (HISTORICAL_EXACT_ROW_MATCH[source.family] === 'SINGLE_SCOPED_ROW') {
      const otherPostCardFailures = Object.entries(renderFailures).reduce((sum, [code, count]) => (
        PRE_CARD_ERRORS.has(code) || code === 'CLAIM_CARD_NOT_CLAIM_SCOPED' ? sum : sum + count
      ), 0);
      const inferredNotClaimScoped = Math.max(
        notClaimScopedByFamily.get(source.family) || 0,
        source.rendering_funnel.card_projected - duplicates.raw_rendered_claims - otherPostCardFailures,
      );
      if (inferredNotClaimScoped > 0) renderFailures.CLAIM_CARD_NOT_CLAIM_SCOPED = inferredNotClaimScoped;
    }
    return {
      ...source,
      rendering_funnel: {
        ...source.rendering_funnel,
        row_emitted: duplicates.raw_rendered_claims,
        row_with_content: rowWithContent,
      },
      render_failures: renderFailures,
      duplicates: {
        raw_rendered_claims: duplicates.raw_rendered_claims,
        distinct_full_output_signatures: duplicates.distinct_full_output_signatures,
        duplicate_excess: duplicates.duplicate_excess,
        collapse_rate: duplicates.collapse_rate,
      },
    };
  });
  const totals = emptyFamily('ALL');
  totals.run_count = byFamily.reduce((sum, family) => sum + family.run_count, 0);
  for (const family of byFamily) {
    addCounts(totals, family);
    for (const key of Object.keys(totals.rendering_funnel)) {
      totals.rendering_funnel[key] += family.rendering_funnel[key];
    }
    for (const [code, count] of Object.entries(family.render_failures)) {
      totals.render_failures[code] = (totals.render_failures[code] || 0) + count;
    }
  }
  const duplicates = buildDuplicateReport(new Map(includedGroups.map((group) => [
    `${group.family}|${group.deal}|${group.signature}`,
    group,
  ])));
  totals.duplicates = {
    raw_rendered_claims: duplicates.raw_rendered_claims,
    distinct_full_output_signatures: duplicates.distinct_full_output_signatures,
    duplicate_excess: duplicates.duplicate_excess,
    collapse_rate: duplicates.collapse_rate,
  };
  return {
    ...measurement,
    measurement_rule: 'EXACT_GOVERNED_ROW_V3_ROUTE_BOUND',
    historical_exact_route_policy: HISTORICAL_EXACT_ROW_MATCH,
    totals,
    by_family: byFamily,
    full_output_duplicate_groups: duplicates.groups,
  };
}

function measurePinnedRuns(manifest) {
  validateManifest(manifest);
  const families = new Map();
  const duplicateGroups = new Map();
  const routeFamilies = new Set(Object.keys(preview.FAMILY_ROUTES));

  for (const pin of manifest.runs) {
    const runManifest = readJson(path.resolve(ROOT, pin.run_manifest.path));
    const resolution = readJson(path.resolve(ROOT, pin.resolution.path));
    if (!families.has(pin.family)) families.set(pin.family, emptyFamily(pin.family));
    const family = families.get(pin.family);
    family.run_count += 1;
    addCounts(family, resolutionCounts(resolution));

    for (const entry of resolution.resolved || []) {
      family.rendering_funnel.resolved_input += 1;
      if (!routeFamilies.has(pin.family)) {
        family.render_failures.FAMILY_NOT_RENDERABLE = (family.render_failures.FAMILY_NOT_RENDERABLE || 0) + 1;
        continue;
      }
      family.rendering_funnel.route_available += 1;
      let rendered;
      try {
        rendered = preview.previewClaimSection({
          run: { manifest: runManifest, resolution },
          resolved_entry: entry,
        });
      } catch (error) {
        const code = error?.code || 'UNKNOWN';
        family.render_failures[code] = (family.render_failures[code] || 0) + 1;
        if (!PRE_CARD_ERRORS.has(code)) family.rendering_funnel.card_projected += 1;
        continue;
      }
      family.rendering_funnel.card_projected += 1;
      family.rendering_funnel.row_emitted += 1;
      const signature = renderSignature(rendered);
      if (hasContent(matchedClaimRow(signature.payload))) family.rendering_funnel.row_with_content += 1;
      const groupKey = `${pin.family}|${pin.deal}|${signature.digest}`;
      if (!duplicateGroups.has(groupKey)) {
        duplicateGroups.set(groupKey, {
          family: pin.family,
          deal: pin.deal,
          signature: signature.digest,
          full_output: signature.payload,
          members: [],
        });
      }
      duplicateGroups.get(groupKey).members.push({
        run: pin.directory,
        claim_revision_id: claimIdentity(entry),
        claim_definition_key: rendered.resolved_claim_definition_key || null,
        section_reference: sectionReference(entry),
      });
    }
  }

  const duplicates = buildDuplicateReport(duplicateGroups);
  for (const family of families.values()) {
    const familyGroups = new Map(
      [...duplicateGroups].filter(([, group]) => group.family === family.family),
    );
    const report = buildDuplicateReport(familyGroups);
    family.duplicates = {
      raw_rendered_claims: report.raw_rendered_claims,
      distinct_full_output_signatures: report.distinct_full_output_signatures,
      duplicate_excess: report.duplicate_excess,
      collapse_rate: report.collapse_rate,
    };
  }

  const byFamily = [...families.values()].sort((left, right) => left.family.localeCompare(right.family));
  const totals = emptyFamily('ALL');
  totals.run_count = byFamily.reduce((sum, family) => sum + family.run_count, 0);
  for (const family of byFamily) {
    addCounts(totals, family);
    for (const key of Object.keys(totals.rendering_funnel)) {
      totals.rendering_funnel[key] += family.rendering_funnel[key];
    }
    for (const [code, count] of Object.entries(family.render_failures)) {
      totals.render_failures[code] = (totals.render_failures[code] || 0) + count;
    }
  }
  totals.duplicates = {
    raw_rendered_claims: duplicates.raw_rendered_claims,
    distinct_full_output_signatures: duplicates.distinct_full_output_signatures,
    duplicate_excess: duplicates.duplicate_excess,
    collapse_rate: duplicates.collapse_rate,
  };

  return {
    schema_version: 'STAGE_2Y_CD_MEASUREMENT/V1',
    manifest_id: manifest.manifest_id,
    input_set_digest: manifest.input_set_digest,
    run_count: manifest.runs.length,
    routed_families: [...routeFamilies].sort(),
    totals,
    by_family: byFamily,
    full_output_duplicate_groups: duplicates.groups,
  };
}

function numericDelta(before, after) {
  const delta = {};
  for (const key of ['attempted', 'resolved', 'open_world', 'review']) delta[key] = after[key] - before[key];
  delta.rendering_funnel = {};
  for (const key of Object.keys(before.rendering_funnel)) {
    delta.rendering_funnel[key] = after.rendering_funnel[key] - before.rendering_funnel[key];
  }
  delta.duplicates = {};
  for (const key of ['raw_rendered_claims', 'distinct_full_output_signatures', 'duplicate_excess']) {
    delta.duplicates[key] = after.duplicates[key] - before.duplicates[key];
  }
  delta.duplicates.collapse_rate = before.duplicates.collapse_rate === null || after.duplicates.collapse_rate === null
    ? null
    : after.duplicates.collapse_rate - before.duplicates.collapse_rate;
  return delta;
}

function compareMeasurements(before, after) {
  const beforeFamilies = new Map(before.by_family.map((family) => [family.family, family]));
  const afterFamilies = new Map(after.by_family.map((family) => [family.family, family]));
  const familyNames = [...new Set([...beforeFamilies.keys(), ...afterFamilies.keys()])].sort();
  return {
    totals: numericDelta(before.totals, after.totals),
    by_family: familyNames.map((family) => ({
      family,
      ...numericDelta(beforeFamilies.get(family) || emptyFamily(family), afterFamilies.get(family) || emptyFamily(family)),
    })),
  };
}

function buildBaseline(manifest, measurement) {
  const body = {
    schema_version: 'STAGE_2Y_CD_BASELINE/V1',
    row_measurement: 'EXACT_GOVERNED_ROW_V3_ROUTE_BOUND',
    authority: manifest.authority,
    manifest_id: manifest.manifest_id,
    stage_2y_n_before: manifest.stage_2y_n_before,
    measurement,
  };
  return { ...body, baseline_id: sha256(canonical(body)) };
}

function validateBaseline(baseline, manifest) {
  const { baseline_id: suppliedId, ...body } = baseline || {};
  if (baseline?.schema_version !== 'STAGE_2Y_CD_BASELINE/V1'
    || baseline.row_measurement !== 'EXACT_GOVERNED_ROW_V3_ROUTE_BOUND'
    || baseline.manifest_id !== manifest.manifest_id
    || suppliedId !== sha256(canonical(body))) throw new Error('CD_BASELINE_INVALID');
  return true;
}

function buildReport(manifest, baseline, current) {
  return {
    schema_version: 'STAGE_2Y_CD_REPORT/V1',
    authority: manifest.authority,
    manifest_id: manifest.manifest_id,
    baseline: {
      path: relativeFromRoot(BASELINE_PATH),
      sha256: fileHash(BASELINE_PATH),
      baseline_id: baseline.baseline_id,
    },
    stage_2y_n_before: manifest.stage_2y_n_before,
    delta: compareMeasurements(baseline.measurement, current),
    current,
  };
}

function validateReport(report, manifest, baseline, current) {
  if (report?.schema_version !== 'STAGE_2Y_CD_REPORT/V1'
    || report.manifest_id !== manifest.manifest_id
    || report.baseline?.sha256 !== fileHash(BASELINE_PATH)
    || report.baseline?.baseline_id !== baseline.baseline_id) throw new Error('CD_REPORT_INVALID');
  if (canonical(report.current) !== canonical(current)) throw new Error('CD_REPORT_CURRENT_STALE');
  const expectedDelta = compareMeasurements(baseline.measurement, current);
  if (canonical(report.delta) !== canonical(expectedDelta)) throw new Error('CD_REPORT_DELTA_STALE');
  return true;
}

function prepareBaseline() {
  if (fs.existsSync(MANIFEST_PATH) || fs.existsSync(BASELINE_PATH)) throw new Error('CD_BASELINE_ALREADY_EXISTS');
  const runs = discoverBaselineRuns();
  const manifest = buildManifest({ runs, stage2yN: stage2yNBinding() });
  validateManifest(manifest);
  const measurement = exactifyHistoricalBaselineMeasurement(measurePinnedRuns(manifest), manifest);
  const baseline = buildBaseline(manifest, measurement);
  writeJson(MANIFEST_PATH, manifest);
  writeJson(BASELINE_PATH, baseline);
  writeJson(REPORT_PATH, buildReport(manifest, baseline, measurement));
  return { manifest, baseline };
}

function upgradeBaselineToExactRows() {
  const manifest = readJson(MANIFEST_PATH);
  const prior = readJson(BASELINE_PATH);
  validateManifest(manifest);
  const measurement = exactifyHistoricalBaselineMeasurement(prior.measurement, manifest);
  const baseline = buildBaseline(manifest, measurement);
  writeJson(BASELINE_PATH, baseline);
  const current = measurePinnedRuns(manifest);
  writeJson(REPORT_PATH, buildReport(manifest, baseline, current));
  return baseline;
}

function measureCurrent() {
  const manifest = readJson(MANIFEST_PATH);
  const baseline = readJson(BASELINE_PATH);
  validateManifest(manifest);
  validateBaseline(baseline, manifest);
  const current = measurePinnedRuns(manifest);
  const report = buildReport(manifest, baseline, current);
  writeJson(REPORT_PATH, report);
  return report;
}

function checkArtifacts() {
  const manifest = readJson(MANIFEST_PATH);
  const baseline = readJson(BASELINE_PATH);
  const report = readJson(REPORT_PATH);
  validateManifest(manifest);
  validateBaseline(baseline, manifest);
  const current = measurePinnedRuns(manifest);
  return validateReport(report, manifest, baseline, current);
}

function parseArgs(argv) {
  if (argv.length !== 1 || !['--prepare-baseline', '--upgrade-baseline-exact-row', '--measure', '--check'].includes(argv[0])) {
    throw new Error('USAGE: --prepare-baseline | --upgrade-baseline-exact-row | --measure | --check');
  }
  return argv[0];
}

function main() {
  const mode = parseArgs(process.argv.slice(2));
  if (mode === '--prepare-baseline') {
    const result = prepareBaseline();
    process.stdout.write(`Phase C/D baseline pinned: ${result.manifest.runs.length} runs\n`);
    return;
  }
  if (mode === '--upgrade-baseline-exact-row') {
    const baseline = upgradeBaselineToExactRows();
    process.stdout.write(`Phase C/D baseline upgraded to exact rows: ${baseline.measurement.totals.rendering_funnel.row_emitted} rows\n`);
    return;
  }
  if (mode === '--measure') {
    const result = measureCurrent();
    process.stdout.write(`Phase C/D measured: ${result.current.run_count} pinned runs\n`);
    return;
  }
  checkArtifacts();
  process.stdout.write('Phase C/D measurement artefacts valid\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { process.stderr.write(`${error.stack || error}\n`); process.exitCode = 1; }
}

export {
  buildDuplicateReport,
  buildManifest,
  canonical,
  compareMeasurements,
  discoverBaselineRuns,
  exactifyHistoricalBaselineMeasurement,
  hasContent,
  measurePinnedRuns,
  matchedClaimRow,
  renderOutputPayload,
  renderSignature,
  resolutionCounts,
  sha256,
  stage2yNBinding,
  validateBaseline,
  validateManifest,
  validateReport,
};
