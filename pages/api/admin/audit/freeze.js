import fs from 'fs';

const STATE_FILE = 'docs/schema-shape/audit-state.json';
const MARKER_FILE = 'docs/schema-shape/phase-0-C.frozen';

export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  const unresolved = (state.decisions || []).filter((decision) => decision.status === 'red' && !decision.resolution);
  if (unresolved.length) return res.status(409).json({ error: 'Unresolved red cells', unresolved });
  fs.writeFileSync(MARKER_FILE, `frozen_at=${new Date().toISOString()}\n`);
  return res.status(200).json({ ok: true, marker: MARKER_FILE });
}
