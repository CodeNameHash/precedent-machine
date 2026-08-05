// Contained (503) — unchanged by S2. Restored (identical logic; the
// defect here was purely "unauthenticated") and ready behind
// lib/broad-corpus/contained-routes/reprocess-cond.js — see
// docs/API-ROUTE-CLASSIFICATION.md. Un-containing this route is separate
// work; this task's job was to make it safe to turn on, not to turn it on.
const { createBroadCorpusContainedHandler } = require('../../../lib/broad-corpus-containment');

export default createBroadCorpusContainedHandler('POST');
