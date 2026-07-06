const { spawnSync } = require('child_process');
const path = require('path');

const scripts = [
  'ioc-other-exclusions.js',
  'rw-sec-filings-portions-excluded.js',
  'rw-general-lookback-scopes.js',
];

for (const script of scripts) {
  const result = spawnSync(process.execPath, [path.join(__dirname, script)], {
    cwd: process.cwd(),
    stdio: 'inherit',
  });
  if (result.status !== 0) process.exit(result.status || 1);
}
