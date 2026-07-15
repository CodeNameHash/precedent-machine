import fs from 'fs';
import { isResidualCaptureEnabled } from '../../../../lib/schema-loss/residuals.js';

const OBSERVATIONS_FILE = 'docs/schema-shape/unmapped-observations.json';
const WARNINGS_FILE = 'docs/schema-shape/claim-integrity-warnings.jsonl';
const FEATURE_RESIDUALS_FILE = 'docs/schema-shape/feature-residuals.json';
const DEFAULT_LIMIT = 100;

function readJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function readJsonl(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line));
}

function clampInt(value, fallback, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.min(parsed, max);
}

export function readSchemaLossQueue(query = {}) {
  const dimension = String(query.dimension || 'A').toUpperCase();
  const limit = clampInt(query.limit, DEFAULT_LIMIT, 500);
  const offset = clampInt(query.offset, 0, Number.MAX_SAFE_INTEGER);
  if (dimension === 'B') {
    const entries = readJsonl(WARNINGS_FILE);
    return {
      dimension: 'B',
      label: 'Suspect Claims',
      total: entries.length,
      offset,
      limit,
      entries: entries.slice(offset, offset + limit),
    };
  }
  if (dimension === 'C') {
    // GAP-E feature residuals (P7): flag-gated at READ time, not just at
    // write time, so a stale artifact from a prior flag-on run can never
    // leak entries once the flag is back off -- "flag off -> zero behavior
    // change" holds regardless of what's on disk.
    if (!isResidualCaptureEnabled()) {
      return {
        dimension: 'C',
        label: 'Feature residuals (verbatim-only)',
        enabled: false,
        total: 0,
        offset,
        limit,
        entries: [],
        note: 'Residual capture is disabled (RESIDUAL_CAPTURE_ENABLED is not set).',
      };
    }
    const residuals = readJson(FEATURE_RESIDUALS_FILE, { entries: [] });
    const entries = residuals.entries || [];
    return {
      dimension: 'C',
      label: 'Feature residuals (verbatim-only)',
      enabled: true,
      total: entries.length,
      offset,
      limit,
      entries: entries.slice(offset, offset + limit),
      meta: residuals.source || {},
      note: residuals.note || null,
    };
  }
  const queue = readJson(OBSERVATIONS_FILE, { clusters: [] });
  const entries = queue.clusters || [];
  return {
    dimension: 'A',
    label: 'Uncovered text',
    total: entries.length,
    offset,
    limit,
    entries: entries.slice(offset, offset + limit),
    meta: queue.source || {},
    note: queue.note || null,
  };
}

export default function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  return res.status(200).json(readSchemaLossQueue(req.query || {}));
}
