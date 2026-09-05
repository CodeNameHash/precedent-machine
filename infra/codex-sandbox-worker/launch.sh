#!/usr/bin/env bash
set -euo pipefail
umask 077

if [[ $# -ne 1 || ! "$1" =~ ^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$ ]]; then
  printf '%s\n' 'PRODUCT_HOSTED_RUN_ID_REQUIRED' >&2
  exit 64
fi

if [[ "${SUPABASE_URL:-}" != 'https://ecrtoofsyxozazkvsvcl.supabase.co' || -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  printf '%s\n' 'PRODUCT_HOSTED_PREVIEW_DATABASE_REQUIRED' >&2
  exit 78
fi

if [[ ! -f /vercel/.codex/auth.json ]]; then
  printf '%s\n' 'PRODUCT_HOSTED_CODEX_LOGIN_REQUIRED' >&2
  exit 78
fi

export PATH="/vercel/sandbox/pm-cli/bin:$PATH"
unset ANTHROPIC_API_KEY OPENAI_API_KEY CODEX_API_KEY CODEX_ACCESS_TOKEN
cd /vercel/sandbox/pm-product

# Concurrent wakes wait for the same account instead of sharing its refresh token.
exec flock --wait 3600 --conflict-exit-code 75 /vercel/.codex/pm-worker.lock \
  node scripts/product-hosted-worker.js --run-id "$1" --actor ben --workers 2
