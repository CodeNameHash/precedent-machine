#!/usr/bin/env bash
set -euo pipefail

npm test
node scripts/audit/ioc-scope-mismatch.js
node scripts/lint/closing-condition-scope.js
bash scripts/lint/forbidden-patterns.sh
node scripts/lint/market-registry-completeness.js
node scripts/lint/component-reuse.js
node scripts/lint/party-scope-audit.js
node scripts/registry/detect-duplicates.js
node scripts/registry/orphan-detector.js
node scripts/registry/coverage-detector.js
node scripts/registry/provenance-log.js
