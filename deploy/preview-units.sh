#!/usr/bin/env bash
# Deploy a Cloudflare Pages PREVIEW of "start your own unit" (never production): branch "units" of project "bandsheet".
# Usage: deploy/preview-units.sh [--setup]
#   --setup  apply deploy/migrations-auth (0002_units.sql adds unit tables only) to the AUTH_DB database and set the
#            preview-environment secrets UNITS_REGISTRAR_KEY_JSON (keys/units-registrar.json: a function-call key limited to
#            unit_add_member / unit_remove_member / unit_add_issuer) and SPONSOR_KEY_JSON (the low-value gas sponsor). Values go
#            to wrangler's stdin only, never printed.
# Credentials: ~/.claude/vault/inject.sh get CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID --dir "$ROOT/deploy"
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
KEYS="${BANDSHEET_KEYS_DIR:-$ROOT/keys}"
SPONSOR="${UNITS_SPONSOR:-bsu-sponsor-2d3f96.testnet}"
cd "$ROOT"
[ -f deploy/.env.local ] || { echo "missing deploy/.env.local (see header)"; exit 1; }
set -a; source deploy/.env.local; set +a

cd web
if [[ " $* " == *" --setup "* ]]; then
  wrangler d1 migrations apply bandsheet-auth --remote --config wrangler.toml
  node -e 'const k=require(process.argv[1]);process.stdout.write(JSON.stringify({account_id:k.account_id,private_key:k.private_key}))' "$KEYS/units-registrar.json" \
    | wrangler pages secret put UNITS_REGISTRAR_KEY_JSON --project-name bandsheet --env preview >/dev/null
  node -e 'const k=require(process.argv[1]);process.stdout.write(JSON.stringify({account_id:k.account_id,private_key:k.private_key}))' "$KEYS/$SPONSOR.json" \
    | wrangler pages secret put SPONSOR_KEY_JSON --project-name bandsheet --env preview >/dev/null
  echo "preview secrets set: UNITS_REGISTRAR_KEY_JSON SPONSOR_KEY_JSON (values not printed)"
fi
cd "$ROOT"
pnpm --filter web build
cd web
wrangler pages deploy dist --project-name bandsheet --branch units --commit-dirty=true
