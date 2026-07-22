import fs from 'fs';

const { blockVercelRepositoryArtifactRoute } = require('../../../../lib/admin/repository-artifact-access');

const STATE_FILE = 'docs/schema-shape/audit-state.json';

export default function handler(req, res) {
  if (blockVercelRepositoryArtifactRoute(res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  const decision = { ...req.body, decided_at: new Date().toISOString() };
  state.decisions = [...(state.decisions || []), decision];
  fs.writeFileSync(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`);
  return res.status(200).json({ decision });
}
