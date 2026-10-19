#!/usr/bin/env bash
set -euo pipefail
umask 077

# Work package E2 (implementer E; the manager, 2026-10-19 02:55 UTC): the
# ablation job on the experiments sandbox, launched by
# lib/product/sandbox-wake.js wakeSandboxAblation with the same environment
# a run wake passes. Arguments: the job id (pm-ablation-<timestamp>), the
# run id, the sections (comma-separated) and the variants (comma-separated).
# Everything the job writes goes under /vercel/sandbox/<job id>/: job.log,
# ablation-rows.json (the snapshot dumped here from the database),
# ablation.md, ablation.json, ablation-recording.json, analysis/ for
# compare-generations.js, and exit-code when the job ends. Nothing is
# written to the product tables.

if [[ $# -ne 4 || ! "$1" =~ ^pm-ablation-[0-9]{8}T[0-9]{6}Z$ ]]; then
  printf '%s\n' 'PRODUCT_ABLATION_JOB_ID_REQUIRED' >&2
  exit 64
fi
if [[ ! "$2" =~ ^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$ ]]; then
  printf '%s\n' 'PRODUCT_HOSTED_RUN_ID_REQUIRED' >&2
  exit 64
fi
if [[ ! "$3" =~ ^[A-Za-z0-9][A-Za-z0-9.()_,-]*$ || ! "$4" =~ ^[a-z][a-z0-9_,]*$ ]]; then
  printf '%s\n' 'PRODUCT_ABLATION_ARGUMENTS_INVALID' >&2
  exit 64
fi

if [[ "${SUPABASE_URL:-}" != 'https://ecrtoofsyxozazkvsvcl.supabase.co' || -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  printf '%s\n' 'PRODUCT_HOSTED_PREVIEW_DATABASE_REQUIRED' >&2
  exit 78
fi

export PATH="/vercel/sandbox/pm-cli/bin:$PATH"

case "${PRODUCT_MODEL_PROVIDER:-}" in
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
  ANTHROPIC_API)
    if [[ -z "${ANTHROPIC_API_KEY:-}" ]]; then
      printf '%s\n' 'PRODUCT_HOSTED_ANTHROPIC_API_KEY_REQUIRED' >&2
      exit 78
    fi
    ;;
  *)
    printf '%s\n' 'PRODUCT_HOSTED_PROVIDER_UNSUPPORTED' >&2
    exit 78
    ;;
esac

unset OPENAI_API_KEY CODEX_API_KEY CODEX_ACCESS_TOKEN
if [[ "${PRODUCT_MODEL_PROVIDER:-}" != 'ANTHROPIC_API' ]]; then
  unset ANTHROPIC_API_KEY ANTHROPIC_WORKSPACE_ID
fi

JOB_DIR="/vercel/sandbox/$1"
mkdir -p "$JOB_DIR"
cd /vercel/sandbox/pm-product

# One ablation job at a time on the sandbox; a second wake waits for the
# first (its own lock, never the run worker's).
exec flock --wait 3600 --conflict-exit-code 75 /vercel/.codex/pm-ablation.lock \
  bash -c '
    set -o pipefail
    job_dir="$1"; run_id="$2"; sections="$3"; variants="$4"
    printf "%s\n" "{\"event\":\"ABLATION_JOB_START\",\"at\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"run_id\":\"$run_id\",\"sections\":\"$sections\",\"variants\":\"$variants\",\"provider\":\"$PRODUCT_MODEL_PROVIDER\",\"commit\":\"$(git rev-parse --short HEAD 2>/dev/null || echo unknown)\"}" | tee -a "$job_dir/job.log"
    node scripts/product/cost-ablation.js --run "$run_id" --sections "$sections" --variant "$variants" \
      --provider "$PRODUCT_MODEL_PROVIDER" --live \
      --dump-snapshot "$job_dir/ablation-rows.json" --record "$job_dir/ablation-recording.json" \
      --out "$job_dir/ablation.md" --json "$job_dir/ablation.json" --analysis-dir "$job_dir/analysis" 2>&1 | tee -a "$job_dir/job.log"
    code=${PIPESTATUS[0]}
    printf "%s\n" "{\"event\":\"ABLATION_JOB_END\",\"at\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"exit_code\":$code}" | tee -a "$job_dir/job.log"
    printf "%s\n" "$code" > "$job_dir/exit-code"
    exit "$code"
  ' bash "$JOB_DIR" "$2" "$3" "$4"
