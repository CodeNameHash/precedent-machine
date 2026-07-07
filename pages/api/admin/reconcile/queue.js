import fs from 'fs';
import { rankCandidates } from '../../../../lib/schema-shape/similarity';

export default function handler(req, res) {
  const queue = JSON.parse(fs.readFileSync('docs/schema-shape/reconciliation-queue.json', 'utf8'));
  const entries = queue.entries || [];
  const suggestions = Object.fromEntries(entries.map((entry) => [entry.id, rankCandidates(entry.rawValue, { vocab: entry.vocab, shape: entry.field }).slice(0, 3)]));
  return res.status(200).json({ entries, suggestions });
}
