#!/usr/bin/env bash
# Build out/bandsheet_units.wasm (cargo output goes to the shared <repo>/target). Rust 1.86 and `--cfg near`,
# the same recipe as contracts/bandsheet (wasm from 1.87+ is rejected by nearcore's VM).
set -euo pipefail
cd "$(dirname "$0")"
export CARGO_TARGET_DIR=${CARGO_TARGET_DIR:-$(cd ../.. && pwd)/target}
RUSTFLAGS="--cfg near -C link-arg=-s" cargo +1.86.0 build --release --target wasm32-unknown-unknown -p bandsheet-units
mkdir -p out
IN=$CARGO_TARGET_DIR/wasm32-unknown-unknown/release/bandsheet_units.wasm
if command -v wasm-opt >/dev/null; then wasm-opt -Oz --signext-lowering "$IN" -o out/bandsheet_units.wasm; else cp "$IN" out/bandsheet_units.wasm; fi
shasum -a 256 out/bandsheet_units.wasm
