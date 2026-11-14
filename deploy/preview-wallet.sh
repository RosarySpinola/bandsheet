#!/usr/bin/env bash
# Deploy a Cloudflare Pages PREVIEW of the sign-in branch (never production): branch "wallet" of project "bandsheet".
# Usage: deploy/preview-wallet.sh [--setup]
#   --setup  create the AUTH_DB database if missing, apply deploy/migrations-auth, and set the preview-environment
#            secrets OWNER_KEY_JSON (keys/owner/<owner>.json), DEMO_INVITE_JSON, COUNCIL_KEYS_JSON from keys/ (never printed)
# Credentials: ~/.claude/vault/inject.sh get CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID --dir "$ROOT/deploy"
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
KEYS="${BANDSHEET_KEYS_DIR:-$ROOT/keys}"
cd "$ROOT"
[ -f deploy/.env.local ] || { echo "missing deploy/.env.local (see header)"; exit 1; }
set -a; source deploy/.env.local; set +a

cd web
if [[ " $* " == *" --setup "* ]]; then
  wrangler d1 migrations apply bandsheet-auth --remote --config wrangler.toml
  owner="$(node -e 'console.log(require(process.argv[1]).owner)' "$ROOT/scripts/deployed.json")"
  node -e 'const k=require(process.argv[1]);process.stdout.write(JSON.stringify({account_id:k.account_id,private_key:k.private_key}))' "$KEYS/owner/$owner.json" \
    | wrangler pages secret put OWNER_KEY_JSON --project-name bandsheet --env preview >/dev/null
  node -e 'process.stdout.write(JSON.stringify(require(process.argv[1])))' "$KEYS/invites/demo-member.json" \
    | wrangler pages secret put DEMO_INVITE_JSON --project-name bandsheet --env preview >/dev/null
  node -e 'const ids=require(process.argv[1]).council;const o={};for(const id of ids)o[id]=require(process.argv[2]+"/"+id+".json").private_key;process.stdout.write(JSON.stringify(o))' "$ROOT/scripts/deployed.json" "$KEYS" \
    | wrangler pages secret put COUNCIL_KEYS_JSON --project-name bandsheet --env preview >/dev/null
  echo "preview secrets set: OWNER_KEY_JSON DEMO_INVITE_JSON COUNCIL_KEYS_JSON (values not printed)"
fi
cd "$ROOT"
pnpm --filter web build
cd web
wrangler pages deploy dist --project-name bandsheet --branch wallet --commit-dirty=true
