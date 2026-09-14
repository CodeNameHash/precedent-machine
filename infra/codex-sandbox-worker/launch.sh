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

# Ben, 2026-09-14: "Can you flip the codex cli to Claude cli?" The wake names
# the provider; each path checks its own login and nothing else.
case "${PRODUCT_MODEL_PROVIDER:-OPENAI_CODEX_CLI_SUBSCRIPTION}" in
  OPENAI_CODEX_CLI_SUBSCRIPTION)
    if [[ ! -f /vercel/.codex/auth.json ]]; then
      printf '%s\n' 'PRODUCT_HOSTED_CODEX_LOGIN_REQUIRED' >&2
      exit 78
    fi
    ;;
  ANTHROPIC_CLAUDE_CLI_SUBSCRIPTION)
    if [[ -z "${CLAUDE_CODE_OAUTH_TOKEN:-}" ]]; then
      printf '%s\n' 'PRODUCT_HOSTED_CLAUDE_LOGIN_REQUIRED' >&2
      exit 78
    fi
    if ! command -v claude >/dev/null 2>&1; then
      printf '%s\n' 'PRODUCT_HOSTED_CLAUDE_CLI_REQUIRED' >&2
      exit 78
    fi
    ;;
  *)
    printf '%s\n' 'PRODUCT_HOSTED_PROVIDER_UNSUPPORTED' >&2
    exit 78
    ;;
esac

export PATH="/vercel/sandbox/pm-cli/bin:$PATH"
unset ANTHROPIC_API_KEY OPENAI_API_KEY CODEX_API_KEY CODEX_ACCESS_TOKEN
cd /vercel/sandbox/pm-product

# Concurrent wakes wait for the same account instead of sharing its refresh token.
exec flock --wait 3600 --conflict-exit-code 75 /vercel/.codex/pm-worker.lock \
  node scripts/product-hosted-worker.js --run-id "$1" --actor ben --workers 2
