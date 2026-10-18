#!/usr/bin/env node
'use strict';

// Phase 6: "Load the reviewed candidate through an inactive release
// pointer." Reads one run's review readiness and, with --publish, sends
// the review page's own PUBLISH command through the product's HTTP
// boundary, which creates an immutable release the current-release
// pointer does not select (lib/product/release-candidate.js). The script
// never decides a review item and never activates a release.
//
//   PRODUCT_INTERNAL_TOKEN=... node scripts/product/load-release-candidate.js --run <run-id> --base-url <deployment>
//   PRODUCT_INTERNAL_TOKEN=... node scripts/product/load-release-candidate.js --run <run-id> --base-url <deployment> --publish
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/product/load-release-candidate.js --run <run-id> [--actor ben] [--publish]
//
// Exit codes: 0 loaded (or, without --publish, publishable); 2 not
// publishable (the blockers are printed); 1 a request failed.

const { cutoverClientFromEnvironment } = require('../../lib/product/cutover-client');
const { loadReleaseCandidate, renderAssessment } = require('../../lib/product/release-candidate');

function parseArgs(argv) {
  const args = { run: null, baseUrl: null, actor: null, publish: false, json: false, idempotencyKey: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--run') args.run = argv[i += 1];
    else if (argv[i] === '--base-url') args.baseUrl = argv[i += 1];
    else if (argv[i] === '--actor') args.actor = argv[i += 1];
    else if (argv[i] === '--idempotency-key') args.idempotencyKey = argv[i += 1];
    else if (argv[i] === '--publish') args.publish = true;
    else if (argv[i] === '--json') args.json = true;
    else { console.error(`unknown argument ${argv[i]}`); process.exit(64); }
  }
  return args;
}

(async () => {
  const args = parseArgs(process.argv.slice(2));
  if (!args.run) { console.error('usage: load-release-candidate.js --run <run-id> [--base-url <url> | SUPABASE env] [--actor <name>] [--publish] [--json]'); process.exit(64); }
  const client = cutoverClientFromEnvironment({ baseUrl: args.baseUrl, actor: args.actor });
  const result = await loadReleaseCandidate({ client, runId: args.run, publish: args.publish, idempotencyKey: args.idempotencyKey });
  if (args.json) console.log(JSON.stringify(result, null, 2));
  else {
    console.log(renderAssessment(result.assessment));
    if (result.published) {
      console.log(`published: review ${result.proof.review_status}; release ${result.release ? result.release.release_id : 'NOT CREATED'} (publication ${result.release?.publication_version}, supersedes ${result.release?.supersedes_release_id ? result.release.supersedes_release_id.slice(0, 12) : 'nothing'}, ${result.release?.summary_fact_count} facts in its summary)`);
      for (const [check, passed] of Object.entries(result.proof)) if (typeof passed === 'boolean') console.log(`  ${passed ? 'pass' : 'FAIL'} ${check.replaceAll('_', ' ')}`);
      console.log(`published read for this source before: ${JSON.stringify(result.visible_before)}; after: ${JSON.stringify(result.visible_after)}`);
      console.log(result.loaded ? 'loaded: the candidate is a release the pointer does not select' : 'NOT LOADED: see the failed checks');
    } else if (args.publish) console.log('nothing published');
    else console.log(`published read for this source: ${JSON.stringify(result.visible_before)}`);
  }
  process.exit(result.loaded || (!args.publish && result.assessment.blockers.length === 0) ? 0 : 2);
})().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
