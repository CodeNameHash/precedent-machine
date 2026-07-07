import fs from 'fs';

export default function handler(req, res) {
  const normalized = JSON.parse(fs.readFileSync('docs/schema-shape/normalized-v1.json', 'utf8'));
  const columns = (normalized.entries || []).slice(0, 6).map((entry) => ({ key: entry.key, label: entry.displayName || entry.key, required: false }));
  const rows = [{
    deal_id: 'corpus-baseline',
    deal_name: 'Corpus baseline',
    cells: Object.fromEntries(columns.map((column) => [column.key, { status: 'green', canonicalKey: column.key, sourceProvisionId: null }])),
  }];
  res.status(200).json({ columns, rows });
}
