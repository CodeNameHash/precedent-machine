const { resolveEntry } = require('../../../../../lib/review-queue/resolve');
const { blockVercelRepositoryArtifactRoute } = require('../../../../../lib/admin/repository-artifact-access');

function handler(req, res) {
  if (blockVercelRepositoryArtifactRoute(res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const id = req.query && req.query.id;
    if (!id) return res.status(400).json({ error: 'id is required' });
    const result = resolveEntry(id, req.body || {});
    return res.status(200).json({ ok: true, entry: result.entry, handoff: result.handoff });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}

module.exports = handler;
module.exports.default = handler;
