// Contained (503) — unchanged by S2. The SSRF this route was graded
// critical for is repaired, but dormant, at
// lib/broad-corpus/contained-routes/from-url.js (the URL-retrieval guard
// lives in a sibling module in the same directory) — see
// docs/API-ROUTE-CLASSIFICATION.md. Un-containing this route is separate
// work (ingestion stays off); this task's job was to make it safe to turn
// on, not to turn it on.
const { createBroadCorpusContainedHandler } = require('../../../lib/broad-corpus-containment');

export default createBroadCorpusContainedHandler('POST');
