// Contained (503) — unchanged by S2. The is_admin self-grant this route was
// graded critical for is repaired, but dormant, at
// lib/broad-corpus/contained-routes/users.js — see
// docs/API-ROUTE-CLASSIFICATION.md. Un-containing this route is separate
// work; this task's job was to make it safe to turn on, not to turn it on.
const { createBroadCorpusContainedHandler } = require('../../lib/broad-corpus-containment');

export default createBroadCorpusContainedHandler(['GET', 'POST']);
