import { execFileSync } from 'child_process';

const DIMENSIONS = new Set(['A', 'B', 'both']);

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
  return ran;
}

export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const dimension = String(req.query.dimension || req.body?.dimension || 'both');
    const ran = rerunSchemaLossAudit(dimension);
    return res.status(200).json({ ok: true, ran });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}
