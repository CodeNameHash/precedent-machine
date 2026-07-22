import { execFileSync } from 'child_process';

const { blockVercelRepositoryArtifactRoute } = require('../../../../lib/admin/repository-artifact-access');

const DIMENSIONS = new Set(['A', 'B', 'C', 'both']);

function runScript(script) {
  execFileSync(process.execPath, [script], { stdio: 'pipe' });
}

export function rerunSchemaLossAudit(dimension = 'both') {
  if (!DIMENSIONS.has(dimension)) throw new Error(`Unsupported dimension: ${dimension}`);
  const ran = [];
  if (dimension === 'B' || dimension === 'both') {
    runScript('scripts/schema-loss/audit-claim-integrity.js');
    ran.push('B');
  }
  if (dimension === 'A' || dimension === 'both') {
    runScript('scripts/schema-loss/audit-residuals.js');
    ran.push('A');
  }
  // Dimension C (GAP-E feature residuals) is flag-gated and NOT part of the
  // default 'both' re-run -- rerunning it is inert when the flag is off (the
  // script writes an empty artifact either way), but keeping it out of the
  // default sweep avoids paying the normalized-v1.json read cost for a
  // panel that stays hidden by default.
  if (dimension === 'C') {
    runScript('scripts/schema-loss/audit-feature-residuals.js');
    ran.push('C');
  }
  return ran;
}

export default function handler(req, res) {
  if (blockVercelRepositoryArtifactRoute(res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const dimension = String(req.query.dimension || req.body?.dimension || 'both');
    const ran = rerunSchemaLossAudit(dimension);
    return res.status(200).json({ ok: true, ran });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}
