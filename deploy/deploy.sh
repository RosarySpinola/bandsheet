#!/usr/bin/env bash
# Redeploy Bandsheet to Cloudflare Pages (project "bandsheet", https://bandsheet.pages.dev).
# Usage: deploy/deploy.sh [--secrets] [--migrate]
#   --secrets  also push NEARAI_API_KEY / COUNCIL_KEYS_JSON / DEMO_INVITE_JSON (deploy/put-secrets.mjs)
#   --migrate  also apply deploy/migrations to the remote D1 database
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Credentials: ~/.claude/vault/inject.sh get CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID --dir "$ROOT/deploy"
[ -f deploy/.env.local ] || { echo "missing deploy/.env.local (see header)"; exit 1; }
set -a; . deploy/.env.local; set +a

pnpm --filter web build

cd web
if [[ " $* " == *" --migrate "* ]]; then
  wrangler d1 migrations apply bandsheet-spend --remote --config wrangler.toml
fi
if [[ " $* " == *" --secrets "* ]]; then
  node ../deploy/put-secrets.mjs
fi
# main is the Pages production branch; the URL stays on *.pages.dev (no custom domain).
wrangler pages deploy dist --project-name bandsheet --branch main --commit-dirty=true
