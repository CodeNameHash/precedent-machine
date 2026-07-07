const { listEntries } = require('../../../../lib/review-queue/store');

module.exports = function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const includeResolved = req.query && String(req.query.include_resolved || req.query.includeResolved || '') === 'true';
    const entries = listEntries({ includeResolved });
    return res.status(200).json({ entries, total: entries.length });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
