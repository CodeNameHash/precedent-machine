'use strict';
// Direct-connection executor for oversized canonical v2 staging scripts.
// Spawned by the staging runtime when a governed --db-url is supplied: the
// linked Management API path rejects large request bodies, and the CLI's
// --db-url path uses prepared statements that cannot carry multi-command
// transactions. This child reads the SQL file and the database URL file
// written by the runtime, executes the script as one simple-protocol query
// (single session, so BEGIN/ROLLBACK semantics are preserved) and prints
// {"rows":[...]} from the last row-returning statement, matching the
// linked path's output contract. It receives no secrets via argv or env.
const { readFileSync } = require('node:fs');
const { Client } = require('pg');

const [sqlFile, urlFile] = process.argv.slice(2);
if (!sqlFile || !urlFile) {
  process.stderr.write('Usage: canonical-v2-staging-pg-exec.cjs <sql-file> <db-url-file>\n');
  process.exit(2);
}
const sql = readFileSync(sqlFile, 'utf8');
const dbUrl = readFileSync(urlFile, 'utf8').trim();

(async () => {
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000,
  });
  await client.connect();
  try {
    const outcome = await client.query(sql);
    const results = Array.isArray(outcome) ? outcome : [outcome];
    let rows = [];
    for (const result of results) {
      if (Array.isArray(result.rows) && result.rows.length > 0) {
        rows = result.rows;
      }
    }
    process.stdout.write(JSON.stringify({ rows }));
  } finally {
    await client.end();
  }
})().catch((error) => {
  process.stderr.write(`staging pg exec failed: ${error.message}\n`);
  process.exit(1);
});
