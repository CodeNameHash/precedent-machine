const fs = require('fs');
const path = require('path');
const { KIND_SLUGS, QUERY_KINDS } = require('../../../lib/query/types');

function schemaFor(kind) {
  const file = path.join(process.cwd(), 'lib/query/schemas', `${kind}.json`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export default function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });
  const kinds = QUERY_KINDS.map((kind) => ({
    kind,
    slug: KIND_SLUGS[kind],
    schema: schemaFor(kind),
  }));
  return res.status(200).json({ kinds });
}
