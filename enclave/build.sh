#!/bin/bash
# Builds the OutLayer module (wasm32-wasip2) into enclave/out/bandsheet-enclave.wasm and prints its sha256.
set -euo pipefail
cd "$(dirname "$0")"
rustup target add wasm32-wasip2 2>/dev/null || true
cargo build --release --target wasm32-wasip2 -p bandsheet-enclave --locked
mkdir -p out
TARGET_DIR="$(cargo metadata --format-version 1 --no-deps | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).target_directory))')"
cp "$TARGET_DIR/wasm32-wasip2/release/bandsheet-enclave.wasm" out/bandsheet-enclave.wasm
grep -qa outlayer.manifest out/bandsheet-enclave.wasm || { echo "manifest section missing" >&2; exit 1; }
echo "$(wc -c < out/bandsheet-enclave.wasm) bytes  sha256=$(shasum -a 256 out/bandsheet-enclave.wasm | cut -d' ' -f1)"
