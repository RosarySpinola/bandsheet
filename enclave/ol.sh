#!/bin/bash
# OutLayer CLI against TESTNET with an isolated HOME, so it never reads or overwrites another
# project's ~/.outlayer credentials. Keys are read from ~/.near-credentials or keys/, never printed.
#   ./ol.sh login <account>      # copies that account's testnet key into the isolated home
#   ./ol.sh <any outlayer args>  # e.g. ./ol.sh whoami
set -euo pipefail
OL_HOME="${OL_HOME:-$HOME/.bandsheet-outlayer-home}"
mkdir -p "$OL_HOME/.outlayer/testnet"
if [ "${1:-}" = "login" ]; then
  acct="${2:?account id}"
  node -e '
    const fs = require("fs");
    const [acct, home] = process.argv.slice(1);
    const root = process.env.HOME + "/.near-credentials/testnet/";
    const alt = __dirname;
    let src;
    for (const p of [root + acct + ".json", process.env.BANDSHEET_KEYS + "/" + acct + ".json"]) {
      try { src = JSON.parse(fs.readFileSync(p, "utf8")); break; } catch {}
    }
    if (!src) { console.error("no key file for " + acct); process.exit(1); }
    const sk = src.private_key || src.secret_key;
    fs.writeFileSync(home + "/.outlayer/testnet/credentials.json",
      JSON.stringify({account_id: acct, public_key: src.public_key, private_key: sk, contract_id: "outlayer.testnet", auth_type: "near_key"}), {mode: 0o600});
    fs.writeFileSync(home + "/.outlayer/default-network", "testnet");
  ' "$acct" "$OL_HOME"
  echo "credentials written to $OL_HOME/.outlayer/testnet (account $acct)"
  exit 0
fi
HOME="$OL_HOME" OUTLAYER_NETWORK=testnet OUTLAYER_RPC_URL="${OUTLAYER_RPC_URL:-https://archival-rpc.testnet.near.org}" exec "${OUTLAYER_BIN:-outlayer}" "$@"
