#!/usr/bin/env bash
# Build out/bandsheet.wasm and out/mock_outlayer.wasm (cargo output goes to the shared <repo>/target).
# Rust 1.86 (wasm from 1.87+ is rejected by nearcore's VM) and `--cfg near`, same recipe as the sibling contracts.
set -euo pipefail
cd "$(dirname "$0")"
export CARGO_TARGET_DIR=${CARGO_TARGET_DIR:-$(cd ../.. && pwd)/target}
RUSTFLAGS="--cfg near -C link-arg=-s" cargo +1.86.0 build --release --target wasm32-unknown-unknown -p bandsheet -p mock-outlayer
mkdir -p out
for f in bandsheet mock_outlayer; do
  IN=$CARGO_TARGET_DIR/wasm32-unknown-unknown/release/$f.wasm
  if command -v wasm-opt >/dev/null; then wasm-opt -Oz --signext-lowering "$IN" -o out/$f.wasm; else cp "$IN" out/$f.wasm; fi
  shasum -a 256 out/$f.wasm
done
