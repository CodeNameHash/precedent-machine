import crypto from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import YAML from 'yaml';

const require = createRequire(import.meta.url);
const { specificationRootFromMembers } = require('../lib/programme-gates/review-controller');
const manifestPath = 'docs/codex-program/specification-manifest.json';
const files = [
  'docs/CODEX-PROGRAM.md',
  'docs/codex-program/EXECUTION-LEDGER.md',
  'docs/codex-program/programme-gates.yaml',
  'docs/codex-program/m3-family-parity-register.json',
  'docs/codex-program/canonical-contracts.md',
  'docs/codex-program/adversarial-tests.md',
];

function fail(message) {
  throw new Error(message);
}

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function strictYaml(file) {
  const [document] = YAML.parseAllDocuments(fs.readFileSync(file, 'utf8'), {
    customTags: [],
    prettyErrors: false,
    strict: true,
    uniqueKeys: true,
  });
  if (!document || document.errors.length || document.warnings.length) {
    fail(`Invalid governance YAML: ${file}`);
  }
  let alias = false;
  YAML.visit(document, { Alias() { alias = true; } });
  if (alias) fail(`YAML aliases are prohibited: ${file}`);
  return document.toJS({ maxAliasCount: 0 });
}

function generatedManifest() {
  return {
    schema: 'codex-program-specification-manifest/v2',
    purpose: 'DRIFT_DETECTION_ONLY_NOT_EXECUTION_AUTHORITY',
    files: files.map((file, index) => {
      const bytes = fs.readFileSync(file);
      return {
        order: index + 1,
        path: file,
        byte_length: bytes.length,
        sha256: sha256(bytes),
      };
    }),
  };
}

function same(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function specificationMembers(committed) {
  const paths = [manifestPath, ...committed.files.map(({ path: file }) => file)];
  return paths.map((file, index) => {
    const bytes = fs.readFileSync(file);
    return {
      order: index + 1,
      path: file,
      byte_length: bytes.length,
      payload_digest: sha256(bytes),
      source_bytes_base64: bytes.toString('base64'),
    };
  });
}

const parsed = strictYaml('docs/codex-program/programme-gates.yaml');
const registry = parsed.programme_gate_registry;
if (registry?.schema !== 'canonical-programme-gates/v2') {
  fail('Expected canonical-programme-gates/v2');
}

const milestoneIds = (registry.review_model?.exact_milestones || []).map(({ id }) => id);
if (!same(milestoneIds, [
  'M1_CONTRACT_FREEZE',
  'M2_VERTICAL_SLICE',
  'M3_FULL_CORPUS_CERTIFICATION',
  'M4_PRE_CUTOVER',
])) {
  fail('The review model must contain exactly M1 to M4');
}
if (registry.signed_status_required_before_preproduction_work !== false) {
  fail('Signed status must not gate pre-production work');
}
if (registry.tier_a_pre_cutover?.state !== 'ACTIVE') {
  fail('Tier A containment must remain active');
}
if (registry.phase_12_security_gates?.state !== 'DEFERRED_POST_CUTOVER'
  || registry.phase_12_security_gates?.blocks_cutover !== false) {
  fail('Tier B security must remain deferred until after cutover');
}

const importControls = new Set(
  registry.production_import_and_cutover?.required_controls || [],
);
for (const control of [
  'EXACT_BUNDLE_DIGEST_VERIFICATION',
  'COMPLETE_MEMBER_PARITY',
  'CHECKPOINTED_RESUMABLE_IMPORT',
  'IMPORT_CHECKPOINT_REPLAY_NO_OP',
  'CONFLICTING_REPLAY_FAILS_CLOSED',
  'ATOMIC_WHOLE_TUPLE_ACTIVATION',
  'POST_CUTOVER_SMOKE_WITH_ROLLBACK',
  'ONE_USE_BEN_CUTOVER_AUTHORISATION',
]) {
  if (!importControls.has(control)) fail(`Missing strict import control: ${control}`);
}

const generated = generatedManifest();
if (process.argv.includes('--write')) {
  fs.writeFileSync(manifestPath, `${JSON.stringify(generated, null, 2)}\n`);
  console.log(`Wrote ${manifestPath}`);
} else {
  const committed = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (!same(committed, generated)) fail('Specification drift manifest is stale');
  console.log(`CODEX programme specification PASS ${specificationRootFromMembers(
    specificationMembers(committed),
  )}`);
}
