// Static stage-card data for /admin/processing-flow. Sourced from
// docs/schema-shape/provision-processing-flow.md § 2 ("Key files" column)
// and § 3 ("Where each Taxonomy node is born"). This is deliberately
// hand-authored rather than parsed from the markdown table — the doc's
// table mixes Reads/Writes/Governed-by columns that don't map 1:1 onto
// "owning files" and "taxonomy nodes", so parsing it would either under- or
// over-report. Keep this in sync by hand if § 2/§ 3 change.
//
// Kept as a plain (non-JSX) module so it can be `require`d directly from
// node:test specs without a JSX transform, and imported by the page/API
// route the same way.
const STAGES = [
  {
    id: 1,
    name: 'Ingest',
    description: 'Fetch and hash the source document, then extract its text layer.',
    files: [
      { path: 'scripts/ingest-agreements.js', type: 'file' },
      { path: 'lib/parser-v2/text-layers.js', type: 'file' },
      { path: 'pages/api/ingest/from-url.js', type: 'file' },
    ],
    taxonomyNodes: 'Emits: Deal (first document creates the Deal record).',
  },
  {
    id: 2,
    name: 'Structural segmentation',
    description: 'Parse Article/Section/Schedule/Exhibit boundaries into the Region store.',
    files: [
      { path: 'lib/parser-v2/structural.js', type: 'file' },
      { path: 'lib/parser-v2/regions.js', type: 'file' },
      { path: 'lib/parser-v2/region-store.js', type: 'file' },
      { path: 'lib/schema/topology-detector.js', type: 'file' },
    ],
    taxonomyNodes: 'Emits: Section (structural parser).',
  },
  {
    id: 3,
    name: 'Provision classification',
    description: 'Classify each Section into operative or definition Provisions, including inline-definition scanning.',
    files: [
      { path: 'lib/parser-v2/classify.js', type: 'file' },
      { path: 'lib/parser-v2/detectors', type: 'dir' },
      { path: 'pages/api/ingest/classify.js', type: 'file' },
    ],
    taxonomyNodes: 'Consumes: Attribute Registry, inline-definition scanner. Emits: Provision (kind=operative), Provision (kind=definition); updates DealProfile.',
  },
  {
    id: 4,
    name: 'Claim extraction — two-pass',
    description: 'Pass 1 extracts definition-Provisions into a deal-wide definitions map; Pass 2 extracts operative-Provisions with that map as prompt context.',
    files: [
      { path: 'lib/parser-v2/extract.js', type: 'file' },
      { path: 'lib/parser-v2/run-extract.js', type: 'file' },
      { path: 'lib/schema/prompt.js', type: 'file' },
      { path: 'lib/anthropic.js', type: 'file' },
      { path: 'lib/parser-v2/parse-json.js', type: 'file' },
    ],
    taxonomyNodes: 'Consumes: Provisions. Emits: references_definition edge, Excerpt, Claim (Verbatim + Provenance; Canonical filled at stage 5); DealProfile Claims.',
  },
  {
    id: 5,
    name: 'Normalisation',
    description: 'Resolve Verbatim to Canonical via the Attribute Registry and Normalizer alias rules.',
    files: [
      { path: 'lib/vocab', type: 'dir' },
      { path: 'lib/parser-v2/reapply-corrections.js', type: 'file' },
      { path: 'lib/canonical-conditions.js', type: 'file' },
    ],
    taxonomyNodes: 'Consumes: Verbatim. Emits: Claim.Canonical.',
  },
  {
    id: 6,
    name: 'Validation',
    description: 'Schema validation, coverage check, invariants, and quote verification per Claim.',
    files: [
      { path: 'lib/schema/validation.js', type: 'file' },
      { path: 'lib/parser-v2/invariants', type: 'dir' },
      { path: 'lib/verification.js', type: 'file' },
      { path: 'lib/schema/coverage.js', type: 'file' },
    ],
    taxonomyNodes: 'Consumes: Claims + Section text. Emits: pass/fail per Claim (no new Taxonomy node).',
  },
  {
    id: 7,
    name: 'Persist',
    description: 'Write validated Claims and references_definition edges to normalized-v1.json; append reconciliation-log.jsonl.',
    files: [
      { path: 'lib/parser-v2/snapshot.js', type: 'file' },
      { path: 'lib/parser-v2/store.js', type: 'file' },
    ],
    taxonomyNodes: 'Consumes: validated Claims. Emits: persisted normalized-v1.json (Claims + references_definition edges), reconciliation-log.jsonl.',
  },
  {
    id: 8,
    name: 'Ingest QA gate',
    description: 'Zero unverified quotes, zero duplicate same-kind Provisions on the same range, per-deal thresholds; quarantine on failure.',
    files: [
      { path: 'scripts/ingest-qa.js', type: 'file' },
    ],
    taxonomyNodes: 'Consumes: persisted deal. Emits: quarantine flag or clean (no new Taxonomy node); feeds Schema-Loss Audit Dimensions A/B.',
  },
];

module.exports = { STAGES };
